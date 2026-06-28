export function isTextEntryTarget(target) {
  return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

export function createBushInventoryController({
  bushInventory,
  bushInventorySlots = [],
  bushCarryGhost,
  bushCarryGhostCount,
  stackMax = 64,
  bushIconSrc = "assets/png/topdown-pine-tree01.png",
  rubbleIconSrc = "assets/png/rubble-pile.png"
} = {}) {
  const slots = Array.from(bushInventorySlots || []);
  const iconSrcByType = {
    bush: bushIconSrc,
    rubble: rubbleIconSrc
  };
  const altByType = {
    bush: "Collected bush",
    rubble: "Collected rubble"
  };

  let slotItems = slots.map(() => null);
  let activeCarryType = null;
  let activeCarryCount = 0;
  let onLayoutChanged = null;
  let rightSpreadActive = false;
  let leftShiftHeld = false;
  let pendingSingleClickTimer = null;
  const rightSpreadSlots = new Set();
  const carryGhostImage = bushCarryGhost ? bushCarryGhost.querySelector("img") : null;

  function setOpen(isOpen) {
    if (!bushInventory) return;
    const shouldOpen = Boolean(isOpen);
    bushInventory.classList.toggle("open", shouldOpen);
    bushInventory.setAttribute("aria-hidden", String(!shouldOpen));
    const titleButton = bushInventory.querySelector(".inventory-title");
    if (titleButton) {
      titleButton.setAttribute("aria-expanded", String(shouldOpen));
    }
  }

  function toggleOpen() {
    if (!bushInventory) return;
    setOpen(!bushInventory.classList.contains("open"));
  }

  function clampStackCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(parsed, stackMax);
  }

  function normalizeItem(item) {
    if (!item || (item.type !== "bush" && item.type !== "rubble")) return null;
    const count = clampStackCount(item.count);
    if (count <= 0) return null;
    return { type: item.type, count };
  }

  function normalizeSlotItems(items = slotItems) {
    const normalized = slots.map((_, index) => normalizeItem(items[index]));
    return normalized;
  }

  function getSlotFillOrder(startIndex = 0) {
    if (!slots.length) return [];
    const safeStart = Number.isInteger(startIndex) && slots[startIndex] ? startIndex : 0;
    return [
      ...slots.slice(safeStart).map((_, offset) => safeStart + offset),
      ...slots.slice(0, safeStart).map((_, offset) => offset),
    ];
  }

  function getCountsByType(type) {
    return slotItems.map((item) => item && item.type === type ? clampStackCount(item.count) : 0);
  }

  function getTotalByType(type) {
    return getCountsByType(type).reduce((sum, value) => sum + value, 0);
  }

  function normalizeCountsForType(totalCount, counts = getCountsByType("bush"), type = "bush") {
    const safeTotal = Math.max(0, Number.isFinite(totalCount) ? Math.floor(totalCount) : 0);
    const carriedCount = activeCarryType === type ? Math.max(0, Number.isFinite(activeCarryCount) ? Math.floor(activeCarryCount) : 0) : 0;
    const safeSlottedTotal = Math.max(0, safeTotal - carriedCount);
    const normalized = slots.map((_, index) => clampStackCount(counts[index]));

    let currentTotal = normalized.reduce((sum, value) => sum + value, 0);

    if (currentTotal < safeSlottedTotal && normalized.length) {
      let missing = safeSlottedTotal - currentTotal;
      for (let index = 0; index < normalized.length && missing > 0; index += 1) {
        const room = stackMax - normalized[index];
        if (room <= 0) continue;
        const addCount = Math.min(room, missing);
        normalized[index] += addCount;
        missing -= addCount;
      }
    } else if (currentTotal > safeSlottedTotal) {
      let excess = currentTotal - safeSlottedTotal;
      for (let index = normalized.length - 1; index >= 0 && excess > 0; index -= 1) {
        const removable = Math.min(normalized[index], excess);
        normalized[index] -= removable;
        excess -= removable;
      }
    }

    return normalized;
  }

  function placeCountsForType(type, normalizedCounts) {
    const existingOtherItems = slotItems.map((item) => item && item.type !== type ? { ...item } : null);
    const nextItems = slots.map((_, index) => existingOtherItems[index]);
    const displacedCounts = [];

    for (const [index, rawCount] of normalizedCounts.entries()) {
      const count = clampStackCount(rawCount);
      if (count <= 0) continue;
      if (!nextItems[index]) {
        nextItems[index] = { type, count };
      } else {
        displacedCounts.push(count);
      }
    }

    for (const count of displacedCounts) {
      let remaining = count;
      for (const index of getSlotFillOrder(0)) {
        if (remaining <= 0) break;
        const current = nextItems[index];
        if (current && current.type !== type) continue;
        const currentCount = current ? clampStackCount(current.count) : 0;
        const room = stackMax - currentCount;
        if (room <= 0) continue;
        const addCount = Math.min(room, remaining);
        nextItems[index] = { type, count: currentCount + addCount };
        remaining -= addCount;
      }
    }

    slotItems = nextItems;
  }

  function setCounts(totalCount, counts = getCountsByType("bush")) {
    placeCountsForType("bush", normalizeCountsForType(totalCount, counts, "bush"));
    renderItems();
  }

  function setRubbleCounts(totalCount, counts = getCountsByType("rubble")) {
    placeCountsForType("rubble", normalizeCountsForType(totalCount, counts, "rubble"));
    renderItems();
  }

  function setRubbleCount(count = 0) {
    setRubbleCounts(count, getCountsByType("rubble"));
  }

  function getCounts() {
    return getCountsByType("bush");
  }

  function getRubbleCounts() {
    return getCountsByType("rubble");
  }

  function setLayoutChangedHandler(handler) {
    onLayoutChanged = typeof handler === "function" ? handler : null;
  }

  function saveLayoutIfReady() {
    if (typeof onLayoutChanged === "function") {
      onLayoutChanged(getCounts(), getRubbleCounts());
    }
  }

  function positionCarryGhost(event) {
    if (!bushCarryGhost || activeCarryCount <= 0 || !event) return;
    bushCarryGhost.style.left = `${event.clientX}px`;
    bushCarryGhost.style.top = `${event.clientY}px`;
  }

  function updateCarryGhost() {
    if (!bushCarryGhost) return;
    const isCarrying = activeCarryCount > 0 && (activeCarryType === "bush" || activeCarryType === "rubble");
    bushCarryGhost.hidden = !isCarrying;
    bushCarryGhost.setAttribute("aria-hidden", String(!isCarrying));
    bushCarryGhost.dataset.itemType = isCarrying ? activeCarryType : "";
    if (carryGhostImage && isCarrying) {
      carryGhostImage.src = iconSrcByType[activeCarryType] || bushIconSrc;
      carryGhostImage.alt = "";
    }
    if (bushCarryGhostCount) {
      bushCarryGhostCount.textContent = `x${Math.max(1, activeCarryCount)}`;
      bushCarryGhostCount.hidden = activeCarryCount <= 1;
    }
    slots.forEach((slot) => slot.classList.toggle("carry-target", isCarrying));
  }

  function startCarryStack(sourceIndex, event = null) {
    if (!Number.isInteger(sourceIndex) || !slots[sourceIndex]) return;
    const item = normalizeItem(slotItems[sourceIndex]);
    if (!item) return;

    activeCarryType = item.type;
    activeCarryCount = item.count;
    slotItems[sourceIndex] = null;
    renderItems();
    updateCarryGhost();
    positionCarryGhost(event);
    saveLayoutIfReady();
  }

  function placeOneCarried(targetIndex) {
    if (!Number.isInteger(targetIndex) || !slots[targetIndex]) return false;
    if (activeCarryCount <= 0 || !activeCarryType) return false;

    const target = normalizeItem(slotItems[targetIndex]);
    if (target && (target.type !== activeCarryType || target.count >= stackMax)) return false;

    const nextCount = (target ? target.count : 0) + 1;
    slotItems[targetIndex] = { type: activeCarryType, count: nextCount };
    activeCarryCount -= 1;
    if (activeCarryCount <= 0) {
      activeCarryCount = 0;
      activeCarryType = null;
      endRightSpreadDrag();
    }

    renderItems();
    updateCarryGhost();
    saveLayoutIfReady();
    return true;
  }

  function endRightSpreadDrag() {
    rightSpreadActive = false;
    rightSpreadSlots.clear();
  }

  function clearPendingSingleClick() {
    if (!pendingSingleClickTimer) return;
    window.clearTimeout(pendingSingleClickTimer);
    pendingSingleClickTimer = null;
  }

  function canDragInventory(event = null) {
    return Boolean(leftShiftHeld || (event && event.shiftKey));
  }

  function collectMatchingItemsToCarry(sourceIndex, event = null) {
    // Double-click gather is intentionally allowed without Left Shift.
    // Single-click move/drop/spread stays Shift-gated below.
    if (!Number.isInteger(sourceIndex) || !slots[sourceIndex]) return false;

    const sourceItem = normalizeItem(slotItems[sourceIndex]);
    if (!sourceItem) return false;
    if (activeCarryCount > 0 && activeCarryType && activeCarryType !== sourceItem.type) return false;

    const targetType = activeCarryType || sourceItem.type;
    let room = stackMax - clampStackCount(activeCarryCount);
    if (room <= 0) return false;

    if (!activeCarryType) activeCarryType = targetType;

    const collectOrder = [
      sourceIndex,
      ...getSlotFillOrder(sourceIndex + 1).filter((index) => index !== sourceIndex),
    ];

    let collected = 0;
    for (const index of collectOrder) {
      if (room <= 0) break;
      const item = normalizeItem(slotItems[index]);
      if (!item || item.type !== targetType) continue;

      const takeCount = Math.min(room, item.count);
      const remaining = item.count - takeCount;
      slotItems[index] = remaining > 0 ? { type: item.type, count: remaining } : null;
      activeCarryCount += takeCount;
      room -= takeCount;
      collected += takeCount;
    }

    if (collected <= 0) return false;
    renderItems();
    updateCarryGhost();
    positionCarryGhost(event);
    saveLayoutIfReady();
    return true;
  }

  function spreadOneCarriedToSlot(targetIndex, event = null) {
    if (!rightSpreadActive || activeCarryCount <= 0 || !activeCarryType) return;
    if (!Number.isInteger(targetIndex) || !slots[targetIndex]) return;
    if (rightSpreadSlots.has(targetIndex)) return;

    const didPlace = placeOneCarried(targetIndex);
    if (didPlace) {
      rightSpreadSlots.add(targetIndex);
      positionCarryGhost(event);
    }
  }

  function swapOrDropCarriedStack(targetIndex) {
    if (!Number.isInteger(targetIndex) || !slots[targetIndex]) return;
    if (activeCarryCount <= 0 || !activeCarryType) return;

    const carriedItem = { type: activeCarryType, count: clampStackCount(activeCarryCount) };
    const parkedItem = normalizeItem(slotItems[targetIndex]);

    if (parkedItem && parkedItem.type === carriedItem.type && parkedItem.count < stackMax) {
      const room = stackMax - parkedItem.count;
      const mergeCount = Math.min(room, carriedItem.count);
      slotItems[targetIndex] = {
        type: parkedItem.type,
        count: parkedItem.count + mergeCount
      };
      activeCarryCount = carriedItem.count - mergeCount;
      if (activeCarryCount <= 0) {
        activeCarryType = null;
        activeCarryCount = 0;
      }

      renderItems();
      updateCarryGhost();
      saveLayoutIfReady();
      return;
    }

    slotItems[targetIndex] = carriedItem;
    if (parkedItem) {
      activeCarryType = parkedItem.type;
      activeCarryCount = parkedItem.count;
    } else {
      activeCarryType = null;
      activeCarryCount = 0;
    }

    renderItems();
    updateCarryGhost();
    saveLayoutIfReady();
  }

  function addCarriedToSlots(startIndex = 0) {
    if (activeCarryCount <= 0 || !activeCarryType) return 0;
    let remaining = activeCarryCount;
    let deposited = 0;

    for (const index of getSlotFillOrder(startIndex)) {
      if (remaining <= 0) break;
      const current = normalizeItem(slotItems[index]);
      if (current && current.type !== activeCarryType) continue;
      const currentCount = current ? current.count : 0;
      const room = stackMax - currentCount;
      if (room <= 0) continue;
      const addCount = Math.min(room, remaining);
      slotItems[index] = { type: activeCarryType, count: currentCount + addCount };
      remaining -= addCount;
      deposited += addCount;
    }

    activeCarryCount = remaining;
    if (activeCarryCount <= 0) {
      activeCarryCount = 0;
      activeCarryType = null;
    }

    return deposited;
  }

  function cancelCarryToLeftmostSlot() {
    if (activeCarryCount <= 0 || !slots.length) return;
    addCarriedToSlots(0);
    renderItems();
    updateCarryGhost();
    saveLayoutIfReady();
  }

  function consumeItemFromSlot(slotIndex, type, count = 1) {
    if (!Number.isInteger(slotIndex) || !slots[slotIndex]) return false;
    if (type !== "bush" && type !== "rubble") return false;
    const item = normalizeItem(slotItems[slotIndex]);
    const amount = Math.max(1, Math.floor(Number(count) || 1));
    if (!item || item.type !== type || item.count < amount) return false;

    const remaining = item.count - amount;
    slotItems[slotIndex] = remaining > 0 ? { type, count: remaining } : null;
    renderItems();
    saveLayoutIfReady();
    return true;
  }

  function hasItemInSlot(slotIndex, type) {
    if (!Number.isInteger(slotIndex) || !slots[slotIndex]) return false;
    const item = normalizeItem(slotItems[slotIndex]);
    return Boolean(item && item.type === type && item.count > 0);
  }

  function appendInventoryIcon(slot, { src, alt, count, type }) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.draggable = false;
    slot.appendChild(img);

    if (count > 1) {
      const badge = document.createElement("span");
      badge.className = "bush-slot-count";
      badge.textContent = `x${count}`;
      slot.appendChild(badge);
    }

    slot.dataset.itemType = type;
  }

  function renderItems() {
    slotItems = normalizeSlotItems(slotItems);

    for (const slot of slots) {
      slot.innerHTML = "";
      slot.classList.remove("has-bush", "has-rubble");
      delete slot.dataset.itemType;
    }

    for (const [index, slot] of slots.entries()) {
      const item = normalizeItem(slotItems[index]);
      if (!item) continue;
      slot.classList.add(item.type === "rubble" ? "has-rubble" : "has-bush");
      appendInventoryIcon(slot, {
        src: iconSrcByType[item.type] || bushIconSrc,
        alt: altByType[item.type] || "Collected item",
        count: item.count,
        type: item.type
      });
    }

    updateCarryGhost();
  }

  function attachListeners() {
    if (bushInventory) {
      const titleButton = bushInventory.querySelector(".inventory-title");
      if (titleButton) {
        titleButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleOpen();
        });
        titleButton.addEventListener("mousedown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      }

      bushInventory.addEventListener("dragstart", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      bushInventory.addEventListener("mousedown", (event) => {
        // Keep inventory clicks from starting camera/player drag behavior underneath.
        event.stopPropagation();
      });
    }

    for (const [index, slot] of slots.entries()) {
      slot.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();

        clearPendingSingleClick();

        if (event.detail >= 2) {
          event.preventDefault();
          collectMatchingItemsToCarry(index, event);
          return;
        }

        const canStartOrFinishMove = activeCarryCount > 0 || canDragInventory(event);
        if (!canStartOrFinishMove) {
          return;
        }

        event.preventDefault();

        pendingSingleClickTimer = window.setTimeout(() => {
          pendingSingleClickTimer = null;

          if (activeCarryCount > 0) {
            swapOrDropCarriedStack(index);
            positionCarryGhost(event);
            return;
          }

          if (!canDragInventory(event)) return;
          startCarryStack(index, event);
        }, 170);
      });

      slot.addEventListener("click", (event) => {
        event.stopPropagation();
        if (canDragInventory(event)) event.preventDefault();
      });

      slot.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearPendingSingleClick();
        collectMatchingItemsToCarry(index, event);
      });

      slot.addEventListener("dragstart", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      slot.addEventListener("mousedown", (event) => {
        if (event.button !== 2) return;
        event.stopPropagation();

        if (activeCarryCount <= 0) return;
        event.preventDefault();
        rightSpreadActive = true;
        rightSpreadSlots.clear();
        spreadOneCarriedToSlot(index, event);
      });

      slot.addEventListener("mouseenter", (event) => {
        if (!rightSpreadActive || activeCarryCount <= 0 || (event.buttons & 2) !== 2) return;
        event.preventDefault();
        event.stopPropagation();
        spreadOneCarriedToSlot(index, event);
      });

      slot.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }

    window.addEventListener("mousemove", positionCarryGhost);
    window.addEventListener("keydown", (event) => {
      if (event.code === "ShiftLeft") leftShiftHeld = true;
    });
    window.addEventListener("keyup", (event) => {
      if (event.code === "ShiftLeft") {
        leftShiftHeld = false;
        clearPendingSingleClick();
      }
    });
    window.addEventListener("mouseup", (event) => {
      if (event.button === 2) endRightSpreadDrag();
    });
    window.addEventListener("blur", () => {
      leftShiftHeld = false;
      endRightSpreadDrag();
      clearPendingSingleClick();
    });
  }

  attachListeners();
  renderItems();

  return {
    setOpen,
    toggleOpen,
    normalizeSlotCounts: (totalCount, counts = getCounts()) => normalizeCountsForType(totalCount, counts, "bush"),
    normalizeRubbleSlotCounts: (totalCount, counts = getRubbleCounts()) => normalizeCountsForType(totalCount, counts, "rubble"),
    setCounts,
    setRubbleCounts,
    getCounts,
    getRubbleCounts,
    setRubbleCount,
    setLayoutChangedHandler,
    getActiveCarryCount: () => activeCarryCount,
    getActiveCarryType: () => activeCarryType,
    hasItemInSlot,
    consumeItemFromSlot,
    cancelCarryToLeftmostSlot
  };
}

