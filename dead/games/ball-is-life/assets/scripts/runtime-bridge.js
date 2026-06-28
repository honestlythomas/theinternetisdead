    import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
    import {
      loadSavedFullStateEnvelope,
      loadLocalCount,
      loadLocalJsonArray,
      loadLocalStringSet,
      loadSpawnPoint as loadStoredSpawnPoint,
      saveLocalCount,
      saveLocalJson,
      saveLocalStringSet,
      saveSpawnPoint as saveStoredSpawnPoint,
      setLocalStorageStatus as setStoredLocalStorageStatus,
      createSaveLoadState
    } from "./storage-state.js?v=rubble-slot-projectile-20260508";
    import { createAudioHandler } from "./audio-handler.js?v=rubble-slot-projectile-20260508";
    import {
      createBushInventoryController,
      createPlayerController,
      createSurfaceObjects,
      isTextEntryTarget
    } from "./surface-entities.js?v=rubble-slot-projectile-20260508";
    import { createBaseGenerator } from "./base-generator.js?v=rubble-slot-projectile-20260508";
    import {
      createCloudLayer,
      createGraphicsPipeline,
      createMaterialPipeline,
      createSceneSetup
    } from "./graphics-pipeline.js?v=rubble-slot-projectile-20260508";
    import {
      hideLoadingScreen as hideLoadingPanel,
      setupEscMenuPanels,
      setupStartMenuControls,
      setupStorageButtons,
      showLoadingScreen as showLoadingPanel
    } from "./ui-panels.js?v=rubble-slot-projectile-20260508";

    const canvas = document.getElementById("game");
    const hud = document.getElementById("hud");
    const loadingScreen = document.getElementById("loadingScreen");
    const loadingClearLocalStorageButton = document.getElementById("loadingClearLocalStorageButton");
    const loadingLocalStorageNote = document.getElementById("loadingLocalStorageNote");
    const escMenuButton = document.getElementById("escMenuButton");
    const seedReadout = document.getElementById("seedReadout");
    const chunkReadout = document.getElementById("chunkReadout");
    const distantChunkReadout = document.getElementById("distantChunkReadout");
    const worldCacheReadout = document.getElementById("worldCacheReadout");
    const seaLevelReadout = document.getElementById("seaLevelReadout");
    const bushesCollectedReadout = document.getElementById("bushesCollectedReadout");
    const rubbleCollectedReadout = document.getElementById("rubbleCollectedReadout");
    const modeReadout = document.getElementById("modeReadout");
    const escMenuSelect = document.getElementById("escMenuSelect");
    const tutorialPanel = document.getElementById("tutorialPanel");
    const controlsPanel = document.getElementById("controlsPanel");
    const customizationPanel = document.getElementById("customizationPanel");
    const statsPanel = document.getElementById("statsPanel");
    const liveCameraModeSelect = document.getElementById("liveCameraModeSelect");
    const sphereTextureSelect = document.getElementById("sphereTextureSelect");
    const sphereTextureStatus = document.getElementById("sphereTextureStatus");
    const setSpawnButton = document.getElementById("setSpawnButton");
    const showGridCheckbox = document.getElementById("showGridCheckbox");
    const hideMinimapCheckbox = document.getElementById("hideMinimapCheckbox");
    const hideTreesCheckbox = document.getElementById("hideTreesCheckbox");
    const minimapZoomSlider = document.getElementById("minimapZoomSlider");
    const minimapZoomStatus = document.getElementById("minimapZoomStatus");
    const soundFxVolumeSlider = document.getElementById("soundFxVolumeSlider");
    const musicVolumeSlider = document.getElementById("musicVolumeSlider");
    const muteAllCheckbox = document.getElementById("muteAllCheckbox");
    const minimap = document.getElementById("minimap");
    const minimapCanvas = document.getElementById("minimapCanvas");
    const spawnStatus = document.getElementById("spawnStatus");
    const sphereCoordsReadout = document.getElementById("sphereCoordsReadout");
    const cameraDirectionReadout = document.getElementById("cameraDirectionReadout");
    const spawnCoordsReadout = document.getElementById("spawnCoordsReadout");
    const localStorageStatus = document.getElementById("localStorageStatus");
    const clearLocalStorageLink = document.getElementById("clearLocalStorageLink");
    const saveStateButton = document.getElementById("saveStateButton");
    const bushInventory = document.getElementById("bushInventory");
    const bushInventorySlots = [...document.querySelectorAll("[data-bush-slot]")];
    const bushCarryGhost = document.getElementById("bushCarryGhost");
    const bushCarryGhostCount = document.getElementById("bushCarryGhostCount");
    const bushInventoryController = createBushInventoryController({
      bushInventory,
      bushInventorySlots,
      bushCarryGhost,
      bushCarryGhostCount
    });

    const normalizeBushInventorySlotCounts = bushInventoryController.normalizeSlotCounts;
    const setBushInventoryCounts = bushInventoryController.setCounts;
    const setInventoryRubbleCounts = bushInventoryController.setRubbleCounts;
    const normalizeRubbleInventorySlotCounts = bushInventoryController.normalizeRubbleSlotCounts;
    const getBushInventorySlotCounts = bushInventoryController.getCounts;
    const getRubbleInventorySlotCounts = bushInventoryController.getRubbleCounts;
    const toggleBushInventory = bushInventoryController.toggleOpen;
    const getActiveBushCarryCount = bushInventoryController.getActiveCarryCount;
    const cancelBushCarryToLeftmostSlot = bushInventoryController.cancelCarryToLeftmostSlot;
    const consumeInventoryItemFromSlot = bushInventoryController.consumeItemFromSlot;
    const hasInventoryItemInSlot = bushInventoryController.hasItemInSlot;

    const underwaterOverlay = document.getElementById("underwaterOverlay");
    const startMenu = document.getElementById("startMenu");
    const seedInput = document.getElementById("seedInput");
    const cameraModeSelect = document.getElementById("cameraModeSelect");
    const startButton = document.getElementById("startButton");
    const randomSeedButton = document.getElementById("randomSeedButton");

    const urlParams = new URLSearchParams(window.location.search);
    const shouldShowStartMenu = urlParams.get("menu") === "start";

    const backgroundMusic = new Audio("assets/audio/yoshis-island.mp3");
    backgroundMusic.loop = false;
    backgroundMusic.preload = "auto";

    const backgroundMusicBaseVolume = 0.36;
    const backgroundMusicFadeSeconds = 2;
    let backgroundMusicStarted = false;
    let backgroundMusicFadeFrame = 0;
    let backgroundMusicFadingOutForLoop = false;
    let backgroundMusicCanInitialize = false;
    let soundFxVolumeLevel = 1;
    let musicVolumeLevel = 0.5;
    let muteAllEnabled = false;

    function getBackgroundMusicTargetVolume() {
      return muteAllEnabled ? 0 : backgroundMusicBaseVolume * musicVolumeLevel;
    }

    function cancelBackgroundMusicFade() {
      if (!backgroundMusicFadeFrame) return;
      cancelAnimationFrame(backgroundMusicFadeFrame);
      backgroundMusicFadeFrame = 0;
    }

    function fadeBackgroundMusicVolume(toVolume, seconds, onComplete) {
      cancelBackgroundMusicFade();

      const fromVolume = backgroundMusic.volume;
      const targetVolume = Math.max(0, Math.min(1, toVolume));
      const durationMs = Math.max(0.001, seconds) * 1000;
      const startedAt = performance.now();

      const tick = (now) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        backgroundMusic.volume = fromVolume + (targetVolume - fromVolume) * progress;

        if (progress < 1) {
          backgroundMusicFadeFrame = requestAnimationFrame(tick);
          return;
        }

        backgroundMusicFadeFrame = 0;
        backgroundMusic.volume = targetVolume;

        if (typeof onComplete === "function") {
          onComplete();
        }
      };

      backgroundMusicFadeFrame = requestAnimationFrame(tick);
    }

    function playBackgroundMusicWithFadeIn() {
      backgroundMusicFadingOutForLoop = false;
      backgroundMusic.muted = muteAllEnabled;
      backgroundMusic.volume = 0;

      const playPromise = backgroundMusic.play();
      if (!playPromise || typeof playPromise.then !== "function") {
        fadeBackgroundMusicVolume(getBackgroundMusicTargetVolume(), backgroundMusicFadeSeconds);
        return Promise.resolve(true);
      }

      return playPromise.then(() => {
        fadeBackgroundMusicVolume(getBackgroundMusicTargetVolume(), backgroundMusicFadeSeconds);
        return true;
      }).catch((error) => {
        backgroundMusicStarted = false;
        backgroundMusicFadingOutForLoop = false;
        cancelBackgroundMusicFade();
        console.warn("Background music could not start yet:", error);
        return false;
      });
    }

    function markBackgroundMusicReady() {
      if (backgroundMusicCanInitialize) return;
      backgroundMusicCanInitialize = true;
      backgroundMusic.load();
    }

    function startBackgroundMusicOnce() {
      if (!backgroundMusicCanInitialize) return Promise.resolve(false);
      if (backgroundMusicStarted) return Promise.resolve(true);
      backgroundMusicStarted = true;
      return playBackgroundMusicWithFadeIn();
    }

    backgroundMusic.addEventListener("timeupdate", () => {
      if (
        backgroundMusicFadingOutForLoop ||
        !backgroundMusicStarted ||
        !Number.isFinite(backgroundMusic.duration) ||
        backgroundMusic.duration <= backgroundMusicFadeSeconds
      ) {
        return;
      }

      const remainingSeconds = backgroundMusic.duration - backgroundMusic.currentTime;
      if (remainingSeconds <= backgroundMusicFadeSeconds) {
        backgroundMusicFadingOutForLoop = true;
        fadeBackgroundMusicVolume(0, Math.max(0.05, remainingSeconds));
      }
    });

    backgroundMusic.addEventListener("ended", () => {
      if (!backgroundMusicStarted) return;
      backgroundMusic.currentTime = 0;
      playBackgroundMusicWithFadeIn();
    });

    function armBackgroundMusicUnlock() {
      const unlockEvents = ["pointerdown", "mousedown", "click", "keydown", "touchstart"];
      let unlockArmed = true;

      const removeUnlockListeners = () => {
        for (const eventName of unlockEvents) {
          window.removeEventListener(eventName, unlock, true);
        }
      };

      const unlock = () => {
        if (!unlockArmed || backgroundMusicStarted) return;

        startBackgroundMusicOnce().then((started) => {
          if (!started) return;
          unlockArmed = false;
          removeUnlockListeners();
        });
      };

      for (const eventName of unlockEvents) {
        window.addEventListener(eventName, unlock, {
          capture: true,
          passive: true
        });
      }
    }

    armBackgroundMusicUnlock();

    let gameStarted = false;
    let pendingSphereTexturePath = null;
    let activeSpawnPoint = { x: 0, y: 0, z: 0, yaw: Math.PI / 4 };
    let showGridLines = false;
    let hideMinimap = false;
    let hideTrees = false;
    let audioHandler = null;

    function showLoadingScreen() {
      showLoadingPanel(loadingScreen);
    }

    function hideLoadingScreen() {
      hideLoadingPanel(loadingScreen);
    }

    function setLocalStorageStatus(message) {
      setStoredLocalStorageStatus(localStorageStatus, message);
    }

    function autoStartDefaultDevSphereMode() {
      const savedState = loadSavedFullStateEnvelope();
      const savedSeed = savedState && typeof savedState.seedText === "string" ? savedState.seedText : "tektite";
      const savedCameraMode = savedState && savedState.cameraMode === "dev" ? "dev" : "third-person";
      const savedTexture = savedState && typeof savedState.sphereTexturePath === "string" ? savedState.sphereTexturePath : "assets/png/lime-magenta_sphere.png";

      pendingSphereTexturePath = savedTexture;
      seedInput.value = savedSeed;
      cameraModeSelect.value = savedCameraMode;
      startGame(savedSeed, savedCameraMode);
    }

    setupEscMenuPanels({
      hud,
      escMenuButton,
      escMenuSelect,
      tutorialPanel,
      controlsPanel,
      customizationPanel,
      statsPanel
    });

    setSpawnButton.addEventListener("click", () => {
      if (!window.__setSphereSpawnPoint) return;
      window.__setSphereSpawnPoint();
    });

    function setShowGridLines(visible) {
      showGridLines = Boolean(visible);
      showGridCheckbox.checked = showGridLines;

      if (window.__setTileGridVisibility) {
        window.__setTileGridVisibility(showGridLines);
      }
    }

    function volumeLevelToSliderValue(volumeLevel) {
      const level = Math.max(0, Math.min(1.5, Number(volumeLevel) || 0));
      if (level <= 1) return Math.round(level * 100);
      return Math.round(100 + ((level - 1) / 0.5) * 100);
    }

    function sliderValueToVolumeLevel(sliderValue) {
      const value = Math.max(0, Math.min(200, Number(sliderValue) || 0));
      if (value <= 100) return value / 100;
      return 1 + ((value - 100) / 100) * 0.5;
    }

    function applyVolumeOptions({ fadeMusic = false } = {}) {
      if (soundFxVolumeSlider) soundFxVolumeSlider.value = String(volumeLevelToSliderValue(soundFxVolumeLevel));
      if (musicVolumeSlider) musicVolumeSlider.value = String(volumeLevelToSliderValue(musicVolumeLevel));
      if (muteAllCheckbox) muteAllCheckbox.checked = muteAllEnabled;

      backgroundMusic.muted = muteAllEnabled;
      const targetMusicVolume = getBackgroundMusicTargetVolume();

      if (backgroundMusicStarted && !backgroundMusic.paused) {
        if (fadeMusic) {
          fadeBackgroundMusicVolume(targetMusicVolume, 0.12);
        } else {
          cancelBackgroundMusicFade();
          backgroundMusic.volume = targetMusicVolume;
        }
      }

      if (audioHandler) {
        audioHandler.setSoundFxVolume?.(soundFxVolumeLevel);
        audioHandler.setMuted?.(muteAllEnabled);
      }
    }

    soundFxVolumeSlider?.addEventListener("input", () => {
      soundFxVolumeLevel = sliderValueToVolumeLevel(soundFxVolumeSlider.value);
      applyVolumeOptions();
    });

    musicVolumeSlider?.addEventListener("input", () => {
      musicVolumeLevel = sliderValueToVolumeLevel(musicVolumeSlider.value);
      applyVolumeOptions({ fadeMusic: true });
    });

    muteAllCheckbox?.addEventListener("change", () => {
      muteAllEnabled = muteAllCheckbox.checked;
      applyVolumeOptions({ fadeMusic: true });
    });

    applyVolumeOptions();

    showGridCheckbox.addEventListener("change", () => {
      setShowGridLines(showGridCheckbox.checked);
    });

    hideMinimapCheckbox.addEventListener("change", () => {
      hideMinimap = hideMinimapCheckbox.checked;
      minimap.classList.toggle("hidden", hideMinimap);
    });

    hideTreesCheckbox.addEventListener("change", () => {
      hideTrees = hideTreesCheckbox.checked;

      if (window.__setTreeVisibility) {
        window.__setTreeVisibility(!hideTrees);
      }
    });





    window.addEventListener("keydown", (event) => {
      const isTextEntry = isTextEntryTarget(event.target);

      if (!isTextEntry) {
        startBackgroundMusicOnce();
      }

      if (!isTextEntry && event.shiftKey && event.code === "KeyM") {
        event.preventDefault();
        muteAllEnabled = !muteAllEnabled;
        applyVolumeOptions({ fadeMusic: true });
      }

      if (event.shiftKey && event.code === "KeyG") {
        event.preventDefault();
        setShowGridLines(!showGridLines);
      }

      if (
        shouldShowStartMenu &&
        !gameStarted &&
        event.shiftKey &&
        event.code === "KeyD"
      ) {
        event.preventDefault();
        autoStartDefaultDevSphereMode();
      }
    });

    setupStartMenuControls({
      seedInput,
      cameraModeSelect,
      startButton,
      randomSeedButton,
      onStart: startGame
    });

    if (shouldShowStartMenu) {
      startMenu.style.display = "grid";
      requestAnimationFrame(() => {
        hideLoadingScreen();
      });
    } else {
      autoStartDefaultDevSphereMode();
    }

    function startGame(seedText, cameraMode) {
      if (gameStarted) return;
      startBackgroundMusicOnce();
      showLoadingScreen();
      gameStarted = true;
      startMenu.style.display = "none";

      try {
        init(seedText, cameraMode);
      } catch (error) {
        console.error("Game failed during startup:", error);
        setLocalStorageStatus("startup error, clear LocalStorage and reload");
        hideLoadingScreen();
        gameStarted = false;
        startMenu.style.display = "grid";
      }
    }

    function hashStringToUint32(text) {
      let hash = 2166136261;
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function smoothstep(edge0, edge1, x) {
      const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function init(seedText, cameraMode) {
      const savedFullState = loadSavedFullStateEnvelope();
      const shouldRestoreFullState = savedFullState && savedFullState.seedText === seedText;
      let currentCameraMode = shouldRestoreFullState && (savedFullState.cameraMode === "third-person" || savedFullState.cameraMode === "dev")
        ? savedFullState.cameraMode
        : (cameraMode === "third-person" ? "third-person" : "dev");
      let isThirdPersonMode = currentCameraMode === "third-person";
      liveCameraModeSelect.value = currentCameraMode;
      seedReadout.textContent = `Seed: ${seedText}`;
      modeReadout.textContent = `Mode: ${isThirdPersonMode ? "Ball Mode" : "Dev Mode"}`;

      const spawnStorageKey = `new-3D-game.spawn.${seedText}`;
      const worldCacheStorageKey = `new-3D-game.world-cache.${seedText}`;
      const deletedTreeStorageKey = `new-3D-game.deleted-trees.${seedText}`;
      const deletedRubbleStorageKey = `new-3D-game.deleted-rubble.${seedText}`;
      const bushesCollectedStorageKey = `new-3D-game.bushes-collected.${seedText}`;
      const rubbleCollectedStorageKey = `new-3D-game.rubble-collected.${seedText}`;
      const bushInventoryStorageKey = `new-3D-game.bush-inventory.${seedText}`;
      const rubbleInventoryStorageKey = `new-3D-game.rubble-inventory.${seedText}`;
      const worldCacheVersion = 3;
      const worldCacheSaveIntervalMs = 2500;
      let worldCacheLoadedChunkCount = 0;
      let worldCacheLastSaveTime = 0;
      let worldCacheDirty = false;

      function loadLegacySessionStringSet(storageKey) {
        try {
          const raw = sessionStorage.getItem(storageKey);
          const parsed = raw ? JSON.parse(raw) : [];
          return new Set(Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : []);
        } catch {
          return new Set();
        }
      }

      function loadLegacySessionCount(storageKey) {
        try {
          const raw = sessionStorage.getItem(storageKey);
          const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        } catch {
          return 0;
        }
      }

      function loadLegacySessionJsonArray(storageKey) {
        try {
          const raw = sessionStorage.getItem(storageKey);
          const parsed = raw ? JSON.parse(raw) : null;
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }

      function loadDeletedTreeKeys() {
        const localKeys = loadLocalStringSet(deletedTreeStorageKey, {
          warningMessage: "Could not load deleted tree local state:"
        });
        for (const key of loadLegacySessionStringSet(deletedTreeStorageKey)) localKeys.add(key);
        return localKeys;
      }

      function loadDeletedRubbleKeys() {
        const localKeys = loadLocalStringSet(deletedRubbleStorageKey, {
          warningMessage: "Could not load deleted rubble local state:"
        });
        for (const key of loadLegacySessionStringSet(deletedRubbleStorageKey)) localKeys.add(key);
        return localKeys;
      }

      const deletedTreeKeys = loadDeletedTreeKeys();
      const deletedRubbleKeys = loadDeletedRubbleKeys();
      if (shouldRestoreFullState && Array.isArray(savedFullState?.deletedTreeKeys)) {
        for (const key of savedFullState.deletedTreeKeys) {
          if (typeof key === "string") deletedTreeKeys.add(key);
        }
        saveDeletedTreeKeys();
      }
      if (shouldRestoreFullState && Array.isArray(savedFullState?.deletedRubbleKeys)) {
        for (const key of savedFullState.deletedRubbleKeys) {
          if (typeof key === "string") deletedRubbleKeys.add(key);
        }
        saveDeletedRubbleKeys();
      }

      function loadBushesCollectedCount() {
        const localCount = loadLocalCount(bushesCollectedStorageKey, {
          minimum: deletedTreeKeys.size,
          warningMessage: "Could not load bushes collected local count:"
        });
        return Math.max(localCount, loadLegacySessionCount(bushesCollectedStorageKey), deletedTreeKeys.size);
      }

      let bushesCollectedCount = loadBushesCollectedCount();
      if (shouldRestoreFullState && savedFullState?.collected && Number.isFinite(Number(savedFullState.collected.bushes))) {
        bushesCollectedCount = Math.max(bushesCollectedCount, Math.round(Number(savedFullState.collected.bushes)));
      }

      function loadRubbleCollectedCount() {
        const localCount = loadLocalCount(rubbleCollectedStorageKey, {
          minimum: 0,
          warningMessage: "Could not load rubble collected local count:"
        });
        return Math.max(localCount, loadLegacySessionCount(rubbleCollectedStorageKey));
      }

      let rubbleCollectedCount = loadRubbleCollectedCount();
      if (shouldRestoreFullState && savedFullState?.collected && Number.isFinite(Number(savedFullState.collected.rubble))) {
        rubbleCollectedCount = Math.max(rubbleCollectedCount, Math.round(Number(savedFullState.collected.rubble)));
      }

      function loadBushInventorySlotCounts() {
        return normalizeBushInventorySlotCounts(
          bushesCollectedCount,
          (() => {
            const localLayout = loadLocalJsonArray(bushInventoryStorageKey, {
              warningMessage: "Could not load bush inventory local layout:"
            });
            const legacyLayout = loadLegacySessionJsonArray(bushInventoryStorageKey);
            return localLayout.length ? localLayout : legacyLayout;
          })()
        );
      }

      function loadRubbleInventorySlotCounts() {
        return normalizeRubbleInventorySlotCounts(
          rubbleCollectedCount,
          (() => {
            const localLayout = loadLocalJsonArray(rubbleInventoryStorageKey, {
              warningMessage: "Could not load rubble inventory local layout:"
            });
            const legacyLayout = loadLegacySessionJsonArray(rubbleInventoryStorageKey);
            return localLayout.length ? localLayout : legacyLayout;
          })()
        );
      }

      function saveBushInventorySlotCounts(counts = getBushInventorySlotCounts()) {
        saveLocalJson(
          bushInventoryStorageKey,
          normalizeBushInventorySlotCounts(bushesCollectedCount, counts),
          { warningMessage: "Could not save bush inventory local layout:" }
        );
      }

      function saveRubbleInventorySlotCounts(counts = getRubbleInventorySlotCounts()) {
        saveLocalJson(
          rubbleInventoryStorageKey,
          normalizeRubbleInventorySlotCounts(rubbleCollectedCount, counts),
          { warningMessage: "Could not save rubble inventory local layout:" }
        );
      }

      bushInventoryController.setLayoutChangedHandler((bushCounts, rubbleCounts) => {
        saveBushInventorySlotCounts(bushCounts);
        saveRubbleInventorySlotCounts(rubbleCounts);
      });
      setBushInventoryCounts(bushesCollectedCount, loadBushInventorySlotCounts());
      setInventoryRubbleCounts(rubbleCollectedCount, loadRubbleInventorySlotCounts());

      function updateBushesCollectedReadout() {
        if (bushesCollectedReadout) {
          bushesCollectedReadout.textContent = `Collected Bushes: ${bushesCollectedCount}`;
        }

        if (rubbleCollectedReadout) {
          rubbleCollectedReadout.textContent = `Collected Rubble: ${rubbleCollectedCount}`;
        }

        setBushInventoryCounts(bushesCollectedCount, getBushInventorySlotCounts());
        setInventoryRubbleCounts(rubbleCollectedCount, getRubbleInventorySlotCounts());
        saveBushInventorySlotCounts();
        saveRubbleInventorySlotCounts();
      }

      function saveBushesCollectedCount() {
        saveLocalCount(bushesCollectedStorageKey, bushesCollectedCount, {
          warningMessage: "Could not save bushes collected local count:"
        });
      }

      function saveRubbleCollectedCount() {
        saveLocalCount(rubbleCollectedStorageKey, rubbleCollectedCount, {
          warningMessage: "Could not save rubble collected local count:"
        });
      }

      updateBushesCollectedReadout();

      function saveDeletedTreeKeys() {
        saveLocalStringSet(deletedTreeStorageKey, deletedTreeKeys, {
          warningMessage: "Could not save deleted tree local state:"
        });
      }

      function saveDeletedRubbleKeys() {
        saveLocalStringSet(deletedRubbleStorageKey, deletedRubbleKeys, {
          warningMessage: "Could not save deleted rubble local state:"
        });
      }

      saveDeletedTreeKeys();
      saveDeletedRubbleKeys();
      saveBushesCollectedCount();
      saveRubbleCollectedCount();

      function formatCoord(value) {
        return Number.isFinite(value) ? value.toFixed(2) : "0.00";
      }

      function formatXYZ(point) {
        return `${formatCoord(point.x)} / ${formatCoord(point.y)} / ${formatCoord(point.z)}`;
      }

      function normalizeAngleRadians(angle) {
        const fullTurn = Math.PI * 2;
        return ((angle % fullTurn) + fullTurn) % fullTurn;
      }

      function getCardinalDirectionFromYaw(yaw) {
        /*
          Camera forward vector is based on -sin(yaw), -cos(yaw).
          0 = North, PI/2 = West, PI = South, 3PI/2 = East.
          Because coordinate systems enjoy being just annoying enough.
        */
        const angle = normalizeAngleRadians(yaw);
        const eighthTurn = Math.PI / 4;

        if (angle < eighthTurn || angle >= Math.PI * 2 - eighthTurn) return "North";
        if (angle < Math.PI / 2 + eighthTurn) return "West";
        if (angle < Math.PI + eighthTurn) return "South";
        if (angle < Math.PI * 1.5 + eighthTurn) return "East";
        return "North";
      }

      function formatYaw(yaw) {
        return `${getCardinalDirectionFromYaw(yaw)} (${THREE.MathUtils.radToDeg(normalizeAngleRadians(yaw)).toFixed(1)}°)`;
      }

      function loadSpawnPoint() {
        return loadStoredSpawnPoint(spawnStorageKey, { x: 0, y: 0, z: 0, yaw: Math.PI / 4 });
      }

      function saveSpawnPoint(point) {
        activeSpawnPoint = {
          x: point.x,
          y: point.y,
          z: point.z,
          yaw: Number.isFinite(point.yaw) ? point.yaw : state.yaw
        };

        saveStoredSpawnPoint(spawnStorageKey, activeSpawnPoint);

        spawnStatus.textContent = `Spawn: ${formatXYZ(activeSpawnPoint)} facing ${formatYaw(activeSpawnPoint.yaw)}`;
        spawnCoordsReadout.textContent = `Spawn XYZ: ${formatXYZ(activeSpawnPoint)} facing ${formatYaw(activeSpawnPoint.yaw)}`;
        updateBushesCollectedReadout();
      }

      activeSpawnPoint = shouldRestoreFullState && savedFullState.spawnPoint
        ? {
            x: Number(savedFullState.spawnPoint.x) || 0,
            y: Number(savedFullState.spawnPoint.y) || 0,
            z: Number(savedFullState.spawnPoint.z) || 0,
            yaw: Number.isFinite(Number(savedFullState.spawnPoint.yaw)) ? Number(savedFullState.spawnPoint.yaw) : Math.PI / 4
          }
        : loadSpawnPoint();
      spawnStatus.textContent = `Spawn: ${formatXYZ(activeSpawnPoint)} facing ${formatYaw(activeSpawnPoint.yaw)}`;
      spawnCoordsReadout.textContent = `Spawn XYZ: ${formatXYZ(activeSpawnPoint)} facing ${formatYaw(activeSpawnPoint.yaw)}`;

      const {
        renderer,
        scene,
        camera,
        state,
        keys,
        lodFogCurtain,
        horizonHazeDisk
      } = createSceneSetup({ THREE, canvas });

      const seedNumber = hashStringToUint32(seedText);
      const cloudLayer = createCloudLayer({
        THREE,
        scene,
        state,
        seedNumber,
        smoothstep
      });
      const updateCloudLayer = cloudLayer.updateCloudLayer;

      let initialFrameRendered = false;
      let allAssetsLoaded = false;

      let loadingFallbackTimer = window.setTimeout(() => {
        // Safety valve: if an asset or cached state gets weird, do not trap the player
        // behind the loading screen forever like a browser-themed purgatory exhibit.
        allAssetsLoaded = true;
        initialFrameRendered = true;
        setLocalStorageStatus("ready (loading fallback)");
        hideLoadingScreen();
      }, 6500);

      function maybeFinishLoading() {
        if (!initialFrameRendered || !allAssetsLoaded) return;

        if (loadingFallbackTimer) {
          window.clearTimeout(loadingFallbackTimer);
          loadingFallbackTimer = null;
        }

        requestAnimationFrame(() => {
          hideLoadingScreen();
        });
      }

      const graphicsMaterials = createMaterialPipeline({
        THREE,
        renderer,
        pendingSphereTexturePath,
        sphereTextureSelect,
        sphereTextureStatus,
        onAssetsLoaded: () => {
          allAssetsLoaded = true;
          maybeFinishLoading();
        },
        onAssetError: () => {
          allAssetsLoaded = true;
          maybeFinishLoading();
        }
      });

      const {
        startupSphereTexturePath,
        applySphereTexture,
        addSphereTextureOption,
        discoverSphereTextures,
        updateAnimatedMaterials,
        createPlayerMaterial,
        grassMaterial,
        dirtMaterial,
        waterMaterial,
        waterSurfaceMaterial,
        sandMaterial,
        rubbleMaterial,
        rubbleCrackOverlay01Material,
        rubbleCrackOverlay02Material,
        gridMaterial,
        pineTreeMaterial,
        flatPineTreeMaterial,
        pineTreePlaneGeometry,
        flatPineTreePlaneGeometry,
        treeVisibleBottomTrimRatio
      } = graphicsMaterials;

      const tileSize = 4.0;

      /*
        Ball Mode:
        A rollable sphere character with camera follow.
        It is deliberately simple: movement is tied to the camera yaw, and the sphere visually rolls.
      */
      const player = {
        mesh: null,
        velocity: new THREE.Vector3(),
        verticalVelocity: 0,
        // Slightly smaller than a single generated tile so the player fits inside one world block.
        // tileSize is 4.0, so diameter stays under that footprint.
        radius: 1.9,
        acceleration: 185,
        maxSpeed: 128,
        sprintMultiplier: 1.85,
        sprintMaxSpeedMultiplier: 1.65,
        sprintJumpMultiplier: 1.72,
        airAcceleration: 72,
        swimAcceleration: 118,
        swimMaxSpeed: 86,
        damping: 0.93,
        airDamping: 0.985,
        waterDamping: 0.955,
        gravity: 185,
        waterGravity: 26,
        buoyancySpring: 24,
        swimDiveForce: 140,
        sinkForce: 128,
        waterDepthOffset: 0,
        maxWaterDepthOffset: 180,
        waterDepthAdjustSpeed: 42,
        jumpVelocity: 72,
        grounded: false,
        jumpLandingArmed: false,
        inWater: false,
        underwater: false,
        waterSurfaceY: -Infinity,
        waterBlend: 0,
        cameraWaterBlend: 0,
        bounceTimer: 0,
        bounceDuration: 0.22,
        bounceAmount: 0.16,
        launchStretchTimer: 0,
        launchStretchDuration: 0.34,
        launchStretchAmount: 0.28,
        wasSprintingAudio: false,
        lastSprintSpringAt: 0,
        yawOffset: 0
      };

      sphereTextureSelect.addEventListener("change", () => {
        applySphereTexture(sphereTextureSelect.value);
      });

      discoverSphereTextures();

      const playerGeometry = new THREE.SphereGeometry(player.radius, 32, 20);
      const playerMaterial = createPlayerMaterial();

      sphereTextureSelect.value = startupSphereTexturePath;
      applySphereTexture(startupSphereTexturePath);
      player.mesh = new THREE.Mesh(playerGeometry, playerMaterial);
      player.mesh.position.set(activeSpawnPoint.x, activeSpawnPoint.y || 80, activeSpawnPoint.z);
      player.mesh.visible = isThirdPersonMode;
      scene.add(player.mesh);
      markBackgroundMusicReady();
      let audioHandler = null;
      const surfaceObjects = createSurfaceObjects({
        THREE,
        scene,
        renderer,
        camera,
        player,
        deletedTreeKeys,
        saveDeletedTreeKeys,
        getShowGridLines: () => showGridLines,
        getHideTrees: () => hideTrees,
        getAudioHandler: () => audioHandler,
        getTerrainHeightAtWorld: (x, z) => getTerrainHeightAtWorld(x, z),
        tileSize,
        rubbleMaterial,
        getIsLeftControlRubbleAbsorbActive: () => keys.has("ControlLeft"),
        onRubbleCollected: () => {
          rubbleCollectedCount += 1;
          saveRubbleCollectedCount();
          updateBushesCollectedReadout();
        },
        onTreeDeleted: ({ wasAlreadyDeleted }) => {
          if (!wasAlreadyDeleted) {
            bushesCollectedCount += 1;
            saveBushesCollectedCount();
            updateBushesCollectedReadout();
          }
        }
      });

      const {
        treeSprites,
        treeColliders,
        treeHitboxGridObjects,
        flattenedTreeClickTargets,
        getTreeColliderKey,
        buildTreeHitboxGrid,
        handleFlattenedTreeClick,
        cancelFlattenedTreeClickHold,
        updateFlattenedTreeHover,
        updateTreeFlattening,
        updateLooseRubbleEntities,
        registerLooseRubbleEntity,
        fireRubbleProjectile,
        handleLooseRubbleClick,
        cancelLooseRubbleClickHold,
        updateLooseRubbleHover
      } = surfaceObjects;


      function syncModeReadout() {
        playerController.syncModeReadout();
      }

      function switchCameraMode(nextMode) {
        playerController.switchCameraMode(nextMode);
      }

      liveCameraModeSelect.addEventListener("change", () => {
        switchCameraMode(liveCameraModeSelect.value);
      });

      window.__setSphereSpawnPoint = () => {
        if (!isThirdPersonMode || !player.mesh) {
          spawnStatus.textContent = "Spawn: only available in Ball Mode";
          return;
        }

        saveSpawnPoint({
          x: player.mesh.position.x,
          y: player.mesh.position.y,
          z: player.mesh.position.z,
          yaw: state.yaw
        });
      };

      /*
        Chunked terrain settings.
        This is not truly infinite, because computers are rude and finite,
        but chunks generate deterministically forever as you move.
      */
      const heightStep = 3.0;
      const chunkTiles = 40;
      const chunkWorldSize = chunkTiles * tileSize;
      const chunkRadius = 2; // 5x5 high-detail chunks around camera. Startup must not eat the browser alive.
      const keepDetailedRadius = chunkRadius + 1;
      const distantLodRadius = 5;
      const lodStep = 8; // one distant tile represents 8x8 real terrain tiles.
      const maxDistantLodChunks = 48;
      const maxLodBuildsPerFrame = 1;
      const lodBuildQueue = [];
      const queuedLodChunkKeys = new Set();
      const maxHeightLevels = 48;
      const seaLevel = 8;
      const loadedChunks = new Map();
      const distantLodChunks = new Map();
      const gridLineObjects = new Set();
      const rubbleHitboxGridObjects = new Set();
      const rubbleObjects = new Map();
      const rubbleCrackStates = new Map();
      const rubbleCrackLandingCounts = new Map();
      seaLevelReadout.textContent = `Sea level: ${seaLevel}`;

      const saveLoadState = createSaveLoadState({
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
        getCurrentCameraMode: () => currentCameraMode,
        getActiveSpawnPoint: () => activeSpawnPoint,
        getShowGridLines: () => showGridLines,
        getHideMinimap: () => hideMinimap,
        getHideTrees: () => hideTrees,
        getDeletedTreeKeys: () => deletedTreeKeys,
        getDeletedRubbleKeys: () => deletedRubbleKeys,
        getBushesCollectedCount: () => bushesCollectedCount,
        getRubbleCollectedCount: () => rubbleCollectedCount,
        getBushInventorySlotCounts,
        getRubbleInventorySlotCounts,
        getCameraState: () => state,
        getPlayer: () => player,
        getIsThirdPersonMode: () => isThirdPersonMode,
        setLocalStorageStatus,
        setShowGridLines,
        setHideMinimapState: (value) => {
          hideMinimap = Boolean(value);
          hideMinimapCheckbox.checked = hideMinimap;
          minimap.classList.toggle("hidden", hideMinimap);
        },
        setHideTreesState: (value) => {
          hideTrees = Boolean(value);
          hideTreesCheckbox.checked = hideTrees;
          if (window.__setTreeVisibility) {
            window.__setTreeVisibility(!hideTrees);
          }
        },
        setMinimapZoomValue: (value) => {
          minimapZoomSlider.value = String(value);
        },
        addSphereTextureOption,
        applySphereTexture,
        updateChunks: () => updateChunks(),
        updateCameraPosition: () => updateCameraPosition()
      });

      const saveFullGameState = () => {
        saveDeletedTreeKeys();
        saveDeletedRubbleKeys();
        saveBushesCollectedCount();
        saveRubbleCollectedCount();
        saveBushInventorySlotCounts();
        saveRubbleInventorySlotCounts();
        saveLoadState.saveFullGameState();
      };
      const clearAllLocalStorage = saveLoadState.clearAllLocalStorage;
      const restoreFullGameState = saveLoadState.restoreFullGameState;
      const loadWorldCache = saveLoadState.loadWorldCache;
      const saveWorldCache = saveLoadState.saveWorldCache;
      const markWorldCacheDirty = saveLoadState.markWorldCacheDirty;

      saveLoadState.restoreUiState(savedFullState);

      setupStorageButtons({
        saveStateButton,
        clearLocalStorageLink,
        loadingClearLocalStorageButton,
        onSaveState: saveFullGameState,
        onClearStorage: clearAllLocalStorage
      });


      const baseGenerator = createBaseGenerator({
        THREE,
        scene,
        camera,
        state,
        seedNumber,
        seaLevel,
        maxHeightLevels,
        tileSize,
        heightStep,
        chunkTiles,
        chunkRadius,
        keepDetailedRadius,
        distantLodRadius,
        lodStep,
        maxDistantLodChunks,
        maxLodBuildsPerFrame,
        lodBuildQueue,
        queuedLodChunkKeys,
        loadedChunks,
        distantLodChunks,
        gridLineObjects,
        rubbleHitboxGridObjects,
        rubbleObjects,
        rubbleCrackStates,
        rubbleCrackLandingCounts,
        treeSprites,
        treeColliders,
        treeHitboxGridObjects,
        flattenedTreeClickTargets,
        deletedTreeKeys,
        deletedRubbleKeys,
        saveDeletedRubbleKeys,
        grassMaterial,
        sandMaterial,
        dirtMaterial,
        waterMaterial,
        waterSurfaceMaterial,
        rubbleMaterial,
        rubbleCrackOverlay01Material,
        rubbleCrackOverlay02Material,
        gridMaterial,
        pineTreePlaneGeometry,
        flatPineTreePlaneGeometry,
        pineTreeMaterial,
        flatPineTreeMaterial,
        treeVisibleBottomTrimRatio,
        getTreeColliderKey,
        buildTreeHitboxGrid,
        getHideTrees: () => hideTrees,
        getShowGridLines: () => showGridLines,
        markWorldCacheDirty,
        chunkReadout,
        distantChunkReadout
      });

      const {
        hash2D,
        lerp,
        smoothNoise,
        fbm,
        ridgedNoise,
        plateauNoise,
        getTerrainSampleAtTile,
        getHeightLevelAtTile,
        getWaterLevelAtTile,
        getTerrainHeightAtWorld,
        getVisibleSurfaceHeightAtWorld,
        getRubbleSurfaceHeightAtWorld,
        getSolidSurfaceHeightAtWorld,
        getWaterSurfaceHeightAtWorld,
        isWaterAtWorld,
        getTreeSampleAtTile,
        findRubblePileAtWorld,
        advanceRubbleCrackStateAtWorld,
        advanceRubbleHoldCrackAtWorld,
        convertRubblePileAtWorldToLooseRagdoll,
        buildChunk,
        disposeChunk,
        updateChunks,
        processDistantLodQueue,
        updateTreeSpritesFacingCamera
      } = baseGenerator;

      window.__setTileGridVisibility = (visible) => {
        showGridLines = visible;
        for (const gridLines of gridLineObjects) {
          gridLines.visible = visible;
        }

        for (const hitboxGrid of treeHitboxGridObjects) {
          hitboxGrid.visible = visible && !hideTrees;
        }

        for (const hitboxGrid of rubbleHitboxGridObjects) {
          hitboxGrid.visible = visible;
        }
      };


      const staticRubbleClickPointer = new THREE.Vector2();
      const staticRubbleClickRaycaster = new THREE.Raycaster();
      const staticRubbleHoldState = {
        rubbleGroup: null,
        pointerId: null,
        timer: null,
        converted: false
      };
      const STATIC_RUBBLE_HOLD_TICK_MS = 500;
      const CLICKABLE_TILE_RADIUS = 10;

      function isWorldPointWithinPlayerClickRadius(x, z, radiusTiles = CLICKABLE_TILE_RADIUS) {
        if (!player?.mesh) return false;
        const radiusWorld = Math.max(0, Number(radiusTiles) || 0) * tileSize;
        const dx = x - player.mesh.position.x;
        const dz = z - player.mesh.position.z;
        return dx * dx + dz * dz <= radiusWorld * radiusWorld;
      }

      function isStaticRubbleWithinPlayerClickRadius(rubbleGroup) {
        if (!rubbleGroup) return false;
        const worldPosition = new THREE.Vector3();
        rubbleGroup.getWorldPosition(worldPosition);
        return isWorldPointWithinPlayerClickRadius(worldPosition.x, worldPosition.z);
      }

      function getStaticRubblePileFromEvent(event) {
        if (!event || !renderer || !camera || !rubbleObjects || rubbleObjects.size === 0) return null;

        const rect = renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        staticRubbleClickPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        staticRubbleClickPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        staticRubbleClickRaycaster.setFromCamera(staticRubbleClickPointer, camera);

        const candidates = [...rubbleObjects.values()].filter((rubbleGroup) => (
          rubbleGroup &&
          rubbleGroup.visible !== false &&
          rubbleGroup.parent &&
          rubbleGroup.userData?.isRubblePile
        ));
        if (!candidates.length) return null;

        const hits = staticRubbleClickRaycaster.intersectObjects(candidates, true);
        for (const hit of hits) {
          let object = hit.object;
          while (object) {
            if (object.userData?.isRubblePile) {
              return isStaticRubbleWithinPlayerClickRadius(object) ? object : null;
            }
            object = object.parent;
          }
        }

        return null;
      }

      function updateStaticRubbleHover(event) {
        return getStaticRubblePileFromEvent(event);
      }

      function clearStaticRubbleHoldTimer() {
        if (staticRubbleHoldState.timer) {
          window.clearInterval(staticRubbleHoldState.timer);
          staticRubbleHoldState.timer = null;
        }
      }

      function convertHeldStaticRubbleToLooseRagdoll(rubbleGroup) {
        if (!rubbleGroup || staticRubbleHoldState.converted) return false;

        const worldPosition = new THREE.Vector3();
        rubbleGroup.getWorldPosition(worldPosition);
        const looseRubble = convertRubblePileAtWorldToLooseRagdoll(worldPosition.x, worldPosition.z);
        if (looseRubble) {
          staticRubbleHoldState.converted = true;
          clearStaticRubbleHoldTimer();
          registerLooseRubbleEntity(looseRubble);
          return true;
        }

        return false;
      }

      function tickStaticRubbleHoldDamage() {
        const rubbleGroup = staticRubbleHoldState.rubbleGroup;
        if (!rubbleGroup || !rubbleGroup.parent || !rubbleGroup.userData?.isRubblePile) {
          clearStaticRubbleHoldTimer();
          return false;
        }

        if (audioHandler && typeof audioHandler.playTreeFlattenCrack === "function") {
          audioHandler.playTreeFlattenCrack();
        }

        const worldPosition = new THREE.Vector3();
        rubbleGroup.getWorldPosition(worldPosition);
        const result = advanceRubbleHoldCrackAtWorld(worldPosition.x, worldPosition.z);

        if (result?.shouldRagdoll) {
          convertHeldStaticRubbleToLooseRagdoll(rubbleGroup);
        }

        return Boolean(result?.hit);
      }

      function handleStaticRubbleClick(event) {
        if (!event || event.button !== 0) return false;

        const rubbleGroup = getStaticRubblePileFromEvent(event);
        if (!rubbleGroup) return false;

        clearStaticRubbleHoldTimer();
        staticRubbleHoldState.rubbleGroup = rubbleGroup;
        staticRubbleHoldState.pointerId = event.pointerId ?? null;
        staticRubbleHoldState.converted = false;

        const currentHoldCount = Math.max(0, Math.round(Number(rubbleGroup.userData?.rubbleClickHoldCount) || 0));
        const currentCrackState = Math.max(0, Math.round(Number(rubbleGroup.userData?.rubbleCrackState) || 0));
        if (currentHoldCount >= 10 || currentCrackState >= 2) {
          if (audioHandler && typeof audioHandler.playTreeFlattenCrack === "function") {
            audioHandler.playTreeFlattenCrack();
          }
          convertHeldStaticRubbleToLooseRagdoll(rubbleGroup);
          return true;
        }

        tickStaticRubbleHoldDamage();
        if (!staticRubbleHoldState.converted) {
          staticRubbleHoldState.timer = window.setInterval(tickStaticRubbleHoldDamage, STATIC_RUBBLE_HOLD_TICK_MS);
        }

        return true;
      }

      function cancelStaticRubbleClickHold(pointerId = null) {
        if (!staticRubbleHoldState.rubbleGroup) return false;
        if (pointerId !== null && staticRubbleHoldState.pointerId !== null && staticRubbleHoldState.pointerId !== pointerId) return false;

        clearStaticRubbleHoldTimer();
        staticRubbleHoldState.rubbleGroup = null;
        staticRubbleHoldState.pointerId = null;
        staticRubbleHoldState.converted = false;
        return true;
      }

      window.__setTreeVisibility = (visible) => {
        hideTrees = !visible;
        hideTreesCheckbox.checked = hideTrees;

        for (const sprite of treeSprites) {
          sprite.visible = visible;
        }

        for (const hitboxGrid of treeHitboxGridObjects) {
          hitboxGrid.visible = visible && showGridLines;
        }
      };

      const graphicsPipeline = createGraphicsPipeline({
        THREE,
        camera,
        state,
        player,
        tileSize,
        heightStep,
        seaLevel,
        maxHeightLevels,
        chunkWorldSize,
        distantLodRadius,
        lodFogCurtain,
        horizonHazeDisk,
        underwaterOverlay,
        minimap,
        minimapCanvas,
        minimapZoomSlider,
        minimapZoomStatus,
        sphereCoordsReadout,
        cameraDirectionReadout,
        spawnCoordsReadout,
        deletedTreeKeys,
        getTreeColliderKey,
        getTerrainSampleAtTile,
        getTreeSampleAtTile,
        getActiveSpawnPoint: () => activeSpawnPoint,
        getIsThirdPersonMode: () => isThirdPersonMode,
        getHideMinimap: () => hideMinimap,
        getHideTrees: () => hideTrees,
        getShowGridLines: () => showGridLines,
        formatXYZ,
        formatYaw,
        updateBushesCollectedReadout
      });

      const updateLodFogCurtain = graphicsPipeline.updateLodFogCurtain;
      const updateUnderwaterOverlay = graphicsPipeline.updateUnderwaterOverlay;
      const updateNerdStats = graphicsPipeline.updateNerdStats;
      const drawMinimap = graphicsPipeline.drawMinimap;
      graphicsPipeline.attachMinimapControls();

      audioHandler = createAudioHandler({
        clamp,
        getPlayer: () => player,
        getIsThirdPersonMode: () => isThirdPersonMode
      });
      applyVolumeOptions();

      const rubbleFirePointer = new THREE.Vector2();
      const rubbleFireRaycaster = new THREE.Raycaster();

      function handleInventoryRubbleFire(event) {
        if (!event || event.button !== 0) return false;
        if (!player?.mesh || typeof fireRubbleProjectile !== "function") return false;
        if (!hasInventoryItemInSlot?.(6, "rubble")) return false;

        const rect = renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;

        rubbleFirePointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        rubbleFirePointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        rubbleFireRaycaster.setFromCamera(rubbleFirePointer, camera);

        const direction = rubbleFireRaycaster.ray.direction.clone().normalize();
        const origin = player.mesh.position.clone();

        const fired = fireRubbleProjectile(origin, direction, 142);
        if (!fired) return false;

        if (!consumeInventoryItemFromSlot?.(6, "rubble", 1)) {
          if (fired.parent) fired.parent.remove(fired);
          return false;
        }

        rubbleCollectedCount = Math.max(0, rubbleCollectedCount - 1);
        saveRubbleCollectedCount();
        updateBushesCollectedReadout();
        return true;
      }

      const playerController = createPlayerController({
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
        getActiveSpawnPoint: () => activeSpawnPoint,
        getIsThirdPersonMode: () => isThirdPersonMode,
        setCameraModeState: (nextCameraMode, nextIsThirdPersonMode) => {
          currentCameraMode = nextCameraMode;
          isThirdPersonMode = nextIsThirdPersonMode;
        },
        getTerrainHeightAtWorld,
        getVisibleSurfaceHeightAtWorld,
        getRubbleSurfaceHeightAtWorld,
        getSolidSurfaceHeightAtWorld,
        getWaterSurfaceHeightAtWorld,
        onRubbleLanding: ({ x, z }) => {
          const rubbleLandingResult = advanceRubbleCrackStateAtWorld(x, z);
          if (rubbleLandingResult?.hit && audioHandler && typeof audioHandler.playTreeFlattenCrack === "function") {
            audioHandler.playTreeFlattenCrack();
          }

          if (rubbleLandingResult?.hit && rubbleLandingResult.landingCount >= 4 && rubbleLandingResult.state >= 2) {
            const looseRubble = convertRubblePileAtWorldToLooseRagdoll(x, z);
            if (looseRubble) {
              registerLooseRubbleEntity(looseRubble);
            }
          }
        },
        updateChunks,
        updateLodFogCurtain,
        handleFlattenedTreeClick,
        cancelFlattenedTreeClickHold,
        updateFlattenedTreeHover,
        handleStaticRubbleClick,
        cancelStaticRubbleClickHold,
        updateStaticRubbleHover,
        handleLooseRubbleClick,
        cancelLooseRubbleClickHold,
        updateLooseRubbleHover,
        handleInventoryRubbleFire,
        isTextEntryTarget,
        toggleBushInventory,
        getActiveBushCarryCount,
        cancelBushCarryToLeftmostSlot
      });

      const resetCamera = playerController.resetCamera;
      const getForwardRightVectors = playerController.getForwardRightVectors;
      const handleMovement = playerController.handleMovement;
      const updateTargetHeight = playerController.updateTargetHeight;
      const updateCameraPosition = playerController.updateCameraPosition;

      playerController.attachInputListeners();

      const clock = new THREE.Clock();

      function animate() {
        const deltaSeconds = Math.min(clock.getDelta(), 0.05);
        const elapsedSeconds = clock.elapsedTime;

        handleMovement(deltaSeconds);
        updateTargetHeight();
        updateCameraPosition();
        updateUnderwaterOverlay(deltaSeconds);
        updateNerdStats();
        updateTreeFlattening(deltaSeconds);
        updateLooseRubbleEntities(deltaSeconds);
        updateCloudLayer(deltaSeconds);
        updateLodFogCurtain();
        processDistantLodQueue();
        saveWorldCache(false);

        graphicsPipeline.updateMinimapFrame();

        updateAnimatedMaterials(deltaSeconds, elapsedSeconds);

        updateTreeSpritesFacingCamera();

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      }

      loadWorldCache();
      syncModeReadout();
      resetCamera();
      restoreFullGameState();
      animate();

      window.addEventListener("beforeunload", () => {
        saveWorldCache(true);
      });

      requestAnimationFrame(() => {
        initialFrameRendered = true;
        maybeFinishLoading();
      });
    }
  
