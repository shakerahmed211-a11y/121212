/* ================= HOST ENGINE (runs on the room owner's device, or locally in solo play) ================= */
const SP_SEC=15, BATTLE_LOSS=4, DEF_BONUS=3, TILE_PTS=3, CLAIM_SEC=10, REV_MIN=3, CASTLE_HITS=4, LAST_SEC=5, FIFTY=2, PTS=[10,7,5,3], PEN_SEC=3;
/* seconds for a question: by difficulty (calculations get more), plus reading time for long questions */
function qdur(q,calc){const len=(q.t||'').length+(q.o||[]).join('').length;const base=calc?30:(q.l===3?20:q.l===1?12:15);return base+Math.min(8,Math.round(len/90))}
const CPU_P=[0,.5,.7,.88], CPU_T=[null,[8,16],[5,11],[3,8]];

function cleanName(s){return String(s||'').replace(/[\u0000-\u001f​-‏‪-‮⁦-⁩]/g,'').trim().slice(0,18)}

function makeHost(code,emit,onLocal,getPeers,meFn){
  const st={ph:'lobby',code,mode:'mix',df:0,N:15,n:0,pl:[],ow:{},ht:{},lk:[],q:null,ans:[],cl:null,rv:null,rem:0,dur:0,win:-1,hd:[],hf:{},ls:0,nx:[],gd:0,rx:null};
  const hs={used:new Set(),qa:-1,qStart:0,ans:{},claims:{},tm:null,cpuT:[],dl:0,hb:null,cpuSeq:0,rxS:0,rxT:{},pen:{},cpuQ:[],first:false,lc:false};

  function clearT(){clearTimeout(hs.tm);hs.cpuT.forEach(clearTimeout);hs.cpuT=[]}
  function alive(){return st.pl.map((p,i)=>i).filter(i=>!st.pl[i].out)}
  function active(){return alive().filter(i=>!st.pl[i].gone)}
  function tilesOf(i){return Object.keys(st.ow).filter(t=>st.ow[t]===i)}
  function valid(i){const s=new Set();tilesOf(i).forEach(t=>GEO.t[t].adj.forEach(a=>{if(st.ow[a]!==i)s.add(a)}));return [...s]}

  function broadcast(){
    st.rem=Math.max(0,+((hs.dl-Date.now())/1000).toFixed(1));
    let json=JSON.stringify(st);
    if(new TextEncoder().encode(json).length>3900){ if(st.rv){st.rv.s=''} if(st.rv&&st.rv.log.length>9)st.rv.log=st.rv.log.slice(0,9); json=JSON.stringify(st); }
    if(emit)emit(json);
    onLocal(JSON.parse(json));
  }

  /* ----- lobby ----- */
  function mkP(id,nm,ci,cpu,fl){return {id,nm,ci,cpu,fl:fl==null?ci:fl,out:0,gone:0,ok:0,pts:0,cb:0,mc:0,h:FIFTY,cs:''}}
  function dedupeFl(arr){const u=new Set();arr.forEach(p=>{let f=p.fl;if(!(f>=0&&f<8)||u.has(f)){f=-1;for(let k=0;k<8;k++)if(!u.has(k)){f=k;break}}p.fl=f;u.add(f)})}
  function freeColor(){const u=new Set(st.pl.map(p=>p.ci));for(let c=0;c<4;c++)if(!u.has(c))return c;return 0}
  function syncRoster(){
    if(st.ph!=='lobby')return;
    const peers=(getPeers?getPeers():[]).filter(p=>p.kind==='viewer'&&p.presence&&p.presence.nm).sort((a,b)=>(a.peer===meFn()?-1:b.peer===meFn()?1:(a.presence.t||0)-(b.presence.t||0)));
    const old=new Map(st.pl.filter(p=>!p.cpu).map(p=>[p.id,p]));
    const cpus=st.pl.filter(p=>p.cpu);
    let humans=peers.length?peers.map(p=>({id:p.peer,nm:cleanName(p.presence.nm)||'لاعب',cpu:0,fl:p.presence.fl})):[{id:meFn(),nm:cleanName(window.__myName)||'أنا',cpu:0,fl:window.__myFlag}];
    humans=humans.slice(0,4);
    const keep=cpus.slice(0,Math.max(0,4-humans.length));
    const next=[];
    const used=new Set();
    humans.forEach(h=>{const o=old.get(h.id);if(o&&!used.has(o.ci)){h.ci=o.ci;used.add(o.ci)}});
    keep.forEach(c=>{if(!used.has(c.ci)){used.add(c.ci)}else c.ci=-1});
    const take=()=>{for(let c=0;c<4;c++)if(!used.has(c)){used.add(c);return c}return 0};
    humans.forEach(h=>{if(h.ci==null)h.ci=take();next.push(mkP(h.id,h.nm,h.ci,0,h.fl))});
    keep.forEach(c=>{if(c.ci<0)c.ci=take();next.push(mkP(c.id,c.nm,c.ci,c.cpu,c.fl))});
    dedupeFl(next);
    st.pl=next;
    broadcast();
  }
  function addCpu(level){
    if(st.ph!=='lobby'||st.pl.length>=4)return;
    hs.cpuSeq++;
    const used=new Set(st.pl.map(p=>p.ci));let ci=0;for(let c=0;c<4;c++)if(!used.has(c)){ci=c;break}
    st.pl.push(mkP('cpu'+hs.cpuSeq,'كمبيوتر '+(st.pl.filter(p=>p.cpu).length+1),ci,level,ci));dedupeFl(st.pl);
    broadcast();
  }
  function removeCpu(idx){ if(st.ph==='lobby'&&st.pl[idx]&&st.pl[idx].cpu){st.pl.splice(idx,1);broadcast()} }
  function setOpt(k,v){ if(st.ph!=='lobby')return; if(k==='mode'&&['lab','gen','mix','fam'].includes(v))st.mode=v; if(k==='df'&&[0,1,2,3].includes(+v))st.df=+v; if(k==='N'&&[10,15,20,30,40].includes(+v))st.N=+v; broadcast(); }

  /* ----- game ----- */
  function start(){
    if(st.ph!=='lobby'||st.pl.length<2)return false;
    clearT();
    st.ow={};st.ht={};st.lk=[];st.n=0;st.win=-1;hs.used.clear();
    st.pl.forEach(p=>{p.out=0;p.ok=0;p.pts=0;p.cb=0;p.mc=0;p.h=FIFTY;p.gone=0;p.cs=''});
    st.ph='sp';st.dur=SP_SEC;hs.dl=Date.now()+SP_SEC*1000;
    hs.tm=setTimeout(finishSp,SP_SEC*1000);
    st.pl.forEach((p,i)=>{if(p.cpu)hs.cpuT.push(setTimeout(()=>{const t=spFree(i);if(t){pickSource(i,t);lockSource(i)}},R(1500,5000)))});
    broadcast();return true;
  }
  /* source selection: a free province that is not next to anyone else's source */
  function spOk(i,t){
    if(typeof t!=='string'||!GEO.t[t])return false;
    if(st.ow[t]!==undefined&&st.ow[t]!==i)return false;
    return !GEO.t[t].adj.some(a=>st.ow[a]!==undefined&&st.ow[a]!==i);
  }
  function spFree(i){const c=GEO.ids.filter(t=>spOk(i,t));return c.length?pick(c):null}
  function pickSource(i,t){
    if(st.ph!=='sp'||!st.pl[i]||st.lk.includes(i)||!spOk(i,t))return;
    const old=st.pl[i].cs;if(old)delete st.ow[old];
    st.pl[i].cs=t;st.ow[t]=i;broadcast();
  }
  function lockSource(i){
    if(st.ph!=='sp'||!st.pl[i]||!st.pl[i].cs||st.lk.includes(i))return;
    st.lk.push(i);
    if(spDone()){clearTimeout(hs.tm);finishSp();return}
    broadcast();
  }
  function spDone(){return st.pl.every((p,i)=>p.gone||st.lk.includes(i))}
  function finishSp(){
    if(st.ph!=='sp')return;
    clearT();
    st.pl.forEach((p,i)=>{if(!p.cs){const t=spFree(i);if(t){p.cs=t;st.ow[t]=i}}});
    st.lk=st.pl.map((p,i)=>i);
    nextQ();
  }
  function nextQ(){
    clearT();
    if(st.n>=st.N||alive().length<=1||active().length===0){endGame();return}
    startQ();
  }
  function choose(){
    // easy general-knowledge questions get extra weight so everyone can answer some
    let cats=st.mode==='lab'?LABC:st.mode==='fam'?FAMC:st.mode==='gen'?[...GENC,'easy','easy']:[...LABC,...GENC,'easy','easy'];
    if(st.df===1)cats=cats.filter(c=>c!=='labcalc'&&c!=='math'); // no calculations on the easy level
    if(st.df){const ok=cats.filter(c=>c==='labcalc'||c==='math'?st.df>1:(BYCAT[c]||[]).some(i=>BANK[i].l===st.df));if(ok.length)cats=ok}
    const seen=new Set(store.get('qm_seen',[]));
    for(let tries=0;tries<30;tries++){
      const c=pick(cats);
      if(c==='labcalc'||c==='math'){const q=genQuestion(c);q.dur=qdur(q,true);return q}
      const all=BYCAT[c]||[];
      let pool=all.filter(i=>!hs.used.has(i)&&!seen.has(i)&&(!st.df||BANK[i].l===st.df));
      if(!pool.length){ pool=all.filter(i=>!hs.used.has(i)&&(!st.df||BANK[i].l===st.df)); all.forEach(i=>seen.delete(i)); }
      if(!pool.length)continue;
      const i=pick(pool);hs.used.add(i);seen.add(i);
      const b=BANK[i],ord=shuf([0,1,2,3]);
      store.set('qm_seen',[...seen].slice(-1500));
      const q={k:c,c:CAT[c],t:b.q,o:ord.map(j=>b.o[j]),a:ord.indexOf(b.a),l:b.l,s:b.s||'',ltr:false};q.dur=qdur(q,false);return q;
    }
    {const q=genQuestion('math');q.dur=qdur(q,true);return q}
  }
  function startQ(){
    const q=choose();
    hs.qa=q.a;hs.qStart=Date.now();hs.ans={};hs.claims={};hs.pen={};hs.cpuQ=[];hs.first=false;hs.lc=false;
    st.n++;st.ph='q';st.ans=[];st.cl=null;st.rv=null;st.hd=[];st.hf={};st.ls=0;st.nx=[];st.gd=(st.n%7===0&&st.n<st.N)?1:0;
    st.q={k:q.k,c:q.c,t:q.t,o:q.o,l:q.l,s:q.s,ltr:q.ltr,dur:q.dur};
    st.dur=q.dur;hs.dl=Date.now()+q.dur*1000;
    hs.tm=setTimeout(endQ,q.dur*1000);
    // computer players decide their answer and when to give it
    st.pl.forEach((p,i)=>{
      if(!p.cpu||p.out)return;
      let pr=CPU_P[p.cpu]+(q.l===1?.1:q.l===3?-.12:0);pr=Math.min(.95,Math.max(.2,pr));
      const right=Math.random()<pr;
      const ch=right?q.a:pick([0,1,2,3].filter(x=>x!==q.a));
      const [lo,hi]=CPU_T[p.cpu];const secs=Math.max(R(lo*10,hi*10)/10*(q.dur/25),2.5+(q.t.length+q.o.join('').length)/80); // never faster than a person could read
      const o={i,ch,secs,done:false,tm:null};
      o.tm=setTimeout(()=>{o.done=true;answer(i,ch)},secs*1000);
      hs.cpuT.push(o.tm);hs.cpuQ.push(o);
    });
    // automatic hints: one wrong option fades for everyone at 50% and at 75% of the time
    [.5,.75].forEach(f=>hs.cpuT.push(setTimeout(autoHint,q.dur*f*1000)));
    broadcast();
  }
  function answer(i,c){
    if(st.ph!=='q'||hs.ans[i]||!st.pl[i]||st.pl[i].out||st.pl[i].gone||!(c>=0&&c<4))return;
    hs.ans[i]={c:c|0,t:Date.now()-hs.qStart};st.ans[i]=true;
    if(active().every(k=>hs.ans[k])){clearTimeout(hs.tm);endQ();return}
    if(!st.pl[i].cpu){
      const t=hs.ans[i].t/1000;
      // computers speed up to match the first human's pace (never slow down)
      if(!hs.first){hs.first=true;hs.cpuQ.forEach(o=>{
        if(o.done||hs.ans[o.i])return;
        const L=st.pl[o.i].cpu,adapt=t*(L===3?.7:L===2?.95:1.25)+R(3,15)/10;
        const d=Math.max(t+.4,Math.min(o.secs,adapt,t+4.3));
        if(d<o.secs){clearTimeout(o.tm);o.tm=setTimeout(()=>{o.done=true;answer(o.i,o.ch)},Math.max(150,(d-t)*1000));hs.cpuT.push(o.tm)}
      })}
      // first correct human answer: everyone else gets only a few more seconds
      if(c===hs.qa&&!hs.lc&&(hs.dl-Date.now())/1000>LAST_SEC){
        hs.lc=true;st.ls=1;clearTimeout(hs.tm);hs.dl=Date.now()+LAST_SEC*1000;st.dur=LAST_SEC;hs.tm=setTimeout(endQ,LAST_SEC*1000);
      }
    }
    broadcast();
  }
  function wrongAll(){return [0,1,2,3].filter(x=>x!==hs.qa)}
  function autoHint(){
    if(st.ph!=='q'||st.hd.length>=2)return;
    const W=wrongAll();
    const cand=W.filter(x=>!st.hd.includes(x)&&Object.keys(st.hf).every(k=>W.some(y=>y!==x&&!st.hd.includes(y)&&!st.hf[k].includes(y))));
    if(!cand.length)return;
    st.hd.push(pick(cand));broadcast();
  }
  /* 50/50: hides two wrong options for that player only (a time penalty is added to their speed ranking) */
  function fifty(i){
    const p=st.pl[i];
    if(st.ph!=='q'||!p||p.out||p.gone||hs.ans[i]||!(p.h>0)||st.hf[i])return;
    const vis=wrongAll().filter(x=>!st.hd.includes(x));
    if(vis.length<=1)return;
    const keep=pick(vis);
    st.hf[i]=vis.filter(x=>x!==keep);
    p.h--;hs.pen[i]=1;broadcast();
  }
  function endQ(){
    if(st.ph!=='q')return;
    clearT();
    const ci=hs.qa,ch=[],tm=[];
    st.pl.forEach((p,i)=>{const a=hs.ans[i];ch[i]=a?a.c:-1;tm[i]=a?+((a.t/1000)+(hs.pen[i]?PEN_SEC:0)).toFixed(1):-1;
      if(!p.out){if(a&&a.c===ci){p.ok++;p.cb=(p.cb||0)+1;if(p.cb>(p.mc||0))p.mc=p.cb}else p.cb=0}});
    // points by speed: the fastest correct answer earns the most
    const pt=st.pl.map(()=>0);
    st.pl.map((p,i)=>i).filter(i=>ch[i]===ci&&!st.pl[i].out).sort((a,b)=>tm[a]-tm[b]).forEach((i,r)=>{pt[i]=PTS[Math.min(r,PTS.length-1)]*(1+(st.gd?1:0)+((st.pl[i].cb||0)>=3?1:0));st.pl[i].pts+=pt[i]});
    const el=alive().filter(i=>!st.pl[i].gone&&ch[i]===ci&&valid(i).length).sort((a,b)=>tm[a]-tm[b]);
    st.rv={ci,ch,tm,pt,log:[],s:st.q.s||''};
    if(!el.length){st.cl=null;finishRound();return}
    st.cl={el,dn:[]};hs.claims={};st.ph='claim';st.dur=CLAIM_SEC;hs.dl=Date.now()+CLAIM_SEC*1000;
    hs.tm=setTimeout(resolve,CLAIM_SEC*1000);
    el.forEach(i=>{ if(st.pl[i].cpu) hs.cpuT.push(setTimeout(()=>{const t1=cpuTarget(i),arr=[t1];if(st.gd&&t1){const t2=cpuTarget(i,t1);if(t2)arr.push(t2)}claim(i,arr)},R(1200,3500))) });
    broadcast();
  }
  function cpuTarget(i,ex){
    const L=st.pl[i].cpu,V=valid(i).filter(x=>x!==ex),{ch,tm,ci}=st.rv;let best=null,bs=-1e9;
    for(const t of V){
      const e=st.ow[t],nb=GEO.t[t].adj;let s=Math.random()*(L===1?6:L===2?3:1.2);
      const mine=nb.filter(a=>st.ow[a]===i).length;
      if(e===undefined){s+=3+mine*.6+nb.filter(a=>st.ow[a]===undefined).length*.25}
      else{
        s+=2.5+mine*.4+(st.pl[e].cs===t?3+2*(st.ht[t]||0):0);
        if(L>=2){const defOk=ch[e]===ci,faster=defOk&&tm[e]<tm[i];if(faster)s-=8;else if(!defOk)s+=3}
      }
      if(s>bs){bs=s;best=t}
    }
    return best;
  }
  function claim(i,t){
    if(st.ph!=='claim'||!st.cl||!st.cl.el.includes(i)||st.cl.dn.includes(i)||!t)return;
    const arr=[...new Set(Array.isArray(t)?t:[t])].slice(0,st.gd?2:1),V=valid(i);
    if(!arr.length||!arr.every(x=>typeof x==='string'&&V.includes(x)))return;
    hs.claims[i]=arr;st.cl.dn.push(i);
    if(st.cl.dn.length>=st.cl.el.length){clearTimeout(hs.tm);resolve();return}
    broadcast();
  }
  function resolve(){
    if(st.ph!=='claim')return;
    clearT();
    const {ch,tm,ci}=st.rv,log=st.rv.log;
    const order=st.cl.el.slice();
    order.forEach(a=>{
      const list=hs.claims[a];
      if(!list||!list.length){log.push(['skip',a]);return}
      list.forEach(t=>{
        if(st.pl[a].out)return;
        if(!valid(a).includes(t)){log.push(['inv',a,t]);return}
        const e=st.ow[t];
        if(e===undefined){st.ow[t]=a;log.push(['cap',a,t]);cpuReact(a,[1,0]);return}
        const defOk=ch[e]===ci&&!st.pl[e].out;
        if(defOk&&tm[e]<tm[a]){const lost=Math.min(st.pl[a].pts||0,BATTLE_LOSS);st.pl[a].pts-=lost;st.pl[e].pts+=DEF_BONUS;log.push(['def',a,t,e,lost]);cpuReact(e,[2]);return}
        if(st.pl[e].cs===t){
          st.ht[t]=(st.ht[t]||0)+1;
          if(st.ht[t]>=CASTLE_HITS){
            delete st.ht[t];st.ow[t]=a;st.pl[e].out=1;
            Object.keys(st.ow).forEach(k=>{if(st.ow[k]===e)delete st.ow[k]});
            log.push(['fall',a,t,e]);cpuReact(a,[1]);cpuReact(e,[3]);
          }else{
            log.push(['hit',a,t,e,st.ht[t]]);
            // a player whose source is nearly dry gets one extra 50/50 hint
            if(st.ht[t]===CASTLE_HITS-1&&(st.pl[e].h||0)<3){st.pl[e].h=(st.pl[e].h||0)+1;log.push(['aid',e])}
          }
        }else{st.ow[t]=a;log.push(['take',a,t,e]);cpuReact(a,[1,0])}
      });
    });
    finishRound();
  }
  function finishRound(){
    st.ph='rev';st.nx=[];
    const secs=REV_MIN+Math.min(3,(st.rv.log.length)*.6);
    st.dur=secs;hs.dl=Date.now()+secs*1000;
    hs.tm=setTimeout(nextQ,secs*1000);
    broadcast();
  }
  function score(i){return (st.pl[i].pts||0)+TILE_PTS*tilesOf(i).length}
  function ranking(){
    return st.pl.map((p,i)=>({i,t:tilesOf(i).length,sc:score(i),ok:p.ok,out:p.out})).sort((a,b)=>(a.out-b.out)||(b.sc-a.sc)||(b.t-a.t)||(b.ok-a.ok));
  }
  function endGame(){
    clearT();
    const r=ranking();st.win=r.length?r[0].i:-1;
    st.ph='over';st.q=null;st.cl=null;st.dur=0;hs.dl=0;
    broadcast();
  }
  function again(){
    clearT();
    st.ph='lobby';st.ow={};st.ht={};st.lk=[];st.n=0;st.q=null;st.rv=null;st.cl=null;st.win=-1;st.dur=0;hs.dl=0;
    st.pl=st.pl.map(p=>({...p,out:0,gone:0,ok:0,pts:0,cb:0,mc:0,h:FIFTY,cs:''}));st.hd=[];st.hf={};st.ls=0;st.nx=[];st.gd=0;st.rx=null;
    syncRoster();
  }
  function peerLeft(id){
    const i=st.pl.findIndex(p=>p.id===id&&!p.cpu);
    if(i<0)return;
    if(st.ph==='lobby'){syncRoster();return}
    st.pl[i].gone=1;
    if(st.ph==='sp'){if(spDone()){clearTimeout(hs.tm);finishSp()}else broadcast();return}
    if(st.ph==='q'&&active().every(k=>hs.ans[k])&&active().length){clearTimeout(hs.tm);endQ();return}
    if(st.ph==='rev'&&allReady()){clearTimeout(hs.tm);nextQ();return}
    if(st.ph==='claim'&&st.cl){st.cl.el=st.cl.el.filter(k=>k!==i);if(st.cl.el.every(k=>st.cl.dn.includes(k))){clearTimeout(hs.tm);resolve();return}}
    broadcast();
  }
  function onMsg(id,m){
    const i=st.pl.findIndex(p=>p.id===id&&!p.cpu);
    if(!m||typeof m!=='object')return;
    if(m.k==='hi'){broadcast();return}
    if(i<0)return;
    if(m.k==='a'&&m.n===st.n)answer(i,m.c);
    else if(m.k==='c'&&m.n===st.n&&(typeof m.t==='string'||Array.isArray(m.t)))claim(i,m.t);
    else if(m.k==='f'&&m.n===st.n)fifty(i);
    else if(m.k==='s')pickSource(i,m.t);
    else if(m.k==='l')lockSource(i);
    else if(m.k==='r')react(i,m.e|0);
    else if(m.k==='x'&&m.n===st.n&&st.ph==='rev'&&!st.nx.includes(i)){st.nx.push(i);if(allReady()){clearTimeout(hs.tm);nextQ()}else broadcast()}
  }
  function react(i,e){
    if(!(e>=0&&e<4)||!st.pl[i])return;
    const now=Date.now();if(now-(hs.rxT[i]||0)<1200)return;
    hs.rxT[i]=now;st.rx={i,e,s:++hs.rxS};broadcast();
  }
  function cpuReact(i,opts){if(st.pl[i]&&st.pl[i].cpu&&Math.random()<.4)hs.cpuT.push(setTimeout(()=>react(i,pick(opts)),R(400,1800)))}
  function allReady(){const hu=active().filter(k=>!st.pl[k].cpu);return hu.length>0&&hu.every(k=>st.nx.includes(k))}
  function stop(){clearT();clearInterval(hs.hb)}
  hs.hb=setInterval(()=>{ if(st.ph!=='over'||true)broadcast() },4000);
  return {st,syncRoster,addCpu,removeCpu,setOpt,start,again,onMsg,peerLeft,stop,answer,claim,broadcast,valid};
}
