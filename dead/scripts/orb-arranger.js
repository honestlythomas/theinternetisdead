(() => {
  const ready = callback => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  };

  ready(() => {
    const normalized = value => (value || "/").replace(/\/+$/, "") || "/";

    const setupSharedSidebar = async () => {
      const siteName = document.querySelector(".site-name");
      const siteIcon = siteName?.querySelector(".site-name-icon");
      const siteLabel = siteName?.querySelector(".site-name-label");
      if (!siteName || !siteIcon || !siteLabel || normalized(location.pathname) === "/") return;

      siteName.removeAttribute("href");
      siteName.setAttribute("role", "group");
      siteName.setAttribute("aria-label", "Site controls");
      siteName.style.cursor = "default";

      const homeLink = document.createElement("a");
      homeLink.className = "site-home-link";
      homeLink.href = "/";
      homeLink.textContent = siteLabel.textContent;
      homeLink.setAttribute("aria-label", "Return to main page");
      siteLabel.replaceWith(homeLink);

      const skullButton = document.createElement("button");
      skullButton.className = "site-sidebar-toggle";
      skullButton.type = "button";
      skullButton.setAttribute("aria-label", "Open sidebar");
      skullButton.setAttribute("aria-expanded", "false");
      skullButton.appendChild(siteIcon);
      siteName.prepend(skullButton);

      const style = document.createElement("style");
      style.id = "shared-secondary-sidebar-style";
      style.textContent = `
        .site-home-link{color:inherit;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.18em}
        .site-home-link:visited{color:inherit}.site-home-link:hover,.site-home-link:focus-visible{color:var(--magenta);outline:none}
        .site-sidebar-toggle{display:inline-flex;align-items:center;justify-content:center;border:0;padding:0;background:transparent;color:inherit;cursor:pointer;font:inherit}
        .secondary-sidebar-backdrop{position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.48);opacity:0;pointer-events:none;transition:opacity .25s ease}
        .secondary-sidebar-backdrop.is-open{opacity:1;pointer-events:auto}
        .secondary-sidebar{position:fixed;left:0;top:0;bottom:0;z-index:21;display:grid;grid-template-rows:auto minmax(120px,1fr) auto;gap:clamp(24px,6vh,64px);width:min(var(--shared-sidebar-width,260px),96vw);height:100dvh;overflow-y:auto;padding:calc(var(--shared-sidebar-top,54px) + 18px) 16px 18px 12px;border-right:2px solid var(--green);background:rgba(0,0,0,.9);box-shadow:2px 0 16px rgba(0,0,0,.7);text-align:center;scrollbar-width:none;transform:translateX(-105%);transition:transform .34s cubic-bezier(.16,1,.3,1);will-change:transform}
        .secondary-sidebar.is-open{transform:translateX(0)}.secondary-sidebar::-webkit-scrollbar{display:none}
        .secondary-sidebar-close{position:absolute;top:0;left:12px;display:inline-flex;height:var(--shared-sidebar-top,54px);align-items:center;gap:9px;border:0;padding:0;background:transparent;color:var(--green);font:900 clamp(15px,1.65vw,21px)/.9 "Courier New",Courier,monospace;letter-spacing:-.075em;text-shadow:0 2px 8px #000,0 0 12px rgba(114,255,25,.38);cursor:pointer;white-space:nowrap}
        .secondary-sidebar-close-icon{position:relative;display:block;width:34px;height:34px;flex:0 0 34px;font-family:"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif;font-size:25px;line-height:34px;text-align:center}
        .secondary-sidebar-close-label{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.18em}
        .secondary-sidebar-close:hover,.secondary-sidebar-close:focus-visible{color:var(--magenta);outline:none;text-shadow:0 2px 8px #000,0 0 14px rgba(255,43,214,.58)}
        .secondary-sidebar .sidebar-top-section{align-self:start}.secondary-sidebar .sidebar-owner-avatar{display:block;width:72px;height:72px;margin:0 auto 8px;border:2px solid var(--green);border-radius:50%;object-fit:cover}
        .secondary-sidebar .sidebar-owner-row,.secondary-sidebar .sidebar-footer-row,.secondary-sidebar .sidebar-radio-title,.secondary-sidebar .privacy-note,.secondary-sidebar .copyright-note{display:block;font-size:.72rem;font-weight:700;line-height:1.32}
        .secondary-sidebar .sidebar-owner-row{margin-bottom:6px}.secondary-sidebar .sidebar-footer-row{margin-bottom:3px}.secondary-sidebar a{color:var(--green);text-decoration:none}.secondary-sidebar a:hover,.secondary-sidebar a:focus-visible{color:var(--magenta);text-decoration:underline;outline:none}
        .secondary-sidebar .radio-block{align-self:center;margin:0}.secondary-sidebar .sidebar-radio-title{margin-bottom:5px;color:var(--magenta);font-size:.78rem}.secondary-sidebar .sidebar-social-card{width:100%;height:100px;overflow:hidden;border:1px solid darkgreen;background:#000}.secondary-sidebar .sidebar-tunein-player{display:block;width:100%;height:100px;border:0}
        .secondary-sidebar .sidebar-radio-caption{display:grid;grid-template-columns:24px minmax(0,1fr) 24px;gap:5px;align-items:center;margin-top:5px}.secondary-sidebar .sidebar-radio-caret{border:0;background:transparent;color:var(--magenta);font:700 1rem "Courier New",Courier,monospace;cursor:pointer}.secondary-sidebar .sidebar-radio-current{min-width:0;width:100%;border:1px solid darkgreen;background:#000;color:var(--magenta);font:700 .68rem "Courier New",Courier,monospace;text-decoration:underline}.secondary-sidebar .sidebar-bottom{align-self:end;padding-top:12px;border-top:1px solid rgba(114,255,25,.3);opacity:.86}.secondary-sidebar .privacy-note,.secondary-sidebar .copyright-note{margin-top:6px;color:#ccc}
        @media(max-width:520px){.secondary-sidebar-close{left:16px;gap:7px;font-size:clamp(13px,4vw,17px)}.secondary-sidebar-close-icon{width:30px;height:30px;flex-basis:30px;font-size:22px;line-height:30px}}
      `;
      document.head.appendChild(style);

      const backdrop = document.createElement("div");
      backdrop.className = "secondary-sidebar-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      const sidebar = document.createElement("aside");
      sidebar.className = "secondary-sidebar";
      sidebar.setAttribute("aria-label", "Honestly Thomas sidebar");
      sidebar.setAttribute("aria-hidden", "true");
      sidebar.innerHTML = `
        <button class="secondary-sidebar-close" type="button" aria-label="Close sidebar"><span class="secondary-sidebar-close-icon" aria-hidden="true">☠️</span><span class="secondary-sidebar-close-label">theinternetisdead.org</span></button>
        <div class="sidebar-top-section">
          <img class="sidebar-owner-avatar" src="https://unavatar.io/youtube/UCn3WLZT7k8nO24XimlJVJVQ" alt="Thomas Harrison">
          <span class="sidebar-owner-row">Thomas Harrison "Honestly Thomas" Tektite/Jinclops</span>
          <span class="sidebar-footer-row">Main YouTube: <a href="https://youtube.com/@Honestly_Thomas">@Honestly_Thomas</a></span>
          <span class="sidebar-footer-row">Alt YouTube: <a href="https://youtube.com/@Cryptid_Memes">@Cryptid_Memes</a></span>
        </div>
        <div class="radio-block" aria-label="My Local Radio Stations">
          <span class="sidebar-radio-title">My Local Radio Stations</span>
          <div class="sidebar-social-card"><iframe class="sidebar-tunein-player" src="https://tunein.com/embed/player/s31188/" scrolling="no" title="Q107 - Toronto's Rock"></iframe></div>
          <div class="sidebar-radio-caption"><button class="sidebar-radio-caret" type="button" data-dir="-1">&lt;</button><select class="sidebar-radio-current" aria-label="Select radio station"></select><button class="sidebar-radio-caret" type="button" data-dir="1">&gt;</button></div>
        </div>
        <div class="sidebar-bottom"><span class="sidebar-footer-row"><a href="/portal/">Portal</a></span><span class="privacy-note">No accounts. No server saves.<br>Your browser hoards the cursed data.</span><span class="copyright-note">Copyright - 2025 <a href="/">theinternetisdead.org</a></span></div>`;
      document.body.append(backdrop, sidebar);

      const sync = () => {
        const rect = siteName.getBoundingClientRect();
        document.documentElement.style.setProperty("--shared-sidebar-width", `${Math.ceil(rect.right) + 28}px`);
        document.documentElement.style.setProperty("--shared-sidebar-top", `${Math.ceil(rect.bottom)}px`);
      };
      const setOpen = open => {
        sync();
        sidebar.classList.toggle("is-open", open);
        backdrop.classList.toggle("is-open", open);
        sidebar.setAttribute("aria-hidden", open ? "false" : "true");
        skullButton.setAttribute("aria-expanded", open ? "true" : "false");
      };
      skullButton.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); setOpen(!sidebar.classList.contains("is-open")); });
      sidebar.querySelector(".secondary-sidebar-close")?.addEventListener("click", () => setOpen(false));
      backdrop.addEventListener("click", () => setOpen(false));
      window.addEventListener("resize", sync);
      document.addEventListener("keydown", event => { if (event.key === "Escape" && sidebar.classList.contains("is-open")) { setOpen(false); skullButton.focus(); } });
      sync();

      const stations = [
        ["Q107 - Toronto's Rock","https://tunein.com/embed/player/s31188/"],["Country 102 Bracebridge","https://tunein.com/embed/player/s307771/"],["Bounce 104.1 Midland","https://tunein.com/embed/player/s2802/"],["BIG 101.1 Barrie","https://tunein.com/embed/player/s31196/"],["Moose FM 99.5 Bracebridge","https://tunein.com/embed/player/s12325/"],["Moose FM 105.5 Huntsville","https://tunein.com/embed/player/s12327/"]
      ];
      const player = sidebar.querySelector(".sidebar-tunein-player");
      const select = sidebar.querySelector(".sidebar-radio-current");
      let stationIndex = 0;
      stations.forEach(([title], index) => { const option = document.createElement("option"); option.value = index; option.textContent = title; select.appendChild(option); });
      const setStation = index => { stationIndex = (index + stations.length) % stations.length; player.src = stations[stationIndex][1]; player.title = stations[stationIndex][0]; select.value = stationIndex; };
      select.addEventListener("change", () => setStation(Number(select.value) || 0));
      sidebar.querySelectorAll(".sidebar-radio-caret").forEach(button => button.addEventListener("click", () => setStation(stationIndex + Number(button.dataset.dir || 1))));
      setStation(0);
    };

    const setupPageNavigation = () => {
      const pageTitle = document.querySelector(".page-title");
      if (!pageTitle || pageTitle.querySelector("#page-nav-button")) return;
      const path = normalized(window.location.pathname);
      const destinations = [
        { label: "Main Page", path: "/" },
        { label: "Portal", path: "/portal/" },
        { label: "Games", path: "/dead/games/" },
        { label: "Experiments", path: "/dead/experiments/" }
      ];
      const current = destinations.find(item => normalized(item.path) === path) || destinations[0];
      const editToggle = pageTitle.querySelector(".orb-edit-toggle");
      const style = document.createElement("style");
      style.id = "shared-page-nav-style";
      style.textContent = `.page-title{position:relative;display:inline-flex;align-items:center;gap:.4em;white-space:nowrap}.page-nav-button{display:inline-flex;align-items:center;border:0;margin:0;padding:0;background:transparent;color:inherit;font:inherit;letter-spacing:inherit;text-shadow:inherit;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:.18em;cursor:pointer;caret-color:transparent;user-select:none;-webkit-user-select:none}.page-nav-menu{position:absolute;top:calc(100% + 10px);left:50%;z-index:8;display:none;min-width:max-content;transform:translateX(-50%);border:1px solid rgba(114,255,25,.55);background:#000;box-shadow:0 8px 24px rgba(0,0,0,.8)}.page-nav-menu.is-open{display:block}.page-nav-option{display:block;width:100%;border:0;padding:7px 10px;background:#000;color:var(--green);font:900 clamp(15px,1.65vw,21px)/1 "Courier New",Courier,monospace;letter-spacing:-.075em;text-align:left;white-space:nowrap;cursor:pointer}.page-nav-option:hover,.page-nav-option:focus-visible{background:var(--green);color:#000;outline:none}.page-nav-button:hover,.page-nav-button:focus-visible{color:var(--magenta);outline:none}@media(max-width:520px){.page-nav-option{font-size:clamp(13px,4vw,17px)}}`;
      if (!document.getElementById(style.id)) document.head.appendChild(style);
      pageTitle.textContent = "";
      const button = document.createElement("button");
      button.className = "page-nav-button"; button.id = "page-nav-button"; button.type = "button"; button.setAttribute("aria-haspopup","menu"); button.setAttribute("aria-expanded","false"); button.textContent = current.label;
      const menu = document.createElement("div"); menu.className = "page-nav-menu"; menu.id = "page-nav-menu"; menu.setAttribute("role","menu"); menu.setAttribute("aria-label","Navigate site sections");
      destinations.forEach(destination => { const option = document.createElement("button"); option.className = "page-nav-option"; option.type = "button"; option.setAttribute("role","menuitem"); option.dataset.destination = destination.path; option.textContent = destination.label; menu.appendChild(option); });
      pageTitle.append(button, menu); if (editToggle) pageTitle.appendChild(editToggle);
      const setOpen = open => { menu.classList.toggle("is-open",open); button.setAttribute("aria-expanded",open ? "true":"false"); };
      const navigate = destination => { if (!destination || normalized(destination) === path) return setOpen(false); const href = new URL(destination,location.origin).href; window.PageTransitions ? window.PageTransitions.navigate(href,"swirl") : location.assign(href); };
      button.addEventListener("click", event => { event.stopPropagation(); setOpen(!menu.classList.contains("is-open")); });
      menu.querySelectorAll(".page-nav-option").forEach(option => option.addEventListener("click", event => { event.stopPropagation(); navigate(option.dataset.destination); }));
      document.addEventListener("click", event => { if (!event.target.closest(".page-title")) setOpen(false); });
      document.addEventListener("keydown", event => { if (event.key === "Escape" && menu.classList.contains("is-open")) { setOpen(false); button.focus(); } });
    };

    setupSharedSidebar();
    setupPageNavigation();

    const compass = document.querySelector(".compass[data-orb-arranger-key]");
    const toggle = document.querySelector(".orb-edit-toggle");
    if (!compass || !toggle) return;
    const items = [...compass.children].filter(item => item.matches(".portal-button, .core"));
    if (items.length < 2) return;
    const storageKey = compass.dataset.orbArrangerKey;
    const scopeSelect = compass.dataset.orbArrangerScopeSelect ? document.querySelector(compass.dataset.orbArrangerScopeSelect) : null;
    const getScope = () => scopeSelect ? String(scopeSelect.value || "1") : "default";
    const originalAttributes = new Map(), defaultSlots = [], itemById = new Map();
    const lines = [...compass.querySelectorAll(":scope > .portal-lines line")];
    let arrangements = {}, currentOrder = [], editing = false, pickedItem = null, swapTarget = null, drag = null;
    items.forEach((item,index) => { const style = getComputedStyle(item); const id = item.id === "open-portal" ? "portal-core" : `orb-${index}`; item.dataset.orbId = id; item.style.setProperty("--orb-jiggle-delay",`${index * -83}ms`); item.classList.add("orb-reorderable"); defaultSlots.push({column:parseInt(style.gridColumnStart,10)||2,row:parseInt(style.gridRowStart,10)||2}); itemById.set(id,item); originalAttributes.set(item,{role:item.getAttribute("role"),tabindex:item.getAttribute("tabindex")}); });
    const defaultOrder = items.map(item => item.dataset.orbId);
    const validOrder = value => Array.isArray(value) && value.length === defaultOrder.length && new Set(value).size === defaultOrder.length && value.every(id => itemById.has(id));
    const readArrangements = () => { try { const parsed = JSON.parse(localStorage.getItem(storageKey)||"{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch(_) { return {}; } };
    const saveArrangements = () => { try { localStorage.setItem(storageKey,JSON.stringify(arrangements)); } catch(_){} };
    const slotCenter = slot => ({x:((slot.column-.5)/3)*100,y:((slot.row-.5)/3)*100});
    const updateLines = () => { if (!lines.length) return; const coreIndex = currentOrder.indexOf("portal-core"), core = slotCenter(defaultSlots[Math.max(0,coreIndex)]), destinations = currentOrder.map((id,index)=>({id,point:slotCenter(defaultSlots[index])})).filter(entry=>entry.id!=="portal-core"); lines.forEach((line,index)=>{ const destination=destinations[index]; if(!destination){line.style.display="none";return;} line.style.display=""; line.setAttribute("x1",core.x.toFixed(2)); line.setAttribute("y1",core.y.toFixed(2)); line.setAttribute("x2",destination.point.x.toFixed(2)); line.setAttribute("y2",destination.point.y.toFixed(2)); }); };
    const applyOrder = order => { currentOrder = validOrder(order) ? [...order] : [...defaultOrder]; currentOrder.forEach((id,index)=>{ const item=itemById.get(id),slot=defaultSlots[index]; item.style.gridColumn=slot.column; item.style.gridRow=slot.row; }); updateLines(); };
    const loadScope = () => { const stored=arrangements[getScope()]; applyOrder(validOrder(stored)?stored:defaultOrder); };
    const clearPicked = () => { pickedItem?.classList.remove("orb-picked-up"); swapTarget?.classList.remove("orb-swap-target"); pickedItem=null; swapTarget=null; };
    const swapItems = (first,second) => { if(!first||!second||first===second)return; const a=currentOrder.indexOf(first.dataset.orbId),b=currentOrder.indexOf(second.dataset.orbId); if(a<0||b<0)return; [currentOrder[a],currentOrder[b]]=[currentOrder[b],currentOrder[a]]; applyOrder(currentOrder); arrangements[getScope()]=[...currentOrder]; saveArrangements(); clearPicked(); };
    const chooseItem = item => { if(!pickedItem){pickedItem=item;item.classList.add("orb-picked-up");return;} if(pickedItem===item)return clearPicked(); swapItems(pickedItem,item); };
    const setEditing = value => { editing=Boolean(value); clearPicked(); compass.classList.toggle("orb-editing",editing); toggle.classList.toggle("is-active",editing); toggle.setAttribute("aria-pressed",String(editing)); items.forEach(item=>{const original=originalAttributes.get(item); if(editing){item.setAttribute("tabindex","0");} else {if(original.tabindex===null)item.removeAttribute("tabindex");else item.setAttribute("tabindex",original.tabindex);}}); };
    const targetAt = (x,y) => { const target=document.elementFromPoint(x,y)?.closest(".orb-reorderable"); return target&&compass.contains(target)?target:null; };
    items.forEach(item => {
      item.addEventListener("pointerdown", event => { if(!editing||event.button>0)return; event.preventDefault(); event.stopPropagation(); clearPicked(); drag={item,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false}; item.setPointerCapture?.(event.pointerId); });
      item.addEventListener("pointermove", event => { if(!editing||!drag||drag.item!==item||drag.pointerId!==event.pointerId)return; const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY; if(!drag.moved&&Math.hypot(dx,dy)<6)return; drag.moved=true; item.classList.add("orb-dragging"); item.style.setProperty("--orb-drag-x",`${dx}px`); item.style.setProperty("--orb-drag-y",`${dy}px`); const target=targetAt(event.clientX,event.clientY); if(swapTarget!==target){swapTarget?.classList.remove("orb-swap-target");swapTarget=target&&target!==item?target:null;swapTarget?.classList.add("orb-swap-target");} });
      item.addEventListener("pointerup", event => { if(!drag||drag.item!==item||drag.pointerId!==event.pointerId)return; const moved=drag.moved,target=swapTarget||targetAt(event.clientX,event.clientY); item.classList.remove("orb-dragging"); item.style.removeProperty("--orb-drag-x"); item.style.removeProperty("--orb-drag-y"); drag=null; if(moved&&target&&target!==item)swapItems(item,target); else if(!moved)chooseItem(item); else clearPicked(); });
      item.addEventListener("keydown", event => { if(editing&&(event.key==="Enter"||event.key===" ")){event.preventDefault();chooseItem(item);} });
    });
    toggle.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); setEditing(!editing); });
    document.addEventListener("click", event => { if(editing&&event.target.closest(".orb-reorderable")){event.preventDefault();event.stopImmediatePropagation();} },true);
    document.addEventListener("keydown", event => { if(editing&&event.key==="Escape") pickedItem?clearPicked():setEditing(false); });
    scopeSelect?.addEventListener("change",()=>setTimeout(loadScope,0));
    window.addEventListener("pageshow",loadScope);
    arrangements=readArrangements(); loadScope();
  });
})();