import { notificationRepository } from "@timely/db/notifications";
import { notificationDeviceRequestSchema } from "@timely/contracts";
import { ApiError, authenticated, readBody } from "./api";
import { pushConfiguration } from "./expo-push";
export async function notificationRequest(
  request: Request,
  action: "prepare" | "coverage" | "test" | "status",
) {
  return authenticated(request, async (ownerId) => {
    const config = pushConfiguration();
    if (!config.enabled || !config.projectId)
      throw new ApiError(
        "PUSH_UNAVAILABLE",
        503,
        "Remote reminders are not configured yet.",
      );
    const input = await readBody(request);
    const repository = notificationRepository();
    if (action === "prepare")
      return repository.prepare(
        ownerId,
        input,
        config.projectId,
        new URL(process.env.BETTER_AUTH_URL!).origin,
      );
    if (action === "coverage") return repository.commit(ownerId, input);
    const { deviceId } = notificationDeviceRequestSchema.parse(input);
    return action === "test"
      ? repository.test(ownerId, deviceId)
      : repository.status(ownerId, deviceId);
  });
}
