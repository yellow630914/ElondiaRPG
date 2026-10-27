"""第七批特殊任務（6 條）：萊茵堡的併吞阿爾貝納、索里耶爾的帝國間諜滲透、阿爾貝納的抵禦間諜，蕾娜、瓦萊莉、伊芙（成人向）。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need

ROSA, BRU, CON, MAT, KAS, ISB, KAI, SALO = 'npc_rosalind', 'npc_brunhild', 'npc_constance_wagner', 'npc_matilda_rosen', 'npc_kaspar_nord', 'npc_isabella_rowan', 'npc_kai', 'npc_faceless_salo'
LENA, VAL, EVE, MIMI, TOB = 'npc_lena', 'npc_valerie', 'npc_eve', 'npc_mimi', 'npc_tobias_green'


def done(text, flags, effects=(), counters=None, **kw):
    o = {"text": text, "set_flags": list(flags), "effects": list(effects), "complete": True, **kw}
    if counters: o["counters"] = counters
    if not o["effects"]: del o["effects"]
    return o


def step(text, flags, effects=(), **kw):
    o = {"text": text, "set_flags": list(flags), **kw}
    if effects: o["effects"] = list(effects)
    return o


# ---------------- 萊茵堡：併吞阿爾貝納 ----------------
annex1 = {
    "id": "annex_white_rook",
    "title": "白棋的信使",
    "summary": "第四軍團的將軍「白棋」羅莎琳德，請你替她送一封信到阿爾貝納。她說只是一封問候信。（併吞阿爾貝納・一）",
    "rank": "D", "merit": 8,
    "start": {
        "kind": "npc", "npc": ROSA, "min_level": 5,
        "text": "羅莎琳德將軍在棋盤對面朝你招手：「陪我下一盤吧。」她挪動一枚白色的城堡，笑咪咪地說，「下完了，替我送一封問候信到阿爾貝納——給瑪蒂爾達議員。路上不太平，我想要一個不穿軍服的人。」",
    },
    "start_flags": ["annex_start"],
    "nodes": [
        {
            "id": "chess", "title": "在萊茵堡的酒館陪羅莎琳德下一盤棋",
            "text": "棋盤擺在酒館最安靜的角落。羅莎琳德下得很快，每一步都像早就想好了；她一邊下，一邊輕聲問你走過哪些地方、在阿爾貝納認識哪些人。",
            "at": at_cell("rhineburg", "tavern"), "requires": need("annex_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你輸了，但撐了四十手。羅莎琳德第一次抬頭看你：「有意思。」她把一封蓋著白色城堡火漆的信交給你，「別拆。拆了，信就不是問候信了。」", ["annex_letter"], [aff(ROSA, 5, "陪她下了一盤像樣的棋")]),
            "fail": step("你十二手就輸了。羅莎琳德笑著收起棋子：「沒關係，送信不需要會下棋。」她把一封蓋著白色城堡火漆的信交給你，「別拆。」", ["annex_letter"]),
        },
        {
            "id": "road", "title": "在阿爾貝納近郊擊退攔路的逃兵",
            "text": "南方丘陵的小路上，幾個穿著第四軍團舊軍服的逃兵攔住了你：「白色城堡的火漆？那封信值不少錢——賣給阿爾貝納的人，夠我們喝一年。」",
            "at": outskirts("albena"), "requires": need("annex_letter"), "kind": "combat",
            "enemies": [["legion_deserter", 3]],
            "success": step("逃兵們倒下了。其中一個臨走前喊：「你知道你送的是什麼嗎？將軍要把阿爾貝納整個吞下去！」", ["annex_road"]),
            "fail": step("逃兵們搶走了你的錢袋，卻沒搶到信——你把它藏在了靴子裡。其中一個臨走前喊：「將軍要把阿爾貝納整個吞下去！」", ["annex_road"]),
        },
        {
            "id": "deliver", "title": "在阿爾貝納把信交給瑪蒂爾達議員",
            "text": "瑪蒂爾達在貴族區的茶室裡接見你，看了一眼火漆，笑容甜得像糖：「白棋將軍的問候信啊。」她伸出手，「拿來吧。」逃兵的話還在你耳邊。",
            "at": at_npc(MAT), "requires": need("annex_road"), "kind": "choice",
            "options": [
                {"label": "照約定把信交給她", "success": done("瑪蒂爾達讀完信，把它放進了貼身的口袋：「告訴將軍，我很樂意『被保護』。」她付給你的跑腿費，比羅莎琳德承諾的還多。", ["annex_1_done", "annex_delivered"], [aff(MAT, 10, "替她送來白棋的信"), aff(ROSA, 10, "把信送到了"), money(200), mem("替第四軍團的羅莎琳德將軍把一封信送給阿爾貝納的瑪蒂爾達議員。信裡談的是帝國對聯邦的「保護」。")])},
                {"label": "先拆開信看", "success": done("信裡沒有問候：一份「帝國保護奧德聯邦」的條約草案，瑪蒂爾達的名字寫在「聯邦代表」那一欄。你把信重新封好——封得不太好——交了出去。瑪蒂爾達看了一眼歪掉的火漆，笑了：「好奇心是好事。只要你知道該對誰閉嘴。」", ["annex_1_done", "annex_read"], [aff(MAT, -5, "拆了給她的信"), mem("替羅莎琳德將軍送信給瑪蒂爾達，偷看了信：一份帝國「保護」奧德聯邦的條約草案，瑪蒂爾達是聯邦代表。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

annex2 = {
    "id": "annex_hill_exercise",
    "title": "南方丘陵的演習",
    "summary": "第四軍團在通往阿爾貝納的南方丘陵舉行「演習」。阿爾貝納的商人說，演習的方向怎麼看都是朝著聯邦。（併吞阿爾貝納・二）",
    "rank": "C", "merit": 10,
    "start": {
        "kind": "informant", "location": "albena", "price": 300, "min_level": 8, "requires": need("annex_1_done"),
        "text": "情報商把一張手繪的地圖攤開：「第四軍團說是演習。可是演習的營地一天往南挪三里，糧草夠吃半年。」他敲了敲地圖上的一個點，「斥候營在這裡。你要是想知道白棋在下哪一步棋，就去看看。」",
    },
    "start_flags": ["annex_hills"],
    "nodes": [
        {
            "id": "scout", "title": "在阿爾貝納近郊偵察第四軍團的斥候營",
            "text": "丘陵上的斥候營插著第四軍團的白色城堡旗。你趴在草叢裡數帳篷、數馬匹、數攻城器械的輪廓。",
            "at": outskirts("albena"), "requires": need("annex_hills"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你數清楚了：三個大隊、十二架投石車、足夠圍城一個月的糧草。帳篷裡傳出軍官的聲音：「條約簽了就不用打；沒簽，就讓投石車去簽。」", ["annex_counted"]),
            "fail": step("你只看清楚了一件事：營地裡的攻城器械，不是演習用的。", ["annex_counted"]),
        },
        {
            "id": "skirmish", "title": "在阿爾貝納近郊甩掉第四軍團的游擊兵",
            "text": "你剛要撤，兩名第四軍團的游擊兵從背後的林子裡走出來，弩已經上了弦：「演習區域，閒人勿入。將軍說了，看見的人都得留下來喝杯茶。」",
            "at": outskirts("albena"), "requires": need("annex_counted"), "kind": "combat",
            "enemies": [["legion_skirmisher", 2]],
            "success": step("游擊兵們倒下了。你帶著情報撤回了阿爾貝納。", ["annex_intel"]),
            "fail": step("你們被游擊兵逼進了溪谷，一路跑回阿爾貝納才甩掉他們。情報還在你的腦子裡。", ["annex_intel"]),
        },
        {
            "id": "warn", "title": "決定要把演習的真相告訴誰",
            "text": "你在阿爾貝納的公會裡寫下看到的一切。這份情報交給議會首席，聯邦會開始徵兵；交給帝國的主和派，宰相會去管住白棋；或者——什麼都不說。",
            "at": at_cell("albena", "guild"), "requires": need("annex_intel"), "kind": "choice",
            "options": [
                {"label": "交給議會首席康斯坦絲", "success": done("康斯坦絲讀完，沉默了很久，然後簽下了一份傭兵團的雇傭令：「聯邦不打仗。但聯邦付得起讓人不敢打的錢。」第二天，南方商路上多了三支傭兵團的旗幟。", ["annex_2_done", "annex_warned"], [aff(CON, 10, "替聯邦帶回了演習的真相"), rep("aude_federation", 5), mem("偵察了第四軍團在南方丘陵的「演習」，把攻城器械的情報交給了阿爾貝納的議會首席。")])},
                {"label": "交給主和的布倫希爾德", "success": done("霜盾將軍讀完情報，什麼都沒說，當天就騎馬去了宰相府。一週後，第四軍團的演習「提前結束」，羅莎琳德回到萊茵堡，笑咪咪地向宰相解釋了一整個下午。", ["annex_2_done", "annex_reined"], [aff(BRU, 10, "把白棋的棋局交給她"), rep("rhine_empire", 3), mem("把第四軍團在南方丘陵的演習情報交給了布倫希爾德將軍，宰相管住了羅莎琳德。")])},
                {"label": "替羅莎琳德保密", "success": done("你什麼都沒說。三天後，羅莎琳德派人送來一盒精緻的棋子，盒底壓著一張紙條：「好棋手知道什麼時候不該動。」", ["annex_2_done", "annex_silent"], [aff(ROSA, 15, "替她的棋局保密"), money(500), mem("看見了第四軍團在南方丘陵的攻城器械，卻替羅莎琳德將軍保守了秘密。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

annex3 = {
    "id": "annex_protection_treaty",
    "title": "保護條約",
    "summary": "羅莎琳德帶著「帝國保護奧德聯邦」的條約來到阿爾貝納。七議席議會要表決：簽，或不簽。（併吞阿爾貝納・三）",
    "rank": "B", "merit": 15,
    "start": {
        "kind": "guild", "location": "albena", "min_level": 11, "requires": need("annex_2_done"),
        "text": "公會的告示板上貼著議會的公告：帝國第四軍團將軍羅莎琳德・馮・貝格，將於七日後在風誓塔向議會遞交「保護條約」。公告底下有人用炭筆寫了一行字：「保護？還是吞併？」",
    },
    "start_flags": ["annex_treaty"],
    "nodes": [
        {
            "id": "rooks", "title": "在阿爾貝納的城門擋下白棋的近衛",
            "text": "遞交條約的前一夜，一隊穿著白色鎧甲的近衛騎士在城門前停下，說是護送將軍的「儀仗」——人數卻足夠占領一座城門。帶頭的騎士笑了笑：「讓開吧，冒險者。明天之後，這座城門也是帝國的了。」",
            "at": at_cell("albena", "gate"), "requires": need("annex_treaty"), "kind": "combat",
            "enemies": [["white_rook_guard", 3]],
            "success": step("白甲騎士們退出了城門。羅莎琳德坐在馬車裡，掀開簾子看了你一眼，輕輕地說：「這一手，下得不錯。」", ["annex_gate"]),
            "fail": step("你們撐不住了，所幸聯邦的傭兵團及時趕到，把白甲騎士擋在了城門外。羅莎琳德的馬車照樣進了城——只是儀仗少了一半。", ["annex_gate"], [hp(-0.2)]),
        },
        {
            "id": "vote", "title": "在阿爾貝納的風誓塔見證條約的表決",
            "text": "風誓塔頂，羅莎琳德把條約放在誓約石上，笑咪咪地看著七位議員。康斯坦絲面無表情，瑪蒂爾達笑得很甜，伊格納茲在擦汗。表決之前，康斯坦絲轉向你：「你看過這盤棋的每一步。你說，聯邦該怎麼走？」",
            "at": at_cell("albena", "lm_windoath_tower"), "requires": need("annex_gate"), "kind": "choice",
            "options": [
                {"label": "拒絕條約", "check": {"attr": "cha", "dc": 16},
                 "success": done("「保護，是給打不過的人的。」你說，「聯邦付得起自己的劍。」四票對三票，條約被擋了下來。羅莎琳德收起條約，向你點了點頭，像在承認一盤棋輸了：「下次，我會換一種下法。」", ["annex_refused"], [rep("aude_federation", 10), aff(CON, 10, "替聯邦擋下了條約"), mem("在阿爾貝納的風誓塔上，替聯邦拒絕了帝國的保護條約。羅莎琳德說下次會換一種下法。", 3)]),
                 "fail": done("你的話被瑪蒂爾達的笑聲打斷，但康斯坦絲投下了決定性的一票。三比三之後，首席的那一票讓條約擱置。羅莎琳德聳聳肩：「擱置，不是拒絕。」", ["annex_refused"], [rep("aude_federation", 5), mem("在阿爾貝納的風誓塔上，帝國的保護條約被擱置了。", 3)])},
                {"label": "簽下條約", "check": {"attr": "cha", "dc": 16},
                 "success": done("「與其讓投石車來簽，不如自己簽。」你說。瑪蒂爾達第一個舉手，四比三。羅莎琳德在條約上落下最後一個名字，對著你行了一個棋手的禮：「將死。」阿爾貝納成了帝國的保護國，瑪蒂爾達成了「聯邦代表」。", ["annex_protectorate"], [rep("rhine_empire", 10), rep("aude_federation", -5), aff(ROSA, 15, "替她下完了這盤棋"), aff(MAT, 10, "讓她成了聯邦代表"), mem("在阿爾貝納的風誓塔上促成了帝國的保護條約，聯邦成了帝國的保護國。", 3)]),
                 "fail": done("你說得猶豫，但瑪蒂爾達接過了話頭。四比三，條約通過——只是多了一條「十年後重議」。羅莎琳德笑了笑：「十年，夠了。」", ["annex_protectorate"], [rep("rhine_empire", 5), aff(ROSA, 10, "條約通過了"), mem("帝國的保護條約在阿爾貝納以四比三通過，附帶十年後重議。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 索里耶爾：帝國的間諜滲透 ----------------
spy1 = {
    "id": "spy_pigeons",
    "title": "聖城上空的信鴿",
    "summary": "索里耶爾的審判廷射下了一隻信鴿，腳上綁著一張帝國的密碼信。審判廷在找寫信的人，有人想搶在他們前面。（帝國的間諜滲透・一）",
    "rank": "D", "merit": 8,
    "start": {
        "kind": "guild", "location": "soriel", "min_level": 5,
        "text": "公會的告示板上有一張沒有署名的委託：「城外的鴿舍附近掉了一隻受傷的信鴿，請找到牠、照顧牠，報酬從優。」委託單的角落，有一個很小的萊茵鷹徽，小到要瞇著眼睛才看得見。",
    },
    "start_flags": ["spy_start"],
    "nodes": [
        {
            "id": "pigeon", "title": "在索里耶爾近郊找到受傷的信鴿",
            "text": "鴿舍附近的草叢裡，一隻翅膀中箭的信鴿縮成一團，腳上綁著一個小銅管。銅管裡的紙條寫滿了看不懂的數字。",
            "at": outskirts("soriel"), "requires": need("spy_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你認出了帝國軍用的數字密碼：「主教會議三日後開。強硬派七席，騎士團派五席。勿再發信，審判廷已察覺。——鐘樓」寫信的人，代號叫「鐘樓」，就在大教堂裡。", ["spy_code"]),
            "fail": step("數字你看不懂，但紙條最後畫著一座小小的鐘樓——大教堂的鐘樓。", ["spy_code"]),
        },
        {
            "id": "deacons", "title": "在索里耶爾近郊擋下來抓人的審判廷執事",
            "text": "你剛要回城，三個黑衣執事攔住了一個瘦小的鐘樓守夜人，正要把他押走：「帝國的狗，鐘樓上的信鴿是你養的吧？」守夜人看見你手裡的信鴿，臉色一下子白了。",
            "at": outskirts("soriel"), "requires": need("spy_code"), "kind": "combat",
            "enemies": [["cloister_deacon", 3]],
            "success": step("執事們倒下了。守夜人抱著信鴿發抖：「求求你……我只是寫下主教們說了什麼。帝國想要的是停戰，不是戰爭。」", ["spy_caught"]),
            "fail": step("執事們把你們打退，卻在混亂中讓守夜人跑了——他躲在你們身後的草叢裡，抱著信鴿發抖：「帝國想要的是停戰，不是戰爭。」", ["spy_caught"]),
        },
        {
            "id": "decide", "title": "決定鐘樓守夜人的去處",
            "text": "守夜人跪在地上：「河谷鎮有人會接我。如果你把我交給審判廷……」他沒說完。遠處，審判廷的鐘聲響了。",
            "at": outskirts("soriel"), "requires": need("spy_caught"), "kind": "choice",
            "options": [
                {"label": "放他去河谷鎮", "success": done("你替他引開了追兵。三天後，河谷鎮的布料商人卡斯帕寄來一匹上好的絲綢，什麼話都沒寫。審判廷在大教堂裡又抓了兩個人，都不是他。", ["spy_1_done", "spy_freed"], [aff(KAS, 10, "救了帝國的線人"), mem("在索里耶爾救了替帝國傳遞主教會議消息的鐘樓守夜人，放他逃往河谷鎮。")], counters={"human_stance": 1})},
                {"label": "交給審判廷", "success": done("你把守夜人交給了審判廷。審判長瓦倫汀親自來接人，面無表情地說了一句「信仰感謝你」。那天之後，大教堂裡再也沒有信鴿飛出去。", ["spy_1_done", "spy_handed"], [rep("holy_ring", 5), mem("在索里耶爾把替帝國傳遞消息的鐘樓守夜人交給了審判廷。")], counters={"human_stance": -1})},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

spy2 = {
    "id": "spy_valentin_brother",
    "title": "審判長的兄長",
    "summary": "帝國的密探卡斯帕想要一份能讓強硬派閉嘴的東西：審判長瓦倫汀當年親手送上火刑台的兄長，留下了一封信。（帝國的間諜滲透・二）",
    "rank": "C", "merit": 10,
    "start": {
        "kind": "npc", "npc": KAS, "min_level": 8, "requires": need("spy_1_done"),
        "text": "卡斯帕在布料攤後面折著一匹絲綢：「審判長瓦倫汀，二十年前親手送他犯了異端罪的兄長上了火刑台。」他抬起頭，「他兄長在行刑前寫了一封信，沒有寄出去。宰相想要那封信——不是為了打倒他，是為了讓他願意坐下來談。」",
    },
    "start_flags": ["spy_letter"],
    "nodes": [
        {
            "id": "trace", "title": "到索里耶爾的情報商打聽那封信",
            "text": "情報商聽到「瓦倫汀的兄長」，手裡的杯子停了一下：「那封信？當年的獄卒偷偷留了下來，後來賣給了一個收藏異端文書的老學者。老學者死了，信……在他的書房裡，書房被審判廷封了。」",
            "at": at_cell("soriel", "informant"), "requires": need("spy_letter"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("情報商給了你書房的位置，還有一把審判廷不知道的後門鑰匙。", ["spy_study"]),
            "fail": step("情報商收了一大筆錢，才把書房的位置寫在紙上。", ["spy_study"], [money(-150)]),
        },
        {
            "id": "study", "title": "在索里耶爾近郊的老學者書房拿到信",
            "text": "封條還貼在門上，書房裡卻已經有人了——兩名審判廷的審問官正在翻箱倒櫃。「審判長說，這個房間裡的東西都要燒掉。」其中一人轉過身，「包括你。」",
            "at": outskirts("soriel"), "requires": need("spy_study"), "kind": "combat",
            "enemies": [["cloister_questioner", 2]],
            "success": step("審問官們倒下了。書架最底層的夾層裡，有一封泛黃的信，信封上寫著：「給我的弟弟瓦倫汀。」", ["spy_has_letter"]),
            "fail": step("審問官們點著了書房。你在濃煙裡摸到書架最底層的夾層，搶出了一封信：「給我的弟弟瓦倫汀。」", ["spy_has_letter"], [hp(-0.1)]),
        },
        {
            "id": "use", "title": "決定瓦倫汀兄長的信要交給誰",
            "text": "信很短：「弟弟，你沒有錯。我只是相信光照耀萬民。等你哪天也相信了，就來看看我的墳。」你可以把它交給卡斯帕，讓帝國拿去和審判長談條件；也可以交給騎士團長伊莎貝拉，或者——直接交給瓦倫汀本人。",
            "at": at_npc(ISB), "requires": need("spy_has_letter"), "kind": "choice",
            "options": [
                {"label": "交給卡斯帕", "success": done("卡斯帕收下信，鄭重地向你鞠了一躬。一個月後，審判廷的強硬派在主教會議上第一次投了棄權票。沒有人知道為什麼，伊莎貝拉看著你，猜到了。", ["spy_2_done", "spy_leverage"], [aff(KAS, 10, "替帝國拿到了信"), mem("把審判長瓦倫汀兄長的遺信交給了帝國的密探卡斯帕，強硬派在主教會議上投了棄權。")], counters={"human_stance": 1})},
                {"label": "交給瓦倫汀本人", "success": done("你在審判迴廊的門口把信交給了瓦倫汀。他讀了很久，臉上沒有任何表情，然後把信放進了懷裡：「……你想要什麼？」你說什麼都不要。他看著你，第一次像個普通人一樣嘆了口氣。審判廷從此記得你的名字——不是當成敵人。", ["spy_2_done", "spy_returned"], [rep("holy_ring", 5), mem("把審判長瓦倫汀兄長的遺信親手交給了他，什麼都沒要。")], counters={"human_stance": -1})},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

spy3 = {
    "id": "spy_secret_envoy",
    "title": "聖座下的密使",
    "summary": "帝國派出一位密使，要私下覲見教皇，談停戰之後的人類與魔族。狂信的騎士不打算讓他活著見到聖座。（帝國的間諜滲透・三）",
    "rank": "B", "merit": 15,
    "start": {
        "kind": "guild", "location": "soriel", "min_level": 11, "requires": need("spy_2_done"),
        "text": "公會收到聖殿騎士團長的指名委託：一位不能說出名字的「客人」，要在三日後私下覲見教皇。委託單上只有一行字：「客人的馬車上沒有紋章，但大家都知道是從萊茵堡來的。」",
    },
    "start_flags": ["spy_envoy"],
    "nodes": [
        {
            "id": "gate", "title": "在索里耶爾的城門護送帝國的密使",
            "text": "沒有紋章的馬車駛近城門時，一隊黑環狂信騎士從朝聖者的人群裡衝了出來：「帝國的密使，滾回去！」車簾後，一位戴著兜帽的女子平靜地看著外面。",
            "at": at_cell("soriel", "gate"), "requires": need("spy_envoy"), "kind": "combat",
            "enemies": [["zealot_templar", 3]],
            "success": step("狂信騎士們倒在城門下。車簾後的女子朝你點了點頭，兜帽下露出一縷銀灰色的頭髮——你好像在萊茵堡的宰相府見過。", ["spy_inside"]),
            "fail": step("你們撐不住了，所幸伊莎貝拉帶著騎士團趕來。馬車進了城，車簾後的女子朝你點了點頭。", ["spy_inside"], [hp(-0.2)]),
        },
        {
            "id": "audience", "title": "在索里耶爾決定密使能不能見到教皇",
            "text": "覲見的時間到了。伊莎貝拉把你拉到一邊：「審判長在聖座的門口等著。他說，只要把密使交給審判廷，強硬派就不追究騎士團這次的事。」她看著你，「我需要你的決定——這次，騎士團不能替你擋。」",
            "at": at_npc(ISB), "requires": need("spy_inside"), "kind": "choice",
            "options": [
                {"label": "送密使走進聖座", "check": {"attr": "cha", "dc": 16},
                 "success": done("你直接走到審判長面前：「信仰不需要害怕一場談話。」瓦倫汀沉默了很久，讓開了路。密使在聖座裡待了一整夜。天亮時，教皇的窗口第一次在黎明前亮起燈——停戰之後的人類與魔族，有人開始談了。", ["spy_audience"], [aff(ISB, 10, "陪她扛下這件事"), rep("rhine_empire", 5), mem("在索里耶爾護送帝國的密使覲見教皇，讓停戰之後的人類與魔族開始談了。", 3)], counters={"human_stance": 1}),
                 "fail": done("審判長沒有讓路，但伊莎貝拉把劍插在了聖座的門前：「這扇門，騎士團開。」密使進去了。代價是騎士團長被停職三個月——她笑著說正好休假。", ["spy_audience"], [aff(ISB, 15, "讓她為你擋了一次"), mem("在索里耶爾，伊莎貝拉以停職三個月為代價，讓帝國的密使見到了教皇。", 3)], counters={"human_stance": 1})},
                {"label": "把密使交給審判廷",
                 "success": done("你把密使帶到了審判長面前。密使沒有反抗，只是看了你一眼：「我會記得的。」三天後，她被「禮送出境」，萊茵堡與索里耶爾之間的信使，從此少了一半。", ["spy_exposed"], [rep("holy_ring", 10), rep("rhine_empire", -5), aff(ISB, -10, "把密使交給了審判廷"), mem("在索里耶爾把帝國的密使交給了審判廷，帝國與教廷的往來從此冷了下來。", 3)], counters={"human_stance": -1})},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 阿爾貝納：抵禦帝國的間諜滲透 ----------------
def1 = {
    "id": "defense_codebook",
    "title": "扒手的意外收穫",
    "summary": "自由集市長大的扒手凱，扒到了一本不該扒的東西：帝國密探的密碼本。（抵禦帝國的間諜滲透・一）",
    "rank": "D", "merit": 8,
    "start": {
        "kind": "npc", "npc": KAI, "min_level": 5,
        "text": "凱把你拉進巷子，從懷裡掏出一本薄薄的小冊子：「今天的收穫，本來想賣錢的。」冊子裡全是數字和地名，「我認得那個人——在議會當書記的。書記身上帶這種東西幹嘛？」他咧嘴一笑，「而且，他的人現在在找我。」",
    },
    "start_flags": ["def_start"],
    "nodes": [
        {
            "id": "chase", "title": "在阿爾貝納近郊擋下追捕凱的人",
            "text": "城外的運河邊，三個穿著商人衣服的男人攔住了你們。他們走路的樣子像軍人，手按在藏著短劍的腰間：「把小冊子還來，小鬼。你身邊這位也一樣。」",
            "at": outskirts("albena"), "requires": need("def_start"), "kind": "combat",
            "enemies": [["imperial_agent", 3]],
            "success": step("「商人們」倒下了。其中一人的領口裡露出一枚萊茵鷹徽的刺青。凱吹了一聲口哨：「帝國的人？這下值錢了。」", ["def_agents"]),
            "fail": step("你們被逼進了運河，凱拉著你從水門鑽回了城裡。小冊子還在他懷裡，濕了一半。", ["def_agents"]),
        },
        {
            "id": "sell", "title": "決定密碼本的去處",
            "text": "凱把小冊子攤在你面前：「議會首席會付錢，自由集市的薩洛會付更多。」他歪著頭，「你說呢？我可是很講義氣的——分你一半。」",
            "at": at_npc(KAI), "requires": need("def_agents"), "kind": "choice",
            "options": [
                {"label": "帶他去見議會首席", "success": done("康斯坦絲翻著密碼本，臉色越來越冷：「議會的書記、碼頭的帳房、兩家銀行的出納……」她給了凱一筆錢和一份正式的工作：「替議會盯著集市。」凱第一次穿上了乾淨的衣服，渾身不自在。", ["def_1_done", "def_council"], [aff(KAI, 10, "帶他走了正路"), aff(CON, 10, "交出了帝國的密碼本"), mem("和扒手凱一起把帝國密探的密碼本交給了阿爾貝納的議會首席，凱成了議會的眼線。")])},
                {"label": "賣給「無面」薩洛", "success": done("薩洛付了一大筆錢，連看都沒看：「好東西。我會賣給最需要它的人。」凱數著錢笑開了花。你隱約覺得，那本冊子最後會回到帝國手裡——用更高的價錢。", ["def_1_done", "def_sold"], [aff(KAI, 15, "分了他一大筆錢"), money(600), mem("和扒手凱一起把帝國密探的密碼本賣給了自由集市的薩洛。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

def2 = {
    "id": "defense_mole",
    "title": "集市裡的鼴鼠",
    "summary": "帝國的密探網在阿爾貝納埋了一隻「鼴鼠」，位置高到能看見議會的每一份文件。（抵禦帝國的間諜滲透・二）",
    "rank": "C", "merit": 10,
    "start": {
        "kind": "npc", "npc": KAI, "min_level": 8, "requires": need("def_1_done"),
        "text": "凱在集市的屋頂上朝你揮手：「密碼本上的人都被抓了——或者都跑了。」他壓低聲音，「可是還有一個代號『鼴鼠』的，冊子上沒有名字，只寫著『看得見議會的每一份文件』。薩洛知道是誰，但他要的價錢……你自己去問吧。」",
    },
    "start_flags": ["def_mole"],
    "nodes": [
        {
            "id": "salo", "title": "在阿爾貝納的自由集市向薩洛買情報",
            "text": "「無面」薩洛坐在集市深處的陰影裡，聲音輕得像羽毛：「鼴鼠的名字？可以。代價是：你欠我一件事，我說什麼時候，就什麼時候。」",
            "at": at_npc(SALO), "requires": need("def_mole"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("你和薩洛討價還價了一整個下午，最後換成了一筆錢。他寫下一個名字：議會首席的私人秘書。「她今晚會去城外的舊磨坊，把最後一批文件交出去。」", ["def_name"], [money(-300)]),
            "fail": step("薩洛寫下一個名字：議會首席的私人秘書。「今晚，城外的舊磨坊。」他微笑著，「記得，你欠我一件事。」", ["def_name", "def_owes_salo"]),
        },
        {
            "id": "mill", "title": "在阿爾貝納近郊的舊磨坊截下最後一批文件",
            "text": "舊磨坊裡，議會首席的秘書正把一疊文件交給兩個披著斗篷的人。斗篷人轉過身來，手上已經拔出了短劍：「看來鼴鼠被挖出來了。」",
            "at": outskirts("albena"), "requires": need("def_name"), "kind": "combat",
            "enemies": [["imperial_lurker", 2]],
            "success": step("斗篷人倒下了，秘書跪在地上，文件散了一地：全是議會的防務預算與傭兵團的名單。", ["def_caught"]),
            "fail": step("斗篷人帶著一半的文件跑了，秘書卻沒來得及逃。她跪在地上，懷裡抱著剩下的一半。", ["def_caught"]),
        },
        {
            "id": "turn", "title": "決定鼴鼠的處置",
            "text": "秘書哭著說，她的家人在萊茵堡，帝國的人說，只要她合作，家人就平安。你可以把她交給議會；也可以讓她繼續當鼴鼠——只是從今以後，她送出去的文件，由議會來寫。",
            "at": outskirts("albena"), "requires": need("def_caught"), "kind": "choice",
            "options": [
                {"label": "交給議會", "success": done("康斯坦絲聽完，簽了一份驅逐令，而不是死刑令：「她的家人，我會想辦法。」秘書被送出了聯邦。帝國在阿爾貝納的眼睛，瞎了一隻。", ["def_2_done", "def_arrested"], [aff(CON, 10, "挖出了鼴鼠"), rep("aude_federation", 5), mem("在阿爾貝納挖出了帝國埋在議會首席身邊的鼴鼠，把她交給了議會。")])},
                {"label": "讓她當雙面間諜", "success": done("康斯坦絲想了很久，點頭：「從今天起，妳送出去的每一份文件，都由我來寫。」三個月後，帝國的密探網開始收到一份又一份精心捏造的「議會機密」。", ["def_2_done", "def_double"], [aff(CON, 15, "想出了反間的辦法"), mem("在阿爾貝納把帝國的鼴鼠變成了雙面間諜，帝國從此收到議會捏造的機密。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

def3 = {
    "id": "defense_spymaster",
    "title": "白棋的密探頭子",
    "summary": "帝國在阿爾貝納的密探網只剩下最後一個人——第四軍團派來的密探頭子。他親自來收拾殘局了。（抵禦帝國的間諜滲透・三）",
    "rank": "B", "merit": 15,
    "start": {
        "kind": "guild", "location": "albena", "min_level": 11, "requires": need("def_2_done"),
        "text": "公會的告示板上貼著議會的密令，只給指名的人看：帝國第四軍團的密探頭子已經潛入阿爾貝納，要在七日內「重建」被拆掉的密探網。議會要活捉他。",
    },
    "start_flags": ["def_master"],
    "nodes": [
        {
            "id": "trap", "title": "在阿爾貝納的城門設下陷阱",
            "text": "照凱打聽到的消息，密探頭子會在今晚從城門混出城。你們等到半夜，一輛載著木桶的馬車駛近城門，車伕座位旁邊坐著三個穿著白色鎧甲的騎士——他們連偽裝都懶得做了。",
            "at": at_cell("albena", "gate"), "requires": need("def_master"), "kind": "combat",
            "enemies": [["white_rook_guard", 3]],
            "success": step("白甲騎士們倒下了。木桶裡鑽出一個戴眼鏡的中年男人，舉起雙手：「我投降。我只是個下棋的人，不是拿劍的人。」", ["def_cornered"]),
            "fail": step("白甲騎士們擋住了你們，馬車卻在城門口翻了——凱在車輪底下塞了一根鐵棍。木桶裡滾出一個戴眼鏡的中年男人，舉起雙手：「我投降。」", ["def_cornered"], [hp(-0.2)]),
        },
        {
            "id": "trade", "title": "決定密探頭子的處置",
            "text": "密探頭子推了推眼鏡：「羅莎琳德將軍會很不高興。不過，她也是講道理的人——你們把我送回去，她會撤走南方丘陵的一個大隊。這是她親口說的價錢。」康斯坦絲看向你：「你抓到的，你說。」",
            "at": at_cell("albena", "lm_windoath_tower"), "requires": need("def_cornered"), "kind": "choice",
            "options": [
                {"label": "公開審判他", "success": done("密探頭子在風誓塔下當眾受審，帝國的密探網在阿爾貝納的名字被一個一個念出來。羅莎琳德沒有撤兵，也沒有進兵——她寫了一封信給康斯坦絲，只有一句話：「這一局，算妳贏。」", ["def_exposed"], [rep("aude_federation", 10), aff(CON, 10, "拆掉了帝國的密探網"), aff(KAI, 10, "一起抓到了密探頭子"), mem("在阿爾貝納抓到帝國第四軍團的密探頭子，當眾審判，拆掉了帝國在聯邦的密探網。", 3)])},
                {"label": "拿他換撤兵", "success": done("密探頭子被蒙上眼睛送出了城。一週後，南方丘陵的第四軍團撤走了一個大隊，帶走了一半的投石車。康斯坦絲在帳本上記下一筆：「一個人，換三千個人。划算。」", ["def_traded"], [rep("aude_federation", 5), rep("rhine_empire", 3), aff(CON, 10, "換到了撤兵"), money(1000), mem("把帝國第四軍團的密探頭子送回去，換來南方丘陵撤走一個大隊。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 蕾娜：太重的花束 ----------------
lena1 = {
    "id": "lena_good_friend",
    "title": "新的好朋友",
    "summary": "日輪廣場的賣花姑娘蕾娜，送了你一朵花。第二天，你在每個地方都看見了她。（蕾娜・一）",
    "tags": ["adult"],
    "rank": "D", "merit": 5,
    "start": {
        "kind": "npc", "npc": LENA, "min_level": 5,
        "text": "日輪廣場的花攤前，蕾娜把一朵白色的小花插在你的衣襟上，笑得像陽光一樣：「送你的！我叫蕾娜。」她歪著頭打量你，「你好像很孤單呢。從今天起，我們就是好朋友了——對吧？」",
    },
    "start_flags": ["lena_start"],
    "nodes": [
        {
            "id": "everywhere", "title": "在晨光城的旅店發現房間裡的花",
            "text": "那天晚上回到旅店，你的房間裡擺滿了花：枕頭上、窗台上、靴子裡。桌上有一張卡片：「你喜歡的應該是藍色的吧？你今天在廣場上看了藍色的花三次。——你的好朋友蕾娜」",
            "at": at_cell("dawnlight", "inn"), "requires": need("lena_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你冷靜地數了數：一百零八朵，每一朵都是你今天看過的花。你還發現，她知道你住哪間房、什麼時候回來、喜歡睡哪一邊的枕頭。", ["lena_flowers"]),
            "fail": step("你被花粉嗆得打了十幾個噴嚏，在床上發現一條繡著你名字的緞帶。", ["lena_flowers"]),
        },
        {
            "id": "thugs", "title": "在晨光城近郊替蕾娜趕走流氓",
            "text": "城外的花田裡，幾個流氓在踩蕾娜的花，要她交「保護費」。蕾娜站在花田中間，笑容一點也沒變——只是手裡多了一把修枝剪，握得很緊很緊。",
            "at": outskirts("dawnlight"), "requires": need("lena_flowers"), "kind": "combat",
            "enemies": [["street_thug", 3]],
            "success": step("流氓們逃走了。蕾娜放下修枝剪，撲進你懷裡：「我就知道你會來。你每次都會來，對不對？對不對？」她抱得很緊，緊得你有點喘不過氣。", ["lena_saved"]),
            "fail": step("你們被流氓打得狼狽，最後是蕾娜拿著修枝剪笑著走過去——流氓們看了她的眼神一眼，就跑了。「下次，」她溫柔地說，「讓我保護你吧。」", ["lena_saved"]),
        },
        {
            "id": "promise", "title": "回答蕾娜的問題",
            "text": "花田的夕陽裡，蕾娜拉著你的手，聲音甜甜的：「我的上一個好朋友，留了一封信就去旅行了。信上寫『太重了』。」她抬頭看著你，「我很重嗎？」",
            "at": at_npc(LENA), "requires": need("lena_saved"), "kind": "choice",
            "options": [
                {"label": "「一點點重，但我拿得動」", "success": done("蕾娜愣了一下，然後笑得比夕陽還燦爛：「那就說好了！」她在你的手背上親了一下，又親了一下，又親了一下。第二天，你的靴子裡多了一朵藍色的花，和一張寫著「早安」的卡片。", ["lena_1_done"], [aff(LENA, 15, "說拿得動她的重量"), mem("成了晨光城賣花姑娘蕾娜的「好朋友」，她說上一個好朋友嫌她太重。")])},
                {"label": "「是有點重，我們慢慢來」", "success": done("蕾娜的笑容停了一下，然後點了點頭：「慢慢來……好。」第二天，你的靴子裡只有一朵花——比昨天少了一百零七朵。卡片上寫著：「這樣有輕一點嗎？」", ["lena_1_done"], [aff(LENA, 10, "願意和她慢慢來")])},
            ],
        },
    ],
    "rewards": [money(200), xp(400)],
}

lena2 = {
    "id": "lena_runaway",
    "title": "逃到河谷鎮的人",
    "summary": "蕾娜的上一個「好朋友」逃到了河谷鎮。她說他只是去旅行了——她每天都去城門口等。（蕾娜・二）",
    "tags": ["adult"],
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": LENA, "min_affinity": 20, "min_level": 8, "requires": need("lena_1_done"),
        "text": "蕾娜把一封皺巴巴的信遞給你，信上只寫著「對不起，太重了」。「他在河谷鎮，」她笑著說，「我知道他住哪裡、每天什麼時候出門、早餐吃什麼。我一直沒有去找他。」她低下頭，「你替我去問問他……我到底哪裡太重了。」",
    },
    "start_flags": ["lena_ask"],
    "nodes": [
        {
            "id": "find", "title": "到河谷鎮的酒館找蕾娜的前任",
            "text": "河谷鎮的酒館裡，一個面容憔悴的年輕人聽到「蕾娜」兩個字，杯子差點掉在地上：「她……她還好嗎？她沒有來吧？」",
            "at": at_cell("rivervale", "tavern"), "requires": need("lena_ask"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("他叫湯姆，以前是晨光城的麵包學徒。他說蕾娜沒有做錯什麼：「她只是……把我的一切都記得太清楚了。我說過的每一句話、我喜歡的每一樣東西。我覺得我是她的全部——可我承擔不起當誰的全部。」", ["lena_truth"]),
            "fail": step("湯姆一開始什麼都不肯說，你請他喝了三杯酒，他才紅著眼睛說：「她把我記得太清楚了。我承擔不起當誰的全部。」", ["lena_truth"]),
        },
        {
            "id": "letter", "title": "請湯姆寫一封真正的信",
            "text": "湯姆盯著桌面很久：「那封信……我寫得太短了，對吧。」",
            "at": at_cell("rivervale", "tavern"), "requires": need("lena_truth"), "kind": "choice",
            "options": [
                {"label": "請他寫一封完整的信", "success": step("湯姆寫了一整晚，寫滿了三張紙。最後一行是：「謝謝妳記得我。希望妳也記得妳自己。」他把信交給你，像是放下了一塊石頭。", ["lena_letter"])},
                {"label": "請他親自回去說", "check": {"attr": "cha", "dc": 15},
                 "success": step("湯姆猶豫了很久，最後點頭：「……好。是我欠她的。」他沒有跟你一起走，但他說，下個月會回晨光城一趟，當面說清楚。", ["lena_letter", "lena_tom_visit"]),
                 "fail": step("湯姆搖頭：「我不敢。」他寫了一封信交給你，信很長，最後一行是：「希望妳也記得妳自己。」", ["lena_letter"])},
            ],
        },
        {
            "id": "back", "title": "回到晨光城把信交給蕾娜",
            "text": "城門口，蕾娜照常在那裡等。她看見你，笑著跑過來，然後看見了你手上的信。",
            "at": at_npc(LENA), "requires": need("lena_letter"), "kind": "story",
            "success": done("蕾娜讀了很久，讀完把信貼在胸口，第一次在你面前哭了：「我不知道……我以為記得一個人的一切，就是愛他。」她擦乾眼淚，看著你，「我想學。學著……把愛放輕一點。你願意陪我學嗎？」", ["lena_2_done"], [aff(LENA, 20, "把湯姆的信帶了回來"), mem("替蕾娜到河谷鎮找到她的前任湯姆，帶回一封真正的信。蕾娜說想學著把愛放輕一點。")]),
        },
    ],
    "rewards": [money(300), xp(900)],
}

lena3 = {
    "id": "lena_lighter_love",
    "title": "輕一點的愛",
    "summary": "蕾娜在學著把愛放輕一點：不跟著你、不數你看了幾次花。可是她城外的花田，出了事。（蕾娜・三）",
    "tags": ["adult"],
    "rank": "B", "merit": 8,
    "start": {
        "kind": "npc", "npc": LENA, "min_affinity": 30, "min_level": 11, "requires": need("lena_2_done"),
        "text": "你已經一個月沒在旅店的房間裡看見花了。蕾娜在花攤前看見你，笑了，卻沒有跑過來——她真的在學。可是今天，她的笑容有點勉強：「城外的花田……長出了不認識的花。會咬人的那種。」",
    },
    "start_flags": ["lena_field"],
    "nodes": [
        {
            "id": "thorns", "title": "在晨光城近郊的花田擊退狂暴的荊棘花妖",
            "text": "花田裡長出了比人還高的荊棘，血紅的花苞一張一合。蕾娜說，那是她種壞的一批種子——她那陣子太傷心，每天都對著花哭。",
            "at": outskirts("dawnlight"), "requires": need("lena_field"), "kind": "combat",
            "enemies": [["thorn_bloom", 2]],
            "success": step("荊棘花妖枯萎了。蕾娜蹲在花田裡，撿起一顆沒有被污染的種子：「它們只是……長得太用力了。像我一樣。」", ["lena_cleared"]),
        },
        {
            "id": "answer", "title": "在晨光城的花田回答蕾娜",
            "text": "夕陽下，蕾娜把那顆種子種回了土裡。「我學會了一點點，」她說，「不去數你看了幾次花、不去記你的每一句話。」她轉過身來，眼睛亮亮的，「可是我還是很想——很想很想——一直在你身邊。這樣也太重嗎？」",
            "at": at_npc(LENA), "requires": need("lena_cleared"), "kind": "choice",
            "options": [
                {"label": "「這樣剛剛好」", "success": done("蕾娜笑著撲進你懷裡，這一次，抱得剛剛好。那天晚上，她把白色蕾絲的洋裝一顆一顆解開，紅著臉說：「這個……我也記得你喜歡哪一種。只有這件事，讓我記得吧。」", ["lena_lover"], [aff(LENA, 20, "說她的愛剛剛好"), mem("賣花姑娘蕾娜學會了把愛放輕一點，成了你的戀人。", 3)])},
                {"label": "「重一點也沒關係，我喜歡」", "success": done("蕾娜愣住了，然後笑得像陽光一樣：「真的？那……一百零八朵花，還可以嗎？」第二天，你的房間又被花淹沒了——只是這一次，每一朵都綁著一張寫著「我愛你」的卡片。", ["lena_lover"], [aff(LENA, 20, "接受了她全部的重量"), mem("賣花姑娘蕾娜成了你的戀人。你說她重一點也沒關係。", 3)])},
            ],
        },
    ],
    "rewards": [money(300), xp(1800)],
}

# ---------------- 瓦萊莉：臨床樣本 ----------------
val1 = {
    "id": "valerie_sample",
    "title": "臨床樣本",
    "summary": "治癒者學院的研究醫師瓦萊莉，她的禁書論文缺少臨床樣本。她一本正經地問你：願不願意當她的研究對象。（瓦萊莉・一）",
    "tags": ["adult"],
    "rank": "D", "merit": 5,
    "start": {
        "kind": "npc", "npc": VAL, "min_level": 5,
        "text": "瓦萊莉拿著一本病歷夾，上下打量你，像在看一具解剖標本：「體格良好，傷疤分布顯示近期有頻繁的戰鬥。」她推了推眼鏡，「我的論文〈論性交對傷勢癒合速度的影響〉缺少臨床樣本。你願意當我的研究對象嗎？報酬照學院的標準。」",
    },
    "start_flags": ["val_start"],
    "nodes": [
        {
            "id": "baseline", "title": "到晨光城的治癒者學院做基礎檢查",
            "text": "瓦萊莉的研究室裡擺滿了玻璃瓶與人體解剖圖。她戴上手套：「先做基礎檢查。請脫衣服。全部。」她說得像在說「請坐」。",
            "at": at_cell("dawnlight", "lm_healers_academy"), "requires": need("val_start"), "kind": "check",
            "check": {"attr": "str", "dc": 13},
            "success": step("你撐過了體能測試、反射測試，以及一些她堅持「有醫學必要」的測試。瓦萊莉在病歷上寫了很久：「優秀。非常優秀。」她的耳朵有一點點紅，你不確定是不是錯覺。", ["val_baseline"], [aff(VAL, 5, "通過了基礎檢查")]),
            "fail": step("你在反射測試時跳了起來，撞翻了一整排玻璃瓶。瓦萊莉面不改色地記下：「樣本反應過度敏感。值得觀察。」", ["val_baseline"]),
        },
        {
            "id": "field", "title": "陪瓦萊莉到晨霧修道院中層採集傷勢樣本",
            "text": "「論文需要對照組，」瓦萊莉說，「受傷之後，用一般的治療術，和……另一種方法，比較癒合速度。」她指著修道院中層的霧影靈體，「所以，請你受一點傷。不要太重。」",
            "at": at_dun("mist_abbey", "middle"), "requires": need("val_baseline"), "kind": "combat",
            "enemies": [["mist_wraith", 2]], "allies": [VAL],
            "success": step("霧影靈體散了。你的手臂上多了兩道傷口，瓦萊莉滿意地點頭：「很好，深度適中。今晚，我們做對照實驗。」", ["val_wounded"]),
            "fail": step("你們被逼出了修道院，你身上的傷比計畫的多了一倍。瓦萊莉一邊包紮一邊說：「樣本數增加了。今晚的實驗會很有價值。」", ["val_wounded"]),
        },
        {
            "id": "experiment", "title": "在治癒者學院參與瓦萊莉的對照實驗",
            "text": "那天晚上，研究室只點了一盞燈。瓦萊莉解開白袍，表情和白天一模一樣：「左臂用治療術，右臂用另一種方法。我會每隔一刻鐘記錄一次癒合的程度。」她停了一下，「……這是為了研究。」",
            "at": at_cell("dawnlight", "lm_healers_academy"), "requires": need("val_wounded"), "kind": "choice",
            "options": [
                {"label": "配合實驗", "success": done("那一夜，瓦萊莉記錄得非常仔細，直到某一刻，筆從她手裡掉了下去，她也沒有去撿。天亮時，她看著你右臂上已經癒合的傷口，聲音有點啞：「……數據顯著。需要重複實驗。」", ["val_1_done"], [aff(VAL, 15, "成了她的臨床樣本"), mem("成了治癒者學院研究醫師瓦萊莉的「臨床樣本」，對照實驗的數據很顯著。")])},
                {"label": "問她是不是真的只為了研究", "success": done("瓦萊莉愣了很久，眼鏡後面的眼睛眨了眨：「……我不知道。這不在我的研究範圍。」她把病歷夾抱在胸前，「但我會把它列為下一個研究題目。」那一夜的實驗，她沒有記錄。", ["val_1_done"], [aff(VAL, 10, "問了一個她答不出來的問題")])},
            ],
        },
    ],
    "rewards": [money(200), xp(400)],
}

val2 = {
    "id": "valerie_stolen_paper",
    "title": "被偷走的論文",
    "summary": "瓦萊莉的實驗記錄被人偷了。如果它被公開，學院會開除她——小偷要她拿錢來贖。（瓦萊莉・二）",
    "tags": ["adult"],
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": VAL, "min_affinity": 20, "min_level": 8, "requires": need("val_1_done"),
        "text": "瓦萊莉第一次在你面前慌了：「實驗記錄被偷了。全部。包括……你的部分。」她遞給你一張勒索信，「他們要五百白鸛，否則就把記錄貼在學院的大門上。院長托比亞斯會昏倒的。」",
    },
    "start_flags": ["val_stolen"],
    "nodes": [
        {
            "id": "trace", "title": "到晨光城的情報商追查偷論文的人",
            "text": "情報商看了一眼勒索信上的字跡：「這筆跡我認得。學院裡有個想當院長想瘋了的副教授，最近雇了幾個打手。」",
            "at": at_cell("dawnlight", "informant"), "requires": need("val_stolen"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("情報商告訴你：打手們今晚會在城外的舊倉庫等著收贖金，副教授本人不會出現。", ["val_lead"]),
            "fail": step("情報商只說了一個地點：城外的舊倉庫，今晚。", ["val_lead"]),
        },
        {
            "id": "warehouse", "title": "在晨光城近郊的舊倉庫搶回實驗記錄",
            "text": "舊倉庫裡，兩個打手正一邊翻著實驗記錄一邊大笑。「這段寫得真詳細——『樣本在第三刻鐘時』……」他們看見你，把記錄往懷裡一塞，「錢帶來了嗎？」",
            "at": outskirts("dawnlight"), "requires": need("val_lead"), "kind": "combat",
            "enemies": [["hired_thug", 2]],
            "success": step("打手們倒下了。實驗記錄一頁不少，最底下還壓著一封副教授寫的指示信——足夠讓他自己被學院開除。", ["val_back"]),
            "fail": step("打手們跑了，卻把實驗記錄丟在了地上——太重了，跑不快。副教授的指示信也夾在裡面。", ["val_back"]),
        },
        {
            "id": "return", "title": "把實驗記錄還給瓦萊莉",
            "text": "瓦萊莉抱著實驗記錄，鬆了一口氣，然後翻到「你的部分」，臉一下子紅透了：「……你看了嗎？」",
            "at": at_npc(VAL), "requires": need("val_back"), "kind": "choice",
            "options": [
                {"label": "「看了，寫得很好」", "success": done("瓦萊莉把臉埋進記錄裡，悶悶地說：「……第一次有人說我寫得好。」那天晚上，她說要「補做」被偷走期間的實驗，一直補到天亮。", ["val_2_done"], [aff(VAL, 15, "說她的記錄寫得很好"), mem("替瓦萊莉搶回了被偷的實驗記錄，還說她寫得很好。")])},
                {"label": "「沒看，那是妳的研究」", "success": done("瓦萊莉看了你很久，然後輕輕把記錄放在你手上：「……那現在看吧。我想知道，樣本本人的意見。」", ["val_2_done"], [aff(VAL, 15, "尊重了她的研究")])},
            ],
        },
    ],
    "rewards": [money(300), xp(900)],
}

val3 = {
    "id": "valerie_hearing",
    "title": "學院的聽證會",
    "summary": "瓦萊莉的論文還是傳開了。治癒者學院召開聽證會，要決定她能不能留下來。她需要一位證人——樣本本人。（瓦萊莉・三）",
    "tags": ["adult"],
    "rank": "B", "merit": 8,
    "start": {
        "kind": "npc", "npc": VAL, "min_affinity": 30, "min_level": 11, "requires": need("val_2_done"),
        "text": "瓦萊莉拿著一份聽證會的通知，手指在發抖：「論文還是傳開了。院長說，聽證會上如果沒有證人證明我的數據是真的，學院只能開除我。」她深吸一口氣，「……我需要樣本本人出席。你願意嗎？」",
    },
    "start_flags": ["val_hearing"],
    "nodes": [
        {
            "id": "testify", "title": "在治癒者學院的聽證會上作證",
            "text": "聽證廳裡坐滿了白髮的老教授，院長托比亞斯坐在正中間，看起來比瓦萊莉還緊張。一位老教授敲著桌子：「這種東西也配叫研究？樣本是誰？請他站出來。」",
            "at": at_cell("dawnlight", "lm_healers_academy"), "requires": need("val_hearing"), "kind": "check",
            "check": {"attr": "cha", "dc": 17},
            "success": step("你站了出來，把手臂上的兩道傷疤給所有人看：一道用治療術，留下了疤；一道用「另一種方法」，幾乎看不見了。聽證廳安靜了很久。托比亞斯院長清了清喉嚨：「……數據，確實很顯著。」", ["val_proved"]),
            "fail": step("你說得結結巴巴，老教授們在冷笑。最後是瓦萊莉自己站了起來，把三百頁的數據一頁一頁念完。念到第兩百頁，有兩位老教授開始記筆記。", ["val_proved"]),
        },
        {
            "id": "verdict", "title": "聽證會之後，回答瓦萊莉",
            "text": "學院決定讓瓦萊莉留下來，論文改列「限閱」而不是「禁書」。散會後，她在研究室裡把白袍脫下來掛好，轉過身看著你，難得地沒有拿病歷夾：「我研究了很久，還是不知道那個問題的答案——我是不是只為了研究。」她走近一步，「所以我想換個方法。不記錄的那種。」",
            "at": at_npc(VAL), "requires": need("val_proved"), "kind": "choice",
            "options": [
                {"label": "「那就不記錄」", "success": done("那一夜，研究室的燈一直亮著，病歷夾一直闔著。天亮時，瓦萊莉靠在你肩上，第一次說了一句不像病歷的話：「……我好像，喜歡你。這個結論，不需要重複實驗。」", ["val_lover"], [aff(VAL, 20, "陪她找到了答案"), mem("在治癒者學院的聽證會上替瓦萊莉作證，她留在學院，成了你的戀人。", 3)])},
                {"label": "「記錄吧，我想看妳寫的結論」", "success": done("瓦萊莉愣了一下，然後笑了——你第一次看見她笑。她翻開一本新的病歷夾，在第一頁寫下：「研究對象：戀人。研究期限：無。」", ["val_lover"], [aff(VAL, 20, "想看她寫的結論"), mem("在治癒者學院的聽證會上替瓦萊莉作證，她在新的病歷夾上寫下：研究對象，戀人。", 3)])},
            ],
        },
    ],
    "rewards": [money(500), xp(1800)],
}

# ---------------- 伊芙：女僕長的休假 ----------------
eve1 = {
    "id": "eve_holiday",
    "title": "女僕長的休假",
    "summary": "霍恩海姆家的女僕長伊芙，一百五十年來第一次被命令休假。她不知道休假要做什麼，於是決定把它「辦好」。（伊芙・一）",
    "tags": ["adult"],
    "rank": "D", "merit": 5,
    "start": {
        "kind": "npc", "npc": EVE, "min_level": 5,
        "text": "伊芙站得筆直，用最恭敬的語氣說：「大小姐命令我休假三天。我服侍霍恩海姆家一百五十年，從來沒有休過假。」她頓了頓，「我不知道休假該做什麼。您看起來很閒——請您指導我。這是請求，不是命令。大概。」",
    },
    "start_flags": ["eve_start"],
    "nodes": [
        {
            "id": "serve", "title": "在萊茵堡的酒館試著服侍伊芙",
            "text": "你帶伊芙到酒館，讓她坐下，由你來點菜、倒茶。伊芙坐得筆直，看著你倒茶的手，眉頭越皺越緊：「茶壺的角度偏了七度。杯子沒有溫過。您的拇指……」她深吸一口氣，「……抱歉。請您繼續。」",
            "at": at_cell("rhineburg", "tavern"), "requires": need("eve_start"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": step("你照她說的重倒了一次。這一次，伊芙端起茶杯，喝了一口，沉默了很久：「……被人倒茶，原來是這種感覺。」她的耳尖——精靈尖尖的耳尖——紅了。", ["eve_served"], [aff(EVE, 10, "替她倒了一杯合格的茶")]),
            "fail": step("你打翻了茶壺。伊芙一言不發地起身，三秒內把桌子收拾乾淨，重新泡了一壺，然後才想起自己在休假，僵在原地。你們對看了很久，她忽然笑了出來。", ["eve_served"], [aff(EVE, 5, "讓她笑了出來")]),
        },
        {
            "id": "picnic", "title": "陪伊芙在萊茵堡近郊野餐",
            "text": "第二天，你帶伊芙到城外野餐——她堅持自己準備了三層的便當。剛鋪好餐巾，幾個流氓就從林子裡晃了出來：「好香啊，小姐。分我們一點？」伊芙放下茶杯，看了看你，又看了看流氓：「我在休假。您能處理嗎？」",
            "at": outskirts("rhineburg"), "requires": need("eve_served"), "kind": "combat",
            "enemies": [["street_thug", 3]],
            "success": step("流氓們逃走了。伊芙替你擦掉臉上的泥，動作熟練得像做了一百五十年：「處理得很好。」她頓了一下，「……謝謝。」", ["eve_picnic"]),
            "fail": step("你被流氓打倒在餐巾上。伊芙嘆了一口氣，站起來，用一把餐刀和三秒鐘處理完了一切，然後坐回原位：「……我好像不太會休假。」", ["eve_picnic"]),
        },
        {
            "id": "last_day", "title": "在伊芙休假的最後一天回答她",
            "text": "休假的最後一天傍晚，伊芙在侯爵府的後門前停下：「三天過得比一百五十年還快。」她轉過身，用一點也不恭敬的語氣說，「下次休假，您還會來嗎？」",
            "at": at_npc(EVE), "requires": need("eve_picnic"), "kind": "choice",
            "options": [
                {"label": "「會，我還要學怎麼倒茶」", "success": done("伊芙的嘴角翹了一下，又迅速恢復成女僕長的表情：「那麼，我會向大小姐申請——每個月休假一天。」她行了一個完美的禮，然後在關門前小聲補了一句，「……請一定要來。」", ["eve_1_done"], [aff(EVE, 15, "答應陪她下次休假"), mem("陪霍恩海姆家的女僕長伊芙度過了她一百五十年來第一次的休假。")])},
                {"label": "「妳不用等休假才見我」", "success": done("伊芙愣住了。一百五十年來第一次，她不知道該怎麼回答。最後她只是行了一個禮——比平常深了一點——然後轉身進了門。第二天，你的旅店房門口多了一個便當。", ["eve_1_done"], [aff(EVE, 15, "說她不用等休假")])},
            ],
        },
    ],
    "rewards": [money(200), xp(400)],
}

eve2 = {
    "id": "eve_tea_house",
    "title": "米米的紅茶店",
    "summary": "伊芙聽說晨光城有個貓魅族的女孩想開一間「大家都喝得到好紅茶」的店。她說想去看看——以專業的眼光。（伊芙・二）",
    "tags": ["adult"],
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": EVE, "min_affinity": 20, "min_level": 8, "requires": need("eve_1_done"),
        "text": "伊芙把一張傳單放在你面前，上面畫著一隻歪歪扭扭的貓和一杯紅茶：「晨光城有人想開一間『大家都喝得到好紅茶』的店。」她推了推傳單，「我想去看看。以專業的眼光。這次的休假，請您陪我。」",
    },
    "start_flags": ["eve_tea"],
    "nodes": [
        {
            "id": "mimi", "title": "在晨光城找開紅茶店的米米",
            "text": "米米是個貓魅族的女孩，耳朵上別著一朵小花，正在一個簡陋的攤子上泡茶。伊芙喝了一口，沉默了很久。米米緊張得尾巴都豎了起來：「怎、怎麼樣喵？」",
            "at": at_npc(MIMI), "requires": need("eve_tea"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("你替米米說了好話，伊芙也點了頭：「茶葉普通，水溫完美。」她從圍裙口袋裡拿出一本筆記，「這是霍恩海姆家的茶譜。借妳抄。」米米抱著筆記本哭了。", ["eve_mimi"], [aff(MIMI, 10, "替她的紅茶說了好話")]),
            "fail": step("伊芙毫不留情地挑出了七個毛病。米米的耳朵垂了下來——然後伊芙拿出一本筆記：「所以，妳需要這個。」", ["eve_mimi"]),
        },
        {
            "id": "racket", "title": "在晨光城近郊擋下收保護費的打手",
            "text": "傍晚，幾個打手晃到米米的攤子前：「新開的？保護費交了沒？」米米縮成一團。伊芙放下茶杯，站起來，然後想起自己在休假，看向你。",
            "at": outskirts("dawnlight"), "requires": need("eve_mimi"), "kind": "combat",
            "enemies": [["hired_thug", 2]],
            "success": step("打手們落荒而逃。米米撲上來抱住你，又撲上去抱住伊芙。伊芙僵在原地，像一根柱子。", ["eve_safe"]),
            "fail": step("你被打手們打倒了。伊芙嘆了一口氣，用一個托盤處理完了剩下的事。米米看著她，眼睛發亮：「女僕好帥喵……」", ["eve_safe"]),
        },
        {
            "id": "dream", "title": "聽米米說她的夢想",
            "text": "米米替你們泡了一壺新的茶——照著霍恩海姆家的茶譜。「我想開一間店，」她說，「有女僕的那種。讓每個人都能被好好地服侍一次。」她看著伊芙，「妳……願意偶爾來幫忙嗎？」伊芙看向你。",
            "at": at_npc(MIMI), "requires": need("eve_safe"), "kind": "choice",
            "options": [
                {"label": "「去吧，我會去當客人」", "success": done("伊芙沉默了很久，然後對米米行了一個完美的禮：「休假的時候。」回萊茵堡的馬車上，她靠在你肩上睡著了——一百五十年來，第一次在別人面前睡著。", ["eve_2_done", "eve_cafe"], [aff(EVE, 15, "支持她去幫米米"), aff(MIMI, 10, "答應去當客人"), mem("陪伊芙在晨光城認識了想開紅茶店的米米，伊芙答應休假時去幫忙。")])},
                {"label": "「這是妳的休假，妳決定」", "success": done("伊芙想了很久：「……我想試試看。」她轉向米米，「但第一個客人，必須是他。」米米用力點頭，尾巴甩得像風車。", ["eve_2_done", "eve_cafe"], [aff(EVE, 15, "讓她自己決定"), aff(MIMI, 5, "陪伊芙來看她")])},
            ],
        },
    ],
    "rewards": [money(300), xp(900)],
}

eve3 = {
    "id": "eve_master",
    "title": "女僕長的主人",
    "summary": "侯爵要把伊芙送去別的貴族家——作為一份「體面的禮物」。伊芙第一次違抗了命令。（伊芙・三）",
    "tags": ["adult"],
    "rank": "B", "merit": 8,
    "start": {
        "kind": "npc", "npc": EVE, "min_affinity": 30, "min_level": 11, "requires": need("eve_2_done"),
        "text": "伊芙站在你的旅店門口，手裡提著一只小小的行李箱，背挺得筆直：「侯爵要把我送給公爵家，作為『體面的禮物』。」她的聲音很平靜，「一百五十年來，我第一次說了『不』。」她低下頭，「我無處可去。可以……收留我嗎？」",
    },
    "start_flags": ["eve_free"],
    "nodes": [
        {
            "id": "knights", "title": "在萊茵堡的城門擋下侯爵府的騎士",
            "text": "城門前，侯爵府的騎士舉著火把攔住了你們：「女僕長，侯爵說，一個女僕沒有資格說『不』。」伊芙站在你身後，第一次沒有站得筆直——她抓著你的袖子。",
            "at": at_cell("rhineburg", "gate"), "requires": need("eve_free"), "kind": "combat",
            "enemies": [["hohenheim_knight", 3]],
            "success": step("騎士們倒在城門下。伊芙看著他們，輕輕說了一句：「……替我向大小姐問好。」", ["eve_out"]),
        },
        {
            "id": "serve", "title": "回答伊芙的請求",
            "text": "城外的小旅店裡，伊芙打開行李箱，裡面只有三套女僕裝和一套茶具。她跪坐在你面前，用最恭敬的語氣說：「從今天起，請讓我服侍您。」然後，用一點也不恭敬的語氣補了一句，「……但是，您也要學著服侍我。這是條件。」",
            "at": outskirts("rhineburg"), "requires": need("eve_out"), "kind": "choice",
            "options": [
                {"label": "「好，我們互相服侍」", "success": done("伊芙笑了——不是女僕長的微笑，是一個一百五十歲的精靈少女的笑。那天晚上，她把一百五十年來沒有人越過的防線，交到了你的手上，並且把「服侍」做得同樣完美。", ["eve_lover"], [aff(EVE, 20, "答應互相服侍"), mem("伊芙違抗了侯爵的命令，選擇留在你身邊。從此你們互相服侍。", 3)])},
                {"label": "「妳不用服侍任何人，跟我走就好」", "success": done("伊芙愣了很久。「不用服侍任何人……」她把這句話在嘴裡轉了一圈，然後搖頭，「不行，我會不知道該怎麼活。」她站起來，替你倒了一杯茶——角度完美，「所以，請讓我服侍您。直到您學會。」", ["eve_lover"], [aff(EVE, 20, "說她不用服侍任何人"), {"type": "companion", "npc": EVE, "mode": "voluntary"}, mem("伊芙違抗了侯爵的命令，跟著你一起旅行。她說要服侍你，直到你學會服侍她。", 3)])},
            ],
        },
    ],
    "rewards": [money(500), xp(1800)],
}

BATCH7 = [annex1, annex2, annex3, spy1, spy2, spy3, def1, def2, def3, lena1, lena2, lena3, val1, val2, val3, eve1, eve2, eve3]
