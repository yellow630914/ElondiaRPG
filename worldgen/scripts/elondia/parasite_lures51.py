# 寄生物的取得（docs/ADULT_EVENTS.md 第 6 節）：
#   1. travel_events.json  三種寄生物的地下城事件，各加一件陽剛體型的版本（dg_<原本的 id>_m，pc_body: masc）：
#      寶箱裡的黑色內衣 → 寶箱裡的黑色蕾絲套、魅魔之箱、寄生植物的種子、夢魔的夜訪（男性主角遇到的是魅魔）。
#      結構、檢定、效果、旗標照抄原本的事件（從 travel_events.json 讀，原本的改了重跑就跟著改），只換文字。
#   2. items.json          黑市賣的「寄生物的引子」三件（use.lure；存檔規則「黑市賣寄生物的引子」）：
#      在地下城裡用了立刻遇到那件事（陽剛體型的主角遇到 _m 的版本）。
# 原本的事件由 dungeon_events24.py 產生，但那支已經不能重跑（後來的腳本改過其中幾件），所以另外寫在這裡。
# 可以重跑：先拿掉上一次寫進去的再寫。要排在 dungeon_events24.py、parasites25.py 之後。
import copy
import json
import re

BODY_M = ['masc']
# 有陽剛版本的發作：原本的只給這些體型（地下城事件原本就寫了體型）
BODY_OTHERS = {'pe_mark_other_half': ['fem', 'andro']}

# 陽剛體型的版本：原本的 id → 新的標題、開頭、親密場景、各選項的文字（(選項的順序, success|fail) → 文字；label 可以換）
MALE = {
    'dg_cursed_lingerie': {
        'title': '寶箱裡的黑色蕾絲套',
        'text': '寶箱裡只有一條黑色蕾絲的丁字褲，前面縫著一只細緻的蕾絲套。你剛把它拿起來，它就自己動了——像蛇一樣纏上你的手臂，往你的褲子裡鑽。',
        'scene': '受詛咒的蕾絲套自己穿到了主角身上，緊緊裹住主角的肉棒，一圈一圈地收緊、吮動，像有一張看不見的嘴。',
        'options': {
            (0, 'success'): '你在它鑽進褲子之前把它甩了出去。它在地上扭了幾下，不動了。你把它收進了袋子裡——拿去賣應該值不少錢。',
            (0, 'fail'): '慢了一步，它已經鑽進褲子裡，裹住你的肉棒越收越緊，一下一下地吮動。等它吃飽了，才自己鬆開，從褲腳溜出去，像條黑蛇一樣鑽進了石縫——它還在這座地下城的某個地方等著下一個人。',
            (1, 'fail'): '你研究得太入迷，沒注意到它已經爬上了你的腿、鑽進褲子底下。它裹著你的肉棒折騰了好一陣子，吃飽了才鬆開，滑到地上溜進黑暗裡——下次打開寶箱的時候，最好小心一點。',
            (2, 'success'): '你讓它穿上了身。蕾絲套緊緊裹住你的肉棒，收得剛剛好，動得也剛剛好——你在寶箱邊坐了很久，想把它脫下來的時候，才發現它已經脫不下來了。',
        },
    },
    'dg_succubus_box': {
        'text': '寶箱裡飄出一陣粉紫色的煙，煙裡坐著一個只穿著薄紗的魅魔。她伸了個懶腰，上上下下打量了你一遍，對你眨眨眼：「被關了三百年，第一個打開箱子的人……還是個好看的男人呢。要不要做個交易？一個吻，換箱子裡的東西。」',
        'scene': '主角接受了魅魔的交易；那個「吻」從嘴唇開始，然後是脖子、胸膛、一路往下，魅魔用三百年的飢渴品嚐主角。',
        'options': {
            (1, 'success'): '那個吻很長很長，長到你忘了自己在哪裡。她心滿意足地離開時，箱子裡的寶石全都留給了你——還有你小腹上一個桃紅色的、發燙的紋樣。「這是契約喔，」她的聲音從很遠的地方傳來，「別弄丟了。」',
        },
    },
    'dg_seed_plant': {
        'text': '你蹲下來採藥時，一株長得像百合的植物彎下了花莖，纏住你的腰，花心貼上你的小腹，把一顆溫熱的種子推進了你的身體裡。',
        'scene': '寄生植物的花莖纏住主角的腰，把種子推進主角的身體深處，在主角體內攪動、確認種子著床，主角在花叢裡顫抖著承受。',
        'options': {
            (2, 'success'): '花莖在你身體裡慢慢地攪動，直到確認種子安穩地著床才退出去。你躺在花叢裡喘了很久，小腹裡暖暖的——它會在你身體裡長大。',
        },
    },
    # 寄生物的發作（parasites25.py 產生）：魅魔的契紋男性主角也拿得到，幻影撫摸的地方換成肉棒；原本的改成只給陰柔、中性體型（BODY_OTHERS）
    'pe_mark_other_half': {
        'scene': '薇絲佩菈的幻影抱住主角，手指沒入發光的紋樣，另一隻手握住主角的肉棒慢慢撫弄；主角在幻影的懷裡一次又一次地失神。',
    },
    'dg_incubus_visit': {
        'text': '你在安全房裡睡著了，又好像沒有。有人坐在你的床邊，長髮垂到你的胸口，冰涼的手指撫過你的臉頰，慢慢往下。「別出聲，」一個很好聽的女聲說，「這只是一個夢。」',
        'scene': '夢魔在主角半夢半醒時潛入，在主角身上一點一點地脫去衣物、親吻、愛撫，最後跨坐上來與主角結合；主角分不清是夢還是現實。',
        'options': {
            (1, 'success'): '你在夢裡抓住她的手腕：「妳是誰？」她愣了一下，笑著消失了，枕邊留下了一枚古錢。',
            (1, 'fail'): '你抓住了她的手腕——然後被她順勢壓在了床上。',
            (2, 'success'): '你沒有拒絕。那是你這輩子最真實的一個夢。早上醒來時，你身上還留著她的香味，小腹上還多了一個桃紅色的紋樣——夢裡的聲音說，那是她的契約。',
        },
        'labels': {1: '在夢裡反過來質問她', 2: '讓她留下來'},
    },
}

