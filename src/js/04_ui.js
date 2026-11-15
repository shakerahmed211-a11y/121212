/* ================= UI + NETWORK ================= */
const COLV=['var(--p1)','var(--p2)','var(--p3)','var(--p4)'], INKV=['var(--p1i)','var(--p2i)','var(--p3i)','var(--p4i)'];
let pickedMode=store.get('qm_mode','mix'),ROOM=null,NR=null,mode='home',H=null,S=null,SJ='',lastN=-1,lastPh='',choice=-1,sel=null,sel2=null,lostHost=0,resendAt=0,roomCode='';
let vb=[0,0,GEO.w,GEO.h],MAP=null,scale=1,peek=false,fitKey='';
/* ---------- flags / emblems (shape + colour so they work without colour vision) ---------- */
const STAR=(()=>{let d='';for(let k=0;k<10;k++){const r=k%2?2.1:5,a=-Math.PI/2+k*Math.PI/5;d+=(k?'L':'M')+(Math.cos(a)*r).toFixed(2)+' '+(Math.sin(a)*r).toFixed(2)}return d+'Z'})();
const GLY=['M-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0Z','M-3.5 -3.5h7v7h-7Z','M0 -4.5L4.5 3.5H-4.5Z','M0 -5L4.5 0L0 5L-4.5 0Z',STAR,'M-1.3 -4.5h2.6v3.2h3.2v2.6h-3.2v3.2h-2.6v-3.2h-3.2v-2.6h3.2Z','M-4.5 -3.5h9v2.2h-9Zm0 4.8h9v2.2h-9Z','M-2.5 -4.3h5L5 0l-2.5 4.3h-5L-5 0Z'];
const EMB_NAMES=['دايرة','مربع','مثلث','معيّن','نجمة','صليب','خطوط','سداسي'],EMB_LV=[1,1,1,1,2,3,5,7];


function h(t,a,...c){const e=document.createElement(t);if(a)for(const k in a){const v=a[k];if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),v);else if(v===true)e.setAttribute(k,'');else if(v!==false&&v!=null)e.setAttribute(k,v)}c.flat().forEach(x=>{if(x==null||x===false)return;e.append(x&&x.nodeType?x:document.createTextNode(x))});return e}
/* ---------- sound + haptics ---------- */
const SND={on:store.get('qm_snd',true),ctx:null,
  wake(){if(!this.on)return;try{if(!this.ctx){const A=window.AudioContext||window.webkitAudioContext;if(A)this.ctx=new A()}if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()}catch(e){}},
  play(seq){if(!this.on||!this.ctx)return;try{const c=this.ctx,t0=c.currentTime;seq.forEach(([f,d,t,ty])=>{const o=c.createOscillator(),g=c.createGain();o.type=ty||'sine';o.frequency.value=f;g.gain.setValueAtTime(0,t0+t);g.gain.linearRampToValueAtTime(.09,t0+t+.012);g.gain.exponentialRampToValueAtTime(.0001,t0+t+d);o.connect(g).connect(c.destination);o.start(t0+t);o.stop(t0+t+d+.02)})}catch(e){}},
  vib(p){if(this.on&&navigator.vibrate)try{navigator.vibrate(p)}catch(e){}},
  click(){this.play([[620,.07,0,'triangle']]);this.vib(12)},
  good(){this.play([[660,.12,0],[880,.12,.1],[1175,.22,.2]]);this.vib(35)},
  bad(){this.play([[220,.18,0,'sawtooth'],[165,.28,.14,'sawtooth']]);this.vib([60,40,60])},
  win(){this.play([[523,.14,0],[659,.14,.14],[784,.14,.28],[1047,.4,.42]]);this.vib([40,30,40,30,90])},
  end(){this.play([[392,.2,0],[330,.3,.2]])},
  tick(){this.play([[1000,.04,0,'square']])}};
let lastTick=-1,lastRx=null;
addEventListener('pointerdown',()=>SND.wake(),{passive:true});
function confetti(){const box=h('div',{class:'confetti','aria-hidden':'true'});for(let i=0;i<70;i++)box.append(h('i',{style:`left:${R(0,100)}%;background:${COLV[R(0,3)]};animation-delay:${(Math.random()*.9).toFixed(2)}s;animation-duration:${(2.2+Math.random()*2).toFixed(2)}s`}));document.body.append(box);setTimeout(()=>box.remove(),5200)}
/* ---------- local profile: xp, levels, badges, stats (stored on this device only) ---------- */
const TITLES=['متدرّب معمل','فني مبتدئ','فني معمل','مشرف فحص','مهندس موقع','مهندس معمل','استشاري مواد','كبير المهندسين'];
const BADGES=[
  {id:'win1',n:'أول فوز',d:'اكسب أول لعبة'},
  {id:'fast',n:'برق',d:'جاوب صح في أقل من ثانيتين'},
  {id:'combo5',n:'كومبو 5',d:'5 إجابات صح ورا بعض'},
  {id:'flood6',n:'طوفان',d:'اغمر 6 محافظات في لعبة واحدة'},
  {id:'hunter',n:'صائد المنابع',d:'جفّف منبع منافس'},
  {id:'gold',n:'ذهبي',d:'جاوب صح على سؤال ذهبي'},
  {id:'perfect',n:'بلا أخطاء',d:'كل إجاباتك صح في لعبة'},
  {id:'marathon',n:'ماراثون',d:'اكسب لعبة 30 سؤال أو أكتر'},
  {id:'vet',n:'محارب قديم',d:'العب 10 ألعاب'}];
