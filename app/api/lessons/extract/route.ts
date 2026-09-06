import { detectLessonMetadata } from "@/lib/extraction/detect";
import { ExtractionError, extractText } from "@/lib/extraction/extract-text";
import { fail } from "@/lib/api/speech-responses";

export const dynamic = "force-dynamic";

/**
 * POST /api/lessons/extract
 *
 * multipart/form-data: `file`.
 * Upload → extract text (OCR for images) → detect language, class, subject,
 * topic. Everything returned is a suggestion the teacher can overwrite.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("UNSUPPORTED_FILE", "Could not read the upload.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return fail("NO_FILE", "Choose a file to upload.", 400);
  }

  const fileName =
    typeof form.get("fileName") === "string"
      ? (form.get("fileName") as string)
      : ((file as File).name ?? "upload");

  const startedAt = Date.now();

  try {
    const extraction = await extractText(file, fileName);

    // No text means nothing to detect; return the warning and let the teacher
    // decide what to do rather than calling a model on an empty string.
    if (!extraction.text) {
      return Response.json({
        success: true,
        text: "",
        format: extraction.format,
        method: extraction.method,
        pageCount: extraction.pageCount,
        warning: extraction.warning,
        detection: null,
        processingTimeMs: Date.now() - startedAt,
      });
    }

    const detection = await detectLessonMetadata(extraction.text);

    return Response.json({
      success: true,
      text: extraction.text,
      format: extraction.format,
      method: extraction.method,
      pageCount: extraction.pageCount,
      warning: extraction.warning,
      fileName,
      detection,
      processingTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof ExtractionError) {
      if (error.status >= 500) console.error("[lessons/extract]", error);
      return fail("EXTRACTION_FAILED", error.publicMessage, error.status);
    }
    console.error("[lessons/extract] unexpected", error);
    return fail(
      "EXTRACTION_FAILED",
      "That file could not be read. Try another format.",
      500,
    );
  }
}
