const FULL_STATE_STORAGE_KEY = "new-3D-game.full-state.v2";

export function setLocalStorageStatus(statusElement, message) {
  if (statusElement) {
    statusElement.textContent = `LocalStorage: ${message}`;
  }
}

export function loadSavedFullStateEnvelope() {
  try {
    const raw = localStorage.getItem(FULL_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.version === 1 ? parsed : null;
  } catch (error) {
    console.warn("Could not load saved game state:", error);
    return null;
  }
}

export function saveFullStateEnvelope(fullState, { statusElement } = {}) {
  try {
    localStorage.setItem(FULL_STATE_STORAGE_KEY, JSON.stringify(fullState));
    setLocalStorageStatus(statusElement, `saved ${new Date(fullState.savedAt).toLocaleTimeString()}`);
    return true;
  } catch (error) {
    console.warn("Could not save full game state:", error);
    setLocalStorageStatus(statusElement, "save failed");
    return false;
  }
}

export function clearAllBrowserStorage({ reload = false, statusElement = null, noteElement = null } = {}) {
  try {
    localStorage.clear();
    sessionStorage.clear();
    setLocalStorageStatus(statusElement, "storage cleared, refresh to start clean");

    if (noteElement) {
      noteElement.textContent = reload
        ? "LocalStorage and SessionStorage cleared. Reloading clean world state..."
        : "LocalStorage and SessionStorage cleared. Refresh to start clean.";
    }

    if (reload) {
      window.setTimeout(() => {
        window.location.reload();
      }, 180);
    }

    return true;
  } catch (error) {
    console.warn("Could not clear browser storage:", error);
    setLocalStorageStatus(statusElement, "clear failed");

    if (noteElement) {
      noteElement.textContent = "Could not clear LocalStorage or SessionStorage. Browser goblin refused the eviction notice.";
    }

    return false;
  }
}

export function loadSessionStringSet(storageKey, { warningMessage = "Could not load session string set:" } = {}) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : []);
  } catch (error) {
    console.warn(warningMessage, error);
    return new Set();
  }
}

export function saveSessionStringSet(storageKey, values, { warningMessage = "Could not save session string set:" } = {}) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify([...values]));
    return true;
  } catch (error) {
    console.warn(warningMessage, error);
    return false;
  }
}

export function loadSessionCount(storageKey, { minimum = 0, warningMessage = "Could not load session count:" } = {}) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.max(parsed, minimum) : minimum;
  } catch (error) {
    console.warn(warningMessage, error);
    return minimum;
  }
}

export function saveSessionCount(storageKey, count, { warningMessage = "Could not save session count:" } = {}) {
  try {
    sessionStorage.setItem(storageKey, String(count));
    return true;
  } catch (error) {
    console.warn(warningMessage, error);
    return false;
  }
}

export function loadSessionJsonArray(storageKey, { warningMessage = "Could not load session array:" } = {}) {
  try {
    const raw = sessionStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(warningMessage, error);
    return [];
  }
}

export function saveSessionJson(storageKey, value, { warningMessage = "Could not save session JSON:" } = {}) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(warningMessage, error);
    return false;
  }
}

export function loadLocalStringSet(storageKey, { warningMessage = "Could not load local string set:" } = {}) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : []);
  } catch (error) {
    console.warn(warningMessage, error);
    return new Set();
  }
}

export function saveLocalStringSet(storageKey, values, { warningMessage = "Could not save local string set:" } = {}) {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...values]));
    return true;
  } catch (error) {
    console.warn(warningMessage, error);
    return false;
  }
}

export function loadLocalCount(storageKey, { minimum = 0, warningMessage = "Could not load local count:" } = {}) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.max(parsed, minimum) : minimum;
  } catch (error) {
    console.warn(warningMessage, error);
    return minimum;
  }
}

export function saveLocalCount(storageKey, count, { warningMessage = "Could not save local count:" } = {}) {
  try {
    localStorage.setItem(storageKey, String(count));
    return true;
  } catch (error) {
    console.warn(warningMessage, error);
    return false;
  }
}

export function loadLocalJsonArray(storageKey, { warningMessage = "Could not load local array:" } = {}) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(warningMessage, error);
    return [];
  }
}

export function saveLocalJson(storageKey, value, { warningMessage = "Could not save local JSON:" } = {}) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(warningMessage, error);
    return false;
  }
}

