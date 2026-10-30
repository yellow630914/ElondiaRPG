# 慾望戰鬥 S9 的資料（規則寫在 docs/LEWD_STATS.md）：
#   S9-2 新的拘束種類「封住嘴巴」（lewd.json 的 two_face.kinds.mouth、流派的契合）、16 件拘束具（gear.json 的底材、items.json 的物品）、
#        取得方式：商店（物品的 tags）、地下城寶箱（gear.json 的 chests）、園區寶箱（lewd.json 的 park.chest_items）、
#        商店每天另外上架的拘束具（shops.json 的 restraints）、拍賣會（auction.pool）、拘束戰鬥場的稀有獎品（arena.rings.bound.rare）、捕奴隊隊長的掉落（enemies.json）、主人的池子（master_force）
#   S9-3 地下城事件 24 件（travel_events.json，scope: dungeon；docs/ADULT_EVENTS.md 第 4 節）
#   S9-4 魅氣濃的城鎮事件 20 件（travel_events.json，scope: town；docs/ADULT_EVENTS.md 第 9 節）
#   S9-5 旅途事件 8 件（travel_events.json，scope: road；docs/ADULT_EVENTS.md 第 10 節）
#   S9-6 淫服補充：12 種成人向服裝的底材（gear.json）、前三級材料的制式品與 6 件獨特品（items.json）、
#        取得方式（寶箱、園區寶箱、拍賣會、性戰場的稀有獎品、夢魔氏族的執行者的掉落）；docs/ITEMS.md 第 2 節
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


# ---------------- S9-3 地下城事件 ----------------
UNWILLING = ['adult', 'pc_unwilling']
WILLING = ['adult']
# 對象是人形的男性（幽靈新郎、神父、祭司）：標男性對象
UNWILLING_MEN = ['adult', 'pc_unwilling', 'male_partner']
WILLING_MEN = ['adult', 'male_partner']
BODY = ['fem', 'andro']


def cond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": True}


def lewd(stat, d):
    return {"type": "lewd", "stat": stat, "delta": d}


def give(name, qty=1):
    return {"type": "item", "name": name, "qty": qty}


def money(n):
    return {"type": "money", "amount": n}


def xp(n):
    return {"type": "xp", "amount": n}


def restrain(name, lock=None):
    return {"type": "restrain", "item": name, **({"lock": lock} if lock else {})}


def learn(ability):
    return {"type": "ability", "target": "pc", "ability": ability}


def heal(ratio):
    return {"type": "hp", "target": "pc", "ratio": ratio}


def out(text, *effects):
    return {"text": text, **({"effects": list(effects)} if effects else {})}


def opt(label, success, check=None, fail=None, scene=None):
    o = {"label": label}
    if check:
        o["check"] = {"attr": check[0], "dc": check[1]}
    o["success"] = success
    if check and fail:
        o["fail"] = fail
    if scene:
        o["adult_scene"] = scene
    return o


def ev(id, title, text, triggers, options, layers=None, dungeons=None, tags=UNWILLING, scene=None, tier='normal', requires=None):
    return {"id": id, "scope": "dungeon", "tier": tier, "kind": "choice", "triggers": triggers, **({"layers": layers} if layers else {}),
            **({"dungeons": dungeons} if dungeons else {}), **({"requires": requires} if requires else {}), "tags": tags, "pc_body": BODY,
            "title": title, "text": text, **({"scene": scene} if scene else {}), "options": options}


EAST = ['tidefall_cave', 'skull_isle']
WEST = ['quicksand_temple', 'echo_canyon']
NORTH = ['redemption_pit', 'echo_rift', 'giants_spine']
SOUTH = ['ember_rift', 'bloodrock_cave', 'hell_greenhouse']
CRYPT = ['whisper_crypt', 'mist_abbey']

