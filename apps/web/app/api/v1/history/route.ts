import { authenticated, ApiError } from "../../../../server/api";
import { historyPage } from "../../../../server/history";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return authenticated(request, async (ownerId) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    let cursor: unknown;
    try { cursor = params.cursor ? JSON.parse(params.cursor) : undefined; }
    catch { throw new ApiError("INVALID_COMMAND", 400, "Use a valid history cursor."); }
    return historyPage(ownerId, { ...params, ...(params.limit ? { limit: Number(params.limit) } : {}), ...(cursor ? { cursor } : {}) });
  });
}
