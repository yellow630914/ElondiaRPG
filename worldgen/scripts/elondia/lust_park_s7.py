# 魅魔的遊樂園「緋夢樂園」（慾望戰鬥 S7；docs/LUST_PARK.md）：
# 血羽城堡城門區的售票亭（地標）走進入口廣場（特殊地圖 sm_lust_park），廣場的五條通道各通往一個園區（沒有周邊的 3 層地下城）。
#
# 寫進：
#   data/rules/abilities.json  怪物的招牌技能（lp_ 開頭，接在 m_aphro_grip 後面）
#   data/rules/enemies.json    淫物、層主、擬態寶箱（lp_ 開頭）與五個園區的遭遇表（park_ 開頭）
#   data/rules/items.json      園區的材料、層主的戰利品、清心茶與媚香精油、集章的獎勵
#   data/rules/lewd.json       park：魅氣、擬態寶箱、寶箱加料、各園區的專屬戰敗
#   data/world/geography.json  五個園區（type dungeon、park 寫入口廣場；沒有路線，不能直接旅行到）
#   data/world/maps.json       園區各層的光線
#   data/world/special_maps.json  入口廣場（要排在 interiors23.py、epic_places.py 之後）
#   data/world/landmarks.json  售票亭（血羽城堡・城門區）
#   data/world/npcs.json       接待員蜜菈（站在入口廣場）
# 集章的任務（PARK_STORIES）由 story_batch1.py 匯入。
# 可以重跑：先拿掉上一次寫進去的東西再寫。怪物的生命與攻擊加成照平衡模擬調過（TUNE），重跑不會改掉。
import json
import re
import sys

sys.path.insert(0, 'worldgen/scripts/elondia')

PLAZA = 'sm_lust_park'
PARKS = {
    'park_beast': '淫獸牧場',
    'park_insect': '蟲之溫室',
    'park_aquarium': '觸手水族館',
    'park_garden': '淫植花園',
    'park_theater': '夢魔劇場',
}
# 園區各層的光線（淺層、中層、深層；第 0 個是用不到的周邊）
LIGHTING = {
    'park_beast': ['lit', 'daylight', 'daylight', 'lit'],
    'park_insect': ['lit', 'lit', 'lit', 'dark'],
    'park_aquarium': ['lit', 'lit', 'dark', 'dark'],
    'park_garden': ['lit', 'daylight', 'daylight', 'lit'],
    'park_theater': ['lit', 'lit', 'lit', 'lit'],
}

# ---------------- 怪物的招牌技能 ----------------
L = lambda dice='1d6', per=3: {"dice": dice, "type": "lust", "scale": {"dice": "1d6", "per": per}}
ABILITIES = [
    {"id": "lp_lurk", "name": "潛伏", "type": "skill", "classes": ["monster"], "ap": 1, "attr": "dex", "target": "self", "resolve": "auto",
     "apply": [{"status": "hidden", "turns": 2, "to": "self"}], "uses": {"per_combat": 1}, "desc": "躲進草叢或陰影裡：2 回合迴避 +4、比較不會被盯上。"},
    {"id": "lp_pounce", "name": "撲上來舔", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "dex", "target": "enemy", "resolve": "attack",
     "damage": [{"weapon": True}, L()], "apply": [{"status": "exposed", "turns": 1, "on": "hit"}], "desc": "從藏身處撲到人身上：武器傷害加 1d6 慾望（每 3 級再 +1d6），命中後破綻 1 回合。"},
    {"id": "lp_monkey_raid", "name": "從天而降", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "dex", "target": "random_enemies", "count": 2, "resolve": "attack",
     "damage": [L('1d4')], "desc": "從頭頂的圍欄撲下來扯衣服：隨機兩個目標各 1d4 慾望（每 3 級再 +1d6）。"},
    {"id": "lp_sniff", "name": "嗅出發情", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [{"weapon": True}, L('1d4')], "apply": [{"status": "sensitized", "turns": 2, "on": "hit"}], "desc": "聞出誰最想要就撲誰：武器傷害加 1d4 慾望，命中後敏感 2 回合。"},
    {"id": "lp_rut_charge", "name": "發情衝撞", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [{"weapon": True}, L('1d8')], "apply": [{"status": "prone", "turns": 1, "on": "hit", "save": "str"}], "desc": "發情的衝撞：武器傷害加 1d8 慾望，命中後力量豁免，失敗倒地 1 回合。"},
    {"id": "lp_scale_powder", "name": "媚粉", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "dex", "target": "all_enemies", "resolve": "save", "save": "str",
     "damage": [L('1d4')], "apply": [{"status": "aphrodisiac", "turns": 2}], "uses": {"per_combat": 1}, "desc": "撒下一片粉紅色的鱗粉：所有敵人力量豁免，1d4 慾望（成功減半）並媚毒 2 回合。"},
    {"id": "lp_slime_engulf", "name": "包覆", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [L('1d8')], "apply": [{"status": "restrained", "turns": 1, "on": "hit", "save": "str"}], "desc": "黏糊糊地把人裹住：1d8 慾望，命中後力量豁免，失敗束縛 1 回合。"},
    {"id": "lp_ovipositor", "name": "產卵管", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "dex", "target": "enemy", "resolve": "attack",
     "damage": [{"weapon": True}, L('1d6')], "apply": [{"status": "aphrodisiac", "turns": 2, "on": "hit"}, {"status": "sensitized", "turns": 2, "on": "hit"}],
     "desc": "把產卵管扎進來：武器傷害加 1d6 慾望，命中後媚毒、敏感 2 回合。"},
    {"id": "lp_constrict", "name": "絞縛", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [{"weapon": True}, L('1d6')], "apply": [{"status": "restrained", "turns": 1, "on": "hit", "save": "str"}, {"status": "aphrodisiac", "turns": 2, "on": "hit"}],
     "desc": "纏住身體慢慢收緊：武器傷害加 1d6 慾望，命中後媚毒 2 回合，力量豁免失敗再束縛 1 回合。"},
    {"id": "lp_long_tongue", "name": "長舌", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [L('1d8')], "apply": [{"status": "exposed", "turns": 1, "on": "hit"}], "desc": "黏答答的長舌頭捲過來：1d8 慾望，命中後破綻 1 回合。"},
    {"id": "lp_many_legs", "name": "百足", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "dex", "target": "random_enemies", "count": 3, "resolve": "attack",
     "damage": [L('1d4')], "desc": "幾十隻腳一起爬上身：隨機三次，每次 1d4 慾望（每 3 級再 +1d6）。"},
    {"id": "lp_glue", "name": "噴膠", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "dex", "target": "enemy", "resolve": "save", "save": "dex",
     "damage": [L('1d4')], "apply": [{"status": "stunned", "turns": 1}], "uses": {"per_combat": 1}, "desc": "噴出一大團甜膩的膠：靈巧豁免，失敗被黏住不能行動 1 回合，1d4 慾望（成功減半）。"},
    {"id": "lp_vine_pull", "name": "拉入", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [{"weapon": True}, L('1d6')], "apply": [{"status": "restrained", "turns": 1, "on": "hit", "save": "str"}], "desc": "觸手藤把人拖進花叢：武器傷害加 1d6 慾望，命中後力量豁免，失敗束縛 1 回合。"},
    {"id": "lp_honey", "name": "蜜壺", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "str", "target": "all_enemies", "resolve": "save", "save": "fai",
     "damage": [L('1d6')], "apply": [{"status": "sensitized", "turns": 2}], "uses": {"per_combat": 1}, "desc": "壺口噴出溫熱的花蜜：所有敵人信仰豁免，1d6 慾望（成功減半）並敏感 2 回合。"},
    {"id": "lp_swallow", "name": "吞入", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [L('2d6')], "apply": [{"status": "stunned", "turns": 1, "on": "hit", "save": "str"}], "uses": {"per_combat": 1},
     "desc": "整朵花把人吞進花苞：2d6 慾望（每 3 級再 +1d6），命中後力量豁免，失敗被困住不能行動 1 回合。"},
    {"id": "lp_dream", "name": "春夢侵蝕", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "cha", "target": "enemy", "resolve": "save", "save": "int", "on_save": "half",
     "damage": [{"dice": "1d6", "type": "psychic"}, L('1d6')], "apply": [{"status": "confused", "turns": 1}], "desc": "把春夢灌進腦袋：智力豁免，1d6 心靈與 1d6 慾望（成功減半），失敗困惑 1 回合。"},
    {"id": "lp_tongue_lash", "name": "菌舌捲纏", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "str", "target": "enemy", "resolve": "attack",
     "damage": [{"weapon": True}, L('1d6')], "apply": [{"status": "restrained", "turns": 1, "on": "hit", "save": "str"}], "desc": "寶箱裡伸出長滿菌絲的舌頭：武器傷害加 1d6 慾望，命中後力量豁免，失敗束縛 1 回合。"},
    {"id": "lp_lust_tide", "name": "極樂狂潮", "type": "skill", "classes": ["monster"], "ap": 3, "attr": "cha", "target": "all_enemies", "resolve": "save", "save": "fai",
     "damage": [{"dice": "2d6", "type": "lust", "scale": {"dice": "1d6", "per": 2}}], "apply": [{"status": "aphrodisiac", "turns": 2}], "uses": {"per_combat": 1},
     "desc": "層主的低血大招：所有敵人信仰豁免，2d6 慾望（每 2 級再 +1d6，成功減半）並媚毒 2 回合。"},
    {"id": "lp_encore", "name": "安可", "type": "skill", "classes": ["monster"], "ap": 2, "attr": "cha", "target": "all_enemies", "resolve": "save", "save": "fai",
     "apply": [{"status": "taunted", "turns": 1}], "uses": {"per_combat": 1}, "desc": "所有人的目光都被舞台吸走：所有敵人信仰豁免，失敗被嘲諷 1 回合。"},
]

