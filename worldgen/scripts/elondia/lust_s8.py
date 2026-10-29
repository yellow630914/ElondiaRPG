# 慾望戰鬥 S8 的資料（docs/plan/LUST_COMBAT_PLAN.md 第 12 節；規則寫在 docs/LEWD_STATS.md）：
#   S8-3 消耗品、烹飪、鍊金、征服掉落、附魔的輔料方向
# 寫進 data/rules/items.json、statuses.json、companions.json（非戰鬥狀態）、lewd.json（conquest）、gear.json（輔料的方向 lust）。
# 可以重跑：先拿掉上一次寫進去的再寫。要排在 lust_park_s7.py 之後（清心茶、媚香精油在那裡）。
import json
import re

SELL = json.load(open('data/rules/items.json'))['sell_ratio']


def drop_lines(text, pattern):
    """拿掉符合 pattern 的整行（一行一筆），再補掉因此留在陣列或物件結尾的逗號"""
    text = re.sub(pattern, '', text)
    return re.sub(r',(\s*\n\s*[\]}])', r'\1', text)


def insert_after(text, anchor, lines):
    """在 anchor（正規表示式，整行）那一行後面接上 lines（一行一筆），補好逗號"""
    m = re.search(anchor, text)
    line = m.group(0)
    tail = ',' if line.endswith(',') else ''
    return text[:m.start()] + line.rstrip(',') + ',\n' + ',\n'.join(lines) + tail + text[m.end():]


# ---------------- S8-3 消耗品、烹飪、鍊金、征服掉落 ----------------
def material(name, price, desc):
    return {"name": name, "category": "material", "price_cc": price, "tags": [], "adult": True, "desc": desc}


def recipe(craft, level, inputs, qty=1, cost=0, hours=2):
    return {"craft": craft, "level": level, "inputs": [{"name": n, "qty": q} for n, q in inputs], **({"qty": qty} if qty > 1 else {}),
            **({"cost_cc": cost} if cost else {}), "hours": hours}


CONQUEST = {
    "beast": "淫獸的媚腺",
    "demon": "魅魔的香精",
    "fey": "妖精的花露",
    "plant": "媚香花蜜",
    "spirit": "夢魔的鱗粉",
    "elemental": "媚液結晶",
}

ITEMS = [
    material('淫獸的媚腺', 160, '在高潮中屈服的淫獸身上取下的腺體，擠出來的汁液一滴就讓人發燙。鍊金師拿來做精力藥與壯陽的料理。'),
    material('魅魔的香精', 220, '在高潮中屈服的魅魔留下的一小瓶香精，聞一下就心跳加快；調香師願意出高價收。'),
    material('妖精的花露', 150, '在高潮中屈服的妖精留下的花露，清涼又甜，鍊金師拿來調冷靜劑。'),
    {"name": "媚藥瓶", "category": "consumable", "price_cc": 160, "tags": ["general"], "adult": True,
     "use": {"damage": {"dice": "2d6", "type": "lust"}, "apply": {"status": "aphrodisiac", "turns": 3, "save": "str", "dc": 13}, "area": "all"},
     "desc": "裝著粉紅色霧氣的薄玻璃瓶，砸碎之後甜膩的媚藥瀰漫開來：所有敵人 2d6 慾望並媚毒 3 回合（力量豁免 DC 13，成功減半、不中媚毒）。不吃魅惑的敵人沒用。",
     "recipe": recipe('alchemy', 3, [('媚液結晶', 1)], qty=1, cost=20)},
    {"name": "冷靜劑", "category": "consumable", "price_cc": 180, "tags": ["temple"], "adult": True,
     "use": {"status": {"id": "calm_draught", "turns": 20}},
     "desc": "神殿調的苦藥，喝下去心跳慢慢平靜：這場戰鬥受到的慾望減半。",
     "recipe": recipe('alchemy', 4, [('妖精的花露', 1), ('藥草', 2)], qty=1, cost=30)},
    {"name": "精力藥", "category": "consumable", "price_cc": 260, "tags": ["general"], "adult": True,
     "use": {"status": {"id": "vigor_draught", "turns": 20}},
     "desc": "用淫獸的媚腺熬的濃藥，喝下去渾身是勁：這場戰鬥下一次高潮不扣生命。",
     "recipe": recipe('alchemy', 4, [('淫獸的媚腺', 1)], qty=1, cost=60)},
    {"name": "壯陽燉肉", "category": "food", "price_cc": 45, "tags": ["tavern"], "adult": True, "use": {"condition": "virile"},
     "desc": "加了淫獸媚腺的燉肉，吃完全身發熱、精神百倍：下次長休前，每場戰鬥的慾望上限 +20%（不佔用餐的格子，可以和料理一起吃）。",
     "recipe": recipe('cooking', 2, [('淫獸的媚腺', 1), ('生肉', 1)], qty=3, cost=5)},
]
# 清心茶、媚香精油（lust_park_s7.py 的物品）的配方另外補在那裡

