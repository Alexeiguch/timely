import { randomUUID } from "node:crypto";
import { ServerDiagnostics } from "./diagnostics";
import { notificationRepository } from "@timely/db/notifications";
import { reminderBody } from "@timely/sync";
import { DailySummary } from "@timely/domain";
import { translate, parseLanguage } from "@timely/i18n";
import { expoPush, pushConfiguration } from "./expo-push";
export async function runPushWorker(
  repository = notificationRepository(),
  provider = expoPush(),
  now = Date.now(),
) {
  if (!pushConfiguration().enabled)
    return { enabled: false, reconciled: 0, sent: 0, receipts: 0 };
  const runId = randomUUID();
  try {
    await repository.recover(now);
    const owners = await repository.owners(now);
    let reconciled = 0,
      failedOwners = 0,
      failedJobs = 0;
    for (const [index, ownerId] of owners.entries()) {
      try {
        await repository.reconcile(ownerId, now);
        reconciled++;
      } catch (error) {
        failedOwners++;
        ServerDiagnostics.failure("push_reconciliation_failure", error, {
          runId,
          ownerIndex: String(index),
        });
        try {
          await repository.reconciliationFailed(ownerId, now);
        } catch (retryError) {
          ServerDiagnostics.failure("push_retry_schedule_failure", retryError, {
            runId,
            ownerIndex: String(index),
          });
        }
      }
    }
    let sent = 0,
      receipts = 0,
      dispatches = 0;
    for (const job of await repository.due(now)) {
      if (dispatches >= 20) break;
      let dispatched = false;
      try {
        const claimed = await repository.claim(job, now);
        if (!claimed?.push.token) continue;
        dispatches++;
        const language = parseLanguage(claimed.push.language);
        const summary = job.kind === "summary";
        if (
          summary &&
          (!Number.isSafeInteger(claimed.summaryCount) ||
            (claimed.summaryCount ?? 0) < 1)
        )
          throw new Error("InvalidSummaryCount");
        const body = summary
          ? DailySummary.message(claimed.summaryCount ?? 0)
          : claimed.item
            ? reminderBody(claimed.item, job.kind as "before" | "overdue")
            : { message: "Your remote notification test arrived." };
        dispatched = true;
        const result = await provider.send({
          to: claimed.push.token,
          title:
            (summary
              ? translate("Timely · Your daily summary", {}, language)
              : claimed.item?.title) ??
            translate("Timely · Push notification test", {}, language),
          body: translate(body.message, body.parameters, language),
          expiration: Math.floor(job.expires / 1000),
          collapseId: job.key,
          silent: summary,
          data: {
            environment: claimed.push.environment,
            ownerId: job.ownerId,
            occurrenceId: job.occurrenceId,
            day: job.day,
            kind: job.kind,
            version: job.version,
            key: job.key,
            ...(summary ? { summaryCount: claimed.summaryCount } : {}),
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
      } catch (error) {
        failedJobs++;
        ServerDiagnostics.failure("push_dispatch_failure", error, { runId });
        // A thrown send may already have reached the provider. Never replay it.
        if (dispatched) {
          try {
            await repository.finish(
              job,
              { status: "uncertain", error: "DispatchInterrupted" },
              now,
            );
          } catch (finishError) {
            ServerDiagnostics.failure("push_finish_failure", finishError, {
              runId,
            });
          }
        }
      }
    }
    const waiting = await repository.receipts(now);
    const results = await provider.receipts(
      waiting.flatMap((job) => (job.receiptId ? [job.receiptId] : [])),
    );
    for (const job of waiting) {
      try {
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
      } catch (error) {
        failedJobs++;
        ServerDiagnostics.failure("push_receipt_failure", error, { runId });
      }
    }
    return {
      enabled: true,
      reconciled,
      failedOwners,
      failedJobs,
      sent,
      receipts,
    };
  } catch (error) {
    ServerDiagnostics.failure("push_worker_failure", error, { runId });
    throw error;
  }
}
