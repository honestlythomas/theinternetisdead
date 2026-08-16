(() => {
  window.starfieldPointerSyncState={active:false,x:0,y:0};
  document.documentElement.dataset.pointerSyncActive='false';
  if(window.parent===window)return;
  let hostWindow;
  try{hostWindow=window.top;void hostWindow.document}catch(error){return}
  const attachedWindows=new WeakSet();
  const trackedFrames=new WeakSet();
  let syncFrame=0;
  let pendingState={active:false,x:0,y:0};
  const sendParallax=(active,x=0,y=0)=>{
    pendingState={active:Boolean(active),x,y};
    if(syncFrame)return;
    syncFrame=requestAnimationFrame(()=>{
      syncFrame=0;
      window.starfieldPointerSyncState=pendingState;
      document.documentElement.dataset.pointerSyncActive=String(pendingState.active);
      document.documentElement.dataset.pointerSyncX=String(pendingState.x);
      window.postMessage({type:'portal-starfield-parallax',...pendingState},window.location.origin);
    });
  };
  const coordinatesInHost=(sourceWindow,clientX,clientY)=>{
    let x=clientX;
    let y=clientY;
    let currentWindow=sourceWindow;
    try{
      while(currentWindow!==hostWindow){
        const frame=currentWindow.frameElement;
        if(!frame)break;
        const rect=frame.getBoundingClientRect();
        x=rect.left+x*(rect.width/Math.max(1,currentWindow.innerWidth));
        y=rect.top+y*(rect.height/Math.max(1,currentWindow.innerHeight));
        currentWindow=currentWindow.parent;
      }
    }catch(error){}
    return {
      x:Math.max(-1,Math.min(1,x/Math.max(1,hostWindow.innerWidth)*2-1)),
      y:Math.max(-1,Math.min(1,y/Math.max(1,hostWindow.innerHeight)*2-1))
    };
  };
  const publishPointer=(sourceWindow,event,active=true)=>{
    if(!active){sendParallax(false);return}
    const point=coordinatesInHost(sourceWindow,event.clientX,event.clientY);
    sendParallax(true,point.x,point.y);
  };
  const attachFrames=currentDocument=>{
    currentDocument.querySelectorAll('iframe').forEach(frame=>{
      const attachFrameWindow=()=>{
        if(frame.contentWindow===window)return;
        try{attachWindow(frame.contentWindow)}catch(error){}
      };
      attachFrameWindow();
      if(!trackedFrames.has(frame)){
        trackedFrames.add(frame);
        frame.addEventListener('load',attachFrameWindow);
      }
    });
  };
  const trackFrames=(sourceWindow,currentDocument)=>{
    attachFrames(currentDocument);
    if(currentDocument.readyState==='loading')currentDocument.addEventListener('DOMContentLoaded',()=>attachFrames(currentDocument),{once:true});
    sourceWindow.addEventListener('load',()=>attachFrames(currentDocument),{once:true});
  };
  function attachWindow(sourceWindow){
    if(!sourceWindow||sourceWindow===window||attachedWindows.has(sourceWindow))return;
    let sourceDocument;
    try{sourceDocument=sourceWindow.document;void sourceDocument.documentElement}catch(error){return}
    attachedWindows.add(sourceWindow);
    sourceWindow.addEventListener('pointermove',event=>publishPointer(sourceWindow,event,true),{passive:true});
    sourceWindow.addEventListener('pointerdown',event=>publishPointer(sourceWindow,event,true),{passive:true});
    sourceWindow.addEventListener('pointerup',event=>{if(event.pointerType!=='mouse')publishPointer(sourceWindow,event,false)},{passive:true});
    sourceWindow.addEventListener('pointercancel',event=>publishPointer(sourceWindow,event,false),{passive:true});
    sourceWindow.addEventListener('pointerout',event=>{if(!event.relatedTarget)publishPointer(sourceWindow,event,false)},{passive:true});
    sourceWindow.addEventListener('pagehide',()=>sendParallax(false));
    trackFrames(sourceWindow,sourceDocument);
  }
  attachWindow(hostWindow);
  hostWindow.addEventListener('blur',()=>sendParallax(false));
  hostWindow.document.addEventListener('visibilitychange',()=>{if(hostWindow.document.hidden)sendParallax(false)});
})();
