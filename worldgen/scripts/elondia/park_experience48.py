# 緋夢樂園的主題體驗區（成人向，docs/LUST_PARK.md 第 9 節）：沒有戰鬥的體驗館。
#   1. gear.json / items.json   新底材「牛尾腰飾」（腰帶欄）與三件店貨（成人用品店）：精牛乳牛的全套服裝缺的那一件
#   2. special_maps.json        體驗區入口 sm_park_experience，與五座體驗館的內部 sm_park_exp_<館>（安全的室內、一直有光）；
#                               牧場、溫室、水族館、劇場各有兩層：前面那館裡的一道門再往裡走是第二層
#                               （配種舍、著床室、飼育區、後台）；淫植花園只有一層
#   3. landmarks.json           入口廣場上的「主題體驗區的閘門」（內部是體驗區入口），體驗區入口裡五座體驗館的地標、
#                               以及各館裡通往第二層的門（也是地標，內部是第二層的地圖）
#                               （內部是各館的地圖，場景擺在館裡的格子上）
# 場景的「身分」（role）：隊伍裡穿著那一館的服裝的人（主角或夥伴）才能當精牛乳牛、苗床、表演者、劇場工作人員；
# 淫植花園整館都要穿得夠少（曝露度 3）才進得去，一進去就沾上花粉（地標的 enter）。見 docs/LANDMARKS.md 第 6.1 節。
# 參觀以外、穿上服裝當展示品的場景只給陰柔、中性體型的人（身分的 body，看參加的人自己的體型）。
# 要排在 outfits47.py（乳牛比基尼、牛角頭飾、牛鈴項圈）、lust_park_s7.py、high_dungeons31.py（入口廣場）、
# underworld39.py、club_lines42.py（它們整筆重寫地標）之後。可以重跑。
import json
import re

# ---------------- 1. 牛尾腰飾 ----------------
COW_TAIL = {"slot": "belt", "name": "牛尾腰飾", "kind": "cloth", "price": 30, "scale": {"save": "half"}, "exposure": 0,
            "outfit": "adult", "adult": True, "desc": "繫在腰後的一條黑白花紋牛尾，尾端一撮毛，走路時跟著甩來甩去。"}
TAIL_ITEMS = [
    {"name": "亞麻牛尾腰飾", "category": "equipment", "price_cc": 30, "tags": ["adult_shop"], "adult": True, "gear": {"base": "cow_tail", "material": "linen"}},
    {"name": "絲綢牛尾腰飾", "category": "equipment", "price_cc": 60, "tags": ["adult_shop"], "adult": True, "gear": {"base": "cow_tail", "material": "silk"}},
    {"name": "月影絲牛尾腰飾", "category": "equipment", "price_cc": 450, "tags": ["adult_shop"], "adult": True, "min_location": "city", "gear": {"base": "cow_tail", "material": "moonsilk"}},
]


def write_gear():
    p = 'data/rules/gear.json'
    t = open(p).read()
    t = re.sub(r'\n    "cow_tail": \{.*', '', t)
    m = re.search(r'\n    "coin_belt": \{.*', t)
    assert m and m.group(0).endswith(',')
    t = t[:m.end()] + '\n    "cow_tail": ' + json.dumps(COW_TAIL, ensure_ascii=False) + ',' + t[m.end():]
    json.loads(t)
    open(p, 'w').write(t)


