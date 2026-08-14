(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const expanded=document.querySelector('.film-expanded');
  if(!viewport||!world)return;

  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let activeTile=null;
  let activeVideo=null;
  let lastScan=0;

  const zoneRect=()=>{
    const mobile=innerWidth<=820;
    const width=innerWidth*(mobile?.72:.48);
    const height=innerHeight*(mobile?.46:.56);
    return {
      left:(innerWidth-width)/2,
      right:(innerWidth+width)/2,
      top:(innerHeight-height)/2,
      bottom:(innerHeight+height)/2,
      cx:innerWidth/2,
      cy:innerHeight/2,
      width,
      height
    };
  };

  const stopActive=()=>{
    if(activeVideo){
      activeVideo.pause();
      activeVideo.removeAttribute('src');
      activeVideo.load();
      activeVideo.remove();
    }
    activeTile?.classList.remove('is-zone-playing');
    activeTile=null;
    activeVideo=null;
  };

  const playTile=tile=>{
    if(!tile||tile===activeTile)return;
    const src=tile.dataset.video;
    if(!src){
      stopActive();
      return;
    }

    stopActive();

    const video=document.createElement('video');
    video.className='film-zone-preview';
    video.muted=true;
    video.defaultMuted=true;
    video.autoplay=true;
    video.loop=true;
    video.playsInline=true;
    video.preload='metadata';
    video.setAttribute('muted','');
    video.setAttribute('playsinline','');
    video.setAttribute('aria-hidden','true');
    video.tabIndex=-1;
    video.src=src;

    activeTile=tile;
    activeVideo=video;
    tile.appendChild(video);

    video.addEventListener('playing',()=>{
      if(activeVideo===video)tile.classList.add('is-zone-playing');
    },{once:true});

    video.play().catch(()=>{
      if(activeVideo===video)stopActive();
    });
  };

  const chooseActive=()=>{
    if(reducedMotion.matches||document.hidden||expanded?.classList.contains('is-open')||world.querySelector('.film-tile.is-selected')){
      stopActive();
      return;
    }

    const zone=zoneRect();
    let best=null;
    let bestScore=Infinity;

    world.querySelectorAll('.film-tile[data-video]').forEach(tile=>{
      if(tile.querySelector('.film-inline-video'))return;
      const rect=tile.getBoundingClientRect();
      if(rect.right<=0||rect.left>=innerWidth||rect.bottom<=0||rect.top>=innerHeight)return;

      const cx=rect.left+rect.width/2;
      const cy=rect.top+rect.height/2;
      if(cx<zone.left||cx>zone.right||cy<zone.top||cy>zone.bottom)return;

      const dx=(cx-zone.cx)/zone.width;
      const dy=(cy-zone.cy)/zone.height;
      const score=dx*dx+dy*dy;
      if(score<bestScore){
        bestScore=score;
        best=tile;
      }
    });

    if(best)playTile(best);
    else stopActive();
  };

  const tick=time=>{
    if(time-lastScan>=70){
      lastScan=time;
      chooseActive();
    }
    requestAnimationFrame(tick);
  };

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stopActive();
  });
  reducedMotion.addEventListener?.('change',()=>{
    if(reducedMotion.matches)stopActive();
  });

  requestAnimationFrame(tick);
})();