const lvlOf=xp=>Math.floor(Math.sqrt(xp/60))+1;
const loadProf=()=>Object.assign({xp:0,games:0,wins:0,corr:0,combo:0,fast:0,badges:{}},store.get('qm_prof',{}));
let GM={caps:0,fall:0,fast:0,gold:0},awarded=false;
function awardGame(){
  const me=myIdx();if(awarded||me<0||!S||!S.pl[me])return;awarded=true;
  const p=S.pl[me],P=loadProf(),won=S.win===me;
  const gain=20+totalOf(me)+(won?40:0);
  const l0=lvlOf(P.xp);
  P.xp+=gain;P.games++;if(won)P.wins++;P.corr+=p.ok;P.combo=Math.max(P.combo,p.mc||0);P.fast+=GM.fast;
  const got=[];const give=id=>{if(!P.badges[id]){P.badges[id]=Date.now();got.push(BADGES.find(b=>b.id===id))}};
  if(won)give('win1');if(GM.fast>0)give('fast');if((p.mc||0)>=5)give('combo5');if(GM.caps>=6)give('flood6');if(GM.fall>0)give('hunter');
  if(GM.gold>0)give('gold');if(S.N>=10&&p.ok===S.N)give('perfect');if(won&&S.N>=30)give('marathon');if(P.games>=10)give('vet');
  store.set('qm_prof',P);
  const l1=lvlOf(P.xp),box=$('#ovXp');box.hidden=false;box.textContent='';
  box.append(h('div',{class:'row',style:'align-items:center;justify-content:space-between'},
    h('b',{class:'num',text:'+'+gain+' خبرة'}),h('span',{class:'chip',text:'مستوى '+l1+' · '+TITLES[Math.min(l1-1,TITLES.length-1)]})));
  if(l1>l0)box.append(h('div',{class:'gold',text:'ترقية! بقيت '+TITLES[Math.min(l1-1,TITLES.length-1)]}));
  got.forEach(b=>box.append(h('div',{class:'gold',text:'شارة جديدة: '+b.n+' — '+b.d})));
}
function renderProfile(){
  const P=loadProf(),l=lvlOf(P.xp),lo=60*(l-1)*(l-1),hi=60*l*l,box=$('#pfCard');box.textContent='';
  box.append(h('h2',{text:TITLES[Math.min(l-1,TITLES.length-1)]}),
    h('div',{class:'row',style:'justify-content:space-between'},h('span',{class:'chip',text:'مستوى '+l}),h('span',{class:'small muted num',text:(P.xp-lo)+' / '+(hi-lo)+' خبرة للمستوى الجاي'})),
    h('div',{class:'xpbar'},h('i',{style:'width:'+Math.min(100,(P.xp-lo)/(hi-lo)*100)+'%'})),
    h('div',{class:'stats'},
      h('div',null,h('b',{class:'num',text:String(P.games)}),h('span',{class:'small muted',text:'ألعاب'})),
      h('div',null,h('b',{class:'num',text:String(P.wins)}),h('span',{class:'small muted',text:'فوز'})),
      h('div',null,h('b',{class:'num',text:String(P.corr)}),h('span',{class:'small muted',text:'إجابات صح'})),
      h('div',null,h('b',{class:'num',text:String(P.combo)}),h('span',{class:'small muted',text:'أطول كومبو'}))),
    h('h3',{text:'علمك'}),
    h('div',{class:'small muted',text:'العلم بيتزرع على كل محافظة تغمرها. فتح أشكال جديدة كل ما مستواك يزيد.'}),
    h('div',{class:'embs'},EMB_NAMES.map((n,k)=>{const ok=l>=EMB_LV[k],cur=store.get('qm_fl',-1)===k;
      const b=h('button',{disabled:!ok,'aria-pressed':cur?'true':'false',onclick:()=>{store.set('qm_fl',k);renderProfile()}});
      const sv0=document.createElementNS(NS,'svg');sv0.setAttribute('viewBox','0 0 18 18');sv0.setAttribute('width',26);sv0.setAttribute('height',26);const pp=document.createElementNS(NS,'path');pp.setAttribute('d',GLY[k]);pp.setAttribute('transform','translate(9 9)');pp.style.fill='var(--ink)';sv0.append(pp);
      b.append(sv0,h('span',{text:ok?n:'مستوى '+EMB_LV[k]}));return b})),
    h('h3',{text:'الشارات'}),
    h('div',{class:'badges'},BADGES.map(b=>h('div',{class:'bd'+(P.badges[b.id]?'':' lock')},h('b',{text:b.n}),h('small',{text:b.d})))));
}
function showReaction(rx){
  const L=$('#rxlayer');if(!L||!S||!S.pl[rx.i])return;
  const fx=h('div',{class:'fx',style:'left:'+R(8,78)+'%'},h('i',{style:'background:'+COLV[S.pl[rx.i].ci]}),h('span',{text:['👏','🔥','😂','😱'][rx.e]||''}));
  L.append(fx);setTimeout(()=>fx.remove(),2300);
}
function onPhase(prev,next){
  const me=myIdx();
  if(next==='q'&&S.n===1){GM={caps:0,fall:0,fast:0,gold:0};awarded=false;$('#ovXp').hidden=true}
  if(next==='rev'&&prev!=='rev'&&S.rv&&me>=0){
    const ch=S.rv.ch[me];
    if(ch===S.rv.ci){SND.good();if(S.rv.tm[me]>=0&&S.rv.tm[me]<=2)GM.fast++;if(S.gd)GM.gold++}else SND.bad();
    (S.rv.log||[]).forEach(e=>{if(e[1]===me){if(e[0]==='cap'||e[0]==='take'||e[0]==='fall')GM.caps++;if(e[0]==='fall')GM.fall++}});
  }
  if(next==='over'&&prev!=='over'){if(me>=0&&S.win===me){SND.win();confetti()}else SND.end();awardGame()}
}
let toastT=0;
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200)}
function showScreens(...ids){['home','pick','lobby','game','over','review','profile'].forEach(s=>$('#'+s).hidden=!ids.includes(s));$('#btnHome').hidden=ids.includes('home');$('#btnMenu').hidden=!(ids.includes('home')||ids.includes('pick'));closeMenu()}
function openMenu(){$('#scrim').hidden=false;$('#drawer').hidden=false;$('#btnMenu').setAttribute('aria-expanded','true');$('#btnCloseMenu').focus()}
function closeMenu(){if($('#drawer').hidden)return;$('#scrim').hidden=true;$('#drawer').hidden=true;$('#btnMenu').setAttribute('aria-expanded','false')}
const savedN=()=>+store.get('qm_n',15)||15;
function pickStep(b){$('#pickA').hidden=!!b;$('#pickB').hidden=!b;document.querySelectorAll('#modeCards .pc').forEach(c=>c.setAttribute('aria-pressed',c.dataset.v===pickedMode))}
function applyTheme(v){const r=document.documentElement;if(v==='light'||v==='dark')r.setAttribute('data-theme',v);else r.removeAttribute('data-theme');document.querySelectorAll('#segTheme button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v))}
const myName=()=>cleanName($('#inName').value)||'لاعب';
function myId(){return mode==='solo'?'me':(NR&&(NR.peers().find(p=>p.sameTab)||{}).peer)}
function myIdx(){return S?S.pl.findIndex(p=>p.id===myId()&&!p.cpu):-1}
function hostPeer(){if(!NR)return null;const a=NR.peers().filter(p=>p.presence&&p.presence.role==='host').sort((x,y)=>(x.presence.t||0)-(y.presence.t||0));return a[0]?a[0].peer:null}
const tname=id=>GEO.t[id].n;
const pname=i=>S.pl[i]?S.pl[i].nm:'؟';
const isHost=()=>mode==='host'||mode==='solo';
function glyphSvg(f,ci,sz){const e=document.createElementNS(NS,'svg');e.setAttribute('viewBox','0 0 18 18');e.setAttribute('width',sz||14);e.setAttribute('height',sz||14);e.setAttribute('aria-hidden','true');const p=document.createElementNS(NS,'path');p.setAttribute('d',GLY[(f|0)%8]);p.setAttribute('transform','translate(9 9)');p.style.fill=INKV[ci];e.append(p);return e}
function dot(i){const p=S.pl[i];return h('span',{class:'badge',style:`background:${COLV[p.ci]}`,title:p.nm},glyphSvg(p.fl,p.ci))}
const totalOf=i=>(S.pl[i].pts||0)+3*tilesCount(i);
const myFlag=()=>{const f=store.get('qm_fl',-1);return f>=0&&f<8&&lvlOf(loadProf().xp)>=EMB_LV[f]?f:undefined};
function validFor(i){const s=new Set();Object.keys(S.ow).forEach(t=>{if(S.ow[t]===i)GEO.t[t].adj.forEach(a=>{if(S.ow[a]!==i)s.add(a)})});return [...s]}

/* ---------- send / receive ---------- */
function send(m){
  if(isHost()&&H){H.onMsg(myId(),m);return}
  if(NR)NR.emit('c2h',m).catch(()=>{});
}
function applyState(s){
  const j=JSON.stringify(s,(k,v)=>k==='rem'?undefined:v);
  const changed=j!==SJ;SJ=j;S=s;S._at=performance.now();
  if(S.n!==lastN){lastN=S.n;choice=-1;sel=null;sel2=null}
  if(lastRx===null){lastRx=S.rx?S.rx.s:0}else if(S.rx&&S.rx.s!==lastRx){lastRx=S.rx.s;showReaction(S.rx)}
  if(S.ph!==lastPh){if(S.ph!=='claim'){sel=null;sel2=null}onPhase(lastPh,S.ph);lastPh=S.ph}
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
  window.__myName=myName();window.__myFlag=myFlag();
  H=makeHost(code,emit,applyState,()=>NR?NR.peers():[],()=>myId());
  return H;
}
async function createRoom(){
  if(!ROOM||mode!=='home')return;
  store.set('qm_name',myName());
  const code=genCode();
  try{NR=await ROOM.join('qm-'+code)}catch(e){toast('مقدرتش أفتح الغرفة، جرّب تاني.');return}
  wire();mode='host';roomCode=code;
  try{await NR.presence({nm:myName(),role:'host',t:Date.now(),fl:myFlag()})}catch(e){}
  newHost(code,s=>NR.emit('h2c',JSON.parse(s)).catch(()=>{}));
  H.syncRoster();H.setOpt('mode',pickedMode);H.setOpt('N',savedN());
}
async function joinRoom(){
  if(!ROOM||mode!=='home')return;
  const code=$('#inCode').value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  if(code.length!==5){toast('الكود لازم يكون 5 حروف أو أرقام.');return}
  store.set('qm_name',myName());
  try{NR=await ROOM.join('qm-'+code)}catch(e){toast('مقدرتش أدخل الغرفة، جرّب تاني.');return}
  wire();mode='client';roomCode=code;S=null;SJ='';
  try{await NR.presence({nm:myName(),role:'p',t:Date.now(),fl:myFlag()})}catch(e){}
  $('#btnJoin').disabled=true;closeMenu();toast('بندوّر على الغرفة...');
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
  H.syncRoster();H.addCpu(2);H.addCpu(2);H.setOpt('mode',pickedMode);H.setOpt('N',savedN());H.start();
}
async function leaveAll(){
  if(H){H.stop();H=null}
  if(NR){try{await NR.leave()}catch(e){}NR=null}
  mode='home';S=null;SJ='';lastN=-1;lastPh='';choice=-1;sel=null;sel2=null;lastRx=null;lostHost=0;
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
    const fg=sv('g',{class:'fg'}),pg=sv('g',{});
    for(let k=0;k<4;k++)pg.append(sv('rect',{x:-11+k*6,y:10,width:5,height:5,rx:1,style:'fill:none;stroke:var(--ink);stroke-width:1.2',display:'none'}));
    m.append(fg,pg);gM.append(m);
    MAP[id]={p,l,m,fg,pg};
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
    const off=show&&M.owned?22/scale:8/scale;
    M.m.setAttribute('transform',`translate(${cx} ${cy+off}) scale(${(1/scale).toFixed(4)})`);
  });
}
function zoomBy(f,fx=.5,fy=.5){
  const cx=vb[0]+vb[2]*fx,cy=vb[1]+vb[3]*fy;
  vb[2]*=f;vb[3]*=f;vb[0]=cx-vb[2]*fx;vb[1]=cy-vb[2]/(GEO.w/GEO.h)*fy;setVB();
}
function fitTo(ids){
  if(!ids.length){vb=[0,0,GEO.w,GEO.h];setVB();return}
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  ids.forEach(id=>{const b=GEO.t[id].bb;x0=Math.min(x0,b[0]);y0=Math.min(y0,b[1]);x1=Math.max(x1,b[0]+b[2]);y1=Math.max(y1,b[1]+b[3])});
  const ar=GEO.w/GEO.h;
  setView((x0+x1)/2,(y0+y1)/2,Math.min(Math.max((x1-x0)*1.25,(y1-y0)*1.25*ar,120),GEO.w));
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
  if(S.pl[o].cs===id)s+=' (منبعه، ضربات '+(S.ht[id]||0)+' من 4)';
  return s+'.';
}
function onTile(id){
  $('#cap').textContent=S?describe(id):tname(id);
  if(S&&S.ph==='sp'){trySource(id);return}
  if(canClaim()&&validFor(myIdx()).includes(id)){pickTile(id);refresh()}
}
function refresh(){renderPanel();renderBar();updateMap()}
function spProblem(me,t){
  const o=S.ow[t];
  if(o!==undefined&&o!==me)return 'المحافظة دي اتاخدت، اختار غيرها.';
  if(GEO.t[t].adj.some(a=>S.ow[a]!==undefined&&S.ow[a]!==me))return 'قريبة قوي من منبع لاعب تاني، اختار محافظة أبعد.';
  return '';
}
function trySource(id){
  const me=myIdx();if(me<0||S.lk.includes(me))return;
  const pr=spProblem(me,id);if(pr){toast(pr);return}
  SND.click();send({k:'s',t:id});
}
function pickTile(id){
  if(id===sel){sel=sel2;sel2=null}
  else if(id===sel2)sel2=null;
  else if(S&&S.gd&&sel)sel2=id;
  else{sel=id;sel2=null}
}
function updateMap(){
  if(!S||!MAP)return;
  const me=myIdx(),elig=canClaim(),V=elig?validFor(me):[];
  GEO.ids.forEach(id=>{
    const M=MAP[id],o=S.ow[id];
    M.owned=o!==undefined;
    M.p.classList.toggle('own',M.owned);
    if(M.po!==o&&M.po!==undefined&&M.owned){M.p.classList.remove('fl');void M.p.getBoundingClientRect();M.p.classList.add('fl')}
    const plant=M.owned&&M.po!==o;
    M.po=o;
    M.p.style.fill=M.owned?COLV[S.pl[o].ci]:'';
    M.p.classList.toggle('tgt',V.includes(id)&&sel!==id&&sel2!==id);
    M.p.classList.toggle('bt',V.includes(id)&&o!==undefined);
    M.p.classList.toggle('sel',sel===id||sel2===id);
    M.l.classList.toggle('own',M.owned);
    M.l.style.fill=M.owned?INKV[S.pl[o].ci]:'';
    M.m.style.display=M.owned?'':'none';
    if(M.owned){
      const pl=S.pl[o],castle=pl.cs===id,key=o+'|'+((pl.fl|0)%8)+'|'+(castle?1:0);
      if(M.fk!==key){
        M.fk=key;M.fg.textContent='';M.fg.setAttribute('transform','scale('+(castle?1.35:1)+')');
        M.fg.append(sv('line',{x1:0,y1:2,x2:0,y2:-22,style:'stroke:var(--ink);stroke-width:2;stroke-linecap:round'}),
          sv('path',{d:'M0 -22H17L13.5 -15.5L17 -9H0Z',style:`fill:${COLV[pl.ci]};stroke:var(--ink);stroke-width:1.2;stroke-linejoin:round`}),
          sv('path',{d:GLY[(pl.fl|0)%8],transform:'translate(7.5 -15.5)',style:'fill:'+INKV[pl.ci]}));
      }
      if(plant){M.fg.classList.remove('plant');void M.fg.getBoundingClientRect();M.fg.classList.add('plant')}
      M.pg.querySelectorAll('rect').forEach((r,k)=>{r.setAttribute('display',castle?'':'none');r.style.fill=k<(S.ht[id]||0)?'var(--bad)':'var(--surface)'});
      M.pg.setAttribute('transform',castle?'translate(0 -2)':'');
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
    case 'cap':return `${pname(a)} زرع علمه في ${tname(t)}`;
    case 'take':return `⚔ ${pname(a)} هاجم ${tname(t)} ضد ${pname(x)} وكسب المعركة`;
    case 'def':return `⚔ ${pname(a)} هاجم ${tname(t)} ضد ${pname(x)} — ${pname(x)} صدّه (+3)`+(y?` و${pname(a)} خسر ${y} نقاط`:'');
    case 'hit':return `⚔ ${pname(a)} أصاب منبع ${pname(x)} في ${tname(t)} (${y} من 4)`;
    case 'fall':return `⚔ ${pname(a)} جفّف منبع ${pname(x)} وزرع علمه في ${tname(t)}`;
    case 'skip':return `${pname(a)} فوّت دوره`;
    case 'aid':return `${pname(a)} خد تلميح زيادة عشان منبعه قرب يجف`;
    default:return `${pname(a)}: غمر ${tname(t)} ما اتنفّذش`;
  }
}

/* ---------- rendering ---------- */
function render(){
  if(!S)return;
  if(S.ph==='lobby'){showScreens('lobby');renderLobby();return}
  showScreens(S.ph==='over'?'over':'', 'game');
  if(!MAP){buildMap()}
  const view={sp:'sp',q:'q',claim:'claim',rev:'res',over:'over'}[S.ph]||'q';
  const g=$('#game');
  if(g.dataset.view!==view){peek=false;g.classList.remove('peek')}
  g.dataset.view=view;
  renderScore();renderPanel();renderBar();updateMap();
  const fk=S.ph+(S.ph==='sp'?'':S.n);
  if(fitKey!==fk){
    fitKey=fk;
    if(S.ph==='claim'&&canClaim())fitTo(validFor(myIdx()));
    else if(S.ph==='sp'||S.ph==='claim'||S.ph==='rev'){vb=[0,0,GEO.w,GEO.h];setVB()}
  }
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
    if(p.out)tag='خرج';else if(p.gone)tag='غاب';else if(S.ph==='sp')tag=(S.lk||[]).includes(i)?'ثبّت ✓':'بيختار';else if(S.ph==='q')tag=S.ans[i]?'أجاب ✓':'بيفكر';
    else if(S.rv&&S.ph!=='lobby')tag=S.rv.ch[i]===S.rv.ci?'صح ✓'+((S.rv.pt&&S.rv.pt[i])?' +'+S.rv.pt[i]:''):(S.rv.ch[i]<0?'ما جاوبش':'غلط ✗');
    box.append(h('div',{class:'sc'+(i===me?' me':'')+(p.out?' out':'')},
      h('div',{class:'nm'},dot(i),h('span',{class:'t',text:p.nm+(i===me?' (أنت)':'')})),
      h('div',{class:'st'},h('span',{class:'num',text:totalOf(i)+' نقطة · '+tilesCount(i)+' محافظة'})),
      h('div',{class:'prog','aria-hidden':'true'},h('i',{style:`width:${tilesCount(i)/GEO.ids.length*100}%;background:${COLV[p.ci]}`})),
      h('div',{class:'st'},
        castle?h('span',{class:'pips','aria-label':'ضربات المنبع '+(S.ht[p.cs]||0)+' من 4'},[0,1,2,3].map(k=>h('i',{class:k<(S.ht[p.cs]||0)?'f':''})),h('span',{style:'margin-inline-start:6px',text:'منبع'})):h('span',{text:p.out?'المنبع جفّ':''}),
        h('span',{class:(p.cb||0)>=3?'flame':'',text:((p.cb||0)>=3?'🔥'+p.cb+' ':'')+tag}))));
  });
}
function ringEl(){const t=h('span',{class:'ring',id:'ring'});t.innerHTML='<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" class="rb"/><circle cx="22" cy="22" r="19" class="rf" id="tring" transform="rotate(-90 22 22)"/></svg><b id="tnum" class="num"></b>';return t}
function renderBar(){
  const b=$('#mbar');b.textContent='';if(!S){b.hidden=true;return}
  const me=myIdx();let on=false;
  if(S.ph==='sp'){
    on=true;
    const locked=me>=0&&S.lk.includes(me),mine=me>=0?S.pl[me].cs:'';
    b.append(ringEl(),h('div',{class:'bt'},h('b',{text:me<0?'اللاعبين بيختاروا منابعهم':locked?'تم التثبيت ✓':'اختار من الخريطة المحافظة اللي هتبدأ منها 🚩'}),
      h('span',{class:'small muted',text:me<0?'':locked?'بانتظار الباقي':mine?'اخترت '+tname(mine)+'. تقدر تغيّر أو تثبّت.':'محافظة فاضية وبعيدة عن منبع أي لاعب.'})),
      me>=0&&!locked?h('button',{class:'btn sm',disabled:!mine,onclick:()=>{SND.click();send({k:'l'})},text:mine?'ثبّت':'اختار'}):null);
  }else if(S.ph==='claim'){
    on=true;const can=canClaim();
    if(can){
      const V=validFor(me);let sub='المحافظات المنبّضة هي اللي تقدر تغمرها. الحمرا معناها معركة.';
      if(sel){const o=S.ow[sel];sub=tname(sel)+': '+(o===undefined?'فاضية':'⚔ معركة ضد '+pname(o)+(S.pl[o].cs===sel?' (منبعه)':'')+' — لو خسرت بتخسر 4 نقاط')}
      b.append(ringEl(),h('div',{class:'bt'},h('b',{text:S.gd?'⭐ سؤال ذهبي: اختار محافظتين (أو واحدة)':'اختار محافظة تغمرها 🚩'}),h('span',{class:'small muted',text:sub})),
        h('button',{class:'btn sm',disabled:!sel,onclick:claimNow,text:sel?'ثبّت':'اختار'}));
      b.append(h('div',{class:'tgts sr'},V.map(t=>h('button',{class:'tg','aria-pressed':(sel===t||sel2===t)?'true':'false',onclick:()=>{pickTile(t);$('#cap').textContent=describe(t);refresh()}},tname(t)+' '+tgtInfo(t)))));
    }else{
      const elig=S.cl.el;
      b.append(ringEl(),h('div',{class:'bt'},h('b',{text:me>=0&&elig.includes(me)?'تم تثبيت اختيارك ✓':(me>=0&&S.rv.ch[me]>=0&&S.rv.ch[me]!==S.rv.ci?'إجابتك مش صح، مفيش غمر المرة دي':'اللي جاوبوا صح بيختاروا دلوقتي')}),
        h('span',{class:'small muted',text:'بيختاروا: '+elig.map(i=>pname(i)+(S.cl.dn.includes(i)?' ✓':'')).join('، ')})));
    }
  }else if(S.ph==='q'&&peek){
    on=true;b.append(h('div',{class:'bt'},h('b',{text:'الخريطة'})),h('button',{class:'btn sm',onclick:()=>{peek=false;$('#game').classList.remove('peek');renderBar()},text:'↩ السؤال'}));
  }
  b.hidden=!on;
}
function optButtons(interactive){
  const q=S.q,rv=S.rv,me=myIdx();
  const hid=new Set(rv?[]:[...(S.hd||[]),...((S.hf&&me>=0&&S.hf[me])||[])]);
  return q.o.map((txt,k)=>{
    const cls=['opt'];if(hid.has(k))cls.push('dim');
    let mark=null;
    if(rv){
      if(k===rv.ci){cls.push('ok');mark='✓ الصح'}
      else if(me>=0&&rv.ch[me]===k){cls.push('no');mark='✗'}
    }else if(choice===k)cls.push('sel');
    const who=rv?S.pl.map((p,i)=>rv.ch[i]===k?i:-1).filter(i=>i>=0):[];
    return h('button',{class:cls.join(' '),disabled:!interactive||hid.has(k),'aria-pressed':!rv&&choice===k?'true':null,onclick:()=>pickAnswer(k)},
      h('span',{class:'l',text:LET[k]}),
      h('span',{class:'ot',dir:q.ltr?'ltr':'auto',text:txt}),
      mark?h('span',{class:'mk2',text:mark}):null,
      who.length?h('span',{class:'row',style:'gap:3px;flex:none'},who.map(i=>dot(i))):null);
  });
}
function pickAnswer(k){
  if(!S||S.ph!=='q'||choice>=0)return;
  const me=myIdx();if(me<0||S.pl[me].out||S.pl[me].gone)return;
  choice=k;SND.click();resendAt=performance.now()+1800;send({k:'a',n:S.n,c:k});renderPanel();
}
function claimNow(){
  if(!sel||!canClaim())return;
  send({k:'c',n:S.n,t:(S.gd&&sel2)?[sel,sel2]:sel});resendAt=performance.now()+1800;
}
function tgtInfo(t){
  const o=S.ow[t];
  if(o===undefined)return 'فاضية';
  return S.pl[o].cs===t?`منبع ${pname(o)} · ضربات ${S.ht[t]||0}/4`:'تابعة لـ '+pname(o);
}
function renderPanel(){
  const box=$('#panel');box.textContent='';
  if(!S||!S.q&&S.ph!=='over'){return}
  if(S.ph==='over'){box.append(h('div',{class:'muted',text:'اللعبة انتهت. شوف النتيجة فوق.'}));return}
  const q=S.q,me=myIdx(),mine=me>=0&&!S.pl[me].out&&!S.pl[me].gone;
  const timer=h('span',{class:'ring',id:'ring'});timer.innerHTML='<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" class="rb"/><circle cx="22" cy="22" r="19" class="rf" id="tring" transform="rotate(-90 22 22)"/></svg><b id="tnum" class="num"></b>';
  box.append(h('div',{class:'qhead'},
    h('span',{class:'chip num',text:`سؤال ${S.n} من ${S.N}`}),
    h('span',{class:'chip',text:q.c}),
    S.gd?h('span',{class:'chip gold',text:'⭐ سؤال ذهبي ×2'}):null,
    q.l?h('span',{class:'chip',text:LVL[q.l]}):null,S.ph==='q'?timer:null));
  box.append(h('div',{class:'qtext',text:q.t}));
  if(S.ph==='q'){
    box.append(h('div',{class:'opts'},optButtons(mine&&choice<0)));
    if(mine&&choice<0){
      const left=S.pl[me].h||0,vis=[0,1,2,3].filter(k=>!(S.hd||[]).includes(k)).length,used=!!(S.hf&&S.hf[me]);
      box.append(h('div',{class:'row',style:'margin-top:10px;align-items:center'},
        h('button',{class:'btn ghost sm',disabled:left<=0||used||vis<=2,onclick:()=>{SND.click();send({k:'f',n:S.n})},text:`حذف إجابتين (${left})`}),
        h('span',{class:'small muted',text:'بيضيف 3 ثواني على وقتك'})));
    }
    box.append(h('div',{class:'row',style:'margin-top:8px'},h('button',{class:'btn ghost sm peekbtn',onclick:()=>{peek=true;$('#game').classList.add('peek');renderBar()},text:'🗺 الخريطة'})));
    const need=S.pl.filter(p=>!p.out&&!p.gone).length,got=S.ans.filter(Boolean).length;
    box.append(h('div',{class:'hint'},me<0?'أنت متفرج في الغرفة دي.':!mine?'مش بتشارك في الجولة دي.':choice>=0?`تم تثبيت إجابتك. جاوب ${got} من ${need}.`:(S.ls?'حد جاوب صح! باقي ثواني قليلة.':'اختار إجابتك. الأسرع بياخد نقاط أكتر وأولوية في اختيار المحافظة.')));
    return;
  }
  box.append(h('div',{class:'opts'},optButtons(false)));
  if(S.ph==='claim'){
    const elig=S.cl.el,done=S.cl.dn;
    box.append(h('div',{class:'hint',text:canClaim()?'اختار المحافظة من الخريطة وبعدين اضغط ثبّت.':(me>=0&&elig.includes(me)?'تم تثبيت اختيارك. بانتظار الباقي.':(me>=0&&S.rv.ch[me]>=0&&S.rv.ch[me]!==S.rv.ci?'إجابتك مش صح، مفيش غمر المرة دي.':'اللي جاوبوا صح بيختاروا محافظتهم دلوقتي.'))}));
    box.append(h('div',{class:'small muted',text:'بيختاروا: '+elig.map(i=>pname(i)+(done.includes(i)?' ✓':'')).join('، ')}));
    return;
  }
  // reveal
  const log=S.rv.log;
  box.append(h('ul',{class:'log'},log.length?log.map(e=>h('li',null,dot(e[1]),h('span',{text:logText(e)}))):h('li',{class:'muted',text:'محدش جاوب صح المرة دي.'})));
  if(S.rv.s)box.append(h('div',{class:'small muted',style:'margin-top:8px',text:'المرجع: '+S.rv.s}));
  const pts=S.pl.map((p,i)=>S.rv.pt&&S.rv.pt[i]>0?pname(i)+' +'+S.rv.pt[i]+((p.cb||0)>=3?' 🔥':''):'').filter(Boolean);
  if(pts.length)box.append(h('div',{class:'small',style:'margin-top:8px',text:'نقاط السرعة: '+pts.join('، ')}));
  const me2=myIdx();
  if(me2>=0&&!S.pl[me2].gone&&S.n<S.N){
    const ready=(S.nx||[]).includes(me2);
    box.append(h('div',{class:'row',style:'margin-top:10px;align-items:center'},
      h('button',{class:'btn sm',disabled:ready,onclick:()=>{SND.click();send({k:'x',n:S.n})},text:ready?'بانتظار الباقي':'التالي'}),
      h('span',{class:'small muted',id:'nextIn'})));
  }else box.append(h('div',{class:'small muted',style:'margin-top:8px',id:'nextIn'}));
}
function renderOver(){
  const r=S.pl.map((p,i)=>({i,t:tilesCount(i),sc:totalOf(i),ok:p.ok,out:p.out})).sort((a,b)=>(a.out-b.out)||(b.sc-a.sc)||(b.t-a.t)||(b.ok-a.ok));
  const alive=S.pl.filter(p=>!p.out).length;
  $('#ovTitle').textContent=S.win>=0?'الفايز: '+pname(S.win):'انتهت اللعبة';
  const box=$('#ovRank');box.textContent='';
  r.forEach((x,k)=>box.append(h('div',{class:'rk'+(k===0?' win':'')},h('div',{class:'pos num',text:String(k+1)}),dot(x.i),
    h('div',{style:'flex:1;min-width:0'},h('div',{style:'font-weight:600',text:pname(x.i)+(x.i===myIdx()?' (أنت)':'')}),h('div',{class:'small muted num',text:`${x.sc} نقطة (${S.pl[x.i].pts||0} + ${x.t}×3 محافظات) · ${x.ok} إجابة صح`+(x.out?' · منبعه جفّ':'')})))));
  $('#ovNote').textContent=alive<=1?'اللعبة خلصت لأن آخر منبع فضل شغال.':`اللعبة خلصت بعد ${S.N} سؤال، والفايز بأعلى مجموع: النقاط + 3 لكل محافظة.`;
  $('#btnAgain').hidden=!isHost();
  if(!isHost())$('#ovNote').textContent+=' في انتظار صاحب الغرفة يبدأ ريماتش.';
}
function tick(){
  if(!S)return;
  if(mode==='client'){
    if(!hostPeer()){if(++lostHost>14){toast('صاحب الغرفة خرج.');leaveAll();return}}else lostHost=0;
  }
  const el=(performance.now()-S._at)/1000,rem=Math.max(0,S.rem-el);
  const tn=$('#tnum'),tb=$('#tbar');
  if(tn)tn.textContent=Math.ceil(rem);
  const tr=$('#tring');if(tr&&S.dur){const C=2*Math.PI*19;tr.style.strokeDasharray=C;tr.style.strokeDashoffset=C*(1-Math.min(1,rem/S.dur));$('#ring').classList.toggle('low',rem<=5)}
  if((S.ph==='q'||S.ph==='claim')&&rem>0&&rem<=5){const c=Math.ceil(rem);if(c!==lastTick){lastTick=c;SND.tick()}}else lastTick=-1;
  const ni=$('#nextIn');if(ni)ni.textContent=S.n>=S.N?'':'التالي بعد '+Math.ceil(rem)+' ث';
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
  const P=GEO.ids.map(id=>{const p=sv('path',{d:GEO.t[id].d,class:'mp',style:'fill:var(--land);stroke:var(--ink);stroke-opacity:.5;stroke-width:1;vector-effect:non-scaling-stroke'});s.append(p);return p});
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){[0,1,2,3].forEach(k=>P[R(0,P.length-1)].style.fill=COLV[k]);return}
  let k=0;
  setInterval(()=>{if($('#home').hidden)return;P[R(0,P.length-1)].style.fill=COLV[R(0,3)];if(++k>46){P.forEach(x=>x.style.fill='var(--land)');k=0}},420);
}
function netNote(){
  const n=$('#netNote');
  const j=$('#joinNote');
  if(ROOM){n.hidden=true;j.hidden=true;$('#btnCreate').disabled=false;$('#btnJoin').disabled=false;$('#inCode').disabled=false;return}
  n.hidden=false;j.hidden=false;
  const msg=window.QM_STANDALONE?'اللعب الأونلاين مش متفعّل لأن إعداد Firebase ناقص (راجع ملف README). اللعب ضد الكمبيوتر شغال.':'اللعب الجماعي بين الأجهزة مش متاح في العرض ده. افتح الصفحة من حسابك وشارك الرابط مع أصحابك بصلاحية «تفاعل» (Contributor) عشان يقدروا يدخلوا الغرفة. اللعب ضد الكمبيوتر شغال دلوقتي.';
  n.textContent=msg;j.textContent=msg;
  $('#btnCreate').disabled=true;$('#btnJoin').disabled=true;$('#inCode').disabled=true;
}
function init(){
  drawMini();
  $('#inName').value=store.get('qm_name','');
  $('#btnSolo').onclick=startSolo;$('#btnCreate').onclick=createRoom;$('#btnJoin').onclick=joinRoom;
  $('#btnPlay').onclick=()=>{store.set('qm_name',myName());showScreens('pick');pickStep(false)};
  $('#inName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#btnPlay').click()});
  document.querySelectorAll('#modeCards .pc').forEach(c=>c.onclick=()=>{pickedMode=c.dataset.v;store.set('qm_mode',pickedMode);pickStep(true)});
  $('#pickBack').onclick=()=>pickStep(false);
  $('#btnMenu').onclick=openMenu;$('#btnCloseMenu').onclick=closeMenu;$('#scrim').onclick=closeMenu;
  addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  document.querySelectorAll('#segN0 button').forEach(b=>{b.setAttribute('aria-pressed',+b.dataset.v===savedN());b.onclick=()=>{store.set('qm_n',+b.dataset.v);document.querySelectorAll('#segN0 button').forEach(x=>x.setAttribute('aria-pressed',x===b))}});
  document.querySelectorAll('#segTheme button').forEach(b=>b.onclick=()=>{store.set('qm_theme',b.dataset.v);applyTheme(b.dataset.v)});
  applyTheme(store.get('qm_theme','dark'));
  document.querySelectorAll('#segSnd button').forEach(b=>{b.setAttribute('aria-pressed',(b.dataset.v==='on')===SND.on);b.onclick=()=>{SND.on=b.dataset.v==='on';store.set('qm_snd',SND.on);document.querySelectorAll('#segSnd button').forEach(x=>x.setAttribute('aria-pressed',x===b));SND.wake();SND.click()}});
  $('#inCode').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom()});
  $('#btnHome').onclick=leaveAll;$('#btnLeave').onclick=leaveAll;$('#btnOverHome').onclick=leaveAll;
  $('#btnAgain').onclick=()=>{if(H){H.again();H.start()}};
  $('#btnStart').onclick=()=>{if(H)H.start()};
  $('#btnCopy').onclick=async()=>{try{await navigator.clipboard.writeText(roomCode.toUpperCase());toast('تم نسخ الكود.')}catch(e){toast('الكود: '+roomCode.toUpperCase())}};
  document.querySelectorAll('#segMode button').forEach(b=>b.onclick=()=>H&&H.setOpt('mode',b.dataset.v));
  document.querySelectorAll('#segN button').forEach(b=>b.onclick=()=>H&&H.setOpt('N',b.dataset.v));
  $('#btnReview').onclick=()=>{showScreens('review');renderReview()};
  $('#btnProfile').onclick=()=>{showScreens('profile');renderProfile()};
  document.querySelectorAll('#rxbar button').forEach(b=>b.onclick=()=>{SND.click();send({k:'r',e:+b.dataset.e})});
  $('#btnWa').onclick=()=>{const u=location.href.split('#')[0].split('?')[0]+'?room='+roomCode;window.open('https://wa.me/?text='+encodeURIComponent('تعالى نلعب غمر المعرفة! الكود: '+roomCode.toUpperCase()+'\n'+u),'_blank')};
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
  const rp=(new URLSearchParams(location.search).get('room')||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(rp.length===5){
    $('#inCode').value=rp;$('#btnPlay').textContent='ادخل الغرفة '+rp.toUpperCase();
    $('#btnPlay').onclick=()=>{store.set('qm_name',myName());joinRoom()};
  }
}
init();
