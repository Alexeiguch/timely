import { test, expect } from "@playwright/test";
test("uses fresh rendering nonces and enforces the production script policy", async ({
  page,
  request,
}) => {
  const first = await request.get("/");
  const second = await request.get("/");
  const firstPolicy = first.headers()["content-security-policy"]!;
  const secondPolicy = second.headers()["content-security-policy"]!;
  expect(firstPolicy).toContain("script-src 'self' 'nonce-");
  expect(firstPolicy).not.toContain("unsafe-eval");
  expect(firstPolicy).not.toBe(secondPolicy);
  expect(first.headers()["strict-transport-security"]).toBe("max-age=31536000");
  // Inject into the HTTP document so the browser parser, rather than privileged
  // automation evaluation, exercises the script policy.
  await page.route("**/", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "</head>",
      '<script id="injected-script">document.documentElement.dataset.injectedScript = "executed"</script></head>',
    );
    await route.fulfill({ response, body });
  });
  const response = await page.goto("/");
  const pagePolicy = response!.headers()["content-security-policy"]!;
  const nonce = pagePolicy.match(/'nonce-([^']+)'/)![1]!;
  const scripts = await page
    .locator("script:not(#injected-script)")
    .evaluateAll((elements) =>
      elements.map((element) => (element as HTMLScriptElement).nonce),
    );
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((value) => value === nonce)).toBe(true);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-injected-script",
    "executed",
  );
  await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
});
