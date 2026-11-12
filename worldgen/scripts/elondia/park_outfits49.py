# 緋夢樂園主題體驗區的五件套服裝（成人向，docs/LUST_PARK.md 第 9 節）：
#   1. gear.json   每館一套五件（上身、下身、頭、飾品、第五件）的底材；乳牛比基尼改成「乳牛比基尼上衣」（上衣類）、多一件下著
#                  人馬族穿不了的下身、鞋子、腿部飾品各有一件人馬族版（races centaur，wear_as 當作原本那件）
#   2. items.json  每件三種材料等級的店貨（成人用品店偶爾上架；第三級另外標那一館的 costume_<館>，那一館的換衣間也隨機上架）；
#                  舊的「…乳牛比基尼」改名成「…乳牛比基尼上衣」（讀舊存檔時 state.ts 的 renameOldItems 換名字）
#   3. shops.json  每館一種換衣間（costume_ranch、costume_greenhouse、costume_aquarium、costume_garden、costume_theater）：
#                  那一館的第一、二級每天固定上架，第三級隨機幾件。店的位置寫在 park_experience48.py 的地圖
#                  （四館在館裡；花園的在體驗區，因為進花粉溫室前就要穿好）
#   4. enemies.json 各園區的三隻層主有機率掉自己園區套裝的一件（越深材料越好）
# 要排在 outfits47.py、park_experience48.py（牛尾腰飾、各館的身分）之後。可以重跑。
import json
import re

TIERS = {"cloth": ["linen", "silk", "moonsilk"], "leather": ["leather", "hard_leather", "beast_hide"], "jewel": ["copper", "silver", "gold"]}
TOP = {"save": "up", "evade": "up"}           # 布的上身（同乳牛比基尼、透視薄紗睡衣）
SKIRT = {"save": "half", "evade": "quarter"}   # 布的下身（同超短裙）
LEATHER = {"evade": "half"}                    # 皮的上身、下身、鞋子
HEAD = {"save": "up", "evade": "quarter"}
NECK = {"save": "third_up"}
BELT = {"save": "half"}
WRIST = {"save": "half", "dr": "quarter"}
FEET = {"evade": "half"}
ANKLE = {"evade": "third"}


def b(slot, name, kind, price, scale, desc, exposure=0, **extra):
    out = {"slot": slot, "name": name, "kind": kind}
    if slot == 'body':
        out["armor"] = kind
    out.update({"price": price, "scale": scale, "exposure": exposure, "outfit": "adult", "adult": True, "desc": desc})
    out.update(extra)
    return out


# 每館的套裝：館、身分、五件（底材 id）；乳牛裝的頭、項圈、腰飾、魅魔角是原本就有的
SETS = [
    # (館, 身分, 五件, 層主, 換衣間的店種 id, 店名)
    ("淫獸牧場", "精牛乳牛", ["cow_bikini", "cow_bikini_bottom", "cow_horns", "cowbell_collar", "cow_tail"], ["lp_boss_hound_alpha", "lp_boss_white_fox", "lp_boss_stallion"], "costume_ranch", "牧場換衣間"),
    ("蟲之溫室", "苗床", ["silk_veil_top", "silk_veil_skirt", "antenna_band", "cocoon_gloves", "egg_chain"], ["lp_boss_slime_mother", "lp_boss_slug_king", "lp_boss_hive_queen"], "costume_greenhouse", "溫室換衣間"),
    ("觸手水族館", "表演者", ["shell_top", "mermaid_skirt", "pearl_tiara", "pearl_necklace", "fin_anklets"], ["lp_boss_tank_octopus", "lp_boss_sea_serpent", "lp_boss_abyss_mother"], "costume_aquarium", "水族館換衣間"),
    ("淫植花園", "體驗者", ["petal_bra", "petal_skirt", "flower_crown", "vine_bracelets", "leaf_sandals"], ["lp_boss_giant_glue", "lp_boss_lotus", "lp_boss_flower_queen"], "costume_garden", "花園換衣間"),
    ("夢魔劇場", "劇場工作人員", ["succubus_bustier", "succubus_shorts", "succubus_horns", "succubus_tail", "succubus_boots"], ["lp_boss_manager", "lp_boss_director", "lp_boss_queen"], "costume_theater", "劇場換衣間"),
]

