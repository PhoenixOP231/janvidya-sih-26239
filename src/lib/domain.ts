export const roles = [
  "student",
  "officer",
  "scheme_admin",
  "ministry_admin",
] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  student: "Student",
  officer: "Scrutiny officer",
  scheme_admin: "Scheme administrator",
  ministry_admin: "Ministry administrator",
};
export const statuses = [
  "draft",
  "submitted",
  "document_processing",
  "ai_pre_scrutiny",
  "deficiency_raised",
  "student_response_pending",
  "ready_for_review",
  "under_scrutiny",
  "clarification_required",
  "approved",
  "rejected",
  "waitlisted",
  "selected",
  "payment_processing",
  "disbursed",
  "renewal_due",
  "closed",
] as const;
export type Status = (typeof statuses)[number];
export const statusLabels: Record<Status, string> = {
  draft: "Draft",
  submitted: "Submitted",
  document_processing: "Document processing",
  ai_pre_scrutiny: "AI pre-scrutiny",
  deficiency_raised: "Deficiency raised",
  student_response_pending: "Response pending",
  ready_for_review: "Ready for review",
  under_scrutiny: "Under scrutiny",
  clarification_required: "Clarification required",
  approved: "Approved",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  selected: "Selected",
  payment_processing: "Payment processing",
  disbursed: "Disbursed",
  renewal_due: "Renewal due",
  closed: "Closed",
};
export type FormData = Record<string, string | number | boolean>;
export type Operator =
  "=" | "!=" | ">" | ">=" | "<" | "<=" | "IN" | "NOT_IN" | "BETWEEN";
export type Condition = {
  id: string;
  field: string;
  operator: Operator;
  value: string | number | (string | number)[];
  label: string;
};
export type Rule =
  | Condition
  | { id: string; operator: "AND" | "OR"; rules: Rule[]; label: string };
export type RuleResult = {
  id: string;
  label: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  explanation: string;
};
export type FieldConfig = {
  key: string;
  label: string;
  section: string;
  type: "text" | "number" | "date" | "select" | "email" | "tel";
  required: boolean;
  options?: string[];
  help?: string;
};
export type DocumentRequirement = {
  key: string;
  label: string;
  required: boolean;
  fields: string[];
};
export type SchemeConfig = {
  fields: FieldConfig[];
  documents: DocumentRequirement[];
  rules: Rule[];
  weights: { academic: number; income: number; research: number };
  quota: number;
  stateQuotas: Record<string, number>;
  renewalMinScore: number;
  deficiencyDays: number;
  confidenceThreshold: number;
};
export type ExtractedValue = {
  field: string;
  value: string | number;
  confidence: number;
  evidence: string;
};
export type Mismatch = {
  field: string;
  entered: string | number | boolean;
  extracted: string | number;
  severity: "variation" | "mismatch";
  reason: string;
};
export type Analysis = {
  provider: string;
  classification: string;
  confidence: number;
  quality: "good" | "review";
  fields: ExtractedValue[];
  mismatches: Mismatch[];
  signals: string[];
  processedAt: string;
  explanation: string;
};
export type Duplicate = {
  applicationId: string;
  score: number;
  reasons: string[];
};
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  demo: boolean;
};
export const editableStatuses: Status[] = [
  "draft",
  "deficiency_raised",
  "student_response_pending",
  "clarification_required",
];
export const reviewStatuses: Status[] = [
  "ready_for_review",
  "under_scrutiny",
  "deficiency_raised",
  "student_response_pending",
  "clarification_required",
];
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
export const dateLabel = (s: string | Date) =>
  new Date(s).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
