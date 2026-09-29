import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const violations = [];
async function scan(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { if (['node_modules','.next','.expo'].includes(entry.name)) continue; const file = path.join(dir,entry.name); if (entry.isDirectory()) await scan(file); else if (/\.(tsx?|mjs)$/.test(file)) { const text = await readFile(file,'utf8'); const client = dir.startsWith('apps/mobile') || dir.startsWith('packages/domain') || dir.startsWith('packages/sync') || dir.startsWith('packages/contracts') || /^['"]use client['"]/m.test(text); if (client && /(?:from\s*|import\s*\()['"](?:@timely\/(?:db|auth\/server)|postgres|drizzle-orm)/.test(text)) violations.push(file); if (client && /process\.env\.(DATABASE_URL|BETTER_AUTH_SECRET|APPLE_PRIVATE_KEY|RESEND_API_KEY)/.test(text)) violations.push(file); } } }
await scan('apps'); await scan('packages');
if (violations.length) { console.error('Server import boundary violation:', violations); process.exit(1); }
console.log('Client/server import boundaries passed');
