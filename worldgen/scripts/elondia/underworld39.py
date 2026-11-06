# 地下街（docs/SPECIAL_MAPS.md 第 9 節）：有灰色產業的聚落各一張隱藏的特殊地圖，灰色產業的地標擺在裡面。
# 在酒館打聽到（主動行動「打聽地下街」，旗標 underworld:<地點>）之後，從酒館走進去，從出口回到酒館。
#
# 哪些聚落有：有黑市（slavery.json 的 markets[地點].black）或魅氣 3 以上（lewd.json 的 charm，有淫鬥場）的聚落。
# 寫進：
#   data/world/special_maps.json  地下街 sm_uw_<地點>（underworld: true，安全的室內）
#   data/world/landmarks.json     每條地下街的黑市（lm_uw_black_<地點>，black_market: true）與淫鬥場（lm_uw_arena_<地點>，arena: true）；
#                                 把黑檀之夜（索里耶爾）、地下酒館的榮譽洞與月下拍賣會（阿爾貝納）從街上搬進地下街
# 可以重跑：先拿掉上一次寫進去的地圖與地標再寫。要排在 lust_s8.py（月下拍賣會）、work26.py（重寫 landmarks.json）之後。
import json
import re

ARENA_CHARM = 3

slavery = json.load(open('data/rules/slavery.json'))
lewd = json.load(open('data/rules/lewd.json'))
geo = json.load(open('data/world/geography.json'))


def charm(loc):
    c = lewd['charm']
    return max(1, min(4, c['locations'].get(loc['id'], c['regions'].get(loc['region'], 2))))


TOWNS = [l for l in geo['locations'] if l['type'] != 'dungeon']
BLACK = {l['id'] for l in TOWNS if slavery['markets'].get(l['id'], {}).get('black')}
ARENA = {l['id'] for l in TOWNS if charm(l) >= ARENA_CHARM}

# 每條地下街的名稱與給 AI 的描述（外觀、氣氛）
FLAVOR = {
    'albena': ('聯邦市集的地下', '聯邦市集幾間酒館的地窖打通連成一片，自由集市擺不上檯面的買賣都沉到這裡：鐵籠裡的奴隸、戴面具的買家、擂臺邊的賭注與隔間裡的喘息。樑上掛著油燈，守門的打手只認熟面孔。'),
    'soriel': ('港區的地下', '聖河渡口一帶的酒館地窖接著廢棄的舊倉庫，聖環的巡邏隊從不往下看。外環來的奴隸販子在燭光下做生意，更深處是只收熟客的俱樂部，門後傳出燻香與水手的笑聲。'),
    'ashport': ('碼頭底下的黑巷', '碼頭倉庫底下的走道，潮水的腥味混著焦油與汗臭；船上卸下來的貨、人和賭注都在這裡換手。牆上的火把被海風吹得忽明忽暗，每個人說話都壓著嗓子。'),
    'tidehaven': ('下城的走私船塢', '下城區的排水道通到一座藏在礁石後的舊船塢，半沉的貨船改成了貨棧與擂臺；走私的貨與人藏在船艙裡，木板地隨著潮水輕輕晃動。'),
    'quanzhou': ('蕃坊的暗巷', '蕃坊後面錯綜的暗巷與地窖，市舶司管不到的地方：走私船卸下來的人在貨棧裡標價，隔壁的鬥場整夜喧鬧，胡商、海客與龍族的浪人擠在同一張賭桌邊。'),
    'coast_ferry': ('渡口的倉庫地下', '渡口倉庫的地板底下另有一層：堆滿沒有報關的貨箱，最裡面用麻繩圍出一圈擂臺。往來的船工、水手與流浪的傭兵在這裡下注，賭輸的人第二天就搭船走了。'),
    'yinghe': ('榷場的地窖', '榷場後面囤貨的地窖，北原與南域的商人不想讓官府看到的交易都在這裡談；最深處用馬鞍和皮革圍出一圈擂臺，人馬族的漢子們踏著蹄子叫好。'),
    'bloodplume': ('貧民窟的地下城', '血羽城堡底下本來就有一層更老的城，貧民窟的地道通到那裡：魔族的打手在拱門下收過路錢，擂臺邊的看臺坐滿了戴面具的貴族。'),
    'moltenhold': ('熔爐底下的坑道', '廢棄的熔爐坑道又熱又悶，牆上的礦脈透著暗紅的光；工人下了工就往這裡鑽，擂臺邊的賭注用礦石和酒結算。'),
    'shadow_vale': ('谷底的暗市', '陰影之谷谷底終年不見天日的洞窟，幽暗的燐火照著一條窄街；這裡的生意不問來歷，擂臺的沙地上留著洗不掉的痕跡。'),
    'bone_hills': ('骨坑', '荒丘的巨獸骸骨底下挖空的大坑，肋骨像拱頂一樣罩在頭上；部族的戰士在坑底的擂臺上比的不只是力氣。'),
    'silent_tomb': ('墓窖的地下', '寂墓聖堂底下沒有登記在冊的墓窖，石棺被推到牆邊當成看臺；守墓人收了錢就閉上眼睛，擂臺上的喘息在拱頂下迴盪。'),
    'rotmarsh': ('沼底的地窖', '腐沼村高腳屋底下用木樁撐起的地窖，沼氣與燻香混在一起；外來的人很少知道，村裡最熱鬧的地方其實在腳底下。'),
}
assert set(FLAVOR) == BLACK | ARENA, (set(FLAVOR) ^ (BLACK | ARENA))

