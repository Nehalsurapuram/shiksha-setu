"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fades content up as it scrolls into view — for content below the fold only.
 *
 * The server renders no `data-reveal` attribute, so the content is visible in
 * plain HTML. After mount this measures the element and hides it *only* if the
 * reader cannot see it yet, then reveals it on scroll. Text is never hidden
 * waiting for JavaScript, which is the whole point: on a low-cost tablet over
 * a rural connection, a decorative animation must not be able to produce a
 * blank page.
 *
 * The attribute is set imperatively rather than through React state so that
 * React never owns it — no hydration mismatch, and no cascading re-render.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: "div" | "li";
  /** Stagger, in milliseconds. Keep under ~300ms so nothing feels laggy. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    // Already visible, or scrolled past: leave it alone. Hiding it now would
    // make content the reader is looking at vanish and animate back in.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    node.style.setProperty("--reveal-delay", `${delay}ms`);
    node.dataset.reveal = "hidden";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.dataset.reveal = "shown";
            observer.disconnect();
          }
        }
      },
      // Fire slightly before the element reaches the viewport edge so the
      // animation is already settling by the time it is properly in view.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
