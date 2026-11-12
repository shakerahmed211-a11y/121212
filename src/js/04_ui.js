/* ================= UI + NETWORK ================= */
const COLV=['var(--p1)','var(--p2)','var(--p3)','var(--p4)'], INKV=['var(--p1i)','var(--p2i)','var(--p3i)','var(--p4i)'];
let ROOM=null,NR=null,mode='home',H=null,S=null,SJ='',lastN=-1,lastPh='',choice=-1,sel=null,lostHost=0,resendAt=0,roomCode='';
let vb=[0,0,GEO.w,GEO.h],MAP=null,scale=1;

function h(t,a,...c){const e=document.createElement(t);if(a)for(const k in a){const v=a[k];if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),v);else if(v===true)e.setAttribute(k,'');else if(v!==false&&v!=null)e.setAttribute(k,v)}c.flat().forEach(x=>{if(x==null||x===false)return;e.append(x&&x.nodeType?x:document.createTextNode(x))});return e}
let toastT=0;
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200)}
function showScreens(...ids){['home','lobby','game','over','review'].forEach(s=>$('#'+s).hidden=!ids.includes(s));$('#btnHome').hidden=ids.includes('home')}
const myName=()=>cleanName($('#inName').value)||'لاعب';
function myId(){return mode==='solo'?'me':(NR&&(NR.peers().find(p=>p.sameTab)||{}).peer)}
function myIdx(){return S?S.pl.findIndex(p=>p.id===myId()&&!p.cpu):-1}
function hostPeer(){if(!NR)return null;const a=NR.peers().filter(p=>p.presence&&p.presence.role==='host').sort((x,y)=>(x.presence.t||0)-(y.presence.t||0));return a[0]?a[0].peer:null}
const tname=id=>GEO.t[id].n;
const pname=i=>S.pl[i]?S.pl[i].nm:'؟';
const isHost=()=>mode==='host'||mode==='solo';
function dot(i){return h('span',{class:'badge',style:`background:${COLV[S.pl[i].ci]};color:${INKV[S.pl[i].ci]}`,text:String(i+1)})}
function validFor(i){const s=new Set();Object.keys(S.ow).forEach(t=>{if(S.ow[t]===i)GEO.t[t].adj.forEach(a=>{if(S.ow[a]!==i)s.add(a)})});return [...s]}

/* ---------- send / receive ---------- */
function send(m){
  if(isHost()&&H){H.onMsg(myId(),m);return}
  if(NR)NR.emit('c2h',m).catch(()=>{});
}
function applyState(s){
  const j=JSON.stringify(s,(k,v)=>k==='rem'?undefined:v);
  const changed=j!==SJ;SJ=j;S=s;S._at=performance.now();
  if(S.n!==lastN){lastN=S.n;choice=-1;sel=null}
  if(S.ph!==lastPh){if(S.ph!=='claim')sel=null;lastPh=S.ph}
  if(changed)render();else tick();
}
function wire(){
  NR.on('c2h',m=>{if(mode==='host'&&H)H.onMsg(m.peer,m.data)});
  NR.on('h2c',m=>{if(m.sameTab||mode!=='client'||m.peer!==hostPeer())return;applyState(m.data)});
  NR.onPeers(ch=>{
    if(mode==='host'&&H){
      ch.left.forEach(p=>H.peerLeft(p.peer));
      if(H.st.ph==='lobby'){if(ch.joined.length||ch.left.length||ch.updated.length)H.syncRoster()}
      else if(ch.joined.length)H.broadcast();
    }
  });
}
const genCode=()=>{const a='abcdefghjkmnpqrstuvwxyz23456789';let s='';for(let i=0;i<5;i++)s+=a[R(0,a.length-1)];return s};

