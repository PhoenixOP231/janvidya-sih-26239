import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, closeDb, type DB } from "../src/server/db";
import {
  createApplication,
  saveApplication,
  uploadDocument,
  submitApplication,
  decideApplication,
} from "../src/server/applications";
import { generateMerit, publishMerit } from "../src/server/administration";
import {
  makeFixture,
  analyzeDocument,
  validateFile,
} from "../src/server/documents";
import { studentData } from "../src/server/seed";
import { demoSchemes } from "../src/config/schemes";
import { verifyAuditChain } from "../src/server/audit";
import {
  recordPayment,
  progressReport,
  requestRenewal,
  reviewRenewal,
} from "../src/server/follow-up";
import * as t from "../src/db/schema";
import type { Actor } from "../src/lib/domain";
let db: DB;
let applicationId = "";
const student: Actor = {
  id: "test-student",
  name: "Fictional Test Student",
  email: "test@janvidya.demo",
  role: "student",
  demo: true,
};
const officer: Actor = {
  id: "demo-officer",
  name: "Ananya Sharma",
  email: "officer@janvidya.demo",
  role: "officer",
  demo: true,
};
const admin: Actor = {
  id: "demo-admin",
  name: "Priya Menon",
  email: "admin@janvidya.demo",
  role: "ministry_admin",
  demo: true,
};
beforeAll(async () => {
  process.env.PGLITE_DIR = "memory://";
  process.env.DEMO_MODE = "true";
  delete process.env.DATABASE_URL;
  db = await getDb();
  await db.insert(t.users).values({ ...student, passwordHash: "disabled" });
  await db.insert(t.profiles).values({
    userId: student.id,
    data: {
      ...studentData,
      fullName: student.name,
      email: student.email,
      phone: "DEMO-TEST-ISOLATED",
    },
  });
});
afterAll(async () => {
  await closeDb();
});
describe("transactional student → document → officer → selection workflow", () => {
  it("extracts real fixture text, validates files and does not invent image fields", async () => {
    const requirement = demoSchemes[0].config.documents[1];
    const bytes = await makeFixture(requirement, studentData);
    expect(await validateFile(bytes, "income.pdf", "application/pdf")).toBe(
      "application/pdf",
    );
    const result = await analyzeDocument(
      bytes,
      "application/pdf",
      "income",
      studentData,
    );
    expect(result.fields.find((f) => f.field === "familyIncome")?.value).toBe(
      210000,
    );
    expect(result.fields.find((f) => f.field === "fullName")?.value).toBe(
      "Meera Kisku",
    );
    expect(result.mismatches).toHaveLength(0);
    await expect(
      validateFile(Buffer.from("not a PDF"), "x.pdf", "application/pdf"),
    ).rejects.toThrow();
    await expect(
      validateFile(Buffer.alloc(0), "x.pdf", "application/pdf"),
    ).rejects.toThrow();
  });
  it("creates a draft, persists answers, detects stale saves and blocks cross-user access", async () => {
    const app = await createApplication(student, "nfst");
    applicationId = app.id;
    const data = {
      ...studentData,
      fullName: student.name,
      email: student.email,
      phone: "DEMO-TEST-ISOLATED",
      consent: true,
    };
    expect(await saveApplication(student, applicationId, data, 1)).toEqual({
      version: 2,
    });
    await expect(
      saveApplication(student, applicationId, data, 1),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      saveApplication({ ...student, id: "intruder" }, applicationId, data, 2),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("raises missing-document deficiencies instead of rejecting an application", async () => {
    const result = await submitApplication(student, applicationId);
    expect(result.status).toBe("deficiency_raised");
    const [app] = await db
      .select()
      .from(t.applications)
      .where(eq(t.applications.id, applicationId));
    expect(app.eligible).toBe(true);
  });
  it("uploads fixtures, resubmits and routes to officer review", async () => {
    const [app] = await db
      .select()
      .from(t.applications)
      .where(eq(t.applications.id, applicationId));
    for (const requirement of app.schemeSnapshot.documents.filter(
      (d) => d.required,
    )) {
      const bytes = await makeFixture(requirement, app.data);
      await uploadDocument(
        student,
        applicationId,
        requirement.key,
        bytes,
        `${requirement.key}.pdf`,
        "application/pdf",
      );
    }
    const result = await submitApplication(student, applicationId);
    expect(result.status).toBe("ready_for_review");
    expect(result.confidence).toBeGreaterThan(90);
  });
  it("requires authority, comments, and explicit overrides for flagged cases", async () => {
    await expect(
      decideApplication(
        student,
        applicationId,
        "approve",
        "Verified documents",
        false,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      decideApplication(
        officer,
        "JV-2026-0006",
        "approve",
        "Verified exception under demo authority.",
        false,
      ),
    ).rejects.toThrow(/override/);
    await decideApplication(
      officer,
      "JV-2026-0006",
      "approve",
      "Verified exception under demo authority.",
      true,
    );
    const overrides = await db.select().from(t.overrides);
    expect(overrides.length).toBe(1);
    expect(
      await decideApplication(
        officer,
        applicationId,
        "approve",
        "All required documents and criteria verified.",
        false,
      ),
    ).toEqual({ status: "approved" });
    await expect(
      decideApplication(
        officer,
        applicationId,
        "reject",
        "Repeated conflicting decision.",
        false,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("generates explainable merit, publishes once and schedules payments", async () => {
    const { id } = await generateMerit(admin, "nfst");
    const entries = await db
      .select()
      .from(t.meritEntries)
      .where(eq(t.meritEntries.listId, id));
    expect(entries.length).toBeGreaterThan(1);
    expect(entries.every((e) => e.reasoning.includes("Academic"))).toBe(true);
    await publishMerit(admin, id);
    await expect(publishMerit(admin, id)).rejects.toMatchObject({
      status: 409,
    });
    const [app] = await db
      .select()
      .from(t.applications)
      .where(eq(t.applications.id, applicationId));
    expect(app.status).toBe("selected");
  });
  it("records payment progression and a human-reviewed renewal", async () => {
    const [payment] = await db
      .select()
      .from(t.payments)
      .where(eq(t.payments.applicationId, applicationId));
    await expect(
      recordPayment(admin, payment.id, "disbursed", "DEMO-123"),
    ).rejects.toThrow();
    await recordPayment(admin, payment.id, "processing", "");
    await recordPayment(admin, payment.id, "disbursed", "DEMO-TEST-123");
    await progressReport(
      student,
      applicationId,
      88,
      "Completed all research milestones in this fictional term.",
    );
    await requestRenewal(student, applicationId);
    await reviewRenewal(
      officer,
      applicationId,
      true,
      "Progress report exceeds the configured renewal threshold.",
    );
    const [app] = await db
      .select()
      .from(t.applications)
      .where(eq(t.applications.id, applicationId));
    expect(app.status).toBe("selected");
  });
  it("keeps a verifiable hash chain and refuses destructive audit writes", async () => {
    const events = await db.select().from(t.auditLogs).orderBy(t.auditLogs.seq);
    expect(verifyAuditChain(events)).toBe(true);
    await expect(
      db
        .update(t.auditLogs)
        .set({ reason: "tamper" })
        .where(eq(t.auditLogs.id, events[0].id)),
    ).rejects.toThrow();
    expect(
      (
        await db
          .select()
          .from(t.notifications)
          .where(eq(t.notifications.userId, student.id))
      ).length,
    ).toBeGreaterThan(3);
  });
});
