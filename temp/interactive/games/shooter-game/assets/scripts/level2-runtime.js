/* ======================================================================
  PROJECT CHANGELOG / REMOVAL LOG
========================================================================
[REMOVAL LOG]

- 2026-05-06 | v2.08
  Added: Level 2 maze visited-tile trail. Walked-on floor tiles now stay highlighted at 50% transparent green.
  Changed: Visited maze tiles are redrawn after the fog/shadow pass so the trail remains visible through darkness.

- 2026-04-03 | v2.00
  Changed: Core loop converted from bottom-row shooter into center-locked procedural maze traversal.
  Kept: Player movement, aiming, shooting, bullet logic, timer, lives, health, and enemy damage systems.
  Disabled: Regular enemy wave spawning for now while maze progression is prototyped.
  Renamed: Bonus Mode -> Bonus Mode.


- 2025-12-24 | v1.96
  Added: Pause commands /fullscreen (toggle fullscreen) and /help (lists commands alphabetically).


- 2025-12-23 | v1.96
  Added: Native Xbox controller support via Gamepad API (move/aim/shoot/shield/bomb/pause + menu navigation).


- 2025-12-17 | v1.96
  Fixed: Game not starting / enemy images not loading due to runtime error.
  Cause: resize() called resetStarfield() before starLayers const initialized (TDZ).
  Fix: Initialize starfield definitions before resize() runs; make resize() safe.

- 2025-12-17 | v1.96
  Undo: v1.96 "simplified demo" version (removed menus/options/combat/etc.).
  Reason: User requested undo; restored full game build.
  Added: Player size increase + enforced vertical padding between formation and player.
  Location: player sizing, spawnEnemies baseY, update() formation Y clamp.

- 2025-12-17 | v1.96
  Added: Responsive desktop spacing so enemy formation uses screen width better.
  Added: Hard top-of-screen clamp so enemies stay visible even after step-downs.
  Tweaked: Reduced enemy base size + breathing scale to prevent overlap on desktop.
  Tweaked: Formation edge detection uses predicted next position to avoid clipping.


- 2025-12-17 | v1.96
  Added: Galaga-like enemy descent (continuous downward pressure) + predictable wobble.
  Tweaked: Enemy formation clamped to ~top half of screen (prevents encroaching into player zone).
  Tweaked: Increased base enemy spacing (X/Y) for clearer separation.
  Added: Wave banner ("WAVE 1", "WAVE 2", etc.) shown on start and after wave clears.
  Tweaked: Difficulty scaling per wave (enemy horizontal speed, descent speed, step-down).


- 2025-12-17 | v1.96
  Added: Wave spawn scaling: Wave 1 = 1 enemy, then doubles each wave (capped).
  Tweaked: FUN MODE: more lives, slower enemy pressure, slower swoops, faster bullets, gentler scaling.
  Added: Dynamic formation packing: auto-cols/rows + auto enemy sizing to fit top-zone area.
  Kept: Galaga-style 'swoop' attackers: individual enemies break formation, dive toward the player, then return.
  Kept: Main formation stays in the top zone; only swoopers can enter player space.
  Tweaked: Player fire rate increases each wave (cooldown decreases).


- 2025-12-17 | v1.96
  Tweaked: Player bullets are slightly larger than enemy bullets (visual clarity).
  Added: Player bullets can collide with enemy bullets; both are deleted on contact (counter-shot mechanic).

- 2025-12-17 | v1.96
  Added: Always-on player health bar under the player.
  Changed: Health replaces lives. Each enemy hit drains 25% health (4 hits total).
  Added: On death, player explodes into violent pixel-dust particles and returns to menu.



- 2025-12-17 | v1.96
  Fix: Restored any accidentally removed gameplay systems while adding UI and powerups.
  Kept: 360° aim + orbit triangle, straight bullets, bullet-vs-bullet cancel, Galaga formation + swoops, wave sizing 1/2/4/6/..., HUD toggle, menus/options.
  Added: Lives box (bottom-left), powerup slot with 'Press Q', YOU DIED overlay + Restart reset, UFO 25% wave spawn with 3-hit color cycle + fade granting 💥, Q bomb drop (+ flash then AoE + knockback), health bar (4 hits per life), pixel-dust death.
- 2025-12-19 | v1.96
  Changed: 💥 bomb is now a short-range shot (spawns ahead of player in aim direction).
  Changed: Bomb detonates immediately on first enemy contact and can multi-kill enemies in the blast radius.

- 2025-12-19 | v1.96
  Added: Bomb-killing a dragon.gif enemy grants a one-time +25% "armor" pip next to the hearts HUD.
  Behavior: The armor absorbs the next hit (any damage) and then flips to ❌ briefly.

====================================================================== */

// NOTE: If this runtime file changes, also update the visible "Last updated:"
// timestamp in games/shooter-game/assets/levels/shooter-game-level1.html and
// games/shooter-game/assets/levels/shooter-game-level2.html to the current time.

/* =======================
   Paths (EDIT IF NEEDED)
======================= */
const ENEMY_WEBP_BASE = "/dead/games/shooter-game/assets/enemy-webps/";
const ENEMY_WEBP_INDEX_URL = "/dead/games/shooter-game/assets/JSON/enemy-webps.json";
const PLAYER_IMG_URL = "/dead/games/shooter-game/assets/bananarama.webp";
const BOSS_IMG_URL = ENEMY_WEBP_BASE + "180px-NO_U_cycle.webp";
const ENEMY_ASSET_BASE = ENEMY_WEBP_BASE; // kept for legacy enemy-path code
const AUDIO_HIT = "/dead/games/shooter-game/assets/audio/hitmarker.mp3";
const AUDIO_OOF = "/dead/games/shooter-game/assets/audio/oof.mp3";
const AUDIO_UI_HOVER = "/dead/games/shooter-game/assets/audio/bone-crack.mp3";
const AUDIO_UI_SELECT = "/dead/games/shooter-game/assets/audio/arcade-clink.mp3";


/* =======================
   Audio
======================= */
const AUDIO_BG_MUSIC = "/dead/games/shooter-game/assets/audio/do-that-there.mp3";
const AUDIO_LEVEL1_MUSIC = "/dead/games/shooter-game/assets/audio/spaceinvaders.mp3";
const AUDIO_MENU_MUSIC = "/dead/games/shooter-game/assets/audio/wii-shop-music.mp3";
const AUDIO_DEATH_YELL = "/dead/games/shooter-game/assets/audio/link-yell.mp3";
const MUSIC_TRACKS = {
  "wii-shop-music.mp3": AUDIO_MENU_MUSIC,
  "spaceinvaders.mp3": AUDIO_LEVEL1_MUSIC,
  "do-that-there.mp3": AUDIO_BG_MUSIC
};
let hudMusicSelection = "Game Music";
let initialAudioGateMuted = false;
let initialAudioGateReleasedAt = 0;

// Background music (loops). We start it on the first user interaction (autoplay rules).
const musicBg = new Audio(AUDIO_BG_MUSIC);
musicBg.loop = true;
musicBg.preload = "auto";
musicBg.volume = 0.5;

// Death yell (plays once when GAME OVER screen appears)
const sfxDeath = new Audio(AUDIO_DEATH_YELL);
sfxDeath.preload = "auto";
sfxDeath.volume = 0.10;
let sfxHit = null;
let sfxOof = null;
let sfxUiHover = null;
let sfxUiSelect = null;

// Global mute toggle (M key).
let audioMuted = false;
let manualAudioMuted = false;

function isMuteNicknameActive(){
  try{ return String(getSavedChatNicknameValue ? getSavedChatNicknameValue() : "").trim().toLowerCase() === "_mute"; }catch(_){ return false; }
}
function effectiveAudioMuted(){
  return !!initialAudioGateMuted || !!manualAudioMuted || isMuteNicknameActive();
}
function releaseInitialAudioGate(){
  if (!initialAudioGateMuted) return false;
  initialAudioGateMuted = false;
  initialAudioGateReleasedAt = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  if (!manualAudioMuted && hudMusicSelection === "Muted") hudMusicSelection = "Game Music";
  audioMuted = effectiveAudioMuted();
  return true;
}
function musicFilenameFromPath(path){
  const raw = String(path || "").split("?")[0].split("#")[0];
  return raw.substring(raw.lastIndexOf("/") + 1) || "do-that-there.mp3";
}
function setAudioElementTrack(audioEl, filename, restart=true){
  const src = MUSIC_TRACKS[filename];
  if (!audioEl || !src) return false;
  const wasPlaying = !audioEl.paused;
  try{ audioEl.pause(); }catch(_){ }
  try{
    if (!String(audioEl.src || "").endsWith(src)) audioEl.src = src;
    if (restart) audioEl.currentTime = 0;
    audioEl.loop = true;
    audioEl.load();
  }catch(_){ }
  if (wasPlaying && !audioMuted) tryPlayWithRetry(audioEl, 30, 80);
  return true;
}
function getDefaultMusicFilenameForCurrentState(){
  return musicFilenameFromPath(AUDIO_BG_MUSIC);
}
function getActiveMusicFilename(){
  if (effectiveAudioMuted()) return "Muted";
  return musicFilenameFromPath(musicBg.src || musicBg.currentSrc || AUDIO_BG_MUSIC);
}
function syncMusicDropdownTextWidth(dropdownEl){
  if (!dropdownEl) return;
  const selectedOption = dropdownEl.options && dropdownEl.selectedIndex >= 0 ? dropdownEl.options[dropdownEl.selectedIndex] : null;
  const label = String(selectedOption ? selectedOption.textContent : dropdownEl.value || "Game Music").trim() || "Game Music";
  dropdownEl.style.setProperty("--music-select-ch", String(Math.max(5, label.length)));
}

function setHudMusicSelection(filename){
  if (filename === "Muted"){
    initialAudioGateMuted = false;
    hudMusicSelection = "Muted";
    setMuteOptionEnabled(true);
    return;
  }
  releaseInitialAudioGate();
  manualAudioMuted = false;
  audioMuted = effectiveAudioMuted();
  if (filename === "Game Music"){
    hudMusicSelection = "Game Music";
    setAudioElementTrack(musicBg, getDefaultMusicFilenameForCurrentState(), false);
  }else{
    if (!MUSIC_TRACKS[filename]) return;
    hudMusicSelection = filename;
    setAudioElementTrack(musicBg, filename, true);
  }
  applyMuteState();
  if (!audioMuted && gameState === STATE.PLAYING) ensureMusicPlaying(filename !== "Game Music");
  updateMusicHud();
}
function updateMusicHud(labelText){
  audioMuted = effectiveAudioMuted();
  const stageHudEl = document.getElementById("stageHud");
  const labelEl = document.getElementById("stageHudLabel");
  const speakerEl = document.getElementById("stageHudSpeaker");
  const dropdownEl = document.getElementById("musicFileDropdown");
  const icon = audioMuted ? "🔇" : "🔊";
  if (labelEl && typeof labelText === "string") labelEl.textContent = labelText;
  if (speakerEl){
    speakerEl.textContent = icon;
    speakerEl.setAttribute("aria-label", audioMuted ? "Unmute audio" : "Mute audio");
    speakerEl.title = audioMuted ? "Unmute all game audio" : "Mute all game audio";
  }
  if (dropdownEl){
    const filename = getActiveMusicFilename();
    const dropdownValue = audioMuted ? "Muted" : (hudMusicSelection === "Game Music" ? "Game Music" : filename);
    dropdownEl.value = dropdownValue;
    if (dropdownEl.value !== dropdownValue) dropdownEl.value = audioMuted ? "Muted" : "Game Music";
    dropdownEl.classList.toggle("isMuted", !!audioMuted);
    dropdownEl.title = audioMuted ? "Muted" : (dropdownValue === "Game Music" ? "Game Music (" + filename + ")" : filename);
    syncMusicDropdownTextWidth(dropdownEl);
  }
  if (stageHudEl){
    stageHudEl.dataset.audioIcon = icon;
    stageHudEl.setAttribute("aria-label", `${labelEl ? labelEl.textContent : "HUD"}. Audio ${audioMuted ? "muted" : "enabled"}.`);
  }
}

function applyMuteState(){
  audioMuted = effectiveAudioMuted();
  const m = !!audioMuted;
  if (musicBg) musicBg.muted = m;
  if (sfxDeath) sfxDeath.muted = m;
  if (sfxHit) sfxHit.muted = m;
  if (sfxOof) sfxOof.muted = m;
  if (sfxUiHover) sfxUiHover.muted = m;
  if (sfxUiSelect) sfxUiSelect.muted = m;
  updateMusicHud();
}

function setMuteOptionEnabled(shouldEnable){
  initialAudioGateMuted = false;
  manualAudioMuted = !!shouldEnable;
  if (manualAudioMuted) hudMusicSelection = "Muted";
  else if (hudMusicSelection === "Muted") hudMusicSelection = "Game Music";
  audioMuted = effectiveAudioMuted();
  applyMuteState();
  // Only resume music when gameplay is actually running.
  if (!audioMuted && gameState === STATE.PLAYING) ensureMusicPlaying();
}

function tryPlayWithRetry(audioEl, retries=20, delayMs=80){
  if (!audioEl || audioMuted) return;
  try{
    audioEl.muted = !!audioMuted;
  }catch(e){}
  try{
    const p = audioEl.play();
    if (p && typeof p.catch === "function"){
      p.catch(() => {
        // Some browsers reject play() briefly even when audio is "unlocked".
        // We retry a handful of times so the sound lands as soon as it's allowed.
        if (retries > 0){
          setTimeout(() => tryPlayWithRetry(audioEl, retries - 1, delayMs), delayMs);
        }
      });
    }
  }catch(e){
    if (retries > 0){
      setTimeout(() => tryPlayWithRetry(audioEl, retries - 1, delayMs), delayMs);
    }
  }
}

function ensureMusicPlaying(restart=false){
  // Start/resume looping background music immediately when gameplay begins.
  // "restart=true" forces it back to the beginning.
  try{
    if (restart){
      musicBg.currentTime = 0;
    }
    musicBg.loop = true;
  }catch(e){}
  if (audioMuted) return;
  try{
    // If already playing and not restarting, leave it alone.
    if (!restart && !musicBg.paused) return;
    musicBg.play().catch(()=>{});
  }catch(e){}
}

function stopMusic(){
  try{
    musicBg.pause();
    musicBg.currentTime = 0;
  }catch(e){}
}

function playDeathYell(){
  if (audioMuted) return;
  try{
    sfxDeath.currentTime = 0;
    sfxDeath.muted = !!audioMuted;
  }catch(e){}
  // Try immediately, then retry briefly to avoid "plays only after next keypress" behavior.
  sfxDeath.play().catch(()=>{ tryPlayWithRetry(sfxDeath, 30, 60); });
}

/* =======================
   Player Firing Tuning
======================= */
const BASE_PLAYER_FIRE_COOLDOWN = 0.26; // seconds (wave scaling reduces this)
const PLAYER_BULLET_SPEED  = 8.0; // pixels per frame-ish (magnitude); direction comes from aim
const NORMAL_BULLET_FIRE_COOLDOWN_MULTIPLIER = 2.0;
const NORMAL_BULLET_SPEED_MULTIPLIER = 1.33;
const BIG_BULLET_FIRE_COOLDOWN_MULTIPLIER = 0.7;
const BIG_BULLET_BRANCH_ANGLE = 0.24;
const BIG_BULLET_BRANCH_RADIUS_MULTIPLIER = 0.72;
const BIG_BULLET_BRANCH_SPEED_MULTIPLIER = 0.94;
const BIG_BULLET_LIGHTNING_TRAIL_LEN = 26;
const GLITCH_BULLET_FIRE_COOLDOWN_MULTIPLIER = 0.62;
const GLITCH_BULLET_SPREAD_ANGLE = 0.10;
const GLITCH_BULLET_RADIUS_MULTIPLIER = 1.32;
const GLITCH_BULLET_SPEED_MULTIPLIER = 1.22;
const GLITCH_BACKGROUND_DECAY = 3.6;

function isBigBulletShotActive(){
  return shootCheatMode !== "glitch" && (shootCheatMode === "big_bullets" || (typeof bigBulletBuffEndTime === "number" && bigBulletBuffEndTime > time));
}

function isGlitchShotActive(){
  return shootCheatMode === "glitch";
}

function getPlayerFireCooldown(){
  // v1.96: player shoots faster every wave (lower cooldown)
  const baseCooldown = Math.max(0.14, BASE_PLAYER_FIRE_COOLDOWN * Math.pow(0.94, (wave-1)));
  if (isGlitchShotActive()) return Math.max(0.08, baseCooldown * GLITCH_BULLET_FIRE_COOLDOWN_MULTIPLIER);
  return isBigBulletShotActive()
    ? Math.max(0.09, baseCooldown * BIG_BULLET_FIRE_COOLDOWN_MULTIPLIER)
    : baseCooldown * NORMAL_BULLET_FIRE_COOLDOWN_MULTIPLIER;
}

/* =======================
   Canvas + Globals
======================= */
const canvas = document.getElementById("game");
// v1.96: Mouse handlers for holding the energy shield (RMB)
canvas.addEventListener("contextmenu", (e)=>e.preventDefault());
canvas.addEventListener("mousedown", (e)=>{
  if (keyboardBindings.shield === mouseButtonToBinding(e.button)){
    mouseShieldHolding = true;
    if (canActivateShield()) startShield();
  }
});
canvas.addEventListener("mouseup", (e)=>{
  if (keyboardBindings.shield === mouseButtonToBinding(e.button)){
    mouseShieldHolding = false;
    stopShield(false);
  }
});

const ctx = canvas.getContext("2d");

// Mobile sanity: disable scroll/zoom
document.body.style.touchAction = "none";
canvas.style.touchAction = "none";


// v1.96: Starfield background color override (default is black)
var starfieldBgOverride = null; // CSS color string (e.g. "navy" or "#0b1020") or null
// =======================
// Post FX: chromatic aberration + gentle hue drift (beat-reactive)
// =======================
const fxCanvas = document.createElement("canvas");
const fxCtx = fxCanvas.getContext("2d");

// v1.96: allow disabling post-processing via /video_fx
let VIDEO_FX_ENABLED = false;

// v1.96: "Tab" key screen-glitch spiral burst
let GLITCH_SPIRAL_T = 0;
const GLITCH_SPIRAL_DUR = 2.8;
function triggerGlitchSpiral(){
  GLITCH_SPIRAL_T = GLITCH_SPIRAL_DUR;
}

function resizeFX(){
  fxCanvas.width = canvas.width;
  fxCanvas.height = canvas.height;
}

// Audio analysis (uses the looping background music)
let audioCtx = null;
let analyser = null;
let freqData = null;
let beatLevel = 0; // smoothed 0..1

function initAudioAnalyser(){
  if (analyser || !musicBg) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    freqData = new Uint8Array(analyser.frequencyBinCount);

    const srcNode = audioCtx.createMediaElementSource(musicBg);
    srcNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }catch(e){
    // If the browser refuses (some do), we silently run FX in "ambient" mode.
    analyser = null;
  }
}

function getBeat(){
  // Gentle smoothing: quick rise, slow fall (prevents strobe)
  let v = 0;
  if (analyser && freqData){
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 0; i < freqData.length; i++) sum += freqData[i];
    v = (sum / freqData.length) / 255; // 0..1
  } else {
    // fallback "ambient pulse" if audio analysis unavailable
    v = 0.10 + 0.06 * Math.sin(time * 1.7);
  }

  // Smooth
  const attack = 0.45;
  const release = 0.08;
  if (v > beatLevel) beatLevel += (v - beatLevel) * attack;
  else beatLevel += (v - beatLevel) * release;

  return Math.max(0, Math.min(1, beatLevel));
}

function applyChromaticAberration(beat){
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return;

  // Subtle offsets: ~1..4px
  const shift = 1.2 + beat * 2.8;

  // Slow hue drift; beat adds a gentle push
  const hue = (time * 10 + beat * 55) % 360;

  fxCtx.clearRect(0,0,w,h);

  // Base image with hue shift
  fxCtx.filter = `hue-rotate(${hue}deg)`;
  fxCtx.drawImage(canvas, 0, 0);

  // Light channel separation glow
  fxCtx.globalCompositeOperation = "screen";

  fxCtx.filter = `hue-rotate(${hue + 25}deg)`;
  fxCtx.drawImage(canvas, -shift, 0);

  fxCtx.filter = `hue-rotate(${hue + 55}deg)`;
  fxCtx.drawImage(canvas, shift, 0);

  fxCtx.globalCompositeOperation = "source-over";
  fxCtx.filter = "none";

  // Copy back
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(fxCanvas, 0, 0);
}

const overlay = document.getElementById("overlay");
const livesSlot = document.getElementById("livesSlot");
const livesText = document.getElementById("livesText");
const powerupSlot = document.getElementById("powerupSlot");
const powerupHint = document.getElementById("powerupHint");
;
// Player proximity HUD fade:
// Lives and Bombs counters fade out as the player sprite approaches them.
// The player stays fully visible; only the corner counters become less opaque.
const PLAYER_COUNTER_FADE_RADIUS_PX = 190;
const PLAYER_COUNTER_MIN_OPACITY = 0.12;

function setHudCounterOpacity(el, opacity){
  if (!el) return;
  const clamped = Math.max(PLAYER_COUNTER_MIN_OPACITY, Math.min(1, opacity));
  el.style.opacity = String(clamped);
}

function resetPlayerProximityHudFade(){
  if (livesSlot) livesSlot.style.opacity = "";
  if (powerupSlot) powerupSlot.style.opacity = "";
}

function syncPlayerProximityHudFade(){
  if (gameState !== STATE.PLAYING || (typeof hasActivePlayer === "function" && !hasActivePlayer())){
    resetPlayerProximityHudFade();
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, canvasRect.width);
  const scaleY = canvas.height / Math.max(1, canvasRect.height);
  const playerScreenX = canvasRect.left + (player.x / scaleX);
  const playerScreenY = canvasRect.top + (player.y / scaleY);

  const fadeCounter = (el) => {
    if (!el || el.style.display === "none") return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const distance = Math.hypot(playerScreenX - cx, playerScreenY - cy);
    const radius = PLAYER_COUNTER_FADE_RADIUS_PX;
    const opacity = distance >= radius
      ? 1
      : PLAYER_COUNTER_MIN_OPACITY + (1 - PLAYER_COUNTER_MIN_OPACITY) * (distance / radius);
    setHudCounterOpacity(el, opacity);
  };

  fadeCounter(livesSlot);
  fadeCounter(powerupSlot);
}

const deathOverlay = document.getElementById("deathOverlay");
const btnRestart = document.getElementById("btnRestart");
const btnDeathQuitToMenu = document.getElementById("btnDeathQuitToMenu");
const winOverlay = document.getElementById("winOverlay");
const btnContinue = document.getElementById("btnContinue");
const mazeSummaryOverlay = document.getElementById("mazeSummaryOverlay");
const mazeSummaryCoverage = document.getElementById("mazeSummaryCoverage");
const mazeSummaryMissed = document.getElementById("mazeSummaryMissed");
const mazeSummaryBonus = document.getElementById("mazeSummaryBonus");
const btnNextMaze = document.getElementById("btnNextMaze");
const LEVEL_PARAMS = new URLSearchParams(window.location.search);
const URL_START_WAVE = Math.max(1, Math.min(21, parseInt(LEVEL_PARAMS.get("startWave") || "1", 10) || 1));
const FORCE_MENU = LEVEL_PARAMS.get("menu") === "1" || LEVEL_PARAMS.get("autostart") === "0";
const AUTO_START_LEVEL = !FORCE_MENU;

let hudVisible = false;

// =======================
// Pause (v1.96)
// - ESC toggles pause while playing.
// - Freezes gameplay updates and input-driven actions.
// =======================
const pauseOverlay = document.getElementById("pauseOverlay");
const pauseTitle = document.getElementById("pauseTitle");
const pauseHint = document.getElementById("pauseHint");
const scoreStorePanel = document.getElementById("scoreStorePanel");
const scoreStoreItemsEl = document.getElementById("scoreStoreItems");
const scoreStoreCurrentScoreEl = document.getElementById("scoreStoreCurrentScore");
const scoreStoreStatusEl = document.getElementById("scoreStoreStatus");
const btnScoreStoreClose = document.getElementById("btnScoreStoreClose");

const btnPauseOpenStore = document.getElementById("btnPauseOpenStore");
const btnPauseOpenChat = document.getElementById("btnPauseOpenChat");
const pauseCommand = null;
const pauseCmdSuggest = null;
const CHAT_NICKNAME_STORAGE_KEY = "tektiteChatNickname";
const CHAT_NICKNAME_EXPLICIT_STORAGE_KEY = "tektiteChatNicknameExplicit";
function getSavedChatNicknameValue(){
  try{
    const savedNickname = window.localStorage.getItem(CHAT_NICKNAME_STORAGE_KEY);
    const normalized = savedNickname && savedNickname.trim() ? savedNickname.trim() : "";
    const isExplicit = window.localStorage.getItem(CHAT_NICKNAME_EXPLICIT_STORAGE_KEY) === "true";
    if (normalized === "User" && !isExplicit) return "";
    return Array.from(normalized).slice(0, 8).join("");
  }catch(error){
    return "";
  }
}
const stageHudSpeaker = document.getElementById("stageHudSpeaker");
const musicFileDropdown = document.getElementById("musicFileDropdown");
if (stageHudSpeaker) stageHudSpeaker.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  unlockAudioOnce();
  setMuteOptionEnabled(!audioMuted);
});
if (musicFileDropdown) musicFileDropdown.addEventListener("change", () => setHudMusicSelection(musicFileDropdown.value));
applyMuteState();

function isTektiteNicknameCheatermodeUnlock(){
  return getSavedChatNicknameValue().trim().toLowerCase() === "tektite";
}

function escapePauseTitleText(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function syncPauseTitleNickname(){
  if (!pauseTitle) return;
  const nickname = getSavedChatNicknameValue() || "User";
  pauseTitle.innerHTML = `Hello ${escapePauseTitleText(nickname)}!<br>GAME PAUSED`;
}
syncPauseTitleNickname();

let parentChatVisible = false;
let parentChatValuePickerActive = false;
let parentChatValuePickerCommand = "";
const pauseCloseBtn = document.getElementById("pauseCloseBtn");
if (pauseCloseBtn){
  pauseCloseBtn.addEventListener("click", () => {
    // Resume gameplay
    if (typeof togglePause === "function") togglePause();
  });
}
let isPaused = false;
let isScoreStoreOpen = false;
let scoreStoreFocusIndex = 0;
const SCORE_STORE_GRID_COLUMNS = 3;
const btnPauseQuit = document.getElementById("btnPauseQuit");
if (btnPauseQuit){
  btnPauseQuit.addEventListener("click", () => {
    // Unpause and return to the parent shell's reloaded level 1 when embedded.
    setPaused(false);
    stopMusic();
    resetScoreTrackedStartOptionsToDefaults();
    if (window.parent && window.parent !== window){
      try {
        if (requestReturnToLevel1()) return;
      } catch (e) {}
    }
    // Fallback for standalone use.
    showMenu();
  });
}

const btnPauseResume = document.getElementById("btnPauseResume");
if (btnPauseResume){
  btnPauseResume.addEventListener("click", () => {
    // Resume gameplay (same as pressing ESC)
    togglePause();
  });
}
if (btnPauseOpenStore){
  btnPauseOpenStore.addEventListener("click", () => {
    if (!canOpenStore()) return;
    openScoreStoreMenu();
  });
}
function setScoreStoreOverlayVisible(visible){
  isScoreStoreOpen = !!visible;
  if (pauseOverlay) pauseOverlay.classList.toggle("scoreStoreVisible", isScoreStoreOpen);
}
function setScoreStoreStatus(message){
  if (!scoreStoreStatusEl) return;
  scoreStoreStatusEl.textContent = message || "Select an item to preview this score-spend slot.";
}
function renderScoreStoreHeartsPreviewMarkup(){
  const maxH = Math.max(1, MAX_HEARTS|0);
  const currentHearts = Math.max(0, Math.min(maxH, health * maxH));
  const heartsAreInfinite = !!(infiniteModeActive || heartsInfiniteActive);
  const shieldsAreInfinite = !!(infiniteModeActive || shieldsInfiniteActive);
  const infinityLabel = "x♾️";
  const maxVisibleHudIcons = 5;
  const hearts = Math.max(0, Math.min(maxH, Math.ceil(currentHearts - 0.000001)));
  const full = "❤️";
  const empty = "❌";
  let out = "";

  if (heartsAreInfinite){
    out += `${full}${infinityLabel}`;
  } else {
    const visibleMaxH = Math.min(maxVisibleHudIcons, maxH);
    for (let i = 0; i < visibleMaxH; i++){
      out += (i < hearts ? full : empty) + " ";
    }
    if (hearts > maxVisibleHudIcons) out += `<span class="hudExtra heartsExtra">+${hearts - maxVisibleHudIcons}</span> `;
  }

  if (shieldsAreInfinite){
    out += "  🛡️" + infinityLabel;
  } else if (shieldPips > 0){
    const show = Math.min(maxVisibleHudIcons, shieldPips);
    out += "  " + "🛡️ ".repeat(show);
    if (shieldPips > maxVisibleHudIcons) out += `<span class="hudExtra heartsExtra">+${shieldPips - maxVisibleHudIcons}</span> `;
  }

  let armorIcon = "";
  if (bonusArmor > 0) armorIcon = "🛡️";
  else if (bonusArmorBrokenT > 0) armorIcon = "❌";
  if (armorIcon) out += "  " + armorIcon;

  if (!heartsAreInfinite && !shieldsAreInfinite && (infiniteModeActive || heartsInfiniteActive || shieldsInfiniteActive || bombsInfiniteActive || livesInfiniteActive)) out += "  ♾️";
  return out.trim();
}
function getScoreStoreItemDescription(item){
  if (!item) return "";
  if (item.id !== "big_bullets") return item.description || "";
  if (shootCheatMode === "big_bullets") return `${item.description} Cheat /shoot big_bullets active.`;
  const remainingSeconds = Math.max(0, bigBulletBuffEndTime - time);
  if (!remainingSeconds) return item.description || "";
  return `${item.description} ${Math.ceil(remainingSeconds)}s remaining.`;
}
function isCheatermodeStoreFree(){
  return !!(
    (typeof cheatsUnlockedByPassphrase !== "undefined" && cheatsUnlockedByPassphrase) ||
    (typeof isTektiteNicknameCheatermodeUnlock === "function" && isTektiteNicknameCheatermodeUnlock())
  );
}
function getScoreStoreEffectiveCost(item){
  if (!item) return 0;
  if (isCheatermodeStoreFree()) return 0;
  return Math.abs(Number(item.cost) || 0);
}
function getScoreStoreCostLabel(item){
  return String(isCheatermodeStoreFree() ? 0 : (Number(item && item.cost) || 0)) + " pts";
}
function getScoreStoreCurrentScoreLabel(){
  return isCheatermodeStoreFree() ? "Current Score: ∞pts" : ("Current Score: " + String(Math.floor(score)) + "pts");
}
function spendScoreStoreItem(item){

  if (!item) return false;
  const price = getScoreStoreEffectiveCost(item);
  const currentScore = Math.floor(score);
  if (currentScore < price){
    setScoreStoreStatus(item.label + " costs " + getScoreStoreCostLabel(item) + ". You only have " + currentScore + " pts.");
    return false;
  }

  scoreStoreUnlockedThisRun = true;
  if (price > 0) score = Math.max(0, score - price);

  if (item.id === "hearts"){
    MAX_HEARTS = Math.max(1, Math.floor(MAX_HEARTS || 1) + 1);
    HIT_DAMAGE = 1 / MAX_HEARTS;
    health = Math.min(1, Math.max(0, health || 0) + HIT_DAMAGE);
    if (typeof updateHearts === "function") updateHearts();
    try{ player.y = getPlayerAlignedY(); }catch(e){}
  } else if (item.id === "full_health_restore"){
    health = 1;
    if (typeof updateHearts === "function") updateHearts();
  } else if (item.id === "lives"){
    lives = Math.max(0, Math.floor(lives || 0) + 1);
    if (livesText) livesText.textContent = livesInfiniteActive ? "x∞" : ("x" + lives);
  } else if (item.id === "shields"){
    shieldPips = Math.max(0, Math.floor(shieldPips || 0) + 1);
    if (typeof updateHearts === "function") updateHearts();
  } else if (item.id === "bombs"){
    bombsCount = Math.max(0, Math.floor(bombsCount || 0) + 1);
    if (typeof _syncBombHud === "function") _syncBombHud();
  } else if (item.id === "big_bullets"){
    bigBulletBuffEndTime = Math.max(bigBulletBuffEndTime, time) + BIG_BULLET_DURATION_SECS;
  }

  updateAccuracyScoreHUD();
  if (scoreStoreCurrentScoreEl){
    scoreStoreCurrentScoreEl.textContent = getScoreStoreCurrentScoreLabel();
  }
  if ((item.id === "full_health_restore" || item.id === "big_bullets") && typeof renderScoreStoreMenu === "function") renderScoreStoreMenu();
  if (item.id === "big_bullets"){
    setScoreStoreStatus("Purchased " + item.label + " for " + getScoreStoreCostLabel(item) + ". " + String(Math.ceil(Math.max(0, bigBulletBuffEndTime - time))) + "s active.");
  } else {
    setScoreStoreStatus("Purchased " + item.label + " for " + getScoreStoreCostLabel(item) + ".");
  }
  return true;
}
function renderScoreStoreMenu(){
  if (scoreStoreCurrentScoreEl){
    scoreStoreCurrentScoreEl.textContent = getScoreStoreCurrentScoreLabel();
  }
  setScoreStoreStatus("");
  if (!scoreStoreItemsEl) return;
  scoreStoreItemsEl.innerHTML = "";
  // v7: Show store cards from most expensive to least expensive.
  // Costs are stored as negative score spends, so sort by absolute value.
  const sortedStoreItems = [...SCORE_STORE_ITEMS].sort((a, b) => Math.abs(Number(b.cost) || 0) - Math.abs(Number(a.cost) || 0));
  sortedStoreItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "scoreStoreRow optRow";
    row.tabIndex = -1;
    row.dataset.scoreStoreItemId = item.id;

    const meta = document.createElement("div");
    meta.className = "scoreStoreMeta";

    const head = document.createElement("div");
    head.className = "scoreStoreHead";

    const title = document.createElement("div");
    title.className = "scoreStoreItemTitle";
    title.textContent = item.label;

    // v6: Keep cost only on the purchase button.
    // The separate yellow cost label outside the button was redundant.

    const detail = document.createElement("div");
    detail.className = "scoreStoreItemDetail";
    detail.textContent = getScoreStoreItemDescription(item);

    let preview = null;
    if (item.id === "full_health_restore"){
      preview = document.createElement("div");
      preview.className = "scoreStoreHeartsPreview";
      preview.innerHTML = renderScoreStoreHeartsPreviewMarkup();
    }

    const action = document.createElement("button");
    action.type = "button";
    action.className = "scoreStoreAction smallBtn";
    action.dataset.scoreStoreItemId = item.id;
    action.textContent = getScoreStoreCostLabel(item);
    action.addEventListener("click", () => {
      spendScoreStoreItem(item);
    });

    head.appendChild(title);
    meta.appendChild(head);
    meta.appendChild(detail);
    if (preview) meta.appendChild(preview);
    row.appendChild(meta);
    row.appendChild(action);
    scoreStoreItemsEl.appendChild(row);
  });
}
function openScoreStoreMenu(){
  if (!pauseOverlay || gameState !== STATE.PLAYING || mazeSummaryActive || isDead || !canOpenStore()) return;
  setPaused(true);
  renderScoreStoreMenu();
  setScoreStoreOverlayVisible(true);
  scoreStoreFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncScoreStoreControllerFocus();
  else clearControllerFocus();
}
function closeScoreStoreMenu(options = null){
  if (!isScoreStoreOpen) return;
  scoreStoreFocusIndex = 0;
  setScoreStoreOverlayVisible(false);
  if (activeInputMode === INPUT_MODE_CONTROLLER && isPaused) syncPauseControllerFocus();
  else clearControllerFocus();
}
if (btnScoreStoreClose){
  btnScoreStoreClose.addEventListener("click", () => {
    closeScoreStoreMenu();
  });
}

