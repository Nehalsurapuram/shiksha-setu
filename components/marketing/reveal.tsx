"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Fades content up as it scrolls into view.
 *
 * Two failure modes matter more than the effect itself:
 *  - If IntersectionObserver is missing (older Android WebViews are the reason
 *    this is not hypothetical here), the content is shown immediately rather
 *    than staying invisible forever.
 *  - The CSS honours `prefers-reduced-motion` and renders the finished state.
 *
 * Motion is decoration only; nothing here is the sole carrier of meaning.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger, in milliseconds. Keep under ~300ms so nothing feels laggy. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Tells the inline failsafe in the layout that React is alive, so it does
    // not strip the reveal styling out from under us.
    document.documentElement.setAttribute("data-reveal-hydrated", "");

    const node = ref.current;

    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      // Fire slightly before the element reaches the viewport edge so the
      // animation is already settling by the time it is properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      data-visible={visible ? "true" : "false"}
      style={delay ? { "--reveal-delay": `${delay}ms` } as React.CSSProperties : undefined}
      className={className && cn(className)}
    >
      {children}
    </Tag>
  );
}
