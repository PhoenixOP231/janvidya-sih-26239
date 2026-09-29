import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import * as t from "@/db/schema";
import { getDb, demoEnabled } from "@/server/db";
import {
  checkOrigin,
  requireActor,
  rateLimit,
  newSession,
  setSession,
  logout,
} from "@/server/auth";
import { hashPassword, verifyPassword } from "@/server/password";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import {
  createApplication,
  saveApplication,
  submitApplication,
  uploadDocument,
  decideApplication,
  ownedApplication,
} from "@/server/applications";
import {
  saveScheme,
  generateMerit,
  publishMerit,
  getMeritLists,
} from "@/server/administration";
import {
  correctEvidence,
  recordPayment,
  progressReport,
  requestRenewal,
  reviewRenewal,
} from "@/server/follow-up";
import { makeFixture, readDocument } from "@/server/documents";
import { formSchema, validateApplication } from "@/server/validation";
import { commonFields, baseConfig } from "@/config/schemes";
import { answerQuestion } from "@/server/chat";
import { notify } from "@/server/notifications";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { roleLabels, statusLabels } from "@/lib/domain";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ path: string[] }> };
const comment = z
  .string()
  .trim()
  .min(10, "Please provide at least 10 characters.")
  .max(2000);
const csvCell = (value: unknown) =>
  `"${String(value ?? "")
    .replace(/^[=+@-]/, "'$&")
    .replaceAll('"', '""')}"`;
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  const [resource, id, action] = path;
  const db = await getDb();
  if (request.method === "POST") {
    checkOrigin(request);
    if (resource === "auth") {
      await rateLimit(
        `auth:${id}:${request.headers.get("x-forwarded-for") || "local"}`,
        15,
      );
      if (id === "logout") {
        await logout();
        return { ok: true };
      }
      const body = await request.json();
      if (id === "demo") {
        if (!demoEnabled())
          throw new AppError("Demo sign-in is disabled.", 403);
        const { role } = z
          .object({
            role: z.enum([
              "student",
              "officer",
              "scheme_admin",
              "ministry_admin",
            ]),
          })
          .parse(body);
        const [user] = await db
          .select()
          .from(t.users)
          .where(
            and(
              eq(t.users.role, role),
              eq(t.users.demo, true),
              eq(
                t.users.id,
                {
                  student: "demo-student",
                  officer: "demo-officer",
                  scheme_admin: "demo-scheme",
                  ministry_admin: "demo-admin",
                }[role],
              ),
            ),
          );
        if (!user)
          throw new AppError(
            "Demo data is not initialized. Run npm run seed.",
            503,
          );
        await setSession(await newSession(db, user.id));
        return { redirect: "/workspace" };
      }
      const credentials = z
        .object({
          email: z
            .email()
            .max(200)
            .transform((s) => s.toLowerCase().trim()),
          password: z.string().min(12).max(128),
          name: z.string().trim().min(2).max(100).optional(),
          consent: z.boolean().optional(),
        })
        .parse(body);
      if (id === "register") {
        if (!credentials.name || !credentials.consent)
          throw new AppError(
            "Provide your name and accept the privacy notice.",
          );
        const exists = await db
          .select({ id: t.users.id })
          .from(t.users)
          .where(eq(t.users.email, credentials.email));
        if (exists.length)
          throw new AppError(
            "This email is already registered. Sign in instead.",
            409,
          );
        const user = {
          id: randomUUID(),
          name: credentials.name,
          email: credentials.email,
          passwordHash: hashPassword(credentials.password),
          role: "student" as const,
          demo: false,
        };
        const token = await db.transaction(async (tx) => {
          await tx.insert(t.users).values(user);
          await tx.insert(t.profiles).values({
            userId: user.id,
            data: { fullName: user.name, email: user.email },
          });
          await audit(
            tx,
            user,
            "Account created",
            user.id,
            "Privacy consent accepted.",
          );
          return newSession(tx, user.id);
        });
        await setSession(token);
        return { redirect: "/workspace" };
      }
      if (id === "login") {
        const [user] = await db
          .select()
          .from(t.users)
          .where(eq(t.users.email, credentials.email));
        if (
          !user ||
          !verifyPassword(credentials.password, user.passwordHash) ||
          (user.demo && !demoEnabled())
        )
          throw new AppError("Email or password is incorrect.", 401);
        await setSession(await newSession(db, user.id));
        return { redirect: "/workspace" };
      }
      throw new AppError("Unknown authentication action.", 404);
    }
    const actor = await requireActor();
    await rateLimit(`write:${actor.id}`, 120);
    if (resource === "applications" && action === "documents") {
      const data = await request.formData();
      const file = data.get("file");
      const category = z.string().max(80).parse(data.get("category"));
      if (!(file instanceof File))
        throw new AppError("Choose a document to upload.");
      if (file.size > 3 * 1024 * 1024)
        throw new AppError("Each document must be smaller than 3 MB.");
      return uploadDocument(
        actor,
        id,
        category,
        Buffer.from(await file.arrayBuffer()),
        file.name,
        file.type,
      );
    }
    const raw = await request.text();
    if (raw.length > 100000) throw new AppError("Request is too large.", 413);
    const body = raw ? JSON.parse(raw) : {};
    if (resource === "applications") {
      if (!id) return createApplication(actor, z.string().parse(body.schemeId));
      if (action === "save") {
        const data = z
          .object({ data: formSchema, version: z.number().int().positive() })
          .parse(body);
        return saveApplication(actor, id, data.data, data.version);
      }
      if (action === "submit") return submitApplication(actor, id);
      if (action === "decision") {
        const data = z
          .object({
            action: z.enum([
              "approve",
              "reject",
              "clarify",
              "deficiency",
              "send_back",
              "escalate",
              "note",
            ]),
            reason: comment,
            override: z.boolean().default(false),
          })
          .parse(body);
        return decideApplication(
          actor,
          id,
          data.action,
          data.reason,
          data.override,
        );
      }
      if (action === "fixtures") {
        if (!demoEnabled())
          throw new AppError("Fixtures are available only in demo mode.", 403);
        const app = await ownedApplication(db, actor, id);
        const variant = z
          .enum(["clean", "mismatch", "low-confidence"])
          .parse(body.variant || "clean");
        for (const requirement of app.schemeSnapshot.documents.filter(
          (d) => d.required,
        )) {
          const bytes = await makeFixture(requirement, app.data, variant);
          await uploadDocument(
            actor,
            id,
            requirement.key,
            bytes,
            `demo-${requirement.key}.pdf`,
            "application/pdf",
          );
        }
        return { loaded: true };
      }
      if (action === "correction") {
        const data = z
          .object({
            documentId: z.string(),
            field: z.string().max(80),
            value: z.string().min(1).max(300),
            reason: comment,
          })
          .parse(body);
        return correctEvidence(
          actor,
          id,
          data.documentId,
          data.field,
          data.value,
          data.reason,
        );
      }
      if (action === "message") {
        const { message } = z
          .object({ message: z.string().trim().min(1).max(2000) })
          .parse(body);
        const app = await ownedApplication(db, actor, id);
        await db.transaction(async (tx) => {
          await tx.insert(t.messages).values({
            id: randomUUID(),
            applicationId: id,
            senderId: actor.id,
            body: message,
          });
          await audit(
            tx,
            actor,
            "Message sent",
            id,
            "Application clarification message",
          );
          const recipient =
            actor.role === "student" ? app.officerId : app.userId;
          if (recipient)
            await notify(
              tx,
              recipient,
              "New application message",
              message,
              `/applications/${id}`,
            );
        });
        return { sent: true };
      }
      if (action === "view") {
        await ownedApplication(db, actor, id);
        if (actor.role === "officer" || actor.role === "ministry_admin")
          await db.transaction((tx) =>
            audit(
              tx,
              actor,
              "Officer viewed application",
              id,
              "Review workspace opened.",
            ),
          );
        return { viewed: true };
      }
      if (action === "progress") {
        const data = z
          .object({ score: z.number().min(0).max(100), report: comment })
          .parse(body);
        return progressReport(actor, id, data.score, data.report);
      }
      if (action === "renew") return requestRenewal(actor, id);
      if (action === "renewal-decision") {
        const data = z
          .object({
            approved: z.boolean(),
            reason: comment,
            override: z.boolean().default(false),
          })
          .parse(body);
        return reviewRenewal(
          actor,
          id,
          data.approved,
          data.reason,
          data.override,
        );
      }
    }
    if (resource === "schemes") return saveScheme(actor, id || "new", body);
    if (resource === "merit") {
      if (action === "publish") return publishMerit(actor, id);
      return generateMerit(actor, z.string().parse(body.schemeId));
    }
    if (resource === "payments") {
      const data = z
        .object({
          status: z.enum(["processing", "disbursed"]),
          reference: z.string().max(100).default(""),
        })
        .parse(body);
      return recordPayment(actor, id, data.status, data.reference);
    }
    if (resource === "notifications") {
      await db
        .update(t.notifications)
        .set({ read: true })
        .where(
          and(
            eq(t.notifications.userId, actor.id),
            id ? eq(t.notifications.id, id) : undefined,
          ),
        );
      return { read: true };
    }
    if (resource === "profile") {
      if (actor.role !== "student")
        throw new AppError("Only student profiles can be edited here.", 403);
      const data = validateApplication(formSchema.parse(body.data), {
        ...baseConfig,
        fields: commonFields,
      });
      await db.transaction(async (tx) => {
        await tx
          .insert(t.profiles)
          .values({ userId: actor.id, data })
          .onConflictDoUpdate({
            target: t.profiles.userId,
            set: { data, updatedAt: new Date() },
          });
        if (data.fullName)
          await tx
            .update(t.users)
            .set({ name: String(data.fullName) })
            .where(eq(t.users.id, actor.id));
        await audit(
          tx,
          actor,
          "Profile updated",
          actor.id,
          "Student profile details updated.",
        );
      });
      return { saved: true };
    }
    if (resource === "chat") {
      const data = z
        .object({
          question: z.string().min(1).max(500),
          language: z.enum(["en", "hi"]).default("en"),
        })
        .parse(body);
      return answerQuestion(actor, data.question, data.language);
    }
  }
  if (request.method === "GET") {
    const actor = await requireActor();
    if (resource === "documents") {
      const [doc] = await db
        .select()
        .from(t.documents)
        .where(eq(t.documents.id, id));
      if (!doc) throw new AppError("Document not found.", 404);
      await ownedApplication(db, actor, doc.applicationId);
      return new Response(
        new Uint8Array(await readDocument(db, doc.storageKey)),
        {
          headers: {
            "Content-Type": doc.mime,
            "Content-Disposition": `inline; filename="${doc.filename}"`,
            "Cache-Control": "private, no-store",
            "Content-Security-Policy": "sandbox",
          },
        },
      );
    }
    if (resource === "applications" && action === "acknowledgement") {
      const app = await ownedApplication(db, actor, id);
      if (app.status === "draft")
        throw new AppError(
          "Submit your application before downloading an acknowledgement.",
        );
      const pdf = await PDFDocument.create();
      const page = pdf.addPage();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const lines = [
        "JanVidya - application acknowledgement",
        "SIH 26239 | Fictional demonstration",
        `Application: ${app.id}`,
        `Applicant: ${app.data.fullName}`,
        `Status: ${statusLabels[app.status]}`,
        `Scheme: ${app.schemeId.toUpperCase()} / rule version ${app.schemeVersion}`,
        `Submitted: ${app.submittedAt?.toISOString() || "Demo fixture"}`,
        "This receipt confirms submission. It does not confirm an award.",
        "AI suggests. Rules validate. Humans decide.",
      ];
      lines.forEach((line, i) =>
        page.drawText(line.replace(/[^\x20-\x7E]/g, ""), {
          x: 50,
          y: 780 - i * 36,
          size: i === 0 ? 20 : 12,
          font,
        }),
      );
      return new Response(new Uint8Array(await pdf.save()), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${id}-acknowledgement.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (resource === "merit" && action === "export") {
      if (!["scheme_admin", "ministry_admin"].includes(actor.role))
        throw new AppError("Not authorized.", 403);
      const { entries } = await getMeritLists();
      const csv = [
        [
          "Rank",
          "Applicant",
          "Application",
          "Score",
          "Proposed selection",
          "Reasoning",
        ],
        ...entries
          .filter((e) => e.entry.listId === id)
          .map((e) => [
            e.entry.rank,
            e.name,
            e.entry.applicationId,
            e.entry.score,
            e.entry.selected ? "Selected" : "Waitlisted",
            e.entry.reasoning,
          ]),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
      return new Response("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="janvidya-merit.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (resource === "audit" && id === "export") {
      await requireActor(["ministry_admin", "scheme_admin"]);
      const rows = await db
        .select()
        .from(t.auditLogs)
        .orderBy(desc(t.auditLogs.seq))
        .limit(5000);
      const csv = [
        ["Timestamp", "Actor", "Role", "Action", "Entity", "Reason", "Hash"],
        ...rows.map((r) => [
          r.timestamp,
          r.actorName,
          r.role,
          r.action,
          r.entityId,
          r.reason,
          r.hash,
        ]),
      ]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
      return new Response("\uFEFF" + csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="janvidya-audit.csv"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (resource === "session")
      return { actor: { ...actor, roleLabel: roleLabels[actor.role] } };
  }
  throw new AppError("Endpoint not found.", 404);
}
async function handler(request: Request, context: Context) {
  try {
    const result = await handle(request, context);
    return result instanceof Response
      ? result
      : NextResponse.json(result, {
          headers: { "Cache-Control": "private, no-store" },
        });
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(" ") },
        { status: 400 },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json(
        { error: "Invalid request data." },
        { status: 400 },
      );
    console.error(
      "JanVidya request failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "The request could not be completed. Please try again." },
      { status: 500 },
    );
  }
}
export { handler as GET, handler as POST };
