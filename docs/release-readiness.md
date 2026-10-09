# Release preparation and remaining gates

The web planner was published with owner authorization on 2026-10-08 at [timely-mauve-five.vercel.app](https://timely-mauve-five.vercel.app), using the separate `timely-vercel` Neon branch/database. Hosted email OTP/session/task-sync smoke checks pass; full release acceptance remains unfinished. No DNS changes or store submissions have been performed. The existing Neon hello deployment remains unchanged. Local planner development uses Docker Postgres/Mailpit or the isolated `timely-development` Neon branch, never the root production environment.

## Executable local checks

```sh
pnpm install --frozen-lockfile
docker compose up -d
pnpm db:migrate # supply the development DATABASE_MIGRATION_URL; see setup.md
pnpm typecheck
pnpm lint
pnpm test
RUN_DB_TESTS=1 node --env-file=.env.neon-development node_modules/vitest/vitest.mjs run packages/db/src/planner.integration.test.ts
pnpm build
APP_ENV=local BETTER_AUTH_URL=http://localhost:3001 pnpm --filter @timely/web start --port 3001
TEST_BASE_URL=http://localhost:3001 pnpm test:e2e
pnpm doctor:mobile
pnpm --filter @timely/mobile exec expo export --platform ios --platform android --output-dir /tmp/timely-release-export
```

CI now defines disposable Postgres/Mailpit services, runs migrations and real transaction tests, then the built-app desktop/phone browser suite. The checked-in CI secret is synthetic and restricted to this test job. Do not use it for any deployed environment. The workflow still needs an actual CI execution; a local run is not proof of remote CI success.

## Independent engineering gates still open

- Remote reminders: Expo device registration, coverage handoff, transactional-outbox/due reconciliation, uncertain-send protection, receipts and token cleanup are implemented and tested locally. Full physical notification lifecycle/state proof (APNs key uploaded, first test receipt confirms handoff and owner observed the repeated remote iPhone test), Android FCM v1/runtime, hosted signed Inngest cadence/quotas and the full channel/zone/termination matrix remain open. See [ADR 014](decisions/014-expo-remote-reminders.md).
- Native runtime: equivalent Expo SQLite migration with pending work (SQL logic passes in Node), Android app flows, notification cancellation/delivery and account cleanup in signed development builds. Exports/native compilation do not prove OS presentation.
- Scale and retention: indexed effective-date projections, canonical journal checkpointing and retained-cursor expiry with a realistic large-account benchmark. Historical projection is bounded/paginated; current UI still reads complete account repositories.
- Remaining UX: full keyboard/screen-reader/zoom/large-text/gesture matrix, monthly cross-month groups, safe provider link/unlink and exhaustive two-device recurrence conflict fixtures.

## External gates (`blocked_external`)

1. Register the self-hosted Google callbacks for local ports 3000/3001 and final staging/production HTTPS origin, then verify real consent and token exchange on web/iOS/Android. Native Google requires registered platform client IDs and Android SHA identities.
2. Supply Apple App/Service IDs, a current generated client secret and an HTTPS callback; verify first/repeat authorization and private relay on physical iOS plus supported Android browser flow.
3. Verify a real inbox sign-in. Resend secrets are configured in the Vercel backend, and both local and hosted synthetic delivery simulator sign-in checks pass as of 2026-10-08 using the owner's verified `findmatchuy.com` sender. Human inbox delivery remains unverified.
4. Choose registered production app identifiers, EAS project/signing credentials and physical iOS/Android test devices; upload push credentials to the linked Expo project and configure hosted Inngest event/signing keys and approved cadence/plan. Apple EAS key creation returned maintenance; the owner created a key on Apple directly, and that existing key is now uploaded/assigned in Expo. A real test receipt confirms APNs handoff and the owner observed the repeated remote iPhone test. Android FCM v1 and hosted worker verification remain open.
5. Web publication was explicitly authorized and completed on 2026-10-08. Additional production migrations, DNS changes and store submission still need their specific owner authorization; open acceptance checks remain open after hosting.

## Recovery

Settings can retry unchanged queued operations or explicitly discard all pending edits for one affected task. This preserves canonical data and unrelated tasks. An invalid atomic batch is isolated in singleton order before it blocks a command. Do not regenerate UUIDs for response-loss retries. Do not delete a local database to repair an outbox.

If local stored-state validation or migration fails, preserve the database and reproduce from the same account/environment. Web storage upgrades retain the database name `timely-planner-v1`; native uses `timely-planner.db`. Account deletion requires real authentication within five minutes and explicit confirmation. Sign-out with local-only work requires synchronization or explicit confirmed discard. Native OS cancellation has a durable cleanup queue that survives account purge and retries after launch.

Prepared deployment, operations and review gates are in [deployment.md](deployment.md), [operations.md](operations.md) and [release-checklist.md](release-checklist.md).
