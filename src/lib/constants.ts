export const ROLES = {
  super_admin: "Super Admin",
  owner: "Company Owner",
  manager: "Manager",
  sales_rep: "Sales Representative",
  support_agent: "Support Agent",
  viewer: "Viewer",
  technician: "Technician",
} as const;

export type Role = keyof typeof ROLES;

export const ROLE_ICONS: Record<Role, string> = {
  super_admin: "👑",
  owner: "🏛️",
  manager: "📊",
  sales_rep: "💼",
  support_agent: "🎧",
  viewer: "👁️",
  technician: "🔧",
};

/**
 * Permission matrix. super_admin and owner have full access. Others get
 * progressively scoped permissions.
 */
export const PERMISSIONS: Record<Role, string[]> = {
  super_admin: ["*"],
  owner: ["*"],
  manager: [
    "customers:*",
    "leads:*",
    "deals:*",
    "tasks:*",
    "calendar:*",
    "users:read",
    "reports:read",
  ],
  sales_rep: [
    "customers:read",
    "customers:write",
    "leads:read",
    "leads:write",
    "deals:read",
    "deals:write",
    "tasks:*",
    "calendar:*",
  ],
  support_agent: [
    "customers:read",
    "customers:write",
    "leads:read",
    "tasks:*",
    "calendar:read",
  ],
  viewer: [
    "customers:read",
    "leads:read",
    "deals:read",
    "tasks:read",
    "calendar:read",
    "reports:read",
  ],
  technician: [
    "leads:read",
    "leads:write",
    "tasks:read",
    "calendar:read",
  ],
};

export function can(role: Role | undefined, permission: string): boolean {
  if (!role) return false;
  const perms = PERMISSIONS[role] ?? [];
  if (perms.includes("*")) return true;
  const [resource, action] = permission.split(":");
  if (perms.includes(`${resource}:*`)) return true;
  return perms.includes(permission) || perms.includes(`${resource}:*`);
}

export function canWrite(role: Role | undefined, resource: string): boolean {
  return can(role, `${resource}:write`);
}

export const LEAD_STATUSES = [
  { value: "new", label: "New", color: "#3b82f6" },
  { value: "contacted", label: "Contacted", color: "#8b5cf6" },
  { value: "qualified", label: "Qualified", color: "#06b6d4" },
  { value: "proposal", label: "Proposal Sent", color: "#f59e0b" },
  { value: "negotiation", label: "Negotiation", color: "#f97316" },
  { value: "won", label: "Won", color: "#10b981" },
  { value: "lost", label: "Lost", color: "#ef4444" },
] as const;

export const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Cold Call",
  "Email Campaign",
  "Social Media",
  "Trade Show",
  "Partner",
  "Advertisement",
  "Other",
];

export const DEAL_STAGES = [
  { value: "new", label: "New", color: "#3b82f6", probability: 10 },
  { value: "qualified", label: "Qualified", color: "#06b6d4", probability: 25 },
  { value: "proposal", label: "Proposal", color: "#f59e0b", probability: 50 },
  { value: "negotiation", label: "Negotiation", color: "#f97316", probability: 75 },
  { value: "won", label: "Won", color: "#10b981", probability: 100 },
  { value: "lost", label: "Lost", color: "#ef4444", probability: 0 },
] as const;

export const CURRENCY = "ZAR";
export const CURRENCY_SYMBOL = "R";

export const CUSTOMER_STATUSES = [
  { value: "lead", label: "Lead", color: "#3b82f6" },
  { value: "active", label: "Active", color: "#10b981" },
  { value: "inactive", label: "Inactive", color: "#64748b" },
  { value: "archived", label: "Archived", color: "#94a3b8" },
];

export const CUSTOMER_RATINGS = [
  { value: "cold", label: "Cold", color: "#3b82f6" },
  { value: "warm", label: "Warm", color: "#f59e0b" },
  { value: "hot", label: "Hot", color: "#ef4444" },
];

export const TASK_TYPES = [
  { value: "task", label: "Task", icon: "✅", color: "#3b82f6" },
  { value: "follow_up", label: "Follow Up", icon: "🔁", color: "#8b5cf6" },
  { value: "call", label: "Call", icon: "📞", color: "#06b6d4" },
  { value: "meeting", label: "Meeting", icon: "🗓️", color: "#f59e0b" },
  { value: "reminder", label: "Reminder", icon: "⏰", color: "#ef4444" },
];

export const TASK_PRIORITIES = [
  { value: "low", label: "Low", color: "#64748b" },
  { value: "medium", label: "Medium", color: "#3b82f6" },
  { value: "high", label: "High", color: "#f59e0b" },
  { value: "urgent", label: "Urgent", color: "#ef4444" },
];

export const TASK_STATUSES = [
  { value: "todo", label: "To Do", color: "#64748b" },
  { value: "in_progress", label: "In Progress", color: "#3b82f6" },
  { value: "done", label: "Done", color: "#10b981" },
  { value: "deferred", label: "Deferred", color: "#94a3b8" },
];

export const EVENT_TYPES = [
  { value: "meeting", label: "Meeting", color: "#3b82f6" },
  { value: "call", label: "Call", color: "#06b6d4" },
  { value: "task", label: "Task", color: "#f59e0b" },
  { value: "holiday", label: "Holiday", color: "#10b981" },
  { value: "deadline", label: "Deadline", color: "#ef4444" },
];

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const INDUSTRIES = [
  "Technology",
  "Finance",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Education",
  "Real Estate",
  "Logistics",
  "Media",
  "Energy",
  "Construction",
  "Other",
];

export function colorFor(list: readonly { value: string; color?: string }[], value: string) {
  return list.find((i) => i.value === value)?.color ?? "#64748b";
}

export function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? value;
}
