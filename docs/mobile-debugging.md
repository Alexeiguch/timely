# Debug Timely in VS Code

Open the repository root or `apps/mobile`; both folders have matching VS Code configurations. The installed **Expo Tools** extension (`expo.vscode-expo-tools`) supplies the Hermes debugger. The Microsoft React Native Tools run button uses a different workflow; use the named Timely configuration below.

## First setup

1. Start the local backend on port 3001 if it is not already running. From the repository root: `APP_ENV=local BETTER_AUTH_URL=http://localhost:3001 pnpm --filter @timely/web dev --port 3001`. Local Postgres must be running. With `MAIL_MODE=resend`, codes arrive in the entered real inbox; Mailpit is used only in explicit capture mode. See `setup.md`.
2. In VS Code, open the Command Palette (`Cmd+Shift+P`), choose **Tasks: Run Task**, then **Mobile: Start Metro**. Keep this terminal running. It binds Metro to IPv4 loopback on port 8081 and sets the simulator API address to `http://localhost:3001`.
3. Run **Mobile: Build iOS development app** once to install a Debug build in the simulator. This may take several minutes initially. Rebuild after adding native packages or changing native configuration. The earlier Release build used for visual QA cannot expose the development debugger.
4. Open Timely in the simulator. If the Expo development launcher appears, connect to `http://127.0.0.1:8081`.
5. Run **Mobile: Repair Expo Tools 1.6.3 debugger** once, then run **Developer: Reload Window**. Expo Tools 1.6.3 passes a VS Code URI where the current JavaScript debugger requires a filesystem path; the repair is idempotent and keeps a `.timely-backup` beside the extension bundle. Repeat this after reinstalling or updating Expo Tools only if version 1.6.3 is still installed.
6. Open **Run and Debug** (`Cmd+Shift+D`), select **Timely: Debug mobile (Expo / Hermes)**, and press **F5** (or the green play button). Choose the running iOS Hermes target if prompted. Wait until the debug toolbar appears and the breakpoint becomes solid red before exercising that code path.

## Daily use

Run Metro, open the installed development app, and press F5. Set breakpoints on executable statements, not blank lines, type declarations, braces or a structural `return (` line. Reproduce the action in the app; VS Code shows Variables, Call Stack, and Watch when execution pauses. F10 steps over, F11 steps into, Shift+F11 steps out, and F5 continues. On a Mac keyboard, you may need the Fn key for function keys.

Useful source locations:

- `apps/mobile/src/brand.tsx`: a harmless render breakpoint; reload to hit it.
- `apps/mobile/src/sign-in.tsx`: sign-in form handling. Avoid copying authentication codes/session values into logs.
- `apps/mobile/src/planner-provider.tsx`: task actions and synchronization.
- `packages/sync/src/engine.ts`: shared local-save/push/pull behavior; opening the repository root makes shared code easier to navigate.

Saved JavaScript/TypeScript changes use Fast Refresh. Metro serves the native JavaScript bundle on **8081**; the application API is on **3001**. The debugger attaches through Metro, not the API port.

## Troubleshooting

