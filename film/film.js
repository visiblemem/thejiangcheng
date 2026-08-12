(()=>{
  fetch('./film-sprite.txt')
    .then(response=>response.ok?response.text():Promise.reject())
    .then(data=>document.documentElement.style.setProperty('--film-sprite',`url("data:image/webp;base64,${data.replace(/\s/g,'')}")`))
    .catch(()=>{});

  const list=document.querySelector('.film-list');
  if(!list)return;
  const works=[...list.querySelectorAll('.film-work')];

  const spritePosition=index=>{
    const i=(index-1+16)%16;
    const col=i%4;
    const row=Math.floor(i/4);
    return `${(col*33.333).toFixed(3)}% ${(row*33.333).toFixed(3)}%`;
  };

  // ---- inline playback ----
  let currentPlaying=null;

  const stopWork=work=>{
    const video=work.querySelector('.film-video');
    if(video){video.pause();video.currentTime=0;}
    work.classList.remove('is-playing');
  };

  const playWork=work=>{
    if(currentPlaying&&currentPlaying!==work)stopWork(currentPlaying);
    const video=work.querySelector('.film-video');
    if(!video)return;
    work.classList.add('is-playing');
    video.play().catch(()=>{});
    currentPlaying=work;
  };

  const toggleWork=work=>{
    if(work.classList.contains('is-playing')){
      stopWork(work);
      currentPlaying=null;
    }else{
      playWork(work);
    }
  };

  works.forEach(work=>{
    work.addEventListener('click',()=>toggleWork(work));
    work.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        toggleWork(work);
      }
    });
    const video=work.querySelector('.film-video');
    video?.addEventListener('ended',()=>{
      stopWork(work);
      if(currentPlaying===work)currentPlaying=null;
    });
  });

  // ---- filter bar + horizontal strip ----
  const filterButtons=[...document.querySelectorAll('.filter-tag')];
  const stripWrap=document.getElementById('filmFilterStrip');
  const stripTrack=stripWrap?.querySelector('.filter-strip-track');
  let activeCategory=null;

  const buildStrip=category=>{
    if(!stripTrack)return;
    stripTrack.innerHTML='';
    works
      .filter(w=>w.dataset.filmCategory===category)
      .forEach(w=>{
        const index=Number(w.dataset.index||0);
        const title=w.dataset.title||'';
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='strip-item';
        btn.setAttribute('aria-label',`${title}，點擊定位並播放`);

        const thumb=document.createElement('span');
        thumb.className='strip-thumb';
        thumb.style.backgroundPosition=spritePosition(index);

        const label=document.createElement('span');
        label.className='strip-label';
        label.textContent=title;

        btn.append(thumb,label);
        btn.addEventListener('click',()=>{
          w.scrollIntoView({behavior:'smooth',block:'center'});
          playWork(w);
        });
        stripTrack.appendChild(btn);
      });
  };

  filterButtons.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const category=btn.dataset.category;
      if(activeCategory===category){
        activeCategory=null;
        if(stripWrap)stripWrap.hidden=true;
        filterButtons.forEach(b=>b.classList.remove('is-active'));
        return;
      }
      activeCategory=category;
      filterButtons.forEach(b=>b.classList.toggle('is-active',b===btn));
      buildStrip(category);
      if(stripWrap)stripWrap.hidden=false;
    });
  });
})();
