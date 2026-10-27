import sys,math; sys.path.insert(0,sys.argv[1])
from bossedit import *
rep={x['boss']:x for x in json.load(open(sys.argv[2]))}
CAP=float(sys.argv[3]); K=float(sys.argv[4]) if len(sys.argv)>4 else 2.5
T={'shallow':0.80,'middle':0.75,'deep':0.70,'abyss':0.65}
lines,idx=load(); out=[]
for b in bosses():
    o=get(lines,idx,b); r=rep[b]
    m=1+o.get('offense',{}).get('all',0)
    nm=max(1,min(CAP,m*math.exp(K*(r['win']-T[r['layer']]))))
    o.pop('offense',None)
    if nm>1.001: o['offense']={'all':round(nm-1,2)}
    put(lines,idx,reorder(o)); out.append(nm)
save(lines); print('mult %.2f-%.2f capped %d floor %d'%(min(out),max(out),sum(x>=CAP for x in out),sum(x<=1 for x in out)))
