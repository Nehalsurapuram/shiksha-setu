import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Translator" };

export default function TranslatorPage() {
  return (
    <>
      <PageHeader
        title="Translator"
        description="Hindi to Santhali translation with a teacher-editable glossary and correction history."
      />
      <NotBuiltYet
        feature="The translator"
        phase={2}
        summary="Phase 1 sets up the Translation, GlossaryTerm and TranslationCorrection tables but wires no provider to them."
        willInclude={[
          "Translate Hindi text to Santhali through Sarvam AI, writing each result to the Translation table.",
          "Show the Ol Chiki output alongside the Hindi source so a teacher can check it line by line.",
          "Let a teacher correct a translation; corrections are stored and reused as glossary entries.",
          "Reuse a cached translation when the same sentence and language pair comes back, so a repeated phrase works offline.",
        ]}
      />
    </>
  );
}