# ---------------- 怪物 ----------------
LEVEL_HP = {6: 45, 7: 55, 9: 68, 10: 72, 12: 80}
BOSS_HP = {7: 520, 10: 730, 13: 1170}
LEVEL_XP = {6: 365, 7: 465, 9: 675, 10: 780, 12: 1020}
BOSS_XP = {7: 740, 10: 1265, 13: 1850}
# 平衡模擬調過的生命與攻擊加成（docs/MONSTERS.md「耐打度」；調整方法見 worldgen/balance/monsters.md）
TUNE = {
    "lp_lewd_cat": {"off": 2.05},
    "lp_lewd_monkey": {"off": 3.98, "ap": 7},
    "lp_lewd_hound": {"off": 3.61},
    "lp_lewd_fox": {"off": 1.92, "ap": 6},
    "lp_rut_boar": {"off": 2.11},
    "lp_nine_tail": {"off": 2.36},
    "lp_aphro_leech": {"off": 2.73, "ap": 6},
    "lp_lewd_slug": {"off": 3.23},
    "lp_powder_moth": {"off": 1.98},
    "lp_aphro_slime": {"off": 3.98, "ap": 7},
    "lp_lewd_spider": {"off": 3.11, "ap": 8},
    "lp_brood_wasp": {"off": 1.77},
    "lp_lewd_frog": {"off": 2.67, "ap": 6},
    "lp_jelly": {"off": 3.98, "ap": 7},
    "lp_lewd_serpent": {"off": 2.98},
    "lp_lewd_centipede": {"off": 3.27},
    "lp_deep_tentacle": {"off": 2.86},
    "lp_octo_siren": {"off": 1.27, "ap": 8},
    "lp_glue_flower": {"off": 2.33},
    "lp_charm_orchid": {"off": 2.17, "ap": 6},
    "lp_tentacle_vine": {"off": 2.55},
    "lp_honey_pitcher": {"off": 2.42},
    "lp_devour_flower": {"off": 2.95},
    "lp_lewd_dryad": {"off": 3.7, "ap": 7},
    "lp_succ_dancer": {"off": 3.33, "ap": 6},
    "lp_imp_usher": {"off": 3.83},
    "lp_incubus": {"off": 2.11},
    "lp_succ_diva": {"off": 0.92},
    "lp_nightmare": {"off": 2.48},
    "lp_succ_lead": {"off": 3.58, "ap": 8},
    "lp_mimic_s": {"off": 1.11},
    "lp_mimic_m": {"off": 1.8},
    "lp_mimic_d": {"off": 1.39},
    "lp_boss_hound_alpha": {"off": 3.75},
    "lp_boss_white_fox": {"off": 5.88},
    "lp_boss_stallion": {"off": 6.81},
    "lp_boss_slime_mother": {"off": 4.73, "ap": 7},
    "lp_boss_slug_king": {"off": 6.81},
    "lp_boss_hive_queen": {"off": 4.51},
    "lp_boss_tank_octopus": {"off": 4.18},
    "lp_boss_sea_serpent": {"off": 4.62},
    "lp_boss_abyss_mother": {"off": 6.32},
    "lp_boss_giant_glue": {"off": 6.64},
    "lp_boss_lotus": {"off": 4.57},
    "lp_boss_flower_queen": {"off": 5.77},
    "lp_boss_queen": {"off": 5.93, "ap": 8},
    "lp_boss_manager": {"off": 5.82},
    "lp_boss_director": {"off": 4.84},
}


def attrs(main, lv, **extra):
    a = {"str": 10, "dex": 12, "int": 8, "fai": 10, "cha": 12}
    a.update(extra)
    a[main] = 14 + lv // 2
    return a


def mon(i, name, kind, lv, main, weapon, ab, resist, desc, loot, boss=False, evade=0, dr=1, rut=False, below=None, extra=None, money=None):
    hp = BOSS_HP[lv] if boss else LEVEL_HP[lv]
    e = {"id": i, "name": name, "level": lv, "attrs": attrs(main, lv, **(extra or {})), "hp": hp, "ap": (7 if lv >= 10 else 6) if boss else (6 if lv >= 12 else 5),
         "weapon": {"dice": weapon[0], "type": weapon[1], "attr": weapon[2]}, "evade": evade, "dr": dr, "abilities": ab}
    if below:
        e["ability_hp_below"] = {below: 40}
    e["resist"] = resist
    e["offense"] = {"all": 2 if boss else (2 if lv <= 7 else 2.5 if lv <= 10 else 3.5)}
    e["xp"] = BOSS_XP[lv] if boss else LEVEL_XP[lv]
    if money:
        e["money_cc"] = money
    e["loot"] = [({"item": n, "chance": c} if q == 1 else {"item": n, "chance": c, "qty": q}) for n, c, q in loot]
    if rut:
        e["rut"] = True
    e["desc"] = desc
    e["kind"] = kind
    t = TUNE.get(i)
    if t:
        e["hp"] = t.get("hp", e["hp"])
        if "off" in t:
            e["offense"] = {"all": t["off"]}
        if "ap" in t:
            e["ap"] = t["ap"]
    return e


