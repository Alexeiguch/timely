"use client";
import { useEffect, useState } from "react";
import { authClient } from "@timely/auth/client";
import { useAuthProviders } from "../lib/use-auth-providers";
export function SignIn() {
  const {
    providers,
    state: providerState,
    retry: retryProviders,
  } = useAuthProviders();
  const unavailable = [
    !providers.google && "Google",
    !providers.apple && "Apple",
  ]
    .filter(Boolean)
    .join(" and ");
  const providerMessage =
    providerState === "loading"
      ? "Checking sign-in options…"
      : providerState === "error"
        ? "Social sign-in is unavailable right now. Try again, or use your email."
        : unavailable
          ? `${unavailable} sign-in is not available here yet. Use your email to sign in.`
          : "";
  async function social(provider: "google" | "apple") {
    if (!providers[provider]) return;
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "/",
    });
    if (error) {
      if (error.code === "PROVIDER_NOT_FOUND") {
        retryProviders();
        throw new Error(
          "This sign-in method is unavailable. Please use your email.",
        );
      }
      throw new Error(error.message);
    }
  }
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sign-in unavailable. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (error) throw new Error(error.message);
    setSent(true);
    setCooldown(60);
    setMessage("Check your inbox. Your code expires in 5 minutes.");
  }
  return (
    <main className="signin">
      <div className="brand">
        timely<span>✳</span>
      </div>
      <section className="welcome">
        <span className="eyebrow">MAKE ROOM FOR YOUR DAY</span>
        <h1>
          A little space for
          <br />
          what matters.
        </h1>
        <p>Your plans, at your pace. Pick up where you left off.</p>
        <div className="doodle" aria-hidden="true">
          ✳
        </div>
      </section>
      <section className="signin-card">
        <h2>Welcome to your day</h2>
        <p>Sign in to keep your plans together.</p>
        <button
          disabled={busy || !providers.google}
          aria-describedby={providerMessage ? "social-availability" : undefined}
          onClick={() => void run(() => social("google"))}
        >
          Continue with Google
        </button>
        <button
          disabled={busy || !providers.apple}
          aria-describedby={providerMessage ? "social-availability" : undefined}
          onClick={() => void run(() => social("apple"))}
        >
          Continue with Apple
        </button>
        {providerMessage && (
          <p
            id="social-availability"
            className="provider-availability"
            aria-live="polite"
          >
            {providerMessage}
          </p>
        )}
        {providerState === "error" && (
          <button disabled={busy} onClick={retryProviders}>
            Retry sign-in options
          </button>
        )}
        <div className="divider">or use your email</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              sent
                ? async () => {
                    const { error } = await authClient.signIn.emailOtp({
                      email,
                      otp,
                    });
                    if (error) throw new Error(error.message);
                  }
                : send,
            );
          }}
        >
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={sent}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {sent && (
            <label>
              Six-digit code
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </label>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Just a moment…" : sent ? "Sign in" : "Send me a code"}
          </button>
        </form>
        {sent && (
          <div className="row">
            <button disabled={busy || cooldown > 0} onClick={() => run(send)}>
              {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
            <button
              onClick={() => {
                setSent(false);
                setOtp("");
              }}
            >
              Change email
            </button>
          </div>
        )}
        <p role="status">{message}</p>
        <small>No password to remember. Just you and your plans.</small>
      </section>
    </main>
  );
}
