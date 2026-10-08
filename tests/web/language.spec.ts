import { test, expect, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
async function capturedCode(context: BrowserContext, email: string) {
  let id = "";
  await expect
    .poll(async () => {
      const response = await context.request.get(
        "http://127.0.0.1:8025/api/v1/messages",
      );
      const data = await response.json();
      id =
        data.messages.find(
          (message: { ID: string; To: { Address: string }[] }) =>
            message.To.some((recipient) => recipient.Address === email),
        )?.ID ?? "";
      return !!id;
    })
    .toBe(true);
  const data = await (
    await context.request.get(`http://127.0.0.1:8025/api/v1/message/${id}`)
  ).json();
  expect(data.Subject).toBe("Tu código de acceso a Timely");
  const code = data.Text.match(/es (\d{6})/)?.[1];
  if (!code) throw new Error("Synthetic Spanish email was not delivered");
  return code as string;
}
test("Spanish default, English switch, reload and cross-tab preference persistence", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByRole("status")).toBeEmpty();
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Email address")).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByLabel("Email address")).toBeVisible();
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await expect(second.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await second.close();
});
test("Spanish OTP, recurring task and language changes preserve authored content offline", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  const email = `language-proof-${randomUUID()}@example.test`;
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByLabel("Email address")).toHaveValue(email);
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await page
    .getByRole("button", { name: "Enviarme un código", exact: true })
    .click();
  await expect(page.getByLabel("Código de seis dígitos")).toBeVisible();
  const code = await capturedCode(context, email);
  await page.getByLabel("Código de seis dígitos").fill(code);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Sincronizado");
  await page.getByRole("button", { name: "Añadir tarea", exact: true }).click();
  await page.getByLabel("Título de la tarea").fill("Settings");
  await page.getByRole("textbox", { name: "Notas", exact: true }).fill("Month");
  await page
    .getByRole("combobox", { name: "Frecuencia", exact: true })
    .selectOption("daily");
  await page.getByLabel("Seguir una racha").check();
  await expect(page.locator(".rule-preview")).toContainText("Cada día");
  await page
    .getByRole("button", { name: "Guardar tarea", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".task-notes")).toContainText("Month");
  await expect(page.locator(".streak-indicator")).toContainText(
    "Empieza tu racha",
  );
  await expect(page.getByRole("status")).toContainText("Sincronizado");
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Planner", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".task-notes")).toContainText("Month");
  await expect(page.locator(".streak-indicator")).toContainText(
    "Start your streak",
  );
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "English", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar Settings", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Frecuencia", exact: true }),
  ).toHaveValue("daily");
  await expect(page.getByLabel("Título de la tarea")).toHaveValue("Settings");
  await expect(page.getByRole("textbox", { name: "Notas", exact: true })).toHaveValue("Month");
});