export function createPlayerController(ctx) {
  const {
    THREE,
    canvas,
    hud,
    minimap,
    renderer,
    camera,
    state,
    player,
    keys,
    liveCameraModeSelect,
    modeReadout,
    underwaterOverlay,
    audioHandler,
    lerp,
    smoothstep,
    getActiveSpawnPoint,
    getIsThirdPersonMode,
    setCameraModeState,
    getTerrainHeightAtWorld,
    getVisibleSurfaceHeightAtWorld,
    getWaterSurfaceHeightAtWorld,
    getSolidSurfaceHeightAtWorld = getTerrainHeightAtWorld,
    getRubbleSurfaceHeightAtWorld = () => -Infinity,
    onRubbleLanding = () => {},
    updateChunks,
    updateLodFogCurtain,
    handleFlattenedTreeClick,
    cancelFlattenedTreeClickHold,
    updateFlattenedTreeHover,
    handleStaticRubbleClick = () => false,
    cancelStaticRubbleClickHold = () => false,
    updateStaticRubbleHover = () => null,
    handleLooseRubbleClick = () => false,
    cancelLooseRubbleClickHold = () => false,
    updateLooseRubbleHover = () => null,
    handleInventoryRubbleFire = () => false,
    isTextEntryTarget,
    toggleBushInventory,
    getActiveBushCarryCount,
    cancelBushCarryToLeftmostSlot
  } = ctx;

  const firstPersonZoomDistance = Math.max(0.8, player.radius * 0.42);
  const firstPersonCameraThreshold = Math.max(3.2, player.radius * 2.1);

  function getBallModeFirstPersonBlend() {
    if (!getIsThirdPersonMode() || !player.mesh) return 0;
    return THREE.MathUtils.clamp(
      (firstPersonCameraThreshold - state.distance) / Math.max(0.001, firstPersonCameraThreshold - firstPersonZoomDistance),
      0,
      1
    );
  }

  function syncPlayerMeshVisibility() {
    if (!player.mesh) return;
    player.mesh.visible = getIsThirdPersonMode() && getBallModeFirstPersonBlend() < 0.98;
  }

  function syncModeReadout() {
    modeReadout.textContent = `Mode: ${getIsThirdPersonMode() ? "Ball Mode" : "Dev Mode"}`;
  }

  function getForwardRightVectors() {
    const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw)).normalize();
    const right = new THREE.Vector3(Math.cos(state.yaw), 0, -Math.sin(state.yaw)).normalize();
    return { forward, right };
  }

  function updateTargetHeight() {
    if (getIsThirdPersonMode() && player.mesh) {
      const dryOffset = 6;
      const underwaterOffset = 1.2;
      const firstPersonBlend = getBallModeFirstPersonBlend();
      const ballCenterOffset = lerp(0.24, -0.18, player.cameraWaterBlend);
      const followOffset = lerp(dryOffset, underwaterOffset, player.cameraWaterBlend);
      const desiredOffset = lerp(followOffset, ballCenterOffset, firstPersonBlend);
      let desiredY = player.mesh.position.y + desiredOffset;

      if (
        firstPersonBlend < 0.82 &&
        player.inWater &&
        !player.underwater &&
        Number.isFinite(player.waterSurfaceY)
      ) {
        desiredY = Math.max(desiredY, player.waterSurfaceY + player.radius * 2.4);
      }

      const horizontalFollow = lerp(0.16, 0.42, firstPersonBlend);
      const verticalFollow = lerp(0.075, 0.34, firstPersonBlend);
      state.target.x = lerp(state.target.x, player.mesh.position.x, horizontalFollow);
      state.target.y = lerp(state.target.y, desiredY, verticalFollow);
      state.target.z = lerp(state.target.z, player.mesh.position.z, horizontalFollow);
      syncPlayerMeshVisibility();
      return;
    }

    const groundY = getTerrainHeightAtWorld(state.target.x, state.target.z);
    const desiredY = groundY + 26;
    state.target.y = lerp(state.target.y, desiredY, 0.08);
  }

  function updateCameraPosition() {
    const isThirdPersonMode = getIsThirdPersonMode();

    if (isThirdPersonMode && player.mesh) {
      const firstPersonBlend = getBallModeFirstPersonBlend();

      if (firstPersonBlend >= 0.98) {
        const eyeY = player.mesh.position.y + lerp(0.26, -0.16, player.cameraWaterBlend);
        camera.position.set(
          player.mesh.position.x,
          eyeY,
          player.mesh.position.z
        );

        const lookDistance = 28;
        const lookPitch = THREE.MathUtils.clamp(-state.pitch * 0.22, -0.42, 0.18);
        const lookHorizontal = Math.cos(lookPitch) * lookDistance;
        const lookTarget = new THREE.Vector3(
          camera.position.x - Math.sin(state.yaw) * lookHorizontal,
          camera.position.y + Math.sin(lookPitch) * lookDistance,
          camera.position.z - Math.cos(state.yaw) * lookHorizontal
        );
        camera.lookAt(lookTarget);
        syncPlayerMeshVisibility();
        return;
      }
    }

    const horizontalDistance = Math.cos(state.pitch) * state.distance;
    let verticalDistance = Math.sin(state.pitch) * state.distance;

    if (isThirdPersonMode && player.mesh) {
      const waterFlatten = lerp(1.0, 0.24, player.cameraWaterBlend);
      verticalDistance *= waterFlatten;
    }

    camera.position.x = state.target.x + Math.sin(state.yaw) * horizontalDistance;
    camera.position.y = state.target.y + verticalDistance;
    camera.position.z = state.target.z + Math.cos(state.yaw) * horizontalDistance;

    if (
      isThirdPersonMode &&
      player.mesh &&
      Number.isFinite(player.waterSurfaceY)
    ) {
      if (player.cameraWaterBlend > 0.72 && player.underwater) {
        const maxUnderwaterCameraY = player.waterSurfaceY - 0.35;
        camera.position.y = Math.min(camera.position.y, maxUnderwaterCameraY);
      } else if (player.inWater) {
        const minSurfaceCameraY = player.waterSurfaceY + player.radius * 1.8;
        camera.position.y = Math.max(camera.position.y, minSurfaceCameraY);
      }
    }

    camera.lookAt(state.target);
    syncPlayerMeshVisibility();
  }

  function resetCamera() {
    const activeSpawnPoint = getActiveSpawnPoint();
    const isThirdPersonMode = getIsThirdPersonMode();

    state.yaw = Number.isFinite(activeSpawnPoint.yaw) ? activeSpawnPoint.yaw : Math.PI / 4;
    state.pitch = THREE.MathUtils.degToRad(isThirdPersonMode ? 38 : 54);
    state.distance = isThirdPersonMode ? 62 : 360;

    if (player.mesh) {
      syncPlayerMeshVisibility();
    }

    if (isThirdPersonMode && player.mesh) {
      const spawnX = activeSpawnPoint.x || 0;
      const spawnZ = activeSpawnPoint.z || 0;
      const savedY = Number(activeSpawnPoint.y);
      const terrainSpawnY = getVisibleSurfaceHeightAtWorld(spawnX, spawnZ) + player.radius;
      const spawnY = Number.isFinite(savedY) && savedY !== 0 ? savedY : terrainSpawnY;

      player.mesh.position.set(spawnX, spawnY, spawnZ);
      player.velocity.set(0, 0, 0);
      player.verticalVelocity = 0;
      player.grounded = true;
      player.jumpLandingArmed = false;
      player.inWater = false;
      player.underwater = false;
      player.waterSurfaceY = -Infinity;
      player.waterBlend = 0;
      player.cameraWaterBlend = 0;
      player.waterDepthOffset = 0;
      player.bounceTimer = 0;
      player.launchStretchTimer = 0;
      player.mesh.scale.set(1, 1, 1);
      state.target.set(spawnX, spawnY + 6, spawnZ);
    } else {
      state.target.set(
        activeSpawnPoint.x || 0,
        getTerrainHeightAtWorld(activeSpawnPoint.x || 0, activeSpawnPoint.z || 0) + 26,
        activeSpawnPoint.z || 0
      );
    }

    updateChunks();
    updateCameraPosition();
  }

  function switchCameraMode(nextMode) {
    const currentCameraMode = nextMode === "third-person" ? "third-person" : "dev";
    const isThirdPersonMode = currentCameraMode === "third-person";
    setCameraModeState(currentCameraMode, isThirdPersonMode);
    liveCameraModeSelect.value = currentCameraMode;
    syncModeReadout();

    if (player.mesh) {
      player.mesh.visible = isThirdPersonMode;
    }

    if (isThirdPersonMode && player.mesh) {
      const surfaceY = getVisibleSurfaceHeightAtWorld(state.target.x, state.target.z) + player.radius;
      player.mesh.position.set(state.target.x, Math.max(surfaceY, state.target.y), state.target.z);
      player.velocity.set(0, 0, 0);
      player.verticalVelocity = 0;
      player.grounded = false;
      player.jumpLandingArmed = false;
      player.inWater = false;
      player.underwater = false;
      player.waterSurfaceY = -Infinity;
      player.waterBlend = 0;
      player.cameraWaterBlend = 0;
      player.waterDepthOffset = 0;
      player.bounceTimer = 0;
      player.launchStretchTimer = 0;
      state.distance = 62;
      state.pitch = THREE.MathUtils.degToRad(38);
    } else {
      state.target.set(
        player.mesh ? player.mesh.position.x : state.target.x,
        player.mesh ? player.mesh.position.y + 26 : state.target.y,
        player.mesh ? player.mesh.position.z : state.target.z
      );
      state.distance = 360;
      state.pitch = THREE.MathUtils.degToRad(54);
      underwaterOverlay.style.opacity = "0";
    }

    updateChunks();
    updateCameraPosition();
    updateLodFogCurtain();
  }

  function updateThirdPersonPlayer(deltaSeconds) {
    if (!player.mesh) return;

    const { forward, right } = getForwardRightVectors();
    const movement = new THREE.Vector3();

    if (keys.has("KeyW") || keys.has("ArrowUp")) movement.add(forward);
    if (keys.has("KeyS") || keys.has("ArrowDown")) movement.sub(forward);
    if (keys.has("KeyD") || keys.has("ArrowRight")) movement.add(right);
    if (keys.has("KeyA") || keys.has("ArrowLeft")) movement.sub(right);

    const waterSurfaceY = getWaterSurfaceHeightAtWorld(player.mesh.position.x, player.mesh.position.z);
    const isOnWaterTile = Number.isFinite(waterSurfaceY);
    const floatRestY = isOnWaterTile
      ? waterSurfaceY + player.radius * 0.56 - player.waterDepthOffset
      : -Infinity;
    const isFloating = isOnWaterTile && player.mesh.position.y <= waterSurfaceY + player.radius * 1.25;
    player.inWater = isFloating;
    player.waterSurfaceY = isOnWaterTile ? waterSurfaceY : -Infinity;

    if (!isOnWaterTile) {
      player.waterDepthOffset = 0;
    }

    const targetWaterBlend = isFloating ? 1 : 0;
    player.waterBlend = lerp(player.waterBlend, targetWaterBlend, isFloating ? 0.08 : 0.12);

    const targetCameraWaterBlend =
      isOnWaterTile && player.mesh.position.y < waterSurfaceY - player.radius * 0.35
        ? 1
        : 0;

    player.cameraWaterBlend = lerp(
      player.cameraWaterBlend,
      targetCameraWaterBlend,
      targetCameraWaterBlend > player.cameraWaterBlend ? 0.045 : 0.085
    );

    player.underwater = player.cameraWaterBlend > 0.58 && isOnWaterTile && player.mesh.position.y < waterSurfaceY - player.radius * 0.45;

    const horizontalVelocity = new THREE.Vector3(player.velocity.x, 0, player.velocity.z);

    const holdingShift = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const sprintingOnLand = holdingShift && !isFloating;
    const horizontalSpeedBeforeInput = horizontalVelocity.length();
    const shouldSpringOnSprintStart =
      sprintingOnLand &&
      player.grounded &&
      movement.lengthSq() > 0 &&
      horizontalSpeedBeforeInput > player.maxSpeed * 0.22 &&
      !player.wasSprintingAudio;

    if (shouldSpringOnSprintStart) {
      const nowMs = performance.now();
      if (nowMs - player.lastSprintSpringAt > 420) {
        audioHandler.playSpringSound(0.54);
        player.lastSprintSpringAt = nowMs;
      }
    }
    player.wasSprintingAudio = sprintingOnLand && movement.lengthSq() > 0;

    if (movement.lengthSq() > 0) {
      movement.normalize();
      const acceleration = isFloating
        ? player.swimAcceleration
        : (player.grounded ? player.acceleration : player.airAcceleration);

      const accelerationMultiplier = sprintingOnLand ? player.sprintMultiplier : 1;
      horizontalVelocity.addScaledVector(movement, acceleration * accelerationMultiplier * deltaSeconds);
    }

    const maxSpeed = isFloating
      ? player.swimMaxSpeed
      : player.maxSpeed * (sprintingOnLand ? player.sprintMaxSpeedMultiplier : 1);
    if (horizontalVelocity.length() > maxSpeed) {
      horizontalVelocity.setLength(maxSpeed);
    }

    const damping = isFloating
      ? player.waterDamping
      : (player.grounded ? player.damping : player.airDamping);

    horizontalVelocity.multiplyScalar(Math.pow(damping, deltaSeconds * 60));

    player.velocity.x = horizontalVelocity.x;
    player.velocity.z = horizontalVelocity.z;

    const previousPosition = player.mesh.position.clone();

    if (isFloating) {
      const bob = Math.sin(performance.now() * 0.004) * 0.22;
      const targetFloatY = floatRestY + bob;
      const displacement = targetFloatY - player.mesh.position.y;

      const buoyancyStrength = player.buoyancySpring * player.waterBlend;
      const gravityStrength = lerp(player.gravity, player.waterGravity, player.waterBlend);

      player.verticalVelocity += displacement * buoyancyStrength * deltaSeconds;
      player.verticalVelocity -= gravityStrength * deltaSeconds;

      const pushingForward = keys.has("KeyW") || keys.has("ArrowUp");
      const downwardLook = smoothstep(
        THREE.MathUtils.degToRad(40),
        THREE.MathUtils.degToRad(72),
        state.pitch
      );

      if (pushingForward && downwardLook > 0) {
        player.verticalVelocity -= player.swimDiveForce * downwardLook * deltaSeconds;
        player.velocity.addScaledVector(forward, player.swimAcceleration * 0.35 * downwardLook * deltaSeconds);
      }

      const holdingSpace = keys.has("Space");

      if (holdingShift) {
        player.waterDepthOffset = Math.min(
          player.maxWaterDepthOffset,
          player.waterDepthOffset + player.waterDepthAdjustSpeed * deltaSeconds
        );
      }

      if (holdingSpace) {
        player.waterDepthOffset = Math.max(
          0,
          player.waterDepthOffset - player.waterDepthAdjustSpeed * deltaSeconds
        );
      }

      const activelyAdjustingDepth = holdingShift || holdingSpace;
      const activelyDiving = (pushingForward && downwardLook > 0.2) || activelyAdjustingDepth;
      const drag = activelyDiving ? 0.975 : 0.92;
      player.verticalVelocity *= Math.pow(drag, deltaSeconds * 60);
    } else {
      player.verticalVelocity -= player.gravity * deltaSeconds;
    }

    player.mesh.position.x += player.velocity.x * deltaSeconds;
    player.mesh.position.z += player.velocity.z * deltaSeconds;
    player.mesh.position.y += player.verticalVelocity * deltaSeconds;

    const newWaterSurfaceY = getWaterSurfaceHeightAtWorld(player.mesh.position.x, player.mesh.position.z);
    const newIsOnWaterTile = Number.isFinite(newWaterSurfaceY);
    const newTerrainY = getTerrainHeightAtWorld(player.mesh.position.x, player.mesh.position.z);
    const newRubbleY = getRubbleSurfaceHeightAtWorld(player.mesh.position.x, player.mesh.position.z);
    const newLandY = getSolidSurfaceHeightAtWorld(player.mesh.position.x, player.mesh.position.z);
    const landedOnRubble = Number.isFinite(newRubbleY) && newRubbleY >= newTerrainY + 0.05;

    const landRestingY = newLandY + player.radius;
    const waterRestingY = newIsOnWaterTile ? newWaterSurfaceY + player.radius * 0.56 : -Infinity;

    const wasGrounded = player.grounded;

    if (!newIsOnWaterTile && player.mesh.position.y <= landRestingY) {
      const landingImpactSpeed = Math.abs(Math.min(0, player.verticalVelocity));
      const shouldCrackRubbleOnLanding =
        landedOnRubble &&
        player.jumpLandingArmed &&
        !wasGrounded &&
        player.verticalVelocity < -10;

      if (shouldCrackRubbleOnLanding) {
        onRubbleLanding({
          x: player.mesh.position.x,
          z: player.mesh.position.z,
          impactSpeed: landingImpactSpeed
        });
      }

      player.mesh.position.y = landRestingY;

      if (!wasGrounded && player.verticalVelocity < -18) {
        player.bounceTimer = player.bounceDuration;
        audioHandler.playHardLandingPop(landingImpactSpeed);
        player.verticalVelocity = Math.min(18, Math.abs(player.verticalVelocity) * 0.16);
      } else {
        player.verticalVelocity = 0;
      }

      player.grounded = true;
      player.jumpLandingArmed = false;
      player.waterDepthOffset = 0;
    } else if (newIsOnWaterTile) {
      if (player.mesh.position.y <= landRestingY) {
        player.mesh.position.y = landRestingY;
        player.verticalVelocity = Math.max(0, player.verticalVelocity);

        const deepestAllowedOffset = Math.max(
          0,
          newWaterSurfaceY + player.radius * 0.56 - landRestingY
        );
        player.waterDepthOffset = Math.min(player.waterDepthOffset, deepestAllowedOffset);
      }

      const maxFloatY = newWaterSurfaceY + player.radius * 1.35;
      if (player.mesh.position.y > maxFloatY && player.verticalVelocity > 0) {
        player.verticalVelocity *= 0.72;
      }

      player.underwater = player.cameraWaterBlend > 0.58 && player.mesh.position.y < newWaterSurfaceY - player.radius * 0.45;
      player.waterSurfaceY = newWaterSurfaceY;

      player.grounded = false;
    } else {
      player.grounded = false;
    }

    const deltaMove = player.mesh.position.clone().sub(previousPosition);
    deltaMove.y = 0;
    audioHandler.updateRollingDroneAudio(deltaMove.length() / Math.max(deltaSeconds, 0.0001), player.grounded, sprintingOnLand, player.inWater);

    if (deltaMove.lengthSq() > 0.0001) {
      const rollAxis = new THREE.Vector3(deltaMove.z, 0, -deltaMove.x).normalize();
      const rollSpeedMultiplier = sprintingOnLand ? 1.22 : 1;
      const rollAngle = (deltaMove.length() / player.radius) * rollSpeedMultiplier;
      player.mesh.rotateOnWorldAxis(rollAxis, rollAngle);
    }

    if (player.launchStretchTimer > 0) {
      player.launchStretchTimer = Math.max(0, player.launchStretchTimer - deltaSeconds);
      const t = player.launchStretchTimer / player.launchStretchDuration;
      const stretch = Math.sin(t * Math.PI) * player.launchStretchAmount;

      player.mesh.scale.set(
        1 - stretch * 0.35,
        1 + stretch,
        1 - stretch * 0.35
      );
    } else if (isFloating) {
      const bobSquish = Math.sin(performance.now() * 0.006) * 0.035;
      player.mesh.scale.set(
        1 + bobSquish,
        1 - bobSquish * 0.8,
        1 + bobSquish
      );
      player.bounceTimer = 0;
    } else if (player.bounceTimer > 0) {
      player.bounceTimer = Math.max(0, player.bounceTimer - deltaSeconds);
      const t = player.bounceTimer / player.bounceDuration;
      const squash = Math.sin(t * Math.PI) * player.bounceAmount;

      player.mesh.scale.set(
        1 + squash * 0.45,
        1 - squash,
        1 + squash * 0.45
      );
    } else {
      player.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.25);
    }

    state.target.x = player.mesh.position.x;
    state.target.z = player.mesh.position.z;
    updateChunks();
  }

  function handleMovement(deltaSeconds) {
    if (getIsThirdPersonMode()) {
      updateThirdPersonPlayer(deltaSeconds);

      if (keys.has("KeyQ")) {
        state.yaw += state.keyRotateSpeed * deltaSeconds;
      }

      if (keys.has("KeyE")) {
        state.yaw -= state.keyRotateSpeed * deltaSeconds;
      }

      return;
    }

    const { forward, right } = getForwardRightVectors();
    const movement = new THREE.Vector3();

    if (keys.has("KeyW") || keys.has("ArrowUp")) movement.add(forward);
    if (keys.has("KeyS") || keys.has("ArrowDown")) movement.sub(forward);
    if (keys.has("KeyD") || keys.has("ArrowRight")) movement.add(right);
    if (keys.has("KeyA") || keys.has("ArrowLeft")) movement.sub(right);

    if (movement.lengthSq() > 0) {
      movement.normalize();
      const speed = state.moveSpeed * Math.max(0.65, state.distance / 360);
      state.target.addScaledVector(movement, speed * deltaSeconds);
      updateChunks();
    }

    if (keys.has("KeyQ")) {
      state.yaw += state.keyRotateSpeed * deltaSeconds;
    }

    if (keys.has("KeyE")) {
      state.yaw -= state.keyRotateSpeed * deltaSeconds;
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn("Fullscreen toggle failed:", error);
    }
  }

  function attachInputListeners() {
    canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 0 && handleFlattenedTreeClick(event)) {
        event.preventDefault();
        if (!canvas.hasPointerCapture(event.pointerId)) {
          canvas.setPointerCapture(event.pointerId);
        }
        return;
      }

      if (event.button === 0 && handleStaticRubbleClick(event)) {
        event.preventDefault();
        if (!canvas.hasPointerCapture(event.pointerId)) {
          canvas.setPointerCapture(event.pointerId);
        }
        return;
      }

      if (event.button === 0 && handleLooseRubbleClick(event)) {
        event.preventDefault();
        if (!canvas.hasPointerCapture(event.pointerId)) {
          canvas.setPointerCapture(event.pointerId);
        }
        return;
      }

      if (event.button === 0 && handleInventoryRubbleFire(event)) {
        event.preventDefault();
        return;
      }

      if (event.button === 1 || event.button === 2) {
        event.preventDefault();
        state.dragging = true;
        state.lastPointerX = event.clientX;
        state.lastPointerY = event.clientY;
        canvas.classList.add("dragging");
        canvas.setPointerCapture(event.pointerId);
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      const hoveringFlattenedTree = Boolean(updateFlattenedTreeHover?.(event));
      const hoveringLooseRubble = Boolean(updateLooseRubbleHover?.(event));
      const hoveringClickableStaticRubble = Boolean(updateStaticRubbleHover?.(event));
      canvas.classList.toggle("clickable-tree", (hoveringFlattenedTree || hoveringLooseRubble || hoveringClickableStaticRubble) && !state.dragging);

      if (!state.dragging) return;

      const deltaX = event.clientX - state.lastPointerX;
      const deltaY = event.clientY - state.lastPointerY;

      state.lastPointerX = event.clientX;
      state.lastPointerY = event.clientY;

      state.yaw -= deltaX * state.rotateSpeed;
      state.pitch += deltaY * state.rotateSpeed;
      state.pitch = THREE.MathUtils.clamp(
        state.pitch,
        THREE.MathUtils.degToRad(getIsThirdPersonMode() ? 14 : 4),
        THREE.MathUtils.degToRad(getIsThirdPersonMode() ? 72 : 86)
      );
    });

    canvas.addEventListener("pointerup", (event) => {
      cancelFlattenedTreeClickHold?.(event.pointerId ?? null);
      cancelStaticRubbleClickHold?.(event.pointerId ?? null);
      cancelLooseRubbleClickHold?.(event.pointerId ?? null);
      state.dragging = false;
      canvas.classList.remove("dragging");

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    });

    canvas.addEventListener("pointercancel", () => {
      cancelFlattenedTreeClickHold?.();
      cancelStaticRubbleClickHold?.();
      cancelLooseRubbleClickHold?.();
      state.dragging = false;
      canvas.classList.remove("dragging");
      canvas.classList.remove("clickable-tree");
      updateFlattenedTreeHover?.(null);
      updateLooseRubbleHover?.(null);
    });

    canvas.addEventListener("pointerleave", () => {
      cancelFlattenedTreeClickHold?.();
      cancelStaticRubbleClickHold?.();
      cancelLooseRubbleClickHold?.();
      canvas.classList.remove("clickable-tree");
      updateFlattenedTreeHover?.(null);
      updateLooseRubbleHover?.(null);
    });

    window.addEventListener("wheel", (event) => {
      if (minimap.contains(event.target)) {
        return;
      }

      event.preventDefault();

      const zoomFactor = 1 + event.deltaY * state.zoomSpeed;
      state.distance = THREE.MathUtils.clamp(
        state.distance * zoomFactor,
        getIsThirdPersonMode() ? firstPersonZoomDistance : state.minDistance,
        getIsThirdPersonMode() ? 150 : state.maxDistance
      );
      syncPlayerMeshVisibility();
    }, { passive: false });

    window.addEventListener("keydown", (event) => {
      keys.add(event.code);
      audioHandler.ensureBallAudio();

      if (event.code === "KeyI" && !isTextEntryTarget(event.target)) {
        event.preventDefault();
        toggleBushInventory();
      }

      if (event.code === "Escape") {
        if (getActiveBushCarryCount() > 0) {
          cancelBushCarryToLeftmostSlot();
          return;
        }
        hud.classList.toggle("hidden");
      }

      if (event.code === "KeyR") {
        resetCamera();
      }

      if (event.code === "KeyF") {
        toggleFullscreen();
        event.preventDefault();
      }

      if (
        getIsThirdPersonMode() &&
        event.code === "Space" &&
        player.mesh &&
        player.grounded &&
        !player.inWater
      ) {
        const sprintJump = keys.has("ShiftLeft") || keys.has("ShiftRight");
        player.verticalVelocity = player.jumpVelocity * (sprintJump ? player.sprintJumpMultiplier : 1);
        player.jumpLandingArmed = true;
        audioHandler.playSpringSound(sprintJump ? 1 : 0.68);

        if (sprintJump) {
          const { forward } = getForwardRightVectors();
          player.velocity.addScaledVector(forward, player.maxSpeed * 0.78);
          player.launchStretchTimer = player.launchStretchDuration;
        }

        player.grounded = false;
        player.bounceTimer = 0;
        event.preventDefault();
      }

      if (
        getIsThirdPersonMode() &&
        event.code === "Space" &&
        player.mesh &&
        player.inWater
      ) {
        event.preventDefault();
      }

      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)
      ) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      keys.delete(event.code);
    });

    window.addEventListener("pointerdown", () => {
      audioHandler.ensureBallAudio();
    }, { passive: true });

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  return {
    attachInputListeners,
    getForwardRightVectors,
    handleMovement,
    resetCamera,
    switchCameraMode,
    syncModeReadout,
    updateCameraPosition,
    updateTargetHeight
  };
}


