# 詛咒具（docs/LEWD_STATS.md 第 7.2 節）：一戴上就被詛咒鎖住，掙不開、鑰匙打不開、鐵匠剪不斷，只能到神殿解咒（詛咒具會碎掉）。
#   1. gear.json   13 種詛咒具的底材（拘束具，成人向）
#   2. items.json  13 件詛咒具（gear.curse、自帶符文鎖；屬性、慾望指標或檢定的減值）。不在商店賣（trade.ts 的 notForSale）
#   3. gear.json   地下城寶箱（中層、深層、深淵）偶爾有一件：一碰就自己扣上來（grid.ts 的 openChest）
#   4. lewd.json   神殿解咒（unbind.uncurse）
#   5. travel_events.json  4 件地下城的陷阱事件、2 件城鎮事件（effects 的 restrain）
# 觸手乳膠衣和寄生裝備「渴求的魔導衣」重疊，沒有做。
# 可以重跑：先拿掉上一次寫進去的再寫。要排在 bondage44.py 之後（底材接在它的尿道鎖後面）。
import json
import re


def base(slot, name, kind, price, desc, bind, bind_kind, **extra):
    return {"slot": slot, "name": name, "kind": kind, "price": price, "restraint": True, "bind": bind, "bind_kind": bind_kind, **extra, "adult": True, "desc": desc}


BASES = {
    "suppress_collar": base("accessory", "壓制項圈", "metal", 300, "刻滿壓制咒文的鐵項圈，戴上之後渾身的力氣、心思都被壓住了一截。", 1, "body"),
    "rule_collar": base("accessory", "規矩項圈", "metal", 300, "內側刻著一條條規矩的項圈；違背主人的意思時，它會先一步收緊。", 1, "body"),
    "truth_collar": base("accessory", "吐真項圈", "metal", 300, "貼著喉嚨的細環，說謊的瞬間就像被掐住，只說得出真話。", 1, "body"),
    "servile_gag": base("head", "奴言口環", "metal", 260, "撐著嘴的口環，從裡面說出來的話全都變成討好與求饒。", 1, "mouth"),
    "cupping_mitts": base("wrists", "捧乳手套", "leather", 260, "手掌被縫成碗狀的手套，雙手只能一直托著自己的胸部。", 2, "hands", exposure=1),
    "magnet_cuffs": base("wrists", "磁吸手環", "metal", 260, "一對刻著吸附咒的手環，兩隻手一靠近就「喀」地吸在一起。", 2, "hands"),
    "magnet_anklets": base("leg_accessory", "磁吸腳環", "metal", 260, "一對刻著吸附咒的腳環，步子一大，兩隻腳踝就吸在一起。", 2, "legs"),
    "shifting_rope": base("underwear_top", "淫變繩縛", "cloth", 300, "會自己蠕動、每天換一種綁法的繩子，總是勒在最敏感的地方。", 2, "body"),
    "tiptoe_anklets": base("leg_accessory", "踮腳腳環", "metal", 220, "腳跟一落地就傳來刺痛的腳環，只能一直踮著腳走路。", 1, "legs"),
    "posture_corset": base("belt", "姿勢束腰", "leather", 260, "把腰勒成固定姿勢的束腰，坐不下、躺不平，連睡覺都只能挺著。", 2, "body"),
    "herald_corset": base("belt", "播報束腰", "metal", 260, "會在人多的地方自己響起鈴聲、亮起淫紋的束腰，好像在對全世界宣告你戴著什麼。", 1, "body", exposure=3),
    "random_plug": base("piercing", "隨機尿道塞", "metal", 260, "塞進去就拿不出來的細塞，不定時地震動、收縮。", 2, "stim"),
    "egg_plug": base("underwear_bottom", "產卵肛塞", "metal", 320, "會在體內慢慢生出軟卵的詛咒肛塞，脹滿了才肯讓你排出來。", 3, "stim"),
}
ANCHOR_BASE = r'\n    "urethral_lock": \{.*'


def item(name, b, desc, price, **gear):
    mat = {"metal": "iron", "leather": "leather", "cloth": "linen"}[BASES[b]["kind"]]
    return {"name": name, "category": "equipment", "price_cc": price, "tags": [], "adult": True, "desc": desc,
            "gear": {"base": b, "material": mat, "lock": "rune", "curse": True, **gear}}


