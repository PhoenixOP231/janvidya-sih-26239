"use client";
import { Localize } from "@/components/localize";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, ListOrdered, CheckCircle2, Send } from "lucide-react";
import type { getMeritLists } from "@/server/administration";
import type { SchemeView } from "./schemes";
import { dateLabel } from "@/lib/domain";
import { api, useApp } from "./providers";
import { PageTitle, Panel, Button, Notice, Empty, StatusBadge } from "./ui";
export function Merit({
  data,
  schemes,
}: {
  data: Awaited<ReturnType<typeof getMeritLists>>;
  schemes: SchemeView[];
}) {
  const [schemeId, setSchemeId] = useState(schemes[0]?.id || "");
  const [listId, setListId] = useState(data.lists[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { notice } = useApp();
  const router = useRouter();
  const list = data.lists.find((l) => l.id === listId) || data.lists[0];
  const entries = data.entries.filter((e) => e.entry.listId === list?.id);
  async function generate() {
    setBusy(true);
    try {
      const result = await api<{ id: string }>("merit", { schemeId });
      setListId(result.id);
      setConfirm(false);
      notice("Merit list generated for review");
      router.refresh();
    } catch (e) {
      notice((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow="Selection management"
          title="Merit, with an explanation."
          description="Rank officer-approved applications using configured criteria. Review before publishing."
        />
        <Panel>
          <div className="panel-body">
            <div className="between wrap">
              <label style={{ minWidth: 260 }}>
                Scheme
                <select
                  value={schemeId}
                  onChange={(e) => setSchemeId(e.target.value)}
                >
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={generate} busy={busy}>
                <ListOrdered size={15} />
                Generate merit list
              </Button>
            </div>
            <p className="small-text muted" style={{ marginTop: 17 }}>
              Only approved or waitlisted applications are ranked. Ties use
              submission time, then application ID. State limits and the overall
              quota are respected.
            </p>
          </div>
        </Panel>
        <div style={{ marginTop: 24 }}>
          {list ? (
            <Panel
              title="Proposed ranking"
              subtitle={`${schemes.find((s) => s.id === list.schemeId)?.code} · ${dateLabel(list.createdAt)} · ${entries.length} candidates`}
              action={
                <a
                  className="button secondary small"
                  href={`/api/merit/${list.id}/export`}
                >
                  <Download size={13} />
                  Export CSV
                </a>
              }
            >
              <div className="panel-body" style={{ paddingTop: 0 }}>
                <label>
                  Merit list history
                  <select
                    value={list.id}
                    onChange={(e) => {
                      setListId(e.target.value);
                      setConfirm(false);
                    }}
                  >
                    {data.lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {schemes.find((s) => s.id === l.schemeId)?.code} ·{" "}
                        {new Date(l.createdAt).toLocaleString("en-IN")} ·{" "}
                        {l.published ? "Published" : "Draft"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Applicant</th>
                      <th>Score</th>
                      <th>Eligibility</th>
                      <th>Proposal</th>
                      <th>Reasoning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(({ entry, name, eligible }) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>#{entry.rank}</strong>
                        </td>
                        <td>
                          <Link href={`/applications/${entry.applicationId}`}>
                            <strong>{name}</strong>
                            <small>{entry.applicationId}</small>
                          </Link>
                        </td>
                        <td>
                          <strong>{entry.score.toFixed(2)}</strong>
                          <small>/ 100</small>
                        </td>
                        <td>
                          <span className="badge status-approved">
                            {eligible ? "Criteria passed" : "Officer override"}
                          </span>
                        </td>
                        <td>
                          <StatusBadge
                            status={entry.selected ? "selected" : "waitlisted"}
                          />
                        </td>
                        <td
                          style={{
                            maxWidth: 280,
                            fontSize: 10,
                            color: "#7d929d",
                          }}
                        >
                          {entry.reasoning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-body">
                {list.published ? (
                  <Notice tone="success">
                    <CheckCircle2
                      size={16}
                      style={{ display: "inline", marginRight: 6 }}
                    />
                    This selection has been published. Applicants received
                    notifications and selected candidates have scheduled payment
                    records.
                  </Notice>
                ) : (
                  <div className="stack">
                    <Notice>
                      {entries.filter((e) => e.entry.selected).length}{" "}
                      applicants proposed for selection. Publishing updates
                      their status, schedules fictional payments, and sends
                      in-app notifications.
                    </Notice>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={confirm}
                        onChange={(e) => setConfirm(e.target.checked)}
                      />
                      I have reviewed this ranking and confirm the proposed
                      selection.
                    </label>
                    <div>
                      <Button
                        disabled={!confirm}
                        busy={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await api(`merit/${list.id}/publish`);
                            notice("Selection published");
                            router.refresh();
                          } catch (e) {
                            notice((e as Error).message, true);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <Send size={15} />
                        Publish selection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel>
              <Empty
                title="Your next merit list starts here."
                description="Choose a scheme and generate a ranking of applications already approved by an officer."
              />
            </Panel>
          )}
        </div>
      </>
    </Localize>
  );
}
