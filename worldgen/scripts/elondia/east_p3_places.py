"""炎華之地 P3：炎華南域的 19 個地標與 5 張特殊地圖（docs/plan/roadmap/EAST_CONTENT_PLAN.md 第 6、7 節）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p3_places.py
寫進 data/world/landmarks.json、data/world/special_maps.json，並把受訓的地標加到 data/rules/perks.json 的 train.cells。
已經有同 id 的項目時整筆換掉（可以重跑）。
"""

import json
import re

LM_PATH = 'data/world/landmarks.json'
SM_PATH = 'data/world/special_maps.json'
PERK_PATH = 'data/rules/perks.json'


def cond(c, add=True):
    return {'type': 'condition', 'target': 'pc', 'condition': c, 'add': add}


def memory(s):
    return {'type': 'memory', 'summary': s, 'importance': 1}


LANDMARKS = [
    # ---------- 龍安府 ----------
    {
        'id': 'lm_yh_night_market', 'name': '御街夜市', 'emoji': '🏮', 'location': 'longan',
        'at': {'area': 'longan/yujie', 'x': 7, 'y': 3}, 'types': ['market'],
        'desc': '御街兩旁一入夜就擺滿攤子：茶坊、果子、燒鵝、羊肉湯餅、說唱的、賣藝的，燈籠一路掛到宣德樓下。',
        'scene': '紅燈籠沿著御街一路亮到皇城腳下，油鍋滋滋作響，茶博士吆喝著添水，人潮擠得轉不過身。',
        'visit': {'title': '逛夜市吃小食', 'desc': '從街頭吃到街尾。', 'money_cc': 8, 'hours': 1,
                  'effects': [cond('fed_fine'), cond('cheered')]},
        'explore': {'title': '在茶坊打聽消息', 'desc': '夜市的茶坊什麼消息都有，就看你問不問得到。', 'attr': 'cha', 'dc': 13, 'hours': 2,
                    'effects': [{'type': 'xp', 'amount': 25}, memory('在御街夜市的茶坊聽到不少朝堂與坊間的閒話。')],
                    'critical': [{'type': 'money', 'amount': 30}]},
        'work': {'attr': 'cha', 'dc': 12, 'rate_cc': 4, 'desc': '在夜市替攤子吆喝、跑堂、收碗。'},
    },
    {
        'id': 'lm_yh_goulan', 'name': '瓦舍勾欄', 'emoji': '🎭', 'location': 'longan',
        'at': {'area': 'longan/washe', 'x': 5, 'y': 3}, 'types': ['market'],
        'desc': '瓦舍裡最大的一座勾欄，雜劇、說書、傀儡戲從午後演到半夜；龍安府二十座勾欄有十二座是蕭鳳儀的。',
        'scene': '棚下坐滿看客，鑼鼓一響，台上的旦角水袖一甩，滿堂叫好；台後的戲子忙著上妝換衣。',
        'visit': {'title': '看一場雜劇', 'desc': '買一張座頭，看一齣新戲。', 'money_cc': 12, 'hours': 2, 'effects': [cond('cheered')]},
        'work': {'attr': 'cha', 'dc': 13, 'rate_cc': 5, 'desc': '在勾欄說書、唱曲或跑龍套，賺一點賞錢。'},
    },
    {
        'id': 'lm_yh_taixue', 'name': '太學與貢院', 'emoji': '📜', 'location': 'longan',
        'at': {'area': 'longan/guizu', 'x': 2, 'y': 3}, 'types': ['academy', 'official'],
        'desc': '大燁的最高學府，旁邊是科舉的貢院。墨鐵鱗出身的士子在這裡苦讀，盼著有一天在點青禮上封鱗。',
        'scene': '講堂裡傳出整齊的誦經聲，廊下的士子捧著書卷低聲爭論，貢院的號舍一排排望不到頭。',
        'open': {'official': True},
        'explore': {'title': '旁聽太學的講經', 'desc': '混進講堂後排聽一堂課。', 'attr': 'int', 'dc': 13, 'hours': 3,
                    'effects': [{'type': 'xp', 'amount': 30}, memory('在龍安府的太學旁聽了一堂講經。')]},
        'work': {'attr': 'int', 'dc': 13, 'rate_cc': 4, 'desc': '替士子抄書、謄寫講義。'},
    },
    {
        'id': 'lm_yh_taimiao', 'name': '太廟', 'emoji': '🐉', 'location': 'longan',
        'at': {'area': 'longan/guizu', 'x': 8, 'y': 3}, 'types': ['holy', 'monument'],
        'desc': '供奉燁氏歷代皇帝與祖龍的宗廟；太廟的女祭司慧音在研究祖龍的傳說。',
        'scene': '香煙繚繞的大殿裡，歷代皇帝的牌位一層層排上去，最高處是一幅看不清面目的祖龍圖。',
        'open': {'official': True},
        'visit': {'title': '祭祖龍', 'desc': '在祖龍像前上一炷香。', 'money_cc': 10, 'hours': 1, 'effects': [cond('blessed')]},
    },
    {
        'id': 'lm_yh_xuande', 'name': '宣德樓', 'emoji': '🏯', 'location': 'longan',
        'at': {'area': 'longan/palace', 'x': 5, 'y': 1}, 'types': ['official', 'monument'],
        'desc': '皇城的正門城樓，女帝在這裡臨朝、閱兵，也在夜裡一個人上樓頂喝冷掉的茶。',
        'scene': '重簷的城樓下，禁軍持戟肅立；樓上的天青琉璃瓦在日光下泛著淡淡的青光。',
        'open': {'official': True},
    },
    {
        'id': 'lm_yh_shangqin', 'name': '尚寢局', 'emoji': '🕯️', 'location': 'longan',
        'at': {'area': 'longan/palace', 'x': 2, 'y': 3}, 'types': ['official'],
        'desc': '掌管宮中寢殿與帷帳的女官署；司寢女官溫如玉在這裡教導宮中的閨房之禮。',
        'scene': '層層紗帳後點著安神的香，女官們低聲細語，捧著疊好的錦被穿過長廊。',
        'open': {'official': True},
    },
    {
        'id': 'lm_yh_taifei', 'name': '太妃宮', 'emoji': '🌸', 'location': 'longan',
        'at': {'area': 'longan/palace', 'x': 8, 'y': 3}, 'types': ['official'],
        'desc': '皇城深處先帝的後宮。太后與太妃——先帝的皇后與寵妃——鬥了半輩子，如今在這裡當鄰居。',
        'scene': '海棠開滿了庭院，兩座殿閣隔著一道月洞門，各自的宮女都裝作沒看見對方。',
        'open': {'official': True},
    },
    # ---------- 萍江府 ----------
    {
        'id': 'lm_yh_rainbow_bridge', 'name': '虹橋', 'emoji': '🌈', 'location': 'pingjiang',
        'at': {'area': 'pingjiang/shuixiang', 'x': 3, 'y': 3}, 'types': ['harbor', 'monument'],
        'desc': '橫跨運河的木造拱橋，不用一根橋柱；橋上擠滿小販，橋下的貨船一艘接一艘穿過。',
        'scene': '拱橋像一道彩虹架在運河上，橋下的船夫一邊放倒桅桿一邊吆喝，橋上的人探身看熱鬧。',
        'visit': {'title': '在橋上看運河', 'desc': '倚著欄杆看船來船往。', 'hours': 0.5, 'effects': [cond('relaxed')]},
        'work': {'attr': 'str', 'dc': 12, 'rate_cc': 4, 'desc': '在橋下替貨船拉縴、卸貨。'},
    },
    {
        'id': 'lm_yh_bamboo_lake', 'name': '竹湖', 'emoji': '🎋', 'location': 'pingjiang',
        'at': {'area': 'pingjiang/yuanlin', 'x': 8, 'y': 3}, 'types': ['nature'],
        'desc': '園林邊上一片被竹林圍起來的湖，安靜得聽得見竹葉落水；湖畔住著一個從小被當成蛇妖避開的女人。',
        'scene': '竹影映在碧綠的湖面上，風一吹沙沙作響，湖心偶爾泛起一圈不知是魚還是蛇的漣漪。',
        'visit': {'title': '湖畔散步', 'desc': '沿著竹林走一圈。', 'hours': 1, 'effects': [cond('relaxed')]},
        'explore': {'title': '採湖邊的藥草', 'desc': '竹林下長著不少藥草。', 'attr': 'int', 'dc': 12, 'hours': 2,
                    'effects': [{'type': 'item', 'name': '藥草', 'qty': 2}, {'type': 'xp', 'amount': 20}]},
    },
    {
        'id': 'lm_yh_weaving_bureau', 'name': '織造局', 'emoji': '🧵', 'location': 'pingjiang',
        'at': {'area': 'pingjiang/zhifang', 'x': 5, 'y': 1}, 'types': ['workshop', 'official'],
        'desc': '替宮裡織造雲錦的官辦織坊，上千張織機日夜不停；織工的工錢一年比一年少，行會的怨氣一年比一年重。',
        'scene': '織機的梭聲像雨一樣密，織工們手腳不停，監工拿著冊子在走道間來回巡視。',
        'work': {'attr': 'dex', 'dc': 12, 'rate_cc': 4, 'desc': '在織造局幫忙理絲、上機、搬運布匹。'},
    },
    {
        'id': 'lm_yh_ping_garden', 'name': '萍園', 'emoji': '🏞️', 'location': 'pingjiang',
        'at': {'area': 'pingjiang/yuanlin', 'x': 3, 'y': 2}, 'types': ['monument'],
        'desc': '畫師謝青梧的私家園林，假山、曲廊與一座收藏天青瓷的藏瓷閣；熟客可以進去看瓷。',
        'scene': '曲廊轉過假山，一池睡蓮倒映著粉牆黛瓦，藏瓷閣的窗後隱約透出青瓷的光。',
        'visit': {'title': '遊園賞瓷', 'desc': '付一點茶錢，在園裡走走。', 'money_cc': 10, 'hours': 1, 'effects': [cond('cheered')]},
        'interior': 'sm_yh_cangci',
    },
    {
        'id': 'lm_yh_lingxu', 'name': '靈虛觀', 'emoji': '☯️', 'location': 'pingjiang',
        'at': {'area': 'pingjiang/yuanlin', 'x': 5, 'y': 4}, 'types': ['holy'],
        'desc': '城邊山腰上的道觀，住著修道的女冠；觀主玄霜是世家女出家，修的是雙修之道。',
        'scene': '松柏間的道觀清幽寂靜，香爐飄著青煙，女冠們在丹房前的石階上打坐。',
        'visit': {'title': '上香問道', 'desc': '在三清殿前上一炷香，聽女冠講一段道經。', 'money_cc': 5, 'hours': 1, 'effects': [cond('blessed')]},
    },
    # ---------- 瑔州港 ----------
    {
        'id': 'lm_yh_fanfang', 'name': '蕃坊', 'emoji': '🧭', 'location': 'quanzhou',
        'at': {'area': 'quanzhou/fanfang', 'x': 2, 'y': 1}, 'types': ['market', 'harbor'],
        'desc': '外國商人聚居的坊區，西方來的船都在這裡靠岸；潮汐港來的商人哈斯丁在這裡開了一間貨棧。',
        'scene': '各國的語言混在一起，香料、象牙、玻璃器與西方的呢絨堆在碼頭邊，水手們用比手畫腳討價還價。',
        'visit': {'title': '逛異國的攤子', 'desc': '看看西方運來的稀奇貨。', 'hours': 1, 'effects': [cond('cheered')]},
        'explore': {'title': '跟蕃商打聽航路', 'desc': '問問西邊的消息，或是誰的船要出海。', 'attr': 'cha', 'dc': 13, 'hours': 2,
                    'effects': [{'type': 'xp', 'amount': 25}, memory('在瑔州港的蕃坊跟西方來的商人打聽了航路與潮汐港的近況。')]},
        'work': {'attr': 'str', 'dc': 12, 'rate_cc': 4, 'desc': '在碼頭替蕃商卸貨、搬箱子。'},
    },
    {
        'id': 'lm_yh_huji', 'name': '胡記商號', 'emoji': '🦊', 'location': 'quanzhou',
        'at': {'area': 'quanzhou/fanfang', 'x': 8, 'y': 1}, 'types': ['market'],
        'desc': '靈狐族胡記商幫的總號，掛著朝廷皇商的金字招牌，茶引、鹽引、香料的專賣都從這裡出。',
        'scene': '櫃檯後的夥計個個頂著狐耳，算盤打得飛快；後堂飄出一股上等茶葉與沉香的味道。',
        'work': {'attr': 'int', 'dc': 13, 'rate_cc': 5, 'desc': '替胡記點貨、對帳。'},
    },
    {
        'id': 'lm_yh_jinyu', 'name': '金玉行', 'emoji': '💰', 'location': 'quanzhou',
        'at': {'area': 'quanzhou/shibo', 'x': 6, 'y': 1}, 'types': ['market', 'harbor'],
        'desc': '金黃鱗女海商金玉棠的商行，三十艘船的海貨都在這裡進出；金墨盟的人常在後院議事。',
        'scene': '堂上掛著一幅海圖，夥計們搬著珊瑚、玳瑁與南洋的香木進進出出，帳房裡算盤聲不斷。',
        'work': {'attr': 'str', 'dc': 12, 'rate_cc': 4, 'desc': '替金玉行搬運海貨、看守貨倉。'},
    },
    {
        'id': 'lm_yh_shibosi', 'name': '市舶司', 'emoji': '⚓', 'location': 'quanzhou',
        'at': {'area': 'quanzhou/shibo', 'x': 3, 'y': 1}, 'types': ['official', 'harbor'],
        'desc': '管海關與出海手續的官署，提舉程硯夾在胡記與金黃鱗海商之間，誰的船先放行都有人不滿。',
        'scene': '大堂上排著等著蓋印的船主，胥吏翻著厚厚的貨單，門外的告示貼著新的抽分則例。',
        'open': {'official': True},
        'work': {'attr': 'int', 'dc': 12, 'rate_cc': 4, 'desc': '替市舶司抄寫貨單、清點抽分的貨物。'},
    },
    {
        'id': 'lm_yh_gunpowder_works', 'name': '火藥坊', 'emoji': '🧨', 'location': 'quanzhou',
        'at': {'area': 'quanzhou/shibo', 'x': 5, 'y': 5}, 'types': ['workshop'],
        'desc': '爆炸之後在城裡重建的火藥坊，總匠師秦焰帶著學徒造爆竹、霹靂火球與煙火，也教人怎麼看穿機關。',
        'scene': '院子裡曬著一排排硝石，學徒們戴著布罩搗藥，角落裡不時傳來試放爆竹的劈啪聲。',
        'work': {'attr': 'str', 'dc': 13, 'rate_cc': 5, 'desc': '搗硝石、篩硫磺、搬運炭粉（小心火）。'},
    },
    # ---------- 青丘屯 ----------
    {
        'id': 'lm_yh_xiantang', 'name': '仙堂', 'emoji': '🪔', 'location': 'qingqiu',
        'at': {'area': 'qingqiu/main', 'x': 3, 'y': 1}, 'types': ['holy'],
        'desc': '供奉胡家仙的堂口，弟馬胡三娘在這裡替人看事、治病、解冤；二神白小蕎敲著文王鼓唱神調請仙。',
        'scene': '供桌上點著長明燈，胡家仙的牌位一排排擺著，屋裡飄著香火與烈酒的味道，隱約有狐火在樑上晃動。',
        'visit': {'title': '請弟馬看事', 'desc': '付香火錢，請胡家仙替你看看身上沾了什麼。', 'money_cc': 20, 'hours': 1,
                  'effects': [cond('shaken', False), cond('punished', False), cond('blessed')]},
        'interior': 'sm_yh_xiantang_inner',
    },
    {
        'id': 'lm_yh_old_elm', 'name': '老榆樹', 'emoji': '🌳', 'location': 'qingqiu',
        'at': {'area': 'qingqiu/main', 'x': 6, 'y': 4}, 'types': ['monument', 'nature'],
        'desc': '屯口的老榆樹，枝上綁滿許願的紅布條；屯裡有事都在樹下議，屯長胡太爺常坐在這裡抽旱菸。',
        'scene': '粗大的樹幹要三個人才抱得住，紅布條在風裡飄著，樹下的石墩被坐得發亮。',
        'visit': {'title': '綁一條紅布許願', 'desc': '在樹枝上綁一條紅布。', 'money_cc': 2, 'hours': 0.5, 'effects': [cond('cheered')]},
    },
]

