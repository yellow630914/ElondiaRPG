# 成人向服裝擴充與服裝的防禦（docs/ITEMS.md 第 2 節、docs/LEWD_STATS.md 第 24、25 節）：
#   1. gear.json   42 種新的成人向服裝底材（outfit: adult）
#   2. items.json  每種底材三件店貨（第 1～3 級材料；名稱和遊戲的 gearName 一樣），標 adult_shop；原本的成人向服裝也改成只在成人用品店賣
#                  （裁縫店、珠寶店不再賣；獨特的、沒有商店標籤的照舊）
#   3. gear.json   布料服裝的防禦（成長是材料的 bonus）：
#                  - 上身（布衣）：一般＝迴避 ⅓ 進位、減傷 ⅓；厚重＝迴避 ⅓、減傷 ⅓ 進位；暴露（曝露 2 以上）＝迴避 ½ 進位、沒有減傷。都保留豁免 ½ 進位
#                  - 頭部：帽子、頭巾、面紗之外的髮飾＝迴避 ¼；帽子、兜帽、頭巾＝減傷 ¼
#                  - 下身（布）：短的、露的＝迴避 ¼；其他＝減傷 ¼
#                  - 手腕（布、皮手套）：減傷 ¼
#                  鞋子、腿部飾品本來就有迴避，內衣褲、首飾、腰帶不動；皮甲類、比基尼鎧甲、武僧袍、拘束具不動。
# 可以重跑。要排在建立服裝底材的腳本（lust_s9.py、east_p5_items.py、east_p6_gear.py 等）與 toys46.py 之後。
import json
import re

# ---------------- 1. 底材 ----------------
# 欄位、名稱、材料類型、價格、曝露、描述；上身的布衣用 armor cloth、皮的用 armor leather（數值照第 3 部分）


def ob(slot, name, kind, price, exposure, desc, **extra):
    b = {"slot": slot, "name": name, "kind": kind}
    if slot == "body":
        b["armor"] = "leather" if kind == "leather" else "cloth"
    b["price"] = price
    b["scale"] = {}
    b["exposure"] = exposure
    b.update(extra)
    b["outfit"] = "adult"
    b["adult"] = True
    b["desc"] = desc
    return b


