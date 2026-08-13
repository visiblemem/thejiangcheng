(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const page=document.querySelector('.film-canvas-page');
  const meta=document.querySelector('.film-hover-meta');
  const metaCode=meta?.querySelector('.hover-code');
  const metaTitle=meta?.querySelector('.hover-title');
  const metaDuration=meta?.querySelector('.hover-duration');
  const lightbox=document.querySelector('.film-lightbox');
  const lightboxVideo=lightbox?.querySelector('video');
  const lightboxClose=document.querySelector('.film-lightbox-close');
  if(!viewport||!world)return;

  fetch('./film-sprite.txt').then(r=>r.ok?r.text():Promise.reject()).then(data=>document.documentElement.style.setProperty('--film-sprite',`url("data:image/webp;base64,${data.replace(/\s/g,'')}")`)).catch(()=>{});

  const originals=[...world.querySelectorAll('.film-tile')];
  const ORIENTATION_PATTERN=['L','P','L','P','L','P','P','L'];
  originals.forEach((tile,index)=>{
    const spriteIndex=(Number(tile.dataset.index||index+1)-1+16)%16;
    const col=spriteIndex%4,row=Math.floor(spriteIndex/4);
    tile.style.setProperty('--sprite-pos',`${(col*33.333).toFixed(3)}% ${(row*33.333).toFixed(3)}%`);
    const orientation=ORIENTATION_PATTERN[index%ORIENTATION_PATTERN.length];
    tile.dataset.orientation=orientation==='L'?'landscape':'portrait';
    tile.classList.toggle('landscape',orientation==='L');
    tile.classList.toggle('portrait',orientation==='P');
    tile.classList.remove('small','slim');
  });

  const buildPacking=()=>{
    const mobile=innerWidth<=820;
    const COL_W=mobile?92:145;
    const GAP=5;
    const COLS=mobile?6:8;
    const skyline=Array(COLS).fill(GAP);
    const positions=new Map();
    originals.forEach(tile=>{
      const landscape=tile.dataset.orientation==='landscape';
      const span=landscape?2:1;
      const width=span*COL_W+(span-1)*GAP;
      const height=landscape?width*9/16:width*16/9;
      let bestCol=0,bestY=Infinity;
      for(let c=0;c<=COLS-span;c++){
        const y=Math.max(...skyline.slice(c,c+span));
        if(y<bestY-.1){bestY=y;bestCol=c;}
      }
      const x=GAP+bestCol*(COL_W+GAP)+width/2;
      const y=bestY+height/2;
      positions.set(tile,{x,y,width,height});
      for(let c=bestCol;c<bestCol+span;c++)skyline[c]=bestY+height+GAP;
      tile.style.width=`${width}px`;tile.style.height=`${height}px`;
    });
    return {positions,periodW:COLS*(COL_W+GAP)+GAP,periodH:Math.max(...skyline)+GAP};
  };

  let packing=buildPacking();
  const clones=[];
  const rebuildClones=()=>{
    [...world.querySelectorAll('.film-tile[aria-hidden="true"]')].forEach(el=>el.remove());clones.length=0;
    for(let ty=-2;ty<=2;ty++)for(let tx=-2;tx<=2;tx++)originals.forEach(source=>{
      const el=(tx===0&&ty===0)?source:source.cloneNode(true);
      if(el!==source){el.removeAttribute('tabindex');el.setAttribute('aria-hidden','true');world.appendChild(el);}
      clones.push({el,source,tx,ty});
    });
  };
  rebuildClones();

  let offsetX=innerWidth*.5-packing.periodW*.5,offsetY=innerHeight*.5-packing.periodH*.5;
  let velX=0,velY=0,dragging=false,moved=false,pointerId=null,lastX=0,lastY=0,lastT=0,pressTile=null;
  const DRAG_GAIN=.55;
  const WHEEL_GAIN=.42;
  const INERTIA_GAIN=.48;
  const wrapOffset=(value,size)=>{while(value>size)value-=size;while(value<-size)value+=size;return value;};

  const layout=()=>{
    const vw=innerWidth,vh=innerHeight,lens=Math.min(vw,vh)*.72;
    const {positions,periodW,periodH}=packing;
    clones.forEach(({el,source,tx,ty})=>{
      const p=positions.get(source);if(!p)return;
      if(el!==source){el.style.width=`${p.width}px`;el.style.height=`${p.height}px`;}
      const rawX=p.x+tx*periodW+offsetX,rawY=p.y+ty*periodH+offsetY;
      const dx=rawX-vw/2,dy=rawY-vh/2,n=Math.min(1.65,Math.hypot(dx,dy)/Math.max(1,lens));
      const radial=1+.105*n*n,warpedX=vw/2+dx*radial,warpedY=vh/2+dy*radial;
      const scale=Math.max(.72,1-.12*n+.04*n*n),opacity=Math.max(.48,1-n*.25);
      el.style.transform=`translate3d(${warpedX}px,${warpedY}px,0) translate(-50%,-50%) scale(${scale})`;
      el.style.opacity=String(opacity);el.style.zIndex=String(Math.max(1,12-Math.round(n*5)));
    });
  };

  const tick=()=>{
    if(!dragging){offsetX+=velX;offsetY+=velY;velX*=.88;velY*=.88;if(Math.abs(velX)<.02)velX=0;if(Math.abs(velY)<.02)velY=0;}
    offsetX=wrapOffset(offsetX,packing.periodW);offsetY=wrapOffset(offsetY,packing.periodH);layout();requestAnimationFrame(tick);
  };

  const showMeta=tile=>{if(!meta||!tile)return;metaCode.textContent=tile.dataset.code||'';metaTitle.textContent=tile.dataset.title||'';metaDuration.textContent=tile.dataset.duration||'';meta.classList.add('is-on');};
  const hideMeta=()=>meta?.classList.remove('is-on');
  const bindHover=()=>{
    originals.forEach(tile=>{tile.addEventListener('mouseenter',()=>showMeta(tile));tile.addEventListener('mouseleave',hideMeta);tile.addEventListener('focus',()=>showMeta(tile));tile.addEventListener('blur',hideMeta);});
    clones.forEach(({el,source})=>{if(el===source)return;el.addEventListener('mouseenter',()=>showMeta(source));el.addEventListener('mouseleave',hideMeta);});
  };bindHover();

  const openLightbox=()=>{if(!lightbox||!lightboxVideo)return;lightbox.classList.add('is-open');lightbox.setAttribute('aria-hidden','false');lightboxVideo.play().catch(()=>{});};
  const closeLightbox=()=>{if(!lightbox||!lightboxVideo)return;lightboxVideo.pause();lightboxVideo.currentTime=0;lightbox.classList.remove('is-open');lightbox.setAttribute('aria-hidden','true');};

  viewport.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;dragging=true;moved=false;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;lastT=e.timeStamp;velX=velY=0;pressTile=e.target.closest?.('.film-tile')||null;viewport.classList.add('is-dragging');viewport.setPointerCapture?.(pointerId);});
  viewport.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const rawDx=e.clientX-lastX,rawDy=e.clientY-lastY,dt=Math.max(1,e.timeStamp-lastT);
    if(Math.hypot(rawDx,rawDy)>2)moved=true;
    const dx=rawDx*DRAG_GAIN,dy=rawDy*DRAG_GAIN;
    offsetX+=dx;offsetY+=dy;velX=dx/dt*16*INERTIA_GAIN;velY=dy/dt*16*INERTIA_GAIN;
    lastX=e.clientX;lastY=e.clientY;lastT=e.timeStamp;if(moved)page?.classList.add('has-moved');e.preventDefault();
  },{passive:false});
  const endPointer=e=>{if(!dragging||e.pointerId!==pointerId)return;dragging=false;viewport.classList.remove('is-dragging');try{viewport.releasePointerCapture?.(pointerId)}catch(_){}if(!moved&&pressTile)openLightbox();pointerId=null;pressTile=null;};
  viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',()=>{dragging=false;pointerId=null;pressTile=null;viewport.classList.remove('is-dragging')});
  viewport.addEventListener('wheel',e=>{const wx=-(e.deltaX||e.deltaY*.45)*WHEEL_GAIN,wy=-e.deltaY*WHEEL_GAIN;offsetX+=wx;offsetY+=wy;velX=wx*.055;velY=wy*.055;page?.classList.add('has-moved');e.preventDefault();},{passive:false});

  originals.forEach(tile=>tile.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLightbox();}}));
  lightboxClose?.addEventListener('click',closeLightbox);lightbox?.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();});
  addEventListener('resize',()=>{packing=buildPacking();rebuildClones();bindHover();layout();});
  layout();tick();
})();