ITEMS = [
    item("壓制項圈", "suppress_collar", "詛咒具：五項屬性 -1。", 400, attrs={"str": -1, "dex": -1, "int": -1, "fai": -1, "cha": -1}),
    item("規矩項圈", "rule_collar", "詛咒具：順從 +10；回應主人的檢定 -2。", 400, lewd={"submission": 10}, unique={"check": {"contexts": ["master_event"]}, "bonus": -2}),
    item("吐真項圈", "truth_collar", "詛咒具：欺瞞 -3。", 400, unique={"check": {"skills": ["deceive"]}, "bonus": -3}),
    item("奴言口環", "servile_gag", "詛咒具：順從 +5；威嚇 -3。", 360, lewd={"submission": 5}, unique={"check": {"skills": ["intimidate"]}, "bonus": -3}),
    item("捧乳手套", "cupping_mitts", "詛咒具：敏感 +5；靈巧 -1。", 360, lewd={"sensitivity": 5}, attrs={"dex": -1}),
    item("磁吸手環", "magnet_cuffs", "詛咒具：巧手 -3。", 360, unique={"check": {"skills": ["sleight"]}, "bonus": -3}),
    item("磁吸腳環", "magnet_anklets", "詛咒具：撤退 -3。", 360, unique={"check": {"contexts": ["retreat"]}, "bonus": -3}),
    item("淫變繩縛", "shifting_rope", "詛咒具：淫亂 +5、敏感 +5。", 400, lewd={"lewdness": 5, "sensitivity": 5}),
    item("踮腳腳環", "tiptoe_anklets", "詛咒具：靈巧 -1；先攻 -2。", 300, attrs={"dex": -1}, unique={"check": {"contexts": ["initiative"]}, "bonus": -2}),
    item("姿勢束腰", "posture_corset", "詛咒具：力量 -1；忍耐 -5。", 360, attrs={"str": -1}, lewd={"endurance": -5}),
    item("播報束腰", "herald_corset", "詛咒具：曝露度 3；潛行 -3。", 360, unique={"check": {"skills": ["stealth"]}, "bonus": -3}),
    item("隨機尿道塞", "random_plug", "詛咒具：敏感 +5、忍耐 -5。", 360, lewd={"sensitivity": 5, "endurance": -5}),
    item("產卵肛塞", "egg_plug", "詛咒具：淫亂 +5、順從 +5。", 440, lewd={"lewdness": 5, "submission": 5}),
]
ANCHOR_ITEM = r'\n    \{ ?"name": "尿道鎖".*'

# 寶箱：[物品, 機率]
CHESTS = {
    "middle": [["規矩項圈", 0.005], ["踮腳腳環", 0.005], ["磁吸手環", 0.005], ["捧乳手套", 0.005]],
    "deep": [["壓制項圈", 0.006], ["吐真項圈", 0.006], ["奴言口環", 0.006], ["淫變繩縛", 0.006], ["播報束腰", 0.006], ["磁吸腳環", 0.006]],
    "abyss": [["壓制項圈", 0.008], ["姿勢束腰", 0.008], ["隨機尿道塞", 0.008], ["產卵肛塞", 0.008], ["淫變繩縛", 0.008]],
}
CURSED_NAMES = {i["name"] for i in ITEMS}


def dg(id_, layers, title, text, scene, item_, escape_attr, dc, escape_text, give_text):
    return {
        "id": id_, "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": ["trap"], "layers": layers,
        "tags": ["adult", "pc_unwilling"], "pc_body": ["fem", "andro"], "title": title, "text": text, "scene": scene,
        "options": [
            {"label": "趁咒文還沒亮起來躲開", "check": {"attr": escape_attr, "dc": dc},
             "success": {"text": escape_text},
             "fail": {"text": f"慢了一步。{give_text}", "effects": [{"type": "restrain", "item": item_}]}, "adult_scene": "fail"},
            {"label": "用信仰壓住咒文", "check": {"attr": "fai", "dc": dc + 1},
             "success": {"text": "你唸出一段禱詞，咒文暗了下去，那東西掉在地上碎成了碎屑。", "effects": [{"type": "xp", "amount": 30}]},
             "fail": {"text": f"禱詞只讓咒文閃了一下。{give_text}", "effects": [{"type": "restrain", "item": item_}, {"type": "lewd", "stat": "submission", "delta": 1}]}},
            {"label": "不掙扎，任它扣上",
             "success": {"text": f"你沒有躲。{give_text}心裡居然有一點點期待。", "effects": [{"type": "restrain", "item": item_}, {"type": "lewd", "stat": "submission", "delta": 2}]}},
        ],
    }


