import { and, desc, eq } from "drizzle-orm";
import { applications, deficiencies, schemes } from "@/db/schema";
import { getDb } from "./db";
import { statusLabels, type Actor } from "@/lib/domain";
export async function answerQuestion(
  actor: Actor,
  question: string,
  language: string,
) {
  const db = await getDb();
  const [app] = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, actor.id))
    .orderBy(desc(applications.updatedAt))
    .limit(1);
  const list = await db.select().from(schemes);
  const q = question.toLowerCase();
  let answer =
    "Start in Find a scheme, review the demonstration criteria, then create an application. Your form saves automatically. Upload all required documents, accept the declaration, and submit for verification.";
  let href = "/schemes";
  if (/status|track|स्थिति/.test(q)) {
    answer = app
      ? `${app.id} is ${statusLabels[app.status]}. ${app.recommendation}`
      : "You have no applications yet. Find a scheme to begin.";
    href = app ? `/applications/${app.id}` : "/schemes";
  } else if (/deficien|wrong|missing|correction|कमी/.test(q)) {
    const issues = app
      ? await db
          .select()
          .from(deficiencies)
          .where(
            and(
              eq(deficiencies.applicationId, app.id),
              eq(deficiencies.resolved, false),
            ),
          )
      : [];
    answer = issues.length
      ? issues.map((d) => `${d.issue} ${d.action}`).join("\n")
      : "No open deficiencies on your most recent application. You can check the application timeline for updates.";
    href = app ? `/applications/${app.id}` : "/applications";
  } else if (/document|upload|दस्तावेज/.test(q)) {
    answer =
      "NFST demo requires a tribe certificate, income certificate and academic transcript. NOS also requires an offer letter. Upload PDF, JPG or PNG files up to 3 MB. Scans without reliable OCR are sent to an officer.";
  } else if (/deadline|date|अंतिम/.test(q)) {
    answer = list
      .map((s) => `${s.code}: ${s.deadline} (configured demo deadline).`)
      .join(" ");
  } else if (/eligib|income|policy|पात्र/.test(q)) {
    answer =
      "These are configurable demonstration rules, not official policy. The seeded criteria check Scheduled Tribe category, age 18–35, academic score of at least 55%, and income at most ₹6,00,000. Each application shows its exact rule results. Officers decide exceptional cases.";
  } else if (/payment|money|भुगतान/.test(q)) {
    answer =
      "Open Payments & renewals to see scheduled and recorded installments. This prototype tracks a fictional payment ledger; it does not transfer funds.";
    href = "/payments";
  }
  if (language === "hi") {
    if (/status|स्थिति/.test(q))
      answer = app
        ? `${app.id}: ${statusLabels[app.status]}। आवेदन विवरण में सत्यापन और समयरेखा देखें।`
        : "अभी कोई आवेदन नहीं है। शुरू करने के लिए योजना चुनें।";
    else if (/deadline|date|अंतिम/.test(q))
      answer = list
        .map((s) => `${s.code}: ${s.deadline} (डेमो अंतिम तिथि)`)
        .join("। ");
    else if (/document|upload|दस्तावेज/.test(q))
      answer =
        "जनजाति प्रमाणपत्र, आय प्रमाणपत्र और अंकपत्र अपलोड करें। NOS के लिए प्रवेश पत्र भी आवश्यक है। PDF, JPG या PNG, अधिकतम 3 MB। अस्पष्ट दस्तावेज़ की जाँच अधिकारी करेंगे।";
    else if (/deficien|कमी/.test(q))
      answer =
        "आवेदन विवरण में हर कमी और उसे सुधारने का तरीका दिया गया है। सही दस्तावेज़ अपलोड करके आवेदन दोबारा भेजें।";
    else if (/eligib|पात्र/.test(q))
      answer =
        "ये डेमो नियम हैं, आधिकारिक नीति नहीं। श्रेणी, आय, आयु और अंक की जाँच होती है। अधिकारी अंतिम निर्णय लेते हैं।";
    else
      answer =
        "योजना चुनें, आवेदन भरें और दस्तावेज़ अपलोड करें। आवेदन अपने आप सहेजा जाता है। घोषणा स्वीकार करके सत्यापन के लिए भेजें। ये डेमो नियम हैं, आधिकारिक नीति नहीं।";
  }
  return {
    answer,
    href,
    provider: "Local knowledge base",
    disclaimer:
      language === "hi"
        ? "डेमो जानकारी • आधिकारिक सरकारी नीति नहीं"
        : "Configured demo information • not official government policy",
  };
}