function newHost(code,emit,solo){
  window.__myName=myName();
  H=makeHost(code,emit,applyState,()=>NR?NR.peers():[],()=>myId());
  return H;
}
async function createRoom(){
  if(!ROOM||mode!=='home')return;
  store.set('qm_name',myName());
  const code=genCode();
  try{NR=await ROOM.join('qm-'+code)}catch(e){toast('مقدرتش أفتح الغرفة، جرّب تاني.');return}
  wire();mode='host';roomCode=code;
  try{await NR.presence({nm:myName(),role:'host',t:Date.now()})}catch(e){}
  newHost(code,s=>NR.emit('h2c',JSON.parse(s)).catch(()=>{}));
  H.syncRoster();
}
async function joinRoom(){
  if(!ROOM||mode!=='home')return;
  const code=$('#inCode').value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  if(code.length!==5){toast('الكود لازم يكون 5 حروف أو أرقام.');return}
  store.set('qm_name',myName());
  try{NR=await ROOM.join('qm-'+code)}catch(e){toast('مقدرتش أدخل الغرفة، جرّب تاني.');return}
  wire();mode='client';roomCode=code;S=null;SJ='';
  try{await NR.presence({nm:myName(),role:'p',t:Date.now()})}catch(e){}
  $('#btnJoin').disabled=true;toast('بندوّر على الغرفة...');
  const t0=Date.now();
  const iv=setInterval(()=>{
    if(S||mode!=='client'){clearInterval(iv);$('#btnJoin').disabled=false;return}
    if(hostPeer())send({k:'hi'});
    if(Date.now()-t0>8000){clearInterval(iv);$('#btnJoin').disabled=false;toast('الكود غلط أو الغرفة اتقفلت.');leaveAll()}
  },700);
}
function startSolo(){
  if(mode!=='home')return;
  store.set('qm_name',myName());
  mode='solo';roomCode='';
  newHost('solo',null,true);
  H.syncRoster();H.addCpu(2);
}
async function leaveAll(){
  if(H){H.stop();H=null}
  if(NR){try{await NR.leave()}catch(e){}NR=null}
  mode='home';S=null;SJ='';lastN=-1;lastPh='';choice=-1;sel=null;lostHost=0;
  showScreens('home');
}

