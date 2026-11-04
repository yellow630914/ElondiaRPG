# 普通（非成人向）的地下城與近郊事件 54 件（travel_events.json，scope: dungeon；docs/ADULT_EVENTS.md 第 1 節的同一套機制）。
# 和成人向的地下城事件一樣多：採集 19、陷阱 13、寶箱 11、安全房長休 11。
# 寶箱事件在寶箱照常打開之後發生（寫的是寶箱旁邊或底下多出來的東西）；成人向的寶箱事件（擬態寶箱）才會取代寶箱。沒有內容標籤、不限主角體型，
# 關掉成人內容或陽剛體型的主角也會遇到。沒寫 layers 的也會出現在近郊（第 0 層）。
# 可以重跑：先拿掉上一次寫進去的再寫（接在成人向地下城事件的最後一件「遺落的春宮書」後面）。
import json
import re


def drop_lines(text, pattern):
    """拿掉符合 pattern 的整行（一行一筆），再補掉因此留在陣列或物件結尾的逗號"""
    text = re.sub(pattern, '', text)
    return re.sub(r',(\s*\n\s*[\]}])', r'\1', text)


def insert_after(text, anchor, lines):
    """在 anchor（正規表示式，整行）那一行後面接上 lines（一行一筆），補好逗號"""
    m = re.search(anchor, text)
    line = m.group(0)
    tail = ',' if line.endswith(',') else ''
    return text[:m.start()] + line.rstrip(',') + ',\n' + ',\n'.join(lines) + tail + text[m.end():]


def cond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": True}


def give(name, qty=1):
    return {"type": "item", "name": name, "qty": qty}


def money(n):
    return {"type": "money", "amount": n}


def xp(n):
    return {"type": "xp", "amount": n}


def hp(ratio):
    """生命的增減（最大生命的比例；負數是受傷，不會因此倒下）"""
    return {"type": "hp", "target": "pc", "ratio": ratio}


def slot(n=1):
    return {"type": "slot", "target": "pc", "delta": n}


def out(text, *effects, side=None, hours=None):
    return {"text": text, **({"effects": list(effects)} if effects else {}),
            **({"side_map": side} if side else {}), **({"time": {"hours": hours}} if hours else {})}


def opt(label, success, check=None, fail=None):
    o = {"label": label}
    if check:
        o["check"] = {"attr": check[0], "dc": check[1]}
    o["success"] = success
    if check and fail:
        o["fail"] = fail
    return o


def ev(id, title, text, triggers, options, layers=None, dungeons=None, cooldown_days=None):
    return {"id": id, "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": triggers,
            **({"layers": layers} if layers else {}), **({"dungeons": dungeons} if dungeons else {}),
            **({"cooldown_days": cooldown_days} if cooldown_days else {}),
            "title": title, "text": text, "options": options}


DEEP = [1, 2, 3, 4]
MID = [2, 3, 4]
EAST = ['tidefall_cave', 'skull_isle']
WEST = ['quicksand_temple', 'echo_canyon']
NORTH = ['redemption_pit', 'echo_rift', 'giants_spine']
SOUTH = ['ember_rift', 'bloodrock_cave', 'hell_greenhouse']
CRYPT = ['whisper_crypt', 'mist_abbey']
LEAVE = '你決定不碰它，繼續往前走。'

