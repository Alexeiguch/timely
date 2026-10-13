import { Inngest } from "inngest";
import { inngestDevMode } from "./inngest-access";
import { runPushWorker } from "./push-worker";
export const inngest = new Inngest({
  id: "timely-reminders",
  isDev: inngestDevMode(),
});
export const reminders = inngest.createFunction(
  {
    id: "reminder-sweep",
    // One run plus one step every three minutes fits the free execution quota.
    triggers: [{ cron: "*/3 * * * *" }],
    concurrency: 1,
    retries: 2,
  },
  async ({ step }) =>
    step.run("reconcile-dispatch-receipts", () => runPushWorker()),
);
