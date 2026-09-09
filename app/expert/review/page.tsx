import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { ReviewCard, type ReviewItem } from "@/components/expert/review-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getCurrentExpert,
  getReviewCounts,
  isPromotable,
  listPendingReviews,
  listReviewedCorrections,
  suggestedTerm,
  type CorrectionForReview,
} from "@/lib/validation/review";

export const metadata: Metadata = { title: "Expert review" };
export const dynamic = "force-dynamic";

/**
 * Where a language expert validates what teachers have corrected.
 *
 * The whole screen exists because the model cannot be trusted on Santhali and
 * neither, on its own, can a single teacher's correction. Approval here is what
 * turns "somebody typed this" into "somebody who speaks the language says this
 * is right" — the only basis on which anything is marked verified.
 */
export default async function ExpertReviewPage() {
  const [pending, reviewed, counts, expert] = await Promise.all([
    listPendingReviews(),
    listReviewedCorrections(),
    getReviewCounts(),
    getCurrentExpert(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Expert review</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Teachers&apos; corrections, waiting for someone who speaks the
              mother tongue to rule on them.
            </p>
          </div>
          <Link
            href="/translator"
            className="text-sm underline underline-offset-2"
          >
            Back to the app
          </Link>
        </div>
      </header>

      {/* The chain this page sits in the middle of. */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Step label="AI translation" tone="muted" />
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          <Step label="Teacher / expert correction" tone="accent" />
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          <Step label="Verified translation" tone="success" />
          <span className="ml-auto text-xs text-muted-foreground">
            {counts.pending} waiting · {counts.approved} approved ·{" "}
            {counts.rejected} rejected · {counts.verifiedTerms} verified terms
          </span>
        </CardContent>
      </Card>

      {!expert ? (
        <p className="mb-6 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            No account on this installation holds the{" "}
            <strong>Language expert</strong> role, so nothing here can be
            approved. Give a user that role first — approval has to be
            attributable to a person.
          </span>
        </p>
      ) : (
        <p className="mb-6 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Acting as <strong>{expert.name}</strong> ({expert.role}). This
          prototype has no sign-in, so this screen is reachable by anyone who
          knows the URL and decisions are attributed to the first account holding
          the role. Authentication is not built yet, and this page says so rather
          than implying a gate that is not there.
        </p>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Waiting for review
            {counts.pending > 0 ? (
              <Badge variant="warning">{counts.pending}</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Oldest first — a correction a teacher made three weeks ago is the one
            most likely to be in front of children already.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing is waiting. Corrections appear here as teachers make them,
              from the translator or from a tablet that was offline.
            </p>
          ) : (
            <ul className="space-y-4">
              {pending.map((correction) => (
                <ReviewCard key={correction.id} item={toItem(correction)} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {reviewed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Already reviewed</CardTitle>
            <CardDescription>
              The record of what was approved, rewritten or rejected, and by whom.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {reviewed.map((correction) => (
                <ReviewCard key={correction.id} item={toItem(correction)} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

function Step({
  label,
  tone,
}: {
  label: string;
  tone: "muted" | "accent" | "success";
}) {
  return (
    <span
      className={
        tone === "success"
          ? "rounded-full border border-success/40 bg-success/10 px-3 py-1 text-success"
          : tone === "accent"
            ? "rounded-full border border-primary/30 bg-primary/5 px-3 py-1"
            : "rounded-full border border-border px-3 py-1 text-muted-foreground"
      }
    >
      {label}
    </span>
  );
}

const formatDate = (value: Date) =>
  value.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function toItem(correction: CorrectionForReview): ReviewItem {
  const suggestion = suggestedTerm(correction);

  return {
    id: correction.id,
    sourceText: correction.translation.sourceText,
    // Older corrections predate the snapshot, so fall back to the translation's
    // current text and do not pretend the snapshot exists.
    aiTranslation: correction.aiTranslation ?? correction.translation.targetText,
    teacherText: correction.correctedText,
    teacherName: correction.correctedBy.name,
    reason: correction.reason,
    createdAtLabel: formatDate(correction.createdAt),
    status: correction.status,
    expertText: correction.expertText,
    reviewNote: correction.reviewNote,
    reviewedByName: correction.reviewedBy?.name ?? null,
    reviewedAtLabel: correction.reviewedAt ? formatDate(correction.reviewedAt) : null,
    sourceLanguageName: correction.translation.sourceLanguage.name,
    targetLanguageName: correction.translation.targetLanguage.name,
    targetIsOlChiki: correction.translation.targetLanguage.script === "OL_CHIKI",
    promoted: Boolean(correction.promotedTermId),
    promotable: isPromotable(suggestion.sourceTerm),
    suggestedSourceTerm: suggestion.sourceTerm,
    suggestedTargetTerm: suggestion.targetTerm,
  };
}
