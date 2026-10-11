# 015 — Standalone local iPhone build

Date: 2026-10-08

The owner requested an Expo build that runs without Metro. Use an iOS Release configuration with embedded JavaScript, retaining the existing development bundle identifier, callback scheme and backend origin. This allows an in-place installation with the same signing team and keeps the existing local database and auth storage namespace. The separate preview identity requires HTTPS and separate provider/signing setup, so it is not used for the existing local iPhone installation.

`ios:standalone` invokes Expo's Release build with `--no-bundler`. The EAS `standalone` profile disables the development client, explicitly selects the development EAS environment and Release configuration, and inherits the development app variant. No dependency change or store submission is needed.

Development iOS configuration declares `NSAllowsLocalNetworking=true` with `NSAllowsArbitraryLoads=false` and a custom local-network permission description for the Mac backend. The Expo dev-launcher build phase removes its own permission description in Release; a backend-specific description must survive. Preview and production do not receive this development configuration, and the application's existing HTTPS enforcement is unchanged.

Bundle the public mobile environment at build time. Use the phone-reachable `.local` backend origin and keep the same origin when updating the installed app, since auth storage is namespaced by origin. No backend secrets are included. The Mac is still needed for local sign-in/sync and remote worker delivery; the app's JavaScript and saved offline plans are independent of Metro after compilation.

Reproduction and EAS environment requirements: [mobile debugging](../mobile-debugging.md#run-on-iphone-without-metro). Actual artifact/install checks are recorded in [progress](../progress.md) and [mobile verification](../mobile-verification.md).

## Hosted backend selection — 2026-10-11

The owner explicitly selected https://timely-mauve-five.vercel.app for the rebuilt iPhone app. Retain the existing development identifier, callback scheme and signing team while embedding this HTTPS origin in the Release configuration. Auth and planner storage are already namespaced by origin; the existing Mac-origin data remains stored separately, and hosted sign-in is required. Do not copy local plans to another backend implicitly. See the Vercel Release build instructions in [mobile debugging](../mobile-debugging.md#release-build-connected-to-vercel).
