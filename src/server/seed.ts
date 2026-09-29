import { randomUUID } from "node:crypto";
import * as t from "@/db/schema";
import type { DB } from "./db";
import { demoSchemes } from "@/config/schemes";
import type { Analysis, FormData, Status } from "@/lib/domain";
import { hashPassword } from "./password";
import { audit } from "./audit";
import { evaluateEligibility } from "@/lib/rules";
import {
  compareFields,
  documentIssues,
  fieldLabels,
} from "@/lib/document-analysis";
import { makeFixture, documentHash } from "./documents";
export const demoPassword = "JanVidyaDemo!2026";
export const studentData: FormData = {
  fullName: "Meera Kisku",
  dob: "2001-06-18",
  age: 25,
  gender: "Female",
  category: "Scheduled Tribe",
  email: "student@janvidya.demo",
  phone: "DEMO-PHONE-001",
  state: "Jharkhand",
  district: "Ranchi",
  familyIncome: 210000,
  academicScore: 88.4,
  institution: "Fictional Birsa Research Institute",
  course: "PhD",
  applicationYear: 2026,
  bankLast4: "0001",
  ifsc: "DEMO0000001",
  researchTitle: "Community-led forest knowledge systems",
  supervisor: "Dr. Ananya Sen (fictional)",
  researchScore: 84,
  university: "Fictional Northbridge University",
  country: "United Kingdom",
  offerStatus: "Unconditional",
};
const places = [
  ["Jharkhand", "Ranchi"],
  ["Odisha", "Mayurbhanj"],
  ["Chhattisgarh", "Bastar"],
  ["Madhya Pradesh", "Jhabua"],
  ["Maharashtra", "Gadchiroli"],
  ["Rajasthan", "Banswara"],
  ["Assam", "Karbi Anglong"],
  ["Meghalaya", "West Garo Hills"],
];
const names = [
  "Meera Kisku",
  "Aarav Munda",
  "Kavya Soren",
  "Rohan Gond",
  "Nisha Bhil",
  "Devika Oraon",
  "Arjun Marak",
  "Anita Murmu",
  "Vivek Hembram",
  "Priya Tirkey",
  "Kiran Gamit",
  "Tara Kharia",
];
const system = {
  id: "system",
  name: "JanVidya verification",
  role: "ministry_admin" as const,
};
export async function seedDatabase(db: DB) {
  if ((await db.select({ id: t.users.id }).from(t.users).limit(1)).length)
    return;
  const passwordHash = hashPassword(demoPassword);
  await db.transaction(async (tx) => {
    await tx
      .insert(t.auditHead)
      .values({ id: 1, hash: "GENESIS" })
      .onConflictDoNothing();
    await tx.insert(t.users).values([
      {
        id: "demo-student",
        name: "Meera Kisku",
        email: "student@janvidya.demo",
        passwordHash,
        role: "student",
        demo: true,
      },
      {
        id: "demo-officer",
        name: "Ananya Sharma",
        email: "officer@janvidya.demo",
        passwordHash,
        role: "officer",
        demo: true,
      },
      {
        id: "demo-scheme",
        name: "Vikram Rao",
        email: "schemeadmin@janvidya.demo",
        passwordHash,
        role: "scheme_admin",
        demo: true,
      },
      {
        id: "demo-admin",
        name: "Priya Menon",
        email: "admin@janvidya.demo",
        passwordHash,
        role: "ministry_admin",
        demo: true,
      },
    ]);
    await tx.insert(t.officers).values({
      userId: "demo-officer",
      designation: "Senior scrutiny officer",
      region: "All demonstration states",
    });
    await tx
      .insert(t.profiles)
      .values({ userId: "demo-student", data: studentData });
    for (let i = 0; i < places.length; i++) {
      await tx
        .insert(t.states)
        .values({ id: `state-${i}`, name: places[i][0] });
      await tx.insert(t.districts).values({
        id: `district-${i}`,
        name: places[i][1],
        stateId: `state-${i}`,
      });
      await tx.insert(t.institutions).values({
        id: `institution-${i}`,
        name: `Fictional ${places[i][1]} Research Institute`,
        districtId: `district-${i}`,
      });
    }
    for (const scheme of demoSchemes) {
      await tx.insert(t.schemes).values(scheme);
      await tx.insert(t.schemeRules).values(
        scheme.config.rules.map((rule) => ({
          id: `${scheme.id}-${rule.id}`,
          schemeId: scheme.id,
          rule,
        })),
      );
      await tx.insert(t.requirements).values(
        scheme.config.documents.map((requirement) => ({
          id: `${scheme.id}-${requirement.key}`,
          schemeId: scheme.id,
          requirement,
        })),
      );
    }
    const cycle: Status[] = [
      "approved",
      "ready_for_review",
      "disbursed",
      "selected",
      "deficiency_raised",
      "under_scrutiny",
      "approved",
      "rejected",
      "payment_processing",
      "waitlisted",
      "renewal_due",
      "clarification_required",
    ];
    for (let i = 0; i < 64; i++) {
      const userId =
        i === 0 || i === 62 || i === 63
          ? "demo-student"
          : `sample-student-${i}`;
      const id = `JV-2026-${String(i + 1).padStart(4, "0")}`;
      const name =
        i === 0 || i > 61
          ? "Meera Kisku"
          : `${names[i % names.length]}${i > 11 ? ` ${String.fromCharCode(65 + Math.floor(i / 12))}` : ""}`;
      if (userId !== "demo-student")
        await tx.insert(t.users).values({
          id: userId,
          name,
          email: `fictional-${i}@janvidya.demo`,
          passwordHash: "disabled",
          role: "student",
          demo: true,
        });
      const scheme = demoSchemes[i === 63 || (i > 5 && i % 4 === 0) ? 1 : 0];
      const place = places[i % places.length];
      const data: FormData = {
        ...studentData,
        fullName: name,
        email:
          i === 0 || i > 61
            ? studentData.email
            : `fictional-${i}@janvidya.demo`,
        phone: `DEMO-PHONE-${i}`,
        state: place[0],
        district: place[1],
        academicScore: i === 0 ? 88.4 : 58 + ((i * 7) % 40),
        familyIncome: i === 0 ? 210000 : 110000 + ((i * 19500) % 480000),
        gender: i % 2 ? "Male" : "Female",
        researchScore: 60 + ((i * 3) % 39),
        bankLast4: String(i + 1).padStart(4, "0"),
        institution: `Fictional ${place[1]} Research Institute`,
      };
      if (i === 0 || i > 61) Object.assign(data, studentData);
      if (i === 62) data.applicationYear = 2025;
      let status: Status =
        i < 6
          ? i === 1 || i === 4 || i === 5
            ? "ready_for_review"
            : "deficiency_raised"
          : cycle[i % cycle.length];
      if (i === 62) status = "disbursed";
      if (i === 63) status = "draft";
      if (i === 5) data.familyIncome = 640000;
      const result = evaluateEligibility(scheme.config.rules, data);
      const createdAt = new Date(
        Date.UTC(2026, 3 + Math.floor(i / 12), 1 + (i % 24), 9),
      );
      const duplicates =
        i === 4
          ? [
              {
                applicationId: "JV-2026-0017",
                score: 75,
                reasons: [
                  "Matching fictional certificate identifier (seeded demonstration signal)",
                ],
              },
            ]
          : [];
      await tx.insert(t.applications).values({
        id,
        userId,
        schemeId: scheme.id,
        officerId: "demo-officer",
        status,
        data,
        schemeSnapshot: scheme.config,
        schemeVersion: 1,
        eligible: result.eligible,
        confidence: i === 3 ? 62 : i === 63 ? 0 : 92 + (i % 7),
        recommendation:
          i === 0
            ? "Income differs from the uploaded certificate. Officer verification required."
            : i === 5
              ? "Configured income threshold exceeded. A reasoned officer override is required."
              : i === 4
                ? "Potential duplicate signal. Verify before making a decision."
                : i === 2
                  ? "Tribe certificate missing. Student response required."
                  : i === 3
                    ? "Low OCR confidence. Manual verification recommended."
                    : "Configured eligibility checks passed. An officer makes the final decision.",
        duplicates,
        createdAt,
        updatedAt: createdAt,
        submittedAt: status === "draft" ? null : createdAt,
        decidedAt: [
          "approved",
          "selected",
          "disbursed",
          "rejected",
          "payment_processing",
          "renewal_due",
        ].includes(status)
          ? new Date(createdAt.getTime() + 3 * 86400000)
          : null,
      });
      const checkId = randomUUID();
      await tx.insert(t.eligibilityChecks).values({
        id: checkId,
        applicationId: id,
        eligible: result.eligible,
        schemeVersion: 1,
      });
      await tx
        .insert(t.eligibilityResults)
        .values(
          result.results.map((r) => ({ id: randomUUID(), checkId, result: r })),
        );
      if (i < 6) {
        const docRows: { category: string; analysis: Analysis }[] = [];
        for (const requirement of scheme.config.documents.filter(
          (d) => d.required && !(i === 2 && d.key === "category"),
        )) {
          const values: FormData = {
            ...data,
            certificateId: `DEMO-${i}-${requirement.key}`,
            validUntil: "2027-12-31",
          };
          if (i === 0 && requirement.key === "income")
            values.familyIncome = 360000;
          const fields = requirement.fields.map((field) => ({
            field,
            value: values[field] as string | number,
            confidence: i === 3 ? 62 : 97,
            evidence: `${fieldLabels[field] || field}: ${values[field]}`,
          }));
          const analysis: Analysis = {
            provider: "Fictional seeded document fixture",
            classification: requirement.key,
            confidence: i === 3 ? 62 : 97,
            quality: i === 3 ? "review" : "good",
            fields,
            mismatches: compareFields(data, fields),
            signals: [],
            processedAt: createdAt.toISOString(),
            explanation:
              "Demonstration fixture extraction. Real uploaded files use the document processing pipeline.",
          };
          const bytes = await makeFixture(
            requirement,
            data,
            i === 0 && requirement.key === "income" ? "mismatch" : "clean",
          );
          const docId = randomUUID(),
            key = `seed/${docId}.pdf`,
            ocrId = randomUUID();
          await tx.insert(t.storageObjects).values({
            key,
            body: bytes.toString("base64"),
            mime: "application/pdf",
          });
          await tx.insert(t.documents).values({
            id: docId,
            applicationId: id,
            category: requirement.key,
            filename: `demo-${requirement.key}.pdf`,
            mime: "application/pdf",
            size: bytes.length,
            hash: documentHash(bytes),
            storageKey: key,
            analysis,
          });
          await tx.insert(t.ocrResults).values({
            id: ocrId,
            documentId: docId,
            provider: analysis.provider,
            confidence: analysis.confidence,
            result: analysis,
          });
          await tx
            .insert(t.extractedFields)
            .values(
              fields.map((field) => ({ id: randomUUID(), ocrId, field })),
            );
          docRows.push({ category: requirement.key, analysis });
        }
        const issues = documentIssues(
          scheme.config.documents,
          docRows,
          scheme.config.confidenceThreshold,
        );
        if (issues.length)
          await tx.insert(t.deficiencies).values(
            issues.map((issue) => ({
              id: randomUUID(),
              applicationId: id,
              documentCategory: issue.category,
              kind: issue.kind,
              issue: issue.issue,
              action: issue.action,
              deadline: new Date("2026-10-15T00:00:00Z"),
            })),
          );
      } else if (status === "deficiency_raised")
        await tx.insert(t.deficiencies).values({
          id: randomUUID(),
          applicationId: id,
          documentCategory: "income",
          kind: "missing",
          issue: "Income certificate is missing",
          action: "Upload a valid income certificate.",
          deadline: new Date("2026-10-15T00:00:00Z"),
        });
      if (
        ["selected", "payment_processing", "disbursed", "renewal_due"].includes(
          status,
        )
      )
        await tx.insert(t.payments).values({
          id: `PAY-${i + 1}`,
          applicationId: id,
          amount: scheme.award,
          status:
            status === "disbursed" || status === "renewal_due"
              ? "disbursed"
              : status === "payment_processing"
                ? "processing"
                : "scheduled",
          installment: "First installment",
          reference: status === "disbursed" ? `DEMO-UTR-${i}` : null,
          createdAt,
        });
      if (status === "disbursed" || status === "renewal_due")
        await tx.insert(t.renewals).values({
          id: `REN-${i}`,
          applicationId: id,
          year: "2027–28",
          status: "due",
          dueDate: "2027-03-31",
        });
      if (status === "rejected")
        await tx.insert(t.decisions).values({
          id: randomUUID(),
          applicationId: id,
          officerId: "demo-officer",
          decision: "reject",
          reason:
            "Required academic evidence could not be verified after clarification (fictional scenario).",
        });
      await audit(
        tx,
        system,
        "Application seeded",
        id,
        "Fictional demonstration record",
        null,
        { status },
      );
      if (i < 6) {
        await audit(
          tx,
          system,
          "Rule evaluation",
          id,
          "Demo scheme criteria evaluated",
          null,
          { eligible: result.eligible },
        );
        await audit(
          tx,
          system,
          "AI recommendation",
          id,
          "Evidence routed for human review",
          null,
          { status },
        );
      }
    }
    await tx.insert(t.notifications).values([
      {
        id: randomUUID(),
        userId: "demo-student",
        title: "Your application needs one correction",
        body: "Your income certificate and entered income differ. Review the evidence, then send your correction.",
        href: "/applications/JV-2026-0001",
      },
      {
        id: randomUUID(),
        userId: "demo-student",
        title: "First installment disbursed",
        body: "Your fictional fellowship payment has been recorded. View the payment reference in your payment tracker.",
        href: "/payments",
      },
      {
        id: randomUUID(),
        userId: "demo-officer",
        title: "Six demo cases ready to explore",
        body: "Clean, mismatch, missing, low-confidence, duplicate and override cases are available.",
        href: "/applications",
      },
    ]);
    await tx.insert(t.messages).values({
      id: randomUUID(),
      applicationId: "JV-2026-0001",
      senderId: "demo-officer",
      body: "Please verify the annual income on your certificate. You can upload a corrected certificate and resubmit here.",
    });
    await audit(
      tx,
      system,
      "Demo initialized",
      "system",
      "64 fictional applications and four demo accounts created.",
    );
  });
}
