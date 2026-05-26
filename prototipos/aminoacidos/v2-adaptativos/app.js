const stage = document.getElementById('stage');
const entitiesEl = document.getElementById('entities');
const floatersEl = document.getElementById('floaters');
const linksSvg = document.getElementById('links');
const bg = document.getElementById('bg');
const ctx = bg.getContext('2d');
const statusText = document.getElementById('statusText');
const healthValue = document.getElementById('healthValue');
const energyValue = document.getElementById('energyValue');
const collapseValue = document.getElementById('collapseValue');
const healthBar = document.getElementById('healthBar');
const energyBar = document.getElementById('energyBar');
const collapseBar = document.getElementById('collapseBar');
const clockEl = document.getElementById('clock');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const memoryIntro = document.getElementById('memoryIntro');
const memoryDetails = document.getElementById('memoryDetails');
const clearMemorySelectionBtn = document.getElementById('clearMemorySelectionBtn');
const restartMemoryBtn = document.getElementById('restartMemoryBtn');

const organism = { x: 0, y: 0, radius: 60 };
const rings = { spectrum: 116, spectrumOuter: 160, events: 206, amino: 320 };
const aminoDefs = [
  { id: 'anticipacion', abbr: 'AN', name: 'Anticipación' },
  { id: 'agilidad', abbr: 'AG', name: 'Agilidad' },
  { id: 'aprendizaje', abbr: 'AP', name: 'Aprendizaje' },
  { id: 'adecuacion', abbr: 'AD', name: 'Adecuación' },
  { id: 'antifragilidad', abbr: 'AF', name: 'Antifragilidad' }
];
const eventCatalog = [
  { type: 'ceguera', label: 'Ceguera', short: 'CG', main: 'anticipacion', combo: 'aprendizaje', hint: 'Anticipación + Aprendizaje' },
  { type: 'lentitud', label: 'Lentitud', short: 'LT', main: 'agilidad', combo: 'anticipacion', hint: 'Agilidad + Anticipación' },
  { type: 'error', label: 'Repetición', short: 'RP', main: 'aprendizaje', combo: 'antifragilidad', hint: 'Aprendizaje + Antifragilidad' },
  { type: 'desajuste', label: 'Desajuste', short: 'DJ', main: 'adecuacion', combo: 'anticipacion', hint: 'Adecuación + Anticipación' },
  { type: 'crisis', label: 'Crisis', short: 'CR', main: 'antifragilidad', combo: 'aprendizaje', hint: 'Antifragilidad + Aprendizaje' },
  { type: 'rigidez', label: 'Rigidez', short: 'RG', main: 'adecuacion', combo: 'agilidad', hint: 'Adecuación + Agilidad' }
];

const state = {
  running: false,
  ended: false,
  memoryMode: false,
  startedAt: 0,
  duration: 180000,
  health: 80,
  energy: 60,
  collapse: 10,
  amino: [],
  events: [],
  sprouts: [],
  memories: [],
  memoryPoints: [],
  particles: [],
  barCount: 260,
  dragging: null,
  dragOffset: { x: 0, y: 0 },
  lastSpawn: 0,
  spawnGap: 9000,
  frameTime: performance.now(),
  pointer: { x: -9999, y: -9999, active: false },
  stats: {
    spawned: 0,
    revealed: 0,
    resolved: 0,
    transformed: 0,
    sprouts: 0,
    reinforcedLinks: 0,
    typesResolved: {}
  }
};

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function nowMs(){return performance.now();}
function angleToXY(angle,radius){return {x:organism.x+Math.cos(angle)*radius,y:organism.y+Math.sin(angle)*radius};}
function normalizeAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
function pointInStage(e){const r=stage.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function fmtTime(ms){const sec=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;}
function aminoName(id){return aminoDefs.find(a=>a.id===id)?.name || id;}

function resize(){const rect=stage.getBoundingClientRect();bg.width=rect.width*devicePixelRatio;bg.height=rect.height*devicePixelRatio;bg.style.width=rect.width+'px';bg.style.height=rect.height+'px';ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);linksSvg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);organism.x=rect.width/2;organism.y=rect.height/2+6;}
window.addEventListener('resize',resize);

