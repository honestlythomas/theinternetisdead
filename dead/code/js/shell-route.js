(function () {
  const isTopLevel = window.top === window.self;
  const params = new URLSearchParams(window.location.search);
  const allowStandalone = params.get("standalone") === "true";
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const isRootShellPath = window.location.pathname === "/" || window.location.pathname === "/index.html";

  const isSameOriginHttpUrl = (url) => {
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin === window.location.origin;
  };

  if (isTopLevel && !allowStandalone && !isRootShellPath) {
    window.__deadShellGuardActive = true;

    fetch("/index.html", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load root shell");
        return response.text();
      })
      .then((html) => {
        window.sessionStorage.setItem("deadRootShellFramePath", currentPath);
        document.open();
        document.write(html);
        document.close();
      })
      .catch(() => {
        window.location.replace(`/?frame=${encodeURIComponent(currentPath)}`);
      });

    return;
  }

  if (isTopLevel) return;

  const shouldIgnoreShortcut = (event) => {
    const target = event.target;
    if (!target) return false;
    const tagName = target.tagName ? target.tagName.toLowerCase() : "";
    return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
  };

  document.addEventListener("keydown", (event) => {
    if (event.key?.toLowerCase() !== "f" || event.ctrlKey || event.metaKey || event.altKey || shouldIgnoreShortcut(event)) return;

    window.parent.postMessage({
      type: "dead-shell-fullscreen-frame"
    }, window.location.origin);
  }, true);

  document.addEventListener("click", (event) => {
    const link = event.target?.closest?.("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;

    const nextUrl = new URL(link.getAttribute("href"), window.location.href);
    if (!isSameOriginHttpUrl(nextUrl)) return;

    event.preventDefault();
    window.parent.postMessage({
      type: "dead-shell-navigate",
      href: `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
    }, window.location.origin);
  }, true);
})();
