import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { StatusRow } from "@/components/shared/status-row";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProviderReadiness, isDemoMode } from "@/lib/ai";
import { listLanguages } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Settings" };

/**
 * Read-only in Phase 1. It reports what the server is actually configured with
 * — never the values themselves, so no key can leak into the page HTML.
 */
export default async function SettingsPage() {
  const providers = getProviderReadiness();
  const demoMode = isDemoMode();
  const languages = await listLanguages();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Read-only for now: Phase 1 reports the configuration the server booted with. Editing it from here comes with authentication in a later phase."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Providers</CardTitle>
            <CardDescription>
              Whether a credential is present — never the credential itself. Keys
              stay on the server and are never sent to the browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {providers.map((provider) => (
                <StatusRow
                  key={provider.name}
                  ok={provider.credentialPresent}
                  label={`${provider.label} · ${provider.roleLabel}${provider.selected ? " · selected" : ""}`}
                  detail={
                    provider.credentialPresent
                      ? "Key configured. Phase 1 never calls this provider."
                      : "No key configured. Set it in .env before Phase 2."
                  }
                />
              ))}
              <StatusRow
                ok={demoMode}
                label="Demo mode"
                detail={
                  demoMode
                    ? "On. Unbuilt features state plainly that they are unbuilt rather than showing sample output."
                    : "Off. With no providers wired up, leave this on until Phase 2."
                }
              />
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Languages</CardTitle>
            <CardDescription>
              The classroom pair is Hindi to Santhali. Ho and Mundari are on the
              roadmap and are not usable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {languages.map((language) => (
              <div
                key={language.id}
                className="rounded-md border border-border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">
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
                  <Badge
                    variant={
                      language.status === "ACTIVE" ? "success" : "outline"
                    }
                  >
                    {language.status === "ACTIVE" ? "Active" : "Planned"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {language.code} ·{" "}
                  {language.script.toLowerCase().replace("_", " ")} ·{" "}
                  {[
                    language.isSource ? "source" : null,
                    language.isTarget ? "mother tongue" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {language.notes ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {language.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
