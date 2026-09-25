(() => {
  if (window.parent === window) return;

  let pointerFrame = 0;
  let pendingPointer = { active: false, x: 0, y: 0 };

  function publishPointer(active, event) {
    if (!active) {
      pendingPointer = { active: false, x: 0, y: 0 };
    } else {
      const frame = window.frameElement;
      const rect = frame
        ? frame.getBoundingClientRect()
        : { left: 0, top: 0, width: innerWidth, height: innerHeight };
      const hostWidth = Math.max(1, window.parent.innerWidth);
      const hostHeight = Math.max(1, window.parent.innerHeight);
      const hostX = rect.left + event.clientX * (rect.width / Math.max(1, innerWidth));
      const hostY = rect.top + event.clientY * (rect.height / Math.max(1, innerHeight));

      pendingPointer = {
        active: true,
        x: Math.max(-1, Math.min(1, hostX / hostWidth * 2 - 1)),
        y: Math.max(-1, Math.min(1, hostY / hostHeight * 2 - 1))
      };
    }

    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      window.parent.postMessage(
        { type: "portal-starfield-parallax", ...pendingPointer },
        window.location.origin
      );
    });
  }

  window.addEventListener("pointermove", event => publishPointer(true, event), { passive: true });
  window.addEventListener("pointerdown", event => publishPointer(true, event), { passive: true });
  window.addEventListener("pointerup", event => {
    if (event.pointerType !== "mouse") publishPointer(false, event);
  }, { passive: true });
  window.addEventListener("pointercancel", event => publishPointer(false, event), { passive: true });
  window.addEventListener("pointerout", event => {
    if (!event.relatedTarget) publishPointer(false, event);
  }, { passive: true });
  window.addEventListener("pagehide", event => publishPointer(false, event));
})();