function syncHud(){healthValue.textContent=Math.round(state.health);energyValue.textContent=Math.round(state.energy);collapseValue.textContent=Math.round(state.collapse);healthBar.style.width=clamp(state.health,0,100)+'%';energyBar.style.width=clamp(state.energy,0,100)+'%';collapseBar.style.width=clamp(state.collapse,0,100)+'%';}
function updateClock(){const remain=clamp(state.duration-(nowMs()-state.startedAt),0,state.duration);const s=Math.ceil(remain/1000);clockEl.textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;if(remain<=0&&state.running){endChallenge('El ciclo terminó. Los puntos naranjos muestran la memoria adaptativa del proceso.');}}

function makeNode(className, html){const el=document.createElement('div');el.className=`node ${className}`;el.innerHTML=html;entitiesEl.appendChild(el);return el;}
function spawnFloater(x,y,text,tone='good'){const div=document.createElement('div');div.className=`floater ${tone}`;div.textContent=text;div.style.left=`${x}px`;div.style.top=`${y}px`;floatersEl.appendChild(div);setTimeout(()=>div.remove(),1650);}

function initParticles(){state.particles=Array.from({length:110},()=>({angle:Math.random()*Math.PI*2,r:90+Math.random()*360,speed:0.00025+Math.random()*0.0008,size:0.8+Math.random()*2.2,alpha:0.05+Math.random()*0.14,drift:.7+Math.random()*1.2}));}
function initAmino(){state.amino=aminoDefs.map((def,i)=>{const baseAngle=-Math.PI/2+i*(Math.PI*2/aminoDefs.length);const p=angleToXY(baseAngle,rings.amino);const obj={...def,angle:baseAngle,homeAngle:baseAngle,orbitRadius:rings.amino+(i%2?12:-10),phase:i*0.8,x:p.x,y:p.y,vx:0,vy:0,dragging:false,anchor:null,cooldown:0,el:makeNode('amino',`<div class="spec"></div><div class="ring"></div><div class="disc"></div><div class="abbr">${def.abbr}</div><div class="name">${def.name}</div>`)};obj.el.addEventListener('pointerdown',e=>onAminoDown(obj,e));return obj;});}

function resetState(){entitiesEl.innerHTML='';floatersEl.innerHTML='';linksSvg.innerHTML=`<defs><linearGradient id="mixLine" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#7fd0ff"/><stop offset="52%" stop-color="#7fd0ff"/><stop offset="100%" stop-color="#ff9f36"/></linearGradient></defs>`;state.running=false;state.ended=false;state.startedAt=0;state.health=80;state.energy=60;state.collapse=10;state.events=[];state.sprouts=[];state.memories=[];state.memoryPoints=[];state.lastSpawn=0;state.dragging=null;state.memoryMode=false;stage.classList.remove('memoryMode');state.stats={spawned:0,revealed:0,resolved:0,transformed:0,sprouts:0,reinforcedLinks:0,typesResolved:{}};memoryDetails.innerHTML='';memoryIntro.textContent='Al terminar el reto, selecciona un punto naranja para leer qué ocurrió, cuándo ocurrió y cómo fue resuelto.';initAmino();initParticles();syncHud();clockEl.textContent='03:00';statusText.textContent='Pulsa iniciar. Usa Anticipación para desenmascarar señales antes de que maduren.';}

