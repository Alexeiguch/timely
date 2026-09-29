import { planner } from "@timely/db/planner";
import { pullResponseSchema } from "@timely/contracts";
import { authenticated, ApiError } from "../../../../../server/api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return authenticated(request, async (ownerId) => {
    const value = new URL(request.url).searchParams.get("cursor");
    if (value === null || !/^\d+$/.test(value))
      throw new ApiError(
        "INVALID_COMMAND",
        400,
        "Supply a nonnegative cursor.",
      );
    return pullResponseSchema.parse(
      await planner().pull(ownerId, Number(value)),
    );
  });
}
