"""第二批特殊任務：萊茵堡的主戰與主和、晨霧修道院、伊莎朵拉（成人向）。由 story_batch1.py 匯入後一起寫出。"""


def aff(npc, d, why):
    return {"type": "affinity", "npc": npc, "delta": d, "reason": why}


def mem(text, imp=2):
    return {"type": "memory", "summary": text, "importance": imp}


def money(n):
    return {"type": "money", "amount": n}


def xp(n):
    return {"type": "xp", "amount": n}


def rep(f, d):
    return {"type": "reputation", "faction": f, "delta": d}


def hp(r):
    return {"type": "hp", "ratio": r}


def at_cell(loc, cell):
    return {"where": "cell", "location": loc, "cell": cell}


def at_npc(npc):
    return {"where": "npc", "npc": npc}


def at_dun(loc, layer):
    return {"where": "dungeon", "location": loc, "layer": layer}


def outskirts(loc):
    return {"where": "outskirts", "location": loc}


def need(*flags):
    return {"flags": list(flags)}


BRU, LEO, WOLF, ROSA, ELEO, ROCK = 'npc_brunhild', 'npc_leonhart', 'npc_wolfgang', 'npc_rosalind', 'npc_eleanora_rhine', 'npc_rock_the_rat'
ISA, EVE, ELN = 'npc_isadora', 'npc_eve', 'npc_eleanor_dawn'