def write_items():
    p = 'data/rules/items.json'
    t = open(p).read()
    for i in TAIL_ITEMS:
        t = re.sub(r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*', '', t)
    m = re.search(r'\n    \{ ?"name": "月影絲牛角頭飾".*', t)
    assert m and m.group(0).endswith(',')
    t = t[:m.end()] + ''.join('\n    ' + json.dumps(i, ensure_ascii=False) + ',' for i in TAIL_ITEMS) + t[m.end():]
    names = [i['name'] for i in json.loads(t)['items']]
    assert len(names) == len(set(names))
    open(p, 'w').write(t)


# ---------------- 2. 地圖 ----------------
HUB = 'sm_park_experience'
LOC = 'bloodplume'

MAPS = {
    HUB: {
        "name": "緋夢樂園・主題體驗區",
        "location": LOC,
        "desc": "入口廣場旁另闢的一區，招牌寫著「主題體驗區——不用打鬥，只要好好享受」。五座小館一字排開，各是一個園區的體驗館：淫獸牧場的牛舍、蟲之溫室的玻璃屋、觸手水族館的水槽廳、淫植花園的花粉溫室、夢魔劇場的小劇場。換衣間的魅魔店員替想當「展示品」的客人換上各館規定的服裝；只想參觀的買票就能進去。這裡的魔物都養得很乖——至少不會在你沒答應的時候撲上來。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "shops": [{"shop": "adult_shop", "x": 1, "y": 5}, {"shop": "tailor", "x": 9, "y": 5}],
        "grid": [
            "###########",
            "#.........#",
            "#.........#",
            "#.........#",
            "#.~~...~~.#",
            "#.........#",
            "#####E#####",
        ],
    },
    'sm_park_exp_ranch': {
        "name": "淫獸牧場・乳牛體驗館",
        "location": LOC,
        "desc": "淫獸牧場的體驗館：一大片鋪著乾草的牛舍，有讓遊客摸摸乳牛的觸摸草地、餵催乳牧草奶的乳牛舍，和一排接著魔導榨乳器的榨乳台；北邊一道柵門通往後面的配種舍。穿著乳牛比基尼、戴著牛角與牛鈴、繫著牛尾的「精牛乳牛」在草地上晃來晃去，牛鈴叮噹響個不停。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "#############",
            "#...........#",
            "#...........#",
            "#...........#",
            "#~~.......~~#",
            "######E######",
        ],
    },
    'sm_park_exp_ranch_breed': {
        "name": "淫獸牧場・配種舍",
        "location": LOC,
        "desc": "淫獸牧場的配種舍，從乳牛體驗館北邊的柵門進來：犬舍、豬圈與馬廄三間並排，各有一排看台，空氣裡全是野獸與發情的氣味。牧場的淫犬、豬型的發情種豬與種馬型淫獸都養在這裡，等著和精牛乳牛配種。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "#############",
            "#...#...#...#",
            "#...#...#...#",
            "##.###.###.##",
            "#...........#",
            "######E######",
        ],
    },
    'sm_park_exp_greenhouse': {
        "name": "蟲之溫室・苗床體驗館",
        "location": LOC,
        "desc": "蟲之溫室的體驗館：濕熱的玻璃屋裡瀰漫著甜腥的氣味。苗床們躺著讓人參觀的展示區、戴眼鏡的魅魔學者上課的科普教室；北邊一道玻璃門通往後面的著床室。苗床都穿著透明的薄紗，肚子裡有什麼一眼就看得到。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "#############",
            "#...........#",
            "#...........#",
            "#...........#",
            "#...........#",
            "######E######",
        ],
    },
    'sm_park_exp_greenhouse_nest': {
        "name": "蟲之溫室・著床室",
        "location": LOC,
        "desc": "蟲之溫室的著床室，從苗床體驗館北邊的玻璃門進來：三間玻璃隔間——蛞蝓的溫床、粉紅色的史萊姆池、掛滿蛛絲的巨蛛網，各有一排貼著玻璃的看台。又濕又熱，空氣甜腥得讓人頭暈。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "#############",
            "#...#...#...#",
            "#...#...#...#",
            "##.###.###.##",
            "#...........#",
            "######E######",
        ],
    },
    'sm_park_exp_aquarium': {
        "name": "觸手水族館・表演廳",
        "location": LOC,
        "desc": "觸手水族館的表演廳：北邊一排五座展示水槽，淫巨蛙、媚液水母、章魚淫妖、淫蛇與深水觸手各有一座，每座水槽前有一小塊濕漉漉的舞台和看台；南邊是讓遊客把手伸進水裡的觸摸池，東南角一道「員工專用」的後門通往飼育區。穿著吊帶泳衣的表演者在滿場遊客面前和動物們上台演出。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "################",
            "#~~#~~#~~#~~#~~#",
            "#..#..#..#..#..#",
            "#..............#",
            "#..............#",
            "#.~~~......~~~.#",
            "#..............#",
            "#######E########",
        ],
    },
    'sm_park_exp_aquarium_care': {
        "name": "觸手水族館・飼育區",
        "location": LOC,
        "desc": "觸手水族館的飼育區，遊客看不到的後場：五座飼育池養著表演用的淫巨蛙、媚液水母、章魚淫妖、淫蛇與深水觸手，池邊堆著飼料桶與毛巾。穿著吊帶泳衣的表演者每天下池陪自己的動物玩、餵牠們，練習上台的動作。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "################",
            "#~~#~~#~~#~~#~~#",
            "#..#..#..#..#..#",
            "#..............#",
            "#..............#",
            "#######E########",
        ],
    },
    'sm_park_exp_garden': {
        "name": "淫植花園・花粉溫室",
        "location": LOC,
        "desc": "淫植花園的花粉溫室：整間玻璃溫室飄著粉紅色的花粉，沾上皮膚就發燙，衣服穿多了還會被花粉溶出洞來，所以只讓穿得夠少的客人進來。北邊是蜜壺草叢、吞噬花與觸手藤棚，南邊是開著巨大蓮花的溫泉池與淫樹精住的大樹。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "#############",
            "#...#...#...#",
            "#...#...#...#",
            "##.###.###.##",
            "#...........#",
            "#.~~~.......#",
            "#...........#",
            "######E######",
        ],
    },
    'sm_park_exp_theater': {
        "name": "夢魔劇場・體驗劇場",
        "location": LOC,
        "desc": "夢魔劇場的互動式體驗劇場：觀眾不只是看戲的人。北邊是包廂與魅魔劇團的大舞台，東北角一道門通往後台，中間是鋼管舞台，西南角是讓夢魔與夢魘編織春夢的夢之寢室。穿上魅魔裝、戴上角的客人可以當一晚劇場的工作人員。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "###############",
            "#..#.......#..#",
            "#..#.......#..#",
            "#.##.......##.#",
            "#.............#",
            "#..#.......#..#",
            "#..#.......#..#",
            "#######E#######",
        ],
    },
    'sm_park_exp_theater_back': {
        "name": "夢魔劇場・後台",
        "location": LOC,
        "desc": "夢魔劇場的後台，從體驗劇場東北角的門進來：魅魔偶像們的休息室堆滿了花束與舞台裝，散場後的互動會就在這裡；走廊盡頭是夢魔導演的排練室，鏡牆前擺著一張大床。",
        "lighting": "lit", "refresh": False, "peaceful": True,
        "grid": [
            "###########",
            "#...#.....#",
            "#...#.....#",
            "##.####.###",
            "#.........#",
            "#####E#####",
        ],
    },
}