STATUSES = {
    "calm_draught": {"name": "冷靜", "kind": "buff", "resist": {"lust": -0.5}},
    "vigor_draught": {"name": "精力充沛", "kind": "buff", "climax_guard": True},
}

CONDITIONS = {
    "virile": {"name": "精力旺盛", "desc": "吃了壯陽的料理，全身發熱、精神百倍。下次長休前，每場戰鬥的慾望上限 +20%。", "combat_lust_max": 0.2, "clears": "long_rest"},
}

CONQUEST_RULES = {
    "$comment": "慾望勝利的「征服」掉落（docs/LEWD_STATS.md 第 13 節）：怪物在高潮中屈服（慾望勝利）時，有 chance 的機率依種類（kinds）多掉一件材料。不死與構裝不吃魅惑，人形不掉。",
    "chance": 0.5,
    "kinds": CONQUEST,
}

LUST_AUX_WORDS = ["媚", "淫", "慾", "魅", "情"]


def check_recipes(items, prices):
    """配方不能拿來賺錢：材料價值 + 花費 ≥ 成品賣回的價格"""
    for it in items:
        r = it.get('recipe')
        if not r:
            continue
        value = sum(prices[i['name']] * i['qty'] for i in r['inputs']) + r.get('cost_cc', 0)
        sell = it['price_cc'] * SELL * r.get('qty', 1)
        assert value >= sell, (it['name'], value, sell)


def write_s8_3():
    p = 'data/rules/items.json'
    t = open(p).read()
    for it in ITEMS:
        t = drop_lines(t, r'\n    \{"name": ' + re.escape(json.dumps(it['name'], ensure_ascii=False)) + r'.*')
    prices = {x['name']: x['price_cc'] for x in json.loads(t)['items']}
    prices.update({x['name']: x['price_cc'] for x in ITEMS})
    check_recipes(ITEMS, prices)
    t = insert_after(t, r'\n    \{"name": "魅魔女王的吊帶襪".*', ['    ' + json.dumps(x, ensure_ascii=False) for x in ITEMS])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/statuses.json'
    t = open(p).read()
    for k in STATUSES:
        t = drop_lines(t, r'\n    "' + k + r'": \{.*')
    lines = [f'    "{k}": ' + json.dumps(v, ensure_ascii=False).replace('{"', '{ "').replace('}', ' }').replace('": ', '": ').replace(', "', ', "') for k, v in STATUSES.items()]
    t = insert_after(t, r'\n    "tide_bride": \{.*', lines)
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/companions.json'
    t = open(p).read()
    for k in CONDITIONS:
        t = drop_lines(t, r'\n  "' + k + r'": \{.*')
    t = insert_after(t, r'\n  "afterglow": \{.*', [f'  "{k}": ' + json.dumps(v, ensure_ascii=False) for k, v in CONDITIONS.items()])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = drop_lines(t, r'\n  "conquest": \{.*')
    t = t.replace('\n  "charm": {', '\n  "conquest": ' + json.dumps(CONQUEST_RULES, ensure_ascii=False) + ',\n  "charm": {', 1)
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/gear.json'
    t = open(p).read()
    t = drop_lines(t, r'\n        "lust": \[.*')
    t = insert_after(t, r'\n        "force": \[.*', ['        "lust": ' + json.dumps(LUST_AUX_WORDS, ensure_ascii=False)])
    json.loads(t)
    open(p, 'w').write(t)
    print('S8-3 items', len(ITEMS), 'statuses', len(STATUSES), 'conditions', len(CONDITIONS))


if __name__ == '__main__':
    write_s8_3()