MAT = {'park_beast': '淫獸的柔毛', 'park_insect': '媚液結晶', 'park_aquarium': '觸手的黏膜', 'park_garden': '媚香花蜜', 'park_theater': '夢魔的鱗粉'}
TROPHY = {'park_beast': '黑鬃的鬃毛', 'park_insect': '蟲后的蜜蠟', 'park_aquarium': '觸手母體的心核', 'park_garden': '千花魅后的花蕊', 'park_theater': '魅魔女王的黑薔薇'}
# 打工線獨特技能的技能書：深層層主保證掉、中層層主一半、淺層層主三分之一
BOOKS = {
    'park_beast': ('《斟酒的媚態》', '《戰利品的覺悟》', '《求偶紋》'),
    'park_insect': ('《十指的特別服務》', '《熱泉的耐性》', '《魔導刺激》'),
    'park_aquarium': (None, '《搓背的手藝》', '《潮之新娘》'),
    'park_garden': (None, '《萬眾矚目》', '《定格的姿態》'),
    'park_theater': (None, '《莊家的賭局》', '《獻祭的契紋》'),
}
TEA, OIL = '清心茶', '媚香精油'
WEAK_LUST = {"lust": 0.5}


def minion_loot(park, lv):
    return [(MAT[park], 0.6, 2 if lv >= 12 else 1), (TEA if lv % 2 else OIL, 0.1, 1)]


def boss_loot(park, layer):
    book = BOOKS[park][layer]
    out = [(MAT[park], 1, 3 + layer)]
    if layer == 2:
        out.insert(0, (TROPHY[park], 1, 1))
    if book:
        out.append((book, [0.35, 0.5, 1][layer], 1))
    out.append((OIL, 0.5, 1))
    return out


