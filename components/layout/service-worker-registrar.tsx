"use client";

import { useEffect } from "react";

import { registerServiceWorker } from "@/lib/offline/register-service-worker";

/** Renders nothing; exists so the root layout can stay a Server Component. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
