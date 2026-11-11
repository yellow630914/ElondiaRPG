# 成人用品店的調教家具、消耗品與小道具（docs/LEWD_STATS.md 第 7.3 節）：
#   1. items.json   4 件調教家具（三角木馬、犬籠、罰跪板、真空拘束床）、4 件戰鬥消耗品（淫粘膠、淫粘膠帶、解膠劑、淫癢藥）、
#                   3 件道具（吸乳器、灌腸筒、擴陰器），都標 adult_shop（成人用品店賣）
#   2. family.json  吸乳器：泌乳時擠奶多擠 milk.tool_bonus 瓶（lactation.ts 的 milk）
# 可以重跑：先拿掉上一次寫進去的再寫。要排在 bondage44.py、cursed45.py 之後（接在詛咒具後面）。
import json
import re

T = ["adult_shop"]


def furniture(name, price, training, icon, desc, **extra):
    return {"name": name, "category": "furniture", "price_cc": price, "tags": T, "adult": True, **extra,
            "furniture": {"places": ["indoor", "basement"], "function": "training", "training": training, "icon": icon},
            "desc": f"{desc}擺在家裡，在家調教時檢定 +{training}；留在家裡的奴隸每天順從 +1。"}


ITEMS = [
    furniture("三角木馬", 1500, 2, "🐴", "頂上是尖稜的木馬，跨坐上去雙腳懸空，全身的重量都壓在胯下那一條稜上。", min_location="city"),
    furniture("犬籠", 500, 1, "🐕", "只夠一個人蜷著趴下的鐵籠，門上有鎖，食物和水從欄縫遞進去。"),
    furniture("罰跪板", 200, 1, "🟫", "釘滿鈍釘的木板，跪久了膝蓋又痠又麻。"),
    furniture("真空拘束床", 3000, 3, "🛏️", "兩層乳膠膜夾成的床，抽乾空氣之後全身緊貼著床面，只剩一根呼吸管連著外面。", min_location="city"),
    {"name": "淫粘膠", "category": "consumable", "price_cc": 120, "tags": T, "adult": True,
     "use": {"apply": {"status": "glued", "turns": 1, "save": "dex", "dc": 13}, "area": "one", "combat_only": True},
     "desc": "潑向一名敵人的黏膠：靈巧豁免 DC 13 失敗時被膠膜黏住 1 回合（不能行動，可以掙脫）。解膠劑才洗得掉。"},
    {"name": "淫粘膠帶", "category": "consumable", "price_cc": 160, "tags": T, "adult": True,
     "use": {"apply": {"status": "restrained", "turns": 3, "save": "str", "dc": 13}, "area": "one", "combat_only": True},
     "desc": "一圈圈纏上去的黏膠帶：力量豁免 DC 13 失敗時被束縛 3 回合（迴避劣勢、容易被打中，可以掙脫）。"},
    {"name": "解膠劑", "category": "consumable", "price_cc": 80, "tags": T, "adult": True,
     "use": {"cleanse": ["glued", "restrained"]},
     "desc": "化開淫粘膠的藥水：解除膠膜與束縛。"},
    {"name": "淫癢藥", "category": "consumable", "price_cc": 200, "tags": T, "adult": True,
     "use": {"damage": {"dice": "2d4", "type": "lust"}, "apply": {"status": "sensitized", "turns": 3, "save": "str", "dc": 13}, "area": "one", "combat_only": True},
     "desc": "山藥汁加上淫物體液搗成的藥：對一名敵人造成 2d4 慾望傷害；力量豁免 DC 13 失敗時敏感 3 回合（受到的慾望傷害增加）。"},
    {"name": "吸乳器", "category": "gear", "price_cc": 300, "tags": T, "adult": True,
     "desc": "兩個透明罩杯接著手動抽氣泵。帶在身上時，泌乳的擠奶多擠 1 瓶。"},
    {"name": "灌腸筒", "category": "gear", "price_cc": 150, "tags": T, "adult": True,
     "desc": "標著刻度的金屬筒，底下接著一根細長的軟管與錐形塞頭。"},
    {"name": "擴陰器", "category": "gear", "price_cc": 150, "tags": T, "adult": True,
     "desc": "鴨嘴形的金屬器械，插進去之後一轉就撐開，常用在檢查或羞辱的場合。"},
]
ANCHOR_ITEM = r'\n    \{ ?"name": "產卵肛塞".*'
PUMP = {"item": "吸乳器", "bonus": 1}


def drop_lines(text, pattern):
    return re.sub(pattern, '', text)


def insert_after(text, anchor, lines):
    m = re.search(anchor, text)
    assert m and m.group(0).endswith(','), anchor
    return text[:m.end()] + ''.join('\n' + ln + ',' for ln in lines) + text[m.end():]


def write_items():
    p = 'data/rules/items.json'
    t = open(p).read()
    for i in ITEMS:
        t = drop_lines(t, r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*')
    t = insert_after(t, ANCHOR_ITEM, ['    ' + json.dumps(i, ensure_ascii=False) for i in ITEMS])
    d = json.loads(t)
    names = [i['name'] for i in d['items']]
    for i in ITEMS:
        assert names.count(i['name']) == 1, i['name']
    open(p, 'w').write(t)


def write_family():
    p = 'data/rules/family.json'
    t = open(p).read()
    t, n = re.subn(r'"milk": \{ "item": "母乳", "qty": \[1, 2\], "hours": 0\.5(, "tool": \{[^}]*\})? \}',
                   '"milk": { "item": "母乳", "qty": [1, 2], "hours": 0.5, "tool": ' + json.dumps(PUMP, ensure_ascii=False) + ' }', t)
    assert n == 1
    assert json.loads(t)['lactation']['milk']['tool'] == PUMP
    open(p, 'w').write(t)


if __name__ == '__main__':
    write_items()
    write_family()
    print('items', len(ITEMS))
