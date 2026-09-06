"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  Eraser,
  Loader2,
  Pencil,
  Save,
  Volume2,
} from "lucide-react";

import { CorrectionForm } from "@/components/translator/correction-form";
import {
  TranslationHistory,
  type HistoryEntry,
} from "@/components/translator/translation-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_INPUT_CHARS } from "@/lib/ai/translation-limits";
import { cn } from "@/lib/utils";

type TranslateSuccess = {
  success: true;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  provider: "sarvam" | "demo";
  isDemo: boolean;
  cached: boolean;
  model: string;
  confidence: number | null;
  durationMs: number;
  translationId: string;
};

type TranslateFailure = {
  success: false;
  error: { code: string; message: string };
};

type Status = "idle" | "loading" | "done" | "error";

/** Ties the Save button to the correction form rendered further down. */
const CORRECTION_FORM_ID = "translator-correction-form";

export function TranslatorWorkspace({
  sourceLanguage,
  targetLanguage,
  targetIsOlChiki,
  history,
}: {
  sourceLanguage: { code: string; name: string };
  targetLanguage: { code: string; name: string };
  targetIsOlChiki: boolean;
  history: HistoryEntry[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TranslateSuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const overLimit = text.trim().length > MAX_INPUT_CHARS;
  const canTranslate = text.trim().length > 0 && !overLimit && status !== "loading";

  const translate = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus("error");
      setErrorMessage("Enter some Hindi text to translate.");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);
    setIsEditing(false);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLanguage: sourceLanguage.code,
          targetLanguage: targetLanguage.code,
          text: trimmed,
        }),
      });

      const payload = (await response.json()) as
        | TranslateSuccess
        | TranslateFailure;

      if (!payload.success) {
        setStatus("error");
        setErrorMessage(payload.error.message);
        setResult(null);
        return;
      }

      setResult(payload);
      setStatus("done");
      // History is server-rendered; pull in the row this just created.
      router.refresh();
    } catch {
      setStatus("error");
      setErrorMessage(
        "Could not reach the server. Check the connection and try again.",
      );
      setResult(null);
    }
  }, [text, sourceLanguage.code, targetLanguage.code, router]);

  const clear = () => {
    setText("");
    setResult(null);
    setStatus("idle");
    setErrorMessage(null);
    setIsEditing(false);
    inputRef.current?.focus();
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.translatedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage("Could not copy. Select the text and copy it manually.");
    }
  };

  const reopen = useCallback((entry: HistoryEntry) => {
    setText(entry.sourceText);
    setResult({
      success: true,
      sourceLanguage: entry.sourceLanguageCode,
      targetLanguage: entry.targetLanguageCode,
      sourceText: entry.sourceText,
      translatedText: entry.correctedText ?? entry.targetText,
      provider: entry.source === "DEMO" ? "demo" : "sarvam",
      isDemo: entry.source === "DEMO",
      cached: true,
      model: "stored",
      confidence: null,
      durationMs: 0,
      translationId: entry.id,
    });
    setStatus("done");
    setErrorMessage(null);
    setIsEditing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="space-y-6">
      {/* Standing warning. Present before, during and after any translation —
          not only on success — because it is advice about the whole tool. */}
      <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-warning-foreground"
          aria-hidden
        />
        <p className="text-sm text-warning-foreground">
          <span className="font-semibold">
            AI-generated translation. Please review before classroom use.
          </span>{" "}
          Santhali is a low-resource language for machine translation. Read the
          output before putting it in front of children, and correct it here
          when it is wrong.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Source */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="source-text" className="text-sm font-semibold">
                {sourceLanguage.name}
              </label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  overLimit ? "font-medium text-destructive" : "text-muted-foreground",
                )}
              >
                {text.trim().length} / {MAX_INPUT_CHARS}
              </span>
            </div>

            <textarea
              id="source-text"
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={9}
              placeholder="पाठ यहाँ लिखें…"
              aria-describedby={overLimit ? "source-limit" : undefined}
              className="mt-2 w-full resize-y rounded-md border border-input bg-card p-3 text-base leading-relaxed"
            />

            {overLimit ? (
              <p id="source-limit" role="alert" className="mt-2 text-sm text-destructive">
                Too long by {text.trim().length - MAX_INPUT_CHARS} characters.
                Translate one paragraph at a time.
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={translate} disabled={!canTranslate}>
                {status === "loading" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Translating…
                  </>
                ) : (
                  "Translate"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={clear}
                disabled={!text && !result}
              >
                <Eraser aria-hidden />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Target */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{targetLanguage.name}</p>
              {result ? <StatusBadges result={result} /> : null}
            </div>

            <output
              className="mt-2 block min-h-[13.5rem] rounded-md border border-border bg-muted/40 p-3"
              aria-live="polite"
            >
              {status === "loading" ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Translating…
                </span>
              ) : status === "error" ? (
                <span role="alert" className="text-sm text-destructive">
                  {errorMessage}
                </span>
              ) : result ? (
                <span
                  className={cn(
                    "block whitespace-pre-wrap text-base leading-relaxed",
                    // Demo output is a plain-language notice, so it must not be
                    // styled as Santhali script.
                    targetIsOlChiki && !result.isDemo && "font-ol-chiki",
                    result.isDemo && "text-muted-foreground",
                  )}
                >
                  {result.translatedText}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  The {targetLanguage.name} translation will appear here.
                </span>
              )}
            </output>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={copy} disabled={!result}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditing((value) => !value)}
                disabled={!result}
                aria-expanded={isEditing}
              >
                <Pencil aria-hidden />
                Edit
              </Button>
              {/* Submits the correction form below via the HTML `form`
                  attribute, so Save lives with the other output actions
                  instead of being hidden until Edit is open. */}
              <Button
                type="submit"
                form={CORRECTION_FORM_ID}
                variant="outline"
                disabled={!result || !isEditing}
                title={
                  isEditing
                    ? "Save your corrected translation"
                    : "Choose Edit first, then Save your correction"
                }
              >
                <Save aria-hidden />
                Save
              </Button>
              <Button
                variant="outline"
                disabled
                title="Audio playback is not built yet"
              >
                <Volume2 aria-hidden />
                Listen
              </Button>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Listen needs text-to-speech, which is not built yet. Use Edit to
              correct the translation, then Save.
            </p>

            {result ? <ResultMeta result={result} /> : null}
          </CardContent>
        </Card>
      </div>

      {/* Edit + Save */}
      {result && isEditing ? (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <CorrectionForm
              translationId={result.translationId}
              formId={CORRECTION_FORM_ID}
              initialText={result.translatedText}
              isOlChiki={targetIsOlChiki && !result.isDemo}
              onCancel={() => setIsEditing(false)}
              onSaved={() => {
                setIsEditing(false);
                router.refresh();
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <TranslationHistory entries={history} onReopen={reopen} />
    </div>
  );
}

function StatusBadges({ result }: { result: TranslateSuccess }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {result.isDemo ? (
        <Badge variant="warning">Demo Translation</Badge>
      ) : (
        <Badge variant="success">Sarvam</Badge>
      )}
      {result.cached ? <Badge variant="outline">Saved</Badge> : null}
    </span>
  );
}

function ResultMeta({ result }: { result: TranslateSuccess }) {
  return (
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
      <div className="flex gap-1">
        <dt>Provider:</dt>
        <dd className="font-medium">
          {result.isDemo ? "demo (no model called)" : result.provider}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>Model:</dt>
        <dd className="font-medium">{result.model}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Time:</dt>
        <dd className="font-medium tabular-nums">
          {result.cached ? "reused saved result" : `${result.durationMs} ms`}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt>Status:</dt>
        <dd className="font-medium">
          {result.isDemo ? "not translated" : "translated, unreviewed"}
        </dd>
      </div>
    </dl>
  );
}
