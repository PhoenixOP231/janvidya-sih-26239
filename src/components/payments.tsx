"use client";
import { Localize } from "@/components/localize";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, Clock3, CheckCheck, Send } from "lucide-react";
import type * as schema from "@/db/schema";
import type { Actor } from "@/lib/domain";
import { money, dateLabel } from "@/lib/domain";
import { api, useApp } from "./providers";
import {
  PageTitle,
  Panel,
  Metric,
  Button,
  Notice,
  Empty,
  StatusBadge,
} from "./ui";
type PaymentRow = {
  payment: typeof schema.payments.$inferSelect;
  application: typeof schema.applications.$inferSelect;
  name: string;
};
type RenewalRow = {
  renewal: typeof schema.renewals.$inferSelect;
  application: typeof schema.applications.$inferSelect;
  reports: (typeof schema.progressReports.$inferSelect)[];
};
export function Payments({
  rows,
  renewals,
  actor,
}: {
  rows: PaymentRow[];
  renewals: RenewalRow[];
  actor: Actor;
}) {
  const { t } = useApp();
  const total = (status: string) =>
    rows
      .filter((r) => r.payment.status === status)
      .reduce((n, r) => n + r.payment.amount, 0);
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow="Scholarship support"
          title="Track every milestone."
          description="View scholarship installments, submit progress, and request renewal."
        />
        <Notice>
          {t("Demo ledger only. No actual funds are transferred.")}
        </Notice>
        <div className="metric-grid" style={{ marginTop: 23 }}>
          <Metric
            label="Disbursed"
            value={money(total("disbursed"))}
            detail="Recorded payments"
            icon={<CheckCheck />}
          />
          <Metric
            label="Processing"
            value={money(total("processing"))}
            detail="Awaiting confirmation"
            icon={<Clock3 />}
          />
          <Metric
            label="Scheduled"
            value={money(total("scheduled"))}
            detail="Upcoming installments"
            icon={<Wallet />}
          />
          <Metric
            label="Renewal requests"
            value={
              renewals.filter((r) => r.renewal.status === "requested").length
            }
            detail="Awaiting an officer decision"
            icon={<Send />}
          />
        </div>
        <Panel
          title="Payment history"
          subtitle="A transparent record of every scholarship installment."
        >
          {rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Installment</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reference</th>
                    {actor.role === "ministry_admin" && <th>Update</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ payment: p, application: a, name }) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/applications/${a.id}`}>
                          <strong>{name}</strong>
                          <small>{a.id}</small>
                        </Link>
                      </td>
                      <td>{p.installment}</td>
                      <td>
                        <strong>{money(p.amount)}</strong>
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td>
                        <small>{p.reference || "Awaiting reference"}</small>
                      </td>
                      {actor.role === "ministry_admin" && (
                        <td>
                          {p.status !== "disbursed" && (
                            <PaymentAction payment={p} />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No payment records yet"
              description="An installment is scheduled after your selection is published."
            />
          )}
        </Panel>
        <div className="stack" style={{ marginTop: 25 }}>
          {renewals.map(({ renewal, application, reports }) => (
            <Panel
              key={renewal.id}
              title={`Renewal · ${renewal.year}`}
              subtitle={`${application.id} · Due ${dateLabel(renewal.dueDate)} · ${renewal.status}`}
            >
              <div className="panel-body" style={{ paddingTop: 0 }}>
                <p className="small-text muted" style={{ marginBottom: 15 }}>
                  Configured renewal threshold:{" "}
                  {application.schemeSnapshot.renewalMinScore}%. An officer
                  reviews your progress before deciding.
                </p>
                {actor.role === "student" ? (
                  <ProgressForm
                    applicationId={application.id}
                    status={renewal.status}
                    reports={reports}
                  />
                ) : (
                  <>
                    <div className="stack">
                      {reports.map((r) => (
                        <div className="progress-report-card" key={r.id}>
                          <strong style={{ fontSize: 12 }}>
                            Academic score: {r.score}%
                          </strong>
                          <p>{r.report}</p>
                          <small className="muted">
                            {dateLabel(r.createdAt)}
                          </small>
                        </div>
                      ))}
                      {!reports.length && (
                        <p className="small-text">
                          No progress report submitted yet.
                        </p>
                      )}
                    </div>
                    {["officer", "ministry_admin"].includes(actor.role) &&
                      renewal.status === "requested" && (
                        <RenewalDecision applicationId={application.id} />
                      )}
                  </>
                )}
                {renewal.reason && (
                  <p className="small-text muted" style={{ marginTop: 12 }}>
                    {renewal.reason}
                  </p>
                )}
              </div>
            </Panel>
          ))}
        </div>
      </>
    </Localize>
  );
}
function PaymentAction({
  payment,
}: {
  payment: typeof schema.payments.$inferSelect;
}) {
  const { notice } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  return (
    <Localize>
      <form
        className="row wrap"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`payments/${payment.id}`, {
              status:
                payment.status === "scheduled" ? "processing" : "disbursed",
              reference,
            });
            notice("Demo payment record updated");
            router.refresh();
          } catch (err) {
            notice((err as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {payment.status === "processing" && (
          <input
            aria-label="Demo payment reference"
            placeholder="DEMO-UTR-…"
            value={reference}
            minLength={5}
            required
            onChange={(e) => setReference(e.target.value)}
            style={{ fontSize: 10, width: 130 }}
          />
        )}
        <Button busy={busy} className="small">
          {payment.status === "scheduled"
            ? "Start processing"
            : "Record disbursed"}
        </Button>
      </form>
    </Localize>
  );
}
function ProgressForm({
  applicationId,
  status,
  reports,
}: {
  applicationId: string;
  status: string;
  reports: (typeof schema.progressReports.$inferSelect)[];
}) {
  const { t, notice } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Localize>
      <div className="stack">
        {reports.map((r) => (
          <div className="progress-report-card" key={r.id}>
            <strong style={{ fontSize: 12 }}>Academic score: {r.score}%</strong>
            <p>{r.report}</p>
            <small className="muted">{dateLabel(r.createdAt)}</small>
          </div>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api(`applications/${applicationId}/progress`, {
                score: Number(form.get("score")),
                report: form.get("report"),
              });
              notice("Progress report submitted");
              router.refresh();
            } catch (err) {
              notice((err as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              {t("Academic score")}
              <input
                name="score"
                type="number"
                min={0}
                max={100}
                step="any"
                required
              />
            </label>
            <label>
              {t("Progress summary")}
              <textarea
                name="report"
                required
                minLength={10}
                maxLength={2000}
                placeholder="Describe academic progress and milestones…"
              />
            </label>
          </div>
          <div className="row wrap" style={{ marginTop: 18 }}>
            <Button busy={busy} variant="secondary">
              {t("Submit progress report")}
            </Button>
            {status === "due" && (
              <Button
                type="button"
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`applications/${applicationId}/renew`);
                    notice("Renewal requested");
                    router.refresh();
                  } catch (err) {
                    notice((err as Error).message, true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("Request renewal")}
              </Button>
            )}
          </div>
        </form>
      </div>
    </Localize>
  );
}
function RenewalDecision({ applicationId }: { applicationId: string }) {
  const { notice } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Localize>
      <form
        style={{ marginTop: 20 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await api(`applications/${applicationId}/renewal-decision`, {
              approved: form.get("decision") === "approve",
              reason: form.get("reason"),
              override: form.get("override") === "on",
            });
            notice("Renewal decision recorded");
            router.refresh();
          } catch (err) {
            notice((err as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Decision
            <select name="decision">
              <option value="approve">Approve renewal</option>
              <option value="reject">Decline renewal</option>
            </select>
          </label>
          <label>
            Reason
            <textarea name="reason" minLength={10} required />
          </label>
        </div>
        <label className="checkbox-label" style={{ marginTop: 15 }}>
          <input type="checkbox" name="override" />
          <span>
            Override a below-threshold renewal score. My reason will be
            recorded.
          </span>
        </label>
        <Button busy={busy} style={{ marginTop: 15 }}>
          Record renewal decision
        </Button>
      </form>
    </Localize>
  );
}
