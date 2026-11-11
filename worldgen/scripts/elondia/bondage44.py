# 拘束具擴充與地下街的成人用品店（docs/ITEMS.md 第 2、6 節、docs/TRADE.md 第 2 節、docs/LEWD_STATS.md 第 25 節）：
#   1. gear.json   新的拘束具與調教道具底材 41 種（口與臉、頸、手臂、鎖鏈、軀幹、腿腳、調教道具）。鎖鏈自帶環，戴上就有拘束。
#   2. items.json  每種底材的店貨（鎖鏈有長短不同的款式，越短拘束越強），標 adult_shop（只在成人用品店賣）；
#                  原本的拘束具：基礎款留在原來的店、也在成人用品店賣，其他的只在成人用品店賣；只有主人會戴上的（沒有商店標籤）也上架；
#                  鎖也在成人用品店賣（鑰匙照舊不在商店賣，見 LEWD_STATS 第 16 節）。
#   3. shops.json  新的內建店種 adult_shop「成人用品店」（地下街裡才有；原名成人用品店）、店名的字詞；原本的店每天另外上架的拘束具件數調少。
#   4. special_maps.json  每條地下街（sm_uw_*）擺一間成人用品店（第 4 列中央，入口上方兩格）。
#   （淫服訂做改成成人用品店的委託打造，見 outfits46.py。）
# 詛咒具（鎖死、只從陷阱、地下城、事件拿到）是下一批，不在這裡。
# 可以重跑：先拿掉上一次寫進去的再寫。要排在 lust_s9.py（拘束具、商店的 restraints）與 underworld39.py（地下街的地圖）之後。
import json
import re

# ---------------- 1. 底材 ----------------
# 欄位：只能戴在一個部位的照部位；拘束具都可以放額外飾品欄（兩格），所以「額外」類的照最接近的部位給。
# bind 1～3：拘束的程度；bind_kind：legs 腳、hands 手、eyes 眼、mouth 嘴、stim 刺激、body 身體。


def base(slot, name, kind, price, desc, bind=None, bind_kind=None):
    b = {"slot": slot, "name": name, "kind": kind, "price": price, "restraint": True}
    if bind:
        b["bind"] = bind
        b["bind_kind"] = bind_kind
    b["adult"] = True
    b["desc"] = desc
    return b


