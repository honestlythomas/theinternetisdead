(function(){
  "use strict";

  const FRAME_ID = "tektite-frame";
  const PATCH_FLAG = "__tektiteSavedImagesViewerPatchInstalled";

  function installIntoLevelFrame(){
    const frame = document.getElementById(FRAME_ID);
    if (!frame) return;

    function inject(){
      let levelWindow = null;
      let levelDocument = null;
      try{
        levelWindow = frame.contentWindow;
        levelDocument = frame.contentDocument || (levelWindow && levelWindow.document);
      }catch(error){
        console.warn("Saved images viewer patch could not access level frame.", error);
        return;
      }
      if (!levelWindow || !levelDocument || levelWindow[PATCH_FLAG]) return;
      levelWindow[PATCH_FLAG] = true;

      const script = levelDocument.createElement("script");
      script.textContent = `(${installSavedImagesViewerInLevel.toString()})();`;
      (levelDocument.head || levelDocument.documentElement).appendChild(script);
      script.remove();
    }

    if (frame.contentDocument && frame.contentDocument.readyState !== "loading") inject();
    frame.addEventListener("load", () => setTimeout(inject, 80));
    setTimeout(inject, 250);
    setTimeout(inject, 900);
  }

  function installSavedImagesViewerInLevel(){
    "use strict";
    if (window.__tektiteSavedImagesViewerInstalled) return;
    window.__tektiteSavedImagesViewerInstalled = true;

    let viewer = null;
    let viewerImg = null;
    let viewerMeta = null;
    let backBtn = null;
    let fullscreenBtn = null;
    let activeIndex = 0;
    let gpPrevious = { a:false, b:false, left:false, right:false };

    function $(selector){ return document.querySelector(selector); }
    function $all(selector){ return Array.from(document.querySelectorAll(selector)); }

    function getImagesList(){
      return document.getElementById("imagesList") || $(".savedImagesList") || $("#imagesPanel .imagesList");
    }

    function getImagesPanelInner(){
      return document.getElementById("imagesPanelInner") || $("#imagesPanel .panelInner") || $("#imagesPanel .hubPanelInner") || $("#imagesPanel");
    }

    function getImageCards(){
      const list = getImagesList();
      return list ? Array.from(list.querySelectorAll(".savedImageCard")) : [];
    }

    function getCardIndex(card){
      return Math.max(0, getImageCards().indexOf(card));
    }

    function getCardImageSrc(card){
      const img = card && card.querySelector("img");
      return img ? img.src : "";
    }

    function getCardMeta(card){
      const meta = card && card.querySelector(".savedImageMeta");
      return meta ? meta.textContent : "Saved image";
    }

    function getPanelRect(){
      const panel = getImagesPanelInner();
      if (panel){
        const rect = panel.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 20) return rect;
      }
      const fallback = $("#menuHubPanel .panel, #overlay .panel, .panel");
      if (fallback){
        const rect = fallback.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 20) return rect;
      }
      return {
        left: Math.max(12, window.innerWidth * 0.08),
        top: Math.max(12, window.innerHeight * 0.08),
        width: Math.max(320, window.innerWidth * 0.84),
        height: Math.max(240, window.innerHeight * 0.84)
      };
    }

    function ensureStyle(){
      if (document.getElementById("savedImagesViewerPatchStyle")) return;
      const style = document.createElement("style");
      style.id = "savedImagesViewerPatchStyle";
      style.textContent = `
        .savedImageCard{ cursor:pointer; }
        .savedImageCard.controllerFocus,
        .savedImageCard:hover{
          outline: 3px solid #00ff66 !important;
          box-shadow: 0 0 14px rgba(0,255,102,0.75) !important;
        }
        #savedImagesPanelViewer{
          position: fixed;
          z-index: 2147483000;
          display: none;
          overflow: hidden;
          background: #000;
          border: 5px solid #00ff66;
          border-radius: 18px;
          box-sizing: border-box;
          font-family: "Courier New", monospace;
          color: #00ff66;
        }
        #savedImagesPanelViewer.isOpen{ display:block; }
        #savedImagesPanelViewer:fullscreen{
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          border-radius: 0;
        }
        #savedImagesPanelViewer img{
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          background: #000;
        }
        #savedImagesPanelViewerControls{
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px;
          background: linear-gradient(transparent, rgba(0,0,0,0.86) 34%, rgba(0,0,0,0.96));
          pointer-events: auto;
        }
        #savedImagesPanelViewer button{
          appearance: none;
          border: 2px solid #00ff66;
          background: #000;
          color: #00ff66;
          font-family: "Courier New", monospace;
          font-weight: 700;
          font-size: 15px;
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
        }
        #savedImagesPanelViewer button:hover,
        #savedImagesPanelViewer button.controllerFocus{
          background: #00ff66;
          color: #551a8b;
        }
        #savedImagesPanelViewerMeta{
          position:absolute;
          left: 10px;
          right: 10px;
          top: 8px;
          z-index: 2;
          color: #00ff66;
          text-align: center;
          font-size: 13px;
          text-shadow: 2px 2px 0 #000, 0 0 8px #000;
          pointer-events:none;
        }
      `;
      document.head.appendChild(style);
    }

    function ensureViewer(){
      ensureStyle();
      if (viewer) return viewer;
      viewer = document.createElement("div");
      viewer.id = "savedImagesPanelViewer";
      viewer.setAttribute("role", "dialog");
      viewer.setAttribute("aria-modal", "true");
      viewer.setAttribute("aria-label", "Saved image viewer");

      viewerImg = document.createElement("img");
      viewerImg.alt = "Saved game screenshot";

      viewerMeta = document.createElement("div");
      viewerMeta.id = "savedImagesPanelViewerMeta";

      const controls = document.createElement("div");
      controls.id = "savedImagesPanelViewerControls";

      backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.textContent = "Back";
      backBtn.addEventListener("click", closeViewer);

      fullscreenBtn = document.createElement("button");
      fullscreenBtn.type = "button";
      fullscreenBtn.textContent = "Fullscreen";
      fullscreenBtn.addEventListener("click", toggleFullscreen);

      controls.appendChild(backBtn);
      controls.appendChild(fullscreenBtn);
      viewer.appendChild(viewerImg);
      viewer.appendChild(viewerMeta);
      viewer.appendChild(controls);
      document.body.appendChild(viewer);
      return viewer;
    }

    function sizeViewerToPanel(){
      if (!viewer || !viewer.classList.contains("isOpen") || document.fullscreenElement === viewer) return;
      const rect = getPanelRect();
      viewer.style.left = `${Math.round(rect.left)}px`;
      viewer.style.top = `${Math.round(rect.top)}px`;
      viewer.style.width = `${Math.round(rect.width)}px`;
      viewer.style.height = `${Math.round(rect.height)}px`;
    }

    function renderViewerImage(){
      const cards = getImageCards();
      if (!cards.length){ closeViewer(); return; }
      activeIndex = (activeIndex + cards.length) % cards.length;
      const card = cards[activeIndex];
      viewerImg.src = getCardImageSrc(card);
      viewerImg.alt = `Saved game screenshot ${activeIndex + 1}`;
      viewerMeta.textContent = `${activeIndex + 1} / ${cards.length} • ${getCardMeta(card)}`;
    }

    function openViewer(index){
      const cards = getImageCards();
      if (!cards.length) return;
      ensureViewer();
      activeIndex = Math.max(0, Math.min(cards.length - 1, Number(index) || 0));
      renderViewerImage();
      viewer.classList.add("isOpen");
      viewer.removeAttribute("aria-hidden");
      sizeViewerToPanel();
      try{ backBtn.focus({ preventScroll:true }); }catch(_){ try{ backBtn.focus(); }catch(__){} }
    }

    function closeViewer(){
      if (!viewer) return;
      if (document.fullscreenElement === viewer){
        try{ document.exitFullscreen(); }catch(_){ }
      }
      viewer.classList.remove("isOpen");
      viewer.setAttribute("aria-hidden", "true");
      if (viewerImg) viewerImg.removeAttribute("src");
      const cards = getImageCards();
      const card = cards[activeIndex];
      if (card && typeof card.focus === "function"){
        try{ card.focus({ preventScroll:true }); }catch(_){ try{ card.focus(); }catch(__){} }
      }
    }

    function isViewerOpen(){
      return !!(viewer && viewer.classList.contains("isOpen"));
    }

    function moveViewer(delta){
      if (!isViewerOpen()) return false;
      const cards = getImageCards();
      if (!cards.length) return false;
      activeIndex = (activeIndex + delta + cards.length) % cards.length;
      renderViewerImage();
      return true;
    }

    function toggleFullscreen(){
      if (!viewer) return;
      if (document.fullscreenElement === viewer){
        try{ document.exitFullscreen(); }catch(_){ }
      }else if (viewer.requestFullscreen){
        try{ viewer.requestFullscreen(); }catch(_){ }
      }
    }

    function activateFocusedImageCard(){
      const focused = document.activeElement;
      const controllerFocused = $(".savedImageCard.controllerFocus");
      const target = (controllerFocused && controllerFocused.classList.contains("savedImageCard"))
        ? controllerFocused
        : (focused && focused.classList && focused.classList.contains("savedImageCard") ? focused : null);
      if (!target) return false;
      openViewer(getCardIndex(target));
      return true;
    }

    function installCardClickHandlers(){
      getImageCards().forEach((card, index) => {
        if (card.dataset.savedImageViewerBound === "1") return;
        card.dataset.savedImageViewerBound = "1";
        card.tabIndex = 0;
        card.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openViewer(index);
        }, true);
        card.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          openViewer(getCardIndex(card));
        }, true);
      });
    }

    document.addEventListener("click", (event) => {
      const card = event.target && event.target.closest ? event.target.closest(".savedImageCard") : null;
      if (!card) return;
      event.preventDefault();
      event.stopPropagation();
      openViewer(getCardIndex(card));
    }, true);

    document.addEventListener("keydown", (event) => {
      if (isViewerOpen()){
        if (event.key === "ArrowLeft"){
          event.preventDefault(); event.stopPropagation(); moveViewer(-1); return;
        }
        if (event.key === "ArrowRight"){
          event.preventDefault(); event.stopPropagation(); moveViewer(1); return;
        }
        if (event.key === "Escape" || event.key === "Backspace"){
          event.preventDefault(); event.stopPropagation(); closeViewer(); return;
        }
      }
      if ((event.key === "Enter" || event.key === " ") && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("savedImageCard")){
        event.preventDefault(); event.stopPropagation(); openViewer(getCardIndex(document.activeElement));
      }
    }, true);

    function pollGamepad(){
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      const pad = pads[0];
      if (pad){
        const a = !!(pad.buttons[0] && pad.buttons[0].pressed);
        const b = !!(pad.buttons[1] && pad.buttons[1].pressed);
        const dLeft = !!(pad.buttons[14] && pad.buttons[14].pressed);
        const dRight = !!(pad.buttons[15] && pad.buttons[15].pressed);
        const axisX = Math.abs(pad.axes[0] || 0) > Math.abs(pad.axes[2] || 0) ? (pad.axes[0] || 0) : (pad.axes[2] || 0);
        const left = dLeft || axisX < -0.55;
        const right = dRight || axisX > 0.55;

        if (isViewerOpen()){
          if (a && !gpPrevious.a){
            const focused = document.activeElement;
            if (focused === fullscreenBtn) toggleFullscreen();
            else if (focused === backBtn) closeViewer();
          }
          if (b && !gpPrevious.b) closeViewer();
          if (left && !gpPrevious.left) moveViewer(-1);
          if (right && !gpPrevious.right) moveViewer(1);
        }else if (a && !gpPrevious.a){
          activateFocusedImageCard();
        }

        gpPrevious = { a, b, left, right };
      }
      window.requestAnimationFrame(pollGamepad);
    }

    window.addEventListener("resize", sizeViewerToPanel);
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) sizeViewerToPanel();
    });

    const observer = new MutationObserver(() => installCardClickHandlers());
    observer.observe(document.documentElement, { childList:true, subtree:true });
    setInterval(installCardClickHandlers, 500);
    installCardClickHandlers();
    window.requestAnimationFrame(pollGamepad);

    window.tektiteOpenSavedImageViewer = openViewer;
    window.tektiteCloseSavedImageViewer = closeViewer;
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", installIntoLevelFrame, { once:true });
  }else{
    installIntoLevelFrame();
  }
})();
