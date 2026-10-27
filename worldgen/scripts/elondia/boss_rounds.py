import json,re,sys
rep=json.load(open(sys.argv[1]))
# 目標回合：依目前的「挨幾下」保留強弱，10 下 → 3 回合、15 下 → 4 回合
mode=sys.argv[2] if len(sys.argv)>2 else 'init'
targets=json.load(open(sys.argv[3])) if mode=='refine' else {}
p='data/rules/enemies.json'; lines=open(p).read().split('\n')
out={}
for r in rep:
    if not r['boss']: continue
    if mode=='init':
        t=3+max(0,min(1,(r['hitsToKill']-10)/5)); targets[r['id']]=round(t,2)
    t=targets[r['id']]
    out[r['id']]=max(1,round(r['hp']*t/r['roundsToKill']))
for i,l in enumerate(lines):
    m=re.match(r'\s*\{"id": "([^"]+)"',l)
    if m and m.group(1) in out:
        lines[i]=re.sub(r'"hp": \d+', f'"hp": {out[m.group(1)]}', l, count=1)
open(p,'w').write('\n'.join(lines))
if mode=='init': json.dump(targets,open(sys.argv[3],'w'))
print(len(out))
