"""炎華之地 P6：炎華北原（媞丹）的兩座聚落（EAST_CONTENT_PLAN 11.4 節）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p6_places.py（可以重跑）
寫進 geography.json（地點、路線）、maps.json（地圖）、shops.json（店名）、npc_population.json（路人職業）、
lewd.json（魅氣）、slavery.json（奴隸市場）、assets/map/world-overview.json（總覽圖上的位置）。
地下城（鳴鏑古戰場、白狼雪窟）在 P7。
"""

import json
import re

LOCATIONS = [
    {'id': 'jinzhang', 'name': '金帳王庭', 'region': 'yanhua_north', 'type': 'capital',
     'races': {'centaur': 92, 'hualong': 5, 'human': 2, 'linghu': 1}, 'faction': 'tidan_khanate',
     'note': '媞丹的王都：天可汗的金帳（斡魯朵）、那達慕場、南北兩院'},
    {'id': 'yinghe', 'name': '鷹河榷場', 'region': 'yanhua_north', 'type': 'town',
     'races': {'centaur': 70, 'hualong': 18, 'linghu': 8, 'human': 4}, 'faction': 'tidan_khanate',
     'note': '鷹河邊的茶馬互市：大燁的茶與絲換媞丹的馬；海東部的鷹房在河的上游'},
]
ROUTES = [
    {'a': 'qingqiu', 'b': 'yinghe', 'days': [3, 3], 'mode': 'wild', 'note': '翻過青丘屯北邊的山林'},
    {'a': 'longan', 'b': 'yinghe', 'days': [5, 5], 'mode': 'road', 'note': '茶馬路'},
    {'a': 'yinghe', 'b': 'jinzhang', 'days': [4, 4], 'mode': 'wild', 'note': '草原'},
]

MAPS = {
    'jinzhang': {'blocks': [
        {'id': 'zhangshi', 'name': '{town}・帳市', 'links': {'1': 'naadam', '2': 'nanyuan'}, 'grid': [
            '#####1#####',
            '#I.......T#',
            '#.##...##.#',
            '2....S....#',
            '#.##...##.#',
            '#F.......D#',
            '#####E#####']},
        {'id': 'naadam', 'name': '{town}・那達慕場', 'links': {'1': 'zhangshi'}, 'grid': [
            '###########',
            '#G.......B#',
            '#.........#',
            '#..#...#..#',
            '#.........#',
            '#K.......C#',
            '#####1#####']},
        {'id': 'nanyuan', 'name': '{town}・南院', 'links': {'2': 'zhangshi', '3': 'beiyuan'}, 'grid': [
            '#####3#####',
            '#J.......N#',
            '#.##...##.#',
            '#....X....2',
            '#.##...##.#',
            '#M........#',
            '###########']},
        {'id': 'beiyuan', 'name': '{town}・北院', 'zone': 'noble', 'links': {'3': 'nanyuan', '4': 'palace'}, 'grid': [
            '#####4#####',
            '#.........#',
            '#.##.H.##.#',
            '#.........#',
            '#.##...##.#',
            '#.........#',
            '#####3#####']},
        {'id': 'palace', 'name': '{town}・{palace}', 'zone': 'palace', 'links': {'4': 'beiyuan'}, 'grid': [
            '###########',
            '#.........#',
            '#.#.....#.#',
            '#.........#',
            '#.##...##.#',
            '#.........#',
            '#####4#####']},
    ]},
    'yinghe': {'blocks': [
        {'id': 'chama', 'name': '{town}・茶馬市', 'links': {'1': 'yingfang'}, 'grid': [
            '#####1#####',
            '#I.......T#',
            '#.##...##.#',
            '#G...S...F#',
            '#.##...##.#',
            '#B.......D#',
            '#####E#####']},
        {'id': 'yingfang', 'name': '{town}・鷹房營地', 'links': {'1': 'chama'}, 'grid': [
            '###########',
            '#C.......N#',
            '#.##...##.#',
            '#....H....#',
            '#.##...##.#',
            '#X~.......#',
            '#####1#####']},
    ]},
}