- **`RNGoogleSignin` could not be found:** Google Sign-In contains custom native code and cannot run in Expo Go. Install a fresh Timely development build after installing or upgrading native dependencies: `pnpm --filter @timely/mobile ios` or `pnpm --filter @timely/mobile android`. Starting Metro or reloading JavaScript does not update an already-installed native binary. The app now keeps email sign-in usable and reports this mismatch instead of crashing at startup.
- **Google button unavailable:** Expo loads `apps/mobile/.env.local`, not `.env.example`. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` there, then restart the Metro task. EAS variables are not automatically downloaded by local Metro; use `eas env:pull --environment development` from `apps/mobile` for a linked EAS project. Secret-visibility variables cannot be pulled; client IDs are public identifiers and should use plaintext or sensitive visibility. Keep the Google client secret only on the backend.
- **Google iOS callback missing:** set `GOOGLE_IOS_URL_SCHEME` to the reversed iOS client ID (`com.googleusercontent.apps.<iOS-client-prefix>`), run `pnpm exec expo prebuild --platform ios --no-install` from `apps/mobile`, then rebuild the development app. The iOS OAuth client must be registered for `com.example.timely.dev` when using the default development identifier. Reloading JavaScript cannot add a native callback scheme.
- **Social providers unavailable:** start the backend on port 3001. `http://localhost:3001/api/v1/auth/providers` must return `google: true`; having mobile client IDs alone does not enable the server provider.
- **No app/target found:** install the Debug build, open it, and connect it to Metro. A Release binary does not become debuggable merely because Metro is running.
- **`opn` not found / bare React Native CLI errors:** select the Timely Expo configuration instead of Microsoft React Native Tools' direct-iOS action. This project does not need `npx react-native run-ios` or a separate `@react-native-community/cli` dependency for Expo debugging.
- **`expo-router/entry` cannot be resolved even though it is installed:** stop the existing Metro process and rerun **Mobile: Start Metro**. The checked-in task starts Expo with `--clear` so Metro rebuilds its file map after pnpm relinks `node_modules`. For a manual restart, run `pnpm exec expo start --dev-client --localhost --port 8081 --clear` from `apps/mobile`. Keep `main` set to `expo-router/entry`; no custom Metro configuration is required for this workspace.
- **8081 already in use:** reuse the existing Metro task; do not start a second Metro server. If an unrelated project owns it, stop that project's server first.
- **Unbound breakpoint:** check the file belongs to this workspace, execute the code path, and reload the app. Only one debugger should attach to the Hermes runtime at once.
- **Gray breakpoint after pressing F5:** first confirm `http://127.0.0.1:8081/json/list` returns the running Hermes target. Run **Mobile: Repair Expo Tools 1.6.3 debugger**, reload the VS Code window, and attach again. If the Debug Console reports `The \"path\" argument must be of type string. Received an instance of Object`, the local extension repair has not been loaded. If Metro reports `Connection from DevTools failed ... origin 'undefined'`, run `pnpm install`, stop and restart Metro with the checked-in task, reload the app, then press F5 again. Timely's exact-version development-middleware patch accepts the missing origin only for Expo-identified VS Code connections from loopback. If the debugger still cannot attach, use React Native DevTools (`j` in Metro); Expo documents VS Code integration as alpha and React Native DevTools as the stable breakpoint debugger.
- **Breakpoint opens a generated bundle:** keep `enableTurboSourcemaps: false` in the checked-in launch configuration. The experimental turbo source-map path fails against this Metro/VS Code combination; the normal source-map path resolves the original TypeScript file.
- **Inspect components/network:** disconnect the VS Code debugger, then press `j` in Metro to open React Native DevTools. Expo currently describes its VS Code integration as alpha; DevTools is the fallback.
- **Physical phone/Android emulator:** localhost points at that device. Use a reachable development API address and a LAN Metro server, or the appropriate Android host mapping. The checked-in tasks deliberately target the local iOS simulator.
- **Google missing on a configured development phone:** check `/api/v1/auth/providers` on the actual API address. Expo SDK 57's development virtual environment merges `.env.local` over shell `EXPO_PUBLIC_*` values; an API override can therefore keep the simulator's localhost address. Timely now resolves the API through public `extra.apiURL` in the Expo manifest, preserving the API address selected for each Metro process. Restart Metro and fully reload the app after this configuration change. A public manifest URL or a string found somewhere in a bundle does not prove the running auth client uses that URL. Apple still needs backend provider credentials; enabling its native entitlement alone does not enable sign-in.

