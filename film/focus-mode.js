(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const page=document.querySelector('.film-canvas-page');
  if(!viewport||!world||!page)return;

  let focused=null;
  let lastRatio='';
  let scheduled=false;
  let backgroundPointer=null;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  const clearFocusVisual=()=>{
    if(focused){
      focused.classList.remove('is-focus-centered');
      focused.style.removeProperty('--focus-w');
      focused.style.removeProperty('--focus-h');
    }
    focused=null;
    lastRatio='';
    page.classList.remove('has-focus');
    document.documentElement.classList.remove('film-focus-open');
  };

  const sizeFocusedTile=()=>{
    scheduled=false;
    const selected=world.querySelector('.film-tile.is-selected');
    if(!selected){
      clearFocusVisual();
      return;
    }

    if(selected!==focused){
      clearFocusVisual();
      focused=selected;
      page.classList.add('has-focus');
      document.documentElement.classList.add('film-focus-open');
      focused.classList.add('is-focus-centered');
    }

    const ratioKey=focused.dataset.selectedRatio||'';
    lastRatio=ratioKey;

    // film.js keeps the normal canvas size in the element's inline width/height
    // even while Focus CSS overrides the rendered size. Use those values so
    // playback/layout changes cannot disturb the viewport-centred position.
    const baseW=Math.max(1,parseFloat(focused.style.width)||focused.offsetWidth||1);
    const baseH=Math.max(1,parseFloat(focused.style.height)||focused.offsetHeight||1);
    const mobile=innerWidth<=820;
    const maxW=innerWidth*(mobile?.88:.64);
    const maxH=innerHeight*(mobile?.62:.68);
    const naturalRatio=Number(focused.dataset.selectedRatio||0);
    const ratio=Number.isFinite(naturalRatio)&&naturalRatio>0
      ? naturalRatio
      : baseW/baseH;

    let targetW=maxW;
    let targetH=targetW/ratio;
    if(targetH>maxH){
      targetH=maxH;
      targetW=targetH*ratio;
    }

    const desiredScale=Math.min(targetW/baseW,targetH/baseH);
    const scale=clamp(desiredScale,mobile?1.22:1.30,mobile?1.72:2.20);
    targetW=baseW*scale;
    targetH=baseH*scale;

    focused.style.setProperty('--focus-w',`${Math.round(targetW)}px`);
    focused.style.setProperty('--focus-h',`${Math.round(targetH)}px`);
    focused.classList.add('is-focus-centered');
  };

  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(sizeFocusedTile);
  };

  const observer=new MutationObserver(()=>{
    const selected=world.querySelector('.film-tile.is-selected');
    const ratio=selected?.dataset.selectedRatio||'';
    if(selected!==focused||ratio!==lastRatio)schedule();
  });
  observer.observe(world,{subtree:true,attributes:true,attributeFilter:['class','data-selected-ratio']});

  // Native video state changes can alter intrinsic dimensions/control chrome on
  // mobile Safari. Re-apply focus sizing, while CSS keeps the tile locked to
  // the exact viewport centre independently of the moving infinite canvas.
  ['loadedmetadata','loadeddata','play','durationchange'].forEach(type=>{
    world.addEventListener(type,event=>{
      if(event.target.closest?.('.film-tile.is-selected'))schedule();
    },true);
  });

  addEventListener('resize',schedule,{passive:true});

  // While focused, a background tap/click closes focus instead of starting a canvas drag.
  viewport.addEventListener('pointerdown',event=>{
    if(!focused||focused.contains(event.target))return;
    backgroundPointer=event.pointerId;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);

  viewport.addEventListener('pointerup',event=>{
    if(backgroundPointer!==event.pointerId)return;
    backgroundPointer=null;
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  },true);

  viewport.addEventListener('pointercancel',event=>{
    if(backgroundPointer===event.pointerId)backgroundPointer=null;
  },true);

  schedule();
})();
