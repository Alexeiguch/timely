// Schema generation only; does not authenticate test users or contact a database.
process.env.DATABASE_URL ??= 'postgres://schema:schema@localhost:5432/schema';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET ??= 'schema-generation-only-not-a-runtime-secret';
const { createAuth } = await import('./src/server');
export const auth = createAuth();
