import json, math, itertools, sys

P = {
 'n0':(25.15,31.57),'n1':(29.10,30.95),'n2':(30.10,31.32),'n3':(30.42,31.48),'n4':(31.48,31.55),
 'n5':(31.78,31.47),'n6':(32.00,31.40),'n7':(32.33,31.27),'n8':(33.30,31.08),'n9':(33.85,31.12),'n10':(34.22,31.30),
 's1':(34.27,31.22),'s2':(34.50,30.45),'s3':(34.89,29.50),
 'q1':(34.65,29.03),'q2':(34.45,28.45),'q3':(34.33,27.92),'q4':(34.25,27.73),
 'g1':(33.65,28.22),'g2':(33.10,28.95),'g3':(32.70,29.62),
 'ssw':(32.64,29.78),'ssm':(33.60,29.85),
 'k1':(32.33,30.85),'k2':(32.30,30.55),'k3':(32.40,30.25),'k4':(32.56,29.97),'p1':(32.33,31.02),
 'm1':(32.35,29.60),'rsB':(32.50,29.30),'rs2':(32.65,29.12),'rs3':(33.10,28.35),'rs4':(33.78,27.25),
 'rs5':(33.95,26.70),'rs6':(34.28,26.10),'rs7':(34.90,25.07),'rs8':(35.45,23.95),'rs9':(36.25,22.65),
 'sb1':(36.90,22.00),'sbw':(25.00,22.00),'mw':(25.00,28.40),
 'ab1':(30.05,30.90),'ab2':(29.20,30.55),'mB':(29.35,29.90),'mG':(28.60,28.40),
 'd1':(30.62,31.15),'d2':(30.78,30.95),'d5':(30.80,30.62),'d6':(30.62,30.38),'d7':(30.30,30.20),'bz':(29.80,29.98),
 'd8':(31.05,31.00),'d9':(31.05,30.68),
 'e1':(31.43,31.22),'e2':(31.30,31.00),'e3':(31.30,30.78),
 'f1':(31.22,30.45),'f2':(31.13,30.20),'fg':(30.90,30.22),
 'h1':(31.72,31.15),'h2':(32.00,31.18),'h3':(32.15,31.00),'a1':(31.95,30.88),'a2':(31.55,30.75),
 'p2':(32.05,30.80),'p3':(32.05,30.45),'p4':(32.00,30.12),
 'qc':(31.55,30.45),'qd':(31.50,30.15),'qe':(31.28,30.08),
 'gc':(31.24,29.95),'c4':(31.28,29.70),'c3':(31.75,29.65),'c2':(32.10,29.62),'su1':(32.28,30.10),'su2':(32.22,29.85),
 'rw1':(32.10,29.35),'rw2':(32.05,28.90),
 'gs':(31.30,29.48),'fy1':(30.95,29.55),'fy3':(30.40,29.55),'fy4':(31.10,29.35),'fy5':(31.05,28.95),'fy6':(30.40,29.05),
 'mb1':(31.50,28.70),'mb2':(30.95,28.72),'gz1':(30.55,28.75),'gz2':(29.80,28.40),
 'nvA':(29.80,28.00),'maw':(30.15,27.60),'mae':(32.00,27.70),
 'asw_':(30.60,26.75),'ase':(32.30,26.85),'sow':(31.20,26.35),'soe':(32.80,26.35),
 'qlw':(31.90,25.85),'qle':(33.10,25.90),'law':(31.90,25.15),'lae':(33.05,25.20),
 'ra':(34.00,24.20),'rb':(34.80,22.00),'aw':(30.40,22.00),'aw1':(31.50,24.20),
}
POLY = {
 'mat':['n0','n1','ab2','mB','mG','mw'],
 'alx':['n1','n2','ab1','ab2'],
 'beh':['n2','n3','d1','d2','d5','d6','d7','bz','mB','ab2','ab1'],
 'kfs':['n3','n4','e1','e2','d8','d2','d1'],
 'gha':['d2','d8','e2','e3','d9','d5'],
 'mnf':['d5','d9','e3','f1','f2','fg','d6'],
 'dak':['n4','n5','h1','h2','h3','a1','a2','e3','e2','e1'],
 'dam':['n5','n6','h2','h1'],
 'pso':['n6','n7','p1','h3','h2'],
 'shq':['a2','a1','h3','p1','p2','p3','p4','qd','qc'],
 'qal':['f1','e3','a2','qc','qd','qe','f2'],
 'ism':['p1','k1','k2','k3','su1','p4','p3','p2'],
 'cai':['qe','qd','p4','su1','su2','c2','c3','c4','gc'],
 'suz':['su1','k3','k4','m1','rsB','rw1','c2','su2'],
 'giz':['fg','f2','qe','gc','c4','gs','fy1','fy3','fy6','gz1','gz2','mG','mB','bz','d7','d6'],
 'fay':['fy3','fy1','fy4','fy5','fy6'],
 'bsf':['c4','c3','c2','rw1','rw2','mb1','mb2','fy5','fy4','fy1','gs'],
 'mny':['rw2','mb1','mb2','fy5','fy6','gz1','gz2','nvA','maw','mae'],
 'asy':['maw','mae','ase','asw_'],
 'soh':['asw_','ase','soe','sow'],
 'qen':['sow','soe','qle','qlw'],
 'lux':['qlw','qle','lae','law'],
 'asw':['law','lae','ra','rb','aw','aw1'],
 'red':['rsB','rw1','rw2','mae','ase','soe','qle','lae','ra','rb','sb1','rs9','rs8','rs7','rs6','rs5','rs4','rs3','rs2'],
 'nvl':['mw','mG','gz2','nvA','maw','asw_','sow','qlw','law','aw1','aw','sbw'],
 'nsi':['n7','n8','n9','n10','s1','s2','s3','ssm','ssw','k4','k3','k2','k1','p1'],
 'ssi':['ssw','ssm','s3','q1','q2','q3','q4','g1','g2','g3'],
}
NAMES = {'mat':'مطروح','alx':'الإسكندرية','beh':'البحيرة','kfs':'كفر الشيخ','gha':'الغربية','mnf':'المنوفية','dak':'الدقهلية',
 'dam':'دمياط','pso':'بورسعيد','shq':'الشرقية','qal':'القليوبية','ism':'الإسماعيلية','cai':'القاهرة','suz':'السويس','giz':'الجيزة',
 'fay':'الفيوم','bsf':'بني سويف','mny':'المنيا','asy':'أسيوط','soh':'سوهاج','qen':'قنا','lux':'الأقصر','asw':'أسوان',
 'red':'البحر الأحمر','nvl':'الوادي الجديد','nsi':'شمال سيناء','ssi':'جنوب سيناء'}
