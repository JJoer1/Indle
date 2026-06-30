"use client";

import { useState } from "react";
import { ShieldCheck, Users, Building2, UserCog, QrCode, CheckCircle2, Lock } from "lucide-react";
import { useApp } from "@/components/AppShell";
import { Button, Card, Badge, Avatar, Field, Input, Spinner, useToast, Select } from "@/components/ui";
import { apiFetch } from "@/lib/utils";
import { ROLES, PERMISSIONS, type Role } from "@/lib/constants";

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Full platform access across all tenants.",
  owner: "Complete control of the company workspace and billing.",
  manager: "Manage customers, deals, and team performance.",
  sales_rep: "Own customers, leads, and deals in the pipeline.",
  support_agent: "Assist customers and manage related tasks.",
  viewer: "Read-only access to reports and records.",
  technician: "Can only create leads and view assigned tasks.",
};

export default function SettingsPage() {
  const { user, team } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<"account" | "security" | "team" | "company">("account");

  // 2FA setup state
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(user?.twoFactorEnabled ?? false);
  const [disableMode, setDisableMode] = useState(false);

  // Add user form state (only for owners)
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "sales_rep", jobTitle: "" });
  const [addingUser, setAddingUser] = useState(false);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast({ type: "error", title: "Please fill in all required fields" });
      return;
    }
    setAddingUser(true);
    try {
      const res = await apiFetch<{ user: { name: string } }>("/api/users", {
        method: "POST",
        body: JSON.stringify(newUser),
      });
      toast({ type: "success", title: `User ${res.user.name} added` });
      window.location.reload();
    } catch (err) {
      toast({ type: "error", title: err instanceof Error ? err.message : "Failed to add user" });
    } finally {
      setAddingUser(false);
      setNewUser({ name: "", email: "", password: "", role: "sales_rep", jobTitle: "" });
    }
  }

  async function startSetup() {
    setBusy(true);
    try {
      const r = await apiFetch<{ secret: string; qr: string }>("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "2fa-setup" }),
      });
      setSetup({ secret: r.secret, qr: r.qr });
    } catch {
      toast({ type: "error", title: "Could not start 2FA setup" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/auth", { method: "POST", body: JSON.stringify({ action: "2fa-enable", secret: setup?.secret, code }) });
      setEnabled(true);
      setSetup(null);
      setCode("");
      toast({ type: "success", title: "Two-factor authentication enabled" });
    } catch (e) {
      toast({ type: "error", title: e instanceof Error ? e.message : "Invalid code" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/auth", { method: "POST", body: JSON.stringify({ action: "2fa-disable", code }) });
      setEnabled(false);
      setDisableMode(false);
      setCode("");
      toast({ type: "success", title: "Two-factor authentication disabled" });
    } catch {
      toast({ type: "error", title: "Invalid code" });
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { key: "account", label: "Account", icon: UserCog },
    { key: "security", label: "Security", icon: ShieldCheck },
    { key: "team", label: "Team & Roles", icon: Users },
    { key: "company", label: "Company", icon: Building2 },
  ] as const;

  const roleEntries = Object.entries(ROLES) as [Role, string][];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Manage your account, security, and team.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "bg-blue-500/15 text-blue-300" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "account" && user && (
        <Card className="max-w-2xl p-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} src={user.avatarUrl} size={64} />
            <div>
              <h2 className="text-lg font-semibold text-white">{user.name}</h2>
              <p className="text-sm text-slate-400">{user.email}</p>
              <div className="mt-1.5"><Badge color="#3b82f6">{ROLES[user.role as Role]}</Badge></div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input defaultValue={user.name} /></Field>
            <Field label="Job title"><Input defaultValue={user.jobTitle || ""} /></Field>
            <Field label="Email"><Input defaultValue={user.email} disabled /></Field>
            <Field label="Role"><Input defaultValue={ROLES[user.role as Role]} disabled /></Field>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {user.emailVerified ? (
              <Badge color="#10b981"><CheckCircle2 className="h-3 w-3" /> Email verified</Badge>
            ) : (
              <Badge color="#f59e0b">Email not verified</Badge>
            )}
            {enabled && <Badge color="#3b82f6"><Lock className="h-3 w-3" /> 2FA active</Badge>}
          </div>
          <p className="mt-6 text-xs text-slate-500">Profile fields are managed through your identity provider in this demo.</p>
        </Card>
      )}

      {tab === "security" && user && (
        <Card className="max-w-2xl p-6">
          <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
          <p className="mt-1 text-sm text-slate-400">Add an extra layer of security to your account using an authenticator app.</p>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15"><ShieldCheck className="h-5 w-5 text-blue-400" /></div>
              <div>
                <p className="text-sm font-medium text-white">{enabled ? "2FA is enabled" : "2FA is disabled"}</p>
                <p className="text-xs text-slate-500">{enabled ? "Your account requires a verification code." : "Protect your account with TOTP."}</p>
              </div>
            </div>
            {!enabled && !setup && <Button onClick={startSetup} loading={busy}>Enable 2FA</Button>}
            {enabled && !disableMode && <Button variant="outline" onClick={() => setDisableMode(true)}>Disable</Button>}
          </div>

          {setup && (
            <form onSubmit={confirmEnable} className="mt-5 rounded-xl border border-[var(--border)] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={setup.qr} alt="2FA QR code" className="h-full w-full" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Scan with Google Authenticator</p>
                  <p className="mt-1 text-xs text-slate-400">Or enter this secret manually:</p>
                  <code className="mt-2 block break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-blue-300">{setup.secret}</code>
                </div>
              </div>
              <Field label="Enter 6-digit code" required>
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="text-center text-lg tracking-[0.5em]" />
              </Field>
              <div className="mt-3 flex gap-2">
                <Button type="submit" loading={busy}>Verify & enable</Button>
                <Button type="button" variant="ghost" onClick={() => { setSetup(null); setCode(""); }}>Cancel</Button>
              </div>
            </form>
          )}

          {disableMode && (
            <form onSubmit={confirmDisable} className="mt-5 rounded-xl border border-[var(--border)] p-4">
              <p className="mb-3 text-sm text-slate-300">Enter your authenticator code to disable 2FA.</p>
              <Field label="6-digit code" required>
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="text-center text-lg tracking-[0.5em]" />
              </Field>
              <div className="mt-3 flex gap-2">
                <Button type="submit" variant="danger" loading={busy}>Disable 2FA</Button>
                <Button type="button" variant="ghost" onClick={() => { setDisableMode(false); setCode(""); }}>Cancel</Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {tab === "team" && (
        <div className="space-y-5">
          {/* Team list */}
          <Card className="p-2">
            {team.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0">
                <Avatar name={m.name} src={m.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{m.name}</p>
                  <p className="truncate text-xs text-slate-500">{m.email || m.jobTitle}</p>
                </div>
                <Badge color="#3b82f6">{ROLES[m.role as Role]}</Badge>
              </div>
            ))}
          </Card>

          {/* Add new user form - only for owners */}
          {(user?.role === "owner" || user?.role === "super_admin") && (
            <Card className="p-6">
              <h2 className="mb-4 text-base font-semibold text-white">Add Team Member</h2>
              <form onSubmit={addUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required />
                </Field>
                <Field label="Email" required>
                  <Input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
                </Field>
                <Field label="Temporary Password" required>
                  <Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                </Field>
                <Field label="Role">
                  <Select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="sales_rep">Sales Representative</option>
                    <option value="manager">Manager</option>
                    <option value="support_agent">Support Agent</option>
                    <option value="viewer">Viewer</option>
                    <option value="technician">Technician</option>
                  </Select>
                </Field>
                <Field label="Job Title" className="sm:col-span-2">
                  <Input value={newUser.jobTitle} onChange={e => setNewUser({...newUser, jobTitle: e.target.value})} placeholder="e.g. Account Executive" />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" loading={addingUser}>Add User</Button>
                </div>
              </form>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="mb-4 text-base font-semibold text-white">Role Permissions</h2>
            <div className="space-y-3">
              {roleEntries.map(([role, label]) => (
                <div key={role} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <span className="text-xs text-slate-500">{PERMISSIONS[role].includes("*") ? "Full access" : `${PERMISSIONS[role].length} permissions`}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === "company" && (
        <Card className="max-w-2xl p-6">
          <h2 className="text-lg font-semibold text-white">Company</h2>
          <p className="mt-1 text-sm text-slate-400">Your multi-tenant workspace configuration.</p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company name"><Input defaultValue="Your Company" /></Field>
            <Field label="Plan"><Input defaultValue="Enterprise" disabled /></Field>
            <Field label="Team members"><Input defaultValue={`${team.length} seats`} disabled /></Field>
            <Field label="Data region"><Input defaultValue="US-East" disabled /></Field>
          </div>
          <div className="mt-4 flex items-center gap-2"><Badge color="#10b981"><CheckCircle2 className="h-3 w-3" /> Tenant isolation active</Badge></div>
        </Card>
      )}
    </div>
  );
}
