import { desc, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { Download, ShieldCheck, Search } from "lucide-react";
import { pageActor } from "@/server/auth";
import { getDb } from "@/server/db";
import { auditLogs } from "@/db/schema";
import { verifyAuditChain } from "@/server/audit";
import { PageTitle, Panel, Notice } from "@/components/ui";
import { dateLabel } from "@/lib/domain";
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await pageActor(["scheme_admin", "ministry_admin"]);
  const db = await getDb();
  const { q = "" } = await searchParams;
  const [rows, all] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(
        q
          ? or(
              ilike(auditLogs.entityId, `%${q}%`),
              ilike(auditLogs.action, `%${q}%`),
              ilike(auditLogs.actorName, `%${q}%`),
            )
          : undefined,
      )
      .orderBy(desc(auditLogs.seq))
      .limit(100),
    db.select().from(auditLogs).orderBy(auditLogs.seq),
  ]);
  const valid = verifyAuditChain(all);
  return (
    <>
      <PageTitle
        eyebrow="Transparency & accountability"
        title="Every action. A visible record."
        description="Timestamped, hash-linked events preserve the reasoning behind every important step."
        actions={
          <a download className="button secondary" href="/api/audit/export">
            <Download size={14} />
            Export audit log
          </a>
        }
      />
      <Notice tone={valid ? "success" : "warning"}>
        <ShieldCheck size={16} style={{ display: "inline", marginRight: 7 }} />
        <strong>
          {valid
            ? "Audit chain verified"
            : "Audit chain requires investigation"}
        </strong>{" "}
        · {all.length} events checked. Database triggers prevent updates and
        deletions. A database owner can still alter infrastructure; this is not
        an independently anchored immutable ledger.
      </Notice>
      <form className="filter-bar" style={{ marginTop: 24 }}>
        <input
          type="search"
          name="q"
          placeholder="Search action, application or actor"
          aria-label="Search audit trail"
          defaultValue={q}
        />
        <button className="button secondary">
          <Search size={14} />
          Search
        </button>
      </form>
      <Panel>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Reason & changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 10 }}>
                    {dateLabel(r.timestamp)}
                    <small>
                      {new Date(r.timestamp).toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </small>
                  </td>
                  <td>
                    <strong>{r.actorName}</strong>
                    <small>{r.role.replaceAll("_", " ")}</small>
                  </td>
                  <td>
                    <strong>{r.action}</strong>
                    <small className="audit-hash" title={r.hash}>
                      {r.hash.slice(0, 16)}…
                    </small>
                  </td>
                  <td>
                    {r.entityId.startsWith("JV-") ? (
                      <Link
                        className="text-button"
                        style={{ fontSize: 10 }}
                        href={`/applications/${r.entityId}`}
                      >
                        {r.entityId}
                      </Link>
                    ) : (
                      <small>{r.entityId.slice(0, 24)}</small>
                    )}
                  </td>
                  <td style={{ maxWidth: 360 }}>
                    <span style={{ fontSize: 10 }}>{r.reason}</span>
                    {(r.previous !== null || r.next !== null) && (
                      <details style={{ fontSize: 9, marginTop: 7 }}>
                        <summary>Previous / new values</summary>
                        <pre className="code-block">
                          {JSON.stringify(
                            { previous: r.previous, next: r.next },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          Showing the latest {rows.length} matching events. Export includes the
          latest 5,000 events.
        </div>
      </Panel>
    </>
  );
}
