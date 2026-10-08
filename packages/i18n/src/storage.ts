import {
  getLanguage,
  parseLanguage,
  setLanguage,
  subscribeLanguage,
  type Language,
} from "./core";
export type LanguageStorage = {
  read: () => string | null | Promise<string | null>;
  write: (language: Language) => void | Promise<void>;
  listen?: (changed: (value: string | null) => void) => () => void;
};
/** Resolve storage after mount, preserving a choice made while loading. Serialize writes. */
export function watchLanguageStorage(
  storage: LanguageStorage,
  status: (value: { ready: boolean; error: boolean }) => void,
) {
  let disposed = false,
    changedDuringLoad = false,
    loaded = false;
  let writes = Promise.resolve();
  const save = (chosen: Language) => {
    writes = writes.then(async () => {
      try {
        await storage.write(chosen);
        if (!disposed) status({ ready: true, error: false });
      } catch {
        if (!disposed) status({ ready: true, error: true });
      }
    });
  };
  const unsubscribe = subscribeLanguage(() => {
    if (!loaded) {
      changedDuringLoad = true;
      return;
    }
    save(getLanguage());
  });
  void Promise.resolve()
    .then(() => storage.read())
    .then((stored) => {
      if (!disposed && !changedDuringLoad) setLanguage(parseLanguage(stored));
      if (!disposed) status({ ready: true, error: false });
    })
    .catch(() => {
      if (!disposed) status({ ready: true, error: true });
    })
    .finally(() => {
      loaded = true;
      if (!disposed && changedDuringLoad) save(getLanguage());
    });
  const stopListening = storage.listen?.((value) => {
    if (!disposed) setLanguage(parseLanguage(value));
  });
  return () => {
    disposed = true;
    unsubscribe();
    stopListening?.();
  };
}