SPECIAL_MAPS = {
    'sm_yh_longan_canal': {
        'name': '龍安府的御溝', 'location': 'longan',
        'desc': '龍安府地底的舊排水溝，從皇城一路通到市坊。石砌的拱頂滲著水，運河的水在溝渠裡緩緩流動；私鹽販子、野狗與更糟的東西在這裡出沒，據說還有人從這裡摸進皇城。',
        'lighting': 'dark', 'refresh': True, 'layer': 'shallow',
        'grid': [
            '###########',
            '.M....T...#',
            '#.~~~~~~~.#',
            '#..R.#..M.#',
            '#.~~~~~~~.#',
            '#C....X..S#',
            '###########',
        ],
        'table': [[['jianjing_robber', 2]], [['salt_smuggler', 1], ['jianjing_robber', 1]], [['canal_ghost', 1]], [['stray_dog_pack', 2]]],
        'resources': [1, 1], 'resource_items': ['私鹽', '藥草'],
        'entry': {'x': 0, 'y': 1},
        'connections': [{'at': {'x': 0, 'y': 1}, 'to': {'area': 'longan/shifang', 'x': 0, 'y': 4}}],
    },
    'sm_yh_xuande_tower': {
        'name': '宣德樓的城樓', 'location': 'longan',
        'desc': '皇城正門宣德樓的頂層：重簷下是寬闊的迴廊，四面望得到整座龍安府；天青琉璃瓦在月光下泛青，風大得吹得燈籠直晃。',
        'lighting': 'lit', 'peaceful': True,
        'grid': [
            '###########',
            '#...#.#...#',
            '#.........#',
            '#..#...#..#',
            '#.........#',
            '#####E#####',
        ],
    },
    'sm_yh_chihuan_hold': {
        'name': '赤鬟的走私船艙', 'location': 'quanzhou',
        'desc': '泊在港外的一艘大海船，底艙被走私女王赤鬟改成賭場與黑市：賭桌上賭的是錢，也是人；艙壁後面關著等著賣的貨。',
        'lighting': 'lit', 'peaceful': True,
        'grid': [
            '~~~~~~~~~~~',
            '~#########~',
            '~#.......#~',
            '~#.##.##.#~',
            '~#.......#~',
            '~####E####~',
            '~~~~~~~~~~~',
        ],
        'shops': [{'shop': 'tavern', 'x': 2, 'y': 3}, {'shop': 'general', 'x': 8, 'y': 3}],
    },
    'sm_yh_cangci': {
        'name': '萍園的藏瓷閣', 'location': 'pingjiang',
        'desc': '萍園裡兩層樓的藏瓷閣，一排排博古架上擺著天青瓷：盞、瓶、洗、爐，每一件都有謝青梧手寫的籤條；最裡面的架子上鎖著，說是千窯谷最早的一窯。',
        'lighting': 'lit', 'peaceful': True,
        'grid': [
            '#########',
            '#.#.#.#.#',
            '#.......#',
            '#.#.#.#.#',
            '#.......#',
            '####E####',
        ],
    },
    'sm_yh_xiantang_inner': {
        'name': '仙堂的內堂', 'location': 'qingqiu',
        'desc': '仙堂後面的內堂，是弟馬胡三娘自己的堂口：供桌上擺著胡家仙的牌位與一面文王鼓，炕上鋪著狐皮，牆角掛著一串串乾辣椒與山參。',
        'lighting': 'lit', 'peaceful': True,
        'grid': [
            '#######',
            '#.....#',
            '#.#.#.#',
            '#.....#',
            '###E###',
        ],
    },
}