function onAminoDown(amino,e){if(state.memoryMode)return;if(amino.anchor){releaseAmino(amino);} amino.dragging=true;state.dragging=amino;amino.el.classList.add('selected');const pt=pointInStage(e);state.dragOffset.x=pt.x-amino.x;state.dragOffset.y=pt.y-amino.y;amino.el.setPointerCapture?.(e.pointerId);}
window.addEventListener('pointermove',e=>{const p=pointInStage(e);state.pointer.x=p.x;state.pointer.y=p.y;state.pointer.active=true;if(!state.dragging)return;const a=state.dragging;a.x=p.x-state.dragOffset.x;a.y=p.y-state.dragOffset.y;a.vx=0;a.vy=0;tryAutoAnchor(a);});
stage.addEventListener('pointerleave',()=>{state.pointer.active=false;state.pointer.x=-9999;state.pointer.y=-9999;});
window.addEventListener('pointerup',()=>{if(!state.dragging)return;state.dragging.el.classList.remove('selected');state.dragging.dragging=false;state.dragging=null;});

function spawnEvent(t){const catalog=eventCatalog[Math.floor(Math.random()*eventCatalog.length)];let angle=Math.random()*Math.PI*2;for(let tries=0;tries<30;tries++){if(state.events.every(ev=>Math.abs(normalizeAngle(ev.angle-angle))>.34))break;angle=Math.random()*Math.PI*2;}const p=angleToXY(angle,rings.events);const ev={id:'e'+Math.random().toString(36).slice(2,8),...catalog,angle,x:p.x,y:p.y,state:'latent',born:t,progress:100,merged:false,mainAnchor:null,comboAnchor:null,el:makeNode('event latent hiddenLabel',`<div class="ring"></div><div class="disc"></div><div class="abbr">?</div><div class="hint">señal latente</div><div class="name"></div><div class="progress"><i></i></div><div class="needTag">falta otro</div>`)};state.events.push(ev);state.stats.spawned++;}
function revealEvent(ev){if(ev.state!=='latent')return;ev.state='revealed';ev.el.classList.remove('latent','hiddenLabel');ev.el.querySelector('.abbr').textContent=ev.short;ev.el.querySelector('.name').textContent=ev.label;ev.el.querySelector('.hint').textContent=ev.hint;state.stats.revealed++;statusText.textContent=`Amenaza revelada: ${ev.label}. Interviene con ${ev.hint}.`;spawnFloater(ev.x,ev.y-18,'Amenaza revelada','info');}
function resolveEvent(ev,combo){
 const resolvedAt=nowMs();
 const used=[];
 if(ev.mainAnchor) used.push(ev.mainAnchor.id);
 if(ev.comboAnchor) used.push(ev.comboAnchor.id);
 if(!used.length) used.push(ev.main);
 const best=[ev.main,ev.combo];
 const effectiveness=combo?'Alta':'Parcial';
 state.health=clamp(state.health+(combo?8:5),0,100);
 state.energy=clamp(state.energy+(combo?6:3),0,100);
 state.collapse=clamp(state.collapse-(combo?10:5),0,100);
 state.sprouts.push({angle:ev.angle+(Math.random()-.5)*.35,r:organism.radius+42+Math.random()*34,size:combo?8:5,alpha:1});
 state.stats.sprouts++;state.stats.resolved++;state.stats.reinforcedLinks+=combo?2:1;state.stats.typesResolved[ev.label]=(state.stats.typesResolved[ev.label]||0)+1;if(combo)state.stats.transformed++;
 const memory={id:'m'+Math.random().toString(36).slice(2,8),angle:ev.angle,event:ev.label,time:fmtTime(resolvedAt-state.startedAt),used:used.map(aminoName),best:best.map(aminoName),effectiveness,result:combo?'El síntoma se transformó en vínculo reforzado.':'El síntoma se redujo, pero la intervención no completó la combinación óptima.',combo};
 const mp=angleToXY(memory.angle, organism.radius+56+Math.random()*32);memory.x=mp.x;memory.y=mp.y;state.memories.push(memory);createMemoryPoint(memory);
 spawnFloater(ev.x,ev.y,combo?'Memoria reforzada':'Memoria parcial','good');
 statusText.textContent=combo?`${ev.label} metabolizado. Quedó como memoria adaptativa.`:`${ev.label} reducido. Quedó registro parcial del aprendizaje.`;
 if(ev.mainAnchor)releaseAmino(ev.mainAnchor,true); if(ev.comboAnchor)releaseAmino(ev.comboAnchor,true);
 ev.el.remove();state.events=state.events.filter(item=>item!==ev);syncHud();}

