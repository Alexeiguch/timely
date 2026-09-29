import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
let instance: ReturnType<typeof createDatabase> | undefined;
export function createDatabase(url: string) {
  const client = postgres(url, { max: 5, prepare: false, connect_timeout: 10 });
  return { db: drizzle(client, { schema }), client };
}
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return (instance ??= createDatabase(process.env.DATABASE_URL)).db;
}
