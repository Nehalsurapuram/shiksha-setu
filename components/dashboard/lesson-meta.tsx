import { Badge } from "@/components/ui/badge";
import type { LessonCard } from "@/lib/database/queries";
import { cn } from "@/lib/utils";

/** Status pill. Colour follows the same meaning as everywhere else in the app. */
export function LessonStatusBadge({ status }: { status: LessonCard["status"] }) {
  if (status === "READY") return <Badge variant="success">Ready</Badge>;
  if (status === "ARCHIVED") return <Badge variant="outline">Archived</Badge>;
  return <Badge variant="secondary">Draft</Badge>;
}

/**
 * The lesson's configured language pair.
 *
 * This is a setting on the lesson, not a claim that a translation exists — the
 * label deliberately reads as a direction, and the Recent Lessons table shows
 * translation counts separately.
 */
export function LanguagePair({
  lesson,
  className,
}: {
  lesson: Pick<LessonCard, "sourceLanguage" | "targetLanguage">;
  className?: string;
}) {
  return (
    <span className={cn("whitespace-nowrap", className)}>
      {lesson.sourceLanguage.name}
      <span aria-hidden> → </span>
      <span className="sr-only">to</span>
      {lesson.targetLanguage.name}
    </span>
  );
}

/** "Class 2 · EVS" — omits whichever half is missing rather than printing null. */
export function LessonClassSubject({ lesson }: { lesson: LessonCard }) {
  const parts = [
    lesson.grade !== null ? `Class ${lesson.grade}` : null,
    lesson.subject,
  ].filter(Boolean);

  return <>{parts.length ? parts.join(" · ") : "—"}</>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatLessonDate(value: Date): string {
  return DATE_FORMAT.format(value);
}

/** "Today" / "Yesterday" / "3 days ago", for the Continue teaching cards. */
export function formatRelativeDay(value: Date, now: Date): string {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(value)) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return DATE_FORMAT.format(value);
}

/** Marks seeded demo content so it is never read as a teacher's own history. */
export function SampleBadge() {
  return (
    <Badge variant="outline" title="Seeded demo content, not your own lesson">
      Sample
    </Badge>
  );
}
