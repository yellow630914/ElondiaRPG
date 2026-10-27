"""第三十批：各地的祭典（worldgen/design/adult-events.md 第 1.2 節第 32 項、第 3.4 節；成人向，只給女性形象與中性的主角）。
祭典本身就有交合：主角被選進祭典，三階段一路往下，第三階段的結尾（每個選項）拿到那條線的獨特色情裝備，每個親密的結果都寫了 scene。
氣氛粗俗、節慶式的淫亂，不談感情；對象是村裡、部落裡、漁村的男人，每個任務都標 male_partner。
- 豐饒祭的巫女（苔語村 → 銀月城，Lv.8～10）：月輝之母要聲望 10 才開放，交合儀式改在銀月城近郊、月輝之母的根延伸到城外的祭林
- 求偶祭（烈日草原・赤鬃部落，Lv.10～12）：族長卡菈主持，不參與
- 潮汐祭（珊瑚灣鎮，Lv.11～13）：潮汐港的潮祭之夜（漣）與滄月闕的挑潮祭（櫻汐）是別的祭典
每條線接下第一個任務時發祭典的服裝，三個任務的任務點都要穿著（DRESS30，形狀和 story_batch26.py 的 DRESS 一樣）。
匯出 BATCH30（任務）、ITEMS30（物品）、NPCS30（固定 NPC）、LANDMARKS30（地標，這一批沒有新的）。
"""
import json
import sys

sys.path.insert(0, 'worldgen/scripts/elondia')
from story_batch26 import aff, mem, money, item, cond, at_npc, at_cell, at_out, out, opt, quest

SEPH, HARU, GANSO = 'npc_seph_fertility', 'npc_haru_redmane', 'npc_ganso_saltbeard'
KARA = 'npc_kara_redmane'
TAGS = ['adult', 'male_partner']


def gear(name, base, material, desc, attrs, mods, unique, price):
    return {"name": name, "category": "equipment", "price_cc": price, "tags": ["unique"], "adult": True, "desc": desc,
            "gear": {"base": base, "material": material, "rarity": "epic", "attrs": attrs, "enchants": {"mods": mods}, "unique": unique}}


ITEMS30 = [
    gear('豐饒祭的花冠', 'hair_ribbon', 'moonsilk',
         '苔語村豐饒祭的巫女戴的花冠，用月影絲把森林裡的白花編在一起，花瓣到現在還沾著祭林裡的露水和別的東西。戴著它的人走在林子裡，路會自己讓開。',
         {"fai": 2}, {"save": 1}, {"check": {"contexts": ["travel", "road"]}, "bonus": 3}, 2600),
    gear('求偶祭的獸牙項鍊', 'choker', 'moonsilk',
         '赤鬃部落求偶祭上，把追到手的獵物「領走」的戰士們，每人拔一顆獸牙串成的項鍊，戴在被領走的人脖子上。戴著它的人，跑起來比誰都快——雖然在祭典上沒什麼用。',
         {"dex": 1, "cha": 1}, {"evade": 1, "crit": 1}, {"check": {"contexts": ["initiative", "retreat"]}, "bonus": 3}, 2800),
    gear('潮汐祭的貝殼腰鍊', 'sash', 'moonsilk',
         '珊瑚灣鎮潮汐祭的「潮之新娘」繫的腰鍊，月影絲上串滿了白色的貝殼，一走路就嘩啦嘩啦響。戴著它的人跟漁夫和商船討價還價，對方總是先低頭。',
         {"cha": 2}, {"save": 1}, {"check": {"kinds": ["bargain", "haggle"]}, "bonus": 3}, 2800),
]

NPCS30 = [
    {"id": SEPH, "name": "瑟芙", "gender": "female", "race": "elf", "class": "", "level": 7, "location": "mosswhisper", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["priest"], "occupation": "豐饒祭的祭司", "landmark": "lm_whispering_ring",
     "personality": "說話直接得嚇人，談交合像在談播種和收成；對祭典的規矩一板一眼，對巫女的羞恥心毫不在意。",
     "appearance": "看不出年紀的精靈女性，深綠色長髮編成粗辮子，赤腳，身上只披著一件繡著藤蔓的亞麻長袍，手裡總拿著一束剛摘的花。",
     "adult_appearance": "長袍底下什麼都沒穿，小腹上用樹汁畫著豐饒的紋樣。",
     "background": "苔語村森語之環的祭司，每年替銀月城的豐饒祭挑選「外族的巫女」：精靈相信外族的身體能把新的血帶進森林，所以巫女要在月輝之母的根下，讓村裡和城裡的男人一個個把種子留在身體裡。她說今年的收成全看巫女撐不撐得住。",
     "relations": {}},
    {"id": HARU, "name": "哈魯", "gender": "male", "race": "catfolk", "class": "", "level": 8, "location": "sunscorch", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["commoner"], "occupation": "求偶祭的祭火人", "landmark": "lm_redmane_council", "lineage": "赤鬃部落",
     "personality": "粗聲粗氣、愛笑、愛起鬨，把求偶祭當成一年裡最好看的一場打獵；嘴上說規矩，眼睛一直往獵物身上瞄。",
     "appearance": "四十歲上下的赤鬃族老戰士，紅鬃毛裡夾著白毛，一隻耳朵缺了半邊，身上塗滿了褪色的求偶紋。",
     "adult_appearance": "老是老了，身上的肌肉還硬得很，下面那條尾巴以外的東西也一樣。",
     "background": "赤鬃部落管篝火的人，負責求偶祭的大小事：替要「被追」的外族人塗求偶紋、在篝火前喊開跑、數誰追到了誰。族長卡菈主持祭典，規矩是他教的：被追到的就是追到的人的，篝火夜裡一個不夠，就一群。",
     "relations": {KARA: "族長。他看著她長大，管不動她，也不想管。"}},
    {"id": GANSO, "name": "岡索", "gender": "male", "race": "human", "class": "", "level": 6, "location": "coral_bay", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["commoner"], "occupation": "漁船的船頭", "landmark": "lm_sea_spirit_shrine",
     "personality": "滿嘴髒話、滿身魚腥，迷信得要命，說大海是個貪吃的娘們，不餵飽她就不給魚。",
     "appearance": "五十歲上下的老漁夫，人稱「老鹽」，鬍子硬得像鹽巴結塊，皮膚曬得跟船板一樣黑，缺了兩根手指。",
     "adult_appearance": "胸口刺著一條纏住女人的海蛇，說是年輕時在潮汐祭上刺的。",
     "background": "珊瑚灣鎮最老的船頭，每年替潮汐祭挑「潮之新娘」：大潮之夜，新娘要在退潮的礁石上獻給大海——大海沒有手腳，所以由全鎮的漁夫代勞。他說只要新娘選得好，一整年都不會翻船。",
     "relations": {"npc_toma_pearl": "老朋友，一起喝了幾十年的酒；托馬老爹每年都說今年不看了，每年都來看。"}},
]

