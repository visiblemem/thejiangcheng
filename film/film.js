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
  originals.forEach((tile,index)=>{
    const spriteIndex=(Number(tile.dataset.index||index+1)-1+16)%16;
    const col=spriteIndex%4,row=Math.floor(spriteIndex/4);
    tile.style.setProperty('--sprite-pos',`${(col*33.333).toFixed(3)}% ${(row*33.333).toFixed(3)}%`);
  });

  const GAP=5;
  const PER_ROW=4;
  const ROW_PATTERNS=[
    ['L','P','L','P'],
    ['P','L','P','L'],
    ['L','L','P','P'],
    ['P','P','L','L']
  ];

  const buildPacking=()=>{
    const H=innerWidth<=820?112:175;
    const LW=H*16/9;
    const PW=H*9/16;
    const fullRowW=LW*2+PW*2+GAP*(PER_ROW-1);
    const rows=Math.max(1,Math.ceil(originals.length/PER_ROW));
    const positions=new Map();

    originals.forEach((tile,index)=>{
      const row=Math.floor(index/PER_ROW);
      const slot=index%PER_ROW;
      const orientation=ROW_PATTERNS[row%ROW_PATTERNS.length][slot];
      const width=orientation==='L'?LW:PW;
      const height=H;
      tile.dataset.orientation=orientation==='L'?'landscape':'portrait';
      tile.classList.toggle('landscape',orientation==='L');
      tile.classList.toggle('portrait',orientation==='P');
      tile.style.width=`${width}px`;
      tile.style.height=`${height}px`;

      let left=0;
      const pattern=ROW_PATTERNS[row%ROW_PATTERNS.length];
      for(let s=0;s<slot;s++)left+=(pattern[s]==='L'?LW:PW)+GAP;
      positions.set(tile,{x:left+width/2,y:row*(H+GAP)+H/2,width,height});
    });

    return {
      positions,
      periodW:fullRowW+GAP,
      periodH:rows*(H+GAP),
      fullRowW,
      rowH:H
    };
  };

  let packing=buildPacking();
  const clones=[];

  const bindCloneHover=(el,source)=>{
    el.addEventListener('mouseenter',()=>showMeta(source));
    el.addEventListener('mouseleave',hideMeta);
  };

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
          bindCloneHover(el,source);
        }
        clones.push({el,source,tx,ty});
      });
    }
  };

  const centerOffsets=()=>({
    x:innerWidth*.5-packing.fullRowW*.5,
    y:innerHeight*.5-packing.periodH*.5
  });
  let start=centerOffsets();
  let offsetX=start.x,offsetY=start.y;
  let velX=0,velY=0;
  let dragging=false,moved=false,pointerId=null,lastX=0,lastY=0,lastT=0,pressTile=null;
  const DRAG_GAIN=.48;
  const THROW_GAIN=.22;
  const FRICTION=.925;
  const WHEEL_GAIN=.26;

  const wrapOffset=(value,size)=>{
    while(value>size)value-=size;
    while(value<-size)value+=size;
    return value;
  };

  const layout=()=>{
    const vw=innerWidth,vh=innerHeight;
    const {positions,periodW,periodH}=packing;
    const lens=Math.min(vw,vh)*.82;
    clones.forEach(({el,source,tx,ty})=>{
      const p=positions.get(source);if(!p)return;
      if(el!==source){el.style.width=`${p.width}px`;el.style.height=`${p.height}px`;}
      const x=p.x+tx*periodW+offsetX;
      const y=p.y+ty*periodH+offsetY;
      const n=Math.min(1.25,Math.hypot(x-vw/2,y-vh/2)/Math.max(1,lens));
      const innerScale=1+Math.max(0,.055*(1-n));
      el.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      el.style.setProperty('--lens-scale',innerScale.toFixed(4));
      el.style.opacity=String(Math.max(.62,1-n*.18));
    });
  };

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

  function showMeta(tile){
    if(!meta||!tile)return;
    metaCode.textContent=tile.dataset.code||'';
    metaTitle.textContent=tile.dataset.title||'';
    metaDuration.textContent=tile.dataset.duration||'';
    meta.classList.add('is-on');
  }
  function hideMeta(){meta?.classList.remove('is-on');}

  originals.forEach(tile=>{
    tile.addEventListener('mouseenter',()=>showMeta(tile));
    tile.addEventListener('mouseleave',hideMeta);
    tile.addEventListener('focus',()=>showMeta(tile));
    tile.addEventListener('blur',hideMeta);
    tile.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();openLightbox();}
    });
  });

  function openLightbox(){
    if(!lightbox||!lightboxVideo)return;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden','false');
    lightboxVideo.play().catch(()=>{});
  }
  function closeLightbox(){
    if(!lightbox||!lightboxVideo)return;
    lightboxVideo.pause();
    lightboxVideo.currentTime=0;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden','true');
  }

  rebuildClones();

  viewport.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    dragging=true;moved=false;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;lastT=e.timeStamp;velX=velY=0;
    pressTile=e.target.closest?.('.film-tile')||null;
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture?.(pointerId);
  });

  viewport.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const rawDx=e.clientX-lastX,rawDy=e.clientY-lastY,dt=Math.max(1,e.timeStamp-lastT);
    if(Math.hypot(rawDx,rawDy)>2)moved=true;
    const dx=rawDx*DRAG_GAIN,dy=rawDy*DRAG_GAIN;
    offsetX+=dx;
    offsetY+=dy;
    velX=dx/dt*16*THROW_GAIN;
    velY=dy/dt*16*THROW_GAIN;
    lastX=e.clientX;lastY=e.clientY;lastT=e.timeStamp;
    if(moved)page?.classList.add('has-moved');
    e.preventDefault();
  },{passive:false});

  const endPointer=e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    dragging=false;
    viewport.classList.remove('is-dragging');
    try{viewport.releasePointerCapture?.(pointerId)}catch(_){}
    if(!moved&&pressTile)openLightbox();
    pointerId=null;pressTile=null;
  };

  viewport.addEventListener('pointerup',endPointer);
  viewport.addEventListener('pointercancel',()=>{
    dragging=false;pointerId=null;pressTile=null;viewport.classList.remove('is-dragging');
  });

  viewport.addEventListener('wheel',e=>{
    const dx=-(e.deltaX||e.deltaY*.45)*WHEEL_GAIN;
    const dy=-e.deltaY*WHEEL_GAIN;
    offsetX+=dx;offsetY+=dy;
    velX=dx*.08;velY=dy*.08;
    page?.classList.add('has-moved');
    e.preventDefault();
  },{passive:false});

  lightboxClose?.addEventListener('click',closeLightbox);
  lightbox?.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});
  addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();});
  addEventListener('resize',()=>{
    packing=buildPacking();
    rebuildClones();
    start=centerOffsets();
    offsetX=start.x;offsetY=start.y;velX=velY=0;
    layout();
  });

  layout();
  tick();
})();