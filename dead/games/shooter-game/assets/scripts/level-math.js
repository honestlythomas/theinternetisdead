function rand(min, max){ return min + Math.random() * (max - min); }

function normAngle(a){
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function drawInvertedTriangle(x, y, r){
  // Upside-down equilateral triangle around (x,y)
  const a0 = Math.PI/2; // point down
  ctx.beginPath();
  for (let i = 0; i < 3; i++){
    const a = a0 + i * (Math.PI * 2 / 3);
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

function getSpacingX(){
  // v1.96: Responsive horizontal spacing (desktop-friendly)
  const maxFormationWidth = canvas.width * 0.82;     // use most of the screen width
  const cols = Math.max(1, formationCols - 1);       // gaps between columns (dynamic per wave)
  return Math.min(120, Math.max(80, maxFormationWidth / cols));
}

function getSpacingY(){
  // v1.96: Responsive vertical spacing based on current wave formation size
  const maxFormationHeight = canvas.height * 0.38; // keep formation mostly in top zone
  const rows = Math.max(1, formationRows - 1);
  return Math.min(110, Math.max(45, maxFormationHeight / rows));
}
