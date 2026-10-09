import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runPushWorker } from "../apps/web/server/push-worker";
import { notificationRepository } from "@timely/db/notifications";
import { expoPush } from "../apps/web/server/expo-push";
import { randomUUID } from "node:crypto";
const now = Date.parse("2026-10-08T09:00:00Z");
function fixture() {
  const job = {
    ownerId: randomUUID(),
    deviceId: randomUUID(),
    key: randomUUID(),
    kind: "test",
    due: now,
    expires: now + 120000,
    attempts: 0,
  };
  const repo = {
    recover: vi.fn().mockResolvedValue(undefined),
    owners: vi.fn().mockResolvedValue([job.ownerId]),
    reconcile: vi.fn().mockResolvedValue(undefined),
    due: vi.fn().mockResolvedValue([job]),
    claim: vi
      .fn()
      .mockResolvedValue({
        job,
        item: null,
        push: {
          token: "ExpoPushToken[synthetic-worker]",
          language: "es",
          environment: "https://staging.example.test",
        },
      }),
    finish: vi.fn().mockResolvedValue(undefined),
    receipts: vi.fn().mockResolvedValue([]),
    postponeReceipt: vi.fn().mockResolvedValue(undefined),
  };
  const provider = {
    send: vi
      .fn()
      .mockResolvedValue({ status: "ticket", receiptId: "synthetic-receipt" }),
    receipts: vi.fn().mockResolvedValue({}),
  };
  const run = () =>
    runPushWorker(
      repo as unknown as ReturnType<typeof notificationRepository>,
      provider as unknown as ReturnType<typeof expoPush>,
      now,
    );
  return { repo, provider, job, run };
}
beforeEach(() => {
  vi.stubEnv("EXPO_PUSH_ENABLED", "true");
  vi.stubEnv("EXPO_PUSH_PROJECT_ID", randomUUID());
});
afterEach(() => vi.unstubAllEnvs());
it("rechecks canonical claims before sending and does not leak content in worker results", async () => {
  const f = fixture();
  f.repo.claim.mockResolvedValue(null);
  expect(await f.run()).toEqual({
    enabled: true,
    reconciled: 1,
    sent: 0,
    receipts: 0,
  });
  expect(f.provider.send).not.toHaveBeenCalled();
  expect(f.repo.finish).not.toHaveBeenCalled();
});
it("sends localized tests with the recipient's backend origin and bounded expiration", async () => {
  const f = fixture();
  const result = await f.run();
  expect(result).toEqual({
    enabled: true,
    reconciled: 1,
    sent: 1,
    receipts: 0,
  });
  expect(f.provider.send).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Timely · Prueba de notificación remota",
      expiration: Math.floor(f.job.expires / 1000),
      data: expect.objectContaining({
        environment: "https://staging.example.test",
        ownerId: f.job.ownerId,
        key: f.job.key,
      }),
    }),
  );
  expect(JSON.stringify(result)).not.toContain(f.job.ownerId);
});
it("retries explicit rejection within expiry but does not retry uncertain acceptance", async () => {
  const f = fixture();
  f.provider.send.mockResolvedValue({ status: "retry", error: "RateLimited" });
  await f.run();
  expect(f.repo.finish).toHaveBeenLastCalledWith(
    f.job,
    expect.objectContaining({ status: "pending", nextAttempt: now + 2000 }),
    now,
  );
  f.provider.send.mockResolvedValue({
    status: "uncertain",
    error: "ConnectionUnavailable",
  });
  await f.run();
  expect(f.repo.finish).toHaveBeenLastCalledWith(
    f.job,
    expect.objectContaining({ status: "uncertain" }),
    now,
  );
  f.provider.send.mockResolvedValue({ status: "retry", error: "RateLimited" });
  f.job.expires = now + 29000;
  await f.run();
  expect(f.repo.finish).toHaveBeenLastCalledWith(
    f.job,
    expect.objectContaining({ status: "failed" }),
    now,
  );
});
it("waits for missing receipts and applies invalid device results to the original claim", async () => {
  const f = fixture();
  f.repo.due.mockResolvedValue([]);
  const receiptJob = { ...f.job, receiptId: "synthetic-receipt" };
  f.repo.receipts.mockResolvedValue([receiptJob]);
  await f.run();
  expect(f.repo.postponeReceipt).toHaveBeenCalledWith(receiptJob, now);
  f.provider.receipts.mockResolvedValue({
    "synthetic-receipt": { status: "failed", error: "DeviceNotRegistered" },
  });
  expect((await f.run()).receipts).toBe(1);
  expect(f.repo.finish).toHaveBeenCalledWith(
    receiptJob,
    { status: "failed", error: "DeviceNotRegistered" },
    now,
  );
});
