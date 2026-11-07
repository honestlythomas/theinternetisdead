(() => {
  if (window.top !== window || window.__deadShellGuardActive) return;

  const { pathname, search, hash } = window.location;
  if (!pathname.startsWith("/dead/games/") && !pathname.startsWith("/dead/experiments/")) return;
  const requireShell = document.currentScript?.hasAttribute("data-require-shell");
  if (!requireShell && new URLSearchParams(search).get("standalone") === "true") return;

  window.__deadShellGuardActive = true;
  const route = pathname + search + hash;
  const shellUrl = new URL("/index.html", window.location.origin);
  shellUrl.searchParams.set("shell-route", route);
  window.location.replace(shellUrl.href);
})();
