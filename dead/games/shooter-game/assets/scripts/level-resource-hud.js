function formatResourceOptionValue(inputEl){
  const raw = String(inputEl && inputEl.value || "").trim().toLowerCase();
  const n = parseInt(raw, 10);
  return raw === "infinite" || raw === "inf" || raw === "\u221e" || n >= 100 ? "MAX" : String(Number.isFinite(n) ? n : 0);
}

function parseResourceOption(inputEl, minValue){
  const raw = String(inputEl && inputEl.value || "").trim().toLowerCase();
  const n = parseInt(raw, 10);
  if (raw === "infinite" || raw === "inf" || raw === "\u221e" || n >= 100) return { value: 100, infinite: true };
  return { value: Math.max(minValue || 0, Number.isFinite(n) ? n : (minValue || 0)), infinite: false };
}

function _syncStartResourceControls(){
  try{
    const livesSlider = document.getElementById("livesSlider");
    const heartsSlider = document.getElementById("heartsSlider");
    const shieldsSlider = document.getElementById("shieldsSlider");
    const bombsSlider = document.getElementById("bombsSlider");
    if (livesSlider) livesSlider.value = ((typeof START_LIVES_INFINITE !== "undefined" && START_LIVES_INFINITE) ? "\u221e" : String(Math.max(0, parseInt(START_LIVES, 10) || 0)));
    if (heartsSlider) heartsSlider.value = ((typeof START_HEARTS_INFINITE !== "undefined" && START_HEARTS_INFINITE) ? "\u221e" : String(Math.max(1, parseInt(START_HEARTS, 10) || 1)));
    if (shieldsSlider) shieldsSlider.value = ((typeof START_SHIELDS_INFINITE !== "undefined" && START_SHIELDS_INFINITE) ? "\u221e" : String(Math.max(0, parseInt(START_SHIELDS, 10) || 0)));
    if (bombsSlider) bombsSlider.value = ((typeof START_BOMBS_INFINITE !== "undefined" && START_BOMBS_INFINITE) ? "\u221e" : String(Math.max(0, parseInt(START_BOMBS, 10) || 0)));
    if (typeof syncStartOptionsLabels === "function") syncStartOptionsLabels();
  }catch(e){}
}

function _resetStartResourceDefaults(){
  try{
    const livesSlider = document.getElementById("livesSlider");
    const heartsSlider = document.getElementById("heartsSlider");
    const shieldsSlider = document.getElementById("shieldsSlider");
    const bombsSlider = document.getElementById("bombsSlider");
    if (typeof START_LIVES !== "undefined") START_LIVES = Math.max(0, parseInt(livesSlider && livesSlider.defaultValue, 10) || 0);
    if (typeof START_HEARTS !== "undefined") START_HEARTS = Math.max(1, parseInt(heartsSlider && heartsSlider.defaultValue, 10) || 1);
    if (typeof START_SHIELDS !== "undefined") START_SHIELDS = Math.max(0, parseInt(shieldsSlider && shieldsSlider.defaultValue, 10) || 0);
    if (typeof START_BOMBS !== "undefined") START_BOMBS = Math.max(0, parseInt(bombsSlider && bombsSlider.defaultValue, 10) || 0);
    if (typeof START_LIVES_INFINITE !== "undefined") START_LIVES_INFINITE = false;
    if (typeof START_HEARTS_INFINITE !== "undefined") START_HEARTS_INFINITE = false;
    if (typeof START_SHIELDS_INFINITE !== "undefined") START_SHIELDS_INFINITE = false;
    if (typeof START_BOMBS_INFINITE !== "undefined") START_BOMBS_INFINITE = false;
    _syncStartResourceControls();
  }catch(e){}
}

function _syncBombHud(){
  try{
    _syncTopRowCounterHudLayout();
  }catch(e){}
  const gameplayHudActive = (typeof isPausedGameplayMenuBackdropState === "function")
    ? isPausedGameplayMenuBackdropState()
    : (typeof gameState !== "undefined" && typeof STATE !== "undefined" && gameState === STATE.PLAYING);
  if (powerupSlot){
    const hasBombs = !!(bombsCount > 0 || infiniteModeActive || bombsInfiniteActive);
    powerupSlot.style.display = (gameplayHudActive && hasBombs) ? "flex" : "none";
  }
  if (powerupHint){
    if (infiniteModeActive || bombsInfiniteActive) powerupHint.textContent = "Q \u221e";
    else powerupHint.textContent = "Q x" + Math.max(1, bombsCount);
  }
}

function _syncTopRowCounterHudLayout(){
  const scoreStoreHud = document.getElementById("scoreStoreHud");
  const timerHud = document.getElementById("timerHud");
  const livesSlot = document.getElementById("livesSlot");
  const powerupSlot = document.getElementById("powerupSlot");
  if (!livesSlot && !powerupSlot) return;

  const EDGE_PAD = 14;
  const TOP_PAD = 10;
  const HUD_GAP = 8;
  const fallbackWidth = 72;

  const scoreWidth = scoreStoreHud ? Math.max(fallbackWidth, Math.round(scoreStoreHud.getBoundingClientRect().width || 0)) : fallbackWidth;
  const timerWidth = timerHud ? Math.max(fallbackWidth, Math.round(timerHud.getBoundingClientRect().width || 0)) : fallbackWidth;
  const livesWidth = livesSlot ? Math.max(fallbackWidth, Math.round(livesSlot.getBoundingClientRect().width || 0)) : fallbackWidth;
  const bombsWidth = powerupSlot ? Math.max(fallbackWidth, Math.round(powerupSlot.getBoundingClientRect().width || 0)) : fallbackWidth;

  if (livesSlot){
    livesSlot.style.position = "absolute";
    livesSlot.style.top = TOP_PAD + "px";
    livesSlot.style.left = (EDGE_PAD + scoreWidth + HUD_GAP) + "px";
    livesSlot.style.right = "auto";
    livesSlot.style.bottom = "auto";
  }

  if (powerupSlot){
    powerupSlot.style.position = "absolute";
    powerupSlot.style.top = TOP_PAD + "px";
    powerupSlot.style.right = (EDGE_PAD + timerWidth + HUD_GAP) + "px";
    powerupSlot.style.left = "auto";
    powerupSlot.style.bottom = "auto";
  }
}

try{
  window.addEventListener("resize", _syncTopRowCounterHudLayout);
  window.addEventListener("orientationchange", _syncTopRowCounterHudLayout);
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", _syncTopRowCounterHudLayout, { once:true });
  } else {
    _syncTopRowCounterHudLayout();
  }
}catch(e){}