BASES = {
    # 上身
    "latex_suit": ob("body", "乳膠緊身衣", "leather", 400, 1, "從脖子包到腳踝的黑亮乳膠衣，緊得每一道曲線都看得清清楚楚。"),
    "crotchless_bodysuit": ob("body", "開襠緊身衣", "leather", 300, 3, "包得緊緊的皮衣，偏偏胯下與胸口開了洞。"),
    "fishnet_bodysuit": ob("body", "網眼連身衣", "cloth", 80, 3, "大網眼織成的連身衣，穿了和沒穿差不多。"),
    "slave_rags": ob("body", "奴隸破布衣", "cloth", 20, 2, "破得到處是洞的粗布衣，勉強遮住要緊的地方。"),
    "harlot_dress": ob("body", "娼婦紅裙", "cloth", 120, 2, "大紅的低胸短裙，站在街口一眼就知道是做什麼的。"),
    "sheer_robe": ob("body", "透視神官袍", "cloth", 150, 3, "看起來莊重的神官袍，料子卻薄得透光。"),
    "backless_gown": ob("body", "露背晚禮服", "cloth", 300, 1, "後背一路開到腰下的晚禮服，正面端莊，轉身就讓人移不開眼。"),
    "high_slit_qipao": ob("body", "高衩旗袍", "cloth", 180, 2, "兩側開衩開到腰際的旗袍，走一步就露出整條腿。"),
    "lewd_miko": ob("body", "改造巫女服", "cloth", 200, 2, "袖子與衣身分開、胸口大開的巫女服，緋袴短到大腿根。"),
    "lewd_nurse": ob("body", "改造護士服", "cloth", 180, 2, "短得遮不住臀部的護士服，扣子只扣到胸下。"),
    "lewd_sailor": ob("body", "改造水手服", "cloth", 150, 2, "上衣短到露出肚臍、裙子短到一彎腰就走光的水手服。"),
    "latex_habit": ob("body", "乳膠修女服", "leather", 400, 1, "乳膠做的修女服，緊緊貼著身體，比不穿還要煽情。"),
    "succubus_outfit": ob("body", "魅魔裝", "leather", 500, 3, "幾條皮帶與一點點布料組成的衣服，模仿魅魔的打扮。"),
    "bandage_wrap": ob("body", "繃帶裝", "cloth", 40, 3, "只用繃帶一圈圈纏在身上，隨時會鬆開。"),
    "naked_apron": ob("body", "裸體圍裙", "cloth", 60, 3, "裡面什麼都沒穿，只繫著一條荷葉邊圍裙。"),
    "cow_bikini": ob("body", "乳牛比基尼", "cloth", 80, 3, "黑白花紋的小比基尼，配著牛鈴最合適。"),
    # 下身
    "slit_skirt": ob("legs", "開衩長裙", "cloth", 60, 1, "看起來端莊的長裙，側邊的開衩一路開到腰。"),
    "sheer_skirt": ob("legs", "透視紗裙", "cloth", 50, 2, "薄紗做的裙子，光線一照就看得到裡面。"),
    "hot_pants": ob("legs", "皮熱褲", "leather", 80, 1, "短得露出半截臀部的皮熱褲。"),
    "latex_leggings": ob("legs", "乳膠緊身褲", "leather", 120, 0, "緊緊包住雙腿的乳膠褲，亮得像塗了油。"),
    "loin_veil": ob("legs", "舞孃腰巾", "cloth", 60, 2, "前後各垂一片薄紗的腰巾，跳舞時什麼都藏不住。"),
    # 鞋子
    "thigh_boots": ob("feet", "過膝長靴", "leather", 120, 0, "細跟的過膝皮靴，一路包到大腿。"),
    "strappy_heels": ob("feet", "綁帶細跟涼鞋", "cloth", 60, 0, "細帶子一路綁到小腿的高跟涼鞋。"),
    "bell_slippers": ob("feet", "踝鈴舞鞋", "cloth", 50, 0, "鞋口掛著小鈴鐺的軟舞鞋，走一步響一聲。"),
    "pony_heels": ob("feet", "蹄形高跟鞋", "leather", 150, 0, "沒有鞋跟、做成馬蹄形狀的高跟鞋，只能用腳尖站。"),
    # 頭部
    "fox_ears": ob("head", "狐耳髮箍", "cloth", 20, 0, "毛茸茸的狐狸耳朵髮箍。"),
    "cow_horns": ob("head", "牛角頭飾", "cloth", 20, 0, "一對小牛角加上牛耳的頭飾。"),
    "harem_veil": ob("head", "薄紗面紗", "cloth", 40, 0, "遮住口鼻的薄紗面紗，只露出一雙眼睛。"),
    # 手腕
    "lace_mitts": ob("wrists", "蕾絲短手套", "cloth", 30, 0, "露出指尖的蕾絲短手套。"),
    "gold_armlet": ob("wrists", "臂釧", "jewel", 120, 0, "纏在上臂的細環，配著小鈴鐺。"),
    # 內衣
    "sheer_bra": ob("underwear_top", "透明胸罩", "cloth", 40, 3, "薄紗做的胸罩，乳頭的形狀一清二楚。"),
    "strap_bra": ob("underwear_top", "綁帶胸罩", "cloth", 40, 2, "只有幾條細帶子交叉繞過胸前的胸罩。"),
    "bell_bra": ob("underwear_top", "乳鈴胸罩", "cloth", 60, 2, "罩杯尖端各掛一顆小鈴鐺，一動就響。"),
    # 內褲
    "sheer_panties": ob("underwear_bottom", "透明內褲", "cloth", 30, 3, "薄得透明的內褲。"),
    "pearl_thong": ob("underwear_bottom", "珍珠丁字褲", "cloth", 80, 3, "股間是一串珍珠的丁字褲，走一步就磨一下。"),
    "string_panties": ob("underwear_bottom", "細繩內褲", "cloth", 30, 3, "幾乎只剩兩條細繩的內褲。"),
    "cutout_panties": ob("underwear_bottom", "鏤空內褲", "cloth", 40, 3, "前後都挖了洞的蕾絲內褲。"),
    # 腿部飾品
    "crotchless_tights": ob("leg_accessory", "開襠褲襪", "cloth", 30, 2, "胯下開了口的褲襪。"),
    "jewel_thigh_chain": ob("leg_accessory", "大腿鍊", "jewel", 120, 0, "繞在大腿上的細鍊，垂著幾顆小寶石。"),
    # 首飾
    "cowbell_collar": ob("accessory", "牛鈴項圈", "jewel", 80, 0, "掛著一顆大牛鈴的項圈。"),
    "heart_lock_choker": ob("accessory", "心鎖頸鍊", "jewel", 100, 0, "墜著一個心形小鎖頭的頸鍊。"),
    # 腰帶
    "coin_belt": ob("belt", "舞孃錢幣腰帶", "jewel", 100, 0, "綴滿小金幣的腰帶，扭腰時嘩啦啦地響。"),
}
ANCHOR_BASE = r'\n    "body_chain": \{.*'

