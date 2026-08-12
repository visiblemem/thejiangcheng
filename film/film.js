(()=>{
  const stage=document.querySelector('.film-stage');
  const canvas=document.querySelector('.film-canvas');
  if(!stage||!canvas)return;

  const cards=[...canvas.querySelectorAll('.film-card')];
  const filterButtons=[...document.querySelectorAll('.filter-tag')];
  const hint=document.querySelector('.film-hint');
  const progress=document.querySelector('.film-progress');
  const progressThumb=document.querySelector('.film-progress-thumb');

  const HINTS={
    all:'CLICK A FILM TO PLAY',
    scroll:'DRAG UP / DOWN',
    strip:'DRAG LEFT / RIGHT',
    focus:'CLICK AGAIN OR PRESS ESC TO CLOSE'
  };

  fetch('./film-sprite.txt')
    .then(response=>response.ok?response.text():Promise.reject())
    .then(data=>document.documentElement.style.setProperty('--film-sprite',`url("data:image/webp;base64,${data.replace(/\s/g,'')}")`))
    .catch(()=>{});

  cards.forEach(card=>{
    const i=(Number(card.dataset.index||1)-1+16)%16;
    const col=i%4;
    const row=Math.floor(i/4);
    card.style.setProperty('--sprite-pos',`${(col*33.333).toFixed(3)}% ${(row*33.333).toFixed(3)}%`);
  });

  let mode='all';
  let panY=0;
  let maxCanvasPan=0;
  let stripPan=0;
  let maxStripPan=0;
  let activeCard=null;
  let raf=0;

  const clamp=(value,min,max)=>value<min?min:value>max?max:value;

  const place=(card,x,y,scale,rotate,opacity,blur)=>{
    card.style.setProperty('--screen-x',`${x}px`);
    card.style.setProperty('--screen-y',`${y}px`);
    card.style.setProperty('--card-scale',String(scale));
    card.style.setProperty('--card-rotate',`${rotate}deg`);
    card.style.setProperty('--card-opacity',String(opacity));
    card.style.setProperty('--card-blur',`${blur}px`);
    card.style.setProperty('--inv','1');
  };

  // Labels live inside the card, so a zoomed card would blow its type up with it.
  // Counter-scale them back to a fixed 1.35x of their resting size.
  const placeFocused=(card,x,y,scale)=>{
    place(card,x,y,scale,0,1,0);
    card.style.setProperty('--inv',String(1.35/scale));
  };

  const focusScale=(card,rect)=>{
    const w=card.offsetWidth||1;
    const h=card.offsetHeight||1;
    return Math.min(rect.width*.84/w,rect.height*.92/h,3.2);
  };

  const aspectOf=card=>(card.offsetWidth||1)/(card.offsetHeight||1);

  // Portrait and landscape cards share one row height, so every top and bottom
  // edge lands on the same line. Column widths are shared across rows too, so a
  // short final row still lines up with the rows above instead of floating.
  const canvasGrid=rect=>{
    const mobile=innerWidth<=820;
    const gap=mobile?14:20;
    const padX=mobile?14:24;
    // Kept even so the daily/interview alternation keeps each column one shape.
    const perRow=mobile?2:rect.width>=1080?6:4;

    const colAspect=[];
    cards.forEach((card,index)=>{
      const seat=index%perRow;
      colAspect[seat]=Math.max(colAspect[seat]||0,aspectOf(card));
    });
    const spread=colAspect.reduce((a,b)=>a+b,0);

    const rows=Math.ceil(cards.length/perRow);
    const visibleRows=Math.min(mobile?3:rows,rows);
    const rowH=Math.min(
      (rect.height-(visibleRows-1)*gap)/visibleRows,
      (rect.width-2*padX-(perRow-1)*gap)/spread
    );

    const colW=colAspect.map(aspect=>rowH*aspect);
    const fullW=colW.reduce((a,b)=>a+b,0)+(perRow-1)*gap;
    const colX=[];
    let cursor=(rect.width-fullW)/2;
    colW.forEach(width=>{colX.push(cursor+width/2);cursor+=width+gap;});

    const contentH=rows*rowH+(rows-1)*gap;
    return {perRow,rows,gap,rowH,colX,contentH};
  };

  const layoutCanvas=rect=>{
    const g=canvasGrid(rect);
    maxCanvasPan=Math.max(0,g.contentH-rect.height);
    panY=clamp(panY,0,maxCanvasPan);
    const top=maxCanvasPan>0?-panY:(rect.height-g.contentH)/2;

    cards.forEach((card,index)=>{
      card.dataset.hidden='false';
      const row=Math.floor(index/g.perRow);
      const x=g.colX[index%g.perRow];
      const y=top+row*(g.rowH+g.gap)+g.rowH/2;
      const scale=g.rowH/(card.offsetHeight||1);
      if(activeCard===card)placeFocused(card,rect.width/2,rect.height*.5,focusScale(card,rect));
      else if(activeCard)place(card,x,y,scale*.96,0,.08,.6);
      else place(card,x,y,scale,0,1,0);
    });
  };

  const layoutStrip=(rect,mobile)=>{
    const visible=cards.filter(card=>card.dataset.filmCategory===mode);
    cards.forEach(card=>{
      if(!visible.includes(card))card.dataset.hidden='true';
    });
    if(!visible.length){maxStripPan=0;return;}

    const baseW=visible[0].offsetWidth||1;
    const baseH=visible[0].offsetHeight||1;
    const gap=mobile?12:18;
    // Phones have height to spare and little width, so let a strip card grow
    // until it either fills the stage vertically or eats most of the screen.
    const byHeight=rect.height*.94/(baseH*1.3);
    const byWidth=mobile?rect.width*.82/baseW:Infinity;
    const fit=Math.min(mobile?1.9:1.16,byHeight,byWidth);
    const cardW=baseW*fit;
    const cardH=baseH*fit;
    const total=visible.length*cardW+(visible.length-1)*gap;
    const pad=mobile?18:44;
    const span=total+pad*2;

    maxStripPan=Math.max(0,span-rect.width);
    stripPan=clamp(stripPan,0,maxStripPan);

    const startX=span<=rect.width?(rect.width-total)/2:pad-stripPan;
    const centerY=(rect.height-cardH*1.3)*.42+cardH/2;

    visible.forEach((card,index)=>{
      card.dataset.hidden='false';
      if(activeCard===card){
        placeFocused(card,rect.width/2,rect.height*.46,focusScale(card,rect));
        return;
      }
      const x=startX+index*(cardW+gap)+cardW/2;
      if(activeCard)place(card,x,centerY,fit*.94,0,.08,.6);
      else place(card,x,centerY,fit,0,1,0);
    });

    if(progress&&progressThumb){
      const track=progress.offsetWidth||1;
      const thumbW=progressThumb.offsetWidth||64;
      const travel=maxStripPan>0?stripPan/maxStripPan:0;
      progressThumb.style.transform=`translateX(${travel*Math.max(0,track-thumbW)}px)`;
    }
  };

  const layout=()=>{
    const rect=stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const mobile=innerWidth<=820;
    if(mode==='all')layoutCanvas(rect);
    else layoutStrip(rect,mobile);
  };

  const queueLayout=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(layout);
  };

  const updateChrome=()=>{
    if(hint)hint.textContent=activeCard?HINTS.focus
      :mode!=='all'?HINTS.strip
      :maxCanvasPan>0?HINTS.scroll:HINTS.all;
    if(progress)progress.classList.toggle('is-on',mode!=='all'&&!activeCard&&maxStripPan>0);
  };

  // ---- playback ----
  const stopCard=card=>{
    const video=card.querySelector('.film-video');
    if(video){video.pause();video.currentTime=0;}
    card.classList.remove('is-playing');
  };

  const playCard=card=>{
    const video=card.querySelector('.film-video');
    if(!video)return;
    card.classList.add('is-playing');
    video.play().catch(()=>card.classList.remove('is-playing'));
  };

  const setActive=card=>{
    if(activeCard&&activeCard!==card)stopCard(activeCard);
    if(!card&&activeCard)stopCard(activeCard);
    activeCard=card||null;
    cards.forEach(item=>item.dataset.active=item===activeCard?'true':'false');
    stage.classList.toggle('has-focus',Boolean(activeCard));
    if(activeCard)playCard(activeCard);
    updateChrome();
    queueLayout();
  };

  cards.forEach(card=>{
    card.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        setActive(activeCard===card?null:card);
      }
    });
    const video=card.querySelector('.film-video');
    video?.addEventListener('ended',()=>{
      if(activeCard===card)setActive(null);
    });
    // Playback can fail after play() resolves (unsupported codec, network drop);
    // drop back to the still frame instead of holding a blank card.
    video?.addEventListener('error',()=>card.classList.remove('is-playing'));
  });

  // ---- filters ----
  const setMode=next=>{
    if(mode===next)return;
    mode=next;
    stage.classList.toggle('is-strip',mode!=='all');
    stripPan=0;
    if(activeCard)setActive(null);
    filterButtons.forEach(btn=>{
      const on=btn.dataset.category===mode;
      btn.classList.toggle('is-active',on);
      btn.setAttribute('aria-selected',String(on));
    });
    layout();
    updateChrome();
  };

  filterButtons.forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.category)));

  // ---- drag + inertia ----
  let pointerId=null;
  let isDown=false;
  let didDrag=false;
  let startX=0;
  let startY=0;
  let startPanY=0;
  let startStrip=0;
  let lastX=0;
  let lastY=0;
  let lastTime=0;
  let velX=0;
  let velY=0;
  let glide=0;
  let pressCard=null;

  const stopGlide=()=>{cancelAnimationFrame(glide);glide=0;};

  const runGlide=()=>{
    velX*=.93;
    velY*=.93;
    if(Math.abs(velX)<.12&&Math.abs(velY)<.12){glide=0;return;}
    if(mode==='all'){
      panY=clamp(panY-velY,0,maxCanvasPan);
      if(panY===0||panY===maxCanvasPan)velY=0;
    }else{
      stripPan=clamp(stripPan-velX,0,maxStripPan);
      if(stripPan===0||stripPan===maxStripPan)velX=0;
    }
    layout();
    glide=requestAnimationFrame(runGlide);
  };

  stage.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    stopGlide();
    pointerId=event.pointerId;
    isDown=true;
    didDrag=false;
    startX=lastX=event.clientX;
    startY=lastY=event.clientY;
    lastTime=event.timeStamp;
    velX=velY=0;
    startPanY=panY;
    startStrip=stripPan;
    pressCard=event.target.closest?.('.film-card')||null;
    stage.classList.add('dragging');
    stage.setPointerCapture?.(pointerId);
  });

  stage.addEventListener('pointermove',event=>{
    if(!isDown||event.pointerId!==pointerId)return;
    const dx=event.clientX-startX;
    const dy=event.clientY-startY;
    if(!didDrag&&Math.hypot(dx,dy)>5)didDrag=true;
    if(!didDrag)return;
    if(activeCard)setActive(null);

    const elapsed=Math.max(1,event.timeStamp-lastTime);
    velX=(event.clientX-lastX)/elapsed*16;
    velY=(event.clientY-lastY)/elapsed*16;
    lastX=event.clientX;
    lastY=event.clientY;
    lastTime=event.timeStamp;

    if(mode==='all'){
      panY=clamp(startPanY-dy,0,maxCanvasPan);
    }else{
      stripPan=clamp(startStrip-dx,0,maxStripPan);
    }
    layout();
    event.preventDefault();
  },{passive:false});

  const finishPointer=event=>{
    if(!isDown||event.pointerId!==pointerId)return;
    isDown=false;
    stage.classList.remove('dragging');
    try{stage.releasePointerCapture?.(pointerId)}catch(_){ }

    if(didDrag){
      if(Math.abs(velX)>.4||Math.abs(velY)>.4){stopGlide();glide=requestAnimationFrame(runGlide);}
    }else if(pressCard){
      setActive(activeCard===pressCard?null:pressCard);
    }else if(activeCard){
      setActive(null);
    }

    pointerId=null;
    pressCard=null;
  };

  stage.addEventListener('pointerup',finishPointer);
  stage.addEventListener('pointercancel',()=>{
    isDown=false;
    pointerId=null;
    pressCard=null;
    stage.classList.remove('dragging');
  });

  stage.addEventListener('wheel',event=>{
    stopGlide();
    if(activeCard)setActive(null);
    if(mode==='all'){
      panY=clamp(panY+event.deltaY,0,maxCanvasPan);
    }else{
      stripPan=clamp(stripPan+(event.deltaX||event.deltaY),0,maxStripPan);
    }
    layout();
    event.preventDefault();
  },{passive:false});

  addEventListener('keydown',event=>{
    if(event.key==='Escape'&&activeCard)setActive(null);
  });
  addEventListener('resize',()=>{stopGlide();queueLayout();});

  layout();
  updateChrome();
})();
