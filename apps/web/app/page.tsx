"use client";
import { t, locale } from "@timely/i18n";
import { useLanguage } from "../components/language-state";

import { useEffect, useState } from "react";
import { authClient } from "@timely/auth/client";
import { SignIn } from "../components/sign-in";
import { Planner } from "../components/planner";
type Identity = {
  id: string;
  email: string;
  name: string;
};
const cacheKey = "timely-local-account";
export default function Home() {
  useLanguage();
  const { data: session, isPending } = authClient.useSession();
  const [cached, setCached] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  useEffect(() => {
    const restore = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
        setCached(
          raw &&
            typeof raw.id === "string" &&
            typeof raw.email === "string" &&
            typeof raw.name === "string"
            ? raw
            : null,
        );
      } catch {
        setCached(null);
      }
      setReady(true);
    };
    restore();
    window.addEventListener("storage", restore);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js")
        .then(async () => {
          const registration = await navigator.serviceWorker.ready;
          registration.active?.postMessage({
            type: "CACHE_PUBLIC_ASSETS",
            urls: performance
              .getEntriesByType("resource")
              .map((entry) => entry.name),
          });
        })
        .catch(() => {
          /* Planner remains available; offline reload requires successful shell caching. */
        });
    }
    return () => window.removeEventListener("storage", restore);
  }, []);
  useEffect(() => {
    if (!session) return;
    const identity = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
    localStorage.setItem(cacheKey, JSON.stringify(identity));
    setCached(identity);
    setSigningIn(false);
  }, [session]);
  const identity = session?.user ?? cached;
  if (!ready || (isPending && !identity))
    return (
      <main className="signin">
        <p role="status">{t("Opening your day\u2026")}</p>
      </main>
    );
  if (!identity || signingIn)
    return (
      <>
        <SignIn />
        {identity && (
          <button
            className="return-planner"
            onClick={() => setSigningIn(false)}
          >
            {t("Back to saved plans")}
          </button>
        )}
      </>
    );
  return (
    <Planner
      key={identity.id}
      identity={identity}
      needsSignIn={!session}
      onSignIn={() => setSigningIn(true)}
      onSignOut={() => {
        localStorage.removeItem(cacheKey);
        setCached(null);
        window.dispatchEvent(new Event("storage"));
      }}
    />
  );
}