DUNGEON = [
    dg("dg_curse_collar", [2, 3, 4], "石台上的項圈", "石台上放著一個刻滿咒文的項圈，你還沒伸手，它就自己飛了起來，朝你的脖子扣過來。",
       "被壓制項圈扣住的主角渾身脫力跪倒，附近的魔物聞到動靜圍了上來",
       "壓制項圈", "dex", 15, "你一側身，項圈撞在牆上，咒文熄滅了。", "項圈「喀」地扣上你的脖子，咒文一亮，渾身的力氣被抽走了一截。"),
    dg("dg_curse_rope", [2, 3, 4], "會動的繩子", "地上盤著一團紅繩，你一踩上去，它就像蛇一樣順著腿往上爬。",
       "淫變繩縛自己在主角身上打好結，勒住敏感的地方，主角走一步就喘一下",
       "淫變繩縛", "dex", 15, "你一腳把繩子踢開，它扭了兩下就不動了。", "繩子一路爬上來，在你身上自己打好了結——每動一下都勒在最要命的地方。"),
    dg("dg_curse_anklets", [2, 3], "腳下的鈴聲", "石縫裡滾出一對叮噹作響的腳環，貼著地面朝你的腳踝溜過來。",
       "被踮腳腳環扣住的主角只能踮著腳尖，搖搖晃晃地往前走",
       "踮腳腳環", "dex", 14, "你跳了起來，腳環撞在一起，掉進石縫裡不見了。", "腳環扣上你的腳踝，腳跟一落地就一陣刺痛，你只能踮著腳站著。"),
    dg("dg_curse_egg", [3, 4], "黏滑的祭壇", "祭壇上的黑色石卵在你靠近時裂開，一個濕滑的東西竄了出來，鑽進你的衣服裡。",
       "產卵肛塞在主角體內慢慢脹大，主角扶著牆壁，夾著腿喘息",
       "產卵肛塞", "str", 16, "你一把抓住那東西，用力甩在祭壇上，它不動了。", "那東西一路往下鑽，塞住了你的後面，然後在裡面慢慢脹了起來。"),
]

TOWN = [
    {"id": "tn_curse_gift", "scope": "town", "tier": "normal", "kind": "choice", "cells": ["tavern", "inn"], "category": "trouble",
     "tags": ["adult", "pc_unwilling"], "pc_body": ["fem", "andro"], "cooldown_days": 20, "title": "陌生人的禮物",
     "text": "一個面帶微笑的貴婦人在你身邊坐下，拿出一個精緻的頸環：「這和你很配，送你。」她不等你回答，就伸手要替你戴上。",
     "scene": "吐真項圈扣上後，主角被貴婦人問了一連串羞恥的問題，每一句都只能照實回答",
     "options": [
         {"label": "擋開她的手", "check": {"attr": "dex", "dc": 14},
          "success": {"text": "你擋開她的手，頸環掉在桌上，咒文閃了一下。貴婦人笑了笑，收起頸環走了。"},
          "fail": {"text": "頸環已經扣上了。貴婦人湊近你耳邊：「好了，現在告訴我，你最想被怎麼對待？」你張開嘴，說出來的全是真話。",
                   "effects": [{"type": "restrain", "item": "吐真項圈"}]}, "adult_scene": "fail"},
         {"label": "看穿她的來意", "check": {"attr": "int", "dc": 15},
          "success": {"text": "你認出頸環上的咒文，把它推了回去。貴婦人的笑容僵了一下，起身離開。", "effects": [{"type": "xp", "amount": 20}]},
          "fail": {"text": "你沒看出什麼不對，任她替你戴上——咒文亮起時已經太遲了。", "effects": [{"type": "restrain", "item": "吐真項圈"}]}},
     ]},
    {"id": "tn_curse_corset", "scope": "town", "tier": "normal", "kind": "choice", "cells": ["tailor", "shop"], "category": "trouble",
     "tags": ["adult", "pc_unwilling"], "pc_body": ["fem", "andro"], "cooldown_days": 20, "title": "試穿的束腰",
     "text": "店員熱心地拿來一件束腰要你試穿，說是新到的款式。你剛扣上最後一個扣子，束腰上就亮起了一圈淫紋，還叮叮噹噹地響了起來。",
     "scene": "戴著播報束腰的主角走在街上，束腰一路響著鈴、亮著淫紋，路人紛紛回頭",
     "options": [
         {"label": "趁咒文還沒成形扯開", "check": {"attr": "str", "dc": 15},
          "success": {"text": "你用力一扯，扣子崩開，束腰掉在地上不響了。店員尷尬地把它收走。"},
          "fail": {"text": "扣子紋風不動。店員攤攤手：「啊，那批貨好像被下了咒……要不要去神殿問問？」",
                   "effects": [{"type": "restrain", "item": "播報束腰"}]}, "adult_scene": "fail"},
         {"label": "認了，穿著走", "success": {"text": "你乾脆不掙扎了。束腰一路響著鈴走出店門，街上的人都轉過頭來。",
                                         "effects": [{"type": "restrain", "item": "播報束腰"}, {"type": "lewd", "stat": "lewdness", "delta": 1}]}},
     ]},
]


