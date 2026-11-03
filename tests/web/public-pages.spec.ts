import { test, expect } from "@playwright/test";

test("public help pages work signed out in both languages and lead to web deletion", async ({ page }) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/api/")) mutations.push(request.url());
  });
  const response = await page.goto("/privacy");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("'nonce-");
  await expect(page.getByRole("heading", { name: "Política de privacidad", exact: true })).toBeVisible();
  await expect(page.getByText("Borrador: pendiente de revisión del responsable")).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Support", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Help with your planner" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Help with your planner" })).toBeVisible();
  await page.getByRole("link", { name: "Account deletion", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delete your Timely account" })).toBeVisible();
  await expect(page.getByText(/without reinstalling the mobile app/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/timely-deletion-${test.info().project.name}.png`, fullPage: true });
  expect(mutations).toEqual([]);
  await page.locator(".public-page-action").click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.getByRole("link", { name: "Privacy policy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Privacy policy", exact: true })).toBeVisible();
});
