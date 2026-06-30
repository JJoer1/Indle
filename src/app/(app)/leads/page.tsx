"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Mail, Phone, Pencil, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppShell";
import {
  Button,
  Badge,
  Avatar,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  Spinner,
  useToast,
} from "@/components/ui";
import { apiFetch, formatCurrency, cn } from "@/lib/utils";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/constants";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  estimatedValue: string | null;
  probability: number;
  status: string;
  notes: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};

function blank() {
  return { name: "", company: "", contactPerson: "", email: "", phone: "", source: "Website", estimatedValue: "0", probability: 20, status: "new", assignedToId: "", notes: "" };
}

export default function LeadsPage() {
  const { team } = useApp();
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ items: Lead[] }>("/api/leads");
      setLeads(r.items);
    } catch {
      toast({ type: "error", title: "Failed to load leads" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function move(id: string, status: string) {
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await apiFetch("/api/leads", { method: "POST", body: JSON.stringify({ action: "move", id, status }) });
    } catch {
      load();
    }
  }

  function onDrop(status: string) {
    if (dragId) move(dragId, status);
    setDragId(null);
    setDragOver(null);
  }

  function openNew() {
    setEditing(null);
    setForm(blank());
    setModalOpen(true);
  }
  function openEdit(l: Lead) {
    setEditing(l);
    setForm({
      ...blank(),
      name: l.name,
      company: l.company || "",
      contactPerson: l.contactPerson || "",
      email: l.email || "",
      phone: l.phone || "",
      source: l.source || "Website",
      estimatedValue: l.estimatedValue || "0",
      probability: l.probability,
      status: l.status,
      assignedToId: l.assignedToId || "",
      notes: l.notes || "",
    });
    setModalOpen(true);
  }
  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/leads", {
        method: "POST",
        body: JSON.stringify({ action: editing ? "update" : "create", ...(editing ? { id: editing.id } : {}), ...form, estimatedValue: String(form.estimatedValue || "0") }),
      });
      setModalOpen(false);
      toast({ type: "success", title: editing ? "Lead updated" : "Lead created" });
      load();
    } catch (e) {
      toast({ type: "error", title: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this lead?")) return;
    await apiFetch("/api/leads", { method: "POST", body: JSON.stringify({ action: "delete", id }) });
    toast({ type: "success", title: "Lead deleted" });
    load();
  }

  const totalValue = leads.reduce((s, l) => s + parseFloat(l.estimatedValue || "0"), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="mt-1 text-sm text-slate-400">{leads.length} leads · {formatCurrency(totalValue)} total estimated value</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New Lead</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {LEAD_STATUSES.map((col) => {
            const colLeads = leads.filter((l) => l.status === col.value);
            const colValue = colLeads.reduce((s, l) => s + parseFloat(l.estimatedValue || "0"), 0);
            return (
              <div
                key={col.value}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.value);
                }}
                onDragLeave={() => setDragOver((c) => (c === col.value ? null : c))}
                onDrop={() => onDrop(col.value)}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-2xl border bg-[var(--panel)]/50 transition-colors",
                  dragOver === col.value ? "drag-over" : "border-[var(--border)]"
                )}
              >
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-semibold text-white">{col.label}</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">{colLeads.length}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{formatCurrency(colValue)}</span>
                </div>
                <div className="flex-1 space-y-2.5 overflow-y-auto p-3" style={{ minHeight: 120 }}>
                  {colLeads.map((l) => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => openEdit(l)}
                      className={cn(
                        "group cursor-grab rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 transition-all hover:border-[#33457a] active:cursor-grabbing",
                        dragId === l.id && "dragging"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{l.name}</p>
                          {l.company && <p className="truncate text-xs text-slate-400">{l.company}</p>}
                        </div>
                        <span className="text-xs font-bold" style={{ color: col.color }}>
                          {formatCurrency(l.estimatedValue)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {l.assignedToName && <Avatar name={l.assignedToName} size={20} />}
                        {l.source && <Badge color="#64748b" dot={false}>{l.source}</Badge>}
                        <div className="ml-auto flex h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full" style={{ width: `${l.probability}%`, backgroundColor: col.color }} />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                        {l.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</span>}
                        {l.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[var(--border)] py-8 text-center text-xs text-slate-600">
                      Drop leads here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Lead" : "New Lead"}
        footer={
          <>
            {editing && <Button variant="danger" onClick={() => { remove(editing.id); setModalOpen(false); }} className="mr-auto"><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} type="submit" form="lead-form">{editing ? "Save" : "Create"}</Button>
          </>
        }
      >
        <form id="lead-form" onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Lead name" required><Input required value={form.name} onChange={setField("name")} /></Field>
          <Field label="Company"><Input value={form.company} onChange={setField("company")} /></Field>
          <Field label="Contact person"><Input value={form.contactPerson} onChange={setField("contactPerson")} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={setField("email")} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={setField("phone")} /></Field>
          <Field label="Lead source">
            <Select value={form.source} onChange={setField("source")}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Estimated value"><div className="relative"><span className="absolute left-3 top-1/2 text-slate-500">R</span><Input type="number" className="pl-7" value={form.estimatedValue} onChange={setField("estimatedValue")} /></div></Field>
          <Field label={`Probability: ${form.probability}%`}>
            <input type="range" min={0} max={100} step={5} value={form.probability} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} className="w-full accent-blue-500" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={setField("status")}>
              {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Assigned user">
            <Select value={form.assignedToId} onChange={setField("assignedToId")}>
              <option value="">Unassigned</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={setField("notes")} /></Field>
        </form>
      </Modal>
    </div>
  );
}
