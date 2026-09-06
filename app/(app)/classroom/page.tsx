import type { Metadata } from "next";

import { ClassroomRoom } from "@/components/classroom/classroom-room";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SpeechService, ttsUnavailableMessage } from "@/lib/ai/SpeechService";
import { selectSpeechToTextProvider } from "@/lib/ai/SpeechService";
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Interactive Classroom" };
export const dynamic = "force-dynamic";

export default async function ClassroomPage() {
  const pair = await getDefaultLanguagePair();

  if (!pair) {
    return (
      <>
        <PageHeader title="Interactive Classroom" />
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

  // Capabilities are resolved server-side; only the answers cross to the client.
  const speech = new SpeechService();
  const stt = selectSpeechToTextProvider();

  const instruction = {
    code: pair.source.code,
    name: pair.source.name,
    isOlChiki: pair.source.script === "OL_CHIKI",
    canTranscribe: stt.supports(pair.source.code),
    canSpeak: speech.canSpeak(pair.source.code),
  };

  const motherTongue = {
    code: pair.target.code,
    name: pair.target.name,
    isOlChiki: pair.target.script === "OL_CHIKI",
    canTranscribe: stt.supports(pair.target.code),
    canSpeak: speech.canSpeak(pair.target.code),
  };

  const isDemo = speech.isDemo;

  return (
    <>
      <PageHeader
        title="Interactive Classroom"
        description={`A live back-and-forth between a ${instruction.name}-speaking teacher and a ${motherTongue.name}-speaking student. Each turn is translated and shown to both sides.`}
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
              Demo mode — no speech or translation model is connected
            </h2>
            <p className="mt-1.5 text-sm text-warning-foreground">
              <code className="rounded bg-warning/20 px-1 py-0.5">
                SARVAM_API_KEY
              </code>{" "}
              is not set. Turns are recorded and routed through the real
              pipeline, but every transcript and translation is a labelled
              placeholder — never words a teacher or child did not say.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/*
        The two directions genuinely differ, and hiding that would set a teacher
        up to expect audio that never arrives. Sarvam can transcribe Santhali
        but has no Santhali voice, so the student hears nothing while the
        teacher can hear the reply read aloud.
      */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>What works in each direction</CardTitle>
          <CardDescription>
            Speech recognition and audio have different language coverage, so
            the two directions are not symmetrical.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <DirectionCard
            heading={`${instruction.name} → ${motherTongue.name}`}
            caption="Teacher speaks, student reads"
            canTranscribe={instruction.canTranscribe}
            transcribeLabel={`Listens to ${instruction.name}`}
            canSpeak={motherTongue.canSpeak}
            speakLabel={`Reads ${motherTongue.name} aloud`}
            speakFallback={ttsUnavailableMessage(motherTongue.name)}
          />
          <DirectionCard
            heading={`${motherTongue.name} → ${instruction.name}`}
            caption="Student answers, teacher hears"
            canTranscribe={motherTongue.canTranscribe}
            transcribeLabel={`Listens to ${motherTongue.name}`}
            canSpeak={instruction.canSpeak}
            speakLabel={`Reads ${instruction.name} aloud`}
            speakFallback={ttsUnavailableMessage(instruction.name)}
          />
        </CardContent>
      </Card>

      <ClassroomRoom
        instruction={instruction}
        motherTongue={motherTongue}
        isDemo={isDemo}
      />
    </>
  );
}

function DirectionCard({
  heading,
  caption,
  canTranscribe,
  transcribeLabel,
  canSpeak,
  speakLabel,
  speakFallback,
}: {
  heading: string;
  caption: string;
  canTranscribe: boolean;
  transcribeLabel: string;
  canSpeak: boolean;
  speakLabel: string;
  speakFallback: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="font-medium">{heading}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        <li className="flex items-start gap-2">
          <Badge variant={canTranscribe ? "success" : "outline"}>
            {canTranscribe ? "Yes" : "No"}
          </Badge>
          <span className="text-muted-foreground">{transcribeLabel}</span>
        </li>
        <li className="flex items-start gap-2">
          <Badge variant={canSpeak ? "success" : "warning"}>
            {canSpeak ? "Yes" : "No"}
          </Badge>
          <span className="text-muted-foreground">
            {canSpeak ? speakLabel : speakFallback}
          </span>
        </li>
      </ul>
    </div>
  );
}
