import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Audio Library" };

export default function AudioLibraryPage() {
  return (
    <>
      <PageHeader
        title="Audio Library"
        description="Recorded pronunciations and narration, cached for offline playback."
      />
      <NotBuiltYet
        feature="The audio library"
        phase={3}
        summary="Phase 1 defines the Audio table, including its offline-cache flag. No audio is stored, generated or played."
        willInclude={[
          "Collect teacher recordings and generated speech in one browsable place.",
          "Mark a clip for offline caching on this tablet.",
          "Play a Santhali pronunciation next to the word it belongs to.",
        ]}
      />
    </>
  );
}
