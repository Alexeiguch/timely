import { planner } from "@timely/db/planner";
import { bootstrapResponseSchema } from "@timely/contracts";
import { authenticated, readBody, ApiError } from "../../../../../server/api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return authenticated(request, async (ownerId) => {
    const result = await planner().bootstrap(ownerId, await readBody(request));
    if ("expired" in result)
      throw new ApiError(
        "CURSOR_EXPIRED",
        410,
        "Restart the snapshot; keep pending local changes.",
      );
    return bootstrapResponseSchema.parse(result);
  });
}
