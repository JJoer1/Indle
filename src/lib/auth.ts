import { compare, hash } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/db";
import {
  sessions,
  users,
  companies,
  activities,
  notifications,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { type Role, can } from "./constants";

export const SESSION_COOKIE = "dd_crm_session";
export const SESSION_DAYS_REMEMBER = 30;
export const SESSION_DAYS = 1;

export interface AuthUser {
  id: string;
  companyId: string | null;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  jobTitle: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  status: string;
}

export interface ApiCtx {
  user: AuthUser;
  companyId: string;
}

/* ----------------------------- Password ----------------------------- */
export async function hashPassword(password: string) {
  return hash(password, 10);
}
export async function verifyPassword(password: string, hashStr: string) {
  try {
    return await compare(password, hashStr);
  } catch {
    return false;
  }
}

/* ----------------------------- Helpers ----------------------------- */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}
async function userAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent");
}

/* ----------------------------- Session ----------------------------- */
export async function createSession(
  user: { id: string; companyId: string | null },
  remember: boolean
) {
  const days = remember ? SESSION_DAYS_REMEMBER : SESSION_DAYS;
  const expiresAt = new Date(Date.now() + days * 86400 * 1000);
  const token = randomUUID();
  await db.insert(sessions).values({
    token,
    userId: user.id,
    companyId: user.companyId,
    remember,
    expiresAt,
    ip: await clientIp(),
    userAgent: await userAgent(),
  });
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: days * 86400,
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return token;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      session: sessions,
      id: users.id,
      companyId: users.companyId,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarUrl: users.avatarUrl,
      jobTitle: users.jobTitle,
      emailVerified: users.emailVerified,
      twoFactorEnabled: users.twoFactorEnabled,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.session.expiresAt).getTime() < Date.now()) return null;
  if (row.status !== "active") return null;
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarUrl: row.avatarUrl,
    jobTitle: row.jobTitle,
    emailVerified: row.emailVerified,
    twoFactorEnabled: row.twoFactorEnabled,
    status: row.status,
  };
}

export async function resolveCompanyId(user: AuthUser): Promise<string | null> {
  if (user.companyId) return user.companyId;
  // super_admin without a company -> default to first tenant for demo scope
  const [first] = await db.select({ id: companies.id }).from(companies).limit(1);
  return first?.id ?? null;
}

export async function logout() {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {
      /* ignore */
    }
  }
  c.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
}

/* ----------------------------- API guards ----------------------------- */
export async function getApiContext(): Promise<ApiCtx | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const companyId = await resolveCompanyId(user);
  if (!companyId) {
    return { error: NextResponse.json({ error: "No tenant" }, { status: 403 }) };
  }
  return { user, companyId };
}

export async function requirePermission(
  permission: string
): Promise<ApiCtx | { error: NextResponse }> {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx;
  if (!can(ctx.user.role, permission)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return ctx;
}

/* ----------------------------- Side effects ----------------------------- */
export async function logActivity(
  ctx: ApiCtx,
  data: {
    type: string;
    description: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await db.insert(activities).values({
      companyId: ctx.companyId,
      userId: ctx.user.id,
      type: data.type,
      description: data.description,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata ?? {},
    });
  } catch {
    /* ignore */
  }
}

export async function createNotification(
  ctx: ApiCtx,
  data: {
    title: string;
    message?: string;
    type?: string;
    link?: string;
    userId?: string;
  }
) {
  try {
    await db.insert(notifications).values({
      companyId: ctx.companyId,
      userId: data.userId ?? ctx.user.id,
      title: data.title,
      message: data.message,
      type: data.type ?? "info",
      link: data.link,
    });
  } catch {
    /* ignore */
  }
}
