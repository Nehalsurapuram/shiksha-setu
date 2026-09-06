import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Lessons" };

export default function LessonsPage() {
  return (
    <>
      <PageHeader
        title="Lessons"
        description="Bilingual lesson plans built from the state syllabus, stored per school."
      />
      <NotBuiltYet
        feature="Lesson planning"
        phase={2}
        summary="Phase 1 creates the Lesson table and its relationships; no lesson can be authored or generated yet."
        willInclude={[
          "Draft a lesson from a syllabus topic, grade and subject.",
          "Hold the Hindi source and the Santhali translation side by side in one lesson.",
          "Pin a lesson for offline use on a specific tablet.",
          "Track a lesson from draft to ready to archived.",
        ]}
      />
    </>
  );
}
