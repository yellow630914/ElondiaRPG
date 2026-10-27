import sys; sys.path.insert(0,sys.argv[1])
from bossedit import *
rep={x['boss']:x for x in json.load(open(sys.argv[2]))}
lines,idx=load(); out=[]
for b in bosses():
    o=get(lines,idx,b); r=rep[b]
    m=1+o.get('offense',{}).get('all',0)
    d=max(0.03,1-r['hpLeft']) if r['win']>0 else 1
    if r['win']<0.85: nm=m*0.85
    else: nm=m*(0.5/d)**0.8
    nm=max(1,min(8,nm))
    o.pop('offense',None)
    if nm>1.001: o['offense']={'all':round(nm-1,2)}
    put(lines,idx,reorder(o)); out.append(round(nm,2))
save(lines); print(min(out),max(out))
