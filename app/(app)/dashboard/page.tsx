import Link from "next/link";
import type { Metadata } from "next";

import { ContinueTeaching } from "@/components/dashboard/continue-teaching";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentLessons } from "@/components/dashboard/recent-lessons";
import { StatCard } from "@/components/shared/stat-card";
import { StatusRow } from "@/components/shared/status-row";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProviderReadiness, isDemoMode } from "@/lib/ai";
import {
  checkDatabase,
  getCurrentTeacher,
  getTeacherStats,
  listContinueTeaching,
  listRecentLessons,
} from "@/lib/database/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const database = await checkDatabase();

  if (!database.ok) {
    return (
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
    );
  }

  const teacher = await getCurrentTeacher();

  if (!teacher) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No teacher account found</CardTitle>
          <CardDescription>
            The database is connected but has no teacher record. Run the seed
            script to create one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="rounded-md bg-muted px-2 py-1 text-sm">
            npm run db:seed
          </code>
        </CardContent>
      </Card>
    );
  }

  const [stats, recentLessons, continueLessons] = await Promise.all([
    getTeacherStats(teacher.id),
    listRecentLessons(teacher.id),
    listContinueTeaching(teacher.id),
  ]);

  const now = new Date();
  const providers = getProviderReadiness();
  const hasSamples = recentLessons.some((lesson) => lesson.isSample);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">
            Welcome, Teacher
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {teacher.name}
            {teacher.school ? ` · ${teacher.school.name}` : null}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/settings">Settings</Link>
        </Button>
      </div>

      <QuickActions />

      {/* Statistics */}
      <section aria-labelledby="stats-heading">
        <h2
          id="stats-heading"
          className="text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground"
        >
          Your activity
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Lessons translated"
            value={stats.translations}
            hint="Translations saved to your account"
          />
          <StatCard
            label="Worksheets generated"
            value={stats.worksheets}
            hint="Worksheets you have created"
          />
          <StatCard
            label="Audio lessons"
            value={stats.audioLessons}
            hint="Recordings and generated speech"
          />
          <StatCard
            label="Saved lessons"
            value={stats.savedLessons}
            hint="Lessons in your library"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Counted from the database for {teacher.name}. The first three stay at
          zero until translation and generation are built — that is the real
          count, not a placeholder.
        </p>
      </section>

      {continueLessons.length > 0 ? (
        <ContinueTeaching lessons={continueLessons} now={now} />
      ) : null}

      <RecentLessons lessons={recentLessons} />

      {hasSamples ? (
        <p className="text-xs text-muted-foreground">
          Lessons marked <span className="font-medium">Sample</span> are seeded
          demo content, not your own work. Remove them with{" "}
          <code className="rounded bg-muted px-1 py-0.5">npm run db:reset</code>.
        </p>
      ) : null}

      {/* Setup status, carried over from the Phase 1 dashboard. */}
      <Card>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
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
            {providers.map((provider) => (
              <StatusRow
                key={provider.name}
                ok={provider.credentialPresent}
                label={`${provider.label} credential`}
                detail={
                  provider.credentialPresent
                    ? `Key present. Not called yet — the ${provider.roleLabel} integration is not built.`
                    : `No key set. Add it to .env before the ${provider.roleLabel} work.`
                }
              />
            ))}
            <StatusRow
              ok={isDemoMode()}
              label="Demo mode"
              detail={
                isDemoMode()
                  ? "On. Unbuilt features say so plainly instead of showing sample output."
                  : "Off. Keep ENABLE_DEMO_MODE=true until the AI features ship."
              }
            />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
