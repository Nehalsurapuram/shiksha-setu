import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Ol_Chiki } from "next/font/google";

import { ServiceWorkerRegistrar } from "@/components/layout/service-worker-registrar";
import { RevealReadyScript } from "@/components/marketing/reveal-ready-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Santhali is written in Ol Chiki, which Geist does not cover. Without this
 * face every Santhali string renders as tofu boxes on a stock Android tablet.
 */
const olChiki = Noto_Sans_Ol_Chiki({
  variable: "--font-ol-chiki",
  subsets: ["ol-chiki"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ShikshaSetu AI",
    template: "%s · ShikshaSetu AI",
  },
  description:
    "AI-powered translation, voice assistance and curriculum generation for multilingual classrooms.",
  applicationName: "ShikshaSetu AI",
  appleWebApp: {
    capable: true,
    title: "ShikshaSetu AI",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Installed-PWA defaults for a low-cost tablet: fill the screen, but never
  // block a teacher from zooming in on small Ol Chiki text.
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#141a1d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // RevealReadyScript sets data-reveal-ready on <html> before React
      // hydrates, so the server markup and the live DOM differ by that one
      // attribute by design. This suppresses the warning for this element's
      // attributes only; it does not extend to any child.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${olChiki.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <RevealReadyScript />
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
