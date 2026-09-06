import type { LanguageScript, LanguageStatus } from "@prisma/client";

export type LanguageSeed = {
  code: string;
  name: string;
  nativeName: string;
  script: LanguageScript;
  status: LanguageStatus;
  isSource: boolean;
  isTarget: boolean;
  sortOrder: number;
  notes?: string;
};

/** Which phase of the roadmap a feature belongs to. Drives the UI badges. */
export type FeaturePhase = 1 | 2 | 3;

export type NavItem = {
  label: string;
  href: string;
  /** lucide-react icon name, resolved in components/layout/nav-icon.tsx */
  icon: string;
  phase: FeaturePhase;
  description: string;
};

export type ApiError = {
  error: string;
  detail?: string;
};
