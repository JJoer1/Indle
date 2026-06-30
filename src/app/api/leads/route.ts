import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads, users } from "@/db/schema";
import { eq, and, or, like, isNull, desc } from "drizzle-orm";
import { requirePermission, logActivity } from "@/lib/auth";

type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export async function GET(req: Request) {
  const ctx = await requirePermission("leads:read");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  const conds = [eq(leads.companyId, ctx.companyId), isNull(leads.deletedAt)];
  if (q) {
    const t = `%${q}%`;
    conds.push(or(like(leads.name, t), like(leads.company, t), like(leads.email, t))!);
  }
  // Fetch leads with assigned user name
  const leadRows = await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      contactPerson: leads.contactPerson,
      email: leads.email,
      phone: leads.phone,
      source: leads.source,
      estimatedValue: leads.estimatedValue,
      probability: leads.probability,
      status: leads.status,
      notes: leads.notes,
      assignedToId: leads.assignedToId,
      assignedToName: users.name,
      createdBy: leads.createdBy,
      customerId: leads.customerId,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .leftJoin(users, eq(leads.assignedToId, users.id))
    .where(and(...conds))
    .orderBy(desc(leads.updatedAt));

  // Get all users in the company to resolve creator names safely
  const companyUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.companyId, ctx.companyId));

  const nameById = new Map(companyUsers.map(u => [u.id, u.name]));

  const items = leadRows.map(row => ({
    ...row,
    createdByName: row.createdBy ? (nameById.get(row.createdBy) ?? null) : null,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "create";
  const ctx = await requirePermission("leads:write");
  if ("error" in ctx) return ctx.error;
  const cid = ctx.companyId;

  const data = {
    name: (body.name as string) || "Untitled Lead",
    company: (body.company as string) || null,
    contactPerson: (body.contactPerson as string) || null,
    email: (body.email as string) || null,
    phone: (body.phone as string) || null,
    source: (body.source as string) || null,
    estimatedValue: (body.estimatedValue as string) || "0",
    probability: typeof body.probability === "number" ? body.probability : 20,
    status: ((body.status as string) || "new") as LeadStatus,
    notes: (body.notes as string) || null,
    assignedToId: (body.assignedToId as string) || null,
  };

  if (action === "create") {
    const [item] = await db.insert(leads).values({ ...data, companyId: cid, createdBy: ctx.user.id }).returning();
    await logActivity(ctx, {
      type: "lead_created",
      description: `New lead “${item.name}”`,
      entityType: "lead",
      entityId: item.id,
    });
    return NextResponse.json({ item });
  }

  if (action === "update") {
    const [item] = await db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(leads.id, body.id), eq(leads.companyId, cid)))
      .returning();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  }

  if (action === "move") {
    const status = (body.status as LeadStatus) || "new";
    const [item] = await db
      .update(leads)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(leads.id, body.id), eq(leads.companyId, cid)))
      .returning();
    if (item) {
      await logActivity(ctx, {
        type: "lead_moved",
        description: `Moved “${item.name}” to ${status}`,
        entityType: "lead",
        entityId: item.id,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    await db
      .update(leads)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(leads.id, body.id), eq(leads.companyId, cid)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
