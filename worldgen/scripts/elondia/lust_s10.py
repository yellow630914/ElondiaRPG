# 慾望戰鬥 S10 的資料（docs/plan/LUST_COMBAT_PLAN.md 第 20 節；規則寫在 docs/LEWD_STATS.md）：
#   S10-1 流派的老師：8 位固定 NPC（npcs.json，mentor 欄位、待在各自的地標），perks.json 的 mentor 預設；
#         秘法書：8 本特質書（items.json，每本是一個流派的入門與進階），商店（tags、charm_min）、拍賣會、園區寶箱
#   S10-2 寄生類的雙面效應（lewd.json 的 parasite_two_face）
#   S10-3 慾望稱號（lewd.json 的 titles，只顯示、沒有效果）
# 可以重跑：先拿掉上一次寫進去的再寫。要排在 lust_s9.py 之後。
import json
import re


def drop_lines(text, pattern):
    """拿掉符合 pattern 的整行（一行一筆），再補掉因此留在陣列或物件結尾的逗號"""
    text = re.sub(pattern, '', text)
    return re.sub(r',(\s*\n\s*[\]}])', r'\1', text)


def set_key(text, key, value):
    """lewd.json、perks.json 第一層的一行 `"key": {...}`：有就換掉，沒有就加在 "version" 那一行後面"""
    line = f'  "{key}": ' + json.dumps(value, ensure_ascii=False)
    if re.search(rf'^  "{key}": ', text, re.M):
        return re.sub(rf'^  "{key}": .*?(,?)$', lambda m: line + m.group(1), text, count=1, flags=re.M)
    return re.sub(r'^(  "version": \d+,)$', lambda m: m.group(1) + '\n' + line + ',', text, count=1, flags=re.M)


def edit_line(text, anchor, fn):
    m = re.search(anchor + r'(.*?)(,?)$', text, re.M)
    value = json.loads(m.group(1))
    fn(value)
    return text[:m.start(1)] + json.dumps(value, ensure_ascii=False) + text[m.end(1):]


# ---------------- S10-1 老師 ----------------
MENTOR_RULES = {
    "$comment": "老師（固定 NPC 的 mentor，docs/LEWD_STATS.md 第 6.1 節）：老師在身邊時（隊友，或同一格、相鄰）可以向他受訓他會教的特質。好感至少 affinity；學費是特質的 train.price_cc × price_mult、難度 + dc_delta（至少 5）、時數與屬性照特質的 train；特質沒有 train 時用 default_train。老師自己可以另外寫 affinity、price_mult。",
    "affinity": 10, "price_mult": 0.8, "dc_delta": -2,
    "default_train": {"price_cc": 500, "hours": 8, "attr": "cha", "dc": 12},
}

SCHOOL_PERKS = {
    'servitude': ['school_servitude', 'servitude_vow'],
    'punishment': ['school_punishment', 'trained_body'],
    'bondage': ['school_bondage', 'rope_strength'],
    'indulgence': ['school_indulgence', 'wanton_blaze'],
    'flesh': ['school_flesh', 'afterglow_memory'],
    'beast': ['school_beast', 'hive_bond'],
    'abstinence': ['school_abstinence', 'pure_heart'],
    'exhibition': ['school_exhibition', 'center_stage'],
}


def mentor(school, **npc):
    perks = SCHOOL_PERKS[school]
    base = {"id": f"npc_mentor_{school}", "hire_cc": 0, "unhireable": True, "no_attack": True, "adult": True, "kind": "commoner"}
    npc = {k: v for k, v in npc.items() if v != '' or k == 'class'}
    # 有職業的是冒險者（不受雇用），沒有的是普通人
    base['kind'] = 'adventurer' if npc.get('class') else 'commoner'
    return {**base, **npc, "perks": perks, "mentor": {"perks": perks}}


