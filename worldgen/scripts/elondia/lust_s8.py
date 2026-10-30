# 慾望戰鬥 S8 的資料（規則寫在 docs/LEWD_STATS.md）：
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
    t = insert_after(t, r'\n    \{"name": "緋夢夫人的吊帶襪".*', ['    ' + json.dumps(x, ensure_ascii=False) for x in ITEMS])
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
    "$comment": "脫縛（docs/LEWD_STATS.md 第 16 節）。嘗試脫縛：DC = base + 鎖的 lock_dc + 拘束程度 × bind_dc − 忍耐 / endurance_per；靈巧檢定（雙手被綁的減值照雙面效應算在檢定上）。只有別人鎖上的拘束具（主人強制戴上的、陷阱鎖住的）才需要；成功時鎖被弄壞、拘束具可以卸下。主人在身邊時，失敗輕度懲罰、大失敗嚴厲懲罰；大失敗順從 + fumble_submission。鑰匙（物品的 key）打開同等級以下的鎖，用一次就沒了，鎖歸自己。keys：擊敗人形的敵人（持有裝備的怪物、敵對冒險者）時 chance 的機率搜到一把，依敵人等級（levels：[最低等級, 鎖的等級]）。cut：陷阱鎖（事件的 restrain，第 27 節）可以在 shops 的店請人剪掉，依鎖的等級收 fee_cc；主人的鎖不能剪。combat：戰鬥中的拘束（狀態有 struggle）用掙脫（自己）或撕開（隊友）擺脫，花 ap 行動點；1d20 + 熟練 + 力量、靈巧較高的調整值，DC = base + 施加者等級 × per_level + 狀態的 struggle，自己雙手被綁 + hands。",
    "attr": "dex",
    "base": 10,
    "lock_dc": {"white": 0, "blue": 2, "rune": 4, "gold": 6},
    "bind_dc": 1,
    "endurance_per": 20,
    "fumble_submission": 1,
    "keys": {"chance": 0.1, "levels": [[1, "white"], [6, "blue"], [11, "rune"], [16, "gold"]]},
    "combat": {"ap": 1, "base": 10, "per_level": 0.5, "hands": 2},
    "cut": {"shops": ["smithy"], "fee_cc": {"white": 50, "blue": 200, "rune": 800, "gold": 3000}},
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


