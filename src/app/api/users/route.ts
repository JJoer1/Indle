import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiContext, hashPassword } from "@/lib/auth";
import { can } from "@/lib/constants";

export async function GET() {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const team = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      avatarUrl: users.avatarUrl,
      jobTitle: users.jobTitle,
    })
    .from(users)
    .where(eq(users.companyId, ctx.companyId));
  return Response.json({ team, me: ctx.user });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;

  // Only owner or super_admin can create users
  if (!can(ctx.user.role, "*") && ctx.user.role !== "owner") {
    return NextResponse.json({ error: "Only owners can add users" }, { status: 403 });
  }

  const { name, email, password, role, jobTitle } = body;

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate role
  const validRoles = ["manager", "sales_rep", "support_agent", "viewer", "technician"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Check if email already exists
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      companyId: ctx.companyId,
      name,
      email,
      passwordHash,
      role,
      jobTitle: jobTitle || null,
      emailVerified: true,
      status: "active",
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      jobTitle: users.jobTitle,
    });

  return NextResponse.json({ user: newUser });
}
