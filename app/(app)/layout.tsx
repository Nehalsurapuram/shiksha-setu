import { AppShell } from "@/components/layout/app-shell";
import { getDefaultLanguagePair } from "@/lib/database/queries";

/**
 * Every screen under this group reads from Postgres, so the group renders per
 * request. Without this, `next build` would try to prerender the dashboard and
 * would need a live database at build time.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // The header label is cosmetic: if the database is unreachable the shell must
  // still render so the user can reach Settings and see what is wrong.
  let languagePair = "Language pair not configured";
  try {
    const pair = await getDefaultLanguagePair();
    if (pair) languagePair = `${pair.source.name} → ${pair.target.name}`;
  } catch {
    languagePair = "Database unavailable";
  }

  return <AppShell languagePair={languagePair}>{children}</AppShell>;
}
