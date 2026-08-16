(() => {
  let running=false;
  let activeRun=null;
  const duration=10000;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const start=()=>{
    if(running)return activeRun;
    running=true;
    activeRun=new Promise(resolve=>{
      const root=document.documentElement;
      const canvas=document.createElement('canvas');
      const context=canvas.getContext('2d');
      canvas.className='midnight-hyperspace-canvas';
      canvas.setAttribute('aria-hidden','true');
      root.appendChild(canvas);
      root.classList.add('midnight-hyperspace-active');
      const finish=()=>{root.classList.remove('midnight-hyperspace-active');canvas.remove();running=false;activeRun=null;resolve()};
      if(reducedMotion.matches){window.setTimeout(finish,800);return}
      const colors=['#ffffff','#72ff19','#ff2bd6','#18a8ff','#ff1744'];
      const particles=Array.from({length:850},()=>({angle:Math.random()*Math.PI*2,radius:.05+Math.random()*.95,depth:.04+Math.random()*.96,color:colors[Math.floor(Math.random()*colors.length)]}));
      let width=0;
      let height=0;
      let pixelRatio=1;
      let animationFrame=0;
      const resize=()=>{pixelRatio=Math.min(2,window.devicePixelRatio||1);width=window.innerWidth;height=window.innerHeight;canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;context.setTransform(pixelRatio,0,0,pixelRatio,0,0)};
      const startedAt=performance.now();
      const draw=now=>{
      const elapsed=now-startedAt;
      const progress=Math.min(1,elapsed/duration);
      const acceleration=.0012+Math.pow(progress,3)*.075;
      const centerX=width/2+Math.sin(progress*Math.PI*5)*width*.012*progress;
      const centerY=height/2+Math.cos(progress*Math.PI*4)*height*.009*progress;
      const reach=Math.hypot(width,height)*(.34+progress*.18);
      context.clearRect(0,0,width,height);
      const vignette=context.createRadialGradient(centerX,centerY,Math.min(width,height)*(.05+progress*.08),centerX,centerY,Math.max(width,height)*.72);
      vignette.addColorStop(0,'rgba(0,0,0,0)');
      vignette.addColorStop(.48,`rgba(0,0,0,${.08+progress*.14})`);
      vignette.addColorStop(1,`rgba(0,0,0,${.56+progress*.35})`);
      context.fillStyle=vignette;
      context.fillRect(0,0,width,height);
      context.globalCompositeOperation='screen';
      for(const particle of particles){
        const previousDepth=particle.depth;
        particle.depth-=acceleration*(.45+particle.radius);
        if(particle.depth<=.018){particle.depth=.82+Math.random()*.18;particle.angle=Math.random()*Math.PI*2;particle.radius=.04+Math.random()*.96}
        const previousScale=1/Math.max(.025,previousDepth);
        const scale=1/Math.max(.025,particle.depth);
        const previousX=centerX+Math.cos(particle.angle)*particle.radius*reach*previousScale*.12;
        const previousY=centerY+Math.sin(particle.angle)*particle.radius*reach*previousScale*.12;
        const x=centerX+Math.cos(particle.angle)*particle.radius*reach*scale*.12;
        const y=centerY+Math.sin(particle.angle)*particle.radius*reach*scale*.12;
        context.beginPath();
        context.moveTo(previousX,previousY);
        context.lineTo(x,y);
        context.strokeStyle=particle.color;
        context.globalAlpha=Math.min(1,(1-particle.depth)*(.3+progress*1.2));
        context.lineWidth=Math.min(7,.35+scale*.13+progress*2.5);
        context.stroke();
      }
      context.globalAlpha=1;
      context.globalCompositeOperation='source-over';
        if(progress<1)animationFrame=requestAnimationFrame(draw);
      };
      resize();
      window.addEventListener('resize',resize);
      animationFrame=requestAnimationFrame(draw);
      window.setTimeout(()=>{cancelAnimationFrame(animationFrame);window.removeEventListener('resize',resize);finish()},duration+80);
    });
    return activeRun;
  };
  window.SiteMidnightHyperspace={start};
  window.addEventListener('message',event=>{if(event.origin===window.location.origin&&event.data?.type==='topbar-midnight')start()});
})();
