import { NextResponse } from "next/server";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth";

/**
 * Unauthenticated diagnostic that walks through the SAME steps as login:
 *   1. DB connectivity
 *   2. tables exist
 *   3. user lookup
 *   4. password verification
 *
 * GET /api/login-test?email=caroline@indleladata.co.za
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email") || "caroline@indleladata.co.za";
  const password = url.searchParams.get("password");
  const out: {
    step: string;
    ok: boolean;
    dbHost: string | null;
    ssl: string;
    connected?: boolean;
    tablesExist?: boolean;
    userFound?: boolean;
    emailVerified?: boolean;
    status?: string;
    passwordMatched?: boolean | null;
    totalUsers?: number;
    error?: string;
  } = {
    step: "init",
    ok: false,
    dbHost: process.env.DATABASE_URL?.match(/@([^:/]+)/)?.[1] || null,
    ssl: /@(localhost|127\.0\.0\.1)/.test(process.env.DATABASE_URL || "")
      ? "disabled (localhost)"
      : "enabled",
  };

  try {
    // 1. connectivity
    out.step = "connect";
    await db.execute(sql`SELECT 1 AS ok`);
    out.connected = true;

    // 2. users table exists?
    out.step = "check-table";
    const tr = (await db.execute(
      sql`SELECT to_regclass('public.users') AS exists`
    )) as unknown as { rows: { exists: string | null }[] };
    out.tablesExist = tr.rows[0]?.exists !== null;
    if (!out.tablesExist) {
      out.ok = false;
      out.error =
        "The 'users' table does not exist. Run the schema (drizzle-kit push) against this database.";
      return NextResponse.json(out, { status: 500 });
    }

    // 3. find user + raw count
    out.step = "find-user";
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const u = rows[0];
    out.userFound = !!u;

    // Also get total user count to see if the table is empty
    const countResult = await db.execute(sql`SELECT COUNT(*)::int as n FROM users`);
    const totalUsers = (countResult as any).rows?.[0]?.n ?? 0;
    out.totalUsers = totalUsers;

    if (!u) {
      out.ok = false;
      out.error = `No user found with email "${email}". The account was not created in THIS database. Total users in DB: ${totalUsers}`;
      return NextResponse.json(out, { status: 404 });
    }
    out.emailVerified = u.emailVerified;
    out.status = u.status;

    // 4. password check (only if a password was supplied)
    if (password) {
      out.step = "verify-password";
      out.passwordMatched = await verifyPassword(password, u.passwordHash);
      if (!out.passwordMatched) {
        out.ok = false;
        out.error = "Password does not match the stored hash.";
        return NextResponse.json(out, { status: 401 });
      }
    }

    out.step = "done";
    out.ok = true;
    out.error = out.passwordMatched === false ? "Password mismatch" : undefined;
    return NextResponse.json(out);
  } catch (err: any) {
    out.error = err.message || String(err);
    if (err.code) out.error += ` (code: ${err.code})`;
    const errorStr = (out.error || "").toLowerCase();
    if (/econnrefused|enotfound|etimedout|hangup|terminated/i.test(errorStr))
      out.error =
        "Could not connect to the database. Check DATABASE_URL and that the host is reachable/whitelisted.";
    if (/ssl|certificate|self.signed/i.test(errorStr))
      out.error =
        "Database SSL handshake failed. Use Neon's pooled connection string with ?sslmode=require.";
    if (/relation .* does not exist|does not exist/i.test(errorStr))
      out.error = "The 'users' table does not exist in this database. Run the schema migration.";
    if (/permission denied/i.test(errorStr))
      out.error = "Permission denied. The database user does not have SELECT permission on the users table.";
    return NextResponse.json(out, { status: 500 });
  }
}
