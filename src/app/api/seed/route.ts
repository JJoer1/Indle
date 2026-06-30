import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  users,
  pipelines,
  pipelineStages,
  customers,
  leads,
  deals,
  tasks,
  calendarEvents,
  notifications,
  activities,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { DEAL_STAGES } from "@/lib/constants";

type Role = "owner" | "manager" | "sales_rep" | "support_agent" | "viewer";
type CStatus = "lead" | "active" | "inactive" | "archived";
type CRating = "cold" | "warm" | "hot";
type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
type TType = "task" | "follow_up" | "call" | "meeting" | "reminder";
type TPriority = "low" | "medium" | "high" | "urgent";
type TRec = "none" | "daily" | "weekly" | "monthly";
type EType = "meeting" | "call" | "task" | "holiday" | "deadline";

const PWD = "Demo1234!";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function atTime(dayOffset: number, hour: number, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return d;
}

export async function GET() {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "owner@ddcrm.com"))
    .limit(1);
  if (existing.length) {
    return NextResponse.json({
      ok: true,
      seeded: false,
      email: "owner@ddcrm.com",
      password: PWD,
    });
  }

  const [company] = await db
    .insert(companies)
    .values({ name: "Acme Corporation", slug: "acme-corp", industry: "Technology", plan: "enterprise" })
    .returning();

  const teamDef: { name: string; email: string; role: Role; jobTitle: string }[] = [
    { name: "Sarah Chen", email: "owner@ddcrm.com", role: "owner", jobTitle: "Founder & CEO" },
    { name: "Alex Rivera", email: "alex@ddcrm.com", role: "manager", jobTitle: "Sales Manager" },
    { name: "Jordan Lee", email: "jordan@ddcrm.com", role: "sales_rep", jobTitle: "Senior Account Executive" },
    { name: "Priya Patel", email: "priya@ddcrm.com", role: "sales_rep", jobTitle: "Sales Development Rep" },
    { name: "Sam Kim", email: "sam@ddcrm.com", role: "support_agent", jobTitle: "Customer Success Lead" },
    { name: "Casey Morgan", email: "casey@ddcrm.com", role: "viewer", jobTitle: "Business Analyst" },
  ];
  const passwordHash = await hashPassword(PWD);
  const teamRows = await db
    .insert(users)
    .values(
      teamDef.map((t) => ({
        companyId: company.id,
        name: t.name,
        email: t.email,
        role: t.role,
        jobTitle: t.jobTitle,
        passwordHash,
        emailVerified: true,
        status: "active",
      }))
    )
    .returning();
  const byEmail = Object.fromEntries(teamRows.map((t) => [t.email, t]));
  const jordan = byEmail["jordan@ddcrm.com"].id;
  const priya = byEmail["priya@ddcrm.com"].id;
  const alex = byEmail["alex@ddcrm.com"].id;
  const sam = byEmail["sam@ddcrm.com"].id;
  const sarah = byEmail["owner@ddcrm.com"].id;

  const [pipeline] = await db
    .insert(pipelines)
    .values({ companyId: company.id, name: "Sales Pipeline", isDefault: true })
    .returning();
  const stageRows = await db
    .insert(pipelineStages)
    .values(
      DEAL_STAGES.map((s, i) => ({
        pipelineId: pipeline.id,
        name: s.label,
        stageOrder: i,
        probability: s.probability,
        color: s.color,
      }))
    )
    .returning();
  const stageByLabel = (label: string) => stageRows.find((s) => s.name === label)?.id ?? null;

  const custDefs = [
    { companyName: "Globex Industries", contactPerson: "Mark Thompson", email: "mark@globex.io", phone: "+1 555 0142", industry: "Manufacturing", status: "active", rating: "hot", assignedToId: jordan, annualRevenue: "2400000", city: "Austin", province: "TX", country: "USA", tags: ["enterprise", "priority"] },
    { companyName: "Initech Solutions", contactPerson: "Lisa Park", email: "lisa@initech.com", phone: "+1 555 0177", industry: "Technology", status: "active", rating: "warm", assignedToId: priya, annualRevenue: "980000", city: "Denver", province: "CO", country: "USA", tags: ["saas"] },
    { companyName: "Umbrella Health", contactPerson: "Dr. Alan Grant", email: "alan@umbrellahealth.com", phone: "+1 555 0199", industry: "Healthcare", status: "active", rating: "hot", assignedToId: jordan, annualRevenue: "5400000", city: "Boston", province: "MA", country: "USA", tags: ["enterprise"] },
    { companyName: "Stark Logistics", contactPerson: "Natasha R.", email: "natasha@starklog.com", phone: "+1 555 0123", industry: "Logistics", status: "active", rating: "warm", assignedToId: alex, annualRevenue: "1750000", city: "Chicago", province: "IL", country: "USA", tags: ["logistics"] },
    { companyName: "Wayne Retail", contactPerson: "Bruce W.", email: "bruce@wayneretail.com", phone: "+1 555 0188", industry: "Retail", status: "inactive", rating: "cold", assignedToId: priya, annualRevenue: "320000", city: "Gotham", province: "NY", country: "USA", tags: ["retail"] },
    { companyName: "Pied Piper", contactPerson: "Richard Hendricks", email: "richard@piedpiper.com", phone: "+1 555 0211", industry: "Technology", status: "lead", rating: "warm", assignedToId: jordan, annualRevenue: "0", city: "Palo Alto", province: "CA", country: "USA", tags: ["startup"] },
    { companyName: "Hooli Cloud", contactPerson: "Gavin Belson", email: "gavin@hooli.com", phone: "+1 555 0244", industry: "Technology", status: "active", rating: "hot", assignedToId: alex, annualRevenue: "8900000", city: "Mountain View", province: "CA", country: "USA", tags: ["enterprise", "priority"] },
    { companyName: "Soylent Foods", contactPerson: "Mia Wallace", email: "mia@soylentfoods.com", phone: "+1 555 0266", industry: "Retail", status: "active", rating: "warm", assignedToId: priya, annualRevenue: "670000", city: "Seattle", province: "WA", country: "USA", tags: ["retail"] },
    { companyName: "Cyberdyne Systems", contactPerson: "Miles Dyson", email: "miles@cyberdyne.ai", phone: "+1 555 0288", industry: "Technology", status: "lead", rating: "hot", assignedToId: jordan, annualRevenue: "0", city: "San Jose", province: "CA", country: "USA", tags: ["ai", "priority"] },
    { companyName: "Aperture Science", contactPerson: "Cave Johnson", email: "cave@aperture.com", phone: "+1 555 0299", industry: "Energy", status: "active", rating: "warm", assignedToId: sam, annualRevenue: "1200000", city: "Cleveland", province: "OH", country: "USA", tags: ["energy"] },
    { companyName: "Nakatomi Trading", contactPerson: "Hans Gruber", email: "hans@nakatomi.jp", phone: "+81 3 555 0100", industry: "Finance", status: "inactive", rating: "cold", assignedToId: alex, annualRevenue: "430000", city: "Tokyo", province: "", country: "Japan", tags: ["finance"] },
    { companyName: "Vandelay Imports", contactPerson: "Art Vandelay", email: "art@vandelay.com", phone: "+1 555 0301", industry: "Manufacturing", status: "active", rating: "warm", assignedToId: priya, annualRevenue: "890000", city: "New York", province: "NY", country: "USA", tags: ["import"] },
  ].map((c) => ({
    ...c,
    status: c.status as CStatus,
    rating: c.rating as CRating,
    companyId: company.id,
    createdBy: sarah,
  }));
  await db.insert(customers).values(custDefs);

  const leadDefs = [
    { name: "Emily Carter", company: "Quantum Dynamics", email: "emily@quantum.io", phone: "+1 555 1010", source: "Website", estimatedValue: "45000", probability: 20, status: "new", assignedToId: priya },
    { name: "Robert Lang", company: "Pym Technologies", email: "robert@pym.tech", phone: "+1 555 1020", source: "Referral", estimatedValue: "120000", probability: 40, status: "contacted", assignedToId: jordan },
    { name: "Diana Prince", company: "Themyscira Inc", email: "diana@themyscira.com", phone: "+1 555 1030", source: "Trade Show", estimatedValue: "85000", probability: 60, status: "qualified", assignedToId: alex },
    { name: "Clark Kent", company: "Daily Planet", email: "clark@dailyplanet.com", phone: "+1 555 1040", source: "Email Campaign", estimatedValue: "30000", probability: 70, status: "proposal", assignedToId: jordan },
    { name: "Peter Parker", company: "Bugle Media", email: "peter@bugle.com", phone: "+1 555 1050", source: "Social Media", estimatedValue: "22000", probability: 80, status: "negotiation", assignedToId: priya },
    { name: "Tony Stark", company: "Stark Enterprises", email: "tony@stark.com", phone: "+1 555 1060", source: "Referral", estimatedValue: "250000", probability: 100, status: "won", assignedToId: alex },
    { name: "Wanda M.", company: "Westview LLC", email: "wanda@westview.com", phone: "+1 555 1070", source: "Cold Call", estimatedValue: "15000", probability: 0, status: "lost", assignedToId: jordan },
    { name: "Stephen Strange", company: "Sanctum Co", email: "stephen@sanctum.com", phone: "+1 555 1080", source: "Website", estimatedValue: "67000", probability: 25, status: "new", assignedToId: priya },
    { name: "T'Challa", company: "Wakanda Tech", email: "tchalla@wakanda.com", phone: "+1 555 1090", source: "Partner", estimatedValue: "180000", probability: 50, status: "qualified", assignedToId: alex },
    { name: "Natasha R.", company: "Red Room", email: "natasha@redroom.com", phone: "+1 555 1100", source: "Advertisement", estimatedValue: "95000", probability: 90, status: "negotiation", assignedToId: jordan },
  ].map((l) => ({ ...l, status: l.status as LeadStatus, companyId: company.id }));
  await db.insert(leads).values(leadDefs);

    const dealDefs = [
      { name: "Globex — Enterprise License", value: "180000", stageName: "Proposal", assignedToId: jordan, close: 14 },
      { name: "Umbrella Health — Platform", value: "320000", stageName: "Negotiation", assignedToId: jordan, close: 7 },
      { name: "Hooli — Migration Project", value: "450000", stageName: "Qualified", assignedToId: alex, close: 30 },
      { name: "Initech — Starter Plan", value: "48000", stageName: "Proposal", assignedToId: priya, close: 10 },
      { name: "Cyberdyne — AI Suite", value: "210000", stageName: "New", assignedToId: jordan, close: 45 },
      { name: "Stark Logistics — Fleet Mgmt", value: "95000", stageName: "Won", assignedToId: alex, close: -5 },
      { name: "Soylent Foods — POS Integration", value: "38000", stageName: "Won", assignedToId: priya, close: -12 },
      { name: "Aperture — Energy Dashboard", value: "72000", stageName: "Lost", assignedToId: sam, close: -8 },
      { name: "Vandelay — Import Workflow", value: "54000", stageName: "Negotiation", assignedToId: priya, close: 5 },
      { name: "Nakatomi — Finance Module", value: "110000", stageName: "New", assignedToId: alex, close: 40 },
    ];
  await db.insert(deals).values(
    dealDefs.map((d) => ({
      companyId: company.id,
      pipelineId: pipeline.id,
      stageId: stageByLabel(d.stageName),
      name: d.name,
      value: d.value,
      currency: "ZAR",
      expectedCloseDate: fmt(atTime(d.close, 12)),
      assignedToId: d.assignedToId,
      products: [],
      notes: "",
      probability: 30,
    }))
  );

  const taskDefs = [
    { title: "Follow up with Globex on proposal", type: "follow_up", priority: "high", assignedToId: jordan, due: 1 },
    { title: "Call Umbrella Health — contract review", type: "call", priority: "urgent", assignedToId: jordan, due: 0 },
    { title: "Prepare Hooli migration deck", type: "task", priority: "medium", assignedToId: alex, due: 3 },
    { title: "Weekly pipeline review meeting", type: "meeting", priority: "medium", assignedToId: sarah, due: 2, recurrence: "weekly" },
    { title: "Send quote to Initech", type: "task", priority: "high", assignedToId: priya, due: 1 },
    { title: "Demo for Cyberdyne prospect", type: "meeting", priority: "high", assignedToId: jordan, due: 4 },
    { title: "Renew Soylent support contract", type: "reminder", priority: "low", assignedToId: sam, due: 6 },
    { title: "Update CRM tags for retail segment", type: "task", priority: "low", assignedToId: priya, due: -1 },
  ].map((t) => ({
    companyId: company.id,
    title: t.title,
    type: t.type as TType,
    priority: t.priority as TPriority,
    status: "todo" as const,
    assignedToId: t.assignedToId,
    dueDate: atTime(t.due, 9),
    recurrence: ((t as { recurrence?: string }).recurrence ?? "none") as TRec,
    createdBy: sarah,
  }));
  await db.insert(tasks).values(taskDefs);

  const eventDefs = [
    { title: "Hooli Discovery Call", type: "call", start: [0, 10], dur: 60, assignedToId: alex },
    { title: "Globex Demo Session", type: "meeting", start: [1, 14], dur: 60, assignedToId: jordan },
    { title: "Quarterly Review", type: "meeting", start: [2, 11], dur: 90, assignedToId: sarah },
    { title: "Initech Proposal Deadline", type: "deadline", start: [3, 17], dur: 30, assignedToId: priya },
    { title: "Company Holiday", type: "holiday", start: [5, 0], dur: 1440, assignedToId: null },
    { title: "Cyberdyne Tech Sync", type: "meeting", start: [4, 15], dur: 45, assignedToId: jordan },
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
      assignedToId: e.assignedToId,
      createdBy: sarah,
    };
  });
  await db.insert(calendarEvents).values(eventDefs);

  await db.insert(notifications).values([
    { companyId: company.id, userId: jordan, title: "New lead assigned", message: "Cyberdyne Systems — high value", type: "lead", read: false, link: "/leads" },
      { companyId: company.id, userId: sarah, title: "Deal moved to Won", message: "Stark Logistics closed for R95,000", type: "deal", read: false, link: "/deals" },
    { companyId: company.id, userId: priya, title: "Task due today", message: "Send quote to Initech", type: "task", read: false, link: "/tasks" },
    { companyId: company.id, title: "Monthly target at 78%", message: "You're on track to hit this month's revenue goal", type: "info", read: false },
    { companyId: company.id, userId: alex, title: "New comment", message: "Sarah commented on Hooli deal", type: "info", read: true },
  ]);

  await db.insert(activities).values([
      { companyId: company.id, userId: alex, type: "deal_moved", description: "Stark Logistics moved to Won (R95,000)", entityType: "deal" },
    { companyId: company.id, userId: jordan, type: "lead_created", description: "New lead “Stephen Strange” added", entityType: "lead" },
    { companyId: company.id, userId: priya, type: "customer_created", description: "Created customer “Pied Piper”", entityType: "customer" },
    { companyId: company.id, userId: sarah, type: "task_created", description: "Weekly pipeline review meeting scheduled", entityType: "task" },
    { companyId: company.id, userId: jordan, type: "deal_created", description: "Created deal “Globex — Enterprise License”", entityType: "deal" },
  ]);

  return NextResponse.json({
    ok: true,
    seeded: true,
    email: "owner@ddcrm.com",
    password: PWD,
    company: company.name,
  });
}
