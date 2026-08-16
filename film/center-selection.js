(()=>{
  const world=document.querySelector('.film-world');
  if(!world)return;

  const cleanSelected=tile=>{
    if(!tile)return;
    tile.querySelector('.film-inline-video')?.remove();
    tile.querySelector('.film-inline-image')?.remove();
    tile.querySelector('.film-inline-title')?.remove();
    delete tile.dataset.selectedRatio;
    tile.classList.add('is-center-only');
  };

  const sync=()=>{
    world.querySelectorAll('.film-tile.is-center-only:not(.is-selected)').forEach(tile=>tile.classList.remove('is-center-only'));
    const selected=world.querySelector('.film-tile.is-selected');
    if(selected)cleanSelected(selected);
  };

  const observer=new MutationObserver(sync);
  observer.observe(world,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-selected-ratio']});
  sync();
})();
