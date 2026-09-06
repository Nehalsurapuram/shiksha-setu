"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";

import { CorrectionForm } from "@/components/translator/correction-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type HistoryEntry = {
  id: string;
  sourceText: string;
  targetText: string;
  source: "SARVAM" | "OPENAI" | "GLOSSARY" | "HUMAN" | "DEMO";
  reviewStatus: "UNREVIEWED" | "APPROVED" | "CORRECTED" | "REJECTED";
  createdAtLabel: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  targetIsOlChiki: boolean;
  correctedText: string | null;
};

export function TranslationHistory({
  entries,
  onReopen,
}: {
  entries: HistoryEntry[];
  onReopen: (entry: HistoryEntry) => void;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>
          Translations saved to this installation, most recent first.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <History className="size-5" aria-hidden />
            </span>
            <p className="mt-3 font-medium">No translations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Translate some text and it will be saved here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => {
              const isOpen = expandedId === entry.id;
              const isEditing = editingId === entry.id;

              return (
                <li key={entry.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">
                        {entry.sourceText}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{entry.createdAtLabel}</span>
                        <span aria-hidden>·</span>
                        <span>
                          {entry.sourceLanguageCode} → {entry.targetLanguageCode}
                        </span>
                        {entry.source === "DEMO" ? (
                          <Badge variant="warning">Demo</Badge>
                        ) : (
                          <Badge variant="outline">
                            {entry.source.toLowerCase()}
                          </Badge>
                        )}
                        {entry.reviewStatus === "CORRECTED" ? (
                          <Badge variant="success">Corrected</Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedId(isOpen ? null : entry.id)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide" : "View"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReopen(entry)}
                      >
                        Reopen
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setExpandedId(entry.id);
                          setEditingId(isEditing ? null : entry.id);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Source
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
                          {entry.sourceText}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Translation
                        </p>
                        <p
                          className={cn(
                            "mt-1 whitespace-pre-wrap text-sm",
                            entry.targetIsOlChiki && "font-ol-chiki",
                          )}
                        >
                          {entry.targetText}
                        </p>
                      </div>

                      {entry.correctedText ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-success">
                            Your correction
                          </p>
                          <p
                            className={cn(
                              "mt-1 whitespace-pre-wrap text-sm",
                              entry.targetIsOlChiki && "font-ol-chiki",
                            )}
                          >
                            {entry.correctedText}
                          </p>
                        </div>
                      ) : null}

                      {isEditing ? (
                        <div className="border-t border-border pt-3">
                          <CorrectionForm
                            translationId={entry.id}
                            initialText={entry.correctedText ?? entry.targetText}
                            isOlChiki={entry.targetIsOlChiki}
                            onCancel={() => setEditingId(null)}
                            onSaved={() => {
                              setEditingId(null);
                              router.refresh();
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
