/**
 * Copy for the public site, kept out of the components so the wording can be
 * reviewed in one place.
 *
 * Honesty rule carried over from Phase 1: nothing here may state a measured
 * result. This product has not been deployed to a classroom, so every number
 * below is labelled as a target, and every capability described in the feature
 * cards is marked with the phase that will build it.
 */

export const BRAND = {
  name: "ShikshaSetu AI",
  tagline: "Bridging Teachers and Learners Through Language.",
  secondary: "Teach in the language every child understands.",
} as const;

export type BuildState = "in-progress" | "planned";

export type Feature = {
  title: string;
  description: string;
  icon: string;
  state: BuildState;
  phase: number;
};

export const PROBLEMS = [
  {
    title: "Teachers posted across a language line",
    body: "A teacher trained and posted to teach in Hindi is often assigned to a school where the children speak Santhali, Ho or Mundari at home. Both sides are fluent — in different languages.",
    icon: "Users",
  },
  {
    title: "The tribal language barrier",
    body: "A child who cannot follow the language of instruction is not a slow learner. They are being assessed in a language they are still acquiring, and the gap compounds every year.",
    icon: "MessageSquareOff",
  },
  {
    title: "Low-resource NLP",
    body: "Santhali, Ho and Mundari have little digitised text, few parallel corpora and limited tooling. General-purpose translation systems are weakest exactly where the need is greatest.",
    icon: "Braces",
  },
  {
    title: "Connectivity cannot be assumed",
    body: "Rural schools lose network for hours or days. Any tool that only works online is a tool that fails during the lesson it was meant to support.",
    icon: "CloudOff",
  },
  {
    title: "Mother-tongue instruction works",
    body: "NEP 2020 and decades of MTB-MLE research point the same way: children learn to read fastest in the language they already think in. The policy exists; the classroom tooling does not.",
    icon: "BookHeart",
  },
] as const;

export const FEATURES: Feature[] = [
  {
    title: "Hindi → Santhali Translation",
    description:
      "Translate lesson text into Santhali in Ol Chiki script, with a teacher-editable glossary so a correction made once is reused everywhere.",
    icon: "Languages",
    state: "in-progress",
    phase: 3,
  },
  {
    title: "Voice-to-Voice Translation",
    description:
      "Speak a sentence in Hindi and hear it in the mother tongue — for the many teachers and children who speak a language they do not read.",
    icon: "Mic",
    state: "planned",
    phase: 3,
  },
  {
    title: "AI Lesson Generation",
    description:
      "Draft a bilingual lesson from a syllabus topic and grade, keeping the Hindi source and the Santhali version side by side.",
    icon: "BookOpen",
    state: "planned",
    phase: 3,
  },
  {
    title: "Bilingual Worksheets",
    description:
      "Printable practice sheets in both languages — matching, fill-in-the-blank, reading and picture labelling — generated from a lesson.",
    icon: "FileText",
    state: "planned",
    phase: 3,
  },
  {
    title: "Visual Flashcards",
    description:
      "Picture-and-word cards pairing the Hindi and Santhali term, with a recorded pronunciation attached to each card.",
    icon: "Layers",
    state: "planned",
    phase: 3,
  },
  {
    title: "Offline Classroom",
    description:
      "Pinned lessons, translations and audio stay on the tablet. The app opens and teaches with no network at all.",
    icon: "WifiOff",
    state: "in-progress",
    phase: 3,
  },
];

export const PIPELINE = [
  {
    label: "Teacher",
    detail: "Starts from the lesson they already have to teach today.",
    icon: "User",
  },
  {
    label: "Hindi input",
    detail: "Typed text, spoken audio, or a page from the textbook PDF.",
    icon: "FileInput",
  },
  {
    label: "AI processing",
    detail: "Translation and generation, with the glossary applied first.",
    icon: "Sparkles",
  },
  {
    label: "Santhali",
    detail: "Rendered in Ol Chiki, the script the language is actually written in.",
    icon: "Languages",
  },
  {
    label: "Text + audio",
    detail: "Readable on screen and playable aloud for non-readers.",
    icon: "Volume2",
  },
  {
    label: "Student",
    detail: "Receives the lesson in the language they think in.",
    icon: "GraduationCap",
  },
] as const;

export const IMPACT_TARGETS = [
  {
    value: "5,000+",
    label: "Target schools",
    note: "The deployment goal across tribal-majority blocks. Not yet deployed.",
  },
  {
    value: "3",
    label: "Target languages",
    note: "Santhali first, then Ho and Mundari. One is in progress.",
  },
  {
    value: "<3 sec",
    label: "Target voice translation",
    note: "The latency budget for speech to be usable mid-lesson. Not yet measured.",
  },
  {
    value: "Offline",
    label: "Classroom-ready design goal",
    note: "Full lesson delivery with no network. The app shell works offline today.",
  },
] as const;

export const OFFLINE_STEPS = [
  {
    step: "01",
    title: "Initial synchronisation",
    body: "While the tablet has a connection — at the block office, a teacher's home, anywhere with signal — it pulls down the lessons, translations and audio the teacher has pinned.",
    icon: "CloudDownload",
  },
  {
    step: "02",
    title: "Local content",
    body: "Everything pinned lives on the device. Content is stored locally through IndexedDB, and the app shell itself is cached by a service worker.",
    icon: "HardDrive",
  },
  {
    step: "03",
    title: "Classroom operation",
    body: "The lesson runs with no network. Edits and assessment records queue on the device and upload themselves the next time the tablet finds a signal.",
    icon: "School",
  },
] as const;

export const TECHNOLOGY = [
  { name: "Next.js", role: "App Router, server components" },
  { name: "TypeScript", role: "End-to-end type safety" },
  { name: "Sarvam AI", role: "Indic translation and speech" },
  { name: "PostgreSQL", role: "Lessons, glossary, outcomes" },
  { name: "Prisma", role: "Schema, migrations, queries" },
  { name: "PWA", role: "Installable on a tablet" },
  { name: "IndexedDB", role: "On-device offline content" },
] as const;

/**
 * Footer navigation.
 *
 * `href: null` means the destination does not exist yet — there is no public
 * repository, docs site or support address to point at. Those render as plain
 * text marked "soon" rather than as links that go nowhere, because a dead link
 * in a footer reads as a broken site, not as an unfinished one.
 */
export type FooterLink = { label: string; href: string | null };

export const FOOTER_LINKS: {
  heading: string;
  links: readonly FooterLink[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "About", href: "#about" },
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Offline", href: "#offline" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Technology", href: "#technology" },
      { label: "Teacher Assistant", href: "/dashboard" },
      { label: "GitHub", href: null },
      { label: "Documentation", href: null },
      { label: "Contact", href: null },
    ],
  },
];
