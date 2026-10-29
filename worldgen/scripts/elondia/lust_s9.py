# 慾望戰鬥 S9 的資料（docs/plan/LUST_COMBAT_PLAN.md 第 19 節；規則寫在 docs/LEWD_STATS.md）：
#   S9-2 新的拘束種類「封住嘴巴」（lewd.json 的 two_face.kinds.mouth、流派的契合）、16 件拘束具（gear.json 的底材、items.json 的物品）、
#        取得方式：商店（物品的 tags）、地下城寶箱（gear.json 的 chests）、園區寶箱（lewd.json 的 park.chest_items）、
#        商店每天另外上架的拘束具（shops.json 的 restraints）、拍賣會（auction.pool）、拘束戰鬥場的稀有獎品（arena.rings.bound.rare）、捕奴隊隊長的掉落（enemies.json）、主人的池子（master_force）
# 可以重跑：先拿掉上一次寫進去的再寫。要排在 lust_s8.py 之後（淫鬥場、拍賣會、園區的寶箱在那裡重寫）。
import json
import re


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


def edit_line(text, anchor, fn):
    """把 anchor（正規表示式，一行的開頭）那一行 `"key": {...}` 的值讀出來，交給 fn 改，再寫回同一行"""
    m = re.search(anchor + r'(.*?)(,?)$', text, re.M)
    value = json.loads(m.group(1))
    fn(value)
    return text[:m.start(1)] + json.dumps(value, ensure_ascii=False) + text[m.end(1):]


# ---------------- S9-2 封住嘴巴 ----------------
MOUTH = {"name": "封住嘴巴", "checks": [{"attrs": ["cha"]}, {"contexts": ["negotiation"]}], "penalty": [1, 2, 3],
         "combat": [{"save": 1}, {"save": 1, "dr": 1}, {"save": 2, "dr": 1}], "immune": ["taunted"]}
# 口枷配束縛派、刑罰派（和其他拘束一樣）
MOUTH_SCHOOLS = ['punishment', 'bondage']

# ---------------- S9-2 底材（拘束具，沒有加成） ----------------
BASES = {
    "lace_veil": {"slot": "head", "name": "眼紗", "kind": "cloth", "price": 30, "restraint": True, "bind": 1, "bind_kind": "eyes", "adult": True,
                  "desc": "垂到鼻尖的蕾絲眼紗，看得見影子，看不清臉。"},
    "full_hood": {"slot": "head", "name": "全罩頭套", "kind": "leather", "price": 150, "restraint": True, "bind": 3, "bind_kind": "eyes", "adult": True,
                  "desc": "包住整顆頭的皮頭套，只在鼻子底下留兩個小孔。"},
    "ribbon_cuffs": {"slot": "wrists", "name": "絲帶手銬", "kind": "cloth", "price": 20, "restraint": True, "bind": 1, "bind_kind": "hands", "adult": True,
                     "desc": "把兩隻手腕綁在一起的緞帶，打成蝴蝶結，一扯就鬆——前提是手搆得到。"},
    "leather_cuffs": {"slot": "wrists", "name": "皮手銬", "kind": "leather", "price": 60, "restraint": True, "bind": 2, "bind_kind": "hands", "adult": True,
                      "desc": "內襯軟墊的皮手銬，扣環之間只有一節短鍊。"},
    "ankle_bells": {"slot": "leg_accessory", "name": "腳踝鈴鍊", "kind": "metal", "price": 30, "restraint": True, "bind": 1, "bind_kind": "legs", "adult": True,
                    "desc": "繫在兩邊腳踝的細鍊，掛滿小鈴鐺，走快一點就響個不停。"},
    "vibe_plug": {"slot": "underwear_bottom", "name": "震動栓", "kind": "metal", "price": 200, "restraint": True, "bind": 3, "bind_kind": "stim", "adult": True,
                  "desc": "刻著魔導回路的金屬栓，扣在貼身的皮帶上，一刻也不停地震。"},
    "steel_corset": {"slot": "belt", "name": "鐵骨束腰", "kind": "metal", "price": 60, "restraint": True, "bind": 1, "bind_kind": "body", "adult": True,
                     "desc": "鋼條撐起的束腰，從肋骨一路勒到胯骨，腰彎不下去。"},
    "silk_gag": {"slot": "head", "name": "口塞", "kind": "cloth", "price": 10, "restraint": True, "bind": 1, "bind_kind": "mouth", "adult": True,
                 "desc": "塞進嘴裡、再用絲巾繞到腦後綁住，說話只剩含糊的嗚嗚聲。"},
    "ball_gag": {"slot": "head", "name": "口球", "kind": "leather", "price": 40, "restraint": True, "bind": 2, "bind_kind": "mouth", "adult": True,
                 "desc": "皮帶扣在腦後的圓球，咬著合不攏嘴，口水會一直流下來。"},
    "muzzle_gag": {"slot": "head", "name": "面罩口枷", "kind": "leather", "price": 120, "restraint": True, "bind": 3, "bind_kind": "mouth", "adult": True,
                   "desc": "連著口塞的皮面罩，從鼻樑包到下巴，扣環在腦後。"},
}


