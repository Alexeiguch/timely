type AppleEnvironment = {
  [key: string]: string | undefined;
  APPLE_SERVICE_ID?: string;
  APPLE_CLIENT_SECRET?: string;
  APPLE_BUNDLE_ID?: string;
};

export function appleConfiguration(env: AppleEnvironment) {
  const bundle = env.APPLE_BUNDLE_ID?.trim();
  const service = env.APPLE_SERVICE_ID?.trim();
  const secret = env.APPLE_CLIENT_SECRET?.trim();
  const browser = Boolean(service && secret);
  if (!bundle && !browser) return undefined;

  // Native ID-token verification needs the registered audience, not a web OAuth secret.
  return {
    clientId: browser ? service! : bundle!,
    ...(browser ? { clientSecret: secret } : {}),
    ...(bundle ? { appBundleIdentifier: bundle } : {}),
    audience: [browser ? service : undefined, bundle].filter(
      (value): value is string => Boolean(value),
    ),
  };
}
