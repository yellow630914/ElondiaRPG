import sys; sys.path.insert(0,sys.argv[1])
from bossedit import *
ULT={'slashing':'frenzy_flurry','piercing':'frenzy_flurry','bludgeoning':'earthshatter','fire':'world_pyre','cold':'eternal_frost','lightning':'thunder_judgement','thunder':'sky_roar','poison':'venom_burst','acid':'acid_deluge','necrotic':'dirge_of_the_dead','radiant':'heavens_wrath','force':'arcane_collapse','psychic':'mind_shatter'}
lines,idx=load()
# 先確認格式一致
for id_ in list(idx)[:50]:
    i=idx[id_][0]; o=get(lines,idx,id_); assert lines[i].strip().rstrip(',')==json.dumps(o,ensure_ascii=False),id_
import collections; c=collections.Counter()
for b in bosses():
    o=get(lines,idx,b); u=ULT[o['weapon']['type']]
    o['abilities']=[a for a in o.get('abilities',[]) if a!=u]+[u]
    o['ability_hp_below']={u:40}
    put(lines,idx,reorder(o)); c[u]+=1
save(lines); print(c)
