import sys,math; sys.path.insert(0,sys.argv[1])
from bossedit import *
rep={x['boss']:x for x in json.load(open(sys.argv[2]))}
CAP=float(sys.argv[3]); K=float(sys.argv[4]); ap0=json.load(open(sys.argv[1]+'/boss_ap0.json'))
T={'shallow':0.80,'middle':0.75,'deep':0.70,'abyss':0.65}
lines,idx=load(); out=[]; apx=0
for b in bosses():
    o=get(lines,idx,b); r=rep[b]; t=T[r['layer']]
    m=1+o.get('offense',{}).get('all',0)
    err=r['win']-t
    if abs(err)<=0.05: out.append(m); continue
    nm=max(1,min(CAP,m*math.exp(K*err)))
    if nm>=CAP and m>=CAP and err>0.08 and o['ap']<ap0[b]+2: o['ap']+=1; apx+=1
    if err<-0.15 and o['ap']>ap0[b] and m<=1.5: o['ap']-=1
    o.pop('offense',None)
    if nm>1.001: o['offense']={'all':round(nm-1,2)}
    put(lines,idx,reorder(o)); out.append(nm)
save(lines); print('mult %.2f-%.2f capped %d, +ap %d'%(min(out),max(out),sum(x>=CAP for x in out),apx))
