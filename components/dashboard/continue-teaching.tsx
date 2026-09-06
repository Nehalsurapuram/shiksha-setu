import Link from "next/link";
import { Clock, Pin } from "lucide-react";

import {
  formatRelativeDay,
  LanguagePair,
  LessonClassSubject,
  LessonStatusBadge,
  SampleBadge,
} from "@/components/dashboard/lesson-meta";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LessonCard } from "@/lib/database/queries";

/**
 * Lessons the teacher has opened before, with the three things they would want
 * to do next.
 *
 * "Open" goes to Lessons, "Translate" to the Translator and "Generate
 * materials" to Worksheets. All three are navigation only — nothing here runs
 * a translation or generates anything, and each destination says so.
 */
export function ContinueTeaching({
  lessons,
  now,
}: {
  lessons: LessonCard[];
  now: Date;
}) {
  if (lessons.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Continue teaching</CardTitle>
        <CardDescription>
          Lessons you opened most recently. Ordered by when each was last
          opened.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 lg:grid-cols-3">
        {lessons.map((lesson) => (
          <article
            key={lesson.id}
            className="flex flex-col rounded-xl border border-border bg-muted/30 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 font-semibold leading-tight">
                {lesson.title}
              </h3>
              <LessonStatusBadge status={lesson.status} />
            </div>

            <p className="mt-1.5 text-sm text-muted-foreground">
              <LessonClassSubject lesson={lesson} /> ·{" "}
              <LanguagePair lesson={lesson} />
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {lesson.lastOpenedAt ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {formatRelativeDay(lesson.lastOpenedAt, now)}
                </span>
              ) : null}
              {lesson.isOfflinePinned ? (
                <span
                  className="inline-flex items-center gap-1"
                  title="Kept on this tablet for offline use"
                >
                  <Pin className="size-3.5" aria-hidden />
                  Pinned offline
                </span>
              ) : null}
              {lesson.isSample ? <SampleBadge /> : null}
            </div>

            {/* mt-auto pins the actions to the card's bottom edge, so they line
                up across cards whose text wraps to different heights. */}
            <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
              <Button asChild size="sm">
                <Link href="/lessons">Open</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/translator">Translate</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="col-span-2"
              >
                <Link href="/worksheets">Generate materials</Link>
              </Button>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
