import type { Rule, RuleResult, FormData, SchemeConfig } from "./domain";

const normal = (v: unknown) =>
  typeof v === "string" ? v.trim().toLowerCase() : v;
export function evaluateRule(rule: Rule, data: FormData): RuleResult {
  if (rule.operator === "AND" || rule.operator === "OR") {
    const children = rule.rules.map((r) => evaluateRule(r, data));
    const passed =
      rule.operator === "AND"
        ? children.every((r) => r.passed)
        : children.some((r) => r.passed);
    return {
      id: rule.id,
      label: rule.label,
      passed,
      actual: children,
      expected: rule.operator,
      explanation: children.map((r) => r.explanation).join("; "),
    };
  }
  const r = rule as Exclude<Rule, { rules: Rule[] }>;
  const actual = data[r.field];
  let passed = false;
  if (actual !== undefined && actual !== "" && actual !== null) {
    const a = Number(actual),
      b = Number(r.value);
    switch (r.operator) {
      case "=":
        passed = normal(actual) === normal(r.value);
        break;
      case "!=":
        passed = normal(actual) !== normal(r.value);
        break;
      case ">":
        passed = Number.isFinite(a) && a > b;
        break;
      case ">=":
        passed = Number.isFinite(a) && a >= b;
        break;
      case "<":
        passed = Number.isFinite(a) && a < b;
        break;
      case "<=":
        passed = Number.isFinite(a) && a <= b;
        break;
      case "IN":
        passed =
          Array.isArray(r.value) &&
          r.value.some((v) => normal(v) === normal(actual));
        break;
      case "NOT_IN":
        passed =
          Array.isArray(r.value) &&
          !r.value.some((v) => normal(v) === normal(actual));
        break;
      case "BETWEEN":
        passed =
          Array.isArray(r.value) &&
          r.value.length === 2 &&
          Number.isFinite(a) &&
          a >= Number(r.value[0]) &&
          a <= Number(r.value[1]);
        break;
    }
  }
  return {
    id: r.id,
    label: r.label,
    passed,
    actual: actual ?? null,
    expected: r.value,
    explanation: `${r.label}: ${actual === undefined || actual === "" ? "information missing" : `${actual} ${passed ? "satisfies" : "does not satisfy"} ${r.operator} ${Array.isArray(r.value) ? r.value.join(", ") : r.value}`}.`,
  };
}
export function evaluateEligibility(rules: Rule[], data: FormData) {
  const results = rules.map((r) => evaluateRule(r, data));
  return {
    eligible: results.length > 0 && results.every((r) => r.passed),
    results,
  };
}
export function meritScore(data: FormData, config: SchemeConfig) {
  const clamp = (n: number) =>
    Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
  const academic = clamp(Number(data.academicScore));
  const research = clamp(Number(data.researchScore || 0));
  const income = clamp(100 * (1 - Number(data.familyIncome || 0) / 1000000));
  const total = Object.values(config.weights).reduce((a, b) => a + b, 0);
  const score = total
    ? (academic * config.weights.academic +
        income * config.weights.income +
        research * config.weights.research) /
      total
    : 0;
  return {
    score: Math.round(score * 100) / 100,
    reasoning: `Academic ${academic} × ${config.weights.academic}; income priority ${income.toFixed(1)} × ${config.weights.income}; research ${research} × ${config.weights.research}. Normalized by ${total}.`,
  };
}
