"""炎華之地 P5：東大陸的物品與裝備（EAST_CONTENT_PLAN 第 4 節）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p5_items.py（可以重跑：先拿掉上一次寫進去的再寫）
- 特產、食物、消耗品、材料、工具、情報 28 件：只在炎華南域的商店賣（items 的 regions）
- 底材 3 種（朴刀、步人甲、褙子）：gear.json 的 bases、equipment.json 的武器與防具類型，加上每種材料的制式品（只在炎華之地賣）
- 政治線終章的獨特裝備 3 件（宣德寶劍、公議之印、憲章玉璽）：由 east_p4c.py 的終章給
"""

import json
import re

from east_story_io import write_items

SOUTH = ['yanhua_south']
EAST = ['yanhua_south', 'yanhua_north']


def it(name, category, price, tags, desc, **kw):
    d = {'name': name, 'category': category, 'price_cc': price, 'tags': tags}
    d.update(kw)
    d['regions'] = kw.get('regions', SOUTH)
    d['desc'] = desc
    return d


ITEMS = [
    # ---------- 特產（送禮、交易） ----------
    it('天青瓷盞', 'gear', 120, ['jeweler', 'general'], '萍江府的窯燒出的天青釉茶盞，雨過天青的顏色，敲起來聲音清脆。炎華的特產，送禮最體面。'),
    it('雲錦', 'gear', 180, ['tailor'], '龍安府織造局的雲錦，金線織出層層祥雲，一匹要織上半年。送禮的上品。', min_location='city'),
    it('萍江繡帕', 'gear', 25, ['tailor', 'general'], '萍江繡娘的手帕，一面繡著運河的柳，一面繡著虹橋。'),
    it('龍團茶餅', 'food', 40, ['general', 'tavern'], '壓成龍紋圓餅的團茶，碾成末、點成一碗白沫的好茶。喝了心神舒坦，也很適合送人。', use={'condition': 'relaxed'}),
    it('瑔州香料', 'material', 30, ['general'], '瑔州港蕃坊來的胡椒、丁香與沉香，一小包就香滿整間廚房。'),
    it('松煙墨錠', 'gear', 35, ['general'], '松木燒出的煙製成的墨錠，墨色黑亮、帶著松香。讀書人最愛收到的禮物。'),
    it('樺樹皮畫', 'gear', 45, ['general'], '青丘屯的手藝：剝下樺樹皮，拼貼成山林與狐狸的畫。'),
    it('老山參', 'consumable', 300, ['general', 'temple'], '青丘屯山裡挖的老山參，鬚根完整。嚼一段回復 2d4+2 生命；城裡的人拿來送長輩。', use={'heal': '2d4+2'}),
    it('貂皮', 'material', 60, ['tailor'], '青丘屯獵戶打的貂皮，毛色油亮。做成圍領，冬天再冷也不怕。'),
    # ---------- 食物 ----------
    it('茶點', 'food', 4, ['tavern', 'general'], '一碟桂花糕與杏仁酥，配一壺清茶。', use={'condition': 'fed_light'}),
    it('黏豆包', 'food', 3, ['general', 'tavern'], '青丘屯的黏豆包：黃米麵裹著紅豆餡，蒸得軟糯，凍起來能放一整個冬天。', use={'condition': 'fed_light'}),
    it('羊肉湯餅', 'food', 10, ['tavern'], '大碗的羊肉湯，泡著手撕的麵餅，撒一把芫荽。', use={'condition': 'fed_well'}),
    it('蟹黃包', 'food', 12, ['tavern'], '萍江府的蟹黃湯包，咬破皮先吸一口湯。', use={'condition': 'fed_well'}),
    it('酸菜白肉鍋', 'food', 14, ['tavern'], '青丘屯的冬天吃這個：酸菜、五花白肉與血腸燉一大鍋，熱氣騰騰。', use={'condition': 'fed_well'}),
    it('燒鵝', 'food', 18, ['tavern'], '御街夜市的招牌燒鵝，皮脆得會響，肉嫩得滴油。', use={'condition': 'fed_well'}),
    it('梅子酒', 'food', 6, ['tavern'], '青梅泡的酒，酸甜好入口，後勁不小。', use={'condition': 'cheered'}),
    it('燒刀子', 'food', 8, ['tavern', 'general'], '青丘屯的烈酒，入喉像吞了一把刀，胡三娘一天要喝一壺。', use={'condition': 'cheered'}),
    # ---------- 消耗品 ----------
    it('霹靂火球', 'consumable', 800, ['general'], '瑔州港火藥坊做的霹靂火球：點燃引信丟出去，所有敵人 3d6 火焰傷害；靈巧豁免 DC 13 失敗時燃燒 2 回合（成功傷害減半）。',
       min_location='city', use={'damage': {'dice': '3d6', 'type': 'fire'}, 'apply': {'status': 'burning', 'turns': 2, 'save': 'dex', 'dc': 13}, 'area': 'all', 'combat_only': True}),
    it('煙火筒', 'consumable', 200, ['general'], '阿炮做的煙火筒：對著敵人放，所有敵人 1d4 火焰傷害；靈巧豁免 DC 12 失敗時目盲 1 回合（成功傷害減半）。',
       use={'damage': {'dice': '1d4', 'type': 'fire'}, 'apply': {'status': 'blinded', 'turns': 1, 'save': 'dex', 'dc': 12}, 'area': 'all', 'combat_only': True}),
    it('金瘡藥', 'consumable', 70, ['general', 'temple'], '刀客隨身帶的金瘡藥，灑在傷口上就止血。止血，並回復 1d6+1 生命。', use={'cleanse': ['bleeding'], 'heal': '1d6+1'}),
    it('清涼散', 'consumable', 90, ['general', 'temple'], '薄荷與冰片磨成的藥粉，專治火藥坊的燒傷。解除燃燒，並回復 1d4 生命。', use={'cleanse': ['burning'], 'heal': '1d4'}),
    it('安神香', 'consumable', 150, ['temple', 'general'], '仙堂與尚寢局都用的安神香，點起來心就靜了。解除恐懼、混亂與被震懾。', use={'cleanse': ['frightened', 'confused', 'overawed']}),
    # ---------- 材料 ----------
    it('天青釉', 'material', 300, ['jeweler'], '千窯谷的古方調出的天青釉料，裝在小瓷罐裡。珠寶匠拿來燒高階飾品的釉面。', min_location='city'),
    # ---------- 工具 ----------
    it('指南魚', 'gear', 70, ['general'], '薄鐵片剪成的魚，磁化之後浮在水碗裡，魚頭永遠指南。比指南針便宜，大燁的船家都帶著。', tool={'kind': 'travel', 'bonus': 2}),
    it('狐火燈', 'gear', 100, ['general'], '青丘屯的燈：燈裡養著一團狐火，不燒油、不怕風，比油燈亮，比照明石便宜。', tool={'kind': 'light', 'bonus': 2}),
    # ---------- 情報 ----------
    it('科舉的考卷抄本', 'info', 40, ['info'], '貢院流出來的考卷抄本，上面的暗記和某件委託的內幕有關。', intel={'kind': 'lead'}),
    it('陵墓的盜洞圖', 'info', 70, ['info'], '盜墓賊畫的永昭陵盜洞圖，標著中層一處還沒被挖空的陪葬坑。', intel={'kind': 'point', 'event': 'chest', 'location': 'yongzhao_tomb', 'layer': 'middle', 'days': 10}),
    it('胡記的帳冊抄本', 'info', 50, ['info'], '胡記商號帳房偷抄出來的幾頁帳，記著幾筆不該出現的貨。', intel={'kind': 'lead'}),
]

