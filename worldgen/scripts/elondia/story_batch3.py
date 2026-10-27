"""第三批特殊任務：索里耶爾的教義線、蛇溪洞窟、阿雅（成人向，含 NTR 分支）。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need

HAN, ISB, AYA = 'npc_old_hannah', 'npc_isabella_rowan', 'npc_aya'
ITEM = lambda name, qty=1: {"type": "item", "name": name, "qty": qty}

# ---------------- 索里耶爾：教義的重新解釋 ----------------
doct1 = {
    "id": "doctrine_notebook",
    "title": "抄寫員的筆記",
    "summary": "大教堂書庫的抄寫員把一本筆記忘在蠟燭攤上，之後就再也沒出現。筆記裡用紅墨水圈起了一行經文。（教義的重新解釋・一）",
    "rank": "D",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": HAN, "min_level": 5,
        "text": "漢娜嬤嬤從蠟燭攤底下摸出一本磨破了角的筆記：「大教堂書庫的抄寫員雷恩，三天前把這個忘在我這裡，之後就沒再來買蠟燭了。那孩子每天都來的。」她壓低聲音，「昨天有穿黑衣的人來問過，我說沒看見。」",
    },
    "start_flags": ["doct_start"],
    "nodes": [
        {
            "id": "read", "title": "在索里耶爾的神殿解讀抄寫員的筆記",
            "text": "筆記裡是雷恩逐字比對的兩份經文：一份是書庫裡最古老的《聖環原典》抄本，一份是現在每座神殿都在念的版本。大部分一字不差，只有一行用紅墨水圈了起來。",
            "at": at_cell("soriel", "temple"), "requires": need("doct_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": {
                "text": "原典寫的是「聖環之光照耀萬民」，現行的版本卻是「聖環之光照耀人類」。筆記最後一頁潦草地寫著：「審判廷的人來問過我了。我得把原典的那一頁藏到城外的舊磨坊去。」",
                "set_flags": ["doct_clue"],
            },
            "fail": {
                "text": "你看不懂那些古體字，只認得紅墨水圈起來的「萬民」與「人類」，以及最後一行：「審判廷的人來問過我了……城外的舊磨坊。」",
                "set_flags": ["doct_clue"],
            },
        },
        {
            "id": "mill", "title": "在索里耶爾近郊的舊磨坊找到抄寫員",
            "text": "城外的舊磨坊裡，三個穿著黑衣的審判廷執事圍著一個瘦弱的年輕修士，逼他交出藏起來的東西。「異端的證物，必須交給審判長。」",
            "at": outskirts("soriel"), "requires": need("doct_clue"), "kind": "combat",
            "enemies": [["cloister_deacon", 3]],
            "success": {
                "text": "執事們倒下了。雷恩發著抖從磨坊的石縫裡取出一張發黃的羊皮紙——原典的那一頁。「求求你……不要讓它被燒掉。」",
                "set_flags": ["doct_page"],
            },
            "fail": {
                "text": "執事們把你們打退了，卻沒找到東西就走了。雷恩從磨坊的石縫裡取出一張發黃的羊皮紙：「他們會再來的。求求你，不要讓它被燒掉。」",
                "set_flags": ["doct_page"],
            },
        },
        {
            "id": "page", "title": "回到漢娜嬤嬤的蠟燭攤決定原典的去向",
            "text": "雷恩把羊皮紙緊緊抱在懷裡：「一個字的差別，就決定了魔族有沒有被救贖的資格。教廷這兩百年來的每一場聖戰，都是從這個字開始的。」漢娜嬤嬤替他披上一件舊斗篷，看著你：「孩子，你說呢？」",
            "at": at_npc(HAN), "requires": need("doct_page"), "kind": "choice",
            "options": [
                {
                    "label": "交給聖殿騎士團長伊莎貝拉",
                    "success": {
                        "text": "伊莎貝拉把羊皮紙收進鎧甲的內襯：「審判廷的公文我擋得了，這個我也擋得了。」她讓雷恩住進了騎士團的營房。雷恩說，書庫的地下還有別的抄本——總有一天會有人想起它們。",
                        "set_flags": ["doct_1_done", "doct_to_isabella"],
                        "counters": {"human_stance": 1},
                        "effects": [aff(ISB, 10, "把原典交給她保管"), mem("在索里耶爾救出抄寫員雷恩，把《聖環原典》裡寫著「照耀萬民」的那一頁交給了聖殿騎士團長伊莎貝拉。")],
                        "complete": True,
                    },
                },
                {
                    "label": "交給審判長瓦倫汀",
                    "success": {
                        "text": "審判長面無表情地收下羊皮紙，當著你的面放進火盆：「信仰不需要兩個版本。」雷恩被送去北方的修道院悔罪。審判廷記下了你的名字——作為一個「可靠的人」。",
                        "set_flags": ["doct_1_done", "doct_to_valentin"],
                        "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 5), mem("在索里耶爾找到《聖環原典》裡寫著「照耀萬民」的那一頁，交給了審判長瓦倫汀，他當面燒掉了它。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

doct2 = {
    "id": "doctrine_mirror",
    "title": "真理之鏡前的審判",
    "summary": "審判廷抓了抄寫員的老師、老神學家奧斯瓦德，罪名是「散布偽造的經文」。三天後，他要在真理之鏡前受審。（教義的重新解釋・二）",
    "rank": "C",
    "merit": 10,
    "start": {
        "kind": "informant", "location": "soriel", "price": 300, "min_level": 8, "requires": need("doct_1_done"),
        "text": "情報商把一張審判廷的公告推給你：老神學家奧斯瓦德——抄寫員雷恩的老師——被控「散布偽造的經文」，三天後要在審判迴廊的真理之鏡前受審。「聽說聖殿騎士團長在找肯替他作證的人。這種事，你知道的，沒幾個人敢。」",
    },
    "start_flags": ["doct_trial"],
    "nodes": [
        {
            "id": "templar", "title": "在索里耶爾找聖殿騎士團長伊莎貝拉",
            "text": "伊莎貝拉剛從訓練場下來，一身汗，手裡還拎著一瓶麥酒：「奧斯瓦德老師教過我念書。」她擦了擦劍，「審判廷要的是一個認罪的老人，我要的是一個能在鏡子前說真話的證人。」",
            "at": at_npc(ISB), "requires": need("doct_trial"), "kind": "story",
            "success": {
                "text": "「去酒館找那些聽過他講道的水手吧。」她把麥酒塞給你，「我賭一瓶酒，你找得到。」",
                "set_flags": ["doct_hunt"],
            },
        },
        {
            "id": "witness", "title": "到索里耶爾的酒館找願意作證的人",
            "text": "你在酒館裡一桌一桌地問。一聽到「審判廷」三個字，人們不是低頭喝酒，就是起身離開。",
            "at": at_cell("soriel", "tavern"), "requires": need("doct_hunt"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": {
                "text": "一個老水手拍桌站起來：「奧斯瓦德神父替魔族的漁夫做過臨終禱告，我親眼看到的。他說聖環的光不挑人。我去作證！」",
                "set_flags": ["doct_witness"],
            },
            "fail": {
                "text": "沒有人敢站出來，直到一個瞎眼的老婦人摸索著抓住你的袖子：「我去。神父替我那魔族的女婿念過經。我已經沒什麼好怕的了。」",
                "set_flags": ["doct_witness"],
            },
        },
        {
            "id": "escort", "title": "在索里耶爾近郊護送證人回城",
            "text": "帶證人回城的路上，兩名審判廷的審問官攔住了你們，手按在燒得發紅的印章上：「證人？審判廷只需要一個罪人。」",
            "at": outskirts("soriel"), "requires": need("doct_witness"), "kind": "combat",
            "enemies": [["cloister_questioner", 2]],
            "success": {
                "text": "審問官們倒下了，證人緊緊抓著你的手。明天就是審判。",
                "set_flags": ["doct_safe"],
            },
            "fail": {
                "text": "審問官們把你們逼到路邊，卻在聖殿騎士的號角聲中退走了——伊莎貝拉親自騎馬來接人：「我賭贏了。」",
                "set_flags": ["doct_safe"],
            },
        },
        {
            "id": "trial", "title": "在真理之鏡前作證",
            "text": "審判迴廊裡，白髮的奧斯瓦德被帶到真理之鏡前。審判長瓦倫汀宣讀罪狀：「散布偽造的經文。」你和證人站在旁聽席上，伊莎貝拉在你身邊低聲說：「輪到你了。」",
            "at": at_npc(ISB), "requires": need("doct_safe"), "kind": "choice",
            "options": [
                {
                    "label": "在鏡前念出原典的那一行",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "你在鏡前念出「聖環之光照耀萬民」。真理之鏡沒有暗下去——鏡面清澈得像水。旁聽席一片譁然，審判長沉默了很久，最後宣布：「證據不足，退庭。」伊莎貝拉在散場時用力拍了你的背。",
                        "set_flags": ["doct_2_done"], "counters": {"human_stance": 1},
                        "effects": [aff(ISB, 10, "在真理之鏡前替老師作證"), mem("在索里耶爾的真理之鏡前念出原典的「照耀萬民」，鏡面沒有暗下去，老神學家奧斯瓦德被無罪釋放。")],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你的聲音被審判長打斷，但證人站了起來，鏡面依然清澈。奧斯瓦德被判「暫緩審理」，回到了書庫——在審判廷的監視下。",
                        "set_flags": ["doct_2_done"], "counters": {"human_stance": 1},
                        "effects": [mem("在索里耶爾的真理之鏡前替老神學家奧斯瓦德作證，他被判暫緩審理。")],
                        "complete": True,
                    },
                },
                {
                    "label": "勸老神學家認罪保命",
                    "success": {
                        "text": "你勸奧斯瓦德認罪。老人看了你很久，嘆了口氣，在鏡前低下頭：「我錯了。」他保住了命，被送去北方的修道院；審判廷在大教堂外貼出公告：原典的爭議到此為止。伊莎貝拉一整晚都沒跟你說話。",
                        "set_flags": ["doct_2_done"], "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 3), aff(ISB, -5, "勸老師認罪"), mem("在索里耶爾的真理之鏡前勸老神學家奧斯瓦德認罪，原典的爭議被壓了下來。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

doct3 = {
    "id": "doctrine_council",
    "title": "大公會議",
    "summary": "教皇格里高利七世召開兩百年來的第一次大公會議，議題只有一個：《聖環原典》的那一行，要不要改回來。（教義的重新解釋・三）",
    "rank": "B",
    "merit": 15,
    "start": {
        "kind": "guild", "location": "soriel", "min_level": 11, "requires": need("doct_2_done"),
        "text": "公會收到一份來自聖殿騎士團長的指名委託：教皇格里高利七世召開兩百年來的第一次大公會議，議題只有一個——《聖環原典》的那一行要不要改回來。審判廷派與騎士團派吵翻了天，會議期間需要信得過的護衛，也需要一個不屬於教廷的證人。",
    },
    "start_flags": ["doct_council"],
    "nodes": [
        {
            "id": "zealots", "title": "在索里耶爾的城門擋下狂信的騎士",
            "text": "會議前夜，一隊狂信的騎士在城門集結，要「在異端的會議開始之前淨化它」。他們的白甲上，聖環被塗成了黑色。",
            "at": at_cell("soriel", "gate"), "requires": need("doct_council"), "kind": "combat",
            "enemies": [["zealot_templar", 3]],
            "success": {
                "text": "狂信者們倒下了，城門的鐘聲照常響起。天亮時，主教們的馬車一輛接一輛駛進聖城。",
                "set_flags": ["doct_guarded"],
            },
            "fail": {
                "text": "你們撐不住了，所幸伊莎貝拉帶著騎士團趕來，把狂信者們押走。你帶著一身的傷走進了聖環主殿。",
                "set_flags": ["doct_guarded"], "effects": [hp(-0.2)],
            },
        },
        {
            "id": "vote", "title": "在大公會議上回答教皇",
            "text": "聖環主殿的穹頂下坐滿了主教。教皇格里高利七世坐在最高處，蒼老的手指輕敲著扶手，伊莎貝拉站在你身後。教皇看向你——一個不屬於教廷的證人：「你走過大陸的每個角落。你說，光該照耀誰？」",
            "at": at_npc(ISB), "requires": need("doct_guarded"), "kind": "choice",
            "options": [
                {
                    "label": "照耀萬民",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "「我見過魔族的孩子在神殿外祈禱。」你說。教皇閉上眼睛，良久，敲下了權杖：「原典的那一行，改回來。」穹頂下一半的人站了起來，另一半的人跪下了。",
                        "set_flags": ["doct_reform"], "counters": {"human_stance": 1},
                        "effects": [rep("holy_ring", 5), aff(ISB, 10, "在大公會議上替原典說話"), mem("在聖環教廷的大公會議上回答「光該照耀萬民」，教皇把原典改了回來。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你的話被審判廷的喝斥聲淹沒。教皇最後宣布「原典的爭議交由下一次會議」——但他在離席前，親手在原典上補回了那個字。",
                        "set_flags": ["doct_reform"], "counters": {"human_stance": 1},
                        "effects": [rep("holy_ring", 3), mem("在聖環教廷的大公會議上替原典說話，教皇親手在原典上補回了「萬民」。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "照耀人類",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "「魔族不需要我們的光，人類需要。」審判長第一個站起來鼓掌。教皇看了你很久，敲下權杖：「原典維持現狀。」那天晚上，雷恩的抄本被送進了審判迴廊的火盆。",
                        "set_flags": ["doct_orthodox"], "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 5), aff(ISB, -10, "在大公會議上反對原典"), mem("在聖環教廷的大公會議上回答「光該照耀人類」，原典維持了現狀。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你說得猶豫，騎士團派趁機反駁，會議吵到深夜。最後教皇以一票之差宣布：「原典維持現狀。」",
                        "set_flags": ["doct_orthodox"], "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 3), mem("在聖環教廷的大公會議上，原典以一票之差維持了現狀。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 地下城：蛇溪洞窟 ----------------
snake1 = {
    "id": "snake_red_creek",
    "title": "溪水變紅的那天",
    "summary": "阿爾貝納南方商路旁的牧場接連丟了牛羊，蛇溪的水變成了暗紅色。（蛇溪洞窟・一）",
    "rank": "D",
    "merit": 8,
    "start": {
        "kind": "guild", "location": "albena", "min_level": 5,
        "text": "公會的告示板上貼著牧場主聯名的委託：南方商路旁的牧場接連丟了牛羊，蛇溪的水這幾天變成了暗紅色，下游的村子已經不敢取水。",
    },
    "start_flags": ["snk_start"],
    "nodes": [
        {
            "id": "tracks", "title": "在阿爾貝納近郊追查失蹤的牲口",
            "text": "牧場的柵欄被什麼東西撞斷了，草地上有一道寬得像車道的拖痕，一路往南延伸，沾著黏液與血。",
            "at": outskirts("albena"), "requires": need("snk_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": {
                "text": "拖痕的寬度不對——溪蛇魔沒有這麼大。你在拖痕旁撿到一片手掌大的鱗片，邊緣還帶著蛻皮的薄膜。拖痕的盡頭是蛇溪洞窟。",
                "set_flags": ["snk_tracks"],
            },
            "fail": {
                "text": "你沿著拖痕走了半天，鞋子全濕了，最後只確定一件事：那東西回到了蛇溪洞窟。",
                "set_flags": ["snk_tracks"],
            },
        },
        {
            "id": "middle", "title": "在蛇溪洞窟中層找到牲口的下落",
            "text": "中層的水道裡漂著牛羊的骨頭。一個被困在洞裡的走私魔法師背靠著岩壁，用火球逼退爬上來的溪蛇魔，看見你們就大喊：「別光看著，幫忙啊！」",
            "at": at_dun("snake_creek", "middle"), "requires": need("snk_tracks"), "kind": "combat",
            "enemies": [["creek_serpent", 2], ["smuggler_mage", 1]],
            "success": {
                "text": "蛇魔退回了水裡。魔法師也被你們撂倒了，臨昏過去前嘟囔著：「蛇魔母在下蛋……牠們全都往上爬，因為下面有更可怕的東西醒了。」岩縫裡卡著一張比人還長的蛻皮。",
                "set_flags": ["snk_skin"],
            },
            "fail": {
                "text": "你們被逼退到樓梯口。魔法師趁亂跑了，臨走前丟下一句：「下面有更可怕的東西醒了！」岩縫裡卡著一張比人還長的蛻皮。",
                "set_flags": ["snk_skin"],
            },
        },
        {
            "id": "report", "title": "把蛻皮帶回阿爾貝納的公會",
            "text": "公會的鑑定師量了量蛻皮，臉色發白：「這不是溪蛇魔，是更老、更大的東西。牲口是被牠的子孫叼走的。」他看著你，「蛇魔暫時退回洞裡了，這東西你打算怎麼處理？」",
            "at": at_cell("albena", "guild"), "requires": need("snk_skin"), "kind": "choice",
            "options": [
                {
                    "label": "交給公會建檔",
                    "success": {
                        "text": "公會把蛻皮掛在大廳裡，警告來往的商隊繞道。牧場主們湊了一筆謝禮給你：「至少知道是什麼東西了。」",
                        "set_flags": ["snk_1_done"],
                        "effects": [money(150), rep("aude_federation", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "賣給魔法物品店",
                    "success": {
                        "text": "魔法物品店的老闆兩眼發光，當場付了一大筆錢，還多問了一句：「下面還有更大的嗎？有的話，我全收。」",
                        "set_flags": ["snk_1_done"],
                        "effects": [money(400)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(250), xp(450)],
}

snake2 = {
    "id": "snake_eggs",
    "title": "蛇魔母的卵",
    "summary": "阿爾貝納的煉金術士在跟走私者收購蛇魔的卵。卵孵出來的，是不該存在的東西。（蛇溪洞窟・二）",
    "rank": "C",
    "merit": 10,
    "start": {
        "kind": "informant", "location": "albena", "price": 300, "min_level": 8, "requires": need("snk_1_done"),
        "text": "情報商搓著手指：「蛇溪的走私者殘黨找到了新生意——蛇魔母的卵。阿爾貝納有煉金術士高價收購，聽說孵出來的蛇有好幾顆頭。」",
    },
    "start_flags": ["snk_eggs"],
    "nodes": [
        {
            "id": "buyer", "title": "到阿爾貝納的魔法物品店找收購卵的人",
            "text": "魔法物品店後面的工作間裡，一個戴著皮手套的煉金術士正在替一顆青灰色的卵量體溫。他看見你，把卵藏到背後：「這是正當的研究。」",
            "at": at_cell("albena", "magic"), "requires": need("snk_eggs"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": {
                "text": "煉金術士終於鬆口：卵都是從深層的產卵室取出來的，走私者用霧鱗蛇魔的蛻皮掩蓋氣味。「孵出來的……確實不太正常。有好幾顆頭。」",
                "set_flags": ["snk_buyer"],
            },
            "fail": {
                "text": "煉金術士死不承認，但他的帳本攤在桌上：每一筆貨都標著「深層・產卵室」。",
                "set_flags": ["snk_buyer"],
            },
        },
        {
            "id": "nest", "title": "在蛇溪洞窟深層找到產卵室",
            "text": "深層的岩洞裡堆滿了青灰色的卵，有幾顆已經裂開，裡面探出不止一顆頭。守在卵堆旁的蛇魔豎起鱗片，霧從牠們身上散開。",
            "at": at_dun("snake_creek", "deep"), "requires": need("snk_buyer"), "kind": "combat",
            "enemies": [["serpent_guard", 1], ["mist_serpent", 1]],
            "success": {
                "text": "守衛倒下了。卵堆就在眼前，有些已經開始搖晃。洞窟更深處傳來一陣低沉的震動，像是什麼巨大的東西在翻身。",
                "set_flags": ["snk_nest"],
            },
            "fail": {
                "text": "你們被霧逼退了一段，等霧散了再摸回去，守衛已經不見了——牠們被更深處的震動嚇跑了。卵堆還在原地搖晃。",
                "set_flags": ["snk_nest"],
            },
        },
        {
            "id": "burn", "title": "決定蛇溪洞窟產卵室的卵",
            "text": "卵堆在火把的光裡微微搖晃。燒掉它們，下游的村子會安全一陣子；帶一顆回去，煉金術士會付你一筆大錢，而你也許會知道這些多頭的蛇是從哪裡來的。",
            "at": at_dun("snake_creek", "deep"), "requires": need("snk_nest"), "kind": "choice",
            "options": [
                {
                    "label": "燒掉所有的卵",
                    "success": {
                        "text": "火焰吞沒了卵堆，劈啪聲裡夾著尖細的嘶叫。下游的村子會安全一陣子——但洞窟深處的震動沒有停。",
                        "set_flags": ["snk_2_done"],
                        "effects": [rep("aude_federation", 3), mem("在蛇溪洞窟的深層燒掉了蛇魔母的卵，洞窟更深處有什麼東西醒了。")],
                        "complete": True,
                    },
                },
                {
                    "label": "帶一顆回去給煉金術士",
                    "success": {
                        "text": "你燒掉了其他的卵，只用厚布包起一顆。煉金術士付了錢，三天後寫信告訴你：這些卵的血脈，全都通往暗河盡頭的同一個源頭。",
                        "set_flags": ["snk_2_done"],
                        "effects": [money(600), mem("在蛇溪洞窟的深層找到蛇魔母的卵，留了一顆給煉金術士研究；所有的血脈都通往暗河盡頭。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(500), xp(900)],
}

snake3 = {
    "id": "snake_progenitor",
    "title": "暗河盡頭的始祖",
    "summary": "蛇溪的水位一夜暴漲，下游的村子被沖毀了一半。暗河盡頭的地底湖裡，所有溪蛇魔的始祖醒了。（蛇溪洞窟・三）",
    "rank": "B",
    "merit": 15,
    "start": {
        "kind": "guild", "location": "albena", "min_level": 11, "requires": need("snk_2_done"),
        "text": "阿爾貝納的公會發出了緊急徵召：蛇溪的水位一夜暴漲，下游的村子被沖毀了一半，洪水裡全是蛇魔。倖存的漁夫說，洞窟深處的暗河在「呼吸」。",
    },
    "start_flags": ["snk_end"],
    "nodes": [
        {
            "id": "river", "title": "在蛇溪洞窟底層沿著暗河前進",
            "text": "底層的暗河寬得像一座湖。水面下有東西在游，身體比渡船還長；一顆、兩顆、三顆頭從霧裡探出來，噴著毒氣。",
            "at": at_dun("snake_creek", "abyss"), "requires": need("snk_end"), "kind": "combat",
            "enemies": [["serpent_elder", 1], ["venom_hydra", 1]],
            "success": {
                "text": "古蛇魔沉進了水裡，九頭蛇的頭一顆顆垂下。暗河的盡頭亮著幽綠的光，一陣潮濕的風吹過來——那是某個巨大的東西在呼吸。",
                "set_flags": ["snk_lake"],
            },
        },
        {
            "id": "progenitor", "title": "在蛇溪洞窟底層擊敗蛇魔始祖",
            "text": "地底湖的中央盤著一條看不見盡頭的巨蛇，鱗片上長滿了青苔與貝殼。所有溪蛇魔的始祖抬起頭，金色的豎瞳裡映著你的火把。",
            "at": at_dun("snake_creek", "abyss"), "requires": need("snk_lake"), "kind": "combat",
            "enemies": [["serpent_progenitor", 1], ["serpent_elder", 1]],
            "success": {
                "text": "始祖沉進了湖底。湖面平靜下來——然後，一張巨大的蛻皮浮了上來。湖底的光沒有熄滅：牠從來沒有真的死過，蛻下的皮會在湖底長出新的身體。下次來的時候，牠還會在這裡。",
                "set_flags": ["snk_fallen"],
            },
        },
        {
            "id": "outlet", "title": "在蛇溪洞窟底層封住暗河的出口",
            "text": "暗河從地底湖流向地面，蛇魔就是順著這條水路爬上蛇溪的。始祖重新長出身體之前，還有時間做點什麼。",
            "at": at_dun("snake_creek", "abyss"), "requires": need("snk_fallen"), "kind": "choice",
            "options": [
                {
                    "label": "炸塌暗河的出口",
                    "check": {"attr": "int", "dc": 16},
                    "success": {
                        "text": "你算準了岩層的裂縫，一聲巨響之後，暗河的出口被落石封死。蛇溪的水在三天後變回了清澈的顏色，下游的村子開始重建。",
                        "set_flags": ["snk_sealed"],
                        "effects": [rep("aude_federation", 5), mem("在蛇溪洞窟的底層擊敗了蛇魔始祖，炸塌了暗河的出口。始祖還會在湖底重生，但再也爬不上蛇溪了。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "爆炸的方向偏了，碎石砸得你們頭破血流，出口只塌了一半——但已經夠窄，大蛇魔爬不出去了。蛇溪的水慢慢變清。",
                        "set_flags": ["snk_sealed"],
                        "effects": [hp(-0.3), rep("aude_federation", 3), mem("在蛇溪洞窟的底層擊敗了蛇魔始祖，勉強封住了暗河的出口。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "收下蛻皮，讓暗河繼續流",
                    "success": {
                        "text": "暗河是下游村子唯一的水源，你決定不動它。你把始祖的蛻皮一路拖出洞窟，阿爾貝納的商人為它吵了三天。蛇溪的水慢慢變清——至少這一次。",
                        "set_flags": ["snk_sealed"],
                        "effects": [ITEM("古蛇魔的蛻皮", 2), money(800), mem("在蛇溪洞窟的底層擊敗了蛇魔始祖，留下暗河給下游的村子，帶走了牠的蛻皮。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 阿雅：祈禱書裡的秘密 ----------------
aya1 = {
    "id": "aya_prayer_book",
    "title": "祈禱書裡的秘密",
    "summary": "外環禮拜堂的修女阿雅掉了一本「祈禱書」，裡面寫的不是禱詞，而是讓人臉紅心跳的妄想。（阿雅・一）",
    "tags": ["adult"],
    "rank": "D",
    "merit": 6,
    "start": {
        "kind": "npc", "npc": AYA, "min_level": 5,
        "text": "外環的小禮拜堂門口，一個抱著一疊書的年輕修女和你撞個正著。書散了一地，你撿起其中一本「祈禱書」——攤開的那一頁寫的不是禱詞，而是一段讓人臉紅心跳的描寫：一個修女，和一個膚色黝黑、身形高大的異鄉男人。修女阿雅一把搶回書，臉紅得快要滴出血來：「請、請你忘掉剛才看到的東西！」",
    },
    "start_flags": ["aya_start"],
    "nodes": [
        {
            "id": "promise", "title": "回答阿雅的請求",
            "text": "阿雅把祈禱書緊緊抱在胸前，豐滿的胸口隨著急促的呼吸起伏，眼睛卻不敢看你：「這、這是……如果被審判廷知道，我會被趕出教會的。」",
            "at": at_npc(AYA), "requires": need("aya_start"), "kind": "choice",
            "options": [
                {
                    "label": "答應替她保密",
                    "success": {
                        "text": "阿雅鬆了一口氣，差點哭出來：「謝謝你……我從見習的時候就在寫了，從來沒有人知道。」她猶豫了一下，「你……不會覺得我很奇怪嗎？」",
                        "set_flags": ["aya_secret"], "effects": [aff(AYA, 10, "替她保守祈禱書的秘密")],
                    },
                },
                {
                    "label": "問她書裡寫的是不是她的願望",
                    "check": {"attr": "cha", "dc": 13},
                    "success": {
                        "text": "阿雅的臉更紅了，卻沒有逃走：「……是。我每天晚上都在向聖環懺悔，可是寫的東西越來越多。」她小聲地補了一句，「請你替我保密。」",
                        "set_flags": ["aya_secret"], "effects": [aff(AYA, 5, "看穿了她的心思")],
                    },
                    "fail": {
                        "text": "阿雅抱著書逃回了禮拜堂。第二天，她託人送來一張紙條，字跡抖得厲害：「請你保密。拜託了。」",
                        "set_flags": ["aya_secret"],
                    },
                },
            ],
        },
        {
            "id": "confess", "title": "在索里耶爾的神殿聽阿雅懺悔",
            "text": "幾天後，阿雅把你叫進神殿的懺悔室。這一次她坐在告解者的位置，你坐在神父的位置。「我想試試看……把書上的東西一件一件說出口。也許說出來，就不會再想了。」她翻開祈禱書，聲音細得像蚊子叫。",
            "at": at_cell("soriel", "temple"), "requires": need("aya_secret"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": {
                "text": "你安靜地聽她念。她念到一半就念不下去了，隔著木格窗，你聽見她急促的呼吸和衣料摩擦的聲音。「……說出來之後，反而更想了。」她小聲說，「我是不是很糟糕？」",
                "set_flags": ["aya_confessed"], "effects": [aff(AYA, 5, "安靜地聽完她的懺悔")],
            },
            "fail": {
                "text": "你忍不住咳了一聲，阿雅嚇得把書闔上，在懺悔室裡縮成一團，過了好久才敢繼續。念完時，她的聲音已經啞了。",
                "set_flags": ["aya_confessed"],
            },
        },
        {
            "id": "steps", "title": "在禮拜堂的台階上回答阿雅",
            "text": "那天晚上，阿雅在禮拜堂的台階上等你，懷裡抱著那本祈禱書：「我想知道……一個修女有這種念頭，是罪嗎？」",
            "at": at_npc(AYA), "requires": need("aya_confessed"), "kind": "choice",
            "options": [
                {
                    "label": "這不是罪，只是妳的一部分",
                    "success": {
                        "text": "阿雅愣了很久，然後把頭靠在你肩上：「第一次有人這樣跟我說。」她把祈禱書遞給你，「下一次懺悔……我想說更多。」",
                        "set_flags": ["aya_1_done"],
                        "effects": [aff(AYA, 15, "說她的念頭不是罪"), mem("知道了修女阿雅的祈禱書裡寫滿了妄想，替她保密，還告訴她那不是罪。")],
                        "complete": True,
                    },
                },
                {
                    "label": "妳只是太寂寞了",
                    "success": {
                        "text": "「寂寞……」阿雅咀嚼著這兩個字，輕輕笑了：「也許吧。那你……可以常來陪我說說話嗎？」",
                        "set_flags": ["aya_1_done"],
                        "effects": [aff(AYA, 10, "陪她說話")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(200), xp(400)],
}

aya2 = {
    "id": "aya_harbor",
    "title": "港區酒館的夜晚",
    "summary": "阿雅想親眼看看祈禱書裡寫的那種人——只是看看。她換下修女服，請你陪她去港區的酒館。（阿雅・二）",
    "tags": ["adult"],
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": AYA, "min_affinity": 20, "min_level": 8, "requires": need("aya_1_done"),
        "text": "阿雅換下了修女服，穿著一件不太合身的平民洋裝，頭巾壓得低低的：「港區的酒館……書裡寫的那種人，聽說常在那裡喝酒。我想去看看，只是看看。你能陪我去嗎？」",
    },
    "start_flags": ["aya_harbor"],
    "nodes": [
        {
            "id": "tavern", "title": "陪阿雅到索里耶爾的酒館",
            "text": "酒館裡擠滿了東海來的水手。角落那一桌是幾個膚色黝黑、身形高大的男人，笑聲粗獷。阿雅一看見他們就僵住了，手緊緊抓著你的袖子，卻移不開視線。其中一個水手注意到了她，舉起酒杯朝她笑了笑。",
            "at": at_cell("soriel", "tavern"), "requires": need("aya_harbor"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": {
                "text": "你替她點了一杯甜酒，讓她坐在看得見那一桌的位置。阿雅喝了兩口就紅了臉，小聲地說個不停——說書裡的情節、說那個水手的手臂、說她自己也不明白的心跳。",
                "set_flags": ["aya_seen"], "effects": [aff(AYA, 5, "陪她走進港區的酒館")],
            },
            "fail": {
                "text": "阿雅緊張得打翻了酒杯，水手們哄笑起來。她把臉埋進你的肩膀，卻從指縫裡偷偷往那一桌看。",
                "set_flags": ["aya_seen"],
            },
        },
        {
            "id": "tail", "title": "在索里耶爾近郊甩掉跟蹤的審問官",
            "text": "回程的路上，你發現有人跟著你們——審判廷的審問官。有人告發了「一個在港區酒館出沒的修女」。他們在城外的小路上攔住你們：「修女阿雅，請跟我們走一趟。」",
            "at": outskirts("soriel"), "requires": need("aya_seen"), "kind": "combat",
            "enemies": [["cloister_questioner", 2]],
            "success": {
                "text": "審問官們倒下了。阿雅在你身後發抖，卻沒有哭：「如果被他們帶走，我就再也不能……」她沒說完。",
                "set_flags": ["aya_escaped"],
            },
            "fail": {
                "text": "你們被逼到河邊，阿雅拉著你躲進蘆葦叢，審問官們找了一陣就走了。她渾身濕透地靠在你懷裡，心跳得比你還快。",
                "set_flags": ["aya_escaped"],
            },
        },
        {
            "id": "want", "title": "在禮拜堂回答阿雅想要的東西",
            "text": "回到禮拜堂，阿雅把祈禱書放在祭壇上。「我想清楚了。」她看著你，「我不想再只是寫了。可是……我不知道我想要的，到底是書裡的那些人，還是——」她沒有說下去。",
            "at": at_npc(AYA), "requires": need("aya_escaped"), "kind": "choice",
            "options": [
                {
                    "label": "牽起她的手：妳想要的是我",
                    "success": {
                        "text": "阿雅的眼淚掉了下來。她把祈禱書推到一邊，踮起腳吻了你：「……原來是這樣。原來我一直寫錯了人。」",
                        "set_flags": ["aya_2_done", "aya_pc"],
                        "effects": [aff(AYA, 20, "讓她知道自己想要的是誰"), mem("修女阿雅在祈禱書與你之間選擇了你。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "告訴她：去吧，我在這裡等妳",
                    "tags": ["ntr"],
                    "success": {
                        "text": "阿雅看了你很久，輕輕點了點頭。她換回那件平民洋裝，獨自走進了港區的夜色。天亮時她回到禮拜堂，頭髮凌亂、脖子上留著陌生的痕跡，眼神卻亮得驚人，一頭撲進你懷裡：「我回來了……我想把一切都告訴你。全部。」",
                        "set_flags": ["aya_2_done", "aya_ntr"],
                        "effects": [aff(AYA, 10, "讓她去實現祈禱書裡的事"), mem("讓修女阿雅獨自走進港區的夜色，去實現祈禱書裡的妄想。天亮時她回到你身邊，說要把一切都告訴你。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(900)],
}

aya3 = {
    "id": "aya_last_confession",
    "title": "最後的懺悔",
    "summary": "審判廷終於找上了阿雅的禮拜堂。她已經知道自己想要什麼了。（阿雅・三）",
    "tags": ["adult"],
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": AYA, "min_affinity": 40, "min_level": 11, "requires": need("aya_pc"),
        "text": "阿雅把祈禱書交到你手上：「審判廷終於找上門了。他們要我在真理之鏡前懺悔，否則就要燒掉這座禮拜堂。」她笑了笑，「我不怕。因為我已經知道自己想要什麼了。」",
    },
    "start_flags": ["aya_last"],
    "nodes": [
        {
            "id": "guard", "title": "在索里耶爾的神殿擋下來抓人的狂信騎士",
            "text": "聖環被塗成黑色的狂信騎士闖進了神殿，要把「墮落的修女」拖去審判。阿雅站在祭壇前，第一次沒有低頭。",
            "at": at_cell("soriel", "temple"), "requires": need("aya_last"), "kind": "combat",
            "enemies": [["zealot_templar", 2]],
            "success": {
                "text": "狂信騎士們倒在祭壇前。阿雅跨過他們，走到你身邊，緊緊握住你的手。",
                "set_flags": ["aya_safe"],
            },
        },
        {
            "id": "burn", "title": "陪阿雅處理那本祈禱書",
            "text": "夜深了，禮拜堂裡只剩下你們兩個。阿雅把祈禱書放在祭壇的燭火旁：「這本書陪了我十年。現在，我不需要它了。」",
            "at": at_npc(AYA), "requires": need("aya_safe"), "kind": "choice",
            "options": [
                {
                    "label": "和她一起燒掉祈禱書",
                    "success": {
                        "text": "書頁在燭火裡捲曲、發黑。阿雅靠在你懷裡看著它燒完，然後轉過身，解開了修女服的第一顆扣子：「最後的懺悔……我想用說的以外的方式。」那一夜，禮拜堂的燭火一直燒到天亮。",
                        "set_flags": ["aya_lover"],
                        "effects": [aff(AYA, 20, "陪她做完最後的懺悔"), mem("和阿雅一起燒掉了那本祈禱書，她成了你的戀人。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "留下祈禱書，寫進新的一頁",
                    "success": {
                        "text": "阿雅愣了一下，然後紅著臉笑了。她拿起筆，在祈禱書的最後一頁寫下新的故事——這一次，故事裡的人是你。那天晚上，她一頁一頁地念給你聽，然後一頁一頁地實現。",
                        "set_flags": ["aya_lover"],
                        "effects": [aff(AYA, 20, "成了她祈禱書裡的人"), mem("阿雅在祈禱書的最後一頁寫下了你，她成了你的戀人。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(1800)],
}

aya3n = {
    "id": "aya_ebony_club",
    "title": "黑檀之夜",
    "summary": "港區的酒館地下有一間只收熟客的俱樂部「黑檀之夜」。阿雅想讓你看看她在那裡的樣子，然後聽你說，你還要不要她。（阿雅・三，NTR 分支）",
    "tags": ["adult", "ntr"],
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": AYA, "min_affinity": 30, "min_level": 11, "requires": need("aya_ntr"),
        "text": "阿雅在你耳邊說，港區的酒館地下有一間只收熟客的俱樂部，叫「黑檀之夜」。「那天晚上的人帶我去過。」她的臉紅透了，眼神卻很坦然，「我想……讓你也看看我在那裡的樣子。然後，我想聽你說，你還要不要我。」",
    },
    "start_flags": ["aya_club_start"],
    "nodes": [
        {
            "id": "club", "title": "跟著阿雅走進酒館地下的俱樂部",
            "text": "地下室裡燈光昏暗，燻香混著酒氣。阿雅褪下頭巾，走進那群高大黝黑的水手中間，回頭看了你一眼——那一眼裡有羞恥、有興奮，也有一個問題。",
            "at": at_cell("soriel", "tavern"), "requires": need("aya_club_start"), "kind": "story",
            "success": {
                "text": "那一夜很長。天亮前，阿雅裹著一件不屬於她的外套回到你身邊，渾身發燙，靠在你肩上一字一句地把一切都告訴了你。「我還是我嗎？」她問。",
                "set_flags": ["aya_club_seen"],
            },
        },
        {
            "id": "raid", "title": "擋下突襲俱樂部的狂信騎士",
            "text": "就在這時，地下室的門被踹開——聖環被塗成黑色的狂信騎士來抓「墮落的修女」了。水手們抄起了酒瓶，阿雅躲到你身後。",
            "at": at_cell("soriel", "tavern"), "requires": need("aya_club_seen"), "kind": "combat",
            "enemies": [["zealot_templar", 2]],
            "success": {
                "text": "狂信騎士們被扔出了酒館的後門。俱樂部的老闆——一個缺了一顆門牙的東海老船長——朝你舉起酒杯：「從今天起，你是這裡的客人。」",
                "set_flags": ["aya_club_safe"],
            },
        },
        {
            "id": "answer", "title": "回答阿雅",
            "text": "天亮了，你們坐在港口的石階上。阿雅抱著膝蓋，等你的回答。",
            "at": at_npc(AYA), "requires": need("aya_club_safe"), "kind": "choice",
            "options": [
                {
                    "label": "妳還是妳，我要妳",
                    "success": {
                        "text": "阿雅哭著笑了，緊緊抱住你：「那我以後……每一次都回來告訴你。只告訴你。」俱樂部的老闆從此把她當成座上賓，地下室的門，也為你留了一把鑰匙。",
                        "set_flags": ["aya_club"],
                        "effects": [aff(AYA, 20, "接受了全部的她"), mem("接受了在「黑檀之夜」裡的阿雅。她每一次都回到你身邊，把一切告訴你。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "讓她自己決定要不要回來",
                    "success": {
                        "text": "阿雅想了很久：「我會回來的。不管去了哪裡，最後一定回到你身邊。」那之後，她每週有一個晚上不在禮拜堂——第二天早上，總是第一個來敲你的門。",
                        "set_flags": ["aya_club"],
                        "effects": [aff(AYA, 15, "讓她自己選擇"), mem("讓阿雅自己決定。她每週去一次「黑檀之夜」，第二天早上總是第一個來敲你的門。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(1800)],
}

BATCH3 = [doct1, doct2, doct3, snake1, snake2, snake3, aya1, aya2, aya3, aya3n]
