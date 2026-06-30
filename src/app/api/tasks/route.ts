import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, taskComments, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requirePermission, logActivity, createNotification } from "@/lib/auth";

type TStatus = "todo" | "in_progress" | "done" | "deferred";
type TPriority = "low" | "medium" | "high" | "urgent";
type TType = "task" | "follow_up" | "call" | "meeting" | "reminder";
type TRec = "none" | "daily" | "weekly" | "monthly";

export async function GET(req: Request) {
  const ctx = await requirePermission("tasks:read");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const mine = url.searchParams.get("mine") === "1";

  const conds = [eq(tasks.companyId, ctx.companyId)];
  if (status && status !== "all") conds.push(eq(tasks.status, status as TStatus));
  if (mine) conds.push(eq(tasks.assignedToId, ctx.user.id));

  const items = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      type: tasks.type,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      assignedToId: tasks.assignedToId,
      assignedToName: users.name,
      relatedType: tasks.relatedType,
      relatedId: tasks.relatedId,
      recurrence: tasks.recurrence,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assignedToId, users.id))
    .where(and(...conds))
    .orderBy(desc(tasks.dueDate));

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "create";
  const ctx = await requirePermission("tasks:write");
  if ("error" in ctx) return ctx.error;
  const cid = ctx.companyId;

  const data = {
    title: (body.title as string) || "Untitled Task",
    description: (body.description as string) || null,
    type: ((body.type as string) || "task") as TType,
    status: ((body.status as string) || "todo") as TStatus,
    priority: ((body.priority as string) || "medium") as TPriority,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    assignedToId: (body.assignedToId as string) || null,
    relatedType: (body.relatedType as string) || null,
    relatedId: (body.relatedId as string) || null,
    recurrence: ((body.recurrence as string) || "none") as TRec,
  };

  if (action === "create") {
    const [item] = await db
      .insert(tasks)
      .values({ ...data, companyId: cid, createdBy: ctx.user.id })
      .returning();
    await logActivity(ctx, {
      type: "task_created",
      description: `Created task “${item.title}”`,
      entityType: "task",
      entityId: item.id,
    });
    if (item.assignedToId && item.assignedToId !== ctx.user.id) {
      await createNotification(ctx, {
        userId: item.assignedToId,
        title: "New task assigned",
        message: item.title,
        type: "task",
        link: "/tasks",
      });
    }
    return NextResponse.json({ item });
  }

  if (action === "update") {
    // Support partial updates (e.g. just changing status from the board)
    const patch: Record<string, any> = { updatedAt: new Date() };

    if (body.status !== undefined) patch.status = body.status;
    if (body.title !== undefined) patch.title = body.title;
    if (body.description !== undefined) patch.description = body.description;
    if (body.type !== undefined) patch.type = body.type;
    if (body.priority !== undefined) patch.priority = body.priority;
    if (body.dueDate !== undefined) patch.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.assignedToId !== undefined) patch.assignedToId = body.assignedToId || null;
    if (body.recurrence !== undefined) patch.recurrence = body.recurrence;

    const [item] = await db
      .update(tasks)
      .set(patch)
      .where(and(eq(tasks.id, body.id), eq(tasks.companyId, cid)))
      .returning();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  }

  if (action === "complete") {
    const [t] = await db
      .update(tasks)
      .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.id, body.id), eq(tasks.companyId, cid)))
      .returning();
    if (t && t.recurrence !== "none" && t.dueDate) {
      const next = new Date(t.dueDate);
      if (t.recurrence === "daily") next.setDate(next.getDate() + 1);
      if (t.recurrence === "weekly") next.setDate(next.getDate() + 7);
      if (t.recurrence === "monthly") next.setMonth(next.getMonth() + 1);
      await db.insert(tasks).values({
        companyId: cid,
        title: t.title,
        description: t.description,
        type: t.type,
        priority: t.priority,
        dueDate: next,
        assignedToId: t.assignedToId,
        createdBy: ctx.user.id,
        relatedType: t.relatedType,
        relatedId: t.relatedId,
        recurrence: t.recurrence,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "comment") {
    const [c] = await db
      .insert(taskComments)
      .values({ taskId: body.id, userId: ctx.user.id, body: body.body })
      .returning();
    return NextResponse.json({ comment: c });
  }

  if (action === "delete") {
    await db.delete(tasks).where(and(eq(tasks.id, body.id), eq(tasks.companyId, cid)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
