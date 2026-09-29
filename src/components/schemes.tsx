"use client";
import { Localize } from "@/components/localize";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Globe2,
  ArrowRight,
  Plus,
  Settings2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { Actor, FormData, SchemeConfig } from "@/lib/domain";
import { money, dateLabel } from "@/lib/domain";
import { evaluateEligibility } from "@/lib/rules";
import { api, useApp } from "./providers";
import { Button, PageTitle, Notice } from "./ui";
import { FormField } from "./application-editor";
export type SchemeView = {
  id: string;
  name: string;
  code: string;
  description: string;
  type: string;
  active: boolean;
  award: number;
  deadline: string;
  version: number;
  config: SchemeConfig;
};
export function Schemes({
  schemes,
  actor,
}: {
  schemes: SchemeView[];
  actor: Actor;
}) {
  const { t, notice } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<SchemeView | null>(null);
  const [input, setInput] = useState<FormData>({
    category: "Scheduled Tribe",
    familyIncome: 210000,
    academicScore: 88,
    age: 25,
    course: "PhD",
    offerStatus: "Unconditional",
  });
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (preview) dialog.current?.showModal();
    else dialog.current?.close();
  }, [preview]);
  const admin = ["scheme_admin", "ministry_admin"].includes(actor.role);
  const result = preview
    ? evaluateEligibility(preview.config.rules, input)
    : null;
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow={admin ? "Scheme administration" : "Student portal"}
          title="Support for your next step."
          description="Browse configurable demonstration schemes for research and overseas study."
          actions={
            admin ? (
              <Link href="/schemes/new" className="button">
                <Plus size={15} />
                Create scheme
              </Link>
            ) : undefined
          }
        />
        <Notice>
          These schemes are inspired by NFST and NOS. All eligibility, award
          amounts, quotas, and deadlines shown are demonstration data, not
          current official government rules.
        </Notice>
        <div className="scheme-grid" style={{ marginTop: 25 }}>
          {schemes.map((s) => (
            <article
              key={s.id}
              className={`scheme-card ${s.code === "NOS" ? "nos" : ""}`}
            >
              <div className="scheme-card-top">
                <span className="scheme-icon">
                  {s.code === "NOS" ? (
                    <Globe2 size={24} />
                  ) : (
                    <BookOpen size={24} />
                  )}
                </span>
                <span
                  className={`badge ${s.active ? "status-good" : "status-draft"}`}
                >
                  <i />
                  {s.active ? t("Open for applications") : "Inactive"}
                </span>
                <div className="scheme-code">
                  {s.code} · {s.type}
                </div>
                <h2>{s.name}</h2>
              </div>
              <div className="scheme-card-body">
                <p>{s.description}</p>
                <div className="scheme-meta">
                  <div>
                    <small>Illustrative award</small>
                    <strong>
                      {money(s.award)}
                      {s.code === "NFST" ? (
                        <small
                          style={{
                            display: "inline",
                            marginLeft: 4,
                            fontWeight: 450,
                          }}
                        >
                          /month
                        </small>
                      ) : null}
                    </strong>
                  </div>
                  <div>
                    <small>{t("Deadline")}</small>
                    <strong>{dateLabel(s.deadline)}</strong>
                  </div>
                </div>
                <div className="small-text muted">
                  {s.config.documents.filter((d) => d.required).length} required
                  documents · {s.config.rules.length} eligibility rules ·
                  Version {s.version}
                </div>
                <div className="between">
                  <button className="text-button" onClick={() => setPreview(s)}>
                    {t("Check eligibility")}
                  </button>
                  {admin ? (
                    <Link
                      href={`/schemes/${s.id}`}
                      className="button secondary"
                    >
                      <Settings2 size={14} />
                      Configure
                    </Link>
                  ) : actor.role === "student" ? (
                    <Button
                      busy={busy === s.id}
                      disabled={!s.active || !!busy}
                      onClick={async () => {
                        setBusy(s.id);
                        try {
                          const result = await api<{ id: string }>(
                            "applications",
                            { schemeId: s.id },
                          );
                          router.push(`/applications/${result.id}`);
                          router.refresh();
                        } catch (e) {
                          notice((e as Error).message, true);
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      {t("Apply now")}
                      <ArrowRight size={14} />
                    </Button>
                  ) : (
                    <Link
                      href={`/applications?scheme=${s.id}`}
                      className="button secondary"
                    >
                      View applications
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        <dialog
          ref={dialog}
          onCancel={() => setPreview(null)}
          className="modal"
          style={{
            margin: "auto",
            border: "1px solid #d9e5e4",
            color: "var(--ink)",
          }}
        >
          {preview && (
            <>
              <div className="between" style={{ marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>
                  {preview.code} eligibility preview
                </h2>
                <button
                  className="icon-button"
                  onClick={() => setPreview(null)}
                  aria-label="Close eligibility preview"
                >
                  ×
                </button>
              </div>
              <div className="form-grid">
                {[
                  {
                    key: "age",
                    label: "Age",
                    section: "",
                    type: "number" as const,
                    required: true,
                  },
                  ...preview.config.fields.filter((f) =>
                    [
                      "category",
                      "familyIncome",
                      "academicScore",
                      "course",
                      "offerStatus",
                      "state",
                      "institution",
                      "applicationYear",
                    ].includes(f.key),
                  ),
                ].map((field) => (
                  <FormField
                    key={field.key}
                    field={field}
                    value={input[field.key]}
                    onChange={(value) =>
                      setInput((prev) => ({ ...prev, [field.key]: value }))
                    }
                  />
                ))}
              </div>
              <div className="rule-list" style={{ marginTop: 24 }}>
                {result?.results.map((r) => (
                  <div
                    className={`rule-result ${r.passed ? "" : "failed"}`}
                    key={r.id}
                  >
                    {r.passed ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <div>
                      <strong>{r.label}</strong>
                      <small>{r.explanation}</small>
                    </div>
                  </div>
                ))}
              </div>
              <p className="small-text muted" style={{ marginTop: 20 }}>
                This preview checks configured demo criteria only. Your
                submitted documents and officer review determine the final
                outcome.
              </p>
            </>
          )}
        </dialog>
      </>
    </Localize>
  );
}