# ---------- 政治線終章的獨特裝備（Lv.15：第四級材料） ----------
UNIQUES = [
    {'name': '宣德寶劍', 'category': 'equipment', 'price_cc': 6000, 'tags': ['unique'],
     'desc': '女帝親政那天，在燒焦的宣德樓上親手賜下的劍。劍身刻著「宣德」二字，拔出來的時候，殿前的甲士都會不自覺地站直。',
     'gear': {'base': 'longsword', 'material': 'adamantine', 'rarity': 'legendary', 'attrs': {'str': 1}, 'enchants': {'mods': {'hit': 3, 'damage': 3}},
              'unique': {'check': {'kinds': ['intimidate', 'negotiation']}, 'bonus': 2}}},
    {'name': '公議之印', 'category': 'equipment', 'price_cc': 5000, 'tags': ['unique'],
     'desc': '公議會開議那天刻的第一枚印：一面是萬民書上的指印，一面是「公議」二字。陸青禾說，戴著它的人說話，大家都會聽完。',
     'gear': {'base': 'amulet_ward', 'material': 'mithril_jewel', 'rarity': 'legendary', 'attrs': {'cha': 1}, 'enchants': {'mods': {'save': 3}, 'resist': {'psychic': -0.75}},
              'unique': {'check': {'attrs': ['cha']}, 'bonus': 2}}},
    {'name': '憲章玉璽', 'category': 'equipment', 'price_cc': 5000, 'tags': ['unique'],
     'desc': '立憲之後仿傳國玉璽刻的小璽，五席各執一角的紋樣拼成一條龍。蓋在誰的文書上，誰就得照規矩來。',
     'gear': {'base': 'focus', 'material': 'mithril_jewel', 'rarity': 'legendary', 'attrs': {'int': 1}, 'enchants': {'mods': {'save': 3}, 'offense': {'arcane': 0.75}},
              'unique': {'check': {'kinds': ['negotiation', 'bargain']}, 'bonus': 2}}},
]

