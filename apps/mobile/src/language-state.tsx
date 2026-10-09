import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  defaultLanguage,
  getLanguage,
  subscribeLanguage,
  watchLanguageStorage,
  type LanguageStorage,
} from "@timely/i18n";
export function useLanguage() {
  return useSyncExternalStore(
    subscribeLanguage,
    getLanguage,
    () => defaultLanguage,
  );
}
const Persistence = createContext({ ready: false, error: false });
export function LanguageProvider({
  storage,
  children,
}: {
  storage: LanguageStorage;
  children: ReactNode;
}) {
  const [status, setStatus] = useState({ ready: false, error: false });
  useEffect(() => watchLanguageStorage(storage, setStatus), [storage]);
  return <Persistence.Provider value={status}>{children}</Persistence.Provider>;
}
export const useLanguagePersistence = () => useContext(Persistence);
export type { LanguageStorage } from "@timely/i18n";