Official reference: [Expo debugging tools](https://docs.expo.dev/debugging/tools/#debugging-with-vs-code).

## Connected physical iPhone development build

Keep the iPhone unlocked and paired/trusted, with Developer Mode enabled under Settings → Privacy & Security. Sign in to the owner's Apple account in Xcode → Settings → Apple Accounts. Xcode needs an available Apple Development identity and a provisioning profile for the development bundle ID and device. If signing reports **PLA Update available**, the account holder must accept the latest agreement at [Apple Developer](https://developer.apple.com/account/); an agent cannot accept that legal agreement on their behalf.

Use a trusted private local network for this development setup, with the phone and Mac reachable from one another. Local HTTP is permitted by the development app's local-network exception; published apps require the approved HTTPS backend. Phone `localhost` points to the phone. Use the Mac's `.local` hostname (`scutil --get LocalHostName`, followed by `.local`) for both API and Metro. Allow Timely's Local Network prompt on the phone and any macOS incoming-connection prompt. Keeping the USB cable attached provides installation/debugging access; the commands below serve the app over the local network.

The physical-device servers use separate ports to preserve the simulator setup. Substitute your current Mac hostname:

```sh
# Repository root; first prepare the backend with pnpm build after backend changes.
APP_ENV=local BETTER_AUTH_URL=http://alexeis-macbook-air.local:3002 \
  pnpm --filter @timely/web start --hostname 0.0.0.0 --port 3002

# Separate terminal, apps/mobile:
EXPO_PUBLIC_API_URL=http://alexeis-macbook-air.local:3002 \
  APP_VARIANT=development REACT_NATIVE_PACKAGER_HOSTNAME=alexeis-macbook-air.local \
  node --dns-result-order=ipv4first node_modules/expo/bin/cli \
  start --dev-client --clear --lan --port 8082
```

Discover the paired device with `xcrun devicectl list devices` and the Xcode destination with `xcrun xctrace list devices`. From `apps/mobile/ios`, build using the owner's signing team and device UDID (not simulator IDs):

```sh
EXPO_PUBLIC_API_URL=http://alexeis-macbook-air.local:3002 APP_VARIANT=development \
  RCT_METRO_PORT=8082 xcodebuild \
  -workspace Timelydevelopment.xcworkspace -scheme Timelydevelopment \
  -configuration Debug -sdk iphoneos -destination 'platform=iOS,id=YOUR_DEVICE_UDID' \
  -derivedDataPath /tmp/timely-physical-ios \
  DEVELOPMENT_TEAM=YOUR_TEAM_ID CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration build

xcrun devicectl device install app --device YOUR_COREDEVICE_ID \
  /tmp/timely-physical-ios/Build/Products/Debug-iphoneos/Timelydevelopment.app
xcrun devicectl device process launch --device YOUR_COREDEVICE_ID \
  --payload-url 'exp+timely://expo-development-client/?url=http%3A%2F%2Falexeis-macbook-air.local%3A8082' \
  com.example.timely.dev
```

Use the actual configured bundle identifier if it differs. Installation should update the same development app without uninstalling or clearing saved plans. If iOS asks to trust the developer, follow Settings → General → VPN & Device Management. Keep the Mac/backend/Metro running while testing. A Metro-dependent development app does not prove offline cold-start behavior with an embedded release bundle. See [Expo local iOS signing](https://docs.expo.dev/more/expo-cli/#ios-development-signing) and [Apple physical-device setup](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices).

Verified 2026-10-08: after the owner accepted Apple's agreement, the signed ARM64 Debug build installed and launched on the connected iPhone 15 (iOS 26.6.2). Metro on 8082 reports its Hermes runtime, and a public health request executed from that phone returns HTTP 200 from the backend on 3002. The signing profile includes the connected device and development debugging entitlement. This confirms installation and connectivity; provider sign-in, complete planner interaction, notifications and offline cold-start acceptance remain separate checks. The local backend uses Resend, so email codes arrive in the entered real inbox.

The updated signed build was subsequently installed and launched after reconnection. Its running auth module resolves `http://alexeis-macbook-air.local:3002`; the native Google module is available. A provider request from the phone returns HTTP 200 with Google enabled and Apple disabled, and native accessibility-state inspection confirms the Google button is visible and enabled. Google consent/token exchange remains to be exercised by the owner. Apple requires its backend credentials before its button becomes available.

## Run on iPhone without Metro

Use a Release build with embedded JavaScript. From `apps/mobile`, with the public provider configuration in the ignored `.env.local`:

```sh
EXPO_PUBLIC_API_URL=http://alexeis-macbook-air.local:3002 \
  APP_VARIANT=development EXPO_NO_DOTENV=1 \
  node --env-file=.env.local node_modules/expo/bin/cli prebuild --platform ios

EXPO_PUBLIC_API_URL=http://alexeis-macbook-air.local:3002 \
  APP_VARIANT=development EXPO_NO_DOTENV=1 \
  node --env-file=.env.local node_modules/expo/bin/cli run:ios \
  --configuration Release --no-bundler --device YOUR_DEVICE_UDID \
  --output /tmp/timely-standalone-ios
```

Alternatively, after loading the same environment, run `pnpm ios:standalone --device YOUR_DEVICE_UDID`. Use your Mac's actual `.local` hostname. `EXPO_NO_DOTENV=1` prevents Expo's environment loader from substituting the simulator's localhost address; Node loads the existing public Google IDs and URL scheme, while explicit shell values select the phone backend.

Open Timely directly from its home-screen icon. Metro runs during compilation to produce the embedded bundle, but no Metro server is needed to open or restart the installed app. Source changes require another build. The Mac/backend must remain reachable for sign-in, synchronization and the local remote-push worker; previously saved offline plans remain on the phone.

This build retains `APP_VARIANT=development`, `com.example.timely.dev`, the auth URL/storage prefix and existing signing team. Install over the existing app without uninstalling or clearing its storage. Development iOS configuration explicitly preserves local-network access and a backend-specific permission description in Release. Preview/production still require HTTPS; this is local development, not a store release. See [ADR 015](decisions/015-standalone-local-ios.md).

For EAS internal distribution, `eas build --platform ios --profile standalone` resolves a Release build with `developmentClient=false` and the same development identity. Configure the **development EAS environment** with the intended `EXPO_PUBLIC_API_URL`, public Google client IDs and `GOOGLE_IOS_URL_SCHEME` first: ignored `.env.local` does not travel to cloud builders. EAS requires a valid signing profile containing the intended iPhone. This profile has been validated with the installed EAS CLI schema; cloud distribution/signing remains separate from the local installed artifact.

## Verified setup (2026-10-01)

Expo Tools 1.6.3 attached to the iPhone simulator running the signed Debug configuration. Metro runs on `127.0.0.1:8081`. Reloading the app hit the solid editor breakpoint at `src/brand.tsx:3`, with the original TypeScript source, variables and call stack visible. The session was left paused there for the owner; F5 continues. Remove the sample breakpoint by clicking its gutter marker when finished.

After the Expo SDK 57 / React Native 0.86 upgrade, the development build requested its bundle on IPv4 while Node could bind `localhost` only on IPv6. The checked-in task now forces IPv4 DNS ordering, advertises `127.0.0.1`, and the debugger attaches to that same address. The local Expo Tools repair converts `project.root` from a VS Code URI to the filesystem string required by js-debug, and turbo source maps are disabled because the normal Metro map is the compatible path. Build log: `/tmp/timely-debug-build.log`; screenshot: `evidence/mobile-vscode-debugger.png`.
