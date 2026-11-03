import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { apple } from "better-auth/social-providers";
import { verifyProviderIdToken } from "better-auth/oauth2";
import { appleConfiguration } from "./apple";

const bundle = "com.example.timely.dev";
const service = "com.example.timely.web";
const nonce = "synthetic-per-attempt-nonce";
const hash = createHash("sha256").update(nonce).digest("hex");
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        keys: [
          {
            ...publicKey.export({ format: "jwk" }),
            kid: "test-apple-key",
            alg: "RS256",
          },
        ],
      }),
    ),
  );
});
afterEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

function token(claims: Record<string, unknown> = {}, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "RS256", kid: "test-apple-key" })}.${encode({
    sub: "synthetic-apple-user",
    iss: "https://appleid.apple.com",
    aud: bundle,
    iat: now,
    exp: now + 300,
    nonce: hash,
    email: "synthetic@privaterelay.appleid.com",
    email_verified: "true",
    ...claims,
  })}`;
  return `${body}.${sign("RSA-SHA256", Buffer.from(body), key).toString("base64url")}`;
}

it("enables native Apple ID-token verification with only the registered bundle ID", () => {
  const config = appleConfiguration({ APPLE_BUNDLE_ID: bundle })!;
  expect(config.clientId).toBe(bundle);
  expect(config.clientSecret).toBeUndefined();
  expect(config.appBundleIdentifier).toBe(bundle);
  expect(config.audience).toEqual([bundle]);
  expect(appleConfiguration({})).toBeUndefined();
  expect(appleConfiguration({ APPLE_SERVICE_ID: service })).toBeUndefined();
  expect(
    appleConfiguration({ APPLE_CLIENT_SECRET: "synthetic-secret" }),
  ).toBeUndefined();
});

it("keeps browser Apple unavailable until both browser credentials are present", async () => {
  const config = appleConfiguration({
    APPLE_BUNDLE_ID: bundle,
    APPLE_SERVICE_ID: service,
  })!;
  expect(config.audience).toEqual([bundle]);
  await expect(
    apple(config).createAuthorizationURL({
      state: "synthetic-state",
      redirectURI: "https://planner.test/api/auth/callback/apple",
      codeVerifier: "synthetic-verifier",
    }),
  ).rejects.toThrow();
  const browser = appleConfiguration({
    APPLE_SERVICE_ID: service,
    APPLE_CLIENT_SECRET: "synthetic-secret",
    APPLE_BUNDLE_ID: bundle,
  })!;
  expect(browser.audience).toEqual([service, bundle]);
  const url = await apple(browser).createAuthorizationURL({
    state: "synthetic-state",
    redirectURI: "https://planner.test/api/auth/callback/apple",
    codeVerifier: "synthetic-verifier",
  });
  expect(url.searchParams.get("client_id")).toBe(service);
});

it("verifies signed native tokens, hashed nonces and private relay with the installed Better Auth verifier", async () => {
  const provider = apple(appleConfiguration({ APPLE_BUNDLE_ID: bundle })!);
  expect(await verifyProviderIdToken(provider, token(), nonce)).toBe(true);
  expect(await verifyProviderIdToken(provider, token({ nonce }), nonce)).toBe(
    true,
  );
  const user = await provider.getUserInfo({ idToken: token() });
  expect(user?.user.email).toBe("synthetic@privaterelay.appleid.com");
  expect(user?.user.emailVerified).toBe(true);
});

it("rejects other apps, services, issuers, expired tokens, nonce mismatches and forged signatures", async () => {
  const provider = apple(appleConfiguration({ APPLE_BUNDLE_ID: bundle })!);
  for (const claims of [
    { aud: "com.other.app" },
    { aud: service },
    { iss: "https://attacker.test" },
    { exp: 1 },
    { nonce: "wrong-nonce" },
  ])
    expect(await verifyProviderIdToken(provider, token(claims), nonce)).toBe(
      false,
    );
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  expect(await verifyProviderIdToken(provider, token({}, other), nonce)).toBe(
    false,
  );
});
