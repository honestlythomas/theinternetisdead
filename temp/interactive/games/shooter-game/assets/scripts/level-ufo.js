function ufoColorForStage(stage){
  if (stage === 1) return "rgba(255,60,60,1)";
  if (stage === 2) return "rgba(60,255,120,1)";
  if (stage === 3) return "rgba(80,140,255,1)";
  return null;
}

function shouldForceUFOForWave(w){
  // v1.96: Always spawn a UFO on key milestone waves.
  // v1.96: Wave 11 is now a boss wave, so don't force a UFO there.
  return (w === 21);
}
