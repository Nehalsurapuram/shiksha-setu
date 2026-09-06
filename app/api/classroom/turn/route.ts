import { VoiceTranslationService } from "@/lib/ai/VoiceTranslationService";
import { TranslationError } from "@/lib/ai/translation-provider";
import {
  fail,
  fileNameFor,
  handleSpeechError,
} from "@/lib/api/speech-responses";
import {
  getCurrentTeacher,
  getDefaultLanguagePair,
} from "@/lib/database/queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/classroom/turn
 *
 * multipart/form-data: `speaker` ("teacher" | "student"), and one of `audio`
 * or `text`.
 *
 * One endpoint for both directions. The speaker decides which way the pair is
 * read: a teacher turn goes instruction language → mother tongue, a student
 * turn goes back the other way.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("UNSUPPORTED_AUDIO", "Could not read the request.", 400);
  }

  const speaker = form.get("speaker");
  if (speaker !== "teacher" && speaker !== "student") {
    return fail("PROVIDER_ERROR", "Unknown speaker.", 400);
  }

  const audio = form.get("audio");
  const rawText = form.get("text");
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const hasAudio = audio instanceof Blob && audio.size > 0;

  if (!hasAudio && !text) {
    return fail("NO_AUDIO", "Say something or type something first.", 400);
  }

  const pair = await getDefaultLanguagePair();
  if (!pair) {
    return fail(
      "STT_LANGUAGE_UNSUPPORTED",
      "No language pair is configured on this installation.",
      503,
    );
  }

  const teacherSpeaks = speaker === "teacher";
  const from = teacherSpeaks ? pair.source : pair.target;
  const to = teacherSpeaks ? pair.target : pair.source;

  try {
    const teacher = await getCurrentTeacher();
    const service = new VoiceTranslationService();

    const outcome = await service.run({
      audio: hasAudio ? (audio as Blob) : undefined,
      fileName: hasAudio ? fileNameFor(audio as Blob) : undefined,
      text: hasAudio ? undefined : text,
      sourceLanguage: { code: from.code, name: from.name },
      targetLanguage: { code: to.code, name: to.name },
      userId: teacher?.id ?? null,
      // A student answering in the mother tongue is the point of the room.
      allowReverseDirection: !teacherSpeaks,
    });

    return Response.json({
      success: true,
      speaker,
      sourceLanguage: { code: from.code, name: from.name },
      targetLanguage: { code: to.code, name: to.name },
      sourceText: outcome.transcript,
      translatedText: outcome.translation,
      audioUrl: outcome.audioUrl,
      audioUnavailableReason: outcome.audioUnavailableReason,
      processingTimeMs: outcome.processingTimeMs,
      timings: outcome.timings,
      isDemo: outcome.isDemo,
      translationId: outcome.translationId,
    });
  } catch (error) {
    if (error instanceof TranslationError) {
      if (error.status >= 500) console.error("[classroom/turn]", error);
      return fail(error.code, error.publicMessage, error.status);
    }
    return handleSpeechError(error, "classroom/turn");
  }
}