export function createSurfaceObjects({
  THREE,
  scene,
  renderer,
  camera,
  player,
  deletedTreeKeys,
  saveDeletedTreeKeys,
  getShowGridLines,
  getHideTrees,
  getAudioHandler = () => null,
  getTerrainHeightAtWorld = () => 0,
  tileSize = 4,
  rubbleMaterial = null,
  getIsLeftControlRubbleAbsorbActive = () => false,
  onTreeDeleted = () => {},
  onRubbleCollected = () => {}
}) {
  const treeSprites = new Set();
  const treeColliders = new Map();
  const treeHitboxGridObjects = new Set();
  const flattenedTreeClickTargets = new Set();
  const looseRubbleEntities = new Set();
  const looseRubbleClickTargets = new Set();
  const treeClickRaycaster = new THREE.Raycaster();
  const treeClickPointer = new THREE.Vector2();
  const looseRubbleBounds = new THREE.Box3();
  const looseRubbleVisualBoundsScratch = new THREE.Box3();
  const looseRubbleFallbackSize = new THREE.Vector3();
  const looseRubbleSize = new THREE.Vector3();
  const looseRubbleCenter = new THREE.Vector3();
  const looseRubblePushDirection = new THREE.Vector3();
  const rubbleProjectileRayDirection = new THREE.Vector3();
  const rubbleProjectileDefaultMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b8177,
    roughness: 0.94,
    metalness: 0.02
  });
  const treeHoldState = {
    collider: null,
    pointerId: null,
    elapsed: 0,
    duration: 0
  };
  const rubbleHoldState = {
    entity: null,
    pointerId: null,
    elapsed: 0,
    duration: 0,
    pickupVelocity: new THREE.Vector3()
  };
  const leftControlRubbleAbsorbStates = new Map();
  const interactionTileSize = Math.max(0.001, Number(tileSize) || 4);

  function isPointWithinPlayerTileRadius(x, z, radiusTiles) {
    if (!player?.mesh) return false;
    const radiusWorld = Math.max(0, Number(radiusTiles) || 0) * interactionTileSize;
    const dx = x - player.mesh.position.x;
    const dz = z - player.mesh.position.z;
    return dx * dx + dz * dz <= radiusWorld * radiusWorld;
  }

  function isTreeColliderWithinPlayerTileRadius(collider, radiusTiles) {
    if (!collider) return false;
    const x = ((Number(collider.xMin) || 0) + (Number(collider.xMax) || 0)) * 0.5;
    const z = ((Number(collider.zMin) || 0) + (Number(collider.zMax) || 0)) * 0.5;
    return isPointWithinPlayerTileRadius(x, z, radiusTiles);
  }

  function isLooseRubbleWithinPlayerTileRadius(entity, radiusTiles) {
    if (!entity) return false;
    return isPointWithinPlayerTileRadius(entity.position.x, entity.position.z, radiusTiles);
  }

  function createRubblePickupState(entity) {
    const pickupVelocity = new THREE.Vector3();
    const currentVelocity = entity?.userData?.rubbleRagdollVelocity;
    if (currentVelocity && typeof currentVelocity.x === "number") {
      pickupVelocity.copy(currentVelocity).multiplyScalar(0.35);
    }
    return {
      elapsed: 0,
      duration: entity?.userData?.rubblePickupDuration || 0.72,
      pickupVelocity,
      startScale: entity?.userData?.rubbleRagdollScale || 1
    };
  }

  function updateRubblePickupMotion(entity, pickupState, deltaSeconds = 0) {
    if (!entity || !pickupState) return 1;

    pickupState.elapsed += deltaSeconds;
    const holdDuration = Math.max(0.001, pickupState.duration || 0.72);
    const t = Math.min(1, pickupState.elapsed / holdDuration);
    const eased = 1 - Math.pow(1 - t, 3);
    const startScale = pickupState.startScale || entity.userData.rubblePickupStartScale || entity.userData.rubbleRagdollScale || 1;
    applyLooseRubbleVisualScale(entity, THREE.MathUtils.lerp(startScale, 0.02, eased));

    if (player?.mesh) {
      const pickupVelocity = pickupState.pickupVelocity || (pickupState.pickupVelocity = new THREE.Vector3());
      const targetX = player.mesh.position.x;
      const targetY = player.mesh.position.y;
      const targetZ = player.mesh.position.z;
      const dx = targetX - entity.position.x;
      const dy = targetY - entity.position.y;
      const dz = targetZ - entity.position.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dist > 0.001) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        const dirZ = dz / dist;
        const remaining = Math.max(0.018, holdDuration - pickupState.elapsed);
        const acceleration = THREE.MathUtils.clamp(38 + dist * 20, 54, 320);
        pickupVelocity.x += dirX * acceleration * deltaSeconds;
        pickupVelocity.y += dirY * acceleration * deltaSeconds;
        pickupVelocity.z += dirZ * acceleration * deltaSeconds;

        const projectedSpeed = pickupVelocity.x * dirX + pickupVelocity.y * dirY + pickupVelocity.z * dirZ;
        const requiredClosingSpeed = Math.min(180, (dist / remaining) * 1.18);
        if (projectedSpeed < requiredClosingSpeed) {
          const boost = requiredClosingSpeed - projectedSpeed;
          pickupVelocity.x += dirX * boost;
          pickupVelocity.y += dirY * boost;
          pickupVelocity.z += dirZ * boost;
        }

        const speed = Math.hypot(pickupVelocity.x, pickupVelocity.y, pickupVelocity.z);
        const maxSpeed = THREE.MathUtils.clamp(42 + dist * 12, 58, 220);
        if (speed > maxSpeed) {
          pickupVelocity.multiplyScalar(maxSpeed / speed);
        }

        entity.position.x += pickupVelocity.x * deltaSeconds;
        entity.position.y += pickupVelocity.y * deltaSeconds;
        entity.position.z += pickupVelocity.z * deltaSeconds;

        const closeSnap = Math.min(1, deltaSeconds * (dist < 3 ? 18 : 6));
        if (dist < 3.25 || remaining < 0.18) {
          entity.position.x = THREE.MathUtils.lerp(entity.position.x, targetX, closeSnap);
          entity.position.y = THREE.MathUtils.lerp(entity.position.y, targetY, closeSnap);
          entity.position.z = THREE.MathUtils.lerp(entity.position.z, targetZ, closeSnap);
        }

        const spinKick = Math.min(8, speed * 0.055);
        entity.rotation.x += spinKick * deltaSeconds;
        entity.rotation.y += spinKick * 0.72 * deltaSeconds;
        entity.rotation.z -= spinKick * 0.48 * deltaSeconds;
      }
    }

    return t;
  }

  function getTreeColliderKey(globalX, globalZ) {
    return `${globalX},${globalZ}`;
  }

  function isTreeColliderActive(collider) {
    return Boolean(collider && collider.sprite && collider.sprite.parent && collider.sprite.visible);
  }

  /*
    Tree colliders are kept only as debug/display hitboxes for Show Grid.
    They intentionally do not affect player movement; the sphere clips through trees.
  */


  function setLooseRubbleVisualBounds(entity, targetBox) {
    if (!entity || !targetBox) return targetBox;

    targetBox.makeEmpty();
    entity.updateMatrixWorld(true);

    entity.traverse((child) => {
      if (!child || !child.isMesh || child.userData?.isRubbleRagdollHelper) return;
      if (!child.geometry) return;
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      if (!child.geometry.boundingBox) return;
      looseRubbleVisualBoundsScratch.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);
      targetBox.union(looseRubbleVisualBoundsScratch);
    });

    if (targetBox.isEmpty()) {
      const radius = Math.max(1, entity.userData.rubbleRagdollRadius || 2.4);
      const height = Math.max(0.6, entity.userData.rubbleRagdollHeight || 2.0);
      looseRubbleFallbackSize.set(radius * 2, height, radius * 2);
      targetBox.setFromCenterAndSize(entity.position, looseRubbleFallbackSize);
    }

    return targetBox;
  }

  function applyLooseRubbleVisualScale(entity, scale = 1) {
    if (!entity) return;
    entity.userData.rubbleRagdollScale = scale;
    entity.scale.setScalar(scale);
  }

  function createProjectileRubbleVisual() {
    const group = new THREE.Group();
    const material = rubbleMaterial || rubbleProjectileDefaultMaterial;
    const chunks = [
      { size: [1.35, 0.9, 1.15], pos: [0, 0.2, 0], rot: [0.18, 0.25, -0.1] },
      { size: [0.95, 0.7, 0.85], pos: [0.78, 0.42, -0.18], rot: [-0.2, -0.35, 0.28] },
      { size: [0.8, 0.55, 0.9], pos: [-0.62, 0.34, 0.38], rot: [0.32, 0.18, -0.36] },
      { size: [0.65, 0.48, 0.58], pos: [0.04, 0.78, 0.56], rot: [-0.42, 0.6, 0.22] }
    ];

    for (const chunk of chunks) {
      const geometry = new THREE.BoxGeometry(...chunk.size);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...chunk.pos);
      mesh.rotation.set(...chunk.rot);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.rubbleProjectileMesh = true;
      group.add(mesh);
    }

    return group;
  }

  function fireRubbleProjectile(origin, direction, speed = 118) {
    if (!origin || !direction) return null;
    rubbleProjectileRayDirection.copy(direction);
    if (rubbleProjectileRayDirection.lengthSq() <= 0.0001) return null;
    rubbleProjectileRayDirection.normalize();

    const projectile = createProjectileRubbleVisual();
    projectile.position.copy(origin).addScaledVector(rubbleProjectileRayDirection, Math.max(1.5, (player?.radius || 1.9) + 1.2));
    projectile.userData.isLooseRubbleRagdoll = true;
    projectile.userData.isRubbleProjectile = true;
    projectile.userData.rubbleRagdollVelocity = rubbleProjectileRayDirection.clone().multiplyScalar(Math.max(18, Number(speed) || 118));
    projectile.userData.rubbleRagdollAngularVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 12
    );
    projectile.userData.rubbleRagdollRadius = Math.max(0.9, (player?.radius || 1.9) * 0.72);
    projectile.userData.rubbleRagdollHeight = Math.max(0.8, (player?.radius || 1.9) * 0.8);
    projectile.userData.rubbleRagdollScale = 1;
    projectile.userData.rubbleRagdollFloorPadding = -9999;
    projectile.userData.spawnedAt = performance.now();

    scene.add(projectile);
    looseRubbleEntities.add(projectile);
    return projectile;
  }

  function registerLooseRubbleEntity(entity) {
    if (!entity) return null;

    entity.userData.isLooseRubbleRagdoll = true;
    entity.userData.isHovered = false;
    entity.userData.rubbleRagdollScale = entity.userData.rubbleRagdollScale || 1;
    entity.userData.rubbleRagdollTargetScale = 1;
    entity.userData.rubbleHoverScale = entity.userData.rubbleHoverScale || 1.07;
    entity.userData.rubblePickupDuration = entity.userData.rubblePickupDuration || 0.72;
    entity.userData.rubbleRagdollVelocity = entity.userData.rubbleRagdollVelocity || new THREE.Vector3();
    entity.userData.rubbleRagdollAngularVelocity = entity.userData.rubbleRagdollAngularVelocity || new THREE.Vector3();
    entity.userData.rubbleRagdollRadius = entity.userData.rubbleRagdollRadius || 2.4;
    entity.userData.rubbleRagdollHeight = entity.userData.rubbleRagdollHeight || 2.0;
    entity.userData.rubbleRagdollGrounded = true;
    entity.userData.rubbleRagdollFloorPadding = 0.045;
    entity.userData.lastHitmarkerAt = 0;

    const radius = Math.max(1, entity.userData.rubbleRagdollRadius);
    const height = Math.max(0.6, entity.userData.rubbleRagdollHeight);

    const hitTarget = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 2.0, height + 0.4, radius * 2.0),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.001,
        depthWrite: false
      })
    );
    hitTarget.position.set(0, height * 0.5, 0);
    hitTarget.userData.rubbleEntityKey = entity.userData.rubbleKey || `loose-rubble-${Date.now()}-${Math.random()}`;
    hitTarget.userData.isRubbleRagdollHelper = true;
    hitTarget.renderOrder = 10;
    entity.userData.rubbleHitTarget = hitTarget;
    entity.add(hitTarget);

    entity.userData.rubbleHoverUnderlay = null;

    looseRubbleEntities.add(entity);
    looseRubbleClickTargets.add(hitTarget);
    return entity;
  }

  function removeLooseRubbleEntity(entity, collect = false) {
    if (!entity) return false;

    if (rubbleHoldState.entity === entity) {
      rubbleHoldState.entity = null;
      rubbleHoldState.pointerId = null;
      rubbleHoldState.elapsed = 0;
      rubbleHoldState.duration = 0;
      rubbleHoldState.pickupVelocity.set(0, 0, 0);
      getAudioHandler?.()?.cancelTreeDeleteHoldWoop?.();
    }
    leftControlRubbleAbsorbStates.delete(entity);

    const hitTarget = entity.userData.rubbleHitTarget;
    if (hitTarget) looseRubbleClickTargets.delete(hitTarget);
    looseRubbleEntities.delete(entity);

    if (entity.parent) entity.parent.remove(entity);
    entity.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material && child.userData && (child.userData.rubbleEntityKey || child.userData.isRubbleRagdollHelper)) {
        child.material.dispose();
      }
    });

    if (collect) onRubbleCollected({ entity });
    return true;
  }

  function updateLooseRubbleEntities(deltaSeconds = 0) {
    for (const entity of [...looseRubbleEntities]) {
      if (!entity || !entity.parent) {
        looseRubbleEntities.delete(entity);
        continue;
      }

      if (entity.userData?.isRubbleProjectile) {
        const velocity = entity.userData.rubbleRagdollVelocity || new THREE.Vector3();
        const angularVelocity = entity.userData.rubbleRagdollAngularVelocity || new THREE.Vector3();
        const safeDelta = Math.min(0.05, Math.max(0, deltaSeconds || 0));
        entity.position.addScaledVector(velocity, safeDelta);
        entity.rotation.x += angularVelocity.x * safeDelta;
        entity.rotation.y += angularVelocity.y * safeDelta;
        entity.rotation.z += angularVelocity.z * safeDelta;

        const terrainY = getTerrainHeightAtWorld(entity.position.x, entity.position.z);
        const ageMs = performance.now() - (Number(entity.userData.spawnedAt) || 0);
        if (entity.position.y < terrainY - 0.35 || ageMs > 8000) {
          removeLooseRubbleEntity(entity, false);
        }
        continue;
      }

      if (rubbleHoldState.entity === entity) {
        const pickupState = {
          elapsed: rubbleHoldState.elapsed,
          duration: rubbleHoldState.duration,
          pickupVelocity: rubbleHoldState.pickupVelocity,
          startScale: entity.userData.rubblePickupStartScale || entity.userData.rubbleRagdollScale || 1
        };
        const t = updateRubblePickupMotion(entity, pickupState, deltaSeconds);
        rubbleHoldState.elapsed = pickupState.elapsed;
        rubbleHoldState.duration = pickupState.duration;
        rubbleHoldState.pickupVelocity.copy(pickupState.pickupVelocity);

        getAudioHandler?.()?.updateTreeDeleteHoldWoop?.(t);
        if (entity.userData.rubbleHoverUnderlay) entity.userData.rubbleHoverUnderlay.visible = false;

        if (t >= 1) {
          getAudioHandler?.()?.finishTreeDeleteHoldWoop?.();
          removeLooseRubbleEntity(entity, true);
        }
        continue;
      }

      const leftControlAbsorbActive = Boolean(getIsLeftControlRubbleAbsorbActive?.());
      const existingLeftControlAbsorbState = leftControlRubbleAbsorbStates.get(entity);
      const inLeftControlAbsorbRange = isLooseRubbleWithinPlayerTileRadius(entity, 5);

      if (leftControlAbsorbActive && (existingLeftControlAbsorbState || inLeftControlAbsorbRange)) {
        const pickupState = existingLeftControlAbsorbState || createRubblePickupState(entity);
        if (!existingLeftControlAbsorbState) {
          entity.userData.rubblePickupStartScale = pickupState.startScale;
          entity.userData.isHovered = false;
          if (entity.userData.rubbleHoverUnderlay) entity.userData.rubbleHoverUnderlay.visible = false;
          leftControlRubbleAbsorbStates.set(entity, pickupState);
        }

        const t = updateRubblePickupMotion(entity, pickupState, deltaSeconds);
        if (t >= 1) {
          leftControlRubbleAbsorbStates.delete(entity);
          removeLooseRubbleEntity(entity, true);
        }
        continue;
      }

      if ((!leftControlAbsorbActive || !inLeftControlAbsorbRange) && existingLeftControlAbsorbState) {
        leftControlRubbleAbsorbStates.delete(entity);
        applyLooseRubbleVisualScale(entity, 1);
      }

      const velocity = entity.userData.rubbleRagdollVelocity || new THREE.Vector3();
      const angularVelocity = entity.userData.rubbleRagdollAngularVelocity || new THREE.Vector3();
      const radius = Math.max(1, entity.userData.rubbleRagdollRadius || 2.4);
      const playerRadius = player?.radius || 1.9;

      if (player?.mesh) {
        const dx = entity.position.x - player.mesh.position.x;
        const dz = entity.position.z - player.mesh.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = radius + playerRadius;

        setLooseRubbleVisualBounds(entity, looseRubbleBounds);
        const entityBottomY = looseRubbleBounds.min.y;
        const entityTopY = looseRubbleBounds.max.y;
        const playerBottomY = player.mesh.position.y - playerRadius;
        const playerTopY = player.mesh.position.y + playerRadius;
        const verticalOverlap = playerBottomY <= entityTopY + 0.55 && playerTopY >= entityBottomY - 0.55;

        if (distSq > 0.0001 && distSq < minDist * minDist && verticalOverlap) {
          const dist = Math.sqrt(distSq);
          looseRubblePushDirection.set(dx / dist, 0, dz / dist);
          const playerHorizontalSpeed = Math.max(12, Math.hypot(player.velocity?.x || 0, player.velocity?.z || 0));
          const overlapNudge = Math.max(0, minDist - dist);
          velocity.addScaledVector(looseRubblePushDirection, playerHorizontalSpeed * 0.09);
          entity.position.addScaledVector(looseRubblePushDirection, overlapNudge * 0.24);
          angularVelocity.x += looseRubblePushDirection.z * playerHorizontalSpeed * 0.02;
          angularVelocity.z -= looseRubblePushDirection.x * playerHorizontalSpeed * 0.02;

          const playerVerticalVelocity = Number(player.verticalVelocity) || 0;
          const playerIsLaunchingUp = playerVerticalVelocity > 6 && playerBottomY < entityTopY + 0.9;
          const playerIsStompingDown = playerVerticalVelocity < -10 && playerBottomY <= entityTopY + 0.35;
          if (playerIsLaunchingUp || playerIsStompingDown) {
            const launchImpulse = playerIsLaunchingUp
              ? Math.min(28, playerVerticalVelocity * 0.68 + 8)
              : Math.min(18, Math.abs(playerVerticalVelocity) * 0.24 + 5);
            velocity.y = Math.max(velocity.y, launchImpulse);
            entity.userData.rubbleRagdollGrounded = false;
            angularVelocity.x += looseRubblePushDirection.z * launchImpulse * 0.08;
            angularVelocity.y += (Math.random() - 0.5) * launchImpulse * 0.12;
            angularVelocity.z -= looseRubblePushDirection.x * launchImpulse * 0.08;
          }

          const now = performance.now();
          if (now - (entity.userData.lastHitmarkerAt || 0) > 90) {
            getAudioHandler?.()?.playRubbleHitmarker?.(0.33);
            entity.userData.lastHitmarkerAt = now;
          }
        }
      }

      const gravity = Math.max(60, (Number(player?.gravity) || 72) * 0.92);
      const safeDelta = Math.min(0.05, Math.max(0, deltaSeconds || 0));
      const subSteps = Math.max(1, Math.min(8, Math.ceil(safeDelta / 0.0065)));
      const stepDelta = safeDelta / subSteps;
      const floorPadding = entity.userData.rubbleRagdollFloorPadding || 0.045;
      let touchedGroundThisFrame = false;

      for (let stepIndex = 0; stepIndex < subSteps; stepIndex += 1) {
        velocity.y -= gravity * stepDelta;
        velocity.x *= Math.pow(0.90, stepDelta * 60);
        velocity.z *= Math.pow(0.90, stepDelta * 60);
        angularVelocity.multiplyScalar(Math.pow(0.935, stepDelta * 60));

        entity.position.x += velocity.x * stepDelta;
        entity.position.y += velocity.y * stepDelta;
        entity.position.z += velocity.z * stepDelta;
        entity.rotation.x += angularVelocity.x * stepDelta;
        entity.rotation.y += angularVelocity.y * stepDelta;
        entity.rotation.z += angularVelocity.z * stepDelta;

        const sampleRadius = Math.max(0.35, radius * 0.34);
        const floorY = Math.max(
          getTerrainHeightAtWorld(entity.position.x, entity.position.z),
          getTerrainHeightAtWorld(entity.position.x + sampleRadius, entity.position.z),
          getTerrainHeightAtWorld(entity.position.x - sampleRadius, entity.position.z),
          getTerrainHeightAtWorld(entity.position.x, entity.position.z + sampleRadius),
          getTerrainHeightAtWorld(entity.position.x, entity.position.z - sampleRadius)
        );

        setLooseRubbleVisualBounds(entity, looseRubbleBounds);
        if (looseRubbleBounds.min.y < floorY + floorPadding) {
          const lift = floorY + floorPadding - looseRubbleBounds.min.y;
          entity.position.y += lift;
          touchedGroundThisFrame = true;

          if (velocity.y < -14) {
            velocity.y = Math.min(10, Math.abs(velocity.y) * 0.14);
            angularVelocity.x += velocity.z * 0.045;
            angularVelocity.z -= velocity.x * 0.045;
          } else if (velocity.y < 0) {
            velocity.y = 0;
          }

          velocity.x *= Math.pow(0.82, stepDelta * 60);
          velocity.z *= Math.pow(0.82, stepDelta * 60);
        }
      }

      entity.userData.rubbleRagdollGrounded = touchedGroundThisFrame;

      const targetScale = entity.userData.isHovered ? entity.userData.rubbleHoverScale || 1.07 : 1;
      entity.userData.rubbleRagdollTargetScale = targetScale;
      const nextScale = THREE.MathUtils.lerp(entity.userData.rubbleRagdollScale || 1, targetScale, Math.min(1, deltaSeconds * 12));
      applyLooseRubbleVisualScale(entity, nextScale);
    }
  }

  function getLooseRubbleEntityFromEvent(event) {
    if (!event || looseRubbleClickTargets.size === 0) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    treeClickPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    treeClickPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    treeClickRaycaster.setFromCamera(treeClickPointer, camera);

    const clickableRubble = [...looseRubbleClickTargets].filter((target) => target.visible && target.parent);
    const hits = treeClickRaycaster.intersectObjects(clickableRubble, false);
    const hit = hits.find((item) => item.object && item.object.parent && item.object.parent.userData?.isLooseRubbleRagdoll);
    const entity = hit ? hit.object.parent : null;
    return entity && isLooseRubbleWithinPlayerTileRadius(entity, 10) ? entity : null;
  }

  function setLooseRubbleHovered(entity, hovered) {
    if (!entity) return;
    entity.userData.isHovered = Boolean(hovered) && rubbleHoldState.entity !== entity;
    if (entity.userData.rubbleHoverUnderlay) {
      entity.userData.rubbleHoverUnderlay.visible = entity.userData.isHovered;
    }
  }

  function updateLooseRubbleHover(event) {
    const hoveredEntity = getLooseRubbleEntityFromEvent(event);

    for (const entity of looseRubbleEntities) {
      if (entity.userData.isHovered && entity !== hoveredEntity) {
        setLooseRubbleHovered(entity, false);
      }
    }

    if (hoveredEntity) {
      setLooseRubbleHovered(hoveredEntity, true);
      return hoveredEntity;
    }

    return null;
  }

  function handleLooseRubbleClick(event) {
    if (event.button !== 0 || looseRubbleClickTargets.size === 0) return false;
    const entity = getLooseRubbleEntityFromEvent(event);
    if (!entity) return false;

    rubbleHoldState.entity = entity;
    rubbleHoldState.pointerId = event.pointerId ?? null;
    rubbleHoldState.elapsed = 0;
    rubbleHoldState.duration = entity.userData.rubblePickupDuration || 0.72;
    rubbleHoldState.pickupVelocity.set(0, 0, 0);
    const currentVelocity = entity.userData.rubbleRagdollVelocity;
    if (currentVelocity && typeof currentVelocity.x === "number") {
      rubbleHoldState.pickupVelocity.copy(currentVelocity).multiplyScalar(0.35);
    }
    entity.userData.rubblePickupStartScale = entity.userData.rubbleRagdollScale || 1;
    entity.userData.isHovered = false;
    if (entity.userData.rubbleHoverUnderlay) entity.userData.rubbleHoverUnderlay.visible = false;
    getAudioHandler?.()?.startTreeDeleteHoldWoop?.(rubbleHoldState.duration);
    return true;
  }

  function cancelLooseRubbleClickHold(pointerId = null) {
    const heldEntity = rubbleHoldState.entity;
    if (!heldEntity) return false;
    if (pointerId !== null && rubbleHoldState.pointerId !== null && rubbleHoldState.pointerId !== pointerId) return false;

    rubbleHoldState.entity = null;
    rubbleHoldState.pointerId = null;
    rubbleHoldState.elapsed = 0;
    rubbleHoldState.duration = 0;
    rubbleHoldState.pickupVelocity.set(0, 0, 0);
    getAudioHandler?.()?.cancelTreeDeleteHoldWoop?.();
    if (looseRubbleEntities.has(heldEntity)) {
      heldEntity.userData.isHovered = false;
      applyLooseRubbleVisualScale(heldEntity, 1);
      if (heldEntity.userData.rubbleHoverUnderlay) heldEntity.userData.rubbleHoverUnderlay.visible = false;
    }
    return true;
  }

  function applyFlattenedTreeVisualScale(collider, scale = 1) {
    if (!collider) return;

    collider.flatVisualScale = scale;

    if (collider.flatVisualGroup) {
      collider.flatVisualGroup.scale.setScalar(scale);
    }
  }

  function setTreeFlattened(collider, flattened) {
    if (!collider || !collider.sprite) return;

    collider.isFlattened = flattened;
    collider.restoreTimer = 0;
    collider.isCollapsing = false;
    collider.collapseElapsed = 0;
    collider.collapseStartScale = collider.flatVisualScale || 1;

    if (!flattened) {
      collider.isHovered = false;
      collider.flatVisualTargetScale = 1;
      if (treeHoldState.collider === collider) {
        treeHoldState.collider = null;
        treeHoldState.pointerId = null;
        treeHoldState.elapsed = 0;
        treeHoldState.duration = 0;
      }
    } else {
      collider.flatVisualTargetScale = collider.isHovered ? collider.flatHoverScale || 1.07 : 1;
    }

    applyFlattenedTreeVisualScale(collider, 1);

    if (collider.uprightGroup) {
      collider.uprightGroup.visible = !flattened;
    }

    if (collider.flatSprite) {
      collider.flatSprite.visible = flattened;
    }

    if (collider.flatDirtWallGroup) {
      collider.flatDirtWallGroup.visible = flattened;
    }

    if (collider.flatVisualGroup) {
      collider.flatVisualGroup.visible = flattened;
    }

    if (collider.flatHitTarget) {
      collider.flatHitTarget.visible = flattened;
    }

    if (collider.flatHoverUnderlay) {
      collider.flatHoverUnderlay.visible = flattened && Boolean(collider.isHovered);
    }
  }

  function restoreFlattenedTree(collider) {
    if (!collider || !collider.isFlattened) return;
    setTreeFlattened(collider, false);
  }

  function doesPlayerTouchTreeCollider(collider) {
    if (!player.mesh || !isTreeColliderActive(collider)) return false;

    const x = player.mesh.position.x;
    const z = player.mesh.position.z;
    const closestX = THREE.MathUtils.clamp(x, collider.xMin, collider.xMax);
    const closestZ = THREE.MathUtils.clamp(z, collider.zMin, collider.zMax);
    const dx = x - closestX;
    const dz = z - closestZ;

    return dx * dx + dz * dz <= player.radius * player.radius;
  }

  function updateTreeFlattening(deltaSeconds = 0) {
    const restoreDelaySeconds = 30;

    for (const collider of treeColliders.values()) {
      if (!isTreeColliderActive(collider)) continue;

      if (treeHoldState.collider === collider) {
        treeHoldState.elapsed += deltaSeconds;
        const holdDuration = Math.max(0.001, treeHoldState.duration || ((collider.collapseDuration || 0.24) * 3));
        const t = Math.min(1, treeHoldState.elapsed / holdDuration);
        const eased = 1 - Math.pow(1 - t, 3);
        const startScale = collider.collapseStartScale || collider.flatVisualScale || (collider.flatHoverScale || 1.07);
        const heldScale = THREE.MathUtils.lerp(startScale, 0.02, eased);
        applyFlattenedTreeVisualScale(collider, heldScale);
        getAudioHandler?.()?.updateTreeDeleteHoldWoop?.(t);

        if (collider.flatHoverUnderlay) {
          collider.flatHoverUnderlay.visible = false;
        }

        if (t >= 1) {
          treeHoldState.collider = null;
          treeHoldState.pointerId = null;
          treeHoldState.elapsed = 0;
          treeHoldState.duration = 0;
          getAudioHandler?.()?.finishTreeDeleteHoldWoop?.();
          removeTreeCollider(collider, true);
        }
        continue;
      }

      const playerIsTouching = doesPlayerTouchTreeCollider(collider);

      if (playerIsTouching) {
        if (!collider.isFlattened) {
          setTreeFlattened(collider, true);
          getAudioHandler?.()?.playTreeFlattenCrack?.();
        } else {
          collider.restoreTimer = 0;
        }
      } else if (collider.isFlattened) {
        collider.restoreTimer += deltaSeconds;

        if (collider.restoreTimer >= restoreDelaySeconds) {
          restoreFlattenedTree(collider);
        }
      }

      if (collider.isFlattened) {
        const targetScale = collider.isHovered ? collider.flatHoverScale || 1.07 : 1;
        collider.flatVisualTargetScale = targetScale;
        const nextScale = THREE.MathUtils.lerp(collider.flatVisualScale || 1, targetScale, Math.min(1, deltaSeconds * 12));
        applyFlattenedTreeVisualScale(collider, nextScale);
      } else {
        applyFlattenedTreeVisualScale(collider, 1);
      }
    }
  }

  function removeTreeCollider(collider, persistDeletion = true) {
    if (!collider) return;

    if (treeHoldState.collider === collider) {
      treeHoldState.collider = null;
      treeHoldState.pointerId = null;
      treeHoldState.elapsed = 0;
      treeHoldState.duration = 0;
      getAudioHandler?.()?.cancelTreeDeleteHoldWoop?.();
    }

    if (persistDeletion) {
      const wasAlreadyDeleted = deletedTreeKeys.has(collider.key);
      deletedTreeKeys.add(collider.key);
      saveDeletedTreeKeys();
      onTreeDeleted({ collider, wasAlreadyDeleted });
    }

    if (collider.flatHitTarget) {
      flattenedTreeClickTargets.delete(collider.flatHitTarget);
    }

    if (collider.hitboxGrid) {
      treeHitboxGridObjects.delete(collider.hitboxGrid);
      if (collider.hitboxGrid.parent) collider.hitboxGrid.parent.remove(collider.hitboxGrid);
      if (collider.hitboxGrid.geometry) collider.hitboxGrid.geometry.dispose();
      if (collider.hitboxGrid.material) collider.hitboxGrid.material.dispose();
    }

    if (collider.sprite) {
      treeSprites.delete(collider.sprite);
      if (collider.sprite.parent) collider.sprite.parent.remove(collider.sprite);
      collider.sprite.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    treeColliders.delete(collider.key);
  }

  function handleFlattenedTreeClick(event) {
    if (event.button !== 0 || flattenedTreeClickTargets.size === 0) return false;

    const rect = renderer.domElement.getBoundingClientRect();
    treeClickPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    treeClickPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    treeClickRaycaster.setFromCamera(treeClickPointer, camera);

    const clickableTrees = [...flattenedTreeClickTargets].filter((tree) => tree.visible && tree.parent);
    const hits = treeClickRaycaster.intersectObjects(clickableTrees, false);
    const hit = hits.find((item) => item.object && item.object.userData && item.object.userData.treeColliderKey);
    if (!hit) return false;

    const collider = treeColliders.get(hit.object.userData.treeColliderKey);
    if (!collider || !collider.isFlattened || !isTreeColliderWithinPlayerTileRadius(collider, 10)) return false;

    treeHoldState.collider = collider;
    treeHoldState.pointerId = event.pointerId ?? null;
    treeHoldState.elapsed = 0;
    treeHoldState.duration = Math.max(0.001, (collider.collapseDuration || 0.24) * 3);

    getAudioHandler?.()?.startTreeDeleteHoldWoop?.(treeHoldState.duration);

    collider.isHovered = false;
    collider.isCollapsing = false;
    collider.collapseElapsed = 0;
    collider.collapseDuration = 0.24;
    collider.collapseStartScale = collider.flatVisualScale || (collider.flatHoverScale || 1.07);

    if (collider.flatHoverUnderlay) {
      collider.flatHoverUnderlay.visible = false;
    }

    return true;
  }


  function cancelFlattenedTreeClickHold(pointerId = null) {
    const heldCollider = treeHoldState.collider;
    if (!heldCollider) return false;

    if (pointerId !== null && treeHoldState.pointerId !== null && treeHoldState.pointerId !== pointerId) {
      return false;
    }

    treeHoldState.collider = null;
    treeHoldState.pointerId = null;
    treeHoldState.elapsed = 0;
    treeHoldState.duration = 0;
    getAudioHandler?.()?.cancelTreeDeleteHoldWoop?.();

    if (treeColliders.has(heldCollider.key)) {
      heldCollider.isHovered = false;
      heldCollider.flatVisualTargetScale = 1;
      applyFlattenedTreeVisualScale(heldCollider, 1);

      if (heldCollider.flatHoverUnderlay) {
        heldCollider.flatHoverUnderlay.visible = false;
      }
    }

    return true;
  }


  function setFlattenedTreeHovered(collider, hovered) {
    if (!collider) return;
    collider.isHovered = Boolean(hovered) && collider.isFlattened && treeHoldState.collider !== collider;
    if (collider.flatHoverUnderlay) {
      collider.flatHoverUnderlay.visible = collider.isHovered;
    }
  }

  function getFlattenedTreeColliderFromEvent(event) {
    if (!event || flattenedTreeClickTargets.size === 0) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    treeClickPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    treeClickPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    treeClickRaycaster.setFromCamera(treeClickPointer, camera);

    const clickableTrees = [...flattenedTreeClickTargets].filter((tree) => tree.visible && tree.parent);
    const hits = treeClickRaycaster.intersectObjects(clickableTrees, false);
    const hit = hits.find((item) => item.object && item.object.userData && item.object.userData.treeColliderKey);
    if (!hit) return null;

    const collider = treeColliders.get(hit.object.userData.treeColliderKey) || null;
    return collider && isTreeColliderWithinPlayerTileRadius(collider, 10) ? collider : null;
  }

  function updateFlattenedTreeHover(event) {
    const hoveredCollider = getFlattenedTreeColliderFromEvent(event);

    for (const collider of treeColliders.values()) {
      if (collider.isHovered && collider !== hoveredCollider) {
        setFlattenedTreeHovered(collider, false);
      }
    }

    if (hoveredCollider && hoveredCollider.isFlattened) {
      setFlattenedTreeHovered(hoveredCollider, true);
      return hoveredCollider;
    }

    return null;
  }

  function buildTreeHitboxGrid(collider) {
    const yMin = collider.baseY + 0.05;
    const yMax = collider.topY;
    const xMin = collider.xMin;
    const xMax = collider.xMax;
    const zMin = collider.zMin;
    const zMax = collider.zMax;

    const positions = [
      // Bottom tile footprint
      xMin, yMin, zMin,  xMax, yMin, zMin,
      xMax, yMin, zMin,  xMax, yMin, zMax,
      xMax, yMin, zMax,  xMin, yMin, zMax,
      xMin, yMin, zMax,  xMin, yMin, zMin,

      // Top tree-height footprint
      xMin, yMax, zMin,  xMax, yMax, zMin,
      xMax, yMax, zMin,  xMax, yMax, zMax,
      xMax, yMax, zMax,  xMin, yMax, zMax,
      xMin, yMax, zMax,  xMin, yMax, zMin,

      // Vertical corners
      xMin, yMin, zMin,  xMin, yMax, zMin,
      xMax, yMin, zMin,  xMax, yMax, zMin,
      xMax, yMin, zMax,  xMax, yMax, zMax,
      xMin, yMin, zMax,  xMin, yMax, zMax
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x9cff00,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });

    const hitboxGrid = new THREE.LineSegments(geometry, material);
    hitboxGrid.visible = Boolean(getShowGridLines()) && !Boolean(getHideTrees());
    hitboxGrid.renderOrder = 6;
    hitboxGrid.userData.isTreeHitboxGrid = true;
    hitboxGrid.userData.treeColliderKey = collider.key;

    treeHitboxGridObjects.add(hitboxGrid);
    return hitboxGrid;
  }

  return {
    treeSprites,
    treeColliders,
    treeHitboxGridObjects,
    flattenedTreeClickTargets,
    getTreeColliderKey,
    isTreeColliderActive,
    setTreeFlattened,
    restoreFlattenedTree,
    updateTreeFlattening,
    updateLooseRubbleEntities,
    registerLooseRubbleEntity,
    fireRubbleProjectile,
    handleLooseRubbleClick,
    cancelLooseRubbleClickHold,
    updateLooseRubbleHover,
    removeTreeCollider,
    handleFlattenedTreeClick,
    cancelFlattenedTreeClickHold,
    setFlattenedTreeHovered,
    updateFlattenedTreeHover,
    buildTreeHitboxGrid
  };
}