def item(name, price, tags, desc, gear, **extra):
    return {"name": name, "category": "equipment", "price_cc": price, "tags": tags, "adult": True, **extra, "desc": desc, "gear": gear}


# 商店的 10 件：補滿每種拘束的程度 1～3（封住嘴巴是新的）
SHOP_ITEMS = [
    item('蕾絲眼紗', 120, ['tailor'], '黑色蕾絲縫成的眼紗，戴上之後世界只剩一片朦朧的影子。', {"base": "lace_veil", "material": "silk"}),
    item('全罩皮頭套', 700, ['tailor'], '包住整顆頭的黑皮頭套，看不見、聽不太清楚，連表情都藏起來了。', {"base": "full_hood", "material": "leather"},
         min_location='city', charm_min=3, master_force={"tags": ["villain"]}),
    item('絲帶手銬', 100, ['tailor'], '粉紅色的緞帶手銬，綁得像禮物一樣。', {"base": "ribbon_cuffs", "material": "silk"}),
    item('皮手銬', 250, ['smith'], '內襯軟墊的黑皮手銬，扣環之間一節短鍊。', {"base": "leather_cuffs", "material": "leather"},
         master_force={"tags": ["villain"]}),
    item('腳踝鈴鍊', 150, ['jeweler'], '掛滿小銀鈴的腳鍊，舞孃和寵奴都愛戴。', {"base": "ankle_bells", "material": "iron"}),
    item('魔導震動栓', 1200, ['magic'], '刻著魔導回路的金屬栓，扣上之後就停不下來。', {"base": "vibe_plug", "material": "iron"},
         min_location='city', charm_min=3),
    item('鐵骨束腰', 300, ['smith'], '鋼條撐起的束腰，扣在衣服外面，腰挺得筆直。', {"base": "steel_corset", "material": "iron"},
         master_force={"tags": ["noble", "royal"]}),
    item('絲巾口塞', 80, ['tailor'], '一團軟布和一條絲巾，綁好之後只能嗚嗚地哼。', {"base": "silk_gag", "material": "silk"}),
    item('口球', 250, ['tailor'], '紅色的球扣在黑皮帶上，咬著合不攏嘴。', {"base": "ball_gag", "material": "leather"},
         master_force={}),
    item('皮革面罩口枷', 600, ['smith'], '連著口塞的皮面罩，從鼻樑包到下巴，只露出一雙眼睛。', {"base": "muzzle_gag", "material": "leather"},
         min_location='city', charm_min=3),
]

