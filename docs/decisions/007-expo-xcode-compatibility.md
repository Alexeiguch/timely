# 007 — Expo SDK 57 local builds on Xcode 26.2

Date: 2026-10-01

Keep the mobile application on its approved Expo SDK 57 dependency set. Local iOS builds use Xcode 26.2 / Swift 6.2+, which exposes upstream strict-interop and strict-concurrency errors in `expo-modules-jsi@57.1.1` and `expo-modules-core@57.0.20`. Expo tracks the JSI failure in [expo/expo#50067](https://github.com/expo/expo/issues/50067); changing Timely application code cannot correct these package-source errors.

Use pnpm `patchedDependencies`, scoped to those exact versions, until Expo publishes compatible SDK 57 patch releases. The JSI patch removes invalid `SWIFT_RETURNS_RETAINED` annotations from C++ constructors and wraps eight non-Sendable pointer/run-loop captures with the package's existing `NonisolatedUnsafeVar`. The core patch replaces two weak `EventEmitter` captures with the package's existing `NonisolatedUnsafeWeakVar`. Both wrappers already document the same intentional synchronous/weak lifetime escape inside their respective packages; the patches do not change Timely runtime behavior or disable Swift concurrency checking globally.

The patch files are committed under `patches/`, and their hashes are locked in `pnpm-lock.yaml`. Remove each patch only after upgrading to an Expo package release that contains the equivalent upstream fix and after rerunning the signed local iOS build.

Verification on Xcode 26.2: `pnpm exec expo run:ios --no-bundler` completes the Debug simulator build with zero errors, signs the app, installs it on iPhone 16e, and attempts to open it. The final Simulator foreground action is blocked by the host's AppleScript/System Events permission after installation; this is not a compiler or application-install failure. Mobile TypeScript passes. Expo Doctor reaches 20/21 checks but reports the monorepo's existing peer-variant duplicates; that dependency-graph cleanup is separate from this compiler compatibility fix.
