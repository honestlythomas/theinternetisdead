/*
 * THE INTERNET IS DEAD — shared route transition engine
 *
 * Every page opts in with:
 *   <script src="/dead/scripts/page-transitions.js"></script>
 *
 * Add transitions with PageTransitions.register(name, definition).
 * Assign them with PageTransitions.route(from, to, name, options).
 * Routes accept exact paths, "*", or a RegExp.
 */
(() => {
  "use strict";

  const HANDOFF_KEY = "theinternetisdead:page-transition";
  const HANDOFF_MAX_AGE = 30000;
  const transitions = new Map();
  const routes = [];
  let leaving = false;

  const cleanPath = value => {
    const url = new URL(value, window.location.href);
    let path = url.pathname.replace(/\/index\.html$/i, "/");
    if (path.length > 1 && !path.endsWith("/")) path += "/";
    return path;
  };

  const routeMatches = (pattern, path) => {
    if (pattern === "*") return true;
    if (pattern instanceof RegExp) return pattern.test(path);
    return cleanPath(pattern) === path;
  };

  const findRoute = (from, to) => {
    for (let index = routes.length - 1; index >= 0; index -= 1) {
      const rule = routes[index];
      if (routeMatches(rule.from, from) && routeMatches(rule.to, to)) return rule;
    }
    return null;
  };

  const waitFor = animation => new Promise(resolve => {
    animation.addEventListener("finish", resolve, { once: true });
    animation.addEventListener("cancel", resolve, { once: true });
  });

  const makeOverlay = () => {
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "none",
      transformOrigin: "50% 50%",
      background: "repeating-conic-gradient(from 0deg, transparent 0 8deg, rgba(255,0,212,.13) 8deg 10deg, transparent 10deg 18deg), radial-gradient(circle at center, #000 0 2%, rgba(0,0,0,.82) 5%, transparent 28%)"
    });
    document.body.appendChild(overlay);
    return overlay;
  };

  const playSwirl = async (direction, options = {}) => {
    const duration = options.duration ?? 2500;
    const root = options.element
      ? document.querySelector(options.element)
      : document.querySelector("[data-transition-root]") || document.body.firstElementChild || document.body;
    const overlay = makeOverlay();
    const outgoing = direction === "out";
    const easing = outgoing
      ? "cubic-bezier(.72,0,.94,.56)"
      : "cubic-bezier(.08,.58,.28,1)";

    document.documentElement.style.overflow = "hidden";
    document.body.style.pointerEvents = "none";
    root.style.transformOrigin = "50% 50%";
    root.style.willChange = "transform, filter, opacity";

    const rootFrames = outgoing ? [
      { opacity: 1, transform: "rotate(0deg) scale(1)", filter: "saturate(1) contrast(1)" },
      { opacity: 1, transform: "rotate(36deg) scale(1.06)", filter: "saturate(1.35) contrast(1.08)", offset: .24 },
      { opacity: .92, transform: "rotate(430deg) scale(.48)", filter: "saturate(1.8) contrast(1.18) blur(.5px)", offset: .72 },
      { opacity: 0, transform: "rotate(745deg) scale(.015)", filter: "saturate(2.2) contrast(1.3) blur(2px)" }
    ] : [
      { opacity: 0, transform: "rotate(-745deg) scale(.015)", filter: "saturate(2.2) contrast(1.3) blur(2px)" },
      { opacity: .92, transform: "rotate(-430deg) scale(.48)", filter: "saturate(1.8) contrast(1.18) blur(.5px)", offset: .28 },
      { opacity: 1, transform: "rotate(-36deg) scale(1.06)", filter: "saturate(1.35) contrast(1.08)", offset: .76 },
      { opacity: 1, transform: "rotate(0deg) scale(1)", filter: "none" }
    ];

    const overlayFrames = outgoing ? [
      { opacity: 0, transform: "scale(.1) rotate(0deg)" },
      { opacity: .46, offset: .55 },
      { opacity: 1, transform: "scale(3) rotate(745deg)" }
    ] : [
      { opacity: 1, transform: "scale(3) rotate(-745deg)" },
      { opacity: .46, offset: .45 },
      { opacity: 0, transform: "scale(.1) rotate(0deg)" }
    ];

    const rootAnimation = root.animate(rootFrames, { duration, easing, fill: "both" });
    const overlayAnimation = overlay.animate(overlayFrames, { duration, easing: outgoing ? "ease-in" : "ease-out", fill: "both" });
    await Promise.all([waitFor(rootAnimation), waitFor(overlayAnimation)]);

    if (!outgoing) {
      rootAnimation.cancel();
      overlayAnimation.cancel();
      overlay.remove();
      root.style.removeProperty("transform-origin");
      root.style.removeProperty("will-change");
      document.body.style.removeProperty("pointer-events");
      document.documentElement.style.removeProperty("overflow");
    }
  };

  const api = {
    register(name, definition) {
      if (!name || !definition || typeof definition.out !== "function" || typeof definition.in !== "function") {
        throw new TypeError("A transition needs a name plus in() and out() functions.");
      }
      transitions.set(name, definition);
      return api;
    },

    route(from, to, transition, options = {}) {
      routes.push({ from, to, transition, options });
      return api;
    },

    removeRoute(from, to) {
      for (let index = routes.length - 1; index >= 0; index -= 1) {
        if (routes[index].from === from && routes[index].to === to) routes.splice(index, 1);
      }
      return api;
    },

    get(from, to) {
      return findRoute(cleanPath(from), cleanPath(to));
    },

    async navigate(destination, transitionName, options = {}) {
      if (leaving) return;
      const url = new URL(destination, window.location.href);
      const from = cleanPath(window.location.href);
      const to = cleanPath(url.href);
      const rule = transitionName
        ? { transition: transitionName, options }
        : findRoute(from, to);

      if (!rule || !transitions.has(rule.transition)) {
        window.location.assign(url.href);
        return;
      }

      leaving = true;
      const definition = transitions.get(rule.transition);
      const settings = { ...rule.options, ...options };
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
        from,
        to,
        transition: rule.transition,
        options: settings,
        createdAt: Date.now()
      }));

      try {
        await definition.out(settings, { from, to, url });
      } finally {
        window.location.assign(url.href);
      }
    },

    transitions,
    routes
  };

  window.PageTransitions = api;

  api.register("swirl", {
    out: options => playSwirl("out", options),
    in: options => playSwirl("in", options)
  });

  // Current portal rule. Add future route pairs here.
  api.route("/", "/portal/", "swirl", { duration: 2500 });

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.dataset.noTransition !== undefined) return;

    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.protocol !== window.location.protocol) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

    const rule = anchor.dataset.transition
      ? { transition: anchor.dataset.transition, options: {} }
      : findRoute(cleanPath(window.location.href), cleanPath(destination.href));
    if (!rule) return;

    event.preventDefault();
    api.navigate(destination.href, rule.transition, rule.options);
  });

  const receiveHandoff = async () => {
    let handoff;
    try {
      handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY));
    } catch (_) {
      sessionStorage.removeItem(HANDOFF_KEY);
      return;
    }

    if (!handoff) return;
    sessionStorage.removeItem(HANDOFF_KEY);
    if (Date.now() - handoff.createdAt > HANDOFF_MAX_AGE) return;
    if (cleanPath(window.location.href) !== cleanPath(handoff.to)) return;

    const definition = transitions.get(handoff.transition);
    if (definition) await definition.in(handoff.options || {}, handoff);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", receiveHandoff, { once: true });
  } else {
    receiveHandoff();
  }
})();
