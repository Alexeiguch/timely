"use client";
import { useEffect, useState } from "react";

type Providers = { google: boolean; apple: boolean };
export function useAuthProviders() {
  const [providers, setProviders] = useState<Providers>({
    google: false,
    apple: false,
  });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let active = true;
    setState("loading");
    setProviders({ google: false, apple: false });
    void fetch("/api/v1/auth/providers", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Provider availability unavailable");
        const value: unknown = await response.json();
        if (
          !value ||
          typeof value !== "object" ||
          !("google" in value) ||
          !("apple" in value) ||
          typeof value.google !== "boolean" ||
          typeof value.apple !== "boolean"
        )
          throw new Error("Invalid provider availability");
        if (active) {
          setProviders({ google: value.google, apple: value.apple });
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);
  return { providers, state, retry: () => setAttempt((value) => value + 1) };
}