# 受訓：太學（智力）、靈虛觀（信仰）、胡記（生意）、火藥坊（機關與手藝）
TRAIN = {
    'scholar': 'lm_yh_taixue',
    'devout': 'lm_yh_lingxu',
    'iron_will': 'lm_yh_lingxu',
    'merchant_eye': 'lm_yh_huji',
    'artisan': 'lm_yh_gunpowder_works',
    'trap_sense': 'lm_yh_gunpowder_works',
}


def write_landmarks():
    src = open(LM_PATH, encoding='utf-8').read()
    data = json.loads(src)
    ids = {l['id'] for l in LANDMARKS}
    kept = [l for l in data['landmarks'] if l['id'] not in ids]
    data['landmarks'] = kept + LANDMARKS
    # 檔案是 indent=1 的格式、結尾沒有換行
    open(LM_PATH, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=1))


def write_special_maps():
    src = open(SM_PATH, encoding='utf-8').read()
    data = json.loads(src)
    for k in SPECIAL_MAPS:
        if k in data['maps']:
            # 已經有了：去掉舊的那一段再加
            src = re.sub(r',\n    "%s": \{.*?\n    \}(?=,\n    "|\n  \})' % k, '', src, flags=re.S)
    body = ''
    for k, m in SPECIAL_MAPS.items():
        text = json.dumps(m, ensure_ascii=False, indent=2)
        text = '\n'.join('    ' + line if i else line for i, line in enumerate(text.split('\n')))
        body += ',\n    "%s": %s' % (k, text)
    # 插在最後一張地圖之後（maps 物件的結尾前）
    end = src.rstrip()
    cut = end.rfind('\n  }\n}')
    assert cut > 0
    out = end[:cut] + body + end[cut:] + '\n'
    json.loads(out)
    open(SM_PATH, 'w', encoding='utf-8').write(out)


def write_perks():
    src = open(PERK_PATH, encoding='utf-8').read()
    lines = src.split('\n')
    for perk, cell in TRAIN.items():
        start = next(i for i, l in enumerate(lines) if l.lstrip().startswith('{ "id": "%s"' % perk))
        for i in range(start, start + 6):
            m = re.search(r'"cells": \[([^\]]*)\]', lines[i])
            if m:
                cells = json.loads('[' + m.group(1) + ']')
                if cell not in cells:
                    cells.append(cell)
                lines[i] = lines[i][:m.start()] + '"cells": ' + json.dumps(cells, ensure_ascii=False).replace('","', '", "') + lines[i][m.end():]
                break
        else:
            raise SystemExit(f'{perk} 沒有 train.cells')
    out = '\n'.join(lines)
    json.loads(out)
    open(PERK_PATH, 'w', encoding='utf-8').write(out)


if __name__ == '__main__':
    write_landmarks()
    write_special_maps()
    write_perks()
    print(f'地標 {len(LANDMARKS)}、特殊地圖 {len(SPECIAL_MAPS)}、受訓 {len(TRAIN)}')
