import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, users } from "@/db/schema";
import { eq, and, or, ilike, isNull, isNotNull, desc, asc } from "drizzle-orm";
import { requirePermission, logActivity } from "@/lib/auth";

type CStatus = "lead" | "active" | "inactive" | "archived";
type CRating = "cold" | "warm" | "hot";

function sanitizeCustomer(body: Record<string, unknown>) {
  const tagsRaw = body.tags;
  let tags: string[] = [];
  if (Array.isArray(tagsRaw)) tags = tagsRaw.filter((t) => typeof t === "string");
  else if (typeof tagsRaw === "string" && tagsRaw.trim())
    tags = tagsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  return {
    companyName: (body.companyName as string) || "Untitled Customer",
    contactPerson: (body.contactPerson as string) || null,
    email: (body.email as string) || null,
    phone: (body.phone as string) || null,
    mobile: (body.mobile as string) || null,
    website: (body.website as string) || null,
    industry: (body.industry as string) || null,
    vatNumber: (body.vatNumber as string) || null,
    address: (body.address as string) || null,
    city: (body.city as string) || null,
    province: (body.province as string) || null,
    postalCode: (body.postalCode as string) || null,
    country: (body.country as string) || null,
    notes: (body.notes as string) || null,
    tags,
    assignedToId: (body.assignedToId as string) || null,
    status: ((body.status as string) || "active") as CStatus,
    rating: ((body.rating as string) || "warm") as CRating,
    annualRevenue: (body.annualRevenue as string) || "0",
    profilePictureUrl: (body.profilePictureUrl as string) || null,
  };
}

export async function GET(req: Request) {
  const ctx = await requirePermission("customers:read");
  if ("error" in ctx) return ctx.error;
  const url = new URL(req.url);
  const cid = ctx.companyId;

  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");
  const industry = url.searchParams.get("industry");
  const rating = url.searchParams.get("rating");
  const assignedTo = url.searchParams.get("assignedTo");
  const sort = url.searchParams.get("sort") || "createdAt";
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const view = url.searchParams.get("view");

  const conds = [eq(customers.companyId, cid)];
  if (view === "deleted") {
    conds.push(isNotNull(customers.deletedAt));
  } else if (view === "archived") {
    conds.push(isNotNull(customers.archivedAt), isNull(customers.deletedAt));
  } else {
    conds.push(isNull(customers.deletedAt), isNull(customers.archivedAt));
  }
  if (q) {
    const t = `%${q}%`;
    conds.push(
      or(
        ilike(customers.companyName, t),
        ilike(customers.contactPerson, t),
        ilike(customers.email, t),
        ilike(customers.phone, t)
      )!
    );
  }
  if (status && status !== "all") conds.push(eq(customers.status, status as CStatus));
  if (industry && industry !== "all") conds.push(eq(customers.industry, industry));
  if (rating && rating !== "all") conds.push(eq(customers.rating, rating as CRating));
  if (assignedTo && assignedTo !== "all") conds.push(eq(customers.assignedToId, assignedTo));

  const sortMap = {
    companyName: customers.companyName,
    contactPerson: customers.contactPerson,
    email: customers.email,
    createdAt: customers.createdAt,
    updatedAt: customers.updatedAt,
    annualRevenue: customers.annualRevenue,
    rating: customers.rating,
  } as const;
  const sortCol = sort in sortMap ? sortMap[sort as keyof typeof sortMap] : customers.createdAt;

  const rows = await db
    .select({
      id: customers.id,
      companyName: customers.companyName,
      contactPerson: customers.contactPerson,
      email: customers.email,
      phone: customers.phone,
      mobile: customers.mobile,
      website: customers.website,
      industry: customers.industry,
      vatNumber: customers.vatNumber,
      address: customers.address,
      city: customers.city,
      province: customers.province,
      postalCode: customers.postalCode,
      country: customers.country,
      notes: customers.notes,
      tags: customers.tags,
      assignedToId: customers.assignedToId,
      status: customers.status,
      rating: customers.rating,
      annualRevenue: customers.annualRevenue,
      profilePictureUrl: customers.profilePictureUrl,
      archivedAt: customers.archivedAt,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
      assignedToName: users.name,
    })
    .from(customers)
    .leftJoin(users, eq(customers.assignedToId, users.id))
    .where(and(...conds))
    .orderBy(order === "asc" ? asc(sortCol) : desc(sortCol))
    .limit(500);

  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) || "create";
  const ctx = await requirePermission("customers:write");
  if ("error" in ctx) return ctx.error;
  const cid = ctx.companyId;
  const uid = ctx.user.id;

  if (action === "import") {
    const items = (body.items as Record<string, unknown>[]) || [];
    if (!items.length) return NextResponse.json({ error: "No rows" }, { status: 400 });
    const rows = items.map((it) => ({ ...sanitizeCustomer(it), companyId: cid, createdBy: uid }));
    const inserted = await db.insert(customers).values(rows).returning({ id: customers.id });
    await logActivity(ctx, {
      type: "import",
      description: `Imported ${inserted.length} customers`,
      entityType: "customer",
    });
    return NextResponse.json({ ok: true, count: inserted.length });
  }

  if (action === "create") {
    const [item] = await db
      .insert(customers)
      .values({ ...sanitizeCustomer(body), companyId: cid, createdBy: uid })
      .returning();
    await logActivity(ctx, {
      type: "customer_created",
      description: `Created customer “${item.companyName}”`,
      entityType: "customer",
      entityId: item.id,
    });
    return NextResponse.json({ item });
  }

  if (action === "update") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const [item] = await db
      .update(customers)
      .set({ ...sanitizeCustomer(body), updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.companyId, cid)))
      .returning();
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await logActivity(ctx, {
      type: "customer_updated",
      description: `Updated customer “${item.companyName}”`,
      entityType: "customer",
      entityId: item.id,
    });
    return NextResponse.json({ item });
  }

  if (action === "archive") {
    await db
      .update(customers)
      .set({ archivedAt: new Date(), status: "archived", updatedAt: new Date() })
      .where(and(eq(customers.id, body.id), eq(customers.companyId, cid)));
    return NextResponse.json({ ok: true });
  }
  if (action === "restore") {
    await db
      .update(customers)
      .set({ archivedAt: null, status: "active", updatedAt: new Date() })
      .where(and(eq(customers.id, body.id), eq(customers.companyId, cid)));
    return NextResponse.json({ ok: true });
  }
  if (action === "delete") {
    await db
      .update(customers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(customers.id, body.id), eq(customers.companyId, cid)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
