(()=>{
  const viewport=document.querySelector('.film-viewport');
  if(!viewport)return;

  const legacyWork=new URLSearchParams(location.search).get('work');
  if(legacyWork){
    location.replace(`./work/?work=${encodeURIComponent(legacyWork)}`);
    return;
  }

  let press=null;

  const workHref=tile=>{
    const slug=tile?.dataset?.slug||tile?.dataset?.index||'';
    return slug?`./work/?work=${encodeURIComponent(slug)}`:'./work/';
  };

  const go=tile=>{
    if(!tile)return;
    const kind=tile.dataset.kind||'video';
    if(kind!=='video')return;
    location.assign(workHref(tile));
  };

  viewport.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const tile=event.target.closest?.('.film-tile');
    if(!tile)return;
    press={
      pointerId:event.pointerId,
      x:event.clientX,
      y:event.clientY,
      tile
    };
  },true);

  viewport.addEventListener('pointerup',event=>{
    if(!press||press.pointerId!==event.pointerId)return;
    const current=press;
    press=null;

    const distance=Math.hypot(event.clientX-current.x,event.clientY-current.y);
    if(distance>4)return;
    if((current.tile.dataset.kind||'video')!=='video')return;

    event.preventDefault();
    event.stopImmediatePropagation();
    go(current.tile);
  },true);

  viewport.addEventListener('pointercancel',()=>{press=null;},true);

  viewport.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const tile=event.target.closest?.('.film-tile');
    if(!tile||(tile.dataset.kind||'video')!=='video')return;
    event.preventDefault();
    event.stopImmediatePropagation();
    go(tile);
  },true);
})();
