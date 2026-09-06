"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Mic, Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRecorder } from "@/lib/voice/use-recorder";
import { cn } from "@/lib/utils";

/**
 * One side of the conversation: a large microphone button plus a text box.
 *
 * Both inputs exist on both sides on purpose. A child who will not speak in
 * front of the class can still type, and a teacher whose classroom is too loud
 * to record can type too.
 */
export function SpeakerPanel({
  title,
  subtitle,
  languageName,
  placeholder,
  isOlChiki,
  accent,
  disabled,
  disabledReason,
  busy,
  canSpeak,
  cannotSpeakReason,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  languageName: string;
  placeholder: string;
  isOlChiki: boolean;
  accent: "teacher" | "student";
  disabled: boolean;
  disabledReason: string | null;
  busy: boolean;
  /** False when speech recognition has no model for this language. */
  canSpeak: boolean;
  cannotSpeakReason: string | null;
  onSubmit: (input: { audio?: Blob; text?: string }) => Promise<void>;
}) {
  const [text, setText] = useState("");

  const uploadRef = useRef<((audio: Blob) => Promise<void>) | null>(null);
  const handleComplete = useCallback(
    (audio: Blob) => uploadRef.current?.(audio) ?? Promise.resolve(),
    [],
  );
  const recorder = useRecorder({ onComplete: handleComplete });
  const { setState: setRecorderState } = recorder;

  const upload = useCallback(
    async (audio: Blob) => {
      await onSubmit({ audio });
      setRecorderState("ready");
    },
    [onSubmit, setRecorderState],
  );

  useEffect(() => {
    uploadRef.current = upload;
  }, [upload]);

  const listening = recorder.state === "listening";
  const micBusy = busy || recorder.state === "processing";
  const micDisabled =
    disabled || micBusy || !canSpeak || recorder.state === "unsupported";

  const sendText = async () => {
    const value = text.trim();
    if (!value || disabled || busy) return;
    setText("");
    await onSubmit({ text: value });
  };

  return (
    <section
      className={cn(
        "rounded-xl border p-4 sm:p-5",
        accent === "teacher"
          ? "border-primary/30 bg-accent/40"
          : "border-marigold/40 bg-marigold-tint/50",
      )}
      aria-label={title}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={listening ? recorder.stop : recorder.start}
          disabled={micDisabled}
          aria-label={
            listening ? `Stop recording ${languageName}` : `Speak ${languageName}`
          }
          className={cn(
            "flex size-28 flex-col items-center justify-center gap-1 rounded-full text-sm font-semibold transition-colors disabled:opacity-40 sm:size-32",
            listening
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {micBusy ? (
            <Loader2 className="size-9 animate-spin" aria-hidden />
          ) : listening ? (
            <Square className="size-9" aria-hidden />
          ) : (
            <Mic className="size-9" aria-hidden />
          )}
          <span>{micBusy ? "Working…" : listening ? "STOP" : "SPEAK"}</span>
        </button>

        <p className="text-center text-xs text-muted-foreground">
          {!canSpeak && cannotSpeakReason
            ? cannotSpeakReason
            : listening
              ? `Listening… ${(recorder.elapsedMs / 1000).toFixed(1)}s`
              : `Speak in ${languageName}, or type below.`}
        </p>
      </div>

      <div className="mt-4">
        <label className="sr-only" htmlFor={`text-${accent}`}>
          Type in {languageName}
        </label>
        <textarea
          id={`text-${accent}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter makes a new line.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendText();
            }
          }}
          rows={2}
          disabled={disabled || busy}
          placeholder={placeholder}
          className={cn(
            "w-full resize-y rounded-md border border-input bg-card p-3 text-base disabled:opacity-60",
            isOlChiki && "font-ol-chiki",
          )}
        />
        <Button
          onClick={sendText}
          disabled={disabled || busy || !text.trim()}
          className="mt-2 w-full"
        >
          <Send aria-hidden />
          Send
        </Button>
      </div>

      {disabled && disabledReason ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}

      {recorder.error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-1.5 text-xs text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {recorder.error}
        </p>
      ) : null}
    </section>
  );
}
