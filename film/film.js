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

  fetch('./film-sprite.txt')
    .then(r=>r.ok?r.text():Promise.reject())
    .then(data=>document.documentElement.style.setProperty('--film-sprite',`url("data:image/webp;base64,${data.replace(/\s/g,'')}")`))
    .catch(()=>{});

  const originals=[...world.querySelectorAll('.film-tile')];
  const GAP=5;
  const ITEMS_PER_ROW=4;

  // Every row always contains two 16:9 and two 9:16 works.
  // Odd/even rows swap the order, so any new item continues automatically.
  const orientationFor=index=>{
    const row=Math.floor(index/ITEMS_PER_ROW);
    const col=index%ITEMS_PER_ROW;
    const evenPattern=['L','P','L','P'];
    const oddPattern=['P','L','P','L'];
    return (row%2===0?evenPattern:oddPattern)[col];
  };

  originals.forEach((tile,index)=>{
    const spriteIndex=(Number(tile.dataset.index||index+1)-1+16)%16;
    const spriteCol=spriteIndex%4;
    const spriteRow=Math.floor(spriteIndex/4);
    tile.style.setProperty('--sprite-pos',`${(spriteCol*33.333).toFixed(3)}% ${(spriteRow*33.333).toFixed(3)}%`);
    const orientation=orientationFor(index);
    tile.dataset.orientation=orientation==='L'?'landscape':'portrait';
    tile.classList.toggle('landscape',orientation==='L');
    tile.classList.toggle('portrait',orientation==='P');
    tile.classList.remove('small','slim');
  });

  // Equal-row layout: all tiles share one height. Aspect ratio changes width only.
  // This guarantees exactly 5px horizontal and vertical gaps between tile frames.
  const buildPacking=()=>{
    const mobile=innerWidth<=820;
    const ROW_H=mobile?118:176;
    const landscapeW=ROW_H*16/9;
    const portraitW=ROW_H*9/16;
    const rowW=2*landscapeW+2*portraitW+3*GAP;
    const rows=Math.ceil(originals.length/ITEMS_PER_ROW);
    const positions=new Map();

    originals.forEach((tile,index)=>{
      const row=Math.floor(index/ITEMS_PER_ROW);
      const col=index%ITEMS_PER_ROW;
      let cursorX=0;
      for(let c=0;c<col;c++){
        const o=orientationFor(row*ITEMS_PER_ROW+c);
        cursorX+=(o==='L'?landscapeW:portraitW)+GAP;
      }
      const orientation=orientationFor(index);
      const width=orientation==='L'?landscapeW:portraitW;
      const x=cursorX+width/2;
      const y=row*(ROW_H+GAP)+ROW_H/2;
      positions.set(tile,{x,y,width,height:ROW_H});
      tile.style.width=`${width}px`;
      tile.style.height=`${ROW_H}px`;
    });

    return {
      positions,
      periodW:rowW+GAP,
      periodH:Math.max(1,rows)*(ROW_H+GAP)
    };
  };

  let packing=buildPacking();
  const clones=[];
  const rebuildClones=()=>{
    [...world.querySelectorAll('.film-tile[aria-hidden="true"]')].forEach(el=>el.remove());
    clones.length=0;
    for(let ty=-2;ty<=2;ty++)for(let tx=-2;tx<=2;tx++){
      originals.forEach(source=>{
        const el=(tx===0&&ty===0)?source:source.cloneNode(true);
        if(el!==source){
          el.removeAttribute('tabindex');
          el.setAttribute('aria-hidden','true');
          world.appendChild(el);
        }
        clones.push({el,source,tx,ty});
      });
    }
  };
  rebuildClones();

  let offsetX=innerWidth*.5-packing.periodW*.5;
  let offsetY=innerHeight*.5-packing.periodH*.5;
  let velX=0,velY=0;
  let dragging=false,moved=false,pointerId=null,lastX=0,lastY=0,lastT=0,pressTile=null;

  const DRAG_GAIN=.62;
  const FRICTION=.91;
  const WHEEL_GAIN=.34;
  const wrapOffset=(value,size)=>{
    while(value>size)value-=size;
    while(value<-size)value+=size;
    return value;
  };

  const layout=()=>{
    const vw=innerWidth,vh=innerHeight;
    const lens=Math.min(vw,vh)*.72;
    const {positions,periodW,periodH}=packing;

    clones.forEach(({el,source,tx,ty})=>{
      const p=positions.get(source);
      if(!p)return;
      if(el!==source){
        el.style.width=`${p.width}px`;
        el.style.height=`${p.height}px`;
      }
      const rawX=p.x+tx*periodW+offsetX;
      const rawY=p.y+ty*periodH+offsetY;
      const dx=rawX-vw/2;
      const dy=rawY-vh/2;
      const n=Math.min(1.65,Math.hypot(dx,dy)/Math.max(1,lens));
      const radial=1+.105*n*n;
      const warpedX=vw/2+dx*radial;
      const warpedY=vh/2+dy*radial;
      const scale=Math.max(.72,1-.12*n+.04*n*n);
      const opacity=Math.max(.48,1-n*.25);
      el.style.transform=`translate3d(${warpedX}px,${warpedY}px,0) translate(-50%,-50%) scale(${scale})`;
      el.style.opacity=String(opacity);
      el.style.zIndex=String(Math.max(1,12-Math.round(n*5)));
    });
  };

  // Pure momentum decay: no spring, no target, no bounce, no snap-back.
  const tick=()=>{
    if(!dragging){
      offsetX+=velX;
      offsetY+=velY;
      velX*=FRICTION;
      velY*=FRICTION;
      if(Math.abs(velX)<.015)velX=0;
      if(Math.abs(velY)<.015)velY=0;
    }
    offsetX=wrapOffset(offsetX,packing.periodW);
    offsetY=wrapOffset(offsetY,packing.periodH);
    layout();
    requestAnimationFrame(tick);
  };

  const showMeta=tile=>{
    if(!meta||!tile)return;
    metaCode.textContent=tile.dataset.code||'';
    metaTitle.textContent=tile.dataset.title||'';
    metaDuration.textContent=tile.dataset.duration||'';
    meta.classList.add('is-on');
  };
  const hideMeta=()=>meta?.classList.remove('is-on');
  const bindHover=()=>{
    originals.forEach(tile=>{
      tile.addEventListener('mouseenter',()=>showMeta(tile));
      tile.addEventListener('mouseleave',hideMeta);
      tile.addEventListener('focus',()=>showMeta(tile));
      tile.addEventListener('blur',hideMeta);
    });
    clones.forEach(({el,source})=>{
      if(el===source)return;
      el.addEventListener('mouseenter',()=>showMeta(source));
      el.addEventListener('mouseleave',hideMeta);
    });
  };
  bindHover();

  const openLightbox=()=>{
    if(!lightbox||!lightboxVideo)return;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden','false');
    lightboxVideo.play().catch(()=>{});
  };
  const closeLightbox=()=>{
    if(!lightbox||!lightboxVideo)return;
    lightboxVideo.pause();
    lightboxVideo.currentTime=0;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden','true');
  };

  viewport.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    dragging=true;
    moved=false;
    pointerId=e.pointerId;
    lastX=e.clientX;
    lastY=e.clientY;
    lastT=e.timeStamp;
    velX=velY=0;
    pressTile=e.target.closest?.('.film-tile')||null;
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture?.(pointerId);
  });

  viewport.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const rawDx=e.clientX-lastX;
    const rawDy=e.clientY-lastY;
    const dt=Math.max(1,e.timeStamp-lastT);
    if(Math.hypot(rawDx,rawDy)>2)moved=true;
    const dx=rawDx*DRAG_GAIN;
    const dy=rawDy*DRAG_GAIN;
    offsetX+=dx;
    offsetY+=dy;
    velX=dx/dt*16;
    velY=dy/dt*16;
    lastX=e.clientX;
    lastY=e.clientY;
    lastT=e.timeStamp;
    if(moved)page?.classList.add('has-moved');
    e.preventDefault();
  },{passive:false});

  const endPointer=e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    dragging=false;
    viewport.classList.remove('is-dragging');
    try{viewport.releasePointerCapture?.(pointerId)}catch(_){}
    if(!moved&&pressTile)openLightbox();
    pointerId=null;
    pressTile=null;
  };
  viewport.addEventListener('pointerup',endPointer);
  viewport.addEventListener('pointercancel',()=>{
    dragging=false;
    pointerId=null;
    pressTile=null;
    viewport.classList.remove('is-dragging');
  });

  viewport.addEventListener('wheel',e=>{
    const wx=-(e.deltaX||e.deltaY*.45)*WHEEL_GAIN;
    const wy=-e.deltaY*WHEEL_GAIN;
    offsetX+=wx;
    offsetY+=wy;
    velX=wx*.12;
    velY=wy*.12;
    page?.classList.add('has-moved');
    e.preventDefault();
  },{passive:false});

  originals.forEach(tile=>tile.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();openLightbox();}
  }));
  lightboxClose?.addEventListener('click',closeLightbox);
  lightbox?.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});
  addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();});
  addEventListener('resize',()=>{
    packing=buildPacking();
    rebuildClones();
    bindHover();
    layout();
  });

  layout();
  tick();
})();