export function loadSpawnPoint(storageKey, fallbackSpawnPoint) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return { ...fallbackSpawnPoint };

    const parsed = JSON.parse(saved);
    return {
      x: Number(parsed.x) || fallbackSpawnPoint.x || 0,
      y: Number(parsed.y) || fallbackSpawnPoint.y || 0,
      z: Number(parsed.z) || fallbackSpawnPoint.z || 0,
      yaw: Number.isFinite(Number(parsed.yaw)) ? Number(parsed.yaw) : fallbackSpawnPoint.yaw
    };
  } catch (error) {
    console.warn("Could not load spawn point:", error);
    return { ...fallbackSpawnPoint };
  }
}

export function saveSpawnPoint(storageKey, spawnPoint) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(spawnPoint));
    return true;
  } catch (error) {
    console.warn("Could not save spawn point:", error);
    return false;
  }
}

export function saveWorldCacheEnvelope(storageKey, cache) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cache));
    return true;
  } catch (error) {
    console.warn("Could not save world cache:", error);
    return false;
  }
}

// Game-specific save/load state controller. Kept here with raw storage helpers so persistence stays in one module.
function readVector3(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function applyVector3(vector, value) {
  if (!value || !vector) return;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
    vector.set(x, y, z);
  }
}

function serializeDistantLodChunk(group) {
  if (!group || !group.userData) return null;

  return {
    x: group.userData.chunkX,
    z: group.userData.chunkZ
  };
}

