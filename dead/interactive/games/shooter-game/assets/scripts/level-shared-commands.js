// v1.96: /background_color autocomplete + executor
const BG_CMD = "/background_color";
const BG_COLORS = [
  "black","white","navy","midnightblue","darkslateblue","indigo","purple","darkmagenta",
  "maroon","darkred","crimson","firebrick",
  "darkgreen","seagreen","teal","darkcyan",
  "darkslategray","dimgray","slategray",
  "#000000","#0b1020","#111827","#1f2937","#0f172a","#020617",
  "#300000","#001a33","#002b36","#003300","#1a0033","#2a0030"
];
const SHOOT_MODES = ["normal", "big_bullets", "glitch"];

// v1.96: Pause command registry for /help output (kept alphabetizable)
const PAUSE_COMMANDS = {
  "/background_color": "Set starfield background color (name or hex)",
  "/cheatermode": "Unlock cheat commands by typing the passphrase",
  "/bombs": "Set bombs to 0-99, or 100/INFINITE (e.g. /bombs 5 or /bombs 100)",
  "/color_invert": "Toggle inverted colors",
  "/fullscreen": "Toggle fullscreen mode",
  "/game_speed": "Set game speed from -5 to 20. 0 loads static Wave 1/UFO staring contest; 1 is normal.",
  "/hearts": "Set max hearts to 1-99, or 100/INFINITE (e.g. /hearts 6 or /hearts 100)",
  "/help": "List available commands",
  "/infinite": "Toggle global infinite mode, or set hearts/shields/lives/bombs to infinite",
  "/lives": "Set lives to 0-99, or 100/INFINITE (e.g. /lives 3 or /lives 100)",
  "/log": "Show the visible Last updated timestamp for this level",
  "/mute": "Toggle all game audio on/off",
  "/shields": "Set shields to 0-99, or 100/INFINITE (e.g. /shields 2 or /shields 100)",
  "/shoot": "Set player bullet mode: /shoot normal, /shoot big_bullets, or /shoot glitch",
  "/video_fx": "Toggle chromatic aberration + hue shifting on/off"
};

const PAUSE_CHEAT_COMMANDS = new Set([
  "/bombs",
  "/game_speed",
  "/hearts",
  "/infinite",
  "/lives",
  "/shields",
  "/shoot"
]);

function areCheatCommandsUnlocked(){
  try{
    return typeof cheatsUnlockedByPassphrase !== "undefined" && !!cheatsUnlockedByPassphrase;
  }catch(error){
    return false;
  }
}

function isPauseCommandVisibleInHelp(command){
  return areCheatCommandsUnlocked() || !PAUSE_CHEAT_COMMANDS.has(String(command || "").toLowerCase());
}

function shouldHidePauseMenuCommandList(){
  return true;
}

// Controller-editable /help command arguments.
// 100 still formats as MAX for inventory-style commands.
// /game_speed keeps literal 20 as max and allows -5..20.
const PAUSE_COMMAND_CONTROLS = {
"/bombs": { type:"number", min:0, max:100, step:1, defaultValue:5, maxLabel:"INFINITE", note:"100 = INFINITE" },
  "/game_speed": { type:"number", min:-5, max:20, step:1, defaultValue:1, note:"0 = static UFO tableau, 1 = normal" },
"/hearts": { type:"number", min:1, max:100, step:1, defaultValue:3, maxLabel:"INFINITE", note:"100 = INFINITE" },
"/lives": { type:"number", min:0, max:100, step:1, defaultValue:1, maxLabel:"INFINITE", note:"100 = INFINITE" },
"/shields": { type:"number", min:0, max:100, step:1, defaultValue:2, maxLabel:"INFINITE", note:"100 = INFINITE" }
};

