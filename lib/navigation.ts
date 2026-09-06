import type { NavItem } from "@/types";

/**
 * Sidebar navigation. `phase` is not decoration: anything above phase 1 renders
 * a "Not built yet" placeholder rather than a mock of a feature that does not
 * exist. See docs/PHASE-1.md.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    phase: 1,
    description: "Classroom overview and setup status.",
  },
  {
    label: "Translator",
    href: "/translator",
    icon: "Languages",
    phase: 2,
    description: "Hindi to Santhali translation with a teacher-editable glossary.",
  },
  {
    label: "Voice Assistant",
    href: "/voice-assistant",
    icon: "Mic",
    phase: 2,
    description: "Speak a sentence, hear it back in the mother tongue.",
  },
  {
    label: "Lessons",
    href: "/lessons",
    icon: "BookOpen",
    phase: 2,
    description: "Bilingual lesson plans built from the state syllabus.",
  },
  {
    label: "Worksheets",
    href: "/worksheets",
    icon: "FileText",
    phase: 2,
    description: "Printable practice sheets generated from a lesson.",
  },
  {
    label: "Flashcards",
    href: "/flashcards",
    icon: "Layers",
    phase: 2,
    description: "Picture-and-word cards for early vocabulary.",
  },
  {
    label: "Assessments",
    href: "/assessments",
    icon: "ClipboardCheck",
    phase: 3,
    description: "Oral and written checks mapped to learning outcomes.",
  },
  {
    label: "Audio Library",
    href: "/audio-library",
    icon: "AudioLines",
    phase: 3,
    description: "Recorded pronunciations, cached for offline playback.",
  },
  {
    label: "Offline & Sync",
    href: "/offline-sync",
    icon: "RefreshCw",
    phase: 1,
    description: "What is stored on this tablet and what is waiting to upload.",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "BarChart3",
    phase: 3,
    description: "Usage and learning-outcome trends across schools.",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "Settings",
    phase: 1,
    description: "Language pair, school details and provider configuration.",
  },
];
