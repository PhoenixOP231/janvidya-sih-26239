import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb, type Executor } from "./db";
import { audit } from "./audit";
import { notify } from "./notifications";
import { AppError } from "./errors";
import { canAccessApplication, canDecide, canTransition } from "@/lib/workflow";
import {
  editableStatuses,
  reviewStatuses,
  type Actor,
  type FormData,
  type Status,
} from "@/lib/domain";
import { evaluateEligibility } from "@/lib/rules";
import { compareFields, documentIssues } from "@/lib/document-analysis";
import { validateApplication } from "./validation";
import {
  analyzeDocument,
  documentHash,
  storeDocument,
  validateFile,
} from "./documents";
export async function ownedApplication(
  tx: Executor,
  actor: Actor,
  id: string,
  lock = false,
) {
  const query = tx
    .select()
    .from(t.applications)
    .where(eq(t.applications.id, id));
  const [app] = lock ? await query.for("update") : await query;
  if (!app) throw new AppError("Application not found.", 404);
  if (!canAccessApplication(actor, app))
    throw new AppError("You cannot access this application.", 403);
  return app;
}
export async function createApplication(actor: Actor, schemeId: string) {
  if (actor.role !== "student")
    throw new AppError("Only a student can start an application.", 403);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [scheme] = await tx
      .select()
      .from(t.schemes)
      .where(eq(t.schemes.id, schemeId));
    if (
      !scheme?.active ||
      new Date(`${scheme.deadline}T23:59:59+05:30`) < new Date()
    )
      throw new AppError("This scheme is not accepting new applications.");
    const [profile] = await tx
      .select()
      .from(t.profiles)
      .where(eq(t.profiles.userId, actor.id));
    const [officer] = await tx
      .select()
      .from(t.users)
      .where(eq(t.users.role, "officer"))
      .limit(1);
    const id = `JV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const data = validateApplication(
      {
        ...(profile?.data || {}),
        fullName: actor.name,
        email: actor.email,
        applicationYear: new Date().getFullYear(),
      },
      scheme.config,
    );
    await tx.insert(t.applications).values({
      id,
      userId: actor.id,
      schemeId,
      officerId: officer?.id ?? null,
      data,
      schemeSnapshot: scheme.config,
      schemeVersion: scheme.version,
    });
    await audit(tx, actor, "Application created", id, "Draft started", null, {
      schemeId,
      schemeVersion: scheme.version,
    });
    return { id };
  });
}
export async function saveApplication(
  actor: Actor,
  id: string,
  input: FormData,
  version: number,
) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const app = await ownedApplication(tx, actor, id, true);
    if (
      actor.role !== "student" ||
      app.userId !== actor.id ||
      !editableStatuses.includes(app.status)
    )
      throw new AppError("This application is locked for review.", 403);
    if (app.version !== version)
      throw new AppError(
        "This application changed in another tab. Reload before saving.",
        409,
      );
    const data = validateApplication(input, app.schemeSnapshot);
    await tx
      .update(t.applications)
      .set({ data, version: app.version + 1, updatedAt: new Date() })
      .where(eq(t.applications.id, id));
    await audit(tx, actor, "Draft saved", id, "Applicant updated form", null, {
      fields: Object.keys(data),
    });
    return { version: app.version + 1 };
  });
}
export async function uploadDocument(
  actor: Actor,
  id: string,
  category: string,
  bytes: Buffer,
  filename: string,
  type: string,
) {
  const db = await getDb();
  const app = await ownedApplication(db, actor, id);
  if (
    actor.role !== "student" ||
    app.userId !== actor.id ||
    !editableStatuses.includes(app.status)
  )
    throw new AppError(
      "Documents can only be changed while your application is editable.",
      403,
    );
  if (!app.schemeSnapshot.documents.some((d) => d.key === category))
    throw new AppError("Unknown document requirement.");
  const mime = await validateFile(bytes, filename, type);
  const analysis = await analyzeDocument(bytes, mime, category, app.data);
  const hash = documentHash(bytes);
  const matches = await db
    .select({ applicationId: t.documents.applicationId })
    .from(t.documents)
    .where(and(eq(t.documents.hash, hash), ne(t.documents.applicationId, id)))
    .limit(5);
  if (matches.length)
    analysis.signals.push(
      "Identical document bytes appear in another application. Requires verification.",
    );
  return db.transaction(async (tx) => {
    const current = await ownedApplication(tx, actor, id, true);
    if (!editableStatuses.includes(current.status))
      throw new AppError(
        "The application was submitted while this upload was processing.",
        409,
      );
    analysis.mismatches = compareFields(current.data, analysis.fields);
    const docId = randomUUID(),
      ocrId = randomUUID();
    const safeFilename = filename
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .slice(0, 150);
    const storageKey = await storeDocument(
      tx,
      `documents/${id}/${docId}`,
      bytes,
      mime,
    );
    const old = await tx
      .update(t.documents)
      .set({ active: false })
      .where(
        and(
          eq(t.documents.applicationId, id),
          eq(t.documents.category, category),
          eq(t.documents.active, true),
        ),
      )
      .returning({ id: t.documents.id });
    await tx.insert(t.documents).values({
      id: docId,
      applicationId: id,
      category,
      filename: safeFilename,
      mime,
      size: bytes.length,
      hash,
      storageKey,
      analysis,
    });
    await tx.insert(t.ocrResults).values({
      id: ocrId,
      documentId: docId,
      provider: analysis.provider,
      confidence: analysis.confidence,
      result: analysis,
    });
    if (analysis.fields.length)
      await tx
        .insert(t.extractedFields)
        .values(
          analysis.fields.map((field) => ({ id: randomUUID(), ocrId, field })),
        );
    await audit(
      tx,
      actor,
      old.length ? "Document replaced" : "Document uploaded",
      id,
      `${category}: ${safeFilename}`,
      old.map((d) => d.id),
      { documentId: docId, hash },
    );
    await audit(tx, actor, "OCR completed", id, analysis.explanation, null, {
      documentId: docId,
      confidence: analysis.confidence,
      provider: analysis.provider,
    });
    return { id: docId, analysis };
  });
}
export async function submitApplication(actor: Actor, id: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const app = await ownedApplication(tx, actor, id, true);
    if (
      actor.role !== "student" ||
      app.userId !== actor.id ||
      !editableStatuses.includes(app.status)
    )
      throw new AppError("This application cannot be submitted now.", 409);
    const data = validateApplication(app.data, app.schemeSnapshot, true);
    const [scheme] = await tx
      .select()
      .from(t.schemes)
      .where(eq(t.schemes.id, app.schemeId));
    if (
      app.status === "draft" &&
      (!scheme.active ||
        new Date(`${scheme.deadline}T23:59:59+05:30`) < new Date())
    )
      throw new AppError("The application deadline has passed.");
    const docs = await tx
      .select()
      .from(t.documents)
      .where(
        and(eq(t.documents.applicationId, id), eq(t.documents.active, true)),
      );
    docs.forEach((doc) => {
      doc.analysis.mismatches = compareFields(data, doc.analysis.fields);
    });
    const issues = documentIssues(
      app.schemeSnapshot.documents,
      docs,
      app.schemeSnapshot.confidenceThreshold,
    );
    const result = evaluateEligibility(app.schemeSnapshot.rules, data);
    const candidates = await tx
      .select({
        id: t.applications.id,
        data: t.applications.data,
        userId: t.applications.userId,
      })
      .from(t.applications)
      .where(
        and(
          eq(t.applications.schemeId, app.schemeId),
          ne(t.applications.id, id),
          ne(t.applications.status, "draft"),
        ),
      );
    const duplicates = candidates.flatMap((c) => {
      if (c.data.applicationYear !== data.applicationYear) return [];
      const reasons: string[] = [];
      if (c.userId === actor.id)
        reasons.push("Same applicant and application cycle");
      if (c.data.email === data.email) reasons.push("Same contact email");
      if (c.data.phone === data.phone) reasons.push("Same contact number");
      if (c.data.fullName === data.fullName && c.data.dob === data.dob)
        reasons.push("Same name and date of birth");
      return reasons.length
        ? [
            {
              applicationId: c.id,
              score: Math.min(100, reasons.length * 30),
              reasons,
            },
          ]
        : [];
    });
    const matchingDocs = await tx
      .select({
        applicationId: t.documents.applicationId,
        hash: t.documents.hash,
        analysis: t.documents.analysis,
      })
      .from(t.documents)
      .where(
        and(ne(t.documents.applicationId, id), eq(t.documents.active, true)),
      );
    for (const other of matchingDocs) {
      const matched = docs.some(
        (d) =>
          d.hash === other.hash ||
          d.analysis.fields.some(
            (f) =>
              f.field === "certificateId" &&
              other.analysis.fields.some(
                (x) => x.field === "certificateId" && x.value === f.value,
              ),
          ),
      );
      if (
        matched &&
        !duplicates.some((d) => d.applicationId === other.applicationId)
      )
        duplicates.push({
          applicationId: other.applicationId,
          score: 75,
          reasons: ["Matching document hash or certificate identifier"],
        });
    }
    await tx
      .update(t.deficiencies)
      .set({ resolved: true })
      .where(
        and(
          eq(t.deficiencies.applicationId, id),
          ne(t.deficiencies.kind, "manual"),
        ),
      );
    if (issues.length)
      await tx.insert(t.deficiencies).values(
        issues.map((issue) => ({
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
    const checkId = randomUUID();
    await tx.insert(t.eligibilityChecks).values({
      id: checkId,
      applicationId: id,
      eligible: result.eligible,
      schemeVersion: app.schemeVersion,
    });
    await tx
      .insert(t.eligibilityResults)
      .values(
        result.results.map((r) => ({ id: randomUUID(), checkId, result: r })),
      );
    await tx
      .delete(t.applicationFields)
      .where(eq(t.applicationFields.applicationId, id));
    await tx.insert(t.applicationFields).values(
      Object.entries(data).map(([key, value]) => ({
        id: randomUUID(),
        applicationId: id,
        key,
        value,
      })),
    );
    const confidence = docs.length
      ? Math.round(
          docs.reduce((a, d) => a + d.analysis.confidence, 0) / docs.length,
        )
      : 0;
    const status: Status = issues.length
      ? "deficiency_raised"
      : "ready_for_review";
    const recommendation = issues.length
      ? `${issues.length} document issue(s) need attention. Human verification recommended.`
      : !result.eligible
        ? "Configured criteria are not satisfied. An officer must review; no automatic rejection."
        : duplicates.length
          ? "Potential duplicate signals need officer verification."
          : "Configured criteria and document checks passed. Ready for officer decision.";
    await tx
      .update(t.applications)
      .set({
        data,
        status,
        confidence,
        eligible: result.eligible,
        recommendation,
        duplicates,
        version: app.version + 1,
        submittedAt: app.submittedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(t.applications.id, id));
    for (const stage of ["submitted", "document_processing", "ai_pre_scrutiny"])
      await audit(
        tx,
        actor,
        "Status changed",
        id,
        "Application verification pipeline",
        null,
        { status: stage },
      );
    await audit(
      tx,
      actor,
      "Rule evaluation",
      id,
      `Scheme version ${app.schemeVersion}`,
      null,
      { eligible: result.eligible, results: result.results },
    );
    await audit(
      tx,
      actor,
      "AI recommendation",
      id,
      recommendation,
      { status: app.status },
      { status, confidence },
    );
    if (issues.length)
      await audit(
        tx,
        actor,
        "Deficiency generated",
        id,
        `${issues.length} actionable issues`,
        null,
        { count: issues.length },
      );
    await notify(
      tx,
      actor.id,
      issues.length
        ? "Your application needs attention"
        : "Application submitted",
      recommendation,
      `/applications/${id}`,
    );
    if (app.officerId)
      await notify(
        tx,
        app.officerId,
        "Application ready for review",
        `${id} is in your queue.`,
        `/applications/${id}`,
      );
    return { status, confidence, recommendation };
  });
}
export async function decideApplication(
  actor: Actor,
  id: string,
  action: string,
  reason: string,
  override = false,
) {
  if (!canDecide(actor.role))
    throw new AppError(
      "Only an authorized officer can make this decision.",
      403,
    );
  if (reason.trim().length < 10)
    throw new AppError("Provide a reason of at least 10 characters.");
  const db = await getDb();
  return db.transaction(async (tx) => {
    const app = await ownedApplication(tx, actor, id, true);
    if (!reviewStatuses.includes(app.status))
      throw new AppError("This application is not awaiting a decision.", 409);
    if (action === "note") {
      await tx.insert(t.reviews).values({
        id: randomUUID(),
        applicationId: id,
        officerId: actor.id,
        note: reason,
        internal: true,
      });
      await audit(tx, actor, "Internal note added", id, reason);
      return { status: app.status };
    }
    const targets: Record<string, Status> = {
      approve: "approved",
      reject: "rejected",
      clarify: "clarification_required",
      deficiency: "deficiency_raised",
      send_back: "student_response_pending",
      escalate: "under_scrutiny",
    };
    const status = targets[action];
    if (!status || !canTransition(app.status, status))
      throw new AppError("This workflow transition is not allowed.");
    const open = await tx
      .select()
      .from(t.deficiencies)
      .where(
        and(
          eq(t.deficiencies.applicationId, id),
          eq(t.deficiencies.resolved, false),
        ),
      );
    const flagged =
      !app.eligible ||
      open.length > 0 ||
      app.duplicates.length > 0 ||
      app.confidence < app.schemeSnapshot.confidenceThreshold;
    if (action === "approve" && flagged && !override)
      throw new AppError(
        "This application has review flags. Enable the reasoned override to approve.",
      );
    const decisionId = randomUUID();
    await tx.insert(t.decisions).values({
      id: decisionId,
      applicationId: id,
      officerId: actor.id,
      decision: action,
      reason,
    });
    if (override)
      await tx.insert(t.overrides).values({
        id: randomUUID(),
        decisionId,
        original: app.recommendation,
        reason,
      });
    if (action === "deficiency")
      await tx.insert(t.deficiencies).values({
        id: randomUUID(),
        applicationId: id,
        kind: "manual",
        issue: reason,
        action:
          "Respond in the application messages and provide the requested document.",
        deadline: new Date(
          Date.now() + app.schemeSnapshot.deficiencyDays * 86400000,
        ),
      });
    if (action === "approve")
      await tx
        .update(t.deficiencies)
        .set({ resolved: true })
        .where(eq(t.deficiencies.applicationId, id));
    await tx
      .update(t.applications)
      .set({
        status,
        version: app.version + 1,
        updatedAt: new Date(),
        decidedAt: ["approve", "reject"].includes(action) ? new Date() : null,
        ...(action === "escalate" ? { officerId: null } : {}),
      })
      .where(eq(t.applications.id, id));
    await audit(
      tx,
      actor,
      override ? "Officer override" : `Officer ${action}`,
      id,
      reason,
      { status: app.status, recommendation: app.recommendation },
      { status },
    );
    await notify(
      tx,
      app.userId,
      `Application ${status.replaceAll("_", " ")}`,
      reason,
      `/applications/${id}`,
    );
    return { status };
  });
}
