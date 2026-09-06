import "server-only";

import { LLMError } from "@/lib/ai/llm-provider";
import { selectLLMProvider } from "@/lib/ai/LLMService";

export type SourceFormat = "pdf" | "docx" | "image" | "text";
export type ExtractionMethod =
  | "pdf-text-layer"
  | "docx"
  | "plain-text"
  | "ocr";

export type ExtractionResult = {
  text: string;
  format: SourceFormat;
  method: ExtractionMethod;
  /** Pages read, when the format has pages. */
  pageCount: number | null;
  /** Set when the file parsed but produced no usable text. */
  warning: string | null;
};

export class ExtractionError extends Error {
  readonly publicMessage: string;
  readonly status: number;

  constructor(publicMessage: string, status = 400, cause?: unknown) {
    super(publicMessage, { cause });
    this.name = "ExtractionError";
    this.publicMessage = publicMessage;
    this.status = status;
  }
}

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const PDF_TYPES = new Set(["application/pdf"]);
const DOCX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const TEXT_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);

export function detectFormat(
  mimeType: string,
  fileName: string,
): SourceFormat | null {
  const type = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = fileName.toLowerCase().split(".").pop() ?? "";

  if (PDF_TYPES.has(type) || extension === "pdf") return "pdf";
  if (DOCX_TYPES.has(type) || extension === "docx") return "docx";
  if (IMAGE_TYPES.has(type) || ["jpg", "jpeg", "png", "webp"].includes(extension))
    return "image";
  if (TEXT_TYPES.has(type) || ["txt", "md"].includes(extension)) return "text";
  return null;
}

export async function extractText(
  file: Blob,
  fileName: string,
): Promise<ExtractionResult> {
  if (file.size === 0) {
    throw new ExtractionError("That file is empty.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ExtractionError(
      "That file is too large. Upload one under 12 MB, or a single chapter rather than a whole textbook.",
      413,
    );
  }

  const format = detectFormat(file.type, fileName);
  if (!format) {
    throw new ExtractionError(
      "That file type is not supported. Upload a PDF, Word file, photo (JPG or PNG), or a text file.",
      415,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  switch (format) {
    case "text":
      return readPlainText(buffer);
    case "docx":
      return readDocx(buffer);
    case "pdf":
      return readPdf(buffer);
    case "image":
      return readImage(buffer, file.type || "image/jpeg");
  }
}

function readPlainText(buffer: Buffer): ExtractionResult {
  const text = buffer.toString("utf8").trim();
  return {
    text,
    format: "text",
    method: "plain-text",
    pageCount: null,
    warning: text ? null : "That text file has no readable content.",
  };
}

async function readDocx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer });
    const text = value.trim();
    return {
      text,
      format: "docx",
      method: "docx",
      pageCount: null,
      warning: text ? null : "That Word file has no readable text.",
    };
  } catch (cause) {
    throw new ExtractionError(
      "That Word file could not be read. Save it as .docx and try again.",
      422,
      cause,
    );
  }
}

/**
 * Reads a PDF's text layer.
 *
 * A scanned textbook page has no text layer — it is a picture of words. Rather
 * than returning an empty lesson, that case is reported so the teacher can
 * photograph the page instead, which routes through OCR.
 */
async function readPdf(buffer: Buffer): Promise<ExtractionResult> {
  let pdfjs;
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (cause) {
    throw new ExtractionError("PDF support is unavailable on this server.", 500, cause);
  }

  try {
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      // No worker or canvas in a server runtime; text extraction needs neither.
      useSystemFonts: true,
    }).promise;

    const parts: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) parts.push(pageText);
    }

    const text = parts.join("\n\n").trim();
    return {
      text,
      format: "pdf",
      method: "pdf-text-layer",
      pageCount: doc.numPages,
      warning: text
        ? null
        : "This PDF has no text layer — it is a scan, so there are no words to extract. Photograph the page and upload the image instead, which goes through text recognition.",
    };
  } catch (cause) {
    throw new ExtractionError(
      "That PDF could not be read. It may be password protected or damaged.",
      422,
      cause,
    );
  }
}

/**
 * Reads a photographed page.
 *
 * This is the one extraction path that uses a model, so it inherits the same
 * rule as everything else: with no key configured it fails plainly rather than
 * returning invented text. Invented lesson text would be the worst possible
 * failure here — it would look exactly like a successful read.
 */
async function readImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  const provider = selectLLMProvider();
  if (!provider.isConfigured) {
    throw new ExtractionError(
      "Reading text from a photo needs the generation service, which is not configured on this server. Upload a PDF, Word or text file instead.",
      503,
    );
  }

  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  try {
    const { data } = await provider.complete<{
      text: string;
      isReadable: boolean;
    }>({
      system:
        "You transcribe photographs of school textbook pages. Copy the text exactly as printed, preserving the original language and script. Do not translate, summarise, correct or add anything. If the image contains no readable text, set isReadable to false and return an empty string.",
      user: "Transcribe every word of text in this image.",
      images: [dataUrl],
      schemaName: "page_transcription",
      schema: {
        type: "object",
        properties: {
          text: { type: "string" },
          isReadable: { type: "boolean" },
        },
        required: ["text", "isReadable"],
        additionalProperties: false,
      },
    });

    const text = data.text.trim();
    return {
      text,
      format: "image",
      method: "ocr",
      pageCount: 1,
      warning:
        data.isReadable && text
          ? null
          : "No readable text was found in that photo. Try a straighter, better-lit picture of the page.",
    };
  } catch (cause) {
    if (cause instanceof LLMError) {
      throw new ExtractionError(cause.publicMessage, cause.status, cause);
    }
    throw new ExtractionError("That image could not be read.", 502, cause);
  }
}