MENTORS = [
    mentor('servitude', name="薇拉嬤嬤", gender="female", race="demon", **{"class": ""}, level=9, location="bloodplume",
           tags=["commoner"], occupation="侍寢見習館的教習嬤嬤", landmark="lm_bed_school",
           lewd={"lewdness": 55, "sensitivity": 45, "endurance": 80, "submission": 85},
           personality="說話輕聲細語，每一個字都像在哄人，罰起人來卻一點也不手軟；最看不起「只會跪、不會想」的奴隸。",
           appearance="四十出頭的魔族女性，身材豐腴，深紫色的頭髮盤成一絲不苟的髻，額頭兩側一對磨圓的小角；總是穿一件高領的黑色長裙，腰間掛著一串鑰匙。",
           adult_appearance="長裙底下的頸子上留著一圈淡淡的舊項圈痕，她說那是「畢業的證明」。",
           background="年輕時是血羽城堡一位大貴族的寵奴，主人過世前親手解開了她的項圈。她留在侍寢見習館教新人怎麼侍奉、怎麼在侍奉裡保住自己：「把自己交出去，和把自己丟掉，是兩回事。」"),
    mentor('punishment', name="茱迪絲", gender="female", race="human", **{"class": "fighter"}, level=8, location="rhineburg",
           tags=["commoner"], occupation="按摩店後間的鞭手", landmark="lm_lower_massage",
           lewd={"lewdness": 60, "sensitivity": 35, "endurance": 85, "submission": 30},
           personality="寡言，眼神像在估量一塊肉；只對兩種人有耐心：真的怕痛的，和真的不怕痛的。",
           appearance="三十來歲的高個子女人，肩膀寬、手臂結實，紅褐色短髮剪得像男孩子；穿著皮背心和捲到手肘的白襯衫，右手總是戴著一隻黑皮手套。",
           adult_appearance="背上縱橫交錯的舊鞭痕排得很整齊，她說每一道都是自己挑的。",
           background="以前是帝國軍的刑訊官，退伍後在下城區的按摩店後間開了一門「生意」：教客人怎麼挨打、怎麼把痛變成別的東西。她說刑罰派的第一課永遠一樣：痛是真的，但你不必被它決定。"),
    mentor('bondage', name="奧斯卡", gender="male", race="human", **{"class": "rogue"}, level=7, location="albena",
           tags=["merchant"], occupation="月下拍賣會的綁縛師", landmark="lm_auction_house",
           lewd={"lewdness": 50, "sensitivity": 30, "endurance": 70, "submission": 25},
           personality="慢條斯理、講究到近乎囉嗦，每一個結都要打三遍才滿意；對繩子比對人溫柔。",
           appearance="五十歲上下的瘦高男人，灰白的頭髮往後梳得一絲不亂，戴著一副細框眼鏡；袖口永遠捲到一樣的高度，腰間掛著幾束染成不同顏色的麻繩。",
           adult_appearance="",
           background="月下拍賣會上，「活拍品」上台前都要經過他的手：綁得好看、綁得安全、綁得讓買家捨不得鬆開。他也收學生，教人怎麼讓繩子成為自己的一部分，而不只是困住自己的東西。"),
    mentor('indulgence', name="蜜絲緹", gender="female", race="demon", **{"class": "bard"}, level=10, location="tidehaven",
           tags=["traveler"], occupation="流浪的魅魔", lineage="魅魔（赤翼宮廷）", landmark="lm_pearl_bath",
           lewd={"lewdness": 95, "sensitivity": 80, "endurance": 60, "submission": 20},
           personality="懶洋洋、愛撒嬌，什麼都想嚐一口；說起「快樂」兩個字的時候，眼睛會發亮。",
           appearance="看起來二十七八歲的魅魔，身材豐滿，粉金色的捲髮披到腰間，背後收著一對小小的蝙蝠翼，尾巴尖是一顆心的形狀；只披著一件薄得透光的浴衣。",
           adult_appearance="小腹上一個淡粉色的紋樣，興致一來就會微微發亮。",
           background="赤翼宮廷出身，嫌宮廷的規矩太多，一路玩到潮汐港，在珍珠澡堂泡了三年還不想走。她說縱欲派沒什麼好教的——「想要就說、喜歡就拿，剩下的交給身體。」不過她還是會收學費。"),
    mentor('flesh', name="布倫希爾德", gender="female", race="dwarf", **{"class": "barbarian"}, level=8, location="ironforge",
           tags=["commoner"], occupation="熔岩溫泉旅館的搓澡師傅", landmark="lm_ironforge_onsen",
           lewd={"lewdness": 65, "sensitivity": 55, "endurance": 90, "submission": 35},
           personality="嗓門大、笑聲更大，手勁大得能把人搓掉一層皮；最愛說「身體會記得的，比腦子多」。",
           appearance="四十多歲的矮人女性，又矮又壯，手臂比一般男人的腿還粗；火紅的頭髮編成兩條粗辮子，汗水把她的麻布短衫貼在身上。",
           adult_appearance="身上滿是溫泉蒸出來的紅暈，肚子上一道舊疤，說是年輕時在礦坑被落石劃的。",
           background="做了二十年的搓澡師傅，摸過的身體比鐵匠打過的鐵還多。她教的肉體派很簡單：把身體練得耐得住、受得了、記得住，「高潮之後還站得起來的，才叫本事」。"),
    mentor('beast', name="茉格菈", gender="female", race="human", **{"class": "druid"}, level=8, location="rotmarsh",
           tags=["traveler"], occupation="研究寄生物的沼地女巫", landmark="lm_mire_herb_beds",
           lewd={"lewdness": 60, "sensitivity": 70, "endurance": 75, "submission": 40},
           personality="對蟲子、藤蔓和寄生物的熱情遠遠超過對人；說起「共生」這兩個字會停不下來，而且常常忘了對方在發抖。",
           appearance="三十五歲左右的女人，皮膚曬成深褐色，黑髮亂糟糟地紮在腦後，插著幾根羽毛和乾枯的藤；脖子上掛著一排裝著蟲卵的小玻璃瓶。",
           adult_appearance="手臂內側有幾道細細的、像葉脈一樣的淡綠色紋路，她說那是「老朋友」留下的。",
           background="在變異藥沼住了十幾年，研究那些會鑽進人身體裡的東西。她不認為寄生物是詛咒：「它們只是想活下去，跟你一樣。」獸蟲派的人來找她，她教怎麼和身上的東西談條件——談成了，它就是你的。"),
    mentor('abstinence', name="伯納德修士", gender="male", race="human", **{"class": "cleric"}, level=9, location="dawnlight",
           tags=["priest"], occupation="晨曦聖殿的苦修士", landmark="lm_dawn_sanctum",
           lewd={"lewdness": 5, "sensitivity": 40, "endurance": 95, "submission": 50},
           personality="溫和、不愛說教，卻一眼看得穿人心裡在燒什麼；從不責備誰有慾望，只問「你想讓它帶你去哪裡」。",
           appearance="六十歲上下的老修士，頭髮剃得很短，臉上的皺紋很深，眼神卻清亮；穿著洗得發白的粗麻修士袍，赤腳。",
           adult_appearance="",
           background="年輕時是個放蕩的貴族次子，在一場荒唐的宴會之後走進了晨曦聖殿，從此再沒有離開。他教的禁慾派不是壓抑，而是看清：「慾望是一匹馬。你可以騎牠，也可以被牠拖著走。」"),
    mentor('exhibition', name="塞拉菲娜", gender="female", race="catfolk", **{"class": "bard"}, level=6, location="albena",
           tags=["commoner"], occupation="河畔畫室的模特兒", landmark="lm_nude_atelier",
           lewd={"lewdness": 70, "sensitivity": 60, "endurance": 55, "submission": 30},
           personality="自信得近乎傲慢，被看的時候最自在；最受不了的是有人看著她卻假裝沒在看。",
           appearance="二十五六歲的貓族女性，身材修長，銀灰色的短髮下一對豎起的貓耳，尾巴總是懶洋洋地晃；平常只裹著一條畫室的布巾，走到哪裡都不太在意它會不會滑下來。",
           adult_appearance="左邊的胸口刺著一朵小小的藍色花，說是第一幅賣出去的畫上就有它。",
           background="在巴托羅的畫室當了五年模特兒，阿爾貝納一半的裸體畫上都有她。她說露出派的祕密不是不害羞，而是把害羞變成力量：「他們看你的時候，是你在掌控他們。」"),
]

