import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import * as t from "@/db/schema";
import type { Actor } from "@/lib/domain";
import { getDb } from "./db";
import { ownedApplication } from "./applications";
import { audit } from "./audit";
import { notify } from "./notifications";
import { AppError } from "./errors";
import { canDecide } from "@/lib/workflow";
import { compareFields, documentIssues } from "@/lib/document-analysis";
export async function correctEvidence(
  actor: Actor,
  id: string,
  documentId: string,
  field: string,
  value: string,
  reason: string,
) {
  if (!canDecide(actor.role))
    throw new AppError("Only an officer can correct extracted evidence.", 403);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const app = await ownedApplication(tx, actor, id, true);
    if (
      ![
        "ready_for_review",
        "under_scrutiny",
        "deficiency_raised",
        "clarification_required",
      ].includes(app.status)
    )
      throw new AppError("Evidence is locked after a final decision.", 409);
    const [doc] = await tx
      .select()
      .from(t.documents)
      .where(
        and(
          eq(t.documents.id, documentId),
          eq(t.documents.applicationId, id),
          eq(t.documents.active, true),
        ),
      );
    if (!doc) throw new AppError("Document not found.", 404);
    const original = doc.analysis.fields.find((f) => f.field === field);
    if (
      !original &&
      !app.schemeSnapshot.documents
        .find((d) => d.key === doc.category)
        ?.fields.includes(field)
    )
      throw new AppError("Unknown evidence field.");
    const corrected = {
      field,
      value: ["familyIncome", "academicScore"].includes(field)
        ? Number(value)
        : value,
      confidence: 100,
      evidence: `Manually verified by ${actor.name}. ${reason}`,
    };
    if (
      typeof corrected.value === "number" &&
      (!Number.isFinite(corrected.value) || corrected.value < 0)
    )
      throw new AppError("Enter a valid numeric value.");
    const analysis = {
      ...doc.analysis,
      fields: [
        ...doc.analysis.fields.filter((f) => f.field !== field),
        corrected,
      ],
      provider: `${doc.analysis.provider} + officer correction`,
      processedAt: new Date().toISOString(),
    };
    analysis.confidence = Math.round(
      analysis.fields.reduce((n, f) => n + f.confidence, 0) /
        analysis.fields.length,
    );
    analysis.mismatches = compareFields(app.data, analysis.fields);
    await tx
      .update(t.documents)
      .set({ analysis })
      .where(eq(t.documents.id, documentId));
    const ocrId = randomUUID();
    await tx.insert(t.ocrResults).values({
      id: ocrId,
      documentId,
      provider: analysis.provider,
      confidence: analysis.confidence,
      result: analysis,
    });
    await tx
      .insert(t.extractedFields)
      .values(
        analysis.fields.map((field) => ({ id: randomUUID(), ocrId, field })),
      );
    const docs = await tx
      .select()
      .from(t.documents)
      .where(
        and(eq(t.documents.applicationId, id), eq(t.documents.active, true)),
      );
    const issues = documentIssues(
      app.schemeSnapshot.documents,
      docs,
      app.schemeSnapshot.confidenceThreshold,
    );
    await tx
      .update(t.deficiencies)
      .set({ resolved: true })
      .where(
        and(
          eq(t.deficiencies.applicationId, id),
          eq(t.deficiencies.documentCategory, doc.category),
        ),
      );
    const relevant = issues.filter((issue) => issue.category === doc.category);
    if (relevant.length)
      await tx.insert(t.deficiencies).values(
        relevant.map((issue) => ({
          id: randomUUID(),
          applicationId: id,
          documentCategory: issue.category,
          kind: issue.kind,
          issue: issue.issue,
          action: issue.action,
          deadline: new Date(
            Date.now() + app.schemeSnapshot.deficiencyDays * 86400000,
          ),
        })),
      );
    await tx
      .update(t.applications)
      .set({
        confidence: Math.round(
          docs.reduce((n, d) => n + d.analysis.confidence, 0) / docs.length,
        ),
        version: app.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(t.applications.id, id));
    await audit(
      tx,
      actor,
      "Evidence corrected",
      id,
      reason,
      { documentId, field, value: original?.value ?? null },
      { value: corrected.value },
    );
    return { corrected: true };
  });
}
export async function recordPayment(
  actor: Actor,
  id: string,
  status: string,
  reference: string,
) {
  if (actor.role !== "ministry_admin")
    throw new AppError(
      "Only ministry administrators can update payments.",
      403,
    );
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(t.payments)
      .where(eq(t.payments.id, id))
      .for("update");
    if (!payment) throw new AppError("Payment not found.", 404);
    if (!(
      (payment.status === "scheduled" && status === "processing") ||
      (payment.status === "processing" && status === "disbursed")
    ))
      throw new AppError(
        "Payment must progress from scheduled to processing to disbursed.",
      );
    if (status === "disbursed" && reference.trim().length < 5)
      throw new AppError(
        "Enter a payment reference of at least five characters.",
      );
    const app = await ownedApplication(tx, actor, payment.applicationId, true);
    const next = status === "processing" ? "payment_processing" : "disbursed";
    if (!["selected", "payment_processing"].includes(app.status))
      throw new AppError("This application is not ready for payment.");
    await tx
      .update(t.payments)
      .set({ status, reference, updatedAt: new Date() })
      .where(eq(t.payments.id, id));
    await tx
      .update(t.applications)
      .set({ status: next, version: app.version + 1, updatedAt: new Date() })
      .where(eq(t.applications.id, app.id));
    if (status === "disbursed")
      await tx.insert(t.renewals).values({
        id: randomUUID(),
        applicationId: app.id,
        year: `${new Date().getFullYear() + 1}`,
        status: "due",
        dueDate: `${new Date().getFullYear() + 1}-03-31`,
      });
    await audit(
      tx,
      actor,
      "Payment update",
      app.id,
      "Demonstration ledger update; no funds transferred.",
      { status: payment.status },
      { status, reference },
    );
    await notify(
      tx,
      app.userId,
      `Payment ${status}`,
      `Your payment tracker was updated. Reference: ${reference || "Pending"}. This does not transfer money.`,
      `/payments`,
    );
    return { status };
  });
}
export async function progressReport(
  actor: Actor,
  id: string,
  score: number,
  report: string,
) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const app = await ownedApplication(tx, actor, id, true);
    if (
      actor.role !== "student" ||
      !["selected", "payment_processing", "disbursed", "renewal_due"].includes(
        app.status,
      )
    )
      throw new AppError(
        "Progress reports are available after selection.",
        403,
      );
    await tx
      .insert(t.progressReports)
      .values({ id: randomUUID(), applicationId: id, score, report });
    await audit(
      tx,
      actor,
      "Progress report submitted",
      id,
      "Student provided academic progress.",
      null,
      { score },
    );
    return { saved: true };
  });
}
export async function requestRenewal(actor: Actor, id: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const app = await ownedApplication(tx, actor, id, true);
    if (
      actor.role !== "student" ||
      !["disbursed", "renewal_due"].includes(app.status)
    )
      throw new AppError("Renewal is available after disbursement.", 403);
    const reports = await tx
      .select()
      .from(t.progressReports)
      .where(eq(t.progressReports.applicationId, id));
    if (!reports.length)
      throw new AppError("Submit a progress report before requesting renewal.");
    const pending = await tx
      .select()
      .from(t.renewals)
      .where(
        and(
          eq(t.renewals.applicationId, id),
          eq(t.renewals.status, "requested"),
        ),
      );
    if (pending.length)
      throw new AppError("A renewal request is already under review.", 409);
    await tx
      .update(t.renewals)
      .set({
        status: "requested",
        reason: "Progress report submitted; officer review required.",
      })
      .where(
        and(eq(t.renewals.applicationId, id), eq(t.renewals.status, "due")),
      );
    await tx
      .update(t.applications)
      .set({
        status: "renewal_due",
        version: app.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(t.applications.id, id));
    await audit(tx, actor, "Renewal requested", id, "Awaiting officer review.");
    if (app.officerId)
      await notify(
        tx,
        app.officerId,
        "Renewal requires review",
        id,
        `/applications/${id}`,
      );
    return { requested: true };
  });
}
export async function reviewRenewal(
  actor: Actor,
  id: string,
  approved: boolean,
  reason: string,
  override = false,
) {
  if (!canDecide(actor.role))
    throw new AppError("Only officers can review renewals.", 403);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const app = await ownedApplication(tx, actor, id, true);
    if (app.status !== "renewal_due") throw new AppError("No renewal is due.");
    const [report] = await tx
      .select()
      .from(t.progressReports)
      .where(eq(t.progressReports.applicationId, id))
      .orderBy(desc(t.progressReports.createdAt))
      .limit(1);
    if (!report)
      throw new AppError("Submit a progress report before requesting renewal.");
    const belowThreshold = report.score < app.schemeSnapshot.renewalMinScore;
    if (approved && belowThreshold && !override)
      throw new AppError(
        "The progress score is below the renewal threshold. Enable a reasoned override to approve.",
      );
    const rows = await tx
      .update(t.renewals)
      .set({ status: approved ? "approved" : "rejected", reason })
      .where(
        and(
          eq(t.renewals.applicationId, id),
          eq(t.renewals.status, "requested"),
        ),
      )
      .returning();
    if (!rows.length) throw new AppError("No renewal request is pending.");
    if (approved) {
      const [scheme] = await tx
        .select()
        .from(t.schemes)
        .where(eq(t.schemes.id, app.schemeId));
      await tx.insert(t.payments).values({
        id: randomUUID(),
        applicationId: id,
        amount: scheme.award,
        status: "scheduled",
        installment: `Renewal ${rows[0].year}`,
      });
    }
    await tx
      .update(t.applications)
      .set({
        status: approved ? "selected" : "closed",
        version: app.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(t.applications.id, id));
    await audit(tx, actor, "Renewal decision", id, reason, null, {
      approved,
      override: approved && belowThreshold && override,
      score: report.score,
      minimumScore: app.schemeSnapshot.renewalMinScore,
    });
    await notify(
      tx,
      app.userId,
      `Renewal ${approved ? "approved" : "declined"}`,
      reason,
      `/applications/${id}`,
    );
    return { approved };
  });
}
