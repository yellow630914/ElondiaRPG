"""角色線（R9，2026-11-06）：白百合巡禮（奧菈莉婭＆格溫德琳）、全城跑最快的精靈（琥珀）。

寫進：
- data/rules/stories.json：8 個任務（各四個；一～三非成人向，四成人向）。同 id 就地換掉，可以重跑。
- data/rules/enemies.json：捕奴隊的打手（Lv.5）、捕奴隊頭目「灰狗」（Lv.13 頭目）。
- data/rules/items.json：霧銀耳墜（琥珀線的獨特飾品）。
- data/world/npcs.json：三人加 no_attack、結局之後的 stages；琥珀加成人向外貌。

在 repo 根目錄執行：python3 worldgen/scripts/elondia/char_lines38.py
注意：story_batch1.py 不能再重跑（會蓋掉之後直接寫進 stories.json 的資料，例如時段），新的任務都用 east_story_io 的 write_stories 寫。
"""

import json
import sys

sys.path.insert(0, 'worldgen/scripts/elondia')
from east_story_io import write_items, write_stories  # noqa: E402

AUR, GWEN, AMB, SEPH = 'npc_aurelia', 'npc_gwendolyn', 'npc_amber', 'npc_seph_mistveil'


def aff(npc, d, why):
    return {"type": "affinity", "npc": npc, "delta": d, "reason": why}


def mem(text, imp=2):
    return {"type": "memory", "summary": text, "importance": imp}


def rep(f, d):
    return {"type": "reputation", "faction": f, "delta": d}


def need(*flags):
    return {"flags": list(flags)}


def at_cell(loc, cell):
    return {"where": "cell", "location": loc, "cell": cell}


def at_npc(npc):
    return {"where": "npc", "npc": npc}


def at_out(loc):
    return {"where": "outskirts", "location": loc}


# ================= 白百合巡禮 =================

