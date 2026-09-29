"use client";
import { Localize } from "@/components/localize";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, ChevronDown } from "lucide-react";
import type { Rule, Condition, Operator, FieldConfig } from "@/lib/domain";
import type { SchemeView } from "./schemes";
import { api, useApp } from "./providers";
import { PageTitle, Panel, Button, Notice } from "./ui";
const uid = () => crypto.randomUUID();
const newRule = (): Condition => ({
  id: uid(),
  field: "familyIncome",
  operator: "<=",
  value: 600000,
  label: "Income threshold",
});
function RuleEditor({
  rule,
  fields,
  onChange,
  onRemove,
}: {
  rule: Rule;
  fields: FieldConfig[];
  onChange: (rule: Rule) => void;
  onRemove: () => void;
}) {
  if (rule.operator === "AND" || rule.operator === "OR")
    return (
      <Localize>
        <div className="field-editor">
          <div className="between">
            <label>
              Group logic
              <select
                value={rule.operator}
                onChange={(e) =>
                  onChange({
                    ...rule,
                    operator: e.target.value as "AND" | "OR",
                  })
                }
              >
                <option value="AND">All conditions (AND)</option>
                <option value="OR">Any condition (OR)</option>
              </select>
            </label>
            <button
              className="icon-button"
              type="button"
              onClick={onRemove}
              aria-label="Remove rule group"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <label style={{ margin: "12px 0" }}>
            Explanation label
            <input
              value={rule.label}
              onChange={(e) => onChange({ ...rule, label: e.target.value })}
            />
          </label>
          {rule.rules.map((child, i) => (
            <RuleEditor
              key={child.id}
              rule={child}
              fields={fields}
              onChange={(r) =>
                onChange({
                  ...rule,
                  rules: rule.rules.map((c, j) => (i === j ? r : c)),
                })
              }
              onRemove={() =>
                onChange({
                  ...rule,
                  rules: rule.rules.filter((_, j) => i !== j),
                })
              }
            />
          ))}
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onChange({ ...rule, rules: [...rule.rules, newRule()] })
            }
          >
            <Plus size={13} />
            Add grouped condition
          </button>
        </div>
      </Localize>
    );
  const r = rule as Condition;
  return (
    <Localize>
      <div className="rule-editor">
        <label>
          Explanation label
          <input
            value={r.label}
            required
            onChange={(e) => onChange({ ...r, label: e.target.value })}
          />
        </label>
        <label>
          Field
          <select
            value={r.field}
            onChange={(e) => onChange({ ...r, field: e.target.value })}
          >
            {[...fields, { key: "age", label: "Age (from date of birth)" }].map(
              (f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Condition
          <select
            value={r.operator}
            onChange={(e) =>
              onChange({ ...r, operator: e.target.value as Operator })
            }
          >
            {["=", "!=", ">", ">=", "<", "<=", "IN", "NOT_IN", "BETWEEN"].map(
              (o) => (
                <option key={o}>{o}</option>
              ),
            )}
          </select>
        </label>
        <label>
          {["IN", "NOT_IN", "BETWEEN"].includes(r.operator)
            ? "Values (comma separated)"
            : "Value"}
          <input
            required
            value={
              Array.isArray(r.value) ? r.value.join(", ") : String(r.value)
            }
            onChange={(e) => {
              const raw = e.target.value;
              const numeric =
                fields.find((f) => f.key === r.field)?.type === "number" ||
                r.field === "age";
              onChange({
                ...r,
                value: ["IN", "NOT_IN", "BETWEEN"].includes(r.operator)
                  ? raw
                      .split(",")
                      .map((v) =>
                        numeric && v.trim() !== ""
                          ? Number(v.trim())
                          : v.trim(),
                      )
                  : numeric && raw !== ""
                    ? Number(raw)
                    : raw,
              });
            }}
          />
        </label>
        <button
          type="button"
          className="icon-button"
          onClick={onRemove}
          aria-label="Remove rule"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </Localize>
  );
}
export function SchemeBuilder({
  initial,
  isNew = false,
}: {
  initial: SchemeView;
  isNew?: boolean;
}) {
  const [scheme, setScheme] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { notice } = useApp();
  const router = useRouter();
  const config = scheme.config;
  const setConfig = (value: Partial<typeof config>) =>
    setScheme((s) => ({ ...s, config: { ...s.config, ...value } }));
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow="Scheme administration"
          title={isNew ? "Build an opportunity." : `Configure ${scheme.code}`}
          description="Forms, rules, documents, and ranking. One versioned configuration."
        />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const result = await api<{ id: string; version: number }>(
                `schemes/${isNew ? "new" : scheme.id}`,
                scheme,
              );
              notice("Scheme configuration saved");
              setScheme((s) => ({
                ...s,
                id: result.id,
                version: result.version,
              }));
              router.push(`/schemes/${result.id}`);
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Panel>
            <section className="builder-section">
              <h2>Scheme details</h2>
              <p>
                Changes create a new version. Existing applications retain their
                original rules.
              </p>
              <div className="form-grid">
                <label>
                  Scheme code
                  <input
                    required
                    value={scheme.code}
                    pattern="[A-Za-z0-9-]+"
                    maxLength={20}
                    onChange={(e) =>
                      setScheme({ ...scheme, code: e.target.value })
                    }
                  />
                </label>
                <label>
                  Scheme name
                  <input
                    required
                    minLength={5}
                    maxLength={160}
                    value={scheme.name}
                    onChange={(e) =>
                      setScheme({ ...scheme, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Type
                  <input
                    required
                    value={scheme.type}
                    onChange={(e) =>
                      setScheme({ ...scheme, type: e.target.value })
                    }
                  />
                </label>
                <label>
                  Illustrative award (INR)
                  <input
                    type="number"
                    min={1}
                    max={10000000}
                    required
                    value={scheme.award}
                    onChange={(e) =>
                      setScheme({ ...scheme, award: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Application deadline
                  <input
                    type="date"
                    required
                    value={scheme.deadline}
                    onChange={(e) =>
                      setScheme({ ...scheme, deadline: e.target.value })
                    }
                  />
                </label>
                <label
                  className="checkbox-label"
                  style={{ alignSelf: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={scheme.active}
                    onChange={(e) =>
                      setScheme({ ...scheme, active: e.target.checked })
                    }
                  />
                  Accept new applications
                </label>
                <label className="full">
                  Description
                  <textarea
                    required
                    minLength={10}
                    maxLength={1200}
                    value={scheme.description}
                    onChange={(e) =>
                      setScheme({ ...scheme, description: e.target.value })
                    }
                  />
                </label>
              </div>
            </section>
            <section className="builder-section">
              <h2>Eligibility rules</h2>
              <p>
                All top-level rules must pass. Add AND / OR groups for more
                complex conditions.
              </p>
              {config.rules.map((r, i) => (
                <RuleEditor
                  key={r.id}
                  rule={r}
                  fields={config.fields}
                  onChange={(rule) =>
                    setConfig({
                      rules: config.rules.map((v, j) => (i === j ? rule : v)),
                    })
                  }
                  onRemove={() =>
                    setConfig({ rules: config.rules.filter((_, j) => i !== j) })
                  }
                />
              ))}
              <div className="row" style={{ marginTop: 15 }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setConfig({ rules: [...config.rules, newRule()] })
                  }
                >
                  <Plus size={14} />
                  Add condition
                </Button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    setConfig({
                      rules: [
                        ...config.rules,
                        {
                          id: uid(),
                          label: "Grouped conditions",
                          operator: "OR",
                          rules: [newRule()],
                        },
                      ],
                    })
                  }
                >
                  Add AND / OR group
                </button>
              </div>
            </section>
            <section className="builder-section">
              <h2>Document requirements</h2>
              <p>
                Use stable document keys. Required fields are compared against
                extracted evidence.
              </p>
              {config.documents.map((d, i) => (
                <div className="field-editor" key={i}>
                  <div className="requirement-row">
                    <label>
                      Document key
                      <input
                        required
                        value={d.key}
                        onChange={(e) =>
                          setConfig({
                            documents: config.documents.map((v, j) =>
                              i === j ? { ...v, key: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Display name
                      <input
                        required
                        value={d.label}
                        onChange={(e) =>
                          setConfig({
                            documents: config.documents.map((v, j) =>
                              i === j ? { ...v, label: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={d.required}
                        onChange={(e) =>
                          setConfig({
                            documents: config.documents.map((v, j) =>
                              i === j
                                ? { ...v, required: e.target.checked }
                                : v,
                            ),
                          })
                        }
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove document requirement"
                      onClick={() =>
                        setConfig({
                          documents: config.documents.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <label>
                    Required extracted fields (comma separated)
                    <input
                      defaultValue={d.fields.join(", ")}
                      onBlur={(e) =>
                        setConfig({
                          documents: config.documents.map((v, j) =>
                            i === j
                              ? {
                                  ...v,
                                  fields: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                style={{ marginTop: 15 }}
                onClick={() =>
                  setConfig({
                    documents: [
                      ...config.documents,
                      {
                        key: `document_${config.documents.length + 1}`,
                        label: "New supporting document",
                        required: true,
                        fields: ["fullName"],
                      },
                    ],
                  })
                }
              >
                <Plus size={14} />
                Add document
              </Button>
            </section>
            <section className="builder-section">
              <h2>Dynamic application form</h2>
              <p>
                Add scheme-specific fields and sections. The student form is
                generated from this configuration.
              </p>
              {config.fields.map((f, i) => (
                <details className="field-editor" key={i}>
                  <summary className="between">
                    <span style={{ fontSize: 12, fontWeight: 650 }}>
                      {f.label} <small className="muted">· {f.section}</small>
                    </span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="form-grid" style={{ marginTop: 16 }}>
                    <label>
                      Field key
                      <input
                        value={f.key}
                        required
                        onChange={(e) =>
                          setConfig({
                            fields: config.fields.map((v, j) =>
                              i === j ? { ...v, key: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Label
                      <input
                        value={f.label}
                        required
                        onChange={(e) =>
                          setConfig({
                            fields: config.fields.map((v, j) =>
                              i === j ? { ...v, label: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Section
                      <input
                        value={f.section}
                        required
                        onChange={(e) =>
                          setConfig({
                            fields: config.fields.map((v, j) =>
                              i === j ? { ...v, section: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Input type
                      <select
                        value={f.type}
                        onChange={(e) =>
                          setConfig({
                            fields: config.fields.map((v, j) =>
                              i === j
                                ? {
                                    ...v,
                                    type: e.target.value as FieldConfig["type"],
                                  }
                                : v,
                            ),
                          })
                        }
                      >
                        {[
                          "text",
                          "number",
                          "date",
                          "select",
                          "email",
                          "tel",
                        ].map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Help text
                      <input
                        value={f.help || ""}
                        onChange={(e) =>
                          setConfig({
                            fields: config.fields.map((v, j) =>
                              i === j ? { ...v, help: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) =>
                          setConfig({
                            fields: config.fields.map((v, j) =>
                              i === j
                                ? { ...v, required: e.target.checked }
                                : v,
                            ),
                          })
                        }
                      />
                      Required field
                    </label>
                    {f.type === "select" && (
                      <label className="full">
                        Options (comma separated)
                        <input
                          defaultValue={f.options?.join(", ") || ""}
                          onBlur={(e) =>
                            setConfig({
                              fields: config.fields.map((v, j) =>
                                i === j
                                  ? {
                                      ...v,
                                      options: e.target.value
                                        .split(",")
                                        .map((s) => s.trim()),
                                    }
                                  : v,
                              ),
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    style={{ marginTop: 13, color: "#a25b50" }}
                    onClick={() =>
                      setConfig({
                        fields: config.fields.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove field
                  </button>
                </details>
              ))}
              <Button
                type="button"
                variant="secondary"
                style={{ marginTop: 15 }}
                onClick={() =>
                  setConfig({
                    fields: [
                      ...config.fields,
                      {
                        key: `extra${config.fields.length + 1}`,
                        label: "New field",
                        section: "Additional information",
                        type: "text",
                        required: false,
                      },
                    ],
                  })
                }
              >
                <Plus size={14} />
                Add form field
              </Button>
            </section>
            <section className="builder-section">
              <h2>Ranking, quotas & renewal</h2>
              <p>
                Ranking uses a weighted average. Income priority decreases
                linearly from 100 to 0 as income rises to ₹10,00,000.
              </p>
              <div className="form-grid">
                {(["academic", "income", "research"] as const).map((key) => (
                  <label key={key}>
                    {key[0].toUpperCase() + key.slice(1)} weight
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={config.weights[key]}
                      onChange={(e) =>
                        setConfig({
                          weights: {
                            ...config.weights,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Total selection quota
                  <input
                    type="number"
                    required
                    min={1}
                    value={config.quota}
                    onChange={(e) =>
                      setConfig({ quota: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Renewal minimum academic score
                  <input
                    type="number"
                    required
                    min={0}
                    max={100}
                    value={config.renewalMinScore}
                    onChange={(e) =>
                      setConfig({ renewalMinScore: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Deficiency response window (days)
                  <input
                    type="number"
                    required
                    min={1}
                    max={90}
                    value={config.deficiencyDays}
                    onChange={(e) =>
                      setConfig({ deficiencyDays: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Confidence threshold (%)
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={config.confidenceThreshold}
                    onChange={(e) =>
                      setConfig({ confidenceThreshold: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  State quota limits (State: seats; one per line)
                  <textarea
                    defaultValue={Object.entries(config.stateQuotas)
                      .map(([s, n]) => `${s}: ${n}`)
                      .join("\n")}
                    onBlur={(e) => {
                      const values = Object.fromEntries(
                        e.target.value
                          .split("\n")
                          .filter(Boolean)
                          .map((line) => {
                            const [state, n] = line.split(":");
                            return [state.trim(), Number(n || 0)];
                          }),
                      );
                      setConfig({ stateQuotas: values });
                    }}
                    placeholder="Jharkhand: 5"
                  />
                </label>
              </div>
            </section>
            <section className="builder-section">
              <Notice>
                Demonstration configuration only. Replace these criteria with
                verified official rules before any real scholarship use.
              </Notice>
              {error && (
                <div
                  className="form-error"
                  role="alert"
                  style={{ marginTop: 17 }}
                >
                  {error}
                </div>
              )}
              <div className="form-actions">
                <span className="small-text muted">
                  {isNew ? "New scheme" : `Current version: ${scheme.version}`}
                </span>
                <Button busy={busy}>
                  <Save size={15} />
                  Save scheme configuration
                </Button>
              </div>
            </section>
          </Panel>
        </form>
      </>
    </Localize>
  );
}