function _parseCountOrInfinite(arg){
  const a = String(arg||"").trim().toLowerCase();
  if (!a) return null;
  if (a === "max" || a === "infinite" || a === "inf" || a === "\u221e" || a === "forever") return { infinite:true, value: 100 };
  const n = parseInt(a, 10);
  if (isNaN(n)) return null;
  if (n >= 100) return { infinite:true, value: 100 };
  return { infinite:false, value: Math.max(0, Math.min(99, n)) };
}

function clampPauseCommandNumber(command, value){
  const cfg = PAUSE_COMMAND_CONTROLS[command];
  if (!cfg || cfg.type !== "number") return value;
  const raw = Number(value);
  const parsed = Number.isFinite(raw) ? raw : cfg.defaultValue;
  return Math.max(cfg.min, Math.min(cfg.max, Math.round(parsed)));
}

function formatPauseCommandNumber(command, value){
  const cfg = PAUSE_COMMAND_CONTROLS[command];
  const n = clampPauseCommandNumber(command, value);
  if (cfg && cfg.maxLabel && n >= cfg.max) return cfg.maxLabel;
  return String(n);
}

function buildPauseCommand(command, value){
  if (!PAUSE_COMMAND_CONTROLS[command]) return command;
  return `${command} ${formatPauseCommandNumber(command, value)}`;
}

function getPauseHelpCommandFromNode(node){
  if (!node) return "";
  const cmd = node.getAttribute("data-cmd") || "";
  if (!cmd) return "";
  if (!PAUSE_COMMAND_CONTROLS[cmd]) return cmd;
  return buildPauseCommand(cmd, node.getAttribute("data-value"));
}

function updatePauseHelpCommandNode(node, delta){
  if (!node) return false;
  const cmd = node.getAttribute("data-cmd") || "";
  const cfg = PAUSE_COMMAND_CONTROLS[cmd];
  if (!cfg) return false;
  const current = clampPauseCommandNumber(cmd, node.getAttribute("data-value"));
  const next = clampPauseCommandNumber(cmd, current + ((cfg.step || 1) * delta));
  node.setAttribute("data-value", String(next));
  const strong = node.querySelector("strong");
  if (strong) strong.textContent = `${cmd} ${formatPauseCommandNumber(cmd, next)}`;
  return true;
}

function getLastUpdatedLogMessage(){
  const hoverNode = document.querySelector("#titleHoverReveal .titleSubHover, .titleSub .titleSubHover");
  if (!hoverNode) return "Last updated: unavailable";
  const raw = String(hoverNode.textContent || "").trim();
  if (!raw) return "Last updated: unavailable";
  return raw.replace(/^\(+|\)+$/g, "").trim();
}

// v1.96: Help UI (lists commands in the pause suggestion panel)
function showHelp(){
  if (!pauseCmdSuggest) return;
  if (shouldHidePauseMenuCommandList()){
    pauseCmdSuggest.style.display = "none";
    pauseCmdSuggest.innerHTML = "";
    closeBgSuggest();
    return;
  }

  const cmds = Object.keys(PAUSE_COMMANDS).filter(isPauseCommandVisibleInHelp).sort((a,b)=>a.localeCompare(b));
  pauseCmdSuggest.style.display = "block";
  pauseCmdSuggest.innerHTML = cmds.map(cmd => {
    const desc = PAUSE_COMMANDS[cmd] || "";
    const cfg = PAUSE_COMMAND_CONTROLS[cmd];
    const valueAttr = cfg ? ` data-value="${cfg.defaultValue}"` : "";
    const rangeLine = cfg ? `<div style="font-size:11px;opacity:0.72;">Range: ${cfg.min}..${cfg.max}${cfg.note ? " • " + cfg.note : ""}</div>` : "";
    const controllerLine = cfg ? `<div style="font-size:11px;opacity:0.72;">Controller: \u25c0/\u25b6 changes #, A runs</div>` : "";
    return `<div data-cmd="${cmd}"${valueAttr} style="padding:6px 8px;border-radius:8px;margin-bottom:4px;background: rgba(0,255,102,0.08);outline:1px solid rgba(0,255,102,0.18);cursor:pointer;">
      <strong>${cmd}${cfg ? " " + formatPauseCommandNumber(cmd, cfg.defaultValue) : ""}</strong>
      <div style="font-size:12px;opacity:0.85;">${desc}</div>
      ${rangeLine}
      ${controllerLine}
    </div>`;
  }).join("");
}


