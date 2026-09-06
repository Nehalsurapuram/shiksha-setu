import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Assessments" };

export default function AssessmentsPage() {
  return (
    <>
      <PageHeader
        title="Assessments"
        description="Oral and written checks mapped to NCERT learning outcomes."
      />
      <NotBuiltYet
        feature="Assessments"
        phase={3}
        summary="Phase 1 defines the Assessment and LearningOutcome tables. Assessment design depends on the Phase 2 content work landing first."
        willInclude={[
          "Create oral, written, picture-based and listening checks tied to a lesson.",
          "Record a score per child against a named learning outcome.",
          "Work fully offline, since assessments happen away from connectivity.",
        ]}
      />
    </>
  );
}