COW_TOP = {"name": "乳牛比基尼上衣", "top_only": True, "desc": "黑白花紋的小比基尼胸罩，只遮得住一點點；配著同款的下著與牛鈴最合適。"}

BASES = {
    "cow_bikini_bottom": b("legs", "乳牛比基尼下著", "cloth", 60, SKIRT, "黑白花紋的小比基尼三角褲，側邊用細帶綁著，後面留了穿牛尾的小孔。", 3),
    # 蟲之溫室：苗床裝
    "silk_veil_top": b("body", "蛛絲薄紗胸衣", "cloth", 80, TOP, "淫巨蛛的絲織成的薄紗胸衣，透得像沒穿，貼著皮膚還帶點黏。", 3, top_only=True),
    "silk_veil_skirt": b("legs", "蛛絲薄紗裙", "cloth", 60, SKIRT, "同樣用蛛絲織的薄紗短裙，肚子以下什麼都遮不住，是讓人看苗床的肚子用的。", 3),
    "antenna_band": b("head", "觸角髮箍", "cloth", 20, HEAD, "一對會隨著走路晃動的蟲觸角，戴上就是溫室的苗床。"),
    "cocoon_gloves": b("wrists", "繭絲長手套", "cloth", 40, WRIST, "用蠶繭抽的絲織成的長手套，薄而有光澤，一直套到手肘。"),
    "egg_chain": b("belt", "蟲卵腰鏈", "jewel", 100, BELT, "一串蟲卵形狀的珠子串成的腰鏈，掛在小腹上，走路時輕輕碰撞。"),
    # 觸手水族館：人魚裝
    "shell_top": b("body", "貝殼胸衣", "cloth", 80, TOP, "兩片貝殼用細繩綁成的胸衣，下水也不會掉——大概吧。", 3, top_only=True),
    "mermaid_skirt": b("legs", "人魚鱗片泳裙", "cloth", 60, SKIRT, "綴滿亮片鱗的短泳裙，濕了以後緊緊貼在身上。", 3),
    "pearl_tiara": b("head", "珍珠髮飾", "jewel", 80, HEAD, "一圈小珍珠串成的髮飾，在水族館的藍光下閃閃發亮。"),
    "pearl_necklace": b("accessory", "珍珠頸鍊", "jewel", 80, NECK, "貼著頸子的一串珍珠，表演者的標誌。"),
    "fin_anklets": b("leg_accessory", "鰭紗腳環", "cloth", 30, ANKLE, "繫在腳踝的薄紗，像魚鰭一樣在水裡飄。"),
    # 淫植花園：花瓣裝
    "petal_bra": b("body", "花瓣胸衣", "cloth", 80, TOP, "幾片大花瓣疊成的胸衣，花園特製，不會被花粉溶掉。", 3, top_only=True),
    "petal_skirt": b("legs", "花瓣短裙", "cloth", 60, SKIRT, "一圈花瓣圍成的短裙，風一吹就掀起來。", 3),
    "flower_crown": b("head", "花冠", "cloth", 20, HEAD, "用媚香蘭與小花編的花冠，聞久了有點暈。"),
    "vine_bracelets": b("wrists", "藤蔓手環", "cloth", 40, WRIST, "細藤纏成的手環，偶爾會自己收緊一下。"),
    "leaf_sandals": b("feet", "葉片涼鞋", "cloth", 20, FEET, "大葉片包成的涼鞋，踩在花園的苔蘚上一點聲音都沒有。"),
    # 夢魔劇場：魅魔裝
    "succubus_bustier": b("body", "魅魔胸衣", "leather", 300, LEATHER, "黑色皮革的馬甲式胸衣，胸口開得很低，背後一排交叉的繫帶。", 3, top_only=True),
    "succubus_shorts": b("legs", "魅魔短褲", "leather", 120, LEATHER, "短到只剩一條帶子的皮短褲，後面開了穿尾巴的口。", 3),
    "succubus_tail": b("belt", "魅魔尾巴", "leather", 60, BELT, "繫在腰後的一條細長的黑尾巴，尖端是心形，會跟著心情擺動。"),
    "succubus_boots": b("feet", "魅魔高筒靴", "leather", 80, FEET, "鞋跟細高的黑皮長靴，一直包到大腿。"),
}

