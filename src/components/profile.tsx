"use client";
import { Localize } from "@/components/localize";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UserRound } from "lucide-react";
import { commonFields } from "@/config/schemes";
import type { Actor, FormData } from "@/lib/domain";
import { roleLabels } from "@/lib/domain";
import { FormField } from "./application-editor";
import { useApp, api } from "./providers";
import { PageTitle, Panel, Button, Notice } from "./ui";
export function Profile({
  actor,
  initial,
}: {
  actor: Actor;
  initial: FormData;
}) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const { t, notice } = useApp();
  const router = useRouter();
  return (
    <Localize>
      <>
        <PageTitle
          eyebrow="My profile"
          title="Your information, in one place."
          description="Keep your profile current to prefill future applications."
        />
        <div className="application-layout">
          <Panel title="Profile information">
            <div className="panel-body">
              {actor.role === "student" ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      await api("profile", { data });
                      notice(t("Profile saved"));
                      router.refresh();
                    } catch (err) {
                      notice((err as Error).message, true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <div className="form-grid">
                    {commonFields.map((f) => (
                      <FormField
                        key={f.key}
                        field={{ ...f, required: false }}
                        value={data[f.key]}
                        onChange={(value) =>
                          setData((prev) => ({ ...prev, [f.key]: value }))
                        }
                      />
                    ))}
                  </div>
                  <div className="form-actions">
                    <span className="small-text muted">
                      Used to prefill new applications
                    </span>
                    <Button busy={busy}>
                      <Save size={15} />
                      {t("Save profile")}
                    </Button>
                  </div>
                </form>
              ) : (
                <dl className="data-list">
                  <div>
                    <dt>Name</dt>
                    <dd>{actor.name}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{roleLabels[actor.role]}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{actor.email}</dd>
                  </div>
                  <div>
                    <dt>Workspace</dt>
                    <dd>SIH demonstration</dd>
                  </div>
                </dl>
              )}
            </div>
          </Panel>
          <div className="stack">
            <Panel>
              <div className="panel-body">
                <span className="empty-icon" style={{ margin: "0 0 20px" }}>
                  <UserRound size={25} />
                </span>
                <h3>{actor.name}</h3>
                <p style={{ fontSize: 11, marginTop: 8 }}>{actor.email}</p>
                <p style={{ fontSize: 10, marginTop: 8 }}>
                  {t(roleLabels[actor.role])}
                </p>
              </div>
            </Panel>
            <Notice>
              Keep this demonstration fictional. Only the last four digits of a
              bank account are stored. Profile changes do not alter submitted
              applications.
            </Notice>
          </div>
        </div>
      </>
    </Localize>
  );
}