BASES = {
    # A. 口與臉
    "ring_gag": base("head", "口環", "leather", 60, "皮帶扣在腦後的金屬環撐開嘴巴，合不攏，口水一直往下滴。", 2, "mouth"),
    "spider_gag": base("head", "蜘蛛口環", "metal", 120, "口環的兩側各伸出幾根彎鉤，像蜘蛛的腳卡住嘴角，吐也吐不出來。", 3, "mouth"),
    "deepthroat_gag": base("head", "深喉口塞", "leather", 150, "皮帶連著一根長長的假陽具，得整根含進喉嚨裡再扣好。", 3, "mouth"),
    "harness_gag": base("head", "馬具口枷", "leather", 160, "口球加上好幾條繞過頭頂、下巴的皮帶，戴起來像套了馬具。", 3, "mouth"),
    "bit_gag": base("head", "口銜", "leather", 30, "像馬嚼子一樣橫咬在嘴裡的皮棒，兩端的繫帶在腦後綁緊。", 1, "mouth"),
    "tube_gag": base("head", "管形口枷", "metal", 90, "塞進嘴裡的一截短管，嘴只能一直張著；管口另附一個塞子。", 2, "mouth"),
    "nose_hook": base("piercing", "鼻鉤", "metal", 40, "勾進鼻孔、用細繩從頭頂拉到腦後的金屬鉤，臉被迫仰起，表情羞恥得藏不住。"),
    "ear_plugs": base("piercing", "耳塞", "cloth", 20, "塞進耳朵的軟塞，外面的聲音只剩模糊的嗡嗡聲。", 1, "eyes"),
    # B. 頸
    "posture_collar": base("accessory", "姿勢項圈", "leather", 80, "又寬又硬的皮項圈，從下巴頂到鎖骨，頭低不下去，只能一直抬著下巴。", 1, "body"),
    "leash_collar": base("accessory", "項圈牽繩", "leather", 60, "扣著一條長牽繩的項圈，有人握著另一端時只能跟著走。", 1, "body"),
    # C. 手臂
    "bind_cuffs": base("wrists", "拘束手環", "metal", 50, "扣在手腕上的金屬環，環上的扣眼隨時可以接上鎖鏈。", 1, "hands"),
    "arm_cuffs": base("wrists", "拘束臂環", "leather", 50, "扣在上臂、靠近手肘的皮環，常和手環、項圈連在一起。", 1, "hands"),
    "fist_mitts": base("wrists", "無指手套", "leather", 120, "把五根手指併在一起包起來的皮手套，只能做最簡單的抓握。", 2, "hands"),
    "box_binder": base("wrists", "盒式單手套", "leather", 220, "把雙手反剪、手掌在背後相合，整個裝進盒子形狀的皮套裡，手肘和手腕各扣一道鎖。", 3, "hands"),
    # D. 鎖鏈（自帶環：手環、腿環、項圈都在裡面）
    "front_chain": base("wrists", "前手鏈", "metal", 60, "附手環的鎖鏈，雙手在身前併在一起；鏈子越短，兩手越離不開。", 1, "hands"),
    "back_chain": base("wrists", "後手鏈", "metal", 80, "附手環的鎖鏈，雙手在身後併在一起；鏈子越短，手臂越被往後拉。", 2, "hands"),
    "collar_chain": base("accessory", "項圈手鏈", "metal", 100, "項圈前面分出兩條短鏈連著手環，雙手只能停在胸前。", 2, "hands"),
    "waist_chain": base("belt", "腰手鏈", "metal", 90, "附手環的腰環，兩邊的短鏈把雙手拉在腰側，抬不到胸口。", 2, "hands"),
    "thigh_chain": base("leg_accessory", "腿環鏈", "metal", 60, "附腿環的鎖鏈，兩條大腿被連在一起；鏈子越短，步伐越小。", 1, "legs"),
    "nipple_chain": base("piercing", "乳鏈", "metal", 80, "一對乳夾之間連著短鏈，鏈子一晃就扯著乳頭。", 1, "stim"),
    # E. 軀幹
    "waist_cuff": base("belt", "腰環", "metal", 50, "扣在腰上的金屬環，前後左右都有扣眼，可以把別的拘束具鎖在上面。", 1, "body"),
    "chastity_bra": base("underwear_top", "貞操胸罩", "metal", 120, "兩片金屬罩杯用短鏈鎖在肩上與胸前，胸口碰不到、也拿不下來。", 1, "stim"),
    "massage_bra": base("underwear_top", "按摩乳罩", "cloth", 400, "內側布滿軟凸點、乳頭處嵌著吮吸器的罩杯，揉捏、震動，一刻也不停。", 2, "stim"),
    # F. 腿與腳
    "thigh_cuffs": base("leg_accessory", "拘束大腿環", "leather", 40, "扣在大腿中段的皮環，環上的扣眼隨時可以接上鎖鏈。", 1, "legs"),
    "calf_cuffs": base("leg_accessory", "拘束小腿環", "leather", 40, "扣在膝蓋下方的皮環，常和大腿環、腳環連在一起。", 1, "legs"),
    "ankle_cuffs": base("leg_accessory", "拘束腳環", "metal", 40, "扣在腳踝上的金屬環，環上的扣眼隨時可以接上鎖鏈。", 1, "legs"),
    "leg_binder": base("legs", "單腳套", "leather", 250, "把兩條腿從大腿到腳踝併在一起包起來的長皮套，只能併著腿跳。", 3, "legs"),
    "puppy_suit": base("body", "牝犬衣", "leather", 400, "手臂與小腿都被折起來塞進皮套，只能用手肘和膝蓋著地，像小狗一樣爬。", 3, "hands"),
    # G. 調教道具
    "tongue_stud": base("piercing", "舌釘", "metal", 60, "穿過舌頭的金屬釘，說話時含含糊糊，口水也變多了。", 1, "stim"),
    "nipple_suckers": base("piercing", "乳頭吸盤", "cloth", 150, "擠掉空氣後吸在乳頭上的小吸盤，乳頭被吸得又紅又腫。", 2, "stim"),
    "clit_ring": base("piercing", "陰蒂環", "metal", 80, "穿在最敏感那一點上的小環，走路時輕輕摩擦。", 1, "stim"),
    "labia_rings": base("piercing", "陰唇環", "metal", 80, "左右對稱穿上的一對小環，可以掛上鈴鐺或鎖。", 1, "stim"),
    "labia_clamps": base("piercing", "陰唇夾", "metal", 60, "夾在兩側的小夾子，細鍊連到腿環上，下身一直被輕輕往外拉開。", 1, "stim"),
    "anal_plug": base("underwear_bottom", "肛塞", "metal", 80, "頭部圓鈍的金屬塞，底座鑲著一顆小寶石，塞著就一直脹脹的。", 1, "stim"),
    "tail_plug": base("underwear_bottom", "獸尾肛珠", "cloth", 120, "一串圓珠的末端接著毛茸茸的尾巴，走路時尾巴跟著搖。", 1, "stim"),
    "dildo": base("underwear_bottom", "假陽具", "wood", 100, "打磨光滑的木製假陽具，用貼身的皮帶固定在裡面。", 1, "stim"),
    "vibe_dildo": base("underwear_bottom", "震動假陽具", "metal", 500, "刻著魔導回路的假陽具，固定在裡面嗡嗡地震個不停。", 2, "stim"),
    "thrust_dildo": base("underwear_bottom", "抽插假陽具", "metal", 900, "會自己伸縮、旋轉的魔導假陽具，一下一下地往裡頂。", 3, "stim"),
    "double_dildo": base("underwear_bottom", "雙頭假陽具", "leather", 600, "前後兩頭的假陽具，同時塞住兩邊，皮帶扣得死緊。", 3, "stim"),
    "wired_egg": base("underwear_bottom", "有線跳蛋", "metal", 300, "細線連著遙控器的跳蛋，遙控器塞在襪口，誰拿到誰說了算。", 2, "stim"),
    "shock_pads": base("piercing", "電擊貼片", "metal", 400, "貼在敏感處的薄片，細線連到腿環上的控制器，一按就是一陣麻。", 2, "stim"),
    "urethral_lock": base("piercing", "尿道鎖", "metal", 300, "塞住尿道的細柱，只有在被允許的時候才能解開。", 2, "stim"),
}
ANCHOR_BASE = r'\n    "muzzle_gag": \{.*'

