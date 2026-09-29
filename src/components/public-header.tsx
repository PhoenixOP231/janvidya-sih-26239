"use client";
import { Localize } from "@/components/localize";

import Link from "next/link";
import { Languages } from "lucide-react";
import { Logo } from "./ui";
import { useApp } from "./providers";
export function LanguageToggle() {
  const { language, toggleLanguage } = useApp();
  return (
    <button className="language-button" onClick={toggleLanguage}>
      <Languages size={17} />
      {language === "en" ? "हिन्दी" : "English"}
    </button>
  );
}
export function PublicHeader() {
  const { language, toggleLanguage, t } = useApp();
  return (
    <Localize>
      <>
        <div className="gov-strip">
          <span>Smart India Hackathon 2026 · Problem Statement 26239</span>
          <span>
            Ministry of Tribal Affairs challenge · Independent prototype
          </span>
        </div>
        <header className="public-header">
          <Logo />
          <nav className="public-nav" aria-label="Public navigation">
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#schemes">Scholarships</Link>
            <Link href="/about/responsible-ai">Our approach</Link>
            <button className="language-button" onClick={toggleLanguage}>
              <Languages size={17} />
              {language === "en" ? "हिन्दी" : "English"}
            </button>
            <Link href="/login" className="button navy">
              {t("Apply now")}
            </Link>
          </nav>
        </header>
      </>
    </Localize>
  );
}
