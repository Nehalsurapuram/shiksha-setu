import type { Metadata } from "next";

import { OfflineManager } from "@/components/offline/offline-manager";
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
        description="Download your saved content to this tablet so it opens with no internet, and see exactly what is stored here."
      />

      <OfflineManager
        sourceLanguage={{
          code: pair?.source.code ?? "hi-IN",
          name: pair?.source.name ?? "Hindi",
        }}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
              Counted from the SyncItem table. Editing content on the tablet is
              not built yet, so nothing writes to it and zero is correct.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatCard
              label="Changes waiting to upload"
              value={counts.pendingSyncItems}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
