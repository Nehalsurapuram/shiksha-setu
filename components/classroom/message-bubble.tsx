"use client";

import { useRef, useState } from "react";
import { Bot, GraduationCap, Pause, Play, User, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Role = "teacher" | "ai" | "student";

export type ChatMessage = {
  id: string;
  role: Role;
  /** Whose turn produced this message, so a pair can be grouped. */
  turnId: string;
  languageCode: string;
  languageName: string;
  text: string;
  isOlChiki: boolean;
  audioUrl: string | null;
  audioUnavailableReason: string | null;
  at: string;
  latencyMs: number | null;
  isDemo: boolean;
  /**
   * Which side of the room this belongs to. A translation sits with the person
   * it is *for*, not the person who spoke, so each side can follow its own
   * column down the screen.
   */
  side: "teacher" | "student";
};

const TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
});

const ROLE_META: Record<Role, { label: string; icon: typeof User }> = {
  teacher: { label: "Teacher", icon: User },
  ai: { label: "AI translation", icon: Bot },
  student: { label: "Student", icon: GraduationCap },
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const meta = ROLE_META[message.role];
  const Icon = meta.icon;
  // Teacher column on the left, student column on the right.
  const alignRight = message.side === "student";

  return (
    <li className={cn("flex", alignRight ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[42rem] rounded-2xl border p-4",
          message.role === "ai"
            ? "border-border bg-muted/50"
            : message.role === "teacher"
              ? "border-primary/30 bg-accent"
              : "border-marigold/40 bg-marigold-tint",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5" aria-hidden />
            {meta.label}
          </span>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
            {message.languageName} · {message.languageCode}
          </span>
          <time
            dateTime={message.at}
            className="text-muted-foreground"
            title={new Date(message.at).toLocaleString("en-IN")}
          >
            {TIME_FORMAT.format(new Date(message.at))}
          </time>
          {message.isDemo ? (
            <span className="rounded-full bg-warning px-1.5 py-0.5 text-[0.65rem] text-warning-foreground">
              Demo
            </span>
          ) : null}
        </div>

        <p
          className={cn(
            "mt-2 whitespace-pre-wrap text-lg leading-relaxed",
            // Demo output is a plain notice, never styled as Santhali script.
            message.isOlChiki && !message.isDemo && "font-ol-chiki",
            message.isDemo && "text-muted-foreground",
          )}
        >
          {message.text}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {message.audioUrl ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const el = audioRef.current;
                  if (!el) return;
                  if (el.paused) void el.play();
                  else el.pause();
                }}
              >
                {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                {playing ? "Pause" : "Listen"}
              </Button>
              <audio
                ref={audioRef}
                src={message.audioUrl}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
            </>
          ) : message.audioUnavailableReason ? (
            <span className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
              <VolumeX className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {message.audioUnavailableReason}
            </span>
          ) : null}

          {message.latencyMs !== null ? (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {(message.latencyMs / 1000).toFixed(2)} s
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