# ---------------- S10-1 秘法書 ----------------
TOME_DESC_TAIL = '讀完（約 4 小時）有機會學會入門特質；已經入門的人，有機會學會進階特質。'


def tome(name, school, price, tags, desc, charm_min=None):
    perks = SCHOOL_PERKS[school]
    out = {"name": name, "category": "consumable", "price_cc": price, "tags": tags, "adult": True, "use": {"perks": perks}, "desc": desc + TOME_DESC_TAIL}
    if charm_min:
        out["charm_min"] = charm_min
    return out


TOMES = [
    tome("《侍奉之書》", 'servitude', 1800, ["tavern"], "侍寢見習館流出來的抄本，寫滿怎麼跪、怎麼等、怎麼在命令裡找到自己的位置。", 3),
    tome("《鞭痕錄》", 'punishment', 1800, ["magic"], "一位退伍刑訊官的筆記：每一種痛的名字、它會在身體裡停多久、怎麼讓它變成別的東西。", 3),
    tome("《結繩圖譜》", 'bondage', 1800, ["tailor"], "畫滿繩結與綁法的圖冊，每一頁的邊上都有人用紅筆標了「不會傷到」。", 3),
    tome("《魅魔的枕邊書》", 'indulgence', 2200, ["magic"], "赤翼宮廷的魅魔寫給人類的入門書，字跡圓滾滾的，插圖一點都不含蓄。", 3),
    tome("《肉身鍛鍊法》", 'flesh', 1800, ["general"], "一本講怎麼把身體練得耐操的小冊子，前半是體操，後半就不太是了。", 3),
    tome("《寄生生物考》", 'beast', 2000, ["magic"], "沼地女巫的研究筆記，記錄各種寄生物的習性，以及怎麼和牠們「談條件」。"),
    tome("《清規》", 'abstinence', 1500, ["temple"], "晨曦聖殿苦修士代代相傳的戒律與冥想法，紙頁被翻得發軟。"),
    tome("《模特兒守則》", 'exhibition', 1600, ["tailor"], "河畔畫室的模特兒們傳抄的守則：怎麼站、怎麼被看、怎麼讓看的人移不開眼睛。", 3),
]
TOME_NAMES = [t['name'] for t in TOMES]
# 拍賣會的權重、園區寶箱的機率
TOME_AUCTION_WEIGHT = 1
TOME_PARK_CHANCE = 0.03

