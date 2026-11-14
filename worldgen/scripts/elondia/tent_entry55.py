# 有特殊任務點在裡面、卻只能靠任務傳送進去的特殊地圖：接到同一個聚落的地標當內部（interior），
# 只在有任務點在裡面時開放（interior_story）。之前離開之後就回不去，或任務本身沒有傳送進去的（宣德樓的公議、憲章、親政，
# 金帳的忽里勒台、那達慕之約、不怕她的人）就卡住了。可以重跑
import json
P = 'data/world/landmarks.json'
DOORS = {
    'lm_td_golden_tent': 'sm_td_inner_tent',   # 金帳王庭的金帳 → 金帳的內帳
    'lm_yh_xuande': 'sm_yh_xuande_tower',      # 龍安府的宣德樓 → 宣德樓的城樓
    'lm_yh_pearl_dock': 'sm_yh_chihuan_hold',  # 瑔州的珠船塢 → 赤鬟的走私船艙（泊在港外的海船）
}
d = json.load(open(P))
L = d['landmarks'] if isinstance(d, dict) and 'landmarks' in d else d
items = L.values() if isinstance(L, dict) else L
for l in items:
    if isinstance(l, dict) and l.get('id') in DOORS:
        l['interior'] = DOORS[l['id']]
        l['interior_story'] = True
open(P, 'w').write(json.dumps(d, ensure_ascii=False, indent=1))
print('ok')
