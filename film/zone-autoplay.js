(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const expanded=document.querySelector('.film-expanded');
  if(!viewport||!world)return;

  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const active=new Map();
  let lastScan=0;

  // Detection zone = viewport inset by 20% on every side.
  // Any part of a video tile touching this central 60% x 60% area qualifies.
  const zoneRect=()=>({
    left:innerWidth*.20,
    right:innerWidth*.80,
    top:innerHeight*.20,
    bottom:innerHeight*.80
  });

  const stopTile=tile=>{
    const video=active.get(tile);
    if(video){
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    }
    tile?.classList.remove('is-zone-playing');
    active.delete(tile);
  };

  const stopAll=()=>{
    [...active.keys()].forEach(stopTile);
  };

  const playTile=tile=>{
    if(!tile||active.has(tile))return;
    const src=tile.dataset.video;
    if(!src)return;

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

    active.set(tile,video);
    tile.appendChild(video);

    video.addEventListener('playing',()=>{
      if(active.get(tile)===video)tile.classList.add('is-zone-playing');
    },{once:true});

    video.play().catch(()=>{
      if(active.get(tile)===video)stopTile(tile);
    });
  };

  const syncZone=()=>{
    if(
      reducedMotion.matches||
      document.hidden||
      expanded?.classList.contains('is-open')||
      world.querySelector('.film-tile.is-selected')
    ){
      stopAll();
      return;
    }

    const zone=zoneRect();
    const wanted=new Set();

    world.querySelectorAll('.film-tile[data-video]').forEach(tile=>{
      if(tile.querySelector('.film-inline-video'))return;
      const rect=tile.getBoundingClientRect();

      if(rect.right<=0||rect.left>=innerWidth||rect.bottom<=0||rect.top>=innerHeight)return;

      const touchesZone=
        rect.right>zone.left&&
        rect.left<zone.right&&
        rect.bottom>zone.top&&
        rect.top<zone.bottom;

      if(touchesZone)wanted.add(tile);
    });

    [...active.keys()].forEach(tile=>{
      if(!wanted.has(tile))stopTile(tile);
    });

    wanted.forEach(playTile);
  };

  const tick=time=>{
    if(time-lastScan>=70){
      lastScan=time;
      syncZone();
    }
    requestAnimationFrame(tick);
  };

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stopAll();
  });

  reducedMotion.addEventListener?.('change',()=>{
    if(reducedMotion.matches)stopAll();
  });

  requestAnimationFrame(tick);
})();
