import { expect, it } from "vitest";
import {
  securityHeaders,
  contentSecurityPolicy,
  createSecurityHeaders,
} from "../apps/web/security-headers";

it("frames no page and refuses content-type sniffing", () => {
  const headers = Object.fromEntries(
    securityHeaders.map((header) => [header.key, header.value]),
  );
  expect(headers["X-Frame-Options"]).toBe("DENY");
  expect(headers["Content-Security-Policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["Permissions-Policy"]).toContain("camera=()");
});

it("restricts scripts with a rendering nonce and keeps development eval out of production", () => {
  const policy = contentSecurityPolicy("syntheticNonce");
  expect(policy).toContain(
    "script-src 'self' 'nonce-syntheticNonce' 'strict-dynamic'",
  );
  expect(policy).not.toContain("unsafe-eval");
  expect(
    policy.split(";").find((entry) => entry.trim().startsWith("script-src")),
  ).not.toContain("unsafe-inline");
  expect(contentSecurityPolicy("test", true)).toContain("unsafe-eval");
});
it("enables HSTS for production without imposing it on local development", () => {
  expect(createSecurityHeaders(true)).toContainEqual({
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  });
  expect(
    createSecurityHeaders(false).some(
      (header) => header.key === "Strict-Transport-Security",
    ),
  ).toBe(false);
});
