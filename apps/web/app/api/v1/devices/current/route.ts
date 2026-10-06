import { removeDeviceRequestSchema } from "@timely/contracts";
import { accountRepository } from "@timely/db/account";
import { authenticated, readBody } from "../../../../../server/api";
export const runtime = "nodejs";
export async function DELETE(request: Request) {
  return authenticated(request, async (ownerId) => {
    const input = removeDeviceRequestSchema.parse(await readBody(request));
    return accountRepository().unregister(ownerId, input.deviceId);
  });
}
