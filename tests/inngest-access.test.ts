import { expect, it } from "vitest";
import {
  inngestDevMode,
  inngestRequestAllowed,
} from "../apps/web/server/inngest-access";

const local = { APP_ENV: "local", INNGEST_DEV: "1" };

it("keeps a signing key ahead of unsigned dev mode", () => {
  expect(inngestDevMode(local)).toBe(true);
  expect(inngestDevMode({ ...local, INNGEST_SIGNING_KEY: " sign-key " })).toBe(
    false,
  );
  expect(
    inngestRequestAllowed(new Request("https://timely.example/api/inngest"), {
      ...local,
      INNGEST_SIGNING_KEY: "sign-key",
    }),
  ).toBe(true);
});

it("accepts unsigned dev mode only from a loopback host", () => {
  expect(
    inngestRequestAllowed(new Request("http://localhost:3001/api/inngest"), local),
  ).toBe(true);
  expect(
    inngestRequestAllowed(
      new Request("http://[::1]:3001/api/inngest", { headers: { host: "[::1]:3001" } }),
      local,
    ),
  ).toBe(true);
  expect(
    inngestRequestAllowed(
      new Request("http://alexeis-macbook-air.local:3002/api/inngest", {
        headers: { host: "alexeis-macbook-air.local:3002" },
      }),
      local,
    ),
  ).toBe(false);
  expect(
    inngestRequestAllowed(new Request("https://timely.example/api/inngest"), {
      APP_ENV: "production",
      INNGEST_DEV: "1",
    }),
  ).toBe(false);
});
