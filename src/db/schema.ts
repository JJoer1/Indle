import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  boolean,
  int,
  decimal,
  json,
  mysqlEnum,
  date,
  time,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/* ----------------------------- Enums ----------------------------- */
export const roleEnum = mysqlEnum("user_role", [
  "super_admin",
  "owner",
  "manager",
  "sales_rep",
  "support_agent",
  "viewer",
  "technician",
]);

export const companyPlanEnum = mysqlEnum("company_plan", ["trial", "starter", "growth", "enterprise"]);

export const customerStatusEnum = mysqlEnum("customer_status", ["lead", "active", "inactive", "archived"]);

export const customerRatingEnum = mysqlEnum("customer_rating", ["cold", "warm", "hot"]);

export const leadStatusEnum = mysqlEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

export const dealStageEnum = mysqlEnum("deal_stage", ["new", "qualified", "proposal", "negotiation", "won", "lost"]);

export const taskStatusEnum = mysqlEnum("task_status", ["todo", "in_progress", "done", "deferred"]);

export const taskPriorityEnum = mysqlEnum("task_priority", ["low", "medium", "high", "urgent"]);

export const taskTypeEnum = mysqlEnum("task_type", ["task", "follow_up", "call", "meeting", "reminder"]);

export const eventTypeEnum = mysqlEnum("event_type", ["meeting", "call", "task", "holiday", "deadline"]);

export const recurrenceEnum = mysqlEnum("recurrence", ["none", "daily", "weekly", "monthly"]);

/* ----------------------------- Tenants ----------------------------- */
export const companies = mysqlTable("companies", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  industry: text("industry"),
  plan: companyPlanEnum("plan").default("growth").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#3b82f6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ----------------------------- Users ----------------------------- */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").default("viewer").notNull(),
  jobTitle: text("job_title"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  status: text("status").default("active").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ----------------------------- Auth ----------------------------- */
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  token: text("token").notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }).notNull(),
  companyId: varchar("company_id", { length: 36 }),
  remember: boolean("remember").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerifications = mysqlTable("email_verifications", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ----------------------------- Customers ----------------------------- */
export const customers = mysqlTable("customers", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  website: text("website"),
  industry: text("industry"),
  vatNumber: text("vat_number"),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  country: text("country"),
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  assignedToId: varchar("assigned_to_id", { length: 36 }),
  status: customerStatusEnum("status").default("active").notNull(),
  rating: customerRatingEnum("rating").default("warm"),
  annualRevenue: decimal("annual_revenue", { precision: 14, scale: 2 }).default("0"),
  profilePictureUrl: text("profile_picture_url"),
  archivedAt: timestamp("archived_at"),
  deletedAt: timestamp("deleted_at"),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ----------------------------- Leads ----------------------------- */
export const leads = mysqlTable("leads", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  company: text("company"),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  source: text("source"),
  estimatedValue: decimal("estimated_value", { precision: 14, scale: 2 }).default("0"),
  probability: int("probability").default(20),
  status: leadStatusEnum("status").default("new").notNull(),
  notes: text("notes"),
  assignedToId: varchar("assigned_to_id", { length: 36 }),
  customerId: varchar("customer_id", { length: 36 }),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

/* ----------------------------- Pipelines & Deals ----------------------------- */
export const pipelines = mysqlTable("pipelines", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pipelineStages = mysqlTable("pipeline_stages", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  pipelineId: varchar("pipeline_id", { length: 36 }).references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  stageOrder: int("stage_order").default(0).notNull(),
  probability: int("probability").default(10),
  color: text("color").default("#3b82f6"),
});

export type DealProduct = {
  name: string;
  quantity: number;
  price: number;
};

export const deals = mysqlTable("deals", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  pipelineId: varchar("pipeline_id", { length: 36 }).references(() => pipelines.id, { onDelete: "cascade" }),
  stageId: varchar("stage_id", { length: 36 }),
  name: text("name").notNull(),
  value: decimal("value", { precision: 14, scale: 2 }).default("0"),
  currency: text("currency").default("ZAR"),
  expectedCloseDate: date("expected_close_date"),
  assignedToId: varchar("assigned_to_id", { length: 36 }),
  customerId: varchar("customer_id", { length: 36 }),
  leadId: varchar("lead_id", { length: 36 }),
  products: json("products").$type<DealProduct[]>(),
  notes: text("notes"),
  probability: int("probability").default(20),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

/* ----------------------------- Tasks ----------------------------- */
export const tasks = mysqlTable("tasks", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: taskTypeEnum("type").default("task").notNull(),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  dueDate: timestamp("due_date"),
  assignedToId: varchar("assigned_to_id", { length: 36 }),
  createdBy: varchar("created_by", { length: 36 }),
  relatedType: text("related_type"),
  relatedId: varchar("related_id", { length: 36 }),
  recurrence: recurrenceEnum("recurrence").default("none").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskComments = mysqlTable("task_comments", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  taskId: varchar("task_id", { length: 36 }).references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ----------------------------- Activity & Notifications ----------------------------- */
export const activities = mysqlTable("activities", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 36 }),
  type: text("type").notNull(),
  description: text("description").notNull(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id", { length: 36 }),
  metadata: json("metadata").$type<Record<string, unknown>>().default(JSON.stringify({})),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id", { length: 36 }),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").default("info"),
  read: boolean("read").default(false).notNull(),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ----------------------------- Calendar ----------------------------- */
export const calendarEvents = mysqlTable("calendar_events", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: eventTypeEnum("type").default("meeting").notNull(),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  allDay: boolean("all_day").default(false).notNull(),
  location: text("location"),
  assignedToId: varchar("assigned_to_id", { length: 36 }),
  relatedType: text("related_type"),
  relatedId: varchar("related_id", { length: 36 }),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ----------------------------- Documents & Audit ----------------------------- */
export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  url: text("url"),
  mimeType: text("mime_type"),
  size: int("size").default(0),
  entityType: text("entity_type"),
  entityId: varchar("entity_id", { length: 36 }),
  uploadedBy: varchar("uploaded_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).default(sql`(UUID())`).primaryKey(),
  companyId: varchar("company_id", { length: 36 }),
  userId: varchar("user_id", { length: 36 }),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: varchar("entity_id", { length: 36 }),
  metadata: json("metadata").$type<Record<string, unknown>>().default(JSON.stringify({})),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const schema = {
  companies,
  users,
  sessions,
  passwordResetTokens,
  emailVerifications,
  customers,
  leads,
  pipelines,
  pipelineStages,
  deals,
  tasks,
  taskComments,
  activities,
  notifications,
  calendarEvents,
  documents,
  auditLogs,
};
