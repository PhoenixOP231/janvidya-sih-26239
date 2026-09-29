import { z } from "zod";
import { AppError } from "./errors";
import type { FormData, SchemeConfig, Rule } from "@/lib/domain";
export const formSchema = z.record(
  z.string().max(80),
  z.union([z.string().max(3000), z.number().finite(), z.boolean()]),
);
const ruleSchema: z.ZodType<Rule> = z.lazy(() =>
  z.union([
    z.object({
      id: z.string().min(1).max(80),
      label: z.string().min(1).max(200),
      field: z.string().min(1),
      operator: z.enum([
        "=",
        "!=",
        ">",
        ">=",
        "<",
        "<=",
        "IN",
        "NOT_IN",
        "BETWEEN",
      ]),
      value: z.union([
        z.string().max(200),
        z.number().finite(),
        z.array(z.union([z.string().max(200), z.number().finite()])).max(100),
      ]),
    }),
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      operator: z.enum(["AND", "OR"]),
      rules: z.array(ruleSchema).min(1).max(30),
    }),
  ]),
);
export const schemeSchema = z
  .object({
    code: z
      .string()
      .min(2)
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/),
    name: z.string().min(5).max(160),
    description: z.string().min(10).max(1200),
    type: z.string().min(2).max(60),
    award: z.number().int().positive().max(10000000),
    deadline: z.iso.date(),
    active: z.boolean(),
    version: z.number().int().optional(),
    config: z.object({
      fields: z
        .array(
          z.object({
            key: z
              .string()
              .regex(/^[a-zA-Z][a-zA-Z0-9]*$/)
              .max(80),
            label: z.string().min(1).max(120),
            section: z.string().min(1).max(100),
            type: z.enum(["text", "number", "date", "select", "email", "tel"]),
            required: z.boolean(),
            options: z.array(z.string().max(100)).max(100).optional(),
            help: z.string().max(400).optional(),
          }),
        )
        .min(1)
        .max(100),
      documents: z
        .array(
          z.object({
            key: z.string().regex(/^[a-z0-9_]+$/),
            label: z.string().min(1).max(120),
            required: z.boolean(),
            fields: z.array(z.string()).max(20),
          }),
        )
        .min(1)
        .max(20),
      rules: z.array(ruleSchema).min(1).max(40),
      weights: z.object({
        academic: z.number().min(0).max(100),
        income: z.number().min(0).max(100),
        research: z.number().min(0).max(100),
      }),
      quota: z.number().int().min(1).max(100000),
      stateQuotas: z.record(z.string(), z.number().int().min(0).max(100000)),
      renewalMinScore: z.number().min(0).max(100),
      deficiencyDays: z.number().int().min(1).max(90),
      confidenceThreshold: z.number().min(1).max(100),
    }),
  })
  .superRefine((s, ctx) => {
    if (Object.values(s.config.weights).reduce((a, b) => a + b, 0) === 0)
      ctx.addIssue({
        code: "custom",
        message: "At least one ranking weight must be positive.",
      });
    for (const list of [
      s.config.fields.map((f) => f.key),
      s.config.documents.map((d) => d.key),
    ])
      if (new Set(list).size !== list.length)
        ctx.addIssue({
          code: "custom",
          message: "Field and document keys must be unique.",
        });
    if (s.config.fields.some((f) => f.type === "select" && !f.options?.length))
      ctx.addIssue({
        code: "custom",
        message: "Select fields need at least one option.",
      });
  });
export function validateApplication(
  input: FormData,
  config: SchemeConfig,
  complete = false,
): FormData {
  const parsed = formSchema.parse(input);
  const allowed = new Set([...config.fields.map((f) => f.key), "consent"]);
  const data = Object.fromEntries(
    Object.entries(parsed).filter(([key]) => allowed.has(key)),
  );
  for (const f of config.fields) {
    const value = data[f.key];
    if (
      complete &&
      f.required &&
      (value === undefined || String(value).trim() === "")
    )
      throw new AppError(`${f.label} is required.`);
    if (value === undefined || value === "") continue;
    if (
      f.type === "number" &&
      (!Number.isFinite(Number(value)) || Number(value) < 0)
    )
      throw new AppError(`${f.label} must be a valid positive number.`);
    if (f.type === "number") data[f.key] = Number(value);
    if (f.type === "select" && !f.options?.includes(String(value)))
      throw new AppError(`Choose a valid option for ${f.label}.`);
    if (f.type === "email" && !z.email().safeParse(value).success)
      throw new AppError("Enter a valid email address.");
    if (f.type === "date" && !z.iso.date().safeParse(value).success)
      throw new AppError(`Enter a valid ${f.label.toLowerCase()}.`);
  }
  if (data.dob) {
    const birth = new Date(String(data.dob));
    const now = new Date();
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    if (
      now.getUTCMonth() < birth.getUTCMonth() ||
      (now.getUTCMonth() === birth.getUTCMonth() &&
        now.getUTCDate() < birth.getUTCDate())
    )
      age--;
    if (age < 0 || age > 120) throw new AppError("Check your date of birth.");
    data.age = age;
  }
  for (const key of ["academicScore", "researchScore"])
    if (Number(data[key]) > 100)
      throw new AppError("Scores must be between 0 and 100.");
  if (data.bankLast4 && !/^\d{4}$/.test(String(data.bankLast4)))
    throw new AppError("Enter only the four final digits of your account.");
  if (complete && data.consent !== true)
    throw new AppError("Read and accept the declaration before submitting.");
  return data;
}
