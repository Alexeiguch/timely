import { Text, View, Button } from 'react-native';
import { authClient, authenticatedFetch } from '../src/auth';
import { SignIn } from '../src/sign-in';
import { useState } from 'react';
export default function Home() {
  const { data: session, isPending } = authClient.useSession(); const [proof, setProof] = useState('');
  if (isPending && !session) return <Text accessibilityRole="text">Opening your day…</Text>;
  if (!session) return <SignIn/>;
  return <View style={{ padding: 32, gap: 24 }}><Text>You're signed in as {session.user.email}</Text><Button title="Check protected account endpoint" onPress={async () => { const result = await authenticatedFetch('/api/v1/me'); setProof(result.ok ? 'Authenticated account verified' : `Verification failed (${result.status})`); }}/><Text>{proof}</Text><Button title="Sign out" onPress={() => authClient.signOut()}/></View>;
}
