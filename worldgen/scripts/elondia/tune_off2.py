import sys; sys.path.insert(0,sys.argv[1])
from bossedit import *
rep={x['boss']:x for x in json.load(open(sys.argv[2]))}
CAP=float(sys.argv[3]) if len(sys.argv)>3 else 4
lines,idx=load(); out=[]
for b in bosses():
    o=get(lines,idx,b); r=rep[b]
    m=1+o.get('offense',{}).get('all',0)
    # 目標：所有場次平均剩 45%（勝率約九成、贏的時候剩一半）
    d=max(0.05,1-r['hpAll'])
    nm=max(1,min(CAP,m*(0.55/d)**0.6))
    o.pop('offense',None)
    if nm>1.001: o['offense']={'all':round(nm-1,2)}
    put(lines,idx,reorder(o)); out.append(round(nm,2))
save(lines); print(min(out),max(out),sum(1 for x in out if x>=CAP))
