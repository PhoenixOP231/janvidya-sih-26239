import { describe, it, expect } from "vitest";
import { translate } from "../src/i18n/translate";
describe("whole-page localization", () => {
  it("covers public copy, server errors, rules and interpolated counts", () => {
    for (const text of [
      "One application.",
      "Income differs between the application and the document.",
      "The application deadline has passed.",
      "Showing 3 of 64 applications",
      "Minimum academic score 55%: 72 satisfies >= 55.",
      "· Personal information",
      "29 applications pending over 14 days",
    ]) {
      expect(translate(text, "hi")).not.toBe(text);
      expect(translate(text, "en")).toBe(text);
    }
  });
  it("keeps dates on the same day and preserves names and unknown content", () => {
    expect(translate("1 Apr 2026", "hi")).toBe("1 अप्रैल 2026");
    expect(translate("16 Sept 2026", "hi")).toBe("16 सित॰ 2026");
    expect(translate("Meera Kisku", "hi")).toBe("Meera Kisku");
    expect(translate("Custom applicant explanation", "hi")).toBe(
      "Custom applicant explanation",
    );
    expect(translate(" JV-2026-0001 ", "hi")).toBe(" JV-2026-0001 ");
  });
});
