import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  doublePrecision,
  serial,
} from "drizzle-orm/pg-core";
import {
  roles,
  statuses,
  type FormData,
  type SchemeConfig,
  type Rule,
  type RuleResult,
  type Analysis,
  type ExtractedValue,
  type Duplicate,
  type DocumentRequirement,
} from "@/lib/domain";
const created = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
export const roleEnum = pgEnum("role", roles);
export const statusEnum = pgEnum("application_status", statuses);
export const users = pgTable("users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum().notNull(),
  demo: boolean().default(false).notNull(),
  createdAt: created(),
});
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
export const profiles = pgTable("applicant_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  data: jsonb().$type<FormData>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const officers = pgTable("officer_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  designation: text().notNull(),
  region: text().notNull(),
});
export const states = pgTable("states", {
  id: text().primaryKey(),
  name: text().notNull(),
});
export const districts = pgTable("districts", {
  id: text().primaryKey(),
  name: text().notNull(),
  stateId: text("state_id")
    .references(() => states.id)
    .notNull(),
});
export const institutions = pgTable("institutions", {
  id: text().primaryKey(),
  name: text().notNull(),
  districtId: text("district_id")
    .references(() => districts.id)
    .notNull(),
});
export const schemes = pgTable("schemes", {
  id: text().primaryKey(),
  code: text().unique().notNull(),
  name: text().notNull(),
  description: text().notNull(),
  type: text().notNull(),
  active: boolean().default(true).notNull(),
  award: integer().notNull(),
  deadline: text().notNull(),
  config: jsonb().$type<SchemeConfig>().notNull(),
  version: integer().default(1).notNull(),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const schemeRules = pgTable("scheme_rules", {
  id: text().primaryKey(),
  schemeId: text("scheme_id")
    .references(() => schemes.id)
    .notNull(),
  rule: jsonb().$type<Rule>().notNull(),
});
export const requirements = pgTable("scheme_document_requirements", {
  id: text().primaryKey(),
  schemeId: text("scheme_id")
    .references(() => schemes.id)
    .notNull(),
  requirement: jsonb().$type<DocumentRequirement>().notNull(),
});
export const applications = pgTable(
  "applications",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    schemeId: text("scheme_id")
      .references(() => schemes.id)
      .notNull(),
    officerId: text("officer_id").references(() => users.id),
    status: statusEnum().default("draft").notNull(),
    data: jsonb().$type<FormData>().notNull(),
    schemeSnapshot: jsonb("scheme_snapshot").$type<SchemeConfig>().notNull(),
    schemeVersion: integer("scheme_version").notNull(),
    confidence: integer().default(0).notNull(),
    eligible: boolean(),
    recommendation: text()
      .default("Complete your application to begin verification.")
      .notNull(),
    duplicates: jsonb().$type<Duplicate[]>().default([]).notNull(),
    version: integer().default(1).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("applications_owner_idx").on(t.userId),
    index("applications_queue_idx").on(t.officerId, t.status),
    index("applications_scheme_idx").on(t.schemeId),
    index("applications_created_idx").on(t.createdAt),
  ],
);
export const applicationFields = pgTable(
  "application_fields",
  {
    id: text().primaryKey(),
    applicationId: text("application_id")
      .references(() => applications.id)
      .notNull(),
    key: text().notNull(),
    value: jsonb().notNull(),
  },
  (t) => [uniqueIndex("application_field_unique").on(t.applicationId, t.key)],
);
export const documents = pgTable(
  "documents",
  {
    id: text().primaryKey(),
    applicationId: text("application_id")
      .references(() => applications.id)
      .notNull(),
    category: text().notNull(),
    filename: text().notNull(),
    mime: text().notNull(),
    size: integer().notNull(),
    hash: text().notNull(),
    storageKey: text("storage_key").notNull(),
    active: boolean().default(true).notNull(),
    analysis: jsonb().$type<Analysis>().notNull(),
    createdAt: created(),
  },
  (t) => [
    index("documents_application_idx").on(t.applicationId),
    index("documents_hash_idx").on(t.hash),
  ],
);
export const storageObjects = pgTable("storage_objects", {
  key: text().primaryKey(),
  body: text().notNull(),
  mime: text().notNull(),
  createdAt: created(),
});
export const ocrResults = pgTable("ocr_results", {
  id: text().primaryKey(),
  documentId: text("document_id")
    .references(() => documents.id)
    .notNull(),
  provider: text().notNull(),
  confidence: integer().notNull(),
  result: jsonb().$type<Analysis>().notNull(),
  createdAt: created(),
});
export const extractedFields = pgTable("extracted_fields", {
  id: text().primaryKey(),
  ocrId: text("ocr_id")
    .references(() => ocrResults.id)
    .notNull(),
  field: jsonb().$type<ExtractedValue>().notNull(),
});
export const eligibilityChecks = pgTable("eligibility_checks", {
  id: text().primaryKey(),
  applicationId: text("application_id")
    .references(() => applications.id)
    .notNull(),
  eligible: boolean().notNull(),
  schemeVersion: integer("scheme_version").notNull(),
  createdAt: created(),
});
export const eligibilityResults = pgTable("eligibility_rule_results", {
  id: text().primaryKey(),
  checkId: text("check_id")
    .references(() => eligibilityChecks.id)
    .notNull(),
  result: jsonb().$type<RuleResult>().notNull(),
});
export const deficiencies = pgTable(
  "deficiencies",
  {
    id: text().primaryKey(),
    applicationId: text("application_id")
      .references(() => applications.id)
      .notNull(),
    documentCategory: text("document_category"),
    kind: text().notNull(),
    issue: text().notNull(),
    action: text().notNull(),
    resolved: boolean().default(false).notNull(),
    deadline: timestamp({ withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [index("deficiencies_application_idx").on(t.applicationId)],
);
export const reviews = pgTable("reviews", {
  id: text().primaryKey(),
  applicationId: text("application_id")
    .references(() => applications.id)
    .notNull(),
  officerId: text("officer_id")
    .references(() => users.id)
    .notNull(),
  note: text().notNull(),
  internal: boolean().default(true).notNull(),
  createdAt: created(),
});
export const decisions = pgTable("officer_decisions", {
  id: text().primaryKey(),
  applicationId: text("application_id")
    .references(() => applications.id)
    .notNull(),
  officerId: text("officer_id")
    .references(() => users.id)
    .notNull(),
  decision: text().notNull(),
  reason: text().notNull(),
  createdAt: created(),
});
export const overrides = pgTable("overrides", {
  id: text().primaryKey(),
  decisionId: text("decision_id")
    .references(() => decisions.id)
    .notNull(),
  original: text().notNull(),
  reason: text().notNull(),
  createdAt: created(),
});
export const meritLists = pgTable("merit_lists", {
  id: text().primaryKey(),
  schemeId: text("scheme_id")
    .references(() => schemes.id)
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id)
    .notNull(),
  published: boolean().default(false).notNull(),
  config: jsonb().$type<SchemeConfig>().notNull(),
  createdAt: created(),
});
export const meritEntries = pgTable("merit_entries", {
  id: text().primaryKey(),
  listId: text("list_id")
    .references(() => meritLists.id)
    .notNull(),
  applicationId: text("application_id")
    .references(() => applications.id)
    .notNull(),
  rank: integer().notNull(),
  score: doublePrecision().notNull(),
  reasoning: text().notNull(),
  selected: boolean().notNull(),
});
export const notifications = pgTable(
  "notifications",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    title: text().notNull(),
    body: text().notNull(),
    href: text().notNull(),
    read: boolean().default(false).notNull(),
    delivery: text().default("In-app · email/SMS demo outbox").notNull(),
    createdAt: created(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)],
);
export const messages = pgTable("messages", {
  id: text().primaryKey(),
  applicationId: text("application_id")
    .references(() => applications.id)
    .notNull(),
  senderId: text("sender_id")
    .references(() => users.id)
    .notNull(),
  body: text().notNull(),
  createdAt: created(),
});
export const payments = pgTable("payments", {
  id: text().primaryKey(),
  applicationId: text("application_id")
    .references(() => applications.id)
    .notNull(),
  amount: integer().notNull(),
  status: text().notNull(),
  reference: text(),
  installment: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: created(),
});
export const renewals = pgTable("renewals", {
  id: text().primaryKey(),
  applicationId: text("application_id")
    .references(() => applications.id)
    .notNull(),
  year: text().notNull(),
  status: text().notNull(),
  reason: text(),
  dueDate: text("due_date").notNull(),
  createdAt: created(),
});
export const progressReports = pgTable("progress_reports", {
  id: text().primaryKey(),
  applicationId: text("application_id")
    .references(() => applications.id)
    .notNull(),
  score: doublePrecision().notNull(),
  report: text().notNull(),
  createdAt: created(),
});
export const auditHead = pgTable("audit_head", {
  id: integer().primaryKey(),
  hash: text().notNull(),
});
export const auditLogs = pgTable(
  "audit_logs",
  {
    seq: serial().primaryKey(),
    id: text().notNull().unique(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    role: text().notNull(),
    action: text().notNull(),
    entityId: text("entity_id").notNull(),
    reason: text().notNull(),
    previous: jsonb(),
    next: jsonb(),
    timestamp: text().notNull(),
    previousHash: text("previous_hash").notNull(),
    hash: text().notNull(),
  },
  (t) => [index("audit_entity_idx").on(t.entityId)],
);
export const rateLimits = pgTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
