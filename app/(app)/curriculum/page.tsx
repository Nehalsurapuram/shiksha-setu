import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Curriculum" };

export default function CurriculumPage() {
  return (
    <>
      <PageHeader
        title="Curriculum"
        description="State syllabus mapped to grades, subjects and learning outcomes, so a lesson starts from what the teacher is actually required to cover."
      />
      <NotBuiltYet
        feature="The curriculum browser"
        phase={2}
        summary="Phase 1 defines the LearningOutcome table and the grade and subject fields on Lesson. No syllabus has been loaded and nothing is mapped yet."
        willInclude={[
          "Browse the state syllabus by grade and subject, down to individual topics.",
          "Start a lesson from a syllabus topic instead of from a blank page.",
          "Map each lesson to the NCERT learning outcomes it is meant to cover.",
          "Show which parts of the term's syllabus have lessons and which do not.",
        ]}
      />
    </>
  );
}
