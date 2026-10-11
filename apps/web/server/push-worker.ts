import { notificationRepository } from "@timely/db/notifications";
import { reminderBody } from "@timely/sync";
import { translate, parseLanguage } from "@timely/i18n";
import { expoPush, pushConfiguration } from "./expo-push";
export async function runPushWorker(
  repository = notificationRepository(),
  provider = expoPush(),
  now = Date.now(),
) {
  if (!pushConfiguration().enabled)
    return { enabled: false, reconciled: 0, sent: 0, receipts: 0 };
  await repository.recover(now);
  const owners = await repository.owners(now);
  for (const ownerId of owners) await repository.reconcile(ownerId, now);
  let sent = 0,
    receipts = 0,
    dispatches = 0;
  for (const job of await repository.due(now)) {
    if (dispatches >= 20) break;
    const claimed = await repository.claim(job, now);
    if (!claimed?.push.token) continue;
    dispatches++;
    const language = parseLanguage(claimed.push.language);
    const body = claimed.item
      ? reminderBody(claimed.item, job.kind as "before" | "overdue")
      : { message: "Your remote notification test arrived." };
    const result = await provider.send({
      to: claimed.push.token,
      title:
        claimed.item?.title ??
        translate("Timely · Push notification test", {}, language),
      body: translate(body.message, body.parameters, language),
      expiration: Math.floor(job.expires / 1000),
      collapseId: job.key,
      data: {
        environment: claimed.push.environment,
        ownerId: job.ownerId,
        occurrenceId: job.occurrenceId,
        day: job.day,
        kind: job.kind,
        version: job.version,
        key: job.key,
      },
    });
    const retry =
      result.status === "retry" &&
      job.attempts < 4 &&
      now + 30000 < job.expires;
    await repository.finish(
      job,
      {
        ...result,
        status: retry
          ? "pending"
          : result.status === "retry"
            ? "failed"
            : result.status,
        ...(retry
          ? {
              nextAttempt:
                now + Math.min(60000, 1000 * 2 ** (job.attempts + 1)),
            }
          : {}),
      },
      now,
    );
    if (result.status === "ticket") sent++;
  }
  const waiting = await repository.receipts(now);
  const results = await provider.receipts(
    waiting.flatMap((job) => (job.receiptId ? [job.receiptId] : [])),
  );
  for (const job of waiting) {
    const result = job.receiptId ? results[job.receiptId] : undefined;
    if (result) {
      await repository.finish(
        job,
        {
          ...result,
          status: result.status === "retry" ? "failed" : result.status,
        },
        now,
      );
      receipts++;
    } else await repository.postponeReceipt(job, now);
  }
  return { enabled: true, reconciled: owners.length, sent, receipts };
}
