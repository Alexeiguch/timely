import { z } from "zod";
import { id } from "./model";
export const removeDeviceRequestSchema = z.object({ deviceId: id }).strict();
export const deleteAccountRequestSchema = z.object({ confirmation: z.literal("DELETE") }).strict();
export const removedDeviceSchema = z.object({ removed: z.literal(true) }).strict();
export const deletedAccountSchema = z.object({ deleted: z.literal(true) }).strict();
