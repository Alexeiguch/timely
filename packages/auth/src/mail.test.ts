import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mailConfiguration, sendCode } from "./mail";
import nodemailer from "nodemailer";

const key = "re_synthetic_mail_test_key";
const sender = "Timely <signin@planner.example.com>";
const recipient = "mail-fixture@example.test";
const code = "123456";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("MAIL_MODE", "resend");
  vi.stubEnv("RESEND_API_KEY", key);
  vi.stubEnv("MAIL_FROM", sender);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

it("uses Resend by default and requires the key and a real sender", () => {
  expect(
    mailConfiguration({ RESEND_API_KEY: key, MAIL_FROM: sender }).mode,
  ).toBe("resend");
  expect(() => mailConfiguration({ MAIL_FROM: sender })).toThrow(
    "RESEND_API_KEY",
  );
  expect(() => mailConfiguration({ RESEND_API_KEY: key })).toThrow("MAIL_FROM");
  expect(() =>
    mailConfiguration({
      RESEND_API_KEY: key,
      MAIL_FROM: "Timely <signin@timely.local>",
    }),
  ).toThrow("verified Resend sender");
  expect(() =>
    mailConfiguration({ RESEND_API_KEY: key, MAIL_FROM: "bad sender" }),
  ).toThrow("valid sender");
  expect(() =>
    mailConfiguration({
      MAIL_MODE: "typo",
      RESEND_API_KEY: key,
      MAIL_FROM: sender,
    }),
  ).toThrow("MAIL_MODE");
});

it.each([
  {
    NODE_ENV: "development",
    BETTER_AUTH_URL: "https://planner.example.com",
    DATABASE_URL: "postgres://localhost/planner",
  },
  {
    NODE_ENV: "development",
    BETTER_AUTH_URL: "http://localhost:3001",
    DATABASE_URL: "postgres://host.example.com/planner",
  },
  {
    NODE_ENV: "production",
    BETTER_AUTH_URL: "http://localhost:3001",
    DATABASE_URL: "postgres://localhost/planner",
  },
])("refuses capture outside explicitly permitted local services: %s", (env) => {
  expect(() => mailConfiguration({ MAIL_MODE: "capture", ...env })).toThrow(
    "local development",
  );
});

it("keeps the built local SMTP path and validates its port", () => {
  const env = {
    MAIL_MODE: "capture",
    NODE_ENV: "production",
    APP_ENV: "local",
    BETTER_AUTH_URL: "http://localhost:3001",
    DATABASE_URL: "postgres://127.0.0.1/planner",
  };
  expect(mailConfiguration(env)).toMatchObject({ mode: "capture", port: 1025 });
  expect(() =>
    mailConfiguration({ ...env, MAIL_CAPTURE_PORT: "not-a-port" }),
  ).toThrow("valid port");
});

it("submits a sign-in email with HTML and plain text through the Resend API", async () => {
  fetchMock.mockResolvedValue(Response.json({ id: "synthetic-delivery-id" }));
  await sendCode(recipient, code);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("https://api.resend.com/emails");
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${key}`);
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  const body = JSON.parse(String(init?.body));
  expect(body).toMatchObject({ from: sender, to: recipient });
  expect(body.text).toContain(code);
  expect(body.html).toContain(code);
});

it.each([403, 429, 500])(
  "fails on provider HTTP %s without logging or falling back to SMTP",
  async (status) => {
    const smtp = vi.spyOn(nodemailer, "createTransport");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      new Response(`private ${key} ${code} ${recipient}`, { status }),
    );
    await expect(sendCode(recipient, code)).rejects.toThrow(
      /^Email delivery unavailable\.$/,
    );
    expect(smtp).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  },
);

it.each([null, {}, { id: "" }])(
  "refuses to claim delivery without a provider acknowledgement: %s",
  async (body) => {
    fetchMock.mockResolvedValue(Response.json(body));
    await expect(sendCode(recipient, code)).rejects.toThrow(
      "Email delivery unavailable",
    );
  },
);

it("sanitizes network failures and validates the recipient/code before sending", async () => {
  fetchMock.mockRejectedValue(new Error(`private ${key} ${code}`));
  await expect(sendCode(recipient, code)).rejects.toThrow(
    /^Email delivery unavailable\.$/,
  );
  fetchMock.mockClear();
  await expect(sendCode("not-an-address", code)).rejects.toThrow(
    "Invalid sign-in",
  );
  await expect(sendCode(recipient, "<script>")).rejects.toThrow(
    "Invalid sign-in",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["es", "en"] as const)(
  "sends the OTP email in the selected %s language",
  async (language) => {
    fetchMock.mockResolvedValue(
      Response.json({ id: "synthetic-localized-id" }),
    );
    await sendCode(recipient, code, language);
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body.html).toContain(`lang="${language}"`);
    expect(body.subject).toBe(
      language === "es"
        ? "Tu código de acceso a Timely"
        : "Your Timely sign-in code",
    );
    expect(body.text).toContain(
      language === "es" ? "Caduca en 5 minutos" : "expires in 5 minutes",
    );
    expect(body.text).toContain(code);
  },
);
