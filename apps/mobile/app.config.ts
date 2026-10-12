import type { ExpoConfig } from "expo/config";
const variant = process.env.APP_VARIANT ?? "development";
const suffix =
  variant === "production" ? "" : variant === "preview" ? ".preview" : ".dev";
const defaultScheme =
  variant === "production"
    ? "timely"
    : variant === "preview"
      ? "timely-preview"
      : "timely-dev";
const scheme = (process.env.APP_SCHEME ?? defaultScheme).replace(/:\/\/$/, "");
const name =
  process.env.APP_DISPLAY_NAME ??
  (variant === "production" ? "Timely" : `Timely (${variant})`);
const config: ExpoConfig = {
  name,
  slug: "timely",
  owner: "guchinale",
  version: "0.1.0",
  scheme,
  icon: "./assets/icon.png",
  orientation: "default",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: `${process.env.APP_IDENTIFIER ?? "com.example.timely"}${suffix}`,
    buildNumber: process.env.IOS_BUILD_NUMBER ?? "1",
    supportsTablet: true,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      ...(variant === "development"
        ? {
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: false,
              NSAllowsLocalNetworking: true,
            },
            NSLocalNetworkUsageDescription:
              "Timely connects to the planner backend on your Mac for sign-in and sync during local development.",
          }
        : {}),
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      monochromeImage: "./assets/monochrome-icon.png",
      backgroundColor: "#E9FF72",
    },
    package: `${process.env.APP_IDENTIFIER ?? "com.example.timely"}${suffix}`,
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 112,
        resizeMode: "contain",
        backgroundColor: "#FAF9F1",
      },
    ],
    "expo-router",
    "expo-secure-store",
    "expo-apple-authentication",
    "expo-notifications",
    "./plugins/with-expo-sqlite-ios",
    ...(process.env.GOOGLE_IOS_URL_SCHEME
      ? [
          [
            "@react-native-google-signin/google-signin",
            { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME },
          ],
        ]
      : []),
  ] as ExpoConfig["plugins"],
  extra: {
    variant,
    apiURL: process.env.EXPO_PUBLIC_API_URL,
    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
        "ccd23170-5d7c-4937-8cb1-9a42ab67ccf4",
    },
  },
};
export default config;
