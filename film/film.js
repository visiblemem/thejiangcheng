(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const page=document.querySelector('.film-canvas-page');
  const meta=document.querySelector('.film-hover-meta');
  const metaCode=meta?.querySelector('.hover-code');
  const metaTitle=meta?.querySelector('.hover-title');
  const metaDuration=meta?.querySelector('.hover-duration');
  const expanded=document.querySelector('.film-expanded');
  const expandedFrame=expanded?.querySelector('.film-expanded-frame');
  const expandedVideo=expanded?.querySelector('.film-expanded-video');
  const expandedTitle=expanded?.querySelector('.film-expanded-title');
  const expandedClose=expanded?.querySelector('.film-expanded-close');
  if(!viewport||!world)return;

  fetch('./film-sprite.txt')
    .then(r=>r.ok?r.text():Promise.reject())
    .then(data=>document.documentElement.style.setProperty('--film-sprite',`url("data:image/webp;base64,${data.replace(/\s/g,'')}")`))
    .catch(()=>{});

  const originals=[...world.querySelectorAll('.film-tile')];
  originals.forEach((tile,index)=>{
    const spriteIndex=(Number(tile.dataset.index||index+1)-1+16)%16;
    const col=spriteIndex%4;
    const row=Math.floor(spriteIndex/4);
    tile.style.setProperty('--sprite-pos',`${(col*33.333).toFixed(3)}% ${(row*33.333).toFixed(3)}%`);
  });

  const canvasSizing=()=>{
    const mobile=innerWidth<=820;
    if(mobile){
      const gapX=Math.max(16,Math.min(22,innerWidth*.045));
      const gapY=Math.max(18,Math.min(26,innerWidth*.05));
      const height=Math.max(168,Math.min(196,innerWidth*.47));
      return {mobile,gapX,gapY,height,width:Math.round(height*5/4),perRow:2};
    }
    const gapX=10;
    const gapY=10;
    const height=Math.max(220,Math.min(290,innerWidth*.195));
    return {mobile,gapX,gapY,height,width:Math.round(height*5/4),perRow:4};
  };

  const buildPacking=()=>{
    const sizing=canvasSizing();
    const {gapX:GAP_X,gapY:GAP_Y,height:H,width:W,perRow:PER_ROW}=sizing;
    const rows=Math.max(1,Math.ceil(originals.length/PER_ROW));
    const fullRowW=PER_ROW*W+(PER_ROW-1)*GAP_X;
    const contentH=rows*H+(rows-1)*GAP_Y;
    const positions=new Map();

    originals.forEach((tile,index)=>{
      const row=Math.floor(index/PER_ROW);
      const slot=index%PER_ROW;
      tile.dataset.orientation='five-four';
      tile.classList.remove('landscape','portrait');
      tile.classList.add('five-four');
      positions.set(tile,{x:slot*(W+GAP_X)+W/2,y:row*(H+GAP_Y)+H/2,width:W,height:H});
    });

    return {positions,fullRowW,contentH,periodW:fullRowW+GAP_X,periodH:contentH+GAP_Y,gapX:GAP_X,gapY:GAP_Y,height:H,width:W,perRow:PER_ROW};
  };

  let packing=buildPacking();
  const clones=[];
  let selectedEl=null;
  let expandedSourceEl=null;
  let lastTouchTapAt=0;
  let lastTouchTapSource=null;
  let centerTween=null;

  function showMeta(tile){
    if(!meta||!tile||selectedEl)return;
    metaCode.textContent=tile.dataset.code||'';
    metaTitle.textContent=tile.dataset.title||'';
    metaDuration.textContent=tile.dataset.duration||'';
    meta.classList.add('is-on');
  }
  function hideMeta(){meta?.classList.remove('is-on');}

  const cloneRecordFor=el=>clones.find(item=>item.el===el)||null;
  const sourceForElement=el=>cloneRecordFor(el)?.source||el;
  const resetTouchTap=()=>{lastTouchTapAt=0;lastTouchTapSource=null;};

  const clearSelection=()=>{
    if(selectedEl)selectedEl.classList.remove('is-selected');
    selectedEl=null;
    centerTween=null;
    resetTouchTap();
  };

  const easeOutCubic=t=>1-Math.pow(1-t,3);

  const centerTile=el=>{
    const record=cloneRecordFor(el);
    if(!record)return;
    const p=packing.positions.get(record.source);
    if(!p)return;

    const currentX=p.x+record.tx*packing.periodW+offsetX;
    const currentY=p.y+record.ty*packing.periodH+offsetY;
    const dx=innerWidth*.5-currentX;
    const dy=innerHeight*.5-currentY;

    velX=0;
    velY=0;
    centerTween={
      fromX:offsetX,
      fromY:offsetY,
      toX:offsetX+dx,
      toY:offsetY+dy,
      started:performance.now(),
      duration:innerWidth<=820?340:420
    };
  };

  const selectTile=el=>{
    if(!el)return;
    if(selectedEl&&selectedEl!==el)selectedEl.classList.remove('is-selected');
    selectedEl=el;
    selectedEl.classList.add('is-selected');
    hideMeta();
    centerTile(el);
  };

  const registerTouchTap=(el,event)=>{
    if(!el||!event||!['touch','pen'].includes(event.pointerType))return false;
    const source=sourceForElement(el);
    const now=performance.now();
    const isDouble=lastTouchTapSource===source&&(now-lastTouchTapAt)<=300;
    lastTouchTapSource=source;
    lastTouchTapAt=now;
    if(isDouble){resetTouchTap();openExpanded(el);return true;}
    return false;
  };

  const expandedImage=()=>expandedFrame?.querySelector('.film-expanded-image')||null;

  const openExpanded=el=>{
    if(!expanded||!expandedVideo||!el)return;
    const source=sourceForElement(el);
    const kind=source.dataset.kind||'video';
    expandedSourceEl=el;
    expandedTitle.textContent=source.dataset.title||'';
    expanded.classList.add('is-open');
    expanded.setAttribute('aria-hidden','false');

    if(kind==='image'){
      expandedVideo.pause();
      expandedVideo.removeAttribute('src');
      expandedVideo.load();
      expandedVideo.hidden=true;
      let image=expandedImage();
      if(!image&&expandedFrame){
        image=document.createElement('img');
        image.className='film-expanded-image';
        expandedFrame.insertBefore(image,expandedTitle||null);
      }
      if(image){
        image.hidden=false;
        image.src=source.dataset.image||'';
        image.alt=source.dataset.title||'Film image';
      }
      return;
    }

    const image=expandedImage();
    if(image){image.hidden=true;image.removeAttribute('src');}
    expandedVideo.hidden=false;
    const preview=el.querySelector('.film-zone-preview');
    const time=preview?.currentTime||0;
    expandedVideo.src=source.dataset.video||'../media/jc-hero.mp4';
    const applyState=()=>{
      try{expandedVideo.currentTime=time;}catch(_){}
      expandedVideo.removeEventListener('loadedmetadata',applyState);
    };
    if(expandedVideo.readyState>=1)applyState();
    else expandedVideo.addEventListener('loadedmetadata',applyState);
  };

  const closeExpanded=()=>{
    if(!expanded||!expandedVideo)return;
    expandedVideo.pause();
    expanded.classList.remove('is-open');
    expanded.setAttribute('aria-hidden','true');
    expandedVideo.removeAttribute('src');
    expandedVideo.load();
    expandedVideo.hidden=false;
    const image=expandedImage();
    if(image){image.hidden=true;image.removeAttribute('src');}
    expandedSourceEl=null;
    resetTouchTap();
  };

  const bindCloneHover=(el,source)=>{
    el.addEventListener('mouseenter',()=>showMeta(source));
    el.addEventListener('mouseleave',hideMeta);
  };

  const rebuildClones=()=>{
    closeExpanded();
    clearSelection();
    [...world.querySelectorAll('.film-tile[aria-hidden="true"]')].forEach(el=>el.remove());
    clones.length=0;
    for(let ty=-2;ty<=2;ty++){
      for(let tx=-2;tx<=2;tx++){
        originals.forEach(source=>{
          const el=(tx===0&&ty===0)?source:source.cloneNode(true);
          if(el!==source){
            el.removeAttribute('tabindex');
            el.setAttribute('aria-hidden','true');
            world.appendChild(el);
            bindCloneHover(el,source);
          }
          clones.push({el,source,tx,ty});
        });
      }
    }
  };

  const centerOffsets=()=>({x:innerWidth*.5-packing.fullRowW*.5,y:innerHeight*.5-packing.contentH*.5});
  let start=centerOffsets();
  let offsetX=start.x,offsetY=start.y,velX=0,velY=0;
  let dragging=false,moved=false,pointerId=null,lastX=0,lastY=0,lastT=0,pressTile=null,pressPointerType='mouse';
  const DRAG_GAIN=.42,THROW_GAIN=.68,FRICTION=.94,WHEEL_GAIN=.22,STOP_SPEED=.012;

  const wrapOffset=(value,size)=>{
    while(value>size)value-=size;
    while(value<-size)value+=size;
    return value;
  };

  const layout=()=>{
    const {positions,periodW,periodH}=packing;
    clones.forEach(({el,source,tx,ty})=>{
      const p=positions.get(source);
      if(!p)return;
      el.style.width=`${p.width}px`;
      el.style.height=`${p.height}px`;
      const x=p.x+tx*periodW+offsetX;
      const y=p.y+ty*periodH+offsetY;
      el.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      el.style.zIndex=el===selectedEl?'35':'1';
    });
  };

  const tick=time=>{
    if(!dragging&&!expanded?.classList.contains('is-open')){
      if(centerTween){
        const progress=Math.min(1,(time-centerTween.started)/centerTween.duration);
        const eased=easeOutCubic(progress);
        offsetX=centerTween.fromX+(centerTween.toX-centerTween.fromX)*eased;
        offsetY=centerTween.fromY+(centerTween.toY-centerTween.fromY)*eased;
        if(progress>=1)centerTween=null;
      }else if(selectedEl){
        velX=0;
        velY=0;
      }else{
        offsetX+=velX;
        offsetY+=velY;
        velX*=FRICTION;
        velY*=FRICTION;
        if(Math.abs(velX)<STOP_SPEED)velX=0;
        if(Math.abs(velY)<STOP_SPEED)velY=0;
        offsetX=wrapOffset(offsetX,packing.periodW);
        offsetY=wrapOffset(offsetY,packing.periodH);
      }
    }
    layout();
    requestAnimationFrame(tick);
  };

  originals.forEach(tile=>{
    tile.addEventListener('mouseenter',()=>showMeta(tile));
    tile.addEventListener('mouseleave',hideMeta);
    tile.addEventListener('focus',()=>showMeta(tile));
    tile.addEventListener('blur',hideMeta);
    tile.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        selectTile(tile);
      }
    });
  });

  rebuildClones();

  viewport.addEventListener('pointerdown',e=>{
    if(expanded?.classList.contains('is-open'))return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    dragging=true;
    moved=false;
    pointerId=e.pointerId;
    pressPointerType=e.pointerType;
    lastX=e.clientX;
    lastY=e.clientY;
    lastT=e.timeStamp;
    velX=0;
    velY=0;
    centerTween=null;
    pressTile=e.target.closest?.('.film-tile')||null;
    viewport.classList.add('is-dragging');
    viewport.setPointerCapture?.(pointerId);
  });

  viewport.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const rawDx=e.clientX-lastX;
    const rawDy=e.clientY-lastY;
    const dt=Math.max(1,e.timeStamp-lastT);
    if(Math.hypot(rawDx,rawDy)>2){
      if(!moved&&selectedEl)clearSelection();
      moved=true;
    }
    const dx=rawDx*DRAG_GAIN;
    const dy=rawDy*DRAG_GAIN;
    offsetX+=dx;
    offsetY+=dy;
    velX=velX*.58+(dx/dt*16)*.42;
    velY=velY*.58+(dy/dt*16)*.42;
    lastX=e.clientX;
    lastY=e.clientY;
    lastT=e.timeStamp;
    if(moved)page?.classList.add('has-moved');
    e.preventDefault();
  },{passive:false});

  const endPointer=e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    dragging=false;
    viewport.classList.remove('is-dragging');
    try{viewport.releasePointerCapture?.(pointerId)}catch(_){}

    if(moved){
      velX*=THROW_GAIN;
      velY*=THROW_GAIN;
      resetTouchTap();
    }else if(pressTile){
      if(['touch','pen'].includes(pressPointerType)&&selectedEl===pressTile){
        if(!registerTouchTap(pressTile,e))selectTile(pressTile);
      }else{
        selectTile(pressTile);
        if(['touch','pen'].includes(pressPointerType)){
          lastTouchTapSource=sourceForElement(pressTile);
          lastTouchTapAt=performance.now();
        }
      }
    }else{
      clearSelection();
    }

    pointerId=null;
    pressTile=null;
    pressPointerType='mouse';
  };

  viewport.addEventListener('pointerup',endPointer);
  viewport.addEventListener('pointercancel',()=>{
    dragging=false;
    pointerId=null;
    pressTile=null;
    pressPointerType='mouse';
    velX=0;
    velY=0;
    centerTween=null;
    resetTouchTap();
    viewport.classList.remove('is-dragging');
  });

  viewport.addEventListener('dblclick',e=>{
    const tile=e.target.closest?.('.film-tile');
    if(!tile)return;
    e.preventDefault();
    e.stopPropagation();
    openExpanded(tile);
  });

  viewport.addEventListener('wheel',e=>{
    if(expanded?.classList.contains('is-open'))return;
    if(selectedEl)clearSelection();
    centerTween=null;
    const dx=-(e.deltaX||e.deltaY*.45)*WHEEL_GAIN;
    const dy=-e.deltaY*WHEEL_GAIN;
    offsetX+=dx;
    offsetY+=dy;
    velX=velX*.45+dx*.09;
    velY=velY*.45+dy*.09;
    page?.classList.add('has-moved');
    e.preventDefault();
  },{passive:false});

  expandedClose?.addEventListener('click',closeExpanded);
  expanded?.addEventListener('click',e=>{if(e.target===expanded)closeExpanded();});
  addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(expanded?.classList.contains('is-open'))closeExpanded();
    else clearSelection();
  });

  addEventListener('resize',()=>{
    if(expanded?.classList.contains('is-open'))return;
    packing=buildPacking();
    rebuildClones();
    start=centerOffsets();
    offsetX=start.x;
    offsetY=start.y;
    velX=0;
    velY=0;
    centerTween=null;
    layout();
  });

  layout();
  requestAnimationFrame(tick);
})();