(() => {
  const ready = callback => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  };

  ready(() => {
    const compass = document.querySelector(".compass[data-orb-arranger-key]");
    const toggle = document.querySelector(".orb-edit-toggle");
    if (!compass || !toggle) return;

    const items = [...compass.children].filter(item => item.matches(".portal-button, .core"));
    if (items.length < 2) return;

    const storageKey = compass.dataset.orbArrangerKey;
    const scopeSelect = compass.dataset.orbArrangerScopeSelect
      ? document.querySelector(compass.dataset.orbArrangerScopeSelect)
      : null;
    const getScope = () => scopeSelect ? String(scopeSelect.value || "1") : "default";
    const originalAttributes = new Map();
    const defaultSlots = [];
    const itemById = new Map();
    const lines = [...compass.querySelectorAll(":scope > .portal-lines line")];
    let arrangements = {};
    let currentOrder = [];
    let editing = false;
    let pickedItem = null;
    let swapTarget = null;
    let drag = null;

    items.forEach((item, index) => {
      const style = window.getComputedStyle(item);
      const id = item.id === "open-portal" ? "portal-core" : `orb-${index}`;
      item.dataset.orbId = id;
      item.style.setProperty("--orb-jiggle-index", String(index));
      item.style.setProperty("--orb-jiggle-delay", `${index * -83}ms`);
      item.classList.add("orb-reorderable");
      defaultSlots.push({
        column: Number.parseInt(style.gridColumnStart, 10) || 2,
        row: Number.parseInt(style.gridRowStart, 10) || 2
      });
      itemById.set(id, item);
      originalAttributes.set(item, {
        role: item.getAttribute("role"),
        tabindex: item.getAttribute("tabindex")
      });
    });

    const defaultOrder = items.map(item => item.dataset.orbId);

    const readArrangements = () => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {
        return {};
      }
    };

    const validOrder = value => Array.isArray(value)
      && value.length === defaultOrder.length
      && new Set(value).size === defaultOrder.length
      && value.every(id => itemById.has(id));

    const saveArrangements = () => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(arrangements));
      } catch (_) {}
    };

    const slotCenter = slot => ({
      x: ((slot.column - .5) / 3) * 100,
      y: ((slot.row - .5) / 3) * 100
    });

    const updateLines = () => {
      if (!lines.length) return;
      const coreIndex = currentOrder.indexOf("portal-core");
      const core = slotCenter(defaultSlots[Math.max(0, coreIndex)]);
      const destinations = currentOrder
        .map((id, index) => ({ id, point: slotCenter(defaultSlots[index]) }))
        .filter(entry => entry.id !== "portal-core");

      lines.forEach((line, index) => {
        const destination = destinations[index];
        if (!destination) {
          line.style.display = "none";
          return;
        }
        line.style.display = "";
        line.setAttribute("x1", core.x.toFixed(2));
        line.setAttribute("y1", core.y.toFixed(2));
        line.setAttribute("x2", destination.point.x.toFixed(2));
        line.setAttribute("y2", destination.point.y.toFixed(2));
      });
    };

    const applyOrder = order => {
      currentOrder = validOrder(order) ? [...order] : [...defaultOrder];
      currentOrder.forEach((id, slotIndex) => {
        const item = itemById.get(id);
        const slot = defaultSlots[slotIndex];
        item.style.gridColumn = String(slot.column);
        item.style.gridRow = String(slot.row);
      });
      updateLines();
    };

    const loadScope = () => {
      const stored = arrangements[getScope()];
      applyOrder(validOrder(stored) ? stored : defaultOrder);
    };

    const clearPicked = () => {
      pickedItem?.classList.remove("orb-picked-up");
      swapTarget?.classList.remove("orb-swap-target");
      pickedItem = null;
      swapTarget = null;
    };

    const animateSwap = before => {
      items.forEach(item => {
        const oldRect = before.get(item);
        const newRect = item.getBoundingClientRect();
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        item.animate([
          { translate: `${dx}px ${dy}px`, offset: 0 },
          { translate: `${-dx * .08}px ${-dy * .08}px`, offset: .62 },
          { translate: `${dx * .025}px ${dy * .025}px`, offset: .82 },
          { translate: "0 0", offset: 1 }
        ], {
          duration: 520,
          easing: "cubic-bezier(.2,.8,.2,1)"
        });
      });
    };

    const swapItems = (first, second) => {
      if (!first || !second || first === second) return;
      const firstIndex = currentOrder.indexOf(first.dataset.orbId);
      const secondIndex = currentOrder.indexOf(second.dataset.orbId);
      if (firstIndex < 0 || secondIndex < 0) return;

      const before = new Map(items.map(item => [item, item.getBoundingClientRect()]));
      [currentOrder[firstIndex], currentOrder[secondIndex]] = [currentOrder[secondIndex], currentOrder[firstIndex]];
      applyOrder(currentOrder);
      arrangements[getScope()] = [...currentOrder];
      saveArrangements();
      animateSwap(before);
      clearPicked();
    };

    const chooseItem = item => {
      if (!pickedItem) {
        pickedItem = item;
        item.classList.add("orb-picked-up");
        return;
      }
      if (pickedItem === item) {
        clearPicked();
        return;
      }
      swapItems(pickedItem, item);
    };

    const setEditing = value => {
      editing = Boolean(value);
      clearPicked();
      compass.classList.toggle("orb-editing", editing);
      toggle.classList.toggle("is-active", editing);
      toggle.setAttribute("aria-pressed", String(editing));
      toggle.setAttribute("aria-label", editing ? "Finish rearranging orbs" : "Rearrange orbs");

      items.forEach(item => {
        const original = originalAttributes.get(item);
        item.setAttribute("aria-grabbed", "false");
        if (editing) {
          if (!item.matches("a, button")) item.setAttribute("role", "button");
          item.setAttribute("tabindex", "0");
          return;
        }
        item.removeAttribute("aria-grabbed");
        if (original.role === null) item.removeAttribute("role");
        else item.setAttribute("role", original.role);
        if (original.tabindex === null) item.removeAttribute("tabindex");
        else item.setAttribute("tabindex", original.tabindex);
      });
    };

    const targetAt = (x, y) => {
      const target = document.elementFromPoint(x, y)?.closest(".orb-reorderable");
      return target && compass.contains(target) ? target : null;
    };

    const updateSwapTarget = target => {
      if (swapTarget === target) return;
      swapTarget?.classList.remove("orb-swap-target");
      swapTarget = target && target !== drag?.item ? target : null;
      swapTarget?.classList.add("orb-swap-target");
    };

    items.forEach(item => {
      item.addEventListener("pointerdown", event => {
        if (!editing || event.button > 0) return;
        event.preventDefault();
        event.stopPropagation();
        clearPicked();
        drag = {
          item,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false
        };
        item.setPointerCapture?.(event.pointerId);
        item.setAttribute("aria-grabbed", "true");
      });

      item.addEventListener("pointermove", event => {
        if (!editing || !drag || drag.item !== item || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < 6) return;
        drag.moved = true;
        item.classList.add("orb-dragging");
        item.style.setProperty("--orb-drag-x", `${dx}px`);
        item.style.setProperty("--orb-drag-y", `${dy}px`);
        updateSwapTarget(targetAt(event.clientX, event.clientY));
      });

      const finishDrag = event => {
        if (!drag || drag.item !== item || drag.pointerId !== event.pointerId) return;
        const wasMoved = drag.moved;
        const target = swapTarget || targetAt(event.clientX, event.clientY);
        item.classList.remove("orb-dragging");
        item.style.removeProperty("--orb-drag-x");
        item.style.removeProperty("--orb-drag-y");
        item.setAttribute("aria-grabbed", "false");
        drag = null;
        if (wasMoved && target && target !== item) swapItems(item, target);
        else {
          updateSwapTarget(null);
          if (!wasMoved) chooseItem(item);
        }
      };

      item.addEventListener("pointerup", finishDrag);
      item.addEventListener("pointercancel", event => {
        if (!drag || drag.item !== item || drag.pointerId !== event.pointerId) return;
        item.classList.remove("orb-dragging");
        item.style.removeProperty("--orb-drag-x");
        item.style.removeProperty("--orb-drag-y");
        item.setAttribute("aria-grabbed", "false");
        drag = null;
        updateSwapTarget(null);
      });

      item.addEventListener("keydown", event => {
        if (!editing || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        event.stopPropagation();
        chooseItem(item);
      });
    });

    toggle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      setEditing(!editing);
    });

    document.addEventListener("click", event => {
      if (!editing || !event.target.closest(".orb-reorderable")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    document.addEventListener("keydown", event => {
      if (editing && event.key === "Escape") {
        if (pickedItem) clearPicked();
        else setEditing(false);
      }
    });

    scopeSelect?.addEventListener("change", () => {
      window.setTimeout(loadScope, 0);
    });

    window.addEventListener("pageshow", loadScope);
    arrangements = readArrangements();
    loadScope();
  });
})();
