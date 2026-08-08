/* ======================================================================
  PROJECT CHANGELOG / REMOVAL LOG
========================================================================
[REMOVAL LOG]

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
  Changed: Bomb-killing a dragon.gif enemy no longer grants free armor.
  Changed: Frog kills no longer heal the player or award free lives.

====================================================================== */

// NOTE: If this runtime file changes, also update the visible "Last updated:"
// timestamp in games/shooter-game/assets/levels/shooter-game-level1.html and
// games/shooter-game/assets/levels/shooter-game-level2.html to the current time.

/* =======================
   Paths (EDIT IF NEEDED)
======================= */
const ENEMY_WEBP_BASE = "/dead/games/shooter-game/assets/enemy-webps/";
const ENEMY_WEBP_INDEX_URL = "/dead/games/shooter-game/assets/JSON/enemy-webps.json";
const PLAYER_IMG_URL = "/dead/games/shooter-game/assets/bananarama.gif";
const BOSS_IMG_URL = ENEMY_WEBP_BASE + "180px-NO_U_cycle.webp";
const ENEMY_ASSET_BASE = ENEMY_WEBP_BASE; // kept for legacy enemy-path code
const AUDIO_HIT = "/dead/games/shooter-game/assets/audio/hitmarker.mp3";
const AUDIO_OOF = "/dead/games/shooter-game/assets/audio/oof.mp3";
const AUDIO_UI_HOVER = "/dead/games/shooter-game/assets/audio/bone-crack.mp3";
const AUDIO_UI_SELECT = "/dead/games/shooter-game/assets/audio/arcade-clink.mp3";


/* =======================
   Audio
======================= */
const AUDIO_BG_MUSIC = "/dead/games/shooter-game/assets/audio/spaceinvaders.mp3";
const AUDIO_MENU_MUSIC = "/dead/games/shooter-game/assets/audio/wii-shop-music.mp3";
const AUDIO_EXTRA_MUSIC = "/dead/games/shooter-game/assets/audio/do-that-there.mp3";
const AUDIO_DEATH_YELL = "/dead/games/shooter-game/assets/audio/link-yell.mp3";
const MUSIC_TRACKS = {
  "wii-shop-music.mp3": AUDIO_MENU_MUSIC,
  "spaceinvaders.mp3": AUDIO_BG_MUSIC,
  "do-that-there.mp3": AUDIO_EXTRA_MUSIC
};

// Background music (loops). We start it on the first user interaction (autoplay rules).
const musicBg = new Audio(AUDIO_BG_MUSIC);
musicBg.loop = true;
musicBg.preload = "auto";
musicBg.volume = 0.6;

// Pre-game/menu music. Runs only before gameplay starts, then hands off to level music.
const menuMusicBg = new Audio(AUDIO_MENU_MUSIC);
menuMusicBg.loop = true;
menuMusicBg.preload = "auto";
menuMusicBg.volume = 0.45;
const activeSfxClones = new Set();

// Death yell (plays once when GAME OVER screen appears)
const sfxDeath = new Audio(AUDIO_DEATH_YELL);
sfxDeath.preload = "auto";
sfxDeath.volume = 0.10;

// Global mute toggle (M key)
let audioMuted = false;
let manualAudioMuted = false;
const audioRetryTokens = new WeakMap();

function isMuteNicknameActive(){
  try{ return String(getSavedChatNicknameValue ? getSavedChatNicknameValue() : "").trim().toLowerCase() === "_mute"; }catch(_){ return false; }
}
function effectiveAudioMuted(){
  return !!manualAudioMuted || isMuteNicknameActive();
}
function musicFilenameFromPath(path){
  const raw = String(path || "").split("?")[0].split("#")[0];
  return raw.substring(raw.lastIndexOf("/") + 1) || "spaceinvaders.mp3";
}
function setAudioElementTrack(audioEl, filename, restart=true){
  const src = MUSIC_TRACKS[filename];
  if (!audioEl || !src) return false;
  const wasPlaying = !audioEl.paused;
  try{ audioEl.pause(); }catch(_){ }
  const retryToken = beginAudioRetrySession(audioEl);
  try{
    if (!String(audioEl.src || "").endsWith(src)) audioEl.src = src;
    if (restart) audioEl.currentTime = 0;
    audioEl.loop = true;
    audioEl.load();
  }catch(_){ }
  if (wasPlaying && !audioMuted) tryPlayWithRetry(audioEl, 30, 80, retryToken);
  return true;
}
function getActiveMusicAudioElement(){
  return isPreGameplayMenuAudioState() ? menuMusicBg : musicBg;
}
function getActiveMusicFilename(){
  if (effectiveAudioMuted()) return "Muted";
  return musicFilenameFromPath(getActiveMusicAudioElement().src || getActiveMusicAudioElement().currentSrc || (isPreGameplayMenuAudioState() ? AUDIO_MENU_MUSIC : AUDIO_BG_MUSIC));
}
function setHudMusicSelection(filename){
  if (filename === "Muted"){
    setMuteOptionEnabled(true);
    return;
  }
  if (!MUSIC_TRACKS[filename]) return;
  manualAudioMuted = false;
  audioMuted = effectiveAudioMuted();
  const activeAudio = getActiveMusicAudioElement();
  setAudioElementTrack(activeAudio, filename, true);
  applyMuteState();
  if (!audioMuted){
    if (isPreGameplayMenuAudioState()) ensureMenuMusicPlaying(true);
    else if (gameState === STATE.PLAYING) ensureMusicPlaying(true);
  }
  updateMusicHud();
}

function applyMuteState(){
  audioMuted = effectiveAudioMuted();
  const m = !!audioMuted;
  musicBg.muted = m;
  menuMusicBg.muted = m;
  sfxDeath.muted = m;
  sfxHit.muted = m;
  sfxOof.muted = m;
  sfxUiHover.muted = m;
  sfxUiSelect.muted = m;
  activeSfxClones.forEach((clone) => {
    try{ clone.muted = m; }catch(e){}
  });
  syncStartMenuMuteIcon();
}

function setMuteOptionEnabled(shouldEnable){
  manualAudioMuted = !!shouldEnable;
  audioMuted = effectiveAudioMuted();
  applyMuteState();
  if (!audioMuted){
    if (gameState === STATE.PLAYING) ensureMusicPlaying();
    else if (isPreGameplayMenuAudioState()) ensureMenuMusicPlaying();
  }
  syncCheatsMenuState();
}

function beginAudioRetrySession(audioEl){
  const nextToken = (audioRetryTokens.get(audioEl) || 0) + 1;
  audioRetryTokens.set(audioEl, nextToken);
  return nextToken;
}

function cancelAudioRetrySession(audioEl){
  if (!audioEl) return;
  beginAudioRetrySession(audioEl);
}

function tryPlayWithRetry(audioEl, retries=20, delayMs=80, retryToken=null){
  if (!audioEl || audioMuted) return;
  const activeToken = retryToken ?? beginAudioRetrySession(audioEl);
  if (audioRetryTokens.get(audioEl) !== activeToken) return;
  try{
    audioEl.muted = !!audioMuted;
  }catch(e){}
  try{
    const p = audioEl.play();
    if (p && typeof p.catch === "function"){
      p.catch(() => {
        if (audioRetryTokens.get(audioEl) !== activeToken) return;
        // Some browsers reject play() briefly even when audio is "unlocked".
        // We retry a handful of times so the sound lands as soon as it's allowed.
        if (retries > 0){
          setTimeout(() => tryPlayWithRetry(audioEl, retries - 1, delayMs, activeToken), delayMs);
        }
      });
    }
  }catch(e){
    if (audioRetryTokens.get(audioEl) !== activeToken) return;
    if (retries > 0){
      setTimeout(() => tryPlayWithRetry(audioEl, retries - 1, delayMs, activeToken), delayMs);
    }
  }
}

function isPreGameplayMenuAudioState(){
  try{
    return gameState === STATE.MENU
      || gameState === STATE.HUB
      || gameState === STATE.OPTIONS
      || gameState === STATE.CHEATS
      || gameState === STATE.CONTROLS;
  }catch(e){
    return false;
  }
}

function ensureMenuMusicPlaying(restart=false){
  // Start/resume looping Wii Shop-style menu music while the player is still in pre-game menus.
  const retryToken = beginAudioRetrySession(menuMusicBg);
  try{
    if (restart) menuMusicBg.currentTime = 0;
    menuMusicBg.loop = true;
  }catch(e){}
  if (audioMuted || !isPreGameplayMenuAudioState()) return;
  try{
    if (!musicBg.paused) musicBg.pause();
  }catch(e){}
  try{
    if (!restart && !menuMusicBg.paused) return;
    tryPlayWithRetry(menuMusicBg, 30, 80, retryToken);
  }catch(e){}
}

function stopMenuMusic(reset=false){
  cancelAudioRetrySession(menuMusicBg);
  try{
    menuMusicBg.pause();
    if (reset) menuMusicBg.currentTime = 0;
  }catch(e){}
}

function ensureMusicPlaying(restart=false){
  stopMenuMusic(true);
  const retryToken = beginAudioRetrySession(musicBg);
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
    tryPlayWithRetry(musicBg, 30, 80, retryToken);
  }catch(e){}
}

function stopMusic(){
  cancelAudioRetrySession(musicBg);
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

// Screen-glitch spiral burst
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

function syncWholeScreenVideoFx(beat=0){
  const enabled = !!VIDEO_FX_ENABLED;
  document.body.classList.toggle("videoFxActive", enabled);
  if (!enabled) return;
  const hue = (time * 10 + beat * 55) % 360;
  const shift = 1.2 + beat * 2.8;
  const overlayOpacity = Math.max(0.10, Math.min(0.28, 0.13 + beat * 0.14));
  document.documentElement.style.setProperty("--video-fx-hue", `${hue}deg`);
  document.documentElement.style.setProperty("--video-fx-shift", `${shift}px`);
  document.documentElement.style.setProperty("--video-fx-overlay-opacity", String(overlayOpacity));
}

function setVideoFxEnabled(enabled){
  VIDEO_FX_ENABLED = !!enabled;
  syncWholeScreenVideoFx(getBeat());
  syncCheatsMenuState();
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
const winPanel = document.getElementById("winPanel");
const winStatsScrollArea = document.getElementById("winStatsScrollArea");
const winStatsMarqueeTrack = document.getElementById("winStatsMarqueeTrack");
const winStatsMarqueeContent = document.getElementById("winStatsMarqueeContent");
const winStatsMarqueeClone = document.getElementById("winStatsMarqueeClone");
const btnContinue = document.getElementById("btnContinue");

const WIN_STATS_MARQUEE_PIXELS_PER_SECOND = 22;
let winStatsMarqueeRafId = 0;
let winStatsMarqueeLastTimestamp = 0;
let winStatsMarqueeSyncRafId = 0;
let winStatsMarqueeLoopDistance = 0;
let winStatsMarqueeOffset = 0;

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
const pauseCommand = document.getElementById("pauseCommand");
const pauseCmdSuggest = document.getElementById("pauseCmdSuggest");
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
    // Unpause and return to start menu
    setPaused(false);
    stopMusic();
    resetScoreTrackedStartOptionsToDefaults();
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
  if (!pauseOverlay || gameState !== STATE.PLAYING || isDead || !canOpenStore()) return;
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
  hideControlsPreviewMenu({ restoreControlsMenu: false });
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
  updateControlsDisplay();
  renderControlsBindingList();
  fitControlsMenuToViewport();
  controlsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncControlsControllerFocus();
  else clearControllerFocus();
}
function hidePauseControlsMenu(){
  if (!pauseControlsOpen) return;
  hideControlsPreviewMenu({ restoreControlsMenu: false });
  pauseControlsOpen = false;
  controlsMenu.classList.remove("pauseControlsMode");
  controlsMenu.style.display = "none";
  pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  uiRoot.style.display = "none";
  unlockControlsInputMode();
  cancelBindingEdit();
  pauseFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncPauseControllerFocus();
  else clearControllerFocus();
}
function openMenuHubFromPause(){
  // v2.XX: The Pause menu button now opens the same Menu Hub used by the Start Menu.
  // Close pause-specific overlays first so the hub is the only visible menu panel,
  // instead of Start/Pause/Hub forming a cursed UI conga line.
  optionsOpenedFromPause = false;
  cheatsOpenedFromPause = false;
  pauseControlsOpen = false;
  if (pauseOverlay){
    pauseOverlay.classList.remove("pauseControlsVisible", "scoreStoreVisible");
    pauseOverlay.style.display = "none";
  }
  if (uiRoot) uiRoot.classList.remove("pauseControlsOpen");
  if (controlsMenu) controlsMenu.classList.remove("pauseControlsMode");
  // Keep isPaused true so the gameplay layer stays frozen while the Hub replaces the Pause menu.
  openMenuHub({ keepGameplayPaused:true, fromPause:true });

  // v2.XX: Opening the Hub from Pause must seed controller focus into the
  // Hub itself. The Start-menu path already gets this naturally, but the
  // Pause path can lose the visible .controllerFocus class when the pause
  // overlay is hidden during the same input frame. Wonderful.
  if (activeInputMode === INPUT_MODE_CONTROLLER){
    resetMenuHubControllerFocus();
    selectMenuHubTab("images", false);
    syncMenuHubControllerFocus();
    requestAnimationFrame(() => {
      if (gameState === STATE.HUB && menuHubOpenedFromPause && activeInputMode === INPUT_MODE_CONTROLLER){
        syncMenuHubControllerFocus();
      }
    });
    setTimeout(() => {
      if (gameState === STATE.HUB && menuHubOpenedFromPause && activeInputMode === INPUT_MODE_CONTROLLER){
        syncMenuHubControllerFocus();
      }
    }, 0);
  }
}
if (btnPauseOpenChat){
  btnPauseOpenChat.addEventListener("click", () => {
    openMenuHubFromPause();
  });
}

// Temporary glitch spiral post effect (triggered by Tab)
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
  if (typeof syncCheatsMenuState === "function") syncCheatsMenuState();
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
  const heartsHud = getHeartsHudEl();
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
    if (previewHearts > maxVisibleHudIcons) out += `<span class="hudExtra">+${previewHearts - maxVisibleHudIcons}</span> `;
  }

  if (previewShieldsInfinite) out += "  🛡️x♾️";
  else if (previewShields > 0){
    const visibleShields = Math.min(maxVisibleHudIcons, previewShields);
    out += "  " + "🛡️ ".repeat(visibleShields);
    if (previewShields > maxVisibleHudIcons) out += `<span class="hudExtra">+${previewShields - maxVisibleHudIcons}</span> `;
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
  if (!raw) return { ok:false, message:"No command provided" };

  // v1.96: /help -> list commands alphabetically inside the pause panel
  if (raw === "/help"){
    showHelp();
    return { ok:true, suppressChatResult:true };
  }

  // Hidden hard reset. Not listed in /help, because the big red button does not need a brochure.
  if (raw.toLowerCase() === "/reset"){
    return runHiddenResetCommand();
  }

  // Hidden nickname aliases. Not listed in /help, because secrets need doors.
  const lowerRaw = raw.toLowerCase();
  if (lowerRaw === "/jinclops" || lowerRaw === "/tektite"){
    const secretNickname = lowerRaw === "/jinclops" ? "Jinclops" : "Tektite";
    applyNicknameFromControls(secretNickname, true);
    return { ok:true, message:`Nickname set to ${secretNickname}` };
  }

  if (raw.startsWith("/cheatermode")){
    const arg = normalizeCheatermodeUnlockText(raw.slice("/cheatermode".length));
    if (!isCheatermodeCountdownPhrase(arg) && !isCheatermodeInstantPhrase(arg)){
      return { ok:false, message:"Usage: /cheatermode [type cheatermode]" };
    }
    unlockCheatermode("chat");
    return { ok:true, message:"Cheat commands unlocked" };
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
    return { ok:true, message:"/fullscreen executed" };
  }

  // /game_speed [#] -> set gameplay speed scale. 0 freezes, 1 normal, -5 slowest, 20 fastest.
  if (raw.startsWith("/game_speed")){
    const arg = raw.slice("/game_speed".length).trim();
    if (!arg){
      return { ok:true, message:`Game speed is ${clampGameSpeedValue(START_GAME_SPEED)} (${GAME_SPEED_MULT === 0 ? "frozen" : GAME_SPEED_MULT + "x"})` };
    }
    const parsed = Number(arg);
    if (!Number.isFinite(parsed)){
      return { ok:false, message:"Usage: /game_speed [-5..20], where 0 freezes and 1 is normal" };
    }
    const speed = applyGameSpeedValue(parsed);
    return { ok:true, message:`Game speed set to ${speed}${speed === 0 ? " (frozen)" : ""}` };
  }

  // /background_color [#RRGGBB] -> set starfield background color
  if (raw.startsWith("/background_color")){
    const arg = raw.slice("/background_color".length).trim();
    if (!arg){
      return { ok:true, message:`Background color is ${normalizeHexColor(starfieldBgOverride || "#000000") || "#000000"}` };
    }
    const normalized = normalizeHexColor(arg);
    if (!normalized){
      return { ok:false, message:"Usage: /background_color #000000" };
    }
    starfieldBgOverride = normalized;
    syncBackgroundColorControls();
    return { ok:true, message:`Background color set to ${normalized}` };
  }

  // /video_fx -> toggle chromatic aberration + hue drift
  if (raw === "/video_fx"){
    setVideoFxEnabled(!VIDEO_FX_ENABLED);
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
      syncCheatsMenuState();
      return { ok:true, message:"Shoot mode set to normal bullets" };
    }
    if (arg === "big_bullets" || arg === "big-bullets"){
      shootCheatMode = "big_bullets";
      glitchBackgroundPulse = 0;
      lockScoreTrackingState();
      syncCheatsMenuState();
      return { ok:true, message:"Shoot mode set to big bullets" };
    }
    if (arg === "glitch"){
      shootCheatMode = "glitch";
      bigBulletBuffEndTime = 0;
      glitchBackgroundPulse = Math.max(glitchBackgroundPulse, 0.85);
      lockScoreTrackingState();
      syncCheatsMenuState();
      return { ok:true, message:"Shoot mode set to EMT glitch cannon" };
    }
    return { ok:false, message:"Usage: /shoot [normal|big_bullets|glitch]" };
  }

  // /color_invert -> toggle invert colors mode (same as Options menu)
  if (raw === "/color_invert"){
    INVERT_COLORS = !INVERT_COLORS;
    applyInvertColors();
    syncCheatsMenuState();
    return { ok:true, message:`Invert colors ${INVERT_COLORS ? "enabled" : "disabled"}` };
  }

  if (raw.startsWith(BG_CMD)){
    const arg = raw.slice(BG_CMD.length).trim();

    if (!arg){
      starfieldBgOverride = null;
      return { ok:true, message:"/background_color reset" };
    }

    const hexMatch = arg.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
    if (hexMatch){
      starfieldBgOverride = "#" + hexMatch[1];
      return { ok:true, message:`/background_color ${starfieldBgOverride}` };
    }

    starfieldBgOverride = arg;
    return { ok:true, message:`/background_color ${arg}` };
  }

  try{ console.log("[PAUSE CMD]", raw); }catch(e){}
  return { ok:false, message:`${raw.split(/\s+/)[0]} is not a known command` };
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "tektite:chat-visibility"){
    parentChatVisible = !!data.visible;
    parentChatValuePickerActive = !!data.valuePickerActive;
    parentChatValuePickerCommand = parentChatValuePickerActive ? String(data.valuePickerCommand || "").trim().toLowerCase() : "";
    if (parentChatVisible) clearControllerFocus();
    else syncControllerFocusForCurrentState();
    return;
  }

  if (data.type === "tektite:pause-for-chat"){
    if (gameState === STATE.PLAYING && !isPaused && !isDead && !(deathOverlay && deathOverlay.style.display === "flex")){
      setPaused(true);
    }
    return;
  }

  if (data.type === "tektite:fullscreen-state"){
    syncFullscreenOptionState(!!data.active);
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

    // Autocomplete cycling for slash commands and /background_color values.
    if (ev.key === "Tab" || ev.key === "ArrowDown" || ev.key === "ArrowUp"){
      const currentValue = pauseCommand.value || "";
      if (!bgSuggestOpen && bgPrefix(currentValue)) openBgSuggestFromValue(currentValue);
      if (bgSuggestOpen){
        if (ev.key === "ArrowUp") cycleBgChoice(-1);
        else cycleBgChoice(1);
        applyBgChoiceToInput();
        ev.preventDefault();
        return;
      }
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
      const cmd = (typeof getPauseHelpCommandFromNode === "function")
        ? getPauseHelpCommandFromNode(cmdRow)
        : (cmdRow.getAttribute("data-cmd") || "");
      pauseCommand.value = cmd ? (cmd + (cmd.includes(" ") ? "" : " ")) : "";
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
const GP_OPTION_REPEAT_DELAY = 0.06;
const GP_OPTION_REPEAT_RATE = 0.06;
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

function hasActivePlayer(){
  return (isPausedGameplayMenuBackdropState()) && !playerSpectatorMode;
}

function canActivateShield(){
  return (hasActivePlayer() && !isGameSpeedFrozen() && !isDead && shieldCooldown <= 0 && !shieldActive);
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
let bigBulletBuffEndTime = 0;
let shootCheatMode = "normal";
let glitchBackgroundPulse = 0;
// LocalStorage is intentionally reserved for nickname/profile data only.
// Active profile stats live under this nickname-keyed object. Runtime state, images,
// controls, and controller-preview ownership must not be persisted here.
const LIFETIME_STATS_KEY = "tektiteShooterLevel1LifetimeStats"; // deprecated global stats key; removed on load
const LIFETIME_STATS_PROFILES_KEY = "tektiteShooterLevel1LifetimeStatsByNickname";
const CHAT_NICKNAME_HISTORY_KEY = "tektiteShooterNicknameHistory";
const LIFETIME_STATS_STAT_KEYS = [
  "lifetimeScoreEarned",
  "lifetimeEnemiesKilled",
  "lifetimeUfosKilled",
  "lifetimeGamesWon",
  "lifetimeTotalDeaths",
  "lifetimeBulletsFired",
  "lifetimeBombKills"
];
const SAVED_IMAGES_KEY = "tektiteShooterSavedImages";
const SAVED_IMAGES_MAX = 10;
const SAVED_PROFILE_TILE_MAX = 9;
const SAVED_PROFILE_TILE_COLUMNS = 3;

function cleanupDeprecatedShooterLocalStorage(){
  // Keep only current nickname/profile keys in localStorage. Browser storage, the miracle junk drawer.
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

function getCurrentSavedImages(){
  // Images are file-system backed now. localStorage is reserved for nickname/profile state.
  return [];
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

async function saveCurrentGameImage(levelLabel="Level 1"){
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

function requestParentPageScreenshot(levelLabel="Level 1"){
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

let currentRunStatsCommitted = false;

function getLifetimeStatDateStamp(){
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatLifetimeSinceDate(stamp){
  const raw = String(stamp || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())){
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy}`;
  }
  return formatLifetimeSinceDate(getLifetimeStatDateStamp());
}

function getDefaultLifetimeStatStartedAt(){
  const today = getLifetimeStatDateStamp();
  return LIFETIME_STATS_STAT_KEYS.reduce((dates, key) => {
    dates[key] = today;
    return dates;
  }, {});
}

function getDefaultLifetimeStats(){
  return Object.assign(LIFETIME_STATS_STAT_KEYS.reduce((stats, key) => {
    stats[key] = 0;
    return stats;
  }, {}), {
    statStartedAt: getDefaultLifetimeStatStartedAt()
  });
}

function normalizeLifetimeStatsRecord(rawStats){
  const defaults = getDefaultLifetimeStats();
  const raw = rawStats && typeof rawStats === "object" ? rawStats : {};
  const normalized = Object.assign({}, defaults, raw);
  normalized.statStartedAt = Object.assign({}, defaults.statStartedAt, raw.statStartedAt || {});
  for (const key of LIFETIME_STATS_STAT_KEYS){
    normalized[key] = Math.max(0, Number(normalized[key] || 0));
    if (!normalized.statStartedAt[key]) normalized.statStartedAt[key] = getLifetimeStatDateStamp();
  }
  return normalized;
}

function getNicknameDedupKey(nickname){
  return limitChatNicknameLength(String(nickname || "").trim()).toLowerCase();
}

function pushUniqueNickname(target, seenKeys, nickname){
  const normalized = limitChatNicknameLength(String(nickname || "").trim());
  const key = getNicknameDedupKey(normalized);
  if (!normalized || !key || seenKeys.has(key)) return false;
  seenKeys.add(key);
  target.push(normalized);
  return true;
}

function readChatNicknameHistory(){
  try{
    const parsed = JSON.parse(localStorage.getItem(CHAT_NICKNAME_HISTORY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const unique = [];
    const seenKeys = new Set();
    for (const value of parsed){
      pushUniqueNickname(unique, seenKeys, value);
      if (unique.length >= SAVED_PROFILE_TILE_MAX) break;
    }
    return unique;
  }catch(_){
    return [];
  }
}

function writeChatNicknameHistory(history){
  const safeHistory = [];
  const seenKeys = new Set();
  if (Array.isArray(history)){
    for (const value of history){
      pushUniqueNickname(safeHistory, seenKeys, value);
      if (safeHistory.length >= SAVED_PROFILE_TILE_MAX) break;
    }
  }
  try{
    localStorage.setItem(CHAT_NICKNAME_HISTORY_KEY, JSON.stringify(safeHistory));
  }catch(_){}
  return safeHistory;
}

function rememberChatNickname(nickname){
  const normalized = limitChatNicknameLength(String(nickname || "").trim());
  const normalizedKey = getNicknameDedupKey(normalized);
  if (!normalized || !normalizedKey) return readChatNicknameHistory();
  const nextHistory = [normalized, ...readChatNicknameHistory().filter((value) => getNicknameDedupKey(value) !== normalizedKey)];
  return writeChatNicknameHistory(nextHistory);
}

function forgetChatNickname(nickname){
  const normalizedKey = getNicknameDedupKey(nickname);
  if (!normalizedKey) return readChatNicknameHistory();
  return writeChatNicknameHistory(readChatNicknameHistory().filter((value) => getNicknameDedupKey(value) !== normalizedKey));
}

function getSavedProfileNicknames(){
  const history = readChatNicknameHistory();
  const profileNames = Object.keys(readLifetimeStatsProfiles())
    .map((key) => {
      const match = /^name:(.+)$/i.exec(String(key || ""));
      return match ? limitChatNicknameLength(match[1]) : "";
    })
    .filter(Boolean);
  const combined = [];
  const seenKeys = new Set();
  for (const nickname of [...history, ...profileNames]){
    pushUniqueNickname(combined, seenKeys, nickname);
    if (combined.length >= SAVED_PROFILE_TILE_MAX) break;
  }
  return combined;
}

function getAlphabetizedSavedProfileNicknames(){
  return getSavedProfileNicknames().slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity:"base" }));
}

function getLifetimeStatsProfileName(){
  try{
    const savedNickname = window.localStorage.getItem("tektiteChatNickname");
    const isExplicit = window.localStorage.getItem("tektiteChatNicknameExplicit") === "true";
    const normalized = savedNickname && savedNickname.trim() ? savedNickname.trim() : "";
    if (normalized === "User" && !isExplicit) return "";
    return Array.from(normalized).slice(0, 8).join("");
  }catch(error){
    return "";
  }
}

function getLifetimeStatsProfileId(){
  const nickname = getLifetimeStatsProfileName();
  return nickname ? `name:${nickname.toLowerCase()}` : "";
}

function hasLifetimeStatsProfile(){
  return !!getLifetimeStatsProfileId();
}

function readLifetimeStatsProfiles(){
  try{
    const parsed = JSON.parse(localStorage.getItem(LIFETIME_STATS_PROFILES_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }catch(e){
    return {};
  }
}

function writeLifetimeStatsProfiles(profiles){
  try{
    localStorage.setItem(LIFETIME_STATS_PROFILES_KEY, JSON.stringify(profiles && typeof profiles === "object" ? profiles : {}));
  }catch(e){}
}

function readDefaultLifetimeStats(){
  // Deprecated global stats are deliberately ignored. Stats are nickname-scoped only now.
  return getDefaultLifetimeStats();
}

function writeDefaultLifetimeStats(){
  // No global/default lifetime stats writes. Profiles are nickname-specific only.
}

function readLifetimeStats(){
  const profileId = getLifetimeStatsProfileId();
  if (!profileId) return getDefaultLifetimeStats();
  const profiles = readLifetimeStatsProfiles();
  return normalizeLifetimeStatsRecord(profiles[profileId] || {});
}

function writeLifetimeStats(stats){
  const profileId = getLifetimeStatsProfileId();
  if (!profileId) return;
  const profiles = readLifetimeStatsProfiles();
  profiles[profileId] = normalizeLifetimeStatsRecord(stats || {});
  writeLifetimeStatsProfiles(profiles);
}

function incrementLifetimeStat(key, amount=1){
  if (!LIFETIME_STATS_STAT_KEYS.includes(key)) return;
  if (!hasLifetimeStatsProfile()) return;
  const stats = readLifetimeStats();
  stats[key] = Math.max(0, Number(stats[key] || 0) + Math.max(0, Number(amount) || 0));
  if (!stats.statStartedAt || typeof stats.statStartedAt !== "object") stats.statStartedAt = getDefaultLifetimeStatStartedAt();
  if (!stats.statStartedAt[key]) stats.statStartedAt[key] = getLifetimeStatDateStamp();
  writeLifetimeStats(stats);
  renderLifetimeStats();
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
    clampGameSpeedValue(START_GAME_SPEED) !== DEFAULT_START_GAME_SPEED ||
    Math.max(1, parseInt(START_WAVE, 10) || 1) !== DEFAULT_START_WAVE
  );
}

function syncScoreTrackingState(){
  const nextDisabled = !!(scoreTrackingLocked || hasScoreDisqualifyingSettings());
  scoreTrackingDisabled = nextDisabled;
  if (isScoreStoreOpen && typeof closeScoreStoreMenu === "function" && typeof canOpenStore === "function" && !canOpenStore()){
    closeScoreStoreMenu();
  }
  if (typeof updateAccuracyScoreHUD === "function") updateAccuracyScoreHUD();
  if (typeof renderMenuHudPreview === "function") renderMenuHudPreview();
  if (typeof refreshWinStats === "function") refreshWinStats();
}

function lockScoreTrackingState(){
  scoreTrackingLocked = true;
  syncScoreTrackingState();
}

function resetScoreTrackingState(){
  scoreTrackingLocked = false;
  syncScoreTrackingState();
}

function formatLifetimeNumber(value){
  return Math.floor(Number(value) || 0).toLocaleString();
}

function renderLifetimeStats(){
  const stats = readLifetimeStats();
  if (hasLifetimeStatsProfile()) writeLifetimeStats(stats);
  const statBindings = [
    ["lifetimeScoreEarned", statLifetimeScore],
    ["lifetimeEnemiesKilled", statLifetimeEnemies],
    ["lifetimeUfosKilled", statLifetimeUfos],
    ["lifetimeGamesWon", statLifetimeWins],
    ["lifetimeTotalDeaths", statLifetimeDeaths],
    ["lifetimeBulletsFired", statLifetimeBullets],
    ["lifetimeBombKills", statLifetimeBombKills]
  ];

  const statsList = document.getElementById("statsList");
  const lockedDetails = document.getElementById("statsLockedDetails");
  const lockedToggle = document.getElementById("btnStatsLockedToggle");
  const lockedList = document.getElementById("statsLockedList");
  const savedImagesDetails = document.getElementById("statsSavedImagesDetails");
  const savedProfilesGrid = document.getElementById("statsSavedProfilesGrid");
  const nicknamePrompt = document.getElementById("btnStatsEnterNickname");
  const nicknameStatsInput = document.getElementById("statsNicknameInput");
  const statsProfileName = getLifetimeStatsProfileName();
  const needsNicknameForStats = !statsProfileName;
  const statsInputActive = isStatsNicknameInputActive();
  const savedProfileNicknames = getSavedProfileNicknames();
  const showSavedProfilesGrid = needsNicknameForStats && !statsInputActive && savedProfileNicknames.length > 0;
  if (nicknamePrompt){
    const showNicknamePrompt = !statsInputActive;
    nicknamePrompt.textContent = needsNicknameForStats ? "Enter Nickname to Create Profile" : `${statsProfileName}'s Stats`;
    nicknamePrompt.classList.toggle("statsNicknameProfileLabel", !needsNicknameForStats);
    nicknamePrompt.hidden = !showNicknamePrompt;
    nicknamePrompt.setAttribute("aria-hidden", showNicknamePrompt ? "false" : "true");
    nicknamePrompt.tabIndex = showNicknamePrompt ? 0 : -1;
  }
  if (nicknameStatsInput && (!needsNicknameForStats || !statsInputActive)){
    nicknameStatsInput.hidden = true;
    nicknameStatsInput.setAttribute("aria-hidden", "true");
    nicknameStatsInput.tabIndex = -1;
    if (!statsInputActive) nicknameStatsInput.value = "";
  }
  renderSavedProfileGrid(savedProfileNicknames, showSavedProfilesGrid);
  if (savedProfilesGrid){
    savedProfilesGrid.hidden = !showSavedProfilesGrid;
    savedProfilesGrid.setAttribute("aria-hidden", showSavedProfilesGrid ? "false" : "true");
  }
  if (statsList){
    statsList.hidden = needsNicknameForStats;
    statsList.setAttribute("aria-hidden", needsNicknameForStats ? "true" : "false");
  }
  if (btnStatsReset){
    btnStatsReset.hidden = needsNicknameForStats;
    btnStatsReset.setAttribute("aria-hidden", needsNicknameForStats ? "true" : "false");
    btnStatsReset.tabIndex = needsNicknameForStats ? -1 : 0;
  }
  if (needsNicknameForStats) cancelResetProfileConfirmation();
  else syncResetProfileButtonState();
  if (btnStatsExport){
    btnStatsExport.hidden = needsNicknameForStats;
    btnStatsExport.setAttribute("aria-hidden", needsNicknameForStats ? "true" : "false");
    btnStatsExport.tabIndex = needsNicknameForStats ? -1 : 0;
  }
  if (btnStatsImport){
    btnStatsImport.hidden = !needsNicknameForStats;
    btnStatsImport.setAttribute("aria-hidden", needsNicknameForStats ? "false" : "true");
    btnStatsImport.tabIndex = needsNicknameForStats ? 0 : -1;
  }
  if (btnStatsSavedImagesToggle){
    btnStatsSavedImagesToggle.hidden = needsNicknameForStats;
    btnStatsSavedImagesToggle.setAttribute("aria-hidden", needsNicknameForStats ? "true" : "false");
    btnStatsSavedImagesToggle.tabIndex = needsNicknameForStats ? -1 : 0;
    if (needsNicknameForStats) btnStatsSavedImagesToggle.setAttribute("aria-expanded", "false");
  }
  if (savedImagesDetails){
    savedImagesDetails.hidden = needsNicknameForStats;
    savedImagesDetails.setAttribute("aria-hidden", needsNicknameForStats ? "true" : "false");
  }
  if (statsSavedImagesList){
    statsSavedImagesList.hidden = needsNicknameForStats || !isStatsSavedImagesExpanded();
    statsSavedImagesList.setAttribute("aria-hidden", statsSavedImagesList.hidden ? "true" : "false");
  }
  let lockedCount = 0;

  for (const [key, el] of statBindings){
    const value = Math.max(0, Number(stats[key] || 0));
    const row = document.querySelector(`[data-stat-row="${key}"]`);
    const since = formatLifetimeSinceDate(stats.statStartedAt && stats.statStartedAt[key]);
    if (el){
      el.dataset.statSince = `Since ${since} - `;
      el.textContent = formatLifetimeNumber(value);
    }
    if (!row) continue;

    if (value > 0){
      row.style.display = "flex";
      row.classList.remove("statsSelectableRow");
      row.removeAttribute("tabindex");
      if (statsList && row.parentNode !== statsList) statsList.appendChild(row);
    } else {
      row.style.display = "flex";
      row.classList.add("statsSelectableRow");
      row.tabIndex = -1;
      if (lockedList && row.parentNode !== lockedList) lockedList.appendChild(row);
      lockedCount += 1;
    }
  }

  if (lockedDetails){
    lockedDetails.hidden = lockedCount <= 0;
    if (lockedCount <= 0 && lockedList) lockedList.hidden = true;
    if (lockedToggle){
      lockedToggle.textContent = lockedCount > 0
        ? `Play More To Unlock (${lockedCount})`
        : "Play More To Unlock";
      if (lockedCount <= 0) lockedToggle.setAttribute("aria-expanded", "false");
    }
    syncStatsLockedSummaryState();
  }
  if (needsNicknameForStats && lockedDetails){
    lockedDetails.hidden = true;
    lockedDetails.setAttribute("aria-hidden", "true");
    if (lockedToggle) lockedToggle.setAttribute("aria-expanded", "false");
    if (lockedList){
      lockedList.hidden = true;
      lockedList.setAttribute("aria-hidden", "true");
    }
  }
}

function openStatsPanel(){
  restoreMenuHubActiveInner();
  overlayPanelReturnTarget = (gameState === STATE.HUB) ? STATE.HUB : STATE.MENU;
  syncNicknameStatsLabels();
  renderLifetimeStats();
  if (btnStatsLockedToggle){
    btnStatsLockedToggle.setAttribute("aria-expanded", "false");
    syncStatsLockedSummaryState();
  }
  if (btnStatsSavedImagesToggle){
    btnStatsSavedImagesToggle.setAttribute("aria-expanded", "false");
    syncStatsSavedImagesState();
    renderSavedImages();
  }
  const statsTargets = getStatsControllerTargets();
  const defaultStatsFocusIndex = statsTargets.indexOf(btnStatsClose);
  statsFocusIndex = defaultStatsFocusIndex >= 0 ? defaultStatsFocusIndex : 0;
  rememberStartMenuPanelRect();
  setStartMenuInteractive(false);
  if (startMenu) startMenu.style.display = "none";
  if (statsPanel){
    statsPanel.style.display = "flex";
    statsPanel.setAttribute("aria-hidden", "false");
    statsPanel.setAttribute("aria-modal", "true");
    fitStatsPanelToStartMenu();
  }
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsControllerFocus();
  else if (btnStatsClose && typeof btnStatsClose.focus === "function"){
    try{ btnStatsClose.focus({ preventScroll:true }); }catch(_){ try{ btnStatsClose.focus(); }catch(__){} }
  }
}

function closeStatsPanel(){
  if (savedImageViewerOpen) closeStatsSavedImageViewer();
  document.body.classList.remove("statsSavedImageBrowserView");
  cancelResetProfileConfirmation();
  if (closeMenuHubHostedPanelToStart(statsPanelInner)) return;
  if (statsPanel){
    statsPanel.style.display = "none";
    statsPanel.setAttribute("aria-hidden", "true");
    statsPanel.removeAttribute("aria-modal");
  }
  if (startMenu) startMenu.style.display = "block";
  if (overlayPanelReturnTarget === STATE.HUB && menuHubPanel){
    openMenuHub();
    return;
  }
  setStartMenuInteractive(true);
  resetStartMenuControllerFocus();
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else if (btnStart && typeof btnStart.focus === "function"){
    try{ btnStart.focus({ preventScroll:true }); }catch(_){ try{ btnStart.focus(); }catch(__){} }
  }
}

function renderSavedProfileGrid(nicknames = getSavedProfileNicknames(), shouldShow = false){
  if (!statsSavedProfilesGrid) return;
  statsSavedProfilesGrid.innerHTML = "";
  if (!shouldShow || !Array.isArray(nicknames) || !nicknames.length) return;
  nicknames.slice(0, SAVED_PROFILE_TILE_MAX).forEach((nickname) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "smallBtn statsSavedProfileTile";
    button.tabIndex = -1;
    button.dataset.profileNickname = nickname;
    button.setAttribute("aria-label", `${nickname}'s profile`);
    const pin = document.createElement("span");
    pin.className = "statsSavedProfileTilePin";
    pin.textContent = "\u{1F4CC}";
    button.appendChild(pin);
    button.appendChild(document.createTextNode(`${nickname}'s Profile`));
    statsSavedProfilesGrid.appendChild(button);
  });
}

function resetProfile(){
  const nickname = getSavedChatNicknameValue();
  if (nickname) clearNicknameProfileData(nickname);
  cancelResetProfileConfirmation();
  applyNicknameFromControls("", false);
  resetStatsNicknameEntry();
  const items = getStatsControllerTargets();
  const closeIndex = items.indexOf(btnStatsClose);
  statsFocusIndex = closeIndex >= 0 ? closeIndex : 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsControllerFocus();
}

let resetProfileConfirmStage = "idle";
let resetProfileCountdownSeconds = 0;
let resetProfileCountdownTimer = 0;

function clearResetProfileCountdownTimer(){
  if (resetProfileCountdownTimer){
    window.clearTimeout(resetProfileCountdownTimer);
    resetProfileCountdownTimer = 0;
  }
}

function syncResetProfileButtonState(){
  if (!btnStatsReset) return;
  if (btnStatsReset.hidden){
    btnStatsReset.textContent = "Reset Profile";
    btnStatsReset.style.color = "";
    btnStatsReset.style.borderColor = "";
    btnStatsReset.style.textShadow = "";
    btnStatsReset.removeAttribute("data-reset-confirm-stage");
    return;
  }
  if (resetProfileConfirmStage === "countdown"){
    btnStatsReset.textContent = `Really, reset? (${Math.max(1, resetProfileCountdownSeconds)}s)`;
    btnStatsReset.style.color = "#ff4d4d";
    btnStatsReset.style.borderColor = "rgba(255,77,77,0.92)";
    btnStatsReset.style.textShadow = "0 0 8px rgba(255,77,77,0.42)";
    btnStatsReset.dataset.resetConfirmStage = "countdown";
    return;
  }
  if (resetProfileConfirmStage === "confirm"){
    btnStatsReset.textContent = "Yes, RESET!";
    btnStatsReset.style.color = "#00ff66";
    btnStatsReset.style.borderColor = "rgba(0,255,102,0.92)";
    btnStatsReset.style.textShadow = "0 0 8px rgba(0,255,102,0.42)";
    btnStatsReset.dataset.resetConfirmStage = "confirm";
    return;
  }
  btnStatsReset.textContent = "Reset Profile";
  btnStatsReset.style.color = "";
  btnStatsReset.style.borderColor = "";
  btnStatsReset.style.textShadow = "";
  btnStatsReset.dataset.resetConfirmStage = "idle";
}

function cancelResetProfileConfirmation(){
  clearResetProfileCountdownTimer();
  resetProfileConfirmStage = "idle";
  resetProfileCountdownSeconds = 0;
  syncResetProfileButtonState();
}

function tickResetProfileConfirmation(){
  clearResetProfileCountdownTimer();
  if (resetProfileConfirmStage !== "countdown") return;
  if (resetProfileCountdownSeconds > 1){
    resetProfileCountdownSeconds -= 1;
    syncResetProfileButtonState();
    resetProfileCountdownTimer = window.setTimeout(tickResetProfileConfirmation, 1000);
    return;
  }
  resetProfileConfirmStage = "confirm";
  resetProfileCountdownSeconds = 0;
  syncResetProfileButtonState();
}

function startResetProfileConfirmation(){
  clearResetProfileCountdownTimer();
  resetProfileConfirmStage = "countdown";
  resetProfileCountdownSeconds = 3;
  syncResetProfileButtonState();
  resetProfileCountdownTimer = window.setTimeout(tickResetProfileConfirmation, 1000);
}

function clearNicknameProfileData(nickname){
  const normalizedNickname = limitChatNicknameLength(String(nickname || "").trim());
  if (!normalizedNickname) return;
  forgetChatNickname(normalizedNickname);
  const profileId = `name:${normalizedNickname.toLowerCase()}`;
  const profiles = readLifetimeStatsProfiles();
  if (Object.prototype.hasOwnProperty.call(profiles, profileId)){
    delete profiles[profileId];
    writeLifetimeStatsProfiles(profiles);
  }
}

function handleResetProfileButtonClick(){
  const nickname = getSavedChatNicknameValue();
  if (!nickname) return false;
  if (resetProfileConfirmStage === "confirm"){
    resetProfile();
    return true;
  }
  if (resetProfileConfirmStage === "countdown") return false;
  startResetProfileConfirmation();
  return true;
}

function getProfileExportDateStamp(date = new Date()){
  const parsed = date instanceof Date ? date : new Date(date);
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const yyyy = String(parsed.getFullYear());
  return `${mm}${dd}${yyyy}`;
}

function getProfileExportFilename(nickname){
  const safeNickname = Array.from(String(nickname || "").trim()).slice(0, CHAT_NICKNAME_MAX_LENGTH).join("") || "profile";
  return `${safeNickname}-profile-${getProfileExportDateStamp()}.json`;
}

function buildExportProfilePayload(){
  const nickname = getSavedChatNicknameValue();
  const profileId = nickname ? `name:${nickname.toLowerCase()}` : "";
  const profiles = readLifetimeStatsProfiles();
  const lifetimeStats = profileId ? normalizeLifetimeStatsRecord(profiles[profileId] || {}) : getDefaultLifetimeStats();
  return {
    type: "tektite-shooter-profile",
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: {
      nickname,
      nicknameExplicit: true,
      profileId,
      lifetimeStats
    }
  };
}

async function saveProfileJsonText(text, filename){
  if ("showSaveFilePicker" in window){
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: "JSON Profile", accept: { "application/json": [".json"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return true;
  }
  const blob = new Blob([text], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  try{
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } finally {
    window.setTimeout(() => { try{ URL.revokeObjectURL(objectUrl); }catch(_){ } }, 1500);
  }
}

async function exportProfile(){
  const nickname = getSavedChatNicknameValue();
  if (!nickname) return false;
  try{
    const payload = buildExportProfilePayload();
    await saveProfileJsonText(JSON.stringify(payload, null, 2), getProfileExportFilename(nickname));
    return true;
  }catch(error){
    if (!(error && error.name === "AbortError")){
      console.error("Profile export failed:", error);
    }
    return false;
  }
}

function readTextFromFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read profile file."));
    reader.readAsText(file);
  });
}

async function chooseImportProfileFile(){
  if ("showOpenFilePicker" in window){
    const handles = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "JSON Profile", accept: { "application/json": [".json"] } }]
    });
    const handle = handles && handles[0];
    if (!handle) return null;
    return handle.getFile();
  }
  return await new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.style.display = "none";
    input.addEventListener("change", () => {
      resolve(input.files && input.files[0] ? input.files[0] : null);
      input.remove();
    }, { once:true });
    document.body.appendChild(input);
    input.click();
  });
}

function applyImportedProfilePayload(payload){
  if (!payload || payload.type !== "tektite-shooter-profile" || !payload.profile || !payload.profile.nickname){
    throw new Error("Invalid profile file.");
  }
  const nickname = limitChatNicknameLength(String(payload.profile.nickname || "").trim());
  if (!nickname) throw new Error("Profile file is missing a nickname.");
  const profileId = `name:${nickname.toLowerCase()}`;

  // v2 exports keep the profile self-contained. v1 imports are still accepted,
  // but image data and random localStorage leaks are intentionally ignored.
  let importedProfileStats = payload.profile && payload.profile.lifetimeStats ? payload.profile.lifetimeStats : null;
  const importedLocalStorage = payload.localStorage && typeof payload.localStorage === "object" ? payload.localStorage : {};
  const importedProfiles = importedLocalStorage[LIFETIME_STATS_PROFILES_KEY];
  if ((!importedProfileStats || typeof importedProfileStats !== "object") && importedProfiles && typeof importedProfiles === "object" && !Array.isArray(importedProfiles)){
    importedProfileStats = importedProfiles[profileId] || null;
  }

  const profiles = readLifetimeStatsProfiles();
  profiles[profileId] = normalizeLifetimeStatsRecord(importedProfileStats || {});
  writeLifetimeStatsProfiles(profiles);
  rememberChatNickname(nickname);
  applyNicknameFromControls(nickname, false);
  if (btnStatsSavedImagesToggle) btnStatsSavedImagesToggle.setAttribute("aria-expanded", "false");
  syncStatsSavedImagesState();
  renderLifetimeStats();
}

async function importProfile(){
  try{
    const file = await chooseImportProfileFile();
    if (!file) return false;
    const text = await readTextFromFile(file);
    const payload = JSON.parse(text);
    applyImportedProfilePayload(payload);
    return true;
  }catch(error){
    if (!(error && error.name === "AbortError")){
      console.error("Profile import failed:", error);
    }
    return false;
  }
}

function isStatsPanelOpen(){
  return !!(statsPanel && statsPanel.style.display !== "none" && statsPanel.getAttribute("aria-hidden") !== "true");
}

function formatSavedImageTime(iso){
  try{
    return new Date(iso).toLocaleString(undefined, { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
  }catch(e){
    return "Saved image";
  }
}

function renderSavedImages(){
  if (!imagesList) return;
  const currentNickname = getSavedImageProfileName();
  const images = getCurrentSavedImages();
  imagesList.innerHTML = "";
  if (!currentNickname){
    const empty = document.createElement("div");
    empty.id = "imagesEmpty";
    empty.textContent = "Enter Nickname to Track Stats";
    imagesList.appendChild(empty);
    return;
  }
  if (!images.length){
    const empty = document.createElement("div");
    empty.id = "imagesEmpty";
    empty.innerHTML = "No saved images yet.<br>Press Y + View during gameplay to save one here.";
    imagesList.appendChild(empty);
    return;
  }
  images.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "savedImageCard";
    card.tabIndex = -1;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Saved image ${index + 1}`);
    const img = document.createElement("img");
    img.src = item.dataUrl;
    img.alt = `${currentNickname} wave ${getSavedImageWaveNumber(item && item.wave)} saved image ${index + 1}`;
    const meta = document.createElement("div");
    meta.className = "savedImageMeta";
    meta.textContent = `${currentNickname} \u2022 Wave ${getSavedImageWaveNumber(item && item.wave)} \u2022 ${formatSavedImageTime(item.createdAt)}`;
    meta.textContent = `${item.level || "Shooter Game"} • ${formatSavedImageTime(item.createdAt)}`;
    meta.textContent = `${currentNickname} \u2022 Wave ${getSavedImageWaveNumber(item && item.wave)} \u2022 ${formatSavedImageTime(item.createdAt)}`;
    card.appendChild(img);
    card.appendChild(meta);
    imagesList.appendChild(card);
  });
}

let savedImageRenderToken = 0;
let savedImagePreviewUrls = [];
let savedImagesCurrentCount = 0;
let savedImagesDirectoryName = "";
let savedImageViewerItems = [];
let savedImageViewerIndex = 0;
let savedImageViewerOpen = false;
let savedImageViewerFocusIndex = 0;
let statsSavedImageViewerEl = null;
let statsSavedImageViewerImageEl = null;
let btnStatsSavedImageViewerBack = null;
let btnStatsSavedImageViewerBrowserSize = null;

function clearSavedImagePreviewUrls(){
  for (const url of savedImagePreviewUrls){
    try{ URL.revokeObjectURL(url); }catch(error){}
  }
  savedImagePreviewUrls = [];
}

function syncSavedImagesButtonLabel(count = savedImagesCurrentCount, directoryName = savedImagesDirectoryName){
  if (!btnStatsSavedImagesToggle) return;
  const hasNickname = !!getSavedImageProfileName();
  if (!hasNickname){
    btnStatsSavedImagesToggle.textContent = "Saved Images";
    btnStatsSavedImagesToggle.dataset.savedImagesMode = "hidden";
    return;
  }
  const folderName = String(directoryName || "").trim();
  if (!folderName){
    btnStatsSavedImagesToggle.textContent = "Choose Folder to Save Images";
    btnStatsSavedImagesToggle.dataset.savedImagesMode = "choose-folder";
    return;
  }
  btnStatsSavedImagesToggle.textContent = `Images Saved to ${folderName}`;
  btnStatsSavedImagesToggle.dataset.savedImagesMode = "saved-images-folder";
}

async function renderSavedImagesFromFolder(){
  if (!imagesList) return;
  const renderToken = ++savedImageRenderToken;
  const currentNickname = getSavedImageProfileName();
  clearSavedImagePreviewUrls();
  savedImageViewerItems = [];
  if (savedImageViewerOpen) closeStatsSavedImageViewer();
  imagesList.innerHTML = "";
  savedImagesCurrentCount = 0;
  savedImagesDirectoryName = "";
  syncSavedImagesButtonLabel(0);
  if (btnImagesClear) btnImagesClear.hidden = true;
  if (!currentNickname){
    const empty = document.createElement("div");
    empty.id = "imagesEmpty";
    empty.textContent = "Enter Nickname to Track Stats";
    imagesList.appendChild(empty);
    return;
  }
  if (!window.tektiteShooterSavedImageStorage){
    const empty = document.createElement("div");
    empty.id = "imagesEmpty";
    empty.textContent = "Folder saving is not supported in this browser.";
    imagesList.appendChild(empty);
    return;
  }
  const result = await window.tektiteShooterSavedImageStorage.listSavedImages({ nickname: currentNickname });
  if (renderToken !== savedImageRenderToken){
    if (result && Array.isArray(result.items)){
      for (const item of result.items){
        if (item && item.objectUrl){
          try{ URL.revokeObjectURL(item.objectUrl); }catch(error){}
        }
      }
    }
    return;
  }
  const items = result && Array.isArray(result.items) ? result.items : [];
  savedImagesCurrentCount = items.length;
  savedImagesDirectoryName = result && result.configured ? String(result.directoryName || "").trim() : "";
  syncSavedImagesButtonLabel(items.length, savedImagesDirectoryName);
  if (!result || result.ok === false){
    const empty = document.createElement("div");
    empty.id = "imagesEmpty";
    empty.textContent = String(result && result.message || "Could not load saved images.");
    imagesList.appendChild(empty);
    return;
  }
  if (btnImagesClear) btnImagesClear.hidden = items.length <= 0;
  if (!items.length){
    const empty = document.createElement("div");
    empty.id = "imagesEmpty";
    empty.innerHTML = result.configured
      ? "No saved images in the selected folder yet.<br>Press Y + View during gameplay to save one here."
      : "Choose Folder to Save Images to pick where screenshots will be saved.";
    imagesList.appendChild(empty);
    return;
  }
  savedImageViewerItems = items.slice();
  items.forEach((item, index) => {
    if (item && item.objectUrl) savedImagePreviewUrls.push(item.objectUrl);
    const card = document.createElement("div");
    card.className = "savedImageCard";
    card.tabIndex = 0;
    card.dataset.savedImageIndex = String(index);
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Saved image ${index + 1}`);
    card.addEventListener("click", () => openStatsSavedImageViewer(index));
    const img = document.createElement("img");
    img.src = item.objectUrl;
    img.alt = `${currentNickname} wave ${getSavedImageWaveNumber(item && item.wave)} saved image ${index + 1}`;
    const meta = document.createElement("div");
    meta.className = "savedImageMeta";
    meta.textContent = `${currentNickname} \u2022 Wave ${getSavedImageWaveNumber(item && item.wave)} \u2022 ${formatSavedImageTime(item.createdAt)}`;
    card.appendChild(img);
    card.appendChild(meta);
    imagesList.appendChild(card);
  });
}

renderSavedImages = renderSavedImagesFromFolder;

function ensureStatsSavedImageViewer(){
  if (statsSavedImageViewerEl) return statsSavedImageViewerEl;
  const host = document.getElementById("statsPanelInner");
  if (!host) return null;
  const viewer = document.createElement("div");
  viewer.id = "statsSavedImageViewer";
  viewer.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.id = "statsSavedImageViewerImage";
  img.alt = "Saved screenshot";

  const controls = document.createElement("div");
  controls.id = "statsSavedImageViewerControls";
  controls.className = "btnRow menuBottomRow";

  const back = document.createElement("button");
  back.id = "btnStatsSavedImageViewerBack";
  back.className = "smallBtn";
  back.type = "button";
  back.textContent = "Back";
  back.addEventListener("click", closeStatsSavedImageViewer);

  const browserSize = document.createElement("button");
  browserSize.id = "btnStatsSavedImageViewerBrowserSize";
  browserSize.className = "smallBtn";
  browserSize.type = "button";
  browserSize.textContent = "Fullscreen";
  browserSize.addEventListener("click", toggleStatsSavedImageBrowserSize);

  controls.appendChild(back);
  controls.appendChild(browserSize);
  viewer.appendChild(img);
  viewer.appendChild(controls);
  host.appendChild(viewer);

  statsSavedImageViewerEl = viewer;
  statsSavedImageViewerImageEl = img;
  btnStatsSavedImageViewerBack = back;
  btnStatsSavedImageViewerBrowserSize = browserSize;
  return viewer;
}

function getStatsSavedImageViewerTargets(){
  return [btnStatsSavedImageViewerBack, btnStatsSavedImageViewerBrowserSize].filter(Boolean);
}

function syncStatsSavedImageViewerFocus(){
  clearControllerFocus();
  const items = getStatsSavedImageViewerTargets();
  if (!items.length) return;
  savedImageViewerFocusIndex = Math.max(0, Math.min(savedImageViewerFocusIndex, items.length - 1));
  focusControllerElement(items[savedImageViewerFocusIndex]);
}

function moveStatsSavedImageViewerButtonFocus(delta){
  const items = getStatsSavedImageViewerTargets();
  if (!items.length) return false;
  savedImageViewerFocusIndex = (savedImageViewerFocusIndex + delta + items.length) % items.length;
  syncStatsSavedImageViewerFocus();
  return true;
}

function showStatsSavedImageAt(index){
  if (!savedImageViewerItems.length || !statsSavedImageViewerImageEl) return false;
  savedImageViewerIndex = (index + savedImageViewerItems.length) % savedImageViewerItems.length;
  const item = savedImageViewerItems[savedImageViewerIndex] || {};
  statsSavedImageViewerImageEl.src = item.objectUrl || item.dataUrl || "";
  statsSavedImageViewerImageEl.alt = item.fileName || `Saved image ${savedImageViewerIndex + 1}`;
  return true;
}

function moveStatsSavedImageViewerImage(delta){
  if (!savedImageViewerOpen || savedImageViewerItems.length <= 1) return false;
  return showStatsSavedImageAt(savedImageViewerIndex + delta);
}

function openStatsSavedImageViewer(index){
  const viewer = ensureStatsSavedImageViewer();
  if (!viewer || !savedImageViewerItems.length) return false;
  const host = document.getElementById("statsPanelInner");
  savedImageViewerOpen = true;
  savedImageViewerFocusIndex = 0;
  viewer.setAttribute("aria-hidden", "false");
  if (host) host.classList.add("statsImageViewerOpen");
  document.body.classList.remove("statsSavedImageBrowserView");
  if (btnStatsSavedImageViewerBrowserSize) btnStatsSavedImageViewerBrowserSize.textContent = "Fullscreen";
  showStatsSavedImageAt(index || 0);
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsSavedImageViewerFocus();
  else clearControllerFocus();
  return true;
}

function closeStatsSavedImageViewer(){
  if (!savedImageViewerOpen && !statsSavedImageViewerEl) return false;
  const host = document.getElementById("statsPanelInner");
  savedImageViewerOpen = false;
  document.body.classList.remove("statsSavedImageBrowserView");
  if (btnStatsSavedImageViewerBrowserSize) btnStatsSavedImageViewerBrowserSize.textContent = "Fullscreen";
  if (statsSavedImageViewerEl) statsSavedImageViewerEl.setAttribute("aria-hidden", "true");
  if (host) host.classList.remove("statsImageViewerOpen");
  const cards = getStatsSavedImageCardTargets();
  statsFocusIndex = cards[savedImageViewerIndex] ? getStatsControllerTargets().indexOf(cards[savedImageViewerIndex]) : statsFocusIndex;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsControllerFocus();
  else clearControllerFocus();
  return true;
}

function toggleStatsSavedImageBrowserSize(){
  if (!savedImageViewerOpen) return false;
  const next = !document.body.classList.contains("statsSavedImageBrowserView");
  document.body.classList.toggle("statsSavedImageBrowserView", next);
  if (btnStatsSavedImageViewerBrowserSize) btnStatsSavedImageViewerBrowserSize.textContent = next ? "Panel Size" : "Fullscreen";
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsSavedImageViewerFocus();
  return true;
}

function fitImagesPanelToStartMenu(){
  if (!imagesPanelInner) return;
  const sourceRect = getFallbackMenuRect();
  if (!sourceRect || !sourceRect.width || !sourceRect.height) return;
  imagesPanelInner.style.width = `${Math.round(sourceRect.width)}px`;
  imagesPanelInner.style.height = `${Math.round(sourceRect.height)}px`;
  imagesPanelInner.style.maxWidth = `${Math.round(sourceRect.width)}px`;
  imagesPanelInner.style.maxHeight = `${Math.round(sourceRect.height)}px`;
}

function getImagesControllerTargets(){
  // The Hub's former Images tab is now Achievements and intentionally has no saved-image list.
  return [btnImagesClose].filter(Boolean);
}

function syncImagesControllerFocus(){
  clearControllerFocus();
  const items = getImagesControllerTargets();
  if (!items.length) return;
  imagesFocusIndex = Math.max(0, Math.min(imagesFocusIndex, items.length - 1));
  focusControllerElement(items[imagesFocusIndex]);
}

function moveImagesControllerFocus(delta){
  const items = getImagesControllerTargets();
  if (!items.length) return;
  imagesFocusIndex = (imagesFocusIndex + delta + items.length) % items.length;
  syncImagesControllerFocus();
}

function moveImagesControllerFocusDirectional(direction){
  const items = getImagesControllerTargets();
  if (!items.length) return false;
  const closeIndex = items.indexOf(btnImagesClose);
  const clearIndex = items.indexOf(btnImagesClear);
  let nextIndex = imagesFocusIndex;

  if (direction === "down"){
    nextIndex = (imagesFocusIndex + 1 + items.length) % items.length;
  } else if (direction === "up"){
    nextIndex = (imagesFocusIndex - 1 + items.length) % items.length;
  } else if (direction === "left"){
    if (items[imagesFocusIndex] === btnImagesClear && closeIndex !== -1) nextIndex = closeIndex;
    else nextIndex = (imagesFocusIndex - 1 + items.length) % items.length;
  } else if (direction === "right"){
    if (items[imagesFocusIndex] === btnImagesClose && clearIndex !== -1) nextIndex = clearIndex;
    else nextIndex = (imagesFocusIndex + 1 + items.length) % items.length;
  }

  if (nextIndex === imagesFocusIndex || nextIndex < 0 || nextIndex >= items.length) return false;
  imagesFocusIndex = nextIndex;
  syncImagesControllerFocus();
  return true;
}

function openImagesPanel(){
  restoreMenuHubActiveInner();
  overlayPanelReturnTarget = (gameState === STATE.HUB) ? STATE.HUB : STATE.MENU;
  imagesFocusIndex = 0;
  rememberStartMenuPanelRect();
  setStartMenuInteractive(false);
  if (startMenu) startMenu.style.display = "none";
  if (imagesPanel){
    imagesPanel.style.display = "flex";
    imagesPanel.setAttribute("aria-hidden", "false");
    imagesPanel.setAttribute("aria-modal", "true");
    fitImagesPanelToStartMenu();
  }
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncImagesControllerFocus();
  else if (btnImagesClose && typeof btnImagesClose.focus === "function"){
    try{ btnImagesClose.focus({ preventScroll:true }); }catch(_){ try{ btnImagesClose.focus(); }catch(__){} }
  }
}

function closeImagesPanel(){
  if (closeMenuHubHostedPanelToStart(imagesPanelInner)) return;
  if (imagesPanel){
    imagesPanel.style.display = "none";
    imagesPanel.setAttribute("aria-hidden", "true");
    imagesPanel.removeAttribute("aria-modal");
  }
  if (startMenu) startMenu.style.display = "block";
  if (overlayPanelReturnTarget === STATE.HUB && menuHubPanel){
    openMenuHub();
    return;
  }
  setStartMenuInteractive(true);
  resetStartMenuControllerFocus();
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else if (btnStart && typeof btnStart.focus === "function"){
    try{ btnStart.focus({ preventScroll:true }); }catch(_){ try{ btnStart.focus(); }catch(__){} }
  }
}

async function clearSavedImages(){
  const nickname = getSavedImageProfileName();
  if (!nickname){
    await renderSavedImages();
    syncStatsSavedImagesState();
    return;
  }
  if (!window.tektiteShooterSavedImageStorage){
    showSavedImageStatus("Folder saving is not supported in this browser.", false);
    return;
  }
  const result = await window.tektiteShooterSavedImageStorage.deleteSavedImages({ nickname });
  if (!result.ok){
    showSavedImageStatus(String(result.message || "Could not clear saved images."), false);
    return;
  }
  await renderSavedImages();
  syncStatsSavedImagesState();
}

function isImagesPanelOpen(){
  return !!(imagesPanel && imagesPanel.style.display !== "none" && imagesPanel.getAttribute("aria-hidden") !== "true");
}


function setStartMenuInteractive(isInteractive){
  if (!startMenu) return;
  const enabled = !!isInteractive;
  startMenu.style.pointerEvents = enabled ? "" : "none";
  if (enabled){
    startMenu.removeAttribute("inert");
    startMenu.removeAttribute("aria-hidden");
    return;
  }
  startMenu.setAttribute("inert", "");
  startMenu.setAttribute("aria-hidden", "true");
}

function commitRunLifetimeStats({won=false, died=false} = {}){
  if (currentRunStatsCommitted) return;
  currentRunStatsCommitted = true;
  if (!hasLifetimeStatsProfile()) return;
  const stats = readLifetimeStats();
  if (won) stats.lifetimeGamesWon += 1;
  if (died) stats.lifetimeTotalDeaths += 1;
  writeLifetimeStats(stats);
  renderLifetimeStats();
}

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
let totalEnemiesSpawned = 0;
let bombKills = 0;
let bombDragonKills = 0;
let bombFrogKills = 0;
let enemyKillCounts = new Map();
// v1.96: "Spectral Funk" tuning knob (because humans love naming sliders like they're mixtapes).
// 1000 = baseline. Higher = spicier enemies (faster patterns + smarter shots). Lower = chill mode.
const SPECTRAL_FUNK = 1000;
const FUNK = Math.max(0.25, Math.min(2.5, SPECTRAL_FUNK / 1000));

let lives = 0; // extra lives (decremented when health hits 0)
let playerSpectatorMode = false; // true when Starting Lives is 0: no player spawn, enemies run unattended
let frogKills = 0; // legacy counter kept for reset compatibility; frog kills no longer award free lives
let health = 1.0; // 0..1 (4 hits -> 0)
let MAX_HEARTS = 3; // v1.96: configurable hearts per life
let HIT_DAMAGE = 0.25; // 25% per hit (4 hearts = one life)

// =======================
// Dragon Bomb-Kill Armor (v1.96)
// - Dragon bomb kills are tracked for the win screen, but no longer grant free armor.
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
const START_MENU_PREVIEW_WAVE = 9; // v13.02: Start screen enemy preview sim, because apparently menus now need unpaid actors.
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
  // - Wave 11: "Boss Mode" (red)
  // - Waves 12-21: "INSANITY WAVE: K" where K = n-11
  if (n === 11) return { text:"Boss Mode", color:"#ff3333" };
  if (n >= 12 && n <= 21) return { text:"INSANITY WAVE: " + (n - 11), color:"#ffffff" };
  return { text:"Wave " + n, color:"#ffffff" };
}

function showWaveBanner(n){
  const lab = getWaveLabel(n);
  waveBanner.text = lab.text;
  waveBanner.color = lab.color;
  waveBanner.t = 1.35;
}

const STATE = { MENU:"menu", HUB:"hub", OPTIONS:"options", CHEATS:"cheats", CONTROLS:"controls", PLAYING:"playing", WIN:"win" };
let gameState = STATE.MENU;

function isPregameMenuEnemyPreviewState(){
  // v13.03: Keep the Wave 9 preview alive across the Start Menu, Menu Hub,
  // and the Hub's nested panels. Pause-origin hubs stay excluded so live gameplay
  // does not get replaced by decorative menu goblins. Because that would be rude.
  return (
    gameState === STATE.MENU ||
    gameState === STATE.HUB ||
    gameState === STATE.OPTIONS ||
    gameState === STATE.CHEATS ||
    gameState === STATE.CONTROLS
  );
}

function isStartMenuEnemyPreviewActive(){
  if (gameState === STATE.HUB && menuHubOpenedFromPause && isPaused) return false;
  if (optionsOpenedFromPause || cheatsOpenedFromPause || pauseControlsOpen) return false;
  return isPregameMenuEnemyPreviewState() && !isPaused;
}

function syncStartMenuHudLayerMode(){
  try{
    const pregameHudHidden = isStartMenuEnemyPreviewActive();
    document.body.classList.toggle("start-menu-hud-over-gameplay", pregameHudHidden);
    document.documentElement.classList.toggle("sg-hud-pregame", pregameHudHidden);
  }catch(_){ }
}

function hasLoadedEnemyPreviewSprites(){
  // v13.04: Never let the pregame preview spawn enemies before the real enemy
  // image pool is loaded. The old fallback was playerImg, which made refresh
  // briefly turn every enemy into Bananarama. Adorable, cursed, wrong.
  return !!(assetsReady && enemyImages && enemyImages.length);
}

function setupStartMenuEnemyPreview(){
  // v13.02: The start menu gets a live Wave 9 movement preview behind the panel.
  // It is still decoration: no player damage, no enemy bullets, no score, no wave progression.
  // Starting the game still uses the normal START_WAVE path, which defaults to Wave 1.
  if (!isStartMenuEnemyPreviewActive()) return;
  bullets.length = 0;
  enemyBullets.length = 0;
  bomb = null;
  ufo = null;
  waveBanner.t = 0;
  waveBanner.text = "";

  if (!hasLoadedEnemyPreviewSprites()){
    // Refresh/load state: draw nothing until enemy sprites are real.
    // No Bananarama cosplay squad in the background.
    enemies = [];
    firstBossSpawned = false;
    wave = START_MENU_PREVIEW_WAVE;
    return;
  }

  firstBossSpawned = false;
  wave = START_MENU_PREVIEW_WAVE;
  resetFormation();
  spawnEnemies();
  positionStartMenuPreviewEnemies();
}

function updateStartMenuEnemyPreview(dt){
  if (!isStartMenuEnemyPreviewActive()) return;
  if (!hasLoadedEnemyPreviewSprites()){
    bullets.length = 0;
    enemyBullets.length = 0;
    enemies = [];
    bomb = null;
    ufo = null;
    waveBanner.t = 0;
    waveBanner.text = "";
    return;
  }
  if (!enemies || !enemies.length || wave !== START_MENU_PREVIEW_WAVE){
    setupStartMenuEnemyPreview();
  }

  // Keep the preview sandboxed. The enemies can move and swoop, but they cannot
  // shoot, hurt the player, clear waves, spawn powerups, or otherwise touch the real run.
  bullets.length = 0;
  enemyBullets.length = 0;
  bomb = null;
  ufo = null;
  waveBanner.t = 0;
  waveBanner.text = "";

  // Fake target: enemies behave as if a player exists behind the Start Menu,
  // without drawing a player or enabling any collision damage. Very dignified puppet theatre.
  player.x = canvas.width / 2 + Math.sin(time * 0.75) * Math.max(90, canvas.width * 0.30);
  player.y = getPlayerAlignedY();

  const breath = Math.sin(time * 2) * 0.5 + 0.5;
  const spacingX = getSpacingX() * (1 + breath * 0.25);
  const spacingY = getSpacingY() * (1 + breath * 0.15);
  const formationWidth = (formationCols - 1) * spacingX;
  const formationHeight = (formationRows - 1) * spacingY;

  const nextXOffset = formation.xOffset + (formation.dir * formation.speed);
  const leftEdgeNext  = canvas.width / 2 - formationWidth / 2 + nextXOffset;
  const rightEdgeNext = canvas.width / 2 + formationWidth / 2 + nextXOffset;

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

  formation.yOffset += formation.descentSpeed * dt;

  const startX = canvas.width / 2 - formationWidth / 2 + formation.xOffset;
  const TOP_SAFE_MARGIN = 60;
  const ENEMY_ZONE_MAX_Y = canvas.height * 0.48;
  let baseY = 80 + formation.yOffset;

  if (baseY < TOP_SAFE_MARGIN){
    formation.yOffset += (TOP_SAFE_MARGIN - baseY);
    baseY = TOP_SAFE_MARGIN;
  }

  const maxBaseY = ENEMY_ZONE_MAX_Y - formationHeight;
  if (baseY > maxBaseY){
    formation.yOffset -= (baseY - maxBaseY);
    baseY = Math.max(TOP_SAFE_MARGIN, maxBaseY);
  }

  if (wave !== 11) tryStartSwoop(dt);

  for (const e of enemies){
    if (!e) continue;
    if (assetsReady && enemyImages.length && e.img === playerImg) e.img = randEnemyImg();

    const scale = 1 + breath * 0.18;
    const size = e.size * scale;
    const wobbleAmpX = 6 + Math.min(14, wave * 1.2);
    const wobbleAmpY = 3 + Math.min(10, wave * 0.7);
    const wobbleX = Math.sin(time * (0.9 + wave * 0.03) + e.row * 0.7) * wobbleAmpX;
    const wobbleY = Math.cos(time * (1.1 + wave * 0.02) + e.col * 0.6) * wobbleAmpY;

    e.fx = startX + e.col * spacingX + wobbleX;
    e.fy = baseY + e.row * spacingY + wobbleY;

    if (!e.swoop){
      e.x = e.fx;
      e.y = e.fy;
    } else {
      e.swoop.t += dt;
      const u = Math.min(1, e.swoop.t / e.swoop.dur);
      if (e.swoop.phase === "down"){
        e.x = quadBezier(u, e.swoop.sx, e.swoop.c1x, e.swoop.ex);
        e.y = quadBezier(u, e.swoop.sy, e.swoop.c1y, e.swoop.ey);
        if (u >= 1){
          e.swoop.phase = "up";
          e.swoop.t = 0;
          e.swoop.dur = Math.max(0.75, e.swoop.dur * 0.85);
          e.swoop.sx = e.x;
          e.swoop.sy = e.y;
          e.swoop.ex = e.fx;
          e.swoop.ey = e.fy;
          e.swoop.c1x = e.x + rand(-200, 200);
          e.swoop.c1y = Math.max(60, e.y - rand(160, 260));
        }
      } else {
        e.x = quadBezier(u, e.swoop.sx, e.swoop.c1x, e.swoop.ex);
        e.y = quadBezier(u, e.swoop.sy, e.swoop.c1y, e.swoop.ey);
        if (u >= 1){
          e.swoop = null;
          e.x = e.fx;
          e.y = e.fy;
        }
      }
    }

    e.w = size;
    e.h = size;
    e.hitFlash = 0;
    e.dying = false;
    e.fade = 1;
  }
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

function awardScore(basePoints){
  if (scoreTrackingDisabled) return 0;
  const awarded = Math.round(Math.max(0, basePoints) * getAccuracyMultiplier());
  score += awarded;
  if (Math.floor(score) >= STORE_UNLOCK_SCORE_THRESHOLD) scoreStoreUnlockedThisRun = true;
  incrementLifetimeStat("lifetimeScoreEarned", awarded);
  return awarded;
}

function isStoreUnlocked(){
  if (isCheatermodeStoreFree()) return true;
  if (scoreTrackingDisabled) return false;
  if (Math.floor(score) >= STORE_UNLOCK_SCORE_THRESHOLD) scoreStoreUnlockedThisRun = true;
  return scoreStoreUnlockedThisRun;
}

function canOpenStore(){
  return gameState === STATE.PLAYING && !isDead && (isCheatermodeStoreFree() || (!scoreTrackingDisabled && isStoreUnlocked()));
}

const scoreStoreHud = document.getElementById("scoreStoreHud");
const accuracyScoreEl = document.getElementById("accuracyScore");
const scoreHudLabelEl = document.getElementById("scoreHudLabel");
const storeUnlockedHudEl = document.getElementById("storeUnlockedHud");
const timerHud = document.getElementById("timerHud");
const winStatScoreEl = document.getElementById("winStatScore");
const winStatKillsEl = document.getElementById("winStatKills");
const winStatBulletsEl = document.getElementById("winStatBullets");
const winStatAccuracyEl = document.getElementById("winStatAccuracy");
const winStatBombKillsEl = document.getElementById("winStatBombKills");
const winStatKillBreakdownEl = document.getElementById("winStatKillBreakdown");
const winStatKillBreakdownListEl = document.getElementById("winStatKillBreakdownList");
const winStatBonusEl = document.getElementById("winStatBonus");
const winStatBonusDragonsEl = document.getElementById("winStatBonusDragons");
const winStatBonusFrogsEl = document.getElementById("winStatBonusFrogs");
const winStatTimeEl = document.getElementById("winStatTime");
if (scoreStoreHud){
  scoreStoreHud.addEventListener("click", () => {
    if (!canOpenStore()) return;
    openScoreStoreMenu();
  });
}
function updateAccuracyScoreHUD(){
  if (!accuracyScoreEl) return;
  const isPlaying = (isPausedGameplayMenuBackdropState());
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
  accuracyScoreEl.innerHTML = cheatsVisible ? '<span class="cheatsInfinitySymbol">∞</span>pts' : (String(Math.floor(score)) + "pts");
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

function clamp01(n){
  return Math.max(0, Math.min(1, n));
}

function getEnemyKillFilename(enemy){
  const src = enemy && enemy.img && (enemy.img.currentSrc || enemy.img.src);
  if (!src) return "unknown";
  try{
    const parsed = new URL(src, window.location.href);
    const pathname = parsed.pathname || "";
    const filename = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1));
    return filename || "unknown";
  }catch(err){
    const cleanSrc = String(src).split("?")[0].split("#")[0];
    const parts = cleanSrc.split("/");
    return parts[parts.length - 1] || "unknown";
  }
}

function recordEnemyKill(enemy){
  const filename = getEnemyKillFilename(enemy);
  enemyKillCounts.set(filename, (enemyKillCounts.get(filename) || 0) + 1);
}

function getEnemyKillBreakdownEntries(){
  if (!(enemyKillCounts instanceof Map) || enemyKillCounts.size === 0) return [];
  return Array.from(enemyKillCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
}

function renderWinKillBreakdown(){
  if (!winStatKillBreakdownEl || !winStatKillBreakdownListEl) return;
  const entries = getEnemyKillBreakdownEntries();
  winStatKillBreakdownEl.style.display = entries.length ? "block" : "none";
  winStatKillBreakdownListEl.textContent = "";
  if (!entries.length) return;
  const fragment = document.createDocumentFragment();
  for (const [filename, kills] of entries){
    const line = document.createElement("div");
    line.className = "winStatBreakdownLine winControllerTarget";
    line.tabIndex = -1;
    line.textContent = filename + ": " + kills;
    fragment.appendChild(line);
  }
  winStatKillBreakdownListEl.appendChild(fragment);
}


function refreshWinStats(){
  const accuracyPercent = Math.round(getAccuracy() * 100);
  if (winStatTimeEl) winStatTimeEl.textContent = "Time: " + formatRunTime(runTimer);
  if (winStatScoreEl){
    winStatScoreEl.style.display = scoreTrackingDisabled ? "none" : "block";
    winStatScoreEl.textContent = "Score: " + Math.floor(score);
  }
  if (winStatKillsEl) winStatKillsEl.textContent = "Enemies Killed: " + totalEnemiesSpawned + " / " + totalEnemiesSpawned;
  if (winStatBulletsEl) winStatBulletsEl.textContent = "Bullets Shot: " + shotsFired;
  if (winStatAccuracyEl) winStatAccuracyEl.textContent = "Accuracy: " + accuracyPercent + "%";
  if (winStatBombKillsEl) winStatBombKillsEl.textContent = "Bomb Kills: " + bombKills;
  renderWinKillBreakdown();

  const hasBombBonus = (bombDragonKills + bombFrogKills) > 0;
  if (winStatBonusEl) winStatBonusEl.style.display = hasBombBonus ? "block" : "none";
  if (winStatBonusDragonsEl) winStatBonusDragonsEl.textContent = "Dragons Bombed: +" + bombDragonKills;
  if (winStatBonusFrogsEl) winStatBonusFrogsEl.textContent = "Frogs Bombed: +" + bombFrogKills;
}

function stopWinStatsMarquee(options = {}){
  if (winStatsMarqueeRafId){
    try{ cancelAnimationFrame(winStatsMarqueeRafId); }catch(_){}
    winStatsMarqueeRafId = 0;
  }
  if (winStatsMarqueeSyncRafId){
    try{ cancelAnimationFrame(winStatsMarqueeSyncRafId); }catch(_){}
    winStatsMarqueeSyncRafId = 0;
  }
  winStatsMarqueeLastTimestamp = 0;
  winStatsMarqueeLoopDistance = 0;
  winStatsMarqueeOffset = 0;
  applyWinStatsMarqueeTransform();
  if (options.resetScroll && winStatsScrollArea){
    winStatsScrollArea.scrollTop = 0;
  }
  if (options.clearClone !== false && winStatsMarqueeClone){
    winStatsMarqueeClone.hidden = true;
    winStatsMarqueeClone.textContent = "";
  }
}

function applyWinStatsMarqueeTransform(){
  if (!winStatsMarqueeTrack) return;
  winStatsMarqueeTrack.style.transform = "";
}

function normalizeWinStatsMarqueeOffset(offset){
  const loopDistance = winStatsMarqueeLoopDistance || 0;
  if (loopDistance <= 0) return 0;
  let next = Number(offset) || 0;
  while (next < 0) next += loopDistance;
  while (next >= loopDistance) next -= loopDistance;
  return next;
}

function setWinStatsMarqueeOffset(offset){
  winStatsMarqueeOffset = normalizeWinStatsMarqueeOffset(offset);
  applyWinStatsMarqueeTransform();
}

function buildWinStatsMarqueeLoopDistance(){
  return 0;
}

function syncWinStatsMarquee(){
  stopWinStatsMarquee({ clearClone:false });
}

function queueWinStatsMarqueeSync(){
  return;
}

function updateTimerHUD(){
  if (!timerHud) return;
  // Show timer during gameplay and during the frozen Pause -> Menu Hub snapshot.
  if (!(isPausedGameplayMenuBackdropState())){
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
    recordEnemyKill(e);
    if (source === "bomb"){
      bombKills += 1;
      incrementLifetimeStat("lifetimeBombKills", 1);
    }
    if (source === "bomb" && isDragonEnemy(e)){
      bombDragonKills += 1;
    }

    if (source === "bomb" && e.isFrog){
      bombFrogKills += 1;
    }

    // Frog kills no longer heal the player or award free lives.
    awardScore(10);
    incrementLifetimeStat("lifetimeEnemiesKilled", 1);
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
    bombKills += 1;
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

function trySpawnUFO(force=false){
  if (ufo) return; // only one at a time
  // v1.96: Force-spawn on wave 11 and 21 (or when explicitly forced).
  if (!force && !shouldForceUFOForWave(wave) && Math.random() > 0.25) return;

  // Spawn near top area, tiny and fast.
  ufo = {
    x: rand(30, canvas.width - 30),
    y: rand(40, 110),
    vx: rand(-420, 420) / 60, // px/frame-ish
    vy: rand(260, 520) / 60,
    r: 10 * getUfoSizeScale(),
    hits: 0,
    stage: 0, // 0 none, 1 red, 2 green, 3 blue
    _killAwarded: false,
    fade: 0,
    strobeT: 0
  };

  // Ensure it's actually moving.
  if (Math.abs(ufo.vx) < 2) ufo.vx = (ufo.vx < 0 ? -2.5 : 2.5);
}

function updateUFO(dt){
  if (!ufo) return;

  // If fading, just fade out and then grant powerup.
  if (ufo.fade > 0){
    ufo.fade += dt;
    if (ufo.fade >= 0.55){
      ufo = null;
      bombsCount += 1;
      powerupSlot.style.display = "flex";
    }
    return;
  }

  // Move + bounce around the top half.
  ufo.x += ufo.vx;
  ufo.y += ufo.vy;

  const left = 16, right = canvas.width - 16, top = 30, bottom = canvas.height * 0.48;
  if (ufo.x < left){ ufo.x = left; ufo.vx *= -1; }
  if (ufo.x > right){ ufo.x = right; ufo.vx *= -1; }
  if (ufo.y < top){ ufo.y = top; ufo.vy *= -1; }
  if (ufo.y > bottom){ ufo.y = bottom; ufo.vy *= -1; }

  // "Avoid the player's movement toward it": if player is moving toward UFO, add a shove away.
  const movingLeft  = isKeyboardActionHeld("moveLeft");
  const movingRight = isKeyboardActionHeld("moveRight");
  const toward =
    (movingLeft  && player.x > ufo.x) ||
    (movingRight && player.x < ufo.x);

  if (toward){
    const away = Math.sign(ufo.x - player.x) || (Math.random() < 0.5 ? -1 : 1);
    ufo.vx += away * (0.65 + 0.35 * FUNK);
    // clamp
    ufo.vx = Math.max(-9.5, Math.min(9.5, ufo.vx));
  }

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
  if (isPaused || isGameSpeedFrozen() || playerSpectatorMode) return;
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

  const targetVx = vxIntent * playerSpeed * 55;
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
  // v1.96: Stage 2+ visual shift (wave >= 11)
  const isStage2Plus = (gameState === STATE.PLAYING && wave >= 11);

  // Background
  ctx.fillStyle = (starfieldBgOverride ? starfieldBgOverride : (isStage2Plus ? "#300" : "#000"));
  ctx.fillRect(0,0,canvas.width,canvas.height);
  drawGlitchBackgroundOverlay();

  if (!starfieldReady) return;

  for (let li = 0; li < starLayers.length; li++){
    const arr = stars[li];
    const alpha = li === 0 ? 0.35 : (li === 1 ? 0.55 : 0.85);

    // v1.96: Keep stars white for maximum contrast (even in Stage 2+)
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
  fitMenuHubToStartMenu();
  fitOptionsMenuToViewport();
  fitCheatsMenuToViewport();
  fitControlsMenuToViewport();
  fitControlsPreviewMenuToViewport();
  fitMenuHubToStartMenu();
  fitStatsPanelToStartMenu();
  fitImagesPanelToStartMenu();
}
window.addEventListener("resize", resize);

function fitMenuHubToStartMenu(){
  if (!menuHubPanelInner) return;
  // v2.XX: The Hub uses the Start Menu measured footprint, then scales its
  // own inner panel down inside that footprint so it cannot look wider or taller.
  const hubScale = 0.94;
  const rect = getFallbackMenuRect();
  if (rect && rect.width && rect.height){
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    menuHubPanelInner.style.width = `px`;
    menuHubPanelInner.style.height = `px`;
    menuHubPanelInner.style.maxWidth = `px`;
    menuHubPanelInner.style.maxHeight = `px`;
    menuHubPanelInner.style.transform = `scale()`;
    menuHubPanelInner.style.transformOrigin = "center center";
    return;
  }
  menuHubPanelInner.style.width = "var(--shooter-menu-footprint-width)";
  menuHubPanelInner.style.height = "var(--shooter-menu-footprint-height)";
  menuHubPanelInner.style.maxWidth = "var(--shooter-menu-footprint-width)";
  menuHubPanelInner.style.maxHeight = "var(--shooter-menu-footprint-height)";
  menuHubPanelInner.style.transform = `scale()`;
  menuHubPanelInner.style.transformOrigin = "center center";
}

function fitOptionsMenuToViewport(){
  sizeMenuLikeStartMenu(optionsMenu, optionsMenuInner, optionsScroll);
}

function fitCheatsMenuToViewport(){
  sizeMenuLikeStartMenu(cheatsMenu, cheatsMenuInner, cheatsScroll);
}

function fitStatsPanelToStartMenu(){
  if (!statsPanelInner) return;
  const sourceRect = getFallbackMenuRect();
  if (!sourceRect || !sourceRect.width || !sourceRect.height) return;
  statsPanelInner.style.width = `${Math.round(sourceRect.width)}px`;
  statsPanelInner.style.height = `${Math.round(sourceRect.height)}px`;
  statsPanelInner.style.maxWidth = `${Math.round(sourceRect.width)}px`;
  statsPanelInner.style.maxHeight = `${Math.round(sourceRect.height)}px`;
}

function rememberStartMenuPanelRect(){
  if (!startMenu) return;
  try{
    if (startMenu.style.display !== "none" && startMenu.offsetParent !== null){
      const rect = startMenu.getBoundingClientRect();
      if (rect && rect.width && rect.height) startMenuPanelRect = rect;
    }
  }catch(e){}
}

function getFallbackMenuRect(){
  if (startMenuPanelRect && startMenuPanelRect.width && startMenuPanelRect.height) return startMenuPanelRect;
  if (startMenu){
    try{
      const previousDisplay = startMenu.style.display;
      const previousVisibility = startMenu.style.visibility;
      const previousPointerEvents = startMenu.style.pointerEvents;
      startMenu.style.visibility = "hidden";
      startMenu.style.pointerEvents = "none";
      startMenu.style.display = "block";
  rememberStartMenuPanelRect();
      const rect = startMenu.getBoundingClientRect();
      startMenu.style.display = previousDisplay;
      startMenu.style.visibility = previousVisibility;
      startMenu.style.pointerEvents = previousPointerEvents;
      if (rect && rect.width && rect.height){
        startMenuPanelRect = rect;
        return rect;
      }
    }catch(e){}
  }
  return null;
}

function sizeMenuLikeStartMenu(menuEl, innerEl=null, scrollEl=null){
  if (!menuEl) return;
  menuEl.style.transform = "scale(1)";
  menuEl.style.margin = "0";
  menuEl.style.transformOrigin = "center center";
  menuEl.style.boxSizing = "border-box";

  if (innerEl){
    innerEl.style.transform = "none";
    innerEl.style.marginBottom = "0";
  }
  if (scrollEl) scrollEl.scrollTop = 0;

  if (menuEl.style.display === "none" || menuEl.offsetParent === null) return;

  const sourceRect = getFallbackMenuRect();
  if (sourceRect && sourceRect.width && sourceRect.height){
    const panelW = Math.round(sourceRect.width);
    const panelH = Math.round(sourceRect.height);
    menuEl.style.width = `${panelW}px`;
    menuEl.style.height = `${panelH}px`;
    menuEl.style.minHeight = `${panelH}px`;
    menuEl.style.maxHeight = `${panelH}px`;
  }

  const margin = 12;
  const availableW = Math.max(320, window.innerWidth - margin * 2);
  const availableH = Math.max(240, window.innerHeight - margin * 2);
  const rect = menuEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const panelScale = Math.min(1, availableW / rect.width, availableH / rect.height);
  menuEl.style.transform = `scale(${panelScale})`;
  if (panelScale < 1) {
    const scaledHeight = rect.height * panelScale;
    const slack = Math.max(0, availableH - scaledHeight);
    menuEl.style.margin = `${Math.floor(slack / 2)}px 0`;
  }
}

function isHubOptionsControlsFrameActive(){
  return !!(
    document.body &&
    document.body.classList.contains("controls-menu-open") &&
    document.body.classList.contains("controls-hub-options-mode") &&
    !document.body.classList.contains("controls-preview-open") &&
    controlsMenu &&
    controlsMenu.classList.contains("hubOptionsControlsMode")
  );
}

function clearControlsMenuMeasuredInlineSizing(){
  if (!controlsMenu) return;
  ["width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight", "transform", "margin", "transformOrigin"].forEach(prop => {
    try{ controlsMenu.style[prop] = ""; }catch(e){}
  });
  if (controlsMenuInner){
    ["width", "height", "minHeight", "maxHeight", "transform", "marginBottom"].forEach(prop => {
      try{ controlsMenuInner.style[prop] = ""; }catch(e){}
    });
  }
}

function fitControlsMenuToViewport(){
  if (isHubOptionsControlsFrameActive()){
    clearControlsMenuMeasuredInlineSizing();
    return;
  }
  sizeMenuLikeStartMenu(controlsMenu, controlsMenuInner, controlsListScroll);
}

function fitControlsPreviewMenuToViewport(){
  sizeMenuLikeStartMenu(controlsPreviewMenu, null, null);
}

/* =======================
   HUD/Player Alignment
   - Keep the bottom of the player aligned to the top of the hearts HUD (DOM element),
     regardless of fullscreen, browser chrome, or embedding under a site banner.
======================= */
function getPlayerAlignedY(gapPx = 6){
  const heartsTop = getHeartsTopInCanvas();
  // player.y is CENTER-based, so subtract half-height.
  let y = heartsTop - (player.h / 2) - gapPx;
  // Clamp to canvas bounds
  y = Math.max(player.h/2, Math.min(canvas.height - player.h/2, y));
  return y;
}

/* =======================
   Audio
======================= */
const sfxHit = new Audio(AUDIO_HIT);
const sfxOof = new Audio(AUDIO_OOF);
const sfxUiHover = new Audio(AUDIO_UI_HOVER);
const sfxUiSelect = new Audio(AUDIO_UI_SELECT);
sfxHit.preload = "auto";
sfxOof.preload = "auto";
sfxUiHover.preload = "auto";
sfxUiSelect.preload = "auto";
sfxHit.volume = 0.7;
sfxOof.volume = 0.8;
sfxUiHover.volume = 0.15;
sfxUiSelect.volume = 0.33;

let audioUnlocked = false;
let pendingWaveStartMusic = false;
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
    // Prime the background music once the browser allows it.
    musicBg.muted = true;
    musicBg.play().then(()=>{ musicBg.pause(); musicBg.currentTime = 0; musicBg.muted = false; }).catch(()=>{ musicBg.muted = false; });

    // Do not muted-prime menuMusicBg here. The same Audio element is used for the actual
    // Start Menu loop, and the async priming promise can pause the real menu music after it starts.

    // Prime the death yell audio once the browser allows it.
    sfxDeath.muted = true;
    sfxDeath.play().then(()=>{ sfxDeath.pause(); sfxDeath.currentTime = 0; sfxDeath.muted = false; }).catch(()=>{ sfxDeath.muted = false; });
  }catch(e){}

  applyMuteState();
  if (!audioMuted && isPreGameplayMenuAudioState()){
    ensureMenuMusicPlaying();
    setTimeout(() => { if (!audioMuted && isPreGameplayMenuAudioState()) ensureMenuMusicPlaying(); }, 120);
  }
}

function playSfx(a){
  if (audioMuted) return;
  try{
    const c = a.cloneNode();
    activeSfxClones.add(c);
    c.addEventListener("ended", () => activeSfxClones.delete(c), { once:true });
    c.volume = a.volume;
    c.muted = !!audioMuted;
    c.play().catch(()=>{ activeSfxClones.delete(c); });
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
const optionsMenuInner = document.getElementById("optionsMenuInner");
const optionsScroll = document.getElementById("optionsScroll");
const cheatsMenu = document.getElementById("cheatsMenu");
const cheatsMenuInner = document.getElementById("cheatsMenuInner");
const cheatsScroll = document.getElementById("cheatsScroll");
const assetStatus = document.getElementById("assetStatus");
function getHeartsHudEl(){ return document.getElementById("heartsHud"); }

const btnStart = document.getElementById("btnStart");
const btnMenu = document.getElementById("btnMenu");
const btnEnterNickname = document.getElementById("btnEnterNickname");
const startNicknameInput = document.getElementById("startNicknameInput");
const startWelcomeNickname = document.getElementById("startWelcomeNickname");
const btnOptions = document.getElementById("btnOptions");
const startMenuTitle = document.getElementById("startMenuTitle");
const stageHud = document.getElementById("stageHud");
const stageHudLabel = document.getElementById("stageHudLabel");
const stageHudSpeaker = document.getElementById("stageHudSpeaker");
const stageWaveDropdownWrap = document.getElementById("stageWaveDropdownWrap");
const stageWaveDropdown = document.getElementById("stageWaveDropdown");
const musicDropdownWrap = document.getElementById("musicDropdownWrap");
const musicFileDropdown = document.getElementById("musicFileDropdown");
let stageWaveMenuSelection = "menu";
const titleHoverReveal = document.getElementById("titleHoverReveal");
const constructionHoverReveal = document.getElementById("constructionHoverReveal");
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
const nicknameSuggestionState = {
  input: null,
  popup: null,
  items: [],
  index: -1,
  cyclePrefix: "",
  hideTimer: 0
};

function isNicknameSuggestionEligibleInput(input){
  return !!(input && (input === startNicknameInput || input === statsNicknameInput));
}

function clearNicknameSuggestionHideTimer(){
  if (!nicknameSuggestionState.hideTimer) return;
  try{ window.clearTimeout(nicknameSuggestionState.hideTimer); }catch(_){}
  nicknameSuggestionState.hideTimer = 0;
}

function syncNicknameSuggestionInputState(input){
  if (input === startNicknameInput){
    syncStartNicknameInputHueShift();
    return;
  }
  if (input === statsNicknameInput){
    syncStatsNicknameInputDraftState();
  }
}

function getNicknameSuggestionMatches(prefixValue=""){
  const savedNicknames = getAlphabetizedSavedProfileNicknames();
  if (!savedNicknames.length) return [];
  const normalizedPrefix = limitChatNicknameLength(String(prefixValue || "").trim()).toLowerCase();
  if (!normalizedPrefix) return savedNicknames.slice();
  const startsWithMatches = savedNicknames.filter((nickname) => nickname.toLowerCase().startsWith(normalizedPrefix));
  if (startsWithMatches.length) return startsWithMatches;
  return savedNicknames.filter((nickname) => nickname.toLowerCase().includes(normalizedPrefix));
}

function ensureNicknameSuggestionPopup(){
  if (nicknameSuggestionState.popup && nicknameSuggestionState.popup.isConnected) return nicknameSuggestionState.popup;
  const popup = document.createElement("div");
  popup.id = "nicknameSuggestionPopup";
  popup.hidden = true;
  popup.setAttribute("aria-hidden", "true");
  popup.style.position = "fixed";
  popup.style.left = "0";
  popup.style.top = "0";
  popup.style.display = "none";
  popup.style.minWidth = "160px";
  popup.style.maxHeight = "188px";
  popup.style.overflowY = "auto";
  popup.style.padding = "6px";
  popup.style.background = "rgba(0,0,0,0.94)";
  popup.style.border = "2px solid rgba(0,255,102,0.72)";
  popup.style.borderRadius = "12px";
  popup.style.boxShadow = "0 0 18px rgba(0,255,102,0.24)";
  popup.style.zIndex = "99999";
  popup.style.backdropFilter = "blur(3px)";
  popup.addEventListener("mousedown", (event) => {
    const button = event.target && event.target.closest ? event.target.closest("[data-nickname-suggestion]") : null;
    if (!button || !nicknameSuggestionState.input) return;
    event.preventDefault();
    const nickname = limitChatNicknameLength(String(button.getAttribute("data-nickname-suggestion") || "").trim());
    if (!nickname) return;
    nicknameSuggestionState.index = Math.max(0, Number(button.getAttribute("data-nickname-index")) || 0);
    nicknameSuggestionState.input.value = nickname;
    syncNicknameSuggestionInputState(nicknameSuggestionState.input);
    try{
      nicknameSuggestionState.input.focus({ preventScroll:true });
    }catch(_){
      try{ nicknameSuggestionState.input.focus(); }catch(__){}
    }
    try{
      const end = nicknameSuggestionState.input.value.length;
      nicknameSuggestionState.input.setSelectionRange(end, end);
    }catch(_){}
    hideNicknameSuggestionPopup();
  });
  document.body.appendChild(popup);
  nicknameSuggestionState.popup = popup;
  return popup;
}

function positionNicknameSuggestionPopup(){
  const popup = nicknameSuggestionState.popup;
  const input = nicknameSuggestionState.input;
  if (!popup || !input || !input.isConnected) return false;
  const rect = input.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0){
    hideNicknameSuggestionPopup();
    return false;
  }
  const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0, 1);
  const popupWidth = Math.max(160, Math.round(rect.width));
  const left = Math.max(8, Math.min(Math.round(rect.left), viewportWidth - popupWidth - 8));
  popup.style.left = `${left}px`;
  popup.style.top = `${Math.round(rect.bottom + 6)}px`;
  popup.style.width = `${popupWidth}px`;
  return true;
}

function renderNicknameSuggestionPopup(){
  const popup = ensureNicknameSuggestionPopup();
  if (!nicknameSuggestionState.input || !nicknameSuggestionState.items.length){
    popup.hidden = true;
    popup.setAttribute("aria-hidden", "true");
    popup.style.display = "none";
    popup.innerHTML = "";
    return false;
  }
  popup.innerHTML = "";
  nicknameSuggestionState.items.forEach((nickname, index) => {
    const button = document.createElement("button");
    const active = index === nicknameSuggestionState.index;
    button.type = "button";
    button.tabIndex = -1;
    button.setAttribute("data-nickname-suggestion", nickname);
    button.setAttribute("data-nickname-index", String(index));
    button.textContent = nickname;
    button.style.display = "block";
    button.style.width = "100%";
    button.style.margin = index ? "6px 0 0" : "0";
    button.style.padding = "8px 10px";
    button.style.borderRadius = "8px";
    button.style.border = active ? "1px solid rgba(0,255,255,0.78)" : "1px solid rgba(0,255,102,0.18)";
    button.style.background = active ? "rgba(0,255,255,0.18)" : "rgba(0,255,102,0.08)";
    button.style.color = active ? "#00ffff" : "#d9fff0";
    button.style.cursor = "pointer";
    button.style.fontFamily = "\"Courier New\", monospace";
    button.style.fontSize = "14px";
    button.style.fontWeight = "900";
    button.style.letterSpacing = "0.05em";
    button.style.textAlign = "left";
    popup.appendChild(button);
  });
  if (!positionNicknameSuggestionPopup()) return false;
  popup.hidden = false;
  popup.setAttribute("aria-hidden", "false");
  popup.style.display = "block";
  return true;
}

function hideNicknameSuggestionPopup(){
  clearNicknameSuggestionHideTimer();
  if (nicknameSuggestionState.popup){
    nicknameSuggestionState.popup.hidden = true;
    nicknameSuggestionState.popup.setAttribute("aria-hidden", "true");
    nicknameSuggestionState.popup.style.display = "none";
    nicknameSuggestionState.popup.innerHTML = "";
  }
  nicknameSuggestionState.input = null;
  nicknameSuggestionState.items = [];
  nicknameSuggestionState.index = -1;
  nicknameSuggestionState.cyclePrefix = "";
}

function openNicknameSuggestionPopup(input){
  if (!isNicknameSuggestionEligibleInput(input)){
    hideNicknameSuggestionPopup();
    return false;
  }
  clearNicknameSuggestionHideTimer();
  nicknameSuggestionState.input = input;
  nicknameSuggestionState.cyclePrefix = limitChatNicknameLength(String(input.value || "").trim()).toLowerCase();
  nicknameSuggestionState.items = getNicknameSuggestionMatches(nicknameSuggestionState.cyclePrefix);
  if (!nicknameSuggestionState.items.length){
    hideNicknameSuggestionPopup();
    return false;
  }
  const exactIndex = nicknameSuggestionState.items.findIndex((nickname) => nickname.toLowerCase() === limitChatNicknameLength(String(input.value || "").trim()).toLowerCase());
  nicknameSuggestionState.index = exactIndex >= 0 ? exactIndex : 0;
  return renderNicknameSuggestionPopup();
}

function cycleNicknameSuggestionChoice(input, direction=1){
  if (!isNicknameSuggestionEligibleInput(input)) return false;
  clearNicknameSuggestionHideTimer();
  if (nicknameSuggestionState.input !== input){
    nicknameSuggestionState.input = input;
    nicknameSuggestionState.cyclePrefix = limitChatNicknameLength(String(input.value || "").trim()).toLowerCase();
    nicknameSuggestionState.index = -1;
  }
  nicknameSuggestionState.items = getNicknameSuggestionMatches(nicknameSuggestionState.cyclePrefix);
  if (!nicknameSuggestionState.items.length){
    hideNicknameSuggestionPopup();
    return false;
  }
  if (nicknameSuggestionState.index === -1 || nicknameSuggestionState.index >= nicknameSuggestionState.items.length){
    const exactIndex = nicknameSuggestionState.items.findIndex((nickname) => nickname.toLowerCase() === limitChatNicknameLength(String(input.value || "").trim()).toLowerCase());
    if (exactIndex >= 0){
      nicknameSuggestionState.index = (exactIndex + direction + nicknameSuggestionState.items.length) % nicknameSuggestionState.items.length;
    } else {
      nicknameSuggestionState.index = direction >= 0 ? 0 : nicknameSuggestionState.items.length - 1;
    }
  } else {
    nicknameSuggestionState.index = (nicknameSuggestionState.index + direction + nicknameSuggestionState.items.length) % nicknameSuggestionState.items.length;
  }
  input.value = nicknameSuggestionState.items[nicknameSuggestionState.index];
  syncNicknameSuggestionInputState(input);
  try{
    input.focus({ preventScroll:true });
  }catch(_){
    try{ input.focus(); }catch(__){}
  }
  try{
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }catch(_){}
  return renderNicknameSuggestionPopup();
}

function scheduleNicknameSuggestionPopupHide(input){
  if (!isNicknameSuggestionEligibleInput(input)) return;
  clearNicknameSuggestionHideTimer();
  nicknameSuggestionState.hideTimer = window.setTimeout(() => {
    if (nicknameSuggestionState.input === input) hideNicknameSuggestionPopup();
  }, 120);
}

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

function getSelectDisplayText(selectEl){
  if (!selectEl) return "";
  const option = selectEl.options && selectEl.selectedIndex >= 0 ? selectEl.options[selectEl.selectedIndex] : null;
  return option ? option.textContent.trim() : String(selectEl.value || "");
}
function syncTightSelectWidth(selectEl, cssVarName){
  if (!selectEl || !cssVarName) return;
  const text = getSelectDisplayText(selectEl);
  const ch = Math.max(4, text.length + 0.75);
  selectEl.style.setProperty(cssVarName, String(ch));
}
function focusDropdownFromWrapper(selectEl, event){
  if (!selectEl || !event) return;
  if (event.target === selectEl) return;
  event.preventDefault();
  event.stopPropagation();
  selectEl.focus();
  try{ selectEl.click(); }catch(_err){}
}
function isStageWaveDropdownAllowed(){
  return !!cheatsUnlockedByPassphrase;
}
function setStageWaveDropdownVisible(visible){
  if (!stageWaveDropdownWrap) return;
  stageWaveDropdownWrap.hidden = !visible;
  stageWaveDropdownWrap.setAttribute("aria-hidden", visible ? "false" : "true");
}
function syncStageWaveDropdown(){
  if (!stageWaveDropdown || !stageWaveDropdownWrap) return;
  if (!isStageWaveDropdownAllowed()){
    setStageWaveDropdownVisible(false);
    return;
  }
  setStageWaveDropdownVisible(true);
  const isGameplayHud = isPausedGameplayMenuBackdropState();
  const desiredValue = isGameplayHud ? String(wave || START_WAVE || 1) : String(stageWaveMenuSelection || "menu");
  if (stageWaveDropdown.value !== desiredValue) stageWaveDropdown.value = desiredValue;
  if (stageWaveDropdown.value !== desiredValue) stageWaveDropdown.value = "menu";
  syncTightSelectWidth(stageWaveDropdown, "--stage-wave-select-ch");
}
function jumpToWaveFromHudSelect(nextWave){
  const n = Math.max(1, Math.min(21, parseInt(nextWave, 10) || 1));
  START_WAVE = n;
  if (startWaveSelect) startWaveSelect.value = String(n);
  if (startWaveLabel) startWaveLabel.textContent = getStartWaveText(n);
  syncStartOptionsLabels();
  if (!(isPausedGameplayMenuBackdropState())){
    stageWaveMenuSelection = String(n);
    syncStageWaveDropdown();
    return;
  }
  wave = n;
  bullets.length = 0;
  enemyBullets.length = 0;
  fireCooldown = 0;
  bomb = null;
  ufo = null;
  resetFormation();
  showWaveBanner(wave);
  spawnEnemies();
  trySpawnUFO();
  syncStageWaveDropdown();
}
function updateMusicHud(labelText){
  audioMuted = effectiveAudioMuted();
  const icon = audioMuted ? "🔇" : "🔊";
  if (stageHudLabel && typeof labelText === "string") stageHudLabel.textContent = labelText;
  if (stageHudSpeaker){
    stageHudSpeaker.textContent = icon;
    stageHudSpeaker.setAttribute("aria-label", audioMuted ? "Unmute audio" : "Mute audio");
    stageHudSpeaker.title = audioMuted ? "Unmute all game audio" : "Mute all game audio";
  }
  if (musicFileDropdown){
    const filename = getActiveMusicFilename();
    musicFileDropdown.value = filename;
    if (musicFileDropdown.value !== filename) musicFileDropdown.value = "Muted";
    musicFileDropdown.classList.toggle("isMuted", !!audioMuted);
    musicFileDropdown.title = audioMuted ? "Muted" : filename;
    syncTightSelectWidth(musicFileDropdown, "--music-select-ch");
  }
  syncStageWaveDropdown();
  if (stageHud){
    stageHud.dataset.audioIcon = icon;
    stageHud.setAttribute("aria-label", `${stageHudLabel ? stageHudLabel.textContent : "HUD"}. Audio ${audioMuted ? "muted" : "enabled"}.`);
    stageHud.title = audioMuted ? "Unmute all game audio" : "Mute all game audio";
  }
}
function syncStartMenuMuteIcon(){
  const icon = audioMuted ? "🔇" : "🔊";
  if (startMenuTitle){
    startMenuTitle.dataset.audioIcon = icon;
    startMenuTitle.setAttribute("aria-label", audioMuted ? "Game title. Audio muted." : "Game title. Audio enabled.");
    startMenuTitle.title = audioMuted ? "Audio muted" : "Audio enabled";
  }
  updateMusicHud();
}
function toggleStartMenuTitleMute(){
  unlockAudioOnce();
  setMuteOptionEnabled(!audioMuted);
  if (!audioMuted && isPreGameplayMenuAudioState()) ensureMenuMusicPlaying(true);
}
function primeMenuMusicOnFirstGesture(){
  unlockAudioOnce();
  if (!audioMuted && isPreGameplayMenuAudioState()) ensureMenuMusicPlaying();
}
if (stageHudSpeaker) stageHudSpeaker.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleStartMenuTitleMute();
});
if (stageWaveDropdownWrap) stageWaveDropdownWrap.addEventListener("click", (event) => {
  focusDropdownFromWrapper(stageWaveDropdown, event);
});
if (stageWaveDropdown) stageWaveDropdown.addEventListener("change", (event) => {
  event.preventDefault();
  event.stopPropagation();
  const selected = stageWaveDropdown.value;
  if (selected === "menu"){
    stageWaveMenuSelection = "menu";
    if (gameState === STATE.PLAYING) showMenu();
    syncStageWaveDropdown();
    return;
  }
  jumpToWaveFromHudSelect(selected);
});
if (musicDropdownWrap) musicDropdownWrap.addEventListener("click", (event) => {
  focusDropdownFromWrapper(musicFileDropdown, event);
});
if (musicFileDropdown) musicFileDropdown.addEventListener("change", (event) => {
  event.preventDefault();
  event.stopPropagation();
  setHudMusicSelection(musicFileDropdown.value);
  syncTightSelectWidth(musicFileDropdown, "--music-select-ch");
});
const btnControls = document.getElementById("btnControls");
const btnMysteryLink = document.getElementById("btnMysteryLink");
const menuHubPanel = document.getElementById("menuHubPanel");
const menuHubPanelInner = document.getElementById("menuHubPanelInner");
const menuHubContent = document.getElementById("menuHubContent");
const btnMenuHubImages = document.getElementById("btnMenuHubImages");
const btnMenuHubStats = document.getElementById("btnMenuHubStats");
const btnMenuHubOptions = document.getElementById("btnMenuHubOptions");
const btnMenuHubClose = document.getElementById("btnMenuHubClose");
const btnStats = document.getElementById("btnStats");
const statsPanel = document.getElementById("statsPanel");
const statsPanelTitle = document.getElementById("statsPanelTitle");
const statsPanelInner = document.getElementById("statsPanelInner");
const statsScroll = document.getElementById("statsScroll");
const statsLockedDetails = document.getElementById("statsLockedDetails");
const btnStatsEnterNickname = document.getElementById("btnStatsEnterNickname");
const statsNicknameInput = document.getElementById("statsNicknameInput");
const statsSavedProfilesGrid = document.getElementById("statsSavedProfilesGrid");
const btnStatsLockedToggle = document.getElementById("btnStatsLockedToggle");
const btnStatsSavedImagesToggle = document.getElementById("btnStatsSavedImagesToggle");
const statsSavedImagesList = document.getElementById("statsSavedImagesList");
const btnStatsClose = document.getElementById("btnStatsClose");
const btnStatsImport = document.getElementById("btnStatsImport");
const btnStatsReset = document.getElementById("btnStatsReset");
const btnStatsExport = document.getElementById("btnStatsExport");
const btnImages = document.getElementById("btnImages");
const imagesPanel = document.getElementById("imagesPanel");
const imagesPanelInner = document.getElementById("imagesPanelInner");
const imagesList = document.getElementById("imagesList");
const btnImagesClose = document.getElementById("btnImagesClose");
const btnImagesClear = document.getElementById("btnImagesClear");
const statLifetimeScore = document.getElementById("statLifetimeScore");
const statLifetimeEnemies = document.getElementById("statLifetimeEnemies");
const statLifetimeUfos = document.getElementById("statLifetimeUfos");
const statLifetimeWins = document.getElementById("statLifetimeWins");
const statLifetimeDeaths = document.getElementById("statLifetimeDeaths");
const statLifetimeBullets = document.getElementById("statLifetimeBullets");
const statLifetimeBombKills = document.getElementById("statLifetimeBombKills");
const controlsMenu = document.getElementById("controlsMenu");
const controlsMenuTitle = document.getElementById("controlsMenuTitle");
const controlsBindList = document.getElementById("controlsBindList");
const controlsResetBinds = document.getElementById("controlsResetBinds");
const controlsApplyBinds = document.getElementById("controlsApplyBinds");
const controlsBack = document.getElementById("controlsBack");
const controlsMenuInner = document.getElementById("controlsMenuInner");
const controlsListScroll = document.getElementById("controlsListScroll");
const controlsPreviewMenu = document.getElementById("controlsPreviewMenu");
const controlsPreviewFrame = document.getElementById("controlsPreviewFrame");
const controlsPreviewBack = document.getElementById("controlsPreviewBack");
const btnBack = document.getElementById("btnBack");
const btnApply = document.getElementById("btnApply");
const btnCheats = document.getElementById("btnCheats");
const btnCheatsUnlockInput = document.getElementById("btnCheatsUnlockInput");
const cheatsButtonRow = document.getElementById("cheatsButtonRow");
const cheatermodeOptionRow = document.getElementById("cheatermodeOptionRow");
const cheatermodeCountdownDisplay = document.getElementById("cheatermodeCountdownDisplay");
const cheatermodeUnlockedControl = document.getElementById("cheatermodeUnlockedControl");
const cheatermodeUnlockedCheckbox = document.getElementById("cheatermodeUnlockedCheckbox");
const nicknameInput = document.getElementById("nicknameInput");
const nicknameInputGhost = document.getElementById("nicknameInputGhost");
const btnNicknameAction = document.getElementById("btnNicknameAction");
const backgroundColorHex = document.getElementById("backgroundColorHex");
const backgroundColorPicker = document.getElementById("backgroundColorPicker");
const muteCheckbox = document.getElementById("muteCheckbox");
const muteStatus = document.getElementById("muteStatus");
const fullscreenCheckbox = document.getElementById("fullscreenCheckbox");
const btnCheatsBack = document.getElementById("btnCheatsBack");
const btnCheatsApply = document.getElementById("btnCheatsApply");

  // =======================
  // Start Options (v1.96)
  // =======================
  const livesSlider = document.getElementById("livesSlider");
  const heartsSlider = document.getElementById("heartsSlider");
  const shieldsSlider = document.getElementById("shieldsSlider");
  const bombsSlider = document.getElementById("bombsSlider");
  const speedSlider = document.getElementById("speedSlider");
  const infiniteToggle = document.getElementById("infiniteToggle");
  const shootTypeSelect = document.getElementById("shootTypeSelect");
  const shootTypeStatus = document.getElementById("shootTypeStatus");
  const startWaveSelect = document.getElementById("startWaveSelect");
const btnSkipToLevel2 = document.getElementById("btnSkipToLevel2");
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
  const DEFAULT_START_GAME_SPEED = 1;
  const DEFAULT_START_WAVE = 1;
  // Saved settings (persist for the session)
  let START_LIVES = DEFAULT_START_LIVES;
  let START_HEARTS = DEFAULT_START_HEARTS;
  let START_SHIELDS = DEFAULT_START_SHIELDS;
  let START_BOMBS = DEFAULT_START_BOMBS;
  // v1.97: each resource can independently use 100 as INFINITE.
  let START_LIVES_INFINITE = false;
  let START_HEARTS_INFINITE = false;
  let START_SHIELDS_INFINITE = false;
  let START_BOMBS_INFINITE = false;
  // v1.96: game speed slider (1-10). 5 = 1.0x.
  let START_GAME_SPEED = DEFAULT_START_GAME_SPEED;
  let GAME_SPEED_MULT = 1;
  let INFINITE_MODE = false;
  
let START_WAVE = DEFAULT_START_WAVE; // 1-10 = normal waves, 11 = Boss Mode, 12-21 = Insanity 1-10

let INVERT_COLORS = false;
let fullscreenOptionEnabled = !!document.fullscreenElement;
const fullscreenStatus = document.getElementById("fullscreenStatus");
const invertColorsCheckbox = document.getElementById("invertColorsCheckbox");
const videoFxCheckbox = document.getElementById("videoFxCheckbox");
const infiniteToggleStatus = document.getElementById("infiniteToggleStatus");
const invertColorsStatus = document.getElementById("invertColorsStatus");
const videoFxStatus = document.getElementById("videoFxStatus");

function applyInvertColors(){
  document.body.classList.toggle("invert-colors", INVERT_COLORS);
}

function syncFullscreenOptionState(nextState = null){
  fullscreenOptionEnabled = typeof nextState === "boolean" ? nextState : !!document.fullscreenElement;
  if (fullscreenCheckbox) fullscreenCheckbox.checked = !!fullscreenOptionEnabled;
  if (fullscreenStatus) fullscreenStatus.textContent = fullscreenOptionEnabled ? "Enabled" : "Disabled";
}

const CHEATERMODE_KEYBOARD_PROMPT = "Type cheatermode";
const CHEATERMODE_CONTROLLER_PROMPT = "Hold X + View 5s";
const CHEATERMODE_CONTROLLER_HOLD_MS = 5000;
const CHEATERMODE_TYPED_COUNTDOWN_MS = 5000;
const CHEATERMODE_COUNTDOWN_PHRASE = "cheatermode";
const CHEATERMODE_INSTANT_PHRASES = ["jinclops", "tektite"];
const CHEATERMODE_TYPED_UNLOCK_PHRASES = [CHEATERMODE_COUNTDOWN_PHRASE, ...CHEATERMODE_INSTANT_PHRASES];
const CHEATERMODE_TYPED_BUFFER_MAX = CHEATERMODE_TYPED_UNLOCK_PHRASES.reduce((max, phrase) => Math.max(max, phrase.length), 0);

function normalizeCheatermodeUnlockText(value){
  return String(value || "").trim().toLowerCase();
}

function isCheatermodeCountdownPhrase(value){
  return normalizeCheatermodeUnlockText(value) === CHEATERMODE_COUNTDOWN_PHRASE;
}

function isCheatermodeInstantPhrase(value){
  return CHEATERMODE_INSTANT_PHRASES.includes(normalizeCheatermodeUnlockText(value));
}

function isCheatermodeTypedPrefix(value){
  const text = normalizeCheatermodeUnlockText(value);
  return !!text && CHEATERMODE_TYPED_UNLOCK_PHRASES.some((phrase) => phrase.startsWith(text));
}

function getCheatermodePromptText(){
  return activeInputMode === INPUT_MODE_CONTROLLER ? CHEATERMODE_CONTROLLER_PROMPT : CHEATERMODE_KEYBOARD_PROMPT;
}

function formatCheatermodeControllerHoldText(remaining){
  const seconds = Math.max(1, Math.ceil(Number(remaining) || 0));
  return "Hold X + View " + seconds + "s";
}

function getCheatermodeComboClass(xPressed = false, viewPressed = false){
  if (xPressed && viewPressed) return "comboBoth";
  if (xPressed || viewPressed) return "comboPartial";
  return "comboNone";
}

function escapeCheatermodeHtml(value){
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function renderCheatermodeControllerComboLabel(target, { remaining = 5, xPressed = false, viewPressed = false, unlocked = false } = {}){
  if (!target) return false;
  const seconds = Math.max(1, Math.ceil(Number(remaining) || 5));
  const comboClass = getCheatermodeComboClass(!!xPressed, !!viewPressed);
  const plainText = unlocked ? "Cheats (Unlocked)" : "Hold X + View " + seconds + "s";
  const xIcon = '<span class="cheatermodeComboButton ' + comboClass + '" aria-hidden="true"><img src="/dead/games/shooter-game/assets/controller-buttons/button-x.webp" alt="" /></span>';
  const viewIcon = '<span class="cheatermodeComboButton ' + comboClass + '" aria-hidden="true"><img src="/dead/games/shooter-game/assets/controller-buttons/view.webp" alt="" /></span>';
  const nextHtml = unlocked
    ? "Cheats (Unlocked)"
    : 'Hold ' + xIcon + ' + ' + viewIcon + ' <span class="cheatermodeCountdown">' + escapeCheatermodeHtml(seconds) + 's</span>';
  if (target.dataset.cheatermodeComboVisual !== nextHtml){
    target.innerHTML = nextHtml;
    target.dataset.cheatermodeComboVisual = nextHtml;
  }
  target.setAttribute("aria-label", plainText);
  return true;
}

function clearCheatermodeControllerComboLabel(target, fallback = "Cheats"){
  if (!target) return;
  delete target.dataset.cheatermodeComboVisual;
  target.textContent = fallback;
}

function isCheatermodePromptText(value){
  const text = String(value || "").trim();
  return text === CHEATERMODE_KEYBOARD_PROMPT || text === CHEATERMODE_CONTROLLER_PROMPT || /^Hold X \+ View(?: \d+s| \(\d+\))?$/.test(text) || /^\(\d+ seconds?\)$/.test(text) || text === "Cheatermode unlocked";
}

function updateCheatsUnlockModeHint(){
  const controllerActive = activeInputMode === INPUT_MODE_CONTROLLER;
  const hint = controllerActive
    ? "Controller active: hold X + View for 5 seconds to unlock cheat commands."
    : "Keyboard/mouse active: type cheatermode to unlock cheat commands.";
  if (cheatermodeOptionRow){
    cheatermodeOptionRow.classList.toggle("cheatermodeUnlocked", !!cheatsUnlockedByPassphrase);
  }
  if (cheatsButtonRow){
    cheatsButtonRow.classList.toggle("cheatermodeUnlocked", !!cheatsUnlockedByPassphrase);
    cheatsButtonRow.classList.toggle("cheatermodeCounting", !!cheatsUnlockTimer);
    cheatsButtonRow.classList.toggle("cheatsUnlockReady", !!cheatsUnlockInputReady);
  }
  if (cheatermodeCountdownDisplay){
    cheatermodeCountdownDisplay.hidden = !cheatsUnlockTimer;
  }
  if (cheatermodeUnlockedControl){
    cheatermodeUnlockedControl.hidden = !cheatsUnlockedByPassphrase;
  }
  if (cheatermodeUnlockedCheckbox){
    cheatermodeUnlockedCheckbox.checked = !!cheatsUnlockedByPassphrase;
  }
  if (btnCheats && !cheatsUnlockedByPassphrase){
    btnCheats.title = hint;
    const cheatsTargetFocused = controllerActive
      && !cheatsUnlockTimer
      && !cheatsUnlockInputReady
      && isCheatermodeOptionsContextOpen()
      && isOptionsCheatsButtonFocused();
    if (cheatsTargetFocused){
      renderCheatermodeControllerComboLabel(btnCheats, { remaining: Math.ceil(CHEATERMODE_CONTROLLER_HOLD_MS / 1000), xPressed: false, viewPressed: false, unlocked: false });
    } else {
      if (btnCheats.dataset.cheatermodeComboVisual) clearCheatermodeControllerComboLabel(btnCheats, "Cheats");
      btnCheats.setAttribute("aria-label", hint);
    }
  } else if (btnCheats){
    btnCheats.title = "Cheats unlocked";
    btnCheats.setAttribute("aria-label", "Cheats unlocked");
  }
  if (btnCheatsUnlockInput){
    if (cheatsUnlockedByPassphrase){
      btnCheatsUnlockInput.placeholder = "Cheatermode unlocked";
      btnCheatsUnlockInput.setAttribute("aria-label", "Cheatermode unlocked");
      btnCheatsUnlockInput.value = "Cheatermode unlocked";
      btnCheatsUnlockInput.readOnly = true;
      btnCheatsUnlockInput.style.display = "none";
      return;
    }
    if (cheatsUnlockTimer){
      btnCheatsUnlockInput.readOnly = true;
      btnCheatsUnlockInput.setAttribute("aria-label", "Cheatermode activation countdown");
      return;
    }
    btnCheatsUnlockInput.placeholder = controllerActive ? "Hold X + View" : CHEATERMODE_KEYBOARD_PROMPT;
    btnCheatsUnlockInput.setAttribute("aria-label", hint);
    btnCheatsUnlockInput.readOnly = controllerActive;
    if (controllerActive || isCheatermodePromptText(btnCheatsUnlockInput.value) || String(btnCheatsUnlockInput.value || "").trim() === ""){
      btnCheatsUnlockInput.value = getCheatermodePromptText();
    }
  }
}

function setCheatsUnlockInputPrompt(){
  if (!btnCheatsUnlockInput) return;
  if (cheatsUnlockedByPassphrase){
    btnCheatsUnlockInput.value = "Cheatermode unlocked";
    btnCheatsUnlockInput.readOnly = true;
    updateCheatsUnlockModeHint();
    return;
  }
  btnCheatsUnlockInput.value = getCheatermodePromptText();
  btnCheatsUnlockInput.readOnly = activeInputMode === INPUT_MODE_CONTROLLER;
  updateCheatsUnlockModeHint();
}

function notifyParentActiveInputMode(){
  try{
    if (window.parent && window.parent !== window){
      window.parent.postMessage({ type: "tektite:input-mode", mode: activeInputMode }, "*");
    }
  }catch(_){ }
}

function setFullscreenOptionEnabled(shouldEnable){
  const nextState = !!shouldEnable;
  if (requestHostFullscreen(nextState ? "enter" : "exit")){
    syncFullscreenOptionState(nextState);
    return;
  }
  const elem = document.documentElement;
  if (nextState){
    if (!document.fullscreenElement && elem.requestFullscreen){
      const request = elem.requestFullscreen();
      if (request && typeof request.catch === "function"){
        request.catch(() => syncFullscreenOptionState(false));
      }
    }
  } else if (document.fullscreenElement && document.exitFullscreen){
    const request = document.exitFullscreen();
    if (request && typeof request.catch === "function"){
      request.catch(() => syncFullscreenOptionState(!!document.fullscreenElement));
    }
  }
  syncFullscreenOptionState(nextState ? !!document.fullscreenElement : false);
}


function clearCheatsUnlockCountdown(){
  if (cheatsUnlockTimer){
    clearInterval(cheatsUnlockTimer);
    cheatsUnlockTimer = null;
  }
  if (cheatsUnlockFinishTimer){
    clearTimeout(cheatsUnlockFinishTimer);
    cheatsUnlockFinishTimer = null;
  }
  if (cheatsButtonRow) cheatsButtonRow.classList.remove("cheatermodeCounting");
  if (cheatermodeCountdownDisplay) cheatermodeCountdownDisplay.hidden = true;
}

function formatTypedCheatermodeCountdownText(remaining){
  const seconds = Math.max(0, Math.ceil(Number(remaining) || 0));
  return "(" + seconds + " " + (seconds === 1 ? "second" : "seconds") + ")";
}

function renderTypedCheatermodeCountdown(){
  if (!cheatermodeCountdownDisplay) return;
  cheatermodeCountdownDisplay.innerHTML = '<span class="cheatermodeCountdownText">' + escapeCheatermodeHtml(formatTypedCheatermodeCountdownText(cheatsUnlockRemaining)) + '</span><button type="button" class="cheatermodeCountdownCancel" aria-label="Cancel cheatermode countdown" title="Cancel countdown">❌</button>';
}

function scrollOptionsToCheatsButton(){
  if (!optionsScroll || !btnCheats) return;
  const applyScroll = () => {
    try{ optionsScroll.scrollTop = optionsScroll.scrollHeight; }catch(_){ }
    try{ btnCheats.scrollIntoView({ block: "nearest", inline: "nearest" }); }catch(_){ }
  };
  try{ applyScroll(); }catch(_){}
  try{ requestAnimationFrame(applyScroll); }catch(_){ setTimeout(applyScroll, 0); }
}

function cancelTypedCheatermodeCountdown(event = null){
  if (event){
    event.preventDefault();
    event.stopPropagation();
  }
  resetCheatsUnlockGate();
  if (gameState === STATE.OPTIONS){
    optionsFocusIndex = Math.max(0, getOptionsControllerTargets().indexOf(btnCheats));
    if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  }
}

function resetCheatsUnlockGate(){
  clearCheatsUnlockCountdown();
  cheatermodeControllerHoldMs = 0;
  cheatsUnlockRemaining = 0;
  cheatsUnlockInputReady = false;
  const unlocked = !!cheatsUnlockedByPassphrase;
  if (btnCheats){
    btnCheats.style.display = "block";
    btnCheats.disabled = false;
    clearCheatermodeControllerComboLabel(btnCheats, unlocked ? "Cheats (Unlocked)" : "Cheats");
  }
  if (btnCheatsUnlockInput){
    btnCheatsUnlockInput.style.display = "none";
    setCheatsUnlockInputPrompt();
  }
  updateCheatsUnlockModeHint();
}

function armCheatsUnlockCountdown(event = null){
  if (event && event.detail > 0) setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
  if (cheatsUnlockedByPassphrase){
    if (btnCheats) clearCheatermodeControllerComboLabel(btnCheats, "Cheats (Unlocked)");
    showCheats();
    return;
  }
  if (!btnCheats || cheatsUnlockTimer) return;
  if (activeInputMode === INPUT_MODE_CONTROLLER){
    optionsFocusIndex = Math.max(0, getOptionsControllerTargets().indexOf(btnCheats));
    renderCheatermodeControllerComboLabel(btnCheats, { remaining: Math.ceil(CHEATERMODE_CONTROLLER_HOLD_MS / 1000), xPressed: false, viewPressed: false, unlocked: false });
    syncOptionsControllerFocus();
    return;
  }
  showCheatsUnlockInput();
}

function showCheatsUnlockInput(){
  cheatsUnlockInputReady = true;
  cheatermodeControllerHoldMs = 0;
  if (btnCheatsUnlockInput){
    btnCheatsUnlockInput.style.display = "block";
    setCheatsUnlockInputPrompt();
    if (activeInputMode !== INPUT_MODE_CONTROLLER){
      activateCheatsUnlockInput();
      try{ btnCheatsUnlockInput.focus(); btnCheatsUnlockInput.select(); }catch(e){}
      try{ btnCheatsUnlockInput.scrollIntoView({ block: "nearest", inline: "nearest" }); }catch(e){}
    }
  }
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
}

function activateCheatsUnlockInput(){
  if (!btnCheatsUnlockInput) return;
  if (cheatsUnlockedByPassphrase){
    setCheatsUnlockInputPrompt();
    return;
  }
  if (activeInputMode === INPUT_MODE_CONTROLLER){
    btnCheatsUnlockInput.readOnly = true;
    setCheatsUnlockInputPrompt();
    return;
  }
  btnCheatsUnlockInput.readOnly = false;
  if (isCheatermodePromptText(btnCheatsUnlockInput.value)){
    btnCheatsUnlockInput.value = "";
  }
}

function focusCheatsUnlockInput(){
  if (!btnCheatsUnlockInput) return;
  if (activeInputMode !== INPUT_MODE_CONTROLLER) activateCheatsUnlockInput();
  else if (String(btnCheatsUnlockInput.value || "").trim() === "" || isCheatermodePromptText(btnCheatsUnlockInput.value)){
    setCheatsUnlockInputPrompt();
  }
}

function restoreCheatsUnlockPromptIfEmpty(){
  if (!btnCheatsUnlockInput) return;
  if (String(btnCheatsUnlockInput.value || "").trim() !== "") return;
  setCheatsUnlockInputPrompt();
}

function unlockCheatermode(source = "typed"){
  if (cheatsUnlockedByPassphrase) return;
  cheatsUnlockedByPassphrase = true;
  notifyCheatsUnlockedState();
  if (pauseCmdSuggest && pauseCmdSuggest.style.display !== "none") showHelp();
  lockScoreTrackingState();
  clearCheatsUnlockCountdown();
  cheatermodeControllerHoldMs = 0;
  cheatsUnlockInputReady = false;
  if (btnCheatsUnlockInput){
    btnCheatsUnlockInput.style.display = "none";
    setCheatsUnlockInputPrompt();
  }
  if (btnCheats){
    btnCheats.style.display = "block";
    btnCheats.disabled = false;
    clearCheatermodeControllerComboLabel(btnCheats, "Cheats (Unlocked)");
  }
  syncCheatsMenuState();
  updateCheatsUnlockModeHint();
  syncStageWaveDropdown();
  if ((source === "typed-countdown" || source === "typed-instant") && (gameState === STATE.OPTIONS || isPauseOptionsOpen())){
    optionsFocusIndex = Math.max(0, getOptionsControllerTargets().indexOf(btnCheats));
    scrollOptionsToCheatsButton();
    if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  }
  if (source === "controller-hold" && (gameState === STATE.OPTIONS || isPauseOptionsOpen())){
    optionsFocusIndex = Math.max(0, getOptionsControllerTargets().indexOf(btnCheats));
    scrollOptionsToCheatsButton();
    if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
    return;
  }
  if (activeInputMode === INPUT_MODE_CONTROLLER) {
    optionsFocusIndex = Math.max(0, getOptionsControllerTargets().indexOf(btnCheats));
    syncOptionsControllerFocus();
  }
}

function startTypedCheatermodeCountdown(){
  if (!btnCheatsUnlockInput || cheatsUnlockedByPassphrase || cheatsUnlockTimer) return;
  cheatsUnlockInputReady = true;
  cheatsUnlockRemaining = Math.ceil(CHEATERMODE_TYPED_COUNTDOWN_MS / 1000);
  btnCheatsUnlockInput.readOnly = true;
  btnCheatsUnlockInput.style.display = "none";
  if (cheatermodeCountdownDisplay){
    cheatermodeCountdownDisplay.hidden = false;
    renderTypedCheatermodeCountdown();
  }
  btnCheatsUnlockInput.setAttribute("aria-label", "Cheatermode activation countdown");
  cheatsUnlockTimer = setInterval(() => {
    cheatsUnlockRemaining = Math.max(0, cheatsUnlockRemaining - 1);
    if (cheatsUnlockRemaining <= 0){
      clearCheatsUnlockCountdown();
      unlockCheatermode("typed-countdown");
    } else if (cheatermodeCountdownDisplay) {
      renderTypedCheatermodeCountdown();
    }
  }, 1000);
  updateCheatsUnlockModeHint();
}

function resetCheatsButtonTypedBuffer(){
  cheatsButtonTypedBuffer = "";
  if (cheatsButtonTypedBufferTimer){
    clearTimeout(cheatsButtonTypedBufferTimer);
    cheatsButtonTypedBufferTimer = null;
  }
}

function handleCheatsButtonTypedKey(event){
  if (!event || !btnCheats) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (cheatsUnlockedByPassphrase || cheatsUnlockTimer || cheatsUnlockFinishTimer) return;
  if (activeInputMode === INPUT_MODE_CONTROLLER) return;
  if (event.key === "Backspace"){
    event.preventDefault();
    cheatsButtonTypedBuffer = cheatsButtonTypedBuffer.slice(0, -1);
    return;
  }
  if (event.key === "Escape"){
    resetCheatsButtonTypedBuffer();
    return;
  }
  if (!event.key || event.key.length !== 1) return;
  const next = (cheatsButtonTypedBuffer + event.key.toLowerCase()).slice(-CHEATERMODE_TYPED_BUFFER_MAX);
  cheatsButtonTypedBuffer = next;
  if (cheatsButtonTypedBufferTimer) clearTimeout(cheatsButtonTypedBufferTimer);
  cheatsButtonTypedBufferTimer = setTimeout(resetCheatsButtonTypedBuffer, 1600);
  if (isCheatermodeTypedPrefix(next)) event.preventDefault();
  if (isCheatermodeInstantPhrase(next)){
    event.preventDefault();
    resetCheatsButtonTypedBuffer();
    unlockCheatermode("typed-instant");
    return;
  }
  if (isCheatermodeCountdownPhrase(next)){
    event.preventDefault();
    resetCheatsButtonTypedBuffer();
    startTypedCheatermodeCountdown();
  }
}

function submitCheatsUnlockInput(){
  if (!btnCheatsUnlockInput) return;
  if (cheatsUnlockTimer || cheatsUnlockFinishTimer || cheatsUnlockedByPassphrase) return;
  const typed = normalizeCheatermodeUnlockText(btnCheatsUnlockInput.value);
  if (isCheatermodeInstantPhrase(typed)){
    unlockCheatermode("typed-instant");
    return;
  }
  if (!isCheatermodeCountdownPhrase(typed)) return;
  startTypedCheatermodeCountdown();
}

function getCheatsUnlockOptionTarget(){
  // Keep controller selection anchored to the visible Cheats button even after unlocking.
  // The unlocked checkbox remains mouse-clickable, but it should not steal controller focus
  // and kick the selector back to the top of the Options list. Because apparently focus
  // management wanted to become performance art.
  return btnCheats;
}

function updateCheatsApplyButtonState(){
  if (!btnCheatsApply) return;
  if (cheatsHavePendingChanges) setStateApplyButton(btnCheatsApply, "dirty");
  else if (cheatsJustApplied) setStateApplyButton(btnCheatsApply, "applied");
  else setStateApplyButton(btnCheatsApply, "hidden");
}

function markCheatsDirty(){
  // Cheats menu controls now apply immediately on change; the old Apply button is gone.
  applyCheatsChanges(false);
}

function markCheatsClean(applied=false){
  cheatsHavePendingChanges = false;
  cheatsJustApplied = !!applied;
  updateCheatsApplyButtonState();
}

function syncCheatsMenuState(){
  if (infiniteToggle) infiniteToggle.checked = !!INFINITE_MODE;
  if (muteCheckbox) muteCheckbox.checked = !!audioMuted;
  if (invertColorsCheckbox) invertColorsCheckbox.checked = !!INVERT_COLORS;
  if (videoFxCheckbox) videoFxCheckbox.checked = !!VIDEO_FX_ENABLED;
  if (infiniteToggleStatus) infiniteToggleStatus.textContent = INFINITE_MODE ? "Enabled" : "Disabled";
  if (muteStatus) muteStatus.textContent = audioMuted ? "Enabled" : "Disabled";
  if (invertColorsStatus) invertColorsStatus.textContent = INVERT_COLORS ? "Enabled" : "Disabled";
  if (videoFxStatus) videoFxStatus.textContent = VIDEO_FX_ENABLED ? "Enabled" : "Disabled";
  if (shootTypeSelect) shootTypeSelect.value = shootCheatMode || "normal";
  if (shootTypeStatus) shootTypeStatus.textContent = shootCheatMode || "normal";
}

if (infiniteToggle){
  infiniteToggle.addEventListener("change", () => {
    applyGlobalInfiniteMode(!!infiniteToggle.checked);
  });
}

if (shootTypeSelect){
  shootTypeSelect.addEventListener("change", () => {
    const mode = String(shootTypeSelect.value || "normal").trim() || "normal";
    execPauseCommand("/shoot " + mode);
    syncCheatsMenuState();
    focusControllerElement(shootTypeSelect);
  });
}

if (invertColorsCheckbox){
  invertColorsCheckbox.addEventListener("change", () => {
    INVERT_COLORS = !!invertColorsCheckbox.checked;
    applyInvertColors();
    syncCheatsMenuState();
  });
}

if (videoFxCheckbox){
  videoFxCheckbox.addEventListener("change", () => {
    setVideoFxEnabled(!!videoFxCheckbox.checked);
  });
}


  function getStartWaveText(v){
    const n = parseInt(v, 10) || 1;
    if (n === 11) return "Boss Mode";
    if (n >= 12 && n <= 21) return "Insanity " + (n - 11);
    return String(n);
  }

  function clampNumericInput(inputEl){
    if (!inputEl) return;
    const min = Number(inputEl.min);
    const max = Number(inputEl.max);
    let value = parseInt(inputEl.value, 10);
    if (!Number.isFinite(value)) value = Number.isFinite(min) ? min : 0;
    if (Number.isFinite(min)) value = Math.max(min, value);
    if (Number.isFinite(max)) value = Math.min(max, value);
    inputEl.value = String(value);
  }

  function isStartingStatInputEl(inputEl){
    return !!inputEl && getStartingStatInputs().includes(inputEl);
  }

  function normalizeStartStatInput(inputEl){
    if (!inputEl) return;
    const min = Number(inputEl.min);
    const max = Number(inputEl.max);
    const parsed = parseResourceOption(inputEl, Number.isFinite(min) ? min : 0);
    let nextValue = parsed.infinite ? 100 : parsed.value;
    if (Number.isFinite(min)) nextValue = Math.max(min, nextValue);
    if (Number.isFinite(max)) nextValue = Math.min(max, nextValue);
    inputEl.value = parsed.infinite ? "\u221e" : String(nextValue);
  }

  function syncRangeProgress(rangeEl){
  if (!rangeEl) return;
  const min = parseFloat(rangeEl.min || '0');
  const max = parseFloat(rangeEl.max || '100');
  const value = parseFloat(rangeEl.value || '0');
  const span = max - min;
  const progress = span ? ((value - min) / span) * 100 : 0;
  rangeEl.style.setProperty('--range-progress', Math.max(0, Math.min(100, progress)) + '%');
}

function syncStartOptionsLabels(){
    if (livesVal && livesSlider) livesVal.textContent = formatResourceOptionValue(livesSlider);
    if (heartsVal && heartsSlider) heartsVal.textContent = formatResourceOptionValue(heartsSlider);
    if (shieldsVal && shieldsSlider) shieldsVal.textContent = formatResourceOptionValue(shieldsSlider);
    if (bombsVal && bombsSlider) bombsVal.textContent = formatResourceOptionValue(bombsSlider);
    if (speedVal && speedSlider) speedVal.textContent = String(getSpeedValueFromSlider());
    syncRangeProgress(speedSlider);
    if (startWaveLabel && startWaveSelect) startWaveLabel.textContent = getStartWaveText(startWaveSelect.value);
    if (typeof renderMenuHudPreview === "function" && gameState !== STATE.PLAYING) renderMenuHudPreview();
  }

  [livesSlider, heartsSlider, shieldsSlider, bombsSlider].forEach(inputEl => {
    if (!inputEl) return;
    inputEl.addEventListener("focus", () => {
      if (activeInputMode !== INPUT_MODE_CONTROLLER) inputEl.select();
    });
    inputEl.addEventListener("click", () => {
      if (activeInputMode !== INPUT_MODE_CONTROLLER) inputEl.select();
    });
    inputEl.addEventListener("input", syncStartOptionsLabels);
    inputEl.addEventListener("change", () => {
      normalizeStartStatInput(inputEl);
      syncStartOptionsLabels();
    });
    inputEl.addEventListener("blur", () => {
      normalizeStartStatInput(inputEl);
      syncStartOptionsLabels();
    });
    inputEl.addEventListener("wheel", (e) => {
      if (activeInputMode === INPUT_MODE_CONTROLLER) return;
      e.preventDefault();
      setActiveInputMode(INPUT_MODE_KEYBOARD);
      stepNumberInput(inputEl, e.deltaY < 0 ? 1 : -1);
    }, { passive:false });
  });
  if (speedSlider){
    speedSlider.addEventListener("input", syncStartOptionsLabels);
    speedSlider.addEventListener("change", syncStartOptionsLabels);
  }
  if (startWaveSelect) startWaveSelect.addEventListener("change", () => {
    START_WAVE = Math.max(1, Math.min(21, parseInt(startWaveSelect.value, 10) || 1));
    stageWaveMenuSelection = String(START_WAVE);
    syncStartOptionsLabels();
    syncStageWaveDropdown();
  });
  syncStartOptionsLabels();
  syncStageWaveDropdown();
  syncCheatsMenuState();
  syncBackgroundColorControls();
  syncScoreTrackingState();

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
let controlsInputLockMode = null;
let controlsBindMode = INPUT_MODE_KEYBOARD;
let controlsFocusIndex = 0;
let controlsMoveFocusIndex = 0;
let controlsReturnState = STATE.MENU;
let overlayPanelReturnTarget = STATE.MENU;
let controlsHavePendingChanges = false;
let controlsJustApplied = false;
let startMenuPanelRect = null;
let bindingEditState = null;
let controllerRebindReady = false;
let pauseControlsOpen = false;
let optionsOpenedFromPause = false;
let cheatsOpenedFromPause = false;
// Tracks Cheats opened from Options while Options is hosted inside the Menu Hub.
// Back should restore Hub -> Options, not the standalone Options menu or Start menu.
let cheatsOpenedFromHubOptions = false;
// v13.05: Tracks Hub -> Options child panels launched while the Hub itself came
// from Pause. Those screens must keep gameplay frozen behind them instead of
// secretly resuming the run. Humanity survives another focus-state bug.
let controlsOpenedFromPausedHubOptions = false;
let cheatsOpenedFromPausedHubOptions = false;
let controlsPreviewOpen = false;
let controlsPreviewControllerCaptured = false;
let controlsPreviewReleaseArmed = false;
let controlsPreviewStickHoldMs = 0;
let controlsPreviewFocusIndex = 1;
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
  updateCheatsUnlockModeHint();
  notifyParentActiveInputMode();
}
function lockControlsInputMode(mode){
  controlsInputLockMode = mode === INPUT_MODE_CONTROLLER ? INPUT_MODE_CONTROLLER : null;
}
function unlockControlsInputMode(){
  controlsInputLockMode = null;
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

  if (controlsBindMode === INPUT_MODE_CONTROLLER){
    const row = document.createElement('div');
    row.className = 'controlsBindRow controlsMoveRow controlsPreviewRow';
    const meta = document.createElement('div');
    meta.className = 'controlsBindMeta';
    const title = document.createElement('div');
    title.className = 'controlsBindTitle';
    title.textContent = 'Test Controller';
    const hint = document.createElement('div');
    hint.className = 'controlsBindHint';
    hint.textContent = 'Live input preview';
    meta.appendChild(title);
    meta.appendChild(hint);
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'controlsPreviewButtonGroup';
    const button = document.createElement('button');
    button.id = 'controlsControllerPreviewButton';
    button.type = 'button';
    button.className = 'controlsBindButton controlsPreviewButton smallBtn';
    button.textContent = 'Open';
    button.addEventListener('click', showControlsPreviewMenu);
    buttonGroup.appendChild(button);
    row.appendChild(meta);
    row.appendChild(buttonGroup);
    controlsBindList.appendChild(row);
  }

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
  markControlsDirty();
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
let menuHubFocusIndex = 0;
let menuHubActiveTab = "images";
let menuHubActiveInner = null;
let menuHubImagesContentFocused = false;
let menuHubStatsContentFocused = false;
let menuHubOptionsContentFocused = false;
// Tracks when the Menu Hub was opened from the Pause menu so Back restores Pause instead of Start.
let menuHubOpenedFromPause = false;
const MENU_HUB_TABS = ["images", "stats", "options"];
const menuHubOriginalParents = new Map();
let optionsFocusIndex = 0;
let optionsHavePendingChanges = false;
let optionsJustApplied = false;
let cheatsFocusIndex = 0;
let cheatsHavePendingChanges = false;
let cheatsJustApplied = false;
let cheatsUnlockTimer = null;
let cheatsUnlockFinishTimer = null;
let cheatsUnlockRemaining = 0;
let cheatsUnlockInputReady = false;
var cheatsUnlockedByPassphrase = false;
let cheatermodeControllerHoldMs = 0;
let cheatermodeLastControllerComboKey = "";
let cheatsButtonTypedBuffer = "";
let cheatsButtonTypedBufferTimer = null;

function notifyCheatsUnlockedState(){
  try{
    if (window.parent && window.parent !== window){
      window.parent.postMessage({
        type: "tektite:cheats-unlocked-state",
        unlocked: !!cheatsUnlockedByPassphrase
      }, "*");
    }
  }catch(error){}
}

function notifyCheatermodeControllerHoldState(active, remaining, xPressed, viewPressed){
  try{
    if (window.parent && window.parent !== window){
      window.parent.postMessage({
        type: "tektite:cheatermode-hold-state",
        active: !!active,
        remaining: Math.max(0, Math.ceil(Number(remaining) || 0)),
        totalSeconds: Math.ceil(CHEATERMODE_CONTROLLER_HOLD_MS / 1000),
        unlocked: !!cheatsUnlockedByPassphrase,
        xPressed: !!xPressed,
        viewPressed: !!viewPressed
      }, "*");
    }
  }catch(error){}
}
let startingStatFocusIndex = 0;
let statsFocusIndex = 0;
let imagesFocusIndex = 0;
let pauseFocusIndex = 0;
let winFocusIndex = 0;
let gpNavRepeat = { up:0, down:0, left:0, right:0 };
let gpNavPrevAxis = { horizontal:0, vertical:0 };

function refreshEntireShooterPage(){
  try{
    if (window.top && window.top.location) window.top.location.reload();
    else window.location.reload();
  }catch(e){
    window.location.reload();
  }
}

function focusControllerElement(el){
  if (activeInputMode !== INPUT_MODE_CONTROLLER) {
    clearControllerFocus();
    return;
  }
  if (!el) return;
  document.querySelectorAll('.controllerFocus').forEach(node => node.classList.remove('controllerFocus'));
  el.classList.add('controllerFocus');
  if (el === btnStats) fitStatsStartButtonNicknameLabel();
  const optRow = el.closest('.optRow');
  const suppressParentFocus = (el === btnCheats && optRow && optRow.id === "cheatsButtonRow");
  if (optRow && !suppressParentFocus) optRow.classList.add('controllerFocus');
  const bindRow = el.closest('.controlsBindRow');
  if (bindRow) bindRow.classList.add('controllerFocus');
  if (typeof el.focus === 'function') { try{ el.focus({ preventScroll:true }); }catch(_){ try{ el.focus(); }catch(__){} } }
  if (typeof el.scrollIntoView === 'function') {
    try{ el.scrollIntoView({ block:'nearest', inline:'nearest' }); }catch(_){ }
  }
  if (el === btnCheats && typeof updateCheatsUnlockModeHint === "function") {
    updateCheatsUnlockModeHint();
  }
  if (el !== lastControllerSelectSoundTarget) {
    lastControllerSelectSoundTarget = el;
    playUiSelectSoundFor(el, 'controller');
  }
}

function clearControllerFocus(){
  document.querySelectorAll('.controllerFocus').forEach(node => node.classList.remove('controllerFocus'));
}

if (controlsResetBinds) controlsResetBinds.addEventListener('click', () => { draftKeyboardBindings = { ...DEFAULT_KEYBOARD_BINDINGS }; draftControllerBindings = { ...DEFAULT_CONTROLLER_BINDINGS }; cancelBindingEdit(); updateControlsDisplay(); renderControlsBindingList(); markControlsDirty(); });
if (controlsApplyBinds) controlsApplyBinds.addEventListener('click', () => { if (!controlsHavePendingChanges) return; applyDraftBindings(); cancelBindingEdit(); updateControlsDisplay(); renderControlsBindingList(); markControlsClean(true); });
if (controlsBack) controlsBack.addEventListener('click', hideControlsMenu);
if (controlsPreviewBack) controlsPreviewBack.addEventListener('click', () => hideControlsPreviewMenu());
if (controlsPreviewFrame) controlsPreviewFrame.addEventListener('load', () => setControlsPreviewFrameOwnership(controlsPreviewControllerCaptured));

function updateControlsApplyButtonState(){
  if (!controlsApplyBinds) return;
  if (controlsHavePendingChanges) setStateApplyButton(controlsApplyBinds, "dirty");
  else if (controlsJustApplied) setStateApplyButton(controlsApplyBinds, "applied");
  else setStateApplyButton(controlsApplyBinds, "hidden");
}

function markControlsDirty(){
  controlsHavePendingChanges = true;
  controlsJustApplied = false;
  updateControlsApplyButtonState();
}

function markControlsClean(applied=false){
  controlsHavePendingChanges = false;
  controlsJustApplied = !!applied;
  updateControlsApplyButtonState();
}

function isStartNicknameInputActive(){
  return !!(startNicknameInput && startNicknameInput.classList.contains("nicknameEntryActive") && startNicknameInput.style.display !== "none");
}

function getStartNicknameMenuTarget(){
  if (isStartNicknameInputActive()) return startNicknameInput;
  return (btnEnterNickname && btnEnterNickname.style.display !== "none") ? btnEnterNickname : null;
}

function getMenuControllerTargets(){
  if (isStartMenuConstructionLocked()) return [];
  return [titleHoverReveal, btnStart, btnMenu, getStartNicknameMenuTarget()].filter(Boolean);
}

function getMenuHubControllerTargets(){
  return [btnMenuHubImages, btnMenuHubStats, btnMenuHubOptions].filter(Boolean);
}

function rememberMenuHubOriginalParent(el){
  if (el && el.parentNode && !menuHubOriginalParents.has(el)) menuHubOriginalParents.set(el, el.parentNode);
}

function restoreMenuHubActiveInner(){
  if (!menuHubActiveInner) return;
  const originalParent = menuHubOriginalParents.get(menuHubActiveInner);
  if (originalParent && menuHubActiveInner.parentNode !== originalParent) originalParent.appendChild(menuHubActiveInner);
  menuHubActiveInner = null;
}

function getMenuHubTabButton(tab){
  if (tab === "stats") return btnMenuHubStats;
  if (tab === "options") return btnMenuHubOptions;
  return btnMenuHubImages;
}

function getMenuHubTabForButton(button){
  if (button === btnMenuHubStats) return "stats";
  if (button === btnMenuHubOptions) return "options";
  return "images";
}

function getMenuHubInnerForTab(tab){
  if (tab === "stats") return statsPanelInner;
  if (tab === "options") return document.getElementById("optionsMenuInner");
  return imagesPanelInner;
}

function syncMenuHubTabButtons(){
  if (menuHubPanel){
    menuHubPanel.classList.toggle("menuHubTabImages", menuHubActiveTab === "images");
    menuHubPanel.classList.toggle("menuHubTabStats", menuHubActiveTab === "stats");
    menuHubPanel.classList.toggle("menuHubTabOptions", menuHubActiveTab === "options");
  }
  [btnMenuHubImages, btnMenuHubStats, btnMenuHubOptions].filter(Boolean).forEach(button => {
    const active = getMenuHubTabForButton(button) === menuHubActiveTab;
    button.classList.toggle("menuHubActiveTab", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function selectMenuHubTab(tab, focusTab=false){
  if (!MENU_HUB_TABS.includes(tab)) tab = "images";
  const targetInner = getMenuHubInnerForTab(tab);
  if (!menuHubContent || !targetInner) return;

  menuHubImagesContentFocused = false;
  menuHubStatsContentFocused = false;
  menuHubOptionsContentFocused = false;
  menuHubActiveTab = tab;
  syncMenuHubTabButtons();

  if (statsPanel){ statsPanel.style.display = "none"; statsPanel.setAttribute("aria-hidden", "true"); statsPanel.removeAttribute("aria-modal"); }
  if (imagesPanel){ imagesPanel.style.display = "none"; imagesPanel.setAttribute("aria-hidden", "true"); }
  if (optionsMenu) optionsMenu.style.display = "none";

  rememberMenuHubOriginalParent(targetInner);

  if (menuHubActiveInner !== targetInner){
    if (menuHubActiveInner){
      const previousParent = menuHubOriginalParents.get(menuHubActiveInner);
      if (previousParent && menuHubActiveInner.parentNode !== previousParent) previousParent.appendChild(menuHubActiveInner);
    }
    menuHubContent.appendChild(targetInner);
    menuHubActiveInner = targetInner;
  }

  if (tab === "stats"){ syncNicknameStatsLabels(); renderLifetimeStats(); syncStatsSavedImagesState(); renderSavedImages(); }
  if (tab === "options"){
    markOptionsClean(false);
    if (livesSlider) livesSlider.value = START_LIVES_INFINITE ? 100 : START_LIVES;
    if (heartsSlider) heartsSlider.value = START_HEARTS_INFINITE ? 100 : START_HEARTS;
    if (shieldsSlider) shieldsSlider.value = START_SHIELDS_INFINITE ? 100 : START_SHIELDS;
    if (bombsSlider) bombsSlider.value = START_BOMBS_INFINITE ? 100 : START_BOMBS;
    if (typeof setSpeedSliderPositionFromSpeed === "function") setSpeedSliderPositionFromSpeed(START_GAME_SPEED);
    if (startWaveSelect) startWaveSelect.value = String(START_WAVE);
    if (typeof syncStartOptionsLabels === "function") syncStartOptionsLabels();
    [livesSlider, heartsSlider, shieldsSlider, bombsSlider].filter(Boolean).forEach(input => normalizeStartStatInput(input));
    if (typeof syncCheatsMenuState === "function") syncCheatsMenuState();
    if (typeof syncNicknameControl === "function") syncNicknameControl();
    if (typeof syncNicknameStatsLabels === "function") syncNicknameStatsLabels();
    if (typeof updateOptionsApplyButtonState === "function") updateOptionsApplyButtonState();
    fitMenuHubToStartMenu();
  }

  const button = getMenuHubTabButton(tab);
  const items = getMenuHubControllerTargets();
  const index = items.indexOf(button);
  if (index >= 0) menuHubFocusIndex = index;
  if (focusTab && activeInputMode === INPUT_MODE_CONTROLLER) syncMenuHubControllerFocus();
}

function resetMenuHubControllerFocus(){
  menuHubImagesContentFocused = false;
  menuHubStatsContentFocused = false;
  menuHubOptionsContentFocused = false;
  menuHubFocusIndex = 0;
  menuHubActiveTab = "images";
}

function syncMenuHubControllerFocus(){
  menuHubImagesContentFocused = false;
  menuHubStatsContentFocused = false;
  menuHubOptionsContentFocused = false;
  const items = getMenuHubControllerTargets();
  if (!items.length){ clearControllerFocus(); return; }
  menuHubFocusIndex = Math.max(0, Math.min(menuHubFocusIndex, items.length - 1));
  focusControllerElement(items[menuHubFocusIndex]);
}

function moveMenuHubControllerFocus(delta){
  menuHubImagesContentFocused = false;
  menuHubStatsContentFocused = false;
  menuHubOptionsContentFocused = false;
  const items = getMenuHubControllerTargets();
  if (!items.length) return;
  menuHubFocusIndex = (menuHubFocusIndex + delta + items.length) % items.length;
  const tab = getMenuHubTabForButton(items[menuHubFocusIndex]);
  selectMenuHubTab(tab, false);
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuHubControllerFocus();
  else clearControllerFocus();
}

function focusMenuHubImagesContentFromTab(){
  if (menuHubActiveTab !== "images") return false;
  const hubItems = getMenuHubControllerTargets();
  const currentHubTarget = hubItems[menuHubFocusIndex];
  if (currentHubTarget !== btnMenuHubImages) return false;

  const items = getImagesControllerTargets();
  if (!items.length) return false;

  menuHubImagesContentFocused = true;
  menuHubStatsContentFocused = false;
  menuHubOptionsContentFocused = false;
  imagesFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncImagesControllerFocus();
  else clearControllerFocus();
  return true;
}

function returnMenuHubImagesFocusToTab(){
  menuHubImagesContentFocused = false;
  const items = getMenuHubControllerTargets();
  const imagesIndex = items.indexOf(btnMenuHubImages);
  if (imagesIndex >= 0) menuHubFocusIndex = imagesIndex;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuHubControllerFocus();
  else clearControllerFocus();
  return true;
}

function focusMenuHubStatsContentFromTab(){
  if (menuHubActiveTab !== "stats") return false;
  const hubItems = getMenuHubControllerTargets();
  const currentHubTarget = hubItems[menuHubFocusIndex];
  if (currentHubTarget !== btnMenuHubStats) return false;

  const items = getStatsControllerTargets();
  if (!items.length) return false;

  menuHubImagesContentFocused = false;
  menuHubStatsContentFocused = true;
  menuHubOptionsContentFocused = false;
  statsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsControllerFocus();
  else clearControllerFocus();
  return true;
}

function returnMenuHubStatsFocusToTab(){
  menuHubStatsContentFocused = false;
  const items = getMenuHubControllerTargets();
  const statsIndex = items.indexOf(btnMenuHubStats);
  if (statsIndex >= 0) menuHubFocusIndex = statsIndex;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuHubControllerFocus();
  else clearControllerFocus();
  return true;
}

function focusMenuHubOptionsContentFromTab(){
  if (menuHubActiveTab !== "options") return false;
  const hubItems = getMenuHubControllerTargets();
  const currentHubTarget = hubItems[menuHubFocusIndex];
  if (currentHubTarget !== btnMenuHubOptions) return false;

  const items = getOptionsControllerTargets();
  if (!items.length) return false;

  // Enter the hosted Options menu at its first real row: Controls.
  // Do not let text inputs or checkboxes steal the first Down press from
  // the top Options tab, because apparently focus order needs a chaperone.
  const controlsIndex = items.indexOf(btnControls);
  menuHubImagesContentFocused = false;
  menuHubStatsContentFocused = false;
  menuHubOptionsContentFocused = true;
  optionsFocusIndex = controlsIndex >= 0 ? controlsIndex : 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  else clearControllerFocus();
  return true;
}

function returnMenuHubOptionsFocusToTab(){
  menuHubOptionsContentFocused = false;
  const items = getMenuHubControllerTargets();
  const optionsIndex = items.indexOf(btnMenuHubOptions);
  if (optionsIndex >= 0) menuHubFocusIndex = optionsIndex;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuHubControllerFocus();
  else clearControllerFocus();
  return true;
}

function moveMenuHubControllerFocusDirectional(direction){
  if (direction === "left") { moveMenuHubControllerFocus(-1); return true; }
  if (direction === "right") { moveMenuHubControllerFocus(1); return true; }
  if (direction === "down"){
    if (menuHubActiveTab === "images") return focusMenuHubImagesContentFromTab();
    if (menuHubActiveTab === "stats") return focusMenuHubStatsContentFromTab();
    return focusMenuHubOptionsContentFromTab();
  }
  if (direction === "up" && menuHubImagesContentFocused) return returnMenuHubImagesFocusToTab();
  if (direction === "up" && menuHubStatsContentFocused) return returnMenuHubStatsFocusToTab();
  if (direction === "up" && menuHubOptionsContentFocused) return returnMenuHubOptionsFocusToTab();
  return false;
}

function getStartMenuStartFocusIndex(){
  const items = getMenuControllerTargets();
  const startIndex = items.indexOf(btnStart);
  return startIndex >= 0 ? startIndex : 0;
}

function resetStartMenuControllerFocus(){
  menuFocusIndex = getStartMenuStartFocusIndex();
}

function isTitleHoverRevealFocused(){
  return getMenuControllerTargets()[menuFocusIndex] === titleHoverReveal;
}

function getStartingStatInputs(){
  return [heartsSlider, shieldsSlider, livesSlider, bombsSlider].filter(Boolean);
}

function getOptionsControllerTargets(){
  // Treat the four starting-stat number boxes as one vertical controller row.
  // Up/down enters/leaves the row; left/right chooses Hearts/Shields/Lives/Bombs.
  const statRowTarget = getStartingStatInputs()[startingStatFocusIndex] || getStartingStatInputs()[0];
  return [btnControls, nicknameInput, (btnNicknameAction && !btnNicknameAction.disabled ? btnNicknameAction : null), backgroundColorHex, backgroundColorPicker, muteCheckbox, fullscreenCheckbox, invertColorsCheckbox, videoFxCheckbox, getCheatsUnlockOptionTarget(), btnBack, (btnApply && btnApply.style.display !== 'none' ? btnApply : null)].filter(Boolean);
}

function getCheatsControllerTargets(){
  const skipTarget = (typeof btnSkipToLevel2 !== "undefined") ? btnSkipToLevel2 : null;
  const statRowTarget = getStartingStatInputs()[startingStatFocusIndex] || getStartingStatInputs()[0];
  return [speedSlider, startWaveSelect, statRowTarget, infiniteToggle, shootTypeSelect, skipTarget, btnCheatsBack].filter(Boolean);
}

function getControlsControllerTargets(){
  const previewButton = document.getElementById('controlsControllerPreviewButton');
  const moveButtons = getControlsMoveButtons();
  const moveTarget = moveButtons[controlsMoveFocusIndex] || moveButtons[0];
  const otherBindButtons = Array.from(document.querySelectorAll('#controlsMenu .controlsBindButton:not(.controlsMoveButton):not(.controlsPreviewButton)')).filter(button => !button.disabled);
  return [previewButton, moveTarget, ...otherBindButtons, controlsBack, controlsResetBinds, (controlsApplyBinds && controlsApplyBinds.style.display !== 'none' ? controlsApplyBinds : null)].filter(Boolean);
}

function getPauseHelpControllerTargets(){
  if (!pauseCmdSuggest || pauseCmdSuggest.style.display === "none") return [];
  return Array.from(pauseCmdSuggest.querySelectorAll("[data-cmd]"));
}

function getPauseControllerTargets(){
  const helpTargets = getPauseHelpControllerTargets();
  if (helpTargets.length) return helpTargets;
  return [btnPauseResume, (canOpenStore() ? btnPauseOpenStore : null), btnPauseOpenChat, btnPauseQuit].filter(Boolean);
}

function isPauseOptionsOpen(){
  return !!(optionsOpenedFromPause && isPaused && optionsMenu && optionsMenu.style.display === "block");
}

function isPausedGameplayMenuBackdropState(){
  return !!(
    gameState === STATE.PLAYING ||
    (
      isPaused &&
      (
        (menuHubOpenedFromPause && (gameState === STATE.HUB || gameState === STATE.CONTROLS || gameState === STATE.CHEATS)) ||
        (optionsOpenedFromPause && gameState === STATE.OPTIONS) ||
        (cheatsOpenedFromPause && gameState === STATE.CHEATS) ||
        (controlsOpenedFromPausedHubOptions && gameState === STATE.CONTROLS) ||
        (cheatsOpenedFromPausedHubOptions && gameState === STATE.CHEATS)
      )
    )
  );
}

function isCheatermodeOptionsContextOpen(){
  return gameState === STATE.OPTIONS
    || isPauseOptionsOpen()
    || (gameState === STATE.HUB && menuHubActiveTab === "options" && menuHubOptionsContentFocused);
}

function isOptionsCheatsButtonFocused(){
  const items = getOptionsControllerTargets();
  return !!(btnCheats && items[optionsFocusIndex] === btnCheats);
}

function isPauseCheatsOpen(){
  return !!(cheatsOpenedFromPause && isPaused && cheatsMenu && cheatsMenu.style.display === "block");
}

function getPauseOptionsReturnFocusIndex(){
  const items = getPauseControllerTargets();
  const index = items.indexOf(btnPauseOpenChat);
  return index >= 0 ? index : 0;
}

function getScoreStoreControllerTargets(){
  return [...Array.from(document.querySelectorAll('#scoreStoreItems .scoreStoreRow')), btnScoreStoreClose].filter(Boolean);
}

function getStatsControllerTargets(){
  const statRows = getStatsRowTargets();
  const nicknamePrompt = getStatsNicknamePromptTarget();
  const savedProfileTiles = getStatsSavedProfileTileTargets();
  const lockedSummary = getStatsLockedSummaryTarget();
  const savedImagesToggle = getStatsSavedImagesToggleTarget();
  return [
    ...statRows,
    nicknamePrompt,
    ...savedProfileTiles,
    lockedSummary,
    ...getStatsLockedRowTargets(),
    savedImagesToggle,
    ...getStatsSavedImageCardTargets(),
    getStatsSavedImagesClearTarget(),
    btnStatsClose,
    (btnStatsImport && !btnStatsImport.hidden ? btnStatsImport : null),
    (btnStatsReset && !btnStatsReset.hidden ? btnStatsReset : null)
    ,
    (btnStatsExport && !btnStatsExport.hidden ? btnStatsExport : null)
  ].filter(Boolean);
}

function isStatsNicknameInputActive(){
  return !!(statsNicknameInput && !statsNicknameInput.hidden);
}

function getStatsNicknamePromptTarget(){
  if (statsNicknameInput && !statsNicknameInput.hidden) return statsNicknameInput;
  if (!btnStatsEnterNickname || btnStatsEnterNickname.hidden) return null;
  return btnStatsEnterNickname;
}

function getStatsRowTargets(){
  const list = document.getElementById("statsList");
  if (!list || list.hidden) return [];
  return Array.from(list.querySelectorAll(".statsRow"));
}

function getStatsSavedProfileTileTargets(){
  if (!statsSavedProfilesGrid || statsSavedProfilesGrid.hidden) return [];
  return Array.from(statsSavedProfilesGrid.querySelectorAll(".statsSavedProfileTile"));
}

function getStatsLockedSummaryTarget(){
  if (!btnStatsLockedToggle || !statsLockedDetails || statsLockedDetails.hidden) return null;
  return btnStatsLockedToggle;
}

function getStatsLockedRowTargets(){
  if (!statsLockedList || statsLockedList.hidden) return [];
  return Array.from(statsLockedList.querySelectorAll(".statsSelectableRow"));
}

function getStatsSavedImagesToggleTarget(){
  if (!btnStatsSavedImagesToggle || btnStatsSavedImagesToggle.hidden) return null;
  return btnStatsSavedImagesToggle;
}

function isStatsSavedImagesExpanded(){
  return !!(btnStatsSavedImagesToggle && btnStatsSavedImagesToggle.getAttribute("aria-expanded") === "true");
}

function getStatsSavedImageCardTargets(){
  if (!statsSavedImagesList || statsSavedImagesList.hidden || !imagesList) return [];
  return Array.from(imagesList.querySelectorAll(".savedImageCard")).filter((card) => {
    if (!card) return false;
    const rect = card.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function getStatsSavedImagesClearTarget(){
  if (!statsSavedImagesList || statsSavedImagesList.hidden || !btnImagesClear || btnImagesClear.hidden) return null;
  return btnImagesClear || null;
}

function syncStatsSavedImagesState(){
  if (!btnStatsSavedImagesToggle || !statsSavedImagesList) return;
  if (btnStatsSavedImagesToggle.hidden){
    statsSavedImagesList.hidden = true;
    statsSavedImagesList.setAttribute("aria-hidden", "true");
    return;
  }
  const isOpen = btnStatsSavedImagesToggle.getAttribute("aria-expanded") === "true";
  statsSavedImagesList.hidden = !isOpen;
  statsSavedImagesList.setAttribute("aria-hidden", isOpen ? "false" : "true");
  if (isOpen) renderSavedImages();
}

function toggleStatsSavedImages(){
  if (!btnStatsSavedImagesToggle || !statsSavedImagesList || btnStatsSavedImagesToggle.hidden) return false;
  const nextOpen = btnStatsSavedImagesToggle.getAttribute("aria-expanded") !== "true";
  btnStatsSavedImagesToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  syncStatsSavedImagesState();
  focusControllerElement(btnStatsSavedImagesToggle);
  return true;
}

async function handleStatsSavedImagesButtonClick(){
  if (!btnStatsSavedImagesToggle || btnStatsSavedImagesToggle.hidden) return false;
  const currentNickname = getSavedImageProfileName();
  if (!currentNickname) return false;
  if (!savedImagesDirectoryName){
    if (!window.tektiteShooterSavedImageStorage){
      showSavedImageStatus("Folder saving is not supported in this browser.", false);
      return false;
    }
    const result = await window.tektiteShooterSavedImageStorage.chooseSavedImagesDirectory({ nickname: currentNickname });
    if (!result.ok){
      if (!result.cancelled) showSavedImageStatus(String(result.message || "Could not choose a folder for saved images."), false);
      return false;
    }
    savedImagesDirectoryName = String(result.directoryName || "").trim();
    syncSavedImagesButtonLabel(savedImagesCurrentCount, savedImagesDirectoryName);
    btnStatsSavedImagesToggle.setAttribute("aria-expanded", "true");
    await renderSavedImages();
    syncStatsSavedImagesState();
    showSavedImageStatus("Saved image folder selected.", true);
    return true;
  }
  return toggleStatsSavedImages();
}

function syncStatsLockedSummaryState(){
  if (!statsLockedDetails || !btnStatsLockedToggle || !statsLockedList) return;
  const isOpen = btnStatsLockedToggle.getAttribute("aria-expanded") === "true";
  statsLockedList.hidden = !isOpen;
}

function toggleStatsLockedSummary(){
  if (!btnStatsLockedToggle || !statsLockedDetails || statsLockedDetails.hidden) return false;
  const nextOpen = btnStatsLockedToggle.getAttribute("aria-expanded") !== "true";
  btnStatsLockedToggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  syncStatsLockedSummaryState();
  focusControllerElement(btnStatsLockedToggle);
  return true;
}

function syncStatsNicknameInputDraftState(){
  if (!statsNicknameInput) return;
  const hasDraft = !!String(statsNicknameInput.value || "").trim();
  statsNicknameInput.classList.toggle("nicknameHasDraft", hasDraft);
}

function resetStatsNicknameEntry(){
  hideNicknameSuggestionPopup();
  if (statsNicknameInput){
    statsNicknameInput.hidden = true;
    statsNicknameInput.setAttribute("aria-hidden", "true");
    statsNicknameInput.tabIndex = -1;
    statsNicknameInput.value = "";
    statsNicknameInput.classList.remove("nicknameEntryActive");
    statsNicknameInput.classList.remove("nicknameHasDraft");
  }
  if (btnStatsEnterNickname){
    const statsProfileName = getLifetimeStatsProfileName();
    btnStatsEnterNickname.textContent = statsProfileName ? `${statsProfileName}'s Stats` : "Enter Nickname to Create Profile";
    btnStatsEnterNickname.classList.toggle("statsNicknameProfileLabel", !!statsProfileName);
    btnStatsEnterNickname.hidden = false;
    btnStatsEnterNickname.setAttribute("aria-hidden", "false");
    btnStatsEnterNickname.tabIndex = 0;
  }
  renderLifetimeStats();
}

function showStatsNicknameInput(){
  if (!statsNicknameInput || !btnStatsEnterNickname || hasLifetimeStatsProfile()) return false;
  hideNicknameSuggestionPopup();
  btnStatsEnterNickname.hidden = true;
  btnStatsEnterNickname.setAttribute("aria-hidden", "true");
  btnStatsEnterNickname.tabIndex = -1;
  statsNicknameInput.hidden = false;
  statsNicknameInput.setAttribute("aria-hidden", "false");
  statsNicknameInput.tabIndex = 0;
  statsNicknameInput.value = "";
  statsNicknameInput.classList.add("nicknameEntryActive");
  statsNicknameInput.classList.remove("nicknameHasDraft");
  statsNicknameInput.readOnly = false;
  statsNicknameInput.disabled = false;
  // Keep the label on the button only. Once it becomes a real input, a centered placeholder puts the caret inside the words.
  statsNicknameInput.placeholder = "";
  renderLifetimeStats();
  const items = getStatsControllerTargets();
  const inputIndex = items.indexOf(statsNicknameInput);
  if (inputIndex >= 0) statsFocusIndex = inputIndex;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsControllerFocus();
  try{ statsNicknameInput.focus({ preventScroll:true }); }catch(_){ try{ statsNicknameInput.focus(); }catch(__){} }
  try{ statsNicknameInput.select(); }catch(_){ }
  return true;
}

function commitStatsNicknameInput(){
  if (!statsNicknameInput) return false;
  const draft = String(statsNicknameInput.value || "").trim();
  if (!draft){
    resetStatsNicknameEntry();
    return false;
  }
  applyNicknameFromControls(draft, false);
  statsNicknameInput.hidden = true;
  statsNicknameInput.setAttribute("aria-hidden", "true");
  statsNicknameInput.tabIndex = -1;
  statsNicknameInput.value = "";
  statsNicknameInput.classList.remove("nicknameEntryActive");
  statsNicknameInput.classList.remove("nicknameHasDraft");
  renderLifetimeStats();
  const items = getStatsControllerTargets();
  const closeIndex = items.indexOf(btnStatsClose);
  statsFocusIndex = closeIndex >= 0 ? closeIndex : 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsControllerFocus();
  return true;
}

function openNicknamePromptFromStats(){
  return showStatsNicknameInput();
}

function scrollElementByPixels(el, delta){
  if (!el || !delta) return false;
  const maxScroll = Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
  if (maxScroll <= 0) return false;
  const previous = el.scrollTop || 0;
  el.scrollTop = Math.max(0, Math.min(maxScroll, previous + delta));
  return el.scrollTop !== previous;
}

function scrollStatsPanelBy(delta){
  return scrollElementByPixels(statsScroll, delta);
}

function scrollOptionsPanelBy(delta){
  return scrollElementByPixels(optionsScroll, delta);
}

function scrollCheatsPanelBy(delta){
  return scrollElementByPixels(cheatsScroll, delta);
}

function scrollControlsPanelBy(delta){
  return scrollElementByPixels(controlsListScroll, delta);
}

function getWinControllerTargets(){
  if (!winPanel) return [btnContinue].filter(Boolean);
  return Array.from(winPanel.querySelectorAll(".winControllerTarget")).filter((el) => {
    if (!el || !el.isConnected) return false;
    if (el.hidden) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (el.getClientRects && el.getClientRects().length === 0) return false;
    return true;
  });
}

function syncMenuControllerFocus(){
  const items = getMenuControllerTargets();
  if (!items.length) return;
  menuFocusIndex = Math.max(0, Math.min(menuFocusIndex, items.length - 1));
  focusControllerElement(items[menuFocusIndex]);
}

function syncOptionsControllerFocus(){
  const statInputs = getStartingStatInputs();
  if (statInputs.length) startingStatFocusIndex = Math.max(0, Math.min(startingStatFocusIndex, statInputs.length - 1));
  const items = getOptionsControllerTargets();
  if (!items.length) return;
  optionsFocusIndex = Math.max(0, Math.min(optionsFocusIndex, items.length - 1));
  const target = items[optionsFocusIndex];
  focusControllerElement(target);
  if (target === btnCheats && activeInputMode === INPUT_MODE_CONTROLLER && !cheatsUnlockedByPassphrase && !cheatsUnlockTimer && !cheatsUnlockInputReady){
    renderCheatermodeControllerComboLabel(btnCheats, { remaining: Math.ceil(CHEATERMODE_CONTROLLER_HOLD_MS / 1000), xPressed: false, viewPressed: false, unlocked: false });
  }
  keepOptionsControllerTargetFullyVisible(target, { forceTop: optionsFocusIndex === 0 });
  // Keep the Cheats unlock hint synced with controller focus, including the
  // normal Start-menu -> Options path. Otherwise the X + View text only shows
  // after a click/other update cycle, because apparently one hallway was enough
  // for the old state machine.
  updateCheatsUnlockModeHint();
}

function getOptionsScrollTargetElement(el){
  if (!el) return null;
  return el.closest('.optRow, .cheatRow, .fullRow, .buttonOnlyRow') || el;
}

function keepOptionsControllerTargetFullyVisible(el, options={}){
  if (!optionsScroll || !el) return;
  const target = getOptionsScrollTargetElement(el);
  if (!target) return;

  const adjust = () => {
    if (!optionsScroll || !target.isConnected) return;
    const containerRect = optionsScroll.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const marginTop = 12;
    const marginBottom = 16;

    if (options.forceTop){
      optionsScroll.scrollTop = Math.max(0, optionsScroll.scrollTop + targetRect.top - containerRect.top - marginTop);
      return;
    }

    if (targetRect.top < containerRect.top + marginTop){
      optionsScroll.scrollTop = Math.max(0, optionsScroll.scrollTop - ((containerRect.top + marginTop) - targetRect.top));
    } else if (targetRect.bottom > containerRect.bottom - marginBottom){
      optionsScroll.scrollTop += targetRect.bottom - (containerRect.bottom - marginBottom);
    }
  };

  try{ adjust(); }catch(_){ }
  try{ requestAnimationFrame(adjust); }catch(_){ setTimeout(adjust, 0); }
}
function syncCheatsControllerFocus(forceTopVisible=false){
  const items = getCheatsControllerTargets();
  if (!items.length) return;
  cheatsFocusIndex = Math.max(0, Math.min(cheatsFocusIndex, items.length - 1));
  const target = items[cheatsFocusIndex];
  focusControllerElement(target);
  keepCheatsControllerTargetFullyVisible(target, { forceTop: !!forceTopVisible || cheatsFocusIndex === 0 });
}

function getCheatsScrollTargetElement(el){
  if (!el) return null;
  return el.closest('.optRow, .cheatRow, .fullRow, .buttonOnlyRow') || el;
}

function keepCheatsControllerTargetFullyVisible(el, options={}){
  if (!cheatsScroll || !el) return;
  const target = getCheatsScrollTargetElement(el);
  if (!target) return;

  const adjust = () => {
    if (!cheatsScroll || !target.isConnected) return;
    const containerRect = cheatsScroll.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const margin = 10;

    if (options.forceTop){
      cheatsScroll.scrollTop = Math.max(0, cheatsScroll.scrollTop + targetRect.top - containerRect.top - margin);
      return;
    }

    if (targetRect.top < containerRect.top + margin){
      cheatsScroll.scrollTop = Math.max(0, cheatsScroll.scrollTop - ((containerRect.top + margin) - targetRect.top));
    } else if (targetRect.bottom > containerRect.bottom - margin){
      cheatsScroll.scrollTop += targetRect.bottom - (containerRect.bottom - margin);
    }
  };

  try{ adjust(); }catch(_){}
  try{ requestAnimationFrame(adjust); }catch(_){ setTimeout(adjust, 0); }
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

function syncStatsControllerFocus(){
  const items = getStatsControllerTargets();
  if (!items.length) return;
  statsFocusIndex = Math.max(0, Math.min(statsFocusIndex, items.length - 1));
  focusControllerElement(items[statsFocusIndex]);
}

function syncWinControllerFocus(){
  const items = getWinControllerTargets();
  if (!items.length) return;
  winFocusIndex = Math.max(0, Math.min(winFocusIndex, items.length - 1));
  const target = items[winFocusIndex];
  focusControllerElement(target);
  keepWinControllerTargetFullyVisible(target);
}

function moveWinControllerFocus(delta){
  const items = getWinControllerTargets();
  if (!items.length) return false;
  winFocusIndex = (winFocusIndex + delta + items.length) % items.length;
  syncWinControllerFocus();
  return true;
}

function jumpWinControllerFocusToBottom(){
  const items = getWinControllerTargets();
  if (!items.length) return false;
  winFocusIndex = items.length - 1;
  syncWinControllerFocus();
  return true;
}

function getWinScrollTargetElement(el){
  if (!el) return null;
  return el.closest('#winStatsTitle, .winStatRow, .winStatBreakdownTitle, .winStatBreakdownLine, .winStatBonusTitle, .winStatBonusLine') || el;
}

function keepWinControllerTargetFullyVisible(el){
  if (!winStatsScrollArea || !el || !winStatsScrollArea.contains(el)) return;
  const target = getWinScrollTargetElement(el);
  if (!target) return;

  const adjust = () => {
    if (!winStatsScrollArea || !target.isConnected) return;
    const containerRect = winStatsScrollArea.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const marginTop = 10;
    const marginBottom = 12;

    if (targetRect.top < containerRect.top + marginTop){
      winStatsScrollArea.scrollTop = Math.max(0, winStatsScrollArea.scrollTop - ((containerRect.top + marginTop) - targetRect.top));
    } else if (targetRect.bottom > containerRect.bottom - marginBottom){
      winStatsScrollArea.scrollTop += targetRect.bottom - (containerRect.bottom - marginBottom);
    }
  };

  try{ adjust(); }catch(_){}
  try{ requestAnimationFrame(adjust); }catch(_){ setTimeout(adjust, 0); }
}

function scrollWinPanelBy(delta){
  return scrollElementByPixels(winStatsScrollArea, delta);
}

function syncWinFocusIndexFromElement(target){
  if (!target) return false;
  const items = getWinControllerTargets();
  const item = target.closest ? target.closest(".winControllerTarget") : null;
  if (!item) return false;
  const index = items.indexOf(item);
  if (index === -1) return false;
  winFocusIndex = index;
  return true;
}

function getControlsScrollTargetElement(el){
  if (!el) return null;
  return el.closest('.controlsBindRow, .controlsPreviewRow, .buttonOnlyRow') || el;
}

function keepControlsControllerTargetFullyVisible(el){
  if (!controlsListScroll || !el) return;
  const target = getControlsScrollTargetElement(el);
  if (!target) return;

  const adjust = () => {
    if (!controlsListScroll || !target.isConnected) return;
    const containerRect = controlsListScroll.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const marginTop = 12;
    const marginBottom = 18;

    if (targetRect.top < containerRect.top + marginTop){
      controlsListScroll.scrollTop = Math.max(0, controlsListScroll.scrollTop - ((containerRect.top + marginTop) - targetRect.top));
    } else if (targetRect.bottom > containerRect.bottom - marginBottom){
      controlsListScroll.scrollTop += targetRect.bottom - (containerRect.bottom - marginBottom);
    }
  };

  try{ adjust(); }catch(_){ }
  try{ requestAnimationFrame(adjust); }catch(_){ setTimeout(adjust, 0); }
}

function syncControlsControllerFocus(){
  const items = getControlsControllerTargets();
  if (!items.length) return;
  controlsFocusIndex = Math.max(0, Math.min(controlsFocusIndex, items.length - 1));
  const target = items[controlsFocusIndex];
  focusControllerElement(target);
  keepControlsControllerTargetFullyVisible(target);
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

function handleStatsControllerBackButton(){
  return routeControllerBackToButton(btnStatsClose, getStatsControllerTargets(), statsFocusIndex, (index) => { statsFocusIndex = index; }, syncStatsControllerFocus);
}

function handleImagesControllerBackButton(){
  return routeControllerBackToButton(btnImagesClose, getImagesControllerTargets(), imagesFocusIndex, (index) => { imagesFocusIndex = index; }, syncImagesControllerFocus);
}

function handleOptionsControllerBackButton(){
  return routeControllerBackToButton(btnBack, getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus);
}

function handleCheatsControllerBackButton(){
  return routeControllerBackToButton(btnCheatsBack, getCheatsControllerTargets(), cheatsFocusIndex, (index) => { cheatsFocusIndex = index; }, syncCheatsControllerFocus);
}

function handleControlsControllerBackButton(){
  return routeControllerBackToButton(controlsBack, getControlsControllerTargets(), controlsFocusIndex, (index) => { controlsFocusIndex = index; }, syncControlsControllerFocus);
}

function handleScoreStoreControllerBackButton(){
  return routeControllerBackToButton(btnScoreStoreClose, getScoreStoreControllerTargets(), scoreStoreFocusIndex, (index) => { scoreStoreFocusIndex = index; }, syncScoreStoreControllerFocus);
}

function isControlsPreviewMenuOpen(){
  return !!(controlsPreviewOpen && controlsPreviewMenu && controlsPreviewMenu.style.display !== 'none');
}

function getControlsPreviewControllerTargets(){
  return [controlsPreviewFrame, controlsPreviewBack].filter(Boolean);
}

function syncControlsPreviewControllerFocus(){
  const items = getControlsPreviewControllerTargets();
  if (!items.length) return;
  controlsPreviewFocusIndex = Math.max(0, Math.min(controlsPreviewFocusIndex, items.length - 1));
  focusControllerElement(items[controlsPreviewFocusIndex]);
}

function reclaimControlsPreviewFocus(){
  if (!controlsPreviewFrame) return;
  controlsPreviewFocusIndex = 0;
  try{ if (controlsPreviewFrame) controlsPreviewFrame.blur(); }catch(_){}
  try{ if (controlsPreviewFrame && controlsPreviewFrame.contentWindow) controlsPreviewFrame.contentWindow.blur(); }catch(_){}
  try{ window.focus(); }catch(_){}
  syncControlsPreviewControllerFocus();
  try{ requestAnimationFrame(syncControlsPreviewControllerFocus); }catch(_){}
  try{ setTimeout(syncControlsPreviewControllerFocus, 50); }catch(_){}
}

function syncControlsPreviewBackLabel(lStick=false, rStick=false){
  if (!controlsPreviewBack) return;
  const oneStickHeld = !!(lStick || rStick);
  const bothSticksHeld = !!(lStick && rStick);
  let label = 'Back';
  if (controlsPreviewControllerCaptured){
    label = 'Click and Hold Both Sticks to Escape';
    if (bothSticksHeld){
      const remainingMs = Math.max(0, 3000 - controlsPreviewStickHoldMs);
      label += ` (${Math.ceil(remainingMs / 1000)}s)`;
    }
  }
  controlsPreviewBack.textContent = label;
  controlsPreviewBack.classList.toggle('controlsPreviewEscapeIdle', controlsPreviewControllerCaptured && !oneStickHeld);
  controlsPreviewBack.classList.toggle('controlsPreviewEscapePrimed', controlsPreviewControllerCaptured && oneStickHeld && !bothSticksHeld);
  controlsPreviewBack.classList.toggle('controlsPreviewEscapeCountdown', controlsPreviewControllerCaptured && bothSticksHeld);
}

function setControlsPreviewFrameOwnership(ownsController){
  try{ window.localStorage.removeItem('tektite-controller-preview-owns'); }catch(_){}
  try{ window.sessionStorage.setItem('tektite-controller-preview-owns', ownsController ? '1' : '0'); }catch(_){}
  try{
    if (controlsPreviewFrame && controlsPreviewFrame.contentWindow){
      controlsPreviewFrame.contentWindow.postMessage({
        type: 'tektite:controller-preview-ownership',
        ownsController: !!ownsController
      }, '*');
    }
  }catch(_){}
}

function captureControlsPreviewFrame(){
  if (!controlsPreviewMenu || !controlsPreviewFrame) return;
  controlsPreviewControllerCaptured = true;
  controlsPreviewReleaseArmed = false;
  controlsPreviewStickHoldMs = 0;
  controlsPreviewFocusIndex = 0;
  syncControlsPreviewBackLabel();
  clearControllerFocus();
  setControlsPreviewFrameOwnership(true);
  try{ controlsPreviewFrame.focus(); }catch(_){}
  try{ if (controlsPreviewFrame.contentWindow) controlsPreviewFrame.contentWindow.focus(); }catch(_){}
}

function showControlsPreviewMenu(){
  if (!controlsPreviewMenu || !controlsPreviewFrame) return;
  document.body.classList.add("controls-preview-open");
  controlsPreviewOpen = true;
  controlsPreviewControllerCaptured = activeInputMode === INPUT_MODE_CONTROLLER;
  controlsPreviewReleaseArmed = false;
  controlsPreviewStickHoldMs = 0;
  controlsPreviewFocusIndex = controlsPreviewControllerCaptured ? 0 : 1;
  syncControlsPreviewBackLabel();
  if (controlsMenu){
    controlsMenu.style.setProperty("display", "none", "important");
    controlsMenu.setAttribute("aria-hidden", "true");
  }
  controlsPreviewMenu.style.setProperty("display", "flex", "important");
  controlsPreviewMenu.setAttribute("aria-hidden", "false");
  fitControlsPreviewMenuToViewport();
  if (controlsPreviewControllerCaptured){
    captureControlsPreviewFrame();
  } else if (activeInputMode === INPUT_MODE_CONTROLLER){
    syncControlsPreviewControllerFocus();
  } else {
    clearControllerFocus();
  }
}

function releaseControlsPreviewControllerCapture(){
  controlsPreviewControllerCaptured = false;
  controlsPreviewReleaseArmed = false;
  controlsPreviewStickHoldMs = 0;
  controlsPreviewFocusIndex = 0;
  syncControlsPreviewBackLabel();
  setControlsPreviewFrameOwnership(false);
  if (activeInputMode === INPUT_MODE_CONTROLLER) reclaimControlsPreviewFocus();
  else clearControllerFocus();
}

function hideControlsPreviewMenu(options = null){
  if (!controlsPreviewMenu) return;
  document.body.classList.remove("controls-preview-open");
  const restoreControlsMenu = !(options && options.restoreControlsMenu === false);
  controlsPreviewOpen = false;
  controlsPreviewControllerCaptured = false;
  controlsPreviewReleaseArmed = false;
  controlsPreviewStickHoldMs = 0;
  controlsPreviewFocusIndex = 1;
  syncControlsPreviewBackLabel();
  setControlsPreviewFrameOwnership(false);
  controlsPreviewMenu.style.setProperty("display", "none", "important");
  controlsPreviewMenu.setAttribute("aria-hidden", "true");
  if (restoreControlsMenu && controlsMenu && (gameState === STATE.CONTROLS || pauseControlsOpen)){
    controlsMenu.style.removeProperty("display");
    controlsMenu.style.display = "block";
    controlsMenu.setAttribute("aria-hidden", "false");
    const previewButton = document.getElementById('controlsControllerPreviewButton');
    const items = getControlsControllerTargets();
    const previewIndex = items.indexOf(previewButton);
    if (previewIndex !== -1) controlsFocusIndex = previewIndex;
    if (activeInputMode === INPUT_MODE_CONTROLLER) syncControlsControllerFocus();
    else clearControllerFocus();
    fitControlsMenuToViewport();
  } else {
    clearControllerFocus();
  }
}

function updateControlsPreviewControllerTakeover(dt, lStick, rStick, pressMenuSelect, pressMenuBack, pressPause, navUp=false, navDown=false){
  if (!isControlsPreviewMenuOpen()) return false;
  if (controlsPreviewControllerCaptured){
    const bothStickButtonsHeld = !!(lStick && rStick);
    if (controlsPreviewReleaseArmed){
      if (!bothStickButtonsHeld) releaseControlsPreviewControllerCapture();
      else syncControlsPreviewBackLabel(lStick, rStick);
    } else if (bothStickButtonsHeld){
      controlsPreviewStickHoldMs += Math.max(0, dt || 0) * 1000;
      if (controlsPreviewStickHoldMs >= 3000) releaseControlsPreviewControllerCapture();
      else syncControlsPreviewBackLabel(lStick, rStick);
    } else {
      controlsPreviewStickHoldMs = 0;
      syncControlsPreviewBackLabel(lStick, rStick);
    }
    return true;
  }
  if (navUp || navDown){
    controlsPreviewFocusIndex = navUp ? 0 : 1;
    syncControlsPreviewControllerFocus();
  }
  if (pressMenuSelect){
    const target = getControlsPreviewControllerTargets()[controlsPreviewFocusIndex];
    if (target === controlsPreviewFrame) captureControlsPreviewFrame();
    else hideControlsPreviewMenu();
  } else if (pressMenuBack || pressPause) {
    hideControlsPreviewMenu();
  } else {
    syncControlsPreviewControllerFocus();
  }
  return true;
}

function syncControllerFocusForCurrentState(){
  if (activeInputMode !== INPUT_MODE_CONTROLLER || parentChatVisible){
    clearControllerFocus();
    return;
  }
  if (isControlsPreviewMenuOpen()){
    if (!controlsPreviewControllerCaptured) syncControlsPreviewControllerFocus();
    else clearControllerFocus();
    return;
  }
  if (isStatsPanelOpen()){
    syncStatsControllerFocus();
    return;
  }
  if (isImagesPanelOpen()){
    syncImagesControllerFocus();
    return;
  }
  if (isPauseOptionsOpen()){
    syncOptionsControllerFocus();
    return;
  }
  if (isScoreStoreOpen && isPaused){
    syncScoreStoreControllerFocus();
    return;
  }
  if (pauseControlsOpen && isPaused){
    syncControlsControllerFocus();
    return;
  }
  if (gameState === STATE.HUB){
    if (menuHubImagesContentFocused){ syncImagesControllerFocus(); return; }
    if (menuHubStatsContentFocused){ syncStatsControllerFocus(); return; }
    if (menuHubOptionsContentFocused){ syncOptionsControllerFocus(); return; }
    syncMenuHubControllerFocus();
    return;
  }
  if (isPaused){
    syncPauseControllerFocus();
    return;
  }
  if (gameState === STATE.MENU){
    syncMenuControllerFocus();
    return;
  }
  if (gameState === STATE.OPTIONS){
    syncOptionsControllerFocus();
    return;
  }
  if (gameState === STATE.CHEATS){
    syncCheatsControllerFocus();
    return;
  }
  if (gameState === STATE.CONTROLS){
    syncControlsControllerFocus();
    return;
  }
  if (gameState === STATE.WIN){
    syncWinControllerFocus();
    return;
  }
  clearControllerFocus();
}

function moveMenuControllerFocus(delta){
  const items = getMenuControllerTargets();
  if (!items.length) return;
  menuFocusIndex = (menuFocusIndex + delta + items.length) % items.length;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
}

function moveMenuControllerFocusDirectional(direction){
  const items = getMenuControllerTargets();
  if (!items.length) return false;
  const titleIndex = items.indexOf(startMenuTitle);
  const revealIndex = items.indexOf(titleHoverReveal);
  const startIndex = items.indexOf(btnStart);
  const menuIndex = items.indexOf(btnMenu);
  const nicknameTarget = getStartNicknameMenuTarget();
  const nicknameIndex = items.indexOf(nicknameTarget);
  let nextIndex = menuFocusIndex;

  if (direction === "left"){
    if (menuFocusIndex === menuIndex && startIndex !== -1) nextIndex = startIndex;
  } else if (direction === "right"){
    if (menuFocusIndex === startIndex && menuIndex !== -1) nextIndex = menuIndex;
  } else if (direction === "down"){
    if ((menuFocusIndex === startIndex || menuFocusIndex === menuIndex) && nicknameIndex !== -1) nextIndex = nicknameIndex;
    else if (menuFocusIndex === revealIndex && startIndex !== -1) nextIndex = startIndex;
  } else if (direction === "up"){
    if ((menuFocusIndex === startIndex || menuFocusIndex === menuIndex) && revealIndex !== -1) nextIndex = revealIndex;
    else if (menuFocusIndex === nicknameIndex && startIndex !== -1) nextIndex = startIndex;
  }

  if (nextIndex === menuFocusIndex || nextIndex < 0 || nextIndex >= items.length) return false;
  menuFocusIndex = nextIndex;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
  return true;
}

function moveOptionsControllerFocus(delta){
  const previous = getOptionsControllerTargets()[optionsFocusIndex];
  const items = getOptionsControllerTargets();
  if (!items.length) return;
  optionsFocusIndex = (optionsFocusIndex + delta + items.length) % items.length;
  const next = getOptionsControllerTargets()[optionsFocusIndex];
  const statInputs = getStartingStatInputs();
  if (statInputs.includes(next) && !statInputs.includes(previous)){
    startingStatFocusIndex = 0; // Entering the stat row lands on Hearts. Humanity survives.
  }
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  else clearControllerFocus();
}

function moveCheatsControllerFocus(delta){
  const items = getCheatsControllerTargets();
  if (!items.length) return;
  const previousIndex = cheatsFocusIndex;
  cheatsFocusIndex = (cheatsFocusIndex + delta + items.length) % items.length;
  const wrappedToTop = delta > 0 && cheatsFocusIndex < previousIndex;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncCheatsControllerFocus(wrappedToTop);
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

function moveStatsControllerFocus(delta){
  const items = getStatsControllerTargets();
  if (!items.length) return;
  statsFocusIndex = (statsFocusIndex + delta + items.length) % items.length;
  syncStatsControllerFocus();
}

function moveStatsControllerFocusDirectional(direction){
  const items = getStatsControllerTargets();
  if (!items.length) return false;
  statsFocusIndex = Math.max(0, Math.min(statsFocusIndex, items.length - 1));
  const current = items[statsFocusIndex];
  const savedProfileTiles = getStatsSavedProfileTileTargets();
  const bottomButtons = [btnStatsClose, btnStatsImport, btnStatsReset, btnStatsExport].filter((button) => button && items.includes(button));
  let nextIndex = statsFocusIndex;

  const savedProfileTileIndex = savedProfileTiles.indexOf(current);
  if (savedProfileTileIndex !== -1){
    const tileCount = savedProfileTiles.length;
    if (direction === "left"){
      if (savedProfileTileIndex > 0) nextIndex = items.indexOf(savedProfileTiles[savedProfileTileIndex - 1]);
      else return false;
    } else if (direction === "right"){
      if (savedProfileTileIndex + 1 < tileCount) nextIndex = items.indexOf(savedProfileTiles[savedProfileTileIndex + 1]);
      else return false;
    } else if (direction === "up"){
      if (savedProfileTileIndex - SAVED_PROFILE_TILE_COLUMNS >= 0){
        nextIndex = items.indexOf(savedProfileTiles[savedProfileTileIndex - SAVED_PROFILE_TILE_COLUMNS]);
      } else {
        const nicknamePrompt = getStatsNicknamePromptTarget();
        nextIndex = nicknamePrompt ? items.indexOf(nicknamePrompt) : statsFocusIndex;
      }
    } else if (direction === "down"){
      if (savedProfileTileIndex + SAVED_PROFILE_TILE_COLUMNS < tileCount){
        nextIndex = items.indexOf(savedProfileTiles[savedProfileTileIndex + SAVED_PROFILE_TILE_COLUMNS]);
      } else {
        const afterTilesIndex = savedProfileTiles.length ? items.indexOf(savedProfileTiles[savedProfileTiles.length - 1]) + 1 : -1;
        nextIndex = afterTilesIndex >= 0 && afterTilesIndex < items.length ? afterTilesIndex : statsFocusIndex;
      }
    }
    if (nextIndex === statsFocusIndex || nextIndex < 0 || nextIndex >= items.length) return false;
    statsFocusIndex = nextIndex;
    syncStatsControllerFocus();
    return true;
  }

  if (direction === "up"){
    nextIndex = (statsFocusIndex - 1 + items.length) % items.length;
  } else if (direction === "down"){
    nextIndex = (statsFocusIndex + 1 + items.length) % items.length;
  } else if (direction === "left"){
    const bottomIndex = bottomButtons.indexOf(current);
    if (bottomIndex !== -1){
      const prevButton = bottomButtons[(bottomIndex - 1 + bottomButtons.length) % bottomButtons.length];
      nextIndex = items.indexOf(prevButton);
    } else nextIndex = (statsFocusIndex - 1 + items.length) % items.length;
  } else if (direction === "right"){
    const bottomIndex = bottomButtons.indexOf(current);
    if (bottomIndex !== -1){
      const nextButton = bottomButtons[(bottomIndex + 1) % bottomButtons.length];
      nextIndex = items.indexOf(nextButton);
    } else nextIndex = (statsFocusIndex + 1 + items.length) % items.length;
  }

  if (nextIndex === statsFocusIndex || nextIndex < 0 || nextIndex >= items.length) return false;
  statsFocusIndex = nextIndex;
  syncStatsControllerFocus();
  return true;
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
}

function moveStartingStatFocus(delta){
  const statInputs = getStartingStatInputs();
  if (!statInputs.length) return false;
  startingStatFocusIndex = Math.max(0, Math.min(statInputs.length - 1, startingStatFocusIndex + delta));
  if (gameState === STATE.CHEATS) syncCheatsControllerFocus();
  else syncOptionsControllerFocus();
  return true;
}

function isStartingStatFocused(){
  const statInputs = getStartingStatInputs();
  return statInputs.includes(getCheatsControllerTargets()[cheatsFocusIndex]);
}

function isOptionsBottomButtonFocused(){
  const items = getOptionsControllerTargets();
  const current = items[optionsFocusIndex];
  return current === btnBack || current === btnApply;
}

function moveOptionsBottomButtonsHorizontally(delta){
  const items = getOptionsControllerTargets();
  const current = items[optionsFocusIndex];
  if (current !== btnBack && current !== btnApply) return false;
  if (delta < 0 && current === btnApply && btnBack){
    optionsFocusIndex = Math.max(0, items.indexOf(btnBack));
  } else if (delta > 0 && current === btnBack && btnApply){
    optionsFocusIndex = Math.max(0, items.indexOf(btnApply));
  } else {
    return false;
  }
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  else clearControllerFocus();
  return true;
}

function wrapOptionsBottomButtonsToTop(){
  if (!isOptionsBottomButtonFocused()) return false;
  optionsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  else clearControllerFocus();
  return true;
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

function stepNumberInput(inputEl, delta){
  if (!inputEl) return false;
  const step = parseInt(inputEl.step || '1', 10) || 1;
  const min = parseInt(inputEl.min || '0', 10);
  const max = parseInt(inputEl.max || '999', 10);
  const raw = String(inputEl.value || '').trim().toLowerCase();
  const isInfinite = raw === 'infinite' || raw === 'inf' || raw === '∞';
  const current = isInfinite ? max : parseInt(raw || '0', 10);
  const safeCurrent = Number.isFinite(current) ? current : min;
  const next = Math.max(min, Math.min(max, safeCurrent + (step * delta)));
  if (next === safeCurrent) return false;
  inputEl.value = String(next >= 100 ? 100 : next);
  inputEl.dispatchEvent(new Event('input', { bubbles:true }));
  inputEl.dispatchEvent(new Event('change', { bubbles:true }));
  focusControllerElement(inputEl);
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

function stepNumberInput(inputEl, delta){
  if (!inputEl) return false;
  const step = parseInt(inputEl.step || '1', 10) || 1;
  const min = parseInt(inputEl.min || '0', 10);
  const max = parseInt(inputEl.max || '999', 10);
  const raw = String(inputEl.value || '').trim().toLowerCase();
  const isInfinite = raw === 'infinite' || raw === 'inf' || raw === '\u221e';
  const current = isInfinite ? max : parseInt(raw || '0', 10);
  const safeCurrent = Number.isFinite(current) ? current : min;
  const next = Math.max(min, Math.min(max, safeCurrent + (step * delta)));
  if (next === safeCurrent) return false;
  inputEl.value = next >= 100 ? "\u221e" : String(next);
  inputEl.dispatchEvent(new Event('input', { bubbles:true }));
  inputEl.dispatchEvent(new Event('change', { bubbles:true }));
  focusControllerElement(inputEl);
  return true;
}

function activateControllerTarget(el){
  if (!el) return;
  playUiActivateSoundFor(el, 'controller');
  if (el === startMenuTitle){
    toggleStartMenuTitleMute();
    return true;
  }
  if (el.classList && el.classList.contains('scoreStoreRow')){
    const action = el.querySelector('.scoreStoreAction');
    if (action && typeof action.click === 'function') action.click();
    return true;
  }
  if (el.tagName === "A"){
    el.click();
    return true;
  }
  if (el.dataset && el.dataset.cmd){
    const command = (typeof getPauseHelpCommandFromNode === "function")
      ? getPauseHelpCommandFromNode(el)
      : (el.dataset.cmd || "");
    if (command) execPauseCommand(command);
    return true;
  }
  if (el.dataset && el.dataset.action && el.dataset.scheme){
    startBindingEdit(el.dataset.scheme, el.dataset.action);
    return;
  }
  if (el === btnControls){
    showControlsMenu({ fromHubOptions: isHubOptionsControlsLaunchContext() });
    return;
  }
  if (el === nicknameInput || el === startNicknameInput || el === statsNicknameInput){
    el.focus();
    focusControllerElement(el);
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
  if (isStartingStatInputEl(el)){
    el.focus();
    focusControllerElement(el);
    return;
  }
  if (typeof el.click === 'function') el.click();
}

function stepColorInput(inputEl, delta){
  if (!inputEl) return false;
  const current = normalizeHexColor(inputEl.value || starfieldBgOverride || "#000000") || "#000000";
  const n = parseInt(current.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const step = delta > 0 ? 16 : -16;
  r = Math.max(0, Math.min(255, r + step));
  g = Math.max(0, Math.min(255, g + step));
  b = Math.max(0, Math.min(255, b + step));
  const next = "#" + [r,g,b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  applyBackgroundColorFromControls(next);
  return true;
}

function adjustControllerOption(delta){
  const items = getOptionsControllerTargets();
  const el = items[optionsFocusIndex];
  if (!el) return false;
  if (el.tagName === 'SELECT') return cycleSelect(el, delta);
  if (el.type === 'range') return stepRange(el, delta);
  if (el === backgroundColorPicker) return stepColorInput(el, delta);
  if (el === backgroundColorHex || el === nicknameInput) return false;
  if (isStartingStatInputEl(el)) return stepNumberInput(el, delta);
  if (el.type === 'checkbox'){
    el.checked = delta > 0;
    el.dispatchEvent(new Event('change', { bubbles:true }));
    focusControllerElement(el);
    return true;
  }
  return false;
}

function adjustControllerCheat(delta){
  const items = getCheatsControllerTargets();
  const el = items[cheatsFocusIndex];
  if (!el) return false;
  if (el.tagName === 'SELECT') return cycleSelect(el, delta);
  if (isStartingStatInputEl(el)) return stepNumberInput(el, delta);
  if (el.type === 'checkbox'){
    el.checked = delta > 0;
    el.dispatchEvent(new Event('change', { bubbles:true }));
    focusControllerElement(el);
    return true;
  }
  return false;
}
function showMenu(){
  menuHubOpenedFromPause = false;
  setControlsStandaloneMenuOpen(false);
  setPaused(false);
  playerSpectatorMode = false;
  try{ document.body.classList.remove("zeroLivesSpectatorMode"); }catch(e){}
  deathYellPlayed = false;
  gameState = STATE.MENU;
  syncStartMenuHudLayerMode();
  if (audioUnlocked && !audioMuted) ensureMenuMusicPlaying();
  gameWon = false;
  // v1.96: drop shield when entering menus
  mouseShieldHolding = false;
  stopShield(false);

  deathOverlay.style.display = "none";
  clearDeathControllerFocus();
  if (winOverlay) winOverlay.style.display = "none";
  stopWinStatsMarquee({ resetScroll:true });

  document.body.classList.remove("menu-hub-open");
  if (startMenu){
    startMenu.style.setProperty("display", "block");
    startMenu.setAttribute("aria-hidden", "false");
    setStartMenuInteractive(true);
  }
  if (menuHubPanel){ menuHubPanel.style.display = "none"; menuHubPanel.setAttribute("aria-hidden", "true"); }
  rememberStartMenuPanelRect();
  optionsMenu.style.display = "none";
  if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode"); }
  hideControlsPreviewMenu({ restoreControlsMenu: false });
  if (cheatsMenu) cheatsMenu.style.display = "none";
  if (statsPanel){ statsPanel.style.display = "none"; statsPanel.setAttribute("aria-hidden", "true"); statsPanel.removeAttribute("aria-modal"); }
  if (imagesPanel){ imagesPanel.style.display = "none"; imagesPanel.setAttribute("aria-hidden", "true"); }
  resetCheatsUnlockGate();
  pauseControlsOpen = false;
  if (pauseOverlay) pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  uiRoot.classList.remove("optionsBackdrop");
  uiRoot.style.display = "flex";
  resetStartMenuControllerFocus();
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
  rememberStartMenuPanelRect();
  setupStartMenuEnemyPreview();
  renderMenuHudPreview();
  syncSpeedZeroStaticImages();
  syncNicknameStatsLabels();
  renderLifetimeStats();
  fitStatsPanelToStartMenu();
  fitImagesPanelToStartMenu();
  renderSavedImages();
}

function openMenuHub(options = null){
  setControlsStandaloneMenuOpen(false);
  if (!menuHubPanel) return;
  const keepGameplayPaused = !!(options && options.keepGameplayPaused);
  menuHubOpenedFromPause = !!(options && options.fromPause);
  if (!keepGameplayPaused) setPaused(false);
  else {
    isPaused = true;
    if (pauseOverlay) pauseOverlay.style.display = "none";
  }
  unlockAudioOnce();
  gameState = STATE.HUB;
  syncStartMenuHudLayerMode();
  if (!audioMuted && !menuHubOpenedFromPause) ensureMenuMusicPlaying();
  mouseShieldHolding = false;
  stopShield(false);
  // v2.XX: make the hub replace the Start Menu instead of sitting beside it.
  // Capture the Start Menu footprint first, then hide the Start Menu with
  // priority because later CSS overrides were winning the dumb little war.
  if (startMenu && startMenu.style.display !== "none") rememberStartMenuPanelRect();
  else getFallbackMenuRect();
  document.body.classList.add("menu-hub-open");
  if (startMenu){
    startMenu.style.setProperty("display", "none", "important");
    startMenu.setAttribute("aria-hidden", "true");
    setStartMenuInteractive(false);
  }
  if (optionsMenu) optionsMenu.style.display = "none";
  if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode"); }
  if (cheatsMenu) cheatsMenu.style.display = "none";
  if (statsPanel){ statsPanel.style.display = "none"; statsPanel.setAttribute("aria-hidden", "true"); statsPanel.removeAttribute("aria-modal"); }
  if (imagesPanel){ imagesPanel.style.display = "none"; imagesPanel.setAttribute("aria-hidden", "true"); }
  menuHubPanel.style.display = "flex";
  menuHubPanel.setAttribute("aria-hidden", "false");
  uiRoot.classList.add("optionsBackdrop");
  uiRoot.style.display = "flex";
  fitMenuHubToStartMenu();
  requestAnimationFrame(fitMenuHubToStartMenu);
  resetMenuHubControllerFocus();
  selectMenuHubTab("images", false);
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuHubControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
  updateHearts();
}
function closeMenuHub(){
  const returnToPause = !!(menuHubOpenedFromPause && isPaused);
  menuHubOpenedFromPause = false;
  restoreMenuHubActiveInner();
  if (menuHubPanel){
    menuHubPanel.style.display = "none";
    menuHubPanel.setAttribute("aria-hidden", "true");
    menuHubPanel.classList.remove("menuHubTabImages", "menuHubTabStats", "menuHubTabOptions");
  }
  uiRoot.classList.remove("optionsBackdrop");
  document.body.classList.remove("menu-hub-open");

  if (returnToPause){
    // Hub Back from Pause should restore the Pause menu, not dump the player at Start.
    if (startMenu){
      startMenu.style.setProperty("display", "none", "important");
      startMenu.setAttribute("aria-hidden", "true");
      setStartMenuInteractive(false);
    }
    if (optionsMenu) optionsMenu.style.display = "none";
    if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode", "hubOptionsControlsMode"); }
    if (cheatsMenu) cheatsMenu.style.display = "none";
    if (statsPanel){ statsPanel.style.display = "none"; statsPanel.setAttribute("aria-hidden", "true"); statsPanel.removeAttribute("aria-modal"); }
    if (imagesPanel){ imagesPanel.style.display = "none"; imagesPanel.setAttribute("aria-hidden", "true"); }
    gameState = STATE.PLAYING;
    syncStartMenuHudLayerMode();
    if (pauseOverlay){
      pauseOverlay.classList.remove("pauseControlsVisible", "scoreStoreVisible");
      pauseOverlay.style.display = "flex";
    }
    uiRoot.style.display = "none";
    pauseControlsOpen = false;
    optionsOpenedFromPause = false;
    cheatsOpenedFromPause = false;
    pauseFocusIndex = getPauseOptionsReturnFocusIndex();
    syncPauseTitleNickname();
    if (activeInputMode === INPUT_MODE_CONTROLLER) syncPauseControllerFocus();
    else clearControllerFocus();
    renderMenuHudPreview();
    return;
  }

  gameState = STATE.MENU;
  syncStartMenuHudLayerMode();
  if (audioUnlocked && !audioMuted) ensureMenuMusicPlaying();
  if (startMenu){
    startMenu.style.setProperty("display", "block");
    startMenu.setAttribute("aria-hidden", "false");
    setStartMenuInteractive(true);
  }
  resetStartMenuControllerFocus();
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
}


function isMenuHubHostingElement(el){
  return !!(menuHubPanel && el && menuHubPanel.contains(el));
}

function closeMenuHubHostedPanelToStart(el){
  if (!isMenuHubHostingElement(el)) return false;
  closeMenuHub();
  return true;
}

function openImagesPanelFromHub(){
  if (menuHubPanel){ menuHubPanel.style.display = "none"; menuHubPanel.setAttribute("aria-hidden", "true"); }
  openImagesPanel();
}

function openStatsPanelFromHub(){
  if (menuHubPanel){ menuHubPanel.style.display = "none"; menuHubPanel.setAttribute("aria-hidden", "true"); }
  openStatsPanel();
}

function openOptionsFromHub(){
  if (menuHubPanel){ menuHubPanel.style.display = "none"; menuHubPanel.setAttribute("aria-hidden", "true"); }
  showOptions(false);
}

function isHubOptionsControlsLaunchContext(){
  if (!btnControls) return false;
  const hubVisible = !!(menuHubPanel && menuHubPanel.style.display !== "none" && menuHubPanel.getAttribute("aria-hidden") !== "true");
  const buttonInsideHub = !!(menuHubPanel && menuHubPanel.contains(btnControls));
  const optionsInner = document.getElementById("optionsMenuInner");
  const optionsInnerInsideHub = !!(menuHubContent && optionsInner && menuHubContent.contains(optionsInner));
  return !!(hubVisible && (menuHubActiveTab === "options" || buttonInsideHub || optionsInnerInsideHub));
}

function shouldForceHubOptionsControlsMode(options = null){
  if (options && options.fromHubOptions === true) return true;
  if (options && options.fromHubOptions === false) return false;
  return isHubOptionsControlsLaunchContext();
}

function setControlsStandaloneMenuOpen(isOpen, options = null){
  const fromHubOptions = !!(options && options.fromHubOptions);
  document.body.classList.toggle("controls-menu-open", !!isOpen);
  document.body.classList.toggle("controls-hub-options-mode", !!(isOpen && fromHubOptions));
  if (controlsMenu) controlsMenu.classList.toggle("hubOptionsControlsMode", !!(isOpen && fromHubOptions));
  if (!isOpen){
    document.body.classList.remove("controls-preview-open");
    return;
  }
  if (startMenu){
    startMenu.style.setProperty("display", "none", "important");
    startMenu.setAttribute("aria-hidden", "true");
    setStartMenuInteractive(false);
  }
  if (menuHubPanel){
    menuHubPanel.style.setProperty("display", "none", "important");
    menuHubPanel.setAttribute("aria-hidden", "true");
  }
  if (optionsMenu){
    optionsMenu.style.setProperty("display", "none", "important");
    optionsMenu.setAttribute("aria-hidden", "true");
  }
  if (cheatsMenu){ cheatsMenu.style.setProperty("display", "none", "important"); }
  if (statsPanel){
    statsPanel.style.setProperty("display", "none", "important");
    statsPanel.setAttribute("aria-hidden", "true");
    statsPanel.removeAttribute("aria-modal");
  }
  if (imagesPanel){
    imagesPanel.style.setProperty("display", "none", "important");
    imagesPanel.setAttribute("aria-hidden", "true");
  }
}

function showControlsMenu(options = null){
  if (!controlsMenu) return;
  hideControlsPreviewMenu({ restoreControlsMenu: false });
  const fromHubOptions = shouldForceHubOptionsControlsMode(options);
  const openingFromPausedHubOptions = !!(fromHubOptions && menuHubOpenedFromPause && isPaused);
  const fromOptions = (optionsMenu && optionsMenu.style.display !== "none") || fromHubOptions;
  const fromMenu = startMenu && startMenu.style.display !== "none";
  if (!fromOptions && !fromMenu && !pauseControlsOpen) return;

  if (fromMenu || fromHubOptions) rememberStartMenuPanelRect();
  else getFallbackMenuRect();

  controlsReturnState = fromHubOptions ? STATE.HUB : (fromOptions ? STATE.OPTIONS : STATE.MENU);
  controlsOpenedFromPausedHubOptions = openingFromPausedHubOptions;
  setControlsStandaloneMenuOpen(true, { fromHubOptions });
  if (fromHubOptions){
    restoreMenuHubActiveInner();
  }

  if (openingFromPausedHubOptions){
    isPaused = true;
    if (pauseOverlay) pauseOverlay.style.display = "none";
  } else {
    setPaused(false);
  }
  pauseControlsOpen = false;
  pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  uiRoot.classList.remove("optionsBackdrop");
  gameState = STATE.CONTROLS;
  syncStartMenuHudLayerMode();
  if (!openingFromPausedHubOptions){
    unlockAudioOnce();
    if (!audioMuted) ensureMenuMusicPlaying();
  }
  resetDraftBindingsFromActive();
  markControlsClean(false);
  lockControlsInputMode(activeInputMode);
  setControlsBindMode(activeInputMode);
  if (startMenu) startMenu.style.setProperty("display", "none", "important");
  if (optionsMenu) optionsMenu.style.setProperty("display", "none", "important");
  if (cheatsMenu) cheatsMenu.style.setProperty("display", "none", "important");
  controlsMenu.style.removeProperty("display");
  controlsMenu.style.display = "flex";
  controlsMenu.setAttribute("aria-hidden", "false");
  controlsMenu.classList.remove("pauseControlsMode");
  controlsMenu.classList.add("shooter-menu16x9Surface");
  controlsMenu.classList.toggle("hubOptionsControlsMode", !!fromHubOptions);
  uiRoot.style.display = "flex";
  updateControlsDisplay();
  renderControlsBindingList();
  fitControlsMenuToViewport();
  controlsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncControlsControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
  updateHearts();
}
function hideControlsMenu(){
  if (!controlsMenu) return;
  hideControlsPreviewMenu({ restoreControlsMenu: false });
  setControlsStandaloneMenuOpen(false);
  resetDraftBindingsFromActive();
  controlsMenu.style.display = "none";
  controlsMenu.classList.remove("pauseControlsMode");
  unlockControlsInputMode();
  cancelBindingEdit();
  if (pauseControlsOpen && isPaused){
    hidePauseControlsMenu();
    return;
  }
  if (controlsReturnState === STATE.OPTIONS){
    showOptions();
    return;
  }
  if (controlsReturnState === STATE.HUB){
    const returnToPausedHubOptions = !!(controlsOpenedFromPausedHubOptions && isPaused);
    controlsOpenedFromPausedHubOptions = false;
    openMenuHub(returnToPausedHubOptions ? { keepGameplayPaused:true, fromPause:true } : null);
    selectMenuHubTab("options", activeInputMode === INPUT_MODE_CONTROLLER);
    return;
  }
  controlsOpenedFromPausedHubOptions = false;
  showMenu();
}

function showWinOverlay(){
  commitRunLifetimeStats({ won:true });
  gameWon = true;
  gameState = STATE.WIN;
  syncStartMenuHudLayerMode();
  if (winOverlay) winOverlay.style.display = "flex";
  if (pauseOverlay) pauseOverlay.style.display = "none";
  refreshWinStats();
  livesSlot.style.display = "none";
  powerupSlot.style.display = "none";
  if (timerHud) timerHud.style.display = "none";
  { const heartsHud = getHeartsHudEl(); if (heartsHud) heartsHud.style.display = "none"; }
  stopMusic();
  if (winPanel) winPanel.scrollTop = 0;
  if (winStatsScrollArea) winStatsScrollArea.scrollTop = 0;
  queueWinStatsMarqueeSync();
  winFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncWinControllerFocus();
  else clearControllerFocus();
}

if (winOverlay){
  winOverlay.addEventListener("pointermove", (e) => {
    if (gameState !== STATE.WIN) return;
    setActiveInputMode(INPUT_MODE_KEYBOARD);
    syncWinFocusIndexFromElement(e.target);
  });

  winOverlay.addEventListener("pointerdown", (e) => {
    if (gameState !== STATE.WIN) return;
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
    syncWinFocusIndexFromElement(e.target);
  });

  winOverlay.addEventListener("wheel", (e) => {
    if (gameState !== STATE.WIN) return;
    setActiveInputMode(INPUT_MODE_KEYBOARD);
  }, { passive:true });

  winOverlay.addEventListener("focusin", (e) => {
    if (gameState !== STATE.WIN) return;
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
    syncWinFocusIndexFromElement(e.target);
  });
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
    showMenu();
}

function armDeathQuitConfirmCountdown(){
  deathQuitConfirmArmed = true;
  deathQuitConfirmReady = false;
  deathQuitConfirmRemaining = 5;
  if (deathQuitConfirmTimer){
    clearInterval(deathQuitConfirmTimer);
    deathQuitConfirmTimer = null;
  }
  if (btnDeathQuitToMenu) btnDeathQuitToMenu.textContent = "Really, Quit? (5s)";
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
function showCheats(){
  const optionsInner = document.getElementById("optionsMenuInner");
  const hubOptionsInnerMounted = !!(menuHubContent && optionsInner && menuHubContent.contains(optionsInner));
  const cheatsButtonHostedInHub = !!(menuHubPanel && btnCheats && menuHubPanel.contains(btnCheats));
  const hubOptionsTabActive = menuHubActiveTab === "options";
  const openingFromHubOptions = !!(
    hubOptionsTabActive &&
    (hubOptionsInnerMounted || cheatsButtonHostedInHub || gameState === STATE.HUB)
  );
  const openingFromPauseOptions = !!(optionsOpenedFromPause && isPaused && optionsMenu && optionsMenu.style.display === "block");
  const openingFromPausedHubOptions = !!(openingFromHubOptions && menuHubOpenedFromPause && isPaused);
  cheatsOpenedFromPause = openingFromPauseOptions;
  cheatsOpenedFromHubOptions = openingFromHubOptions;
  cheatsOpenedFromPausedHubOptions = openingFromPausedHubOptions;
  if (startMenu && startMenu.style.display !== "none") rememberStartMenuPanelRect();
  else getFallbackMenuRect();
  if (openingFromPauseOptions || openingFromPausedHubOptions){
    isPaused = true;
    if (pauseOverlay) pauseOverlay.style.display = "none";
  } else {
    setPaused(false);
  }
  gameState = STATE.CHEATS;
  syncStartMenuHudLayerMode();
  if (!openingFromPauseOptions && !openingFromPausedHubOptions){
    unlockAudioOnce();
    if (!audioMuted) ensureMenuMusicPlaying();
  }
  if (startWaveSelect) startWaveSelect.value = String(START_WAVE);
  livesSlider.value = START_LIVES_INFINITE ? 100 : START_LIVES;
  heartsSlider.value = START_HEARTS_INFINITE ? 100 : START_HEARTS;
  shieldsSlider.value = START_SHIELDS_INFINITE ? 100 : START_SHIELDS;
  bombsSlider.value = START_BOMBS_INFINITE ? 100 : START_BOMBS;
  normalizeStartStatInput(livesSlider);
  normalizeStartStatInput(heartsSlider);
  normalizeStartStatInput(shieldsSlider);
  normalizeStartStatInput(bombsSlider);
  setSpeedSliderPositionFromSpeed(START_GAME_SPEED);
  syncStartOptionsLabels();
  syncCheatsMenuState();
  markCheatsClean(false);
  // When Cheats opens from Hub -> Options, it must be the only menu panel visible.
  // Hard-hide Start and Hub so the unlocked Cheats panel does not stack over them.
  if (startMenu){
    startMenu.style.setProperty("display", "none", "important");
    startMenu.setAttribute("aria-hidden", "true");
    setStartMenuInteractive(false);
  }
  if (menuHubPanel){
    menuHubPanel.style.setProperty("display", "none", "important");
    menuHubPanel.setAttribute("aria-hidden", "true");
  }
  if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode", "hubOptionsControlsMode"); }
  if (optionsMenu) optionsMenu.style.display = "none";
  if (cheatsMenu) cheatsMenu.style.display = "block";
  uiRoot.classList.remove("optionsBackdrop");
  uiRoot.style.display = "flex";
  fitCheatsMenuToViewport();
  cheatsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncCheatsControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
}

function hideCheats(){
  const returningToPauseOptions = !!(cheatsOpenedFromPause && isPaused);
  const returningToHubOptions = !!cheatsOpenedFromHubOptions;
  const returningToPausedHubOptions = !!(cheatsOpenedFromPausedHubOptions && isPaused);
  cheatsOpenedFromPause = false;
  cheatsOpenedFromHubOptions = false;
  cheatsOpenedFromPausedHubOptions = false;
  if (cheatsMenu) cheatsMenu.style.display = "none";

  if (returningToHubOptions){
    if (returningToPausedHubOptions) menuHubOpenedFromPause = true;
    gameState = STATE.HUB;
    syncStartMenuHudLayerMode();
    document.body.classList.add("menu-hub-open");
    if (startMenu){
      startMenu.style.setProperty("display", "none", "important");
      startMenu.setAttribute("aria-hidden", "true");
      setStartMenuInteractive(false);
    }
    if (optionsMenu) optionsMenu.style.display = "none";
    if (menuHubPanel){
      menuHubPanel.style.setProperty("display", "flex");
      menuHubPanel.setAttribute("aria-hidden", "false");
    }
    uiRoot.classList.add("optionsBackdrop");
    uiRoot.style.display = "flex";
    resetCheatsUnlockGate();
    selectMenuHubTab("options", false);
    menuHubOptionsContentFocused = true;
    optionsFocusIndex = Math.max(0, getOptionsControllerTargets().indexOf(btnCheats));
    fitMenuHubToStartMenu();
    if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
    else clearControllerFocus();
    renderMenuHudPreview();
    return;
  }

  gameState = returningToPauseOptions ? STATE.PLAYING : STATE.OPTIONS;
  optionsMenu.style.display = "block";
  uiRoot.classList.add("optionsBackdrop");
  resetCheatsUnlockGate();
  fitOptionsMenuToViewport();
  optionsFocusIndex = Math.max(0, getOptionsControllerTargets().indexOf(btnCheats));
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
}

function setStateApplyButton(button, state){
  if (!button) return;
  if (button._applyHideTimer){
    clearTimeout(button._applyHideTimer);
    button._applyHideTimer = null;
  }
  if (state === "dirty"){
    button.style.display = "";
    button.innerHTML = 'Apply? <span class="applyX">(✕)</span>';
    button.title = "Apply pending changes";
    return;
  }
  if (state === "applied"){
    button.style.display = "";
    button.innerHTML = 'Applied! <span class="applyCheck">(✓)</span>';
    button.title = "Changes applied";
    button._applyHideTimer = setTimeout(() => {
      button.style.display = "none";
      button.innerHTML = 'Apply? <span class="applyX">(✕)</span>';
      button.title = "Apply pending changes";
      button._applyHideTimer = null;
    }, 3000);
    return;
  }
  button.style.display = "none";
  button.innerHTML = 'Apply? <span class="applyX">(✕)</span>';
  button.title = "Apply pending changes";
}

function updateOptionsApplyButtonState(){
  if (!btnApply) return;
  if (optionsHavePendingChanges) setStateApplyButton(btnApply, "dirty");
  else if (optionsJustApplied) setStateApplyButton(btnApply, "applied");
  else setStateApplyButton(btnApply, "hidden");
}

function markOptionsDirty(){
  optionsHavePendingChanges = true;
  optionsJustApplied = false;
  updateOptionsApplyButtonState();
}

function markOptionsClean(applied=false){
  optionsHavePendingChanges = false;
  optionsJustApplied = !!applied;
  updateOptionsApplyButtonState();
}

function clampGameSpeedValue(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(-5, Math.min(20, Math.round(n)));
}

function gameSpeedToMultiplier(value){
  const speed = clampGameSpeedValue(value);
  if (speed === 0) return 0;
  if (speed === 1) return 1;
  if (speed < 0) return Math.max(0.05, (speed + 6) / 6);
  return speed;
}

function speedToSliderPosition(value){
  const speed = clampGameSpeedValue(value);
  return speed <= 0 ? speed + 5 : speed + 5;
}

function sliderPositionToSpeed(value){
  const pos = Math.max(0, Math.min(25, Math.round(Number(value))));
  return pos <= 5 ? pos - 5 : pos - 5;
}

function setSpeedSliderPositionFromSpeed(value){
  if (!speedSlider) return;
  speedSlider.value = String(speedToSliderPosition(value));
}

function getSpeedValueFromSlider(){
  return speedSlider ? sliderPositionToSpeed(speedSlider.value) : 1;
}

function applyGameSpeedValue(value, syncSlider=true){
  const previousSpeed = clampGameSpeedValue(START_GAME_SPEED);
  const speed = clampGameSpeedValue(value);
  START_GAME_SPEED = speed;
  GAME_SPEED_MULT = gameSpeedToMultiplier(speed);
  if (speed === 0){
    pendingWaveStartMusic = false;
    stopMusic();
    stopMenuMusic(true);
  }
  if (syncSlider) setSpeedSliderPositionFromSpeed(speed);
  syncStartOptionsLabels();
  syncSpeedZeroStaticImages();
  if (previousSpeed !== speed){
    if (gameState === STATE.PLAYING) lockScoreTrackingState();
    else syncScoreTrackingState();
  } else if (gameState !== STATE.PLAYING){
    syncScoreTrackingState();
  }
  return speed;
}

function resetScoreTrackedStartOptionsToDefaults(){
  _resetStartResourceDefaults();
  START_WAVE = DEFAULT_START_WAVE;
  if (startWaveSelect) startWaveSelect.value = String(DEFAULT_START_WAVE);
  INFINITE_MODE = false;
  infiniteModeActive = false;
  shootCheatMode = "normal";
  bigBulletBuffEndTime = 0;
  glitchBackgroundPulse = 0;
  applyGameSpeedValue(DEFAULT_START_GAME_SPEED, true);
  syncCheatsMenuState();
  syncStartOptionsLabels();
  resetScoreTrackingState();
  resetTektiteNicknameLoadoutGate();
  syncTektiteNicknameCheatermodeUnlock({ forceLoadout: true });
}

function isGameSpeedFrozen(){
  return clampGameSpeedValue(START_GAME_SPEED) === 0 || GAME_SPEED_MULT === 0;
}

window.TektiteLevel1SpeedZero = {
  isFrozen(){
    try{
      return gameState === STATE.PLAYING && isGameSpeedFrozen() && !isPaused;
    }catch(e){
      return false;
    }
  },
  getPlayerState(){
    try{
      return {
        x: player.x,
        y: player.y,
        w: player.w,
        h: player.h,
        facing: playerFacing,
        imageUrl: "/dead/games/shooter-game/assets/bananarama.gif"
      };
    }catch(e){
      return null;
    }
  },
  setPlayerX(nextX){
    try{
      const n = Number(nextX);
      if (!Number.isFinite(n)) return;
      player.x = Math.max(player.w / 2, Math.min(canvas.width - player.w / 2, n));
    }catch(e){}
  },
  hideCanvasPlayer(hidden){
    try{
      document.body.classList.toggle("speedZeroMeltHideCanvasPlayer", !!hidden);
    }catch(e){}
  },
  forceDraw(){
    try{
      draw();
    }catch(e){}
  },
  setNegativeTimeTravel(seconds){
    try{
      const value = Math.max(0, Number(seconds) || 0);
      document.body.classList.add("speedZeroTimeTravel");
      if (timerHud){
        timerHud.style.display = "block";
        timerHud.innerHTML = '<div class="timerHudLabel">Time Travel</div><div class="timerHudValue">-' + formatRunTime(value) + '</div>';
      }
    }catch(e){}
  },
  resetToSpeedOneAndMenu(){
    try{
      this.hideCanvasPlayer(false);
      applyGameSpeedValue(1, true);
      setPaused(false);
      showMenu();
      syncStartOptionsLabels();
      ensureMusicPlaying(true);
    }catch(e){
      try{ console.warn("Speed-zero easter egg reset failed", e); }catch(_){}
    }
  }
};

const frozenStaticImageUrlCache = new Map();

function getFrozenStaticImageUrlFromImage(img){
  if (!img) return null;
  const src = img.currentSrc || img.src || "";
  if (!src) return null;
  if (src.startsWith("data:image/")) return src;
  if (frozenStaticImageUrlCache.has(src)) return frozenStaticImageUrlCache.get(src);

  try{
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cctx = c.getContext("2d");
    if (!cctx) return null;
    cctx.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/png");
    frozenStaticImageUrlCache.set(src, url);
    return url;
  }catch(e){
    return null;
  }
}

function setDomImageFrozen(img, freeze){
  if (!img) return;
  if (!img.dataset.originalAnimatedSrc){
    img.dataset.originalAnimatedSrc = img.currentSrc || img.src || "";
  }

  if (freeze){
    const frozenUrl = getFrozenStaticImageUrlFromImage(img);
    if (frozenUrl && img.src !== frozenUrl) img.src = frozenUrl;
  } else {
    const original = img.dataset.originalAnimatedSrc;
    if (original && img.src !== original) img.src = original;
  }
}

function syncSpeedZeroStaticImages(){
  const freeze = isGameSpeedFrozen();

  // Start-menu Bananarama + lives counter Bananarama. Any Bananarama DOM img gets frozen
  // into a one-frame PNG while speed is 0, then restored afterward.
  const domImgs = Array.from(document.querySelectorAll('img[src*="bananarama."], img[data-original-animated-src*="bananarama."]'));
  for (const img of domImgs) setDomImageFrozen(img, freeze);

  document.body.classList.toggle("speedZeroStaticImages", freeze);
}

function getStaticFrameForImage(img){
  if (!img) return null;
  const src = img.currentSrc || img.src || "";
  if (!src) return img;

  const cachedUrl = getFrozenStaticImageUrlFromImage(img);
  if (!cachedUrl) return img;

  let cached = frozenStaticImageUrlCache.get(cachedUrl);
  if (cached && cached.__isFrozenStaticImageElement) return cached;

  const staticImg = new Image();
  staticImg.__isFrozenStaticImageElement = true;
  staticImg.src = cachedUrl;
  frozenStaticImageUrlCache.set(cachedUrl, staticImg);
  return staticImg.complete ? staticImg : img;
}

const CHAT_NICKNAME_STORAGE_KEY = "tektiteChatNickname";
const CHAT_NICKNAME_EXPLICIT_STORAGE_KEY = "tektiteChatNicknameExplicit";
const CHAT_NICKNAME_MAX_LENGTH = 8;
const START_MENU_CONSTRUCTION_DEBUG_NICKNAME = "_debug";
const START_MENU_ACCESS_MODE_DEFAULT = "public";

function getStartMenuAccessMode(){
  const configuredMode = String(window.SHOOTER_START_MENU_ACCESS_MODE || START_MENU_ACCESS_MODE_DEFAULT).trim().toLowerCase();
  if (["public", "dev", "open", "construction"].includes(configuredMode)) return configuredMode;

  // Backward compatibility for older patches that only had the boolean gate.
  // false meant "normal Start Menu for everyone", which is now "open".
  if (window.SHOOTER_START_MENU_CONSTRUCTION_GATE_ENABLED === false) return "open";
  return START_MENU_ACCESS_MODE_DEFAULT;
}

function isStartMenuConstructionGateEnabled(){
  return getStartMenuAccessMode() !== "open";
}

function isStartMenuConstructionLocked(savedNickname = getSavedChatNicknameValue()){
  const mode = getStartMenuAccessMode();
  const nickname = String(savedNickname || "").trim();
  const isDebugNickname = nickname === START_MENU_CONSTRUCTION_DEBUG_NICKNAME;

  if (mode === "dev") return !isDebugNickname;
  if (mode === "construction") return true;
  if (mode === "open") return false;

  // public mode: the normal Start Menu is public; _debug previews construction.
  return isDebugNickname;
}

function syncStartMenuConstructionGate(savedNickname = getSavedChatNicknameValue()){
  const root = document.documentElement;
  const locked = isStartMenuConstructionLocked(savedNickname);
  if (root && root.classList){
    root.classList.toggle("sg-start-construction-locked", locked);
    root.classList.toggle("sg-start-construction-unlocked", !locked);
  }
  if (startMenu){
    startMenu.setAttribute("aria-label", locked ? "Under Construction. Check Back Later." : "Start Menu");
  }
  return locked;
}

function limitChatNicknameLength(value){
  return Array.from(String(value || "")).slice(0, CHAT_NICKNAME_MAX_LENGTH).join("");
}

function getSavedChatNicknameValue(){
  try{
    const savedNickname = window.localStorage.getItem(CHAT_NICKNAME_STORAGE_KEY);
    const normalized = savedNickname && savedNickname.trim() ? savedNickname.trim() : "";
    const isExplicit = window.localStorage.getItem(CHAT_NICKNAME_EXPLICIT_STORAGE_KEY) === "true";
    return normalized === "User" && !isExplicit ? "" : limitChatNicknameLength(normalized);
  }catch(error){
    return "";
  }
}


function isTektiteNicknameCheatermodeUnlock(){
  return getSavedChatNicknameValue().trim().toLowerCase() === "tektite";
}

let tektiteNicknameLoadoutApplied = false;

function resetTektiteNicknameLoadoutGate(){
  tektiteNicknameLoadoutApplied = false;
}

function applyTektiteNicknameLoadoutOnce(options={}){
  if (!isTektiteNicknameCheatermodeUnlock()){
    resetTektiteNicknameLoadoutGate();
    return false;
  }
  const forceLoadout = !!(options && options.forceLoadout);
  if (tektiteNicknameLoadoutApplied && !forceLoadout) return false;

  // Tektite gets the start-menu loadout once per fresh load / quit-to-menu.
  // After that, the player can toggle Infinite Mode or Shoot Type off without
  // the nickname sync immediately turning them back on like a needy debug ghost.
  applyGlobalInfiniteMode(true);
  shootCheatMode = "glitch";
  setVideoFxEnabled(true);
  bigBulletBuffEndTime = 0;
  glitchBackgroundPulse = Math.max(glitchBackgroundPulse || 0, 0.85);
  tektiteNicknameLoadoutApplied = true;
  lockScoreTrackingState();
  syncCheatsMenuState();
  syncStartOptionsLabels();
  if (typeof renderMenuHudPreview === "function") renderMenuHudPreview();
  return true;
}

function syncTektiteNicknameCheatermodeUnlock(options={}){
  if (!isTektiteNicknameCheatermodeUnlock()){
    resetTektiteNicknameLoadoutGate();
    return false;
  }
  if (!cheatsUnlockedByPassphrase){
    unlockCheatermode("nickname-tektite");
  } else {
    notifyCheatsUnlockedState();
    lockScoreTrackingState();
    syncCheatsMenuState();
    updateCheatsUnlockModeHint();
  }
  applyTektiteNicknameLoadoutOnce(options);
  return true;
}

function loadSavedChatNickname(){
  return getSavedChatNicknameValue() || "User";
}

function saveChatNickname(value){
  const normalized = limitChatNicknameLength(String(value || "").trim());
  try{
    if (normalized){
      window.localStorage.setItem(CHAT_NICKNAME_EXPLICIT_STORAGE_KEY, "true");
      window.localStorage.setItem(CHAT_NICKNAME_STORAGE_KEY, normalized);
      rememberChatNickname(normalized);
    } else {
      window.localStorage.removeItem(CHAT_NICKNAME_EXPLICIT_STORAGE_KEY);
      window.localStorage.removeItem(CHAT_NICKNAME_STORAGE_KEY);
    }
  }catch(error){}
  return normalized;
}

function syncNicknameControl(){
  if (!nicknameInput) return;
  nicknameInput.value = getSavedChatNicknameValue();
  syncNicknameInputPreview();
  syncNicknameActionButton();
}

function getNicknameDraftValue(){
  return nicknameInput ? String(nicknameInput.value || "").trim() : "";
}

function syncNicknameInputPreview(){
  if (!nicknameInputGhost || !nicknameInput) return;
  const draft = String(nicknameInput.value || "");
  const chars = Array.from(draft);
  const allowed = chars.slice(0, CHAT_NICKNAME_MAX_LENGTH).join("");
  const overflow = chars.slice(CHAT_NICKNAME_MAX_LENGTH).join("");
  nicknameInputGhost.textContent = "";
  nicknameInputGhost.appendChild(document.createTextNode(allowed));
  if (overflow){
    const overflowSpan = document.createElement("span");
    overflowSpan.className = "nicknameInputOverflow";
    overflowSpan.textContent = overflow;
    nicknameInputGhost.appendChild(overflowSpan);
  }
  const scrollLeft = nicknameInput.scrollLeft || 0;
  nicknameInputGhost.style.transform = scrollLeft ? `translateX(${-scrollLeft}px)` : "";
}

function syncNicknameActionButton(){
  if (!btnNicknameAction) return;
  const savedNickname = getSavedChatNicknameValue();
  const draftNickname = getNicknameDraftValue();
  const canApplyDraft = !!draftNickname && draftNickname !== savedNickname;
  if (canApplyDraft){
    btnNicknameAction.textContent = "✅";
    btnNicknameAction.setAttribute("aria-label", "Set nickname");
    btnNicknameAction.title = "Set nickname";
    btnNicknameAction.disabled = false;
  } else {
    btnNicknameAction.textContent = "❌";
    btnNicknameAction.setAttribute("aria-label", "Clear nickname");
    btnNicknameAction.title = "Clear nickname";
    btnNicknameAction.disabled = !savedNickname;
  }
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

function getStartMenuButtonTextSpan(button){
  if (!button) return null;
  let textSpan = button.querySelector(":scope > .startMenuButtonText");
  if (textSpan) return textSpan;
  textSpan = document.createElement("span");
  textSpan.className = "startMenuButtonText";
  while (button.firstChild) textSpan.appendChild(button.firstChild);
  button.appendChild(textSpan);
  return textSpan;
}

function setStartMenuButtonLabel(button, label){
  const textSpan = getStartMenuButtonTextSpan(button);
  if (textSpan) textSpan.textContent = label;
}

function renderStatsStartButtonLabel(savedNickname){
  const textSpan = getStartMenuButtonTextSpan(btnStats);
  if (!textSpan) return;
  if (!savedNickname){
    btnStats.style.removeProperty("--stats-button-focus-font-size");
    textSpan.textContent = "Lifetime Stats";
    return;
  }
  const chars = Array.from(savedNickname);
  const visibleChars = chars.slice(0, CHAT_NICKNAME_MAX_LENGTH);
  textSpan.textContent = "";
  const nameSpan = document.createElement("span");
  nameSpan.className = "statsNicknamePreview";
  nameSpan.textContent = visibleChars.join("");
  textSpan.appendChild(nameSpan);
  textSpan.appendChild(document.createTextNode("'s Stats"));
  fitStatsStartButtonNicknameLabel();
}

function fitStatsStartButtonNicknameLabel(){
  if (!btnStats) return;
  btnStats.style.removeProperty("--stats-button-focus-font-size");
  if (!btnStats.classList.contains("controllerFocus")) return;
  const textSpan = getStartMenuButtonTextSpan(btnStats);
  if (!textSpan) return;
  const buttonWidth = Math.max(0, btnStats.clientWidth || 0);
  const availableWidth = Math.max(46, buttonWidth - 48);
  const style = window.getComputedStyle ? window.getComputedStyle(textSpan) : null;
  const baseSize = Math.max(1, parseFloat(style && style.fontSize) || 13.3333);
  const canvas = fitStatsStartButtonNicknameLabel._canvas || (fitStatsStartButtonNicknameLabel._canvas = document.createElement("canvas"));
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) return;
  ctx.font = (style && style.font) || `${style && style.fontWeight ? style.fontWeight : "400"} ${baseSize}px ${style && style.fontFamily ? style.fontFamily : "monospace"}`;
  const textWidth = Math.max(1, ctx.measureText(textSpan.textContent || "").width);
  if (textWidth <= availableWidth) return;
  const nextSize = Math.max(8, Math.floor((baseSize * availableWidth / textWidth) * 10) / 10);
  btnStats.style.setProperty("--stats-button-focus-font-size", `${Math.min(baseSize, nextSize)}px`);
}


function clearStartNicknamePrepaintState(){
  // v2.XX: The prepaint classes are only allowed to control the nickname row
  // before the runtime hydrates. Leaving them on after saving a nickname lets
  // old !important first-paint rules resurrect the Enter Nickname button and
  // duplicate the Welcome back message via ::before. Bureaucratic CSS necromancy.
  const root = document.documentElement;
  if (!root || !root.classList) return;
  root.classList.remove("sg-start-nickname-prepaint");
  root.classList.remove("sg-start-nickname-needs-name");
  root.classList.remove("sg-start-nickname-has-name");
  try{ root.style.removeProperty("--sg-start-nickname-welcome"); }catch(_){ }
}

function syncStartMenuNicknameButton(savedNickname = getSavedChatNicknameValue()){
  syncStartMenuConstructionGate(savedNickname);
  if (!btnEnterNickname && !startWelcomeNickname) return;
  const nicknameText = String(savedNickname || "").trim();
  const needsNickname = !nicknameText;
  const inputActive = isStartNicknameInputActive();

  if (btnEnterNickname){
    const showEnterButton = needsNickname && !inputActive;
    if (showEnterButton) setStartMenuButtonLabel(btnEnterNickname, "Enter Nickname to Create Profile");
    btnEnterNickname.classList.toggle("needsNickname", showEnterButton);
    btnEnterNickname.style.display = showEnterButton ? "" : "none";
    btnEnterNickname.setAttribute("aria-hidden", showEnterButton ? "false" : "true");
    btnEnterNickname.tabIndex = showEnterButton ? 0 : -1;
  }

  if (startWelcomeNickname){
    const showWelcome = !needsNickname && !inputActive;
    startWelcomeNickname.classList.toggle("hasNickname", showWelcome);
    startWelcomeNickname.style.display = showWelcome ? "inline-flex" : "none";
    startWelcomeNickname.textContent = showWelcome ? `Welcome back, ${nicknameText}` : "";
    startWelcomeNickname.setAttribute("aria-hidden", showWelcome ? "false" : "true");
  }

  if (startNicknameInput && (!needsNickname || !inputActive)){
    startNicknameInput.classList.remove("nicknameEntryActive");
    startNicknameInput.style.display = "none";
  }

  clearStartNicknamePrepaintState();

  if (!needsNickname){
    const items = getMenuControllerTargets();
    if (menuFocusIndex >= items.length) menuFocusIndex = Math.max(0, items.length - 1);
  }
}


function syncStartNicknameInputHueShift(){
  if (!startNicknameInput) return;
  const hasDraft = String(startNicknameInput.value || "").length > 0;
  startNicknameInput.classList.toggle("nicknameHasDraft", hasDraft);
}

function resetStartNicknameEntry(){
  hideNicknameSuggestionPopup();
  if (startNicknameInput){
    startNicknameInput.classList.remove("nicknameEntryActive");
    startNicknameInput.classList.remove("nicknameHasDraft");
    startNicknameInput.style.display = "none";
    startNicknameInput.value = "";
  }
  syncStartMenuNicknameButton();
}

function showStartNicknameInput(){
  if (!startNicknameInput || !btnEnterNickname) return false;
  hideNicknameSuggestionPopup();
  clearStartNicknamePrepaintState();
  btnEnterNickname.classList.remove("needsNickname");
  btnEnterNickname.style.display = "none";
  btnEnterNickname.setAttribute("aria-hidden", "true");
  btnEnterNickname.tabIndex = -1;
  startNicknameInput.classList.add("nicknameEntryActive");
  startNicknameInput.style.display = "inline-flex";
  startNicknameInput.value = "";
  startNicknameInput.classList.remove("nicknameHasDraft");
  startNicknameInput.readOnly = false;
  startNicknameInput.disabled = false;
  startNicknameInput.placeholder = "Enter Nickname";
  const items = getMenuControllerTargets();
  const inputIndex = items.indexOf(startNicknameInput);
  if (inputIndex >= 0) menuFocusIndex = inputIndex;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  try{ startNicknameInput.focus({ preventScroll:true }); }catch(_){ try{ startNicknameInput.focus(); }catch(__){} }
  try{ startNicknameInput.select(); }catch(_){}
  return true;
}

function commitStartNicknameInput(){
  if (!startNicknameInput) return false;
  const draft = String(startNicknameInput.value || "").trim();
  if (!draft){
    resetStartNicknameEntry();
    return false;
  }
  applyNicknameFromControls(draft, false);
  resetStartNicknameEntry();
  syncStartMenuNicknameButton(getSavedChatNicknameValue());
  const items = getMenuControllerTargets();
  const startIndex = items.indexOf(btnStart);
  menuFocusIndex = startIndex >= 0 ? startIndex : 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
  return true;
}

function openNicknameMenuFromStart(){
  return showStartNicknameInput();
}

function syncNicknameStatsLabels(){
  const savedNickname = getSavedChatNicknameValue();
  syncStartMenuConstructionGate(savedNickname);
  syncStartMenuNicknameButton(savedNickname);
  syncPauseTitleNickname();
  if (btnStats){
    btnStats.classList.toggle("statsNicknameLabel", !!savedNickname);
    renderStatsStartButtonLabel(savedNickname);
  }
  if (statsPanelTitle){
    if (savedNickname){
      statsPanelTitle.textContent = `${savedNickname}'s Lifetime Stats`;
    } else {
      statsPanelTitle.textContent = "Lifetime Stats";
    }
  }
}

try{ window.addEventListener("resize", fitStatsStartButtonNicknameLabel); }catch(_){}

function applyNicknameFromControls(value, announce=false, options={}){
  const normalized = saveChatNickname(value);
  hideNicknameSuggestionPopup();
  cancelResetProfileConfirmation();
  if (nicknameInput) nicknameInput.value = normalized;
  syncNicknameInputPreview();
  syncNicknameStatsLabels();
  audioMuted = effectiveAudioMuted();
  applyMuteState();
  if (typeof renderLifetimeStats === "function") renderLifetimeStats();
  if (typeof renderSavedImages === "function") renderSavedImages();
  if (typeof syncStatsSavedImagesState === "function") syncStatsSavedImagesState();
  syncNicknameActionButton();
  if (!options || !options.skipTektiteCheatermodeUnlock){
    syncTektiteNicknameCheatermodeUnlock();
  }
  try{
    if (window.parent && window.parent !== window){
      window.parent.postMessage({
        type: "tektite:set-nickname",
        nickname: normalized,
        announce: !!announce
      }, "*");
    }
  }catch(error){}
  return true;
}

function activateNicknameAction(){
  if (!nicknameInput) return false;
  const savedNickname = getSavedChatNicknameValue();
  const draftNickname = getNicknameDraftValue();
  if (draftNickname && draftNickname !== savedNickname){
    applyNicknameFromControls(draftNickname, false);
  } else if (savedNickname){
    applyNicknameFromControls("", false);
  }
  syncNicknameActionButton();
  return true;
}

syncNicknameControl();
syncNicknameStatsLabels();
syncTektiteNicknameCheatermodeUnlock();

function normalizeHexColor(value){
  const raw = String(value || "").trim();
  const withHash = raw.startsWith("#") ? raw : "#" + raw;
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)){
    return "#" + withHash.slice(1).split("").map(ch => ch + ch).join("").toUpperCase();
  }
  return null;
}

function syncBackgroundColorControls(){
  const current = normalizeHexColor(starfieldBgOverride || "#000000") || "#000000";
  if (backgroundColorHex) backgroundColorHex.value = current;
  if (backgroundColorPicker) backgroundColorPicker.value = current;
}

function applyBackgroundColorFromControls(value){
  const normalized = normalizeHexColor(value);
  if (!normalized) return false;
  starfieldBgOverride = normalized;
  if (backgroundColorHex) backgroundColorHex.value = normalized;
  if (backgroundColorPicker) backgroundColorPicker.value = normalized;
  return true;
}

function showOptions(fromPause = false){
  restoreMenuHubActiveInner();
  hideControlsPreviewMenu({ restoreControlsMenu: false });
  optionsOpenedFromPause = !!fromPause;
  cheatsOpenedFromPause = false;
  cheatsOpenedFromHubOptions = false;
  cheatsOpenedFromHubOptions = false;
  if (startMenu && startMenu.style.display !== "none") rememberStartMenuPanelRect();
  else getFallbackMenuRect();
  if (!fromPause){
    setPaused(false);
    gameState = STATE.OPTIONS;
    syncStartMenuHudLayerMode();
    unlockAudioOnce();
    if (!audioMuted) ensureMenuMusicPlaying();
  }
  markOptionsClean(false);
    // v1.96: populate start options UI with saved settings
  livesSlider.value = START_LIVES_INFINITE ? 100 : START_LIVES;
  heartsSlider.value = START_HEARTS_INFINITE ? 100 : START_HEARTS;
  shieldsSlider.value = START_SHIELDS_INFINITE ? 100 : START_SHIELDS;
  bombsSlider.value = START_BOMBS_INFINITE ? 100 : START_BOMBS;
  setSpeedSliderPositionFromSpeed(START_GAME_SPEED);
  if (startWaveSelect) startWaveSelect.value = String(START_WAVE);
  syncStartOptionsLabels();
  normalizeStartStatInput(livesSlider);
  normalizeStartStatInput(heartsSlider);
  normalizeStartStatInput(shieldsSlider);
  normalizeStartStatInput(bombsSlider);
  syncStartOptionsLabels();
  syncCheatsMenuState();
  resetCheatsUnlockGate();
  syncNicknameControl();
  syncNicknameStatsLabels();
  try{
    window.addEventListener("storage", (event) => {
      if (event.key !== CHAT_NICKNAME_STORAGE_KEY && event.key !== CHAT_NICKNAME_EXPLICIT_STORAGE_KEY) return;
      syncNicknameControl();
      syncNicknameStatsLabels();
      syncStartMenuConstructionGate();
      syncTektiteNicknameCheatermodeUnlock();
    });
  }catch(error){}

// v1.96: drop shield when entering menus
  mouseShieldHolding = false;
  stopShield(false);

  startMenu.style.display = "none";
  if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode"); }
  pauseControlsOpen = false;
  if (pauseOverlay) pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  if (fromPause && pauseOverlay) pauseOverlay.style.display = "none";
  optionsMenu.style.display = "block";
  if (cheatsMenu) cheatsMenu.style.display = "none";
  uiRoot.classList.add("optionsBackdrop");
  uiRoot.style.display = "flex";
  fitOptionsMenuToViewport();
  optionsFocusIndex = 0;
  if (activeInputMode === INPUT_MODE_CONTROLLER) syncOptionsControllerFocus();
  else clearControllerFocus();
  renderMenuHudPreview();
  updateHearts();
}
function startGame(){
  restoreMenuHubActiveInner();
  hideControlsPreviewMenu({ restoreControlsMenu: false });
  setPaused(false);
  unlockAudioOnce();
  stopMenuMusic(true);
  gameState = STATE.PLAYING;
  syncStartMenuHudLayerMode();
  scoreTrackingLocked = !!(cheatsUnlockedByPassphrase || hasScoreDisqualifyingSettings());
  syncScoreTrackingState();
  uiRoot.classList.remove("optionsBackdrop");
  uiRoot.style.display = "none";
  if (controlsMenu) { controlsMenu.style.display = "none"; controlsMenu.classList.remove("pauseControlsMode"); }
  pauseControlsOpen = false;
  if (pauseOverlay) pauseOverlay.classList.remove("pauseControlsVisible");
  uiRoot.classList.remove("pauseControlsOpen");
  deathOverlay.style.display = "none";
  clearDeathControllerFocus();
  if (winOverlay) winOverlay.style.display = "none";
  stopWinStatsMarquee({ resetScroll:true });

  // v1.96: show HUD only in-game
  livesSlot.style.display = "flex";
  powerupSlot.style.display = "none";
  if (timerHud) timerHud.style.display = "block";
  { const heartsHud = getHeartsHudEl(); if (heartsHud) heartsHud.style.display = "block"; }

  // v1.96.x: Reset run timer at the start of each game
  runTimer = 0;
  updateTimerHUD();
  currentRunStatsCommitted = false;
  score = 0;
  scoreStoreUnlockedThisRun = false;
  bigBulletBuffEndTime = 0;
  frogKills = 0;
  shotsFired = 0;
  hitsConnected = 0;
  damageDealt = 0;
  totalEnemiesSpawned = 0;
  bombKills = 0;
  bombDragonKills = 0;
  bombFrogKills = 0;
  enemyKillCounts = new Map();
  syncScoreTrackingState();
  // v1.96: Apply starting settings from OPTIONS menu
  infiniteModeActive = !!INFINITE_MODE;
  livesInfiniteActive = !!START_LIVES_INFINITE || !!INFINITE_MODE;
  heartsInfiniteActive = !!START_HEARTS_INFINITE || !!INFINITE_MODE;
  shieldsInfiniteActive = !!START_SHIELDS_INFINITE || !!INFINITE_MODE;
  bombsInfiniteActive = !!START_BOMBS_INFINITE || !!INFINITE_MODE;

  lives = livesInfiniteActive ? 100 : Math.max(0, parseInt(START_LIVES, 10) || 0);
  playerSpectatorMode = !livesInfiniteActive && lives <= 0;
  try{ document.body.classList.toggle("zeroLivesSpectatorMode", playerSpectatorMode); }catch(e){}
  livesText.textContent = livesInfiniteActive ? "x∞" : ("x" + lives);
  if (playerSpectatorMode && livesSlot) livesSlot.style.display = "none";

  MAX_HEARTS = heartsInfiniteActive ? 100 : Math.max(1, parseInt(START_HEARTS, 10) || 4);
  HIT_DAMAGE = 1 / MAX_HEARTS;

  health = 1.0;

  // Spawn player mid-screen, above hearts HUD
  player.x = canvas.width / 2;
  player.y = getPlayerAlignedY();

  shieldPips = shieldsInfiniteActive ? 100 : Math.max(0, parseInt(START_SHIELDS, 10) || 0);

  bombsCount = bombsInfiniteActive ? 100 : Math.max(0, parseInt(START_BOMBS, 10) || 0);
  _syncBombHud();

  health = 1.0;

  // Spawn player mid-screen, above hearts HUD
  player.x = canvas.width / 2;
  player.y = getPlayerAlignedY();
  bonusArmor = 0;
  bonusArmorBrokenT = 0;
  isDead = false;
  deathTimer = 0;
  deathGameOver = false;
  deathYellPlayed = false;
  deathParticles.length = 0;
  playerGhosts.length = 0;
  playerGhostSpawnT = 0;
  playerTurnT = 1;

  if (stageWaveDropdown && stageWaveDropdown.value !== "menu" && !isNaN(parseInt(stageWaveDropdown.value, 10))){
    START_WAVE = Math.max(1, Math.min(21, parseInt(stageWaveDropdown.value, 10) || START_WAVE || 1));
    if (startWaveSelect) startWaveSelect.value = String(START_WAVE);
  }

  const frozenStaringContest = isGameSpeedFrozen();

  // Speed 0 is an intentional static tableau: Wave 1 player vs one enemy, no progress.
  wave = frozenStaringContest ? 1 : START_WAVE;
  if (frozenStaringContest){
    waveBanner.t = 0;
    waveBanner.text = "";
  } else {
    showWaveBanner(wave);
  }

  bullets.length = 0;
  enemyBullets.length = 0;
  fireCooldown = 0;
  bomb = null;
  ufo = null;

  resetFormation();
  updateHearts();
  spawnEnemies();

  if (frozenStaringContest){
    // Position the Wave 1 enemy immediately so speed 0 makes the cut on the first drawn frame.
    positionStartMenuPreviewEnemies();

    // Keep the scene absolutely inert: one Wave 1 enemy, optional frozen UFO, no music start trigger.
    // Force-spawn the UFO so speed 0 can become a static staring contest bonus tableau.
    trySpawnUFO(true);
    pendingWaveStartMusic = false;
    stopMusic();
    stopMenuMusic(true);
    runTimer = 0;
    document.body.classList.remove("speedZeroTimeTravel");
    if (timerHud) timerHud.style.display = "none";
  } else {
    trySpawnUFO();
    // Only begin the level music after Wave 1 gameplay has actually spawned.
    pendingWaveStartMusic = true;
  }

  clearControllerFocus();
  syncSpeedZeroStaticImages();
  window.focus();
}










if (speedSlider){
  speedSlider.addEventListener("input", markCheatsDirty);
  speedSlider.addEventListener("change", markCheatsDirty);
}










if (typeof livesSlider !== "undefined" && livesSlider){
  livesSlider.addEventListener("input", markCheatsDirty);
  livesSlider.addEventListener("change", markCheatsDirty);
}


if (typeof heartsSlider !== "undefined" && heartsSlider){
  heartsSlider.addEventListener("input", markCheatsDirty);
  heartsSlider.addEventListener("change", markCheatsDirty);
}


if (typeof shieldsSlider !== "undefined" && shieldsSlider){
  shieldsSlider.addEventListener("input", markCheatsDirty);
  shieldsSlider.addEventListener("change", markCheatsDirty);
}


if (typeof bombsSlider !== "undefined" && bombsSlider){
  bombsSlider.addEventListener("input", markCheatsDirty);
  bombsSlider.addEventListener("change", markCheatsDirty);
}


if (typeof startWaveSelect !== "undefined" && startWaveSelect){
  startWaveSelect.addEventListener("input", markCheatsDirty);
  startWaveSelect.addEventListener("change", markCheatsDirty);
}








function syncFileLastUpdatedLabels(){
  const labels = Array.from(document.querySelectorAll("[data-file-last-updated]"));
  if (!labels.length) return;
  let displayText = "Last updated: unknown";
  try{
    const modified = document.lastModified ? new Date(document.lastModified) : null;
    if (modified && !Number.isNaN(modified.getTime())){
      displayText = `Last updated: ${modified.toLocaleString(undefined, {
        year:"numeric",
        month:"short",
        day:"numeric",
        hour:"numeric",
        minute:"2-digit"
      })}`;
    }
  }catch(error){
    displayText = "Last updated: unknown";
  }
  labels.forEach((label) => {
    label.textContent = `(${displayText})`;
  });
}

syncFileLastUpdatedLabels();

if (titleHoverReveal){
  titleHoverReveal.addEventListener("click", refreshEntireShooterPage);
  titleHoverReveal.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " "){
      event.preventDefault();
      refreshEntireShooterPage();
    }
  });
}

if (constructionHoverReveal){
  constructionHoverReveal.addEventListener("click", refreshEntireShooterPage);
  constructionHoverReveal.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " "){
      event.preventDefault();
      refreshEntireShooterPage();
    }
  });
}

if (btnMysteryLink){
  btnMysteryLink.addEventListener("click", (event) => {
    event.preventDefault();
    try{
      window.top.location.href = "https://honestlythomas.com";
    }catch(e){
      window.location.href = "https://honestlythomas.com";
    }
  });
}

if (nicknameInput){
  nicknameInput.addEventListener("input", () => {
    syncNicknameInputPreview();
    syncNicknameActionButton();
  });
  nicknameInput.addEventListener("scroll", syncNicknameInputPreview);
  nicknameInput.addEventListener("change", () => {
    applyNicknameFromControls(nicknameInput.value, false);
  });
  nicknameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter"){
      event.preventDefault();
      applyNicknameFromControls(nicknameInput.value, false);
      try{ nicknameInput.blur(); }catch(e){}
    }
  });
}
if (btnNicknameAction){
  btnNicknameAction.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  btnNicknameAction.addEventListener("click", () => {
    activateNicknameAction();
    if (nicknameInput && typeof nicknameInput.focus === "function"){
      try{ nicknameInput.focus({ preventScroll:true }); }catch(e){ try{ nicknameInput.focus(); }catch(_){} }
    }
  });
}

if (backgroundColorHex){
  backgroundColorHex.addEventListener("input", () => {
    const normalized = normalizeHexColor(backgroundColorHex.value);
    if (normalized && backgroundColorPicker) backgroundColorPicker.value = normalized;
  });
  backgroundColorHex.addEventListener("change", () => {
    applyBackgroundColorFromControls(backgroundColorHex.value);
  });
  backgroundColorHex.addEventListener("keydown", (event) => {
    if (event.key === "Enter"){
      event.preventDefault();
      applyBackgroundColorFromControls(backgroundColorHex.value);
      try{ backgroundColorHex.blur(); }catch(e){}
    }
  });
}
if (backgroundColorPicker){
  backgroundColorPicker.addEventListener("input", () => {
    applyBackgroundColorFromControls(backgroundColorPicker.value);
  });
  backgroundColorPicker.addEventListener("change", () => {
    applyBackgroundColorFromControls(backgroundColorPicker.value);
  });
}

applyMuteState();
if (stageHud){
  stageHud.addEventListener("click", (event) => {
    if (event.target && event.target.closest && event.target.closest("#stageHudSpeaker, #stageWaveDropdownWrap, #musicDropdownWrap, #stageWaveDropdown, #musicFileDropdown")) return;
    if (!isPreGameplayMenuAudioState()) return;
    event.preventDefault();
    event.stopPropagation();
    toggleStartMenuTitleMute();
  });
}
document.addEventListener("pointerdown", primeMenuMusicOnFirstGesture, { capture:true, once:true });
document.addEventListener("keydown", primeMenuMusicOnFirstGesture, { capture:true, once:true });
document.addEventListener("touchstart", primeMenuMusicOnFirstGesture, { capture:true, once:true });

if (btnStats) btnStats.addEventListener("click", openStatsPanel);
if (btnImages) btnImages.addEventListener("click", openImagesPanel);
if (btnMenu) btnMenu.addEventListener("click", openMenuHub);
if (btnEnterNickname) btnEnterNickname.addEventListener("click", openNicknameMenuFromStart);
if (startNicknameInput){
  startNicknameInput.addEventListener("click", (event) => {
    event.stopPropagation();
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
    openNicknameSuggestionPopup(startNicknameInput);
  });
  startNicknameInput.addEventListener("focus", () => {
    openNicknameSuggestionPopup(startNicknameInput);
  });
  startNicknameInput.addEventListener("input", () => {
    syncStartNicknameInputHueShift();
    openNicknameSuggestionPopup(startNicknameInput);
  });
  startNicknameInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp"){
      event.preventDefault();
      cycleNicknameSuggestionChoice(startNicknameInput, event.key === "ArrowUp" || event.shiftKey ? -1 : 1);
    } else if (event.key === "Enter"){
      event.preventDefault();
      commitStartNicknameInput();
    } else if (event.key === "Escape"){
      event.preventDefault();
      resetStartNicknameEntry();
      if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
    }
  });
  startNicknameInput.addEventListener("blur", () => {
    scheduleNicknameSuggestionPopupHide(startNicknameInput);
    if (!String(startNicknameInput.value || "").trim()) resetStartNicknameEntry();
  });
}
if (btnMenuHubImages) btnMenuHubImages.addEventListener("click", () => selectMenuHubTab("images", true));
if (btnMenuHubStats) btnMenuHubStats.addEventListener("click", () => selectMenuHubTab("stats", true));
if (btnMenuHubOptions) btnMenuHubOptions.addEventListener("click", () => selectMenuHubTab("options", true));
if (btnMenuHubClose) btnMenuHubClose.addEventListener("click", closeMenuHub);
if (btnImagesClose) btnImagesClose.addEventListener("click", closeImagesPanel);
if (btnImagesClear) btnImagesClear.addEventListener("click", clearSavedImages);
if (btnStatsClose) btnStatsClose.addEventListener("click", closeStatsPanel);
if (btnStatsImport){
  btnStatsImport.addEventListener("click", () => {
    importProfile();
  });
}
if (btnStatsReset){
  btnStatsReset.addEventListener("click", () => {
    handleResetProfileButtonClick();
  });
}
if (btnStatsExport){
  btnStatsExport.addEventListener("click", () => {
    exportProfile();
  });
}
if (statsSavedProfilesGrid){
  statsSavedProfilesGrid.addEventListener("click", (event) => {
    const tile = event.target && event.target.closest ? event.target.closest(".statsSavedProfileTile") : null;
    if (!tile) return;
    const nickname = limitChatNicknameLength(String(tile.dataset.profileNickname || "").trim());
    if (!nickname) return;
    applyNicknameFromControls(nickname, false);
    renderLifetimeStats();
  });
}
if (menuHubPanel){
  menuHubPanel.addEventListener("click", (event) => {
    if (event.target === menuHubPanel) closeMenuHub();
  });
}
if (statsPanel){
  statsPanel.addEventListener("click", (event) => {
    if (event.target === statsPanel) closeStatsPanel();
  });
}
if (imagesPanel){
  imagesPanel.addEventListener("click", (event) => {
    if (event.target === imagesPanel) closeImagesPanel();
  });
}
if (btnStatsEnterNickname){
  btnStatsEnterNickname.addEventListener("click", () => {
    if (hasLifetimeStatsProfile()) return;
    openNicknamePromptFromStats();
  });
}
if (statsNicknameInput){
  statsNicknameInput.addEventListener("click", (event) => {
    event.stopPropagation();
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
    openNicknameSuggestionPopup(statsNicknameInput);
  });
  statsNicknameInput.addEventListener("focus", () => {
    openNicknameSuggestionPopup(statsNicknameInput);
  });
  statsNicknameInput.addEventListener("input", () => {
    syncStatsNicknameInputDraftState();
    openNicknameSuggestionPopup(statsNicknameInput);
  });
  statsNicknameInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp"){
      event.preventDefault();
      cycleNicknameSuggestionChoice(statsNicknameInput, event.key === "ArrowUp" || event.shiftKey ? -1 : 1);
    } else if (event.key === "Enter"){
      event.preventDefault();
      commitStatsNicknameInput();
    } else if (event.key === "Escape"){
      event.preventDefault();
      resetStatsNicknameEntry();
      if (activeInputMode === INPUT_MODE_CONTROLLER) syncStatsControllerFocus();
    }
  });
  statsNicknameInput.addEventListener("blur", () => {
    scheduleNicknameSuggestionPopupHide(statsNicknameInput);
    if (!String(statsNicknameInput.value || "").trim()) resetStatsNicknameEntry();
  });
}
window.addEventListener("resize", () => {
  if (nicknameSuggestionState.input) renderNicknameSuggestionPopup();
});
document.addEventListener("scroll", () => {
  if (nicknameSuggestionState.input) renderNicknameSuggestionPopup();
}, true);
document.addEventListener("mousedown", (event) => {
  if (!nicknameSuggestionState.input || !nicknameSuggestionState.popup) return;
  const target = event.target;
  if (target === nicknameSuggestionState.input) return;
  if (nicknameSuggestionState.popup.contains(target)) return;
  hideNicknameSuggestionPopup();
});
if (btnStatsLockedToggle){
  btnStatsLockedToggle.addEventListener("click", () => {
    toggleStatsLockedSummary();
  });
}
if (btnStatsSavedImagesToggle){
  btnStatsSavedImagesToggle.addEventListener("click", () => {
    handleStatsSavedImagesButtonClick();
  });
}

if (btnStart) btnStart.addEventListener("click", startGame);
if (btnOptions) btnOptions.addEventListener("click", () => showOptions(false));
if (btnControls) btnControls.addEventListener("click", () => {
  showControlsMenu({ fromHubOptions: isHubOptionsControlsLaunchContext() });
});
if (btnCheats) btnCheats.addEventListener("click", armCheatsUnlockCountdown);
if (btnCheats) btnCheats.addEventListener("keydown", handleCheatsButtonTypedKey);
if (cheatermodeCountdownDisplay){
  cheatermodeCountdownDisplay.addEventListener("click", (event) => {
    const cancelButton = event.target && event.target.closest ? event.target.closest(".cheatermodeCountdownCancel") : null;
    if (!cancelButton) return;
    cancelTypedCheatermodeCountdown(event);
  });
}
if (btnCheatsUnlockInput){
  btnCheatsUnlockInput.addEventListener("click", activateCheatsUnlockInput);
  btnCheatsUnlockInput.addEventListener("focus", focusCheatsUnlockInput);
  btnCheatsUnlockInput.addEventListener("blur", restoreCheatsUnlockPromptIfEmpty);
  btnCheatsUnlockInput.addEventListener("input", submitCheatsUnlockInput);
  btnCheatsUnlockInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter"){
      event.preventDefault();
      submitCheatsUnlockInput();
    }
  });
}
if (cheatermodeUnlockedCheckbox){
  cheatermodeUnlockedCheckbox.addEventListener("change", () => {
    if (!cheatermodeUnlockedCheckbox.checked) refreshEntireShooterPage();
  });
}
if (muteCheckbox){
  muteCheckbox.addEventListener("change", () => {
    setMuteOptionEnabled(!!muteCheckbox.checked);
  });
}
if (fullscreenCheckbox){
  fullscreenCheckbox.addEventListener("change", () => {
    setFullscreenOptionEnabled(!!fullscreenCheckbox.checked);
  });
}
document.addEventListener("fullscreenchange", () => syncFullscreenOptionState());
syncFullscreenOptionState();
function applyCheatsChanges(showAppliedState=false){
  applyStartSettingsFromControls();
  syncStartOptionsLabels();
  syncCheatsMenuState();
  syncScoreTrackingState();
  markCheatsClean(!!showAppliedState);
}

if (btnCheatsBack) btnCheatsBack.addEventListener("click", hideCheats);
btnBack.addEventListener("click", () => {
  if (closeMenuHubHostedPanelToStart(document.getElementById("optionsMenuInner"))) return;
  if (optionsOpenedFromPause && isPaused){
    optionsMenu.style.display = "none";
    if (cheatsMenu) cheatsMenu.style.display = "none";
    uiRoot.classList.remove("optionsBackdrop");
    uiRoot.style.display = "none";
    if (pauseOverlay) pauseOverlay.style.display = "flex";
    optionsOpenedFromPause = false;
    cheatsOpenedFromPause = false;
    gameState = STATE.PLAYING;
    pauseFocusIndex = getPauseOptionsReturnFocusIndex();
    if (activeInputMode === INPUT_MODE_CONTROLLER) syncPauseControllerFocus();
    else clearControllerFocus();
    return;
  }
  optionsOpenedFromPause = false;
  controlsOpenedFromPausedHubOptions = false;
  cheatsOpenedFromPausedHubOptions = false;
  showMenu();
});
function applyStartSettingsFromControls(){
  const livesOpt = parseResourceOption(livesSlider, 0);
  const heartsOpt = parseResourceOption(heartsSlider, 1);
  const shieldsOpt = parseResourceOption(shieldsSlider, 0);
  const bombsOpt = parseResourceOption(bombsSlider, 0);
  START_LIVES = livesOpt.value;
  START_HEARTS = heartsOpt.value;
  START_SHIELDS = shieldsOpt.value;
  START_BOMBS = bombsOpt.value;
  START_LIVES_INFINITE = livesOpt.infinite;
  START_HEARTS_INFINITE = heartsOpt.infinite;
  START_SHIELDS_INFINITE = shieldsOpt.infinite;
  START_BOMBS_INFINITE = bombsOpt.infinite;
  START_WAVE = startWaveSelect ? (parseInt(startWaveSelect.value, 10) || 1) : 1;
  if (stageWaveMenuSelection !== "menu") stageWaveMenuSelection = String(START_WAVE);
  applyGameSpeedValue(getSpeedValueFromSlider(), false);

  // Apply resource changes to the current run too, not just the next start state.
  _applyLives((START_LIVES_INFINITE || INFINITE_MODE) ? 100 : START_LIVES, !!(START_LIVES_INFINITE || INFINITE_MODE));
  _applyHearts((START_HEARTS_INFINITE || INFINITE_MODE) ? 100 : START_HEARTS, !!(START_HEARTS_INFINITE || INFINITE_MODE));
  _applyShields((START_SHIELDS_INFINITE || INFINITE_MODE) ? 100 : START_SHIELDS, !!(START_SHIELDS_INFINITE || INFINITE_MODE));
  _applyBombs((START_BOMBS_INFINITE || INFINITE_MODE) ? 100 : START_BOMBS, !!(START_BOMBS_INFINITE || INFINITE_MODE));

  syncScoreTrackingState();
}

function applyOptionsChanges(){
  syncStartOptionsLabels();
  markOptionsClean(true);
}

btnApply.addEventListener("click", () => {
  if (optionsHavePendingChanges) applyOptionsChanges();
});

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
    if (window.parent && window.parent !== window){
      try{
        if (requestContinueToLevel2()) return;
      }catch(err){
        console.warn("Failed to notify parent iframe host about level transition.", err);
      }
    }

    if (winOverlay) winOverlay.style.display = "none";
    stopWinStatsMarquee({ resetScroll:true });
    window.location.href = "/dead/games/shooter-game/assets/levels/shooter-game-level2.html?autostart=1&startWave=1";
  });
}

if (btnSkipToLevel2){
  btnSkipToLevel2.addEventListener("click", () => {
    if (window.parent && window.parent !== window){
      try{
        if (requestContinueToLevel2()) return;
      }catch(err){
        console.warn("Failed to notify parent iframe host about level transition.", err);
      }
    }

window.location.href = "/dead/games/shooter-game/assets/levels/shooter-game-level2.html?autostart=1&startWave=1";
  });
}


function requestContinueToLevel2(){
  if (!window.parent || window.parent === window) return false;
  window.parent.postMessage({ type: "tektite:continue-to-level2" }, "*");
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

// Active player sprite freeze (v2.03): keep menu/lives/enemy animation behavior intact,
// but render the gameplay player from a one-time canvas snapshot so animated banana assets
// do not keep animating while the player is alive. Browser animation rules: still a circus.
let staticPlayerFrameCanvas = null;
let staticPlayerFrameSource = "";

function getStaticPlayerFrame(){
  if (!playerImg || !playerImg.complete || !playerImg.naturalWidth || !playerImg.naturalHeight) return playerImg;
  if (staticPlayerFrameCanvas && staticPlayerFrameSource === playerImg.currentSrc) return staticPlayerFrameCanvas;

  const frozen = document.createElement("canvas");
  frozen.width = playerImg.naturalWidth;
  frozen.height = playerImg.naturalHeight;
  const frozenCtx = frozen.getContext("2d");
  if (!frozenCtx) return playerImg;

  frozenCtx.drawImage(playerImg, 0, 0, frozen.width, frozen.height);
  staticPlayerFrameCanvas = frozen;
  staticPlayerFrameSource = playerImg.currentSrc;
  return staticPlayerFrameCanvas;
}

function drawStaticPlayerSprite(alpha = 1, xOff = 0, yOff = 0, extraWidthScale = 1, extraScaleY = 1){
  const source = getStaticPlayerFrame();
  if (!source) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(player.x + xOff, player.y + yOff);

  applySpiralPlayerDrawFx();

  // Fake 2.5D turn by squeezing through a narrow midpoint during left/right flips.
  const turnEase = Math.sin(Math.min(1, Math.max(0, playerTurnT)) * Math.PI);
  const widthScale = (1 - turnEase * 0.82) * extraWidthScale;
  const facingScale = playerFacing >= 0 ? -1 : 1; // right = flipped horizontally

  ctx.scale(facingScale * Math.max(0.12, widthScale), extraScaleY);
  ctx.drawImage(source, -player.w/2, -player.h/2, player.w, player.h);
  ctx.restore();
}

function redrawPlayerSpriteAfterVideoFx(){
  if (!(isPausedGameplayMenuBackdropState())) return;
  if (isDead || gameWon) return;
  const flicker = player.invuln > 0 && Math.floor(time * 20) % 2 === 0;
  if (flicker) return;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  drawStaticPlayerSprite();
  ctx.restore();
}

function drawPlayerGhosts(){
  if (!playerGhosts.length) return;
  for (const g of playerGhosts){
    const t = Math.max(0, g.life / g.ttl);
    drawStaticPlayerSprite(0.12 * t, g.xOff, g.yOff, g.widthScale, g.scaleY);
  }
}

// Animated GIF sprites are rendered as real DOM <img> elements positioned over the canvas.
// drawImage() can freeze animated GIFs on a single frame in Chromium, because naturally the browser chose drama.
const USE_DOM_ANIMATED_GIF_SPRITES = true;
const animatedGifSpriteLayer = (() => {
  let layer = document.getElementById("animatedGifSpriteLayer");
  if (!layer){
    layer = document.createElement("div");
    layer.id = "animatedGifSpriteLayer";
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "width:100vw",
      "height:100vh",
      "pointer-events:none",
      "overflow:hidden",
      "z-index:12"
    ].join(";");
    const attach = () => { if (!layer.parentNode && document.body) document.body.appendChild(layer); };
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach, { once:true });
  }
  return layer;
})();

const animatedGifSpriteMap = new WeakMap();
const animatedGifSprites = new Set();
let animatedGifSpritesActiveThisFrame = new Set();

function beginAnimatedGifSpriteFrame(){
  animatedGifSpritesActiveThisFrame = new Set();
}

function getAnimatedGifSprite(owner, img, className){
  if (!owner || !img || !img.src || !USE_DOM_ANIMATED_GIF_SPRITES) return null;
  let sprite = animatedGifSpriteMap.get(owner);
  if (!sprite){
    sprite = document.createElement("img");
    sprite.decoding = "async";
    sprite.loading = "eager";
    sprite.alt = "";
    sprite.className = "animated-gif-sprite " + (className || "");
    sprite.draggable = false;
    sprite.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "pointer-events:none",
      "user-select:none",
      "image-rendering:auto",
      "transform-origin:center center",
      "will-change:transform,width,height,opacity,filter"
    ].join(";");
    animatedGifSpriteMap.set(owner, sprite);
    animatedGifSprites.add(sprite);
    animatedGifSpriteLayer.appendChild(sprite);
  }
  const shouldFreezeSprite = isGameSpeedFrozen() && className && String(className).includes("enemy");
  if (shouldFreezeSprite){
    const frozenUrl = getFrozenStaticImageUrlFromImage(img);
    if (frozenUrl && sprite.src !== frozenUrl) sprite.src = frozenUrl;
  } else if (sprite.src !== img.src) {
    sprite.src = img.src;
  }
  return sprite;
}

function syncAnimatedGifSprite(owner, img, x, y, w, h, opts = {}){
  const sprite = getAnimatedGifSprite(owner, img, opts.className);
  if (!sprite) return false;
  const alpha = Number.isFinite(opts.alpha) ? Math.max(0, Math.min(1, opts.alpha)) : 1;
  const hidden = !!opts.hidden || alpha <= 0;
  sprite.style.display = hidden ? "none" : "block";
  if (!hidden){
    sprite.style.width = Math.max(1, w) + "px";
    sprite.style.height = Math.max(1, h) + "px";
    sprite.style.opacity = String(alpha);
    sprite.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;

    const filters = [];
    const allowVideoFx = opts.videoFx !== false;
    if (VIDEO_FX_ENABLED && allowVideoFx){
      const beat = Math.max(0, Math.min(1, beatLevel || 0));
      const hue = (time * 10 + beat * 55) % 360;
      const glow = 1.05 + beat * 0.18;
      filters.push(`hue-rotate(${hue}deg)`, `saturate(${1.28 + beat * 0.25})`, `contrast(${glow})`, `drop-shadow(0 0 ${Math.round(4 + beat * 8)}px rgba(0,255,102,0.32))`);
    }
    if (opts.hitFlash){
      filters.push("brightness(1.7)", "sepia(1)", "saturate(5)", "hue-rotate(300deg)");
    }
    sprite.style.filter = filters.length ? filters.join(" ") : "none";
  }
  animatedGifSpritesActiveThisFrame.add(sprite);
  return true;
}

function hideAnimatedGifSprite(owner){
  const sprite = animatedGifSpriteMap.get(owner);
  if (sprite) sprite.style.display = "none";
}

function endAnimatedGifSpriteFrame(){
  for (const sprite of animatedGifSprites){
    if (!animatedGifSpritesActiveThisFrame.has(sprite)) sprite.style.display = "none";
  }
}

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

const ENEMY_PERSPECTIVE_FAR_SCALE = 0.86;
const ENEMY_PERSPECTIVE_NEAR_SCALE = 1.7;
const ENEMY_PERSPECTIVE_TOP_PAD = 72;
const ENEMY_PERSPECTIVE_PLAYER_BUFFER = 34;

function getEnemyPerspectiveScale(enemy){
  if (!enemy || gameState !== STATE.PLAYING || playerSpectatorMode) return 1;
  const enemyY = Number(enemy.y);
  const playerY = Number(player.y);
  if (!Number.isFinite(enemyY) || !Number.isFinite(playerY)) return 1;

  const topY = Math.max(0, ENEMY_PERSPECTIVE_TOP_PAD);
  const nearY = Math.max(
    topY + 1,
    playerY - Math.max(ENEMY_PERSPECTIVE_PLAYER_BUFFER, (player.h || PLAYER_SIZE) * 0.55)
  );
  const depthT = Math.max(0, Math.min(1, (enemyY - topY) / Math.max(1, nearY - topY)));
  const easedDepth = depthT * depthT * (3 - 2 * depthT);
  return ENEMY_PERSPECTIVE_FAR_SCALE + (ENEMY_PERSPECTIVE_NEAR_SCALE - ENEMY_PERSPECTIVE_FAR_SCALE) * easedDepth;
}

// v2.07: Level 1 player turn + ghost trail.
// Level 1 only moves left/right, so this intentionally ignores vertical movement.
let playerFacing = -1; // -1 = facing left/default, 1 = facing right
let playerTurnT = 1;   // 0..1 progress through the current turn
const PLAYER_TURN_DUR = 0.16;
const SPIRAL_PLAYER_SPIN_TURNS = 3;

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

function spawnPlayerGhost(moveX){
  if (Math.abs(moveX || 0) < 0.08) return;
  const nx = moveX > 0 ? 1 : -1;
  const behindDist = rand(player.w * 0.62, player.w * 1.02);

  playerGhosts.push({
    xOff: -nx * behindDist,
    yOff: rand(-player.h * 0.035, player.h * 0.035),
    vxPull: nx,
    ttl: PLAYER_GHOST_TTL,
    life: PLAYER_GHOST_TTL,
    scaleY: rand(0.97, 1.03),
    widthScale: rand(0.88, 0.97)
  });

  while (playerGhosts.length > PLAYER_GHOST_MAX) playerGhosts.shift();
}

function updatePlayerGhosts(dt){
  for (let i = playerGhosts.length - 1; i >= 0; i--){
    const g = playerGhosts[i];
    g.life -= dt;
    const pull = Math.min(1, dt * 8.0);

    g.xOff += (0 - g.xOff) * pull;
    g.yOff += (0 - g.yOff) * pull;
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
        - Options: changes apply immediately; B = Back
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

function syncGpPrevButtons(gp){
  if (!gp || !gp.buttons || !gpPrev) return;
  for (let i = 0; i < gp.buttons.length; i++){
    gpPrev[i] = !!(gp.buttons[i] && gp.buttons[i].pressed);
  }
}

function consumeMenuAxis(direction, active, dt, repeatDelay = GP_MENU_REPEAT_DELAY, repeatRate = GP_MENU_REPEAT_RATE){
  const repeatKey = direction;
  if (!active){
    gpNavRepeat[repeatKey] = 0;
    return false;
  }
  const currentRepeat = Number(gpNavRepeat[repeatKey]) || 0;
  if (currentRepeat <= 0){
    gpNavRepeat[repeatKey] = repeatDelay;
    return true;
  }
  gpNavRepeat[repeatKey] = currentRepeat - dt;
  if (gpNavRepeat[repeatKey] <= 0){
    gpNavRepeat[repeatKey] = repeatRate;
    return true;
  }
  return false;
}

function isCheatermodeControllerHoldEligible(){
  if (cheatsUnlockedByPassphrase) return false;
  if (parentChatVisible && parentChatValuePickerActive && parentChatValuePickerCommand === "/cheatermode") return true;
  if (cheatsUnlockInputReady) return true;
  if (isCheatermodeOptionsContextOpen()){
    const optionsTarget = getOptionsControllerTargets()[optionsFocusIndex];
    if (optionsTarget === btnCheats || optionsTarget === btnCheatsUnlockInput) return true;
  }
  return false;
}

function updateCheatermodeControllerHold(dt, holdingCombo, xPressed, viewPressed){
  const eligibleForHold = isCheatermodeControllerHoldEligible();
  const comboKey = String(!!xPressed) + ':' + String(!!viewPressed) + ':' + String(!!holdingCombo) + ':' + String(!!eligibleForHold);
  if (!holdingCombo || !eligibleForHold){
    if (eligibleForHold && (cheatermodeControllerHoldMs > 0 || cheatermodeLastControllerComboKey !== comboKey)){
      notifyCheatermodeControllerHoldState(false, Math.ceil(CHEATERMODE_CONTROLLER_HOLD_MS / 1000), xPressed, viewPressed);
      cheatermodeLastControllerComboKey = comboKey;
    } else if (!eligibleForHold) {
      cheatermodeLastControllerComboKey = '';
    }
    cheatermodeControllerHoldMs = 0;
    if (btnCheatsUnlockInput && btnCheatsUnlockInput.style.display !== "none" && activeInputMode === INPUT_MODE_CONTROLLER){
      setCheatsUnlockInputPrompt();
    }
    if (btnCheats && !cheatsUnlockedByPassphrase && !cheatsUnlockTimer && btnCheats.style.display !== "none"){
      if (eligibleForHold && activeInputMode === INPUT_MODE_CONTROLLER && isCheatermodeOptionsContextOpen() && isOptionsCheatsButtonFocused()){
        renderCheatermodeControllerComboLabel(btnCheats, { remaining: Math.ceil(CHEATERMODE_CONTROLLER_HOLD_MS / 1000), xPressed, viewPressed, unlocked: false });
      } else if (!isCheatermodeOptionsContextOpen() || !isOptionsCheatsButtonFocused()) {
        clearCheatermodeControllerComboLabel(btnCheats, "Cheats");
      }
    }
    return false;
  }
  cheatermodeLastControllerComboKey = comboKey;
  cheatermodeControllerHoldMs = Math.min(CHEATERMODE_CONTROLLER_HOLD_MS, cheatermodeControllerHoldMs + Math.max(0, Number(dt) || 0) * 1000);
  const remaining = Math.max(1, Math.ceil((CHEATERMODE_CONTROLLER_HOLD_MS - cheatermodeControllerHoldMs) / 1000));
  const holdText = formatCheatermodeControllerHoldText(remaining);
  if (btnCheatsUnlockInput && btnCheatsUnlockInput.style.display !== "none"){
    btnCheatsUnlockInput.readOnly = true;
    btnCheatsUnlockInput.value = holdText;
  }
  if (btnCheats && isCheatermodeOptionsContextOpen() && isOptionsCheatsButtonFocused()){
    renderCheatermodeControllerComboLabel(btnCheats, { remaining, xPressed, viewPressed, unlocked: false });
  }
  notifyCheatermodeControllerHoldState(true, remaining, xPressed, viewPressed);
  if (cheatermodeControllerHoldMs >= CHEATERMODE_CONTROLLER_HOLD_MS){
    unlockCheatermode("controller-hold");
    cheatermodeLastControllerComboKey = "";
    notifyCheatermodeControllerHoldState(false, 0, xPressed, viewPressed);
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
    cheatermodeControllerHoldMs = 0;
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
  const cheatermodeControllerHoldIntent = !cheatsUnlockedByPassphrase && x && back && isCheatermodeControllerHoldEligible();
  const cheatermodeUnlockedByHold = updateCheatermodeControllerHold(dt, cheatermodeControllerHoldIntent, x, back);

  if ((gpHasAnyInput || pressMenuSelect || pressMenuBack || pressCommands || pressY || pressScreenshotCombo || pressPause || pressFullscreen || pressBomb || pressListTop || pressListBottom) && !audioUnlocked){
    unlockAudioOnce();
  }

  if (pressScreenshotCombo){
    if (!requestParentPageScreenshot("Level 1")){
      saveCurrentGameImage("Level 1");
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
  const rNavLeft = consumeMenuAxis('rLeft', rx < -GP_MENU_AXIS_THRESHOLD, dt, GP_OPTION_REPEAT_DELAY, GP_OPTION_REPEAT_RATE);
  const rNavRight = consumeMenuAxis('rRight', rx > GP_MENU_AXIS_THRESHOLD, dt, GP_OPTION_REPEAT_DELAY, GP_OPTION_REPEAT_RATE);

  if (updateControlsPreviewControllerTakeover(dt, lStick, rStick, pressMenuSelect, pressMenuBack, pressPause, navUp, navDown)){
    syncGpPrevButtons(gp);
    return;
  }

  if (deathOverlay && deathOverlay.style.display === "flex"){
    if (navUp) moveDeathControllerFocus(-1);
    if (navDown) moveDeathControllerFocus(1);
    if (pressMenuSelect) activateDeathControllerFocus();
    // B/back intentionally does nothing on the death screen to avoid accidental menu quits.
    syncGpPrevButtons(gp);
    return;
  }

  if (isStatsPanelOpen()){
    if (savedImageViewerOpen){
      if (navLeft || navUp) moveStatsSavedImageViewerButtonFocus(-1);
      if (navRight || navDown) moveStatsSavedImageViewerButtonFocus(1);
      if (rNavLeft) moveStatsSavedImageViewerImage(-1);
      if (rNavRight) moveStatsSavedImageViewerImage(1);
      if (pressMenuSelect) activateControllerTarget(getStatsSavedImageViewerTargets()[savedImageViewerFocusIndex]);
      if (pressMenuBack || pressPause) closeStatsSavedImageViewer();
      syncGpPrevButtons(gp);
      return;
    }
    if (pressListTop) jumpControllerFocusToListEdge(getStatsControllerTargets(), statsFocusIndex, (index) => { statsFocusIndex = index; }, syncStatsControllerFocus, -1);
    if (pressListBottom) jumpControllerFocusToListEdge(getStatsControllerTargets(), statsFocusIndex, (index) => { statsFocusIndex = index; }, syncStatsControllerFocus, 1);
    if (navUp) moveStatsControllerFocusDirectional("up");
    if (navDown) moveStatsControllerFocusDirectional("down");
    if (navLeft) moveStatsControllerFocusDirectional("left");
    if (navRight) moveStatsControllerFocusDirectional("right");
    if (rNavUp) scrollStatsPanelBy(-72);
    if (rNavDown) scrollStatsPanelBy(72);
    if (pressMenuSelect) activateControllerTarget(getStatsControllerTargets()[statsFocusIndex]);
    if (pressMenuBack) handleStatsControllerBackButton();
    if (pressPause) closeStatsPanel();
    syncGpPrevButtons(gp);
    return;
  }

  if (isImagesPanelOpen()){
    if (pressListTop) jumpControllerFocusToListEdge(getImagesControllerTargets(), imagesFocusIndex, (index) => { imagesFocusIndex = index; }, syncImagesControllerFocus, -1);
    if (pressListBottom) jumpControllerFocusToListEdge(getImagesControllerTargets(), imagesFocusIndex, (index) => { imagesFocusIndex = index; }, syncImagesControllerFocus, 1);
    if (navLeft || navUp) moveImagesControllerFocus(-1);
    if (navRight || navDown) moveImagesControllerFocus(1);
    if (rNavUp && imagesList) imagesList.scrollBy({ top:-72, behavior:"smooth" });
    if (rNavDown && imagesList) imagesList.scrollBy({ top:72, behavior:"smooth" });
    if (pressMenuSelect) activateControllerTarget(getImagesControllerTargets()[imagesFocusIndex]);
    if (pressMenuBack) handleImagesControllerBackButton();
    if (pressPause) closeImagesPanel();
    syncGpPrevButtons(gp);
    return;
  }

  // Options menu: right stick changes number values without dragging focus around like a caffeinated raccoon.
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
    const optionsCheatsButtonFocused = isCheatermodeOptionsContextOpen() && isOptionsCheatsButtonFocused();
    if (pressCommands && !viewSuppressedByY && !optionsCheatsButtonFocused && !cheatermodeControllerHoldIntent && !cheatermodeUnlockedByHold){
      requestOpenChat(false, "/help");
      clearControllerFocus();
    }
    const chatOwnsControllerInput = parentChatVisible || (pressCommands && !viewSuppressedByY);
    if (chatOwnsControllerInput){
      if (parentChatVisible){
        if (chatNavUp) postChatControllerAction('cycleUp');
        if (chatNavDown) postChatControllerAction('cycleDown');
        if (chatNavLeft) postChatControllerAction('cycleLeft');
        if (chatNavRight) postChatControllerAction('cycleRight');
        if (rNavUp) postChatControllerAction('scrollUp');
        if (rNavDown) postChatControllerAction('scrollDown');
        if (pressMenuSelect) postChatControllerAction('execute');
        if (pressMenuBack && !cheatermodeControllerHoldIntent){
          postChatControllerAction('close');
        }
      }
    } else if (isPauseCheatsOpen()){
      if (pressListTop) jumpControllerFocusToListEdge(getCheatsControllerTargets(), cheatsFocusIndex, (index) => { cheatsFocusIndex = index; }, syncCheatsControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getCheatsControllerTargets(), cheatsFocusIndex, (index) => { cheatsFocusIndex = index; }, syncCheatsControllerFocus, 1);
      if (navUp) moveCheatsControllerFocus(-1);
      if (navDown) moveCheatsControllerFocus(1);
      if (typeof isStartingStatFocused === "function" && isStartingStatFocused()){
        if (navLeft) moveStartingStatFocus(-1);
        if (navRight) moveStartingStatFocus(1);
        if (rNavUp) scrollCheatsPanelBy(-72);
        if (rNavDown) scrollCheatsPanelBy(72);
      } else {
        if (navLeft) adjustControllerCheat(-1);
        if (navRight) adjustControllerCheat(1);
        if (rNavUp) scrollCheatsPanelBy(-72);
        if (rNavDown) scrollCheatsPanelBy(72);
      }
      if (pressMenuSelect) activateControllerTarget(getCheatsControllerTargets()[cheatsFocusIndex]);
      if (pressMenuBack) handleCheatsControllerBackButton();
      if (pressPause) hideCheats();
    } else if (isPauseOptionsOpen()){
      if (pressListTop) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, 1);
      if (navUp) moveOptionsControllerFocus(-1);
      if (navDown){
        if (!wrapOptionsBottomButtonsToTop()) moveOptionsControllerFocus(1);
      }
      if (typeof isStartingStatFocused === "function" && isStartingStatFocused()){
        if (navLeft) moveStartingStatFocus(-1);
        if (navRight) moveStartingStatFocus(1);
        if (rNavUp) scrollOptionsPanelBy(-72);
        if (rNavDown) scrollOptionsPanelBy(72);
      } else {
        if (navLeft && !moveOptionsBottomButtonsHorizontally(-1)) adjustControllerOption(-1);
        if (navRight && !moveOptionsBottomButtonsHorizontally(1)) adjustControllerOption(1);
        if (rNavUp) scrollOptionsPanelBy(-72);
        if (rNavDown) scrollOptionsPanelBy(72);
      }
      if (pressMenuSelect) activateControllerTarget(getOptionsControllerTargets()[optionsFocusIndex]);
      if (pressMenuBack) handleOptionsControllerBackButton();
      if (pressPause) activateControllerTarget(btnBack);
    } else if (gameState === STATE.HUB){
      // v2.XX: Handle Menu Hub before the generic paused branch.
      // When the Hub is opened from Pause, isPaused stays true by design,
      // so the old order routed controller input back into the hidden Pause menu.
      if (menuHubActiveTab === "images" && menuHubImagesContentFocused){
        const imageItems = getImagesControllerTargets();
        if (pressListTop) returnMenuHubImagesFocusToTab();
        if (pressListBottom){ imagesFocusIndex = Math.max(0, imageItems.indexOf(btnImagesClose)); syncImagesControllerFocus(); }
        if (navUp) moveImagesControllerFocusDirectional("up");
        if (navDown) moveImagesControllerFocusDirectional("down");
        if (navLeft || rNavLeft) moveImagesControllerFocusDirectional("left");
        if (navRight || rNavRight) moveImagesControllerFocusDirectional("right");
        if (rNavUp && imagesList) imagesList.scrollBy({ top:-72, behavior:"smooth" });
        if (rNavDown && imagesList) imagesList.scrollBy({ top:72, behavior:"smooth" });
        if (pressMenuSelect) activateControllerTarget(getImagesControllerTargets()[imagesFocusIndex]);
        if (pressMenuBack) returnMenuHubImagesFocusToTab();
      } else if (menuHubActiveTab === "stats" && menuHubStatsContentFocused){
        const statsItems = getStatsControllerTargets();
        if (pressListTop) returnMenuHubStatsFocusToTab();
        if (pressListBottom){ statsFocusIndex = Math.max(0, statsItems.indexOf(btnStatsClose)); syncStatsControllerFocus(); }
        if (navUp) moveStatsControllerFocus(-1);
        if (navDown) moveStatsControllerFocus(1);
        if (navLeft) moveStatsControllerFocusDirectional("left");
        if (navRight) moveStatsControllerFocusDirectional("right");
        if (rNavUp) scrollStatsPanelBy(-72);
        if (rNavDown) scrollStatsPanelBy(72);
        if (pressMenuSelect) activateControllerTarget(getStatsControllerTargets()[statsFocusIndex]);
        if (pressMenuBack) returnMenuHubStatsFocusToTab();
      } else if (menuHubActiveTab === "options" && menuHubOptionsContentFocused){
        if (pressListTop) returnMenuHubOptionsFocusToTab();
        if (pressListBottom) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, 1);
        if (navUp) moveOptionsControllerFocus(-1);
        if (navDown){
          if (!wrapOptionsBottomButtonsToTop()) moveOptionsControllerFocus(1);
        }
        if (typeof isStartingStatFocused === "function" && isStartingStatFocused()){
          if (navLeft) moveStartingStatFocus(-1);
          if (navRight) moveStartingStatFocus(1);
          if (rNavUp) scrollOptionsPanelBy(-72);
          if (rNavDown) scrollOptionsPanelBy(72);
        } else {
          if (navLeft && !moveOptionsBottomButtonsHorizontally(-1)) adjustControllerOption(-1);
          if (navRight && !moveOptionsBottomButtonsHorizontally(1)) adjustControllerOption(1);
          if (rNavUp) scrollOptionsPanelBy(-72);
          if (rNavDown) scrollOptionsPanelBy(72);
        }
        if (pressMenuSelect) activateControllerTarget(getOptionsControllerTargets()[optionsFocusIndex]);
        if (pressMenuBack) returnMenuHubOptionsFocusToTab();
      } else {
        if (pressListTop) moveMenuHubControllerFocus(-1);
        if (pressListBottom) moveMenuHubControllerFocus(1);
        if (navLeft || rNavLeft) moveMenuHubControllerFocusDirectional("left");
        if (navRight || rNavRight) moveMenuHubControllerFocusDirectional("right");
        if (navDown || rNavDown) moveMenuHubControllerFocusDirectional("down");
        if (pressMenuSelect) selectMenuHubTab(getMenuHubTabForButton(getMenuHubControllerTargets()[menuHubFocusIndex]), true);
        if (pressMenuBack) closeMenuHub();
      }
    } else if (gameState === STATE.CHEATS && cheatsOpenedFromPausedHubOptions && isPaused){
      // v13.06: Cheats opened from Pause -> Hub -> Options is still a paused
      // gameplay child panel. Route controller input to Cheats instead of the
      // hidden Pause menu, because apparently menus enjoy identity theft.
      if (pressListTop) jumpControllerFocusToListEdge(getCheatsControllerTargets(), cheatsFocusIndex, (index) => { cheatsFocusIndex = index; }, syncCheatsControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getCheatsControllerTargets(), cheatsFocusIndex, (index) => { cheatsFocusIndex = index; }, syncCheatsControllerFocus, 1);
      if (navUp) moveCheatsControllerFocus(-1);
      if (navDown) moveCheatsControllerFocus(1);
      if (typeof isStartingStatFocused === "function" && isStartingStatFocused()){
        if (navLeft) moveStartingStatFocus(-1);
        if (navRight) moveStartingStatFocus(1);
        if (rNavUp) scrollCheatsPanelBy(-72);
        if (rNavDown) scrollCheatsPanelBy(72);
      } else {
        if (navLeft) adjustControllerCheat(-1);
        if (navRight) adjustControllerCheat(1);
        if (rNavUp) scrollCheatsPanelBy(-72);
        if (rNavDown) scrollCheatsPanelBy(72);
      }
      if (pressMenuSelect) activateControllerTarget(getCheatsControllerTargets()[cheatsFocusIndex]);
      if (pressMenuBack) handleCheatsControllerBackButton();
      if (pressPause) hideCheats();
    } else if (gameState === STATE.CONTROLS && controlsOpenedFromPausedHubOptions && isPaused){
      // v13.06: Controls opened from Pause -> Hub -> Options must keep its own
      // controller navigation even though isPaused remains true behind it.
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
      if (rNavUp) scrollControlsPanelBy(-72);
      if (rNavDown) scrollControlsPanelBy(72);
      if (pressMenuSelect) activateControllerTarget(getControlsControllerTargets()[controlsFocusIndex]);
      if (pressMenuBack){
        if (bindingEditState) cancelBindingEdit();
        else handleControlsControllerBackButton();
      }
      if (pressPause) hideControlsMenu();
    } else if (isPaused){
      if (isScoreStoreOpen){
        if (pressListTop) jumpControllerFocusToListEdge(getScoreStoreControllerTargets(), scoreStoreFocusIndex, (index) => { scoreStoreFocusIndex = index; }, syncScoreStoreControllerFocus, -1);
        if (pressListBottom) jumpControllerFocusToListEdge(getScoreStoreControllerTargets(), scoreStoreFocusIndex, (index) => { scoreStoreFocusIndex = index; }, syncScoreStoreControllerFocus, 1);
        if (navLeft) moveScoreStoreControllerFocusGrid(-1);
        if (navRight) moveScoreStoreControllerFocusGrid(1);
        if (navUp) moveScoreStoreControllerFocusGrid(-SCORE_STORE_GRID_COLUMNS);
        if (navDown) moveScoreStoreControllerFocusGrid(SCORE_STORE_GRID_COLUMNS);
        if (pressMenuSelect) activateControllerTarget(getScoreStoreControllerTargets()[scoreStoreFocusIndex]);
        if (pressMenuBack) handleScoreStoreControllerBackButton();
        if (pressPause) togglePause();
      } else if (pauseControlsOpen){
        if (pressListTop) jumpControllerFocusToListEdge(getControlsControllerTargets(), controlsFocusIndex, (index) => { controlsFocusIndex = index; }, syncControlsControllerFocus, -1);
        if (pressListBottom) jumpControllerFocusToListEdge(getControlsControllerTargets(), controlsFocusIndex, (index) => { controlsFocusIndex = index; }, syncControlsControllerFocus, 1);
        if (navUp || navLeft) moveControlsControllerFocus(-1);
        if (navDown || navRight) moveControlsControllerFocus(1);
        if (rNavUp) scrollControlsPanelBy(-72);
        if (rNavDown) scrollControlsPanelBy(72);
        if (pressMenuSelect) activateControllerTarget(getControlsControllerTargets()[controlsFocusIndex]);
        if (pressMenuBack){
          if (bindingEditState) cancelBindingEdit();
          else handleControlsControllerBackButton();
        }
        if (pressPause) togglePause();
      } else {
        if (pressListTop) jumpControllerFocusToListEdge(getPauseControllerTargets(), pauseFocusIndex, (index) => { pauseFocusIndex = index; }, syncPauseControllerFocus, -1);
        if (pressListBottom) jumpControllerFocusToListEdge(getPauseControllerTargets(), pauseFocusIndex, (index) => { pauseFocusIndex = index; }, syncPauseControllerFocus, 1);
        const pauseTargets = getPauseControllerTargets();
        const pauseTarget = pauseTargets[pauseFocusIndex];
        const helpRowFocused = !!(pauseTarget && pauseTarget.dataset && pauseTarget.dataset.cmd);
        if (helpRowFocused){
          if (navLeft && typeof updatePauseHelpCommandNode === "function") updatePauseHelpCommandNode(pauseTarget, -1);
          if (navRight && typeof updatePauseHelpCommandNode === "function") updatePauseHelpCommandNode(pauseTarget, 1);
          if (navUp) movePauseControllerFocus(-1);
          if (navDown) movePauseControllerFocus(1);
        } else {
          if (navUp || navLeft) movePauseControllerFocus(-1);
          if (navDown || navRight) movePauseControllerFocus(1);
        }
        if (pressMenuSelect) activateControllerTarget(getPauseControllerTargets()[pauseFocusIndex]);
        if (pressMenuBack) togglePause();
        if (pressPause) togglePause();
      }
    } else if (gameState === STATE.MENU){
      if (pressPause){
        const menuItems = getMenuControllerTargets();
        const menuButtonIndex = menuItems.indexOf(btnMenu);
        const menuTarget = menuItems[menuFocusIndex];
        if (menuButtonIndex !== -1 && menuTarget !== btnMenu){
          menuFocusIndex = menuButtonIndex;
          if (activeInputMode === INPUT_MODE_CONTROLLER) syncMenuControllerFocus();
          else clearControllerFocus();
        } else if (menuTarget === btnMenu){
          activateControllerTarget(btnMenu);
        }
      }
      if (navLeft || rNavLeft){
        moveMenuControllerFocusDirectional("left");
      }
      if (navRight || rNavRight){
        moveMenuControllerFocusDirectional("right");
      }
      if (navDown || rNavDown){
        moveMenuControllerFocusDirectional("down");
      }
      if (navUp || rNavUp){
        moveMenuControllerFocusDirectional("up");
      }
      const menuTarget = getMenuControllerTargets()[menuFocusIndex];
      if (pressMenuSelect && menuTarget){
        if (menuTarget === titleHoverReveal) refreshEntireShooterPage();
        else if (menuTarget !== startMenuTitle) activateControllerTarget(menuTarget);
      }
      if (pressMenuBack && bindingEditState) cancelBindingEdit();
    } else if (gameState === STATE.OPTIONS){
      if (pressListTop) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getOptionsControllerTargets(), optionsFocusIndex, (index) => { optionsFocusIndex = index; }, syncOptionsControllerFocus, 1);
      if (navUp) moveOptionsControllerFocus(-1);
      if (navDown){
        if (!wrapOptionsBottomButtonsToTop()) moveOptionsControllerFocus(1);
      }
      if (typeof isStartingStatFocused === "function" && isStartingStatFocused()){
        if (navLeft) moveStartingStatFocus(-1);
        if (navRight) moveStartingStatFocus(1);
        if (rNavUp) scrollOptionsPanelBy(-72);
        if (rNavDown) scrollOptionsPanelBy(72);
      } else {
        if (navLeft && !moveOptionsBottomButtonsHorizontally(-1)) adjustControllerOption(-1);
        if (navRight && !moveOptionsBottomButtonsHorizontally(1)) adjustControllerOption(1);
        if (rNavUp) scrollOptionsPanelBy(-72);
        if (rNavDown) scrollOptionsPanelBy(72);
      }
      if (pressMenuSelect) activateControllerTarget(getOptionsControllerTargets()[optionsFocusIndex]);
      if (pressMenuBack) handleOptionsControllerBackButton();
    } else if (gameState === STATE.CHEATS){
      if (pressListTop) jumpControllerFocusToListEdge(getCheatsControllerTargets(), cheatsFocusIndex, (index) => { cheatsFocusIndex = index; }, syncCheatsControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getCheatsControllerTargets(), cheatsFocusIndex, (index) => { cheatsFocusIndex = index; }, syncCheatsControllerFocus, 1);
      if (navUp) moveCheatsControllerFocus(-1);
      if (navDown) moveCheatsControllerFocus(1);
      if (typeof isStartingStatFocused === "function" && isStartingStatFocused()){
        if (navLeft) moveStartingStatFocus(-1);
        if (navRight) moveStartingStatFocus(1);
        if (rNavUp) scrollCheatsPanelBy(-72);
        if (rNavDown) scrollCheatsPanelBy(72);
      } else {
        if (navLeft) adjustControllerCheat(-1);
        if (navRight) adjustControllerCheat(1);
        if (rNavUp) scrollCheatsPanelBy(-72);
        if (rNavDown) scrollCheatsPanelBy(72);
      }
      if (pressMenuSelect) activateControllerTarget(getCheatsControllerTargets()[cheatsFocusIndex]);
      if (pressMenuBack) handleCheatsControllerBackButton();
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
    } else if (gameState === STATE.WIN){
      if (activeInputMode === INPUT_MODE_CONTROLLER) syncWinControllerFocus();
      if (pressListTop) jumpControllerFocusToListEdge(getWinControllerTargets(), winFocusIndex, (index) => { winFocusIndex = index; }, syncWinControllerFocus, -1);
      if (pressListBottom) jumpControllerFocusToListEdge(getWinControllerTargets(), winFocusIndex, (index) => { winFocusIndex = index; }, syncWinControllerFocus, 1);
      if (navUp || navLeft) moveWinControllerFocus(-1);
      if (navDown || navRight) moveWinControllerFocus(1);
      if (rNavUp) scrollWinPanelBy(-72);
      if (rNavDown) scrollWinPanelBy(72);
      const winTarget = getWinControllerTargets()[winFocusIndex];
      if (pressPause){
        if (winTarget === btnContinue) activateControllerTarget(btnContinue);
        else jumpWinControllerFocusToBottom();
      }
      if (pressMenuSelect) activateControllerTarget(winTarget);
      if (pressMenuBack) activateControllerTarget(btnContinue || getWinControllerTargets()[winFocusIndex]);
    } else if (deathOverlay && deathOverlay.style.display === "flex"){
      if (pressMenuSelect) restartRun();
    } else if (gameState === STATE.PLAYING){
      if (pressPause) togglePause();
      if (!isGameSpeedFrozen() && !playerSpectatorMode && pressBomb) dropBomb();
    }
  }

  syncGpPrevButtons(gp);
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
  try{
    const res = await fetch(ENEMY_WEBP_INDEX_URL, { cache: "no-store" });
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
    if (typeof setupStartMenuEnemyPreview === "function") setupStartMenuEnemyPreview();
    setAssetStatus("");
  }catch(err){
    console.warn("Failed to load enemy-webps.json enemy list:", err);
    setAssetStatus("Enemy WebPs failed to load. Using fallback enemy image.");
    let imgs = await preloadImages(FALLBACK_URLS);
    enemyImages = imgs.filter(img => img && img.naturalWidth > 0);
    assetsReady = true;
    if (typeof setupStartMenuEnemyPreview === "function") setupStartMenuEnemyPreview();
    setAssetStatus("");
  }
}
loadEnemyImagesFromEnemyWebpsJson();

/* =======================
   Enemies + Formation Movement
======================= */
const BASE_SPACING_X = 105;

let enemies = [];

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
  totalEnemiesSpawned += 1;

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
    totalEnemiesSpawned += 1;
  }

  // Restore formation settings if we were additive.
  if (additive){
    formationCols = prevCols;
    formationRows = prevRows;
    // ensure we're still writing into the live enemies array reference
    enemies = prevEnemies;
  }
}


function positionStartMenuPreviewEnemies(){
  if (!enemies || !enemies.length) return;

  const breath = 0.5;
  const spacingX = getSpacingX() * (1 + breath * 0.25);
  const spacingY = getSpacingY() * (1 + breath * 0.15);
  const formationWidth = (formationCols - 1) * spacingX;
  const formationHeight = (formationRows - 1) * spacingY;
  const startX = canvas.width / 2 - formationWidth / 2 + formation.xOffset;

  const TOP_SAFE_MARGIN = 60;
  const ENEMY_ZONE_MAX_Y = canvas.height * 0.48;
  let baseY = 80 + formation.yOffset;

  if (baseY < TOP_SAFE_MARGIN) baseY = TOP_SAFE_MARGIN;

  const maxBaseY = ENEMY_ZONE_MAX_Y - formationHeight;
  if (baseY > maxBaseY){
    baseY = Math.max(TOP_SAFE_MARGIN, maxBaseY);
  }

  for (const e of enemies){
    if (!e) continue;
    const size = e.size;
    e.fx = startX + e.col * spacingX;
    e.fy = baseY + e.row * spacingY;
    e.x = e.fx;
    e.y = e.fy;
    e.w = size;
    e.h = size;
    e.swoop = null;
  }
}


function spawnEnemies(){
  // v1.96+: Boss wave / additive boss waves
  if (wave === 11){
    spawnBossWave11(false);
    return;
  }

  enemies = [];
  const baseY = 80; // start higher (top zone)

  // v1.96: Wave sizing
  // Wave 1 spawns 1 enemy, then doubles each wave (2x previous).
  // We cap it to keep browsers from melting into a puddle.
  const MAX_WAVE_ENEMIES = 128;
// v1.96: Balanced wave sizing (requested):
// Wave 1: 1 enemy
// Wave 2: 2 enemies
// Wave 3: 4 enemies
// Wave 4+: add +2 each wave (6, 8, 10, ...)
function getEnemyCountForWave(w){
  if (w === 1) return 1;
  if (w === 2) return 2;
  if (w === 3) return 4;
  return 4 + (w - 3) * 2;
}
const count = Math.min(MAX_WAVE_ENEMIES, getEnemyCountForWave(wave));
  totalEnemiesSpawned += count;

  // v1.96: Dynamically pack the formation into the enemy zone by shrinking spacing + size.
  // Keep the "formation area" mostly in the top half.
  const zoneW = canvas.width * 0.82;
  const zoneH = canvas.height * 0.38;

  // Choose columns/rows to fit the count into the zone with a roughly square-ish grid.
  const idealCols = Math.ceil(Math.sqrt(count * (zoneW / Math.max(1, zoneH))));
  formationCols = Math.max(1, Math.min(count, idealCols));
  formationRows = Math.max(1, Math.ceil(count / formationCols));

  // Compute a size that fits nicely in each cell.
  const cellW = zoneW / formationCols;
  const cellH = zoneH / formationRows;
  const baseSize = Math.max(18, Math.min(56, Math.min(cellW, cellH) * 0.60));

  for (let i = 0; i < count; i++){
    const r = Math.floor(i / formationCols);
    const c = i % formationCols;

    const img = randEnemyImg();
    const isFrog = (img && img.src && img.src.toLowerCase().includes("frog.gif"));

    enemies.push({ row:r, col:c, baseY, img, isFrog, size:baseSize, hp:1, hitFlash:0, dying:false, fade:1, fadeRate:0, lockX:0, lockY:0, lockW:0, lockH:0, _killAwarded:false, x:0,y:0,w:0,h:0,
      fx:0, fy:0, // formation-space position (computed each frame)
      swoop:null, // {t,dur,phase, sx,sy, c1x,c1y, ex,ey}
      swoopCooldown: rand(1.0, 3.0) // seconds until eligible to swoop
    });
  }

  if (wave > 11){ spawnBossWave11(true); }
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
  if (isPaused || isGameSpeedFrozen() || playerSpectatorMode) return;
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
  incrementLifetimeStat("lifetimeBulletsFired", 1);
// v1.96: faster firing as waves increase
  fireCooldown = getPlayerFireCooldown();
}


let enemyShootTimer = 0;
function enemyTryShoot(dt){
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
  playerGhosts.length = 0;
  playerGhostSpawnT = 0;
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
  if (playerSpectatorMode || player.invuln > 0 || isDead) return;

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
      commitRunLifetimeStats({ died:true });
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
  if (bindingEditState && bindingEditState.scheme === INPUT_MODE_KEYBOARD){
    e.preventDefault();
    e.stopPropagation();
    setActiveInputMode(INPUT_MODE_KEYBOARD);
    applyBindingValue(INPUT_MODE_KEYBOARD, bindingEditState.action, e.code || e.key);
    return;
  }
  const target = e.target;
  const typingIntoField = target && ((target.tagName === "INPUT") || (target.tagName === "TEXTAREA") || target.isContentEditable);

  if (typingIntoField){
    if (e.code === "Escape" && target && typeof target.blur === "function") target.blur();
    return;
  }

  if (e.code === "Space") e.preventDefault();

  if (isStatsPanelOpen() && (e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Enter" || e.code === "Space" || e.code === "Escape" || e.code === "Tab")){
    setActiveInputMode(INPUT_MODE_KEYBOARD);
    if (savedImageViewerOpen){
      if (e.code === "ArrowLeft") moveStatsSavedImageViewerImage(-1);
      else if (e.code === "ArrowRight") moveStatsSavedImageViewerImage(1);
      else if (e.code === "ArrowUp" || (e.code === "Tab" && e.shiftKey)) moveStatsSavedImageViewerButtonFocus(-1);
      else if (e.code === "ArrowDown" || e.code === "Tab") moveStatsSavedImageViewerButtonFocus(1);
      else if (e.code === "Enter" || e.code === "Space") activateControllerTarget(getStatsSavedImageViewerTargets()[savedImageViewerFocusIndex]);
      else if (e.code === "Escape") closeStatsSavedImageViewer();
    } else if (e.code === "ArrowUp" || (e.code === "Tab" && e.shiftKey)) moveStatsControllerFocusDirectional("up");
    else if (e.code === "ArrowDown" || e.code === "Tab") moveStatsControllerFocusDirectional("down");
    else if (e.code === "ArrowLeft") moveStatsControllerFocusDirectional("left");
    else if (e.code === "ArrowRight") moveStatsControllerFocusDirectional("right");
    else if (e.code === "Enter" || e.code === "Space") activateControllerTarget(getStatsControllerTargets()[statsFocusIndex]);
    else if (e.code === "Escape") closeStatsPanel();
    e.preventDefault();
    return;
  }

  if (isImagesPanelOpen() && (e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Enter" || e.code === "Space" || e.code === "Escape" || e.code === "Tab")){
    setActiveInputMode(INPUT_MODE_KEYBOARD);
    if (e.code === "ArrowUp" || e.code === "ArrowLeft" || (e.code === "Tab" && e.shiftKey)) moveImagesControllerFocus(-1);
    else if (e.code === "ArrowDown" || e.code === "ArrowRight" || e.code === "Tab") moveImagesControllerFocus(1);
    else if (e.code === "Enter" || e.code === "Space") activateControllerTarget(getImagesControllerTargets()[imagesFocusIndex]);
    else if (e.code === "Escape") closeImagesPanel();
    e.preventDefault();
    return;
  }

  if (deathOverlay && deathOverlay.style.display === "flex" && (e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "Enter" || e.code === "Space" || e.code === "Escape")){
    if (e.code === "ArrowUp") moveDeathControllerFocus(-1);
    else if (e.code === "ArrowDown") moveDeathControllerFocus(1);
    else if (e.code === "Enter" || e.code === "Space") activateDeathControllerFocus();
    else if (e.code === "Escape" && btnDeathQuitToMenu) btnDeathQuitToMenu.click();
    e.preventDefault();
    return;
  }

  if (gameState === STATE.WIN && (e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Enter" || e.code === "Space" || e.code === "Escape" || e.code === "Tab")){
    setActiveInputMode(INPUT_MODE_KEYBOARD);
    if (e.code === "ArrowUp" || e.code === "ArrowLeft" || (e.code === "Tab" && e.shiftKey)) moveWinControllerFocus(-1);
    else if (e.code === "ArrowDown" || e.code === "ArrowRight" || e.code === "Tab") moveWinControllerFocus(1);
    else if (e.code === "Enter" || e.code === "Space") activateControllerTarget(getWinControllerTargets()[winFocusIndex]);
    else if (e.code === "Escape") activateControllerTarget(btnContinue || getWinControllerTargets()[winFocusIndex]);
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
  setActiveInputMode(INPUT_MODE_KEYBOARD);
  // v1.96: aim follows pointer (mouse or touch)
  setAimFromClient(e.clientX, e.clientY, { immediate:isTouchPointerEvent(e) });
});

canvas.addEventListener("pointerdown", (e) => {
  if (isTouchPointerEvent(e) && isMobilePhoneViewport()){
    e.preventDefault();
    return;
  }
  if (controlsMenu && controlsMenu.style.display !== 'none' && controlsInputLockMode === INPUT_MODE_CONTROLLER) {
    unlockControlsInputMode();
    setActiveInputMode(INPUT_MODE_KEYBOARD, { force:true });
  } else {
    setActiveInputMode(INPUT_MODE_KEYBOARD);
  }
  setAimFromClient(e.clientX, e.clientY, { immediate:isTouchPointerEvent(e) });
  if (e.button === 2 && keyboardBindings.shield === 'Mouse2'){
    e.preventDefault();
    mouseShieldHolding = true;
    if (canActivateShield()) startShield();
    return;
  }
  if (keyboardBindings.shoot === mouseButtonToBinding(e.button)) mouseFireHolding = true;
  if (gameState === STATE.PLAYING && keyboardBindings.shoot === mouseButtonToBinding(e.button)) shoot();
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
  // v1.96: gamepad input (Xbox controller) must still work in frozen speed-0 mode
  // so the player can pause and quit the static staring contest.
  pollGamepad(dt);

  // Speed 0 intentionally loads a static Wave 1 tableau:
  // static player, static single enemy, static background, no progress, no win/death.
  if (gameState === STATE.PLAYING && isGameSpeedFrozen()){
    if (!isPaused){
      runTimer = 0;
      if (timerHud && !document.body.classList.contains("speedZeroTimeTravel")){
        timerHud.style.display = "none";
      }
    }
    return;
  }

  time += dt;

  // v1.96: update glitch spiral timer
  if (GLITCH_SPIRAL_T > 0) GLITCH_SPIRAL_T = Math.max(0, GLITCH_SPIRAL_T - dt);

  if (bonusArmorBrokenT > 0) bonusArmorBrokenT = Math.max(0, bonusArmorBrokenT - dt);

  // starfield updates always
  updateStarfield(dt, keys, player.speed);
  if (glitchBackgroundPulse > 0) glitchBackgroundPulse = Math.max(0, glitchBackgroundPulse - dt * GLITCH_BACKGROUND_DECAY);

  // PAUSE_GUARD_v1_51: freeze gameplay updates while paused
  if (gameState === STATE.PLAYING && isPaused) return;

  if (isStartMenuEnemyPreviewActive()){
    updateStartMenuEnemyPreview(dt);
    return;
  }

  if (gameState !== STATE.PLAYING) return;

  if (pendingWaveStartMusic){
    const waveIsLive = enemies.length > 0 || (wave === 11 && boss.active);
    if (waveIsLive){
      pendingWaveStartMusic = false;
      if (!audioMuted) ensureMusicPlaying(true);
    }
  }

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
        // Respawn for next life (keep wave/enemies as-is)
        isDead = false;
        deathGameOver = false;
  deathYellPlayed = false;
        deathParticles.length = 0;
        health = 1.0;

  // Spawn player mid-screen, above hearts HUD
  player.x = canvas.width / 2;
  player.y = getPlayerAlignedY();
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
  if (playerSpectatorMode) moveX = 0;

  // v2.07: left/right flip and ghost trail for Level 1.
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

  updatePlayerGhosts(dt);
  if (Math.abs(moveX) > 0.08){
    playerGhostSpawnT -= dt;
    if (playerGhostSpawnT <= 0){
      spawnPlayerGhost(moveX);
      playerGhostSpawnT = PLAYER_GHOST_SPAWN_EVERY;
    }
  } else {
    playerGhostSpawnT = 0;
  }

  player.x += moveX * player.speed * (gpSpeedBoostHeld ? 1.75 : 1.0);
  player.x = Math.max(player.w/2, Math.min(canvas.width - player.w/2, player.x));

  // Keep player vertically aligned to the hearts HUD
  player.y = getPlayerAlignedY();


// v1.96: right stick aim (only when the stick is actually being pushed)
const mobileAimMag = Math.hypot(mobileAimStickX || 0, mobileAimStickY || 0);
if (!playerSpectatorMode && mobileAimMag > MOBILE_STICK_AIM_DEADZONE){
  const nx = (mobileAimStickX / mobileAimMag);
  const ny = (mobileAimStickY / mobileAimMag);
  aimX = player.x + nx * 220;
  aimY = player.y + ny * 220;
  aimAngle = Math.atan2(aimY - player.y, aimX - player.x);
} else {
  const aimMag = Math.hypot(gpAimX || 0, gpAimY || 0);
  if (!playerSpectatorMode && aimMag > GP_AIM_DEADZONE){
    const nx = (gpAimX / aimMag);
    const ny = (gpAimY / aimMag);
    // Convert stick direction into an aim point in front of the player.
    aimX = player.x + nx * 220;
    aimY = player.y + ny * 220;
    aimAngle = Math.atan2(aimY - player.y, aimX - player.x);
  }
}

// v1.96: shield (LS click hold) and fire (RT/A hold); LT = speed boost
gamepadShieldHolding = playerSpectatorMode ? false : !!gpShieldHeld;
shieldHolding = playerSpectatorMode ? false : (mouseShieldHolding || gamepadShieldHolding);
if (shieldHolding && canActivateShield()) startShield();
if (playerSpectatorMode) stopShield(false);

if (!playerSpectatorMode && mobileAimStickActive) shoot();
if (!playerSpectatorMode && gpFireHeld) shoot();

  
  // v1.96: Held-fire (LMB) should keep shooting even while the shield is held.
  // shoot() already respects cooldown, pause, and state.
  if (gameState === STATE.PLAYING && !isPaused && !playerSpectatorMode && mouseFireHolding){
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
  for (let i = bullets.length - 1; i >= 0; i--){
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < -80 || b.x > canvas.width + 80 || b.y < -80 || b.y > canvas.height + 80) bullets.splice(i, 1);
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--){
    const b = enemyBullets[i];
    b.x += (b.vx || 0);
    b.y += b.vy;
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

  if (!playerSpectatorMode){
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
  }

  // enemy contact damage

  // v1.96: shield makes enemies bounce off the player (and consumes shield hits on impact)
  if (!playerSpectatorMode && shieldActive){
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

  if (!playerSpectatorMode){
    for (const e of enemies){
    if (!enemyTouchesPlayerPixels(e)) continue;
      tryTriggerSpiralPlayerContactFx(e, Math.max(player.invuln || 0, 0.65));
      if (player.invuln <= 0){ damagePlayer(e); }
      break;
    }
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


  // wave clear
  if (enemies.length === 0){
    // If player beat INSANITY WAVE: 10 (wave 21), show a win screen.
    if (wave === 21){
      showWinOverlay();
      return;
    }

    wave += 1;
    showWaveBanner(wave);

    resetFormation();
    spawnEnemies();
    trySpawnUFO();
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
  const shouldDrawPlayer = (hasActivePlayer() && !document.body.classList.contains("speedZeroMeltHideCanvasPlayer"));
  if (USE_DOM_ANIMATED_GIF_SPRITES) beginAnimatedGifSpriteFrame();

  if (shouldDrawPlayer && !flicker){
    // Keep the active player static even when PLAYER_IMG_URL points at an animated GIF/WebP.
    // Enemies can still use the DOM animated sprite layer below.
    const oldDomPlayer = animatedGifSpriteMap.get(player);
    if (oldDomPlayer) oldDomPlayer.style.display = "none";
    drawPlayerGhosts();
    drawStaticPlayerSprite();
  }

    // v1.96: shield ring (RMB hold)
  drawShieldRing();

// v1.96: always-on health bar under the player
  if (hasActivePlayer() && !document.body.classList.contains("speedZeroMeltHideCanvasPlayer")){
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
if (hasActivePlayer() && !document.body.classList.contains("speedZeroMeltHideCanvasPlayer")){
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
  const pauseEnemyDimActive = !!(isPaused && (isPausedGameplayMenuBackdropState()));
  for (const e of enemies){
    const perspectiveScale = getEnemyPerspectiveScale(e);
    const visualEnemyW = e.w * perspectiveScale;
    const visualEnemyH = e.h * perspectiveScale;

    // v1.96: frog enemies get a pulsing green aura ring
    if (e.isFrog){
      const pulse = 1 + 0.12 * Math.sin(time * 6.0);
      const r = Math.max(visualEnemyW, visualEnemyH) * 0.70 * pulse;
      ctx.save();
      ctx.globalAlpha = pauseEnemyDimActive ? 0.32 : 0.85;
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
    const drawW = visualEnemyW * deathGrow;
    const drawH = visualEnemyH * deathGrow;
    const ex = e.x - drawW/2, ey = e.y - drawH/2;
    const freezeEnemyImage = isGameSpeedFrozen() || isStartMenuEnemyPreviewActive();
    const enemySource = freezeEnemyImage ? (getStaticFrameForImage(e.img) || e.img) : e.img;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (pauseEnemyDimActive) ctx.filter = "brightness(0.45)";
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
      let drewDomEnemy = false;
      if (freezeEnemyImage){
        hideAnimatedGifSprite(e);
      } else {
        drewDomEnemy = syncAnimatedGifSprite(
          e,
          e.img,
          ex,
          ey,
          drawW,
          drawH,
          { className: pauseEnemyDimActive ? "enemy-gif-sprite pauseEnemyDimSprite" : "enemy-gif-sprite", alpha, hitFlash:e.hitFlash > 0 }
        );
      }
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
  const r = Math.max(visualEnemyW, visualEnemyH) * 0.78;
  ctx.save();
  ctx.strokeStyle = "rgba(255,0,0,0.85)";
  ctx.lineWidth = 3;
  drawInvertedTriangle(e.x, e.y, r);
  ctx.restore();
}

    ctx.restore();
  }

  if (USE_DOM_ANIMATED_GIF_SPRITES) endAnimatedGifSpriteFrame();

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
    `Bananaman Shooter<br>` +
    `State: ${gameState}<br>` +
    `Score: ${score} | Health: ${Math.round(health*100)}% | Wave: ${wave}<br>` +
    `Shield: ${shieldActive ? (Math.round((shieldHP/SHIELD_HP_MAX)*100) + "%") : "off"} | CD: ${shieldCooldown.toFixed(1)}s<br>` +
    `Enemies: ${enemies.length} (${ENEMY_ROWS}x${ENEMY_COLS})<br>` +
    `Enemy pool: ${enemyImages.length || 0} images<br>` +
    `Bullets: ${bullets.length} | Enemy Bullets: ${enemyBullets.length}<br>` +
    `Fire CD: ${fireCooldown.toFixed(2)}s (target ${getPlayerFireCooldown().toFixed(2)}s)<br>` +
    `Player: ${player.w}px | Gap: ${FORMATION_PLAYER_GAP}px<br>` +
    `ESC: Menu`;

  updateAccuracyScoreHUD();
  updateTimerHUD();

  // v1.96: corner HUD updates
  if (isPausedGameplayMenuBackdropState()){
    livesText.textContent = livesInfiniteActive ? "x∞" : ("x" + lives);
    _syncBombHud();
  } else if (gameState === STATE.MENU || gameState === STATE.HUB || gameState === STATE.OPTIONS || gameState === STATE.CONTROLS || gameState === STATE.CHEATS){
    renderMenuHudPreview();
  }
  if (isPausedGameplayMenuBackdropState()){
    const info = getStageInfo(wave);
    const clampedWave = Math.min(wave, info.end);
    const lab = getWaveLabel(wave);
    const stageHudEl = stageHud || document.getElementById("stageHud");
    if (stageHudEl){
      updateMusicHud(lab.text);
      stageHudEl.style.color = lab.color;
      stageHudEl.classList.add("stageMenuAudioToggle");
    }
  } else if (gameState === STATE.MENU || gameState === STATE.HUB || gameState === STATE.OPTIONS || gameState === STATE.CONTROLS || gameState === STATE.CHEATS){
    const stageHudEl = stageHud || document.getElementById("stageHud");
    if (stageHudEl){
      stageHudEl.style.color = "#ffffff";
      stageHudEl.classList.add("stageMenuAudioToggle");
      updateMusicHud("Start Menu");
    }
  } else {
    const stageHudEl = stageHud || document.getElementById("stageHud");
    if (stageHudEl){
      updateMusicHud("");
      stageHudEl.classList.remove("stageMenuAudioToggle");
    }
  }

  // Post FX pass: canvas + visible DOM/HUD/menu layers.
  // Redraw the active player afterward so /video_fx does not hue-shift the player icon.
  if (VIDEO_FX_ENABLED){
    const beat = getBeat();
    applyChromaticAberration(beat);
    redrawPlayerSpriteAfterVideoFx();
    syncWholeScreenVideoFx(beat);
  } else if (document.body.classList.contains("videoFxActive")){
    syncWholeScreenVideoFx(0);
  }

  // Glitch spiral burst (Tab)
  if (GLITCH_SPIRAL_T > 0){
    const strength = Math.max(0, Math.min(1, GLITCH_SPIRAL_T / GLITCH_SPIRAL_DUR));
    applyGlitchSpiral(strength);
  }

}

let lastT = performance.now();

function updateHearts(){
  if ((gameState === STATE.MENU || gameState === STATE.HUB || gameState === STATE.OPTIONS || gameState === STATE.CONTROLS || gameState === STATE.CHEATS) && !(gameState === STATE.HUB && menuHubOpenedFromPause && isPaused)){
    renderMenuHudPreview();
    return;
  }
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
    if (hearts > maxVisibleHudIcons) out += `<span class="hudExtra">+${hearts - maxVisibleHudIcons}</span> `;
  }

  // v1.96: shield pips (one-hit armor) next to hearts
  if (shieldsAreInfinite){
    out += "  🛡️" + infinityLabel;
  } else if (shieldPips > 0){
    const show = Math.min(maxVisibleHudIcons, shieldPips);
    out += "  " + "🛡️ ".repeat(show);
    if (shieldPips > maxVisibleHudIcons) out += `<span class="hudExtra">+${shieldPips - maxVisibleHudIcons}</span> `;
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
    el.style.display = (gameState === STATE.PLAYING || gameState === STATE.MENU || gameState === STATE.HUB || gameState === STATE.OPTIONS || gameState === STATE.CONTROLS || gameState === STATE.CHEATS) ? "block" : "none";
  }
}

function loop(t){
  // v1.96: Game speed knob. We cap raw dt to prevent big frame hitch jumps,
  // then multiply by GAME_SPEED_MULT (5 = 1.0x, 1 = 0.2x, 10 = 2.0x).
  const rawDt = Math.min(0.033, (t - lastT) / 1000);
  const speedMult = Number.isFinite(GAME_SPEED_MULT) ? GAME_SPEED_MULT : 1.0;
  const dt = rawDt * speedMult * getMobileGameplayTimeScale();
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
player.y = getPlayerAlignedY();

// v1.96: default aim straight up until the player moves the pointer
aimX = player.x;
aimY = player.y - 200;
aimAngle = -Math.PI/2;
aimAngleSmoothed = -Math.PI/2;

resetStarfield();
resize(); // also resets starfield + anchors player
showMenu();
powerupSlot.style.display = "none";
setupStartMenuEnemyPreview();
updateHearts();

requestAnimationFrame(loop);


document.addEventListener("DOMContentLoaded", syncSpeedZeroStaticImages);
window.addEventListener("load", syncSpeedZeroStaticImages);


document.addEventListener("DOMContentLoaded", renderLifetimeStats);