# ---------- 底材 ----------
BASES = {
    'podao': {'slot': 'main_hand', 'name': '朴刀', 'kind': 'metal', 'weapon': 'podao', 'two_handed': True, 'price': 360, 'stats': {'crit': 1},
              'scale': {'damage': 'full', 'hit': 'half'}, 'desc': '長柄短刃的雙手刀，大燁的步卒與刀客最常用；比雙手劍輕，砍得也快。'},
    'bushen_armor': {'slot': 'body', 'name': '步人甲', 'kind': 'metal', 'armor': 'bushen', 'price': 4000, 'scale': {'dr': 'half'},
                     'desc': '大燁步卒的重甲：上千片甲葉用皮繩編在一起，從肩頭罩到小腿。比板甲便宜，卻更笨重。'},
    'beizi': {'slot': 'body', 'name': '褙子', 'kind': 'cloth', 'armor': 'cloth', 'price': 60, 'scale': {'save': 'up'}, 'outfit': 'regular',
              'desc': '大燁的長衫：直領對襟、兩側開衩，罩在衣裙外面，男女都穿。'},
}
WEAPONS = {'podao': {'name': '朴刀', 'dice': '1d10', 'type': 'slashing', 'attr': 'str', 'threat': 0.05}}
ARMORS = {'bushen': {'name': '步人甲', 'evade': -4, 'dr': 4, 'resist': {'slashing': -0.25, 'piercing': -0.25}, 'threat': 0.25}}


def flat(obj):
    """一行的 JSON，照 gear.json／equipment.json 的排版：{ "k": v, ... }"""
    return '{ ' + json.dumps(obj, ensure_ascii=False)[1:-1] + ' }'


def insert_lines(path, after_key, entries, indent='    '):
    """把 entries（key → 物件）寫成一行一個，接在 "after_key": 那一行之後；同 key 的先拿掉"""
    lines = open(path, encoding='utf-8').read().split('\n')
    lines = [l for l in lines if not any(l.startswith(f'{indent}"{k}":') for k in entries)]
    at = next(i for i, l in enumerate(lines) if l.startswith(f'{indent}"{after_key}":'))
    new = [f'{indent}"{k}": {flat(v)},' for k, v in entries.items()]
    if not lines[at].rstrip().endswith(','):
        lines[at] = lines[at].rstrip() + ','
        new[-1] = new[-1].rstrip(',')
    lines[at + 1:at + 1] = new
    out = '\n'.join(lines)
    json.loads(out)
    open(path, 'w', encoding='utf-8').write(out)


GEAR = json.load(open('data/rules/gear.json', encoding='utf-8'))
LOC_BY_TIER = {3: 'city', 4: 'capital'}
SHOP = {'metal': 'smith', 'cloth': 'tailor'}


def catalog(base_id):
    """制式品：這種底材 × 同類型的每一種材料（照 high_gear31.py 的 catalog_item）"""
    b = BASES[base_id]
    out = []
    for mid, m in sorted(((k, v) for k, v in GEAR['materials'].items() if v['kind'] == b['kind']), key=lambda x: (x[1]['tier'], x[1].get('series') == 'pleasure')):
        d = {'name': m['name'] + b['name'], 'category': 'equipment', 'price_cc': round(b['price'] * m['price']),
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


def write_catalog(rows):
    """制式品接在最後一件制式裝備的後面；上一次寫進去的先拿掉"""
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
    insert_lines('data/rules/gear.json', 'halberd', BASES)
    insert_lines('data/rules/equipment.json', 'halberd', WEAPONS)
    insert_lines('data/rules/equipment.json', 'scale', ARMORS)
    write_catalog([r for b in BASES for r in catalog(b)])
    write_items(ITEMS + UNIQUES)
