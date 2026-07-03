function requestHostFullscreen(action="toggle"){
  if (window.parent && window.parent !== window){
    try{
      window.parent.postMessage({ type: "tektite:fullscreen", action }, "*");
      return true;
    }catch(e){}
  }
  return false;
}

function postChatControllerAction(action){
  try{
    if (window.parent && window.parent !== window){
      window.parent.postMessage({ type: "tektite:chat-control", action }, "*");
    }
  }catch(e){}
}


function requestShooterGameScreenshot(){
  if (window.parent && window.parent !== window){
    try{
      window.parent.postMessage({ type: "tektite:save-screenshot" }, "*");
      return true;
    }catch(e){}
  }
  if (typeof window.tektiteSaveScreenshot === "function"){
    try{
      window.tektiteSaveScreenshot();
      return true;
    }catch(e){}
  }
  return false;
}

function requestOpenChat(focusSlash, runCommand){
  try{
    if (window.parent && window.parent !== window){
      window.parent.postMessage({ type: "openChatFromChild", seedSlash: !!focusSlash, autoSuggestSlash: !!focusSlash, runCommand: runCommand ? String(runCommand) : "" }, "*");
      return;
    }
  }catch(e){}
}

function toggleFullscreen(){
  if (requestHostFullscreen("toggle")) return;
  const elem = document.documentElement;
  if (!document.fullscreenElement){
    if (elem.requestFullscreen) elem.requestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

function postCommandResult(command, result){
  if (window.parent && window.parent !== window){
    window.parent.postMessage({
      type: "tektite:command-result",
      ok: !!(result && result.ok),
      command,
      message: result && result.message ? result.message : `${command || 'Command'} executed`
    }, "*");
  }
}

function requestContinueToLevel2(){
  if (window.parent && window.parent !== window){
    window.parent.postMessage({ type: "tektite:continue-to-level2" }, "*");
    return true;
  }
  return false;
}

function requestReturnToLevel1(){
  if (window.parent && window.parent !== window){
    window.parent.postMessage({ type: "tektite:return-to-level1" }, "*");
    return true;
  }
  return false;
}