# ---------------- 2. 物品 ----------------
# 材料照底材的種類用第一級（金屬：鐵、皮革：皮、布：亞麻、木：橡木）；少數用絲或銀


def item(name, price, desc, gear, **extra):
    return {"name": name, "category": "equipment", "price_cc": price, "tags": ["adult_shop"], "adult": True, **extra, "desc": desc, "gear": gear}


MAT = {"metal": "iron", "leather": "leather", "cloth": "linen", "wood": "oak"}


def g(b, **over):
    return {"base": b, "material": over.pop("material", MAT[BASES[b]["kind"]]), **over}


NEW_ITEMS = [
    # A
    item("皮帶口環", 260, "皮帶扣在腦後的金屬環，嘴巴從此合不攏。", g("ring_gag"), master_force={"tags": ["villain"]}),
    item("蜘蛛口環", 520, "鐵鉤卡住嘴角的口環，怎麼也吐不出來。", g("spider_gag"), min_location="city", charm_min=3),
    item("深喉口塞", 600, "連著長長假陽具的口塞，含進去就只剩喉嚨裡的嗚咽。", g("deepthroat_gag"), min_location="city", charm_min=3),
    item("馬具口枷", 640, "好幾條皮帶繞過頭頂與下巴的口枷，套上去就像一匹被馴的馬。", g("harness_gag"), min_location="city"),
    item("皮口銜", 120, "橫咬在嘴裡的皮棒，說話只剩含糊的聲音。", g("bit_gag"), master_force={}),
    item("鐵管口枷", 380, "撐著嘴的一截鐵管，管口的塞子拔下來就合不上。", g("tube_gag")),
    item("鼻鉤", 160, "勾住鼻孔往上拉的金屬鉤，表情再也藏不住。", g("nose_hook"), charm_min=3),
    item("蠟耳塞", 60, "揉軟的蠟做成的耳塞，外面的聲音只剩嗡嗡聲。", g("ear_plugs")),
    # B
    item("姿勢項圈", 320, "硬皮做的寬項圈，頭只能一直抬著。", g("posture_collar"), master_force={"tags": ["noble", "royal"]}),
    item("項圈牽繩", 240, "扣著長牽繩的皮項圈，另一端在誰手上，就跟著誰走。", g("leash_collar"), master_force={}),
    # C
    item("鐵拘束手環", 200, "扣在手腕上的鐵環，環上留著接鎖鏈的扣眼。", g("bind_cuffs"), master_force={}),
    item("皮拘束臂環", 200, "扣在上臂的皮環，常和手環、項圈連在一起。", g("arm_cuffs")),
    item("無指皮手套", 480, "五指併攏包起來的皮手套，只能做最簡單的抓握。", g("fist_mitts"), master_force={"tags": ["villain"]}),
    item("盒式單手套", 900, "把反剪的雙手整個裝進去的盒形皮套，自己絕對解不開。", g("box_binder"), min_location="city", charm_min=3),
    # D：鎖鏈（長鏈拘束 1、中鏈 2、短鏈 3；後手鏈沒有長鏈）
    item("前手鏈・長", 240, "附手環的長鏈，雙手在身前還能各自活動。", g("front_chain", bind=1)),
    item("前手鏈・中", 280, "附手環的中鏈，雙手得一起捧著東西。", g("front_chain", bind=2)),
    item("前手鏈・短", 320, "附手環的短鏈，兩隻手腕緊緊貼在一起。", g("front_chain", bind=3), master_force={"tags": ["villain"]}),
    item("後手鏈・中", 320, "附手環的中鏈，雙手在背後只能稍稍分開。", g("back_chain", bind=2)),
    item("後手鏈・短", 380, "附手環的短鏈，手腕在背後緊緊貼著，胸口被迫挺起。", g("back_chain", bind=3), min_location="city"),
    item("項圈手鏈", 400, "項圈與手環連成一套，雙手只能停在胸前，像在捧著什麼。", g("collar_chain"), master_force={}),
    item("腰手鏈", 360, "腰環兩側的短鏈拉住雙手，手抬不到胸口。", g("waist_chain")),
    item("腿環鏈・長", 240, "附腿環的長鏈，走路還算自在。", g("thigh_chain", bind=1)),
    item("腿環鏈・中", 280, "附腿環的中鏈，只能慢慢走。", g("thigh_chain", bind=2)),
    item("腿環鏈・短", 320, "附腿環的短鏈，大腿幾乎併攏，只能夾著腿碎步走。", g("thigh_chain", bind=3), min_location="city"),
    item("乳鏈", 360, "一對乳夾之間垂著細細的鐵鏈，晃一下就扯一下。", g("nipple_chain"), charm_min=3),
    # E
    item("鐵腰環", 200, "扣在腰上的鐵環，前後左右都有扣眼。", g("waist_cuff"), master_force={}),
    item("貞操胸罩", 480, "金屬罩杯用短鏈鎖在肩上，胸口碰不到也拿不下。", g("chastity_bra"), master_force={"tags": ["noble", "royal", "priest"]}),
    item("魔導按摩乳罩", 1400, "內側會揉、會吸、會震的罩杯，戴上之後就停不下來。", g("massage_bra", material="silk"), min_location="city", charm_min=3),
    # F
    item("皮拘束大腿環", 160, "扣在大腿中段的皮環，留著接鎖鏈的扣眼。", g("thigh_cuffs")),
    item("皮拘束小腿環", 160, "扣在膝蓋下方的皮環。", g("calf_cuffs")),
    item("鐵拘束腳環", 160, "扣在腳踝上的鐵環，留著接鎖鏈的扣眼。", g("ankle_cuffs"), master_force={}),
    item("單腳套", 900, "從大腿包到腳踝的長皮套，只能併著腿跳。", g("leg_binder"), min_location="city", charm_min=3),
    item("牝犬衣", 1200, "把手腳折起來塞進皮套的拘束衣，只能用手肘和膝蓋爬。", g("puppy_suit"), min_location="city", charm_min=3),
    # G
    item("銀舌釘", 240, "穿過舌頭的小銀釘。", g("tongue_stud"), charm_min=3),
    item("乳頭吸盤", 500, "吸在乳頭上的透明小吸盤，越吸越腫。", g("nipple_suckers"), charm_min=3),
    item("陰蒂環", 320, "穿在最敏感那一點上的小環。", g("clit_ring"), charm_min=3),
    item("陰唇環", 320, "左右成對的小環，可以掛上鈴鐺或鎖。", g("labia_rings"), charm_min=3),
    item("陰唇夾", 240, "細鍊連到腿環的小夾子。", g("labia_clamps"), charm_min=3),
    item("寶石肛塞", 300, "底座鑲著紅寶石的金屬肛塞。", g("anal_plug"), master_force={"tags": ["villain"]}),
    item("獸尾肛珠", 450, "末端接著毛茸茸尾巴的肛珠，貓尾、兔尾、馬尾都有。", g("tail_plug"), charm_min=3),
    item("木製假陽具", 380, "打磨光滑的橡木假陽具，用皮帶固定在裡面。", g("dildo")),
    item("魔導震動假陽具", 1600, "固定在裡面震個不停的魔導假陽具。", g("vibe_dildo"), min_location="city", charm_min=3),
    item("魔導抽插假陽具", 2600, "會自己伸縮、旋轉的魔導假陽具。", g("thrust_dildo"), min_location="city", charm_min=3),
    item("雙頭假陽具", 1800, "同時塞住前後兩邊的雙頭假陽具。", g("double_dildo"), min_location="city", charm_min=3),
    item("有線跳蛋", 1000, "遙控器塞在襪口的有線跳蛋。", g("wired_egg"), charm_min=3),
    item("電擊貼片", 1300, "貼在敏感處的電擊薄片，控制器扣在腿環上。", g("shock_pads"), min_location="city", charm_min=3),
    item("尿道鎖", 1000, "塞住尿道、得到允許才能解開的細柱。", g("urethral_lock"), min_location="city", charm_min=3),
]
ANCHOR_ITEM = r'\n    \{ ?"name": "鈴鐺頸環".*'

