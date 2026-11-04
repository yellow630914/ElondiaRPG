"""炎華之地 P6：人馬族的裝備欄（EAST_CONTENT_PLAN 11.2 節、EAST_CONTINENT_PLAN 5.1 節）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p6_gear.py（可以重跑）
- gear.json 的 races.centaur：內褲那一格改名「後蹄」、收鞋子類的底材（relabel）；下身、鞋子、後蹄、腿部飾品只能穿人馬族的底材（restricted）
- 人馬族限定的底材 6 種（races: ["centaur"]）：馬衣、馬鎧（下身）、蹄鐵、蹄靴（鞋子與後蹄）、蹄鈴、馬腿環（腿部飾品）
- 每種材料的制式品（只在炎華之地的店裡賣）
"""

import json
import re

from east_p5_items import EAST, GEAR, LOC_BY_TIER, flat, insert_lines

RACE = {'blocked': [], 'restricted': ['legs', 'feet', 'underwear_bottom', 'leg_accessory'],
        'relabel': {'underwear_bottom': {'name': '後蹄', 'as': 'feet'}}}

C = ['centaur']
BASES = {
    'horse_cloth': {'slot': 'legs', 'name': '馬衣', 'kind': 'cloth', 'price': 30, 'scale': {'save': 'half'}, 'outfit': 'regular', 'races': C,
                    'desc': '披在人馬族馬身上的布衣，從腰際垂到膝上，繡著部族的紋樣。'},
    'horse_barding': {'slot': 'legs', 'name': '馬鎧', 'kind': 'metal', 'price': 500, 'stats': {'dr': 1, 'evade': -1}, 'scale': {'dr': 'half'}, 'races': C,
                      'desc': '護住人馬族馬身的甲片，從胸前一路罩到後臀，跑起來嘩啦作響。'},
    'horseshoe': {'slot': 'feet', 'name': '蹄鐵', 'kind': 'metal', 'price': 60, 'scale': {'dr': 'half'}, 'races': C,
                  'desc': '釘在馬蹄上的鐵片，前蹄、後蹄各要一副。'},
    'hoof_boots': {'slot': 'feet', 'name': '蹄靴', 'kind': 'leather', 'price': 30, 'scale': {'evade': 'up'}, 'races': C,
                   'desc': '套在馬蹄上的軟皮靴，走在石板路上不打滑，也不吵。前蹄、後蹄各要一雙。'},
    'hoof_bells': {'slot': 'leg_accessory', 'name': '蹄鈴', 'kind': 'jewel', 'price': 100, 'scale': {'save': 'third_up'}, 'races': C,
                   'desc': '繫在馬腿上的一串小鈴，跑起來叮叮噹噹，草原上的人說鈴聲能嚇走邪祟。'},
    'horse_leg_ring': {'slot': 'leg_accessory', 'name': '馬腿環', 'kind': 'jewel', 'price': 140, 'scale': {'dr': 'third_up'}, 'races': C,
                       'desc': '套在馬腿上的硬環，護住腿骨。'},
}
SHOP = {'metal': 'smith', 'wood': 'smith', 'leather': 'tailor', 'cloth': 'tailor', 'jewel': 'jeweler'}


def gear_name(b, m):
    """照 gear.ts 的 gearName：皮字開頭的皮革底材才省略材料名"""
    n = b['name']
    if m['kind'] == 'leather' and n.startswith('皮'):
        return n if m['tier'] == 1 else m['name'] + (n[1:] if m['name'].endswith('皮') else n)
    return m['name'] + n


def catalog(base_id):
    b = BASES[base_id]
    out = []
    for mid, m in sorted(((k, v) for k, v in GEAR['materials'].items() if v['kind'] == b['kind']), key=lambda x: (x[1]['tier'], x[1].get('series') == 'pleasure')):
        d = {'name': gear_name(b, m), 'category': 'equipment', 'price_cc': round(b['price'] * m['price']),
             'tags': [SHOP[b['kind']]] if m['tier'] <= 4 else [], 'gear': {'base': base_id, 'material': mid}}
        if m['tier'] in LOC_BY_TIER:
            d['min_location'] = LOC_BY_TIER[m['tier']]
        if d['tags']:
            d['regions'] = EAST
        d['desc'] = b['desc'] + (m.get('desc') or '')
        if m.get('series') == 'pleasure':
            d['adult'] = True
        out.append(d)
    return out


def write_race():
    p = 'data/rules/gear.json'
    t = open(p, encoding='utf-8').read()
    t = re.sub(r'"centaur": \{[^\n]*?\}(?= *\n)', '"centaur": ' + json.dumps(RACE, ensure_ascii=False), t, count=1)
    json.loads(t)
    open(p, 'w', encoding='utf-8').write(t)


def write_catalog(rows):
    p = 'data/rules/items.json'
    t = open(p, encoding='utf-8').read()
    t = re.sub(r'\n    \{ "name": "[^"]+", "category": "equipment", "price_cc": \d+, "tags": \[[^\]]*\], "gear": \{ "base": "(?:' + '|'.join(BASES) + r')", "material": "[a-z_]+" \}.*', '', t)
    t = re.sub(r',(\s*\n\s*\])', r'\1', t)
    last = None
    for m in re.finditer(r'\n    \{ "name": "[^"]+", "category": "equipment", "price_cc": \d+, "tags": \[[^\]]*\], "gear": \{ "base": "[a-z_]+", "material": "[a-z_]+" \}.*', t):
        last = m
    ln = last.group(0)
    body = ',\n'.join('    ' + re.sub(r'"gear": \{("base": "[a-z_]+", "material": "[a-z_]+")\}', r'"gear": { \1 }', flat(r)) for r in rows)
    t = t[:last.start()] + ln.rstrip(',') + ',\n' + body + (',' if ln.endswith(',') else '') + t[last.end():]
    data = json.loads(t)
    names = [i['name'] for i in data['items']]
    assert len(names) == len(set(names)), '重複的物品名稱'
    open(p, 'w', encoding='utf-8').write(t)
    print(f'制式品 {len(rows)} 件')


if __name__ == '__main__':
    write_race()
    insert_lines('data/rules/gear.json', 'thigh_sheath', BASES)
    write_catalog([r for b in BASES for r in catalog(b)])
