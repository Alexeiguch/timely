import { deleteAccountRequestSchema } from "@timely/contracts";
import { accountRepository } from "@timely/db/account";
import { authenticated, ApiError, readBody } from "../../../../../server/api";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return authenticated(request, async (ownerId, sessionId) => {
    deleteAccountRequestSchema.parse(await readBody(request));
    if (!(await accountRepository().delete(ownerId, sessionId)))
      throw new ApiError("REAUTHENTICATION_REQUIRED", 403, "Sign in again, then delete your account within five minutes.");
    return { deleted: true };
  });
}
