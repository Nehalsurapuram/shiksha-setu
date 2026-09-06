"use client";

import { useActionState, useEffect } from "react";

import { saveCorrection, type CorrectionState } from "@/app/(app)/translator/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INITIAL: CorrectionState = { status: "idle" };

/**
 * Edit-and-save for a translation.
 *
 * Submits to the `saveCorrection` Server Action, which stores the teacher's
 * text as a correction row rather than overwriting what the model produced.
 */
export function CorrectionForm({
  translationId,
  initialText,
  isOlChiki,
  onCancel,
  onSaved,
  formId,
}: {
  translationId: string;
  initialText: string;
  isOlChiki: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
  /**
   * When set, the form renders no submit button of its own — a Save button
   * elsewhere on the page submits it via the HTML `form` attribute. Used by the
   * translator so Save sits with Copy, Edit and Listen in one row.
   */
  formId?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    saveCorrection,
    INITIAL,
  );

  useEffect(() => {
    if (state.status === "saved") onSaved?.();
  }, [state.status, onSaved]);

  return (
    <form id={formId} action={formAction} className="space-y-3">
      <input type="hidden" name="translationId" value={translationId} />

      <div>
        <label
          htmlFor={`corrected-${translationId}`}
          className="text-sm font-medium"
        >
          Corrected translation
        </label>
        <textarea
          id={`corrected-${translationId}`}
          name="correctedText"
          defaultValue={initialText}
          rows={5}
          className={cn(
            "mt-1.5 w-full resize-y rounded-md border border-input bg-card p-3 text-base leading-relaxed",
            isOlChiki && "font-ol-chiki",
          )}
        />
      </div>

      <div>
        <label
          htmlFor={`reason-${translationId}`}
          className="text-sm font-medium"
        >
          What was wrong? <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id={`reason-${translationId}`}
          name="reason"
          type="text"
          placeholder="e.g. wrong word for 'root'"
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Your correction is saved alongside the original, not over it, so the
        difference can be used to improve later translations.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {formId ? (
          isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Saving…
            </p>
          ) : null
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save correction"}
          </Button>
        )}
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      {state.status === "saved" && state.message ? (
        <p role="status" className="text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