# 人馬族版（races centaur，wear_as）：人馬族穿不了一般的下身、鞋子、腿部飾品，各館缺的那幾件另外做一件
HORSE = {"races": ["centaur"]}
CENTAUR = {
    "cow_horse_cloth": b("legs", "乳牛花紋馬衣", "cloth", 60, SKIRT, "人馬族穿的黑白花紋短馬衣，只蓋住馬身的前半截，後面留了穿牛尾的口。", 3, wear_as="cow_bikini_bottom", **HORSE),
    "silk_veil_horse_cloth": b("legs", "蛛絲薄紗馬衣", "cloth", 60, SKIRT, "人馬族的苗床穿的蛛絲薄紗馬衣，從腰際垂到馬腹，透得什麼都看得見。", 3, wear_as="silk_veil_skirt", **HORSE),
    "mermaid_horse_cloth": b("legs", "人魚鱗片馬衣", "cloth", 60, SKIRT, "綴滿亮片鱗的人馬族短馬衣，下水以後緊緊貼在馬身上。", 3, wear_as="mermaid_skirt", **HORSE),
    "fin_hoof_ribbons": b("leg_accessory", "鰭紗蹄帶", "cloth", 30, ANKLE, "繫在四條馬腿上的薄紗，像魚鰭一樣在水裡飄。", wear_as="fin_anklets", **HORSE),
    "petal_horse_cloth": b("legs", "花瓣馬衣", "cloth", 60, SKIRT, "一圈花瓣圍成的人馬族短馬衣，花園特製，不會被花粉溶掉。", 3, wear_as="petal_skirt", **HORSE),
    "leaf_hoof_wraps": b("feet", "葉片蹄套", "cloth", 20, FEET, "大葉片包成的蹄套，前蹄、後蹄各一雙，踩在苔蘚上一點聲音都沒有。", wear_as="leaf_sandals", **HORSE),
    "succubus_horse_cloth": b("legs", "魅魔馬衣", "leather", 120, LEATHER, "短得只蓋住馬背的黑皮馬衣，後面開了穿尾巴的口。", 3, wear_as="succubus_shorts", **HORSE),
    "succubus_hoof_boots": b("feet", "魅魔蹄靴", "leather", 80, FEET, "黑皮的高筒蹄靴，蹄底墊高了一截，走起來一步一響。", wear_as="succubus_boots", **HORSE),
}
BASES.update(CENTAUR)


def pieces_of(pieces):
    """一館的服裝：五件，加上人馬族版"""
    return list(pieces) + [k for k, v in CENTAUR.items() if v['wear_as'] in pieces]


# 層主掉落：淺層（7 級）、中層（10 級）、深層（13 級）的材料等級與每件的機率（五件各擲一次）
DROPS = [(2, 0.05), (3, 0.05), (3, 0.08)]


def item_name(base, mat, mats):
    """和遊戲的 gearName 一樣（gear.ts；outfits47.py 的 item_name）"""
    m = mats[mat]
    n = base['name']
    if m['kind'] == 'leather' and n.startswith('皮'):
        return n if m['tier'] == 1 else m['name'] + (n[1:] if m['name'].endswith('皮') else n)
    return m['name'] + n