# 黑市的引子：在地下城裡用了立刻遇到那件事（清單裡第一件體型相符的）；價錢照寄生物的分量（契紋 > 魔導衣 > 種子）
ITEMS = [
    {"name": "受詛咒的黑色內衣", "category": "consumable", "price_cc": 1200, "tags": [], "adult": True, "black_market": True, "content_tags": ["pc_unwilling"], "trade_category": "magic",
     "desc": "裝在封了咒的木盒裡的黑色蕾絲，隔著盒子都感覺得到它在動。在地下城裡打開盒子，它就會找上你——和寶箱裡那件一模一樣。",
     "use": {"lure": ["dg_cursed_lingerie", "dg_cursed_lingerie_m"]}},
    {"name": "魅魔的封印箱", "category": "consumable", "price_cc": 1500, "tags": [], "adult": True, "black_market": True, "trade_category": "magic",
     "desc": "貼滿封條的小箱子，縫隙裡飄出淡淡的粉紫色煙。賣的人說，裡面關著一個等著做交易的魅魔，只有在地下城那種地方才放得出來。",
     "use": {"lure": ["dg_succubus_box", "dg_succubus_box_m"]}},
    {"name": "寄生植物的花苞", "category": "consumable", "price_cc": 400, "tags": [], "adult": True, "black_market": True, "content_tags": ["pc_unwilling"], "trade_category": "herb",
     "desc": "長得像百合的花苞，泡在藥水裡還在慢慢地開合。在地下城的土裡種下，它會立刻長成一株找人寄生的花。",
     "use": {"lure": ["dg_seed_plant", "dg_seed_plant_m"]}},
]


# 渴求的魔導衣的陽剛版本：裹住肉棒的蕾絲套（parasites.json 的 hungry_lingerie.masc；陽剛體型的主角附著的是這件、馴服後換成這件）
GEAR = [
    {"name": "渴求的魔導套", "category": "equipment", "price_cc": 1500, "tags": ["unique"], "adult": True,
     "desc": "黑色蕾絲的丁字褲，前面是一只貼合肉棒的蕾絲套，蕾絲底下織著細細的魔導迴路。它是活的、會餓——穿上之後就脫不下來，時不時收緊吮動，只有解咒或馴服才能讓它鬆手。",
     "gear": {"base": "thong", "material": "moonsilk", "rarity": "rare", "attrs": {"cha": 1}}},
    {"name": "馴服的魔導套", "category": "equipment", "price_cc": 9000, "tags": ["unique"], "adult": True,
     "desc": "認了主人的魔導套。蕾絲照著主人的心意收緊、放鬆，替主人擋下惡意的咒語，也讓主人的一舉一動都帶著讓人移不開眼的魅力。",
     "gear": None},
]
MASC = {"hungry_lingerie": {"item": "渴求的魔導套", "slot": "underwear_bottom", "tamed_item": "馴服的魔導套"}}