function requestOpenChatFromPause(){
  try{ setPaused(true); }catch(e){}
  requestOpenChat(false, "");
}
function showPauseControlsMenu(){
  if (!controlsMenu || !isPaused) return;
  syncInitialActiveInputModeFromMenuContext();
  pauseControlsOpen = true;
  resetDraftBindingsFromActive();
  pauseOverlay.classList.add("pauseControlsVisible");
  uiRoot.classList.add("pauseControlsOpen");
  lockControlsInputMode(activeInputMode);
  startMenu.style.display = "none";
  optionsMenu.style.display = "none";
  uiRoot.classList.remove("optionsBackdrop");
  controlsMenu.style.display = "block";
  controlsMenu.classList.add("pauseControlsMode");
  uiRoot.style.display = "flex";
  setControlsBindMode(activeInputMode);
  updateControlsDisplay();
  fitControlsMenuToViewport();
  controlsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncControlsControllerFocus();
  else clearControllerFocus();
}
function hidePauseControlsMenu(){
  if (!pauseControlsOpen) return;
  pauseControlsOpen = false;
  controlsMenu.classList.remove("pauseControlsMode");
  controlsMenu.style.display = "none";
  pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  uiRoot.style.display = "none";
  cancelBindingEdit();
  pauseFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncPauseControllerFocus();
  else clearControllerFocus();
}
if (btnPauseOpenChat){
  btnPauseOpenChat.addEventListener("click", () => {
    showOptions(true);
  });
}

// v1.96: temporary "glitch spiral" post effect (triggered by Tab key)
// Uses the existing fxCanvas as a scratch buffer.
// strength: 0..1 (1 = strongest)
function applyGlitchSpiral(strength){
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return;

  // Copy current frame into fxCanvas
  fxCanvas.width = w; fxCanvas.height = h;
  fxCtx.setTransform(1,0,0,1,0,0);
  fxCtx.clearRect(0,0,w,h);
  fxCtx.drawImage(canvas, 0, 0);

  const t = performance.now() * 0.001;

  // Spiral parameters
  const spin = (2.5 + strength * 7.5) * Math.sin(t * 5.0);
  const zoom = 1 + strength * (0.08 + 0.12 * Math.sin(t * 6.5));
  const wob  = strength * 10 * Math.sin(t * 9.0);

  // Base clear
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);

  // Draw a few rotated/scaled layers with subtle channel offsets and slice jitter
  const layers = 5;
  for (let i = 0; i < layers; i++){
    const a = spin * (0.25 + i * 0.12) + (Math.sin(t*3.0 + i) * 0.08);
    const s = zoom * (1 + i * 0.02 * strength);
    const ox = (Math.sin(t*7.0 + i*1.7) * (6 + 18*strength)) + wob;
    const oy = (Math.cos(t*6.0 + i*1.3) * (6 + 18*strength)) - wob;

    ctx.save();
    ctx.translate(w/2 + ox, h/2 + oy);
    ctx.rotate(a);
    ctx.scale(s, s);
    ctx.translate(-w/2, -h/2);

    // Slight RGB-ish offset using multiple draws (cheap and dirty)
    ctx.globalAlpha = 0.55 - i * 0.08;
    ctx.drawImage(fxCanvas, -2*strength, 0, w, h);
    ctx.globalAlpha = 0.40 - i * 0.06;
    ctx.drawImage(fxCanvas,  2*strength, 0, w, h);
    ctx.globalAlpha = 0.35 - i * 0.05;
    ctx.drawImage(fxCanvas, 0, 0, w, h);
    ctx.restore();
  }

  // Glitch slices: horizontal bands shifted sideways
  const bands = Math.floor(6 + strength * 16);
  for (let b = 0; b < bands; b++){
    const y = Math.floor(Math.random() * h);
    const bh = Math.floor(2 + Math.random() * (8 + 18*strength));
    const dx = Math.floor((Math.random()*2 - 1) * (30 + 160*strength));
    ctx.globalAlpha = 0.25 + Math.random() * 0.35;
    ctx.drawImage(fxCanvas, 0, y, w, bh, dx, y, w, bh);
  }

  // Noise overlay
  ctx.globalAlpha = 0.10 + 0.18 * strength;
  for (let k = 0; k < 200 + strength * 900; k++){
    const x = Math.random() * w;
    const y = Math.random() * h;
    const s = 1 + Math.random() * (2 + 2*strength);
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function setPaused(p){
  isPaused = !!p;
  if (!isPaused && pauseControlsOpen) hidePauseControlsMenu();
  if (!isPaused){
    if (isScoreStoreOpen) setScoreStoreOverlayVisible(false);
  }
  if (pauseOverlay) pauseOverlay.style.display = isPaused ? "flex" : "none";
  if (isPaused){
    syncPauseTitleNickname();
    pauseFocusIndex = 0;
    if (!parentChatVisible && !pauseControlsOpen && !isScoreStoreOpen) syncPauseControllerFocus();
  } else if (gameState !== STATE.MENU && gameState !== STATE.OPTIONS){
    clearControllerFocus();
  }

  // v1.96: focus the command input when paused
  if (pauseCommand){
    if (isPaused){
      setTimeout(()=>{ try{ pauseCommand.focus(); }catch(e){} }, 0);
    } else {
      try{ pauseCommand.blur(); }catch(e){}
      pauseCommand.value = "";
      if (pauseCmdSuggest){ pauseCmdSuggest.style.display = "none"; pauseCmdSuggest.innerHTML = ""; }
    }
  }

  // v1.96: pause ALSO pauses the looping music (resume continues from same timestamp)
  try{
    if (isPaused){
      if (!musicBg.paused) musicBg.pause();
    } else {
      // only resume if we're in gameplay and not muted
      if (gameState === STATE.PLAYING && !audioMuted) musicBg.play().catch(()=>{});
    }
  }catch(e){}

  // When pausing, clear held movement keys so you don't "drift" on resume.
  if (isPaused){
    for (const k in keys) keys[k] = false;
  }
}

function _applyLives(n, forceInfinite){
  const nextLives = forceInfinite ? 100 : Math.max(0, parseInt(n, 10) || 0);
  livesInfiniteActive = !!forceInfinite;
  lives = nextLives;
  _syncStartResourceControls();
  if (gameState === STATE.PLAYING) lockScoreTrackingState();
  if (livesText) livesText.textContent = livesInfiniteActive ? "x∞" : ("x" + lives);
}

function _applyHearts(n, forceInfinite){
  heartsInfiniteActive = !!forceInfinite;
  MAX_HEARTS = heartsInfiniteActive ? 100 : Math.max(1, parseInt(n, 10) || 1);
  HIT_DAMAGE = 1 / MAX_HEARTS;
  _syncStartResourceControls();
  // Top off health so the new max doesn't instantly punish you.
  health = 1.0;
  if (typeof updateHearts === "function") updateHearts();
  // Re-anchor the player in case the hearts HUD size changes.
  try{ player.y = getPlayerAlignedY(); }catch(e){}
  if (gameState === STATE.PLAYING) lockScoreTrackingState();
}

function _applyShields(n, forceInfinite){
  const nextShields = forceInfinite ? 100 : Math.max(0, parseInt(n, 10) || 0);
  shieldsInfiniteActive = !!forceInfinite;
  shieldPips = nextShields;
  _syncStartResourceControls();
  if (typeof updateHearts === "function") updateHearts();
  if (gameState === STATE.PLAYING) lockScoreTrackingState();
}

function _applyBombs(n, forceInfinite){
  const nextBombs = forceInfinite ? 100 : Math.max(0, parseInt(n, 10) || 0);
  bombsInfiniteActive = !!forceInfinite;
  bombsCount = nextBombs;
  _syncStartResourceControls();
  _syncBombHud();
  if (gameState === STATE.PLAYING) lockScoreTrackingState();
}

function refreshInfiniteModeUi(){
  if (typeof renderMenuHudPreview === "function") renderMenuHudPreview();
}

function applyGlobalInfiniteMode(enabled){
  INFINITE_MODE = !!enabled;
  infiniteModeActive = !!INFINITE_MODE;
  _applyLives((START_LIVES_INFINITE || INFINITE_MODE) ? 100 : START_LIVES, !!(START_LIVES_INFINITE || INFINITE_MODE));
  _applyHearts((START_HEARTS_INFINITE || INFINITE_MODE) ? 100 : START_HEARTS, !!(START_HEARTS_INFINITE || INFINITE_MODE));
  _applyShields((START_SHIELDS_INFINITE || INFINITE_MODE) ? 100 : START_SHIELDS, !!(START_SHIELDS_INFINITE || INFINITE_MODE));
  _applyBombs((START_BOMBS_INFINITE || INFINITE_MODE) ? 100 : START_BOMBS, !!(START_BOMBS_INFINITE || INFINITE_MODE));
  refreshInfiniteModeUi();
  if (gameState !== STATE.PLAYING) syncScoreTrackingState();
}

function setIndividualInfiniteResource(resourceName){
  let message = "";
  switch (resourceName){
    case "lives":
      START_LIVES_INFINITE = true;
      _applyLives(100, true);
      message = "Lives set to infinite";
      break;
    case "hearts":
      START_HEARTS_INFINITE = true;
      _applyHearts(100, true);
      message = "Hearts set to infinite";
      break;
    case "shields":
      START_SHIELDS_INFINITE = true;
      _applyShields(100, true);
      message = "Shields set to infinite";
      break;
    case "bombs":
      START_BOMBS_INFINITE = true;
      _applyBombs(100, true);
      message = "Bombs set to infinite";
      break;
    default:
      return "";
  }
  refreshInfiniteModeUi();
  if (gameState !== STATE.PLAYING) syncScoreTrackingState();
  return message;
}
function readStartHudPreviewOption(inputEl, savedValue, savedInfinite, minValue){
  const shouldReadLiveInput = !!(
    inputEl &&
    (gameState === STATE.OPTIONS || gameState === STATE.CHEATS) &&
    inputEl.offsetParent !== null
  );
  if (!shouldReadLiveInput){
    return {
      infinite: !!(savedInfinite || INFINITE_MODE),
      value: savedInfinite || INFINITE_MODE ? 100 : Math.max(minValue, parseInt(savedValue, 10) || minValue)
    };
  }

  const raw = String(inputEl.value || "").trim().toLowerCase();
  const infinite = raw === "∞" || raw === "inf" || raw === "infinite" || raw === "max" || raw === "100";
  if (infinite || INFINITE_MODE) return { infinite:true, value:100 };
  const parsed = parseInt(raw, 10);
  return { infinite:false, value:Math.max(minValue, Number.isFinite(parsed) ? parsed : minValue) };
}
function renderMenuHudPreview(){
  const gameplayHudActiveForMenuPreview = (typeof isPausedGameplayMenuBackdropState === "function")
    ? isPausedGameplayMenuBackdropState()
    : (typeof gameState !== "undefined" && typeof STATE !== "undefined" && gameState === STATE.PLAYING);
  if (gameplayHudActiveForMenuPreview){
    if (typeof updateAccuracyScoreHUD === "function") updateAccuracyScoreHUD();
    if (typeof updateTimerHUD === "function") updateTimerHUD();
    if (livesSlot) livesSlot.style.display = (typeof playerSpectatorMode !== "undefined" && playerSpectatorMode) ? "none" : "flex";
    if (livesText) livesText.textContent = livesInfiniteActive ? "x∞" : ("x" + lives);
    if (typeof _syncBombHud === "function") _syncBombHud();
    return;
  }
  const heartsHud = document.getElementById("heartsHud");
  const livesPreview = readStartHudPreviewOption(livesSlider, START_LIVES, START_LIVES_INFINITE, 0);
  const heartsPreview = readStartHudPreviewOption(heartsSlider, START_HEARTS, START_HEARTS_INFINITE, 1);
  const shieldsPreview = readStartHudPreviewOption(shieldsSlider, START_SHIELDS, START_SHIELDS_INFINITE, 0);
  const bombsPreview = readStartHudPreviewOption(bombsSlider, START_BOMBS, START_BOMBS_INFINITE, 0);
  const previewLivesInfinite = !!livesPreview.infinite;
  const previewHeartsInfinite = !!heartsPreview.infinite;
  const previewShieldsInfinite = !!shieldsPreview.infinite;
  const previewBombsInfinite = !!bombsPreview.infinite;
  const previewLives = previewLivesInfinite ? 100 : Math.max(0, parseInt(livesPreview.value, 10) || 0);
  const previewHearts = previewHeartsInfinite ? 100 : Math.max(1, parseInt(heartsPreview.value, 10) || 1);
  const previewShields = previewShieldsInfinite ? 100 : Math.max(0, parseInt(shieldsPreview.value, 10) || 0);
  const previewBombs = previewBombsInfinite ? 100 : Math.max(0, parseInt(bombsPreview.value, 10) || 0);
  const maxVisibleHudIcons = 5;

  // Keep the corner counter HUD hidden during pregame/menu preview.
  // Values are still prepared below where needed, but display is not toggled visible
  // before the final hide pass, avoiding a one-frame refresh flash.
  if (livesText) livesText.textContent = previewLivesInfinite ? "x∞" : ("x" + previewLives);
  if (powerupHint){
    if (previewBombsInfinite) powerupHint.textContent = "Q ∞";
    else powerupHint.textContent = "Q x" + Math.max(1, previewBombs);
  }
  if (timerHud){
    timerHud.innerHTML = '<div class="timerHudLabel">Time</div><div class="timerHudValue">0.0s</div>';
  }

  // v24: Start/menu preview shows only Hearts/Shields.
  // Score, Time, Lives, and Bombs stay hidden until Start Game is pressed.
  if (scoreStoreHud){
    scoreStoreHud.style.display = "none";
    scoreStoreHud.classList.remove("storeReady");
    scoreStoreHud.disabled = true;
    scoreStoreHud.tabIndex = -1;
    scoreStoreHud.setAttribute("aria-disabled", "true");
  }
  if (accuracyScoreEl) accuracyScoreEl.style.display = "none";
  if (storeUnlockedHudEl) storeUnlockedHudEl.style.display = "none";
  if (livesSlot) livesSlot.style.display = "none";
  if (powerupSlot) powerupSlot.style.display = "none";

  if (!heartsHud) return;

  let out = "";
  if (previewHeartsInfinite) out += "❤️x♾️";
  else {
    const visibleHearts = Math.min(maxVisibleHudIcons, previewHearts);
    for (let i = 0; i < visibleHearts; i++) out += "❤️ ";
    if (previewHearts > maxVisibleHudIcons) out += `<span class="heartsExtra">+${previewHearts - maxVisibleHudIcons}</span> `;
  }

  if (previewShieldsInfinite) out += "  🛡️x♾️";
  else if (previewShields > 0){
    const visibleShields = Math.min(maxVisibleHudIcons, previewShields);
    out += "  " + "🛡️ ".repeat(visibleShields);
    if (previewShields > maxVisibleHudIcons) out += "+" + (previewShields - maxVisibleHudIcons) + " ";
  }

  heartsHud.innerHTML = out.trim();
  heartsHud.style.display = out.trim() ? "block" : "none";
}




let bgSuggestOpen = false;
let bgSuggestIndex = 0;
let bgSuggestList = [];

function deleteIndexedDatabaseByName(name){
  return new Promise((resolve) => {
    try{
      if (!window.indexedDB || !name) return resolve(false);
      const request = window.indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    }catch(error){
      resolve(false);
    }
  });
}

async function clearAllShooterSiteDataForFirstVisit(){
  // Hidden /reset: wipe browser-side site state while only severing folder links.
  // It intentionally does not call deleteSavedImages(), because the actual image files
  // in the user-selected folder are not ours to vaporize. Shocking restraint, I know.
  try{ window.localStorage.clear(); }catch(error){}
  try{ window.sessionStorage.clear(); }catch(error){}

  try{
    if (window.tektiteShooterSavedImageStorage && typeof window.tektiteShooterSavedImageStorage.forgetSavedImageFolderConnections === "function"){
      await window.tektiteShooterSavedImageStorage.forgetSavedImageFolderConnections();
    }
  }catch(error){}

  try{
    if (window.indexedDB && typeof window.indexedDB.databases === "function"){
      const databases = await window.indexedDB.databases();
      await Promise.all((databases || [])
        .map(db => db && db.name)
        .filter(Boolean)
        .map(deleteIndexedDatabaseByName));
    }else{
      await deleteIndexedDatabaseByName("tektiteShooterSavedImagesFS");
    }
  }catch(error){
    try{ await deleteIndexedDatabaseByName("tektiteShooterSavedImagesFS"); }catch(_){}
  }

  try{
    if (window.caches && typeof window.caches.keys === "function"){
      const keys = await window.caches.keys();
      await Promise.all((keys || []).map(key => window.caches.delete(key)));
    }
  }catch(error){}

  try{
    document.cookie.split(";").forEach(cookie => {
      const eq = cookie.indexOf("=");
      const name = (eq > -1 ? cookie.slice(0, eq) : cookie).trim();
      if (!name) return;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  }catch(error){}

  try{
    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === "function"){
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all((registrations || []).map(reg => reg.unregister()));
    }
  }catch(error){}
}

function runHiddenResetCommand(){
  clearAllShooterSiteDataForFirstVisit().finally(() => {
    try{
      if (window.parent && window.parent !== window){
        window.parent.postMessage({ type: "tektite:site-data-reset" }, "*");
      }
    }catch(error){}
    window.setTimeout(() => {
      try{
        const targetWindow = (window.top && window.top !== window) ? window.top : window;
        const cleanUrl = String(targetWindow.location.href || window.location.href).split("#")[0];
        targetWindow.location.replace(cleanUrl);
      }catch(error){
        try{ window.location.reload(); }catch(_){}
      }
    }, 250);
  });
  return { ok:true, message:"/reset wiped browser site data and severed saved-image folder connections. Reloading as a first visit." };
}

function execPauseCommand(cmd){
  const raw = String(cmd||"").trim();
  if (!raw) return;

  // v1.96: /help -> list commands alphabetically inside the pause panel
  if (raw === "/help"){
    showHelp();
    return { ok:true, suppressChatResult:true };
  }

  // Hidden hard reset. Not listed in /help, because the big red button does not need a brochure.
  if (raw.toLowerCase() === "/reset"){
    return runHiddenResetCommand();
  }

  if (raw === "/mute"){
    setMuteOptionEnabled(!audioMuted);
    return { ok:true, message:`Mute ${audioMuted ? "enabled" : "disabled"}` };
  }

  if (raw === "/log") {
    return { ok: true, message: getLastUpdatedLogMessage() };
  }

  // v1.96: /fullscreen -> toggle browser fullscreen
  if (raw === "/fullscreen"){
    toggleFullscreen();
    return;
  }

  // /video_fx -> toggle chromatic aberration + hue drift
  if (raw === "/video_fx"){
    VIDEO_FX_ENABLED = !VIDEO_FX_ENABLED;
    return { ok:true, message:`Video FX ${VIDEO_FX_ENABLED ? "enabled" : "disabled"}` };
  }

  // /infinite -> toggle global infinite mode, or set one resource to infinite
  if (raw.startsWith("/infinite")){
    const arg = raw.slice("/infinite".length).trim().toLowerCase();
    if (!arg){
      applyGlobalInfiniteMode(!INFINITE_MODE);
      return { ok:true, message:`Infinite mode ${INFINITE_MODE ? "enabled" : "disabled"} for all resources` };
    }
    const resourceMessage = setIndividualInfiniteResource(arg);
    if (resourceMessage) return { ok:true, message: resourceMessage };
    return { ok:false, message:"Usage: /infinite [hearts|shields|lives|bombs]" };
  }


  // v1.96: /lives [#|infinite]
  if (raw.startsWith("/lives")){
    const arg = raw.slice("/lives".length).trim();
    const p = _parseCountOrInfinite(arg);
    if (p){
      _applyLives(p.value, !!p.infinite);
      return { ok:true, message:`Set player lives to ${p.infinite ? "MAX" : p.value}` };
    }
    return { ok:false, message:"Usage: /lives [0-99|100|MAX]" };
  }

  // v1.96: /hearts [#|infinite]
  if (raw.startsWith("/hearts")){
    const arg = raw.slice("/hearts".length).trim();
    const p = _parseCountOrInfinite(arg);
    if (p){
      _applyHearts(p.value, !!p.infinite);
      return { ok:true, message:`Set player hearts to ${p.infinite ? "MAX" : p.value}` };
    }
    return { ok:false, message:"Usage: /hearts [1-99|100|MAX]" };
  }

  // v1.96: /shields [#|infinite]
  if (raw.startsWith("/shields")){
    const arg = raw.slice("/shields".length).trim();
    const p = _parseCountOrInfinite(arg);
    if (p){
      _applyShields(p.value, !!p.infinite);
      return { ok:true, message:`Set player shields to ${p.infinite ? "MAX" : p.value}` };
    }
    return { ok:false, message:"Usage: /shields [0-99|100|MAX]" };
  }

  // v1.96: /bombs [#|infinite]
  if (raw.startsWith("/bombs")){
    const arg = raw.slice("/bombs".length).trim();
    const p = _parseCountOrInfinite(arg);
    if (p){
      _applyBombs(p.value, !!p.infinite);
      return { ok:true, message:`Set player bombs to ${p.infinite ? "MAX" : p.value}` };
    }
    return { ok:false, message:"Usage: /bombs [0-99|100|MAX]" };
  }

  if (raw.startsWith("/shoot")){
    const arg = raw.slice("/shoot".length).trim().toLowerCase();
    if (arg === "normal"){
      shootCheatMode = "normal";
      bigBulletBuffEndTime = 0;
      glitchBackgroundPulse = 0;
      lockScoreTrackingState();
      return { ok:true, message:"Shoot mode set to normal bullets" };
    }
    if (arg === "big_bullets" || arg === "big-bullets"){
      shootCheatMode = "big_bullets";
      glitchBackgroundPulse = 0;
      lockScoreTrackingState();
      return { ok:true, message:"Shoot mode set to big bullets" };
    }
    if (arg === "glitch"){
      shootCheatMode = "glitch";
      bigBulletBuffEndTime = 0;
      glitchBackgroundPulse = Math.max(glitchBackgroundPulse, 0.85);
      lockScoreTrackingState();
      return { ok:true, message:"Shoot mode set to EMT glitch cannon" };
    }
    return { ok:false, message:"Usage: /shoot [normal|big_bullets|glitch]" };
  }



  // /color_invert -> toggle invert colors mode (same as Options menu)
  if (raw === "/color_invert"){
    document.body.classList.toggle("invert-colors");
    return;
  }

  if (raw.startsWith(BG_CMD)){
    const arg = raw.slice(BG_CMD.length).trim();

    // v1.96: allow named colors OR any valid hex code (#RGB, #RRGGBB, #RRGGBBAA), with or without leading "#"
    if (!arg){
      starfieldBgOverride = null;
      return;
    }

    const hexMatch = arg.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
    if (hexMatch){
      starfieldBgOverride = "#" + hexMatch[1];
      return;
    }

    // fall back to letting the browser try to interpret it as a CSS color name/value
    starfieldBgOverride = arg;
    return;
  }

  // future commands go here
  try{ console.log("[PAUSE CMD]", raw); }catch(e){}
}



window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "tektite:chat-visibility"){
    parentChatVisible = !!data.visible;
    parentChatValuePickerActive = !!data.valuePickerActive;
    parentChatValuePickerCommand = parentChatValuePickerActive ? String(data.valuePickerCommand || "").trim().toLowerCase() : "";
    if (isPaused && !parentChatVisible) syncPauseControllerFocus();
    return;
  }

  if (data.type === "tektite:pause-for-chat"){
    if (gameState === STATE.PLAYING && !isPaused && !isDead && !(deathOverlay && deathOverlay.style.display === "flex")){
      setPaused(true);
    }
    return;
  }

  if (data.type === "tektite:saved-images-updated"){
    if (typeof renderSavedImages === "function") renderSavedImages();
    showSavedImageStatus(String(data.message || (data.ok === false ? "Unable to save screenshot." : "Screenshot saved to Profile > Saved Images.")), data.ok !== false);
    return;
  }

  if (data.type !== "tektite:execute-command") return;

  const command = String(data.command || "").trim();
  const result = execPauseCommand(command);

  if (window.parent && window.parent !== window && !(result && result.suppressChatResult)) {
    postCommandResult(command, result);
  }
});

// v1.96: Pause command input listeners
if (pauseCommand){
  pauseCommand.addEventListener("keydown", (ev) => {
    // Prevent gameplay binds while typing
    ev.stopPropagation();

    // Autocomplete cycling when suggestions are open
    if (bgSuggestOpen && (ev.key === "Tab" || ev.key === "ArrowDown" || ev.key === "ArrowUp")){
      if (ev.key === "ArrowUp") cycleBgChoice(-1);
      else cycleBgChoice(1);
      applyBgChoiceToInput();
      ev.preventDefault();
      return;
    }

    if (ev.key === "Enter"){
      const cmd = (pauseCommand.value || "").trim();
      if (cmd) execPauseCommand(cmd);
      pauseCommand.value = "";
      // v1.96 fix: keep /help visible (don’t immediately close the panel)
      if (cmd !== "/help") closeBgSuggest();
      ev.preventDefault();
      return;
    }

    // Let Esc unpause even when focused
    if (ev.key === "Escape"){
      ev.preventDefault();
      closeBgSuggest();
      togglePause();
      return;
    }
  });

  pauseCommand.addEventListener("input", () => {
    const v = pauseCommand.value || "";
    if (bgPrefix(v)) openBgSuggestFromValue(v);
    else closeBgSuggest();
  });
}

if (pauseCmdSuggest){
  pauseCmdSuggest.addEventListener("mousedown", (ev) => {
    // v1.96: Click-to-fill for /help command list.
    const cmdRow = ev.target && ev.target.closest ? ev.target.closest("[data-cmd]") : null;
    if (cmdRow && pauseCommand){
      const cmd = cmdRow.getAttribute("data-cmd") || "";
      pauseCommand.value = cmd ? (cmd + " ") : "";
      try{ pauseCommand.focus(); }catch(e){}
      // If background suggestions were open, close them (help list is the focus now).
      closeBgSuggest();
      ev.preventDefault();
      return;
    }

    // Existing behavior: click to select a /background_color suggestion
    const row = ev.target && ev.target.closest ? ev.target.closest("div[data-i]") : null;
    if (!row) return;
    const i = parseInt(row.getAttribute("data-i"), 10);
    if (!isNaN(i)){
      bgSuggestIndex = i;
      applyBgChoiceToInput();
      renderBgSuggest();
    }
    ev.preventDefault();
  });
}

function togglePause(){
  if (gameState !== STATE.PLAYING) return;
  if (isScoreStoreOpen){
    closeScoreStoreMenu();
    return;
  }
  if (mazeSummaryActive) return;
  if (isDead) return; // don't pause during death freeze/respawn
  if (deathOverlay && deathOverlay.style.display === "flex") return; // don't pause on GAME OVER
  setPaused(!isPaused);
}


// =======================
// Right-Click Shield (v1.96)
// - Hold RIGHT MOUSE to raise a neon rainbow shield ring.
// - Shield blocks/bounces enemy contact + enemy bullets.
// - Uses "shield HP" so bullets don't erase it instantly.
// - Shield persists while held; only drops on release or when HP is depleted.
// - 30s cooldown after releasing or after shield breaks.
// =======================
let shieldActive = false;
let mouseShieldHolding = false;
let mouseFireHolding = false; // v1.96: allow holding LMB to keep firing (even while shielding)
let gamepadShieldHolding = false;
let shieldHolding = false; // combined (mouse OR gamepad)
const GP_MENU_AXIS_THRESHOLD = 0.55;
const GP_MENU_REPEAT_DELAY = 0.24;
const GP_MENU_REPEAT_RATE = 0.12;
const GP_CHAT_VALUE_REPEAT_DELAY = 0.06;
const GP_CHAT_VALUE_REPEAT_RATE = 0.045;
const GP_CHAT_SHOOT_REPEAT_DELAY = 0.22;
const GP_CHAT_SHOOT_REPEAT_RATE = 0.18;
// HP model (more sane than "3 hits" when bullets are flying)
let shieldHP = 0;
const SHIELD_HP_MAX = 120;             // "reasonable amount" of damage before it breaks
const SHIELD_BULLET_DMG = 6;           // bullets nibble, they don't annihilate
const SHIELD_COLLISION_DMG = 18;       // ramming the shield costs more
let shieldCooldown = 0;                // seconds remaining
const SHIELD_COOLDOWN_SECS = 30;
const SHIELD_RADIUS_MULT = 0.78;       // relative to player size

// If focus/pointer events get weird, don't insta-drop the shield.
// Give a short grace period before forcing it off.
let shieldHoldGrace = 0;
const SHIELD_HOLD_GRACE_SECS = 0.25;

function canActivateShield(){
  return (gameState === STATE.PLAYING && !isDead && shieldCooldown <= 0 && !shieldActive);
}
function startShield(){
  shieldActive = true;
  // v1.96: If you let go earlier, keep remaining HP for next time.
  // Only refill to full when it was fully broken (shieldHP == 0) and cooldown has expired.
  if (shieldHP <= 0) shieldHP = SHIELD_HP_MAX;
  shieldHoldGrace = SHIELD_HOLD_GRACE_SECS;
}
function stopShield(startCooldown=false){
  // v1.96: Releasing shield should NOT trigger cooldown and should NOT erase remaining HP.
  if (shieldActive){
    shieldActive = false;
    shieldHoldGrace = 0;
    if (startCooldown) shieldCooldown = SHIELD_COOLDOWN_SECS;
  }
}
function shieldApplyDamage(dmg){
  if (!shieldActive) return;
  shieldHP = Math.max(0, shieldHP - Math.max(0, dmg));
  if (shieldHP <= 0){
    // v1.96: Cooldown ONLY when the shield breaks.
    stopShield(false);
  }
}
 // v1.96: HUD hidden by default; toggle with / (Slash)

let time = 0;
let score = 0;
let scoreTrackingDisabled = false;
let scoreTrackingLocked = false;
let scoreStoreUnlockedThisRun = false;
let shotsFired = 0;
let hitsConnected = 0;
let damageDealt = 0;
let runTimer = 0; // seconds since Start Game
const STORE_UNLOCK_SCORE_THRESHOLD = 0;
const PLAYER_BULLET_RADIUS = 5;
const BIG_BULLET_RADIUS_MULTIPLIER = 2;
const BIG_BULLET_DURATION_SECS = 30;
const SCORE_STORE_ITEMS = [
  { id: "big_bullets", label: "Big Bullets", cost: -500, description: "Spend score to fire 2x bigger lightning-branch bullets for 30 seconds." },
  { id: "hearts", label: "Extra Heart", cost: -250, description: "Spend score to add 1 heart to your total hearts." },
  { id: "lives", label: "Extra Life", cost: -250, description: "Spend score to add 1 extra life." },
  { id: "full_health_restore", label: "Full Health Restore", cost: -150, description: "Spend score to refill your current hearts to full." },
  { id: "shields", label: "Shield", cost: -125, description: "Spend score to add 1 shield pip." },
  { id: "bombs", label: "Bomb", cost: -100, description: "Spend score to add 1 bomb." }
];
let bigBulletBuffEndTime = 0;
let shootCheatMode = "normal";
let glitchBackgroundPulse = 0;
// v1.96: "Spectral Funk" tuning knob (because humans love naming sliders like they're mixtapes).
// 1000 = baseline. Higher = spicier enemies (faster patterns + smarter shots). Lower = chill mode.
const SPECTRAL_FUNK = 1000;
const FUNK = Math.max(0.25, Math.min(2.5, SPECTRAL_FUNK / 1000));

let lives = 0; // extra lives (decremented when health hits 0)
let frogKills = 0; // counts frog kills; every 3 frogs awards +1 life
let health = 1.0; // 0..1 (4 hits -> 0)
let MAX_HEARTS = 4; // v1.96: configurable hearts per life
let HIT_DAMAGE = 0.25; // 25% per hit (4 hearts = one life)

// =======================
// Dragon Bomb-Kill Armor (v1.96)
// - If a dragon.gif enemy is killed by the BOMB blast, grant a one-time +25% armor.
// - Armor absorbs the next hit, then turns into an ❌ briefly next to the hearts HUD.
// =======================
let bonusArmor = 0;              // 0 or 0.25
let bonusArmorBrokenT = 0;       // seconds remaining to show ❌
let shieldPips = 0;            // v1.96: extra one-hit armor pips
let isDead = false;
let deathTimer = 0;
let deathGameOver = false;
let deathYellPlayed = false;
const deathParticles = [];

let deathFocusIndex = 0;
let deathQuitConfirmArmed = false;
let deathQuitConfirmReady = false;
let deathQuitConfirmTimer = null;
let deathQuitConfirmRemaining = 0;
const deathButtons = [];



let wave = 1;
let firstBossSpawned = false; // track first boss size


// v1.96: formation dimensions are dynamic per wave (wave 1 = 1 enemy, then doubles)
let formationCols = 1;
let formationRows = 1;
// v1.96: debug-only numbers shown in the HUD overlay
let ENEMY_COLS = formationCols;
let ENEMY_ROWS = formationRows;
// v1.96: wave banner (big text popup)
let waveBanner = { text:"", t:0, color:"#00ff66" };

function getWaveLabel(n){
  // Wave label rules:
  // - Waves 1-10: "Wave N"
  // - Wave 11: "Bonus Mode" (red)
  // - Waves 12-21: "INSANITY WAVE: K" where K = n-11
  if (n === 11) return { text:"Bonus Mode", color:"#7dff7d" };
  if (n >= 12 && n <= 21) return { text:"INSANITY WAVE: " + (n - 11), color:"#ffffff" };
  return { text:"Wave " + n, color:"#ffffff" };
}

function showWaveBanner(n){
  const lab = getWaveLabel(n);
  waveBanner.text = lab.text;
  waveBanner.color = lab.color;
  waveBanner.t = 1.35;
}

const STATE = { MENU:"menu", OPTIONS:"options", CONTROLS:"controls", PLAYING:"playing", WIN:"win" };
let gameState = STATE.MENU;

function syncStartMenuHudLayerMode(){
  try{
    const pregameHudHidden = gameState === STATE.MENU;
    document.body.classList.toggle("start-menu-hud-over-gameplay", pregameHudHidden);
    document.documentElement.classList.toggle("sg-hud-pregame", pregameHudHidden);
  }catch(_){ }
}

let gameWon = false;

// Powerup state (v1.96)
let ufo = null;
let bomb = null;
let bombsCount = 0;
let infiniteModeActive = false;
let livesInfiniteActive = false;
let heartsInfiniteActive = false;
let shieldsInfiniteActive = false;
let bombsInfiniteActive = false;


/* =======================
   Utility
======================= */
// =======================
// Accuracy Scoring (v1.96)
// - shotsFired: player bullets spawned
// - hitsConnected: player bullet hits that dealt damage
// - damageDealt: sum of bullet damage that landed
// Score awards scale with accuracy so spray-and-pray pays less.
// =======================
function getAccuracy(){
  if (shotsFired <= 0) return 0;
  return Math.max(0, Math.min(1, hitsConnected / shotsFired));
}

function getAccuracyMultiplier(){
  // 0% -> 0.55x, 100% -> 1.75x (gentle, not punitive)
  const a = getAccuracy();
  return 0.55 + a * 1.20;
}

function getConfiguredStartWave(){
  return Math.max(1, Math.min(21, parseInt(START_WAVE, 10) || URL_START_WAVE || DEFAULT_START_WAVE));
}

function hasScoreDisqualifyingSettings(){
  return !!(
    INFINITE_MODE ||
    START_LIVES_INFINITE ||
    START_HEARTS_INFINITE ||
    START_SHIELDS_INFINITE ||
    START_BOMBS_INFINITE ||
    Math.max(0, parseInt(START_LIVES, 10) || 0) !== DEFAULT_START_LIVES ||
    Math.max(1, parseInt(START_HEARTS, 10) || 1) !== DEFAULT_START_HEARTS ||
    Math.max(0, parseInt(START_SHIELDS, 10) || 0) !== DEFAULT_START_SHIELDS ||
    Math.max(0, parseInt(START_BOMBS, 10) || 0) !== DEFAULT_START_BOMBS ||
    Math.round(Number(START_GAME_SPEED) || DEFAULT_START_GAME_SPEED) !== DEFAULT_START_GAME_SPEED ||
    getConfiguredStartWave() !== DEFAULT_START_WAVE
  );
}

function isGameSpeedFrozen(){
  return Math.round(Number(START_GAME_SPEED) || 0) === 0 || GAME_SPEED_MULT === 0;
}

function getStaticFrameForImage(img){
  return img || null;
}

function syncAnimatedGifSprite(){
  return false;
}

function hideAnimatedGifSprite(){
}

function syncScoreTrackingState(){
  const nextDisabled = !!(scoreTrackingLocked || isTektiteNicknameCheatermodeUnlock() || hasScoreDisqualifyingSettings());
  scoreTrackingDisabled = nextDisabled;
  if (isScoreStoreOpen && typeof closeScoreStoreMenu === "function" && typeof canOpenStore === "function" && !canOpenStore()){
    closeScoreStoreMenu();
  }
  if (typeof updateAccuracyScoreHUD === "function") updateAccuracyScoreHUD();
  if (typeof renderMenuHudPreview === "function") renderMenuHudPreview();
}

function lockScoreTrackingState(){
  scoreTrackingLocked = true;
  syncScoreTrackingState();
}

function resetScoreTrackingState(){
  scoreTrackingLocked = false;
  syncScoreTrackingState();
}

