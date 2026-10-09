const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function hostname(request: Request) {
  try {
    return new URL(request.url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return "";
  }
}

/** Unsigned dev mode never overrides a configured signing key. */
export function inngestDevMode(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.APP_ENV === "local" &&
    env.INNGEST_DEV === "1" &&
    !env.INNGEST_SIGNING_KEY?.trim()
  );
}

/**
 * Hosted invocations require a signing key, which the Inngest SDK verifies.
 * Unsigned dev mode accepts only a loopback request URL. Next derives that
 * URL from the Host header, which a client can spoof, so INNGEST_DEV=1 still
 * must not be set on a network-reachable server.
 */
export function inngestRequestAllowed(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.INNGEST_SIGNING_KEY?.trim()) return true;
  return inngestDevMode(env) && loopbackHosts.has(hostname(request));
}
