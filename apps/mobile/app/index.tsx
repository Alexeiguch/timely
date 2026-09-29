import { Text } from "react-native";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { authClient, apiURL } from "../src/auth";
import { SignIn } from "../src/sign-in";
import { NativePlanner } from "../src/planner";
const accountKey = `timely-local-account.${apiURL.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
type Identity = { id: string; email: string };
export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const [cached, setCached] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void SecureStore.getItemAsync(accountKey).then((value) => {
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed.id === "string" && typeof parsed.email === "string")
            setCached(parsed);
        } catch {}
      }
      setReady(true);
    });
  }, []);
  useEffect(() => {
    if (session) {
      const value = { id: session.user.id, email: session.user.email };
      setCached(value);
      void SecureStore.setItemAsync(accountKey, JSON.stringify(value));
    }
  }, [session]);
  const identity = session?.user ?? cached;
  if (!ready || (isPending && !identity))
    return <Text accessibilityRole="text">Opening your day…</Text>;
  if (!identity) return <SignIn />;
  return (
    <NativePlanner
      key={identity.id}
      ownerId={identity.id}
      email={identity.email}
      onSignOut={() => {
        setCached(null);
        void SecureStore.deleteItemAsync(accountKey);
      }}
    />
  );
}
