import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Hosted PostgreSQL providers (Neon, Supabase, Railway, etc.) require SSL.
// Local development (localhost / 127.0.0.1) uses a plain connection.
const isLocalhost = /@(localhost|127\.0\.0\.1)/.test(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function createPool() {
  return new Pool({
    connectionString: databaseUrl,
    // Keep the pool small + short-lived for serverless environments.
    max: 10,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 20000,
    ssl: isLocalhost
      ? false
      : {
          rejectUnauthorized: false,
        },
  });
}

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? createPool();

// Reuse the pool across hot reloads in dev. On Vercel, each serverless
// instance keeps its own pool for the lifetime of that invocation.
if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
