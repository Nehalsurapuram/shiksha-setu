const DEVICE_ID_KEY = "shikshasetu.deviceId";

/**
 * A stable per-tablet id. Every queued offline mutation carries it so the server
 * can tell two teachers sharing one login apart, and so a replayed queue from a
 * re-imaged tablet does not collide with the original.
 *
 * Browser-only: returns null when called during server rendering.
 */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const created = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    // Private browsing or blocked site data. The app still works, it just
    // cannot queue offline work on this device.
    return null;
  }
}
