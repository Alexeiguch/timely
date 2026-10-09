import { expect, it } from "vitest";
import { acceptedApiUrl } from "../apps/mobile/src/api-url";

it("allows development cleartext only for loopback, the emulator and .local", () => {
  expect(acceptedApiUrl("http://localhost:3001", "development")).toBe(
    "http://localhost:3001",
  );
  expect(acceptedApiUrl("http://10.0.2.2:3001", "development")).toBe(
    "http://10.0.2.2:3001",
  );
  expect(
    acceptedApiUrl("http://alexeis-macbook-air.local:3002", "development"),
  ).toBe("http://alexeis-macbook-air.local:3002");
  expect(() =>
    acceptedApiUrl("http://192.168.1.20:3001", "development"),
  ).toThrow("HTTPS");
  expect(() => acceptedApiUrl("not a url", "development")).toThrow(
    "EXPO_PUBLIC_API_URL",
  );
});

it("requires HTTPS for preview and production builds", () => {
  expect(acceptedApiUrl("https://timely.example", "production")).toBe(
    "https://timely.example",
  );
  expect(() =>
    acceptedApiUrl("http://localhost:3001", "preview"),
  ).toThrow("HTTPS");
  expect(() =>
    acceptedApiUrl("http://alexeis-macbook-air.local:3002", "production"),
  ).toThrow("HTTPS");
});
