"""第十批特殊任務（6 條）：灰港鎮的最好的時代；北境群山的龍的寶藏、傳說的礦石、灌醉對方的酒、魔導與傳統鍛造之爭；古樹森林的世界樹的衰退。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need
from story_batch7 import done, step

VESPA, HAGEN, SEB, NICK = 'npc_vespa', 'npc_captain_hagen', 'npc_sebastian_eger', 'npc_nick_halfdemon'
IRONROOT, LIV, ANYA, HALD = 'npc_old_ironroot', 'npc_liv_hunter', 'npc_anya_sled', 'npc_hald_greyrock'
MAGDA, OWEN, DILIA, BALIN, HELGA, SER = 'npc_magda_ironforge', 'npc_owen_copperbeard', 'npc_dilia_copperbeard', 'npc_balin_greyrock', 'npc_helga_malt', 'npc_ser_mistone'
LIAN, EVENNA, SYLVIE, KAL, OCT, FENN = 'npc_liandra_spring', 'npc_evenna_starword', 'npc_sylvie', 'npc_kalanthil', 'npc_octavia_mossvoice', 'npc_fenn_apprentice'
DEMON, DWARF, ELF = 'demon_council', 'dwarf_clans', 'elf_court'
BLESSED = {"type": "condition", "target": "pc", "condition": "blessed", "add": True}

# ---------------- 灰港鎮：最好的時代 ----------------
era1 = {
    "id": "era_crystal_price",
    "title": "血晶石的價格",
    "summary": "灰港鎮的船都用血晶石當動力。這個月，血晶石的價錢漲了三倍——有人在收購每一顆。（最好的時代・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "guild", "location": "ashport", "min_level": 5,
        "text": "公會的告示板上擠滿了跟血晶石有關的委託：護送礦車、找失蹤的礦工、趕走礦坑裡的蟲。最上面一張的字跡很漂亮：「收購血晶石，有多少要多少，價錢好談。這是最好的時代。」沒有署名。",
    },
    "start_flags": ["era_start"],
    "nodes": [
        {
            "id": "rumor", "title": "到灰港鎮的情報商打聽收購血晶石的人",
            "text": "情報商是個戴著單片眼鏡的半魔，正在把一疊收據排成扇形：「收購的人？一個自稱『掮客』的人類。他替兩邊的軍港收貨——帝國的、血角的，都收。」他推了推眼鏡，「戰爭還沒開打，可是軍火商已經開始過節了。」",
            "at": at_cell("ashport", "informant"), "requires": need("era_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你從收據上看出來：掮客收的血晶石，一半送往萊茵堡的船塢，一半送往熔火堡壘外的血角營地。礦坑那邊，最近有礦工失蹤。", ["era_rumor"]),
            "fail": step("情報商收了你一筆錢才肯多說：掮客替兩邊都收貨。礦坑那邊，最近有礦工失蹤。", ["era_rumor"], [money(-80)]),
        },
        {
            "id": "mine", "title": "在灰港鎮近郊的血晶礦坑救出礦工",
            "text": "礦坑裡的血晶石脈閃著暗紅的光。為了趕工，礦工們挖得太深，挖醒了一窩吃血晶石長大的蟲。幾個礦工被困在坑道盡頭，蟲在坑道裡爬來爬去。",
            "at": outskirts("ashport"), "requires": need("era_rumor"), "kind": "combat",
            "enemies": [["bloodcrystal_worm", 3]],
            "success": step("血晶蟲縮回了石縫。礦工們爬出坑道，滿臉都是紅色的礦粉。帶頭的老礦工說：「掮客出三倍的價錢，卻不管我們死活。」", ["era_mine"]),
            "fail": step("血晶蟲把你們逼出了坑道，可礦工們趁亂從另一條通風口爬了出來。帶頭的老礦工說：「掮客出三倍的價錢，卻不管我們死活。」", ["era_mine"], [hp(-0.1)]),
        },
        {
            "id": "sell", "title": "決定礦坑這一季的血晶石賣給誰",
            "text": "礦工們把這一季的血晶石堆在你面前：「你救了我們，你說了算。賣給掮客，價錢是平常的三倍；賣給灰港鎮的漁船和點燈人，只有平常的價錢。」",
            "at": outskirts("ashport"), "requires": need("era_mine"), "kind": "choice",
            "options": [
                {"label": "賣給灰港鎮的漁船和點燈人", "success": done("礦工們少賺了很多錢，卻沒有一個人抱怨。那天晚上，灰港鎮的燈火比平常亮了一點。", ["era_1_done", "era_local"], [mem("在灰港鎮的血晶礦坑救出了礦工，把這一季的血晶石賣給了漁船和點燈人，沒有賣給軍火掮客。")], counters={"demon_stance": 1})},
                {"label": "賣給掮客", "success": done("掮客的人來得很快，付錢也很爽快。礦工們分到了三倍的錢，你也分到了一份。掮客的手下臨走時說：「這是最好的時代，朋友。」", ["era_1_done", "era_broker"], [money(200), mem("在灰港鎮的血晶礦坑救出了礦工，把血晶石賣給了替兩邊軍港收貨的掮客。")], counters={"demon_stance": -1})},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

era2 = {
    "id": "era_two_orders",
    "title": "兩邊的訂單",
    "summary": "掮客在深淵交易所同時簽下了兩份造船訂單：一份給帝國，一份給血角。兩邊都在造同一種船——用血晶石推動的戰艦。（最好的時代・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": VESPA, "min_level": 8, "requires": need("era_1_done"),
        "text": "維斯帕把兩份契約並排攤在桌上，指甲輕輕敲著：「同一個掮客，同一種船，兩個買家——彼此要打仗的兩個買家。」她笑了笑，「契約在我這裡簽，我就得守。可是貨艙裡裝的是什麼，我有權知道。替我去碼頭看看。」",
    },
    "start_flags": ["era_orders"],
    "nodes": [
        {
            "id": "pier", "title": "在灰港鎮的灰帆碼頭檢查掮客的貨船",
            "text": "灰帆碼頭的盡頭停著兩艘一模一樣的黑船，一艘掛帝國的鷹旗，一艘掛血角的骨旗。哈根船長叼著菸斗：「我在海上二十年，沒見過一個船塢同時給兩邊造船。」",
            "at": at_cell("ashport", "lm_greysail_pier"), "requires": need("era_orders"), "kind": "check",
            "check": {"attr": "dex", "dc": 15},
            "success": step("你溜進了貨艙：成箱的血晶石炮彈，兩艘船裝的一模一樣。箱子上蓋著同一個印記——掮客替兩邊都準備好了打仗要用的東西。", ["era_cargo"], [aff(HAGEN, 5, "陪他看了一場怪事")]),
            "fail": step("你被巡邏的水手發現了，只來得及看到一眼：成箱的血晶石炮彈。哈根船長把你拉上了他的小艇：「看到了吧？兩艘船，一樣的貨。」", ["era_cargo"], [hp(-0.1)]),
        },
        {
            "id": "guards", "title": "在灰港鎮近郊擋下掮客的保鑣",
            "text": "回程的荒原路上，幾個穿著體面外套的保鑣攔住了你：「掮客先生請你喝一杯。」他們的手按在刀柄上，「或者，你可以把看到的東西忘掉。」",
            "at": outskirts("ashport"), "requires": need("era_cargo"), "kind": "combat",
            "enemies": [["arms_runner", 2]],
            "success": step("保鑣們倒下了。其中一個的懷裡掉出一張名片：「掮客——最好的時代，最好的價錢。」背面寫著兩個交貨日期，只差三天。", ["era_proof"]),
            "fail": step("保鑣們把你們打退了，卻在灰港鎮的半魔傭兵趕來時逃走，丟下一張名片：「掮客——最好的時代，最好的價錢。」背面寫著兩個交貨日期。", ["era_proof"], [hp(-0.15)]),
        },
        {
            "id": "report", "title": "回報維斯帕",
            "text": "維斯帕看完名片，很久沒有說話：「兩艘船的交貨日期只差三天。三天後，帝國和血角都會有一艘血晶戰艦。」她看著你，「我的規矩是不毀契約。但我可以決定誰先知道這件事。」",
            "at": at_npc(VESPA), "requires": need("era_proof"), "kind": "choice",
            "options": [
                {"label": "讓兩邊的和平派都知道", "success": done("維斯帕寫了兩封信，一封給萊茵堡的布倫希爾德，一封給血羽城堡的薇洛妮卡。三天後，兩艘戰艦都出港了——但兩邊的議會都在吵，為什麼對方也有一艘。", ["era_2_done", "era_warned"], [aff(VESPA, 10, "替她做了選擇"), mem("在灰港鎮發現軍火掮客同時替帝國與血角造血晶戰艦，讓兩邊的和平派都知道了。")], counters={"human_stance": 1})},
                {"label": "什麼都不說，照契約交貨", "success": done("維斯帕點了點頭：「生意就是生意。」三天後，兩艘血晶戰艦一前一後地離開了灰港鎮，朝兩個相反的方向。", ["era_2_done", "era_silent"], [aff(VESPA, 5, "守了交易所的規矩"), money(300), mem("在灰港鎮發現軍火掮客同時替帝國與血角造戰艦，選擇照契約交貨。")], counters={"human_stance": -1})},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

era3 = {
    "id": "era_best_of_times",
    "title": "最好的時代",
    "summary": "掮客要在深淵交易所拍賣最後一件貨：血晶戰艦的原型船「灰燼號」。帝國、血角、教廷都派了人來。誰買到它，誰就能先開第一炮。（最好的時代・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": VESPA, "min_level": 11, "requires": need("era_2_done"),
        "text": "維斯帕第一次沒有替你倒酒：「掮客要在我的交易所拍賣『灰燼號』。三方的買家都到了，港外還停著一支傭兵艦隊——掮客請來的，誰出不起價，就讓誰買不成。」她看著你，「我會讓你坐在拍賣台上。最後一槌，你來敲。」",
    },
    "start_flags": ["era_auction"],
    "nodes": [
        {
            "id": "corsairs", "title": "在灰港鎮的灰帆碼頭擋下血晶艦的傭兵",
            "text": "拍賣開始前，港外的傭兵艦隊放下了小艇。一群披著紅色鎖甲的傭兵跳上了灰帆碼頭：「掮客說了，拍賣會上不需要多餘的人。」",
            "at": at_cell("ashport", "lm_greysail_pier"), "requires": need("era_auction"), "kind": "combat",
            "enemies": [["crystal_corsair", 3]],
            "success": step("傭兵們退回了小艇。碼頭上，哈根船長舉著一根船槳大笑：「二十年了，總算有人在灰帆碼頭打了一場像樣的架！」", ["era_pier"]),
            "fail": step("傭兵們把你們逼到了碼頭盡頭，維斯帕的半魔守衛及時趕到。傭兵們退回了海上——拍賣會還是要開。", ["era_pier"], [hp(-0.2)]),
        },
        {
            "id": "broker", "title": "在深淵交易所揭穿掮客的底牌",
            "text": "拍賣台上，掮客穿著一身白西裝，笑容和他的名片一樣：「各位，這是最好的時代——誰都買得起戰爭。」帝國的使者、血角的勇士、教廷的神父坐在三個角落，誰也不看誰。",
            "at": at_cell("ashport", "lm_abyss_exchange"), "requires": need("era_pier"), "kind": "check",
            "check": {"attr": "cha", "dc": 17},
            "success": step("你在三方面前攤開了兩份造船契約與炮彈的貨單：掮客早就把同樣的東西賣給了每一個人。三方的買家同時轉過頭，看著拍賣台上的白西裝。掮客的笑容第一次僵住了。", ["era_exposed"]),
            "fail": step("你的話被掮客笑著打斷了：「證據呢，朋友？」可維斯帕替你把兩份契約放上了拍賣台。三方的買家同時轉過頭，看著那身白西裝。", ["era_exposed"]),
        },
        {
            "id": "hammer", "title": "敲下最後一槌",
            "text": "拍賣台上只剩下你、維斯帕，和那艘停在港裡的灰燼號。維斯帕把木槌遞給你：「契約說，灰燼號要賣出去。但沒說賣給誰——也沒說要賣成戰艦。」",
            "at": at_npc(VESPA), "requires": need("era_exposed"), "kind": "choice",
            "options": [
                {"label": "把灰燼號改成救難船，賣給灰港鎮", "success": done("你敲下木槌：「灰港鎮，一枚銅幣。」全場愣住了，然後維斯帕笑了：「成交。」灰燼號拆下了炮，裝上了救生艇，成了荒原海岸第一艘救難船。掮客被三方的買家一起請出了灰港鎮。", ["era_done", "era_rescue"], [aff(VESPA, 20, "讓她的交易所做了一筆好生意"), aff(HAGEN, 15, "灰港鎮有了救難船"), rep(DEMON, 10), mem("在灰港鎮的深淵交易所敲下最後一槌，把血晶戰艦的原型船灰燼號改成了救難船。", 3)], counters={"human_stance": 1, "demon_stance": 1})},
                {"label": "賣給出價最高的人", "success": done("你敲下木槌，灰燼號賣給了教廷，價錢高得讓全場安靜。你分到了一大筆佣金。三個月後，灰燼號出現在聖戰艦隊的最前方。掮客說得對：這是最好的時代——對他、對你。", ["era_done", "era_warship"], [aff(VESPA, -10, "讓她的交易所賣出了戰爭"), money(1000), mem("在灰港鎮的深淵交易所，把血晶戰艦的原型船灰燼號賣給了教廷。", 3)], counters={"human_stance": -1, "demon_stance": -1})},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 北境群山：龍的寶藏 ----------------
kag1 = {
    "id": "kagni_hammer_tone",
    "title": "變了調的風錘",
    "summary": "風錘村口的巨錘，山風吹過時一向發出低沉的鳴響。這個冬天它變了調——一半像沸水，一半像什麼聲音都沒有。（龍的寶藏・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": IRONROOT, "min_level": 5,
        "text": "老鐵根灌了一大口酒，指著村口的巨錘：「聽。」風吹過錘身的孔洞，一半的孔發出嘶嘶的沸騰聲，另一半什麼聲音也沒有，像被掐住了喉嚨。「山在警告什麼。」他把酒壺遞給你，「我老了，爬不動了。年輕人，替我上山看看。」",
    },
    "start_flags": ["kag_start"],
    "nodes": [
        {
            "id": "hammer", "title": "在風錘村的風錘旁聽山的聲音",
            "text": "你把耳朵貼在冰冷的錘身上。沸騰聲從東邊的山坡傳來，寂靜從西邊。一個背著弓的年輕女獵人在旁邊探頭探腦：「我是莉芙！你是冒險者對不對？東邊的雪在冬天融化了，西邊的瀑布結成了冰，連水聲都沒有——我帶你去！」",
            "at": at_cell("windhammer", "lm_wind_hammer"), "requires": need("kag_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你聽出來了：沸騰聲和寂靜聲是同一個節奏，像一頭巨獸在呼吸——吸氣時萬物沸騰，吐氣時萬物靜止。", ["kag_heard"], [aff(LIV, 5, "讓她帶路")]),
            "fail": step("你什麼也聽不出來，只覺得耳朵一邊發燙一邊發冷。莉芙拉著你的袖子：「別聽了，去看比較快！」", ["kag_heard"]),
        },
        {
            "id": "wisps", "title": "在風錘村近郊趕走熱浪凝成的火靈",
            "text": "東邊的山坡上，雪在冬天的太陽下冒著蒸氣。幾團扭曲發燙的熱浪凝成了人形，所到之處草葉焦黑，連空氣都在顫抖。",
            "at": outskirts("windhammer"), "requires": need("kag_heard"), "kind": "combat",
            "enemies": [["scorch_wisp", 3]],
            "success": step("火靈散成了一陣熱風。焦黑的草地中央，有一枚半融化、半結霜的金幣——一半燙手，一半冰得黏住了你的手指。", ["kag_coin"]),
            "fail": step("火靈把你們燙得遍體鱗傷才散去。焦黑的草地中央，有一枚半融化、半結霜的金幣。", ["kag_coin"], [hp(-0.1)]),
        },
        {
            "id": "liv", "title": "回答莉芙",
            "text": "老鐵根看著那枚金幣，臉色變了：「熾寂兩極……卡格尼。熱量之龍。」他看著遠方的巨人之嵴，「傳說它的巢裡有一座寶藏。」莉芙的眼睛亮得像星星：「寶藏！我也要去！」",
            "at": at_npc(LIV), "requires": need("kag_coin"), "kind": "choice",
            "options": [
                {"label": "「下次帶妳一起去」", "success": done("莉芙跳了起來，抱住了你：「說好了！」老鐵根嘆了口氣，又灌了一口酒：「……這丫頭，跟我年輕的時候一模一樣。」", ["kag_1_done", "kag_liv"], [aff(LIV, 15, "答應帶她去冒險"), mem("在風錘村發現山上的異變，可能和熱量之龍卡格尼有關。答應下次帶獵人莉芙一起去。")])},
                {"label": "「龍的事，太危險了」", "success": done("莉芙鼓起了臉，可老鐵根拍了拍你的肩：「你是對的。」他把那枚金幣塞回你手裡，「留著。龍的東西，會自己找回家的路。」", ["kag_1_done"], [aff(IRONROOT, 10, "沒有拿孩子冒險"), mem("在風錘村發現山上的異變，可能和熱量之龍卡格尼有關。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

kag2 = {
    "id": "kagni_burn_and_still",
    "title": "熾與寂",
    "summary": "雪嵴哨站外的山谷裡，有一整支商隊停在了半路上：人、馬、雪橇犬，全都一動也不動，像被抽乾了溫度。（龍的寶藏・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": LIV, "min_level": 8, "requires": need("kag_1_done"),
        "text": "莉芙一路跑進了風錘村的酒館，喘著氣：「雪嵴哨站那邊出事了！一整支商隊停在山谷裡，不會動了！不是死了——是……是靜止了！」她抓起弓，「這次一定要帶我去！」",
    },
    "start_flags": ["kag_still"],
    "nodes": [
        {
            "id": "route", "title": "請雪嵴哨站的安雅帶路",
            "text": "雪橇夫安雅蹲在哨站門口，摸著她的雪橇犬：「笨蛋今天不肯往北走。」她抬頭看你，「那個山谷，我知道路。但我不帶笨蛋去送死。」",
            "at": at_npc(ANYA), "requires": need("kag_still"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("安雅瞪了你很久，然後嘆氣：「……好。但笨蛋留在這裡。」她帶你們走了一條連地圖上都沒有的小路，一個時辰就到了山谷口。", ["kag_route"], [aff(ANYA, 10, "說服了她")]),
            "fail": step("安雅不肯帶路，只在地上畫了一張地圖：「迷路的話，不要怪我。」你們繞了大半天才到山谷口。", ["kag_route"], [hp(-0.1)]),
        },
        {
            "id": "shades", "title": "在雪嵴哨站近郊的靜止山谷擊退寂白之影",
            "text": "山谷裡一點聲音也沒有。商隊的人停在半路，臉上的表情凍在了驚恐的那一刻。他們的影子卻在動——死白色的影子從他們腳下爬出來，朝你們撲了過來。",
            "at": outskirts("snowridge"), "requires": need("kag_route"), "kind": "combat",
            "enemies": [["stillness_shade", 2]],
            "success": step("寂白之影碎成了雪花。商隊的人一個接一個地眨了眨眼，又開始呼吸——他們不記得發生了什麼，只覺得心裡空空的。", ["kag_freed"]),
            "fail": step("寂白之影把你們逼退了，卻在莉芙一箭射穿最後一個影子時散去。商隊的人又開始呼吸了，只覺得心裡空空的。", ["kag_freed"], [hp(-0.15)]),
        },
        {
            "id": "gold", "title": "決定要不要拿山谷裡的金子",
            "text": "山谷的盡頭，地上散落著成堆的金幣，有的熔成了一灘，有的結滿了霜。莉芙看呆了。商隊的頭領搖著頭：「別碰。那是龍的東西。我們就是撿了一枚，才變成這樣的。」",
            "at": outskirts("snowridge"), "requires": need("kag_freed"), "kind": "choice",
            "options": [
                {"label": "一枚也不拿", "success": done("你拉著莉芙轉身離開。走出山谷時，你回頭看了一眼：金幣堆一半冒起了蒸氣、一半結了霜，然後又安靜下來。什麼也沒有發生，你卻覺得整座山谷剛剛換了一口氣。", ["kag_2_done", "kag_respect"], [aff(LIV, 10, "被你拉住了"), mem("在雪嵴哨站外的靜止山谷救了一支被抽乾溫度的商隊，沒有碰龍的金子。")])},
                {"label": "裝滿一袋", "success": done("你裝了滿滿一袋金幣。回程的路上，你的手指一直發冷，晚上做夢時夢見一片死白的虛空。莉芙說你睡著的時候，連呼吸聲都沒有。", ["kag_2_done", "kag_greed"], [money(400), hp(-0.1), mem("在雪嵴哨站外的靜止山谷拿了龍的金子，從此夢裡偶爾會出現一片死白的虛空。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

kag3 = {
    "id": "kagni_hoard",
    "title": "卡格尼的寶藏",
    "summary": "巨人之嵴的山腰上，有一個一半燃燒、一半冰封的山洞。老鐵根說，那就是熱量之龍卡格尼的巢。（龍的寶藏・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": IRONROOT, "min_level": 11, "requires": need("kag_2_done"),
        "text": "老鐵根把一把老舊的戰斧放在桌上：「四十年前，我上過一次巨人之嵴。我看見了那個洞——一半在燒，一半結冰。我沒敢進去。」他看著你，「被抽乾的那些商隊、山民……他們的溫度，都在那裡面。去拿回來。」",
    },
    "start_flags": ["kag_hoard"],
    "nodes": [
        {
            "id": "wardens", "title": "在風錘村近郊的巨人之嵴山腰擊退熾寂的守衛",
            "text": "山洞口，兩個巨大的身影一左一右地站了起來：一個是燒得發白的熔岩，一個是寂靜無聲的冰。它們沒有臉，也沒有開口，只是一左一右地擋在洞口——一邊的空氣在沸騰，一邊的空氣連聲音都傳不過去。",
            "at": outskirts("windhammer"), "requires": need("kag_hoard"), "kind": "combat",
            "enemies": [["blaze_warden", 1], ["heat_warden", 1]],
            "success": step("守衛們倒下了，一個化成了岩漿，一個碎成了冰。山洞深處，熱與冷的節奏變了一拍。", ["kag_inside"]),
            "fail": step("守衛們把你們燒傷又凍傷，然後毫無理由地停了下來，退回洞口兩側，像兩塊又冷卻了的石頭。山洞深處，熱與冷的節奏變了一拍。", ["kag_inside"], [hp(-0.2)]),
        },
        {
            "id": "gaze", "title": "承受卡格尼的注視",
            "text": "山洞的最深處沒有龍，只有一片扭曲發燙的赤色熱浪，和一片連心跳都會停止的死白虛空，兩者交替著。成堆的寶藏閃著光——不是金子，是一團團小小的、溫暖的光點。",
            "at": outskirts("windhammer"), "requires": need("kag_inside"), "kind": "check",
            "check": {"attr": "fai", "dc": 16},
            "success": step("你站在熾與寂的交界上，沒有被燒乾，也沒有被凍住。熱浪漲上來的時候，你突然很想大笑；虛空壓下來的時候，你又什麼都不想要了。這裡沒有誰在看你——只是一冷一熱的潮水在漲、在退。光點在你身邊盤旋，那是被抽走的溫度：喜悅、憤怒、思念。", ["kag_faced"], [BLESSED]),
            "fail": step("你的心跳停了一拍，又被燙得狂跳。你跪在交界上，一下子想哭，一下子什麼感覺也沒有。光點在你身邊盤旋——那是被抽走的溫度。", ["kag_faced"], [hp(-0.2)]),
        },
        {
            "id": "take", "title": "從卡格尼的寶藏裡拿走一樣東西",
            "text": "熱浪與虛空交替的節奏慢了下來，在洞底留下兩堆東西：一堆是那些溫暖的光點，一堆是真正的金子。兩堆之間的地面一冷一熱地裂開——你看得出來，等下一口呼吸到了，只來得及抱走其中一堆。",
            "at": outskirts("windhammer"), "requires": need("kag_faced"), "kind": "choice",
            "options": [
                {"label": "拿回被抽走的溫度", "success": done("你捧起光點，它們像一群螢火蟲跟著你下山。那天晚上，風錘村和雪嵴哨站的人都哭了、笑了，好像想起了很久沒有想起的事。風錘的鳴響恢復了低沉的調子。老鐵根舉起酒壺：「敬龍——和不怕龍的人。」", ["kag_done", "kag_warmth", "kagni_seen"], [aff(IRONROOT, 20, "替山民拿回了溫度"), aff(LIV, 15, "帶她看了龍的巢"), mem("在巨人之嵴的熱量之龍卡格尼巢裡，拿回了被抽走的溫度，還給了風錘村與雪嵴哨站的人。洞裡沒有龍，只有一冷一熱的呼吸。", 3)])},
                {"label": "拿走龍的金子", "success": done("你扛著金子下山。那些光點留在了洞裡，閃了一下，熄了。風錘的鳴響還是變了調，被抽乾的人也沒有好起來。你很富有——只是從此以後，喝酒的時候嘗不太出味道。", ["kag_done", "kag_gold", "kagni_seen"], [money(1500), mem("在巨人之嵴的熱量之龍卡格尼巢裡，拿走了龍的金子。從此以後，喝酒的時候嘗不太出味道。", 3)])},
            ],
        },
    ],
    "rewards": [money(1000), xp(2000)],
}

# ---------------- 北境群山：傳說的礦石 ----------------
ore1 = {
    "id": "ore_seal_knocking",
    "title": "封印之門後的敲擊聲",
    "summary": "石誓會的守門騎士巴爾林說，地底的封印之門後面傳來敲擊聲，議會卻不相信他。（傳說的礦石・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": BALIN, "min_level": 5,
        "text": "巴爾林說話像在念誓詞：「吾守封印之門三十年，門後從無聲響。此月以來，每夜三更，有敲擊之聲。」他壓低聲音，「議會說是老鼠。老鼠不會照節拍敲。你聽聽看就知道了。」",
    },
    "start_flags": ["ore_start"],
    "nodes": [
        {
            "id": "rhythm", "title": "請心火熔源的瑪格達聽敲擊的節拍",
            "text": "你把巴爾林錄在蠟板上的節拍拿給心火熔源的主祭瑪格達。她聽了一遍，手裡的鐵鉗停在了半空：「這不是老鼠。」",
            "at": at_npc(MAGDA), "requires": need("ore_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("瑪格達和你一起把節拍分析出來：三短一長，是矮人鍛造的鍛打節奏——而且是一種已經失傳三百年的古法。「門後面有人在打鐵。」她說，「或者有什麼東西在打鐵。」", ["ore_rhythm"], [aff(MAGDA, 5, "聽得懂鍛打的節拍")]),
            "fail": step("瑪格達聽了三遍，臉色越來越難看：「這是失傳三百年的鍛打古法。門後面有人在打鐵。」", ["ore_rhythm"]),
        },
        {
            "id": "shaft", "title": "在鐵爐堡近郊的舊礦道清出通往封印之門的路",
            "text": "通往封印之門的舊礦道已經廢棄了很多年。礦道深處傳來喀喀的聲音，一群背上長著礦石的石蟲爬了出來，啃著礦道的支柱。",
            "at": outskirts("ironforge"), "requires": need("ore_rhythm"), "kind": "combat",
            "enemies": [["stone_mite", 3]],
            "success": step("石蟲被清乾淨了。礦道的盡頭是一扇刻滿符文的石門。你們在門前站了一會兒——三短一長。敲擊聲真的在。", ["ore_door"]),
            "fail": step("石蟲啃斷了一根支柱才逃走，礦道塌了一半。你們從碎石堆裡爬到了石門前——三短一長。敲擊聲真的在。", ["ore_door"], [hp(-0.1)]),
        },
        {
            "id": "decide", "title": "和巴爾林決定接下來怎麼辦",
            "text": "巴爾林把手掌貼在封印之門上，閉著眼睛聽了很久：「門後有人在鍛鐵。吾等該如何？」",
            "at": at_npc(BALIN), "requires": need("ore_door"), "kind": "choice",
            "options": [
                {"label": "把節拍的事報告給議會", "success": done("你和瑪格達一起把蠟板送到了長老石廳。議會吵了三天，最後決定：「派人去灰岩堡壘，問問迷石氏族的人。」巴爾林第一次笑了：「終於有人信了。」", ["ore_1_done", "ore_reported"], [aff(BALIN, 15, "讓議會相信了他"), rep(DWARF, 5), mem("在鐵爐堡替石誓會的巴爾林證明了封印之門後的敲擊聲是失傳的鍛打古法。")])},
                {"label": "陪他守一夜，等門後的人", "success": done("你們在石門前守到了三更。敲擊聲停了，門縫裡塞出來一小塊石頭——在黑暗裡發著微弱的星光。巴爾林把它捧在手心：「門後的人……在回應我們。」", ["ore_1_done", "ore_stone"], [aff(BALIN, 20, "陪他守了一夜"), mem("在鐵爐堡的封印之門前守了一夜，門縫裡塞出來一塊發著星光的石頭。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

ore2 = {
    "id": "ore_mistone_runes",
    "title": "迷石的符文師",
    "summary": "灰岩堡壘的符文師瑟爾・迷石，從地底的「無光之層」上來，是被派來「看看地面發生了什麼」的人。也許瑟爾知道封印之門後面是誰。（傳說的礦石・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": SER, "min_level": 8, "requires": need("ore_1_done"),
        "text": "瑟爾正對著灰岩堡壘的一塊石頭說話，看見你，答非所問地說：「石頭說你會來。」瑟爾把一塊發著星光的碎石舉起來，「星心礦。只在心跳一樣的鍛打下才會長大。下面的人在養它——三百年了。可是，有東西在追送信的人。」",
    },
    "start_flags": ["ore_ser"],
    "nodes": [
        {
            "id": "riddle", "title": "在灰岩堡壘的酒館聽懂瑟爾的謎語",
            "text": "瑟爾請你喝了一杯石頭味的酒，說了一大串像謎語的話：「門不是門。鎖不是鎖。被封住的，不是怪物，是我們自己。送信的人走了七天，石頭說他還沒到。」",
            "at": at_cell("greyrock", "tavern"), "requires": need("ore_ser"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("你耐著性子陪瑟爾把話說完，終於聽懂了：封印之門封住的，是自願留在地底守護星心礦的迷石氏族古鍛匠。他們派了一個送信的人上來，要告訴鐵爐堡「礦長成了」，可送信的人被無光之層的東西追著，困在了堡壘外的山洞裡。", ["ore_riddle"], [aff(SER, 10, "聽懂了瑟爾的話")]),
            "fail": step("你聽得頭昏腦脹，最後瑟爾嘆了口氣，畫了一張圖給你：一扇門、一個小人、一個追著小人的大東西，和堡壘外的一個山洞。", ["ore_riddle"]),
        },
        {
            "id": "courier", "title": "在灰岩堡壘近郊救出迷石的信使",
            "text": "堡壘外的山洞裡，一個渾身沾滿礦粉的矮人縮在角落，懷裡緊緊抱著一個石匣。洞口外，兩頭沒有眼睛的灰白巨獸正在嗅著空氣——無光之層的潛獵者。",
            "at": outskirts("greyrock"), "requires": need("ore_riddle"), "kind": "combat",
            "enemies": [["lightless_stalker", 2]],
            "success": step("潛獵者倒下了。信使從角落裡爬出來，打開石匣——裡面是一塊拳頭大的星心礦，亮得照亮了整個山洞。「礦長成了。」他說，「鐵爐堡要知道。」", ["ore_courier"]),
            "fail": step("潛獵者把你們逼退到了洞口，灰岩堡壘的巡邏兵聽見了聲音趕來。信使得救了，懷裡的石匣裡，是一塊拳頭大的星心礦。", ["ore_courier"], [hp(-0.15)]),
        },
        {
            "id": "sample", "title": "決定星心礦的樣本交給誰",
            "text": "信使把一小塊星心礦的樣本交給你：「古鍛匠們說，地面上要有人先試試它。交給你信得過的鍛匠。」瑟爾在旁邊點頭，又答非所問：「火有兩種。」",
            "at": at_npc(SER), "requires": need("ore_courier"), "kind": "choice",
            "options": [
                {"label": "交給心火熔源的瑪格達", "success": done("瑪格達用心火熔源的火燒了星心礦三天三夜。第四天，礦石發出了鐘聲一樣的鳴響。她的眼眶紅了：「三百年前的古法……是真的。」", ["ore_2_done", "ore_magda"], [aff(MAGDA, 15, "讓她親手試了星心礦"), aff(SER, 10, "完成了迷石的託付"), mem("在灰岩堡壘救出了迷石氏族的信使，把星心礦的樣本交給了心火熔源的瑪格達。")])},
                {"label": "交給「無火之鐵」的迪莉婭", "success": done("迪莉婭用她的魔導爐只花了一個下午就把星心礦熔開了，礦石裡流出了會自己發光的液態金屬。她樂得在工坊裡轉圈：「這東西會改變一切！」", ["ore_2_done", "ore_dilia"], [aff(DILIA, 15, "讓她試了星心礦"), aff(SER, 10, "完成了迷石的託付"), mem("在灰岩堡壘救出了迷石氏族的信使，把星心礦的樣本交給了「無火之鐵」的迪莉婭。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

ore3 = {
    "id": "ore_star_heart",
    "title": "星心礦",
    "summary": "三百年來第一次，封印之門要打開了。古鍛匠們要把星心礦交給地面——可是門上的石衛不認得現在的矮人。（傳說的礦石・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": BALIN, "min_level": 11, "requires": need("ore_2_done"),
        "text": "巴爾林換上了全套的石誓會儀甲：「議會准了。封印之門將開。」他握緊了戰錘，「但門上的石衛是三百年前刻下的誓言。它們只認得三百年前的矮人。吾等須以力量證明——地面上的人，配得上星心。」",
    },
    "start_flags": ["ore_open"],
    "nodes": [
        {
            "id": "wardens", "title": "在鐵爐堡近郊的封印之門前通過石衛的考驗",
            "text": "封印之門上的兩尊石像睜開了眼睛，從門上走了下來，比巴爾林高三倍。它們用三百年前的古矮人語開口：「何人叩門？」巴爾林舉起戰錘，站在你身邊。",
            "at": outskirts("ironforge"), "requires": need("ore_open"), "kind": "combat",
            "enemies": [["elder_gate_warden", 1], ["gate_warden", 1]], "allies": [BALIN],
            "success": step("石衛單膝跪下，回到了門上。封印之門發出三短一長的聲響，慢慢地打開了。門後，一群白鬍子垂到地上的古鍛匠站在一座星光閃爍的礦脈前。", ["ore_opened"]),
            "fail": step("石衛把你們打倒了兩次，第三次，巴爾林用古矮人語念完了石誓會的誓詞。石衛停了下來，回到了門上。門後，一群白鬍子垂到地上的古鍛匠站在一座星光閃爍的礦脈前。", ["ore_opened"], [hp(-0.2)]),
        },
        {
            "id": "carry", "title": "把第一塊星心礦扛上地面",
            "text": "古鍛匠的首領把一塊和人一樣大的星心礦推到你面前：「三百年的心血。地面的人，扛得動它，就配得上它。」",
            "at": outskirts("ironforge"), "requires": need("ore_opened"), "kind": "check",
            "check": {"attr": "str", "dc": 16},
            "success": step("你扛著星心礦一步一步走出了礦道。走出礦道的那一刻，陽光照在礦石上，整座山谷響起了鐘聲。古鍛匠們跟在你身後，三百年來第一次看見了太陽。", ["ore_carried"]),
            "fail": step("你扛到一半就跪了下去，巴爾林和信使一起幫你撐住。三個人一起把星心礦扛出了礦道。古鍛匠們跟在後面，三百年來第一次看見了太陽。", ["ore_carried"], [hp(-0.15)]),
        },
        {
            "id": "heart", "title": "決定星心礦的去處",
            "text": "心火熔源前擠滿了矮人。瑪格達、迪莉婭、巴爾林、瑟爾都在。古鍛匠的首領看著你：「是你扛上來的。你說，它該成為什麼？」",
            "at": at_npc(MAGDA), "requires": need("ore_carried"), "kind": "choice",
            "options": [
                {"label": "成為心火熔源的新爐心", "success": done("星心礦被放進了心火熔源。主爐的火焰變成了星光的顏色，整座鐵爐堡都聽見了鐘聲。瑪格達跪在爐前祈禱：「赫斐斯托斯在呼吸。」古鍛匠們留在了地面上，把三百年前的古法教給了年輕的鍛匠。", ["ore_done", "ore_hearth"], [aff(MAGDA, 25, "讓心火熔源有了新爐心"), aff(BALIN, 15, "完成了石誓會的誓言"), rep(DWARF, 15), mem("把三百年來的第一塊星心礦扛上了地面，成了鐵爐堡心火熔源的新爐心。", 3)])},
                {"label": "地底與地面平分", "success": done("你把星心礦一分為二：一半留在鐵爐堡，一半還給地底的古鍛匠。瑟爾第一次說了一句不像謎語的話：「這樣，門就不用再關上了。」從那天起，封印之門再也沒有關過。", ["ore_done", "ore_shared"], [aff(SER, 25, "讓地底與地面不再隔著門"), aff(BALIN, 10, "完成了石誓會的誓言"), rep(DWARF, 10), mem("把星心礦一分為二，一半留在鐵爐堡，一半還給地底的古鍛匠。封印之門從此再也沒有關過。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 北境群山：灌醉對方的酒 ----------------
brew1 = {
    "id": "brew_cellar_queue",
    "title": "酒窖門口的隊伍",
    "summary": "一年一度的氏族宴會快到了。誰能把別的氏族喝倒，誰就能在議會裡多說一句話——所以「酒桶」赫爾嘉的酒窖門口，排滿了各氏族的使者。（灌醉對方的酒・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": HELGA, "min_level": 5,
        "text": "赫爾嘉一腳把一個塞錢的使者踹出了酒窖：「誰的錢我都不收！」她轉頭看見你，眼睛一亮，「喲，人類？你不是哪個氏族的人吧？太好了，我缺一個跑腿的。今年我要釀一桶誰都喝不倒的酒——缺雪嵴的冰麥。」",
    },
    "start_flags": ["brew_start"],
    "nodes": [
        {
            "id": "barley", "title": "到雪嵴哨站的酒館買冰麥",
            "text": "雪嵴哨站的酒館裡，收冰麥的商人搖著頭：「今年的冰麥都被各氏族的人訂光了。他們不讓赫爾嘉拿到——拿到了，她的酒就沒人喝得倒了。」",
            "at": at_cell("snowridge", "tavern"), "requires": need("brew_start"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": step("你說服商人：氏族的人訂了，可還沒付錢；赫爾嘉的錢，現在就付。商人想了想，偷偷從倉庫後面拖出了兩袋冰麥。", ["brew_barley"]),
            "fail": step("商人不肯賣，可雪橇夫安雅在旁邊聽見了：「冰麥？山上的牧民家裡還有。」她替你牽了線，代價是一大筆錢。", ["brew_barley"], [money(-100)]),
        },
        {
            "id": "marauders", "title": "在雪嵴哨站近郊擋下搶冰麥的劫掠者",
            "text": "回程的山路上，幾個裹著毛皮的劫掠者從雪堆裡跳了出來：「冰麥留下！有人出錢讓赫爾嘉今年釀不成！」",
            "at": outskirts("snowridge"), "requires": need("brew_barley"), "kind": "combat",
            "enemies": [["snow_marauder", 3]],
            "success": step("劫掠者逃進了風雪裡。冰麥一粒都沒少。", ["brew_safe"]),
            "fail": step("劫掠者搶走了一袋才逃走。剩下的一袋，應該夠了吧。", ["brew_safe"], [hp(-0.1)]),
        },
        {
            "id": "taste", "title": "替赫爾嘉試新酒",
            "text": "赫爾嘉用冰麥釀出了第一桶試作酒，倒了一杯給你：「人類的舌頭，最誠實。說吧，怎麼樣？」酒是冰的，喝下去卻像吞了一團火。",
            "at": at_npc(HELGA), "requires": need("brew_safe"), "kind": "choice",
            "options": [
                {"label": "「完美。一滴都不要改」", "success": done("赫爾嘉大笑，又給你倒了一杯，然後又一杯。你醒來的時候已經是第二天中午，她在旁邊記帳：「人類，三杯。及格。」", ["brew_1_done"], [aff(HELGA, 10, "喝了她三杯酒"), mem("替鐵爐堡的釀酒師赫爾嘉找來了冰麥，喝了她三杯新酒。")])},
                {"label": "「加一點人類的蜂蜜試試」", "success": done("赫爾嘉皺起眉頭：「蜂蜜？矮人的酒加蜂蜜？」可她還是試了。第二桶酒甜得像糖，後勁卻大得讓她自己都晃了一下。她瞪著你：「……你這個人類，有點東西。」", ["brew_1_done", "brew_honey"], [aff(HELGA, 15, "給了她新的點子"), mem("替鐵爐堡的釀酒師赫爾嘉找來了冰麥，還說服她在矮人的酒裡加了蜂蜜。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

brew2 = {
    "id": "brew_bribed_cask",
    "title": "被收買的酒",
    "summary": "宴會前十天，赫爾嘉酒窖裡最好的那一桶被人動了手腳：有人在裡面加了會讓酒變酸的東西。（灌醉對方的酒・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": HELGA, "min_level": 8, "requires": need("brew_1_done"),
        "text": "赫爾嘉第一次沒有笑，她把一杯酸掉的酒倒在地上：「有人進了我的酒窖。」她的手在發抖，不是因為害怕，是因為生氣，「我的酒窖只有三把鑰匙。一把在我身上，一把在我的學徒身上，一把……我不記得了。替我找出來是誰。」",
    },
    "start_flags": ["brew_sour"],
    "nodes": [
        {
            "id": "culprit", "title": "在鐵爐堡的酒館找出動手腳的人",
            "text": "鐵爐堡的酒館裡，赫爾嘉的學徒一個人喝著悶酒，手指上沾著一點白色的粉末。他看見你，把手藏到了桌子底下。",
            "at": at_cell("ironforge", "tavern"), "requires": need("brew_sour"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你沒有逼他，只是問他師父最近好不好。學徒哭了：某個氏族的人用他母親的債逼他，在酒裡加了酸石粉。收買他的人今晚會在城外的舊倉庫等他回報。", ["brew_found"]),
            "fail": step("學徒一口咬定什麼都不知道，可他的手指出賣了他。你跟著他走出酒館，一路跟到了城外的舊倉庫。", ["brew_found"]),
        },
        {
            "id": "warehouse", "title": "在鐵爐堡近郊的舊倉庫擋下收買學徒的打手",
            "text": "城外的舊倉庫裡，幾個拿錢辦事的打手正在等學徒：「事情辦好了？很好。」他們看見你，把手伸向了腰間的短棍。",
            "at": outskirts("ironforge"), "requires": need("brew_found"), "kind": "combat",
            "enemies": [["hired_thug", 2]],
            "success": step("打手們倒下了。其中一個的錢袋上繡著一個氏族的紋章——鐵爐氏族的分家。", ["brew_caught"]),
            "fail": step("打手們逃了，丟下了一個繡著氏族紋章的錢袋——鐵爐氏族的分家。", ["brew_caught"], [hp(-0.15)]),
        },
        {
            "id": "settle", "title": "和赫爾嘉決定怎麼處理",
            "text": "赫爾嘉看著那個錢袋，又看著跪在地上的學徒，很久沒有說話。最後她說：「人類，你說——在宴會上當眾揭穿他們，還是讓他們私下賠我一桶最好的酒？」",
            "at": at_npc(HELGA), "requires": need("brew_caught"), "kind": "choice",
            "options": [
                {"label": "當眾揭穿", "success": done("宴會的前一天，赫爾嘉把錢袋掛在了酒窖門口。整座鐵爐堡都在笑那個分家。學徒被赫爾嘉罰洗了一個月的酒桶，但沒有被趕走。", ["brew_2_done", "brew_exposed"], [aff(HELGA, 15, "替她出了一口氣"), mem("替鐵爐堡的赫爾嘉找出了在酒裡動手腳的人，當眾揭穿了收買學徒的氏族分家。")])},
                {"label": "讓他們私下賠", "success": done("分家的家主親自扛著一桶三百年的老酒來道歉，還替學徒的母親還清了債。赫爾嘉喝了一口老酒，哼了一聲：「……還不錯。」", ["brew_2_done", "brew_quiet"], [aff(HELGA, 15, "替她換來了一桶老酒"), mem("替鐵爐堡的赫爾嘉找出了在酒裡動手腳的人，讓氏族分家私下賠了一桶三百年的老酒。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

brew3 = {
    "id": "brew_clan_feast",
    "title": "氏族宴會",
    "summary": "一年一度的氏族宴會開始了。赫爾嘉這次不替任何氏族釀酒——她要讓你帶著她的酒上桌，把每個氏族都喝倒。（灌醉對方的酒・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": HELGA, "min_level": 11, "requires": need("brew_2_done"),
        "text": "赫爾嘉把一桶比你還高的酒推到你面前：「今年，我不替任何氏族釀酒。」她咧嘴一笑，「我替你釀。你帶著它上桌，把他們全都喝倒——然後，你在議會裡多說的那一句話，要替我說。」",
    },
    "start_flags": ["brew_feast"],
    "nodes": [
        {
            "id": "brawl", "title": "在鐵爐堡的酒館撐過宴會上的醉鬥",
            "text": "宴會進行到一半，喝輸的氏族開始不服氣了。三個滿臉通紅的矮人鬥士跳上了桌子：「喝輸了不算！打一場！」整間酒館都在拍桌子。依宴會的規矩，醉鬥不准用刀，但拳頭和酒桶都可以。",
            "at": at_cell("ironforge", "tavern"), "requires": need("brew_feast"), "kind": "combat",
            "enemies": [["feast_brawler", 3]],
            "success": step("三個鬥士都躺在了酒桶堆裡，打著呼。全場的矮人站起來敬酒——敬你。", ["brew_brawled"]),
            "fail": step("你被打倒了兩次，第三次爬起來的時候，三個鬥士已經醉得自己倒下了。全場的矮人大笑著站起來敬酒——敬你。", ["brew_brawled"], [hp(-0.2)]),
        },
        {
            "id": "drink", "title": "和各氏族的代表拚酒",
            "text": "最後的拚酒開始了。鐵爐、灰岩、銅鬚、迷石，四個氏族的代表坐成一排，每個人面前都是一排杯子。赫爾嘉替你倒滿了第一杯。",
            "at": at_cell("ironforge", "tavern"), "requires": need("brew_brawled"), "kind": "check",
            "check": {"attr": "str", "dc": 17},
            "success": step("灰岩倒在第九杯，銅鬚倒在第十二杯，鐵爐倒在第十五杯。迷石的代表瑟爾喝到第二十杯，然後對著酒杯說了一句謎語，倒了。你還坐著。全場安靜了一瞬，然後爆出了震天的吼聲。", ["brew_won"]),
            "fail": step("你倒在了第十四杯——可灰岩、銅鬚、鐵爐都比你先倒了。只有瑟爾還坐著，瑟爾看了你一眼，把自己的杯子推倒了：「平手。」全場爆出了震天的吼聲。", ["brew_won"], [hp(-0.1)]),
        },
        {
            "id": "word", "title": "決定在議會裡多說的那一句話",
            "text": "依宴會的規矩，喝倒所有氏族的人，可以在議會裡多說一句話。赫爾嘉在你耳邊說：「你說吧。說什麼都行。」整座鐵爐堡都在等。",
            "at": at_npc(HELGA), "requires": need("brew_won"), "kind": "choice",
            "options": [
                {"label": "「讓銅鬚的商路通到人類的城市」", "success": done("議會裡吵翻了天，可規矩就是規矩。歐文・銅鬚在散會後抱著你轉了三圈：「我等這句話等了二十年！」那年冬天，第一支矮人的商隊翻過了雪嵴哨站，帶著赫爾嘉的酒。", ["brew_done", "brew_trade"], [aff(HELGA, 20, "帶著她的酒贏了宴會"), aff(OWEN, 20, "替銅鬚說了那句話"), rep(DWARF, 10), mem("在鐵爐堡的氏族宴會上喝倒了所有氏族，在議會裡替銅鬚氏族說了一句話：讓商路通到人類的城市。", 3)])},
                {"label": "「明年，所有氏族都喝赫爾嘉的酒」", "success": done("議會愣了很久，然後所有的長老都笑了。從那年起，氏族宴會只准喝一種酒：赫爾嘉的酒。誰也喝不倒誰——宴會變成了真正的宴會。赫爾嘉喝得爛醉，抱著你哭：「我釀了五十年的酒，就是為了這一天。」", ["brew_done", "brew_helga"], [aff(HELGA, 30, "讓所有氏族都喝她的酒"), rep(DWARF, 10), mem("在鐵爐堡的氏族宴會上喝倒了所有氏族，在議會裡說：明年所有氏族都喝赫爾嘉的酒。", 3)])},
            ],
        },
    ],
    "rewards": [money(1200), xp(1800)],
}

# ---------------- 北境群山：魔導與傳統鍛造之爭 ----------------
smith1 = {
    "id": "smith_fireless_iron",
    "title": "無火之鐵",
    "summary": "「無火之鐵」的發明家迪莉婭・銅鬚做出了新的魔導熔爐，不用火也能熔鐵。第一次點火的那一天，她需要一個不怕爆炸的助手。（魔導與傳統鍛造之爭・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": DILIA, "min_level": 5,
        "text": "迪莉婭一邊說話一邊在藍圖上畫線，畫得比說得還快：「不用火！用魔導回路直接讓鐵自己熱起來！」她抬頭，「你會看儀表嗎？不會也沒關係，看到指針跑到紅色就大叫。我們今天點火。應該不會爆炸。大概。」",
    },
    "start_flags": ["smith_start"],
    "nodes": [
        {
            "id": "calibrate", "title": "在鐵爐堡的鐵匠鋪幫迪莉婭校準魔導熔爐",
            "text": "鐵匠鋪的後院裡，迪莉婭的魔導熔爐像一個長滿銅管的巨蛋，表面爬滿了發光的回路。她拉下了拉桿，指針開始往紅色跑。",
            "at": at_cell("ironforge", "smithy"), "requires": need("smith_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你及時發現第三條回路接反了，大叫一聲。迪莉婭把它扳回來，指針停在了綠色。爐子裡的鐵塊安靜地融化了，沒有一點火光。她抱著你跳了起來——然後爐子的排氣口噴出了一團會動的火花。", ["smith_lit"]),
            "fail": step("指針跑到了紅色，你大叫，可是已經晚了。爐子沒有爆炸，排氣口卻噴出了一團團會動的火花，從後院的牆頭跳了出去。迪莉婭：「……我說了，大概。」", ["smith_lit"], [hp(-0.1)]),
        },
        {
            "id": "sparks", "title": "在鐵爐堡近郊抓回失控的魔導火花",
            "text": "失控的魔導火花跳過城牆，在城外的山坡上亂竄，所到之處的鐵器都燙得發紅。一個矮人礦工的鐵鎬在他手裡融成了一灘。",
            "at": outskirts("ironforge"), "requires": need("smith_lit"), "kind": "combat",
            "enemies": [["arcane_spark", 3]],
            "success": step("最後一團火花熄滅了。迪莉婭氣喘吁吁地追上來，手裡拿著一個收集瓶：「它們是熔爐多出來的魔力。我得加一個安全閥。」", ["smith_caught"]),
            "fail": step("火花把你們燙得手忙腳亂，最後自己熄滅了。迪莉婭氣喘吁吁地追上來：「我得加一個安全閥。」", ["smith_caught"], [hp(-0.1)]),
        },
        {
            "id": "tell", "title": "決定要不要告訴瑪格達",
            "text": "迪莉婭把融成一灘的鐵鎬賠給了礦工，然後拉住你：「拜託，別告訴心火熔源的瑪格達。她要是知道我的爐子噴了火花，議會明天就會封了我的工坊。」",
            "at": at_npc(DILIA), "requires": need("smith_caught"), "kind": "choice",
            "options": [
                {"label": "替她保密", "success": done("迪莉婭鬆了一口氣，把一個銅製的小齒輪塞給你：「我的第一個安全閥。做壞了，但是很好看。」", ["smith_1_done", "smith_secret"], [aff(DILIA, 15, "替她保密"), mem("在鐵爐堡幫「無火之鐵」的迪莉婭第一次點燃了魔導熔爐，替她保守了噴出火花的秘密。")])},
                {"label": "「讓瑪格達看看，也許她會幫妳」", "success": done("迪莉婭瞪了你很久，最後還是去了心火熔源。瑪格達聽完，冷冷地說：「火花是爐子在呼吸，你的爐子呼吸得太急。」然後她教了迪莉婭一個傳統的排氣法。迪莉婭回來的時候，表情很複雜：「……她說得對。」", ["smith_1_done", "smith_met"], [aff(DILIA, 10, "讓她去找瑪格達"), aff(MAGDA, 10, "讓她看了新的爐子"), mem("在鐵爐堡幫迪莉婭點燃了魔導熔爐，又讓她去找傳統鍛造的瑪格達，瑪格達教了她排氣法。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

smith2 = {
    "id": "smith_heartfire_test",
    "title": "心火的考驗",
    "summary": "心火熔源的瑪格達向迪莉婭下了戰帖：一把用心火打的劍，一把用無火之鐵打的劍，在熔渣元素的身上試刀。（魔導與傳統鍛造之爭・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": MAGDA, "min_level": 8, "requires": need("smith_1_done"),
        "text": "瑪格達把一把還沒開鋒的劍胚放在鐵砧上：「迪莉婭說她的爐子比心火好。那就比。」她看著你，「我需要一個人替我打鐵——我的手腕老了，打不了一整天。你來掄錘，我來看火。」",
    },
    "start_flags": ["smith_test"],
    "nodes": [
        {
            "id": "hammer", "title": "在鐵爐堡的鐵匠鋪替瑪格達掄錘",
            "text": "瑪格達的錘子比你想的重得多。她站在爐邊，每一錘都要你落在她指的地方：「三短一長。不是用手，是用心跳。」",
            "at": at_cell("ironforge", "smithy"), "requires": need("smith_test"), "kind": "check",
            "check": {"attr": "str", "dc": 15},
            "success": step("你掄了一整天，手臂麻得抬不起來。傍晚，劍胚在你的錘下發出了鐘聲一樣的鳴響。瑪格達難得地拍了拍你的肩：「好心跳。」", ["smith_forged"], [aff(MAGDA, 10, "替她掄了一整天的錘")]),
            "fail": step("你掄到下午就掄不動了，瑪格達接過錘子，忍著手腕的痛打完了最後一百錘。劍成了，她的手腕腫了起來。", ["smith_forged"], [hp(-0.1)]),
        },
        {
            "id": "slag", "title": "在心火熔源用熔渣元素試刀",
            "text": "心火熔源的爐底，積了幾百年的熔渣被魔力喚醒，站成了兩個冒著黑煙的巨大人形。瑪格達拿著心火劍，迪莉婭拿著無火之劍，兩個人都看著你：「你來試。」",
            "at": at_cell("ironforge", "lm_heartfire_forge"), "requires": need("smith_forged"), "kind": "combat",
            "enemies": [["slag_elemental", 2]],
            "success": step("兩個熔渣元素都倒下了：一個被心火劍劈開，一個被無火之劍切斷。兩把劍都沒有缺口。瑪格達和迪莉婭同時看向你。", ["smith_tested"]),
            "fail": step("熔渣元素把你們逼得退出了爐底，最後是瑪格達和迪莉婭一起動手才把它們砍倒。兩把劍都沒有缺口。兩個人同時看向你。", ["smith_tested"], [hp(-0.15)]),
        },
        {
            "id": "judge", "title": "評判兩把劍",
            "text": "兩把劍並排放在鐵砧上。心火劍沉、穩，劍身上有細細的鍛紋；無火之劍輕、銳，劍身上流著淡淡的回路光。整個心火熔源的矮人都在等你開口。",
            "at": at_npc(MAGDA), "requires": need("smith_tested"), "kind": "choice",
            "options": [
                {"label": "「心火的劍，用得比較久」", "success": done("瑪格達沒有笑，只是點了點頭。迪莉婭咬著嘴唇走了。那天晚上，有人看見瑪格達一個人去了迪莉婭的工坊，待到很晚。", ["smith_2_done", "smith_tradition"], [aff(MAGDA, 15, "選了心火的劍"), aff(DILIA, -5, "沒有選她的劍"), mem("在鐵爐堡評判心火劍與無火之劍，選了瑪格達的心火劍。")])},
                {"label": "「無火的劍，誰都打得出來」", "success": done("迪莉婭歡呼一聲，瑪格達卻沒有生氣：「你說得對。心火的劍，只有我打得出來——我死了，它就沒了。」她看著自己腫起來的手腕，很久。", ["smith_2_done", "smith_magitech"], [aff(DILIA, 15, "選了她的劍"), aff(MAGDA, 5, "說出了她不願承認的事"), mem("在鐵爐堡評判心火劍與無火之劍，選了迪莉婭的無火之劍。")])},
                {"label": "「兩把一樣好——各有各的用處」", "check": {"attr": "cha", "dc": 15},
                 "success": done("你說，心火的劍適合傳家，無火的劍適合守城；一把是傳統，一把是未來。瑪格達和迪莉婭互看了一眼，第一次同時笑了。", ["smith_2_done", "smith_both"], [aff(MAGDA, 10, "公平地評判"), aff(DILIA, 10, "公平地評判"), mem("在鐵爐堡評判心火劍與無火之劍，說兩把一樣好，讓瑪格達和迪莉婭第一次同時笑了。")]),
                 "fail": done("兩個人都不滿意：「這是什麼答案？」可她們吵著吵著，就吵到了該怎麼把兩種鍛法合在一起。", ["smith_2_done", "smith_both"], [aff(MAGDA, 5, "不肯選邊"), aff(DILIA, 5, "不肯選邊")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

smith3 = {
    "id": "smith_council_verdict",
    "title": "鍛炎議會的裁決",
    "summary": "鍛炎議會要表決是否封禁「無火之鐵」。表決前夜，迪莉婭城外的工坊被一群蒙面的矮人包圍了。（魔導與傳統鍛造之爭・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": OWEN, "min_level": 11, "requires": need("smith_2_done"),
        "text": "歐文・銅鬚一點也不像平常那樣笑：「明天議會表決封禁無火之鐵。今晚，有人要讓迪莉婭的工坊連表決都等不到。」他把一面銅鬚氏族的盾牌塞給你，「鍛炎議會的激進派。他們說要『替傳統清理門戶』。我的人打不過他們。你可以。」",
    },
    "start_flags": ["smith_vote"],
    "nodes": [
        {
            "id": "zealots", "title": "在鐵爐堡近郊守住迪莉婭的工坊",
            "text": "城外的工坊被火把包圍了。三個披著鍛炎議會紅袍、戴著鐵面具的矮人舉起了戰錘：「無火之鐵是對赫斐斯托斯的褻瀆！」迪莉婭站在工坊門口，手裡抱著她的藍圖，一步也不肯退。",
            "at": outskirts("ironforge"), "requires": need("smith_vote"), "kind": "combat",
            "enemies": [["forge_zealot", 3]],
            "success": step("激進派倒下了。其中一個的鐵面具掉了下來——是瑪格達的學徒。他哭著說：「師父不知道……我只是想保護心火。」", ["smith_saved"]),
            "fail": step("激進派把你們逼退到了工坊門口，就在戰錘要落下時，瑪格達從黑暗裡走了出來：「住手。」激進派愣住了——帶頭的人，是她的學徒。", ["smith_saved"], [hp(-0.2)]),
        },
        {
            "id": "testimony", "title": "替明天的表決準備證詞",
            "text": "歐文把一張空白的證詞紙推到你面前：「明天的表決，議會會聽外人的證詞——尤其是一個在心火熔源掄過錘、又在無火之爐前看過儀表的外人。」他頓了頓，「寫得好，說不定能改變什麼。」",
            "at": at_npc(OWEN), "requires": need("smith_saved"), "kind": "check",
            "check": {"attr": "int", "dc": 17},
            "success": step("你寫了一整夜：心火的鍛紋、無火的回路、兩把劍砍在熔渣元素上的樣子、今晚的火把與學徒的眼淚。歐文讀完，沉默了很久：「……這不是證詞，這是一首詩。議會會聽的。」", ["smith_testimony"], [aff(OWEN, 10, "寫了一份好證詞")]),
            "fail": step("你的證詞寫得亂七八糟，歐文幫你改到天亮。「沒關係，」他打了個呵欠，「議會最喜歡聽真話，就算說得很難聽。」", ["smith_testimony"]),
        },
        {
            "id": "verdict", "title": "在表決前替迪莉婭和瑪格達做最後的選擇",
            "text": "表決的早上，迪莉婭和瑪格達一起站在長老石廳外。迪莉婭說：「議會會照你的證詞表決。」瑪格達說：「你看過兩種火。你說，矮人的未來是哪一種？」",
            "at": at_npc(DILIA), "requires": need("smith_testimony"), "kind": "choice",
            "options": [
                {"label": "「把兩種火合在一個爐子裡」", "success": done("議會吵了一整天，最後通過了一個誰都沒想到的決議：心火熔源旁邊，蓋一座合爐。瑪格達看火，迪莉婭看儀表。三個月後，合爐打出的第一把劍，劍身上同時有鍛紋和回路光。", ["smith_done", "smith_merged"], [aff(DILIA, 20, "讓她的爐子進了心火熔源"), aff(MAGDA, 20, "讓心火有了傳人"), rep(DWARF, 15), mem("在鐵爐堡的鍛炎議會表決前作證，讓傳統鍛造與魔導合在了一座爐子裡。", 3)])},
                {"label": "「讓無火之鐵自由發展」", "success": done("議會以一票之差否決了封禁。迪莉婭的工坊從此掛上了「議會認可」的牌子，學徒排到了城門口。瑪格達沒有說什麼，只是那年冬天，心火熔源的學徒少了一半。", ["smith_done", "smith_free"], [aff(DILIA, 25, "替她贏了表決"), aff(MAGDA, -10, "心火的學徒少了一半"), rep(DWARF, 5), mem("在鐵爐堡的鍛炎議會表決前作證，議會否決了封禁無火之鐵。", 3)])},
                {"label": "「傳統的火，不能熄」", "success": done("議會通過了封禁，但給了迪莉婭一條路：她的發明只能用在城牆與礦坑，不能用來打武器。迪莉婭沉默了很久，最後笑了：「也好。城牆比劍重要。」瑪格達把自己的錘子借給了她。", ["smith_done", "smith_banned"], [aff(MAGDA, 25, "守住了心火"), aff(DILIA, 5, "替她留了一條路"), rep(DWARF, 10), mem("在鐵爐堡的鍛炎議會表決前作證，議會封禁了用無火之鐵打武器，但讓它留在城牆與礦坑。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 古樹森林：世界樹的衰退 ----------------
wt1 = {
    "id": "wt_spring_decline",
    "title": "少了三成的泉水",
    "summary": "銀月城的生命之泉為全城提供魔力。守泉祭司莉安德拉說，泉水的魔力這十年少了三成——而且越少越快。（世界樹的衰退・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": LIAN, "min_level": 5,
        "text": "莉安德拉跪在泉邊，手掌浸在水裡：「十年前，泉水能治好斷掉的骨頭。現在，只能治好擦傷。」她抬頭看你，眼神很安靜，「王庭說，衰退是自然的節律。可是節律不會越來越快。外族的人……也許看得見我們看不見的東西。」",
    },
    "start_flags": ["wt_start"],
    "nodes": [
        {
            "id": "spring", "title": "在銀月城的生命之泉查看泉水",
            "text": "生命之泉的水清得能看見底下的樹根。仔細看，樹根上爬滿了細細的灰色紋路，像是乾掉的血管。",
            "at": at_cell("silvermoon", "lm_spring_of_life"), "requires": need("wt_start"), "kind": "check",
            "check": {"attr": "fai", "dc": 13},
            "success": step("你把手浸進泉水裡，感覺到了：魔力像血一樣流過樹根，流到灰色紋路的地方就停住了，被什麼東西喝掉了。紋路一路往城外延伸。", ["wt_traced"], [aff(LIAN, 5, "感覺得到泉水")]),
            "fail": step("你什麼也感覺不到，莉安德拉替你指出了樹根上的灰色紋路：「它們十年前還沒有。一路往城外去了。」", ["wt_traced"]),
        },
        {
            "id": "sprites", "title": "在銀月城近郊安撫枯萎的樹精",
            "text": "城外的林地裡，幾棵小樹的樹皮剝落了，樹精從裡面爬出來——它們的葉子是灰色的，眼睛裡沒有光，見到會動的東西就撲上去，像是餓壞了。",
            "at": outskirts("silvermoon"), "requires": need("wt_traced"), "kind": "combat",
            "enemies": [["blight_sprite", 3]],
            "success": step("枯萎的樹精安靜了下來，化成了一堆灰色的落葉。落葉底下，有一小團白色的、毛茸茸的東西——像是黴菌，又像是某種孢子。", ["wt_spore"]),
            "fail": step("樹精把你們逼退了，最後自己枯倒在地上。倒下的地方，有一小團白色的、毛茸茸的孢子。", ["wt_spore"], [hp(-0.1)]),
        },
        {
            "id": "report", "title": "決定把孢子交給誰",
            "text": "莉安德拉看著那團孢子，臉色變得蒼白：「這不是森林裡的東西。」她把它封進一個水晶瓶，「王庭要知道。可是翠輝議會的卡蘭西爾一定會說，是外族帶進來的；新芽同盟的希爾薇……一定會說，要請外族來幫忙。」",
            "at": at_npc(LIAN), "requires": need("wt_spore"), "kind": "choice",
            "options": [
                {"label": "交給翠輝議會的卡蘭西爾", "success": done("卡蘭西爾禮貌地收下了水晶瓶，禮貌到讓你覺得被輕視：「謝謝你，人類。翠輝議會會處理——用精靈的方法。」第二天，森林的邊境多了一倍的巡邏。", ["wt_1_done", "wt_kalanthil"], [aff(KAL, 5, "把孢子交給了議會"), aff(LIAN, 10, "替她查出了原因"), mem("在銀月城發現生命之泉的魔力被一種外來的孢子喝掉了，把樣本交給了翠輝議會的卡蘭西爾。")])},
                {"label": "交給新芽同盟的希爾薇", "success": done("希爾薇抱著水晶瓶轉了一圈：「我就知道！我們需要外面的人！」她當場寫了三封信——給苔語村的人類德魯伊、給鐵爐堡的矮人、給一個她小說裡的讀者。莉安德拉在旁邊嘆了口氣。", ["wt_1_done", "wt_sylvie"], [aff(SYLVIE, 10, "把孢子交給了她"), aff(LIAN, 10, "替她查出了原因"), mem("在銀月城發現生命之泉的魔力被一種外來的孢子喝掉了，把樣本交給了新芽同盟的希爾薇。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

wt2 = {
    "id": "wt_other_end",
    "title": "根的另一端",
    "summary": "苔語村的人類德魯伊奧克塔維亞說，樹會告訴你它哪裡痛。她要在森語之環舉行一次儀式，問問世界樹的根。（世界樹的衰退・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": OCT, "min_level": 8, "requires": need("wt_1_done"),
        "text": "奧克塔維亞的頭髮裡纏著苔蘚，說話的聲音像風吹過樹葉：「銀月城的人寫信給我了。」她笑了笑，「精靈很少寫信給人類。他們一定很害怕。」她把一根樹枝交給你，「今晚，我們問問樹。我的學徒菲恩會幫忙。」",
    },
    "start_flags": ["wt_ritual"],
    "nodes": [
        {
            "id": "ritual", "title": "在苔語村的森語之環和樹說話",
            "text": "森語之環的林間空地上，奧克塔維亞和精靈學徒菲恩手牽著手，開始唱一首沒有歌詞的歌。樹開始說話了——不是用聲音，而是用你腦子裡浮現的畫面。",
            "at": at_cell("mosswhisper", "lm_whispering_ring"), "requires": need("wt_ritual"), "kind": "check",
            "check": {"attr": "fai", "dc": 15},
            "success": step("你看見了：世界樹的根往下、往東延伸，一直延伸到森林最深處的地下洞窟。洞窟裡長滿了發光的蘑菇，蘑菇上爬滿了白色的孢子，孢子順著根往上爬，喝著根裡的魔力。菲恩睜開眼睛，臉色蒼白：「……它在痛。」", ["wt_seen"], [aff(OCT, 10, "聽得見樹說話"), aff(FENN, 5, "陪他完成了儀式")]),
            "fail": step("你只看見了一片模糊的白。奧克塔維亞替你描述：根延伸到森林最深處的地下洞窟，洞窟裡的孢子順著根往上爬。菲恩睜開眼睛：「……它在痛。」", ["wt_seen"]),
        },
        {
            "id": "husks", "title": "在苔語村近郊擋下被孢子寄生的走獸",
            "text": "儀式結束的時候，林子裡響起了腳步聲。幾頭鹿和熊走進了空地——它們的眼睛是白的，背上長滿了毛茸茸的孢子，嘴裡吐著白色的霧。",
            "at": outskirts("mosswhisper"), "requires": need("wt_seen"), "kind": "combat",
            "enemies": [["spore_husk", 2]],
            "success": step("被寄生的走獸倒下了。奧克塔維亞跪在牠們身邊，輕輕唱了一段歌，牠們身上的孢子枯萎了。「孢子從根爬到了地上，」她說，「已經不只是樹的事了。」", ["wt_husks"]),
            "fail": step("被寄生的走獸把你們逼退到了森語之環的邊緣，奧克塔維亞唱起了歌，牠們身上的孢子枯萎了。「已經不只是樹的事了。」", ["wt_husks"], [hp(-0.15)]),
        },
        {
            "id": "plan", "title": "和莉安德拉商量怎麼救根",
            "text": "你把孢子的事帶回了銀月城。莉安德拉聽完，雙手合十：「有兩個方法。星術師艾溫娜說，可以用星光淨化根——很慢，要一整年。翠輝議會說，可以把被寄生的根燒掉——很快，但世界樹會少掉一部分。」",
            "at": at_npc(LIAN), "requires": need("wt_husks"), "kind": "choice",
            "options": [
                {"label": "請艾溫娜用星光慢慢淨化", "success": done("艾溫娜答應了，眼睛亮得像星星：「我早就想試試了！」她在生命之泉旁架起了觀星儀，每天夜裡把星光引進泉水裡。泉水的魔力不再減少了——但也還沒有回來。", ["wt_2_done", "wt_starlight"], [aff(EVENNA, 15, "讓她試了星光淨化"), aff(LIAN, 10, "選了不傷樹的方法"), mem("在苔語村的森語儀式裡看見孢子從森林深處順著世界樹的根往上爬，請星術師艾溫娜用星光慢慢淨化。")])},
                {"label": "讓翠輝議會燒掉被寄生的根", "success": done("翠輝議會的火燒了三天三夜。泉水的魔力回來了一點，可月輝之母的一根枝幹也枯了。莉安德拉在泉邊坐了一整夜，什麼也沒說。", ["wt_2_done", "wt_burned"], [aff(KAL, 10, "選了議會的方法"), aff(LIAN, -5, "世界樹少了一根枝幹"), mem("在苔語村的森語儀式裡看見孢子順著世界樹的根往上爬，讓翠輝議會燒掉了被寄生的根，月輝之母枯了一根枝幹。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

wt3 = {
    "id": "wt_new_sprout",
    "title": "月輝之母的新芽",
    "summary": "孢子的源頭找到了：森林最深處的一棵古樹人，被孢子完全寄生，成了把孢子送進世界樹的根的「心臟」。淨化它，需要一場前所未有的儀式。（世界樹的衰退・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": LIAN, "min_level": 11, "requires": need("wt_2_done"),
        "text": "莉安德拉第一次離開了生命之泉：「源頭是一棵古樹人。它活了三千年，是月輝之母的兄弟。」她握著一根發光的樹枝，「要淨化它，需要所有能和樹說話的人一起唱歌——精靈的祭司、人類的德魯伊，誰都不能少。」她看著你，「可是王庭不准外族參加精靈的儀式。」",
    },
    "start_flags": ["wt_source"],
    "nodes": [
        {
            "id": "treants", "title": "在銀月城近郊壓制被孢子寄生的古樹人",
            "text": "森林深處，兩棵比城牆還高的古樹人拔起了自己的根，朝銀月城走過來。它們的樹皮上長滿了白色的孢子，每走一步，地上就多一片枯萎的草。莉安德拉舉起樹枝，站在你身邊。",
            "at": outskirts("silvermoon"), "requires": need("wt_source"), "kind": "combat",
            "enemies": [["blight_treant_elder", 1], ["blight_treant", 1]], "allies": [LIAN],
            "success": step("古樹人跪了下來，根深深地扎回了土裡。它們還活著，但動不了了。莉安德拉說：「現在。趁它們還記得自己是誰。」", ["wt_held"]),
            "fail": step("古樹人把你們逼退到了城外，卻在莉安德拉唱起歌時停了下來——它們還記得那首歌。「現在。趁它們還記得自己是誰。」", ["wt_held"], [hp(-0.2)]),
        },
        {
            "id": "song", "title": "加入淨化古樹人的歌",
            "text": "精靈的祭司圍成了一圈，開始唱歌。古樹人身上的孢子在發抖，但歌聲不夠——缺了什麼。莉安德拉看著你：「唱吧。不用會唱，用心就好。」",
            "at": outskirts("silvermoon"), "requires": need("wt_held"), "kind": "check",
            "check": {"attr": "fai", "dc": 17},
            "success": step("你開口了。你的聲音一點也不像精靈的歌，可古樹人身上的孢子一片一片地枯萎了。古樹人慢慢睜開了眼睛，看著你——看著一個人類。", ["wt_sung"], [BLESSED]),
            "fail": step("你唱得走了調，可莉安德拉握住了你的手，把你的聲音拉進了歌裡。孢子一片一片地枯萎了。古樹人慢慢睜開了眼睛。", ["wt_sung"], [hp(-0.1)]),
        },
        {
            "id": "sprout", "title": "決定這場儀式要不要公開",
            "text": "淨化完成了。古樹人的頭頂冒出了一根新芽，生命之泉的水重新亮了起來。莉安德拉看著那根新芽：「這是第一次，有人類參加精靈的儀式。王庭會問。你說——我們要告訴他們實話，還是說，這是精靈自己做到的？」",
            "at": at_npc(LIAN), "requires": need("wt_sung"), "kind": "choice",
            "options": [
                {"label": "告訴王庭實話", "success": done("莉安德拉在王庭上說出了一切：人類的德魯伊、人類的冒險者，和一首走了調的歌。卡蘭西爾的臉色鐵青，希爾薇在旁邊拚命忍著不歡呼。女王伊瑟蘭迪爾沉默了很久，只說了一句：「……新芽，是從外面長出來的。」", ["wt_done", "wt_open"], [aff(LIAN, 20, "陪她淨化了古樹人"), aff(SYLVIE, 15, "讓王庭聽見了外族的歌"), aff(KAL, -10, "人類參加了精靈的儀式"), rep(ELF, 10), mem("在古樹森林淨化了被孢子寄生的古樹人，世界樹長出了新芽。你讓莉安德拉在王庭上說出了人類參加儀式的實話。", 3)])},
                {"label": "說是精靈自己做到的", "success": done("莉安德拉在王庭上只說了：「祭司們淨化了源頭。」王庭為此舉行了盛大的慶典，卡蘭西爾在慶典上說，這證明精靈不需要外族。莉安德拉在泉邊找到你，輕聲說：「謝謝你。也……對不起。」", ["wt_done", "wt_hidden"], [aff(LIAN, 15, "替她保住了祭司的位置"), aff(KAL, 10, "精靈證明了自己"), rep(ELF, 15), mem("在古樹森林淨化了被孢子寄生的古樹人，世界樹長出了新芽。這件事被說成是精靈自己做到的。", 3)])},
            ],
        },
    ],
    "rewards": [money(1200), xp(1800)],
}

BATCH10 = [era1, era2, era3, kag1, kag2, kag3, ore1, ore2, ore3, brew1, brew2, brew3, smith1, smith2, smith3, wt1, wt2, wt3]
