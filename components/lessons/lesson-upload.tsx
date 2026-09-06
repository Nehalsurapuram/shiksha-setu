"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";

import { PackageEditor } from "@/components/lessons/package-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TeachingPackageContent } from "@/lib/ai/teaching-package";

type Detection = {
  languageCode: string | null;
  languageName: string | null;
  languageMethod: "script" | "none";
  title: string | null;
  grade: number | null;
  subject: string | null;
  topic: string | null;
  metadataMethod: "model" | "none";
  metadataNote: string | null;
};

type ExtractSuccess = {
  success: true;
  text: string;
  format: string;
  method: string;
  pageCount: number | null;
  warning: string | null;
  fileName?: string;
  detection: Detection | null;
  processingTimeMs: number;
};

type Failure = { success: false; error: { code: string; message: string } };

type Step = "upload" | "review" | "package";

export function LessonUpload({
  sourceName,
  targetName,
  targetIsOlChiki,
  llmConfigured,
}: {
  sourceName: string;
  targetName: string;
  targetIsOlChiki: boolean;
  llmConfigured: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState<null | "extract" | "generate" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [extraction, setExtraction] = useState<ExtractSuccess | null>(null);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [sourceText, setSourceText] = useState("");

  const [content, setContent] = useState<TeachingPackageContent | null>(null);
  const [packageMeta, setPackageMeta] = useState<{
    provider: string;
    model: string;
    translationNote: string | null;
    processingTimeMs: number;
  } | null>(null);
  const [isEdited, setIsEdited] = useState(false);

  const upload = async (file: File) => {
    setBusy("extract");
    setError(null);
    setNotice(null);

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("fileName", file.name);

    try {
      const response = await fetch("/api/lessons/extract", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as ExtractSuccess | Failure;

      if (!payload.success) {
        setError(payload.error.message);
        return;
      }

      setExtraction(payload);
      setSourceText(payload.text);
      setTitle(payload.detection?.title ?? stripExtension(file.name));
      setGrade(payload.detection?.grade ? String(payload.detection.grade) : "");
      setSubject(payload.detection?.subject ?? "");
      setTopic(payload.detection?.topic ?? "");
      setStep("review");
      if (payload.warning) setNotice(payload.warning);
    } catch {
      setError("Could not reach the server. Check the connection.");
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy("generate");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText,
          title: title || null,
          grade: grade ? Number(grade) : null,
          subject: subject || null,
          topic: topic || null,
        }),
      });
      const payload = (await response.json()) as
        | {
            success: true;
            content: TeachingPackageContent;
            provider: string;
            model: string;
            translationNote: string | null;
            processingTimeMs: number;
          }
        | Failure;

      if (!payload.success) {
        setError(payload.error.message);
        return;
      }

      setContent(payload.content);
      setPackageMeta({
        provider: payload.provider,
        model: payload.model,
        translationNote: payload.translationNote,
        processingTimeMs: payload.processingTimeMs,
      });
      setIsEdited(false);
      setStep("package");
      if (payload.translationNote) setNotice(payload.translationNote);
    } catch {
      setError("Could not reach the server. Check the connection.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setError(null);

    try {
      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Untitled lesson",
          grade: grade ? Number(grade) : null,
          subject: subject || null,
          topic: topic || null,
          sourceText,
          translatedText: content?.teacherExplanation.sat ?? null,
          originalFileName: extraction?.fileName ?? null,
          sourceFormat: extraction?.format ?? "text",
          extractionMethod: extraction?.method ?? "typed",
          status: content ? "READY" : "DRAFT",
          package: content,
          packageProvider: packageMeta?.provider ?? null,
          packageModel: packageMeta?.model ?? null,
          packageIsEdited: isEdited,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; lessonId: string }
        | Failure;

      if (!payload.success) {
        setError(payload.error.message);
        return;
      }

      setNotice("Lesson saved.");
      router.refresh();
    } catch {
      setError("Could not save the lesson. Check the connection.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Steps current={step} />

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {notice}
        </p>
      ) : null}

      {step === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload a lesson</CardTitle>
            <CardDescription>
              PDF, Word (.docx), a photo of a page (JPG or PNG), or a text file.
              Up to 12 MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileUp className="size-6" aria-hidden />
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <Button
                className="mt-4"
                size="lg"
                onClick={() => fileRef.current?.click()}
                disabled={busy !== null}
              >
                {busy === "extract" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Reading…
                  </>
                ) : (
                  <>
                    <Upload aria-hidden />
                    Choose a file
                  </>
                )}
              </Button>
              <p className="mt-3 text-sm text-muted-foreground">
                A scanned PDF has no text in it. Photograph the page instead —
                photos go through text recognition.
              </p>
            </div>

            <div className="mt-4 text-center">
              <Button
                variant="ghost"
                onClick={() => {
                  setExtraction(null);
                  setSourceText("");
                  setTitle("");
                  setStep("review");
                }}
                disabled={busy !== null}
              >
                Or type the lesson in by hand
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "review" ? (
        <Card>
          <CardHeader>
            <CardTitle>Check what was read</CardTitle>
            <CardDescription>
              Everything here is a suggestion. Correct anything that is wrong
              before generating — the material is built from these fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {extraction ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{extraction.format}</Badge>
                <Badge variant="outline">{methodLabel(extraction.method)}</Badge>
                {extraction.pageCount ? (
                  <Badge variant="outline">{extraction.pageCount} page(s)</Badge>
                ) : null}
                {extraction.detection?.languageName ? (
                  <Badge variant="success">
                    {extraction.detection.languageName} (from script)
                  </Badge>
                ) : null}
                <span className="text-muted-foreground">
                  read in {(extraction.processingTimeMs / 1000).toFixed(1)}s
                </span>
              </div>
            ) : null}

            {extraction?.detection?.metadataNote ? (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                {extraction.detection.metadataNote}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <LabelledInput label="Title" value={title} onChange={setTitle} />
              <LabelledInput
                label="Class"
                value={grade}
                onChange={setGrade}
                type="number"
                placeholder="e.g. 2"
              />
              <LabelledInput
                label="Subject"
                value={subject}
                onChange={setSubject}
                placeholder="e.g. EVS"
              />
              <LabelledInput label="Topic" value={topic} onChange={setTopic} />
            </div>

            <div>
              <label
                htmlFor="source-text"
                className="text-sm font-medium"
              >
                Lesson text ({sourceName})
              </label>
              <textarea
                id="source-text"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                rows={12}
                placeholder={`Type or paste the lesson in ${sourceName}…`}
                className="mt-1.5 w-full resize-y rounded-md border border-input bg-card p-3 text-base leading-relaxed"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {sourceText.trim().length} characters
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={generate}
                disabled={
                  busy !== null || !sourceText.trim() || !llmConfigured
                }
              >
                {busy === "generate" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden />
                    Generate teaching package
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={save}
                disabled={busy !== null || !sourceText.trim() || !title.trim()}
              >
                {busy === "save" ? "Saving…" : "Save lesson without generating"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStep("upload")}
                disabled={busy !== null}
              >
                Back
              </Button>
            </div>

            {!llmConfigured ? (
              <p className="text-sm text-muted-foreground">
                Generation is unavailable: no LLM provider is configured on this
                server. The lesson text can still be saved.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === "package" && content ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <CheckCircle2 className="size-5 text-success" aria-hidden />
              <div className="min-w-0">
                <p className="font-medium">Teaching package generated</p>
                <p className="text-xs text-muted-foreground">
                  {packageMeta?.provider} · {packageMeta?.model} ·{" "}
                  {((packageMeta?.processingTimeMs ?? 0) / 1000).toFixed(1)}s
                  {isEdited ? " · edited" : ""}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button onClick={save} disabled={busy !== null}>
                  {busy === "save" ? "Saving…" : "Save lesson"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep("review")}
                  disabled={busy !== null}
                >
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground">
            <span className="font-semibold">
              AI-generated teaching material. Review every section before using
              it in a classroom.
            </span>{" "}
            It was written from your text by a language model, and the mother
            tongue column was machine translated. Both can be wrong.
          </p>

          <PackageEditor
            content={content}
            onChange={(next) => {
              setContent(next);
              setIsEdited(true);
            }}
            sourceName={sourceName}
            targetName={targetName}
            targetIsOlChiki={targetIsOlChiki}
          />
        </div>
      ) : null}
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: "upload", label: "Upload" },
    { key: "review", label: "Check" },
    { key: "package", label: "Teaching package" },
  ];
  const index = steps.findIndex((step) => step.key === current);

  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {steps.map((step, position) => (
        <li
          key={step.key}
          className={
            position <= index
              ? "rounded-full bg-accent px-3 py-1 font-medium text-accent-foreground"
              : "rounded-full border border-border px-3 py-1 text-muted-foreground"
          }
        >
          {position + 1}. {step.label}
        </li>
      ))}
    </ol>
  );
}

function LabelledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
      />
    </div>
  );
}

function methodLabel(method: string): string {
  if (method === "pdf-text-layer") return "PDF text layer";
  if (method === "ocr") return "text recognition";
  if (method === "docx") return "Word document";
  return "plain text";
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
