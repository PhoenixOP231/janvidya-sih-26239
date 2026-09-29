import { LanguageToggle } from "@/components/public-header";
import { Logo, Notice } from "@/components/ui";
import { DemoRoles } from "@/components/demo-roles";
import { demoEnabled } from "@/server/db";
export default function Demo() {
  return (
    <div className="demo-page">
      <div className="between">
        <Logo />
        <LanguageToggle />
      </div>
      <div className="demo-intro">
        <span className="hero-label">Smart India Hackathon · 26239</span>
        <h1>One platform. Four perspectives.</h1>
        <p>
          Follow a scholarship from application to award. Start as a student,
          then switch roles using the demo bar. A small guide in every workspace
          keeps the story moving.
        </p>
      </div>
      {demoEnabled() ? (
        <DemoRoles />
      ) : (
        <Notice tone="warning">
          Demo accounts are disabled on this deployment.
        </Notice>
      )}
      <section className="panel demo-scenarios">
        <h2>Six cases. Every important conversation.</h2>
        <div className="scenario-grid">
          {[
            [
              "JV-2026-0001",
              "Income mismatch",
              "Entered income differs from certificate evidence. Correct it as Meera.",
            ],
            [
              "JV-2026-0002",
              "Clean application",
              "High confidence, complete evidence, configured criteria satisfied.",
            ],
            [
              "JV-2026-0003",
              "Missing certificate",
              "A clear notice explains what the student needs to provide.",
            ],
            [
              "JV-2026-0004",
              "Low confidence",
              "An uncertain extraction waits for human verification.",
            ],
            [
              "JV-2026-0005",
              "Potential duplicate",
              "A risk signal is visible without making a fraud allegation.",
            ],
            [
              "JV-2026-0006",
              "Officer override",
              "An exception needs a human decision and a recorded reason.",
            ],
          ].map(([id, title, text]) => (
            <div className="scenario" key={id}>
              <small className="muted">{id}</small>
              <strong style={{ display: "block", marginTop: 7 }}>
                {title}
              </strong>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <div style={{ marginTop: 22 }}>
        <Notice>
          All demonstration accounts, documents, payments, and eligibility rules
          are fictional. This is not an official government service. Public demo
          roles can modify shared fictional records.
        </Notice>
      </div>
    </div>
  );
}