# 版面：出口在下方中央；地標擺在 SLOTS（依序）
GRID = [
    '#########',
    '#.......#',
    '#.#...#.#',
    '#.......#',
    '#.#...#.#',
    '#.......#',
    '####E####',
]
SLOTS = [(2, 1), (6, 1), (2, 3), (6, 3), (4, 2)]
# 從街上搬進來的地標：地點 → 地標 id（排在黑市、淫鬥場之後）
MOVED = {
    'soriel': ['lm_ebony_night'],
    'albena': ['lm_honor_hole', 'lm_auction_house'],
}
# 搬進來之後改寫的說明（原本寫的是在街上）
MOVED_DESC = {
    'lm_auction_house': '地下街深處一間掛著紅絲絨簾幕的廳堂，每晚舉行不對外宣傳的拍賣會：色情技能書、稀有的淫具，什麼都有人出價。也收寄賣。',
}

BLACK_DESC = '不公開的奴隸買賣：價格比公開市場低，也有精靈這類在公開市場買不到的人，但風險自負；另外每天賣幾件來路不明的獨特裝備（今天的珍品）。'
BLACK_SCENE = '燭光下一排鐵籠，販子壓低聲音報價，戴兜帽的買家掀開籠子的布簾打量貨色。'
ARENA_DESC = '地下的擂臺：淫物場、拘束戰鬥場、性戰場。每贏兩場換更強的對手，輸了連勝歸零；輸了不損失錢，也不會有戰敗事件。'
ARENA_SCENE = '火把圍成一圈，看臺上擠滿下注的人，擂臺的沙地被汗水與體液浸得發黑，叫好聲震得頂上落灰。'


def uw_id(loc):
    return f'sm_uw_{loc}'


def build():
    maps, new_landmarks, moves = {}, [], {}
    for loc in [l['id'] for l in TOWNS if l['id'] in FLAVOR]:
        name, desc = FLAVOR[loc]
        maps[uw_id(loc)] = {'name': name, 'location': loc, 'desc': desc, 'lighting': 'lit', 'peaceful': True, 'underworld': True, 'grid': GRID}
        slots = iter(SLOTS)
        area = f'sm/{uw_id(loc)}'
        if loc in BLACK:
            x, y = next(slots)
            new_landmarks.append({
                'id': f'lm_uw_black_{loc}', 'name': slavery['markets'][loc]['black']['name'], 'emoji': '⛓️', 'location': loc,
                'at': {'area': area, 'x': x, 'y': y}, 'types': ['market'], 'desc': BLACK_DESC, 'scene': BLACK_SCENE, 'black_market': True,
            })
        if loc in ARENA:
            x, y = next(slots)
            new_landmarks.append({
                'id': f'lm_uw_arena_{loc}', 'name': '地下淫鬥場', 'emoji': '🥊', 'location': loc,
                'at': {'area': area, 'x': x, 'y': y}, 'types': ['military'], 'desc': ARENA_DESC, 'scene': ARENA_SCENE,
                'open': {'adult': True}, 'arena': True,
            })
        for lm in MOVED.get(loc, []):
            x, y = next(slots)
            moves[lm] = {'area': area, 'x': x, 'y': y}
    return maps, new_landmarks, moves


def write_maps(maps):
    p = 'data/world/special_maps.json'
    t = open(p).read()
    # 拿掉上一次寫的
    t = re.sub(r',\n    "sm_uw_[a-z_]+": \{.*?\n    \}(?=,\n|\n  \})', '', t, flags=re.S)
    body = ''
    for mid, m in maps.items():
        lines = [f'      "{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in m.items() if k != 'grid']
        grid = '      "grid": [\n' + ',\n'.join(f'        {json.dumps(r)}' for r in m['grid']) + '\n      ]'
        body += f',\n    "{mid}": {{\n' + ',\n'.join(lines + [grid]) + '\n    }'
    end = t.rindex('\n  }\n}')
    t = t[:end] + body + t[end:]
    json.loads(t)
    open(p, 'w').write(t)


def write_landmarks(new_landmarks, moves):
    p = 'data/world/landmarks.json'
    d = json.load(open(p))
    d['landmarks'] = [l for l in d['landmarks'] if not l['id'].startswith('lm_uw_')]
    for l in d['landmarks']:
        if l['id'] in moves:
            l['at'] = moves[l['id']]
            if l['id'] in MOVED_DESC:
                l['desc'] = MOVED_DESC[l['id']]
    d['landmarks'] += new_landmarks
    open(p, 'w').write(json.dumps(d, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    maps, new_landmarks, moves = build()
    write_maps(maps)
    write_landmarks(new_landmarks, moves)
    print('underworld maps', len(maps), 'landmarks', len(new_landmarks), 'moved', len(moves))
    print('black', sorted(BLACK), 'arena', sorted(ARENA))
