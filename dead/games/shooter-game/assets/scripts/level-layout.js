function getHeartsTopInCanvas(){
  const heartsEl = document.getElementById("heartsHud");
  if (!heartsEl) return canvas.height - 60;
  const hRect = heartsEl.getBoundingClientRect();
  const cRect = canvas.getBoundingClientRect();
  const scaleY = canvas.height / Math.max(1, cRect.height);
  return (hRect.top - cRect.top) * scaleY;
}
