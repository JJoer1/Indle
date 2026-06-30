"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  Briefcase,
  CheckSquare,
  Calendar,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Search,
  ChevronDown,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { apiFetch, type TeamMember } from "@/lib/utils";
import { ROLES, can } from "@/lib/constants";
import { Avatar, Spinner, ToastProvider, Badge } from "./ui";
import { NotificationCenter } from "./NotificationCenter";
import { useTheme } from "./ThemeProvider";
import { Moon, Sun } from "lucide-react";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="rounded-xl p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
      title="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "owner" | "manager" | "sales_rep" | "support_agent" | "viewer";
  avatarUrl: string | null;
  jobTitle: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
};

type NotifItem = { id: string; title: string; message: string | null; read: boolean; link: string | null; createdAt: string };

const AppCtx = createContext<{ user: AuthUser | null; team: TeamMember[] }>({ user: null, team: [] });
export const useApp = () => useContext(AppCtx);

type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string };
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users, perm: "customers:read" },
  { href: "/leads", label: "Leads", icon: Target, perm: "leads:read" },
  { href: "/deals", label: "Deals", icon: Briefcase, perm: "deals:read" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, perm: "tasks:read" },
  { href: "/calendar", label: "Calendar", icon: Calendar, perm: "calendar:read" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notif, setNotif] = useState<{ items: NotifItem[]; unread: number; open: boolean }>({ items: [], unread: 0, open: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      try {
        const a = await apiFetch<{ user: AuthUser | null }>("/api/auth");
        if (!a.user) {
          router.replace("/login");
          return;
        }
        setUser(a.user);
        try {
          const u = await apiFetch<{ team: TeamMember[] }>("/api/users");
          setTeam(u.team);
        } catch {
          /* ignore */
        }
        setLoading(false);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  const loadNotif = useCallback(async () => {
    try {
      const n = await apiFetch<{ items: NotifItem[]; unread: number }>("/api/notifications");
      setNotif((s) => ({ items: n.items, unread: n.unread, open: s.open }));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    loadNotif();
  }, [loadNotif, pathname]);

  const logout = async () => {
    await apiFetch("/api/auth", { method: "POST", body: JSON.stringify({ action: "logout" }) });
    router.replace("/login");
  };

  const markAllRead = async () => {
    await apiFetch("/api/notifications", { method: "POST", body: JSON.stringify({ action: "mark-all-read" }) });
    loadNotif();
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-slate-500">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-white">DD CRM</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Enterprise</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.filter((n) => !n.perm || can(user.role, n.perm)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active ? "bg-blue-500/15 text-blue-300 shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active ? "text-blue-400" : ""}`} />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <Avatar name={user.name} src={user.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{ROLES[user.role]}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <AppCtx.Provider value={{ user, team }}>
        <div className="flex min-h-screen">
          {/* Desktop sidebar */}
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-[var(--border)] bg-[var(--panel)]/60 backdrop-blur-xl lg:block">
            {SidebarContent}
          </aside>

          {/* Mobile drawer */}
          {mobileOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
              <aside className="absolute left-0 top-0 h-full w-64 border-r border-[var(--border)] bg-[var(--panel)] animate-slide-in">
                <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
                {SidebarContent}
              </aside>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/80 px-4 backdrop-blur-xl sm:px-6">
              <button onClick={() => setMobileOpen(true)} className="text-slate-400 lg:hidden">
                <Menu className="h-6 w-6" />
              </button>

               <form
                 onSubmit={(e) => {
                   e.preventDefault();
                   const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
                   const q = input?.value.trim() || "";
                   if (!q) return;

                   const path = window.location.pathname;
                   
                   if (path.startsWith("/leads")) router.push(`/leads?q=${encodeURIComponent(q)}`);
                   else if (path.startsWith("/deals")) router.push(`/deals?q=${encodeURIComponent(q)}`);
                   else if (path.startsWith("/tasks")) router.push(`/tasks?q=${encodeURIComponent(q)}`);
                   else if (path.startsWith("/calendar")) router.push(`/calendar`);
                   else router.push(`/customers?q=${encodeURIComponent(q)}`);
                 }}
                 className="relative w-full max-w-xs sm:max-w-md"
               >
                 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                 <input
                   name="q"
                   placeholder="Search customers, leads, deals…"
                   className="input pl-9 pr-8"
                 />
                 <button
                   type="button"
                   onClick={(e) => {
                     const formEl = (e.currentTarget.parentElement as HTMLFormElement);
                     const inputEl = formEl?.elements.namedItem("q") as HTMLInputElement;
                     if (inputEl) inputEl.value = "";
                     router.push(window.location.pathname);
                   }}
                   className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xl leading-none"
                   aria-label="Clear search"
                 >
                   ×
                 </button>
               </form>

              <div className="ml-auto flex items-center gap-2">
                {/* Theme toggle */}
                <ThemeToggle />

                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotif((s) => ({ ...s, open: !s.open }));
                      if (notif.unread > 0) markAllRead();
                    }}
                    className="relative rounded-xl p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    <Bell className="h-5 w-5" />
                    {notif.unread > 0 && (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {notif.unread}
                      </span>
                    )}
                  </button>
                  {notif.open && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotif((s) => ({ ...s, open: false }))} />
                      <div className="absolute right-0 z-50 mt-2 w-80 animate-scale-in card shadow-2xl">
                        <div className="border-b border-[var(--border)] px-4 py-3">
                          <p className="text-sm font-semibold text-white">Notifications</p>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notif.items.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up</p>}
                          {notif.items.map((n) => (
                            <Link
                              key={n.id}
                              href={n.link || "#"}
                              onClick={() => setNotif((s) => ({ ...s, open: false }))}
                              className={`flex gap-3 border-b border-[var(--border)] px-4 py-3 hover:bg-white/5 ${n.read ? "opacity-60" : ""}`}
                            >
                              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />}
                              <div className={n.read ? "pl-5" : ""}>
                                <p className="text-sm font-medium text-white">{n.title}</p>
                                {n.message && <p className="text-xs text-slate-400">{n.message}</p>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-white/5"
                  >
                    <Avatar name={user.name} src={user.avatarUrl} size={34} />
                    <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 z-50 mt-2 w-60 animate-scale-in card shadow-2xl">
                        <div className="border-b border-[var(--border)] px-4 py-3">
                          <p className="text-sm font-semibold text-white">{user.name}</p>
                          <p className="truncate text-xs text-slate-500">{user.email}</p>
                          <div className="mt-2">
                            <Badge color="#3b82f6">{ROLES[user.role]}</Badge>
                          </div>
                        </div>
                        <div className="p-1.5">
                          <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
                            <Settings className="h-4 w-4" /> Settings
                          </Link>
                          <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
                            <LogOut className="h-4 w-4" /> Sign out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          </div>
        </div>
        <NotificationCenter />
      </AppCtx.Provider>
    </ToastProvider>
  );
}
