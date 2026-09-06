import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { VoiceAssistant } from "@/components/voice/voice-assistant";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SpeechService, ttsUnavailableMessage } from "@/lib/ai/SpeechService";
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Voice Assistant" };
export const dynamic = "force-dynamic";

export default async function VoiceAssistantPage() {
  const pair = await getDefaultLanguagePair();

  if (!pair) {
    return (
      <>
        <PageHeader title="Voice Assistant" />
        <Card>
          <CardHeader>
            <CardTitle>No language pair is configured</CardTitle>
            <CardDescription>
              The Language table needs an active source and target language. Run
              the seed script to load Hindi and Santhali.
            </CardDescription>
          </CardHeader>
        </Card>
      </>
    );
  }

  // Capability is resolved server-side; only the answer crosses to the client.
  const speech = new SpeechService();
  const canSpeakTarget = speech.canSpeak(pair.target.code);
  const isDemo = speech.isDemo;

  return (
    <>
      <PageHeader
        title="Voice Assistant"
        description={`Speak a sentence in ${pair.source.name} and see it in ${pair.target.name}. Recording happens on this device; recognition and translation run on the server.`}
        action={
          isDemo ? (
            <Badge variant="warning">Demo mode</Badge>
          ) : (
            <Badge variant="success">Sarvam connected</Badge>
          )
        }
      />

      {isDemo ? (
        <Card className="mb-6 border-warning/50 bg-warning/10">
          <CardContent className="p-4 sm:p-5">
            <h2 className="font-semibold text-warning-foreground">
              Demo mode — no speech model is connected
            </h2>
            <p className="mt-1.5 text-sm text-warning-foreground">
              <code className="rounded bg-warning/20 px-1 py-0.5">
                SARVAM_API_KEY
              </code>{" "}
              is not set, so recordings are not transcribed. The assistant
              returns a labelled placeholder rather than inventing words a
              teacher did not say.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <VoiceAssistant
        sourceLanguage={{ code: pair.source.code, name: pair.source.name }}
        targetLanguage={{ code: pair.target.code, name: pair.target.name }}
        targetIsOlChiki={pair.target.script === "OL_CHIKI"}
        canSpeakTarget={canSpeakTarget}
        ttsUnavailableMessage={ttsUnavailableMessage(pair.target.name)}
        isDemo={isDemo}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How this works</CardTitle>
          <CardDescription>
            Four steps, three of which run on Sarvam&rsquo;s servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">
                1. Record ({pair.source.name} speech)
              </span>{" "}
              — captured in this browser and uploaded. Nothing is stored on the
              device.
            </li>
            <li>
              <span className="font-medium text-foreground">
                2. Speech to text
              </span>{" "}
              — Sarvam transcribes the recording.
            </li>
            <li>
              <span className="font-medium text-foreground">3. Translate</span>{" "}
              — the same pipeline the Translator page uses, so the result is
              saved to history and can be corrected there.
            </li>
            <li>
              <span className="font-medium text-foreground">
                4. Text to speech
              </span>{" "}
              —{" "}
              {canSpeakTarget
                ? `read aloud in ${pair.target.name}.`
                : `unavailable: the configured provider has no ${pair.target.name} voice.`}
            </li>
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            This needs a network connection. Offline speech is not built, and
            nothing here runs on the tablet itself.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
