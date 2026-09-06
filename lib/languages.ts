import type { LanguageSeed } from "@/types";

/**
 * Canonical language list. The seed script writes exactly this into the
 * Language table, so adding a language here is the only change needed to
 * make it appear in the app once its status flips to "active".
 */
export const LANGUAGES: LanguageSeed[] = [
  {
    code: "hi-IN",
    name: "Hindi",
    nativeName: "हिन्दी",
    script: "DEVANAGARI",
    status: "ACTIVE",
    isSource: true,
    isTarget: false,
    sortOrder: 1,
    notes: "Language of instruction and of most state textbooks.",
  },
  {
    code: "sat-IN",
    name: "Santhali",
    nativeName: "ᱥᱟᱱᱛᱟᱲᱤ",
    script: "OL_CHIKI",
    status: "ACTIVE",
    isSource: false,
    isTarget: true,
    sortOrder: 2,
    notes: "First supported mother tongue. Written in the Ol Chiki script.",
  },
  {
    code: "hoc-IN",
    name: "Ho",
    nativeName: "𑢹𑣉𑣉",
    script: "LATIN",
    status: "PLANNED",
    isSource: false,
    isTarget: true,
    sortOrder: 3,
    notes: "Planned. Warang Citi script support is not built yet.",
  },
  {
    code: "unr-IN",
    name: "Mundari",
    nativeName: "ᱢᱩᱸᱰᱟᱨᱤ",
    script: "DEVANAGARI",
    status: "PLANNED",
    isSource: false,
    isTarget: true,
    sortOrder: 4,
    notes: "Planned. Script choice varies by district and is not settled.",
  },
];

export const DEFAULT_SOURCE_LANGUAGE = "hi-IN";
export const DEFAULT_TARGET_LANGUAGE = "sat-IN";
