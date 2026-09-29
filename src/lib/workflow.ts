import type { Role, Status } from "./domain";
export const transitions: Record<Status, Status[]> = {
  draft: ["submitted"],
  submitted: ["document_processing"],
  document_processing: ["ai_pre_scrutiny"],
  ai_pre_scrutiny: ["ready_for_review", "deficiency_raised"],
  deficiency_raised: [
    "submitted",
    "under_scrutiny",
    "student_response_pending",
    "approved",
    "rejected",
    "clarification_required",
  ],
  student_response_pending: [
    "submitted",
    "under_scrutiny",
    "approved",
    "rejected",
  ],
  ready_for_review: [
    "under_scrutiny",
    "approved",
    "rejected",
    "clarification_required",
    "deficiency_raised",
  ],
  under_scrutiny: [
    "approved",
    "rejected",
    "clarification_required",
    "deficiency_raised",
    "ready_for_review",
  ],
  clarification_required: [
    "submitted",
    "under_scrutiny",
    "approved",
    "rejected",
  ],
  approved: ["selected", "waitlisted"],
  rejected: [],
  waitlisted: ["selected"],
  selected: ["payment_processing", "renewal_due"],
  payment_processing: ["disbursed"],
  disbursed: ["renewal_due", "closed"],
  renewal_due: ["under_scrutiny", "closed"],
  closed: [],
};
export function canTransition(from: Status, to: Status) {
  return transitions[from].includes(to);
}
export function canAccessApplication(
  actor: { id: string; role: Role },
  app: { userId: string; officerId: string | null },
) {
  return (
    actor.role === "ministry_admin" ||
    actor.role === "scheme_admin" ||
    (actor.role === "student"
      ? actor.id === app.userId
      : actor.id === app.officerId)
  );
}
export function canDecide(role: Role) {
  return role === "officer" || role === "ministry_admin";
}