# 不在商店賣的 6 件獨特拘束具（比同程度的商店貨多一項加成）
UNIQUE_ITEMS = [
    item('囚徒的符文枷', 900, ['unique'], '地下城深處挖出來的鐵枷，鎖孔裡的符文還亮著——戴上就鎖死了，誰也打不開，只能整個卸下來。',
         {"base": "manacles", "material": "iron", "bind": 3, "lock": "rune"}),
    item('夢魔的眼紗', 1100, ['unique'], '夢魔劇場的女伶表演時戴的紫色眼紗，隔著它看出去，每個人都美得不像真的。',
         {"base": "lace_veil", "material": "silk", "bind": 2, "attrs": {"cha": 1}}),
    item('觸手束衣', 1600, ['unique'], '觸手水族館的展示品：一件會自己收緊的活體束衣，勒得越緊，皮膚越硬。',
         {"base": "shibari", "material": "silk", "enchants": {"mods": {"dr": 1}}}),
    item('聖女的貞潔鎖', 1400, ['unique'], '銀打的貞操帶，鎖頭刻著聖環——說是守貞的誓約，其實是某位主教的收藏。',
         {"base": "chastity_belt", "material": "iron", "bind": 2, "attrs": {"fai": 1}}),
    item('女王的芭蕾靴', 2200, ['unique'], '淫鬥場拘束戰鬥場的冠軍獎品：踮著腳尖也要比對手先出手的漆皮長靴。',
         {"base": "ballet_boots", "material": "leather", "unique": {"check": {"contexts": ["initiative"]}, "bonus": 1}}),
    item('獵奴人的鎖鏈', 800, ['unique'], '捕奴隊隊長拿來鎖「貨」的鐵鍊，上面掛著一把藍鋼鎖——鑰匙早就丟了。',
         {"base": "manacles", "material": "iron", "bind": 2, "lock": "blue", "attrs": {"str": 1}}),
]
NEW_ITEMS = SHOP_ITEMS + UNIQUE_ITEMS

# 地下城寶箱（依層：淺層程度 1、中層程度 2、深層以下程度 3 與獨特的）
CHESTS = {
    "shallow": [["絲帶手銬", 0.015], ["蕾絲眼紗", 0.015], ["絲巾口塞", 0.015], ["腳踝鈴鍊", 0.015]],
    "middle": [["皮手銬", 0.015], ["口球", 0.015], ["步鍊", 0.015]],
    "deep": [["全罩皮頭套", 0.015], ["皮革面罩口枷", 0.015], ["囚徒的符文枷", 0.01]],
    "abyss": [["囚徒的符文枷", 0.02], ["魔導震動栓", 0.02]],
}
PARK_CHEST = [["夢魔的眼紗", 0.02], ["觸手束衣", 0.02]]
AUCTION = [["夢魔的眼紗", 2], ["聖女的貞潔鎖", 2]]
ARENA_RARE = {"tier": 5, "chance": 0.25, "items": ["女王的芭蕾靴"]}
SLAVER_LOOT = {"item": "獵奴人的鎖鏈", "chance": 0.25}
# 每天另外上架幾件拘束具（不和幾百件衣物一起抽）
SHOP_RESTRAINTS = {"smithy": [1, 2], "tailor": [1, 3], "jeweler": [0, 1], "magic": [0, 1]}