# 原本的拘束具：基礎款留在原來的店、也在成人用品店賣；其他的只在成人用品店賣（名稱 → 新的 tags）
RETAG = {
    # 基礎款
    "絲帶手銬": ["tailor", "adult_shop"], "皮眼罩": ["tailor", "adult_shop"], "絲巾口塞": ["tailor", "adult_shop"],
    "麻繩繩衣": ["tailor", "adult_shop"], "蕾絲眼紗": ["tailor", "adult_shop"], "鈴鐺頸環": ["tailor", "adult_shop"],
    "皮手銬": ["smith", "adult_shop"], "鐵骨束腰": ["smith", "adult_shop"], "腳踝鈴鍊": ["jeweler", "adult_shop"],
    # 只在成人用品店
    "單手套": ["adult_shop"], "步鍊": ["adult_shop"], "芭蕾高跟靴": ["adult_shop"], "絲繩龜甲縛": ["adult_shop"],
    "跳蛋內褲": ["adult_shop"], "鈴鐺乳夾": ["adult_shop"], "全罩皮頭套": ["adult_shop"], "魔導震動栓": ["adult_shop"],
    "口球": ["adult_shop"], "皮革面罩口枷": ["adult_shop"],
    # 原本只有主人會戴上的（沒有商店標籤）
    "奴隸項圈": ["adult_shop"], "腕鐐": ["adult_shop"], "腳鐐": ["adult_shop"], "刺釘項圈": ["adult_shop"], "絲絨頸環": ["adult_shop"],
    "貞操帶": ["adult_shop"], "皮革束帶": ["adult_shop"], "家紋束胸綢": ["adult_shop"],
}
# 鎖：原本的店照賣，成人用品店也賣（鑰匙照舊不在商店賣）
LOCKS = ["白鐵鎖", "藍鋼鎖", "符文鎖"]

