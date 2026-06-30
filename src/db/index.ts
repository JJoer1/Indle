import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __indleMysqlPool?: mysql.Pool;
};

function createPool() {
  // mysql2 accepts a connection URI string
  return mysql.createPool(databaseUrl as string);
}

export const pool = globalForDb.__indleMysqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__indleMysqlPool = pool;
}

export const db = drizzle(pool);
