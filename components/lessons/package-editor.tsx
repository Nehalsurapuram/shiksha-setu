"use client";

import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TeachingPackageContent } from "@/lib/ai/teaching-package";
import { cn } from "@/lib/utils";

type Props = {
  content: TeachingPackageContent;
  onChange: (next: TeachingPackageContent) => void;
  sourceName: string;
  targetName: string;
  targetIsOlChiki: boolean;
};

/**
 * The generated package, every field editable.
 *
 * Two columns throughout: the language of instruction on the left, the mother
 * tongue on the right. An empty right-hand box says "not translated" rather
 * than sitting blank, because a blank field reads as a lesson with a missing
 * part rather than as a translation that did not happen.
 */
export function PackageEditor({
  content,
  onChange,
  sourceName,
  targetName,
  targetIsOlChiki,
}: Props) {
  const update = (patch: Partial<TeachingPackageContent>) =>
    onChange({ ...content, ...patch });

  return (
    <div className="space-y-4">
      <Section
        index={1}
        title="Learning objective"
        hint="What a child should be able to do by the end."
      >
        <Bilingual
          value={content.learningObjective}
          onChange={(v) => update({ learningObjective: v })}
          sourceName={sourceName}
          targetName={targetName}
          targetIsOlChiki={targetIsOlChiki}
          rows={2}
        />
      </Section>

      <Section
        index={2}
        title="Teacher explanation"
        hint="The concept, in words the teacher can use directly."
      >
        <Bilingual
          value={content.teacherExplanation}
          onChange={(v) => update({ teacherExplanation: v })}
          sourceName={sourceName}
          targetName={targetName}
          targetIsOlChiki={targetIsOlChiki}
          rows={5}
        />
      </Section>

      <Section
        index={3}
        title="Teacher script"
        hint="What the teacher says aloud, start to finish."
      >
        <Bilingual
          value={content.teacherScript}
          onChange={(v) => update({ teacherScript: v })}
          sourceName={sourceName}
          targetName={targetName}
          targetIsOlChiki={targetIsOlChiki}
          rows={8}
        />
      </Section>

      <Section index={4} title="Vocabulary" hint="Key words for this lesson.">
        <div className="space-y-2">
          {content.vocabulary.length === 0 ? (
            <Empty label="No vocabulary was generated." />
          ) : null}
          {content.vocabulary.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-3"
            >
              <Field
                label="Term"
                value={item.term}
                onChange={(term) =>
                  update({
                    vocabulary: replaceAt(content.vocabulary, index, {
                      ...item,
                      term,
                    }),
                  })
                }
              />
              <Field
                label="Meaning"
                value={item.meaning}
                onChange={(meaning) =>
                  update({
                    vocabulary: replaceAt(content.vocabulary, index, {
                      ...item,
                      meaning,
                    }),
                  })
                }
              />
              <Field
                label={targetName}
                value={item.sat ?? ""}
                placeholder="Not translated"
                isOlChiki={targetIsOlChiki}
                onChange={(sat) =>
                  update({
                    vocabulary: replaceAt(content.vocabulary, index, {
                      ...item,
                      sat: sat || null,
                    }),
                  })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        index={5}
        title="Classroom activity"
        hint="Something runnable with a blackboard and village objects."
      >
        <div className="space-y-3">
          <Field
            label="Activity title"
            value={content.activity.title}
            onChange={(title) =>
              update({ activity: { ...content.activity, title } })
            }
          />
          <ListField
            label="Materials"
            values={content.activity.materials}
            onChange={(materials) =>
              update({ activity: { ...content.activity, materials } })
            }
          />
          <ListField
            label="Steps"
            values={content.activity.steps}
            onChange={(steps) =>
              update({ activity: { ...content.activity, steps } })
            }
          />
          <Field
            label={`${targetName} version`}
            value={content.activity.sat ?? ""}
            placeholder="Not translated"
            isOlChiki={targetIsOlChiki}
            multiline
            onChange={(sat) =>
              update({ activity: { ...content.activity, sat: sat || null } })
            }
          />
        </div>
      </Section>

      <Section index={6} title="Practice questions" hint="With answers.">
        <div className="space-y-2">
          {content.practiceQuestions.length === 0 ? (
            <Empty label="No questions were generated." />
          ) : null}
          {content.practiceQuestions.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-3"
            >
              <Field
                label={`Question ${index + 1}`}
                value={item.question}
                multiline
                onChange={(question) =>
                  update({
                    practiceQuestions: replaceAt(
                      content.practiceQuestions,
                      index,
                      { ...item, question },
                    ),
                  })
                }
              />
              <Field
                label="Answer"
                value={item.answer}
                multiline
                onChange={(answer) =>
                  update({
                    practiceQuestions: replaceAt(
                      content.practiceQuestions,
                      index,
                      { ...item, answer },
                    ),
                  })
                }
              />
              <Field
                label={targetName}
                value={item.sat ?? ""}
                placeholder="Not translated"
                isOlChiki={targetIsOlChiki}
                multiline
                onChange={(sat) =>
                  update({
                    practiceQuestions: replaceAt(
                      content.practiceQuestions,
                      index,
                      { ...item, sat: sat || null },
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        index={7}
        title="Assessment"
        hint="How to check whether the class understood."
      >
        <div className="space-y-3">
          <Field
            label="Description"
            value={content.assessment.description}
            multiline
            onChange={(description) =>
              update({ assessment: { ...content.assessment, description } })
            }
          />
          <ListField
            label="What to look for"
            values={content.assessment.criteria}
            onChange={(criteria) =>
              update({ assessment: { ...content.assessment, criteria } })
            }
          />
          <Field
            label={`${targetName} version`}
            value={content.assessment.sat ?? ""}
            placeholder="Not translated"
            isOlChiki={targetIsOlChiki}
            multiline
            onChange={(sat) =>
              update({
                assessment: { ...content.assessment, sat: sat || null },
              })
            }
          />
        </div>
      </Section>

      <Section
        index={8}
        title="Homework"
        hint="Doable at home with no printed material."
      >
        <Bilingual
          value={content.homework}
          onChange={(v) => update({ homework: v })}
          sourceName={sourceName}
          targetName={targetName}
          targetIsOlChiki={targetIsOlChiki}
          rows={3}
        />
      </Section>

      {/*
        Named "Suggested" everywhere it appears. No curriculum document has been
        loaded into this product and nothing has been checked against one, so
        calling this alignment would be a claim about official policy that this
        project cannot support.
      */}
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">Suggested FLN Alignment</h3>
            <Badge variant="warning">Not verified</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A suggestion of the foundational literacy and numeracy goals this
            lesson may touch. It is not checked against NCERT or any state
            curriculum document — no such document is loaded in this product.
            Confirm against your own syllabus before relying on it.
          </p>
          <div className="mt-3">
            <ListField
              label="Suggested goals"
              values={content.suggestedFlnAlignment}
              onChange={(suggestedFlnAlignment) =>
                update({ suggestedFlnAlignment })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  index,
  title,
  hint,
  children,
}: {
  index: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {index}.
          </span>
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <div className="mt-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function Bilingual({
  value,
  onChange,
  sourceName,
  targetName,
  targetIsOlChiki,
  rows,
}: {
  value: { hi: string; sat: string | null };
  onChange: (next: { hi: string; sat: string | null }) => void;
  sourceName: string;
  targetName: string;
  targetIsOlChiki: boolean;
  rows: number;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Field
        label={sourceName}
        value={value.hi}
        multiline
        rows={rows}
        onChange={(hi) => onChange({ ...value, hi })}
      />
      <Field
        label={targetName}
        value={value.sat ?? ""}
        placeholder="Not translated"
        isOlChiki={targetIsOlChiki}
        multiline
        rows={rows}
        onChange={(sat) => onChange({ ...value, sat: sat || null })}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows = 3,
  isOlChiki,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  isOlChiki?: boolean;
}) {
  const id = useId();
  const className = cn(
    "mt-1 w-full rounded-md border border-input bg-card p-2.5 text-sm",
    isOlChiki && value && "font-ol-chiki",
  );

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(className, "resize-y")}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(className, "h-10")}
        />
      )}
    </div>
  );
}

function ListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}{" "}
        <span className="font-normal">(one per line)</span>
      </label>
      <textarea
        id={id}
        value={values.join("\n")}
        rows={Math.min(Math.max(values.length + 1, 3), 10)}
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((line) => line.trimStart())
              .filter((line, index, all) => line !== "" || index < all.length - 1),
          )
        }
        className="mt-1 w-full resize-y rounded-md border border-input bg-card p-2.5 text-sm"
      />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
      {label}
    </p>
  );
}

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  const next = [...list];
  next[index] = value;
  return next;
}
