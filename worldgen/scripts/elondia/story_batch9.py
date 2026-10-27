"""第九批特殊任務（6 條，南境枯萎荒原）：律法的力量、試煉場、窺見神的一角、莉菈的大冒險、魔族普通人的生活、人與魔。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need
from story_batch7 import done, step

GROM, ULMA, BRUK, SAKA, GORR = 'npc_grom_shatterhorn', 'npc_ulma_bloodtrial', 'npc_bruk', 'npc_saka', 'npc_gorr'
AETH, LILA = 'npc_aetherion', 'npc_lila_listener'
MORG, NICK, PRU = 'npc_morg_herbwife', 'npc_nick_halfdemon', 'npc_pururu'
VESPA, HAGEN, SEB = 'npc_vespa', 'npc_captain_hagen', 'npc_sebastian_eger'
DEMON = 'demon_council'
BLESSED = {"type": "condition", "target": "pc", "condition": "blessed", "add": True}

# ---------------- 獸骨荒丘：律法的力量 ----------------
law1 = {
    "id": "law_weakest_king",
    "title": "四天王中最弱的",
    "summary": "血角氏族封了腐沼村往北的商路。依血角的律法，只有打倒「四天王」的人，才能向酋長格羅姆提要求——第一個是公認最弱的布魯克。（律法的力量・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "guild", "location": "bone_hills", "min_level": 5,
        "text": "公會的告示板上貼著一張被斧頭劈過的委託：「腐沼村的商隊被血角擋在荒丘外三個月了。誰能讓格羅姆開路，報酬加倍。」底下有人用炭筆補了一行：「血角的律法：想跟酋長說話，先打倒四天王。」",
    },
    "start_flags": ["law_start"],
    "nodes": [
        {
            "id": "rules", "title": "在獸骨荒丘的酒館打聽血角的律法",
            "text": "酒館裡的血角戰士聽到「四天王」就笑成一團。角落裡一個苔綠色皮膚的女戰士放下酒杯，冷冷地說：「律法是這樣的：四天王一個一個來，拳頭或嘴巴都行。人類想挑戰？先找布魯克吧。他最弱。」她頓了頓，「他自己會這麼說。」",
            "at": at_cell("bone_hills", "tavern"), "requires": need("law_start"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": step("你請整間酒館喝了一輪。女戰士——「鐵舌」薩卡——多說了幾句：「布魯克每天在城外帶小孩練斧頭。先過他的徒弟，他才會出來。」", ["law_rules"], [aff(SAKA, 5, "懂得請酒")]),
            "fail": step("你的問題讓整間酒館笑得更大聲了。薩卡搖了搖頭：「城外。小孩。斧頭。自己去找。」", ["law_rules"]),
        },
        {
            "id": "cubs", "title": "在獸骨荒丘近郊過布魯克徒弟的關",
            "text": "荒丘外的空地上，幾個角還沒長齊的年輕血角戰士揮著練習用的斧頭朝你衝過來：「布魯克大哥說了，想挑戰四天王，先過我們這關！」遠處的石頭上，一個壯碩的魔族抱著手臂，努力擺出很強的樣子。",
            "at": outskirts("bone_hills"), "requires": need("law_rules"), "kind": "combat",
            "enemies": [["bloodhorn_cub", 3]],
            "success": step("年輕戰士們躺了一地，揉著頭爬起來，眼睛卻閃閃發亮。石頭上的魔族跳了下來：「哼，熱身而已。我是布魯克——四天王中最弱的！」", ["law_warmed"]),
            "fail": step("年輕戰士們把你們打退了，卻圍過來扶你起來：「你很能撐耶！」石頭上的魔族跳了下來，有點不好意思：「……他們打架沒輕沒重，我是布魯克。算你過關。」", ["law_warmed"], [hp(-0.1)]),
        },
        {
            "id": "bruk", "title": "挑戰布魯克",
            "text": "布魯克扭了扭脖子：「來吧，人類。拳頭還是嘴巴？先說好，我是四天王中最弱的——輸給我的話，你就沒臉去見其他三個了。」他身後的小孩們已經開始喊加油了。",
            "at": at_npc(BRUK), "requires": need("law_warmed"), "kind": "choice",
            "options": [
                {"label": "跟他正面摔角", "check": {"attr": "str", "dc": 13},
                 "success": done("你把布魯克摔進了泥裡。小孩們安靜了一瞬，然後爆出歡呼。布魯克躺在地上大笑：「哼，我可是四天王中最弱的！」他爬起來拍了拍你的肩，「下一個是薩卡。她不吃這套，祝你好運。」", ["law_1_done", "law_fist_bruk"], [aff(BRUK, 15, "被正面摔進泥裡"), mem("在獸骨荒丘依血角的律法摔倒了四天王的布魯克。小孩們都在歡呼。")], counters={"demon_stance": -1}),
                 "fail": done("布魯克把你摔進了泥裡，又把你拉了起來：「不錯嘛！很少有人類敢跟我硬碰硬。」他朝小孩們大喊，「看到沒，這叫勇氣！」然後小聲對你說，「……我就算你過關了，別說出去。」", ["law_1_done", "law_fist_bruk"], [aff(BRUK, 10, "敢跟他硬碰硬"), mem("在獸骨荒丘和布魯克摔角輸了，他還是算你過關。")], counters={"demon_stance": -1})},
                {"label": "跟他講道理", "check": {"attr": "cha", "dc": 13},
                 "success": done("你說，四天王最弱的那個是故意墊底，好讓挑戰者熱身——這需要的不是力氣，是氣度。布魯克的臉一路紅到角尖：「……你怎麼知道的？」他咳了一聲，「好吧，嘴巴也是律法承認的武器。你過關了。」", ["law_1_done", "law_word_bruk"], [aff(BRUK, 15, "看穿了他的用心"), mem("在獸骨荒丘說服了四天王的布魯克：他是故意墊底的。")], counters={"demon_stance": 1}),
                 "fail": done("布魯克聽了三句就不耐煩了：「說得太長了！」他把你抓起來扔進泥裡，然後愣了一下，「……啊，我是不是違反了律法？」小孩們都在笑。他嘆了口氣，「好吧，就算你過關。」", ["law_1_done", "law_fist_bruk"], [aff(BRUK, 5, "被他扔進泥裡")], counters={"demon_stance": -1})},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

law2 = {
    "id": "law_iron_tongue",
    "title": "鐵舌薩卡",
    "summary": "四天王的第二位是氏族的律法誦者「鐵舌」薩卡。她說拳頭之前先講道理——可是有人在血角的律法石上潑了血。（律法的力量・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": SAKA, "min_level": 8, "requires": need("law_1_done"),
        "text": "薩卡把一塊沾著乾血的石板拓片摔在桌上：「布魯克那個笨蛋算你過關了？哼。想挑戰我，可以。不過先幫我一件事——有人在城門口的律法石上潑了血，蓋住了其中一條。我想知道是哪一條，還有是誰。」",
    },
    "start_flags": ["law_saka"],
    "nodes": [
        {
            "id": "stone", "title": "在獸骨荒丘的城門讀律法石",
            "text": "城門邊的巨石上刻滿了血角氏族的律法，一個字有半個人高。其中一條被潑上了黑紅的血，血跡已經乾成一層殼。",
            "at": at_cell("bone_hills", "gate"), "requires": need("law_saka"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你刮開血殼，讀出了那一條：「挑戰者不分種族。」潑血的人想讓血角忘了這一條——足跡往荒丘外去了，好幾個，腳步很重。", ["law_stone"]),
            "fail": step("血殼太厚，你讀不出來。一個路過的老血角替你唸了：「挑戰者不分種族。」他朝荒丘外吐了口口水，「那幾個狂戰士幹的。他們說人類不配挑戰血角。」", ["law_stone"]),
        },
        {
            "id": "zealots", "title": "在獸骨荒丘近郊擋下潑血的狂戰士",
            "text": "荒丘外的營火邊，幾個渾身塗滿血的狂戰士正在磨斧頭：「人類？薩卡那個女人竟然要跟人類講律法？」他們站了起來，「律法是給血角的。你們只配被砍。」",
            "at": outskirts("bone_hills"), "requires": need("law_stone"), "kind": "combat",
            "enemies": [["bloodhorn_berserker", 2]],
            "success": step("狂戰士們倒下了。薩卡從暗處走出來——她一直跟在後面看：「哼。你至少不是只會講道理的人類。」", ["law_zealots"]),
            "fail": step("狂戰士們把你們逼到了營火邊，薩卡突然從暗處走出來，一句話就讓他們停了手：「律法第七條。你們想被逐出氏族？」狂戰士們罵罵咧咧地走了。", ["law_zealots"], [hp(-0.15)]),
        },
        {
            "id": "duel", "title": "挑戰「鐵舌」薩卡",
            "text": "城門前圍滿了血角的族人。薩卡站在律法石前，抱著手臂：「好了，人類。拳頭還是嘴巴？我兩樣都奉陪——不過我先說，我最看不起只會用拳頭的蠢貨。」",
            "at": at_npc(SAKA), "requires": need("law_zealots"), "kind": "choice",
            "options": [
                {"label": "在族人面前和她辯律法", "check": {"attr": "int", "dc": 15},
                 "success": done("你從「挑戰者不分種族」辯到「強者的義務」，再辯到「律法為什麼要刻在石頭上」。薩卡越辯越快，最後停了下來，看著你很久：「……我輸了。」族人一片譁然。她笑了，第一次笑得不帶刺，「不分種族。這一條，我會親手重新刻一次。」", ["law_2_done", "law_word_saka"], [aff(SAKA, 20, "把她辯到啞口"), mem("在獸骨荒丘的律法石前，和「鐵舌」薩卡辯律法，辯贏了。", 3)], counters={"demon_stance": 1}),
                 "fail": done("薩卡把你辯得啞口無言，族人們笑得前仰後合。可她抬手讓大家安靜：「他輸了，但他是用嘴巴來的——就為了這一點，我放他過去。」她看著你，「下次辯贏我。」", ["law_2_done", "law_word_saka"], [aff(SAKA, 10, "用嘴巴來挑戰她")], counters={"demon_stance": 1})},
                {"label": "「講不贏就揍——這不是妳的信條嗎？」", "check": {"attr": "str", "dc": 15},
                 "success": done("薩卡挑了挑眉，把外袍一甩：「說得對。」她的拳頭比她的舌頭還快，但你撐住了，最後把她按在了律法石上。族人們歡呼。薩卡擦掉嘴角的血，冷冷地說：「你贏了。但血角的人會記得——人類也是靠拳頭贏的。」", ["law_2_done", "law_fist_saka"], [aff(SAKA, 5, "用拳頭贏了她"), mem("在獸骨荒丘的律法石前用拳頭贏了「鐵舌」薩卡。族人們都在歡呼。")], counters={"demon_stance": -1}),
                 "fail": done("薩卡的拳頭比她的舌頭還快。你被打倒在律法石下，她俯視著你：「我說過，我最看不起只會用拳頭的蠢貨。」她轉身走了，又丟下一句，「……但你敢接，算你過關。」", ["law_2_done", "law_fist_saka"], [aff(SAKA, -5, "只會用拳頭")], counters={"demon_stance": -1})},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

law3 = {
    "id": "law_bone_throne",
    "title": "骨王殿的挑戰",
    "summary": "四天王之首「沉默之斧」戈爾在鮮血試煉場等著。過了他，血角的酋長格羅姆就得聽你說話。（律法的力量・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": SAKA, "min_level": 11, "requires": need("law_2_done"),
        "text": "薩卡把一根刻著血角紋章的骨牌交給你：「戈爾在試煉場等你。他不會開口，你也不用跟他說話——他會讓他的斧衛先上，站到最後的人，他會點頭。」她頓了頓，「然後就是格羅姆了。想好你要跟他說什麼。」",
    },
    "start_flags": ["law_gorr"],
    "nodes": [
        {
            "id": "axes", "title": "在鮮血試煉場過戈爾的斧衛",
            "text": "鮮血試煉場的血沙上，戈爾坐在場邊的骨座上，一動也不動。他舉起一隻手，三名披著黑鐵甲的斧衛走進了場中——他們的斧頭和戈爾的一模一樣。",
            "at": at_cell("bone_hills", "lm_blood_trial_ground"), "requires": need("law_gorr"), "kind": "combat",
            "enemies": [["silent_axe_guard", 3]],
            "success": step("最後一名斧衛跪倒在血沙上。戈爾站了起來，看著你，很慢很慢地點了一下頭。全場的血角戰士一起用斧柄敲地。", ["law_nod"]),
            "fail": step("斧衛把你們逼到了場邊，可你們沒有倒下。戈爾抬起手，斧衛們退了下去。他看著你，很久，然後點了一下頭——撐到最後也是站到最後。", ["law_nod"], [hp(-0.2)]),
        },
        {
            "id": "grom", "title": "在骨王殿面對格羅姆・碎角",
            "text": "骨王殿裡，格羅姆坐在遠古巨龍的骸骨王座上，比你想的還要高大。他沒有起身：「四天王都點頭了。好。人類，依我們的律法，你可以向我提一個要求——或者挑戰我。說吧。」",
            "at": at_npc(GROM), "requires": need("law_nod"), "kind": "choice",
            "options": [
                {"label": "請他開路，帶血角回議會辯論", "check": {"attr": "cha", "dc": 17},
                 "success": done("你說，血角的律法讓一個人類用嘴巴走到了這裡——議會的律法也一樣能讓血角說話，只要血角肯去。格羅姆沉默了很久，然後大笑，笑聲震得骨王座喀喀作響：「好！我就去議會，用嘴巴跟莉莎爾吵一架。商路，開了。」", ["law_done", "law_council"], [aff(GROM, 20, "用血角的律法說服了他"), rep(DEMON, 15), mem("依血角的律法挑戰完四天王，說服了酋長格羅姆開放商路，帶著血角氏族回議會辯論。", 3)], counters={"demon_stance": 1}),
                 "fail": done("格羅姆聽完，搖了搖頭：「說得好聽。議會只會讓魔族變軟。」可他看了看殿外的薩卡，又看了看你，「……商路我開。議會，我不去。這是律法給你的，不是我給你的。」", ["law_done", "law_truce"], [aff(GROM, 5, "依律法提了要求"), rep(DEMON, 5), mem("依血角的律法讓格羅姆開放了商路，但他不肯回議會。", 3)])},
                {"label": "依血角的律法挑戰他", "check": {"attr": "str", "dc": 17},
                 "success": done("格羅姆從王座上站了起來，你們在骨王殿裡打了很久，久到殿外的族人都爬上了屋頂。最後他單膝跪在你面前，大笑：「好！從今天起，你是血角的戰友！」他舉起你的手，「商路開了——但記住，人類，在南境，拳頭說了算。」", ["law_done", "law_fist"], [aff(GROM, 25, "在骨王殿打倒了他"), mem("在骨王殿依血角的律法挑戰酋長格羅姆，打倒了他，成了血角的戰友。", 3)], counters={"demon_stance": -1}),
                 "fail": done("格羅姆把你打倒在王座前，卻親手把你扶了起來：「好拳頭。」他對全族宣布，「這個人類挑戰了我——血角欠他一條商路。」他壓低聲音，「下次再來。拳頭說了算的地方，才是好地方。」", ["law_done", "law_fist"], [aff(GROM, 15, "敢挑戰他"), mem("在骨王殿挑戰酋長格羅姆輸了，他還是開了商路。", 3)], counters={"demon_stance": -1})},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 獸骨荒丘：試煉場 ----------------
trl1 = {
    "id": "trial_new_moon",
    "title": "新月的血祭",
    "summary": "鮮血試煉場的場主烏爾瑪說，只要能在試煉場站到最後，連人類都可以成為血角的戰士。新月快到了。（試煉場・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": ULMA, "min_level": 5,
        "text": "烏爾瑪把斧頭往血沙裡一插：「人類也想上試煉場？好啊。新月前，我要先看看你的血夠不夠熱。」她指了指場中的鐵籠，裡面有東西在噴火，「先過熔岩蜥。」",
    },
    "start_flags": ["trl_start"],
    "nodes": [
        {
            "id": "lizards", "title": "在鮮血試煉場對付熔岩蜥",
            "text": "鐵籠打開，三隻背上冒著岩漿的大蜥蜴爬了出來，在血沙上留下一道道焦痕。看臺上的血角戰士開始下注——賭你撐多久。",
            "at": at_cell("bone_hills", "lm_blood_trial_ground"), "requires": need("trl_start"), "kind": "combat",
            "enemies": [["trial_lizard", 3]],
            "success": step("最後一隻熔岩蜥翻倒在血沙上。看臺上有人罵罵咧咧地付錢，烏爾瑪卻笑了：「不錯。血夠熱。」", ["trl_blooded"]),
            "fail": step("熔岩蜥把你們逼到了場邊，烏爾瑪跳下場，一斧頭一隻。她回頭看你：「撐得比我想的久。」", ["trl_blooded"], [hp(-0.1)]),
        },
        {
            "id": "offer", "title": "決定要不要獻血",
            "text": "場邊有一塊黑色的戰靈石，石面上滿是乾掉的血痕。烏爾瑪割破了自己的手掌，把血抹在石上：「新月時，戰士在這裡獻血，求戰靈庇佑。人類，你要不要也來一點？」",
            "at": at_npc(ULMA), "requires": need("trl_blooded"), "kind": "choice",
            "options": [
                {"label": "在戰靈石上獻血", "success": done("你的血滲進了石頭裡，石頭微微發燙。烏爾瑪大笑著拍你的背：「戰靈收下了！下個新月再來——我會準備更兇的東西。」", ["trl_1_done", "trl_offered"], [aff(ULMA, 15, "在戰靈石上獻血"), hp(-0.1), BLESSED, mem("在獸骨荒丘的鮮血試煉場，在戰靈石上獻了血。")])},
                {"label": "說人類不流這種血", "success": done("烏爾瑪聳聳肩：「也行。戰靈不挑人，人挑戰靈。」她把一袋錢丟給你，「看臺上的人賭你撐不過三十數，我賭你贏。分你一半。」", ["trl_1_done"], [aff(ULMA, 5, "撐過了熔岩蜥"), money(100)])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

trl2 = {
    "id": "trial_bloodhorn_warrior",
    "title": "新月夜的血獸",
    "summary": "新月夜，試煉場會放出從荒原深處捕來的血獸。撐過去的人，烏爾瑪會給他血角戰士的稱號——不分種族。（試煉場・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": ULMA, "min_level": 8, "requires": need("trl_1_done"),
        "text": "烏爾瑪的眼睛在新月前夜亮得嚇人：「明晚，試煉場放血獸。撐過去，你就是血角的戰士。」她朝場邊努了努嘴，「布魯克說要教你幾招。別笑他——他是四天王，雖然是最弱的。」",
    },
    "start_flags": ["trl_moon"],
    "nodes": [
        {
            "id": "spar", "title": "讓布魯克教你對付血獸",
            "text": "布魯克抱著兩把練習斧走過來：「血獸只會往前撞，撞到東西才會轉彎。所以你要——」他突然朝你揮了一斧，「——當那個東西！」",
            "at": at_npc(BRUK), "requires": need("trl_moon"), "kind": "check",
            "check": {"attr": "str", "dc": 14},
            "success": step("你擋住了布魯克的斧頭，順勢把他推開。他愣了一下，然後大笑：「對！就是這樣！」他拍了拍你的肩，「明天我在看臺上幫你喊。」", ["trl_taught"], [aff(BRUK, 10, "學得很快")]),
            "fail": step("布魯克的斧頭把你撞飛了三步。他趕緊跑過來扶你：「啊，抱歉抱歉！我是最弱的嘛，手勁沒控制好……」你很懷疑最後那一句。", ["trl_taught"], [hp(-0.1)]),
        },
        {
            "id": "beasts", "title": "在新月夜的鮮血試煉場撐過血獸",
            "text": "新月夜沒有月光，只有試煉場四周的火盆。鐵門升起，兩頭渾身流著血的巨獸衝了出來，眼睛紅得像炭。看臺上，布魯克扯著嗓子大喊你的名字。",
            "at": at_cell("bone_hills", "lm_blood_trial_ground"), "requires": need("trl_taught"), "kind": "combat",
            "enemies": [["newmoon_beast", 2]],
            "success": step("最後一頭血獸倒在血沙上。看臺上的血角戰士一起用斧柄敲地，聲音大得像打雷。烏爾瑪跳下場，朝你伸出手。", ["trl_survived"]),
            "fail": step("血獸把你們撞倒了兩次，第三次你們還是站了起來。烏爾瑪跳下場，替你們砍倒了最後一頭：「站起來三次。夠了。」", ["trl_survived"], [hp(-0.2)]),
        },
        {
            "id": "title", "title": "接受或婉拒血角戰士的稱號",
            "text": "烏爾瑪用血在你的額頭上畫了一道血角的紋：「從今晚起，你是血角的戰士——只要你點頭。點了頭，荒丘上的血角都會把你當兄弟；也會有人把你當成格羅姆的人。」",
            "at": at_npc(ULMA), "requires": need("trl_survived"), "kind": "choice",
            "options": [
                {"label": "點頭接受", "success": done("烏爾瑪大吼一聲，整座試煉場跟著吼。那天晚上，血角的戰士們輪流跟你乾杯，布魯克喝到哭了出來：「我的徒弟出師了！」", ["trl_2_done", "trl_warrior"], [aff(ULMA, 15, "成了血角的戰士"), aff(BRUK, 10, "他的「徒弟」出師了"), rep(DEMON, 5), mem("在獸骨荒丘的新月夜撐過了血獸，烏爾瑪給了你血角戰士的稱號。", 3)])},
                {"label": "說你只是來變強的", "success": done("烏爾瑪看了你一會兒，用拇指把那道血紋抹開：「也好。不屬於任何氏族的戰士，在南境比較少見。」她咧嘴一笑，「試煉場的門永遠為你開著。」", ["trl_2_done"], [aff(ULMA, 10, "撐過了血獸"), mem("在獸骨荒丘的新月夜撐過了血獸，婉拒了血角戰士的稱號。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

trl3 = {
    "id": "trial_war_spirits",
    "title": "戰靈的庇佑",
    "summary": "百年一次，鮮血試煉場的戰靈會在新月夜醒來，考驗場上最強的戰士。今年，烏爾瑪想讓你和她一起站上去。（試煉場・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": ULMA, "min_level": 11, "requires": need("trl_2_done"),
        "text": "烏爾瑪難得地沒有拿斧頭，而是捧著一碗血：「戰靈石在發燙。百年一次，戰靈會醒來，親自考驗試煉場上的人——上一次站到最後的，是格羅姆。」她把碗遞給你，「這一次，我想跟你一起站上去。」",
    },
    "start_flags": ["trl_spirits"],
    "nodes": [
        {
            "id": "spirits", "title": "在鮮血試煉場面對甦醒的戰靈",
            "text": "新月升起的那一刻，戰靈石裂開了。兩個半透明的巨大身影從石縫裡站了起來，身上是幾百年前的骨甲，手裡的斧頭燃著紅光。看臺上的血角戰士全都跪了下來。烏爾瑪握緊斧頭，站到了你身邊。",
            "at": at_cell("bone_hills", "lm_blood_trial_ground"), "requires": need("trl_spirits"), "kind": "combat",
            "enemies": [["elder_war_spirit", 1], ["war_spirit", 1]], "allies": [ULMA],
            "success": step("戰靈的身影一點一點地散去，最後只剩下兩團紅光，在你和烏爾瑪的頭頂盤旋。", ["trl_spirits_down"]),
            "fail": step("戰靈把你們打倒了一次又一次。第三次爬起來的時候，戰靈停下了斧頭——它們要的不是勝利，是站起來。兩團紅光在你和烏爾瑪的頭頂盤旋。", ["trl_spirits_down"], [hp(-0.25)]),
        },
        {
            "id": "stand", "title": "在戰靈的注視下站到最後",
            "text": "紅光壓了下來，重得像一座山。烏爾瑪咬著牙，膝蓋一點一點地彎下去。戰靈的聲音在你的腦子裡響起：「站著的人，才能得到庇佑。」",
            "at": at_cell("bone_hills", "lm_blood_trial_ground"), "requires": need("trl_spirits_down"), "kind": "check",
            "check": {"attr": "str", "dc": 16},
            "success": step("你站住了。紅光在你的頭頂停了很久，然後慢慢地落了下來——落在你和烏爾瑪之間，等著你決定。", ["trl_stood"]),
            "fail": step("你的膝蓋觸到了血沙，可你用斧柄撐著，沒有倒下。紅光停了很久，然後慢慢地落了下來——落在你和烏爾瑪之間，等著你決定。", ["trl_stood"], [hp(-0.15)]),
        },
        {
            "id": "blessing", "title": "決定戰靈的庇佑給誰",
            "text": "戰靈的庇佑只有一份。烏爾瑪跪在血沙上喘著氣，抬頭看你：「它在等你。拿去吧——你站到了最後。」",
            "at": at_npc(ULMA), "requires": need("trl_stood"), "kind": "choice",
            "options": [
                {"label": "接受戰靈的庇佑", "success": done("紅光鑽進了你的胸口，像一口滾燙的烈酒。看臺上爆出震天的吼聲。烏爾瑪大笑著把你舉了起來：「百年一次！人類！」她在你耳邊說，「下一個百年，換我。」", ["trl_done", "trl_blessed"], [aff(ULMA, 20, "和她一起站到最後"), {"type": "perk", "perk": "thick_skin", "options": ["iron_will", "battle_lust"]}, mem("在獸骨荒丘的鮮血試煉場，和烏爾瑪一起撐過了百年一次的戰靈試煉，得到了戰靈的庇佑。", 3)])},
                {"label": "把庇佑讓給烏爾瑪", "success": done("你把紅光推向烏爾瑪。她愣住了，紅光鑽進了她的胸口。很久，她站了起來，眼睛裡有你從沒見過的東西：「……你知道這代表什麼嗎？在血角，把庇佑讓出去的人，比拿走它的人更強。」她把自己的斧頭塞進你手裡，「這是我的。現在是你的。」", ["trl_done", "trl_gave"], [aff(ULMA, 30, "把戰靈的庇佑讓給她"), rep(DEMON, 10), mem("在鮮血試煉場撐過了戰靈的試煉，把百年一次的庇佑讓給了烏爾瑪。她把自己的斧頭給了你。", 3)])},
            ],
        },
    ],
    "rewards": [money(1200), xp(1800)],
}

# ---------------- 寂墓聖堂：窺見神的一角 ----------------
god1 = {
    "id": "god_silent_prophecy",
    "title": "沉默的預言",
    "summary": "灰燼修會的大祭司艾瑟里昂預言過莉莎爾的崛起，最近卻閉口不談下一個預言。他說，死者們不讓他說。（窺見神的一角・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": AETH, "min_level": 5,
        "text": "艾瑟里昂說話慢得像在數心跳：「下一個預言……我看見了。可是死者們……很吵。吵得我……聽不見自己。」他抬起灰白的眼睛看你，「活人……也許聽得見。去無聲長廊……替我聽聽，他們在吵什麼。」",
    },
    "start_flags": ["god_start"],
    "nodes": [
        {
            "id": "corridor", "title": "在寂墓聖堂的無聲長廊聽死者的低語",
            "text": "無聲長廊裡沒有一點聲音，安靜得能聽見自己的血在流。一個抱著旅行書的見習祭司從石柱後探出頭：「你、你是大祭司說的人嗎？我是莉菈。我……聽得見他們。閉上眼睛，跟著我的聲音。」",
            "at": at_cell("silent_tomb", "lm_silent_corridor"), "requires": need("god_start"), "kind": "check",
            "check": {"attr": "fai", "dc": 13},
            "success": step("你聽見了——成百上千的聲音，重複著同一句話：「火要熄了。火要熄了。」莉菈抓著你的袖子發抖：「他們以前從來不會說同一句話……」", ["god_heard"], [aff(LILA, 5, "陪她一起聽死者的低語")]),
            "fail": step("你什麼也聽不見。莉菈閉著眼睛，替你一字一字地轉述：「火要熄了……他們一直在說，火要熄了。」", ["god_heard"]),
        },
        {
            "id": "restless", "title": "在寂墓聖堂近郊安撫不安的亡魂",
            "text": "長廊外的墓地裡，石棺的蓋子一個接一個地滑開。灰白的亡魂爬了出來，嘴裡喃喃唸著：「火要熄了……」它們朝聖堂湧過來，見人就抓。",
            "at": outskirts("silent_tomb"), "requires": need("god_heard"), "kind": "combat",
            "enemies": [["restless_soul", 3]],
            "success": step("亡魂們散去了，石棺的蓋子一個接一個地合上。墓地重新安靜下來，只有風吹過墓碑的聲音。", ["god_calmed"]),
            "fail": step("亡魂們把你們逼退到了聖堂門口，灰燼修會的祭司們及時趕到，唸起安魂的祝禱。墓地重新安靜下來。", ["god_calmed"], [hp(-0.1)]),
        },
        {
            "id": "report", "title": "回報艾瑟里昂",
            "text": "艾瑟里昂聽完，很久沒有說話。遺火塔頂的白焰在他身後跳動，比你上次看到的時候，好像暗了一點點。",
            "at": at_npc(AETH), "requires": need("god_calmed"), "kind": "choice",
            "options": [
                {"label": "告訴他死者說「火要熄了」", "success": done("「……果然。」艾瑟里昂點了點頭，「謝謝你，活人。我需要……想一想。」他給了你一枚灰燼色的護符，「死者會記得……替他們傳話的人。」", ["god_1_done"], [aff(AETH, 10, "替死者傳話"), mem("替寂墓聖堂的大祭司艾瑟里昂到無聲長廊聽死者的低語：他們說「火要熄了」。")])},
                {"label": "問他到底看見了什麼", "check": {"attr": "cha", "dc": 13},
                 "success": done("艾瑟里昂看了你很久，終於開口：「一隻眼睛……在深淵的底下。它在……慢慢地睜開。」他閉上眼，「我只能說到這裡。再多……死者會不高興。」", ["god_1_done", "god_asked"], [aff(AETH, 10, "敢問神的事"), mem("寂墓聖堂的大祭司艾瑟里昂說，他在預言裡看見深淵底下有一隻眼睛，正在慢慢睜開。")]),
                 "fail": done("艾瑟里昂只是搖了搖頭：「還不是時候。」他給了你一枚灰燼色的護符，「……謝謝你，活人。」", ["god_1_done"], [aff(AETH, 5, "替死者傳話")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

god2 = {
    "id": "god_white_flame",
    "title": "遺火塔的白焰",
    "summary": "遺火塔頂永燃的白焰——魔族罕見的「淨化聖火」——正在一點一點地變暗。有人在偷它。（窺見神的一角・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": AETH, "min_level": 8, "requires": need("god_1_done"),
        "text": "艾瑟里昂第一次說話說得快了一點：「白焰……少了。每晚少一點。不是熄……是被拿走。」他把手按在胸口，「死者說的『火要熄了』……也許是這個。活人，替我……找到拿走它的人。」",
    },
    "start_flags": ["god_flame"],
    "nodes": [
        {
            "id": "tower", "title": "在寂墓聖堂的遺火塔查看白焰",
            "text": "遺火塔頂，白焰在石盆裡靜靜地燒著，沒有煙，也沒有熱。石盆的邊緣卻有幾道細細的黑痕，像是有人用什麼東西從火裡舀走了一些。",
            "at": at_cell("silent_tomb", "lm_ember_tower"), "requires": need("god_flame"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("黑痕是死靈術的符文——有人用骨製的長勺，每晚從石盆裡舀走一點白焰，拿去餵自己的儀式。腳印往聖堂外的墓地去了。", ["god_trace"]),
            "fail": step("你看不懂那些黑痕，但塔下的守夜祭司告訴你：這幾晚，有披著黑袍的人在墓地裡點白色的火。", ["god_trace"]),
        },
        {
            "id": "thieves", "title": "在寂墓聖堂近郊截下盜火的死靈術士",
            "text": "墓地深處，兩個披著黑袍的死靈術士圍著一口石棺，石棺裡燒著一小團偷來的白焰。他們想用它讓死者「永遠不會再死」。看見你，他們舉起了骨杖。",
            "at": outskirts("silent_tomb"), "requires": need("god_trace"), "kind": "combat",
            "enemies": [["flame_thief", 2]],
            "success": step("死靈術士們倒下了。石棺裡的白焰還在燒，小小的一團，像在等人把它帶回家。", ["god_got"]),
            "fail": step("死靈術士們丟下石棺逃了。石棺裡的白焰還在燒，小小的一團，像在等人把它帶回家。", ["god_got"], [hp(-0.15)]),
        },
        {
            "id": "return", "title": "把白焰帶回遺火塔",
            "text": "你捧著那團白焰回到遺火塔。它不燙，摸起來像冬天早晨的陽光。艾瑟里昂看著它，眼睛裡第一次有了光。",
            "at": at_npc(AETH), "requires": need("god_got"), "kind": "choice",
            "options": [
                {"label": "把白焰還回石盆", "success": done("白焰落回石盆，整座遺火塔亮了一下。艾瑟里昂對你深深地鞠了一躬：「灰燼修會……欠你一次。」", ["god_2_done"], [aff(AETH, 15, "替他找回了白焰"), rep(DEMON, 5), mem("替寂墓聖堂找回了遺火塔被偷走的白焰。")])},
                {"label": "問他白焰到底是什麼", "success": done("艾瑟里昂沉默了很久：「人類說……莫爾迪薩是毀滅。我們說……毀滅之後，還有重鑄。」他看著白焰，「這是……祂的另一張臉。萬物燒盡之後……留下來的那一點。」他把白焰放回石盆，「下次……我帶你去看。」", ["god_2_done", "god_two_faces"], [aff(AETH, 15, "想知道神的另一張臉"), rep(DEMON, 5), mem("寂墓聖堂的艾瑟里昂說，遺火塔的白焰是晦暗之淵莫爾迪薩的另一張臉：毀滅之後的重鑄。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

god3 = {
    "id": "god_glimpse",
    "title": "神的一角",
    "summary": "艾瑟里昂終於決定說出下一個預言——不是說，是讓你親眼看。他要帶你走進遺火塔的白焰。（窺見神的一角・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": AETH, "min_level": 11, "requires": need("god_2_done"),
        "text": "艾瑟里昂站在白焰前，把手伸進了火裡：「預言……不能說。只能看。」他回頭看你，「白焰裡……有守門的東西。它們會考驗……想看神的人。你……要跟我來嗎？」",
    },
    "start_flags": ["god_glimpse"],
    "nodes": [
        {
            "id": "flame", "title": "在遺火塔的白焰裡通過守門的火",
            "text": "白焰吞沒了你。四周是無邊無際的白，兩團比太陽還亮的火焰站了起來，有手、有臉，臉上卻什麼表情也沒有。艾瑟里昂舉起灰燼色的權杖，站在你身邊。",
            "at": at_cell("silent_tomb", "lm_ember_tower"), "requires": need("god_glimpse"), "kind": "combat",
            "enemies": [["white_flame_warden", 1], ["white_flame_avatar", 1]], "allies": [AETH],
            "success": step("守門的火焰散成了光點，白色的世界裂開一道縫。縫的另一邊，是深不見底的黑。", ["god_inside"]),
            "fail": step("守門的火焰把你們燒得遍體鱗傷，卻在最後一刻退開了——它們只是要看你會不會逃。白色的世界裂開一道縫，縫的另一邊，是深不見底的黑。", ["god_inside"], [hp(-0.25)]),
        },
        {
            "id": "vision", "title": "看進晦暗之淵",
            "text": "黑暗的最深處，有一隻眼睛。它比山還大，正在慢慢地睜開。眼睛的四周，七道巨大的影子在翻身——像是七條龍，正從很長很長的睡眠裡醒來。",
            "at": at_cell("silent_tomb", "lm_ember_tower"), "requires": need("god_inside"), "kind": "check",
            "check": {"attr": "fai", "dc": 16},
            "success": step("你沒有移開視線。那隻眼睛看了你一眼——不是憤怒，也不是飢餓，而是一種很古老的疲倦。你聽見一個聲音：「燒盡，然後重鑄。」白焰把你推了回來。", ["god_seen"], [BLESSED]),
            "fail": step("你只看了一眼就跪了下去，腦子裡像被灌進了一整片夜空。艾瑟里昂把你拉了回來，白焰在你們身後合上。", ["god_seen"], [hp(-0.2)]),
        },
        {
            "id": "prophecy", "title": "決定預言的去處",
            "text": "回到遺火塔頂，艾瑟里昂的手在發抖：「當七龍醒來……晦暗之淵會睜開眼睛。萬物會燒盡……然後重鑄。」他看著你，「這個預言……會讓南境恐慌，也可能讓莉莎爾……做出不一樣的選擇。活人，你看見了。你說……該怎麼辦？」",
            "at": at_npc(AETH), "requires": need("god_seen"), "kind": "choice",
            "options": [
                {"label": "讓他把預言告訴莉莎爾", "success": done("艾瑟里昂點了點頭，在灰燼紙上寫下了預言，封進了一個黑木匣。「魔王……該知道。」三天後，血羽城堡的議會第一次為「七龍」開了一場閉門會議。", ["god_done", "god_told"], [aff(AETH, 20, "陪他看了神的一角"), rep(DEMON, 15), mem("在寂墓聖堂的白焰裡，和艾瑟里昂一起看見了晦暗之淵正在睜開的眼睛與七條甦醒的龍。預言送到了莉莎爾手上。", 3)])},
                {"label": "替他把預言封起來，等時機成熟", "success": done("艾瑟里昂把預言刻在一塊石板上，石板沉進了無聲長廊的最深處：「死者……會替我們保管。」他看著你，難得地笑了，「現在……知道這件事的活人，只有你。」", ["god_done", "god_sealed"], [aff(AETH, 25, "替他守住了預言"), mem("在寂墓聖堂的白焰裡看見了晦暗之淵的眼睛與七條甦醒的龍。你和艾瑟里昂把預言封進了無聲長廊。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 寂墓聖堂：莉菈的大冒險 ----------------
lila1 = {
    "id": "lila_travel_books",
    "title": "旅行書的收藏家",
    "summary": "無聲長廊的見習祭司莉菈偷偷收集人類商人帶來的旅行書。這個月的那一本，商隊遲遲沒有送到。（莉菈的大冒險・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": LILA, "min_level": 5,
        "text": "莉菈抱著一疊翻爛了的旅行書，小聲地說：「那、那個……灰港鎮來的商隊每個月會帶一本新的給我。這個月的是《晨光城的一百家麵包店》，可是商隊……被困在墓地外面了。大祭司不准我出去……你可以幫我嗎？」",
    },
    "start_flags": ["lila_start"],
    "nodes": [
        {
            "id": "caravan", "title": "在寂墓聖堂近郊替商隊趕走食屍鬼",
            "text": "墓地外的荒原路上，一輛篷車翻倒在路邊，商人們躲在車底下。幾隻佝僂的食屍鬼正在翻他們的貨，把書頁撕得滿天飛。",
            "at": outskirts("silent_tomb"), "requires": need("lila_start"), "kind": "combat",
            "enemies": [["grave_ghoul", 3]],
            "success": step("食屍鬼們逃回了墓地深處。商人從車底爬出來，在滿地的書頁裡翻了很久，終於找到一本封面被抓破的書：「《晨光城的一百家麵包店》……還好，還能看。」", ["lila_book"]),
            "fail": step("食屍鬼們叼著幾袋乾糧逃走了，沒有碰那本書。商人把它交給你：「《晨光城的一百家麵包店》。告訴那個小祭司，下個月我會多帶一本。」", ["lila_book"], [hp(-0.1)]),
        },
        {
            "id": "read", "title": "把旅行書交給莉菈",
            "text": "莉菈抱著那本書，眼睛亮得像要掉出星星：「一百家……麵包店……」她翻開第一頁，又抬頭看你，「你、你去過晨光城嗎？那裡的麵包，真的是熱的嗎？」",
            "at": at_npc(LILA), "requires": need("lila_book"), "kind": "choice",
            "options": [
                {"label": "陪她一起把書讀完", "success": done("你們坐在無聲長廊的石階上，一頁一頁地讀。讀到第四十七家的時候，莉菈睡著了，臉上還帶著笑。死者們今天出奇地安靜。", ["lila_1_done"], [aff(LILA, 15, "陪她讀旅行書"), mem("替寂墓聖堂的見習祭司莉菈送回了旅行書，陪她讀了一下午。")])},
                {"label": "告訴她你去過的地方", "success": done("你講了晨光城的麵包、萊茵堡的城牆、沿海渡口的海風。莉菈聽得忘了眨眼，最後小聲地說：「……我也想去。」她說完就捂住了嘴，像是說了什麼不能說的話。", ["lila_1_done", "lila_dream"], [aff(LILA, 20, "跟她講外面的世界"), mem("替寂墓聖堂的見習祭司莉菈送回了旅行書。她說，她也想去看看外面的世界。")])},
            ],
        },
    ],
    "rewards": [money(250), xp(400)],
}

lila2 = {
    "id": "lila_first_trip",
    "title": "第一次出門",
    "summary": "莉菈這輩子沒有離開過寂墓聖堂。她想去灰港鎮看海——一次就好，在大祭司發現之前回來。（莉菈的大冒險・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": LILA, "min_level": 8, "requires": need("lila_1_done"),
        "text": "莉菈把一張手畫的地圖塞給你，手在發抖：「灰港鎮……有海。書上說，海是會動的水，大得看不到另一邊。」她深吸一口氣，「我想去看。一次就好。大祭司這幾天在閉關……你可以帶我去嗎？」",
    },
    "start_flags": ["lila_trip"],
    "nodes": [
        {
            "id": "sneak", "title": "帶莉菈溜出寂墓聖堂的城門",
            "text": "城門口站著兩個守夜的祭司。莉菈縮在你的斗篷裡，小聲地說：「他們……聽得見死者，也聽得見我。走路要很輕很輕。」",
            "at": at_cell("silent_tomb", "gate"), "requires": need("lila_trip"), "kind": "check",
            "check": {"attr": "dex", "dc": 15},
            "success": step("你們從祭司的背後溜了出去。走出很遠，莉菈才敢回頭看一眼——寂墓聖堂在荒原上，小得像一塊墓碑。她笑了，笑得有點想哭。", ["lila_out"], [aff(LILA, 5, "帶她溜了出去")]),
            "fail": step("守夜的祭司看見了你們。他看了莉菈很久，然後轉過身去，對著牆壁說：「……我什麼都沒看見。大祭司說過，回來就好。」", ["lila_out"]),
        },
        {
            "id": "hunters", "title": "在灰港鎮近郊擋下教廷的獵魔人",
            "text": "灰港鎮外的荒原路上，兩個披著白斗篷的人類攔住了你們，斗篷上繡著聖環。「灰燼修會的小祭司？」他們拔出了刻著禱文的長劍，「能聽見死者的魔族——教廷會付好價錢。」莉菈躲到了你身後。",
            "at": outskirts("ashport"), "requires": need("lila_out"), "kind": "combat",
            "enemies": [["demon_hunter", 2]],
            "success": step("獵魔人倒下了。莉菈從你身後探出頭，看著他們斗篷上的聖環：「……人類的書上，沒有寫這個。」", ["lila_safe"]),
            "fail": step("獵魔人把你們逼退了，卻在灰港鎮巡邏的半魔傭兵趕來時逃走了——在灰港鎮，沒有人喜歡教廷。莉菈緊緊抓著你的手。", ["lila_safe"], [hp(-0.15)]),
        },
        {
            "id": "sea", "title": "在灰港鎮的灰帆碼頭看海",
            "text": "灰帆碼頭的盡頭，海是灰色的，被黑灰與霧籠罩著，一點也不像書上的藍。莉菈站在碼頭邊，很久很久沒有說話。一個抽著菸斗的老船長在旁邊看著你們。",
            "at": at_cell("ashport", "lm_greysail_pier"), "requires": need("lila_safe"), "kind": "choice",
            "options": [
                {"label": "陪她看到天黑", "success": done("天黑的時候，霧散了一點，遠處的海面上有一點點月光。莉菈小聲地說：「……書上說得不對。海比書上寫的還要大。」回程的路上，她一直牽著你的衣角。", ["lila_2_done"], [aff(LILA, 20, "陪她看了第一次的海"), mem("帶寂墓聖堂的莉菈溜出去，到灰港鎮看了她這輩子第一次的海。", 3)])},
                {"label": "請老船長講海上的故事", "success": done("哈根船長講了永不靠岸的船、會唱歌的鯨魚、還有海的另一邊。莉菈聽得入迷，最後把一本旅行書送給了船長：「換你的故事。」船長大笑：「成交，小祭司！」", ["lila_2_done", "lila_hagen"], [aff(LILA, 15, "帶她聽海上的故事"), aff(HAGEN, 10, "替他找到了一個聽眾"), mem("帶寂墓聖堂的莉菈到灰港鎮看海，聽哈根船長講了海上的故事。", 3)])},
            ],
        },
    ],
    "rewards": [money(500), xp(900)],
}

lila3 = {
    "id": "lila_living_world",
    "title": "生者的世界",
    "summary": "大祭司艾瑟里昂要正式立莉菈為繼承人。繼承的儀式要在無聲長廊最深處通過守墓靈的考驗——之後，她就再也不能離開寂墓聖堂。（莉菈的大冒險・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": LILA, "min_level": 11, "requires": need("lila_2_done"),
        "text": "莉菈穿著一身沉重的灰燼色祭袍，看起來比平常更小了：「大祭司說……下個新月，我就是繼承人了。守墓靈會考驗我，通過了……我就要一輩子留在這裡，聽死者說話。」她抬頭看你，「你……可以陪我走到長廊的最深處嗎？」",
    },
    "start_flags": ["lila_rite"],
    "nodes": [
        {
            "id": "wardens", "title": "在無聲長廊的最深處面對守墓靈",
            "text": "長廊的最深處，兩個披著石棺蓋的巨大靈體從牆裡走了出來，手裡的燈籠燒著藍色的火。它們低頭看著莉菈：「聽見死者的祭司。妳願意……永遠留下嗎？」莉菈握緊了手裡的念珠，站到了你身邊。",
            "at": at_cell("silent_tomb", "lm_silent_corridor"), "requires": need("lila_rite"), "kind": "combat",
            "enemies": [["tomb_warden_elder", 1], ["tomb_warden", 1]], "allies": [LILA],
            "success": step("守墓靈的燈籠熄滅了。它們沒有消失，只是退回了牆裡，低聲說：「祭司……妳還沒有回答。」", ["lila_tested"]),
            "fail": step("守墓靈把你們逼到了長廊的盡頭，卻停了下來——它們要的不是勝負，是答案。「祭司……妳還沒有回答。」", ["lila_tested"], [hp(-0.2)]),
        },
        {
            "id": "answer", "title": "陪莉菈回答守墓靈",
            "text": "莉菈站在長廊的盡頭，背後是死者的低語，面前是你。她的聲音在發抖：「我喜歡死者，他們很溫柔。可是……我也想看一百家麵包店。」她看著你，「你說……我該怎麼回答？」",
            "at": at_npc(LILA), "requires": need("lila_tested"), "kind": "choice",
            "options": [
                {"label": "「當祭司，也可以去旅行」", "success": done("莉菈對著守墓靈說：「我會留下來——但每年，我要出去一次。死者的故事，我會帶給活人聽；活人的故事，我會帶回來給死者聽。」長廊安靜了很久，然後響起了笑聲——死者的笑聲。艾瑟里昂從陰影裡走出來，點了點頭：「……這樣的繼承人，也不錯。」", ["lila_done", "lila_priest"], [aff(LILA, 25, "替她找到了兩全的答案"), aff(AETH, 10, "替他找到了繼承人"), mem("陪寂墓聖堂的莉菈通過了繼承人的考驗。她成了大祭司的繼承人，每年可以出去旅行一次。", 3)])},
                {"label": "「跟我們走吧」", "success": done("莉菈對著守墓靈深深地鞠了一躬：「對不起。我想先去看看生者的世界。」守墓靈沉默了很久，讓開了路。艾瑟里昂站在長廊的入口，看著她走過來，只說了一句：「……回來的時候，記得講給死者聽。」莉菈抱著一疊旅行書，跟上了你的腳步。", ["lila_done", "lila_travel"], [aff(LILA, 30, "帶她去看生者的世界"), mem("寂墓聖堂的莉菈放下了繼承人的位置，跟你一起去看生者的世界。", 3), {"type": "companion", "npc": LILA, "mode": "voluntary"}])},
            ],
        },
    ],
    "rewards": [money(1200), xp(1800)],
}

# ---------------- 腐沼村：魔族普通人的生活 ----------------
rot1 = {
    "id": "rot_herb_errand",
    "title": "藥婆的跑腿",
    "summary": "腐沼村的莫格婆婆刻薄又愛罵人，卻替窮人免費治病。她的腰閃了，需要一個人替她下沼地採藥。（魔族普通人的生活・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": MORG, "min_level": 5,
        "text": "莫格婆婆扶著腰罵了三分鐘的天氣，然後把一個破竹簍丟給你：「看什麼看？沒看過老人家閃到腰？去藥沼採紫斑苔和夜息草，別採錯了——採錯了就是毒藥，毒死的是我的病人，不是你。」",
    },
    "start_flags": ["rot_start"],
    "nodes": [
        {
            "id": "herbs", "title": "在腐沼村的變異藥沼採藥",
            "text": "藥沼裡的植物長得一模一樣，又全都不一樣：有的會動，有的會冒泡，有的在你靠近時把葉子捲了起來。一團半透明的果凍狀東西從泥裡冒了出來：「你在採藥嗎？普露露也會！普露露教你！」",
            "at": at_cell("rotmarsh", "lm_mire_herb_beds"), "requires": need("rot_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("在普露露的「幫忙」下（她吃掉了一半的樣本），你採滿了一簍紫斑苔和夜息草，一株都沒錯。普露露很得意：「普露露是好老師！」", ["rot_herbs"], [aff(PRU, 5, "陪她採藥")]),
            "fail": step("你採錯了一株，手上起了一片紫色的疹子。普露露幫你把毒吸了出來——用整個身體包住你的手。「好了！」她說，「普露露吃毒長大的！」", ["rot_herbs"], [hp(-0.1), aff(PRU, 5, "被她「治療」了")]),
        },
        {
            "id": "mutants", "title": "在腐沼村近郊趕走沼地的變異獸",
            "text": "回村的路上，幾頭渾身長著瘤的沼地變異獸從毒霧裡衝了出來——它們聞到了你簍子裡夜息草的味道，那是它們最愛吃的東西。",
            "at": outskirts("rotmarsh"), "requires": need("rot_herbs"), "kind": "combat",
            "enemies": [["mire_mutant", 3]],
            "success": step("變異獸們逃回了毒霧裡。你的竹簍完好無損，只是沾了一點泥。", ["rot_cleared"]),
            "fail": step("變異獸們搶走了半簍夜息草才逃走。剩下的，應該還夠用吧。", ["rot_cleared"], [hp(-0.1)]),
        },
        {
            "id": "deliver", "title": "把藥草交給莫格婆婆",
            "text": "莫格婆婆把藥草一株一株地檢查過，罵了你兩次手太粗，然後把一袋銅幣推過來：「拿去。跑腿費。」門外已經排了五個病人，最前面的是一個抱著發燒孩子的半魔母親。",
            "at": at_npc(MORG), "requires": need("rot_cleared"), "kind": "choice",
            "options": [
                {"label": "把錢推回去，幫她煎藥", "success": done("莫格婆婆罵你是笨蛋，罵了整整一個下午，一邊罵一邊教你怎麼煎藥。傍晚，那個孩子退燒了。她把一包曬乾的紫斑苔塞給你：「……拿去。受傷的時候嚼。別說是我給的。」", ["rot_1_done", "rot_helped"], [aff(MORG, 15, "免費幫她煎藥"), mem("在腐沼村替莫格婆婆採藥、煎藥，一個發燒的半魔孩子退燒了。")])},
                {"label": "收下跑腿費", "success": done("「哼，至少你誠實。」莫格婆婆揮揮手趕你走，「下次再來，我給你漲價。」她轉身去看病人，背影比你來的時候直了一點。", ["rot_1_done"], [aff(MORG, 5, "替她採了藥"), money(50)])},
            ],
        },
    ],
    "rewards": [money(250), xp(400)],
}

rot2 = {
    "id": "rot_tax_collectors",
    "title": "氏族的收稅官",
    "summary": "一群自稱「氏族收稅官」的魔族來到腐沼村，要被放逐的村民交「回歸稅」。不交的，就把房子燒了。（魔族普通人的生活・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": MORG, "min_level": 8, "requires": need("rot_1_done"),
        "text": "莫格婆婆難得地沒有罵人，只是坐在門口抽著菸斗：「收稅的又來了。說被放逐的人要交『回歸稅』，交了才能回氏族——放屁，誰想回去？」她把菸斗敲了敲，「上個月他們燒了老漢斯的房子。這個月……輪到我了。」",
    },
    "start_flags": ["rot_tax"],
    "nodes": [
        {
            "id": "nick", "title": "向腐沼村的尼克打聽收稅官的底細",
            "text": "半魔小賊尼克蹲在酒館的屋頂上，嘴裡叼著一根草：「收稅官？我知道他們的底細。不過嘛……」他搓了搓手指，「情報這種東西，是要收錢的。」",
            "at": at_npc(NICK), "requires": need("rot_tax"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("你說服尼克這是替村子做事，他嘆了口氣：「好啦好啦。他們根本不是議會派來的——是血羽城堡外的一群混混，收的錢全進自己口袋。我親眼看到他們在灰港鎮換酒喝。」", ["rot_fake"], [aff(NICK, 10, "說服他替村子做事")]),
            "fail": step("尼克收了你一筆錢，才肯開口：「他們根本不是議會派來的，是混混。收的錢全進自己口袋。」他把錢收進懷裡，「……別跟莫格婆婆說我收你錢。」", ["rot_fake"], [money(-100)]),
        },
        {
            "id": "collectors", "title": "在腐沼村的城門擋下收稅官",
            "text": "村口的高腳橋上，幾個穿著偷來的議會制服的魔族舉著火把：「交稅！不交就燒！」村民們躲在屋子裡，從窗縫往外看。",
            "at": at_cell("rotmarsh", "gate"), "requires": need("rot_fake"), "kind": "combat",
            "enemies": [["clan_taxman", 2]],
            "success": step("假收稅官們丟下火把逃進了沼地。窗縫後面，一張張臉慢慢地探了出來，然後是第一聲歡呼。", ["rot_driven"]),
            "fail": step("假收稅官們燒了一座空倉庫才逃走。村民們提著水桶衝出來救火——這是他們第一次一起衝出來。", ["rot_driven"], [hp(-0.15)]),
        },
        {
            "id": "after", "title": "和莫格婆婆商量以後怎麼辦",
            "text": "莫格婆婆看著村口燒黑的橋柱：「這次趕走了，下次呢？混混不會只有這一批。」村民們圍在她身邊，等著有人說點什麼。",
            "at": at_npc(MORG), "requires": need("rot_driven"), "kind": "choice",
            "options": [
                {"label": "替村子寫陳情書給議會", "success": done("你寫了陳情書，莫格婆婆在上面蓋了她的手印——一個沾著藥汁的綠手印。兩個月後，議會派了一隊真正的巡邏兵來到腐沼村，還帶來了一封總管薇洛妮卡的親筆信：「抱歉，來晚了。」", ["rot_2_done", "rot_petition"], [aff(MORG, 15, "替村子寫了陳情書"), rep(DEMON, 5), mem("替腐沼村趕走了假冒的收稅官，寫陳情書給魔族議會，議會派了巡邏兵來。")])},
                {"label": "教村民自己組巡邏隊", "success": done("你花了三天教村民排班、敲鐘、用魚叉。尼克自告奮勇當隊長——他說是因為屋頂上看得最遠。莫格婆婆罵他們是一群笨蛋，然後每天晚上給巡邏隊煮湯。", ["rot_2_done", "rot_watch"], [aff(MORG, 15, "教村民保護自己"), aff(NICK, 10, "讓他當了隊長"), mem("替腐沼村趕走了假冒的收稅官，教村民組了自己的巡邏隊，尼克當了隊長。")])},
            ],
        },
    ],
    "rewards": [money(500), xp(900)],
}

rot3 = {
    "id": "rot_harvest_festival",
    "title": "沼地的豐收祭",
    "summary": "腐沼村一年一度的豐收祭——慶祝毒霧又讓大家活過了一年。今年，沼地深處有什麼東西被祭典的香氣吵醒了。（魔族普通人的生活・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": MORG, "min_level": 11, "requires": need("rot_2_done"),
        "text": "莫格婆婆把一串曬乾的蘑菇掛在你脖子上：「豐收祭。慶祝毒霧又沒把我們毒死。」她哼了一聲，「普露露吵著要你來，尼克說要你來，連那群笨蛋村民都說要你來。所以……你來不來？」",
    },
    "start_flags": ["rot_fest"],
    "nodes": [
        {
            "id": "prep", "title": "在腐沼村的酒館幫忙準備祭典",
            "text": "酒館裡亂成一團：普露露想用自己當果凍上桌，尼克把燈籠掛反了，老漢斯在吵他的新房子為什麼比別人小。莫格婆婆站在中間罵人，罵得很開心。",
            "at": at_cell("rotmarsh", "tavern"), "requires": need("rot_fest"), "kind": "check",
            "check": {"attr": "cha", "dc": 16},
            "success": step("你把每個人都安排得剛剛好：普露露負責試吃，尼克負責爬高，老漢斯負責抱怨。祭典的燈籠一盞盞亮起，倒映在沼地的泥水裡，竟然有點漂亮。", ["rot_ready"]),
            "fail": step("你越幫越亂，最後普露露還是上了桌——她說她是「甜點」。村民們笑得東倒西歪，祭典的燈籠一盞盞亮了起來。", ["rot_ready"]),
        },
        {
            "id": "wyrm", "title": "在腐沼村近郊擋下被吵醒的沼澤巨蟲",
            "text": "祭典的鼓聲剛響，沼地深處就傳來了更大的聲音。兩條比房子還長的巨蟲從泥裡拱了出來，滿嘴的牙上掛著水草，朝燈火通明的村子爬過來。",
            "at": outskirts("rotmarsh"), "requires": need("rot_ready"), "kind": "combat",
            "enemies": [["mire_wyrm_mother", 1], ["mire_wyrm", 1]],
            "success": step("巨蟲們沉回了沼地深處，泥水上冒了最後幾個泡泡。村子那邊，鼓聲重新響了起來。", ["rot_saved"]),
            "fail": step("巨蟲們撞壞了村口的高腳橋才沉回沼地。村民們舉著魚叉衝了出來——尼克的巡邏隊。他們說，祭典照辦。", ["rot_saved"], [hp(-0.2)]),
        },
        {
            "id": "festival", "title": "參加沼地的豐收祭",
            "text": "祭典一直辦到天亮。村民們圍著營火跳一種很醜的舞，普露露學得最快，尼克跳得最差。莫格婆婆坐在角落裡，難得地沒有罵人，只是看著。",
            "at": at_npc(MORG), "requires": need("rot_saved"), "kind": "choice",
            "options": [
                {"label": "拉莫格婆婆一起跳舞", "success": done("莫格婆婆罵了你十幾句，最後還是被你拉起來了。她跳得比誰都好——年輕的時候，她是氏族裡最會跳舞的人。天亮的時候，她小聲地說：「……被放逐，也不全是壞事。」", ["rot_done", "rot_danced"], [aff(MORG, 25, "拉她一起跳舞"), aff(PRU, 10, "陪她過了第一個豐收祭"), rep(DEMON, 5), mem("在腐沼村的豐收祭上，拉著莫格婆婆跳了一整夜的舞。", 3)])},
                {"label": "陪尼克聊他想去的人類城市", "success": done("尼克坐在屋頂上，說他想去萊茵堡、想去晨光城、想去一個沒人在乎你有沒有角的地方。你告訴他，那樣的地方不太多——但腐沼村就是一個。他想了很久，笑了：「……也是。那我先當好巡邏隊長再說。」", ["rot_done", "rot_nick_stays"], [aff(NICK, 20, "陪他聊了一整夜"), aff(MORG, 15, "替村子守住了祭典"), mem("在腐沼村的豐收祭上，陪尼克聊了一整夜。他決定先留在腐沼村。", 3)])},
            ],
        },
    ],
    "rewards": [money(1200), xp(1800)],
}

# ---------------- 灰港鎮：人與魔 ----------------
hm1 = {
    "id": "hm_greyport_contract",
    "title": "灰港的契約",
    "summary": "流亡貴族塞巴斯欽替一個人類商人和一個魔族商人牽線，要在灰港鎮簽下第一份跨種族的長期契約。有人不想讓它簽成。（人與魔・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": SEB, "min_level": 5,
        "text": "塞巴斯欽優雅地行了一個帝國貴族的禮：「人類的冒險者，真是稀客。我有一筆小生意——沿海渡口的布商，想跟熔火堡壘的鐵匠簽一份十年的契約。」他笑了笑，「十年。在灰港鎮，這比婚約還稀奇。我需要一個兩邊都不會先拔刀的人。」",
    },
    "start_flags": ["hm_start"],
    "nodes": [
        {
            "id": "meet", "title": "在灰港鎮的酒館替兩個商人緩和氣氛",
            "text": "酒館的包廂裡，人類布商緊緊抱著自己的錢袋，魔族鐵匠的角上掛著兩枚金環，兩個人都不肯先坐下。桌上的酒已經涼了。",
            "at": at_cell("ashport", "tavern"), "requires": need("hm_start"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": step("你說了一個人類和魔族都會笑的笑話——關於收稅官的。兩個人都笑了，然後都坐了下來。塞巴斯欽在桌下朝你比了個大拇指。", ["hm_met"]),
            "fail": step("你的笑話冷了場，可兩個人都被你的尷尬逗笑了。他們坐了下來，塞巴斯欽在桌下嘆了口氣。", ["hm_met"]),
        },
        {
            "id": "robbers", "title": "在灰港鎮近郊擋下劫匪",
            "text": "簽約的前一晚，人類布商的貨車在鎮外被攔了下來。幾個蒙著臉的劫匪——有人類，也有魔族——舉著刀：「把貨留下。這筆生意，有人出錢讓它做不成。」",
            "at": outskirts("ashport"), "requires": need("hm_met"), "kind": "combat",
            "enemies": [["ashport_robber", 3]],
            "success": step("劫匪們丟下刀逃了。其中一個掉了一枚錢幣——教廷的聖環金幣。塞巴斯欽撿起來看了看，笑得有點冷。", ["hm_escort"]),
            "fail": step("劫匪們搶走了兩匹布才逃走，掉了一枚教廷的聖環金幣。塞巴斯欽撿起來，說：「兩匹布，換這個情報。划算。」", ["hm_escort"], [hp(-0.1)]),
        },
        {
            "id": "deal", "title": "替兩個商人訂下契約的條件",
            "text": "契約攤在桌上，只差最後一條：違約了怎麼辦。人類布商想交給沿海渡口的法庭，魔族鐵匠想交給血羽城堡的議會。兩個人都看著你。",
            "at": at_npc(SEB), "requires": need("hm_escort"), "kind": "choice",
            "options": [
                {"label": "「交給灰港鎮的規矩」", "success": done("你提議由深淵交易所的維斯帕作保——灰港鎮無王無律，她的規矩就是律法。兩個人想了想，都點了頭。塞巴斯欽舉杯：「敬第一份十年的契約。」", ["hm_1_done", "hm_fair"], [aff(SEB, 15, "替他談成了生意"), mem("在灰港鎮替人類布商和魔族鐵匠談成了一份十年的契約，由深淵交易所作保。")], counters={"demon_stance": 1})},
                {"label": "「交給人類的法庭」", "success": done("人類布商笑開了花，魔族鐵匠臉色鐵青，但還是簽了。走出酒館時，他低聲說：「人類的法庭……我們走著瞧。」塞巴斯欽搖了搖頭：「簽成了，但結了怨。」", ["hm_1_done", "hm_unfair"], [aff(SEB, 5, "替他談成了生意"), mem("在灰港鎮替人類布商談成了一份對他有利的契約，魔族鐵匠很不高興。")], counters={"demon_stance": -1})},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

hm2 = {
    "id": "hm_ghost_ship",
    "title": "永不靠岸的船",
    "summary": "哈根船長說，有一艘永不靠岸的船，載著被放逐的領主靈魂，他的大副也在船上。今晚，船靠近了灰帆碼頭。（人與魔・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": HAGEN, "min_level": 8, "requires": need("hm_1_done"),
        "text": "哈根船長把菸斗咬得喀喀響：「塞巴斯欽說你是個靠得住的人。好，聽著——今晚是起霧的大潮，那艘船會靠近碼頭。二十年了，我每次都只看得到船影。」他的手在發抖，「我的大副在船上。我想跟他說一句話。」",
    },
    "start_flags": ["hm_ship"],
    "nodes": [
        {
            "id": "pier", "title": "在灰港鎮的灰帆碼頭找到永不靠岸的船",
            "text": "午夜，霧從海上湧了過來。碼頭的盡頭，一艘破爛的黑帆船慢慢地浮現，沒有聲音，沒有燈火。船舷邊站著一排模糊的人影——有人類，也有魔族。",
            "at": at_cell("ashport", "lm_greysail_pier"), "requires": need("hm_ship"), "kind": "check",
            "check": {"attr": "fai", "dc": 15},
            "success": step("你喊出了大副的名字，船停了下來。一條灰白的跳板從船舷垂到了碼頭上。哈根船長的菸斗掉進了海裡。", ["hm_board"]),
            "fail": step("船沒有停，可哈根船長跳上了一條小艇，你只好跟著他划了過去。你們爬上了船舷。", ["hm_board"], [hp(-0.1)]),
        },
        {
            "id": "sailors", "title": "在灰港鎮近郊的海上擋下幽靈船的水手",
            "text": "甲板上，幾個渾身滴著海水的水手轉過身來，眼窩裡是兩團綠火：「活人……不能上這艘船。」他們舉起了生鏽的彎刀。",
            "at": outskirts("ashport"), "requires": need("hm_board"), "kind": "combat",
            "enemies": [["ghost_sailor", 2]],
            "success": step("幽靈水手們散成了霧。船艙的門打開了，兩個身影走了出來：一個穿著人類的水手服，一個穿著魔族領主的長袍。", ["hm_souls"]),
            "fail": step("幽靈水手們把你們逼到了船尾，卻突然停了手——船艙裡有人喊了一聲「夠了」。兩個身影走了出來：一個穿著人類的水手服，一個穿著魔族領主的長袍。", ["hm_souls"], [hp(-0.15)]),
        },
        {
            "id": "souls", "title": "聽兩個靈魂的遺言",
            "text": "大副對著哈根笑了笑，什麼也沒說。魔族領主卻開口了：「我叫阿斯卡隆。三百年前，我在議會上說要和人類和解——他們把我的靈魂放逐到了這艘船上。」他看著你，「人類，船快要開了。你只來得及帶走一樣東西。」",
            "at": at_npc(HAGEN), "requires": need("hm_souls"), "kind": "choice",
            "options": [
                {"label": "帶回阿斯卡隆的和解書", "success": done("阿斯卡隆把一卷被海水泡皺的羊皮紙交給你：「三百年前沒人要讀。也許現在有人會。」船消失在霧裡。哈根船長看著空蕩蕩的海面，很久，說：「……他笑了。二十年，夠了。」", ["hm_2_done", "hm_scroll"], [aff(HAGEN, 15, "陪他見到了大副"), rep(DEMON, 5), mem("在灰港鎮登上了永不靠岸的船，帶回了三百年前主張人魔和解的魔族領主阿斯卡隆的和解書。", 3)], counters={"demon_stance": 1})},
                {"label": "替哈根帶回大副的遺物", "success": done("大副把一枚生鏽的船錨徽章塞進哈根的手裡。船消失在霧裡。哈根船長握著徽章，哭得像個孩子。阿斯卡隆的話，留在了霧裡。", ["hm_2_done", "hm_badge"], [aff(HAGEN, 25, "替他帶回了大副的遺物"), mem("在灰港鎮登上了永不靠岸的船，替哈根船長帶回了大副的遺物。", 3)])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

hm3 = {
    "id": "hm_abyss_treaty",
    "title": "深淵交易所的和約",
    "summary": "帝國的密使與魔族議會的代表，要在深淵交易所秘密簽下第一份通商和約，由維斯帕作保。教廷的聖戰艦隊已經在港外下錨了。（人與魔・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": VESPA, "min_level": 11, "requires": need("hm_2_done"),
        "text": "維斯帕替你倒了一杯深紅色的酒：「塞巴斯欽牽的線：帝國的密使，議會的代表，今晚在我的交易所簽一份通商和約。」她的笑容優雅得可怕，「教廷的人也來了——三艘船，停在港外。我的規矩是，在交易所裡簽的契約，誰也不能毀。替我守住它。」",
    },
    "start_flags": ["hm_treaty"],
    "nodes": [
        {
            "id": "marines", "title": "在灰港鎮近郊擋下聖戰艦隊的陸戰隊",
            "text": "港外的礁石灘上，一隊穿著白甲的陸戰隊正從小艇上跳下來，盾牌上的聖環在月光下發亮。帶隊的騎士高喊：「異端的和約，必須在簽字前燒掉！」",
            "at": outskirts("ashport"), "requires": need("hm_treaty"), "kind": "combat",
            "enemies": [["crusade_marine", 3]],
            "success": step("陸戰隊退回了小艇，倉皇划向港外的船。礁石灘上留下了一面被踩爛的聖環旗。", ["hm_guarded"]),
            "fail": step("陸戰隊把你們逼退到了碼頭，灰港鎮的半魔傭兵們突然從四面八方湧了出來——維斯帕付了錢。陸戰隊退回了海上。", ["hm_guarded"], [hp(-0.2)]),
        },
        {
            "id": "sebastian", "title": "問塞巴斯欽為什麼被放逐",
            "text": "簽約前，塞巴斯欽站在交易所的陽臺上抽菸，難得地沒有笑。帝國的密使經過他身邊時，連看都沒看他一眼。",
            "at": at_npc(SEB), "requires": need("hm_guarded"), "kind": "check",
            "check": {"attr": "int", "dc": 16},
            "success": step("你拼湊出了真相：十年前，塞巴斯欽在帝國的御前會議上主張和魔族通商，被宰相誣陷為叛國。今晚的和約，是他十年前寫的草稿。他看著你，苦笑：「被你猜到了。別告訴密使——他會拒絕簽一份叛徒寫的和約。」", ["hm_truth"], [aff(SEB, 10, "猜到了他的過去")]),
            "fail": step("塞巴斯欽什麼也沒說，只是把一份泛黃的草稿遞給你看——和今晚的和約一字不差，落款是十年前，簽名是他。「別告訴密使。」他說。", ["hm_truth"]),
        },
        {
            "id": "pact", "title": "在深淵交易所見證和約",
            "text": "交易所的大廳裡，帝國的密使和議會的代表面對面坐著，和約攤在中間。維斯帕看著你：「最後一個見證人的位置，是你的。你可以簽——也可以把它賣給港外那三艘船。教廷出的價錢，我替你打聽過了。」",
            "at": at_npc(VESPA), "requires": need("hm_truth"), "kind": "choice",
            "options": [
                {"label": "以灰港鎮的規矩簽下見證", "success": done("你在和約的最下面簽下了名字。維斯帕把它封進了交易所的深淵保險庫：「從今天起，誰毀了它，就是跟我作對。」陽臺上，塞巴斯欽背對著大廳，肩膀在微微發抖。", ["hm_done", "hm_pact"], [aff(VESPA, 20, "守住了交易所的規矩"), aff(SEB, 25, "替他完成了十年前的和約"), rep(DEMON, 15), mem("在灰港鎮的深淵交易所見證了帝國與魔族議會的第一份通商和約。那是流亡貴族塞巴斯欽十年前寫的草稿。", 3)], counters={"human_stance": 1, "demon_stance": 1})},
                {"label": "把和約的內容賣給教廷", "success": done("教廷的人付了一大筆錢。三天後，帝國的密使在回程的船上被「海盜」擊沉，和約成了廢紙。維斯帕沒有說什麼，只是在帳本上劃掉了你的名字：「在灰港鎮，生意就是生意。但我記住你了。」", ["hm_done", "hm_sold"], [aff(VESPA, -20, "壞了交易所的規矩"), aff(SEB, -30, "賣掉了他的和約"), money(800), mem("在灰港鎮把帝國與魔族議會的通商和約賣給了教廷，和約成了廢紙。", 3)], counters={"human_stance": -1, "demon_stance": -1})},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

BATCH9 = [law1, law2, law3, trl1, trl2, trl3, god1, god2, god3, lila1, lila2, lila3, rot1, rot2, rot3, hm1, hm2, hm3]
