"""第二十六批（worldgen/design/adult-events.md 第 3.3、3.4 節）：打工的任務線需要的物品、固定 NPC 與地標。任務本身在 story_batch26.py。
- 五件獨特的色情裝備（成人向、不能賣）：看板娘的圍裙、黃金骰子的兔女郎裝、伯爵府的女僕裝、實驗用的魔導項圈、夜之舞孃的腳鍊
- 新的固定 NPC（成人向）：黃金骰子賭場的老闆維克托、克勞澤伯爵與少爺盧卡斯、怪人魔導師希爾德加德、沙堡營地的舞孃娜希拉
- 新的地標：阿爾貝納的黃金骰子賭場、萊茵堡的克勞澤伯爵府、晨光城的怪人之塔
可以重跑（先拿掉同名、同 id 的再加回去）。在 repo 根目錄執行。
"""
import json, sys
sys.path.insert(0, 'worldgen/scripts/elondia')
from npcfmt import write as write_npcs


def gear(name, base, material, desc, attrs, mods, unique, price):
    return {"name": name, "category": "equipment", "price_cc": price, "tags": ["unique"], "adult": True, "desc": desc,
            "gear": {"base": base, "material": material, "rarity": "epic", "attrs": attrs, "enchants": {"mods": mods}, "unique": unique}}


ITEMS = [
    gear('看板娘的圍裙', 'dress', 'moonsilk',
         '銀鱗旅店代代相傳的看板娘制服：短得過分的裙擺、綁得緊緊的白圍裙。穿上它的人，連醉漢都會乖乖聽話。',
         {"cha": 2}, {"evade": 1}, {"check": {"kinds": ["chat", "flatter", "work"]}, "bonus": 3}, 2400),
    gear('黃金骰子的兔女郎裝', 'bunny_suit', 'moonsilk',
         '黃金骰子賭場的頭牌兔女郎才能穿的金黑色兔女郎裝。據說穿著它的人擲出的骰子，總是比別人大一點。',
         {"cha": 1, "dex": 1}, {"crit": 1}, {"check": {"kinds": ["haggle", "bargain", "negotiation"]}, "bonus": 3}, 2600),
    gear('伯爵府的女僕裝', 'lewd_maid', 'moonsilk',
         '克勞澤伯爵府專屬的女僕裝，裙擺短、領口低，袖口繡著伯爵家的紋章。貴族們看到這身衣服，態度都會軟下來。',
         {"cha": 1, "fai": 1}, {"save": 1}, {"check": {"vs_tags": ["noble"]}, "bonus": 3}, 2800),
    gear('實驗用的魔導項圈', 'lace_choker', 'moonsilk',
         '希爾德加德用來記錄「魔力的直接交換」的黑色蕾絲項圈，中央的墜子是一顆會發熱的魔晶。戴著它的人，咒文會變得異常順口。',
         {"int": 2}, {"save": 1}, {"check": {"attrs": ["int"]}, "bonus": 3}, 2600),
    gear('夜之舞孃的腳鍊', 'anklet_bell', 'gold',
         '沙痕部落的舞孃代代相傳的金鈴腳鍊，只有跳過「只有一位觀眾的夜間表演」的人才能戴。鈴聲一響，所有人的目光都會跟著腳步走。',
         {"dex": 1, "cha": 1}, {"evade": 2}, {"check": {"kinds": ["work", "flatter"]}, "bonus": 3}, 2600),
]

