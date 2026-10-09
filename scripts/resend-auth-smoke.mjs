import { randomUUID } from 'node:crypto';
import { mailConfiguration } from '../packages/auth/src/mail.ts';

const base = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
const configuration = mailConfiguration();
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  throw new Error('This synthetic sign-in check requires a local backend.');
if (configuration.mode !== 'resend')
  throw new Error('This check requires MAIL_MODE=resend.');

// Only Resend's documented delivery simulator receives this fixture.
// Read access is needed for this check; normal application sending does not need it.
const email = `delivered+timely-auth-${randomUUID()}@resend.dev`;
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const pause = () => new Promise(resolve => setTimeout(resolve, 2000));
async function request(url, options = {}) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error('Sign-in check request failed; no private response was logged.');
  }
}
function post(path, body, cookie) {
  return request(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}
async function provider(path) {
  const response = await request('https://api.resend.com' + path, {
    headers: { Authorization: `Bearer ${configuration.apiKey}` },
  });
  check(response.ok, 'Resend fixture lookup failed; this check requires email read access.');
  return response.json();
}

check((await request(base + '/api/v1/me')).status === 401, 'Anonymous access was not rejected.');
check((await post('/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' })).status === 200,
  'Resend sign-in code request failed.');
let delivered;
for (let attempt = 0; attempt < 10; attempt++) {
  await pause();
  const recent = await provider('/emails');
  const fixture = recent.data?.find(item => Array.isArray(item.to) && item.to.includes(email));
  if (fixture) {
    await pause();
    delivered = await provider('/emails/' + encodeURIComponent(fixture.id));
    break;
  }
}
const otp = delivered?.text?.match(/(?:code is|es) (\d{6})/)?.[1];
check(Boolean(otp), 'Resend simulator message did not contain a sign-in code.');
console.log('PASS Resend accepted the synthetic sign-in email');
const wrong = otp === '000000' ? '111111' : '000000';
check((await post('/api/auth/sign-in/email-otp', { email, otp: wrong })).status === 400,
  'Invalid sign-in code was not rejected.');
console.log('PASS invalid email OTP rejected');
const signed = await post('/api/auth/sign-in/email-otp', { email, otp });
check(signed.status === 200, 'Valid Resend-delivered code did not sign in.');
const cookie = signed.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
const user = (await signed.json()).user;
check(Boolean(cookie && user?.id), 'Sign-in did not establish a session.');
const restored = await request(base + '/api/v1/me', { headers: { Cookie: cookie } });
check(restored.status === 200 && (await restored.json()).user?.id === user.id,
  'Cookie session restoration failed.');
console.log('PASS Resend OTP sign-in and cookie session restoration');
check((await post('/api/auth/sign-in/email-otp', { email, otp })).status !== 200,
  'Consumed sign-in code was accepted twice.');
console.log('PASS consumed OTP cannot be reused');
check((await post('/api/auth/sign-out', {}, cookie)).status === 200, 'Sign-out failed.');
check((await request(base + '/api/v1/me', { headers: { Cookie: cookie } })).status === 401,
  'Sign-out did not revoke protected access.');
console.log('PASS sign-out revokes protected access');
console.log('Simulator delivery checked; actual human inbox delivery remains a separate manual check.');
