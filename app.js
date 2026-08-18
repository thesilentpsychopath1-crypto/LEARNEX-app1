const $ = (s) => document.querySelector(s);
const splash = $('#splash'), app = $('#app'), splashImage = $('#splashImage');
const chat = $('#chat'), welcome = $('#welcome'), input = $('#input'), composer = $('#composer');
const historyEl = $('#history');
let messages = [];

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* Convert the common math notation produced by Learnex/Gemini into readable HTML.
   It intentionally supports the educational notation used by this app without
   evaluating arbitrary HTML or JavaScript. */
function mathHtml(source){
  let x = String(source ?? '').trim();

  // Protect escaped braces/backslashes only through textual conversion.
  // Fractions: repeat so nested simple fractions also render.
  for(let i=0;i<6;i++){
    const before=x;
    x=x.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
      '<span class="frac"><span class="frac-top">$1</span><span class="frac-bottom">$2</span></span>');
    if(x===before) break;
  }

  x=x
    .replace(/\\times\b/g,'×')
    .replace(/\\div\b/g,'÷')
    .replace(/\\cdot\b/g,'·')
    .replace(/\\pm\b/g,'±')
    .replace(/\\leq\b|\\le\b/g,'≤')
    .replace(/\\geq\b|\\ge\b/g,'≥')
    .replace(/\\neq\b/g,'≠')
    .replace(/\\approx\b/g,'≈')
    .replace(/\\rightarrow\b/g,'→')
    .replace(/\\left\b/g,'')
    .replace(/\\right\b/g,'')
    .replace(/\\sqrt\s*\{([^{}]*)\}/g,'√<span class="sqrt-content">$1</span>')
    .replace(/\^\{([^{}]+)\}/g,'<sup>$1</sup>')
    .replace(/_\\{([^{}]+)\\}/g,'<sub>$1</sub>')
    .replace(/_\{([^{}]+)\}/g,'<sub>$1</sub>')
    .replace(/\^([A-Za-z0-9])/g,'<sup>$1</sup>')
    .replace(/_([A-Za-z0-9])/g,'<sub>$1</sub>')
    .replace(/\\%/g,'%')
    .replace(/\\,/g,' ')
    .replace(/\\text\s*\{([^{}]*)\}/g,'$1')
    .replace(/\\mathrm\s*\{([^{}]*)\}/g,'$1')
    .replace(/\\mathbf\s*\{([^{}]*)\}/g,'<strong>$1</strong>')
    .replace(/\\\\/g,' ')
    .replace(/\\([{}[\]])/g,'$1');

  // Any remaining LaTeX command is shown as plain text rather than leaking
  // a confusing backslash-heavy representation into the UI.
  x=x.replace(/\\([a-zA-Z]+)\b/g,'$1');
  return x;
}

function renderMathSegments(text){
  // Escape first; mathHtml only inserts our own controlled markup.
  const safe=escapeHtml(text);
  const re=/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;
  let out='', last=0, m;
  while((m=re.exec(safe))){
    out += safe.slice(last,m.index);
    const body=m[1] ?? m[2] ?? '';
    const display=Boolean(m[1]);
    out += `<span class="${display?'math math-display':'math'}">${mathHtml(body)}</span>`;
    last=m.index+m[0].length;
  }
  return out+safe.slice(last);
}

function inlineMarkdown(text){
  let x=renderMathSegments(text);
  x=x.replace(/`([^`]+)`/g,'<code>$1</code>');
  x=x.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  x=x.replace(/__(.+?)__/g,'<strong>$1</strong>');
  x=x.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
  return x;
}

function renderMarkdown(text){
  const lines=String(text??'').split(/\r?\n/);
  let out='', list=false;
  const closeList=()=>{if(list){out+='</ul>';list=false;}};

  for(const raw of lines){
    const line=raw.trimEnd();

    if(/^###\s+/.test(line)){
      closeList();
      out+=`<h3>${inlineMarkdown(line.replace(/^###\s+/,'').trim())}</h3>`;
      continue;
    }
    if(/^##\s+/.test(line)){
      closeList();
      out+=`<h2>${inlineMarkdown(line.replace(/^##\s+/,'').trim())}</h2>`;
      continue;
    }
    if(/^#\s+/.test(line)){
      closeList();
      out+=`<h2>${inlineMarkdown(line.replace(/^#\s+/,'').trim())}</h2>`;
      continue;
    }
    if(/^\s*(?:[-*]|\d+\.)\s+/.test(line)){
      if(!list){out+='<ul>';list=true;}
      const item=line.replace(/^\s*(?:[-*]|\d+\.)\s+/,'');
      out+=`<li>${inlineMarkdown(item)}</li>`;
      continue;
    }
    closeList();

    if(!line.trim()) continue;
    out+=`<p>${inlineMarkdown(line)}</p>`;
  }

  closeList();
  return out||'<p></p>';
}

