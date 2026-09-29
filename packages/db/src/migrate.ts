import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from './index';
const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_MIGRATION_URL');
const { db, client } = createDatabase(url);
try { await migrate(db, { migrationsFolder: './migrations' }); } finally { await client.end(); }
