import type { Metadata } from "next";

import { SheetWorkspace } from "@/components/generators/sheet-workspace";
import { RequiresConnection } from "@/components/offline/requires-connection";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LLMService } from "@/lib/ai/LLMService";
import type { QuestionType } from "@/lib/ai/generated-content";
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Worksheets" };
export const dynamic = "force-dynamic";

/** A worksheet is done on paper, so oral questions are not offered here. */
const WORKSHEET_TYPES: QuestionType[] = [
  "MULTIPLE_CHOICE",
  "FILL_IN_BLANK",
  "TRUE_FALSE",
  "MATCHING",
  "PICTURE_BASED",
  "COUNTING",
  "SHORT_ANSWER",
];

export default async function WorksheetsPage() {
  const pair = await getDefaultLanguagePair();

  if (!pair) {
    return (
      <>
        <PageHeader title="Worksheets" />
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
        title="Worksheets"
        description={`Generate bilingual practice sheets in ${pair.source.name} and ${pair.target.name}, edit every question, then print or save as PDF.`}
        action={
          llm.isConfigured ? (
            <Badge variant="outline">Generation configured</Badge>
          ) : (
            <Badge variant="warning">Generation unavailable</Badge>
          )
        }
      />

      <RequiresConnection
        feature="Generating a worksheet"
        stillAvailable="Worksheets you have already saved open offline."
      />

      <SheetWorkspace
        kind="worksheet"
        sourceName={pair.source.name}
        targetName={pair.target.name}
        targetIsOlChiki={pair.target.script === "OL_CHIKI"}
        llmConfigured={llm.isConfigured}
        allowedTypes={WORKSHEET_TYPES}
        defaultTypes={["MULTIPLE_CHOICE", "FILL_IN_BLANK", "SHORT_ANSWER"]}
      />
    </>
  );
}