def park_monsters():
    P = 'park_beast'
    beast = [
        mon('lp_lewd_cat', '淫貓', 'beast', 6, 'dex', ('1d8', 'slashing', 'dex'), ['lp_lurk', 'lp_pounce'], {**WEAK_LUST, "cold": 0.25, "psychic": -0.25},
            '比豹還大的黑貓，尾巴尖是粉紅色的。先躲進牧場的長草裡，再撲到人身上又舔又蹭。', minion_loot(P, 6), evade=2, rut=True),
        mon('lp_lewd_monkey', '淫猴', 'beast', 7, 'dex', ('1d8', 'bludgeoning', 'dex'), ['lp_monkey_raid'], {**WEAK_LUST, "fire": 0.25, "piercing": -0.25},
            '成群在圍欄上跳來跳去的紅臉猴子，會從頭頂撲下來扯人的衣服，扯到了就搶著往裡面摸。', minion_loot(P, 7), evade=1, rut=True),
        mon('lp_lewd_hound', '淫犬', 'beast', 9, 'str', ('2d6', 'piercing', 'str'), ['lp_sniff'], {**WEAK_LUST, "fire": 0.25, "cold": -0.25},
            '鼻子比獵犬還靈的大狗，聞得出誰最想要，就專撲誰；舌頭又長又燙。', minion_loot(P, 9), rut=True),
        mon('lp_lewd_fox', '淫狐', 'beast', 10, 'cha', ('2d6', 'fire', 'cha'), ['m_lust_gaze', 'siren_song'], {**WEAK_LUST, "cold": 0.25, "fire": -0.5},
            '會說人話的三尾狐狸，狐火燒在身上不痛，只會一路熱到小腹。', minion_loot(P, 10), evade=1, rut=True),
        mon('lp_rut_boar', '發情的種豬', 'beast', 12, 'str', ('3d8', 'piercing', 'str'), ['lp_rut_charge'], {**WEAK_LUST, "fire": 0.25, "bludgeoning": -0.25},
            '牧場的種豬，比牛還壯，獠牙上掛著口水，一聞到人味就發情，橫衝直撞。', minion_loot(P, 12), dr=2, rut=True),
        mon('lp_nine_tail', '九尾淫狐', 'beast', 12, 'cha', ('3d8', 'fire', 'cha'), ['m_lust_gaze', 'm_lust_kiss', 'siren_song'], {**WEAK_LUST, "cold": 0.25, "fire": -0.5},
            '九條尾巴的老狐狸，化成人形時是個媚眼如絲的美人，吻一下就讓人腿軟。', minion_loot(P, 12), evade=2, rut=True),
        mon('lp_boss_hound_alpha', '獸舍的淫犬王', 'beast', 7, 'str', ('2d8', 'piercing', 'str'), ['lp_sniff', 'battle_roar', 'wolf_trip', 'lp_lust_tide'], {**WEAK_LUST, "fire": 0.25, "cold": -0.25},
            '淫獸牧場淺層的層主：獸舍裡最大的一條狗，帶著一群淫犬守著往下的柵門，把闖進來的人當成發情期的母狗。', boss_loot(P, 0), boss=True, rut=True, below='lp_lust_tide'),
        mon('lp_boss_white_fox', '牧場的白尾狐仙', 'beast', 10, 'cha', ('2d10', 'fire', 'cha'), ['m_lust_gaze', 'siren_song', 'lp_encore', 'lp_lust_tide'], {**WEAK_LUST, "cold": 0.25, "fire": -0.5},
            '淫獸牧場中層的層主：一身白毛的狐仙，魅魔們說牠比她們還會勾人；守著往下的柵門。', boss_loot(P, 1), boss=True, evade=2, rut=True, below='lp_lust_tide'),
        mon('lp_boss_stallion', '種馬「黑鬃」', 'beast', 13, 'str', ('4d8', 'bludgeoning', 'str'), ['lp_rut_charge', 'trample', 'm_lust_kiss', 'lp_lust_tide'], {**WEAK_LUST, "fire": 0.25, "bludgeoning": -0.25},
            '淫獸牧場的最終層主：魅魔們最得意的種馬，鬃毛黑得發亮，耐力好得沒有盡頭。被牠撞倒的人，第二天都走不了路。', boss_loot(P, 2), boss=True, dr=3, rut=True, below='lp_lust_tide'),
    ]
    P = 'park_insect'
    insect = [
        mon('lp_aphro_leech', '媚液水蛭', 'beast', 6, 'str', ('1d8', 'piercing', 'str'), ['m_aphro_grip'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '手臂那麼粗的水蛭，吸住人就不放，一邊吸一邊吐出媚液。', minion_loot(P, 6)),
        mon('lp_lewd_slug', '淫蛞蝓', 'beast', 7, 'str', ('1d10', 'acid', 'str'), ['lp_slime_engulf'], {**WEAK_LUST, "fire": 0.5, "bludgeoning": -0.5},
            '粉紅色的大蛞蝓，爬過的地方留下一條溫熱的黏液，黏到皮膚上就癢得受不了。', minion_loot(P, 7)),
        mon('lp_powder_moth', '鱗粉蛾', 'beast', 9, 'dex', ('2d6', 'poison', 'dex'), ['lp_scale_powder'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '翅膀張開比人還寬的蛾，一拍翅膀就撒下一片粉紅色的鱗粉，吸進去全身發燙。', minion_loot(P, 9), evade=2),
        mon('lp_aphro_slime', '媚藥史萊姆', 'elemental', 10, 'str', ('2d8', 'acid', 'str'), ['lp_slime_engulf', 'm_aphro_grip'], {**WEAK_LUST, "cold": 0.5, "physical": -0.25},
            '溫室黏液池裡長出來的史萊姆，整隻都是媚藥，會把人整個裹進去慢慢揉。', minion_loot(P, 10)),
        mon('lp_lewd_spider', '淫巨蛛', 'beast', 12, 'dex', ('3d8', 'piercing', 'dex'), ['web_spit', 'm_aphro_grip'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '溫室天花板上的大蜘蛛，用帶媚毒的蛛絲把獵物綁成一團，吊起來慢慢享用。', minion_loot(P, 12), evade=1),
        mon('lp_brood_wasp', '產卵寄生蜂', 'beast', 12, 'dex', ('3d8', 'piercing', 'dex'), ['lp_ovipositor'], {**WEAK_LUST, "fire": 0.5, "piercing": -0.25},
            '把卵產在溫暖的身體裡的大黃蜂，產卵管上沾滿了讓人發軟的毒。', minion_loot(P, 12), evade=2),
        mon('lp_boss_slime_mother', '粉紅史萊姆母體', 'elemental', 7, 'str', ('2d8', 'acid', 'str'), ['lp_slime_engulf', 'regenerate', 'm_aphro_grip', 'lp_lust_tide'], {**WEAK_LUST, "cold": 0.5, "physical": -0.25},
            '蟲之溫室淺層的層主：佔滿整個黏液池的史萊姆，所有的淫蛞蝓都從牠身上分出來；守著往下的溫室門。', boss_loot(P, 0), boss=True, below='lp_lust_tide'),
        mon('lp_boss_slug_king', '溫室的蛞蝓王', 'beast', 10, 'str', ('2d10', 'acid', 'str'), ['lp_slime_engulf', 'acid_spit', 'lp_scale_powder', 'lp_lust_tide'], {**WEAK_LUST, "fire": 0.5, "bludgeoning": -0.5},
            '蟲之溫室中層的層主：比馬車還大的蛞蝓，背上長著一叢叢會噴媚粉的菌傘。', boss_loot(P, 1), boss=True, dr=2, below='lp_lust_tide'),
        mon('lp_boss_hive_queen', '苗床的蟲后', 'beast', 13, 'dex', ('4d8', 'piercing', 'dex'), ['lp_ovipositor', 'web_spit', 'lp_scale_powder', 'lp_lust_tide'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '蟲之溫室的最終層主：溫室深處的蟲后，把打輸的冒險者當成苗床，整座溫室的蟲都是牠生的。', boss_loot(P, 2), boss=True, evade=1, below='lp_lust_tide'),
    ]
    P = 'park_aquarium'
    aquarium = [
        mon('lp_lewd_frog', '淫巨蛙', 'beast', 6, 'str', ('1d8', 'bludgeoning', 'str'), ['lp_long_tongue'], {**WEAK_LUST, "lightning": 0.5, "cold": -0.25},
            '比人還胖的大青蛙，舌頭能伸到三步外，捲到人就往嘴邊拖。', minion_loot(P, 6)),
        mon('lp_jelly', '媚液水母', 'beast', 7, 'dex', ('1d8', 'poison', 'dex'), ['m_aphro_grip'], {**WEAK_LUST, "lightning": 0.5, "physical": -0.25},
            '在展示水槽裡發著粉光的水母，觸鬚碰到皮膚就留下一道熱辣辣的媚毒。', minion_loot(P, 7), evade=1),
        mon('lp_lewd_serpent', '淫蛇', 'beast', 9, 'dex', ('2d6', 'piercing', 'dex'), ['lp_constrict'], {**WEAK_LUST, "cold": 0.5, "poison": -0.5},
            '水道裡的大蛇，喜歡從腳踝纏上來，一圈一圈纏到胸口再慢慢收緊。', minion_loot(P, 9), evade=1),
        mon('lp_lewd_centipede', '淫蜈', 'beast', 10, 'dex', ('2d6', 'poison', 'dex'), ['lp_many_legs'], {**WEAK_LUST, "lightning": 0.5, "poison": -0.5},
            '水邊的大蜈蚣，幾十隻腳同時爬上身，每一隻都在找縫鑽。', minion_loot(P, 10), dr=2),
        mon('lp_deep_tentacle', '深水觸手', 'beast', 12, 'str', ('3d8', 'bludgeoning', 'str'), ['lp_constrict', 'm_aphro_grip'], {**WEAK_LUST, "lightning": 0.5, "cold": -0.5},
            '深水槽裡伸出來的觸手，不知道本體在哪裡；吸盤上全是媚液，纏上就不放。', minion_loot(P, 12), dr=2),
        mon('lp_octo_siren', '章魚淫妖', 'beast', 12, 'cha', ('3d8', 'cold', 'cha'), ['m_lust_gaze', 'ink_cloud', 'lp_constrict'], {**WEAK_LUST, "lightning": 0.5, "cold": -0.5},
            '上半身是女人、下半身是八條觸手的淫妖，在水槽玻璃後面對遊客拋媚眼，出來就拖人下水。', minion_loot(P, 12), evade=1),
        mon('lp_boss_tank_octopus', '水槽的看守章魚', 'beast', 7, 'str', ('2d8', 'bludgeoning', 'str'), ['lp_constrict', 'ink_cloud', 'm_aphro_grip', 'lp_lust_tide'], {**WEAK_LUST, "lightning": 0.5, "cold": -0.25},
            '觸手水族館淺層的層主：看守展示水槽的大章魚，把想偷看的人拖進水槽裡當展品；守著往下的水道閘門。', boss_loot(P, 0), boss=True, below='lp_lust_tide'),
        mon('lp_boss_sea_serpent', '絞纏的大海蛇', 'beast', 10, 'dex', ('2d10', 'piercing', 'dex'), ['lp_constrict', 'tidal_crash', 'm_lust_kiss', 'lp_lust_tide'], {**WEAK_LUST, "cold": 0.5, "poison": -0.5},
            '觸手水族館中層的層主：盤在大水槽裡的海蛇，一次能纏住三個人。', boss_loot(P, 1), boss=True, evade=1, below='lp_lust_tide'),
        mon('lp_boss_abyss_mother', '觸手母體', 'beast', 13, 'str', ('4d8', 'bludgeoning', 'str'), ['lp_constrict', 'm_aphro_grip', 'tidal_crash', 'lp_lust_tide'], {**WEAK_LUST, "lightning": 0.5, "cold": -0.5},
            '觸手水族館的最終層主：最深的水槽裡那一團看不出形狀的肉，整座水族館的觸手都是牠的一部分。', boss_loot(P, 2), boss=True, dr=3, below='lp_lust_tide'),
    ]
    P = 'park_garden'
    garden = [
        mon('lp_glue_flower', '噴膠花', 'plant', 6, 'dex', ('1d8', 'acid', 'dex'), ['lp_glue'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '迷宮花園裡的大花，花心對準人就噴出一大團甜膩的膠，黏住就動不了。', minion_loot(P, 6)),
        mon('lp_charm_orchid', '媚香蘭', 'plant', 7, 'cha', ('1d8', 'poison', 'cha'), ['m_lust_gaze'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '會動的蘭花，香味讓人腦袋發暈、身體發熱，聞久了只想躺下。', minion_loot(P, 7)),
        mon('lp_tentacle_vine', '觸手藤', 'plant', 9, 'str', ('2d6', 'bludgeoning', 'str'), ['lp_vine_pull'], {**WEAK_LUST, "fire": 0.5, "piercing": -0.25},
            '花叢裡的藤蔓，摸到人就纏上來，把獵物拖進花叢深處。', minion_loot(P, 9), dr=2),
        mon('lp_honey_pitcher', '蜜壺草', 'plant', 10, 'str', ('2d8', 'acid', 'str'), ['lp_honey'], {**WEAK_LUST, "fire": 0.5, "acid": -0.5},
            '比人還高的豬籠草，壺裡裝滿了溫熱的花蜜，掉進去的人一身甜膩地爬不出來。', minion_loot(P, 10)),
        mon('lp_devour_flower', '吞噬花', 'plant', 12, 'str', ('3d8', 'acid', 'str'), ['lp_swallow'], {**WEAK_LUST, "fire": 0.5, "acid": -0.5},
            '花苞比人還大的花，把人整個吞進去，在裡面用花瓣和花蜜慢慢揉上半天。', minion_loot(P, 12), dr=2),
        mon('lp_lewd_dryad', '淫樹精', 'fey', 12, 'cha', ('3d8', 'psychic', 'cha'), ['m_lust_kiss', 'm_lust_gaze', 'regenerate'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '從花園的老樹裡走出來的樹精，綠色的皮膚、花瓣做的頭髮，吻人的時候嘴裡有花蜜的味道。', minion_loot(P, 12), evade=1),
        mon('lp_boss_giant_glue', '巨型噴膠花', 'plant', 7, 'dex', ('2d8', 'acid', 'dex'), ['lp_glue', 'acid_spit', 'm_lust_gaze', 'lp_lust_tide'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '淫植花園淺層的層主：堵在迷宮出口的巨花，把闖進來的人一個個黏在花瓣上展示。', boss_loot(P, 0), boss=True, below='lp_lust_tide'),
        mon('lp_boss_lotus', '溫泉的蓮花妖', 'fey', 10, 'cha', ('2d10', 'cold', 'cha'), ['m_lust_kiss', 'lp_honey', 'siren_song', 'lp_lust_tide'], {**WEAK_LUST, "fire": 0.5, "cold": -0.5},
            '淫植花園中層的層主：花園溫泉裡的蓮花妖，邀人下來一起泡，泡著泡著就出不來了。', boss_loot(P, 1), boss=True, evade=1, below='lp_lust_tide'),
        mon('lp_boss_flower_queen', '千花魅后', 'fey', 13, 'cha', ('4d8', 'psychic', 'cha'), ['lp_swallow', 'm_lust_kiss', 'lp_honey', 'lp_lust_tide'], {**WEAK_LUST, "fire": 0.5, "poison": -0.5},
            '淫植花園的最終層主：花園的女主人，半人半花，坐在一朵比房子還大的花上；整座花園的花都聽她的。', boss_loot(P, 2), boss=True, evade=1, below='lp_lust_tide'),
    ]
    P = 'park_theater'
    WEAK_HOLY = {"radiant": 0.5}
    theater = [
        mon('lp_succ_dancer', '魅魔舞者', 'demon', 6, 'cha', ('1d8', 'slashing', 'dex'), ['m_lust_kiss'], {**WEAK_HOLY, "fire": -0.25, "lust": 0.25},
            '劇場舞台上的魅魔舞者，跳著跳著就跳到觀眾腿上；腳踝的鈴鐺一響，人就跟著發軟。', minion_loot(P, 6), evade=2, extra={"dex": 16}),
        mon('lp_imp_usher', '小惡魔引座員', 'demon', 7, 'dex', ('1d8', 'fire', 'dex'), ['lp_lurk', 'm_lust_gaze'], {**WEAK_HOLY, "fire": -0.5, "lust": 0.25},
            '穿著燕尾服的小惡魔，帶位帶到一半就把人推進暗處，說是「包廂服務」。', minion_loot(P, 7), evade=2),
        mon('lp_incubus', '夢魔', 'spirit', 9, 'cha', ('2d6', 'psychic', 'cha'), ['lp_dream'], {**WEAK_HOLY, "physical": -0.25, "lust": 0.25},
            '在觀眾席上飄來飄去的夢魔，坐到誰旁邊，誰就開始做不能說的春夢。', minion_loot(P, 9), evade=1),
        mon('lp_succ_diva', '魅魔歌姬', 'demon', 10, 'cha', ('2d6', 'thunder', 'cha'), ['m_lust_gaze', 'sonic_scream'], {**WEAK_HOLY, "fire": -0.25, "lust": 0.25},
            '劇場的當家歌姬，歌聲甜得發膩，唱到高音的時候整排觀眾一起喘氣。', minion_loot(P, 10), evade=1),
        mon('lp_nightmare', '夢魘', 'spirit', 12, 'cha', ('3d8', 'psychic', 'cha'), ['lp_dream', 'm_lust_kiss'], {**WEAK_HOLY, "physical": -0.25, "lust": 0.25},
            '後台的黑影，騎在睡著的人身上吸精氣；醒著的人被它碰到，也會像在夢裡一樣動不了。', minion_loot(P, 12), evade=2),
        mon('lp_succ_lead', '魅魔劇團的首席', 'demon', 12, 'cha', ('3d8', 'slashing', 'dex'), ['m_lust_kiss', 'm_lust_gaze'], {**WEAK_HOLY, "fire": -0.25, "lust": 0.25},
            '夢魔劇場的首席女演員，每一場都要從觀眾裡挑一個人上台「一起演」。', minion_loot(P, 12), evade=2, extra={"dex": 18}),
        mon('lp_boss_manager', '劇場經理', 'demon', 7, 'cha', ('2d8', 'fire', 'cha'), ['m_lust_gaze', 'lp_encore', 'battle_roar', 'lp_lust_tide'], {**WEAK_HOLY, "fire": -0.5, "lust": 0.25},
            '夢魔劇場淺層的層主：叼著雪茄的胖惡魔，劇場的錢都歸他管，付不出票錢的人就拿身體抵；守著往後台的門。', boss_loot(P, 0), boss=True, below='lp_lust_tide'),
        mon('lp_boss_director', '後台的夢魔導演', 'spirit', 10, 'cha', ('2d10', 'psychic', 'cha'), ['lp_dream', 'lp_encore', 'm_lust_kiss', 'lp_lust_tide'], {**WEAK_HOLY, "physical": -0.25, "lust": 0.25},
            '夢魔劇場中層的層主：把春夢排成戲的導演，演員不夠的時候就把闖進後台的人寫進劇本裡。', boss_loot(P, 1), boss=True, evade=1, below='lp_lust_tide'),
        mon('lp_boss_queen', '魅魔女王', 'demon', 13, 'cha', ('4d8', 'slashing', 'dex'), ['m_lust_kiss', 'lp_encore', 'death_decree', 'lp_lust_tide'], {**WEAK_HOLY, "fire": -0.5, "lust": 0.25},
            '緋夢樂園的主人、夢魔劇場的最終層主：每晚的壓軸都由她親自上台，被她選中的人會在全場的注視下高潮到天亮。', boss_loot(P, 2), boss=True, evade=2, below='lp_lust_tide', extra={"dex": 18}),
    ]
    mimic_loot = lambda lv: [(TEA, 0.5, 1), (OIL, 0.5, 1)] + ([('《極樂秘典》', 0.05, 1)] if lv >= 9 else [])
    mimics = [
        mon(f'lp_mimic_{k}', name, 'beast', lv, 'str', (d, 'bludgeoning', 'str'), ['lp_tongue_lash'], {**WEAK_LUST, "fire": 0.25, "piercing": -0.25},
            '長得和園區裡的寶箱一模一樣，打開蓋子的瞬間伸出長滿菌絲的舌頭。魅魔們說這是「驚喜」。', mimic_loot(lv), dr=2, money=[lv * 10, lv * 30])
        for k, name, lv, d in (('s', '菌舌寶箱', 6, '1d10'), ('m', '大菌舌寶箱', 9, '2d8'), ('d', '老菌舌寶箱', 12, '3d8'))
    ]
    groups = {'park_beast': beast, 'park_insect': insect, 'park_aquarium': aquarium, 'park_garden': garden, 'park_theater': theater}
    return groups, mimics


def encounters(groups):
    out = {}
    for park, m in groups.items():
        a, b, c, d, e, f, bs, bm, bd = [x['id'] for x in m]
        out[park] = {
            "outskirts": [],
            "shallow": [[[a, 2]], [[b, 2]], [[a, 1], [b, 1]], [[b, 1], [a, 1]]],
            "middle": [[[c, 2]], [[d, 2]], [[c, 1], [d, 1]], [[c, 1], [b, 1]]],
            "deep": [[[e, 2]], [[f, 2]], [[e, 1], [f, 1]], [[e, 1], [d, 1]]],
            "boss": [[bd, 1], [e, 1]],
            "bosses": {"shallow": [[bs, 1], [a, 1]], "middle": [[bm, 1], [c, 1]], "deep": [[bd, 1], [e, 1]]},
        }
    return out


# ---------------- 物品 ----------------
def material(name, price, desc):
    return {"name": name, "category": "material", "price_cc": price, "tags": [], "adult": True, "desc": desc}


ITEMS = [
    material('淫獸的柔毛', 90, '淫獸牧場的動物身上掉下來的軟毛，帶著一點發情的氣味，裁縫店拿來做成人向服裝的滾邊。'),
    material('媚液結晶', 110, '蟲之溫室的媚液乾掉之後結成的粉紅色晶體，鍊金師拿來調媚藥。'),
    material('觸手的黏膜', 100, '觸手水族館的觸手上剝下來的半透明黏膜，碰到體溫就變軟。'),
    material('媚香花蜜', 120, '淫植花園的花蜜，甜得發膩，香味讓人臉紅心跳。'),
    material('夢魔的鱗粉', 130, '夢魔劇場的夢魔身上落下的銀色粉末，撒在枕頭上會做一整晚的春夢。'),
    material('黑鬃的鬃毛', 1200, '種馬「黑鬃」的鬃毛，黑得發亮、硬得像琴弦；魅魔們說編成鞭子最好用。'),
    material('蟲后的蜜蠟', 1200, '苗床的蟲后巢裡的蜜蠟，溫溫的、軟軟的，聞起來像甜膩的體香。'),
    material('觸手母體的心核', 1300, '觸手母體最深處的一顆肉核，離開水之後還在一跳一跳地動。'),
    material('千花魅后的花蕊', 1300, '千花魅后的花蕊，一千種花香混在一起，聞一下就腿軟。'),
    material('魅魔女王的黑薔薇', 1500, '魅魔女王別在胸前的黑薔薇，永遠不會凋謝；據說是她從第一個被她征服的人身上摘下來的。'),
    {"name": TEA, "category": "consumable", "price_cc": 60, "tags": ["general"], "adult": True, "use": {"lust": -30, "cleanse": ["aphrodisiac", "sensitized"]},
     "desc": "加了薄荷與苦草的冷茶，喝一口就清醒過來：慾望 −30，解除媚毒與敏感。戰鬥中使用。",
     "recipe": {"craft": "alchemy", "level": 3, "inputs": [{"name": "藥草", "qty": 2}], "cost_cc": 10, "hours": 1}},
    {"name": OIL, "category": "consumable", "price_cc": 80, "tags": ["general"], "adult": True, "use": {"status": {"id": "charm_glow", "turns": 3}},
     "desc": "抹在手腕與胸口的精油，香味讓自己的身體也跟著熱起來：3 回合每回合慾望 +5（給想要引爆的人用）。戰鬥中使用。",
     "recipe": {"craft": "alchemy", "level": 3, "inputs": [{"name": "媚香花蜜", "qty": 1}], "qty": 2, "hours": 2}},
    {"name": "緋夢樂園的通行頸環", "category": "equipment", "price_cc": 3200, "tags": ["unique"], "adult": True,
     "desc": "集滿五個章的人才拿得到的頸環，黑色蕾絲上掛著一顆粉紅色的心形寶石。戴著它在血羽城堡走一圈，魅魔們都會對你眨眼睛。",
     "gear": {"base": "lace_choker", "material": "moonsilk", "rarity": "epic", "attrs": {"cha": 2}, "enchants": {"mods": {"save": 1, "evade": 1}}, "unique": {"check": {"kinds": ["flatter", "chat"]}, "bonus": 3}}},
    {"name": "魅魔女王的吊帶襪", "category": "equipment", "price_cc": 3200, "tags": ["unique"], "adult": True,
     "desc": "魅魔女王在壓軸演出穿過的吊帶襪，黑絲上繡著暗紅色的薔薇；穿上它的人站上任何舞台都不會怯場。",
     "gear": {"base": "garter_stockings", "material": "moonsilk", "rarity": "epic", "attrs": {"cha": 1, "dex": 1}, "enchants": {"mods": {"evade": 1, "crit": 1}}, "unique": {"check": {"contexts": ["initiative"]}, "bonus": 3}}},
]

# ---------------- 園區的規則（lewd.json 的 park） ----------------
def park_rules():
    pb = lambda books: [[b, 0.012] for b in books]
    all_books = [b for park in BOOKS.values() for b in park if b]
    return {
        "$comment": "魅魔的遊樂園（docs/LUST_PARK.md）。step_lust：在園區裡每走一格，全隊的魅氣（跨戰鬥保留的慾望，慾望上限的比例）增加多少，走路最多累積到 step_cap；trap_lust：沒察覺的陷阱是媚藥機關，觸發的人魅氣增加多少（取代陷阱的傷害）；mimic_chance：園區的寶箱是擬態寶箱的機率，mimics 依層（1 淺層、2 中層、3 深層）；chest_items：園區的寶箱另外擲的物品；defeats：各園區的專屬戰敗（scene 交給成人場景的寫手、summary 寫進戰報、effects 套用、hours 經過的時間）。",
        "step_lust": 0.01, "step_cap": 0.4, "trap_lust": 0.2,
        "mimic_chance": 0.25,
        "mimics": {"1": "lp_mimic_s", "2": "lp_mimic_m", "3": "lp_mimic_d"},
        "chest_items": [[TEA, 0.3], [OIL, 0.3], ["《極樂秘典》", 0.04], ["《傾國》", 0.02]] + pb(all_books),
        "defeats": {
            "park_beast": {
                "scene": "主角在淫獸牧場倒下，被淫獸們拖進獸舍、關進圍欄當一晚的「展示動物」：牧場的淫獸輪流爬上來騎主角，魅魔們帶著遊客在圍欄外面看，一直到天亮",
                "summary": "被淫獸們拖進獸舍，當了一整晚的展示動物，天亮才被魅魔們放回入口廣場。",
                "effects": [{"type": "condition", "target": "pc", "condition": "aroused", "add": True}, {"type": "lewd", "stat": "lewdness", "delta": 2}],
                "hours": 10},
            "park_insect": {
                "scene": "主角在蟲之溫室倒下，被蟲子們搬到溫室深處當成苗床：黏液把主角固定在溫床上，寄生蜂與蛞蝓輪流在主角身上產卵、留下種子，媚液泡得主角一直在高潮",
                "summary": "被當成溫室的苗床，身上被留下了寄生植物的種子；魅魔園丁把你從溫床上剝下來，丟回入口廣場。",
                "effects": [{"type": "condition", "target": "pc", "condition": "aroused", "add": True}, {"type": "parasite", "op": "add", "parasite": "parasite_seed"}],
                "hours": 6},
            "park_aquarium": {
                "scene": "主角在觸手水族館倒下，被觸手們放進展示水槽給遊客觀賞：透明的水槽裡，觸手纏住主角的四肢、鑽進身體，玻璃外面擠滿了指指點點的遊客",
                "summary": "被放進展示水槽給遊客看了一整個下午，閉館時才被撈出來送回入口廣場；來看的人可不少。",
                "effects": [{"type": "condition", "target": "pc", "condition": "aroused", "add": True}, {"type": "lewd", "stat": "exposure", "delta": 8}],
                "hours": 8},
            "park_garden": {
                "scene": "主角在淫植花園倒下，被一朵巨大的花苞吞進去，困在裡面半天：花瓣與花蕊包住全身慢慢揉弄，花蜜灌滿了身體，最後帶著發情被吐出來",
                "summary": "被花苞吞進去困了半天，渾身花蜜地被吐出來，自己走回了入口廣場。",
                "effects": [{"type": "condition", "target": "pc", "condition": "aroused", "add": True}, {"type": "lewd", "stat": "sensitivity", "delta": 2}],
                "hours": 12},
            "park_theater": {
                "scene": "主角在夢魔劇場倒下，被拉上舞台當當晚表演的主角：魅魔與夢魔在滿座的觀眾面前一個接一個玩弄主角，主角在全場的歡呼聲裡被逼到一次又一次高潮",
                "summary": "被拉上舞台當了當晚表演的主角，滿座的觀眾都看見了；謝幕之後才被送回入口廣場。",
                "effects": [{"type": "condition", "target": "pc", "condition": "aroused", "add": True}, {"type": "lewd", "stat": "exposure", "delta": 15}],
                "hours": 6},
        },
    }


# ---------------- 入口廣場、地標、接待員 ----------------
GREETER = 'npc_park_greeter'
PLAZA_GRID = [
    "###########",
    "#.#.#.#.#.#",
    "#.........#",
    "#.........#",
    "#.........#",
    "#S~~...~~.#",
    "#.........#",
    "#####E#####",
]
GATES = [(1, 1), (3, 1), (5, 1), (7, 1), (9, 1)]


def plaza_block():
    conns = [{"at": {"x": x, "y": y}, "to": {"area": f"dungeon/{p}", "x": 0, "y": 0}} for (x, y), p in zip(GATES, PARKS)]
    shops = [{"shop": "general", "x": 1, "y": 3}, {"shop": "tailor", "x": 9, "y": 3}]
    rows = ',\n'.join(f'        "{r}"' for r in PLAZA_GRID)
    desc = '魅魔們經營的遊樂園「緋夢樂園」的入口廣場：粉紅色的燈籠串滿整片天空，旋轉木馬上坐著半裸的魅魔，兩座噴泉流著甜得發膩的香水。北邊五道拱門各通往一個園區——淫獸牧場、蟲之溫室、觸手水族館、淫植花園、夢魔劇場；接待員蜜菈站在廣場中央，發集章卡給新來的客人。'
    return (f'    "{PLAZA}": {{\n      "name": "緋夢樂園・入口廣場",\n      "location": "bloodplume",\n      "desc": {json.dumps(desc, ensure_ascii=False)},\n'
            f'      "lighting": "lit",\n      "refresh": true,\n      "peaceful": true,\n      "grid": [\n{rows}\n      ],\n'
            f'      "entry": {{ "x": 5, "y": 6 }},\n'
            f'      "connections": [\n' + ',\n'.join('        ' + json.dumps(c, ensure_ascii=False) for c in conns) + '\n      ],\n'
            f'      "shops": [' + ', '.join(json.dumps(s, ensure_ascii=False) for s in shops) + ']\n    }')


LANDMARK = {
    "id": "lm_lust_park", "name": "緋夢樂園的售票亭", "emoji": "🎡", "location": "bloodplume", "at": {"area": "bloodplume/gate", "x": 6, "y": 4}, "types": ["market"],
    "desc": "城門邊一座粉紅色的售票亭，招牌上畫著一個眨眼的魅魔：「緋夢樂園——讓你玩到腿軟」。走進去就是遊樂園的入口廣場。",
    "scene": "城門邊的粉紅色售票亭，掛滿了心形的燈籠，售票口的魅魔對每個路過的人拋媚眼。",
    "open": {"adult": True},
    "interior": PLAZA,
}

GREETER_LINE = ('    { "id": "' + GREETER + '", "name": "蜜菈", "gender": "female", "race": "demon", "class": "bard", "level": 9, "location": "bloodplume", "hire_cc": 0, "unhireable": true, "no_attack": true, "adult": true,\n'
                '      "kind": "commoner", "tags": ["merchant"], "occupation": "緋夢樂園的接待員", "fixed": { "area": "sm/' + PLAZA + '", "x": 5, "y": 3 },\n'
                '      "personality": "笑容甜得膩人，說話一半是宣傳詞、一半是黃色笑話；對客人有求必應，對打輸的客人更是熱情。",\n'
                '      "appearance": "身高約 165 公分，看起來二十出頭的魅魔，粉紅色的短髮上別著一頂小小的禮帽，一對小角從髮間探出來，背後一對蝙蝠翅膀收得很整齊；穿著紅色燕尾服式的短外套與極短的褶裙，胸前別著「接待員」的名牌，手上永遠拿著一疊集章卡。",\n'
                '      "adult_appearance": "外套底下什麼都沒穿，一彎腰就看得到；尾巴尖是心形的，高興的時候會左右搖。",\n'
                '      "background": "魅魔女王手下的接待員，負責在入口廣場發集章卡、說明園區的規矩、替打輸被送回來的客人擦乾身體。她說樂園的宗旨是「讓每一位客人都盡興而歸」——不管客人願不願意。集滿五個園區的章的人，可以找她換女王親自準備的獎品。",\n'
                '      "relations": {} },\n')


# ---------------- 集章的任務（story_batch1.py 匯入） ----------------
STAMPS = [f'park_stamp_{p}' for p in PARKS]


def _done(text, gear_name, memory):
    return {"text": text, "effects": [{"type": "item", "name": gear_name, "qty": 1}, {"type": "item", "name": "《傾國》", "qty": 1}, {"type": "money", "amount": 800},
                                     {"type": "memory", "summary": memory, "importance": 2}], "set_flags": ["park_stamps_done"], "complete": True}


PARK_STORIES = [{
    "id": "park_stamps", "title": "緋夢樂園的集章卡",
    "summary": "緋夢樂園的五個園區各有一個章，打倒園區最深處的層主就蓋得到。集滿五個章，接待員蜜菈說女王準備了獎品。",
    "tags": ["adult"], "rank": "B", "merit": 5,
    "start": {"kind": "npc", "npc": GREETER, "min_level": 11, "requires": {"flags": list(STAMPS)},
              "text": "蜜菈看到你的集章卡，眼睛都亮了，尾巴搖個不停：「哇——五個章都蓋滿了！你是今年第一個呢。」她把卡片收進胸口，「女王陛下說要親自挑獎品給你。跟我來，到後面的貴賓室挑一個吧——別擔心，這次真的只是挑獎品。」"},
    "start_flags": ["park_stamps_start"],
    "nodes": [{
        "id": "prize", "title": "在貴賓室挑一件獎品", "kind": "choice", "at": {"where": "npc", "npc": GREETER},
        "requires": {"flags": ["park_stamps_start"]},
        "text": "貴賓室裡鋪著紅絨布，桌上擺著兩個絲綢包著的盒子，還有一本燙金的書。蜜菈說：「書是送的。兩個盒子挑一個——頸環戴著出門比較方便，吊帶襪是女王陛下自己穿過的喔。」",
        "options": [
            {"label": "挑頸環", "success": _done("你拿起那條黑色蕾絲的頸環，心形的寶石在燈下閃著粉紅色的光。蜜菈親手替你戴上，在你耳邊說：「以後來玩，報這條頸環就好，女王陛下會記得你。」",
                                                "緋夢樂園的通行頸環", "集滿了緋夢樂園五個園區的章，在貴賓室挑了通行頸環，還拿到了一本《傾國》。")},
            {"label": "挑吊帶襪", "success": _done("你打開盒子，黑絲上繡著暗紅色的薔薇，還留著一點女王的香味。蜜菈吃吃地笑：「女王陛下說，穿著它上台的人，就是下一場的主角了。」",
                                                  "魅魔女王的吊帶襪", "集滿了緋夢樂園五個園區的章，在貴賓室挑了魅魔女王穿過的吊帶襪，還拿到了一本《傾國》。")},
        ],
    }],
    "rewards": [{"type": "money", "amount": 1000}, {"type": "xp", "amount": 2000}],
}]


# ---------------- 寫檔 ----------------
def remove_block(text, start_pat):
    """拿掉 start_pat（正規表示式）開頭、括號配對結束的一個物件（連同前面的逗號）"""
    m = re.search(start_pat, text)
    if not m:
        return text
    i = text.index('{', m.start())
    depth, j, in_str, esc = 0, i, False, False
    while True:
        ch = text[j]
        if in_str:
            esc = (ch == '\\' and not esc)
            if ch == '"' and not esc:
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                break
        j += 1
    start = m.start()
    # 連同前面的逗號與換行
    k = start
    while k > 0 and text[k - 1] in ' \n':
        k -= 1
    if text[k - 1] == ',':
        k -= 1
    return text[:k] + text[j + 1:]


def drop_lines(text, pattern):
    """拿掉符合 pattern 的整行（一行一筆的陣列），再補掉因此留在陣列結尾的逗號"""
    text = re.sub(pattern, '', text)
    return re.sub(r',(\s*\n\s*\])', r'\1', text)


def write():
    groups, mimics = park_monsters()
    monsters = [e for g in groups.values() for e in g] + mimics
    # 技能
    p = 'data/rules/abilities.json'
    t = open(p).read()
    t = drop_lines(t, r'\n    \{"id": "lp_[^"]+".*')
    anchor = re.search(r'\n    \{"id": "m_aphro_grip".*', t)
    line = anchor.group(0)
    body = line.rstrip(',')
    t = t[:anchor.start()] + body + ',\n' + ',\n'.join('    ' + json.dumps(a, ensure_ascii=False) for a in ABILITIES) + (',' if line.endswith(',') else '') + t[anchor.end():]
    json.loads(t)
    open(p, 'w').write(t)
    # 怪物與遭遇表
    p = 'data/rules/enemies.json'
    t = open(p).read()
    t = drop_lines(t, r'\n    \{"id": "lp_[^"]+".*')
    for park in PARKS:
        t = remove_block(t, r'\n    "' + park + r'": \{')
    i = t.index('\n  ],\n  "encounters"')
    head = t[:i].rstrip()
    if not head.endswith(','):
        head += ','
    t = head + '\n' + ',\n'.join('    ' + json.dumps(e, ensure_ascii=False) for e in monsters) + t[i:]
    i = t.index('\n  },\n  "wild_encounters"')
    blocks = []
    for park, enc in encounters(groups).items():
        lines = [f'      "{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in enc.items()]
        blocks.append(f'    "{park}": {{\n' + ',\n'.join(lines) + '\n    }')
    t = t[:i] + ',\n' + ',\n'.join(blocks) + t[i:]
    json.loads(t)
    open(p, 'w').write(t)
    # 物品
    p = 'data/rules/items.json'
    t = open(p).read()
    names = [x['name'] for x in ITEMS]
    for n in names:
        t = drop_lines(t, r'\n    \{"name": ' + re.escape(json.dumps(n, ensure_ascii=False)) + r'.*')
    anchor = re.search(r'\n    \{"name": "《潮之新娘》".*', t)
    line = anchor.group(0)
    t = t[:anchor.start()] + line.rstrip(',') + ',\n' + ',\n'.join('    ' + json.dumps(x, ensure_ascii=False) for x in ITEMS) + (',' if line.endswith(',') else '') + t[anchor.end():]
    json.loads(t)
    open(p, 'w').write(t)
    # 慾望指標的規則：park
    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = remove_block(t, r'\n  "park": \{')
    rules = park_rules()
    inner = ',\n'.join(f'    "{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in rules.items() if k != 'defeats')
    defeats = ',\n'.join(f'      "{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in rules['defeats'].items())
    block = f'  "park": {{\n{inner},\n    "defeats": {{\n{defeats}\n    }}\n  }}'
    t = t.rstrip().rstrip('}').rstrip() + ',\n' + block + '\n}\n'
    json.loads(t)
    open(p, 'w').write(t)
    # 地點
    p = 'data/world/geography.json'
    t = open(p).read()
    t = drop_lines(t, r'\n    \{ "id": "park_[^"]+".*')
    anchor = re.search(r'\n    \{ "id": "quicksand_temple".*', t)
    line = anchor.group(0)
    rows = [f'    {{ "id": "{k}", "name": "{v}", "region": "south", "type": "dungeon", "park": "{PLAZA}" }}' for k, v in PARKS.items()]
    t = t[:anchor.start()] + line.rstrip(',') + ',\n' + ',\n'.join(rows) + (',' if line.endswith(',') else '') + t[anchor.end():]
    json.loads(t)
    open(p, 'w').write(t)
    # 光線
    p = 'data/world/maps.json'
    t = open(p).read()
    t = re.sub(r'\n      "park_[^"]+": \[.*', '', t)
    anchor = re.search(r'\n      "mist_abbey": \[.*', t)
    rows = [f'      "{k}": {json.dumps(v)},' for k, v in LIGHTING.items()]
    t = t[:anchor.start()] + '\n' + '\n'.join(rows) + t[anchor.start():]
    json.loads(t)
    open(p, 'w').write(t)
    # 入口廣場
    p = 'data/world/special_maps.json'
    t = open(p).read()
    t = remove_block(t, r'\n    "' + PLAZA + r'": \{')
    end = t.rstrip().rstrip('}').rstrip()
    end = end[:-1].rstrip()
    t = end + ',\n' + plaza_block() + '\n  }\n}\n'
    json.loads(t)
    open(p, 'w').write(t)
    # 地標
    p = 'data/world/landmarks.json'
    doc = json.load(open(p))
    doc['landmarks'] = [x for x in doc['landmarks'] if x['id'] != LANDMARK['id']] + [LANDMARK]
    open(p, 'w').write(json.dumps(doc, ensure_ascii=False, indent=1))
    # 接待員
    p = 'data/world/npcs.json'
    t = open(p).read()
    t = remove_block(t, r'\n    \{ "id": "' + GREETER + '"')
    anchor = t.index('\n    { "id": "npc_rock_the_rat"')
    t = t[:anchor + 1] + GREETER_LINE + t[anchor + 1:]
    json.loads(t)
    open(p, 'w').write(t)
    print('monsters', len(monsters), 'abilities', len(ABILITIES), 'items', len(ITEMS))


if __name__ == '__main__':
    write()