LANDMARKS30 = []

# 祭典的服裝：接下第一個任務時發，三個任務的任務點都要穿著（story_batch1.py 套用 DRESS 時一起套用）
DRESS30 = {
    'fert': ('fert_chosen', ['絲綢透視薄紗睡衣', '絲綢緞帶髮飾'], ['sheer_negligee', 'hair_ribbon'], ['fert_chosen', 'fert_dance', 'fert_rite']),
    'mate': ('mate_paint', ['亞麻裹胸', '亞麻兜襠布'], ['breast_band', 'loincloth'], ['mate_paint', 'mate_chase', 'mate_bonfire']),
    'brine': ('brine_bride', ['絲綢裹胸', '絲綢丁字褲'], ['breast_band', 'thong'], ['brine_bride', 'brine_parade', 'brine_spring']),
}

# ---------------- 豐饒祭的巫女（苔語村 → 銀月城） ----------------
RING = at_cell('mosswhisper', 'lm_whispering_ring')
INN_MOSS = at_cell('mosswhisper', 'inn')
SPRING = at_cell('silvermoon', 'lm_spring_of_life')
GROVE = at_out('silvermoon')
fert = [
    quest('fert_chosen', '外族的巫女', '苔語村的祭司瑟芙在找今年豐饒祭的「外族的巫女」。條件只有一個：身體要經得起村裡的男人檢查。（豐饒祭的巫女・一）',
          'C', SEPH, 8, None,
          '瑟芙把一件薄得透光的紗衣和一條緞帶塞進你手裡：「穿上，別的都脫掉。豐饒祭要一個外族的巫女，森林說今年是你。」她上下打量你，像在挑一頭母鹿，「先讓村裡的長老們檢查身體——巫女要把全村男人的種子都收下來，身子太窄、太嬌的撐不到月亮下山。」',
          [
              {"id": "inspect", "title": "在森語之環讓長老們檢查身體", "kind": "check", "at": RING,
               "text": "你只穿著紗衣站在森語之環的石圈中央，三個精靈長老圍著你轉。瑟芙一聲令下，紗衣被掀到胸口以上：長老們捏你的乳房、掰開你的腿、把手指伸進去量深淺，一邊量一邊用精靈語討論，像在評一塊田的土質好不好。",
               "check": {"attr": "fai", "dc": 14},
               "success": out("你咬著牙一聲不吭地讓他們量完。最老的那個長老抽出沾濕的手指聞了聞，點頭：「這塊地，能種。」瑟芙在你的小腹上畫了一個紋樣。", money(60)),
               "fail": out("量到一半你就腿軟了，濕得一塌糊塗，長老們笑得鬍子都在抖。瑟芙在你的小腹上畫了一個紋樣：「這麼容易濕，好，種子不會漏。」", money(60), cond('aroused'),
                           scene="三個精靈長老在石圈中央「檢查」只穿紗衣的主角：揉捏胸部與乳尖、掰開雙腿、輪流把手指插進主角體內量深淺，主角被玩到雙腿發軟、濕透，長老們一邊摸一邊評論。")},
              {"id": "seed_test", "title": "在苔語村的旅店試種", "kind": "choice", "at": INN_MOSS,
               "text": "瑟芙說檢查還差最後一項：「試種」。旅店的大房間裡，五個村裡的年輕男人已經脫了衣服等著，「看看你一個晚上收得下幾個。收得越多，今年的收成越好。」",
               "options": [
                   opt('一個一個收下來', out("你躺在大房間的草蓆上，讓五個男人一個一個上來，每一個都射在裡面。天亮時瑟芙掀開你的紗衣看了一眼，滿意地說：「五個，一滴都沒漏。你是今年的巫女。」",
                                         mem('在苔語村被選為豐饒祭的外族巫女，通過了長老的身體檢查，一個晚上收下了五個村裡男人的種子。'),
                                         scene="旅店的大房間裡，主角穿著薄紗躺在草蓆上，五個村裡的年輕男人一個接一個壓上來和主角交合，每個人都射在主角體內，瑟芙在旁邊數數，要主角夾緊不准漏出來。")),
                   opt('「五個一起來」', out("你把紗衣撩到腰上，讓五個人一起來。嘴裡一個、下面一個、手裡兩個，剩下那個等不及在你背上蹭。瑟芙看了一整晚，在本子上記了很多東西：「這個巫女，能撐到月亮下山。」",
                                          mem('在苔語村被選為豐饒祭的外族巫女，一個晚上同時應付了五個村裡的男人。'),
                                          scene="主角讓五個村裡的男人同時上：一個插在嘴裡、一個從後面插入、兩手各握一根，第五個在主角背上磨蹭，男人們換了好幾輪位置，全都射在主角身上與體內。")),
               ]},
          ], 200, 500, TAGS, 'fert_1_done'),
    quest('fert_dance', '祭壇前的舞', '豐饒祭的前夜，巫女要在銀月城的生命之泉前跳祈願的舞。跳到一半，看舞的男人可以上來「祈願」。（豐饒祭的巫女・二）',
          'C', SEPH, 9, 'fert_1_done',
          '瑟芙替你在紗衣外面補畫紋樣，從乳頭一路畫到大腿內側：「前夜的舞在銀月城的生命之泉前跳。精靈的規矩，看舞的男人想求今年多子多福，就上來摸巫女一把，摸哪裡都行；求得越誠心的，就不只是摸。」她把緞帶綁到你頭上，「跳到天亮，不准停。」',
          [
              {"id": "dance", "title": "在生命之泉前跳祈願的舞", "kind": "check", "at": SPRING,
               "text": "泉水邊點滿了月光燈，城裡的精靈男人圍成一圈。你赤著腳、穿著透光的紗衣開始跳，每轉一圈就有一隻手伸進來：揉胸、捏屁股、手指從腿間抹過去，有人把泉水潑在你身上，紗衣黏在皮膚上跟沒穿一樣。",
               "check": {"attr": "dex", "dc": 15},
               "success": out("你踩著鼓點一路跳到半夜，被摸遍了也沒亂掉一步。圍觀的精靈把祈願的銀幣丟進泉水裡，嘩啦啦響。", money(120)),
               "fail": out("你被摸得腳步亂了，摔在泉水邊。圍觀的人一擁而上，說是要扶你，扶了很久。", money(80), cond('disheveled'),
                           scene="主角跳舞時摔倒在生命之泉邊，圍觀的精靈男人一擁而上，在濕透的紗衣底下到處撫摸、揉捏主角的胸部與私處，好幾根手指輪流插進主角體內「祈願」。")},
              {"id": "prayer", "title": "收下最誠心的祈願", "kind": "choice", "at": SPRING,
               "text": "天快亮時，鼓聲停了。三個城裡的精靈貴族走進圈子，各自在泉水裡丟了一袋金幣：「我們求的是兒子。」瑟芙對你點點頭——最誠心的祈願，要用巫女的身體還願。",
               "options": [
                   opt('在泉水裡還願', out("你走進及腰的泉水裡，讓三個貴族在水裡輪流抱著你幹，泉水被攪得嘩嘩作響。最後一個射完，瑟芙把泉水舀起來潑在你小腹上：「好，願收下了。」",
                                       money(200), mem('在銀月城生命之泉前跳了豐饒祭前夜的舞，在泉水裡替三個精靈貴族「還願」。'),
                                       scene="主角站在及腰的泉水裡，三個精靈貴族輪流從正面抱起主角、或把主角壓在泉邊的石頭上交合，水花四濺，每個人都射在主角體內，瑟芙最後把泉水潑在主角小腹上。")),
                   opt('跪在泉邊，用嘴還願', out("你跪在泉邊的石頭上，用嘴一個一個替他們還願，吞得乾乾淨淨。其中一個說嘴巴不算數，把你翻過來從後面又還了一次。瑟芙說：「也行。」",
                                             money(200), mem('在銀月城生命之泉前跳了豐饒祭前夜的舞，跪在泉邊替三個精靈貴族「還願」。'),
                                             scene="主角跪在泉邊的石頭上，輪流用嘴服侍三個精靈貴族並把精液吞下，其中一人不滿足，把主角翻過身壓在石頭上從後面插入，射在主角體內才放手。")),
               ]},
          ], 350, 900, TAGS, 'fert_2_done'),
    quest('fert_rite', '月輝之母下的交合', '豐饒祭的正日。月輝之母的根延伸到銀月城外的祭林，巫女要躺在最粗的那條根上，讓森林的男人把種子種進去，直到月亮下山。（豐饒祭的巫女・三）',
          'B', SEPH, 10, 'fert_2_done',
          '瑟芙替你把紗衣解開，只留下頭上的緞帶和小腹上的紋樣：「今晚不用穿了，但緞帶不能拿下來，那是巫女的記號。」她指著城外的祭林，「月輝之母的根在那裡冒出地面，你躺上去，男人們排隊。精靈、人類、迷路的旅人——今晚來的都算數。月亮下山之前，不准合腿。」',
          [
              {"id": "procession", "title": "被抬進城外的祭林", "kind": "story", "at": GROVE,
               "text": "四個精靈男人把一絲不掛的你抬在肩上，穿過城門走進祭林。一路上的男人伸手摸你的腳、你的腿、你的胸，有人邊走邊把手指伸進去「暖地」。祭林中央，一條比人還粗的銀白色樹根從土裡拱起來，上面鋪著花瓣。",
               "success": out("他們把你放上樹根，樹皮暖得像有體溫。林子裡的火把一盞一盞點起來，男人們排成了長長的一列。",
                              scene="四個精靈男人把全裸的主角抬在肩上走進祭林，沿路的男人伸手撫摸主角的腿、胸部與私處，有人一邊走一邊用手指插進主角體內「暖地」，主角被摸得渾身發燙。")},
              {"id": "rite", "title": "在月輝之母的根上收下種子", "kind": "choice", "at": GROVE,
               "text": "瑟芙站在樹根旁，舉起一束白花：「豐饒祭，開始。」第一個男人已經爬了上來。隊伍長得看不到尾巴，月亮才剛升起。",
               "options": [
                   opt('躺著，一個一個收下來', out("你躺在樹根上張著腿，一個男人射完下去，下一個就爬上來，一整夜沒停過。月亮下山時你已經數不清幾個了，小腹被灌得微微鼓起。瑟芙把一頂白花編成的花冠戴到你頭上：「今年的收成，會很好。」",
                                              item('豐饒祭的花冠'), money(300), mem('在銀月城外的祭林，躺在月輝之母的根上當豐饒祭的巫女，一整夜收下了數不清的男人的種子，拿到了豐饒祭的花冠。'),
                                              scene="主角全裸躺在月輝之母銀白色的樹根上張開雙腿，排成長列的男人一個接一個壓上來和主角交合、射在主角體內，一整夜沒有停過，直到主角小腹被灌得微微鼓起，精液沿著樹根往下流。")),
                   opt('騎在樹根上，讓他們一次三個', out("你跨坐在樹根上，前面一個、後面一個、嘴裡一個，隊伍走得比別人快三倍。火把燒完換了兩輪，你還在叫。月亮下山時瑟芙把花冠戴到你頭上，笑得像個看到大豐收的農婦：「三倍的種子，三倍的收成。」",
                                                 item('豐饒祭的花冠'), money(300), mem('在銀月城外的祭林，騎在月輝之母的根上一次應付三個男人，當完了豐饒祭的巫女，拿到了豐饒祭的花冠。'),
                                                 scene="主角跨坐在月輝之母的樹根上，同時被三個男人佔有：一個從下面插入、一個從後面插入、一個插在主角嘴裡，三人射完就換下一組，一整夜輪了好幾十人，主角渾身沾滿精液與花瓣。")),
               ]},
          ], 550, 1300, TAGS, 'fert_done'),
]

