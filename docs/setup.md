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

Web and mobile sign-in codes are sent by the same Better Auth backend. Resend is the default delivery provider when `MAIL_MODE` is unset, or it can be selected explicitly. Local Mailpit remains an explicit test transport, selected by `MAIL_MODE=capture`, and requires loopback backend/database hosts. A built local app also requires `APP_ENV=local`.

To activate Resend for local simulator/web use:

1. Verify your sending domain in the [Resend dashboard](https://resend.com/docs/dashboard/domains/introduction). DNS changes need the owner's authorization. A development `.local`/`.test` sender cannot deliver real mail.
2. Create a [Sending access API key](https://resend.com/docs/dashboard/api-keys/introduction) restricted to the verified domain. Add `RESEND_API_KEY` to the ignored `apps/web/.env.local` or the approved backend secret store. Never paste a key into chat or put it in `EXPO_PUBLIC_*`/`NEXT_PUBLIC_*` variables.
3. Preserve the other backend settings and set:

   ```dotenv
   MAIL_MODE=resend
   MAIL_FROM=Timely <signin@your-verified-domain.com>
   RESEND_API_KEY=your-server-only-key
   ```

4. Validate configuration without sending mail or printing credentials:

   ```sh
   node --env-file=apps/web/.env.local --import tsx scripts/check-mail.mjs --resend
   ```

   This validates local settings, not Resend domain status or actual inbox delivery. Missing configuration fails explicitly; the app never treats it as successful delivery. For capture-mode checks, omit `--resend`.
5. Restart the backend on port 3001. A built preview needs `pnpm build` after mail-code changes, then `APP_ENV=local BETTER_AUTH_URL=http://localhost:3001 pnpm --filter @timely/web start --port 3001`. Neither mobile credentials nor a native rebuild are needed for the mail provider switch.
6. Request a code from web or the simulator using your own real inbox, verify the email in Resend's Emails dashboard and in the inbox, then complete sign-in. An API acceptance ID alone is not inbox-delivery evidence. The Mailpit smoke/browser fixtures use synthetic `@example.test` addresses and require capture mode; do not run them against Resend.

For a local end-to-end check without emailing a person, use Resend's [delivery simulator](https://resend.com/docs/dashboard/emails/send-test-emails):

```sh
TEST_BASE_URL=http://localhost:3001 node --env-file=apps/web/.env.local --import tsx scripts/resend-auth-smoke.mjs
```

This check sends one message exclusively to a unique `delivered+…@resend.dev` fixture and counts against the email quota. It requires email read access to retrieve that fixture's code; normal application delivery needs only Sending access. It checks real backend sign-in, session restoration, code rejection/reuse and sign-out without printing codes, keys or sessions. Simulator acceptance does not prove delivery to a human inbox. Keep the regular Mailpit/browser suite in capture mode.

Codes expire after five minutes, have five attempts, are stored hashed, and are rate limited server-side. UI resend cooldown is 60 seconds. Sign-in emails include HTML and plain text. Resend sends use its [documented email endpoint](https://resend.com/docs/api-reference/emails/send-email), a ten-second request timeout and a checked acceptance ID. Provider/network failures return a sanitized delivery error without automatic SMTP fallback or raw response logging. No automatic resend is attempted after an uncertain send; request a new code through the existing cooldown flow. Do not log OTPs or captured messages.

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

Web navigation is Planner / Review / Search / Settings. Review and Search support up to 366 days per query and online snapshot pagination with date/state/priority/series filters. Overdue display covers the preceding year and labels that coverage. Preferences, repair/discard and web drag/reorder are implemented. Native local scheduling is implemented; remote delivery and actual device verification remain open. Native code now includes all four destinations, custom recurrence editing/scopes, scoped delete/Undo, explicit reorder and safe deep links. These additions still need authenticated native runtime verification; see `docs/implementation-audit.md` for the complete remaining work.

## Language testing

Web and mobile start in Spanish. Select English or Español on sign-in or in Settings; the choice is stored on this browser/device and works offline. No new credential, database migration or native module is required. Browser tabs synchronize the choice locally; separate devices choose independently. Task titles and notes are never translated. Sign-in email follows the requesting client's selected language and defaults to Spanish when no language hint is supplied.

Run `pnpm test` for catalogue, persistence and bilingual mail checks. For real browser acceptance without sending human mail, start an isolated capture-mode preview with the existing loopback Docker database/Mailpit configuration:

```sh
pnpm build
APP_ENV=local MAIL_MODE=capture BETTER_AUTH_URL=http://localhost:3003 pnpm --filter @timely/web start --port 3003
TEST_BASE_URL=http://localhost:3003 pnpm test:e2e
```

The language suite checks Spanish default, both choices, reload/cross-tab persistence, localized OTP and offline edits on desktop and a 320px phone viewport. Existing English regression fixtures explicitly select English. The normal Resend previews on 3001/3002 can stay running separately. See [ADR 013](decisions/013-spanish-default-localization.md) and [mobile debugging](mobile-debugging.md) for the native local development path.


## Expo remote notifications

Use the existing linked Expo project `@guchinale/timely` (`ccd23170-5d7c-4937-8cb1-9a42ab67ccf4`). Native `extra.eas.projectId` and backend `EXPO_PUSH_PROJECT_ID` must match. A public project ID is not a credential. Do not add any push provider secret to an `EXPO_PUBLIC_*` variable.

1. Apply migrations 0003/0004 to local development PostgreSQL, not the unrelated root production Neon environment:

   ```sh
   node --env-file=apps/web/.env.local --import tsx --input-type=module -e 'const u=new URL(process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL); if(!["localhost","127.0.0.1"].includes(u.hostname)) throw new Error("Local database required"); process.chdir("packages/db"); await import(process.cwd()+"/src/migrate.ts")'
   ```

2. In ignored server-only `apps/web/.env.local`, set `EXPO_PUSH_ENABLED=true` and `EXPO_PUSH_PROJECT_ID=ccd23170-5d7c-4937-8cb1-9a42ab67ccf4`. Put `EXPO_ACCESS_TOKEN` in that same server file when Expo enhanced push security is enabled; a production process will not send without it. Restart the backend. `GET /api/v1/notifications/config` exposes only enabled/project identity; all device/coverage/test/status mutations require real authentication and enforce the owner. Downloaded `client_secret_*.json` files stay gitignored. Do not commit them or paste them into chat.
3. Configure provider credentials with the owner's Expo/Apple account:

   ```sh
   cd apps/mobile
   pnpm dlx eas-cli@24.12.0 credentials --platform ios
   ```

   Select `development`, then Push Notifications. Create a key or use the existing downloaded Apple `.p8` with its Key ID and team; upload it to Expo. Never paste the private key into chat, logs or the repository. Creating the key in Apple's website alone does not upload it to Expo. On 2026-10-08 Apple key creation through EAS failed with a maintenance response; the owner then created a key directly in Apple. The owner-provided key was subsequently uploaded and assigned to the development bundle; a real test receipt confirms APNs handoff. Owner-observed remote iPhone delivery passed on the repeated synthetic test. Full task/device-state verification remains pending. Android separately requires FCM v1 credentials and its registered native Firebase configuration; see [Expo setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).
4. Restart Metro so the dev manifest includes the project ID; use the existing signed development app with push entitlement, not Expo Go. Reconcile from mobile Settings after the device has permission and a real authenticated session. The nearest 48 alerts remain local, with eligible uncovered plans handled remotely. `ready` means coverage registration succeeded; it is not delivery proof.
5. For a local phone using port 3002, keep its backend/Metro reachable and run the durable development worker from the repository root:

   ```sh
   APP_ENV=local BETTER_AUTH_URL=http://alexeis-macbook-air.local:3002 node --env-file=apps/web/.env.local --import tsx scripts/push-worker.mjs
   ```

   Append `--once` for a single reconciliation/dispatch sweep. It logs counts only. The process must stay running to send remote reminders. Hosted production uses the signed Inngest minute cron; see [deployment](deployment.md#remote-reminders-and-compatibility).
6. In Ajustes → Recordatorios, select **Probar notificación remota** after registration is ready. The authenticated test creates one durable synthetic notification for 30 seconds later (one test/minute/device). Wait for the scheduling acknowledgement before backgrounding or locking the iPhone. Observe the alert; later inspect only its status/receipt. A provider ticket and a successful receipt establish provider acceptance/handoff, not visible delivery. No plan is created or changed by this test.

Regression commands:

```sh
pnpm test
RUN_DB_TESTS=1 node --env-file=apps/web/.env.local node_modules/vitest/vitest.mjs run packages/db/src/notifications.integration.test.ts packages/db/src/planner.integration.test.ts
```

These DB fixtures use synthetic accounts and clean them up. Native delivery, permission changes, cancelled alerts, more-than-48 coverage, offline/terminated/DST/multi-device behavior and hosted worker cadence still need the [physical verification matrix](mobile-verification.md). Local reminders continue to work without APNs/FCM provider keys; remote push requires those credentials.