# 新底材（上身以外）的基本數值：照同欄位的成人向服裝
SLOT_SCALE = {
    "legs": {"cloth": {"save": "half"}, "leather": {"evade": "half"}},
    "feet": {"cloth": {"evade": "half"}, "leather": {"evade": "up"}},
    "head": {"cloth": {"save": "up"}},
    "wrists": {"cloth": {"crit": "third", "save": "half"}, "jewel": {"save": "third_up", "crit": "quarter"}},
    "underwear_top": {"cloth": {"save": "third"}},
    "underwear_bottom": {"cloth": {"save": "third"}},
    "leg_accessory": {"cloth": {"evade": "third"}, "jewel": {"save": "third_up"}},
    "accessory": {"jewel": {"save": "third_up"}},
    "belt": {"jewel": {"save": "half"}},
}
UNDER_SCALE = {"strap_bra": {"evade": "third"}, "bell_bra": {"crit": "third_up"}, "pearl_thong": {"hit": "third"}, "string_panties": {"evade": "third"}}

# ---------------- 3. 布料服裝的防禦 ----------------
HEAVY = {"long_coat", "gown", "nun_habit", "butler_suit", "beizi", "gothic_lolita"}
HEAD_COVER = {"hood", "wide_hat", "nun_veil", "red_veil"}
LEGS_SHORT = {"short_skirt", "shorts", "micro_skirt"}
BODY_CLASS = {
    "normal": {"save": "up", "evade": "third_up", "dr": "third"},
    "heavy": {"save": "up", "evade": "third", "dr": "third_up"},
    "exposed": {"save": "up", "evade": "up"},
}


def exposure_of(b, rules):
    if 'exposure' in b:
        return b['exposure']
    return rules['outfit'].get(b.get('outfit'), {}).get('exposure', 0) if b.get('outfit') else 0


def defense_scale(id_, b, rules):
    """這個底材新的 scale（不動的回傳 None）"""
    if b.get('restraint') or b.get('weapon') or b.get('exclusive'):
        return None
    slot, kind = b['slot'], b['kind']
    cur = dict(b.get('scale') or {})
    if slot == 'body' and b.get('armor') == 'cloth':
        if exposure_of(b, rules) >= 2:
            return dict(BODY_CLASS['exposed'])
        return dict(BODY_CLASS['heavy' if id_ in HEAVY else 'normal'])
    if kind not in ('cloth', 'leather', 'jewel') or not (b.get('outfit') or kind == 'cloth'):
        return None
    if slot == 'head' and kind in ('cloth', 'jewel'):
        cur.pop('dr', None) if cur.get('dr') == 'quarter' else None
        cur.pop('evade', None) if cur.get('evade') == 'quarter' else None
        cur['dr' if id_ in HEAD_COVER else 'evade'] = 'quarter'
        return cur
    if slot == 'legs' and kind == 'cloth':
        cur.pop('dr', None) if cur.get('dr') == 'quarter' else None
        cur.pop('evade', None) if cur.get('evade') == 'quarter' else None
        cur['evade' if (id_ in LEGS_SHORT or exposure_of(b, rules) >= 1) else 'dr'] = 'quarter'
        return cur
    if slot == 'wrists' and kind in ('cloth', 'leather') and cur.get('save') == 'half':
        cur['dr'] = 'quarter'
        return cur
    return None


# ---------------- 2. 店貨 ----------------
TIERS = {"cloth": ["linen", "silk", "moonsilk"], "leather": ["leather", "hard_leather", "beast_hide"], "jewel": ["copper", "silver", "gold"]}


