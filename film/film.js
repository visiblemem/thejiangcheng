(()=>{
  const tabs=[...document.querySelectorAll('.film-tab')];
  const projects=[...document.querySelectorAll('.film-project')];
  const lightbox=document.querySelector('.film-lightbox');
  const lightboxVideo=lightbox?.querySelector('video');
  const closeButton=document.querySelector('.film-lightbox-close');

  const setView=view=>{
    tabs.forEach(tab=>{
      const active=tab.dataset.view===view;
      tab.classList.toggle('is-active',active);
      tab.setAttribute('aria-selected',String(active));
    });
    projects.forEach(project=>{
      project.classList.toggle('is-hidden',view!=='all'&&project.dataset.category!==view);
    });
    window.scrollTo({top:0,behavior:'smooth'});
  };

  tabs.forEach(tab=>tab.addEventListener('click',()=>setView(tab.dataset.view)));

  const openLightbox=source=>{
    if(!lightbox||!lightboxVideo)return;
    lightboxVideo.src=source||'../media/jc-hero.mp4';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    lightboxVideo.play().catch(()=>{});
  };

  const closeLightbox=()=>{
    if(!lightbox||!lightboxVideo)return;
    lightboxVideo.pause();
    lightboxVideo.currentTime=0;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  };

  document.querySelectorAll('.project-media').forEach(button=>{
    const preview=button.querySelector('video');
    button.addEventListener('mouseenter',()=>preview?.play().catch(()=>{}));
    button.addEventListener('mouseleave',()=>{if(preview){preview.pause();preview.currentTime=0;}});
    button.addEventListener('click',()=>openLightbox(preview?.getAttribute('src')));
  });

  closeButton?.addEventListener('click',closeLightbox);
  lightbox?.addEventListener('click',event=>{if(event.target===lightbox)closeLightbox();});
  addEventListener('keydown',event=>{if(event.key==='Escape')closeLightbox();});
})();
