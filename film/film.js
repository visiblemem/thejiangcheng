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
    const col=spriteIndex%4;
    const row=Math.floor(spriteIndex/4);
    tile.style.setProperty('--sprite-pos',`${(col*33.333).toFixed(3)}% ${(row*33.333).toFixed(3)}%`);
  });

  const GAP=5;
  const PER_ROW=4;
  const ROW_PATTERNS=[
    ['L','P','P','L'],
    ['P','L','L','P']
  ];

  const buildPacking=()=>{
    const H=innerWidth<=820?150:230;
    const LW=Math.round(H*16/9);
    const PW=Math.round(H*9/16);
    const fullRowW=LW*2+PW*2+GAP*(PER_ROW-1);
    const rows=Math.max(1,Math.ceil(originals.length/PER_ROW));
    const contentH=rows*H+(rows-1)*GAP;
    const positions=new Map();

    originals.forEach((tile,index)=>{
      const row=Math.floor(index/PER_ROW);
      const slot=index%PER_ROW;
      const pattern=ROW_PATTERNS[row%ROW_PATTERNS.length];
      const orientation=pattern[slot];
      const width=orientation==='L'?LW:PW;

      tile.dataset.orientation=orientation==='L'?'landscape':'portrait';
      tile.classList.toggle('landscape',orientation==='L');
      tile.classList.toggle('portrait',orientation==='P');
      tile.style.width=`${width}px`;
      tile.style.height=`${H}px`;

      let left=0;
      for(let s=0;s<slot;s++)left+=(pattern[s]==='L'?LW:PW)+GAP;
      const x=left+width/2;
      const y=row*(H+GAP)+H/2;
      positions.set(tile,{x,y,width,height:H});
    });

    return {
      positions,
      fullRowW,
      contentH,
      periodW:fullRowW+GAP,
      periodH:contentH+GAP
    };
  };

  let packing=buildPacking();
  const clones=[];

  function showMeta(tile){
    if(!meta||!tile)return;
    metaCode.textContent=tile.dataset.code||'';
    metaTitle.textContent=tile.dataset.title||'';
    metaDuration.textContent=tile.dataset.duration||'';
    meta.classList.add('is-on');
  }
  function hideMeta(){meta?.classList.remove('is-on');}

  const bindCloneHover=(el,source)=>{
    el.addEventListener('mouseenter',()=>showMeta(source));
    el.addEventListener('mouseleave',hideMeta);
  };

  const rebuildClones=()=>{
    [...world.querySelectorAll('.film-tile[aria-hidden="true"]')].forEach(el=>el.remove());
    clones.length=0;

    for(let ty=-2;ty<=2;ty++){
      for(let tx=-2;tx<=2;tx++){
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
    }
  };

  const centerOffsets=()=>({
    x:innerWidth*.5-packing.fullRowW*.5,
    y:innerHeight*.5-packing.contentH*.5
  });

  let start=centerOffsets();
  let offsetX=start.x;
  let offsetY=start.y;
  let velX=0;
  let velY=0;
  let dragging=false;
  let moved=false;
  let pointerId=null;
  let lastX=0;
  let lastY=0;
  let lastT=0;
  let pressTile=null;

  const DRAG_GAIN=.42;
  const THROW_GAIN=.68;
  const FRICTION=.94;
  const WHEEL_GAIN=.22;
  const STOP_SPEED=.012;

  const wrapOffset=(value,size)=>{
    while(value>size)value-=size;
    while(value<-size)value+=size;
    return value;
  };

  const layout=()=>{
    const {positions,periodW,periodH}=packing;

    clones.forEach(({el,source,tx,ty})=>{
      const p=positions.get(source);
      if(!p)return;

      if(el!==source){
        el.style.width=`${p.width}px`;
        el.style.height=`${p.height}px`;
      }

      const x=p.x+tx*periodW+offsetX;
      const y=p.y+ty*periodH+offsetY;
      el.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    });
  };

  const tick=()=>{
    if(!dragging){
      offsetX+=velX;
      offsetY+=velY;
      velX*=FRICTION;
      velY*=FRICTION;
      if(Math.abs(velX)<STOP_SPEED)velX=0;
      if(Math.abs(velY)<STOP_SPEED)velY=0;
    }

    offsetX=wrapOffset(offsetX,packing.periodW);
    offsetY=wrapOffset(offsetY,packing.periodH);
    layout();
    requestAnimationFrame(tick);
  };

  originals.forEach(tile=>{
    tile.addEventListener('mouseenter',()=>showMeta(tile));
    tile.addEventListener('mouseleave',hideMeta);
    tile.addEventListener('focus',()=>showMeta(tile));
    tile.addEventListener('blur',hideMeta);
    tile.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        openLightbox();
      }
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
    dragging=true;
    moved=false;
    pointerId=e.pointerId;
    lastX=e.clientX;
    lastY=e.clientY;
    lastT=e.timeStamp;
    velX=0;
    velY=0;
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

    const instantVX=dx/dt*16;
    const instantVY=dy/dt*16;
    velX=velX*.58+instantVX*.42;
    velY=velY*.58+instantVY*.42;

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

    if(moved){
      velX*=THROW_GAIN;
      velY*=THROW_GAIN;
    }else if(pressTile){
      openLightbox();
    }

    pointerId=null;
    pressTile=null;
  };

  viewport.addEventListener('pointerup',endPointer);
  viewport.addEventListener('pointercancel',()=>{
    dragging=false;
    pointerId=null;
    pressTile=null;
    velX=0;
    velY=0;
    viewport.classList.remove('is-dragging');
  });

  viewport.addEventListener('wheel',e=>{
    const dx=-(e.deltaX||e.deltaY*.45)*WHEEL_GAIN;
    const dy=-e.deltaY*WHEEL_GAIN;
    offsetX+=dx;
    offsetY+=dy;
    velX=velX*.45+dx*.09;
    velY=velY*.45+dy*.09;
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
    offsetX=start.x;
    offsetY=start.y;
    velX=0;
    velY=0;
    layout();
  });

  layout();
  tick();
})();
