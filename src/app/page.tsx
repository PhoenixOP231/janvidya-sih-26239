import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  Languages,
  FileCheck2,
  ScanLine,
  UserRoundCheck,
  SlidersHorizontal,
  ChartNoAxesCombined,
  BookOpen,
  Globe2,
  LockKeyhole,
  Leaf,
} from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { Logo, Text } from "@/components/ui";
export default function Home() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main>
        <section className="hero">
          <div>
            <div className="hero-label">
              <Leaf size={13} />
              Opportunity, made accessible
            </div>
            <h1>
              One application.
              <br />
              Smarter verification.
              <br />
              Faster scholarships.
            </h1>
            <p>
              A clearer path from ambition to opportunity. JanVidya brings
              applications, transparent verification, and scholarship support
              into one place.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="button large">
                <Text>Apply now</Text>
                <ArrowRight size={16} />
              </Link>
              <Link href="/demo" className="button large secondary">
                Launch SIH Demo <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="hero-foot">
              <ShieldCheck size={15} />
              Designed for Scheduled Tribe students. Built around trust.
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Illustrative application verification preview"
          >
            <div className="hero-orbit" />
            <div className="hero-window">
              <div className="window-header">
                <div>
                  <strong>A future in the making</strong>
                  <small>National Fellowship · Demonstration application</small>
                </div>
                <span className="badge status-submitted">
                  <i />
                  In review
                </span>
              </div>
              <div className="hero-applicant">
                <span className="avatar">MK</span>
                <div>
                  <strong>Meera Kisku</strong>
                  <small>
                    Research scholar · Jharkhand · Fictional profile
                  </small>
                </div>
              </div>
              <div className="verification-line">
                <CheckCircle2 size={16} />
                Application received<small>Complete</small>
              </div>
              <div className="verification-line">
                <FileCheck2 size={16} />
                Document evidence extracted<small>97% confidence</small>
              </div>
              <div className="verification-line">
                <ShieldCheck size={16} />
                Eligibility rules explained<small>Every step visible</small>
              </div>
              <div className="hero-bottom">
                <UserRoundCheck size={20} />
                <span>Your final decision belongs to a person.</span>
              </div>
            </div>
            <div className="floating-note">
              <GraduationCap size={26} />
              <div>
                More possibilities. Less paperwork.
                <small>Your education deserves a clear path.</small>
              </div>
            </div>
          </div>
        </section>
        <div className="public-trust">
          <span>
            <ShieldCheck size={20} />
            Human-led decisions
          </span>
          <span>
            <Languages size={20} />
            English & हिन्दी
          </span>
          <span>
            <FileCheck2 size={20} />
            Transparent verification
          </span>
          <span>
            <LockKeyhole size={20} />
            Privacy by design
          </span>
        </div>
        <section className="public-section" id="how-it-works">
          <div className="section-heading">
            <h2>
              Less uncertainty.
              <br />A clear next step, every time.
            </h2>
            <p>
              Register once. Follow your application from the first document to
              your next academic milestone.
            </p>
          </div>
          <div className="how-grid">
            {[
              [
                "01",
                "Find your opportunity",
                "Explore research fellowships and overseas scholarships. Preview the configured criteria before you apply.",
              ],
              [
                "02",
                "Make it your application",
                "A guided form asks for the details your scheme needs. Your progress is saved along the way.",
              ],
              [
                "03",
                "Get clarity, sooner",
                "Document checks surface missing information and differences, with clear steps to put them right.",
              ],
              [
                "04",
                "Keep moving forward",
                "Track officer decisions, selection, payment records, and renewals in one workspace.",
              ],
            ].map(([n, title, description]) => (
              <div className="how-step" key={n}>
                <span className="how-number">{n}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="public-dark">
          <div className="public-section">
            <div>
              <span className="callout-icon">
                <ScanLine size={26} />
              </span>
              <h2>
                Technology that assists.
                <br />
                People who decide.
              </h2>
              <p>
                AI helps read documents and find inconsistencies. Configurable
                rules explain eligibility. Authorized officers review the
                evidence and make the final decision.
              </p>
              <Link
                href="/about/responsible-ai"
                className="text-button"
                style={{ color: "#b2e2d1", marginTop: 25 }}
              >
                Explore our responsible AI approach <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="principles">
              {[
                {
                  icon: ScanLine,
                  title: "Every recommendation has evidence",
                  body: "See extracted values, confidence, and the fields behind each mismatch. Uncertain results always need a person.",
                },
                {
                  icon: SlidersHorizontal,
                  title: "Schemes change. The platform adapts.",
                  body: "Configure forms, document requirements, eligibility, and ranking without changing source code.",
                },
                {
                  icon: ShieldCheck,
                  title: "Every action leaves a trail",
                  body: "Application changes, officer decisions, and reasoned overrides are recorded in an append-only audit chain.",
                },
              ].map((p) => (
                <div className="principle" key={p.title}>
                  <span>
                    <p.icon size={22} />
                  </span>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="public-section" id="schemes">
          <div className="section-heading">
            <h2>
              Support for the path
              <br />
              you choose.
            </h2>
            <p>
              Two demonstration schemes, built to show what accessible
              scholarship management can feel like. Criteria are configurable,
              not official policy.
            </p>
          </div>
          <div className="scheme-grid">
            <div className="scheme-card">
              <div className="scheme-card-top">
                <span className="scheme-icon">
                  <BookOpen size={24} />
                </span>
                <span className="badge status-good">Demo scheme</span>
                <div className="scheme-code">NFST</div>
                <h2>
                  Your research.
                  <br />A stronger foundation.
                </h2>
              </div>
              <div className="scheme-card-body">
                <p>
                  A fellowship experience inspired by the National Fellowship
                  for Scheduled Tribe students, from research proposal to
                  progress reporting.
                </p>
                <Link href="/login" className="text-button">
                  Explore research fellowships <ArrowRight size={15} />
                </Link>
              </div>
            </div>
            <div className="scheme-card nos">
              <div className="scheme-card-top">
                <span className="scheme-icon">
                  <Globe2 size={24} />
                </span>
                <span className="badge status-submitted">Demo scheme</span>
                <div className="scheme-code">NOS</div>
                <h2>
                  Your ambitions.
                  <br />
                  Beyond borders.
                </h2>
              </div>
              <div className="scheme-card-body">
                <p>
                  An overseas study experience inspired by the National Overseas
                  Scholarship, with a guided process for university and
                  admission documents.
                </p>
                <Link href="/login" className="text-button">
                  Explore overseas scholarships <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section style={{ background: "#f6f9fa" }}>
          <div className="public-section">
            <div className="section-heading">
              <h2>
                A clearer picture.
                <br />
                From student to ministry.
              </h2>
              <p>
                Regional uptake, processing bottlenecks, officer workload, and
                disbursement records help administrators see where attention is
                needed.
              </p>
            </div>
            <div className="split-content">
              <div className="panel panel-body">
                <div className="row" style={{ marginBottom: 20 }}>
                  <ChartNoAxesCombined size={23} color="#087e70" />
                  <h3>From records to useful insight</h3>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.9 }}>
                  Filter fictional application data by state, district, scheme,
                  gender, institution, status, and date. Open the demonstration
                  dashboard to explore the underlying records.
                </p>
                <Link
                  className="text-button"
                  href="/demo"
                  style={{ marginTop: 22 }}
                >
                  Explore ministry analytics <ArrowUpRight size={15} />
                </Link>
              </div>
              <div className="panel panel-body">
                <h3>Less repetitive checking</h3>
                <div className="impact-path">
                  <span>Smart application</span>
                  <ArrowRight size={15} />
                  <span>Document checks</span>
                  <ArrowRight size={15} />
                  <span>Exception review</span>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.9, marginTop: 18 }}>
                  Earlier deficiency detection and visible status can reduce
                  clerical effort. These are intended benefits, not measured
                  government outcomes.
                </p>
                <Link
                  href="/about/impact"
                  className="text-button"
                  style={{ marginTop: 17 }}
                >
                  Compare the workflows <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="public-section">
          <div className="section-heading">
            <h2>
              A few things
              <br />
              you might want to know.
            </h2>
            <Link href="/about/help" className="text-button">
              Visit help & guidance <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="public-faq">
            {[
              [
                "Is JanVidya an official government portal?",
                "No. JanVidya is an independent Smart India Hackathon prototype for problem statement 26239. All accounts, applications, documents, scheme criteria, and payment records in the demonstration are fictional.",
              ],
              [
                "Will AI approve or reject my application?",
                "No. AI and rule checks provide evidence and recommendations. Only an authorized human officer makes the final decision. Officers must explain overrides, and every decision is recorded.",
              ],
              [
                "What happens if my document cannot be read?",
                "You will see which information could not be extracted and how to provide a clearer file. You can also request manual verification through application messages. Ambiguous text does not trigger automatic rejection.",
              ],
              [
                "Can I use the portal in Hindi or on my phone?",
                "Yes. The student workspace includes English and Hindi navigation, forms, status labels, notifications controls, and assistance. Layouts adapt to mobile, tablet, and desktop screens.",
              ],
              [
                "How is my information protected?",
                "Server-side authorization limits access by role and application ownership. Sessions use secure cookies, files are validated, and documents are served only to authorized users. Use fictional information in this prototype.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="public-cta">
          <h2>A better journey starts with one step.</h2>
          <p>
            Explore the full student, officer, and ministry experience in a
            guided demonstration.
          </p>
          <div
            className="row"
            style={{ justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link href="/demo" className="button large">
              Launch SIH Demo <ArrowRight size={16} />
            </Link>
            <Link href="/login?role=officer" className="button large secondary">
              Officer login
            </Link>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <div className="footer-columns">
          <div>
            <Logo />
            <p>
              A thoughtful approach to scholarship and fellowship management for
              Scheduled Tribe students.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <strong>Explore</strong>
              <Link href="/#schemes">Demo schemes</Link>
              <Link href="/demo">SIH demonstration</Link>
              <Link href="/login">Student portal</Link>
            </div>
            <div>
              <strong>Built with care</strong>
              <Link href="/about/responsible-ai">Responsible AI</Link>
              <Link href="/about/privacy">Privacy notice</Link>
              <Link href="/about/architecture">Architecture</Link>
            </div>
            <div>
              <strong>Get started</strong>
              <Link href="/register">Create an account</Link>
              <Link href="/login?role=officer">Officer login</Link>
              <Link href="/about/help">Help & guidance</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © 2026 JanVidya · Smart India Hackathon 26239 · Smart Education
          </span>
          <span>
            Independent prototype. Not an official government service.
          </span>
        </div>
      </footer>
    </div>
  );
}
