import sys; sys.path.insert(0,sys.argv[1])
from bossedit import *
rep=json.load(open(sys.argv[2])); CAP=float(sys.argv[3])
lines,idx=load(); out=[]
for r in rep:
    o=get(lines,idx,r['id']); m=1+o.get('offense',{}).get('all',0)
    loss=max(0.005,1-r['hpLeft'])
    if 0.10<=loss<=0.15: out.append(m); continue
    nm=max(1,min(CAP,m*(0.125/loss)**0.7))
    o.pop('offense',None)
    if nm>1.001: o['offense']={'all':round(nm-1,2)}
    put(lines,idx,reorder(o)); out.append(nm)
save(lines); print('mult %.2f-%.2f capped %d'%(min(out),max(out),sum(x>=CAP for x in out)))
