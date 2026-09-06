"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser connectivity. Starts optimistic (true) so server and client
 * render the same markup on the first pass, then corrects itself on mount.
 */
export function useOnlineStatus(): { isOnline: boolean; hasChecked: boolean } {
  const [isOnline, setIsOnline] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);

    update();
    setHasChecked(true);

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return { isOnline, hasChecked };
}