DUNGEON_EVENTS = [
    # ---- 拘束陷阱：直接鎖在主角身上（陷阱鎖） ----
    ev('dg_trap_cuffs', '自動扣上的手銬',
       '你一腳踩下鬆動的石板，牆裡彈出一對皮手銬，「喀」地扣住了你的手腕——鍊子的另一頭還在往牆裡收。',
       ['trap'], [
           opt('趁還沒扣緊把手抽出來', out('你在鎖扣咬死之前把手抽了出來，那副手銬掉在地上——做工不錯，你收下了。', give('皮手銬')),
               ('dex', 14), out('你抽到一半，鎖扣已經咬死了。鍊子斷開時，手銬還牢牢鎖在你的手腕上——聽到聲音跑來的小妖精們，把動彈不得的你當成了禮物。', restrain('皮手銬'), cond('disheveled')), scene='fail'),
           opt('用蠻力扯斷鍊子', out('你一扯，牆裡的機關先撐不住，鍊子連著手銬一起掉了出來。', give('皮手銬')),
               ('str', 15), out('鍊子是扯斷了，可是手銬內側的藍鋼鎖紋風不動。', restrain('皮手銬', 'blue'))),
           opt('不掙扎，等機關鬆開', out('機關卡了一下就縮回牆裡——但手銬已經鎖好了，鑰匙不知道在哪裡。你乖乖地等，心裡居然有點踏實。',
                                    restrain('皮手銬'), lewd('submission', 1))),
       ], layers=[1, 2, 3, 4],
       scene='雙手被手銬鎖住的主角，被聞聲而來的小妖精們圍住，趁主角沒辦法反抗把衣服掀開到處摸弄'),
    ev('dg_trap_rope_suit', '會自己穿上的繩衣',
       '角落裡一堆紅繩忽然動了起來，像蛇一樣沿著你的腳踝往上爬，在你身上一圈一圈地打結。',
       ['trap'], [
           opt('趁它還沒綁好用刀割斷', out('你割斷了領頭的那條，其他的繩子就散了。地上留下一團還算完整的繩衣。', give('麻繩繩衣')),
               ('dex', 15), out('繩子比你的刀快。它在你背後打完最後一個結，結扣上還掛著一把小鎖。', restrain('絲繩龜甲縛', 'blue'))),
           opt('屏住氣一動也不動', out('繩子爬到一半，好像對不會動的東西失去了興趣，一條一條縮回角落。', xp(20)),
               ('fai', 14), out('你忍不住喘了一口氣。繩子立刻收緊，把你綁得整整齊齊。', restrain('麻繩繩衣'))),
           opt('讓它綁，順便學學它怎麼綁', out('你放鬆身體讓繩子纏上來，留心它每一個結的走法。綁好之後，你發現自己居然知道怎麼在繩子裡用力了。',
                                       restrain('絲繩龜甲縛'), learn('lust_bind_stance')), scene='always'),
       ], layers=[2, 3, 4],
       scene='活的紅繩在主角身上一圈圈收緊，繩結勒進最敏感的地方，綁好之後還在皮膚上緩緩地蠕動'),
    ev('dg_trap_hood', '落下來的頭套',
       '天花板裂開一道縫，一個黑皮頭套直直落下，套住你的頭就自己收緊了繫帶，眼前瞬間一片漆黑。',
       ['trap'], [
           opt('舉手把它扯下來', out('你在繫帶收死之前把頭套扯了下來，扔進角落。'),
               ('dex', 14), out('你的手指搆到繫帶時，扣環已經鎖上了。', restrain('全罩皮頭套', 'blue'))),
           opt('唸解咒的咒文', out('頭套上的符文一閃，化成一縷灰。你在灰裡撿到一張寫著咒文的紙條。', xp(30)),
               ('int', 15), out('咒文唸錯了一個音。頭套上的符文反而亮了起來，鎖得更緊——黑暗裡，有不知道是誰的手開始解你的衣服。', restrain('全罩皮頭套', 'rune'), cond('afterglow')), scene='fail'),
           opt('喊隊友幫忙', out('隊友摸索著幫你解開了一半——另一半鎖死了。你只能戴著它往前走，眼前只剩下黑暗和聲音。',
                               restrain('全罩皮頭套'), cond('shaken'))),
       ], layers=[2, 3, 4],
       scene='戴著全罩頭套什麼都看不見的主角，被黑暗裡看不見的手一件件解開衣服，只能靠觸感猜下一下落在哪裡'),
    ev('dg_trap_gag', '要你安靜的牆',
       '牆上浮出一張石雕的嘴：「這裡是安靜的地方。」話還沒說完，一顆口球就從嘴裡彈了出來，往你臉上飛。',
       ['trap'], [
           opt('側身閃開', out('口球擦過你的臉頰，掉在地上滾遠了。'),
               ('dex', 13), out('口球不偏不倚地塞進你嘴裡，皮帶自己繞到腦後扣上。', restrain('口球'))),
           opt('大聲回罵', out('你罵得比它還大聲。石嘴愣了一下，「喀啦」一聲裂成兩半，裡面掉出幾枚銅幣。', money(30)),
               ('cha', 14), out('石嘴冷笑：「吵死了。」整張面罩口枷撲上來，把你的下半張臉包得嚴嚴實實，牆裡又伸出幾隻石手來「教你安靜」。', restrain('皮革面罩口枷'), cond('shaken'), cond('disheveled')), scene='fail'),
           opt('乖乖閉嘴走過去', out('你閉著嘴走過去。石嘴滿意地點點頭，在你身後吐出一條絲巾當作「乖孩子」的獎勵。', give('絲巾口塞'))),
       ], layers=[1, 2, 3, 4],
       scene='嘴被面罩口枷堵住、發不出聲音的主角，被牆裡伸出的石手按在牆上「教訓」，只能嗚嗚地哼'),
    # ---- 寶箱裡的拘束具 ----
    ev('dg_chest_key_shackle', '鎖著鑰匙的箱子',
       '箱子裡只有一把鑰匙，鑰匙用細鍊鎖在一副手銬上——像是誰故意留下的謎題。',
       ['chest'], [
           opt('把細鍊撬開', out('你撬開細鍊，鑰匙和手銬都歸你了。', give('藍鋼鑰匙'), give('皮手銬')),
               ('dex', 14), out('細鍊斷了，可是鑰匙也被你撬彎——只剩下最普通的那一截能用。', give('白鐵鑰匙'), give('皮手銬'))),
           opt('整副帶走', out('你把手銬連鑰匙一起塞進行囊，回頭再慢慢研究。', give('白鐵鑰匙'), give('皮手銬'))),
           opt('戴上手銬試試鑰匙', out('你把自己銬上，等了好一會兒才用鑰匙打開——喀。鑰匙是真的，你的心跳也是真的。', give('藍鋼鑰匙'), give('皮手銬'), lewd('submission', 1)), scene='always'),
       ], layers=[1, 2, 3, 4], tags=WILLING,
       scene='主角在寶箱前把自己銬上，故意不急著開鎖，獨自感受被銬住的滋味'),
    ev('dg_chest_diary', '上一個冒險者留下的東西',
       '箱子裡是一本皮面日記、一條貞操帶，還有一張紙條：「給下一個走到這裡的人。別學我。」',
       ['chest'], [
           opt('讀日記', out('日記寫的是一個冒險者被這座地下城一點一點「馴服」的經過。你讀完了，也記下了她踩過的每一個陷阱。', xp(40)),
               ('int', 13), out('你讀得太入神，臉越讀越紅，連自己翻了幾頁都不知道。', cond('aroused'))),
           opt('把東西帶走', out('你把日記和貞操帶都收進行囊。', give('貞操帶'), money(60))),
           opt('照日記裡寫的戴上貞操帶', out('你照著日記的描述戴上它，鎖頭「喀」一聲——你忽然懂了她為什麼寫「別學我」。',
                                     give('貞操帶'), lewd('submission', 1), lewd('endurance', 1)), scene='always'),
       ], layers=[1, 2, 3, 4], tags=WILLING,
       scene='主角照著陌生冒險者日記裡的描述，獨自在寶箱前戴上貞操帶，一邊讀一邊想像她當時的處境'),
    ev('dg_chest_chain_mimic', '吐出鎖鏈的寶箱',
       '箱蓋一開，裡面沒有寶物，只有一條會動的鎖鏈——它纏住你的腳踝，把你往箱口拖。',
       ['chest'], [
           opt('抓住箱沿穩住', out('你踩住箱沿用力一蹬，鎖鏈斷成兩截。斷掉的那截是一條漂亮的步鍊。', give('步鍊')),
               ('dex', 14), out('你被拖到箱口，鎖鏈在你的腳踝上扣成一副步鍊，箱子還伸出舌頭舔了你一下才甘心。', restrain('步鍊', 'blue'), cond('disheveled'))),
           opt('砍那條鎖鏈', out('你一刀砍斷鎖鏈，寶箱發出一聲哀鳴，吐出牠藏著的錢。', money(80)),
               ('str', 14), out('刀卡在鎖鏈上。寶箱把你整個拉進懷裡，舌頭和鎖鏈一起伸進了衣服底下。', restrain('步鍊'), cond('afterglow')), scene='fail'),
           opt('讓牠拖過去', out('你沒有抵抗。寶箱把你拉到箱口，舔夠了才心滿意足地吐出牠肚子裡的錢——鎖鏈則留在了你的腳踝上。',
                              restrain('步鍊'), money(120), cond('afterglow')), scene='always'),
       ], layers=[2, 3, 4],
       scene='擬態寶箱用鎖鏈把主角拖到箱口，鎖住腳踝，再用長舌頭在主角身上到處舔弄'),
    # ---- 地區主題 ----
    ev('dg_tide_anemone', '漲潮的海葵池',
       '潮水突然漲進來，淹到你的腰。池底的海葵張開粉紅色的觸手，一根一根纏上你的腿，觸手上的細刺讓皮膚發麻發熱。',
       ['trap', 'gather'], [
           opt('爬上岩石', out('你踩著岩縫爬了上去，只被刺到幾下。', cond('sensitive')),
               ('dex', 14), out('岩石太滑。海葵把你拖回水裡，觸手往衣服裡鑽，直到潮水退去才放開。', cond('aroused'), cond('sensitive'), lewd('sensitivity', 1))),
           opt('割斷觸手', out('你割斷纏腳的觸手，順手撬下一塊會發光的貝殼。', money(50)),
               ('str', 14), out('觸手斷了又長。你在水裡掙扎到筋疲力盡。', cond('drained'), cond('aroused'))),
           opt('放鬆身體隨潮水漂', out('你讓身體漂起來，海葵的觸手溫柔地托著你，像在撫摸——潮退之後，你渾身酥麻地躺在沙灘上。',
                                  cond('afterglow'), lewd('sensitivity', 2)), scene='always'),
       ], layers=[1, 2, 3, 4], dungeons=EAST,
       scene='漲潮的海葵池裡，粉紅色的觸手纏住主角的腿往衣服裡鑽，細刺讓全身發麻發熱'),
    ev('dg_tide_mermaid', '人魚的歌',
       '安全房旁邊的水窪連著外面的海。半夜，一個人魚趴在水窪邊唱歌，看到你醒了，就游過來問：「陸上的人，要不要陪我一晚？我拿珍珠跟你換。」',
       ['rest'], [
           opt('陪她到天亮', out('你們在水邊纏綿到天亮。她留下一顆珍珠，說潮水會記得你。', money(150), cond('relaxed'), lewd('lewdness', 1)), scene='always'),
           opt('只聽她唱歌', out('你靠著牆聽了一整夜。她的歌讓你睡得前所未有地沉。', cond('well_rested'))),
           opt('跟她打聽海裡的事', out('她說了很多深海的秘密，包括這座洞窟最深處的寶藏在哪。', xp(40)),
               ('cha', 14), out('她只顧著笑，拉著你的手往水裡帶——你醒來時衣服是濕的。', cond('afterglow'))),
       ], dungeons=EAST, tags=WILLING,
       scene='人魚趴在安全房的水窪邊，和主角在水裡纏綿到天亮，冰涼的鱗片和溫熱的身體交替著'),
    ev('dg_sand_altar', '沙之祭壇',
       '你踏上祭壇的瞬間，地上的沙像水一樣湧上來，轉眼就把你埋到胸口。祭壇上浮出一個戴著胡狼面具的祭司幻影：「新的祭品。」',
       ['trap'], [
           opt('用力掙出沙堆', out('你一寸一寸地把自己拔了出來，衣服裡全是沙。', cond('disheveled')),
               ('str', 15), out('越掙扎沙越緊。祭司的手從沙裡伸出來，開始「檢查」祭品。', cond('drained'), cond('afterglow')), scene='fail'),
           opt('向古神禱告', out('祭司的幻影在禱詞裡退後，沙也退了。祭壇底下露出一枚古金幣。', money(120)),
               ('fai', 15), out('古神聽到了，但祂想要的不是禱詞。', cond('aroused'), lewd('submission', 1)), scene='fail'),
           opt('當祂的祭品', out('你閉上眼睛，任由沙和祭司的手把你獻給古神。結束時，你的小腹上多了一個金色的紋樣。',
                              {"type": "tattoo", "template": "lewd_wings"}, cond('afterglow'), lewd('submission', 1)), scene='always'),
       ], layers=[1, 2, 3, 4], dungeons=WEST, tags=UNWILLING_MEN,
       scene='主角被流沙埋到胸口動彈不得，戴胡狼面具的祭司幻影從沙裡伸出手，把主角當成祭品一寸寸地檢查、獻給古神'),
    ev('dg_mummy_wrap', '木乃伊的拘束布',
       '石棺裡伸出泛黃的布條，一圈一圈地纏上你的身體，從腳踝纏到脖子，越纏越緊——像要把你也做成一具木乃伊。',
       ['trap', 'chest'], [
           opt('趁布條還鬆把手掙出來', out('你掙出一隻手扯斷布條，石棺裡的陪葬品歸你了。', money(90)),
               ('dex', 15), out('布條把你纏成了一個繭，石棺裡的東西在黑暗裡摸索你。', cond('drained'), cond('disheveled')), scene='fail'),
           opt('點火燒掉布條', out('布條碰到火就捲起來縮回石棺。', xp(25)),
               ('int', 14), out('火燒到一半就被布條悶熄了。你被纏著在地上躺了好一陣子才鬆開。', cond('shaken'), lewd('endurance', 1))),
           opt('放棄掙扎', out('你放鬆身體讓布條纏完。石棺裡的手隔著布條把你摸了個遍，然後才慢慢鬆開，像是滿意了——棺底的陪葬品也送給了你。',
                             money(90), cond('afterglow'), lewd('endurance', 1)), scene='always'),
       ], layers=[2, 3, 4], dungeons=['quicksand_temple'],
       scene='主角被木乃伊的布條從頭到腳纏成繭，石棺裡乾枯的手在黑暗中隔著布條摸遍主角全身'),
    ev('dg_ice_warmth', '冰窟裡的雪女',
       '安全房冷得連火都點不起來。門口站著一個白衣的雪女，呼出的氣是冰的，眼神卻很熱：「很冷吧？我可以讓你暖起來——用我的方式。」',
       ['rest'], [
           opt('讓她進來', out('她鑽進你的睡袋，冰涼的身體一碰到你就融化成了熱。天亮時她不見了，只留下一身暖意和一片不會融的冰晶。',
                             cond('relaxed'), give('媚液結晶'), lewd('lewdness', 1)), scene='always'),
           opt('想辦法生火', out('你用最後的燃料生起一小堆火。雪女看了一眼，嘆口氣走了。', cond('well_rested')),
               ('int', 13), out('火點不起來。你冷了一整夜。', cond('shaken'))),
           opt('客氣地拒絕', out('她沒有勉強，臨走前告訴你下一層哪裡有暖泉。', xp(20))),
       ], dungeons=NORTH, tags=WILLING,
       scene='雪女鑽進主角的睡袋，冰涼的身體貼上來，在交纏中一點一點融化成熱'),
    ev('dg_giant_toy', '巨人的玩具',
       '一隻比你還大的手從岩縫裡伸進來，把你整個撈了起來。巨人的眼睛湊近了看你，咧嘴笑了：「小小的、軟軟的，好玩。」',
       ['trap', 'rest'], [
           opt('從指縫鑽出去', out('你趁他眨眼的時候從指縫溜走，順手摸走他指甲縫裡卡著的一顆寶石。', money(100)),
               ('dex', 15), out('他把你捏在手心裡翻來翻去，像在玩一個新玩偶，玩到睡著才放開。', cond('drained'), cond('disheveled')), scene='fail'),
           opt('往他的指頭刺一刀', out('巨人痛得把你甩出去。你滾了幾圈，撿回一條命。', xp(30)),
               ('str', 15), out('刀卡在厚厚的皮裡。巨人覺得很癢，笑著把你捏得更緊。', cond('drained'), cond('shaken')), scene='fail'),
           opt('陪他玩', out('你乖乖讓他玩。他玩得很開心，最後把你輕輕放回地上，還從口袋裡掏出一把亮晶晶的小石頭給你。',
                           money(150), cond('drained'), cond('afterglow')), scene='always'),
       ], layers=[1, 2, 3, 4], dungeons=['giants_spine', 'echo_rift'],
       scene='巨人把主角捏在手心裡當玩偶擺弄，粗大的手指把主角的衣服一件件撥開，翻來翻去地玩'),
    ev('dg_ember_brand', '熔火的淫紋',
       '岩壁上的熔岩符文突然亮起，一道火光打在你的小腹上——不痛，只是燙，燙得你腿軟。皮膚上浮出一圈桃紅色的紋路。',
       ['trap'], [
           opt('潑水冷卻', out('你把水袋整個倒上去，紋路在白煙裡淡了下去。'),
               ('int', 14), out('水一碰到紋路就蒸發了。紋路刻得更深，每走一步都在發燙。', {"type": "tattoo", "template": "lewd_womb"}, cond('aroused'))),
           opt('咬牙忍住，用信仰壓下去', out('你默唸禱詞，把那股熱一點一點壓了回去。紋路熄了，只留下淡淡的痕跡。', lewd('endurance', 1)),
               ('fai', 15), out('禱詞斷在一聲喘息裡。紋路完整地刻上了你的身體。', {"type": "tattoo", "template": "lewd_womb"}, cond('aroused'), lewd('lewdness', 1)), scene='fail'),
           opt('讓它刻完', out('你靠著岩壁讓那股熱流刻完。紋路完成的那一刻，你在岩地上蜷成一團，好久都站不起來。',
                             {"type": "tattoo", "template": "lewd_womb"}, cond('afterglow'), lewd('lewdness', 2)), scene='always'),
       ], layers=[2, 3, 4], dungeons=['ember_rift', 'bloodrock_cave'],
       scene='熔岩符文在主角的小腹刻上淫紋，一陣陣熱流從紋路湧進身體深處，主角在滾燙的岩地上喘息扭動'),
    ev('dg_blood_altar', '血岩的獻祭台',
       '獻祭台上有四個鐵環，你一靠近，它們就自己張開，把你的手腳拉上台面扣住。台邊的血槽亮了起來。',
       ['trap'], [
           opt('趁鐵環還沒扣緊掙開', out('你在鐵環合上前抽出手腳，從台邊撬下一塊血紅的晶石。', give('媚液結晶'), xp(30)),
               ('str', 16), out('三個鐵環鬆開了，第四個——刻著符文的那一個——鎖死在你的手腕上。', restrain('囚徒的符文枷'), cond('shaken'))),
           opt('唸出台上的禁咒', out('你讀懂了台邊的古文，把獻祭倒轉過來。鐵環彈開，血槽裡的寶物歸你。', money(200)),
               ('int', 16), out('你唸錯了。獻祭照常進行，祭品是你的體力。', restrain('囚徒的符文枷'), cond('drained')), scene='fail'),
           opt('躺著等儀式結束', out('你不再掙扎。血紅的霧在你身上游走了一整個儀式，結束時鐵環一個一個鬆開——只有刻著符文的那一個留了下來。',
                                restrain('囚徒的符文枷'), cond('afterglow'), money(100)), scene='always'),
       ], layers=[3, 4], dungeons=SOUTH,
       scene='主角四肢被鐵環固定在血岩的獻祭台上，血紅的霧像手一樣在赤裸的身上游走，把主角當成獻給古神的祭品'),
    ev('dg_crypt_wedding', '死者的婚禮',
       '墓穴深處點起了婚禮的燭火。一個穿著腐朽禮服的幽靈新郎牽起你的手：「我等了三百年。新娘，該完成儀式了。」',
       ['rest', 'trap'], [
           opt('驅散他', out('你舉起聖徽，幽靈在光裡化成灰，留下一枚陳舊的婚戒。', money(120)),
               ('fai', 15), out('聖徽的光太弱了。他把你抱上冰冷的婚床，完成了三百年前沒完成的事。', cond('drained'), cond('afterglow')), scene='fail'),
           opt('說「我不願意」', out('幽靈愣住，終於鬆開手。「原來……她也是這麼說的。」他消失了，墓穴安靜下來。', xp(40)),
               ('cha', 14), out('他聽不見。儀式繼續進行。', cond('afterglow'), lewd('submission', 1)), scene='fail'),
           opt('陪他走完儀式', out('你陪他走完了婚禮，也陪他過了洞房。天亮時他安心地消失了，留下一盒嫁妝。',
                                money(250), cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], layers=[1, 2, 3, 4], dungeons=CRYPT, tags=UNWILLING_MEN,
       scene='幽靈新郎把主角當成新娘，在燭火搖曳的墓穴婚床上完成三百年前沒完成的洞房，冰冷的手撫過主角全身'),
    ev('dg_abbey_confession', '懺悔室',
       '廢墟裡的懺悔室還亮著燈。隔板後面傳來一個溫和的聲音：「孩子，你有什麼要懺悔的嗎？」',
       ['rest', 'trap'], [
           opt('老實懺悔', out('你說了很多連自己都不知道一直放在心上的事。說完之後，心裡輕了。', {"type": "condition", "target": "pc", "condition": "blessed", "add": True}),
               ('cha', 13), out('你說到一半，聲音說：「還不夠誠實。」你在懺悔室裡跪了很久。', cond('shaken'))),
           opt('接受懺悔的鞭刑', out('你自己掀起衣服，伏在跪凳上。每一下鞭子都很重，也都很準——結束時，你哭著笑了出來。',
                                  {"type": "condition", "target": "pc", "condition": "blessed", "add": True}, lewd('submission', 2), lewd('endurance', 1)), scene='always'),
           opt('掀開隔板看是誰', out('隔板後面什麼也沒有，只有一本攤開的祈禱書。', xp(25)),
               ('str', 13), out('隔板後面伸出一隻手，把你拉進了黑暗裡。', cond('shaken'), cond('disheveled'))),
       ], layers=[1, 2, 3, 4], dungeons=CRYPT, tags=WILLING_MEN,
       scene='主角在廢墟的懺悔室裡自願伏在跪凳上，接受隔板後面看不見的神父一下一下的懺悔鞭刑'),
    # ---- 深層的事件（只在深層、底層；地下城事件的 tier 一律是 normal，高階只對旅途事件有意義） ----
    ev('dg_adv_lust_altar', '淫神的祭壇',
       '深層的盡頭立著一座粉紅色大理石的祭壇，祭壇上的女神像睜開了眼睛：「走到這裡的人，我給你一個願望——代價是你的身體記得我。」',
       ['trap', 'rest'], [
           opt('求魅惑之力', out('女神的吻落在你的唇上。你學會了讓人無法抗拒的吻。', learn('lust_kiss'), lewd('lewdness', 2)), scene='always'),
           opt('求守護', out('女神的手撫過你的額頭。你覺得自己被什麼溫暖的東西包圍著。', {"type": "condition", "target": "pc", "condition": "blessed", "add": True}, heal(1))),
           opt('什麼都不求', out('女神笑了：「難得。」祭壇底下滑出一個小盒子。', money(300), xp(60)),
               ('fai', 16), out('你說不出口。女神替你選了。', learn('lust_surge'), cond('afterglow'), lewd('lewdness', 2)), scene='fail'),
       ], layers=[3, 4], tags=WILLING,
       scene='淫神祭壇上的女神像化成人形，把主角抱上祭壇，用神的方式讓主角的身體永遠記得她'),
    ev('dg_adv_succubus_trial', '魅魔的試煉',
       '一個戴著學士帽的魅魔坐在王座上，蹺著腿：「我是這一層的考官。通過我的試煉，我教你一招；沒通過——你就是我的了。」',
       ['trap', 'rest'], [
           opt('比誰比較迷人', out('你們互相挑逗了很久，最後是她先紅了臉。她遵守約定，教了你一招。', learn('lust_aura'), xp(60)),
               ('cha', 17), out('她贏了。接下來的幾個小時，你是她的教材。', cond('drained'), cond('afterglow'), lewd('lewdness', 2)), scene='fail'),
           opt('比誰比較能忍', out('她用盡手段，你一聲都沒出。她拍拍手：「好，你及格了。」', learn('lust_pure_mind'), xp(60)),
               ('fai', 17), out('你撐到最後一刻，然後在她手裡潰不成軍。', cond('drained'), cond('afterglow'), lewd('sensitivity', 2)), scene='fail'),
           opt('不考了', out('她聳聳肩：「膽小鬼。」轉身不理你了。')),
       ], layers=[3, 4],
       scene='魅魔考官把沒通過試煉的主角當成教材，一邊講解一邊示範，從頭到尾把主角玩弄到潰不成軍'),
    ev('dg_adv_prisoner', '被囚禁的冒險者',
       '深層的牢房裡，一個冒險者被拘束具鎖在牆上，嘴裡塞著口枷，看到你就拚命地嗚嗚叫。牢門上掛著一把符文鎖。',
       ['chest', 'rest'], [
           opt('撬開符文鎖救她出來', out('鎖開了。她千恩萬謝，把藏在靴子裡的錢和一把鑰匙塞給你。', money(200), give('符文鑰匙'), xp(50)),
               ('dex', 16), out('鎖沒開，警報倒是響了。你們只能隔著鐵欄互看一眼，你先撤了。', cond('shaken'))),
           opt('隔著鐵欄陪她說話', out('你陪她說了一整夜的話。她說她不怕了，等你回來。', xp(30), cond('relaxed'))),
           opt('取下她的口枷，陪她過夜', out('你從鐵欄縫裡伸手取下她的口枷。她說好久沒人碰過她了——那一夜，你們隔著鐵欄纏在一起。',
                                      give('皮革面罩口枷'), cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], layers=[3, 4], tags=WILLING,
       scene='主角隔著牢房的鐵欄取下被囚冒險者的口枷，兩人隔著鐵欄親吻、撫摸，纏綿了一整夜'),
    # ---- 戴著拘束具時才有 ----
    ev('dg_wear_bells', '鈴聲引來的東西',
       '你身上的拘束具每走一步就叮噹作響。黑暗裡，一群哥布林循著聲音圍了上來，眼睛在你被綁住的地方打轉。',
       ['trap', 'gather'], [
           opt('躲進岩縫', out('你屏住呼吸躲了很久，牠們終於走了。', xp(20)),
               ('dex', 15), out('一動就響。牠們把你從岩縫裡拖了出來。', cond('drained'), cond('disheveled')), scene='fail'),
           opt('硬打出去', out('你用肩膀撞翻領頭的那隻，其他的一哄而散。', xp(40)),
               ('str', 15), out('被綁著打不贏。牠們圍著你「玩」到盡興才散去。', cond('drained'), cond('afterglow'), lewd('submission', 1)), scene='fail'),
           opt('任由牠們玩', out('你停下腳步，讓牠們扯著你身上的鍊子玩。牠們玩夠了，還丟下幾枚搶來的銅幣當「謝禮」。',
                                money(25), cond('afterglow'), lewd('submission', 1)), scene='always'),
       ], layers=[1, 2, 3], requires={"wearing": {"bind": True}},
       scene='哥布林們扯著主角身上的拘束具和鍊子把主角當玩具，一邊聽鈴鐺響一邊輪流擺弄'),
    ev('dg_wear_key_goblin', '哥布林的鑰匙',
       '一隻哥布林蹲在石頭上，晃著手裡的鑰匙：「被鎖住了喔？這個打得開喔。要不要換？」牠的眼神很清楚牠想要什麼。',
       ['trap', 'rest'], [
           opt('直接搶', out('你一把搶過鑰匙。哥布林尖叫著逃了。', give('藍鋼鑰匙')),
               ('dex', 15), out('牠跳開了，還叫來了一群同伴。', cond('drained'), cond('disheveled')), scene='fail'),
           opt('跟牠換', out('你照牠說的「付錢」。牠很守信用，把鑰匙放在你手心——還多給了一把。', give('符文鑰匙'), give('白鐵鑰匙'), lewd('submission', 1)), scene='always'),
           opt('不理牠', out('牠在你背後喊了半天，自己覺得無聊走了。')),
       ], layers=[1, 2, 3, 4], requires={"wearing": {"locked": True}},
       scene='主角為了鑰匙，照哥布林的要求在石頭上「付錢」，被牠和牠的同伴們輪流佔了便宜'),
    # ---- 自願向 ----
    ev('dg_lewd_spring', '淫泉',
       '岩洞深處冒著粉紅色的熱泉，泉邊的石碑寫著：「泡過的人傷口會好，但身體會變得很誠實。」',
       ['gather', 'rest'], [
           opt('泡進去', out('泉水滲進每一道傷口，痛變成了酥麻，酥麻又變成了別的東西。你出來的時候傷全好了，皮膚卻碰一下就發抖。',
                            heal(1), cond('sensitive'), lewd('sensitivity', 2)), scene='always'),
           opt('裝一瓶帶走', out('你小心地裝了一瓶，泉水在瓶子裡還冒著泡。', give('媚香精油')),
               ('int', 12), out('你裝水時手一滑，整隻手臂泡了進去——熱得你差點叫出聲。', give('媚香精油'), cond('aroused'))),
           opt('只泡腳', out('你坐在泉邊泡了一會兒腳，疲勞一掃而空。', heal(0.3))),
       ], layers=[1, 2, 3, 4], tags=WILLING,
       scene='主角泡進粉紅色的淫泉，泉水滲進全身，痛變成酥麻、酥麻變成快感，主角在泉水裡獨自喘息'),
    ev('dg_erotic_book', '遺落的春宮書',
       '地上有一本被翻爛的書，封面畫著兩個糾纏在一起的人。書頁之間夾著不少筆記，看得出前一個主人讀得很認真。',
       ['chest', 'gather'], [
           opt('照著書練習', out('你照著書裡的圖練習了一個晚上，學會了一招。', learn('lust_tease')),
               ('int', 13), out('你練著練著就忘了在練習。', cond('afterglow'), lewd('lewdness', 1)), scene='fail'),
           opt('收起來帶走', out('你把書收進行囊，回城可以賣個好價錢——或者自己留著。', give('《媚術入門》'))),
           opt('燒掉它', out('你把書扔進火堆。火燒得特別旺，你也莫名覺得心裡清淨了些。', xp(15), lewd('lewdness', -1))),
       ], layers=[1, 2, 3, 4], tags=WILLING,
       scene='主角一個人在地下城的角落照著春宮書的圖練習，練著練著就忘了自己在練習'),
]


def write_s9_3():
    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in DUNGEON_EVENTS:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "dg_park_theater_stage".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in DUNGEON_EVENTS])
    d = json.loads(t)
    items = {i['name'] for i in json.load(open('data/rules/items.json'))['items']}
    abilities = set(json.load(open('data/rules/abilities.json'))['abilities'].keys()) if isinstance(json.load(open('data/rules/abilities.json'))['abilities'], dict) else {a['id'] for a in json.load(open('data/rules/abilities.json'))['abilities']}
    tattoos = set(json.load(open('data/rules/tattoos.json'))['templates'])
    conditions = set(json.load(open('data/rules/companions.json'))['conditions'])
    locs = {l['id'] for l in json.load(open('data/world/geography.json'))['locations']}
    for e in DUNGEON_EVENTS:
        for loc in e.get('dungeons', []):
            assert loc in locs, loc
        for o in e['options']:
            for res in (o.get('success'), o.get('fail')):
                for x in (res or {}).get('effects', []):
                    if x['type'] in ('item', 'restrain'):
                        assert x.get('name', x.get('item')) in items, x
                    if x['type'] == 'ability':
                        assert x['ability'] in abilities, x
                    if x['type'] == 'tattoo':
                        assert x['template'] in tattoos, x
                    if x['type'] == 'condition':
                        assert x['condition'] in conditions, x
                    # 陷阱鎖要標「主角非自願」
                    if x['type'] == 'restrain':
                        assert 'pc_unwilling' in e['tags'], e['id']
    assert len(DUNGEON_EVENTS) == 24
    willing = [e for e in DUNGEON_EVENTS if 'pc_unwilling' not in e['tags']]
    assert len(willing) >= 8, len(willing)
    assert len({e['id'] for e in d['templates']}) == len(d['templates'])
    open(p, 'w').write(t)
    print('S9-3 dungeon events', len(DUNGEON_EVENTS), 'willing', len(willing))


# ---------------- S9-4 魅氣濃的城鎮事件 ----------------
MEN = ['adult', 'male_partner']
MEN_UNWILLING = ['adult', 'pc_unwilling', 'male_partner']
CHARM3 = {"charm": {"min": 3}}
CHARM4 = {"charm": {"min": 4}}


def tn(id, title, text, cells, category, options, tags=MEN, scene=None, requires=CHARM3, body=True, cooldown=None, types=None):
    return {"id": id, "scope": "town", "tier": "normal", "kind": "choice", "cells": cells, "category": category,
            **({"location_types": types} if types else {}), "requires": requires, "tags": tags,
            **({"pc_body": BODY} if body else {}), **({"cooldown_days": cooldown} if cooldown else {}),
            "title": title, "text": text, **({"scene": scene} if scene else {}), "options": options}


def uncond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": False}


TOWN_EVENTS = [
    # ---- 酒館 ----
    tn('tn_strip_dice', '桌上的脫衣骰局',
       '角落那桌在玩骰子，輸一把脫一件。桌上已經有兩個人只剩內衣了，莊家朝你招手：「來一局？贏的人把桌上的錢全拿走。」',
       ['tavern'], 'opportunity', [
           opt('上桌擲骰', out('你手氣正旺，一件都沒脫就把桌上的錢掃進口袋。', money(150)),
               ('int', 14), out('你輸了一把又一把，最後只剩一件內衣走出酒館，全場都在吹口哨。', cond('disheveled'), lewd('exposure', 2))),
           opt('在旁邊看', out('你看了幾局，學到了莊家出千的手法。', xp(20))),
           opt('把自己當賭注', out('你把自己押上桌。贏的人拿走了你一整晚——你拿走了桌上一半的錢。', money(250), cond('afterglow'), lewd('exposure', 2)), scene='always'),
       ], scene='主角在酒館角落的賭桌上把自己當成賭注，被贏家當著全桌賭客的面抱上樓享用了一整晚'),
    tn('tn_dancer_short', '舞孃缺人',
       '酒館老闆急得團團轉：今晚的舞孃病了，台下坐滿了等著看的客人。他看到你，眼睛一亮：「你身材不錯——頂一場？錢照付。」',
       ['tavern', 'brothel'], 'opportunity', [
           opt('上台跳一場', out('你跳得比原本的舞孃還好，台下的賞錢丟了一地。', money(120), lewd('exposure', 2)),
               ('dex', 14), out('你踩到裙擺跌了一跤，衣服掉了一半——客人反而叫得更大聲。', money(60), lewd('exposure', 3), cond('disheveled'))),
           opt('婉拒', out('老闆嘆了口氣，請你喝了一杯當作打擾。', cond('cheered'))),
           opt('跳完再陪客人', out('你跳完舞，又被幾個出手大方的客人包了下來，一直陪到打烊。', money(220), cond('drained'), lewd('lewdness', 1)), scene='always'),
       ], scene='主角替病倒的舞孃上台，跳到只剩幾片布料，之後被台下出手最大方的客人們帶進包廂輪流陪到打烊'),
    tn('tn_drinker_wager', '酒客的賭注',
       '一桌喝得滿臉通紅的傭兵把你攔下：「跟我們拚酒！喝贏了，桌上的錢歸你；喝輸了——你歸我們一晚。」',
       ['tavern'], 'trouble', [
           opt('跟他們拚', out('你喝倒了最後一個人，把桌上的錢收得乾乾淨淨。', money(180)),
               ('str', 15), out('你先倒了。醒來的時候在他們的房間裡，身上什麼都沒穿。', cond('drained'), cond('disheveled'), lewd('submission', 1)), scene='fail'),
           opt('笑著推掉', out('你三言兩語把他們哄得哈哈大笑，還被請了一杯。', cond('cheered')),
               ('cha', 13), out('他們不讓你走，摟著你的腰灌了你好幾杯才放手。', cond('tipsy'), cond('aroused'))),
           opt('直接認輸', out('你乾脆地認輸，跟他們上了樓。傭兵們很盡興，臨走前多塞了你幾枚銀幣。', money(40), cond('drained'), cond('afterglow')), scene='always'),
       ], tags=MEN_UNWILLING,
       scene='主角被拚酒贏了的傭兵們帶回房間，醉醺醺的主角被一桌的傭兵輪流壓在床上，一直到天亮'),
    # ---- 旅店 ----
    tn('tn_inn_thin_wall', '隔壁房間的聲音',
       '旅店的牆很薄。隔壁房間的床板吱嘎作響，喘息聲一陣比一陣大，聽起來不只兩個人。',
       ['inn'], 'social', [
           opt('敲牆抗議', out('隔壁安靜了，接著傳來一陣竊笑。你總算睡著了。', cond('well_rested')),
               ('cha', 12), out('隔壁回敲了兩下，聲音反而更大了。你一夜沒睡。', cond('aroused'))),
           opt('從門縫偷看', out('你看到了不該看的東西，回房間時臉還是燙的。', cond('aroused'), xp(10)),
               ('dex', 13), out('門突然開了。裡面的人看到你，笑著把你拉了進去。', cond('afterglow'), cond('disheveled')), scene='fail'),
           opt('敲門加入', out('他們很歡迎你。你們一直鬧到天亮，旅店老闆隔天看你的眼神很奇妙。', cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], tags=WILLING, body=False,
       scene='主角走進隔壁吵鬧的房間，加入了一群不認識的旅客，一直鬧到天亮'),
    tn('tn_inn_extra_service', '老闆娘的附加服務',
       '老闆娘一邊替你登記，一邊壓低聲音：「旅途辛苦吧？樓上有熱水，還有我親自的按摩——加一點錢，還有『特別』的。」',
       ['inn'], 'commerce', [
           opt('只要熱水和按摩', out('老闆娘的手藝很好，你睡得像個嬰兒。', money(-20), cond('relaxed'), cond('well_rested'))),
           opt('婉拒', out('她眨眨眼：「改變主意隨時找我。」')),
           opt('加錢要特別的', out('老闆娘的「特別服務」讓你忘了旅途的疲憊，也忘了自己是誰。', money(-50), cond('relaxed'), cond('well_rested'), cond('afterglow'), lewd('sensitivity', 1)), scene='always'),
       ], tags=WILLING, body=False,
       scene='旅店的老闆娘在熱水房裡替主角按摩，手從肩膀一路往下，「特別服務」做得又慢又仔細'),
    # ---- 城門 ----
    tn('tn_gate_lust_tax', '淫氣稅',
       '城門口的告示寫著：「本城徵收淫氣稅，外地人入城每人一份。」衛兵上下打量你：「付錢，或者付『別的』。」',
       ['gate'], 'trouble', [
           opt('乖乖付錢', out('你付了稅。衛兵有點失望地放行。', money(-40))),
           opt('跟他講價', out('你搬出一套法條，衛兵聽得頭昏，乾脆揮手讓你進去。', xp(20)),
               ('cha', 14), out('衛兵說稅不能少——但可以用「別的」補。他的手在你身上補了很久。', money(-20), cond('aroused'), cond('disheveled'))),
           opt('付「別的」', out('你跟著衛兵進了崗哨。出來的時候，他在你手背上蓋了一個「已繳稅」的章。', cond('afterglow'), lewd('exposure', 1)), scene='always'),
       ], tags=MEN_UNWILLING, requires=CHARM4,
       scene='主角在城門的崗哨裡用身體繳了淫氣稅，衛兵們輪流「驗收」，最後在主角手背蓋上已繳稅的章'),
    tn('tn_gate_body_search', '女衛兵的檢身',
       '一個高個子的女衛兵把你帶進檢查室：「這一帶走私的媚藥很多，要徹底檢查。」她戴上手套，叫你把衣服全脫了。',
       ['gate'], 'trouble', [
           opt('亮出冒險者公會的牌子', out('她看了牌子，嘖了一聲，揮手讓你走。'),
               ('cha', 14), out('「公會的人最會藏東西了。」她的檢查變得格外仔細。', cond('aroused'), cond('disheveled'))),
           opt('塞錢', out('她把錢收進口袋，草草摸了兩下就放你走。', money(-30))),
           opt('乖乖配合', out('你脫光讓她檢查。她檢查得非常、非常徹底——最後紅著臉說「沒問題」。', cond('afterglow'), lewd('exposure', 1)), scene='always'),
       ], tags=UNWILLING, body=False,
       scene='女衛兵在檢查室裡叫主角脫光，戴著手套一寸一寸地「搜查」主角身上每一個能藏東西的地方'),
    tn('tn_gate_restrained', '戴著拘束具進城',
       '衛兵看到你身上的拘束具，把長槍一橫：「哪家的奴隸？主人呢？沒有主人的奴隸，按規矩要先扣下來。」',
       ['gate'], 'trouble', [
           opt('解釋是自己戴的', out('你解釋了半天，衛兵終於信了，還有點佩服地看著你。', lewd('exposure', 1)),
               ('cha', 14), out('衛兵不信，把你帶進崗哨「等主人來領」。等了一整個下午，沒有主人來，衛兵們倒是輪流來了。', cond('drained'), lewd('submission', 1), lewd('exposure', 2)), scene='fail'),
           opt('掙開他們跑進城', out('你趁他們不注意鑽過人群，跑進了城裡。'),
               ('dex', 14), out('被綁著跑不快。你被按在城牆邊「教訓」了一頓。', cond('disheveled'), cond('shaken'))),
           opt('說主人派你來辦事', out('衛兵露出了心照不宣的笑容：「那主人應該不介意我們先檢查一下貨。」', cond('afterglow'), lewd('submission', 1)), scene='always'),
       ], tags=MEN_UNWILLING, requires={"charm": {"min": 3}, "wearing": {"bind": True}},
       scene='戴著拘束具的主角被衛兵當成走失的奴隸扣在崗哨裡，衛兵們藉口「檢查貨」輪流把主角玩了一個下午'),
    # ---- 商店 ----
    tn('tn_tailor_model', '試穿新品的模特兒',
       '裁縫店裡擠滿了客人，老闆娘一看到你就拉住：「就是你了！今天新到的淫服，幫我穿給客人們看看，賣出去分你錢。」',
       ['tailor'], 'opportunity', [
           opt('答應試穿', out('你換了一套又一套，客人們搶著下訂。老闆娘塞給你一把錢。', money(100), lewd('exposure', 2))),
           opt('婉拒', out('老闆娘噘著嘴去找別人了。')),
           opt('試穿，讓客人摸摸布料', out('客人們不只摸布料。等到打烊，你的口袋和身體都被塞得滿滿的。', money(200), lewd('exposure', 3), cond('afterglow')), scene='always'),
       ], scene='主角在裁縫店裡穿著一件件淫服給客人看，客人們藉口摸布料，把手伸進了衣服底下'),
    tn('tn_restraint_trial', '拘束具的試用會',
       '店裡在辦拘束具的試用會：戴上新貨撐過一刻鐘不出聲的人，那件就送他。台上已經有人戴著口球滿臉通紅了。',
       ['tailor', 'smithy'], 'commerce', [
           opt('上台試戴', out('你咬緊牙關撐過了一刻鐘，店主把那副手銬送給了你。', give('皮手銬')),
               ('fai', 14), out('你撐不到一半就叫出了聲。店主笑著說：「可愛，這個送你當紀念。」', give('絲巾口塞'), lewd('submission', 1))),
           opt('在台下看', out('你看完了整場，對拘束具多了不少了解。', xp(20))),
           opt('一件一件試到最後', out('你從手銬試到口球，在台上被拘束了整整一個下午。店主很滿意，把你試過的口球送給了你。', give('口球'), lewd('submission', 1), lewd('endurance', 1)), scene='always'),
       ], tags=WILLING, body=False,
       scene='主角在店裡的試用會上被一件件拘束具輪流鎖上，戴著口球在眾人面前忍著不出聲'),
    tn('tn_locksmith_pitch', '鎖匠的推銷',
       '一個揹著工具箱的鎖匠攔住你：「拘束具的鑰匙要不要？什麼鎖都開得了——被人鎖住的時候，你會感謝我的。」',
       ['smithy', 'shop', 'jeweler'], 'commerce', [
           opt('買一把', out('你買了一把藍鋼鑰匙。', money(-100), give('藍鋼鑰匙'))),
           opt('殺價', out('鎖匠被你說得直搖頭，最後打了對折。', money(-60), give('藍鋼鑰匙')),
               ('cha', 14), out('鎖匠不肯讓，你只好照原價買。', money(-100), give('藍鋼鑰匙'))),
           opt('問他收不收「別的」', out('鎖匠的眼神亮了。他把你帶進後巷，完事之後給了你一把更好的鑰匙。', give('符文鑰匙'), cond('afterglow')), scene='always'),
       ], scene='鎖匠把主角帶進後巷，用身體換了一把符文鑰匙'),
    # ---- 神殿（魅氣濃度 4） ----
    tn('tn_lust_festival', '淫神的祭典',
       '神殿前的廣場在辦祭典：信徒們穿著幾乎透明的祭袍遊行，祭司站在台上高喊：「今年的聖女還缺一位！」',
       ['temple'], 'omen', [
           opt('跟著遊行', out('你換上祭袍跟著遊行，整座城的人都看到了你。', lewd('exposure', 3), cond('cheered'))),
           opt('去求一支籤', out('籤上寫著大吉。祭司替你祝福。', {"type": "condition", "target": "pc", "condition": "blessed", "add": True}),
               ('fai', 14), out('籤上寫著「慾」。祭司笑著說今晚你會很忙。', cond('aroused'))),
           opt('當祭典的聖女', out('你被抬上祭台，獻給了淫神——和所有的信徒。祭典結束時，祭司把一整袋奉獻金交給你，還教了你一首讚歌。',
                                money(300), learn('lust_hymn'), cond('drained'), lewd('exposure', 4)), scene='always'),
       ], requires=CHARM4, cooldown=20,
       scene='主角穿著透明的祭袍被當成聖女抬上祭台，在整座城的信徒面前被獻給淫神，信徒們一個接一個上前領受聖女的「祝福」'),
    tn('tn_purification', '巫女的潔淨儀式',
       '神殿的巫女叫住你：「你身上沾了很多不好的東西。讓我替你潔淨——用我們這裡的方式。」她身上只披著一條白紗。',
       ['temple'], 'opportunity', [
           opt('只要普通的祝福', out('巫女替你灑了聖水，唸了禱詞。', money(-30), {"type": "condition", "target": "pc", "condition": "blessed", "add": True})),
           opt('婉拒', out('巫女點點頭，說你想通了再來。')),
           opt('接受潔淨', out('巫女用她的身體替你一寸一寸地「洗」乾淨。結束時，身上的疲憊和熱都散了。',
                             uncond('drained'), uncond('aroused'), uncond('sensitive'), {"type": "condition", "target": "pc", "condition": "blessed", "add": True}, cond('relaxed')), scene='always'),
       ], tags=WILLING, requires=CHARM4, body=False,
       scene='只披著白紗的巫女在神殿的浴池裡，用自己的身體一寸一寸地替主角「潔淨」'),
    # ---- 公會 ----
    tn('tn_guild_bound_escort', '特殊的護衛委託',
       '公會的櫃檯小姐壓低聲音：「有一個貴族指名要你當護衛，報酬很好——條件是一路上要戴著他準備的手銬。」',
       ['guild'], 'opportunity', [
           opt('接，戴上手銬', out('你戴著手銬護送他走完全程。他很守信用地付了錢——手銬的鑰匙倒是「忘了」給你。', money(250), restrain('皮手銬', 'blue'), lewd('submission', 1)), scene='always'),
           opt('談條件，不戴', out('貴族勉強同意了，報酬打了折。', money(120), xp(30)),
               ('cha', 15), out('貴族不同意，委託取消了。')),
           opt('拒絕', out('櫃檯小姐鬆了口氣：「我就說你不會接。」')),
       ], tags=MEN_UNWILLING,
       scene='主角戴著貴族準備的手銬當護衛，一路上被雇主藉口檢查護衛摸遍全身，到了旅店更是不用說'),
    tn('tn_guild_spar', '冒險者之間的「切磋」',
       '一個魁梧的冒險者攔住你：「聽說你很強？來切磋一下。規矩是——輸的人今晚要聽贏的。」周圍的冒險者都在起鬨。',
       ['guild', 'tavern'], 'social', [
           opt('比力氣', out('你把他摔在地上，全場歡呼。他乖乖請你喝了一整晚的酒。', money(50), xp(40)),
               ('str', 14), out('你被他壓在地上動不了。他笑著把你扛上了樓。', cond('drained'), cond('afterglow')), scene='fail'),
           opt('比誰比較會說', out('你把他說得啞口無言，周圍的人笑成一團。', xp(30), cond('cheered')),
               ('cha', 14), out('他根本不想聽你說話。', cond('shaken'))),
           opt('直接認輸', out('你舉手認輸，跟他上了樓。他比想像中溫柔。', cond('afterglow')), scene='always'),
       ], tags=MEN_UNWILLING,
       scene='主角輸了切磋，被魁梧的冒險者扛上公會樓上的房間，照規矩聽了他一整晚'),
    # ---- 娼館 ----
    tn('tn_brothel_request', '客人指名',
       '你剛走進娼館，媽媽桑就迎上來：「有位客人看到你進門，指名要你——不管你是不是我們這裡的人。他出的價錢很好。」',
       ['brothel'], 'opportunity', [
           opt('接下來', out('客人很滿意，媽媽桑抽了一成，剩下的都是你的。', money(200), cond('afterglow'), lewd('lewdness', 1)), scene='always'),
           opt('抬價', out('客人二話不說付了兩倍。', money(400), cond('drained'), cond('afterglow')),
               ('cha', 15), out('客人覺得你太貪心，走了。媽媽桑白了你一眼。'), scene='success'),
           opt('拒絕', out('媽媽桑聳聳肩：「可惜了。」')),
       ], scene='主角被娼館的客人指名，在最好的房間裡陪了他一整晚'),
    tn('tn_brothel_top_invite', '頭牌的邀請',
       '娼館的頭牌靠在樓梯口，對你勾勾手指：「今晚的客人很難伺候，我一個人應付不來。陪我一起——我教你幾招。」',
       ['brothel'], 'opportunity', [
           opt('一起伺候客人', out('頭牌手把手地教，你學得很快。客人走的時候腿都軟了。',
                                {"type": "ability_pool", "pool": "brothel_work", "fallback": [money(150)]}, money(100), cond('drained')), scene='always'),
           opt('只跟她學，不接客', out('她教了你一個眼神。只是一個眼神，就讓你明白了很多事。', learn('lust_glance')),
               ('cha', 14), out('她說你學得太慢，要你看她示範——你看得臉紅心跳。', cond('aroused'))),
           opt('婉拒', out('她笑了笑：「下次。」')),
       ], scene='主角和娼館的頭牌一起伺候難纏的客人，頭牌一邊示範一邊手把手地教主角怎麼讓客人腿軟'),
    # ---- 街頭（好幾種設施） ----
    tn('tn_slave_parade', '遊街示眾的奴隸',
       '一隊奴隸被鐵鍊串著從大街上走過，身上只有拘束具，脖子上掛著價牌。路人對她們指指點點，有人伸手去摸。',
       ['gate', 'tavern', 'shop'], 'omen', [
           opt('遞一杯水給最後那個', out('她抬頭看了你一眼，小聲說了謝謝。押隊的人沒說什麼。', xp(20), cond('cheered'))),
           opt('打聽她們是從哪來的', out('你從押隊的人嘴裡套出了奴隸商的路線。', xp(40)),
               ('cha', 13), out('押隊的人上下打量你：「你也想來？」你趕緊走開。', cond('shaken'))),
           opt('跟著看到最後', out('你跟著隊伍走到奴隸市場，看著她們一個個被拍賣。回到旅店時，你的心跳還沒平復。', cond('aroused'), lewd('lewdness', 1)), scene='always'),
       ], tags=WILLING, requires=CHARM4, body=False,
       scene='主角跟著遊街的奴隸隊伍走到奴隸市場，看著她們只戴著拘束具一個個被摸、被叫價、被買走'),
    tn('tn_mistaken_slave', '被當成奴隸',
       '一個喝醉的商人看到你身上的拘束具，伸手就拉住你的鍊子：「這是誰家的奴隸？借我玩一晚，錢我照付。」',
       ['tavern', 'inn', 'shop', 'gate'], 'trouble', [
           opt('冷冷地糾正他', out('你一字一句地說你不是任何人的奴隸。他酒醒了一半，道歉跑了。'),
               ('cha', 14), out('他根本不聽，拉著你的鍊子就往巷子裡走。', cond('disheveled'), cond('shaken'))),
           opt('甩開他', out('你一甩手，他摔了個四腳朝天。'),
               ('str', 13), out('被綁著使不上力。他笑著把你拉進了懷裡。', cond('aroused'), cond('disheveled'))),
           opt('順著他的話', out('你低下頭，讓他牽著鍊子走。他玩了一整晚，天亮時真的照付了錢。', money(120), cond('afterglow'), lewd('submission', 1)), scene='always'),
       ], tags=MEN_UNWILLING, requires={"charm": {"min": 3}, "wearing": {"bind": True}},
       scene='喝醉的商人把戴著拘束具的主角當成別人家的奴隸，牽著鍊子帶回房間玩了一整晚'),
    tn('tn_noble_carriage', '貴族的馬車',
       '一輛黑色的馬車在你身邊停下，車簾掀開一角，裡面的人遞出一枚金幣：「上來坐坐吧，我有事想跟你談——在車上。」',
       ['gate', 'shop', 'tavern'], 'opportunity', [
           opt('上車', out('馬車繞了城好幾圈。下車的時候，你的衣服皺了，錢袋鼓了。', money(250), lewd('exposure', 1), cond('afterglow')), scene='always'),
           opt('上車談生意', out('你把話題拉回生意上。對方很欣賞你，給了你一筆委託的訂金。', money(150), xp(40)),
               ('cha', 15), out('對方對生意沒興趣，車簾一放下就把你拉進了懷裡。', money(100), cond('afterglow')), scene='fail'),
           opt('不上車', out('車簾放下，馬車走了。')),
       ], requires=CHARM4, types=['city', 'capital', 'town'],
       scene='主角上了貴族的馬車，車簾放下之後，馬車載著兩人在城裡繞了一圈又一圈'),
]


def write_s9_4():
    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in TOWN_EVENTS:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "town_guard_toll".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in TOWN_EVENTS])
    d = json.loads(t)
    items = {i['name'] for i in json.load(open('data/rules/items.json'))['items']}
    conditions = set(json.load(open('data/rules/companions.json'))['conditions'])
    ab = json.load(open('data/rules/abilities.json'))['abilities']
    abilities = set(ab) if isinstance(ab, dict) else {a['id'] for a in ab}
    cells = {'inn', 'guild', 'tavern', 'shop', 'temple', 'gate', 'brothel', 'smithy', 'tailor', 'jeweler', 'magic', 'informant', 'tattoo', 'carver'}
    for e in TOWN_EVENTS:
        assert set(e['cells']) <= cells, e['id']
        assert e['requires']['charm']['min'] >= 3, e['id']
        for o in e['options']:
            for res in (o.get('success'), o.get('fail')):
                for x in (res or {}).get('effects', []):
                    if x['type'] in ('item', 'restrain'):
                        assert x.get('name', x.get('item')) in items, x
                    if x['type'] == 'ability':
                        assert x['ability'] in abilities, x
                    if x['type'] == 'condition':
                        assert x['condition'] in conditions, x
                    if x['type'] == 'restrain':
                        assert 'pc_unwilling' in e['tags'], e['id']
            if o.get('adult_scene'):
                assert e.get('scene'), e['id']
    assert len(TOWN_EVENTS) == 20
    charm4 = [e for e in TOWN_EVENTS if e['requires']['charm']['min'] == 4]
    chance = [e for e in TOWN_EVENTS if e['category'] in ('opportunity', 'commerce')]
    assert len(charm4) == 5 and len(chance) >= 10, (len(charm4), len(chance))
    assert len({e['id'] for e in d['templates']}) == len(d['templates'])
    open(p, 'w').write(t)
    print('S9-4 town events', len(TOWN_EVENTS), 'charm 4', len(charm4), 'opportunities', len(chance))


# ---------------- S9-5 旅途事件 ----------------
def rd(id, title, text, category, options, tags=MEN, scene=None, modes=None, regions=None, requires=None, body=True):
    return {"id": id, "tier": "normal", "kind": "choice", "category": category, **({"modes": modes} if modes else {}),
            **({"regions": regions} if regions else {}), **({"requires": requires} if requires else {}), "tags": tags,
            **({"pc_body": BODY} if body else {}), "title": title, "text": text, **({"scene": scene} if scene else {}), "options": options}


ROAD_EVENTS = [
    rd('rd_slaver_patrol', '路上的捕奴隊',
       '一隊騎馬的捕奴人從坡後冒出來，領頭的拿著一疊通緝畫像，一張一張地對著你的臉比。「不是這個……不過也不錯。」他舔了舔嘴唇。',
       'trouble', [
           opt('往樹林裡跑', out('你鑽進樹林，馬進不來。他們罵了幾聲就走了。'),
               ('dex', 14), out('馬比你快。他們把你按在地上銬起來，「檢查」到盡興才發現你不在名單上——手銬倒是懶得拿回去。', restrain('皮手銬'), cond('drained')), scene='fail'),
           opt('拔劍', out('你砍倒了領頭的，其他人一哄而散。他的腰包裡有一把鑰匙。', give('白鐵鑰匙'), money(60), xp(40)),
               ('str', 15), out('寡不敵眾。你被他們用藍鋼手銬銬住，丟在路邊。', restrain('皮手銬', 'blue'), cond('drained'), cond('disheveled'))),
           opt('束手就擒', out('你放下武器。他們把你帶到路邊「驗貨」，驗完才發現抓錯人，留下手銬就走了。', restrain('皮手銬'), cond('afterglow'), lewd('submission', 1)), scene='always'),
       ], tags=MEN_UNWILLING, modes=['road', 'trail', 'wild'], regions=['south', 'west'],
       scene='捕奴隊把主角銬住按在路邊，藉口驗貨把主角從頭到腳檢查了一遍，一個接一個地「確認品質」'),
    rd('rd_peddler_cart', '行商的貨車',
       '一輛蓋著帆布的貨車停在路邊，行商掀開帆布一角：手銬、口球、各種鎖和鑰匙掛了一整排。「冒險者？總有用得上的時候。」',
       'commerce', [
           opt('買一把鑰匙', out('你買了一把藍鋼鑰匙。', money(-90), give('藍鋼鑰匙'))),
           opt('殺價買一副手銬', out('行商被你說動，便宜賣了。', money(-60), give('絲帶手銬')),
               ('cha', 13), out('行商不肯讓，你照原價買了。', money(-100), give('絲帶手銬'))),
           opt('問他收不收「別的」', out('行商把你拉進貨車後面。出來的時候，你拿到了一把符文鑰匙，外加一副他「送你試用」的手銬。', give('符文鑰匙'), give('絲帶手銬'), cond('afterglow')), scene='always'),
       ], modes=['road', 'trail'],
       scene='行商把主角拉進蓋著帆布的貨車裡，在一整排拘束具之間用身體抵了一把符文鑰匙的錢'),
    rd('rd_hot_spring', '路邊的溫泉',
       '路邊的岩縫冒著熱氣，是一處沒人管的野溫泉。已經有幾個旅人泡在裡面，朝你揮手：「水很舒服喔，一起來吧。」',
       'opportunity', [
           opt('一個人泡在角落', out('熱水泡得你渾身舒坦，旅途的疲勞一掃而空。', heal(0.5), cond('relaxed'))),
           opt('不泡，繼續趕路', out('你揮揮手走了。')),
           opt('和他們一起泡', out('熱水裡大家越靠越近，誰的手碰到誰都分不清了。泡完的時候你全身發軟，傷倒是全好了。', heal(1), cond('relaxed'), cond('afterglow'), lewd('sensitivity', 1)), scene='always'),
       ], tags=WILLING, body=False, modes=['road', 'trail', 'wild'],
       scene='主角和幾個不認識的旅人泡在路邊的野溫泉裡，在熱氣裡越靠越近，最後在水裡糾纏成一團'),
    rd('rd_lust_shrine', '路邊的淫神小祠',
       '路邊有一座小小的神祠，供著一尊姿態撩人的女神像，祭台上放著香油錢和……幾件貼身衣物。',
       'omen', [
           opt('放下香油錢', out('你放了幾枚錢，心裡莫名地踏實。', money(-20), {"type": "condition", "target": "pc", "condition": "blessed", "add": True})),
           opt('把祭台上的錢拿走', out('你把錢收進口袋。什麼事也沒發生——至少現在還沒有。', money(60)),
               ('fai', 13), out('錢一碰到手，一股熱流就從指尖竄進身體裡。你在祠前蹲了很久才站得起來。', money(60), cond('aroused'), cond('sensitive'))),
           opt('照規矩獻上貼身衣物', out('你脫下貼身的衣物放上祭台，在神像前跪了一會兒。起身時，女神好像對你笑了一下——你懂了一種冥想的法子。',
                                   learn('lust_meditate'), lewd('lewdness', 1), lewd('exposure', 1)), scene='always'),
       ], tags=WILLING, body=False, regions=['south'],
       scene='主角在路邊的淫神小祠前脫下貼身衣物獻上祭台，赤裸地跪在撩人的女神像前，感覺到神像的目光在身上游走'),
    rd('rd_bound_caravan', '被商隊撞見',
       '你身上的拘束具在趕路時叮噹作響。迎面而來的商隊放慢了速度，每個人都盯著你看。',
       'social', [
           opt('若無其事地走過去', out('你抬頭挺胸地走過去，商隊的人反而不好意思看了。', lewd('endurance', 1)),
               ('cha', 14), out('你的臉紅透了。商隊的人一路指指點點，到了下一個城鎮，大家都在說這件事。', lewd('exposure', 2))),
           opt('躲進路邊的樹林', out('你躲到他們走遠才出來。'),
               ('dex', 13), out('被綁著跑不快，你在樹林邊被看了個精光。', lewd('exposure', 1), cond('disheveled'))),
           opt('請他們幫忙', out('商隊的男人們很樂意「幫忙」。他們幫了很久，也看了很久——最後送了你一程，還留下一些乾糧。', give('乾糧', 2), lewd('exposure', 2), cond('afterglow')), scene='always'),
       ], requires={"wearing": {"bind": True}},
       scene='戴著拘束具的主角請路過的商隊幫忙，商隊的男人們藉口幫忙解開，把主角圍在中間摸了個遍'),
    rd('rd_rut_pack', '發情的野獸群',
       '一群眼睛發紅的野狼從草叢裡圍了上來，牠們沒有齜牙，而是嗅著空氣，喘著粗氣——是發情期，而牠們聞到了你。',
       'trouble', [
           opt('爬上樹', out('你三兩下爬上樹。狼群在樹下轉了半天，終於散了。', xp(25)),
               ('dex', 14), out('樹皮太滑，你被拖了下來。狼群圍著你，直到發情的熱度退了才離開。', cond('drained'), cond('disheveled'), lewd('sensitivity', 1)), scene='fail'),
           opt('用火把趕走牠們', out('火光一晃，狼群夾著尾巴逃了。'),
               ('int', 14), out('火把被撲滅了。你只能用手臂護著頭，任由牠們在身上嗅來嗅去。', cond('shaken'), cond('aroused'))),
           opt('不動', out('你一動也不動。領頭的狼在你身上嗅了很久，舔了你幾下，最後帶著狼群走了。', cond('aroused'), cond('shaken'))),
       ], tags=UNWILLING, body=False, modes=['trail', 'wild'], regions=['south'],
       scene='發情的狼群把主角拖倒在草地上，熱烘烘的鼻息和舌頭在主角身上到處嗅舔'),
    rd('rd_noble_host', '鄉紳的款待',
       '路邊莊園的管家攔下你：「我家主人認得您的家紋，請務必到莊園休息一晚。」莊園主人親自出來迎接，眼神在你身上停了很久。',
       'opportunity', [
           opt('接受款待', out('莊園的床又軟又暖，早餐豐盛得像宴會。', cond('well_rested'), cond('fed_well'))),
           opt('請他派人護送一程', out('莊園主人爽快地答應，還送了你一袋路費。', money(120), xp(30)),
               ('cha', 13), out('莊園主人說護衛都派出去了，只能請你自己保重。')),
           opt('接受「特別的款待」', out('晚宴之後，莊園主人親自到你的房間來「款待」。天亮時，你的行囊裡多了一袋金幣和一封介紹信。', money(250), cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], modes=['road'], requires={"pc_tags": ["noble", "royal"]},
       scene='莊園主人在晚宴之後來到主角的客房，以款待貴族的禮數，一整晚親自伺候主角'),
    rd('rd_priest_confession', '路邊的告解',
       '一個旅人在路邊跪下攔住你：「神官大人，請聽我告解。」他告解的內容越說越露骨，最後抬頭看著你：「請您……用您的方式赦免我。」',
       'social', [
           opt('聽完、給他赦免的禱詞', out('你聽完了，替他唸了赦免的禱詞。他哭著道謝，你也覺得心裡平靜。', {"type": "condition", "target": "pc", "condition": "blessed", "add": True}, xp(30)),
               ('fai', 13), out('你聽著聽著，臉越來越紅，禱詞唸得結結巴巴。', cond('aroused'))),
           opt('婉拒', out('你說告解要到神殿去。他失望地讓開了路。')),
           opt('用「您的方式」赦免他', out('你帶他到路邊的樹後，用你的方式赦免了他的罪——他走的時候，在你手裡塞了一筆奉獻。', money(80), cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], modes=['road', 'trail'], requires={"pc_tags": ["priest", "bishop"]},
       scene='身為神官的主角在路邊的樹後，用自己的身體「赦免」一個告解者的罪'),
]


def write_s9_5():
    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in ROAD_EVENTS:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "road_recognized".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in ROAD_EVENTS])
    d = json.loads(t)
    items = {i['name'] for i in json.load(open('data/rules/items.json'))['items']}
    conditions = set(json.load(open('data/rules/companions.json'))['conditions'])
    ab = json.load(open('data/rules/abilities.json'))['abilities']
    abilities = set(ab) if isinstance(ab, dict) else {a['id'] for a in ab}
    regions = {r['id'] for r in json.load(open('data/world/geography.json'))['regions']}
    tags = set(json.load(open('data/rules/npc_tags.json'))['tags'])
    for e in ROAD_EVENTS:
        assert set(e.get('regions', [])) <= regions, e['id']
        assert set(e.get('requires', {}).get('pc_tags', [])) <= tags, e['id']
        for o in e['options']:
            for res in (o.get('success'), o.get('fail')):
                for x in (res or {}).get('effects', []):
                    if x['type'] in ('item', 'restrain'):
                        assert x.get('name', x.get('item')) in items, x
                    if x['type'] == 'ability':
                        assert x['ability'] in abilities, x
                    if x['type'] == 'condition':
                        assert x['condition'] in conditions, x
                    if x['type'] == 'restrain':
                        assert 'pc_unwilling' in e['tags'], e['id']
            if o.get('adult_scene'):
                assert e.get('scene'), e['id']
    assert len(ROAD_EVENTS) == 8
    willing = [e for e in ROAD_EVENTS if 'pc_unwilling' not in e['tags']]
    assert len(willing) >= 4, len(willing)
    assert len({e['id'] for e in d['templates']}) == len(d['templates'])
    open(p, 'w').write(t)
    print('S9-5 road events', len(ROAD_EVENTS), 'willing', len(willing))


# ---------------- S9-6 淫服補充 ----------------
def outfit(slot, name, kind, price, scale, desc, exposure=None, armor=None):
    return {"slot": slot, "name": name, "kind": kind, **({"armor": armor} if armor else {}), "price": price, "scale": scale,
            **({"exposure": exposure} if exposure is not None else {}), "outfit": "adult", "adult": True, "desc": desc}


OUTFIT_BASES = {
    "micro_bikini": outfit("body", "微比基尼", "cloth", 60, {"save": "up"}, "三片巴掌大的布和幾條細繩，遮住的比露出的少得多。", 3, "cloth"),
    "sling_swimsuit": outfit("body", "吊帶泳衣", "cloth", 80, {"save": "up"}, "從肩膀拉到胯下的一條 V 字形布帶，正面背面都只有那一條。", 3, "cloth"),
    "dancer_veils": outfit("body", "舞孃紗衣", "cloth", 150, {"save": "up"}, "層層疊疊的半透明紗巾，綴著金幣與小鈴，轉起來什麼都藏不住。", 2, "cloth"),
    "open_gown": outfit("body", "開胸晚禮服", "cloth", 300, {"save": "up"}, "裙擺曳地、胸口卻一路開到肚臍的晚禮服，淫靡之地的貴婦們最愛的款式。", 2, "cloth"),
    "micro_skirt": outfit("legs", "超短裙", "cloth", 30, {"save": "half"}, "短到一彎腰就什麼都看得見的裙子。", 2),
    "assless_chaps": outfit("legs", "無襠皮褲", "leather", 120, {"evade": "half"}, "只包住兩條腿的皮褲，胯下和臀部是空的。", 3),
    "platform_heels": outfit("feet", "水晶高跟鞋", "cloth", 60, {"evade": "half"}, "透明鞋跟高得嚇人的厚底高跟鞋，舞台上的舞孃都穿這個。"),
    "latex_gloves": outfit("wrists", "乳膠長手套", "leather", 60, {"crit": "third", "save": "half"}, "亮面的黑色長手套，緊緊貼著手臂一直包到肩膀。"),
    "garter_belt": outfit("belt", "吊襪腰帶", "cloth", 40, {"save": "half"}, "掛著四條吊帶的蕾絲腰帶，扣在網襪或長襪上。"),
    "cupless_bra": outfit("underwear_top", "開胸胸罩", "cloth", 40, {"save": "third"}, "只有托底和肩帶的胸罩，該遮的地方是空的。", 3),
    "succubus_horns": outfit("head", "魅魔角頭飾", "jewel", 80, {"save": "up"}, "一對彎彎的黑角裝在髮箍上，角尖鑲著小寶石，戴上就像個魅魔。"),
    "body_chain": outfit("accessory", "身體鍊", "jewel", 150, {"save": "third_up"}, "從頸子垂到胸前、再纏過腰間的細鍊，隨著呼吸閃閃發亮。"),
}
# 最露骨的（曝露度 3）只在魅氣濃度 3 以上的城鎮賣
CHARM_ONLY = {"micro_bikini", "sling_swimsuit", "assless_chaps", "cupless_bra"}
SHOP_OF = {"cloth": "tailor", "leather": "tailor", "jewel": "jeweler"}
TIERS = {"cloth": ["linen", "silk", "moonsilk"], "leather": ["leather", "hard_leather", "beast_hide"], "jewel": ["copper", "silver", "gold"]}


def std_name(materials, base, mat):
    """和 gear.ts 的 gearName 相同的制式名稱"""
    m = materials[mat]
    b = OUTFIT_BASES[base]['name']
    if m['kind'] == 'leather' and b.startswith('皮'):
        return b if m['tier'] == 1 else m['name'] + (b[1:] if m['name'].endswith('皮') else b)
    return m['name'] + b


OUTFIT_UNIQUES = [
    item('緋夢夫人的晚禮服', 3600, ['unique'], '緋夢夫人在宴會上穿過一次就賞給下人的晚禮服——胸口開得比任何一件都低，裙擺上的寶石卻是真的。',
         {"base": "open_gown", "material": "moonsilk", "attrs": {"cha": 2}, "lewd": {"lewdness": 5}}),
    item('流沙聖殿的舞孃紗衣', 2400, ['unique'], '古代神殿的舞孃獻舞時穿的紗衣，金幣上刻著已經沒人看得懂的祈禱文。',
         {"base": "dancer_veils", "material": "silk", "attrs": {"dex": 1, "cha": 1}}),
    item('潮汐港的微比基尼', 1800, ['unique'], '觸手水族館的「濕身展示」用的比基尼，泡過水之後會變得更透。',
         {"base": "micro_bikini", "material": "silk", "attrs": {"dex": 1}, "lewd": {"sensitivity": 5}}),
    item('黑薔薇的乳膠手套', 2600, ['unique'], '性戰場的冠軍才拿得到的手套：指尖碰到哪裡，哪裡就軟下去。',
         {"base": "latex_gloves", "material": "hard_leather", "attrs": {"dex": 1}, "unique": {"check": {"kinds": ["seduce"]}, "bonus": 2}}),
    item('夜蝶的吊襪腰帶', 2000, ['unique'], '傳說中某位頭牌從不離身的吊襪腰帶，扣上之後腰會自己知道該怎麼擺。',
         {"base": "garter_belt", "material": "silk", "lewd": {"lewdness": 4, "endurance": 4}}),
    item('夢魔氏族的角冠', 3200, ['unique'], '夢魔氏族的執行者頭上的角冠，不是裝飾——是從前一任主人頭上拔下來的真角。',
         {"base": "succubus_horns", "material": "gold", "attrs": {"cha": 1, "int": 1}}),
]
OUTFIT_SOURCES = {
    "chests": {"deep": [["流沙聖殿的舞孃紗衣", 0.02]], "abyss": [["夜蝶的吊襪腰帶", 0.03]]},
    "park": [["潮汐港的微比基尼", 0.02]],
    "auction": [["緋夢夫人的晚禮服", 2]],
    "arena": {"ring": "lust", "rare": {"tier": 5, "chance": 0.25, "items": ["黑薔薇的乳膠手套"]}},
    "loot": {"enemy": "incubus_enforcer", "item": "夢魔氏族的角冠", "chance": 0.65},
}


def write_s9_6():
    g = json.load(open('data/rules/gear.json'))
    materials = g['materials']
    # 底材
    p = 'data/rules/gear.json'
    t = open(p).read()
    for k in OUTFIT_BASES:
        t = drop_lines(t, r'\n    "' + k + r'": \{.*')
    t = insert_after(t, r'\n    "fishnet": \{.*', [f'    "{k}": ' + json.dumps(v, ensure_ascii=False) for k, v in OUTFIT_BASES.items()])
    for layer, rows in OUTFIT_SOURCES['chests'].items():
        def add(v, rows=rows):
            mine = {n for n, _ in rows}
            v['items'] = [x for x in v['items'] if x[0] not in mine] + rows
        t = edit_line(t, r'^    "' + layer + r'": ', add)
    json.loads(t)
    open(p, 'w').write(t)
    # 制式品（前三級材料，價格 = 底材價格 × 材料倍率）與獨特品
    std = []
    for base, b in OUTFIT_BASES.items():
        for mat in TIERS[b['kind']]:
            assert materials[mat]['kind'] == b['kind'], (base, mat)
            std.append({"name": std_name(materials, base, mat), "category": "equipment", "price_cc": round(b['price'] * materials[mat]['price']),
                        "tags": [SHOP_OF[b['kind']]], **({"charm_min": 3} if base in CHARM_ONLY else {}), "gear": {"base": base, "material": mat},
                        # 第三級材料和其他制式品一樣要城市以上才賣
                        **({"min_location": "city"} if materials[mat]['tier'] == 3 else {})})
    new_items = std + OUTFIT_UNIQUES
    p = 'data/rules/items.json'
    t = open(p).read()
    for i in new_items:
        t = drop_lines(t, r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*')
    t = insert_after(t, r'\n    \{ "name": "月影絲網襪".*', ['    ' + json.dumps(i, ensure_ascii=False) for i in new_items])
    d = json.loads(t)
    names = [i['name'] for i in d['items']]
    assert len(names) == len(set(names)), [n for n in names if names.count(n) > 1][:5]
    open(p, 'w').write(t)
    # 園區寶箱、拍賣會、性戰場的稀有獎品
    unique_names = {i['name'] for i in OUTFIT_UNIQUES}
    p = 'data/rules/lewd.json'
    t = open(p).read()
    d = json.loads(t)
    park = [x for x in d['park']['chest_items'] if x[0] not in unique_names] + OUTFIT_SOURCES['park']
    t = re.sub(r'^(    "chest_items": )(.*?)(,?)$', lambda m: m.group(1) + json.dumps(park, ensure_ascii=False) + m.group(3), t, count=1, flags=re.M)

    def auction(v):
        v['pool'] = [x for x in v['pool'] if x[0] not in unique_names] + OUTFIT_SOURCES['auction']
    t = edit_line(t, r'^  "auction": ', auction)

    def arena(v):
        v['rings'][OUTFIT_SOURCES['arena']['ring']]['rare'] = OUTFIT_SOURCES['arena']['rare']
    t = edit_line(t, r'^  "arena": ', arena)
    json.loads(t)
    open(p, 'w').write(t)
    # 夢魔氏族的執行者的掉落
    p = 'data/rules/enemies.json'
    t = open(p).read()
    src = OUTFIT_SOURCES['loot']
    m = re.search(r'^    (\{"id": "' + src['enemy'] + r'".*?\})(,?)$', t, re.M)
    e = json.loads(m.group(1))
    e['loot'] = [x for x in e.get('loot', []) if x['item'] != src['item']] + [{"item": src['item'], "chance": src['chance']}]
    t = t[:m.start(1)] + json.dumps(e, ensure_ascii=False) + t[m.end(1):]
    json.loads(t)
    open(p, 'w').write(t)
    print('S9-6 outfit bases', len(OUTFIT_BASES), 'standard items', len(std), 'uniques', len(OUTFIT_UNIQUES))


if __name__ == '__main__':
    write_s9_2()
    write_s9_3()
    write_s9_4()
    write_s9_5()
    write_s9_6()