NAMING_REGION = {
    'words': ['金帳', '蒼狼', '白鹿', '長生', '敖包', '鷹河', '草原', '氈房', '奶酒', '雪原', '駿馬', '北珠'],
    'air': ['氈帳外拴著幾匹馬，馬奶酒的酸香飄了出來', '帳裡燒著牛糞火，暖得讓人想睡', '遠處傳來馬頭琴低低的琴聲', '風從草原上吹過來，帶著青草與羊群的味道'],
    'suffix': {'tavern': ['奶酒帳', '酒帳'], 'inn': ['氈房', '驛帳'], 'general': ['雜貨帳', '奶茶鋪'], 'smithy': ['鐵匠帳'],
               'tailor': ['皮貨帳', '氈帳'], 'jeweler': ['銀匠帳'], 'magic': ['巫帳'], 'informant': ['驛站'], 'temple': ['敖包']},
}
NAMING_OVERRIDES = {
    'jinzhang': {
        'tavern': {'name': '長生天奶酒帳', 'desc': '王庭最大的酒帳，摔跤手與馬頭琴手都在這裡喝馬奶酒；帳頂掛著一排風乾的羊肉。', 'greeting': '先乾一碗！草原的規矩，進帳先喝酒。'},
        'inn': {'name': '金帳驛', 'desc': '大法典規定的驛站：持驛牌的人免費住，其他人付錢。氈房裡鋪著厚厚的羊毛氈。', 'greeting': '有驛牌嗎？沒有也行，一晚的錢。'},
    },
    'yinghe': {
        'general': {'name': '茶馬互市', 'desc': '大燁的茶磚、絲綢與媞丹的馬匹、皮貨在這裡交換；兩國的官吏在旁邊盯著每一筆交易。', 'greeting': '茶換馬、絲換皮，要什麼？'},
    },
}
STREET = {
    'jinzhang': {'chance': 0.5, 'list': ['牧民', '馬倌', '摔跤手', '馬頭琴手', '驛卒', '通譯']},
    'yinghe': {'chance': 0.5, 'list': ['牧民', '馬倌', '鷹奴', '皮匠', '通譯', '茶商']},
}
CHARM = {'jinzhang': 2, 'yinghe': 3}
SLAVE_MARKETS = {
    'jinzhang': {'public': {'name': '王庭的戰俘營', 'price_mult': 0.95, 'stock': [3, 4], 'races': {'centaur': 3, 'hualong': 2, 'human': 1}}},
    'yinghe': {'black': {'name': '鷹河邊的黑市帳', 'price_mult': 0.85, 'stock': [2, 3], 'races': {'centaur': 2, 'hualong': 2, 'linghu': 1}}},
}
OVERVIEW = {'jinzhang': [1442, 172], 'yinghe': [1318, 262]}


def flat(obj):
    return json.dumps(obj, ensure_ascii=False).replace('{"', '{ "').replace('"}', '" }').replace('}', ' }').replace('  }', ' }')


def one_line(obj):
    """一行的 JSON，照檔案裡的排版：{ "k": v, ... }"""
    s = json.dumps(obj, ensure_ascii=False)
    return '{ ' + s[1:-1] + ' }'


def replace_or_append(t, key, line, after_key, indent):
    """以 "key": 開頭的一行換掉，沒有時接在 "after_key": 那一行之後"""
    pat = re.compile(r'^' + indent + '"' + key + '": .*$', re.M)
    if pat.search(t):
        return pat.sub(lambda m: indent + f'"{key}": {line}' + (',' if m.group(0).rstrip().endswith(',') else ''), t, count=1)
    m = re.search(r'^' + indent + '"' + after_key + '": .*$', t, re.M)
    ln = m.group(0)
    return t[:m.start()] + ln.rstrip(',') + ',\n' + indent + f'"{key}": {line}' + (',' if ln.rstrip().endswith(',') else '') + t[m.end():]


def write_geography():
    p = 'data/world/geography.json'
    t = open(p, encoding='utf-8').read()
    for l in LOCATIONS:
        t = re.sub(r'\n    \{ "id": "' + l['id'] + r'",.*', '', t)
    for r in ROUTES:
        t = re.sub(r'\n    \{ "a": "' + r['a'] + r'", "b": "' + r['b'] + r'",.*', '', t)
    t = re.sub(r',(\s*\n\s*\])', r'\1', t)
    m = re.search(r'\n    \{ "id": "qingqiu",.*', t)
    ln = m.group(0)
    t = t[:m.start()] + ln.rstrip(',') + ',' + ''.join('\n    ' + one_line(l) + ',' for l in LOCATIONS).rstrip(',') + (',' if ln.endswith(',') else '') + t[m.end():]
    m = re.search(r'\n    \{ "a": "longan", "b": "qingqiu",.*', t)
    ln = m.group(0)
    t = t[:m.start()] + ln.rstrip(',') + ',' + ''.join('\n    ' + one_line(r) + ',' for r in ROUTES).rstrip(',') + (',' if ln.endswith(',') else '') + t[m.end():]
    json.loads(t)
    open(p, 'w', encoding='utf-8').write(t)


