import { mailConfiguration } from "../packages/auth/src/mail.ts";

try {
  const env = { ...process.env };
  if (process.argv.includes("--resend")) env.MAIL_MODE = "resend";
  const configuration = mailConfiguration(env);
  console.log(`Mail configuration ready: ${configuration.mode}.`);
  console.log(
    "No email sent. Domain verification and inbox delivery need a live sign-in check.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Mail configuration unavailable.",
  );
  process.exitCode = 1;
}
