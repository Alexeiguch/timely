import { test, expect, type Page, type BrowserContext } from "@playwright/test";
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() =>
    localStorage.setItem("timely-language", "en"),
  );
});
import { randomUUID } from "node:crypto";
test.use({ actionTimeout: 10000, navigationTimeout: 15000 });
async function signIn(context: BrowserContext, email: string) {
  await context.addInitScript(() =>
    localStorage.setItem("timely-language", "en"),
  );
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
  const otp = content.Text.match(/(?:code is|es) (\d{6})/)?.[1];
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
test("friendly duration and weekdays survive reload, and month markers follow swipe navigation", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signIn(context, `editor-proof-${randomUUID()}@example.test`);
  await page.goto("/?date=2026-10-09&mode=Day");
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("A friendly weekday plan");
  await page.getByRole("button", { name: "Add optional details" }).click();
  await page
    .getByRole("button", { name: "Duration: 1 h", exact: true })
    .click();
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page.getByLabel("Days", { exact: true }).selectOption("7");
  await expect(page.locator(".duration-custom strong")).toHaveText("7 d");
  await page.getByLabel("Days", { exact: true }).selectOption("1");
  await page.getByLabel("Hours", { exact: true }).selectOption("1");
  await page.getByLabel("Minutes", { exact: true }).selectOption("1");
  await expect(page.locator(".duration-custom strong")).toHaveText(
    "1 d 1 h 1 min",
  );
  await page
    .getByRole("combobox", { name: "Frequency", exact: true })
    .selectOption("weekdays");
  await expect(
    page.getByRole("combobox", { name: "Frequency", exact: true }),
  ).toHaveValue("weekdays");
  await page.getByLabel("Track a streak").check();
  await expect(
    page.getByText("Keep your fire going.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.locator(".streak-fire").evaluate((element) =>
          [...element.querySelectorAll("*")]
            .flatMap((child) => child.getAnimations())
            .map((animation) => ({
              state: animation.playState,
              iterations: animation.effect?.getComputedTiming().iterations,
            })),
        ),
      { timeout: 6000 },
    )
    .toEqual([
      { state: "finished", iterations: 3 },
      { state: "finished", iterations: 3 },
      { state: "finished", iterations: 3 },
    ]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".streak-flame")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "A friendly weekday plan", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.reload();
  const card = page.locator("article.task-card").filter({
    has: page.getByRole("heading", {
      name: "A friendly weekday plan",
      exact: true,
    }),
  });
  await card
    .getByRole("button", { name: "Edit A friendly weekday plan", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Frequency", exact: true }),
  ).toHaveValue("weekdays");
  await expect(page.getByLabel("Days", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("Hours", { exact: true })).toHaveValue("1");
  await expect(page.getByLabel("Minutes", { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Month", exact: true }).click();
  const grid = page.locator(".month-grid");
  const friday = grid.getByRole("button", {
    name: "9 October, 1 tasks",
    exact: true,
  });
  await expect(friday.locator(".task-count")).toHaveText("1");
  await expect(
    grid
      .getByRole("button", { name: "10 October, 0 tasks", exact: true })
      .locator(".task-count"),
  ).toHaveCount(0);
  const swipeMonth = async (
    from: [number, number],
    through: [number, number],
  ) => {
    await grid.evaluate(
      (element, { from, through }) => {
        const point = (
          type: "pointerdown" | "pointerup",
          value: [number, number],
        ) =>
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            clientX: value[0],
            clientY: value[1],
          });
        element.dispatchEvent(point("pointerdown", from));
        window.dispatchEvent(point("pointerup", through));
      },
      { from, through },
    );
  };
  await swipeMonth([230, 300], [100, 305]);
  await expect(
    page.getByRole("heading", { name: "November 2026", exact: true }),
  ).toBeVisible();
  await swipeMonth([100, 300], [230, 305]);
  await expect(
    page.getByRole("heading", { name: "October 2026", exact: true }),
  ).toBeVisible();
  await swipeMonth([100, 300], [110, 450]);
  await expect(
    page.getByRole("heading", { name: "October 2026", exact: true }),
  ).toBeVisible();
  await grid
    .getByRole("button", { name: "12 October, 1 tasks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A friendly weekday plan", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("streak opt-in, offline completion, ended deadlines and another device agree", async ({
  page,
  context,
  browser,
}, info) => {
  test.setTimeout(60000);
  const email = `streak-proof-${randomUUID()}@example.test`;
  await signIn(context, email);
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("Read a little each day");
  await page.getByRole("button", { name: "Add optional details" }).click();
  await expect(page.getByLabel("Track a streak")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Frequency", exact: true })
    .selectOption("daily");
  await page.getByLabel("Track a streak").check();
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  const card = page.locator("article.task-card").filter({
    has: page.getByRole("heading", {
      name: "Read a little each day",
      exact: true,
    }),
  });
  await expect(
    card.getByText("Start your streak", { exact: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Skip", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await card.getByRole("checkbox").click();
  await page.getByText("Completed & skipped (1)", { exact: true }).click();
  await expect(card.getByText("1 in a row", { exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("Completed & skipped (1)", { exact: true }).click();
  await expect(card.getByText("1 in a row", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.screenshot({
    path: `${process.env.QA_SCREENSHOT_DIR ?? "docs/evidence"}/streak-active-${info.project.name}.png`,
    fullPage: true,
  });
  const other = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
  });
  try {
    await other.setExtraHTTPHeaders({
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
    });
    await signIn(other, email);
    const remote = await other.newPage();
    await remote.goto("/");
    await remote.getByText("Completed & skipped (1)", { exact: true }).click();
    await expect(remote.getByText("1 in a row", { exact: true })).toBeVisible();
  } finally {
    await other.close();
  }
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("A missed reading deadline");
  await page.getByRole("button", { name: "Add optional details" }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-01-01");
  await page
    .getByRole("combobox", { name: "Frequency", exact: true })
    .selectOption("daily");
  await page.getByLabel("Track a streak").check();
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  const missed = page.locator("article.task-card").filter({
    has: page.getByRole("heading", {
      name: "A missed reading deadline",
      exact: true,
    }),
  });
  await expect(missed.getByText("Streak ended", { exact: true })).toBeVisible();
  await expect(
    missed.getByRole("button", { name: "Skip", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `${process.env.QA_SCREENSHOT_DIR ?? "docs/evidence"}/streak-ended-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
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
    page.getByRole("checkbox", { name: "Reopen A plan saved offline" }),
  ).toBeChecked();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Synced");
  const second = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3000",
  });
  try {
    await second.setExtraHTTPHeaders({
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
    });
    await signIn(second, email);
    const other = await second.newPage();
    await other.goto("/");
    await expect(
      other.getByRole("heading", { name: "Make room for a walk" }),
    ).toBeVisible();
    await other.getByText("Completed & skipped (1)", { exact: true }).click();
    await expect(
      other.getByRole("checkbox", { name: "Reopen A plan saved offline" }),
    ).toBeChecked();
  } finally {
    await second.close();
  }
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("Ten minutes to reset");
  await page.getByRole("button", { name: "Add optional details" }).click();
  await page
    .getByRole("combobox", { name: "Frequency", exact: true })
    .selectOption("daily");
  await expect(page.getByText(/Next dates:/)).toContainText("·");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ten minutes to reset" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${process.env.QA_SCREENSHOT_DIR ?? "docs/evidence"}/planner-day-${info.project.name}.png`,
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
    path: `${process.env.QA_SCREENSHOT_DIR ?? "docs/evidence"}/planner-editor-${info.project.name}.png`,
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
    path: `${process.env.QA_SCREENSHOT_DIR ?? "docs/evidence"}/planner-month-${info.project.name}.png`,
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
  for (const action of ["prepare", "coverage", "status", "test"]) {
    expect(
      (
        await context.request.post(`${base}/api/v1/notifications/${action}`, {
          data: {},
        })
      ).status(),
    ).toBe(401);
  }
  await signIn(context, `boundary-${randomUUID()}@example.test`);
  for (const action of ["prepare", "coverage", "status", "test"]) {
    const path = `${base}/api/v1/notifications/${action}`;
    expect(
      (
        await context.request.post(path, {
          headers: { "X-Timely-Account": "someone-else" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.post(path, {
          headers: { Origin: "https://untrusted.example" },
          data: {},
        })
      ).status(),
    ).toBe(403);
  }

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
  const card = page.locator("article").filter({
    has: page.getByRole("heading", { name: "A movable little plan" }),
  });
  const id = await card.getAttribute("data-task-id");
  await card.getByText("More actions", { exact: true }).click();
  await card.getByRole("button", { name: "Tomorrow", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A movable little plan" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Next period" }).click();
  await expect(card).toHaveAttribute("data-task-id", id!);
  await card.getByText("More actions", { exact: true }).click();
  await card.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByText("Completed & skipped (1)", { exact: true }),
  ).toBeVisible();
  await page.getByText("Completed & skipped (1)", { exact: true }).click();
  await card.getByText("More actions", { exact: true }).click();
  await card.getByRole("button", { name: "Unskip", exact: true }).click();
  await expect(
    page.getByText("Completed & skipped (1)", { exact: true }),
  ).not.toBeVisible();
  await expect(card).toHaveAttribute("data-task-id", id!);
  await card.getByText("More actions", { exact: true }).click();
  await card
    .getByRole("button", { name: "Delete A movable little plan" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete plan", exact: true })
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
test("web scoped Undo, explicit date moves, restored navigation and historical filtering work", async ({
  page,
  context,
}) => {
  await signIn(context, `parity-${randomUUID()}@example.test`);
  await page.goto("/");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("A lasting series");
  await page.getByRole("button", { name: "Add optional details" }).click();
  await page
    .getByRole("combobox", { name: "Frequency", exact: true })
    .selectOption("daily");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page.getByRole("button", { name: "Next period" }).click();
  const day = await page.getByLabel("Choose date").inputValue();
  await page.reload();
  await expect(page.getByLabel("Choose date")).toHaveValue(day);
  await page.getByText("More actions", { exact: true }).click();
  await page.getByRole("button", { name: "Delete A lasting series" }).click();
  await page.getByLabel("Delete scope").selectOption("future");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete plan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A lasting series", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A lasting series", exact: true }),
  ).toBeVisible();
  await page.getByText("More actions", { exact: true }).click();
  await page
    .getByRole("button", { name: "Move A lasting series to a date" })
    .click();
  const movedDay = "2026-12-15";
  await page.getByLabel("New date").fill(movedDay);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Move", exact: true })
    .click();
  await page.getByLabel("Choose date").fill(movedDay);
  const moved = page
    .locator("article")
    .filter({ hasText: `Moved from ${day}` });
  await expect(moved).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByLabel("From date", { exact: true }).fill("2026-12-01");
  await page.getByLabel("Through date", { exact: true }).fill("2026-12-31");
  await page
    .getByRole("button", { name: "Load online history", exact: true })
    .click();
  await expect(
    page.getByText("Showing online history for this range", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("article").filter({ hasText: `Moved from ${day}` }),
  ).toBeVisible();
  await page.getByText("Filter plans", { exact: true }).click();
  await page
    .getByLabel("Task status", { exact: true })
    .selectOption("completed");
  await expect(
    page.getByRole("heading", { name: "A lasting series", exact: true }),
  ).toHaveCount(0);
  // Hold a real server response while the query changes; stale pages must not
  // replace the newly selected downloaded range.
  await page.getByLabel("Task status", { exact: true }).selectOption("pending");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route("**/api/v1/history?**", async (route) => {
    const response = await route.fetch();
    requested = true;
    await held;
    await route.fulfill({ response });
  });
  try {
    await page
      .getByRole("button", { name: "Load online history", exact: true })
      .click();
    await expect.poll(() => requested).toBe(true);
    await page.getByLabel("From date", { exact: true }).fill("2026-11-01");
    await page.getByLabel("Through date", { exact: true }).fill("2026-11-30");
    release();
    await expect(
      page.getByRole("button", { name: "Load online history", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByText("Showing online history for this range", { exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("confirmed account deletion removes local data and revokes a second real session", async ({
  page,
  context,
  browser,
}) => {
  const email = `delete-proof-${randomUUID()}@example.test`;
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  await signIn(context, email);
  const second = await browser.newContext({ baseURL: base });
  try {
    await second.setExtraHTTPHeaders({
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
    });
    await signIn(second, email);
    await page.goto("/");
    await create(page, "Disposable deletion proof");
    await expect(page.getByRole("status")).toContainText("Synced");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByText("Manage account", { exact: true }).click();
    await page
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete permanently", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Welcome to your day", exact: true }),
    ).toBeVisible();
    expect((await second.request.get(`${base}/api/v1/me`)).status()).toBe(401);
    expect(
      await page.evaluate(() => localStorage.getItem("timely-local-account")),
    ).toBeNull();
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Disposable deletion proof",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    await second.close();
  }
});
test("IndexedDB upgrade preserves an offline creation, its identity, clock and outbox", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome to your day" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await signIn(context, `migration-${randomUUID()}@example.test`);
  const base = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const account = (
    await (await context.request.get(`${base}/api/v1/me`)).json()
  ).user;
  const deviceId = randomUUID(),
    operationId = randomUUID(),
    definitionId = randomUUID(),
    physical = Date.now();
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const legacy = {
    version: 1,
    ownerId: account.id,
    deviceId,
    clock: { physical, logical: 0, offset: 0 },
    shadows: {},
    outbox: [
      {
        operation: {
          protocolVersion: 1,
          id: operationId,
          deviceId,
          definitionId,
          createdAt: new Date(physical).toISOString(),
          stamp: { physical, logical: 0, deviceId, operationId },
          command: {
            type: "create",
            task: {
              id: definitionId,
              title: "Preserved migration plan",
              notes: "",
              priority: null,
              rule: null,
              schedule: { date: day, time: null, duration: null },
              reminders: { enabled: false, before: true, overdue: true },
            },
          },
        },
        attempts: 0,
        retryAt: 0,
      },
    ],
    cursor: 0,
    bootstrapped: false,
    lastSync: null,
    staging: null,
  };
  await page.evaluate(
    async ({ legacy, account }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("timely-planner-v1", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("accounts", { keyPath: "ownerId" });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("accounts", "readwrite");
          tx.objectStore("accounts").put(legacy);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
      localStorage.setItem("timely-local-account", JSON.stringify(account));
    },
    { legacy, account },
  );
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Preserved migration plan" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("1 pending");
  expect(
    await page.evaluate(
      async () =>
        new Promise((resolve) => {
          const request = indexedDB.open("timely-planner-v1");
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("pending", "readonly");
            const rows = tx.objectStore("pending").getAll();
            rows.onsuccess = () => {
              resolve(rows.result.map((row) => row.pending.operation.id));
              db.close();
            };
          };
        }),
    ),
  ).toEqual([operationId]);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Preserved migration plan" }),
  ).toBeVisible();
});

test("quick add, optional drafts, task reminders and discard recovery preserve saved data", async ({
  page,
  context,
}, info) => {
  await signIn(context, `ux-editor-${randomUUID()}@example.test`);
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const dialog = page.locator("dialog.editor");
  await expect(dialog.getByLabel("Notes", { exact: true })).toHaveCount(0);
  await page.getByLabel("Task title").fill("  A simple plan  ");
  await page.screenshot({
    path: `${process.env.QA_SCREENSHOT_DIR ?? "/tmp/timely-ux-evidence"}/ux-quick-add-${info.project.name}.png`,
  });
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  const card = page.locator("article.task-card").filter({
    has: page.getByRole("heading", { name: "A simple plan", exact: true }),
  });
  await expect(card).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Delete A simple plan" }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Edit A simple plan" }).click();
  await page
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Bring a notebook");
  await page.getByLabel("Remind me about this task", { exact: true }).check();
  await page.getByLabel("Before the task", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Hide optional details" }).click();
  await page.getByRole("button", { name: "Add optional details" }).click();
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Bring a notebook");
  await expect(
    page.getByLabel("Remind me about this task", { exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Save task", exact: true }).click();
  // The existing title and previous Synced label can remain visible while the
  // atomic local write is still running. Wait for the editor's save completion.
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Synced");
  await page.reload();
  await card.getByRole("button", { name: "Edit A simple plan" }).click();
  await expect(
    page.getByLabel("Before the task", { exact: true }),
  ).not.toBeChecked();
  await expect(page.getByLabel("When overdue", { exact: true })).toBeChecked();
  await page.getByLabel("Task title").fill("An unsaved draft");
  await dialog.locator(".editor-body").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Discard unsaved changes?",
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "Keep editing" }),
  ).toBeFocused();
  await expect.poll(() => confirmation.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const foreground = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    );
    return element.matches(":modal") && element.contains(foreground)
      && rect.top >= 0 && rect.bottom <= innerHeight;
  })).toBe(true);
  await page.keyboard.press("Tab");
  await expect(confirmation.getByRole("button", { name: "Discard", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirmation.getByRole("button", { name: "Keep editing" })).toBeFocused();
  expect(await confirmation.evaluate((element) => getComputedStyle(element).animationName)).toBe("discard-enter");
  await confirmation.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  await page.screenshot({
    path: `${process.env.QA_SCREENSHOT_DIR ?? "/tmp/timely-ux-evidence"}/ux-discard-${info.project.name}.png`,
  });
  await confirmation.getByRole("button", { name: "Keep editing" }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await expect(page.getByLabel("Task title")).toHaveValue("An unsaved draft");
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(page.getByLabel("Task title")).toHaveValue("An unsaved draft");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeVisible();
  expect(await confirmation.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await confirmation.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeVisible();
  await expect(
    card.getByText("Bring a notebook", { exact: true }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Edit A simple plan" }),
  ).toBeFocused();
});

test("week quick add uses its own day and search explains the selected history range", async ({
  page,
  context,
}, info) => {
  await signIn(context, `ux-navigation-${randomUUID()}@example.test`);
  await page.goto("/?date=2026-11-02&mode=Week");
  const tuesday = page.locator(".week-agenda > section").nth(1);
  await tuesday
    .getByRole("button", { name: "Add a task", exact: true })
    .click();
  await page.getByLabel("Task title").fill("Tuesday's appointment");
  await expect(
    page.getByText("For 3 November 2026. A title is all you need."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add optional details" }).click();
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue(
    "2026-11-03",
  );
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(
    tuesday.getByRole("heading", {
      name: "Tuesday's appointment",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("From date", { exact: true }).fill("2026-11-01");
  await page.getByLabel("Through date", { exact: true }).fill("2026-11-30");
  await expect(
    page.getByText(
      "Searching 1 Nov 2026 to 30 Nov 2026. Change the dates to look in another period.",
    ),
  ).toBeVisible();
  await page.getByLabel("Search titles and notes").fill("Does not exist");
  await expect(
    page.getByRole("heading", { name: "No matching plans in this period." }),
  ).toBeVisible();
  await expect(
    page.locator(".empty-state").getByRole("button", { name: "Add a task" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tuesday's appointment", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${process.env.QA_SCREENSHOT_DIR ?? "/tmp/timely-ux-evidence"}/ux-search-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel("From date", { exact: true }).fill("");
  await expect(
    page.locator(".history-filters").getByRole("alert"),
  ).toContainText("Choose a date range");
  await expect(page.getByLabel("Search titles and notes")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
