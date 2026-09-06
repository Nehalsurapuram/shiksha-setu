import Link from "next/link";
import { BookOpen } from "lucide-react";

import {
  formatLessonDate,
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
 * Table on wide screens, stacked cards on a phone.
 *
 * A table that scrolls sideways is unusable on a tablet held in one hand, so
 * the same data is rendered twice rather than squeezed into one layout.
 */
export function RecentLessons({ lessons }: { lessons: LessonCard[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Recent lessons</CardTitle>
          <CardDescription>
            Your lessons, most recently updated first.
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/lessons">All lessons</Link>
        </Button>
      </CardHeader>

      <CardContent>
        {lessons.length === 0 ? (
          <EmptyLessons />
        ) : (
          <>
            {/* Wide: a real table, with proper header semantics. */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Lesson
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Class &amp; subject
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Language
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Updated
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((lesson) => (
                    <tr
                      key={lesson.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 pr-3">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{lesson.title}</span>
                          {lesson.isSample ? <SampleBadge /> : null}
                        </span>
                        {lesson.topic ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {lesson.topic}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        <LessonClassSubject lesson={lesson} />
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        <LanguagePair lesson={lesson} />
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">
                        {formatLessonDate(lesson.updatedAt)}
                      </td>
                      <td className="py-3">
                        <LessonStatusBadge status={lesson.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Narrow: one block per lesson. */}
            <ul className="divide-y divide-border md:hidden">
              {lessons.map((lesson) => (
                <li key={lesson.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {lesson.title}
                        {lesson.isSample ? <SampleBadge /> : null}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <LessonClassSubject lesson={lesson} /> ·{" "}
                        <LanguagePair lesson={lesson} />
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Updated {formatLessonDate(lesson.updatedAt)}
                      </p>
                    </div>
                    <LessonStatusBadge status={lesson.status} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyLessons() {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <BookOpen className="size-5" aria-hidden />
      </span>
      <p className="mt-3 font-medium">No lessons yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Lessons appear here once they exist in the database. Run the seed script
        to load a few sample lessons, or wait for lesson authoring in a later
        phase.
      </p>
    </div>
  );
}
