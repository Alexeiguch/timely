# Debug Timely in VS Code

Open the repository root or `apps/mobile`; both folders have matching VS Code configurations. The installed **Expo Tools** extension (`expo.vscode-expo-tools`) supplies the Hermes debugger. The Microsoft React Native Tools run button uses a different workflow; use the named Timely configuration below.

## First setup

1. Start the local backend on port 3001 if it is not already running. From the repository root: `APP_ENV=local BETTER_AUTH_URL=http://localhost:3001 pnpm --filter @timely/web dev --port 3001`. Local Postgres and Mailpit must be running for email sign-in. See `setup.md`.
2. In VS Code, open the Command Palette (`Cmd+Shift+P`), choose **Tasks: Run Task**, then **Mobile: Start Metro**. Keep this terminal running. It uses port 8081 and sets the simulator API address to `http://localhost:3001`.
3. Run **Mobile: Build iOS development app** once to install a Debug build in the simulator. This may take several minutes initially. Rebuild after adding native packages or changing native configuration. The earlier Release build used for visual QA cannot expose the development debugger.
4. Open Timely in the simulator. If the Expo development launcher appears, connect to `http://localhost:8081`.
5. Open **Run and Debug** (`Cmd+Shift+D`), select **Timely: Debug mobile (Expo / Hermes)**, and press **F5** (or the green play button). Choose the running iOS Hermes target if prompted.

## Daily use

Run Metro, open the installed development app, and press F5. Set breakpoints by clicking beside source line numbers. Reproduce the action in the app; VS Code shows Variables, Call Stack, and Watch when execution pauses. F10 steps over, F11 steps into, Shift+F11 steps out, and F5 continues. On a Mac keyboard, you may need the Fn key for function keys.

Useful source locations:

- `apps/mobile/src/brand.tsx`: a harmless render breakpoint; reload to hit it.
- `apps/mobile/src/sign-in.tsx`: sign-in form handling. Avoid copying authentication codes/session values into logs.
- `apps/mobile/src/planner-provider.tsx`: task actions and synchronization.
- `packages/sync/src/engine.ts`: shared local-save/push/pull behavior; opening the repository root makes shared code easier to navigate.

Saved JavaScript/TypeScript changes use Fast Refresh. Metro serves the native JavaScript bundle on **8081**; the application API is on **3001**. The debugger attaches through Metro, not the API port.

## Troubleshooting

- **No app/target found:** install the Debug build, open it, and connect it to Metro. A Release binary does not become debuggable merely because Metro is running.
- **`opn` not found / bare React Native CLI errors:** select the Timely Expo configuration instead of Microsoft React Native Tools' direct-iOS action. This project does not need `npx react-native run-ios` or a separate `@react-native-community/cli` dependency for Expo debugging.
- **8081 already in use:** reuse the existing Metro task; do not start a second Metro server. If an unrelated project owns it, stop that project's server first.
- **Unbound breakpoint:** check the file belongs to this workspace, execute the code path, and reload the app. Only one debugger should attach to the Hermes runtime at once.
- **Inspect components/network:** disconnect the VS Code debugger, then press `j` in Metro to open React Native DevTools. Expo currently describes its VS Code integration as alpha; DevTools is the fallback.
- **Physical phone/Android emulator:** localhost points at that device. Use a reachable development API address and a LAN Metro server, or the appropriate Android host mapping. The checked-in tasks deliberately target the local iOS simulator.

Official reference: [Expo debugging tools](https://docs.expo.dev/debugging/tools/#debugging-with-vs-code).

## Verified setup (2026-09-30)

Expo Tools 1.6.3 attached to the iPhone 17 Pro simulator running the signed Debug configuration. Metro runs in the VS Code **Mobile: Start Metro** task. Reloading the app hit the editor breakpoint at `src/brand.tsx:4`, with the original TypeScript source and call stack visible. The session was left paused there for the owner; F5 continues. Remove the sample breakpoint by clicking its gutter marker when finished.

The local Metro server bound to the IPv6 localhost interface, so the configurations use `bundlerHost: localhost` and explicitly advertise `REACT_NATIVE_PACKAGER_HOSTNAME=localhost`. `127.0.0.1` did not reach this server. Build log: `/tmp/timely-debug-build.log`; screenshot: `evidence/mobile-vscode-debugger.png`.
