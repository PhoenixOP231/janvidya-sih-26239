import { createHash } from "node:crypto";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { eq } from "drizzle-orm";
import { storageObjects } from "@/db/schema";
import type { Analysis, FormData, DocumentRequirement } from "@/lib/domain";
import {
  compareFields,
  extractTextFields,
  fieldLabels,
} from "@/lib/document-analysis";
import { AppError } from "./errors";
import type { Executor } from "./db";

export async function validateFile(
  bytes: Buffer,
  filename: string,
  declaredMime: string,
) {
  if (!bytes.length)
    throw new AppError("The file is empty. Choose a complete document.");
  if (bytes.length > 3 * 1024 * 1024)
    throw new AppError("Each document must be smaller than 3 MB.");
  const ext = filename.split(".").at(-1)?.toLowerCase();
  const mime =
    bytes.subarray(0, 5).toString() === "%PDF-"
      ? "application/pdf"
      : bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          ? "image/jpeg"
          : "";
  if (
    !mime ||
    !["pdf", "jpg", "jpeg", "png"].includes(ext || "") ||
    (declaredMime && mime !== declaredMime)
  )
    throw new AppError(
      "Upload a genuine PDF, JPG or PNG document. The file contents must match its type.",
    );
  if ((mime === "application/pdf") !== (ext === "pdf"))
    throw new AppError("The filename extension does not match the document.");
  if (mime !== "application/pdf") {
    try {
      const metadata = await sharp(bytes, {
        limitInputPixels: 20000000,
      }).metadata();
      if ((metadata.width || 0) < 300 || (metadata.height || 0) < 200)
        throw new AppError(
          "This image is too small. Use a scan at least 300 × 200 pixels.",
        );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "This image could not be decoded. Upload a fresh scan.",
      );
    }
  }
  return mime;
}
interface OcrProvider {
  name: string;
  read(
    bytes: Buffer,
    mime: string,
  ): Promise<{ text: string; confidence: number }>;
}
const localOcr: OcrProvider = {
  name: "Local PDF text / manual review",
  async read(bytes, mime) {
    if (mime !== "application/pdf") return { text: "", confidence: 0 };
    try {
      const proxy = await getDocumentProxy(new Uint8Array(bytes));
      if (proxy.numPages > 12)
        throw new AppError("Upload at most 12 pages per document.");
      const result = await extractText(proxy, { mergePages: false });
      return { text: result.text.join("\n"), confidence: 96 };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "This PDF is damaged or password protected. Upload an accessible PDF.",
      );
    }
  },
};
const externalOcr: OcrProvider = {
  name: "OCR.Space",
  async read(bytes, mime) {
    const body = new FormData();
    body.set("base64Image", `data:${mime};base64,${bytes.toString("base64")}`);
    body.set("language", "eng");
    body.set("isOverlayRequired", "false");
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: process.env.OCR_SPACE_API_KEY! },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("OCR provider unavailable");
    const data = await response.json();
    if (data.IsErroredOnProcessing)
      throw new Error("OCR provider could not process document");
    return {
      text: (data.ParsedResults || [])
        .map((r: { ParsedText: string }) => r.ParsedText)
        .join("\n"),
      confidence: 75,
    };
  },
};
export async function analyzeDocument(
  bytes: Buffer,
  mime: string,
  category: string,
  data: FormData,
): Promise<Analysis> {
  const signals: string[] = [];
  let provider = process.env.OCR_SPACE_API_KEY ? externalOcr : localOcr;
  let result;
  try {
    result = await provider.read(bytes, mime);
  } catch (error) {
    if (provider === localOcr) throw error;
    provider = localOcr;
    result = await provider.read(bytes, mime);
    signals.push("External OCR unavailable; local extraction used.");
  }
  if (mime.startsWith("image/")) {
    const stats = await sharp(bytes).stats();
    if (stats.entropy < 2)
      signals.push("Low image detail: possible blur or blank scan.");
  }
  const fields = extractTextFields(result.text, result.confidence);
  const classification = /INCOME CERTIFICATE/i.test(result.text)
    ? "income"
    : /TRIBE CERTIFICATE/i.test(result.text)
      ? "category"
      : /ACADEMIC TRANSCRIPT/i.test(result.text)
        ? "academic"
        : /DOMICILE CERTIFICATE/i.test(result.text)
          ? "domicile"
          : /OFFER LETTER/i.test(result.text)
            ? "admission"
            : "unknown";
  const confidence = fields.length ? result.confidence : 0;
  return {
    provider: provider.name,
    classification,
    confidence,
    quality: confidence >= 80 && !signals.length ? "good" : "review",
    fields,
    mismatches: compareFields(data, fields),
    signals,
    processedAt: new Date().toISOString(),
    explanation: fields.length
      ? `Extracted ${fields.length} fields from document text. Confidence is a heuristic, not a calibrated probability. ${classification === category ? "Document type matches." : "Document type needs review."}`
      : "No reliable text was extracted. Upload a text PDF, use a demo fixture, or request manual verification. No values were inferred from your form.",
  };
}
export async function makeFixture(
  requirement: DocumentRequirement,
  data: FormData,
  variant = "clean",
) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({
    x: 35,
    y: 35,
    width: 525,
    height: 772,
    borderColor: rgb(0.12, 0.3, 0.4),
    borderWidth: 2,
  });
  const line = (text: string, y: number, size = 12, heavy = false) =>
    page.drawText(text.replace(/[^\x20-\x7E]/g, ""), {
      x: 60,
      y,
      size,
      font: heavy ? bold : font,
      color: rgb(0.1, 0.2, 0.25),
    });
  line("JANVIDYA | FICTIONAL DEMO DOCUMENT", 770, 16, true);
  const titles: Record<string, string> = {
    category: "TRIBE CERTIFICATE",
    income: "INCOME CERTIFICATE",
    academic: "ACADEMIC TRANSCRIPT",
    domicile: "DOMICILE CERTIFICATE",
    admission: "UNIVERSITY OFFER LETTER",
  };
  line(
    titles[requirement.key] || requirement.label.toUpperCase(),
    718,
    20,
    true,
  );
  line(
    "Not issued by any government authority. For software demonstration only.",
    680,
    10,
  );
  const values = {
    ...data,
    certificateId: `DEMO-${String(data.fullName || "STUDENT")
      .replace(/\s/g, "")
      .slice(0, 10)}-${requirement.key}`,
    validUntil: "2027-12-31",
  } as FormData;
  if (variant === "mismatch" && requirement.key === "income")
    values.familyIncome = Number(data.familyIncome || 210000) + 150000;
  if (variant === "low-confidence") {
    line(
      "This fixture intentionally contains no extractable certificate fields.",
      610,
    );
  } else
    requirement.fields.forEach((field, i) =>
      line(
        `${fieldLabels[field] || field}: ${values[field] ?? "Demo value"}`,
        620 - i * 45,
      ),
    );
  line("Fictional Institute of Tribal Studies", 290, 13, true);
  line("Digital sample - no official signature or seal", 265, 10);
  line("All names, identifiers and values are synthetic.", 120, 10);
  return Buffer.from(await pdf.save());
}
export async function storeDocument(
  tx: Executor,
  key: string,
  bytes: Buffer,
  mime: string,
): Promise<string> {
  if (process.env.STORAGE_PROVIDER === "vercel-blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      throw new AppError("Private object storage is not configured.", 503);
    const { put } = await import("@vercel/blob");
    const result = await put(key, bytes, {
      access: "private",
      contentType: mime,
      addRandomSuffix: true,
    });
    return result.url;
  }
  // ponytail: database-backed objects are capped at 3 MB; use private Blob storage for larger-scale deployments.
  await tx
    .insert(storageObjects)
    .values({ key, body: bytes.toString("base64"), mime });
  return key;
}
export async function readDocument(tx: Executor, key: string) {
  if (key.startsWith("https://")) {
    const { get } = await import("@vercel/blob");
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200)
      throw new AppError("Document is unavailable.", 404);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  const [record] = await tx
    .select()
    .from(storageObjects)
    .where(eq(storageObjects.key, key));
  if (!record) throw new AppError("Document is unavailable.", 404);
  return Buffer.from(record.body, "base64");
}
export const documentHash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