def write_parasites():
    p = 'data/rules/parasites.json'
    d = json.load(open(p))
    ps = d['parasites']
    for pid, m in MASC.items():
        ps[pid]['masc'] = m
    open(p, 'w').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')


# 用引子引來時的文字（lure）：原本的事件直接寫在 travel_events.json（2026-11-14），陽剛版本寫在這裡
LURE_M = {
    'dg_cursed_lingerie': {"title": "受詛咒的黑色蕾絲套", "text": "你把黑市買來的那條黑色蕾絲丁字褲拿出來，前面縫著一只細緻的蕾絲套。才剛展開，它就自己動了——像蛇一樣纏上你的手臂，往你的褲子裡鑽。", "replace": [["在寶箱邊坐了很久", "在原地坐了很久"], ["下次打開寶箱的時候，最好小心一點", "下次在黑市買東西的時候，最好想清楚一點"]]},
    'dg_succubus_box': {"title": "魅魔的封印箱", "text": "你撬開黑市買來的封印箱，裡面飄出一陣粉紫色的煙，煙裡坐著一個只穿著薄紗的魅魔。她伸了個懶腰，上上下下打量了你一遍，對你眨眨眼：「被關了三百年，第一個打開箱子的人……還是個好看的男人呢。要不要做個交易？一個吻，換箱子裡的東西。」"},
    'dg_seed_plant': {"title": "寄生植物的花苞", "text": "你把黑市買來的花苞埋進地下城的泥土裡，它一碰到土就抽出花莖、綻成一株長得像百合的花。花莖纏住你的腰，花心貼上你的小腹，把一顆溫熱的種子推進了你的身體裡。"},
}


def male(t, spec):
    spec = {**spec, **({'lure': LURE_M[t['id']]} if t['id'] in LURE_M else {})}
    m = copy.deepcopy(t)
    m['id'] = t['id'] + '_m'
    m['pc_body'] = BODY_M
    for k in ('title', 'text', 'scene', 'lure'):
        if k in spec:
            m[k] = spec[k]
    for (i, k), text in spec.get('options', {}).items():
        assert k in m['options'][i], (t['id'], i, k)
        m['options'][i][k]['text'] = text
    for i, label in spec.get('labels', {}).items():
        m['options'][i]['label'] = label
    # 欄位順序和原本一樣（id 在最前面）
    return {k: m[k] for k in t}


def write_events():
    p = 'data/rules/travel_events.json'
    s = open(p).read()
    for i in MALE:
        s = re.sub(r'\n    \{"id": "' + i + r'_m".*', '', s)
    d = json.loads(s)
    by_id = {t['id']: t for t in d['templates']}
    for i, spec in MALE.items():
        m = re.search(r'\n    \{"id": "' + i + r'".*', s)
        assert m and m.group(0).endswith(','), i
        orig = by_id[i]
        if i in BODY_OTHERS and orig.get('pc_body') != BODY_OTHERS[i]:
            orig['pc_body'] = BODY_OTHERS[i]
            s = s[:m.start()] + '\n    ' + json.dumps(orig, ensure_ascii=False) + ',' + s[m.end():]
            m = re.search(r'\n    \{"id": "' + i + r'".*', s)
        line = '\n    ' + json.dumps(male(orig, spec), ensure_ascii=False) + ','
        s = s[:m.end()] + line + s[m.end():]
    d = json.loads(s)
    ids = [t['id'] for t in d['templates']]
    for i in MALE:
        assert ids.count(i + '_m') == 1, i
    open(p, 'w').write(s)


def write_items():
    p = 'data/rules/items.json'
    s = open(p).read()
    for i in ITEMS:
        s = re.sub(r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*', '', s)
    for i in GEAR:
        s = re.sub(r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*', '', s)
    m = re.search(r'\n    \{ ?"name": "馴服的魔導衣".*', s)
    assert m and m.group(0).endswith(','), '馴服的魔導衣'
    # 馴服的魔導套的數值照馴服的魔導衣（底材換成丁字褲）
    tamed = json.loads(m.group(0).strip().rstrip(','))
    gear = [dict(g, gear=g['gear'] or dict(tamed['gear'], base='thong')) for g in GEAR]
    s = s[:m.end()] + ''.join('\n    ' + json.dumps(i, ensure_ascii=False) + ',' for i in ITEMS + gear) + s[m.end():]
    names = [i['name'] for i in json.loads(s)['items']]
    for i in ITEMS + GEAR:
        assert names.count(i['name']) == 1, i['name']
    open(p, 'w').write(s)


if __name__ == '__main__':
    write_events()
    write_items()
    write_parasites()
    print('male events', len(MALE), 'lure items', len(ITEMS))
