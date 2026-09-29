import { LanguageToggle } from "@/components/public-header";
import { Logo } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
import { ShieldCheck, FileCheck2, GraduationCap } from "lucide-react";
import { demoEnabled } from "@/server/db";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="auth-page">
      <aside className="auth-art">
        <Logo />
        <div className="auth-copy">
          <h1>
            More clarity.
            <br />
            More possibility.
          </h1>
          <p>
            Your education deserves a process you can understand. One profile.
            Clear requirements. Every step visible.
          </p>
          <div className="auth-points">
            <span>
              <FileCheck2 size={18} />
              Guided applications and document checks
            </span>
            <span>
              <ShieldCheck size={18} />
              Explainable rules. Human decisions.
            </span>
            <span>
              <GraduationCap size={18} />
              Support beyond selection
            </span>
          </div>
        </div>
        <small style={{ fontSize: 9, color: "#8ba7b8" }}>
          Independent SIH 26239 prototype · Fictional demo information
        </small>
      </aside>
      <section className="auth-form-side">
        <div className="auth-language">
          <LanguageToggle />
        </div>
        <AuthForm officer={params.role === "officer"} demo={demoEnabled()} />
      </section>
    </div>
  );
}
