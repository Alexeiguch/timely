import { notificationRequest } from "../../../../../server/notification-api";
export const runtime = "nodejs";
export function POST(request: Request) {
  return notificationRequest(request, "status");
}
