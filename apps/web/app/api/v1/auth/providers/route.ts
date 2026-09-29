import { auth } from "@timely/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public capability flags from the same instance that handles sign-in. Never expose provider options/secrets.
export async function GET() {
  const providers = auth().options.socialProviders;
  return Response.json(
    { google: Boolean(providers.google), apple: Boolean(providers.apple) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
