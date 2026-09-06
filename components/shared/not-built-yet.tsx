import { Construction } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { FeaturePhase } from "@/types";

/**
 * The single way an unbuilt feature is presented.
 *
 * This is a hard product rule for Phase 1: a screen for a feature that does not
 * exist shows this panel. It never shows a disabled-looking mock, a sample
 * translation, or placeholder Santhali text, because a teacher cannot tell an
 * invented translation from a real one and would have no reason to distrust it.
 */
export function NotBuiltYet({
  feature,
  phase,
  summary,
  willInclude,
}: {
  feature: string;
  phase: FeaturePhase;
  summary: string;
  willInclude: string[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Construction className="size-5" aria-hidden />
          </span>
          <Badge variant="outline">Planned for Phase {phase}</Badge>
        </div>

        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            {feature} is not built yet
          </h3>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {summary} Nothing on this screen calls a model, and no sample output
            is shown, so nothing here can be mistaken for a real result.
          </p>
        </div>

        <div className="w-full">
          <p className="text-sm font-medium">What it will do when built</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {willInclude.map((entry) => (
              <li key={entry} className="flex gap-2">
                <span aria-hidden className="text-muted-foreground">
                  &middot;
                </span>
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
