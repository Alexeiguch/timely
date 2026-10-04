import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { Platform, TurboModuleRegistry } from "react-native";

const googleSignInNativeModuleName = "RNGoogleSignin";

export function isGoogleSignInAvailable() {
  return TurboModuleRegistry.get(googleSignInNativeModuleName) !== null;
}

async function loadGoogleSignIn() {
  if (!isGoogleSignInAvailable()) {
    throw new Error(
      "Google sign-in is not included in this app binary. Install a fresh Timely development build; Expo Go is not supported.",
    );
  }

  return import("@react-native-google-signin/google-signin");
}

export const apiURL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const scheme = Constants.expoConfig?.scheme;
export const authClient = createAuthClient({
  baseURL: apiURL,
  plugins: [
    emailOTPClient(),
    expoClient({
      scheme: typeof scheme === "string" ? scheme : "timely-dev",
      storagePrefix: `timely-auth.${apiURL.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      storage: SecureStore,
    }),
  ],
});
export async function signInGoogle() {
  if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
    throw new Error("Google sign-in is not configured");
  const { GoogleSignin, isSuccessResponse } = await loadGoogleSignIn();
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) return;
  if (!result.data.idToken)
    throw new Error("Google did not return an identity token");
  const response = await authClient.signIn.social({
    provider: "google",
    idToken: { token: result.data.idToken },
  });
  if (response.error) throw new Error(response.error.message);
}
export async function signInApple() {
  if (Platform.OS !== "ios") {
    const response = await authClient.signIn.social({
      provider: "apple",
      callbackURL: "/",
    });
    if (response.error) throw new Error(response.error.message);
    return;
  }
  const nonce = Crypto.randomUUID();
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce,
  });
  if (!credential.identityToken)
    throw new Error("Apple did not return an identity token");
  const result = await authClient.signIn.social({
    provider: "apple",
    idToken: { token: credential.identityToken, nonce },
  });
  if (result.error) throw new Error(result.error.message);
}
export async function authenticatedFetch(path: string, init?: RequestInit) {
  return fetch(`${apiURL}${path}`, {
    ...init,
    credentials: "omit",
    headers: { ...init?.headers, Cookie: await authClient.getCookie() },
  });
}
