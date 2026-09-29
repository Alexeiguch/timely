import { planner } from "@timely/db/planner";
import { authenticated, readBody } from "../../../../../server/api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return authenticated(request, async (ownerId) =>
    planner().register(ownerId, await readBody(request)),
  );
}
