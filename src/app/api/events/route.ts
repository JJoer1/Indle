import { NextResponse } from "next/server";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { requirePermission } from "@/lib/auth";

type EType = "meeting" | "call" | "task" | "holiday" | "deadline";

export async function GET(req: Request) {
  const ctx = await requirePermission("calendar:read");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const conds = [eq(calendarEvents.companyId, ctx.companyId)];
  if (start) conds.push(lte(calendarEvents.startAt, new Date(end || start)));
  if (end) conds.push(gte(calendarEvents.endAt, new Date(start || end)));

  const items = await db
    .select()
    .from(calendarEvents)
    .where(and(...conds))
    .orderBy(calendarEvents.startAt);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "create";
  const ctx = await requirePermission("calendar:write");
  if ("error" in ctx) return ctx.error;
  const cid = ctx.companyId;

  const data = {
    title: (body.title as string) || "Untitled Event",
    description: (body.description as string) || null,
    type: ((body.type as string) || "meeting") as EType,
    startAt: new Date(body.startAt as string),
    endAt: new Date(body.endAt as string),
    allDay: !!body.allDay,
    location: (body.location as string) || null,
    assignedToId: (body.assignedToId as string) || null,
    relatedType: (body.relatedType as string) || null,
    relatedId: (body.relatedId as string) || null,
  };

  if (action === "create") {
    const [item] = await db
      .insert(calendarEvents)
      .values({ ...data, companyId: cid, createdBy: ctx.user.id })
      .returning();
    return NextResponse.json({ item });
  }
  if (action === "update") {
    const [item] = await db
      .update(calendarEvents)
      .set(data)
      .where(and(eq(calendarEvents.id, body.id), eq(calendarEvents.companyId, cid)))
      .returning();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  }
  if (action === "delete") {
    await db.delete(calendarEvents).where(and(eq(calendarEvents.id, body.id), eq(calendarEvents.companyId, cid)));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
