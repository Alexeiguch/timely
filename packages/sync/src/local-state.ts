import { localStateSchema } from "@timely/contracts";
import type { LocalState } from "./engine";
export function readLocalState(value: unknown, ownerId: string): LocalState {
  const state = localStateSchema.parse(value);
  if (state.ownerId !== ownerId) throw new Error("Local plans belong to a different account.");
  return state;
}