def write_maps():
    p = 'data/world/special_maps.json'
    t = open(p).read()
    # 拿掉上一次寫的
    t = re.sub(r',\n    "sm_park_exp[a-z_]*": \{.*?\n    \}(?=,\n|\n  \})', '', t, flags=re.S)
    body = ''
    for mid, m in MAPS.items():
        lines = [f'      "{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in m.items() if k != 'grid']
        grid = '      "grid": [\n' + ',\n'.join(f'        {json.dumps(r)}' for r in m['grid']) + '\n      ]'
        body += f',\n    "{mid}": {{\n' + ',\n'.join(lines + [grid]) + '\n    }'
    end = t.rindex('\n  }\n}')
    t = t[:end] + body + t[end:]
    json.loads(t)
    open(p, 'w').write(t)


# ---------------- 3. 地標與場景 ----------------

def cond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": True}


def lewd(stat, d):
    return {"type": "lewd", "stat": stat, "delta": d}


def pay(n):
    return {"type": "money", "amount": n}


def sc(title, desc, scene, spot, spot_name, hours=2, money=None, effects=None, role=None, tags=('adult',), cooldown=1):
    out = {"title": title, "desc": desc, "scene": scene, "tags": list(tags), "hours": hours}
    assert len(title) <= 16 and len(spot_name) <= 16 and len(desc) <= 200 and len(scene) <= 400, title
    if money:
        out["money_cc"] = money
    if effects:
        out["effects"] = effects
    if cooldown != 3:
        out["cooldown_days"] = cooldown
    out["own_cooldown"] = True
    out["spot"] = {"x": spot[0], "y": spot[1]}
    out["spot_name"] = spot_name
    if role:
        out["role"] = role
    return out


FEM = ["fem", "andro"]


def role(name, base, **extra):
    r = {"name": name, **base}
    r.update({k: v for k, v in extra.items() if k != 'effects'})
    if extra.get('effects'):
        r["effects"] = extra['effects']
    return r


# ---- 淫獸牧場：精牛乳牛 ----
COW = {"wear": ["cow_bikini", "cow_horns", "cowbell_collar", "cow_tail"], "body": FEM}
DOG, PIG, HORSE, LAWN, BARN, MILK = (2, 1), (6, 1), (10, 1), (2, 3), (6, 3), (10, 3)
GATE = (6, 1)  # 第一層通往第二層的門（牧場、溫室）
BEASTS = [
    # 配種舍、格子、淫獸、遊客看的經過、精牛乳牛的經過、工錢、多出來的效果
    ("犬舍", DOG, "淫犬",
     "主角跟著導覽的魅魔走上犬舍的看台。圍欄裡，一頭牧場的精牛乳牛被淫犬群圍住，獸舍的淫犬王領頭撲上去；魅魔一邊講解淫犬的習性，一邊讓遊客湊近欄杆看配種的經過。",
     "{role}被牧場的魅魔牽進犬舍的圍欄，趴在乾草上擺好姿勢。牧場的淫犬們嗅著發情的氣味圍上來，由淫犬王領頭，一頭接一頭和{role}配種；看台上的遊客看得目不轉睛，魅魔在一旁計時、做紀錄。",
     120, [lewd("lewdness", 1)]),
    ("豬圈", PIG, "種豬",
     "主角走上豬圈的看台。牧場養的豬型淫獸「發情的種豬」早就躁動不安，魅魔把一頭精牛乳牛牽進來趴在乾草堆上，種豬們一頭一頭爬上去配種，又沉又久，看台上的遊客不時發出驚呼。",
     "豬圈裡的發情的種豬——牧場養的豬型淫獸——早就躁動不安。{role}被牽進來趴在乾草堆上，種豬們一頭一頭爬上來和{role}配種，又沉又久；看台上的遊客們看得發出驚呼，魅魔笑著說今天的種豬特別有精神。",
     140, [lewd("endurance", 1)]),
    ("馬廄", HORSE, "種馬",
     "主角走上馬廄的看台。牧場最大的種馬型淫獸噴著鼻息被牽出來，一頭精牛乳牛被扣在配種架上，魅魔馬伕抹上大量的潤滑香油，讓種馬和她配種；整個看台安靜得只聽得到牛鈴和喘息。",
     "{role}被魅魔馬伕扣上馬廄的配種架。牧場的種馬型淫獸噴著鼻息走過來，體型大得嚇人；魅魔們在一旁抹上大量的潤滑香油，讓種馬和{role}慢慢配種，看台上的遊客屏住了呼吸，最後爆出一陣掌聲。",
     180, [lewd("endurance", 1), cond("drained")]),
]


def ranch_scenes():
    cow = lambda **x: role("精牛乳牛", COW, **x)
    out = [
        sc("和精牛乳牛們玩", "遊客：在觸摸草地和牧場的精牛乳牛們親密互動。", "主角買了觸摸草地的票走進柵欄。戴著牛角與牛鈴的精牛乳牛們——牧場的魅魔與獸人員工——圍上來磨蹭撒嬌，讓遊客摸、讓遊客擠、讓遊客騎；主角在草地上和她們親密地玩了一場。",
           LAWN, "觸摸草地", money=40, effects=[cond("relaxed")]),
        sc("在草地上招待遊客", "精牛乳牛：在觸摸草地被來參觀的遊客摸、擠、騎。牧場付工錢。", "{role}換上全套的乳牛裝、掛著牛鈴，被牧場的魅魔牽進觸摸草地，當一下午的精牛乳牛：遊客們排隊來摸、來擠、來騎，牛鈴叮噹響個不停。",
           LAWN, "觸摸草地", role=cow(effects=[pay(80), cond("aroused"), lewd("exposure", 2)])),
        sc("喝下催乳的牧草奶", "精牛乳牛：牧場的魅魔餵你一碗催乳的牧草奶，接下來三天會泌乳（要打開內容篩選「泌乳」）。", "牧場的魅魔把{role}領進乳牛舍，端來一大碗溫熱的牧草奶，裡面摻了牧場特製的催乳藥。喝完沒多久胸口就脹了起來，魅魔笑著替{role}揉開、量了尺寸，在牛鈴上掛一塊「泌乳中」的小牌子。",
           BARN, "乳牛舍", hours=1, tags=('adult', 'lactation'),
           role=cow(can_lactate=True, effects=[{"type": "lactation", "op": "add", "target": "pc", "days": 3}, cond("sensitive")])),
        sc("參觀榨精榨乳", "遊客：坐在看台上，看牧場的精牛乳牛們被接上榨乳器、榨精榨乳。", "主角在榨乳台的看台坐下。一排精牛乳牛被扣在榨乳台上，接上嗡嗡作響的魔導榨乳器，魅魔解說員一邊調快吸力，一邊講解今天的產量；看台上的遊客看得面紅耳赤，散場時還有人買了一瓶「現榨」帶走。",
           MILK, "榨乳台", hours=1, money=30, effects=[cond("aroused")]),
        sc("上榨乳台", "精牛乳牛：要正在泌乳。扣上榨乳台，被魔導榨乳器榨精榨乳給看台上的遊客看；榨出來的分你一些。", "{role}正在泌乳，被牧場的魅魔扣上榨乳台，胸前接上魔導榨乳器，身上有那個的話下面也一起接上。吸力一段一段調高，乳汁（和精液）一瓶一瓶裝滿，看台上的遊客看著數字往上跳、拍手叫好。",
           MILK, "榨乳台", tags=('adult', 'lactation'),
           role=cow(lactating=True, effects=[pay(150), {"type": "item", "name": "母乳", "qty": 1}, cond("drained"), lewd("submission", 1)])),
        sc("上榨精台", "精牛乳牛：不用泌乳。扣上榨精台，被魔導榨精器榨給看台上的遊客看。", "{role}被牧場的魅魔扣上榨精台，腰下接上嗡嗡作響的魔導榨精器，吸力一段一段調高，一次又一次被榨到腿軟；榨出來的是精液還是愛液，就看{role}的身體。看台上的遊客看著瓶子一點一點裝滿，魅魔解說員笑著宣布今天的產量。",
           MILK, "榨乳台", role=cow(effects=[pay(150), cond("drained"), lewd("submission", 1)])),
    ]
    return out


def breed_scenes():
    cow = lambda **x: role("精牛乳牛", COW, **x)
    out = []
    for shed, spot, beast, watch, breed, wage, extra in BEASTS:
        out.append(sc(f"參觀{beast}配種", f"遊客：在{shed}的看台看牧場的精牛乳牛和{beast}配種。", watch, spot, shed, hours=1, money=40, effects=[cond("aroused")]))
        out.append(sc(f"和{beast}配種", f"精牛乳牛：進{shed}和牧場的{beast}配種，給看台上的遊客看。牧場付工錢。", breed, spot, shed,
                      role=cow(effects=[pay(wage), cond("aroused"), *extra])))
    return out


# ---- 蟲之溫室：苗床 ----
BED = {"wear": ["sheer_negligee"], "body": FEM}
SLUG, SLIME, SPIDER, SHOW, CLASS = (2, 1), (6, 1), (10, 1), (2, 3), (10, 3)
IMPLANTS = [
    ("蛞蝓", "蛞蝓的溫床", SLUG, "brood_slug",
     "主角站在蛞蝓溫床的玻璃外。溫室的苗床員工躺上溫熱的苔床，淫蛞蝓們慢慢爬滿她的身體、留下一道道發亮的黏液，最後把幼體產進她體內；魅魔園丁在一旁講解寄生的過程，讓遊客貼著玻璃看。",
     "{role}穿著透視薄紗躺上溫熱的蛞蝓溫床。溫室的淫蛞蝓們慢慢爬滿{role}的身體，黏液讓全身發燙，最後把幼體產進{role}體內；{role}成了溫室新的苗床，接下來幾天肚子裡會一直有東西在動。"),
    ("史萊姆", "史萊姆池", SLIME, "brood_slime",
     "主角站在史萊姆池邊的看台。一位苗床被扶進粉紅色的媚藥史萊姆池，史萊姆從腳踝一路包上來、裹住全身，最後把一顆溫熱的核留在她的肚子裡；她被撈上來時，肚子已經微微鼓起。",
     "魅魔園丁扶著{role}走進粉紅色的媚藥史萊姆池。史萊姆從腳踝一路包上來，裹住全身、鑽進身體，最後把一顆溫熱的核留在{role}的肚子裡；被撈上來時肚子已經微微鼓起，園丁說這顆核會在裡面慢慢長大。"),
    ("巨蛛", "巨蛛的網", SPIDER, "brood_spider_egg",
     "主角走進巨蛛網下的看台。一位苗床被淫巨蛛的絲纏住、吊在網上，巨蛛用產卵管把一串卵產進她體內，再把她從網上放下來；魅魔學者說，四天之後就會產卵，歡迎再來參觀。",
     "{role}被淫巨蛛的絲一圈圈纏住、吊上掛滿蛛絲的網。巨蛛慢慢爬下來，用產卵管把一串卵產進{role}體內，再把{role}從網上放下來；肚子沉甸甸的，魅魔學者說大概四天之後就要產卵了。"),
]


def greenhouse_scenes():
    bed = lambda **x: role("苗床", BED, **x)
    out = [
        sc("和苗床們互動", "遊客：在展示區和溫室的苗床們互動，摸摸鼓起來的肚子。", "展示區裡，幾位穿著透明薄紗的苗床躺在溫熱的軟墊上，肚子裡的卵和幼蟲隔著皮膚隱約可見。主角在魅魔園丁的帶領下摸了摸她們鼓起的肚子、感受裡面的胎動，苗床們紅著臉主動纏上來，討主角的歡心。",
           SHOW, "苗床展示區", money=40, effects=[cond("aroused")]),
        sc("在展示區當苗床", "苗床：穿著透視薄紗躺在展示區，讓遊客觀察、撫摸。溫室付工錢。", "{role}換上透視薄紗，躺上展示區的軟墊，當一下午溫室的苗床：遊客們隔著薄紗觀察、撫摸{role}的身體，有人好奇地問東問西，有人的手伸得太裡面——魅魔園丁笑著說：「苗床本來就要多受點刺激。」",
           SHOW, "苗床展示區", role=bed(effects=[pay(80), cond("aroused"), lewd("exposure", 2)])),
        sc("聽苗床科普", "遊客：聽魅魔學者講解苗床的知識，看真正的苗床當教材。", "科普教室裡，戴眼鏡的魅魔學者拿著教鞭，請一位懷著蟲卵的苗床躺上講台當教材：哪一種是卵生、哪一種是胎生、怎麼分辨幼蟲長好了沒、產下來時要怎麼幫忙。主角在台下聽得面紅耳赤，下課前學者還讓學生輪流上台摸摸看。",
           CLASS, "科普教室", hours=1, money=50, effects=[{"type": "xp", "amount": 40, "target": "pc"}, cond("aroused")]),
        sc("當科普的教材", "苗床：主角身上要有怪物的苗床。穿著透視薄紗躺上講台，讓魅魔學者拿你當教材。", "{role}身上懷著怪物的苗床，穿著透視薄紗躺上科普教室的講台。魅魔學者用教鞭指著{role}的肚子，向台下的遊客講解裡面是什麼、長到哪個階段、要怎麼照顧；講到一半還請學生上台摸摸看、貼著肚皮聽裡面的動靜。",
           CLASS, "科普教室", tags=('adult', 'monster_brood'),
           role=bed(brood=True, pc_only=True, effects=[pay(120), cond("sensitive"), lewd("exposure", 3)])),
    ]
    return out


def nest_scenes():
    bed = lambda **x: role("苗床", BED, **x)
    out = []
    for kind, room, spot, brood, watch, implant in IMPLANTS:
        out.append(sc(f"參觀{kind}著床", f"遊客：在{room}看溫室的苗床被{kind}著床。", watch, spot, room, hours=1, money=40, effects=[cond("aroused")]))
        out.append(sc(f"讓{kind}著床", f"苗床：只有主角。在{room}被{kind}著床，成為溫室的苗床（要打開內容篩選「怪物的苗床」；懷孕中、已經有了時不行）。", implant, spot, room,
                      tags=('adult', 'monster_brood'), cooldown=3,
                      role=bed(pc_only=True, effects=[pay(100), cond("aroused"), {"type": "parasite", "op": "add", "parasite": brood}])))
    return out


# ---- 觸手水族館：表演者 ----
SWIM = {"wear": ["sling_swimsuit"], "body": FEM}
TOUCH = (3, 4)
ANIMALS = [
    # 動物、水槽（格子名稱）、格子、練習、表演、遊客看、練習多出來的效果
    ("巨蛙", "巨蛙池", (1, 2),
     "{role}穿著吊帶泳衣下到巨蛙池，餵淫巨蛙吃東西、陪牠玩，練習表演要用的動作：被長舌捲起來、拋上半空、再接住。巨蛙的舌頭又黏又熱，練著練著就變了調。",
     "表演時間到了。{role}站上巨蛙池的舞台，和淫巨蛙一起表演練好的節目：長舌捲起、拋起、接住，一次比一次纏得更緊，最後在全場的掌聲裡被巨蛙的長舌裹著舉在半空。",
     "主角坐在巨蛙池前排的看台。穿著濕透泳衣的表演者被淫巨蛙的長舌捲起、拋起、接住，一場比一場大膽；前排的遊客被濺得一身濕，還有人被表演者拉上台一起玩。",
     lewd("endurance", 1)),
    ("水母", "水母缸", (4, 2),
     "{role}泡進媚液水母的水缸，讓發光的水母一隻一隻貼上皮膚，習慣牠們觸鬚的媚毒：剛開始麻得發抖，慢慢地學會在水裡隨著水母漂、擺出好看的姿勢。",
     "燈光暗下來，只剩水缸裡的水母在發光。{role}在缸裡和媚液水母跳一支慢舞，透明的觸鬚纏滿全身，每貼上一次{role}就輕顫一下，觀眾隔著玻璃看得入迷。",
     "主角坐在水母缸前。燈暗之後，缸裡的表演者被發光的媚液水母包圍，觸鬚纏滿全身，隨著水流慢慢起舞；每被螫一下，她就在水裡輕顫一次，玻璃外一片安靜。",
     lewd("sensitivity", 1)),
    ("章魚", "章魚水槽", (7, 2),
     "{role}下到章魚水槽，和水族館的章魚淫妖培養默契：八條觸腕各有各的脾氣，哪一條喜歡纏腰、哪一條喜歡往裡探，練習時一條一條認識過去。",
     "{role}和章魚淫妖站上章魚水槽的舞台。八條觸腕把{role}纏起、舉高、擺出一個又一個姿勢，章魚淫妖在{role}耳邊輕笑，表演的最後兩人一起沉進水裡，只留下一圈墨色。",
     "主角坐在章魚水槽的看台。章魚淫妖用八條觸腕把表演者纏起、舉高、翻轉，擺出一個又一個大膽的姿勢，最後兩人一起沉進水裡，只留下一圈墨色和全場的掌聲。",
     lewd("lewdness", 1)),
    ("淫蛇", "海蛇窟", (10, 2),
     "{role}走進海蛇窟，讓淫蛇從腳踝一圈圈纏上來，練習在被纏緊的時候保持呼吸、保持笑容；淫蛇的信子不時舔過{role}的耳朵和脖子。",
     "{role}站上海蛇窟的舞台。淫蛇從腳踝一路纏到胸口，越纏越緊，{role}在牠的懷裡扭動、喘息，蛇頭繞過肩膀和{role}對看——觀眾分不清誰才是被馴服的那一個。",
     "主角坐在海蛇窟的看台。淫蛇從表演者的腳踝一路纏到胸口，越纏越緊，她在蛇身裡扭動、喘息，蛇頭繞過肩膀和她對看；看台上有人看得忘了眨眼。",
     lewd("submission", 1)),
    ("觸手", "觸手池", (13, 2),
     "{role}下到最深的觸手池，讓深水觸手一點一點熟悉{role}的身體：哪裡可以纏、哪裡要輕一點、什麼時候該放開，練到觸手一碰就知道{role}要什麼。",
     "壓軸是觸手池。{role}被深水觸手從水底捲上來，四肢被分開吊在水面上，觸手一條條鑽進泳衣底下，最後把{role}整個拉進水裡又托出來，全場起立鼓掌。",
     "壓軸的觸手秀。深水觸手把表演者從水底捲上來，四肢被分開吊在水面上，觸手一條條鑽進泳衣底下，又把她整個拉進水裡再托出來；散場時主角的腿有點軟。",
     lewd("endurance", 1)),
]


def aquarium_scenes():
    swim = lambda **x: role("表演者", SWIM, **x)
    out = [sc("和章魚淫妖握手", "遊客：在觸摸池把手伸進水裡，和水族館的章魚淫妖互動。", "觸摸池邊，水族館的章魚淫妖——上半身是嫵媚的女人、下半身是八條粗大的觸腕——趴在池緣對主角招手。主角把手伸進水裡，觸腕一條條纏上來，從手腕一路往上；章魚淫妖笑著說：「握手只是開始喔。」",
              TOUCH, "觸摸池", hours=1, money=40, effects=[cond("aroused")])]
    for animal, tank, spot, train, show, watch, extra in ANIMALS:
        out.append(sc(f"上台表演：{animal}秀", f"表演者：在滿場遊客面前和{animal}表演。水族館付工錢。", show, spot, tank,
                      role=swim(effects=[pay(150), cond("aroused"), lewd("exposure", 3)])))
        out.append(sc(f"看{animal}秀", f"遊客：坐在{tank}的看台看表演，前排會被水濺到。", watch, spot, tank, hours=1, money=30, effects=[cond("aroused")]))
    return out


def aquarium_care_scenes():
    """飼育區：表演者陪動物培養感情、練習（遊客進不來）"""
    swim = lambda **x: role("表演者", SWIM, **x)
    return [sc(f"和{animal}培養感情", f"表演者：下到飼育池陪{animal}玩、餵牠，練習表演的動作。", train, spot, f"{animal}的飼育池",
               role=swim(effects=[pay(40), cond("aroused"), extra]))
            for animal, tank, spot, train, show, watch, extra in ANIMALS]


# ---- 淫植花園：花粉派對（整館要穿得夠少） ----
NUDE = {"exposure": 3}
GARDEN_ENTER = {
    "role": {"name": "體驗者", "exposure": 3, "effects": [cond("aroused"), cond("sensitive")]},
    "text": "{role}換好衣服走進花粉溫室，粉紅色的花粉撲面而來，沾上皮膚就發燙——花園的魅魔笑著說：「衣服穿多了會被花粉溶掉喔，你們這樣剛剛好。」",
}


def garden_scenes():
    nude = lambda **x: role("體驗者", NUDE, **x)
    return [
        sc("蜜壺草的泡蜜體驗", "體驗者：躺進一人高的蜜壺草裡泡花蜜。", "{role}被魅魔園丁扶進一株一人高的蜜壺草。壺口緩緩閉上，溫熱黏稠的花蜜一直漫到胸口，壺壁上的軟毛一下一下地揉著、吸著；過了好一陣子，{role}才渾身是蜜、腿軟地被吐了出來。",
           (2, 1), "蜜壺草叢", money=40, role=nude(effects=[cond("afterglow"), lewd("sensitivity", 1)])),
        sc("吞噬花的丸吞體驗", "體驗者：被巨大的吞噬花整個吞進花苞裡。", "巨大的吞噬花張開花瓣，把{role}整個吞了進去：從頭到腳被花瓣裹住，在花苞裡被揉弄、被花蕊探索，外面的遊客只看得到花苞一鼓一鼓地動。半個時辰後花苞打開，把渾身黏液的{role}吐了出來。",
           (6, 1), "吞噬花", money=50, role=nude(effects=[cond("dazed"), lewd("submission", 1)])),
        sc("觸手藤的體驗", "體驗者：走進觸手藤棚，被藤蔓吊起來玩弄。", "{role}走進觸手藤棚，藤蔓從頭頂垂下來纏住手腕、腳踝，把{role}吊在半空擺成各種姿勢，細細的藤鬚鑽進每一個縫隙；魅魔園丁在一旁幫忙調整，說這是花園最受歡迎的一項。",
           (10, 1), "觸手藤棚", money=40, role=nude(effects=[cond("afterglow"), lewd("endurance", 1)])),
        sc("和蓮花妖泡溫泉", "體驗者：在溫泉池裡讓蓮花妖替你洗身子。", "花園的溫泉池裡開著巨大的蓮花，蓮花妖從花心裡探出半身，邀{role}下水。她用蓮瓣和柔軟的手替{role}洗身子，洗著洗著就纏了上來，溫泉水裡全是甜甜的花香。",
           (5, 5), "蓮花溫泉", money=50, role=nude(effects=[cond("relaxed"), cond("afterglow")])),
        sc("和淫樹精共度午後", "體驗者：被淫樹精抱上枝頭，吃果子、被疼愛。", "花園中央的大樹裡住著淫樹精。她從樹幹裡走出來，用藤蔓把{role}抱上枝頭，在樹蔭下一邊餵{role}吃甜美的果實，一邊慢慢地、徹底地疼愛{role}，直到太陽偏西。",
           (10, 5), "淫樹精的大樹", hours=3, money=50, role=nude(effects=[cond("afterglow"), lewd("lewdness", 1)])),
    ]


# ---- 夢魔劇場：劇場工作人員 ----
STAFF = {"wear": ["succubus_outfit", "succubus_horns"], "body": FEM}
BOX, STAGE, BACKDOOR, POLE, DREAM = (1, 1), (7, 1), (13, 1), (7, 5), (1, 6)
IDOL, REHEARSE = (2, 1), (7, 1)  # 後台


def theater_scenes():
    staff = lambda **x: role("劇場工作人員", STAFF, **x)
    return [
        sc("跟引座員進包廂", "遊客：讓小惡魔引座員帶你到包廂「好好坐」。", "主角一進劇場，就被一個笑得甜甜的小惡魔引座員挽住手臂：「客人一個人嗎？我帶您去包廂，包廂有『特別服務』喔。」厚重的簾子一放下來，引座員就跨坐到主角腿上，戲還沒開演，包廂裡已經先熱鬧起來了。",
           BOX, "包廂", money=60, effects=[cond("afterglow")]),
        sc("當引座員尋找獵物", "劇場工作人員：扮成引座員在大廳物色落單的客人，帶進包廂。劇場付工錢。", "{role}扮成劇場的引座員在大廳裡物色獵物：挑一個落單、看起來最好騙的客人，挽著他的手臂帶進包廂，簾子一放下，接下來就換{role}說了算。",
           BOX, "包廂", role=staff(effects=[pay(100), cond("aroused"), lewd("lewdness", 1)])),
        sc("看鋼管舞，被拉上台", "遊客：看魅魔舞者的鋼管脫衣舞，被點名上台互動。", "鋼管舞台上，魅魔舞者繞著鋼管一件一件脫下衣服，最後只剩一對角和尾巴。她跳下舞台，在觀眾席裡挑中了主角：「就是你了，上來吧。」主角被拉上台，在全場的口哨聲裡成了舞的一部分。",
           POLE, "鋼管舞台", money=50, effects=[cond("aroused"), lewd("exposure", 1)]),
        sc("當魅魔舞者", "劇場工作人員：上台跳鋼管脫衣舞，再挑一位觀眾上台互動。劇場付工錢。", "{role}扮成魅魔舞者站上鋼管舞台，在燈光下繞著鋼管一件一件脫，脫到只剩角和幾條皮帶；最後跳下台挑了一位看得最入迷的客人拉上台，在全場面前和他「互動」到曲終。",
           POLE, "鋼管舞台", role=staff(effects=[pay(140), cond("aroused"), lewd("exposure", 3)])),
        sc("夢魔與夢魘的春夢", "遊客：躺進夢之寢室，讓夢魔與夢魘替你編一場春夢。", "夢之寢室裡只有一張大床和搖曳的燭光。主角躺下沒多久就睡著了，夢魔與夢魘溜進夢裡，照著主角心底最深的慾望編出一場春夢：夢裡的人、夢裡的事都太真實，醒來時床單是濕的，耳邊還留著夢魘的笑聲。",
           DREAM, "夢之寢室", hours=3, money=60, effects=[cond("dazed"), cond("afterglow")]),
        sc("看魅魔劇團的演出", "遊客：坐在觀眾席看魅魔劇團的招牌大戲。", "今晚是魅魔劇團的招牌大戲：一個騎士被魅魔誘惑墮落的故事。演員們演得極其投入，床戲完全不借位；演到高潮時，劇團的首席走下舞台，把一位觀眾拉上去軋了一角，主角一整場都坐立難安。",
           STAGE, "大舞台", hours=3, money=60, effects=[cond("aroused")]),
        sc("參與魅魔劇團的演出", "劇場工作人員：在魅魔劇團的大戲裡軋一角，在滿座的觀眾面前演出。劇場付工錢。", "{role}在魅魔劇團的大戲裡軋了一角，演被誘惑墮落的騎士，或誘惑騎士的魅魔。床戲不借位，滿座的觀眾看著{role}在舞台上被劇團的首席一層層剝開，演到謝幕時全場起立鼓掌。",
           STAGE, "大舞台", hours=3, role=staff(effects=[pay(200), cond("aroused"), lewd("exposure", 4)])),
    ]


def backstage_scenes():
    staff = lambda **x: role("劇場工作人員", STAFF, **x)
    return [
        sc("偶像演唱與後台互動會", "遊客：看魅魔偶像唱歌跳舞，散場後參加後台的「互動會」。", "大舞台上的魅魔偶像唱了一整晚的情歌，歌聲甜得讓人腿軟。散場後，主角拿著互動會的票走進後台，偶像們還沒換下舞台裝，一個個笑著迎上來；說是握手會，握的可不只是手。",
           IDOL, "偶像的休息室", hours=3, money=80, effects=[cond("relaxed"), cond("afterglow")]),
        sc("當魅魔偶像", "劇場工作人員：上台唱歌跳舞，散場後在後台陪粉絲「互動」。劇場付工錢。", "{role}扮成魅魔偶像站上舞台，唱著甜膩的情歌、跳著挑逗的舞，台下的粉絲揮著螢光棒尖叫。散場後是後台互動會：粉絲們一個一個排隊進來，{role}還穿著舞台裝，從握手、擁抱一路「互動」到最後一位。",
           IDOL, "偶像的休息室", hours=4, role=staff(effects=[pay(180), cond("drained"), lewd("exposure", 3)])),
        sc("夢魔導演的排練", "劇場工作人員：被後台的夢魔導演拉進排練室，一遍又一遍地練。劇場付工錢。", "後台的夢魔導演看中了{role}：「新戲缺一個角色，你來。」排練室裡，導演要{role}一遍又一遍地演同一場床戲，對手換了一個又一個，導演還親自下場示範：「不對，再來一次，這次要更投入。」",
           REHEARSE, "排練室", hours=3, role=staff(effects=[pay(100), cond("drained"), lewd("submission", 1)])),
    ]


def lm(id_, name, emoji, at, desc, scene, interior, scenes=None, enter=None, types=('market',)):
    assert len(name) <= 12, name
    out = {"id": id_, "name": name, "emoji": emoji, "location": LOC, "at": at, "types": list(types), "desc": desc, "scene": scene, "open": {"adult": True}, "interior": interior}
    if enter:
        out["enter"] = enter
    if scenes:
        assert len(scenes) <= 12, id_
        out["scenes"] = scenes
    return out


def landmarks():
    hub = lambda x: {"area": f"sm/{HUB}", "x": x, "y": 2}
    return [
        lm("lm_park_experience", "主題體驗區的閘門", "🎠", {"area": "sm/sm_lust_park", "x": 5, "y": 5},
           "兩座噴泉之間、旋轉木馬後面的一道彩繪閘門，招牌寫著「主題體驗區」：五個園區各有一座不用戰鬥的體驗館，可以買票當遊客，也可以換上衣服當展示品。",
           "彩繪的閘門上掛滿了心形燈籠，門口的魅魔店員對每個路過的客人眨眼：「不想打架？那就來體驗區玩吧。」", HUB),
        lm("lm_park_exp_ranch", "淫獸牧場・精牛乳牛體驗", "🐄", hub(1),
           "淫獸牧場的體驗館。遊客買票摸乳牛、看榨乳，北邊的柵門後面是配種舍；穿上乳牛比基尼、牛角頭飾、牛鈴項圈與牛尾腰飾的人（主角或夥伴）可以當牧場的「精牛乳牛」。",
           "乾草與奶香混在一起的牛舍，牛鈴叮噹響，看台上坐滿了指指點點的遊客。", 'sm_park_exp_ranch', ranch_scenes()),
        lm("lm_park_exp_ranch_breed", "淫獸牧場・配種舍", "🐎", {"area": "sm/sm_park_exp_ranch", "x": GATE[0], "y": GATE[1]},
           "乳牛體驗館北邊的柵門，往裡走是犬舍、豬圈與馬廄三間配種舍：遊客在看台上參觀配種，精牛乳牛進圍欄和淫犬、種豬、種馬配種。",
           "野獸的氣味從柵門後面飄過來，偶爾傳出一陣嘶鳴和看台上的驚呼。", 'sm_park_exp_ranch_breed', breed_scenes()),
        lm("lm_park_exp_greenhouse", "蟲之溫室・苗床體驗館", "🪺", hub(3),
           "蟲之溫室的體驗館。遊客買票看苗床、聽科普，北邊的玻璃門後面是著床室；穿上透視薄紗睡衣的人可以當溫室的「苗床」。",
           "濕熱的玻璃屋，空氣甜腥，穿著透明薄紗的苗床們躺在軟墊上，肚子裡的東西隔著皮膚隱約可見。", 'sm_park_exp_greenhouse', greenhouse_scenes()),
        lm("lm_park_exp_greenhouse_nest", "蟲之溫室・著床室", "🥚", {"area": "sm/sm_park_exp_greenhouse", "x": GATE[0], "y": GATE[1]},
           "苗床體驗館北邊的玻璃門，往裡走是蛞蝓、史萊姆與巨蛛的著床室：遊客隔著玻璃參觀著床，主角可以穿著透視薄紗躺進去，真的讓蟲子著床。",
           "玻璃門上蒙著一層水氣，門後傳來黏稠的水聲。", 'sm_park_exp_greenhouse_nest', nest_scenes()),
        lm("lm_park_exp_aquarium", "觸手水族館・親密表演廳", "🐙", hub(5),
           "觸手水族館的表演廳。遊客買票和章魚淫妖握手、看動物秀；穿上吊帶泳衣的人可以當「表演者」，和巨蛙、水母、章魚、淫蛇、觸手上台表演；表演廳的後門再往裡走是飼育區，可以先去練習。",
           "五座水槽在幽藍的燈光裡發亮，舞台濕漉漉的，看台上的遊客等著下一場表演。", 'sm_park_exp_aquarium', aquarium_scenes()),
        lm("lm_park_exp_aquarium_care", "觸手水族館・飼育區", "🐸", {"area": "sm/sm_park_exp_aquarium", "x": 14, "y": 6},
           "表演廳東南角掛著「員工專用」的後門，往裡走是水族館的飼育區。穿上吊帶泳衣的表演者在這裡陪巨蛙、水母、章魚、淫蛇、觸手培養感情、練習表演的動作。",
           "飼育池的水聲嘩啦啦地響，池邊堆著飼料桶，動物們一看到表演者就湊了過來。", 'sm_park_exp_aquarium_care', aquarium_care_scenes()),
        lm("lm_park_exp_garden", "淫植花園・溫室花粉派對", "🌺", hub(7),
           "淫植花園的花粉溫室。衣服會被花粉溶掉，只讓穿得夠少的人（曝露度 3）進去，一進去就沾上花粉而發情、敏感；裡面可以體驗蜜壺草、吞噬花、觸手藤、蓮花妖與淫樹精。",
           "粉紅色的花粉在玻璃溫室裡飄著，甜得發膩的花香讓人頭暈，花叢深處傳來一陣陣嬌喘。", 'sm_park_exp_garden', garden_scenes(), enter=GARDEN_ENTER),
        lm("lm_park_exp_theater", "夢魔劇場・互動體驗劇場", "🎭", hub(9),
           "夢魔劇場的互動式體驗劇場。遊客可以進包廂、看鋼管舞、做一場春夢、看劇團的大戲，東北角的門通往偶像與導演所在的後台；穿上魅魔裝、戴上魅魔角頭飾的人可以當一晚「劇場工作人員」。",
           "紅絲絨的布幕、昏暗的燈光，觀眾席裡的喘息聲比台詞還大聲。", 'sm_park_exp_theater', theater_scenes()),
        lm("lm_park_exp_theater_back", "夢魔劇場・後台", "🎤", {"area": "sm/sm_park_exp_theater", "x": BACKDOOR[0], "y": BACKDOOR[1]},
           "體驗劇場東北角通往後台的門：偶像們的休息室（散場後的互動會）與夢魔導演的排練室。拿著互動會門票的遊客與劇場工作人員才進得來。",
           "門後是脂粉、花束與汗水的味道，走廊盡頭傳來導演喊「再來一次」的聲音。", 'sm_park_exp_theater_back', backstage_scenes()),
    ]


def write_landmarks():
    p = 'data/world/landmarks.json'
    d = json.load(open(p))
    new = landmarks()
    ids = {l['id'] for l in new}
    d['landmarks'] = [l for l in d['landmarks'] if l['id'] not in ids] + new
    open(p, 'w').write(json.dumps(d, ensure_ascii=False, indent=1))
    return new


if __name__ == '__main__':
    write_gear()
    write_items()
    write_maps()
    new = write_landmarks()
    print('maps', len(MAPS), 'landmarks', len(new), 'scenes', sum(len(l.get('scenes', [])) for l in new))
