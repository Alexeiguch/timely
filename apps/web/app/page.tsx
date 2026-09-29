'use client';
import { authClient } from '@timely/auth/client';
import { SignIn } from '../components/sign-in';
export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <main className="signin"><p role="status">Opening your day…</p></main>;
  if (!session) return <SignIn/>;
  return <main className="signin"><section className="signin-card"><div className="brand">timely✳</div><h1>You're signed in.</h1><p>{session.user.email}</p><a href="/api/v1/me">Check protected account endpoint</a><button onClick={() => authClient.signOut()}>Sign out</button></section></main>;
}
