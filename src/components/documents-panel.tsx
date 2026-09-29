"use client";
import { Localize } from "@/components/localize";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  Check,
  ScanLine,
  ExternalLink,
  LoaderCircle,
} from "lucide-react";
import type { ApplicationDetail } from "@/server/queries";
import { api, useApp } from "./providers";
import { Button, Confidence, Notice } from "./ui";
export function DocumentPanel({
  detail,
  demo,
  editable = false,
  beforeUpload,
}: {
  detail: ApplicationDetail;
  demo: boolean;
  editable?: boolean;
  beforeUpload?: () => Promise<void>;
}) {
  const { t, notice } = useApp();
  const router = useRouter();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState("");
  const [fixtureBusy, setFixtureBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File | undefined, category: string) {
    if (!file) return;
    setError("");
    try {
      if (file.size === 0 || file.size > 3 * 1024 * 1024)
        throw new Error(
          "Choose a non-empty PDF, JPG or PNG smaller than 3 MB.",
        );
      await beforeUpload?.();
      setProgress((p) => ({ ...p, [category]: 0 }));
      const form = new FormData();
      form.set("file", file);
      form.set("category", category);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/applications/${detail.app.id}/documents`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress((p) => ({
              ...p,
              [category]: Math.round((e.loaded / e.total) * 100),
            }));
        };
        xhr.onload = () => {
          let result;
          try {
            result = JSON.parse(xhr.responseText);
          } catch {
            reject(new Error("Upload could not finish. Try again."));
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(result.error || "Upload failed."));
        };
        xhr.onerror = () =>
          reject(new Error("Connection interrupted. Try the upload again."));
        xhr.send(form);
      });
      notice("Document uploaded and checked");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress((p) => {
        const next = { ...p };
        delete next[category];
        return next;
      });
    }
  }
  async function fixtures(variant: string) {
    setFixtureBusy(true);
    setError("");
    try {
      await beforeUpload?.();
      await api(`applications/${detail.app.id}/fixtures`, { variant });
      notice("Fictional demo documents loaded and processed");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFixtureBusy(false);
    }
  }
  return (
    <Localize>
      <div className="stack">
        {editable && demo && (
          <div className="notice info">
            <ScanLine size={18} />
            <div>
              <strong>Try the verification workflow</strong>
              <p>
                Use fictional PDF fixtures to see extraction and mismatch
                detection.
              </p>
              <div className="row wrap" style={{ marginTop: 12 }}>
                <Button
                  type="button"
                  variant="secondary"
                  busy={fixtureBusy}
                  onClick={() => fixtures("clean")}
                >
                  {t("Use clean demo documents")}
                </Button>
                <button
                  type="button"
                  className="text-button"
                  disabled={fixtureBusy}
                  onClick={() => fixtures("mismatch")}
                >
                  {t("Load mismatch example")}
                </button>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="document-grid">
          {detail.app.schemeSnapshot.documents.map((req) => {
            const doc = detail.documents.find((d) => d.category === req.key);
            const busy = progress[req.key] !== undefined;
            return (
              <div
                key={req.key}
                className={`document-card ${drag === req.key ? "dragging" : ""}`}
                onDragOver={(e) => {
                  if (editable) {
                    e.preventDefault();
                    setDrag(req.key);
                  }
                }}
                onDragLeave={() => setDrag("")}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag("");
                  if (editable && !busy)
                    upload(e.dataTransfer.files[0], req.key);
                }}
              >
                <div className="document-top">
                  <span className="document-icon">
                    <FileText size={21} />
                  </span>
                  <span className="badge">
                    {t(req.required ? "Required" : "Optional")}
                  </span>
                </div>
                <h3>{t(req.label)}</h3>
                {doc ? (
                  <>
                    <div className="filename">
                      {doc.filename} · {(doc.size / 1024).toFixed(1)} KB
                    </div>
                    <div className="between" style={{ marginTop: 12 }}>
                      <span
                        className={`badge ${doc.analysis.quality === "good" ? "status-approved" : "status-deficiency_raised"}`}
                      >
                        <i />
                        {doc.analysis.quality === "good"
                          ? t("Verified")
                          : t("Needs attention")}
                      </span>
                      <Confidence value={doc.analysis.confidence} />
                    </div>
                    <div className="document-results">
                      <div>
                        <span className="muted">Classification</span>
                        <strong>{doc.analysis.classification}</strong>
                      </div>
                      <div>
                        <span className="muted">OCR status</span>
                        <span>
                          <Check size={10} style={{ display: "inline" }} />{" "}
                          Processed
                        </span>
                      </div>
                    </div>
                    <details style={{ marginTop: 12, fontSize: 10 }}>
                      <summary style={{ color: "#507b70" }}>
                        {t("Extracted fields")} ({doc.analysis.fields.length})
                      </summary>
                      <div className="document-results">
                        {doc.analysis.fields.map((field) => (
                          <div key={field.field}>
                            <span>
                              {field.field}
                              <small
                                style={{
                                  display: "block",
                                  fontSize: 9,
                                  color: "#899c9e",
                                }}
                              >
                                {String(field.value)}
                              </small>
                            </span>
                            <strong>{field.confidence}%</strong>
                          </div>
                        ))}
                        <p
                          style={{ fontSize: 9, lineHeight: 1.8, marginTop: 8 }}
                        >
                          {doc.analysis.explanation}
                        </p>
                      </div>
                    </details>
                    <a
                      href={`/api/documents/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-button"
                      style={{ fontSize: 10, marginTop: 15 }}
                    >
                      {t("View document")}
                      <ExternalLink size={12} />
                    </a>
                  </>
                ) : (
                  <p style={{ fontSize: 10, marginTop: 9 }}>
                    PDF, JPG or PNG · up to 3 MB
                  </p>
                )}
                {editable && (
                  <label className="upload-zone">
                    <input
                      className="sr-only"
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      disabled={busy || fixtureBusy}
                      aria-label={`${doc ? "Replace" : "Upload"} ${req.label}`}
                      onChange={(e) => {
                        upload(e.target.files?.[0], req.key);
                        e.target.value = "";
                      }}
                    />
                    {busy ? (
                      <>
                        <LoaderCircle size={18} className="spin" />
                        {progress[req.key] < 100
                          ? `Uploading ${progress[req.key]}%`
                          : "Reading and verifying document…"}
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        <span style={{ marginTop: 8 }}>
                          {t(doc ? "Replace document" : "Upload document")}
                        </span>
                        <small>Drag a file here or click to browse</small>
                      </>
                    )}
                  </label>
                )}
                {busy && (
                  <div className="progress-track" style={{ marginTop: 12 }}>
                    <span style={{ width: `${progress[req.key]}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Notice>
          Text PDFs are extracted locally. Image scans need an OCR provider or
          manual officer verification. Confidence scores are heuristics, not
          proof of authenticity.
        </Notice>
      </div>
    </Localize>
  );
}
