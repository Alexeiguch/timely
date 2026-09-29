import { test, expect } from "@playwright/test";

test("serves browser icons and advertises only configured social providers", async ({
  page,
  request,
  context,
}) => {
  const favicon = await request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
  const bytes = await favicon.body();
  expect(bytes.readUInt16LE(0)).toBe(0);
  expect(bytes.readUInt16LE(2)).toBe(1);
  expect(bytes.readUInt16LE(4)).toBe(3);
  const svg = await request.get("/icon.svg");
  expect(svg.status()).toBe(200);
  expect(svg.headers()["content-type"]).toContain("image/svg+xml");

  const response = await request.get("/api/v1/auth/providers");
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const providers = await response.json();
  expect(Object.keys(providers).sort()).toEqual(["apple", "google"]);
  expect(typeof providers.google).toBe("boolean");
  expect(typeof providers.apple).toBe("boolean");

  const socialRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/auth/sign-in/social"))
      socialRequests.push(req.url());
  });
  await page.goto("/");
  await expect(page.getByText("Checking sign-in options…")).not.toBeVisible();
  for (const provider of ["google", "apple"] as const) {
    const button = page.getByRole("button", {
      name: `Continue with ${provider === "google" ? "Google" : "Apple"}`,
    });
    if (providers[provider]) await expect(button).toBeEnabled();
    else await expect(button).toBeDisabled();
  }
  if (!providers.google && !providers.apple)
    await expect(
      page.getByText(
        "Google and Apple sign-in is not available here yet. Use your email to sign in.",
      ),
    ).toBeVisible();
  expect(socialRequests).toEqual([]);
  const icons = await page
    .locator('link[rel="icon"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href")),
    );
  expect(icons.some((href) => href?.startsWith("/favicon.ico"))).toBe(true);
  expect(icons.some((href) => href?.startsWith("/icon.svg"))).toBe(true);
  await expect(
    page.getByRole("button", { name: "Send me a code" }),
  ).toBeEnabled();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  expect(
    await page.evaluate(
      async () => (await fetch("/favicon.ico?offline-check")).status,
    ),
  ).toBe(200);
  expect(
    await page.evaluate(
      async () => (await fetch("/icon.svg?offline-check")).status,
    ),
  ).toBe(200);
});

test("keeps email usable when availability lookup fails and recovers on retry", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/providers", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText(
      "Social sign-in is unavailable right now. Try again, or use your email.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Send me a code" }),
  ).toBeEnabled();
  await page.unroute("**/api/v1/auth/providers");
  await page.getByRole("button", { name: "Retry sign-in options" }).click();
  await expect(
    page.getByText(
      "Social sign-in is unavailable right now. Try again, or use your email.",
    ),
  ).not.toBeVisible();
  await expect(page.getByText("Checking sign-in options…")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry sign-in options" }),
  ).not.toBeVisible();
});