function awardScore(basePoints){
  if (scoreTrackingDisabled) return 0;
  const awarded = Math.round(Math.max(0, basePoints) * getAccuracyMultiplier());
  score += awarded;
  if (Math.floor(score) >= STORE_UNLOCK_SCORE_THRESHOLD) scoreStoreUnlockedThisRun = true;
  return awarded;
}

function isStoreUnlocked(){
  if (isCheatermodeStoreFree()) return true;
  if (scoreTrackingDisabled) return false;
  if (Math.floor(score) >= STORE_UNLOCK_SCORE_THRESHOLD) scoreStoreUnlockedThisRun = true;
  return scoreStoreUnlockedThisRun;
}

function canOpenStore(){
  return gameState === STATE.PLAYING && !mazeSummaryActive && !isDead && (isCheatermodeStoreFree() || (!scoreTrackingDisabled && isStoreUnlocked()));
}

const scoreStoreHud = document.getElementById("scoreStoreHud");
const accuracyScoreEl = document.getElementById("accuracyScore");
const scoreHudLabelEl = document.getElementById("scoreHudLabel");
const storeUnlockedHudEl = document.getElementById("storeUnlockedHud");
const timerHud = document.getElementById("timerHud");
if (scoreStoreHud){
  scoreStoreHud.addEventListener("click", () => {
    if (!canOpenStore()) return;
    openScoreStoreMenu();
  });
}
function updateAccuracyScoreHUD(){
  if (!accuracyScoreEl) return;
  const isPlaying = gameState === STATE.PLAYING;
  const scoreVisible = isPlaying && !scoreTrackingDisabled;
  const cheatsVisible = isPlaying && scoreTrackingDisabled;
  const hudVisible = scoreVisible || cheatsVisible;
  const storeUnlocked = isPlaying && isStoreUnlocked();
  const canOpen = isPlaying && canOpenStore();
  if (scoreStoreHud){
    scoreStoreHud.style.display = hudVisible ? "flex" : "none";
    scoreStoreHud.classList.toggle("storeReady", canOpen);
    scoreStoreHud.disabled = !canOpen;
    scoreStoreHud.tabIndex = canOpen ? 0 : -1;
    scoreStoreHud.setAttribute("aria-disabled", canOpen ? "false" : "true");
  }
  if (btnPauseOpenStore) btnPauseOpenStore.style.display = canOpen ? "block" : "none";
  accuracyScoreEl.style.display = hudVisible ? "block" : "none";
  accuracyScoreEl.style.color = cheatsVisible ? "#00ff66" : "";
  if (scoreHudLabelEl) scoreHudLabelEl.textContent = cheatsVisible ? "Cheats" : "Score";
  accuracyScoreEl.textContent = cheatsVisible ? "Enabled" : (String(Math.floor(score)) + "pts");
  if (storeUnlockedHudEl){
    storeUnlockedHudEl.style.display = storeUnlocked ? "block" : "none";
    storeUnlockedHudEl.textContent = canOpen ? "Open Store" : "Store Unlocked";
  }
}

function formatRunTime(seconds){
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const units = [
    { suffix:"y", seconds:365 * 24 * 60 * 60 },
    { suffix:"d", seconds:24 * 60 * 60 },
    { suffix:"h", seconds:60 * 60 },
    { suffix:"m", seconds:60 },
    { suffix:"s", seconds:1 }
  ];
  for (const unit of units){
    if (safeSeconds >= unit.seconds){
      return (safeSeconds / unit.seconds).toFixed(1) + unit.suffix;
    }
  }
  return "0.0s";
}

function updateTimerHUD(){
  if (!timerHud) return;
  // Show timer only while actually playing
  if (gameState !== STATE.PLAYING){
    timerHud.style.display = "none";
    return;
  }
  timerHud.style.display = "block";
  timerHud.innerHTML = '<div class="timerHudLabel">Time</div><div class="timerHudValue">' + formatRunTime(runTimer) + '</div>';
}

function isDragonEnemy(e){
  return !!(e && e.img && e.img.src && e.img.src.toLowerCase().includes("dragon.gif"));
}

// =======================
// Enemy hit feedback (v1.96)
// - flash red briefly when damaged
// - fade out when killed (instead of instantly vanishing)
// NOTE: This only touches canvas drawing + enemy objects; it will not mess with menus.
// =======================
const ENEMY_HIT_FLASH_SECS = 0.24;   // how long the red flash lasts after damage
const ENEMY_HIT_FLASH_ALPHA = 0.58;  // red overlay strength; still masked to opaque sprite pixels
const ENEMY_DEATH_FADE_SECS = 0.52;  // how long the death fade lasts; long enough for the explosion distortion to read
const ENEMY_DEATH_FLASH_SECS = 0.34; // keep fresh kills visibly red into the fadeout
const ENEMY_DEATH_GROW_SCALE = 1.35; // visual-only corpse explosion swell; hitboxes stay unchanged
const ENEMY_DEATH_BULGE_GRID = 9;    // grid distortion resolution for the fisheye death bulge
const ENEMY_DEATH_BULGE_STRENGTH = 0.415; // outward center bulge strength during death fade (33% smaller)
const UFO_SIZE_SCALE = 1.33;          // Desktop UFO scale
const MOBILE_UFO_SIZE_SCALE = 0.96;   // Phones keep the UFO closer to desktop on-screen size
const UFO_DEATH_RED_ALPHA = 0.72;     // red death overlay strength while UFO fades

function getUfoSizeScale(){
  return isMobilePhoneViewport() ? MOBILE_UFO_SIZE_SCALE : UFO_SIZE_SCALE;
}


const enemyHitFlashTintCanvas = document.createElement("canvas");
const enemyHitFlashTintCtx = enemyHitFlashTintCanvas.getContext("2d", { willReadFrequently: false });

function drawEnemyBulgedImage(ctx, img, x, y, w, h, deathProgress, alpha = 1){
  if (!ctx || !img) return false;
  const p = Math.max(0, Math.min(1, deathProgress || 0));
  if (p <= 0){
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    return true;
  }

  const sourceW = Math.max(1, img.naturalWidth || img.videoWidth || img.width || Math.ceil(w));
  const sourceH = Math.max(1, img.naturalHeight || img.videoHeight || img.height || Math.ceil(h));
  const cols = ENEMY_DEATH_BULGE_GRID;
  const rows = ENEMY_DEATH_BULGE_GRID;
  const srcCellW = sourceW / cols;
  const srcCellH = sourceH / rows;
  const dstCellW = w / cols;
  const dstCellH = h / rows;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const amount = ENEMY_DEATH_BULGE_STRENGTH * p;

  try {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;

    for (let row = 0; row < rows; row++){
      for (let col = 0; col < cols; col++){
        const nx = ((col + 0.5) / cols - 0.5) * 2;
        const ny = ((row + 0.5) / rows - 0.5) * 2;
        const r = Math.min(1, Math.hypot(nx, ny));
        const centerPush = Math.pow(1 - r, 1.45) * amount;
        const edgePush = Math.pow(r, 1.8) * amount * 0.16;
        const push = centerPush + edgePush;
        const cellScale = 1 + centerPush * 1.9 + amount * 0.08;

        const baseX = x + col * dstCellW;
        const baseY = y + row * dstCellH;
        const cellCx = baseX + dstCellW / 2;
        const cellCy = baseY + dstCellH / 2;
        const outX = cx + (cellCx - cx) * (1 + push);
        const outY = cy + (cellCy - cy) * (1 + push);
        const dw = dstCellW * cellScale + 1.25;
        const dh = dstCellH * cellScale + 1.25;

        ctx.drawImage(
          img,
          col * srcCellW, row * srcCellH, srcCellW + 0.5, srcCellH + 0.5,
          outX - dw / 2, outY - dh / 2, dw, dh
        );
      }
    }

    ctx.restore();
    return true;
  } catch (err){
    try { ctx.restore(); } catch (_) {}
    return false;
  }
}

function drawEnemyPixelMaskedHitFlash(ctx, img, x, y, w, h, flashProgress, alpha = 1, deathProgress = 0){
  if (!ctx || !img || !enemyHitFlashTintCtx) return;
  const tw = Math.max(1, Math.ceil(w));
  const th = Math.max(1, Math.ceil(h));
  const p = Math.max(0, Math.min(1, flashProgress || 0));
  if (p <= 0) return;

  try {
    if (enemyHitFlashTintCanvas.width !== tw) enemyHitFlashTintCanvas.width = tw;
    if (enemyHitFlashTintCanvas.height !== th) enemyHitFlashTintCanvas.height = th;

    enemyHitFlashTintCtx.save();
    enemyHitFlashTintCtx.clearRect(0, 0, tw, th);
    enemyHitFlashTintCtx.globalCompositeOperation = "source-over";
    enemyHitFlashTintCtx.globalAlpha = 1;
    enemyHitFlashTintCtx.drawImage(img, 0, 0, tw, th);
    enemyHitFlashTintCtx.globalCompositeOperation = "source-in";
    enemyHitFlashTintCtx.fillStyle = `rgba(255,0,0,${ENEMY_HIT_FLASH_ALPHA * p})`;
    enemyHitFlashTintCtx.fillRect(0, 0, tw, th);
    enemyHitFlashTintCtx.restore();

    if (deathProgress > 0){
      drawEnemyBulgedImage(ctx, enemyHitFlashTintCanvas, x, y, w, h, deathProgress, alpha);
      return;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(enemyHitFlashTintCanvas, x, y, w, h);
    ctx.restore();
  } catch (err){
    // If a browser refuses to mask a frame for any reason, fail closed.
    // Do not fall back to a rectangle flash, because that reintroduces the transparent-box bug.
  }
}

function enemyMarkHit(e){
  if (!e) return;
  e.hitFlash = ENEMY_HIT_FLASH_SECS;
}


function drawFloatingTexts(ctx){
  if (!window._floatTexts || window._floatTexts.length === 0) return;
  ctx.save();
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  for (let i = window._floatTexts.length - 1; i >= 0; i--){
    const f = window._floatTexts[i];
    f.t += (window._dt || 0.016);
    const a = Math.max(0, 1 - (f.t / f.ttl));
    const yy = f.y - (f.t * 28);
    ctx.globalAlpha = a;
    ctx.fillText(f.text, f.x, yy);
    if (f.t >= f.ttl) window._floatTexts.splice(i, 1);
  }
  ctx.restore();
}

function spawnFloatingText(x, y, text, ttl=0.9){
  // Lightweight popup text. Stored in particles array if available, otherwise ignored gracefully.
  if (!window._floatTexts) window._floatTexts = [];
  window._floatTexts.push({x, y, text, t:0, ttl});
}

function enemyKill(e, source){
  if (!e || e.dying) return;
  e.dying = true;
  e.fade = 1;
  e.fadeRate = 1 / ENEMY_DEATH_FADE_SECS;
  e.hitFlash = Math.max(e.hitFlash || 0, ENEMY_DEATH_FLASH_SECS);

  // Freeze where it died so the formation doesn't yoink it around while fading.
  e.lockX = e.x; e.lockY = e.y;
  e.lockW = e.w; e.lockH = e.h;
  e.swoop = null;

  // One-time kill side effects.
  if (!e._killAwarded){
    e._killAwarded = true;
    if (source === "bomb" && isDragonEnemy(e)) grantBonusArmor();

    if (e.isFrog){
      healPlayer(0.50);

      // Extra life system: every 3 frog kills, award +1 life.
      frogKills += 1;
      if (frogKills % 3 === 0){
        lives += 1;
        livesText.textContent = livesInfiniteActive ? "x∞" : ("x" + lives);
        // Optional tiny feedback burst (kept simple and non-breaking).
        if (typeof spawnFloatingText === 'function') spawnFloatingText(e.x, e.y - 18, "+1 LIFE", 0.85);
        if (typeof playSfx === 'function') playSfx(sfxHit);
      }
    }
awardScore(10);
    playSfx(sfxHit);
  }
}

function enemyApplyDamage(e, dmg, source){
  if (!e) return;
  enemyMarkHit(e);
  e.hp = (typeof e.hp === "number") ? e.hp : 1;
  e.hp -= Math.max(0, dmg|0);
  if (e.hp <= 0){
    enemyKill(e, source);
  }
}

function grantBonusArmor(){
  // Do not stack. Just refresh.
  bonusArmor = 0.25;
  bonusArmorBrokenT = 0;
}

function breakBonusArmor(){
  bonusArmor = 0;
  bonusArmorBrokenT = 1.8;
}

const UFO_KILL_SCORE_POINTS = 100;
const LIFETIME_STATS_KEY = "tektiteShooterLevel1LifetimeStats"; // deprecated global stats key; removed on load
const LIFETIME_STATS_PROFILES_KEY = "tektiteShooterLevel1LifetimeStatsByNickname";
const SAVED_IMAGES_KEY = "tektiteShooterSavedImages";
const SAVED_IMAGES_MAX = 10;

function cleanupDeprecatedShooterLocalStorage(){
  const deprecatedKeys = [
    LIFETIME_STATS_KEY,
    SAVED_IMAGES_KEY,
    "tektiteShooterBindings_v1",
    "tektite-controller-preview-owns"
  ];
  try{
    for (const key of deprecatedKeys) window.localStorage.removeItem(key);
  }catch(_){}
}
cleanupDeprecatedShooterLocalStorage();

function getSavedImageProfileName(){
  return getSavedChatNicknameValue();
}

function getSavedImageWaveNumber(value = wave){
  return Math.max(1, parseInt(value, 10) || 1);
}

function readSavedImages(){
  // Legacy no-op: do not persist screenshots in localStorage anymore.
  return [];
}

function writeSavedImages(){
  // Legacy no-op: screenshots must be saved to the user-selected folder.
  return false;
}


function captureViewportSize(){
  const viewportWidth = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || canvas.width || 640));
  const viewportHeight = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || canvas.height || 360));
  const scale = 1;
  return {
    viewportWidth,
    viewportHeight,
    targetWidth: Math.max(1, Math.round(viewportWidth * scale)),
    targetHeight: Math.max(1, Math.round(viewportHeight * scale)),
    scaleX: scale,
    scaleY: scale
  };
}

function isCaptureElementVisible(el){
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0.01) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight;
}

function drawRoundedCaptureRect(ctx, x, y, w, h, r){
  const radius = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCaptureDomImages(ctx, scaleX, scaleY){
  const imgs = Array.from(document.querySelectorAll("#animatedGifSpriteLayer img, .animated-gif-sprite"));
  for (const img of imgs){
    if (!isCaptureElementVisible(img) || !img.complete || !img.naturalWidth) continue;
    const rect = img.getBoundingClientRect();
    ctx.save();
    try{
      const style = window.getComputedStyle(img);
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(style.opacity || 1)));
      ctx.drawImage(img, rect.left * scaleX, rect.top * scaleY, rect.width * scaleX, rect.height * scaleY);
    }catch(_){
      // Cross-origin or not-yet-decoded images can refuse canvas drawing. Same-origin game assets should work.
    }finally{
      ctx.restore();
    }
  }
}

function getCaptureTextLines(el){
  const text = (el && (el.innerText || el.textContent) || "").replace(/\u00a0/g, " ").trim();
  return text ? text.split(/\n+/).map(line => line.trim()).filter(Boolean) : [];
}

function drawCaptureHudElement(ctx, el, scaleX, scaleY, opts = {}){
  if (!isCaptureElementVisible(el)) return;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const x = rect.left * scaleX;
  const y = rect.top * scaleY;
  const w = rect.width * scaleX;
  const h = rect.height * scaleY;
  const borderRadius = parseFloat(style.borderRadius || "10") * Math.min(scaleX, scaleY);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, Number(style.opacity || 1)));
  drawRoundedCaptureRect(ctx, x, y, w, h, borderRadius || 8);
  ctx.fillStyle = opts.background || style.backgroundColor || "rgba(0,0,0,0.55)";
  ctx.fill();
  const borderWidth = Math.max(1, (parseFloat(style.borderTopWidth || "2") || 2) * Math.min(scaleX, scaleY));
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = opts.border || style.borderTopColor || "rgba(255,255,255,0.82)";
  ctx.stroke();

  const lines = getCaptureTextLines(el);
  if (lines.length){
    const baseFontSize = Math.max(8, (parseFloat(style.fontSize || "16") || 16) * Math.min(scaleX, scaleY));
    const lineHeight = baseFontSize * 1.15;
    const totalHeight = lines.length * lineHeight;
    let ty = y + h / 2 - totalHeight / 2 + baseFontSize * 0.82;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = opts.color || style.color || "#fff";
    ctx.font = `${style.fontWeight || "700"} ${baseFontSize}px ${style.fontFamily || "monospace"}`;
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = Math.max(2, 5 * Math.min(scaleX, scaleY));
    for (const line of lines){
      ctx.fillText(line, x + w / 2, ty, Math.max(1, w - 10 * scaleX));
      ty += lineHeight;
    }
  }
  ctx.restore();
}

function drawCaptureHud(ctx, scaleX, scaleY){
  const hudIds = [
    "stageHud",
    "scoreStoreHud",
    "timerHud",
    "heartsHud",
    "livesSlot",
    "powerupSlot"
  ];
  for (const id of hudIds){
    const el = document.getElementById(id);
    if (!el) continue;
    const opts = {};
    if (id === "stageHud"){
      opts.background = "rgba(0,0,0,0.38)";
      opts.border = "rgba(0,255,102,0.45)";
    }
    drawCaptureHudElement(ctx, el, scaleX, scaleY, opts);
  }
}

async function saveCurrentGameImage(levelLabel="Level 2"){
  if (!canvas || !canvas.width || !canvas.height) return false;
  const nickname = getSavedImageProfileName();
  if (!nickname){
    if (typeof assetStatus !== "undefined" && assetStatus){
      assetStatus.style.display = "block";
      assetStatus.textContent = "Please set a nickname to save images.";
      window.clearTimeout(saveCurrentGameImage._statusTimer);
      saveCurrentGameImage._statusTimer = window.setTimeout(() => { if (assetStatus) assetStatus.style.display = "none"; }, 2400);
    }
    return false;
  }
  try{
    let dataUrl = "";
    if (typeof window.tektiteCreateLevelScreenshotDataUrl === "function"){
      try{
        dataUrl = await window.tektiteCreateLevelScreenshotDataUrl({
          canvas,
          type: "image/jpeg",
          quality: 0.86
        });
      }catch(snapshotError){
        console.warn("Browser-matched screenshot capture failed; falling back to canvas compositor.", snapshotError);
      }
    }

    if (!dataUrl){
      const capture = captureViewportSize();
      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = capture.targetWidth;
      captureCanvas.height = capture.targetHeight;
      const captureCtx = captureCanvas.getContext("2d");
      captureCtx.fillStyle = "#000";
      captureCtx.fillRect(0, 0, capture.targetWidth, capture.targetHeight);

      captureCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, capture.targetWidth, capture.targetHeight);
      drawCaptureDomImages(captureCtx, capture.scaleX, capture.scaleY);
      drawCaptureHud(captureCtx, capture.scaleX, capture.scaleY);

      dataUrl = captureCanvas.toDataURL("image/jpeg", 0.86);
    }

    const blob = await fetch(dataUrl).then((response) => response.blob());
    const savedResult = window.tektiteShooterSavedImageStorage
      ? await window.tektiteShooterSavedImageStorage.saveImageBlobToFolder({
          blob,
          nickname,
          wave: getSavedImageWaveNumber()
        })
      : { ok: false, message: "Folder saving is not supported in this browser." };
    if (savedResult.ok && typeof renderSavedImages === "function") renderSavedImages();
    if (typeof assetStatus !== "undefined" && assetStatus){
      assetStatus.style.display = "block";
      assetStatus.textContent = savedResult.ok ? "Image saved to chosen folder." : String(savedResult.message || "Could not save image.");
      window.clearTimeout(saveCurrentGameImage._statusTimer);
      saveCurrentGameImage._statusTimer = window.setTimeout(() => { if (assetStatus) assetStatus.style.display = "none"; }, savedResult.ok ? 1800 : 2400);
    }
    return !!savedResult.ok;
  }catch(error){
    console.error("In-game screenshot save failed:", error);
    return false;
  }
}

function getSavedImageMetadata(){
  return {
    nickname: getSavedImageProfileName(),
    wave: getSavedImageWaveNumber()
  };
}

window.tektiteGetSavedImageMetadata = getSavedImageMetadata;

function showSavedImageStatus(message, ok = true){
  if (typeof assetStatus === "undefined" || !assetStatus) return;
  assetStatus.style.display = "block";
  assetStatus.textContent = message || (ok ? "Screenshot saved to Profile > Saved Images." : "Unable to save screenshot.");
  window.clearTimeout(showSavedImageStatus._statusTimer);
  showSavedImageStatus._statusTimer = window.setTimeout(() => { if (assetStatus) assetStatus.style.display = "none"; }, ok ? 1800 : 2400);
}

function requestParentPageScreenshot(levelLabel="Level 2"){
  if (!window.parent || window.parent === window) return false;
  try{
    const metadata = getSavedImageMetadata();
    window.parent.postMessage({
      type: "tektite:request-page-screenshot",
      nickname: metadata.nickname,
      wave: metadata.wave
    }, "*");
    showSavedImageStatus("Saving screenshot...");
    return true;
  }catch(error){
    return false;
  }
}


function getDefaultLifetimeStats(){
  return {
    lifetimeScoreEarned: 0,
    lifetimeEnemiesKilled: 0,
    lifetimeUfosKilled: 0,
    lifetimeGamesWon: 0,
    lifetimeTotalDeaths: 0,
    lifetimeBulletsFired: 0,
    lifetimeBombKills: 0
  };
}

function incrementLifetimeStat(key, amount=1){
  try{
    const nickname = getSavedChatNicknameValue();
    if (!nickname) return;
    const profileId = `name:${String(nickname).trim().toLowerCase()}`;
    const parsedProfiles = JSON.parse(localStorage.getItem(LIFETIME_STATS_PROFILES_KEY) || "{}");
    const profiles = parsedProfiles && typeof parsedProfiles === "object" && !Array.isArray(parsedProfiles) ? parsedProfiles : {};
    const stats = Object.assign(getDefaultLifetimeStats(), profiles[profileId] || {});
    stats[key] = Math.max(0, Number(stats[key] || 0) + Math.max(0, Number(amount) || 0));
    profiles[profileId] = stats;
    localStorage.setItem(LIFETIME_STATS_PROFILES_KEY, JSON.stringify(profiles));
  }catch(e){}
}

function awardUfoKillScore(){
  if (scoreTrackingDisabled) return 0;
  score += UFO_KILL_SCORE_POINTS;
  if (Math.floor(score) >= STORE_UNLOCK_SCORE_THRESHOLD) scoreStoreUnlockedThisRun = true;
  incrementLifetimeStat("lifetimeScoreEarned", UFO_KILL_SCORE_POINTS);
  return UFO_KILL_SCORE_POINTS;
}

function killUFO(source){
  if (!ufo || ufo.fade > 0 || ufo._killAwarded) return false;
  ufo._killAwarded = true;
  ufo.stage = 3;
  awardUfoKillScore();
  incrementLifetimeStat("lifetimeEnemiesKilled", 1);
  incrementLifetimeStat("lifetimeUfosKilled", 1);
  if (source === "bomb"){
    if (typeof bombKills === "number") bombKills += 1;
    incrementLifetimeStat("lifetimeBombKills", 1);
  }
  ufo.fade = 0.001; // start fade-out and keep the existing bomb pickup reward
  return true;
}

/* =======================
   UFO + Bomb Powerup (v1.96)
   - 25% chance to spawn at wave start
   - UFO takes 3 hits: red -> green -> blue -> fade
   - On fade, grants 💥 item (Press Q)
   - Press Q drops a flashing + that explodes after 3 flashes (0.5s each)
======================= */

function getRandomMazeUfoSpawnWorld(){
  if (maze){
    const walkable = getMazeWalkableCells();
    if (walkable && walkable.length){
      const farEnough = walkable.filter(cell => {
        const wx = (cell.x + 0.5) * maze.cellSize;
        const wy = (cell.y + 0.5) * maze.cellSize;
        return Math.hypot(wx - playerWorldX, wy - playerWorldY) >= maze.cellSize * 2.2;
      });
      const pool = farEnough.length ? farEnough : walkable;
      const cell = pool[Math.floor(Math.random() * pool.length)];
      return {
        x: (cell.x + 0.5) * maze.cellSize + rand(-maze.cellSize * 0.18, maze.cellSize * 0.18),
        y: (cell.y + 0.5) * maze.cellSize + rand(-maze.cellSize * 0.18, maze.cellSize * 0.18)
      };
    }
  }
  return { x: playerWorldX + rand(-220, 220), y: playerWorldY + rand(-220, 220) };
}

function canUfoSeePlayer(worldX, worldY){
  if (!maze) return true;
  const dx = playerWorldX - worldX;
  const dy = playerWorldY - worldY;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.0001) return true;
  const step = Math.max(10, maze.cellSize * 0.18);
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= steps; i++){
    const t = i / steps;
    const sx = worldX + dx * t;
    const sy = worldY + dy * t;
    if (isWallAtWorld(sx, sy)) return false;
  }
  return true;
}

function trySpawnUFO(force=false){
  if (ufo) return; // only one at a time
  // v1.96: Force-spawn on wave 11 and 21 (or when explicitly forced).
  if (!force && !shouldForceUFOForWave(wave) && Math.random() > 0.25) return;

  const spawn = getRandomMazeUfoSpawnWorld();
  const startAngle = rand(0, Math.PI * 2);
  const startSpeed = rand(38, 72);

  ufo = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    worldX: spawn.x,
    worldY: spawn.y,
    vx: Math.cos(startAngle) * startSpeed,
    vy: Math.sin(startAngle) * startSpeed,
    desiredVx: Math.cos(startAngle) * startSpeed,
    desiredVy: Math.sin(startAngle) * startSpeed,
    roamAngle: rand(0, Math.PI * 2),
    roamTurnTimer: rand(0.35, 1.1),
    seenPlayerLag: 0,
    seesPlayer: false,
    r: 10 * getUfoSizeScale(),
    hits: 0,
    stage: 0, // 0 none, 1 red, 2 green, 3 blue
    _killAwarded: false,
    fade: 0,
    strobeT: 0
  };
}

function updateUFO(dt){
  if (!ufo) return;

  // If fading, just fade out and then grant powerup.
  if (ufo.fade > 0){
    ufo.fade += dt;
    const camX = playerWorldX - canvas.width / 2;
    const camY = playerWorldY - canvas.height / 2;
    ufo.x = ufo.worldX - camX;
    ufo.y = ufo.worldY - camY;
    if (ufo.fade >= 0.55){
      ufo = null;
      bombsCount += 1;
      powerupSlot.style.display = "flex";
    }
    return;
  }

  if (!maze){
    ufo.x += ufo.vx * dt;
    ufo.y += ufo.vy * dt;
    ufo.strobeT += dt;
    return;
  }

  const radius = Math.max(10, ufo.r + 4);
  const seesPlayer = canUfoSeePlayer(ufo.worldX, ufo.worldY);
  ufo.seesPlayer = seesPlayer;

  ufo.roamTurnTimer -= dt;
  if (ufo.roamTurnTimer <= 0){
    ufo.roamTurnTimer = rand(0.45, 1.35);
    ufo.roamAngle += rand(-1.25, 1.25);
  }

  const roamSpeed = 54;
  let targetVx = Math.cos(ufo.roamAngle) * roamSpeed;
  let targetVy = Math.sin(ufo.roamAngle) * roamSpeed;

  if (seesPlayer){
    ufo.seenPlayerLag = Math.min(0.22, ufo.seenPlayerLag + dt);
  } else {
    ufo.seenPlayerLag = Math.max(0, ufo.seenPlayerLag - dt * 1.6);
  }

  if (ufo.seenPlayerLag >= 0.14){
    const awayX = ufo.worldX - playerWorldX;
    const awayY = ufo.worldY - playerWorldY;
    const awayD = Math.hypot(awayX, awayY) || 0.0001;
    const fleeSpeed = 78;
    targetVx = (awayX / awayD) * fleeSpeed;
    targetVy = (awayY / awayD) * fleeSpeed;
  }

  ufo.desiredVx += (targetVx - ufo.desiredVx) * Math.min(1, dt * 2.2);
  ufo.desiredVy += (targetVy - ufo.desiredVy) * Math.min(1, dt * 2.2);
  ufo.vx += (ufo.desiredVx - ufo.vx) * Math.min(1, dt * 4.6);
  ufo.vy += (ufo.desiredVy - ufo.vy) * Math.min(1, dt * 4.6);

  const maxSpeed = seesPlayer ? 88 : 72;
  const speed = Math.hypot(ufo.vx, ufo.vy) || 0.0001;
  if (speed > maxSpeed){
    ufo.vx = (ufo.vx / speed) * maxSpeed;
    ufo.vy = (ufo.vy / speed) * maxSpeed;
  }

  let bouncedX = false;
  let bouncedY = false;
  const nextX = ufo.worldX + ufo.vx * dt;
  const nextY = ufo.worldY + ufo.vy * dt;

  if (canOccupyWorld(nextX, ufo.worldY, radius)){
    ufo.worldX = nextX;
  } else {
    bouncedX = true;
    ufo.vx *= -0.72;
    ufo.desiredVx *= -0.58;
    ufo.roamAngle = Math.atan2(ufo.desiredVy || ufo.vy || 0, ufo.desiredVx || ufo.vx || 1) + rand(-0.75, 0.75);
  }

  if (canOccupyWorld(ufo.worldX, nextY, radius)){
    ufo.worldY = nextY;
  } else {
    bouncedY = true;
    ufo.vy *= -0.72;
    ufo.desiredVy *= -0.58;
    ufo.roamAngle = Math.atan2(ufo.desiredVy || ufo.vy || 1, ufo.desiredVx || ufo.vx || 0) + rand(-0.75, 0.75);
  }

  if (bouncedX || bouncedY){
    ufo.worldX += ufo.vx * dt * 0.35;
    ufo.worldY += ufo.vy * dt * 0.35;
  }

  const camX = playerWorldX - canvas.width / 2;
  const camY = playerWorldY - canvas.height / 2;
  ufo.x = ufo.worldX - camX;
  ufo.y = ufo.worldY - camY;
  ufo.strobeT += dt;
}

