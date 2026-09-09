import type { MetadataRoute } from "next";

/**
 * PWA manifest. `start_url` is the dashboard rather than the landing page: once
 * a teacher installs this to a tablet home screen, the marketing page is not
 * what they want to open in front of a class.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ShikshaSetu AI — MTB-MLE Teacher Assistant",
    short_name: "ShikshaSetu",
    description:
      "AI-powered translation, voice assistance and curriculum generation for multilingual classrooms.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7fafb",
    theme_color: "#f7fafb",
    categories: ["education"],
    // PNGs as well as the SVG: Chrome rasterises an SVG icon, but the Android
    // WebView and Samsung Internet builds these tablets ship with do not
    // reliably do so, and an installer that cannot produce an icon does not
    // offer the install at all.
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
