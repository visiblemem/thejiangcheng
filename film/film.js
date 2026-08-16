(()=>{
  const viewport=document.querySelector('.film-viewport');
  const world=document.querySelector('.film-world');
  const page=document.querySelector('.film-canvas-page');
  const meta=document.querySelector('.film-hover-meta');
  const metaCode=meta?.querySelector('.hover-code');
  const metaTitle=meta?.querySelector('.hover-title');
  const metaDuration=meta?.querySelector('.hover-duration');
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

    return {
      positions,
      fullRowW,
      contentH,
      periodW:fullRowW+GAP_X,
      periodH:contentH+GAP_Y,
      gapX:GAP_X,
      gapY:GAP_Y,
      height:H,
      width:W,
      perRow:PER_ROW
    };
  };

  let packing=buildPacking();
  const clones=[];
  let selectedEl=null;
  let centerTween=null;
  let floatState=null;

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

  const removeFloatPlayer=()=>{
    const state=floatState;
    floatState=null;
    document.documentElement.classList.remove('film-float-preparing','film-float-open');

    if(!state)return;
    state.video.pause();
    state.video.removeAttribute('src');
    state.video.load();
    state.overlay.remove();
  };

  const clearSelection=()=>{
    removeFloatPlayer();
    if(selectedEl)selectedEl.classList.remove('is-selected');
    selectedEl=null;
    centerTween=null;
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

  const prepareFloatPlayer=el=>{
    const source=sourceForElement(el);
    if((source.dataset.kind||'video')!=='video')return;

    const src=source.dataset.video||'';
    if(!src)return;

    removeFloatPlayer();

    const rect=el.getBoundingClientRect();
    const overlay=document.createElement('div');
    overlay.className='film-float-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label',`播放 ${source.dataset.title||'Film'}`);

    const frame=document.createElement('div');
    frame.className='film-float-frame';
    frame.style.width=`${Math.max(1,rect.width)}px`;
    frame.style.height=`${Math.max(1,rect.height)}px`;

    const video=document.createElement('video');
    video.className='film-float-video';
    video.controls=true;
    video.playsInline=true;
    video.preload='auto';
    video.src=src;
    if(source.dataset.poster)video.poster=source.dataset.poster;

    const preview=el.querySelector('.film-zone-preview');
    const startTime=preview&&Number.isFinite(preview.currentTime)?preview.currentTime:0;

    frame.appendChild(video);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);

    floatState={overlay,frame,video,tile:el,open:false};
    document.documentElement.classList.add('film-float-preparing');

    overlay.addEventListener('click',event=>{
      if(event.target!==overlay)return;
      event.preventDefault();
      clearSelection();
    });

    frame.addEventListener('click',event=>event.stopPropagation());

    video.addEventListener('loadedmetadata',()=>{
      if(startTime>0){
        try{video.currentTime=startTime;}catch(_){}
      }
    },{once:true});

    const attemptPlay=()=>{
      const promise=video.play();
      promise?.catch?.(()=>{
        video.muted=true;
        video.play().catch(()=>{});
      });
    };
    attemptPlay();
  };

  const showFloatPlayer=el=>{
    if(!floatState||floatState.tile!==el)return;

    const rect=el.getBoundingClientRect();
    floatState.frame.style.width=`${Math.max(1,rect.width)}px`;
    floatState.frame.style.height=`${Math.max(1,rect.height)}px`;
    floatState.open=true;

    document.documentElement.classList.remove('film-float-preparing');
    document.documentElement.classList.add('film-float-open');
    requestAnimationFrame(()=>floatState?.overlay.classList.add('is-open'));
  };

  const selectTile=el=>{
    if(!el)return;
    if(selectedEl!==el)clearSelection();

    selectedEl=el;
    selectedEl.classList.add('is-selected');
    hideMeta();

    centerTile(el);
    prepareFloatPlayer(el);
  };

  const bindCloneHover=(el,source)=>{
    el.addEventListener('mouseenter',()=>showMeta(source));
    el.addEventListener('mouseleave',hideMeta);
  };

  const rebuildClones=()=>{
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

  const centerOffsets=()=>({
    x:innerWidth*.5-packing.fullRowW*.5,
    y:innerHeight*.5-packing.contentH*.5
  });

  let start=centerOffsets();
  let offsetX=start.x;
  let offsetY=start.y;
  let velX=0;
  let velY=0;
  let dragging=false;
  let moved=false;
  let pointerId=null;
  let lastX=0;
  let lastY=0;
  let lastT=0;
  let pressTile=null;

  const DRAG_GAIN=.42;
  const THROW_GAIN=.68;
  const FRICTION=.94;
  const WHEEL_GAIN=.22;
  const STOP_SPEED=.012;

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
    if(!dragging){
      if(centerTween){
        const progress=Math.min(1,(time-centerTween.started)/centerTween.duration);
        const eased=easeOutCubic(progress);
        offsetX=centerTween.fromX+(centerTween.toX-centerTween.fromX)*eased;
        offsetY=centerTween.fromY+(centerTween.toY-centerTween.fromY)*eased;

        if(progress>=1){
          centerTween=null;

          if(selectedEl){
            const source=sourceForElement(selectedEl);
            if((source.dataset.kind||'video')==='video')showFloatPlayer(selectedEl);
            else{
              selectedEl.classList.remove('is-selected');
              selectedEl=null;
            }
          }
        }
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
    tile.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        selectTile(tile);
      }
    });
  });

  rebuildClones();

  viewport.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;

    dragging=true;
    moved=false;
    pointerId=event.pointerId;
    lastX=event.clientX;
    lastY=event.clientY;
    lastT=event.timeStamp;
    velX=0;
    velY=0;
    centerTween=null;
    pressTile=event.target.closest?.('.film-tile')||null;

    viewport.classList.add('is-dragging');
    viewport.setPointerCapture?.(pointerId);
  });

  viewport.addEventListener('pointermove',event=>{
    if(!dragging||event.pointerId!==pointerId)return;

    const rawDx=event.clientX-lastX;
    const rawDy=event.clientY-lastY;
    const dt=Math.max(1,event.timeStamp-lastT);

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

    lastX=event.clientX;
    lastY=event.clientY;
    lastT=event.timeStamp;

    if(moved)page?.classList.add('has-moved');
    event.preventDefault();
  },{passive:false});

  const endPointer=event=>{
    if(!dragging||event.pointerId!==pointerId)return;

    dragging=false;
    viewport.classList.remove('is-dragging');
    try{viewport.releasePointerCapture?.(pointerId)}catch(_){}

    if(moved){
      velX*=THROW_GAIN;
      velY*=THROW_GAIN;
    }else if(pressTile){
      selectTile(pressTile);
    }else{
      clearSelection();
    }

    pointerId=null;
    pressTile=null;
  };

  viewport.addEventListener('pointerup',endPointer);
  viewport.addEventListener('pointercancel',()=>{
    dragging=false;
    pointerId=null;
    pressTile=null;
    velX=0;
    velY=0;
    centerTween=null;
    clearSelection();
    viewport.classList.remove('is-dragging');
  });

  viewport.addEventListener('wheel',event=>{
    if(selectedEl)clearSelection();
    centerTween=null;

    const dx=-(event.deltaX||event.deltaY*.45)*WHEEL_GAIN;
    const dy=-event.deltaY*WHEEL_GAIN;
    offsetX+=dx;
    offsetY+=dy;
    velX=velX*.45+dx*.09;
    velY=velY*.45+dy*.09;

    page?.classList.add('has-moved');
    event.preventDefault();
  },{passive:false});

  addEventListener('keydown',event=>{
    if(event.key==='Escape'&&selectedEl){
      event.preventDefault();
      clearSelection();
    }
  });

  addEventListener('resize',()=>{
    clearSelection();
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
