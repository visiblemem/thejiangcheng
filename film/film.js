(()=>{
  fetch('./film-sprite.txt')
    .then(r=>r.ok?r.text():Promise.reject())
    .then(data=>document.documentElement.style.setProperty('--film-sprite',`url("data:image/webp;base64,${data.replace(/\s/g,'')}")`))
    .catch(()=>{});

  const filmSpace=document.querySelector('.film-space');
  const filmFilters=[...document.querySelectorAll('[data-film-mode]')];
  const hint=document.querySelector('.film-hint');
  if(!filmSpace||!filmFilters.length)return;

  const originalNodes=[...filmSpace.querySelectorAll('.floating-film')];
  const clones=[0,1,2,3].map(sourceIndex=>{
    const clone=originalNodes[sourceIndex].cloneNode(true);
    clone.classList.add('film-clone');
    clone.dataset.clone='true';
    clone.setAttribute('aria-hidden','true');
    filmSpace.appendChild(clone);
    return clone;
  });
  const nodes=[...originalNodes,...clones];

  let panX=0,panY=0,railX=0,down=false,startX=0,startY=0,startPanX=0,startPanY=0,startRailX=0,pointerId=null,activeFilter='all',dragMode='canvas';

  const desktopPos=[
    [.115,.090,1.067],[.300,.142,.988],[.516,.156,1],[.710,.149,1.053],[.903,.143,1.056],
    [.119,.354,.982],[.313,.385,.956],[.508,.398,1.041],[.681,.412,.978],[.862,.415,1.071],
    [.075,.622,.967],[.274,.635,1.035],[.466,.639,1.044],[.663,.662,.994],[.886,.663,1.044],
    [.140,.880,1],[.309,.883,.978],[.483,.898,.971],[.664,.902,.856],[.825,.912,.988]
  ];

  const mobilePos=[
    [.10,.08,1],[.36,.10,1],[.64,.08,.96],[.90,.11,1],
    [.13,.29,.96],[.39,.31,1],[.67,.29,.96],[.93,.32,.94],
    [.08,.50,1],[.34,.52,.96],[.62,.50,1],[.88,.53,.94],
    [.13,.71,.96],[.39,.73,1],[.67,.71,.94],[.93,.74,.96],
    [.10,.92,1],[.36,.94,.96],[.64,.92,.92],[.90,.95,.96]
  ];

  const wrap=(v,size)=>{
    let r=(v+size/2)%size;
    if(r<0)r+=size;
    return r-size/2;
  };

  const layout=()=>{
    const rect=filmSpace.getBoundingClientRect();
    const mobile=innerWidth<=820;
    const pos=mobile?mobilePos:desktopPos;
    const tileW=rect.width;
    const tileH=rect.height;
    const selected=originalNodes.filter(node=>activeFilter!=='all'&&node.dataset.filmCategory===activeFilter);
    let selectedIndex=0,maxRail=1,selectedGap=0,selectedScale=1;

    if(activeFilter!=='all'&&selected.length){
      selectedScale=mobile?(activeFilter==='interview'?.90:1.10):(activeFilter==='interview'?.65:.95);
      const baseW=selected[0].offsetWidth;
      const cardW=baseW*selectedScale;
      selectedGap=cardW+(mobile?14:18);
      maxRail=Math.max(0,((selected.length-1)*selectedGap+cardW-rect.width)/2+20);
      railX=Math.max(-maxRail,Math.min(maxRail,railX));
      filmSpace.style.setProperty('--rail-progress',String(maxRail?(.5-railX/(maxRail*2)):.5));
    }

    nodes.forEach((node,index)=>{
      const [px,py,ps]=pos[index];
      let x=rect.width/2+wrap((px-.5)*tileW+panX,tileW);
      let y=rect.height/2+wrap((py-.5)*tileH+panY,tileH);
      let scale=(mobile?(node.classList.contains('interview')?.52:.58):1)*ps;
      let opacity=1;
      node.dataset.selected='false';

      if(activeFilter!=='all'){
        if(node.dataset.clone==='true'){
          scale=.01;
          opacity=0;
        }else if(node.dataset.filmCategory===activeFilter){
          const filmIndex=selectedIndex++;
          x=rect.width/2+(filmIndex-(selected.length-1)/2)*selectedGap+railX;
          y=rect.height*.32;
          scale=selectedScale;
          opacity=1;
          node.dataset.selected='true';
        }else{
          scale=.01;
          opacity=0;
        }
      }

      node.style.setProperty('--screen-x',`${x}px`);
      node.style.setProperty('--screen-y',`${y}px`);
      node.style.setProperty('--node-scale',scale);
      node.style.setProperty('--node-opacity',opacity);
      node.style.setProperty('--node-blur','0px');
    });
  };

  const applyFilter=filter=>{
    activeFilter=filter;
    filmSpace.dataset.filter=filter;
    railX=0;
    filmFilters.forEach(button=>button.classList.toggle('active',button.dataset.filmMode===filter));
    if(hint)hint.textContent=filter==='all'?'DRAG TO EXPLORE · INFINITE CANVAS':'DRAG LEFT / RIGHT';
    layout();
  };

  applyFilter('all');
  filmFilters.forEach(button=>button.addEventListener('click',()=>applyFilter(button.dataset.filmMode)));

  filmSpace.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    down=true;
    pointerId=event.pointerId;
    startX=event.clientX;
    startY=event.clientY;
    startPanX=panX;
    startPanY=panY;
    startRailX=railX;
    dragMode=activeFilter==='all'?'canvas':'rail';
    filmSpace.classList.add('panning');
    filmSpace.setPointerCapture?.(event.pointerId);
  });

  filmSpace.addEventListener('pointermove',event=>{
    if(!down||event.pointerId!==pointerId)return;
    const dx=event.clientX-startX;
    const dy=event.clientY-startY;
    if(dragMode==='canvas'){
      panX=startPanX+dx;
      panY=startPanY+dy;
    }else{
      railX=startRailX+dx;
    }
    layout();
    event.preventDefault();
  });

  const end=event=>{
    if(!down||event.pointerId!==pointerId)return;
    down=false;
    filmSpace.classList.remove('panning');
    try{filmSpace.releasePointerCapture?.(event.pointerId)}catch(_){ }
    pointerId=null;
  };

  filmSpace.addEventListener('pointerup',end);
  filmSpace.addEventListener('pointercancel',()=>{
    down=false;
    pointerId=null;
    filmSpace.classList.remove('panning');
  });
  addEventListener('resize',layout);
})();