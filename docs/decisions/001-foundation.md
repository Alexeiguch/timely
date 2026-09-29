# 001 — Retained auth proof and workspace foundation

The initial workspace contained only `initial.md` and `planner-agent-pack/`, with no Git repository or application. Original files are preserved; canonical copies now live under `docs/planner/`.

Use self-hosted Better Auth 1.7.6 with the same-version Expo plugin, mounted in Next.js 16.3.7; Drizzle 0.45.3 and postgres.js 3.4.9 provide real transactions with Neon. No managed Neon Auth or custom token verifier. Automatic email-based provider linking is disabled; explicit authenticated linking remains available.

Native uses Expo 55.0.31, React 19.2.0, RN 0.83.10 and native modules from that Expo tarball's bundledNativeModules.json. This matches the SDK documented by Better Auth's Expo guide. Web uses patched React 19.2.8, separate from the native peer graph. TypeScript 5.9.3 stays within established tool compatibility. Fonts come from licensed Fontsource packages, not runtime Google requests.

Email sends through Resend, with a development-only loopback Mailpit adapter. It never prints OTPs. Docker Compose supplies disposable PostgreSQL and Mailpit; Neon/provider verification still requires real credentials. Database and auth modules have explicit server entry points plus an import-boundary check.

Official docs inspected: https://better-auth.com/docs/integrations/expo, https://better-auth.com/docs/integrations/next, https://better-auth.com/docs/adapters/drizzle, https://better-auth.com/docs/authentication/apple, https://better-auth.com/docs/authentication/google, https://better-auth.com/docs/plugins/email-otp, https://docs.expo.dev/versions/v55.0.0/sdk/apple-authentication/.

Production build uses Next's supported webpack option after the sandboxed Turbopack build stalled. The webpack build passes. Better Auth's utils peer is explicitly pinned to 0.4.2, matching the installed 1.7.6 manifests. Native fonts use individual bundled weights with copied OFL licenses.
