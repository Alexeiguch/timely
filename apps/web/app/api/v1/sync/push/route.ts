import { planner } from "@timely/db/planner";
import { pushResponseSchema } from "@timely/contracts";
import { authenticated, readBody, ApiError } from "../../../../../server/api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return authenticated(request, async (ownerId) => {
    const result = await planner().push(ownerId, await readBody(request));
    return pushResponseSchema.parse(result);
  });
}
