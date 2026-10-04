"use client";
import { useEffect, useRef, useState } from "react";
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
  const [shown, setShown] = useState("");
  const [sent, setSent] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back" | "none">(
    "none",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [codeFocus, setCodeFocus] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (!sent) return;
    codeRef.current?.focus();
  }, [sent]);
  useEffect(() => {
    if (otp === shown) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const jump = otp.length - shown.length;
    if (reduce || jump <= 1 || !otp.startsWith(shown)) {
      setShown(otp);
      return;
    }
    const timer = window.setTimeout(
      () => setShown(otp.slice(0, shown.length + 1)),
      90,
    );
    return () => window.clearTimeout(timer);
  }, [otp, shown]);
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
  async function send(resend = false) {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (error) throw new Error(error.message);
    setDirection("forward");
    setSent(true);
    setCooldown(60);
    setOtp("");
    setMessage(resend ? "A new code is on its way." : "");
  }
  return (
    <main className="signin">
      <div className="brand">
        timely<span>✳</span>
      </div>
      <div
        className={`signin-step${direction === "none" ? "" : direction === "forward" ? " is-forward" : " is-back"}`}
        key={sent ? "code" : "email"}
      >
        {sent ? (
          <>
            <section className="welcome">
              <span className="eyebrow">CHECK YOUR INBOX</span>
              <h1>Enter your code.</h1>
              <p>We sent six digits to {email}. They expire in 5 minutes.</p>
              <div className="doodle" aria-hidden="true">
                ✳
              </div>
            </section>
            <section className="signin-card">
              <h2>One code, then you’re in</h2>
              <p>
                We sent six digits to {email}. They expire in 5 minutes. Type
                them here, or accept the code suggested from your email.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const { error } = await authClient.signIn.emailOtp({
                      email,
                      otp,
                    });
                    if (error) throw new Error(error.message);
                  });
                }}
              >
                <label htmlFor="email-code">Six-digit code</label>
                <div className="otp-field">
                  <div className="otp-cells" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, index) => {
                      const char = shown[index] ?? "";
                      const active =
                        codeFocus && index === Math.min(otp.length, 5);
                      return (
                        <span
                          key={index}
                          className={`otp-cell${char ? " is-filled" : ""}${active ? " is-active" : ""}`}
                        >
                          {char ? (
                            <span
                              className="otp-char"
                              key={`${index}-${char}`}
                            >
                              {char}
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                  <input
                    id="email-code"
                    ref={codeRef}
                    className="otp-capture"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    name="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoCapitalize="off"
                    spellCheck={false}
                    value={otp}
                    aria-describedby="email-code-hint"
                    onFocus={() => setCodeFocus(true)}
                    onBlur={() => setCodeFocus(false)}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </div>
                <p id="email-code-hint" className="otp-hint">
                  One number in each box.
                </p>
                <button className="primary" disabled={busy || otp.length !== 6}>
                  {busy ? "Just a moment…" : "Sign in"}
                </button>
              </form>
              <div className="row">
                <button
                  disabled={busy || cooldown > 0}
                  onClick={() => void run(() => send(true))}
                >
                  {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
                <button
                  onClick={() => {
                    setDirection("back");
                    setSent(false);
                    setOtp("");
                    setMessage("");
                  }}
                >
                  Change email
                </button>
              </div>
              <p role="status">{message}</p>
              <small>No password to remember. Just you and your plans.</small>
            </section>
          </>
        ) : (
          <>
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
          className="social-signin"
          disabled={busy || !providers.google}
          aria-describedby={providerMessage ? "social-availability" : undefined}
          onClick={() => void run(() => social("google"))}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
            <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
          </svg>
          Continue with Google
        </button>
        <button
          className="social-signin"
          disabled={busy || !providers.apple}
          aria-describedby={providerMessage ? "social-availability" : undefined}
          onClick={() => void run(() => social("apple"))}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M17.05 12.54c.03 3.23 2.83 4.3 2.86 4.31-.02.08-.45 1.53-1.48 3.03-.89 1.3-1.81 2.6-3.27 2.63-1.43.03-1.89-.85-3.52-.85s-2.14.82-3.49.88c-1.4.05-2.46-1.41-3.36-2.7-1.83-2.65-3.23-7.5-1.35-10.77a5.21 5.21 0 0 1 4.42-2.68c1.38-.03 2.69.94 3.52.94.84 0 2.4-1.16 4.05-.99.69.03 2.63.28 3.87 2.1-.1.06-2.31 1.35-2.25 4.1ZM14.37 4.6c.75-.91 1.26-2.18 1.12-3.45-1.08.04-2.39.72-3.17 1.63-.7.8-1.31 2.08-1.15 3.3 1.2.09 2.43-.61 3.2-1.48Z" />
          </svg>
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
            void run(send);
          }}
        >
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Just a moment…" : "Send me a code"}
          </button>
        </form>
        <p role="status">{message}</p>
        <small>No password to remember. Just you and your plans.</small>
              </section>
            </>
          )}
        </div>
    </main>
  );
}
