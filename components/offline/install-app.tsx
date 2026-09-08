"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Share, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useHydrated } from "@/lib/offline/use-hydrated";

/**
 * The `beforeinstallprompt` event, which is Chromium-only and not in lib.dom.
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeInstalled(onStoreChange: () => void): () => void {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);
  return () => {
    query.removeEventListener("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

const getInstalledSnapshot = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // iOS Safari does not implement display-mode for home-screen apps.
  (window.navigator as { standalone?: boolean }).standalone === true;

/** The server cannot know how this tablet opened the app. */
const getInstalledServerSnapshot = () => false;

/**
 * Installs the app to the tablet home screen.
 *
 * The button appears only when the browser has actually offered a prompt.
 * Calling `prompt()` without a stored event silently does nothing, and a button
 * that does nothing is worse than no button on a device a teacher is trying to
 * set up before class.
 *
 * Installing changes how the app opens, not what it can do: the cloud features
 * still need a network afterwards, so nothing here implies otherwise.
 */
export function InstallApp() {
  const hydrated = useHydrated();
  const installed = useSyncExternalStore(
    subscribeInstalled,
    getInstalledSnapshot,
    getInstalledServerSnapshot,
  );

  // Not a mirror of external state: the event object itself is the only handle
  // that can open the install dialog, and it has to survive until pressed.
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // The event cannot be reused, so drop it either way rather than leaving a
    // button that would do nothing on a second press. An accepted install is
    // reported by the display-mode store above, not guessed from the outcome.
    setPrompt(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {installed ? (
            <Check className="size-4 text-success" aria-hidden />
          ) : (
            <Smartphone className="size-4" aria-hidden />
          )}
          Install on this tablet
        </CardTitle>
        <CardDescription>
          {installed
            ? "This app is installed on this device and opens from the home screen."
            : "Adds ShikshaSetu to the home screen so it opens full-screen, without the browser bar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!installed && prompt ? (
          <Button onClick={install}>
            <Smartphone aria-hidden />
            Install app
          </Button>
        ) : null}

        {hydrated && !installed && !prompt ? (
          <p className="flex items-start gap-2 text-muted-foreground">
            <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              This browser has not offered an install prompt. On Android Chrome
              use the menu → <strong>Add to Home screen</strong>; on iPad Safari
              use Share → <strong>Add to Home Screen</strong>.
            </span>
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Installing changes how the app opens, not what it can do without a
          network. Downloaded content opens offline; translation, speech and
          generation still need a connection.
        </p>
      </CardContent>
    </Card>
  );
}