# ---------------- S10-2 寄生類的雙面效應 ----------------
PARASITE_TWO_FACE = {
    "$comment": "寄生類的雙面效應（docs/LEWD_STATS.md 第 14.1 節）：平常是寄生物各階段的檢定減值（parasites.json 的 stage_effects）；戰鬥中，修了任何流派的人，還沒馴服、沒有沉睡的寄生物依階段（潛伏、發作、共生、支配）給 parasites 裡的修正（命中、迴避、豁免、減傷……；lust_bonus 是造成的慾望 +N）。修了 fit_school 的人 × fit（四捨五入）。馴服之後沒有這個效果（改成馴服的物品、印記與技能）。",
    "fit_school": "beast", "fit": 1.5,
    "parasites": {
        "hungry_lingerie": [{}, {"dr": 1}, {"dr": 1, "evade": 1}, {"dr": 2, "evade": 1}],
        "succubus_mark": [{}, {"lust_bonus": 1}, {"save": 1, "lust_bonus": 1}, {"save": 1, "hit": 1, "lust_bonus": 2}],
        "parasite_seed": [{}, {"dr": 1}, {"dr": 1, "save": 1}, {"dr": 2, "save": 1}],
    },
}

# ---------------- S10-3 稱號 ----------------
# requires：stats（五項慾望指標的範圍，曝露名聲看所在地區）、pc_tags（至少有一個）、reputation（所在地勢力的聲望範圍）
TITLES = {
    "$comment": "慾望稱號（docs/LEWD_STATS.md 第 28 節）：依慾望指標、曝露名聲（所在地區）、身分標籤、所在地勢力的聲望，由上往下挑符合的，最多 max 個。目前只顯示在角色詳情，沒有效果。",
    "max": 2,
    "list": [
        {"id": "debauched_noble", "name": "放蕩的貴族", "desc": "出身高貴，夜裡的名聲卻傳得比家徽還遠。",
         "requires": {"pc_tags": ["noble", "royal"], "stats": {"lewdness": {"min": 50}, "exposure": {"min": 40}}}},
        {"id": "fallen_cleric", "name": "墮落的神職者", "desc": "白天念經，晚上念的是別的東西。",
         "requires": {"pc_tags": ["priest", "bishop"], "stats": {"lewdness": {"min": 50}}}},
        {"id": "two_faced_hero", "name": "表裡不一的英雄", "desc": "這一帶的人敬重你，也都聽過你的那些事。",
         "requires": {"reputation": {"min": 10}, "stats": {"exposure": {"min": 50}}}},
        {"id": "notorious", "name": "惡名昭彰的蕩客", "desc": "這一帶的人提起你，先皺眉，再壓低聲音。",
         "requires": {"reputation": {"max": -5}, "stats": {"exposure": {"min": 50}}}},
        {"id": "obedient_slave", "name": "乖巧的奴隸", "desc": "項圈戴久了，連站姿都變得溫順。",
         "requires": {"pc_tags": ["slave"], "stats": {"submission": {"min": 60}}}},
        {"id": "public_plaything", "name": "人盡皆知的玩物", "desc": "這一帶的人都知道你聽話，也都知道你去哪裡找得到。",
         "requires": {"stats": {"submission": {"min": 70}, "exposure": {"min": 60}}}},
        {"id": "street_legend", "name": "街頭巷尾的傳說", "desc": "酒館裡講的那些故事，主角都是你。",
         "requires": {"stats": {"exposure": {"min": 80}}}},
        {"id": "trained_body", "name": "調教完成的身體", "desc": "一句命令、一個碰觸，身體就先替你回答了。",
         "requires": {"stats": {"submission": {"min": 80}, "sensitivity": {"min": 70}}}},
        {"id": "tireless", "name": "百戰不倦", "desc": "越玩越有精神，對手先投降的總是別人。",
         "requires": {"stats": {"lewdness": {"min": 70}, "endurance": {"min": 70}}}},
        {"id": "hair_trigger", "name": "一碰就軟", "desc": "敏感得連風吹過都會顫一下。",
         "requires": {"stats": {"sensitivity": {"min": 80}}}},
        {"id": "iron_wall", "name": "不為所動的鐵壁", "desc": "再怎麼撩撥，臉色都不會變一下。",
         "requires": {"stats": {"endurance": {"min": 70}, "lewdness": {"max": 20}}}},
        {"id": "pleasure_seeker", "name": "縱情享樂的人", "desc": "快樂是拿來享受的，不是拿來忍的。",
         "requires": {"stats": {"lewdness": {"min": 80}}}},
        {"id": "docile", "name": "溫順的寵物", "desc": "被摸頭的時候，會不自覺地靠過去。",
         "requires": {"stats": {"submission": {"min": 70}}}},
        {"id": "untouchable_flower", "name": "高嶺之花", "desc": "高貴、潔淨、遙不可及——至少目前是。",
         "requires": {"pc_tags": ["noble", "royal"], "stats": {"lewdness": {"max": 20}, "exposure": {"max": 10}}}},
        {"id": "chaste", "name": "潔身自好", "desc": "沒什麼可以讓人說嘴的。",
         "requires": {"stats": {"lewdness": {"max": 10}, "exposure": {"max": 5}}}},
    ],
}


