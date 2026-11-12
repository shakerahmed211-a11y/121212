/* ================= HOST ENGINE (runs on the room owner's device, or locally in solo play) ================= */
const CLAIM_SEC=14, REV_BASE=5, CASTLE_HITS=4;
const STARTS={2:['alx','asw'],3:['alx','asw','nsi'],4:['alx','asw','nsi','asy']};
const CPU_P=[0,.5,.7,.88], CPU_T=[null,[8,16],[5,11],[3,8]];

function cleanName(s){return String(s||'').replace(/[\u0000-\u001f​-‏‪-‮⁦-⁩]/g,'').trim().slice(0,18)}

function makeHost(code,emit,onLocal,getPeers,meFn){
  const st={ph:'lobby',code,mode:'mix',N:30,n:0,pl:[],ow:{},ht:{},q:null,ans:[],cl:null,rv:null,rem:0,dur:0,win:-1};
  const hs={used:new Set(),qa:-1,qStart:0,ans:{},claims:{},tm:null,cpuT:[],dl:0,hb:null,cpuSeq:0};

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
    humans.forEach(h=>{if(h.ci==null)h.ci=take();next.push({id:h.id,nm:h.nm,ci:h.ci,cpu:0,out:0,gone:0,ok:0,cs:''})});
    keep.forEach(c=>{if(c.ci<0)c.ci=take();next.push({id:c.id,nm:c.nm,ci:c.ci,cpu:c.cpu,out:0,gone:0,ok:0,cs:''})});
    st.pl=next;
    broadcast();
  }
  function addCpu(level){
    if(st.ph!=='lobby'||st.pl.length>=4)return;
    hs.cpuSeq++;
    const used=new Set(st.pl.map(p=>p.ci));let ci=0;for(let c=0;c<4;c++)if(!used.has(c)){ci=c;break}
    st.pl.push({id:'cpu'+hs.cpuSeq,nm:'كمبيوتر '+(st.pl.filter(p=>p.cpu).length+1),ci,cpu:level,out:0,gone:0,ok:0,cs:''});
    broadcast();
  }
  function removeCpu(idx){ if(st.ph==='lobby'&&st.pl[idx]&&st.pl[idx].cpu){st.pl.splice(idx,1);broadcast()} }
  function setOpt(k,v){ if(st.ph!=='lobby')return; if(k==='mode'&&['lab','gen','mix'].includes(v))st.mode=v; if(k==='N'&&[20,30,40].includes(+v))st.N=+v; broadcast(); }

  /* ----- game ----- */
  function start(){
    if(st.ph!=='lobby'||st.pl.length<2)return false;
    st.ow={};st.ht={};st.n=0;st.win=-1;hs.used.clear();
    const spots=shuf(STARTS[st.pl.length]);
    st.pl.forEach((p,i)=>{p.out=0;p.ok=0;p.gone=0;p.cs=spots[i];st.ow[spots[i]]=i});
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
      if(c==='labcalc'||c==='math'){const q=genQuestion(c);q.dur=40;return q}
      const all=BYCAT[c]||[];
      let pool=all.filter(i=>!hs.used.has(i)&&!seen.has(i));
      if(!pool.length){ pool=all.filter(i=>!hs.used.has(i)); all.forEach(i=>seen.delete(i)); }
      if(!pool.length)continue;
      const i=pick(pool);hs.used.add(i);seen.add(i);
      const b=BANK[i],ord=shuf([0,1,2,3]);
      store.set('qm_seen',[...seen].slice(-1500));
      return {k:c,c:CAT[c],t:b.q,o:ord.map(j=>b.o[j]),a:ord.indexOf(b.a),l:b.l,s:b.s||'',ltr:false,dur:25};
    }
    return genQuestion('math');
  }
  function startQ(){
    const q=choose();
    hs.qa=q.a;hs.qStart=Date.now();hs.ans={};hs.claims={};
    st.n++;st.ph='q';st.ans=[];st.cl=null;st.rv=null;
    st.q={k:q.k,c:q.c,t:q.t,o:q.o,l:q.l,s:q.s,ltr:q.ltr,dur:q.dur};
    st.dur=q.dur;hs.dl=Date.now()+q.dur*1000;
    hs.tm=setTimeout(endQ,q.dur*1000);
    // computer players decide their answer and when to give it
    st.pl.forEach((p,i)=>{
      if(!p.cpu||p.out)return;
      let pr=CPU_P[p.cpu]+(q.l===1?.1:q.l===3?-.12:0);pr=Math.min(.95,Math.max(.2,pr));
      const right=Math.random()<pr;
      const ch=right?q.a:pick([0,1,2,3].filter(x=>x!==q.a));
      const [lo,hi]=CPU_T[p.cpu];const secs=R(lo*10,hi*10)/10*(q.dur/25);
      hs.cpuT.push(setTimeout(()=>answer(i,ch),secs*1000));
    });
    broadcast();
  }
  function answer(i,c){
    if(st.ph!=='q'||hs.ans[i]||!st.pl[i]||st.pl[i].out||st.pl[i].gone||!(c>=0&&c<4))return;
    hs.ans[i]={c:c|0,t:Date.now()-hs.qStart};st.ans[i]=true;
    if(active().every(k=>hs.ans[k])){clearTimeout(hs.tm);endQ();return}
    broadcast();
  }
  function endQ(){
    if(st.ph!=='q')return;
    clearT();
    const ci=hs.qa,ch=[],tm=[];
    st.pl.forEach((p,i)=>{const a=hs.ans[i];ch[i]=a?a.c:-1;tm[i]=a?+(a.t/1000).toFixed(1):-1;if(a&&a.c===ci&&!p.out)p.ok++});
    const el=alive().filter(i=>!st.pl[i].gone&&ch[i]===ci&&valid(i).length).sort((a,b)=>tm[a]-tm[b]);
    st.rv={ci,ch,tm,log:[],s:st.q.s||''};
    if(!el.length){st.cl=null;finishRound();return}
    st.cl={el,dn:[]};hs.claims={};st.ph='claim';st.dur=CLAIM_SEC;hs.dl=Date.now()+CLAIM_SEC*1000;
    hs.tm=setTimeout(resolve,CLAIM_SEC*1000);
    el.forEach(i=>{ if(st.pl[i].cpu) hs.cpuT.push(setTimeout(()=>claim(i,cpuTarget(i)),R(1500,5000))) });
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
    st.ph='rev';
    const secs=REV_BASE+Math.min(5,(st.rv.log.length)*.8);
    st.dur=secs;hs.dl=Date.now()+secs*1000;
    hs.tm=setTimeout(nextQ,secs*1000);
    broadcast();
  }
  function ranking(){
    return st.pl.map((p,i)=>({i,t:tilesOf(i).length,ok:p.ok,out:p.out})).sort((a,b)=>(b.t-a.t)||(b.ok-a.ok));
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
    st.pl=st.pl.filter(p=>!p.cpu||true).map(p=>({...p,out:0,gone:0,ok:0,cs:''}));
    syncRoster();
  }
  function peerLeft(id){
    const i=st.pl.findIndex(p=>p.id===id&&!p.cpu);
    if(i<0)return;
    if(st.ph==='lobby'){syncRoster();return}
    st.pl[i].gone=1;
    if(st.ph==='q'&&active().every(k=>hs.ans[k])&&active().length){clearTimeout(hs.tm);endQ();return}
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
  }
  function stop(){clearT();clearInterval(hs.hb)}
  hs.hb=setInterval(()=>{ if(st.ph!=='over'||true)broadcast() },4000);
  return {st,syncRoster,addCpu,removeCpu,setOpt,start,again,onMsg,peerLeft,stop,answer,claim,broadcast,valid};
}