function createMemoryPoint(memory){const el=document.createElement('button');el.type='button';el.className='memoryPoint';el.style.left=`${memory.x}px`;el.style.top=`${memory.y}px`;el.title=`${memory.event} · ${memory.time}`;el.addEventListener('click',()=>selectMemory(memory.id));entitiesEl.appendChild(el);state.memoryPoints.push({id:memory.id,el});}
function selectMemory(id){state.memoryPoints.forEach(p=>p.el.classList.toggle('active',p.id===id));const m=state.memories.find(item=>item.id===id);if(!m)return;memoryIntro.textContent='Registro de evento resuelto. Esta huella queda como memoria adaptativa del organismo.';memoryDetails.innerHTML=`<div class="memoryRow"><span>EVENTO</span><strong>${m.event}</strong></div><div class="memoryRow"><span>MOMENTO</span><strong>${m.time}</strong></div><div class="memoryRow"><span>RESOLUCIÓN APLICADA</span><strong>${m.used.join(' + ')}</strong></div><div class="memoryRow"><span>SOLUCIÓN MÁS EFECTIVA</span><strong>${m.best.join(' + ')}</strong></div><div class="memoryRow"><span>EFECTIVIDAD</span><strong>${m.effectiveness}</strong></div><div class="memoryRow"><span>LECTURA</span><strong>${m.result}</strong></div>`;}


function tryAutoAnchor(amino){if(amino.anchor || amino.cooldown>0) return; for(const ev of state.events){if(ev.state==='latent') continue; const d=dist(amino,ev); if(d>86) continue; if(amino.id===ev.main && !ev.mainAnchor){attachAminoToEvent(amino,ev,'main'); return;} if(amino.id===ev.combo && !ev.comboAnchor){attachAminoToEvent(amino,ev,'combo'); return;}}}
function attachAminoToEvent(amino,ev,role){amino.anchor={eventId:ev.id,role,offset: role==='main' ? -0.75 : 0.75}; amino.dragging=false; if(state.dragging===amino){amino.el.classList.remove('selected'); state.dragging=null;} if(role==='main') ev.mainAnchor=amino; else ev.comboAnchor=amino; amino.el.classList.add('locked'); if(role==='main' && !ev.comboAnchor){ev.el.classList.add('needsCombo'); spawnFloater(ev.x,ev.y-26,'Falta otro','info'); statusText.textContent=`${ev.label}: primer aminoácido fijado. Falta ${ev.combo}.`;}}
function releaseAmino(amino,success=false){if(!amino.anchor) return; const ev=state.events.find(e=>e.id===amino.anchor.eventId); if(ev){ if(amino.anchor.role==='main') ev.mainAnchor=null; else ev.comboAnchor=null; ev.el.classList.remove('needsCombo'); }
 amino.anchor=null; amino.cooldown= success ? 40 : 10; amino.el.classList.remove('locked'); }

