"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AudioLines,
  BookOpen,
  ClipboardCheck,
  FileText,
  Languages,
  Layers,
  Library,
  Loader2,
  Pencil,
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
  listOutbox,
  type OfflineAssessment,
  type OfflineAudio,
  type OfflineCurriculumOutcome,
  type OfflineFlashcard,
  type OfflineLesson,
  type OfflineTranslation,
  type OfflineWorksheet,
  type OutboxItem,
} from "@/lib/offline/db";
import { queueCorrection } from "@/lib/offline/outbox";
import { playCachedAudio } from "@/lib/offline/sync";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { cn } from "@/lib/utils";

type Tab =
  | "lessons"
  | "worksheets"
  | "flashcards"
  | "assessments"
  | "translations"
  | "audio"
  | "curriculum";

const TABS: Array<{ key: Tab; label: string; icon: typeof BookOpen }> = [
  { key: "lessons", label: "Lessons", icon: BookOpen },
  { key: "worksheets", label: "Worksheets", icon: FileText },
  { key: "flashcards", label: "Flashcards", icon: Layers },
  { key: "assessments", label: "Assessments", icon: ClipboardCheck },
  { key: "translations", label: "Translations", icon: Languages },
  { key: "audio", label: "Audio", icon: AudioLines },
  { key: "curriculum", label: "Curriculum", icon: Library },
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
  const [audio, setAudio] = useState<OfflineAudio[]>([]);
  const [queued, setQueued] = useState<OutboxItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<OfflineCurriculumOutcome[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [l, w, f, a, t, clips, outcomes] = await Promise.all([
          getAll("lessons"),
          getAll("worksheets"),
          getAll("flashcards"),
          getAll("assessments"),
          getAll("translations"),
          getAll("audio"),
          getAll("curriculum"),
        ]);
        const outbox = await listOutbox();
        if (cancelled) return;
        setLessons(l as OfflineLesson[]);
        setWorksheets(w as OfflineWorksheet[]);
        setFlashcards(f as OfflineFlashcard[]);
        setAssessments(a as OfflineAssessment[]);
        setTranslations(t as OfflineTranslation[]);
        setAudio(clips as OfflineAudio[]);
        setCurriculum(outcomes as OfflineCurriculumOutcome[]);
        setQueued(outbox);
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
    audio: audio.length,
    curriculum: curriculum.length,
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const offline = hasChecked && !isOnline;

  const play = useCallback(async (ownerKey: string) => {
    setAudioMessage(null);
    try {
      const played = await playCachedAudio(ownerKey);
      if (!played) {
        setAudioMessage(
          "No audio is cached for this card. Cache it from Offline & Sync while online.",
        );
      }
    } catch {
      setAudioMessage("Could not play the cached audio.");
    }
  }, []);

  /**
   * Saves a correction with no server involved.
   *
   * The teacher's text lands in the local translation immediately and a queue
   * entry carries it to the server whenever a network next appears. Nothing
   * here waits on a request, because in the classroom this is written for
   * there may not be one for hours.
   */
  const saveCorrection = async (
    translationId: string,
    correctedText: string,
    reason: string,
  ) => {
    const result = await queueCorrection({
      translationId,
      correctedText: correctedText.trim(),
      reason: reason.trim() || null,
    });

    if ("error" in result) {
      setAudioMessage(result.error);
      return;
    }

    setTranslations((rows) =>
      rows.map((row) =>
        row.id === translationId
          ? { ...row, correctedText: correctedText.trim(), reviewStatus: "CORRECTED" }
          : row,
      ),
    );
    setQueued(await listOutbox());
    setEditing(null);
    setAudioMessage(null);
  };

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
                    onClick={() => play(`flashcard:${card.id}`)}
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
              Translations already made and stored. You can correct these with no
              connection — the correction is saved on the tablet and uploaded
              when the internet returns. Translating <em>new</em> text still needs
              a network.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {translations.slice(0, 100).map((row) => {
                const pending = queued.find(
                  (item) => item.entityId === row.id && item.status !== "SYNCED",
                );

                return (
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
                      {pending ? (
                        <Badge variant="warning">
                          {pending.status === "CONFLICT"
                            ? "Needs a decision"
                            : "Waiting to upload"}
                        </Badge>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(editing === row.id ? null : row.id)}
                        aria-expanded={editing === row.id}
                      >
                        <Pencil aria-hidden />
                        {editing === row.id ? "Cancel" : "Correct"}
                      </Button>
                    </div>

                    {editing === row.id ? (
                      <CorrectionEditor
                        initialText={row.correctedText ?? row.targetText}
                        isOlChiki={targetIsOlChiki}
                        onSave={(text, reason) => saveCorrection(row.id, text, reason)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {translations.length > 100 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Showing the 100 most recent of {translations.length}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {tab === "audio" ? (
        <Card>
          <CardHeader>
            <CardTitle>Cached audio</CardTitle>
            <CardDescription>
              Clips stored on this tablet as audio files, so they play with no
              network. Speech is only ever generated while online.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {audio.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No audio is cached on this device. Cache it from Offline &amp;
                Sync while connected.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {audio.map((clip) => (
                  <li
                    key={clip.id}
                    className="flex flex-wrap items-center gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {clip.transcript ?? clip.ownerKey}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {clip.languageCode} · {formatBytes(clip.sizeBytes)} ·
                        cached{" "}
                        {new Date(clip.cachedAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => play(clip.ownerKey)}
                    >
                      <Volume2 aria-hidden />
                      Play
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "curriculum" ? (
        <Card>
          <CardHeader>
            <CardTitle>Curriculum on this device</CardTitle>
            <CardDescription>
              Verified learning outcomes stored here. Only outcomes carrying a
              real citation are downloaded — offline there is no server to check
              one against.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {curriculum.length === 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  No verified curriculum data is stored on this device, because
                  none is loaded on the server.
                </p>
                <p>
                  Every alignment shown on a lesson, worksheet or assessment is
                  therefore labelled <strong>Suggested</strong> and carries no
                  outcome code — online and offline alike.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {curriculum.map((row) => (
                  <li key={row.id} className="py-3">
                    <p className="text-sm font-medium">{row.competency}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {row.outcome}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{row.learningArea}</span>
                      {row.classLevel ? <span>Class {row.classLevel}</span> : null}
                      {row.subject ? <span>{row.subject}</span> : null}
                      {row.code ? <Badge variant="outline">{row.code}</Badge> : null}
                      <Badge variant="success">{row.verifiedSource}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * Edit-and-save for a translation, with no network in the loop.
 *
 * The online translator posts a correction to a Server Action; that is
 * unavailable here by definition, so this writes to IndexedDB and the queue
 * instead. The wording matches the online form deliberately — a teacher should
 * not have to know which of the two they are using.
 */
function CorrectionEditor({
  initialText,
  isOlChiki,
  onSave,
}: {
  initialText: string;
  isOlChiki: boolean;
  onSave: (text: string, reason: string) => Promise<void>;
}) {
  const [text, setText] = useState(initialText);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/40 p-3">
      <div>
        <label className="text-sm font-medium" htmlFor={`fix-${initialText.length}`}>
          Corrected translation
        </label>
        <textarea
          id={`fix-${initialText.length}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          className={cn(
            "mt-1.5 w-full resize-y rounded-md border border-input bg-card p-3 text-base leading-relaxed",
            isOlChiki && "font-ol-chiki",
          )}
        />
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor={`why-${initialText.length}`}>
          What was wrong?{" "}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id={`why-${initialText.length}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. wrong word for 'root'"
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Saved on this tablet straight away, and sent to the server the next time
        there is a connection. Your correction is kept alongside the original,
        not over it.
      </p>

      <Button
        size="sm"
        disabled={saving || text.trim().length === 0}
        onClick={async () => {
          setSaving(true);
          await onSave(text, reason);
          setSaving(false);
        }}
      >
        {saving ? "Saving…" : "Save correction"}
      </Button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
