"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, LayoutGrid, Table as TableIcon, Calendar as CalIcon, X } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/AppShell";
import { Button, Badge, Avatar, Modal, Field, Input, Textarea, Select, Spinner, EmptyState, useToast } from "@/components/ui";
import { apiFetch, formatCurrency, formatDate, cn } from "@/lib/utils";

type Stage = { id: string; name: string; color: string | null; stageOrder: number; probability: number | null };
type DealProduct = { name: string; quantity: number; price: number };
type Deal = {
  id: string; name: string; value: string | null; currency: string | null; expectedCloseDate: string | null;
  assignedToId: string | null; assignedToName: string | null; customerId: string | null; customerName: string | null;
  stageId: string | null; stageName: string | null; products: DealProduct[] | null; notes: string | null;
  probability: number | null; createdAt: string;
};
type CustomerOpt = { id: string; companyName: string };

function blank() {
  return { name: "", value: "0", expectedCloseDate: "", assignedToId: "", customerId: "", stageId: "", probability: 20, notes: "", products: [] as DealProduct[] };
}

export default function DealsPage() {
  const { team } = useApp();
  const toast = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        apiFetch<{ items: Deal[]; stages: Stage[] }>("/api/deals"),
        apiFetch<{ items: { id: string; companyName: string }[] }>("/api/customers"),
      ]);
      setDeals(d.items);
      setStages(d.stages);
      setCustomers(c.items);
    } catch {
      toast({ type: "error", title: "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function move(id: string, stageId: string) {
    setDeals((cur) => cur.map((x) => (x.id === id ? { ...x, stageId } : x)));
    try {
      await apiFetch("/api/deals", { method: "POST", body: JSON.stringify({ action: "move", id, stageId }) });
    } catch {
      load();
    }
  }
  function onDrop(stageId: string) {
    if (dragId) move(dragId, stageId);
    setDragId(null);
    setDragOver(null);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...blank(), stageId: stages[0]?.id || "" });
    setModalOpen(true);
  }
  function openEdit(d: Deal) {
    setEditing(d);
    setForm({
      ...blank(),
      name: d.name,
      value: d.value || "0",
      expectedCloseDate: d.expectedCloseDate || "",
      assignedToId: d.assignedToId || "",
      customerId: d.customerId || "",
      stageId: d.stageId || "",
      probability: d.probability ?? 20,
      notes: d.notes || "",
      products: d.products || [],
    });
    setModalOpen(true);
  }
  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/deals", {
        method: "POST",
        body: JSON.stringify({ action: editing ? "update" : "create", ...(editing ? { id: editing.id } : {}), ...form, value: String(form.value || "0") }),
      });
      setModalOpen(false);
      toast({ type: "success", title: editing ? "Deal updated" : "Deal created" });
      load();
    } catch (e) {
      toast({ type: "error", title: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this deal?")) return;
    await apiFetch("/api/deals", { method: "POST", body: JSON.stringify({ action: "delete", id }) });
    toast({ type: "success", title: "Deal deleted" });
    setModalOpen(false);
    load();
  }

  function addProduct() {
    setForm({ ...form, products: [...form.products, { name: "", quantity: 1, price: 0 }] });
  }
  function updateProduct(i: number, patch: Partial<DealProduct>) {
    const products = form.products.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    setForm({ ...form, products });
  }
  function removeProduct(i: number) {
    setForm({ ...form, products: form.products.filter((_, idx) => idx !== i) });
  }

  const stageColor = (id: string | null) => stages.find((s) => s.id === id)?.color || "#64748b";
  const totalValue = deals.reduce((s, d) => s + parseFloat(d.value || "0"), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Pipeline</h1>
          <p className="mt-1 text-sm text-slate-400">{deals.length} deals · {formatCurrency(totalValue)} total value</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-[var(--border)] p-1">
            <button onClick={() => setView("kanban")} className={cn("rounded-lg px-3 py-1.5 text-sm", view === "kanban" ? "bg-blue-500/15 text-blue-300" : "text-slate-400")}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView("table")} className={cn("rounded-lg px-3 py-1.5 text-sm", view === "table" ? "bg-blue-500/15 text-blue-300" : "text-slate-400")}><TableIcon className="h-4 w-4" /></button>
          </div>
          <Link href="/calendar" className="hidden rounded-xl border border-[var(--border)] p-2.5 text-slate-400 hover:text-white sm:block"><CalIcon className="h-4 w-4" /></Link>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New Deal</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const colDeals = deals.filter((d) => d.stageId === stage.id);
            const colValue = colDeals.reduce((s, d) => s + parseFloat(d.value || "0"), 0);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver((c) => (c === stage.id ? null : c))}
                onDrop={() => onDrop(stage.id)}
                className={cn("flex w-72 shrink-0 flex-col rounded-2xl border bg-[var(--panel)]/50", dragOver === stage.id ? "drag-over" : "border-[var(--border)]")}
              >
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color || "#64748b" }} />
                    <span className="text-sm font-semibold text-white">{stage.name}</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">{colDeals.length}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{formatCurrency(colValue)}</span>
                </div>
                <div className="flex-1 space-y-2.5 overflow-y-auto p-3" style={{ minHeight: 100 }}>
                  {colDeals.map((d) => (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => openEdit(d)}
                      className={cn("cursor-grab rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 transition-all hover:border-[#33457a] active:cursor-grabbing", dragId === d.id && "dragging")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{d.name}</p>
                        <span className="text-sm font-bold" style={{ color: stage.color || "#64748b" }}>{formatCurrency(d.value)}</span>
                      </div>
                      {d.customerName && <p className="mt-0.5 text-xs text-slate-400">{d.customerName}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        {d.assignedToName ? <Avatar name={d.assignedToName} size={22} /> : <span />}
                        {d.expectedCloseDate && <span className="text-[11px] text-slate-500">{formatDate(d.expectedCloseDate)}</span>}
                      </div>
                    </div>
                  ))}
                  {colDeals.length === 0 && <div className="rounded-xl border border-dashed border-[var(--border)] py-6 text-center text-xs text-slate-600">Drop deals here</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {deals.length === 0 ? (
            <EmptyState title="No deals yet" description="Create your first deal to start tracking revenue." action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New Deal</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-medium">Deal</th><th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Stage</th><th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 text-right font-medium">Value</th><th className="px-4 py-3 font-medium">Close date</th>
              </tr></thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} onClick={() => openEdit(d)} className="cursor-pointer border-b border-[var(--border)] hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-white">{d.name}</td>
                    <td className="px-4 py-3 text-slate-400">{d.customerName || "—"}</td>
                    <td className="px-4 py-3"><Badge color={stageColor(d.stageId)}>{d.stageName || "—"}</Badge></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={d.assignedToName} size={22} /><span className="text-slate-400">{d.assignedToName || "—"}</span></div></td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(d.value)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(d.expectedCloseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Deal" : "New Deal"}
        size="lg"
        footer={
          <>
            {editing && <Button variant="danger" onClick={() => remove(editing.id)} className="mr-auto"><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} type="submit" form="deal-form">{editing ? "Save" : "Create"}</Button>
          </>
        }
      >
        <form id="deal-form" onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Deal name" required><Input required value={form.name} onChange={setField("name")} /></Field>
            <Field label="Value (R)"><Input type="number" value={form.value} onChange={setField("value")} /></Field>
            <Field label="Customer">
              <Select value={form.customerId} onChange={setField("customerId")}>
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </Select>
            </Field>
            <Field label="Stage">
              <Select value={form.stageId} onChange={setField("stageId")}>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Assigned to">
              <Select value={form.assignedToId} onChange={setField("assignedToId")}>
                <option value="">Unassigned</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Expected close date"><Input type="date" value={form.expectedCloseDate} onChange={setField("expectedCloseDate")} /></Field>
          </div>
          <Field label={`Win probability: ${form.probability}%`}>
            <input type="range" min={0} max={100} step={5} value={form.probability} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} className="w-full accent-blue-500" />
          </Field>

          {/* Products */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="field-label mb-0">Products</span>
              <button type="button" onClick={addProduct} className="text-xs font-medium text-blue-400 hover:text-blue-300">+ Add product</button>
            </div>
            <div className="space-y-2">
              {form.products.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Product name" value={p.name} onChange={(e) => updateProduct(i, { name: e.target.value })} className="flex-1" />
                  <Input type="number" placeholder="Qty" value={p.quantity} onChange={(e) => updateProduct(i, { quantity: Number(e.target.value) })} className="w-20" />
                  <Input type="number" placeholder="Price" value={p.price} onChange={(e) => updateProduct(i, { price: Number(e.target.value) })} className="w-28" />
                  <button type="button" onClick={() => removeProduct(i)} className="rounded-lg p-2 text-slate-400 hover:text-red-400"><X className="h-4 w-4" /></button>
                </div>
              ))}
              {form.products.length === 0 && <p className="text-xs text-slate-600">No products added.</p>}
            </div>
          </div>

          <Field label="Notes"><Textarea value={form.notes} onChange={setField("notes")} /></Field>
        </form>
      </Modal>
    </div>
  );
}