function getNearbyAmino(ev){return state.amino.filter(a=>a.anchor?.eventId===ev.id || (!a.anchor && dist(a,ev)<98));}
function updateEvents(dt,t){
  if(state.running && !state.ended && (t-state.lastSpawn>state.spawnGap || state.events.length===0) && state.events.length<5){spawnEvent(t);state.lastSpawn=t;}
  const activeCount = state.events.filter(ev=>ev.state==='active'||ev.state==='parasite'||ev.state==='revealed').length;
  const urgencyScale = 1 + Math.max(0, activeCount-1) * 0.75;
  const parasiteCount = state.events.filter(ev=>ev.state==='parasite').length;
  const snapshot=[...state.events];
  snapshot.forEach(ev=>{
    const age=t-ev.born;
    if(ev.state==='latent'){const anticipacion=state.amino.find(a=>a.id==='anticipacion'); if(!anticipacion.anchor && dist(anticipacion,ev)<92) revealEvent(ev); if(age>10000){revealEvent(ev);ev.state='active';spawnFloater(ev.x,ev.y+20,'Evento activo','bad');}}
    else if(ev.state==='revealed'&&age>10000){ev.state='active';spawnFloater(ev.x,ev.y+20,'Evento activo','bad');}

    const nearby=getNearbyAmino(ev);const hasMain=!!ev.mainAnchor || nearby.some(a=>a.id===ev.main);const hasCombo=!!ev.comboAnchor || nearby.some(a=>a.id===ev.combo);const wrong=nearby.filter(a=>a.id!==ev.main&&a.id!==ev.combo).length;
    if(ev.state!=='latent'){
      let rate=0; if(hasMain&&hasCombo) rate=3.8; else if(hasMain) rate=1.1;
      ev.progress=clamp(ev.progress-rate*dt*10,0,100);
      ev.el.classList.toggle('needsCombo', !!ev.mainAnchor && !hasCombo);
      if(ev.progress<=0){resolveEvent(ev,hasMain&&hasCombo);return;}
    }
    if(state.running && ev.state!=='latent'){
      const multiplier=ev.state==='active'?1:0.68;
      const damageScale=ev.progress/100;
      const parasiteBoost = ev.state==='parasite' ? 1.8 : 1;
      state.health=clamp(state.health-(0.15*dt*multiplier*damageScale*urgencyScale*parasiteBoost),0,100);
      state.collapse=clamp(state.collapse+(0.11*dt*multiplier*damageScale*urgencyScale*parasiteBoost)+(parasiteCount*0.008*dt),0,100);
      if(!hasMain&&wrong) state.energy=clamp(state.energy-(0.03*dt*urgencyScale),0,100);
    }
    if((t-ev.born)>26000 && ev.state==='active'){ev.state='parasite';ev.el.querySelector('.hint').textContent='colapso parasitario';}
    for(const other of state.events){if(other===ev||ev.merged||other.merged)continue;if((ev.state==='active'||ev.state==='parasite')&&(other.state==='active'||other.state==='parasite')&&Math.abs(normalizeAngle(ev.angle-other.angle))<0.20){ev.progress=clamp((ev.progress+other.progress)/2+20,0,140);ev.state='parasite';ev.label='Núcleo';ev.short='NK';ev.main='antifragilidad';ev.combo='aprendizaje';ev.hint='Antifragilidad + Aprendizaje';ev.el.querySelector('.abbr').textContent='NK';ev.el.querySelector('.name').textContent='Núcleo';ev.el.querySelector('.hint').textContent='fusión parasitaria';if(other.mainAnchor) other.mainAnchor.anchor.eventId=ev.id; if(other.comboAnchor) other.comboAnchor.anchor.eventId=ev.id; if(!ev.mainAnchor && other.mainAnchor) {ev.mainAnchor=other.mainAnchor;} if(!ev.comboAnchor && other.comboAnchor) {ev.comboAnchor=other.comboAnchor;} other.merged=true;other.el.remove();state.events=state.events.filter(item=>item!==other);spawnFloater(ev.x,ev.y-10,'Fusión de colapso','bad');break;}}
    ev.el.querySelector('.progress i').style.width=`${clamp(ev.progress,0,100)}%`;
  });
  syncHud();
  if((state.health<=0||state.collapse>=100) && state.running){endChallenge('Colapso crítico. La presión superó la capacidad adaptativa.');}
}

