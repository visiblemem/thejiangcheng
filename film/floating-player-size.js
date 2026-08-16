(()=>{
  const bound=new WeakSet();
  const states=new WeakMap();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let passEscape=false;

  const timings=()=>innerWidth<=820
    ? {open:270,shrink:240,fade:120}
    : {open:320,shrink:280,fade:140};

  const measureTarget=video=>{
    if(!video?.videoWidth||!video?.videoHeight)return null;
    const vw=Math.max(1,window.visualViewport?.width||innerWidth);
    const vh=Math.max(1,window.visualViewport?.height||innerHeight);
    const mobile=vw<=820;
    const maxW=vw*(mobile?.90:.92);
    const maxH=vh*(mobile?.76:.84);
    const scale=Math.min(1,maxW/video.videoWidth,maxH/video.videoHeight);
    return {
      width:Math.max(1,Math.round(video.videoWidth*scale)),
      height:Math.max(1,Math.round(video.videoHeight*scale))
    };
  };

  const openRequested=video=>{
    const overlay=video.closest('.film-float-overlay');
    return Boolean(
      overlay&&
      !overlay.classList.contains('is-returning')&&
      (document.documentElement.classList.contains('film-float-open')||overlay.classList.contains('is-open'))
    );
  };

  const startOpen=video=>{
    if(!video||!openRequested(video))return;
    const frame=video.closest('.film-float-frame');
    const overlay=video.closest('.film-float-overlay');
    if(!frame||!overlay)return;

    const target=measureTarget(video);
    if(!target)return;

    let state=states.get(video);
    if(!state){state={opened:false,returning:false,controlsTimer:null};states.set(video,state);}
    if(state.opened||state.returning)return;

    // film.js has just put the frame at the centred tile's exact 5:4 size.
    // Capture that once, then switch the element to its final intrinsic size
    // without animating width/height. The visual size is preserved by FLIP scale.
    const tileW=Math.max(1,parseFloat(frame.style.width)||frame.getBoundingClientRect().width||1);
    const tileH=Math.max(1,parseFloat(frame.style.height)||frame.getBoundingClientRect().height||1);
    state.tileW=tileW;
    state.tileH=tileH;
    state.targetW=target.width;
    state.targetH=target.height;

    const sx=tileW/target.width;
    const sy=tileH/target.height;
    frame.style.setProperty('--float-native-w',`${target.width}px`);
    frame.style.setProperty('--float-native-h',`${target.height}px`);
    frame.style.setProperty('--float-start-sx',String(sx));
    frame.style.setProperty('--float-start-sy',String(sy));
    frame.style.width=`${target.width}px`;
    frame.style.height=`${target.height}px`;
    frame.classList.add('has-intrinsic-size');
    frame.classList.remove('is-flip-open','is-flip-return');

    // Force one style flush while the overlay is still at the tile-sized FLIP
    // transform, then start the GPU-only scale in the same task. No extra RAF.
    frame.getBoundingClientRect();
    video.controls=false;
    frame.classList.add('is-flip-open');
    state.opened=true;

    const t=timings();
    clearTimeout(state.controlsTimer);
    state.controlsTimer=setTimeout(()=>{
      if(!state.returning&&overlay.isConnected)video.controls=true;
    },t.open+30);
  };

  const finishReturn=overlay=>{
    if(!overlay?.isConnected)return;
    passEscape=true;
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    passEscape=false;
  };

  const beginReturn=overlay=>{
    if(!overlay||overlay.classList.contains('is-returning'))return;
    const frame=overlay.querySelector('.film-float-frame');
    const video=overlay.querySelector('.film-float-video');
    if(!frame||!video){finishReturn(overlay);return;}

    let state=states.get(video);
    if(!state){state={opened:true,returning:false,controlsTimer:null};states.set(video,state);}
    state.returning=true;
    clearTimeout(state.controlsTimer);
    video.controls=false;
    video.pause();

    overlay.classList.add('is-returning');
    overlay.classList.remove('is-open');
    document.documentElement.classList.remove('film-float-open');
    frame.classList.remove('is-flip-open');
    frame.classList.add('is-flip-return');

    if(reducedMotion.matches){
      finishReturn(overlay);
      return;
    }

    const t=timings();
    setTimeout(()=>{
      if(overlay.isConnected)overlay.classList.add('is-return-fade');
    },t.shrink);
    setTimeout(()=>finishReturn(overlay),t.shrink+t.fade+25);
  };

  const bind=video=>{
    if(!video||bound.has(video))return;
    bound.add(video);
    states.set(video,{opened:false,returning:false,controlsTimer:null});

    const maybeOpen=()=>startOpen(video);
    ['loadedmetadata','loadeddata','canplay'].forEach(type=>{
      video.addEventListener(type,maybeOpen,{passive:true});
    });
    if(video.readyState>=1)maybeOpen();
  };

  const scan=root=>{
    if(root instanceof Element&&root.matches?.('.film-float-video'))bind(root);
    root.querySelectorAll?.('.film-float-video').forEach(bind);
  };

  scan(document);

  const domObserver=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node instanceof Element)scan(node);
      }
    }
  });
  domObserver.observe(document.body,{childList:true,subtree:true});

  // film.js signals that centering is complete by adding film-float-open to <html>.
  // Start the FLIP immediately in that same microtask, before the next paint.
  const stateObserver=new MutationObserver(()=>{
    if(!document.documentElement.classList.contains('film-float-open'))return;
    document.querySelectorAll('.film-float-video').forEach(startOpen);
  });
  stateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});

  document.addEventListener('click',event=>{
    const overlay=event.target instanceof Element
      ? event.target.closest('.film-float-overlay')
      : null;
    if(!overlay||event.target!==overlay)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginReturn(overlay);
  },true);

  addEventListener('keydown',event=>{
    if(passEscape||event.key!=='Escape')return;
    const overlay=document.querySelector('.film-float-overlay:not(.is-returning)');
    if(!overlay)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    beginReturn(overlay);
  },true);

  const resize=()=>{
    document.querySelectorAll('.film-float-video').forEach(video=>{
      const state=states.get(video);
      if(!state||state.returning)return;
      const target=measureTarget(video);
      const frame=video.closest('.film-float-frame');
      if(!target||!frame)return;
      state.targetW=target.width;
      state.targetH=target.height;
      frame.style.width=`${target.width}px`;
      frame.style.height=`${target.height}px`;
      frame.style.setProperty('--float-native-w',`${target.width}px`);
      frame.style.setProperty('--float-native-h',`${target.height}px`);
      if(state.tileW&&state.tileH){
        frame.style.setProperty('--float-start-sx',String(state.tileW/target.width));
        frame.style.setProperty('--float-start-sy',String(state.tileH/target.height));
      }
    });
  };
  addEventListener('resize',resize,{passive:true});
  window.visualViewport?.addEventListener('resize',resize,{passive:true});
})();
