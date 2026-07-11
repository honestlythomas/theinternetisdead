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
    } from "./surface-entities.js?v=stick-crafting-20260710";
    import { createBaseGenerator } from "./base-generator.js?v=stackable-rubble-stick-20260710";
    import {
      createCloudLayer,
      createGraphicsPipeline,
      createMaterialPipeline,
      createSceneSetup
    } from "./graphics-pipeline.js?v=rubble-slot-projectile-20260508";
    import { createNpcEnemiesController } from "./npc-enemies-controller.js?v=rare-spring-boss-rate-333-20260710";
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
    const springsCollectedReadout = document.getElementById("springsCollectedReadout");
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
    const setInventorySpringCounts = bushInventoryController.setSpringCounts;
    const setInventoryPlankCounts = bushInventoryController.setPlankCounts;
    const setInventoryStickCounts = bushInventoryController.setStickCounts;
    const normalizeRubbleInventorySlotCounts = bushInventoryController.normalizeRubbleSlotCounts;
    const normalizeSpringInventorySlotCounts = bushInventoryController.normalizeSpringSlotCounts;
    const normalizePlankInventorySlotCounts = bushInventoryController.normalizePlankSlotCounts;
    const normalizeStickInventorySlotCounts = bushInventoryController.normalizeStickSlotCounts;
    const getBushInventorySlotCounts = bushInventoryController.getCounts;
    const getRubbleInventorySlotCounts = bushInventoryController.getRubbleCounts;
    const getSpringInventorySlotCounts = bushInventoryController.getSpringCounts;
    const getPlankInventorySlotCounts = bushInventoryController.getPlankCounts;
    const getStickInventorySlotCounts = bushInventoryController.getStickCounts;
    const toggleBushInventory = bushInventoryController.toggleOpen;
    const getActiveBushCarryCount = bushInventoryController.getActiveCarryCount;
    const cancelBushCarryToLeftmostSlot = bushInventoryController.cancelCarryToLeftmostSlot;
    const consumeInventoryItemFromSlot = bushInventoryController.consumeItemFromSlot;
    const hasInventoryItemInSlot = bushInventoryController.hasItemInSlot;
    const getInventoryItemInSlot = bushInventoryController.getItemInSlot;
    let clearBlueSlotPlacementPreview = () => {};
    let activeInventoryActionSlot = "blue";

    function setActiveInventoryActionSlot(nextSlot = "blue") {
      activeInventoryActionSlot = nextSlot === "red" ? "red" : "blue";
      for (const slot of bushInventorySlots) {
        const isBlueAction = slot.dataset.bushSlot === "0";
        const isRedAction = slot.dataset.bushSlot === "6";
        if (!isBlueAction && !isRedAction) continue;
        const isActive = (activeInventoryActionSlot === "blue" && isBlueAction) ||
          (activeInventoryActionSlot === "red" && isRedAction);
        slot.classList.toggle("action-active", isActive);
        slot.classList.toggle("action-inactive", !isActive);
      }
      if (activeInventoryActionSlot !== "blue") {
        clearBlueSlotPlacementPreview();
      }
    }

    function toggleActiveInventoryActionSlot() {
      setActiveInventoryActionSlot(activeInventoryActionSlot === "blue" ? "red" : "blue");
    }

    setActiveInventoryActionSlot("blue");

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

      if (!isTextEntry && event.code === "Tab") {
        event.preventDefault();
        if (!event.repeat) {
          toggleActiveInventoryActionSlot();
        }
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
      const springsCollectedStorageKey = `new-3D-game.springs-collected.${seedText}`;
      const bushInventoryStorageKey = `new-3D-game.bush-inventory.${seedText}`;
      const rubbleInventoryStorageKey = `new-3D-game.rubble-inventory.${seedText}`;
      const springInventoryStorageKey = `new-3D-game.spring-inventory.${seedText}`;
      const plankInventoryStorageKey = `new-3D-game.plank-inventory.${seedText}`;
      const stickInventoryStorageKey = `new-3D-game.stick-inventory.${seedText}`;
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

      function loadSpringsCollectedCount() {
        const localCount = loadLocalCount(springsCollectedStorageKey, {
          minimum: 0,
          warningMessage: "Could not load springs collected local count:"
        });
        return Math.max(localCount, loadLegacySessionCount(springsCollectedStorageKey));
      }

      let springsCollectedCount = loadSpringsCollectedCount();
      if (shouldRestoreFullState && savedFullState?.collected && Number.isFinite(Number(savedFullState.collected.springs))) {
        springsCollectedCount = Math.max(springsCollectedCount, Math.round(Number(savedFullState.collected.springs)));
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

      function loadSpringInventorySlotCounts() {
        return normalizeSpringInventorySlotCounts(
          springsCollectedCount,
          (() => {
            const localLayout = loadLocalJsonArray(springInventoryStorageKey, {
              warningMessage: "Could not load spring inventory local layout:"
            });
            const legacyLayout = loadLegacySessionJsonArray(springInventoryStorageKey);
            return localLayout.length ? localLayout : legacyLayout;
          })()
        );
      }

      function getPlanksInInventoryCount() {
        return getPlankInventorySlotCounts().reduce((sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)), 0);
      }

      function getSticksInInventoryCount() {
        return getStickInventorySlotCounts().reduce((sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)), 0);
      }

      function loadPlankInventorySlotCounts() {
        const layout = (() => {
          if (shouldRestoreFullState && Array.isArray(savedFullState?.inventory?.planks)) {
            return savedFullState.inventory.planks;
          }
          const localLayout = loadLocalJsonArray(plankInventoryStorageKey, {
            warningMessage: "Could not load plank inventory local layout:"
          });
          const legacyLayout = loadLegacySessionJsonArray(plankInventoryStorageKey);
          return localLayout.length ? localLayout : legacyLayout;
        })();
        const total = layout.reduce((sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)), 0);
        return normalizePlankInventorySlotCounts(total, layout);
      }

      function loadStickInventorySlotCounts() {
        const layout = (() => {
          if (shouldRestoreFullState && Array.isArray(savedFullState?.inventory?.sticks)) {
            return savedFullState.inventory.sticks;
          }
          const localLayout = loadLocalJsonArray(stickInventoryStorageKey, {
            warningMessage: "Could not load stick inventory local layout:"
          });
          const legacyLayout = loadLegacySessionJsonArray(stickInventoryStorageKey);
          return localLayout.length ? localLayout : legacyLayout;
        })();
        const total = layout.reduce((sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)), 0);
        return normalizeStickInventorySlotCounts(total, layout);
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

      function saveSpringInventorySlotCounts(counts = getSpringInventorySlotCounts()) {
        saveLocalJson(
          springInventoryStorageKey,
          normalizeSpringInventorySlotCounts(springsCollectedCount, counts),
          { warningMessage: "Could not save spring inventory local layout:" }
        );
      }

      function savePlankInventorySlotCounts(counts = getPlankInventorySlotCounts()) {
        saveLocalJson(
          plankInventoryStorageKey,
          normalizePlankInventorySlotCounts(
            counts.reduce((sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)), 0),
            counts
          ),
          { warningMessage: "Could not save plank inventory local layout:" }
        );
      }

      function saveStickInventorySlotCounts(counts = getStickInventorySlotCounts()) {
        saveLocalJson(
          stickInventoryStorageKey,
          normalizeStickInventorySlotCounts(
            counts.reduce((sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)), 0),
            counts
          ),
          { warningMessage: "Could not save stick inventory local layout:" }
        );
      }

      bushInventoryController.setLayoutChangedHandler((bushCounts, rubbleCounts, springCounts, plankCounts, stickCounts) => {
        saveBushInventorySlotCounts(bushCounts);
        saveRubbleInventorySlotCounts(rubbleCounts);
        saveSpringInventorySlotCounts(springCounts);
        savePlankInventorySlotCounts(plankCounts);
        saveStickInventorySlotCounts(stickCounts);
      });
      setBushInventoryCounts(bushesCollectedCount, loadBushInventorySlotCounts());
      setInventoryRubbleCounts(rubbleCollectedCount, loadRubbleInventorySlotCounts());
      setInventorySpringCounts(springsCollectedCount, loadSpringInventorySlotCounts());
      const plankInventorySlotCounts = loadPlankInventorySlotCounts();
      setInventoryPlankCounts(
        plankInventorySlotCounts.reduce((sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)), 0),
        plankInventorySlotCounts
      );
      const stickInventorySlotCounts = loadStickInventorySlotCounts();
      setInventoryStickCounts(
        stickInventorySlotCounts.reduce((sum, value) => sum + Math.max(0, Math.round(Number(value) || 0)), 0),
        stickInventorySlotCounts
      );

      function updateCollectedReadouts() {
        if (bushesCollectedReadout) {
          bushesCollectedReadout.textContent = `Collected Bushes: ${bushesCollectedCount}`;
        }

        if (rubbleCollectedReadout) {
          rubbleCollectedReadout.textContent = `Collected Rubble: ${rubbleCollectedCount}`;
        }

        if (springsCollectedReadout) {
          springsCollectedReadout.textContent = `Collected Springs: ${springsCollectedCount}`;
        }
      }

      function syncBushInventorySlots() {
        setBushInventoryCounts(bushesCollectedCount, getBushInventorySlotCounts());
        saveBushInventorySlotCounts();
      }

      function syncRubbleInventorySlots() {
        setInventoryRubbleCounts(rubbleCollectedCount, getRubbleInventorySlotCounts());
        saveRubbleInventorySlotCounts();
      }

      function syncSpringInventorySlots() {
        setInventorySpringCounts(springsCollectedCount, getSpringInventorySlotCounts());
        saveSpringInventorySlotCounts();
      }

      function syncPlankInventorySlots() {
        const planksInInventory = getPlanksInInventoryCount();
        setInventoryPlankCounts(planksInInventory, getPlankInventorySlotCounts());
        savePlankInventorySlotCounts();
      }

      function syncStickInventorySlots() {
        const sticksInInventory = getSticksInInventoryCount();
        setInventoryStickCounts(sticksInInventory, getStickInventorySlotCounts());
        saveStickInventorySlotCounts();
      }

      bushInventoryController.setPlanksCraftedHandler(({ bushesConsumed = 3 } = {}) => {
        bushesCollectedCount = Math.max(0, bushesCollectedCount - Math.max(0, Math.round(Number(bushesConsumed) || 0)));
        saveBushesCollectedCount();
        updateCollectedReadouts();
      });

      bushInventoryController.setStickCraftedHandler(() => {
        savePlankInventorySlotCounts();
        saveStickInventorySlotCounts();
      });

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

      function saveSpringsCollectedCount() {
        saveLocalCount(springsCollectedStorageKey, springsCollectedCount, {
          warningMessage: "Could not save springs collected local count:"
        });
      }

      updateCollectedReadouts();

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
      saveSpringsCollectedCount();
      saveStickInventorySlotCounts();

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
        updateCollectedReadouts();
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
      let rightClickRubbleVacuumActive = false;
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
        getIsLeftControlRubbleAbsorbActive: () => keys.has("ControlLeft") || rightClickRubbleVacuumActive,
        onRubbleCollected: () => {
          rubbleCollectedCount += 1;
          saveRubbleCollectedCount();
          syncRubbleInventorySlots();
          updateCollectedReadouts();
        },
        onTreeDeleted: ({ wasAlreadyDeleted }) => {
          if (!wasAlreadyDeleted) {
            bushesCollectedCount += 1;
            saveBushesCollectedCount();
            syncBushInventorySlots();
            updateCollectedReadouts();
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
        getSpringsCollectedCount: () => springsCollectedCount,
        getBushInventorySlotCounts,
        getRubbleInventorySlotCounts,
        getSpringInventorySlotCounts,
        getPlankInventorySlotCounts,
        getStickInventorySlotCounts,
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
        saveSpringsCollectedCount();
        saveBushInventorySlotCounts();
        saveRubbleInventorySlotCounts();
        saveSpringInventorySlotCounts();
        savePlankInventorySlotCounts();
        saveStickInventorySlotCounts();
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
        tileToWorldX,
        tileToWorldZ,
        getTreeSampleAtTile,
        getRubbleSampleAtTile,
        findRubblePileAtWorld,
        advanceRubbleCrackStateAtWorld,
        advanceRubbleHoldCrackAtWorld,
        convertRubblePileAtWorldToLooseRagdoll,
        addRubblePile,
        addTreeSprite,
        buildChunk,
        disposeChunk,
        updateChunks,
        processDistantLodQueue,
        updateTreeSpritesFacingCamera
      } = baseGenerator;

      const npcEnemiesController = createNpcEnemiesController({
        THREE,
        scene,
        renderer,
        camera,
        player,
        seedNumber,
        tileSize,
        seaLevel,
        getTerrainSampleAtTile,
        getVisibleSurfaceHeightAtWorld,
        getTreeSampleAtTile,
        hasRedSlotRubble: () => activeInventoryActionSlot === "red" && hasInventoryItemInSlot?.(6, "rubble"),
        consumeRedSlotRubble: () => {
          if (!consumeInventoryItemFromSlot?.(6, "rubble", 1)) return false;
          rubbleCollectedCount = Math.max(0, rubbleCollectedCount - 1);
          saveRubbleCollectedCount();
          updateCollectedReadouts();
          return true;
        },
        onSpringCollected: () => {
          springsCollectedCount += 1;
          saveSpringsCollectedCount();
          syncSpringInventorySlots();
          updateCollectedReadouts();
        },
        renderRadiusTiles: 100,
        cullRadiusTiles: 112
      });
      window.__npcEnemiesController = npcEnemiesController;
      window.__getNpcEnemyCount = () => npcEnemiesController.getActiveEnemyCount();
      window.__getNpcCloudCount = () => npcEnemiesController.getActiveCloudCount();
      const getNpcCloudSurfaceHeightAtWorld = (x, z) => npcEnemiesController.getCloudSurfaceHeightAtWorld(x, z);

      const blueSlotPlacementPointer = new THREE.Vector2();
      const blueSlotPlacementRaycaster = new THREE.Raycaster();
      const blueSlotPlacementTile = {
        type: null,
        tileX: 0,
        tileZ: 0,
        x: 0,
        y: 0,
        z: 0,
        valid: false
      };
      const blueSlotPlacementGroup = new THREE.Group();
      blueSlotPlacementGroup.name = "blue-slot-placement-preview";
      blueSlotPlacementGroup.visible = false;
      blueSlotPlacementGroup.renderOrder = 30;
      const blueSlotPlacementTileMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd64a,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const blueSlotPlacementTileMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(tileSize, tileSize),
        blueSlotPlacementTileMaterial
      );
      blueSlotPlacementTileMesh.rotation.x = -Math.PI * 0.5;
      blueSlotPlacementTileMesh.renderOrder = 30;
      blueSlotPlacementGroup.add(blueSlotPlacementTileMesh);
      let blueSlotPlacementGhost = null;
      let blueSlotPlacementGhostType = null;
      const plankModelTexture = new THREE.TextureLoader().load("assets/png/tv-wood.png");
      plankModelTexture.colorSpace = THREE.SRGBColorSpace;
      plankModelTexture.wrapS = THREE.RepeatWrapping;
      plankModelTexture.wrapT = THREE.RepeatWrapping;
      plankModelTexture.repeat.set(1.8, 1.8);
      scene.add(blueSlotPlacementGroup);
      const placedPlankObjects = new Map();
      const placedStickObjects = new Map();
      const stackableTileHeights = new Map();
      const stackablePlacementTypes = new Set(["rubble", "planks", "stick"]);

      function getPlacedStackCount(stackMap, key) {
        const value = stackMap.get(key);
        if (Array.isArray(value)) return value.filter((object) => object && object.parent).length;
        return value && value.parent ? 1 : 0;
      }

      function addPlacedStackObject(stackMap, key, object) {
        const value = stackMap.get(key);
        if (Array.isArray(value)) {
          value.push(object);
          return value.length;
        }
        if (value && value.parent) {
          stackMap.set(key, [value, object]);
          return 2;
        }
        stackMap.set(key, [object]);
        return 1;
      }

      function isStackablePlacementType(type) {
        return stackablePlacementTypes.has(type);
      }

      function countRubblePilesAtTile(tileX, tileZ) {
        let count = 0;
        for (const rubbleGroup of rubbleObjects.values()) {
          if (!rubbleGroup?.parent || !rubbleGroup.userData?.isRubblePile) continue;
          if (rubbleGroup.userData.rubbleGlobalX === tileX && rubbleGroup.userData.rubbleGlobalZ === tileZ) {
            count += 1;
          }
        }
        return count;
      }

      function getRubbleStackHeightAtTile(tileX, tileZ, baseY) {
        let height = 0;
        for (const rubbleGroup of rubbleObjects.values()) {
          if (!rubbleGroup?.parent || !rubbleGroup.userData?.isRubblePile) continue;
          if (rubbleGroup.userData.rubbleGlobalX !== tileX || rubbleGroup.userData.rubbleGlobalZ !== tileZ) continue;
          const topY = Number(rubbleGroup.userData.rubbleTopY);
          if (Number.isFinite(topY)) {
            height = Math.max(height, topY - baseY);
          }
        }
        return Math.max(0, height);
      }

      function getStackableTileHeight(key, tileX, tileZ, baseY) {
        return Math.max(
          Number(stackableTileHeights.get(key)) || 0,
          getRubbleStackHeightAtTile(tileX, tileZ, baseY)
        );
      }

      function setStackableTileHeight(key, height) {
        stackableTileHeights.set(key, Math.max(Number(stackableTileHeights.get(key)) || 0, height));
      }

      function getPlacedStackSurfaceHeightAtWorld(x, z) {
        const tileX = Math.floor(x / tileSize);
        const tileZ = Math.floor(z / tileSize);
        const key = `${tileX},${tileZ}`;
        const height = Number(stackableTileHeights.get(key)) || 0;
        if (height <= 0) return -Infinity;

        const tileMinX = tileToWorldX(tileX);
        const tileMaxX = tileToWorldX(tileX + 1);
        const tileMinZ = tileToWorldZ(tileZ);
        const tileMaxZ = tileToWorldZ(tileZ + 1);
        if (x < tileMinX || x >= tileMaxX || z < tileMinZ || z >= tileMaxZ) return -Infinity;

        const sample = getTerrainSampleAtTile(tileX, tileZ);
        if (!sample) return -Infinity;
        return sample.landLevel * heightStep + height;
      }

      function disposeBlueSlotPlacementGhost() {
        if (!blueSlotPlacementGhost) return;
        blueSlotPlacementGroup.remove(blueSlotPlacementGhost);
        blueSlotPlacementGhost.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        blueSlotPlacementGhost = null;
        blueSlotPlacementGhostType = null;
      }

      function createBlueSlotPlacementGhost(type) {
        const group = new THREE.Group();
        const ghostMaterial = new THREE.MeshBasicMaterial({
          color: type === "spring" ? 0xff00d6 : (type === "rubble" ? 0x8f867c : (type === "planks" ? 0xd8ad63 : (type === "stick" ? 0x7a441b : 0x42d96b))),
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
          side: THREE.DoubleSide
        });

        if (type === "bush") {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.4, 8), ghostMaterial.clone());
          trunk.position.y = 0.72;
          const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.45, 3.1, 10), ghostMaterial.clone());
          canopy.position.y = 2.65;
          group.add(trunk, canopy);
        } else if (type === "rubble") {
          const chunks = [
            [1.45, 0.62, 1.2, -0.45, 0.34, -0.25],
            [1.05, 0.78, 0.92, 0.5, 0.43, 0.12],
            [0.86, 0.52, 0.74, 0.02, 0.27, 0.56]
          ];
          for (const [sx, sy, sz, x, y, z] of chunks) {
            const rock = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), ghostMaterial.clone());
            rock.position.set(x, y, z);
            rock.rotation.set(0.22 + x * 0.1, y, -0.18 + z * 0.08);
            group.add(rock);
          }
        } else if (type === "spring") {
          const top = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.13, 8, 22), ghostMaterial.clone());
          const waist = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 8, 20), ghostMaterial.clone());
          const bottom = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.13, 8, 22), ghostMaterial.clone());
          top.position.y = 2.3;
          waist.position.y = 1.25;
          bottom.position.y = 0.25;
          top.rotation.x = waist.rotation.x = bottom.rotation.x = Math.PI * 0.5;
          const strandA = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), ghostMaterial.clone());
          const strandB = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), ghostMaterial.clone());
          strandA.position.y = strandB.position.y = 1.25;
          strandA.rotation.z = 0.38;
          strandB.rotation.z = -0.38;
          group.add(top, waist, bottom, strandA, strandB);
        } else if (type === "planks") {
          const deckMaterial = ghostMaterial.clone();
          deckMaterial.map = plankModelTexture;
          deckMaterial.color.set(0xffffff);
          const deck = new THREE.Mesh(new THREE.BoxGeometry(tileSize * 0.88, 0.18, tileSize * 0.88), deckMaterial);
          deck.position.y = 0.11;
          group.add(deck);
        } else if (type === "stick") {
          const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, tileSize, 8), ghostMaterial.clone());
          stick.position.y = tileSize * 0.5;
          group.add(stick);
        }

        return group;
      }

      function syncBlueSlotPlacementGhost(type) {
        if (blueSlotPlacementGhostType === type && blueSlotPlacementGhost) return;
        disposeBlueSlotPlacementGhost();
        blueSlotPlacementGhost = createBlueSlotPlacementGhost(type);
        blueSlotPlacementGhostType = type;
        blueSlotPlacementGroup.add(blueSlotPlacementGhost);
      }

      function getBlueSlotPlacementMeshes() {
        const targets = [];
        for (const chunk of loadedChunks.values()) {
          chunk.traverse((child) => {
            if (child.isMesh && !child.userData?.isRubblePile && !child.userData?.isPineTreeSprite) {
              targets.push(child);
            }
          });
        }
        return targets;
      }

      function getBlueSlotPlacementTarget(event) {
        if (activeInventoryActionSlot !== "blue") return null;
        const item = getInventoryItemInSlot?.(0);
        if (!item || !item.type) return null;
        const rect = renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        blueSlotPlacementPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        blueSlotPlacementPointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        blueSlotPlacementRaycaster.setFromCamera(blueSlotPlacementPointer, camera);
        const hit = blueSlotPlacementRaycaster.intersectObjects(getBlueSlotPlacementMeshes(), false)[0];
        if (!hit) return null;

        const tileX = Math.floor(hit.point.x / tileSize);
        const tileZ = Math.floor(hit.point.z / tileSize);
        const x = tileToWorldX(tileX + 0.5);
        const z = tileToWorldZ(tileZ + 0.5);
        const sample = getTerrainSampleAtTile(tileX, tileZ);
        if (!sample || (sample.waterLevel === seaLevel && sample.landLevel < seaLevel)) return null;

        const key = `${tileX},${tileZ}`;
        const occupiedByTree = treeColliders.has(key) && treeColliders.get(key)?.sprite?.parent;
        const occupiedByRubble = Boolean(findRubblePileAtWorld(x, z));
        const occupiedByPlanks = getPlacedStackCount(placedPlankObjects, key) > 0;
        const occupiedByStick = getPlacedStackCount(placedStickObjects, key) > 0;
        const occupiedByStackable = occupiedByRubble || occupiedByPlanks || occupiedByStick;
        if (occupiedByTree || (occupiedByStackable && !isStackablePlacementType(item.type))) return null;

        const baseY = sample.landLevel * heightStep;
        const stackHeight = isStackablePlacementType(item.type)
          ? getStackableTileHeight(key, tileX, tileZ, baseY)
          : 0;

        return {
          type: item.type,
          tileX,
          tileZ,
          x,
          z,
          y: baseY + stackHeight,
          stackBaseY: baseY,
          stackHeight,
          valid: true
        };
      }

      function setBlueSlotPlacementPreview(target) {
        if (!target) {
          blueSlotPlacementTile.valid = false;
          blueSlotPlacementGroup.visible = false;
          return;
        }

        Object.assign(blueSlotPlacementTile, target);
        syncBlueSlotPlacementGhost(target.type);
        blueSlotPlacementGroup.position.set(target.x, target.y + 0.055, target.z);
        blueSlotPlacementTileMesh.material.color.set(0xffd64a);
        blueSlotPlacementTileMesh.material.opacity = 0.34;
        if (blueSlotPlacementGhost) {
          blueSlotPlacementGhost.position.y = 0.06;
        }
        blueSlotPlacementGroup.visible = true;
      }

      clearBlueSlotPlacementPreview = () => setBlueSlotPlacementPreview(null);

      function updateBlueSlotPlacementHover(event) {
        if (!event) {
          setBlueSlotPlacementPreview(null);
          return null;
        }
        const target = getBlueSlotPlacementTarget(event);
        setBlueSlotPlacementPreview(target);
        return target;
      }

      function spendBlueSlotPlacementItem(type) {
        if (!consumeInventoryItemFromSlot?.(0, type, 1)) return false;
        if (type === "bush") {
          bushesCollectedCount = Math.max(0, bushesCollectedCount - 1);
          saveBushesCollectedCount();
          saveBushInventorySlotCounts();
        } else if (type === "rubble") {
          rubbleCollectedCount = Math.max(0, rubbleCollectedCount - 1);
          saveRubbleCollectedCount();
          saveRubbleInventorySlotCounts();
        } else if (type === "spring") {
          springsCollectedCount = Math.max(0, springsCollectedCount - 1);
          saveSpringsCollectedCount();
          saveSpringInventorySlotCounts();
        } else if (type === "planks") {
          syncPlankInventorySlots();
        } else if (type === "stick") {
          syncStickInventorySlots();
        }
        updateCollectedReadouts();
        return true;
      }

      function placeBushAtTile(target) {
        const sample = getTerrainSampleAtTile(target.tileX, target.tileZ);
        if (!sample) return false;
        const key = getTreeColliderKey(target.tileX, target.tileZ);
        deletedTreeKeys.delete(key);
        saveDeletedTreeKeys();
        const baseScale = tileSize * 3.35;
        addTreeSprite(scene, {
          globalX: target.tileX,
          globalZ: target.tileZ,
          variantName: "placed-single",
          footprintSize: 1,
          x: target.x,
          y: sample.landLevel * heightStep,
          z: target.z,
          scale: baseScale,
          visualWidth: baseScale,
          visualHeight: baseScale * 1.16,
          baseY: sample.landLevel * heightStep,
          topY: sample.landLevel * heightStep + baseScale * 1.16,
          opacity: 0.96
        });
        return true;
      }

      function placeRubbleAtTile(target) {
        const sample = getTerrainSampleAtTile(target.tileX, target.tileZ);
        if (!sample) return false;
        const key = `${target.tileX},${target.tileZ}`;
        deletedRubbleKeys.delete(key);
        saveDeletedRubbleKeys();
        const stackIndex = Math.max(0, countRubblePilesAtTile(target.tileX, target.tileZ));
        const stackKey = `${key}:placed-stack-${stackIndex + 1}`;
        const baseY = sample.landLevel * heightStep;
        const stackHeight = getStackableTileHeight(key, target.tileX, target.tileZ, baseY);
        addRubblePile(scene, {
          key: stackKey,
          globalX: target.tileX,
          globalZ: target.tileZ,
          footprintSize: 1,
          x: target.x,
          y: baseY + stackHeight,
          z: target.z,
          footprintWorld: tileSize,
          spread: tileSize * 0.28,
          baseScale: tileSize * 0.62,
          pieceCount: 7,
          underwater: false,
          heightStretch: 1.08,
          rotationX: 0,
          rotationY: hash2D(target.tileX * 379 - 191, target.tileZ * 379 + 197) * Math.PI * 2
        });
        setStackableTileHeight(key, stackHeight + tileSize * 0.22);
        return true;
      }

      function placeSpringAtTile(target) {
        return Boolean(npcEnemiesController.createPlacedEnemyAtTile?.(target.tileX, target.tileZ));
      }

      function createPlanksModel() {
        const group = new THREE.Group();
        const woodMaterial = new THREE.MeshStandardMaterial({
          map: plankModelTexture,
          color: 0xffffff,
          roughness: 0.76,
          metalness: 0.02
        });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(tileSize * 0.9, 0.28, tileSize * 0.9), woodMaterial);
        deck.position.y = 0.14;
        deck.castShadow = true;
        deck.receiveShadow = true;
        group.add(deck);
        return group;
      }

      function placePlanksAtTile(target) {
        const sample = getTerrainSampleAtTile(target.tileX, target.tileZ);
        if (!sample) return false;
        const key = `${target.tileX},${target.tileZ}`;
        const baseY = sample.landLevel * heightStep;
        const stackHeight = getStackableTileHeight(key, target.tileX, target.tileZ, baseY);
        const group = createPlanksModel();
        group.name = `placed-planks-${key}-${getPlacedStackCount(placedPlankObjects, key) + 1}`;
        group.position.set(target.x, baseY + stackHeight, target.z);
        group.rotation.y = hash2D(target.tileX * 811 + 29, target.tileZ * 811 - 43) > 0.5 ? Math.PI * 0.5 : 0;
        group.userData.isPlacedPlanks = true;
        group.userData.tileKey = key;
        scene.add(group);
        addPlacedStackObject(placedPlankObjects, key, group);
        setStackableTileHeight(key, stackHeight + 0.28);
        return true;
      }

      function createStickModel() {
        const group = new THREE.Group();
        const stickMaterial = new THREE.MeshStandardMaterial({
          color: 0x744017,
          roughness: 0.86,
          metalness: 0.02
        });
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, tileSize, 8), stickMaterial);
        stick.position.y = tileSize * 0.5;
        stick.castShadow = true;
        stick.receiveShadow = true;
        group.add(stick);
        return group;
      }

      function placeStickAtTile(target) {
        const sample = getTerrainSampleAtTile(target.tileX, target.tileZ);
        if (!sample) return false;
        const key = `${target.tileX},${target.tileZ}`;
        const baseY = sample.landLevel * heightStep;
        const stackHeight = getStackableTileHeight(key, target.tileX, target.tileZ, baseY);
        const stackIndex = getPlacedStackCount(placedStickObjects, key);
        const group = createStickModel();
        group.name = `placed-stick-${key}-${stackIndex + 1}`;
        group.position.set(target.x, baseY + stackHeight, target.z);
        group.userData.isPlacedStick = true;
        group.userData.tileKey = key;
        group.userData.stackIndex = stackIndex;
        scene.add(group);
        addPlacedStackObject(placedStickObjects, key, group);
        setStackableTileHeight(key, stackHeight + tileSize);
        return true;
      }

      function handleBlueSlotPlacementClick(event) {
        if (activeInventoryActionSlot !== "blue") return false;
        const target = getBlueSlotPlacementTarget(event);
        if (!target) return false;

        const placed = target.type === "bush"
          ? placeBushAtTile(target)
          : target.type === "rubble"
            ? placeRubbleAtTile(target)
            : target.type === "spring"
              ? placeSpringAtTile(target)
              : target.type === "planks"
                ? placePlanksAtTile(target)
                : target.type === "stick"
                  ? placeStickAtTile(target)
                  : false;
        if (!placed) return false;
        if (!spendBlueSlotPlacementItem(target.type)) return false;
        setBlueSlotPlacementPreview(null);
        return true;
      }

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
        updateBushesCollectedReadout: updateCollectedReadouts
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
        getRubbleSurfaceHeightAtWorld: (x, z) => Math.max(
          getRubbleSurfaceHeightAtWorld(x, z),
          getPlacedStackSurfaceHeightAtWorld(x, z)
        ),
        getSolidSurfaceHeightAtWorld: (x, z) => Math.max(
          getSolidSurfaceHeightAtWorld(x, z),
          getPlacedStackSurfaceHeightAtWorld(x, z),
          getNpcCloudSurfaceHeightAtWorld(x, z)
        ),
        getWaterSurfaceHeightAtWorld: (x, z) => {
          const cloudSurfaceY = getNpcCloudSurfaceHeightAtWorld(x, z);
          const waterSurfaceY = getWaterSurfaceHeightAtWorld(x, z);
          return Number.isFinite(cloudSurfaceY) && cloudSurfaceY > waterSurfaceY
            ? -Infinity
            : waterSurfaceY;
        },
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
        handleNpcSpringClick: (event) => activeInventoryActionSlot === "red" && npcEnemiesController.handleNpcSpringClick(event),
        updateNpcSpringHover: (event) => {
          if (activeInventoryActionSlot === "red") return npcEnemiesController.updateNpcSpringHover(event);
          npcEnemiesController.updateNpcSpringHover(null);
          return null;
        },
        setSpringPickupVacuumActive: (active) => {
          const isActive = Boolean(active);
          rightClickRubbleVacuumActive = isActive;
          npcEnemiesController.setSpringPickupVacuumActive(isActive);
        },
        handleBlueSlotPlacementClick,
        updateBlueSlotPlacementHover,
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
        npcEnemiesController.update(deltaSeconds, elapsedSeconds);
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
  