GATHER = [
    ev('dn_herb_patch', '長滿藥草的角落',
       '潮濕的角落長了一大片藥草，葉子底下還藏著幾株少見的品種。',
       ['gather'], [
           opt('仔細挑著採', out('你挑出最好的幾株，連根帶土包好。', give('藥草', 3)),
               ('int', 12), out('你分不太出哪些是好的，只採到一點，手還被葉緣割了幾道。', give('藥草', 1), hp(-0.03))),
           opt('整把拔走', out('你一把一把地拔，收穫不少，只是品相差了點。', give('藥草', 2))),
           opt('只摘嫩芽，留下根', out('你只摘了嫩芽，留下根讓它繼續長——說不定下次還用得上。', give('藥草', 1), xp(10))),
       ]),
    ev('dn_glow_moss', '發光的苔蘚牆',
       '整面岩壁爬滿了發著淡藍光的苔蘚，把這一段通道照得像月夜。',
       ['gather'], [
           opt('刮下一些帶走', out('你小心地刮下幾大片苔蘚，收進罐子裡還在發光。', give('熒光苔蘚', 3)),
               ('dex', 13), out('你踩著濕滑的石頭去搆，腳下一滑摔了一跤，只刮到一小片。', give('熒光苔蘚', 1), hp(-0.05))),
           opt('在這裡歇一會兒', out('藍光很柔和，你靠著岩壁休息了一下，緊繃的肩膀放鬆了。', cond('relaxed'), hours=1)),
           opt('不碰它', out(LEAVE)),
       ], layers=DEEP),
    ev('dn_ore_vein', '露出的礦脈',
       '崩落的岩壁後面露出一道發亮的礦脈，敲一敲就能剝下來。',
       ['gather'], [
           opt('用力敲下來', out('你一鎬一鎬地敲，剝下好幾塊成色不錯的礦石。', give('鐵礦石', 3)),
               ('str', 14), out('岩石比想像中硬，你敲到手臂發麻，只剝下一塊。', give('鐵礦石', 1), cond('drained'))),
           opt('找裂縫撬開', out('你順著裂縫撬，撬出一塊少見的黑鐵礦。', give('黑鐵礦石', 1)),
               ('int', 14), out('你撬錯了地方，只撬出一塊普通的礦石。', give('鐵礦石', 1))),
           opt('記下位置就走', out('你在地圖上做了記號，之後的冒險者也會感謝你。', xp(10))),
       ], layers=DEEP),
    ev('dn_mushroom_ring', '蘑菇圈',
       '一圈蘑菇圍成完美的圓，中間那朵特別大，在黑暗裡微微發光。老人說踏進蘑菇圈的人會被妖精帶走。',
       ['gather'], [
           opt('踏進去採中間那朵', out('什麼事也沒發生。你摘下那朵發光的蘑菇，順手又採了一朵。', give('夜光蘑菇', 2)),
               ('fai', 13), out('你一踏進圈裡就頭暈眼花，回過神來已經坐在圈外，手裡只抓著一朵。', give('夜光蘑菇', 1), cond('dazed'))),
           opt('只採外圈的', out('你只採了外圈的幾朵，沒有踏進去。', give('夜光蘑菇', 1))),
           opt('繞過去', out('你繞了一大圈避開它。小心駛得萬年船。')),
       ]),
    ev('dn_old_camp', '冒險者的舊營地',
       '牆角有一圈燒黑的石頭，旁邊散著空罐子和破布，看得出有人在這裡紮營過。',
       ['gather', 'rest'], [
           opt('翻找留下的東西', out('你在破布底下找到一包沒拆的乾糧和幾卷繃帶。', give('乾糧', 2), give('止血繃帶', 2)),
               ('int', 12), out('大部分都被老鼠啃過了，你只找到一包乾糧。', give('乾糧', 1))),
           opt('生火休息一下', out('你重新點起營火，烤暖了手腳，傷口也舒服多了。', hp(0.2), hours=1)),
           opt('留下一點補給給後來的人', out('你把多的乾糧留在石頭上，刻了個記號。冒險者之間的規矩，你也照做了。', xp(15))),
       ]),
    ev('dn_remains', '冒險者的遺骸',
       '通道邊靠著一具穿著皮甲的遺骸，手裡還握著斷掉的劍，腰間的名牌已經生鏽。',
       ['gather'], [
           opt('替他收屍', out('你把他安葬在碎石底下，唸了幾句禱詞。離開時，你覺得心裡踏實了些。', cond('blessed'), xp(20)),
               ('fai', 12), out('你埋到一半，總覺得背後有視線，回頭卻什麼都沒有。你匆匆唸完禱詞離開了。', cond('shaken'), xp(10))),
           opt('搜他的行囊', out('他的行囊裡有些錢和一張摺好的羊皮紙，上面畫著某處的地圖。', money(30), give('盜墓者的藏寶圖'))),
           opt('帶走名牌，交給公會', out('你收下名牌。公會會通知他的家人——這也是冒險者的責任。', money(20), xp(15))),
       ], layers=DEEP),
    ev('dn_clear_spring', '清澈的泉水',
       '岩縫裡湧出一股清泉，水冰涼清甜，泉底鋪著白色的細沙。',
       ['gather', 'rest'], [
           opt('喝個痛快', out('泉水清涼甘甜，一口下去疲勞消了大半。', hp(0.25)),
               ('fai', 12), out('水是乾淨的，只是太冰了，你喝完肚子一陣絞痛。', hp(-0.03), cond('drained'))),
           opt('洗把臉、整理一下', out('你洗掉臉上的灰塵和血跡，整個人清爽多了。', cond('relaxed'))),
           opt('不喝來路不明的水', out('你只是看了看。在地下城裡，謹慎總是沒錯。')),
       ]),
    ev('dn_crystal_cluster', '共鳴的水晶簇',
       '一簇半透明的水晶從地面長出來，你一靠近，它們就發出細細的嗡鳴。',
       ['gather'], [
           opt('敲下一根', out('你順著紋路一敲，一根完整的水晶落進你手裡，還在輕輕共鳴。', give('共鳴晶體', 1)),
               ('dex', 14), out('水晶碎了，碎片劃過你的手臂。', hp(-0.1))),
           opt('閉上眼睛聆聽', out('嗡鳴裡好像有某種規律。你聽了很久，對這座地下城的構造多了幾分理解。', xp(25)),
               ('int', 13), out('聲音越聽越刺耳，你的腦袋嗡嗡作響。', cond('dazed'))),
           opt('不碰它', out(LEAVE)),
       ], layers=MID),
    ev('dn_berry_bush', '結實纍纍的野莓叢',
       '一叢野莓長得又密又高，枝頭掛滿了紫紅色的果實，就是刺多了點。',
       ['gather'], [
           opt('伸手進去摘', out('你小心地避開刺，摘了滿滿一把。', give('野莓', 6)),
               ('dex', 11), out('刺比想像中多，你的手臂被刮得到處是血痕，只摘到幾顆。', give('野莓', 2), hp(-0.03))),
           opt('只摘外面的', out('外面的果子比較小，但也夠吃了。', give('野莓', 3))),
           opt('邊摘邊吃', out('你一邊摘一邊吃，酸甜的汁水讓人心情都好了起來。', give('野莓', 2), cond('fed_light'))),
       ], layers=[0, 1]),
    ev('dn_slime_pool', '史萊姆的凝膠池',
       '一窪半凝固的綠色膠狀物，表面偶爾冒個泡——是史萊姆留下的，主人似乎不在。',
       ['gather'], [
           opt('舀一些帶走', out('你用罐子舀了好幾罐，煉金術士會出好價錢。', give('史萊姆凝膠', 3)),
               ('dex', 13), out('凝膠黏住了你的靴子，你費了好大功夫才拔出來，衣服沾得一身黏。', give('史萊姆凝膠', 1), cond('disheveled'))),
           opt('用火烤乾再刮', out('烤過的凝膠變得好處理多了，你也順手摸清了史萊姆的習性。', give('史萊姆凝膠', 1), xp(15))),
           opt('繞過去', out(LEAVE)),
       ], layers=[1, 2, 3]),
    ev('dn_buried_cache', '埋在土裡的木箱',
       '你採集時鏟子碰到了硬物——土裡埋著一口釘死的小木箱。',
       ['gather'], [
           opt('挖出來撬開', out('箱子裡是一小袋錢，大概是某個冒險者存的私房錢。', money(60)),
               ('str', 12), out('箱子埋得很深，你挖得滿身大汗，撬開時錢袋已經破了，只剩一些。', money(20), cond('drained'))),
           opt('先檢查有沒有機關', out('果然有一根細線連著箱蓋。你剪斷它，安心地拿走裡面的錢。', money(60), xp(10)),
               ('int', 13), out('你沒看出機關在哪，打開時一根小針扎進了指頭。錢倒是拿到了。', money(60), hp(-0.1))),
           opt('埋回去', out('這是別人的東西。你把土填回去，繼續採集。', xp(5))),
       ]),
    ev('dn_rune_stone', '刻著古符文的石頭',
       '一塊半埋在土裡的石碑，表面刻滿了你不認得的符文，摸上去微微發熱。',
       ['gather'], [
           opt('拓下符文', out('你用紙和炭筆把符文完整地拓了下來，說不定有人看得懂。', give('古墓拓本')),
               ('int', 14), out('拓到一半符文開始發光，紙燒了起來。你什麼也沒拿到，只記住了幾個形狀。', xp(5))),
           opt('敲下一塊碎片', out('你敲下一塊刻著符文的碎片，熱度慢慢退了。', give('古符碎片', 1)),
               ('str', 13), out('碎片是敲下來了，可是你的手一陣刺痛，心裡也毛毛的。', give('古符碎片', 1), cond('shaken'))),
           opt('對它祈禱', out('你不知道它屬於哪位神，但還是虔誠地祈禱。一股暖意流過全身。', cond('blessed')),
               ('fai', 13), out('什麼也沒發生。也許這位神不聽外人的祈禱。')),
       ], layers=MID),
    ev('dn_hidden_crack', '岩壁的裂縫',
       '採集時你發現岩壁後面是空的——一道窄窄的裂縫通往某個沒人去過的洞穴，裡面有風吹出來。',
       ['gather'], [
           opt('鑽進去看看', out('你側著身子擠進裂縫，裡面別有洞天。', side='cave')),
           opt('丟顆石頭聽聽深淺', out('石頭滾了很久才停下來。裡面不小——你記下了這個地方。', xp(10))),
           opt('不冒這個險', out(LEAVE)),
       ], layers=DEEP),
    ev('dn_collapsed_tunnel', '坍塌的舊坑道',
       '碎石堆後面是一條被封住的舊坑道，木頭支架還在，看得到裡面有石砌的牆——好像是更古老的遺跡。',
       ['gather'], [
           opt('清開入口進去', out('你搬開碎石，鑽進了這片被遺忘的遺跡。', side='ruins'),
               ('str', 14), out('碎石又塌了下來，砸在你身上。入口還是被堵著。', hp(-0.1))),
           opt('從縫隙往裡看', out('裡面黑漆漆的，只看得到幾根倒塌的柱子。你記下了位置。', xp(10))),
           opt('不冒這個險', out(LEAVE)),
       ], layers=MID),
    ev('dn_tide_pool', '退潮的岩礁',
       '潮水退了，岩礁之間留下一窪窪水潭，螃蟹在裡面橫著走，貝殼閃著珍珠色的光。',
       ['gather'], [
           opt('抓螃蟹', out('你抓了好幾隻大螃蟹，蟹螯硬得能做成工具。', give('岸礁蟹螯', 2)),
               ('dex', 13), out('螃蟹夾住了你的手指，痛得你差點叫出來，最後只抓到一隻。', give('岸礁蟹螯', 1), hp(-0.05))),
           opt('撿貝殼', out('你撿了一袋漂亮的貝殼，城裡的工匠會收。', money(25))),
           opt('趁潮水回來前離開', out('潮聲越來越近，你沒有多逗留。')),
       ], dungeons=EAST),
    ev('dn_sand_jar', '沙裡露出的陶罐',
       '風把沙吹開，露出一個封著口的陶罐，罐身上畫著古代的祭祀圖案。',
       ['gather'], [
           opt('挖出來打開', out('罐子裡裝著幾件陪葬的金飾，在陽光下閃閃發亮。', give('陪葬金飾', 1), money(20)),
               ('str', 12), out('沙底下藏著一隻蠍子，螫了你一下。罐子裡倒是有一件金飾。', give('陪葬金飾', 1), hp(-0.1))),
           opt('原樣埋回去', out('這是別人的祭品。你把沙推回去，心裡覺得踏實。', cond('blessed'))),
           opt('不碰它', out(LEAVE)),
       ], dungeons=WEST),
    ev('dn_frozen_wolf', '冰層下的雪狼',
       '冰層底下凍著一隻完整的雪狼，毛皮一點也沒壞，就像睡著了一樣。',
       ['gather'], [
           opt('鑿開冰層取毛皮', out('你花了不少力氣鑿開冰，剝下兩張上好的毛皮。', give('雪狼毛皮', 2)),
               ('str', 13), out('冰太硬了，你鑿到手都凍僵了，只剝下一張。', give('雪狼毛皮', 1), cond('drained'))),
           opt('生火慢慢融', out('火融開了冰，你剝下一張完整的毛皮，順便烤暖了身子。', give('雪狼毛皮', 1), cond('relaxed'), hours=2)),
           opt('讓牠安息', out('你看了牠一會兒，轉身離開。')),
       ], dungeons=NORTH),
    ev('dn_sulfur_vent', '冒煙的硫磺口',
       '地上的裂口不停冒出黃色的煙，口邊結了一層亮黃色的結晶，空氣裡全是臭雞蛋的味道。',
       ['gather'], [
           opt('小心地採結晶', out('你掩著口鼻，敲下好幾塊漂亮的硫磺結晶。', give('硫磺結晶', 2)),
               ('dex', 14), out('一股熱煙噴了出來，燙得你往後跳。', give('硫磺結晶', 1), hp(-0.1))),
           opt('屏住氣快採快走', out('你一口氣敲下一塊就退開了。', give('硫磺結晶', 1)),
               ('str', 12), out('憋不住吸了一口，嗆得你頭昏腦脹。', cond('dazed'))),
           opt('離它遠一點', out('你繞開了那片黃煙。')),
       ], dungeons=SOUTH),
    ev('dn_grave_goods', '散落的陪葬品',
       '倒塌的墓室裡，陪葬品散了一地：生鏽的燭台、碎掉的陶碗，還有幾件沒被拿走的金飾。',
       ['gather'], [
           opt('撿走金飾', out('你撿起金飾，墓室裡安安靜靜的，什麼事也沒發生。', give('陪葬金飾', 2)),
               ('fai', 13), out('你一碰到金飾，耳邊就響起一聲嘆息。你抓了一件就跑。', give('陪葬金飾', 1), cond('shaken'))),
           opt('把它們放回原位', out('你把陪葬品一件件擺回去，還替墓主唸了幾句禱詞。', cond('blessed'), xp(10))),
           opt('不碰它', out(LEAVE)),
       ], dungeons=CRYPT),
]

