import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import * as t from "@/db/schema";
import { getDb } from "./db";
import type { Actor, Status } from "@/lib/domain";
import { ownedApplication } from "./applications";
export function accessFilter(actor: Actor) {
  return actor.role === "student"
    ? eq(t.applications.userId, actor.id)
    : actor.role === "officer"
      ? eq(t.applications.officerId, actor.id)
      : undefined;
}
export async function listSchemes() {
  return (await getDb()).select().from(t.schemes).orderBy(t.schemes.code);
}
export async function listApplications(
  actor: Actor,
  options: Record<string, string> = {},
) {
  const db = await getDb();
  const conditions: (SQL | undefined)[] = [accessFilter(actor)];
  if (options.status)
    conditions.push(eq(t.applications.status, options.status as Status));
  if (options.scheme)
    conditions.push(eq(t.applications.schemeId, options.scheme));
  if (options.q)
    conditions.push(
      or(
        ilike(t.applications.id, `%${options.q}%`),
        sql`${t.applications.data}->>'fullName' ILIKE ${`%${options.q}%`}`,
      ),
    );
  if (options.flag === "low")
    conditions.push(sql`${t.applications.confidence} < 80`);
  if (options.flag === "duplicate")
    conditions.push(sql`jsonb_array_length(${t.applications.duplicates}) > 0`);
  if (options.flag === "flagged")
    conditions.push(
      sql`(${t.applications.eligible} = false OR ${t.applications.confidence} < 80 OR jsonb_array_length(${t.applications.duplicates}) > 0 OR ${t.applications.status} IN ('deficiency_raised','clarification_required'))`,
    );
  if (options.flag === "clear")
    conditions.push(
      and(
        eq(t.applications.eligible, true),
        sql`${t.applications.confidence} >= 80`,
        eq(t.applications.status, "ready_for_review"),
      ),
    );
  const where = and(...conditions);
  const page = Math.max(1, Math.min(10000, Number(options.page) || 1));
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: t.applications.id,
        userId: t.applications.userId,
        schemeId: t.applications.schemeId,
        status: t.applications.status,
        data: t.applications.data,
        confidence: t.applications.confidence,
        eligible: t.applications.eligible,
        duplicates: t.applications.duplicates,
        createdAt: t.applications.createdAt,
        updatedAt: t.applications.updatedAt,
        code: t.schemes.code,
        schemeName: t.schemes.name,
      })
      .from(t.applications)
      .innerJoin(t.schemes, eq(t.applications.schemeId, t.schemes.id))
      .where(where)
      .orderBy(desc(t.applications.updatedAt))
      .limit(12)
      .offset((page - 1) * 12),
    db.select({ total: count() }).from(t.applications).where(where),
  ]);
  return { rows, total: totals[0].total, page };
}
export async function applicationDetail(actor: Actor, id: string) {
  const db = await getDb();
  const app = await ownedApplication(db, actor, id);
  const [scheme] = await db
    .select()
    .from(t.schemes)
    .where(eq(t.schemes.id, app.schemeId));
  const [check] = await db
    .select()
    .from(t.eligibilityChecks)
    .where(eq(t.eligibilityChecks.applicationId, id))
    .orderBy(desc(t.eligibilityChecks.createdAt))
    .limit(1);
  const [
    documents,
    deficiencies,
    events,
    messages,
    reviews,
    results,
    decisions,
    payments,
    renewals,
    reports,
  ] = await Promise.all([
    db
      .select({
        id: t.documents.id,
        category: t.documents.category,
        filename: t.documents.filename,
        mime: t.documents.mime,
        size: t.documents.size,
        analysis: t.documents.analysis,
        createdAt: t.documents.createdAt,
      })
      .from(t.documents)
      .where(
        and(eq(t.documents.applicationId, id), eq(t.documents.active, true)),
      ),
    db
      .select()
      .from(t.deficiencies)
      .where(
        and(
          eq(t.deficiencies.applicationId, id),
          eq(t.deficiencies.resolved, false),
        ),
      ),
    db
      .select()
      .from(t.auditLogs)
      .where(
        and(
          eq(t.auditLogs.entityId, id),
          actor.role === "student"
            ? sql`${t.auditLogs.action} <> 'Internal note added'`
            : undefined,
        ),
      )
      .orderBy(desc(t.auditLogs.seq))
      .limit(60),
    db
      .select({
        id: t.messages.id,
        body: t.messages.body,
        createdAt: t.messages.createdAt,
        sender: t.users.name,
        role: t.users.role,
      })
      .from(t.messages)
      .innerJoin(t.users, eq(t.messages.senderId, t.users.id))
      .where(eq(t.messages.applicationId, id))
      .orderBy(t.messages.createdAt),
    actor.role === "student"
      ? Promise.resolve([])
      : db.select().from(t.reviews).where(eq(t.reviews.applicationId, id)),
    check
      ? db
          .select()
          .from(t.eligibilityResults)
          .where(eq(t.eligibilityResults.checkId, check.id))
      : Promise.resolve([]),
    db.select().from(t.decisions).where(eq(t.decisions.applicationId, id)),
    db.select().from(t.payments).where(eq(t.payments.applicationId, id)),
    db.select().from(t.renewals).where(eq(t.renewals.applicationId, id)),
    db
      .select()
      .from(t.progressReports)
      .where(eq(t.progressReports.applicationId, id)),
  ]);
  return {
    app: {
      ...app,
      duplicates:
        actor.role === "student"
          ? app.duplicates.map((d) => ({
              ...d,
              applicationId: "Restricted to authorized reviewers",
            }))
          : app.duplicates,
    },
    scheme,
    documents,
    deficiencies,
    events,
    messages,
    reviews,
    results,
    decisions,
    payments,
    renewals,
    reports,
  };
}
export async function dashboardData(actor: Actor) {
  const db = await getDb();
  const where = accessFilter(actor);
  const [byStatus, recent, notifications, schemeList, paymentRows] =
    await Promise.all([
      db
        .select({ status: t.applications.status, count: count() })
        .from(t.applications)
        .where(where)
        .groupBy(t.applications.status),
      listApplications(actor),
      db
        .select()
        .from(t.notifications)
        .where(eq(t.notifications.userId, actor.id))
        .orderBy(desc(t.notifications.createdAt))
        .limit(4),
      listSchemes(),
      db
        .select({ amount: t.payments.amount, status: t.payments.status })
        .from(t.payments)
        .innerJoin(
          t.applications,
          eq(t.payments.applicationId, t.applications.id),
        )
        .where(where),
    ]);
  return {
    byStatus,
    recent,
    notifications,
    schemes: schemeList,
    payments: paymentRows,
  };
}
export async function analyticsData(filters: Record<string, string>) {
  const db = await getDb();
  const conditions: (SQL | undefined)[] = [];
  for (const field of ["state", "district", "gender", "institution"])
    if (filters[field])
      conditions.push(
        sql`${t.applications.data}->>${field} = ${filters[field]}`,
      );
  if (filters.scheme)
    conditions.push(eq(t.applications.schemeId, filters.scheme));
  if (filters.status)
    conditions.push(eq(t.applications.status, filters.status as Status));
  if (filters.year)
    conditions.push(
      sql`${t.applications.data}->>'applicationYear' = ${filters.year}`,
    );
  if (filters.from)
    conditions.push(sql`${t.applications.createdAt} >= ${filters.from}::date`);
  if (filters.to)
    conditions.push(
      sql`${t.applications.createdAt} < (${filters.to}::date + interval '1 day')`,
    );
  const where = and(...conditions);
  const group = async (field: string) =>
    db
      .select({
        name: sql<string>`${t.applications.data}->>${field}`,
        value: count(),
      })
      .from(t.applications)
      .where(where)
      .groupBy(sql`1`)
      .orderBy(desc(count()));
  const [
    summary,
    byState,
    byDistrict,
    byGender,
    byStatus,
    byMonth,
    byScheme,
    deficiencies,
    rejections,
    payments,
    officers,
    renewals,
    options,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        approved: sql<number>`count(*) filter (where ${t.applications.status} in ('approved','selected','payment_processing','disbursed','renewal_due'))::int`,
        rejected: sql<number>`count(*) filter (where ${t.applications.status}='rejected')::int`,
        deficient: sql<number>`count(*) filter (where ${t.applications.status} in ('deficiency_raised','student_response_pending','clarification_required'))::int`,
        pending: sql<number>`count(*) filter (where ${t.applications.decidedAt} is null and ${t.applications.submittedAt} < now() - interval '14 days')::int`,
        avgDays: sql<number>`coalesce(avg(extract(epoch from (${t.applications.decidedAt}-${t.applications.submittedAt}))/86400),0)::float`,
      })
      .from(t.applications)
      .where(where),
    group("state"),
    group("district"),
    group("gender"),
    db
      .select({ name: t.applications.status, value: count() })
      .from(t.applications)
      .where(where)
      .groupBy(t.applications.status),
    db
      .select({
        name: sql<string>`to_char(${t.applications.createdAt}, 'YYYY-MM')`,
        value: count(),
        days: sql<number>`coalesce(avg(extract(epoch from (${t.applications.decidedAt}-${t.applications.submittedAt}))/86400),0)::float`,
      })
      .from(t.applications)
      .where(where)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ name: t.schemes.code, value: count() })
      .from(t.applications)
      .innerJoin(t.schemes, eq(t.applications.schemeId, t.schemes.id))
      .where(where)
      .groupBy(t.schemes.code),
    db
      .select({ name: t.deficiencies.kind, value: count() })
      .from(t.deficiencies)
      .innerJoin(
        t.applications,
        eq(t.deficiencies.applicationId, t.applications.id),
      )
      .where(and(where, eq(t.deficiencies.resolved, false)))
      .groupBy(t.deficiencies.kind)
      .orderBy(desc(count())),
    db
      .select({ name: t.decisions.reason, value: count() })
      .from(t.decisions)
      .innerJoin(
        t.applications,
        eq(t.decisions.applicationId, t.applications.id),
      )
      .where(and(where, eq(t.decisions.decision, "reject")))
      .groupBy(t.decisions.reason),
    db
      .select({
        name: t.payments.status,
        value: sql<number>`sum(${t.payments.amount})::int`,
        count: count(),
      })
      .from(t.payments)
      .innerJoin(
        t.applications,
        eq(t.payments.applicationId, t.applications.id),
      )
      .where(where)
      .groupBy(t.payments.status),
    db
      .select({
        name: sql<string>`coalesce(${t.users.name},'Escalated / unassigned')`,
        value: count(),
      })
      .from(t.applications)
      .leftJoin(t.users, eq(t.applications.officerId, t.users.id))
      .where(
        and(
          where,
          sql`${t.applications.decidedAt} is null`,
          sql`${t.applications.status} <> 'draft'`,
        ),
      )
      .groupBy(t.users.name),
    db
      .select({ name: t.renewals.status, value: count() })
      .from(t.renewals)
      .innerJoin(
        t.applications,
        eq(t.renewals.applicationId, t.applications.id),
      )
      .where(where)
      .groupBy(t.renewals.status),
    db
      .select({
        state: sql<string>`${t.applications.data}->>'state'`,
        district: sql<string>`${t.applications.data}->>'district'`,
        institution: sql<string>`${t.applications.data}->>'institution'`,
      })
      .from(t.applications)
      .groupBy(sql`1, 2, 3`),
  ]);
  return {
    summary: summary[0],
    byState,
    byDistrict,
    byGender,
    byStatus,
    byMonth,
    byScheme,
    deficiencies,
    rejections,
    payments,
    officers,
    renewals,
    options,
  };
}
export type ApplicationDetail = Awaited<ReturnType<typeof applicationDetail>>;
export type ApplicationList = Awaited<ReturnType<typeof listApplications>>;
export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
export type AnalyticsData = Awaited<ReturnType<typeof analyticsData>>;
