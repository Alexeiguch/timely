# App check — 19 October 2026

Quick source/contract and automated regression pass, not full physical-device or store acceptance. Working branch `main`, starting source `9eac583`. Existing uncommitted store-review documentation was preserved.

## Implemented

- Web and native Settings → Manage account now offer Sign in again without sign-out or discarding saved work. The existing confirmation and server recent-auth check still protect deletion.
- Web reauthentication stays open when the current session refreshes; only a different session completes it.
- English/Spanish deletion copy no longer promises immediate removal from disconnected devices.
- Expo configuration blocks unused Android shared-storage permissions; preview/production also block overlay access. Development retains the overlay needed by development tooling. Disabled the unused SecureStore Face ID purpose string. Notification permissions are retained.
- Root TypeScript configuration now extends the workspace base, eliminating the unresolved Expo base warning in root test tooling. Mobile retains its own Expo base.

## Verification

- `pnpm test`: 192 pass; 28 database integration cases skipped because `RUN_DB_TESTS` was unset. No remaining Expo base-config warning.
- `pnpm typecheck`: all ten workspaces pass (six cache hits, four executed).
- `pnpm lint`: passes, including client/server import boundaries.
- `pnpm build`: production Next.js build passes.
- `APP_VARIANT=production EXPO_NO_DOTENV=1 pnpm --filter @timely/mobile exec expo config --type introspect --json`: passes. Generated permission entries mark both storage permissions and overlay permission for removal; Face ID purpose is absent. Output `/tmp/timely-fast-check-expo.json`. This is configuration evidence, not final signed-artifact proof.
- `TEST_BASE_URL=http://localhost:3021 pnpm exec playwright test tests/web/planner.spec.ts --grep 'account deletion offers' --reporter=line`: 2/2 pass (desktop and 320px phone), using real local Better Auth, PostgreSQL and Mailpit. Creates a synthetic plan, opens reauthentication from account management, returns and verifies the saved plan remains. This does not claim new provider exchange, account deletion, or native interaction acceptance.
- `git diff --check`: passes.

The local preview used `APP_ENV=local MAIL_MODE=capture DATABASE_URL=postgres://timely:timely@127.0.0.1:5432/timely BETTER_AUTH_URL=http://localhost:3021 pnpm --filter @timely/web start --port 3021`. Sandbox initially blocked the listening socket; normal escalation allowed the preview/browser check. The pre-existing server on 3000 was preserved.

## Still missing

- Public privacy/support/deletion destinations and in-app links: operator name, public contact, actual backup/log retention are requested from the owner and pending. Do not invent those facts or publish placeholder policies.
- Reliable Apple token exchange/revocation on deletion, reusable reviewer access and safe provider linking/unlinking remain implementation/setup work.
- Apple provider credentials, final Android signing/OAuth/FCM setup and signed physical iOS/Android notification/auth/offline acceptance remain `blocked_external`; exact prerequisites are in the [store audit](app-store/submission-review-2026-10-15.md#6-next-pass-and-verification-handoff).
- Final merged release manifests, full accessibility/large-text/two-device acceptance and store declarations remain open. No stage was promoted to complete, and no deployment, upload or submission occurred.

Next: obtain the pending policy facts and implement the three public destinations with links; then address server Apple revocation with failure/retry tests and the remaining [release checklist](release-checklist.md). See [account recovery decision](decisions/008-account-recovery.md) for this pass's behavior.
