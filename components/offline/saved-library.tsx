"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Languages,
  Layers,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAll,
  type OfflineAssessment,
  type OfflineFlashcard,
  type OfflineLesson,
  type OfflineTranslation,
  type OfflineWorksheet,
} from "@/lib/offline/db";
import { playCachedAudio } from "@/lib/offline/sync";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { cn } from "@/lib/utils";

type Tab = "lessons" | "worksheets" | "flashcards" | "assessments" | "translations";

const TABS: Array<{ key: Tab; label: string; icon: typeof BookOpen }> = [
  { key: "lessons", label: "Lessons", icon: BookOpen },
  { key: "worksheets", label: "Worksheets", icon: FileText },
  { key: "flashcards", label: "Flashcards", icon: Layers },
  { key: "assessments", label: "Assessments", icon: ClipboardCheck },
  { key: "translations", label: "Translations", icon: Languages },
];

/**
 * Reads everything from IndexedDB, never from the network.
 *
 * That is the whole point: this screen behaves identically with the network on
 * or off, because it never had a server to lose. If it renders content here,
 * that content is genuinely on the tablet.
 */
export function SavedLibrary({
  targetIsOlChiki,
}: {
  targetIsOlChiki: boolean;
}) {
  const { isOnline, hasChecked } = useOnlineStatus();
  const [tab, setTab] = useState<Tab>("lessons");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);

  const [lessons, setLessons] = useState<OfflineLesson[]>([]);
  const [worksheets, setWorksheets] = useState<OfflineWorksheet[]>([]);
  const [flashcards, setFlashcards] = useState<OfflineFlashcard[]>([]);
  const [assessments, setAssessments] = useState<OfflineAssessment[]>([]);
  const [translations, setTranslations] = useState<OfflineTranslation[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [l, w, f, a, t] = await Promise.all([
          getAll("lessons"),
          getAll("worksheets"),
          getAll("flashcards"),
          getAll("assessments"),
          getAll("translations"),
        ]);
        if (cancelled) return;
        setLessons(l as OfflineLesson[]);
        setWorksheets(w as OfflineWorksheet[]);
        setFlashcards(f as OfflineFlashcard[]);
        setAssessments(a as OfflineAssessment[]);
        setTranslations(t as OfflineTranslation[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const counts: Record<Tab, number> = {
    lessons: lessons.length,
    worksheets: worksheets.length,
    flashcards: flashcards.length,
    assessments: assessments.length,
    translations: translations.length,
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const offline = hasChecked && !isOnline;

  const play = useCallback(async (cardId: string) => {
    setAudioMessage(null);
    try {
      const played = await playCachedAudio(`flashcard:${cardId}`);
      if (!played) {
        setAudioMessage(
          "No audio is cached for this card. Cache it from Offline & Sync while online.",
        );
      }
    } catch {
      setAudioMessage("Could not play the cached audio.");
    }
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Reading saved content from this device…
      </p>
    );
  }

  if (total === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <p className="font-medium">Nothing is saved on this device yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {offline
              ? "You are offline, so nothing can be downloaded right now. Connect and download from Offline & Sync."
              : "Go to Offline & Sync and press “Download for offline”."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((entry) => {
          const Icon = entry.icon;
          const active = tab === entry.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                setTab(entry.key);
                setOpenId(null);
              }}
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {entry.label}
              <span className="tabular-nums opacity-70">{counts[entry.key]}</span>
            </button>
          );
        })}
      </div>

      {audioMessage ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
          {audioMessage}
        </p>
      ) : null}

      {tab === "lessons" ? (
        <List
          rows={lessons}
          empty="No lessons saved on this device."
          renderTitle={(row) => row.title}
          renderMeta={(row) =>
            [row.grade ? `Class ${row.grade}` : null, row.subject, row.topic]
              .filter(Boolean)
              .join(" · ")
          }
          renderBadge={(row) => (row.isSample ? "Sample" : null)}
          openId={openId}
          onToggle={setOpenId}
          renderBody={(row) => (
            <div className="space-y-3 text-sm">
              <Section label="Source text">{row.sourceText}</Section>
              {row.translatedText ? (
                <Section label="Mother tongue" olChiki={targetIsOlChiki}>
                  {row.translatedText}
                </Section>
              ) : null}
              {row.teachingPackage ? (
                <p className="text-xs text-muted-foreground">
                  A generated teaching package is stored with this lesson.
                </p>
              ) : null}
            </div>
          )}
        />
      ) : null}

      {tab === "worksheets" ? (
        <List
          rows={worksheets}
          empty="No worksheets saved on this device."
          renderTitle={(row) => row.title}
          renderMeta={(row) =>
            [row.grade ? `Class ${row.grade}` : null, row.subject, row.difficulty]
              .filter(Boolean)
              .join(" · ")
          }
          renderBadge={(row) => row.kind}
          openId={openId}
          onToggle={setOpenId}
          renderBody={(row) => (
            <SheetBody content={row.content} olChiki={targetIsOlChiki} />
          )}
        />
      ) : null}

      {tab === "assessments" ? (
        <List
          rows={assessments}
          empty="No assessments saved on this device."
          renderTitle={(row) => row.title}
          renderMeta={(row) =>
            [row.grade ? `Class ${row.grade}` : null, row.subject, `${row.maxScore} marks`]
              .filter(Boolean)
              .join(" · ")
          }
          renderBadge={(row) => row.kind}
          openId={openId}
          onToggle={setOpenId}
          renderBody={(row) => (
            <SheetBody content={row.questions} olChiki={targetIsOlChiki} showAnswers />
          )}
        />
      ) : null}

      {tab === "flashcards" ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved flashcards</CardTitle>
            <CardDescription>
              Tap a card to hear it, if its audio was cached while online.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {flashcards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-border p-4 text-center"
                >
                  <div aria-hidden className="text-4xl">
                    {card.icon ?? "📘"}
                  </div>
                  <p className="mt-2 text-lg font-semibold">{card.frontText}</p>
                  <p
                    className={cn(
                      "text-sm",
                      card.backText
                        ? targetIsOlChiki && "font-ol-chiki"
                        : "text-muted-foreground",
                    )}
                  >
                    {card.backText || "Not translated"}
                  </p>
                  {card.exampleSentence ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {card.exampleSentence}
                    </p>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => play(card.id)}
                  >
                    <Volume2 aria-hidden />
                    Listen
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "translations" ? (
        <Card>
          <CardHeader>
            <CardTitle>Saved translations</CardTitle>
            <CardDescription>
              Translations already made and stored. New text cannot be
              translated without a connection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {translations.slice(0, 100).map((row) => (
                <li key={row.id} className="py-3">
                  <p className="text-sm">{row.sourceText}</p>
                  <p
                    className={cn(
                      "mt-1 text-sm text-muted-foreground",
                      targetIsOlChiki && "font-ol-chiki",
                    )}
                  >
                    {row.correctedText ?? row.targetText}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {row.sourceLanguage} → {row.targetLanguage}
                    </span>
                    {row.correctedText ? (
                      <Badge variant="success">Corrected</Badge>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {translations.length > 100 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the 100 most recent of {translations.length}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function List<T extends { id: string }>({
  rows,
  empty,
  renderTitle,
  renderMeta,
  renderBadge,
  renderBody,
  openId,
  onToggle,
}: {
  rows: T[];
  empty: string;
  renderTitle: (row: T) => string;
  renderMeta: (row: T) => string;
  renderBadge?: (row: T) => string | null;
  renderBody: (row: T) => React.ReactNode;
  openId: string | null;
  onToggle: (id: string | null) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {empty}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const open = openId === row.id;
            const badge = renderBadge?.(row);
            return (
              <li key={row.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{renderTitle(row)}</p>
                    <p className="text-xs text-muted-foreground">
                      {renderMeta(row)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {badge ? <Badge variant="outline">{badge}</Badge> : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onToggle(open ? null : row.id)}
                      aria-expanded={open}
                    >
                      {open ? "Close" : "Open"}
                    </Button>
                  </div>
                </div>
                {open ? (
                  <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                    {renderBody(row)}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function Section({
  label,
  children,
  olChiki,
}: {
  label: string;
  children: React.ReactNode;
  olChiki?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 whitespace-pre-wrap", olChiki && "font-ol-chiki")}>
        {children}
      </p>
    </div>
  );
}

type StoredSheet = {
  title?: string;
  instructions?: string;
  questions?: Array<{
    type?: string;
    prompt?: string;
    promptSat?: string | null;
    answer?: string;
    options?: string[];
  }>;
};

function SheetBody({
  content,
  olChiki,
  showAnswers,
}: {
  content: unknown;
  olChiki: boolean;
  showAnswers?: boolean;
}) {
  const sheet = content as StoredSheet | null;
  const questions = sheet?.questions ?? [];

  if (questions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This item has no questions stored.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {sheet?.instructions ? (
        <p className="text-muted-foreground">{sheet.instructions}</p>
      ) : null}
      <ol className="space-y-3">
        {questions.map((question, index) => (
          <li key={index}>
            <p className="font-medium">
              Q{index + 1}. {question.prompt}
            </p>
            {question.promptSat ? (
              <p className={cn("text-muted-foreground", olChiki && "font-ol-chiki")}>
                {question.promptSat}
              </p>
            ) : null}
            {question.options && question.options.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {question.options.map((option, optionIndex) => (
                  <li key={optionIndex}>{option}</li>
                ))}
              </ul>
            ) : null}
            {showAnswers && question.answer ? (
              <p className="mt-1 text-xs text-success">Answer: {question.answer}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Exported so the page can show a consistent icon when nothing is cached. */
export const NoAudioIcon = VolumeX;