def write_maps():
    p = 'data/world/maps.json'
    t = open(p, encoding='utf-8').read()
    d = json.loads(t)
    for k in MAPS:
        if k in d['maps']:
            # 上一次寫進去的：整段拿掉
            t = re.sub(r',\n    "' + k + r'": \{\n.*?\n    \}(?=,\n    "|\n  \})', '', t, flags=re.S)
    anchor = '\n    }\n  },\n  "palace_names"'
    assert anchor in t
    body = ''.join(',\n    "' + k + '": ' + json.dumps(v, ensure_ascii=False, indent=2).replace('\n', '\n    ') for k, v in MAPS.items())
    t = t.replace(anchor, '\n    }' + body + '\n  },\n  "palace_names"', 1)
    d = json.loads(t)
    assert all(k in d['maps'] for k in MAPS)
    open(p, 'w', encoding='utf-8').write(t)


def write_shops():
    p = 'data/rules/shops.json'
    t = open(p, encoding='utf-8').read()
    d = json.loads(t)
    if 'yanhua_north' not in d['naming']['regions']:
        reg = ('      "yanhua_north": {\n'
               f'        "words": {json.dumps(NAMING_REGION["words"], ensure_ascii=False)},\n'
               f'        "air": {json.dumps(NAMING_REGION["air"], ensure_ascii=False)},\n'
               '        "suffix": {\n'
               '          ' + ', '.join(f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in list(NAMING_REGION['suffix'].items())[:4]) + ',\n'
               '          ' + ', '.join(f'"{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in list(NAMING_REGION['suffix'].items())[4:]) + '\n'
               '        }\n'
               '      }')
        anchor = '          "tailor": ["綢緞莊", "繡坊"], "jeweler": ["金銀鋪"], "magic": ["符籙鋪"], "informant": ["茶坊"], "temple": ["祠", "廟"]\n        }\n      }'
        assert anchor in t
        t = t.replace(anchor, anchor + ',\n' + reg, 1)
    if 'jinzhang' not in d['naming']['overrides']:
        rows = []
        for loc, shops in NAMING_OVERRIDES.items():
            rows.append(f'      "{loc}": {{\n' + ',\n'.join(f'        "{k}": {one_line(v)}' for k, v in shops.items()) + '\n      }')
        anchor = '        "general": { "name": "青丘山貨鋪", "desc": "賣老山參、貂皮、乾蘑菇，也收山裡人打來的東西。", "greeting": "要山貨還是要賣山貨？" }\n      }'
        assert anchor in t
        t = t.replace(anchor, anchor + ',\n' + ',\n'.join(rows), 1)
    json.loads(t)
    open(p, 'w', encoding='utf-8').write(t)


def write_small():
    p = 'data/rules/npc_population.json'
    t = open(p, encoding='utf-8').read()
    for k, v in STREET.items():
        t = replace_or_append(t, k, one_line(v), 'qingqiu' if k == 'jinzhang' else 'jinzhang', '    ')
    json.loads(t)
    open(p, 'w', encoding='utf-8').write(t)

    p = 'data/rules/slavery.json'
    t = open(p, encoding='utf-8').read()
    for k, v in SLAVE_MARKETS.items():
        line = '{ ' + ', '.join(f'"{kind}": {one_line(m)}' for kind, m in v.items()) + ' }'
        t = replace_or_append(t, k, line, 'quanzhou' if k == 'jinzhang' else 'jinzhang', '    ')
    json.loads(t)
    open(p, 'w', encoding='utf-8').write(t)

    p = 'data/rules/lewd.json'
    t = open(p, encoding='utf-8').read()
    m = re.search(r'"locations": \{[^}]*\}', t)
    locs = json.loads('{' + m.group(0) + '}')['locations']
    locs.update(CHARM)
    t = t[:m.start()] + '"locations": ' + json.dumps(locs, ensure_ascii=False).replace('{"', '{ "').replace('}', ' }').replace(', "', ', "') + t[m.end():]
    json.loads(t)
    open(p, 'w', encoding='utf-8').write(t)

    p = 'assets/map/world-overview.json'
    t = open(p, encoding='utf-8').read()
    for k, (x, y) in OVERVIEW.items():
        if f'"{k}":' in t:
            t = re.sub(r'"' + k + r'": \[\d+, \d+\]', f'"{k}": [{x}, {y}]', t)
        else:
            t = t.replace('    "qingqiu": [1310, 345]', f'    "qingqiu": [1310, 345],\n    "{k}": [{x}, {y}]', 1)
    json.loads(t)
    open(p, 'w', encoding='utf-8').write(t)


if __name__ == '__main__':
    write_geography()
    write_maps()
    write_shops()
    write_small()
    print('炎華北原：地點', len(LOCATIONS), '、路線', len(ROUTES))
