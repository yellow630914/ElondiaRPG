# 慾望戰鬥 S8 的資料（docs/plan/LUST_COMBAT_PLAN.md 第 12 節；規則寫在 docs/LEWD_STATS.md）：
#   S8-3 消耗品、烹飪、鍊金、征服掉落、附魔的輔料方向
#        寫進 data/rules/items.json、statuses.json、companions.json（非戰鬥狀態）、lewd.json（conquest）、gear.json（輔料的方向 lust）
#   S8-4 淫紋（tattoos.json 的圖樣）、寄生物的階段技能與馴服技能（parasites.json、abilities.json）、奴隸印記的順從累積（slavery.json）
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


# ---------------- S8-4 淫紋、寄生物、奴隸印記 ----------------
LEWD_TATTOOS = {
    "lewd_womb": {"kind": "plain", "name": "淫紋・子宮", "desc": "小腹上一枚桃紅色的子宮形紋樣，刺的時候混了魅魔的血，動情時會微微發亮。", "places": ["belly"],
                  "lust": {"max": 0.15}, "price": 400, "adult": True},
    "lewd_heart": {"kind": "plain", "name": "淫紋・心鎖", "desc": "一顆被鎖鏈纏住的心，線條是深紫色的，被碰到時會發熱。", "places": ["belly", "hips"],
                   "lust": {"bonus": 2}, "price": 400, "adult": True},
    "lewd_wings": {"kind": "plain", "name": "淫紋・夜蝶", "desc": "腰後一對展開的夜蝶翅膀，翅膀上的眼紋像在看人。", "places": ["back", "hips"],
                   "lust": {"max": 0.1, "bonus": 1}, "price": 500, "adult": True},
}

PARASITE_ABILITIES = [
    {"id": "para_lingerie_bind", "name": "魔導衣的纏縛", "type": "skill", "classes": ["lewd"], "unlock": 1, "ap": 2, "attr": "cha", "target": "enemy", "resolve": "attack",
     "damage": [{"dice": "2d6", "type": "lust", "scale": {"dice": "1d6", "per": 4}, "mod": True}], "apply": [{"status": "restrained", "turns": 1, "on": "hit"}], "uses": {"per_rest": 1},
     "desc": "（獸蟲派・馴服的魔導衣）黑色的蕾絲從身上延伸出去，把敵人纏住：2d6 + 魅力調整值慾望（每 4 級再 +1d6），命中後束縛 1 回合。每次長休一次。"},
    {"id": "para_mark_surge", "name": "主宰之紋・解放", "type": "skill", "classes": ["lewd"], "unlock": 1, "ap": 2, "attr": "cha", "target": "all_enemies", "resolve": "save", "save": "fai",
     "damage": [{"dice": "2d6", "type": "lust", "scale": {"dice": "1d6", "per": 3}, "mod": True}], "apply": [{"status": "sensitized", "turns": 2}], "uses": {"per_rest": 1},
     "desc": "（獸蟲派・主宰之紋）點亮小腹上的紋樣，熱流一口氣放出去：所有敵人信仰豁免，2d6 + 魅力調整值慾望（每 3 級再 +1d6，成功減半），失敗敏感 2 回合。每次長休一次。"},
]
PARASITE_PATCH = {
    "hungry_lingerie": {"tamed_ability": "para_lingerie_bind"},
    "succubus_mark": {"tamed_ability": "para_mark_surge", "stage_abilities": [[], [], ["lust_kiss"], ["lust_kiss", "lust_smile"]], "stage_lust": [0, 0, 0, 0.2]},
}
SUBMISSION = {"labor": 3, "combat": 4, "arcane": 2, "brothel": 1}
SUBMISSION_TEXT = "順從累積：戴著印記的日子，順從慢慢上升。"


