import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Diagnostic endpoint — NOT authenticated so it can be hit on a fresh deploy
 * to confirm the database connection and that all tables exist.
 *
 *   GET /api/db-test
 */
export async function GET() {
  const url = process.env.DATABASE_URL || "";
  // Mask the password in the connection string for safe display.
  const masked = url.replace(/:[^:@/]*@/, ":••••••@");
  const isLocalhost = /@(localhost|127\.0\.0\.1)/.test(url);

  const result: {
    connected: boolean;
    host: string | null;
    ssl: string;
    databaseUrlSet: boolean;
    error?: string;
    tables?: string[];
    counts?: Record<string, number>;
  } = {
    connected: false,
    host: null,
    ssl: isLocalhost ? "disabled (localhost)" : "enabled",
    databaseUrlSet: !!url,
  };

  try {
    // Extract host for display
    const m = url.match(/@([^:/]+)/);
    result.host = m ? m[1] : null;

    // 1) basic connectivity
    await db.execute(sql`SELECT 1 AS ok`);
    result.connected = true;

    // 2) list public tables
    const tableRows = (await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )) as unknown as { rows: { tablename: string }[] };
    result.tables = tableRows.rows.map((r) => r.tablename);

    // 3) quick counts on core tables (ignore errors per-table)
    const counts: Record<string, number> = {};
    const core = ["companies", "users", "sessions", "customers", "leads", "deals"];
    for (const t of core) {
      try {
        const r = (await db.execute(
          sql.raw(`SELECT COUNT(*)::int AS n FROM "${t}"`)
        )) as unknown as { rows: { n: number }[] };
        counts[t] = r.rows[0]?.n ?? 0;
      } catch {
        counts[t] = -1; // table missing
      }
    }
    result.counts = counts;

    return NextResponse.json(result);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(result, { status: 500 });
  }
}
