"""第四批特殊任務：河谷鎮的四國角力、晨光城的英雄史詩歌、瑟蕾娜（成人向・非處女）。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need

OSW, GRE, KAS, SEAN, MIRA, SER, MAT = 'npc_oswin_bridge', 'npc_greta_silverscale', 'npc_kaspar_nord', 'npc_sean_minstrel', 'npc_mira', 'npc_serena', 'npc_matilda_rosen'
ITEM = lambda name, qty=1: {"type": "item", "name": name, "qty": qty}

# ---------------- 河谷鎮：四國角力 ----------------
rv1 = {
    "id": "rivervale_oath_stone",
    "title": "舊石橋的誓約石",
    "summary": "河谷鎮舊石橋上的誓約石——兩國使節立誓的見證——一夜之間被人砸碎了。（四國角力・一）",
    "rank": "D",
    "merit": 8,
    "start": {
        "kind": "guild", "location": "rivervale", "min_level": 5,
        "text": "公會的告示板上貼著守橋人奧斯溫的委託：舊石橋上的誓約石一夜之間被人砸碎了。晨曦王國與帝國的使節下週就要在橋上續簽河道協定，誓約石碎了，協定就簽不成。",
    },
    "start_flags": ["rv_start"],
    "nodes": [
        {
            "id": "bridge", "title": "到河谷鎮的舊石橋找守橋人奧斯溫",
            "text": "誓約石碎成了好幾塊，斷面上還留著鐵鎚的痕跡。奧斯溫蹲在碎石旁，手指撫過上面刻著的歷代誓詞：「兩百年來，帝國、王國、聯邦、教廷的使節都在這裡立過誓。砸碎它的人，想讓這條河再流一次血。」",
            "at": at_cell("rivervale", "lm_old_stone_bridge"), "requires": need("rv_start"), "kind": "story",
            "success": {
                "text": "奧斯溫在碎石縫裡撿到一枚小小的銀環——教廷信徒戴的那種。「昨晚有人在酒館裡說了很多關於『神聖邊界』的話。」",
                "set_flags": ["rv_ring"], "effects": [aff(OSW, 5, "答應查出砸碎誓約石的人")],
            },
        },
        {
            "id": "tavern", "title": "到河谷鎮的酒館打聽昨晚的事",
            "text": "酒館老闆一邊擦杯子一邊回想：昨晚有幾個穿黑衣的人喝到很晚，嘴裡一直說河對岸住著「不該被光照到的東西」。他們付錢時用的是索里耶爾的銀幣。",
            "at": at_cell("rivervale", "tavern"), "requires": need("rv_ring"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": {
                "text": "一個喝醉的客人插嘴：那幾個黑衣人今天一早就往城外的河灘去了，說是要「把剩下的也敲碎」——河灘上還立著幾塊舊的界碑。",
                "set_flags": ["rv_lead"],
            },
            "fail": {
                "text": "老闆不肯多說，只朝城外的方向努了努嘴：「河灘上還有幾塊舊界碑。」",
                "set_flags": ["rv_lead"],
            },
        },
        {
            "id": "shore", "title": "在河谷鎮近郊的河灘擋下黑衣人",
            "text": "河灘上，三個黑衣人正掄著鐵鎚砸一塊刻著兩國紋章的舊界碑。「這條河的兩岸只該有一種信仰。」其中一人轉過身，鐵鎚上還沾著石粉。",
            "at": outskirts("rivervale"), "requires": need("rv_lead"), "kind": "combat",
            "enemies": [["cloister_deacon", 3]],
            "success": {
                "text": "黑衣人倒在河灘上，懷裡揣著一封審判廷的密令：「使節協定若成，邊境的異端將無人制約。」",
                "set_flags": ["rv_order"],
            },
            "fail": {
                "text": "黑衣人們丟下鐵鎚逃過了河。他們落下的包袱裡，有一封審判廷的密令。",
                "set_flags": ["rv_order"],
            },
        },
        {
            "id": "report", "title": "把密令帶回河谷鎮的舊石橋",
            "text": "奧斯溫讀完密令，沉默了很久：「使節們明天就到。他們會問是誰砸了誓約石——你說的話，會決定他們回去怎麼跟自己的國王報告。」",
            "at": at_cell("rivervale", "lm_old_stone_bridge"), "requires": need("rv_order"), "kind": "choice",
            "options": [
                {
                    "label": "把審判廷的密令公開",
                    "success": {
                        "text": "使節們看完密令，在臨時刻好的新誓約石前續簽了協定。帝國的使節特別多停留了一天，向你道謝；索里耶爾的使節沒有出席簽約。河谷鎮暫時平靜了——但教廷不會忘記是誰揭穿了這件事。",
                        "set_flags": ["rv_1_done", "rv_exposed"],
                        "counters": {"human_stance": 1},
                        "effects": [aff(OSW, 10, "揭穿了砸碎誓約石的人"), rep("holy_ring", -3), mem("在河谷鎮揭穿了審判廷砸碎舊石橋誓約石的密令，兩國使節續簽了河道協定。")],
                        "complete": True,
                    },
                },
                {
                    "label": "說是魔族的奸細幹的",
                    "success": {
                        "text": "你把密令丟進了河裡，告訴使節們砸碎誓約石的是魔族的奸細。協定照樣續簽了，卻多了一條「共同防範魔族滲透」的條款。奧斯溫看著你，什麼都沒說。",
                        "set_flags": ["rv_1_done", "rv_blamed"],
                        "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 3), aff(OSW, -5, "對誓約撒了謊"), mem("在河谷鎮把審判廷砸碎誓約石的事推給了魔族，河道協定多了一條防範魔族的條款。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

rv2 = {
    "id": "rivervale_cellar",
    "title": "銀鱗旅店的地下室",
    "summary": "帝國的密探想在河谷鎮的銀鱗旅店安排一場秘密會談——對象是魔族的使者。教廷的人已經聞到了味道。（四國角力・二）",
    "rank": "C",
    "merit": 10,
    "start": {
        "kind": "informant", "location": "rivervale", "price": 300, "min_level": 8, "requires": need("rv_1_done"),
        "text": "情報商壓低聲音：「那個自稱布料商人的卡斯帕，其實是帝國宰相的眼睛。他在找人護送一位『客人』進城——一位頭上有角的客人。銀鱗旅店的地下室，以前也招待過這種客人。」",
    },
    "start_flags": ["rv_cellar"],
    "nodes": [
        {
            "id": "kaspar", "title": "在河谷鎮找帝國的密探卡斯帕",
            "text": "卡斯帕在布料攤後面量著一匹絲綢，頭也沒抬：「宰相想知道，魔族的停戰派是不是認真的。對方派了一位使者，今晚會在城外的渡口等。我需要一個不屬於任何國家的人去接她。」",
            "at": at_npc(KAS), "requires": need("rv_cellar"), "kind": "story",
            "success": {
                "text": "他把一枚刻著萊茵鷹徽的銅幣塞給你當信物：「她只認這個。小心教廷的審問官——他們在渡口附近轉了好幾天了。」",
                "set_flags": ["rv_token"], "effects": [aff(KAS, 5, "答應替帝國接人")],
            },
        },
        {
            "id": "ferry", "title": "在河谷鎮近郊的渡口護送魔族使者",
            "text": "渡口的霧裡站著一個披著斗篷的女子，斗篷下露出一截彎曲的角。她看見銅幣，剛要開口，兩名審判廷的審問官就從蘆葦叢裡走了出來：「異端的使者，和替異端帶路的人。」",
            "at": outskirts("rivervale"), "requires": need("rv_token"), "kind": "combat",
            "enemies": [["cloister_questioner", 2]],
            "success": {
                "text": "審問官們倒下了。魔族使者摘下兜帽，朝你行了一個人類的禮：「血羽城堡的莉莎爾大人，向你們的宰相問好。」",
                "set_flags": ["rv_envoy"],
            },
            "fail": {
                "text": "審問官們把你們逼退到河邊，使者一揮手，霧突然濃得伸手不見五指。等霧散了，審問官們已經不見人影，使者在你身邊喘著氣：「……我們快走吧。」",
                "set_flags": ["rv_envoy"],
            },
        },
        {
            "id": "cellar", "title": "到河谷鎮的銀鱗旅店決定會談的去留",
            "text": "銀鱗旅店的老闆娘格蕾塔掀開吧台後面的地板，露出通往地下室的樓梯：「我父親當年也在這裡招待過魔族使者。」她看著你，「但你要想清楚：這場會談如果被教廷知道，河谷鎮就再也不是中立的了。你也可以現在就把她交給教廷——他們會很感謝你。」",
            "at": at_cell("rivervale", "lm_silverscale_inn"), "requires": need("rv_envoy"), "kind": "choice",
            "options": [
                {
                    "label": "讓會談在地下室進行",
                    "success": {
                        "text": "地下室的燈亮了一整夜。天亮時，卡斯帕帶著一份蓋著血羽紋章的信函離開，魔族使者在渡口回頭看了你一眼。格蕾塔把樓梯蓋回去，像什麼都沒發生過。",
                        "set_flags": ["rv_2_done", "rv_talks"],
                        "counters": {"human_stance": 1, "demon_stance": 1},
                        "effects": [aff(GRE, 10, "守住了旅店的秘密"), aff(KAS, 10, "護送使者到會談"), mem("在河谷鎮的銀鱗旅店地下室，替帝國與魔族的停戰派安排了一場秘密會談。")],
                        "complete": True,
                    },
                },
                {
                    "label": "把魔族使者交給教廷",
                    "success": {
                        "text": "你把使者交給了索里耶爾的審問官。卡斯帕當晚就離開了河谷鎮，臨走前留下一句：「宰相會記得這件事的。」格蕾塔把地下室的門釘死了。血羽城堡那邊，有人開始說人類不可信。",
                        "set_flags": ["rv_2_done", "rv_betrayed"],
                        "counters": {"human_stance": -1, "demon_stance": -1},
                        "effects": [rep("holy_ring", 5), aff(KAS, -10, "把使者交給了教廷"), mem("在河谷鎮把魔族停戰派的使者交給了教廷的審問官。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

rv3 = {
    "id": "rivervale_summit",
    "title": "四國會談",
    "summary": "帝國、晨曦王國、奧德聯邦與聖環教廷的使節齊聚河谷鎮，商討河道、邊境與對魔族的停戰。有人不想讓這場會談開成。（四國角力・三）",
    "rank": "B",
    "merit": 15,
    "start": {
        "kind": "guild", "location": "rivervale", "min_level": 11, "requires": need("rv_2_done"),
        "text": "四國的使節齊聚河谷鎮，要在舊石橋上商討河道、邊境與對魔族的停戰。公會收到守橋人奧斯溫的指名委託：會談期間的護衛，以及一個不屬於任何國家的見證人。",
    },
    "start_flags": ["rv_summit"],
    "nodes": [
        {
            "id": "gate", "title": "在河谷鎮的城門擋下狂信的騎士",
            "text": "會談前夜，一隊黑環狂信騎士衝向城門，要「在異端與異端的協定簽下之前，把橋燒了」。",
            "at": at_cell("rivervale", "gate"), "requires": need("rv_summit"), "kind": "combat",
            "enemies": [["zealot_templar", 3]],
            "success": {
                "text": "狂信騎士們倒在城門下。天亮時，四國的旗幟在舊石橋上一字排開。",
                "set_flags": ["rv_held"],
            },
            "fail": {
                "text": "你們撐不住了，所幸鎮上的冒險者們聞聲趕來，把狂信騎士趕出了城。你帶著一身的傷走上了舊石橋。",
                "set_flags": ["rv_held"], "effects": [hp(-0.2)],
            },
        },
        {
            "id": "oath", "title": "在河谷鎮的舊石橋上見證四國的誓約",
            "text": "舊石橋上擺著四張椅子：帝國的使節沉穩，晨曦王國的使節熱切，聯邦的使節在算帳，教廷的使節一言不發。奧斯溫把新刻好的誓約石放在橋中央，轉向你：「見證人，你看見了什麼，就說什麼。」",
            "at": at_cell("rivervale", "lm_old_stone_bridge"), "requires": need("rv_held"), "kind": "choice",
            "options": [
                {
                    "label": "替停戰作證",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "你說了誓約石是誰砸的、城門的騎士是誰派的，也說了你在旅店地下室見過的魔族使者。帝國與聯邦先簽了字，晨曦王國的使節猶豫片刻也簽了。教廷的使節起身離席——三國的誓約，加上一張空著的椅子。",
                        "set_flags": ["rv_peace"], "counters": {"human_stance": 1},
                        "effects": [rep("human_alliance", 5), aff(OSW, 10, "在橋上替停戰作證"), mem("在河谷鎮的四國會談上作證，帝國、晨曦王國與奧德聯邦在舊石橋上立誓延續對魔族的停戰。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你的話說得零零落落，教廷的使節一句一句駁回。最後只有帝國與聯邦簽了字，晨曦王國的使節說要回去請示。誓約立下了，卻少了一半的分量。",
                        "set_flags": ["rv_peace"], "counters": {"human_stance": 1},
                        "effects": [rep("human_alliance", 3), mem("在河谷鎮的四國會談上替停戰作證，帝國與聯邦立下了誓約。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "替「神聖邊界」作證",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "「魔族不會遵守人類的誓約。」你說。教廷的使節第一次開了口，提出「神聖邊界」：河的南岸不許任何魔族踏足。晨曦王國與聯邦先後簽了字，帝國的使節沉默地簽在最後。奧斯溫在誓約石上刻下了新的條款，手一直在抖。",
                        "set_flags": ["rv_border"], "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 5), aff(OSW, -5, "讓橋上刻下了神聖邊界"), mem("在河谷鎮的四國會談上替教廷的「神聖邊界」作證，四國在舊石橋上立誓不許魔族踏足河的南岸。", 3)],
                        "complete": True,
                    },
                    "fail": {
                        "text": "你的話被帝國的使節反駁得啞口無言，但教廷的使節接過了話頭。「神聖邊界」最後以三比一寫進了誓約。",
                        "set_flags": ["rv_border"], "counters": {"human_stance": -1},
                        "effects": [rep("holy_ring", 3), mem("在河谷鎮的四國會談上，「神聖邊界」寫進了四國的誓約。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 晨光城：英雄史詩歌 ----------------
epic1 = {
    "id": "epic_bellringer",
    "title": "英雄史詩歌・第一章",
    "summary": "宮廷樂師席恩要寫一首能傳唱百年的英雄史詩，只缺一位真正的英雄。第一章的敵人：晨霧修道院的瘋狂敲鐘人。（英雄史詩歌・一）",
    "rank": "D",
    "merit": 6,
    "start": {
        "kind": "npc", "npc": SEAN, "min_level": 5,
        "text": "宮廷樂師席恩攔住你，魯特琴往背後一甩：「就是你！我要寫一首能傳唱百年的英雄史詩——不是那種街頭的小調，是真正的史詩！只缺一位真正的英雄，和一個配得上英雄的敵人。」他掰著手指，「第一章：晨霧修道院那個每天黎明敲破鐘的瘋子。你去打倒他，我在旁邊記下來。」",
    },
    "start_flags": ["epic_start"],
    "nodes": [
        {
            "id": "bell", "title": "在晨霧修道院淺層擊敗瘋狂的敲鐘人",
            "text": "鐘樓的階梯上，瘋狂的敲鐘人拖著鐵鎚轉過身來，破碎的晨鐘在他身後嗡嗡作響。席恩躲在柱子後面，筆已經舉起來了：「慢點打！我要記下每一招！」",
            "at": at_dun("mist_abbey", "shallow"), "requires": need("epic_start"), "kind": "combat",
            "enemies": [["mad_bellringer", 1], ["fallen_acolyte", 1]],
            "success": {
                "text": "敲鐘人倒在他的鐘下。席恩的筆在紙上飛舞：「『英雄一劍斬斷了百年的鐘聲』——不對，你明明是打了十七下。算了，史詩就是要誇張一點。」",
                "set_flags": ["epic_ch1"],
            },
            "fail": {
                "text": "你們被敲鐘人的鐵鎚逼下了鐘樓。席恩看著自己的筆記，若有所思：「『英雄在第一戰中敗退，卻在逆境中成長』——好，這樣更有戲劇性！」",
                "set_flags": ["epic_ch1"],
            },
        },
        {
            "id": "rival", "title": "在晨光城的酒館聽席恩試唱第一章",
            "text": "酒館裡，席恩站在桌上試唱史詩的第一章。唱到一半，角落傳來一聲嗤笑——街頭歌手米菈抱著豎琴：「斬斷百年的鐘聲？那個敲鐘人明明是被打了十七下才倒的，我在山下都聽見了。」",
            "at": at_cell("dawnlight", "tavern"), "requires": need("epic_ch1"), "kind": "choice",
            "options": [
                {
                    "label": "替席恩的誇張說話",
                    "success": {
                        "text": "「史詩就該讓人熱血沸騰。」你說。席恩感動得差點哭出來，米菈翻了個白眼走了。第一章在王都傳開了，你的名字跟著一起傳開——雖然有點太誇張。",
                        "set_flags": ["epic_1_done"],
                        "effects": [aff(SEAN, 10, "替他的史詩撐腰"), rep("dawn_kingdom", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "說米菈唱得比較對",
                    "success": {
                        "text": "「十七下是真的。」你說。席恩的臉漲得通紅，米菈卻笑了：「看吧，英雄本人都這麼說。」那天晚上，兩個冤家在酒館裡吵到打烊——第二天，席恩悄悄把歌詞改了。",
                        "set_flags": ["epic_1_done"],
                        "effects": [aff(MIRA, 10, "替她說了實話"), aff(SEAN, 5, "讓他的史詩更真實")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(250), xp(450)],
}

epic2 = {
    "id": "epic_undead_general",
    "title": "英雄史詩歌・第二章",
    "summary": "第二章需要一場決鬥：低語墓穴深層的亡靈將軍。米菈說她要寫自己的版本。（英雄史詩歌・二）",
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": SEAN, "min_level": 8, "requires": need("epic_1_done"),
        "text": "席恩把一疊寫滿塗改的稿紙拍在你面前：「第一章大受歡迎！第二章要更壯烈——低語墓穴的亡靈將軍，兩百年前統一戰爭的英雄，如今守著墓穴深處。英雄對英雄，這才叫史詩！」他壓低聲音，「還有，米菈說她也要寫一首，搶在我前面發表。絕對不能輸。」",
    },
    "start_flags": ["epic_ch2"],
    "nodes": [
        {
            "id": "general", "title": "在低語墓穴深層擊敗亡靈將軍",
            "text": "深層的大廳裡，亡靈將軍拄著佩劍站在石棺前，鏽蝕的鎧甲上還掛著帝國的勳章。骷髏騎士在他身邊列隊。席恩在門口小聲說：「記得喊一句帥氣的台詞！」",
            "at": at_dun("whisper_crypt", "deep"), "requires": need("epic_ch2"), "kind": "combat",
            "enemies": [["crypt_general", 1], ["skeleton_knight", 1]],
            "success": {
                "text": "亡靈將軍單膝跪地，佩劍從手裡滑落。席恩寫得手都在抖：「『兩位英雄跨越兩百年的交鋒』……這一章，我要寫三十段！」",
                "set_flags": ["epic_dueled"],
            },
            "fail": {
                "text": "你們被將軍逼退了。席恩卻一點也不沮喪：「英雄的第二次敗退！觀眾會為你揪心的！」他在筆記上畫了一個大大的星號。",
                "set_flags": ["epic_dueled"],
            },
        },
        {
            "id": "contest", "title": "在晨光城的酒館看席恩和米菈的對唱",
            "text": "酒館裡擠得水洩不通。席恩和米菈各站一張桌子，要用同一段故事——你打倒亡靈將軍的那一戰——一決高下。兩人同時看向你：「英雄本人來當評審！」",
            "at": at_cell("dawnlight", "tavern"), "requires": need("epic_dueled"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": {
                "text": "你說兩個人的版本合在一起才是完整的故事。席恩和米菈愣了一下，然後——不情不願地——站到同一張桌子上，唱了一首誰也沒寫完的二重唱。酒館的掌聲大得連王城都聽得見。",
                "set_flags": ["epic_2_done"],
                "effects": [aff(SEAN, 10, "讓他和米菈一起唱"), aff(MIRA, 10, "讓她和席恩一起唱")],
                "complete": True,
            },
            "fail": {
                "text": "你的評語讓兩個人都不滿意，他們乾脆吵了起來，吵著吵著就變成了對唱。觀眾以為是安排好的，掌聲比哪一首都熱烈。",
                "set_flags": ["epic_2_done"],
                "effects": [aff(SEAN, 5, "當了對唱的評審"), aff(MIRA, 5, "當了對唱的評審")],
                "complete": True,
            },
        },
    ],
    "rewards": [money(500), xp(900)],
}

epic3 = {
    "id": "epic_frost_giant",
    "title": "英雄史詩歌・終章",
    "summary": "史詩的終章需要一個傳說中的敵人：巨人之嵴上的冰霜巨人。首演定在晨光城的廣場。（英雄史詩歌・三）",
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": SEAN, "min_level": 11, "requires": need("epic_2_done"),
        "text": "席恩和米菈一起來找你——這本身就很稀奇。「終章，」席恩說，「要一個傳說中的敵人。」米菈接著說：「巨人之嵴的冰霜巨人，每走一步山都在震。」兩人同時伸出手：「首演定在晨光城的廣場。英雄，你來不來？」",
    },
    "start_flags": ["epic_ch3"],
    "nodes": [
        {
            "id": "giant", "title": "在巨人之嵴深層擊敗冰霜巨人",
            "text": "巨人之嵴的深處，冰霜巨人從冰壁裡站起來，頭頂幾乎碰到洞頂。他每吐一口氣，洞壁就結上一層白霜。席恩和米菈躲在冰柱後面，一個拿筆、一個拿琴，手都凍得發紫。",
            "at": at_dun("giants_spine", "deep"), "requires": need("epic_ch3"), "kind": "combat",
            "enemies": [["frost_giant", 1], ["storm_gargoyle", 1]],
            "success": {
                "text": "冰霜巨人轟然倒下，整座山都震了一下。米菈撥響了第一個和弦，席恩接著唱出第一句——終章，在巨人倒下的那一刻就寫好了。",
                "set_flags": ["epic_won"],
            },
        },
        {
            "id": "premiere", "title": "在晨光城的神殿前參加史詩的首演",
            "text": "日輪廣場的神殿前擠滿了人。席恩與米菈站在台階上，從第一章唱到終章——瘋狂的敲鐘人、亡靈將軍、冰霜巨人。唱到最後一段，兩人一起轉向台下的你。",
            "at": at_cell("dawnlight", "temple"), "requires": need("epic_won"), "kind": "choice",
            "options": [
                {
                    "label": "上台接受歡呼",
                    "success": {
                        "text": "你走上台階，整座廣場的人都在喊你的名字。那天之後，晨光城的孩子們玩打仗遊戲時，總要搶著扮演你。",
                        "set_flags": ["epic_sung"],
                        "effects": [rep("dawn_kingdom", 10), aff(SEAN, 10, "完成了他的史詩"), mem("宮廷樂師席恩與街頭歌手米菈合寫的英雄史詩在晨光城首演，唱的是你。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "把舞台讓給兩位歌手",
                    "success": {
                        "text": "你朝台上揮了揮手，沒有上去。席恩愣了一下，然後笑著把米菈拉到台中央：「那就請各位記住——這首歌，是兩個冤家一起寫的。」那天之後，晨光城最有名的不是那位英雄，而是一對吵吵鬧鬧的歌手。",
                        "set_flags": ["epic_sung"],
                        "effects": [rep("dawn_kingdom", 5), aff(SEAN, 15, "把舞台讓給了他們"), aff(MIRA, 15, "把舞台讓給了他們"), mem("英雄史詩在晨光城首演，你把舞台讓給了席恩與米菈。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(1200), xp(1800)],
}

# ---------------- 瑟蕾娜：金蓮樓的贖身 ----------------
ser1 = {
    "id": "serena_golden_lotus",
    "title": "金蓮樓的頭牌",
    "summary": "阿爾貝納金蓮樓的頭牌瑟蕾娜，一夜的價錢能買下一棟房子。她身上的契約還有十年。（瑟蕾娜・一）",
    "tags": ["adult", "non_virgin"],
    "rank": "D",
    "merit": 5,
    "start": {
        "kind": "npc", "npc": SER, "min_level": 5,
        "text": "金蓮樓最高的那層樓上，瑟蕾娜倚在欄杆邊，隔著薄紗看著你：「你看起來不像是來買一夜的人。」她的聲音很輕，帶著一點倦意，「上來坐坐吧。今晚的客人取消了——我想聽聽外面的事。」",
    },
    "start_flags": ["ser_start"],
    "nodes": [
        {
            "id": "night", "title": "在阿爾貝納的娼館陪瑟蕾娜度過一夜",
            "text": "她的房間裡燃著淡淡的蓮香，窗外是阿爾貝納的燈火。瑟蕾娜替你斟了一杯酒，薄紗從肩上滑落一半也不去管：「你想要什麼？大部分的人都知道自己想要什麼。」",
            "at": at_cell("albena", "brothel"), "requires": need("ser_start"), "kind": "choice",
            "options": [
                {
                    "label": "付下一夜的錢",
                    "success": {
                        "text": "那一夜，你明白了為什麼她的價錢能買下一棟房子。天快亮時，她枕在你胸口，忽然說：「你知道嗎，我從來沒看過海。」",
                        "set_flags": ["ser_sea"],
                        "effects": [money(-300), aff(SER, 10, "陪她度過一夜")],
                    },
                },
                {
                    "label": "只是陪她聊天",
                    "success": {
                        "text": "瑟蕾娜愣了一下，然後第一次真正地笑了。你們聊了一整夜：你走過的路、你見過的城市。說到沿海渡口的時候，她靜靜地聽完，小聲說：「我從來沒看過海。」",
                        "set_flags": ["ser_sea"],
                        "effects": [aff(SER, 15, "只是陪她聊天")],
                    },
                },
            ],
        },
        {
            "id": "contract", "title": "到阿爾貝納的情報商打聽瑟蕾娜的契約",
            "text": "情報商聽到「金蓮樓」三個字，吹了一聲口哨：「瑟蕾娜的契約？那是瑪蒂爾達議員手上的牌。贖身的價錢是天文數字——不過那位議員說過，價錢『可以商量』。」",
            "at": at_cell("albena", "informant"), "requires": need("ser_sea"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": {
                "text": "你查出了瑪蒂爾達想要的東西：她正和金秤商行的伊格納茲議員爭奪聯邦的陸路商路，缺一份能扳倒對方的證據。瑟蕾娜的契約，是她手上最漂亮的籌碼之一。",
                "set_flags": ["ser_lead"],
            },
            "fail": {
                "text": "情報商只肯透露一件事：瑪蒂爾達最近和金秤商行的伊格納茲鬥得很兇。「她缺的不是錢，是能打倒對手的東西。」",
                "set_flags": ["ser_lead"],
            },
        },
        {
            "id": "promise", "title": "回到金蓮樓告訴瑟蕾娜",
            "text": "瑟蕾娜聽你說完，把臉轉向窗外：「十年……我早就不去數了。」她回過頭看著你，眼睛有點紅，「你為什麼要替我做這些？」",
            "at": at_npc(SER), "requires": need("ser_lead"), "kind": "choice",
            "options": [
                {
                    "label": "「因為我想帶妳去看海」",
                    "success": {
                        "text": "瑟蕾娜沉默了很久，然後把一枚蓮花形的髮簪放在你手心：「那就說好了。在那之前，別讓我等太久。」",
                        "set_flags": ["ser_1_done"],
                        "effects": [aff(SER, 15, "答應帶她去看海"), mem("答應金蓮樓的頭牌瑟蕾娜，要替她贖身，帶她去看海。")],
                        "complete": True,
                    },
                },
                {
                    "label": "「因為妳值得自由」",
                    "success": {
                        "text": "「自由……」瑟蕾娜重複著這兩個字，像在嚐一種沒吃過的東西。「好。我等你。」",
                        "set_flags": ["ser_1_done"],
                        "effects": [aff(SER, 10, "說她值得自由")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(200), xp(400)],
}

ser2 = {
    "id": "serena_councillor",
    "title": "議員的條件",
    "summary": "握著瑟蕾娜契約的議員瑪蒂爾達開出了條件：替她拿到金秤商行的走私帳冊。（瑟蕾娜・二）",
    "tags": ["adult", "non_virgin"],
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": MAT, "min_level": 8, "requires": {"flags": ["ser_1_done"], "affinity": {SER: 20}},
        "text": "瑪蒂爾達議員在貴族區的茶室裡接見你，笑容甜得像糖：「你就是想替瑟蕾娜贖身的人？真浪漫。」她放下茶杯，「價錢可以商量——替我拿到金秤商行的走私帳冊。伊格納茲那隻老狐狸的商隊，每個月都從南方商路運一批不該運的東西。」",
    },
    "start_flags": ["ser_deal"],
    "nodes": [
        {
            "id": "caravan", "title": "在阿爾貝納近郊攔下金秤商行的商隊",
            "text": "南方商路上，一支掛著金秤旗的商隊停在路邊。押車的傭兵看見你們走近，按住了刀柄：「金秤商行的貨，閒人勿近。」最後一輛車的篷布底下，露出幾個打著魔族封蠟的箱子。",
            "at": outskirts("albena"), "requires": need("ser_deal"), "kind": "combat",
            "enemies": [["goldscale_mercenary", 2]],
            "success": {
                "text": "傭兵們倒下了。帳冊就藏在車夫座位底下：每一筆都記著從灰港鎮運來的魔族禁品，最後簽著伊格納茲的名字。",
                "set_flags": ["ser_ledger"],
            },
            "fail": {
                "text": "傭兵們把你們逼退，趕著車跑了——卻漏掉了一本從車夫座位底下滑出來的帳冊，上面簽著伊格納茲的名字。",
                "set_flags": ["ser_ledger"],
            },
        },
        {
            "id": "bargain", "title": "把帳冊帶去給瑪蒂爾達議員",
            "text": "瑪蒂爾達翻著帳冊，笑意一點一點加深：「完美。伊格納茲這下要在議會上跪著說話了。」她合上帳冊，看著你，「那麼，我們來談談瑟蕾娜的價錢吧。」",
            "at": at_npc(MAT), "requires": need("ser_ledger"), "kind": "choice",
            "options": [
                {
                    "label": "照她開的價",
                    "success": {
                        "text": "瑪蒂爾達在契約上劃掉一個零：「一千五百白鸛。這是我能給的最好的價錢——對你，也對瑟蕾娜。」她把契約的副本推給你，「錢準備好了就來找我。別讓那孩子等太久。」",
                        "set_flags": ["ser_2_done", "ser_price"],
                        "effects": [aff(MAT, 10, "替她扳倒了伊格納茲"), mem("替瑪蒂爾達議員拿到了金秤商行的走私帳冊，她把瑟蕾娜的贖身價降到一千五百白鸛。")],
                        "complete": True,
                    },
                },
                {
                    "label": "拿帳冊壓價",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "「帳冊也可以送去伊格納茲那裡。」你說。瑪蒂爾達的笑容凝住了一瞬，然後笑得更甜了：「你比我想的有意思。」她在契約上劃掉了兩個零——還親手寫了一張「免贖」的字據，條件是你欠她一次人情。",
                        "set_flags": ["ser_2_done", "ser_free_deal"],
                        "effects": [aff(MAT, 5, "讓她刮目相看"), mem("拿金秤商行的帳冊和瑪蒂爾達議員討價還價，換到了瑟蕾娜的免贖字據——還欠她一次人情。")],
                        "complete": True,
                    },
                    "fail": {
                        "text": "瑪蒂爾達輕輕笑了一聲：「威脅我？你還太嫩了。」但她還是在契約上劃掉了一個零：「一千五百白鸛，看在帳冊的份上。」",
                        "set_flags": ["ser_2_done", "ser_price"],
                        "effects": [aff(MAT, -5, "想威脅她")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(400), xp(900)],
}

ser3 = {
    "id": "serena_sea",
    "title": "去看海",
    "summary": "贖身的日子到了。金蓮樓的老闆可不打算讓頭牌就這樣走掉。（瑟蕾娜・三）",
    "tags": ["adult", "non_virgin"],
    "rank": "B",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": SER, "min_level": 11, "min_affinity": 30, "requires": need("ser_2_done"),
        "text": "瑟蕾娜把蓮花髮簪插回頭上，換了一件素色的衣裳——不是金蓮樓的衣裳。「今天，」她說，聲音在發抖，「我想走出這扇門。」",
    },
    "start_flags": ["ser_day"],
    "nodes": [
        {
            "id": "ransom", "title": "在阿爾貝納的娼館替瑟蕾娜贖身",
            "text": "金蓮樓的老闆坐在帳房裡，看著瑪蒂爾達簽過字的契約，臉色鐵青：「頭牌走了，我的樓還開不開？」",
            "at": at_cell("albena", "brothel"), "requires": need("ser_day"), "kind": "choice",
            "options": [
                {
                    "label": "付清一千五百白鸛",
                    "requires": need("ser_price"),
                    "success": {
                        "text": "你把錢袋一袋一袋擺上帳房的桌子。老闆數了三遍，最後在契約上蓋了章。瑟蕾娜站在門口，看著那張紙，好像不敢相信那是真的。",
                        "set_flags": ["ser_paid"], "join": SER,
                        "effects": [money(-1500)],
                    },
                },
                {
                    "label": "拿出瑪蒂爾達的免贖字據",
                    "requires": need("ser_free_deal"),
                    "success": {
                        "text": "老闆看見字據上瑪蒂爾達的簽名，手抖了一下，一句話也沒說就蓋了章。瑟蕾娜站在門口，看著那張紙，好像不敢相信那是真的。",
                        "set_flags": ["ser_paid"], "join": SER,
                    },
                },
            ],
        },
        {
            "id": "gate", "title": "在阿爾貝納的城門甩掉金蓮樓的打手",
            "text": "你們剛走到城門，金蓮樓的打手就追上來了。老闆收了錢，卻捨不得頭牌：「契約是契約，可路上出了什麼意外，就怪不得誰了。」",
            "at": at_cell("albena", "gate"), "requires": need("ser_paid"), "kind": "combat",
            "enemies": [["lotus_bouncer", 3]],
            "success": {
                "text": "打手們倒在城門下。瑟蕾娜緊緊握著你的手，一次也沒有回頭。",
                "set_flags": ["ser_out"],
            },
        },
        {
            "id": "sea", "title": "帶瑟蕾娜到沿海渡口的燈塔看海",
            "text": "沿海渡口的燈塔上，海風吹亂了她的頭髮。瑟蕾娜扶著欄杆，看著一望無際的海面，很久都沒有說話。然後她轉過身來：「謝謝你。接下來……你希望我怎麼做？」",
            "at": at_cell("coast_ferry", "lm_ferry_lighthouse"), "requires": need("ser_out"), "kind": "choice",
            "options": [
                {
                    "label": "「留在我身邊」",
                    "success": {
                        "text": "瑟蕾娜笑了，那是你見過最好看的笑——不是金蓮樓的頭牌，只是一個看見了海的女人。那天晚上，燈塔下的小旅店裡，她第一次不是為了誰的錢，而是為了自己，把身體交給了你。",
                        "set_flags": ["ser_free", "ser_lover"], "leave": SER,
                        "effects": [aff(SER, 20, "帶她看了海"), mem("替瑟蕾娜贖了身，帶她在沿海渡口的燈塔上看了海。她留在你身邊，成了你的戀人。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "「去過妳想過的日子」",
                    "success": {
                        "text": "瑟蕾娜想了很久，最後決定留在沿海渡口，在燈塔下開一間小小的茶館。「你要常來。」她把蓮花髮簪插在你的衣襟上，「茶永遠是免費的——其他的，也是。」",
                        "set_flags": ["ser_free", "ser_lover"], "leave": SER,
                        "effects": [aff(SER, 20, "讓她選擇自己的日子"), mem("替瑟蕾娜贖了身，帶她看了海。她在沿海渡口的燈塔下開了一間茶館，等你常去。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [money(500), xp(1800)],
}

BATCH4 = [rv1, rv2, rv3, epic1, epic2, epic3, ser1, ser2, ser3]
