(function(){
  function getViewportSize(){
    const doc = document.documentElement;
    return {
      width: Math.max(1, Math.round(window.innerWidth || (doc && doc.clientWidth) || 640)),
      height: Math.max(1, Math.round(window.innerHeight || (doc && doc.clientHeight) || 360))
    };
  }

  function getVisibleRect(rect, viewport){
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(viewport.width, rect.right);
    const bottom = Math.min(viewport.height, rect.bottom);
    const width = right - left;
    const height = bottom - top;
    if (width <= 0 || height <= 0) return null;
    return { left, top, right, bottom, width, height };
  }

  function drawVisibleCanvas(ctx, canvas, viewport){
    if (!canvas || !canvas.width || !canvas.height) return false;
    const rect = canvas.getBoundingClientRect();
    const visible = getVisibleRect(rect, viewport);
    if (!visible || rect.width <= 0 || rect.height <= 0) return false;

    const sourceScaleX = canvas.width / rect.width;
    const sourceScaleY = canvas.height / rect.height;
    const sourceX = (visible.left - rect.left) * sourceScaleX;
    const sourceY = (visible.top - rect.top) * sourceScaleY;
    const sourceW = visible.width * sourceScaleX;
    const sourceH = visible.height * sourceScaleY;

    ctx.drawImage(
      canvas,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      visible.left,
      visible.top,
      visible.width,
      visible.height
    );
    return true;
  }

  function isElementVisible(el, viewport){
    if (!el) return false;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement){
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0.01) return false;
    }
    const rect = el.getBoundingClientRect();
    return !!getVisibleRect(rect, viewport);
  }

  function drawImageElement(ctx, img, viewport){
    if (!img || !img.complete || !img.naturalWidth || !isElementVisible(img, viewport)) return false;
    const rect = img.getBoundingClientRect();
    const visible = getVisibleRect(rect, viewport);
    if (!visible || rect.width <= 0 || rect.height <= 0) return false;

    const sourceScaleX = img.naturalWidth / rect.width;
    const sourceScaleY = img.naturalHeight / rect.height;
    const sourceX = (visible.left - rect.left) * sourceScaleX;
    const sourceY = (visible.top - rect.top) * sourceScaleY;
    const sourceW = visible.width * sourceScaleX;
    const sourceH = visible.height * sourceScaleY;
    const style = window.getComputedStyle(img);

    ctx.save();
    try{
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(style.opacity || 1)));
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        visible.left,
        visible.top,
        visible.width,
        visible.height
      );
      return true;
    }catch(_){
      return false;
    }finally{
      ctx.restore();
    }
  }

  function drawAnimatedSpriteImages(ctx, viewport){
    const images = Array.from(document.querySelectorAll("#animatedGifSpriteLayer img, .animated-gif-sprite"));
    images.forEach((img) => drawImageElement(ctx, img, viewport));
  }

  function syncLiveFormValues(sourceRoot, cloneRoot){
    const liveFields = Array.from(sourceRoot.querySelectorAll("input, textarea, select"));
    const clonedFields = Array.from(cloneRoot.querySelectorAll("input, textarea, select"));
    liveFields.forEach((field, index) => {
      const clone = clonedFields[index];
      if (!clone) return;
      const tagName = field.tagName.toLowerCase();
      if (tagName === "select"){
        Array.from(clone.options).forEach((option, optionIndex) => {
          option.selected = !!(field.options[optionIndex] && field.options[optionIndex].selected);
        });
      } else if (field.type === "checkbox" || field.type === "radio"){
        if (field.checked) clone.setAttribute("checked", "");
        else clone.removeAttribute("checked");
      } else {
        clone.setAttribute("value", field.value);
        clone.value = field.value;
      }
    });
  }

  function buildDomSnapshotSvg(viewport){
    const clone = document.documentElement.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    clone.querySelectorAll("script").forEach((script) => script.remove());

    const clonedCanvas = clone.querySelector("#game");
    if (clonedCanvas){
      clonedCanvas.style.opacity = "0";
      clonedCanvas.style.background = "transparent";
    }

    clone.querySelectorAll("#animatedGifSpriteLayer img, .animated-gif-sprite").forEach((img) => {
      img.style.opacity = "0";
    });

    const head = clone.querySelector("head");
    if (head){
      const base = document.createElement("base");
      base.setAttribute("href", location.href);
      head.insertBefore(base, head.firstChild);

      const style = document.createElement("style");
      style.textContent = [
        "html,body{",
        "width:" + viewport.width + "px !important;",
        "height:" + viewport.height + "px !important;",
        "min-width:" + viewport.width + "px !important;",
        "min-height:" + viewport.height + "px !important;",
        "overflow:hidden !important;",
        "background:transparent !important;",
        "}"
      ].join("");
      head.appendChild(style);
    }

    syncLiveFormValues(document, clone);

    const serialized = new XMLSerializer().serializeToString(clone);
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="',
      viewport.width,
      '" height="',
      viewport.height,
      '" viewBox="0 0 ',
      viewport.width,
      " ",
      viewport.height,
      '">',
      '<foreignObject x="0" y="0" width="',
      viewport.width,
      '" height="',
      viewport.height,
      '">',
      serialized,
      "</foreignObject></svg>"
    ].join("");
  }

  async function drawDomSnapshot(ctx, viewport){
    if (document.fonts && document.fonts.ready){
      try{ await document.fonts.ready; }catch(_){}
    }

    const svg = buildDomSnapshotSvg(viewport);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try{
      const image = new Image();
      image.decoding = "async";
      const loaded = new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not render DOM snapshot for screenshot."));
      });
      image.src = url;
      await loaded;
      if (image.decode){
        try{ await image.decode(); }catch(_){}
      }
      ctx.drawImage(image, 0, 0, viewport.width, viewport.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function canvasToDataUrl(canvas, type, quality){
    return canvas.toDataURL(type || "image/jpeg", quality);
  }

  async function createLevelScreenshotDataUrl(options = {}){
    const viewport = getViewportSize();
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = viewport.width;
    captureCanvas.height = viewport.height;

    const ctx = captureCanvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    drawVisibleCanvas(ctx, options.canvas, viewport);
    drawAnimatedSpriteImages(ctx, viewport);
    await drawDomSnapshot(ctx, viewport);

    return canvasToDataUrl(captureCanvas, options.type || "image/jpeg", options.quality == null ? 0.86 : options.quality);
  }

  window.tektiteCreateLevelScreenshotDataUrl = createLevelScreenshotDataUrl;
})();
