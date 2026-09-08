import { AppShell } from "@/components/layout/app-shell";
import { SyncOnReconnect } from "@/components/offline/sync-on-reconnect";
import type { SelectableLanguage } from "@/components/layout/language-selector";
import { getDefaultLanguagePair, listLanguages } from "@/lib/database/queries";

/**
 * Every screen under this group reads from Postgres, so the group renders per
 * request. Without this, `next build` would try to prerender the dashboard and
 * would need a live database at build time.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // The shell must render even when the database is unreachable, so the user
  // can still reach Settings and see what is wrong.
  let languages: SelectableLanguage[] = [];
  let defaultSource: string | null = null;
  let defaultTarget: string | null = null;

  try {
    const [all, pair] = await Promise.all([
      listLanguages(),
      getDefaultLanguagePair(),
    ]);

    languages = all.map((language) => ({
      code: language.code,
      name: language.name,
      nativeName: language.nativeName,
      status: language.status,
      isSource: language.isSource,
      isTarget: language.isTarget,
    }));

    if (pair) {
      defaultSource = pair.source.code;
      defaultTarget = pair.target.code;
    }
  } catch {
    // Leave the defaults: the header shows "No language pair configured".
  }

  return (
    <AppShell
      languages={languages}
      defaultSource={defaultSource}
      defaultTarget={defaultTarget}
    >
      {/* Drains the offline queue as soon as a network appears, on every
          screen — a teacher does not have to be looking at the Sync Center for
          their corrections to reach the server. */}
      <SyncOnReconnect />
      {children}
    </AppShell>
  );
}
