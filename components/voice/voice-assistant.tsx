"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Mic,
  Pause,
  Play,
  Square,
  VolumeX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRecorder } from "@/lib/voice/use-recorder";
import { cn } from "@/lib/utils";

type VoiceSuccess = {
  success: true;
  transcript: string;
  translation: string;
  audioUrl: string | null;
  processingTimeMs: number;
  audioUnavailableReason: string | null;
  timings: { transcribeMs: number; translateMs: number; synthesizeMs: number };
  isDemo: boolean;
};

type VoiceFailure = { success: false; error: { code: string; message: string } };

const STATE_LABEL: Record<string, string> = {
  unsupported: "Unavailable",
  ready: "Ready",
  listening: "Listening",
  processing: "Processing",
  completed: "Completed",
  error: "Error",
};

export function VoiceAssistant({
  sourceLanguage,
  targetLanguage,
  targetIsOlChiki,
  canSpeakTarget,
  ttsUnavailableMessage,
  isDemo,
}: {
  sourceLanguage: { code: string; name: string };
  targetLanguage: { code: string; name: string };
  targetIsOlChiki: boolean;
  canSpeakTarget: boolean;
  ttsUnavailableMessage: string;
  isDemo: boolean;
}) {
  const [result, setResult] = useState<VoiceSuccess | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // The upload needs the recorder's state setters, and the recorder needs the
  // upload as its completion callback. A ref breaks the cycle without giving
  // useRecorder an unstable callback that would re-register its handlers.
  const uploadRef = useRef<((audio: Blob) => Promise<void>) | null>(null);
  const handleComplete = useCallback(
    (audio: Blob) => uploadRef.current?.(audio) ?? Promise.resolve(),
    [],
  );

  const recorder = useRecorder({ onComplete: handleComplete });
  const { setState: setRecorderState, setError: setRecorderError } = recorder;

  uploadRef.current = async (audio: Blob) => {
    setResult(null);

    const form = new FormData();
    form.append("audio", audio, "recording.webm");

    let response: Response;
    try {
      response = await fetch("/api/voice/translate", {
        method: "POST",
        body: form,
      });
    } catch {
      setRecorderState("error");
      setRecorderError(
        "Could not reach the server. Check the connection and try again.",
      );
      return;
    }

    let payload: VoiceSuccess | VoiceFailure;
    try {
      payload = (await response.json()) as VoiceSuccess | VoiceFailure;
    } catch {
      setRecorderState("error");
      setRecorderError("The server returned a response we could not read.");
      return;
    }

    if (!payload.success) {
      setRecorderState("error");
      setRecorderError(payload.error.message);
      return;
    }

    setResult(payload);
    setRecorderState("completed");
  };

  const togglePlay = () => {
    const element = audioRef.current;
    if (!element) return;
    if (element.paused) {
      void element.play();
    } else {
      element.pause();
    }
  };

  const busy = recorder.state === "processing";
  const listening = recorder.state === "listening";
  const disabled = recorder.state === "unsupported" || busy;

  return (
    <div className="space-y-6">
      {/* Standing limitation notice — true before anyone presses anything. */}
      {!canSpeakTarget ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4">
          <VolumeX
            className="mt-0.5 size-5 shrink-0 text-warning-foreground"
            aria-hidden
          />
          <div className="text-sm text-warning-foreground">
            <p className="font-semibold">{ttsUnavailableMessage}</p>
            <p className="mt-1">
              Speech recognition and translation both work. Only the final
              read-aloud step is unavailable — the configured provider has no{" "}
              {targetLanguage.name} voice, and this app will not read{" "}
              {targetLanguage.name} text in another language&rsquo;s voice.
            </p>
          </div>
        </div>
      ) : null}

      {/* Recorder */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                recorder.state === "error"
                  ? "destructive"
                  : recorder.state === "completed"
                    ? "success"
                    : listening
                      ? "warning"
                      : "outline"
              }
            >
              {STATE_LABEL[recorder.state] ?? recorder.state}
            </Badge>
            {isDemo ? <Badge variant="warning">Demo mode</Badge> : null}
          </div>

          <button
            type="button"
            onClick={listening ? recorder.stop : recorder.start}
            disabled={disabled}
            aria-label={listening ? "Stop recording" : "Start speaking"}
            className={cn(
              "flex size-40 flex-col items-center justify-center gap-2 rounded-full text-lg font-semibold transition-colors disabled:opacity-50 sm:size-48",
              listening
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {busy ? (
              <Loader2 className="size-12 animate-spin" aria-hidden />
            ) : listening ? (
              <Square className="size-12" aria-hidden />
            ) : (
              <Mic className="size-12" aria-hidden />
            )}
            <span>{busy ? "Working…" : listening ? "STOP" : "SPEAK"}</span>
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {recorder.state === "unsupported"
              ? "Audio recording is not available in this browser."
              : listening
                ? `Listening… ${(recorder.elapsedMs / 1000).toFixed(1)}s — press STOP when finished.`
                : busy
                  ? "Transcribing and translating…"
                  : `Press SPEAK, say a sentence in ${sourceLanguage.name}, then press STOP.`}
          </p>

          {recorder.error ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-center text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {recorder.error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Result */}
      {result ? (
        <Card>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Teacher said
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-lg leading-relaxed">
                {result.transcript}
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {targetLanguage.name}
              </p>
              <p
                className={cn(
                  "mt-1.5 whitespace-pre-wrap text-lg leading-relaxed",
                  // Demo output is a plain notice, not Santhali script.
                  targetIsOlChiki && !result.isDemo && "font-ol-chiki",
                  result.isDemo && "text-muted-foreground",
                )}
              >
                {result.translation}
              </p>
            </div>

            <div className="border-t border-border pt-4">
              {result.audioUrl ? (
                <>
                  <Button onClick={togglePlay} size="lg">
                    {isPlaying ? <Pause aria-hidden /> : <Play aria-hidden />}
                    {isPlaying ? "Pause" : "Play"}
                  </Button>
                  <audio
                    ref={audioRef}
                    src={result.audioUrl}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                </>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/40 p-3">
                  <VolumeX
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <p className="text-sm text-muted-foreground">
                    {result.audioUnavailableReason ?? ttsUnavailableMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Measured, not estimated. */}
            <dl className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              <div className="flex gap-1">
                <dt>Response time:</dt>
                <dd className="font-medium tabular-nums">
                  {(result.processingTimeMs / 1000).toFixed(2)} s
                </dd>
              </div>
              <div className="flex gap-1">
                <dt>Speech:</dt>
                <dd className="tabular-nums">{result.timings.transcribeMs} ms</dd>
              </div>
              <div className="flex gap-1">
                <dt>Translation:</dt>
                <dd className="tabular-nums">{result.timings.translateMs} ms</dd>
              </div>
              <div className="flex gap-1">
                <dt>Audio:</dt>
                <dd className="tabular-nums">
                  {result.timings.synthesizeMs
                    ? `${result.timings.synthesizeMs} ms`
                    : "not generated"}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Measured end to end on this request, including network time to the
              provider. The project target is under 3 seconds; this is whatever
              it actually took.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
