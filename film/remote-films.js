(()=>{
  const config=window.JC_MEDIA||{};
  const apiUrl=String(config.filmApi||'').trim();
  const world=document.querySelector('.film-world');

  const startFilm=()=>{
    if(document.querySelector('script[data-film-runtime]'))return;
    const script=document.createElement('script');
    script.src='./film.js?v=20260815-mobile-density-1';
    script.dataset.filmRuntime='true';
    document.body.appendChild(script);
  };

  const shuffle=items=>{
    const result=[...items];
    for(let i=result.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [result[i],result[j]]=[result[j],result[i]];
    }
    return result;
  };

  const createTile=(item,index)=>{
    const kind=item.kind==='image'?'image':'video';
    const tile=document.createElement('article');
    tile.className='film-tile is-remote';
    tile.tabIndex=0;
    tile.dataset.index=String(index+1);
    tile.dataset.kind=kind;
    tile.dataset.title=item.title||'Untitled';
    tile.dataset.code=item.code||'';
    tile.dataset.duration=item.duration||'';
    if(item.category)tile.dataset.category=item.category;

    if(kind==='image')tile.dataset.image=item.url||'';
    else tile.dataset.video=item.url||'';

    const still=document.createElement('div');
    still.className='film-still';
    const visual=item.poster||(kind==='image'?item.url:'');
    if(visual){
      tile.classList.add('has-poster');
      still.style.setProperty('--tile-poster',`url("${String(visual).replace(/"/g,'\\"')}")`);
      still.style.setProperty('--tile-poster-size','cover');
      still.style.setProperty('--tile-poster-pos','center');
    }
    tile.appendChild(still);
    return tile;
  };

  if(!apiUrl||!world){
    document.documentElement.dataset.filmSource='static';
    startFilm();
    return;
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),4000);

  fetch(apiUrl,{headers:{Accept:'application/json'},signal:controller.signal})
    .then(response=>{
      if(!response.ok)throw new Error(`Film API ${response.status}`);
      return response.json();
    })
    .then(payload=>{
      const items=Array.isArray(payload?.items)?payload.items:[];
      if(!items.length)throw new Error('Film API returned no published items');
      const randomized=shuffle(items);
      world.replaceChildren(...randomized.map(createTile));
      document.documentElement.dataset.filmSource='r2';
    })
    .catch(error=>{
      console.warn('Using bundled Film archive fallback:',error?.message||error);
      document.documentElement.dataset.filmSource='static';
    })
    .finally(()=>{
      clearTimeout(timeout);
      startFilm();
    });
})();