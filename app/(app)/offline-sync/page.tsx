import { permanentRedirect } from "next/navigation";

/**
 * The Sync Center moved to `/offline` when it gained the upload half.
 *
 * Kept as a redirect rather than deleted: this path is in the service worker
 * caches of every tablet that has already been set up, and on any home-screen
 * shortcut a teacher made from it.
 */
export default function OfflineSyncRedirect(): never {
  permanentRedirect("/offline");
}
