import type { Metadata } from "next";

import { SheetWorkspace } from "@/components/generators/sheet-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LLMService } from "@/lib/ai/LLMService";
import type { QuestionType } from "@/lib/ai/generated-content";
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Assessments" };
export const dynamic = "force-dynamic";

/**
 * Assessments add oral questions, which matter here: a child who cannot yet
 * write in the language of instruction can still show what they know aloud.
 */
const ASSESSMENT_TYPES: QuestionType[] = [
  "MULTIPLE_CHOICE",
  "FILL_IN_BLANK",
  "TRUE_FALSE",
  "MATCHING",
  "PICTURE_BASED",
  "ORAL",
  "SHORT_ANSWER",
];

export default async function AssessmentsPage() {
  const pair = await getDefaultLanguagePair();

  if (!pair) {
    return (
      <>
        <PageHeader title="Assessments" />
        <Card>
          <CardHeader>
            <CardTitle>No language pair is configured</CardTitle>
            <CardDescription>
              Run the seed script to load Hindi and Santhali.
            </CardDescription>
          </CardHeader>
        </Card>
      </>
    );
  }

  const llm = new LLMService();

  return (
    <>
      <PageHeader
        title="Assessments"
        description={`Generate a bilingual assessment with an answer key, in ${pair.source.name} and ${pair.target.name}. Marks total automatically.`}
        action={
          llm.isConfigured ? (
            <Badge variant="outline">Generation configured</Badge>
          ) : (
            <Badge variant="warning">Generation unavailable</Badge>
          )
        }
      />

      <Card className="mb-6 print:hidden">
        <CardContent className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            These are classroom checks a teacher writes and marks themselves.
            They are not standardised tests, and nothing here is aligned to an
            official examination — no board or state assessment framework is
            loaded in this product.
          </p>
        </CardContent>
      </Card>

      <SheetWorkspace
        kind="assessment"
        sourceName={pair.source.name}
        targetName={pair.target.name}
        targetIsOlChiki={pair.target.script === "OL_CHIKI"}
        llmConfigured={llm.isConfigured}
        allowedTypes={ASSESSMENT_TYPES}
        defaultTypes={["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"]}
      />
    </>
  );
}
