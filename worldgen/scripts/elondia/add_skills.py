import json, re, sys
def fmt(v):
    t = json.dumps(v, ensure_ascii=False, separators=(", ", ": "))
    t = re.sub(r"\{(?=\S)", "{ ", t)
    return re.sub(r"(?<=\S)\}", " }", t)

ROOT = sys.argv[1]
W = lambda: {"weapon": True}
def sk(id, name, cls, unlock, ap, desc, **kw):
    d = {"id": id, "name": name, "type": "skill", "classes": cls, "unlock": unlock, "ap": ap}
    d.update(kw)
    d["desc"] = desc
    return d

fighter = [
 sk("feinting_attack", "佯攻", ["fighter"], 1, 2, "虛晃一招再出手：優勢攻擊，額外 1d6 傷害。", attr="str", target="enemy", resolve="attack", adv=True, damage=[W(), {"dice": "1d6"}]),
 sk("trip_attack", "絆摔", ["fighter"], 2, 2, "額外 1d6 傷害，命中後目標力量豁免失敗則倒地（攻擊劣勢、被攻擊時對方優勢）1 回合。", attr="str", target="enemy", resolve="attack", damage=[W(), {"dice": "1d6"}], apply=[{"status": "prone", "turns": 1, "on": "hit", "save": "str"}]),
 sk("disarming_attack", "繳械", ["fighter"], 3, 2, "額外 1d6 傷害，命中後目標力量豁免失敗則被繳械（命中 -2、武器傷害 -3）2 回合。", attr="str", target="enemy", resolve="attack", damage=[W(), {"dice": "1d6"}], apply=[{"status": "disarmed", "turns": 2, "on": "hit", "save": "str"}]),
 sk("parry", "格擋", ["fighter"], 4, 1, "擺好架勢，下一次物理傷害減去 1d8 + 力量調整值 + 等級。", attr="str", target="self", resolve="auto", apply=[{"status": "deflecting", "turns": 3, "to": "self", "value": {"dice": "1d8", "mod": True, "level": True}}]),
 sk("rallying_cry", "集結號令", ["fighter"], 6, 2, "高聲號令，全隊回復 1d6 + 等級 HP。每場戰鬥一次。", target="all_allies", resolve="auto", heal={"dice": "1d6", "level": True}, uses={"per_combat": 1}),
 sk("menacing_attack", "威嚇攻擊", ["fighter"], 6, 3, "額外 1d8 傷害，命中後目標魅力豁免失敗則恐懼（攻擊劣勢）2 回合。", attr="str", target="enemy", resolve="attack", damage=[W(), {"dice": "1d8"}], apply=[{"status": "frightened", "turns": 2, "on": "hit", "save": "cha"}]),
 sk("fighting_spirit", "戰魂", ["fighter"], 8, 1, "鬥志高昂：獲得 5 + 等級臨時生命值，攻擊優勢 2 回合。每場戰鬥一次。", target="self", resolve="auto", shield={"flat": 5, "level": 1}, apply=[{"status": "fighting_spirit", "turns": 2, "to": "self"}], uses={"per_combat": 1}),
 sk("giants_might", "巨人之力", ["fighter"], 10, 2, "符文喚醒巨人的力量：武器傷害 +3、減傷 +1，但更容易被盯上（仇恨 +30%），持續 3 回合。每場戰鬥一次。", target="self", resolve="auto", apply=[{"status": "giant_might", "turns": 3, "to": "self"}], uses={"per_combat": 1}),
 sk("echo_strike", "回響打擊", ["fighter"], 12, 3, "回響分身與本體一起出手：連續 2 次武器攻擊。", attr="str", target="enemy", resolve="attack", hits=2, damage=[W()]),
 sk("psionic_strike", "靈能打擊", ["fighter"], 14, 3, "以念力加重一擊：額外 3d6 奧術傷害。", attr="str", target="enemy", resolve="attack", damage=[W(), {"dice": "3d6", "type": "force"}]),
 sk("bursting_arrow", "爆裂秘矢", ["fighter"], 15, 4, "注入魔力的一箭在敵陣中炸開：所有敵人靈巧豁免，4d6 + 力量調整值奧術傷害（成功減半）。", attr="str", target="all_enemies", resolve="save", save="dex", on_save="half", damage=[{"dice": "4d6", "type": "force", "mod": True}]),
 sk("rapid_strike", "疾風連斬", ["fighter"], 16, 4, "快得看不清的連斬：3 次攻擊，每次傷害 ×0.8。", attr="str", target="enemy", resolve="attack", hits=3, mult=0.8, damage=[W()]),
]
barbarian = [
 sk("divine_fury", "神怒", ["barbarian"], 1, 2, "怒火中帶著神威：武器攻擊附加 1d6 神聖傷害，每 6 級再 +1d6。", attr="str", target="enemy", resolve="attack", damage=[W(), {"dice": "1d6", "type": "radiant", "scale": {"dice": "1d6", "per": 6}}]),
 sk("bear_spirit", "熊之魂", ["barbarian"], 2, 1, "熊的靈魂附身：物理傷害 ×0.75，更容易被盯上（仇恨 +30%），持續 3 回合。", target="self", resolve="auto", apply=[{"status": "bear_spirit", "turns": 3, "to": "self"}]),
 sk("wolf_hunt", "狼群獵殺", ["barbarian"], 3, 2, "像狼群般圍住獵物：目標被攻擊時對方優勢，持續 2 回合。", target="enemy", resolve="auto", apply=[{"status": "outlined", "turns": 2}]),
 sk("frenzy_strike", "狂亂連擊", ["barbarian"], 5, 3, "不顧一切地連砍：2 次攻擊，每次傷害 ×0.8，但自己露出破綻（迴避 -3）1 回合。", attr="str", target="enemy", resolve="attack", hits=2, mult=0.8, damage=[W()], apply=[{"status": "exposed", "turns": 1, "to": "self", "on": "always"}]),
 sk("ancestral_protectors", "先祖守護", ["barbarian"], 7, 2, "先祖的幽魂纏住目標：命中後目標被嘲諷 1 回合，下一次攻擊劣勢。", attr="str", target="enemy", resolve="attack", damage=[W()], apply=[{"status": "taunted", "turns": 1}, {"status": "hindered", "turns": 2}]),
 sk("storm_aura", "風暴之怒", ["barbarian"], 9, 2, "身邊捲起雷暴：每回合開始對隨機一名敵人造成 2d6 閃電傷害，持續 3 回合。每場戰鬥一次。", target="self", resolve="auto", apply=[{"status": "storm_aura", "turns": 3, "to": "self"}], uses={"per_combat": 1}),
 sk("spirit_shield", "靈魂之盾", ["barbarian"], 10, 1, "召來先祖護住隊友：下一次物理傷害減去 2d6 + 等級。每回合一次。", target="ally", resolve="auto", apply=[{"status": "deflecting", "turns": 3, "value": {"dice": "2d6", "level": True}}], uses={"per_turn": 1}),
 sk("beast_claws", "獸爪", ["barbarian"], 12, 3, "雙手化為利爪：3 次攻擊，每次 1d8 + 力量調整值斬擊傷害。", attr="str", target="enemy", resolve="attack", hits=3, damage=[{"dice": "1d8", "type": "slashing", "mod": True}]),
 sk("zealous_presence", "狂熱臨場", ["barbarian"], 14, 2, "震天的戰吼：全隊攻擊與豁免優勢 1 回合。每場戰鬥一次。", target="all_allies", resolve="auto", apply=[{"status": "zealous", "turns": 1, "to": "allies"}], uses={"per_combat": 1}),
 sk("mindless_rage", "無心之怒", ["barbarian"], 15, 0, "怒到什麼都感覺不到：移除自身所有負面狀態，獲得 1 行動點。每場戰鬥一次。", target="self", resolve="auto", cleanse=True, ap_gain=1, uses={"per_combat": 1}),
 sk("vengeful_blow", "以牙還牙", ["barbarian"], 16, 3, "額外 2d10 傷害，命中時獲得 1 行動點。", attr="str", target="enemy", resolve="attack", damage=[W(), {"dice": "2d10"}], ap_gain_on_hit=1),
 sk("raging_storm", "狂暴風暴", ["barbarian"], 18, 4, "風暴撕裂戰場：所有敵人靈巧豁免，4d8 + 力量調整值閃電傷害（成功減半），失敗者被電擊（行動點回復 -1）。", attr="str", target="all_enemies", resolve="save", save="dex", on_save="half", damage=[{"dice": "4d8", "type": "lightning", "mod": True}], apply=[{"status": "shocked", "turns": 2}]),
 sk("rage_beyond_death", "超越死亡之怒", ["barbarian"], 19, 2, "瀕死時怒火更盛：回復 4d10 + 等級 HP 並進入狂暴 5 回合。每場戰鬥一次。", target="self", resolve="auto", heal={"dice": "4d10", "level": True}, apply=[{"status": "raging", "turns": 5, "to": "self"}], uses={"per_combat": 1}),
]
rogue = [
 sk("fancy_footwork", "花俏步法", ["rogue"], 1, 2, "一刺就退：武器攻擊，命中後目標下一次攻擊劣勢。", attr="dex", target="enemy", resolve="attack", damage=[W()], apply=[{"status": "hindered", "turns": 2}]),
 sk("master_of_tactics", "戰術指點", ["rogue"], 2, 1, "指出破綻給隊友：一名隊友下一次攻擊優勢。", target="ally", resolve="auto", apply=[{"status": "aided", "turns": 2}]),
 sk("insightful_fighting", "洞悉破綻", ["rogue"], 3, 1, "看穿對方的習慣：目標魅力豁免，失敗則露出破綻（迴避 -3）2 回合。", attr="dex", target="enemy", resolve="save", save="cha", apply=[{"status": "exposed", "turns": 2}]),
 sk("skirmisher", "遊擊", ["rogue"], 5, 2, "打了就跑：武器攻擊（傷害 ×0.8）後隱匿，迴避 +4 直到下回合。", attr="dex", target="enemy", resolve="attack", mult=0.8, threat=-10, damage=[W()], apply=[{"status": "hidden", "turns": 1, "to": "self", "on": "always"}]),
 sk("psychic_blades", "靈能刃", ["rogue"], 7, 2, "心念凝成兩把刃：2 次攻擊，每次 1d6 + 靈巧調整值心靈傷害，每 6 級再 +1d6。", attr="dex", target="enemy", resolve="attack", hits=2, damage=[{"dice": "1d6", "type": "psychic", "mod": True, "scale": {"dice": "1d6", "per": 6}}]),
 sk("wails_from_the_grave", "冥嚎", ["rogue"], 8, 2, "亡魂的哀嚎撕扯隨機 2 名敵人，各 2d6 暗影傷害（必中），每 4 級再 +1d6。每回合一次。", target="random_enemies", count=2, resolve="auto", damage=[{"dice": "2d6", "type": "necrotic", "scale": {"dice": "1d6", "per": 4}}], uses={"per_turn": 1}),
 sk("opportunist", "趁亂下手", ["rogue"], 10, 2, "抓住空檔：額外 1d6 傷害，命中時獲得 1 行動點。", attr="dex", target="enemy", resolve="attack", damage=[W(), {"dice": "1d6"}], ap_gain_on_hit=1),
 sk("panache", "挑釁風度", ["rogue"], 12, 2, "用話激怒對手：目標魅力豁免，失敗則被嘲諷 2 回合，攻擊劣勢。", attr="dex", target="enemy", resolve="save", save="cha", apply=[{"status": "taunted", "turns": 2}, {"status": "hindered", "turns": 2}]),
 sk("sudden_strike", "突擊", ["rogue"], 14, 3, "兩次又快又狠的突刺：2 次攻擊，額外 1d6 傷害。", attr="dex", target="enemy", resolve="attack", hits=2, damage=[W(), {"dice": "1d6"}]),
 sk("misdirection", "移花接木", ["rogue"], 15, 1, "讓敵人搞錯目標：攻擊你的人劣勢 2 回合，仇恨大減。每場戰鬥一次。", target="self", resolve="auto", threat=-20, apply=[{"status": "blur", "turns": 2, "to": "self"}], uses={"per_combat": 1}),
 sk("psychic_veil", "靈能帷幕", ["rogue"], 16, 2, "以念力隱去身形：隱形（攻擊與迴避優勢）2 回合。每場戰鬥一次。", target="self", resolve="auto", threat=-10, apply=[{"status": "invisible", "turns": 2, "to": "self"}], uses={"per_combat": 1}),
 sk("soul_harvest", "靈魂收割", ["rogue"], 18, 4, "刃上纏著亡魂：額外 3d6 暗影傷害，回復造成傷害的一半。", attr="dex", target="enemy", resolve="attack", lifesteal=0.5, damage=[W(), {"dice": "3d6", "type": "necrotic"}]),
 sk("master_duelist", "決鬥大師", ["rogue"], 19, 4, "決鬥者的必殺一擊：優勢攻擊，額外 4d6 傷害，幸運一擊閾值 -2。", attr="dex", target="enemy", resolve="attack", adv=True, crit=2, damage=[W(), {"dice": "4d6"}]),
]
monk = [
 sk("open_hand", "開掌技", ["monk"], 1, 2, "掌勁推倒對手：命中後目標靈巧豁免失敗則倒地 1 回合。", attr="dex", target="enemy", resolve="attack", damage=[W()], apply=[{"status": "prone", "turns": 1, "on": "hit", "save": "dex"}]),
 sk("drunken_technique", "醉拳", ["monk"], 2, 2, "醉步搖晃著出拳：2 次攻擊（每次傷害 ×0.6），之後迴避 +4 直到下回合。", attr="dex", target="enemy", resolve="attack", hits=2, mult=0.6, damage=[W()], apply=[{"status": "hidden", "turns": 1, "to": "self", "on": "always"}]),
 sk("sun_bolt", "日炎箭", ["monk"], 3, 2, "射出一道陽光：1d8 + 靈巧調整值神聖傷害，每 4 級再 +1d8。", attr="dex", target="enemy", resolve="attack", damage=[{"dice": "1d8", "type": "radiant", "mod": True, "scale": {"dice": "1d8", "per": 4}}]),
 sk("shadow_arts", "暗影之術", ["monk"], 5, 2, "融入陰影：攻擊你的人劣勢 2 回合，仇恨降低。", target="self", resolve="auto", threat=-10, apply=[{"status": "blur", "turns": 2, "to": "self"}]),
 sk("hand_of_harm", "傷害之手", ["monk"], 7, 3, "灌入病氣：額外 1d10 暗影傷害，命中後目標中毒 3 回合。", attr="dex", target="enemy", resolve="attack", damage=[W(), {"dice": "1d10", "type": "necrotic"}], apply=[{"status": "poisoned", "turns": 3}]),
 sk("hand_of_healing", "治癒之手", ["monk"], 8, 2, "以氣療傷：治療一名隊友 1d10 + 靈巧調整值 + 等級，可救起倒下的隊友。每場戰鬥兩次。", attr="dex", target="ally_or_downed", resolve="auto", heal={"dice": "1d10", "mod": True, "level": True}, uses={"per_combat": 2}),
 sk("kensei_strike", "劍聖一擊", ["monk"], 10, 3, "劍聖的精準一擊：優勢攻擊，額外 2d8 傷害。", attr="dex", target="enemy", resolve="attack", adv=True, damage=[W(), {"dice": "2d8"}]),
 sk("astral_arms", "星界臂", ["monk"], 12, 3, "星界的手臂橫掃四周：所有敵人靈巧豁免，2d10 + 靈巧調整值奧術傷害（成功減半）。", attr="dex", target="all_enemies", resolve="save", save="dex", on_save="half", damage=[{"dice": "2d10", "type": "force", "mod": True}]),
 sk("four_thunders", "四雷拳", ["monk"], 14, 4, "拳風化為雷鳴：所有敵人力量豁免，3d8 雷鳴傷害（成功減半），失敗者倒地 1 回合。", attr="dex", target="all_enemies", resolve="save", save="str", on_save="half", damage=[{"dice": "3d8", "type": "thunder", "mod": True}], apply=[{"status": "prone", "turns": 1}]),
 sk("tipsy_sway", "醉仙步", ["monk"], 15, 0, "東倒西歪地閃開：迴避優勢 2 回合，獲得 1 行動點。每場戰鬥一次。", target="self", resolve="auto", ap_gain=1, apply=[{"status": "danger_sense", "turns": 2, "to": "self"}], uses={"per_combat": 1}),
 sk("awakened_astral", "覺醒星界", ["monk"], 16, 2, "星界之身完全顯現：命中 +2、武器傷害 +2、減傷 +2，持續 3 回合。每場戰鬥一次。", target="self", resolve="auto", apply=[{"status": "astral_self", "turns": 3, "to": "self"}], uses={"per_combat": 1}),
 sk("flurry_of_mercy", "慈悲百手", ["monk"], 18, 4, "治癒與傷害交錯的連擊：3 次攻擊（每次傷害 ×0.8），回復造成傷害的一半。", attr="dex", target="enemy", resolve="attack", hits=3, mult=0.8, lifesteal=0.5, damage=[W()]),
 sk("sun_shield", "日盾", ["monk"], 19, 2, "身披烈日：每回合開始對隨機一名敵人造成 3d6 神聖傷害，神聖傷害 ×0.5，持續 3 回合。每場戰鬥一次。", target="self", resolve="auto", apply=[{"status": "sun_shield", "turns": 3, "to": "self"}], uses={"per_combat": 1}),
]
ranger = [
 sk("hunters_prey", "獵手獵物", ["ranger"], 4, 2, "瞄準要害：額外 1d8 傷害，命中後目標流血 3 回合。", attr="dex", target="enemy", resolve="attack", damage=[W(), {"dice": "1d8"}], apply=[{"status": "bleeding", "turns": 3}]),
 sk("dread_ambusher", "恐懼伏擊", ["ranger"], 5, 1, "從暗處搶先出手：優勢攻擊，額外 1d8 傷害。每場戰鬥一次。", attr="dex", target="enemy", resolve="attack", adv=True, damage=[W(), {"dice": "1d8"}], uses={"per_combat": 1}),
 sk("planar_warrior", "界域戰士", ["ranger"], 7, 2, "以異界之力出手：額外 1d8 奧術傷害，每 8 級再 +1d8。", attr="dex", target="enemy", resolve="attack", damage=[W(), {"dice": "1d8", "type": "force", "scale": {"dice": "1d8", "per": 8}}]),
 sk("slayers_prey", "屠魔者之眼", ["ranger"], 10, 1, "看穿怪物的弱點：目標被攻擊時對方優勢，持續 2 回合。", target="enemy", resolve="auto", apply=[{"status": "outlined", "turns": 2}]),
 sk("swarm_cloud", "蟲群", ["ranger"], 14, 3, "放出蟲群撲向敵陣：所有敵人靈巧豁免，3d6 + 靈巧調整值穿刺傷害（成功減半），失敗者被束縛 1 回合。", attr="dex", target="all_enemies", resolve="save", save="dex", on_save="half", damage=[{"dice": "3d6", "type": "piercing", "mod": True}], apply=[{"status": "restrained", "turns": 1}]),
 sk("stalkers_flurry", "潛行者連擊", ["ranger"], 18, 4, "從陰影接連出手：3 次攻擊，每次傷害 ×0.8。", attr="dex", target="enemy", resolve="attack", hits=3, mult=0.8, damage=[W()]),
]
paladin = [
 sk("conquering_presence", "征服威壓", ["paladin"], 5, 2, "以威勢壓制敵人：所有敵人魅力豁免，失敗則恐懼（攻擊劣勢）2 回合。每場戰鬥一次。", attr="fai", target="all_enemies", resolve="save", save="cha", apply=[{"status": "frightened", "turns": 2}], uses={"per_combat": 1}),
 sk("sacred_weapon", "神聖武器", ["paladin"], 7, 1, "武器灌注聖光：命中 +2，武器命中附加 1d6 神聖傷害，持續 3 回合。每場戰鬥一次。", target="self", resolve="auto", apply=[{"status": "sacred_weapon", "turns": 3, "to": "self"}], uses={"per_combat": 1}),
 sk("rebuke_violent", "斥責暴行", ["paladin"], 8, 2, "以神威斥責施暴者：目標信仰豁免，3d8 + 信仰調整值神聖傷害（成功減半）。", attr="fai", target="enemy", resolve="save", save="fai", on_save="half", damage=[{"dice": "3d8", "type": "radiant", "mod": True}]),
 sk("glorious_inspiration", "榮光鼓舞", ["paladin"], 11, 2, "以榮光鼓舞同伴：全隊獲得 5 + 等級臨時生命值。每場戰鬥一次。", target="all_allies", resolve="auto", shield={"flat": 5, "level": 1}, uses={"per_combat": 1}),
 sk("watchers_will", "守望意志", ["paladin"], 15, 2, "守望者的意志護住全隊：迴避與豁免優勢 2 回合。每場戰鬥一次。", target="all_allies", resolve="auto", apply=[{"status": "holy_aura", "turns": 2, "to": "allies"}], uses={"per_combat": 1}),
 sk("avenging_angel", "復仇天使", ["paladin"], 18, 4, "化身復仇天使降下審判：所有敵人魅力豁免，4d8 + 信仰調整值神聖傷害（成功減半），失敗者恐懼 2 回合。每場戰鬥一次。", attr="fai", target="all_enemies", resolve="save", save="cha", on_save="half", damage=[{"dice": "4d8", "type": "radiant", "mod": True}], apply=[{"status": "frightened", "turns": 2}], uses={"per_combat": 1}),
]
new_status = {
 "prone": {"name": "倒地", "kind": "debuff", "disadvantage": ["attack"], "attacked_advantage": True},
 "disarmed": {"name": "繳械", "kind": "debuff", "mods": {"hit": -2, "damage": -3}},
 "fighting_spirit": {"name": "戰魂", "kind": "buff", "advantage": ["attack"]},
 "giant_might": {"name": "巨人之力", "kind": "buff", "mods": {"damage": 3, "dr": 1, "threat": 0.3}},
 "bear_spirit": {"name": "熊之魂", "kind": "buff", "resist": {"physical": -0.25}, "mods": {"threat": 0.3}},
 "storm_aura": {"name": "風暴之怒", "kind": "buff", "pulse": {"dice": "2d6", "type": "lightning"}},
 "zealous": {"name": "狂熱", "kind": "buff", "advantage": ["attack", "save"]},
 "aided": {"name": "援助", "kind": "buff", "advantage": ["attack"], "charges": 1},
 "astral_self": {"name": "星界之身", "kind": "buff", "mods": {"hit": 2, "damage": 2, "dr": 2}},
 "sun_shield": {"name": "日盾", "kind": "buff", "pulse": {"dice": "3d6", "type": "radiant"}, "resist": {"radiant": -0.5}},
 "sacred_weapon": {"name": "神聖武器", "kind": "buff", "mods": {"hit": 2}, "on_hit": {"dice": "1d6", "type": "radiant"}},
}
after = {"final_strike": fighter, "titan_strike": barbarian, "death_mark": rogue, "quivering_palm": monk, "skyfall_arrow": ranger, "avatar_of_light": paladin}

