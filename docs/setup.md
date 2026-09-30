# Timely development setup

## Current implementation

The repository contains real web email authentication, a local-first web planner, shared recurrence/time/sync modules, Neon development persistence and a substantial native planner implementation. Native runtime acceptance and several later-stage features remain incomplete. See [progress](progress.md) for exact implementation and verification gates.

Prerequisites: Node 22.13+ (tested on 24.19.0), pnpm 10.7.0, Docker Desktop for local PostgreSQL/Mailpit, Xcode for iOS and Android Studio for Android. Native social sign-in requires a development build, not Expo Go.

```sh
pnpm install --frozen-lockfile
docker compose up -d
cp apps/web/.env.example apps/web/.env.local
# Replace BETTER_AUTH_SECRET with a random secret; never commit .env.local.
DATABASE_URL=postgres://timely:timely@127.0.0.1:5432/timely pnpm db:migrate
pnpm dev
```

The local mail inbox is http://localhost:8025 and the web proof is http://localhost:3000. Enter a synthetic `@example.test` email, retrieve its code from Mailpit, and sign in. Local email never leaves Mailpit. Production refuses the capture transport.

```sh
node scripts/auth-smoke.mjs
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

`auth-smoke.mjs` uses local-only services and synthetic accounts. It checks actual SMTP delivery, invalid/consumed code rejection, cookie restoration, protected access and revocation. It never prints tokens or codes. Generated auth tables live in the app-managed `timely_auth` PostgreSQL schema; they do not modify `neon_auth`.

To regenerate auth schema after an intentional auth/plugin change:

```sh
pnpm exec auth generate --config packages/auth/generate.config.ts --output packages/db/src/auth-schema.ts --yes
pnpm db:generate
```

Review generated migrations before applying. The generator has an isolated non-runtime schema-only configuration; production auth still requires real environment configuration.

## Neon

Use a disposable development branch for planner migrations. Set `DATABASE_URL` to its pooled URL and `DATABASE_MIGRATION_URL` to its direct URL. Neither is public. Do not run development seeds against production.

The owner separately requested a Neon deployment to project `fragrant-bonus-17540843`, branch `production`, using the root `neon.ts` and `hello.ts`. This provisions managed Neon Auth, a private uploads bucket, and a hello-world Function. It does not switch the planner away from self-hosted Better Auth. Current deployment state is in [progress](progress.md).

CLI installation uses `/Users/alexei/.local/bin/neon` because `/usr/local/lib/node_modules` was not writable. Add `$HOME/.local/bin` to PATH in your shell if needed. No shell profile has been modified automatically.

## Google

1. In the intended Google Cloud project, configure the OAuth consent screen and development test users.
2. Create a web OAuth client. Register `https://BACKEND_HOST/api/auth/callback/google`. For local testing, add both `http://localhost:3000/api/auth/callback/google` (development server) and `http://localhost:3001/api/auth/callback/google` (built review server) as authorized redirect URIs. Keep any existing Neon callback; it does not replace these self-hosted Better Auth callbacks. Put its ID in `GOOGLE_WEB_CLIENT_ID` and its secret in server-only `GOOGLE_CLIENT_SECRET`.
3. Create an iOS client matching the actual bundle identifier. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_URL_SCHEME` to its reversed client ID.
4. Create an Android client matching the actual package identifier and development signing SHA-1; register release signing separately.
5. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the web client ID so native Google returns an ID token for the server's configured audience. Do not put the client secret in mobile env.
6. Build and test both native clients, including cancellation and denied consent.

## Apple

1. Use an active Apple Developer team. Register the actual App ID with Sign in with Apple. `com.example.timely.*` values are documented placeholders, not registered IDs.
2. Create a distinct Service ID for web/Android, associate the native App ID, and register a real HTTPS callback domain and `https://BACKEND_HOST/api/auth/callback/apple`. Apple browser sign-in cannot use localhost.
3. Generate the Sign in with Apple key. Keep its `.p8` private key, team ID and key ID server-side or in a secure signing workflow.
4. Generate an ES256 client-secret JWT with issuer=team ID, subject=Service ID, audience=`https://appleid.apple.com`, key ID in header, and expiration less than Apple's maximum six-month interval. Store only the resulting JWT in `APPLE_CLIENT_SECRET`; renew before expiry. Use the official [Better Auth Apple guide](https://better-auth.com/docs/authentication/apple).
5. Set `APPLE_SERVICE_ID` and `APPLE_BUNDLE_ID`. The server validates both allowed audiences through Better Auth; native iOS sends a random nonce and the verified identity token. No token verification bypass or platform-header audience selection is used.
6. Verify first and repeat authorization, cancellation, private relay, and missing subsequent profile details on a real iOS build. Android uses Apple browser OAuth with app return.

