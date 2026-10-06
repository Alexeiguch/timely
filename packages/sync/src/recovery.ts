import type { LocalStore } from "./engine";

/** Retry unchanged commands; never generate new operation IDs for uncertain sends. */
export async function retrySavedChanges(store: LocalStore) {
  await store.transaction((state) => {
    for (const pending of state.outbox) {
      delete pending.error;
      pending.retryAt = 0;
    }
  });
}

/** Confirmed discard removes dependent commands for the same definition together. */
export async function discardLocalChanges(store: LocalStore, definitionId?: string) {
  return store.transaction((state) => {
    const before = state.outbox.length;
    state.outbox = definitionId
      ? state.outbox.filter((pending) => pending.operation.definitionId !== definitionId)
      : [];
    return before - state.outbox.length;
  });
}
