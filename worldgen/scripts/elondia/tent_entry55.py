# 金帳的內帳（sm_td_inner_tent）：金帳地標的內部，只在有特殊任務的任務點在裡面時進得去（interior_story）。
# 之前只能從公會的任務點傳送進去：離開之後（例如天可汗的召見去了海東部再回來回報），或任務本身沒有傳送的（忽里勒台、
# 那達慕之約、不怕她的人），就再也進不去。可以重跑
import json
P = 'data/world/landmarks.json'
d = json.load(open(P))
L = d['landmarks'] if isinstance(d, dict) and 'landmarks' in d else d
items = L.values() if isinstance(L, dict) else L
for l in items:
    if isinstance(l, dict) and l.get('id') == 'lm_td_golden_tent':
        l['interior'] = 'sm_td_inner_tent'
        l['interior_story'] = True
open(P, 'w').write(json.dumps(d, ensure_ascii=False, indent=1))
print('ok')