# ---------------- 求偶祭（烈日草原・赤鬃部落） ----------------
COUNCIL = at_cell('sunscorch', 'lm_redmane_council')
TAVERN_SUN = at_cell('sunscorch', 'tavern')
PLAIN = at_out('sunscorch')
mate = [
    quest('mate_paint', '求偶紋', '赤鬃部落的求偶祭缺一個「外來的獵物」。祭火人哈魯說，先塗上求偶紋，在篝火前讓戰士們看清楚。（求偶祭・一）',
          'C', HARU, 10, None,
          '哈魯把一條裹胸和一條兜襠布丟給你，咧嘴露出缺了一顆的犬齒：「求偶祭要一隻外來的獵物，族長說你的味道不錯。」他舔了舔手裡的紅色顏料，「先塗紋。塗了求偶紋，就是告訴全部落的公的：這隻可以追。今晚在篝火前站一站，讓他們先看貨。」',
          [
              {"id": "paint", "title": "在赤鬃議帳塗上求偶紋", "kind": "story", "at": COUNCIL,
               "text": "議帳外，哈魯用粗糙的手指沾著紅色顏料，在你身上畫求偶紋：從脖子畫到乳頭繞兩圈，沿著小腹往下，裹胸和兜襠布被他扯開畫了裡面，最後在大腿內側畫了兩道箭頭，指著同一個地方。族長卡菈坐在議帳門口喝酒，看了一眼：「畫得太明白了。」哈魯說：「就是要明白。」",
               "success": out("顏料乾了之後，你身上每一道紋都在說同一句話。路過的戰士一個個停下來看，尾巴豎得筆直。",
                              scene="祭火人哈魯用沾著紅顏料的手指在主角全身畫求偶紋：扯開裹胸在乳頭上繞圈、扯開兜襠布在私處周圍與大腿內側描畫，一邊畫一邊揉捏，畫到主角喘息不止。")},
              {"id": "show", "title": "在篝火前讓戰士們看貨", "kind": "choice", "at": TAVERN_SUN,
               "text": "酒帳前的篝火燒得劈啪響，二十幾個赤鬃戰士圍成一圈。哈魯把你推到火光中間：「轉一圈！讓他們看看明天要追的是什麼。」有人吹口哨，有人已經把手伸了過來。",
               "options": [
                   opt('讓他們摸個夠', out("你在篝火前慢慢轉了一圈，又一圈。戰士們一個個上來摸，摸胸、摸屁股、手指沿著求偶紋的箭頭往下鑽。顏料被摸花了一大片，哈魯一邊罵一邊補。",
                                         mem('在烈日草原塗上了赤鬃部落的求偶紋，在篝火前被戰士們摸了個遍。'),
                                         scene="主角只穿著被扯鬆的裹胸與兜襠布站在篝火中央，二十幾個赤鬃戰士輪流上前撫摸：揉捏胸部、掐屁股、手指順著求偶紋鑽進主角腿間摳弄，摸得主角雙腿發軟。")),
                   opt('挑三個先嚐嚐', out("你指了三個最壯的，把他們拉到篝火後面。哈魯在後面喊犯規，可是沒人理他。回來的時候你身上的求偶紋糊成一片，三個戰士的尾巴都垂著。",
                                          mem('在烈日草原塗上了赤鬃部落的求偶紋，求偶祭前夜就在篝火後面先嚐了三個戰士。'),
                                          scene="主角把三個最壯的赤鬃戰士拉到篝火後面的草地上，三個人輪流把主角壓在地上交合，一個射完換下一個，求偶紋的顏料被汗水和精液糊成一片。")),
               ]},
          ], 250, 700, TAGS, 'mate_1_done'),
    quest('mate_chase', '求偶的追逐', '求偶祭的正午：獵物先跑，戰士們晚一刻出發。被追到的，當場就是追到的人的。（求偶祭・二）',
          'C', HARU, 11, 'mate_1_done',
          '哈魯在你的屁股上拍了一個紅手印：「規矩很簡單。我喊跑，你就跑；數到一百，戰士們出發。被誰追到，就給誰騎，騎完了你可以接著跑——如果你還站得起來。」族長卡菈在議帳前舉起號角，「跑到太陽下山都沒被追到的，有賞。不過，」哈魯笑，「從來沒有人撐到過。」',
          [
              {"id": "run", "title": "在草原上逃", "kind": "check", "at": PLAIN,
               "text": "號角一響，你衝進齊腰的草裡。背後傳來一陣陣吼叫，赤鬃戰士們追上來了，四腳著地跑得比你快得多。草葉刮著你沒什麼遮掩的身體，第一個戰士的影子已經撲到了你旁邊。",
               "check": {"attr": "dex", "dc": 16},
               "success": out("你在草裡繞了好幾個彎，甩掉了前三個。第四個還是撲倒了你——不過已經是下午了，哈魯說這是今年最好看的一場。", money(150)),
               "fail": out("你才跑了一刻鐘就被撲倒在草裡，兜襠布被一把扯掉。", money(80), cond('disheveled'),
                           scene="主角在草原上被第一個追上的赤鬃戰士撲倒在草叢裡，兜襠布被扯掉，戰士從後面把主角按在地上交合，射完後放主角起來繼續跑，沒跑多遠又被下一個撲倒。")},
              {"id": "caught", "title": "被追到之後", "kind": "choice", "at": PLAIN,
               "text": "太陽偏西的時候，你倒在一片被壓平的草地上，身邊圍著五個喘著粗氣的戰士——他們幾乎同時追到，誰也不讓誰。哈魯騎著馬趕到，看了看：「那就一起。」",
               "options": [
                   opt('讓他們排隊', out("五個戰士猜拳排了順序。你趴在草地上，一個騎完換下一個，每一個都比上一個用力。太陽下山時，哈魯把你扛上馬背：「明晚篝火夜，你還有得受。」",
                                       money(200), mem('在赤鬃部落的求偶祭被五個戰士同時追到，在草原上讓他們排隊輪流騎。'),
                                       scene="主角趴在被壓平的草地上，五個赤鬃戰士排好順序，一個接一個從後面騎上來交合，每個人都射在主角體內，太陽下山時主角已經站不起來。")),
                   opt('「全部一起上」', out("你翻過身張開腿：「別猜了，一起來。」五個人同時撲上來，草地上滾成一團。哈魯在旁邊看得直搖尾巴：「這隻獵物比獵人還餓。」",
                                          money(200), mem('在赤鬃部落的求偶祭被五個戰士同時追到，讓他們在草原上一起上。'),
                                          scene="主角在草地上張開雙腿，讓五個赤鬃戰士同時撲上來：前後兩個同時插入、一個插在嘴裡、兩個在主角手裡，五人輪換位置直到全部射在主角身上與體內。")),
               ]},
          ], 400, 1000, TAGS, 'mate_2_done'),
    quest('mate_bonfire', '篝火夜', '求偶祭的最後一晚：所有追到過獵物的戰士圍著最大的篝火，把獵物「領走」——一個一個，或一群。（求偶祭・三）',
          'B', HARU, 12, 'mate_2_done',
          '哈魯替你重新畫上求偶紋，這次畫得更粗、更紅：「篝火夜。追到過你的戰士都會來，一共十一個——還有幾個沒追到、不服氣的。」他把一串空的皮繩掛到你脖子上，「領走你的人，每人在上面串一顆牙。天亮時串滿了，你就是部落的。」族長卡菈在篝火對面舉杯，沒有說話。',
          [
              {"id": "drum", "title": "在篝火前被獻給戰士們", "kind": "story", "at": PLAIN,
               "text": "草原上的篝火燒得比人還高，鼓聲震得地面發抖。哈魯把你推到火堆前的獸皮上，戰士們的眼睛在火光裡發亮。你身上的求偶紋被汗水沖得往下流，一路流到大腿之間。",
               "success": out("鼓聲停了。哈魯喊了一聲，第一個戰士走進了火光。",
                              scene="篝火前，全身畫滿求偶紋的主角跪在獸皮上，鼓聲中被一圈赤鬃戰士圍住，戰士們一邊喝酒一邊伸手撫摸主角，有人把酒倒在主角胸口舔掉。")},
              {"id": "claim", "title": "被戰士們領走", "kind": "choice", "at": PLAIN,
               "text": "戰士們圍成一圈，一個一個脫下了皮甲。哈魯拍了拍你的屁股：「怎麼收，你自己選。」",
               "options": [
                   opt('一個一個來，串滿十一顆牙', out("你躺在獸皮上，讓追到過你的戰士一個一個領走。每一個射完，就從自己的牙串上拔一顆串到你脖子上。天亮時皮繩上串滿了十一顆獸牙，你連手指都抬不起來。哈魯把項鍊扣緊：「現在你是赤鬃的了——至少今年是。」",
                                                   item('求偶祭的獸牙項鍊'), money(300), mem('在赤鬃部落的篝火夜被十一個戰士一個一個領走，脖子上串滿了獸牙。'),
                                                   scene="篝火前的獸皮上，十一個赤鬃戰士一個接一個和主角交合，每人射在主角體內後就在主角脖子的皮繩上串一顆獸牙，一整夜輪完，主角渾身是汗與精液，連手指都抬不起來。")),
                   opt('讓整群一起上', out("你站起來把皮繩丟給哈魯：「不用一個一個。」整群戰士撲了上來，連那幾個沒追到的也擠了進來。篝火燒到熄滅，你在獸皮上被幹到昏過去又醒過來。天亮時哈魯數了數，皮繩上串了十六顆牙：「比追到你的人還多五個。算了，牙是真的就行。」",
                                          item('求偶祭的獸牙項鍊'), money(300), mem('在赤鬃部落的篝火夜讓整群戰士一起上，皮繩上串了十六顆獸牙。'),
                                          scene="主角在篝火前被整群赤鬃戰士同時佔有：好幾根同時插在主角的嘴裡、前面與後面，其他人圍在旁邊等著換位，射在主角臉上、胸口與體內，主角被幹到昏過去又醒來，一直到篝火熄滅。")),
               ]},
          ], 600, 1500, TAGS, 'mate_done'),
]