/* ---------- map ---------- */
const NS='http://www.w3.org/2000/svg';
const sv=(n,a)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);return e};
function buildMap(){
  const svg=$('#map');svg.innerHTML='';
  svg.style.setProperty('--ar',GEO.w/GEO.h);
  const defs=sv('defs',{});
  const pat=sv('pattern',{id:'hz',width:7,height:7,patternUnits:'userSpaceOnUse',patternTransform:'rotate(40)'});
  pat.append(sv('line',{x1:0,y1:0,x2:0,y2:7,style:'stroke:var(--hatch);stroke-width:1'}));defs.append(pat);svg.append(defs);
  svg.append(sv('rect',{x:-3000,y:-3000,width:7000,height:7000,style:'fill:var(--sea)'}),sv('rect',{x:-3000,y:-3000,width:7000,height:7000,fill:'url(#hz)',opacity:.55}));
  const gP=sv('g',{}),gL=sv('g',{}),gM=sv('g',{});
  MAP={};
  GEO.ids.forEach(id=>{
    const t=GEO.t[id];
    const p=sv('path',{d:t.d,class:'tp','data-id':id,tabindex:'-1'});gP.append(p);
    const l=sv('text',{class:'lb','text-anchor':'middle'});l.textContent=t.n;gL.append(l);
    const m=sv('g',{class:'mk'});
    const bd=sv('circle',{r:9,style:'fill:var(--surface);stroke:var(--ink);stroke-width:1.5'});
    const nm=sv('text',{y:4,'text-anchor':'middle','font-size':11,'font-weight':600,style:'fill:var(--ink);font-family:var(--fd)'});
    const cs=sv('path',{d:'M-8 7V-3H-5V-6H-2V-3H2V-6H5V-3H8V7Z',style:'fill:var(--surface);stroke:var(--ink);stroke-width:1.4;stroke-linejoin:round',display:'none'});
    const pg=sv('g',{});
    for(let k=0;k<4;k++)pg.append(sv('rect',{x:-11+k*6,y:10,width:5,height:5,rx:1,style:'fill:none;stroke:var(--ink);stroke-width:1.2',display:'none'}));
    m.append(bd,cs,nm,pg);gM.append(m);
    MAP[id]={p,l,m,bd,nm,cs,pg};
  });
  svg.append(gP,gL,gM);
  setVB();
}
function setVB(){
  const svg=$('#map');if(!svg)return;
  const ar=GEO.w/GEO.h;
  vb[2]=Math.min(Math.max(vb[2],60),GEO.w*1.1);vb[3]=vb[2]/ar;
  vb[0]=Math.min(Math.max(vb[0],-GEO.w*.05),GEO.w*1.05-vb[2]);vb[1]=Math.min(Math.max(vb[1],-GEO.h*.05),GEO.h*1.05-vb[3]);
  svg.setAttribute('viewBox',vb.map(v=>+v.toFixed(2)).join(' '));
  updateScale();
}
function updateScale(){
  const svg=$('#map');if(!svg||!MAP)return;
  scale=(svg.clientWidth||340)/vb[2];
  GEO.ids.forEach(id=>{
    const t=GEO.t[id],M=MAP[id],[cx,cy]=t.c;
    const show=t.bb[2]*scale>=t.n.length*6.8+10&&t.bb[3]*scale>=24;
    M.l.style.display=show?'':'none';
    M.l.setAttribute('x',cx);M.l.setAttribute('y',cy-(M.owned&&show?4/scale:-3/scale));M.l.setAttribute('font-size',(11.5/scale).toFixed(2));
    M.l.style.strokeWidth=(3/scale)+'px';
    const off=show&&M.owned?17/scale:0;
    M.m.setAttribute('transform',`translate(${cx} ${cy+off}) scale(${(1/scale).toFixed(4)})`);
  });
}
function zoomBy(f,fx=.5,fy=.5){
  const cx=vb[0]+vb[2]*fx,cy=vb[1]+vb[3]*fy;
  vb[2]*=f;vb[3]*=f;vb[0]=cx-vb[2]*fx;vb[1]=cy-vb[2]/(GEO.w/GEO.h)*fy;setVB();
}
function setView(cx,cy,w){vb[2]=w;vb[3]=w/(GEO.w/GEO.h);vb[0]=cx-vb[2]/2;vb[1]=cy-vb[3]/2;setVB()}
function mapEvents(){
  const svg=$('#map'),ptrs=new Map();let drag=false,downId=null,pinch=0;
  svg.addEventListener('pointerdown',e=>{
    ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(ptrs.size===1){drag=false;const t=e.target.closest&&e.target.closest('.tp');downId=t?t.getAttribute('data-id'):null}
    if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);drag=true}
    try{svg.setPointerCapture(e.pointerId)}catch(_){}
  });
  svg.addEventListener('pointermove',e=>{
    const p=ptrs.get(e.pointerId);if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    if(ptrs.size===2){
      p.x=e.clientX;p.y=e.clientY;const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);
      if(pinch>0&&d>0){const r=svg.getBoundingClientRect();zoomBy(pinch/d,((a.x+b.x)/2-r.left)/r.width,((a.y+b.y)/2-r.top)/r.height)}
      pinch=d;return;
    }
    if(!drag&&Math.hypot(dx,dy)<6)return;
    drag=true;p.x=e.clientX;p.y=e.clientY;
    vb[0]-=dx/scale;vb[1]-=dy/scale;setVB();
  });
  const up=e=>{
    ptrs.delete(e.pointerId);
    if(ptrs.size===0&&!drag&&downId)onTile(downId);
    if(ptrs.size<2)pinch=0;
    if(ptrs.size===0)downId=null;
  };
  svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);drag=true});
  svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect();zoomBy(e.deltaY>0?1.15:.87,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height)},{passive:false});
  $('#zIn').onclick=()=>zoomBy(.7);$('#zOut').onclick=()=>zoomBy(1.4);
  $('#zAll').onclick=()=>{vb=[0,0,GEO.w,GEO.h];setVB()};
  $('#zDelta').onclick=()=>setView(350,72,190);
  new ResizeObserver(()=>updateScale()).observe($('#mapwrap'));
}
function describe(id){
  const o=S&&S.ow[id];let s=tname(id);
  if(o===undefined)return s+': فاضية.';
  s+=': تابعة لـ '+pname(o);
  if(S.pl[o].cs===id)s+=' (قلعته، ضربات '+(S.ht[id]||0)+' من 4)';
  return s+'.';
}
function onTile(id){
  $('#cap').textContent=S?describe(id):tname(id);
  if(canClaim()&&validFor(myIdx()).includes(id)){sel=id;renderPanel();updateMap()}
}
function updateMap(){
  if(!S||!MAP)return;
  const me=myIdx(),elig=canClaim(),V=elig?validFor(me):[];
  GEO.ids.forEach(id=>{
    const M=MAP[id],o=S.ow[id];
    M.owned=o!==undefined;
    M.p.classList.toggle('own',M.owned);
    M.p.style.fill=M.owned?COLV[S.pl[o].ci]:'';
    M.p.classList.toggle('tgt',V.includes(id)&&sel!==id);
    M.p.classList.toggle('sel',sel===id);
    M.l.classList.toggle('own',M.owned);
    M.l.style.fill=M.owned?INKV[S.pl[o].ci]:'';
    M.m.style.display=M.owned?'':'none';
    if(M.owned){
      const castle=S.pl[o].cs===id;
      M.cs.setAttribute('display',castle?'':'none');
      M.bd.setAttribute('display',castle?'none':'');
      M.nm.textContent=String(o+1);
      M.nm.setAttribute('y',castle?20:4);
      M.nm.style.fill='var(--ink)';
      M.pg.querySelectorAll('rect').forEach((r,k)=>{r.setAttribute('display',castle?'':'none');r.style.fill=k<(S.ht[id]||0)?'var(--bad)':'var(--surface)'});
      M.pg.setAttribute('transform',castle?'translate(0 5)':'');
    }
  });
  updateScale();
}

