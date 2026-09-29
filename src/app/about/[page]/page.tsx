import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  BookOpen,
  LockKeyhole,
  Network,
  Route,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { Panel, Notice } from "@/components/ui";
const pages: Record<
  string,
  { title: string; intro: string; sections: { title: string; body: string }[] }
> = {
  "responsible-ai": {
    title: "AI assists. People remain accountable.",
    intro:
      "JanVidya is designed around clear evidence, visible uncertainty, and human authority. No model silently decides who receives a scholarship.",
    sections: [
      {
        title: "Recommendations with evidence",
        body: "Document analysis records the extracted value, confidence heuristic, source text, classification, timestamps, and any mismatch. These signals support review; they do not prove that a document is authentic or fraudulent.",
      },
      {
        title: "Uncertainty is a reason to review",
        body: "Low confidence, missing fields, name variations, repeated document hashes, and conflicting information are routed to a person. Unreadable scans never receive invented values. The local fallback extracts text PDFs and identifies image scans that need a configured OCR provider or manual review.",
      },
      {
        title: "Rules are configurable and explainable",
        body: "Each application stores the scheme configuration version used when it was created. Rule outcomes show the supplied value and the requirement. This demonstration uses illustrative NFST and NOS criteria, not legally authoritative policy.",
      },
      {
        title: "Human decisions and correction",
        body: "Authorized officers approve, reject, request clarification, mark deficiencies, or escalate a case. They can correct extraction and override recommendations with a recorded reason. Original evidence and prior decisions remain in the audit history.",
      },
      {
        title: "Know the limits",
        body: "Confidence values are heuristic scores, not calibrated probabilities. Duplicate and document-risk signals are not fraud determinations. Bias evaluation, multilingual OCR benchmarking, independent security review, official policy validation, and appeal procedures are required before real-world use.",
      },
    ],
  },
  privacy: {
    title: "Your information deserves care.",
    intro:
      "This is an independent SIH demonstration. Use only fictional names, documents, contact details, and payment identifiers.",
    sections: [
      {
        title: "What the prototype stores",
        body: "The platform stores your profile, application answers, uploaded files, extracted evidence, messages, decisions, payment ledger entries, and audit events. Only the final four digits of a bank account are requested; do not supply real bank numbers, Aadhaar numbers, or sensitive government identifiers.",
      },
      {
        title: "Who can see an application",
        body: "Students can access their own records. Scrutiny officers can access their assigned applications. Scheme and ministry administrators can access records needed for their management functions. Documents are delivered through an authenticated route. Internal notes are hidden from students.",
      },
      {
        title: "How data is processed",
        body: "Text PDFs are read locally. When an external OCR provider is explicitly configured, document bytes are sent to that provider for extraction. The default assistant uses a local knowledge base. Default email and SMS are simulated in the notification outbox.",
      },
      {
        title: "Public demo accounts",
        body: "The four demonstration accounts are shared and publicly accessible when demo mode is enabled. Any visitor can switch roles and change fictional records. Do not treat these accounts as private. Disable demo mode and establish a real identity administration process before collecting actual data.",
      },
      {
        title: "Retention and production readiness",
        body: "The prototype retains application and audit history; there is no public deletion endpoint. A real deployment needs an approved retention schedule, deletion and access-request process, encryption and key-management policy, and a named data controller. No government affiliation or certification is claimed.",
      },
    ],
  },
  architecture: {
    title: "One platform, connected by evidence.",
    intro:
      "A Vercel-compatible Next.js application with a transactional PostgreSQL core, explicit role boundaries, configurable rules, and replaceable document providers.",
    sections: [
      {
        title: "Application and identity layer",
        body: "React server components render the role workspaces. Route handlers validate input with Zod, enforce same-origin writes, check database-backed sessions, rate-limit requests, and verify application ownership or officer assignment. Passwords use salted scrypt hashes; session tokens are random and only their hashes are stored.",
      },
      {
        title: "Transactional services",
        body: "Applications, decisions, overrides, merit publication, notifications, payments, and audit events are committed together. Optimistic version checks prevent silent overwrites, while row locks serialize consequential state changes. A shared state machine constrains workflow transitions.",
      },
      {
        title: "PostgreSQL and storage",
        body: "Drizzle maps 32 relational tables with foreign keys, uniqueness constraints, and query indexes. Hosted deployments use PostgreSQL through a small node-postgres connection pool. Local demos use persistent PGlite, an embedded PostgreSQL engine. Document storage supports private Vercel Blob or a size-limited database adapter.",
      },
      {
        title: "Document processing",
        body: "File signatures, dimensions, and limits are validated before extraction. A local PDF-text provider works without credentials; OCR.Space is optional. Extracted fields are normalized, compared with form values, scored, and checked for deficiencies. Hash and certificate matches raise review signals.",
      },
      {
        title: "Operations and limits",
        body: "Analytics aggregate records on the server. CSV exports neutralize spreadsheet formulas. Hash-linked audit events are append-only through database triggers, but are not externally anchored. Managed backups, malware scanning, monitoring, durable OCR queues, and formal accessibility testing are production hardening work.",
      },
    ],
  },
  impact: {
    title: "Fewer repeated checks. Clearer next steps.",
    intro:
      "The intended benefit is a shorter feedback loop between the student and the reviewer. These are qualitative design goals, not measured government outcomes.",
    sections: [
      {
        title: "Traditional process",
        body: "A student submits an application. Staff manually inspect the documents, send deficiencies through a separate channel, wait for corrections, and repeat the inspection. Students may have limited visibility between these steps.",
      },
      {
        title: "The JanVidya process",
        body: "A scheme-aware form guides entry. Document analysis extracts evidence and identifies issues early. Rules explain eligibility, students correct specific deficiencies, and officers focus on flagged or exceptional cases before publishing a selection.",
      },
      {
        title: "What improves",
        body: "Less repeated data entry, clearer document feedback, fewer avoidable clerical discrepancies, explicit reasons for decisions, and one place to track applications, payments, and renewals. Administrators can configure schemes and inspect regional patterns.",
      },
      {
        title: "How to evaluate the impact",
        body: "A real pilot should compare time to first deficiency notice, repeat submissions per application, officer review time, completion rate by language and district, appeal outcomes, and accessibility task success. Measure results before making numerical impact claims.",
      },
    ],
  },
  help: {
    title: "A clear next step, whenever you need it.",
    intro:
      "Find the workflow you need below. The JanVidya Assistant inside your workspace can also explain your application status and configured scheme requirements.",
    sections: [
      {
        title: "Apply for a scholarship",
        body: "Create an account or launch the student demo. Complete your profile, open Find a scheme, preview the criteria, and select Apply now. The form changes with the scheme. Your answers save automatically after a short pause. Save draft before leaving and resume from My applications.",
      },
      {
        title: "Upload and verify documents",
        body: "Use genuine PDF, JPG or PNG files up to 3 MB. Drag a file to the relevant document card or select it with the file picker. Demo accounts can load fictional text PDFs. The card shows extraction results and confidence. Images with no available OCR stay in manual review.",
      },
      {
        title: "Correct a deficiency",
        body: "Open your application and read each issue and required action. Replace the relevant document, correct form details if necessary, review your declaration, and resubmit. Use Messages to explain an ambiguity to the officer.",
      },
      {
        title: "Follow a decision or payment",
        body: "The application timeline records every major step. Download an acknowledgement after submission. Selected applicants can view payment records, submit academic progress, and request renewal. All payment activity in this prototype is fictional.",
      },
      {
        title: "For officers and administrators",
        body: "Officers open their assigned queue, compare form answers with extracted evidence, and record a reasoned decision. Scheme administrators edit configuration and generate merit lists from officer-approved applications. Ministry administrators explore analytics, update the demo payment ledger, and verify audit history.",
      },
      {
        title: "Accessibility and language",
        body: "Use the language button for English or Hindi in the student workspace. Forms have labels, controls support keyboard focus, and the interface adapts to a small screen. Contact the prototype maintainers through your project repository if you find a barrier; no real government support channel is implied.",
      },
    ],
  },
};
export default async function Info({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const content = pages[page];
  if (!content) notFound();
  const Icon =
    page === "architecture"
      ? Network
      : page === "privacy"
        ? LockKeyhole
        : page === "impact"
          ? Route
          : page === "help"
            ? BookOpen
            : ShieldCheck;
  return (
    <div className="public-page">
      <PublicHeader />
      <main className="info-page">
        <span className="scheme-icon">
          <Icon size={25} />
        </span>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
        {page === "architecture" && (
          <div className="architecture-flow">
            {[
              ["Browser", "Student · officer · administrators"],
              ["Next.js", "Authentication · API routes"],
              ["Application services", "Workflow · rules · document AI"],
              ["PostgreSQL", "Records · evidence · audit"],
              ["Insights & communication", "Analytics · in-app notifications"],
            ].map(([title, subtitle]) => (
              <div className="architecture-node" key={title}>
                <strong>{title}</strong>
                <small>{subtitle}</small>
              </div>
            ))}
          </div>
        )}
        <div className="split-content" style={{ marginTop: 38 }}>
          {content.sections.map((s) => (
            <Panel key={s.title}>
              <section
                className="panel-body info-section"
                style={{ margin: 0 }}
              >
                <h2>{s.title}</h2>
                <p>{s.body}</p>
              </section>
            </Panel>
          ))}
        </div>
        <div style={{ marginTop: 30 }}>
          <Notice>
            JanVidya is an independent prototype for SIH problem statement
            26239. Demonstration information is not official government policy.
          </Notice>
        </div>
        <div className="row" style={{ marginTop: 28 }}>
          <Link href="/workspace" className="button">
            Open your workspace <ArrowRight size={15} />
          </Link>
          <Link href="/demo" className="text-button">
            Launch SIH Demo
          </Link>
        </div>
      </main>
    </div>
  );
}
