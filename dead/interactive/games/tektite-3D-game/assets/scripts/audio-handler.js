export function createAudioHandler({ clamp, getPlayer, getIsThirdPersonMode } = {}) {
  const safeClamp = typeof clamp === "function"
    ? clamp
    : (value, min, max) => Math.max(min, Math.min(max, value));

  const ballAudio = {
    ctx: null,
    master: null,
    rollingGain: null,
    rollingFilter: null,
    rollingNoise: null,
    rollingOsc: null,
    enabled: true,
    lastHardLandingAt: 0,
    lastTreeFlattenCrackAt: 0,
    boneCrackPool: [],
    boneCrackPoolIndex: 0,
    hitmarkerPool: [],
    hitmarkerPoolIndex: 0,
    lastRubbleHitmarkerAt: 0,
    treeDeleteAudio: null,
    treeDeleteVariantPhase: 0,
    lastTreeDeleteVariant: null,
    soundFxVolume: 1,
    muted: false,
    initialized: false
  };

  function createBoneCrackPool() {
    if (ballAudio.boneCrackPool.length > 0 || typeof Audio === "undefined") return;

    ballAudio.boneCrackPool = Array.from({ length: 4 }, () => {
      const sound = new Audio("assets/audio/bone-crack.mp3");
      sound.preload = "auto";
      sound.volume = 0.324;
      return sound;
    });
  }

  function createHitmarkerPool() {
    if (ballAudio.hitmarkerPool.length > 0 || typeof Audio === "undefined") return;

    ballAudio.hitmarkerPool = Array.from({ length: 6 }, () => {
      const sound = new Audio("assets/audio/hitmarker.mp3");
      sound.preload = "auto";
      sound.volume = 0.33;
      return sound;
    });
  }

  function createNoiseBuffer(audioCtx, seconds = 1.2) {
    const length = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;

    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.72 + white * 0.28;
      data[i] = last;
    }

    return buffer;
  }

  function nextTreeDeleteVariant() {
    ballAudio.treeDeleteVariantPhase += 0.91;
    const phase = ballAudio.treeDeleteVariantPhase;
    const a = Math.sin(phase * 1.13);
    const b = Math.sin(phase * 1.87 + 1.4);
    const c = Math.cos(phase * 0.73 + 0.8);

    return {
      baseFreq: 244 + a * 18 + b * 7,
      peakFreq: 1120 + b * 92 + c * 54,
      sweepCurve: 0.64 + (c + 1) * 0.08,
      vibratoRate: 8.7 + (a + 1) * 1.25,
      vibratoBaseDepth: 5.6 + (b + 1) * 1.8,
      vibratoPeakDepth: 16 + (c + 1) * 4.8,
      wobbleCycles: 1.35 + (a + 1) * 0.55,
      wobbleDepth: 0.014 + ((b + 1) * 0.5) * 0.022,
      wobblePhase: phase * 0.77,
      formantStart: 660 + a * 65 + c * 30,
      formantPeak: 2350 + b * 170 + c * 80,
      gainBase: 0.063 + (a + 1) * 0.012,
      gainPeak: 0.098 + (b + 1) * 0.015,
      popPitchMul: 0.94 + (c + 1) * 0.08,
      popNoiseFreq: 1200 + a * 140 + b * 80
    };
  }

  function ensureBallAudio() {
    if (!ballAudio.enabled) return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      ballAudio.enabled = false;
      return null;
    }

    if (!ballAudio.ctx) {
      const audioCtx = new AudioContextClass();
      const master = audioCtx.createGain();
      master.gain.value = ballAudio.muted ? 0 : 0.75 * ballAudio.soundFxVolume;
      master.connect(audioCtx.destination);

      const rollingGain = audioCtx.createGain();
      rollingGain.gain.value = 0;

      const rollingFilter = audioCtx.createBiquadFilter();
      rollingFilter.type = "bandpass";
      rollingFilter.frequency.value = 92;
      rollingFilter.Q.value = 0.9;

      const rollingNoise = audioCtx.createBufferSource();
      rollingNoise.buffer = createNoiseBuffer(audioCtx, 1.4);
      rollingNoise.loop = true;

      const rollingOsc = audioCtx.createOscillator();
      rollingOsc.type = "triangle";
      rollingOsc.frequency.value = 34;

      const rollingOscGain = audioCtx.createGain();
      rollingOscGain.gain.value = 0.026;

      rollingNoise.connect(rollingFilter);
      rollingFilter.connect(rollingGain);
      rollingOsc.connect(rollingOscGain);
      rollingOscGain.connect(rollingGain);
      rollingGain.connect(master);

      rollingNoise.start();
      rollingOsc.start();

      ballAudio.ctx = audioCtx;
      ballAudio.master = master;
      ballAudio.rollingGain = rollingGain;
      ballAudio.rollingFilter = rollingFilter;
      ballAudio.rollingNoise = rollingNoise;
      ballAudio.rollingOsc = rollingOsc;
      ballAudio.initialized = true;
      createBoneCrackPool();
      createHitmarkerPool();
    }

    if (ballAudio.ctx.state === "suspended") {
      ballAudio.ctx.resume().catch(() => {});
    }

    return ballAudio.ctx;
  }

  function scheduleParam(param, value, glideSeconds = 0.035) {
    const audioCtx = ballAudio.ctx;
    if (!audioCtx || !param) return;
    const now = audioCtx.currentTime;
    param.cancelScheduledValues(now);
    param.setTargetAtTime(value, now, glideSeconds);
  }

  function applySoundFxVolume(glideSeconds = 0.035) {
    if (!ballAudio.master || !ballAudio.ctx) return;
    scheduleParam(ballAudio.master.gain, ballAudio.muted ? 0 : 0.75 * ballAudio.soundFxVolume, glideSeconds);
  }

  function setSoundFxVolume(value) {
    ballAudio.soundFxVolume = safeClamp(Number(value), 0, 1.5);
    applySoundFxVolume();
  }

  function setMuted(muted) {
    ballAudio.muted = Boolean(muted);
    applySoundFxVolume(0.02);
  }

  function updateRollingDroneAudio(horizontalSpeed, grounded, sprintingOnLand, inWater) {
    const audioCtx = ballAudio.ctx;
    if (!audioCtx || !ballAudio.rollingGain || !ballAudio.rollingFilter || !ballAudio.rollingOsc) return;

    const player = typeof getPlayer === "function" ? getPlayer() : null;
    const isThirdPersonMode = typeof getIsThirdPersonMode === "function" ? Boolean(getIsThirdPersonMode()) : false;
    const maxSpeed = player?.maxSpeed || 1;
    const sprintMultiplier = player?.sprintMaxSpeedMultiplier || 1;
    const speed01 = safeClamp(horizontalSpeed / (maxSpeed * sprintMultiplier), 0, 1);
    const canRumble = isThirdPersonMode && player?.mesh && grounded && !inWater && speed01 > 0.035;
    const sprintLift = sprintingOnLand ? 1.22 : 1;
    const targetGain = canRumble ? Math.pow(speed01, 0.72) * 0.18 * sprintLift : 0;
    const targetFreq = 54 + speed01 * 240;
    const targetQ = 0.75 + speed01 * 2.4;
    const targetOsc = 22 + speed01 * 58;

    scheduleParam(ballAudio.rollingGain.gain, targetGain, targetGain > 0 ? 0.045 : 0.08);
    scheduleParam(ballAudio.rollingFilter.frequency, targetFreq, 0.05);
    scheduleParam(ballAudio.rollingFilter.Q, targetQ, 0.05);
    scheduleParam(ballAudio.rollingOsc.frequency, targetOsc, 0.05);
  }

  function playSpringSound(strength = 1) {
    const audioCtx = ensureBallAudio();
    if (!audioCtx || !ballAudio.master) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(165 + strength * 40, now);
    osc.frequency.exponentialRampToValueAtTime(520 + strength * 220, now + 0.075);
    osc.frequency.exponentialRampToValueAtTime(170 + strength * 42, now + 0.22);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1450, now);
    filter.frequency.exponentialRampToValueAtTime(680, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16 * strength, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ballAudio.master);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  function playHardLandingPop(impactSpeed) {
    const audioCtx = ensureBallAudio();
    if (!audioCtx || !ballAudio.master) return;

    const now = audioCtx.currentTime;
    if (now - ballAudio.lastHardLandingAt < 0.09) return;
    ballAudio.lastHardLandingAt = now;

    const impact01 = safeClamp((impactSpeed - 18) / 95, 0, 1);
    const buffer = createNoiseBuffer(audioCtx, 0.12);
    const noise = audioCtx.createBufferSource();
    const noiseGain = audioCtx.createGain();
    const clickFilter = audioCtx.createBiquadFilter();
    const bodyOsc = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();

    noise.buffer = buffer;
    clickFilter.type = "bandpass";
    clickFilter.frequency.setValueAtTime(360 + impact01 * 720, now);
    clickFilter.Q.setValueAtTime(1.8, now);

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.18 + impact01 * 0.16, now + 0.008);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    bodyOsc.type = "triangle";
    bodyOsc.frequency.setValueAtTime(92 + impact01 * 45, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(44 + impact01 * 18, now + 0.13);

    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.10 + impact01 * 0.12, now + 0.012);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    noise.connect(clickFilter);
    clickFilter.connect(noiseGain);
    noiseGain.connect(ballAudio.master);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(ballAudio.master);

    noise.start(now);
    noise.stop(now + 0.13);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.18);
  }

  function playTreeFlattenCrack() {
    const audioCtx = ensureBallAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    if (now - ballAudio.lastTreeFlattenCrackAt < 0.065) return;
    ballAudio.lastTreeFlattenCrackAt = now;

    createBoneCrackPool();
    const pool = ballAudio.boneCrackPool;
    if (!pool.length) return;

    const sound = pool[ballAudio.boneCrackPoolIndex % pool.length];
    ballAudio.boneCrackPoolIndex += 1;

    try {
      sound.pause();
      sound.currentTime = 0;
      sound.volume = ballAudio.muted ? 0 : safeClamp(0.324 * ballAudio.soundFxVolume, 0, 1);
      sound.playbackRate = 0.94 + Math.random() * 0.12;
      sound.play().catch(() => {});
    } catch (error) {
      // If the browser refuses to crack a bone today, we simply move on. Society survives.
    }
  }

  function playRubbleHitmarker(volume = 0.33) {
    const audioCtx = ensureBallAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    if (now - ballAudio.lastRubbleHitmarkerAt < 0.075) return;
    ballAudio.lastRubbleHitmarkerAt = now;

    createHitmarkerPool();
    const pool = ballAudio.hitmarkerPool;
    if (!pool.length) return;

    const sound = pool[ballAudio.hitmarkerPoolIndex % pool.length];
    ballAudio.hitmarkerPoolIndex += 1;

    try {
      sound.pause();
      sound.currentTime = 0;
      sound.volume = ballAudio.muted ? 0 : safeClamp(volume * ballAudio.soundFxVolume, 0, 1);
      sound.playbackRate = 0.92 + Math.random() * 0.2;
      sound.play().catch(() => {});
    } catch (error) {
      // Hitmarkers are optional. Browser audio policy remains a tiny goblin.
    }
  }


  function disposeTreeDeleteHoldAudio(fadeSeconds = 0.04) {
    const audioCtx = ballAudio.ctx;
    const active = ballAudio.treeDeleteAudio;
    if (!audioCtx || !active) return;

    const now = audioCtx.currentTime;
    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.008, fadeSeconds));

    try {
      active.osc.stop(now + fadeSeconds + 0.04);
    } catch (error) {
      // Already stopped. Browsers, naturally, enjoy making this dramatic.
    }

    if (active.vibrato) {
      try {
        active.vibrato.stop(now + fadeSeconds + 0.04);
      } catch (error) {}
    }

    if (active.vibratoGain) {
      active.vibratoGain.disconnect();
    }

    ballAudio.treeDeleteAudio = null;
  }

  function startTreeDeleteHoldWoop(durationSeconds = 0.72) {
    const audioCtx = ensureBallAudio();
    if (!audioCtx || !ballAudio.master) return;

    disposeTreeDeleteHoldAudio(0.02);

    const now = audioCtx.currentTime;
    const variant = nextTreeDeleteVariant();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    const vibrato = audioCtx.createOscillator();
    const vibratoGain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(variant.baseFreq, now);

    vibrato.type = "sine";
    vibrato.frequency.setValueAtTime(variant.vibratoRate, now);
    vibratoGain.gain.setValueAtTime(variant.vibratoBaseDepth, now);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(variant.formantStart, now);
    filter.Q.setValueAtTime(5.4, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(variant.gainBase, now + 0.035);
    gain.gain.setTargetAtTime(variant.gainPeak, now + 0.08, 0.18);

    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ballAudio.master);

    osc.start(now);
    vibrato.start(now);

    ballAudio.lastTreeDeleteVariant = variant;
    ballAudio.treeDeleteAudio = {
      osc,
      gain,
      filter,
      vibrato,
      vibratoGain,
      variant,
      duration: Math.max(0.08, durationSeconds),
      startedAt: now
    };
  }

  function updateTreeDeleteHoldWoop(progress = 0) {
    const audioCtx = ballAudio.ctx;
    const active = ballAudio.treeDeleteAudio;
    if (!audioCtx || !active) return;

    const now = audioCtx.currentTime;
    const t = safeClamp(progress, 0, 1);
    const variant = active.variant || ballAudio.lastTreeDeleteVariant || nextTreeDeleteVariant();
    const curved = Math.pow(t, variant.sweepCurve || 0.72);
    const sweepFreq = variant.baseFreq + (variant.peakFreq - variant.baseFreq) * curved;
    const melodicWobble = Math.sin((t * variant.wobbleCycles + variant.wobblePhase) * Math.PI * 2) * variant.wobbleDepth;
    const freq = sweepFreq * (1 + melodicWobble);
    const filterFreq = variant.formantStart + (variant.formantPeak - variant.formantStart) * Math.pow(t, 0.7);
    const gainTarget = variant.gainBase + Math.sin(t * Math.PI) * 0.03 + t * (variant.gainPeak - variant.gainBase) * 0.35;
    const vibratoDepth = variant.vibratoBaseDepth + curved * (variant.vibratoPeakDepth - variant.vibratoBaseDepth);

    active.osc.frequency.cancelScheduledValues(now);
    active.osc.frequency.setTargetAtTime(freq, now, 0.025);

    active.filter.frequency.cancelScheduledValues(now);
    active.filter.frequency.setTargetAtTime(filterFreq, now, 0.03);

    active.gain.gain.cancelScheduledValues(now);
    active.gain.gain.setTargetAtTime(gainTarget, now, 0.025);

    active.vibratoGain.gain.cancelScheduledValues(now);
    active.vibratoGain.gain.setTargetAtTime(vibratoDepth, now, 0.035);
  }

  function cancelTreeDeleteHoldWoop() {
    disposeTreeDeleteHoldAudio(0.055);
  }

  function finishTreeDeleteHoldWoop() {
    const audioCtx = ensureBallAudio();
    if (!audioCtx || !ballAudio.master) return;

    const variant = ballAudio.lastTreeDeleteVariant || nextTreeDeleteVariant();
    disposeTreeDeleteHoldAudio(0.018);

    const now = audioCtx.currentTime;
    const popOsc = audioCtx.createOscillator();
    const popGain = audioCtx.createGain();
    const popFilter = audioCtx.createBiquadFilter();
    const noise = audioCtx.createBufferSource();
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();

    popOsc.type = "triangle";
    popOsc.frequency.setValueAtTime(1220 * variant.popPitchMul, now);
    popOsc.frequency.exponentialRampToValueAtTime(420 * (0.96 + variant.popPitchMul * 0.06), now + 0.065);

    popFilter.type = "lowpass";
    popFilter.frequency.setValueAtTime(2200 + variant.popNoiseFreq * 0.14, now);
    popFilter.Q.setValueAtTime(0.8, now);

    popGain.gain.setValueAtTime(0.0001, now);
    popGain.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    noise.buffer = createNoiseBuffer(audioCtx, 0.09);
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(variant.popNoiseFreq, now);
    noiseFilter.Q.setValueAtTime(3.2, now);

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.105, now + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    popOsc.connect(popFilter);
    popFilter.connect(popGain);
    popGain.connect(ballAudio.master);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ballAudio.master);

    popOsc.start(now);
    popOsc.stop(now + 0.14);
    noise.start(now);
    noise.stop(now + 0.09);
  }

  return {
    ensureBallAudio,
    setSoundFxVolume,
    setMuted,
    updateRollingDroneAudio,
    playSpringSound,
    playHardLandingPop,
    playTreeFlattenCrack,
    playRubbleHitmarker,
    startTreeDeleteHoldWoop,
    updateTreeDeleteHoldWoop,
    cancelTreeDeleteHoldWoop,
    finishTreeDeleteHoldWoop
  };
}
