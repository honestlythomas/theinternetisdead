(() => {
  const incomingKey='theinternetisdead:page-glitch-in';
  let navigating=false;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const navigate=href=>{
    if(navigating)return;
    const destination=new URL(href,window.location.href);
    if(destination.origin!==window.location.origin){window.location.assign(destination.href);return}
    if(destination.href===window.location.href)return;
    navigating=true;
    try{sessionStorage.setItem(incomingKey,'true')}catch(error){}
    if(reducedMotion.matches){window.location.assign(destination.href);return}
    document.body.classList.remove('site-glitch-in');
    document.body.classList.add('site-glitch-out');
    window.setTimeout(()=>window.location.assign(destination.href),220);
  };
  window.SiteGlitchTransition={navigate};
  const showIncomingGlitch=()=>{
    let shouldAnimate=false;
    try{shouldAnimate=sessionStorage.getItem(incomingKey)==='true';sessionStorage.removeItem(incomingKey)}catch(error){}
    if(!shouldAnimate||reducedMotion.matches)return;
    document.body.classList.remove('site-glitch-out');
    document.body.classList.add('site-glitch-in');
    window.setTimeout(()=>document.body.classList.remove('site-glitch-in'),280);
  };
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href]');
    if(!link||link.target==='_blank'||link.hasAttribute('download'))return;
    const destination=new URL(link.href,window.location.href);
    if(destination.origin!==window.location.origin)return;
    event.preventDefault();
    navigate(destination.href);
  });
  window.addEventListener('message',event=>{
    if(event.origin!==window.location.origin||event.data?.type!=='topbar-navigate'||typeof event.data.href!=='string')return;
    navigate(event.data.href);
  });
  window.addEventListener('pageshow',showIncomingGlitch);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showIncomingGlitch,{once:true});
  else showIncomingGlitch();
})();
