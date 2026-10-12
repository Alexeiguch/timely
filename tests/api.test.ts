import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { taskSchema } from "../packages/contracts/src/index";
import { CommandError } from "../packages/sync/src/index";
const mocks = vi.hoisted(() => ({ session: vi.fn(), allow: vi.fn() }));
vi.mock("../packages/auth/src/server", () => ({
  auth: () => ({ api: { getSession: mocks.session } }),
}));
vi.mock("../packages/db/src/account", () => ({
  allowPlannerRequest: mocks.allow,
}));
import { ApiError, authenticated, readBody } from "../apps/web/server/api";
const request = (headers: HeadersInit = {}) =>
  new Request("https://planner.test/api/v1/sync/push", { headers });
beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_URL", "https://planner.test");
  mocks.session.mockResolvedValue({
    user: { id: "owner-a" },
    session: { id: "session-a" },
  });
  mocks.allow.mockResolvedValue(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("derives authority from the session and returns private responses with a request ID", async () => {
  const handler = vi.fn().mockResolvedValue({ saved: true });
  const response = await authenticated(
    request({ "x-timely-account": "owner-a" }),
    handler,
  );
  expect(handler).toHaveBeenCalledWith("owner-a", "session-a");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-request-id")).toBeTruthy();
});
it("rejects cross-site requests, expired sessions and other accounts before executing", async () => {
  const handler = vi.fn();
  expect(
    (await authenticated(request({ origin: "https://other.test" }), handler))
      .status,
  ).toBe(403);
  expect(
    (await authenticated(request({ "sec-fetch-site": "cross-site" }), handler))
      .status,
  ).toBe(403);
  expect(
    (await authenticated(request({ "x-timely-account": "owner-b" }), handler))
      .status,
  ).toBe(403);
  mocks.session.mockResolvedValue(null);
  expect((await authenticated(request(), handler)).status).toBe(401);
  expect(handler).not.toHaveBeenCalled();
});
it("honors throttling without invoking the mutation", async () => {
  mocks.allow.mockResolvedValue(false);
  const handler = vi.fn();
  const response = await authenticated(request(), handler);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("60");
  expect(handler).not.toHaveBeenCalled();
});
it.each([
  [new ApiError("INVALID_COMMAND", 415, "Send JSON"), 415, "INVALID_COMMAND"],
  [new CommandError("FORBIDDEN", "Wrong owner"), 403, "FORBIDDEN"],
  [new CommandError("INVALID_COMMAND", "Invalid edit"), 400, "INVALID_COMMAND"],
  [
    taskSchema.safeParse({ title: "private task" }).error,
    400,
    "INVALID_COMMAND",
  ],
])("classifies known errors", async (error, status, code) => {
  const response = await authenticated(request(), async () => {
    throw error;
  });
  expect(response.status).toBe(status);
  expect((await response.json()).code).toBe(code);
});
it.each([new TypeError("secret task / OTP 123456"), null])(
  "reports internal bugs as 500 with sanitized correlated diagnostics",
  async (error) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await authenticated(request(), async () => {
      throw error;
    });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.requestId).toBe(response.headers.get("x-request-id"));
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.parse(log.mock.calls[0]![0])).toMatchObject({
      event: "api_failure",
      requestId: body.requestId,
    });
    expect(JSON.stringify([body, log.mock.calls])).not.toMatch(
      /123456|secret task/,
    );
  },
);
it("keeps recognized connection outages distinct and logs authentication failures too", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.session.mockRejectedValue(
    Object.assign(new Error("private database URL"), { code: "ECONNREFUSED" }),
  );
  const response = await authenticated(request(), async () => ({}));
  expect(response.status).toBe(503);
  expect((await response.json()).code).toBe("TEMPORARY_UNAVAILABLE");
  expect(log).toHaveBeenCalledOnce();
  expect(JSON.stringify(log.mock.calls)).not.toContain("private database URL");
});
it.each([
  ["text/plain", "{}", 415],
  ["application/json", "{broken", 400],
  ["application/json", "x".repeat(1048577), 413],
])("bounds and validates request bodies", async (contentType, body, status) => {
  await expect(
    readBody(
      new Request("https://planner.test", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      }),
    ),
  ).rejects.toMatchObject({ status });
});
it("reads JSON and rejects missing bodies", async () => {
  expect(
    await readBody(
      new Request("https://planner.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"count":1}',
      }),
    ),
  ).toEqual({ count: 1 });
  await expect(
    readBody(
      new Request("https://planner.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    ),
  ).rejects.toMatchObject({ status: 400 });
});
