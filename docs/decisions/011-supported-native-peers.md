# Supported Expo 57 native peer resolution

The installed Expo 57 bundled matrix specifies Worklets 0.10.1 and Reanimated 4.5.1. The previous lockfile automatically selected 0.13.0 and 4.7.0 through optional peers. Mobile now declares the supported versions explicitly, with React Native Metro config 0.86.3 and React types 19.2.18. The React Native CLI is pinned to 20.2.0 rather than `latest`.

pnpm 10.7's optional-peer selection can escape package overrides in other workspaces. The root `.pnpmfile.cjs` narrows the original peer ranges for the exact installed Expo Router/Drawer versions before dependency resolution. Global overrides retain the native matrix, and the committed lockfile is regenerated with those manifests. This prevents unsupported copies without replacing the package manager or weakening peer validation. The hook uses pnpm's documented `readPackage` API: <https://pnpm.io/10.x/pnpmfile>.

After changing native resolution, install with the frozen lockfile, regenerate pods/native linking, clear Metro, run Expo Doctor and exports, and rebuild native artifacts. A build from the previous graph is recorded separately from the final graph's results. Existing exact-version Swift and debugger patches remain applied.