/* ---------- state helpers ---------- */
function canClaim(){
  if(!S||S.ph!=='claim'||!S.cl)return false;const i=myIdx();
  return i>=0&&S.cl.el.includes(i)&&!S.cl.dn.includes(i);
}
function tilesCount(i){return Object.values(S.ow).filter(v=>v===i).length}
function logText(e){
  const [k,a,t,x,y]=e;
  switch(k){
    case 'cap':return `${pname(a)} ضمّ ${tname(t)}`;
    case 'take':return `${pname(a)} أخد ${tname(t)} من ${pname(x)}`;
    case 'def':return `${pname(x)} صدّ هجوم ${pname(a)} على ${tname(t)}`;
    case 'hit':return `${pname(a)} ضرب قلعة ${pname(x)} في ${tname(t)} (${y} من 4)`;
    case 'fall':return `${pname(a)} هدّ قلعة ${pname(x)} واستولى على ${tname(t)}`;
    case 'skip':return `${pname(a)} فوّت دوره`;
    default:return `${pname(a)}: الهجوم على ${tname(t)} ما اتنفّذش`;
  }
}

/* ---------- rendering ---------- */
function render(){
  if(!S)return;
  if(S.ph==='lobby'){showScreens('lobby');renderLobby();return}
  showScreens(S.ph==='over'?'over':'', 'game');
  if(!MAP){buildMap()}
  renderScore();renderPanel();updateMap();
  if(S.ph==='over')renderOver();
  tick();
}
function renderLobby(){
  const host=isHost();
  $('#lbRoomBox').hidden=mode==='solo';
  $('#lbCode').textContent=roomCode.toUpperCase();
  $('#lbCount').textContent=S.pl.length+' / 4';
  const ul=$('#lbPlayers');ul.textContent='';
  const me=myIdx();
  for(let i=0;i<4;i++){
    const p=S.pl[i];
    if(!p){ul.append(h('li',{class:'pitem empty',text:'مكان فاضي'}));continue}
    ul.append(h('li',{class:'pitem'},dot(i),h('span',{style:'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis',text:p.nm}),
      p.cpu?h('span',{class:'chip',text:'كمبيوتر · '+LVL[p.cpu]}):(i===me?h('span',{class:'chip',text:'أنت'}):null),
      host&&p.cpu?h('button',{class:'btn ghost sm',onclick:()=>H.removeCpu(i),'aria-label':'شيل '+p.nm,text:'شيل'}):null));
  }
  const cb=$('#lbCpu');cb.textContent='';
  if(host)[1,2,3].forEach(l=>cb.append(h('button',{class:'btn ghost sm',disabled:S.pl.length>=4,onclick:()=>H.addCpu(l),text:'+ كمبيوتر '+LVL[l]})));
  document.querySelectorAll('#segMode button').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.v===S.mode);b.disabled=!host});
  document.querySelectorAll('#segN button').forEach(b=>{b.setAttribute('aria-pressed',+b.dataset.v===S.N);b.disabled=!host});
  $('#btnStart').hidden=!host;$('#btnStart').disabled=S.pl.length<2;
  $('#lbWait').textContent=host?(S.pl.length<2?'محتاج لاعب تاني أو كمبيوتر عشان تبدأ.':''):'في انتظار صاحب الغرفة يبدأ اللعب.';
}
function renderScore(){
  const box=$('#score');box.textContent='';const me=myIdx();
  S.pl.forEach((p,i)=>{
    const castle=p.cs&&!p.out;
    let tag='';
    if(p.out)tag='خرج';else if(p.gone)tag='غاب';else if(S.ph==='q')tag=S.ans[i]?'أجاب ✓':'بيفكر';
    else if(S.rv&&S.ph!=='lobby')tag=S.rv.ch[i]===S.rv.ci?'صح ✓':(S.rv.ch[i]<0?'ما جاوبش':'غلط ✗');
    box.append(h('div',{class:'sc'+(i===me?' me':'')+(p.out?' out':'')},
      h('div',{class:'nm'},dot(i),h('span',{class:'t',text:p.nm+(i===me?' (أنت)':'')})),
      h('div',{class:'st'},h('span',{class:'num',text:tilesCount(i)+' رقعة · '+p.ok+' صح'}),h('span',{text:p.cpu?'كمبيوتر '+LVL[p.cpu]:''})),
      h('div',{class:'st'},
        castle?h('span',{class:'pips','aria-label':'ضربات القلعة '+(S.ht[p.cs]||0)+' من 4'},[0,1,2,3].map(k=>h('i',{class:k<(S.ht[p.cs]||0)?'f':''})),h('span',{style:'margin-inline-start:6px',text:'قلعة'})):h('span',{text:p.out?'القلعة وقعت':''}),
        h('span',{text:tag}))));
  });
}
function optButtons(interactive){
  const q=S.q,rv=S.rv,me=myIdx();
  return q.o.map((txt,k)=>{
    const cls=['opt'];
    let mark=null;
    if(rv){
      if(k===rv.ci){cls.push('ok');mark='✓ الصح'}
      else if(me>=0&&rv.ch[me]===k){cls.push('no');mark='✗'}
    }else if(choice===k)cls.push('sel');
    const who=rv?S.pl.map((p,i)=>rv.ch[i]===k?i:-1).filter(i=>i>=0):[];
    return h('button',{class:cls.join(' '),disabled:!interactive,'aria-pressed':!rv&&choice===k?'true':null,onclick:()=>pickAnswer(k)},
      h('span',{class:'l',text:LET[k]}),
      h('span',{class:'ot',dir:q.ltr?'ltr':'auto',text:txt}),
      mark?h('span',{class:'mk2',text:mark}):null,
      who.length?h('span',{class:'row',style:'gap:3px;flex:none'},who.map(i=>dot(i))):null);
  });
}
function pickAnswer(k){
  if(!S||S.ph!=='q'||choice>=0)return;
  const me=myIdx();if(me<0||S.pl[me].out||S.pl[me].gone)return;
  choice=k;resendAt=performance.now()+1800;send({k:'a',n:S.n,c:k});renderPanel();
}
function claimNow(){
  if(!sel||!canClaim())return;
  send({k:'c',n:S.n,t:sel});resendAt=performance.now()+1800;
}
function tgtInfo(t){
  const o=S.ow[t];
  if(o===undefined)return 'فاضية';
  return S.pl[o].cs===t?`قلعة ${pname(o)} · ضربات ${S.ht[t]||0}/4`:'تابعة لـ '+pname(o);
}
function renderPanel(){
  const box=$('#panel');box.textContent='';
  if(!S||!S.q&&S.ph!=='over'){return}
  if(S.ph==='over'){box.append(h('div',{class:'muted',text:'اللعبة انتهت. شوف النتيجة فوق.'}));return}
  const q=S.q,me=myIdx(),mine=me>=0&&!S.pl[me].out&&!S.pl[me].gone;
  const timer=h('span',{class:'chip num',id:'tnum'});
  box.append(h('div',{class:'qhead'},
    h('span',{class:'chip num',text:`سؤال ${S.n} من ${S.N}`}),
    h('span',{class:'chip',text:q.c}),
    q.l?h('span',{class:'chip',text:LVL[q.l]}):null,timer));
  box.append(h('div',{class:'bar','aria-hidden':'true'},h('i',{id:'tbar',style:'width:100%'})));
  box.append(h('div',{class:'qtext',text:q.t}));
  if(S.ph==='q'){
    box.append(h('div',{class:'opts'},optButtons(mine&&choice<0)));
    const need=S.pl.filter(p=>!p.out&&!p.gone).length,got=S.ans.filter(Boolean).length;
    box.append(h('div',{class:'hint'},me<0?'أنت متفرج في الغرفة دي.':!mine?'مش بتشارك في الجولة دي.':choice>=0?`تم تثبيت إجابتك. جاوب ${got} من ${need}.`:'اختار إجابتك. كل ما جاوبت أسرع كل ما أخدت أولوية في اختيار الرقعة.'));
    return;
  }
  box.append(h('div',{class:'opts'},optButtons(false)));
  if(S.ph==='claim'){
    const elig=S.cl.el,done=S.cl.dn;
    if(canClaim()){
      const V=validFor(me);
      box.append(h('div',{class:'hint',text:'إجابتك صح. اختار رقعة تضمها أو تهاجمها، من الخريطة أو من القايمة دي.'}));
      box.append(h('div',{class:'tgts'},V.map(t=>h('button',{class:'tg','aria-pressed':sel===t?'true':'false',onclick:()=>{sel=t;$('#cap').textContent=describe(t);renderPanel();updateMap()}},tname(t),h('small',{text:tgtInfo(t)})))));
      box.append(h('button',{class:'btn',disabled:!sel,onclick:claimNow,text:sel?'ثبّت: '+tname(sel):'اختار رقعة الأول'}));
    }else if(me>=0&&elig.includes(me)){
      box.append(h('div',{class:'hint',text:'تم تثبيت اختيارك. بانتظار الباقي.'}));
    }else{
      box.append(h('div',{class:'hint',text:me>=0&&S.rv.ch[me]>=0&&S.rv.ch[me]!==S.rv.ci?'إجابتك مش صح، مفيش رقعة المرة دي.':'اللي جاوبوا صح بيختاروا رقعتهم دلوقتي.'}));
    }
    box.append(h('div',{class:'small muted',text:'بيختاروا: '+elig.map(i=>pname(i)+(done.includes(i)?' ✓':'')).join('، ')}));
    return;
  }
  // reveal
  const log=S.rv.log;
  box.append(h('ul',{class:'log'},log.length?log.map(e=>h('li',null,dot(e[1]),h('span',{text:logText(e)}))):h('li',{class:'muted',text:'محدش جاوب صح المرة دي.'})));
  if(S.rv.s)box.append(h('div',{class:'small muted',style:'margin-top:8px',text:'المرجع: '+S.rv.s}));
  box.append(h('div',{class:'small muted',style:'margin-top:8px',id:'nextIn'}));
}
function renderOver(){
  const r=S.pl.map((p,i)=>({i,t:tilesCount(i),ok:p.ok,out:p.out})).sort((a,b)=>(b.t-a.t)||(b.ok-a.ok));
  const alive=S.pl.filter(p=>!p.out).length;
  $('#ovTitle').textContent=S.win>=0?'الفايز: '+pname(S.win):'انتهت اللعبة';
  const box=$('#ovRank');box.textContent='';
  r.forEach((x,k)=>box.append(h('div',{class:'rk'+(k===0?' win':'')},h('div',{class:'pos num',text:String(k+1)}),dot(x.i),
    h('div',{style:'flex:1;min-width:0'},h('div',{style:'font-weight:600',text:pname(x.i)+(x.i===myIdx()?' (أنت)':'')}),h('div',{class:'small muted num',text:`${x.t} رقعة · ${x.ok} إجابة صح`+(x.out?' · قلعته وقعت':'')})))));
  $('#ovNote').textContent=alive<=1?'اللعبة خلصت لأن آخر قلعة فضلت واقفة.':`اللعبة خلصت بعد ${S.N} سؤال، والترتيب بعدد الرقع ثم عدد الإجابات الصح.`;
  $('#btnAgain').hidden=!isHost();
  if(!isHost())$('#ovNote').textContent+=' في انتظار صاحب الغرفة يبدأ لعبة جديدة.';
}
function tick(){
  if(!S)return;
  if(mode==='client'){
    if(!hostPeer()){if(++lostHost>14){toast('صاحب الغرفة خرج.');leaveAll();return}}else lostHost=0;
  }
  const el=(performance.now()-S._at)/1000,rem=Math.max(0,S.rem-el);
  const tn=$('#tnum'),tb=$('#tbar');
  if(tn)tn.textContent=Math.ceil(rem)+' ث';
  if(tb&&S.dur)tb.style.width=Math.min(100,rem/S.dur*100)+'%';
  const ni=$('#nextIn');if(ni)ni.textContent=S.n>=S.N?'':'السؤال التالي بعد '+Math.ceil(rem)+' ث';
  if(mode==='client'&&performance.now()>resendAt){
    const me=myIdx();
    if(S.ph==='q'&&choice>=0&&me>=0&&!S.ans[me]){send({k:'a',n:S.n,c:choice});resendAt=performance.now()+1800}
  }
}

