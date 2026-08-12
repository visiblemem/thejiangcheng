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
    all:'DRAG TO EXPLORE · INFINITE CANVAS',
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

  // Per-card nudges off the grid, so the scatter reads as hand-placed rather
  // than tabular. Kept small enough that no card leaves its safe band.
  const JITTER_X=[.030,-.022,.018,-.034,.026,-.012,.036,-.028,.014,-.030,.022,-.016,.032,-.024,.020,-.018];
  const JITTER_Y=[-.026,.032,-.038,.020,.036,-.028,.022,-.034,.030,-.020,.038,-.032,.018,.034,-.024,.028];

  let mode='all';
  let panX=0;
  let panY=0;
  let stripPan=0;
  let maxStripPan=0;
  let activeCard=null;
  let raf=0;

  const clamp=(value,min,max)=>value<min?min:value>max?max:value;
  // Wrap into [lo, lo+size) rather than around zero, so a card that scrolls off
  // one edge reappears at the far edge already fully inside the stage.
  const wrapFrom=(value,size,lo)=>{
    let wrapped=(value-lo)%size;
    if(wrapped<0)wrapped+=size;
    return wrapped+lo;
  };

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

  // The scatter is derived from the stage rather than a fixed coordinate table:
  // a table cannot know how tall a card ends up, so cards near its extremes get
  // sliced by the stage edge on short viewports. Here the card scale falls out
  // of how many rows have to fit, which keeps every card whole at rest.
  const canvasGeometry=rect=>{
    const mobile=innerWidth<=820;
    const cols=mobile?2:rect.width>=1080?6:rect.width>=760?4:3;
    const rows=Math.ceil(cards.length/cols);
    // Phones cannot show 8 rows at a usable size, so they show 3 and pan for the rest.
    const visibleRows=mobile?Math.min(3,rows):rows;

    const tall=cards.find(card=>card.classList.contains('daily'));
    const wide=cards.find(card=>card.classList.contains('interview'));
    const tallH=(tall&&tall.offsetHeight)||1;
    const tallW=(tall&&tall.offsetWidth)||1;
    const wideW=(wide&&wide.offsetWidth)||1;

    // Portrait cards are the tall ones, so they set the height budget: the
    // largest height at which visibleRows still stack inside the stage.
    const byHeight=(1.15*rect.height-24)/(visibleRows+.15)/tallH;
    const byWidth=rect.width/(cols*(tallW+wideW)/2*1.08);
    const scale=clamp(Math.min(byHeight,byWidth),.34,1);

    const cardH=tallH*scale;
    const jitterY=12;
    const spacing=visibleRows>1?(rect.height-cardH-2*jitterY-8)/(visibleRows-1):0;
    // Derived from the tallest card, so the shorter landscape ones clear the
    // edges too. Columns are clamped per card instead, since sharing one inset
    // across both shapes squeezes a narrow row until its cards collide.
    const topY=cardH/2+jitterY+4;
    // The wrap period has to span every row centre, jitter included — clip a row
    // out of the window and it teleports to the opposite edge mid-frame.
    const lastCentre=topY+(rows-1)*spacing+jitterY;
    const tileH=Math.max(rect.height,lastCentre+spacing/2);

    // Rows per band, spread as evenly as the count allows (16 over 3 = 5/5/6)
    // so a short final row does not leave one side of the canvas empty.
    const rowOf=[];
    const seatOf=[];
    const seats=[];
    for(let row=0;row<rows;row++){
      const start=Math.floor(row*cards.length/rows);
      const end=Math.floor((row+1)*cards.length/rows);
      seats.push(end-start);
      for(let i=start;i<end;i++){rowOf[i]=row;seatOf[i]=i-start;}
    }

    return {rows,scale,spacing,topY,tileW:rect.width,tileH,jitterY,rowOf,seatOf,seats};
  };

  const layoutCanvas=rect=>{
    const g=canvasGeometry(rect);

    cards.forEach((card,index)=>{
      card.dataset.hidden='false';
      if(activeCard===card){
        placeFocused(card,rect.width/2,rect.height*.5,focusScale(card,rect));
        return;
      }
      const row=g.rowOf[index];
      const seat=g.seatOf[index];
      const stagger=(row%2?.16:-.1)+JITTER_X[index];
      const halfW=card.offsetWidth*g.scale/2;
      const colCentre=(seat+.5+stagger)/g.seats[row]*g.tileW;
      const baseX=clamp(colCentre,halfW+6,g.tileW-halfW-6);
      const baseY=g.topY+row*g.spacing+JITTER_Y[index]*g.jitterY*25;
      const x=wrapFrom(baseX+panX,g.tileW,0);
      const y=wrapFrom(baseY+panY,g.tileH,0);
      const tilt=((index*37)%7-3)*.42;
      if(activeCard)place(card,x,y,g.scale*.94,tilt,.08,.6);
      else place(card,x,y,g.scale,tilt,1,0);
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
    if(hint)hint.textContent=activeCard?HINTS.focus:mode==='all'?HINTS.all:HINTS.strip;
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
  let startPanX=0;
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
      panX+=velX;
      panY+=velY;
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
    startPanX=panX;
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
      panX=startPanX+dx;
      panY=startPanY+dy;
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
      panX-=event.deltaX||event.deltaY*.7;
      panY-=event.deltaY*.3;
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
