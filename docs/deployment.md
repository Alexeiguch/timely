# Planner deployment preparation

The complete planner has not been published. The separate root Neon hello deployment is unrelated. Publishing, production migrations, DNS and store submission require owner authorization after review of artifacts and the remaining gates in [release-readiness.md](release-readiness.md).

## Web and authenticated backend

The canonical target is the existing Next.js app on Vercel with self-hosted Better Auth and Neon Postgres. Install from the repository root with `pnpm install --frozen-lockfile`; build with `pnpm --filter @timely/web build`. The Next app directory is `apps/web`, and its workspace dependencies must remain available during build. Configure one HTTPS origin per environment, not a shared production/staging cookie origin.

Set server-only `DATABASE_URL` (pooled), `DATABASE_MIGRATION_URL` (direct, migration runner only), a random `BETTER_AUTH_SECRET` of at least 32 characters, `BETTER_AUTH_URL` (exact HTTPS app origin), `APP_SCHEME`, `MAIL_MODE=resend`, `RESEND_API_KEY` and verified `MAIL_FROM`. Add the intended provider keys listed in `apps/web/.env.example`; never expose them through a Next public variable or native build variable. Capture mail is local only and is rejected by hosted production. Run the non-sending check in [setup](setup.md#email-delivery) before restarting, then verify a real inbox sign-in; locally validated configuration is not delivery proof.

Google callbacks must point to this backend's `/api/auth/callback/google`. Apple's web/Android Service ID callback requires HTTPS and its native audience must match the registered bundle ID. Configure these before provider acceptance checks. Root managed Neon Auth is not a substitute for the planner's self-hosted identity tables.

Prepare migrations on an isolated Neon branch with the same migration history. Run the transaction/security suite against that branch. Apply the reviewed migrations using the direct migration credential only after authorization; the runner's working directory is `packages/db`:

```sh
node --env-file=.env.neon-development --import tsx -e 'process.chdir("packages/db"); await import("./packages/db/src/migrate.ts")'
```

Use an environment file for the intended approved target; do not point this development command at the root production environment. Record the migration/release identifiers without recording connection strings.

## Native artifacts

`apps/mobile/eas.json` separates development, preview and production schemes/identifiers. Set a registered `APP_IDENTIFIER`, `APP_VARIANT`, reachable HTTPS `EXPO_PUBLIC_API_URL`, public Google IDs and reversed iOS callback scheme before compiling. `com.example.timely` is a development placeholder. Provider secrets and database credentials belong exclusively to the backend.

Prepare signing with the owner's Apple/Google accounts and EAS project. Do not purchase builds or submit to stores as part of local preparation. Local iOS simulator and Android Debug compilation are development artifacts; they do not verify physical-device provider or push delivery. See [mobile verification](mobile-verification.md).

## Remote reminders and compatibility

Expo token registration, local/remote coverage handoff, transactional-outbox reconciliation, conservative dispatch and receipt processing are implemented. See [ADR 014](decisions/014-expo-remote-reminders.md) and [setup](setup.md#expo-remote-notifications). Remote delivery is not yet verified on physical devices.

Apply migrations 0003/0004 to an isolated approved development database first. Set server-only `EXPO_PUSH_ENABLED=true`, the matching public `EXPO_PUSH_PROJECT_ID`, and `EXPO_ACCESS_TOKEN`. A production Node process leaves push disabled until that access token is present. `APP_ENV=local` may omit it for development. Upload APNs and Android FCM v1 credentials to that Expo project. Each client environment must point at its matching backend origin. A worker reads the registered device's server-validated origin for alert routing.

For hosted scheduling, configure `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY`, connect the existing `/api/inngest` HTTPS endpoint in Inngest, and verify its registered `reminder-sweep` minute cron. Hosted handlers require signed invocations. A signing key always wins over `INNGEST_DEV=1`. Unsigned dev mode accepts only a loopback Host and must not be enabled on a network-reachable server, because a client can spoof that header. Inspect the deployed host's actual execution-time allowance against the route's requested 300 seconds. Confirm minute cadence, concurrency and account quotas before enabling real reminders. No hosted Inngest account, paid plan or production publishing has been configured or approved in this milestone. The local script is a development path, not a production service.

Protocol version 1 currently includes preference and restore commands introduced before first release. Older app bundles cannot be assumed to understand new command variants. Release compatible backend and clients together; do not destructively roll back canonical rows or silently drop queued operations. Local IndexedDB v2/SQLite v3 upgrades are forward migrations. A rollback must retain compatible readers or restore a tested backup on an isolated branch before changing production.
