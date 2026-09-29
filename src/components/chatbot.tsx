"use client";
import { Localize } from "@/components/localize";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { api, useApp } from "./providers";
export function Chatbot() {
  const { language, t } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<
    { role: string; text: string; href?: string }[]
  >([]);
  async function send(question: string) {
    if (!question.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setText("");
    setBusy(true);
    try {
      const result = await api<{ answer: string; href: string }>("chat", {
        question,
        language,
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: result.answer, href: result.href },
      ]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: (error as Error).message },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Localize>
      <>
        {open && (
          <section className="chat-panel" aria-label={t("JanVidya Assistant")}>
            <div className="chat-head">
              <Sparkles size={20} />
              <div>
                <strong>{t("JanVidya Assistant")}</strong>
                <small>
                  {language === "hi"
                    ? "स्थानीय ज्ञान आधार"
                    : "Your application companion"}
                </small>
              </div>
              <button
                className="icon-button"
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="chat-body" aria-live="polite">
              <p>
                {language === "hi"
                  ? "नमस्ते! मैं आवेदन, दस्तावेज़ और स्थिति समझने में मदद कर सकता हूँ।"
                  : "Hello! I can help with your application, documents, and next steps."}
              </p>
              {messages.map((m, i) => (
                <div key={i} className={`chat-message ${m.role}`}>
                  {m.text}
                  {m.href && (
                    <Link href={m.href} onClick={() => setOpen(false)}>
                      {t("View details")}
                    </Link>
                  )}
                </div>
              ))}
              {busy && <div className="muted">{t("Please wait…")}</div>}
            </div>
            <div className="chat-suggestions">
              {[
                "How do I apply?",
                "What is my status?",
                "Which documents do I need?",
                "Explain eligibility",
              ].map((q) => (
                <button key={q} onClick={() => send(t(q))}>
                  {t(q)}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
              className="chat-form"
            >
              <input
                aria-label={t("Ask a question")}
                placeholder={t("Ask a question")}
                value={text}
                maxLength={500}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                disabled={busy || !text.trim()}
                aria-label="Send question"
              >
                <Send size={18} />
              </button>
            </form>
            <small className="chat-disclaimer">
              {language === "hi"
                ? "डेमो जानकारी। आधिकारिक सरकारी नीति नहीं।"
                : "Demo guidance. Not official government policy."}
            </small>
          </section>
        )}
        <button
          className="chat-launcher"
          aria-label={t("JanVidya Assistant")}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={21} /> : <MessageCircle size={21} />}
          <span>{t("JanVidya Assistant")}</span>
        </button>
      </>
    </Localize>
  );
}
