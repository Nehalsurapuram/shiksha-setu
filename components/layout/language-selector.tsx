"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

export type SelectableLanguage = {
  code: string;
  name: string;
  nativeName: string;
  status: "ACTIVE" | "PLANNED" | "DEPRECATED";
  isSource: boolean;
  isTarget: boolean;
};

const STORAGE_KEY = "shikshasetu.languagePair";

/**
 * Classroom language pair.
 *
 * Native <select> on purpose: on a low-cost Android tablet this opens the OS
 * picker, which gives large touch targets, correct scrolling and screen-reader
 * support for free — better than any custom dropdown we would build.
 *
 * Planned languages are listed but disabled. They appear so the roadmap is
 * visible; they are unselectable because choosing one would imply the app can
 * work in a language it has no support for.
 *
 * The choice is kept in localStorage. It is a per-device preference, not a
 * server-side setting: there is no authentication yet, so writing it to a user
 * record would attribute it to whoever the seeded teacher happens to be.
 */
export function LanguageSelector({
  languages,
  defaultSource,
  defaultTarget,
}: {
  languages: SelectableLanguage[];
  defaultSource: string;
  defaultTarget: string;
}) {
  const [source, setSource] = useState(defaultSource);
  const [target, setTarget] = useState(defaultTarget);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Site data blocked. The defaults from the server are still correct.
      return;
    }
    if (!stored) return;

    const [storedSource, storedTarget] = stored.split("|");
    const isSelectable = (code: string, kind: "source" | "target") =>
      languages.some(
        (language) =>
          language.code === code &&
          language.status === "ACTIVE" &&
          (kind === "source" ? language.isSource : language.isTarget),
      );

    // Re-validate: a language that was selectable when this was saved may have
    // been removed or moved back to planned since.
    if (storedSource && isSelectable(storedSource, "source")) {
      setSource(storedSource);
    }
    if (storedTarget && isSelectable(storedTarget, "target")) {
      setTarget(storedTarget);
    }
  }, [languages]);

  const persist = (nextSource: string, nextTarget: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, `${nextSource}|${nextTarget}`);
    } catch {
      // Nothing to do: the selection still applies for this session.
    }
  };

  const sources = languages.filter((language) => language.isSource);
  const targets = languages.filter((language) => language.isTarget);

  return (
    <div className="flex items-center gap-1.5">
      <LanguageSelect
        label="Language of instruction"
        value={source}
        options={sources}
        onChange={(code) => {
          setSource(code);
          persist(code, target);
        }}
      />
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <LanguageSelect
        label="Mother tongue"
        value={target}
        options={targets}
        onChange={(code) => {
          setTarget(code);
          persist(source, code);
        }}
      />
    </div>
  );
}

function LanguageSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectableLanguage[];
  onChange: (code: string) => void;
}) {
  return (
    <label className="flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 max-w-32 truncate rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground sm:max-w-none sm:text-sm"
      >
        {options.map((language) => (
          <option
            key={language.code}
            value={language.code}
            disabled={language.status !== "ACTIVE"}
          >
            {language.name}
            {language.status !== "ACTIVE" ? " (planned)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