# ---------------- 潮汐祭（珊瑚灣鎮） ----------------
SHRINE = at_cell('coral_bay', 'lm_sea_spirit_shrine')
DOCKS = at_cell('coral_bay', 'tavern')
REEF = at_out('coral_bay')
brine = [
    quest('brine_bride', '潮之新娘', '珊瑚灣鎮的潮汐祭要選一個「潮之新娘」。老船頭岡索說，新娘先要在海靈祠用海水淨身——淨到大海滿意為止。（潮汐祭・一）',
          'C', GANSO, 11, None,
          '岡索吐了一口菸，把一條白色的裹胸和一條細得像繩子的丁字褲塞給你：「今年的潮之新娘，就你了。大海是個貪吃的娘們，不餵飽她就不給魚。」他用缺了兩根手指的手比劃了一下，「先去海靈祠淨身。淨身嘛——就是讓漁夫們用海水把你裡外都洗一遍。洗乾淨了，才嫁得出去。」',
          [
              {"id": "wash", "title": "在海靈祠用海水淨身", "kind": "check", "at": SHRINE,
               "text": "海靈祠的石台上，你只穿著那兩塊布躺著。漁夫們一桶一桶地把冰冷的海水潑上來，接著是手：抹過胸口、搓過小腹、扯開丁字褲的細繩把手指伸進去「洗裡面」。岡索在旁邊唸祝禱，唸得很慢。",
               "check": {"attr": "fai", "dc": 15},
               "success": out("你閉著眼睛熬過了整段祝禱，一聲都沒出。岡索點點頭：「新娘要穩。大海喜歡穩的。」", money(80)),
               "fail": out("海水太冷、手太熱，你叫出了聲，叫得整座祠堂都聽得見。漁夫們笑成一團。岡索說：「大海也喜歡叫得響的。」", money(80), cond('sensitive'),
                           scene="漁夫們在海靈祠的石台上替主角「淨身」：把冰冷的海水潑在主角身上，用粗糙的手搓揉主角的胸部與乳尖，扯開丁字褲的細繩，手指沾著海水插進主角體內來回洗，主角忍不住叫出聲。")},
              {"id": "ring", "title": "收下漁夫們的聘禮", "kind": "choice", "at": SHRINE,
               "text": "淨完身，岡索說新娘還要收「聘禮」：鎮上七條漁船，每條船派一個人來，各帶一條最好的魚。「魚收下了，人也要收下。這是規矩。」七個曬得黝黑的漁夫在祠堂外排好了隊。",
               "options": [
                   opt('在石台上一條船一條船地收', out("你躺回石台上，七個漁夫一條船一條船地輪流上來，魚堆在祠堂門口，越堆越高。最後一個走的時候，岡索數了數魚：「七條船都下了聘。你嫁得出去了。」",
                                                 money(150), mem('在珊瑚灣鎮的海靈祠被選為潮汐祭的潮之新娘，淨身之後收下了七條漁船的「聘禮」。'),
                                                 scene="海靈祠的石台上，七條漁船派來的漁夫輪流和濕淋淋的主角交合，一個接一個射在主角體內，帶來的魚在祠堂門口越堆越高，岡索在一旁唸祝禱。")),
                   opt('跪在祠堂門口，用嘴收', out("你跪在祠堂門口，讓七個漁夫一個一個用嘴收下他們的「聘禮」，吞不下的流到了魚堆上。岡索嫌棄地搖頭：「浪費。」但還是點了頭。",
                                               money(150), mem('在珊瑚灣鎮的海靈祠被選為潮汐祭的潮之新娘，跪在祠堂門口用嘴收下了七個漁夫的「聘禮」。'),
                                               scene="主角跪在海靈祠門口，七個渾身魚腥的漁夫輪流把東西塞進主角嘴裡，主角一個一個用嘴服侍到他們射出來，吞不下的精液沿著下巴流到門口的魚堆上。")),
               ]},
          ], 300, 800, TAGS, 'brine_1_done'),
    quest('brine_parade', '漁船的遊行', '潮汐祭的白天，潮之新娘要站在領頭的漁船船頭繞港一圈，讓全鎮的人看清楚今年嫁給大海的是什麼樣的身子。（潮汐祭・二）',
          'C', GANSO, 12, 'brine_1_done',
          '岡索把你的裹胸往下拉了一截：「白天的遊行，新娘站船頭，全鎮都會看。大海要知道她拿到的是什麼貨。」他拍了拍船舷，「船上有十二個划槳的，划一圈港要一個時辰——划累了，他們會想歇歇。歇的時候怎麼伺候他們，你懂。」',
          [
              {"id": "prow", "title": "站在領頭的漁船船頭繞港", "kind": "check", "at": DOCKS,
               "text": "你站在船頭，海風把裹胸吹得往上翻，碼頭上擠滿了人，吹口哨的、喊價的、往船上丟貝殼的。每經過一條船，船上的漁夫就伸長了竿子來撩你的丁字褲。你要站穩，不能掉下去——掉下去的新娘不吉利。",
               "check": {"attr": "dex", "dc": 16},
               "success": out("你迎著風站了一整圈，一次都沒晃。碼頭上丟來的貝殼和銅幣堆滿了船頭。", money(150)),
               "fail": out("一根竿子勾住了你的丁字褲，你一個踉蹌，被兩個划槳的漁夫一把抱住——抱住了就沒再放開。", money(100), cond('disheveled'),
                           scene="主角在船頭被竿子勾住丁字褲、失去平衡，被兩個划槳的漁夫抱進船艙，兩人一前一後把主角夾在中間撫摸、交合，船外碼頭上的人吹著口哨看。")},
              {"id": "rest", "title": "在船上伺候划槳的漁夫", "kind": "choice", "at": DOCKS,
               "text": "繞到港口最遠的那一頭，岡索喊了一聲「歇槳」。十二個划槳的漁夫放下槳，一齊轉過頭來看你。船在水上慢慢地晃。",
               "options": [
                   opt('在船艙裡一個一個伺候', out("你鑽進船艙，十二個漁夫一個一個進來歇。船晃一下，你就叫一聲，碼頭上的人聽得清清楚楚。歇完了槳，船繞回港口時，你被抱上船頭再站一次，腿抖得像剛學走路。",
                                               money(250), mem('在潮汐祭的漁船遊行上，在船艙裡一個一個伺候了十二個划槳的漁夫。'),
                                               scene="搖晃的漁船船艙裡，十二個划槳的漁夫一個接一個進來和主角交合，船每晃一下主角就叫出聲，岸上都聽得見，十二個人全射在主角體內後主角被抱回船頭繼續遊行。")),
                   opt('躺在甲板上，讓全港的人看', out("你直接躺在甲板上張開腿，讓漁夫們在全港的人面前輪流上。碼頭上的歡呼聲比過年還響，岡索說這是他看過最好看的一次遊行：「大海這下知道她拿到的是什麼貨了。」",
                                                  money(250), mem('在潮汐祭的漁船遊行上，躺在甲板上當著全港的人讓划槳的漁夫們輪流上。'),
                                                  scene="主角躺在漁船甲板上張開雙腿，十二個划槳的漁夫當著碼頭上全鎮的人輪流和主角交合，有時兩三個一起上，岸上的人歡呼、丟貝殼，一直到船繞回港口。")),
               ]},
          ], 450, 1100, TAGS, 'brine_2_done'),
    quest('brine_spring', '大潮之夜', '潮汐祭的最後一晚是一年裡最大的退潮。潮之新娘要躺在退潮後露出來的礁石上，獻給大海——大海沒有手腳，全鎮的漁夫代勞，一直到潮水漲回來。（潮汐祭・三）',
          'B', GANSO, 13, 'brine_2_done',
          '岡索難得沒有抽菸，把一條串滿白貝殼的腰鍊繫在你的腰上：「今晚是大潮。潮水退到最遠的時候，那塊新娘礁會露出來。你躺上去，全鎮的男人排在礁石上，一直到潮水漲回來淹到你的腰為止。」他咧嘴，「潮水漲得很慢。很、慢。」',
          [
              {"id": "ebb", "title": "走上退潮後露出來的新娘礁", "kind": "story", "at": REEF,
               "text": "月光下，海水退得遠遠的，露出一大片濕滑的黑色礁石。你赤著腳踩過滿地的海藻和貝殼，走到最遠的那塊平坦礁石上。回頭一看，全鎮的漁夫舉著火把，從岸邊一路排到礁石上，排成一條長長的火龍。",
               "success": out("岡索站在礁石邊，舉起一串貝殼往海裡一丟：「大海，新娘來了！」第一個漁夫走上了礁石。",
                              scene="大潮的月光下，主角只穿著裹胸、丁字褲與貝殼腰鍊，赤腳走上退潮後的礁石，岸邊排成長列的漁夫舉著火把盯著主角，第一批漁夫已經伸手拉開主角身上的布料。")},
              {"id": "offering", "title": "把自己獻給大海", "kind": "choice", "at": REEF,
               "text": "潮水在遠處嘩嘩作響，正在一點一點地往回漲。排在礁石上的漁夫多得數不清。岡索在你耳邊說：「潮水淹到你的腰之前，一個都不准少。」",
               "options": [
                   opt('躺在礁石上，等潮水漲回來', out("你躺在冰冷的礁石上，漁夫一個接一個爬上來。潮水漲到你的腳踝時，你已經數不清幾個了；漲到大腿時，你只剩下喘氣的力氣；漲到腰的時候，最後一個漁夫射完，岡索把你從水裡撈起來：「好了，大海吃飽了。今年不會翻船。」腰上的貝殼腰鍊被浸得發亮。",
                                                 item('潮汐祭的貝殼腰鍊'), money(350), mem('在珊瑚灣鎮潮汐祭的大潮之夜，躺在新娘礁上讓全鎮的漁夫輪流上，一直到潮水漲回來，拿到了潮汐祭的貝殼腰鍊。'),
                                                 scene="主角躺在退潮後冰冷的礁石上，全鎮的漁夫一個接一個爬上來和主角交合、射在主角體內，潮水一點一點漲上來，從腳踝淹到大腿再淹到腰，最後一個漁夫射完時主角半泡在海水裡，渾身都是精液與海水。")),
                   opt('跪在礁石上，一次好幾個', out("你跪在礁石上，讓漁夫們一次三四個地圍上來，前後和嘴裡都塞滿了。潮水漲得很慢，可是隊伍消化得很快。潮水淹到腰的時候，岸上已經沒有人在排隊了。岡索搖著頭笑：「大海今年吃撐了。」他把你抱回岸上，腰上的貝殼還在嘩啦嘩啦響。",
                                                item('潮汐祭的貝殼腰鍊'), money(350), mem('在珊瑚灣鎮潮汐祭的大潮之夜，跪在新娘礁上一次應付好幾個漁夫，把全鎮的男人都消化完了，拿到了潮汐祭的貝殼腰鍊。'),
                                                scene="主角跪在退潮的礁石上，漁夫們一次三四個圍上來，同時插在主角的嘴裡、前面與後面，其他人在旁邊等著換，射在主角臉上、背上與體內，潮水漲到主角腰間時全鎮的男人都已經輪過一遍。")),
               ]},
          ], 650, 1600, TAGS, 'brine_done'),
]

