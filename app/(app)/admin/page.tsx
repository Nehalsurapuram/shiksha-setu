import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { prisma } from "@/lib/database/prisma";

export const metadata: Metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  TEACHER: "Teacher",
  HEAD_TEACHER: "Head teacher",
  COORDINATOR: "Coordinator",
  LANGUAGE_EXPERT: "Language expert",
  ADMIN: "Administrator",
};

/**
 * The administrator's view: who holds an account, which schools exist, what
 * languages are switched on, and what terminology has been verified.
 *
 * Everything here is other people's data, so the guard is the first line of the
 * function and re-reads the role from the database rather than trusting the
 * session token.
 */
export default async function AdminPage() {
  await requireCapability("administer", "/admin");

  const [users, schools, languages, glossary, verifiedTerms] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastSeenAt: true,
        school: { select: { name: true } },
      },
    }),
    prisma.school.findMany({
      orderBy: { name: "asc" },
      take: 50,
      select: {
        id: true,
        name: true,
        district: true,
        state: true,
        _count: { select: { users: true } },
      },
    }),
    prisma.language.findMany({
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, status: true },
    }),
    prisma.glossaryTerm.count(),
    prisma.glossaryTerm.count({ where: { isVerified: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Administration"
        description="Accounts, schools, languages and verified terminology for this installation."
        action={<Badge variant="outline">Administrators only</Badge>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Accounts" value={users.length} />
        <StatCard label="Schools" value={schools.length} />
        <StatCard
          label="Active languages"
          value={languages.filter((language) => language.status === "ACTIVE").length}
        />
        <StatCard label="Verified terms" value={verifiedTerms} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>
              Who can sign in, and what their role lets them reach. Roles are
              enforced on the server, not by hiding menu items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {users.map((user) => (
                <li key={user.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                      {user.school ? ` · ${user.school.name}` : ""}
                    </p>
                  </div>
                  <Badge variant={user.role === "ADMIN" ? "default" : "outline"}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                  {!user.isActive ? (
                    <Badge variant="destructive">Disabled</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schools</CardTitle>
              <CardDescription>Counted from the database.</CardDescription>
            </CardHeader>
            <CardContent>
              {schools.length === 0 ? (
                <p className="text-sm text-muted-foreground">No schools yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {schools.map((school) => (
                    <li key={school.id} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{school.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[school.district, school.state].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {school._count.users} account(s)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Languages</CardTitle>
              <CardDescription>
                Switching one on is a claim that this product can teach in it, so
                it is an administrator&apos;s decision.{" "}
                <code className="text-xs">PATCH /api/admin/languages</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {languages.map((language) => (
                  <li key={language.id} className="flex items-center gap-2 py-2.5">
                    <span className="flex-1 text-sm">
                      {language.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        {language.code}
                      </span>
                    </span>
                    <Badge
                      variant={language.status === "ACTIVE" ? "success" : "outline"}
                    >
                      {language.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Glossary</CardTitle>
              <CardDescription>
                {verifiedTerms} of {glossary} term(s) are marked verified.
                Verification comes from{" "}
                <Link href="/expert/review" className="underline underline-offset-2">
                  expert review
                </Link>
                ; withdrawing one is administrative.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <code className="text-xs">PATCH /api/admin/glossary</code> takes a
              term id and a verified flag. Curriculum data is on{" "}
              <Link href="/curriculum" className="underline underline-offset-2">
                Curriculum
              </Link>
              .
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
