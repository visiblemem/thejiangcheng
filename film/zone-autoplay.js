(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const expanded=document.querySelector('.film-expanded');
  if(!viewport||!world)return;

  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const previews=new Map();
  let lastScan=0;

  const zoneRect=()=>({
    left:innerWidth*.20,
    right:innerWidth*.80,
    top:innerHeight*.20,
    bottom:innerHeight*.80
  });

  const keepRect=()=>({
    left:-innerWidth*.10,
    right:innerWidth*1.10,
    top:-innerHeight*.10,
    bottom:innerHeight*1.10
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

  const pauseTile=tile=>{
    const video=previews.get(tile);
    if(video&&!video.paused)video.pause();
    tile?.classList.remove('is-zone-playing');
    if(video&&video.readyState>=2)tile?.classList.add('has-zone-frame');
  };

  const pauseAll=()=>previews.forEach((_,tile)=>pauseTile(tile));

  const ensureVideo=tile=>{
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
    video.preload='metadata';
    video.setAttribute('muted','');
    video.setAttribute('playsinline','');
    video.setAttribute('aria-hidden','true');
    video.tabIndex=-1;
    video.src=src;

    previews.set(tile,video);
    tile.appendChild(video);
    return video;
  };

  const playTile=tile=>{
    const video=ensureVideo(tile);
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

    const floating=document.documentElement.classList.contains('film-float-preparing')||
      document.documentElement.classList.contains('film-float-open');

    if(
      document.hidden||
      expanded?.classList.contains('is-open')||
      floating
    ){
      pauseAll();
      return;
    }

    const zone=zoneRect();
    const keep=keepRect();
    const wantedToPlay=new Set();

    world.querySelectorAll('.film-tile[data-video]').forEach(tile=>{
      const rect=tile.getBoundingClientRect();
      if(intersects(rect,zone))wantedToPlay.add(tile);
    });

    previews.forEach((_,tile)=>{
      const rect=tile.getBoundingClientRect();
      if(!intersects(rect,keep))removePreview(tile);
      else if(!wantedToPlay.has(tile))pauseTile(tile);
    });

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