// Generic pause command autocomplete/suggestions.
// This backs Tab/Arrow cycling for the pause command input and includes /game_speed.
let pauseCommandSuggestMode = "command";

function getPauseCommandList(){
  try{
    return Object.keys(PAUSE_COMMANDS || {}).filter(isPauseCommandVisibleInHelp).sort((a,b)=>a.localeCompare(b));
  }catch(e){
    return [];
  }
}

function pauseCommandPrefix(value){
  if (shouldHidePauseMenuCommandList()) return false;
  const raw = String(value || "");
  const trimmed = raw.trim();
  if (!trimmed || !trimmed.startsWith("/")) return false;
  // Only command-name autocomplete before the first argument.
  return !/\s/.test(trimmed);
}

function bgPrefix(value){
  const raw = String(value || "");
  const trimmed = raw.trim();
  if (pauseCommandPrefix(trimmed)) return true;
  return trimmed.startsWith(BG_CMD + " ") || shootModePrefix(raw);
}

function shootModePrefix(value){
  const raw = String(value || "").toLowerCase();
  return isPauseCommandVisibleInHelp("/shoot") && /^\/shoot\s+/.test(raw);
}

function getCommandSuggestions(value){
  const raw = String(value || "").trim();
  if (!raw.startsWith("/") || /\s/.test(raw)) return [];
  const matches = getPauseCommandList().filter(cmd => cmd.startsWith(raw));
  return matches.length ? matches : getPauseCommandList();
}

function openBgSuggestFromValue(value){
  if (!pauseCmdSuggest) return;
  const raw = String(value || "");
  const trimmed = raw.trim();

  if (pauseCommandPrefix(trimmed)){
    pauseCommandSuggestMode = "command";
    bgSuggestList = getCommandSuggestions(trimmed);
    bgSuggestIndex = 0;
    renderBgSuggest();
    return;
  }

  if (shootModePrefix(raw)){
    pauseCommandSuggestMode = "shoot";
    const q = raw.toLowerCase().replace(/^\/shoot\s+/, "").trim();
    bgSuggestList = SHOOT_MODES.filter(mode => !q || mode.includes(q));
    if (!bgSuggestList.length) bgSuggestList = SHOOT_MODES.slice();
    bgSuggestIndex = 0;
    renderBgSuggest();
    return;
  }

  if (trimmed.startsWith(BG_CMD + " ")){
    pauseCommandSuggestMode = "background";
    const q = trimmed.slice(BG_CMD.length).trim().toLowerCase();
    bgSuggestList = BG_COLORS.filter(color => !q || color.toLowerCase().includes(q));
    if (!bgSuggestList.length) bgSuggestList = BG_COLORS.slice();
    bgSuggestIndex = 0;
    renderBgSuggest();
    return;
  }

  closeBgSuggest();
}

function closeBgSuggest(){
  bgSuggestOpen = false;
  bgSuggestList = [];
  bgSuggestIndex = 0;
  pauseCommandSuggestMode = "command";
  if (pauseCmdSuggest){
    pauseCmdSuggest.style.display = "none";
    pauseCmdSuggest.innerHTML = "";
  }
}

