/* Compatibility loader for pages that still reference the former root-shell router. */
(() => {
  "use strict";

  // Prevent legacy inline fallbacks from redirecting standalone pages to /?frame=...
  window.__deadShellGuardActive = true;

  // Embedded experiments and game surfaces inherit navigation from their host page.
  if (window.top !== window.self) return;
  if (document.querySelector('script[data-dead-transition-engine]')) return;

  const script = document.createElement("script");
  script.src = "/dead/scripts/page-transitions.js?v=20260809-6";
  script.async = false;
  script.dataset.deadTransitionEngine = "";
  (document.head || document.documentElement).appendChild(script);
})();
