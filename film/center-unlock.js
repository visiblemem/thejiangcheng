(()=>{
  const world=document.querySelector('.film-world');
  const expanded=document.querySelector('.film-expanded');
  if(!world)return;

  let token=0;
  let lastSelected=null;

  const scheduleUnlock=selected=>{
    const current=++token;
    lastSelected=selected;
    if(!selected)return;

    const delay=innerWidth<=820?390:470;
    setTimeout(()=>{
      if(current!==token)return;
      if(expanded?.classList.contains('is-open'))return;
      const stillSelected=world.querySelector('.film-tile.is-selected');
      if(stillSelected!==selected)return;

      // film.js owns the internal selectedEl reference, so use its existing
      // Escape path to clear selection cleanly after the centering tween.
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    },delay);
  };

  const observer=new MutationObserver(()=>{
    const selected=world.querySelector('.film-tile.is-selected');
    if(selected===lastSelected)return;
    scheduleUnlock(selected);
  });

  observer.observe(world,{subtree:true,attributes:true,attributeFilter:['class']});
  scheduleUnlock(world.querySelector('.film-tile.is-selected'));
})();
