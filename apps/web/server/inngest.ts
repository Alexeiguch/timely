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
  // The worker persists each delivery transition in PostgreSQL. Avoid an extra
  // metered step for the whole sweep while keeping short task alerts eligible.
  async () => runPushWorker(),
);
