"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Check, Calendar as CalIcon, Flag, Repeat, Send } from "lucide-react";
import { useApp } from "@/components/AppShell";
import { Button, Badge, Avatar, Modal, Field, Input, Textarea, Select, Spinner, EmptyState, useToast } from "@/components/ui";
import { apiFetch, formatDate, timeAgo, cn } from "@/lib/utils";
import { TASK_STATUSES, TASK_TYPES, TASK_PRIORITIES, RECURRENCE_OPTIONS, colorFor, labelFor } from "@/lib/constants";

type Task = {
  id: string; title: string; description: string | null; type: string; status: string; priority: string;
  dueDate: string | null; assignedToId: string | null; assignedToName: string | null; recurrence: string; completedAt: string | null; createdAt: string;
};
type Comment = { id: string; body: string; createdAt: string; userName: string | null };

function blank() {
  return { title: "", description: "", type: "task", status: "todo", priority: "medium", dueDate: "", assignedToId: "", recurrence: "none" };
}

export default function TasksPage() {
  const { team } = useApp();
  const toast = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  async function changeStatus(id: string, status: string) {
    // Optimistic update
    setTasks(cur => cur.map(t => t.id === id ? { ...t, status } : t));

    if (status === "done") {
      await apiFetch("/api/tasks", { 
        method: "POST", 
        body: JSON.stringify({ action: "complete", id }) 
      });
    } else {
      await apiFetch("/api/tasks", { 
        method: "POST", 
        body: JSON.stringify({ action: "update", id, status }) 
      });
    }
    // Refresh to get accurate server state (especially for recurring tasks)
    load();
  }

  // Drag & Drop handlers
  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    setDragId(null);
    setDragOver(null);
  }

  function onDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    setDragOver(status);
  }

  function onDragLeave() {
    setDragOver(null);
  }

  async function onDrop(status: string) {
    if (!dragId) return;
    await changeStatus(dragId, status);
    setDragId(null);
    setDragOver(null);
  }

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ items: Task[] }>("/api/tasks");
      setTasks(r.items);
    } catch {
      toast({ type: "error", title: "Failed to load tasks" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function complete(id: string) {
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, status: "done", completedAt: new Date().toISOString() } : t)));
    await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify({ action: "complete", id }) });
    toast({ type: "success", title: "Task completed" });
    load();
  }

  function openNew() {
    setEditing(null);
    setForm(blank());
    setComments([]);
    setModalOpen(true);
  }
  async function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title, description: t.description || "", type: t.type, status: t.status, priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.slice(0, 16) : "", assignedToId: t.assignedToId || "", recurrence: t.recurrence,
    });
    setModalOpen(true);
    try {
      const c = await apiFetch<{ items: Comment[] }>(`/api/tasks/comments?taskId=${t.id}`);
      setComments(c.items);
    } catch {
      setComments([]);
    }
  }
  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ action: editing ? "update" : "create", ...(editing ? { id: editing.id } : {}), ...form, dueDate: form.dueDate || null }),
      });
      setModalOpen(false);
      toast({ type: "success", title: editing ? "Task updated" : "Task created" });
      load();
    } catch (e) {
      toast({ type: "error", title: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this task?")) return;
    await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify({ action: "delete", id }) });
    setModalOpen(false);
    toast({ type: "success", title: "Task deleted" });
    load();
  }

  async function addComment() {
    if (!editing || !commentText.trim()) return;
    try {
      await apiFetch("/api/tasks", { method: "POST", body: JSON.stringify({ action: "comment", id: editing.id, body: commentText }) });
      const c = await apiFetch<{ items: Comment[] }>(`/api/tasks/comments?taskId=${editing.id}`);
      setComments(c.items);
      setCommentText("");
    } catch {
      toast({ type: "error", title: "Could not add comment" });
    }
  }

  const overdue = (t: Task) => t.dueDate && t.status !== "done" && new Date(t.dueDate).getTime() < Date.now();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="mt-1 text-sm text-slate-400">{tasks.filter((t) => t.status !== "done").length} open · {tasks.filter((t) => t.status === "done").length} completed</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New Task</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <div className="card"><EmptyState title="No tasks yet" description="Create tasks, follow-ups, calls and meetings." action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New Task</Button>} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.value);
            return (
              <div key={col.value} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/50">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-sm font-semibold text-white">{col.label}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">{colTasks.length}</span>
                </div>
                 <div 
                   className={cn("space-y-2.5 p-3 min-h-[120px] transition-colors", dragOver === col.value && "bg-blue-500/10 border border-dashed border-blue-400 rounded")}
                   onDragOver={(e) => onDragOver(e, col.value)}
                   onDragLeave={onDragLeave}
                   onDrop={() => onDrop(col.value)}
                 >
                   {colTasks.map((t) => {
                    const typeMeta = TASK_TYPES.find((x) => x.value === t.type);
                    return (
                      <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] p-3 transition-colors hover:border-[#33457a]">
                         <div 
                           className="flex items-start gap-2.5 cursor-grab active:cursor-grabbing"
                           draggable
                           onDragStart={(e) => onDragStart(e, t.id)}
                           onDragEnd={onDragEnd}
                         >
                           <button
                             onClick={(e) => { e.stopPropagation(); complete(t.id); }}
                             className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors", t.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-600 hover:border-blue-400")}
                           >
                             {t.status === "done" && <Check className="h-3 w-3" />}
                           </button>
                           <button onClick={() => openEdit(t)} className="min-w-0 flex-1 text-left">
                             <p className={cn("text-sm font-medium", t.status === "done" ? "text-slate-500 line-through" : "text-white")}>{t.title}</p>
                             {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.description}</p>}
                           </button>
                         </div>
                         <div className="mt-2.5 flex flex-wrap items-center gap-2">
                           {typeMeta && <Badge color={typeMeta.color} dot={false}>{typeMeta.icon} {typeMeta.label}</Badge>}
                           
                           {/* Current status badge - clickable to change */}
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               const currentIdx = TASK_STATUSES.findIndex(s => s.value === t.status);
                               const next = TASK_STATUSES[(currentIdx + 1) % TASK_STATUSES.length];
                               changeStatus(t.id, next.value);
                             }}
                             className="text-[10px] px-1.5 py-0.5 rounded-full border hover:bg-white/10 transition-colors"
                             style={{ 
                               borderColor: colorFor(TASK_STATUSES, t.status) + '60', 
                               color: colorFor(TASK_STATUSES, t.status) 
                             }}
                           >
                             {labelFor(TASK_STATUSES, t.status)}
                           </button>

                           {t.priority !== "low" && (
                             <span className="flex items-center gap-1 text-xs" style={{ color: colorFor(TASK_PRIORITIES, t.priority) }}>
                               <Flag className="h-3 w-3 fill-current" /> {labelFor(TASK_PRIORITIES, t.priority)}
                             </span>
                           )}
                           {t.recurrence !== "none" && <span className="flex items-center gap-1 text-xs text-violet-400"><Repeat className="h-3 w-3" /> {t.recurrence}</span>}
                         </div>
                         <div className="mt-2.5 flex items-center justify-between">
                           {t.assignedToName ? <Avatar name={t.assignedToName} size={22} /> : <span />}
                           {t.dueDate && (
                             <span className={cn("flex items-center gap-1 text-xs", overdue(t) ? "text-red-400" : "text-slate-500")}>
                               <CalIcon className="h-3 w-3" /> {formatDate(t.dueDate)}
                             </span>
                           )}
                         </div>

                         {/* Quick status changer */}
                         <div className="mt-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                           {TASK_STATUSES.filter(s => s.value !== t.status).map(s => (
                             <button
                               key={s.value}
                               onClick={() => changeStatus(t.id, s.value)}
                               className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border)] hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                               style={{ borderColor: s.color + '40', color: s.color }}
                             >
                               → {s.label}
                             </button>
                           ))}
                         </div>
                       </div>
                    );
                  })}
                  {colTasks.length === 0 && <p className="py-4 text-center text-xs text-slate-600">Nothing here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Task" : "New Task"}
        size="lg"
        footer={
          <>
            {editing && <Button variant="danger" onClick={() => remove(editing.id)} className="mr-auto"><Trash2 className="h-4 w-4" /> Delete</Button>}
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} type="submit" form="task-form">{editing ? "Save" : "Create"}</Button>
          </>
        }
      >
        <form id="task-form" onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" required className="sm:col-span-2"><Input required value={form.title} onChange={setField("title")} /></Field>
            <Field label="Type">
              <Select value={form.type} onChange={setField("type")}>{TASK_TYPES.map((s) => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}</Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={setField("priority")}>{TASK_PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
            </Field>
            <Field label="Due date"><Input type="datetime-local" value={form.dueDate} onChange={setField("dueDate")} /></Field>
            <Field label="Recurrence">
              <Select value={form.recurrence} onChange={setField("recurrence")}>{RECURRENCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select>
            </Field>
            <Field label="Assigned to" className="sm:col-span-2">
              <Select value={form.assignedToId} onChange={setField("assignedToId")}>
                <option value="">Unassigned</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={setField("description")} /></Field>
          </div>

          {editing && (
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Comments</p>
              <div className="mb-3 max-h-40 space-y-2 overflow-y-auto">
                {comments.length === 0 && <p className="text-xs text-slate-600">No comments yet.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar name={c.userName} size={22} />
                    <div className="rounded-lg bg-white/5 px-3 py-1.5">
                      <p className="text-xs font-medium text-white">{c.userName} <span className="text-slate-500">· {timeAgo(c.createdAt)}</span></p>
                      <p className="text-sm text-slate-300">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment…" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addComment())} />
                <Button type="button" variant="subtle" onClick={addComment}><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
