import { serve } from "inngest/next";
import { inngestRequestAllowed } from "../../../server/inngest-access";
import { inngest, reminders } from "../../../server/inngest";
export const runtime = "nodejs";
export const maxDuration = 300;
const handlers = serve({ client: inngest, functions: [reminders] });
function available(request: Request) {
  return inngestRequestAllowed(request);
}
const unavailable = () =>
  Response.json(
    { available: false },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
export const GET: typeof handlers.GET = async (...args) =>
  available(args[0]) ? handlers.GET(...args) : unavailable();
export const POST: typeof handlers.POST = async (...args) =>
  available(args[0]) ? handlers.POST(...args) : unavailable();
export const PUT: typeof handlers.PUT = async (...args) =>
  available(args[0]) ? handlers.PUT(...args) : unavailable();