TRAPS = [
    ev('dn_pit', '落穴',
       '腳下的石板突然一翻——底下是黑漆漆的坑洞。',
       ['trap'], [
           opt('抓住坑邊', out('你在最後一刻抓住了坑邊，翻身爬了上來，心臟還在狂跳。', xp(5)),
               ('dex', 13), out('你沒抓住，摔進坑底，爬上來時全身瘀青。', hp(-0.15))),
           opt('用武器卡住坑壁', out('你把武器往坑壁一插，硬是撐住了身子。', xp(10)),
               ('str', 13), out('武器滑了一下，你還是摔了下去。', hp(-0.15))),
       ]),
    ev('dn_dart_wall', '毒鏢牆',
       '牆上的小孔「嗤嗤」作響，一排細小的飛鏢朝你射來。',
       ['trap'], [
           opt('翻滾躲開', out('你在地上一滾，飛鏢全釘在你身後的牆上。', xp(10)),
               ('dex', 14), out('一根飛鏢擦過你的手臂，傷口很快就麻了。', hp(-0.1), cond('drained'))),
           opt('舉起手臂護住要害', out('飛鏢扎在你的護臂上，只有一根刺進了肉裡。', hp(-0.05))),
       ], layers=DEEP),
    ev('dn_rolling_boulder', '滾石',
       '頭頂傳來轟隆聲——一顆大石球從斜坡上滾了下來。',
       ['trap'], [
           opt('往側邊撲', out('你撲進牆邊的凹槽，石球從你身邊轟然滾過。', xp(10)),
               ('dex', 13), out('你慢了一步，被石球擦過，整個人被撞飛出去。', hp(-0.2))),
           opt('頂住它', out('你用肩膀頂住石球，硬是讓它停了下來。連你自己都不敢相信。', xp(25)),
               ('str', 16), out('石球太重了，你被壓倒在地，好不容易才爬出來。', hp(-0.25))),
       ], layers=DEEP),
    ev('dn_net_trap', '捕獸網',
       '一張大網從頭頂罩下來，把你整個人網住了。',
       ['trap'], [
           opt('割開網子', out('你抽出小刀，三兩下割開網子。網子的繩子還不錯，你收了起來。', give('麻繩（50 呎）')),
               ('dex', 12), out('越掙扎網子纏得越緊，你花了快一個小時才脫身。', cond('drained'), hours=1)),
           opt('找出網子的結', out('你冷靜下來找到繩結，一拉就鬆開了。', xp(10)),
               ('int', 12), out('你找錯了結，網子反而勒得更緊，最後只好硬扯開。', hp(-0.05), hours=1)),
       ]),
    ev('dn_bear_trap', '捕獸夾',
       '「喀嚓」一聲，一個生鏽的捕獸夾夾住了你的腳踝。',
       ['trap'], [
           opt('硬掰開', out('你咬著牙把夾子掰開，腳踝只是破了點皮。', hp(-0.05)),
               ('str', 14), out('夾子太緊了，你掰到第三次才打開，腳踝腫了起來。', hp(-0.15))),
           opt('找機關卸下彈簧', out('你找到彈簧的卡榫，夾子「啪」地鬆開了。', xp(10)),
               ('int', 13), out('你弄了半天，最後還是硬掰開的。', hp(-0.1))),
       ], layers=[0, 1, 2]),
    ev('dn_gas_vent', '迷魂煙',
       '地板的縫隙裡噴出一陣甜膩的白煙，聞了讓人頭昏。',
       ['trap'], [
           opt('屏住呼吸', out('你憋住一口氣，等煙散了才繼續走。', xp(5)),
               ('str', 13), out('你憋不住吸了一口，腦袋昏昏沉沉的。', cond('dazed'))),
           opt('掩住口鼻衝出去', out('你用布掩著口鼻衝出煙霧。', xp(5)),
               ('dex', 12), out('你在煙裡撞上了牆，又吸了好幾口。', cond('dazed'), hp(-0.05))),
       ], layers=DEEP),
    ev('dn_alarm_bell', '警鈴',
       '你絆到一根細線，頭頂一串鈴鐺叮叮噹噹地響了起來，聲音在通道裡迴盪。',
       ['trap'], [
           opt('按住鈴鐺', out('你跳起來按住鈴鐺，聲音很快就停了。附近好像沒有東西被吵醒。', xp(10)),
               ('dex', 13), out('鈴聲停了，可是遠處傳來窸窸窣窣的聲音。你躲了好一陣子才敢出來。', cond('shaken'), hours=1)),
           opt('拆下鈴鐺帶走', out('反正都響了。你把鈴鐺拆下來，賣給雜貨店也值點錢。', money(15))),
       ], layers=DEEP),
    ev('dn_flood_room', '灌水的房間',
       '身後的石門「轟」地關上，牆上的出水口開始往房間裡灌水。',
       ['trap'], [
           opt('找排水口', out('你在水淹到胸口之前找到了排水的機關，水嘩啦啦地退了。', xp(20)),
               ('int', 14), out('水淹過了頭頂，你憋著氣摸了很久才找到機關，嗆了好幾口水。', hp(-0.15))),
           opt('游上去找出口', out('你游到天花板附近，發現一個通風口，鑽了出去。', xp(15)),
               ('str', 13), out('水太冷了，你游到筋疲力盡才找到出口。', hp(-0.15), cond('drained'))),
       ], layers=MID),
    ev('dn_curse_glyph', '詛咒的符文',
       '你踩到一個刻在地上的符文，它亮起暗紅色的光，一股寒意從腳底竄上來。',
       ['trap'], [
           opt('唸禱詞抵抗', out('你唸著禱詞，紅光慢慢褪去，反而有股暖意留在身上。', cond('blessed')),
               ('fai', 14), out('寒意鑽進了骨頭裡，你打了好幾個冷顫，心神不寧。', cond('shaken'))),
           opt('把符文抹掉', out('你用刀刮掉符文的一角，紅光一閃就滅了。刮下來的石片還帶著魔力。', give('古符碎片', 1)),
               ('int', 13), out('你刮錯了地方，符文炸開，把你震退了好幾步。', hp(-0.1))),
       ], layers=MID),
    ev('dn_falling_cage', '落下的鐵籠',
       '頭頂的鐵籠「哐」地砸下來，把你關在裡面。',
       ['trap'], [
           opt('抬起鐵籠', out('你雙手抓住鐵欄，硬是把籠子抬了起來，鑽了出去。', xp(15)),
               ('str', 15), out('籠子太重了，你抬了一個多小時才抬出一條縫。', cond('drained'), hours=2)),
           opt('撬開籠門的鎖', out('籠門上有個老舊的鎖，你三兩下就撬開了。', xp(10)),
               ('dex', 14), out('鎖鏽死了，你撬了很久才打開。', hours=2)),
       ], layers=MID),
    ev('dn_quicksand', '流沙',
       '腳下的沙突然鬆了，你整個人開始往下陷。',
       ['trap'], [
           opt('平躺下來慢慢挪', out('你照著老嚮導教的方法平躺下來，一點一點挪到硬地上。', xp(15)),
               ('int', 12), out('你越掙扎陷得越深，等爬出來時已經筋疲力盡。', cond('drained'), hp(-0.05))),
           opt('抓住旁邊的石柱', out('你抓住石柱把自己拉了出來。', xp(5)),
               ('str', 13), out('石柱太滑了，你被沙吞到胸口才勉強爬出來。', hp(-0.1), cond('drained'))),
       ], dungeons=WEST),
    ev('dn_ice_slide', '冰面滑坡',
       '腳下的冰面一傾，你整個人順著冰坡往下滑，下面是一片尖銳的冰柱。',
       ['trap'], [
           opt('用武器剎住', out('你把武器插進冰裡，在冰柱前停了下來。', xp(10)),
               ('dex', 14), out('你沒剎住，撞上了冰柱。', hp(-0.15))),
           opt('翻身滾開', out('你往旁邊一滾，滑進一堆軟雪裡。', xp(5)),
               ('dex', 12), out('你滾是滾開了，還是擦過了一根冰柱。', hp(-0.1))),
       ], dungeons=NORTH),
    ev('dn_ember_jet', '噴火口',
       '牆上的獸首雕像張開嘴，噴出一道火焰。',
       ['trap'], [
           opt('蹲低躲開', out('火焰從你頭頂掃過，燒焦了幾根頭髮。', xp(10)),
               ('dex', 14), out('火焰燎到了你的手臂。', hp(-0.2))),
           opt('用盾或斗篷擋住', out('你舉起斗篷擋住，斗篷燒了個洞，人倒是沒事。', hp(-0.05))),
       ], dungeons=SOUTH),
]