function updateAmino(dt,t){
  state.amino.forEach((a,i)=>{
    if(a.cooldown>0) a.cooldown--;
    if(a.anchor){
      const ev = state.events.find(e=>e.id===a.anchor.eventId);
      if(!ev){ releaseAmino(a,true); return; }
      const p = angleToXY(ev.angle + a.anchor.offset + Math.sin(t*0.002+i)*0.06, 56);
      a.x += (p.x - a.x) * 0.18;
      a.y += (p.y - a.y) * 0.18;
      a.vx = 0; a.vy = 0;
      a.el.classList.toggle('correct', a.anchor.role==='main');
      a.el.classList.toggle('combo', a.anchor.role==='combo');
      a.el.style.transform=`translate(${a.x}px,${a.y}px)`;
      return;
    }
    const orbitWobble=Math.sin(t*0.0011+i)*9;
    const baseSpeed=0.00018 + i*0.000008;
    const home=angleToXY(a.homeAngle + t*baseSpeed + Math.sin(t*0.0003+i)*0.05, a.orbitRadius + orbitWobble);
    let fx=0, fy=0;
    fx += (home.x-a.x)*0.018; fy += (home.y-a.y)*0.018;
    const mouseD = Math.hypot(a.x-state.pointer.x,a.y-state.pointer.y);
    if(state.pointer.active && mouseD<130){ const sign = mouseD>55?1:-0.8; fx += ((state.pointer.x-a.x)/Math.max(mouseD,1))*0.42*sign; fy += ((state.pointer.y-a.y)/Math.max(mouseD,1))*0.42*sign; }
    const od = Math.hypot(a.x-organism.x,a.y-organism.y);
    if(od<290){ const sign = od>235?0.14:-0.28; fx += ((organism.x-a.x)/Math.max(od,1))*sign; fy += ((organism.y-a.y)/Math.max(od,1))*sign; }
    state.events.forEach(ev=>{ const d=Math.hypot(a.x-ev.x,a.y-ev.y); if(d<160){ const toward=(a.id===ev.main||a.id===ev.combo)?0.18:-0.08; fx += ((ev.x-a.x)/Math.max(d,1))*toward; fy += ((ev.y-a.y)/Math.max(d,1))*toward; }});
    state.amino.forEach((b)=>{ if(a===b||b.anchor)return; const d=Math.hypot(a.x-b.x,a.y-b.y); if(d<102){ const dx=a.x-b.x, dy=a.y-b.y; fx += (dx/Math.max(d,1))*(102-d)*0.022; fy += (dy/Math.max(d,1))*(102-d)*0.022; }});
    if(!a.dragging){ a.vx=(a.vx+fx)*0.93; a.vy=(a.vy+fy)*0.93; a.x += a.vx*dt*5.6; a.y += a.vy*dt*5.6; }
    a.el.style.transform=`translate(${a.x}px,${a.y}px)`; a.el.classList.remove('correct','combo','locked');
  });
}
function updateDomForEvents(){state.events.forEach(ev=>{ev.el.style.transform=`translate(${ev.x}px,${ev.y}px)`;ev.el.classList.toggle('latent',ev.state==='latent');ev.el.classList.toggle('hiddenLabel',ev.state==='latent');});}

