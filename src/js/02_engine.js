/* ================= HOST ENGINE (runs on the room owner's device, or locally in solo play) ================= */
const CLAIM_SEC=8, REV_MIN=3, CASTLE_HITS=4, LAST_SEC=5, FIFTY=2, PTS=[10,7,5,3], PEN_SEC=3;
/* seconds for a question: by difficulty (calculations get more), plus reading time for long questions */
function qdur(q,calc){const len=(q.t||'').length+(q.o||[]).join('').length;const base=calc?30:(q.l===3?20:q.l===1?12:15);return base+Math.min(8,Math.round(len/90))}
const STARTS={2:['alx','asw'],3:['alx','asw','nsi'],4:['alx','asw','nsi','asy']};
const CPU_P=[0,.5,.7,.88], CPU_T=[null,[8,16],[5,11],[3,8]];

function cleanName(s){return String(s||'').replace(/[\u0000-\u001f​-‏‪-‮⁦-⁩]/g,'').trim().slice(0,18)}

function makeHost(code,emit,onLocal,getPeers,meFn){
  const st={ph:'lobby',code,mode:'mix',N:30,n:0,pl:[],ow:{},ht:{},q:null,ans:[],cl:null,rv:null,rem:0,dur:0,win:-1,hd:[],hf:{},ls:0,nx:[]};
  const hs={used:new Set(),qa:-1,qStart:0,ans:{},claims:{},tm:null,cpuT:[],dl:0,hb:null,cpuSeq:0,pen:{},cpuQ:[],first:false,lc:false};

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
  function freeColor(){const u=new Set(st.pl.map(p=>p.ci));for(let c=0;c<4;c++)if(!u.has(c))return c;return 0}
  function syncRoster(){
    if(st.ph!=='lobby')return;
    const peers=(getPeers?getPeers():[]).filter(p=>p.kind==='viewer'&&p.presence&&p.presence.nm).sort((a,b)=>(a.peer===meFn()?-1:b.peer===meFn()?1:(a.presence.t||0)-(b.presence.t||0)));
    const old=new Map(st.pl.filter(p=>!p.cpu).map(p=>[p.id,p]));
    const cpus=st.pl.filter(p=>p.cpu);
    let humans=peers.length?peers.map(p=>({id:p.peer,nm:cleanName(p.presence.nm)||'لاعب',cpu:0})):[{id:meFn(),nm:cleanName(window.__myName)||'أنا',cpu:0}];
    humans=humans.slice(0,4);
    const keep=cpus.slice(0,Math.max(0,4-humans.length));
    const next=[];
    const used=new Set();
    humans.forEach(h=>{const o=old.get(h.id);if(o&&!used.has(o.ci)){h.ci=o.ci;used.add(o.ci)}});
    keep.forEach(c=>{if(!used.has(c.ci)){used.add(c.ci)}else c.ci=-1});
    const take=()=>{for(let c=0;c<4;c++)if(!used.has(c)){used.add(c);return c}return 0};
    humans.forEach(h=>{if(h.ci==null)h.ci=take();next.push({id:h.id,nm:h.nm,ci:h.ci,cpu:0,out:0,gone:0,ok:0,pts:0,h:FIFTY,cs:''})});
    keep.forEach(c=>{if(c.ci<0)c.ci=take();next.push({id:c.id,nm:c.nm,ci:c.ci,cpu:c.cpu,out:0,gone:0,ok:0,pts:0,h:FIFTY,cs:''})});
    st.pl=next;
    broadcast();
  }
  function addCpu(level){
    if(st.ph!=='lobby'||st.pl.length>=4)return;
    hs.cpuSeq++;
    const used=new Set(st.pl.map(p=>p.ci));let ci=0;for(let c=0;c<4;c++)if(!used.has(c)){ci=c;break}
    st.pl.push({id:'cpu'+hs.cpuSeq,nm:'كمبيوتر '+(st.pl.filter(p=>p.cpu).length+1),ci,cpu:level,out:0,gone:0,ok:0,pts:0,h:FIFTY,cs:''});
    broadcast();
  }
  function removeCpu(idx){ if(st.ph==='lobby'&&st.pl[idx]&&st.pl[idx].cpu){st.pl.splice(idx,1);broadcast()} }
  function setOpt(k,v){ if(st.ph!=='lobby')return; if(k==='mode'&&['lab','gen','mix'].includes(v))st.mode=v; if(k==='N'&&[20,30,40].includes(+v))st.N=+v; broadcast(); }

  /* ----- game ----- */
  function start(){
    if(st.ph!=='lobby'||st.pl.length<2)return false;
    st.ow={};st.ht={};st.n=0;st.win=-1;hs.used.clear();
    const spots=shuf(STARTS[st.pl.length]);
    st.pl.forEach((p,i)=>{p.out=0;p.ok=0;p.pts=0;p.h=FIFTY;p.gone=0;p.cs=spots[i];st.ow[spots[i]]=i});
    nextQ();return true;
  }
  function nextQ(){
    clearT();
    if(st.n>=st.N||alive().length<=1||active().length===0){endGame();return}
    startQ();
  }
  function choose(){
    const cats=st.mode==='lab'?LABC:st.mode==='gen'?GENC:[...LABC,...GENC];
    const seen=new Set(store.get('qm_seen',[]));
    for(let tries=0;tries<30;tries++){
      const c=pick(cats);
      if(c==='labcalc'||c==='math'){const q=genQuestion(c);q.dur=qdur(q,true);return q}
      const all=BYCAT[c]||[];
      let pool=all.filter(i=>!hs.used.has(i)&&!seen.has(i));
      if(!pool.length){ pool=all.filter(i=>!hs.used.has(i)); all.forEach(i=>seen.delete(i)); }
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
    st.n++;st.ph='q';st.ans=[];st.cl=null;st.rv=null;st.hd=[];st.hf={};st.ls=0;st.nx=[];
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
    st.pl.forEach((p,i)=>{const a=hs.ans[i];ch[i]=a?a.c:-1;tm[i]=a?+((a.t/1000)+(hs.pen[i]?PEN_SEC:0)).toFixed(1):-1;if(a&&a.c===ci&&!p.out)p.ok++});
    // points by speed: the fastest correct answer earns the most
    const pt=st.pl.map(()=>0);
    st.pl.map((p,i)=>i).filter(i=>ch[i]===ci&&!st.pl[i].out).sort((a,b)=>tm[a]-tm[b]).forEach((i,r)=>{pt[i]=PTS[Math.min(r,PTS.length-1)];st.pl[i].pts+=pt[i]});
    const el=alive().filter(i=>!st.pl[i].gone&&ch[i]===ci&&valid(i).length).sort((a,b)=>tm[a]-tm[b]);
    st.rv={ci,ch,tm,pt,log:[],s:st.q.s||''};
    if(!el.length){st.cl=null;finishRound();return}
    st.cl={el,dn:[]};hs.claims={};st.ph='claim';st.dur=CLAIM_SEC;hs.dl=Date.now()+CLAIM_SEC*1000;
    hs.tm=setTimeout(resolve,CLAIM_SEC*1000);
    el.forEach(i=>{ if(st.pl[i].cpu) hs.cpuT.push(setTimeout(()=>claim(i,cpuTarget(i)),R(1200,3500))) });
    broadcast();
  }
  function cpuTarget(i){
    const L=st.pl[i].cpu,V=valid(i),{ch,tm,ci}=st.rv;let best=null,bs=-1e9;
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
    if(st.ph!=='claim'||!st.cl||!st.cl.el.includes(i)||st.cl.dn.includes(i)||!t||!valid(i).includes(t))return;
    hs.claims[i]=t;st.cl.dn.push(i);
    if(st.cl.dn.length>=st.cl.el.length){clearTimeout(hs.tm);resolve();return}
    broadcast();
  }
  function resolve(){
    if(st.ph!=='claim')return;
    clearT();
    const {ch,tm,ci}=st.rv,log=st.rv.log;
    const order=st.cl.el.slice();
    order.forEach(a=>{
      const t=hs.claims[a];
      if(!t){log.push(['skip',a]);return}
      if(st.pl[a].out)return;
      if(!valid(a).includes(t)){log.push(['inv',a,t]);return}
      const e=st.ow[t];
      if(e===undefined){st.ow[t]=a;log.push(['cap',a,t]);return}
      const defOk=ch[e]===ci&&!st.pl[e].out;
      if(defOk&&tm[e]<tm[a]){log.push(['def',a,t,e]);return}
      if(st.pl[e].cs===t){
        st.ht[t]=(st.ht[t]||0)+1;
        if(st.ht[t]>=CASTLE_HITS){
          delete st.ht[t];st.ow[t]=a;st.pl[e].out=1;
          Object.keys(st.ow).forEach(k=>{if(st.ow[k]===e)delete st.ow[k]});
          log.push(['fall',a,t,e]);
        }else log.push(['hit',a,t,e,st.ht[t]]);
      }else{st.ow[t]=a;log.push(['take',a,t,e])}
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
  function ranking(){
    return st.pl.map((p,i)=>({i,t:tilesOf(i).length,pts:p.pts||0,ok:p.ok,out:p.out})).sort((a,b)=>(b.t-a.t)||(b.pts-a.pts)||(b.ok-a.ok));
  }
  function endGame(){
    clearT();
    const r=ranking();st.win=r.length?r[0].i:-1;
    st.ph='over';st.q=null;st.cl=null;st.dur=0;hs.dl=0;
    broadcast();
  }
  function again(){
    clearT();
    st.ph='lobby';st.ow={};st.ht={};st.n=0;st.q=null;st.rv=null;st.cl=null;st.win=-1;st.dur=0;hs.dl=0;
    st.pl=st.pl.map(p=>({...p,out:0,gone:0,ok:0,pts:0,h:FIFTY,cs:''}));st.hd=[];st.hf={};st.ls=0;st.nx=[];
    syncRoster();
  }
  function peerLeft(id){
    const i=st.pl.findIndex(p=>p.id===id&&!p.cpu);
    if(i<0)return;
    if(st.ph==='lobby'){syncRoster();return}
    st.pl[i].gone=1;
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
    else if(m.k==='c'&&m.n===st.n&&typeof m.t==='string')claim(i,m.t);
    else if(m.k==='f'&&m.n===st.n)fifty(i);
    else if(m.k==='x'&&m.n===st.n&&st.ph==='rev'&&!st.nx.includes(i)){st.nx.push(i);if(allReady()){clearTimeout(hs.tm);nextQ()}else broadcast()}
  }
  function allReady(){const hu=active().filter(k=>!st.pl[k].cpu);return hu.length>0&&hu.every(k=>st.nx.includes(k))}
  function stop(){clearT();clearInterval(hs.hb)}
  hs.hb=setInterval(()=>{ if(st.ph!=='over'||true)broadcast() },4000);
  return {st,syncRoster,addCpu,removeCpu,setOpt,start,again,onMsg,peerLeft,stop,answer,claim,broadcast,valid};
}
