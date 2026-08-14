(()=>{
  const fmt=value=>{
    if(!Number.isFinite(value)||value<0)return '00:00';
    const m=Math.floor(value/60);
    const s=Math.floor(value%60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const attach=video=>{
    if(!video||video.dataset.jcPlayer==='1')return;
    video.dataset.jcPlayer='1';
    video.controls=false;
    video.playsInline=true;
    video.disablePictureInPicture=true;
    video.setAttribute('controlsList','nodownload noplaybackrate noremoteplayback');

    const host=video.parentElement;
    if(!host)return;
    if(getComputedStyle(host).position==='static')host.style.position='relative';

    const ui=document.createElement('div');
    ui.className='jc-player-ui';
    ui.setAttribute('role','group');
    ui.setAttribute('aria-label','Video controls');

    const play=document.createElement('button');
    play.type='button';
    play.className='jc-player-btn jc-player-play';
    play.textContent='▶';
    play.setAttribute('aria-label','Play video');

    const progress=document.createElement('input');
    progress.type='range';
    progress.className='jc-player-progress';
    progress.min='0';
    progress.max='1000';
    progress.value='0';
    progress.step='1';
    progress.setAttribute('aria-label','Video progress');

    const time=document.createElement('span');
    time.className='jc-player-time';
    time.textContent='00:00 / 00:00';

    const mute=document.createElement('button');
    mute.type='button';
    mute.className='jc-player-btn jc-player-mute';
    mute.textContent='SOUND';
    mute.setAttribute('aria-label','Mute video');

    const full=document.createElement('button');
    full.type='button';
    full.className='jc-player-btn jc-player-full';
    full.textContent='FULL';
    full.setAttribute('aria-label','Enter fullscreen');

    ui.append(play,progress,time,mute,full);
    host.appendChild(ui);

    const stop=e=>e.stopPropagation();
    ['pointerdown','pointerup','click','dblclick'].forEach(type=>ui.addEventListener(type,stop));

    let dragging=false;
    const sync=()=>{
      play.textContent=video.paused?'▶':'Ⅱ';
      play.setAttribute('aria-label',video.paused?'Play video':'Pause video');
      mute.textContent=video.muted?'MUTED':'SOUND';
      mute.setAttribute('aria-label',video.muted?'Unmute video':'Mute video');
      const duration=Number.isFinite(video.duration)?video.duration:0;
      const ratio=duration?video.currentTime/duration:0;
      if(!dragging)progress.value=String(Math.round(ratio*1000));
      progress.style.setProperty('--progress',`${Math.max(0,Math.min(100,ratio*100))}%`);
      time.textContent=`${fmt(video.currentTime)} / ${fmt(duration)}`;
    };

    play.addEventListener('click',()=>{
      if(video.paused)video.play().catch(()=>{});
      else video.pause();
    });
    mute.addEventListener('click',()=>{video.muted=!video.muted;sync();});
    progress.addEventListener('pointerdown',()=>{dragging=true;ui.classList.add('is-active');});
    progress.addEventListener('input',()=>{
      const duration=video.duration||0;
      if(duration)video.currentTime=(Number(progress.value)/1000)*duration;
      progress.style.setProperty('--progress',`${Number(progress.value)/10}%`);
    });
    const finishScrub=()=>{dragging=false;ui.classList.remove('is-active');sync();};
    progress.addEventListener('change',finishScrub);
    progress.addEventListener('pointerup',finishScrub);
    progress.addEventListener('pointercancel',finishScrub);
    full.addEventListener('click',async()=>{
      const target=host.closest('.film-expanded-frame')||host;
      try{
        if(document.fullscreenElement)await document.exitFullscreen();
        else if(target.requestFullscreen)await target.requestFullscreen();
      }catch(_){}
    });

    ['loadedmetadata','durationchange','timeupdate','play','pause','volumechange','ended','emptied'].forEach(type=>video.addEventListener(type,sync));
    document.addEventListener('fullscreenchange',()=>{
      const active=Boolean(document.fullscreenElement);
      full.textContent=active?'EXIT':'FULL';
      full.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');
    });
    sync();
  };

  document.querySelectorAll('video.film-inline-video,video.film-expanded-video').forEach(attach);

  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.matches?.('video.film-inline-video,video.film-expanded-video'))attach(node);
        node.querySelectorAll?.('video.film-inline-video,video.film-expanded-video').forEach(attach);
      }
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
