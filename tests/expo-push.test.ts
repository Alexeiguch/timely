import { afterEach, expect, it, vi } from "vitest";
import { expoPush, pushConfiguration } from "../apps/web/server/expo-push";
afterEach(() => vi.unstubAllEnvs());
const message = {
  to: "ExpoPushToken[synthetic-token]",
  title: "Private test title",
  body: "Synthetic body",
  data: { ownerId: "synthetic-owner" },
  expiration: 1792000000,
  collapseId: "test-identity",
};
it("requires explicit server activation and a configured project", () => {
  vi.stubEnv("EXPO_PUSH_ENABLED", "false");
  expect(pushConfiguration().enabled).toBe(false);
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PUSH_PROJECT_ID", "invalid");
  expect(pushConfiguration().enabled).toBe(false);
  vi.stubEnv("EXPO_PUSH_PROJECT_ID", "ccd23170-5d7c-4937-8cb1-9a42ab67ccf4");
  expect(pushConfiguration().enabled).toBe(true);
});
it("keeps hosted push disabled until a server access token is set", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PUSH_PROJECT_ID", "ccd23170-5d7c-4937-8cb1-9a42ab67ccf4");
  expect(pushConfiguration().enabled).toBe(false);
  expect(pushConfiguration().projectId).toBeNull();
  vi.stubEnv("EXPO_ACCESS_TOKEN", " synthetic-server-secret ");
  expect(pushConfiguration()).toEqual({
    enabled: true,
    projectId: "ccd23170-5d7c-4937-8cb1-9a42ab67ccf4",
  });
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("EXPO_ACCESS_TOKEN", "");
  expect(pushConfiguration().enabled).toBe(true);
});
it("uses the official Expo endpoint with bounded expiry and a server-only access token", async () => {
  vi.stubEnv("EXPO_ACCESS_TOKEN", "synthetic-server-secret");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ data: { status: "ok", id: "synthetic-receipt" } }),
    );
  expect(await expoPush(fetcher).send(message)).toEqual({
    status: "ticket",
    receiptId: "synthetic-receipt",
  });
  const [url, request] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://exp.host/--/api/v2/push/send");
  expect(new Headers(request?.headers).get("Authorization")).toBe(
    "Bearer synthetic-server-secret",
  );
  expect(JSON.parse(String(request?.body))).toMatchObject({
    expiration: message.expiration,
    collapseId: message.collapseId,
    channelId: "plans",
    data: message.data,
  });
});
it("does not retry ambiguous acceptance or expose provider payloads", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error(`private ${message.to} secret`));
  expect(await expoPush(fetcher).send(message)).toEqual({
    status: "uncertain",
    error: "ConnectionUnavailable",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValue(Response.json({ private: message.title }));
  expect(await expoPush(fetcher).send(message)).toEqual({
    status: "uncertain",
    error: "InvalidAcknowledgement",
  });
  fetcher.mockResolvedValue(
    new Response("private-provider-payload", { status: 503 }),
  );
  expect(await expoPush(fetcher).send(message)).toEqual({
    status: "uncertain",
    error: "ProviderUnavailable",
  });
});
it("only retries explicit rejection and recognizes invalid device credentials", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("", { status: 429 }));
  expect(await expoPush(fetcher).send(message)).toEqual({
    status: "retry",
    error: "RateLimited",
  });
  fetcher.mockResolvedValue(
    Response.json({
      data: {
        status: "error",
        message: "private",
        details: { error: "DeviceNotRegistered" },
      },
    }),
  );
  expect(await expoPush(fetcher).send(message)).toEqual({
    status: "failed",
    error: "DeviceNotRegistered",
  });
});
it("checks individual receipts without confusing provider handoff with missing receipts", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      data: {
        accepted: { status: "ok" },
        removed: {
          status: "error",
          details: { error: "DeviceNotRegistered" },
        },
        other: { status: "ok" },
      },
    }),
  );
  expect(
    await expoPush(fetcher).receipts(["accepted", "removed", "missing"]),
  ).toEqual({
    accepted: { status: "delivered" },
    removed: { status: "failed", error: "DeviceNotRegistered" },
  });
});