pil1 = {
    "id": "pil_lost_book",
    "title": "巡禮手帳",
    "summary": "奧菈莉婭喝醉了找人比劍，把蓋了第一個印的巡禮手帳輸給了朝聖路上的盜匪。格溫德琳紅著眼眶來求你幫忙。（白百合巡禮・一）",
    "rank": "D",
    "merit": 6,
    "start": {
        "kind": "npc", "npc": GWEN, "min_level": 5,
        "text": "一個穿著修女服的金髮少女拉住你的袖子，眼眶紅紅的：「請、請問……你是冒險者吧？」她低下頭，聲音細得快聽不見，「奧菈莉婭昨晚喝醉了，找人比劍，把巡禮手帳當賭注輸掉了……手帳弄丟就要從頭巡禮。我一個人什麼都做不到。」她抬起眼睛，又補了一句，「啊，對了，那些盜匪往索里耶爾東邊的朝聖路走了，帶頭的左耳缺了一塊。」",
    },
    "start_flags": ["pil_start"],
    "nodes": [
        {
            "id": "wake", "title": "到索里耶爾的旅店叫醒宿醉的奧菈莉婭",
            "text": "旅店的房間裡酒氣沖天，衣服丟了一地。床上的金髮女子被格溫德琳搖了半天才睜開眼，坐起來的那一刻已經是一張清冷端正的臉：「我沒有喝醉。」她說，「手帳在……」她摸了摸腰間，臉色一點一點白了。",
            "at": at_cell("soriel", "inn"), "requires": need("pil_start"), "kind": "story", "hours": "day",
            "allies": [AUR, GWEN],
            "success": {
                "text": "奧菈莉婭什麼都不記得了，卻堅持要自己去拿回來：「騎士的過失，騎士自己收拾。」她扣上劍帶時手還在抖。格溫德琳默默把一包解酒藥塞進她的行李，回頭對你笑了笑：「麻煩你了。她清醒的時候，很強的。」",
                "set_flags": ["pil_awake"],
                "effects": [aff(AUR, 5, "被你看到宿醉的樣子"), aff(GWEN, 5, "答應幫忙")],
            },
        },
        {
            "id": "raiders", "title": "在索里耶爾近郊追回巡禮手帳",
            "text": "朝聖路邊的樹下，三個盜匪正在分贓，其中一個左耳缺了一塊，正拿著一本蓋著聖環印的小冊子搧風。奧菈莉婭拔劍的聲音很輕，眼神卻冷得像冬天的河水。",
            "at": at_out("soriel"), "requires": need("pil_awake"), "kind": "combat",
            "enemies": [["pilgrim_raider", 3]], "allies": [AUR, GWEN],
            "success": {
                "text": "清醒的奧菈莉婭強得嚇人，三招就挑飛了缺耳盜匪的刀。格溫德琳從泥地裡撿起手帳，用袖子擦乾淨，抱在胸前不放。奧菈莉婭收劍入鞘，看了你一眼：「你的劍很穩。」這是她今天說的最長的一句話。",
                "set_flags": ["pil_book"],
            },
            "fail": {
                "text": "盜匪們丟下手帳逃進了樹林。奧菈莉婭的手臂被劃了一刀，她看都沒看，先把手帳撿起來。格溫德琳一邊替她包紮一邊小聲唸：「明明說了不要逞強……」",
                "set_flags": ["pil_book"],
                "effects": [{"type": "hp", "ratio": -0.1}],
            },
        },
        {
            "id": "hand_over", "title": "決定巡禮手帳交給誰保管",
            "text": "回到城裡，格溫德琳把手帳遞給你：「你拿回來的，你決定吧。」奧菈莉婭別開臉，耳根卻紅了。格溫德琳笑得很溫柔，眼睛卻一直看著你的手。",
            "at": at_npc(GWEN), "requires": need("pil_book"), "kind": "choice",
            "options": [
                {
                    "label": "交給奧菈莉婭",
                    "success": {
                        "text": "奧菈莉婭接過手帳，握了很久：「……謝謝。」格溫德琳的笑容僵了一下，很快又恢復了。奧菈莉婭忽然轉向你：「巡禮的規矩，要有一位同行的證人。下一個印在河谷鎮的舊石橋……你願意當我們的證人嗎？」格溫德琳在旁邊輕聲說：「我們會在索里耶爾等你準備好。」",
                        "set_flags": ["pil_1_done"],
                        "effects": [aff(AUR, 15, "把手帳交還給她"), aff(GWEN, 5, "幫忙找回手帳"), mem("替奧菈莉婭追回了輸掉的巡禮手帳，交還給她本人；她請你當巡禮的同行證人。")],
                        "complete": True,
                    },
                },
                {
                    "label": "交給格溫德琳保管",
                    "success": {
                        "text": "格溫德琳把手帳收進懷裡，笑得眼睛彎彎的：「我就說嘛，她還會再弄丟的。」奧菈莉婭哼了一聲，沒有反駁。過了一會兒，她轉向你：「巡禮的規矩，要有一位同行的證人。下一個印在河谷鎮的舊石橋……你願意當我們的證人嗎？」",
                        "set_flags": ["pil_1_done"],
                        "effects": [aff(GWEN, 15, "把手帳交給她保管"), aff(AUR, 5, "幫忙找回手帳"), mem("替奧菈莉婭追回了輸掉的巡禮手帳，交給格溫德琳保管；兩人請你當巡禮的同行證人。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [{"type": "money", "amount": 300}, {"type": "xp", "amount": 450}],
}

pil2 = {
    "id": "pil_old_bridge",
    "title": "舊石橋的誓言",
    "summary": "巡禮的第二個印在河谷鎮的舊石橋。奧菈莉婭在銀鱗旅店喝醉了，當眾喊出格溫德琳是男的——正好被審判廷的審問官聽見。（白百合巡禮・二）",
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": GWEN, "min_level": 8, "min_affinity": 10, "requires": need("pil_1_done"),
        "text": "格溫德琳抱著巡禮手帳在旅店門口等你：「我們要去河谷鎮了，舊石橋的印。」接著壓低聲音，「……河谷鎮的銀鱗旅店有很好的酒。我會看著她的，可是，你也一起看著好不好？」",
    },
    "start_flags": ["pil_bridge"],
    "nodes": [
        {
            "id": "drink", "title": "到河谷鎮的銀鱗旅店找兩人",
            "text": "銀鱗旅店的長桌上，奧菈莉婭面前已經疊了五個空杯。一個醉漢湊過來摸格溫德琳的腰，嘻嘻笑著要她陪酒。奧菈莉婭一掌拍碎了桌角，站起來大喊：「他是男的又怎樣！他比你們這群渣滓乾淨一百倍！」整間旅店安靜了。角落裡，一個穿黑袍、腰間掛著印章的人慢慢放下了酒杯。",
            "at": at_cell("rivervale", "lm_silverscale_inn"), "requires": need("pil_bridge"), "kind": "story", "hours": "night",
            "allies": [AUR, GWEN],
            "success": {
                "text": "黑袍人走過來，亮出審判廷的徽章：「欺瞞聖職。」他看著格溫德琳的修女服，「以女子之身受牧師的認可，其實是男人。資格證書交出來，到審判迴廊受審。」格溫德琳的臉一下子失去了血色。奧菈莉婭的酒全醒了。",
                "set_flags": ["pil_outed"],
            },
        },
        {
            "id": "plead", "title": "在銀鱗旅店說服審判廷的審問官",
            "text": "審問官的兩個護衛已經按住了劍柄。格溫德琳低著頭，手指緊緊揪著裙擺，一句話也說不出來。奧菈莉婭想上前，被你攔住了——她現在開口只會更糟。",
            "at": at_cell("rivervale", "lm_silverscale_inn"), "requires": need("pil_outed"), "kind": "check",
            "check": {"attr": "cha", "dc": 15}, "allies": [AUR, GWEN],
            "success": {
                "text": "你提醒審問官：巡禮中的聖職者受教廷保護，在巡禮結束前不能審判，這是他們自己的規矩。審問官盯著你看了很久，收下了格溫德琳的資格證書：「巡禮結束，審判迴廊見。」他走的時候，格溫德琳才發現自己一直沒有呼吸。",
                "set_flags": ["pil_accused"],
                "effects": [aff(GWEN, 10, "替他說話")],
            },
            "fail": {
                "text": "審問官冷笑一聲，揮手要護衛把格溫德琳押走。奧菈莉婭的劍出鞘了——你只來得及拉住她的手腕：「到外面。別在這裡。」",
                "set_flags": ["pil_scuffle"],
            },
        },
        {
            "id": "scuffle", "title": "在河谷鎮近郊擋下審判廷的追捕者",
            "text": "審問官的兩個護衛追出了鎮外，手裡拿著鐐銬。格溫德琳躲在奧菈莉婭身後，奧菈莉婭擋在你身邊。",
            "at": at_out("rivervale"), "requires": need("pil_scuffle"), "kind": "combat",
            "enemies": [["inquisition_hunter", 2]], "allies": [AUR, GWEN],
            "success": {
                "text": "兩個追捕者被打倒在路邊。審問官遠遠看著，終於改口：「巡禮中的聖職者……照規矩，等巡禮結束。」他收走了格溫德琳的資格證書，「審判迴廊見。」",
                "set_flags": ["pil_accused"],
            },
            "fail": {
                "text": "追捕者把你們打得狼狽，卻沒能帶走格溫德琳——奧菈莉婭擋在他前面，一步也沒退。審問官看夠了，冷冷地說：「巡禮結束之後，審判迴廊見。」他收走了資格證書。",
                "set_flags": ["pil_accused"],
                "effects": [{"type": "hp", "ratio": -0.15}],
            },
        },
        {
            "id": "vow", "title": "在河谷鎮的舊石橋上發誓",
            "text": "舊石橋上，格溫德琳在手帳上蓋了第二個印。酒醒的奧菈莉婭站在橋中央，背對著你們，很久才開口：「是我害的。」她轉過身，在橋上單膝跪下，對格溫德琳發誓會保護他。格溫德琳搖頭，也跪下來：「不是保護。我不要再躲在你後面了。」兩個人都看向你——證人也要發誓。",
            "at": at_cell("rivervale", "lm_old_stone_bridge"), "requires": need("pil_accused"), "kind": "choice",
            "options": [
                {
                    "label": "「我會作證到最後」",
                    "success": {
                        "text": "你把手放在橋欄上，發誓作證到巡禮的最後一個印、到審判的最後一句話。奧菈莉婭點了點頭。格溫德琳笑了，這次的笑容裡沒有算計：「……那就說好了。」審判排在最後一個印之後，在那之前，誰也不能動他。",
                        "set_flags": ["pil_2_done"],
                        "effects": [aff(AUR, 10, "在舊石橋上發誓作證"), aff(GWEN, 10, "在舊石橋上發誓作證"), mem("在河谷鎮的舊石橋上，和奧菈莉婭、格溫德琳一起發誓：作證到巡禮的最後。")],
                        "complete": True,
                    },
                },
                {
                    "label": "「讓她在審判前滴酒不沾」",
                    "success": {
                        "text": "你看著奧菈莉婭：「我的誓言是，你在審判之前滴酒不沾。」奧菈莉婭愣住了，然後慢慢點頭：「……我答應。」格溫德琳捂著嘴，眼眶又紅了，這次是真的。審判排在最後一個印之後，在那之前，誰也不能動他。",
                        "set_flags": ["pil_2_done", "pil_sober"],
                        "effects": [aff(AUR, 5, "要她戒酒"), aff(GWEN, 15, "要她為他戒酒"), mem("在河谷鎮的舊石橋上，你要奧菈莉婭發誓：審判之前滴酒不沾。她答應了。")],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [{"type": "money", "amount": 600}, {"type": "xp", "amount": 900}],
}

ENDING_ORDER = "奧菈莉婭沒有接過任命狀。她說，聖騎士出征要帶隨軍牧師，她要格溫德琳；還要一位同行者，她要你。主教皺眉，看著主殿裡一雙雙眼睛，最後蓋了印。走出主殿時，格溫德琳挽著她的手，另一隻手悄悄勾住你的小指。"
ENDING_FREE = "奧菈莉婭把聖騎士的徽章放在祭壇上：「巡禮還沒走完。」她說的不是教廷的五個印。主殿裡一片譁然，她頭也不回地往外走，格溫德琳提著裙擺小跑著跟上，回頭對你伸出手：「走吧，證人。」"
SOBER_LINE = "「……我答應過你的。」她看著你，又補了一句。"


def ending(label, sober, free):
    say = "奧菈莉婭清醒地看著你們兩個：「這次我沒喝。所以聽好——我要你們兩個，都要。」" + (SOBER_LINE if sober else "")
    text = say + (ENDING_FREE if free else ENDING_ORDER)
    flags = ["pil_lovers", "pil_free" if free else "pil_order"]
    effects = [aff(AUR, 25, "清醒地告白"), aff(GWEN, 25, "三個人在一起")]
    effects += [rep("holy_ring", -5), rep("guild", 5)] if free else [rep("holy_ring", 5)]
    effects += [mem("巡禮的最後一個印。奧菈莉婭清醒地告白，三個人在一起了；" + ("她放下聖騎士的頭銜，三個人繼續巡禮。" if free else "她接受任命，要格溫德琳當隨軍牧師、你當同行者。"), 3),
                {"type": "companion", "npc": AUR, "mode": "voluntary"}]
    opt = {"label": label, "requires": {"flags": ["pil_sober"]} if sober else {"flags_none": ["pil_sober"]},
           "success": {"text": text, "set_flags": flags, "effects": effects, "complete": True}}
    return opt


pil3 = {
    "id": "pil_testimony",
    "title": "白百合的證言",
    "summary": "巡禮的最後三個印：晨曦聖殿、兩人長大的修道院、聖環主殿。審判廷查封了修道院，真理之鏡前的審判在等著格溫德琳。（白百合巡禮・三）",
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": GWEN, "min_level": 11, "min_affinity": 20, "requires": need("pil_2_done"),
        "text": "格溫德琳把手帳攤開給你看，五個格子已經蓋了兩個：「接下來是晨光城的晨曦聖殿，然後……然後就是審判了。」他把手帳闔上，抱在胸口，「你說過要作證到最後的。我記得喔。」",
    },
    "start_flags": ["pil_last"],
    "nodes": [
        {
            "id": "sanctum", "title": "到晨光城的晨曦聖殿蓋第三個印",
            "text": "晨曦聖殿的老修女替手帳蓋了第三個印，卻沒有放手。她把兩人拉到柱子後面，壓低聲音：「孩子們，回去看看吧。審判廷查封了你們的修道院，罪名是『把男孩當女孩養』。他們要燒掉院長的帳冊。」",
            "at": at_cell("dawnlight", "lm_dawn_sanctum"), "requires": need("pil_last"), "kind": "story", "hours": "day",
            "allies": [AUR, GWEN],
            "success": {
                "text": "格溫德琳的手在發抖。奧菈莉婭握住了它：「是我們的家。」她轉向你，第一次用懇求的語氣，「第四個印本來就在那裡。」",
                "set_flags": ["pil_sealed"],
            },
        },
        {
            "id": "abbey", "title": "在晨光城近郊趕走查封修道院的狂信騎士",
            "text": "修道院的門上釘著審判廷的封條，兩個塗黑了聖環的騎士正在把修女和孩子們往外趕，一個小女孩抱著布娃娃哭個不停。那不是審判廷的人——是越權的狂信者。",
            "at": at_out("dawnlight"), "requires": need("pil_sealed"), "kind": "combat",
            "enemies": [["zealot_templar", 2]], "allies": [AUR, GWEN],
            "success": {
                "text": "狂信騎士倒在修道院的台階上。院長嬤嬤顫巍巍地走出來，在被查封的門上替手帳蓋了第四個印：「我把他當女孩養，是因為他想穿那件衣服。我不後悔。」格溫德琳抱住她，哭得像個孩子。",
                "set_flags": ["pil_home"],
            },
            "fail": {
                "text": "狂信騎士們終究退走了，你們卻也傷得不輕。院長嬤嬤在被查封的門上替手帳蓋了第四個印，替每個人包紮：「我把他當女孩養，是因為他想穿那件衣服。我不後悔。」",
                "set_flags": ["pil_home"],
                "effects": [{"type": "hp", "ratio": -0.2}],
            },
        },
        {
            "id": "mirror", "title": "在索里耶爾的審判迴廊為格溫德琳作證",
            "text": "審判迴廊的盡頭立著真理之鏡，鏡框是黑色的鐵。格溫德琳穿著修女服站到鏡前，脊背挺得筆直。審問官念出罪名：「欺瞞聖職。」他轉向你：「證人，你要說什麼？」奧菈莉婭在旁聽席上握緊了拳頭——她答應過不鬧事。",
            "at": at_cell("soriel", "lm_judgment_cloister"), "requires": need("pil_home"), "kind": "choice",
            "options": [
                {
                    "label": "以信仰作證：鏡子照的是靈魂",
                    "check": {"attr": "fai", "dc": 16},
                    "success": {
                        "text": "你說，真理之鏡照的是靈魂，不是衣服；一個二十年來替病人換藥、替醉鬼擋酒的牧師，靈魂上有什麼污點？鏡子亮了起來，映出的格溫德琳和站在鏡前的他一模一樣。旁聽席上有人開始禱告。審問官的筆停在半空，最後在卷宗上寫下：無罪。",
                        "set_flags": ["pil_judged", "pil_cleared"],
                        "effects": [aff(GWEN, 10, "在真理之鏡前替他作證")],
                    },
                    "fail": {
                        "text": "你的話說得結結巴巴。可是鏡子亮了起來，沒有照出任何污點。審問官看著鏡子，又看看卷宗，還是在上面記了一筆「行止可議」，退還了資格證書。格溫德琳握著證書，輕聲說：「……夠了。這樣就夠了。」",
                        "set_flags": ["pil_judged"],
                    },
                },
                {
                    "label": "以言語說服：審判的是制度",
                    "check": {"attr": "cha", "dc": 16},
                    "success": {
                        "text": "你問審問官：教廷的哪一條經文說牧師不能穿修女服？他翻遍了卷宗，找不到。你又問：如果找不到，被審判的是格溫德琳，還是審判廷自己？旁聽席上一陣騷動。審問官合上卷宗：「……無罪。」",
                        "set_flags": ["pil_judged", "pil_cleared"],
                        "effects": [aff(GWEN, 10, "在真理之鏡前替他作證")],
                    },
                    "fail": {
                        "text": "審問官打斷了你的話。可是鏡子亮了起來，沒有照出任何污點。審問官看著鏡子，還是在卷宗上記了一筆「行止可議」，退還了資格證書。格溫德琳握著證書，輕聲說：「……夠了。這樣就夠了。」",
                        "set_flags": ["pil_judged"],
                    },
                },
                {
                    "label": "請伊莎貝拉替他說話",
                    "requires": {"flags": ["isab_1_done"]},
                    "success": {
                        "text": "旁聽席的門被推開，聖殿騎士團長伊莎貝拉大步走進來，把一疊公文摔在審問官桌上：「這孩子去年在城外替我的騎士包紮了一整夜。審判廷那時候在哪？」審問官的臉色很難看。鏡子亮了，沒有任何污點。卷宗上寫的是：無罪。",
                        "set_flags": ["pil_judged", "pil_cleared"],
                        "effects": [aff(GWEN, 10, "找來伊莎貝拉替他說話")],
                    },
                },
                {
                    "label": "引用改回的經文",
                    "requires": {"flags": ["doct_reform"]},
                    "success": {
                        "text": "你念出改回原貌的那一段經文：「侍奉者以其心，不以其衣。」那是審判廷自己公布的版本。審問官沉默了很久，在卷宗上寫下：無罪。鏡子亮了起來，照出的格溫德琳在笑。",
                        "set_flags": ["pil_judged", "pil_cleared"],
                        "effects": [aff(GWEN, 10, "引經據典替他作證")],
                    },
                },
                {
                    "label": "搬出晨霧修道院的聖者當先例",
                    "requires": {"flags": ["mabb_named"]},
                    "success": {
                        "text": "你說出晨霧修道院那位被抹去名字、又被你找回名字的聖者——他也曾被當成不該存在的人。如果教廷已經承認錯了一次，還要再錯一次嗎？審問官的手停了。卷宗上寫的是：無罪。",
                        "set_flags": ["pil_judged", "pil_cleared"],
                        "effects": [aff(GWEN, 10, "搬出先例替他作證")],
                    },
                },
            ],
        },
        {
            "id": "ordain", "title": "到索里耶爾的聖環主殿蓋最後一個印",
            "text": "聖環主殿的主教替手帳蓋了第五個印，接著宣讀任命狀：聖騎士奧菈莉婭，派往東方邊境的分團，即日啟程；牧師格溫德琳，回原修道院服務。兩個人要分開了。格溫德琳低著頭，笑容一點一點碎掉。奧菈莉婭沒有看任命狀，她看著你們兩個。",
            "at": at_cell("soriel", "lm_holy_ring_cathedral"), "requires": need("pil_judged"), "kind": "choice", "hours": "day",
            "options": [
                ending("接受任命，三個人一起去", False, False),
                ending("放下頭銜，繼續巡禮", False, True),
                ending("接受任命，三個人一起去", True, False),
                ending("放下頭銜，繼續巡禮", True, True),
            ],
        },
    ],
    "rewards": [{"type": "money", "amount": 1500}, {"type": "xp", "amount": 2000}],
}

pil4 = {
    "id": "pil_lily_night",
    "title": "白百合的夜",
    "summary": "巡禮結束了。格溫德琳說要辦一場慶祝的晚餐——然後，他早就訂好了房間。（白百合巡禮・四）",
    "tags": ["adult"],
    "rank": "B",
    "merit": 5,
    "start": {
        "kind": "npc", "npc": GWEN, "min_level": 11, "min_affinity": 40, "requires": {"flags_any": ["pil_lovers"]},
        "text": "格溫德琳把一張晚餐的帳單塞進你手裡，背面寫著旅店的房號：「慶祝巡禮結束。」他眨眨眼睛，「奧菈莉婭說她只喝一杯。我說好，那我們就有很多時間了。」",
    },
    "start_flags": ["pil_x_start"],
    "nodes": [
        {
            "id": "dinner", "title": "和兩人在索里耶爾的酒館吃慶祝的晚餐",
            "text": "酒館的角落點著蠟燭。奧菈莉婭真的只喝了一杯，剩下的時間都在看你們。格溫德琳替她切肉，替你倒水，桌子底下的腳卻一直勾著你的小腿。",
            "at": at_cell("soriel", "tavern"), "requires": need("pil_x_start"), "kind": "story", "hours": "night",
            "allies": [AUR, GWEN],
            "success": {
                "text": "奧菈莉婭放下杯子，臉紅得不像只喝了一杯：「……格溫，房間訂在哪？」格溫德琳笑得像偷到糖的孩子：「我就知道你會問。」",
                "set_flags": ["pil_x_date"],
                "effects": [aff(AUR, 5, "一起度過的時光"), aff(GWEN, 5, "一起度過的時光")],
            },
        },
        {
            "id": "night", "title": "到格溫德琳訂好的房間",
            "text": "房間裡點著白百合香。格溫德琳鎖上門，轉身時已經解開了修女服的領口；奧菈莉婭站在床邊，手放在劍帶上，不知道該先解哪一個扣子。兩個人都看著你。",
            "at": at_cell("soriel", "inn"), "requires": need("pil_x_date"), "kind": "choice",
            "options": [
                {
                    "label": "讓格溫德琳主導",
                    "success": {
                        "text": "格溫德琳籌劃這一夜很久了，每一步都算得剛剛好。天亮時奧菈莉婭睡得很沉，格溫德琳枕在你的手臂上，小聲說：「我的位置，分你一半。只有你喔。」",
                        "set_flags": ["pil_x_done"],
                        "effects": [aff(AUR, 15, "三個人共度一夜"), aff(GWEN, 15, "三個人共度一夜"), mem("巡禮結束的那一夜，格溫德琳主導了一切；他說他的位置分你一半。", 3)],
                        "scene": "格溫德琳把你們兩個推到床上，像早就排練過一樣，一邊吻奧菈莉婭，一邊用指尖慢慢解你的衣服，溫柔又壞心地讓你們輪流等。他嬌小的身體貼上來時你才真正感覺到他是男孩子，粉色的分身抵著你，自己卻先紅了臉；奧菈莉婭被他哄得渾身發軟，一點一點交出主導權，三個人纏在一起，直到白百合的香燒完。",
                        "complete": True, "time": {"until": "morning"},
                    },
                },
                {
                    "label": "讓奧菈莉婭主導",
                    "success": {
                        "text": "奧菈莉婭像在練劍一樣認真，笨拙得讓人想笑，卻一次也沒有放手。天亮時她把你們兩個抱在懷裡，下巴抵著你的頭頂：「明天開始，我不喝了。」格溫德琳在被子裡偷笑：「說過好多次了喔。」",
                        "set_flags": ["pil_x_done"],
                        "effects": [aff(AUR, 15, "三個人共度一夜"), aff(GWEN, 15, "三個人共度一夜"), mem("巡禮結束的那一夜，奧菈莉婭用騎士的方式直來直往；天亮時她說明天開始不喝了。", 3)],
                        "scene": "奧菈莉婭解下劍帶，把你和格溫德琳一起拉上床，直來直往得像在衝鋒，親吻笨拙又用力。她不知道該先碰誰，就兩個都抱住；格溫德琳在她耳邊教她，她學得很認真，喘著氣一遍一遍地問「這樣可以嗎」。她清冷的臉一點一點崩掉，最後縮在你們中間，緊緊抓著兩個人的手不放。",
                        "complete": True, "time": {"until": "morning"},
                    },
                },
            ],
        },
    ],
    "rewards": [{"type": "xp", "amount": 800}],
}

# ================= 全城跑最快的精靈 =================

amb1 = {
    "id": "amb_bounty",
    "title": "賞金獵人的賞金",
    "summary": "自稱「全城跑最快的精靈」的琥珀找你合夥抓一個逃跑的小偷，賞金五五分帳——她會偷偷算成六四。（全城跑最快的精靈・一）",
    "rank": "D",
    "merit": 6,
    "start": {
        "kind": "npc", "npc": AMB, "min_level": 5,
        "text": "一個黑色短髮的精靈從屋簷上翻下來，落在你面前，嘴裡還叼著半塊麵包：「嘿，冒險者！要不要合夥？」她把一張通緝單拍在你胸口，「偷了麵包店整整一週營收的小偷，賞金兩百。五五分帳。」她咧嘴一笑，手指在背後偷偷比了個六。",
    },
    "start_flags": ["amb_start"],
    "nodes": [
        {
            "id": "intel", "title": "向索里耶爾的情報商打聽小偷的下落",
            "text": "情報商一邊數琥珀給的銅板，一邊往牆上努了努嘴：小偷的事好打聽。可是牆上那張剛貼的懸賞單，比小偷值錢多了。",
            "at": at_cell("soriel", "informant"), "requires": need("amb_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13}, "allies": [AMB],
            "success": {
                "text": "情報商說出小偷藏在外環的磨坊，又順手把牆上那張懸賞撕下來給你看：「黑髮、尖耳、會翻牆。活捉。」價錢是小偷的一百倍。琥珀笑出聲來：「哇，有人跟我長得好像喔！」她把懸賞揉成一團，塞進口袋，「走走走，磨坊！」",
                "set_flags": ["amb_poster"],
            },
            "fail": {
                "text": "情報商只肯說小偷在外環。離開時，你看見琥珀停在牆前，盯著一張剛貼上的懸賞：「黑髮、尖耳、會翻牆。活捉。」她一把撕下來塞進口袋，轉身時臉上已經掛著笑：「發什麼呆？走啦！」",
                "set_flags": ["amb_poster"],
            },
        },
        {
            "id": "ambush", "title": "在索里耶爾近郊擊退伏擊的捕奴隊",
            "text": "磨坊裡沒有小偷，只有兩個拿著麻袋和繩索的壯漢。小偷的消息是假的。其中一個看見琥珀，眼睛亮了：「就是她。活的，別打臉。」",
            "at": at_out("soriel"), "requires": need("amb_poster"), "kind": "combat",
            "enemies": [["slaver_catcher", 2]], "allies": [AMB],
            "success": {
                "text": "兩個打手被你們打得抱頭鼠竄，麻袋和繩索丟了一地。琥珀踢了踢地上的麻袋，笑得有點太大聲：「你看你看，他們連袋子都準備好了，好專業喔！」她的手在發抖。",
                "set_flags": ["amb_ambushed"],
            },
            "fail": {
                "text": "打手們沒抓到人，罵罵咧咧地跑了。琥珀扶著你，嘴巴還是停不下來：「你流血了你流血了，我跟你說這種傷舔一舔就好——好啦開玩笑的。」她的手在發抖。",
                "set_flags": ["amb_ambushed"],
                "effects": [{"type": "hp", "ratio": -0.1}],
            },
        },
        {
            "id": "fee", "title": "決定要不要收琥珀的保鑣費",
            "text": "琥珀數出一小疊銅板塞給你：「保鑣費。救命之恩什麼的太重了，算錢比較乾淨。」她說得很快，好像怕你不收。",
            "at": at_npc(AMB), "requires": need("amb_ambushed"), "kind": "choice",
            "options": [
                {
                    "label": "收下",
                    "success": {
                        "text": "琥珀鬆了一口氣，笑容終於正常了一點：「這樣就好。我們是做生意的關係，你不欠我、我不欠你。」她蹲下去翻打手的口袋，摸出一枚刻著鎖鏈的銅籌碼：「阿爾貝納自由集市的拍賣籌碼……喂，這給你保管。我手很賤，會拿去賣。」",
                        "set_flags": ["amb_1_done"],
                        "effects": [{"type": "money", "amount": 80}, aff(AMB, 10, "收下了她的保鑣費"), mem("和琥珀合夥抓小偷，結果是捕奴隊設的陷阱。她付了保鑣費，說這樣比較乾淨。")],
                        "complete": True,
                    },
                },
                {
                    "label": "「不收。你為什麼一直在跑？」",
                    "success": {
                        "text": "琥珀愣了一下，把錢收回去，坐在磨坊的台階上。她說起外環的貧民窟，說起從會走路起就有人想把她抓去賣，說起她怎麼學會翻牆。「所以啊，我是全城跑最快的精靈。」她說，聲音很輕。然後她摸出打手身上的一枚銅籌碼：「阿爾貝納自由集市的拍賣籌碼。你拿著，我會拿去賣。」",
                        "set_flags": ["amb_1_done"],
                        "effects": [aff(AMB, 15, "問她為什麼一直在跑"), mem("琥珀說起在索里耶爾外環的貧民窟長大，從會走路起就有人想把她抓去賣。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [{"type": "money", "amount": 300}, {"type": "xp", "amount": 450}],
}

amb2 = {
    "id": "amb_catalog",
    "title": "月下的目錄",
    "summary": "拍賣籌碼指向阿爾貝納的自由集市。琥珀說要去看看，是誰把她寫進了目錄。（全城跑最快的精靈・二）",
    "rank": "C",
    "merit": 8,
    "start": {
        "kind": "npc", "npc": AMB, "min_level": 8, "min_affinity": 10, "requires": need("amb_1_done"),
        "text": "琥珀把那張揉皺的懸賞攤平在桌上：「我想了很久。」她難得沒有笑，「我想知道是誰在收購我。阿爾貝納的自由集市，那枚籌碼的地方——」她停了一下，又恢復成平常的樣子，「你出路費，我出臉。很公平吧？」",
    },
    "start_flags": ["amb_market"],
    "nodes": [
        {
            "id": "catalog", "title": "在阿爾貝納的自由集市翻拍賣目錄",
            "text": "自由集市的夜市燈火通明，拿籌碼就能翻今晚的拍賣目錄。琥珀一頁一頁地翻，翻到某一頁時手停了。你湊過去看：「預定品：黑髮精靈女子，索里耶爾貨，交貨後付清。」再下一件：「精靈嬰兒的襁褓，附霧銀耳墜一只。」",
            "at": at_cell("albena", "lm_free_market"), "requires": need("amb_market"), "kind": "story", "hours": "night",
            "allies": [AMB],
            "success": {
                "text": "琥珀摸了摸自己的耳朵。她從小戴到現在的那只霧銀耳墜，和目錄上畫的一模一樣。「哈，」她說，「真巧。」她的聲音在抖。",
                "set_flags": ["amb_lot"],
            },
        },
        {
            "id": "ledger", "title": "摸進自由集市的後台找寄賣人的帳本",
            "text": "後台堆滿了貨箱，守衛在門口打瞌睡。帳本鎖在拍賣官的桌子裡。琥珀比了個手勢：她引開守衛，你去拿。",
            "at": at_cell("albena", "lm_free_market"), "requires": need("amb_lot"), "kind": "check",
            "check": {"attr": "dex", "dc": 15}, "allies": [AMB],
            "success": {
                "text": "你撬開抽屜，在燈下翻開帳本：寄賣人「灰狗」——索里耶爾一帶最有名的捕奴隊頭目。預定品的買主沒有名字，只寫著「晨光城某貴族，透過掮客」。你們從後窗溜出去時，沒有一個人發現。",
                "set_flags": ["amb_ledger"],
            },
            "fail": {
                "text": "抽屜發出刺耳的一聲。守衛醒了，你只好搶了帳本就跑，肩膀挨了一棍。帳本上寫著：寄賣人「灰狗」——索里耶爾一帶最有名的捕奴隊頭目；預定品的買主是「晨光城某貴族，透過掮客」。",
                "set_flags": ["amb_ledger"],
                "effects": [{"type": "hp", "ratio": -0.15}],
            },
        },
        {
            "id": "chase", "title": "在阿爾貝納近郊甩掉黑市的追兵",
            "text": "兩輛黑市的馬車從集市後門追了出來，車夫揮著鞭子，車上的人拿著網子。琥珀跑在你前面，回頭大喊：「我跑得比馬快！可是你不行！」",
            "at": at_out("albena"), "requires": need("amb_ledger"), "kind": "combat",
            "enemies": [["black_market_carter", 2]], "allies": [AMB],
            "success": {
                "text": "馬車翻倒在路邊，車夫們爬起來就跑。琥珀喘著氣靠在樹上，笑得上氣不接下氣：「你看到他們的臉了嗎？」笑完了，她低頭看著自己的手，「……那件襁褓還在拍賣台上。」",
                "set_flags": ["amb_chased"],
            },
            "fail": {
                "text": "你們躲進了田埂，追兵在路上轉了幾圈，罵著走了。琥珀替你拍掉身上的泥：「好啦，至少帳本還在。」她頓了一下，「……那件襁褓還在拍賣台上。」",
                "set_flags": ["amb_chased"],
                "effects": [{"type": "hp", "ratio": -0.1}],
            },
        },
        {
            "id": "swaddle", "title": "決定怎麼拿到那件襁褓",
            "text": "琥珀站在集市外面，看著拍賣會的燈：「那可能是我的。」她說，「我是說，我媽的。我不知道。」她把手插進口袋，「你有什麼主意？」",
            "at": at_npc(AMB), "requires": need("amb_chased"), "kind": "choice",
            "options": [
                {
                    "label": "用你的錢標下來",
                    "success": {
                        "text": "你舉了三次牌子，最後的價錢讓琥珀倒抽一口氣。她抱著那件褪色的襁褓，嘴硬地說：「我會還你的。利息照算。」走出集市時，她一直沒有放手。襁褓上繡著一行看不懂的精靈文。",
                        "set_flags": ["amb_2_done"],
                        "effects": [{"type": "money", "amount": -400}, aff(AMB, 20, "替她標下襁褓"), mem("在阿爾貝納的自由集市，你替琥珀標下了一件精靈嬰兒的襁褓，可能是她母親的遺物。上面繡著看不懂的精靈文。", 3)],
                        "complete": True,
                    },
                },
                {
                    "label": "讓琥珀照她的方式拿",
                    "success": {
                        "text": "琥珀咧嘴一笑，消失在人群裡。一刻鐘後，拍賣官尖叫起來的時候，她已經坐在你們的馬車上，懷裡抱著那件褪色的襁褓：「本來就是我的。」襁褓上繡著一行看不懂的精靈文。",
                        "set_flags": ["amb_2_done"],
                        "effects": [rep("aude_federation", -3), aff(AMB, 15, "讓她自己拿回來"), mem("在阿爾貝納的自由集市，琥珀偷回了一件精靈嬰兒的襁褓，可能是她母親的遺物。上面繡著看不懂的精靈文。", 3)],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    "rewards": [{"type": "money", "amount": 600}, {"type": "xp", "amount": 900}],
}

amb3 = {
    "id": "amb_fastest",
    "title": "最快的精靈",
    "summary": "一個灰衣精靈出現在琥珀住處的屋頂上，讀出了襁褓上的字。三十年來，有人一直在她背後替她清掉追兵。（全城跑最快的精靈・三）",
    "rank": "B",
    "merit": 10,
    "start": {
        "kind": "npc", "npc": AMB, "min_level": 11, "min_affinity": 20, "requires": need("amb_2_done"),
        "text": "琥珀從窗戶探出頭來，對你招手：「上來上來！屋頂上有個奇怪的傢伙，從剛才就一直坐在那裡不走。」她壓低聲音，「灰衣服、尖耳朵，看起來超可疑。你幫我看一下好不好？」",
    },
    "start_flags": ["amb_roof"],
    "nodes": [
        {
            "id": "truth", "title": "到琥珀住處的屋頂見那個灰衣精靈",
            "text": "屋頂上坐著一個灰衣的精靈，是迷霧之幕的塞夫。他接過琥珀遞來的襁褓，看著上面的字看了很久：「霧谷守霧者的家紋。」他說，「你的母親叫埃蘭蒂，三十年前懷著你逃出結界，在索里耶爾外環被捕奴隊殺了。我晚了一步，只來得及抱走你。」",
            "at": at_npc(AMB), "requires": need("amb_roof"), "kind": "story", "hours": "night",
            "allies": [SEPH],
            "success": {
                "text": "塞夫說，從那之後，迷霧之幕一直暗中替她清掉靠近的捕奴者。琥珀的臉一點一點白了，然後她笑了，笑得很難看：「所以我從來沒有跑贏過任何人？全城跑最快的精靈——」她的聲音破了，「是你們在後面替我擋著？」",
                "set_flags": ["amb_truth"],
            },
        },
        {
            "id": "catch_up", "title": "在索里耶爾的城門追上獨自跑掉的琥珀",
            "text": "天還沒亮，消息就傳開了：灰狗放話，要在外環賣掉「一個精靈女人的遺物」。琥珀翻出窗戶，一個人往城門衝。她跑得真的很快——你要在屋頂上追上她。",
            "at": at_cell("soriel", "gate"), "requires": need("amb_truth"), "kind": "check",
            "check": {"attr": "dex", "dc": 16},
            "success": {
                "text": "你在城牆上截住了她。琥珀想甩開你的手，甩不開：「放開！這次我要自己——」你沒有放。她愣了很久，然後低下頭：「……好啦。一起。」",
                "set_flags": ["amb_caught_up"],
                "effects": [aff(AMB, 10, "追上了她")],
            },
            "fail": {
                "text": "你從屋頂上滑下來，膝蓋撞得生疼，可還是在城門外追上了她。琥珀看著你一瘸一拐的樣子，罵了一句很難聽的話，扶住了你：「……笨蛋。一起啦。」",
                "set_flags": ["amb_caught_up"],
                "effects": [{"type": "hp", "ratio": -0.15}],
            },
        },
        {
            "id": "hound", "title": "在索里耶爾近郊和琥珀一起打倒灰狗",
            "text": "外環的廢棄倉庫前點著火把，一個滿臉刀疤的灰髮男人坐在貨箱上，手裡把玩著一只霧銀耳墜。他看見琥珀，笑了：「三十年了，終於自己送上門。你媽當年也跑得很快。」",
            "at": at_out("soriel"), "requires": need("amb_caught_up"), "kind": "combat", "hours": "night",
            "enemies": [["grey_hound", 1], ["kidnapper_bandit", 1]], "allies": [AMB],
            "success": {
                "text": "灰狗倒在倉庫前，那只霧銀耳墜滾到琥珀腳邊。她撿起來，和自己耳朵上的那只放在一起——是一對。她沒有哭，只是把兩只耳墜握在手心，握了很久。",
                "set_flags": ["amb_hound"],
            },
            "fail": {
                "text": "你們撐不住，只能先退了下來。灰狗還在倉庫前等著——等你們準備好了，可以再來。",
                "retry": True,
            },
        },
        {
            "id": "after", "title": "決定跑完之後要去哪裡",
            "text": "天亮了。琥珀坐在倉庫的屋頂上，晃著腳，手裡把玩著那對耳墜。塞夫站在遠處，沒有走近。「我以前一直在跑，」琥珀說，「跑贏追兵，跑贏所有人。可是現在……」她轉頭看你，「我不知道要往哪裡跑了。」",
            "at": at_npc(AMB), "requires": need("amb_hound"), "kind": "choice",
            "options": [
                {
                    "label": "「去霧谷看看她的家」",
                    "requires": {"flags": ["fog_lifted"]},
                    "success": {
                        "text": "琥珀愣住了：「霧谷……不是被霧關起來了嗎？」塞夫走過來：「霧已經散了。」他看了你一眼，「是這個人散的。」琥珀把一只耳墜塞進你手裡：「這只給你。另一只，我要戴回去給她看。」她牽起你的手，「走吧。這次不用跑。」",
                        "set_flags": ["amb_lover", "amb_mist"],
                        "effects": [rep("elf_court", 5), aff(AMB, 25, "陪她去看母親的家"),
                                    mem("琥珀知道了自己的身世：母親是霧谷的精靈，被捕奴隊殺害。你們打倒了灰狗，她把母親的一只霧銀耳墜送給你，要和你一起去霧谷。", 3),
                                    {"type": "companion", "npc": AMB, "mode": "voluntary"}],
                        "complete": True,
                    },
                },
                {
                    "label": "「留在索里耶爾」",
                    "success": {
                        "text": "琥珀想了很久，笑了：「也對。我是在這裡長大的。」她站起來，對著整座城大喊：「我是索里耶爾跑最快的精靈——這次是真的！」喊完，她把一只耳墜塞進你手裡，「這只給你。我不用再跑了，所以……你要一直在喔。」",
                        "set_flags": ["amb_lover", "amb_soriel"],
                        "effects": [rep("guild", 5), aff(AMB, 25, "讓她不用再跑"),
                                    mem("琥珀知道了自己的身世：母親是霧谷的精靈，被捕奴隊殺害。你們打倒了灰狗，她把母親的一只霧銀耳墜送給你，說她不用再跑了。", 3),
                                    {"type": "companion", "npc": AMB, "mode": "voluntary"}],
                        "complete": True,
                    },
                },
            ],
        },
    ],
    # 兩個結局都送霧銀耳墜：寫在完成報酬（獨特裝備一件只由一個地方發）
    "rewards": [{"type": "money", "amount": 1500}, {"type": "xp", "amount": 2000}, {"type": "item", "name": "霧銀耳墜", "qty": 1}],
}

amb4 = {
    "id": "amb_x_rooftop",
    "title": "耳墜的另一隻",
    "summary": "琥珀說要帶你去一個地方：外環最高的鐘樓屋頂，她從小在那裡看整座城。（全城跑最快的精靈・四）",
    "tags": ["adult"],
    "rank": "B",
    "merit": 5,
    "start": {
        "kind": "npc", "npc": AMB, "min_level": 11, "min_affinity": 40, "requires": {"flags_any": ["amb_lover"]},
        "text": "琥珀晃著耳朵上的霧銀耳墜，湊到你面前：「今晚有空嗎？」她難得有點吞吞吐吐，「我想帶你去一個地方。我從來沒帶別人去過。……幹嘛那個表情！不是那個意思！好啦，有一點是。」",
    },
    "start_flags": ["amb_x_start"],
    "nodes": [
        {
            "id": "belltower", "title": "和琥珀爬上索里耶爾外環的鐘樓屋頂",
            "text": "鐘樓的屋頂很窄，底下是整座索里耶爾的燈火。琥珀坐在屋脊上，指給你看：那條巷子她第一次甩掉追兵，那面牆她第一次翻過去，那個屋頂她睡過一整個冬天。",
            "at": at_out("soriel"), "requires": need("amb_x_start"), "kind": "story", "hours": "night",
            "allies": [AMB],
            "success": {
                "text": "說到後來，她安靜下來，把頭靠在你肩上：「以前我覺得，全世界只有這裡是我的。」她摸了摸你耳朵上的那只耳墜，「現在多了一個。」",
                "set_flags": ["amb_x_date"],
                "effects": [aff(AMB, 5, "一起度過的時光")],
            },
        },
        {
            "id": "night", "title": "在鐘樓的屋頂上",
            "text": "夜風很涼。琥珀轉過身來，跨坐在你腿上，額頭抵著你的額頭，嘴巴難得停了下來。",
            "at": at_npc(AMB), "requires": need("amb_x_date"), "kind": "choice",
            "options": [
                {
                    "label": "讓她主導",
                    "success": {
                        "text": "琥珀一路說個不停，從撩人說到喘不過氣，最後終於一個字也說不出來。天亮時她蜷在你的外套裡，鐘聲響了也不肯動：「再五分鐘。全城跑最快的精靈，今天休假。」",
                        "set_flags": ["amb_x_done"],
                        "effects": [aff(AMB, 15, "在鐘樓屋頂共度一夜"), mem("在索里耶爾外環的鐘樓屋頂上，琥珀廢話連篇地撩人，直到說不出話。", 3)],
                        "scene": "琥珀嘴巴停不下來，一邊解你的扣子一邊評論你的身材，一邊吻你一邊問你是不是很緊張；她纖瘦平坦的身體貼上來時很燙，騎在你身上的動作又快又急，像在屋頂上奔跑。直到快感把她的話一句一句打斷，她才終於說不出話，只能咬著你的肩膀，尖耳朵紅得發燙。",
                        "complete": True, "time": {"until": "morning"},
                    },
                },
                {
                    "label": "讓她慢下來",
                    "success": {
                        "text": "你按住她的腰，要她慢一點。琥珀愣了一下，然後第一次讓人抱著不動。天亮時她還窩在你懷裡，小聲說：「原來不跑的時候，是這種感覺啊。」",
                        "set_flags": ["amb_x_done"],
                        "effects": [aff(AMB, 15, "在鐘樓屋頂共度一夜"), mem("在索里耶爾外環的鐘樓屋頂上，你讓琥珀慢下來。她說原來不跑的時候是這種感覺。", 3)],
                        "scene": "你抱住她的腰，讓她慢下來。琥珀想說什麼，被你吻住了；她第一次不急著做下一件事，任由你一寸一寸地摸過她纖瘦的背和平坦的胸口。她在你懷裡慢慢地動，呼吸越來越亂，最後把臉埋進你的頸窩，小聲地、一遍又一遍地說：「不用跑。不用跑了。」",
                        "complete": True, "time": {"until": "morning"},
                    },
                },
            ],
        },
    ],
    "rewards": [{"type": "xp", "amount": 800}],
}

STORIES = [pil1, pil2, pil3, pil4, amb1, amb2, amb3, amb4]

# ================= 怪物 =================

ENEMIES = [
    # 捕奴隊的打手：照流氓（Lv.5）的數值，換成捕奴隊
    {"id": "slaver_catcher", "name": "捕奴隊的打手", "level": 5, "attrs": {"str": 15, "dex": 12, "int": 8, "fai": 8, "cha": 8}, "hp": 41, "ap": 5,
     "weapon": {"dice": "2d6", "type": "bludgeoning", "attr": "str"}, "evade": 0, "dr": 1, "abilities": ["rend"],
     "resist": {"bludgeoning": -0.25, "psychic": 0.25}, "offense": {"all": 1.62}, "xp": 300, "habitats": ["central"], "money_cc": [10, 50],
     "desc": "捕奴隊雇來抓人的打手，腰上掛著麻袋與繩索，專挑落單的精靈下手。（特殊任務「賞金獵人的賞金」）", "kind": "humanoid", "armed": True},
    # 灰狗：Lv.11 角色線的頭目（13 級，搭一隻 11 級的綁匪），打完剩 65～70% 的生命（docs/MONSTERS.md「特殊任務的頭目」）。
    # 實測（balanceSim 的 groupFight，Lv.11 隊伍 60 場）：勝率 97%、贏的場次剩 69%、一場約 17 回合
    {"id": "grey_hound", "name": "捕奴隊頭目「灰狗」", "level": 13, "attrs": {"str": 16, "dex": 22, "int": 12, "fai": 8, "cha": 10}, "hp": 1209, "ap": 8,
     "weapon": {"dice": "3d8", "type": "slashing", "attr": "dex"}, "evade": 1, "dr": 3, "abilities": ["rend", "dirty_trick", "blur_veil", "frenzy_flurry"],
     "ability_hp_below": {"frenzy_flurry": 40}, "resist": {"slashing": -0.25, "radiant": 0.25}, "offense": {"all": 2.0}, "xp": 1850, "habitats": ["central"],
     "money_cc": [300, 800], "desc": "索里耶爾一帶最有名的捕奴隊頭目，灰髮、滿臉刀疤，三十年前在外環殺了一個逃出霧谷的精靈女人。（特殊任務「最快的精靈」）",
     "kind": "humanoid", "armed": True},
]

# ================= 物品 =================

ITEMS = [
    {"name": "霧銀耳墜", "category": "equipment", "price_cc": 1400, "tags": ["unique"],
     "desc": "霧谷的精靈用霧裡採的白金打的耳墜，泛著像霧一樣的灰銀色，本來是一對。琥珀的母親戴著它逃出結界，琥珀戴著另一只長大。戴著它的人，好像總能在被抓住之前溜走。",
     "gear": {"base": "earring_calm", "material": "gold", "rarity": "rare", "attrs": {"dex": 1},
              "enchants": {"mods": {"evade": 1}, "resist": {"psychic": -0.25}}, "unique": {"check": {"skills": ["stealth", "escape"]}, "bonus": 1}}},
]

# ================= 固定 NPC =================

PIL_HAUNTS = [{"location": "soriel", "zone": "town", "weight": 1}, {"location": "dawnlight", "zone": "town", "weight": 0.6}, {"location": "rivervale", "zone": "town", "weight": 0.5}]
NPC_PATCH = {
    AUR: {
        "stages": [
            {"requires": {"flags": ["pil_order"]}, "location": "soriel", "haunts": PIL_HAUNTS, "name": "聖騎士奧菈莉婭",
             "background": "二十歲。走完了巡禮的五個印，受任為聖騎士。她沒有一個人去邊境：她要格溫德琳當她的隨軍牧師，要那個作證到最後的冒險者當她的同行者。教廷皺眉，她不在乎。",
             "personality": "人前清冷優雅，說話簡短、出手果斷；酒還是會喝，只是少了。清醒的時候說得出真心話了，對格溫德琳和冒險者會笨拙地溫柔。"},
            {"requires": {"flags": ["pil_free"]}, "location": "soriel", "haunts": PIL_HAUNTS,
             "background": "二十歲。走完了巡禮的五個印，卻把聖騎士的徽章放回了祭壇：「巡禮還沒走完。」現在是自由的巡禮者，和格溫德琳、那個作證到最後的冒險者一起走。",
             "personality": "人前清冷優雅，說話簡短、出手果斷；酒還是會喝，只是少了。放下頭銜之後笑得比較多，對格溫德琳和冒險者會笨拙地溫柔。"},
        ],
    },
    GWEN: {
        "stages": [
            {"requires": {"flags": ["pil_order"]}, "location": "soriel", "haunts": PIL_HAUNTS,
             "background": "二十歲。在真理之鏡前站得筆直，拿回了牧師的資格證書。現在是聖騎士奧菈莉婭的隨軍牧師，照樣替她記帳、洗衣、擋酒；他的位置分了一半給那個作證到最後的冒險者，只分給那個人。",
             "personality": "溫柔細聲，遇到困難時意外堅強；還是有點綠茶，可是不再躲在別人身後了。"},
            {"requires": {"flags": ["pil_free"]}, "location": "soriel", "haunts": PIL_HAUNTS,
             "background": "二十歲。在真理之鏡前站得筆直，拿回了牧師的資格證書。奧菈莉婭放下頭銜之後，他提著裙擺跟了上去，現在是自由的巡禮者；他的位置分了一半給那個作證到最後的冒險者，只分給那個人。",
             "personality": "溫柔細聲，遇到困難時意外堅強；還是有點綠茶，可是不再躲在別人身後了。"},
        ],
    },
    AMB: {
        "adult_appearance": "胸部平坦，乳頭小而淡粉；身體纖瘦結實，私處光潔無毛，陰唇小巧緊閉。",
        "stages": [
            {"requires": {"flags": ["amb_mist"]}, "location": "soriel", "haunts": [{"location": "soriel", "zone": "town", "weight": 1}, {"location": "soriel", "zone": "outskirts", "weight": 0.5}, {"location": "albena", "zone": "town", "weight": 0.3}],
             "background": "看起來二十出頭，實際上三十多歲。母親是霧谷守霧者一族的精靈，三十年前懷著她逃出結界，被捕奴隊的灰狗殺害。她和冒險者一起打倒了灰狗，去霧谷看了母親的家；現在耳朵上戴著母親的一只霧銀耳墜，另一只送給了冒險者。",
             "personality": "伶牙俐齒、愛錢如命，嘴巴還是停不下來；知道自己從哪裡來之後，比較敢停下來了。被戳中痛處時還是會岔開話題，可是會回來把話說完。"},
            {"requires": {"flags": ["amb_soriel"]}, "location": "soriel", "haunts": [{"location": "soriel", "zone": "town", "weight": 1}, {"location": "soriel", "zone": "outskirts", "weight": 0.5}, {"location": "albena", "zone": "town", "weight": 0.3}],
             "background": "看起來二十出頭，實際上三十多歲。母親是霧谷的精靈，被捕奴隊的灰狗殺害；三十年來迷霧之幕一直暗中保護她。她和冒險者一起打倒了灰狗，決定留在長大的索里耶爾——「索里耶爾跑最快的精靈，這次是真的。」母親的一只霧銀耳墜送給了冒險者。",
             "personality": "伶牙俐齒、愛錢如命，嘴巴還是停不下來；不用再跑之後，笑得比較真了。被戳中痛處時還是會岔開話題，可是會回來把話說完。"},
        ],
    },
}
NO_ATTACK = [AUR, GWEN, AMB]


def write_enemies():
    path = 'data/rules/enemies.json'
    lines = open(path, encoding='utf-8').read().split('\n')
    ids = {e['id'] for e in ENEMIES}
    lines = [l for l in lines if not any(l.startswith('    {"id": "%s"' % i) for i in ids)]
    at = next(i for i, l in enumerate(lines) if l.startswith('    {"id": "kidnapper_bandit"')) + 1
    lines[at:at] = ['    ' + json.dumps(e, ensure_ascii=False) + ',' for e in ENEMIES]
    out = '\n'.join(lines)
    data = json.loads(out)
    all_ids = [e['id'] for e in data['enemies']]
    assert len(all_ids) == len(set(all_ids)), '重複的怪物 id'
    open(path, 'w', encoding='utf-8').write(out)
    print(f'怪物 {len(ENEMIES)} 隻')


def write_npcs():
    """照原本的排版（一位 NPC 一個區塊）就地補欄位：no_attack 接在第一行的最後；adult_appearance、stages 各佔一行，放在 background 前面"""
    path = 'data/world/npcs.json'
    lines = open(path, encoding='utf-8').read().split('\n')
    for npc in set(NO_ATTACK) | set(NPC_PATCH):
        start = next(i for i, l in enumerate(lines) if l.startswith('    { "id": "%s"' % npc))
        end = next(i for i in range(start + 1, len(lines)) if lines[i].startswith('    { "id"') or lines[i] == '  ]')
        if npc in NO_ATTACK and '"no_attack"' not in lines[start]:
            lines[start] = lines[start].rstrip() + ' "no_attack": true,'
        patch = NPC_PATCH.get(npc, {})
        for key in patch:
            for i in range(start + 1, end):
                if lines[i].startswith('      "%s":' % key):
                    del lines[i]
                    end -= 1
                    break
        bg = next(i for i in range(start + 1, end) if lines[i].startswith('      "background":'))
        lines[bg:bg] = ['      %s: %s,' % (json.dumps(k), json.dumps(v, ensure_ascii=False)) for k, v in patch.items()]
    out = '\n'.join(lines)
    data = json.loads(out)
    by = {n['id']: n for n in data['npcs']}
    for npc in NO_ATTACK:
        assert by[npc].get('no_attack') is True
    for npc, patch in NPC_PATCH.items():
        for k, v in patch.items():
            assert by[npc][k] == v, (npc, k)
    open(path, 'w', encoding='utf-8').write(out)
    print(f'固定 NPC {len(set(NO_ATTACK) | set(NPC_PATCH))} 位')


if __name__ == '__main__':
    write_enemies()
    write_items(ITEMS)
    write_stories(STORIES)
    write_npcs()
