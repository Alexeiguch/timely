# Stage 00 — verify the actual authentication path

## Goal and inputs

Prove that the chosen architecture supports the required account identity before building the full planner. Read [README](../README.md), [architecture](../ARCHITECTURE.md) and [sources](../SOURCES.md). This stage can start in a minimal workspace that is retained and expanded in stage 01; do not create a throwaway identity system that later diverges.

## Implement

1. Select a compatible Next.js, Expo and Better Auth dependency matrix. Pin it and record actual versions.
2. Mount a minimal self-hosted Better Auth handler on the Next.js backend, backed by Neon via the supported Drizzle adapter. Generate/review the auth schema migration. Do not enable managed Neon Auth for this path.
3. Add minimal web and native sign-in screens, session restoration, sign out and a protected `/api/v1/me` proof endpoint.
4. Configure Google, Apple and the email OTP plugin. Add the supported Expo server/client integration, explicit production schemes/origins and secure native session persistence.
5. Use a native Google library compatible with the chosen Expo SDK on iOS and Android. Exchange its identity token through the documented Better Auth flow. Use native Apple on iOS, with nonce/audience configuration matching the actual bundle ID. Use Apple browser OAuth on web and Android.
6. Use provider browser OAuth for the web. Configure web Service ID versus native App ID audiences correctly. Handle cancellation, denied consent, missing initial Apple name/email and relay email without fabricating a profile.
7. Implement email code request/verification, expiry, resend cooldown and rate-limit/error states. Use a real controlled mail delivery path or development capture; no SMS and no requirement for a password.

Never accept an unverified provider token. Verify signature/issuer/audience/expiry and nonce through supported library behavior; do not disable verification to make a proof work. If adding a custom audience verifier is unavoidable, implement and test all required checks, document why, and avoid trusting a client platform header as identity proof.

## External setup guide to write

Provide a step-by-step guide naming required Neon environment, Google platform client IDs and redirect URIs, Apple team/key/app/service IDs and HTTPS callback domain, email sender domain verification, backend URL, app schemes/bundle/package IDs and EAS development profile. Keep server secrets distinct from public IDs. Include secret rotation instructions and Apple client-secret renewal.

## Evidence matrix

Record each as **passed**, **failed** or **blocked_external**, with actual device/browser, library versions and reproduction steps:

| Platform | Required proof |
| --- | --- |
| Web | Google OAuth, Apple OAuth, email OTP, reload restoration, sign out |
| iOS development build | Native Apple, native Google, email OTP, process-restart restoration |
| Android development build | Native Google, Apple browser return, email OTP, process-restart restoration |
| Backend | Valid session access; anonymous/expired/wrong-account access rejected |

Also verify explicit account linking, distinct private-relay emails, cancelled sign-in and provider errors. Never infer that matching email means the two sessions belong to one account.

## Gate and handoff

The full auth gate passes only with real provider credentials and native-build evidence. If credentials/devices are missing, mark it blocked, leave runnable code and exact setup steps, and proceed with independent infrastructure/domain work. Use a clearly isolated development test identity only for automated tests; production integration remains blocked. Revisit before release.

If the selected current Better Auth version cannot provide the required native flow, present the concrete failure and a replacement proposal to the owner before changing providers. Do not substitute browser-only Google or omit Apple silently. Update progress with the dependency matrix, environment guide, evidence and next action.
