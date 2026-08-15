(()=>{
  const bindVideo=video=>{
    if(!video||video.dataset.jcPlaybackGuard==='1')return;
    video.dataset.jcPlaybackGuard='1';

    const tile=video.closest('.film-tile');
    const poster=tile?.dataset.poster||'';
    if(poster&&!video.poster)video.poster=poster;

    // Native video controls own these gestures. Prevent Film canvas tap/double-tap
    // handlers from interpreting Play / Pause / scrub actions as canvas gestures.
    video.addEventListener('pointerup',event=>{
      event.stopImmediatePropagation();
    },{capture:true});

    video.addEventListener('click',event=>{
      event.stopPropagation();
    });

    video.addEventListener('dblclick',event=>{
      event.stopImmediatePropagation();
    },{capture:true});
  };

  const scan=root=>{
    if(root instanceof Element&&root.matches?.('video.film-inline-video'))bindVideo(root);
    root.querySelectorAll?.('video.film-inline-video').forEach(bindVideo);
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
})();
