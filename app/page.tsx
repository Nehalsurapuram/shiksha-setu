import type { Metadata } from "next";

import { FeaturesSection } from "@/components/marketing/features-section";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ImpactSection } from "@/components/marketing/impact-section";
import { OfflineSection } from "@/components/marketing/offline-section";
import { ProblemSection } from "@/components/marketing/problem-section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { TechnologySection } from "@/components/marketing/technology-section";
import { BRAND } from "@/lib/marketing";

export const metadata: Metadata = {
  title: {
    absolute: `${BRAND.name} — Teach Every Child in Their Mother Tongue`,
  },
  description:
    "An MTB-MLE teacher assistant being built to bridge Hindi-medium teachers and tribal-language-speaking students, with offline-first translation, voice and lesson tools.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <ProblemSection />
        <FeaturesSection />
        <HowItWorks />
        <ImpactSection />
        <OfflineSection />
        <TechnologySection />
      </main>
      <SiteFooter />
    </div>
  );
}
