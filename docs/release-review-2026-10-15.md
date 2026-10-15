# Branch and release review — 2026-10-15

The owner requested branch inspection, code review, merge to main, push and deployment. Starting `main` and `origin/main` were `8d268e4`. GitHub has two branches: `main` and `codex/finish-planner`. The latter's tip `22e5633` is an ancestor of main, 12 commits behind with no unique commits. Both historical pull requests are merged; there is no outstanding feature-branch merge.

Reviewed the pending changes in `apps/web/components/task-editor.tsx`, `apps/web/app/globals.css`, `tests/web/planner.spec.ts`, `apps/mobile/eas.json`, ADR 019 and progress. No blocking findings. The nested native modal opens above the editor and makes background content inert; Keep editing and Escape preserve the draft and restore focus. Explicit Discard closes without changing saved data. Animation follows the existing reduced-motion rule. The Apple ID is submission account metadata, consistent with the existing app/team configuration; it changes no native runtime code. Existing committed authentication, reminder and streak work is preserved.

Checks completed before merge:

- `pnpm typecheck`: ten packages pass (six cache hits).
- `pnpm lint`: ESLint and client/server boundaries pass.
- `pnpm test`: 192 pass, 28 database tests initially skipped. Re-run with `RUN_DB_TESTS=1` and an isolated local PostgreSQL database: **220/220 pass**, 30 files, 7.32s.
- All committed migrations apply successfully to newly created local database `timely_release_review_20261015_1448`. Existing databases were not migrated or cleared.
- `pnpm build`: optimized Next.js 16.3.8 webpack compilation, TypeScript and routes pass.
- `TEST_BASE_URL=http://localhost:3003 pnpm exec playwright test --reporter=line`: **32/32 pass**, 1.6 minutes, production build with real Better Auth/Postgres and Mailpit. Covers desktop and 320px phone authentication, offline reload/two-device sync, owner/origin boundaries, recurrence identities/history, account deletion, storage upgrades, nonce CSP and draft recovery.
- Discard-dialog screenshots visually inspected at both widths. Focus, foreground hit testing, Keep editing, repeated Escape, explicit discard, saved title/notes and reduced motion pass.
- `git diff --check`: pass. Test-generated updates to existing evidence images are excluded from the release.

Existing nonfatal Expo base-tsconfig and terminal-color warnings remain. No dependency, schema, secret, provider or DNS changes are required. The deployment target is the existing Vercel web/backend project; this release does not include a native build/store submission. Existing physical-device authentication/notification and TestFlight acceptance gates remain in [release readiness](release-readiness.md).

Next action: merge the reviewed release branch into main, push main, deploy a clean Git archive using the existing Production configuration, then record GitHub CI, immutable deployment and hosted verification results here and in [progress](progress.md).
