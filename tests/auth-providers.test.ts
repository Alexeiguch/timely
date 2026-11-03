import { afterEach, expect, it, vi } from "vitest";
import { appleConfiguration } from "../packages/auth/src/apple";

const options = vi.hoisted(() => ({
  socialProviders: {} as {
    apple?: ReturnType<typeof appleConfiguration>;
    google?: { clientId: string; clientSecret: string };
  },
}));
vi.mock("../packages/auth/src/server", () => ({ auth: () => ({ options }) }));
import { GET } from "../apps/web/app/api/v1/auth/providers/route";
afterEach(() => {
  options.socialProviders = {};
});

it("advertises native Apple without exposing an unavailable browser flow or credentials", async () => {
  options.socialProviders.apple = appleConfiguration({
    APPLE_BUNDLE_ID: "com.example.timely.dev",
  });
  const response = await GET();
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    google: false,
    apple: false,
    appleNative: true,
  });
});

it("advertises configured browser providers while keeping all their values private", async () => {
  options.socialProviders.apple = appleConfiguration({
    APPLE_BUNDLE_ID: "com.example.timely.dev",
    APPLE_SERVICE_ID: "com.example.timely.web",
    APPLE_CLIENT_SECRET: "synthetic-apple-secret",
  });
  options.socialProviders.google = {
    clientId: "synthetic-client",
    clientSecret: "synthetic-google-secret",
  };
  expect(await (await GET()).json()).toEqual({
    google: true,
    apple: true,
    appleNative: true,
  });
});

it("leaves every provider unavailable when no credentials or bundle audience are configured", async () => {
  expect(await (await GET()).json()).toEqual({
    google: false,
    apple: false,
    appleNative: false,
  });
});