EXTRA_ADJ = [('suz','ssi'),('dak','pso')]
OUTLINE = ['n0','n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','s1','s2','s3','q1','q2','q3','q4','g1','g2','g3','ssw','k4','m1','rsB','rs2','rs3','rs4','rs5','rs6','rs7','rs8','rs9','sb1','sbw','mw']

def pts(names): return [P[n] for n in names]
def area(poly):
    s=0
    for i in range(len(poly)):
        x1,y1=poly[i];x2,y2=poly[(i+1)%len(poly)]
        s+=x1*y2-x2*y1
    return s/2
def centroid(poly):
    a=area(poly);cx=cy=0
    for i in range(len(poly)):
        x1,y1=poly[i];x2,y2=poly[(i+1)%len(poly)]
        f=x1*y2-x2*y1;cx+=(x1+x2)*f;cy+=(y1+y2)*f
    return cx/(6*a),cy/(6*a)
def inside(pt,poly):
    x,y=pt;c=False
    for i in range(len(poly)):
        x1,y1=poly[i];x2,y2=poly[(i+1)%len(poly)]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1)+x1: c=not c
    return c
def segint(a,b,c,d):
    def o(p,q,r): return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    return o(a,b,c)*o(a,b,d)<0 and o(c,d,a)*o(c,d,b)<0
def selfint(poly):
    n=len(poly);bad=[]
    for i in range(n):
        for j in range(i+2,n):
            if i==0 and j==n-1: continue
            if segint(poly[i],poly[(i+1)%n],poly[j],poly[(j+1)%n]): bad.append((i,j))
    return bad

if __name__=='__main__':
    missing=[n for ids in POLY.values() for n in ids if n not in P]
    print('missing pts',missing)
    print('count',len(POLY))
    for k,v in POLY.items():
        pl=pts(v);b=selfint(pl)
        if b: print('SELF-INTERSECT',k,b)
    # coverage
    out=pts(OUTLINE);print('outline selfint',selfint(out))
    gaps=[];ovl=[];tot=0
    lon=24.9
    while lon<36.9:
        lat=22.05
        while lat<31.5:
            pt=(lon,lat)
            if inside(pt,out):
                tot+=1
                c=[k for k,v in POLY.items() if inside(pt,pts(v))]
                if len(c)==0: gaps.append(pt)
                if len(c)>1: ovl.append((pt,c))
            lat+=0.05
        lon+=0.05
    print('samples',tot,'gaps',len(gaps),'overlaps',len(ovl))
    print('gap sample',gaps[:12]);print('ovl sample',ovl[:12])
    # adjacency from shared edges
    edges={}
    for k,v in POLY.items():
        for i in range(len(v)):
            e=frozenset((v[i],v[(i+1)%len(v)]));edges.setdefault(e,[]).append(k)
    adj={k:set() for k in POLY}
    for e,ks in edges.items():
        if len(ks)>=2:
            for a,b in itertools.combinations(ks,2): adj[a].add(b);adj[b].add(a)
    for a,b in EXTRA_ADJ: adj[a].add(b);adj[b].add(a)
    # connected?
    seen={'cai'};st=['cai']
    while st:
        x=st.pop()
        for y in adj[x]:
            if y not in seen: seen.add(y);st.append(y)
    print('connected',len(seen)==len(POLY),set(POLY)-seen)
    for k in POLY: print(k,NAMES[k],sorted(adj[k]))
    # project
    X0,Y0,SX,SY=24.7,31.8,53.5,60.0
    pr=lambda p:((p[0]-X0)*SX,(Y0-p[1])*SY)
    W=(36.95-X0)*SX;H=(Y0-21.9)*SY
    G={'w':round(W,1),'h':round(H,1),'t':{}}
    for k,v in POLY.items():
        pl=[pr(p) for p in pts(v)]
        d='M'+'L'.join('%.1f %.1f'%p for p in pl)+'Z'
        cx,cy=centroid(pl)
        xs=[p[0] for p in pl];ys=[p[1] for p in pl]
        G['t'][k]={'n':NAMES[k],'d':d,'c':[round(cx,1),round(cy,1)],'bb':[round(min(xs),1),round(min(ys),1),round(max(xs)-min(xs),1),round(max(ys)-min(ys),1)],'adj':sorted(adj[k]),'a':round(abs(area(pl)))}
    G['sea']='M'+'L'.join('%.1f %.1f'%pr(p) for p in out)+'Z'
    G['ids']=list(POLY.keys())
    import os
    json.dump(G,open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','geo.json'),'w'),ensure_ascii=False,separators=(',',':'))
    print('geo bytes',len(json.dumps(G)))
