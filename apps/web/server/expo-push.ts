import { expoPushTokenSchema } from "@timely/contracts";
type Result = {
  status: "ticket" | "retry" | "failed" | "uncertain" | "delivered";
  receiptId?: string;
  error?: string;
};
const safeErrors = new Set([
  "DeviceNotRegistered",
  "MessageTooBig",
  "MessageRateExceeded",
  "MismatchSenderId",
  "InvalidCredentials",
]);
function failure(error: unknown): Result {
  const code =
    typeof error === "string" && safeErrors.has(error)
      ? error
      : "ProviderRejected";
  return {
    status: code === "MessageRateExceeded" ? "retry" : "failed",
    error: code,
  };
}
export function pushConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const projectId = env.EXPO_PUSH_PROJECT_ID;
  const projectOk = !!projectId && /^[0-9a-f-]{36}$/i.test(projectId);
  const hosted = env.NODE_ENV === "production" && env.APP_ENV !== "local";
  const enabled =
    env.EXPO_PUSH_ENABLED === "true" &&
    projectOk &&
    (!hosted || !!env.EXPO_ACCESS_TOKEN?.trim());
  return { enabled, projectId: enabled ? projectId : null };
}
function headers(env: NodeJS.ProcessEnv = process.env) {
  const token = env.EXPO_ACCESS_TOKEN?.trim();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
export function expoPush(fetcher: typeof fetch = fetch) {
  return {
    async send(message: {
      to: string;
      title: string;
      body: string;
      data: Record<string, unknown>;
      expiration: number;
      collapseId: string;
    }): Promise<Result> {
      expoPushTokenSchema.parse(message.to);
      try {
        const response = await fetcher("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: headers(),
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            ...message,
            sound: "default",
            priority: "high",
            channelId: "plans",
            tag: message.collapseId,
          }),
        });
        if (response.status === 429)
          return { status: "retry", error: "RateLimited" };
        if (response.status >= 500)
          return { status: "uncertain", error: "ProviderUnavailable" };
        if (!response.ok)
          return { status: "failed", error: "ProviderRejected" };
        const body: unknown = await response.json();
        const data =
          body && typeof body === "object" && "data" in body ? body.data : null;
        const ticket = Array.isArray(data) ? data[0] : data;
        if (
          ticket?.status === "ok" &&
          typeof ticket.id === "string" &&
          ticket.id.length > 0 &&
          ticket.id.length <= 200
        )
          return { status: "ticket", receiptId: ticket.id };
        if (ticket?.status === "error") return failure(ticket.details?.error);
        return { status: "uncertain", error: "InvalidAcknowledgement" };
      } catch {
        return { status: "uncertain", error: "ConnectionUnavailable" };
      }
    },
    async receipts(ids: string[]): Promise<Record<string, Result>> {
      if (!ids.length || ids.length > 1000) return {};
      try {
        const response = await fetcher(
          "https://exp.host/--/api/v2/push/getReceipts",
          {
            method: "POST",
            headers: headers(),
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({ ids }),
          },
        );
        if (!response.ok) return {};
        const body: unknown = await response.json();
        if (
          !body ||
          typeof body !== "object" ||
          !("data" in body) ||
          !body.data ||
          typeof body.data !== "object"
        )
          return {};
        const data = body.data as Record<
          string,
          { status?: unknown; details?: { error?: unknown } }
        >;
        return Object.fromEntries(
          ids.flatMap((id) =>
            data[id]?.status === "ok"
              ? [[id, { status: "delivered" as const }]]
              : data[id]?.status === "error"
                ? [[id, failure(data[id]?.details?.error)]]
                : [],
          ),
        );
      } catch {
        return {};
      }
    },
  };
}
