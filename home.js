(()=>{
  const root=document.documentElement;
  const heroVideo=document.querySelector('.hero-video');
  const menuBtn=document.querySelector('.menu-trigger');
  const mobileMenu=document.querySelector('#mobileMenu');
  const menuClose=mobileMenu?.querySelector('.menu-close');
  const main=document.querySelector('#main');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));

  function applyHeroState(){
    if(reduced.matches){
      root.style.setProperty('--hero-copy-opacity','1');
      root.style.setProperty('--hero-line-opacity','1');
      root.style.setProperty('--hero-dim-opacity','0');
      root.style.setProperty('--hero-scale','1');
      heroVideo?.pause();
      return;
    }
    const vh=Math.max(innerHeight,1);
    const y=scrollY;
    const copy=1-clamp(y/(vh*.62));
    const line=1-clamp((y-vh*.06)/(vh*.58));
    const dim=clamp((y-vh*.12)/(vh*.9),0,.92);
    const scale=1+clamp(y/(vh*2.2),0,.035);
    root.style.setProperty('--hero-copy-opacity',copy.toFixed(3));
    root.style.setProperty('--hero-line-opacity',line.toFixed(3));
    root.style.setProperty('--hero-dim-opacity',dim.toFixed(3));
    root.style.setProperty('--hero-scale',scale.toFixed(4));
  }

  let ticking=false;
  const queueHeroState=()=>{
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(()=>{
      applyHeroState();
      ticking=false;
    });
  };
  addEventListener('scroll',queueHeroState,{passive:true});
  addEventListener('resize',queueHeroState,{passive:true});
  reduced.addEventListener?.('change',applyHeroState);
  applyHeroState();

  const setMenuState=open=>{
    if(!menuBtn||!mobileMenu)return;
    menuBtn.setAttribute('aria-expanded',String(open));
    mobileMenu.setAttribute('aria-hidden',String(!open));
    if(main)main.inert=open;
    if(open){
      requestAnimationFrame(()=>menuClose?.focus());
    }else{
      main?.removeAttribute('inert');
    }
  };

  menuBtn?.addEventListener('click',()=>setMenuState(true));
  menuClose?.addEventListener('click',()=>{
    setMenuState(false);
    requestAnimationFrame(()=>menuBtn?.focus());
  });
  mobileMenu?.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>setMenuState(false)));
  addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!mobileMenu?.classList.contains('open'))return;
    mobileMenu.classList.remove('open');
    document.body.style.overflow='';
    setMenuState(false);
    menuBtn?.focus();
  });
})();
