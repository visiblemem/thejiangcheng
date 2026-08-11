const reveals=[...document.querySelectorAll('.reveal')];
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add('visible')}),{threshold:.12,rootMargin:'0px 0px -5% 0px'});
reveals.forEach(el=>observer.observe(el));

const toggle=document.querySelector('.index-toggle');
const panel=document.querySelector('#index-panel');
function closeIndex(){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');toggle.setAttribute('aria-expanded','false');toggle.textContent='INDEX'}
toggle.addEventListener('click',()=>{const open=!panel.classList.contains('open');panel.classList.toggle('open',open);panel.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'CLOSE':'INDEX'});
panel.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeIndex));
addEventListener('keydown',e=>{if(e.key==='Escape')closeIndex()});

const light=document.querySelector('.cursor-light');
if(light&&matchMedia('(pointer:fine)').matches){
  let x=innerWidth*.72,y=innerHeight*.25,tx=x,ty=y;
  addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY});
  const follow=()=>{x+=(tx-x)*.055;y+=(ty-y)*.055;light.style.left=x+'px';light.style.top=y+'px';requestAnimationFrame(follow)};
  follow();
}

const copy={
'zh-tw':{
hero_title:'虛構的人，<br>收藏真實。',
hero_sub:'Film, music, writing — and the things worth keeping.',
manifesto:'如果一個人不存在，<br>他的選擇還能不能留下品味？',
manifesto_note:'這裡沒有履歷。先看他留下了什麼。',
film_desc:'一部關於獨處不是缺少，而是一種選擇的短片。',
music_desc:'有些帳不是算不清，是算清楚以後，反而不知道該怎麼辦。',
writing_heading:'有些話，<br>適合慢一點讀。',
object_quote:'「我不喜歡它剛做好的樣子。<br>二十年後比較好。」',
object_body:'留下來的理由，往往比價格更能說明一個人的品味。',
about_body:'蔣誠是一位虛擬文化人物。創作橫跨影像、音樂與寫作。比起回答他是不是「真的」，這個計畫更在意：一個不存在的人，能不能形成真正的觀點、品味與作品。',
closing:'你現在知道的，<br>仍然只是其中一部分。'
},
'zh-cn':{
hero_title:'虚构的人，<br>收藏真实。',
hero_sub:'Film, music, writing — and the things worth keeping.',
manifesto:'如果一个人不存在，<br>他的选择还能不能留下品味？',
manifesto_note:'这里没有履历。先看他留下了什么。',
film_desc:'一部关于独处不是缺少，而是一种选择的短片。',
music_desc:'有些账不是算不清，是算清楚以后，反而不知道该怎么办。',
writing_heading:'有些话，<br>适合慢一点读。',
object_quote:'「我不喜欢它刚做好的样子。<br>二十年后比较好。」',
object_body:'留下来的理由，往往比价格更能说明一个人的品味。',
about_body:'蒋诚是一位虚拟文化人物。创作横跨影像、音乐与写作。比起回答他是不是“真的”，这个计划更在意：一个不存在的人，能不能形成真正的观点、品味与作品。',
closing:'你现在知道的，<br>仍然只是其中一部分。'
},
en:{
hero_title:'Fictional by nature.<br>Real in what remains.',
hero_sub:'Film, music, writing — and the things worth keeping.',
manifesto:'If a person does not exist,<br>can his choices still reveal taste?',
manifesto_note:'No biography yet. First, see what he chose to leave behind.',
film_desc:'A short film about solitude — not as absence, but as a choice.',
music_desc:'Some accounts are not difficult to settle. The difficulty starts once they are settled.',
writing_heading:'Some words<br>deserve to be read slowly.',
object_quote:'“I never liked it when it was new.<br>Twenty years later is better.”',
object_body:'Why something is kept often says more about taste than what it costs.',
about_body:'Jiang Cheng is a virtual cultural character working across film, music and writing. Rather than asking whether he is “real,” the project asks whether someone who does not exist can still develop a real point of view, taste and body of work.',
closing:'What you know now<br>is still only a fragment.'
}}

function applyLang(lang){
  const d=copy[lang]||copy['zh-tw'];
  document.documentElement.lang=lang==='en'?'en':lang==='zh-cn'?'zh-Hans':'zh-Hant';
  document.querySelectorAll('[data-i18n]').forEach(el=>{const value=d[el.dataset.i18n];if(value)el.innerHTML=value});
  document.querySelectorAll('.lang button').forEach(b=>b.classList.toggle('active',b.dataset.lang===lang));
  localStorage.setItem('jc-lang',lang);
}
const saved=localStorage.getItem('jc-lang');
const nav=(navigator.languages?.[0]||navigator.language||'').toLowerCase();
const inferred=nav.includes('zh-cn')||nav.includes('zh-hans')?'zh-cn':nav.startsWith('en')?'en':'zh-tw';
applyLang(saved||inferred);
document.querySelectorAll('.lang button').forEach(b=>b.addEventListener('click',()=>applyLang(b.dataset.lang)));