## Email delivery

Verify a sender domain in Resend; set server-only `RESEND_API_KEY` and `MAIL_FROM`. Remove capture mode outside local development. Codes expire after five minutes, have five attempts, are stored hashed, and are rate limited server-side. UI resend cooldown is 60 seconds. Do not log OTPs or captured messages.

## Native builds and session proof

Copy `apps/mobile/.env.example` to `.env.local`, set the reachable backend URL and public Google IDs. A physical device cannot reach your computer using `localhost`; use a trusted HTTPS development backend. Set `APP_IDENTIFIER`, `APP_VARIANT`, and `GOOGLE_IOS_URL_SCHEME` before building.

```sh
pnpm --filter @timely/mobile ios
pnpm --filter @timely/mobile android
pnpm dev:mobile
```

EAS profiles in `apps/mobile/eas.json` separate development, preview and production app IDs/schemes. Register actual IDs/callbacks before EAS builds. Configure signing through your Apple/Google accounts. No store submission or paid build purchase has been performed.

Native sessions use Better Auth Expo secure storage. Protected API requests await `getCookie()` and send it with `credentials: 'omit'`. Verify restart restoration and sign-out in the native account/planner flow. SQLite-backed planner code exists, but actual authenticated offline restart and cross-client convergence remain acceptance checks. See `docs/mobile-verification.md`.

## Rotation

Rotate database role credentials and update both request and migration URLs. Rotate Resend/Google secrets in the provider console then the backend secret store. Renew Apple client-secret JWT before expiry; revoke and replace a compromised key. Rotating `BETTER_AUTH_SECRET` can invalidate sessions; plan reauthentication. Never copy secrets to public Expo/Next.js env fields or source-controlled docs.

## Planner persistence and offline browser verification

The additional migration is `packages/db/migrations/0001_majestic_invaders.sql`. It creates the app-managed `timely` schema. Do not apply it to the root production connection as part of ordinary development.

The isolated Neon development credentials are in the ignored `.env.neon-development`. Run migrations from the repository root without printing its contents:

```sh
node --env-file=.env.neon-development --import tsx -e 'process.chdir("packages/db"); await import("./packages/db/src/migrate.ts")'
RUN_DB_TESTS=1 node --env-file=.env.neon-development node_modules/vitest/vitest.mjs run packages/db/src/planner.integration.test.ts
```

The integration suite creates synthetic owners and removes them after testing. It verifies real transactions, deduplication, two-account boundaries and snapshot/feed consistency. Its 60-second per-test budget accounts for development-branch network latency; the first default five-second run timed out, and cleanup overlapped unfinished transactions. The corrected run passes.

The browser's service worker is enabled in a production build. For a **local** production-artifact test with existing local Postgres and Mailpit configuration:

```sh
pnpm build
APP_ENV=local BETTER_AUTH_URL=http://localhost:3001 pnpm --filter @timely/web start --port 3001
TEST_BASE_URL=http://localhost:3001 pnpm test:e2e
```

`APP_ENV=local` allows capture mail in a built app only when both the backend URL and database URL are loopback hosts. It still sends real SMTP and uses real Better Auth sessions. Hosted production requires Resend configuration. Browser fixtures represent separate synthetic client IPs for the authentication rate limiter and poll for actual mail delivery; no OTP or session token is written to evidence.

Web navigation is Planner / Review / Search / Settings. The current Review and Search cover the selected downloaded period. Overdue display covers the preceding year and labels that coverage. Broader history, synchronized preferences, recovery/discard controls, drag/reorder and release notification delivery remain under implementation. Native code now includes all four destinations, custom recurrence editing/scopes, scoped delete/Undo, explicit reorder and safe deep links. These additions still need authenticated native runtime verification; see `docs/implementation-audit.md` for the complete remaining work.