function addMessage(role,text){
  const row=document.createElement('div'); row.className=`message ${role}`;
  if(role==='assistant'){
    const img=document.createElement('img');
    img.className='avatar'; img.src='/logo-mark.png'; img.alt='Learnex AI';
    row.appendChild(img);
  }
  const bubble=document.createElement('div'); bubble.className='bubble';
  if(role==='assistant') bubble.innerHTML=renderMarkdown(text);
  else bubble.textContent=String(text??'');
  row.appendChild(bubble); chat.appendChild(row);
  requestAnimationFrame(()=>row.scrollIntoView({behavior:'smooth',block:'nearest'}));
  return bubble;
}

function addTyping(){
  const b=addMessage('assistant','');
  b.innerHTML='<span class="typing"><span></span><span></span><span></span></span>';
  return b;
}

function saveHistory(){
  localStorage.setItem('learnex-history',JSON.stringify(messages.slice(-20)));
  renderHistory();
}

function loadHistory(){
  try{messages=JSON.parse(localStorage.getItem('learnex-history')||'[]');}
  catch{messages=[]}
  if(messages.length){
    welcome.style.display='none';
    messages.forEach(m=>addMessage(m.role,m.content));
  }
}

function renderHistory(){
  historyEl.innerHTML='';
  const users=messages.filter(m=>m.role==='user').slice(-8).reverse();
  users.forEach(m=>{
    const b=document.createElement('button');
    b.textContent=m.content;
    b.onclick=()=>{input.value=m.content;closeDrawer();input.focus()};
    historyEl.appendChild(b);
  });
}

async function sendMessage(text){
  text=(text||'').trim(); if(!text) return;
  welcome.style.display='none';
  addMessage('user',text);
  messages.push({role:'user',content:text});
  input.value=''; input.style.height='auto';
  const typing=addTyping();

  try{
    const r=await fetch('/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages})
    });
    const data=await r.json().catch(()=>({error:'Invalid server response.'}));
    if(!r.ok) throw new Error(data.error||'The AI could not answer right now.');
    typing.innerHTML=renderMarkdown(data.reply);
    messages.push({role:'assistant',content:data.reply});
    saveHistory();
  }catch(err){
    typing.innerHTML='';
    typing.textContent=`Sorry — ${err.message}`;
  }
}

composer.addEventListener('submit',e=>{e.preventDefault();sendMessage(input.value)});
input.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    sendMessage(input.value);
  }
});
input.addEventListener('input',()=>{
  input.style.height='auto';
  input.style.height=Math.min(input.scrollHeight,120)+'px';
});
document.querySelectorAll('[data-prompt]').forEach(b=>
  b.addEventListener('click',()=>sendMessage(b.dataset.prompt))
);
$('#clearBtn').onclick=()=>{
  messages=[]; localStorage.removeItem('learnex-history');
  chat.innerHTML=''; welcome.style.display='block'; renderHistory();
};
$('#newChat').onclick=()=>{$('#clearBtn').click();closeDrawer()};

function openDrawer(){
  $('#drawer').classList.add('open');
  $('#backdrop').classList.add('show');
  $('#drawer').setAttribute('aria-hidden','false');
}
function closeDrawer(){
  $('#drawer').classList.remove('open');
  $('#backdrop').classList.remove('show');
  $('#drawer').setAttribute('aria-hidden','true');
}
$('#menuBtn').onclick=openDrawer;
$('#closeDrawer').onclick=closeDrawer;
$('#backdrop').onclick=closeDrawer;

$('#micBtn').onclick=()=>{
  if(!('webkitSpeechRecognition'in window||'SpeechRecognition'in window))return;
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;
  const rec=new R();
  rec.lang='bn-BD';
  rec.onresult=e=>{
    input.value=e.results[0][0].transcript;
    input.dispatchEvent(new Event('input'));
  };
  rec.start();
};
$('#plusBtn').onclick=()=>input.focus();

async function start(){
  const startTime=performance.now();
  if(!splashImage.complete || splashImage.naturalWidth===0)
    await new Promise(resolve=>{
      splashImage.onload=resolve;
      splashImage.onerror=resolve;
    });
  await sleep(Math.max(0,2600-(performance.now()-startTime)));
  loadHistory(); renderHistory();
  app.classList.remove('is-hidden');
  app.style.visibility='visible';
  app.style.opacity='1';
  document.body.classList.remove('loading');
  splash.classList.add('done');
  setTimeout(()=>splash.remove(),450);
}
if(document.readyState==='complete')start();
else window.addEventListener('load',start,{once:true});
