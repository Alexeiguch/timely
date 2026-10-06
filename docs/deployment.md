# Planner deployment preparation

The complete planner has not been published. The separate root Neon hello deployment is unrelated. Publishing, production migrations, DNS and store submission require owner authorization after review of artifacts and the remaining gates in [release-readiness.md](release-readiness.md).

## Web and authenticated backend

The canonical target is the existing Next.js app on Vercel with self-hosted Better Auth and Neon Postgres. Install from the repository root with `pnpm install --frozen-lockfile`; build with `pnpm --filter @timely/web build`. The Next app directory is `apps/web`, and its workspace dependencies must remain available during build. Configure one HTTPS origin per environment, not a shared production/staging cookie origin.

Set server-only `DATABASE_URL` (pooled), `DATABASE_MIGRATION_URL` (direct, migration runner only), a random `BETTER_AUTH_SECRET` of at least 32 characters, `BETTER_AUTH_URL` (exact HTTPS app origin), `APP_SCHEME`, `RESEND_API_KEY` and verified `MAIL_FROM`. Add the intended provider keys listed in `apps/web/.env.example`; never expose them through a Next public variable or native build variable. Capture mail is local only and is rejected by hosted production.

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

Inngest and remote push are required by the contract but their worker/token/coverage/receipt implementation is still absent. No worker cadence or paid plan is approved or active. Preserve transactional invalidation jobs until that implementation is verified. Do not advertise remote notification delivery from a deployment of the current app.

Protocol version 1 currently includes preference and restore commands introduced before first release. Older app bundles cannot be assumed to understand new command variants. Release compatible backend and clients together; do not destructively roll back canonical rows or silently drop queued operations. Local IndexedDB v2/SQLite v3 upgrades are forward migrations. A rollback must retain compatible readers or restore a tested backup on an isolated branch before changing production.
