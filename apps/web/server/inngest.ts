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
    triggers: [{ cron: "* * * * *" }],
    concurrency: 1,
    retries: 2,
  },
  async ({ step }) =>
    step.run("reconcile-dispatch-receipts", () => runPushWorker()),
);