BATCH30 = fert + mate + brine


def apply_dress30(batch):
    """把祭典的服裝寫進任務：接下第一個任務時發服裝，三個任務每個非戰鬥的任務點都要穿著"""
    by_id = {q['id']: q for q in batch}
    for pre, (first, items, wear, ids) in DRESS30.items():
        by_id[first]['start']['items'] = items
        for sid in ids:
            for n in by_id[sid]['nodes']:
                if n['kind'] != 'combat': n['wear'] = wear
    return sum(len(v[3]) for v in DRESS30.values())


if __name__ == '__main__':
    stories = json.load(open('data/rules/stories.json'))['stories']
    npcs = json.load(open('data/world/npcs.json'))['npcs']
    lms = json.load(open('data/world/landmarks.json'))['landmarks']
    items = json.load(open('data/rules/items.json'))['items']
    gear_rules = json.load(open('data/rules/gear.json'))
    maps = json.load(open('data/world/maps.json'))
    old_ids = {s['id'] for s in stories}
    npc_ids = {n['id'] for n in npcs}
    npc_names = {n['name'] for n in npcs}
    lm = {l['id']: l for l in lms}
    item_names = {i['name']: i for i in items}
    txt = json.dumps(stories)
    for pre in ('fert', 'mate', 'brine'):
        assert f'"{pre}_' not in txt, pre
    ids = [q['id'] for q in BATCH30]
    assert len(ids) == len(set(ids)) == 9 and not set(ids) & old_ids
    for n in NPCS30:
        assert n['id'] not in npc_ids and n['name'] not in npc_names, n['id']
        assert n['landmark'] in lm and lm[n['landmark']]['location'] == n['location'], n['id']
    new_npcs = {n['id'] for n in NPCS30}
    for i in ITEMS30:
        assert i['name'] not in item_names, i['name']
        b = gear_rules['bases'][i['gear']['base']]
        assert gear_rules['materials'][i['gear']['material']]['kind'] == b['kind'], i['name']
    new_items = {i['name'] for i in ITEMS30}
    leg = maps['legend']

    def cells_of(loc):
        out_ = set()
        for b in maps['maps'][loc]['blocks'] if isinstance(maps['maps'][loc], dict) and 'blocks' in maps['maps'][loc] else maps['maps'][loc]:
            for row in b['grid']:
                for ch in row: out_.add((leg.get(ch) or {}).get('kind'))
        return out_

    apply_dress30(BATCH30)
    for pre, (first, its, wear, qids) in DRESS30.items():
        for name in its: assert name in item_names and not item_names[name]['gear'].get('unique'), name
        for w in wear: assert any(item_names[n]['gear']['base'] == w for n in its), w
    for line, pre in ((fert, 'fert'), (mate, 'mate'), (brine, 'brine')):
        reward = {'fert': '豐饒祭的花冠', 'mate': '求偶祭的獸牙項鍊', 'brine': '潮汐祭的貝殼腰鍊'}[pre]
        for k, q in enumerate(line):
            assert q['tags'] == TAGS and q['start']['pc_body'] == ['fem', 'andro'], q['id']
            assert q['start']['npc'] in new_npcs
            req = q['start'].get('requires', {}).get('flags')
            assert req == ([f'{pre}_{k}_done'] if k else None), (q['id'], req)
            assert len(q['title']) <= 40 and len(q['summary']) <= 300 and len(q['start']['text']) <= 400, q['id']
            for n in q['nodes']:
                assert len(n['title']) <= 40 and len(n['text']) <= 400, (q['id'], n['id'])
                at = n['at']
                if at['where'] == 'cell':
                    c = at['cell']
                    assert (c in lm and lm[c]['location'] == at['location'] and not lm[c].get('open', {}).get('min_reputation')) or c in cells_of(at['location']), (q['id'], c)
                for o in [n.get('success'), n.get('fail')] + [x.get(k2) for x in n.get('options', []) for k2 in ('success', 'fail')]:
                    if not o: continue
                    assert len(o['text']) <= 400 and len(o.get('scene', '')) <= 300, (q['id'], n['id'])
                    if o.get('scene'): assert '主角' in o['scene'], (q['id'], n['id'])
                    for e in o.get('effects', []):
                        if e['type'] == 'item': assert e['name'] in new_items or e['name'] in item_names
                        if e['type'] == 'affinity': assert e['npc'] in npc_ids | new_npcs
                for x in n.get('options', []): assert len(x['label']) <= 30, x['label']
            last = q['nodes'][-1]
            assert last['kind'] == 'choice'
            done = f'{pre}_done' if k == 2 else f'{pre}_{k + 1}_done'
            for x in last['options']:
                s = x['success']
                assert s.get('scene') and s['complete'] and s['set_flags'] == [done], (q['id'], x['label'])
                if k == 2: assert {'type': 'item', 'name': reward, 'qty': 1} in s['effects'], (q['id'], x['label'])
            for n in q['nodes']: assert n['wear'] == DRESS30[pre][2]
        assert 'items' in line[0]['start']
    print('batch30 ok:', len(BATCH30), 'quests,', len(ITEMS30), 'items,', len(NPCS30), 'npcs')
