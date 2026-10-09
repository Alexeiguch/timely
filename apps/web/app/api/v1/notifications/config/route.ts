import { pushConfiguration } from "../../../../../server/expo-push";
export const runtime = "nodejs";
export function GET() {
  return Response.json(pushConfiguration(), {
    headers: { "Cache-Control": "no-store" },
  });
}
