'use strict';
const BANK=__BANK__;
const GEO=__GEO__;
const $=s=>document.querySelector(s);
const CAT={soil:'تربة',concrete:'خرسانة',asphalt:'أسفلت',aggregate:'ركام',labcalc:'حسابات المعمل',history:'تاريخ',arts:'فن وثقافة',geography:'جغرافيا',science:'علوم',sports:'رياضة',math:'حساب'};
const LABC=['soil','concrete','asphalt','aggregate','labcalc'], GENC=['history','arts','geography','science','sports','math'];
const LET=['أ','ب','ج','د'];
const LVL=['','سهل','متوسط','صعب'];
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* ---------- random helpers ---------- */
const R=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const RF=(a,b,d)=>+(a+Math.random()*(b-a)).toFixed(d);
const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=R(0,i);[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=a=>a[R(0,a.length-1)];

/* Build 4 numeric options: the correct value plus 3 distinct wrong ones that mimic common mistakes. */
function mk(c,dec,wrongs,unit,o={}){
  const f=v=>v.toFixed(dec), seen=new Set([f(c)]), w=[];
  const min=o.min==null?0:o.min;
  for(const v of wrongs){ if(Number.isFinite(v)&&v>=min){const s=f(v); if(!seen.has(s)){seen.add(s);w.push(v)}} }
  const step=Math.max(Math.pow(10,-dec),Math.abs(c)*0.06);
  let k=1;
  while(w.length<3&&k<40){ for(const sg of [1,-1]){ const v=+(c+sg*k*step).toFixed(dec); const s=f(v); if(w.length<3&&v>=min&&!seen.has(s)){seen.add(s);w.push(v)} } k++; }
  const all=shuf([c,...w.slice(0,3)]);
  return {o:all.map(v=>f(v)+(unit?' '+unit:'')), a:all.indexOf(c), ltr:true};
}

/* ---------- lab calculation generators (numbers change every round) ---------- */
const LABGEN=[
 ()=>{const tin=RF(18,45,1),dry=R(80,260),w=RF(6,32,1),ww=+(dry*w/100).toFixed(1);
   const M1=tin,M3=+(tin+dry).toFixed(1),M2=+(tin+dry+ww).toFixed(1);
   const c=(M2-M3)/(M3-M1)*100;
   return {l:2,q:`عينة تربة في وعاء: كتلة الوعاء ${M1} جم، والوعاء مع التربة الرطبة ${M2} جم، والوعاء مع التربة بعد التجفيف في الفرن ${M3} جم. ما نسبة الرطوبة بالوزن؟`,
     ...mk(+c.toFixed(1),1,[(M2-M3)/(M2-M1)*100,(M2-M3)/M3*100,(M3-M1)/(M2-M1)*100],'%')}},
 ()=>{const g=RF(1.75,2.3,2),w=R(5,25);
   const c=g/(1+w/100);
   return {l:2,q:`الكثافة الرطبة لتربة مدموكة ${g} جم/سم³ ونسبة رطوبتها ${w}%. ما الكثافة الجافة؟`,
     ...mk(+c.toFixed(2),2,[g*(1-w/100),g/(1-w/100),g*(1+w/100),g-w/100],'g/cm³')}},
 ()=>{const m=R(1700,2100),V=944,c=m/V;
   return {l:1,q:`في اختبار Proctor القياسي، كتلة التربة الرطبة داخل القالب ${m} جم وحجم القالب ${V} سم³. ما الكثافة الرطبة؟`,
     ...mk(+c.toFixed(2),2,[m/1000,V/m,m/(V*1.1),m/(V*0.9)],'g/cm³')}},
 ()=>{const LL=R(28,72),PL=R(12,LL-8),c=LL-PL;
   return {l:1,q:`حد السيولة LL لتربة = ${LL}% وحد اللدونة PL = ${PL}%. ما معامل اللدونة PI؟`,
     ...mk(c,0,[LL+PL,Math.round(LL/PL),PL-LL+LL/2,LL-PL+5,LL-PL-4],'%')}},
 ()=>{const P=R(420,1000),c=P/22.5;
   return {l:1,q:`مكعب خرسانة 150×150×150 مم انكسر تحت حمل ${P} kN. ما مقاومة الانضغاط؟`,
     ...mk(+c.toFixed(1),1,[P/2.25,P/225,P*1000/17671,P/45],'MPa')}},
 ()=>{const P=R(320,720),c=P*1000/(Math.PI*75*75);
   return {l:2,q:`أسطوانة خرسانة قياسية قطرها 150 مم وارتفاعها 300 مم انكسرت تحت حمل ${P} kN. ما مقاومة الانضغاط؟`,
     ...mk(+c.toFixed(1),1,[P*1000/22500,P*1000/(Math.PI*150*150),P/45,P*1000/(Math.PI*75*300)],'MPa')}},
 ()=>{const cem=R(60,90)*5,w=R(140,210),c=w/cem;
   return {l:1,q:`خلطة خرسانة تحتوي على ${cem} كجم أسمنت و${w} كجم ماء لكل متر مكعب. ما نسبة الماء إلى الأسمنت؟`,
     ...mk(+c.toFixed(2),2,[cem/w,w/(cem+w),(w+cem)/cem,w/(cem*1.1)],'')}},
 ()=>{let r=[R(2,9)];r.push(r[0]+R(8,16));r.push(r[1]+R(14,22));r.push(r[2]+R(14,22));r.push(r[3]+R(14,24));r.push(Math.min(99,r[4]+R(6,12)));
   const s=r.reduce((a,b)=>a+b,0),c=s/100;
   return {l:3,q:`نسب المحجوز التراكمي (%) لركام ناعم على مناخل 4.75 و2.36 و1.18 و0.60 و0.30 و0.15 مم هي على الترتيب: ${r.join('، ')}. ما معامل النعومة FM؟`,
     ...mk(+c.toFixed(2),2,[s/6,(600-s)/100,s/100+1,s/100-0.5,s/10],'')}},
 ()=>{const gmm=RF(2.42,2.56,3),va=RF(3,7.5,1),gmb=+(gmm*(1-va/100)).toFixed(3),c=(1-gmb/gmm)*100;
   return {l:3,q:`خلطة أسفلتية: الكثافة النوعية الكلية Gmb = ${gmb.toFixed(3)} والكثافة النوعية القصوى النظرية Gmm = ${gmm.toFixed(3)}. ما نسبة الفراغات الهوائية Va؟`,
     ...mk(+c.toFixed(1),1,[(gmm-gmb)/gmb*100,gmb/gmm*100,(gmm-gmb)*100,100-c-2],'%')}},
 ()=>{const B=R(3350,4200),c=(5000-B)/50;
   return {l:1,q:`في اختبار Los Angeles كانت الكتلة الأصلية 5000 جم، وبعد الاختبار تبقى على المنخل 1.70 مم (No.12) ${B} جم. ما نسبة الفقد بالتآكل؟`,
     ...mk(+c.toFixed(1),1,[B/50,(5000-B)/B*100,(5000-B)/100,c*1.25],'%')}},
 ()=>{const T=R(8,15)*100,Rr=Math.round(T*RF(0.15,0.6,2)),c=(T-Rr)/T*100;
   return {l:1,q:`عينة ركام كتلتها الكلية ${T} جم، والمحجوز التراكمي على منخل معين ${Rr} جم. ما نسبة المار من المنخل؟`,
     ...mk(+c.toFixed(1),1,[Rr/T*100,(T-Rr)/Rr*100,(T-Rr)/10,Rr/10],'%')}},
 ()=>{const b=R(58,92),a=R(1100,1200),c=b/(a+b)*100;
   return {l:2,q:`خلطة أسفلتية تحتوي على ${a} جم ركام و${b} جم بيتومين. ما نسبة البيتومين من وزن الخلطة الكلي؟`,
     ...mk(+c.toFixed(1),1,[b/a*100,a/(a+b)*100,b/(a+b)*10,(b/a*100+c)/2],'%')}},
 ()=>{const rs=RF(1.35,1.65,2),Ms=R(17,32)*100,V=Ms/rs,den=RF(1.8,2.2,2),W=Math.round(den*V),c=W/V;
   return {l:3,q:`في اختبار مخروط الرمل: كتلة الرمل المالئ للحفرة ${Ms} جم وكثافة الرمل ${rs} جم/سم³، وكتلة التربة المحفورة الرطبة ${W} جم. ما الكثافة الرطبة للتربة في الموقع؟`,
     ...mk(+c.toFixed(2),2,[W/Ms,W*Ms/rs/1000,rs*Ms/W,W/(V*1.1)],'g/cm³')}},
 ()=>{let gd,gm;do{gd=RF(1.72,1.98,2);gm=RF(1.85,2.06,2)}while(gd/gm<0.88||gd/gm>1.02);
   const c=gd/gm*100;
   return {l:2,q:`الكثافة الجافة في الموقع ${gd} جم/سم³ والكثافة الجافة العظمى من اختبار Proctor ${gm} جم/سم³. ما نسبة الدمك؟`,
     ...mk(+c.toFixed(1),1,[gm/gd*100,(gm-gd)/gm*100,gd/gm*10,c+3],'%')}},
 ()=>{const vol=R(740,820),sg=RF(2.55,2.75,2),A=Math.round(sg*vol),B=Math.round(A*(1+RF(0.005,0.03,3))),C=B-vol,c=A/(B-C);
   return {l:3,q:`ركام خشن: الكتلة الجافة بالفرن في الهواء A = ${A} جم، والمشبعة جافة السطح SSD في الهواء B = ${B} جم، وتحت الماء C = ${C} جم. ما الوزن النوعي الكلي (Bulk SG) على أساس الجاف؟`,
     ...mk(+c.toFixed(2),2,[A/(A-C),B/(B-C),c*1.03,c*0.97],'')}},
 ()=>{const vol=R(740,820),sg=RF(2.55,2.75,2),A=Math.round(sg*vol),B=Math.round(A*(1+RF(0.006,0.03,3))),c=(B-A)/A*100;
   return {l:2,q:`ركام خشن: الكتلة الجافة بالفرن ${A} جم والكتلة المشبعة جافة السطح ${B} جم. ما نسبة الامتصاص؟`,
     ...mk(+c.toFixed(2),2,[(B-A)/B*100,(B-A)/10,c*2,A/B*100-98],'%')}},
 ()=>{const P=[R(480,780),R(480,780),R(480,780)],c=(P[0]+P[1]+P[2])/3/22.5;
   return {l:2,q:`كُسرت ثلاثة مكعبات 150 مم عند 28 يومًا بأحمال ${P.join(' و')} kN. ما متوسط مقاومة الانضغاط؟`,
     ...mk(+c.toFixed(1),1,[(P[0]+P[1]+P[2])/22.5,Math.max(...P)/22.5,Math.min(...P)/22.5,c*1.1],'MPa')}},
];

/* ---------- general maths generators ---------- */
const MATHGEN=[
 ()=>{const a=R(12,19),b=R(3,9);return {l:1,q:`كم ناتج ${a} × ${b}؟`,...mk(a*b,0,[a*b+10,a*b-a,a*b+b,(a+b)*b])}},
 ()=>{const a=R(120,480),b=R(120,480),c=R(30,190),s=a+b+c;return {l:1,q:`كم ناتج ${a} + ${b} + ${c}؟`,...mk(s,0,[s+10,s-10,s+100,s-100])}},
 ()=>{const n=pick([80,120,200,240,360,400,520]),p=pick([10,20,25,50]),c=n*p/100;return {l:1,q:`كم يساوي ${p}% من ${n}؟`,...mk(c,0,[n*p/10,n/p,c+10,c-5])}},
 ()=>{const a=R(13,29),b=R(11,19),c=a*b;return {l:2,q:`كم ناتج ${a} × ${b}؟`,...mk(c,0,[c+a,c-b,c+10,(a+b)*10+a])}},
 ()=>{const x=R(4,19),a=R(2,6),b=R(3,15),r=a*x+b;return {l:2,q:`إذا كان ${a}س + ${b} = ${r} فكم قيمة س؟`,...mk(x,0,[(r-b),(r+b)/a,x+1,x-1,x+2],'',{min:0})}},
 ()=>{const r=R(3,12),c=3.14*r*r;return {l:2,q:`مساحة دائرة نصف قطرها ${r} سم، باعتبار π = 3.14؟`,...mk(+c.toFixed(2),2,[3.14*2*r,3.14*r,r*r*3,3.14*r*r*2],'cm²')}},
 ()=>{const v=R(4,12)*10,t=pick([1.5,2.5,3,4,0.5]),c=v*t;return {l:2,q:`سيارة تسير بسرعة ${v} كم/س لمدة ${t} ساعة. كم المسافة بالكيلومتر؟`,...mk(+c.toFixed(1),1,[v+t,v/t,c+v,c-v],'km')}},
 ()=>{const n=R(2,6)*40,c=n*3/4;return {l:2,q:`كم يساوي ثلاثة أرباع ${n}؟`,...mk(c,0,[n/4,n*3/8,n*4/3,c+n/8])}},
 ()=>{const v=R(2,12)*9,c=v*5/18;return {l:3,q:`حوّل ${v} كم/س إلى متر/ث.`,...mk(+c.toFixed(1),1,[v*18/5,v/3.6/2,v/10,v*3.6/2],'m/s')}},
 ()=>{const a=pick([15,25,35,45,55,65,75,85]),c=a*a;return {l:3,q:`كم ناتج ${a}²؟`,...mk(c,0,[a*2,c+a,c-a,(a+5)*(a-5)+50])}},
 ()=>{const p=pick([10,20,25,30]),n=pick([200,400,500,1000]),c=n*(1+p/100)*(1-p/100);return {l:3,q:`مبلغ ${n} جنيه زاد ${p}% ثم نقص ${p}% من الناتج. كم أصبح المبلغ؟`,...mk(+c.toFixed(1),1,[n,n*(1+p/100),n*(1-p/100),n*(1-2*p/100)])}},
 ()=>{const k=R(6,36),c=k*k;return {l:3,q:`ما الجذر التربيعي لـ ${c}؟`,...mk(k,0,[k+1,k-1,k*2,c/k+2])}},
];

/* ---------- static bank index ---------- */
const BYCAT={};
BANK.forEach((q,i)=>{(BYCAT[q.c]=BYCAT[q.c]||[]).push(i)});

function genQuestion(cat){
  const g=(cat==='labcalc'?LABGEN:MATHGEN);
  const x=pick(g)();
  return {k:cat,c:CAT[cat],t:x.q,o:x.o,a:x.a,l:x.l,s:'',ltr:!!x.ltr,dur:40};
}
