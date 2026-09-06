import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Usage and learning-outcome trends across schools."
      />
      <NotBuiltYet
        feature="Analytics"
        phase={3}
        summary="Phase 1 defines the AnalyticsEvent table, including an offline flag for events captured without a network. Nothing is recorded or charted yet."
        willInclude={[
          "Show which features teachers actually use, and where translations get corrected most.",
          "Track learning outcomes by grade and subject across a block or district.",
          "Backfill events captured offline once a tablet reconnects.",
        ]}
      />
    </>
  );
}
