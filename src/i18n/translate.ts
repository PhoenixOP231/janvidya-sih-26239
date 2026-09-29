import { hi } from "./translations";
export type Language = "en" | "hi";
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const exact = new Map(
  Object.entries(hi).map(([key, value]) => [normalize(key), value]),
);
const templates = Object.entries(hi)
  .filter(([key]) => /\{\w+\}/.test(key))
  .map(([key, value]) => {
    const names: string[] = [];
    const pattern = normalize(key)
      .split(/(\{\w+\})/)
      .map((part) => {
        if (/^\{\w+\}$/.test(part)) {
          names.push(part.slice(1, -1));
          return "(.+?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    return { pattern: new RegExp(`^${pattern}$`), names, value };
  });
/** Translate UI copy only. Unknown, user-authored content stays unchanged. */
export function translate(text: string, language: string): string {
  if (language !== "hi" || !text.trim()) return text;
  const key = normalize(text);
  let result = exact.get(key);
  if (!result)
    for (const template of templates) {
      const match = key.match(template.pattern);
      if (match) {
        result = template.value.replace(/\{(\w+)\}/g, (_, name) => {
          const value = match[template.names.indexOf(name) + 1];
          return translate(value, language);
        });
        break;
      }
    }
  // Dates are produced by the server in a stable locale; localize month names on display.
  const date = key.match(/^(\d{1,2}) ([A-Z][a-z]{2,3}) (\d{4})$/);
  if (!result && date) {
    result = `${date[1]} ${exact.get(date[2]) || date[2]} ${date[3]}`;
  }
  if (!result) {
    const prefixed = key.match(/^([·•]\s+)(.+)$/);
    if (prefixed) {
      const translated = translate(prefixed[2], language);
      if (translated !== prefixed[2]) result = prefixed[1] + translated;
    }
  }
  if (!result) {
    for (const separator of [" · ", "; ", ": ", ", "]) {
      if (key.includes(separator)) {
        const parts = key.split(separator);
        const translated = parts.map((part) => translate(part, language));
        if (translated.some((part, i) => part !== parts[i])) {
          result = translated.join(separator);
          break;
        }
      }
    }
  }
  if (!result) return text;
  return `${text.match(/^\s*/)?.[0] || ""}${result}${text.match(/\s*$/)?.[0] || ""}`;
}
