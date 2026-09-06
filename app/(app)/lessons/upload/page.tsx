import type { Metadata } from "next";

import { LessonUpload } from "@/components/lessons/lesson-upload";
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
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Upload a lesson" };
export const dynamic = "force-dynamic";

export default async function LessonUploadPage() {
  const pair = await getDefaultLanguagePair();

  if (!pair) {
    return (
      <>
        <PageHeader title="Upload a lesson" />
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

  // Capability is resolved server-side; only the answer crosses to the client.
  const llm = new LLMService();
  const llmConfigured = llm.isConfigured;

  return (
    <>
      <PageHeader
        title="Upload a lesson"
        description={`Turn a textbook page into a teaching package: read the text, check what was found, then generate material in ${pair.source.name} and ${pair.target.name}.`}
        action={
          // "Configured", not "ready": a key being present says nothing about
          // whether the account behind it has credit or the model is reachable.
          // That is only known once a request is made.
          llmConfigured ? (
            <Badge variant="outline">Generation configured</Badge>
          ) : (
            <Badge variant="warning">Generation unavailable</Badge>
          )
        }
      />

      {!llmConfigured ? (
        <Card className="mb-6 border-warning/50 bg-warning/10">
          <CardContent className="p-4 sm:p-5">
            <h2 className="font-semibold text-warning-foreground">
              Lesson generation is not configured
            </h2>
            <p className="mt-1.5 text-sm text-warning-foreground">
              <code className="rounded bg-warning/20 px-1 py-0.5">
                OPENAI_API_KEY
              </code>{" "}
              is not set, so no teaching material can be generated. Uploading,
              reading and saving a lesson still work. Nothing is invented in the
              meantime — there is no placeholder lesson content anywhere in this
              product, because a plausible-looking lesson plan is the one kind
              of placeholder a teacher could not catch.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <LessonUpload
        sourceName={pair.source.name}
        targetName={pair.target.name}
        targetIsOlChiki={pair.target.script === "OL_CHIKI"}
        llmConfigured={llmConfigured}
      />
    </>
  );
}
