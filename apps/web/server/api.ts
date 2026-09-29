import { randomUUID } from "node:crypto";
import { auth } from "@timely/auth/server";
import { CommandError } from "@timely/sync";

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError("INVALID_COMMAND", 415, "Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError("INVALID_COMMAND", 400, "A request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1048576) {
      await reader.cancel();
      throw new ApiError("INVALID_COMMAND", 413, "Request exceeds 1 MiB.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError("INVALID_COMMAND", 400, "Send valid JSON.");
  }
}
const windows = new Map<string, { start: number; count: number }>();
export async function authenticated(
  request: Request,
  handler: (ownerId: string) => Promise<unknown>,
) {
  const requestId = randomUUID();
  try {
    const origin = request.headers.get("origin");
    const allowed = process.env.BETTER_AUTH_URL
      ? new URL(process.env.BETTER_AUTH_URL).origin
      : new URL(request.url).origin;
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== allowed)
    )
      throw new ApiError("FORBIDDEN", 403, "This origin is not allowed.");
    const session = await auth().api.getSession({ headers: request.headers });
    if (!session)
      throw new ApiError(
        "UNAUTHENTICATED",
        401,
        "Sign in to synchronize your saved changes.",
      );
    const account = request.headers.get("x-timely-account");
    if (account && account !== session.user.id)
      throw new ApiError(
        "FORBIDDEN",
        403,
        "Sign in to the account that owns these local changes.",
      );
    const now = Date.now();
    if (windows.size > 10000)
      for (const [key, window] of windows)
        if (window.start < now - 60000) windows.delete(key);
    const window = windows.get(session.user.id);
    if (!window || now - window.start >= 60000)
      windows.set(session.user.id, { start: now, count: 1 });
    else if (++window.count > 180)
      throw new ApiError("RATE_LIMITED", 429, "Please retry shortly.");
    const result = await handler(session.user.id);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch (error) {
    // Zod issues contain field paths/messages only; never echo supplied task content.
    const validation = error as {
      name?: string;
      issues?: Array<{ path: unknown[]; message: string }>;
    };
    const known = error instanceof ApiError || error instanceof CommandError;
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof CommandError
          ? error.code === "FORBIDDEN"
            ? 403
            : 400
          : validation?.name === "ZodError"
            ? 400
            : 503;
    const code = known
      ? error.code
      : status === 400
        ? "INVALID_COMMAND"
        : "TEMPORARY_UNAVAILABLE";
    return Response.json(
      {
        code,
        message: known
          ? error.message
          : status === 400
            ? "Check the supplied fields."
            : "Synchronization is temporarily unavailable. Your local changes are safe.",
        requestId,
        ...(validation?.name === "ZodError"
          ? {
              fields: validation.issues?.map((i) => ({
                path: i.path,
                message: i.message,
              })),
            }
          : {}),
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
          ...(status === 429 ? { "Retry-After": "60" } : {}),
        },
      },
    );
  }
}
