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

## Merge and hosted verification

Reviewed source `955eee7972fc75168119cd0c7b22e6175fd224c8` was committed on `codex/release-review-20261015`, fast-forwarded into main and pushed. The working tree is clean apart from the subsequent release-evidence update. A clean Git archive supplied 334 regular source files to the existing Vercel project; upload inspection confirms no environment/credential/local-state/native-build files and preserves `.pnpmfile.cjs`. Existing Production configuration was reused.

Deployment `dpl_BowQFScE2ryRr7BwSzEEiyjjCXCf` is READY and assigned to [Timely production](https://timely-mauve-five.vercel.app). [Immutable deployment](https://timely-bdnssmlnw-alexeiguchs-projects.vercel.app), [Vercel inspection](https://vercel.com/alexeiguchs-projects/timely/BowQFScE2ryRr7BwSzEEiyjjCXCf). Remote frozen pnpm 10.7.0 installation, Next.js compilation, TypeScript and routes passed. No production migration or configuration changes were made.

Hosted checks pass:

- Homepage/health 200, fresh matching rendering nonces, strict CSP and HSTS.
- Anonymous account/bootstrap 401, cross-origin bootstrap 403, unsigned Inngest 401; provider and notification capability endpoints 200.
- Real Resend simulator OTP sign-in, wrong-code and consumed-code rejection.
- Desktop 1280×800 and phone 320×740 task save/reload; foreground confirmation with initial/restored focus; Keep editing and repeated Escape preserve drafts; Discard preserves the saved task; reduced motion suppresses animation. Hosted screenshots visually inspected at `/tmp/timely-release-20261015/discard-{desktop,phone}.png`.
- Only the newly created synthetic account/task was deleted through the authenticated account API; session revocation verified. No existing account data was accessed.

Reproduction helpers remain ignored in `.local/verify-release-20261015.mjs` and `.local/verify-streak-hosted.mjs`; the authenticated check reads existing server-only configuration through `node --env-file=.env.vercel --import tsx .local/verify-release-20261015.mjs`. It uses only the Resend delivery simulator and cleans up its own fixture. No credentials/OTPs/sessions are logged. The local preview server is stopped; isolated local test database `timely_release_review_20261015_1448` remains available for reproduction. The initial screenshot-cleanup approval rejection was resolved after proving these files were clean at task start and rewritten by this test run; only those generated screenshots were restored.

GitHub [release CI](https://github.com/Alexeiguch/timely/actions/runs/38746194408) passed all steps, including frozen install, typecheck, lint, migrations, real database tests, build and desktop/phone browser tests, in 3m51s. Existing action-runtime deprecation and upcoming Ubuntu runner-image notices are nonblocking. This documentation-only handoff does not change the deployed application source. Next product action: address the remaining native/provider acceptance and store-readiness work listed in [release readiness](release-readiness.md).
