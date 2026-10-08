import { translate, parseLanguage, type Language } from "@timely/i18n";
import nodemailer from "nodemailer";
import { z } from "zod";

type MailConfiguration =
  | { mode: "capture"; from: string; port: number }
  | { mode: "resend"; from: string; apiKey: string };

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
function isLoopback(value: string | undefined) {
  try {
    return localHosts.has(new URL(value ?? "").hostname);
  } catch {
    return false;
  }
}

export function mailConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): MailConfiguration {
  const mode = env.MAIL_MODE ?? "resend";
  if (mode !== "resend" && mode !== "capture")
    throw new Error("MAIL_MODE must be resend or capture.");
  if (mode === "capture") {
    if (
      !isLoopback(env.BETTER_AUTH_URL) ||
      !isLoopback(env.DATABASE_URL) ||
      (env.NODE_ENV === "production" && env.APP_ENV !== "local")
    )
      throw new Error(
        "Capture mail is restricted to local development services.",
      );
    const port = Number(env.MAIL_CAPTURE_PORT ?? 1025);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("MAIL_CAPTURE_PORT must be a valid port.");
    return {
      mode,
      from: env.MAIL_FROM?.trim() || "Timely <signin@timely.local>",
      port,
    };
  }
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey)
    throw new Error("Set server-only RESEND_API_KEY to enable Resend.");
  const from = env.MAIL_FROM?.trim();
  if (!from || /[\r\n]/.test(from))
    throw new Error("Set MAIL_FROM to your verified Resend sender.");
  const address = from.includes("<")
    ? /^[^<>]+<([^<>]+)>$/.exec(from)?.[1]?.trim()
    : from;
  if (!z.email().safeParse(address).success)
    throw new Error("MAIL_FROM must contain one valid sender email address.");
  const domain = address!.split("@")[1]!.toLowerCase();
  if (/\.(local|test|invalid)$/.test(domain) || domain === "localhost")
    throw new Error(
      "Replace the local MAIL_FROM with your verified Resend sender.",
    );
  return { mode, from, apiKey };
}

export async function sendCode(
  email: string,
  otp: string,
  requestedLanguage: Language = "es",
) {
  const language = parseLanguage(requestedLanguage);
  const text = (message: string, parameters?: Record<string, string>) =>
    translate(message, parameters, language);
  if (!z.email().safeParse(email).success || !/^\d{6}$/.test(otp))
    throw new Error("Invalid sign-in email request.");
  const configuration = mailConfiguration();
  const message = {
    from: configuration.from,
    to: email,
    subject: text("Your Timely sign-in code"),
    text: text(
      "Your Timely code is {v0}. It expires in 5 minutes. If you did not request this, ignore this email.",
      { v0: otp },
    ),
    html: `<html lang="${language}"><body style="margin:0;background:#FAF9F1;color:#14294D;font-family:Arial,sans-serif;padding:32px 16px">
      <table role="presentation" style="max-width:480px;width:100%;margin:0 auto;border-collapse:collapse"><tr><td>
        <p style="color:#1A5FCF;font-size:28px;font-weight:bold;margin:0 0 24px">timely</p>
        <h1 style="font-size:24px;margin:0 0 16px">${text("Your sign-in code")}</h1>
        <p style="font-size:16px;line-height:1.5">${text("Enter this code in Timely to sign in.")}</p>
        <p style="background:#FFFFFF;border-radius:18px;padding:24px;font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center">${otp}</p>
        <p style="font-size:16px;line-height:1.5">${text("This code expires in 5 minutes.")}</p>
        <p style="font-size:14px;line-height:1.5;color:#667389">${text("If you did not request this code, you can ignore this email.")}</p>
      </td></tr></table></body></html>`,
  };
  if (configuration.mode === "capture") {
    try {
      await nodemailer
        .createTransport({
          host: "127.0.0.1",
          port: configuration.port,
          secure: false,
        })
        .sendMail(message);
    } catch {
      throw new Error("Email delivery unavailable.");
    }
    return;
  }
  try {
    // The REST endpoint avoids the SDK's raw development error logging.
    // Never fall back to SMTP after an uncertain or rejected Resend send.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Delivery rejected.");
    const result: unknown = await response.json();
    if (!z.object({ id: z.string().min(1) }).safeParse(result).success)
      throw new Error("Delivery was not acknowledged.");
  } catch {
    // Keep OTPs, addresses, provider response bodies and credentials out of logs.
    throw new Error("Email delivery unavailable.");
  }
}
