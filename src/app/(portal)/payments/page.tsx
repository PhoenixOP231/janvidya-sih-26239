import { eq, desc, inArray } from "drizzle-orm";
import * as t from "@/db/schema";
import { pageActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { accessFilter } from "@/server/queries";
import { Payments } from "@/components/payments";
export default async function PaymentsPage() {
  const actor = await pageActor(["student", "officer", "ministry_admin"]);
  const db = await getDb();
  const [rows, renewalRows] = await Promise.all([
    db
      .select({
        payment: t.payments,
        application: t.applications,
        name: t.users.name,
      })
      .from(t.payments)
      .innerJoin(
        t.applications,
        eq(t.payments.applicationId, t.applications.id),
      )
      .innerJoin(t.users, eq(t.applications.userId, t.users.id))
      .where(accessFilter(actor))
      .orderBy(desc(t.payments.createdAt))
      .limit(150),
    db
      .select({ renewal: t.renewals, application: t.applications })
      .from(t.renewals)
      .innerJoin(
        t.applications,
        eq(t.renewals.applicationId, t.applications.id),
      )
      .where(accessFilter(actor))
      .orderBy(desc(t.renewals.createdAt))
      .limit(50),
  ]);
  const reports = renewalRows.length
    ? await db
        .select()
        .from(t.progressReports)
        .where(
          inArray(
            t.progressReports.applicationId,
            renewalRows.map((r) => r.application.id),
          ),
        )
    : [];
  return (
    <Payments
      rows={rows}
      actor={actor}
      renewals={renewalRows.map((r) => ({
        ...r,
        reports: reports.filter((p) => p.applicationId === r.application.id),
      }))}
    />
  );
}
