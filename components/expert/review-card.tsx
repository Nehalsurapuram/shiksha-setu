"use client";

import { useActionState, useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import {
  promoteToGlossary,
  recordDecision,
  type ReviewState,
} from "@/app/expert/review/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INITIAL: ReviewState = { status: "idle" };

export type ReviewItem = {
  id: string;
  sourceText: string;
  /** What the model produced. Snapshotted at correction time where available. */
  aiTranslation: string;
  teacherText: string;
  teacherName: string;
  reason: string | null;
  createdAtLabel: string;
  status: "UNREVIEWED" | "APPROVED" | "CORRECTED" | "REJECTED";
  expertText: string | null;
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAtLabel: string | null;
  sourceLanguageName: string;
  targetLanguageName: string;
  targetIsOlChiki: boolean;
  promoted: boolean;
  promotable: boolean;
  suggestedSourceTerm: string;
  suggestedTargetTerm: string;
};

/**
 * One correction, with everything an expert needs to judge it in view at once:
 * the Hindi, what the model made of it, and what the teacher says it should be.
 *
 * The three texts are always shown together and always labelled. An expert
 * approving a Santhali sentence without seeing the Hindi it came from is not
 * validating a translation, they are rating a sentence.
 */
export function ReviewCard({ item }: { item: ReviewItem }) {
  const [decisionState, decide, deciding] = useActionState(recordDecision, INITIAL);
  const [promoteState, promote, promoting] = useActionState(
    promoteToGlossary,
    INITIAL,
  );
  const [writing, setWriting] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

  const decided = item.status !== "UNREVIEWED";

  return (
    <li
      className={cn(
        "rounded-lg border p-4",
        item.status === "APPROVED" && "border-success/40 bg-success/5",
        item.status === "CORRECTED" && "border-primary/40 bg-primary/5",
        item.status === "REJECTED" && "border-destructive/30 bg-destructive/5",
        !decided && "border-border",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {item.sourceLanguageName} → {item.targetLanguageName}
        </span>
        <span>·</span>
        <span>corrected by {item.teacherName}</span>
        <span>·</span>
        <span>{item.createdAtLabel}</span>
        {item.status === "APPROVED" ? (
          <Badge variant="success">Approved</Badge>
        ) : null}
        {item.status === "CORRECTED" ? (
          <Badge variant="default">Expert wording</Badge>
        ) : null}
        {item.status === "REJECTED" ? (
          <Badge variant="destructive">Rejected</Badge>
        ) : null}
        {item.promoted ? <Badge variant="outline">In glossary</Badge> : null}
      </div>

      {/* The chain, in the order it happened. */}
      <div className="grid gap-3 md:grid-cols-3">
        <Panel label={`${item.sourceLanguageName} (original)`}>
          {item.sourceText}
        </Panel>
        <Panel label="AI translation" muted>
          <span className={cn(item.targetIsOlChiki && "font-ol-chiki")}>
            {item.aiTranslation}
          </span>
        </Panel>
        <Panel label="Teacher's correction" accent>
          <span className={cn(item.targetIsOlChiki && "font-ol-chiki")}>
            {item.teacherText}
          </span>
        </Panel>
      </div>

      {item.reason ? (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Teacher&apos;s note:</span>{" "}
          {item.reason}
        </p>
      ) : null}

      {item.expertText ? (
        <div className="mt-3 rounded-md border border-primary/40 bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Verified translation — expert&apos;s wording
          </p>
          <p className={cn("mt-1", item.targetIsOlChiki && "font-ol-chiki")}>
            {item.expertText}
          </p>
        </div>
      ) : null}

      {decided ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Reviewed by {item.reviewedByName ?? "an expert"}
          {item.reviewedAtLabel ? ` · ${item.reviewedAtLabel}` : ""}
          {item.reviewNote ? ` · “${item.reviewNote}”` : ""}
        </p>
      ) : null}

      {/* Decisions */}
      {!decided ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {!writing ? (
            <div className="flex flex-wrap gap-2">
              <form action={decide}>
                <input type="hidden" name="correctionId" value={item.id} />
                <input type="hidden" name="decision" value="APPROVED" />
                <Button type="submit" size="sm" disabled={deciding}>
                  <Check aria-hidden />
                  Approve
                </Button>
              </form>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setWriting(true)}
                disabled={deciding}
              >
                <Pencil aria-hidden />
                Correct
              </Button>

              <form action={decide}>
                <input type="hidden" name="correctionId" value={item.id} />
                <input type="hidden" name="decision" value="REJECTED" />
                <Button type="submit" size="sm" variant="outline" disabled={deciding}>
                  <X aria-hidden />
                  Reject
                </Button>
              </form>
            </div>
          ) : (
            <form action={decide} className="space-y-2">
              <input type="hidden" name="correctionId" value={item.id} />
              <input type="hidden" name="decision" value="CORRECTED" />
              <label className="text-sm font-medium" htmlFor={`expert-${item.id}`}>
                Your translation
              </label>
              <textarea
                id={`expert-${item.id}`}
                name="expertText"
                defaultValue={item.teacherText}
                rows={3}
                className={cn(
                  "w-full resize-y rounded-md border border-input bg-card p-3 text-base",
                  item.targetIsOlChiki && "font-ol-chiki",
                )}
              />
              <input
                name="note"
                placeholder="Why this wording? (optional)"
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The teacher&apos;s correction is kept as they wrote it. Yours is
                stored alongside as the verified translation.
              </p>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={deciding}>
                  Save as verified
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setWriting(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {/* Promotion to the verified glossary */}
      {decided && item.status !== "REJECTED" && !item.promoted ? (
        <div className="mt-4 border-t border-border pt-4">
          {!showPromote ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPromote(true)}
            >
              Add to verified glossary
            </Button>
          ) : (
            <form action={promote} className="space-y-2">
              <input type="hidden" name="correctionId" value={item.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium" htmlFor={`term-${item.id}`}>
                    Term ({item.sourceLanguageName})
                  </label>
                  <input
                    id={`term-${item.id}`}
                    name="sourceTerm"
                    defaultValue={item.suggestedSourceTerm}
                    className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-medium"
                    htmlFor={`target-${item.id}`}
                  >
                    Verified translation
                  </label>
                  <input
                    id={`target-${item.id}`}
                    name="targetTerm"
                    defaultValue={item.suggestedTargetTerm}
                    className={cn(
                      "mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm",
                      item.targetIsOlChiki && "font-ol-chiki",
                    )}
                  />
                </div>
              </div>
              <input
                name="domain"
                placeholder="Subject, e.g. science (optional)"
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
              />
              {!item.promotable ? (
                <p className="text-xs text-warning-foreground">
                  This looks like a sentence rather than a term. Shorten it to a
                  word or short phrase, or leave it as a verified translation —
                  a glossary of sentences matches nothing.
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={promoting}>
                  {promoting ? "Saving…" : "Save verified term"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPromote(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}

      {decisionState.message ? (
        <p
          role="status"
          className={cn(
            "mt-3 text-sm",
            decisionState.status === "error" ? "text-destructive" : "text-success",
          )}
        >
          {decisionState.message}
        </p>
      ) : null}
      {promoteState.message ? (
        <p
          role="status"
          className={cn(
            "mt-2 text-sm",
            promoteState.status === "error" ? "text-destructive" : "text-success",
          )}
        >
          {promoteState.message}
        </p>
      ) : null}
    </li>
  );
}

function Panel({
  label,
  children,
  muted,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        accent ? "border-primary/30 bg-card" : "border-border bg-card",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-sm", muted && "text-muted-foreground")}>
        {children}
      </p>
    </div>
  );
}
