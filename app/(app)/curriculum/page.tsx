import type { Metadata } from "next";

import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCatalogueStatus } from "@/lib/fln/catalogue";

export const metadata: Metadata = { title: "Curriculum" };
export const dynamic = "force-dynamic";

/**
 * The single place that states what curriculum data this installation holds.
 *
 * Everything else in the product reads from the same table, so if this page
 * says nothing is loaded, no screen anywhere can be showing verified
 * alignment.
 */
export default async function CurriculumPage() {
  const status = await getCatalogueStatus();
  const hasVerified = status.verifiedCount > 0;

  return (
    <>
      <PageHeader
        title="Curriculum"
        description="Learning-outcome data loaded into this installation, and what the alignment shown elsewhere is based on."
        action={
          hasVerified ? (
            <Badge variant="success">{status.verifiedCount} verified</Badge>
          ) : (
            <Badge variant="warning">No verified data</Badge>
          )
        }
      />

      <Card
        className={
          hasVerified ? "mb-6 border-success/40" : "mb-6 border-warning/50 bg-warning/10"
        }
      >
        <CardHeader>
          <CardTitle>
            {hasVerified
              ? "Verified curriculum data is loaded"
              : "No official curriculum data is loaded"}
          </CardTitle>
          <CardDescription
            className={hasVerified ? undefined : "text-warning-foreground"}
          >
            {hasVerified
              ? "Alignment shown on lessons, worksheets and assessments is matched against the sources below."
              : "No NIPUN Bharat, NCERT or state curriculum document has been loaded, so nothing in this product can show official alignment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Verified outcomes
              </dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {status.verifiedCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Loaded without a source
              </dt>
              <dd className="mt-0.5 text-2xl font-semibold tabular-nums">
                {status.unverifiedCount}
              </dd>
            </div>
          </dl>

          {status.sources.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sources
              </p>
              <ul className="mt-1 list-disc pl-5">
                {status.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!hasVerified ? (
            <p className="text-warning-foreground">
              Until a source is loaded, every alignment in this product is
              labelled <strong>Suggested FLN Alignment</strong> and carries no
              outcome codes. A code would look authoritative and could not be
              checked, so none is produced — not by the model, and not by this
              application.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <NotBuiltYet
        feature="Curriculum import"
        phase={2}
        summary="The LearningOutcome catalogue and the alignment that reads from it are built. Loading a real framework into it is not: there is no importer, and no document has been obtained and checked."
        willInclude={[
          "Import learning outcomes from a published framework, with the citation stored against every row.",
          "Browse outcomes by class, subject and learning area.",
          "Match generated material against verified outcomes instead of suggesting one.",
          "Show which outcomes a teacher's saved material already covers.",
        ]}
      />
    </>
  );
}
