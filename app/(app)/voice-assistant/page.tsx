import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Voice Assistant" };

export default function VoiceAssistantPage() {
  return (
    <>
      <PageHeader
        title="Voice Assistant"
        description="Speak a sentence in Hindi and hear it read back in the mother tongue."
      />
      <NotBuiltYet
        feature="The voice assistant"
        phase={2}
        summary="Phase 1 has no microphone access, no speech recognition and no speech synthesis."
        willInclude={[
          "Record a teacher speaking Hindi and transcribe it with Sarvam speech-to-text.",
          "Read the Santhali translation aloud so a teacher who does not read Ol Chiki can still use it.",
          "Save generated audio to the Audio table so a phrase can be replayed without a network.",
        ]}
      />
    </>
  );
}
