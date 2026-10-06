import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { authClient, apiURL } from "./auth";
import { flushNotificationCleanup } from "./notifications";
type Identity = { id: string; email: string };
const accountKey = `timely-local-account.${apiURL.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
const Context = createContext<{
  identity: Identity | null;
  ready: boolean;
  clear: () => Promise<void>;
  error: string;
}>({ identity: null, ready: false, clear: async () => {}, error: "" });
export function AccountProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const [cached, setCached] = useState<Identity | null>(null);
  const [revokedSession, setRevokedSession] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void flushNotificationCleanup().catch(() => { /* A durable queue retries on the next launch. */ });
    let active = true;
    void SecureStore.getItemAsync(accountKey)
      .then((value) => {
        if (!active || !value) return;
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed.id === "string" && typeof parsed.email === "string")
            setCached(parsed);
        } catch {
          setError("Saved account could not be read. Sign in again.");
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Secure account storage is unavailable. Please unlock your device and retry.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    const timer = setTimeout(() => {
      setTimedOut(true);
      setReady(true);
    }, 10000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (!session || session.session.id === revokedSession) return;
    const value = { id: session.user.id, email: session.user.email };
    setCached(value);
    void SecureStore.setItemAsync(accountKey, JSON.stringify(value)).catch(() =>
      setError("This device could not save your offline account."),
    );
  }, [session, revokedSession]);
  return (
    <Context.Provider
      value={{
        identity: session?.session.id === revokedSession ? cached : session?.user ?? cached,
        ready: ready && (!isPending || !!cached || !!session || timedOut),
        error,
        clear: async () => {
          setCached(null);
          setRevokedSession(session?.session.id ?? null);
          await SecureStore.deleteItemAsync(accountKey);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAccount = () => useContext(Context);