def write_s9_2():
    names = {i['name'] for i in NEW_ITEMS}

    # 底材
    p = 'data/rules/gear.json'
    t = open(p).read()
    for k in BASES:
        t = drop_lines(t, r'\n    "' + k + r'": \{.*')
    t = insert_after(t, r'\n    "nipple_clamps": \{.*', [f'    "{k}": ' + json.dumps(v, ensure_ascii=False) for k, v in BASES.items()])
    # 寶箱：先拿掉這裡加過的，再接在每一層的 items 後面
    for layer, rows in CHESTS.items():
        def add(v, rows=rows):
            mine = {n for n, _ in rows}
            v['items'] = [x for x in v['items'] if x[0] not in mine] + rows
        t = edit_line(t, r'^    "' + layer + r'": ', add)
    json.loads(t)
    open(p, 'w').write(t)

    # 物品
    p = 'data/rules/items.json'
    t = open(p).read()
    for n in names:
        t = drop_lines(t, r'\n    \{ ?"name": "' + re.escape(n) + r'".*')
    t = insert_after(t, r'\n    \{ "name": "鈴鐺乳夾".*', ['    ' + json.dumps(i, ensure_ascii=False) for i in NEW_ITEMS])
    d = json.loads(t)
    all_items = {i['name'] for i in d['items']}
    open(p, 'w').write(t)

    # 規則：封住嘴巴、流派的契合、園區寶箱、拍賣會、拘束戰鬥場
    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = drop_lines(t, r'\n      "mouth": \{.*')
    t = t.replace('\n      "stim": { "name": "持續刺激"',
                  '\n      "mouth": ' + json.dumps(MOUTH, ensure_ascii=False) + ',\n      "stim": { "name": "持續刺激"', 1)
    for sid in MOUTH_SCHOOLS:
        def fit(m):
            kinds = [k for k in json.loads(m.group(2)) if k != 'mouth'] + ['mouth']
            return m.group(1) + json.dumps(kinds, ensure_ascii=False)
        t = re.sub(r'^(    "' + sid + r'": \{.*"fit": )(\[[^\]]*\])', fit, t, count=1, flags=re.M)
    d = json.loads(t)

    d['park']['chest_items'] = [x for x in d['park']['chest_items'] if x[0] not in names] + PARK_CHEST
    t = re.sub(r'^(    "chest_items": )(.*?)(,?)$', lambda m: m.group(1) + json.dumps(d['park']['chest_items'], ensure_ascii=False) + m.group(3), t, count=1, flags=re.M)

    def auction(v):
        v['pool'] = [x for x in v['pool'] if x[0] not in names] + AUCTION
    t = edit_line(t, r'^  "auction": ', auction)

    def arena(v):
        v['rings']['bound']['rare'] = ARENA_RARE
    t = edit_line(t, r'^  "arena": ', arena)
    d = json.loads(t)
    assert set(d['two_face']['kinds']) == {'legs', 'hands', 'eyes', 'mouth', 'stim', 'body'}
    for n, _ in d['park']['chest_items'] + d['auction']['pool']:
        assert n in all_items, n
    for n in d['arena']['rings']['bound']['rare']['items']:
        assert n in all_items, n
    open(p, 'w').write(t)

    # 捕奴隊隊長的掉落
    p = 'data/rules/enemies.json'
    t = open(p).read()

    def loot(v):
        v['loot'] = [x for x in v.get('loot', []) if x['item'] != SLAVER_LOOT['item']] + [SLAVER_LOOT]
    m = re.search(r'^    (\{"id": "slaver_captain".*?\})(,?)$', t, re.M)
    e = json.loads(m.group(1))
    loot(e)
    t = t[:m.start(1)] + json.dumps(e, ensure_ascii=False) + t[m.end(1):]
    json.loads(t)
    open(p, 'w').write(t)

    # 商店每天另外上架的拘束具
    p = 'data/rules/shops.json'
    t = open(p).read()
    t = drop_lines(t, r'\n      "restraints": \[.*')
    for shop, r in SHOP_RESTRAINTS.items():
        t = re.sub(r'(\n    "' + shop + r'": \{.*?\n      "catalog_tag": "[a-z]+",)', lambda m: m.group(1) + f'\n      "restraints": {json.dumps(r)},', t, count=1, flags=re.S)
    d = json.loads(t)
    for shop, r in SHOP_RESTRAINTS.items():
        assert d['types'][shop]['restraints'] == r, shop
    open(p, 'w').write(t)

    for rows in CHESTS.values():
        for n, _ in rows:
            assert n in all_items, n
    print('S9-2 bases', len(BASES), 'items', len(NEW_ITEMS))


if __name__ == '__main__':
    write_s9_2()
