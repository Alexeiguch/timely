import type { ExpoConfig } from 'expo/config';
const variant = process.env.APP_VARIANT ?? 'development';
const suffix = variant === 'production' ? '' : variant === 'preview' ? '.preview' : '.dev';
const scheme = variant === 'production' ? 'timely' : variant === 'preview' ? 'timely-preview' : 'timely-dev';
const config: ExpoConfig = {
  name: variant === 'production' ? 'Timely' : `Timely (${variant})`, slug: 'timely', version: '0.1.0', scheme,
  orientation: 'default', userInterfaceStyle: 'light',
  ios: { bundleIdentifier: `${process.env.APP_IDENTIFIER ?? 'com.example.timely'}${suffix}`, supportsTablet: true, usesAppleSignIn: true },
  android: { package: `${process.env.APP_IDENTIFIER ?? 'com.example.timely'}${suffix}` },
  plugins: ['expo-router', 'expo-secure-store', 'expo-apple-authentication', 'expo-notifications', ...(process.env.GOOGLE_IOS_URL_SCHEME ? [['@react-native-google-signin/google-signin', { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME }]] : [])] as ExpoConfig['plugins'],
  extra: { variant },
};
export default config;