CHESTS = [
    ev('dn_chest_rusty_lock', '生鏽的鎖',
       '寶箱旁邊還有一口小一點的箱子，掛著一把鏽得看不出形狀的大鎖。',
       ['chest'], [
           opt('撬鎖', out('鏽鎖比看起來好開。箱子裡有一袋錢。', money(50)),
               ('dex', 13), out('鎖芯斷在裡面了。你只好把箱子砸開，裡面的東西摔壞了一半。', money(20))),
           opt('直接砸開', out('你一腳踹開箱子，錢幣撒了一地。', money(35)),
               ('str', 12), out('箱子很結實，你踹到腳痛才打開。', money(35), hp(-0.05))),
       ]),
    ev('dn_chest_needle', '鎖孔裡的毒針',
       '寶箱底下還藏著一個小匣子。你湊近一看，鎖孔裡有一點寒光——是根藏著的毒針。',
       ['chest'], [
           opt('小心地拆掉毒針', out('你用小刀挑出毒針，安心地打開小匣子：裡面有錢和一瓶解毒劑。', money(60), give('解毒劑')),
               ('dex', 14), out('毒針還是扎到了你，手指一陣發麻。小匣子倒是開了。', money(60), hp(-0.1), cond('drained'))),
           opt('用東西隔著開', out('你用武器挑開匣蓋，毒針射在劍身上。裡面的錢全歸你。', money(60)),
               ('int', 13), out('毒針從側面射出來，擦傷了你的手腕。', money(60), hp(-0.05))),
       ], layers=DEEP),
    ev('dn_chest_false_bottom', '雙層底的箱子',
       '你把寶箱清空之後，總覺得箱子的深度和外面看起來不太一樣。',
       ['chest'], [
           opt('找暗格', out('你敲出了空心的聲音，撬開夾層：裡面藏著一捲卷軸和一袋錢。', money(80), give('法術卷軸（普通）')),
               ('int', 14), out('你找了半天也找不到暗格，只好作罷。')),
           opt('不浪費時間', out('你沒時間細看，闔上箱子就走。')),
       ], layers=MID),
    ev('dn_chest_supplies', '補給箱',
       '寶箱旁邊還擺著一口冒險者公會放的補給箱，箱蓋上寫著：「取所需，留其餘。」',
       ['chest'], [
           opt('只拿需要的', out('你拿了一些繃帶和乾糧，把剩下的留給後來的人。', give('止血繃帶', 2), give('乾糧', 2), xp(15))),
           opt('全部帶走', out('你把補給箱搬空了。下一個冒險者恐怕要失望了。', give('止血繃帶', 3), give('乾糧', 4), give('火把（10 根）'))),
       ], layers=DEEP),
    ev('dn_chest_potion', '不明的藥水',
       '寶箱的角落還滾出一瓶標籤已經糊掉的藥水，液體是淡紅色的。',
       ['chest'], [
           opt('先聞聞看、辨認一下', out('是治療藥劑，而且保存得很好。', give('微弱治療藥劑')),
               ('int', 14), out('你聞不出來是什麼。保險起見，你沒有帶走它。')),
           opt('直接喝下去', out('一股暖流流過全身——是治療藥劑。', hp(0.3)),
               ('fai', 13), out('藥水早就變質了，你一陣頭暈。', cond('dazed'))),
           opt('倒掉', out('你把來路不明的藥水倒掉了。')),
       ], layers=DEEP),
    ev('dn_chest_sealed_scroll', '封印的卷軸匣',
       '寶箱底下還壓著一個用蠟封著的卷軸匣，蠟上印著某個魔法學院的紋章。',
       ['chest'], [
           opt('解開封印', out('你小心地解開封印，裡面是一捲護盾術的卷軸。', give('護盾術卷軸')),
               ('int', 15), out('封印上有防護的咒語，「啪」的一聲電了你一下，卷軸也燒掉了。', hp(-0.1))),
           opt('整個帶回城裡賣', out('你把卷軸匣原封不動地帶走。魔法學院的人會出個好價錢。', money(40))),
       ], layers=MID),
    ev('dn_chest_journal', '冒險者的日記',
       '寶箱底下還壓著一本皮面的日記，最後一頁寫著：「如果有人看到這本日記，請替我把它帶出去。」',
       ['chest'], [
           opt('讀一讀', out('日記裡記著這座地下城的路線和怪物的弱點，還夾著一張拓本。', xp(30), give('古墓拓本')),
               ('int', 12), out('字跡很潦草，你只看懂了一部分。', xp(10))),
           opt('帶回公會', out('公會的人接過日記，沉默了一會兒，給了你一筆謝禮。', money(30), xp(15))),
       ], layers=DEEP),
    ev('dn_chest_bounty', '壓著告示的箱子',
       '寶箱的蓋子內側還夾著一疊被撕下來的懸賞告示，和前一個冒險者沒花完的錢。',
       ['chest'], [
           opt('收下告示和錢', out('告示上寫著附近一群魔物的落腳處，賞金不少。', give('懸賞告示'), money(25))),
           opt('只拿錢', out('你把錢收起來，告示放回原處。', money(25))),
       ]),
    ev('dn_chest_crypt', '陪葬匣',
       '寶箱旁邊還擺著一口陪葬用的小匣子，匣蓋上刻著「願你在彼岸安息」。',
       ['chest'], [
           opt('打開它', out('匣子裡是幾件金飾。墓主似乎不介意。', give('陪葬金飾', 2)),
               ('fai', 13), out('你一打開，一陣冷風從匣子裡吹出來。你抓了一件就趕緊合上。', give('陪葬金飾', 1), cond('shaken'))),
           opt('合上並祈禱', out('你合上匣子，替墓主祈禱。一股暖意包圍了你。', cond('blessed'))),
       ], dungeons=CRYPT),
    ev('dn_chest_sunken', '泡水的箱子',
       '寶箱旁邊還有一口半泡在海水裡的箱子，木板都泡爛了，上面還纏著海藻。',
       ['chest'], [
           opt('把箱子拖上岸撬開', out('箱子裡是一袋生鏽的錢幣和一支魚人的魚叉。', money(50), give('魚人魚叉')),
               ('str', 12), out('箱子底被拖破了，一半的錢幣掉回海裡。', money(25))),
           opt('直接伸手進去摸', out('你在泥水裡摸到幾枚錢幣。', money(30)),
               ('dex', 12), out('箱子裡有東西夾了你一下——是螃蟹。', money(30), hp(-0.05))),
       ], dungeons=EAST),
    ev('dn_chest_frozen', '凍住的箱子',
       '寶箱旁邊還有一口被厚冰包住的箱子，怎麼拉都拉不開。',
       ['chest'], [
           opt('生火融冰', out('你生了火，等冰慢慢融化。箱子裡有一袋錢和一瓶抗寒藥劑。', money(60), give('抗寒藥劑')),
               ('int', 12), out('柴火是濕的，你花了好幾個小時才把冰融開。', money(60), hours=3)),
           opt('砸開冰', out('你一錘砸碎了冰和半個箱子，錢倒是沒事。', money(40)),
               ('str', 14), out('冰比石頭還硬，你砸得雙手發麻。', money(40), cond('drained'))),
       ], dungeons=NORTH),
]

