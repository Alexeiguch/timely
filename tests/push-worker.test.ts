import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runPushWorker } from "../apps/web/server/push-worker";
import { notificationRepository } from "../packages/db/src/notifications";
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
    reconciliationFailed: vi.fn().mockResolvedValue(undefined),
    reconcile: vi.fn().mockResolvedValue(undefined),
    due: vi.fn().mockResolvedValue([job]),
    claim: vi.fn().mockResolvedValue({
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
it("sends one quiet localized summary with counts and no authored content", async () => {
  const f = fixture();
  f.job.kind = "summary";
  f.repo.claim.mockImplementation(async () => ({
    job: f.job,
    item: null,
    summaryCount: 3,
    push: {
      token: "ExpoPushToken[synthetic-worker]",
      language: "es",
      environment: "https://staging.example.test",
    },
  }));
  await f.run();
  expect(f.provider.send).toHaveBeenCalledTimes(1);
  expect(f.provider.send).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "Timely · Tu resumen diario",
      body: "Te quedan 3 planes de hoy. Elige un pequeño paso.",
      silent: true,
      data: expect.objectContaining({ kind: "summary", summaryCount: 3 }),
    }),
  );
});
it("rechecks canonical claims before sending and does not leak content in worker results", async () => {
  const f = fixture();
  f.repo.claim.mockResolvedValue(null);
  expect(await f.run()).toEqual({
    enabled: true,
    reconciled: 1,
    failedOwners: 0,
    failedJobs: 0,
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
    failedOwners: 0,
    failedJobs: 0,
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

it("does not spend the dispatch budget on jobs paused between selection and claim", async () => {
  const f = fixture();
  f.repo.due.mockResolvedValue(
    Array.from({ length: 21 }, () => ({ ...f.job, key: randomUUID() })),
  );
  for (let index = 0; index < 20; index++)
    f.repo.claim.mockResolvedValueOnce(null);
  expect((await f.run()).sent).toBe(1);
  expect(f.repo.claim).toHaveBeenCalledTimes(21);
  expect(f.provider.send).toHaveBeenCalledTimes(1);
});
it("keeps the provider dispatch limit at twenty successful claims", async () => {
  const f = fixture();
  f.repo.due.mockResolvedValue(
    Array.from({ length: 21 }, () => ({ ...f.job, key: randomUUID() })),
  );
  expect((await f.run()).sent).toBe(20);
  expect(f.repo.claim).toHaveBeenCalledTimes(20);
  expect(f.provider.send).toHaveBeenCalledTimes(20);
});

it("isolates a corrupt owner, persists its retry and still dispatches and checks receipts", async () => {
  const f = fixture();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const bad = randomUUID();
  f.repo.owners.mockResolvedValue([bad, f.job.ownerId]);
  f.repo.reconcile.mockRejectedValueOnce(new Error("private task content"));
  const result = await f.run();
  expect(result).toMatchObject({ reconciled: 1, failedOwners: 1, sent: 1 });
  expect(f.repo.reconciliationFailed).toHaveBeenCalledWith(bad, now);
  expect(f.provider.receipts).toHaveBeenCalled();
  expect(JSON.stringify(log.mock.calls)).not.toMatch(
    new RegExp(`private task content|${bad}`),
  );
  log.mockRestore();
});
it("does not let a job claim failure block another job", async () => {
  const f = fixture();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  f.repo.due.mockResolvedValue([f.job, { ...f.job, key: randomUUID() }]);
  f.repo.claim.mockRejectedValueOnce(new Error("bad owner"));
  expect(await f.run()).toMatchObject({ sent: 1, failedJobs: 1 });
  log.mockRestore();
});
it("marks thrown sends uncertain without stopping the remaining jobs", async () => {
  const f = fixture();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  f.repo.due.mockResolvedValue([f.job, { ...f.job, key: randomUUID() }]);
  f.provider.send.mockRejectedValueOnce(new Error("response lost"));
  expect(await f.run()).toMatchObject({ sent: 1, failedJobs: 1 });
  expect(f.repo.finish).toHaveBeenCalledWith(
    f.job,
    { status: "uncertain", error: "DispatchInterrupted" },
    now,
  );
  log.mockRestore();
});
it("continues owner work even if persisting a failure retry fails", async () => {
  const f = fixture();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  f.repo.owners.mockResolvedValue([randomUUID(), f.job.ownerId]);
  f.repo.reconcile.mockRejectedValueOnce(new Error("bad record"));
  f.repo.reconciliationFailed.mockRejectedValueOnce(new Error("DB outage"));
  expect(await f.run()).toMatchObject({
    sent: 1,
    reconciled: 1,
    failedOwners: 1,
  });
  log.mockRestore();
});

it("continues receipt processing after one owner transaction fails", async () => {
  const f = fixture();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  f.repo.due.mockResolvedValue([]);
  const first = { ...f.job, receiptId: "first-receipt" };
  const second = { ...f.job, key: randomUUID(), receiptId: "second-receipt" };
  f.repo.receipts.mockResolvedValue([first, second]);
  f.provider.receipts.mockResolvedValue({
    "first-receipt": { status: "delivered" },
    "second-receipt": { status: "delivered" },
  });
  f.repo.finish.mockRejectedValueOnce(new Error("bad stored record"));
  expect(await f.run()).toMatchObject({ receipts: 1, failedJobs: 1 });
  expect(f.repo.finish).toHaveBeenCalledTimes(2);
  log.mockRestore();
});
