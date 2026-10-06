import { deletedAccountSchema, removedDeviceSchema } from "@timely/contracts";
import { SyncError } from "./engine";

/** Account operations use the same owner guard as sync; the server derives authority from the session. */
export function accountActions(fetcher: (path: string, init?: RequestInit) => Promise<Response>, ownerId: string) {
  async function request(path: string, method: string, body: unknown) {
    const response = await fetcher(`/api/v1/${path}`, {
      method, headers: { "Content-Type": "application/json", "X-Timely-Account": ownerId },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) throw new SyncError(response.status, result.code, result.message ?? "Unable to update your account.");
    return result;
  }
  return {
    async unregister(deviceId: string) {
      return removedDeviceSchema.parse(await request("devices/current", "DELETE", { deviceId }));
    },
    async delete() {
      return deletedAccountSchema.parse(await request("account/delete", "POST", { confirmation: "DELETE" }));
    },
  };
}
