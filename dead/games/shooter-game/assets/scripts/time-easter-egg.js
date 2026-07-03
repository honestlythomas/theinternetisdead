// time-easter-egg.js
// Speed-0 staring contest timeout.
// After 2 minutes, the screen melts while Bananarama "wins" and pushes toward the fourth wall.

(() => {
  const REQUIRED_MS = 120000;
  const MELT_MS = 4200;
  const CHECK_MS = 250;
  const PLAYER_URL = "/dead/games/shooter-game/assets/bananarama.gif";

  let frozenStartedAt = 0;
  let melting = false;
  let overlay = null;
  let canvas = null;
  let ctx = null;
  let sourceCanvas = null;
  let sourceCtx = null;
  let playerImg = null;
  let columns = [];
  let startTime = 0;
  let lastFrameTime = 0;
  let escapePlayer = { x:0, y:0, w:72, h:72, facing:-1, vx:0 };
  const heldKeys = Object.create(null);

  function api(){
    return window.TektiteLevel1SpeedZero || null;
  }

  function dpr(){
    return Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  }

  function isFrozenScene(){
    const a = api();
    return !!(a && typeof a.isFrozen === "function" && a.isFrozen());
  }

  function resetTimer(){
    frozenStartedAt = 0;
  }

  function makeOverlay(){
    overlay = document.createElement("div");
    overlay.id = "speedZeroMeltOverlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden;background:transparent;";

    canvas = document.createElement("canvas");
    canvas.id = "speedZeroMeltCanvas";
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;image-rendering:auto;";

    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    ctx = canvas.getContext("2d");
    sourceCanvas = document.createElement("canvas");
    sourceCtx = sourceCanvas.getContext("2d");
    resizeCanvases();
  }

  function resizeCanvases(){
    const scale = dpr();
    const w = Math.max(1, Math.floor(window.innerWidth * scale));
    const h = Math.max(1, Math.floor(window.innerHeight * scale));
    if (canvas){
      canvas.width = w;
      canvas.height = h;
    }
    if (sourceCanvas){
      sourceCanvas.width = w;
      sourceCanvas.height = h;
    }
  }

  function readPlayerState(){
    const a = api();
    const state = a && typeof a.getPlayerState === "function" ? a.getPlayerState() : null;
    const scale = dpr();
    if (state){
      escapePlayer.x = state.x * scale;
      escapePlayer.y = state.y * scale;
      escapePlayer.w = state.w * scale;
      escapePlayer.h = state.h * scale;
      escapePlayer.facing = state.facing || -1;
    } else {
      escapePlayer.x = sourceCanvas.width / 2;
      escapePlayer.y = sourceCanvas.height * 0.82;
      escapePlayer.w = 72 * scale;
      escapePlayer.h = 72 * scale;
      escapePlayer.facing = -1;
    }
    escapePlayer.vx = 0;
  }

  function hideRuntimePlayer(hidden){
    const a = api();
    if (a && typeof a.hideCanvasPlayer === "function") a.hideCanvasPlayer(hidden);
  }

  function setNegativeTimeTravel(seconds){
    const a = api();
    if (a && typeof a.setNegativeTimeTravel === "function") a.setNegativeTimeTravel(seconds);
  }

  function forceRuntimeDraw(){
    const a = api();
    if (a && typeof a.forceDraw === "function") a.forceDraw();
  }

  function captureSceneWithoutPlayer(){
    const mainCanvas = document.getElementById("game");
    if (!mainCanvas || !sourceCtx) return;

    hideRuntimePlayer(true);
    forceRuntimeDraw();

    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    try{
      sourceCtx.drawImage(mainCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
    }catch(e){}

    sourceCtx.save();
    sourceCtx.scale(sourceCanvas.width / Math.max(1, window.innerWidth), sourceCanvas.height / Math.max(1, window.innerHeight));
    sourceCtx.font = "16px monospace";
    sourceCtx.textAlign = "left";
    sourceCtx.textBaseline = "top";
    sourceCtx.fillStyle = "rgba(0,255,102,0.88)";
    sourceCtx.shadowColor = "rgba(0,255,102,0.45)";
    sourceCtx.shadowBlur = 8;

    const hudIds = ["stageHud", "accuracyScore", "timerHud", "livesSlot", "powerupSlot", "heartsHud"];
    for (const id of hudIds){
      const el = document.getElementById(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.textContent || "").trim();
      if (!text || rect.width <= 0 || rect.height <= 0) continue;
      sourceCtx.fillText(text.replace(/\s+/g, " "), rect.left, rect.top);
    }

    sourceCtx.restore();
  }

  function initPlayerImage(){
    playerImg = new Image();
    playerImg.decoding = "async";
    playerImg.loading = "eager";
    // Cache-bust so the animated GIF starts visibly moving during the victory zoom.
    playerImg.src = PLAYER_URL + "?staring-contest-winner=" + Date.now();
  }

  function initColumns(){
    const scale = dpr();
    const colW = Math.max(3, Math.floor(6 * scale));
    const count = Math.ceil(sourceCanvas.width / colW);
    columns = Array.from({ length:count }, (_, i) => ({
      x:i * colW,
      w:colW + 1,
      delay:Math.random() * 0.38,
      speed:0.52 + Math.random() * 1.8,
      wobble:Math.random() * Math.PI * 2,
      tear:Math.random() * 0.26
    }));
  }

  function startMelt(){
    if (melting) return;
    melting = true;
    makeOverlay();
    readPlayerState();
    setNegativeTimeTravel(REQUIRED_MS / 1000);
    initPlayerImage();
    captureSceneWithoutPlayer();
    initColumns();
    startTime = performance.now();
    lastFrameTime = startTime;
    requestAnimationFrame(animateMelt);
  }

  function updateEscapingPlayer(progress, now){
    const scale = dpr();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    let input = 0;

    if (heldKeys.ArrowLeft || heldKeys.KeyA) input -= 1;
    if (heldKeys.ArrowRight || heldKeys.KeyD) input += 1;

    // A tiny autopilot wobble so the banana still looks alive if the user does nothing.
    const drift = Math.sin(now * 0.0022) * 0.18;
    const speed = (300 + progress * 190) * scale;

    escapePlayer.vx = escapePlayer.vx * 0.82 + (input + drift) * speed * 0.18;
    escapePlayer.x += escapePlayer.vx * dt;
    escapePlayer.x = Math.max(escapePlayer.w * 0.35, Math.min(sourceCanvas.width - escapePlayer.w * 0.35, escapePlayer.x));

    if (input > 0.1) escapePlayer.facing = 1;
    else if (input < -0.1) escapePlayer.facing = -1;

    const a = api();
    if (a && typeof a.setPlayerX === "function") a.setPlayerX(escapePlayer.x / scale);
  }

  function drawMelt(progress, now){
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = `rgba(0,0,0,${0.08 + progress * 0.78})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const h = sourceCanvas.height;
    const wave = Math.sin(progress * Math.PI);

    for (const c of columns){
      const local = Math.max(0, Math.min(1, (progress - c.delay) / Math.max(0.12, 1 - c.delay)));
      const fall = Math.pow(local, 1.45) * h * (0.45 + c.speed * 1.2);
      const wobbleX = Math.sin(now * 0.008 + c.wobble) * wave * 18 * c.tear;
      const stretch = 1 + local * (2.4 + c.speed);

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.pow(local, 2.2) * 0.92);
      ctx.filter = `hue-rotate(${Math.round(local * 240)}deg) saturate(${1 + local * 2.2}) blur(${local * 2.2}px)`;
      ctx.drawImage(sourceCanvas, c.x, 0, c.w, h, c.x + wobbleX, fall, c.w, h * stretch);
      ctx.restore();

      if (local > 0.05){
        ctx.fillStyle = `rgba(0,255,102,${0.08 * (1 - local)})`;
        ctx.fillRect(c.x + wobbleX, 0, c.w, Math.min(h, fall + 40));
      }
    }

    ctx.save();
    ctx.globalAlpha = 0.12 + progress * 0.18;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let y = 0; y < canvas.height; y += 14){
      const dx = Math.sin(y * 0.05 + now * 0.012) * 18 * progress;
      ctx.fillRect(dx, y, canvas.width, 1);
    }
    ctx.restore();
  }

  function drawEscapingPlayer(progress, now){
    if (!playerImg || !playerImg.complete) return;

    const scale = dpr();
    const zoom = 1 + Math.pow(progress, 1.65) * 9.5;
    const bob = Math.sin(now * 0.01) * 5 * scale * (1 - Math.min(1, progress * 1.4));
    const yLift = Math.pow(progress, 1.3) * sourceCanvas.height * 0.18;
    const w = escapePlayer.w * zoom;
    const h = escapePlayer.h * zoom;
    const centerPull = Math.pow(progress, 1.8);
    const x = escapePlayer.x * (1 - centerPull) + (sourceCanvas.width / 2) * centerPull;
    const y = escapePlayer.y - yLift + bob;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escapePlayer.facing >= 0 ? -1 : 1, 1);
    ctx.globalAlpha = 1;
    ctx.shadowColor = "rgba(0,255,102,0.55)";
    ctx.shadowBlur = 18 + progress * 60;
    ctx.filter = `drop-shadow(0 0 ${Math.round(8 + progress * 36)}px rgba(0,255,102,0.45)) saturate(${1.05 + progress * 0.6}) contrast(${1.02 + progress * 0.25})`;
    ctx.drawImage(playerImg, -w / 2, -h / 2, w, h);

    if (progress > 0.58){
      ctx.globalAlpha = Math.min(0.55, (progress - 0.58) * 1.4);
      ctx.filter = "none";
      ctx.strokeStyle = "rgba(255,255,255,0.72)";
      ctx.lineWidth = Math.max(2, 5 * scale);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }

    ctx.restore();
  }

  function animateMelt(now){
    if (!melting || !ctx || !sourceCanvas) return;
    const elapsedSeconds = ((now - startTime) / 1000);
    const progress = Math.max(0, Math.min(1, (now - startTime) / MELT_MS));
    setNegativeTimeTravel((REQUIRED_MS / 1000) + elapsedSeconds);

    updateEscapingPlayer(progress, now);
    drawMelt(progress, now);
    drawEscapingPlayer(progress, now);

    lastFrameTime = now;

    if (progress < 1){
      requestAnimationFrame(animateMelt);
      return;
    }

    finishMelt();
  }

  function finishMelt(){
    const a = api();
    const finalNegativeSeconds = (REQUIRED_MS / 1000) + (MELT_MS / 1000);
    if (a && typeof a.resetToSpeedOneAndMenu === "function") a.resetToSpeedOneAndMenu();
    setNegativeTimeTravel(finalNegativeSeconds);

    // Keep the lore clock visible briefly after the kickout, then let normal menu HUD reclaim reality.
    setTimeout(() => {
      try{
        document.body.classList.remove("speedZeroTimeTravel");
      }catch(e){}
    }, 5000);

    setTimeout(() => {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
      canvas = null;
      ctx = null;
      sourceCanvas = null;
      sourceCtx = null;
      playerImg = null;
      columns = [];
      melting = false;
      resetTimer();
    }, 220);
  }

  function tick(){
    if (melting) return;

    if (!isFrozenScene()){
      resetTimer();
      return;
    }

    if (!frozenStartedAt){
      frozenStartedAt = performance.now();
      return;
    }

    if (performance.now() - frozenStartedAt >= REQUIRED_MS) startMelt();
  }

  window.addEventListener("keydown", (event) => {
    heldKeys[event.code] = true;
  });

  window.addEventListener("keyup", (event) => {
    heldKeys[event.code] = false;
  });

  window.addEventListener("resize", () => {
    if (melting && canvas) resizeCanvases();
  });

  setInterval(tick, CHECK_MS);
})();
