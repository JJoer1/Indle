import { NextResponse } from "next/server";
import { db } from "@/db";
import { deals, pipelines, pipelineStages, users, customers as customersTable } from "@/db/schema";
import { eq, and, or, ilike, isNull, asc, inArray } from "drizzle-orm";
import { requirePermission, logActivity } from "@/lib/auth";
import type { DealProduct } from "@/db/schema";

export async function GET(req: Request) {
  const ctx = await requirePermission("deals:read");
  if ("error" in ctx) return ctx.error;
  const cid = ctx.companyId;
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const stageId = url.searchParams.get("stageId");

  const pipelineRows = await db.select().from(pipelines).where(eq(pipelines.companyId, cid));
  const pipelineIds = pipelineRows.map((p) => p.id);
  const stageRows = pipelineIds.length
    ? await db
        .select()
        .from(pipelineStages)
        .where(inArray(pipelineStages.pipelineId, pipelineIds))
        .orderBy(asc(pipelineStages.stageOrder))
    : [];

  const conds = [eq(deals.companyId, cid), isNull(deals.deletedAt)];
  if (q) conds.push(or(ilike(deals.name, `%${q}%`))!);
  if (stageId && stageId !== "all") conds.push(eq(deals.stageId, stageId));

  const items = await db
    .select({
      id: deals.id,
      name: deals.name,
      value: deals.value,
      currency: deals.currency,
      expectedCloseDate: deals.expectedCloseDate,
      assignedToId: deals.assignedToId,
      assignedToName: users.name,
      customerId: deals.customerId,
      customerName: customersTable.companyName,
      pipelineId: deals.pipelineId,
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      products: deals.products,
      notes: deals.notes,
      probability: deals.probability,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
    })
    .from(deals)
    .leftJoin(users, eq(deals.assignedToId, users.id))
    .leftJoin(customersTable, eq(deals.customerId, customersTable.id))
    .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(and(...conds))
    .orderBy(asc(deals.createdAt));

  return NextResponse.json({ items, pipelines: pipelineRows, stages: stageRows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "create";
  const ctx = await requirePermission("deals:write");
  if ("error" in ctx) return ctx.error;
  const cid = ctx.companyId;

  if (action === "create") {
    let pipelineId = (body.pipelineId as string) || null;
    if (!pipelineId) {
      const [def] = await db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.companyId, cid), eq(pipelines.isDefault, true)))
        .limit(1);
      pipelineId = def?.id ?? null;
      if (!pipelineId) {
        const [created] = await db
          .insert(pipelines)
          .values({ companyId: cid, name: "Sales Pipeline", isDefault: true })
          .returning();
        pipelineId = created.id;
      }
    }
    let stageId = (body.stageId as string) || null;
    if (!stageId) {
      const [first] = await db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipelineId!))
        .orderBy(asc(pipelineStages.stageOrder))
        .limit(1);
      stageId = first?.id ?? null;
    }
    const [item] = await db
      .insert(deals)
      .values({
        companyId: cid,
        pipelineId,
        stageId,
        name: (body.name as string) || "Untitled Deal",
        value: (body.value as string) || "0",
        currency: (body.currency as string) || "ZAR",
        expectedCloseDate: (body.expectedCloseDate as string) || null,
        assignedToId: (body.assignedToId as string) || null,
        customerId: (body.customerId as string) || null,
        products: (body.products as DealProduct[]) || [],
        notes: (body.notes as string) || null,
        probability: typeof body.probability === "number" ? body.probability : 10,
      })
      .returning();
    await logActivity(ctx, {
      type: "deal_created",
      description: `Created deal “${item.name}”`,
      entityType: "deal",
      entityId: item.id,
    });
    return NextResponse.json({ item });
  }

  if (action === "update") {
    const products = (body.products as DealProduct[]) ?? [];
    const [item] = await db
      .update(deals)
      .set({
        name: (body.name as string) || undefined,
        value: (body.value as string) || undefined,
        expectedCloseDate: (body.expectedCloseDate as string) || undefined,
        assignedToId: (body.assignedToId as string) || undefined,
        customerId: (body.customerId as string) || undefined,
        stageId: (body.stageId as string) || undefined,
        products: products.length ? products : undefined,
        notes: body.notes !== undefined ? (body.notes as string) : undefined,
        probability: typeof body.probability === "number" ? body.probability : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(deals.id, body.id), eq(deals.companyId, cid)))
      .returning();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logActivity(ctx, {
      type: "deal_updated",
      description: `Updated deal “${item.name}”`,
      entityType: "deal",
      entityId: item.id,
    });
    return NextResponse.json({ item });
  }

  if (action === "move") {
    const [item] = await db
      .update(deals)
      .set({ stageId: body.stageId, updatedAt: new Date() })
      .where(and(eq(deals.id, body.id), eq(deals.companyId, cid)))
      .returning();
    if (item)
      await logActivity(ctx, {
        type: "deal_moved",
        description: `Moved “${item.name}”`,
        entityType: "deal",
        entityId: item.id,
      });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    await db
      .update(deals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(deals.id, body.id), eq(deals.companyId, cid)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
