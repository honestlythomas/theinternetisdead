/*
 * THE INTERNET IS DEAD — shared route transition engine
 *
 * Performance rules:
 * - no cloned page trees
 * - no transition-time fetches or hidden destination iframes
 * - at most one page animation plus two fixed signal layers
 * - transform/opacity first, short bounded durations, reduced-motion fallback
 * - native cross-document snapshots between the main navigation hubs when available
 *
 * Precedence: explicit override > saved splash preference > legacy link/route value.
 */
(() => {
  "use strict";

  const HANDOFF_KEY = "theinternetisdead:page-transition";
  const HANDOFF_MAX_AGE = 30000;
  const DEFAULT_TRANSITION_KEY = "theinternetisdead:page-transition:default";
  const LEGACY_DEFAULT_TRANSITION_KEY = "theinternetisdead:index:portal-transition";
  const NATIVE_PATHS = new Set(["/", "/portal/", "/dead/games/", "/dead/experiments/"]);
  const transitions = new Map();
  const routes = [];
  const activeAnimations = new Set();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const nativeNavigation = !window.frameElement && "onpageswap" in window && "onpagereveal" in window;
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

  const readTransitionPreference = () => {
    try {
      const saved = window.localStorage.getItem(DEFAULT_TRANSITION_KEY)
        ?? window.localStorage.getItem(LEGACY_DEFAULT_TRANSITION_KEY);
      if (saved === null) return null;
      return saved === "arrow-keys" ? "" : saved;
    } catch (_) {
      return null;
    }
  };

  const resolveRule = (from, to, requestedTransition, options = {}) => {
    if (from === "/" && to === "/portal/") {
      return { transition: "slide-up", options: { ...options, overrideDefault: true } };
    }
    if (from === "/portal/" && to === "/") {
      return { transition: "slide-down", options: { ...options, overrideDefault: true } };
    }

    const route = findRoute(from, to);
    if (options.overrideDefault === true && requestedTransition) {
      return { transition: requestedTransition, options };
    }
    if (route?.options?.overrideDefault === true) return route;

    const preference = readTransitionPreference();
    if (preference !== null) {
      return preference && transitions.has(preference)
        ? { transition: preference, options: {} }
        : null;
    }

    if (requestedTransition) return { transition: requestedTransition, options };
    return route;
  };

  const readHandoff = ({ consume = false } = {}) => {
    let handoff = null;
    try {
      handoff = JSON.parse(window.sessionStorage.getItem(HANDOFF_KEY));
      if (consume) window.sessionStorage.removeItem(HANDOFF_KEY);
    } catch (_) {
      try { window.sessionStorage.removeItem(HANDOFF_KEY); } catch (_) {}
    }
    return handoff;
  };

  const writeHandoff = handoff => {
    try { window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff)); } catch (_) {}
  };

  const incomingHandoff = readHandoff();
  if (incomingHandoff?.transition && Date.now() - incomingHandoff.createdAt <= HANDOFF_MAX_AGE) {
    document.documentElement.dataset.deadTransition = incomingHandoff.transition;
  }

  const installNativeStyles = () => {
    if (document.getElementById("dead-native-transition-styles")) return;
    const style = document.createElement("style");
    style.id = "dead-native-transition-styles";
    style.textContent = `
      @view-transition { navigation: auto; }
      ::view-transition-group(root) { background: #000; animation-duration: 1250ms; animation-timing-function: cubic-bezier(.65,0,.35,1); }
      ::view-transition-image-pair(root) { isolation: isolate; }
      ::view-transition-old(root), ::view-transition-new(root) { backface-visibility: hidden; box-shadow: 0 0 0 1px rgba(114,255,25,.55), 0 0 28px rgba(255,43,214,.2); animation-duration: 1150ms; animation-timing-function: cubic-bezier(.65,0,.35,1); animation-fill-mode: both; }
      html[data-dead-transition="swirl"]::view-transition-old(root) { animation: dead-swirl-out 1250ms cubic-bezier(.65,0,.35,1) both; }
      html[data-dead-transition="swirl"]::view-transition-new(root) { animation: dead-swirl-in 1250ms cubic-bezier(.65,0,.35,1) both; }
      html[data-dead-transition="glitch-disintegrate"]::view-transition-old(root) { animation: dead-glitch-out 1050ms steps(10,end) both; }
      html[data-dead-transition="glitch-disintegrate"]::view-transition-new(root) { animation: dead-glitch-in 1050ms steps(10,end) both; }
      html[data-dead-transition="void-iris"]::view-transition-old(root) { animation-name: dead-iris-out; }
      html[data-dead-transition="void-iris"]::view-transition-new(root) { animation-name: dead-iris-in; }
      html[data-dead-transition="crt-collapse"]::view-transition-old(root) { animation: dead-crt-out 1000ms cubic-bezier(.65,0,.35,1) both; }
      html[data-dead-transition="crt-collapse"]::view-transition-new(root) { animation: dead-crt-in 1000ms cubic-bezier(.65,0,.35,1) both; }
      html[data-dead-transition="slide-up"]::view-transition-old(root) { animation-name: dead-slide-up-out; }
      html[data-dead-transition="slide-up"]::view-transition-new(root) { animation-name: dead-slide-up-in; }
      html[data-dead-transition="slide-down"]::view-transition-old(root) { animation-name: dead-slide-down-out; }
      html[data-dead-transition="slide-down"]::view-transition-new(root) { animation-name: dead-slide-down-in; }
      html[data-dead-transition="slide-left"]::view-transition-old(root) { animation-name: dead-slide-left-out; }
      html[data-dead-transition="slide-left"]::view-transition-new(root) { animation-name: dead-slide-left-in; }
      html[data-dead-transition="slide-right"]::view-transition-old(root) { animation-name: dead-slide-right-out; }
      html[data-dead-transition="slide-right"]::view-transition-new(root) { animation-name: dead-slide-right-in; }
      html[data-dead-transition="slide-up-left"]::view-transition-old(root) { animation-name: dead-slide-up-left-out; }
      html[data-dead-transition="slide-up-left"]::view-transition-new(root) { animation-name: dead-slide-up-left-in; }
      html[data-dead-transition="slide-up-right"]::view-transition-old(root) { animation-name: dead-slide-up-right-out; }
      html[data-dead-transition="slide-up-right"]::view-transition-new(root) { animation-name: dead-slide-up-right-in; }
      html[data-dead-transition="slide-down-left"]::view-transition-old(root) { animation-name: dead-slide-down-left-out; }
      html[data-dead-transition="slide-down-left"]::view-transition-new(root) { animation-name: dead-slide-down-left-in; }
      html[data-dead-transition="slide-down-right"]::view-transition-old(root) { animation-name: dead-slide-down-right-out; }
      html[data-dead-transition="slide-down-right"]::view-transition-new(root) { animation-name: dead-slide-down-right-in; }
      html[data-dead-transition^="slide-"]::view-transition-old(root), html[data-dead-transition^="slide-"]::view-transition-new(root) { animation-duration: 1050ms; }
      @keyframes dead-swirl-out { to { transform: translateY(10vh) rotate(720deg) scale(.025); opacity: 0; } }
      @keyframes dead-swirl-in { from { transform: translateY(10vh) rotate(-720deg) scale(.025); opacity: 0; } }
      @keyframes dead-glitch-out { 0% { transform: translate3d(0,0,0); clip-path: inset(0); opacity: 1; } 28% { transform: translate3d(-10px,2px,0) skewX(2deg); clip-path: inset(8% 0 12%); } 55% { transform: translate3d(14px,-3px,0) skewX(-4deg); clip-path: inset(24% 0 18%); } 78% { transform: translate3d(-24px,4px,0) skewX(8deg); clip-path: inset(42% 0 38%); opacity: .6; } 100% { transform: translate3d(42px,0,0) scaleX(1.08); clip-path: inset(49% 0); opacity: 0; } }
      @keyframes dead-glitch-in { 0% { transform: translate3d(-42px,0,0) scaleX(1.08); clip-path: inset(49% 0); opacity: 0; } 45% { transform: translate3d(14px,-3px,0) skewX(-4deg); clip-path: inset(24% 0 18%); opacity: .7; } 100% { transform: translate3d(0,0,0); clip-path: inset(0); opacity: 1; } }
      @keyframes dead-iris-out { to { clip-path: circle(0 at 50% 50%); transform: scale(.985); opacity: .2; } }
      @keyframes dead-iris-in { from { clip-path: circle(0 at 50% 50%); transform: scale(.985); opacity: .2; } }
      @keyframes dead-crt-out { 0% { transform: scale(1); opacity: 1; } 72% { transform: scale(1,.008); opacity: 1; } 100% { transform: scale(0,.008); opacity: 0; } }
      @keyframes dead-crt-in { 0% { transform: scale(0,.008); opacity: 0; } 28% { transform: scale(1,.008); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      @keyframes dead-slide-up-out { to { transform: translate3d(0,-100%,0); } }
      @keyframes dead-slide-up-in { from { transform: translate3d(0,100%,0); } }
      @keyframes dead-slide-down-out { to { transform: translate3d(0,100%,0); } }
      @keyframes dead-slide-down-in { from { transform: translate3d(0,-100%,0); } }
      @keyframes dead-slide-left-out { to { transform: translate3d(-100%,0,0); } }
      @keyframes dead-slide-left-in { from { transform: translate3d(100%,0,0); } }
      @keyframes dead-slide-right-out { to { transform: translate3d(100%,0,0); } }
      @keyframes dead-slide-right-in { from { transform: translate3d(-100%,0,0); } }
      @keyframes dead-slide-up-left-out { to { transform: translate3d(-100%,-100%,0); } }
      @keyframes dead-slide-up-left-in { from { transform: translate3d(100%,100%,0); } }
      @keyframes dead-slide-up-right-out { to { transform: translate3d(100%,-100%,0); } }
      @keyframes dead-slide-up-right-in { from { transform: translate3d(-100%,100%,0); } }
      @keyframes dead-slide-down-left-out { to { transform: translate3d(-100%,100%,0); } }
      @keyframes dead-slide-down-left-in { from { transform: translate3d(100%,-100%,0); } }
      @keyframes dead-slide-down-right-out { to { transform: translate3d(100%,100%,0); } }
      @keyframes dead-slide-down-right-in { from { transform: translate3d(-100%,-100%,0); } }
      @media (prefers-reduced-motion: reduce) { ::view-transition-old(root) { animation: dead-fade-out 180ms linear both !important; } ::view-transition-new(root) { animation: dead-fade-in 180ms linear both !important; } @keyframes dead-fade-out { to { opacity: 0; } } @keyframes dead-fade-in { from { opacity: 0; } } }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  installNativeStyles();

  const waitFor = animation => new Promise(resolve => {
    animation.addEventListener("finish", resolve, { once: true });
    animation.addEventListener("cancel", resolve, { once: true });
  });

  const trackAnimation = animation => {
    activeAnimations.add(animation);
    const release = () => activeAnimations.delete(animation);
    animation.addEventListener("finish", release, { once: true });
    animation.addEventListener("cancel", release, { once: true });
    return animation;
  };

  const transitionRoot = options => options.element
    ? document.querySelector(options.element)
    : document.querySelector("[data-transition-root]") || document.body.firstElementChild || document.body;

  const lockPage = root => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.pointerEvents = "none";
    root.style.transformOrigin = "50% 50%";
    root.style.willChange = "transform, opacity, clip-path";
  };

  const unlockPage = root => {
    root.style.removeProperty("transform-origin");
    root.style.removeProperty("will-change");
    document.body.style.removeProperty("pointer-events");
    document.documentElement.style.removeProperty("overflow");
  };

  const cleanup = root => {
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
    document.querySelectorAll("[data-page-transition-overlay]").forEach(overlay => overlay.remove());
    if (root) unlockPage(root);
  };

  const makeSignalOverlay = effect => {
    const overlay = document.createElement("div");
    overlay.dataset.pageTransitionOverlay = "";
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "2147483647", overflow: "hidden", contain: "strict", pointerEvents: "none", background: "transparent", transform: "translateZ(0)" });
    const field = document.createElement("div");
    Object.assign(field.style, { position: "absolute", inset: "-24%", background: effect.startsWith("slide-") ? "linear-gradient(90deg, transparent 34%, rgba(114,255,25,.16) 48%, rgba(255,43,214,.3) 50%, rgba(0,225,255,.18) 52%, transparent 66%)" : "radial-gradient(circle at 50% 50%, rgba(0,0,0,.9) 0 5%, transparent 24%), conic-gradient(from 0deg, rgba(114,255,25,.18), transparent 18%, rgba(255,43,214,.28), transparent 52%, rgba(0,225,255,.2), transparent 82%, rgba(114,255,25,.18))", opacity: "0", transformOrigin: "50% 50%", willChange: "transform, opacity", mixBlendMode: "screen" });
    const scan = document.createElement("div");
    Object.assign(scan.style, { position: "absolute", inset: "0", background: "repeating-linear-gradient(0deg, transparent 0 4px, rgba(114,255,25,.11) 4px 5px, transparent 5px 8px), linear-gradient(90deg, rgba(255,43,214,.08), transparent 40%, rgba(0,225,255,.08))", opacity: "0", willChange: "transform, opacity" });
    overlay.append(field, scan);
    document.body.appendChild(overlay);
    return { overlay, field, scan };
  };

  const reverseFrames = frames => frames.map(frame => { const copy = { ...frame }; delete copy.offset; return copy; }).reverse();

  const signalFrames = (effect, outgoing) => {
    let field;
    if (effect === "swirl") field = [{ transform: "rotate(0deg) scale(.65)", opacity: .08 }, { transform: "rotate(320deg) scale(1.35)", opacity: .52 }];
    else if (effect === "glitch-disintegrate") field = [{ transform: "translate3d(-8%,0,0) scale(1)", opacity: .08 }, { transform: "translate3d(8%,0,0) scale(1.15)", opacity: .58 }];
    else if (effect === "void-iris") field = [{ transform: "scale(.35)", opacity: .05 }, { transform: "scale(2.2)", opacity: .58 }];
    else if (effect === "crt-collapse") field = [{ transform: "scale(1,1)", opacity: .08 }, { transform: "scale(1,.012)", opacity: .72 }];
    else {
      const verticalSign = effect.includes("up") ? -1 : effect.includes("down") ? 1 : 0;
      const horizontalSign = effect.includes("left") ? -1 : effect.includes("right") ? 1 : 0;
      field = [{ transform: `translate3d(${-horizontalSign * 60}%,${-verticalSign * 60}%,0)`, opacity: .08 }, { transform: `translate3d(${horizontalSign * 60}%,${verticalSign * 60}%,0)`, opacity: .48 }];
    }
    const scan = [{ transform: "translate3d(0,-8px,0)", opacity: .08 }, { transform: "translate3d(0,8px,0)", opacity: .38 }];
    return outgoing ? { field, scan } : { field: reverseFrames(field), scan: reverseFrames(scan) };
  };

  const rootFrames = (effect, outgoing) => {
    const slideVectors = {
      "slide-up": ["0", "-100%", "0", "100%"],
      "slide-up-left": ["-100%", "-100%", "100%", "100%"],
      "slide-up-right": ["100%", "-100%", "-100%", "100%"],
      "slide-down": ["0", "100%", "0", "-100%"],
      "slide-down-left": ["-100%", "100%", "100%", "-100%"],
      "slide-down-right": ["100%", "100%", "-100%", "-100%"],
      "slide-left": ["-100%", "0", "100%", "0"],
      "slide-right": ["100%", "0", "-100%", "0"]
    };
    if (slideVectors[effect]) {
      const [outX, outY, inX, inY] = slideVectors[effect];
      return outgoing ? [{ transform: "translate3d(0,0,0)", opacity: 1 }, { transform: `translate3d(${outX},${outY},0)`, opacity: 1 }] : [{ transform: `translate3d(${inX},${inY},0)`, opacity: 1 }, { transform: "translate3d(0,0,0)", opacity: 1 }];
    }
    if (effect === "swirl") return outgoing ? [{ transform: "translate3d(0,0,0) rotate(0deg) scale(1)", opacity: 1 }, { transform: "translate3d(0,2vh,0) rotate(42deg) scale(.9)", opacity: 1, offset: .28 }, { transform: "translate3d(0,10vh,0) rotate(720deg) scale(.025)", opacity: 0 }] : [{ transform: "translate3d(0,10vh,0) rotate(-720deg) scale(.025)", opacity: 0 }, { transform: "translate3d(0,2vh,0) rotate(-42deg) scale(.9)", opacity: 1, offset: .72 }, { transform: "translate3d(0,0,0) rotate(0deg) scale(1)", opacity: 1 }];
    if (effect === "glitch-disintegrate") return outgoing ? [{ transform: "translate3d(0,0,0)", clipPath: "inset(0)", opacity: 1 }, { transform: "translate3d(-10px,2px,0) skewX(2deg)", clipPath: "inset(8% 0 12%)", opacity: .95, offset: .28 }, { transform: "translate3d(14px,-3px,0) skewX(-4deg)", clipPath: "inset(24% 0 18%)", opacity: .8, offset: .55 }, { transform: "translate3d(-24px,4px,0) skewX(8deg)", clipPath: "inset(42% 0 38%)", opacity: .55, offset: .78 }, { transform: "translate3d(42px,0,0) scaleX(1.08)", clipPath: "inset(49% 0)", opacity: 0 }] : [{ transform: "translate3d(-42px,0,0) scaleX(1.08)", clipPath: "inset(49% 0)", opacity: 0 }, { transform: "translate3d(14px,-3px,0) skewX(-4deg)", clipPath: "inset(24% 0 18%)", opacity: .72, offset: .45 }, { transform: "translate3d(0,0,0)", clipPath: "inset(0)", opacity: 1 }];
    if (effect === "void-iris") return outgoing ? [{ clipPath: "circle(150% at 50% 50%)", transform: "scale(1)", opacity: 1 }, { clipPath: "circle(0 at 50% 50%)", transform: "scale(.985)", opacity: .2 }] : [{ clipPath: "circle(0 at 50% 50%)", transform: "scale(.985)", opacity: .2 }, { clipPath: "circle(150% at 50% 50%)", transform: "scale(1)", opacity: 1 }];
    return outgoing ? [{ transform: "scale(1,1)", opacity: 1 }, { transform: "scale(1,.008)", opacity: 1, offset: .72 }, { transform: "scale(0,.008)", opacity: 0 }] : [{ transform: "scale(0,.008)", opacity: 0 }, { transform: "scale(1,.008)", opacity: 1, offset: .28 }, { transform: "scale(1,1)", opacity: 1 }];
  };

  const effectTiming = effect => ({ duration: effect === "swirl" ? 1250 : effect === "glitch-disintegrate" ? 1050 : effect.startsWith("slide-") ? 1050 : effect === "crt-collapse" ? 1000 : 1150, easing: effect === "glitch-disintegrate" ? "steps(10,end)" : "cubic-bezier(.65,0,.35,1)" });

  const playEffect = async (effect, phase, options = {}) => {
    const outgoing = phase === "out";
    const root = transitionRoot(options);
    const baseTiming = effectTiming(effect);
    const duration = reducedMotion ? 180 : Math.max(180, Math.min(1800, options.duration ?? baseTiming.duration));
    const easing = reducedMotion ? "linear" : options.easing || baseTiming.easing;
    lockPage(root);
    if (reducedMotion) {
      const animation = trackAnimation(root.animate(outgoing ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], { duration, easing, fill: "both" }));
      await waitFor(animation);
      if (!outgoing) cleanup(root);
      return;
    }
    const { field, scan } = makeSignalOverlay(effect);
    const signal = signalFrames(effect, outgoing);
    const timing = { duration, easing, fill: "both" };
    const animations = [trackAnimation(root.animate(rootFrames(effect, outgoing), timing)), trackAnimation(field.animate(signal.field, timing)), trackAnimation(scan.animate(signal.scan, { ...timing, easing: effect === "glitch-disintegrate" ? "steps(8,end)" : "linear" }))];
    await Promise.all(animations.map(waitFor));
    if (!outgoing) cleanup(root);
  };

  const canUseNativeNavigation = (from, to) => nativeNavigation && NATIVE_PATHS.has(from) && NATIVE_PATHS.has(to);

  const api = {
    register(name, definition) {
      if (!name || !definition || typeof definition.out !== "function" || typeof definition.in !== "function") throw new TypeError("A transition needs a name plus in() and out() functions.");
      transitions.set(name, definition);
      return api;
    },
    route(from, to, transition, options = {}) { routes.push({ from, to, transition, options }); return api; },
    removeRoute(from, to) { for (let index = routes.length - 1; index >= 0; index -= 1) if (routes[index].from === from && routes[index].to === to) routes.splice(index, 1); return api; },
    get(from, to) { return findRoute(cleanPath(from), cleanPath(to)); },
    getDefault() { const preference = readTransitionPreference(); return preference && transitions.has(preference) ? preference : null; },
    getPreference() { return readTransitionPreference(); },
    setDefault(transition) { const value = transition || ""; if (value && !transitions.has(value)) throw new TypeError(`Unknown transition: ${value}`); try { window.localStorage.setItem(DEFAULT_TRANSITION_KEY, value); } catch (_) {} return api; },
    async navigate(destination, transitionName, options = {}) {
      if (leaving) return;
      const url = new URL(destination, window.location.href);
      const from = cleanPath(window.location.href);
      const to = cleanPath(url.href);
      const rule = resolveRule(from, to, transitionName, options);
      if (!rule || !transitions.has(rule.transition)) { window.location.assign(url.href); return; }
      leaving = true;
      const definition = transitions.get(rule.transition);
      const settings = { ...rule.options, ...options };
      delete settings.overrideDefault;
      const useNative = canUseNativeNavigation(from, to);
      const handoff = { from, to, transition: rule.transition, options: settings, native: useNative, skipIncoming: definition.skipIncoming === true, createdAt: Date.now() };
      document.documentElement.dataset.deadTransition = rule.transition;
      if (useNative) { writeHandoff(handoff); window.location.assign(url.href); return; }
      try { await definition.out(settings, { from, to, url }); }
      finally { writeHandoff(handoff); window.location.assign(url.href); }
    },
    profile: Object.freeze({ nativeNavigation, reducedMotion, maximumAnimatedLayers: 3, destinationFetches: 0, pageClones: 0 }), transitions, routes
  };

  window.PageTransitions = api;

  ["swirl", "glitch-disintegrate", "void-iris", "crt-collapse"].forEach(effect => api.register(effect, { out: options => playEffect(effect, "out", options), in: options => playEffect(effect, "in", options) }));
  ["up", "up-right", "right", "down-right", "down", "down-left", "left", "up-left"].forEach(direction => { const effect = `slide-${direction}`; api.register(effect, { out: options => playEffect(effect, "out", options), in: options => playEffect(effect, "in", options) }); });

  window.addEventListener("pageshow", event => { if (!event.persisted) return; leaving = false; cleanup(transitionRoot({})); delete document.documentElement.dataset.deadTransition; });
  if (nativeNavigation) window.addEventListener("pagereveal", () => { window.setTimeout(() => delete document.documentElement.dataset.deadTransition, 1800); }, { once: true });

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const launcher = event.target.closest("[data-transition-destination]");
    if (launcher) {
      const selector = document.getElementById(launcher.dataset.transitionSelect);
      const transition = selector?.value || undefined;
      if (!transition) return;
      event.preventDefault();
      api.navigate(launcher.dataset.transitionDestination, transition);
      return;
    }
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.dataset.noTransition !== undefined) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.protocol !== window.location.protocol) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    if (anchor.dataset.transitionOverride) {
      event.preventDefault();
      api.navigate(destination.href, anchor.dataset.transitionOverride, { overrideDefault: true });
      return;
    }
    const rule = resolveRule(cleanPath(window.location.href), cleanPath(destination.href), anchor.dataset.transition, {});
    if (!rule) return;
    event.preventDefault();
    api.navigate(destination.href, rule.transition, rule.options);
  });

  const receiveHandoff = async () => {
    if (window.frameElement) return;
    const handoff = readHandoff({ consume: true });
    if (!handoff) return;
    if (Date.now() - handoff.createdAt > HANDOFF_MAX_AGE) return;
    if (cleanPath(window.location.href) !== cleanPath(handoff.to)) return;
    if (handoff.native) { window.setTimeout(() => delete document.documentElement.dataset.deadTransition, 1800); return; }
    if (handoff.skipIncoming) return;
    const definition = transitions.get(handoff.transition);
    if (definition) await definition.in(handoff.options || {}, handoff);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", receiveHandoff, { once: true });
  else receiveHandoff();
})();
