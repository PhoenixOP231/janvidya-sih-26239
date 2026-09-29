import type {
  Analysis,
  DocumentRequirement,
  FormData,
  Mismatch,
} from "./domain";
export const fieldLabels: Record<string, string> = {
  fullName: "Name",
  dob: "Date of birth",
  category: "Category",
  familyIncome: "Income",
  academicScore: "Marks",
  institution: "Institution",
  certificateId: "Certificate ID",
  validUntil: "Valid until",
  state: "State",
  university: "University",
};
export function compareFields(
  data: FormData,
  fields: Analysis["fields"],
): Mismatch[] {
  return fields.flatMap((f) => {
    const entered = data[f.field];
    if (entered === undefined || entered === "") return [];
    const normalize = (v: unknown) =>
      String(v)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    if (normalize(entered) === normalize(f.value)) return [];
    const words = String(entered).toLowerCase().split(/\s+/),
      other = String(f.value).toLowerCase().split(/\s+/);
    const variation =
      f.field === "fullName" &&
      words[0] === other[0] &&
      words.at(-1) === other.at(-1);
    return [
      {
        field: f.field,
        entered,
        extracted: f.value,
        severity: variation ? ("variation" as const) : ("mismatch" as const),
        reason: variation
          ? "Potential name variation. An officer should verify the expanded name."
          : `${fieldLabels[f.field] || f.field} differs between the application and the document.`,
      },
    ];
  });
}
export function extractTextFields(
  text: string,
  confidence = 96,
): Analysis["fields"] {
  return Object.entries(fieldLabels).flatMap(([field, label]) => {
    const match = text.match(new RegExp(`${label}\\s*:\\s*([^\\r\\n]+)`, "i"));
    if (!match) return [];
    const raw = match[1].trim();
    const value = ["familyIncome", "academicScore"].includes(field)
      ? Number(raw.replace(/[^0-9.]/g, ""))
      : raw;
    if (typeof value === "number" && !Number.isFinite(value)) return [];
    return [{ field, value, confidence, evidence: `${label}: ${raw}` }];
  });
}
export function documentIssues(
  requirements: DocumentRequirement[],
  docs: { category: string; analysis: Analysis }[],
  threshold: number,
) {
  const issues: {
    category: string;
    kind: string;
    issue: string;
    action: string;
  }[] = [];
  for (const requirement of requirements) {
    const doc = docs.find((d) => d.category === requirement.key);
    if (!doc) {
      if (requirement.required)
        issues.push({
          category: requirement.key,
          kind: "missing",
          issue: `${requirement.label} is missing`,
          action: `Upload a readable ${requirement.label.toLowerCase()}.`,
        });
      continue;
    }
    if (doc.analysis.confidence < threshold)
      issues.push({
        category: requirement.key,
        kind: "confidence",
        issue: `${requirement.label} needs a clearer scan`,
        action:
          "Upload a clear, complete scan or ask the officer for manual verification.",
      });
    if (
      doc.analysis.classification !== requirement.key &&
      doc.analysis.classification !== "unknown"
    )
      issues.push({
        category: requirement.key,
        kind: "classification",
        issue: "Document category does not match",
        action: `Upload your ${requirement.label.toLowerCase()} in this slot.`,
      });
    for (const f of requirement.fields.filter(
      (f) => !doc.analysis.fields.some((e) => e.field === f),
    ))
      issues.push({
        category: requirement.key,
        kind: "field",
        issue: `${fieldLabels[f] || f} could not be read`,
        action:
          "Upload a complete, readable document or request manual verification.",
      });
    for (const mismatch of doc.analysis.mismatches)
      issues.push({
        category: requirement.key,
        kind: "mismatch",
        issue: mismatch.reason,
        action:
          "Check the entered value and replace the document if needed. Ambiguous differences require officer review.",
      });
    const expiry = doc.analysis.fields.find((f) => f.field === "validUntil");
    if (
      expiry &&
      !Number.isNaN(Date.parse(String(expiry.value))) &&
      Date.parse(String(expiry.value)) < Date.now()
    )
      issues.push({
        category: requirement.key,
        kind: "expired",
        issue: `${requirement.label} has expired`,
        action: "Upload a currently valid certificate.",
      });
    for (const signal of doc.analysis.signals)
      issues.push({
        category: requirement.key,
        kind: "risk",
        issue: signal,
        action:
          "An officer will verify this signal. It is not a finding of fraud.",
      });
  }
  return issues;
}