function drawUFO(){
  if (!ufo) return;

  const strobe = Math.floor(time * 22) % 2 === 0;
  const baseFill = strobe ? "#fff" : "#000";
  const col = ufoColorForStage(ufo.stage);
  const fadeProgress = (ufo.fade > 0) ? Math.max(0, Math.min(1, ufo.fade / 0.55)) : 0;
  const alpha = (ufo.fade > 0) ? Math.max(0, 1 - fadeProgress) : 1;

  // Base UFO is now 33% bigger. During death fade, it visually blooms outward
  // like enemy death sprites while keeping the stored ufo.r collision radius stable.
  const baseScale = getUfoSizeScale();
  const deathScale = 1 + fadeProgress * ENEMY_DEATH_GROW_SCALE;
  const bulge = fadeProgress * ENEMY_DEATH_BULGE_STRENGTH;
  const coreRx = 14 * baseScale * deathScale * (1 + bulge * 0.62);
  const coreRy = 7 * baseScale * deathScale * (1 + bulge * 1.35);
  const ringRx = 16 * baseScale * deathScale * (1 + bulge * 0.42);
  const ringRy = 9 * baseScale * deathScale * (1 + bulge * 1.08);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(ufo.x, ufo.y);

  // core strobe oval
  ctx.fillStyle = baseFill;
  ctx.beginPath();
  ctx.ellipse(0, 0, coreRx, coreRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // colored "shield" ring for hit streak feedback
  if (col){
    ctx.strokeStyle = col;
    ctx.lineWidth = 3 * baseScale * Math.max(1, deathScale * 0.72);
    ctx.beginPath();
    ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // UFO death fade now gets the same red/bulging visual language as enemies.
  // This is vector-masked to the saucer ellipses, so it does not create a lazy red rectangle.
  if (fadeProgress > 0){
    const redAlpha = Math.max(0, Math.min(1, UFO_DEATH_RED_ALPHA * (1 - fadeProgress * 0.18)));
    ctx.save();
    ctx.globalAlpha = alpha * redAlpha;
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.ellipse(0, 0, coreRx * (1 + bulge * 0.28), coreRy * (1 + bulge * 0.62), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = Math.max(2, 4 * baseScale * deathScale);
    ctx.beginPath();
    ctx.ellipse(0, 0, ringRx * (1 + bulge * 0.18), ringRy * (1 + bulge * 0.42), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function dropBomb(){
  if (isPaused) return;
  if (!infiniteModeActive && !bombsInfiniteActive && bombsCount <= 0) return;
  if (bomb) return; // only one active

  if (!infiniteModeActive && !bombsInfiniteActive) bombsCount = Math.max(0, bombsCount - 1);
  _syncBombHud();

  // Bomb glides in the current aim direction, keeps moving, and ricochets off screen edges
  // until it collides with an enemy.
  const dx = Math.cos(aimAngleSmoothed);
  const dy = Math.sin(aimAngleSmoothed);

  const spawnDist = player.w * 0.55;
  const speed = 900; // px/sec

  bomb = {
    x: player.x + dx * spawnDist,
    y: player.y + dy * spawnDist,
    vx: dx * speed,
    vy: dy * speed,
    r: 12,

    mode: "flying",
    flashT: 0,
    flashOn: true,

    exploding: false,
    rad: 0,
    alpha: 0.0
  };
}

function explodeBomb(){
  if (!bomb) return;
  bomb.exploding = true;
  bomb.mode = "exploding";
  bomb.rad = 0;
  bomb.alpha = 0.55;
}

function bombHitsEnemy(){
  if (!bomb || bomb.exploding) return false;
  if (ufo && ufo.fade === 0){
    const dxU = bomb.x - ufo.x;
    const dyU = bomb.y - ufo.y;
    const rrU = bomb.r + ufo.r;
    if (dxU*dxU + dyU*dyU <= rrU*rrU){
      killUFO("bomb");
      explodeBomb();
      playSfx(sfxHit);
      return true;
    }
  }
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    if (e.dying) continue;
    const rx = e.x - e.w/2, ry = e.y - e.h/2;

    if (circleRect(bomb.x, bomb.y, bomb.r, rx, ry, e.w, e.h)){
      explodeBomb();
      return true;
    }
  }
  return false;
}

function updateBomb(dt){
  if (!bomb) return;

  bomb.flashT += dt;
  if (bomb.flashT >= 0.12){
    bomb.flashT -= 0.12;
    bomb.flashOn = !bomb.flashOn;
  }

  if (!bomb.exploding){
    const stepX = bomb.vx * dt;
    const stepY = bomb.vy * dt;

    bomb.x += stepX;
    bomb.y += stepY;

    const minX = bomb.r;
    const maxX = canvas.width - bomb.r;
    const minY = bomb.r;
    const maxY = canvas.height - bomb.r;

    if (bomb.x < minX){
      bomb.x = minX + (minX - bomb.x);
      bomb.vx = Math.abs(bomb.vx);
    } else if (bomb.x > maxX){
      bomb.x = maxX - (bomb.x - maxX);
      bomb.vx = -Math.abs(bomb.vx);
    }

    if (bomb.y < minY){
      bomb.y = minY + (minY - bomb.y);
      bomb.vy = Math.abs(bomb.vy);
    } else if (bomb.y > maxY){
      bomb.y = maxY - (bomb.y - maxY);
      bomb.vy = -Math.abs(bomb.vy);
    }

    if (bombHitsEnemy()) return;
  } else {
    bomb.rad += (560 + 220 * FUNK) * dt;
    bomb.alpha = Math.max(0, bomb.alpha - dt * 0.60);

    if (!bomb.didDamage){
      bomb.didDamage = true;

      const enemySize = enemies.length ? enemies.reduce((s,e)=>s+e.size,0)/enemies.length : 44;
      const radius = enemySize * 1.7;

      const BOMB_DAMAGE = 2;

      if (ufo && ufo.fade === 0){
        const dxU = ufo.x - bomb.x;
        const dyU = ufo.y - bomb.y;
        if (dxU*dxU + dyU*dyU <= radius*radius && killUFO("bomb")){
          playSfx(sfxHit);
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--){
        const e = enemies[i];
        if (e.dying) continue;
        const dx = e.x - bomb.x;
        const dy = e.y - bomb.y;
        const d2 = dx*dx + dy*dy;

        if (d2 <= radius*radius){
          enemyApplyDamage(e, BOMB_DAMAGE, "bomb");
        } else {
          const r2 = (radius * 2.2);
          if (d2 <= r2*r2){
            const d = Math.max(1, Math.sqrt(d2));
            const push = (radius * 0.55) / d;
e.col += (dx / d) * push * 0.02;
            e.row += (dy / d) * push * 0.02;
          }
        }
      }
    }

    if (bomb.alpha <= 0){
      bomb = null;
    }
  }
}

function drawBomb(){
  if (!bomb) return;

  if (!bomb.exploding){
    // v1.96: flying/armed bomb (flashing plus)
    ctx.save();
    ctx.translate(bomb.x, bomb.y);

    // Slightly different color when armed vs flying so you can read it at a glance.
    const isArmed = (bomb.mode === "armed");
    const onCol  = isArmed ? "rgba(255,80,80,0.95)" : "rgba(255,255,0,0.95)";
    const offCol = isArmed ? "rgba(255,255,255,0.70)" : "rgba(255,60,60,0.95)";

    ctx.fillStyle = bomb.flashOn ? onCol : offCol;
    ctx.fillRect(-4, -16, 8, 32);
    ctx.fillRect(-16, -4, 32, 8);

    // tiny outline circle so it reads even when the plus is edge-on
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, bomb.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  } else {
    // explosion circle
    ctx.save();
    ctx.globalAlpha = bomb.alpha;
    ctx.fillStyle = "rgba(255,0,0,0.20)";
    ctx.beginPath();
    ctx.arc(bomb.x, bomb.y, bomb.rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* =======================
   Parallax Starfield (safe init order)
======================= */
const starLayers = [
  { count: 180, baseSpeedY: 40,  parallaxX: 0.35, sizeMin: 1, sizeMax: 2 },
  { count: 120, baseSpeedY: 80,  parallaxX: 0.60, sizeMin: 1, sizeMax: 3 },
  { count: 70,  baseSpeedY: 140, parallaxX: 0.90, sizeMin: 2, sizeMax: 4 }
];

let stars = [];
let playerVxSmoothed = 0;
let starfieldReady = false;

function resetStarfield(){
  stars = starLayers.map(layer => {
    const arr = [];
    for (let i = 0; i < layer.count; i++){
      arr.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        s: rand(layer.sizeMin, layer.sizeMax),
        vyMul: rand(0.7, 1.3)
      });
    }
    return arr;
  });
  starfieldReady = true;
}

function updateStarfield(dt, keys, playerSpeed){
  if (!starfieldReady) return;

  let vxIntent = 0;
  if (gameState === STATE.PLAYING){
    if (isKeyboardActionHeld("moveLeft")) vxIntent -= 1;
    if (isKeyboardActionHeld("moveRight")) vxIntent += 1;
    // Xbox/Gamepad: use left-stick/D-pad horizontal intent too
    vxIntent += (typeof gpMoveX !== "undefined" ? (gpMoveX || 0) : 0);
    vxIntent = Math.max(-1, Math.min(1, vxIntent));
  } else {
    vxIntent = 0.15 * Math.sin(time * 0.6);
  }

  const targetVx = 0; // maze mode: starfield no longer reacts to player movement
  playerVxSmoothed += (targetVx - playerVxSmoothed) * Math.min(1, dt * 8);

  for (let li = 0; li < starLayers.length; li++){
    const layer = starLayers[li];
    const arr = stars[li];

    const driftX = -playerVxSmoothed * layer.parallaxX;
    const driftY = layer.baseSpeedY;

    for (const st of arr){
      st.x += driftX * dt;
      st.y += driftY * st.vyMul * dt;

      if (st.y > canvas.height + 10) st.y = -10;
      if (st.x < -10) st.x = canvas.width + 10;
      if (st.x > canvas.width + 10) st.x = -10;
    }
  }
}

function drawGlitchBackgroundOverlay(){
  if (!(glitchBackgroundPulse > 0)) return;
  const pulse = Math.min(1, glitchBackgroundPulse);
  const jitter = Math.floor(time * 36);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.14 * pulse;
  ctx.fillStyle = "#00f5ff";
  ctx.fillRect((jitter % 3) - 2, 0, canvas.width, canvas.height);
  for (let i = 0; i < 6; i++){
    const y = (canvas.height * (((i * 0.19) + (time * (0.27 + i * 0.013))) % 1)) | 0;
    const h = 2 + ((jitter + i) % 5);
    ctx.globalAlpha = (0.18 + (i % 2) * 0.10) * pulse;
    ctx.fillStyle = i % 2 ? "#ff2bd6" : "#00fff0";
    ctx.fillRect(0, y, canvas.width, h);
  }
  ctx.globalAlpha = 0.08 * pulse;
  ctx.fillStyle = "#ffffff";
  for (let x = (jitter % 53) - 53; x < canvas.width; x += 53){
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  ctx.restore();
}

function drawStarfield(){
  // v2.01: Maze mode uses a plain black void instead of the old starfield.
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  drawGlitchBackgroundOverlay();

  if (gameState === STATE.PLAYING) return;
  if (!starfieldReady) return;

  for (let li = 0; li < starLayers.length; li++){
    const arr = stars[li];
    const alpha = li === 0 ? 0.20 : (li === 1 ? 0.32 : 0.48);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (const st of arr){
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
  }
}

/* =======================
   Resize
======================= */
const MOBILE_GAMEPLAY_MIN_HEIGHT = 540;
const MOBILE_GAMEPLAY_MIN_TIME_SCALE = 0.72;

function getMobileGameplayTimeScale(){
  if (!isMobilePhoneViewport()) return 1;
  const viewportHeight = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || canvas.height || 360));
  const relativeScale = Math.min(1, viewportHeight / MOBILE_GAMEPLAY_MIN_HEIGHT);
  return Math.max(MOBILE_GAMEPLAY_MIN_TIME_SCALE, relativeScale);
}

function resize(){
  const viewportWidth = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || canvas.width || 640));
  const viewportHeight = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || canvas.height || 360));
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;

  // v1.96+: only bottom-anchor in menus; gameplay keeps spawn position
  if (gameState !== STATE.PLAYING){
    player.y = getPlayerAlignedY();
  }

  resetStarfield();
  resizeFX();
  fitOptionsMenuToViewport();
  fitControlsMenuToViewport();
}
window.addEventListener("resize", resize);

function fitOptionsMenuToViewport(){
  if (!optionsMenu) return;
  optionsMenu.style.transform = "scale(1)";
  optionsMenu.style.margin = "0";
  optionsMenu.style.transformOrigin = "center center";
  if (optionsMenu.style.display === "none" || optionsMenu.offsetParent === null) return;
  const margin = 12;
  const availableW = Math.max(320, window.innerWidth - margin * 2);
  const availableH = Math.max(240, window.innerHeight - margin * 2);
  const rect = optionsMenu.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = Math.min(1, availableW / rect.width, availableH / rect.height);
  optionsMenu.style.transform = `scale(${scale})`;
  if (scale < 1) {
    const scaledHeight = rect.height * scale;
    const slack = Math.max(0, availableH - scaledHeight);
    optionsMenu.style.margin = `${Math.floor(slack / 2)}px 0`;
  }
}

function fitControlsMenuToViewport(){
  if (!controlsMenu) return;
  controlsMenu.style.transform = "scale(1)";
  controlsMenu.style.margin = "0";
  controlsMenu.style.transformOrigin = "center center";
  if (controlsMenu.style.display === "none" || controlsMenu.offsetParent === null) return;
  const prevMaxHeight = controlsMenu.style.maxHeight;
  const prevOverflow = controlsMenu.style.overflow;
  controlsMenu.style.maxHeight = "none";
  controlsMenu.style.overflow = "visible";
  const margin = 12;
  const availableW = Math.max(320, window.innerWidth - margin * 2);
  const availableH = Math.max(240, window.innerHeight - margin * 2);
  const rect = controlsMenu.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    controlsMenu.style.maxHeight = prevMaxHeight;
    controlsMenu.style.overflow = prevOverflow;
    return;
  }
  const scale = Math.min(1, availableW / rect.width, availableH / rect.height);
  controlsMenu.style.transform = `scale(${scale})`;
  if (scale < 1) {
    const scaledHeight = rect.height * scale;
    const slack = Math.max(0, availableH - scaledHeight);
    controlsMenu.style.margin = `${Math.floor(slack / 2)}px 0`;
  }
  controlsMenu.style.maxHeight = prevMaxHeight;
  controlsMenu.style.overflow = prevOverflow;
}

/* =======================
   HUD/Player Alignment
   - Keep the bottom of the player aligned to the top of the hearts HUD (DOM element),
     regardless of fullscreen, browser chrome, or embedding under a site banner.
======================= */
function getPlayerAlignedY(gapPx = 6){
  if (gameState === STATE.PLAYING) return canvas.height / 2;
  const heartsTop = getHeartsTopInCanvas();
  let y = heartsTop - (player.h / 2) - gapPx;
  y = Math.max(player.h/2, Math.min(canvas.height - player.h/2, y));
  return y;
}

/* =======================
   Audio
======================= */
sfxHit = new Audio(AUDIO_HIT);
sfxOof = new Audio(AUDIO_OOF);
sfxUiHover = new Audio(AUDIO_UI_HOVER);
sfxUiSelect = new Audio(AUDIO_UI_SELECT);
sfxHit.preload = "auto";
sfxOof.preload = "auto";
sfxUiHover.preload = "auto";
sfxUiSelect.preload = "auto";
sfxHit.volume = 0.7;
sfxOof.volume = 0.8;
sfxUiHover.volume = 0.15;
sfxUiSelect.volume = 0.33;

let audioUnlocked = false;
function unlockAudioOnce(){
  if (audioUnlocked) return;
  audioUnlocked = true;
  initAudioAnalyser();
  try{ if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }catch(e){}
  try{
    sfxHit.muted = true;
    sfxHit.play().then(() => { sfxHit.pause(); sfxHit.currentTime = 0; sfxHit.muted = false; }).catch(()=>{ sfxHit.muted = false; });

    sfxOof.muted = true;
    sfxOof.play().then(() => { sfxOof.pause(); sfxOof.currentTime = 0; sfxOof.muted = false; }).catch(()=>{ sfxOof.muted = false; });

    sfxUiHover.muted = true;
    sfxUiHover.play().then(() => { sfxUiHover.pause(); sfxUiHover.currentTime = 0; sfxUiHover.muted = false; }).catch(()=>{ sfxUiHover.muted = false; });

    sfxUiSelect.muted = true;
    sfxUiSelect.play().then(() => { sfxUiSelect.pause(); sfxUiSelect.currentTime = 0; sfxUiSelect.muted = false; }).catch(()=>{ sfxUiSelect.muted = false; });
  }catch(e){}

  // Prime music/death audio once the browser allows it.
  try{
    // Prime the death yell audio once the browser allows it.
    sfxDeath.muted = true;
    sfxDeath.play().then(()=>{ sfxDeath.pause(); sfxDeath.currentTime = 0; sfxDeath.muted = false; }).catch(()=>{ sfxDeath.muted = false; });
  }catch(e){}

  applyMuteState();
  if (gameState === STATE.PLAYING) ensureMusicPlaying();
}
function playSfx(a){
  if (audioMuted) return;
  try{
    const c = a.cloneNode();
    c.volume = a.volume;
    c.muted = !!audioMuted;
    c.play().catch(()=>{});
  }catch(e){}
}
function playSfxImmediate(a){
  if (audioMuted || !a) return;
  try{
    a.currentTime = 0;
    a.muted = !!audioMuted;
    a.play().catch(()=>{});
  }catch(e){}
}

const UI_ACTIVATE_SOUND_SELECTOR = 'button, [role="button"], .smallBtn, .deathBtn, .winControllerTarget, .scoreStoreAction, .statsSelectableRow, .controlsBindButton, input[type="checkbox"], select';
const UI_SELECT_SOUND_SELECTOR = UI_ACTIVATE_SOUND_SELECTOR;
let lastUiActivateSoundAt = 0;
let lastUiSelectSoundAt = 0;
let lastControllerSelectSoundTarget = null;

function isUiActivateSoundTarget(el){
  if (!el || !el.matches || !el.matches(UI_ACTIVATE_SOUND_SELECTOR)) return false;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
  if (el.type && ['hidden', 'range', 'text', 'number', 'color'].includes(String(el.type).toLowerCase())) return false;
  return true;
}

function playUiActivateSoundFor(el, source='mouse'){
  if (!isUiActivateSoundTarget(el)) return;
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (now - lastUiActivateSoundAt < 70) return;
  lastUiActivateSoundAt = now;
  playSfx(sfxUiHover);
}

function isUiSelectSoundTarget(el){
  if (!el || !el.matches || !el.matches(UI_SELECT_SOUND_SELECTOR)) return false;
  return isUiActivateSoundTarget(el);
}

function playUiSelectSoundFor(el, source='mouse'){
  if (!isUiSelectSoundTarget(el)) return;
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (now - lastUiSelectSoundAt < 45) return;
  lastUiSelectSoundAt = now;
  playSfx(sfxUiSelect);
}

function bindUiSelectionSounds(){
  document.addEventListener('mouseover', (event) => {
    const target = event.target && event.target.closest ? event.target.closest(UI_SELECT_SOUND_SELECTOR) : null;
    if (!target || !isUiSelectSoundTarget(target)) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    playUiSelectSoundFor(target, 'mouse');
  }, true);
}

function bindUiActivationSounds(){
  document.addEventListener('click', (event) => {
    // Mouse/touch clicks get their sound here. Controller-triggered .click() calls
    // are detail=0 and play from activateControllerTarget instead, avoiding doubles.
    if (event && event.detail === 0) return;
    const target = event.target && event.target.closest ? event.target.closest(UI_ACTIVATE_SOUND_SELECTOR) : null;
    if (!target || !isUiActivateSoundTarget(target)) return;
    playUiActivateSoundFor(target, 'mouse');
  }, true);
}

bindUiSelectionSounds();
bindUiActivationSounds();

/* =======================
   UI
======================= */
const uiRoot = document.getElementById("uiRoot");
const startMenu = document.getElementById("startMenu");
const optionsMenu = document.getElementById("optionsMenu");
const assetStatus = document.getElementById("assetStatus");

const btnStart = document.getElementById("btnStart");
const btnOptions = document.getElementById("btnOptions");
const btnControls = document.getElementById("btnControls");
const controlsMenu = document.getElementById("controlsMenu");
const controlsMenuTitle = document.getElementById("controlsMenuTitle");
const controlsBindList = document.getElementById("controlsBindList");
const controlsResetBinds = document.getElementById("controlsResetBinds");
const controlsApplyBinds = document.getElementById("controlsApplyBinds");
const controlsBack = document.getElementById("controlsBack");
const btnBack = document.getElementById("btnBack");
const btnApply = document.getElementById("btnApply");
const MOBILE_LEFT_STICK_SRC = "/dead/games/shooter-game/assets/controller-buttons/left-stick.webp";
const MOBILE_RIGHT_STICK_SRC = "/dead/games/shooter-game/assets/controller-buttons/right-stick.webp";
const MOBILE_STICK_INPUT_RADIUS = 46;
const MOBILE_STICK_VISUAL_TRAVEL = 18;
const MOBILE_STICK_MOVE_DEADZONE = 0.18;
const MOBILE_STICK_AIM_DEADZONE = 0.12;
let mobileStickOverlay = null;
let mobileMoveZone = null;
let mobileAimZone = null;
let mobileMoveStickImg = null;
let mobileAimStickImg = null;
let mobileMovePointerId = null;
let mobileAimPointerId = null;
let mobileMoveX = 0;
let mobileMoveY = 0;
let mobileAimStickX = 0;
let mobileAimStickY = 0;
let mobileAimStickActive = false;

function isCoarsePointerDevice(){
  try{
    return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || (navigator.maxTouchPoints || 0) > 0;
  }catch(_){
    return (navigator.maxTouchPoints || 0) > 0;
  }
}

function isMobilePhoneViewport(){
  const width = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
  const height = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
  return isCoarsePointerDevice() && (width <= 600 || height <= 600);
}

function shouldShowMobileStickControls(){
  return isMobilePhoneViewport() && gameState === STATE.PLAYING && !isPaused && !playerSpectatorMode;
}

function setMobileStickVisual(imgEl, xPx=0, yPx=0, active=false){
  if (!imgEl) return;
  const scale = active ? 1.04 : 1;
  const opacity = active ? 1 : 0.88;
  imgEl.style.transform = `translate(calc(-50% + ${Math.round(xPx)}px), calc(-50% + ${Math.round(yPx)}px)) scale(${scale})`;
  imgEl.style.opacity = String(opacity);
}

function resetMobileMoveStick(){
  mobileMovePointerId = null;
  mobileMoveX = 0;
  mobileMoveY = 0;
  if (mobileMoveZone) mobileMoveZone.classList.remove("isActive");
  setMobileStickVisual(mobileMoveStickImg, 0, 0, false);
}

function resetMobileAimStick(){
  mobileAimPointerId = null;
  mobileAimStickX = 0;
  mobileAimStickY = 0;
  mobileAimStickActive = false;
  if (mobileAimZone) mobileAimZone.classList.remove("isActive");
  setMobileStickVisual(mobileAimStickImg, 0, 0, false);
}

function resetMobileStickControls(){
  resetMobileMoveStick();
  resetMobileAimStick();
}

function getMobileStickState(zoneEl, clientX, clientY){
  const rect = zoneEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let dx = clientX - centerX;
  let dy = clientY - centerY;
  const dist = Math.hypot(dx, dy);
  if (dist > MOBILE_STICK_INPUT_RADIUS && dist > 0){
    const clamp = MOBILE_STICK_INPUT_RADIUS / dist;
    dx *= clamp;
    dy *= clamp;
  }
  const nx = dx / MOBILE_STICK_INPUT_RADIUS;
  const ny = dy / MOBILE_STICK_INPUT_RADIUS;
  const mag = Math.min(1, Math.hypot(nx, ny));
  const visualScale = MOBILE_STICK_VISUAL_TRAVEL / MOBILE_STICK_INPUT_RADIUS;
  return {
    x: nx,
    y: ny,
    mag,
    visualX: dx * visualScale,
    visualY: dy * visualScale
  };
}

function updateMobileMoveStickFromPointer(event){
  if (!mobileMoveZone || mobileMovePointerId !== event.pointerId) return false;
  const state = getMobileStickState(mobileMoveZone, event.clientX, event.clientY);
  const active = state.mag > MOBILE_STICK_MOVE_DEADZONE;
  mobileMoveX = active ? state.x : 0;
  mobileMoveY = active ? state.y : 0;
  mobileMoveZone.classList.toggle("isActive", active);
  setMobileStickVisual(mobileMoveStickImg, active ? state.visualX : 0, active ? state.visualY : 0, active);
  return true;
}

function updateMobileAimStickFromPointer(event){
  if (!mobileAimZone || mobileAimPointerId !== event.pointerId) return false;
  const state = getMobileStickState(mobileAimZone, event.clientX, event.clientY);
  const active = state.mag > MOBILE_STICK_AIM_DEADZONE;
  mobileAimStickX = active ? state.x : 0;
  mobileAimStickY = active ? state.y : 0;
  mobileAimStickActive = active;
  mobileAimZone.classList.toggle("isActive", active);
  setMobileStickVisual(mobileAimStickImg, active ? state.visualX : 0, active ? state.visualY : 0, active);
  return active;
}

function bindMobileStickZone(zoneEl, side){
  if (!zoneEl) return;
  zoneEl.addEventListener("pointerdown", (event) => {
    if (!isTouchPointerEvent(event) || !shouldShowMobileStickControls()) return;
    if (side === "move" && mobileMovePointerId !== null && mobileMovePointerId !== event.pointerId) return;
    if (side === "aim" && mobileAimPointerId !== null && mobileAimPointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    unlockAudioOnce();
    setActiveInputMode(INPUT_MODE_KEYBOARD);
    try{ zoneEl.setPointerCapture(event.pointerId); }catch(_){}
    if (side === "move"){
      mobileMovePointerId = event.pointerId;
      updateMobileMoveStickFromPointer(event);
    } else {
      mobileAimPointerId = event.pointerId;
      if (updateMobileAimStickFromPointer(event) && gameState === STATE.PLAYING && !isPaused && !playerSpectatorMode){
        shoot();
      }
    }
  }, { passive:false });

  zoneEl.addEventListener("pointermove", (event) => {
    if (!isTouchPointerEvent(event)) return;
    const handled = side === "move"
      ? updateMobileMoveStickFromPointer(event)
      : updateMobileAimStickFromPointer(event);
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
  }, { passive:false });

  function releasePointer(event){
    if (!isTouchPointerEvent(event)) return;
    if (side === "move"){
      if (mobileMovePointerId !== event.pointerId) return;
      resetMobileMoveStick();
    } else {
      if (mobileAimPointerId !== event.pointerId) return;
      resetMobileAimStick();
    }
    event.preventDefault();
    event.stopPropagation();
  }

  zoneEl.addEventListener("pointerup", releasePointer, { passive:false });
  zoneEl.addEventListener("pointercancel", releasePointer, { passive:false });
  zoneEl.addEventListener("lostpointercapture", releasePointer, { passive:false });
}

function ensureMobileStickOverlay(){
  if (mobileStickOverlay || !document.body) return;
  const overlay = document.createElement("div");
  overlay.id = "mobileTwinStickOverlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="mobileStickZone mobileStickZoneLeft" data-stick-side="move" aria-hidden="true">
      <img class="mobileStickImage" src="${MOBILE_LEFT_STICK_SRC}" alt="" draggable="false" />
    </div>
    <div class="mobileStickZone mobileStickZoneRight" data-stick-side="aim" aria-hidden="true">
      <img class="mobileStickImage" src="${MOBILE_RIGHT_STICK_SRC}" alt="" draggable="false" />
    </div>
  `;
  document.body.appendChild(overlay);
  mobileStickOverlay = overlay;
  mobileMoveZone = overlay.querySelector('[data-stick-side="move"]');
  mobileAimZone = overlay.querySelector('[data-stick-side="aim"]');
  mobileMoveStickImg = mobileMoveZone ? mobileMoveZone.querySelector(".mobileStickImage") : null;
  mobileAimStickImg = mobileAimZone ? mobileAimZone.querySelector(".mobileStickImage") : null;
  bindMobileStickZone(mobileMoveZone, "move");
  bindMobileStickZone(mobileAimZone, "aim");
  resetMobileStickControls();
}

function syncMobileStickOverlayState(){
  ensureMobileStickOverlay();
  const mobileView = isMobilePhoneViewport();
  const active = shouldShowMobileStickControls();
  document.body.classList.toggle("mobileTouchControls", mobileView);
  document.body.classList.toggle("mobileTouchControlsActive", active);
  if (mobileStickOverlay) mobileStickOverlay.setAttribute("aria-hidden", mobileView ? "false" : "true");
  if (!active) resetMobileStickControls();
}

window.addEventListener("resize", syncMobileStickOverlayState);
window.addEventListener("orientationchange", syncMobileStickOverlayState);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetMobileStickControls();
  else syncMobileStickOverlayState();
});
ensureMobileStickOverlay();

  // =======================
  // Level 2 navigation menu
  // =======================
  const livesSlider = document.getElementById("livesSlider");
  const heartsSlider = document.getElementById("heartsSlider");
  const shieldsSlider = document.getElementById("shieldsSlider");
  const bombsSlider = document.getElementById("bombsSlider");
  const speedSlider = document.getElementById("speedSlider");
  const infiniteToggle = document.getElementById("infiniteToggle");
  const startWaveSelect = document.getElementById("startWaveSelect");
const btnReturnToLevel1 = document.getElementById("btnReturnToLevel1");
const btnSkipToLevel3 = document.getElementById("btnSkipToLevel3");
  const startWaveLabel = document.getElementById("startWaveLabel");

  const livesVal = document.getElementById("livesVal");
  const heartsVal = document.getElementById("heartsVal");
  const shieldsVal = document.getElementById("shieldsVal");
  const bombsVal = document.getElementById("bombsVal");

  const speedVal = document.getElementById("speedVal");
  const DEFAULT_START_LIVES = 3;
  const DEFAULT_START_HEARTS = 5;
  const DEFAULT_START_SHIELDS = 0;
  const DEFAULT_START_BOMBS = 0;
  const DEFAULT_START_GAME_SPEED = 5;
  const DEFAULT_START_WAVE = 1;
  let START_LIVES = DEFAULT_START_LIVES;
  let START_HEARTS = DEFAULT_START_HEARTS;
  let START_SHIELDS = DEFAULT_START_SHIELDS;
  let START_BOMBS = DEFAULT_START_BOMBS;
  // v1.97: 100 in a resource box means INFINITE for that resource only.
  let START_LIVES_INFINITE = false;
  let START_HEARTS_INFINITE = false;
  let START_SHIELDS_INFINITE = false;
  let START_BOMBS_INFINITE = false;
  let START_GAME_SPEED = DEFAULT_START_GAME_SPEED;
  let GAME_SPEED_MULT = 1.0;
  GAME_SPEED_MULT = Math.max(0.1, Math.min(3.0, START_GAME_SPEED / 5));
  let INFINITE_MODE = false;
  
let START_WAVE = DEFAULT_START_WAVE;

let INVERT_COLORS = false;
const invertColorsCheckbox = document.getElementById("invertColorsCheckbox");

function applyInvertColors(){
  document.body.classList.toggle("invert-colors", INVERT_COLORS);
}

if (invertColorsCheckbox){
  invertColorsCheckbox.addEventListener("change", () => {
    INVERT_COLORS = invertColorsCheckbox.checked;
    applyInvertColors();
  });
}


  function getStartWaveText(v){
    const n = parseInt(v, 10) || 1;
    if (n === 11) return "Bonus Mode";
    if (n >= 12 && n <= 21) return "Insanity " + (n - 11);
    return "Wave " + n;
  }

function syncStartOptionsLabels(){
    if (livesVal && livesSlider) livesVal.textContent = formatResourceOptionValue(livesSlider);
    if (heartsVal && heartsSlider) heartsVal.textContent = formatResourceOptionValue(heartsSlider);
    if (shieldsVal && shieldsSlider) shieldsVal.textContent = formatResourceOptionValue(shieldsSlider);
    if (bombsVal && bombsSlider) bombsVal.textContent = formatResourceOptionValue(bombsSlider);
    if (speedVal && speedSlider) speedVal.textContent = speedSlider.value;
    if (startWaveLabel && startWaveSelect) startWaveLabel.textContent = getStartWaveText(startWaveSelect.value);
    if (typeof renderMenuHudPreview === "function" && gameState !== STATE.PLAYING) renderMenuHudPreview();
  }

  [livesSlider, heartsSlider, shieldsSlider, bombsSlider, speedSlider].filter(Boolean).forEach(s => {
    s.addEventListener("input", syncStartOptionsLabels);
  });
  if (startWaveSelect) startWaveSelect.addEventListener("change", syncStartOptionsLabels);
  if (infiniteToggle) infiniteToggle.addEventListener("change", () => applyGlobalInfiniteMode(!!infiniteToggle.checked));
  syncStartOptionsLabels();
  syncScoreTrackingState();

function resetScoreTrackedStartOptionsToDefaults(){
  _resetStartResourceDefaults();
  START_WAVE = DEFAULT_START_WAVE;
  if (startWaveSelect) startWaveSelect.value = String(DEFAULT_START_WAVE);
  START_GAME_SPEED = DEFAULT_START_GAME_SPEED;
  GAME_SPEED_MULT = Math.max(0.1, Math.min(3.0, START_GAME_SPEED / 5));
  INFINITE_MODE = false;
  infiniteModeActive = false;
  if (infiniteToggle) infiniteToggle.checked = false;
  syncStartOptionsLabels();
  resetScoreTrackingState();
}

const INPUT_MODE_KEYBOARD = "keyboardMouse";
const INPUT_MODE_CONTROLLER = "controller";
const BINDINGS_STORAGE_KEY = "tektiteShooterBindings_v1";
const DEFAULT_KEYBOARD_BINDINGS = {
  moveLeft: "KeyA",
  moveRight: "KeyD",
  moveUp: "KeyW",
  moveDown: "KeyS",
  shoot: "Mouse0",
  shield: "Mouse2",
  bomb: "KeyQ",
  pause: "Escape",
  commands: "Slash",
  mute: "KeyM",
  fullscreen: "KeyF"
};
const DEFAULT_CONTROLLER_BINDINGS = {
  moveUp: 12,
  moveDown: 13,
  moveLeft: 14,
  moveRight: 15,
  shoot: 7,
  shield: 4,
  bomb: 6,
  pause: 9,
  commands: 8,
  menuSelect: 0,
  menuBack: 1,
  fullscreen: 11
};
const KEYBOARD_BIND_ACTIONS = [
  { key: "moveLeft", label: "Move Left", hint: "Gameplay movement" },
  { key: "moveRight", label: "Move Right", hint: "Gameplay movement" },
  { key: "moveUp", label: "Move Up", hint: "Gameplay movement" },
  { key: "moveDown", label: "Move Down", hint: "Gameplay movement" },
  { key: "shoot", label: "Shoot", hint: "Key or mouse button" },
  { key: "shield", label: "Shield", hint: "Key or mouse button" },
  { key: "bomb", label: "Bomb", hint: "Gameplay action" },
  { key: "pause", label: "Pause / Resume", hint: "Gameplay and pause menu" },
  { key: "commands", label: "Open Commands", hint: "Open slash chat" },
  { key: "mute", label: "Mute", hint: "Toggle audio" },
  { key: "fullscreen", label: "Fullscreen", hint: "Whole shooter shell" }
];
const CONTROLLER_BIND_ACTIONS = [
  { key: "moveUp", label: "Move Up", hint: "Gameplay movement" },
  { key: "moveDown", label: "Move Down", hint: "Gameplay movement" },
  { key: "moveLeft", label: "Move Left", hint: "Gameplay movement" },
  { key: "moveRight", label: "Move Right", hint: "Gameplay movement" },
  { key: "shoot", label: "Shoot", hint: "Gameplay action" },
  { key: "shield", label: "Shield", hint: "Gameplay action" },
  { key: "bomb", label: "Bomb", hint: "Gameplay action" },
  { key: "pause", label: "Pause / Resume", hint: "Gameplay and pause menu" },
  { key: "commands", label: "Open Commands", hint: "Open slash chat" },
  { key: "menuSelect", label: "Menu Select", hint: "Menus" },
  { key: "menuBack", label: "Menu Back / Close Chat", hint: "Menus and pause chat" },
  { key: "fullscreen", label: "Fullscreen", hint: "Whole shooter shell" }
];
let activeInputMode = INPUT_MODE_KEYBOARD;
let controlsBindMode = INPUT_MODE_KEYBOARD;
let controlsFocusIndex = 0;
let controlsMoveFocusIndex = 0;
let controlsInputLockMode = null;
let sawKeyboardMouseInput = false;
let bindingEditState = null;
let controllerRebindReady = false;
let pauseControlsOpen = false;
let keyboardBindings = { ...DEFAULT_KEYBOARD_BINDINGS };
let controllerBindings = { ...DEFAULT_CONTROLLER_BINDINGS };
let draftKeyboardBindings = { ...DEFAULT_KEYBOARD_BINDINGS };
let draftControllerBindings = { ...DEFAULT_CONTROLLER_BINDINGS };

function loadSavedBindings(){
  try{ window.localStorage.removeItem(BINDINGS_STORAGE_KEY); }catch(_){}
  try{
    const raw = sessionStorage.getItem(BINDINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.keyboard && typeof parsed.keyboard === 'object') keyboardBindings = { ...DEFAULT_KEYBOARD_BINDINGS, ...parsed.keyboard };
    if (parsed && parsed.controller && typeof parsed.controller === 'object') controllerBindings = { ...DEFAULT_CONTROLLER_BINDINGS, ...parsed.controller };
  }catch(_){
    keyboardBindings = { ...DEFAULT_KEYBOARD_BINDINGS };
    controllerBindings = { ...DEFAULT_CONTROLLER_BINDINGS };
  }
}
function saveBindings(){
  try{ window.localStorage.removeItem(BINDINGS_STORAGE_KEY); }catch(_){}
  try{ sessionStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify({ keyboard: keyboardBindings, controller: controllerBindings })); }catch(_){}
}
function resetDraftBindingsFromActive(){
  draftKeyboardBindings = { ...keyboardBindings };
  draftControllerBindings = { ...controllerBindings };
}
function applyDraftBindings(){
  keyboardBindings = { ...draftKeyboardBindings };
  controllerBindings = { ...draftControllerBindings };
  saveBindings();
}
function formatCompactMoveBinding(value){
  if (controlsBindMode === INPUT_MODE_CONTROLLER){
    const map = {12:"D↑", 13:"D↓", 14:"D←", 15:"D→"};
    return map[value] || formatControllerBinding(value);
  }
  return formatKeyboardBinding(value);
}
function isKeyboardActionHeld(action){ const code = keyboardBindings[action]; return !!(code && keys[code]); }
function getGpButtonPressedByIndex(gp, index){ const btn = gpBtn(gp, index); return (index === 6 || index === 7) ? ((btn.value || 0) > GP_TRIGGER_DEADZONE) : !!btn.pressed; }
function getGpActionPressed(gp, action){ const index = controllerBindings[action]; return typeof index === 'number' ? getGpButtonPressedByIndex(gp, index) : false; }
function updateControlsDisplay(){
  const usingController = activeInputMode === INPUT_MODE_CONTROLLER;
  if (btnControls){
    const inputLabel = usingController ? '🎮' : '⌨️';
    const inputTitle = usingController ? 'Controller active' : 'Keyboard / mouse active';
    btnControls.textContent = `Controls ${inputLabel}`;
    btnControls.title = inputTitle;
    btnControls.setAttribute('aria-label', `Controls. ${inputTitle}`);
  }
  if (pauseHint){
    pauseHint.textContent = usingController ? "Press Start to Resume" : "Press ESC to Resume";
  }
  if (controlsMenuTitle){
    controlsMenuTitle.textContent = controlsBindMode === INPUT_MODE_CONTROLLER
      ? 'Controller Keybinds'
      : 'Keyboard / Mouse Controls';
  }
}
function setActiveInputMode(mode, options = null){
  const nextMode = mode === INPUT_MODE_CONTROLLER ? INPUT_MODE_CONTROLLER : INPUT_MODE_KEYBOARD;
  const force = !!(options && options.force);
  if (!force && nextMode === INPUT_MODE_KEYBOARD && controlsMenu && controlsMenu.style.display !== 'none' && controlsInputLockMode === INPUT_MODE_CONTROLLER) return;
  if (activeInputMode === nextMode) return;
  activeInputMode = nextMode;
  document.body.classList.toggle('controller-active', activeInputMode === INPUT_MODE_CONTROLLER);
  if (controlsMenu && controlsMenu.style.display !== 'none') {
    controlsBindMode = activeInputMode;
    bindingEditState = null;
    controllerRebindReady = false;
    renderControlsBindingList();
  }
  updateControlsDisplay();
}
function lockControlsInputMode(mode){
  controlsInputLockMode = mode === INPUT_MODE_CONTROLLER ? INPUT_MODE_CONTROLLER : null;
}
function unlockControlsInputMode(){
  controlsInputLockMode = null;
}
function syncInitialActiveInputModeFromMenuContext(){
  if (sawKeyboardMouseInput) return;
  if (activeInputMode !== INPUT_MODE_KEYBOARD) return;
  const gp = getGamepad();
  if (!gp || gp.connected === false) return;
  setActiveInputMode(INPUT_MODE_CONTROLLER);
}
function getCurrentBindingDefs(){ return controlsBindMode === INPUT_MODE_CONTROLLER ? CONTROLLER_BIND_ACTIONS : KEYBOARD_BIND_ACTIONS; }
function getCurrentBindingValue(action){ return controlsBindMode === INPUT_MODE_CONTROLLER ? draftControllerBindings[action] : draftKeyboardBindings[action]; }
const MOVE_BIND_ACTIONS = ["moveUp", "moveDown", "moveLeft", "moveRight"];
const MOVE_BIND_LABELS = { moveUp: "↑", moveDown: "↓", moveLeft: "←", moveRight: "→" };
function isMoveBindAction(action){ return MOVE_BIND_ACTIONS.includes(action); }
function getControlsMoveButtons(){ return Array.from(document.querySelectorAll('#controlsMenu .controlsMoveButton')); }
function isControlsMoveFocused(){
  const target = getControlsControllerTargets()[controlsFocusIndex];
  return !!(target && target.classList && target.classList.contains('controlsMoveButton'));
}
function syncControlsMoveFocus(){
  const moveButtons = getControlsMoveButtons();
  if (!moveButtons.length) return;
  controlsMoveFocusIndex = Math.max(0, Math.min(controlsMoveFocusIndex, moveButtons.length - 1));
  const items = getControlsControllerTargets();
  const targetIndex = items.indexOf(moveButtons[controlsMoveFocusIndex]);
  if (targetIndex !== -1) controlsFocusIndex = targetIndex;
  focusControllerElement(moveButtons[controlsMoveFocusIndex]);
}
function moveControlsMoveFocus(delta){
  const moveButtons = getControlsMoveButtons();
  if (!moveButtons.length) return false;
  controlsMoveFocusIndex = Math.max(0, Math.min(moveButtons.length - 1, controlsMoveFocusIndex + delta));
  syncControlsMoveFocus();
  return true;
}
function renderControlsBindingList(){
  if (!controlsBindList) return;
  controlsBindList.innerHTML = '';
  const defs = getCurrentBindingDefs();
  const moveDefs = defs.filter(def => isMoveBindAction(def.key));
  const otherDefs = defs.filter(def => !isMoveBindAction(def.key));

  if (moveDefs.length){
    const row = document.createElement('div');
    row.className = 'controlsBindRow controlsMoveRow';
    const meta = document.createElement('div');
    meta.className = 'controlsBindMeta';
    const title = document.createElement('div');
    title.className = 'controlsBindTitle';
    title.textContent = 'Move Controls';
    const hint = document.createElement('div');
    hint.className = 'controlsBindHint';
    hint.textContent = 'Left stick left/right chooses a direction; A edits it.';
    meta.appendChild(title);
    meta.appendChild(hint);
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'controlsMoveButtonGroup';
    MOVE_BIND_ACTIONS.forEach(action => {
      const def = moveDefs.find(item => item.key === action);
      if (!def) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'controlsBindButton controlsMoveButton smallBtn';
      button.dataset.action = def.key;
      button.dataset.scheme = controlsBindMode;
      const value = getCurrentBindingValue(def.key);
      const label = MOVE_BIND_LABELS[def.key] || def.label.replace(/^Move\s+/i, '');
      const binding = formatCompactMoveBinding(value);
      const labelSpan = document.createElement('span');
      labelSpan.className = 'moveBindLabel';
      labelSpan.textContent = label;
      const valueSpan = document.createElement('span');
      valueSpan.className = 'moveBindValue';
      valueSpan.textContent = binding;
      button.replaceChildren(labelSpan, valueSpan);
      if (bindingEditState && bindingEditState.scheme === controlsBindMode && bindingEditState.action === def.key){
        button.classList.add('listening');
        valueSpan.textContent = 'Press...';
      }
      button.addEventListener('click', () => startBindingEdit(controlsBindMode, def.key));
      buttonGroup.appendChild(button);
    });
    row.appendChild(meta);
    row.appendChild(buttonGroup);
    controlsBindList.appendChild(row);
  }

  {
    const row = document.createElement('div');
    row.className = 'controlsBindRow controlsAimRow';
    const meta = document.createElement('div');
    meta.className = 'controlsBindMeta';
    const title = document.createElement('div');
    title.className = 'controlsBindTitle';
    title.textContent = 'Aim Control';
    const hint = document.createElement('div');
    hint.className = 'controlsBindHint';
    hint.textContent = controlsBindMode === INPUT_MODE_CONTROLLER ? 'Right Stick' : 'Mouse';
    meta.appendChild(title);
    meta.appendChild(hint);
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'controlsAimButtonGroup';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'controlsBindButton controlsAimButton controlsFixedBindButton smallBtn';
    button.disabled = true;
    button.tabIndex = -1;
    button.setAttribute('aria-disabled', 'true');
    button.textContent = controlsBindMode === INPUT_MODE_CONTROLLER ? 'Right Stick' : 'Mouse';
    buttonGroup.appendChild(button);
    row.appendChild(meta);
    row.appendChild(buttonGroup);
    controlsBindList.appendChild(row);
  }

  otherDefs.forEach(def => {
    const row = document.createElement('div');
    row.className = 'controlsBindRow';
    const meta = document.createElement('div');
    meta.className = 'controlsBindMeta';
    const title = document.createElement('div');
    title.className = 'controlsBindTitle';
    title.textContent = def.label;
    const hint = document.createElement('div');
    hint.className = 'controlsBindHint';
    hint.textContent = def.hint;
    meta.appendChild(title);
    meta.appendChild(hint);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'controlsBindButton smallBtn';
    button.dataset.action = def.key;
    button.dataset.scheme = controlsBindMode;
    const value = getCurrentBindingValue(def.key);
    button.textContent = controlsBindMode === INPUT_MODE_CONTROLLER ? formatControllerBinding(value) : formatKeyboardBinding(value);
    if (bindingEditState && bindingEditState.scheme === controlsBindMode && bindingEditState.action === def.key){
      button.classList.add('listening');
      button.textContent = 'Press input...';
    }
    button.addEventListener('click', () => startBindingEdit(controlsBindMode, def.key));
    row.appendChild(meta);
    row.appendChild(button);
    controlsBindList.appendChild(row);
  });
  fitControlsMenuToViewport();
}
function setControlsBindMode(mode){
  controlsBindMode = mode === INPUT_MODE_CONTROLLER ? INPUT_MODE_CONTROLLER : INPUT_MODE_KEYBOARD;
  bindingEditState = null;
  controllerRebindReady = false;
  updateControlsDisplay();
  renderControlsBindingList();
  fitControlsMenuToViewport();
}
function applyBindingValue(scheme, action, value){
  if (scheme === INPUT_MODE_CONTROLLER) draftControllerBindings[action] = Number(value);
  else draftKeyboardBindings[action] = String(value);
  bindingEditState = null;
  controllerRebindReady = false;
  updateControlsDisplay();
  renderControlsBindingList();
  fitControlsMenuToViewport();
}
function startBindingEdit(scheme, action){
  controlsBindMode = scheme === INPUT_MODE_CONTROLLER ? INPUT_MODE_CONTROLLER : INPUT_MODE_KEYBOARD;
  bindingEditState = { scheme: controlsBindMode, action };
  controllerRebindReady = false;
  updateControlsDisplay();
  renderControlsBindingList();
  fitControlsMenuToViewport();
}
function cancelBindingEdit(){ bindingEditState = null; controllerRebindReady = false; renderControlsBindingList(); fitControlsMenuToViewport(); }
loadSavedBindings();
resetDraftBindingsFromActive();
updateControlsDisplay();
renderControlsBindingList();
let menuFocusIndex = 0;
let optionsFocusIndex = 0;
let pauseFocusIndex = 0;
let optionsOpenedFromPause = false;
let gpNavRepeat = { up:0, down:0, left:0, right:0 };
let gpNavPrevAxis = { horizontal:0, vertical:0 };

function focusControllerElement(el){
  if (activeInputMode !== INPUT_MODE_CONTROLLER) {
    clearControllerFocus();
    return;
  }
  if (!el) return;
  document.querySelectorAll('.controllerFocus').forEach(node => node.classList.remove('controllerFocus'));
  el.classList.add('controllerFocus');
  const optRow = el.closest('.optRow');
  if (optRow) optRow.classList.add('controllerFocus');
  const bindRow = el.closest('.controlsBindRow');
  if (bindRow) bindRow.classList.add('controllerFocus');
  if (typeof el.focus === 'function') { try{ el.focus({ preventScroll:true }); }catch(_){ try{ el.focus(); }catch(__){} } }
  if (typeof el.scrollIntoView === 'function') {
    try{ el.scrollIntoView({ block:'nearest', inline:'nearest' }); }catch(_){ }
  }
  if (el !== lastControllerSelectSoundTarget) {
    lastControllerSelectSoundTarget = el;
    playUiSelectSoundFor(el, 'controller');
  }
}

function clearControllerFocus(){
  document.querySelectorAll('.controllerFocus').forEach(node => node.classList.remove('controllerFocus'));
}

if (controlsResetBinds) controlsResetBinds.addEventListener('click', () => { draftKeyboardBindings = { ...DEFAULT_KEYBOARD_BINDINGS }; draftControllerBindings = { ...DEFAULT_CONTROLLER_BINDINGS }; cancelBindingEdit(); updateControlsDisplay(); renderControlsBindingList(); });
if (controlsApplyBinds) controlsApplyBinds.addEventListener('click', () => { applyDraftBindings(); cancelBindingEdit(); updateControlsDisplay(); renderControlsBindingList(); if (pauseControlsOpen && isPaused) hidePauseControlsMenu(); });
if (controlsBack) controlsBack.addEventListener('click', hideControlsMenu);

function getMenuControllerTargets(){
  return [btnStart, btnOptions, btnControls].filter(Boolean);
}

function getOptionsControllerTargets(){
  return [btnReturnToLevel1, btnSkipToLevel3, btnBack].filter(Boolean);
}

function getControlsControllerTargets(){
  const moveButtons = getControlsMoveButtons();
  const moveTarget = moveButtons[controlsMoveFocusIndex] || moveButtons[0];
  const otherBindButtons = Array.from(document.querySelectorAll('#controlsMenu .controlsBindButton:not(.controlsMoveButton)'));
  return [moveTarget, ...otherBindButtons, controlsBack, controlsResetBinds, controlsApplyBinds].filter(Boolean);
}

function getPauseControllerTargets(){
  return [btnPauseResume, (canOpenStore() ? btnPauseOpenStore : null), btnPauseOpenChat, btnPauseOptions, btnPauseQuit].filter(Boolean);
}

function getScoreStoreControllerTargets(){
  return [...Array.from(document.querySelectorAll('#scoreStoreItems .scoreStoreRow')), btnScoreStoreClose].filter(Boolean);
}

function syncMenuControllerFocus(){
  const items = getMenuControllerTargets();
  if (!items.length) return;
  menuFocusIndex = Math.max(0, Math.min(menuFocusIndex, items.length - 1));
  focusControllerElement(items[menuFocusIndex]);
}

function syncOptionsControllerFocus(){
  const items = getOptionsControllerTargets();
  if (!items.length) return;
  optionsFocusIndex = Math.max(0, Math.min(optionsFocusIndex, items.length - 1));
  focusControllerElement(items[optionsFocusIndex]);
}

function syncPauseControllerFocus(){
  const items = getPauseControllerTargets();
  if (!items.length) return;
  pauseFocusIndex = Math.max(0, Math.min(pauseFocusIndex, items.length - 1));
  focusControllerElement(items[pauseFocusIndex]);
}

function syncScoreStoreControllerFocus(){
  const items = getScoreStoreControllerTargets();
  if (!items.length) return;
  scoreStoreFocusIndex = Math.max(0, Math.min(scoreStoreFocusIndex, items.length - 1));
  const target = items[scoreStoreFocusIndex];
  focusControllerElement(target);
  if (scoreStoreItemsEl && scoreStoreFocusIndex < SCORE_STORE_GRID_COLUMNS){
    try{ scoreStoreItemsEl.scrollTop = 0; }catch(_){}
  }
}

function syncControlsControllerFocus(){
  const items = getControlsControllerTargets();
  if (!items.length) return;
  controlsFocusIndex = Math.max(0, Math.min(controlsFocusIndex, items.length - 1));
  focusControllerElement(items[controlsFocusIndex]);
}

function blurCapturedControllerInputIfNeeded(backButton){
  const activeEl = document.activeElement;
  if (!activeEl || activeEl === document.body || activeEl === backButton) return false;
  const tag = (activeEl.tagName || "").toUpperCase();
  const isCapturedInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || activeEl.isContentEditable;
  if (!isCapturedInput) return false;
  try{ activeEl.blur(); }catch(_){}
  return true;
}

function routeControllerBackToButton(backButton, items, currentIndex, setIndex, syncFocus){
  if (!backButton) return false;
  items = Array.isArray(items) ? items.filter(Boolean) : [];
  const currentTarget = items[currentIndex] || document.querySelector('.controllerFocus');
  const backIsFocused = currentTarget === backButton || backButton.classList.contains('controllerFocus') || document.activeElement === backButton;
  if (backIsFocused){
    activateControllerTarget(backButton);
    return true;
  }

  blurCapturedControllerInputIfNeeded(backButton);

  const backIndex = items.indexOf(backButton);
  if (backIndex !== -1 && typeof setIndex === "function"){
    setIndex(backIndex);
    if (typeof syncFocus === "function") syncFocus();
  } else {
    focusControllerElement(backButton);
  }
  return true;
}

function isControllerListJumpBlockedByCapturedInput(){
  const activeEl = document.activeElement;
  if (!activeEl || activeEl === document.body) return false;
  const tag = (activeEl.tagName || "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT" || activeEl.isContentEditable) return true;
  if (tag !== "INPUT") return false;
  const type = String(activeEl.getAttribute("type") || activeEl.type || "text").toLowerCase();
  // Buttons, checkboxes, ranges, and radios are normal controller targets;
  // text-ish inputs and pickers can capture intent, so bumpers leave them alone.
  return !["button", "checkbox", "radio", "range", "submit", "reset"].includes(type);
}

function jumpControllerFocusToListEdge(items, currentIndex, setIndex, syncFocus, direction){
  if (isControllerListJumpBlockedByCapturedInput()) return false;
  items = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!items.length || typeof setIndex !== "function") return false;
  const lastIndex = items.length - 1;
  let nextIndex = direction < 0 ? 0 : lastIndex;
  const safeCurrentIndex = Math.max(0, Math.min(lastIndex, Number(currentIndex) || 0));
  if (safeCurrentIndex === nextIndex){
    nextIndex = direction < 0 ? lastIndex : 0;
  }
  setIndex(nextIndex);
  if (typeof syncFocus === "function") syncFocus();
  return true;
}

function handleOptionsControllerBackButton(){
  return routeControllerBackToButton(btnBack, getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus);
}

function handleControlsControllerBackButton(){
  return routeControllerBackToButton(controlsBack, getControlsControllerTargets(), controlsFocusIndex, (index) => { controlsFocusIndex = index; }, syncControlsControllerFocus);
}

function handleScoreStoreControllerBackButton(){
  return routeControllerBackToButton(btnScoreStoreClose, getScoreStoreControllerTargets(), scoreStoreFocusIndex, (index) => { scoreStoreFocusIndex = index; }, syncScoreStoreControllerFocus);
}

function moveMenuControllerFocus(delta){
  const items = getMenuControllerTargets();
  if (!items.length) return;
  menuFocusIndex = (menuFocusIndex + delta + items.length) % items.length;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
}

function moveOptionsControllerFocus(delta){
  const items = getOptionsControllerTargets();
  if (!items.length) return;
  optionsFocusIndex = (optionsFocusIndex + delta + items.length) % items.length;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  else clearControllerFocus();
}

function movePauseControllerFocus(delta){
  const items = getPauseControllerTargets();
  if (!items.length) return;
  pauseFocusIndex = (pauseFocusIndex + delta + items.length) % items.length;
  syncPauseControllerFocus();
}

function moveScoreStoreControllerFocus(delta){
  const items = getScoreStoreControllerTargets();
  if (!items.length) return;
  scoreStoreFocusIndex = (scoreStoreFocusIndex + delta + items.length) % items.length;
  syncScoreStoreControllerFocus();
}

function moveScoreStoreControllerFocusGrid(delta){
  const items = getScoreStoreControllerTargets();
  if (!items.length) return;
  const closeIndex = items.indexOf(btnScoreStoreClose);
  const cardCount = closeIndex >= 0 ? closeIndex : items.length;
  if (delta === SCORE_STORE_GRID_COLUMNS && scoreStoreFocusIndex >= Math.max(0, cardCount - SCORE_STORE_GRID_COLUMNS) && closeIndex >= 0){
    scoreStoreFocusIndex = closeIndex;
  } else if (delta === -SCORE_STORE_GRID_COLUMNS && scoreStoreFocusIndex === closeIndex && cardCount > 0){
    scoreStoreFocusIndex = Math.max(0, cardCount - SCORE_STORE_GRID_COLUMNS);
  } else {
    scoreStoreFocusIndex = (scoreStoreFocusIndex + delta + items.length) % items.length;
  }
  syncScoreStoreControllerFocus();
}

function moveControlsControllerFocus(delta){
  const previous = getControlsControllerTargets()[controlsFocusIndex];
  const items = getControlsControllerTargets();
  if (!items.length) return;
  controlsFocusIndex = (controlsFocusIndex + delta + items.length) % items.length;
  const next = getControlsControllerTargets()[controlsFocusIndex];
  const moveButtons = getControlsMoveButtons();
  if (moveButtons.includes(next) && !moveButtons.includes(previous)){
    controlsMoveFocusIndex = 0;
  }
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncControlsControllerFocus();
  else clearControllerFocus();
  fitControlsMenuToViewport();
}

function cycleSelect(selectEl, delta){
  if (!selectEl || !selectEl.options || !selectEl.options.length) return false;
  const current = Math.max(0, selectEl.selectedIndex);
  const next = Math.max(0, Math.min(selectEl.options.length - 1, current + delta));
  if (next === current) return false;
  selectEl.selectedIndex = next;
  selectEl.dispatchEvent(new Event('change', { bubbles:true }));
  return true;
}

function stepRange(rangeEl, delta){
  if (!rangeEl) return false;
  const step = parseFloat(rangeEl.step || '1') || 1;
  const min = parseFloat(rangeEl.min || '0');
  const max = parseFloat(rangeEl.max || '100');
  const current = parseFloat(rangeEl.value || '0');
  const next = Math.max(min, Math.min(max, current + (step * delta)));
  if (next === current) return false;
  rangeEl.value = String(next);
  rangeEl.dispatchEvent(new Event('input', { bubbles:true }));
  rangeEl.dispatchEvent(new Event('change', { bubbles:true }));
  return true;
}

function openControllerSelect(selectEl){
  if (!selectEl || selectEl.tagName !== 'SELECT') return false;
  focusControllerElement(selectEl);
  const forceTopOpen = selectEl.id === 'startWaveSelect';
  const previousIndex = selectEl.selectedIndex;
  if (forceTopOpen){
    try{ selectEl.scrollTop = 0; }catch(_){ }
    try{ selectEl.selectedIndex = 0; }catch(_){ }
  }
  let opened = false;
  try{ if (typeof selectEl.showPicker === 'function'){ selectEl.showPicker(); opened = true; } }catch(_){}
  if (!opened){
    try{ selectEl.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, view:window })); opened = true; }catch(_){}
  }
  if (!opened){
    try{ selectEl.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', code:'ArrowDown', keyCode:40, which:40, altKey:true, bubbles:true })); opened = true; }catch(_){}
  }
  if (forceTopOpen){
    const restoreSelection = () => {
      try{ selectEl.scrollTop = 0; }catch(_){ }
      try{ selectEl.selectedIndex = previousIndex; }catch(_){ }
    };
    setTimeout(restoreSelection, 0);
    setTimeout(restoreSelection, 120);
  }
  return opened;
}

function activateControllerTarget(el){
  if (!el) return;
  playUiActivateSoundFor(el, 'controller');
  if (el.dataset && el.dataset.action && el.dataset.scheme){
    startBindingEdit(el.dataset.scheme, el.dataset.action);
    return;
  }
  if (el === btnControls){
    showControlsMenu();
    return;
  }
  if (el.tagName === 'SELECT'){
    openControllerSelect(el);
    return;
  }
  if (el.type === 'checkbox'){
    el.checked = !el.checked;
    el.dispatchEvent(new Event('change', { bubbles:true }));
    focusControllerElement(el);
    return;
  }
  if (typeof el.click === 'function') el.click();
}

function adjustControllerOption(delta){
  const items = getOptionsControllerTargets();
  const el = items[optionsFocusIndex];
  if (!el) return false;
  if (el.tagName === 'SELECT') return cycleSelect(el, delta);
  if (el.type === 'range') return stepRange(el, delta);
  if (el.type === 'checkbox'){
    el.checked = delta > 0;
    el.dispatchEvent(new Event('change', { bubbles:true }));
    focusControllerElement(el);
    return true;
  }
  return false;
}
function showMenu(){
  setPaused(false);
  syncInitialActiveInputModeFromMenuContext();
  deathYellPlayed = false;
  gameState = STATE.MENU;
  syncStartMenuHudLayerMode();
  gameWon = false;
  mouseShieldHolding = false;
  stopShield(false);

  deathOverlay.style.display = "none";
  clearDeathControllerFocus();
  if (winOverlay) winOverlay.style.display = "none";
  if (mazeSummaryOverlay) mazeSummaryOverlay.style.display = "none";
  mazeSummaryActive = false;
  mazePendingNextWave = null;

  startMenu.style.display = "block";
  optionsMenu.style.display = "none";
  if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode"); }
  pauseControlsOpen = false;
  if (pauseOverlay) pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  uiRoot.classList.remove("optionsBackdrop");
  uiRoot.style.display = "flex";
  menuFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
}

function showWinOverlay(){
  gameWon = true;
  gameState = STATE.WIN;
  syncStartMenuHudLayerMode();
  if (winOverlay) winOverlay.style.display = "flex";
  if (mazeSummaryOverlay) mazeSummaryOverlay.style.display = "none";
  if (pauseOverlay) pauseOverlay.style.display = "none";
  livesSlot.style.display = "none";
  powerupSlot.style.display = "none";
  if (timerHud) timerHud.style.display = "none";
  { const heartsHud = document.getElementById("heartsHud"); if (heartsHud) heartsHud.style.display = "none"; }
  // keep music playing through the win/score screen
}



function resetDeathQuitConfirm(){
  deathQuitConfirmArmed = false;
  deathQuitConfirmReady = false;
  deathQuitConfirmRemaining = 0;
  if (deathQuitConfirmTimer){
    clearInterval(deathQuitConfirmTimer);
    deathQuitConfirmTimer = null;
  }
  if (btnDeathQuitToMenu) btnDeathQuitToMenu.textContent = "Quit to Menu";
}

function getDeathButtons(){
  const buttons = [];
  if (btnRestart) buttons.push(btnRestart);
  if (btnDeathQuitToMenu) buttons.push(btnDeathQuitToMenu);
  return buttons.filter((button) => !!button);
}

function clearDeathControllerFocus(){
  getDeathButtons().forEach((button) => {
    button.classList.remove("controllerFocus");
    try{ button.blur(); }catch(e){}
  });
}

function syncDeathControllerFocus(){
  const buttons = getDeathButtons();
  if (!buttons.length) return;
  document.body.classList.add("controller-active");
  deathFocusIndex = Math.max(0, Math.min(deathFocusIndex, buttons.length - 1));
  buttons.forEach((button, index) => {
    button.classList.toggle("controllerFocus", index === deathFocusIndex);
    if (index === deathFocusIndex){
      try{ button.focus({ preventScroll:true }); }catch(e){ try{ button.focus(); }catch(_){} }
    }
  });
}

function moveDeathControllerFocus(delta){
  const buttons = getDeathButtons();
  if (!buttons.length) return;
  deathFocusIndex = (deathFocusIndex + delta + buttons.length) % buttons.length;
  syncDeathControllerFocus();
}

function activateDeathControllerFocus(){
  const buttons = getDeathButtons();
  if (!buttons.length) return false;
  const button = buttons[Math.max(0, Math.min(deathFocusIndex, buttons.length - 1))];
  if (!button) return false;
  playUiActivateSoundFor(button, 'controller');
  try{ button.click(); return true; }catch(e){ return false; }
}

function performDeathQuitToMenu(){
  if (deathQuitConfirmTimer){
    clearInterval(deathQuitConfirmTimer);
    deathQuitConfirmTimer = null;
  }

  deathOverlay.style.display = "none";
    clearDeathControllerFocus();
    setPaused(false);
    stopMusic();
    resetScoreTrackedStartOptionsToDefaults();
    if (window.parent && window.parent !== window){
      try {
        if (requestReturnToLevel1()) return;
      } catch (e) {}
    }
    showMenu();
}

function armDeathQuitConfirmCountdown(){
  deathQuitConfirmArmed = true;
  deathQuitConfirmReady = false;
  deathQuitConfirmRemaining = 3;
  if (deathQuitConfirmTimer){
    clearInterval(deathQuitConfirmTimer);
    deathQuitConfirmTimer = null;
  }
  if (btnDeathQuitToMenu) btnDeathQuitToMenu.textContent = "Really, Quit? (3s)";
  deathQuitConfirmTimer = setInterval(() => {
    deathQuitConfirmRemaining = Math.max(0, deathQuitConfirmRemaining - 1);
    if (btnDeathQuitToMenu){
      btnDeathQuitToMenu.textContent = deathQuitConfirmRemaining > 0
        ? "Really, Quit? (" + deathQuitConfirmRemaining + "s)"
        : "Really, Quit?";
    }
    if (deathQuitConfirmRemaining <= 0){
      clearInterval(deathQuitConfirmTimer);
      deathQuitConfirmTimer = null;
      deathQuitConfirmReady = true;
    }
  }, 1000);
}

function quitDeathToMenu(){
  if (!deathQuitConfirmArmed){
    armDeathQuitConfirmCountdown();
    syncDeathControllerFocus();
    return;
  }
  if (!deathQuitConfirmReady){
    syncDeathControllerFocus();
    return;
  }
  performDeathQuitToMenu();
}

function restartRun(){
  resetDeathQuitConfirm();
  setPaused(false);
  // Restart music immediately when restarting a run.
  ensureMusicPlaying(true);
  // v1.96: Hard reset from GAME OVER screen (full reset to beginning)
  deathOverlay.style.display = "none";
  clearDeathControllerFocus();
  bomb = null;
  ufo = null;
  powerupSlot.style.display = "none";
  startGame();
}
function showControlsMenu(){
  if (!controlsMenu || startMenu.style.display === "none") return;
  setPaused(false);
  syncInitialActiveInputModeFromMenuContext();
  pauseControlsOpen = false;
  if (pauseOverlay) pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  gameState = STATE.CONTROLS;
  syncStartMenuHudLayerMode();
  resetDraftBindingsFromActive();
  lockControlsInputMode(activeInputMode);
  setControlsBindMode(activeInputMode);
  startMenu.style.display = "none";
  optionsMenu.style.display = "none";
  controlsMenu.style.display = "block";
  controlsMenu.classList.remove("pauseControlsMode");
  uiRoot.style.display = "flex";
  updateControlsDisplay();
  renderControlsBindingList();
  fitControlsMenuToViewport();
  controlsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncControlsControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
}
function hideControlsMenu(){
  if (!controlsMenu) return;
  resetDraftBindingsFromActive();
  controlsMenu.style.display = "none";
  controlsMenu.classList.remove("pauseControlsMode");
  unlockControlsInputMode();
  cancelBindingEdit();
  if (pauseControlsOpen && isPaused){
    hidePauseControlsMenu();
    return;
  }
  showMenu();
}

function isPauseSelectLevelOpen(){
  return !!(typeof optionsOpenedFromPause !== "undefined" && optionsOpenedFromPause && isPaused && optionsMenu && optionsMenu.style.display === "block");
}

function getPauseOptionsReturnFocusIndex(){
  const items = getPauseControllerTargets();
  const index = items.indexOf(btnPauseOpenChat || btnPauseOptions);
  return index >= 0 ? index : 0;
}

function isPauseScoreStoreOpen(){
  return !!(isScoreStoreOpen && isPaused);
}

function showOptions(fromPause = false){
  syncInitialActiveInputModeFromMenuContext();
  optionsOpenedFromPause = !!fromPause;
  if (!fromPause) {
    setPaused(false);
    gameState = STATE.OPTIONS;
    syncStartMenuHudLayerMode();
  }

  mouseShieldHolding = false;
  stopShield(false);

  startMenu.style.display = "none";
  if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode"); }
  pauseControlsOpen = false;
  if (pauseOverlay) pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  if (pauseOverlay) pauseOverlay.style.display = "none";
  optionsMenu.style.display = "block";
  uiRoot.classList.add("optionsBackdrop");
  uiRoot.style.display = "flex";
  fitOptionsMenuToViewport();
  optionsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
}
function startGame(){
  START_WAVE = Math.max(1, Math.min(21, START_WAVE || URL_START_WAVE || 1));
  setPaused(false);
  unlockAudioOnce();
  // Start looping music exactly when the game starts.
  ensureMusicPlaying(true);
  gameState = STATE.PLAYING;
  syncStartMenuHudLayerMode();
  scoreTrackingLocked = !!(isTektiteNicknameCheatermodeUnlock() || hasScoreDisqualifyingSettings());
  uiRoot.classList.remove("optionsBackdrop");
  uiRoot.style.display = "none";
  if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode"); }
  pauseControlsOpen = false;
  if (pauseOverlay) pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  deathOverlay.style.display = "none";
  clearDeathControllerFocus();
  if (winOverlay) winOverlay.style.display = "none";

  // v1.96: show HUD only in-game
  livesSlot.style.display = "flex";
  powerupSlot.style.display = "none";
  if (timerHud) timerHud.style.display = "block";


  // v1.96.x: Reset run timer at the start of each game
  runTimer = 0;
  updateTimerHUD();
  score = 0;
  scoreStoreUnlockedThisRun = false;
  bigBulletBuffEndTime = 0;
  frogKills = 0;
  shotsFired = 0;
  hitsConnected = 0;
  damageDealt = 0;
  syncScoreTrackingState();
  // v1.96: Apply starting settings from OPTIONS menu
  infiniteModeActive = !!INFINITE_MODE;
  livesInfiniteActive = !!START_LIVES_INFINITE || !!INFINITE_MODE;
  heartsInfiniteActive = !!START_HEARTS_INFINITE || !!INFINITE_MODE;
  shieldsInfiniteActive = !!START_SHIELDS_INFINITE || !!INFINITE_MODE;
  bombsInfiniteActive = !!START_BOMBS_INFINITE || !!INFINITE_MODE;

  lives = livesInfiniteActive ? 100 : Math.max(0, parseInt(START_LIVES, 10) || 0);
  livesText.textContent = livesInfiniteActive ? "x∞" : ("x" + lives);

  MAX_HEARTS = heartsInfiniteActive ? 100 : Math.max(1, parseInt(START_HEARTS, 10) || 4);
  HIT_DAMAGE = 1 / MAX_HEARTS;

  health = 1.0;

  // Spawn player fixed in the center for maze traversal
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;

  shieldPips = shieldsInfiniteActive ? 100 : Math.max(0, parseInt(START_SHIELDS, 10) || 0);

  bombsCount = bombsInfiniteActive ? 100 : Math.max(0, parseInt(START_BOMBS, 10) || 0);
  _syncBombHud();

  health = 1.0;

  // Spawn player fixed in the center for maze traversal
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  bonusArmor = 0;
  bonusArmorBrokenT = 0;
  isDead = false;
  deathTimer = 0;
  deathGameOver = false;
  deathYellPlayed = false;
  deathParticles.length = 0;

  wave = START_WAVE;
  showWaveBanner(wave);
bullets.length = 0;
  enemyBullets.length = 0;
  fireCooldown = 0;
  bomb = null;
  ufo = null;

  resetFormation();
  updateHearts();
spawnEnemies();
  trySpawnUFO();

  clearControllerFocus();
  window.focus();
}

let initialLevel2BootApplied = false;
function beginLevel2Session(){
  initialLevel2BootApplied = true;
  startGame();
}
function applyInitialLevel2BootState(){
  if (initialLevel2BootApplied) return;
  initialLevel2BootApplied = true;
  if (AUTO_START_LEVEL){
    startMenu.style.display = "none";
    optionsMenu.style.display = "none";
    uiRoot.style.display = "none";
    powerupSlot.style.display = "none";
    startGame();
  } else {
    showMenu();
  }
}

btnStart.addEventListener("click", beginLevel2Session);
btnOptions.addEventListener("click", () => showOptions(false));
if (btnPauseOptions) btnPauseOptions.addEventListener("click", () => showOptions(true));
if (btnControls) btnControls.addEventListener("click", showControlsMenu);
btnBack.addEventListener("click", () => {
  if (optionsOpenedFromPause && isPaused){
    optionsMenu.style.display = "none";
    uiRoot.classList.remove("optionsBackdrop");
    uiRoot.style.display = "none";
    if (pauseOverlay) pauseOverlay.style.display = "flex";
    optionsOpenedFromPause = false;
    gameState = STATE.PLAYING;
    pauseFocusIndex = getPauseOptionsReturnFocusIndex();
    if (activeInputMode === INPUT_MODE_CONTROLLER) syncPauseControllerFocus();
    else clearControllerFocus();
    return;
  }
  optionsOpenedFromPause = false;
  showMenu();
});
if (controlsBack) controlsBack.addEventListener("click", hideControlsMenu);

btnRestart.addEventListener("click", () => {
  restartRun();
});


if (btnDeathQuitToMenu){
  btnDeathQuitToMenu.addEventListener("click", quitDeathToMenu);
}

if (btnRestart){
}


if (btnContinue){
  btnContinue.addEventListener("click", () => {
    // Hook this up later. For now it simply closes the overlay.
    if (winOverlay) winOverlay.style.display = "none";
  });
}

if (btnNextMaze){
  btnNextMaze.addEventListener("click", () => {
    advanceToNextMaze();
  });
}

if (btnReturnToLevel1){
  btnReturnToLevel1.addEventListener("click", () => {
    if (window.parent && window.parent !== window){
      try{
        if (requestReturnToLevel1()) return;
      }catch(err){
        console.warn("Failed to notify parent iframe host about level transition.", err);
      }
    }

window.location.href = "/dead/games/shooter-game/assets/levels/shooter-game-level1.html?reload=" + Date.now();
  });
}

if (btnSkipToLevel3){
  btnSkipToLevel3.addEventListener("click", () => {
    const msg = "Level 3 is not built yet.";
    setAssetStatus(msg);
  });
}


function requestReturnToLevel1(){
  if (!window.parent || window.parent === window) return false;
  window.parent.postMessage({ type: "tektite:return-to-level1" }, "*");
  return true;
}

function setAssetStatus(msg){
  if (!assetStatus) return;
  assetStatus.textContent = msg || "";
  assetStatus.style.display = msg ? "block" : "none";
}

/* =======================
   Player (v1.96 bigger)
======================= */
// Keep the player GIF alive as an attached DOM image so canvas draws the current animated frame.
// Canvas is a joyless little photocopier unless the browser sees the GIF actually living in the DOM.
const playerImg = (() => {
  const img = document.createElement("img");
  img.decoding = "async";
  img.loading = "eager";
  img.alt = "";
  img.style.cssText = "width:1px;height:1px;position:fixed;left:-99999px;top:-99999px;opacity:0;pointer-events:none;";
  img.src = PLAYER_IMG_URL;

  const attach = () => {
    if (!img.parentNode && document.body) document.body.appendChild(img);
  };
  if (document.body) attach();
  else document.addEventListener("DOMContentLoaded", attach, { once:true });

  return img;
})();

// v1.96 sizing + anchoring
const PLAYER_SIZE = 72;                 // was 48
const PLAYER_BOTTOM_MARGIN = 100;
const PLAYER_SPAWN_Y_FACTOR = 0.95; // middle-ish, above hearts HUD       // gives breathing room vs browser UI
const FORMATION_PLAYER_GAP = 160;       // v1.96: no longer enforced (kept for tuning/dead/experiments)

const player = {
  x: 0,
  y: 0,
  w: PLAYER_SIZE,
  h: PLAYER_SIZE,
  speed: 6,
  invuln: 0
};

// v2.04: faux-2.5D turn animation state
let playerFacing = -1; // -1 = facing left/default, 1 = facing right
let playerTurnT = 1;   // 0..1 progress through the current turn
const PLAYER_TURN_DUR = 0.16;
const SPIRAL_PLAYER_SPIN_TURNS = 3;

// v2.06: full-direction ghost trail. Up/down trail now works, and diagonal movement bends/warps.
const playerGhosts = [];
let playerGhostSpawnT = 0;
let spiralPlayerReactionT = 0;
let spiralPlayerReactionDuration = 0;
let spiralPlayerContactCooldown = 0;
const SPIRAL_PLAYER_CONTACT_RETRIGGER_SECS = 0.24;
const PLAYER_GHOST_MAX = 2;
const PLAYER_GHOST_SPAWN_EVERY = 0.072;
const PLAYER_GHOST_TTL = 0.18;

function getEnemyContactAssetFilename(enemy){
  const img = enemy && enemy.img;
  const src = img ? (img.currentSrc || img.src || "") : "";
  const cleanSrc = String(src).split(/[?#]/)[0];
  return cleanSrc.slice(cleanSrc.lastIndexOf("/") + 1).toLowerCase();
}

function isSpiralContactEnemy(enemy){
  const filename = getEnemyContactAssetFilename(enemy);
  return filename === "spiral.webp" || filename === "spiral.gif";
}

function triggerSpiralPlayerReaction(durationSecs){
  const duration = Math.max(0.12, durationSecs || player.invuln || 1);
  spiralPlayerReactionT = duration;
  spiralPlayerReactionDuration = duration;
}

function applySpiralPlayerReactionIfNeeded(sourceEnemy){
  // Spiral enemies scramble the banana only when their body-contact hit lands.
  if (isSpiralContactEnemy(sourceEnemy)) triggerSpiralPlayerReaction(player.invuln);
}

function tryTriggerSpiralPlayerContactFx(sourceEnemy, durationSecs){
  // Keep spiral.webp / spiral.gif spooky even when another system absorbs the hit.
  // Otherwise shield/invulnerability turns the special contact into a normal bump, because apparently fun needed a permission slip.
  if (!isSpiralContactEnemy(sourceEnemy) || spiralPlayerContactCooldown > 0) return;
  triggerSpiralPlayerReaction(durationSecs || player.invuln || 0.65);
  spiralPlayerContactCooldown = SPIRAL_PLAYER_CONTACT_RETRIGGER_SECS;
}

function applySpiralPlayerDrawFx(){
  if (spiralPlayerReactionT <= 0 || spiralPlayerReactionDuration <= 0) return;

  const progress = Math.max(0, Math.min(1, spiralPlayerReactionT / spiralPlayerReactionDuration));
  const spin = (1 - progress) * Math.PI * 2 * SPIRAL_PLAYER_SPIN_TURNS;
  const wobble = Math.sin(time * 36) * 0.08 * progress;
  const hue = Math.round((time * 720) % 360);

  ctx.rotate(spin + wobble);
  ctx.filter = `hue-rotate(${hue}deg) saturate(${(1 + progress * 2.4).toFixed(2)}) contrast(${(1 + progress * 0.35).toFixed(2)})`;
}

function spawnPlayerGhost(moveVX, moveVY){
  const mag = Math.hypot(moveVX || 0, moveVY || 0);
  if (mag < 0.08) return;

  const nx = moveVX / mag;
  const ny = moveVY / mag;
  const diagonal = Math.abs(nx) > 0.2 && Math.abs(ny) > 0.2;
  const behindDist = rand(player.w * 0.62, player.w * 1.02);
  const sideWarp = diagonal ? rand(-player.w * 0.14, player.w * 0.14) : rand(-player.w * 0.04, player.w * 0.04);
  const bend = diagonal ? rand(-0.55, 0.55) : 0;

  playerGhosts.push({
    xOff: (-nx * behindDist) + (-ny * sideWarp),
    yOff: (-ny * behindDist) + ( nx * sideWarp),
    vxPull: nx,
    vyPull: ny,
    bend,
    bendAmp: diagonal ? rand(player.w * 0.05, player.w * 0.11) : rand(player.w * 0.01, player.w * 0.03),
    ttl: PLAYER_GHOST_TTL,
    life: PLAYER_GHOST_TTL,
    scaleY: diagonal ? rand(0.94, 1.06) : rand(0.97, 1.03),
    widthScale: diagonal ? rand(0.82, 0.96) : rand(0.88, 0.97)
  });
  while (playerGhosts.length > PLAYER_GHOST_MAX) playerGhosts.shift();
}

function updatePlayerGhosts(dt){
  for (let i = playerGhosts.length - 1; i >= 0; i--){
    const g = playerGhosts[i];
    g.life -= dt;
    const t = Math.max(0, g.life / g.ttl);
    const pull = Math.min(1, dt * 8.0);
    const bendPhase = (1 - t) * Math.PI;
    const perpX = -g.vyPull;
    const perpY =  g.vxPull;
    const warp = Math.sin(bendPhase) * g.bendAmp * g.bend;

    g.xOff += (0 - g.xOff) * pull;
    g.yOff += (0 - g.yOff) * pull;
    g.xOff += perpX * warp * dt * 2.0;
    g.yOff += perpY * warp * dt * 2.0;
    g.widthScale += (1 - g.widthScale) * Math.min(1, dt * 4.2);
    g.scaleY += (1 - g.scaleY) * Math.min(1, dt * 4.0);
    if (g.life <= 0) playerGhosts.splice(i, 1);
  }
}


const keys = {};
let fireCooldown = 0;
/* =======================
   Gamepad (Xbox Controller) Support (v1.96)
   - Uses the standard Gamepad API (works in modern Chromium/Firefox).
   - Mappings (Xbox layout):
     * Move: Left Stick X / D-Pad Left-Right
     * Aim:  Right Stick (360°)
     * Shoot: RT (hold) or A (hold)
     * Bomb:  X (press) or RB (press)
     * Shield: LB (hold) or LT (hold)
     * Pause: START (press)
     * HUD toggle: BACK/VIEW (press)
     * Fullscreen: Right Stick Click (press)
     * Menus:
        - Main Menu: A = Select
        - Options: A = Apply, B = Back
        - Death Screen: A = Restart
======================= */
let gpIndex = 0;
let gpPrev = null; // previous button pressed states
let gpYViewScreenshotComboHeld = false; // Y is a combo modifier; Y + View saves a screenshot once per hold.
let gpMoveX = 0;
let gpMoveY = 0;
let gpAimX = 0;
let gpAimY = 0;
let gpFireHeld = false;
let gpShieldHeld = false;
let gpSpeedBoostHeld = false;
let gpHasAnyInput = false;
let gpIsConnected = false;

const GP_DEADZONE = 0.18;
const GP_AIM_DEADZONE = 0.22;
const GP_TRIGGER_DEADZONE = 0.35;

function gpDead(v, dz){ return (Math.abs(v) < dz) ? 0 : v; }

function getGamepad(){
  const pads = (navigator.getGamepads && navigator.getGamepads()) ? navigator.getGamepads() : [];
  if (!pads || !pads.length) return null;
  // Prefer last known index, otherwise first non-null.
  if (pads[gpIndex]) return pads[gpIndex];
  for (let i = 0; i < pads.length; i++){
    if (pads[i]){ gpIndex = i; return pads[i]; }
  }
  return null;
}

function gpBtn(gp, i){
  if (!gp || !gp.buttons || !gp.buttons[i]) return { pressed:false, value:0 };
  const b = gp.buttons[i];
  return { pressed: !!b.pressed, value: (typeof b.value === "number" ? b.value : (b.pressed ? 1 : 0)) };
}

function gpEdge(i, nowPressed){
  // true on rising edge
  const was = gpPrev ? !!gpPrev[i] : false;
  return (!!nowPressed && !was);
}

function consumeMenuAxis(direction, active, dt){
  const repeatKey = direction;
  if (!active){
    gpNavRepeat[repeatKey] = 0;
    return false;
  }
  if (gpNavRepeat[repeatKey] <= 0){
    gpNavRepeat[repeatKey] = GP_MENU_REPEAT_DELAY;
    return true;
  }
  gpNavRepeat[repeatKey] -= dt;
  if (gpNavRepeat[repeatKey] <= 0){
    gpNavRepeat[repeatKey] = GP_MENU_REPEAT_RATE;
    return true;
  }
  return false;
}

function pollGamepad(dt){
  const gp = getGamepad();
  gpIsConnected = !!gp;
  gpHasAnyInput = false;

  gpMoveX = 0;
  gpMoveY = 0;
  gpAimX = 0;
  gpAimY = 0;
  gpFireHeld = false;
  gpShieldHeld = false;
  gpSpeedBoostHeld = false;

  if (!gp){
    gpPrev = null;
    gpYViewScreenshotComboHeld = false;
    gpNavRepeat.up = gpNavRepeat.down = gpNavRepeat.left = gpNavRepeat.right = 0;
    gpNavPrevAxis.horizontal = 0;
    gpNavPrevAxis.vertical = 0;
    return;
  }

  if (!gpPrev || gpPrev.length !== gp.buttons.length){
    gpPrev = new Array(gp.buttons.length).fill(false);
  }

  const ax0 = gp.axes && gp.axes.length > 0 ? gp.axes[0] : 0;
  const ax1 = gp.axes && gp.axes.length > 1 ? gp.axes[1] : 0;
  const ax2 = gp.axes && gp.axes.length > 2 ? gp.axes[2] : 0;
  const ax3 = gp.axes && gp.axes.length > 3 ? gp.axes[3] : 0;

  const lx = gpDead(ax0, GP_DEADZONE);
  const ly = gpDead(ax1, GP_DEADZONE);
  const rx = gpDead(ax2, GP_AIM_DEADZONE);
  const ry = gpDead(ax3, GP_AIM_DEADZONE);

  const dUp = getGpActionPressed(gp, 'moveUp');
  const dDown = getGpActionPressed(gp, 'moveDown');
  const dLeft = getGpActionPressed(gp, 'moveLeft');
  const dRight = getGpActionPressed(gp, 'moveRight');

  gpMoveX = Math.max(-1, Math.min(1, lx + (dLeft ? -1 : 0) + (dRight ? 1 : 0)));
  gpMoveY = Math.max(-1, Math.min(1, ly + (dUp ? -1 : 0) + (dDown ? 1 : 0)));
  gpAimX = rx;
  gpAimY = ry;

  const lt = gpBtn(gp, 6).value;
  const rt = gpBtn(gp, 7).value;
  const a = gpBtn(gp, 0).pressed;
  const b = gpBtn(gp, 1).pressed;
  const x = gpBtn(gp, 2).pressed;
  const y = gpBtn(gp, 3).pressed;
  const lb = gpBtn(gp, 4).pressed;
  const rb = gpBtn(gp, 5).pressed;
  const back = gpBtn(gp, 8).pressed;
  const start = gpBtn(gp, 9).pressed;
  const lStick = gpBtn(gp, 10).pressed;
  const rStick = gpBtn(gp, 11).pressed;

  gpFireHeld = getGpActionPressed(gp, 'shoot');
  gpShieldHeld = getGpActionPressed(gp, 'shield');
  gpSpeedBoostHeld = lStick;

  if (Math.abs(lx) > 0.01 || Math.abs(ly) > 0.01 || Math.abs(rx) > 0.01 || Math.abs(ry) > 0.01 || lt > 0.05 || rt > 0.05 || dUp || dDown || dLeft || dRight || a || b || x || y || lb || rb || back || start || lStick || rStick){
    gpHasAnyInput = true;
    setActiveInputMode(INPUT_MODE_CONTROLLER);
  }

  const pressPause = gpEdge(controllerBindings.pause, getGpActionPressed(gp, 'pause'));
  const commandsHeld = getGpActionPressed(gp, 'commands');
  const pressCommands = gpEdge(controllerBindings.commands, commandsHeld);
  const pressMenuBack = gpEdge(controllerBindings.menuBack, getGpActionPressed(gp, 'menuBack'));
  const pressMenuSelect = gpEdge(controllerBindings.menuSelect, getGpActionPressed(gp, 'menuSelect'));
  const pressFullscreen = gpEdge(controllerBindings.fullscreen, getGpActionPressed(gp, 'fullscreen'));
  const pressBomb = gpEdge(controllerBindings.bomb, getGpActionPressed(gp, 'bomb'));
  const pressListTop = gpEdge(4, lb);
  const pressListBottom = gpEdge(5, rb);
  const pressMuteHud = false;
  const yComboModifierHeld = y;
  const pressY = false;
  const viewSuppressedByY = yComboModifierHeld;
  // Y is reserved as a combo modifier. Y alone does nothing.
  // Y + View saves a screenshot once per hold. Future Y + D-pad combos can hook into yComboModifierHeld here.
  const yViewScreenshotComboHeld = yComboModifierHeld && commandsHeld;
  const pressScreenshotCombo = yViewScreenshotComboHeld && !gpYViewScreenshotComboHeld;
  gpYViewScreenshotComboHeld = yViewScreenshotComboHeld;

  if ((gpHasAnyInput || pressMenuSelect || pressMenuBack || pressCommands || pressY || pressScreenshotCombo || pressPause || pressFullscreen || pressBomb || pressListTop || pressListBottom) && !audioUnlocked){
    unlockAudioOnce();
  }

  if (pressScreenshotCombo){
    if (!requestParentPageScreenshot("Level 2")){
      saveCurrentGameImage("Level 2");
    }
  }

  const navUp = consumeMenuAxis('up', dUp || ly < -GP_MENU_AXIS_THRESHOLD, dt);
  const navDown = consumeMenuAxis('down', dDown || ly > GP_MENU_AXIS_THRESHOLD, dt);
  const navLeft = consumeMenuAxis('left', dLeft || lx < -GP_MENU_AXIS_THRESHOLD, dt);
  const navRight = consumeMenuAxis('right', dRight || lx > GP_MENU_AXIS_THRESHOLD, dt);
  const chatRepeatDelay = parentChatValuePickerActive
    ? (parentChatValuePickerCommand === "/shoot" ? GP_CHAT_SHOOT_REPEAT_DELAY : GP_CHAT_VALUE_REPEAT_DELAY)
    : GP_MENU_REPEAT_DELAY;
  const chatRepeatRate = parentChatValuePickerActive
    ? (parentChatValuePickerCommand === "/shoot" ? GP_CHAT_SHOOT_REPEAT_RATE : GP_CHAT_VALUE_REPEAT_RATE)
    : GP_MENU_REPEAT_RATE;
  const chatNavUp = consumeMenuAxis('chatUp', dUp || ly < -GP_MENU_AXIS_THRESHOLD, dt, chatRepeatDelay, chatRepeatRate);
  const chatNavDown = consumeMenuAxis('chatDown', dDown || ly > GP_MENU_AXIS_THRESHOLD, dt, chatRepeatDelay, chatRepeatRate);
  const chatNavLeft = consumeMenuAxis('chatLeft', dLeft || lx < -GP_MENU_AXIS_THRESHOLD, dt, chatRepeatDelay, chatRepeatRate);
  const chatNavRight = consumeMenuAxis('chatRight', dRight || lx > GP_MENU_AXIS_THRESHOLD, dt, chatRepeatDelay, chatRepeatRate);
  const rNavUp = consumeMenuAxis('rUp', ry < -GP_MENU_AXIS_THRESHOLD, dt, GP_OPTION_REPEAT_DELAY, GP_OPTION_REPEAT_RATE);
  const rNavDown = consumeMenuAxis('rDown', ry > GP_MENU_AXIS_THRESHOLD, dt, GP_OPTION_REPEAT_DELAY, GP_OPTION_REPEAT_RATE);

  if (deathOverlay && deathOverlay.style.display === "flex"){
    if (navUp) moveDeathControllerFocus(-1);
    if (navDown) moveDeathControllerFocus(1);
    if (pressMenuSelect) activateDeathControllerFocus();
    // B/back intentionally does nothing on the death screen to avoid accidental menu quits.
    return;
  }


  if (bindingEditState && bindingEditState.scheme === INPUT_MODE_CONTROLLER){
    const anyPressedNow = gp.buttons.some((btn, idx) => idx <= 15 && getGpButtonPressedByIndex(gp, idx));
    if (!controllerRebindReady){
      if (!anyPressedNow) controllerRebindReady = true;
    } else {
      for (let idx = 0; idx < gp.buttons.length && idx <= 15; idx++){
        if (getGpButtonPressedByIndex(gp, idx)){
          applyBindingValue(INPUT_MODE_CONTROLLER, bindingEditState.action, idx);
          break;
        }
      }
    }
  } else {
    if (pressFullscreen){
      toggleFullscreen();
    }
    if (pressCommands && !viewSuppressedByY){
      requestOpenChat(false, "/help");
    }
    if (isPaused && parentChatVisible){
      if (chatNavUp) postChatControllerAction('cycleUp');
      if (chatNavDown) postChatControllerAction('cycleDown');
      if (chatNavLeft) postChatControllerAction('cycleLeft');
      if (chatNavRight) postChatControllerAction('cycleRight');
      if (rNavUp) postChatControllerAction('scrollUp');
      if (rNavDown) postChatControllerAction('scrollDown');
      if (pressMenuSelect) postChatControllerAction('execute');
      if (pressMenuBack){
        postChatControllerAction('close');
        togglePause();
      }
    } else if (isPauseScoreStoreOpen()){
      if (pressListTop) jumpControllerFocusToListEdge(getScoreStoreControllerTargets(), scoreStoreFocusIndex, (index) => { scoreStoreFocusIndex = index; }, syncScoreStoreControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getScoreStoreControllerTargets(), scoreStoreFocusIndex, (index) => { scoreStoreFocusIndex = index; }, syncScoreStoreControllerFocus, 1);
      if (navLeft) moveScoreStoreControllerFocusGrid(-1);
      if (navRight) moveScoreStoreControllerFocusGrid(1);
      if (navUp) moveScoreStoreControllerFocusGrid(-SCORE_STORE_GRID_COLUMNS);
      if (navDown) moveScoreStoreControllerFocusGrid(SCORE_STORE_GRID_COLUMNS);
      if (pressMenuSelect) activateControllerTarget(getScoreStoreControllerTargets()[scoreStoreFocusIndex]);
      if (pressMenuBack) handleScoreStoreControllerBackButton();
      if (pressPause) togglePause();
    } else if (isPauseSelectLevelOpen()){
      if (pressListTop) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, 1);
      if (navUp) moveOptionsControllerFocus(-1);
      if (navDown) moveOptionsControllerFocus(1);
      if (navLeft) moveOptionsControllerFocus(-1);
      if (navRight) moveOptionsControllerFocus(1);
      if (pressMenuSelect) activateControllerTarget(getOptionsControllerTargets()[optionsFocusIndex]);
      if (pressMenuBack) handleOptionsControllerBackButton();
      if (pressPause) activateControllerTarget(btnBack);
    } else if (isPaused && gameState !== STATE.OPTIONS){
      if (pauseControlsOpen){
        if (pressListTop) jumpControllerFocusToListEdge(getControlsControllerTargets(), controlsFocusIndex, (index) => { controlsFocusIndex = index; }, syncControlsControllerFocus, -1);
        if (pressListBottom) jumpControllerFocusToListEdge(getControlsControllerTargets(), controlsFocusIndex, (index) => { controlsFocusIndex = index; }, syncControlsControllerFocus, 1);
        if (navUp || navLeft) moveControlsControllerFocus(-1);
        if (navDown || navRight) moveControlsControllerFocus(1);
        if (pressMenuSelect) activateControllerTarget(getControlsControllerTargets()[controlsFocusIndex]);
        if (pressMenuBack){
          if (bindingEditState) cancelBindingEdit();
          else handleControlsControllerBackButton();
        }
        if (pressPause) togglePause();
      } else {
        if (pressListTop) jumpControllerFocusToListEdge(getPauseControllerTargets(), pauseFocusIndex, (index) => { pauseFocusIndex = index; }, syncPauseControllerFocus, -1);
        if (pressListBottom) jumpControllerFocusToListEdge(getPauseControllerTargets(), pauseFocusIndex, (index) => { pauseFocusIndex = index; }, syncPauseControllerFocus, 1);
        if (navUp || navLeft) movePauseControllerFocus(-1);
        if (navDown || navRight) movePauseControllerFocus(1);
        if (pressMenuSelect) activateControllerTarget(getPauseControllerTargets()[pauseFocusIndex]);
        if (pressMenuBack) togglePause();
        if (pressPause) togglePause();
      }
    } else if (gameState === STATE.MENU){
      if (navLeft){
        if (menuFocusIndex === 1) menuFocusIndex = 0;
        else if (menuFocusIndex === 2) menuFocusIndex = 0;
        if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
      }
      if (navRight){
        if (menuFocusIndex === 0) menuFocusIndex = 1;
        else if (menuFocusIndex === 2) menuFocusIndex = 1;
        if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
      }
      if (navDown){
        if (menuFocusIndex === 0 || menuFocusIndex === 1) menuFocusIndex = 2;
        else menuFocusIndex = 0;
        if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
      }
      if (navUp){
        if (menuFocusIndex === 2) menuFocusIndex = 0;
        else menuFocusIndex = 2;
        if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
      }
      if (pressMenuSelect) activateControllerTarget(getMenuControllerTargets()[menuFocusIndex]);
      if (pressMenuBack && bindingEditState) cancelBindingEdit();
    } else if (gameState === STATE.OPTIONS){
      if (pressListTop) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, 1);
      // Level 2 Select Level can be opened while paused. Keep controller focus on
      // the visible Select Level buttons, not the hidden pause menu buttons.
      if (navUp) moveOptionsControllerFocus(-1);
      if (navDown) moveOptionsControllerFocus(1);
      if (navLeft) moveOptionsControllerFocus(-1);
      if (navRight) moveOptionsControllerFocus(1);
      if (pressMenuSelect) activateControllerTarget(getOptionsControllerTargets()[optionsFocusIndex]);
      if (pressMenuBack) handleOptionsControllerBackButton();
    } else if (gameState === STATE.CONTROLS){
      if (pressListTop) jumpControllerFocusToListEdge(getControlsControllerTargets(), controlsFocusIndex, (index) => { controlsFocusIndex = index; }, syncControlsControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getControlsControllerTargets(), controlsFocusIndex, (index) => { controlsFocusIndex = index; }, syncControlsControllerFocus, 1);
      if (navUp) moveControlsControllerFocus(-1);
      if (navDown) moveControlsControllerFocus(1);
      if (isControlsMoveFocused()){
        if (navLeft) moveControlsMoveFocus(-1);
        if (navRight) moveControlsMoveFocus(1);
      } else {
        if (navLeft) moveControlsControllerFocus(-1);
        if (navRight) moveControlsControllerFocus(1);
      }
      if (pressMenuSelect) activateControllerTarget(getControlsControllerTargets()[controlsFocusIndex]);
      if (pressMenuBack){
        if (bindingEditState) cancelBindingEdit();
        else handleControlsControllerBackButton();
      }
    } else if (deathOverlay && deathOverlay.style.display === "flex"){
      if (pressMenuSelect) restartRun();
    } else if (gameState === STATE.PLAYING){
      if (pressPause) togglePause();
      if (pressBomb) dropBomb();
    }
  }

  for (let i = 0; i < gp.buttons.length; i++){
    gpPrev[i] = !!(gp.buttons[i] && gp.buttons[i].pressed);
  }
}

window.addEventListener("gamepadconnected", (e) => {
  try{
    gpIndex = e.gamepad && typeof e.gamepad.index === "number" ? e.gamepad.index : gpIndex;
  }catch(_){}
});

/* =======================
   Aim (v1.96: 360° aim)
   - Mouse / touch sets an aim point.
   - We smooth the aim angle so the triangle feels less twitchy.
======================= */
let aimX = 0;
let aimY = 0;
let aimAngle = -Math.PI/2;
let aimAngleSmoothed = -Math.PI/2;

function setAimFromClient(clientX, clientY, options = null){
  const r = canvas.getBoundingClientRect();
  aimX = clientX - r.left;
  aimY = clientY - r.top;
  aimAngle = Math.atan2(aimY - player.y, aimX - player.x);
  if (options && options.immediate) aimAngleSmoothed = aimAngle;
}

function isTouchPointerEvent(event){
  return !!(event && event.pointerType === "touch");
}

/* =======================
   Enemy Images from enemy-webps.json
======================= */
let enemyImages = [];
let assetsReady = false;

const FALLBACK_URLS = [
  BOSS_IMG_URL
];

function preloadImages(urls){
  return new Promise((resolve) => {
    const imgs = [];
    let done = 0;
    if (!urls.length) resolve(imgs);

    urls.forEach((url) => {
      const img = new Image();
      img.onload = () => { done++; if (done === urls.length) resolve(imgs); };
      img.onerror = () => { done++; if (done === urls.length) resolve(imgs); };
      img.src = url;
      imgs.push(img);
    });
  });
}

async function loadEnemyImagesFromEnemyWebpsJson(){
  try{    const res = await fetch(ENEMY_WEBP_INDEX_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);

    const list = await res.json();
    if (!Array.isArray(list)) throw new Error("enemy-webps.json not an array");

    const urls = list
      .filter(name => typeof name === "string" && name.toLowerCase().endsWith(".webp"))
      .map(name => name.startsWith("/") ? name : ENEMY_WEBP_BASE + name);

    if (!urls.length) throw new Error("No webps in enemy-webps.json");

    setAssetStatus("");
    let imgs = await preloadImages(urls);
    imgs = imgs.filter(img => img && img.naturalWidth > 0);
    if (!imgs.length) throw new Error("All enemy images failed to load");

    enemyImages = imgs;
    assetsReady = true;
    setAssetStatus("");
  }catch(err){
    console.warn("Failed to load enemy-webps.json enemy list:", err);
    setAssetStatus("Enemy WebPs failed to load. Using fallback enemy image.");
    let imgs = await preloadImages(FALLBACK_URLS);
    enemyImages = imgs.filter(img => img && img.naturalWidth > 0);
    assetsReady = true;
  }
}
loadEnemyImagesFromEnemyWebpsJson();

/* =======================
   Enemies + Formation Movement
======================= */
const BASE_SPACING_X = 105;

let enemies = [];

// =======================
// Procedural Maze Mode (v2.0 retrofit)
// - Player stays visually fixed in the center while traversing a generated maze.
// - Enemy systems, bullets, damage tracking, timer, and lives all remain in the build,
//   but regular wave spawns are disabled for now.
// =======================
let maze = null;
let mazeCompleted = false;
let playerWorldX = 0;
let playerWorldY = 0;
let mazeExitPulse = 0;
let mazeVisitedTiles = new Set();
let mazeWalkableTileCount = 0;
let mazeSummaryActive = false;
let mazePendingNextWave = null;
const MAZE_VISITED_TILE_FILL = "rgba(0,255,102,0.50)";
const MAZE_VISITED_TILE_STROKE = "rgba(180,255,200,0.38)";
const MAZE_CURRENT_TILE_FILL = "rgba(180,255,200,0.24)";

// v2.08: The walked path is drawn after the fog pass so the shadow layer cannot hide it.
function drawMazeVisitedTileTrail(camX, camY){
  if (!maze || !mazeVisitedTiles || !mazeVisitedTiles.size) return;
  ctx.save();
  for (const key of mazeVisitedTiles){
    const comma = key.indexOf(",");
    if (comma < 0) continue;
    const c = Number(key.slice(0, comma));
    const r = Number(key.slice(comma + 1));
    if (!Number.isFinite(c) || !Number.isFinite(r)) continue;
    if (!maze.grid[r] || maze.grid[r][c] !== 0) continue;

    const sx = c * maze.cellSize - camX;
    const sy = r * maze.cellSize - camY;
    if (sx > canvas.width || sy > canvas.height || sx + maze.cellSize < 0 || sy + maze.cellSize < 0) continue;

    ctx.fillStyle = MAZE_VISITED_TILE_FILL;
    ctx.fillRect(sx, sy, maze.cellSize, maze.cellSize);
    ctx.strokeStyle = MAZE_VISITED_TILE_STROKE;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 2.5, sy + 2.5, maze.cellSize - 5, maze.cellSize - 5);
  }
  ctx.restore();
}

// v2.07: Maze enemies roam in world-space and only chase within a limited proximity.
const MAZE_ENEMY_MIN = 5;
const MAZE_ENEMY_MAX = 26;
const MAZE_ENEMY_SAFE_CELLS_FROM_START = 2;
const MAZE_ENEMY_SAFE_CELLS_FROM_EXIT = 2;

function getMazeSpecForWave(w){
  const clamped = Math.max(1, Math.min(21, w|0));
  const tier = Math.max(1, Math.min(10, clamped));

  // v2.03: Maze tiles are intentionally huge now.
  // Each tile is about 5x the player size so the maze feels like oversized rooms/corridors,
  // not a dense little grid crawling all over the screen.
  const cellSize = Math.max(320, Math.round(player.w * 5));
  const revealRadiusPx = Math.round(player.w * 3);

  let cols = 7 + tier * 2;
  let rows = 5 + tier * 2;

  if (clamped === 11){
    cols = 29; rows = 23;
  } else if (clamped > 11){
    const insanityTier = clamped - 11;
    cols = 15 + insanityTier * 2;
    rows = 11 + insanityTier * 2;
  }

  if (cols % 2 === 0) cols += 1;
  if (rows % 2 === 0) rows += 1;

  return { cols, rows, cellSize, revealRadiusPx };
}

function carveMazeGrid(cols, rows){
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  const stack = [];
  const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
  const start = { x: 1, y: 1 };
  grid[start.y][start.x] = 0;
  stack.push(start);

  while (stack.length){
    const cur = stack[stack.length - 1];
    const neighbors = [];
    for (const [dx, dy] of dirs){
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1){
        neighbors.push({ x: nx, y: ny, wx: cur.x + dx / 2, wy: cur.y + dy / 2 });
      }
    }
    if (!neighbors.length){
      stack.pop();
      continue;
    }
    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    grid[next.wy][next.wx] = 0;
    grid[next.y][next.x] = 0;
    stack.push({ x: next.x, y: next.y });
  }

  return grid;
}

function openMazeLoops(grid, loops){
  const rows = grid.length;
  const cols = grid[0].length;
  let opened = 0;
  let attempts = 0;
  while (opened < loops && attempts < loops * 24){
    attempts += 1;
    const x = 1 + Math.floor(Math.random() * (cols - 2));
    const y = 1 + Math.floor(Math.random() * (rows - 2));
    if (grid[y][x] !== 1) continue;
    const horiz = (grid[y][x-1] === 0 && grid[y][x+1] === 0);
    const vert = (grid[y-1][x] === 0 && grid[y+1][x] === 0);
    if (horiz || vert){
      grid[y][x] = 0;
      opened += 1;
    }
  }
}

function getMazeTileKey(c, r){
  return c + "," + r;
}

function markCurrentMazeTileStepped(){
  if (!maze) return;
  const c = Math.max(0, Math.min(maze.cols - 1, Math.floor(playerWorldX / maze.cellSize)));
  const r = Math.max(0, Math.min(maze.rows - 1, Math.floor(playerWorldY / maze.cellSize)));
  if (maze.grid[r] && maze.grid[r][c] === 0){
    mazeVisitedTiles.add(getMazeTileKey(c, r));
  }
}

function countMazeWalkableTiles(){
  if (!maze) return 0;
  let total = 0;
  for (let r = 0; r < maze.rows; r++){
    for (let c = 0; c < maze.cols; c++){
      if (maze.grid[r][c] === 0) total += 1;
    }
  }
  return total;
}

function showMazeSummaryAndPauseAdvance(){
  if (!maze || mazeSummaryActive) return;
  const stepped = mazeVisitedTiles.size;
  const total = mazeWalkableTileCount || countMazeWalkableTiles();
  const missed = Math.max(0, total - stepped);
  const bonus = stepped * 10;
  if (!scoreTrackingDisabled){
    score += bonus;
    if (Math.floor(score) >= STORE_UNLOCK_SCORE_THRESHOLD) scoreStoreUnlockedThisRun = true;
  }
  updateAccuracyScoreHUD();

  mazeSummaryActive = true;
  mazePendingNextWave = wave + 1;
  if (mazeSummaryCoverage) mazeSummaryCoverage.textContent = `Coverage: ${stepped} / ${total} tiles stepped on`;
  if (mazeSummaryMissed) mazeSummaryMissed.textContent = `Unstepped tiles: ${missed}`;
  if (mazeSummaryBonus) mazeSummaryBonus.textContent = scoreTrackingDisabled ? "Score disabled for this run" : `+${bonus} points`;
  if (mazeSummaryOverlay) mazeSummaryOverlay.style.display = "flex";
}

function advanceToNextMaze(){
  if (!mazeSummaryActive) return;
  const nextWave = mazePendingNextWave;
  mazeSummaryActive = false;
  mazePendingNextWave = null;
  if (mazeSummaryOverlay) mazeSummaryOverlay.style.display = "none";

  if (typeof nextWave !== "number") return;
  wave = nextWave;
  showWaveBanner(wave);
  resetFormation();
  spawnEnemies();
  trySpawnUFO();
}

function makeMazeForWave(w){
  const spec = getMazeSpecForWave(w);
  const grid = carveMazeGrid(spec.cols, spec.rows);
  const loopCount = Math.max(3, Math.floor((Math.min(10, Math.max(1, w)) - 1) * 2.2));
  openMazeLoops(grid, loopCount);
  const startCell = { x: 1, y: 1 };
  const exitCell = { x: spec.cols - 2, y: spec.rows - 2 };
  grid[startCell.y][startCell.x] = 0;
  grid[exitCell.y][exitCell.x] = 0;
  return {
    ...spec,
    grid,
    startCell,
    exitCell,
    wallColor: w === 11 ? 'rgba(0,255,102,0.30)' : 'rgba(0,255,102,0.18)',
    floorColor: 'rgba(255,255,255,0.022)',
    gridLineColor: 'rgba(255,255,255,0.028)'
  };
}

function resetMazeForWave(w){
  maze = makeMazeForWave(w);
  mazeCompleted = false;
  mazeExitPulse = 0;
  mazeSummaryActive = false;
  if (mazeSummaryOverlay) mazeSummaryOverlay.style.display = "none";
  enemies = [];
  playerWorldX = (maze.startCell.x + 0.5) * maze.cellSize;
  playerWorldY = (maze.startCell.y + 0.5) * maze.cellSize;
  mazeVisitedTiles = new Set();
  mazeWalkableTileCount = countMazeWalkableTiles();
  markCurrentMazeTileStepped();
}

function getMazeWalkableCells(){
  if (!maze) return [];
  const out = [];
  for (let r = 0; r < maze.rows; r++){
    for (let c = 0; c < maze.cols; c++){
      if (maze.grid[r][c] !== 0) continue;
      const startDist = Math.abs(c - maze.startCell.x) + Math.abs(r - maze.startCell.y);
      const exitDist = Math.abs(c - maze.exitCell.x) + Math.abs(r - maze.exitCell.y);
      if (startDist <= MAZE_ENEMY_SAFE_CELLS_FROM_START) continue;
      if (exitDist <= MAZE_ENEMY_SAFE_CELLS_FROM_EXIT) continue;
      out.push({ x:c, y:r });
    }
  }
  return out;
}

function spawnMazeEnemiesForWave(w){
  if (!maze) return;
  const walkable = getMazeWalkableCells();
  if (!walkable.length) return;

  const densityBase = Math.floor((maze.cols * maze.rows) / 20);
  const desired = Math.max(MAZE_ENEMY_MIN, Math.min(MAZE_ENEMY_MAX, densityBase + Math.floor(Math.random() * 5) - 2 + Math.floor(w * 0.55)));
  const shuffled = walkable.slice().sort(() => Math.random() - 0.5);
  const used = [];
  const minCellSeparation = Math.max(1, Math.min(4, Math.round(maze.cols / 10)));

  for (const cell of shuffled){
    if (used.length >= desired) break;
    let tooClose = false;
    for (const u of used){
      const d = Math.abs(u.x - cell.x) + Math.abs(u.y - cell.y);
      if (d < minCellSeparation){
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    used.push(cell);

    const cx = (cell.x + 0.5) * maze.cellSize + rand(-maze.cellSize * 0.18, maze.cellSize * 0.18);
    const cy = (cell.y + 0.5) * maze.cellSize + rand(-maze.cellSize * 0.18, maze.cellSize * 0.18);
    const img = assetsReady && enemyImages.length ? randEnemyImg() : playerImg;
    const size = Math.max(34, Math.min(72, player.w * rand(0.88, 1.18)));
    const chaseRadius = maze.cellSize * rand(1.25, 1.9);
    const dropRadius = chaseRadius * rand(1.2, 1.45);

    enemies.push({
      row: cell.y,
      col: cell.x,
      baseY: 0,
      img,
      isFrog: false,
      size,
      hp: 1,
      hitFlash: 0,
      dying: false,
      fade: 1,
      fadeRate: 0,
      lockX: 0, lockY: 0, lockW: 0, lockH: 0,
      _killAwarded: false,
      x: -9999, y: -9999, w: size, h: size,
      fx: 0, fy: 0,
      swoop: null,
      swoopCooldown: 9999,
      mazeMob: true,
      worldX: cx,
      worldY: cy,
      homeX: cx,
      homeY: cy,
      moveSpeed: rand(105, 175),
      chaseRadius,
      dropRadius,
      chaseFalloff: rand(0.28, 0.58),
      isChasing: false
    });
  }
}

function updateMazeEnemies(dt){
  if (!(maze && enemies.length)) return;

  const camX = playerWorldX - canvas.width / 2;
  const camY = playerWorldY - canvas.height / 2;

  for (const e of enemies){
    if (!e || !e.mazeMob || e.dying) continue;

    const toPlayerX = playerWorldX - e.worldX;
    const toPlayerY = playerWorldY - e.worldY;
    const distToPlayer = Math.hypot(toPlayerX, toPlayerY) || 0.0001;

    if (distToPlayer <= e.chaseRadius){
      e.isChasing = true;
    } else if (distToPlayer >= e.dropRadius){
      e.isChasing = false;
    }

    let targetX = e.homeX;
    let targetY = e.homeY;
    let speedMul = 0.55;

    if (e.isChasing){
      const t = Math.max(0, 1 - (distToPlayer / e.chaseRadius));
      const chaseStrength = Math.max(0.15, t * (1 - e.chaseFalloff) + 0.15);
      targetX = playerWorldX;
      targetY = playerWorldY;
      speedMul = 0.62 + chaseStrength;
    }

    const dx = targetX - e.worldX;
    const dy = targetY - e.worldY;
    const d = Math.hypot(dx, dy) || 0.0001;
    let step = e.moveSpeed * speedMul * dt;

    if (!e.isChasing && d < 8){
      step = 0;
    }

    if (step > 0){
      const nx = dx / d;
      const ny = dy / d;
      const tryX = e.worldX + nx * step;
      const tryY = e.worldY + ny * step;
      const radius = Math.max(10, e.size * 0.22);

      if (canOccupyWorld(tryX, e.worldY, radius)) e.worldX = tryX;
      if (canOccupyWorld(e.worldX, tryY, radius)) e.worldY = tryY;
    }

    e.x = e.worldX - camX;
    e.y = e.worldY - camY;
    e.w = e.size;
    e.h = e.size;
    e.fx = e.x;
    e.fy = e.y;
  }
}

function isWallAtWorld(x, y){
  if (!maze) return false;
  const c = Math.floor(x / maze.cellSize);
  const r = Math.floor(y / maze.cellSize);
  if (r < 0 || r >= maze.rows || c < 0 || c >= maze.cols) return true;
  return maze.grid[r][c] === 1;
}

function canOccupyWorld(x, y, radius){
  if (!maze) return true;
  const pts = [
    [x - radius, y - radius], [x + radius, y - radius],
    [x - radius, y + radius], [x + radius, y + radius],
    [x, y - radius], [x, y + radius], [x - radius, y], [x + radius, y]
  ];
  return pts.every(([px, py]) => !isWallAtWorld(px, py));
}

function getMazePlayerRadius(){
  return Math.max(8, Math.min(player.w, player.h) * 0.22);
}

function moveMazePlayer(dx, dy){
  if (!maze) return;
  const radius = getMazePlayerRadius();
  const speed = player.speed * 60;
  const stepX = dx * speed;
  const stepY = dy * speed;
  const nx = playerWorldX + stepX;
  const ny = playerWorldY + stepY;

  if (canOccupyWorld(nx, playerWorldY, radius)) playerWorldX = nx;
  if (canOccupyWorld(playerWorldX, ny, radius)) playerWorldY = ny;
  markCurrentMazeTileStepped();

  const exitX = (maze.exitCell.x + 0.5) * maze.cellSize;
  const exitY = (maze.exitCell.y + 0.5) * maze.cellSize;
  if (Math.hypot(playerWorldX - exitX, playerWorldY - exitY) <= maze.cellSize * 0.35){
    mazeCompleted = true;
  }
}

function drawMaze(){
  if (!(gameState === STATE.PLAYING && maze)) return;
  const camX = playerWorldX - canvas.width / 2;
  const camY = playerWorldY - canvas.height / 2;
  const currentCol = Math.max(0, Math.min(maze.cols - 1, Math.floor(playerWorldX / maze.cellSize)));
  const currentRow = Math.max(0, Math.min(maze.rows - 1, Math.floor(playerWorldY / maze.cellSize)));
  ctx.save();

  for (let r = 0; r < maze.rows; r++){
    for (let c = 0; c < maze.cols; c++){
      const sx = c * maze.cellSize - camX;
      const sy = r * maze.cellSize - camY;
      if (sx > canvas.width || sy > canvas.height || sx + maze.cellSize < 0 || sy + maze.cellSize < 0) continue;

      const isCurrentTile = (r === currentRow && c === currentCol);
      const isExitTile = (r === maze.exitCell.y && c === maze.exitCell.x);
      const isWall = maze.grid[r][c] === 1;

      if (!isWall){
        ctx.fillStyle = maze.floorColor;
        ctx.fillRect(sx, sy, maze.cellSize, maze.cellSize);
        ctx.strokeStyle = maze.gridLineColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, maze.cellSize - 1, maze.cellSize - 1);
      } else {
        ctx.fillStyle = maze.wallColor;
        ctx.fillRect(sx, sy, maze.cellSize, maze.cellSize);
        ctx.strokeStyle = 'rgba(0,255,102,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, maze.cellSize - 1, maze.cellSize - 1);
      }

      if (isExitTile){
        mazeExitPulse += 0.05;
        ctx.save();
        ctx.fillStyle = 'rgba(255,215,0,0.18)';
        ctx.fillRect(sx, sy, maze.cellSize, maze.cellSize);
        ctx.strokeStyle = `rgba(255,215,0,${0.48 + 0.28 * Math.sin(mazeExitPulse)})`;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(sx + 3, sy + 3, maze.cellSize - 6, maze.cellSize - 6);
        ctx.restore();
      }
    }
  }

  // Soft spotlight / haze mask so only a circular region around the player is visible.
  const revealRadius = (maze.revealRadiusPx || Math.round(player.w * 3));
  const outerRadius = revealRadius * 1.65;
  const fog = ctx.createRadialGradient(player.x, player.y, revealRadius * 0.48, player.x, player.y, outerRadius);
  fog.addColorStop(0, 'rgba(0,0,0,0.00)');
  fog.addColorStop(0.42, 'rgba(0,0,0,0.10)');
  fog.addColorStop(0.72, 'rgba(0,0,0,0.56)');
  fog.addColorStop(1, 'rgba(0,0,0,0.96)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // A faint inner haze ring to make the spotlight feel softer and less geometric.
  const glow = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, revealRadius * 1.05);
  glow.addColorStop(0, 'rgba(255,255,255,0.025)');
  glow.addColorStop(0.5, 'rgba(255,255,255,0.010)');
  glow.addColorStop(1, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawMazeVisitedTileTrail(camX, camY);

  // Keep the current tile a touch brighter than the already-walked trail.
  const currentSx = currentCol * maze.cellSize - camX;
  const currentSy = currentRow * maze.cellSize - camY;
  ctx.fillStyle = MAZE_CURRENT_TILE_FILL;
  ctx.fillRect(currentSx + 4, currentSy + 4, maze.cellSize - 8, maze.cellSize - 8);

  ctx.restore();
}


const formation = { xOffset:0, yOffset:0, dir:1, speed:1.2, stepDown:18, descentSpeed:12, boundsPad:40 };

function resetFormation(){
  formation.xOffset = 0;
  formation.yOffset = 0;
  formation.dir = 1;

  // v1.96: challenge/fun rebalance.
  // Horizontal sweep ramps, but capped so it stays readable.
  formation.speed = (0.95 + (wave-1) * 0.09) * FUNK;
  formation.speed = Math.min(2.2, formation.speed);

  // Step-down stays modest (most threat comes from swoops + bullets, not a doom-wall).
  formation.stepDown = 10 + Math.min(10, (wave-1) * 0.75);

  // Gentle downward pressure, capped hard to keep enemies mostly in the top zone.
  formation.descentSpeed = 3.5 + Math.min(10, (wave-1) * 1.25);
}

// v1.96: When an enemy dies, re-pack the remaining enemies into a tidy rectangle
// v1.96: Disabled by default because it turns the game into 'hold fire in one lane to win' mode.
// (no "missing tooth" gaps in the grid).
function compactEnemyGrid(){
  const count = enemies.length;
  if (!count){
    formationCols = 1;
    formationRows = 1;
    return;
  }

  // Mirror the spawn-time packing logic, but WITHOUT nuking the wave.
  const zoneW = canvas.width * 0.82;
  const zoneH = canvas.height * 0.38;

  const idealCols = Math.ceil(Math.sqrt(count * (zoneW / Math.max(1, zoneH))));
  formationCols = Math.max(1, Math.min(count, idealCols));
  formationRows = Math.max(1, Math.ceil(count / formationCols));

  // Re-assign slots in order so the formation closes ranks.
  for (let i = 0; i < enemies.length; i++){
    enemies[i].row = Math.floor(i / formationCols);
    enemies[i].col = i % formationCols;
  }
}


function randEnemyImg(){
  if (!enemyImages.length) return playerImg;
  return enemyImages[Math.floor(Math.random() * enemyImages.length)];
}

function spawnBossWave11(additive=false){
  // additive=true means "spawn the boss group on top of whatever enemies already exist"
  // (used for waves 12+). In that case we must NOT wipe the current wave's enemies or
  // clobber the formation grid settings.
  const prevEnemies = enemies;
  const prevCols = formationCols;
  const prevRows = formationRows;

  if (!additive){
    enemies = [];
    // Boss wave doesn't use the grid for gameplay, but other code expects these.
    formationCols = 1;
    formationRows = 1;
  }

  const baseY = 110; // keep boss in the top zone

  const zoneW = canvas.width * 0.82;
  const zoneH = canvas.height * 0.38;

  // Base "normal enemy" sizing in this zone.
  const baseSize = Math.max(26, Math.min(62, Math.min(zoneW/12, zoneH/7)));

  // Boss: noticeably bigger than everything else (requested).
  const isFirstBoss = !firstBossSpawned;
  const bossSize = isFirstBoss
    ? Math.max(baseSize * 4.0, 130)   // big intro boss
    : Math.max(baseSize * 2.0, 65);   // smaller recurring boss
  firstBossSpawned = true;

  const bossImg = new Image();
  bossImg.src = BOSS_IMG_URL;

  // Shared HP for core + orbiters (requested).
  const BOSS_HP = isFirstBoss
    ? 9   // big first boss = 3x hits
    : 1;  // small recurring bosses = 1 hit

  // Core boss: uses normal enemy damage system, but has more HP.
  const boss = {
    row:0, col:0, baseY,
    img: bossImg,
    isFrog:false,
    size: bossSize,
    hp: BOSS_HP,
    hitFlash:0,
    dying:false,
    fade:1,
    fadeRate:0,
    lockX:0, lockY:0, lockW:0, lockH:0,
    _killAwarded:false,
    x: canvas.width/2, y: baseY + 40, w:0, h:0,
    fx:0, fy:0,
    swoop:null,
    swoopCooldown: 9999,
    // Boss-wave behaviour flags/state
    isBossCore:true,
    bossWave:true,
    // Sporadic movement
    mx: canvas.width/2,
    my: baseY + 40,
    tx: canvas.width/2,
    ty: baseY + 40,
    moveTimer: 0,
    moveSpeed: 220,
    dashChance: 0.22,
    // Orbiting shield ring
    orbitAngle: 0,
    orbitSpeed: 1.7,
    orbitRadius: Math.max(52, bossSize * 0.62),
    shieldsAlive: 4
  };
  enemies.push(boss);

  // Shields: 4 copies of the same GIF orbiting around the boss.
  // They do NOT move independently; their x/y is forced each frame.
  const shieldSize = Math.max(baseSize * 1.25, 44);

  for (let i = 0; i < 4; i++){
    const shield = {
      row:0, col:0, baseY,
      img: bossImg,
      isFrog:false,
      size: shieldSize,
      hp: BOSS_HP,
      hitFlash:0,
      dying:false,
      fade:1,
      fadeRate:0,
      lockX:0, lockY:0, lockW:0, lockH:0,
      _killAwarded:false,
      x: boss.x, y: boss.y, w:0, h:0,
      fx:0, fy:0,
      swoop:null,
      swoopCooldown: 9999,
      isBossShield:true,
      bossWave:true,
      bossRef: boss,
      orbitIndex: i,
      // Shield shooting (predictable pattern)
      shootInterval: 1.2,
      shootTimer: i * 0.25
    };
    enemies.push(shield);
  }

  // Restore formation settings if we were additive.
  if (additive){
    formationCols = prevCols;
    formationRows = prevRows;
    // ensure we're still writing into the live enemies array reference
    enemies = prevEnemies;
  }
}


function spawnEnemies(){
  // Maze mode now spawns individual roaming enemies inside random open maze squares.
  enemies = [];
  resetMazeForWave(wave);
  spawnMazeEnemiesForWave(wave);
}

/* =======================
   Bullets
======================= */
const bullets = [];
const enemyBullets = [];

// v1.96 PERF GUARDRAILS:
// When bullet counts explode, the nested bullet-vs-bullet collision check can get expensive.
// Cap counts to keep the game smooth instead of freezing when chaos spikes.
const MAX_PLAYER_BULLETS = 90;
const MAX_ENEMY_BULLETS  = 140;

function pushPlayerBullet(x, y, vx, vy, r, lightningBranchIndex = null, extra = null){
  if (bullets.length >= MAX_PLAYER_BULLETS){
    bullets.splice(0, bullets.length - MAX_PLAYER_BULLETS + 1);
  }
  const bullet = { x, y, vx, vy, r };
  if (lightningBranchIndex !== null) bullet.lightningBranchIndex = lightningBranchIndex;
  if (extra) Object.assign(bullet, extra);
  bullets.push(bullet);
}

function spawnLightningBranchBullets(x, y, dx, dy, baseRadius){
  pushPlayerBullet(x, y, dx * PLAYER_BULLET_SPEED, dy * PLAYER_BULLET_SPEED, baseRadius, 0);
  const aimAngle = Math.atan2(dy, dx);
  for (const branchDir of [-1, 1]){
    const branchAngle = aimAngle + (BIG_BULLET_BRANCH_ANGLE * branchDir);
    pushPlayerBullet(
      x,
      y,
      Math.cos(branchAngle) * PLAYER_BULLET_SPEED * BIG_BULLET_BRANCH_SPEED_MULTIPLIER,
      Math.sin(branchAngle) * PLAYER_BULLET_SPEED * BIG_BULLET_BRANCH_SPEED_MULTIPLIER,
      baseRadius * BIG_BULLET_BRANCH_RADIUS_MULTIPLIER,
      branchDir
    );
  }
}

function spawnGlitchCannonBullets(x, y, dx, dy, baseRadius){
  const aimAngle = Math.atan2(dy, dx);
  for (const spread of [-GLITCH_BULLET_SPREAD_ANGLE, 0, GLITCH_BULLET_SPREAD_ANGLE]){
    const a = aimAngle + spread;
    pushPlayerBullet(
      x,
      y,
      Math.cos(a) * PLAYER_BULLET_SPEED * GLITCH_BULLET_SPEED_MULTIPLIER,
      Math.sin(a) * PLAYER_BULLET_SPEED * GLITCH_BULLET_SPEED_MULTIPLIER,
      baseRadius,
      null,
      { glitchEnergy: true, glitchPhase: Math.random() * Math.PI * 2 }
    );
  }
}

function shoot(){
  if (isPaused) return;
  if (fireCooldown > 0) return;

  // v1.96: fire in the current aim direction (defaults upward if aim is unset)
  const dx = Math.cos(aimAngleSmoothed);
  const dy = Math.sin(aimAngleSmoothed);

  let spawnDist = (player.w * 0.42);


  // v1.96: allow shooting THROUGH the right-click energy shield by spawning bullets


  // just outside the shield ring while it's active.


  if (shieldActive){


    const shieldR = (player.w * SHIELD_RADIUS_MULT);


    spawnDist = Math.max(spawnDist, shieldR + 6);


  }
  const hasGlitchCharge = isGlitchShotActive();
  const hasBigBulletCharge = !hasGlitchCharge && isBigBulletShotActive();
  const bulletX = player.x + dx * spawnDist;
  const bulletY = player.y + dy * spawnDist;
  const bulletRadius = PLAYER_BULLET_RADIUS * (hasBigBulletCharge ? BIG_BULLET_RADIUS_MULTIPLIER : (hasGlitchCharge ? GLITCH_BULLET_RADIUS_MULTIPLIER : 1));
  if (hasGlitchCharge){
    spawnGlitchCannonBullets(bulletX, bulletY, dx, dy, bulletRadius);
    glitchBackgroundPulse = Math.min(1, glitchBackgroundPulse + 0.55);
  } else if (hasBigBulletCharge){
    spawnLightningBranchBullets(bulletX, bulletY, dx, dy, bulletRadius);
  } else {
    const normalBulletSpeed = PLAYER_BULLET_SPEED * NORMAL_BULLET_SPEED_MULTIPLIER;
    pushPlayerBullet(bulletX, bulletY, dx * normalBulletSpeed, dy * normalBulletSpeed, bulletRadius);
  }

  
  shotsFired += 1;
// v1.96: faster firing as waves increase
  fireCooldown = getPlayerFireCooldown();
}


let enemyShootTimer = 0;
function enemyTryShoot(dt){
  if (enemies.some(e => e && e.mazeMob && !e.dying)) return;
  enemyShootTimer -= dt;
  if (enemyShootTimer > 0) return;

  const alive = enemies.length;

  // v1.96: shot pacing is less spammy early, more spicy later.
  // FUNK scales the aggression (1000 = baseline).
  const base = Math.max(
    0.16,
    (0.72 - wave*0.05 - Math.min(0.28, alive*0.0016)) / FUNK
  );

  // Add a tiny bit of variance so it doesn't feel like a metronome.
  enemyShootTimer = base * (0.85 + Math.random()*0.35);

  if (!enemies.length) return;

  // Shoot source selection.
  // Boss wave: shoot from the core so the orbiting shields stay 'shieldy' instead of acting like turrets.
  let e = null;
  if (wave === 11){
    e = enemies.find(x => x && x.isBossCore);
  }
  if (!e){
    // Classic arcade chaos: shoot from a random alive enemy.
    e = enemies[Math.floor(Math.random() * enemies.length)];
  }

  // Straight-line shots, but slightly aimed (vx is constant, so still a straight path).
  const dx = (player.x - e.x);
  const vx = Math.max(-3.2, Math.min(3.2, dx * 0.012)); // gentle lead
  const vy = (5.6 + wave*0.45) * FUNK;

  // v1.96: cap enemy bullets to prevent the counter-shot collision loop from going nuclear
  if (enemyBullets.length >= MAX_ENEMY_BULLETS){
    enemyBullets.splice(0, enemyBullets.length - MAX_ENEMY_BULLETS + 1);
  }
  enemyBullets.push({ x: e.x, y: e.y + e.h/2 + 6, vx, vy, r: 4 });
}


let swoopTimer = 0;

/*
  v1.96: Galaga-like swoop attackers.
  The *formation* is clamped to the top zone.
  Individual enemies can temporarily dive into the player zone ("swoop") and then return.
*/
function tryStartSwoop(dt){
  // tick per-enemy cooldowns
  for (const e of enemies){
    if (e.swoopCooldown > 0) e.swoopCooldown = Math.max(0, e.swoopCooldown - dt);
  }

  swoopTimer -= dt;
  if (swoopTimer > 0) return;

  // How often a swoop starts (faster on higher waves)
  const interval = Math.max(0.7, 2.0 - wave * 0.12);
  swoopTimer = interval;

  // Limit simultaneous swoopers so it stays readable.
  const maxSwoopers = Math.min(4, Math.max(1, Math.floor((1 + (wave-1) / 3) * (0.9 + 0.25*(FUNK-1)))));
  const currentlySwooping = enemies.reduce((n, e) => n + (e.swoop ? 1 : 0), 0);
  if (currentlySwooping >= maxSwoopers) return;

  // Pick an eligible enemy.
  const candidates = enemies.filter(e => !e.swoop && e.swoopCooldown <= 0);
  if (!candidates.length) return;

  const e = candidates[Math.floor(Math.random() * candidates.length)];

  // Start at current formation position (fx/fy computed in update loop).
  const sx = e.fx || e.x;
  const sy = e.fy || e.y;

  // End near player area, but not *below* the player.
  const endY = Math.min(canvas.height * 0.90, player.y - 40);
  const endX = Math.max(40, Math.min(canvas.width - 40, player.x + rand(-140, 140)));

  // Control point makes an arcing dive (sideways + down).
  const c1x = sx + rand(-220, 220);
  const c1y = sy + rand(140, 260);

  // Duration scales with wave (faster dives later).
  const dur = Math.max(1.1, 1.75 - wave * 0.03);

  e.swoop = { t:0, dur, phase:"down", sx, sy, c1x, c1y, ex:endX, ey:endY };
  e.swoopCooldown = Math.max(1.2, 3.0 - wave * 0.10); // wait before it can swoop agai

}


function quadBezier(t, a, b, c){
  // (1-t)^2 a + 2(1-t)t b + t^2 c
  const mt = 1 - t;
  return (mt*mt)*a + (2*mt*t)*b + (t*t)*c;
}


/* =======================
   Collision helpers
======================= */
function circleRect(cx, cy, cr, rx, ry, rw, rh){
  const testX = Math.max(rx, Math.min(cx, rx+rw));
  const testY = Math.max(ry, Math.min(cy, ry+rh));
  const dx = cx - testX;
  const dy = cy - testY;
  return (dx*dx + dy*dy) <= cr*cr;
}

// v2.09: Pixel-perfect enemy body contact.
// Rectangle overlap was making transparent sprite corners count as hits, because apparently empty air now has teeth.
const PIXEL_CONTACT_ALPHA_THRESHOLD = 8;
const spriteAlphaMaskCache = new WeakMap();

function getSpriteAlphaMask(source){
  if (!source) return null;

  const w = source.naturalWidth || source.videoWidth || source.width || 0;
  const h = source.naturalHeight || source.videoHeight || source.height || 0;
  if (!w || !h) return null;

  const cached = spriteAlphaMaskCache.get(source);
  if (cached && cached.w === w && cached.h === h) return cached;

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cctx = c.getContext("2d", { willReadFrequently:true });
  if (!cctx) return null;

  try{
    cctx.clearRect(0, 0, w, h);
    cctx.drawImage(source, 0, 0, w, h);
    const data = cctx.getImageData(0, 0, w, h).data;
    const mask = { w, h, alpha:data };
    spriteAlphaMaskCache.set(source, mask);
    return mask;
  }catch(err){
    return null;
  }
}

function getPlayerContactSource(){
  return (typeof getStaticPlayerFrame === "function" ? getStaticPlayerFrame() : null) || playerImg;
}

function getPlayerContactRect(){
  let widthScale = 1;
  if (typeof playerTurnT === "number"){
    const turnEase = Math.sin(Math.min(1, Math.max(0, playerTurnT)) * Math.PI);
    widthScale = Math.max(0.12, 1 - turnEase * 0.82);
  }
  const w = player.w * widthScale;
  return {
    x: player.x - w / 2,
    y: player.y - player.h / 2,
    w,
    h: player.h,
    flipX: typeof playerFacing === "number" && playerFacing >= 0
  };
}

function getEnemyContactRect(enemy){
  return {
    x: enemy.x - enemy.w / 2,
    y: enemy.y - enemy.h / 2,
    w: enemy.w,
    h: enemy.h,
    flipX:false
  };
}

function rectsOverlap(a, b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function sampleMaskAlpha(mask, rect, x, y){
  if (!mask || !rect.w || !rect.h) return 255;

  let u = (x + 0.5 - rect.x) / rect.w;
  const v = (y + 0.5 - rect.y) / rect.h;
  if (rect.flipX) u = 1 - u;

  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;

  const sx = Math.max(0, Math.min(mask.w - 1, Math.floor(u * mask.w)));
  const sy = Math.max(0, Math.min(mask.h - 1, Math.floor(v * mask.h)));
  return mask.alpha[(sy * mask.w + sx) * 4 + 3] || 0;
}

function spritesHaveOpaquePixelOverlap(sourceA, rectA, sourceB, rectB){
  if (!rectsOverlap(rectA, rectB)) return false;

  const maskA = getSpriteAlphaMask(sourceA);
  const maskB = getSpriteAlphaMask(sourceB);

  // Asset not readable yet? Keep the old rectangle behavior as a safe fallback.
  if (!maskA || !maskB) return true;

  const left = Math.max(Math.floor(rectA.x), Math.floor(rectB.x));
  const right = Math.min(Math.ceil(rectA.x + rectA.w), Math.ceil(rectB.x + rectB.w));
  const top = Math.max(Math.floor(rectA.y), Math.floor(rectB.y));
  const bottom = Math.min(Math.ceil(rectA.y + rectA.h), Math.ceil(rectB.y + rectB.h));

  for (let y = top; y < bottom; y++){
    for (let x = left; x < right; x++){
      if (
        sampleMaskAlpha(maskA, rectA, x, y) > PIXEL_CONTACT_ALPHA_THRESHOLD &&
        sampleMaskAlpha(maskB, rectB, x, y) > PIXEL_CONTACT_ALPHA_THRESHOLD
      ){
        return true;
      }
    }
  }
  return false;
}

function enemyTouchesPlayerPixels(enemy){
  if (!enemy || !enemy.img) return false;
  return spritesHaveOpaquePixelOverlap(
    getPlayerContactSource(),
    getPlayerContactRect(),
    enemy.img,
    getEnemyContactRect(enemy)
  );
}

function spawnPlayerDeath(isGameOver){
  // v1.96+: violent pixel-dust death
  isDead = true;
  deathGameOver = !!isGameOver;
  deathTimer = deathGameOver ? 1.2 : 0.85;
  if (deathGameOver){
    triggerGlitchSpiral();
    deathOverlay.style.display = "flex";
    resetDeathQuitConfirm();
    deathFocusIndex = 0;
    syncDeathControllerFocus();
  }

  const n = 160;
  for (let i = 0; i < n; i++){
    const ang = Math.random() * Math.PI * 2;
    const spd = 140 + Math.random() * 520;
    deathParticles.push({
      x: player.x + rand(-player.w*0.15, player.w*0.15),
      y: player.y + rand(-player.h*0.15, player.h*0.15),
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.55 + Math.random()*0.55,
      s: 1 + Math.random()*3
    });
  }
}

function damagePlayer(sourceEnemy = null){
  if (player.invuln > 0 || isDead) return;

  // v1.96: Infinite mode means consequences are cancelled.
  if (infiniteModeActive || heartsInfiniteActive){
    playSfx(sfxHit);
    player.invuln = 0.15;
    applySpiralPlayerReactionIfNeeded(sourceEnemy);
    return;
  }

  // v1.96: shield pips absorb one hit (before health)
  if (shieldPips > 0 || shieldsInfiniteActive){
    if (!shieldsInfiniteActive) shieldPips = Math.max(0, shieldPips - 1);
    playSfx(sfxHit);
    player.invuln = 0.35;
    applySpiralPlayerReactionIfNeeded(sourceEnemy);
    return;
  }

  // v1.96: bonus armor absorbs one hit
  if (bonusArmor > 0){
    breakBonusArmor();
    playSfx(sfxHit);
    player.invuln = 0.35;
    applySpiralPlayerReactionIfNeeded(sourceEnemy);
    return;
  }

  // Each hit drains HIT_DAMAGE health (MAX_HEARTS hearts per life).
  const nextHealth = health - HIT_DAMAGE;
  health = (nextHealth <= 0.000001) ? 0 : Math.max(0, nextHealth);
  player.invuln = 1.00;
  applySpiralPlayerReactionIfNeeded(sourceEnemy);

  if (health <= 0){
    spiralPlayerReactionT = 0;
    spiralPlayerReactionDuration = 0;
    spiralPlayerContactCooldown = 0;
    // Lose a life and explode into pixel dust.
    if (!livesInfiniteActive) lives = Math.max(0, lives - 1);
    const deathIsGameOver = !livesInfiniteActive && lives <= 0;
    if (deathIsGameOver && !deathYellPlayed){
      playSfxImmediate(sfxOof);
      deathYellPlayed = true;
      setTimeout(() => {
        if (deathYellPlayed) playDeathYell();
      }, 0);
      stopMusic();
    } else {
      playSfx(sfxOof);
    }
    spawnPlayerDeath(deathIsGameOver);
    return;
  }
  playSfx(sfxOof);
}

/* =======================
   Input
======================= */

// Prevent right-click context menu so holding RMB can be used for shield.
window.addEventListener("contextmenu", (e) => {
  if (e.target === canvas) e.preventDefault();
}, { passive:false });


window.addEventListener("keydown", (e) => {
  unlockAudioOnce();
  sawKeyboardMouseInput = true;
  if (controlsMenu && controlsMenu.style.display !== 'none' && controlsInputLockMode === INPUT_MODE_CONTROLLER) {
    unlockControlsInputMode();
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
  }
  if (bindingEditState && bindingEditState.scheme === INPUT_MODE_KEYBOARD){
    e.preventDefault();
    e.stopPropagation();
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
    applyBindingValue(INPUT_MODE_KEYBOARD, bindingEditState.action, e.code || e.key);
    return;
  }
  if (e.code === "Space") e.preventDefault();
  const target = e.target;
  const typingIntoField = target && ((target.tagName === "INPUT") || (target.tagName === "TEXTAREA") || target.isContentEditable);

  if (deathOverlay && deathOverlay.style.display === "flex" && (e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "Enter" || e.code === "Space" || e.code === "Escape")){
    if (e.code === "ArrowUp") moveDeathControllerFocus(-1);
    else if (e.code === "ArrowDown") moveDeathControllerFocus(1);
    else if (e.code === "Enter" || e.code === "Space") activateDeathControllerFocus();
    else if (e.code === "Escape" && btnDeathQuitToMenu) btnDeathQuitToMenu.click();
    e.preventDefault();
    return;
  }

  // Tab no longer triggers the glitch spiral; prevent browser focus-stealing during gameplay.
  if (e.code === "Tab" && !typingIntoField){ e.preventDefault(); }
  const k = e.key.toLowerCase();
  const code = e.code || e.key;
  setActiveInputMode(INPUT_MODE_KEYBOARD);
  keys[k] = true;
  keys[code] = true;
  if (!typingIntoField && code === keyboardBindings.commands){ e.preventDefault(); requestOpenChat(false, "/help"); return; }
  if (code === keyboardBindings.mute){ setMuteOptionEnabled(!audioMuted); }
  if (code === keyboardBindings.shoot && gameState === STATE.PLAYING) shoot();
  if (code === keyboardBindings.fullscreen) toggleFullscreen();
  if (code === keyboardBindings.bomb && gameState === STATE.PLAYING) dropBomb();
  if (code === keyboardBindings.pause) togglePause();
}, { passive:false });

window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; keys[e.code || e.key] = false; });
window.addEventListener("mousedown", (e) => {
  sawKeyboardMouseInput = true;
  if (controlsMenu && controlsMenu.style.display !== 'none' && controlsInputLockMode === INPUT_MODE_CONTROLLER) {
    unlockControlsInputMode();
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
  }
  if (!(bindingEditState && bindingEditState.scheme === INPUT_MODE_KEYBOARD)) return;
  e.preventDefault();
  e.stopPropagation();
  setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
  applyBindingValue(INPUT_MODE_KEYBOARD, bindingEditState.action, mouseButtonToBinding(e.button));
}, true);

canvas.addEventListener("pointermove", (e) => {
  if (isTouchPointerEvent(e) && isMobilePhoneViewport()) return;
  sawKeyboardMouseInput = true;
  setActiveInputMode(INPUT_MODE_KEYBOARD);
  // v1.96: aim follows pointer (mouse or touch)
  setAimFromClient(e.clientX, e.clientY, { immediate:isTouchPointerEvent(e) });
});

canvas.addEventListener("pointerdown", (e) => {
  if (isTouchPointerEvent(e) && isMobilePhoneViewport()){
    e.preventDefault();
    return;
  }
  sawKeyboardMouseInput = true;
  if (controlsMenu && controlsMenu.style.display !== 'none' && controlsInputLockMode === INPUT_MODE_CONTROLLER) {
    unlockControlsInputMode();
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
  } else {
    setActiveInputMode(INPUT_MODE_KEYBOARD);
  }
  unlockAudioOnce();
  // v1.96: clicking also aims and shoots
  setAimFromClient(e.clientX, e.clientY, { immediate:isTouchPointerEvent(e) });

  // v1.96: RIGHT CLICK hold = shield
  // Note: pointer events use button 2 for right mouse.
  if (e.button === 2){
    e.preventDefault();
    mouseShieldHolding = true;
    if (canActivateShield()) startShield();
    return;
  }

  if (e.button === 0) mouseFireHolding = true; // v1.96: hold LMB to keep firing

  if (gameState === STATE.PLAYING) shoot();
});

canvas.addEventListener("pointerup", (e) => {
  if (isTouchPointerEvent(e) && isMobilePhoneViewport()) return;
  if (keyboardBindings.shoot === mouseButtonToBinding(e.button)) mouseFireHolding = false;
  // Release RMB shield
  if (e.button === 2){
    mouseShieldHolding = false;
    // v1.96: Releasing it just deactivates; cooldown only happens if it BREAKS.
    if (shieldActive) stopShield(false);
  }
});

/* =======================
   Update + Draw
======================= */
function update(dt){
  syncMobileStickOverlayState();
  time += dt;

  // v1.96: update glitch spiral timer
  if (GLITCH_SPIRAL_T > 0) GLITCH_SPIRAL_T = Math.max(0, GLITCH_SPIRAL_T - dt);

  if (bonusArmorBrokenT > 0) bonusArmorBrokenT = Math.max(0, bonusArmorBrokenT - dt);

  // starfield updates always
  updateStarfield(dt, keys, player.speed);
  if (glitchBackgroundPulse > 0) glitchBackgroundPulse = Math.max(0, glitchBackgroundPulse - dt * GLITCH_BACKGROUND_DECAY);

  // v1.96: gamepad input (Xbox controller)
  pollGamepad(dt);

  // PAUSE_GUARD_v1_51: freeze gameplay updates while paused
  if (gameState === STATE.PLAYING && isPaused) return;

  if (gameState !== STATE.PLAYING) return;

  // Run timer (seconds since Start Game)
  runTimer += dt;

  // v1.96: shield cooldown + hold logic
  if (shieldCooldown > 0) shieldCooldown = Math.max(0, shieldCooldown - dt);

  if (shieldActive){
    if (shieldHolding){
      shieldHoldGrace = SHIELD_HOLD_GRACE_SECS; // refresh grace while held
    } else {
      shieldHoldGrace = Math.max(0, shieldHoldGrace - dt);
      if (shieldHoldGrace <= 0){
        // v1.96: If RMB isn't held for a bit, drop shield WITHOUT cooldown (HP is saved).
        stopShield(false);
      }
    }
  }

  // v1.96: death particles update + lockout
  if (isDead){
    deathTimer -= dt;

    // update particles
    for (let i = deathParticles.length - 1; i >= 0; i--){
      const p = deathParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 520 * dt; // gravity
      if (p.life <= 0) deathParticles.splice(i, 1);
    }

    if (deathTimer <= 0){
      if (deathGameOver){
        // GAME OVER overlay
        deathOverlay.style.display = "flex";
        if (!deathYellPlayed){
          stopMusic();
          playDeathYell();
          deathYellPlayed = true;
        }
      } else {
        // Respawn for next life (keep wave/maze as-is)
        isDead = false;
        deathGameOver = false;
  deathYellPlayed = false;
        deathParticles.length = 0;
        health = 1.0;

  // Spawn player fixed in the center for maze traversal
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
        player.invuln = 1.25;
      }
    }
    return; // freeze gameplay while dead
  }

  if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
  if (spiralPlayerReactionT > 0) spiralPlayerReactionT = Math.max(0, spiralPlayerReactionT - dt);
  if (spiralPlayerContactCooldown > 0) spiralPlayerContactCooldown = Math.max(0, spiralPlayerContactCooldown - dt);
  if (fireCooldown > 0) fireCooldown = Math.max(0, fireCooldown - dt);

  if (waveBanner.t > 0) waveBanner.t = Math.max(0, waveBanner.t - dt);

  // player move (keyboard + gamepad)
  let moveX = 0;
  if (isKeyboardActionHeld("moveLeft")) moveX -= 1;
  if (isKeyboardActionHeld("moveRight")) moveX += 1;
  moveX += mobileMoveX || 0;
  // add analog movement from Xbox pad
  moveX += gpMoveX || 0;
  moveX = Math.max(-1, Math.min(1, moveX));

  // v2.04: faux-2.5D turn animation when switching horizontal direction
  if (moveX > 0.08 && playerFacing !== 1){
    playerFacing = 1;
    playerTurnT = 0;
  } else if (moveX < -0.08 && playerFacing !== -1){
    playerFacing = -1;
    playerTurnT = 0;
  }
  if (playerTurnT < 1){
    playerTurnT = Math.min(1, playerTurnT + dt / PLAYER_TURN_DUR);
  }

  const sprintHeld = !!keys["shift"] || !!gpSpeedBoostHeld;
  const moveSpeedMul = (sprintHeld ? 1.75 : 1.0);
  let moveY = 0;
  if (isKeyboardActionHeld("moveUp") || keys["arrowup"]) moveY -= 1;
  if (isKeyboardActionHeld("moveDown") || keys["arrowdown"]) moveY += 1;
  moveY += mobileMoveY || 0;
  moveY += gpMoveY || 0;
  moveY = Math.max(-1, Math.min(1, moveY));
  const moveLen = Math.hypot(moveX, moveY) || 1;

  updatePlayerGhosts(dt);
  if (Math.abs(moveX) > 0.08 || Math.abs(moveY) > 0.08){
    playerGhostSpawnT -= dt;
    if (playerGhostSpawnT <= 0){
      spawnPlayerGhost(moveX / moveLen, moveY / moveLen);
      playerGhostSpawnT = PLAYER_GHOST_SPAWN_EVERY;
    }
  } else {
    playerGhostSpawnT = 0;
  }

  moveMazePlayer((moveX / moveLen) * moveSpeedMul * dt, (moveY / moveLen) * moveSpeedMul * dt);

  // Player remains fixed visually in the center while the maze scrolls underneath.
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;

  updateMazeEnemies(dt);


// v1.96: right stick aim (only when the stick is actually being pushed)
const mobileAimMag = Math.hypot(mobileAimStickX || 0, mobileAimStickY || 0);
if (mobileAimMag > MOBILE_STICK_AIM_DEADZONE){
  const nx = (mobileAimStickX / mobileAimMag);
  const ny = (mobileAimStickY / mobileAimMag);
  aimX = player.x + nx * 220;
  aimY = player.y + ny * 220;
  aimAngle = Math.atan2(aimY - player.y, aimX - player.x);
} else {
  const aimMag = Math.hypot(gpAimX || 0, gpAimY || 0);
  if (aimMag > GP_AIM_DEADZONE){
    const nx = (gpAimX / aimMag);
    const ny = (gpAimY / aimMag);
    // Convert stick direction into an aim point in front of the player.
    aimX = player.x + nx * 220;
    aimY = player.y + ny * 220;
    aimAngle = Math.atan2(aimY - player.y, aimX - player.x);
  }
}

// v1.96: shield (LS click hold) and fire (RT/A hold); LT = speed boost
gamepadShieldHolding = !!gpShieldHeld;
shieldHolding = (mouseShieldHolding || gamepadShieldHolding);
if (shieldHolding && canActivateShield()) startShield();

if (mobileAimStickActive) shoot();
if (gpFireHeld) shoot();

  
  // v1.96: Held-fire (LMB) should keep shooting even while the shield is held.
  // shoot() already respects cooldown, pause, and state.
  if (gameState === STATE.PLAYING && !isPaused && mouseFireHolding){
    shoot();
  }

// v1.96: smooth the aim angle (shortest-path wrap) for nicer feel
  const da = normAngle(aimAngle - aimAngleSmoothed);
  aimAngleSmoothed = normAngle(aimAngleSmoothed + da * Math.min(1, dt * 18));

  updateUFO(dt);
  updateBomb(dt);

  // formation movement bounds depend on breathing spacing
  const breath = Math.sin(time * 2) * 0.5 + 0.5;
  const spacingX = getSpacingX() * (1 + breath * 0.25);

  const formationWidth = (formationCols - 1) * spacingX;

  // v1.96: predict next X so we don't clip enemies on wider desktop layouts
  const nextXOffset = formation.xOffset + (formation.dir * formation.speed);

  const leftEdgeNext  = canvas.width/2 - formationWidth/2 + nextXOffset;
  const rightEdgeNext = canvas.width/2 + formationWidth/2 + nextXOffset;

  if (leftEdgeNext < formation.boundsPad){
    formation.dir = 1;
    formation.xOffset += 2;
    formation.yOffset += formation.stepDown;
  } else if (rightEdgeNext > canvas.width - formation.boundsPad){
    formation.dir = -1;
    formation.xOffset -= 2;
    formation.yOffset += formation.stepDown;
  } else {
    formation.xOffset = nextXOffset;
  }

  // v1.96: always drift downward toward the player (Galaga pressure)
  formation.yOffset += formation.descentSpeed * dt;

  // update bullets
  // v2.03: bullets now collide with maze walls and vanish on impact.
  // Bullets are still stored in screen-space, so we convert them into maze/world space
  // using the current camera offset before testing against wall tiles.
  const camX = playerWorldX - canvas.width / 2;
  const camY = playerWorldY - canvas.height / 2;

  for (let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    const bwx = b.x + camX;
    const bwy = b.y + camY;
    if (isWallAtWorld(bwx, bwy)){
      bullets.splice(i, 1);
      continue;
    }

    if (b.x < -80 || b.x > canvas.width + 80 || b.y < -80 || b.y > canvas.height + 80) bullets.splice(i, 1);
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--){
    const b = enemyBullets[i];
    b.x += (b.vx || 0);
    b.y += b.vy;

    const bwx = b.x + camX;
    const bwy = b.y + camY;
    if (isWallAtWorld(bwx, bwy)){
      enemyBullets.splice(i, 1);
      continue;
    }

    if (enemyBullets[i].y > canvas.height + 60) enemyBullets.splice(i, 1);
  }


  // v1.96: player bullet <-> enemy bullet collision (both vanish on contact)
  // This prevents bullet spam from feeling unfair and adds a satisfying "counter-shot" mechanic.
  for (let pi = bullets.length - 1; pi >= 0; pi--){
    const p = bullets[pi];
    for (let ei = enemyBullets.length - 1; ei >= 0; ei--){
      const e = enemyBullets[ei];
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const rr = (p.r + e.r);
      // v1.96: cheap early-outs to avoid expensive nested collision work when bullets are far apart
      if (dy > rr + 6 || dy < -rr - 6) continue;
      if (dx > rr + 6 || dx < -rr - 6) continue;
      if (dx*dx + dy*dy <= rr*rr){
        bullets.splice(pi, 1);
        enemyBullets.splice(ei, 1);
        break; // player bullet is gone, move to next one
      }
    }
  }

  // v1.96: attempt to launch swoop attackers
  // Boss wave uses its own movement, no swoops.
  if (wave !== 11) tryStartSwoop(dt);

  // compute enemy positions
  const spacingY = getSpacingY() * (1 + breath * 0.15);
  const formationHeight = (formationRows - 1) * spacingY;

  const startX = canvas.width/2 - formationWidth/2 + formation.xOffset;

  // v1.96: base spawn Y from each enemy, plus formation yOffset
  // then clamp so the formation bottom never gets too close to player
  let baseY = 80 + formation.yOffset;

// Keep enemies in the TOP half-ish of the screen.
// We still drift downward (Galaga pressure), but we *cap* the formation so it doesn't
// invade the player's space like it's paying rent down there.
const TOP_SAFE_MARGIN = 60;
const ENEMY_ZONE_MAX_Y = canvas.height * 0.48; // ~top half with a little buffer

// Clamp TOP
if (baseY < TOP_SAFE_MARGIN){
  formation.yOffset += (TOP_SAFE_MARGIN - baseY);
  baseY = TOP_SAFE_MARGIN;
}

// Clamp BOTTOM (based on full formation height)
const maxBaseY = ENEMY_ZONE_MAX_Y - formationHeight;
if (baseY > maxBaseY){
  // pull the whole formation back up
  formation.yOffset -= (baseY - maxBaseY);
  baseY = maxBaseY;
  // if the formation is too tall to fit, at least respect the top margin
  if (baseY < TOP_SAFE_MARGIN) baseY = TOP_SAFE_MARGIN;
}


// Boss wave controller: sporadic movement + orbiting shield ring.
// We compute boss.x/y directly, then force shields to orbit it.
let bossCore = enemies.find(x => x && x.isBossCore && !x.dying);
if (bossCore){
  if (bossCore){
    // Update sporadic target selection
    bossCore.moveTimer -= dt;

    const left = 70;
    const right = canvas.width - 70;
    const top = 70;
    const bottom = canvas.height * 0.36;

    if (bossCore.moveTimer <= 0){
      const dash = Math.random() < bossCore.dashChance;
      bossCore.tx = rand(left, right);
      bossCore.ty = rand(top, bottom);

      // Occasionally do a more dramatic "dash" by picking a farther target + higher speed.
      const baseSpeed = dash ? rand(520, 760) : rand(200, 340);
      bossCore.moveSpeed = baseSpeed * FUNK;

      // Short, snappy pacing feels more "alive"
      bossCore.moveTimer = dash ? rand(0.35, 0.6) : rand(0.55, 1.15);

      // Small randomness in orbit speed so it doesn't feel like a perfect clock
      bossCore.orbitSpeed = rand(1.35, 2.25);
    }

    // Move toward target (ease-ish)
    const dx = bossCore.tx - bossCore.mx;
    const dy = bossCore.ty - bossCore.my;
    const dist = Math.hypot(dx, dy) || 1;

    const step = Math.min(dist, bossCore.moveSpeed * dt);
    bossCore.mx += (dx / dist) * step;
    bossCore.my += (dy / dist) * step;

    // Apply to render positions
    bossCore.x = bossCore.mx;
    bossCore.y = bossCore.my;

    // Orbit angle
    bossCore.orbitAngle += dt * bossCore.orbitSpeed;

    // Shield firing pattern: each orbiter shoots on a fixed cadence with a fixed spread.
    // This makes a predictable 'screen sweep' pattern rather than random snipes.
    for (const s of enemies){
      if (!s || s.dying) continue;
      if (!s.isBossShield || s.bossRef !== bossCore) continue;
      if (typeof s.shootTimer !== 'number') s.shootTimer = 0;
      s.shootTimer -= dt;
      if (s.shootTimer <= 0){
        // Fixed vx by index: [-3, -1, 1, 3] (scaled), always downward.
        const vxMap = [-3, -1, 1, 3];
        const idx = Math.max(0, Math.min(3, (s.orbitIndex|0)));
        const vx = vxMap[idx] * 1.15 * FUNK;
        const vy = (6.4 + wave * 0.35) * FUNK;
        if (enemyBullets.length >= MAX_ENEMY_BULLETS){
          enemyBullets.splice(0, enemyBullets.length - MAX_ENEMY_BULLETS + 1);
        }
        enemyBullets.push({ x: s.x, y: s.y + s.h/2 + 6, vx, vy, r: 4 });
        const interval = (typeof s.shootInterval === 'number') ? s.shootInterval : 1.2;
        s.shootTimer += interval;
      }
    }

    // Count alive shields (for invulnerability logic)
    let alive = 0;
    for (const s of enemies){
      if (s && s.isBossShield && !s.dying) alive++;
    }
    bossCore.shieldsAlive = alive;
  }
} else {
  // If the boss core is gone (killed/fading), any remaining orbiters should NOT become
  // a second full-health "boss". Make them a 1-hit cleanup target.
  for (const s of enemies){
    if (!s || s.dying) continue;
    if (!s.isBossShield) continue;
    if (!s.bossRef || s.bossRef.dying || (typeof s.bossRef.hp === "number" && s.bossRef.hp <= 0)){
      s.hp = 1;
      s.isBossShield = false;
      s.isBossRemnant = true;
      s.bossWave = false;
      s.bossRef = null;
      // stop shield firing
      s.shootTimer = 9999;
      s.shootInterval = 9999;
    }
  }
}

  for (const e of enemies){
    if (assetsReady && enemyImages.length && e.img === playerImg) e.img = randEnemyImg();

    if (e.mazeMob){
      continue;
    }

    const scale = 1 + breath * 0.18;
    const size = e.size * scale;

    // v1.96: predictable formation wobble (non-random, just annoying)
    const wobbleAmpX = 6 + Math.min(14, wave * 1.2);
    const wobbleAmpY = 3 + Math.min(10, wave * 0.7);
    const wobbleX = Math.sin(time * (0.9 + wave*0.03) + e.row * 0.7) * wobbleAmpX;
    const wobbleY = Math.cos(time * (1.1 + wave*0.02) + e.col * 0.6) * wobbleAmpY;


e.fx = startX + e.col * spacingX + wobbleX;
e.fy = baseY + e.row * spacingY + wobbleY;

// Boss group: override formation positioning with custom behaviour.
if (bossCore){
  if (e.isBossCore){
    e.fx = e.x;
    e.fy = e.y;
  } else if (e.isBossShield && e.bossRef){
    // Orbit around the core at 90° intervals.
    const core = e.bossRef;
    const ang = (core.orbitAngle || 0) + (e.orbitIndex || 0) * (Math.PI / 2);
    const r = core.orbitRadius || 70;

    e.fx = core.x + Math.cos(ang) * r;
    e.fy = core.y + Math.sin(ang) * r;
  }
}

if (!e.swoop){
      // Normal formation tracking.
      e.x = e.fx;
      e.y = e.fy;
    } else {
      // Swoop motion: dive down along a bezier arc, then return back to formation.
      e.swoop.t += dt;
      const u = Math.min(1, e.swoop.t / e.swoop.dur);

      if (e.swoop.phase === "down"){
        e.x = quadBezier(u, e.swoop.sx, e.swoop.c1x, e.swoop.ex);
        e.y = quadBezier(u, e.swoop.sy, e.swoop.c1y, e.swoop.ey);

        if (u >= 1){
          // Switch to return phase.
          e.swoop.phase = "up";
          e.swoop.t = 0;
          e.swoop.dur = Math.max(0.75, e.swoop.dur * 0.85);

          // Return target is the *current* formation slot (fx/fy),
          // so the enemy rejoins smoothly even if the formation moved.
          e.swoop.sx = e.x;
          e.swoop.sy = e.y;
          e.swoop.ex = e.fx;
          e.swoop.ey = e.fy;
          // new control point arcs upward.
          e.swoop.c1x = e.x + rand(-200, 200);
          e.swoop.c1y = Math.max(60, e.y - rand(160, 260));
        }
      } else {
        // Return-to-formation arc
        e.x = quadBezier(u, e.swoop.sx, e.swoop.c1x, e.swoop.ex);
        e.y = quadBezier(u, e.swoop.sy, e.swoop.c1y, e.swoop.ey);

        if (u >= 1){
          // Back in formation.
          e.swoop = null;
          e.x = e.fx;
          e.y = e.fy;
        }
      }
    }

    e.w = size;
    e.h = size;
  }

  // bullet -> enemy collision
  for (let bi = bullets.length - 1; bi >= 0; bi--){
    const b = bullets[bi];
    // v1.96+: bullet -> UFO collision (3-hit color cycle, then fade + powerup)
    if (ufo && ufo.fade === 0){
      const dxU = b.x - ufo.x;
      const dyU = b.y - ufo.y;
      const rrU = (b.r + ufo.r);
      if (dxU*dxU + dyU*dyU <= rrU*rrU){
        bullets.splice(bi, 1);
        hitsConnected += 1;
        damageDealt += 1;
        ufo.hits += 1;
        ufo.stage = Math.min(3, ufo.hits); // 1 red, 2 green, 3 blue
        if (ufo.hits >= 3){
          killUFO("bullet");
        }
        playSfx(sfxHit);
        continue; // bullet consumed
      }
    }

    for (let ei = enemies.length - 1; ei >= 0; ei--){
      const e = enemies[ei];

const rx = e.x - e.w/2, ry = e.y - e.h/2;

if (e.dying) continue;

// Boss wave: the orbiting shields protect the core.
if (wave === 11 && e.isBossCore){
  // If any shield is still alive, the core ignores direct hits.
  const shieldsAlive = (e.shieldsAlive ?? enemies.reduce((n, s) => n + (s && s.isBossShield && !s.dying ? 1 : 0), 0));
  if (shieldsAlive > 0) continue;
}

if (circleRect(b.x, b.y, b.r, rx, ry, e.w, e.h)){
        hitsConnected += 1;
        damageDealt += 1;
        enemyApplyDamage(e, 1, "bullet");
        // Bullet consumed on hit.
        bullets.splice(bi, 1);
        break;
      }
    }
  }

  // enemy bullet -> player collision
  const prx = player.x - player.w/2, pry = player.y - player.h/2;
  const shieldR = player.w * SHIELD_RADIUS_MULT;

  for (let i = enemyBullets.length - 1; i >= 0; i--){
    const b = enemyBullets[i];

    // v1.96: shield blocks bullets (counts as a "hit" on the shield)
    if (shieldActive){
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      const rr = (shieldR + b.r);
      if (dx*dx + dy*dy <= rr*rr){
        enemyBullets.splice(i, 1);
        shieldApplyDamage(SHIELD_BULLET_DMG);
        continue;
      }
    }

    if (circleRect(b.x, b.y, b.r, prx, pry, player.w, player.h)){
      enemyBullets.splice(i, 1);
      damagePlayer();
    }
  }

  // enemy contact damage

  // v1.96: shield makes enemies bounce off the player (and consumes shield hits on impact)
  if (shieldActive){
    const shieldR = player.w * SHIELD_RADIUS_MULT;
    for (const e of enemies){
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      // approximate enemy radius from its sprite size
      const er = Math.max(e.w, e.h) * 0.45;
      const rr = shieldR + er;
      const d2 = dx*dx + dy*dy;

      if (d2 <= rr*rr){
        const d = Math.max(1, Math.sqrt(d2));
        const nx = dx / d;
        const ny = dy / d;

        // Push enemy out to the ring boundary
        e.x = player.x + nx * (rr + 2);
        e.y = player.y + ny * (rr + 2);
        if (e.mazeMob){
          const camX = playerWorldX - canvas.width / 2;
          const camY = playerWorldY - canvas.height / 2;
          e.worldX = e.x + camX;
          e.worldY = e.y + camY;
        }

        // If it's swooping, cancel its swoop so it doesn't keep clipping the shield.
        if (e.swoop){
          e.swoop = null;
        }

        // Nudge its formation slot slightly away so it doesn't immediately re-collide
        e.col += nx * 0.35;
        e.row += ny * 0.25;

        tryTriggerSpiralPlayerContactFx(e, Math.max(player.invuln || 0, 0.65));
        shieldApplyDamage(SHIELD_BULLET_DMG);
        // If shield died from this hit, stop bouncing for this frame.
        if (!shieldActive) break;
      }
    }
  }

  for (const e of enemies){
    if (!enemyTouchesPlayerPixels(e)) continue;
    tryTriggerSpiralPlayerContactFx(e, Math.max(player.invuln || 0, 0.65));
    if (player.invuln <= 0){ damagePlayer(e); }
    break;
  }

  enemyTryShoot(dt);

  // Enemy hit flash + death fade timers (v1.96)
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];

    // Hit flash timer
    if (e.hitFlash > 0){
      e.hitFlash = Math.max(0, e.hitFlash - dt);
    }

    // Death fade timer
    if (e.dying){
      // Keep the corpse where it died while fading out.
      if (typeof e.lockX === "number") e.x = e.lockX;
      if (typeof e.lockY === "number") e.y = e.lockY;
      if (typeof e.lockW === "number" && e.lockW > 0) e.w = e.lockW;
      if (typeof e.lockH === "number" && e.lockH > 0) e.h = e.lockH;

      const rate = (e.fadeRate && e.fadeRate > 0) ? e.fadeRate : (1 / ENEMY_DEATH_FADE_SECS);
      e.fade = Math.max(0, (typeof e.fade === "number" ? e.fade : 1) - dt * rate);

      if (e.fade <= 0){
        enemies.splice(i, 1);
      }
    }
  }


  // wave clear now depends on reaching the maze exit
  if (mazeCompleted){
    // If player beat INSANITY WAVE: 10 (wave 21), show a win screen.
    if (wave === 21){
      showWinOverlay();
      return;
    }

    if (!mazeSummaryActive){
      showMazeSummaryAndPauseAdvance();
    }
    return;
  }
}


function healPlayer(amount){
  // Heal up to 100%. Used by frog enemies.
  if (isDead) return;
  health = Math.min(1, health + amount);
}


function drawShieldRing(){
  if (!(gameState === STATE.PLAYING && shieldActive)) return;

  const r = player.w * SHIELD_RADIUS_MULT;
  const segments = 72;
  const baseHue = (time * 180) % 360; // shifting rainbow
  ctx.save();
  ctx.translate(player.x, player.y);

  // Outer glow
  ctx.lineWidth = 6;
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(0,255,255,0.35)";

  for (let i = 0; i < segments; i++){
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const hue = (baseHue + i * (360 / segments)) % 360;
    ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.95)`;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a1);
    ctx.stroke();
  }

  // Small inner ring to make it feel "contained"
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.arc(0, 0, r - 6, 0, Math.PI*2);
  ctx.stroke();

  // Shield HP pips (more pips = more remaining shield)
  const PIPS = 6;
  const pipR = 3.2;
  const hpPerPip = SHIELD_HP_MAX / PIPS;
  const filled = Math.max(0, Math.min(PIPS, Math.ceil(shieldHP / hpPerPip)));

  for (let i = 0; i < PIPS; i++){
    const on = (i < filled);
    const px = (i - (PIPS-1)/2) * 10;
    const py = -r - 12;
    ctx.fillStyle = on ? "rgba(0,255,255,0.9)" : "rgba(0,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(px, py, pipR, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function draw(){
  syncStartMenuHudLayerMode();
  syncPlayerProximityHudFade();
  drawStarfield();
  drawMaze();

  // v1.96+: draw player death particles
  if (deathParticles.length){
    ctx.save();
    ctx.fillStyle = "#ff0";
    for (const p of deathParticles){
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.restore();
  }

  // v1.96: Wave banner popup
  if (gameState === STATE.PLAYING && waveBanner.t > 0){
    const p = Math.min(1, waveBanner.t / 1.35);
    const alpha = Math.min(1, 0.2 + p);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = waveBanner.color || "#00ff66";
    ctx.shadowColor = "rgba(0,255,102,0.35)";
    ctx.shadowBlur = 12;
    ctx.fillText(waveBanner.text, canvas.width/2, Math.max(60, canvas.height*0.12));
    ctx.restore();
  }

  // v1.96: death particles
  if (deathParticles.length){
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const p of deathParticles){
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillRect(p.x - p.s/2, p.y - p.s/2, p.s, p.s);
    }
    ctx.restore();
  }

  // player flicker on invulnerability
  const flicker = player.invuln > 0 && Math.floor(time * 20) % 2 === 0;

  function drawPlayerSprite(alpha = 1, xOff = 0, yOff = 0, extraWidthScale = 1, extraScaleY = 1){
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(player.x + xOff, player.y + yOff);

    applySpiralPlayerDrawFx();

    // v2.04: fake 2.5D turn by squeezing the sprite through a narrow midpoint.
    const turnEase = Math.sin(Math.min(1, Math.max(0, playerTurnT)) * Math.PI);
    const widthScale = (1 - turnEase * 0.82) * extraWidthScale;
    const facingScale = playerFacing >= 0 ? -1 : 1; // right = flipped horizontally
    ctx.scale(facingScale * Math.max(0.12, widthScale), extraScaleY);

    ctx.drawImage(playerImg, -player.w/2, -player.h/2, player.w, player.h);
    ctx.restore();
  }

  function drawPlayerGhosts(){
    if (!playerGhosts.length) return;
    for (const g of playerGhosts){
      const t = Math.max(0, g.life / g.ttl);
      drawPlayerSprite(0.12 * t, g.xOff, g.yOff, g.widthScale, g.scaleY);
    }
  }

  const shouldDrawPlayer = (gameState === STATE.PLAYING);
  if (shouldDrawPlayer && !flicker){
    drawPlayerGhosts();
    drawPlayerSprite();
  }

    // v1.96: shield ring (RMB hold)
  drawShieldRing();

// v1.96: always-on health bar under the player
  if (gameState === STATE.PLAYING){
    const barW = player.w;
    const barH = 7;
    const bx = player.x - barW/2;
    const by = player.y + player.h/2 + 10;
    const maxHearts = Math.max(1, MAX_HEARTS|0);
    const currentHearts = Math.max(0, Math.min(maxHearts, health * maxHearts));
    const healthBarPercent = Math.max(0, Math.min(100, (currentHearts / maxHearts) * 100));

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(bx-1, by-1, barW+2, barH+2);

    ctx.fillStyle = "rgba(255,0,0,0.22)";
    ctx.fillRect(bx, by, barW, barH);

    ctx.fillStyle = "rgba(0,255,102,0.85)";
    ctx.fillRect(bx, by, barW * (healthBarPercent / 100), barH);
    ctx.restore();
  }

// v1.96: aim indicator (yellow triangle orbiting around player, pointing where you're aiming)
if (gameState === STATE.PLAYING){
  const a = aimAngleSmoothed;
  const orbitR = player.w * 0.62;
  const tx = player.x + Math.cos(a) * orbitR;
  const ty = player.y + Math.sin(a) * orbitR;

  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(a); // point outward
  ctx.fillStyle = "rgba(255,255,0,0.95)";
  ctx.beginPath();
  ctx.moveTo(16, 0);     // tip
  ctx.lineTo(-8, -7);    // base left
  ctx.lineTo(-8, 7);     // base right
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

  // UFO + bomb
  drawUFO();
  drawBomb();

  // enemies
  for (const e of enemies){
    // v1.96: frog enemies get a pulsing green aura ring
    if (e.isFrog){
      const pulse = 1 + 0.12 * Math.sin(time * 6.0);
      const r = Math.max(e.w, e.h) * 0.70 * pulse;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "rgba(0,255,0,0.10)";
      ctx.strokeStyle = "rgba(0,255,0,0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // v1.96: enemy flash red on hit + fade out on death
    const alpha = (e.dying ? Math.max(0, Math.min(1, e.fade)) : 1);
    const deathProgress = e.dying ? (1 - alpha) : 0;
    // Visual-only death explosion. Keep e.x/e.y/e.w/e.h untouched so bullet and contact hitboxes stay rectangular and unchanged.
    const deathGrow = e.dying ? (1 + deathProgress * ENEMY_DEATH_GROW_SCALE) : 1;
    const drawW = e.w * deathGrow;
    const drawH = e.h * deathGrow;
    const ex = e.x - drawW/2, ey = e.y - drawH/2;
    const enemySource = isGameSpeedFrozen() ? (getStaticFrameForImage(e.img) || e.img) : e.img;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (e.dying){
      // Animated GIF/WEBP enemies normally render as DOM <img> elements above the canvas.
      // Force dying enemies back through canvas so expansion + fisheye bulge actually affect them.
      hideAnimatedGifSprite(e);
      const drewBulgedEnemy = drawEnemyBulgedImage(ctx, enemySource, ex, ey, drawW, drawH, deathProgress, alpha);
      if (!drewBulgedEnemy) ctx.drawImage(enemySource, ex, ey, drawW, drawH);
      if (e.hitFlash > 0){
        const p = Math.max(0, Math.min(1, e.hitFlash / ENEMY_HIT_FLASH_SECS));
        drawEnemyPixelMaskedHitFlash(ctx, enemySource, ex, ey, drawW, drawH, p, alpha, deathProgress);
      }
    } else {
      const drewDomEnemy = syncAnimatedGifSprite(
        e,
        e.img,
        ex,
        ey,
        drawW,
        drawH,
        { className:"enemy-gif-sprite", alpha, hitFlash:e.hitFlash > 0 }
      );
      if (!drewDomEnemy){
        ctx.drawImage(enemySource, ex, ey, drawW, drawH);
        if (e.hitFlash > 0){
          const p = Math.max(0, Math.min(1, e.hitFlash / ENEMY_HIT_FLASH_SECS));
          drawEnemyPixelMaskedHitFlash(ctx, enemySource, ex, ey, drawW, drawH, p, alpha);
        }
      }
    }

// Dragon marker: upside-down red equilateral triangle (because dragons deserve drama)
if (isDragonEnemy(e)){
  const r = Math.max(e.w, e.h) * 0.78;
  ctx.save();
  ctx.strokeStyle = "rgba(255,0,0,0.85)";
  ctx.lineWidth = 3;
  drawInvertedTriangle(e.x, e.y, r);
  ctx.restore();
}

    ctx.restore();
  }

  // bullets (player)
  for (const b of bullets){
    if (b.glitchEnergy){
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const dirX = b.vx / speed;
      const dirY = b.vy / speed;
      const perpX = -dirY;
      const perpY = dirX;
      const phase = (b.glitchPhase || 0) + time * 42;
      const tailLen = 30 + b.r * 2.4;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "square";
      ctx.strokeStyle = "rgba(0,255,240,0.42)";
      ctx.lineWidth = Math.max(3, b.r * 0.95);
      ctx.beginPath();
      ctx.moveTo(b.x - dirX * tailLen + perpX * Math.sin(phase) * b.r, b.y - dirY * tailLen + perpY * Math.sin(phase) * b.r);
      ctx.lineTo(b.x + dirX * b.r, b.y + dirY * b.r);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,35,216,0.72)";
      ctx.lineWidth = Math.max(1.4, b.r * 0.34);
      ctx.beginPath();
      ctx.moveTo(b.x - dirX * (tailLen * 0.72) - perpX * b.r * 0.8, b.y - dirY * (tailLen * 0.72) - perpY * b.r * 0.8);
      ctx.lineTo(b.x + dirX * b.r * 0.7 + perpX * Math.cos(phase) * b.r * 0.5, b.y + dirY * b.r * 0.7 + perpY * Math.cos(phase) * b.r * 0.5);
      ctx.stroke();
      ctx.fillStyle = "#faffff";
      ctx.fillRect(b.x - b.r * 0.55, b.y - b.r * 0.55, b.r * 1.1, b.r * 1.1);
      ctx.fillStyle = "rgba(0,255,240,0.65)";
      ctx.fillRect(b.x - dirX * b.r - perpX * b.r, b.y - dirY * b.r - perpY * b.r, b.r * 1.8, b.r * 0.55);
      ctx.restore();
      continue;
    }
    if (typeof b.lightningBranchIndex === "number"){
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const dirX = b.vx / speed;
      const dirY = b.vy / speed;
      const perpX = -dirY;
      const perpY = dirX;
      const boltLen = BIG_BULLET_LIGHTNING_TRAIL_LEN + (b.r * 1.9);
      const tipX = b.x + dirX * (b.r * 0.9);
      const tipY = b.y + dirY * (b.r * 0.9);
      const baseX = b.x - dirX * (b.r * 1.8);
      const baseY = b.y - dirY * (b.r * 1.8);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = b.lightningBranchIndex === 0 ? "rgba(110,220,255,0.45)" : "rgba(80,170,255,0.38)";
      ctx.lineWidth = Math.max(2.2, b.r * 0.95);
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i <= 5; i++){
        const t = i / 5;
        const sway = (i === 0 || i === 4)
          ? 0
          : Math.sin((time * 34) + (b.x * 0.05) + (b.y * 0.03) + (i * 1.7) + (b.lightningBranchIndex * 1.9)) * (b.r * 0.55);
        const px = b.x + dirX * (boltLen * (0.28 - t)) + perpX * sway;
        const py = b.y + dirY * (boltLen * (0.28 - t)) + perpY * sway;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.strokeStyle = b.lightningBranchIndex === 0 ? "rgba(255,252,210,0.98)" : "rgba(175,245,255,0.94)";
      ctx.lineWidth = Math.max(1.1, b.r * 0.38);
      ctx.beginPath();
      for (let i = 0; i <= 5; i++){
        const t = i / 5;
        const sway = (i === 0 || i === 5)
          ? 0
          : Math.sin((time * 34) + (b.x * 0.05) + (b.y * 0.03) + (i * 1.7) + (b.lightningBranchIndex * 1.9)) * (b.r * 0.38);
        const px = b.x + dirX * (boltLen * (0.28 - t)) + perpX * sway;
        const py = b.y + dirY * (boltLen * (0.28 - t)) + perpY * sway;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = b.lightningBranchIndex === 0 ? "#fff6a0" : "#9fe8ff";
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseX + perpX * (b.r * 0.72), baseY + perpY * (b.r * 0.72));
      ctx.lineTo(baseX - perpX * (b.r * 0.72), baseY - perpY * (b.r * 0.72));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // bullets (enemy)
  ctx.fillStyle = "rgba(255,0,0,0.95)";
  for (const b of enemyBullets){
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
  }
  // v1.96: keep debug grid numbers aligned with current formation
  ENEMY_ROWS = formationRows;
  ENEMY_COLS = formationCols;

  overlay.innerHTML =
    `Bananaman Shooter v1.96<br>` +
    `State: ${gameState}<br>` +
    `Score: ${score} | Health: ${Math.round(health*100)}% | Wave: ${wave}<br>` +
    `Shield: ${shieldActive ? (Math.round((shieldHP/SHIELD_HP_MAX)*100) + "%") : "off"} | CD: ${shieldCooldown.toFixed(1)}s<br>` +
    `Enemies: ${enemies.length} (${ENEMY_ROWS}x${ENEMY_COLS})<br>` +
    `Maze: ${maze ? (maze.cols + "x" + maze.rows + " @ " + maze.cellSize + "px tiles / light " + (maze.revealRadiusPx || 0) + "px") : "none"}${mazeCompleted ? " | EXIT" : ""}<br>` +
    `Enemy pool: ${enemyImages.length || 0} images<br>` +
    `Bullets: ${bullets.length} | Enemy Bullets: ${enemyBullets.length}<br>` +
    `Fire CD: ${fireCooldown.toFixed(2)}s (target ${getPlayerFireCooldown().toFixed(2)}s)<br>` +
    `Player: ${player.w}px | Gap: ${FORMATION_PLAYER_GAP}px<br>` +
    `ESC: Menu`;

  updateAccuracyScoreHUD();
  updateTimerHUD();

  // v1.96: corner HUD updates
  if (gameState === STATE.PLAYING){
    livesText.textContent = livesInfiniteActive ? "x∞" : ("x" + lives);
    _syncBombHud();
  } else if (gameState === STATE.MENU || gameState === STATE.OPTIONS || gameState === STATE.CONTROLS || gameState === STATE.CHEATS){
    renderMenuHudPreview();
  }
  if (gameState === STATE.PLAYING){
    const info = getStageInfo(wave);
    const clampedWave = Math.min(wave, info.end);
    const lab = getWaveLabel(wave);
    const stageHudEl = document.getElementById("stageHud");
    updateMusicHud(lab.text);
    stageHudEl.style.color = lab.color;
  } else if (gameState === STATE.MENU || gameState === STATE.OPTIONS || gameState === STATE.CONTROLS || gameState === STATE.CHEATS){
    const stageHudEl = document.getElementById("stageHud");
    updateMusicHud("Start Menu");
    stageHudEl.style.color = "#ffffff";
  } else {
    updateMusicHud("");
  }

  // Post FX pass (subtle)
  if (VIDEO_FX_ENABLED){
    const beat = getBeat();
    applyChromaticAberration(beat);
  }

  // v1.96: Glitch spiral burst (Tab key)
  if (GLITCH_SPIRAL_T > 0){
    const strength = Math.max(0, Math.min(1, GLITCH_SPIRAL_T / GLITCH_SPIRAL_DUR));
    applyGlitchSpiral(strength);
  }

}

let lastT = performance.now();

function updateHearts(){
  // v1.96: Hearts are configurable (MAX_HEARTS), and shields/bomb-armor show here too.
  const maxH = Math.max(1, MAX_HEARTS|0);
  const currentHearts = Math.max(0, Math.min(maxH, health * maxH));
  const heartsAreInfinite = !!(infiniteModeActive || heartsInfiniteActive);
  const shieldsAreInfinite = !!(infiniteModeActive || shieldsInfiniteActive);
  const infinityLabel = "x♾️";
  const maxVisibleHudIcons = 5;

  // Convert 0..1 health into "filled hearts" count.
  const hearts = Math.max(0, Math.min(maxH, Math.ceil(currentHearts - 0.000001)));

  const full = "❤️";
  const empty = "❌";
  let out = "";
  if (heartsAreInfinite){
    out += `${full}${infinityLabel}`;
  } else {
    const visibleMaxH = Math.min(maxVisibleHudIcons, maxH);
    for (let i = 0; i < visibleMaxH; i++){
      out += (i < hearts ? full : empty) + " ";
    }
    if (hearts > maxVisibleHudIcons) out += `<span class="heartsExtra">+${hearts - maxVisibleHudIcons}</span> `;
  }

  // v1.96: shield pips (one-hit armor) next to hearts
  if (shieldsAreInfinite){
    out += "  🛡️" + infinityLabel;
  } else if (shieldPips > 0){
    const show = Math.min(maxVisibleHudIcons, shieldPips);
    out += "  " + "🛡️ ".repeat(show);
    if (shieldPips > maxVisibleHudIcons) out += "+" + (shieldPips - maxVisibleHudIcons) + " ";
  }

  // v1.96: bonus armor indicator next to hearts
  let armorIcon = "";
  if (bonusArmor > 0) armorIcon = "🛡️";
  else if (bonusArmorBrokenT > 0) armorIcon = "❌";
  if (armorIcon) out += "  " + armorIcon;

  // v1.96: infinite marker so you remember you're cheating
  if (!heartsAreInfinite && !shieldsAreInfinite && (infiniteModeActive || heartsInfiniteActive || shieldsInfiniteActive || bombsInfiniteActive || livesInfiniteActive)) out += "  ♾️";

  const el = document.getElementById("heartsHud");
  if (el){
    el.innerHTML = out.trim();
    el.style.display = (gameState === STATE.PLAYING || gameState === STATE.MENU || gameState === STATE.OPTIONS || gameState === STATE.CONTROLS) ? "block" : "none";
  }
}

function loop(t){
  // v1.96: Game speed knob. We cap raw dt to prevent big frame hitch jumps,
  // then multiply by GAME_SPEED_MULT (5 = 1.0x, 1 = 0.2x, 10 = 2.0x).
  const rawDt = Math.min(0.033, (t - lastT) / 1000);
  const dt = rawDt * (GAME_SPEED_MULT || 1.0) * getMobileGameplayTimeScale();
  window._dt = dt;
  lastT = t;
  update(dt);
draw();
  updateHearts();
  requestAnimationFrame(loop);
}

/* =======================
   Boot
======================= */
player.x = canvas.width / 2;
player.y = canvas.height / 2;

// v1.96: default aim straight up until the player moves the pointer
aimX = player.x;
aimY = player.y - 200;
aimAngle = -Math.PI/2;
aimAngleSmoothed = -Math.PI/2;

resetStarfield();
resize(); // also resets starfield + anchors player
if (document.readyState === "complete"){
  requestAnimationFrame(() => applyInitialLevel2BootState());
} else {
  window.addEventListener("load", () => {
    requestAnimationFrame(() => applyInitialLevel2BootState());
  }, { once: true });
}

requestAnimationFrame(loop);