NPCS = [
    {"id": "npc_victor_dice", "name": "維克托", "gender": "male", "race": "human", "class": "", "level": 9, "location": "albena", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["merchant"], "occupation": "賭場老闆", "landmark": "lm_golden_dice",
     "personality": "笑容可掬、說話永遠客客氣氣，心裡卻每一分每一秒都在算帳；賭場的規矩比命還重要，壞了規矩的人會在河裡被撈起來。對手下的兔女郎們出奇地講信用。",
     "appearance": "四十來歲的高大男人，梳著油亮的背頭，笑起來露出一顆金牙；永遠穿著剪裁合身的黑色禮服，指間轉著一枚金色的骰子。",
     "adult_appearance": "禮服底下是保養得很好的結實身材，胸口刺著一對骰子的刺青。",
     "background": "黃金骰子賭場的老闆，人稱「金牙」維克托。二十年前在碼頭擲骰子贏下第一間賭坊，如今聯邦的商會會長都要來他的貴賓室玩兩把。賭場的兔女郎是他的招牌，也是他最寶貝的「籌碼」。",
     "relations": {}},
    {"id": "npc_count_krause", "name": "奧圖・馮・克勞澤", "gender": "male", "race": "human", "class": "", "level": 8, "location": "rhineburg", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["noble"], "occupation": "伯爵", "landmark": "lm_krause_manor",
     "personality": "威嚴、講究禮儀，對下人的要求一絲不苟；私底下寂寞又貪戀溫存，在浴室與寢室裡是另一個人。",
     "appearance": "五十歲上下的帝國伯爵，灰白的鬍子修剪得整整齊齊，背挺得像一把劍；左臉有一道舊戰傷。",
     "adult_appearance": "退役軍人的身材還沒走樣，肩背寬厚，身上留著好幾道戰場上的疤。",
     "background": "克勞澤伯爵，第一軍團退役的騎兵將領，夫人五年前病逝。伯爵府的女僕一個接一個地辭職，管家說是因為「規矩太多」；城裡的人說，是因為少爺。",
     "relations": {"npc_lukas_krause": "唯一的兒子。管不動，也捨不得管。"}},
    {"id": "npc_lukas_krause", "name": "盧卡斯・馮・克勞澤", "gender": "male", "race": "human", "class": "", "level": 3, "location": "rhineburg", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["noble"], "occupation": "伯爵家的少爺", "landmark": "lm_krause_manor",
     "personality": "被寵壞的惡作劇少爺，愛掀女僕的裙子、愛看人臉紅；被認真對待時卻會手足無措，其實很怕寂寞。",
     "appearance": "十九歲的金髮少年，長得像母親，漂亮得有點女氣；總是穿著敞開領口的白襯衫。",
     "adult_appearance": "看起來纖瘦，脫了衣服卻意外地結實。",
     "background": "克勞澤伯爵的獨子，下個月就要滿二十歲、辦成年禮。母親過世之後，他用惡作劇把伯爵府的女僕一個一個趕走，像是在測試誰會留下來。",
     "relations": {"npc_count_krause": "父親。很少說話，說了就是吵架。"}},
    {"id": "npc_hildegard", "name": "希爾德加德", "gender": "female", "race": "elf", "class": "wizard", "level": 12, "location": "dawnlight", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "adventurer", "tags": ["traveler"], "occupation": "怪人魔導師", "landmark": "lm_odd_tower",
     "personality": "滿腦子只有研究的怪人，說話飛快、毫無羞恥心，叫人脫衣服就像叫人伸手量脈搏；興奮起來會忘記自己也是有身體的人。對受試者意外地體貼。",
     "appearance": "看不出年紀的精靈女性，銀白長髮亂糟糟地紮成一束，戴著好幾層鏡片的眼鏡；法袍底下什麼都不穿，袖子沾滿了藥漬。",
     "adult_appearance": "纖細的身體上畫滿了測量用的魔力刻度線，從鎖骨一路畫到大腿內側——她說是為了方便自己當受試者。",
     "background": "晨光城郊外怪人之塔的主人，研究「魔力與快感的關係」三百年，被每一所魔導學院列為拒絕往來戶。她付的報酬很好，受試者卻很少來第二次——不是因為痛，是因為太舒服，回不去正常的生活。",
     "relations": {"npc_camilla": "研究的方向很像，可是她嫌卡蜜拉「太溫柔，數據不夠乾淨」。"}},
    {"id": "npc_nashira", "name": "娜希拉", "gender": "female", "race": "catfolk", "class": "", "level": 9, "location": "sandcastle", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["merchant"], "occupation": "舞孃", "landmark": "lm_tent_ring_bazaar", "lineage": "沙痕部落",
     "personality": "慵懶、性感、愛逗人，舞台下說話像在打呵欠，一上台就像換了一個人；把舞蹈當成信仰，對偷懶的徒弟毫不留情。",
     "appearance": "二十八歲的貓魅族舞孃，黑豹般的深色毛皮與琥珀色的眼睛，身材修長；全身只有薄紗、金幣串與腳踝上的一串金鈴。",
     "adult_appearance": "腰間與大腿內側紋著部落的舞紋，跳舞時會隨著汗水發亮。",
     "background": "帳環市集最有名的舞孃，蕾伊拉入行時的師姊。沙痕部落的舞孃有一個古老的傳統：只有跳過「只有一位觀眾的夜間表演」的人，才能戴上祖傳的金鈴腳鍊。她在等一個能接下那串腳鍊的人。",
     "relations": {"npc_leila": "師妹。跑去東海找什麼祕寶，信都不寫一封。"}},
]

