import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
const origin = "http://127.0.0.1:3100";
async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-localized", "en");
}
async function post(
  request: APIRequestContext,
  path: string,
  data: unknown = {},
) {
  return request.post(`/api/${path}`, { data, headers: { Origin: origin } });
}
test("landing, demo login, Hindi and mobile navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "One application.",
  );
  await page
    .getByRole("link", { name: "Launch SIH Demo", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/demo/);
  await page.getByRole("button", { name: /^Student Apply/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your next chapter starts here." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "आपकी नई यात्रा यहाँ से शुरू होती है।",
  );
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.screenshot({
    path: "docs/screenshots/student-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open menu", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("link", { name: "My applications", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My applications", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > innerWidth &&
          !e.closest(".table-scroll"),
      )
      .map((e) => ({
        tag: e.tagName,
        cls: e.className,
        right: e.getBoundingClientRect().right,
      }))
      .slice(0, 15),
  }));
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.width,
  );
  await page.screenshot({
    path: "docs/screenshots/student-mobile.png",
    fullPage: true,
  });
});
test("credentials sign in for all four roles and authorization rejects unrelated records", async ({
  request,
}) => {
  for (const email of [
    "student@janvidya.demo",
    "officer@janvidya.demo",
    "schemeadmin@janvidya.demo",
    "admin@janvidya.demo",
  ]) {
    const response = await post(request, "auth/login", {
      email,
      password: "JanVidyaDemo!2026",
    });
    expect(response.status()).toBe(200);
  }
  await post(request, "auth/demo", { role: "student" });
  expect(
    (
      await post(request, "applications/JV-2026-0002/save", {
        data: { fullName: "Unauthorized" },
        version: 1,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(request, "applications/JV-2026-0001/decision", {
        action: "approve",
        reason: "Unauthorized test decision",
        override: true,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/profile", {
        data: { data: { fullName: "Forged origin" } },
        headers: { Origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
  await post(request, "auth/logout");
  expect((await request.get("/api/session")).status()).toBe(401);
});
test("new application, autosave, document OCR, submission and acknowledgement", async ({
  page,
}) => {
  const request = page.request;
  await post(request, "auth/demo", { role: "student" });
  await page.goto("/schemes");
  await page
    .getByRole("button", { name: "Apply now", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/applications\/JV-/);
  const applicationId = page.url().split("/").at(-1)!;
  await page.getByLabel("Mobile number").fill("DEMO-E2E-NEW");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Annual family income (INR)")).toBeVisible();
  await page.getByLabel("Annual family income (INR)").fill("225000");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Research title")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Use clean demo documents", exact: true })
    .click();
  await expect(
    page.getByText("Fictional demo documents loaded and processed"),
  ).toBeVisible();
  await expect(
    page.getByText("demo-income.pdf", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("96%", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByText("Ready for review", { exact: true }),
  ).toBeVisible();
  const ack = await request.get(
    `/api/applications/${applicationId}/acknowledgement`,
  );
  expect(ack.headers()["content-type"]).toBe("application/pdf");
  expect((await ack.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.reload();
  await expect(page.getByText("225000", { exact: true }).first()).toBeVisible();
});
test("deficiency correction, reasoned officer override, evidence and messages", async ({
  page,
}) => {
  const request = page.request;
  await post(request, "auth/demo", { role: "student" });
  await page.goto("/applications/JV-2026-0001");
  await ready(page);
  await expect(
    page.getByText("Income differs between the application and the document.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Documents", exact: true }).click();
  await page
    .getByRole("button", { name: "Use clean demo documents", exact: true })
    .click();
  await expect(
    page.getByText("Fictional demo documents loaded and processed"),
  ).toBeVisible();
  await page.getByRole("tab", { name: /^Messages/ }).click();
  await page
    .getByLabel("Write your message")
    .fill("Corrected fictional certificate uploaded for review.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Corrected fictional certificate uploaded for review.", {
      exact: true,
    }),
  ).toBeVisible();
  await post(request, "auth/demo", { role: "officer" });
  await page.goto("/applications/JV-2026-0006");
  await ready(page);
  await expect(
    page.getByRole("heading", {
      name: "Entered details vs. document evidence",
    }),
  ).toBeVisible();
  await page
    .getByLabel("Reason / comments")
    .fill(
      "Fictional exception verified against the supplied evidence and recorded for review.",
    );
  await page
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  await expect(page.locator(".form-error[role='alert']")).toContainText(
    "Enable the reasoned override",
  );
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  await expect(
    page.getByText("Approved", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/officer-evidence.png",
    fullPage: true,
  });
});
test("scheme configuration, merit generation and publication", async ({
  page,
}) => {
  const request = page.request;
  await post(request, "auth/demo", { role: "scheme_admin" });
  await page.goto("/schemes/nfst");
  await ready(page);
  await page.getByLabel("Total selection quota").fill("14");
  await page
    .getByRole("button", { name: "Save scheme configuration", exact: true })
    .click();
  await expect(
    page.getByText("Scheme configuration saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await ready(page);
  await expect(page.getByLabel("Total selection quota")).toHaveValue("14");
  await page.goto("/merit");
  await ready(page);
  await page
    .getByRole("button", { name: "Generate merit list", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Proposed ranking" }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Publish selection", exact: true })
    .click();
  await expect(
    page.getByText(/This selection has been published/),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Export CSV" })
    .getAttribute("href");
  const csv = await request.get(href!);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Applicant");
});
test("ministry analytics, filters, audit integrity and local assistant", async ({
  page,
}) => {
  const request = page.request;
  await post(request, "auth/demo", { role: "ministry_admin" });
  await page.goto("/workspace");
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Opportunity, in perspective." }),
  ).toBeVisible();
  await expect(page.locator(".recharts-area path").first()).toHaveAttribute(
    "d",
    /^M/,
  );
  await page.screenshot({
    path: "docs/screenshots/ministry-dashboard.png",
    fullPage: true,
  });
  await page.goto("/analytics");
  await ready(page);
  await page
    .getByRole("combobox", { name: "State", exact: true })
    .selectOption("Jharkhand");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/state=Jharkhand/);
  await expect(
    page.getByRole("combobox", { name: "State", exact: true }),
  ).toHaveValue("Jharkhand");
  await page.goto("/audit");
  await ready(page);
  await expect(
    page.getByText("Audit chain verified", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "JanVidya Assistant", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explain eligibility", exact: true })
    .click();
  await expect(
    page.getByText(/These are configurable demonstration rules/),
  ).toBeVisible();
});
test("registration and profile changes persist", async ({ page }) => {
  await page.goto("/register");
  await ready(page);
  await page
    .getByLabel("Full name", { exact: true })
    .fill("Fictional New Scholar");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`new-scholar-${Date.now()}@janvidya.demo`);
  await page
    .getByLabel("Password", { exact: false })
    .fill("FictionalTest!Password2026");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/workspace/);
  await page.goto("/profile");
  await ready(page);
  await page.getByLabel("District", { exact: true }).fill("Fictional district");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("District", { exact: true })).toHaveValue(
    "Fictional district",
  );
});
