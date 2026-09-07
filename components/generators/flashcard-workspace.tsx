"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Save,
  Shuffle,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  GeneratorForm,
  type GeneratorInputs,
} from "@/components/generators/generator-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FlashcardDeck } from "@/lib/ai/generated-content";
import { cn } from "@/lib/utils";

type Failure = { success: false; error: { code: string; message: string } };
type Success = {
  success: true;
  deck: FlashcardDeck;
  provider: string;
  model: string;
  translationNote: string | null;
  processingTimeMs: number;
};

export function FlashcardWorkspace({
  sourceName,
  sourceCode,
  targetName,
  targetIsOlChiki,
  llmConfigured,
  canSpeakSource,
  ttsUnavailableMessage,
}: {
  sourceName: string;
  sourceCode: string;
  targetName: string;
  targetIsOlChiki: boolean;
  llmConfigured: boolean;
  /** Whether the TTS provider can speak the language of instruction. */
  canSpeakSource: boolean;
  ttsUnavailableMessage: string;
}) {
  const [inputs, setInputs] = useState<GeneratorInputs>({
    grade: "",
    subject: "",
    topic: "",
    difficulty: "easy",
    count: "8",
    questionTypes: ["SHORT_ANSWER"],
  });

  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [position, setPosition] = useState(0);
  const [meta, setMeta] = useState<{
    provider: string;
    model: string;
    translationNote: string | null;
  } | null>(null);
  const [isEdited, setIsEdited] = useState(false);
  const [busy, setBusy] = useState<null | "generate" | "save" | "audio">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cardIndex = order[position] ?? 0;
  const card = deck?.cards[cardIndex];

  const generate = async () => {
    setBusy("generate");
    setError(null);
    setSaved(null);

    try {
      const response = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: inputs.grade ? Number(inputs.grade) : null,
          subject: inputs.subject || null,
          topic: inputs.topic,
          count: Number(inputs.count) || 8,
        }),
      });
      const payload = (await response.json()) as Success | Failure;

      if (!payload.success) {
        setError(payload.error.message);
        return;
      }

      setDeck(payload.deck);
      setOrder(payload.deck.cards.map((_, index) => index));
      setPosition(0);
      setMeta({
        provider: payload.provider,
        model: payload.model,
        translationNote: payload.translationNote,
      });
      setIsEdited(false);
    } catch {
      setError("Could not reach the server. Check the connection.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!deck) return;
    setBusy("save");
    setError(null);

    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: inputs.grade ? Number(inputs.grade) : null,
          subject: inputs.subject || null,
          deck,
          provider: meta?.provider ?? null,
          model: meta?.model ?? null,
          isEdited,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; cardCount: number }
        | Failure;

      if (!payload.success) {
        setError(payload.error.message);
        return;
      }
      setSaved(`Saved ${payload.cardCount} cards.`);
    } catch {
      setError("Could not save. Check the connection.");
    } finally {
      setBusy(null);
    }
  };

  /**
   * Speaks the term in the language of instruction only.
   *
   * There is no mother-tongue voice, and reading a Santhali word aloud with a
   * Hindi voice would produce confident-sounding audio that is not Santhali.
   * So this button is explicitly the source-language button.
   */
  const listen = async () => {
    if (!card) return;
    setBusy("audio");
    setError(null);

    try {
      const response = await fetch("/api/speech/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The example sentence gives the voice something to pronounce
          // naturally; a bare word is often clipped.
          text: card.exampleSentence || card.term,
          languageCode: sourceCode,
        }),
      });
      const payload = (await response.json()) as
        | { success: true; audioUrl: string }
        | Failure;

      if (!payload.success) {
        setError(payload.error.message);
        return;
      }
      if (audioRef.current) {
        audioRef.current.src = payload.audioUrl;
        void audioRef.current.play();
      }
    } catch {
      setError("Could not play the audio.");
    } finally {
      setBusy(null);
    }
  };

  const shuffle = () => {
    if (!deck) return;
    const next = [...order];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setOrder(next);
    setPosition(0);
  };

  const updateCard = (patch: Partial<FlashcardDeck["cards"][number]>) => {
    if (!deck || !card) return;
    const cards = [...deck.cards];
    cards[cardIndex] = { ...card, ...patch };
    setDeck({ ...deck, cards });
    setIsEdited(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Build a flashcard set</CardTitle>
          <CardDescription>
            One word per card, with a picture icon and an example sentence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GeneratorForm
            inputs={inputs}
            onChange={setInputs}
            sourceName={sourceName}
            targetName={targetName}
            disabled={!llmConfigured}
            busy={busy === "generate"}
            onGenerate={generate}
            generateLabel={deck ? "Regenerate" : "Generate"}
            showTypes={false}
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
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {deck && card ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-medium">{deck.title}</p>
            <Badge variant="outline">
              {position + 1} / {deck.cards.length}
            </Badge>
            {isEdited ? <Badge variant="outline">edited</Badge> : null}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" onClick={shuffle}>
                <Shuffle aria-hidden />
                Shuffle
              </Button>
              <Button onClick={save} disabled={busy !== null}>
                <Save aria-hidden />
                {busy === "save" ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          {saved ? (
            <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
              {saved}
            </p>
          ) : null}

          {/* The card */}
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="text-center">
                <div aria-hidden className="text-6xl sm:text-7xl">
                  {card.icon ?? "📘"}
                </div>

                <input
                  value={card.term}
                  onChange={(event) => updateCard({ term: event.target.value })}
                  aria-label={`${sourceName} word`}
                  className="mt-5 w-full rounded-md border border-transparent bg-transparent text-center text-3xl font-semibold hover:border-input focus:border-input"
                />
                <p className="text-xs text-muted-foreground">{sourceName}</p>

                <input
                  value={card.termSat ?? ""}
                  placeholder={`Not translated — type the ${targetName} word`}
                  onChange={(event) =>
                    updateCard({ termSat: event.target.value || null })
                  }
                  aria-label={`${targetName} word`}
                  className={cn(
                    "mt-4 w-full rounded-md border border-transparent bg-transparent text-center text-3xl font-semibold hover:border-input focus:border-input",
                    targetIsOlChiki && card.termSat && "font-ol-chiki",
                  )}
                />
                <p className="text-xs text-muted-foreground">{targetName}</p>
              </div>

              <div className="mt-6 space-y-3 border-t border-border pt-4">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">
                    Meaning
                  </span>
                  <input
                    value={card.meaning}
                    onChange={(event) => updateCard({ meaning: event.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </label>
                <div className="grid gap-2 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">
                      Example · {sourceName}
                    </span>
                    <textarea
                      value={card.exampleSentence}
                      rows={2}
                      onChange={(event) =>
                        updateCard({ exampleSentence: event.target.value })
                      }
                      className="mt-1 w-full resize-y rounded-md border border-input bg-card p-2.5 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">
                      Example · {targetName}
                    </span>
                    <textarea
                      value={card.exampleSentenceSat ?? ""}
                      rows={2}
                      placeholder="Not translated"
                      onChange={(event) =>
                        updateCard({
                          exampleSentenceSat: event.target.value || null,
                        })
                      }
                      className={cn(
                        "mt-1 w-full resize-y rounded-md border border-input bg-card p-2.5 text-sm",
                        targetIsOlChiki &&
                          card.exampleSentenceSat &&
                          "font-ol-chiki",
                      )}
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              variant="outline"
              onClick={() => setPosition((p) => Math.max(0, p - 1))}
              disabled={position === 0}
            >
              <ChevronLeft aria-hidden />
              Previous
            </Button>

            {canSpeakSource ? (
              <Button size="lg" onClick={listen} disabled={busy !== null}>
                {busy === "audio" ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Volume2 aria-hidden />
                )}
                Listen ({sourceName})
              </Button>
            ) : (
              <Button size="lg" variant="outline" disabled title={ttsUnavailableMessage}>
                <VolumeX aria-hidden />
                Listen
              </Button>
            )}

            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                setPosition((p) => Math.min(deck.cards.length - 1, p + 1))
              }
              disabled={position >= deck.cards.length - 1}
            >
              Next
              <ChevronRight aria-hidden />
            </Button>
          </div>

          <audio ref={audioRef} className="hidden" />

          <div className="space-y-2">
            <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground">
              <span className="font-semibold">
                AI-generated. Check each card before teaching from it.
              </span>{" "}
              The picture is an emoji chosen for the word, not a photograph —
              no image model is configured.
            </p>
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {targetName} words are left blank on purpose: a single word with no
              sentence around it translates unreliably, and a wrong word is what
              a child copies down. Type them in yourself.
              {canSpeakSource
                ? ` Listen speaks the ${sourceName} example only — there is no ${targetName} voice.`
                : ` ${ttsUnavailableMessage}`}
            </p>
            {meta?.translationNote ? (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                {meta.translationNote}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