function renderBgSuggest(){
  if (!pauseCmdSuggest) return;
  if (shouldHidePauseMenuCommandList()){
    pauseCmdSuggest.style.display = "none";
    pauseCmdSuggest.innerHTML = "";
    bgSuggestOpen = false;
    return;
  }
  if (!bgSuggestList || !bgSuggestList.length){
    closeBgSuggest();
    return;
  }

  bgSuggestOpen = true;
  pauseCmdSuggest.style.display = "block";

  if (pauseCommandSuggestMode === "command"){
    pauseCmdSuggest.innerHTML = bgSuggestList.map((cmd, i) => {
      const active = i === bgSuggestIndex;
      const desc = (PAUSE_COMMANDS && PAUSE_COMMANDS[cmd]) ? PAUSE_COMMANDS[cmd] : "";
      const cfg = PAUSE_COMMAND_CONTROLS && PAUSE_COMMAND_CONTROLS[cmd];
      const label = cfg ? `${cmd} ${formatPauseCommandNumber(cmd, cfg.defaultValue)}` : cmd;
      const valueAttr = cfg ? ` data-value="${cfg.defaultValue}"` : "";
      return `<div data-cmd="${cmd}"${valueAttr} data-i="${i}" style="padding:6px 8px;border-radius:8px;margin-bottom:4px;background:${active ? "rgba(0,255,102,0.22)" : "rgba(0,255,102,0.08)"};outline:1px solid ${active ? "rgba(0,255,102,0.75)" : "rgba(0,255,102,0.18)"};cursor:pointer;">
        <strong>${label}</strong>
        <div style="font-size:12px;opacity:0.85;">${desc}</div>
        ${cfg ? `<div style="font-size:11px;opacity:0.72;">Range: ${cfg.min}..${cfg.max}${cfg.note ? " • " + cfg.note : ""}</div>` : ""}
      </div>`;
    }).join("");
    return;
  }

  if (pauseCommandSuggestMode === "shoot"){
    pauseCmdSuggest.innerHTML = bgSuggestList.map((mode, i) => {
      const active = i === bgSuggestIndex;
      const desc = mode === "normal"
        ? "Return to regular bullets"
        : (mode === "big_bullets" ? "Use Big Bullets lightning mode" : "Use EMT glitch cannon");
      return `<div data-i="${i}" style="padding:6px 8px;border-radius:8px;margin-bottom:4px;background:${active ? "rgba(0,255,102,0.22)" : "rgba(0,255,102,0.08)"};outline:1px solid ${active ? "rgba(0,255,102,0.75)" : "rgba(0,255,102,0.18)"};cursor:pointer;">
        <strong>${mode}</strong>
        <div style="font-size:12px;opacity:0.85;">${desc}</div>
      </div>`;
    }).join("");
    return;
  }

  pauseCmdSuggest.innerHTML = bgSuggestList.map((color, i) => {
    const active = i === bgSuggestIndex;
    const swatch = /^#/.test(color) ? color : color;
    return `<div data-i="${i}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;margin-bottom:4px;background:${active ? "rgba(0,255,102,0.22)" : "rgba(0,255,102,0.08)"};outline:1px solid ${active ? "rgba(0,255,102,0.75)" : "rgba(0,255,102,0.18)"};cursor:pointer;">
      <span style="width:14px;height:14px;border-radius:3px;border:1px solid rgba(255,255,255,0.35);background:${swatch};display:inline-block;"></span>
      <strong>${color}</strong>
    </div>`;
  }).join("");
}

function cycleBgChoice(delta){
  if (!bgSuggestList || !bgSuggestList.length) return;
  bgSuggestIndex = (bgSuggestIndex + delta + bgSuggestList.length) % bgSuggestList.length;
  renderBgSuggest();
}

function applyBgChoiceToInput(){
  if (!pauseCommand || !bgSuggestList || !bgSuggestList.length) return;
  const choice = bgSuggestList[bgSuggestIndex];
  if (pauseCommandSuggestMode === "command"){
    const cfg = PAUSE_COMMAND_CONTROLS && PAUSE_COMMAND_CONTROLS[choice];
    pauseCommand.value = cfg ? buildPauseCommand(choice, cfg.defaultValue) : (choice + " ");
    return;
  }
  if (pauseCommandSuggestMode === "shoot"){
    pauseCommand.value = "/shoot " + choice;
    return;
  }
  pauseCommand.value = BG_CMD + " " + choice;
}