def drop_lines(text, pattern):
    return re.sub(pattern, '', text)


def insert_after(text, anchor, lines):
    m = re.search(anchor, text)
    assert m and m.group(0).endswith(','), anchor
    return text[:m.end()] + ''.join('\n' + ln + ',' for ln in lines) + text[m.end():]


def write_gear():
    p = 'data/rules/gear.json'
    t = open(p).read()
    for k in BASES:
        t = drop_lines(t, r'\n    "' + k + r'": \{.*')
    t = insert_after(t, ANCHOR_BASE, [f'    "{k}": ' + json.dumps(v, ensure_ascii=False) for k, v in BASES.items()])
    # 寶箱：拿掉上一次的詛咒具，再接在那一層的 items 最後
    for layer, adds in CHESTS.items():
        m = re.search(r'("' + layer + r'": \{[^\n]*?"items": \[)(.*?)(\]\s*,\s*"forge")', t, re.S)
        assert m, layer
        cur = json.loads('[' + m.group(2) + ']')
        cur = [x for x in cur if x[0] not in CURSED_NAMES] + adds
        body = ', '.join(json.dumps(x, ensure_ascii=False) for x in cur)
        t = t[:m.start(2)] + body + t[m.end(2):]
    d = json.loads(t)
    for layer, adds in CHESTS.items():
        assert all(a in d['chests'][layer]['items'] for a in adds), layer
    open(p, 'w').write(t)


def write_items():
    p = 'data/rules/items.json'
    t = open(p).read()
    for i in ITEMS:
        t = drop_lines(t, r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*')
    t = insert_after(t, ANCHOR_ITEM, ['    ' + json.dumps(i, ensure_ascii=False) for i in ITEMS])
    d = json.loads(t)
    names = [i['name'] for i in d['items']]
    for i in ITEMS:
        assert names.count(i['name']) == 1, i['name']
    open(p, 'w').write(t)


def write_events():
    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in DUNGEON + TOWN:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "dg_trap_hood".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in DUNGEON + TOWN])
    d = json.loads(t)
    ids = [e['id'] for e in d['templates']]
    for e in DUNGEON + TOWN:
        assert ids.count(e['id']) == 1
    open(p, 'w').write(t)


UNCURSE = {"$comment": "神殿解咒（第 7.2 節）：詛咒具只能這樣拿下來，拿下來就碎了；價錢依詛咒具的鎖", "shops": ["temple"], "fee_cc": {"white": 300, "blue": 800, "rune": 2000, "gold": 5000}}


def write_lewd():
    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = re.sub(r', "uncurse": \{"\$comment": "[^"]*", "shops": \[[^\]]*\], "fee_cc": \{[^}]*\}\}', '', t)
    m = re.search(r'"cut": \{"shops": \[[^\]]*\], "fee_cc": \{[^}]*\}\}', t)
    assert m
    t = t[:m.end()] + ', "uncurse": ' + json.dumps(UNCURSE, ensure_ascii=False) + t[m.end():]
    assert json.loads(t)['unbind']['uncurse'] == UNCURSE
    open(p, 'w').write(t)


if __name__ == '__main__':
    write_gear()
    write_items()
    write_events()
    write_lewd()
    print('bases', len(BASES), 'items', len(ITEMS), 'events', len(DUNGEON) + len(TOWN))
