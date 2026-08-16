(() => {
  let launching=false;
  const launch=href=>{
    if(launching)return;
    const destination=new URL(href,window.location.origin);
    if(destination.origin!==window.location.origin)return;
    launching=true;
    const intro=window.SiteMidnightHyperspace?.start();
    const navigate=()=>{
      if(window.SiteGlitchTransition)window.SiteGlitchTransition.navigate(destination.href);
      else window.location.assign(destination.href);
    };
    if(intro?.then)intro.then(navigate);
    else navigate();
  };
  window.SitePageWarp={launch};
  window.addEventListener('message',event=>{
    if(event.origin!==window.location.origin||event.data?.type!=='topbar-warp-launch')return;
    launch(event.data.href);
  });
  try{sessionStorage.removeItem('theinternetisdead:page-warp-enabled')}catch(error){}
})();
