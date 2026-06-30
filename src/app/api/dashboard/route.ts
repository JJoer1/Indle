import { db } from "@/db";
import {
  deals,
  pipelineStages,
  customers,
  leads,
  tasks,
  activities,
  users,
} from "@/db/schema";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { getApiContext } from "@/lib/auth";

export async function GET() {
  const ctx = await getApiContext();
  if ("error" in ctx) return ctx.error;
  const cid = ctx.companyId;

  const [allDeals, allCustomers, allLeads, allTasks, recentActivity, team] =
    await Promise.all([
      db
        .select({ deal: deals, stageName: pipelineStages.name })
        .from(deals)
        .leftJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
        .where(and(eq(deals.companyId, cid), isNull(deals.deletedAt))),
      db
        .select()
        .from(customers)
        .where(and(eq(customers.companyId, cid), isNull(customers.deletedAt))),
      db
        .select()
        .from(leads)
        .where(and(eq(leads.companyId, cid), isNull(leads.deletedAt))),
      db.select().from(tasks).where(eq(tasks.companyId, cid)),
      db
        .select()
        .from(activities)
        .where(eq(activities.companyId, cid))
        .orderBy(desc(activities.createdAt))
        .limit(8),
      db
        .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl, role: users.role, jobTitle: users.jobTitle })
        .from(users)
        .where(eq(users.companyId, cid)),
    ]);

  const teamMap = new Map(team.map((t: { id: string }) => [t.id, t]));
  const now = new Date();

  const wonDeals = allDeals.filter((d) => d.stageName?.toLowerCase() === "won");
  const lostDeals = allDeals.filter((d) => d.stageName?.toLowerCase() === "lost");
  const openDeals = allDeals.filter(
    (d) => d.stageName?.toLowerCase() !== "won" && d.stageName?.toLowerCase() !== "lost"
  );

  const revenue = wonDeals.reduce((s, d) => s + parseFloat(d.deal.value ?? "0"), 0);
  const pipelineValue = openDeals.reduce((s, d) => s + parseFloat(d.deal.value ?? "0"), 0);

  const activeCustomers = allCustomers.filter((c) => c.status === "active").length;
  const newCustomers = allCustomers.filter(
    (c) => new Date(c.createdAt).getMonth() === now.getMonth() && new Date(c.createdAt).getFullYear() === now.getFullYear()
  ).length;

  // monthly sales (last 6 months)
  const monthly: { month: string; revenue: number; deals: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString("en-US", { month: "short" });
    const monthWon = wonDeals.filter((wd) => {
      const ref = wd.deal.expectedCloseDate ? new Date(wd.deal.expectedCloseDate) : new Date(wd.deal.updatedAt);
      return ref.getMonth() === d.getMonth() && ref.getFullYear() === d.getFullYear();
    });
    monthly.push({
      month: label,
      revenue: Math.round(monthWon.reduce((s, wd) => s + parseFloat(wd.deal.value ?? "0"), 0)),
      deals: monthWon.length,
    });
  }

  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const tasksDueToday = allTasks.filter(
    (t) =>
      t.dueDate &&
      t.status !== "done" &&
      new Date(t.dueDate).getTime() >= startToday.getTime() &&
      new Date(t.dueDate).getTime() <= endToday.getTime()
  );

  // top performers by won deal value
  const perfMap = new Map<string, number>();
  for (const wd of wonDeals) {
    const uid = wd.deal.assignedToId;
    if (!uid) continue;
    perfMap.set(uid, (perfMap.get(uid) ?? 0) + parseFloat(wd.deal.value ?? "0"));
  }
  const topPerformers = [...perfMap.entries()]
    .map(([id, value]) => ({ user: teamMap.get(id), value }))
    .filter((p) => p.user)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const wonLeads = allLeads.filter((l) => l.status === "won").length;
  const lostLeadsCount = allLeads.filter((l) => l.status === "lost").length;
  const leadConversion = wonLeads + lostLeadsCount > 0
    ? Math.round((wonLeads / (wonLeads + lostLeadsCount)) * 100)
    : 0;

  return Response.json({
    stats: {
      revenue: Math.round(revenue),
      pipelineValue: Math.round(pipelineValue),
      activeCustomers,
      newCustomers,
      dealsWon: wonDeals.length,
      dealsLost: lostDeals.length,
      openDeals: openDeals.length,
      totalCustomers: allCustomers.length,
      totalLeads: allLeads.length,
      tasksDueToday: tasksDueToday.length,
      leadConversion,
    },
    monthly,
    topPerformers,
    recentActivity,
    team,
    dealsByStage: allDeals.reduce<Record<string, { count: number; value: number }>>((acc, d) => {
      const key = d.stageName ?? "Unassigned";
      if (!acc[key]) acc[key] = { count: 0, value: 0 };
      acc[key].count++;
      acc[key].value += parseFloat(d.deal.value ?? "0");
      return acc;
    }, {}),
  });
}