# ---------------- 3. 商店 ----------------
SHOP = {
    "name": "成人用品店", "emoji": "💋",
    "desc": "地下街裡的成人用品店：拘束具、調教道具、成人向服裝、調教家具與各種小道具，還有鎖；也接成人向服裝的委託打造。",
    "ai": True, "cell": "adult_shop",
    "keeper": {"classes": ["rogue", "bard"], "title": "店主", "tags": ["merchant"]},
    "catalog_tag": "adult_shop", "restraints": [8, 12], "outfits": [4, 6],
    "buys": ["equipment"], "ai_effects": ["item", "affinity", "flag", "memory", "gear"],
    "specials": [{"id": "fitting", "title": "請店主幫忙試戴", "desc": "店主替你挑一件、扣上、再解開，順便講解怎麼鎖最牢。",
                  "gives": [{"type": "money", "amount": 30}], "gets": [{"type": "affinity", "npc": "keeper", "delta": 1}], "stock": 1,
                  "flavor": "店主一邊示範扣環與鎖頭，一邊說起哪位貴客訂了什麼怪東西"}],
}
# 原本的店每天另外上架的拘束具件數（大部分搬去成人用品店了）
SHOP_RESTRAINTS = {"smithy": [0, 1], "tailor": [1, 2], "jeweler": [0, 1], "magic": None}
NAMING = {
    "suffix": ["成人用品店", "秘具舖", "夜之衣坊"],
    "desc": ["{air}；牆上一排排掛著皮帶、鐵環與鎖鏈，另一邊是薄得透光的衣裳。", "{air}，玻璃櫃裡擺著形狀古怪的玩具。", "{air}；簾子後面是給客人試穿、試戴的小隔間。"],
    "greeting": ["第一次來？先從手銬試起吧。", "要自己用，還是給別人穿？", "鎖另外算錢。鑰匙？那可不賣。"],
}

