# Planner deployment preparation

The web planner was published to Vercel on 2026-10-08 at [timely-mauve-five.vercel.app](https://timely-mauve-five.vercel.app), with owner authorization. First-release acceptance remains unfinished; see [release-readiness.md](release-readiness.md). The separate root Neon hello deployment is unrelated. Additional production migrations, DNS changes and store submission require their own owner authorization.

## Web and authenticated backend

The canonical target is the existing Next.js app on Vercel with self-hosted Better Auth and Neon Postgres. Install from the repository root with `pnpm install --frozen-lockfile`; build with `pnpm --filter @timely/web build`. The Next app directory is `apps/web`, and its workspace dependencies must remain available during build. Configure one HTTPS origin per environment, not a shared production/staging cookie origin.

### Prepared Vercel project — 2026-10-08

The owner selected Vercel and the existing Neon setup. Project `timely` is linked to scope `alexeiguchs-projects` on Hobby, with Root Directory `apps/web`, framework Next.js, Node.js 24 and Fluid compute enabled. Run Vercel CLI commands from the repository root. `apps/web/vercel.json` defines the frozen pnpm workspace install and webpack Next.js build. `.vercelignore` excludes local environment files, downloaded provider credentials, native build output and verification artifacts; `.vercel` is Git-ignored.

The live free hostname is `https://timely-mauve-five.vercel.app`. Neon project `fragrant-bonus-17540843` has an isolated schema-only branch `timely-vercel` (`br-quiet-boat-b43osjd2`) and the hosted planner database `timely`. All planner migrations have been applied to this database. Existing `production`, `timely-development` and local Postgres data remain unchanged; local planner data was not copied. The branch uses 0.25 CU and the account's default suspension behavior. Explicit suspension configuration was rejected by the free account and omitted on retry.

The new ignored, mode-0600 `.env.vercel` contains the pooled runtime connection, direct migration connection, dedicated generated auth secret, exact HTTPS origin and existing Resend sender/key. It does not replace the local environment files. The direct migration credential must not be uploaded to Vercel. The initial deployment excluded optional provider secrets. The owner subsequently added GOOGLE_WEB_CLIENT_ID and sensitive GOOGLE_CLIENT_SECRET to Vercel Production and reported registering the hosted Google callback. The redeployed backend now enables Google and generates the expected Google authorization URL. Actual owner consent/token exchange remains to be verified; Apple and signed hosted Inngest dispatch still require their external gates. `EXPO_PUSH_ENABLED=false` and `INNGEST_DEV=0` are the initial hosted settings.

Automatic approval review initially blocked agent secret upload. The owner subsequently added the Vercel variables and explicitly requested publication. These server-only Production settings are the deployment inputs; future authorized changes can use stdin and `vercel env add <KEY> production --sensitive --yes --scope alexeiguchs-projects`:

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `MAIL_MODE`, `MAIL_FROM`, `RESEND_API_KEY`
- `APP_SCHEME`, `EXPO_PUSH_ENABLED`, `INNGEST_DEV`
- `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (added by the owner for Google sign-in)

Deploy using `vercel deploy --prod --scope alexeiguchs-projects` from the repository root. `.vercelignore` must explicitly allow `.pnpmfile.cjs`: Vercel excludes it by default, and omitting this hook makes the frozen install fail with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. Preserve the committed lockfile rather than disabling frozen installation.

Hosted checks on 2026-10-08 pass: app and health return 200; anonymous session/sync return 401; cross-origin sync returns 403; response security headers are present. A real synthetic Resend delivery simulator OTP verifies invalid/consumed-code rejection, secure session restoration, task save, exact-retry deduplication, snapshot reload and sign-out revocation. The generated account/task were removed from the hosted database after testing. After the Google configuration redeploy, the public Google capability flag is true and the OAuth start endpoint generates an accounts.google.com URL with the exact hosted callback. Apple remains false and unsigned `/api/inngest` correctly returns 503. Human inbox delivery and complete social/native/reminder/release acceptance remain separate gates. See the deployment identifiers and latest status in `progress.md`.

Preview secrets are deliberately not configured. Each usable preview needs a separate database/auth origin and secret rather than pointing preview clients at this hosted planner database.

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

For hosted scheduling, configure `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY`, connect the existing `/api/inngest` HTTPS endpoint in Inngest, and verify its registered `reminder-sweep` minute cron. Hosted handlers require signed invocations. A signing key always wins over `INNGEST_DEV=1`. Unsigned dev mode accepts only a loopback Host and must not be enabled on a network-reachable server, because a client can spoof that header. Inspect the deployed host's actual execution-time allowance against the route's requested 300 seconds. Confirm minute cadence, concurrency and account quotas before enabling real reminders. No hosted Inngest account or paid reminder plan has been configured or approved. The published web deployment keeps remote push disabled until this scheduler is verified. The local script is a development path, not a production service.

Protocol version 1 currently includes preference and restore commands introduced before first release. Older app bundles cannot be assumed to understand new command variants. Release compatible backend and clients together; do not destructively roll back canonical rows or silently drop queued operations. Local IndexedDB v2/SQLite v3 upgrades are forward migrations. A rollback must retain compatible readers or restore a tested backup on an isolated branch before changing production.
