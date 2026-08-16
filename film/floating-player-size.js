(()=>{
  const bound=new WeakSet();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let passEscape=false;

  const timings=()=>innerWidth<=820
    ? {shrink:300,fadeDelay:215,fade:140,finish:370}
    : {shrink:360,fadeDelay:260,fade:170,finish:450};

  const applySize=video=>{
    if(!video?.videoWidth||!video?.videoHeight)return;
    const frame=video.closest('.film-float-frame');
    if(!frame)return;

    const vw=Math.max(1,window.visualViewport?.width||innerWidth);
    const vh=Math.max(1,window.visualViewport?.height||innerHeight);
    const mobile=vw<=820;
    const maxW=vw*(mobile?.90:.92);
    const maxH=vh*(mobile?.76:.84);
    const nativeW=video.videoWidth;
    const nativeH=video.videoHeight;
    const scale=Math.min(1,maxW/nativeW,maxH/nativeH);
    const width=Math.max(1,Math.round(nativeW*scale));
    const height=Math.max(1,Math.round(nativeH*scale));

    frame.style.setProperty('--float-native-w',`${width}px`);
    frame.style.setProperty('--float-native-h',`${height}px`);
    frame.classList.add('has-intrinsic-size');
  };

  const finishReturn=overlay=>{
    if(!overlay?.isConnected)return;
    passEscape=true;
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    passEscape=false;
  };

  const beginReturn=overlay=>{
    if(!overlay||overlay.classList.contains('is-returning'))return;
    const video=overlay.querySelector('.film-float-video');
    const t=timings();

    video?.pause();
    overlay.classList.add('is-returning');
    overlay.classList.remove('is-open');
    document.documentElement.classList.remove('film-float-open');

    if(reducedMotion.matches){
      finishReturn(overlay);
      return;
    }

    setTimeout(()=>{
      if(overlay.isConnected)overlay.classList.add('is-return-fade');
    },t.fadeDelay);

    setTimeout(()=>finishReturn(overlay),t.finish);
  };

  const bind=video=>{
    if(!video||bound.has(video))return;
    bound.add(video);

    ['loadedmetadata','loadeddata','canplay','playing'].forEach(type=>{
      video.addEventListener(type,()=>applySize(video));
    });
    if(video.readyState>=1)applySize(video);
  };

  const scan=root=>{
    if(root instanceof Element&&root.matches?.('.film-float-video'))bind(root);
    root.querySelectorAll?.('.film-float-video').forEach(bind);
  };

  scan(document);

  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node instanceof Element)scan(node);
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});

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
    const overlay=document.querySelector('.film-float-overlay.is-open, .film-float-overlay:not(.is-returning)');
    if(!overlay)return;

    event.preventDefault();
    event.stopImmediatePropagation();
    beginReturn(overlay);
  },true);

  const resize=()=>document.querySelectorAll('.film-float-video').forEach(applySize);
  addEventListener('resize',resize,{passive:true});
  window.visualViewport?.addEventListener('resize',resize,{passive:true});
})();
