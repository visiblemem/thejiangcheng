(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  if(!viewport||!world)return;

  let active=null;
  let press=null;
  let moved=false;

  const sourceVideoTime=tile=>{
    const video=tile.querySelector('.film-zone-preview,.film-inline-video');
    return video&&Number.isFinite(video.currentTime)?video.currentTime:0;
  };

  const makeSnapshot=tile=>{
    const snapshot=document.createElement('div');
    snapshot.className='film-fs-snapshot';
    const poster=tile.dataset.poster||'';
    if(poster){
      snapshot.style.backgroundImage=`url("${poster.replace(/"/g,'\\"')}")`;
      return snapshot;
    }
    const still=tile.querySelector('.film-still');
    if(still){
      const style=getComputedStyle(still);
      snapshot.style.backgroundImage=style.backgroundImage;
      snapshot.style.backgroundPosition=style.backgroundPosition;
      snapshot.style.backgroundSize=style.backgroundSize;
    }
    return snapshot;
  };

  const stageTransformFromRect=rect=>{
    const vw=Math.max(1,innerWidth);
    const vh=Math.max(1,window.visualViewport?.height||innerHeight);
    const sx=rect.width/vw;
    const sy=rect.height/vh;
    return `translate3d(${rect.left}px,${rect.top}px,0) scale(${sx},${sy})`;
  };

  const close=()=>{
    if(!active)return;
    const {overlay,stage,video,tile}=active;
    active=null;
    video.pause();
    overlay.classList.remove('is-video-ready','is-open');

    const rect=tile?.isConnected?tile.getBoundingClientRect():null;
    if(rect&&rect.width>0&&rect.height>0){
      stage.style.transform=stageTransformFromRect(rect);
    }else{
      stage.style.opacity='0';
    }

    const finish=()=>{
      overlay.remove();
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    };
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)finish();
    else setTimeout(finish,430);
  };

  const open=tile=>{
    if(active||!tile)return;
    const src=tile.dataset.video||'';
    if(!src)return;

    const rect=tile.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;

    const overlay=document.createElement('div');
    overlay.className='film-fs-launch';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label',tile.dataset.title||'Film player');

    const stage=document.createElement('div');
    stage.className='film-fs-stage';
    stage.style.transform=stageTransformFromRect(rect);

    const snapshot=makeSnapshot(tile);
    const video=document.createElement('video');
    video.className='film-fs-video';
    video.controls=true;
    video.playsInline=true;
    video.preload='auto';
    video.src=src;
    if(tile.dataset.poster)video.poster=tile.dataset.poster;

    const closeButton=document.createElement('button');
    closeButton.className='film-fs-close';
    closeButton.type='button';
    closeButton.textContent='CLOSE';
    closeButton.setAttribute('aria-label','Close film');

    stage.append(snapshot,video);
    overlay.append(stage,closeButton);
    document.body.appendChild(overlay);

    active={overlay,stage,video,tile};

    const startTime=sourceVideoTime(tile);
    const applyStart=()=>{
      if(startTime>0){
        try{video.currentTime=startTime;}catch(_){}
      }
      video.play().catch(()=>{});
    };
    if(video.readyState>=1)applyStart();
    else video.addEventListener('loadedmetadata',applyStart,{once:true});

    const reveal=()=>{
      if(active?.video===video)overlay.classList.add('is-video-ready');
    };
    video.addEventListener('playing',reveal,{once:true});
    video.addEventListener('loadeddata',()=>{
      if(!video.paused)reveal();
    },{once:true});

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        if(active?.overlay!==overlay)return;
        overlay.classList.add('is-open');
        stage.style.transform='translate3d(0,0,0) scale(1,1)';
      });
    });

    closeButton.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      close();
    });
  };

  viewport.addEventListener('pointerdown',event=>{
    const tile=event.target.closest?.('.film-tile[data-video]');
    if(!tile)return;
    press={id:event.pointerId,x:event.clientX,y:event.clientY,tile};
    moved=false;
  },true);

  viewport.addEventListener('pointermove',event=>{
    if(!press||event.pointerId!==press.id)return;
    if(Math.hypot(event.clientX-press.x,event.clientY-press.y)>7)moved=true;
  },true);

  viewport.addEventListener('pointercancel',event=>{
    if(press&&event.pointerId===press.id){press=null;moved=false;}
  },true);

  viewport.addEventListener('click',event=>{
    const tile=event.target.closest?.('.film-tile[data-video]');
    if(!tile||!press||press.tile!==tile||moved){press=null;moved=false;return;}
    press=null;
    moved=false;
    event.preventDefault();
    event.stopPropagation();
    open(tile);
  },true);

  addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active){
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  },true);
})();
