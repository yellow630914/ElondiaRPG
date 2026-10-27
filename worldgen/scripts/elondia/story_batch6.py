"""第六批特殊任務：阿爾貝納的商業戰爭、沿海渡口的沿海洞窟、卡蜜拉＆伊蓮娜（成人向・非處女）。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need

IGN, CON, MAT, SALO = 'npc_ignaz_goldscale', 'npc_constance_wagner', 'npc_matilda_rosen', 'npc_faceless_salo'
CAM, ELE, BER, HEL = 'npc_camilla', 'npc_elena', 'npc_bernard_lockwood', 'npc_helen_lighthouse'
ITEM = lambda name, qty=1: {"type": "item", "name": name, "qty": qty}
SIDE = {"where": "side", "side_map": "cave"}

# ---------------- 阿爾貝納：商業戰爭 ----------------
cw1 = {
    "id": "commerce_false_bandits",
    "title": "金秤商行的委託",
    "summary": "金秤商行的商隊在南方商路上接連被搶。伊格納茲議員說是盜匪；倖存的車夫說，盜匪拿的是傭兵團的制式長矛。（商業戰爭・一）",
    "rank": "D",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": IGN, "min_level": 5,
        "text": "伊格納茲議員笑瞇瞇地遞給你一杯茶：「我的商隊這個月被搶了三次。盜匪？哪來這麼多盜匪，又這麼剛好只搶我的車。」他的笑容沒變，眼睛卻冷了下來，「替我查查看，是誰在跟金秤商行過不去。錢不是問題。」",
    },
    "start_flags": ["cw_start"],
    "nodes": [
        {
            "id": "ambush", "title": "在阿爾貝納近郊的商路上埋伏盜匪",
            "text": "你們混在一支金秤商隊裡出城。走到一半，林子裡衝出一群蒙面人——他們的長矛整整齊齊，進退有序，喊的口令一點也不像盜匪。",
            "at": outskirts("albena"), "requires": need("cw_start"), "kind": "combat",
            "enemies": [["hired_raider", 3]],
            "success": {
                "text": "「盜匪」們倒下了。他們的長矛上烙著傭兵團的編號，懷裡還揣著一份勞務契約——契約的簽發人欄位被撕掉了，只剩下一角玫瑰色的封蠟。",
                "set_flags": ["cw_contract"],
            },
            "fail": {
                "text": "「盜匪」們搶走了兩輛車就撤了，撤得整整齊齊。你在路邊撿到一份被撕掉簽發人的勞務契約，上面還沾著一角玫瑰色的封蠟。",
                "set_flags": ["cw_contract"],
            },
        },
        {
            "id": "seal", "title": "到阿爾貝納的情報商查玫瑰色的封蠟",
            "text": "情報商用指甲刮了刮那一角封蠟：「玫瑰色的封蠟，整個聯邦只有一家在用。」他把契約推回給你，「你確定要知道？知道了，就得選邊站。」",
            "at": at_cell("albena", "informant"), "requires": need("cw_contract"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": {
                "text": "羅森商會——瑪蒂爾達議員的商會。傭兵團的雇傭合約都要經過她的手；她不用自己出錢，只要讓欠她人情的傭兵團「順路」去南方商路走一趟。",
                "set_flags": ["cw_rose"],
            },
            "fail": {
                "text": "情報商收了一大筆錢才開口：玫瑰色的封蠟，是瑪蒂爾達議員的羅森商會。",
                "set_flags": ["cw_rose"], "effects": [money(-100)],
            },
        },
        {
            "id": "report", "title": "決定要把真相告訴誰",
            "text": "你手上的契約能讓伊格納茲在議會上告瑪蒂爾達一狀，也能讓瑪蒂爾達付一大筆錢買回來。兩位議員都在貴族區，一個在等你回報，一個大概已經知道你在查她了。",
            "at": at_cell("albena", "guild"), "requires": need("cw_rose"), "kind": "choice",
            "options": [
                {
                    "label": "告訴伊格納茲",
                    "success": {
                        "text": "伊格納茲看完契約，笑得更燦爛了：「好孩子，好孩子。」第二天，羅森商會的三支傭兵團被議會暫停了執照。瑪蒂爾達在議會的走廊上和你擦身而過，什麼都沒說——只是笑了笑。",
                        "set_flags": ["cw_1_done", "cw_for_ignaz"],
                        "effects": [aff(IGN, 10, "查出搶他商隊的人"), aff(MAT, -5, "揭穿了她的手段"), money(200), mem("在阿爾貝納查出金秤商行的商隊是被瑪蒂爾達的傭兵假扮盜匪搶的，告訴了伊格納茲。")],
                        "complete": True,
                    },
                },
                {
                    "label": "把契約賣給瑪蒂爾達",
                    "success": {
                        "text": "瑪蒂爾達接過契約，連看都沒看就丟進了壁爐：「聰明人。」她付的錢比伊格納茲給的還多，「伊格納茲那邊，就說是南方的盜匪吧。他會信的——他一直以為我是個好擺布的小姑娘。」",
                        "set_flags": ["cw_1_done", "cw_for_matilda"],
                        "effects": [aff(MAT, 10, "把契約賣給她"), money(400), mem("在阿爾貝納查出瑪蒂爾達用傭兵假扮盜匪搶金秤商行的商隊，卻把證據賣給了她。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(250), xp(450)],
}

cw2 = {
    "id": "commerce_false_coin",
    "title": "風誓塔的假幣",
    "summary": "阿爾貝納的市面上出現了做工精良的假白鸛幣。掌管鑄幣的議會首席康斯坦絲，最討厭的就是有人破壞「公正誓約」。（商業戰爭・二）",
    "rank": "C",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": CON, "min_level": 8, "requires": need("cw_1_done"),
        "text": "風誓塔頂，議會首席康斯坦絲把一枚白鸛幣放在你的掌心：「重量對、成色對、連邊紋都對。」她又放了一枚，「這一枚也是——但這一枚，不是我鑄的。」她的聲音很平靜，「有人在挑戰『公正誓約』。替我找出來。」",
    },
    "start_flags": ["cw_coin"],
    "nodes": [
        {
            "id": "assay", "title": "到阿爾貝納的珠寶店化驗假幣",
            "text": "珠寶店的老師傅把假幣放進酸液裡，又用放大鏡看了很久：「銀是好銀，摻了一點點蛇溪洞窟才有的青鉛。鑄模是好鑄模——好到不像私人能做的。」",
            "at": at_cell("albena", "jeweler"), "requires": need("cw_coin"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": {
                "text": "老師傅指出了青鉛的來源：蛇溪洞窟淺層的舊走私營地。鑄模上還有一道很淡的刻痕——一個天秤的形狀。",
                "set_flags": ["cw_lead"],
            },
            "fail": {
                "text": "你只知道銀裡摻了蛇溪洞窟的青鉛。假幣的源頭，大概就在洞窟裡的舊走私營地。",
                "set_flags": ["cw_lead"],
            },
        },
        {
            "id": "mint", "title": "在蛇溪洞窟淺層找到假幣工坊",
            "text": "舊走私營地裡架著一座小小的熔爐，桌上擺著一排還沒冷卻的假幣。看守工坊的人穿著體面的外套，手上的劍卻是傭兵用的：「這裡沒什麼好看的。」",
            "at": at_dun("snake_creek", "shallow"), "requires": need("cw_lead"), "kind": "combat",
            "enemies": [["counterfeit_guard", 2]],
            "success": {
                "text": "看守們倒下了。熔爐旁的木箱裡有一副鑄模，模具底部刻著金秤商行的天秤；箱子底下還壓著一封沒有署名的信，信紙上有淡淡的蓮花香。",
                "set_flags": ["cw_mold"],
            },
            "fail": {
                "text": "看守們抱著帳本跑了，留下了熔爐與一副鑄模——模具底部刻著金秤商行的天秤。",
                "set_flags": ["cw_mold"],
            },
        },
        {
            "id": "tower", "title": "把鑄模帶回阿爾貝納的風誓塔",
            "text": "康斯坦絲看著模具底部的天秤，沉默了很久：「伊格納茲需要錢——他的商路被搶了一整個月。」她抬起頭看著你，「把鑄模交給議會，他會失去議席。你也可以把它交還給他，換一個人情。這是你找到的，你決定。」",
            "at": at_cell("albena", "lm_windoath_tower"), "requires": need("cw_mold"), "kind": "choice",
            "options": [
                {
                    "label": "交給議會首席",
                    "success": {
                        "text": "康斯坦絲在風誓塔頂當眾熔掉了鑄模。三天後，伊格納茲被議會停權，金秤商行的商路交給議會託管。瑪蒂爾達在議會上第一個舉手贊成，笑得很甜。",
                        "set_flags": ["cw_2_done", "cw_ignaz_down"],
                        "effects": [aff(CON, 10, "守住了公正誓約"), rep("aude_federation", 5), mem("在阿爾貝納查出假白鸛幣出自金秤商行的鑄模，交給了議會首席康斯坦絲，伊格納茲被停權。")],
                        "complete": True,
                    },
                },
                {
                    "label": "私下還給伊格納茲",
                    "success": {
                        "text": "伊格納茲接過鑄模，第一次沒有笑：「……謝謝。」他把模具丟進了河裡，「我欠你一次。還有——」他壓低聲音，「這副模具不是我的人做的。有人想讓我背這個鍋。」康斯坦絲沒有再問，只是在帳本上記了一筆。",
                        "set_flags": ["cw_2_done", "cw_ignaz_owes"],
                        "effects": [aff(IGN, 15, "替他掩蓋了假幣的事"), aff(CON, -5, "對她有所隱瞞"), mem("在阿爾貝納找到刻著金秤商行天秤的假幣鑄模，私下還給了伊格納茲。他說有人想讓他背鍋。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

cw3 = {
    "id": "commerce_council_vote",
    "title": "七議席的表決",
    "summary": "議會首席康斯坦絲提出「自由市場法」，要拆掉所有議員的壟斷。表決前夜，風誓塔遭到襲擊。（商業戰爭・三）",
    "rank": "B",
    "merit": 15,
    "start": {
        "kind": "guild", "location": "albena", "min_level": 11, "requires": need("cw_2_done"),
        "text": "公會收到議會首席的指名委託：她要在七議席議會上提出「自由市場法」，拆掉每一位議員手上的壟斷——包括她自己的鑄幣權。表決前夜，她需要一個不屬於任何商會的護衛。",
    },
    "start_flags": ["cw_vote"],
    "nodes": [
        {
            "id": "night", "title": "在阿爾貝納的風誓塔擋下夜襲的刺客",
            "text": "表決前夜，風誓塔的燈火被一陣風吹熄。黑暗裡，幾個沒有臉的人影翻過塔頂的欄杆——不是蒙面，是戴著光滑得像蛋殼的白色面具。",
            "at": at_cell("albena", "lm_windoath_tower"), "requires": need("cw_vote"), "kind": "combat",
            "enemies": [["faceless_blade", 3]],
            "success": {
                "text": "刺客們倒下了。其中一人的面具裂開，底下的臉你在自由集市見過——「無面」薩洛的手下。他的口袋裡有三份契約：伊格納茲付的、瑪蒂爾達付的，還有一份，是康斯坦絲自己的反對者付的。薩洛把同一筆生意賣了三次。",
                "set_flags": ["cw_salo"],
            },
            "fail": {
                "text": "你們被逼到了塔頂的邊緣，康斯坦絲卻一步也沒退。刺客們在衛兵趕到之前撤走了，留下一張契約：簽名欄是空的，只蓋著自由集市的印。",
                "set_flags": ["cw_salo"], "effects": [hp(-0.2)],
            },
        },
        {
            "id": "vote", "title": "在阿爾貝納的風誓塔見證七議席的表決",
            "text": "七張椅子圍著風誓塔頂的誓約石。康斯坦絲提出了自由市場法；伊格納茲搖頭，瑪蒂爾達笑而不語，其他議員看著彼此。三票對三票——最後一票，是一位遲遲沒有表態的老議員，他看向了你：「冒險者，你走過的市場比我們都多。你說呢？」",
            "at": at_cell("albena", "lm_windoath_tower"), "requires": need("cw_salo"), "kind": "choice",
            "options": [
                {
                    "label": "支持自由市場法",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "「壟斷養出來的，是薩洛這種一筆生意賣三次的人。」你說。老議員點了點頭，舉起了手。四比三——康斯坦絲在誓約石上刻下新的條款，然後親手交出了鑄幣權的印章。阿爾貝納的市場，第一次對所有人開放。",
                        "set_flags": ["cw_free_market"],
                        "effects": [rep("aude_federation", 10), aff(CON, 15, "支持她的自由市場法"), mem("在阿爾貝納的七議席議會上支持自由市場法，拆掉了議員們的壟斷。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你的話被伊格納茲的笑聲打斷。老議員猶豫了很久，最後投了棄權——三比三，法案擱置。康斯坦絲沒有生氣，只是把法案收進了誓約石下的暗格：「明年再來。」",
                        "set_flags": ["cw_free_market"],
                        "effects": [rep("aude_federation", 5), aff(CON, 5, "陪她走到了表決"), mem("在阿爾貝納的七議席議會上，自由市場法以三比三擱置，康斯坦絲說明年再來。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "支持瑪蒂爾達的對案",
                    "success": {
                        "text": "瑪蒂爾達的對案很簡單：壟斷照舊，只是金秤商行的商路「暫時」交給羅森商會管理。你替她說了話，老議員舉了手。散會時，瑪蒂爾達挽著你的手臂走下風誓塔：「你會發現，跟著我比跟著那個老銀行家有趣多了。」",
                        "set_flags": ["cw_matilda"],
                        "effects": [aff(MAT, 15, "在表決時站在她這邊"), aff(CON, -10, "否決了自由市場法"), money(1000), mem("在阿爾貝納的七議席議會上支持瑪蒂爾達，她接管了金秤商行的商路，成了議會最有權勢的人。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 沿海渡口：沿海洞窟 ----------------
cave1 = {
    "id": "seacave_low_tide",
    "title": "退潮的洞口",
    "summary": "渡口燈塔下的懸崖，退潮時會露出一個洞口。守燈塔的海倫婆婆說，三十年前那艘船，就是在那附近沉的。（沿海洞窟・一）",
    "rank": "D",
    "merit": 6,
    "start": {
        "kind": "npc", "npc": HEL, "min_level": 5,
        "text": "海倫婆婆把望遠鏡遞給你，指著懸崖底下：「看見那個洞口沒？一年只有幾天退潮退得那麼低。三十年前，我丈夫的北星號就沉在那附近。」她收回望遠鏡，聲音很平淡，「我老了，下不去了。你替我去看看。」",
    },
    "start_flags": ["cave_start"],
    "nodes": [
        {
            "id": "descend", "title": "從沿海渡口的燈塔下到退潮的洞口",
            "text": "你沿著海倫婆婆指的小路爬下懸崖。濕滑的岩石上長滿了藤壺，洞口在退潮的海水裡張著嘴，裡面傳出空洞的水聲。",
            "at": at_cell("coast_ferry", "lm_ferry_lighthouse"), "requires": need("cave_start"), "kind": "story",
            "success": {
                "text": "你點起火把，走進了洞裡。身後的潮水已經開始回漲——得在漲潮之前出來。",
                "set_flags": ["cave_in"], "side_map": "cave",
            },
        },
        {
            "id": "crabs", "title": "在海蝕洞裡擊退盤踞的巨螯蟹",
            "text": "洞穴深處擱淺著一艘斷成兩截的舊船，船身上的字還依稀可見：北星號。船殼裡盤踞著一隻巨螯蟹，蒼白的海靈幻象在船桅間飄來飄去。",
            "at": SIDE, "requires": need("cave_in"), "kind": "combat", "urgent": True,
            "enemies": [["giant_crab", 1], ["sea_phantom", 1]],
            "success": {
                "text": "巨螯蟹倒下了，海靈幻象散成了一陣冷霧。船長室的木箱裡，有一個生鏽的銅羅盤，指針還在微微地抖。",
                "set_flags": ["cave_compass"],
            },
            "fail": {
                "text": "你們被逼退到洞口，潮水已經漫到了膝蓋。撤退時，你的腳踢到了一個從船殼裡滾出來的東西——一個生鏽的銅羅盤。",
                "set_flags": ["cave_compass"],
            },
        },
        {
            "id": "compass", "title": "帶著北星號的羅盤離開海蝕洞",
            "text": "羅盤的背面刻著兩個名字，其中一個是「海倫」。潮水在洞口嘩嘩地響，該走了。",
            "at": SIDE, "requires": need("cave_compass"), "kind": "choice", "urgent": True,
            "options": [
                {
                    "label": "把羅盤帶回去給海倫婆婆",
                    "success": {
                        "text": "海倫婆婆接過羅盤，用拇指擦著背面的名字，擦了很久。「這個老頭子，」她說，「到最後還是找不到回家的路。」那天晚上，燈塔的燈比平常亮了一點。",
                        "set_flags": ["cave_1_done"],
                        "effects": [aff(HEL, 15, "帶回了丈夫的羅盤"), mem("在沿海渡口燈塔下的海蝕洞找到北星號的殘骸，把刻著海倫名字的羅盤帶回給她。")],
                        "complete": True,
                    },
                },
                {
                    "label": "把羅盤留在船長室",
                    "success": {
                        "text": "你把羅盤放回船長室，讓它繼續指著它想指的方向。回到燈塔，你告訴海倫婆婆船還在。她點點頭：「那就好。他在那裡，我在這裡，燈亮著，他就看得見。」",
                        "set_flags": ["cave_1_done"],
                        "effects": [aff(HEL, 10, "替她確認了丈夫的船")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(250), xp(450)],
}

cave2 = {
    "id": "seacave_siren",
    "title": "洞裡的歌聲",
    "summary": "漁夫們說，漲潮的夜裡，燈塔下的海蝕洞會傳出女人的歌聲。已經有兩艘小船循著歌聲划進去，再也沒有出來。（沿海洞窟・二）",
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": HEL, "min_level": 8, "requires": need("cave_1_done"),
        "text": "海倫婆婆把燈塔的窗戶關得緊緊的：「你聽見了嗎？」窗外，海浪聲裡夾著一縷若有若無的歌聲，「三十年前，北星號沉的那一晚，我也聽見過這首歌。」她轉過身，「它又回來了。這次，別讓它再帶走任何人。」",
    },
    "start_flags": ["cave_song"],
    "nodes": [
        {
            "id": "descend", "title": "在漲潮的夜裡從燈塔下到海蝕洞",
            "text": "你用蠟塞住了耳朵，划著小船循著歌聲往洞裡去。洞口比上次寬了，潮水把你推了進去。",
            "at": at_cell("coast_ferry", "lm_ferry_lighthouse"), "requires": need("cave_song"), "kind": "story",
            "success": {
                "text": "歌聲越來越近，蠟塞也擋不住了。洞穴深處的礁石上，坐著一個半人半魚的女人。",
                "set_flags": ["cave_in2"], "side_map": "cave",
            },
        },
        {
            "id": "siren", "title": "在海蝕洞裡擊敗潮汐女妖",
            "text": "潮汐女妖梳著長髮，歌聲讓人忘記呼吸。礁石底下，深淵的觸手在水裡蠕動，纏著兩艘小船的殘骸。",
            "at": SIDE, "requires": need("cave_in2"), "kind": "combat", "urgent": True,
            "enemies": [["tide_siren", 1], ["abyssal_tentacle", 1]],
            "success": {
                "text": "女妖的歌聲斷了，她沉進黑色的水裡，只留下一把貝殼梳。礁石後面，兩個被纏住的漁夫還活著，正虛弱地朝你揮手。",
                "set_flags": ["cave_quiet"],
            },
            "fail": {
                "text": "女妖的歌聲讓你們跪倒在水裡。千鈞一髮之際，燈塔的光從洞口掃進來——海倫婆婆把燈轉向了洞穴。女妖尖叫著沉進水底，礁石後面，兩個漁夫還活著。",
                "set_flags": ["cave_quiet"], "effects": [hp(-0.3)],
            },
        },
        {
            "id": "fishermen", "title": "帶著漁夫們離開海蝕洞",
            "text": "潮水在漲。兩個漁夫抱著你的腿哭，礁石上那把貝殼梳還閃著微光。",
            "at": SIDE, "requires": need("cave_quiet"), "kind": "choice", "urgent": True,
            "options": [
                {
                    "label": "先把漁夫們帶出去",
                    "success": {
                        "text": "你把兩個漁夫扛上小船，在潮水封住洞口之前划了出去。渡口的漁村辦了一場宴會，海倫婆婆難得地喝了兩杯。",
                        "set_flags": ["cave_2_done"],
                        "effects": [aff(HEL, 10, "讓歌聲再也帶不走人"), rep("dawn_kingdom", 3), mem("在沿海渡口燈塔下的海蝕洞擊敗了潮汐女妖，救出了兩個漁夫。")],
                        "complete": True,
                    },
                },
                {
                    "label": "撿起女妖的貝殼梳再走",
                    "success": {
                        "text": "你多花了一點時間撿起貝殼梳，潮水已經漫到了胸口，最後是兩個漁夫拚命划槳把你拖出去的。海倫婆婆看著那把梳子，說了一句：「別讓它唱歌。」",
                        "set_flags": ["cave_2_done"],
                        "effects": [ITEM("女妖的貝殼梳"), hp(-0.2), mem("在沿海渡口燈塔下的海蝕洞擊敗了潮汐女妖，救出了兩個漁夫，帶走了她的貝殼梳。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(500), xp(900)],
}

cave3 = {
    "id": "seacave_drowned_crew",
    "title": "沉船的水手們",
    "summary": "大潮的夜裡，海蝕洞最深處的海水退得一乾二淨，露出一條通往海底的路。北星號的水手們，還在那裡等著。（沿海洞窟・三）",
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": HEL, "min_level": 11, "requires": need("cave_2_done"),
        "text": "海倫婆婆攤開一張發黃的海圖：「大潮那一晚，海蝕洞最深處的水會退乾，露出一條往海底的路——我丈夫說過，那裡有一頭比船還大的東西，是牠把北星號拖下去的。」她把北星號的老水手名冊交給你，「他們還在那裡。讓他們回家吧。」",
    },
    "start_flags": ["cave_deep"],
    "nodes": [
        {
            "id": "descend", "title": "在大潮的夜裡從燈塔下到海蝕洞最深處",
            "text": "大潮的夜裡，海蝕洞最深處的海水真的退乾了，露出一條長滿海藻的斜坡，一路通往海底。斜坡兩旁站著一排排蒼白的人影——北星號的水手們。",
            "at": at_cell("coast_ferry", "lm_ferry_lighthouse"), "requires": need("cave_deep"), "kind": "story",
            "success": {
                "text": "水手們沒有攔你，只是默默地看著你往下走。斜坡盡頭的黑暗裡，有什麼巨大的東西在呼吸。",
                "set_flags": ["cave_in3"], "side_map": "cave",
            },
        },
        {
            "id": "leviathan", "title": "在海蝕洞最深處擊敗拖沉北星號的海獸",
            "text": "海底的洞窟裡，一頭深淵海獸的幼體盤著身子，鱗片上還掛著北星號的船帆碎片。牠身邊飄著一個比水手們更蒼白的身影——祖靈溺魂，守著被拖進海底的每一個人。",
            "at": SIDE, "requires": need("cave_in3"), "kind": "combat", "urgent": True,
            "enemies": [["abyssal_leviathan_spawn", 1], ["ancestral_drowner", 1]],
            "success": {
                "text": "海獸沉進了更深的黑暗，溺魂散成了一片泡沫。斜坡上的水手們同時轉過身來，朝你行了一個水手的禮。",
                "set_flags": ["cave_freed"],
            },
            "fail": {
                "text": "海獸的尾巴把你們掃上了斜坡。就在牠撲過來的時候，斜坡上的水手們一起擋在了你們前面——一群蒼白的影子，硬是把海獸推回了黑暗裡。溺魂散了，海獸再也沒有出來。",
                "set_flags": ["cave_freed"], "effects": [hp(-0.3)],
            },
        },
        {
            "id": "home", "title": "在海蝕洞最深處送北星號的水手們回家",
            "text": "水手們的身影越來越淡。最前面那個戴著船長帽的人走到你面前，指了指燈塔的方向，又指了指自己的胸口，然後看著你。潮水，開始回漲了。",
            "at": SIDE, "requires": need("cave_freed"), "kind": "choice", "urgent": True,
            "options": [
                {
                    "label": "念出名冊上的每一個名字",
                    "success": {
                        "text": "你一個一個念出名冊上的名字。每念一個，就有一個身影化成光，順著潮水往燈塔的方向漂去。念到最後一個——船長的名字——那個人影笑了，摘下帽子，朝燈塔的方向深深鞠了一躬。那天晚上，海倫婆婆說燈塔的燈自己閃了三下。",
                        "set_flags": ["cave_home"],
                        "effects": [aff(HEL, 20, "送她丈夫回家"), rep("dawn_kingdom", 5), mem("在沿海渡口燈塔下的海蝕洞最深處擊敗了拖沉北星號的海獸，念出名冊上的名字，送三十年前的水手們回家。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "帶船長的帽子回去給海倫婆婆",
                    "success": {
                        "text": "船長把帽子放在你手上，然後和水手們一起化成了光。海倫婆婆接過帽子，戴在自己的頭上，對著鏡子看了很久：「……太大了。他的頭一直比我大。」她笑著，眼淚掉了下來。",
                        "set_flags": ["cave_home"],
                        "effects": [aff(HEL, 20, "把丈夫的帽子帶回給她"), mem("在沿海渡口燈塔下的海蝕洞最深處送走了北星號的水手們，把船長的帽子帶回給海倫婆婆。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 卡蜜拉＆伊蓮娜：白濁魔導研究室 ----------------
wl1 = {
    "id": "lab_medium",
    "title": "研究室的媒介提供者",
    "summary": "無口的魔導師伊蓮娜面無表情地向你提出一個驚人的請求：當她們研究室的「媒介提供者」。（卡蜜拉＆伊蓮娜・一）",
    "tags": ["adult", "non_virgin"],
    "rank": "D",
    "merit": 5,
    "start": {
        "kind": "npc", "npc": ELE, "min_level": 5,
        "text": "伊蓮娜盯著你看了很久，面無表情地開口：「你。」又停了很久，「媒介。要。」她遞過來一張寫得密密麻麻的紙：卡蜜拉魔導研究室，誠徵穩定的媒介提供者，健康、體力好，待遇面議。紙的最下面畫著一個歪歪扭扭的愛心。",
    },
    "start_flags": ["wl_start"],
    "nodes": [
        {
            "id": "explain", "title": "聽伊蓮娜解釋「媒介」是什麼",
            "text": "伊蓮娜把你拉到巷子裡，用最少的字解釋了白濁魔導：以精液或愛液為媒介施法，效果驚人，媒介卻得「收集」。「平常。酒館地下。榮譽洞。」她在牆上比了一個圓圓的洞，「品質。不穩定。」她說完，眨了眨眼：「你。很適合。」",
            "at": at_npc(ELE), "requires": need("wl_start"), "kind": "choice",
            "options": [
                {
                    "label": "答應試試看",
                    "success": {
                        "text": "伊蓮娜點點頭，嘴角似乎動了一下：「今晚。研究室。」她轉身走了兩步，又回過頭來，「……謝謝。」",
                        "set_flags": ["wl_yes"], "effects": [aff(ELE, 10, "答應當媒介提供者")],
                    },
                },
                {
                    "label": "先去研究室看看再說",
                    "success": {
                        "text": "伊蓮娜想了想，點頭：「合理。」她牽起你的手就走，手心意外地熱。",
                        "set_flags": ["wl_yes"], "effects": [aff(ELE, 5, "願意去研究室看看")],
                    },
                },
            ],
        },
        {
            "id": "lab", "title": "到河畔的研究室見卡蜜拉",
            "text": "沒有招牌的研究室裡堆滿了書與空酒瓶。一個穿著皺巴巴法袍的女人趴在桌上睡覺，被伊蓮娜搖醒後，揉著眼睛看了你一眼，然後溫柔地笑了：「哎呀，是新的孩子。」她張開雙臂，「來，讓姊姊看看——伊蓮娜，妳終於找到人了？」",
            "at": at_npc(CAM), "requires": need("wl_yes"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": {
                "text": "那天晚上的「實驗」，比你想像的更……學術。伊蓮娜一邊面無表情地「收集」，一邊在筆記本上記數據；卡蜜拉在旁邊溫柔地指導，偶爾親自示範。最後，伊蓮娜用收集到的媒介點亮了一顆光球——亮得把整條河照成了白天。",
                "set_flags": ["wl_lit"], "effects": [aff(CAM, 10, "成了研究室的媒介提供者"), aff(ELE, 5, "實驗很成功")],
            },
            "fail": {
                "text": "那天晚上的「實驗」手忙腳亂：卡蜜拉喝多了，伊蓮娜的筆記本被打翻，光球亮了一下就炸了。卡蜜拉笑得在地上打滾：「沒關係沒關係，第一次都是這樣的。」",
                "set_flags": ["wl_lit"], "effects": [aff(CAM, 5, "成了研究室的媒介提供者")],
            },
        },
        {
            "id": "slime", "title": "在阿爾貝納近郊抓回逃走的魔力史萊姆",
            "text": "第二天一早，伊蓮娜衝進你的房間：「逃了。」昨晚的實驗殘留物在桶子裡凝成了史萊姆，連夜溜出了研究室，正在城外的田裡吃農夫的蘿蔔。",
            "at": outskirts("albena"), "requires": need("wl_lit"), "kind": "combat",
            "enemies": [["mana_slime", 2]],
            "success": {
                "text": "史萊姆被你們裝回了桶子裡。農夫拿著鋤頭追了你們半條路，伊蓮娜面無表情地賠了錢，回頭對你說：「下次。蓋子。蓋好。」她想了想，又補一句：「榮譽洞。地址。給你。」",
                "set_flags": ["wl_1_done"],
                "effects": [mem("成了卡蜜拉魔導研究室的「媒介提供者」，還幫忙抓回了實驗逃走的魔力史萊姆。伊蓮娜告訴你阿爾貝納酒館地下榮譽洞的地址。")],
                "complete": True,
            },
            "fail": {
                "text": "史萊姆把你們黏得動彈不得，最後是卡蜜拉晃晃悠悠地走過來，打了個酒嗝，一個火球就把牠們烤乾了。「孩子們，」她溫柔地說，「下次記得蓋蓋子。」伊蓮娜把一張紙條塞進你手裡，上面是阿爾貝納酒館地下榮譽洞的暗號。",
                "set_flags": ["wl_1_done"],
                "effects": [mem("成了卡蜜拉魔導研究室的「媒介提供者」，還被實驗逃走的史萊姆黏了一身。伊蓮娜告訴你阿爾貝納酒館地下榮譽洞的地址。")],
                "complete": True,
            },
        },
    ],
    "rewards": [money(200), xp(400)],
}

wl2 = {
    "id": "lab_sober",
    "title": "師父的酒",
    "summary": "伊蓮娜想讓師父戒酒、重回魔導師工會。卡蜜拉說她沒有酗酒，只是「比較喜歡喝」。（卡蜜拉＆伊蓮娜・二）",
    "tags": ["adult", "non_virgin"],
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": ELE, "min_affinity": 20, "min_level": 8, "requires": need("wl_1_done"),
        "text": "伊蓮娜把一份皺巴巴的公告放在你面前：魔導師工會的「特別研究員」審查，下個季度。「師父。應該去。」她停了很久，「可是。酒。」她的手指在公告上畫圈，「幫我。」",
    },
    "start_flags": ["wl_sober"],
    "nodes": [
        {
            "id": "talk", "title": "和卡蜜拉談戒酒的事",
            "text": "卡蜜拉抱著一瓶酒，溫柔地笑著：「戒酒？孩子，我沒有酗酒，我只是比較喜歡喝。」她拍拍身邊的位置，「來，坐，姊姊跟你說——當年工會的那群老頭子，是怎麼把我的論文丟進壁爐的。」",
            "at": at_npc(CAM), "requires": need("wl_sober"), "kind": "choice",
            "options": [
                {
                    "label": "陪她喝，聽她說完",
                    "success": {
                        "text": "她說了一整夜：被除名的那一天、被燒掉的論文、伊蓮娜被丟在研究室門口的那個雪夜。說到最後，她把酒瓶放下了：「……我喝酒，是因為我不想記得自己曾經很厲害。」",
                        "set_flags": ["wl_heard"], "effects": [aff(CAM, 10, "聽完她的故事")],
                    },
                },
                {
                    "label": "把酒瓶拿走",
                    "check": {"attr": "cha", "dc": 15},
                    "success": {
                        "text": "卡蜜拉愣了一下，沒有搶回去，只是嘆了口氣：「……你跟伊蓮娜一樣兇。」她把剩下的酒瓶一瓶一瓶交給你，「好啦好啦，聽你們的。」",
                        "set_flags": ["wl_heard"], "effects": [aff(CAM, 5, "替她把酒拿走")],
                    },
                    "fail": {
                        "text": "卡蜜拉抱著酒瓶縮進了被子裡，像個鬧脾氣的孩子。伊蓮娜在門口搖頭：「換個方法。」",
                        "set_flags": ["wl_heard"],
                    },
                },
            ],
        },
        {
            "id": "debt", "title": "在阿爾貝納近郊擋下來討酒債的人",
            "text": "研究室的門被踹開——卡蜜拉欠了一屁股酒債，酒商雇來的討債人找上門了。「沒錢？那就拿東西抵。」他們的眼睛盯著伊蓮娜，「這個看起來挺值錢的。」",
            "at": outskirts("albena"), "requires": need("wl_heard"), "kind": "combat",
            "enemies": [["debt_collector", 2]],
            "success": {
                "text": "討債人們被扔進了河裡。卡蜜拉站在門口，看著擋在伊蓮娜前面的你，酒醒了一大半：「……我差點讓他們把妳帶走。」她抱住了伊蓮娜，然後把你也拉進了懷裡。",
                "set_flags": ["wl_debt"],
            },
            "fail": {
                "text": "你們被打得狼狽，卡蜜拉卻在最後一刻清醒了，一道閃電把討債人們劈進了河裡。她看著自己的手，像是很久沒有見過它了：「……原來我還記得怎麼做。」",
                "set_flags": ["wl_debt"],
            },
        },
        {
            "id": "night", "title": "那天晚上的研究室",
            "text": "卡蜜拉把最後一瓶酒倒進了河裡。回到研究室，她難得清醒地坐在書桌前，翻開了十年沒碰的論文草稿。伊蓮娜靠在你身邊，小聲說：「謝謝。」然後，她看了看師父，又看了看你，「今晚。實驗。三個人。」",
            "at": at_npc(ELE), "requires": need("wl_debt"), "kind": "choice",
            "options": [
                {
                    "label": "留下來",
                    "success": {
                        "text": "那天晚上的實驗，是研究室有史以來最成功的一次。卡蜜拉清醒時溫柔得讓人融化，伊蓮娜面無表情地記著數據，記著記著，筆就掉了。天亮時，桌上多了一顆比上次更亮的光球，和一份寫了一半的論文。",
                        "set_flags": ["wl_2_done"],
                        "effects": [aff(CAM, 15, "陪她戒酒"), aff(ELE, 15, "陪她們度過那一夜"), mem("陪卡蜜拉戒了酒，擋下了討債人。那一夜，三個人在研究室裡做了最成功的一次實驗。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "讓她們師徒倆好好聊聊",
                    "success": {
                        "text": "你悄悄帶上了門。門後傳來卡蜜拉的笑聲與伊蓮娜難得的長句子。第二天，伊蓮娜在你的房門口放了一張紙條：「下次。三個人。說好了。」",
                        "set_flags": ["wl_2_done"],
                        "effects": [aff(CAM, 10, "陪她戒酒"), aff(ELE, 10, "讓她們師徒好好聊聊")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(900)],
}

wl3 = {
    "id": "lab_guild_return",
    "title": "重回魔導師工會",
    "summary": "魔導師工會的特別研究員審查。卡蜜拉要在當年燒掉她論文的人面前，證明白濁魔導是真正的魔導。（卡蜜拉＆伊蓮娜・三）",
    "tags": ["adult", "non_virgin"],
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": CAM, "min_affinity": 30, "min_level": 11, "requires": need("wl_2_done"),
        "text": "卡蜜拉穿著燙得筆挺的法袍——伊蓮娜燙的——站在研究室門口，緊張得一直扯袖子：「審查是明天。工會會長伯納德說，我得當場示範。」她深吸一口氣，然後溫柔地笑了，「孩子，明天……你也來吧。沒有你，我們的魔導是不完整的。」",
    },
    "start_flags": ["wl_exam"],
    "nodes": [
        {
            "id": "golems", "title": "在阿爾貝納近郊通過工會的試煉魔像",
            "text": "審查的第一關在城外的試煉場：兩座工會的試煉魔像，要用魔導打倒。伯納德會長舉著筆記本，興奮得像個孩子：「我改良過的！炸過三次！請務必全力以赴！」",
            "at": outskirts("albena"), "requires": need("wl_exam"), "kind": "combat",
            "enemies": [["guild_golem", 2]], "allies": [CAM, ELE],
            "success": {
                "text": "最後一座魔像在白光裡碎成了齒輪。伯納德會長看著卡蜜拉，張大了嘴：「這……這個魔力密度，我這輩子沒見過。」",
                "set_flags": ["wl_passed"],
            },
        },
        {
            "id": "paper", "title": "在魔導師工會的審查會上替卡蜜拉作證",
            "text": "審查會上，幾位老魔導師翻著卡蜜拉的論文，臉色從紅到白、從白到紅。其中一位當年燒掉她論文的老人冷笑：「媒介是什麼，大家心知肚明。這也配叫魔導？」伯納德會長看向你：「媒介提供者，你怎麼說？」",
            "at": at_npc(BER), "requires": need("wl_passed"), "kind": "check",
            "check": {"attr": "int", "dc": 17},
            "success": {
                "text": "你把伊蓮娜的實驗數據一頁一頁攤開：媒介的魔力密度、施法的效率、穩定性，每一項都比傳統魔導高出一截。老人們沉默了。伯納德會長用力拍桌：「通過！卡蜜拉，歡迎回來！」卡蜜拉哭著抱住了伊蓮娜，然後又把你也抱了進去。",
                "set_flags": ["wl_member"],
            },
            "fail": {
                "text": "你說得結結巴巴，但伊蓮娜站了起來，用她這輩子最長的一段話把數據講完了——足足三十個字。伯納德會長笑著拍桌：「通過！」老人們搖著頭，卻沒有一個人投反對票。",
                "set_flags": ["wl_member"],
            },
        },
        {
            "id": "home", "title": "回到研究室慶祝",
            "text": "研究室的門口掛上了一塊新招牌：「卡蜜拉魔導研究室——魔導師工會特別研究員」。卡蜜拉沒有喝酒，只泡了三杯茶。伊蓮娜坐在你的左邊，卡蜜拉坐在你的右邊，兩個人同時看著你。",
            "at": at_npc(CAM), "requires": need("wl_member"), "kind": "choice",
            "options": [
                {
                    "label": "「我是研究室的人了」",
                    "success": {
                        "text": "卡蜜拉溫柔地笑了，伊蓮娜的嘴角翹了起來——你第一次看見她笑。「那就說好了，」卡蜜拉說，「媒介提供者，是終身職。」那一夜的慶祝，一直持續到第二天中午。",
                        "set_flags": ["wl_lovers"],
                        "effects": [aff(CAM, 20, "成了研究室的一員"), aff(ELE, 20, "成了研究室的一員"), mem("卡蜜拉重回魔導師工會，成了特別研究員。你成了研究室的一員——卡蜜拉與伊蓮娜兩人的戀人。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "「我想和妳們一起去冒險」",
                    "success": {
                        "text": "卡蜜拉看了伊蓮娜一眼，伊蓮娜點頭：「實地。研究。需要。」卡蜜拉笑著站起來，把研究室的鑰匙掛在門上：「那就出發吧，孩子們。」",
                        "set_flags": ["wl_lovers"],
                        "effects": [aff(CAM, 20, "邀她們一起冒險"), aff(ELE, 20, "邀她們一起冒險"), {"type": "companion", "npc": CAM, "mode": "voluntary"}, mem("卡蜜拉重回魔導師工會，和伊蓮娜一起加入了你的隊伍——兩人都是你的戀人。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(500), xp(1800)],
}

BATCH6 = [cw1, cw2, cw3, cave1, cave2, cave3, wl1, wl2, wl3]
