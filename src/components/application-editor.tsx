"use client";
import { Localize } from "@/components/localize";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  type Ref,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { ApplicationDetail } from "@/server/queries";
import type { FormData as ApplicantData, FieldConfig } from "@/lib/domain";
import { evaluateEligibility } from "@/lib/rules";
import { useApp, api } from "./providers";
import { Button, Notice, Panel } from "./ui";
import { DocumentPanel } from "./documents-panel";
export function FormField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig;
  value: ApplicantData[string] | undefined;
  onChange: (value: ApplicantData[string]) => void;
}) {
  const { t } = useApp();
  return (
    <Localize>
      <label>
        {t(field.label)}
        {field.required ? " *" : ""}
        {field.type === "select" ? (
          <select
            value={String(value ?? "")}
            required={field.required}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{t("Choose an option")}</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {t(o)}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={field.type}
            value={String(value ?? "")}
            required={field.required}
            maxLength={field.type === "number" ? undefined : 300}
            min={field.type === "number" ? 0 : undefined}
            step={field.type === "number" ? "any" : undefined}
            onChange={(e) =>
              onChange(
                field.type === "number" && e.target.value !== ""
                  ? Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        )}{" "}
        {field.help && <small>{t(field.help)}</small>}
      </label>
    </Localize>
  );
}
export function ApplicationEditor({
  detail,
  demo,
  saveRef,
}: {
  detail: ApplicationDetail;
  demo: boolean;
  saveRef?: Ref<() => Promise<void>>;
}) {
  const { app } = detail;
  const { t, notice } = useApp();
  const router = useRouter();
  const [data, setData] = useState<ApplicantData>(app.data);
  const [step, setStep] = useState(0);
  const [saveStatus, setSaveStatus] = useState("All changes saved");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(app.version);
  const current = useRef(data);
  const saved = useRef(JSON.stringify(app.data));
  const versionRef = useRef(app.version);
  const pending = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    current.current = data;
  }, [data]);
  useEffect(() => {
    versionRef.current = app.version;
    setVersion(app.version);
  }, [app.version]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const save = useCallback(
    async function saveDraft(): Promise<void> {
      if (pending.current) {
        await pending.current;
        return saveDraft();
      }
      const snapshot = JSON.stringify(current.current);
      if (snapshot === saved.current) return;
      setSaveStatus("Saving…");
      setError("");
      const promise = api<{ version: number }>(`applications/${app.id}/save`, {
        data: current.current,
        version: versionRef.current,
      })
        .then((result) => {
          versionRef.current = result.version;
          saved.current = snapshot;
          if (mounted.current) {
            setVersion(result.version);
            setSaveStatus("All changes saved");
          }
        })
        .catch((e) => {
          if (mounted.current) {
            setError(e.message);
            setSaveStatus("Save failed — retry");
          }
          throw e;
        })
        .finally(() => {
          pending.current = null;
        });
      pending.current = promise;
      await promise;
    },
    [app.id],
  );
  useImperativeHandle(saveRef, () => save, [save]);
  useEffect(
    () => () => {
      void save().catch(() => {});
    },
    [save],
  );
  useEffect(() => {
    if (JSON.stringify(data) === saved.current) return;
    setSaveStatus("Unsaved changes");
    const timer = setTimeout(() => {
      save().catch(() => {});
    }, 850);
    return () => clearTimeout(timer);
  }, [data, save]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(current.current) !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, []);
  const sections = Array.from(
    new Set(app.schemeSnapshot.fields.map((f) => f.section)),
  );
  const steps = [...sections, "Documents", "Declaration"];
  const filled = app.schemeSnapshot.fields.filter((f) =>
    String(data[f.key] ?? "").trim(),
  ).length;
  const progress = Math.round(
    (filled / app.schemeSnapshot.fields.length) * 100,
  );
  const result = evaluateEligibility(app.schemeSnapshot.rules, {
    ...data,
    age: (() => {
      const birth = new Date(String(data.dob));
      const now = new Date();
      let age = now.getUTCFullYear() - birth.getUTCFullYear();
      if (
        now.getUTCMonth() < birth.getUTCMonth() ||
        (now.getUTCMonth() === birth.getUTCMonth() &&
          now.getUTCDate() < birth.getUTCDate())
      )
        age--;
      return Number.isFinite(age) ? age : 0;
    })(),
  });
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await save();
      await api(`applications/${app.id}/submit`);
      notice(t("Application submitted"));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Localize>
      <div className="stack">
        <div className="between">
          <span className="save-status">
            <Check size={13} />
            {t(saveStatus)}
          </span>
          <span className="small-text muted">
            {progress}% complete · v{version}
          </span>
        </div>
        <div
          className="progress-track"
          aria-label={`${progress}% of form complete`}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <Panel>
          <div className="stepper" aria-label="Application steps">
            {steps.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(i)}
                className={step === i ? "active" : ""}
                aria-current={step === i ? "step" : undefined}
              >
                <span>{i < step ? <Check size={12} /> : i + 1}</span>
                {t(s)}
              </button>
            ))}
          </div>
          <form
            className="form-section"
            onSubmit={(e) => {
              e.preventDefault();
              if (step < steps.length - 1) {
                save()
                  .then(() => setStep(step + 1))
                  .catch(() => {});
              } else submit();
            }}
          >
            <h2>{t(steps[step])}</h2>
            {step < sections.length ? (
              <div className="form-grid">
                {app.schemeSnapshot.fields
                  .filter((f) => f.section === steps[step])
                  .map((field) => (
                    <FormField
                      key={field.key}
                      field={field}
                      value={data[field.key]}
                      onChange={(value) =>
                        setData((prev) => ({ ...prev, [field.key]: value }))
                      }
                    />
                  ))}
              </div>
            ) : step === sections.length ? (
              <DocumentPanel
                detail={detail}
                demo={demo}
                editable
                beforeUpload={save}
              />
            ) : (
              <div className="stack">
                <Notice>
                  <ShieldCheck
                    size={17}
                    style={{ display: "inline", marginRight: 7 }}
                  />
                  {t("AI suggests. Rules validate. Humans decide.")}{" "}
                  {t("Demo criteria")} apply to this application.
                </Notice>
                <div className="data-list">
                  {app.schemeSnapshot.fields.map((f) => (
                    <div key={f.key}>
                      <dt>{t(f.label)}</dt>
                      <dd translate={f.type === "select" ? undefined : "no"}>
                        {String(data[f.key] ?? "—")}
                      </dd>
                    </div>
                  ))}
                </div>
                <Notice tone={result.eligible ? "success" : "warning"}>
                  {result.eligible
                    ? "Your entered details satisfy the configured demo rules."
                    : "One or more configured rules need attention. Review the eligibility panel. An officer makes the final decision."}
                </Notice>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    required
                    checked={data.consent === true}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        consent: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    {t(
                      "I confirm that this application uses fictional demonstration information and consent to its processing for this prototype.",
                    )}{" "}
                    <Link href="/about/privacy" className="text-button">
                      {t("Privacy notice")}
                    </Link>
                  </span>
                </label>
              </div>
            )}
            {error && (
              <div
                className="form-error"
                role="alert"
                style={{ marginTop: 15 }}
              >
                {error}
              </div>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
              >
                <ChevronLeft size={14} />
                {t("Previous")}
              </Button>
              <div className="row gap-sm">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    save()
                      .then(() => notice(t("Application saved")))
                      .catch(() => {})
                  }
                >
                  <Save size={14} />
                  {t("Save draft")}
                </Button>
                <Button type="submit" busy={busy}>
                  {step === steps.length - 1 ? (
                    <>
                      <Send size={14} />
                      {t(
                        app.status === "draft"
                          ? "Submit application"
                          : "Resubmit application",
                      )}
                    </>
                  ) : (
                    <>
                      {t("Next")}
                      <ChevronRight size={14} />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Panel>
      </div>
    </Localize>
  );
}