RESTS = [
    ev('dn_rest_song', '夜裡的歌聲',
       '你在安全房裡快睡著時，通道深處傳來細細的歌聲，聽不出是人還是別的什麼。',
       ['rest'], [
           opt('悄悄去看看', out('你順著歌聲找到一個小房間，只剩一架積滿灰塵的八音盒還在轉，盒子底下壓著幾枚錢幣。', money(30), xp(20)),
               ('int', 13), out('你在黑暗裡迷了路，繞了好久才回到安全房，一夜沒睡好。', cond('shaken'))),
           opt('塞住耳朵繼續睡', out('歌聲慢慢遠了，你睡了個好覺。', cond('relaxed'))),
       ], layers=DEEP),
    ev('dn_rest_lost', '迷路的冒險者',
       '一個滿身是傷的年輕冒險者跌跌撞撞地闖進安全房，他和隊友走散了。',
       ['rest'], [
           opt('分他一些食物和繃帶', out('他感激地收下，臨走前把一張自己畫的地圖塞給你：「這上面標了我們發現的寶藏。」', give('盜墓者的藏寶圖'), xp(20)),
               ('cha', 12), out('他吃完東西就不告而別了。至少你做了該做的事。', xp(10))),
           opt('告訴他回去的路', out('你把來時的路畫給他，他千恩萬謝地走了。', xp(10))),
           opt('請他離開', out('你需要休息。他低著頭離開了。')),
       ], layers=[0, 1, 2, 3]),
    ev('dn_rest_rats', '偷糧的老鼠',
       '半夜你被窸窸窣窣的聲音吵醒——一群老鼠正在咬你的行囊。',
       ['rest'], [
           opt('抓住牠們', out('你抓住領頭的那隻，其他的一哄而散。行囊裡的東西都還在。', xp(5)),
               ('dex', 12), out('老鼠跑光了，你的行囊被咬了好幾個洞，你也沒睡好。', cond('drained'))),
           opt('把食物吊高', out('你把食物吊到樑上，老鼠搆不著，只好走了。', xp(5))),
       ]),
    ev('dn_rest_dream', '預兆之夢',
       '你夢見自己走在這座地下城的更深處，有個聲音在告訴你哪裡危險。',
       ['rest'], [
           opt('醒來把夢記下來', out('你把夢裡的路線記下來，總覺得這是某種指引。', cond('blessed'), xp(10)),
               ('fai', 13), out('醒來時夢就模糊了，只剩一陣說不出的不安。', cond('dazed'))),
           opt('翻個身繼續睡', out('你沒把夢當一回事，一覺睡到天亮。', cond('relaxed'))),
       ], layers=MID),
    ev('dn_rest_skylight', '天井透下的星光',
       '安全房的頂上有一道裂縫，抬頭能看見一小片星空。',
       ['rest'], [
           opt('對著星空冥想', out('你靜靜地看著星星，心裡的雜念一點點散去。', cond('blessed')),
               ('fai', 12), out('你盯著星星發呆，不知不覺就睡著了。', cond('relaxed'))),
           opt('數著星星入睡', out('你數到一百多就睡著了。', cond('relaxed'))),
       ], layers=[1, 2]),
    ev('dn_rest_peddler', '夜裡經過的行商',
       '一個背著大包袱的行商敲了敲安全房的門：「冒險者大人，要不要買點東西？價錢公道。」',
       ['rest'], [
           opt('買些繃帶', out('你買了幾卷繃帶，價錢確實公道。', money(-30), give('止血繃帶', 3))),
           opt('跟他打聽消息', out('行商說得口沫橫飛，最後還送了你一張他撿到的告示。', give('懸賞告示'), xp(10)),
               ('cha', 12), out('他只顧著推銷，什麼消息也沒給你。')),
           opt('請他離開', out('你搖搖頭，行商聳聳肩走了。')),
       ], layers=[0, 1, 2]),
    ev('dn_rest_quake', '地鳴',
       '半夜，整座地下城突然震動起來，天花板的碎石嘩啦啦地往下掉。',
       ['rest'], [
           opt('躲到門框下', out('你在第一時間躲到門框下，碎石沒砸到你。', xp(10)),
               ('dex', 13), out('一塊石頭砸在你的肩膀上。', hp(-0.1))),
           opt('趁亂看看哪裡塌了', out('地震過後，你發現一面牆塌了，後面露出幾枚古老的錢幣。', money(40)),
               ('int', 14), out('你什麼也沒發現，倒是吸了一肚子灰。', cond('drained'))),
       ], layers=MID),
    ev('dn_rest_whetstone', '好磨刀石',
       '安全房的角落有一塊表面光滑的青石，看得出很多冒險者在這裡磨過刀。',
       ['rest'], [
           opt('好好磨一磨武器', out('你在青石上把武器磨得鋒利無比。', cond('honed'))),
           opt('在石頭上刻下名字', out('你在密密麻麻的名字中間刻下自己的名字。說不定哪天會有人看到。', xp(10))),
       ]),
    ev('dn_rest_ghost', '安靜的幽靈',
       '你醒來時，一個半透明的身影正坐在你對面，靜靜地看著你。它看起來沒有惡意。',
       ['rest'], [
           opt('聽它說話', out('它斷斷續續地說起生前的事，最後指了指牆角——那裡埋著它的遺物。', give('陪葬金飾', 1), xp(25)),
               ('fai', 13), out('你聽不懂它在說什麼，它嘆了口氣就消失了，留下一屋子的寒意。', cond('shaken'))),
           opt('替它唸往生的禱詞', out('它聽完禱詞，朝你點點頭，慢慢消散了。', cond('blessed'), xp(15)),
               ('fai', 14), out('禱詞沒有用，它在你身邊徘徊了一整夜。', cond('shaken'))),
       ], dungeons=CRYPT),
    ev('dn_rest_tide', '漲潮的聲音',
       '安全房外傳來海浪拍打岩壁的聲音，潮水漸漸漲了上來，在門口留下一圈泡沫。',
       ['rest'], [
           opt('撿潮水沖來的東西', out('潮水沖來了一些貝殼和一個小錢袋。', money(30)),
               ('dex', 12), out('一個浪打過來，你全身都濕透了。', cond('drained'))),
           opt('聽著浪聲入睡', out('浪聲很有規律，你睡得特別沉。', cond('relaxed'), hp(0.1))),
       ], dungeons=EAST),
    ev('dn_rest_warm_stone', '溫暖的地熱',
       '安全房的地板底下有地熱，躺上去暖烘烘的。',
       ['rest'], [
           opt('躺在熱石上睡', out('你一覺睡到自然醒，渾身的痠痛都消了。', hp(0.2), cond('relaxed'))),
           opt('拿來烘乾裝備', out('你把濕掉的衣物和靴子攤開烘乾，順手磨了磨武器。', cond('honed'))),
       ], dungeons=SOUTH),
]

