export function showLoadingScreen(loadingScreen) {
  document.body.classList.add("loading-state");
  loadingScreen?.classList.remove("hidden");
}

export function hideLoadingScreen(loadingScreen) {
  document.body.classList.remove("loading-state");
  loadingScreen?.classList.add("hidden");
}

export function selectEscMenuPanel(panelName, panels = {}) {
  const validPanels = new Set(["tutorial", "controls", "customization", "stats"]);
  const selectedPanel = validPanels.has(panelName) ? panelName : "tutorial";

  panels.tutorialPanel?.classList.toggle("hidden", selectedPanel !== "tutorial");
  panels.controlsPanel?.classList.toggle("hidden", selectedPanel !== "controls");
  panels.customizationPanel?.classList.toggle("hidden", selectedPanel !== "customization");
  panels.statsPanel?.classList.toggle("hidden", selectedPanel !== "stats");

  if (panels.escMenuSelect) {
    panels.escMenuSelect.value = selectedPanel;
  }

  return selectedPanel;
}

export function setupEscMenuPanels({
  hud,
  escMenuButton,
  escMenuSelect,
  tutorialPanel,
  controlsPanel,
  customizationPanel,
  statsPanel
}) {
  const panels = {
    escMenuSelect,
    tutorialPanel,
    controlsPanel,
    customizationPanel,
    statsPanel
  };

  escMenuButton?.addEventListener("click", () => {
    hud?.classList.toggle("hidden");
  });

  escMenuSelect?.addEventListener("change", () => {
    selectEscMenuPanel(escMenuSelect.value, panels);
  });

  selectEscMenuPanel("tutorial", panels);

  return {
    selectPanel: (panelName) => selectEscMenuPanel(panelName, panels)
  };
}

export function setupStartMenuControls({
  seedInput,
  cameraModeSelect,
  startButton,
  randomSeedButton,
  onStart
}) {
  const startFromInputs = () => {
    if (typeof onStart !== "function") return;
    onStart(seedInput?.value?.trim() || "tektite", cameraModeSelect?.value);
  };

  randomSeedButton?.addEventListener("click", () => {
    if (seedInput) {
      seedInput.value = `seed-${Math.floor(Math.random() * 999999999)}`;
    }
  });

  startButton?.addEventListener("click", startFromInputs);

  seedInput?.addEventListener("keydown", (event) => {
    if (event.code === "Enter") {
      startFromInputs();
    }
  });
}

export function setupStorageButtons({
  saveStateButton,
  clearLocalStorageLink,
  loadingClearLocalStorageButton,
  onSaveState,
  onClearStorage
}) {
  saveStateButton?.addEventListener("click", () => {
    if (typeof onSaveState === "function") onSaveState();
  });

  clearLocalStorageLink?.addEventListener("click", (event) => {
    event.preventDefault();
    if (typeof onClearStorage === "function") onClearStorage();
  });

  loadingClearLocalStorageButton?.addEventListener("click", () => {
    if (typeof onClearStorage === "function") onClearStorage({ reload: true });
  });
}