/* ---------- review of lab questions ---------- */
const rvState={cat:'all',q:'',shown:25,flags:new Set(store.get('qm_flags',[]))};
const REVCATS=['soil','concrete','asphalt','aggregate'];
function renderReview(){
  const list=$('#rvList');list.textContent='';
  const q=rvState.q.trim();
  const idx=BANK.map((b,i)=>i).filter(i=>REVCATS.includes(BANK[i].c)&&(rvState.cat==='all'||BANK[i].c===rvState.cat)&&(!q||BANK[i].q.includes(q)||BANK[i].o.some(o=>o.includes(q))));
  $('#rvCount').textContent=idx.length+' سؤال';
  $('#rvFlags').textContent=rvState.flags.size?`معلّم: ${rvState.flags.size}`:'';
  idx.slice(0,rvState.shown).forEach(i=>{
    const b=BANK[i],f=rvState.flags.has(i);
    list.append(h('div',{class:'rq'+(f?' flag':'')},
      h('div',{class:'row small muted'},h('span',{class:'chip',text:CAT[b.c]}),h('span',{class:'chip',text:LVL[b.l]}),b.s?h('span',{class:'chip',dir:'ltr',text:b.s}):null),
      h('div',{style:'margin-top:6px;font-weight:500',text:b.q}),
      h('ol',null,b.o.map((o,k)=>h('li',{class:k===b.a?'c':''},LET[k]+'. '+o+(k===b.a?'  ✓':'')))),
      h('button',{class:'btn ghost sm','aria-pressed':f,onclick:()=>{f?rvState.flags.delete(i):rvState.flags.add(i);store.set('qm_flags',[...rvState.flags]);renderReview()},text:f?'شيل العلامة':'فيه مشكلة'})));
  });
  $('#rvMore').hidden=idx.length<=rvState.shown;
}
async function exportFlags(){
  if(!rvState.flags.size){toast('علّم سؤال واحد على الأقل الأول.');return}
  const esc=s=>'"'+String(s).replace(/"/g,'""')+'"';
  const rows=[['الفئة','السؤال','أ','ب','ج','د','الإجابة المسجّلة','المرجع']];
  [...rvState.flags].sort((a,b)=>a-b).forEach(i=>{const b=BANK[i];rows.push([CAT[b.c],b.q,...b.o,LET[b.a],b.s])});
  const csv='﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n');
  let dl=null;try{dl=await window.claude?.use?.('downloads')}catch(e){}
  if(!dl){
    try{
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),file=new File([blob],'ملاحظات-أسئلة-المعمل.csv',{type:'text/csv'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'ملاحظات أسئلة المعمل'});return}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;document.body.append(a);a.click();a.remove();toast('تم تجهيز الملف.');
    }catch(e){if(!e||e.name!=='AbortError')toast('مقدرتش أحفظ الملف.')}
    return;
  }
  try{await dl.save({filename:'ملاحظات-أسئلة-المعمل.csv',data:csv});toast('تم حفظ الملف.')}catch(e){if(!e||e.code!=='declined')toast('مقدرتش أحفظ الملف.')}
}

