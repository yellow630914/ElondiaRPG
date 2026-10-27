import sys; sys.path.insert(0,sys.argv[1])
from bossedit import *
rep=json.load(open(sys.argv[2])); tgt=json.load(open(sys.argv[3]))
lines,idx=load(); up=down=0
for r in rep:
    o=get(lines,idx,r['id']); hp=o['hp']
    if r['boss']:
        t=tgt[r['id']]
        if abs(r['roundsToKill']-t)<=0.08: continue
        nh=round(hp*t/r['roundsToKill'])
    else:
        h=r['hitsToKill']
        if h>3.05: nh=round(hp*2.95/h)
        elif h<1.95: nh=round(hp*2.1/h)
        else: continue
    nh=max(1,nh)
    if nh!=hp:
        up+=nh>hp; down+=nh<hp
        o['hp']=nh; put(lines,idx,o)
save(lines); print('up',up,'down',down)
