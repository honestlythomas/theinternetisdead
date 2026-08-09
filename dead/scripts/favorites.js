(() => {
  "use strict";

  const storageKey = "theinternetisdead:favorites:v1";
  const positions = ["northwest", "north", "northeast", "west", "east", "southwest", "south", "southeast"];
  const fallbackImage = "/dead/assets/images/static.gif";

  const normalizeHref = value => {
    try {
      const url = new URL(value, window.location.origin);
      if (url.origin !== window.location.origin) return "";
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_) {
      return "";
    }
  };

  const normalizeImage = value => {
    if (!value) return fallbackImage;
    const cssUrl = String(value).match(/url\(["']?([^"')]+)["']?\)/i);
    const candidate = cssUrl ? cssUrl[1] : String(value).trim();
    try {
      const url = new URL(candidate, window.location.origin);
      return url.origin === window.location.origin ? `${url.pathname}${url.search}` : fallbackImage;
    } catch (_) {
      return fallbackImage;
    }
  };

  const cleanEntry = entry => {
    if (!entry || typeof entry !== "object") return null;
    const href = normalizeHref(entry.href);
    if (!href || href.startsWith("/favorites/")) return null;
    const title = String(entry.title || "Untitled").trim().slice(0, 120) || "Untitled";
    return {
      href,
      title,
      image: normalizeImage(entry.image),
      transition: String(entry.transition || "").trim().slice(0, 40),
      addedAt: Number(entry.addedAt) || Date.now()
    };
  };

  const read = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      if (!Array.isArray(parsed)) return [];
      const seen = new Set();
      return parsed.map(cleanEntry).filter(entry => {
        if (!entry || seen.has(entry.href)) return false;
        seen.add(entry.href);
        return true;
      });
    } catch (_) {
      return [];
    }
  };

  const write = entries => {
    const cleaned = entries.map(cleanEntry).filter(Boolean);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cleaned));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("favoriteorbschange", { detail: cleaned }));
    return cleaned;
  };

  const titleFromOrb = orb => {
    const explicitTitle = orb.dataset.favoriteTitle;
    const visibleTitle = orb.querySelector(".destination-label")?.textContent;
    if (explicitTitle || visibleTitle) return String(explicitTitle || visibleTitle).trim();
    return String(orb.getAttribute("aria-label") || "Destination")
      .replace(/^(open|return through the)\s+/i, "")
      .replace(/\s+portal$/i, "")
      .trim();
  };

  const entryFromOrb = orb => {
    const href = normalizeHref(orb.getAttribute("href"));
    if (!href || href.startsWith("/favorites/") || orb.classList.contains("is-empty")) return null;
    const computedImage = window.getComputedStyle(orb).getPropertyValue("--portal-image");
    return cleanEntry({
      href,
      title: titleFromOrb(orb),
      image: orb.dataset.favoriteImage || computedImage,
      transition: orb.dataset.transition,
      addedAt: Date.now()
    });
  };

  const toggle = entry => {
    const clean = cleanEntry(entry);
    if (!clean) return read();
    const entries = read();
    const index = entries.findIndex(item => item.href === clean.href);
    if (index >= 0) entries.splice(index, 1);
    else entries.push(clean);
    return write(entries);
  };

  const injectStyles = () => {
    if (document.getElementById("favorite-orb-styles")) return;
    const style = document.createElement("style");
    style.id = "favorite-orb-styles";
    style.textContent = `
      .favorite-toggle {
        z-index: 5;
        align-self: end;
        justify-self: center;
        margin: 0 0 .15vmin;
        border: 0;
        padding: .08em .22em;
        background: rgba(0, 0, 0, .72);
        color: #72ff19;
        cursor: pointer;
        font: 900 clamp(15px, 2.15vmin, 24px) / 1 "Courier New", Courier, monospace;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        filter: grayscale(1) brightness(.78);
        text-shadow: 0 0 8px #000, 0 0 10px rgba(114, 255, 25, .42);
        transform: translateY(12%) scale(.9);
        transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease, color 180ms ease;
      }

      .favorite-toggle[hidden] { display: none; }

      .portal-open .favorite-toggle {
        opacity: .72;
        visibility: visible;
        pointer-events: auto;
        transform: translateY(12%) scale(1);
      }

      .portal-opening .favorite-toggle {
        transition-delay: calc(var(--delay, 0ms) + 900ms);
      }

      .portal-open .favorite-toggle[aria-pressed="true"] {
        color: #ff2bd6;
        opacity: 1;
        filter: none;
        text-shadow: 0 0 8px #000, 0 0 13px rgba(255, 43, 214, .75);
      }

      .portal-open .favorite-toggle:hover,
      .portal-open .favorite-toggle:focus-visible {
        color: #ff2bd6;
        opacity: 1;
        filter: none;
        outline: 1px solid #ff2bd6;
        outline-offset: 2px;
      }

      .portal-closing .favorite-toggle {
        opacity: 0;
        pointer-events: none;
      }

      .portal-page-cycling .favorite-toggle {
        opacity: 0;
        pointer-events: none;
      }
    `;
    document.head.append(style);
  };

  const mount = (root = document) => {
    if (document.documentElement.hasAttribute("data-favorites-page")) return () => {};
    const compass = root.querySelector(".compass");
    if (!compass) return () => {};
    injectStyles();

    const controls = new Map();
    let refreshFrame = 0;

    const syncControl = (orb, control, favorites) => {
      const entry = entryFromOrb(orb);
      if (!entry) {
        control.hidden = true;
        return;
      }

      const active = favorites.some(item => item.href === entry.href);
      control.hidden = false;
      control.setAttribute("aria-pressed", String(active));
      control.setAttribute("aria-label", `${active ? "Remove" : "Add"} ${entry.title} ${active ? "from" : "to"} favorites`);
      control.title = `${active ? "Remove from" : "Add to"} Favorites`;
      if (control.textContent !== "⭐") control.textContent = "⭐";
    };

    const refresh = () => {
      refreshFrame = 0;
      const favorites = read();
      const currentOrbs = new Set(compass.querySelectorAll(":scope > a.portal-button"));

      currentOrbs.forEach(orb => {
        let control = controls.get(orb);
        if (!control) {
          control = document.createElement("button");
          control.type = "button";
          const position = positions.find(name => orb.classList.contains(name));
          control.className = `favorite-toggle${position ? ` ${position}` : ""}`;
          control.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            const entry = entryFromOrb(orb);
            if (entry) toggle(entry);
          });
          controls.set(orb, control);
          compass.append(control);
        }
        syncControl(orb, control, favorites);
      });

      controls.forEach((control, orb) => {
        if (currentOrbs.has(orb)) return;
        control.remove();
        controls.delete(orb);
      });
    };

    const scheduleRefresh = () => {
      if (!refreshFrame) refreshFrame = window.requestAnimationFrame(refresh);
    };

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(compass, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["href", "style", "data-transition", "data-favorite-image", "data-favorite-title"]
    });
    window.addEventListener("favoriteorbschange", scheduleRefresh);
    window.addEventListener("storage", event => {
      if (event.key === storageKey) scheduleRefresh();
    });
    window.addEventListener("pageshow", scheduleRefresh);
    refresh();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(refreshFrame);
      controls.forEach(control => control.remove());
      controls.clear();
    };
  };

  window.FavoriteOrbs = Object.freeze({ storageKey, read, write, toggle, mount });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mount(), { once: true });
  } else {
    mount();
  }
})();