# ---------------- 4. 地下街 ----------------
UW_SHOP_AT = {"x": 4, "y": 4}


def drop_lines(text, pattern):
    return re.sub(pattern, '', text)


def insert_after(text, anchor, lines):
    # 錨點那一行本來就以逗號結尾（後面還有別的）：插進去的每一行也都帶逗號
    m = re.search(anchor, text)
    assert m and m.group(0).endswith(','), anchor
    return text[:m.end()] + ''.join('\n' + ln + ',' for ln in lines) + text[m.end():]


def write_gear():
    p = 'data/rules/gear.json'
    t = open(p).read()
    for k in BASES:
        t = drop_lines(t, r'\n    "' + k + r'": \{.*')
    t = insert_after(t, ANCHOR_BASE, [f'    "{k}": ' + json.dumps(v, ensure_ascii=False) for k, v in BASES.items()])
    d = json.loads(t)
    for k in BASES:
        assert d['bases'][k]['restraint']
    open(p, 'w').write(t)


def write_items():
    p = 'data/rules/items.json'
    t = open(p).read()
    for i in NEW_ITEMS:
        t = drop_lines(t, r'\n    \{ ?"name": "' + re.escape(i['name']) + r'".*')
    t = insert_after(t, ANCHOR_ITEM, ['    ' + json.dumps(i, ensure_ascii=False) for i in NEW_ITEMS])

    def retag(m, tags):
        line = m.group(0)
        d = json.loads(line.strip().rstrip(','))
        d['tags'] = tags
        comma = ',' if line.rstrip().endswith(',') else ''
        return '\n    ' + json.dumps(d, ensure_ascii=False) + comma
    for name, tags in RETAG.items():
        t, n = re.subn(r'\n    \{ ?"name": "' + re.escape(name) + r'".*', lambda m, tags=tags: retag(m, tags), t, count=1)
        assert n == 1, name
    for name in LOCKS:
        def addtag(m):
            line = m.group(0)
            d = json.loads(line.strip().rstrip(','))
            d['tags'] = [x for x in d.get('tags', []) if x != 'adult_shop'] + ['adult_shop']
            comma = ',' if line.rstrip().endswith(',') else ''
            return '\n    ' + json.dumps(d, ensure_ascii=False) + comma
        t, n = re.subn(r'\n    \{ ?"name": "' + re.escape(name) + r'".*', addtag, t, count=1)
        assert n == 1, name
    d = json.loads(t)
    names = {i['name'] for i in d['items']}
    gear = json.load(open('data/rules/gear.json'))['bases']
    for i in NEW_ITEMS:
        assert i['name'] in names and i['gear']['base'] in gear, i['name']
    open(p, 'w').write(t)


