import type { Metadata } from "next";

import { FlashcardWorkspace } from "@/components/generators/flashcard-workspace";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LLMService } from "@/lib/ai/LLMService";
import { SpeechService, ttsUnavailableMessage } from "@/lib/ai/SpeechService";
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Flashcards" };
export const dynamic = "force-dynamic";

export default async function FlashcardsPage() {
  const pair = await getDefaultLanguagePair();

  if (!pair) {
    return (
      <>
        <PageHeader title="Flashcards" />
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
  const speech = new SpeechService();

  // The Listen button speaks the language of instruction. There is no mother
  // tongue voice, and this app will not read one language in another's voice.
  const canSpeakSource = speech.canSpeak(pair.source.code);

  return (
    <>
      <PageHeader
        title="Flashcards"
        description={`Picture-and-word cards pairing ${pair.source.name} with ${pair.target.name}, for early vocabulary.`}
        action={
          llm.isConfigured ? (
            <Badge variant="outline">Generation configured</Badge>
          ) : (
            <Badge variant="warning">Generation unavailable</Badge>
          )
        }
      />

      <FlashcardWorkspace
        sourceName={pair.source.name}
        sourceCode={pair.source.code}
        targetName={pair.target.name}
        targetIsOlChiki={pair.target.script === "OL_CHIKI"}
        llmConfigured={llm.isConfigured}
        canSpeakSource={canSpeakSource}
        ttsUnavailableMessage={ttsUnavailableMessage(pair.target.name)}
      />
    </>
  );
}
