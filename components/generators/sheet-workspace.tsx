"use client";

import { useState } from "react";
import { AlertTriangle, Printer, RefreshCw, Save } from "lucide-react";

import {
  GeneratorForm,
  type GeneratorInputs,
} from "@/components/generators/generator-form";
import { SheetEditor } from "@/components/generators/sheet-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  QuestionType,
  WorksheetContent,
} from "@/lib/ai/generated-content";
import { cn } from "@/lib/utils";

type Failure = { success: false; error: { code: string; message: string } };
type Success = {
  success: true;
  content: WorksheetContent;
  provider: string;
  model: string;
  translationNote: string | null;
  processingTimeMs: number;
};

export function SheetWorkspace({
  kind,
  sourceName,
  targetName,
  targetIsOlChiki,
  llmConfigured,
  allowedTypes,
  defaultTypes,
}: {
  kind: "worksheet" | "assessment";
  sourceName: string;
  targetName: string;
  targetIsOlChiki: boolean;
  llmConfigured: boolean;
  allowedTypes: readonly QuestionType[];
  defaultTypes: QuestionType[];
}) {
  const isAssessment = kind === "assessment";

  const [inputs, setInputs] = useState<GeneratorInputs>({
    grade: "",
    subject: "",
    topic: "",
    difficulty: "easy",
    count: isAssessment ? "8" : "6",
    questionTypes: defaultTypes,
  });

  const [content, setContent] = useState<WorksheetContent | null>(null);
  const [meta, setMeta] = useState<{
    provider: string;
    model: string;
    translationNote: string | null;
    processingTimeMs: number;
  } | null>(null);
  const [isEdited, setIsEdited] = useState(false);
  const [busy, setBusy] = useState<null | "generate" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(true);

  const generate = async () => {
    setBusy("generate");
    setError(null);
    setSaved(null);

    try {
      const response = await fetch(`/api/${kind}s/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: inputs.grade ? Number(inputs.grade) : null,
          subject: inputs.subject || null,
          topic: inputs.topic,
          difficulty: inputs.difficulty,
          count: Number(inputs.count) || 6,
          questionTypes: inputs.questionTypes,
        }),
      });
      const payload = (await response.json()) as Success | Failure;

      if (!payload.success) {
        setError(payload.error.message);
        return;
      }

      setContent(payload.content);
      setMeta({
        provider: payload.provider,
        model: payload.model,
        translationNote: payload.translationNote,
        processingTimeMs: payload.processingTimeMs,
      });
      setIsEdited(false);
    } catch {
      setError("Could not reach the server. Check the connection.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!content) return;
    setBusy("save");
    setError(null);

    try {
      const response = await fetch(`/api/${kind}s`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: inputs.grade ? Number(inputs.grade) : null,
          subject: inputs.subject || null,
          topic: inputs.topic || null,
          difficulty: inputs.difficulty,
          content,
          provider: meta?.provider ?? null,
          model: meta?.model ?? null,
          isEdited,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; id: string; maxScore?: number }
        | Failure;

      if (!payload.success) {
        setError(payload.error.message);
        return;
      }
      setSaved(
        isAssessment && payload.maxScore
          ? `Saved. Total marks: ${payload.maxScore}.`
          : "Saved.",
      );
    } catch {
      setError("Could not save. Check the connection.");
    } finally {
      setBusy(null);
    }
  };

  const totalMarks = content
    ? content.questions.reduce((sum, question) => sum + (question.marks || 1), 0)
    : 0;

  return (
    <div className="space-y-6">
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>
            {isAssessment ? "Build an assessment" : "Build a worksheet"}
          </CardTitle>
          <CardDescription>
            {isAssessment
              ? "Questions a child answers on their own, with an answer key for marking."
              : "Practice questions for the class, in both languages."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GeneratorForm
            inputs={inputs}
            onChange={setInputs}
            allowedTypes={allowedTypes}
            sourceName={sourceName}
            targetName={targetName}
            disabled={!llmConfigured}
            busy={busy === "generate"}
            onGenerate={generate}
            generateLabel={content ? "Regenerate" : "Generate"}
          />
          {!llmConfigured ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Generation is unavailable: no LLM provider is configured on this
              server.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:hidden"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {content ? (
        <>
          <Card className="print:hidden">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {content.questions.length} question
                  {content.questions.length === 1 ? "" : "s"}
                  {isAssessment ? ` · ${totalMarks} marks` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {meta?.provider} · {meta?.model} ·{" "}
                  {((meta?.processingTimeMs ?? 0) / 1000).toFixed(1)}s
                  {isEdited ? " · edited" : ""}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={generate}
                  disabled={busy !== null}
                >
                  <RefreshCw aria-hidden />
                  Regenerate
                </Button>
                <Button onClick={save} disabled={busy !== null}>
                  <Save aria-hidden />
                  {busy === "save" ? "Saving…" : "Save"}
                </Button>
                {/* One button, honestly labelled: the browser's print dialog is
                    also where "Save as PDF" lives, so this is both. */}
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer aria-hidden />
                  Print / Save as PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {saved ? (
            <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success print:hidden">
              {saved}
            </p>
          ) : null}

          {meta?.translationNote ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground print:hidden">
              {meta.translationNote}
            </p>
          ) : null}

          <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground print:hidden">
            <span className="font-semibold">
              AI-generated. Check every question and answer before giving this to
              children.
            </span>{" "}
            The {targetName} column is machine translated and can be wrong.
          </p>

          <label className="flex items-center gap-2 text-sm print:hidden">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(event) => setShowAnswers(event.target.checked)}
              className="size-4"
            />
            Show answers when printing (turn off to print a blank sheet for the
            class)
          </label>

          <div className={cn(showAnswers ? "" : "[&_[data-answer]]:hidden")}>
            <SheetEditor
              content={content}
              onChange={(next) => {
                setContent(next);
                setIsEdited(true);
              }}
              sourceName={sourceName}
              targetName={targetName}
              targetIsOlChiki={targetIsOlChiki}
              showMarks={isAssessment}
            />
          </div>

          {isAssessment ? (
            <Card className="print:break-before-page">
              <CardHeader>
                <CardTitle>Answer key</CardTitle>
                <CardDescription>
                  Rendered from the questions above, so it cannot drift out of
                  step with them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {content.questions.map((question, index) => (
                    <li key={index} className="flex gap-3 text-sm">
                      <span className="font-medium">Q{index + 1}</span>
                      <span className="flex-1">
                        {question.answer}
                        {question.answerSat ? (
                          <span
                            className={cn(
                              "ml-2 text-muted-foreground",
                              targetIsOlChiki && "font-ol-chiki",
                            )}
                          >
                            {question.answerSat}
                          </span>
                        ) : null}
                      </span>
                      <Badge variant="outline">{question.marks}</Badge>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-sm font-medium">
                  Total: {totalMarks} marks
                </p>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
