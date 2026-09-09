import type { Metadata } from "next";

import { InstallApp } from "@/components/offline/install-app";
import { OfflineManager } from "@/components/offline/offline-manager";
import { SyncQueue } from "@/components/offline/sync-queue";
import { DevicePanel } from "@/components/shared/device-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDefaultLanguagePair, getWorkspaceSnapshot } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Offline & Sync" };
export const dynamic = "force-dynamic";

export default async function OfflineSyncPage() {
  const [{ counts }, pair] = await Promise.all([
    getWorkspaceSnapshot(),
    getDefaultLanguagePair(),
  ]);

  return (
    <>
      <PageHeader
        title="Offline & Sync"
        description="What is stored on this tablet, and what this tablet has changed that the server has not seen yet."
      />

      <SyncQueue />

      <OfflineManager
        sourceLanguage={{
          code: pair?.source.code ?? "hi-IN",
          name: pair?.source.name ?? "Hindi",
        }}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <InstallApp />

        <Card>
          <CardHeader>
            <CardTitle>This device</CardTitle>
            <CardDescription>
              Read from the browser, so it reflects the tablet you are holding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DevicePanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload queue</CardTitle>
            <CardDescription>
              Counted from the SyncItem table on the server — the record of what
              this and every other tablet has sent. The queue above is the
              tablet&apos;s own side of the same story.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatCard
              label="Changes recorded as pending on the server"
              value={counts.pendingSyncItems}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
