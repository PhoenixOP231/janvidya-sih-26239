import { LanguageToggle } from "@/components/public-header";
import { Logo } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
import { demoEnabled } from "@/server/db";
export default function Register() {
  return (
    <div className="auth-page">
      <aside className="auth-art">
        <Logo />
        <div className="auth-copy">
          <h1>
            One profile.
            <br />A world of opportunity.
          </h1>
          <p>
            Start with your details. Find a scheme that fits. Let your education
            be the focus.
          </p>
        </div>
        <small>
          Fictional demonstration · Please do not enter real sensitive data.
        </small>
      </aside>
      <section className="auth-form-side">
        <div className="auth-language">
          <LanguageToggle />
        </div>
        <AuthForm register demo={demoEnabled()} />
      </section>
    </div>
  );
}
