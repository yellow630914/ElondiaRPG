"""炎華之地 P6：炎華北原的野外怪物（EAST_CONTENT_PLAN 11.5 節：近郊 Lv.1～2，7 種）與遭遇表。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p6_wild.py（可以重跑；調過的 offense 會保留）
"""

import json
import re

from east_story_io import write_items

H = ['yanhua_north']
MONSTERS = [
    {'id': 'steppe_wolf_pack', 'name': '草原狼群', 'level': 1, 'attrs': {'str': 12, 'dex': 14, 'int': 3, 'fai': 10, 'cha': 5}, 'hp': 21, 'ap': 4,
     'weapon': {'dice': '1d6', 'type': 'piercing', 'attr': 'str'}, 'evade': 1, 'dr': 0, 'abilities': ['wolf_trip'], 'resist': {'cold': -0.25},
     'offense': {'all': -0.5}, 'xp': 30, 'habitats': H, 'loot': [{'item': '草原狼皮', 'chance': 0.8}], 'kind': 'beast',
     'desc': '跟著羊群遷徙的灰狼，三五成群，專挑落單的旅人與小馬下手；草原上的人說，狼是長生天派來點名的。'},
    {'id': 'horse_bandit', 'name': '馬賊', 'level': 2, 'attrs': {'str': 13, 'dex': 13, 'int': 10, 'fai': 8, 'cha': 9}, 'hp': 24, 'ap': 4,
     'weapon': {'dice': '1d8', 'type': 'slashing', 'attr': 'str'}, 'evade': 1, 'dr': 0, 'abilities': ['charge'], 'offense': {'all': -0.5},
     'xp': 50, 'habitats': H, 'money_cc': [10, 35], 'loot': [{'item': '馬賊的彎刀', 'chance': 0.8}], 'kind': 'humanoid', 'armed': True,
     'desc': '沒有部族收留的人馬族，一群人騎著自己的四條腿在茶馬路上打劫，搶完就往草原深處跑，誰也追不上。',
     'girl': {'name': '人馬娘馬賊', 'desc': '成年的人馬族女馬賊，上身是結實的女子，套著一件敞開的皮坎肩，腰下是一副栗色的馬身；揮著彎刀衝過來，搶錢也搶人，看上的旅人會被她一把撈上馬背帶走。'},
     'rut': 'field'},
    {'id': 'snow_leopard', 'name': '雪豹', 'level': 2, 'attrs': {'str': 12, 'dex': 16, 'int': 3, 'fai': 10, 'cha': 8}, 'hp': 22, 'ap': 4,
     'weapon': {'dice': '1d6', 'type': 'slashing', 'attr': 'dex'}, 'evade': 2, 'dr': 0, 'abilities': ['rend'], 'resist': {'cold': -0.5, 'fire': 0.25},
     'offense': {'all': -0.6}, 'xp': 60, 'habitats': H, 'loot': [{'item': '雪豹皮', 'chance': 0.8}], 'kind': 'beast',
     'desc': '從北邊雪山下來覓食的雪豹，灰白的皮毛上綴著黑斑，在雪地裡一動也不動，撲上來的時候已經太遲了。',
     'girl': {'name': '雪豹娘', 'desc': '成年的雪豹娘，一身灰白帶黑斑的軟毛從頸後長到腰際，一條粗長的尾巴比身子還長；冬天冷得受不了時，會鑽進旅人的帳篷裡取暖，順便吃掉帳篷的主人——用另一種吃法。'},
     'rut': 'field'},
    {'id': 'steppe_vulture', 'name': '草原禿鷲', 'level': 1, 'attrs': {'str': 10, 'dex': 14, 'int': 4, 'fai': 10, 'cha': 6}, 'hp': 19, 'ap': 4,
     'weapon': {'dice': '1d6', 'type': 'piercing', 'attr': 'dex'}, 'evade': 2, 'dr': 0, 'abilities': ['rend'], 'offense': {'all': -0.6},
     'xp': 30, 'habitats': H, 'loot': [{'item': '禿鷲羽毛', 'chance': 0.8}], 'kind': 'beast',
     'desc': '在草原上空盤旋的禿鷲，等不到死人時，就自己動手讓人變成死人。',
     'girl': {'name': '鷲娘', 'desc': '成年的鷲娘，雙臂是一對褐色的大翅膀，頸上圍著一圈蓬鬆的白羽，腳是帶鉤爪的鳥足；在天上盤旋著看獵物，看中了就俯衝下來把人按在草地上。'},
     'rut': 'field'},
    {'id': 'sandstorm_spirit', 'name': '沙暴之靈', 'level': 2, 'attrs': {'str': 10, 'dex': 14, 'int': 6, 'fai': 10, 'cha': 6}, 'hp': 24, 'ap': 4,
     'weapon': {'dice': '1d6', 'type': 'bludgeoning', 'attr': 'dex'}, 'evade': 2, 'dr': 0, 'abilities': ['sand_blast'],
     'resist': {'poison': -1, 'piercing': -0.25, 'cold': 0.25}, 'offense': {'all': -0.57}, 'xp': 70, 'habitats': H,
     'loot': [{'item': '沙暴之塵', 'chance': 0.8}], 'kind': 'elemental',
     'desc': '春天草原上捲起的黃沙裡，偶爾有一團沙子自己長出了意志，追著人跑，把人的眼睛、鼻子、嘴巴都塞滿沙。'},
    {'id': 'sheep_spirit', 'name': '綿羊精', 'level': 1, 'attrs': {'str': 11, 'dex': 10, 'int': 6, 'fai': 10, 'cha': 12}, 'hp': 24, 'ap': 3,
     'weapon': {'dice': '1d6', 'type': 'bludgeoning', 'attr': 'str'}, 'evade': 0, 'dr': 1, 'abilities': ['charge'], 'resist': {'cold': -0.5, 'fire': 0.25},
     'offense': {'all': -0.4}, 'xp': 25, 'habitats': H, 'loot': [{'item': '捲羊毛', 'chance': 0.8}], 'kind': 'beast',
     'desc': '從羊群裡走失太久、活成了精的老綿羊，一身捲毛厚得刀砍不進，撞起人來一點都不溫順。',
     'girl': {'name': '羊娘', 'desc': '成年的羊娘，一身蓬鬆的白色捲毛裹到胸口與腰下，頭上一對彎彎的羊角，眼神迷濛；看起來溫吞，抱住了就不放，把人埋進她暖烘烘的捲毛裡揉個不停。'},
     'rut': 'field'},
    {'id': 'white_deer_spirit', 'name': '白鹿精', 'level': 2, 'attrs': {'str': 10, 'dex': 14, 'int': 12, 'fai': 14, 'cha': 15}, 'hp': 23, 'ap': 4,
     'weapon': {'dice': '1d6', 'type': 'psychic', 'attr': 'cha'}, 'evade': 2, 'dr': 0, 'abilities': ['siren_song'],
     'resist': {'psychic': -0.5, 'necrotic': 0.25}, 'offense': {'all': -0.75}, 'xp': 70, 'habitats': H,
     'loot': [{'item': '白鹿角', 'chance': 0.8}], 'kind': 'fey', 'rut': True,
     'desc': '「蒼狼白鹿」的傳說裡，和蒼狼結合生下草原各部的白鹿。草原上偶爾還看得到一頭渾身雪白的鹿，看見的人會跟著牠走，走到再也回不來的地方。',
     'girl': {'name': '白鹿娘', 'desc': '成年的白鹿精，化成人形時是個身段修長的女子，頭上一對分岔的白鹿角，耳朵細長，腰下仍是一副雪白的鹿身；溫柔得像月光，引著看見她的人走進草原深處，說要替蒼狼找一個新的伴。'}},
]
LOOT = [
    {'name': '草原狼皮', 'category': 'material', 'price_cc': 6, 'tags': [], 'desc': '灰色的狼皮，草原上的人拿來做皮袍的領子。'},
    {'name': '馬賊的彎刀', 'category': 'material', 'price_cc': 18, 'tags': [], 'desc': '刀身磨得發亮的彎刀，刀柄上纏著搶來的綢子。'},
    {'name': '雪豹皮', 'category': 'material', 'price_cc': 30, 'tags': [], 'desc': '灰白帶黑斑的雪豹皮，暖得很；鷹河榷場的商人搶著收。'},
    {'name': '禿鷲羽毛', 'category': 'material', 'price_cc': 5, 'tags': [], 'desc': '又硬又長的褐色羽毛，渥都干拿來插在占卜的羊骨旁。'},
    {'name': '沙暴之塵', 'category': 'material', 'price_cc': 16, 'tags': [], 'desc': '裝在皮囊裡的一撮黃沙，倒出來的時候會自己打轉。'},
    {'name': '捲羊毛', 'category': 'material', 'price_cc': 8, 'tags': [], 'desc': '一大團又白又軟的捲羊毛，擀成氈子能用好幾年。'},
    {'name': '白鹿角', 'category': 'material', 'price_cc': 24, 'tags': [], 'desc': '雪白的鹿角，摸起來是溫的；渥都干說它能讓夢變得清楚。'},
]
TABLE = [
    [['steppe_wolf_pack', 2]], [['horse_bandit', 1]], [['snow_leopard', 1]], [['steppe_vulture', 2]], [['sandstorm_spirit', 1]],
    [['sheep_spirit', 2]], [['white_deer_spirit', 1]], [['horse_bandit', 1], ['steppe_wolf_pack', 1]], [['steppe_vulture', 1], ['sandstorm_spirit', 1]],
    [['snow_leopard', 1], ['sheep_spirit', 1]], [['white_deer_spirit', 1], ['sheep_spirit', 1]], [['wolf', 2]],
]