def item_name(b, mat, mats):
    """和遊戲的 gearName 一樣（gear.ts）"""
    m = mats[mat]
    n = b['name']
    if m['kind'] == 'leather' and n.startswith('皮'):
        return n if m['tier'] == 1 else m['name'] + (n[1:] if m['name'].endswith('皮') else n)
    return m['name'] + n


def write_gear():
    p = 'data/rules/gear.json'
    t = open(p).read()
    lewd = json.load(open('data/rules/lewd.json'))['gear']
    for k in BASES:
        t = re.sub(r'\n    "' + k + r'": \{.*', '', t)
    bases = {}
    for k, b in BASES.items():
        b = dict(b)
        if b['slot'] != 'body':
            b['scale'] = dict(UNDER_SCALE.get(k) or SLOT_SCALE[b['slot']][b['kind']])
        elif b['kind'] == 'leather':
            # 皮的上身照皮緊身衣（皮甲＋迴避 ½）
            b['scale'] = {"evade": "half"}
        bases[k] = b
    m = re.search(ANCHOR_BASE, t)
    assert m and m.group(0).endswith(',')
    t = t[:m.end()] + ''.join('\n    "' + k + '": ' + json.dumps(v, ensure_ascii=False) + ',' for k, v in bases.items()) + t[m.end():]
    # 防禦：每一行只改 scale
    d = json.loads(t)
    changed = 0
    for id_, b in d['bases'].items():
        new = defense_scale(id_, b, lewd)
        if new is None or new == b.get('scale'):
            continue
        lm = re.search(r'\n    "' + id_ + r'": +\{.*', t)
        assert lm, id_
        line = lm.group(0)
        nl, n = re.subn(r'"scale": \{[^}]*\}', '"scale": ' + json.dumps(new, ensure_ascii=False), line, count=1)
        assert n == 1, id_
        t = t[:lm.start()] + nl + t[lm.end():]
        changed += 1
    d = json.loads(t)
    for k in BASES:
        assert d['bases'][k]['outfit'] == 'adult'
    open(p, 'w').write(t)
    return changed


def write_items():
    p = 'data/rules/items.json'
    t = open(p).read()
    g = json.load(open('data/rules/gear.json'))
    mats = g['materials']
    new = []
    for k, b in BASES.items():
        for mat in TIERS[b['kind']]:
            it = {"name": item_name(b, mat, mats), "category": "equipment", "price_cc": b['price'] * mats[mat]['price'], "tags": ["adult_shop"], "adult": True}
            if mats[mat]['tier'] >= 3:
                it["min_location"] = "city"
            if b['exposure'] >= 2:
                it["charm_min"] = 3
            it["gear"] = {"base": k, "material": mat}
            new.append(it)
    for i in new:
        t = re.sub(r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*', '', t)
    m = re.search(r'\n    \{ ?"name": "金製身體鍊".*', t)
    assert m and m.group(0).endswith(',')
    t = t[:m.end()] + ''.join('\n    ' + json.dumps(i, ensure_ascii=False) + ',' for i in new) + t[m.end():]
    # 原本的成人向服裝：裁縫店、珠寶店的改成只在成人用品店賣
    bases = g['bases']
    retag = 0

    def fix(mm):
        nonlocal retag
        line = mm.group(0)
        it = json.loads(line.strip().rstrip(','))
        base = (it.get('gear') or {}).get('base')
        if not base or bases.get(base, {}).get('outfit') != 'adult' or 'unique' in it['tags']:
            return line
        tags = [x for x in it['tags'] if x not in ('tailor', 'jeweler')]
        if len(tags) == len(it['tags']):
            return line
        if 'adult_shop' not in tags:
            tags.append('adult_shop')
        it['tags'] = tags
        retag += 1
        return '\n    ' + json.dumps(it, ensure_ascii=False) + (',' if line.rstrip().endswith(',') else '')
    t = re.sub(r'\n    \{ ?"name": .*', fix, t)
    d = json.loads(t)
    names = [i['name'] for i in d['items']]
    assert len(names) == len(set(names)), [n for n in names if names.count(n) > 1][:5]
    open(p, 'w').write(t)
    return len(new), retag


if __name__ == '__main__':
    changed = write_gear()
    n, retag = write_items()
    print('bases', len(BASES), 'items', n, 'retag', retag, 'defense changed', changed)
