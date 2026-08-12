/*
 * THE INTERNET IS DEAD — shared route transition engine
 * One redirect = one transition. No stacked outgoing/incoming replays.
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
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const nativeNavigation = !window.frameElement && "onpageswap" in window && "onpagereveal" in window;
  let leaving = false;

  const cleanPath = value => {
    const url = new URL(value, window.location.href);
    let path = url.pathname.replace(/\/index\.html$/i, "/");
    if (path.length > 1 && !path.endsWith("/")) path += "/";
    return path;
  };

  const forcedTransition = (from, to) => {
    if (from === "/" && to === "/portal/") return "slide-up";
    if (from === "/portal/" && to === "/") return "slide-down";
    return null;
  };

  const routeMatches = (pattern, path) => {
    if (pattern === "*") return true;
    if (pattern instanceof RegExp) return pattern.test(path);
    return cleanPath(pattern) === path;
  };

  const findRoute = (from, to) => {
    for (let i = routes.length - 1; i >= 0; i -= 1) {
      const rule = routes[i];
      if (routeMatches(rule.from, from) && routeMatches(rule.to, to)) return rule;
    }
    return null;
  };

  const readPreference = () => {
    try {
      const saved = localStorage.getItem(DEFAULT_TRANSITION_KEY) ?? localStorage.getItem(LEGACY_DEFAULT_TRANSITION_KEY);
      if (saved === null || saved === "arrow-keys") return null;
      return saved;
    } catch (_) {
      return null;
    }
  };

  const resolveTransition = (from, to, requested, options = {}) => {
    const forced = forcedTransition(from, to);
    if (forced) return { transition: forced, options: {} };
    if (options.overrideDefault === true && requested) return { transition: requested, options };
    const route = findRoute(from, to);
    if (route?.options?.overrideDefault === true) return route;
    const preference = readPreference();
    if (preference && transitions.has(preference)) return { transition: preference, options: {} };
    if (requested && transitions.has(requested)) return { transition: requested, options };
    return route || null;
  };

  const writeHandoff = handoff => {
    try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff)); } catch (_) {}
  };

  const readHandoff = ({ consume = false } = {}) => {
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      if (consume) sessionStorage.removeItem(HANDOFF_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      try { sessionStorage.removeItem(HANDOFF_KEY); } catch (_) {}
      return null;
    }
  };

  const incoming = readHandoff();
  if (incoming?.transition && Date.now() - incoming.createdAt <= HANDOFF_MAX_AGE) {
    document.documentElement.dataset.deadTransition = incoming.transition;
  }

  const installNativeStyles = () => {
    if (document.getElementById("dead-native-transition-styles")) return;
    const style = document.createElement("style");
    style.id = "dead-native-transition-styles";
    style.textContent = `
      @view-transition { navigation: auto; }
      ::view-transition-group(root) {
        background:#000;
        animation-duration:1050ms;
        animation-timing-function:cubic-bezier(.65,0,.35,1);
      }
      ::view-transition-image-pair(root) { isolation:isolate; }
      ::view-transition-old(root),::view-transition-new(root) {
        animation-duration:1050ms;
        animation-timing-function:cubic-bezier(.65,0,.35,1);
        animation-fill-mode:both;
        backface-visibility:hidden;
      }
      html[data-dead-transition="slide-up"]::view-transition-old(root){animation-name:dead-slide-up-out}
      html[data-dead-transition="slide-up"]::view-transition-new(root){animation-name:dead-slide-up-in}
      html[data-dead-transition="slide-down"]::view-transition-old(root){animation-name:dead-slide-down-out}
      html[data-dead-transition="slide-down"]::view-transition-new(root){animation-name:dead-slide-down-in}
      html[data-dead-transition="slide-left"]::view-transition-old(root){animation-name:dead-slide-left-out}
      html[data-dead-transition="slide-left"]::view-transition-new(root){animation-name:dead-slide-left-in}
      html[data-dead-transition="slide-right"]::view-transition-old(root){animation-name:dead-slide-right-out}
      html[data-dead-transition="slide-right"]::view-transition-new(root){animation-name:dead-slide-right-in}
      html[data-dead-transition="slide-up-left"]::view-transition-old(root){animation-name:dead-slide-up-left-out}
      html[data-dead-transition="slide-up-left"]::view-transition-new(root){animation-name:dead-slide-up-left-in}
      html[data-dead-transition="slide-up-right"]::view-transition-old(root){animation-name:dead-slide-up-right-out}
      html[data-dead-transition="slide-up-right"]::view-transition-new(root){animation-name:dead-slide-up-right-in}
      html[data-dead-transition="slide-down-left"]::view-transition-old(root){animation-name:dead-slide-down-left-out}
      html[data-dead-transition="slide-down-left"]::view-transition-new(root){animation-name:dead-slide-down-left-in}
      html[data-dead-transition="slide-down-right"]::view-transition-old(root){animation-name:dead-slide-down-right-out}
      html[data-dead-transition="slide-down-right"]::view-transition-new(root){animation-name:dead-slide-down-right-in}
      html[data-dead-transition="swirl"]::view-transition-old(root){animation:dead-swirl-out 1050ms cubic-bezier(.65,0,.35,1) both}
      html[data-dead-transition="swirl"]::view-transition-new(root){animation:dead-swirl-in 1050ms cubic-bezier(.65,0,.35,1) both}
      html[data-dead-transition="crt-collapse"]::view-transition-old(root){animation:dead-crt-out 900ms cubic-bezier(.65,0,.35,1) both}
      html[data-dead-transition="crt-collapse"]::view-transition-new(root){animation:dead-crt-in 900ms cubic-bezier(.65,0,.35,1) both}
      html[data-dead-transition="void-iris"]::view-transition-old(root){animation:dead-iris-out 950ms ease both}
      html[data-dead-transition="void-iris"]::view-transition-new(root){animation:dead-iris-in 950ms ease both}
      html[data-dead-transition="glitch-disintegrate"]::view-transition-old(root){animation:dead-glitch-out 900ms steps(8,end) both}
      html[data-dead-transition="glitch-disintegrate"]::view-transition-new(root){animation:dead-glitch-in 900ms steps(8,end) both}
      @keyframes dead-slide-up-out{to{transform:translate3d(0,-100%,0)}}
      @keyframes dead-slide-up-in{from{transform:translate3d(0,100%,0)}}
      @keyframes dead-slide-down-out{to{transform:translate3d(0,100%,0)}}
      @keyframes dead-slide-down-in{from{transform:translate3d(0,-100%,0)}}
      @keyframes dead-slide-left-out{to{transform:translate3d(-100%,0,0)}}
      @keyframes dead-slide-left-in{from{transform:translate3d(100%,0,0)}}
      @keyframes dead-slide-right-out{to{transform:translate3d(100%,0,0)}}
      @keyframes dead-slide-right-in{from{transform:translate3d(-100%,0,0)}}
      @keyframes dead-slide-up-left-out{to{transform:translate3d(-100%,-100%,0)}}
      @keyframes dead-slide-up-left-in{from{transform:translate3d(100%,100%,0)}}
      @keyframes dead-slide-up-right-out{to{transform:translate3d(100%,-100%,0)}}
      @keyframes dead-slide-up-right-in{from{transform:translate3d(-100%,100%,0)}}
      @keyframes dead-slide-down-left-out{to{transform:translate3d(-100%,100%,0)}}
      @keyframes dead-slide-down-left-in{from{transform:translate3d(100%,-100%,0)}}
      @keyframes dead-slide-down-right-out{to{transform:translate3d(100%,100%,0)}}
      @keyframes dead-slide-down-right-in{from{transform:translate3d(-100%,-100%,0)}}
      @keyframes dead-swirl-out{to{transform:rotate(720deg) scale(.02);opacity:0}}
      @keyframes dead-swirl-in{from{transform:rotate(-720deg) scale(.02);opacity:0}}
      @keyframes dead-crt-out{0%{transform:scale(1)}70%{transform:scale(1,.01)}100%{transform:scale(0,.01);opacity:0}}
      @keyframes dead-crt-in{0%{transform:scale(0,.01);opacity:0}30%{transform:scale(1,.01)}100%{transform:scale(1)}}
      @keyframes dead-iris-out{to{clip-path:circle(0 at 50% 50%);opacity:.2}}
      @keyframes dead-iris-in{from{clip-path:circle(0 at 50% 50%);opacity:.2}}
      @keyframes dead-glitch-out{0%{transform:none;opacity:1}50%{transform:translateX(20px) skewX(8deg);opacity:.6}100%{transform:translateX(-50px) scaleX(1.1);opacity:0}}
      @keyframes dead-glitch-in{0%{transform:translateX(50px) scaleX(1.1);opacity:0}50%{transform:translateX(-20px) skewX(-8deg);opacity:.6}100%{transform:none;opacity:1}}
      @media(prefers-reduced-motion:reduce){
        ::view-transition-old(root){animation:dead-fade-out 120ms linear both!important}
        ::view-transition-new(root){animation:dead-fade-in 120ms linear both!important}
        @keyframes dead-fade-out{to{opacity:0}}
        @keyframes dead-fade-in{from{opacity:0}}
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  installNativeStyles();

  const slideVector = effect => ({
    "slide-up": [0, -100],
    "slide-down": [0, 100],
    "slide-left": [-100, 0],
    "slide-right": [100, 0],
    "slide-up-left": [-100, -100],
    "slide-up-right": [100, -100],
    "slide-down-left": [-100, 100],
    "slide-down-right": [100, 100]
  })[effect] || null;

  const animateOutgoingOnce = async (effect, options = {}) => {
    const root = options.element ? document.querySelector(options.element) : document.querySelector("[data-transition-root]") || document.body;
    if (!root?.animate) return;
    const duration = reducedMotion ? 120 : Math.max(180, Math.min(1400, Number(options.duration) || 850));
    const timing = { duration, easing: reducedMotion ? "linear" : "cubic-bezier(.65,0,.35,1)", fill: "both" };
    let frames;
    const vector = slideVector(effect);
    if (reducedMotion) frames = [{ opacity: 1 }, { opacity: 0 }];
    else if (vector) frames = [{ transform: "translate3d(0,0,0)" }, { transform: `translate3d(${vector[0]}%,${vector[1]}%,0)` }];
    else if (effect === "swirl") frames = [{ transform: "rotate(0) scale(1)", opacity: 1 }, { transform: "rotate(720deg) scale(.02)", opacity: 0 }];
    else if (effect === "crt-collapse") frames = [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1,.01)", opacity: 1, offset: .7 }, { transform: "scale(0,.01)", opacity: 0 }];
    else if (effect === "void-iris") frames = [{ clipPath: "circle(150% at 50% 50%)", opacity: 1 }, { clipPath: "circle(0 at 50% 50%)", opacity: .2 }];
    else frames = [{ opacity: 1 }, { opacity: 0 }];
    document.body.style.pointerEvents = "none";
    const animation = root.animate(frames, timing);
    await animation.finished.catch(() => {});
  };

  const registerBuiltIn = name => {
    transitions.set(name, {
      out: options => animateOutgoingOnce(name, options),
      in: async () => {},
      skipIncoming: true
    });
  };

  ["swirl", "glitch-disintegrate", "void-iris", "crt-collapse", "slide-up", "slide-up-right", "slide-right", "slide-down-right", "slide-down", "slide-down-left", "slide-left", "slide-up-left"].forEach(registerBuiltIn);

  const canUseNative = (from, to) => nativeNavigation && NATIVE_PATHS.has(from) && NATIVE_PATHS.has(to);

  const api = {
    register(name, definition) {
      if (!name || !definition) throw new TypeError("Transition name and definition are required.");
      transitions.set(name, definition);
      return api;
    },
    route(from, to, transition, options = {}) {
      routes.push({ from, to, transition, options });
      return api;
    },
    removeRoute(from, to) {
      for (let i = routes.length - 1; i >= 0; i -= 1) if (routes[i].from === from && routes[i].to === to) routes.splice(i, 1);
      return api;
    },
    get(from, to) { return findRoute(cleanPath(from), cleanPath(to)); },
    getDefault() { const value = readPreference(); return value && transitions.has(value) ? value : null; },
    getPreference() { return readPreference(); },
    setDefault(transition) {
      const value = transition || "";
      if (value && !transitions.has(value)) throw new TypeError(`Unknown transition: ${value}`);
      try { localStorage.setItem(DEFAULT_TRANSITION_KEY, value); } catch (_) {}
      return api;
    },
    async navigate(destination, transitionName, options = {}) {
      if (leaving) return;
      const url = new URL(destination, window.location.href);
      const from = cleanPath(window.location.href);
      const to = cleanPath(url.href);
      const rule = resolveTransition(from, to, transitionName, options);
      if (!rule || !transitions.has(rule.transition)) {
        leaving = true;
        location.assign(url.href);
        return;
      }

      leaving = true;
      const effect = rule.transition;
      const definition = transitions.get(effect);
      const settings = { ...(rule.options || {}), ...(options || {}) };
      delete settings.overrideDefault;
      const useNative = canUseNative(from, to);
      const handoff = { from, to, transition: effect, native: useNative, skipIncoming: true, createdAt: Date.now() };
      document.documentElement.dataset.deadTransition = effect;
      writeHandoff(handoff);

      if (useNative) {
        location.assign(url.href);
        return;
      }

      try {
        if (typeof definition.out === "function") await definition.out(settings, { from, to, url });
      } finally {
        location.assign(url.href);
      }
    },
    profile: Object.freeze({ nativeNavigation, reducedMotion, singleDispatch: true }),
    transitions,
    routes
  };

  window.PageTransitions = api;

  document.addEventListener("click", event => {
    if (event.defaultPrevented || leaving || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const launcher = event.target.closest("[data-transition-destination]");
    if (launcher) {
      const selector = document.getElementById(launcher.dataset.transitionSelect);
      const transition = selector?.value || undefined;
      if (!transition) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      api.navigate(launcher.dataset.transitionDestination, transition);
      return;
    }

    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.dataset.noTransition !== undefined) return;
    const destination = new URL(anchor.href, location.href);
    if (destination.origin !== location.origin || destination.protocol !== location.protocol) return;
    if (cleanPath(destination.href) === cleanPath(location.href) && destination.search === location.search) return;

    const rule = resolveTransition(cleanPath(location.href), cleanPath(destination.href), anchor.dataset.transitionOverride || anchor.dataset.transition, { overrideDefault: Boolean(anchor.dataset.transitionOverride) });
    if (!rule) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    api.navigate(destination.href, rule.transition, rule.options || {});
  }, true);

  const receiveHandoff = () => {
    if (window.frameElement) return;
    const handoff = readHandoff({ consume: true });
    if (!handoff || Date.now() - handoff.createdAt > HANDOFF_MAX_AGE) return;
    if (cleanPath(location.href) !== cleanPath(handoff.to)) return;
    // Native cross-document View Transition already animates old + new snapshots together.
    // Fallback redirects animate only the outgoing page. Never replay an incoming animation.
    window.setTimeout(() => delete document.documentElement.dataset.deadTransition, handoff.native ? 1400 : 0);
  };

  window.addEventListener("pageshow", event => {
    leaving = false;
    document.body.style.removeProperty("pointer-events");
    if (event.persisted) delete document.documentElement.dataset.deadTransition;
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", receiveHandoff, { once: true });
  else receiveHandoff();
})();
