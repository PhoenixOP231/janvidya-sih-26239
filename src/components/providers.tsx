"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { translate, type Language } from "@/i18n/translate";
const Context = createContext({
  language: "en",
  toggleLanguage: () => {},
  t: (s: string) => s,
  notice: (text: string, error?: boolean) => {
    void text;
    void error;
  },
});
export const useApp = () => useContext(Context);
export function Providers({
  children,
  initialLanguage = "en",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const translatedOnce = useRef(false);
  useEffect(() => {
    document.body.dataset.hydrated = "true";
    document.documentElement.lang = language;
    document.cookie = `janvidya-language=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem("janvidya-language", language);
    } catch {
      /* Cookies still preserve the preference. */
    }
  }, [language]);
  useEffect(() => {
    const originals = new WeakMap<Node, string>();
    const attributes = new WeakMap<Element, Map<string, string>>();
    let frame = 0;
    const excluded =
      "script,style,pre,code,svg,textarea,[translate='no'],[contenteditable],nextjs-portal";
    const update = () => {
      frame = 0;
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      );
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent =
          node.nodeType === Node.TEXT_NODE
            ? node.parentElement
            : (node as Element);
        if (!parent || parent.closest(excluded)) continue;
        if (node.nodeType === Node.TEXT_NODE) {
          const current = node.nodeValue || "";
          let original = originals.get(node);
          if (
            !original ||
            (current !== original && current !== translate(original, "hi"))
          ) {
            original = current;
            originals.set(node, original);
          }
          const next = translate(original, language);
          if (current !== next) node.nodeValue = next;
          continue;
        }
        const element = node as Element;
        if (element.tagName === "OPTION" && !element.hasAttribute("value")) {
          element.setAttribute("value", element.textContent || "");
        }
        let source = attributes.get(element);
        if (!source) {
          source = new Map();
          attributes.set(element, source);
        }
        for (const name of ["title", "placeholder", "aria-label", "alt"]) {
          const current = element.getAttribute(name);
          if (current === null) continue;
          let original = source.get(name);
          if (
            !original ||
            (current !== original && current !== translate(original, "hi"))
          ) {
            original = current;
            source.set(name, original);
          }
          const next = translate(original, language);
          if (current !== next) element.setAttribute(name, next);
        }
      }
      document.body.dataset.localized = language;
    };
    const schedule = () => {
      document.body.dataset.localized = "";
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new MutationObserver(schedule);
    const start = setTimeout(
      () => {
        translatedOnce.current = true;
        observer.observe(document.body, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        schedule();
      },
      translatedOnce.current ? 0 : 800,
    );
    return () => {
      clearTimeout(start);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [language]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider
      value={{
        language,
        toggleLanguage: () => setLanguage(language === "en" ? "hi" : "en"),
        t: (s) => translate(s, language),
        notice: (text, error = false) => setToast({ text, error }),
      }}
    >
      {children}
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast ${toast.error ? "toast-error" : ""}`}
        >
          <span>{translate(toast.text, language)}</span>
          <button
            aria-label={translate("Dismiss notification", language)}
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export async function api<T = Record<string, unknown>>(
  path: string,
  body: unknown = {},
): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: multipart ? undefined : { "Content-Type": "application/json" },
    body: multipart ? body : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Request failed. Please try again.");
  return data;
}
