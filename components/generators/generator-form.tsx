"use client";

import { Button } from "@/components/ui/button";
import {
  DIFFICULTIES,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type Difficulty,
  type QuestionType,
} from "@/lib/ai/generated-content";
import { cn } from "@/lib/utils";

export type GeneratorInputs = {
  grade: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  count: string;
  questionTypes: QuestionType[];
};

/**
 * The shared input panel for the worksheet and assessment generators.
 *
 * `allowedTypes` differs between them: a worksheet is practice a child does on
 * paper, an assessment can also be asked aloud.
 */
export function GeneratorForm({
  inputs,
  onChange,
  allowedTypes,
  sourceName,
  targetName,
  disabled,
  busy,
  onGenerate,
  generateLabel,
  showTypes = true,
}: {
  inputs: GeneratorInputs;
  onChange: (next: GeneratorInputs) => void;
  allowedTypes?: readonly QuestionType[];
  sourceName: string;
  targetName: string;
  disabled?: boolean;
  busy?: boolean;
  onGenerate: () => void;
  generateLabel: string;
  showTypes?: boolean;
}) {
  const types = allowedTypes ?? QUESTION_TYPES;

  const toggleType = (type: QuestionType) => {
    const has = inputs.questionTypes.includes(type);
    // Never allow an empty selection: the request would be rejected anyway,
    // and a disabled button with no explanation is worse than keeping the last.
    if (has && inputs.questionTypes.length === 1) return;
    onChange({
      ...inputs,
      questionTypes: has
        ? inputs.questionTypes.filter((value) => value !== type)
        : [...inputs.questionTypes, type],
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Labelled label="Class">
          <input
            type="number"
            min={1}
            max={12}
            value={inputs.grade}
            placeholder="e.g. 2"
            onChange={(event) => onChange({ ...inputs, grade: event.target.value })}
            className={FIELD}
          />
        </Labelled>
        <Labelled label="Subject">
          <input
            type="text"
            value={inputs.subject}
            placeholder="e.g. EVS"
            onChange={(event) => onChange({ ...inputs, subject: event.target.value })}
            className={FIELD}
          />
        </Labelled>
        <Labelled label="Difficulty">
          <select
            value={inputs.difficulty}
            onChange={(event) =>
              onChange({ ...inputs, difficulty: event.target.value as Difficulty })
            }
            className={FIELD}
          >
            {DIFFICULTIES.map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Number of questions">
          <input
            type="number"
            min={1}
            max={20}
            value={inputs.count}
            onChange={(event) => onChange({ ...inputs, count: event.target.value })}
            className={FIELD}
          />
        </Labelled>
      </div>

      <Labelled label="Topic">
        <input
          type="text"
          value={inputs.topic}
          placeholder="e.g. पानी के स्रोत"
          onChange={(event) => onChange({ ...inputs, topic: event.target.value })}
          className={FIELD}
        />
      </Labelled>

      {showTypes ? (
        <div>
          <p className="text-sm font-medium">Question types</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {types.map((type) => {
              const selected = inputs.questionTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  aria-pressed={selected}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {QUESTION_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-sm text-muted-foreground">
          Generated in {sourceName}, then translated into {targetName}. Both are
          editable before you save.
        </p>
      </div>

      <Button
        onClick={onGenerate}
        disabled={disabled || busy || !inputs.topic.trim()}
        size="lg"
      >
        {busy ? "Generating…" : generateLabel}
      </Button>
    </div>
  );
}

const FIELD =
  "mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm";

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