export function createSaveLoadState({
  seedText,
  worldCacheStorageKey,
  worldCacheVersion,
  worldCacheSaveIntervalMs,
  distantLodChunks,
  worldCacheReadout,
  localStorageStatus,
  loadingLocalStorageNote,
  sphereTextureSelect,
  minimapZoomSlider,
  savedFullState,
  shouldRestoreFullState,
  getCurrentCameraMode,
  getActiveSpawnPoint,
  getShowGridLines,
  getHideMinimap,
  getHideTrees,
  getDeletedTreeKeys = () => new Set(),
  getDeletedRubbleKeys = () => new Set(),
  getBushesCollectedCount = () => 0,
  getRubbleCollectedCount = () => 0,
  getBushInventorySlotCounts = () => [],
  getRubbleInventorySlotCounts = () => [],
  getCameraState,
  getPlayer,
  getIsThirdPersonMode,
  setLocalStorageStatus,
  setShowGridLines,
  setHideMinimapState,
  setHideTreesState,
  setMinimapZoomValue,
  addSphereTextureOption,
  applySphereTexture,
  updateChunks,
  updateCameraPosition
}) {
  let worldCacheLastSaveTime = 0;
  let worldCacheDirty = false;

  function loadWorldCache() {
    // Startup cache hydration disabled: re-queuing old distant LOD chunks before the first frame
    // was causing heavy lag/stalls on localhost. The game will regenerate visible terrain normally.
    if (worldCacheReadout) {
      worldCacheReadout.textContent = "World cache: startup load disabled";
    }
  }

  function saveWorldCache(force = false) {
    const now = performance.now();
    if (!force && (!worldCacheDirty || now - worldCacheLastSaveTime < worldCacheSaveIntervalMs)) {
      return;
    }

    worldCacheLastSaveTime = now;
    worldCacheDirty = false;

    try {
      const distant = [...distantLodChunks.values()]
        .map(serializeDistantLodChunk)
        .filter(Boolean);

      const cache = {
        version: worldCacheVersion,
        seed: seedText,
        savedAt: Date.now(),
        distantLodChunks: distant
      };

      const didSave = saveWorldCacheEnvelope(worldCacheStorageKey, cache);
      if (worldCacheReadout) {
        worldCacheReadout.textContent = didSave ? `World cache: saved ${distant.length}` : "World cache: full/failed";
      }
    } catch (error) {
      console.warn("Could not build world cache:", error);
      if (worldCacheReadout) {
        worldCacheReadout.textContent = "World cache: full/failed";
      }
    }
  }

  function markWorldCacheDirty() {
    worldCacheDirty = true;
  }

  function saveFullGameState() {
    saveWorldCache(true);

    const state = getCameraState();
    const player = getPlayer();

    const fullState = {
      version: 1,
      savedAt: Date.now(),
      seedText,
      cameraMode: getCurrentCameraMode(),
      sphereTexturePath: sphereTextureSelect.value,
      spawnPoint: getActiveSpawnPoint(),
      deletedTreeKeys: [...getDeletedTreeKeys()].filter((key) => typeof key === "string"),
      deletedRubbleKeys: [...getDeletedRubbleKeys()].filter((key) => typeof key === "string"),
      collected: {
        bushes: Math.max(0, Math.round(Number(getBushesCollectedCount()) || 0)),
        rubble: Math.max(0, Math.round(Number(getRubbleCollectedCount()) || 0))
      },
      inventory: {
        bushes: Array.isArray(getBushInventorySlotCounts()) ? getBushInventorySlotCounts() : [],
        rubble: Array.isArray(getRubbleInventorySlotCounts()) ? getRubbleInventorySlotCounts() : []
      },
      ui: {
        showGridLines: getShowGridLines(),
        hideMinimap: getHideMinimap(),
        hideTrees: getHideTrees(),
        minimapZoomSlider: Number(minimapZoomSlider.value)
      },
      camera: {
        target: readVector3(state.target),
        yaw: state.yaw,
        pitch: state.pitch,
        distance: state.distance
      },
      player: player.mesh ? {
        position: readVector3(player.mesh.position),
        velocity: readVector3(player.velocity),
        verticalVelocity: player.verticalVelocity,
        grounded: player.grounded,
        inWater: player.inWater,
        underwater: player.underwater,
        waterDepthOffset: player.waterDepthOffset,
        waterBlend: player.waterBlend,
        cameraWaterBlend: player.cameraWaterBlend,
        yawOffset: player.yawOffset
      } : null
    };

    saveFullStateEnvelope(fullState, { statusElement: localStorageStatus });
  }

  function clearAllLocalStorage(options = {}) {
    clearAllBrowserStorage({
      reload: Boolean(options.reload),
      statusElement: localStorageStatus,
      noteElement: loadingLocalStorageNote
    });
  }

  function restoreUiState(sourceState = savedFullState) {
    if (!shouldRestoreFullState || !sourceState || !sourceState.ui) return;

    setShowGridLines(Boolean(sourceState.ui.showGridLines));
    setHideMinimapState(Boolean(sourceState.ui.hideMinimap));
    setHideTreesState(Boolean(sourceState.ui.hideTrees));

    if (Number.isFinite(Number(sourceState.ui.minimapZoomSlider))) {
      setMinimapZoomValue(sourceState.ui.minimapZoomSlider);
    }
  }

  function restoreFullGameState() {
    if (!shouldRestoreFullState) {
      setLocalStorageStatus("ready");
      return;
    }

    const state = getCameraState();
    const player = getPlayer();

    if (savedFullState.sphereTexturePath) {
      addSphereTextureOption(savedFullState.sphereTexturePath);
      sphereTextureSelect.value = savedFullState.sphereTexturePath;
      applySphereTexture(savedFullState.sphereTexturePath);
    }

    if (savedFullState.camera) {
      applyVector3(state.target, savedFullState.camera.target);
      if (Number.isFinite(Number(savedFullState.camera.yaw))) state.yaw = Number(savedFullState.camera.yaw);
      if (Number.isFinite(Number(savedFullState.camera.pitch))) state.pitch = Number(savedFullState.camera.pitch);
      if (Number.isFinite(Number(savedFullState.camera.distance))) state.distance = Number(savedFullState.camera.distance);
    }

    if (savedFullState.player && player.mesh) {
      applyVector3(player.mesh.position, savedFullState.player.position);
      applyVector3(player.velocity, savedFullState.player.velocity);
      player.verticalVelocity = Number(savedFullState.player.verticalVelocity) || 0;
      player.grounded = Boolean(savedFullState.player.grounded);
      player.inWater = Boolean(savedFullState.player.inWater);
      player.underwater = Boolean(savedFullState.player.underwater);
      player.waterDepthOffset = Number(savedFullState.player.waterDepthOffset) || 0;
      player.waterBlend = Number(savedFullState.player.waterBlend) || 0;
      player.cameraWaterBlend = Number(savedFullState.player.cameraWaterBlend) || 0;
      player.yawOffset = Number(savedFullState.player.yawOffset) || 0;
      player.mesh.visible = getIsThirdPersonMode();
    }

    updateChunks();
    updateCameraPosition();
    setLocalStorageStatus(`restored ${new Date(savedFullState.savedAt).toLocaleTimeString()}`);
  }

  return {
    loadWorldCache,
    saveWorldCache,
    markWorldCacheDirty,
    saveFullGameState,
    clearAllLocalStorage,
    restoreUiState,
    restoreFullGameState
  };
}
