import type { Metadata } from "next";

import { DevicePanel } from "@/components/shared/device-panel";
import { NotBuiltYet } from "@/components/shared/not-built-yet";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceSnapshot } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Offline & Sync" };

export default async function OfflineSyncPage() {
  const { counts } = await getWorkspaceSnapshot();

  return (
    <>
      <PageHeader
        title="Offline & Sync"
        description="What is stored on this tablet and what is waiting to upload. Phase 1 ships the offline shell and the sync queue table; draining that queue comes later."
      />

      <div className="grid gap-6 lg:grid-cols-2">
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
            <CardTitle>Sync queue</CardTitle>
            <CardDescription>
              Counted from the SyncItem table. Nothing writes to it yet, so zero
              is the correct number today.
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

      <div className="mt-6">
        <NotBuiltYet
          feature="Content sync"
          phase={2}
          summary="The service worker caches the app shell so the app opens without a network, but no lesson, translation or audio is cached and no queued change is uploaded."
          willInclude={[
            "Queue every offline edit as a SyncItem and drain the queue when the tablet reconnects.",
            "Cache pinned lessons, their translations and their audio for use with no network at all.",
            "Surface a conflict when the same record changed on two tablets, instead of silently picking one.",
            "Retry a failed upload with backoff and show the teacher what is stuck.",
          ]}
        />
      </div>
    </>
  );
}