LANDMARKS = [
    {"id": "lm_golden_dice", "name": "黃金骰子賭場", "emoji": "🎲", "location": "albena", "at": {"area": "albena/market", "x": 3, "y": 5},
     "types": ["market"], "desc": "聯邦市集最大的賭場，金色的大門上掛著一對骰子。兔女郎在賭桌之間穿梭，貴賓室的門後傳來籌碼的聲音。",
     "scene": "水晶吊燈下煙霧繚繞，骰子聲、輪盤聲與笑聲混在一起；穿著兔女郎裝的女孩們端著酒，在客人的手之間穿梭。",
     "open": {"hours": "night", "adult": True}},
    {"id": "lm_krause_manor", "name": "克勞澤伯爵府", "emoji": "🏰", "location": "rhineburg", "at": {"area": "rhineburg/noble", "x": 1, "y": 1},
     "types": ["official"], "desc": "貴族區角落一座灰色的老宅，門口貼著一張已經發黃的告示：誠徵見習女僕，待遇從優。",
     "scene": "擦得發亮的走廊空蕩蕩的，牆上掛著伯爵夫人的畫像；遠處傳來少爺的笑聲，和一個女僕摔門而出的聲音。",
     "open": {"adult": True}},
    {"id": "lm_odd_tower", "name": "怪人之塔", "emoji": "🔮", "location": "dawnlight", "at": {"area": "dawnlight/gate", "x": 5, "y": 1},
     "types": ["market"], "desc": "晨曦門邊一座歪歪斜斜的細塔，門口的牌子寫著：誠徵受試者，報酬優渥，不問經驗。底下用很小的字寫著：會脫衣服。",
     "scene": "塔裡堆滿了發光的瓶罐與奇形怪狀的魔導具，空氣裡有薄荷、硫磺與一點點甜膩的味道。",
     "open": {"adult": True}},
]


def write():
    # 物品：接在吊帶舞孃的吊襪內褲後面
    P = 'data/rules/items.json'
    names = {i['name'] for i in ITEMS}
    lines = [l for l in open(P).read().split('\n') if not any(f'"name": "{n}"' in l for n in names)]
    anchor = next(i for i, l in enumerate(lines) if '"name": "吊帶舞孃的吊襪內褲"' in l)
    s = '\n'.join(lines[:anchor + 1] + ['    ' + json.dumps(i, ensure_ascii=False) + ',' for i in ITEMS] + lines[anchor + 1:])
    assert sum(1 for i in json.loads(s)['items'] if i['name'] in names) == len(ITEMS)
    open(P, 'w').write(s)
    # 固定 NPC：接在最後
    N = 'data/world/npcs.json'
    base = json.load(open(N))
    ids = {n['id'] for n in NPCS}
    # 格蕾塔是看板娘任務線的委託人：和其他任務線用到的固定 NPC 一樣，不能被偷襲
    for n in base['npcs']:
        if n['id'] == 'npc_greta_silverscale': n['no_attack'] = True
    write_npcs(N, base, [n for n in base['npcs'] if n['id'] not in ids] + NPCS)
    # 地標：接在最後
    L = 'data/world/landmarks.json'
    d = json.load(open(L))
    ids = {l['id'] for l in LANDMARKS}
    d['landmarks'] = [l for l in d['landmarks'] if l['id'] not in ids] + LANDMARKS
    open(L, 'w').write(json.dumps(d, ensure_ascii=False, indent=1))
    print('work items', len(ITEMS), 'npcs', len(NPCS), 'landmarks', len(LANDMARKS))


if __name__ == '__main__':
    write()
