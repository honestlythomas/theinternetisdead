function formatKeyboardBinding(code){
  const map = {Space:'Space', Escape:'Esc', Slash:'/', ArrowLeft:'Left Arrow', ArrowRight:'Right Arrow', ArrowUp:'Up Arrow', ArrowDown:'Down Arrow', KeyF:'F', KeyM:'M', KeyQ:'Q', KeyA:'A', KeyD:'D', KeyW:'W', KeyS:'S'};
  if (!code) return 'Unbound';
  if (map[code]) return map[code];
  if (/^Mouse\d+$/.test(code)) return code === 'Mouse0' ? 'Left Click' : code === 'Mouse1' ? 'Middle Click' : code === 'Mouse2' ? 'Right Click' : code;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return code;
}

const CONTROLLER_BUTTON_LABELS = {
  0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT",
  8: "View", 9: "Menu", 10: "LS", 11: "RS", 12: "D-Pad Up", 13: "D-Pad Down", 14: "D-Pad Left", 15: "D-Pad Right"
};

function formatControllerBinding(index){ return typeof index === "number" ? (CONTROLLER_BUTTON_LABELS[index] || `Button ${index}`) : "Unbound"; }

function mouseButtonToBinding(button){ return `Mouse${Number(button) || 0}`; }
