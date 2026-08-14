(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const expanded=document.querySelector('.film-expanded');
  if(!viewport||!world)return;

  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const previews=new Map();
  let lastScan=0;

  // Detection zone = viewport inset by 20% on every side.
  // Any part of a video tile touching this central 60% x 60% area plays.
  const zoneRect=()=>({
    left:innerWidth*.20,
    right:innerWidth*.80,
    top:innerHeight*.20,
    bottom:innerHeight*.80
  });

  const removePreview=tile=>{
    const video=previews.get(tile);
    if(video){
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    }
    tile?.classList.remove('is-zone-playing');
    previews.delete(tile);
  };

  // Pause only: keep the video element and decoded frame visible.
  // Re-entering the zone resumes from the same currentTime.
  const pauseTile=tile=>{
    const video=previews.get(tile);
    if(video&&!video.paused)video.pause();
  };

  const pauseAll=()=>{
    previews.forEach(video=>{
      if(!video.paused)video.pause();
    });
  };

  const playTile=tile=>{
    if(!tile)return;
    const src=tile.dataset.video;
    if(!src)return;

    let video=previews.get(tile);
    if(!video){
      video=document.createElement('video');
      video.className='film-zone-preview';
      video.muted=true;
      video.defaultMuted=true;
      video.autoplay=false;
      video.loop=true;
      video.playsInline=true;
      video.preload='metadata';
      video.setAttribute('muted','');
      video.setAttribute('playsinline','');
      video.setAttribute('aria-hidden','true');
      video.tabIndex=-1;
      video.src=src;

      previews.set(tile,video);
      tile.appendChild(video);

      video.addEventListener('loadeddata',()=>{
        if(previews.get(tile)===video)tile.classList.add('is-zone-playing');
      },{once:true});
    }

    if(video.paused){
      video.play().then(()=>{
        if(previews.get(tile)===video)tile.classList.add('is-zone-playing');
      }).catch(()=>{});
    }
  };

  const syncZone=()=>{
    // Remove previews whose clone/tile no longer exists after a layout rebuild.
    [...previews.keys()].forEach(tile=>{
      if(!tile.isConnected)removePreview(tile);
    });

    if(
      reducedMotion.matches||
      document.hidden||
      expanded?.classList.contains('is-open')||
      world.querySelector('.film-tile.is-selected')
    ){
      pauseAll();
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

    // Leaving the zone freezes on the current decoded frame.
    previews.forEach((video,tile)=>{
      if(!wanted.has(tile))pauseTile(tile);
    });

    // Entering/re-entering the zone starts or resumes playback.
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
    if(document.hidden)pauseAll();
  });

  reducedMotion.addEventListener?.('change',()=>{
    if(reducedMotion.matches)pauseAll();
  });

  requestAnimationFrame(tick);
})();
