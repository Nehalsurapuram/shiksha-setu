import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Worksheets" };

export default function WorksheetsPage() {
  return (
    <>
      <PageHeader
        title="Worksheets"
        description="Printable practice sheets generated from a lesson."
      />
      <NotBuiltYet
        feature="Worksheet generation"
        phase={2}
        summary="Phase 1 defines the Worksheet table and its question formats but generates nothing."
        willInclude={[
          "Generate matching, fill-in-the-blank, reading, picture-labelling and word-hunt sheets from a lesson.",
          "Produce a print-ready layout that works on a shared classroom printer.",
          "Keep the Hindi and Santhali versions of a sheet together.",
        ]}
      />
    </>
  );
}
