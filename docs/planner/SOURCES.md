# Primary documentation and verification notes

Checked for this instruction pack on 29 September 2026. This pack contains product requirements and engineering prescriptions, not a claim that an app has already been built or tested. Agents must consult the documentation for the versions they actually install and record their compatibility matrix in stage 00/01.

## Authentication feasibility

| Source | Relevant finding |
| --- | --- |
| [Neon OAuth provider API](https://api-docs.neon.tech/reference/addbranchneonauthoauthprovider) | The current published provider enum accepts Google, GitHub, Microsoft and Vercel; Apple is absent. |
| [Neon OAuth setup](https://neon.com/docs/auth/guides/setup-oauth) | Managed provider/browser setup; the quick start lists Google, GitHub and Vercel. |
| [Neon supported plugins](https://neon.com/docs/auth/guides/plugins) | Managed Auth exposes a selected plugin set; it is not arbitrary server plugin installation. |
| [Neon Auth roadmap](https://neon.com/docs/auth/roadmap) | Published supported web frameworks and managed plugin boundaries. |
| [Neon SDK comparison](https://github.com/neondatabase/neon-js/blob/main/packages/auth/neon-auth_vs_better-auth.md) | The managed client restricts unsupported configuration and has Neon-specific flow behavior. |

The provider API includes Microsoft even though the simpler OAuth guide lists three providers. Use the API's explicit enum as stronger evidence for configuration availability. Merely passing `provider: 'apple'` to a client is not proof that the managed backend supports it.

This pack selects self-hosted Better Auth with Neon Postgres to meet the native Apple/Google and email OTP requirements. The following documentation establishes a supported implementation path; real credentials/builds are still required for actual feasibility evidence:

- [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo): native integration, secure session handling and identity-token sign-in.
- [Apple provider](https://better-auth.com/docs/authentication/apple): server configuration, web/native audiences and Apple sign-in.
- [Google provider](https://better-auth.com/docs/authentication/google): provider configuration and identity-token sign-in.
- [Email OTP plugin](https://better-auth.com/docs/plugins/email-otp): code-based email sign-in; configure delivery in the application.
- [Next.js integration](https://better-auth.com/docs/integrations/next): mounting the application-managed auth handler.
- [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle): database adapter and schema integration.

These are upstream Better Auth features, distinct from managed Neon Auth. Do not use an upstream feature list as proof of managed-service availability. Native Apple system sign-in is an iOS capability; Android's Apple sign-in uses a provider browser flow.

## Application and storage references

| Component | Official reference |
| --- | --- |
| Next.js App Router | [Documentation](https://nextjs.org/docs/app) |
| Expo Router | [Introduction](https://docs.expo.dev/router/introduction/) |
| Expo SQLite | [SDK documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/) |
| Expo SecureStore | [SDK documentation](https://docs.expo.dev/versions/latest/sdk/securestore/) |
| IndexedDB / Dexie React use | [Dexie documentation](https://dexie.org/docs/Tutorial/React) |
| Neon + Drizzle | [Neon integration guide](https://neon.com/docs/guides/drizzle) |

Dexie supplies local persistence; the custom authenticated synchronization contract is this project's design, not a claim that Dexie alone synchronizes with Neon. Expo SDK pages are moving targets: use Expo-compatible installation and lock a tested matrix.

## Notifications, jobs and mail

- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/): scheduling, cancellation, permissions and native/push capabilities.
- [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/): native build and service setup.
- [Inngest scheduled functions](https://www.inngest.com/docs/guides/scheduled-functions): durable scheduled work and cron behavior. Use a UTC service sweep; resolve user-local task times in the shared domain, not in thousands of per-user cron expressions.
- [Resend Node.js delivery](https://resend.com/docs/send-with-nodejs): the selected backend email adapter.

The 48-notification budget, seven-day local horizon, sixty-minute remote catch-up limit and sync batch limits are explicit application defaults. They are not claims about universal OS quotas or provider plans. Verify actual platform behavior and commercial quotas before release.

## Design references

The supplied user design system is authoritative. External sources supply assets/technical usage, not a competing style:

- [Baloo 2](https://fonts.google.com/specimen/Baloo+2) and [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans), with their shipped license/weight metadata.
- [Lucide React Native](https://lucide.dev/guide/react-native) and [Lucide React](https://lucide.dev/guide/react), for the selected outline icon family.

Bundle fonts for offline rendering, verify genuine weights and calculate contrast from the actual color pairs. Do not assume the approximate contrast ratio in the supplied brief is a tested value.

## What remains for implementation verification

Provider credentials/callback domains, account linking, native token audiences/nonces, mail delivery, actual push delivery, OS scheduling constraints, local time-zone changes while terminated, database transactions, offline convergence and release-host quotas are implementation gates. Record them as passed only after executing the relevant tests. All design, sync, recurrence and product defaults in the pack remain enforceable without pretending those external gates already passed.