NORMAL_EVENTS = GATHER + TRAPS + CHESTS + RESTS


def main():
    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in NORMAL_EVENTS:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "dg_erotic_book".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in NORMAL_EVENTS])
    d = json.loads(t)

    # 檢查：引用的物品、非戰鬥狀態、臨時地圖、地下城都存在；沒有成人向的東西
    items = {i['name'] for i in json.load(open('data/rules/items.json'))['items']}
    conditions = set(json.load(open('data/rules/companions.json'))['conditions'])
    locs = {l['id'] for l in json.load(open('data/world/geography.json'))['locations']}
    adult_conditions = {'aroused', 'sensitive', 'afterglow', 'virile', 'parasite_glow'}
    for e in NORMAL_EVENTS:
        assert e['id'].startswith('dn_'), e['id']
        assert 'tags' not in e and 'pc_body' not in e and 'scene' not in e, e['id']
        for loc in e.get('dungeons', []):
            assert loc in locs, loc
        assert 2 <= len(e['options']) <= 3, e['id']
        for o in e['options']:
            assert 'adult_scene' not in o
            for res in (o.get('success'), o.get('fail')):
                if not res:
                    continue
                if 'side_map' in res:
                    assert res['side_map'] in d['side_maps'], res
                for x in res.get('effects', []):
                    assert x['type'] in ('item', 'money', 'xp', 'hp', 'condition', 'slot'), x
                    if x['type'] == 'item':
                        assert x['name'] in items, x
                    if x['type'] == 'condition':
                        assert x['condition'] in conditions and x['condition'] not in adult_conditions, x
    counts = {k: sum(1 for e in NORMAL_EVENTS if e['triggers'][0] == k) for k in ('gather', 'trap', 'chest', 'rest')}
    assert counts == {'gather': 19, 'trap': 13, 'chest': 11, 'rest': 11}, counts
    # 寫的時候和成人向的一樣多（54 件）；之後成人向的採集事件另外補了 12 件（lust_gather34.py）
    assert len(NORMAL_EVENTS) == 54, len(NORMAL_EVENTS)
    assert len({x['id'] for x in d['templates']}) == len(d['templates'])
    open(p, 'w').write(t)
    print('normal dungeon events', len(NORMAL_EVENTS), counts)


if __name__ == '__main__':
    main()
