import type { Metadata } from "next";

import { SavedLibrary } from "@/components/offline/saved-library";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const metadata: Metadata = { title: "Saved content" };
export const dynamic = "force-dynamic";

/**
 * The offline library.
 *
 * The page shell needs the language pair from the server, but everything below
 * it is read from IndexedDB by the client. That is deliberate: this screen has
 * to behave identically with the network on or off, so it must not depend on a
 * server response for its content. Whatever it shows is genuinely on the
 * tablet.
 */
export default async function LibraryPage() {
  const pair = await getDefaultLanguagePair();

  return (
    <>
      <PageHeader
        title="Saved content"
        description="Everything downloaded to this tablet. This screen reads only from the device, so it works exactly the same with no internet."
        action={<Badge variant="outline">On this device</Badge>}
      />

      <SavedLibrary targetIsOlChiki={pair?.target.script === "OL_CHIKI"} />
    </>
  );
}
