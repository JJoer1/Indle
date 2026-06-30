import { NextResponse } from "next/server";
import { db } from "@/db";
import { taskComments, users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth";

export async function GET(req: Request) {
  const ctx = await requirePermission("tasks:read");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "Missing taskId" }, { status: 400 });

  const items = await db
    .select({
      id: taskComments.id,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
      userName: users.name,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));

  return NextResponse.json({ items });
}
