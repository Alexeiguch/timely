import { parseLanguage } from "@timely/i18n";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { database } from "@timely/db";
import * as schema from "@timely/db/schema";
import { sendCode } from "./mail";
import { z } from "zod";
const environment = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  DATABASE_URL: z.string().min(1),
});
export function createAuth() {
  const env = environment.parse(process.env);
  const googleId = process.env.GOOGLE_WEB_CLIENT_ID;
  const appleId = process.env.APPLE_SERVICE_ID;
  return betterAuth({
    appName: "Timely",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database(), {
      provider: "pg",
      schema,
      schemaName: "timely_auth",
    }),
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      process.env.APP_SCHEME ?? "timely-dev://",
      "https://appleid.apple.com",
    ],
    emailAndPassword: { enabled: false },
    account: {
      accountLinking: { enabled: true, disableImplicitLinking: true },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, freshAge: 60 * 5 },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
    socialProviders: {
      ...(googleId && process.env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: googleId,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(appleId && process.env.APPLE_CLIENT_SECRET
        ? {
            apple: {
              clientId: appleId,
              clientSecret: process.env.APPLE_CLIENT_SECRET,
              audience: [appleId, process.env.APPLE_BUNDLE_ID].filter(
                (s): s is string => !!s,
              ),
            },
          }
        : {}),
    },
    plugins: [
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp }, context) {
          await sendCode(
            email,
            otp,
            parseLanguage(context?.request?.headers.get("x-timely-language")),
          );
        },
      }),
    ],
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function auth() {
  return (instance ??= createAuth());
}
