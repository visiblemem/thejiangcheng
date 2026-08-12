(()=>{
  fetch('./film-sprite.txt')
    .then(response=>response.ok?response.text():Promise.reject())
    .then(data=>document.documentElement.style.setProperty('--film-sprite',`url("data:image/webp;base64,${data.replace(/\s/g,'')}")`))
    .catch(()=>{});

  const gallery=document.querySelector('.film-gallery');
  const canvas=document.querySelector('.gallery-canvas');
  const hint=document.querySelector('.film-hint');
  if(!gallery||!canvas)return;

  const films=[...canvas.querySelectorAll('.gallery-film')];
  const desktopPositions=[
    [.08,.13,.94],[.27,.12,1.02],[.46,.16,.92],[.66,.11,1.06],
    [.87,.17,.96],[.15,.42,1.04],[.36,.37,.91],[.56,.43,1.05],
    [.77,.39,.97],[.96,.44,.92],[.06,.71,1.02],[.25,.67,.94],
    [.46,.74,1.05],[.66,.68,.90],[.84,.76,1.03],[.98,.70,.95]
  ];
  const mobilePositions=[
    [.10,.11,.96],[.38,.09,.90],[.68,.13,1.02],[.93,.10,.92],
    [.15,.36,.94],[.43,.33,1.04],[.72,.38,.91],[.97,.34,1.02],
    [.09,.60,1.02],[.37,.58,.92],[.66,.63,.98],[.94,.57,.90],
    [.15,.84,.93],[.43,.82,1.03],[.72,.87,.91],[.97,.81,1.00]
  ];

  let panX=0;
  let panY=0;
  let activeFilm=null;
  let pointerId=null;
  let isDown=false;
  let didDrag=false;
  let startX=0;
  let startY=0;
  let startPanX=0;
  let startPanY=0;
  let pressFilm=null;
  let raf=0;

  const wrap=(value,size)=>{
    let wrapped=(value+size/2)%size;
    if(wrapped<0)wrapped+=size;
    return wrapped-size/2;
  };

  const queueLayout=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(layout);
  };

  const layout=()=>{
    const rect=gallery.getBoundingClientRect();
    const mobile=innerWidth<=820;
    const positions=mobile?mobilePositions:desktopPositions;
    const tileW=rect.width;
    const tileH=rect.height;

    films.forEach((film,index)=>{
      const [px,py,baseScale]=positions[index%positions.length];
      let x=rect.width/2+wrap((px-.5)*tileW+panX,tileW);
      let y=rect.height/2+wrap((py-.5)*tileH+panY,tileH);
      let scale=baseScale;
      let opacity=.30+(index%5)*.075;
      let blur=0;

      if(activeFilm){
        if(film===activeFilm){
          x=rect.width/2;
          y=rect.height*(mobile?.46:.48);
          scale=mobile
            ?(film.classList.contains('interview')?1.28:1.72)
            :(film.classList.contains('interview')?1.52:1.62);
          opacity=1;
          blur=0;
        }else{
          opacity=.10;
          blur=.55;
          scale*=.94;
        }
      }

      film.style.setProperty('--screen-x',`${x}px`);
      film.style.setProperty('--screen-y',`${y}px`);
      film.style.setProperty('--film-scale',String(scale));
      film.style.setProperty('--film-opacity',String(opacity));
      film.style.setProperty('--film-blur',`${blur}px`);
    });
  };

  const setActive=film=>{
    activeFilm=film||null;
    films.forEach(item=>item.dataset.active=item===activeFilm?'true':'false');
    gallery.classList.toggle('has-focus',Boolean(activeFilm));
    if(hint)hint.textContent=activeFilm?'CLICK AGAIN OR PRESS ESC TO CLOSE':'DRAG TO EXPLORE · CLICK TO FOCUS';
    queueLayout();
  };

  films.forEach(film=>{
    film.addEventListener('mouseenter',()=>{
      if(!activeFilm)film.classList.add('is-hovered');
    });
    film.addEventListener('mouseleave',()=>film.classList.remove('is-hovered'));
    film.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        setActive(activeFilm===film?null:film);
      }
    });
  });

  gallery.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    pointerId=event.pointerId;
    isDown=true;
    didDrag=false;
    startX=event.clientX;
    startY=event.clientY;
    startPanX=panX;
    startPanY=panY;
    pressFilm=event.target.closest?.('.gallery-film')||null;
    gallery.classList.add('dragging');
    gallery.setPointerCapture?.(pointerId);
  });

  gallery.addEventListener('pointermove',event=>{
    if(!isDown||event.pointerId!==pointerId)return;
    const dx=event.clientX-startX;
    const dy=event.clientY-startY;
    if(Math.hypot(dx,dy)>5)didDrag=true;
    if(!didDrag)return;

    if(activeFilm)setActive(null);
    panX=startPanX+dx;
    panY=startPanY+dy;
    queueLayout();
    event.preventDefault();
  },{passive:false});

  const finishPointer=event=>{
    if(!isDown||event.pointerId!==pointerId)return;
    isDown=false;
    gallery.classList.remove('dragging');
    try{gallery.releasePointerCapture?.(pointerId)}catch(_){ }

    if(!didDrag){
      const film=pressFilm;
      if(film)setActive(activeFilm===film?null:film);
      else if(activeFilm)setActive(null);
    }

    pointerId=null;
    pressFilm=null;
  };

  gallery.addEventListener('pointerup',finishPointer);
  gallery.addEventListener('pointercancel',()=>{
    isDown=false;
    pointerId=null;
    pressFilm=null;
    gallery.classList.remove('dragging');
  });

  gallery.addEventListener('wheel',event=>{
    if(activeFilm)setActive(null);
    panX-=event.deltaX||event.deltaY*.72;
    panY-=event.deltaY*.28;
    queueLayout();
    event.preventDefault();
  },{passive:false});

  addEventListener('keydown',event=>{
    if(event.key==='Escape'&&activeFilm)setActive(null);
  });
  addEventListener('resize',queueLayout);

  setActive(null);
})();
