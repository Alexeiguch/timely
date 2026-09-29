import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
test.use({ actionTimeout: 10000, navigationTimeout: 15000 });
async function signIn(context: BrowserContext, email: string) {
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const sent = await context.request.post(
    `${base}/api/auth/email-otp/send-verification-otp`,
    { headers: { Origin: base }, data: { email, type: "sign-in" } },
  );
  expect(sent.ok()).toBe(true);
  let message: { ID: string } | undefined;
  await expect
    .poll(async () => {
      const messages = await (
        await context.request.get("http://127.0.0.1:8025/api/v1/messages")
      ).json();
      message = messages.messages.find(
        (m: { To: Array<{ Address: string }> }) =>
          m.To.some((r) => r.Address === email),
      );
      return !!message;
    })
    .toBe(true);
  const content = await (
    await context.request.get(
      `http://127.0.0.1:8025/api/v1/message/${message!.ID}`,
    )
  ).json();
  const otp = content.Text.match(/code is (\d{6})/)?.[1];
  if (!otp) throw new Error("No delivered verification code");
  const signed = await context.request.post(
    `${base}/api/auth/sign-in/email-otp`,
    { headers: { Origin: base }, data: { email, otp } },
  );
  expect(signed.ok()).toBe(true);
}
async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill(title);
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}
test.beforeEach(async ({ context }) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
  });
});
test("offline reload retains edits, reconnect syncs another client, and recurrence remains actionable", async ({
  page,
  context,
  browser,
}, info) => {
  test.setTimeout(60000);
  page.on("pageerror", (error) =>
    console.log("Planner runtime error:", error.message),
  );
  const email = `planner-proof-${randomUUID()}@example.test`;
  await signIn(context, email);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your day, your pace." }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Synced");
  await create(page, "Make room for a walk");
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await create(page, "A plan saved offline");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "A plan saved offline" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Offline");
  await page
    .getByRole("checkbox", { name: "Complete A plan saved offline" })
    .click();
  await expect(
    page.getByText("Completed & skipped (1)", { exact: true }),
  ).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Completed & skipped (1)", { exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Complete A plan saved offline" }),
  ).toBeChecked();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Synced");
  const second = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
  });
  try {
    await signIn(second, email);
    const other = await second.newPage();
    await other.goto("/");
    await expect(
      other.getByRole("heading", { name: "Make room for a walk" }),
    ).toBeVisible();
    await other.getByText("Completed & skipped (1)", { exact: true }).click();
    await expect(
      other.getByRole("checkbox", { name: "Complete A plan saved offline" }),
    ).toBeChecked();
  } finally {
    await second.close();
  }
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("Ten minutes to reset");
  await page
    .getByRole("combobox", { name: "Frequency", exact: true })
    .selectOption("daily");
  await expect(page.getByText(/Next dates:/)).toContainText("·");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ten minutes to reset" }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/planner-day-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Edit Ten minutes to reset" }).click();
  await page.getByLabel("Task title").fill("A moment for yourself");
  await page
    .getByRole("combobox", { name: "Apply changes to" })
    .selectOption("future");
  await page.screenshot({
    path: `docs/evidence/planner-editor-${info.project.name}.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A moment for yourself" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Week", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.screenshot({
    path: `docs/evidence/planner-month-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("anonymous, wrong-account and cross-origin sync requests are rejected", async ({
  context,
}) => {
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  expect(
    (
      await context.request.post(`${base}/api/v1/sync/bootstrap`, { data: {} })
    ).status(),
  ).toBe(401);
  await signIn(context, `boundary-${randomUUID()}@example.test`);
  expect(
    (
      await context.request.post(`${base}/api/v1/sync/bootstrap`, {
        headers: { "X-Timely-Account": "someone-else" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post(`${base}/api/v1/sync/bootstrap`, {
        headers: { Origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await context.request.post(`${base}/api/v1/sync/bootstrap`, {
        data: { ownerId: "someone-else" },
      })
    ).status(),
  ).toBe(400);
});
test("moving, skipping and excluding an occurrence preserves its identity", async ({
  page,
  context,
}) => {
  await signIn(context, `actions-${randomUUID()}@example.test`);
  await page.goto("/");
  await create(page, "A movable little plan");
  const card = page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "A movable little plan" }),
    });
  const id = await card.getAttribute("data-task-id");
  await card.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A movable little plan" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Next period" }).click();
  await expect(card).toHaveAttribute("data-task-id", id!);
  await card.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByText("Completed & skipped (1)", { exact: true }),
  ).toBeVisible();
  await page.getByText("Completed & skipped (1)", { exact: true }).click();
  await card.getByRole("button", { name: "Unskip", exact: true }).click();
  await expect(
    page.getByText("Completed & skipped (1)", { exact: true }),
  ).not.toBeVisible();
  await expect(card).toHaveAttribute("data-task-id", id!);
  await card
    .getByRole("button", { name: "Delete A movable little plan" })
    .click();
  await expect(
    page.getByRole("heading", { name: "A movable little plan" }),
  ).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.reload();
  await page.getByRole("button", { name: "Next period" }).click();
  await expect(
    page.getByRole("heading", { name: "A movable little plan" }),
  ).not.toBeVisible();
});
