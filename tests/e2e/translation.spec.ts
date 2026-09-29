import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

test("Hindi covers public and role pages and preserves in-progress input", async ({
  page,
}) => {
  test.setTimeout(120000);
  const leftovers: Record<string, string[]> = {};
  async function inspect(path: string) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(page.locator("body")).toHaveAttribute("data-localized", "hi");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(
      page.getByText("यह पृष्ठ लोड नहीं हो सका।", { exact: true }),
    ).toHaveCount(0);
    leftovers[path] = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const result = new Set<string>();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const el = node.parentElement;
        const text = node.textContent?.trim() || "";
        if (
          el?.checkVisibility() &&
          !el.closest('script,style,pre,code,textarea,[translate="no"],nextjs-portal') &&
          /[A-Za-z]{3}/.test(text) &&
          !/[\u0900-\u097F]/.test(text)
        )
          result.add(text);
      }
      return [...result];
    });
  }
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.locator("body")).toHaveAttribute("data-localized", "hi");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "एक आवेदन।",
  );
  for (const path of [
    "/",
    "/about/help",
    "/about/privacy",
    "/about/responsible-ai",
    "/about/architecture",
    "/about/impact",
    "/login",
    "/register",
    "/demo",
  ])
    await inspect(path);
  for (const role of ["student", "officer", "scheme_admin", "ministry_admin"]) {
    const response = await page.request.post("/api/auth/demo", {
      data: { role },
      headers: { Origin: "http://127.0.0.1:3100" },
    });
    expect(response.status()).toBe(200);
    for (const path of [
      "/workspace",
      "/applications",
      "/schemes",
      "/payments",
      "/notifications",
      "/profile",
    ])
      await inspect(path);
    if (role === "student") {
      await inspect("/applications/JV-2026-0064");
      await page.getByLabel("मोबाइल नंबर").fill("DEMO-HINDI-PRESERVED");
      await page.getByRole("button", { name: "English", exact: true }).click();
      await expect(page.getByLabel("Mobile number")).toHaveValue(
        "DEMO-HINDI-PRESERVED",
      );
      await page.getByRole("tab", { name: "Documents", exact: true }).click();
      await page
        .getByRole("tab", { name: "Application details", exact: true })
        .click();
      await expect(page.getByLabel("Mobile number")).toHaveValue(
        "DEMO-HINDI-PRESERVED",
      );
      await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
      await page.getByRole("tab", { name: "दस्तावेज़", exact: true }).click();
      await expect(
        page.getByText("दस्तावेज़ अपलोड करें").first(),
      ).toBeVisible();
      await page.getByRole("tab", { name: "पात्रता", exact: true }).click();
      await expect(page.getByText(/शर्त पूरी/).first()).toBeVisible();
      await page.goto("/workspace");
      await expect(page.locator("body")).toHaveAttribute("data-localized", "hi");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "आपकी नई यात्रा यहाँ से शुरू होती है।",
      );
      await page.screenshot({
        path: "docs/screenshots/student-hindi.png",
        fullPage: true,
      });
    }
    if (role === "scheme_admin")
      for (const path of ["/schemes/nfst", "/merit"]) await inspect(path);
    if (role === "ministry_admin")
      for (const path of ["/analytics", "/audit"]) await inspect(path);
  }
  writeFileSync(
    "test-results/hindi-visible-copy.json",
    JSON.stringify(leftovers, null, 2),
  );
});
