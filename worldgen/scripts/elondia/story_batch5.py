"""第五批特殊任務：沿海渡口的港口所有權、河谷鎮的流水之靈、艾蜜莉亞（成人向・非處女）。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need

MAR, AME, OSW = 'npc_marina', 'npc_amelia', 'npc_oswin_bridge'
COND = lambda c: {"type": "condition", "target": "pc", "condition": c, "add": True}

# ---------------- 沿海渡口：港口所有權 ----------------
port1 = {
    "id": "port_seized_ship",
    "title": "被扣押的海燕號",
    "summary": "沒有船的船長瑪琳娜，她的海燕號被債主扣在沿海渡口。債主是誰，好像沒有人說得清楚。（港口所有權・一）",
    "rank": "D",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": MAR, "min_level": 5,
        "text": "瑪琳娜把一張蓋滿印章的債據拍在桌上：「我的海燕號被扣了快一年。債主換了三次名字，每次去問，都說『新東家』還沒決定要不要賣回給我。」她咬牙，「這半年，渡口一半的碼頭都換了『新東家』。你不覺得奇怪嗎？」",
    },
    "start_flags": ["port_start"],
    "nodes": [
        {
            "id": "ledger", "title": "到沿海渡口的酒館打聽碼頭的新東家",
            "text": "海鷗亭裡，碼頭工人們抱怨著新的租金。你一桌一桌地問：買下碼頭的到底是誰？",
            "at": at_cell("coast_ferry", "tavern"), "requires": need("port_start"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": {
                "text": "一個喝醉的帳房先生說溜了嘴：所有的契約最後都簽給同一家「聖帆商會」，商會的錢從索里耶爾來。他們要的不是碼頭——是一個能停下一整支艦隊的港口。",
                "set_flags": ["port_lead"],
            },
            "fail": {
                "text": "沒有人肯多說，但你注意到每張租約上都蓋著同一個印：一面帆，帆上有個聖環。",
                "set_flags": ["port_lead"],
            },
        },
        {
            "id": "dock", "title": "在沿海渡口近郊的倉庫找到海燕號的契約",
            "text": "渡口外的倉庫裡堆著聖帆商會的貨，海燕號的契約就鎖在帳房的鐵櫃裡。幾個碼頭的打手正在門口抽菸，看見你們，把菸踩熄了：「商會的倉庫，閒人勿近。」",
            "at": outskirts("coast_ferry"), "requires": need("port_lead"), "kind": "combat",
            "enemies": [["dock_enforcer", 3]],
            "success": {
                "text": "打手們倒下了。鐵櫃裡除了海燕號的契約，還有一份清單：渡口所有碼頭的收購進度，最後一行寫著「待聖戰艦隊進港」。",
                "set_flags": ["port_deed"],
            },
            "fail": {
                "text": "打手們把你們趕了出來，但瑪琳娜趁亂從窗戶鑽了進去，抱著一疊文件跑出來：海燕號的契約，還有一份寫著「待聖戰艦隊進港」的清單。",
                "set_flags": ["port_deed"],
            },
        },
        {
            "id": "ship", "title": "回到沿海渡口告訴瑪琳娜",
            "text": "瑪琳娜看著那份清單，臉色越來越沉：「聖戰艦隊……教廷想從這裡出海，繞過南境的停戰線。」她把海燕號的契約捏在手裡，「商會的人昨晚來找過我：只要我閉嘴，船還我，債也一筆勾銷。」",
            "at": at_npc(MAR), "requires": need("port_deed"), "kind": "choice",
            "options": [
                {
                    "label": "把清單公開給渡口的人看",
                    "success": {
                        "text": "清單在海鷗亭裡傳了一整晚。第二天，碼頭工人們拒絕替聖帆商會卸貨，渡口的鎮長宣布暫停所有的碼頭買賣。瑪琳娜拿回了海燕號——雖然船帆破了一半：「債我自己會還。這艘船，不會載聖戰的兵。」",
                        "set_flags": ["port_1_done", "port_exposed"],
                        "counters": {"human_stance": 1},
                        "effects": [aff(MAR, 15, "替她拿回了海燕號"), rep("holy_ring", -3), mem("在沿海渡口揭穿了聖帆商會替教廷收購碼頭、準備讓聖戰艦隊進港的計畫，替瑪琳娜拿回了海燕號。")],
                        "complete": True,
                    },
                },
                {
                    "label": "勸她收下商會的條件",
                    "success": {
                        "text": "瑪琳娜沉默了很久，最後把清單丟進火盆：「……我只想要我的船。」第二天，海燕號掛上了新帆，帆角上繡著一個小小的聖環。渡口的碼頭，一座接一座換上了同樣的印。",
                        "set_flags": ["port_1_done", "port_deal"],
                        "counters": {"human_stance": -1},
                        "effects": [aff(MAR, 5, "幫她拿回了船"), rep("holy_ring", 3), mem("勸瑪琳娜收下聖帆商會的條件，她拿回了海燕號，渡口的碼頭一座接一座落入教廷手中。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

port2 = {
    "id": "port_lighthouse",
    "title": "燈塔的夜火",
    "summary": "一艘帝國商船今晚要進港，有人想讓渡口燈塔的火熄掉。（港口所有權・二）",
    "rank": "C",
    "merit": 10,
    "start": {
        "kind": "informant", "location": "coast_ferry", "price": 300, "min_level": 8, "requires": need("port_1_done"),
        "text": "情報商壓低聲音：「今晚有一艘帝國的商船要進港，船上載的據說是宰相要送去灰港鎮的『禮物』——送給魔族的。有人出了大價錢，要燈塔的火在船進港的時候熄掉。」",
    },
    "start_flags": ["port_night"],
    "nodes": [
        {
            "id": "helen", "title": "到沿海渡口的燈塔找海倫婆婆",
            "text": "海倫婆婆正在替燈芯加油，聽完你的話，只是笑了笑：「三十年來，有人花錢要我熄燈，有人花錢要我多點一盞。我的丈夫就是死在一個沒有燈的晚上。」她把油壺放下，「今晚，燈不會熄。」",
            "at": at_cell("coast_ferry", "lm_ferry_lighthouse"), "requires": need("port_night"), "kind": "story",
            "success": {
                "text": "她讓你們守在燈塔下面：「他們會從崖邊的小路上來。我老了，打不動了。」",
                "set_flags": ["port_watch"],
            },
        },
        {
            "id": "saboteurs", "title": "在沿海渡口的燈塔擋下來熄燈的人",
            "text": "半夜，兩個披著斗篷的人從崖邊的小路爬上來，手裡提著水桶與沙袋。斗篷下露出審判廷的印章：「為了不讓異端的禮物送到魔族手上，這盞燈必須熄。」",
            "at": at_cell("coast_ferry", "lm_ferry_lighthouse"), "requires": need("port_watch"), "kind": "combat",
            "enemies": [["cloister_questioner", 2]],
            "success": {
                "text": "審問官們倒下了，燈塔的火一夜都沒熄。天亮時，帝國的商船安然停進了港口，船長派人送來一桶上好的葡萄酒。",
                "set_flags": ["port_ship_safe"],
            },
            "fail": {
                "text": "你們被逼到燈室的門口。審問官正要潑水，海倫婆婆抄起一根燈芯鉗朝他們的手敲了下去——燈塔的火，一夜都沒熄。",
                "set_flags": ["port_ship_safe"],
            },
        },
        {
            "id": "cargo", "title": "在沿海渡口決定帝國商船的去向",
            "text": "帝國的船長把你請上船，打開了一個箱子：裡面是種子、藥草與一封蓋著宰相印的信——給灰港鎮魔族的「停戰之禮」。「我們還要往南開三天。」他看著你，「如果你去告訴教廷，這艘船就到不了。」",
            "at": outskirts("coast_ferry"), "requires": need("port_ship_safe"), "kind": "choice",
            "options": [
                {
                    "label": "讓船出港",
                    "success": {
                        "text": "海燕號——瑪琳娜堅持要護航——陪著帝國的商船駛出了港口。三週後，灰港鎮傳來消息：魔族的鎮長收下了禮物，回贈了一箱南境的火晶。",
                        "set_flags": ["port_2_done", "port_gift"],
                        "counters": {"human_stance": 1, "demon_stance": 1},
                        "effects": [rep("rhine_empire", 5), aff(MAR, 5, "讓她護航"), mem("在沿海渡口守住了燈塔，讓帝國送給灰港鎮魔族的停戰之禮出了港。")],
                        "complete": True,
                    },
                },
                {
                    "label": "向教廷告發",
                    "success": {
                        "text": "教廷的船在港外攔下了商船，箱子被丟進了海裡。灰港鎮等了一個月，什麼都沒等到；南境開始流傳一句話：「人類的禮物，從來不會到。」",
                        "set_flags": ["port_2_done", "port_sunk"],
                        "counters": {"human_stance": -1, "demon_stance": -1},
                        "effects": [rep("holy_ring", 5), rep("rhine_empire", -3), mem("在沿海渡口向教廷告發了帝國送給魔族的停戰之禮，箱子被丟進了海裡。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

port3 = {
    "id": "port_charter",
    "title": "港口的特許狀",
    "summary": "晨曦王國要決定沿海渡口的特許狀：交給商人做自由港，還是交給教廷當聖戰艦隊的港口。（港口所有權・三）",
    "rank": "B",
    "merit": 15,
    "start": {
        "kind": "guild", "location": "coast_ferry", "min_level": 11, "requires": need("port_2_done"),
        "text": "公會收到一份蓋著晨曦王國印璽的通知：王國要在沿海渡口召開港口會議，決定渡口的特許狀交給誰。商人們想要一個像潮汐港那樣的自由港，教廷想要一個能停下聖戰艦隊的軍港。瑪琳娜被推舉為碼頭工人的代表——她指名要你當護衛。",
    },
    "start_flags": ["port_council"],
    "nodes": [
        {
            "id": "gate", "title": "在沿海渡口的城門擋下狂信的騎士",
            "text": "會議前夜，一隊黑環狂信騎士在城門集結，要「在異端的港口會議開始之前，讓碼頭工人的代表閉嘴」。",
            "at": at_cell("coast_ferry", "gate"), "requires": need("port_council"), "kind": "combat",
            "enemies": [["zealot_templar", 3]],
            "success": {
                "text": "狂信騎士們倒在城門下。瑪琳娜拍了拍你的肩：「明天，該我上場了。」",
                "set_flags": ["port_safe"],
            },
            "fail": {
                "text": "你們撐不住了，所幸碼頭工人們舉著魚叉與船槳衝了過來，把狂信騎士們趕出了城。",
                "set_flags": ["port_safe"], "effects": [hp(-0.2)],
            },
        },
        {
            "id": "charter", "title": "在港口會議上替瑪琳娜說話",
            "text": "渡口的倉庫被布置成會議廳。王國的特使坐在中間，左邊是商人，右邊是教廷的主教。瑪琳娜站在碼頭工人的最前面，緊張得手心冒汗，回頭看了你一眼：「你來說吧。你比我會說話。」",
            "at": at_npc(MAR), "requires": need("port_safe"), "kind": "choice",
            "options": [
                {
                    "label": "主張自由港",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "「港口是讓船回家的地方，不是讓兵出發的地方。」你說。王國的特使看了看碼頭工人，又看了看主教，在特許狀上寫下了「自由港」三個字。瑪琳娜被推舉為第一任港務長，她抱著你轉了一圈。",
                        "set_flags": ["port_free"], "counters": {"human_stance": 1},
                        "effects": [rep("dawn_kingdom", 5), aff(MAR, 15, "替碼頭工人說話"), mem("在沿海渡口的港口會議上替碼頭工人說話，渡口成了自由港，瑪琳娜當上了港務長。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你的話被主教駁得體無完膚，但瑪琳娜接著站了出來，結結巴巴地說了十分鐘。最後特使嘆了口氣：「自由港——但教廷的船可以優先靠岸。」",
                        "set_flags": ["port_free"], "counters": {"human_stance": 1},
                        "effects": [rep("dawn_kingdom", 3), aff(MAR, 10, "陪她站上會議"), mem("在沿海渡口的港口會議上，渡口勉強成了自由港。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "主張交給教廷",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "「魔族在南邊磨刀。人類需要一個能出海的港口。」主教帶頭鼓掌，特使在特許狀上寫下了「聖環艦隊母港」。瑪琳娜看著你，什麼都沒說，轉身走出了倉庫。",
                        "set_flags": ["port_fleet"], "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 5), aff(MAR, -15, "把港口交給了教廷"), mem("在沿海渡口的港口會議上主張把港口交給教廷，渡口成了聖環艦隊的母港。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你說得不夠有力，但主教接過了話頭。特使最後把渡口一分為二：北碼頭歸商人，南碼頭歸教廷的艦隊。",
                        "set_flags": ["port_fleet"], "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 3), aff(MAR, -5, "沒有替碼頭工人說話"), mem("在沿海渡口的港口會議上，南碼頭成了聖環艦隊的港口。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 河谷鎮：流水之靈 ----------------
spr1 = {
    "id": "spirit_river_girl",
    "title": "河面上的少女",
    "summary": "河谷鎮的漁夫說，夜裡的河面上站著一個透明的少女。舊石橋上的誓約，據說都由「流水之靈」見證。（流水之靈・一）",
    "rank": "D",
    "merit": 6,
    "start": {
        "kind": "guild", "location": "rivervale", "min_level": 5,
        "text": "公會的告示板上貼著漁夫們的聯名委託：這幾個月河裡的魚越來越少，夜裡的河面上還常常站著一個透明的少女，一碰就散。守橋人奧斯溫在委託單的角落加了一行字：「她是流水之靈。她在變弱。」",
    },
    "start_flags": ["spr_start"],
    "nodes": [
        {
            "id": "meet", "title": "夜裡在河谷鎮近郊的河岸等流水之靈",
            "text": "月亮升起時，河面上浮起一個水做的少女，輪廓淡得幾乎看不見。她歪著頭看你，聲音像水滴落在石頭上：「你……看得見我？好久沒有人看得見我了。」",
            "at": outskirts("rivervale"), "requires": need("spr_start"), "kind": "check",
            "check": {"attr": "fai", "dc": 13},
            "success": {
                "text": "你聽懂了她的話：她靠人們在舊石橋上立下的誓約活著。這幾年，誓約被打破的比被立下的多，河底沉睡的東西也開始騷動——那些東西，正在啃食她。",
                "set_flags": ["spr_met"],
            },
            "fail": {
                "text": "她的聲音斷斷續續，你只聽懂了幾個字：「誓約……打破……河底的東西……」話沒說完，她就散成了一片水花。",
                "set_flags": ["spr_met"],
            },
        },
        {
            "id": "murk", "title": "在河谷鎮近郊的河灘擊退濁流",
            "text": "河灘上的水突然變得混濁，幾團泥水從河裡站了起來，發出咕嚕咕嚕的聲音，朝少女剛才站的地方湧去。",
            "at": outskirts("rivervale"), "requires": need("spr_met"), "kind": "combat",
            "enemies": [["murk_elemental", 3]],
            "success": {
                "text": "濁流散回了河裡。少女重新浮出水面，比剛才清楚了一點：「謝謝你。牠們是被打破的誓約養大的……我一個人趕不走。」",
                "set_flags": ["spr_saved"],
            },
            "fail": {
                "text": "你們被濁流逼上了岸。少女用最後的力氣捲起一道浪，把牠們沖回了河底，然後虛弱地趴在河面上：「……下次，我們一起。」",
                "set_flags": ["spr_saved"],
            },
        },
        {
            "id": "vow", "title": "到河谷鎮的舊石橋找守橋人奧斯溫",
            "text": "奧斯溫聽你說完，點了點頭：「她小時候常在橋下玩——我是說，我小時候。」他摸著橋欄上的刻痕，「誓約能養活她。你願意在這座橋上立一個誓嗎？什麼誓都行，只要你守得住。」",
            "at": at_cell("rivervale", "lm_old_stone_bridge"), "requires": need("spr_saved"), "kind": "choice",
            "options": [
                {
                    "label": "立誓會再回來看她",
                    "success": {
                        "text": "你在橋上說出誓言的那一刻，橋下的河水泛起一圈銀光。那天晚上，漁夫們說河面上的少女笑了。",
                        "set_flags": ["spr_1_done"],
                        "effects": [aff(OSW, 10, "在橋上立了誓"), mem("在河谷鎮的舊石橋上向流水之靈立誓，會再回來看她。")],
                        "complete": True,
                    },
                },
                {
                    "label": "立誓會查出誓約被打破的原因",
                    "success": {
                        "text": "奧斯溫在誓約石上刻下你的話。河水靜靜地流過橋墩，像是在點頭。「上游，」他說，「最近上游的水，顏色不太對。」",
                        "set_flags": ["spr_1_done"],
                        "effects": [aff(OSW, 10, "在橋上立了誓"), mem("在河谷鎮的舊石橋上向流水之靈立誓，要查出誓約被打破、河水變濁的原因。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(250), xp(450)],
}

spr2 = {
    "id": "spirit_upstream",
    "title": "上游的濁流",
    "summary": "河谷鎮上游的水變了顏色。流水之靈說，有人在上游把「很苦的東西」倒進了河裡。（流水之靈・二）",
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "guild", "location": "rivervale", "min_level": 8, "requires": need("spr_1_done"),
        "text": "公會的告示板上貼著奧斯溫的第二張委託：上游的水變成了鐵鏽色，河邊的蘆葦一夜之間枯了一大片。流水之靈趴在橋墩上，只說了一句話：「上面有人倒了很苦的東西。」",
    },
    "start_flags": ["spr_up"],
    "nodes": [
        {
            "id": "tavern", "title": "到河谷鎮的酒館打聽上游的事",
            "text": "酒館裡的船伕說，上游的河灣最近多了一座沒有旗子的工坊，夜裡會冒出綠色的煙。「帝國的？王國的？沒人知道。兩邊都說不是自己的。」",
            "at": at_cell("rivervale", "tavern"), "requires": need("spr_up"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": {
                "text": "你從船伕的描述裡認出來了：那是煉製魔導爐燃料的工坊，廢液裡全是重金屬與腐蝕性的魔力殘渣。工坊沒有旗子，是因為它根本不該存在。",
                "set_flags": ["spr_works"],
            },
            "fail": {
                "text": "你只知道那座工坊在上游的河灣，夜裡冒綠煙，而且兩國都不承認。",
                "set_flags": ["spr_works"],
            },
        },
        {
            "id": "sludge", "title": "在河谷鎮近郊的上游河灣擊退廢液凝成的怪物",
            "text": "上游的河灣裡，工坊已經人去樓空，只剩下排水溝還在往河裡淌著綠色的廢液。廢液在河灘上積成一灘，慢慢地站了起來——牠有手、有嘴，卻沒有臉。",
            "at": outskirts("rivervale"), "requires": need("spr_works"), "kind": "combat",
            "enemies": [["sludge_horror", 2]],
            "success": {
                "text": "廢液怪散成了一灘惡臭的泥。工坊的帳房裡留著一本帳冊：燃料賣給了兩國邊境的守軍——帝國的、王國的都有。",
                "set_flags": ["spr_clean"],
            },
            "fail": {
                "text": "你們被廢液怪逼退。流水之靈從河裡捲起一道浪，把牠們沖散了，自己卻變得更淡了。工坊的帳房裡留著一本帳冊。",
                "set_flags": ["spr_clean"],
            },
        },
        {
            "id": "drain", "title": "決定上游工坊的排水溝",
            "text": "排水溝還在往河裡淌著殘液。流水之靈在你腳邊的水窪裡浮出小小的臉：「……好苦。」",
            "at": outskirts("rivervale"), "requires": need("spr_clean"), "kind": "choice",
            "options": [
                {
                    "label": "炸掉工坊的排水溝",
                    "success": {
                        "text": "排水溝塌了，工坊再也開不了工。三天後，上游的水清了，流水之靈在河面上轉了一圈，濺了你一身水。至於那本帳冊——兩國的守軍都說沒見過。",
                        "set_flags": ["spr_2_done"],
                        "effects": [mem("在河谷鎮的上游炸掉了沒有旗子的魔導燃料工坊的排水溝，河水清了。")],
                        "complete": True,
                    },
                },
                {
                    "label": "把帳冊交給兩國的使節",
                    "success": {
                        "text": "兩國的使節在舊石橋上互相指責了一下午，最後一起簽了一份「共同保護河谷水源」的誓約。誓約立下的那一刻，河面上泛起一圈銀光——流水之靈比任何時候都清楚。",
                        "set_flags": ["spr_2_done", "spr_treaty"],
                        "effects": [rep("human_alliance", 3), aff(OSW, 10, "促成了保護水源的誓約"), mem("把上游工坊的帳冊交給兩國的使節，促成了「共同保護河谷水源」的誓約，流水之靈因此變強了。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(500), xp(900)],
}

spr3 = {
    "id": "spirit_drowned",
    "title": "河底的怨靈",
    "summary": "河底沉睡著兩百年來在這條河上戰死的士兵。被打破的誓約一多，他們就醒了。（流水之靈・三）",
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "guild", "location": "rivervale", "min_level": 11, "requires": need("spr_2_done"),
        "text": "奧斯溫親自來公會找你：「河底醒了。」他的手在發抖，「兩百年來在這條河上戰死的士兵，都沉在舊石橋下面。流水之靈一直在安撫他們——現在她撐不住了。」",
    },
    "start_flags": ["spr_deep"],
    "nodes": [
        {
            "id": "drowned", "title": "在河谷鎮的舊石橋下擊退河底的怨靈",
            "text": "舊石橋下的河水翻起了黑浪，鏽蝕的盔甲一具接一具從水裡站起來：帝國的、王國的、聯邦的，甚至還有魔族的。他們喊著兩百年前的口號，朝橋上湧來。流水之靈張開雙手擋在橋前，身體淡得快要看不見。",
            "at": at_cell("rivervale", "lm_old_stone_bridge"), "requires": need("spr_deep"), "kind": "combat",
            "enemies": [["drowned_wrath", 3]],
            "success": {
                "text": "最後一具盔甲沉回了河底。黑浪退去，流水之靈跪在河面上喘氣，身體卻一點一點地變得清楚——怨靈們散去時留下的，不只是恨，還有他們生前立下的、沒能守住的誓。",
                "set_flags": ["spr_calm"],
            },
        },
        {
            "id": "blessing", "title": "在河谷鎮的舊石橋上接受流水之靈的道謝",
            "text": "天亮時，流水之靈坐在橋欄上，雙腳泡在河裡，第一次清楚得像一個真正的少女。「謝謝你守住了你的誓。」她歪著頭，「我能給你的不多……你想要什麼？」",
            "at": at_cell("rivervale", "lm_old_stone_bridge"), "requires": need("spr_calm"), "kind": "choice",
            "options": [
                {
                    "label": "接受她的祝福",
                    "success": {
                        "text": "她捧起一捧河水，輕輕灑在你的頭上。水是溫的。「以後走到哪裡，只要有流水的地方，我都會記得你。」",
                        "set_flags": ["spr_done"],
                        "effects": [COND("blessed"), {"type": "perk", "perk": "iron_will", "options": ["lucky", "devout"]}, mem("流水之靈在河谷鎮的舊石橋上祝福了你：只要有流水的地方，她都會記得你。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "請她繼續守護這座橋",
                    "success": {
                        "text": "「這本來就是我的工作呀。」她笑了，跳進河裡，濺起一圈銀光。從那天起，在舊石橋上立的誓都特別靈驗——河谷鎮的人說，連最狡猾的商人都不敢在橋上說謊了。",
                        "set_flags": ["spr_done"],
                        "effects": [rep("human_alliance", 5), aff(OSW, 15, "讓流水之靈繼續守護舊石橋"), mem("請流水之靈繼續守護河谷鎮的舊石橋，從此橋上的誓特別靈驗。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1200), xp(1800)],
}

# ---------------- 艾蜜莉亞：海鷗亭的寂寞夜 ----------------
ame1 = {
    "id": "amelia_lonely_night",
    "title": "海鷗亭的寂寞夜",
    "summary": "沿海渡口「海鷗亭」的老闆娘艾蜜莉亞，丈夫出海兩年音訊全無。打烊之後，她總是一個人喝酒。（艾蜜莉亞・一）",
    "tags": ["adult", "non_virgin"],
    "rank": "D",
    "merit": 5,
    "start": {
        "kind": "npc", "npc": AME, "min_level": 5,
        "text": "打烊後的海鷗亭裡，艾蜜莉亞把最後一張椅子倒扣在桌上，替自己倒了一杯酒，又多拿了一個杯子：「陪我喝一杯吧。一個人喝，越喝越冷。」",
    },
    "start_flags": ["ame_start"],
    "nodes": [
        {
            "id": "drink", "title": "在沿海渡口的酒館陪艾蜜莉亞喝酒",
            "text": "爐火劈啪作響。艾蜜莉亞喝到第三杯，臉頰泛紅，靠著你的肩膀說起她的丈夫：藍鷺號的水手，兩年前出海，說好半年就回來。「渡口的人都說我該改嫁了。」她笑了笑，手卻握緊了胸前的婚戒，「可是我連他是生是死都不知道。」",
            "at": at_cell("coast_ferry", "tavern"), "requires": need("ame_start"), "kind": "choice",
            "options": [
                {
                    "label": "讓她靠著你，陪她到天亮",
                    "success": {
                        "text": "她靠著你睡著了，呼吸裡帶著酒氣與海風的味道。天亮前醒來時，她發現自己的手還搭在你的胸口，臉紅得說不出話，卻沒有把手收回去。",
                        "set_flags": ["ame_close"], "effects": [aff(AME, 15, "陪她熬過一個寂寞的夜")],
                    },
                },
                {
                    "label": "答應替她打聽藍鷺號",
                    "success": {
                        "text": "「真的？」艾蜜莉亞抬起頭，眼睛亮了一下，又暗下去，「……謝謝你。渡口有個沒有船的船長，認得每一艘出過海的船。」",
                        "set_flags": ["ame_close"], "effects": [aff(AME, 10, "答應替她打聽丈夫的下落")],
                    },
                },
            ],
        },
        {
            "id": "marina", "title": "向沿海渡口的瑪琳娜打聽藍鷺號",
            "text": "瑪琳娜聽到「藍鷺號」三個字，翻了翻她那本記滿船名的筆記本：「兩年前出港，往潮汐港……奇怪，去年潮汐港的港務登記裡，有一艘船的龍骨和藍鷺號一模一樣，只是名字換了。」",
            "at": at_npc(MAR), "requires": need("ame_close"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": {
                "text": "瑪琳娜幫你對照了船籍：那艘船現在叫「白鷗號」，船主登記的名字，正是艾蜜莉亞丈夫的名字。他沒有死——他在潮汐港換了一艘船，也換了一個名字的船。",
                "set_flags": ["ame_lead"],
            },
            "fail": {
                "text": "瑪琳娜只能確定一件事：藍鷺號沒有沉，它去年還在潮汐港出現過，換了名字。",
                "set_flags": ["ame_lead"],
            },
        },
        {
            "id": "tell", "title": "回到海鷗亭告訴艾蜜莉亞",
            "text": "艾蜜莉亞正在擦杯子，看見你的表情，手就停了下來。「……你查到了，對不對？」",
            "at": at_npc(AME), "requires": need("ame_lead"), "kind": "choice",
            "options": [
                {
                    "label": "告訴她船還在潮汐港",
                    "success": {
                        "text": "杯子從她手裡滑落，摔碎在地上。她蹲下去撿碎片，撿著撿著就哭了。你蹲在她身邊，她把臉埋進你的懷裡，哭得像個孩子：「他還活著……他還活著，卻沒有回來。」那一夜，她一直沒有放開你的手。",
                        "set_flags": ["ame_1_done"],
                        "effects": [aff(AME, 15, "陪她面對丈夫的消息"), mem("替海鷗亭的老闆娘艾蜜莉亞查到，她丈夫的船沒有沉，在潮汐港換了名字。")],
                        "complete": True,
                    },
                },
                {
                    "label": "說還不確定，要親自去看",
                    "success": {
                        "text": "艾蜜莉亞看了你很久，輕輕點頭：「……那你帶我去。我要自己看。」她把婚戒從手指上摘下來，掛回胸前的項鍊上，又握在掌心裡。",
                        "set_flags": ["ame_1_done"],
                        "effects": [aff(AME, 10, "答應帶她去看")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(200), xp(400)],
}

ame2 = {
    "id": "amelia_white_gull",
    "title": "白鷗號的船主",
    "summary": "艾蜜莉亞要親自去潮汐港，看一看那艘換了名字的船，和那個沒有回來的人。（艾蜜莉亞・二）",
    "tags": ["adult", "non_virgin"],
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": AME, "min_affinity": 20, "min_level": 8, "requires": need("ame_1_done"),
        "text": "艾蜜莉亞把海鷗亭的鑰匙交給隔壁的漁婦，提著一只小行李箱站在碼頭上：「我要去潮汐港。」她的聲音很平靜，「陪我去好嗎？我怕……我怕我一個人，會不敢下船。」",
    },
    "start_flags": ["ame_trip"],
    "nodes": [
        {
            "id": "board", "title": "在沿海渡口和艾蜜莉亞一起上船",
            "text": "渡船離港的時候，艾蜜莉亞一直站在船尾，看著海鷗亭的屋頂越來越小。夜裡，她敲開你的船艙：「我睡不著。」她在你身邊坐下，靠得很近，「如果他真的……我該怎麼辦？」",
            "at": at_cell("coast_ferry", "gate"), "requires": need("ame_trip"), "kind": "story",
            "success": {
                "text": "那一夜海很平靜。她在你懷裡睡著了，手裡還握著那枚婚戒。",
                "set_flags": ["ame_aboard"], "join": AME, "travel_to": "tidehaven",
            },
        },
        {
            "id": "docks", "title": "在潮汐港的酒館打聽白鷗號",
            "text": "潮汐港的酒館裡，水手們一聽到「白鷗號」就笑了：「那個船主？娶了碼頭老大的女兒，去年剛生了個兒子。」艾蜜莉亞站在你身後，臉色白得像紙。",
            "at": at_cell("tidehaven", "tavern"), "requires": need("ame_aboard"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": {
                "text": "你問出了白鷗號停在哪個碼頭——也注意到角落裡有兩個黑帆的水手在盯著你們。艾蜜莉亞抓緊你的袖子：「走吧。我要看到他。」",
                "set_flags": ["ame_pier"],
            },
            "fail": {
                "text": "水手們不肯多說，只朝東邊的碼頭努了努嘴。角落裡兩個黑帆的水手站了起來，跟著你們走出了酒館。",
                "set_flags": ["ame_pier"],
            },
        },
        {
            "id": "blacksail", "title": "在潮汐港近郊甩掉黑帆的走私水手",
            "text": "往碼頭的小路上，黑帆的水手攔住了你們。「白鷗號的船主欠我們老大不少人情。」帶頭的人咧嘴一笑，「老大不喜歡有人來翻他朋友的舊帳。」",
            "at": outskirts("tidehaven"), "requires": need("ame_pier"), "kind": "combat",
            "enemies": [["blacksail_smuggler", 2]],
            "success": {
                "text": "水手們倒下了。碼頭就在前面，白鷗號的甲板上，一個男人正抱著一個嬰兒，朝一個年輕的女人笑。艾蜜莉亞停住了腳步。",
                "set_flags": ["ame_saw"],
            },
            "fail": {
                "text": "你們被逼進了碼頭的貨堆裡，水手們找了一陣就走了。從貨堆的縫隙看出去，白鷗號的甲板上，一個男人正抱著一個嬰兒，朝一個年輕的女人笑。",
                "set_flags": ["ame_saw"],
            },
        },
        {
            "id": "pier", "title": "在潮汐港的碼頭陪艾蜜莉亞",
            "text": "艾蜜莉亞看了很久，久到那個男人抱著孩子走進了船艙。她沒有哭，只是轉過身來看著你：「……我想回家了。」",
            "at": at_npc(AME), "requires": need("ame_saw"), "kind": "choice",
            "options": [
                {
                    "label": "陪她回沿海渡口",
                    "success": {
                        "text": "回程的船上，她一句話也沒說，只是一直握著你的手。到港的那天晚上，海鷗亭沒有開門。",
                        "set_flags": ["ame_2_done"], "leave": AME, "travel_to": "coast_ferry",
                        "effects": [aff(AME, 15, "陪她去潮汐港又陪她回家"), mem("陪艾蜜莉亞到潮汐港，看見她的丈夫在那裡另組了家庭。她說想回家。")],
                        "complete": True,
                    },
                },
                {
                    "label": "問她要不要去跟他說話",
                    "success": {
                        "text": "艾蜜莉亞搖了搖頭：「不用了。我等了兩年，等的就是一個答案——現在我拿到了。」她踮起腳，在你臉頰上輕輕碰了一下，「謝謝你陪我來。我們回家吧。」",
                        "set_flags": ["ame_2_done"], "leave": AME, "travel_to": "coast_ferry",
                        "effects": [aff(AME, 10, "讓她自己決定"), mem("陪艾蜜莉亞到潮汐港，看見她的丈夫在那裡另組了家庭。她沒有上前，說等到答案了。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(900)],
}

ame3 = {
    "id": "amelia_ring",
    "title": "摘下婚戒",
    "summary": "海鷗亭重新開門了。黑帆的人卻找上了門——而艾蜜莉亞，決定摘下那枚婚戒。（艾蜜莉亞・三）",
    "tags": ["adult", "non_virgin"],
    "rank": "B",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": AME, "min_affinity": 30, "min_level": 11, "requires": need("ame_2_done"),
        "text": "海鷗亭重新開門了，艾蜜莉亞的笑容比以前多了一點。打烊後，她把你留下來，臉色卻很凝重：「黑帆的人寫信來了。他們說我『到處打聽不該打聽的事』，今晚要來『談談』。」",
    },
    "start_flags": ["ame_storm"],
    "nodes": [
        {
            "id": "storm", "title": "在沿海渡口的酒館擋下黑帆的打手",
            "text": "暴風雨的夜裡，海鷗亭的門被踹開。黑帆的打手們甩著濕透的斗篷走進來，打翻了一張桌子：「老闆娘，我們老大說，妳的嘴巴該縫起來了。」艾蜜莉亞站在吧台後面，握著一根擀麵棍，卻沒有退後。",
            "at": at_cell("coast_ferry", "tavern"), "requires": need("ame_storm"), "kind": "combat",
            "enemies": [["blacksail_enforcer", 3]],
            "success": {
                "text": "打手們被扔回了暴雨裡。艾蜜莉亞放下擀麵棍，腿一軟坐在了地上，然後笑了出來：「我竟然沒有躲起來。」",
                "set_flags": ["ame_safe"],
            },
        },
        {
            "id": "ring", "title": "在海鷗亭陪艾蜜莉亞過完這一夜",
            "text": "雨停了。艾蜜莉亞把店裡收拾乾淨，在爐火前坐下，從胸前的項鍊上解下那枚婚戒，放在你的手心裡：「我想把它丟進海裡。可是……我不想一個人去。」",
            "at": at_npc(AME), "requires": need("ame_safe"), "kind": "choice",
            "options": [
                {
                    "label": "陪她把婚戒丟進海裡",
                    "success": {
                        "text": "你們在碼頭的盡頭，看著那枚戒指沉進黑色的海裡。回到海鷗亭，她鎖上門，在爐火前解開了圍裙的帶子：「今晚，我不想再一個人了。」那是兩年來，她第一次在天亮前睡著。",
                        "set_flags": ["ame_lover"],
                        "effects": [aff(AME, 20, "陪她丟掉了婚戒"), mem("陪艾蜜莉亞把婚戒丟進了沿海渡口的海裡，她成了你的戀人。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "把婚戒收起來，牽起她的手",
                    "success": {
                        "text": "「不用丟。」你把戒指放進她的圍裙口袋，「留著，提醒妳等過、也走出來了。」艾蜜莉亞愣了一下，然後撲進你懷裡。那一夜，海鷗亭二樓的燈一直亮到天亮。",
                        "set_flags": ["ame_lover"],
                        "effects": [aff(AME, 20, "讓她走出了等待"), mem("艾蜜莉亞走出了兩年的等待，成了你的戀人。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(1800)],
}

BATCH5 = [port1, port2, port3, spr1, spr2, spr3, ame1, ame2, ame3]
