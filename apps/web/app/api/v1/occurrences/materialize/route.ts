import { authenticated, readBody } from "../../../../../server/api";
import { historyPage } from "../../../../../server/history";
export const runtime = "nodejs";
export async function POST(request: Request) {
  // Generated slots are bounded read projections. Only authored exceptions are stored;
  // repeated calls use identical immutable occurrence IDs and never write duplicate work.
  return authenticated(request, async (ownerId) => historyPage(ownerId, await readBody(request)));
}
