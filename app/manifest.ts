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
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
