import { expect, it } from "vitest";
import { securityHeaders } from "../apps/web/security-headers";

it("frames no page and refuses content-type sniffing", () => {
  const headers = Object.fromEntries(
    securityHeaders.map((header) => [header.key, header.value]),
  );
  expect(headers["X-Frame-Options"]).toBe("DENY");
  expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["Permissions-Policy"]).toContain("camera=()");
});
