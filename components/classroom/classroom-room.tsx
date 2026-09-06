"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  MessagesSquare,
  Pause,
  Play,
  Save,
  Trash2,
} from "lucide-react";

import {
  MessageBubble,
  type ChatMessage,
} from "@/components/classroom/message-bubble";
import { SpeakerPanel } from "@/components/classroom/speaker-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type LanguageInfo = {
  code: string;
  name: string;
  isOlChiki: boolean;
  /** Whether speech recognition has a model for this language. */
  canTranscribe: boolean;
  /** Whether text-to-speech has a voice for this language. */
  canSpeak: boolean;
};

type TurnSuccess = {
  success: true;
  speaker: "teacher" | "student";
  sourceLanguage: { code: string; name: string };
  targetLanguage: { code: string; name: string };
  sourceText: string;
  translatedText: string;
  audioUrl: string | null;
  audioUnavailableReason: string | null;
  processingTimeMs: number;
  isDemo: boolean;
  translationId: string;
};

type TurnFailure = { success: false; error: { code: string; message: string } };

type Status = "idle" | "live" | "paused";

let turnCounter = 0;

export function ClassroomRoom({
  instruction,
  motherTongue,
  isDemo,
}: {
  instruction: LanguageInfo;
  motherTongue: LanguageInfo;
  isDemo: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const live = status === "live";

  const startClassroom = () => {
    startedAtRef.current = new Date().toISOString();
    setStatus("live");
    setError(null);
    setSaveNote(null);
  };

  const submitTurn = useCallback(
    async (speaker: "teacher" | "student", input: { audio?: Blob; text?: string }) => {
      setBusy(true);
      setError(null);
      setSaveNote(null);

      const form = new FormData();
      form.append("speaker", speaker);
      if (input.audio) form.append("audio", input.audio, "turn.webm");
      if (input.text) form.append("text", input.text);

      try {
        const response = await fetch("/api/classroom/turn", {
          method: "POST",
          body: form,
        });
        const payload = (await response.json()) as TurnSuccess | TurnFailure;

        if (!payload.success) {
          setError(payload.error.message);
          return;
        }

        const at = new Date().toISOString();
        const turnId = `turn-${++turnCounter}`;
        const spokenIsOlChiki =
          payload.sourceLanguage.code === motherTongue.code &&
          motherTongue.isOlChiki;
        const translatedIsOlChiki =
          payload.targetLanguage.code === motherTongue.code &&
          motherTongue.isOlChiki;

        setMessages((current) => [
          ...current,
          {
            id: `${turnId}-said`,
            role: speaker,
            turnId,
            languageCode: payload.sourceLanguage.code,
            languageName: payload.sourceLanguage.name,
            text: payload.sourceText,
            isOlChiki: spokenIsOlChiki,
            audioUrl: null,
            audioUnavailableReason: null,
            at,
            latencyMs: null,
            isDemo: payload.isDemo,
            side: speaker,
          },
          {
            id: `${turnId}-translated`,
            role: "ai",
            turnId,
            languageCode: payload.targetLanguage.code,
            languageName: payload.targetLanguage.name,
            text: payload.translatedText,
            isOlChiki: translatedIsOlChiki,
            audioUrl: payload.audioUrl,
            audioUnavailableReason: payload.audioUnavailableReason,
            at,
            latencyMs: payload.processingTimeMs,
            isDemo: payload.isDemo,
            // The translation belongs to whoever is meant to read it.
            side: speaker === "teacher" ? "student" : "teacher",
          },
        ]);

        // Keep the newest turn in view without yanking the page mid-read.
        window.requestAnimationFrame(() => {
          endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        });
      } catch {
        setError(
          "Could not reach the server. Check the connection and try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [motherTongue.code, motherTongue.isOlChiki],
  );

  const clearConversation = () => {
    if (messages.length === 0) return;
    const ok = window.confirm(
      "Clear the conversation? Anything not saved will be lost.",
    );
    if (!ok) return;
    setMessages([]);
    setSaveNote(null);
    setError(null);
  };

  const saveSession = async () => {
    if (messages.length === 0) return;
    setSaving(true);
    setSaveNote(null);
    setError(null);

    // One row per turn: what was said, and what the other side was shown.
    const turns = messages.filter((message) => message.role !== "ai");
    const payload = {
      startedAt: startedAtRef.current ?? new Date().toISOString(),
      messages: turns.map((said) => {
        const translated = messages.find(
          (m) => m.role === "ai" && m.turnId === said.turnId,
        );
        return {
          speaker: said.role as "teacher" | "student",
          sourceText: said.text,
          translatedText: translated?.text ?? null,
          sourceLanguage: said.languageCode,
          targetLanguage: translated?.languageCode ?? said.languageCode,
          hadAudio: Boolean(translated?.audioUrl),
          latencyMs: translated?.latencyMs ?? null,
          spokenAt: said.at,
        };
      }),
    };

    try {
      const response = await fetch("/api/classroom/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as
        | { success: true; messageCount: number }
        | TurnFailure;

      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSaveNote(`Saved ${result.messageCount} turns to this school's records.`);
    } catch {
      setError("Could not save the session. Check the connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Badge
            variant={
              live ? "success" : status === "paused" ? "warning" : "outline"
            }
          >
            {live ? "Live" : status === "paused" ? "Paused" : "Not started"}
          </Badge>
          {isDemo ? <Badge variant="warning">Demo mode</Badge> : null}

          <div className="ml-auto flex flex-wrap gap-2">
            {status === "idle" ? (
              <Button onClick={startClassroom}>
                <Play aria-hidden />
                Start Classroom
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setStatus(live ? "paused" : "live")}
              >
                {live ? <Pause aria-hidden /> : <Play aria-hidden />}
                {live ? "Pause" : "Resume"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={clearConversation}
              disabled={messages.length === 0}
            >
              <Trash2 aria-hidden />
              Clear Conversation
            </Button>
            <Button
              variant="outline"
              onClick={saveSession}
              disabled={messages.length === 0 || saving}
            >
              <Save aria-hidden />
              {saving ? "Saving…" : "Save Session"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {saveNote ? (
        <p
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success"
        >
          {saveNote}
        </p>
      ) : null}

      {/* Conversation */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <MessagesSquare className="size-5" aria-hidden />
              </span>
              <p className="mt-3 font-medium">
                {status === "idle"
                  ? "Press Start Classroom to begin"
                  : "No one has spoken yet"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Each turn shows what was said and what the other person was
                shown, so both sides can see the translation being used.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </ul>
          )}
          <div ref={endRef} />
        </CardContent>
      </Card>

      {/* Inputs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SpeakerPanel
          title="Teacher"
          subtitle={`Speaks ${instruction.name}`}
          languageName={instruction.name}
          placeholder={`Type in ${instruction.name}…`}
          isOlChiki={instruction.isOlChiki}
          accent="teacher"
          disabled={!live}
          disabledReason={
            status === "idle"
              ? "Press Start Classroom first."
              : "Paused — press Resume to continue."
          }
          busy={busy}
          canSpeak={instruction.canTranscribe}
          cannotSpeakReason={
            instruction.canTranscribe
              ? null
              : `Speech recognition is unavailable for ${instruction.name}. Type instead.`
          }
          onSubmit={(input) => submitTurn("teacher", input)}
        />

        <SpeakerPanel
          title="Student"
          subtitle={`Speaks ${motherTongue.name}`}
          languageName={motherTongue.name}
          placeholder={`Type in ${motherTongue.name}…`}
          isOlChiki={motherTongue.isOlChiki}
          accent="student"
          disabled={!live}
          disabledReason={
            status === "idle"
              ? "Press Start Classroom first."
              : "Paused — press Resume to continue."
          }
          busy={busy}
          canSpeak={motherTongue.canTranscribe}
          cannotSpeakReason={
            motherTongue.canTranscribe
              ? null
              : `Speech recognition is unavailable for ${motherTongue.name}. Type instead.`
          }
          onSubmit={(input) => submitTurn("student", input)}
        />
      </div>
    </div>
  );
}
