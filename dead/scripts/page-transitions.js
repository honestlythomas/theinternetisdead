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
  const keyBindings = new Map();
  const heldKeys = new Set();
  const activeAnimations = new Set();
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

  const trackAnimation = animation => {
    activeAnimations.add(animation);
    animation.addEventListener("cancel", () => activeAnimations.delete(animation), { once: true });
    return animation;
  };

  const transitionRoot = options => options.element
    ? document.querySelector(options.element)
    : document.querySelector("[data-transition-root]") || document.body.firstElementChild || document.body;

  const lockPage = root => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.pointerEvents = "none";
    root.style.transformOrigin = "50% 50%";
    root.style.willChange = "transform, filter, opacity, clip-path";
  };

  const unlockPage = root => {
    root.style.removeProperty("transform-origin");
    root.style.removeProperty("will-change");
    document.body.style.removeProperty("pointer-events");
    document.documentElement.style.removeProperty("overflow");
  };

  const finishIncoming = (root, animations, extras = []) => {
    animations.forEach(animation => animation.cancel());
    extras.forEach(element => element.remove());
    unlockPage(root);
  };

  const playRootEffect = async (direction, options, outgoingFrames, incomingFrames, timing = {}) => {
    const duration = options.duration ?? timing.duration ?? 1100;
    const root = transitionRoot(options);
    const outgoing = direction === "out";
    lockPage(root);
    const animation = trackAnimation(root.animate(outgoing ? outgoingFrames : incomingFrames, {
      duration,
      easing: timing.easing || "cubic-bezier(.7,0,.3,1)",
      fill: "both"
    }));
    await waitFor(animation);
    if (!outgoing) finishIncoming(root, [animation]);
  };

  const makeOverlay = () => {
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.dataset.pageTransitionOverlay = "";
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
    const root = transitionRoot(options);
    const overlay = makeOverlay();
    const outgoing = direction === "out";
    const easing = outgoing
      ? "cubic-bezier(.72,0,.94,.56)"
      : "cubic-bezier(.08,.58,.28,1)";

    lockPage(root);

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

    const rootAnimation = trackAnimation(root.animate(rootFrames, { duration, easing, fill: "both" }));
    const overlayAnimation = trackAnimation(overlay.animate(overlayFrames, { duration, easing: outgoing ? "ease-in" : "ease-out", fill: "both" }));
    await Promise.all([waitFor(rootAnimation), waitFor(overlayAnimation)]);

    if (!outgoing) {
      finishIncoming(root, [rootAnimation, overlayAnimation], [overlay]);
    }
  };

  const playGlitch = async (direction, options = {}) => {
    const root = transitionRoot(options);
    const outgoing = direction === "out";
    const duration = options.duration ?? 1450;
    const overlay = makeOverlay();
    overlay.style.background = "repeating-linear-gradient(0deg, transparent 0 4px, rgba(66,255,25,.22) 4px 6px), linear-gradient(90deg, rgba(255,0,212,.5), transparent 35%, rgba(0,255,255,.35))";
    lockPage(root);

    const disintegrate = [
      { opacity: 1, transform: "translate(0) skewX(0deg)", filter: "none", clipPath: "inset(0 0 0 0)" },
      { opacity: .95, transform: "translate(-9px,3px) skewX(2deg)", filter: "hue-rotate(80deg) contrast(1.7)", clipPath: "inset(8% 0 13% 0)", offset: .2 },
      { opacity: .82, transform: "translate(14px,-5px) skewX(-4deg)", filter: "hue-rotate(220deg) contrast(2.2)", clipPath: "polygon(0 0,100% 0,100% 12%,0 18%,0 28%,100% 24%,100% 48%,0 56%,0 70%,100% 62%,100% 83%,0 92%)", offset: .48 },
      { opacity: .35, transform: "translate(-28px,9px) skewX(9deg) scaleX(1.08)", filter: "saturate(3) contrast(3)", clipPath: "polygon(0 7%,100% 16%,100% 23%,0 35%,0 54%,100% 48%,100% 68%,0 81%,0 93%,100% 88%)", offset: .76 },
      { opacity: 0, transform: "translate(48px,-18px) skewX(-18deg) scale(1.18,.12)", filter: "brightness(4) contrast(4)", clipPath: "inset(46% 0 47% 0)" }
    ];
    const frames = outgoing ? disintegrate : disintegrate
      .map(frame => {
        const reversed = { ...frame };
        delete reversed.offset;
        return reversed;
      })
      .reverse();
    const rootAnimation = trackAnimation(root.animate(frames, { duration, easing: "steps(8,end)", fill: "both" }));
    const flashAnimation = trackAnimation(overlay.animate(outgoing
      ? [{ opacity: 0 }, { opacity: .7, offset: .22 }, { opacity: .12, offset: .72 }, { opacity: 1 }]
      : [{ opacity: 1 }, { opacity: .15, offset: .28 }, { opacity: .65, offset: .78 }, { opacity: 0 }],
    { duration, easing: "steps(10,end)", fill: "both" }));
    await Promise.all([waitFor(rootAnimation), waitFor(flashAnimation)]);
    if (!outgoing) finishIncoming(root, [rootAnimation, flashAnimation], [overlay]);
  };

  const slideFrames = direction => {
    const vectors = {
      up: ["0", "-105vh"], down: ["0", "105vh"],
      left: ["-105vw", "0"], right: ["105vw", "0"]
    };
    const [x, y] = vectors[direction];
    const displacement = `translate3d(${x},${y},0)`;
    return {
      out: [{ transform: "translate3d(0,0,0)", opacity: 1 }, { transform: displacement, opacity: .15 }],
      in: [{ transform: displacement, opacity: .15 }, { transform: "translate3d(0,0,0)", opacity: 1 }]
    };
  };

  const playSlide = (direction, phase, options = {}) => {
    const frames = slideFrames(direction);
    return playRootEffect(phase, options, frames.out, frames.in, { duration: 850, easing: "cubic-bezier(.76,0,.24,1)" });
  };

  const playVoidIris = (direction, options = {}) => playRootEffect(direction, options,
    [{ clipPath: "circle(150% at 50% 50%)", filter: "saturate(1)" }, { clipPath: "circle(0% at 50% 50%)", filter: "saturate(2.5) brightness(.2)" }],
    [{ clipPath: "circle(0% at 50% 50%)", filter: "saturate(2.5) brightness(.2)" }, { clipPath: "circle(150% at 50% 50%)", filter: "none" }],
    { duration: 1350, easing: "cubic-bezier(.85,0,.15,1)" });

  const playCrt = (direction, options = {}) => playRootEffect(direction, options,
    [
      { transform: "scale(1,1)", opacity: 1, filter: "brightness(1)" },
      { transform: "scale(1,.008)", opacity: 1, filter: "brightness(5)", offset: .72 },
      { transform: "scale(0,.008)", opacity: 0, filter: "brightness(8)" }
    ],
    [
      { transform: "scale(0,.008)", opacity: 0, filter: "brightness(8)" },
      { transform: "scale(1,.008)", opacity: 1, filter: "brightness(5)", offset: .28 },
      { transform: "scale(1,1)", opacity: 1, filter: "none" }
    ],
    { duration: 1000, easing: "cubic-bezier(.7,0,.3,1)" });

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

    bindKey(key, transition, options = {}) {
      keyBindings.set(key, { transition, options });
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
    routes,
    keyBindings
  };

  window.PageTransitions = api;

  api.register("swirl", {
    out: options => playSwirl("out", options),
    in: options => playSwirl("in", options)
  });

  api.register("glitch-disintegrate", {
    out: options => playGlitch("out", options),
    in: options => playGlitch("in", options)
  });

  ["up", "down", "left", "right"].forEach(direction => {
    api.register(`slide-${direction}`, {
      out: options => playSlide(direction, "out", options),
      in: options => playSlide(direction, "in", options)
    });
  });

  api.register("void-iris", {
    out: options => playVoidIris("out", options),
    in: options => playVoidIris("in", options)
  });

  api.register("crt-collapse", {
    out: options => playCrt("out", options),
    in: options => playCrt("in", options)
  });

  api
    .bindKey("s", "swirl", { duration: 2500 })
    .bindKey("g", "glitch-disintegrate")
    .bindKey("ArrowUp", "slide-up")
    .bindKey("ArrowDown", "slide-down")
    .bindKey("ArrowLeft", "slide-left")
    .bindKey("ArrowRight", "slide-right")
    .bindKey("v", "void-iris")
    .bindKey("c", "crt-collapse");

  window.addEventListener("keydown", event => {
    if (!event.repeat) heldKeys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener("keyup", event => heldKeys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
  window.addEventListener("blur", () => heldKeys.clear());

  // Browsers may restore a transitioned-out page from the back/forward cache.
  // Put it back into a clean, fully visible state instead of preserving the
  // final frame of its outgoing animation.
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    leaving = false;
    heldKeys.clear();
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
    document.querySelectorAll("[data-page-transition-overlay]").forEach(overlay => overlay.remove());
    unlockPage(transitionRoot({}));
  });

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download") || anchor.dataset.noTransition !== undefined) return;

    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.protocol !== window.location.protocol) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

    const heldBinding = [...heldKeys].map(key => keyBindings.get(key)).find(Boolean);
    const rule = heldBinding || (anchor.dataset.transition
      ? { transition: anchor.dataset.transition, options: {} }
      : findRoute(cleanPath(window.location.href), cleanPath(destination.href)));
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
