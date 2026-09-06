import Link from "next/link";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusRow } from "@/components/shared/status-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProviderReadiness, isDemoMode } from "@/lib/ai";
import { checkDatabase, getWorkspaceSnapshot } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const database = await checkDatabase();

  if (!database.ok) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <CardHeader>
            <CardTitle>Cannot reach the database</CardTitle>
            <CardDescription>
              Start PostgreSQL and check DATABASE_URL in your .env file, then
              reload this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {database.error}
            </pre>
          </CardContent>
        </Card>
      </>
    );
  }

  const { counts, languages } = await getWorkspaceSnapshot();
  const providers = getProviderReadiness();
  const demoMode = isDemoMode();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Phase 1 sets up the foundation: database, language data, navigation and the offline shell. Translation and generation arrive in Phase 2."
        action={
          <Button asChild variant="outline">
            <Link href="/settings">Open settings</Link>
          </Button>
        }
      />

      <section aria-labelledby="counts-heading">
        <h3 id="counts-heading" className="sr-only">
          Workspace totals
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Schools" value={counts.schools} />
          <StatCard label="Teachers" value={counts.teachers} />
          <StatCard
            label="Active languages"
            value={counts.activeLanguages}
            hint="Hindi and Santhali"
          />
          <StatCard
            label="Queued to sync"
            value={counts.pendingSyncItems}
            hint="Changes waiting to upload"
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Phase 1 setup</CardTitle>
            <CardDescription>
              What is wired up on this installation right now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              <StatusRow
                ok
                label="PostgreSQL connected"
                detail="Prisma reached the database and the schema is migrated."
              />
              <StatusRow
                ok={counts.activeLanguages > 0}
                label="Language seed data"
                detail={
                  counts.activeLanguages > 0
                    ? `${languages.length} languages loaded, ${counts.activeLanguages} active.`
                    : "No languages found. Run the seed script to load Hindi and Santhali."
                }
              />
              {providers.map((provider) => (
                <StatusRow
                  key={provider.name}
                  ok={provider.credentialPresent}
                  label={`${provider.name === "sarvam" ? "Sarvam AI" : "OpenAI"} credential`}
                  detail={
                    provider.credentialPresent
                      ? `Key present. Not called yet — the ${provider.role} integration lands in Phase 2.`
                      : `No key set. Add it to .env before the Phase 2 ${provider.role} work.`
                  }
                />
              ))}
              <StatusRow
                ok={demoMode}
                label="Demo mode"
                detail={
                  demoMode
                    ? "On. Unbuilt features say so plainly instead of showing sample output."
                    : "Off. Keep ENABLE_DEMO_MODE=true until Phase 2 ships."
                }
              />
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Languages</CardTitle>
            <CardDescription>
              Read from the Language table. Planned languages are listed so the
              roadmap is visible, not because they work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {languages.map((language) => (
              <div
                key={language.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {language.name}{" "}
                    <span
                      className={
                        language.script === "OL_CHIKI"
                          ? "font-ol-chiki text-muted-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {language.nativeName}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {language.code} ·{" "}
                    {language.script.toLowerCase().replace("_", " ")}
                  </p>
                </div>
                <Badge
                  variant={language.status === "ACTIVE" ? "success" : "outline"}
                >
                  {language.status === "ACTIVE" ? "Active" : "Planned"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Content</CardTitle>
          <CardDescription>
            These stay at zero until Phase 2 — nothing creates this content yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Lessons" value={counts.lessons} />
          <StatCard label="Translations" value={counts.translations} />
          <StatCard label="Glossary terms" value={counts.glossaryTerms} />
        </CardContent>
      </Card>
    </>
  );
}