def write_monsters():
    p = 'data/rules/enemies.json'
    t = open(p, encoding='utf-8').read()
    data = json.loads(t)
    old = {e['id']: e for e in data['enemies']}
    for m in MONSTERS:
        # 用模擬調過的輸出（tune 之後寫回 offense）保留
        if m['id'] in old and 'offense' in old[m['id']]:
            m['offense'] = old[m['id']]['offense']
        t = re.sub(r'\n    \{"id": "' + m['id'] + r'",.*', '', t)
    t = re.sub(r',(\s*\n\s*\])', r'\1', t)
    anchor = re.search(r'\n    \{"id": "oilpaper_umbrella",.*', t)
    ln = anchor.group(0)
    rows = ''.join(',\n    ' + json.dumps(m, ensure_ascii=False) for m in MONSTERS)
    t = t[:anchor.start()] + ln.rstrip(',') + rows + (',' if ln.endswith(',') else '') + t[anchor.end():]
    # 遭遇表：wild_encounters 的 yanhua_north
    line = '    "yanhua_north": ' + json.dumps(TABLE, ensure_ascii=False)
    if '"yanhua_north": [[' in t:
        t = re.sub(r'    "yanhua_north": \[\[.*?\]\](?=,?\n)', line, t, count=1)
    else:
        m = re.search(r'    "yanhua_south": \[\[.*?\]\](,?)\n', t)
        t = t[:m.start()] + m.group(0).rstrip('\n').rstrip(',') + ',\n' + line + (',' if m.group(1) else '') + '\n' + t[m.end():]
    data = json.loads(t)
    assert data['wild_encounters']['yanhua_north'] == TABLE
    open(p, 'w', encoding='utf-8').write(t)
    print('野外怪物', len(MONSTERS), '種')


if __name__ == '__main__':
    write_items(LOOT, anchor='    { "name": "走私貨物",')
    write_monsters()
