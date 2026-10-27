# 特殊區域的角色站進內部地圖的房間：在原本的出沒階段前面加一組（第一組成立的優先）
import json, re
P = 'data/world/npcs.json'
SAL, CAFE, CLUB, BAN, BACK = 'sm/sm_wives_salon', 'sm/sm_maid_cafe', 'sm/sm_ebony_night', 'sm/sm_succubus_banquet', 'sm/sm_idol_backstage'
# (角色, 照哪幾組原本的階段複製身分, 多加的旗標, 時段, 地點, 地圖, x, y)
ROOMS = [
    ('npc_mimi', [0], ['mimi_lover', 'eve_lover'], None, 'dawnlight', CAFE, 2, 2),
    ('npc_margarete', [0, 1], ['group_wives_done'], 'day', 'rhineburg', SAL, 3, 2),
    ('npc_lieselotte', [0, 1], ['group_wives_done'], 'day', 'rhineburg', SAL, 1, 1),
    ('npc_clara', [0], ['group_wives_done'], 'day', 'rhineburg', SAL, 3, 1),
    ('npc_aya', [1], [], 'night', 'soriel', CLUB, 4, 2),
    ('npc_cassandra', [0, 1], [], 'night', 'bloodplume', BAN, 5, 1),
    ('npc_rona', [0], ['cas_lover'], 'night', 'bloodplume', BAN, 8, 2),
    ('npc_lana', [0], ['cas_lover'], 'night', 'bloodplume', BAN, 9, 2),
    ('npc_lucia', [0], ['cas_lover'], 'night', 'bloodplume', BAN, 2, 2),
    ('npc_noel', [0], ['cas_lover'], 'night', 'bloodplume', BAN, 1, 1),
    ('npc_stella', [0], ['group_idols_done'], 'night', 'rivervale', BACK, 1, 1),
    ('npc_noir', [0], ['group_idols_done'], 'night', 'rivervale', BACK, 3, 1),
    ('npc_pom', [0], ['group_idols_done'], 'night', 'rivervale', BACK, 1, 2),
]
lines = open(P).read().split('\n')


def stage_line(npc):
    start = next(i for i, l in enumerate(lines) if f'"id": "{npc}"' in l)
    return next(i for i in range(start, start + 15) if lines[i].strip().startswith('"stages": '))


def rooms_of(st):
    return st.get('fixed', {}).get('area', '').startswith('sm/sm_')


for npc, bases, extra, hours, loc, area, x, y in ROOMS:
    i = stage_line(npc)
    m = re.match(r'(\s*"stages": )(\[.*\])(,?)$', lines[i])
    stages = [s for s in json.loads(m.group(2)) if not rooms_of(s)]  # 重跑時先拿掉上次加的
    new = []
    for b in bases:
        s = dict(stages[b])
        s.pop('haunts', None)
        s['requires'] = {**s['requires'], 'flags': list(dict.fromkeys(s['requires'].get('flags', []) + extra))}
        if hours: s['hours'] = hours
        s['location'] = loc
        s['fixed'] = {'area': area, 'x': x, 'y': y}
        keys = ['requires'] + (['hours'] if hours else []) + ['location', 'fixed']
        new.append({**{k: s[k] for k in keys}, **{k: v for k, v in s.items() if k not in keys}})
    lines[i] = m.group(1) + json.dumps(new + stages, ensure_ascii=False) + m.group(3)

# 伊芙搬進自己的小房間（原本站在前廳）
i = stage_line('npc_eve')
m = re.match(r'(\s*"stages": )(\[.*\])(,?)$', lines[i])
st = json.loads(m.group(2))
st[0]['fixed'] = {'area': CAFE, 'x': 5, 'y': 2}
lines[i] = m.group(1) + json.dumps(st, ensure_ascii=False) + m.group(3)
out = '\n'.join(lines)
json.loads(out)
open(P, 'w').write(out)
print('ok')
