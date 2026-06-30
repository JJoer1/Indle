"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, MapPin, CalendarPlus, RefreshCw } from "lucide-react";
import { useApp } from "@/components/AppShell";
import { Button, Modal, Field, Input, Select, Spinner, useToast } from "@/components/ui";
import { apiFetch, cn, isSameDay } from "@/lib/utils";
import { EVENT_TYPES } from "@/lib/constants";

type CalEvent = {
  id: string; title: string; type: string; startAt: string; endAt: string; allDay: boolean;
  location: string | null; assignedToId: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const { team } = useApp();
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalEvent | null>(null);
  const [form, setForm] = useState({ title: "", type: "meeting", date: "", startTime: "09:00", endTime: "10:00", allDay: false, location: "", assignedToId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    try {
      const r = await apiFetch<{ items: CalEvent[] }>(`/api/events?start=${start.toISOString()}&end=${end.toISOString()}`);
      setEvents(r.items);
    } catch {
      toast({ type: "error", title: "Failed to load events" });
    } finally {
      setLoading(false);
    }
  }, [month, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const year = month.getFullYear();
  const m = month.getMonth();
  const startWeekday = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));
  const today = new Date();

  function openNew(date?: Date) {
    setEditing(null);
    setForm({ title: "", type: "meeting", date: fmtDate(date || today), startTime: "09:00", endTime: "10:00", allDay: false, location: "", assignedToId: "" });
    setModalOpen(true);
  }
  function openEdit(ev: CalEvent) {
    const s = new Date(ev.startAt);
    const e = new Date(ev.endAt);
    setEditing(ev);
    setForm({
      title: ev.title, type: ev.type, date: fmtDate(s),
      startTime: s.toTimeString().slice(0, 5), endTime: e.toTimeString().slice(0, 5),
      allDay: ev.allDay, location: ev.location || "", assignedToId: ev.assignedToId || "",
    });
    setModalOpen(true);
  }
  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const startAt = new Date(`${form.date}T${form.allDay ? "00:00" : form.startTime}`).toISOString();
    const endAt = new Date(`${form.date}T${form.allDay ? "23:59" : form.endTime}`).toISOString();
    try {
      await apiFetch("/api/events", {
        method: "POST",
        body: JSON.stringify({
          action: editing ? "update" : "create",
          ...(editing ? { id: editing.id } : {}),
          title: form.title, type: form.type, startAt, endAt, allDay: form.allDay,
          location: form.location, assignedToId: form.assignedToId,
        }),
      });
      setModalOpen(false);
      toast({ type: "success", title: editing ? "Event updated" : "Event created" });
      load();
    } catch (e) {
      toast({ type: "error", title: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await apiFetch("/api/events", { method: "POST", body: JSON.stringify({ action: "delete", id }) });
    setModalOpen(false);
    toast({ type: "success", title: "Event deleted" });
    load();
  }

  const eventsFor = (d: Date) => events.filter((ev) => isSameDay(new Date(ev.startAt), d));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="mt-1 text-sm text-slate-400">Meetings, calls, tasks & holidays</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => toast({ type: "info", title: "Google Calendar", message: "OAuth sync will connect here." })} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><RefreshCw className="h-3.5 w-3.5" /> Google</button>
          <button onClick={() => toast({ type: "info", title: "Outlook", message: "OAuth sync will connect here." })} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><RefreshCw className="h-3.5 w-3.5" /> Outlook</button>
          <Button size="sm" onClick={() => openNew()}><Plus className="h-4 w-4" /> New Event</Button>
        </div>
      </div>

      <div className="card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{month.toLocaleString("en-US", { month: "long", year: "numeric" })}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(year, m - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>Today</Button>
            <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(year, m + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const dayEvents = eventsFor(d);
              const isToday = isSameDay(d, today);
              return (
                <button
                  key={i}
                  onClick={() => openNew(d)}
                  className={cn(
                    "flex min-h-[92px] flex-col gap-1 rounded-xl border p-2 text-left transition-colors hover:border-[#33457a]",
                    isToday ? "border-blue-500/50 bg-blue-500/5" : "border-[var(--border)] bg-[var(--bg-soft)]/40"
                  )}
                >
                  <span className={cn("text-xs font-semibold", isToday ? "text-blue-400" : "text-slate-400")}>{d.getDate()}</span>
                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const color = EVENT_TYPES.find((t) => t.value === ev.type)?.color || "#64748b";
                      return (
                        <span
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                          className="block truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: `${color}22`, color }}
                        >
                          {ev.allDay ? "• " : `${new Date(ev.startAt).toTimeString().slice(0, 5)} `}{ev.title}
                        </span>
                      );
                    })}
                    {dayEvents.length > 3 && <span className="text-[10px] text-slate-500">+{dayEvents.length - 3} more</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {EVENT_TYPES.map((t) => (
          <span key={t.value} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} /> {t.label}
          </span>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Event" : "New Event"}
        footer={
          <>
            {editing && <Button variant="danger" onClick={() => remove(editing.id)} className="mr-auto"><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} type="submit" form="ev-form">{editing ? "Save" : "Create"}</Button>
          </>
        }
      >
        <form id="ev-form" onSubmit={save} className="space-y-4">
          <Field label="Title" required><Input required value={form.title} onChange={setField("title")} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select value={form.type} onChange={setField("type")}>{EVENT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
            </Field>
            <Field label="Date"><Input type="date" required value={form.date} onChange={setField("date")} /></Field>
            {!form.allDay && (
              <>
                <Field label="Start time"><Input type="time" value={form.startTime} onChange={setField("startTime")} /></Field>
                <Field label="End time"><Input type="time" value={form.endTime} onChange={setField("endTime")} /></Field>
              </>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} className="h-4 w-4 rounded accent-blue-500" />
            All day event
          </label>
          <Field label="Location"><Input value={form.location} onChange={setField("location")} placeholder="Conference room / Zoom link" /></Field>
          <Field label="Assigned to">
            <Select value={form.assignedToId} onChange={setField("assignedToId")}>
              <option value="">Everyone</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}
