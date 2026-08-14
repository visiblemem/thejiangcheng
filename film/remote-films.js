(()=>{
  const config=window.JC_MEDIA||{};
  const apiUrl=String(config.filmApi||'').trim();
  const world=document.querySelector('.film-world');

  const startFilm=()=>{
    if(document.querySelector('script[data-film-runtime]'))return;
    const script=document.createElement('script');
    script.src='./film.js?v=20260814-r2-1';
    script.dataset.filmRuntime='true';
    document.body.appendChild(script);
  };

  const createTile=(item,index)=>{
    const tile=document.createElement('article');
    tile.className='film-tile';
    tile.tabIndex=0;
    tile.dataset.index=String(index+1);
    tile.dataset.title=item.title||'Untitled';
    tile.dataset.code=item.code||'';
    tile.dataset.duration=item.duration||'';
    tile.dataset.video=item.url||'';
    if(item.category)tile.dataset.category=item.category;

    const still=document.createElement('div');
    still.className='film-still';
    if(item.poster){
      still.style.setProperty('--tile-poster',`url("${String(item.poster).replace(/"/g,'\\"')}")`);
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
  const timeout=setTimeout(()=>controller.abort(),2500);

  fetch(apiUrl,{headers:{Accept:'application/json'},signal:controller.signal})
    .then(response=>{
      if(!response.ok)throw new Error(`Film API ${response.status}`);
      return response.json();
    })
    .then(payload=>{
      const items=Array.isArray(payload?.items)?payload.items:[];
      if(!items.length)throw new Error('Film API returned no published items');
      world.replaceChildren(...items.map(createTile));
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