/* ---------- init ---------- */
function drawMini(){
  const s=$('#miniSvg');s.setAttribute('viewBox',`0 0 ${GEO.w} ${GEO.h}`);
  const col={alx:0,asw:1,nsi:2,asy:3};
  GEO.ids.forEach(id=>s.append(sv('path',{d:GEO.t[id].d,style:`fill:${id in col?COLV[col[id]]:'var(--land)'};stroke:var(--ink);stroke-width:1.2;vector-effect:non-scaling-stroke`})));
}
function netNote(){
  const n=$('#netNote');
  if(ROOM){n.hidden=true;$('#btnCreate').disabled=false;$('#btnJoin').disabled=false;$('#inCode').disabled=false;return}
  n.hidden=false;
  if(window.QM_STANDALONE){n.textContent='اللعب الأونلاين مش متفعّل لأن إعداد Firebase ناقص (راجع ملف README). اللعب ضد الكمبيوتر شغال.';$('#btnCreate').disabled=true;$('#btnJoin').disabled=true;$('#inCode').disabled=true;return}
  n.textContent='اللعب الجماعي بين الأجهزة مش متاح في العرض ده. افتح الصفحة من حسابك وشارك الرابط مع أصحابك بصلاحية «تفاعل» (Contributor) عشان يقدروا يدخلوا الغرفة. اللعب ضد الكمبيوتر شغال دلوقتي.';
  $('#btnCreate').disabled=true;$('#btnJoin').disabled=true;$('#inCode').disabled=true;
}
function init(){
  drawMini();
  $('#inName').value=store.get('qm_name','');
  $('#btnSolo').onclick=startSolo;$('#btnCreate').onclick=createRoom;$('#btnJoin').onclick=joinRoom;
  $('#inCode').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom()});
  $('#btnHome').onclick=leaveAll;$('#btnLeave').onclick=leaveAll;$('#btnOverHome').onclick=leaveAll;
  $('#btnAgain').onclick=()=>{if(H)H.again()};
  $('#btnStart').onclick=()=>{if(H)H.start()};
  $('#btnCopy').onclick=async()=>{try{await navigator.clipboard.writeText(roomCode.toUpperCase());toast('تم نسخ الكود.')}catch(e){toast('الكود: '+roomCode.toUpperCase())}};
  document.querySelectorAll('#segMode button').forEach(b=>b.onclick=()=>H&&H.setOpt('mode',b.dataset.v));
  document.querySelectorAll('#segN button').forEach(b=>b.onclick=()=>H&&H.setOpt('N',b.dataset.v));
  $('#btnReview').onclick=()=>{showScreens('review');renderReview()};
  const rc=$('#rvCat');rc.append(h('option',{value:'all',text:'كل الفئات'}),...REVCATS.map(c=>h('option',{value:c,text:CAT[c]})));
  rc.onchange=()=>{rvState.cat=rc.value;rvState.shown=25;renderReview()};
  $('#rvSearch').oninput=e=>{rvState.q=e.target.value;rvState.shown=25;renderReview()};
  $('#rvMore').onclick=()=>{rvState.shown+=25;renderReview()};
  $('#rvExport').onclick=exportFlags;
  mapEvents();
  setInterval(tick,250);
  (async()=>{
    try{ROOM=await (window.claude&&window.claude.use?window.claude.use('room'):null)}catch(e){ROOM=null}
    if(!ROOM&&window.QM_FB_URL&&typeof makeFbRoom==='function'&&!/YOUR-PROJECT/.test(window.QM_FB_URL))ROOM=makeFbRoom(window.QM_FB_URL);
    netNote();
  })();
  showScreens('home');
}
init();
