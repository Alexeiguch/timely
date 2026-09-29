import { auth } from '@timely/auth/server';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const session = await auth().api.getSession({ headers: request.headers });
  if (!session) return Response.json({ code: 'UNAUTHENTICATED' }, { status: 401 });
  return Response.json({ user: { id: session.user.id, name: session.user.name, email: session.user.email }, protocolVersion: 1 }, { headers: { 'Cache-Control': 'no-store' } });
}