def write():
    # perks.json：老師的預設
    p = 'data/rules/perks.json'
    t = set_key(open(p).read(), 'mentor', MENTOR_RULES)
    json.loads(t)
    open(p, 'w').write(t)

    # npcs.json：老師（一行一位，接在最後）
    p = 'data/world/npcs.json'
    t = drop_lines(open(p).read(), r'\n    \{ ?"id": "npc_mentor_[a-z]+".*')
    end = t.rindex('\n  ]')
    t = t[:end].rstrip() + ',\n' + ',\n'.join('    ' + json.dumps(n, ensure_ascii=False) for n in MENTORS) + t[end:]
    json.loads(t)
    open(p, 'w').write(t)

    # items.json：秘法書（一行一本，接在最後）
    p = 'data/rules/items.json'
    t = open(p).read()
    for n in TOME_NAMES:
        t = drop_lines(t, r'\n    \{"name": "' + re.escape(n) + r'".*')
    end = t.rindex('\n  ]')
    t = t[:end].rstrip() + ',\n' + ',\n'.join('    ' + json.dumps(x, ensure_ascii=False) for x in TOMES) + t[end:]
    json.loads(t)
    open(p, 'w').write(t)

    # lewd.json：寄生類的雙面效應、稱號、拍賣會與園區寶箱的秘法書
    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = set_key(t, 'parasite_two_face', PARASITE_TWO_FACE)
    t = set_key(t, 'titles', TITLES)

    def auction(v):
        v['pool'] = [x for x in v['pool'] if x[0] not in TOME_NAMES] + [[n, TOME_AUCTION_WEIGHT] for n in TOME_NAMES]
    t = edit_line(t, r'^  "auction": ', auction)
    m = re.search(r'^    "chest_items": (.*?)(,?)$', t, re.M)
    park = [x for x in json.loads(m.group(1)) if x[0] not in TOME_NAMES] + [[n, TOME_PARK_CHANCE] for n in TOME_NAMES]
    t = t[:m.start(1)] + json.dumps(park, ensure_ascii=False) + t[m.end(1):]
    json.loads(t)
    open(p, 'w').write(t)
    print('S10 mentors', len(MENTORS), 'tomes', len(TOMES), 'titles', len(TITLES['list']))


if __name__ == '__main__':
    write()
