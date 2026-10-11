// pnpm 10.7 auto-installed optional peers can escape overrides. Constrain the
// original peer ranges before resolution to Expo 57's bundled native matrix.
module.exports = {
  hooks: {
    readPackage(pkg) {
      if ((pkg.name === "expo-router" && pkg.version === "57.0.25") ||
          (pkg.name === "react-native-drawer-layout" && pkg.version === "4.2.11")) {
        pkg.peerDependencies = { ...pkg.peerDependencies, "react-native-reanimated": "4.5.1" };
      }
      return pkg;
    },
  },
};
