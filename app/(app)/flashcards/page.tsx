import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Flashcards" };

export default function FlashcardsPage() {
  return (
    <>
      <PageHeader
        title="Flashcards"
        description="Picture-and-word cards for early vocabulary."
      />
      <NotBuiltYet
        feature="Flashcards"
        phase={2}
        summary="Phase 1 defines the Flashcard table and its link to Audio; no cards are generated or displayed."
        willInclude={[
          "Build a card set from the vocabulary in a lesson.",
          "Show a picture, the Hindi word and the Santhali word on one card.",
          "Attach a recorded pronunciation to each card for classroom playback.",
        ]}
      />
    </>
  );
}
