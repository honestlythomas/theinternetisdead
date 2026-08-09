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
    const outgoing = direction === "out";
    lockPage(root);

    const vortex = document.createElement("div");
    vortex.setAttribute("aria-hidden", "true");
    vortex.dataset.pageTransitionOverlay = "";
    Object.assign(vortex.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      overflow: "hidden",
      pointerEvents: "none",
      background: "#000",
      perspective: "900px"
    });

    const maxRadius = Math.hypot(window.innerWidth * .5, window.innerHeight * .52);
    const ringCount = window.innerWidth < 700 ? 18 : 28;
    const ringWidth = maxRadius / ringCount;
    const animations = [];

    for (let index = ringCount - 1; index >= 0; index -= 1) {
      const inner = index * ringWidth;
      const outer = (index + 1) * ringWidth + 2;
      const depth = 1 - (inner + outer) * .5 / maxRadius;
      const clone = root.cloneNode(true);
      clone.removeAttribute("id");
      clone.removeAttribute("data-transition-root");
      clone.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
      clone.querySelectorAll("script").forEach(element => element.remove());
      Object.assign(clone.style, {
        position: "absolute",
        inset: "0",
        width: "100vw",
        height: "100dvh",
        margin: "0",
        transformOrigin: "50% 52%",
        willChange: "transform, filter, opacity",
        backfaceVisibility: "hidden"
      });

      const mask = `radial-gradient(circle at 50% 52%, transparent ${Math.max(0, inner - 1)}px, #000 ${inner}px, #000 ${outer}px, transparent ${outer + 1}px)`;
      clone.style.maskImage = mask;
      clone.style.webkitMaskImage = mask;
      vortex.appendChild(clone);

      const finalTurn = 510 + depth * depth * 1680;
      const halfTurn = 72 + depth * depth * 520;
      const directionSign = index % 7 === 0 ? .92 : 1;
      const frames = outgoing ? [
        { transform: "translate3d(0,0,0) rotate(0deg) scale(1)", filter: "none", opacity: 1 },
        { transform: `translate3d(0,1vh,0) rotate(${(10 + depth * 42) * directionSign}deg) scale(${1.015 + depth * .045})`, filter: `saturate(${1 + depth * .4})`, opacity: 1, offset: .18 },
        { transform: `translate3d(0,5vh,0) rotate(${halfTurn * directionSign}deg) scale(${.82 - depth * .18})`, filter: `saturate(${1.3 + depth}) contrast(${1.05 + depth * .3})`, opacity: .98, offset: .56 },
        { transform: `translate3d(0,14vh,0) rotate(${finalTurn * directionSign}deg) scale(.006)`, filter: "saturate(2.6) contrast(1.5) blur(1.5px)", opacity: 0 }
      ] : [
        { transform: `translate3d(0,14vh,0) rotate(${-finalTurn * directionSign}deg) scale(.006)`, filter: "saturate(2.6) contrast(1.5) blur(1.5px)", opacity: 0 },
        { transform: `translate3d(0,5vh,0) rotate(${-halfTurn * directionSign}deg) scale(${.82 - depth * .18})`, filter: `saturate(${1.3 + depth}) contrast(${1.05 + depth * .3})`, opacity: .98, offset: .44 },
        { transform: `translate3d(0,1vh,0) rotate(${-(10 + depth * 42) * directionSign}deg) scale(${1.015 + depth * .045})`, filter: `saturate(${1 + depth * .4})`, opacity: 1, offset: .82 },
        { transform: "translate3d(0,0,0) rotate(0deg) scale(1)", filter: "none", opacity: 1 }
      ];

      animations.push(trackAnimation(clone.animate(frames, {
        duration,
        easing: outgoing ? "cubic-bezier(.58,0,.96,.55)" : "cubic-bezier(.08,.62,.22,1)",
        fill: "both"
      })));
    }

    const drain = document.createElement("div");
    Object.assign(drain.style, {
      position: "absolute",
      inset: "0",
      zIndex: String(ringCount + 1),
      transformOrigin: "50% 52%",
      background: "repeating-conic-gradient(from 0deg at 50% 52%, transparent 0 9deg, rgba(114,255,25,.12) 9deg 11deg, transparent 11deg 20deg), radial-gradient(circle at 50% 52%, #000 0 3%, rgba(0,0,0,.92) 5%, rgba(0,0,0,.45) 11%, transparent 27%)"
    });
    vortex.appendChild(drain);
    document.body.appendChild(vortex);

    const rootAnimation = trackAnimation(root.animate([{ opacity: 0 }, { opacity: 0 }], { duration, fill: "both" }));
    animations.push(rootAnimation);
    animations.push(trackAnimation(drain.animate(outgoing ? [
      { opacity: .12, transform: "rotate(0deg) scale(.5)" },
      { opacity: .72, transform: "rotate(260deg) scale(1.25)", offset: .55 },
      { opacity: 1, transform: "rotate(940deg) scale(3.4)" }
    ] : [
      { opacity: 1, transform: "rotate(-940deg) scale(3.4)" },
      { opacity: .72, transform: "rotate(-260deg) scale(1.25)", offset: .45 },
      { opacity: 0, transform: "rotate(0deg) scale(.5)" }
    ], { duration, easing: outgoing ? "ease-in" : "ease-out", fill: "both" })));

    await Promise.all(animations.map(waitFor));

    if (!outgoing) {
      finishIncoming(root, animations, [vortex]);
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
      up: ["0", "-100vh"], down: ["0", "100vh"],
      left: ["-100vw", "0"], right: ["100vw", "0"]
    };
    const [x, y] = vectors[direction];
    const displacement = `translate3d(${x},${y},0)`;
    return {
      out: [{ transform: "translate3d(0,0,0)", opacity: 1 }, { transform: displacement, opacity: 1 }],
      in: [{ transform: displacement, opacity: 1 }, { transform: "translate3d(0,0,0)", opacity: 1 }]
    };
  };

  const oppositeSlideFrames = direction => {
    const vectors = {
      up: ["0", "100vh"], down: ["0", "-100vh"],
      left: ["100vw", "0"], right: ["-100vw", "0"]
    };
    const [x, y] = vectors[direction];
    return [
      { transform: `translate3d(${x},${y},0)`, opacity: 1 },
      { transform: "translate3d(0,0,0)", opacity: 1 }
    ];
  };

  const loadSlidePreview = (url, timeout = 4000) => new Promise(resolve => {
    const frame = document.createElement("iframe");
    frame.dataset.pageTransitionOverlay = "";
    frame.dataset.pageTransitionPreview = "";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    Object.assign(frame.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      width: "100vw",
      height: "100vh",
      height: "100dvh",
      border: "0",
      margin: "0",
      visibility: "hidden",
      background: "#000",
      pointerEvents: "none",
      willChange: "transform"
    });

    let settled = false;
    const finish = loaded => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve({ frame, loaded });
    };
    const timer = window.setTimeout(() => finish(false), timeout);
    frame.addEventListener("load", () => finish(true), { once: true });
    document.body.appendChild(frame);
    frame.src = url.href;
  });

  const playSeamlessSlide = async (direction, options, context) => {
    const duration = options.duration ?? 900;
    const root = transitionRoot(options);
    lockPage(root);

    const { frame, loaded } = await loadSlidePreview(context.url, options.loadTimeout ?? 4000);
    if (!loaded) {
      frame.remove();
      const frames = slideFrames(direction);
      return playRootEffect("out", options, frames.out, frames.in, { duration, easing: "cubic-bezier(.76,0,.24,1)" });
    }

    const oldFrames = slideFrames(direction).out;
    const newFrames = oppositeSlideFrames(direction);
    frame.style.transform = newFrames[0].transform;
    frame.style.visibility = "visible";

    const timing = { duration, easing: "cubic-bezier(.76,0,.24,1)", fill: "both" };
    const oldAnimation = trackAnimation(root.animate(oldFrames, timing));
    const newAnimation = trackAnimation(frame.animate(newFrames, timing));
    await Promise.all([waitFor(oldAnimation), waitFor(newAnimation)]);
  };

  const playSlide = (direction, phase, options = {}, context) => {
    if (phase === "out" && context?.url) {
      return playSeamlessSlide(direction, options, context);
    }
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
      const handoff = {
        from,
        to,
        transition: rule.transition,
        options: settings,
        skipIncoming: definition.skipIncoming === true,
        createdAt: Date.now()
      };

      try {
        await definition.out(settings, { from, to, url });
      } finally {
        sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
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

  api.register("glitch-disintegrate", {
    out: options => playGlitch("out", options),
    in: options => playGlitch("in", options)
  });

  ["up", "down", "left", "right"].forEach(direction => {
    api.register(`slide-${direction}`, {
      skipIncoming: true,
      out: (options, context) => playSlide(direction, "out", options, context),
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

  // Browsers may restore a transitioned-out page from the back/forward cache.
  // Put it back into a clean, fully visible state instead of preserving the
  // final frame of its outgoing animation.
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    leaving = false;
    activeAnimations.forEach(animation => animation.cancel());
    activeAnimations.clear();
    document.querySelectorAll("[data-page-transition-overlay]").forEach(overlay => overlay.remove());
    unlockPage(transitionRoot({}));
  });

  window.addEventListener("keydown", event => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const selector = document.querySelector('[data-arrow-transition-destination]');
    if (!selector || selector.value !== "arrow-keys") return;

    const arrowTransitions = {
      ArrowUp: "slide-down",
      ArrowDown: "slide-up",
      ArrowLeft: "slide-right",
      ArrowRight: "slide-left"
    };
    const transition = arrowTransitions[event.key];
    if (!transition) return;

    event.preventDefault();
    api.navigate(selector.dataset.arrowTransitionDestination, transition);
  });

  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const launcher = event.target.closest("[data-transition-destination]");
    if (launcher) {
      const selector = document.getElementById(launcher.dataset.transitionSelect);
      const transition = selector?.value || undefined;
      if (!transition) return;
      if (transition === "arrow-keys") {
        event.preventDefault();
        selector.focus();
        return;
      }
      event.preventDefault();
      api.navigate(launcher.dataset.transitionDestination, transition);
      return;
    }

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
    if (window.frameElement?.hasAttribute("data-page-transition-preview")) return;

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
    if (handoff.skipIncoming) return;

    const definition = transitions.get(handoff.transition);
    if (definition) await definition.in(handoff.options || {}, handoff);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", receiveHandoff, { once: true });
  } else {
    receiveHandoff();
  }
})();