def shop_block():
    # 和其他店種一樣：每個欄位一行
    lines = [f'      "{k}": ' + json.dumps(v, ensure_ascii=False) for k, v in SHOP.items() if k != 'specials']
    sp = ',\n'.join('        ' + json.dumps(x, ensure_ascii=False) for x in SHOP['specials'])
    lines.append('      "specials": [\n' + sp + '\n      ]')
    return '\n    "adult_shop": {\n' + ',\n'.join(lines) + '\n    },'


def write_shops():
    p = 'data/rules/shops.json'
    t = open(p).read()
    # 拿掉上一次寫的店種，再接在流浪商人前面
    t = re.sub(r'\n    "adult_shop": \{\n.*?\n    \},', '', t, flags=re.S)
    i = t.index('\n    "wanderer": {')
    t = t[:i] + shop_block() + t[i:]
    # 店名的字詞：接在 naming 的 suffix、desc、greeting 最後
    for key in ('suffix', 'desc', 'greeting'):
        m = re.search(r'\n    "' + key + r'": \{\n(.*?)\n    \}', t, re.S)
        lines = [ln for ln in m.group(1).split('\n') if not ln.strip().startswith('"adult_shop"')]
        lines[-1] = lines[-1].rstrip(',') + ','
        lines.append('      "adult_shop": ' + json.dumps(NAMING[key], ensure_ascii=False))
        t = t[:m.start(1)] + '\n'.join(lines) + t[m.end(1):]
    # 原本的店每天另外上架的拘束具件數：直接改那一行
    for shop, r in SHOP_RESTRAINTS.items():
        m = re.search(r'\n    "' + shop + r'": \{\n(.*?)\n    \},', t, re.S)
        body = m.group(1)
        body = re.sub(r'\n      "restraints": \[[^\]]*\],', '', body)
        if r is not None:
            body = re.sub(r'(\n      "catalog_tag": [^\n]*,)', lambda x: x.group(1) + f'\n      "restraints": {json.dumps(r)},', body, count=1)
        t = t[:m.start(1)] + body + t[m.end(1):]
    d = json.loads(t)
    assert d['types']['adult_shop'] == SHOP
    for shop, r in SHOP_RESTRAINTS.items():
        assert d['types'][shop].get('restraints') == r, shop
    for key in ('suffix', 'desc', 'greeting'):
        assert d['naming'][key]['adult_shop'] == NAMING[key]
    open(p, 'w').write(t)


def write_underworld():
    p = 'data/world/special_maps.json'
    t = open(p).read()
    t = re.sub(r'\n      "shops": \[\{"shop": "adult_shop"[^\n]*\],', '', t)
    shop_line = '\n      "shops": [' + json.dumps({"shop": "adult_shop", **UW_SHOP_AT}) + '],'
    t, n = re.subn(r'(\n    "sm_uw_[a-z_]+": \{\n(?:      "(?!grid)[^\n]*\n)*?)(      "grid": )', lambda m: m.group(1) + shop_line.lstrip('\n') + '\n' + m.group(2), t)
    d = json.loads(t)
    maps = d.get('maps', d)
    uw = [k for k in maps if k.startswith('sm_uw_')]
    assert n == len(uw), (n, len(uw))
    for k in uw:
        m = maps[k]
        assert m['grid'][UW_SHOP_AT['y']][UW_SHOP_AT['x']] == '.', k
        assert m['shops'] == [{"shop": "adult_shop", **UW_SHOP_AT}], k
    open(p, 'w').write(t)
    return len(uw)



if __name__ == '__main__':
    write_gear()
    write_items()
    write_shops()
    uw = write_underworld()
    print('bases', len(BASES), 'items', len(NEW_ITEMS), 'retag', len(RETAG), 'underworld shops', uw)
