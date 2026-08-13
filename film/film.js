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
  originals.forEach(tile=>{
    const i=(Number(tile.dataset.index||1)-1+16)%16;
    const col=i%4,row=Math.floor(i/4);
    tile.style.setProperty('--sprite-pos',`${(col*33.333).toFixed(3)}% ${(row*33.333).toFixed(3)}%`);
  });

  const TILE_W=innerWidth<=820?1040:1600;
  const TILE_H=innerWidth<=820?760:1040;
  const clones=[];
  for(let ty=-1;ty<=1;ty++)for(let tx=-1;tx<=1;tx++){
    originals.forEach(source=>{
      const el=(tx===0&&ty===0)?source:source.cloneNode(true);
      if(el!==source){el.removeAttribute('tabindex');el.setAttribute('aria-hidden','true');world.appendChild(el);}
      clones.push({el,source,tx,ty});
    });
  }

  let offsetX=0,offsetY=0;
  let velX=0,velY=0,dragging=false,moved=false,pointerId=null,lastX=0,lastY=0,lastT=0,pressTile=null;

  const layout=()=>{
    const vw=innerWidth,vh=innerHeight;
    const lens=Math.min(vw,vh)*0.72;
    clones.forEach(({el,source,tx,ty})=>{
      const baseX=Number(source.dataset.x||0)*TILE_W;
      const baseY=Number(source.dataset.y||0)*TILE_H;
      const rawX=baseX+tx*TILE_W+offsetX;
      const rawY=baseY+ty*TILE_H+offsetY;

      const dx=rawX-vw/2,dy=rawY-vh/2;
      const r=Math.hypot(dx,dy);
      const n=Math.min(1.65,r/Math.max(1,lens));

      // Barrel/fisheye warp: keep the grid mathematically regular, then bend it radially.
      const radial=1+0.115*n*n;
      const warpedX=vw/2+dx*radial;
      const warpedY=vh/2+dy*radial;
      const scale=Math.max(.70,1-.13*n+.045*n*n);
      const opacity=Math.max(.46,1-n*.26);

      el.style.transform=`translate3d(${warpedX}px,${warpedY}px,0) translate(-50%,-50%) scale(${scale})`;
      el.style.opacity=String(opacity);
      el.style.zIndex=String(Math.max(1,12-Math.round(n*5)));
    });
  };

  const tick=()=>{
    if(!dragging){
      offsetX+=velX;offsetY+=velY;
      velX*=.92;velY*=.92;
      if(Math.abs(velX)<.02)velX=0;if(Math.abs(velY)<.02)velY=0;
    }
    if(offsetX>TILE_W||offsetX<-TILE_W)offsetX=((offsetX+TILE_W)%TILE_W+TILE_W)%TILE_W-TILE_W;
    if(offsetY>TILE_H||offsetY<-TILE_H)offsetY=((offsetY+TILE_H)%TILE_H+TILE_H)%TILE_H-TILE_H;
    layout();requestAnimationFrame(tick);
  };

  const showMeta=tile=>{
    if(!meta||!tile)return;
    metaCode.textContent=tile.dataset.code||'';
    metaTitle.textContent=tile.dataset.title||'';
    metaDuration.textContent=tile.dataset.duration||'';
    meta.classList.add('is-on');
  };
  const hideMeta=()=>meta?.classList.remove('is-on');

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

  const openLightbox=()=>{
    if(!lightbox||!lightboxVideo)return;
    lightbox.classList.add('is-open');lightbox.setAttribute('aria-hidden','false');
    lightboxVideo.play().catch(()=>{});
  };
  const closeLightbox=()=>{
    if(!lightbox||!lightboxVideo)return;
    lightboxVideo.pause();lightboxVideo.currentTime=0;
    lightbox.classList.remove('is-open');lightbox.setAttribute('aria-hidden','true');
  };

  viewport.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    dragging=true;moved=false;pointerId=e.pointerId;lastX=e.clientX;lastY=e.clientY;lastT=e.timeStamp;velX=velY=0;
    pressTile=e.target.closest?.('.film-tile')||null;
    viewport.classList.add('is-dragging');viewport.setPointerCapture?.(pointerId);
  });
  viewport.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const dx=e.clientX-lastX,dy=e.clientY-lastY,dt=Math.max(1,e.timeStamp-lastT);
    if(Math.hypot(dx,dy)>1)moved=true;
    offsetX+=dx;offsetY+=dy;velX=dx/dt*16;velY=dy/dt*16;
    lastX=e.clientX;lastY=e.clientY;lastT=e.timeStamp;
    if(moved)page?.classList.add('has-moved');
    e.preventDefault();
  },{passive:false});
  const endPointer=e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    dragging=false;viewport.classList.remove('is-dragging');
    try{viewport.releasePointerCapture?.(pointerId)}catch(_){ }
    if(!moved&&pressTile)openLightbox();
    pointerId=null;pressTile=null;
  };
  viewport.addEventListener('pointerup',endPointer);
  viewport.addEventListener('pointercancel',()=>{dragging=false;pointerId=null;pressTile=null;viewport.classList.remove('is-dragging')});

  viewport.addEventListener('wheel',e=>{
    offsetX-=e.deltaX||e.deltaY*.45;
    offsetY-=e.deltaY;
    velX=-(e.deltaX||e.deltaY*.45)*.12;velY=-e.deltaY*.12;
    page?.classList.add('has-moved');
    e.preventDefault();
  },{passive:false});

  originals.forEach(tile=>tile.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLightbox();}}));
  lightboxClose?.addEventListener('click',closeLightbox);
  lightbox?.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});
  addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();});
  addEventListener('resize',layout);
  layout();tick();
})();
