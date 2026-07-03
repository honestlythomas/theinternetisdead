function norm(s){ return String(s||"").trim().toLowerCase(); }

function buildBgList(typed){
  const t = norm(typed);
  const list = BG_COLORS.filter(c => norm(c).startsWith(t));

  // v1.96: if the user is typing a hex-like token, keep it as a selectable suggestion
  // Example: "/background_color #1a2b" should let them continue typing without being "corrected" to a named color.
  const looksHexy = /^#?[0-9a-fA-F]{1,8}$/.test(String(typed||"").trim());
  if (looksHexy && t.length){
    const token = String(typed||"").trim().startsWith("#") ? String(typed||"").trim() : ("#" + String(typed||"").trim());
    const out = [token];
    for (const c of (list.length ? list : BG_COLORS)) if (!out.includes(c)) out.push(c);
    return out;
  }

  return list.length ? list : BG_COLORS.slice();
}

function getCommandSuggestList(value){
  const raw = String(value || "").trim();
  if (!raw.startsWith("/") || /\s/.test(raw)) return [];
  const commands = Object.keys(PAUSE_COMMANDS || {}).filter(isPauseCommandVisibleInHelp).sort((a,b)=>a.localeCompare(b));
  const matches = commands.filter(cmd => cmd.startsWith(raw));
  return matches.length ? matches : commands;
}

function buildShootModeList(value){
  const raw = String(value || "").toLowerCase();
  const q = raw.replace(/^\/shoot\s+/, "").trim();
  const modes = (typeof SHOOT_MODES !== "undefined" ? SHOOT_MODES : ["normal", "big_bullets", "glitch"]);
  const list = modes.filter(mode => !q || mode.includes(q));
  return list.length ? list : modes.slice();
}

function renderBgSuggest(){
  if (!pauseCmdSuggest) return;
  if (typeof shouldHidePauseMenuCommandList === "function" && shouldHidePauseMenuCommandList()){
    pauseCmdSuggest.style.display = "none";
    pauseCmdSuggest.innerHTML = "";
    bgSuggestOpen = false;
    return;
  }
  if (!bgSuggestOpen){
    pauseCmdSuggest.style.display = "none";
    pauseCmdSuggest.innerHTML = "";
    return;
  }
  pauseCmdSuggest.style.display = "block";

  if (pauseCommandSuggestMode === "command"){
    pauseCmdSuggest.innerHTML = bgSuggestList.map((cmd,i)=>{
      const active = (i===bgSuggestIndex);
      const desc = (PAUSE_COMMANDS && PAUSE_COMMANDS[cmd]) ? PAUSE_COMMANDS[cmd] : "";
      const cfg = PAUSE_COMMAND_CONTROLS && PAUSE_COMMAND_CONTROLS[cmd];
      const label = cfg ? `${cmd} ${formatPauseCommandNumber(cmd, cfg.defaultValue)}` : cmd;
      const valueAttr = cfg ? ` data-value="${cfg.defaultValue}"` : "";
      return `<div data-cmd="${cmd}"${valueAttr} data-i="${i}" style="padding:6px 8px;border-radius:8px;margin-bottom:4px;background:${active ? "rgba(0,255,102,0.22)" : "rgba(0,255,102,0.08)"};outline:1px solid ${active ? "rgba(0,255,102,0.75)" : "rgba(0,255,102,0.18)"};cursor:pointer;">
        <strong>${label}</strong>
        <div style="font-size:12px;opacity:0.85;">${desc}</div>
        ${cfg ? `<div style="font-size:11px;opacity:0.72;">Range: ${cfg.min}..${cfg.max}${cfg.note ? " - " + cfg.note : ""}</div>` : ""}
      </div>`;
    }).join("");
  } else if (pauseCommandSuggestMode === "shoot"){
    pauseCmdSuggest.innerHTML = bgSuggestList.map((mode,i)=>{
      const active = (i===bgSuggestIndex);
      const desc = mode === "normal"
        ? "Return to regular bullets"
        : (mode === "big_bullets" ? "Use Big Bullets lightning mode" : "Use EMT glitch cannon");
      return `<div data-i="${i}" style="padding:6px 8px;border-radius:8px;margin-bottom:4px;background:${active ? "rgba(0,255,102,0.22)" : "rgba(0,255,102,0.08)"};outline:1px solid ${active ? "rgba(0,255,102,0.75)" : "rgba(0,255,102,0.18)"};cursor:pointer;">
        <strong>${mode}</strong>
        <div style="font-size:12px;opacity:0.85;">${desc}</div>
      </div>`;
    }).join("");
  } else {
    pauseCmdSuggest.innerHTML = bgSuggestList.map((c,i)=>{
      const active = (i===bgSuggestIndex);
      return `<div data-i="${i}" style="padding:6px 6px;border-radius:8px;${active ? 'background: rgba(0,255,102,0.12); outline:1px solid rgba(0,255,102,0.25);' : ''}">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:8px;vertical-align:middle;background:${c};border:1px solid rgba(255,255,255,0.18);"></span>
        <span>${c}</span>
      </div>`;
    }).join("");
  }

  const activeEl = pauseCmdSuggest.querySelector(`div[data-i="${bgSuggestIndex}"]`);
  if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ block: "nearest" });
}

function openBgSuggestFromValue(v){
  const raw = String(v||"");
  const trimmed = raw.trim();

  if (typeof pauseCommandPrefix === "function" && pauseCommandPrefix(trimmed)){
    pauseCommandSuggestMode = "command";
    bgSuggestList = getCommandSuggestList(trimmed);
  } else if (typeof shootModePrefix === "function" && shootModePrefix(raw)){
    pauseCommandSuggestMode = "shoot";
    bgSuggestList = buildShootModeList(raw);
  } else if (trimmed.startsWith(BG_CMD + " ")){
    pauseCommandSuggestMode = "background";
    bgSuggestList = buildBgList(trimmed.slice((BG_CMD + " ").length));
  } else {
    closeBgSuggest();
    return;
  }

  bgSuggestOpen = true;
  bgSuggestIndex = 0;
  renderBgSuggest();
}

function closeBgSuggest(){
  bgSuggestOpen = false;
  bgSuggestList = [];
  bgSuggestIndex = 0;
  pauseCommandSuggestMode = "command";
  renderBgSuggest();
}

function applyBgChoiceToInput(){
  if (!pauseCommand) return;
  if (!bgSuggestOpen || !bgSuggestList.length) return;
  const chosen = bgSuggestList[bgSuggestIndex] || bgSuggestList[0];

  if (pauseCommandSuggestMode === "command"){
    const cfg = PAUSE_COMMAND_CONTROLS && PAUSE_COMMAND_CONTROLS[chosen];
    pauseCommand.value = cfg ? buildPauseCommand(chosen, cfg.defaultValue) : (chosen + " ");
    return;
  }

  if (pauseCommandSuggestMode === "shoot"){
    pauseCommand.value = "/shoot " + chosen;
    return;
  }

  pauseCommand.value = BG_CMD + " " + chosen;
}

function cycleBgChoice(dir){
  if (!bgSuggestOpen) return;
  const n = bgSuggestList.length;
  if (!n) return;
  bgSuggestIndex = (bgSuggestIndex + dir) % n;
  if (bgSuggestIndex < 0) bgSuggestIndex += n;
  renderBgSuggest();
}
