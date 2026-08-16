(()=>{
  const bound=new WeakSet();

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

  const resize=()=>document.querySelectorAll('.film-float-video').forEach(applySize);
  addEventListener('resize',resize,{passive:true});
  window.visualViewport?.addEventListener('resize',resize,{passive:true});
})();