def write_gear():
    p = 'data/rules/gear.json'
    t = open(p).read()
    for k in BASES:
        t = re.sub(r'\n    "' + k + r'": \{.*', '', t)
    # 乳牛比基尼 → 上衣（只改名字、說明，標上衣類）
    lm = re.search(r'\n    "cow_bikini": \{.*', t)
    assert lm
    line = lm.group(0)
    cur = json.loads(line.split(':', 1)[1].strip().rstrip(','))
    cur.update(COW_TOP)
    t = t[:lm.start()] + '\n    "cow_bikini": ' + json.dumps(cur, ensure_ascii=False) + (',' if line.rstrip().endswith(',') else '') + t[lm.end():]
    m = re.search(r'\n    "cow_tail": \{.*', t)
    assert m and m.group(0).endswith(',')
    t = t[:m.end()] + ''.join('\n    "' + k + '": ' + json.dumps(v, ensure_ascii=False) + ',' for k, v in BASES.items()) + t[m.end():]
    d = json.loads(t)
    for _, _, pieces, _, _, _ in SETS:
        slots = [d['bases'][x]['slot'] for x in pieces]
        assert len(set(slots)) == 5, slots
    for k, v in CENTAUR.items():
        assert d['bases'][v['wear_as']]['slot'] == v['slot'], k
    open(p, 'w').write(t)
    return d


def tier_items(g):
    """每件三種材料等級的店貨（照 outfits47 的定價：底材價 × 材料倍率）"""
    mats = g['materials']
    out = {}
    for _, _, pieces, _, shop, _ in SETS:
        for k in pieces_of(pieces):
            base = g['bases'][k]
            for mat in TIERS[base['kind']]:
                tier = mats[mat]['tier']
                it = {"name": item_name(base, mat, mats), "category": "equipment", "price_cc": base['price'] * mats[mat]['price'],
                      "tags": ["adult_shop"] + ([shop] if tier >= 3 else []), "adult": True}
                if tier >= 3:
                    it["min_location"] = "city"
                if base.get('exposure', 0) >= 2:
                    it["charm_min"] = 3
                it["gear"] = {"base": k, "material": mat}
                out[(k, tier)] = it
    return out


OLD_COW = {"亞麻乳牛比基尼": "亞麻乳牛比基尼上衣", "絲綢乳牛比基尼": "絲綢乳牛比基尼上衣", "月影絲乳牛比基尼": "月影絲乳牛比基尼上衣"}


