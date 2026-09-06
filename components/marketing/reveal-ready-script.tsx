/**
 * Arms the scroll-reveal CSS before first paint, and disarms it if the page
 * never hydrates.
 *
 * This runs as a blocking inline script placed first in <body>, so the hidden
 * state is applied before any revealed element is painted — no flash of
 * content that then disappears.
 *
 * The 2.5s failsafe is the important half. Without it, any failure to hydrate
 * (a dropped chunk on a weak rural connection is the realistic case) would
 * leave a page of `opacity: 0` content — a blank white screen instead of a
 * readable one. Reveal marks the document hydrated on its first mount.
 */
const SCRIPT = `(function(){var e=document.documentElement;e.setAttribute("data-reveal-ready","");setTimeout(function(){if(!e.hasAttribute("data-reveal-hydrated")){e.removeAttribute("data-reveal-ready")}},2500)})();`;

export function RevealReadyScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