def write_s8_4():
    p = 'data/rules/tattoos.json'
    t = open(p).read()
    for k in LEWD_TATTOOS:
        t = drop_lines(t, r'\n    "' + k + r'": \{.*')
    spaced = lambda v: json.dumps(v, ensure_ascii=False).replace('{"', '{ "').replace('}', ' }')
    t = insert_after(t, r'\n    "oath_wild": \{.*', [f'    "{k}": {spaced(v)}' for k, v in LEWD_TATTOOS.items()])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/abilities.json'
    t = open(p).read()
    for a in PARASITE_ABILITIES:
        t = drop_lines(t, r'\n    \{"id": "' + a['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "lust_tide_bride".*', ['    ' + json.dumps(a, ensure_ascii=False) for a in PARASITE_ABILITIES])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/parasites.json'
    d = json.load(open(p))
    for pid, patch in PARASITE_PATCH.items():
        x = d['parasites'][pid]
        x['tamed']['ability'] = patch['tamed_ability']
        for k in ('stage_abilities', 'stage_lust'):
            if k in patch:
                x[k] = patch[k]
    open(p, 'w').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

    p = 'data/rules/slavery.json'
    t = open(p).read()
    t = re.sub(r'\n      "submission_every": \d+,', '', t)
    for k, n in SUBMISSION.items():
        m = re.search(r'\n    "' + k + r'": \{\n(?:.*\n)*?      "exit_dc": .*,', t)
        t = t[:m.end()] + f'\n      "submission_every": {n},' + t[m.end():]
    t = drop_lines(t, r'\n    "submission": ".*')
    t = insert_after(t, r'\n    "spell_seal": ".*', [f'    "submission": {json.dumps(SUBMISSION_TEXT, ensure_ascii=False)}'])
    json.loads(t)
    open(p, 'w').write(t)
    print('S8-4 tattoos', len(LEWD_TATTOOS), 'abilities', len(PARASITE_ABILITIES))


# ---------------- S8-6 鎖具與脫縛 ----------------
KEYS = [
    {"name": "白鐵鑰匙", "category": "gear", "price_cc": 30, "tags": [], "key": "white", "desc": "一把普通的小鑰匙，打得開白鐵鎖。用一次就留在鎖孔裡了（一次性）。"},
    {"name": "藍鋼鑰匙", "category": "gear", "price_cc": 120, "tags": [], "key": "blue", "desc": "齒紋精細的藍鋼鑰匙，打得開藍鋼鎖以下的鎖。用一次就斷在鎖孔裡（一次性）。"},
    {"name": "符文鑰匙", "category": "gear", "price_cc": 450, "tags": [], "key": "rune", "desc": "刻著解封符文的鑰匙，打得開符文鎖以下的鎖。符文用一次就褪色（一次性）。"},
    {"name": "黃金鑰匙", "category": "gear", "price_cc": 1500, "tags": [], "key": "gold", "desc": "貴族隨身帶著的金鑰匙，什麼鎖都打得開。用一次就被鎖吞了（一次性）。"},
]
STRUGGLE_STATUSES = {
    "glued": {"name": "膠膜", "kind": "debuff", "control": "stun", "struggle": 0},
    "swallowed": {"name": "吞入", "kind": "debuff", "control": "stun", "struggle": 2, "lust_mult": 0.25},
}
UNBIND_RULES = {
    "$comment": "脫縛（docs/LEWD_STATS.md 第 16 節）。嘗試脫縛：DC = base + 鎖的 lock_dc + 拘束程度 × bind_dc − 忍耐 / endurance_per；靈巧檢定（雙手被綁的減值照雙面效應算在檢定上）。只有別人鎖上的拘束具（主人強制戴上的）才需要；成功時鎖被弄壞、拘束具可以卸下。主人在身邊時，失敗輕度懲罰、大失敗嚴厲懲罰；大失敗順從 + fumble_submission。鑰匙（物品的 key）打開同等級以下的鎖，用一次就沒了，鎖歸自己。keys：擊敗人形的敵人（持有裝備的怪物、敵對冒險者）時 chance 的機率搜到一把，依敵人等級（levels：[最低等級, 鎖的等級]）。combat：戰鬥中的拘束（狀態有 struggle）用掙脫（自己）或撕開（隊友）擺脫，花 ap 行動點；1d20 + 熟練 + 力量、靈巧較高的調整值，DC = base + 施加者等級 × per_level + 狀態的 struggle，自己雙手被綁 + hands。",
    "attr": "dex",
    "base": 12,
    "lock_dc": {"white": 0, "blue": 2, "rune": 4, "gold": 6},
    "bind_dc": 1,
    "endurance_per": 20,
    "fumble_submission": 1,
    "keys": {"chance": 0.1, "levels": [[1, "white"], [6, "blue"], [11, "rune"], [16, "gold"]]},
    "combat": {"ap": 1, "base": 10, "per_level": 0.5, "hands": 2},
}
STATUS_SWAP = {"lp_glue": ("stunned", "glued", 2), "lp_swallow": ("stunned", "swallowed", 2)}


def write_s8_6():
    p = 'data/rules/items.json'
    t = open(p).read()
    for it in KEYS:
        t = drop_lines(t, r'\n    \{"name": ' + re.escape(json.dumps(it['name'], ensure_ascii=False)) + r'.*')
    t = insert_after(t, r'\n    \{ "name": "黃金鎖".*', ['    ' + json.dumps(x, ensure_ascii=False) for x in KEYS])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/statuses.json'
    t = open(p).read()
    for k in STRUGGLE_STATUSES:
        t = drop_lines(t, r'\n    "' + k + r'": \{.*')
    lines = [f'    "{k}": ' + json.dumps(v, ensure_ascii=False).replace('{"', '{ "').replace('}', ' }') for k, v in STRUGGLE_STATUSES.items()]
    t = insert_after(t, r'\n    "restrained": \{.*', lines)
    t = re.sub(r'("restrained": \{ "name": "束縛", "kind": "debuff", "disadvantage": \["evade"\], "attacked_advantage": true)( \})', r'\1, "struggle": 0\2', t)
    t = t.replace('"attacked_advantage": true, "struggle": 0, "struggle": 0', '"attacked_advantage": true, "struggle": 0')
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/abilities.json'
    t = open(p).read()
    for aid, (old, new, turns) in STATUS_SWAP.items():
        m = re.search(r'\n    \{"id": "' + aid + r'".*', t)
        line = m.group(0)
        line2 = re.sub(r'"status": "(' + old + '|' + new + r')", "turns": \d+', f'"status": "{new}", "turns": {turns}', line)
        t = t.replace(line, line2)
    t = t.replace('失敗被黏住不能行動 1 回合', '失敗被膠膜黏住不能行動 2 回合（隊友可以撕開）')
    t = t.replace('失敗被困住不能行動 1 回合', '失敗被困在花苞裡不能行動 2 回合、受到的慾望 +25%（隊友可以撕開）')
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = drop_lines(t, r'\n  "unbind": \{.*')
    t = t.replace('\n  "park": {', '\n  "unbind": ' + json.dumps(UNBIND_RULES, ensure_ascii=False) + ',\n  "park": {', 1)
    json.loads(t)
    open(p, 'w').write(t)
    print('S8-6 keys', len(KEYS), 'statuses', len(STRUGGLE_STATUSES))


# ---------------- S8-7 敵人的手段 ----------------
FOE_ABILITIES = [
    {"id": "h_aphro_incense", "name": "催情術", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "cha", "target": "all_enemies", "resolve": "save", "save": "fai",
     "damage": [{"dice": "1d8", "type": "lust", "scale": {"dice": "1d6", "per": 4}}], "uses": {"per_combat": 1},
     "desc": "念出一段催情的咒文，不用香也不用藥：所有敵人信仰豁免，1d8 慾望（每 4 級再 +1d6，成功減半）。每場戰鬥一次。"},
    {"id": "h_slave_drive", "name": "驅奴術", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "cha", "target": "enemy", "resolve": "save", "save": "fai",
     "damage": [{"dice": "1d6", "type": "lust", "scale": {"dice": "1d6", "per": 4}}], "vs_slave": 2, "apply": [{"status": "stunned", "turns": 1, "if_slave": True}], "uses": {"per_combat": 1},
     "desc": "對著奴隸印記喊出驅使的口令：信仰豁免，1d6 慾望（每 4 級再 +1d6，成功減半）；身上有奴隸印記的人慾望加倍，失敗時還被口令定住 1 回合。每場戰鬥一次。"},
    {"id": "h_overawe", "name": "威壓", "type": "skill", "classes": ["monster"], "ap": 1, "attr": "str", "target": "enemy", "resolve": "save", "save": "cha",
     "apply": [{"status": "overawed", "turns": 3, "if_weaker": True}], "uses": {"per_combat": 1},
     "desc": "居高臨下地瞪著對方：魅力豁免，等級比自己低的人失敗時被威壓 3 回合（受到的慾望 +25%、豁免 -1）。每場戰鬥一次。"},
    {"id": "rut_mount", "name": "發情撲上", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [{"dice": "1d6", "type": "lust", "scale": {"dice": "1d6", "per": 3}}], "apply": [{"status": "prone", "turns": 1, "on": "hit"}],
     "desc": "發情的野獸整個撲上來磨蹭：1d6 慾望（每 3 級再 +1d6），命中後倒地 1 回合。"},
]
FOE_STATUSES = {"overawed": {"name": "威壓", "kind": "debuff", "mods": {"save": -1}, "lust_mult": 0.25}}
# 人形的敵人、吸血蝠：補上色情技能（沒有寫在這裡的保持原樣）
FOE_PATCH = {
    "slaver_thug": ["h_slave_drive", "h_overawe"],
    "slaver_captain": ["h_slave_drive", "h_overawe", "h_aphro_incense"],
    "kidnapper_bandit": ["h_slave_drive", "h_overawe"],
    "brand_raider": ["h_slave_drive"],
    "grave_robber_chief": ["h_overawe"],
    "ashport_robber": ["h_overawe"],
    "highway_robber": ["h_overawe"],
    "tea_road_bandit": ["h_overawe"],
    "dune_bandit": ["h_overawe"],
    "pilgrim_raider": ["h_overawe"],
    "catnip_bandit": ["h_aphro_incense"],
    "blood_priest": ["h_aphro_incense"],
    "blood_bat": ["m_lust_kiss"],
}
RUT_TRAIT = {"abilities": ["rut_mount"], "lust": 1.5}
RUT_DESC = "正值發情期，躁動好鬥：傷害 +1、豁免 -1；注意力渙散，比較不受仇恨牽引；比較想用慾望攻擊，還會撲上來磨蹭（技能「發情撲上」）；受到的魅惑 ×1.25，開戰時帶著慾望（慾望戰鬥）。只會出現在資料標明 rut 的怪物身上。"
ALL_FOE_ABILITY_IDS = sorted({x for v in FOE_PATCH.values() for x in v})


def write_s8_7():
    p = 'data/rules/abilities.json'
    t = open(p).read()
    for a in FOE_ABILITIES:
        t = drop_lines(t, r'\n    \{"id": "' + a['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "m_lust_kiss".*', ['    ' + json.dumps(a, ensure_ascii=False) for a in FOE_ABILITIES])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/statuses.json'
    t = open(p).read()
    for k in FOE_STATUSES:
        t = drop_lines(t, r'\n    "' + k + r'": \{.*')
    lines = [f'    "{k}": ' + json.dumps(v, ensure_ascii=False).replace('{"', '{ "').replace('}', ' }') for k, v in FOE_STATUSES.items()]
    t = insert_after(t, r'\n    "exposed": \{.*', lines)
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/enemies.json'
    t = open(p).read()
    for mid, extra in FOE_PATCH.items():
        m = re.search(r'\n    \{"id": "' + mid + r'".*', t)
        line = m.group(0)
        am = re.search(r'"abilities": \[([^\]]*)\]', line)
        have = [x.strip().strip('"') for x in am.group(1).split(',') if x.strip()]
        have = [x for x in have if x not in ALL_FOE_ABILITY_IDS or x in extra]
        for x in extra:
            if x not in have:
                have.append(x)
        line2 = line[:am.start()] + '"abilities": ' + json.dumps(have, ensure_ascii=False) + line[am.end():]
        t = t.replace(line, line2)
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/monster_traits.json'
    d = json.loads(open(p).read())
    t = open(p).read()
    old_desc = d['traits']['rut']['desc']
    t = t.replace(json.dumps(old_desc, ensure_ascii=False), json.dumps(RUT_DESC, ensure_ascii=False))
    t = re.sub(r'("xp_mult": 1.1, "ai": \{ "focus": 0.5)(, "lust": [\d.]+)?( \})(, "abilities": \[[^\]]*\])?', r'\1, "lust": 1.5\3, "abilities": ["rut_mount"]', t)
    json.loads(t)
    assert json.loads(t)['traits']['rut']['abilities'] == ['rut_mount']
    open(p, 'w').write(t)
    print('S8-7 abilities', len(FOE_ABILITIES), 'monsters', len(FOE_PATCH))


# ---------------- S8-9 家具與調教 ----------------
TRAINING_FURNITURE = [
    {"name": "調教台", "category": "furniture", "price_cc": 1200, "tags": ["tailor"], "adult": True, "min_location": "city",
     "furniture": {"places": ["indoor", "basement"], "function": "training", "training": 2, "icon": "⛓️"},
     "desc": "包著軟皮的長台，四角都有扣環，旁邊的架子掛滿了各式道具。擺在家裡，在家調教時檢定 +2；留在家裡的奴隸每天順從 +1。"},
    {"name": "刑架", "category": "furniture", "price_cc": 600, "tags": ["smith"], "adult": True,
     "furniture": {"places": ["indoor", "basement", "yard"], "function": "training", "training": 1, "icon": "🪵"},
     "desc": "X 字形的木架，手腕、腳踝的位置都有鐵環。擺在家裡，在家調教時檢定 +1；留在家裡的奴隸每天順從 +1。"},
    {"name": "拘束台", "category": "furniture", "price_cc": 800, "tags": ["smith"], "adult": True,
     "furniture": {"places": ["indoor", "basement"], "function": "training", "training": 1, "icon": "🛏️"},
     "desc": "鐵框加上皮帶的窄台，躺上去就動彈不得。擺在家裡，在家調教時檢定 +1；留在家裡的奴隸每天順從 +1。"},
]
TRAINING_ROOM = {"room_max": 3, "resident_submission": 1, "escape_chance": 0.3}
HOME_EVENTS = [
    {"id": "home_rack", "weight": 2, "at_home": True, "adult": True, "tags_none": ["good"], "scene": "被{master}綁在刑架上",
     "text": "{master}把你帶到地下室，牆邊立著一座 X 字形的刑架，鐵環在燭光下閃著冷光。「今天就在這裡反省吧。」",
     "hours": 0.5, "options": [
        {"label": "乖乖讓主人綁上去", "adult_scene": "always", "result": "你自己把手腕伸進鐵環。{master}慢慢地扣上，一直到天亮才把你放下來。",
         "effects": [{"type": "affinity", "npc": "master", "delta": 3, "reason": "乖乖受罰"}, {"type": "lewd", "stat": "submission", "delta": 1}], "hours": 6},
        {"label": "求主人手下留情", "check": {"attr": "cha", "dc": 14}, "success": "{master}看你可憐的樣子，只綁了一個時辰就放你下來。",
         "fail": "{master}笑著說求饒的樣子更好看，把鐵環又扣緊了一格。", "adult_scene": "fail",
         "effects_success": [{"type": "affinity", "npc": "master", "delta": 1, "reason": "會撒嬌"}], "fail_effects": [{"type": "lewd", "stat": "sensitivity", "delta": 1}, {"type": "condition", "target": "pc", "condition": "drained", "add": True}], "hours": 2},
        {"label": "掙扎著不肯過去", "stance": "resist", "check": {"attr": "str", "dc": 16}, "success": "你甩開{master}的手，{master}沉著臉，終究沒有硬來。",
         "fail": "{master}叫來僕人按住你，綁得比平常更緊。", "adult_scene": "fail",
         "effects_success": [{"type": "affinity", "npc": "master", "delta": -2, "reason": "不肯受罰"}], "fail_effects": [{"type": "condition", "target": "pc", "condition": "punished", "add": True}, {"type": "strict", "delta": 1}]}]},
    {"id": "home_restraint_bed", "weight": 2, "at_home": True, "adult": True, "scene": "在{master}的拘束台上過夜",
     "text": "{master}的寢室旁多了一張鐵框窄台，皮帶一條條垂在兩側。「今晚睡這裡。」",
     "hours": 0.25, "options": [
        {"label": "躺上去，讓主人扣上皮帶", "adult_scene": "always", "result": "皮帶一條條收緊，你一整夜都動彈不得，{master}時不時過來看你。",
         "effects": [{"type": "affinity", "npc": "master", "delta": 3, "reason": "順從"}, {"type": "lewd", "stat": "endurance", "delta": 1}], "hours": 8},
        {"label": "說服主人讓你睡在床邊就好", "check": {"attr": "cha", "dc": 13}, "success": "{master}想了想，丟了一條毯子給你，讓你睡在床腳。",
         "fail": "{master}搖搖頭，指了指那張台子。", "adult_scene": "fail",
         "effects_success": [{"type": "condition", "target": "pc", "condition": "relaxed", "add": True}], "fail_effects": [{"type": "lewd", "stat": "submission", "delta": 1}], "hours": 8},
        {"label": "趁主人不注意，鬆開一條皮帶", "stance": "resist", "check": {"attr": "dex", "dc": 15}, "success": "半夜你悄悄鬆開一條皮帶，總算能翻個身。",
         "fail": "{master}一早就發現皮帶鬆了，加罰你在台上多躺半天。",
         "effects_success": [{"type": "condition", "target": "pc", "condition": "well_rested", "add": True}], "fail_effects": [{"type": "condition", "target": "pc", "condition": "punished", "add": True}, {"type": "affinity", "npc": "master", "delta": -2, "reason": "偷偷鬆綁"}], "hours": 8}]},
    {"id": "home_training_room", "weight": 2, "at_home": True, "adult": True, "affinity_min": 10, "scene": "在{master}的調教室裡",
     "text": "{master}推開一扇你沒進去過的門：裡面是一間擺滿道具的調教室，正中央是一張包著軟皮的長台。「從今天開始，每天都來這裡。」",
     "hours": 0.25, "teaches": ["lust_grovel"], "options": [
        {"label": "跪下來說「請主人調教」", "adult_scene": "always", "learn": True, "result": "{master}滿意地摸了摸你的頭，花了整個下午教你怎麼當一個好奴隸。",
         "effects": [{"type": "affinity", "npc": "master", "delta": 4, "reason": "主動求調教"}, {"type": "lewd", "stat": "submission", "delta": 2}], "hours": 4},
        {"label": "低著頭，跟著進去", "check": {"attr": "fai", "dc": 13}, "success": "你咬著牙撐過了這一天，心裡那條線還在。",
         "fail": "一個下午過去，你已經記不得自己原本在堅持什麼。", "adult_scene": "always",
         "effects_success": [{"type": "lewd", "stat": "endurance", "delta": 1}], "fail_effects": [{"type": "lewd", "stat": "submission", "delta": 1}, {"type": "condition", "target": "pc", "condition": "dazed", "add": True}], "hours": 4},
        {"label": "站在門口不肯進去", "stance": "resist", "check": {"attr": "fai", "dc": 15}, "success": "{master}看了你很久，最後把門關上了。「總有一天你會自己走進來。」",
         "fail": "{master}拉著你的項圈把你拖了進去。", "adult_scene": "fail",
         "effects_success": [{"type": "affinity", "npc": "master", "delta": -2, "reason": "不肯進調教室"}], "fail_effects": [{"type": "condition", "target": "pc", "condition": "punished", "add": True}, {"type": "lewd", "stat": "submission", "delta": 1}], "hours": 3}]},
]


def write_s8_9():
    p = 'data/rules/items.json'
    t = open(p).read()
    for it in TRAINING_FURNITURE:
        t = drop_lines(t, r'\n    \{"name": ' + re.escape(json.dumps(it['name'], ensure_ascii=False)) + r'.*')
    t = insert_after(t, r'\n    \{ "name": "石雕像".*', ['    ' + json.dumps(x, ensure_ascii=False) for x in TRAINING_FURNITURE])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/lewd.json'
    d = json.loads(open(p).read())
    t = open(p).read()
    for k, v in TRAINING_ROOM.items():
        t = re.sub(r', "' + k + r'": [\d.]+', '', t)
    t = t.replace('"backlash_delta": ' + str(d['training']['backlash_delta']), '"backlash_delta": ' + str(d['training']['backlash_delta']) + ''.join(f', "{k}": {v}' for k, v in TRAINING_ROOM.items()), 1)
    assert json.loads(t)['training']['room_max'] == 3
    open(p, 'w').write(t)

    p = 'data/rules/slavery.json'
    t = open(p).read()
    for e in HOME_EVENTS:
        t = drop_lines(t, r'\n      \{ ?"id": "' + e['id'] + r'".*')
    # 主人事件多半是多行的物件：接在「打掃房子」前面
    anchor = '\n      { "id": "home_chores"'
    t = t.replace(anchor, '\n' + ''.join('      ' + json.dumps(e, ensure_ascii=False) + ',\n' for e in HOME_EVENTS) + anchor[1:], 1)
    json.loads(t)
    open(p, 'w').write(t)
    print('S8-9 furniture', len(TRAINING_FURNITURE), 'home events', len(HOME_EVENTS))


if __name__ == '__main__':
    write_s8_3()
    write_s8_4()
    write_s8_6()
    write_s8_7()
    write_s8_9()
