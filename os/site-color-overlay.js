(() => {
  const storageKey='theinternetisdead.colors';
  const defaults={enabled:false,activated:false,color:'#72ff19',blendMode:'difference',opacity:25,saturation:100,brightness:100,hueShift:false,hueSpeed:1};
  const blendModes=new Set(['difference','exclusion','multiply','screen','overlay','color','hue','color-dodge','luminosity']);
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
  const normalize=value=>({
    enabled:Boolean(value?.activated),
    activated:Boolean(value?.activated),
    color:/^#[0-9a-f]{6}$/i.test(value?.color||'')?value.color:defaults.color,
    blendMode:blendModes.has(value?.blendMode)?value.blendMode:defaults.blendMode,
    opacity:clamp(value?.opacity??defaults.opacity,0,100),
    saturation:clamp(value?.saturation??defaults.saturation,0,300),
    brightness:clamp(value?.brightness??defaults.brightness,25,200),
    hueShift:Boolean(value?.hueShift),
    hueSpeed:clamp(value?.hueSpeed??defaults.hueSpeed,1,4)
  });
  let settings=defaults;
  try{settings=normalize(JSON.parse(localStorage.getItem(storageKey)||'null'))}catch(error){}
  const overlay=document.createElement('div');
  overlay.id='site-color-overlay';
  overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483646',pointerEvents:'none'});
  document.documentElement.appendChild(overlay);
  let hueAnimation=null;
  const apply=value=>{
    settings=normalize(value);
    overlay.hidden=!settings.enabled;
    overlay.style.background=settings.color;
    overlay.style.mixBlendMode=settings.blendMode;
    overlay.style.opacity=String(settings.opacity/100);
    const baseFilter=`saturate(${settings.saturation}%) brightness(${settings.brightness}%)`;
    overlay.style.filter=baseFilter;
    hueAnimation?.cancel();
    hueAnimation=null;
    if(settings.enabled&&settings.hueShift){
      hueAnimation=overlay.animate([
        {filter:`hue-rotate(0deg) ${baseFilter}`},
        {filter:`hue-rotate(360deg) ${baseFilter}`}
      ],{duration:12000/settings.hueSpeed,iterations:Infinity,easing:'linear'});
    }
  };
  apply(settings);
  window.SiteColorOverlay={apply,get settings(){return {...settings}}};
  window.addEventListener('message',event=>{
    if(event.origin!==window.location.origin||event.data?.type!=='topbar-color-update')return;
    apply(event.data.settings);
  });
})();
