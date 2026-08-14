(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const page=document.querySelector('.film-canvas-page');
  if(!viewport||!world||!page)return;

  let focused=null;
  let lastRatio='';
  let scheduled=false;
  let resizeObserver=null;
  let backgroundPointer=null;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  const clearFocusVisual=()=>{
    if(focused){
      focused.classList.remove('is-focus-centered','is-focus-measuring');
      focused.style.removeProperty('--focus-x');
      focused.style.removeProperty('--focus-y');
      focused.style.removeProperty('--focus-w');
      focused.style.removeProperty('--focus-h');
    }
    resizeObserver?.disconnect();
    resizeObserver=null;
    focused=null;
    lastRatio='';
    page.classList.remove('has-focus');
    document.documentElement.classList.remove('film-focus-open');
  };

  const measureAndCenter=()=>{
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
      resizeObserver=new ResizeObserver(()=>schedule());
      resizeObserver.observe(focused);
    }

    const ratioKey=focused.dataset.selectedRatio||'';
    lastRatio=ratioKey;

    // Measure the tile at its normal canvas position/size, then overlay focus sizing.
    focused.classList.add('is-focus-measuring');
    focused.classList.remove('is-focus-centered');
    const rect=focused.getBoundingClientRect();

    const mobile=innerWidth<=820;
    const maxW=innerWidth*(mobile?.88:.64);
    const maxH=innerHeight*(mobile?.62:.68);
    const naturalRatio=Number(focused.dataset.selectedRatio||0);
    const ratio=Number.isFinite(naturalRatio)&&naturalRatio>0
      ? naturalRatio
      : (rect.width/Math.max(1,rect.height));

    let targetW=maxW;
    let targetH=targetW/ratio;
    if(targetH>maxH){
      targetH=maxH;
      targetW=targetH*ratio;
    }

    // Focus must feel enlarged, but never become a fullscreen takeover.
    const baseW=Math.max(1,rect.width);
    const baseH=Math.max(1,rect.height);
    const desiredScale=Math.min(targetW/baseW,targetH/baseH);
    const scale=clamp(desiredScale,mobile?1.22:1.30,mobile?1.72:2.20);
    targetW=baseW*scale;
    targetH=baseH*scale;

    const cx=rect.left+rect.width/2;
    const cy=rect.top+rect.height/2;
    const dx=innerWidth/2-cx;
    const dy=innerHeight/2-cy;

    focused.style.setProperty('--focus-x',`${dx}px`);
    focused.style.setProperty('--focus-y',`${dy}px`);
    focused.style.setProperty('--focus-w',`${Math.round(targetW)}px`);
    focused.style.setProperty('--focus-h',`${Math.round(targetH)}px`);
    focused.classList.remove('is-focus-measuring');
    focused.classList.add('is-focus-centered');
  };

  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(measureAndCenter);
  };

  const observer=new MutationObserver(()=>{
    const selected=world.querySelector('.film-tile.is-selected');
    const ratio=selected?.dataset.selectedRatio||'';
    if(selected!==focused||ratio!==lastRatio)schedule();
  });
  observer.observe(world,{subtree:true,attributes:true,attributeFilter:['class','data-selected-ratio']});

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
