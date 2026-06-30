/**
 * Create a CRM user + company with seeded demo data.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/create-user.ts <email> <password> [name] [companyName]
 *
 * Example:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/create-user.ts \
 *     caroline@indleladata.co.za "2015@Indlela" "Caroline" "Indlela Data"
 *
 * - Reads DATABASE_URL from the environment (falls back to .env).
 * - If the user already exists, the password is updated and the account is reactivated.
 * - Creates a company + default pipeline + demo customers/leads/deals/tasks/events.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../src/db";
import {
  users,
  companies,
  pipelines,
  pipelineStages,
  customers,
  leads,
  deals,
  tasks,
  calendarEvents,
  notifications,
  activities,
} from "../src/db/schema";
import { DEAL_STAGES } from "../src/lib/constants";

type Role = "owner";
type CStatus = "lead" | "active" | "inactive" | "archived";
type CRating = "cold" | "warm" | "hot";
type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
type TType = "task" | "follow_up" | "call" | "meeting" | "reminder";
type TPriority = "low" | "medium" | "high" | "urgent";
type TRec = "none" | "daily" | "weekly" | "monthly";
type EType = "meeting" | "call" | "task" | "holiday" | "deadline";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function atTime(dayOffset: number, hour: number, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return d;
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];
  const name = process.argv[4] || email.split("@")[0].replace(/^./, (c) => c.toUpperCase());
  const companyName = process.argv[5] || `${name}'s Company`;

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-user.ts <email> <password> [name] [companyName]");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  console.log(`→ DB host: ${(process.env.DATABASE_URL || "").match(/@([^:/]+)/)?.[1] || "(local)"}`);

  // ---- Resolve or create company ----
  let company = (
    await db.select().from(companies).where(eq(companies.slug, companyName.toLowerCase().replace(/\s+/g, "-"))).limit(1)
  )[0];
  if (!company) {
    [company] = await db
      .insert(companies)
      .values({ name: companyName, slug: `${companyName.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 5)}`, industry: "Technology", plan: "enterprise" })
      .returning();
    console.log(`✓ Created company "${company.name}"`);
  } else {
    console.log(`• Using existing company "${company.name}"`);
  }

  // ---- Create or update user ----
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  let user;
  if (existing) {
    [user] = await db
      .update(users)
      .set({ passwordHash, name, companyId: company.id, role: "owner" as Role, status: "active", emailVerified: true })
      .where(eq(users.id, existing.id))
      .returning();
    console.log(`✓ Updated existing user ${email}`);
  } else {
    [user] = await db
      .insert(users)
      .values({ companyId: company.id, name, email, passwordHash, role: "owner" as Role, jobTitle: "Company Owner", emailVerified: true, status: "active" })
      .returning();
    console.log(`✓ Created user ${email}`);
  }

  // ---- Pipeline + stages (idempotent) ----
  let pipeline = (await db.select().from(pipelines).where(eq(pipelines.companyId, company.id)).limit(1))[0];
  if (!pipeline) {
    [pipeline] = await db.insert(pipelines).values({ companyId: company.id, name: "Sales Pipeline", isDefault: true }).returning();
  }
  const existingStages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipeline.id));
  let stages = existingStages;
  if (existingStages.length === 0) {
    stages = await db
      .insert(pipelineStages)
      .values(DEAL_STAGES.map((s, i) => ({ pipelineId: pipeline!.id, name: s.label, stageOrder: i, probability: s.probability, color: s.color })))
      .returning();
  }
  const stageByLabel = (label: string) => stages.find((s) => s.name === label)?.id ?? null;

  // Only seed demo data if the company is empty (avoid duplicates).
  const custCount = (await db.select().from(customers).where(eq(customers.companyId, company.id))).length;
  if (custCount > 0) {
    console.log(`• Company already has ${custCount} customers — skipping demo seed.`);
  } else {
    const uid = user.id;

    const custDefs = [
      { companyName: "Globex Industries", contactPerson: "Mark Thompson", email: "mark@globex.io", phone: "+27 21 0142", industry: "Manufacturing", status: "active", rating: "hot", annualRevenue: "2400000", city: "Cape Town", province: "WC", country: "South Africa", tags: ["enterprise", "priority"] },
      { companyName: "Initech Solutions", contactPerson: "Lisa Park", email: "lisa@initech.com", phone: "+27 11 0177", industry: "Technology", status: "active", rating: "warm", annualRevenue: "980000", city: "Johannesburg", province: "GP", country: "South Africa", tags: ["saas"] },
      { companyName: "Umbrella Health", contactPerson: "Dr. Alan Grant", email: "alan@umbrellahealth.com", phone: "+27 31 0199", industry: "Healthcare", status: "active", rating: "hot", annualRevenue: "5400000", city: "Durban", province: "KZN", country: "South Africa", tags: ["enterprise"] },
      { companyName: "Stark Logistics", contactPerson: "Natasha R.", email: "natasha@starklog.com", phone: "+27 12 0123", industry: "Logistics", status: "active", rating: "warm", annualRevenue: "1750000", city: "Pretoria", province: "GP", country: "South Africa", tags: ["logistics"] },
      { companyName: "Wayne Retail", contactPerson: "Bruce W.", email: "bruce@wayneretail.com", phone: "+27 21 0188", industry: "Retail", status: "inactive", rating: "cold", annualRevenue: "320000", city: "Cape Town", province: "WC", country: "South Africa", tags: ["retail"] },
      { companyName: "Pied Piper", contactPerson: "Richard Hendricks", email: "richard@piedpiper.com", phone: "+27 11 0211", industry: "Technology", status: "lead", rating: "warm", annualRevenue: "0", city: "Johannesburg", province: "GP", country: "South Africa", tags: ["startup"] },
      { companyName: "Hooli Cloud", contactPerson: "Gavin Belson", email: "gavin@hooli.com", phone: "+27 11 0244", industry: "Technology", status: "active", rating: "hot", annualRevenue: "8900000", city: "Sandton", province: "GP", country: "South Africa", tags: ["enterprise", "priority"] },
      { companyName: "Soylent Foods", contactPerson: "Mia Wallace", email: "mia@soylentfoods.com", phone: "+27 31 0266", industry: "Retail", status: "active", rating: "warm", annualRevenue: "670000", city: "Durban", province: "KZN", country: "South Africa", tags: ["retail"] },
    ].map((c) => ({ ...c, status: c.status as CStatus, rating: c.rating as CRating, companyId: company.id, createdBy: uid, assignedToId: uid }));
    await db.insert(customers).values(custDefs);

    const leadDefs = [
      { name: "Emily Carter", company: "Quantum Dynamics", email: "emily@quantum.io", phone: "+27 21 1010", source: "Website", estimatedValue: "45000", probability: 20, status: "new", assignedToId: uid },
      { name: "Robert Lang", company: "Pym Technologies", email: "robert@pym.tech", phone: "+27 11 1020", source: "Referral", estimatedValue: "120000", probability: 40, status: "contacted", assignedToId: uid },
      { name: "Diana Prince", company: "Themyscira Inc", email: "diana@themyscira.com", phone: "+27 31 1030", source: "Trade Show", estimatedValue: "85000", probability: 60, status: "qualified", assignedToId: uid },
      { name: "Clark Kent", company: "Daily Planet", email: "clark@dailyplanet.com", phone: "+27 11 1040", source: "Email Campaign", estimatedValue: "30000", probability: 70, status: "proposal", assignedToId: uid },
      { name: "Peter Parker", company: "Bugle Media", email: "peter@bugle.com", phone: "+27 21 1050", source: "Social Media", estimatedValue: "22000", probability: 80, status: "negotiation", assignedToId: uid },
      { name: "Tony Stark", company: "Stark Enterprises", email: "tony@stark.com", phone: "+27 11 1060", source: "Referral", estimatedValue: "250000", probability: 100, status: "won", assignedToId: uid },
      { name: "Wanda M.", company: "Westview LLC", email: "wanda@westview.com", phone: "+27 31 1070", source: "Cold Call", estimatedValue: "15000", probability: 0, status: "lost", assignedToId: uid },
      { name: "Stephen Strange", company: "Sanctum Co", email: "stephen@sanctum.com", phone: "+27 21 1080", source: "Website", estimatedValue: "67000", probability: 25, status: "new", assignedToId: uid },
    ].map((l) => ({ ...l, status: l.status as LeadStatus, companyId: company.id }));
    await db.insert(leads).values(leadDefs);

    const dealDefs = [
      { name: "Globex — Enterprise License", value: "180000", stageName: "Proposal", close: 14 },
      { name: "Umbrella Health — Platform", value: "320000", stageName: "Negotiation", close: 7 },
      { name: "Hooli — Migration Project", value: "450000", stageName: "Qualified", close: 30 },
      { name: "Initech — Starter Plan", value: "48000", stageName: "Proposal", close: 10 },
      { name: "Stark Logistics — Fleet Mgmt", value: "95000", stageName: "Won", close: -5 },
      { name: "Soylent Foods — POS Integration", value: "38000", stageName: "Won", close: -12 },
      { name: "Wayne Retail — Upgrade", value: "54000", stageName: "Negotiation", close: 5 },
    ];
    await db.insert(deals).values(
      dealDefs.map((d) => ({
        companyId: company.id,
        pipelineId: pipeline!.id,
        stageId: stageByLabel(d.stageName),
        name: d.name,
        value: d.value,
        currency: "USD",
        expectedCloseDate: fmt(atTime(d.close, 12)),
        assignedToId: uid,
        products: [],
        notes: "",
        probability: 30,
      }))
    );

    const taskDefs = [
      { title: "Follow up with Globex on proposal", type: "follow_up", priority: "high", due: 1 },
      { title: "Call Umbrella Health — contract review", type: "call", priority: "urgent", due: 0 },
      { title: "Prepare Hooli migration deck", type: "task", priority: "medium", due: 3 },
      { title: "Weekly pipeline review meeting", type: "meeting", priority: "medium", due: 2, recurrence: "weekly" },
      { title: "Send quote to Initech", type: "task", priority: "high", due: 1 },
      { title: "Renew Soylent support contract", type: "reminder", priority: "low", due: 6 },
    ].map((t) => ({
      companyId: company.id,
      title: t.title,
      type: t.type as TType,
      priority: t.priority as TPriority,
      status: "todo" as const,
      assignedToId: uid,
      createdBy: uid,
      dueDate: atTime(t.due, 9),
      recurrence: ("recurrence" in t ? t.recurrence : "none") as TRec,
    }));
    await db.insert(tasks).values(taskDefs);

    const eventDefs = [
      { title: "Hooli Discovery Call", type: "call", start: [0, 10], dur: 60 },
      { title: "Globex Demo Session", type: "meeting", start: [1, 14], dur: 60 },
      { title: "Quarterly Review", type: "meeting", start: [2, 11], dur: 90 },
      { title: "Initech Proposal Deadline", type: "deadline", start: [3, 17], dur: 30 },
      { title: "Public Holiday", type: "holiday", start: [5, 0], dur: 1440 },
    ].map((e) => {
      const start = atTime(e.start[0], e.start[1]);
      const end = new Date(start.getTime() + e.dur * 60000);
      return {
        companyId: company.id,
        title: e.title,
        type: e.type as EType,
        startAt: start,
        endAt: end,
        allDay: e.type === "holiday",
        assignedToId: uid,
        createdBy: uid,
      };
    });
    await db.insert(calendarEvents).values(eventDefs);

    await db.insert(notifications).values([
      { companyId: company.id, userId: uid, title: "Welcome to DD CRM 🎉", message: "Your workspace is ready. Here's some sample data to explore.", type: "info", read: false, link: "/dashboard" },
      { companyId: company.id, userId: uid, title: "Deal moved to Won", message: "Stark Logistics closed for $95,000", type: "deal", read: false, link: "/deals" },
      { companyId: company.id, userId: uid, title: "Task due today", message: "Call Umbrella Health — contract review", type: "task", read: false, link: "/tasks" },
    ]);

    await db.insert(activities).values([
      { companyId: company.id, userId: uid, type: "deal_moved", description: "Stark Logistics moved to Won ($95,000)", entityType: "deal" },
      { companyId: company.id, userId: uid, type: "customer_created", description: "Created customer “Globex Industries”", entityType: "customer" },
      { companyId: company.id, userId: uid, type: "lead_created", description: "New lead “Emily Carter” added", entityType: "lead" },
    ]);

    console.log(`✓ Seeded demo data (8 customers, 8 leads, 7 deals, 6 tasks, 5 events)`);
  }

  console.log("\n──────────────────────────────────────");
  console.log("✅ User ready");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Company:  ${company.name} (${user.role})`);
  console.log(`   Login:    /login`);
  console.log("──────────────────────────────────────\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Failed:", err);
  process.exit(1);
});