p = f"{ROOT}/data/rules/abilities.json"
lines = open(p, encoding="utf-8").read().split("\n")
out = []
existing = set(re.findall(r'"id": "([^"]+)"', "\n".join(lines)))
for l in lines:
    out.append(l)
    m = re.match(r'\s*\{ "id": "([^"]+)"', l)
    if m and m.group(1) in after:
        if not l.rstrip().endswith(","):
            raise SystemExit("unexpected last line " + m.group(1))
        for d in after[m.group(1)]:
            assert d["id"] not in existing, d["id"]
            out.append("    " + fmt(d) + ",")
open(p, "w", encoding="utf-8").write("\n".join(out))
json.load(open(p, encoding="utf-8"))

p = f"{ROOT}/data/rules/statuses.json"
s = open(p, encoding="utf-8").read()
anchor = '    "bane":'
assert anchor in s
buffs = "".join(f'    "{k}": {fmt(v)},\n' for k, v in new_status.items() if v["kind"] == "buff")
s = s.replace(anchor, buffs + anchor, 1)
anchor = '    "poisoned":'
debuffs = "".join(f'    "{k}": {fmt(v)},\n' for k, v in new_status.items() if v["kind"] == "debuff")
s = s.replace(anchor, debuffs + anchor, 1)
open(p, "w", encoding="utf-8").write(s)
json.load(open(p, encoding="utf-8"))
print("ok", sum(map(len, after.values())))
