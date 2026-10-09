# 001 — Retained auth proof and workspace foundation

Superseded details: native SDK versions below describe the original foundation. Current native peers are Expo SDK 57, recorded in [ADR 007](007-expo-xcode-compatibility.md) and [ADR 011](011-supported-native-peers.md). On 2026-10-08 the owner asked for stale documents to be removed. `initial.md` and `planner-agent-pack/` had diverged from the canonical contracts (streaks, Spanish default, mobile creation and sign-in) and were deleted. `docs/planner/` is the only product contract.

The initial workspace contained only `initial.md` and `planner-agent-pack/`, with no Git repository or application. Those originals were copied to `docs/planner/` and later removed after they stopped matching the maintained contracts.

Use self-hosted Better Auth 1.7.6 with the same-version Expo plugin, mounted in Next.js 16.3.7; Drizzle 0.45.3 and postgres.js 3.4.9 provide real transactions with Neon. No managed Neon Auth or custom token verifier. Automatic email-based provider linking is disabled; explicit authenticated linking remains available.

Native uses Expo 55.0.31, React 19.2.0, RN 0.83.10 and native modules from that Expo tarball's bundledNativeModules.json. This matches the SDK documented by Better Auth's Expo guide. Web uses patched React 19.2.8, separate from the native peer graph. TypeScript 5.9.3 stays within established tool compatibility. Fonts come from licensed Fontsource packages, not runtime Google requests.

Email sends through Resend, with a development-only loopback Mailpit adapter. It never prints OTPs. Docker Compose supplies disposable PostgreSQL and Mailpit; Neon/provider verification still requires real credentials. Database and auth modules have explicit server entry points plus an import-boundary check.

Official docs inspected: https://better-auth.com/docs/integrations/expo, https://better-auth.com/docs/integrations/next, https://better-auth.com/docs/adapters/drizzle, https://better-auth.com/docs/authentication/apple, https://better-auth.com/docs/authentication/google, https://better-auth.com/docs/plugins/email-otp, https://docs.expo.dev/versions/v55.0.0/sdk/apple-authentication/.

Production build uses Next's supported webpack option after the sandboxed Turbopack build stalled. The webpack build passes. Better Auth's utils peer is explicitly pinned to 0.4.2, matching the installed 1.7.6 manifests. Native fonts use individual bundled weights with copied OFL licenses.