# ---------------- 萊茵堡：主戰與主和 ----------------
rhine1 = {
    "id": "rhine_raid",
    "title": "南郊的夜襲",
    "summary": "帝都南郊的村子一夜之間被燒成白地，倖存者說看見了魔族的角與火。灰狼沃爾夫岡在軍議上要求撕毀停戰——有人想在軍隊動起來之前，查清楚那天晚上到底發生了什麼。（萊茵堡的主戰與主和・一）",
    "rank": "D",
    "merit": 8,
    "start": {
        "kind": "guild", "location": "rhineburg", "min_level": 5,
        "text": "公會的告示板上貼著一份不具名的委託：帝都南郊的村子一夜之間被燒成白地，倖存者說看見了魔族的角與火。軍議上，第三軍團的沃爾夫岡將軍已經要求撕毀停戰。委託人只要一件事——在軍隊動起來之前，查清楚那天晚上到底發生了什麼。",
    },
    "start_flags": ["rwar_start"],
    "nodes": [
        {
            "id": "witness", "title": "到萊茵堡的酒館找村子的倖存者",
            "text": "倖存的少年縮在酒館的角落，捧著一碗沒動過的湯，反覆說著那天晚上的事：角、火、尖叫……還有一句他自己也想不明白的話：「他們踩的靴子，跟士兵大哥的一樣。」",
            "at": at_cell("rhineburg", "tavern"), "requires": need("rwar_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": {
                "text": "你讓他用指頭在桌上畫出靴底的花紋——帝國制式軍靴的鐵釘排法，而且是第二軍團的式樣。他還記得，那些「魔族」放完火之後往城南的林子退去了。",
                "set_flags": ["rwar_boots"],
            },
            "fail": {
                "text": "少年說不清楚，只記得靴子「跟士兵的一樣」，還有那些人放完火之後往城南的林子跑了。",
                "set_flags": ["rwar_boots"],
            },
        },
        {
            "id": "camp", "title": "在萊茵堡近郊找到襲擊者的營地",
            "text": "林子深處的營地堆著拆下來的假角、染黑的皮甲，還有幾捲沒用完的魔焰卷軸。幾個正在洗掉臉上油彩的男人一看見你們，就慌忙戴回了面具。",
            "at": outskirts("rhineburg"), "requires": need("rwar_boots"), "kind": "combat",
            "enemies": [["fake_demon_raider", 3]],
            "success": {
                "text": "營地的火堆裡有一封沒燒乾淨的信，蓋著一枚鐵十字的封蠟：「再一次，軍議就會倒向我們。榮耀屬於帝國。」",
                "set_flags": ["rwar_letter"],
            },
            "fail": {
                "text": "他們丟下營地逃進了林子。火堆裡那封蓋著鐵十字封蠟的信只燒掉了一角：「再一次，軍議就會倒向我們。」",
                "set_flags": ["rwar_letter"],
            },
        },
        {
            "id": "report", "title": "把夜襲的證據帶回萊茵堡的公會",
            "text": "公會主管看著桌上的假角和鐵十字的信，額頭冒汗：「這已經不是冒險者的事了。證據交給誰，就等於替誰在軍議上多押一票。」他把信推回給你：「你帶回來的，你決定。」",
            "at": at_cell("rhineburg", "guild"), "requires": need("rwar_letter"), "kind": "choice",
            "options": [
                {
                    "label": "送去給主和的布倫希爾德",
                    "success": {
                        "text": "「霜盾」布倫希爾德沒說幾句話，只是把信折好收進懷裡，然後遞給你一塊她自己都捨不得吃的蜂蜜蛋糕。三天後的軍議上，撕毀停戰的提案以一票之差被否決。沒有人知道鐵十字是誰——但他們不會只做一次。",
                        "set_flags": ["rwar_1_done", "rwar_to_brunhild"],
                        "counters": {"human_stance": 1},
                        "effects": [aff(BRU, 10, "把夜襲的真相交給她"), mem("揭穿帝都南郊的「魔族夜襲」是穿著帝國軍靴的人假扮的，把證據交給了主和的布倫希爾德將軍。")],
                        "complete": True,
                    },
                },
                {
                    "label": "送去給主戰的沃爾夫岡",
                    "success": {
                        "text": "「灰狼」沃爾夫岡看完信，把鐵十字的那一封丟進火盆，只留下魔焰卷軸：「誰點的火不重要。村子的人是真的死了，魔族的卷軸也是真的。」第三軍團開始往南境增兵——停戰還在，只是更薄了。",
                        "set_flags": ["rwar_1_done", "rwar_to_wolfgang"],
                        "counters": {"human_stance": -1},
                        "effects": [aff(WOLF, 10, "把夜襲的證據交給他"), mem("查出帝都南郊的「魔族夜襲」另有內情，卻把證據交給了主戰的沃爾夫岡將軍，他燒掉了對帝國不利的那一半。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

rhine2 = {
    "id": "rhine_iron_cross",
    "title": "鐵十字會",
    "summary": "一群覺得停戰是恥辱的軍官，自稱鐵十字會。他們的軍火藏在萊茵堡的下水道裡，帳冊上記著每一筆錢的來源。（萊茵堡的主戰與主和・二）",
    "rank": "C",
    "merit": 10,
    "start": {
        "kind": "informant", "location": "rhineburg", "price": 300, "min_level": 8, "requires": need("rwar_1_done"),
        "text": "情報商把聲音壓得很低：「鐵十字？一群覺得停戰是恥辱的軍官，大部分出自第二軍團。他們的軍火藏在下水道裡——想下去的話，找『老鼠』洛克帶路。他誰的錢都收。」",
    },
    "start_flags": ["rwar_cross"],
    "nodes": [
        {
            "id": "rat", "title": "到萊茵堡下水道找「老鼠」洛克帶路",
            "text": "洛克蹲在排水溝邊數銅板，一聽到「鐵十字」就結巴得更厲害了：「那、那些人不好惹……他們、他們的箱子都是我搬的。帶路可以，但、但價錢得另外算。」",
            "at": at_npc(ROCK), "requires": need("rwar_cross"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": {
                "text": "你答應不讓任何人知道是他帶的路。洛克抹了抹鼻子，帶你們拐進一條連地圖上都沒有的暗渠：「就、就在前面。我什麼都沒看見。」",
                "set_flags": ["rwar_path"],
            },
            "fail": {
                "text": "洛克硬是多要了一倍的錢才肯開口，指了指一條暗渠就溜得不見人影：「前、前面右轉。我什麼都沒說。」",
                "set_flags": ["rwar_path"], "effects": [money(-150)],
            },
        },
        {
            "id": "armory", "title": "在萊茵堡下水道找到鐵十字的軍火庫",
            "text": "暗渠深處的磚室裡堆滿了帝國制式的弩與油桶，幾名沒穿軍服的軍官正在清點，牆上用炭筆畫著南境的地圖，上面插滿了小旗子。帶頭的軍官放下帳冊，拔出了劍：「看來今晚得多埋幾個人。」",
            "at": {"where": "special", "special_map": "sm_rhineburg_sewer"}, "requires": need("rwar_path"), "kind": "combat",
            "enemies": [["iron_cross_officer", 2]],
            "success": {
                "text": "帳冊上記著每一筆錢的來源：大部分來自第二軍團軍官的私房，還有一筆巨款蓋著阿爾貝納商會的印——有人在兩邊下注。最後一頁寫著一個日期：下個季度的四將軍軍議。",
                "set_flags": ["rwar_ledger"],
            },
            "fail": {
                "text": "軍官們帶著弩撤進了更深的暗渠，只留下一本來不及帶走的帳冊。最後一頁寫著一個日期：下個季度的四將軍軍議。",
                "set_flags": ["rwar_ledger"],
            },
        },
        {
            "id": "ledger", "title": "在萊茵堡的旅店決定鐵十字帳冊的去向",
            "text": "你把帳冊攤在旅店的桌上。上面的名字足夠讓半個第二軍團上軍法審判——也足夠讓拿到它的人在軍議上多握幾張牌。金獅雷歐哈特是這些軍官的長官；白棋羅莎琳德則是全帝國最會用牌的人。",
            "at": at_cell("rhineburg", "inn"), "requires": need("rwar_ledger"), "kind": "choice",
            "options": [
                {
                    "label": "交給他們的長官雷歐哈特",
                    "success": {
                        "text": "金獅讀完帳冊，臉色鐵青：「我的人……用我的名字做這種事？」他把鐵十字會的軍官全部調到西境最偏遠的哨站，卻沒有交給軍法。「他們想要戰爭，我也想。但不是這種方式。」主戰派的票一張也沒少。",
                        "set_flags": ["rwar_2_done", "rwar_to_leonhart"],
                        "counters": {"human_stance": -1},
                        "effects": [aff(LEO, 10, "把部下的醜事私下交給他"), mem("在萊茵堡下水道找到鐵十字會的帳冊，交給了金獅雷歐哈特，他保住了那些主戰的軍官。")],
                        "complete": True,
                    },
                },
                {
                    "label": "交給下棋的羅莎琳德",
                    "success": {
                        "text": "白棋笑咪咪地翻著帳冊，在阿爾貝納商會那一頁停了很久：「真有意思。謝謝你，這顆子我會好好用。」第二天，鐵十字會的軍官被送上軍法審判，主戰派在軍議上一下子少了三票。",
                        "set_flags": ["rwar_2_done", "rwar_to_rosalind"],
                        "counters": {"human_stance": 1},
                        "effects": [aff(ROSA, 10, "把帳冊交給她"), mem("在萊茵堡下水道找到鐵十字會的帳冊，交給了白棋羅莎琳德，她把那些軍官送上了軍法審判——也留下了阿爾貝納商會的那一頁。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

rhine3 = {
    "id": "rhine_council",
    "title": "四將軍的軍議",
    "summary": "帝國宰相艾蕾諾拉召開四將軍的軍議，決定停戰敕令要不要延續。揭穿夜襲與鐵十字會的冒險者，以證人的身分出席。（萊茵堡的主戰與主和・三）",
    "rank": "B",
    "merit": 15,
    "start": {
        "kind": "guild", "location": "rhineburg", "min_level": 11, "requires": need("rwar_2_done"),
        "text": "公會的主管親手把一封蓋著宰相府火漆的信交給你：帝國宰相艾蕾諾拉召開四將軍的軍議，決定停戰敕令要不要延續。曾經揭穿夜襲與鐵十字會的冒險者，以證人的身分出席。",
    },
    "start_flags": ["rwar_council"],
    "nodes": [
        {
            "id": "ambush", "title": "在萊茵堡的城門擋下鐵十字的刺客",
            "text": "軍議前夜，你在城門附近撞見一群蒙面人——鐵十字會的殘黨。他們要在軍議前除掉證人，再把屍體丟到城外，讓這場刺殺看起來像是魔族幹的。",
            "at": at_cell("rhineburg", "gate"), "requires": need("rwar_council"), "kind": "combat",
            "enemies": [["iron_cross_blade", 3]],
            "success": {
                "text": "刺客的頭目在斷氣前笑了：「你以為……只有我們想要戰爭？」城門的衛兵這時才舉著火把趕來。明天，你還是得走進軍議廳。",
                "set_flags": ["rwar_safe"],
            },
            "fail": {
                "text": "你們被打得狼狽不堪，所幸城門的衛兵聽到動靜趕來，刺客逃進了夜色裡。第二天，你帶著一身的繃帶走進了軍議廳——這本身就是最好的證詞。",
                "set_flags": ["rwar_safe"], "effects": [hp(-0.2)],
            },
        },
        {
            "id": "testimony", "title": "在軍議上向宰相作證",
            "text": "軍議廳裡，四位將軍分坐長桌兩側：沉默的霜盾、意氣風發的金獅、獨眼的灰狼、笑咪咪的白棋。宰相艾蕾諾拉坐在上首，示意你開口。兩票對兩票——你說出的話，會決定猶豫的那一票。",
            "at": at_npc(ELEO), "requires": need("rwar_safe"), "kind": "choice",
            "options": [
                {
                    "label": "主張延續停戰",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "你把夜襲的假角放在桌上：「有人想用一把假火燒掉停戰。」灰狼沉默了很久，最後把手按在劍柄上：「……第三軍團服從敕令。」停戰敕令延續了下去。散會時，霜盾經過你身邊，小聲地說了一句謝謝。",
                        "set_flags": ["rwar_peace"], "counters": {"human_stance": 1},
                        "effects": [rep("rhine_empire", 5), aff(BRU, 10, "在軍議上替停戰說話"), mem("在帝國的四將軍軍議上作證，說服灰狼沃爾夫岡服從停戰敕令。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你的話被金獅的演說蓋了過去。就在表決之前，霜盾布倫希爾德開了口——她一年只說一百句話，這次用了二十句。停戰勉強延續了下去，灰狼摔門而出。",
                        "set_flags": ["rwar_peace"], "counters": {"human_stance": 1},
                        "effects": [rep("rhine_empire", 3), mem("在帝國的四將軍軍議上作證，停戰勉強延續了下去。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "主張整軍備戰",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "「停戰給了我們時間，也給了魔族時間。」金獅拍桌叫好，灰狼第一次朝你點頭。軍議決定：停戰敕令照舊，但四個軍團轉入戰時編制。宰相在紀錄上簽了名，什麼都沒說。",
                        "set_flags": ["rwar_war"], "counters": {"human_stance": -1},
                        "effects": [rep("rhine_empire", 5), aff(LEO, 10, "在軍議上替整軍說話"), mem("在帝國的四將軍軍議上作證，讓四個軍團轉入戰時編制。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你說得結結巴巴，卻正好給了金獅接話的機會。他的演說讓兩位猶豫的將軍都動搖了——軍議決定四個軍團轉入戰時編制。霜盾看著你，什麼都沒說。",
                        "set_flags": ["rwar_war"], "counters": {"human_stance": -1},
                        "effects": [rep("rhine_empire", 3), mem("在帝國的四將軍軍議上作證，四個軍團轉入了戰時編制。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 地下城：晨霧修道院遺址 ----------------
mist1 = {
    "id": "mist_bell",
    "title": "霧中的晨鐘",
    "summary": "晨霧修道院遺址每天黎明都傳出鐘聲——那口鐘早在異端審判時就碎了。三名去朝聖的見習修女沒有回來。（晨霧修道院・一）",
    "rank": "D",
    "merit": 8,
    "start": {
        "kind": "guild", "location": "dawnlight", "min_level": 5,
        "text": "公會的告示板上貼著晨曦聖殿的委託：城北山丘上的晨霧修道院遺址，最近每天黎明都會傳出鐘聲——那口鐘在兩百年前的異端審判時就碎了。三名去朝聖的見習修女沒有回來。",
    },
    "start_flags": ["mabb_start"],
    "nodes": [
        {
            "id": "sanctum", "title": "到晨光城的晨曦聖殿請教大祭司",
            "text": "大祭司艾莉諾帶你走到祭壇前：「晨霧修道院曾是我們的姊妹院，兩百年前被教廷判為異端。據說那裡的聖女能讓人聽見神的聲音——不經過教廷。」她把一串念珠交到你手上：「失蹤的孩子們，是自己想去聽那個聲音的。」",
            "at": at_cell("dawnlight", "lm_dawn_sanctum"), "requires": need("mabb_start"), "kind": "story",
            "success": {
                "text": "念珠上刻著晨霧修道院的紋章。艾莉諾說，那些孩子最常提起的是中層的禮拜堂——「聖女的歌聲從那裡傳出來。」",
                "set_flags": ["mabb_beads"], "effects": [aff(ELN, 5, "答應找回見習修女")],
            },
        },
        {
            "id": "nuns", "title": "在晨霧修道院中層找到失蹤的見習修女",
            "text": "中層的禮拜堂裡，三名見習修女跪在碎裂的聖像前，眼神空洞，跟著霧裡的歌聲喃喃祈禱。霧影靈體與死去的修士圍在她們身邊，像是在守著新的信徒。",
            "at": at_dun("mist_abbey", "middle"), "requires": need("mabb_beads"), "kind": "combat",
            "enemies": [["mist_wraith", 1], ["fallen_acolyte", 2]],
            "success": {
                "text": "霧散了，兩名修女清醒過來，第三名卻緊緊抱著一本黑皮的祈禱書不肯放：「聖女大人說，神不在教廷裡。神在每個人心裡。」",
                "set_flags": ["mabb_found"],
            },
            "fail": {
                "text": "你們被逼退，霧卻自己散了——像是歌聲的主人不想傷害她們。三名修女被你們半拖半抱地帶了出來，其中一個手裡還緊緊抱著一本黑皮的祈禱書。",
                "set_flags": ["mabb_found"],
            },
        },
        {
            "id": "book", "title": "回到晨光城決定祈禱書的去處",
            "text": "回到晨光城的神殿，那名修女終於睡著了，祈禱書從她手裡滑到地上。書頁上寫滿了被教廷禁止的禱詞，字跡溫柔得不像異端；最後一頁畫著一個沒有臉的人，旁邊寫著「被抹去名字的聖者」。",
            "at": at_cell("dawnlight", "temple"), "requires": need("mabb_found"), "kind": "choice",
            "options": [
                {
                    "label": "交給晨曦聖殿保管",
                    "success": {
                        "text": "艾莉諾大祭司收下祈禱書，沉默了很久：「我會把它鎖起來……也許有一天，我們能光明正大地讀它。」從那天起，黎明的鐘聲小了一些。",
                        "set_flags": ["mabb_1_done"],
                        "effects": [aff(ELN, 10, "把異端的祈禱書交給她")],
                        "complete": True,
                    },
                },
                {
                    "label": "燒掉祈禱書",
                    "success": {
                        "text": "火焰吞掉書頁時，你好像聽見霧裡傳來一聲嘆息。修女醒來後什麼都不記得了，只是有時候會望著北方的山丘發呆。黎明的鐘聲，還在響。",
                        "set_flags": ["mabb_1_done"],
                        "effects": [rep("holy_ring", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(250), xp(450)],
}

mist2 = {
    "id": "mist_inquisition",
    "title": "審判的卷宗",
    "summary": "異端的祈禱書提到一位「被抹去名字的聖者」。教廷的紀錄裡沒有這個人——兩百年前，晨霧修道院到底被審判了什麼？（晨霧修道院・二）",
    "rank": "C",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": ELN, "min_level": 8, "requires": need("mabb_1_done"),
        "text": "艾莉諾大祭司把你請到聖殿的後堂：「那本祈禱書提到一位『被抹去名字的聖者』，說修道院的一切神蹟都從他開始。教廷的紀錄裡沒有這個人。我想知道，兩百年前到底審判了什麼。」",
    },
    "start_flags": ["mabb_records"],
    "nodes": [
        {
            "id": "archive", "title": "到索里耶爾的情報商打聽審判的紀錄",
            "text": "情報商一聽到「晨霧修道院」就變了臉色：「那份卷宗？早就從聖環主殿的書庫消失了。你知道在教廷的眼皮底下打聽這種事要多少錢嗎？」",
            "at": at_cell("soriel", "informant"), "requires": need("mabb_records"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": {
                "text": "情報商終於鬆口：當年主持審判的審判官們把真正的卷宗帶進了修道院深層的審判庭，連同他們自己一起封在霧裡——「據說他們到現在還在開庭。」",
                "set_flags": ["mabb_lead"],
            },
            "fail": {
                "text": "情報商收了一大筆錢才肯說：卷宗被審判官們帶進了修道院深層的審判庭，連同他們自己一起封在霧裡。",
                "set_flags": ["mabb_lead"], "effects": [money(-150)],
            },
        },
        {
            "id": "court", "title": "在晨霧修道院深層的審判庭找到卷宗",
            "text": "審判庭裡，審判官的亡影仍在對著空無一人的被告席宣讀罪狀，霧影聖騎士守在門口。看見你們走進來，亡影們齊聲說：「又一個異端。」",
            "at": at_dun("mist_abbey", "deep"), "requires": need("mabb_lead"), "kind": "combat",
            "enemies": [["inquisitor_shade", 2], ["mist_knight", 1]],
            "success": {
                "text": "卷宗攤在審判席上，最後一頁寫著判決：「聖者埃利昂以神蹟治癒了魔族的孩子。其信仰不經教廷，其慈悲不分人魔——判為異端，抹去其名，封其於修道院之底。」",
                "set_flags": ["mabb_record"],
            },
            "fail": {
                "text": "亡影把你們逼出了審判庭，卻沒有追出來——它們只是繼續宣讀那份判決，一字一句清清楚楚地傳進你耳裡：「聖者埃利昂……其慈悲不分人魔……抹去其名，封其於修道院之底。」",
                "set_flags": ["mabb_record"],
            },
        },
        {
            "id": "verdict", "title": "把卷宗帶回晨光城的晨曦聖殿",
            "text": "艾莉諾讀完你抄下的判決，雙手在發抖：「他唯一的罪，是對魔族的孩子也伸出了手。」她抬起頭看著你：「你覺得，我該怎麼做？」",
            "at": at_cell("dawnlight", "lm_dawn_sanctum"), "requires": need("mabb_record"), "kind": "choice",
            "options": [
                {
                    "label": "把真相公諸於世",
                    "success": {
                        "text": "「信仰不該是政治的工具——我說了二十年，今天終於有了證據。」她把判決抄了三份，一份寄往索里耶爾。你知道教廷不會高興，她也知道。",
                        "set_flags": ["mabb_2_done"],
                        "effects": [aff(ELN, 10, "陪她說出審判的真相"), rep("holy_ring", -3)],
                        "complete": True,
                    },
                },
                {
                    "label": "先把卷宗藏起來",
                    "success": {
                        "text": "「……你說得對，現在還不是時候。」她把判決鎖進聖殿的地窖，「但他的名字，我會記得。埃利昂。」",
                        "set_flags": ["mabb_2_done"],
                        "effects": [aff(ELN, 5, "替她保住了審判的真相")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(500), xp(900)],
}

mist3 = {
    "id": "mist_saint",
    "title": "被抹去名字的聖者",
    "summary": "聖者埃利昂的名字被抹去，靈魂既不能升天也不能安息，成了修道院之底的「禁忌的聖者」。把他的名字還給他。（晨霧修道院・三）",
    "rank": "B",
    "merit": 15,
    "start": {
        "kind": "npc", "npc": ELN, "min_level": 11, "requires": need("mabb_2_done"),
        "text": "艾莉諾找到了晨霧修道院最後一位修士的日記：聖者埃利昂被封在修道院之底，教廷召來的熾天使看守著他；他的名字被抹去，靈魂既不能升天也不能安息，成了霧裡那位「禁忌的聖者」。「把他的名字還給他。」她說，「也許他就能睡了。」",
    },
    "start_flags": ["mabb_saint"],
    "nodes": [
        {
            "id": "seraphs", "title": "在晨霧修道院底層穿過熾天使的守衛",
            "text": "底層的穹頂下，兩位六翼被霧染灰的熾天使交叉著光矛，擋在通往祭壇的路上。牠們沒有臉，只有聲音：「此處埋葬的人沒有名字。」",
            "at": at_dun("mist_abbey", "abyss"), "requires": need("mabb_saint"), "kind": "combat",
            "enemies": [["grey_wing_seraph", 1], ["mist_seraph", 1]],
            "success": {
                "text": "熾天使的光矛垂了下來，灰色的羽毛散落一地。祭壇就在前面，上面只有一塊被鑿平的石碑。",
                "set_flags": ["mabb_altar"],
            },
        },
        {
            "id": "name", "title": "在晨霧修道院底層的祭壇刻回聖者的名字",
            "text": "被鑿平的石碑冷得像冰。遠處的霧裡，禁忌的聖者還在低語，聲音像是很多人在同時祈禱——那不是他，是神蹟的殘響——歷史之龍阿契隆讓這座修道院反覆重演被審判的那一天，每過一陣子，它就會在霧裡重新聚起形體。",
            "at": at_dun("mist_abbey", "abyss"), "requires": need("mabb_altar"), "kind": "choice",
            "options": [
                {
                    "label": "在祭壇的石碑刻上「埃利昂」",
                    "success": {
                        "text": "你把名字一筆一畫刻回石碑。霧裡的祈禱聲停了一瞬，然後一個很輕的聲音說：「……謝謝。」霧沒有散，神蹟的殘響還困在封印裡；但從那天起，晨霧修道院的鐘聲再也沒有在黎明響起。",
                        "set_flags": ["mabb_named"],
                        "effects": [aff(ELN, 10, "把聖者的名字還給了他"), {"type": "item", "name": "聖者的禁忌經卷", "qty": 1}, mem("在晨霧修道院的底層，把聖者埃利昂的名字刻回了祭壇的石碑。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "把石碑帶回晨曦聖殿",
                    "success": {
                        "text": "你把石碑從祭壇上撬下來，一路背回晨光城。艾莉諾在聖殿的祭壇旁立起石碑，刻上「埃利昂」。朝聖者開始在碑前放花，教廷的使者來過兩次，都沒能把碑帶走。修道院的鐘聲，再也沒有在黎明響起。",
                        "set_flags": ["mabb_named"],
                        "effects": [aff(ELN, 15, "把聖者的碑帶回聖殿"), rep("holy_ring", -3), mem("把聖者埃利昂的石碑從晨霧修道院的底層帶回晨曦聖殿，讓所有人都看見他的名字。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 伊莎朵拉：大小姐的護衛契約 ----------------
isa1 = {
    "id": "isadora_interview",
    "title": "鞭子大小姐的護衛面試",
    "summary": "霍恩海姆侯爵家的「鞭子大小姐」伊莎朵拉在找新的護衛——換掉的護衛比她穿過的禮服還多。（伊莎朵拉・一）",
    "tags": ["adult"],
    "rank": "D",
    "merit": 6,
    "start": {
        "kind": "npc", "npc": ISA, "min_affinity": 0, "min_level": 5,
        "text": "「哦呵呵！你就是今天的應徵者？」金髮的大小姐用馬鞭挑起你的下巴，上下打量。「本小姐換掉的護衛比禮服還多。想留下來，就先讓本小姐看看你配不配。」",
    },
    "start_flags": ["isa_start"],
    "nodes": [
        {
            "id": "trial", "title": "在萊茵堡近郊和霍恩海姆家的護衛過招",
            "text": "侯爵家的兩名護衛在城外的練兵場上擺好架勢，大小姐坐在女僕撐起的陽傘下喝茶。「別讓本小姐等太久。」",
            "at": outskirts("rhineburg"), "requires": need("isa_start"), "kind": "combat",
            "enemies": [["hohenheim_guard", 2]],
            "success": {
                "text": "兩名護衛被你撂倒在泥地裡。伊莎朵拉放下茶杯，愣了半秒才想起要「哦呵呵」：「還、還算可以！明天開始，陪本小姐逛街！」",
                "set_flags": ["isa_hired"], "effects": [aff(ISA, 5, "通過了護衛的面試")],
            },
            "fail": {
                "text": "你被打得滿身是泥，大小姐卻沒有叫你滾：「……至少你沒有求饒。明天開始，陪本小姐逛街。」",
                "set_flags": ["isa_hired"],
            },
        },
        {
            "id": "shopping", "title": "陪伊莎朵拉在萊茵堡的裁縫店挑禮服",
            "text": "大小姐在裁縫店裡試了第十七件禮服，每一件都轉過身來問你「如何？」女僕長伊芙站在一旁，用最恭敬的語氣說：「大小姐，您已經問了十七次了。」",
            "at": at_cell("rhineburg", "tailor"), "requires": need("isa_hired"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": {
                "text": "你說了實話：每一件都好看，但她穿第一件的時候笑得最自然。伊莎朵拉的臉一下子紅到耳根，馬鞭差點掉在地上：「誰、誰在問你這個！……就買第一件。」伊芙在她身後，對你微微點了點頭。",
                "set_flags": ["isa_shopped"], "effects": [aff(ISA, 5, "說她笑起來最好看")],
            },
            "fail": {
                "text": "你的評語讓大小姐氣得用馬鞭敲你的頭，最後還是買了你說好看的那一件，一路上都不肯跟你說話——卻也一路都沒放開你的袖子。",
                "set_flags": ["isa_shopped"],
            },
        },
        {
            "id": "secret", "title": "深夜在萊茵堡的旅店赴大小姐的約",
            "text": "深夜，一個披著斗篷的人敲開你的房門——是伊莎朵拉，手上沒有馬鞭。「父親要把本小姐嫁給雷歐哈特將軍，那個滿嘴榮耀的吵鬧鬼。」她抓著斗篷的邊，聲音越來越小，「本小姐找護衛，其實是想找一個……能帶我逃走的人。」",
            "at": at_cell("rhineburg", "inn"), "requires": need("isa_shopped"), "kind": "choice",
            "options": [
                {
                    "label": "握住她的手，答應她",
                    "success": {
                        "text": "伊莎朵拉愣住了，接著撲進你懷裡，又在下一秒推開你，臉紅得像要燒起來：「本、本小姐只是在確認你的忠誠！」臨走前，她在門口回頭：「訂婚舞會在下個季度。在那之前……你可別被別人雇走了。」",
                        "set_flags": ["isa_1_done"],
                        "effects": [aff(ISA, 15, "答應帶她逃走"), mem("霍恩海姆家的大小姐伊莎朵拉深夜來訪，說她找護衛是想找一個能帶她逃走的人。你答應了。")],
                        "complete": True,
                    },
                },
                {
                    "label": "勸她先跟父親談談",
                    "success": {
                        "text": "「談？你以為本小姐沒試過嗎？」她咬著嘴唇，最後還是點了點頭：「……好吧，本小姐再試一次。但如果不行——」她沒說完，用斗篷遮著臉跑了。",
                        "set_flags": ["isa_1_done"],
                        "effects": [aff(ISA, 5, "認真聽她說話")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(200), xp(400)],
}

isa2 = {
    "id": "isadora_ball",
    "title": "訂婚舞會上的假情人",
    "summary": "伊莎朵拉要你在她和雷歐哈特將軍的訂婚舞會上扮演她的情人——讓所有人都看見，金獅配不上她。（伊莎朵拉・二）",
    "tags": ["adult"],
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": ISA, "min_affinity": 20, "min_level": 8, "requires": need("isa_1_done"),
        "text": "伊莎朵拉把一封燙金的請柬拍在你胸口：「訂婚舞會。本小姐要你當本小姐的『情人』出席——讓所有人都看見，雷歐哈特配不上本小姐。這是命令！」她說完，偷偷看了你一眼，「……拜託你了。」",
    },
    "start_flags": ["isa_ball"],
    "nodes": [
        {
            "id": "dress", "title": "讓女僕長伊芙替你打扮",
            "text": "伊芙把你按在侯爵府偏廳的鏡子前，替你換上一套比你全身家當還貴的禮服，再一絲不苟地繫好領巾。她用最恭敬的語氣說：「大小姐這輩子只對兩個人說過『拜託』，另一個是過世的夫人。請您務必……不要讓她失望。」",
            "at": at_npc(EVE), "requires": need("isa_ball"), "kind": "story",
            "success": {
                "text": "鏡子裡的你看起來像個貴族。伊芙退後一步打量你，難得地露出一點笑意：「勉強及格。」",
                "set_flags": ["isa_dressed"], "effects": [aff(EVE, 5, "替大小姐赴舞會")],
            },
        },
        {
            "id": "dance", "title": "在舞會上扮演大小姐的情人",
            "text": "舞會廳裡燈火輝煌，貴族們竊竊私語。伊莎朵拉挽著你的手臂走進來，全場安靜了一瞬——然後她在眾目睽睽之下踮起腳，吻了你。",
            "at": at_npc(ISA), "requires": need("isa_dressed"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": {
                "text": "你接住了這個吻，摟著她的腰跳完一整支舞，她在你懷裡抖得像片葉子。散場前，金獅雷歐哈特走過來，臉上掛著僵硬的笑：「明天日出，城外。我要用劍確認，你配不配得上她。」",
                "set_flags": ["isa_challenged"], "effects": [aff(ISA, 5, "在舞會上接住了她的吻")],
            },
            "fail": {
                "text": "你僵得像根木頭，跳舞時踩了她三次腳，她卻一直沒放開你的手。金獅雷歐哈特終於看不下去了：「明天日出，城外。我要用劍確認，你配不配得上她。」",
                "set_flags": ["isa_challenged"],
            },
        },
        {
            "id": "duel", "title": "在萊茵堡近郊接受金獅的決鬥",
            "text": "日出時分，雷歐哈特披著金色的披風站在城外，身邊是兩名艾斯特家的代理騎士。「帝國的將軍不能為私事拔劍——這是規矩。」他看起來真心覺得遺憾，「就由他們替我確認吧。」",
            "at": outskirts("rhineburg"), "requires": need("isa_challenged"), "kind": "combat",
            "enemies": [["este_duel_knight", 2]],
            "success": {
                "text": "代理騎士們倒下了。雷歐哈特大笑著走過來，用力拍你的肩：「好！說實話，我也不想結婚——我要的是戰場上的榮耀，不是禮堂。我會去跟侯爵說，是我配不上她。」伊莎朵拉躲在馬車後面看完了全程，紅著臉沒有出來。",
                "set_flags": ["isa_2_done"],
                "effects": [aff(ISA, 15, "替她贏了決鬥"), aff(LEO, 10, "在決鬥中證明了自己"), mem("在訂婚舞會上扮演伊莎朵拉的情人，又在決鬥中打倒了雷歐哈特的代理騎士，婚約解除了。")],
                "complete": True,
            },
            "fail": {
                "text": "你輸了。雷歐哈特卻收起了笑：「你輸了劍，卻沒有退一步。……說實話，我也不想結婚。我會去跟侯爵說，是我配不上她。」伊莎朵拉衝過來替你擦臉上的血，一邊哭一邊罵你笨蛋。",
                "set_flags": ["isa_2_done"],
                "effects": [aff(ISA, 15, "為她站上了決鬥場"), mem("在訂婚舞會上扮演伊莎朵拉的情人，又為她接下了金獅的決鬥。婚約解除了。")],
                "complete": True,
            },
        },
    ],
    "rewards": [money(300), xp(900)],
}

isa3 = {
    "id": "isadora_elope",
    "title": "大小姐的私奔",
    "summary": "侯爵替伊莎朵拉訂了新的婚約——對方是年過六十的公爵。女僕長伊芙遞給你一把後門的鑰匙。（伊莎朵拉・三）",
    "tags": ["adult"],
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": EVE, "min_level": 11, "requires": {"flags": ["isa_2_done"], "affinity": {ISA: 30}},
        "text": "女僕長伊芙在街角攔住你，第一次沒有用敬語：「侯爵替大小姐訂了新的婚約——對方是年過六十的公爵，下個月就要送她過去。大小姐把自己鎖在房裡三天了。」她把一把銅鑰匙塞進你手裡，「後門的。這是我這輩子做過最不像女僕的事。」",
    },
    "start_flags": ["isa_elope"],
    "nodes": [
        {
            "id": "rescue", "title": "深夜潛進侯爵府帶走伊莎朵拉",
            "text": "你用伊芙的鑰匙打開侯爵府的後門。伊莎朵拉已經換好了旅行的衣服，手上提著一只小得可憐的行李箱，眼睛哭得通紅。「……你遲到了。」她的聲音在發抖，「本小姐差點以為你不來了。」",
            "at": at_npc(ISA), "requires": need("isa_elope"), "kind": "story",
            "success": {
                "text": "她把行李箱塞給你，自己緊緊抓著你的手臂。穿過花園時，她回頭看了一眼母親的畫像，什麼都沒說。",
                "set_flags": ["isa_out"], "join": ISA,
            },
        },
        {
            "id": "gate", "title": "在萊茵堡的城門突破侯爵的騎士",
            "text": "城門前，侯爵的騎士舉著火把攔住了去路。帶頭的騎士隊長嘆了口氣：「大小姐，請回吧。侯爵說，帶不回您，我們就不用回去了。」",
            "at": at_cell("rhineburg", "gate"), "requires": need("isa_out"), "kind": "combat",
            "enemies": [["hohenheim_knight", 3]],
            "success": {
                "text": "騎士們倒在城門下。伊莎朵拉回頭看了一眼燈火通明的侯爵府，然後握緊你的手：「走吧。」",
                "set_flags": ["isa_free"],
            },
        },
        {
            "id": "vow", "title": "在萊茵堡城外決定兩人的去處",
            "text": "城外的小丘上，天快亮了。伊莎朵拉第一次沒有用「本小姐」：「我什麼都沒帶，只帶了自己。這樣……可以嗎？」",
            "at": outskirts("rhineburg"), "requires": need("isa_free"), "kind": "choice",
            "options": [
                {
                    "label": "帶她遠走高飛",
                    "success": {
                        "text": "你們在河谷鎮租了一間小屋。第一個晚上，大小姐笨手笨腳地煮糊了湯，然後吹熄了燈，第一次用名字叫你，在你懷裡又哭又笑到天亮。她把那條馬鞭掛在牆上：「以後不需要了。」",
                        "set_flags": ["isa_eloped"], "leave": ISA, "travel_to": "rivervale",
                        "effects": [aff(ISA, 20, "帶她私奔"), mem("帶著伊莎朵拉從萊茵堡私奔，在河谷鎮租了一間小屋。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "回去向侯爵提親",
                    "check": {"attr": "cha", "dc": 17},
                    "success": {
                        "text": "你帶著她回到侯爵府，在侯爵面前單膝跪下。侯爵沉默了很久，看著女兒從未有過的表情，最後嘆了口氣：「……妳母親當年，也是這樣看著我的。」新的婚約撤回了。那天晚上，伊莎朵拉沒有回自己的房間。",
                        "set_flags": ["isa_engaged"], "leave": ISA,
                        "effects": [aff(ISA, 20, "向她的父親提親"), rep("rhine_empire", 3), mem("帶著伊莎朵拉回到侯爵府提親，侯爵答應了。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "侯爵把你們趕出了大門。伊莎朵拉卻笑了，笑得像個普通的女孩子：「本小姐早就說過了吧？走，我們私奔。」你們在河谷鎮租了一間小屋，她把那條馬鞭掛在牆上。",
                        "set_flags": ["isa_eloped"], "leave": ISA, "travel_to": "rivervale",
                        "effects": [aff(ISA, 20, "為她去向侯爵提親"), mem("向侯爵提親被拒，帶著伊莎朵拉私奔到河谷鎮。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(1800)],
}

BATCH2 = [rhine1, rhine2, rhine3, mist1, mist2, mist3, isa1, isa2, isa3]
