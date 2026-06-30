"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Users,
  UserPlus,
  Trophy,
  Target,
  Percent,
  CalendarClock,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { useApp } from "@/components/AppShell";
import { Card, Spinner, Avatar, Badge } from "@/components/ui";
import { apiFetch, formatCurrency, formatNumber, timeAgo } from "@/lib/utils";

type DashboardData = {
  stats: {
    revenue: number;
    pipelineValue: number;
    activeCustomers: number;
    newCustomers: number;
    dealsWon: number;
    dealsLost: number;
    openDeals: number;
    totalCustomers: number;
    totalLeads: number;
    tasksDueToday: number;
    leadConversion: number;
  };
  monthly: { month: string; revenue: number; deals: number }[];
  topPerformers: { user: { name: string; avatarUrl: string | null; jobTitle: string | null }; value: number }[];
  recentActivity: { id: string; type: string; description: string; createdAt: string }[];
  dealsByStage: Record<string, { count: number; value: number }>;
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-slate-300">
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

const STAGE_COLORS = ["#3b82f6", "#06b6d4", "#f59e0b", "#f97316", "#10b981", "#ef4444"];

export default function DashboardPage() {
  const { user } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardData>("/api/dashboard")
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const stats = [
    { label: "Total Revenue", value: formatCurrency(data.stats.revenue), icon: TrendingUp, accent: "#10b981", sub: "Closed-won deals" },
    { label: "Pipeline Value", value: formatCurrency(data.stats.pipelineValue), icon: TrendingUp, accent: "#3b82f6", sub: `${data.stats.openDeals} open deals` },
    { label: "Active Customers", value: formatNumber(data.stats.activeCustomers), icon: Users, accent: "#06b6d4", sub: `${data.stats.totalCustomers} total` },
    { label: "New Customers", value: formatNumber(data.stats.newCustomers), icon: UserPlus, accent: "#8b5cf6", sub: "This month" },
    { label: "Deals Won", value: formatNumber(data.stats.dealsWon), icon: Trophy, accent: "#10b981", sub: "Closed successfully" },
    { label: "Deals Lost", value: formatNumber(data.stats.dealsLost), icon: Target, accent: "#ef4444", sub: "This period" },
    { label: "Lead Conversion", value: `${data.stats.leadConversion}%`, icon: Percent, accent: "#f59e0b", sub: `${data.stats.totalLeads} leads tracked` },
    { label: "Tasks Due Today", value: formatNumber(data.stats.tasksDueToday), icon: CalendarClock, accent: "#f97316", sub: "Needs attention" },
  ];

  const stageEntries = Object.entries(data.dealsByStage);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-400">Here&apos;s what&apos;s happening across your business today.</p>
        </div>
        <Link href="/deals" className="btn-accent flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
          View Pipeline <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 stagger lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="card-hover p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${s.accent}1a` }}>
                  <Icon className="h-5 w-5" style={{ color: s.accent }} />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-white">{s.value}</p>
              <p className="text-sm font-medium text-slate-300">{s.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{s.sub}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales graph */}
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Monthly Sales</h2>
              <p className="text-xs text-slate-500">Revenue from closed-won deals</p>
            </div>
            <Badge color="#10b981">{formatCurrency(data.stats.revenue)} total</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly} margin={{ left: -10, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2940" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top performers */}
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
            <Trophy className="h-4 w-4 text-amber-400" /> Top Performers
          </h2>
          <div className="space-y-3">
            {data.topPerformers.length === 0 && <p className="text-sm text-slate-500">No closed deals yet.</p>}
            {data.topPerformers.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-400/20 text-amber-400" : "bg-white/5 text-slate-400"}`}>
                  {i + 1}
                </span>
                <Avatar name={p.user.name} src={p.user.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{p.user.name}</p>
                  <p className="truncate text-xs text-slate-500">{p.user.jobTitle}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-400">{formatCurrency(p.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Deals by stage */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-white">Deals by Stage</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageEntries.map(([k, v]) => ({ name: k, value: v.value }))} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2940" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stageEntries.map((_, i) => (
                    <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
            <Activity className="h-4 w-4 text-blue-400" /> Recent Activity
          </h2>
          <div className="space-y-4">
            {data.recentActivity.length === 0 && <p className="text-sm text-slate-500">No activity yet.</p>}
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                <div>
                  <p className="text-sm text-slate-200">{a.description}</p>
                  <p className="text-xs text-slate-500">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
