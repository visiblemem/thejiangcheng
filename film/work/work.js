(()=>{
  const config=window.JC_MEDIA||{};
  const apiUrl=String(config.filmApi||'').trim();
  const workId=new URLSearchParams(location.search).get('work')||'';

  const loading=document.querySelector('.work-loading');
  const object=document.querySelector('.work-object');
  const errorView=document.querySelector('.work-error');
  const media=document.querySelector('.work-media');
  const video=document.querySelector('.work-video');
  const code=document.querySelector('.work-code');
  const year=document.querySelector('.work-year');
  const title=document.querySelector('.work-title');
  const description=document.querySelector('.work-description');
  const credits=document.querySelector('.work-credits');
  const external=document.querySelector('.work-external-links');
  const share=document.querySelector('.work-share');
  const copy=document.querySelector('.work-copy-link');
  const prev=document.querySelector('.work-prev');
  const next=document.querySelector('.work-next');

  let loadingTimer=setTimeout(()=>{
    if(object.hidden&&errorView.hidden)loading.hidden=false;
  },700);

  const stopLoading=()=>{
    clearTimeout(loadingTimer);
    loadingTimer=null;
    loading.hidden=true;
  };

  const fallbackDescription=item=>`「${item?.title||'這支作品'}」保留了一段沒有被完整說明的時間。影像更在意人物、空間與停頓之間的關係，讓觀看本身慢慢形成故事。`;

  const copyText=async text=>{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      return true;
    }
    const input=document.createElement('textarea');
    input.value=text;
    input.setAttribute('readonly','');
    input.style.position='fixed';
    input.style.opacity='0';
    document.body.appendChild(input);
    input.select();
    const ok=document.execCommand?.('copy');
    input.remove();
    return Boolean(ok);
  };

  const workHref=item=>`./?work=${encodeURIComponent(item.slug||item.key||'')}`;

  const renderCredits=item=>{
    credits.replaceChildren();
    const rows=Array.isArray(item.credits)&&item.credits.length
      ? item.credits
      : [
          {label:'Direction',value:'Jiang Cheng'},
          {label:'Format',value:item.category||'FILM'},
          {label:'Year',value:item.year||'2026'}
        ];

    rows.forEach(entry=>{
      const row=document.createElement('div');
      row.className='work-credit-row';
      const label=document.createElement('span');
      label.textContent=entry?.label||'';
      const value=document.createElement('strong');
      value.textContent=entry?.value||'';
      row.append(label,value);
      credits.appendChild(row);
    });
  };

  const renderLinks=item=>{
    external.replaceChildren();
    const links=Array.isArray(item.links)?item.links.filter(link=>link?.href):[];
    links.forEach(link=>{
      const anchor=document.createElement('a');
      anchor.href=link.href;
      anchor.target='_blank';
      anchor.rel='noopener noreferrer';
      anchor.textContent=`${link.label||'EXTERNAL LINK'} ↗`;
      external.appendChild(anchor);
    });

    if(item.url&&!links.some(link=>link.href===item.url)){
      const mediaLink=document.createElement('a');
      mediaLink.href=item.url;
      mediaLink.target='_blank';
      mediaLink.rel='noopener noreferrer';
      mediaLink.textContent='OPEN MEDIA ↗';
      external.appendChild(mediaLink);
    }
  };

  const setNeighbour=(anchor,item,label)=>{
    if(!item){anchor.hidden=true;return;}
    anchor.hidden=false;
    anchor.href=workHref(item);
    const small=anchor.querySelector('small');
    const text=anchor.querySelector('span');
    if(small)small.textContent=label;
    if(text)text.textContent=item.title||'Untitled';
  };

  const render=(item,videos,index)=>{
    stopLoading();
    errorView.hidden=true;
    object.hidden=false;

    document.title=`${item.title||'Film'} — Jiang Cheng`;
    code.textContent=item.code||item.category||'FILM';
    year.textContent=item.year||'2026';
    title.textContent=item.title||'Untitled';
    description.textContent=item.description||fallbackDescription(item);

    video.src=item.url||'';
    if(item.poster)video.poster=item.poster;
    video.addEventListener('loadedmetadata',()=>{
      const portrait=video.videoHeight>video.videoWidth;
      media.classList.toggle('is-portrait',portrait);
      media.classList.toggle('is-landscape',!portrait);
    },{once:true});

    renderCredits(item);
    renderLinks(item);
    setNeighbour(prev,index>0?videos[index-1]:null,'PREVIOUS');
    setNeighbour(next,index<videos.length-1?videos[index+1]:null,'NEXT');

    share.addEventListener('click',async()=>{
      const url=location.href;
      if(navigator.share){
        try{
          await navigator.share({title:item.title||'Jiang Cheng Film',text:item.description||'',url});
          return;
        }catch(error){
          if(error?.name==='AbortError')return;
        }
      }
      try{
        await copyText(url);
        share.textContent='LINK COPIED';
        setTimeout(()=>share.textContent='SHARE',1400);
      }catch(_){}
    });

    copy.addEventListener('click',async()=>{
      try{
        await copyText(location.href);
        copy.textContent='COPIED';
        setTimeout(()=>copy.textContent='COPY LINK',1400);
      }catch(_){}
    });
  };

  const fail=()=>{
    stopLoading();
    object.hidden=true;
    errorView.hidden=false;
  };

  if(!apiUrl||!workId){
    fail();
    return;
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6000);

  fetch(apiUrl,{headers:{Accept:'application/json'},signal:controller.signal})
    .then(response=>{
      if(!response.ok)throw new Error(`Film API ${response.status}`);
      return response.json();
    })
    .then(payload=>{
      const videos=(Array.isArray(payload?.items)?payload.items:[])
        .filter(item=>item?.kind==='video'&&item?.published!==false)
        .sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||String(a.key||'').localeCompare(String(b.key||'')));

      const index=videos.findIndex(item=>
        String(item.slug||'')===workId||
        String(item.key||'')===workId||
        String(item.order||'')===workId
      );
      if(index<0)throw new Error('Work not found');
      render(videos[index],videos,index);
    })
    .catch(error=>{
      console.warn('Unable to load Film work:',error?.message||error);
      fail();
    })
    .finally(()=>clearTimeout(timeout));
})();