# ---------------- S8-10 城鎮、商店、旅途、場所 ----------------
CHARM_GOODS = [
    {"name": "媚香蠟燭", "category": "consumable", "price_cc": 90, "tags": ["general"], "adult": True, "charm_min": 3,
     "use": {"condition": "aroused"}, "desc": "淫市裡賣的粉紅色蠟燭，點起來滿屋子甜膩的香氣。聞過的人發情（開戰時帶著慾望），想靠引爆、自我挑逗打的人會想要。"},
    {"name": "鈴鐺頸環", "category": "equipment", "price_cc": 260, "tags": ["tailor"], "adult": True, "charm_min": 3,
     "gear": {"base": "choker", "material": "silk", "lewd": {"submission": 5, "lewdness": 5}},
     "desc": "綴著一顆小金鈴的絲質頸環，走一步響一聲。淫市的裁縫說，戴上它的人會越來越聽話。"},
]
SLAVE_ROOM = {
    "$comment": "驛站的奴房（docs/LEWD_STATS.md 第 20 節）：魅氣濃度 charm_min 以上的聚落，旅店多一個便宜的選項（玩家自己選；內容篩選關掉「主角非自願」時沒有）。全隊和住旅店一樣長休，房錢是旅店的 cost_ratio；主角順從 + submission，learn_chance 的機率學會 abilities 裡的一個色情技能，醒來時 condition。",
    "charm_min": 3, "cost_ratio": 0.3, "submission": 1, "learn_chance": 0.25, "abilities": ["lust_endure", "lust_grovel", "lust_pour_charm"], "condition": "drained",
    "scene": "主角住進驛站的奴房：一整晚被鎖在床頭，路過的客人都能推門進來",
}
EXPOSURE_EVENTS = [
    {"id": "town_fan", "scope": "town", "tier": "normal", "kind": "choice", "cells": ["tavern", "inn", "shop"], "category": "social",
     "requires": {"stats": {"exposure": {"min": 40}}}, "tags": ["adult", "male_partner"], "pc_body": ["fem", "andro"], "cooldown_days": 7,
     "title": "認出你的人", "text": "鄰桌的年輕人一直偷看你，終於鼓起勇氣湊過來：「你、你就是那個……大家都在說的冒險者吧？我、我能請你喝一杯嗎？」",
     "scene": "主角讓崇拜者帶回房間，年輕人笨手笨腳卻熱情得要命，主角一邊教一邊享受，天亮時對方還捨不得放手",
     "options": [
        {"label": "笑著讓他請", "check": {"attr": "cha", "dc": 11}, "success": {"text": "你們聊了一晚上，他把你的冒險故事一字不漏地記了下來，臨走前硬塞了一袋錢給你。", "effects": [{"type": "money", "amount": 40}, {"type": "lewd", "stat": "exposure", "delta": 2}]},
         "fail": {"text": "他喝多了，開始大聲問那些傳聞是不是真的，整間店的人都轉過頭來看你。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 4}]}},
        {"label": "帶他回房間", "success": {"text": "你牽著他的手上了樓。第二天他紅著臉離開，說這是他這輩子最好的一晚。", "effects": [{"type": "lewd", "stat": "lewdness", "delta": 1}, {"type": "lewd", "stat": "exposure", "delta": 3}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "always"},
        {"label": "裝作認錯人", "check": {"attr": "int", "dc": 12}, "success": {"text": "你說他認錯人了。他愣了一下，紅著臉道歉走開。"},
         "fail": {"text": "他一臉「我懂」的表情，說會替你保密——然後轉頭就跟朋友說了。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 2}]}}]},
    {"id": "town_noble_salon", "scope": "town", "tier": "normal", "kind": "choice", "cells": ["tavern", "inn", "jeweler", "tailor"], "category": "opportunity",
     "location_types": ["city", "capital"], "requires": {"stats": {"exposure": {"min": 60}}}, "tags": ["adult", "male_partner"], "pc_body": ["fem", "andro"], "cooldown_days": 14,
     "title": "貴族沙龍的邀請", "text": "一個穿著體面的僕人遞上一張燙金的請柬：「我家主人久仰您的大名，今晚的私人沙龍，想請您當座上賓。」請柬背面用小字寫著：穿得少一點。",
     "scene": "主角在貴族的私人沙龍裡被當成餘興節目，賓客們輪流上前，一整晚沒有停過",
     "options": [
        {"label": "赴約，當今晚的主角", "success": {"text": "沙龍裡的人都知道你是誰。你被當成今晚的主菜，天亮時口袋裡塞滿了賞錢，名聲也傳得更遠了。", "effects": [{"type": "money", "amount": 300}, {"type": "lewd", "stat": "exposure", "delta": 5}, {"type": "lewd", "stat": "lewdness", "delta": 2}, {"type": "condition", "target": "pc", "condition": "drained", "add": True}]}, "adult_scene": "always"},
        {"label": "赴約，但只陪聊", "check": {"attr": "cha", "dc": 15}, "success": {"text": "你用談吐把整場沙龍的焦點留在故事上，主人很滿意，還說要介紹幾個委託給你。", "effects": [{"type": "money", "amount": 120}, {"type": "xp", "amount": 40}]},
         "fail": {"text": "賓客們對故事沒興趣，你被半推半就地拉進了內廳。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 3}, {"type": "condition", "target": "pc", "condition": "disheveled", "add": True}]}, "adult_scene": "fail"},
        {"label": "婉拒", "success": {"text": "你把請柬還給僕人。他鞠了個躬，什麼也沒說。"}}]},
    {"id": "town_guard_toll", "scope": "town", "tier": "normal", "kind": "choice", "cells": ["gate"], "category": "trouble",
     "requires": {"stats": {"exposure": {"min": 60}}}, "tags": ["adult", "pc_unwilling", "male_partner"], "pc_body": ["fem", "andro"], "cooldown_days": 10,
     "title": "衛兵的「通行費」", "text": "城門的衛兵一看到你就笑了：「喲，這不是那個有名的……」他攔下你，壓低聲音：「通行費得另外算。去後面的崗哨，讓兄弟們檢查一下。」",
     "scene": "主角被衛兵帶進城門邊的崗哨，換班的衛兵一個接一個進來「檢查」，直到天黑才放主角走",
     "options": [
        {"label": "跟他去崗哨", "success": {"text": "你在崗哨裡待到天黑。出來的時候，衛兵們對你客氣多了，說以後進出不用排隊。", "effects": [{"type": "lewd", "stat": "submission", "delta": 1}, {"type": "lewd", "stat": "exposure", "delta": 2}, {"type": "condition", "target": "pc", "condition": "drained", "add": True}]}, "adult_scene": "always"},
        {"label": "亮出冒險者公會的牌子", "check": {"attr": "cha", "dc": 14}, "success": {"text": "你冷冷地說公會會很樂意聽聽這件事。衛兵的臉色變了，揮手放行。"},
         "fail": {"text": "衛兵嗤笑一聲：「公會？他們才不管你這種人。」你被拖進了崗哨。", "effects": [{"type": "lewd", "stat": "submission", "delta": 1}, {"type": "condition", "target": "pc", "condition": "drained", "add": True}]}, "adult_scene": "fail"},
        {"label": "塞錢了事", "success": {"text": "你塞了幾枚銀幣過去。衛兵掂了掂，不太滿意，但還是放你過去了。", "effects": [{"type": "money", "amount": -30}]}}]},
    {"id": "road_recognized", "tier": "normal", "kind": "choice", "category": "social", "modes": ["road", "trail"],
     "requires": {"stats": {"exposure": {"min": 40}}}, "tags": ["adult", "male_partner"], "pc_body": ["fem", "andro"],
     "title": "路上被認出來", "text": "迎面而來的商隊放慢了速度。領頭的商人盯著你看了好一會兒，眼睛一亮：「哎呀，這不是……！我在城裡聽過你的事。順路的話，晚上一起紮營吧？」",
     "scene": "主角在商隊的營火邊被商人們圍著，一個接一個地帶進帳篷",
     "options": [
        {"label": "一起紮營，陪他們過夜", "success": {"text": "那一晚的營地很熱鬧。天亮時商人們送了你一些補給，還說下次一定要再遇到。", "effects": [{"type": "item", "name": "乾糧", "qty": 3}, {"type": "money", "amount": 60}, {"type": "lewd", "stat": "exposure", "delta": 2}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "always"},
        {"label": "一起紮營，但只是聊天", "check": {"attr": "cha", "dc": 13}, "success": {"text": "你講了一晚上的冒險故事，商人們聽得入迷，天亮時送了你一包補給。", "effects": [{"type": "item", "name": "乾糧", "qty": 2}]},
         "fail": {"text": "商人們聽著聽著，手就不太安分了。你好不容易才脫身，回到隊伍時衣服都皺了。", "effects": [{"type": "condition", "target": "pc", "condition": "disheveled", "add": True}]}},
        {"label": "婉拒，繼續趕路", "success": {"text": "你揮揮手，商隊遺憾地走遠了。"}}]},
]

ADULT_QUESTS = [
    {"id": "dancer_standin", "spot": "tavern", "kind": "patrol", "area": "town", "title": "替{town}酒館的舞孃代班一晚", "scene": "{town}酒館的小舞台，台下的酒客吹著口哨",
     "hours": 5, "dc": 12, "reward_cc": [90, 130], "requires": {"stats": {"lewdness": {"min": 40}}}, "tags": ["adult"],
     "rewards": [{"type": "lewd", "stat": "exposure", "delta": 2}]},
    {"id": "noble_banquet_act", "spot": "inn", "kind": "patrol", "area": "town", "title": "{town}貴族宴會的餘興表演", "scene": "{town}旅店的宴會廳，包場的貴族們等著看你",
     "hours": 4, "dc": 13, "reward_cc": [160, 220], "requires": {"stats": {"exposure": {"min": 60}}}, "tags": ["adult"],
     "rewards": [{"type": "lewd", "stat": "exposure", "delta": 3}, {"type": "lewd", "stat": "lewdness", "delta": 1}]},
]


def write_s8_10():
    p = 'data/rules/items.json'
    t = open(p).read()
    for it in CHARM_GOODS:
        t = drop_lines(t, r'\n    \{"name": ' + re.escape(json.dumps(it['name'], ensure_ascii=False)) + r'.*')
    t = insert_after(t, r'\n    \{"name": "緋夢夫人的吊帶襪".*', ['    ' + json.dumps(x, ensure_ascii=False) for x in CHARM_GOODS])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = drop_lines(t, r'\n  "slave_room": \{.*')
    t = t.replace('\n  "park": {', '\n  "slave_room": ' + json.dumps(SLAVE_ROOM, ensure_ascii=False) + ',\n  "park": {', 1)
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in EXPOSURE_EVENTS:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "town_grope".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in EXPOSURE_EVENTS])
    json.loads(t)
    open(p, 'w').write(t)
    p = 'data/rules/town_quests.json'
    t = open(p).read()
    for q in ADULT_QUESTS:
        t = drop_lines(t, r'\n    \{"id": "' + q['id'] + r'".*')
    # 範本多半是多行的物件：接在陣列的最後
    end = t.rindex('\n  ]')
    t = t[:end] + ',\n' + ',\n'.join('    ' + json.dumps(q, ensure_ascii=False) for q in ADULT_QUESTS) + t[end:]
    json.loads(t)
    open(p, 'w').write(t)
    print('S8-10 goods', len(CHARM_GOODS), 'events', len(EXPOSURE_EVENTS), 'quests', len(ADULT_QUESTS))


# ---------------- S8-11 淫鬥場 ----------------
ARENA = {
    "$comment": "淫鬥場（docs/LEWD_STATS.md 第 21 節）：魅氣濃度 charm_min 以上的聚落，站在 cells 的設施（娼館、酒館）可以報名；慾望戰鬥關閉時沒有。報名費 fee；三種擂臺（rings），每贏 streak_per_tier 場往上一級對手（tiers 是各級的對手組合），輸了連勝歸零。獎金 = prize.base + prize.per_tier × 對手等級（0 起算）；勝場另外有 item_chance 拿到 items 裡的一樣，對手等級 book_tier 以上有 book_chance 拿到 books 裡的一本。賭注賽（wager）：報名費與獎金 × wager.mult，輸了曝露名聲、順從另外上升（wager.loss）。restraint：上場前選一件行囊裡的拘束具戴上、用白鐵鎖鎖上，打完拿掉。lust_only：性戰場——生命傷害關閉，非魅惑的傷害改成 lust_convert 比例的慾望；雙方都用我方的「三次」規則（高潮不扣生命，第三次倒下）。輸了不會損失錢、不會有戰敗事件。",
    "charm_min": 3, "cells": ["brothel", "tavern"], "fee": 30, "streak_per_tier": 2,
    "prize": {"base": 60, "per_tier": 50},
    "item_chance": 0.3, "items": ["媚藥瓶", "清心茶", "媚香精油"],
    "book_tier": 3, "book_chance": 0.1,
    "books": ["《斟酒的媚態》", "《魔導刺激》", "《莊家的賭局》", "《萬眾矚目》", "《搓背的手藝》", "《熱泉的耐性》", "《十指的特別服務》", "《定格的姿態》", "《戰利品的覺悟》", "《獻祭的契紋》", "《求偶紋》", "《潮之新娘》"],
    "wager": {"mult": 3, "loss": {"exposure": 3, "submission": 1}},
    "lust_convert": 0.5,
    "rings": {
        "beast": {"name": "淫物場", "desc": "和園區運來的淫獸、淫蟲打：考的是慾望攻擊與慾望勝利。",
                  "tiers": [[["lp_lewd_cat", 1]], [["lp_lewd_cat", 2]], [["lp_lewd_monkey", 1]], [["lp_lewd_hound", 1]], [["lp_lewd_fox", 1]], [["lp_rut_boar", 1]], [["lp_nine_tail", 1]]]},
        "bound": {"name": "拘束戰鬥場", "desc": "上場前選一件拘束具戴上、鎖好，打完拿掉：考的是雙面效應。", "restraint": True,
                  "tiers": [[["bandit", 2]], [["highway_robber", 1]], [["tea_road_bandit", 2]], [["slaver_thug", 1]], [["brand_raider", 2]], [["slaver_captain", 1]]]},
        "lust": {"name": "性戰場", "desc": "生命傷害關閉，只算慾望；先讓對方高潮三次的贏。", "lust_only": True,
                 "tiers": [[["lp_succ_dancer", 1]], [["lp_incubus", 1]], [["lp_succ_diva", 1]], [["honor_succubus", 1]], [["lp_succ_lead", 1]], [["incubus_enforcer", 1]]]},
    },
}


def write_s8_11():
    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = drop_lines(t, r'\n  "arena": \{.*')
    t = t.replace('\n  "park": {', '\n  "arena": ' + json.dumps(ARENA, ensure_ascii=False) + ',\n  "park": {', 1)
    d = json.loads(t)
    enemies = {e['id'] for e in json.load(open('data/rules/enemies.json'))['enemies']}
    items = {i['name'] for i in json.load(open('data/rules/items.json'))['items']}
    for ring in d['arena']['rings'].values():
        for tier in ring['tiers']:
            for mid, _ in tier:
                assert mid in enemies, mid
    for n in d['arena']['books'] + d['arena']['items']:
        assert n in items, n
    open(p, 'w').write(t)
    print('S8-11 arena rings', len(ARENA['rings']))


# ---------------- S8-12 淫器合煉 ----------------
FUSION = {
    "$comment": "淫器合煉（docs/LEWD_STATS.md 第 22 節）：在 shops 的店把一件武器和一件拘束具合成「淫器」，收 fee_cc；平常是拘束具（雙面效應照算，日常的檢定減值 × penalty_mult），戰鬥時展開成那件武器。最近 days 天裡穿了幾天決定武器傷害的倍率（tiers：[至少幾天, 倍率]，由高到低）；更少時展開不了（照原本的武器打）。可以在同一種店拆回原本的兩件，不收錢。",
    "shops": ["smithy"], "fee_cc": 400, "days": 10, "tiers": [[9, 1.5], [7, 1.0], [4, 0.5]], "penalty_mult": 1.5,
}


def write_s8_12():
    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = drop_lines(t, r'\n  "fusion": \{.*')
    t = t.replace('\n  "park": {', '\n  "fusion": ' + json.dumps(FUSION, ensure_ascii=False) + ',\n  "park": {', 1)
    json.loads(t)
    open(p, 'w').write(t)
    print('S8-12 fusion')


# ---------------- S8-13 奴隸的身價、NPC 的流派、形象圖 ----------------
SLAVE_PRICE = {
    "$comment": "奴隸的身價（docs/LEWD_STATS.md 第 23 節）：指標超過 above 的部分每點 × per（四項各自的權重），加上會的色情技能每個 per_skill，合計最多 + max；乘在原本的身價上（市場上的奴隸、主角出售自己）。",
    "above": 50, "per": {"submission": 0.006, "lewdness": 0.004, "sensitivity": 0.002, "endurance": 0.003}, "per_skill": 0.04, "max": 0.6,
}
NPC_SCHOOLS = {
    "$comment": "娼妓、奴隸 NPC 帶流派的入門特質（依 id 固定地擲，內容頁籤指定了特質的固定 NPC 不擲）：tags 的標籤有 chance 的機率帶 schools 裡的一個。",
    "tags": {"prostitute": {"chance": 0.5, "schools": ["school_indulgence", "school_exhibition", "school_flesh"]},
             "slave": {"chance": 0.4, "schools": ["school_servitude", "school_bondage", "school_punishment"]}},
}
PORTRAIT = {
    "$comment": "形象圖的慾望氣質（docs/PORTRAITS.md 第 2 節的 {allure}）：淫亂、曝露名聲（目前的地區）達到門檻時，用最高的那一句英文描述。",
    "lewdness": [[40, "a hint of allure in the eyes"], [60, "seductive gaze, faintly flushed cheeks"], [80, "openly sultry expression, flushed cheeks, inviting pose"]],
    "exposure": [[60, "confident, provocative pose, aware of being watched"], [80, "notorious exhibitionist air, deliberately revealing pose"]],
}


def write_s8_13():
    p = 'data/rules/lewd.json'
    t = open(p).read()
    for k in ['slave_price', 'npc_schools', 'portrait']:
        t = drop_lines(t, r'\n  "' + k + r'": \{.*')
    t = t.replace('\n  "park": {', '\n  "slave_price": ' + json.dumps(SLAVE_PRICE, ensure_ascii=False) + ',\n  "npc_schools": ' + json.dumps(NPC_SCHOOLS, ensure_ascii=False) + ',\n  "portrait": ' + json.dumps(PORTRAIT, ensure_ascii=False) + ',\n  "park": {', 1)
    d = json.loads(t)
    perks = {x['id'] for x in json.load(open('data/rules/perks.json'))['perks']}
    for v in d['npc_schools']['tags'].values():
        for sid in v['schools']:
            assert sid in perks, sid
    open(p, 'w').write(t)
    print('S8-13 slave price, npc schools, portrait')


# ---------------- S8-14 淫服的雙面效應、淫服裁縫鋪、拍賣會、園區的事件與寶箱 ----------------
OUTFIT_TWO_FACE = {
    "$comment": "淫服的雙面效應（docs/LEWD_STATS.md 第 24 節）：身上的成人向服裝（底材的 outfit = adult）每件算一件，最多 max_pieces 件。平常：和 penalty_tags 的人打交道（penalty_kinds 的行動）每件 -penalty_per，最多 -penalty_max，每 endurance_per 點忍耐減輕 1。戰鬥中（慾望戰鬥開著）：修了 schools 裡的流派時每件給那一行的加成（lust_bonus 造成的魅惑傷害 +N、evade 迴避、save 豁免；禁慾派是負的）。",
    "penalty_tags": ["noble", "royal", "priest", "bishop"], "penalty_kinds": ["chat", "gift", "flatter", "hire", "invite", "haggle", "bargain", "negotiation"],
    "penalty_per": 1, "penalty_max": 2, "endurance_per": 40, "max_pieces": 3,
    "schools": {"indulgence": {"lust_bonus": 1}, "exhibition": {"evade": 1}, "abstinence": {"save": -1}},
}
OUTFIT_TAILOR = {
    "$comment": "淫服裁縫鋪（docs/LEWD_STATS.md 第 25 節）：魅氣濃度 charm_min 以上的城鎮，裁縫店可以訂做成人向服裝（底材的 outfit = adult），選一項慾望指標加成；加成依材料（bonus），收費 = 底材 × 材料的價格 × fee_mult + fee_base。",
    "charm_min": 3, "fee_mult": 3, "fee_base": 150, "stats": ["lewdness", "sensitivity", "endurance", "submission"],
    "bonus": {"linen": 4, "silk": 6, "moonsilk": 8, "spellweave": 10, "leather": 4, "hard_leather": 6, "beast_hide": 8, "dragonhide": 10, "copper": 4, "silver": 6, "gold": 8, "mithril_jewel": 10},
}
LUST = lambda x: {"offense": {"lust": x}}
AUCTION_ITEMS = [
    {"name": "緋夢夫人的舊項圈", "category": "equipment", "price_cc": 3200, "tags": [], "adult": True, "desc": "緋夢夫人年輕時戴過的蕾絲項圈，據說戴上的人說話會帶著夫人的腔調。只在拍賣會出現。",
     "gear": {"base": "lace_choker", "material": "moonsilk", "rarity": "epic", "lewd": {"submission": 8}, "enchants": LUST(0.25)}},
    {"name": "夢魔的薄紗睡衣", "category": "equipment", "price_cc": 2800, "tags": [], "adult": True, "desc": "夢魔氏族的長老穿過的薄紗睡衣，穿上它睡覺會做很長的夢。只在拍賣會出現。",
     "gear": {"base": "sheer_negligee", "material": "moonsilk", "rarity": "epic", "lewd": {"lewdness": 8, "sensitivity": 4}, "enchants": {"resist": {"lust": -0.2}}}},
    {"name": "鍍金的鈴鐺乳環", "category": "equipment", "price_cc": 2400, "tags": [], "adult": True, "desc": "一對鍍金的乳環，各掛一顆小鈴鐺，走一步響一聲。只在拍賣會出現。",
     "gear": {"base": "nipple_ring", "material": "gold", "rarity": "rare", "lewd": {"sensitivity": 8}, "enchants": LUST(0.2)}},
    {"name": "交際花的黑蕾絲網襪", "category": "equipment", "price_cc": 2000, "tags": [], "adult": True, "desc": "名花樓的交際花在宴會上穿的網襪，網眼細得像蕾絲。只在拍賣會出現。",
     "gear": {"base": "fishnet", "material": "silk", "rarity": "rare", "lewd": {"lewdness": 6}, "enchants": {"mods": {"evade": 1}}}},
]
PARK_OUTFITS = [
    {"name": "牧場的乳牛裝", "category": "equipment", "price_cc": 1400, "tags": [], "adult": True, "desc": "淫獸牧場的工作服：黑白斑點的兔女郎裝，脖子上還有一顆牛鈴。",
     "gear": {"base": "bunny_suit", "material": "silk", "rarity": "rare", "lewd": {"lewdness": 5, "sensitivity": 5}, "enchants": LUST(0.15)}},
    {"name": "溫室的花蜜網襪", "category": "equipment", "price_cc": 900, "tags": [], "adult": True, "desc": "沾滿花蜜、黏答答的網襪，蟲子聞到味道都會靠過來。",
     "gear": {"base": "fishnet", "material": "silk", "rarity": "rare", "lewd": {"sensitivity": 6}, "enchants": {"resist": {"lust": -0.1}}}},
    {"name": "水族館的濕身緊身衣", "category": "equipment", "price_cc": 1500, "tags": [], "adult": True, "desc": "永遠是濕的皮緊身衣，貼在身上一點縫都沒有。",
     "gear": {"base": "leather_bodysuit", "material": "hard_leather", "rarity": "rare", "lewd": {"endurance": 6}, "enchants": {"resist": {"lust": -0.15}}}},
    {"name": "花園的藤蔓丁字褲", "category": "equipment", "price_cc": 800, "tags": [], "adult": True, "desc": "細藤編成的丁字褲，偶爾會自己縮緊一下。",
     "gear": {"base": "thong", "material": "silk", "rarity": "rare", "lewd": {"lewdness": 6}, "enchants": LUST(0.1)}},
    {"name": "劇場的舞孃薄紗", "category": "equipment", "price_cc": 1600, "tags": [], "adult": True, "desc": "夢魔劇場的舞孃穿的薄紗，在燈光下幾乎是透明的。",
     "gear": {"base": "sheer_negligee", "material": "moonsilk", "rarity": "rare", "lewd": {"lewdness": 5, "submission": 3}, "enchants": LUST(0.2)}},
]
PARK_OUTFIT_CHANCE = 0.03
BOOKS = ["《媚術入門》", "《承歡之道》", "《魅香與媚毒》", "《極樂秘典》", "《傾國》", "《清心訣》"]
AUCTION = {
    "$comment": "拍賣會（docs/LEWD_STATS.md 第 26 節；地標的 auction）：每天上 lots 件拍品（從 pool 依權重抽，不重複），起標價 = 物品價格 × start_ratio，對手最高出價 = 物品價格 × rival_ratio（看不到）。每件每天出一次價：出價高於對手的最高價就得標，付對手的最高價 + 物品價格 × step（不超過你的出價）。寄賣：成人向的物品與色情技能書，以物品價格 × consign_ratio 賣出，扣 consign_fee 的手續費。得標後有 watch_chance 被盯上（城鎮事件「拍賣會上被盯上」）。",
    "lots": 3, "start_ratio": 0.6, "rival_ratio": [0.9, 1.8], "step": 0.05, "consign_ratio": [0.8, 1.6], "consign_fee": 0.1, "watch_chance": 0.5, "watch_flag": "auction_watched",
    "pool": [[x["name"], 3] for x in AUCTION_ITEMS] + [[b, 2] for b in BOOKS] + [["《斟酒的媚態》", 1], ["《魔導刺激》", 1], ["《莊家的賭局》", 1], ["《萬眾矚目》", 1], ["《搓背的手藝》", 1], ["《熱泉的耐性》", 1], ["《十指的特別服務》", 1], ["《定格的姿態》", 1], ["《戰利品的覺悟》", 1], ["《獻祭的契紋》", 1], ["《求偶紋》", 1], ["《潮之新娘》", 1], ["黃金鑰匙", 2], ["黃金鎖", 1], ["魅魔的香精", 2]],
}
AUCTION_LANDMARK = {
    "id": "lm_auction_house", "name": "月下拍賣會", "emoji": "🔨", "location": "albena", "at": {"area": "albena/market", "x": 7, "y": 1}, "types": ["market"],
    "desc": "市集深處一棟掛著紅絲絨簾幕的樓房，每晚舉行不對外宣傳的拍賣會：色情技能書、稀有的淫具，什麼都有人出價。也收寄賣。",
    "scene": "拍賣廳裡燈光昏暗，戴著面具的買家們坐在包廂裡舉牌，台上的拍賣官是個笑容玩味的魅魔。",
    "open": {"adult": True}, "auction": True,
}
WATCH_EVENT = {"id": "town_auction_watched", "scope": "town", "tier": "normal", "kind": "choice", "cells": ["gate", "inn", "tavern", "shop"], "category": "trouble",
    "requires": {"flags": ["auction_watched"]}, "tags": ["adult"], "cooldown_days": 1,
    "title": "拍賣會上被盯上", "text": "從拍賣會出來之後，一直有兩個戴兜帽的人跟在後面。走到人少的地方，他們圍了上來：「剛才那件拍品，借我們看看？」",
    "scene": "跟蹤的兩個人把主角拖進巷子，搜身搜得特別仔細，連衣服底下都不放過",
    "options": [
        {"label": "亮出武器嚇走他們", "check": {"attr": "str", "dc": 13}, "success": {"text": "你拔出武器，他們對看一眼，退進了巷子裡。", "effects": [{"type": "flag", "key": "story:auction_watched", "value": False}]},
         "fail": {"text": "他們一點也不怕。一陣推擠之後，你的錢袋輕了不少。", "effects": [{"type": "money", "amount": -150}, {"type": "flag", "key": "story:auction_watched", "value": False}]}},
        {"label": "鑽進人群甩掉他們", "check": {"attr": "dex", "dc": 13}, "success": {"text": "你拐進市集的人潮裡，再出來時他們已經不見了。", "effects": [{"type": "flag", "key": "story:auction_watched", "value": False}]},
         "fail": {"text": "你被堵在死巷裡。他們把你從頭到腳搜了一遍，搜得特別仔細，最後拿走了一點錢才放你走。", "effects": [{"type": "money", "amount": -100}, {"type": "condition", "target": "pc", "condition": "disheveled", "add": True}, {"type": "flag", "key": "story:auction_watched", "value": False}]}, "adult_scene": "fail"},
        {"label": "破財消災", "success": {"text": "你丟了一袋錢過去。他們掂了掂，消失在人群裡。", "effects": [{"type": "money", "amount": -80}, {"type": "flag", "key": "story:auction_watched", "value": False}]}}]}
B = ["fem", "andro"]
PARK_EVENTS = [
    {"id": "dg_park_beast_milking", "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": ["trap"], "dungeons": ["park_beast"], "tags": ["adult", "pc_unwilling"], "pc_body": B,
     "title": "牧場的擠奶台", "text": "地板突然翻開，你掉進一個木頭隔欄裡，手腳被柵欄卡住、屁股朝外——旁邊的牌子寫著「今日特選・擠奶體驗」。遠處傳來牛鈴聲，越來越近。",
     "scene": "主角被卡在牧場的擠奶隔欄裡，淫獸一隻接一隻排隊過來，像對待母畜一樣把主角從後面「擠」到虛脫",
     "options": [
        {"label": "用力掰開柵欄", "check": {"attr": "str", "dc": 14}, "success": {"text": "木頭在你手裡發出斷裂聲，你在第一頭淫獸走到之前翻了出去。"},
         "fail": {"text": "柵欄紋絲不動。牛鈴聲停在你身後。", "effects": [{"type": "condition", "target": "pc", "condition": "drained", "add": True}, {"type": "lewd", "stat": "submission", "delta": 1}]}, "adult_scene": "fail"},
        {"label": "找卡榫的機關", "check": {"attr": "int", "dc": 13}, "success": {"text": "你摸到柵欄底下的木栓，一拔就開了。"},
         "fail": {"text": "你找到了機關——卻是讓柵欄收得更緊的那一個。", "effects": [{"type": "condition", "target": "pc", "condition": "sensitive", "add": True}, {"type": "condition", "target": "pc", "condition": "drained", "add": True}]}, "adult_scene": "fail"},
        {"label": "認命地等「體驗」結束", "success": {"text": "「體驗」持續了一整個時辰。柵欄鬆開時，你腿軟得站不起來，旁邊還多了一張「優良乳畜」的獎狀。", "effects": [{"type": "condition", "target": "pc", "condition": "afterglow", "add": True}, {"type": "lewd", "stat": "lewdness", "delta": 1}]}, "adult_scene": "always"}]},
    {"id": "dg_park_insect_cocoon", "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": ["gather", "trap"], "dungeons": ["park_insect"], "tags": ["adult", "pc_unwilling"], "pc_body": B,
     "title": "溫室的繭床", "text": "一團溫熱的絲纏住你的腳踝，一路往上捲——你被包進一個半透明的繭裡，繭壁貼著皮膚輕輕地蠕動，裡面的空氣甜得發膩。",
     "scene": "主角被包在蟲繭裡，繭壁像無數細小的觸鬚一樣按摩、吸吮全身，甜膩的空氣讓主角一次次在繭裡高潮",
     "options": [
        {"label": "用刀割開繭壁", "check": {"attr": "dex", "dc": 13}, "success": {"text": "刀刃劃開絲線，你從繭裡滾了出來，渾身都是黏稠的絲。"},
         "fail": {"text": "割開一層又長回一層。甜膩的空氣讓你的手越來越沒力氣。", "effects": [{"type": "condition", "target": "pc", "condition": "aroused", "add": True}, {"type": "lewd", "stat": "sensitivity", "delta": 1}]}, "adult_scene": "fail"},
        {"label": "屏住呼吸、保持清醒", "check": {"attr": "fai", "dc": 14}, "success": {"text": "你守住心神，繭找不到可乘之處，慢慢地鬆開了。"},
         "fail": {"text": "你沒撐多久就吸了一大口甜氣，之後的事情記不太清楚了。", "effects": [{"type": "condition", "target": "pc", "condition": "dazed", "add": True}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "fail"},
        {"label": "在繭裡睡一覺", "success": {"text": "你放棄掙扎，在溫熱的繭裡迷迷糊糊地過了好幾個小時，醒來時繭自己裂開了，身上的傷也好了大半。", "effects": [{"type": "hp", "target": "pc", "ratio": 0.3}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "always"}]},
    {"id": "dg_park_aquarium_tank", "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": ["chest", "trap"], "dungeons": ["park_aquarium"], "tags": ["adult", "pc_unwilling"], "pc_body": B,
     "title": "水族箱的展示", "text": "一隻觸手從水槽裡竄出來，把你整個拖進玻璃水族箱。水是溫的、呼吸得到，玻璃外面——一排遊客正貼著玻璃往裡看。",
     "scene": "主角在水族箱裡被觸手纏住當成展品，玻璃外的遊客看著觸手一寸一寸地玩弄主角，主角想遮也遮不住",
     "options": [
        {"label": "砸破玻璃", "check": {"attr": "str", "dc": 15}, "success": {"text": "玻璃碎了一地，你跟著水一起沖了出來，遊客們尖叫著散開。"},
         "fail": {"text": "玻璃厚得不像話。觸手把你轉過來，正面對著觀眾。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 3}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "fail"},
        {"label": "對觸手獻媚，讓它鬆手", "check": {"attr": "cha", "dc": 13}, "success": {"text": "觸手好像聽懂了，把你輕輕地放回水槽邊。玻璃外有人鼓掌。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 1}]},
         "fail": {"text": "觸手把你的獻媚當成了邀請。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 2}, {"type": "lewd", "stat": "lewdness", "delta": 1}]}, "adult_scene": "fail"},
        {"label": "乾脆好好表演", "success": {"text": "你乾脆配合觸手，給玻璃外的觀眾來了一場表演。結束時，水族箱的工作人員塞給你一袋「演出費」。", "effects": [{"type": "money", "amount": 120}, {"type": "lewd", "stat": "exposure", "delta": 4}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "always"}]},
    {"id": "dg_park_garden_pollen", "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": ["gather"], "dungeons": ["park_garden"], "tags": ["adult"], "pc_body": B,
     "title": "花園的授粉時刻", "text": "整片花田在同一時間開了，粉紅色的花粉像霧一樣升起。花莖彎下來，花心對準了你——牌子上寫著「授粉時間・請勿驚慌」。",
     "scene": "主角在花田裡被一朵朵大花輪流「授粉」，花蕊探進衣服裡，花粉沾滿全身，主角在花海裡喘得說不出話",
     "options": [
        {"label": "用布摀住口鼻衝出去", "check": {"attr": "dex", "dc": 13}, "success": {"text": "你拉起領口摀住口鼻，一口氣衝出花田。", "effects": [{"type": "item", "name": "媚香花蜜", "qty": 1}]},
         "fail": {"text": "你吸進了一大口花粉，腳一軟跪在花田中間。", "effects": [{"type": "condition", "target": "pc", "condition": "aroused", "add": True}, {"type": "condition", "target": "pc", "condition": "sensitive", "add": True}]}, "adult_scene": "fail"},
        {"label": "趁機採花蜜", "check": {"attr": "int", "dc": 12}, "success": {"text": "你趁花朵忙著授粉，裝了滿滿兩瓶花蜜。", "effects": [{"type": "item", "name": "媚香花蜜", "qty": 2}]},
         "fail": {"text": "你採到一半，花朵發現了你這個「花粉偷」。", "effects": [{"type": "item", "name": "媚香花蜜", "qty": 1}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "fail"},
        {"label": "躺在花田裡享受", "success": {"text": "你躺下來，讓花朵們盡情地「授粉」。結束時渾身香得連自己都受不了。", "effects": [{"type": "item", "name": "媚香花蜜", "qty": 2}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}, {"type": "lewd", "stat": "lewdness", "delta": 1}]}, "adult_scene": "always"}]},
    {"id": "dg_park_theater_stage", "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": ["trap", "rest"], "dungeons": ["park_theater"], "tags": ["adult", "pc_unwilling"], "pc_body": B,
     "title": "被拉上舞台", "text": "聚光燈突然打在你身上。「今晚的特別來賓！」夢魔導演的聲音響徹劇場，你被一群舞者架著拖上了舞台，台下滿座。",
     "scene": "主角被拉上夢魔劇場的舞台當成今晚的主秀，舞者們在聚光燈下一件件剝掉主角的衣服，台下的觀眾不停地喝采",
     "options": [
        {"label": "即興演出，搶回主導權", "check": {"attr": "cha", "dc": 14}, "success": {"text": "你接過話頭，演了一場讓夢魔導演都拍手的戲，全身而退，還拿了一束花。", "effects": [{"type": "xp", "amount": 40}]},
         "fail": {"text": "你的台詞被舞者們的手打斷了。燈光很亮，台下很近。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 3}, {"type": "condition", "target": "pc", "condition": "disheveled", "add": True}]}, "adult_scene": "fail"},
        {"label": "趁燈光一暗跳下舞台", "check": {"attr": "dex", "dc": 14}, "success": {"text": "換幕的那一瞬間，你從舞台邊緣溜了下去。"},
         "fail": {"text": "你剛跳下去就被觀眾抬了回來，掌聲更熱烈了。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 3}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "fail"},
        {"label": "照劇本演完", "success": {"text": "你照著夢魔導演的劇本演完了整場。謝幕時，台下的掌聲響了很久。", "effects": [{"type": "lewd", "stat": "exposure", "delta": 5}, {"type": "money", "amount": 150}, {"type": "condition", "target": "pc", "condition": "afterglow", "add": True}]}, "adult_scene": "always"}]},
]


def write_s8_14():
    p = 'data/rules/items.json'
    t = open(p).read()
    for it in AUCTION_ITEMS + PARK_OUTFITS:
        t = drop_lines(t, r'\n    \{"name": ' + re.escape(json.dumps(it['name'], ensure_ascii=False)) + r'.*')
    t = insert_after(t, r'\n    \{"name": "緋夢夫人的吊帶襪".*', ['    ' + json.dumps(x, ensure_ascii=False) for x in AUCTION_ITEMS + PARK_OUTFITS])
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/lewd.json'
    t = open(p).read()
    for k in ['outfit_two_face', 'outfit_tailor', 'auction']:
        t = drop_lines(t, r'\n  "' + k + r'": \{.*')
    t = t.replace('\n  "park": {', ''.join(f'\n  "{k}": ' + json.dumps(v, ensure_ascii=False) + ',' for k, v in [('outfit_two_face', OUTFIT_TWO_FACE), ('outfit_tailor', OUTFIT_TAILOR), ('auction', AUCTION)]) + '\n  "park": {', 1)
    d = json.loads(t)
    # 園區的寶箱：成人向的服裝（chest_items 的最後面）
    items = [x for x in d['park']['chest_items'] if x[0] not in {o['name'] for o in PARK_OUTFITS}] + [[o['name'], PARK_OUTFIT_CHANCE] for o in PARK_OUTFITS]
    old = json.dumps(d['park']['chest_items'], ensure_ascii=False)
    assert old in t
    t = t.replace(old, json.dumps(items, ensure_ascii=False), 1)
    d = json.loads(t)
    names = {i['name'] for i in json.load(open('data/rules/items.json'))['items']}
    for n, _ in d['auction']['pool']:
        assert n in names, n
    open(p, 'w').write(t)

    p = 'data/world/landmarks.json'
    doc = json.load(open(p))
    doc['landmarks'] = [x for x in doc['landmarks'] if x['id'] != AUCTION_LANDMARK['id']] + [AUCTION_LANDMARK]
    open(p, 'w').write(json.dumps(doc, ensure_ascii=False, indent=1))

    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in [WATCH_EVENT] + PARK_EVENTS:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "town_grope".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in [WATCH_EVENT] + PARK_EVENTS])
    json.loads(t)
    open(p, 'w').write(t)
    print('S8-14 auction items', len(AUCTION_ITEMS), 'park outfits', len(PARK_OUTFITS), 'park events', len(PARK_EVENTS))


if __name__ == '__main__':
    write_s8_3()
    write_s8_4()
    write_s8_6()
    write_s8_7()
    write_s8_9()
    write_s8_10()
    write_s8_11()
    write_s8_12()
    write_s8_13()
    write_s8_14()
