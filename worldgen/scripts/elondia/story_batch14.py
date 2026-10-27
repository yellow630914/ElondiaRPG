"""第十四批特殊任務（7 條地下城線，地下城全部完成）：古樹森林的月影根穴、荊棘迴廊、翠影空洞；東海的潮隕洞窟、骷髏潮島；西部荒野的回音峽谷、流沙聖殿。戰鬥都用各層原本的怪物，最後一戰是底層層主（無法溝通；歷史之龍阿契隆讓這些地方反覆重演最深刻的過去，所以層主打倒之後會重新出現）。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need
from story_batch7 import done, step

TOREN, EVENNA, FENN, OCT, LIAN, SEPH = 'npc_toren_bowyer', 'npc_evenna_starword', 'npc_fenn_apprentice', 'npc_octavia_mossvoice', 'npc_liandra_spring', 'npc_seph_mistveil'
MIO, TOMA, SHION, RENO, CARLOS = 'npc_coral_miko', 'npc_toma_pearl', 'npc_shion_envoy', 'npc_reno_deeptide', 'npc_carlos_blacksail'
SAFF, TALI, GRAY = 'npc_saff_nightclaw', 'npc_tali_liaison', 'npc_gray_sandkeep'
ELF, SEASONS, TIDES, TRIBES = 'elf_court', 'four_seasons', 'seven_tides', 'wild_tribes'
BLESSED = {"type": "condition", "target": "pc", "condition": "blessed", "add": True}
ECHO = '半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。'


def any_flag(*flags):
    return {"flags_any": list(flags)}


# ---------------- 月影根穴 ----------------
msr1 = {
    "id": "msr_stolen_bows",
    "title": "根穴裡的弓聲",
    "summary": "銀月城根界的弓匠托倫，有一批長弓被偷了。這幾夜，王都底下的月影根穴裡傳出了弓弦的聲音——他認得，那是他的弓。（月影根穴・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": TOREN, "min_level": 5,
        "text": "托倫把一根斷掉的弓弦摔在工作台上：「我的弓只賣給配得上的人。」他瞪著你，「現在，有人拿著我的弓，在王都底下射東西。墮落的精靈——你知道那是什麼嗎？碰過月之碎片、瘋掉的精靈。」他咬著牙，「把我的弓拿回來。人類的弓，我才不在乎。」",
    },
    "start_flags": ["msr_start"],
    "nodes": [
        {
            "id": "path", "title": "在銀月城的情報商打聽根穴的秘徑",
            "text": "銀月城的情報商是個戴兜帽的暮影精靈：「根穴的入口在王都內部，秘徑。」他壓低聲音，「墮落的精靈不是怪物——他們曾經是王庭的守根人。碰了月之碎片之後，就再也不認得自己了。」",
            "at": at_cell("silvermoon", "informant"), "requires": need("msr_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你從情報商那裡拿到了秘徑的地圖，還有一句話：「墮落的精靈怕月光。中層有一道裂縫，月光照得進去。」", ["msr_path"]),
            "fail": step("情報商收了一筆錢，才把秘徑的地圖賣給你。", ["msr_path"], [money(-80)]),
        },
        {
            "id": "middle", "title": "在月影根穴的中層搶回托倫的長弓",
            "text": "中層的根系迷宮裡，生物螢光一明一暗。兩個墮落精靈弓手拉著托倫的長弓，箭頭上閃著月蝕的黑光；一個月蝕亡靈在他們身後飄著。",
            "at": at_dun("moonshadow_roots", "middle"), "requires": need("msr_path"), "kind": "combat",
            "enemies": [["moon_wraith", 1], ["fallen_elf_archer", 2]],
            "success": step("弓手們倒下了。你撿起托倫的長弓，弓身上刻著他的名字——還有一行很小的、新刻上去的字，是古精靈文：「還給我們月光。」", ["msr_bows"]),
            "fail": step("你們被箭雨逼退了，可在撤退時，一把長弓從墮落精靈的手裡掉了下來。弓身上刻著一行新的字：「還給我們月光。」", ["msr_bows"], [hp(-0.15)]),
        },
        {
            "id": "return", "title": "把長弓還給托倫",
            "text": "托倫翻來覆去地看著那行字，臉色變了：「……墮落的精靈，還會寫字？」他沉默了很久，「他們以前是守根人。我的祖父，就是守根人。」",
            "at": at_npc(TOREN), "requires": need("msr_bows"), "kind": "choice",
            "options": [
                {"label": "「他們也許還記得一點自己」", "success": done("托倫把長弓掛回了牆上，沒有再罵人類：「如果他們還記得……也許還能救。」他看著你，「星月之環的艾溫娜在研究月之碎片。去找她。」", ["msr_1_done", "msr_hope"], [aff(TOREN, 15, "替他找回了弓"), mem("從月影根穴的中層搶回了弓匠托倫的長弓。墮落的精靈在弓上刻了一行字：「還給我們月光。」")])},
                {"label": "「他們已經不是精靈了」", "success": done("托倫點點頭，把那行字用刀削掉了：「我知道。」他把一把小弓塞給你，「拿著。人類的手，用這個剛好。」", ["msr_1_done"], [aff(TOREN, 10, "替他找回了弓"), mem("從月影根穴的中層搶回了弓匠托倫的長弓。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

msr2 = {
    "id": "msr_shard_avatar",
    "title": "月之碎片的化身",
    "summary": "星術師艾溫娜說，月影根穴封印著一塊「月之碎片」——能讓森林再生，也能讓它毀滅。碎片的化身在深層游蕩，最近它的光變強了。（月影根穴・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": EVENNA, "min_level": 8, "requires": need("msr_1_done"),
        "text": "艾溫娜把一張星圖攤開，圖上的月亮被畫成了兩半：「千年前，月亮掉下來一小塊，精靈把它封在了王都底下。」她的手指在發抖，「它的光最近變強了——墮落的精靈也變多了。我需要知道，碎片在做什麼。」",
    },
    "start_flags": ["msr_shard"],
    "nodes": [
        {
            "id": "chart", "title": "陪艾溫娜算月之碎片的光",
            "text": "艾溫娜的觀星儀對著地面——不是天空。「月之碎片的光，會從樹根裡透出來。」她說，「跟著光走，就知道它在哪裡。」",
            "at": at_npc(EVENNA), "requires": need("msr_shard"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你們算出來了：碎片的光每到滿月就變強一次，而且一次比一次強——它在甦醒。光最強的地方，在根穴的深層。", ["msr_light"], [aff(EVENNA, 10, "陪她算出了碎片的光")]),
            "fail": step("你算不出來，艾溫娜一個人算了一整夜：「深層。光最強的地方。」", ["msr_light"]),
        },
        {
            "id": "deep", "title": "在月影根穴的深層擊退碎片魔像",
            "text": "深層的根系裡，到處都是月光——不是從天上照下來的，是從地底透出來的。一尊由月之碎片凝成的魔像和一個墮落精靈法師擋在光的源頭前。",
            "at": at_dun("moonshadow_roots", "deep"), "requires": need("msr_light"), "kind": "combat",
            "enemies": [["shard_golem", 1], ["fallen_elf_mage", 1]],
            "success": step("魔像碎了，碎片落在你腳邊，暖暖的。墮落精靈法師倒下時，眼睛突然清明了一瞬：「……謝謝。月光……太亮了。」", ["msr_shard_piece"]),
            "fail": step("你們被月光刺得睜不開眼，可在撤退時撿到了一塊魔像的碎片，暖暖的。", ["msr_shard_piece"], [hp(-0.2)]),
        },
        {
            "id": "piece", "title": "決定那塊碎片的去處",
            "text": "那塊小小的月之碎片在你手心裡發著光。艾溫娜說：「它能讓枯掉的樹發芽。也能讓碰到它的人……忘了自己。」",
            "at": at_npc(EVENNA), "requires": need("msr_shard_piece"), "kind": "choice",
            "options": [
                {"label": "交給艾溫娜研究", "success": done("艾溫娜用一個水晶罩把碎片罩住，每天晚上對著它觀測：「如果我能弄懂它……也許能救那些墮落的精靈。」", ["msr_2_done", "msr_study"], [aff(EVENNA, 15, "把碎片交給她研究"), mem("在月影根穴的深層擊退了月之碎片魔像，把碎片交給星術師艾溫娜研究。")])},
                {"label": "拿去種在生命之泉旁", "success": done("莉安德拉把碎片埋在了生命之泉旁的枯樹下。第二天，枯樹發了芽——只是新長出來的葉子，是銀色的。", ["msr_2_done", "msr_planted"], [aff(LIAN, 10, "讓枯樹發了芽"), mem("在月影根穴的深層擊退了月之碎片魔像，把碎片埋在生命之泉旁，枯樹長出了銀色的葉子。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

msr3 = {
    "id": "msr_moon_core",
    "title": "月之碎片的本源",
    "summary": "滿月之夜，月影根穴最深處的月之碎片原石完全甦醒了。月光從王都的每一條樹根裡湧出來，碰到的精靈一個接一個地開始忘記自己。（月影根穴・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "guild", "location": "silvermoon", "min_level": 11, "requires": need("msr_2_done"),
        "text": "銀月城的公會亂成一團：根界的工匠們站在街上，茫然地看著自己的手，叫不出自己的名字。托倫抓著弓衝進公會：「月光從地底湧出來了！」他把弓塞給你，「我不會打仗。可是我的弓會。」",
    },
    "start_flags": ["msr_core"],
    "nodes": [
        {
            "id": "knights", "title": "在月影根穴的底層擋下月蝕騎士",
            "text": "底層的根系被月光照得像白晝。一個月蝕騎士和一團根穴深淵之影擋在原石前——騎士的鎧甲上，刻著王庭守根人的紋章。",
            "at": at_dun("moonshadow_roots", "abyss"), "requires": need("msr_core"), "kind": "combat",
            "enemies": [["lunar_knight", 1], ["root_horror", 1]],
            "success": step("騎士跪了下來，頭盔裡的眼睛清明了一瞬：「守根人……第七代。」他倒下了。前方，月之碎片的原石在跳動。", ["msr_knights"]),
            "fail": step("你們被打得遍體鱗傷，可騎士在最後一刻停下了劍，像是認出了托倫的弓。他退開了。前方，月之碎片的原石在跳動。", ["msr_knights"], [hp(-0.2)]),
        },
        {
            "id": "core", "title": "在月影根穴的底層壓下月之碎片的本源",
            "text": "月之碎片的本源是一塊比人還高的原石，月光從它的裂縫裡往外湧。它不說話，也不聽，只是發光。一個月蝕騎士從光裡走了出來。",
            "at": at_dun("moonshadow_roots", "abyss"), "requires": need("msr_knights"), "kind": "combat",
            "enemies": [["moon_fragment_core", 1], ["lunar_knight", 1]],
            "success": step("原石的光暗了下去，湧出來的月光退回了樹根。" + ECHO + "千年前月亮掉下來的那一夜，還會在這裡一次又一次地重演，原石也會再亮起來。", ["msr_dim"]),
            "fail": step("你們撐不住了，可原石在吞下騎士之後，光自己暗了下去。" + ECHO + "它還會再亮起來。", ["msr_dim"], [hp(-0.25)]),
        },
        {
            "id": "keepers", "title": "決定墮落精靈的去處",
            "text": "月光退了，根穴裡到處都是墮落的精靈，坐在地上，茫然地看著自己的手——有些人的眼睛，正在一點一點地清明。",
            "at": at_dun("moonshadow_roots", "abyss"), "requires": need("msr_dim"), "kind": "choice",
            "options": [
                {"label": "帶他們回到王都", "success": done("你和托倫帶著清醒過來的墮落精靈走出了根穴。王庭吵了三天，最後女王親自下令：「他們是守根人。他們回家了。」托倫的祖父也在裡面——托倫認出了他，哭得像個孩子。", ["msr_done", "msr_home"], [aff(TOREN, 25, "找回了他的祖父"), rep(ELF, 15), mem("壓下了月影根穴的月之碎片本源，把清醒過來的墮落精靈——千年前的守根人——帶回了銀月城。", 3)])},
                {"label": "讓他們繼續守根", "success": done("清醒的守根人們向你行了一個古老的禮，回到了根穴的各個角落：「我們的工作還沒結束。」從那以後，根穴裡的弓聲變得很規律——像是在巡邏。", ["msr_done", "msr_guard"], [aff(TOREN, 15, "讓守根人回到了崗位"), rep(ELF, 10), mem("壓下了月影根穴的月之碎片本源，清醒的守根人們回到了根穴裡繼續守根。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 荊棘迴廊 ----------------
thc1 = {
    "id": "thc_moonlight_pilgrimage",
    "title": "月華巡禮",
    "summary": "苔語村的精靈學徒菲恩正在進行精靈成年的「月華巡禮」，最後一關是荊棘迴廊的試煉。他的家族說，跟著人類學德魯伊的人，過不了女神的試煉。（荊棘迴廊・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": FENN, "min_level": 5,
        "text": "菲恩緊張得把手裡的樹枝折成了三段：「荊棘迴廊會映出你最怕的東西。」他深吸一口氣，「我的家族說，我選了人類當老師，女神不會讓我過。」他抬頭看你，「奧克塔維亞老師說，試煉可以帶一個同伴。你……可以陪我嗎？」",
    },
    "start_flags": ["thc_start"],
    "nodes": [
        {
            "id": "moon", "title": "在苔語村的酒館算荊棘迴廊的位置",
            "text": "荊棘迴廊的位置會隨著月相移動。苔語村酒館的老闆娘拿出一本舊曆：「今天是下弦月——迴廊在銀月城北邊。」",
            "at": at_cell("mosswhisper", "tavern"), "requires": need("thc_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你們算出了迴廊今晚的位置，還有入口打開的時辰。菲恩鬆了一口氣：「準時到，女神會比較高興。」", ["thc_found"]),
            "fail": step("你們算錯了，在森林裡繞了一整夜，天亮時才找到入口。菲恩的臉色更白了。", ["thc_found"], [hp(-0.05)]),
        },
        {
            "id": "middle", "title": "在荊棘迴廊的中層面對夢魘幻影",
            "text": "中層的藤牆一開一合。牆上映出了菲恩最怕的東西：他的家族，一個個轉過身去背對他。一個夢魘幻影、一個噬憶者和一個荊棘騎士從藤牆裡走了出來。",
            "at": at_dun("thorn_corridor", "middle"), "requires": need("thc_found"), "kind": "combat",
            "enemies": [["fear_mirror", 1], ["memory_eater", 1], ["bramble_knight", 1]],
            "success": step("幻影散了，牆上的家族影子也消失了。菲恩擦掉眼淚：「……那不是真的。他們只是生氣，不是不要我。」", ["thc_passed"]),
            "fail": step("你們被逼出了迴廊，可菲恩在最後一刻對著牆上的影子大喊：「我還是你們的孩子！」幻影散了。", ["thc_passed"], [hp(-0.15)]),
        },
        {
            "id": "after", "title": "陪菲恩回苔語村",
            "text": "菲恩在回村的路上一直很安靜。快到村口時，他問你：「女神會讓我過嗎？試煉還有兩關。」",
            "at": at_npc(FENN), "requires": need("thc_passed"), "kind": "choice",
            "options": [
                {"label": "「你已經過了最難的那一關」", "success": done("菲恩愣了一下，然後笑了：「……對。最怕的東西，我已經看過了。」奧克塔維亞在村口等著，揉了揉他的頭髮。", ["thc_1_done", "thc_brave"], [aff(FENN, 15, "陪他看了最怕的東西"), mem("陪苔語村的精靈學徒菲恩通過了荊棘迴廊的第一關：他最怕的是家族背對他。")])},
                {"label": "「不管女神怎麼說，你都是你」", "success": done("菲恩把那根折斷的樹枝收進了口袋：「……奧克塔維亞老師也這樣說。」他看著森林，「可是我想過。我想證明給他們看。」", ["thc_1_done"], [aff(FENN, 10, "陪他過了第一關"), mem("陪苔語村的精靈學徒菲恩通過了荊棘迴廊的第一關。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

thc2 = {
    "id": "thc_eaten_memories",
    "title": "被吃掉的記憶",
    "summary": "荊棘迴廊的第二關：深層的噬憶者會吃掉試煉者的記憶，一點一點地。菲恩從第一關回來之後，開始忘記奧克塔維亞教他的歌。（荊棘迴廊・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": OCT, "min_level": 8, "requires": need("thc_1_done"),
        "text": "奧克塔維亞的聲音像風吹過枯葉：「菲恩忘了森語的第三首歌。昨天，他忘了第二首。」她把一根纏著苔蘚的樹枝交給你，「迴廊在吃他的記憶。試煉的第二關，是要他把記憶搶回來——可是他一個人進去，會連自己為什麼要進去都忘掉。」",
    },
    "start_flags": ["thc_memory"],
    "nodes": [
        {
            "id": "song", "title": "在苔語村的森語之環學菲恩忘掉的歌",
            "text": "奧克塔維亞說：「進迴廊之前，你先學會那三首歌。菲恩忘了的時候，你唱給他聽。」",
            "at": at_cell("mosswhisper", "lm_whispering_ring"), "requires": need("thc_memory"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("你學會了那三首歌——第三首最難，是關於一棵樹等了一千年的雨。奧克塔維亞點點頭：「好。他會聽得出來。」", ["thc_songs"], [aff(OCT, 10, "學會了森語的歌")]),
            "fail": step("你只學會了兩首。奧克塔維亞嘆了口氣：「第三首……讓他自己想起來吧。」", ["thc_songs"]),
        },
        {
            "id": "deep", "title": "在荊棘迴廊的深層搶回菲恩的記憶",
            "text": "深層的藤牆上掛滿了發光的小球——每一顆都是一段被吃掉的記憶。菲恩看著它們，眼神空空的。一頭夢魘獸和一尊荊棘巨人守在那裡。",
            "at": at_dun("thorn_corridor", "deep"), "requires": need("thc_songs"), "kind": "combat",
            "enemies": [["nightmare_beast", 1], ["thorn_colossus", 1]], "allies": [FENN],
            "success": step("守衛倒下了。你把發光的小球一顆一顆地摘下來，唱著那三首歌，一顆一顆地交給菲恩。他的眼睛慢慢地亮了起來。", ["thc_restored"]),
            "fail": step("你們被逼退了，可在撤退時，你一邊跑一邊唱著那三首歌——菲恩跟著唱了起來，牆上的記憶一顆一顆地飛回了他身上。", ["thc_restored"], [hp(-0.2)]),
        },
        {
            "id": "keep", "title": "決定要不要讓菲恩記得一切",
            "text": "最後一顆記憶小球在你手裡，比其他的都暗。菲恩看著它，小聲說：「那是……家族把我趕出家門的那一天。」他猶豫了，「我可以不要它嗎？」",
            "at": at_dun("thorn_corridor", "deep"), "requires": need("thc_restored"), "kind": "choice",
            "options": [
                {"label": "「它也是你的一部分」", "success": done("菲恩接過了那顆記憶，哭了很久。然後他站了起來：「……我記得了。我記得我為什麼要走。」他看起來比進迴廊之前高了一點。", ["thc_2_done", "thc_whole"], [aff(FENN, 15, "讓他記得了全部"), mem("陪精靈學徒菲恩從荊棘迴廊的深層搶回了被吃掉的記憶，包括最痛的那一段。")])},
                {"label": "「你可以把它留在這裡」", "success": done("你把那顆記憶放回了藤牆上。菲恩鬆了一口氣，笑了——可是那笑容，好像少了點什麼。回到苔語村，奧克塔維亞看了他很久，什麼也沒說。", ["thc_2_done", "thc_left"], [aff(FENN, 10, "讓他放下了最痛的記憶"), mem("陪精靈學徒菲恩從荊棘迴廊的深層搶回了記憶，最痛的那一段留在了迴廊裡。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

thc3 = {
    "id": "thc_goddess_shadow",
    "title": "女神的倒影",
    "summary": "荊棘迴廊的最後一關：自然女神的倒影。試煉者要在祂面前證明自己——菲恩的家族也來了，要親眼看他失敗。（荊棘迴廊・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": FENN, "min_level": 11, "requires": need("thc_2_done"),
        "text": "菲恩穿上了奧克塔維亞替他縫的苔蘚斗篷：「最後一關。」他看著遠處——幾個穿著翠輝議會長袍的精靈站在森林邊，那是他的家族，「他們來看我失敗。」他握緊了拳頭，「我們走吧。這一次，我要走到最後。」",
    },
    "start_flags": ["thc_final"],
    "nodes": [
        {
            "id": "abyss", "title": "在荊棘迴廊的底層擊退荊棘樹精后",
            "text": "底層的藤牆高得看不見頂。一頭吞憶巨獸和荊棘樹精后擋在最後的門前，樹精后的花冠上開滿了白色的花——每一朵都是一個沒能通過試煉的精靈。",
            "at": at_dun("thorn_corridor", "abyss"), "requires": need("thc_final"), "kind": "combat",
            "enemies": [["memory_devourer", 1], ["thorn_dryad", 1]], "allies": [FENN],
            "success": step("樹精后倒下了，花冠上的白花一朵一朵地飄走，像是被放走的人。門開了。門後是一面巨大的水鏡。", ["thc_gate"]),
            "fail": step("你們被荊棘纏住了，可菲恩唱起了森語的第三首歌，荊棘慢慢地鬆開了。門開了，門後是一面巨大的水鏡。", ["thc_gate"], [hp(-0.2)]),
        },
        {
            "id": "shadow", "title": "在荊棘迴廊的底層打倒自然女神的倒影",
            "text": "水鏡裡走出了自然女神的倒影——不是女神本身，是試煉者心裡最深的恐懼長成的女神的樣子。祂不說話，也不聽，只映出你最怕的東西。一頭吞憶巨獸從鏡子的另一邊爬了出來。",
            "at": at_dun("thorn_corridor", "abyss"), "requires": need("thc_gate"), "kind": "combat",
            "enemies": [["nature_goddess_shadow", 1], ["memory_devourer", 1]],
            "success": step("倒影碎成了千萬片鏡子，每一片都映著菲恩的臉——笑著的臉。" + ECHO + "一千年來的每一次試煉，都還會在這裡重演，倒影也會再站起來，等下一個試煉者。", ["thc_passed_all"]),
            "fail": step("你們撐不住了，可菲恩沒有逃。他站在倒影面前，一直站著，直到倒影自己碎了。" + ECHO + "它還會再站起來，等下一個試煉者。", ["thc_passed_all"], [hp(-0.25)]),
        },
        {
            "id": "rite", "title": "陪菲恩走出迴廊",
            "text": "菲恩走出荊棘迴廊的時候，天亮了。他的家族站在森林邊，看著他，誰也沒有說話。奧克塔維亞站在另一邊。",
            "at": at_npc(FENN), "requires": need("thc_passed_all"), "kind": "choice",
            "options": [
                {"label": "「去吧，跟你的家族說話」", "success": done("菲恩走到家族面前，深深地鞠了一躬：「我通過了。跟著人類老師學的。」他的母親看了他很久，伸手摸了摸他的臉：「……長大了。」那天，菲恩的家族第一次走進了苔語村。", ["thc_done", "thc_family"], [aff(FENN, 25, "陪他走完了月華巡禮"), aff(OCT, 15, "讓她的學徒成年了"), rep(ELF, 10), mem("陪精靈學徒菲恩走完了荊棘迴廊的月華巡禮。他的家族第一次走進了苔語村。", 3)])},
                {"label": "「你已經不需要他們的認可了」", "success": done("菲恩點點頭，走向了奧克塔維亞。經過家族身邊時，他停下來，平靜地說了一句：「我過了。」然後繼續往前走。奧克塔維亞替他披上了德魯伊的綠袍：「歡迎回家，菲恩。」", ["thc_done", "thc_druid"], [aff(FENN, 20, "讓他自己選了路"), aff(OCT, 20, "讓她的學徒成了德魯伊"), mem("陪精靈學徒菲恩走完了荊棘迴廊的月華巡禮，他成了苔語村的德魯伊。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 翠影空洞 ----------------
vh1 = {
    "id": "vh_infected_elves",
    "title": "被寄生的精靈",
    "summary": "翠影空洞是精靈最早的誕生地，也是世界樹之根的延伸。前往那裡朝聖的精靈，回來時背上長著白色的孢子。（翠影空洞・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": LIAN, "min_level": 5,
        "text": "莉安德拉跪在生命之泉邊，替一個朝聖回來的精靈清洗背上的孢子：「翠影空洞，精靈的誕生地。」她的手很穩，聲音卻在抖，「朝聖的人回來時都長了孢子。還有一個沒回來——她的家人在泉邊等了七天。」",
    },
    "start_flags": ["vh_start"],
    "nodes": [
        {
            "id": "pilgrim", "title": "在銀月城的神殿問朝聖的路",
            "text": "銀月城的神殿裡，管理朝聖的老祭司翻開名冊：「翠影空洞三天的路。中層有一片光泉湖，朝聖者在那裡祈禱。」她指著一個名字，「她叫艾蘿，沒有回來的那一個。」",
            "at": at_cell("silvermoon", "temple"), "requires": need("vh_start"), "kind": "check",
            "check": {"attr": "fai", "dc": 13},
            "success": step("老祭司告訴你朝聖者的祈禱詞，還有一件事：「最近從空洞回來的人都說，光泉湖的水變成了白色。」", ["vh_lake"]),
            "fail": step("老祭司只給了你一張路線圖：「光泉湖。她最後在那裡。」", ["vh_lake"]),
        },
        {
            "id": "middle", "title": "在翠影空洞的中層找到艾蘿",
            "text": "中層的光泉湖邊，蘑菇林發著藍光，湖水卻是乳白色的。一個被寄生的精靈跪在湖邊——背上的孢子長得比她還高。兩頭孢子獸在她身邊打轉。",
            "at": at_dun("verdant_hollow", "middle"), "requires": need("vh_lake"), "kind": "combat",
            "enemies": [["infected_elf", 1], ["spore_beast", 2]],
            "success": step("孢子獸倒下了。被寄生的精靈慢慢地抬起頭——不是艾蘿。是另一個你不認識的精靈，穿著幾百年前的衣服。她的手裡握著艾蘿的朝聖念珠，指著湖底。", ["vh_beads"]),
            "fail": step("你們被孢子逼退了，可在撤退時，被寄生的精靈把一串念珠丟到了你腳邊——艾蘿的念珠。她指著湖底。", ["vh_beads"], [hp(-0.15)]),
        },
        {
            "id": "back", "title": "把念珠帶回生命之泉",
            "text": "莉安德拉把念珠交給艾蘿的家人。他們哭了，又問：「湖底有什麼？」",
            "at": at_npc(LIAN), "requires": need("vh_beads"), "kind": "choice",
            "options": [
                {"label": "「我會再下去找」", "success": done("艾蘿的家人跪下來謝你。莉安德拉送你到泉邊：「湖底……是世界樹之根的延伸。孢子，是從根的另一端來的。」", ["vh_1_done", "vh_promise"], [aff(LIAN, 10, "答應再去找"), mem("在翠影空洞的中層找到了朝聖者艾蘿的念珠，被寄生的古代精靈指著湖底。答應再下去找她。")])},
                {"label": "「她……可能回不來了」", "success": done("艾蘿的家人沉默了很久，點了點頭，把念珠掛在了泉邊的樹上。莉安德拉在念珠下面唸了很久的祈禱。", ["vh_1_done"], [aff(LIAN, 5, "帶回了念珠"), mem("在翠影空洞的中層找到了朝聖者艾蘿的念珠，帶回了生命之泉。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

vh2 = {
    "id": "vh_alien_bloom",
    "title": "異界之花",
    "summary": "翠影空洞的深層長出了一種不屬於這個世界的花。被寄生的精靈都朝著它走，像是被呼喚。艾蘿也在那裡。（翠影空洞・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": EVENNA, "min_level": 8, "requires": need("vh_1_done"),
        "text": "艾溫娜拿著一朵壓乾的花，花瓣的顏色你從來沒見過：「朝聖者帶回來的。它不屬於這個世界。」她的眼睛亮得嚇人，「星圖上，空洞的正上方有一顆星在閃——那顆星，也不屬於這個世界。」",
    },
    "start_flags": ["vh_bloom"],
    "nodes": [
        {
            "id": "petal", "title": "陪艾溫娜研究異界的花",
            "text": "艾溫娜把花瓣放在觀星儀下，花瓣的紋路和星圖上的某個星座一模一樣。",
            "at": at_npc(EVENNA), "requires": need("vh_bloom"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你們發現了：花的紋路是一張地圖——孢子從世界樹之根的一道裂縫飄過來，裂縫的另一邊，是另一個世界。花在呼喚被寄生的人，把他們帶到裂縫前。", ["vh_map"], [aff(EVENNA, 10, "陪她看懂了花")]),
            "fail": step("你看不懂，艾溫娜一個人研究到天亮：「裂縫。根上有一道裂縫，孢子從那裡來。」", ["vh_map"]),
        },
        {
            "id": "deep", "title": "在翠影空洞的深層救出艾蘿",
            "text": "深層的異界之花開得像一片海，被寄生的精靈們排著隊，一個接一個地走向花海深處。艾蘿在隊伍裡，背上的孢子才剛長出來。一朵異界之花和一個孢子守衛擋住了你。",
            "at": at_dun("verdant_hollow", "deep"), "requires": need("vh_map"), "kind": "combat",
            "enemies": [["alien_bloom", 1], ["spore_guardian", 1]],
            "success": step("你把艾蘿從隊伍裡拉了出來，扯掉她背上的孢子。她眨了眨眼睛，第一句話是：「……有人在另一邊唱歌。」", ["vh_saved"]),
            "fail": step("你們被花粉逼退了，可在撤退時硬是把艾蘿從隊伍裡拖了出來。她眨了眨眼睛：「……有人在另一邊唱歌。」", ["vh_saved"], [hp(-0.2)]),
        },
        {
            "id": "after", "title": "決定要不要讓艾蘿說出她看見的東西",
            "text": "回到銀月城，艾蘿躺在生命之泉邊，說她在花海深處看見了一道門。門的另一邊，有很多和精靈長得很像、卻不是精靈的人，在唱歌。",
            "at": at_npc(LIAN), "requires": need("vh_saved"), "kind": "choice",
            "options": [
                {"label": "讓她告訴王庭", "success": done("艾蘿在王庭上說出了她看見的一切。王庭陷入了沉默——精靈一直以為自己是最古老的種族。女王最後只說了一句：「門的另一邊，也有人在等。」", ["vh_2_done", "vh_told"], [aff(LIAN, 10, "讓真相被聽見"), rep(ELF, 5), mem("從翠影空洞的深層救出了朝聖者艾蘿。她說孢子來自一道門，門的另一邊有和精靈很像的人在唱歌。")])},
                {"label": "讓她先休息，什麼都別說", "success": done("莉安德拉點點頭，替艾蘿蓋上了被子。艾蘿睡著前小聲說：「他們在唱的歌……很寂寞。」", ["vh_2_done"], [aff(LIAN, 10, "救回了艾蘿"), mem("從翠影空洞的深層救出了朝聖者艾蘿。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

vh3 = {
    "id": "vh_otherworld_gate",
    "title": "異界之門",
    "summary": "翠影空洞最深處，世界樹之根上長著一道裂縫——異界之門。孢子從門的另一邊飄過來，污染了整棵世界樹的根。（翠影空洞・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": LIAN, "min_level": 11, "requires": need("vh_2_done"),
        "text": "莉安德拉第一次帶著武器——一根纏著藤蔓的白木杖：「門在變大。孢子已經順著根爬到了生命之泉。」她看著你，「我不知道門的另一邊是什麼。可是我知道，這一邊的樹快撐不住了。」",
    },
    "start_flags": ["vh_gate"],
    "nodes": [
        {
            "id": "firstborn", "title": "在翠影空洞的底層擊退腐化的初生精靈",
            "text": "底層的光泉湖已經全白了。一個異界孢子母體和一個腐化的初生精靈擋在門前——初生精靈的臉，和銀月城神殿裡供奉的「最初的精靈」雕像一模一樣。",
            "at": at_dun("verdant_hollow", "abyss"), "requires": need("vh_gate"), "kind": "combat",
            "enemies": [["otherworld_spawn", 1], ["corrupted_firstborn", 1]],
            "success": step("初生精靈倒下了，臉上的孢子散去，露出了一個很平靜的表情。前方，異界之門在根上一開一合，像在呼吸。", ["vh_door"]),
            "fail": step("你們被打得遍體鱗傷，莉安德拉用白木杖撐出了一圈光，替你們擋住了孢子。前方，異界之門在根上一開一合，像在呼吸。", ["vh_door"], [hp(-0.2)]),
        },
        {
            "id": "gate", "title": "在翠影空洞的底層壓下異界之門",
            "text": "異界之門不是怪物，是一道裂縫——它不說話，也不聽，只是張開。孢子從裂縫裡湧出來，凝成了一個異界孢子母體。門的另一邊，隱隱傳來寂寞的歌聲。",
            "at": at_dun("verdant_hollow", "abyss"), "requires": need("vh_door"), "kind": "combat",
            "enemies": [["otherworld_gate", 1], ["otherworld_spawn", 1]],
            "success": step("裂縫縮小了，孢子停止了湧出。可是" + ECHO + "門第一次在根上裂開的那一刻，還會在這裡一次又一次地重演，它也會再張開。", ["vh_shrunk"]),
            "fail": step("你們撐不住了，可裂縫在吞下母體之後，自己縮了回去。" + ECHO + "它還會再張開。", ["vh_shrunk"], [hp(-0.25)]),
        },
        {
            "id": "close", "title": "決定怎麼處理異界之門",
            "text": "裂縫縮成了一道細縫，門的另一邊的歌聲變得很清楚了——寂寞，但不兇。莉安德拉看著你。",
            "at": at_npc(LIAN), "requires": need("vh_shrunk"), "kind": "choice",
            "options": [
                {"label": "用世界樹的新芽封住裂縫", "requires": any_flag("wt_open", "wt_hidden"),
                 "success": done("你們把從月輝之母的新芽上折下的一小枝插進了裂縫。新芽的根慢慢地長了進去，把裂縫縫了起來。最後一刻，門的另一邊的歌聲停了一下，像是在說再見。生命之泉的水，在那天恢復了清澈。", ["vh_done", "vh_sewn"], [aff(LIAN, 25, "用新芽縫起了世界樹的根"), rep(ELF, 15), mem("在翠影空洞的底層壓下了異界之門，用世界樹的新芽把裂縫縫了起來。", 3)])},
                {"label": "用精靈的歌封住裂縫", "success": done("莉安德拉唱起了最古老的精靈之歌，你跟著哼。裂縫慢慢地合上了——門的另一邊的歌聲，在最後一刻也跟著唱了起來，兩首歌疊在一起。莉安德拉哭了：「他們……也會唱這首歌。」", ["vh_done", "vh_sung"], [aff(LIAN, 20, "陪她唱完了最古老的歌"), rep(ELF, 10), mem("在翠影空洞的底層壓下了異界之門，用精靈最古老的歌封住了裂縫。門的另一邊也有人在唱同一首歌。", 3)])},
                {"label": "留一道縫，讓艾溫娜研究另一邊", "success": done("你們用星光在裂縫上架了一道網，孢子過不來，歌聲卻過得來。艾溫娜在空洞裡住了下來，每天晚上聽著另一邊的歌，畫著另一個世界的星圖。", ["vh_done", "vh_window"], [aff(EVENNA, 25, "讓她看見了另一個世界"), aff(LIAN, 10, "擋住了孢子"), mem("在翠影空洞的底層壓下了異界之門，留下一道用星光網住的縫，讓星術師艾溫娜研究另一個世界。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 潮隕洞窟 ----------------
tfc1 = {
    "id": "tfc_lost_envoy",
    "title": "又迷路的使者",
    "summary": "玉璘族的使者汐音已經在潮汐港迷路了一百多次。這一次，她迷路迷到了珊瑚灣下方的潮隕洞窟。（潮隕洞窟・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": TOMA, "min_level": 5,
        "text": "托馬老爹抓著頭：「汐音那孩子，昨天說要來珊瑚灣找我喝酒，結果游進了潮隕洞窟。」他指著海面上一圈一圈的漩渦，「那下面是古海神的遺骸，海靈會用幻象引人溺死。她是玉璘族，不會溺死——可是她會迷路。永遠。」",
    },
    "start_flags": ["tfc_start"],
    "nodes": [
        {
            "id": "dive", "title": "在珊瑚灣的神殿求海靈的保佑",
            "text": "海靈祠的巫女澪給了你一串貝殼念珠：「戴著它，海靈的幻象會淡一點。」她停下來聽海，「……汐音在中層。她在唱歌，很大聲。她每次迷路都這樣。」",
            "at": at_cell("coral_bay", "temple"), "requires": need("tfc_start"), "kind": "check",
            "check": {"attr": "fai", "dc": 13},
            "success": step("你在海靈祠祈禱了一夜，貝殼念珠微微地發著光。澪點點頭：「海靈認得你了。」", ["tfc_blessed"], [aff(MIO, 5, "在海靈祠祈禱")]),
            "fail": step("念珠一直沒有亮。澪想了想，又塞給你一串：「兩串，應該夠了。」", ["tfc_blessed"]),
        },
        {
            "id": "middle", "title": "在潮隕洞窟的中層找到汐音",
            "text": "中層的沉船殘骸之間，發光藻類一閃一閃。你聽見了汐音的歌聲——還有一個海靈幻象，一隻巨螯蟹和一個深海魚人，被歌聲吸引了過來。",
            "at": at_dun("tidefall_cave", "middle"), "requires": need("tfc_blessed"), "kind": "combat",
            "enemies": [["sea_phantom", 1], ["giant_crab", 1], ["deep_fishman", 1]],
            "success": step("你們擋下了牠們。汐音從一艘沉船的船艙裡探出頭，笑得一臉燦爛：「啊！陸地人！你也迷路了嗎？」她手裡抱著一塊發光的骨頭，「我撿到了這個。很漂亮對不對？」", ["tfc_found"]),
            "fail": step("你們被逼退了，可汐音自己從沉船裡游了出來，抱著一塊發光的骨頭：「陸地人！你也迷路了嗎？」", ["tfc_found"], [hp(-0.15)]),
        },
        {
            "id": "bone", "title": "決定那塊骨頭的去處",
            "text": "汐音抱著的骨頭在發光，摸起來是溫的。澪看見它的時候，臉色變了：「那是……古海神的骨頭。」",
            "at": at_npc(MIO), "requires": need("tfc_found"), "kind": "choice",
            "options": [
                {"label": "放回洞窟", "success": done("你和汐音把骨頭放回了沉船裡。汐音有點捨不得，可還是對著骨頭鞠了一躬：「對不起，借你玩了一下。」那天晚上，澪夢見了一個很古老、很溫柔的聲音在說謝謝。", ["tfc_1_done", "tfc_returned"], [aff(MIO, 10, "把骨頭還給了海神"), aff(SHION, 10, "又一次把她找了回來"), mem("在潮隕洞窟的中層找到了迷路的玉璘族使者汐音，把她撿到的古海神骨頭放了回去。")])},
                {"label": "交給澪供奉在海靈祠", "success": done("澪把骨頭供奉在了海靈祠的神龕上。那天晚上，祠堂的井水在半夜裡響了三聲。澪說：「祂……醒了一點點。」", ["tfc_1_done", "tfc_shrine"], [aff(MIO, 5, "把骨頭交給了她"), aff(SHION, 10, "又一次把她找了回來"), mem("在潮隕洞窟的中層找到了迷路的汐音，把古海神的骨頭供奉在海靈祠。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

tfc2 = {
    "id": "tfc_forgotten_abyss",
    "title": "祖忘之淵",
    "summary": "潮隕洞窟的深層再往下，就是玉璘族疆域之外的「祖忘之淵」。巫女澪說，海族祖靈的歸宿在那裡——而祖靈們最近都在哭。（潮隕洞窟・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": MIO, "min_level": 8, "requires": need("tfc_1_done"),
        "text": "澪的眼睛下面有很深的黑眼圈：「每天晚上，祖靈們都在我的夢裡哭。」她停下來聽海，聽了很久，「他們說……有東西在吃他們。從祖忘之淵的下面。」她抬頭看你，「我想知道他們為什麼哭。」",
    },
    "start_flags": ["tfc_abyss"],
    "nodes": [
        {
            "id": "listen", "title": "在珊瑚灣的海靈祠陪澪聽祖靈的聲音",
            "text": "澪把海靈祠的井水舀進一個大碗，碗裡的水面上映出了很多張臉——海族的祖靈。他們張著嘴，卻沒有聲音。",
            "at": at_cell("coral_bay", "lm_sea_spirit_shrine"), "requires": need("tfc_abyss"), "kind": "check",
            "check": {"attr": "fai", "dc": 15},
            "success": step("你聽見了：古海神的殘念在深淵的底下醒了。它太餓了，祖靈本來是它的一部分，它要把他們吃回去。祂不是壞的——只是太久沒有人記得祂。", ["tfc_heard"], [aff(MIO, 10, "陪她聽見了祖靈")]),
            "fail": step("你只看見了臉，聽不見聲音。澪替你轉述：「海神醒了。祂在把祖靈吃回去。」", ["tfc_heard"]),
        },
        {
            "id": "deep", "title": "在潮隕洞窟的深層擊退海神遺骨守衛",
            "text": "深層的洞窟是古海神的肋骨，一根一根地彎在你頭頂。一個海神遺骨守衛和一條深淵觸手在祖靈的哭聲裡醒了過來。",
            "at": at_dun("tidefall_cave", "deep"), "requires": need("tfc_heard"), "kind": "combat",
            "enemies": [["god_bone_guard", 1], ["abyssal_tentacle", 1]],
            "success": step("守衛倒下了。洞窟深處的哭聲小了一點。你在守衛的胸骨裡找到了一枚貝殼——上面刻著玉璘族的古字：「記得祂」。", ["tfc_shell"]),
            "fail": step("你們被觸手拖進了水裡，好不容易才游回來。手裡多了一枚從守衛身上扯下來的貝殼，上面刻著：「記得祂」。", ["tfc_shell"], [hp(-0.2)]),
        },
        {
            "id": "remember", "title": "決定怎麼讓人記得古海神",
            "text": "澪把貝殼貼在耳邊：「祂想被記得。」她看著你，「也許……我們可以辦一場祭典。」",
            "at": at_npc(MIO), "requires": need("tfc_shell"), "kind": "choice",
            "options": [
                {"label": "「在珊瑚灣辦一場海神祭」", "success": done("珊瑚灣辦了一場三十年來第一次的海神祭。鎮民、玉璘族、潮汐港的水手，大家一起往海裡放花燈。那天晚上，澪睡得很好——祖靈們沒有哭。", ["tfc_2_done", "tfc_festival"], [aff(MIO, 15, "替海神辦了祭典"), rep(SEASONS, 5), mem("在潮隕洞窟的深層發現古海神想被記得，在珊瑚灣辦了一場海神祭。")])},
                {"label": "「請玉璘族的秋珊苑把祂寫進史書」", "success": done("秋珊苑的學者們把古海神的故事寫成了一卷長長的史詩。澪說，祖靈們在夢裡聽完了整卷——然後一個一個地，安靜了下來。", ["tfc_2_done", "tfc_history"], [aff(MIO, 10, "讓海神被寫進了歷史"), rep(SEASONS, 10), mem("在潮隕洞窟的深層發現古海神想被記得，請玉璘族把祂的故事寫進了史書。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

tfc3 = {
    "id": "tfc_sea_god_remnant",
    "title": "古海神的殘念",
    "summary": "祭典之後，祖靈安靜了，古海神的殘念卻從祖忘之淵升了上來——祂想回到海面，回到被人記得的地方。可是祂太大了，祂一動，珊瑚灣就會被海嘯淹沒。（潮隕洞窟・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": MIO, "min_level": 11, "requires": need("tfc_2_done"),
        "text": "澪抱著海靈祠的銅鈴，臉色蒼白：「祂要上來了。」海面上的漩渦一個比一個大，「祂不是要傷害我們。祂只是想回來。可是祂一動……」她說不下去了，「我們要讓祂回去睡。陪我下去，好嗎？」",
    },
    "start_flags": ["tfc_rise"],
    "nodes": [
        {
            "id": "drowners", "title": "在潮隕洞窟的底層擊退祖靈溺魂",
            "text": "底層的海水是黑的。一個祖靈溺魂和一頭深淵海獸幼體擋在路上——溺魂是被海神吃回去的祖靈，臉上還帶著淚痕。",
            "at": at_dun("tidefall_cave", "abyss"), "requires": need("tfc_rise"), "kind": "combat",
            "enemies": [["ancestral_drowner", 1], ["abyssal_leviathan_spawn", 1]], "allies": [MIO],
            "success": step("溺魂散了，化成了一串氣泡往海面飄去——像是被放走了。前方，一團比沉船還大的、溫柔的光在黑暗裡起伏。", ["tfc_near"]),
            "fail": step("你們被海獸拖得遍體鱗傷，澪搖響了銅鈴，溺魂停了下來，化成氣泡飄走了。前方，一團巨大而溫柔的光在黑暗裡起伏。", ["tfc_near"], [hp(-0.2)]),
        },
        {
            "id": "remnant", "title": "在潮隕洞窟的底層讓古海神的殘念沉下去",
            "text": "古海神的殘念是一團巨大的光，裡面隱約有一個很古老的臉。祂不說話，也不聽——祂已經忘了怎麼說話，只記得往上。一頭深淵海獸幼體從祂的光裡游了出來。",
            "at": at_dun("tidefall_cave", "abyss"), "requires": need("tfc_near"), "kind": "combat",
            "enemies": [["sea_god_remnant", 1], ["abyssal_leviathan_spawn", 1]],
            "success": step("殘念的光慢慢地沉了下去，漩渦一個接一個地停了。" + ECHO + "古海神死去的那一天，還會在這裡一次又一次地重演，祂也會再升起來。", ["tfc_sank"]),
            "fail": step("你們撐不住了，可澪的銅鈴一直在響，殘念的光聽著鈴聲，慢慢地沉了下去。" + ECHO + "祂還會再升起來。", ["tfc_sank"], [hp(-0.25)]),
        },
        {
            "id": "lullaby", "title": "決定古海神的歸宿",
            "text": "殘念的光沉到了深淵的邊緣，停在那裡，像在等。澪看著你：「祂還想回來。我們能給祂什麼？」",
            "at": at_npc(MIO), "requires": need("tfc_sank"), "kind": "choice",
            "options": [
                {"label": "「讓珊瑚灣每年都辦海神祭，讓祂聽得見」", "success": done("澪對著深淵搖了三次銅鈴，大聲地說：「每年，我們都會唱給你聽！」光閃了一下，然後慢慢地沉進了深淵。從那年起，珊瑚灣的海神祭成了東海最大的祭典，連滄月闕的潮主都會來唱歌。", ["tfc_done", "tfc_rest"], [aff(MIO, 25, "替海神找到了歸宿"), rep(SEASONS, 15), mem("在潮隕洞窟的底層讓古海神的殘念沉了下去，答應祂珊瑚灣每年都會唱歌給祂聽。", 3)])},
                {"label": "「讓祂的力量撐起礁光柱」", "requires": need("reef_done"),
                 "success": done("你想起了滄月闕的礁光柱——深淵的東西在往上爬，結界需要更多的力量。澪把銅鈴對著深淵搖響，殘念的光順著鈴聲，慢慢地流向了滄月闕的方向。那天晚上，礁光柱亮得像白天，螺鈿婆婆說：「有人在替我們守門了。」", ["tfc_done", "tfc_pillars"], [aff(MIO, 20, "讓海神有了新的工作"), rep(SEASONS, 20), mem("在潮隕洞窟的底層讓古海神的殘念沉了下去，祂的力量流向了滄月闕的礁光柱，替玉璘族守門。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 骷髏潮島 ----------------
skl1 = {
    "id": "skl_no_survivors",
    "title": "沒有人回來的島",
    "summary": "骷髏潮島——形似巨獸頭骨的禁島，據說是舊時代海盜王的寶藏埋葬地，每次登島者都無人生還。深潮席的雷諾說，有一艘船回來了——船上只剩一個人。（骷髏潮島・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": RENO, "min_level": 5,
        "text": "雷諾難得地沒有喝醉：「『海燕三號』回來了。去骷髏潮島的船，三十個人去，一個人回來。」他把一張濕透的航海日誌放在桌上，「他一直在說『砲聲』。島上有砲聲。我需要有人去看看——在白鯨決定把那座島炸掉之前。」",
    },
    "start_flags": ["skl_start"],
    "nodes": [
        {
            "id": "survivor", "title": "在潮汐港的神殿問倖存的水手",
            "text": "倖存的水手縮在神殿的角落裡，全身都是白色的鹽粒：「砲聲……亡靈在開砲……他們穿著三百年前的衣服……」他抓住你的手，「中層。我們在中層被打下來的。」",
            "at": at_cell("tidehaven", "temple"), "requires": need("skl_start"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": step("你讓水手冷靜下來，他畫出了島上的地形：港灣、鹽化的古堡、還有中層那門一直在開砲的舊砲台。「別在退潮的時候靠岸。」他說，「退潮時，島會醒。」", ["skl_map"]),
            "fail": step("水手只是一直重複著「砲聲」。神殿的祭司嘆了口氣，把一張水手畫的地圖交給你。", ["skl_map"]),
        },
        {
            "id": "middle", "title": "在骷髏潮島的中層讓亡靈砲手停火",
            "text": "骷髏潮島的中層，鹽化的古堡城牆上，一門舊砲台還在開砲。一個亡靈砲手和兩個鹽化骷髏水手守在砲台旁，對著海面上每一個影子開火。",
            "at": at_dun("skull_isle", "middle"), "requires": need("skl_map"), "kind": "combat",
            "enemies": [["pirate_gunner", 1], ["salt_skeleton", 2]],
            "success": step("砲聲停了。砲台旁的鹽堆裡，有一本被鹽封住的航海日誌——三百年前的，簽名是「海盜王・紅鬚」。", ["skl_log"]),
            "fail": step("你們被砲火逼退了，可在撤退時，砲台的砲管終於炸裂了。你從碎石堆裡撿到了一本被鹽封住的航海日誌，簽名是「海盜王・紅鬚」。", ["skl_log"], [hp(-0.15)]),
        },
        {
            "id": "report", "title": "回報雷諾",
            "text": "雷諾翻著那本航海日誌，眼睛越瞪越大：「紅鬚……三百年前的海盜王。」他翻到最後一頁，「『寶藏交給島看守。島會吃掉每一個想拿走它的人。』」",
            "at": at_npc(RENO), "requires": need("skl_log"), "kind": "choice",
            "options": [
                {"label": "「別讓白鯨炸島」", "success": done("雷諾點點頭，把日誌藏進了懷裡：「我會跟白鯨說，島上的東西不能炸——炸了，會醒。」他嘆了口氣，「不過，黑帆那傢伙一定會想要這本日誌。」", ["skl_1_done", "skl_kept"], [aff(RENO, 10, "替他查清了島上的事"), mem("在骷髏潮島的中層讓亡靈砲台停了火，找到了三百年前海盜王紅鬚的航海日誌：寶藏交給島看守。")])},
                {"label": "「把日誌交給議會」", "success": done("七潮議會收下了日誌，白鯨在議會上一拳打在桌上：「誰都不准去骷髏潮島。」可是當天晚上，議會的檔案室就被人闖了進去——日誌不見了。", ["skl_1_done", "skl_stolen"], [rep(TIDES, 5), mem("在骷髏潮島的中層找到了海盜王紅鬚的航海日誌，交給了七潮議會。當晚日誌就被偷走了。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

skl2 = {
    "id": "skl_pirate_king_map",
    "title": "紅鬚的地圖",
    "summary": "走私王「黑帆」卡洛斯找上門來：他有紅鬚的藏寶圖的另一半。兩半合在一起，就能找到骷髏潮島深層的寶庫——他說，他需要一個不會被島吃掉的人。（骷髏潮島・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": CARLOS, "min_level": 8, "requires": need("skl_1_done"),
        "text": "卡洛斯把半張發黃的地圖放在桌上，風度翩翩地笑著：「我的船從骷髏潮島帶回過一些東西——這半張地圖，是其中之一。」他用手指敲著地圖，「另一半，在你找到的日誌的封皮裡。我們合作，五五分帳。」",
    },
    "start_flags": ["skl_map2"],
    "nodes": [
        {
            "id": "cover", "title": "在潮汐港的情報商拆開日誌的封皮",
            "text": "情報商用一把細刀小心地拆開了航海日誌的封皮。裡面夾著另外半張地圖——和卡洛斯的那一半，邊緣剛好吻合。",
            "at": at_cell("tidehaven", "informant"), "requires": need("skl_map2"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("兩半地圖拼在了一起：寶庫在古堡的深層，入口在退潮時才會露出來。地圖的角落有一行小字：「寶庫的鑰匙在我的心臟裡。」", ["skl_full_map"]),
            "fail": step("情報商收了一筆錢，替你把兩半地圖拼了起來：寶庫在古堡的深層，退潮時才會露出入口。", ["skl_full_map"], [money(-100)]),
        },
        {
            "id": "deep", "title": "在骷髏潮島的深層打開紅鬚的寶庫",
            "text": "退潮的時候，古堡深層的地板裂開，露出了一道向下的階梯。寶庫的門前，一個幽靈海盜和一團風暴元素在等著——門上刻著一顆被劍刺穿的心臟。",
            "at": at_dun("skull_isle", "deep"), "requires": need("skl_full_map"), "kind": "combat",
            "enemies": [["ghost_pirate", 1], ["storm_elemental", 1]],
            "success": step("守衛倒下了。寶庫的門開了一條縫——裡面沒有金子，只有一個用鹽封住的大箱子，箱子上用血寫著：「給能活著走出這座島的人」。", ["skl_vault"]),
            "fail": step("你們被風暴逼退了，可寶庫的門在打鬥中被撞開了一條縫——裡面只有一個用鹽封住的大箱子。", ["skl_vault"], [hp(-0.2)]),
        },
        {
            "id": "split", "title": "決定要不要讓卡洛斯知道",
            "text": "箱子太重，搬不動——要打開它，得先離開這座島。卡洛斯的船在外海等著。",
            "at": at_dun("skull_isle", "deep"), "requires": need("skl_vault"), "kind": "choice",
            "options": [
                {"label": "照約定告訴卡洛斯", "success": done("卡洛斯聽完，難得地沒有笑：「給能活著走出這座島的人……」他看著骷髏潮島的方向，「紅鬚在嘲笑我們。島不會讓任何人帶走它——除非，先讓島睡著。」", ["skl_2_done", "skl_carlos"], [aff(CARLOS, 15, "守了約定"), mem("和走私王卡洛斯合作，找到了骷髏潮島深層的寶庫：一個寫著「給能活著走出這座島的人」的箱子。")])},
                {"label": "先瞞著他", "success": done("你回到船上，只說寶庫是空的。卡洛斯看了你很久，笑了：「朋友，你說謊的時候，眼睛會往左看。」他沒有追問，「沒關係。這座島，總有一天會讓我們再見面。」", ["skl_2_done", "skl_lied"], [aff(CARLOS, -5, "瞞著他"), mem("找到了骷髏潮島深層的寶庫，瞞著卡洛斯說寶庫是空的。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

skl3 = {
    "id": "skl_kraken",
    "title": "島的頭骨",
    "summary": "骷髏潮島不是島——是一頭巨妖的頭骨。紅鬚把寶藏藏在這裡，就是為了讓它看守。要帶走寶藏，就得讓巨妖睡著。（骷髏潮島・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": RENO, "min_level": 11, "requires": need("skl_2_done"),
        "text": "雷諾把一張七潮議會的通行令塞給你：「白鯨要親自帶艦隊去骷髏潮島——黑帆也是。」他壓低聲音，「島底下有東西在動。漁民說，海面上出現了比船還大的觸手。」他看著你，「在兩邊的艦隊開打之前，讓那東西回去睡。」",
    },
    "start_flags": ["skl_kraken"],
    "nodes": [
        {
            "id": "lich", "title": "在骷髏潮島的底層擊退鹽化巫妖船長",
            "text": "底層是一片被海水淹沒的洞窟，洞頂是巨大的骨頭——巨妖的頭骨內側。一個鹽化巫妖船長和一條巨妖觸手擋在路上，巫妖的帽子上插著紅鬚的羽毛。",
            "at": at_dun("skull_isle", "abyss"), "requires": need("skl_kraken"), "kind": "combat",
            "enemies": [["salt_lich_captain", 1], ["kraken_tentacle", 1]],
            "success": step("巫妖碎成了一地的鹽。前方，洞窟的最深處，一隻比月亮還大的眼睛睜開了。", ["skl_eye"]),
            "fail": step("你們被觸手捲進了海水裡，好不容易才游上來。前方，洞窟的最深處，一隻比月亮還大的眼睛睜開了。", ["skl_eye"], [hp(-0.2)]),
        },
        {
            "id": "kraken", "title": "在骷髏潮島的底層讓巨妖睡回去",
            "text": "骷髏潮島的巨妖不說話，也不聽——它只是看守，看守紅鬚的寶藏，看守了三百年。一個鹽化巫妖船長從它的觸手間走了出來。",
            "at": at_dun("skull_isle", "abyss"), "requires": need("skl_eye"), "kind": "combat",
            "enemies": [["kraken_of_skull_isle", 1], ["salt_lich_captain", 1]],
            "success": step("巨妖的眼睛慢慢地閉上了，觸手一條一條地沉回了海底。" + ECHO + "紅鬚把寶藏交給它的那一夜，還會在這裡一次又一次地重演，它也會再睜開眼睛。", ["skl_asleep"]),
            "fail": step("你們撐不住了，可巨妖在吞下巫妖之後，眼睛自己慢慢地閉上了。" + ECHO + "它還會再睜開眼睛。", ["skl_asleep"], [hp(-0.25)]),
        },
        {
            "id": "treasure", "title": "決定紅鬚寶藏的去處",
            "text": "巨妖睡著了，寶庫的箱子終於能搬出島了。你打開箱子：裡面是三百年前被紅鬚搶走的東西——商船的貨單、漁村的祭器、一國的王冠，還有一封信：「給能活著走出這座島的人：把它們還回去。」",
            "at": at_dun("skull_isle", "abyss"), "requires": need("skl_asleep"), "kind": "choice",
            "options": [
                {"label": "照紅鬚的信，把東西還回去", "success": done("你花了三個月，把三百年前的東西一件一件地還給了它們的後人：漁村的祭器回到了神龕上，王冠回到了一個早已不存在的國家的博物館。紅鬚的最後一個願望完成了。白鯨和黑帆的艦隊在骷髏潮島外對峙了一夜，發現島上什麼都沒有，各自回航了。", ["skl_done", "skl_returned"], [aff(RENO, 20, "讓兩邊的艦隊沒有開打"), rep(TIDES, 15), mem("讓骷髏潮島的巨妖睡了回去，照海盜王紅鬚的遺願，把三百年前被搶走的東西還給了它們的後人。", 3)])},
                {"label": "交給七潮議會", "success": done("白鯨把寶藏收進了七潮議會的金庫：「議會會依法處理。」黑帆的艦隊在外海等了一天，最後空手而回。卡洛斯在港口和你擦肩而過時，只說了一句：「朋友，你選了白鯨。」", ["skl_done", "skl_council"], [rep(TIDES, 20), aff(CARLOS, -10, "選了議會"), money(500), mem("讓骷髏潮島的巨妖睡了回去，把海盜王紅鬚的寶藏交給了七潮議會。", 3)])},
                {"label": "和卡洛斯五五分帳", "success": done("卡洛斯的船載著寶藏駛進了夜色裡。你分到了一大筆錢，卡洛斯舉杯：「敬紅鬚——和不怕島的朋友。」議會的懸賞令上，從此多了一個名字。", ["skl_done", "skl_shared"], [aff(CARLOS, 20, "守了五五分帳的約定"), money(1200), rep(TIDES, -10), mem("讓骷髏潮島的巨妖睡了回去，和走私王卡洛斯五五分了海盜王紅鬚的寶藏。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 回音峽谷 ----------------
ecc1 = {
    "id": "ecc_missing_hunter",
    "title": "沒有回來的獵手",
    "summary": "夜爪部落的年輕獵手要獨自潛入回音峽谷的「試煉之谷」，取得谷底的圖騰獸骨，才能成為部落的正式成員。今年，有一個獵手七天沒有回來。（回音峽谷・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": SAFF, "min_level": 5,
        "text": "薩芙從陰影裡走出來，聲音比平常更冷：「試煉之谷，夜爪的禁地。外人不能進。」她頓了頓，「可是我的妹妹七天沒有回來。夜爪的規矩不准任何族人去找她——那是她自己的試煉。」她看著你，「你不是夜爪。規矩管不到你。」",
    },
    "start_flags": ["ecc_start"],
    "nodes": [
        {
            "id": "rule", "title": "在沙堡營地的神殿學試煉之谷的規矩",
            "text": "沙堡營地神殿的老祭司是夜爪出身：「試煉之谷裡的回音亡魄，會循著聲音獵殺。進去的人不能說話、不能喊、不能唱歌。」他看著你，「連心跳都要放慢。」",
            "at": at_cell("sandcastle", "temple"), "requires": need("ecc_start"), "kind": "check",
            "check": {"attr": "dex", "dc": 13},
            "success": step("你學會了夜爪的靜步：腳跟先著地、呼吸只用鼻子。老祭司點點頭：「中層有一面回音牆，她如果還活著，會躲在牆後面。」", ["ecc_quiet"]),
            "fail": step("你怎麼也學不會靜步，老祭司嘆了口氣，給了你一雙用沙狐毛縫的鞋：「穿著它，至少腳步聲會小一點。」", ["ecc_quiet"]),
        },
        {
            "id": "middle", "title": "在回音峽谷的中層找到薩芙的妹妹",
            "text": "中層的峽谷窄得只能側身通過，每一聲腳步都被岩壁放大成雷鳴。一個回音亡魄循著你的心跳聲飄了過來，兩隻岩縫蛛從牆縫裡爬了出來。",
            "at": at_dun("echo_canyon", "middle"), "requires": need("ecc_quiet"), "kind": "combat",
            "enemies": [["echo_wraith", 1], ["rock_spider", 2]],
            "success": step("亡魄散了。回音牆後，一個黑色耳朵的年輕獵手縮在角落裡，嘴巴用布綁著——她自己綁的，怕自己忍不住出聲。她看見你，眼淚掉了下來。", ["ecc_found"]),
            "fail": step("你們被逼退到了回音牆邊，牆後伸出一隻手把你拉了進去——是她，嘴巴用布綁著。她看著你，眼淚掉了下來。", ["ecc_found"], [hp(-0.15)]),
        },
        {
            "id": "bring", "title": "決定要不要帶她出去",
            "text": "她解開了嘴上的布，用極小的聲音說：「我還沒拿到圖騰獸骨。出去了……就失敗了。」",
            "at": at_dun("echo_canyon", "middle"), "requires": need("ecc_found"), "kind": "choice",
            "options": [
                {"label": "「先出去，明年再來」", "success": done("你帶著她走出了峽谷。薩芙在谷口等著，看見妹妹的那一刻，她第一次在白天露出了臉。她沒有說謝謝——只是把一根黑色的羽毛插在了你的衣領上。", ["ecc_1_done", "ecc_out"], [aff(SAFF, 20, "救回了她的妹妹"), mem("從回音峽谷的試煉之谷救回了夜爪首領薩芙的妹妹。")])},
                {"label": "「我陪妳拿到骨頭」", "success": done("她看著你，很久，點了點頭。你們一起往更深處走，可是走到深層的入口時，她停下了：「……前面有東西在哭。很多很多的聲音。」你們決定先出去。薩芙在谷口等著，聽完妹妹的話，臉色變了。", ["ecc_1_done", "ecc_deeper"], [aff(SAFF, 15, "救回了她的妹妹"), mem("從回音峽谷救回了薩芙的妹妹，她說深層有很多很多的聲音在哭。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

ecc2 = {
    "id": "ecc_calamity_shade",
    "title": "浩劫的殘影",
    "summary": "回音峽谷的深層，回聲從來沒有停過——傳說那是遠古一場浩劫的亡魂。夜爪部落世代守著試煉之谷，卻沒有人知道那場浩劫是什麼。（回音峽谷・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": SAFF, "min_level": 8, "requires": need("ecc_1_done"),
        "text": "薩芙在夜裡找到你：「我妹妹說深層有很多聲音在哭。」她把一卷用獸皮寫的族譜攤開，「夜爪世代守著試煉之谷，可是族譜的第一頁被撕掉了。」她看著你，「我想知道，我們在守什麼。」",
    },
    "start_flags": ["ecc_calamity"],
    "nodes": [
        {
            "id": "tale", "title": "在沙堡營地的情報商打聽遠古浩劫的傳說",
            "text": "沙堡營地的情報商是個沙痕部落的老人：「遠古浩劫？荒野的每個部落都有不同的說法。」他壓低聲音，「可是所有的說法都有一句一樣的話：『那個聲音說了一句話，荒野就死了一半。』」",
            "at": at_cell("sandcastle", "informant"), "requires": need("ecc_calamity"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你把各部落的傳說拼在一起：浩劫是一個「聲音」引起的，貓魅族的始祖娜依卡用自己的命把那個聲音封進了峽谷，最初的夜爪就是替她守門的人。", ["ecc_tale"]),
            "fail": step("情報商收了一筆錢，只告訴你：「那個聲音說了一句話，荒野就死了一半。」", ["ecc_tale"], [money(-80)]),
        },
        {
            "id": "deep", "title": "在回音峽谷的深層擊退浩劫殘影",
            "text": "深層的岩壁上，回聲凝成了人形——浩劫殘影，千年前死在浩劫裡的人，還在重複著死前的那一刻。一頭圖騰獸被殘影的哭聲驚動，從岩縫裡衝了出來。",
            "at": at_dun("echo_canyon", "deep"), "requires": need("ecc_tale"), "kind": "combat",
            "enemies": [["calamity_shade", 1], ["totem_beast", 1]],
            "success": step("殘影散了。岩壁上露出了一幅被回聲磨了千年的壁畫：一個貓魅族女人站在峽谷口，張開雙臂，擋住了一團黑色的聲音。", ["ecc_mural"]),
            "fail": step("你們被逼退了，可在撤退時，岩壁上的回聲散開了一角，露出了一幅壁畫：一個貓魅族女人張開雙臂，擋住了一團黑色的聲音。", ["ecc_mural"], [hp(-0.2)]),
        },
        {
            "id": "page", "title": "決定要不要告訴薩芙",
            "text": "你把壁畫拓了下來。這就是族譜被撕掉的第一頁——夜爪不是在守一個試煉場，是在守一個封印。",
            "at": at_npc(SAFF), "requires": need("ecc_mural"), "kind": "choice",
            "options": [
                {"label": "把拓片交給薩芙", "success": done("薩芙看著拓片，很久沒有說話。最後，她把拓片縫進了族譜的第一頁：「夜爪……原來是守門人。」她第一次在白天召集了全部落，把這一頁唸給所有人聽。", ["ecc_2_done", "ecc_told"], [aff(SAFF, 20, "替夜爪找回了第一頁"), rep(TRIBES, 10), mem("在回音峽谷的深層找到了遠古浩劫的壁畫：夜爪是替始祖娜依卡守住浩劫之聲的守門人。")])},
                {"label": "交給大祭禮", "success": done("你把拓片送到了靜潮綠洲。大祭禮看完，沉默了很久，派人把薩芙請到了祭壇。兩個人談了一整夜——那是夜爪首領第一次走進月尾部落的祭壇。", ["ecc_2_done", "ecc_rite"], [aff(SAFF, 10, "讓她被聽見"), rep(TRIBES, 15), mem("在回音峽谷的深層找到了遠古浩劫的壁畫，交給了荒野部落聯盟的大祭禮。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

ecc3 = {
    "id": "ecc_voice_of_catastrophe",
    "title": "浩劫之聲",
    "summary": "回音峽谷的封印在崩解。千年前引發荒野浩劫的那個聲音——浩劫之聲——正在醒來。圖騰獸王守在它上面，就是為了不讓任何人聽見它。（回音峽谷・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": SAFF, "min_level": 11, "requires": need("ecc_2_done"),
        "text": "峽谷的回音變成了尖叫，整個沙堡營地的人都在夜裡摀著耳朵。薩芙帶著全部的夜爪戰士站在峽谷口：「封印要破了。」她把一根黑色的羽毛綁在你的手腕上，「夜爪守門千年。今天，請你和我們一起守。」",
    },
    "start_flags": ["ecc_voice"],
    "nodes": [
        {
            "id": "colossus", "title": "在回音峽谷的底層擊退圖騰巨像",
            "text": "底層的峽谷裂成了一道深淵。一尊圖騰巨像和浩劫的回音擋在路上——巨像身上刻滿了歷代夜爪守門人的名字，回音用千年前死者的聲音在尖叫。",
            "at": at_dun("echo_canyon", "abyss"), "requires": need("ecc_voice"), "kind": "combat",
            "enemies": [["totem_colossus", 1], ["catastrophe_echo", 1]],
            "success": step("回音散了，巨像跪了下來——像是在向你行禮。前方，深淵的底部，有一團黑色的東西在蠕動，還沒有發出聲音。", ["ecc_below"]),
            "fail": step("你們被尖叫震得頭破血流，可夜爪的戰士們一起吹響了骨哨，壓過了回音。前方，深淵的底部，有一團黑色的東西在蠕動。", ["ecc_below"], [hp(-0.2)]),
        },
        {
            "id": "voice", "title": "在回音峽谷的底層讓浩劫之聲沉默",
            "text": "浩劫之聲沒有形體，只是一團即將說出口的話。它不聽，也不回答——它只想說完千年前那一句沒說完的話。浩劫的回音從它的周圍湧了出來。",
            "at": at_dun("echo_canyon", "abyss"), "requires": need("ecc_below"), "kind": "combat",
            "enemies": [["voice_of_catastrophe", 1], ["catastrophe_echo", 1]],
            "success": step("浩劫之聲沉了下去，那句話沒有說完。" + ECHO + "千年前浩劫的那一刻，還會在這裡一次又一次地重演，它也會再醒來，再試著說完那句話。", ["ecc_silenced"]),
            "fail": step("你們撐不住了，可薩芙和所有的夜爪戰士一起發出了千年來第一聲吶喊，蓋過了那團聲音。浩劫之聲沉了下去。" + ECHO + "它還會再醒來。", ["ecc_silenced"], [hp(-0.25)]),
        },
        {
            "id": "keep", "title": "決定封印怎麼守下去",
            "text": "峽谷安靜了。薩芙看著深淵，又看著你：「夜爪守門千年。只有夜爪。」她頓了頓，「你說，以後該怎麼守？」",
            "at": at_npc(SAFF), "requires": need("ecc_silenced"), "kind": "choice",
            "options": [
                {"label": "「讓四個部落一起守」", "success": done("薩芙把這件事帶到了祭風原。四部落的族長吵了三天，最後決定：試煉之谷從此是四部落共同的試煉場，每個部落的年輕人都要來守一次門。薩芙說，這是夜爪千年來第一次覺得不孤單。", ["ecc_done", "ecc_shared"], [aff(SAFF, 25, "讓夜爪不再孤單"), rep(TRIBES, 15), mem("在回音峽谷的底層讓浩劫之聲沉默，讓荒野四部落從此一起守住封印。", 3)])},
                {"label": "「夜爪的方式，夜爪最清楚」", "success": done("薩芙點點頭，在峽谷口刻下了一行新的字：「守門人——夜爪，與一位外人。」從那天起，夜爪的試煉多了一條：要記得那個人的名字。", ["ecc_done", "ecc_nightclaw"], [aff(SAFF, 25, "替夜爪守住了門"), rep(TRIBES, 10), mem("在回音峽谷的底層和夜爪部落一起讓浩劫之聲沉默。你的名字被刻在了峽谷口。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 流沙聖殿 ----------------
qst1 = {
    "id": "qst_unregistered",
    "title": "沒有登記的人",
    "summary": "冒險者公會的聯絡員塔莉手上有一份「沒回來的人」名單。這個月，名單上多了五個名字——全都是沒登記就跑進流沙聖殿的冒險者。（流沙聖殿・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": TALI, "min_level": 5,
        "text": "塔莉把一份名單摔在桌上，碎念個不停：「沒登記！沒登記！沒登記就跑進流沙聖殿！」她指著最後一個名字，聲音突然小了，「這個……是我弟弟。他說要找到黃金聖物，讓我不用再待在這個鬼地方。」她看著你，「登記一下。然後，替我去找他。」",
    },
    "start_flags": ["qst_start"],
    "nodes": [
        {
            "id": "register", "title": "在沙堡營地的公會登記流沙聖殿的探險",
            "text": "塔莉一邊替你登記，一邊碎念：「流沙陷阱、機關石門、墓穴毒蛇、日晷魔像……」她把一張畫滿標記的地圖塞給你，「這是三十年來每個回來的人告訴我的。中層，他們最後是在中層被看見的。」",
            "at": at_cell("sandcastle", "guild"), "requires": need("qst_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你把塔莉的地圖背得滾瓜爛熟，還發現了一條她沒注意到的路：中層的日晷魔像，每到正午會停下來對準太陽——那是唯一能通過的時候。", ["qst_registered"], [aff(TALI, 5, "認真登記")]),
            "fail": step("地圖太複雜，你只記住了一半。塔莉嘆了口氣：「……那我再畫一張給你。」", ["qst_registered"]),
        },
        {
            "id": "middle", "title": "在流沙聖殿的中層找到塔莉的弟弟",
            "text": "中層的甬道裡，到處都是古老的象形壁畫。一條墓穴毒蛇、一尊日晷魔像和一個裹布守衛守在一個被流沙半埋的人身邊——那人還活著，緊緊抱著一塊刻著太陽的石板。",
            "at": at_dun("quicksand_temple", "middle"), "requires": need("qst_registered"), "kind": "combat",
            "enemies": [["tomb_asp", 1], ["sundial_golem", 1], ["linen_guard", 1]],
            "success": step("守衛倒下了。你把塔莉的弟弟從流沙裡拉了出來。他渾身是沙，卻笑得很開心：「我找到了！太陽神諭的第一塊石板！」其他四個人，沒有在這裡。", ["qst_brother"]),
            "fail": step("你們被逼退了，可在撤退時把塔莉的弟弟從流沙裡拖了出來。他抱著一塊刻著太陽的石板：「太陽神諭！」", ["qst_brother"], [hp(-0.15)]),
        },
        {
            "id": "home", "title": "把弟弟帶回塔莉身邊",
            "text": "塔莉看見弟弟的那一刻，先罵了他半個時辰，然後抱著他哭了半個時辰。她弟弟還抱著那塊石板：「姊，這是太陽神諭！解開它，就能找到黃金聖物！」",
            "at": at_npc(TALI), "requires": need("qst_brother"), "kind": "choice",
            "options": [
                {"label": "「石板給我，我去解」", "success": done("塔莉的弟弟不情不願地把石板交給你。塔莉在他的名字旁邊畫了一個大大的圈：「回來了。」她看著名單上另外四個名字，「……他們呢？」", ["qst_1_done", "qst_tablet"], [aff(TALI, 15, "替她找回了弟弟"), mem("從流沙聖殿的中層救回了公會聯絡員塔莉的弟弟，他找到了太陽神諭的第一塊石板。")])},
                {"label": "「這種東西，交給公會」", "success": done("塔莉把石板鎖進了公會的保險箱：「沒登記的人找到的東西，公會沒收。」她弟弟哀嚎了一聲。塔莉看著名單上另外四個名字，「……他們呢？」", ["qst_1_done"], [aff(TALI, 10, "替她找回了弟弟"), mem("從流沙聖殿的中層救回了塔莉的弟弟，把太陽神諭的石板交給了公會。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

qst2 = {
    "id": "qst_sun_oracle",
    "title": "太陽神諭",
    "summary": "流沙聖殿的牆上鐫刻著「太陽神諭」——解開它的人，才能觸及聖所核心的黃金聖物。塔莉名單上的另外四個人，在深層解謎的時候被困住了。（流沙聖殿・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": TALI, "min_level": 8, "requires": need("qst_1_done"),
        "text": "塔莉把名單攤開，手指按著另外四個名字：「我弟弟說，他們在深層的獅身守衛前分開了——那四個人在解謎。」她咬著嘴唇，「解錯了，就會被流沙吞下去。解對了……我不知道。從來沒有人解對過。」",
    },
    "start_flags": ["qst_oracle"],
    "nodes": [
        {
            "id": "riddle", "title": "在沙堡營地的神殿讀懂太陽神諭",
            "text": "沙堡營地神殿的老祭司看著石板上的象形文字：「赫塔尼的古文。」他一個字一個字地唸，「『我早上用四條腿，中午用兩條，晚上——』」他停了，「後面被沙磨掉了。」",
            "at": at_cell("sandcastle", "temple"), "requires": need("qst_oracle"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你想了一夜，終於想通了：這不是在問「人」——赫塔尼人崇拜太陽，四條腿是日出時的四道光，兩條腿是正午時的影子，晚上……沒有腿，因為太陽已經下山了。答案是「太陽的一天」。", ["qst_answer"]),
            "fail": step("你想不出答案。老祭司說：「赫塔尼人崇拜太陽。答案一定和太陽有關。」", ["qst_answer"]),
        },
        {
            "id": "deep", "title": "在流沙聖殿的深層找到被困的冒險者",
            "text": "深層的獅身守衛前，四個冒險者被困在流沙裡，只剩下肩膀以上露在外面。一尊獅身守衛和一個太陽祭司木乃伊看著他們，像在等他們沉下去。",
            "at": at_dun("quicksand_temple", "deep"), "requires": need("qst_answer"), "kind": "combat",
            "enemies": [["sphinx_guardian", 1], ["sun_priest_mummy", 1]],
            "success": step("守衛倒下了，流沙停止了下沉。你把四個人一個一個地拉了出來。最後一個人喘著氣說：「我們答了『人』……錯了。」", ["qst_rescued"]),
            "fail": step("你們被逼退了，可在撤退時，你對著獅身守衛大聲說出了答案。流沙停了。四個人爬了出來。", ["qst_rescued"], [hp(-0.2)]),
        },
        {
            "id": "names", "title": "把四個人帶回塔莉身邊",
            "text": "塔莉看著四個渾身是沙的冒險者，又一次先罵了半個時辰。然後，她把名單上的四個名字一個一個地畫上了圈——三十年來，名單上第一次有這麼多圈。",
            "at": at_npc(TALI), "requires": need("qst_rescued"), "kind": "choice",
            "options": [
                {"label": "「名單上其他的人呢？」", "success": done("塔莉看著名單上三十年來沒有畫圈的名字，很久，才說：「他們都在底層。太陽神的化身……沒有人回來過。」她把名單交給你，「如果你要去……替我把他們的名字唸給太陽神聽。」", ["qst_2_done", "qst_list"], [aff(TALI, 20, "讓她的名單上多了圈"), mem("在流沙聖殿的深層解開了太陽神諭，救回了被流沙困住的四個冒險者。塔莉把三十年來沒回來的人的名單交給了你。")])},
                {"label": "「以後，沒登記的人都要先過我這關」", "success": done("塔莉笑了——你第一次看見她笑：「好啊。以後你就是流沙聖殿的登記官。」她把一枚公會的徽章別在你的胸口，「不登記就跑進去的人，你替我抓回來。」", ["qst_2_done", "qst_registrar"], [aff(TALI, 15, "幫她分擔了工作"), mem("在流沙聖殿的深層救回了四個冒險者，塔莉讓你當了流沙聖殿的名譽登記官。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

qst3 = {
    "id": "qst_sun_god_avatar",
    "title": "太陽神的化身",
    "summary": "流沙聖殿最深處，赫塔尼古國獻上一切召喚的太陽神化身還在燃燒。末代法老的詛咒，原來只是它的餘光。黃金聖物就在它的身後。（流沙聖殿・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "guild", "location": "sandcastle", "min_level": 11, "requires": need("qst_2_done"),
        "text": "沙堡營地的公會裡，塔莉把一份名單放在你面前——三十年來，所有沒回來的人。「他們都在底層。」她說，「太陽神的化身……燒了三千年。」守備長葛雷站在她身後：「沙堡營地的冒險者，從來沒有人走到過底層。你會是第一個。」",
    },
    "start_flags": ["qst_sun"],
    "nodes": [
        {
            "id": "scarabs", "title": "在流沙聖殿的底層擊退聖甲蟲女王",
            "text": "底層的金字塔頂端，日晷光陣在牆上緩緩轉動。一個太陽神殿守衛和聖甲蟲女王擋住了通往聖所的路——成千上萬的黃金聖甲蟲在她身邊飛舞。",
            "at": at_dun("quicksand_temple", "abyss"), "requires": need("qst_sun"), "kind": "combat",
            "enemies": [["solar_guardian", 1], ["scarab_swarm_queen", 1]],
            "success": step("女王倒下了，聖甲蟲們散進了牆縫。前方，聖所的門開著，裡面亮得像正午的太陽。", ["qst_sanctum"]),
            "fail": step("你們被聖甲蟲咬得遍體鱗傷，可在日晷光陣轉到正午的那一刻，守衛停下了。你們衝過了門。聖所裡亮得像正午的太陽。", ["qst_sanctum"], [hp(-0.2)]),
        },
        {
            "id": "avatar", "title": "在流沙聖殿的底層打倒太陽神的化身",
            "text": "太陽神的化身是一團燃燒的日輪，日輪的中心是一個沒有臉的人形。祂不說話，也不聽——赫塔尼人獻上了一切，祂也只學會了燃燒。一個太陽神殿守衛從光裡走了出來。",
            "at": at_dun("quicksand_temple", "abyss"), "requires": need("qst_sanctum"), "kind": "combat",
            "enemies": [["sun_god_avatar", 1], ["solar_guardian", 1]],
            "success": step("日輪的光暗了下去。" + ECHO + "赫塔尼古國獻上一切的那一天，還會在這裡一次又一次地重演，祂也會再燃燒起來。聖所的祭壇上，黃金聖物在等著。", ["qst_dim"]),
            "fail": step("你們撐不住了，可日晷光陣轉過了正午，化身的光自己暗了下去。" + ECHO + "祂還會再燃燒起來。祭壇上，黃金聖物在等著。", ["qst_dim"], [hp(-0.25)]),
        },
        {
            "id": "relic", "title": "決定黃金聖物的去處",
            "text": "祭壇上的黃金聖物是一枚太陽形的胸針，旁邊散落著三十年來沒回來的冒險者的遺物。據說，貿然拿走聖物的人，會被古老的詛咒烙印終生。",
            "at": at_dun("quicksand_temple", "abyss"), "requires": need("qst_dim"), "kind": "choice",
            "options": [
                {"label": "留下聖物，帶走冒險者的遺物", "success": done("你把三十年來沒回來的人的遺物一件一件地收好，對著空蕩蕩的聖所唸完了塔莉的名單。回到沙堡營地，塔莉把名單上的每一個名字都畫上了圈——不是因為他們回來了，是因為終於有人帶他們回家了。", ["qst_done", "qst_names"], [aff(TALI, 25, "帶回了名單上的每一個人"), aff(GRAY, 15, "成了第一個走到底層的冒險者"), rep(TRIBES, 10), mem("在流沙聖殿的底層打倒了太陽神的化身，沒有拿走黃金聖物，帶回了三十年來沒回來的冒險者的遺物。", 3)])},
                {"label": "拿走黃金聖物", "success": done("你拿起了太陽胸針。它燙得像一小塊太陽，在你的掌心烙下了一個圓形的印記——詛咒，或者祝福，誰也說不清。回到沙堡營地，阿茲爾開出了一座城的價錢，你沒有賣。從那天起，你在沙漠裡永遠不會迷路——太陽總是在你的手心裡指路。", ["qst_done", "qst_relic"], [aff(GRAY, 15, "成了第一個走到底層的冒險者"), money(800), {"type": "perk", "perk": "pathfinder", "options": ["survivor", "lucky"]}, mem("在流沙聖殿的底層打倒了太陽神的化身，拿走了黃金聖物。掌心多了一個太陽的烙印。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

BATCH14 = [msr1, msr2, msr3, thc1, thc2, thc3, vh1, vh2, vh3, tfc1, tfc2, tfc3, skl1, skl2, skl3, ecc1, ecc2, ecc3, qst1, qst2, qst3]
