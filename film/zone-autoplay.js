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

  // Keep previews alive slightly beyond the viewport so nearby tiles already
  // have a decoded frame when they slide on screen. Far-away previews unload.
  const preloadRect=()=>({
    left:-innerWidth*.25,
    right:innerWidth*1.25,
    top:-innerHeight*.25,
    bottom:innerHeight*1.25
  });

  const intersects=(rect,area)=>
    rect.right>area.left&&
    rect.left<area.right&&
    rect.bottom>area.top&&
    rect.top<area.bottom;

  const removePreview=tile=>{
    const video=previews.get(tile);
    if(video){
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    }
    tile?.classList.remove('is-zone-playing','has-zone-frame');
    previews.delete(tile);
  };

  const markFrameReady=(tile,video)=>{
    if(previews.get(tile)!==video)return;
    tile.classList.add('has-zone-frame');
  };

  const primeFirstFrame=(tile,video)=>{
    if(video.dataset.primed==='1')return;
    video.dataset.primed='1';

    const reveal=()=>markFrameReady(tile,video);

    video.addEventListener('loadeddata',reveal,{once:true});
    video.addEventListener('seeked',()=>{
      video.pause();
      reveal();
    },{once:true});

    video.addEventListener('loadedmetadata',()=>{
      if(previews.get(tile)!==video)return;
      const duration=Number.isFinite(video.duration)?video.duration:0;
      const target=duration>0?Math.min(.08,Math.max(0,duration-.01)):.08;
      try{
        if(Math.abs(video.currentTime-target)>.01)video.currentTime=target;
      }catch(_){}
    },{once:true});
  };

  const ensurePreview=tile=>{
    if(!tile)return null;
    const src=tile.dataset.video;
    if(!src)return null;

    let video=previews.get(tile);
    if(video)return video;

    video=document.createElement('video');
    video.className='film-zone-preview';
    video.muted=true;
    video.defaultMuted=true;
    video.autoplay=false;
    video.loop=true;
    video.playsInline=true;
    video.preload='auto';
    video.setAttribute('muted','');
    video.setAttribute('playsinline','');
    video.setAttribute('aria-hidden','true');
    video.tabIndex=-1;
    video.src=src;

    previews.set(tile,video);
    tile.appendChild(video);
    primeFirstFrame(tile,video);
    video.load();
    return video;
  };

  // Pause only: decoded frame stays visible. Re-entering the zone resumes
  // from this exact currentTime rather than restarting from zero.
  const pauseTile=tile=>{
    const video=previews.get(tile);
    if(video&&!video.paused)video.pause();
    tile?.classList.remove('is-zone-playing');
    if(video&&video.readyState>=2)tile?.classList.add('has-zone-frame');
  };

  const pauseAll=()=>{
    previews.forEach((video,tile)=>pauseTile(tile));
  };

  const playTile=tile=>{
    const video=ensurePreview(tile);
    if(!video)return;

    video.play().then(()=>{
      if(previews.get(tile)!==video)return;
      tile.classList.add('has-zone-frame','is-zone-playing');
    }).catch(()=>{});
  };

  const syncZone=()=>{
    [...previews.keys()].forEach(tile=>{
      if(!tile.isConnected)removePreview(tile);
    });

    if(
      document.hidden||
      expanded?.classList.contains('is-open')||
      world.querySelector('.film-tile.is-selected')
    ){
      pauseAll();
      return;
    }

    const zone=zoneRect();
    const preload=preloadRect();
    const wantedToPlay=new Set();
    const wantedToKeep=new Set();

    world.querySelectorAll('.film-tile[data-video]').forEach(tile=>{
      if(tile.querySelector('.film-inline-video'))return;
      const rect=tile.getBoundingClientRect();

      if(intersects(rect,preload)){
        wantedToKeep.add(tile);
        ensurePreview(tile);
      }

      if(intersects(rect,zone))wantedToPlay.add(tile);
    });

    // Once a tile is far outside the screen, release the decoder/memory.
    [...previews.keys()].forEach(tile=>{
      if(!wantedToKeep.has(tile))removePreview(tile);
    });

    // Inside preload area but outside the 20% inset playback zone: freeze.
    previews.forEach((video,tile)=>{
      if(!wantedToPlay.has(tile))pauseTile(tile);
    });

    // Any number of tiles touching the playback zone can run simultaneously.
    if(!reducedMotion.matches)wantedToPlay.forEach(playTile);
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
