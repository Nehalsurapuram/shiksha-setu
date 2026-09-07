"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  QUESTION_TYPE_LABELS,
  type GeneratedQuestion,
  type WorksheetContent,
} from "@/lib/ai/generated-content";
import { cn } from "@/lib/utils";

/**
 * The editable worksheet / assessment.
 *
 * Every generated string is a text field. An empty mother-tongue box shows
 * "Not translated" as its placeholder rather than sitting blank, so a missing
 * translation reads as a missing translation and not as a missing question.
 */
export function SheetEditor({
  content,
  onChange,
  sourceName,
  targetName,
  targetIsOlChiki,
  showMarks,
}: {
  content: WorksheetContent;
  onChange: (next: WorksheetContent) => void;
  sourceName: string;
  targetName: string;
  targetIsOlChiki: boolean;
  showMarks?: boolean;
}) {
  const update = (patch: Partial<WorksheetContent>) =>
    onChange({ ...content, ...patch });

  const updateQuestion = (index: number, patch: Partial<GeneratedQuestion>) => {
    const questions = [...content.questions];
    questions[index] = { ...questions[index], ...patch };
    update({ questions });
  };

  const removeQuestion = (index: number) =>
    update({ questions: content.questions.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <Pair
            label="Title"
            sourceName={sourceName}
            targetName={targetName}
            targetIsOlChiki={targetIsOlChiki}
            value={content.title}
            valueSat={content.titleSat}
            onChange={(title) => update({ title })}
            onChangeSat={(titleSat) => update({ titleSat })}
          />
          <Pair
            label="Instructions"
            sourceName={sourceName}
            targetName={targetName}
            targetIsOlChiki={targetIsOlChiki}
            multiline
            value={content.instructions}
            valueSat={content.instructionsSat}
            onChange={(instructions) => update({ instructions })}
            onChangeSat={(instructionsSat) => update({ instructionsSat })}
          />
        </CardContent>
      </Card>

      {content.questions.map((question, index) => (
        <Card key={index} className="print:break-inside-avoid">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Q{index + 1}</span>
              <Badge variant="outline">
                {QUESTION_TYPE_LABELS[question.type] ?? question.type}
              </Badge>
              {question.icon ? (
                <span aria-hidden className="text-xl">
                  {question.icon}
                </span>
              ) : null}
              {showMarks ? (
                <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground print:hidden">
                  Marks
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={question.marks}
                    onChange={(event) =>
                      updateQuestion(index, {
                        marks: Number(event.target.value) || 1,
                      })
                    }
                    className="h-9 w-16 rounded-md border border-input bg-card px-2 text-sm"
                  />
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => removeQuestion(index)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-destructive print:hidden",
                  showMarks ? "" : "ml-auto",
                )}
              >
                Remove
              </button>
            </div>

            <Pair
              label="Question"
              sourceName={sourceName}
              targetName={targetName}
              targetIsOlChiki={targetIsOlChiki}
              multiline
              value={question.prompt}
              valueSat={question.promptSat}
              onChange={(prompt) => updateQuestion(index, { prompt })}
              onChangeSat={(promptSat) => updateQuestion(index, { promptSat })}
            />

            {question.options.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Options
                </p>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <input
                      key={optionIndex}
                      type="text"
                      value={option}
                      onChange={(event) => {
                        const options = [...question.options];
                        options[optionIndex] = event.target.value;
                        updateQuestion(index, { options });
                      }}
                      className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {question.pairs.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Matching pairs
                </p>
                <div className="mt-1 space-y-2">
                  {question.pairs.map((pair, pairIndex) => (
                    <div key={pairIndex} className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={pair.left}
                        onChange={(event) => {
                          const pairs = [...question.pairs];
                          pairs[pairIndex] = { ...pair, left: event.target.value };
                          updateQuestion(index, { pairs });
                        }}
                        className="h-10 rounded-md border border-input bg-card px-3 text-sm"
                      />
                      <input
                        type="text"
                        value={pair.right}
                        onChange={(event) => {
                          const pairs = [...question.pairs];
                          pairs[pairIndex] = { ...pair, right: event.target.value };
                          updateQuestion(index, { pairs });
                        }}
                        className="h-10 rounded-md border border-input bg-card px-3 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Marked so the workspace can hide answers when printing a blank
                sheet for the class. */}
            <div data-answer>
              <Pair
                label="Answer"
                sourceName={sourceName}
                targetName={targetName}
                targetIsOlChiki={targetIsOlChiki}
                value={question.answer}
                valueSat={question.answerSat}
                onChange={(answer) => updateQuestion(index, { answer })}
                onChangeSat={(answerSat) => updateQuestion(index, { answerSat })}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {content.questions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No questions. Generate again, or add them by hand after saving.
        </p>
      ) : null}
    </div>
  );
}

function Pair({
  label,
  value,
  valueSat,
  onChange,
  onChangeSat,
  sourceName,
  targetName,
  targetIsOlChiki,
  multiline,
}: {
  label: string;
  value: string;
  valueSat: string | null;
  onChange: (value: string) => void;
  onChangeSat: (value: string | null) => void;
  sourceName: string;
  targetName: string;
  targetIsOlChiki: boolean;
  multiline?: boolean;
}) {
  const base =
    "mt-1 w-full rounded-md border border-input bg-card p-2.5 text-sm";

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          {label} · {sourceName}
        </span>
        {multiline ? (
          <textarea
            value={value}
            rows={2}
            onChange={(event) => onChange(event.target.value)}
            className={cn(base, "resize-y")}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={cn(base, "h-10")}
          />
        )}
      </label>
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">
          {label} · {targetName}
        </span>
        {multiline ? (
          <textarea
            value={valueSat ?? ""}
            rows={2}
            placeholder="Not translated"
            onChange={(event) => onChangeSat(event.target.value || null)}
            className={cn(base, "resize-y", targetIsOlChiki && valueSat && "font-ol-chiki")}
          />
        ) : (
          <input
            type="text"
            value={valueSat ?? ""}
            placeholder="Not translated"
            onChange={(event) => onChangeSat(event.target.value || null)}
            className={cn(base, "h-10", targetIsOlChiki && valueSat && "font-ol-chiki")}
          />
        )}
      </label>
    </div>
  );
}
