import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { db } from "@/db";
import {
  users,
  companies,
  pipelines,
  pipelineStages,
  passwordResetTokens,
  emailVerifications,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  getCurrentUser,
  logout,
  getApiContext,
} from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { DEAL_STAGES } from "@/lib/constants";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function verifyCode(secret: string, token: string): boolean {
  try {
    return verifySync({ secret, token }).valid === true;
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ user: null }, 401);
  return json({ user });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  try {
    return await handleAction(action, body);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // Common, human-friendly translations
    let friendly = "Something went wrong on the server.";
    if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|terminating|connection|hangup/i.test(detail))
      friendly = "Could not connect to the database. Check that DATABASE_URL is set and the database is reachable.";
    if (/relation .* does not exist|does not exist/i.test(detail))
      friendly = "Database tables are missing. Run the schema (drizzle-kit push) against your database.";
    if (/SSL|certificate|self.signed/i.test(detail))
      friendly = "Database SSL handshake failed. Verify your connection string / SSL settings.";
    if (/unique|duplicate/i.test(detail))
      friendly = "That record already exists.";
    console.error("[auth] action:", action, "error:", detail);
    return json({ error: friendly, detail }, 500);
  }
}

async function handleAction(action: string, body: Record<string, any>) {
  /* --------------------------- REGISTER (DISABLED) --------------------------- */
  if (action === "register") {
    return json({ error: "Self-registration is disabled. Please contact your company owner to get access." }, 403);
  }

  /* --------------------------- LOGIN --------------------------- */
  if (action === "login") {
    const { email, password, remember } = body;
    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const u = found[0];
    if (!u || !(await verifyPassword(password, u.passwordHash))) {
      return json({ error: "Invalid email or password." }, 401);
    }
    if (u.status !== "active") return json({ error: "Account is disabled." }, 403);
    if (u.twoFactorEnabled) return json({ requiresTwoFactor: true });
    await createSession({ id: u.id, companyId: u.companyId }, !!remember);
    return json({ ok: true });
  }

  /* --------------------------- VERIFY 2FA --------------------------- */
  if (action === "verify-2fa") {
    const { email, password, remember, code } = body;
    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const u = found[0];
    if (!u || !(await verifyPassword(password, u.passwordHash))) {
      return json({ error: "Invalid credentials." }, 401);
    }
    if (!u.twoFactorSecret || !verifyCode(u.twoFactorSecret, String(code))) {
      return json({ error: "Invalid authentication code." }, 401);
    }
    await createSession({ id: u.id, companyId: u.companyId }, !!remember);
    return json({ ok: true });
  }

  if (action === "logout") {
    await logout();
    return json({ ok: true });
  }

  /* --------------------------- FORGOT PASSWORD --------------------------- */
  if (action === "forgot-password") {
    const { email } = body;
    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (found[0]) {
      const token = randomUUID();
      await db.insert(passwordResetTokens).values({
        email,
        token,
        expiresAt: new Date(Date.now() + 3600000),
      });
      return json({ ok: true, token, demo: true });
    }
    return json({ ok: true });
  }

  /* --------------------------- RESET PASSWORD --------------------------- */
  if (action === "reset-password") {
    const { token, password } = body;
    if (!token || !password || password.length < 6) return json({ error: "Invalid request." }, 400);
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
    const t = rows[0];
    if (!t || t.used || new Date(t.expiresAt).getTime() < Date.now()) {
      return json({ error: "Invalid or expired token." }, 400);
    }
    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash }).where(eq(users.email, t.email));
    await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, t.id));
    return json({ ok: true });
  }

  /* --------------------------- VERIFY EMAIL --------------------------- */
  if (action === "verify-email") {
    const { token } = body;
    const rows = await db.select().from(emailVerifications).where(eq(emailVerifications.token, token)).limit(1);
    const t = rows[0];
    if (!t || t.used || new Date(t.expiresAt).getTime() < Date.now()) {
      return json({ error: "Invalid or expired verification link." }, 400);
    }
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, t.userId));
    await db.update(emailVerifications).set({ used: true }).where(eq(emailVerifications.id, t.id));
    return json({ ok: true });
  }

  if (action === "resend-verification") {
    const { email } = body;
    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (found[0] && !found[0].emailVerified) {
      const token = randomUUID();
      await db.insert(emailVerifications).values({
        userId: found[0].id,
        token,
        expiresAt: new Date(Date.now() + 86400000),
      });
      return json({ ok: true, token, demo: true });
    }
    return json({ ok: true });
  }

  /* --------------------------- 2FA --------------------------- */
  if (action === "2fa-setup") {
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const secret = generateSecret();
    const otpauth = generateURI({ issuer: "DD CRM", label: ctx.user.email, secret });
    const qr = await QRCode.toDataURL(otpauth);
    return json({ secret, otpauth, qr });
  }

  if (action === "2fa-enable") {
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const { secret, code } = body;
    if (!verifyCode(secret, String(code))) return json({ error: "Invalid authentication code." }, 400);
    await db.update(users).set({ twoFactorEnabled: true, twoFactorSecret: secret }).where(eq(users.id, ctx.user.id));
    return json({ ok: true });
  }

  if (action === "2fa-disable") {
    const ctx = await getApiContext();
    if ("error" in ctx) return ctx.error;
    const { code } = body;
    const rows = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    const u = rows[0];
    if (!u.twoFactorSecret || !verifyCode(u.twoFactorSecret, String(code))) {
      return json({ error: "Invalid authentication code." }, 400);
    }
    await db.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null }).where(eq(users.id, ctx.user.id));
    return json({ ok: true });
  }

  return json({ error: "Unknown action." }, 400);
}
