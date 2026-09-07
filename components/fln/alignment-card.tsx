import { BadgeCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { StoredAlignment } from "@/lib/fln/alignment";
import { QUESTION_TYPE_LABELS, type GeneratedQuestion } from "@/lib/ai/generated-content";

/**
 * The Alignment card shown on generated material.
 *
 * Its heading is the load-bearing part. A verified alignment names the
 * document it came from; an unverified one is titled "Suggested FLN Alignment"
 * and says outright that nothing was checked against a curriculum document.
 *
 * Those two states never share wording. A teacher forwarding a worksheet to a
 * block officer has to be able to tell, at a glance, whether the alignment on
 * it is a citation or a guess.
 */
export function AlignmentCard({
  alignment,
  questions,
  variant,
  difficulty,
  note,
}: {
  alignment: StoredAlignment | null;
  /** Supplies question type and difficulty for the per-question table. */
  questions?: GeneratedQuestion[];
  variant: "lesson" | "worksheet" | "assessment";
  /** Sheet-level, shown per row because it applies to every question. */
  difficulty?: string | null;
  note?: string | null;
}) {
  if (!alignment) {
    return note ? (
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {note}
        </CardContent>
      </Card>
    ) : null;
  }

  const verified = alignment.status === "verified";

  return (
    <Card className={verified ? "border-success/40" : "border-warning/40 bg-warning/5"}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          {verified ? (
            <BadgeCheck className="size-5 text-success" aria-hidden />
          ) : (
            <TriangleAlert className="size-5 text-warning-foreground" aria-hidden />
          )}
          <h3 className="font-semibold">
            {verified ? "FLN Alignment" : "Suggested FLN Alignment"}
          </h3>
          <Badge variant={verified ? "success" : "warning"}>
            {verified ? "Verified source" : "Not verified"}
          </Badge>
        </div>

        {verified ? (
          <p className="text-sm text-muted-foreground">
            Matched against curriculum data loaded into this installation.
            Source: <span className="font-medium">{alignment.verifiedSource}</span>
            {alignment.code ? (
              <>
                {" "}· code <span className="font-mono">{alignment.code}</span>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-warning-foreground">
            This is a plain-language suggestion, not an official mapping. No
            NIPUN Bharat, NCERT or state curriculum document is loaded in this
            product, and nothing here has been checked against one. There are
            deliberately no outcome codes: a code would look authoritative and
            could not be verified. Check it against your own syllabus before
            recording it anywhere official.
          </p>
        )}

        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Learning area" value={alignment.learningArea} />
          <Field label="Competency" value={alignment.competency} />
          <Field
            label="Learning outcome"
            value={alignment.outcome}
            className="sm:col-span-2"
          />
          {variant === "lesson" && alignment.activity ? (
            <Field label="Activity" value={alignment.activity} />
          ) : null}
          {variant === "lesson" && alignment.assessment ? (
            <Field label="Assessment" value={alignment.assessment} />
          ) : null}
        </dl>

        {variant !== "lesson" && questions && questions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">
                    {variant === "assessment" ? "Question" : "Question type"}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {variant === "assessment" ? "Skill tested" : "Skill"}
                  </th>
                  <th className="py-2 font-medium">
                    {variant === "assessment" ? "Expected response" : "Difficulty"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => {
                  const skill =
                    alignment.questions.find(
                      (entry) => entry.questionIndex === index,
                    )?.skill ?? "—";

                  return (
                    <tr key={index} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3 font-medium">Q{index + 1}</td>
                      <td className="py-2 pr-3">
                        {variant === "assessment"
                          ? truncate(question.prompt, 70)
                          : (QUESTION_TYPE_LABELS[question.type] ?? question.type)}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{skill}</td>
                      <td className="py-2 text-muted-foreground">
                        {variant === "assessment"
                          ? truncate(question.answer, 50)
                          : (difficulty ?? "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!verified && alignment.provider ? (
          <p className="text-xs text-muted-foreground">
            Suggested by {alignment.provider} · {alignment.model}. Editable
            above; not saved as an official record.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
