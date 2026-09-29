import { describe, it, expect } from "vitest";
import {
  evaluateRule,
  evaluateEligibility,
  meritScore,
} from "../src/lib/rules";
import {
  canAccessApplication,
  canTransition,
  canDecide,
} from "../src/lib/workflow";
import { compareFields, documentIssues } from "../src/lib/document-analysis";
import { baseConfig } from "../src/config/schemes";
import {
  auditHash,
  verifyAuditChain,
  type AuditEvent,
} from "../src/server/audit";
import { validateApplication } from "../src/server/validation";
import type { Analysis, Operator, Rule } from "../src/lib/domain";
describe("explainable rules", () => {
  it.each<[Operator, unknown, unknown, boolean]>([
    ["=", "Scheduled Tribe", "Scheduled Tribe", true],
    ["!=", "Other", "Scheduled Tribe", true],
    [">", 60, 55, true],
    [">=", 55, 55, true],
    ["<", 54, 55, true],
    ["<=", 600000, 600000, true],
    ["IN", "PhD", ["PhD", "MPhil"], true],
    ["NOT_IN", "Masters", ["PhD"], true],
    ["BETWEEN", 25, [18, 35], true],
    ["BETWEEN", 36, [18, 35], false],
    ["<=", "", 600000, false],
    ["!=", undefined, "Other", false],
  ])("%s evaluates %s against %s", (operator, actual, value, passed) => {
    const rule = {
      id: "test",
      label: "Test rule",
      field: "test",
      operator,
      value,
    } as Rule;
    expect(evaluateRule(rule, { test: actual as string }).passed).toBe(passed);
  });
  it("supports nested AND / OR without auto-approving empty rule sets", () => {
    const condition = {
      id: "x",
      label: "Score",
      field: "score",
      operator: ">=" as const,
      value: 60,
    };
    const rule: Rule = {
      id: "and",
      label: "All",
      operator: "AND",
      rules: [
        condition,
        {
          id: "or",
          label: "Any",
          operator: "OR",
          rules: [{ ...condition, id: "y", value: 90 }, condition],
        },
      ],
    };
    expect(evaluateRule(rule, { score: 70 }).passed).toBe(true);
    expect(evaluateEligibility([], { score: 100 }).eligible).toBe(false);
  });
  it("calculates normalized weighted merit and prevents out-of-range contributions", () => {
    expect(
      meritScore(
        { academicScore: 80, familyIncome: 200000, researchScore: 80 },
        baseConfig,
      ).score,
    ).toBe(80);
    expect(
      meritScore(
        { academicScore: 200, familyIncome: -50, researchScore: 300 },
        baseConfig,
      ).score,
    ).toBe(100);
  });
});
describe("human review and ownership boundaries", () => {
  it("disallows automated or invalid state jumps", () => {
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("rejected", "selected")).toBe(false);
    expect(canTransition("ready_for_review", "approved")).toBe(true);
    expect(canDecide("student")).toBe(false);
    expect(canDecide("scheme_admin")).toBe(false);
  });
  it("enforces ownership and officer assignment", () => {
    const app = { userId: "owner", officerId: "assigned" };
    expect(canAccessApplication({ id: "other", role: "student" }, app)).toBe(
      false,
    );
    expect(canAccessApplication({ id: "other", role: "officer" }, app)).toBe(
      false,
    );
    expect(canAccessApplication({ id: "assigned", role: "officer" }, app)).toBe(
      true,
    );
    expect(
      canAccessApplication({ id: "admin", role: "ministry_admin" }, app),
    ).toBe(true);
  });
  it("distinguishes name variation from conflicting income", () => {
    const mismatches = compareFields(
      { fullName: "Rahul S Patil", familyIncome: 210000 },
      [
        {
          field: "fullName",
          value: "Rahul Sanjay Patil",
          confidence: 84,
          evidence: "Name on certificate",
        },
        {
          field: "familyIncome",
          value: 360000,
          confidence: 97,
          evidence: "Income",
        },
      ],
    );
    expect(mismatches[0].severity).toBe("variation");
    expect(mismatches[1].severity).toBe("mismatch");
  });
  it("generates missing, unreadable, expired and mismatch deficiencies", () => {
    const analysis: Analysis = {
      provider: "test",
      classification: "income",
      confidence: 20,
      quality: "review",
      fields: [
        {
          field: "validUntil",
          value: "2020-01-01",
          confidence: 20,
          evidence: "old",
        },
      ],
      mismatches: [
        {
          field: "familyIncome",
          entered: 2,
          extracted: 3,
          severity: "mismatch",
          reason: "Income differs",
        },
      ],
      signals: [],
      processedAt: new Date().toISOString(),
      explanation: "uncertain",
    };
    const issues = documentIssues(
      baseConfig.documents,
      [{ category: "income", analysis }],
      80,
    );
    expect(issues.map((i) => i.kind)).toEqual(
      expect.arrayContaining([
        "missing",
        "confidence",
        "field",
        "expired",
        "mismatch",
      ]),
    );
  });
  it("derives age and ignores attacker-supplied derived fields", () => {
    const data = validateApplication(
      { dob: "2001-06-18", age: 3, role: "ministry_admin" },
      baseConfig,
    );
    expect(Number(data.age)).toBeGreaterThan(20);
    expect(data.role).toBeUndefined();
  });
});
describe("append-only audit integrity", () => {
  it("survives JSONB key reordering and detects tampering", () => {
    const event: AuditEvent = {
      id: "1",
      actorId: "officer",
      actorName: "Reviewer",
      role: "officer",
      action: "Approve",
      entityId: "application",
      reason: "Verified evidence",
      previous: null,
      next: { status: "approved", value: 12 },
      timestamp: "2026-09-28T00:00:00Z",
      previousHash: "GENESIS",
    };
    const hash = auditHash(event);
    expect(
      auditHash({ ...event, next: { value: 12, status: "approved" } }),
    ).toBe(hash);
    expect(verifyAuditChain([{ ...event, hash }])).toBe(true);
    expect(verifyAuditChain([{ ...event, reason: "Tampered", hash }])).toBe(
      false,
    );
  });
});