function drawLinks(){const keep=linksSvg.querySelector('defs').outerHTML;linksSvg.innerHTML=keep;state.events.forEach(ev=>{if(ev.state!=='latent'){const core=document.createElementNS('http://www.w3.org/2000/svg','line');core.setAttribute('x1',ev.x);core.setAttribute('y1',ev.y);core.setAttribute('x2',organism.x);core.setAttribute('y2',organism.y);core.setAttribute('stroke',ev.state==='parasite'?'#ff6464':'rgba(255,100,100,.45)');core.setAttribute('stroke-width',ev.state==='parasite'?'2.4':'1.2');core.setAttribute('stroke-dasharray',ev.state==='parasite'?'0':'5 6');linksSvg.appendChild(core);} const linked=[]; if(ev.mainAnchor) linked.push(ev.mainAnchor); if(ev.comboAnchor) linked.push(ev.comboAnchor); getNearbyAmino(ev).forEach(a=>{ if(!linked.includes(a)) linked.push(a); }); const hasMain=!!ev.mainAnchor || linked.some(a=>a.id===ev.main); const hasCombo=!!ev.comboAnchor || linked.some(a=>a.id===ev.combo); linked.forEach(a=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',ev.x);line.setAttribute('y2',ev.y);let stroke='#7d8794',width=1.1,dash='6 6';if(a.id===ev.main&&hasCombo){stroke='url(#mixLine)';width=2.8;dash='0';a.el.classList.add('combo');} else if(a.id===ev.main){stroke='#7fd0ff';width=2.0;dash='0';a.el.classList.add('correct'); a.el.classList.add('locked');} else if(a.id===ev.combo&&hasMain){stroke='url(#mixLine)';width=2.4;dash='0';a.el.classList.add('combo'); a.el.classList.add('locked');}line.setAttribute('stroke',stroke);line.setAttribute('stroke-width',width);line.setAttribute('stroke-dasharray',dash);linksSvg.appendChild(line);});}); if(state.memoryMode){state.memories.forEach(m=>{const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',m.x);line.setAttribute('y1',m.y);line.setAttribute('x2',organism.x);line.setAttribute('y2',organism.y);line.setAttribute('stroke','rgba(255,159,54,.34)');line.setAttribute('stroke-width',m.combo?'1.8':'1.1');line.setAttribute('stroke-dasharray',m.combo?'0':'4 7');linksSvg.appendChild(line);});}}

function drawBackground(t){const w=bg.clientWidth,h=bg.clientHeight;ctx.clearRect(0,0,w,h);ctx.fillStyle='#07192d';ctx.fillRect(0,0,w,h);
 state.particles.forEach((p,i)=>{p.angle += p.speed;const x=organism.x+Math.cos(p.angle+Math.sin(t*0.00035+i)*0.15)*p.r;const y=organism.y+Math.sin(p.angle*p.drift+Math.cos(t*0.00022+i)*0.1)*(p.r*0.58);ctx.fillStyle=`rgba(143,214,255,${p.alpha})`;ctx.beginPath();ctx.arc(x,y,p.size,0,Math.PI*2);ctx.fill();});
 [88,104,122,142,160,184,206,260,320].forEach((r,idx)=>{ctx.strokeStyle=idx<6?'rgba(143,214,255,.12)':'rgba(143,214,255,.08)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(organism.x,organism.y,r+Math.sin(t*0.0009+idx)*1.4,0,Math.PI*2);ctx.stroke();});
 ctx.strokeStyle='rgba(143,214,255,.06)';ctx.beginPath();ctx.moveTo(organism.x-420,organism.y);ctx.lineTo(organism.x+420,organism.y);ctx.moveTo(organism.x,organism.y-320);ctx.lineTo(organism.x,organism.y+320);ctx.stroke();
 state.sprouts.forEach(s=>{const p=angleToXY(s.angle,s.r);ctx.fillStyle=`rgba(255,159,54,${s.alpha})`;ctx.beginPath();ctx.arc(p.x,p.y,s.size,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,159,54,.28)';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(organism.x+Math.cos(s.angle)*(organism.radius+22),organism.y+Math.sin(s.angle)*(organism.radius+22));ctx.stroke();});
 const count=state.barCount;
 for(let ringIndex=0; ringIndex<3; ringIndex++){
   const baseR = rings.spectrum + ringIndex*18;
   for(let i=0;i<count;i++){
      const a=(Math.PI*2*i)/count - Math.PI/2;
      const wav=0.56+0.44*Math.sin(t*0.003 + i*0.21 + ringIndex)*Math.cos(t*0.0018 + i*0.08);
      let len=6 + 9*wav + ringIndex*1.5; let color='rgba(220,245,255,.76)'; let width=1;
      state.events.forEach(ev=>{const diff=Math.abs(normalizeAngle(a-ev.angle)); if(diff<0.28){const influence=1-diff/0.28; const life=ev.state==='latent'?clamp((nowMs()-ev.born)/10000,0.1,1):1; len += (ev.state==='latent'?7:14)*influence*life; if(ev.state==='latent') color=`rgba(127,208,255,${0.20 + 0.45*influence*life})`; else if(ev.state==='parasite') color=`rgba(255,100,100,${0.55 + 0.25*influence})`; else color=`rgba(255,159,54,${0.44 + 0.32*influence})`; width=1 + influence*1.3; }});state.memories.forEach(m=>{const diff=Math.abs(normalizeAngle(a-m.angle)); if(diff<0.08){const influence=1-diff/0.08; len += 6*influence; color=`rgba(255,159,54,${0.22+0.42*influence})`;}});
      const x1=organism.x+Math.cos(a)*baseR, y1=organism.y+Math.sin(a)*baseR; const x2=organism.x+Math.cos(a)*(baseR+len), y2=organism.y+Math.sin(a)*(baseR+len);
      ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
   }
 }
 state.amino.forEach((a,i)=>{const md=Math.hypot(a.x-state.pointer.x,a.y-state.pointer.y);const aura = state.pointer.active && md<110 ? 1 - md/110 : 0; if(aura>0.02){ctx.strokeStyle=`rgba(127,208,255,${0.12 + aura*0.18})`;ctx.beginPath();ctx.arc(a.x,a.y,44 + aura*12 + Math.sin(t*0.008+i)*2,0,Math.PI*2);ctx.stroke();} for(let k=0;k<18;k++){const ang=(Math.PI*2*k)/18 + t*0.0014 + i; const r=34; const l=4 + (Math.sin(t*0.004 + k + i)+1)*2 + aura*4; ctx.strokeStyle=`rgba(127,208,255,${0.14 + aura*0.22})`; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(a.x+Math.cos(ang)*r,a.y+Math.sin(ang)*r); ctx.lineTo(a.x+Math.cos(ang)*(r+l),a.y+Math.sin(ang)*(r+l)); ctx.stroke(); }});
}

function mostFrequentType(){const entries=Object.entries(state.stats.typesResolved); if(!entries.length) return 'Ninguno'; entries.sort((a,b)=>b[1]-a[1]); return `${entries[0][0]} (${entries[0][1]})`;}
function endChallenge(message){state.running=false;state.ended=true;state.memoryMode=true;stage.classList.add('memoryMode');statusText.textContent=message;state.events.forEach(ev=>ev.el.style.opacity=.32);if(state.memories.length){selectMemory(state.memories[0].id);}else{memoryIntro.textContent='No quedaron memorias adaptativas registradas. La organización no alcanzó a transformar eventos en aprendizaje.';memoryDetails.innerHTML='';}}


function loop(t){const dt=Math.min((t-state.frameTime)/1000,0.032);state.frameTime=t;if(state.running)updateClock();if(!state.memoryMode){updateAmino(dt,t);updateEvents(dt,t);}else{state.amino.forEach(a=>{a.el.style.opacity=.28;});}updateDomForEvents();drawLinks();drawBackground(t);requestAnimationFrame(loop);}

startBtn.addEventListener('click',()=>{if(!state.running&&!state.ended){state.running=true;state.startedAt=nowMs();state.lastSpawn=nowMs()-state.spawnGap;statusText.textContent='Reto activo. Vigila el espectro; usa Anticipación sobre señales “?” antes del impacto.';}else if(state.ended){resetState();state.running=true;state.startedAt=nowMs();state.lastSpawn=nowMs()-state.spawnGap;statusText.textContent='Reto activo. Vigila el espectro; usa Anticipación sobre señales “?” antes del impacto.';}});
resetBtn.addEventListener('click',resetState);
clearMemorySelectionBtn.addEventListener('click',()=>{state.memoryPoints.forEach(p=>p.el.classList.remove('active'));memoryIntro.textContent='Selecciona un punto naranja para leer la memoria adaptativa registrada.';memoryDetails.innerHTML='';});
restartMemoryBtn.addEventListener('click',()=>{resetState();state.running=true;state.startedAt=nowMs();state.lastSpawn=nowMs()-state.spawnGap;statusText.textContent='Reto activo. Vigila el espectro; usa Anticipación sobre señales “?” antes del impacto.';});

resize();resetState();requestAnimationFrame(loop);
