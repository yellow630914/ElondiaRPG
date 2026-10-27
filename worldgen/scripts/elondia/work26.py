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
         '沙痕部落的舞孃代代相傳的金鈴腳鍊，只有在夜間表演裡侍奉過整個帳篷客人的舞孃才能戴。鈴聲一響，所有男人的目光都會跟著腳步走。',
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
     "personality": "威嚴、講究禮儀，對下人的要求一絲不苟；私底下好色又專橫，把女僕當成府裡的家具，在浴室與寢室裡只管自己舒服。",
     "appearance": "五十歲上下的帝國伯爵，灰白的鬍子修剪得整整齊齊，背挺得像一把劍；左臉有一道舊戰傷。",
     "adult_appearance": "退役軍人的身材還沒走樣，肩背寬厚，身上留著好幾道戰場上的疤。",
     "background": "克勞澤伯爵，第一軍團退役的騎兵將領，夫人五年前病逝。伯爵府的女僕一個接一個地辭職，管家說是因為「規矩太多」；城裡的人說，是因為父子倆都管不住褲襠。",
     "relations": {"npc_lukas_krause": "唯一的兒子。管不動，也捨不得管。"}},
    {"id": "npc_lukas_krause", "name": "盧卡斯・馮・克勞澤", "gender": "male", "race": "human", "class": "", "level": 3, "location": "rhineburg", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["noble"], "occupation": "伯爵家的少爺", "landmark": "lm_krause_manor",
     "personality": "被寵壞的惡作劇少爺，愛掀女僕的裙子、愛看人臉紅；什麼都想要，玩膩了就丟。",
     "appearance": "十九歲的金髮少年，長得像母親，漂亮得有點女氣；總是穿著敞開領口的白襯衫。",
     "adult_appearance": "看起來纖瘦，脫了衣服卻意外地結實。",
     "background": "克勞澤伯爵的獨子，下個月就要滿二十歲、辦成年禮。府裡的女僕被他玩過一輪又一輪，成年禮的那一晚，他要一個「全新的」。",
     "relations": {"npc_count_krause": "父親。很少說話，說了就是吵架。"}},
    {"id": "npc_hildegard", "name": "希爾德加德", "gender": "female", "race": "elf", "class": "wizard", "level": 12, "location": "dawnlight", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "adventurer", "tags": ["traveler"], "occupation": "怪人魔導師", "landmark": "lm_odd_tower",
     "personality": "滿腦子只有研究的怪人，說話飛快、毫無羞恥心，叫人脫衣服就像叫人伸手量脈搏；興奮起來會忘記自己也是有身體的人。對受試者一點都不客氣。",
     "appearance": "看不出年紀的精靈女性，銀白長髮亂糟糟地紮成一束，戴著好幾層鏡片的眼鏡；法袍底下什麼都不穿，袖子沾滿了藥漬。",
     "adult_appearance": "纖細的身體上畫滿了測量用的魔力刻度線，從鎖骨一路畫到大腿內側——她說是為了方便自己當受試者。",
     "background": "晨光城郊外怪人之塔的主人，研究「魔力與快感的關係」三百年，被每一所魔導學院列為拒絕往來戶。她付的報酬很好，受試者卻很少來第二次——不是因為痛，是因為太舒服，回不去正常的生活。",
     "relations": {"npc_camilla": "研究的方向很像，可是她嫌卡蜜拉「太溫柔，數據不夠乾淨」。"}},
    {"id": "npc_nashira", "name": "娜希拉", "gender": "female", "race": "catfolk", "class": "", "level": 9, "location": "sandcastle", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["merchant"], "occupation": "舞孃", "landmark": "lm_tent_ring_bazaar", "lineage": "沙痕部落",
     "personality": "慵懶、性感、愛逗人，舞台下說話像在打呵欠，一上台就像換了一個人；把舞蹈當成信仰，對偷懶的徒弟毫不留情。",
     "appearance": "二十八歲的貓魅族舞孃，黑豹般的深色毛皮與琥珀色的眼睛，身材修長；全身只有薄紗、金幣串與腳踝上的一串金鈴。",
     "adult_appearance": "腰間與大腿內側紋著部落的舞紋，跳舞時會隨著汗水發亮。",
     "background": "帳環市集最有名的舞孃，蕾伊拉入行時的師姊。沙痕部落的舞孃有一個老規矩：白天跳舞收賞錢，夜裡在帳篷裡收真正的價錢；侍奉過整個帳篷客人的舞孃，才能戴上祖傳的金鈴腳鍊。她缺一個新的搭檔。",
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


# ---------------- 打工線完成之後的地標場景（可以重複，預設每 3 天一次） ----------------
# 設計稿（adult-events.md 第 2 節 M4）：自願的打工類用地標場景＋任務線。那條線完成（<前綴>_done）之後，
# 委託人的地標出現一到兩個場景：回去上工、賺錢；有制服的線一樣要穿著（story_batch26.py 的 DRESS）。
M = ['adult', 'male_partner']
MN = ['adult', 'non_virgin', 'male_partner']


def cond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": True}


def work(title, desc, scene, pay, hours, *conds, tags=M, cast=(), aff=0):
    sc = {"title": title, "desc": desc, "scene": scene, "tags": tags, "pc_body": ["fem", "andro"]}
    if cast: sc["cast"] = [{"npc": n} for n in cast]
    sc["hours"] = hours
    sc["effects"] = [{"type": "money", "amount": pay}, *[cond(c) for c in conds]]
    if aff: sc["affinity"] = aff
    return sc


SCENES = {
    'lm_silverscale_inn': ('inn', [
        work('上晚班', '穿著制服端一整晚的酒，客人的手隨便伸。',
             '主角穿著看板娘的制服端了一整晚的酒，屁股和胸口被每一桌的客人摸過一輪；常客照例把主角叫到桌子底下，一個接一個塞進主角嘴裡，打烊時圍裙口袋塞滿了小費。', 120, 4, 'aroused'),
        work('包場的夜', '冒險者包下整間店，你是今晚的獎品。',
             '一隊剛領了賞金的冒險者包下銀鱗旅店，主角被放上長桌當今晚的獎品，整桌的人輪流上，{cast}收完錢也脫了圍裙一起加入；天亮時主角躺在酒漬裡數錢。', 260, 5, 'drained', 'disheveled', tags=MN, cast=['npc_greta_silverscale'], aff=1),
    ]),
    'lm_odd_tower': ('odd', [
        work('當一次受試者', '脫光了讓她測量，再試穿新的試用品。',
             '{cast}叫主角脫光躺上實驗台，一邊在身上畫刻度一邊摸遍全身，再塞進新做的符文玉石，記錄主角高潮幾次、叫得多大聲。', 150, 3, 'sensitive', cast=['npc_hildegard'], aff=1),
        work('法師之屌・改良版', '她又改良了那根魔法造的東西。',
             '{cast}用魔法造出改良過的法師之屌，比上次更粗、會自己動，把主角綁在實驗台上幹到失神，再換成兩根前後一起，一整晚只顧著抄數據。', 220, 4, 'afterglow', 'drained', cast=['npc_hildegard'], aff=1),
    ]),
    'lm_golden_dice': ('dice', [
        work('發牌的夜班', '穿著兔女郎裝發一整晚的牌。',
             '主角穿著兔女郎裝發了一整晚的牌，賭客把籌碼塞進胸口和胯下，贏了錢的就把主角拉到大腿上摸個夠，輸了的拉到桌底下出氣。', 200, 5, 'aroused'),
        work('貴賓室的轉運', '貴賓室今晚手氣不好，要你去轉運。',
             '{cast}把主角推進貴賓室替輸錢的貴賓「轉運」，主角跪在賭桌上被一圈貴賓輪流幹，每幹一個就擲一次骰子，擲到天亮。', 400, 6, 'drained', 'disheveled', cast=['npc_victor_dice']),
    ]),
    'lm_tent_ring_bazaar': ('dance', [
        work('市集的舞', '在市集跳舞，讓人把錢塞進舞衣。',
             '主角穿著薄紗、搖著腳鍊在市集中央跳舞，看熱鬧的男人把錢塞進舞衣裡，手指順便伸進去，跳完一場薄紗底下全是錢和指印。', 150, 3, 'aroused'),
        work('帳篷裡的加場', '和娜希拉一起，在帳篷裡收真正的價錢。',
             '跳完舞，主角和{cast}一起被帶進後面的帳篷，兩個人並排跪著侍奉一整帳篷的客人，輪完一圈換姿勢再來一圈，腳鍊的鈴聲響了一整個下午。', 320, 5, 'drained', tags=MN, cast=['npc_nashira'], aff=1),
    ]),
    'lm_krause_manor': ('maid', [
        work('見習女僕的一天', '掃地被少爺掀裙子，晚上替伯爵洗澡。',
             '主角穿著改造女僕裝打掃了一整天，盧卡斯少爺每經過一次就掀一次裙子、把主角按在牆上玩；晚上替伯爵洗澡，用身體洗，洗到伯爵在浴池裡射了兩次。', 180, 6, 'aroused', cast=['npc_count_krause', 'npc_lukas_krause']),
        work('父子的晚上', '伯爵和少爺今晚都要你。',
             '伯爵和盧卡斯少爺把主角叫進同一間寢室，一個從前面一個從後面，父子倆比誰撐得久，主角被夾在中間幹到天亮，女僕裝撕成了碎布。', 300, 6, 'drained', 'disheveled', cast=['npc_count_krause', 'npc_lukas_krause']),
    ]),
    'lm_pilgrim_bath': ('expo', [
        work('再走一次朝聖大道', '只穿網襪，光著身子走一趟，貝托收賭金。',
             '主角又一次只穿著網襪走上朝聖大道，從澡堂走到聖所，整條街的人吹口哨、伸手摸，{cast}在後面跟著收賭金，走到半路被拉進巷子裡的不止一個。', 150, 3, 'disheveled', 'aroused', cast=['npc_bertho_bath']),
    ]),
    'lm_pearl_bath': ('bath', [
        work('搓背的班', '替水手搓背，哪裡都要搓。',
             '主角只貼著乳貼、穿著丁字褲替一整排水手搓背，搓完背搓前面，客人要哪裡就搓哪裡，最後在石板上用嘴收尾，一個接一個。', 160, 4, 'aroused'),
        work('深池的常客', '常客們在深池等你。',
             '常客們在深池等著，主角一下水就被拖到池中央，水裡一個接一個輪流上，浮上來喘口氣又被按下去，泡到手指發皺。', 300, 5, 'drained', 'sensitive'),
    ]),
    'lm_ironforge_onsen': ('onsen', [
        work('混浴的幫工', '穿著浴衣幫工，客人叫你就要下池。',
             '主角穿著浴衣在溫泉旅館幫工，醉醺醺的礦工一叫就要脫掉浴衣下池，在熱水裡被摸遍、被拉到大腿上坐，一晚下來泡得渾身通紅。', 180, 4, 'aroused'),
        work('礦工的發薪夜', '發薪夜，整座礦場的人都來泡。',
             '發薪夜整座礦場的礦工都擠進溫泉，主角在池邊的石床上被排隊的礦工一個接一個幹，{cast}在旁邊收錢、喊下一個，排到天亮還沒排完。', 320, 6, 'drained', 'disheveled', cast=['npc_grum_kettle']),
    ]),
    'lm_lower_massage': ('massage', [
        work('特別服務', '穿著旗袍按摩，最後一步另外算錢。',
             '主角穿著旗袍替客人按摩，按到最後一步就爬上床，用手、用嘴、用身體收尾，一個客人接一個客人，{cast}在門外數錢。', 170, 4, 'aroused', cast=['npc_hans_fingers']),
        work('三人套餐', '三個客人一起點了你。',
             '三個客人一起點了主角的「三人套餐」，旗袍被掀到腰上，一個在前面一個在後面一個在嘴裡，換了好幾輪位子才付錢走人。', 300, 5, 'drained'),
    ]),
    'lm_nude_atelier': ('paint', [
        work('裸體模特兒', '脫光了站好，讓整間畫室的學徒畫。',
             '主角脫光了站在畫室中央，學徒們說要「確認比例」，一個個走上來摸，畫到一半有人放下畫筆直接上，{cast}只說別動、保持姿勢。', 140, 4, 'aroused', cast=['npc_bartolo_painter']),
        work('畫室的課後', '下課之後，整間畫室一起上。',
             '下課後{cast}鎖上門，主角被按在模特兒台上，整間畫室的學徒輪流上，顏料抹得全身都是，最後畫了一張主角滿身精液的速寫。', 260, 5, 'drained', 'disheveled', cast=['npc_bartolo_painter']),
    ]),
    'lm_blood_trial_ground': ('horn', [
        work('試煉場的賭注', '上場打一場，輸了就是戰團今晚的戰利品。',
             '主角在試煉場和血角的戰士打了一場，故意或不故意地輸了，被扛回戰團的營地當今晚的戰利品，{cast}先上，然後整支戰團輪著來，賞錢丟在主角肚子上。', 260, 5, 'drained', 'disheveled', cast=['npc_kargh_warband']),
    ]),
    'lm_bed_school': ('court', [
        work('見習館的夜課', '魅魔們今晚教新的服侍方法，你當教材。',
             '侍寢見習館的魅魔們把主角當教材，教新來的見習生怎麼服侍男人，主角被一個個客人輪流示範用，魅魔在旁邊講解哪裡要夾緊、哪裡要叫。', 250, 4, 'aroused', 'afterglow'),
        work('宮廷的晚宴', '今晚的宴會，你是主菜。',
             '宮廷的晚宴上主角被端上長桌當主菜，赴宴的貴族輪流享用，{cast}在主位上看著，酒杯一舉就換下一個人。', 450, 6, 'drained', cast=['npc_veronica']),
    ]),
}


def place_work_scenes(lms):
    """把打工的場景放上地標：那條線完成才出現；有制服的線要穿著（整批換掉，可以重跑）"""
    from story_batch26 import DRESS
    by_id = {l['id']: l for l in lms}
    n = 0
    for lid, (pre, scenes) in SCENES.items():
        wear = DRESS[pre][2] if pre in DRESS else None
        out = []
        for sc in scenes:
            sc = {**sc, "requires": {"flags": [f"{pre}_done"]}}
            if wear: sc["wear"] = wear
            out.append(sc)
        by_id[lid]['scenes'] = out
        n += len(out)
    return n


def write():
    # 第二十七、二十八批的打工線（story_batch27.py、story_batch28.py）的裝備、NPC 與地標一起寫
    from story_batch27 import ITEMS27, NPCS27, LANDMARKS27
    from story_batch28 import ITEMS28, NPCS28, LANDMARKS28
    from story_batch29 import ITEMS29, NPCS29, LANDMARKS29
    from story_batch30 import ITEMS30, NPCS30, LANDMARKS30
    ITEMS = globals()['ITEMS'] + ITEMS27 + ITEMS28 + ITEMS29 + ITEMS30
    NPCS = globals()['NPCS'] + NPCS27 + NPCS28 + NPCS29 + NPCS30
    LANDMARKS = globals()['LANDMARKS'] + LANDMARKS27 + LANDMARKS28 + LANDMARKS29 + LANDMARKS30
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
    print('work scenes', place_work_scenes(d['landmarks']))
    open(L, 'w').write(json.dumps(d, ensure_ascii=False, indent=1))
    print('work items', len(ITEMS), 'npcs', len(NPCS), 'landmarks', len(LANDMARKS))


if __name__ == '__main__':
    write()
