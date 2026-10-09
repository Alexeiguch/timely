function developmentHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "10.0.2.2" ||
    hostname.endsWith(".local")
  );
}

/** Preview and production builds refuse a cleartext API. Development allows loopback, the emulator alias and .local only. */
export function acceptedApiUrl(value: string, variant: unknown) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Set EXPO_PUBLIC_API_URL to the planner backend.");
  }
  const development = variant !== "production" && variant !== "preview";
  if (url.protocol === "https:") return value;
  if (development && url.protocol === "http:" && developmentHost(url.hostname))
    return value;
  throw new Error("This build requires an HTTPS API address.");
}
