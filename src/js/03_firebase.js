/* ================= ONLINE ROOMS over Firebase Realtime Database (REST + server-sent events, no SDK) =================
   Exposes the same small interface the game uses for rooms: join(name) -> { emit, on, presence, peers, onPeers, leave }.
   Layout in the database:   rooms/<name>/peers/<id>  {nm, role, t, hb}     heartbeat every 3 s
                              rooms/<name>/state       JSON string {by, d}      written by the room owner
                              rooms/<name>/c2h/<key>   JSON string {p, d}      messages from players to the owner
   State and messages are stored as JSON strings because Realtime Database drops empty arrays and objects. */
function makeFbRoom(dbUrl){
  dbUrl=String(dbUrl).replace(/\/+$/,'');
  const uid=()=>Math.random().toString(36).slice(2,10);
  return {async join(name){
    const base=`${dbUrl}/rooms/${name}`, me=uid();
    let tree={},ready=false,closed=false,es=null,hbT=null,pollT=null,lastRaw=null,lastState=null;
    const pres={},handlers={},peerHs=[],seenC=new Set(),seenAt=new Map();
    let prev=new Map();

    const req=(method,path,body,keep)=>fetch(`${base}${path}.json`,{method,body:body===undefined?undefined:JSON.stringify(body),keepalive:!!keep}).catch(()=>{});

    function setPath(path,data,merge){
      const parts=path.split('/').filter(Boolean);
      if(!parts.length){
        if(merge&&data&&typeof data==='object'){tree=tree&&typeof tree==='object'?tree:{};for(const k in data){if(data[k]===null)delete tree[k];else tree[k]=data[k]}}
        else tree=data&&typeof data==='object'?data:{};
        return;
      }
      let o=tree;
      for(let i=0;i<parts.length-1;i++){if(!o[parts[i]]||typeof o[parts[i]]!=='object')o[parts[i]]={};o=o[parts[i]]}
      const k=parts[parts.length-1];
      if(merge&&data&&typeof data==='object'){o[k]=o[k]&&typeof o[k]==='object'?o[k]:{};for(const kk in data){if(data[kk]===null)delete o[k][kk];else o[k][kk]=data[kk]}}
      else if(data===null)delete o[k];else o[k]=data;
    }
    const mk=(id,presence,at)=>Object.freeze({peer:id,by:null,isMe:id===me,sameTab:id===me,kind:'viewer',guest:false,presence:Object.freeze({...presence}),updatedAt:at});
    function computePeers(){
      const now=Date.now(),out=[],p=(tree&&tree.peers)||{};
      for(const id in p){
        const v=p[id];if(!v||typeof v!=='object'||id===me)continue;
        let s=seenAt.get(id);if(!s||s.hb!==v.hb){s={hb:v.hb,at:now};seenAt.set(id,s)}
        if(now-s.at>10000)continue;
        const {hb,...rest}=v;out.push(mk(id,rest,s.at));
      }
      if(Object.keys(pres).length)out.push(mk(me,pres,now));
      return out;
    }
    let curPeers=[];
    function refreshPeers(){
      const cur=computePeers(),map=new Map(cur.map(p=>[p.peer,JSON.stringify(p.presence)]));
      const joined=cur.filter(p=>!prev.has(p.peer)),updated=cur.filter(p=>prev.has(p.peer)&&prev.get(p.peer)!==map.get(p.peer));
      const left=[...prev.keys()].filter(id=>!map.has(id)).map(id=>curPeers.find(p=>p.peer===id)).filter(Boolean);
      curPeers=cur;prev=map;
      if(joined.length||updated.length||left.length)peerHs.forEach(f=>f({peers:cur,joined,left,updated}));
    }
    function deliver(topic,peer,data){(handlers[topic]||[]).forEach(f=>f({peer,by:null,isMe:peer===me,sameTab:peer===me,kind:'viewer',guest:false,topic,data}))}
    function changed(first){
      const s=tree&&tree.state;
      if(typeof s==='string'&&s!==lastRaw){lastRaw=s;try{lastState=JSON.parse(s);if(!first||true)deliver('h2c',lastState.by,lastState.d)}catch(_){}}
      const c=(tree&&tree.c2h)||{};
      for(const k in c){
        if(seenC.has(k))continue;seenC.add(k);
        if(first){continue}
        try{const v=JSON.parse(c[k]);deliver('c2h',v.p,v.d)}catch(_){}
        if(pres.role==='host')req('DELETE','/c2h/'+k);
      }
      refreshPeers();
    }

    await new Promise((res,rej)=>{
      let to=setTimeout(()=>{try{es.close()}catch(_){}rej(new Error('timeout'))},8000);
      es=new EventSource(`${base}.json`);
      const onData=e=>{
        let m;try{m=JSON.parse(e.data)}catch(_){return}
        if(!m)return;
        setPath(m.path||'/',m.data,e.type==='patch');
        const first=!ready;if(first){ready=true;clearTimeout(to);}
        changed(first);if(first)res();
      };
      es.addEventListener('put',onData);es.addEventListener('patch',onData);
      es.onerror=()=>{if(!ready){clearTimeout(to);try{es.close()}catch(_){}rej(new Error('net'))}};
    });
    pollT=setInterval(refreshPeers,1000);

    const pushPresence=()=>req('PUT','/peers/'+me,{...pres,hb:Date.now()});
    function bye(keep){
      if(closed)return;closed=true;
      clearInterval(hbT);clearInterval(pollT);try{es.close()}catch(_){}
      return pres.role==='host'?req('DELETE','',undefined,keep):req('DELETE','/peers/'+me,undefined,keep);
    }
    const onHide=()=>{bye(true)};
    addEventListener('pagehide',onHide);

    return {
      name,
      emit(topic,data){
        if(closed)return Promise.resolve();
        if(topic==='h2c')return req('PUT','/state',JSON.stringify({by:me,d:data}));
        return req('POST','/c2h',JSON.stringify({p:me,d:data}));
      },
      on(topic,f){
        (handlers[topic]=handlers[topic]||[]).push(f);
        if(topic==='h2c'&&lastState)setTimeout(()=>f({peer:lastState.by,by:null,isMe:lastState.by===me,sameTab:lastState.by===me,kind:'viewer',guest:false,topic,data:lastState.d}),0);
        return()=>{handlers[topic]=(handlers[topic]||[]).filter(x=>x!==f)};
      },
      presence(patch){
        for(const k in patch){if(patch[k]===null)delete pres[k];else pres[k]=patch[k]}
        if(!hbT)hbT=setInterval(pushPresence,3000);
        refreshPeers();
        return pushPresence().then(()=>{});
      },
      peers(){return curPeers.length?curPeers:computePeers()},
      onPeers(f){peerHs.push(f);setTimeout(()=>{const c=computePeers();f({peers:c,joined:c,left:[],updated:[]})},0);return()=>{const i=peerHs.indexOf(f);if(i>=0)peerHs.splice(i,1)}},
      connected(){return navigator.onLine!==false},
      onConnection(f){setTimeout(()=>f(navigator.onLine!==false),0);return()=>{}},
      leave(){removeEventListener('pagehide',onHide);bye(false);return Promise.resolve()},
    };
  }};
}
