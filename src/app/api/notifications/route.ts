import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { getApiContext } from "@/lib/auth";

export async function GET() {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const items = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.companyId, ctx.companyId),
        or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId))
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(30);
  const unread = items.filter((n) => !n.read).length;
  return NextResponse.json({ items, unread });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const action = (body.action as string) || "mark-read";
  const cid = ctx.companyId;

  if (action === "mark-all-read") {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.companyId, cid), or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId))));
    return NextResponse.json({ ok: true });
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, body.id), eq(notifications.companyId, cid)));
  return NextResponse.json({ ok: true });
}
