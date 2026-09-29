"use client";
import { Localize } from "@/components/localize";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileSearch,
  Send,
  Pencil,
  Clock3,
} from "lucide-react";
import type { ApplicationDetail } from "@/server/queries";
import {
  type Actor,
  type RuleResult,
  editableStatuses,
  reviewStatuses,
  dateLabel,
} from "@/lib/domain";
import { canDecide } from "@/lib/workflow";
import { evaluateEligibility } from "@/lib/rules";
import { fieldLabels } from "@/lib/document-analysis";
import {
  PageTitle,
  Panel,
  StatusBadge,
  Confidence,
  Button,
  Notice,
  Empty,
} from "./ui";
import { useApp, api } from "./providers";
import { ApplicationEditor } from "./application-editor";
import { DocumentPanel } from "./documents-panel";
export function Detail({
  detail,
  actor,
  demo,
}: {
  detail: ApplicationDetail;
  actor: Actor;
  demo: boolean;
}) {
  const { app, scheme } = detail;
  const { t } = useApp();
  const [tab, setTab] = useState("Overview & evidence");
  const tabKey = `janvidya-tab:${app.id}`;
  useEffect(() => {
    const saved = sessionStorage.getItem(tabKey);
    if (
      saved &&
      [
        "Application details",
        "Overview & evidence",
        "Documents",
        "Eligibility",
        "Timeline",
        "Messages",
      ].includes(saved)
    )
      setTab(saved);
  }, [tabKey]);
  const selectTab = (value: string) => {
    sessionStorage.setItem(tabKey, value);
    setTab(value);
  };
  const saveEditor = useRef<() => Promise<void>>(null);
  const editable =
    actor.role === "student" && editableStatuses.includes(app.status);
  const seen = useRef(false);
  useEffect(() => {
    if (!seen.current && canDecide(actor.role)) {
      seen.current = true;
      api(`applications/${app.id}/view`).catch(() => {});
    }
  }, [app.id, actor.role]);
  const rules = detail.results.length
    ? detail.results.map((r) => r.result)
    : evaluateEligibility(app.schemeSnapshot.rules, app.data).results;
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow="Applications"
          title={
            actor.role === "student"
              ? "Your application"
              : String(app.data.fullName)
          }
          description={`${app.id} · ${scheme.name}`}
          actions={
            <>
              <StatusBadge status={app.status} />
              {app.status !== "draft" && (
                <a
                  href={`/api/applications/${app.id}/acknowledgement`}
                  className="button secondary"
                >
                  <Download size={14} />
                  {t("Download acknowledgement")}
                </a>
              )}
            </>
          }
        />
        <div className="application-layout">
          <div className="stack">
            {detail.deficiencies.length > 0 && (
              <Panel
                title="Needs attention"
                subtitle={`${detail.deficiencies.length} issues to review`}
              >
                <div
                  className="panel-body stack"
                  style={{ paddingTop: 0, gap: 12 }}
                >
                  {detail.deficiencies.map((d) => (
                    <div className="issue-card" key={d.id}>
                      <div className="issue-header">
                        <AlertCircle size={16} />
                        <h3>{d.issue}</h3>
                      </div>
                      <p>{d.action}</p>
                      <small>
                        {t("Deadline")}: {dateLabel(d.deadline)}
                      </small>
                      {editable && d.documentCategory && (
                        <button
                          className="text-button"
                          style={{ display: "block", marginTop: 8 }}
                          onClick={() => {
                            selectTab("Documents");
                            document
                              .getElementById("application-tabs")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          {t("Replace document")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            <div>
              <div
                className="tabs"
                id="application-tabs"
                role="tablist"
                aria-label="Application sections"
              >
                {[
                  editable ? "Application details" : "Overview & evidence",
                  "Documents",
                  "Eligibility",
                  "Timeline",
                  "Messages",
                ].map((s) => (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={
                      tab === s ||
                      (s === "Application details" &&
                        tab === "Overview & evidence")
                    }
                    onClick={() => selectTab(s)}
                    className={
                      tab === s ||
                      (s === "Application details" &&
                        tab === "Overview & evidence")
                        ? "active"
                        : ""
                    }
                  >
                    {t(s)}
                    {s === "Messages" && detail.messages.length > 0
                      ? ` (${detail.messages.length})`
                      : ""}
                  </button>
                ))}
              </div>
              {editable && (
                <div
                  hidden={
                    tab !== "Overview & evidence" &&
                    tab !== "Application details"
                  }
                >
                  <ApplicationEditor
                    detail={detail}
                    demo={demo}
                    saveRef={saveEditor}
                  />
                </div>
              )}
              {(tab === "Overview & evidence" ||
                tab === "Application details") &&
                !editable && (
                  <div className="stack">
                    <Panel
                      title="AI verification"
                      subtitle="Evidence and recommendations support the officer’s judgment."
                    >
                      <div className="panel-body" style={{ paddingTop: 0 }}>
                        <Notice
                          tone={
                            app.eligible &&
                            app.confidence >= 80 &&
                            !detail.deficiencies.length &&
                            !app.duplicates.length
                              ? "success"
                              : "warning"
                          }
                        >
                          {app.recommendation}
                        </Notice>
                        <div
                          className="row"
                          style={{ marginTop: 17, fontSize: 11 }}
                        >
                          <span className="muted">Overall confidence</span>
                          <Confidence value={app.confidence} />
                          <span className="muted">
                            Scheme rule version {app.schemeVersion}
                          </span>
                        </div>
                      </div>
                    </Panel>
                    <Evidence detail={detail} actor={actor} />
                    <Panel title="Applicant information">
                      <dl className="data-list panel-body">
                        {app.schemeSnapshot.fields.map((f) => (
                          <div key={f.key}>
                            <dt>{t(f.label)}</dt>
                            <dd
                              translate={f.type === "select" ? undefined : "no"}
                            >
                              {String(app.data[f.key] ?? "—")}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </Panel>
                    {app.duplicates.length > 0 && (
                      <Panel title="Potential duplicate signals">
                        <div className="panel-body stack">
                          {app.duplicates.map((d, i) => (
                            <Notice tone="warning" key={i}>
                              <strong>Risk score: {d.score}/100</strong>
                              <p>{d.applicationId}</p>
                              <p>{d.reasons.join(". ")}</p>
                              <p>
                                This is a review signal, not a fraud finding.
                              </p>
                            </Notice>
                          ))}
                        </div>
                      </Panel>
                    )}
                    {detail.decisions.length > 0 && (
                      <Panel title="Officer decisions">
                        <div className="panel-body">
                          {detail.decisions.map((d) => (
                            <div className="decision-summary" key={d.id}>
                              <strong style={{ fontSize: 12 }}>
                                {d.decision}
                              </strong>
                              <p translate="no">{d.reason}</p>
                              <small className="muted">
                                {dateLabel(d.createdAt)}
                              </small>
                            </div>
                          ))}
                        </div>
                      </Panel>
                    )}
                  </div>
                )}
              {tab === "Documents" && (
                <Panel>
                  <div className="panel-body">
                    <DocumentPanel
                      detail={detail}
                      demo={demo}
                      editable={editable}
                      beforeUpload={() =>
                        saveEditor.current?.() ?? Promise.resolve()
                      }
                    />
                  </div>
                </Panel>
              )}
              {tab === "Eligibility" && (
                <Panel
                  title="Eligibility"
                  subtitle={`Configured demonstration criteria · scheme version ${app.schemeVersion}`}
                >
                  <div className="panel-body">
                    <Rules results={rules} />
                    <div style={{ marginTop: 25 }}>
                      <Notice>
                        These are demonstration criteria. Rule outcomes are
                        recommendations for an authorized officer, not official
                        policy or an automatic rejection.
                      </Notice>
                    </div>
                  </div>
                </Panel>
              )}
              {tab === "Timeline" && (
                <Panel title="Application timeline">
                  <div className="panel-body">
                    <ol className="timeline">
                      {detail.events.map((event) => (
                        <li key={event.id}>
                          <strong>{event.action}</strong>
                          <p>{event.reason}</p>
                          <small>
                            {dateLabel(event.timestamp)} · {event.actorName}
                          </small>
                          <div className="audit-hash" title={event.hash}>
                            {event.hash.slice(0, 22)}…
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </Panel>
              )}
              {tab === "Messages" && <Messages detail={detail} actor={actor} />}
            </div>
          </div>
          <aside className="application-sidebar">
            <Panel title="Application summary">
              <dl className="data-list panel-body" style={{ paddingTop: 2 }}>
                <div>
                  <dt>Scheme</dt>
                  <dd>{scheme.code}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{dateLabel(app.createdAt)}</dd>
                </div>
                <div>
                  <dt>Rule version</dt>
                  <dd>{app.schemeVersion}</dd>
                </div>
                <div>
                  <dt>Documents</dt>
                  <dd>
                    {detail.documents.length}/
                    {
                      app.schemeSnapshot.documents.filter((d) => d.required)
                        .length
                    }{" "}
                    required
                  </dd>
                </div>
                <div>
                  <dt>Verification</dt>
                  <dd>
                    <Confidence value={app.confidence} />
                  </dd>
                </div>
              </dl>
            </Panel>
            {canDecide(actor.role) && reviewStatuses.includes(app.status) && (
              <DecisionPanel detail={detail} />
            )}
            <div className="callout-card" style={{ padding: 21 }}>
              <ShieldCheck size={25} color="#a1d6c5" />
              <h2 style={{ fontSize: 17 }}>A person behind every decision.</h2>
              <p style={{ fontSize: 10 }}>
                Uncertain evidence needs review. Officers can correct extracted
                values and explain exceptions.
              </p>
              <Link
                className="text-button"
                href="/about/responsible-ai"
                style={{ color: "#b2e2d1", marginTop: 18, fontSize: 10 }}
              >
                Our responsible AI approach
              </Link>
            </div>
            {detail.reviews.length > 0 && (
              <Panel title="Internal notes">
                <div className="panel-body stack">
                  {detail.reviews.map((r) => (
                    <div key={r.id}>
                      <p translate="no" style={{ fontSize: 11 }}>
                        {r.note}
                      </p>
                      <small style={{ fontSize: 9 }}>
                        {dateLabel(r.createdAt)}
                      </small>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            {[
              "selected",
              "disbursed",
              "renewal_due",
              "payment_processing",
            ].includes(app.status) && (
              <Link className="button secondary" href="/payments">
                <Clock3 size={15} />
                {t("Payments & renewals")}
              </Link>
            )}
          </aside>
        </div>
      </>
    </Localize>
  );
}
function Rules({ results }: { results: RuleResult[] }) {
  return (
    <Localize>
      <div className="rule-list">
        {results.map((r) => (
          <div className={`rule-result ${r.passed ? "" : "failed"}`} key={r.id}>
            {r.passed ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
            <div>
              <strong>{r.label}</strong>
              <small>{r.explanation}</small>
            </div>
          </div>
        ))}
      </div>
    </Localize>
  );
}
function Evidence({
  detail,
  actor,
}: {
  detail: ApplicationDetail;
  actor: Actor;
}) {
  const [correction, setCorrection] = useState<{
    doc: string;
    field: string;
    value: string;
  } | null>(null);
  const { notice } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (correction) dialog.current?.showModal();
    else dialog.current?.close();
  }, [correction]);
  const values = detail.documents.flatMap((d) =>
    d.analysis.fields.map((f) => ({
      ...f,
      document: d,
      conflict: d.analysis.mismatches.find((m) => m.field === f.field),
    })),
  );
  return (
    <Localize>
      <Panel
        title="Entered details vs. document evidence"
        subtitle="Discrepancies are highlighted for human verification."
      >
        {!values.length ? (
          <Empty
            title="No extracted evidence yet"
            description="Upload documents to see field-level evidence and confidence."
          />
        ) : (
          <div className="table-scroll">
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Applicant entered</th>
                  <th>Document evidence</th>
                  <th>Confidence</th>
                  {canDecide(actor.role) && <th>Correct</th>}
                </tr>
              </thead>
              <tbody>
                {values.map((f, i) => (
                  <tr
                    key={`${f.document.id}-${i}`}
                    className={f.conflict ? "mismatch" : ""}
                  >
                    <td>
                      <strong>{fieldLabels[f.field] || f.field}</strong>
                      <small>{f.document.category}</small>
                    </td>
                    <td translate="no">
                      {String(detail.app.data[f.field] ?? "—")}
                    </td>
                    <td>
                      <strong translate="no">{String(f.value)}</strong>
                      <small translate="no">{f.evidence}</small>
                      {f.conflict && (
                        <p className="evidence-reason">{f.conflict.reason}</p>
                      )}
                    </td>
                    <td>
                      <Confidence value={f.confidence} />
                    </td>
                    {canDecide(actor.role) && (
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Correct ${f.field} from ${f.document.category}`}
                          onClick={() =>
                            setCorrection({
                              doc: f.document.id,
                              field: f.field,
                              value: String(f.value),
                            })
                          }
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <dialog
          ref={dialog}
          onCancel={() => setCorrection(null)}
          className="modal"
          style={{
            margin: "auto",
            border: "1px solid #d9e5e4",
            color: "var(--ink)",
          }}
        >
          <h2>Correct extracted evidence</h2>
          {correction && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await api(`applications/${detail.app.id}/correction`, {
                    documentId: correction.doc,
                    field: correction.field,
                    value: form.get("value"),
                    reason: form.get("reason"),
                  });
                  notice("Correction recorded in the audit trail");
                  setCorrection(null);
                  router.refresh();
                } catch (e) {
                  notice((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Verified value
                <input name="value" required defaultValue={correction.value} />
              </label>
              <label>
                Reason for correction
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={2000}
                />
              </label>
              <Notice>
                Original evidence is retained. Manual confidence denotes officer
                verification, not AI certainty.
              </Notice>
              <div className="row">
                <Button busy={busy}>Save correction</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCorrection(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </dialog>
      </Panel>
    </Localize>
  );
}
function DecisionPanel({ detail }: { detail: ApplicationDetail }) {
  const [action, setAction] = useState("approve");
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { notice } = useApp();
  const router = useRouter();
  const flagged =
    !detail.app.eligible ||
    detail.deficiencies.length > 0 ||
    detail.app.duplicates.length > 0 ||
    detail.app.confidence < detail.app.schemeSnapshot.confidenceThreshold;
  return (
    <Localize>
      <Panel>
        <form
          className="decision-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              await api(`applications/${detail.app.id}/decision`, {
                action,
                reason,
                override,
              });
              notice("Officer action recorded");
              setReason("");
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 style={{ fontSize: 16 }}>Your review</h2>
          <p style={{ fontSize: 10, marginTop: 8 }}>
            Make a decision with a clear reason.
          </p>
          <label>
            Action
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              {[
                ["approve", "Approve application"],
                ["reject", "Reject application"],
                ["clarify", "Request clarification"],
                ["deficiency", "Mark deficiency"],
                ["send_back", "Send back to student"],
                ["escalate", "Escalate to ministry"],
                ["note", "Add internal note"],
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {action === "approve" && flagged && (
            <label className="checkbox-label" style={{ fontSize: 10 }}>
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              <span>
                Override the flagged recommendation. My reason will be recorded.
              </span>
            </label>
          )}
          <label>
            Reason / comments
            <textarea
              value={reason}
              required
              minLength={10}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the evidence and your decision…"
            />
          </label>
          {error && (
            <div className="form-error" role="alert" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}
          <Button busy={busy} variant={action === "reject" ? "danger" : ""}>
            <FileSearch size={15} />
            {action === "note" ? "Save internal note" : "Record decision"}
          </Button>
        </form>
      </Panel>
    </Localize>
  );
}
function Messages({
  detail,
  actor,
}: {
  detail: ApplicationDetail;
  actor: Actor;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { t, notice } = useApp();
  const router = useRouter();
  return (
    <Localize>
      <Panel
        title="Messages"
        subtitle="Clarifications stay connected to your application."
      >
        <div className="panel-body">
          <div className="message-list">
            {detail.messages.map((m) => (
              <div
                key={m.id}
                className={`message ${m.role !== "student" ? "staff" : ""}`}
              >
                <div className="message-head">
                  <strong>
                    {m.sender} {m.role !== "student" ? "· Officer" : ""}
                  </strong>
                  <small>{dateLabel(m.createdAt)}</small>
                </div>
                <p translate="no">{m.body}</p>
              </div>
            ))}
            {!detail.messages.length && (
              <p className="small-text">
                No messages yet. Ask a question about this application.
              </p>
            )}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(`applications/${detail.app.id}/message`, {
                  message: text,
                });
                setText("");
                notice(t("Message sent"));
                router.refresh();
              } catch (err) {
                notice((err as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t("Write your message")}
              <textarea
                value={text}
                required
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  actor.role === "student"
                    ? "Ask for clarification or explain a correction…"
                    : "Explain what the applicant needs to provide…"
                }
              />
            </label>
            <Button busy={busy} style={{ marginTop: 14 }}>
              <Send size={14} />
              {t("Send message")}
            </Button>
          </form>
        </div>
      </Panel>
    </Localize>
  );
}
