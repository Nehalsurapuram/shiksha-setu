import type { FeaturePhase } from "@/types";

/**
 * Dashboard quick actions.
 *
 * Every one navigates to its own page. None of them performs an action from
 * the dashboard, and `phase` above 1 means the destination page states plainly
 * that the feature is not built yet — so a quick action never implies working
 * functionality behind it.
 */
export type QuickAction = {
  label: string;
  href: string;
  icon: string;
  phase: FeaturePhase;
  hint: string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Translate",
    href: "/translator",
    icon: "Languages",
    phase: 1,
    hint: "Hindi to Santhali",
  },
  {
    label: "Voice Assistant",
    href: "/voice-assistant",
    icon: "Mic",
    phase: 2,
    hint: "Speak and listen",
  },
  {
    label: "Upload Lesson",
    href: "/lessons",
    icon: "Upload",
    phase: 2,
    hint: "Text or textbook PDF",
  },
  {
    label: "Generate Worksheet",
    href: "/worksheets",
    icon: "FileText",
    phase: 2,
    hint: "Printable practice",
  },
  {
    label: "Generate Flashcards",
    href: "/flashcards",
    icon: "Layers",
    phase: 2,
    hint: "Picture and word cards",
  },
];