def write_items(g):
    p = 'data/rules/items.json'
    t = open(p).read()
    items = tier_items(g)
    # 新的底材與乳牛比基尼上衣整行重寫；原本就有的（牛角頭飾、牛鈴項圈、牛尾腰飾、魅魔角頭飾）只在第三級加上 costume
    own = {key: i for key, i in items.items() if key[0] in BASES or key[0] == 'cow_bikini'}
    for n in {i['name'] for i in own.values()} | set(OLD_COW):
        t = re.sub(r'\n    \{ ?"name": "' + re.escape(n) + r'".*', '', t)
    m = re.search(r'\n    \{ ?"name": "月影絲牛尾腰飾".*', t)
    assert m and m.group(0).endswith(',')
    t = t[:m.end()] + ''.join('\n    ' + json.dumps(i, ensure_ascii=False) + ',' for i in own.values()) + t[m.end():]
    for (k, tier), i in items.items():
        if (k, tier) in own or tier < 3:
            continue
        lm = re.search(r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*', t)
        assert lm, i['name']
        line = lm.group(0)
        it = json.loads(line.strip().rstrip(','))
        it['tags'] = [x for x in it['tags'] if not x.startswith('costume')] + [x for x in i['tags'] if x.startswith('costume')]
        t = t[:lm.start()] + '\n    ' + json.dumps(it, ensure_ascii=False) + (',' if line.rstrip().endswith(',') else '') + t[lm.end():]
    all_names = [i['name'] for i in json.loads(t)['items']]
    assert len(all_names) == len(set(all_names))
    for i in items.values():
        assert i['name'] in all_names, i['name']
    open(p, 'w').write(t)
    return items


def costume_shop(hall, role, shop, name):
    return {
        "name": name, "emoji": "👗",
        "desc": f"緋夢樂園主題體驗區的換衣間：{hall}規定的五件套服裝（當{role}要五件都穿上；人馬族另有馬衣、蹄具的版本）。第一、二級每天都有，第三級偶爾上架，魅魔店員還會幫忙換上。",
        "ai": False, "cell": shop, "keeper": {"classes": ["bard", "rogue"], "title": "店員", "tags": ["merchant"]},
        "catalog_tag": shop, "outfits": [1, 2], "buys": ["equipment"], "ai_effects": ["item", "affinity", "flag", "memory", "gear"],
        "specials": [],
    }


NAMING = {
    "suffix": ["換衣間", "衣裳間", "更衣室"],
    "desc": ["{air}；一排排衣架上掛著同一館的五件套，換衣簾後面傳來嬉笑聲。", "{air}，鏡子前的魅魔店員拿著皮尺朝你招手。", "{air}；牆上貼著這一館的海報，底下寫著要穿哪五件。"],
    "greeting": ["要當展示品？我幫你挑一整套。", "五件都穿上才算喔，少一件都不行。", "先量尺寸——別害羞，這裡每個人都看過了。"],
}


def write_shop(items):
    p = 'data/rules/shops.json'
    t = open(p).read()
    # 拿掉上一次寫的（包括以前體驗區入口那一間 costume）
    t = re.sub(r'\n    "costume[a-z_]*": \{\n.*?\n    \},', '', t, flags=re.S)
    blocks = ''
    shops = {}
    for hall, role, pieces, _, sid, name in SETS:
        shop = costume_shop(hall, role, sid, name)
        own = set(pieces_of(pieces))
        shop["fixed"] = [{"item": i['name'], "stock": 2} for (k, tier), i in items.items() if tier <= 2 and k in own]
        assert len(shop["fixed"]) <= 20, sid
        shops[sid] = shop
        # 和其他店種一樣：每個欄位一行，接在流浪商人前面
        lines = [f'      "{k}": ' + json.dumps(v, ensure_ascii=False) for k, v in shop.items()]
        blocks += '\n    "' + sid + '": {\n' + ',\n'.join(lines) + '\n    },'
    i = t.index('\n    "wanderer": {')
    t = t[:i] + blocks + t[i:]
    # 店名的字詞：接在 naming 的 suffix、desc、greeting 最後
    for key in ('suffix', 'desc', 'greeting'):
        m = re.search(r'\n    "' + key + r'": \{\n(.*?)\n    \}', t, re.S)
        lns = [ln for ln in m.group(1).split('\n') if not ln.strip().startswith('"costume')]
        lns[-1] = lns[-1].rstrip(',') + ','
        lns += ['      "' + sid + '": ' + json.dumps(NAMING[key], ensure_ascii=False) + ',' for sid in shops]
        lns[-1] = lns[-1].rstrip(',')
        t = t[:m.start(1)] + '\n'.join(lns) + t[m.end(1):]
    d = json.loads(t)
    assert 'costume' not in d['types']
    for sid, shop in shops.items():
        assert d['types'][sid] == shop
        for key in ('suffix', 'desc', 'greeting'):
            assert d['naming'][key][sid] == NAMING[key]
    open(p, 'w').write(t)


def write_drops(items):
    p = 'data/rules/enemies.json'
    t = open(p).read()
    for _, _, pieces, bosses, _, _ in SETS:
        pieces = pieces_of(pieces)
        for boss, (tier, chance) in zip(bosses, DROPS):
            names = {items[(k, t2)]['name'] for k in pieces for t2 in (1, 2, 3)}
            lm = re.search(r'\n(\s*)\{ ?"id": "' + re.escape(boss) + r'".*', t)
            assert lm, boss
            line = lm.group(0)
            e = json.loads(line.strip().rstrip(','))
            e['loot'] = [x for x in e.get('loot', []) if x.get('item') not in names] + [{"item": items[(k, tier)]['name'], "chance": chance} for k in pieces]
            t = t[:lm.start()] + '\n' + lm.group(1) + json.dumps(e, ensure_ascii=False) + (',' if line.rstrip().endswith(',') else '') + t[lm.end():]
    json.loads(t)
    open(p, 'w').write(t)


if __name__ == '__main__':
    g = write_gear()
    items = write_items(g)
    write_shop(items)
    write_drops(items)
    print('bases', len(BASES), 'items', len(items), 'fixed', sum(1 for (k, t) in items if t <= 2))
