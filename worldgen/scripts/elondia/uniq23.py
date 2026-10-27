"""任務的獨特裝備：五個等級區間，依職業（職能）分配武器、防具、飾品。
- 第一區間（Lv.5～7）：第二級材料、稀有（2 點附魔）、檢定 +1；分散在 Lv.5 的特殊任務的完成獎勵
- 第二區間（Lv.8～11）：第三級材料、史詩（4 點）、檢定 +2；分散在 Lv.8、11 的特殊任務
- 第三區間（Lv.12～15）：第四級材料、傳說（6 點）、主屬性 +1、檢定 +2；鍛造與冒險角色的六個新任務，任務結尾選一件
- 第四區間（Lv.16～18）：第五級材料、傳說（6 點）、主屬性 +2、檢定 +3；政治史詩時期的任務，結尾三選一
- 第五區間（Lv.19～20）：第五級材料、超越傳說（8 點）、主屬性 +3＋次屬性 +1、檢定 +3；巨龍投影掉落的職業最強武器
寫進 data/rules/items.json（接在內建的獨特物品後面，可以重跑）；place_gear(BATCH) 把獎勵掛到任務上。
"""
import json

R = ''
G = json.load(open(R + 'data/rules/gear.json'))
CLS = json.load(open(R + 'data/rules/classes.json'))['classes']

MAT = {  # 區間 → 材料種類 → 材料
    1: {'metal': 'steel', 'leather': 'hard_leather', 'cloth': 'silk', 'wood': 'yew', 'jewel': 'silver'},
    2: {'metal': 'mithril', 'leather': 'beast_hide', 'cloth': 'moonsilk', 'wood': 'elderwood', 'jewel': 'gold'},
    3: {'metal': 'adamantine', 'leather': 'dragonhide', 'cloth': 'spellweave', 'wood': 'worldtree', 'jewel': 'mithril_jewel'},
    4: {'metal': 'star_iron', 'leather': 'elder_dragonhide', 'cloth': 'starweave', 'wood': 'divine_wood', 'jewel': 'starstone'},
    5: {'metal': 'star_iron', 'leather': 'elder_dragonhide', 'cloth': 'starweave', 'wood': 'divine_wood', 'jewel': 'starstone'},
}
RARITY = {1: 'rare', 2: 'epic', 3: 'legendary', 4: 'legendary', 5: 'legendary'}
POINTS = {1: 2, 2: 4, 3: 6, 4: 6, 5: 8}
BONUS = {1: 1, 2: 2, 3: 2, 4: 3, 5: 3}

# 附魔的分配順序（輪流加）：o: 屬性攻擊、r: 抗性（每點 0.25）
WEAPON = {
    'fighter': ['hit', 'damage'], 'barbarian': ['damage', 'crit'], 'paladin': ['damage', 'o:radiant'], 'ranger': ['hit', 'crit'],
    'rogue': ['crit', 'hit'], 'monk': ['hit', 'damage', 'crit'], 'bard': ['hit', 'o:psychic'], 'cleric': ['o:radiant', 'save'],
    'druid': ['o:elemental', 'hit'], 'wizard': ['o:elemental', 'o:arcane'],
}
ARMOR = {
    'fighter': ['dr', 'save'], 'barbarian': ['dr', 'r:physical'], 'paladin': ['dr', 'r:divine'], 'ranger': ['evade', 'hit'],
    'rogue': ['evade', 'crit'], 'monk': ['evade', 'save'], 'bard': ['evade', 'r:arcane'], 'cleric': ['save', 'dr'],
    'druid': ['evade', 'r:elemental'], 'wizard': ['save', 'r:arcane'],
}
JEWEL = {  # 飾品依底材
    'ring_precision': ['hit', 'crit'], 'ring_guard': ['save', 'r:all'], 'ring_fortune': ['crit', 'hit'], 'ring_swift': ['evade', 'hit'],
    'amulet_ward': ['save', 'r:divine'], 'amulet_iron': ['dr', 'save'], 'pendant_shadow': ['r:necrotic', 'save'],
    'pendant_poison': ['r:poison', 'o:elemental'], 'pendant_mind': ['r:psychic', 'o:arcane'], 'navel_vigor': ['ap_regen', 'damage'],
    'earring_hawk': ['hit', 'crit'], 'earring_calm': ['save', 'r:arcane'], 'anklet_wind': ['evade', 'hit'], 'focus': ['o:arcane', 'save'],
}

# 檢定加值的代號
def check(code):
    if code in ('str', 'dex', 'int', 'fai', 'cha'): return {'attrs': [code]}
    if code.startswith('vs:'): return {'vs_tags': code[3:].split(',')}
    if code.startswith('k:'): return {'kinds': code[2:].split(',')}
    return {'contexts': code.split(',')}


def allocate(points, keys):
    mods, res, off = {}, {}, {}
    i, left, ap = 0, points, False
    while left > 0:
        k = keys[i % len(keys)]
        i += 1
        if k == 'ap_regen':
            if ap or left < 2: continue
            mods['ap_regen'] = 1; left -= 2; ap = True
            continue
        if k.startswith('o:'): off[k[2:]] = off.get(k[2:], 0) + 0.25
        elif k.startswith('r:'): res[k[2:]] = res.get(k[2:], 0) - 0.25
        else: mods[k] = mods.get(k, 0) + 1
        left -= 1
    e = {}
    if mods: e['mods'] = mods
    if res: e['resist'] = res
    if off: e['offense'] = off
    return e


def kind_of(base):
    b = G['bases'][base]
    if b['slot'] == 'main_hand' or base in ('wraps', 'vambraces'): return 'w'
    if b['slot'] == 'body': return 'a'
    return 'j'


ITEMS = []   # (區間, 名稱, 底材, 職業, 檢定代號, 描述)


def add(band, name, base, cls, code, desc):
    ITEMS.append((band, name, base, cls, code, desc))
    return name


def spec(band, base, cls):
    kind = kind_of(base)
    mat = MAT[band][G['bases'][base]['kind']]
    keys = WEAPON[cls] if kind == 'w' else ARMOR[cls] if kind == 'a' else JEWEL[base]
    s = {'base': base, 'material': mat}
    if RARITY[band] != G['materials'][mat]['rarity']: s['rarity'] = RARITY[band]
    s['enchants'] = allocate(POINTS[band], keys)
    return s


def item_json(band, name, base, cls, code, desc):
    s = spec(band, base, cls)
    s['unique'] = {'check': check(code), 'bonus': BONUS[band]}
    if band >= 3 and cls:
        pr = CLS[cls]['priority']
        s['attrs'] = {pr[0]: {3: 1, 4: 2, 5: 3}[band]}
        if band == 5: s['attrs'][pr[1]] = 1
    pts = POINTS[band]
    price = round(G['bases'][base]['price'] * G['materials'][s['material']]['price'] * (1 + 0.5 * pts))
    return {'name': name, 'category': 'equipment', 'price_cc': price, 'tags': ['unique'], 'desc': desc, 'gear': s}


# ---------------- 第一區間（Lv.5～7）：分散在 Lv.5 的任務 ----------------
B1 = {
    'rhine_raid': add(1, '守夜餘燼', 'longsword', 'fighter', 'initiative', '南郊村子的守夜人留下的鋼劍，劍鍔上纏著燒焦的布條。握著它的人，總是第一個聽見夜裡的動靜。'),
    'law_weakest_king': add(1, '千敗', 'greataxe', 'barbarian', 'str', '「四天王中最弱的」用了二十年的巨斧。斧刃上刻滿了他輸掉的每一場決鬥——他說，輸過的人才知道怎麼贏。'),
    'mist_bell': add(1, '遠鐘', 'warhammer', 'paladin', 'fai', '從碎掉的晨鐘裡找到的鐘鎚，改裝成了戰鎚。敲下去的時候，偶爾還會響起一聲很遠的鐘聲。'),
    'msr_stolen_bows': add(1, '根界歸途', 'longbow', 'ranger', 'travel,road', '精靈弓匠托倫被偷走的那批弓裡最好的一把，弓臂上刻著根界的藤紋。托倫說，它比主人更認得路。'),
    'defense_codebook': add(1, '順手牽羊', 'dagger', 'rogue', 'lock', '自由集市長大的扒手凱，從帝國密探身上順手摸來的鋼製折刀。刀柄裡藏著一根開鎖用的細針。'),
    'wat_dancer_rumor': add(1, '金幣之舞', 'wraps', 'monk', 'save', '蕾伊拉跳舞時纏在手腕上的絲帶，綴著小小的金幣。纏緊了拿來打架，意外地好用。'),
    'epic_bellringer': add(1, '顫音', 'rapier', 'bard', 'cha', '宮廷樂師席恩拿來指揮樂團的細劍——他堅持那是指揮棒。揮起來的時候，劍身會發出很輕的顫音。'),
    'god_silent_prophecy': add(1, '亡者靜聽', 'mace', 'cleric', 'fai', '灰燼修會的祭司在葬禮上用的鋼鎚矛，鎚頭鑲著一圈磨亮的獸骨。死者們據說會安靜地聽它說話。'),
    'rot_herb_errand': add(1, '沼地先知', 'quarterstaff', 'druid', 'trap', '莫格婆婆用了四十年的紫杉採藥杖，杖頭被沼地的毒水泡得發黑。拿著它走沼地，總能先一步探到哪裡會陷下去。'),
    'morphe_insomnia': add(1, '夢遊者', 'spellstaff', 'wizard', 'int', '莫菲在夢裡加班時總是抓著的紫杉法杖。醒來的時候，它常常不在原來的地方。'),
    'annex_white_rook': add(1, '白城堡', 'plate', 'fighter', 'gate', '第四軍團的信使穿的鋼製板甲，胸口刻著一枚白色的城堡棋子。穿著它過城門，守衛很少多問一句。'),
    'kara_great_hunt': add(1, '赤鬃疾風', 'leather_armor', 'barbarian', 'str', '赤鬃族長卡菈狩獵時穿的硬皮甲，肩上綴著一圈赤棕色的鬃毛。族人說，穿上它的人跑起來像風。'),
    'isab_drinking_bet': add(1, '賭債', 'chain', 'paladin', 'vs:priest,bishop', '聖殿騎士團長伊莎貝拉年輕時穿的鋼鍊甲，喝輸賭局的人拿去當了酒錢，又被你贖了回來。'),
    'ecc_missing_hunter': add(1, '無聲峽谷', 'leather_armor', 'ranger', 'stealth', '夜爪部落的獵手穿著它潛入回音峽谷。硬皮上抹了一層沙，走在峽谷裡幾乎沒有聲音。'),
    'smg_blacksail_cargo': add(1, '海鷗不看', 'leather_armor', 'rogue', 'stealth', '從黑帆的貨裡翻出來的硬皮甲，內襯縫滿了暗袋。穿著它在港口卸貨，連海鷗都不會多看一眼。'),
    'thc_moonlight_pilgrimage': add(1, '新月靜心', 'monk_robe', 'monk', 'save', '精靈學徒在月華巡禮時穿的絲綢修行袍，袖口繡著一彎新月。穿著它的人，心比較靜。'),
    'sak_land_banquet': add(1, '櫻色宴席', 'leather_armor', 'bard', 'k:chat,flatter', '潮主櫻汐為「陸地風格」的宴會訂做的硬皮甲，染成了櫻花的顏色。陸地人說它太花俏，玉璘族說它很樸素。'),
    'dawn_throne_ambush': add(1, '官道遺誓', 'chain', 'cleric', 'vs:royal,noble', '樞機主教的護衛穿的鋼鍊甲，胸口鑲著小小的聖環。那天在官道上倒下的護衛，有一位把它託付給了你。'),
    'wt_spring_decline': add(1, '泉苔', 'leather_armor', 'druid', 'fai', '銀月城守泉祭司的硬皮甲，表面長著一層薄薄的苔蘚，摸起來濕濕涼涼的。'),
    'shadow_extra_star': add(1, '多餘之星', 'robe', 'wizard', 'int', '星術師艾溫娜的舊絲綢長袍，袍面繡著一幅星圖——多了一顆不該存在的星。'),
    'gnt_mountain_heartbeat': add(1, '山之心跳', 'ring_precision', 'fighter', 'initiative', '灰岩堡壘的將軍杜拉克戴了三十年的銀戒指，戒面刻著山的心跳。'),
    'brc_bloodsworn_squires': add(1, '不倦戰紋', 'navel_vigor', 'barbarian', 'retreat', '血誓侍從身上取下的銀臍釘，刻著遠古魔族的戰紋。戴著它的人，好像怎麼打都不會累。'),
    'spirit_river_girl': add(1, '石橋一滴', 'amulet_ward', 'paladin', 'negotiation', '河面上的少女留下的銀護符，裡面封著一滴舊石橋下的河水。在它面前說的話，好像都比較算數。'),
    'skl_no_survivors': add(1, '桅頂之眼', 'earring_hawk', 'ranger', 'trap', '骷髏潮島上找到的銀耳環，舊時代海盜王的瞭望手戴過的。戴著它，遠處的東西看得特別清楚。'),
    'spy_pigeons': add(1, '鴿籠密碼', 'ring_swift', 'rogue', 'gate', '帝國密探留在信鴿籠裡的銀戒指，戒圈內側刻著一串密碼。'),
    'kagni_hammer_tone': add(1, '山風銀屑', 'anklet_wind', 'monk', 'travel,road', '風錘村的孩子們用巨錘下的銀屑打的腳鍊，走起路來會跟著山風輕輕地響。'),
    'noctis_ghostwriter': add(1, '他人之言', 'earring_calm', 'bard', 'cha', '陰影之谷的代筆人戴的銀耳墜。寫不出字來的時候，摸一摸它，話就會自己出來。'),
    'whisper_seal': add(1, '噤聲', 'pendant_shadow', 'cleric', 'save', '低語墓穴外的村民掛在門口的銀項鍊，據說能讓風裡的低語安靜下來。'),
    'snake_red_creek': add(1, '紅溪蛇鱗', 'pendant_poison', 'druid', 'travel', '蛇溪牧場的老牧人用蛇魔的鱗片和銀線編的項鍊。喝了紅色的溪水也不會有事——據說。'),
    'fog_lost_names': add(1, '不忘', 'pendant_mind', 'wizard', 'save', '苔語村的人走進霧裡之前，會把名字刻在這條銀項鍊上。它從來沒有忘記過任何一個名字。'),
}

# ---------------- 第二區間（Lv.8～11）：分散在 Lv.8、11 的任務 ----------------
B2 = {
    'smith_heartfire_test': add(2, '呼吸之焰', 'longsword', 'fighter', 'initiative', '瑪格達用心火熔源打的秘銀長劍，劍身裡像有一團火在慢慢地呼吸。和迪莉婭的那一把比，誰贏了並不重要。'),
    'law_bone_throne': add(2, '戈爾的沉默', 'greataxe', 'barbarian', 'str', '血角四天王之首「沉默之斧」戈爾的秘銀巨斧。他一輩子沒說過幾句話，這把斧頭替他說完了。'),
    'mist_saint': add(2, '指甲刻名', 'warhammer', 'paladin', 'fai', '被抹去名字的聖者生前用的秘銀戰鎚，鎚柄上的名字被磨掉了，又被人用指甲一筆一筆刻了回去。'),
    'msr_shard_avatar': add(2, '根穴月光', 'longbow', 'ranger', 'dex', '用月影根穴深處的古樹木做的長弓，弓臂在月光下會透出淡淡的銀光。'),
    'defense_spymaster': add(2, '無刃', 'dagger', 'rogue', 'stealth', '帝國在阿爾貝納的最後一位密探頭子的秘銀匕首，薄得幾乎看不見刀刃。'),
    'rite_redmane_games': add(2, '先於目光', 'wraps', 'monk', 'dex', '赤鬃部族競技的冠軍獎品：一卷月影絲纏腕布。纏在拳頭上，出拳比眼睛還快。'),
    'epic_frost_giant': add(2, '史詩最後一句', 'rapier', 'bard', 'cha', '英雄史詩歌首演那天，宮廷樂師席恩獻給「真正的英雄」的秘銀細劍。劍身上刻著史詩的最後一句。'),
    'god_white_flame': add(2, '遺火白焰', 'mace', 'cleric', 'fai', '遺火塔頂的淨化聖火淬過的秘銀鎚矛，鎚頭總是帶著一點白色的微光。'),
    'wt_new_sprout': add(2, '不止的新芽', 'quarterstaff', 'druid', 'fai', '月輝之母的新芽旁掉下來的一截古樹枝，削成長棍之後，杖頭還在發芽。'),
    'emb_flame_weavers': add(2, '馴焰', 'spellstaff', 'wizard', 'int', '在餘燼裂隙邊緣汲取魔焰的術士們用的古樹木法杖，杖身裡流著一縷被馴服的魔焰。'),
    'rhine_council': add(2, '四色軍議', 'plate', 'fighter', 'vs:noble,royal', '四將軍軍議之後，帝國宰相送給你的秘銀板甲，胸口刻著帝國的四色紋章。'),
    'trial_bloodhorn_warrior': add(2, '新月血夜', 'leather_armor', 'barbarian', 'str', '新月夜的血獸皮鞣成的魔獸皮甲，還帶著荒原深處的血腥味。烏爾瑪說，撐過那一夜的人才配穿它。'),
    'isab_young_knight': add(2, '還命之恩', 'chain', 'paladin', 'vs:priest,bishop', '被審判廷放出來的年輕騎士，把他的秘銀鍊甲送給了你：「我的命是你們救的。」'),
    'nip_sand_lions': add(2, '草原沙影', 'leather_armor', 'ranger', 'travel,road', '荒野深處的沙獅皮做的魔獸皮甲，淺沙色的毛皮在草原上幾乎看不見。'),
    'smg_under_council_eyes': add(2, '無月之海', 'leather_armor', 'rogue', 'gate', '「黑帆」卡洛斯的魔獸皮甲，黑得像沒有月亮的海。七潮議會搜了三天三夜，也沒找到穿著它的人。'),
    'thc_goddess_shadow': add(2, '女神倒影', 'monk_robe', 'monk', 'save', '荊棘迴廊最後一關之後，從自然女神的倒影裡浮出來的月影絲修行袍。'),
    'vault_banquet_guest': add(2, '鯨歌浪鈴', 'leather_armor', 'bard', 'k:chat,flatter', '夏瀾殿主鯨歌的宴會外套，用深海鯨的魔獸皮做成，掛滿了浪紋的小金鈴。'),
    'doctrine_council': add(2, '兩百年之護', 'chain', 'cleric', 'negotiation', '大公會議的護教騎士穿的秘銀鍊甲，兩百年來第一次在會議廳裡穿出來。'),
    'wt_other_end': add(2, '樹說你需要', 'leather_armor', 'druid', 'trap', '人類德魯伊奧克塔維亞送的魔獸皮甲，說是「樹告訴我你需要它」。'),
    'shadow_sorian_projection': add(2, '星落之夜', 'robe', 'wizard', 'save', '那顆不該存在的星落下的那一夜，艾溫娜用星光與月影絲織成的長袍。'),
    'annex_protection_treaty': add(2, '羅莎琳德之印', 'ring_precision', 'fighter', 'negotiation', '「白棋」羅莎琳德蓋條約用的金印戒。條約簽沒簽成，這枚戒指都到了你手上。'),
    'kara_suitors': add(2, '勇士之奪', 'navel_vigor', 'barbarian', 'str', '想追求赤鬃族長的人，要把這枚金臍釘從她選的勇士身上搶下來。'),
    'spirit_drowned': add(2, '兩百年誓約', 'amulet_ward', 'paladin', 'save', '河底的怨靈安息之後，流水之靈從河底撈起來的金護符，刻滿了兩百年來的誓約。'),
    'skl_pirate_king_map': add(2, '紅鬚的夾層', 'earring_hawk', 'ranger', 'trap', '海盜王紅鬚的金耳環，兩半藏寶圖合在一起的時候，從地圖夾層裡掉了出來。'),
    'commerce_false_coin': add(2, '比真的還真', 'ring_swift', 'rogue', 'k:haggle,bargain', '風誓塔的假幣師的金戒指，做工比真的白鸛幣還精細。'),
    'qst_sun_oracle': add(2, '沙上之舞', 'anklet_wind', 'monk', 'dex', '流沙聖殿的牆上解開太陽神諭之後，從石縫裡滑出來的金腳鍊，走起路來像在沙上跳舞。'),
    'seacave_siren': add(2, '洞中歌聲', 'earring_calm', 'bard', 'cha', '燈塔下的海蝕洞裡，那個唱歌的女人留下的金耳墜。戴著它唱歌，聲音會傳得很遠。'),
    'brc_fallen_king': add(2, '敗王的饋贈', 'pendant_shadow', 'cleric', 'fai', '血岩深穴深層的戰敗古王，臨走前取下來交給你的金項鍊。'),
    'ghs_experiment_log': add(2, '未萌之種', 'pendant_poison', 'druid', 'int', '「荒原綠化計畫」的研究員掛在脖子上的金項鍊，墜子裡封著一顆從沒發芽的種子。'),
    'echo_seal_log': add(2, '唯一歸來者', 'pendant_mind', 'wizard', 'save', '十年前下到回聲裂谷的矮人封印隊，每人都戴著一條。只有一條回來了。'),
}

# ---------------- 第三區間（Lv.12～15）：新任務的選項 ----------------
P3_NEW_DESIGN = [  # 迪莉婭的新式武器設計
    add(3, '無紋', 'longsword', 'fighter', 'initiative', '迪莉婭用無火之鐵熔出的第一把精金長劍。沒有經過火的鋼，劍身上看不到一絲鍛紋，卻比任何劍都硬。'),
    add(3, '穩定器', 'warhammer', 'paladin', 'fai', '無火熔爐鑄出的精金戰鎚，鎚頭裡嵌著一顆迪莉婭稱為「穩定器」的小齒輪。'),
    add(3, '第四十三稿', 'greataxe', 'barbarian', 'str', '迪莉婭說巨斧是最難設計的：太重會拖慢你，太輕會劈不開。她改了四十三次。'),
    add(3, '無火之針', 'rapier', 'rogue', 'stealth', '細得像一根針的精金細劍，無火之鐵才做得出這麼薄的劍身。'),
    add(3, '七棱星', 'mace', 'cleric', 'save', '迪莉婭的神殿朋友訂的精金鎚矛，鎚頭的七道棱線剛好對準七芒星。'),
    add(3, '拳之設計', 'vambraces', 'monk', 'dex', '給赤手空拳的人設計的精金護臂，迪莉婭說：「拳頭也是一種武器，只是比較難做。」'),
]
P3_BROKEN = [  # 瑪格達的破損傳說武器「黎明」
    add(3, '晨弦', 'longbow', 'ranger', 'dex', '兩百年前斷成七截的傳說武器「黎明」，用世界樹枝接回來，重鑄成了一把長弓。'),
    add(3, '一點晨光', 'spellstaff', 'wizard', 'int', '「黎明」的劍芯熔成了杖芯，外面包著世界樹枝。舉起它的時候，杖頭會亮起一點晨光。'),
    add(3, '草生黎明', 'quarterstaff', 'druid', 'fai', '「黎明」的碎片嵌在世界樹枝做的長棍兩端，打在地上會長出一圈小小的草。'),
    add(3, '黎明之尖', 'dagger', 'rogue', 'lock', '「黎明」最鋒利的那一截刀尖，重鑄成了一把精金匕首。'),
    add(3, '黎明', 'longsword', 'paladin', 'fai', '照著兩百年前的樣子重鑄回來的「黎明」。劍身上的裂痕還在，瑪格達說那是它的記憶。'),
    add(3, '晨鐘', 'rapier', 'bard', 'cha', '「黎明」被重鑄成了一把細劍。揮動時會發出像晨鐘一樣的清響。'),
]
P3_MACH_ARMOR = [  # 伊格妮絲的機甲
    add(3, '半重', 'plate', 'fighter', 'save', '伊格妮絲把機偶的關節裝進了精金板甲裡，穿起來比普通的板甲輕一半。'),
    add(3, '千環無偏', 'chain', 'cleric', 'fai', '每一個環扣都是千爐工坊用模具壓出來的精金鍊甲，沒有一個環是歪的。'),
    add(3, '彈簧之躍', 'leather_armor', 'rogue', 'stealth', '龍皮外層、機偶彈簧內襯的皮甲，跳起來比平常高半個身子。'),
    add(3, '發條一推', 'monk_robe', 'monk', 'save', '魔織布裡縫進了細細的機偶發條，出拳的時候會幫你多推一把。'),
    add(3, '袖中齒輪', 'robe', 'wizard', 'int', '伊格妮絲替法師設計的魔織布長袍，袖子裡藏著一個小小的施法輔助齒輪。'),
    add(3, '不修的故障', 'leather_armor', 'bard', 'cha', '關節裡藏著一組小小的共鳴簧片的龍皮甲，走起路來會輕輕地哼出和聲。伊格妮絲說那是故障，她不打算修。'),
]
P3_GIANT_ARMOR = [  # 瑟爾・迷石的巨人武庫
    add(3, '巨人王之贈', 'plate', 'paladin', 'vs:priest,bishop', '巨人之嵴的武庫裡封存的精金板甲，原本是巨人王賜給矮人勇士的禮物。'),
    add(3, '古符千環', 'chain', 'fighter', 'initiative', '巨人鍛匠打的精金鍊甲，每一個環上都刻著一個古符。'),
    add(3, '改小三圈', 'leather_armor', 'barbarian', 'str', '用山巔的龍皮做的巨人皮甲，改小了三圈才穿得下。'),
    add(3, '山路皮圖', 'leather_armor', 'ranger', 'travel,road', '巨人的獵人穿的龍皮獵裝，裡面縫著一張刻在皮上的山路圖。'),
    add(3, '三千年無塵', 'monk_robe', 'monk', 'dex', '巨人的修行者穿的魔織布長袍，矮人說它在山裡放了三千年都沒有一點灰。'),
    add(3, '活苔', 'leather_armor', 'druid', 'trap', '巨人王的德魯伊穿過的龍皮甲，三千年來長滿了青苔，苔蘚到現在還活著。'),
]
P3_TREASURE = [  # 塔莉的「又一個神秘的寶藏」
    add(3, '最上層', 'ring_precision', 'fighter', 'initiative', '流沙底下那座沒有名字的寶庫裡，放在最上層的秘銀戒指。'),
    add(3, '無名戰士', 'amulet_iron', 'paladin', 'save', '寶庫的石棺裡，一具不知名的戰士的胸口掛著這枚秘銀護符。'),
    add(3, '自熱', 'navel_vigor', 'barbarian', 'retreat', '寶庫最深處的祭壇上，一枚自己在發熱的秘銀臍釘。'),
    add(3, '細繩之後', 'earring_hawk', 'ranger', 'trap', '寶庫的機關室裡，掛在一根細繩上的秘銀耳環——拿下來之前，最好先看清楚繩子連著什麼。'),
    add(3, '流沙慢歌', 'earring_calm', 'bard', 'cha', '寶庫的祭壇上一對秘銀耳墜，戴上之後，耳邊的流沙聲會變成一首很慢的歌。'),
]
P3_CHART = [  # 哈根船長的最後一張海圖
    add(3, '船長室的抽屜', 'ring_swift', 'rogue', 'travel,road', '海圖盡頭的沉船裡，船長室的抽屜裡找到的秘銀戒指。'),
    add(3, '不鏽船首', 'amulet_ward', 'cleric', 'save', '那艘沉船的船首像脖子上掛著的秘銀護符，海水泡了五十年也沒有生鏽。'),
    add(3, '星位紙條', 'pendant_mind', 'wizard', 'int', '沉船的航海士留下的秘銀項鍊，墜子裡夾著一張寫滿星位的紙條。'),
    add(3, '桅上奔跑', 'anklet_wind', 'monk', 'dex', '哈根年輕時的船友戴的秘銀腳鍊，據說他能在桅桿上跑。'),
    add(3, '永綠海草', 'pendant_poison', 'druid', 'trap', '船醫掛在脖子上的秘銀項鍊，墜子裡封著一撮從沒見過的海草。古船上什麼都爛了，只有它還是綠的。'),
]

# ---------------- 第四區間（Lv.16～18） ----------------
P4_ORE = [
    add(4, '同步心跳', 'longsword', 'fighter', 'initiative', '用三百年來第一塊交到地面的星心礦打的星隕鐵長劍。劍身裡有一顆星在跳，和握劍的人的心跳一樣快。'),
    add(4, '劈開大物', 'greataxe', 'barbarian', 'str', '古鍛匠們說，星心礦最想變成的就是一把巨斧——它想劈開一些很大的東西。'),
    add(4, '追不上的風', 'rapier', 'rogue', 'stealth', '星心礦拉成的細劍，細得像一道星光，刺出去的時候連風都追不上。'),
    add(4, '星之禱', 'warhammer', 'paladin', 'fai', '星心礦打成的戰鎚，鎚頭裡那顆星每敲一下就亮一次，像在替人禱告。'),
    add(4, '先見之箭', 'longbow', 'ranger', 'travel,road', '神木的弓臂，弓弦是星心礦拉成的細絲。拉滿的時候，箭尖會先看見目標。'),
    add(4, '拳中星光', 'wraps', 'monk', 'dex', '星輝織裡織進了星心礦的細屑，纏在拳頭上，每一拳都帶著一點星光。'),
    add(4, '星星的音高', 'rapier', 'bard', 'cha', '星心礦拉成的細劍，揮動時會響起一個很純的音。吟遊詩人說，那是星星的音高。'),
    add(4, '守門人名錄', 'mace', 'cleric', 'fai', '石誓會的祭司為星心礦祝聖之後打成的鎚矛，握柄上刻著三百年來守門騎士的名字。'),
    add(4, '草之朝向', 'quarterstaff', 'druid', 'trap', '兩端包著星心礦的神木長棍。插在地上的時候，周圍的草會朝它長過去。'),
    add(4, '與星對眨', 'spellstaff', 'wizard', 'int', '杖頭嵌著一整顆星心礦的神木法杖。夜裡把它立在窗邊，它會和天上的星星互相眨眼。'),
]
P4_CHURCH = [
    add(4, '白金七芒', 'plate', 'paladin', 'vs:priest,bishop', '聖環教廷的軍需庫裡，只有教皇的親衛才能穿的星隕鐵板甲，胸口嵌著白金的七芒星。'),
    add(4, '兩百年追獵', 'leather_armor', 'ranger', 'travel,road', '教廷的遊騎兵穿著它在邊境上追了兩百年的異端，古龍皮上燙著一圈聖環。'),
    add(4, '燭光金線', 'robe', 'cleric', 'fai', '樞機主教在大公會議上穿的星輝織長袍，七芒星的金線在燭光下會微微發亮。'),
    add(4, '環環禱詞', 'chain', 'fighter', 'initiative', '聖戰騎士團的鍊甲，每一個環上都刻著一句短短的禱詞。'),
    add(4, '劃掉的印記', 'leather_armor', 'barbarian', 'str', '教廷收編的北方戰士穿的古龍皮甲，背上烙著一個被劃掉的舊部族印記，旁邊是新的聖環。'),
    add(4, '不在這裡', 'leather_armor', 'rogue', 'stealth', '替教廷在夜裡處理不能公開的事的人穿的皮甲。軍需官把它放在最角落，說「它從來不在這裡」。'),
    add(4, '三百年擋拳', 'monk_robe', 'monk', 'save', '山上苦修院的武僧穿的星輝織長袍，袖口磨得發白，那是三百年來無數次擋拳留下的。'),
    add(4, '五線譜', 'leather_armor', 'bard', 'cha', '跟著聖戰軍唱聖詠的樂師穿的皮甲，胸口繡著一行五線譜。'),
    add(4, '不枯橡葉', 'leather_armor', 'druid', 'fai', '守護教廷聖林的德魯伊穿的皮甲，上面別著一片永遠不會枯的橡葉。'),
    add(4, '未還的借書單', 'robe', 'wizard', 'int', '教廷禁書庫的守書人穿的長袍，口袋裡還留著一張沒還的借書單。'),
]
P4_REDWING = [
    add(4, '血誓之環', 'chain', 'fighter', 'vs:noble,royal', '赤翼宮廷的近衛穿的星隕鐵鍊甲，每一個環都淬過魔王的血誓。'),
    add(4, '夜色深紅', 'leather_armor', 'rogue', 'stealth', '赤翼軍的斥候在荒原上穿的古龍皮甲，染成了和夜一樣深的紅色。'),
    add(4, '展翼', 'monk_robe', 'monk', 'save', '魔王身邊不帶武器的拳衛穿的星輝織武僧袍，背上繡著一對展開的赤翼。'),
    add(4, '翼下聖印', 'plate', 'paladin', 'vs:priest,bishop', '魔族裡少數信仰古神的騎士穿的星隕鐵板甲，胸口的聖印被赤翼包了起來。'),
    add(4, '爪痕勳章', 'leather_armor', 'barbarian', 'str', '赤翼軍最前排的狂戰士穿的皮甲，上面的爪痕從來沒有人修過——他們說那是勳章。'),
    add(4, '赤羽引路', 'leather_armor', 'ranger', 'travel,road', '在荒原上替赤翼軍打獵、帶路的獵手穿的皮甲，肩上縫著一根赤紅的羽毛。'),
    add(4, '宴會與戰場', 'leather_armor', 'bard', 'cha', '在魔王的宴會上演奏的樂師穿的皮甲，做得像禮服一樣漂亮，打起仗來也一樣結實。'),
    add(4, '暗紅祈禱', 'chain', 'cleric', 'fai', '替赤翼軍祈禱與治療的血祭司穿的鍊甲，環扣是暗紅色的。'),
    add(4, '最後的草籽', 'leather_armor', 'druid', 'trap', '枯萎荒原的巫者穿的皮甲，縫線裡夾著荒原上僅存的幾種草籽。'),
    add(4, '血羽結界', 'robe', 'wizard', 'int', '魔王的宮廷法師穿的星輝織長袍，下擺繡著整座血羽城堡的結界圖。'),
]
P4_VAULT = [
    add(4, '潮汐之璜', 'amulet_ward', None, 'save', '冬璃宮珍寶庫裡少了的那一件——潮汐之璜的另一半。兩半合在一起的時候，滄月闕的潮水停了一瞬。'),
    add(4, '月光之言', 'ring_guard', None, 'negotiation', '潮鏡台在滿月下照出的星辰石戒指，戴著它說的每一句話，都像月光一樣清楚。'),
    add(4, '最好的一刻', 'earring_calm', None, 'cha', '用潮鏡台的碎片磨成的星辰石耳墜，戴著它的人，在別人眼裡永遠是最好看的那一刻。'),
]
P4_PEACE = [  # 清剿主戰派的終章
    add(4, '未響之鐘', 'amulet_iron', None, 'save', '那一天大教堂的鐘沒有響。碎掉的聖戰之鐘的一片，被教皇親手鑲成了星辰石墜飾。'),
    add(4, '沒有打起的戰爭', 'ring_fortune', None, 'negotiation', '聖戰詔書被燒掉之前，你從封蠟上取下的星辰石戒指。它見證了一場沒有打起來的戰爭。'),
    add(4, '各出一半', 'earring_hawk', None, 'initiative', '人類與魔族的和約簽下那天，雙方各出一半的星辰石做成的耳環。'),
]
P4_WAR_H = [  # 開戰・人類方的終章
    add(4, '裂開的血誓', 'amulet_ward', None, 'save', '血誓碑谷的停戰之後，從裂開的血誓碑上剝下來的星辰石碎片。'),
    add(4, '金鷹凱旋', 'ring_precision', None, 'vs:noble,royal', '帝國為攻下血羽城堡的英雄打造的星辰石戒指，戒面刻著金色的帝國鷹。'),
    add(4, '配得上的人', 'navel_vigor', None, 'retreat', '血羽城堡的城下，一位赤翼的將領把它交給了你：「勝利的人，配得上它。」'),
]
P4_WAR_D = [  # 開戰・魔族方的終章
    add(4, '不破之門', 'amulet_iron', None, 'gate', '兩百年沒有被攻破過的萊茵堡，城門鑰匙被熔成了這枚星辰石墜子。'),
    add(4, '赤翼凱旋', 'ring_swift', None, 'initiative', '赤翼之君為攻下萊茵堡的人打造的星辰石戒指，戒面是一對展開的赤翼。'),
    add(4, '易主的金鷹', 'earring_hawk', None, 'vs:noble,royal', '帝國近衛軍統領的金鷹徽章，被你改成了一枚星辰石耳環。'),
]
P4_GAZE = [  # 阿契隆的注視
    add(4, '阿契隆的書籤', 'pendant_mind', None, 'int', '阿契隆的投影翻過的那本書裡，掉出來的一枚星辰石書籤。書籤上寫著你的名字。'),
    add(4, '萬代之憶', 'ring_guard', None, 'save', '裂縫深處的回響散去之後，留在你手心裡的星辰石指環。它記得每一個時代。'),
    add(4, '英雄的致意', 'earring_calm', None, 'cha', '回響的英雄們最後一次向你致意時，從空中落下的星辰石耳墜。'),
]

# ---------------- 第五區間（Lv.19～20）：巨龍投影的掉落 ----------------
P5 = {
    'drg_kagni': [add(5, '熾寂', 'greataxe', 'barbarian', 'str', '卡格尼的投影散去時留下的星隕鐵巨斧，一半燙得發白，一半冷得結霜。只有最強的野蠻人揮得動它。'),
                  add(5, '兩極', 'longsword', 'fighter', 'initiative', '熾與寂在一把劍裡打了一千年的架，最後誰也沒贏。戰士握著它，兩邊都會聽話。')],
    'drg_sinor': [add(5, '真名', 'dagger', 'rogue', 'stealth', '希諾爾的投影的真名凝成的星隕鐵匕首。刺中的東西，會在那一瞬間忘記自己是誰。'),
                  add(5, '迷言', 'rapier', 'bard', 'cha', '希諾爾的謎語凝成的細劍，揮動時會說出一句沒有人聽得懂、所有人都記得住的話。')],
    'drg_sorian': [add(5, '千年之夢', 'spellstaff', 'wizard', 'int', '索利安做了一千年的夢，最後一個夢醒來的時候，變成了這根神木法杖。'),
                   add(5, '倒懸之林', 'quarterstaff', 'druid', 'fai', '精靈千年的夢裡，倒懸的森林最深處的一根神木枝。拿著它的德魯伊，聽得見每一棵樹在做什麼夢。')],
    'drg_babelin': [add(5, '最後一塊磚', 'warhammer', 'paladin', 'fai', '巴別林的塔頂最後一塊磚，被你一擊打碎之後重鑄成的星隕鐵戰鎚。它還想再往上長。'),
                    add(5, '登頂者', 'wraps', 'monk', 'dex', '爬上不停長高的巨塔的人，拳頭上纏的星輝織。塔停止長高的那一刻，它亮了起來。')],
    'drg_acheron': [add(5, '闔上的史冊', 'mace', 'cleric', 'fai', '阿契隆的投影翻完最後一頁時，書本闔上變成的星隕鐵鎚矛。每一擊都寫進了歷史。'),
                    add(5, '千年回響', 'longbow', 'ranger', 'dex', '千年的回響裡所有英雄的弓弦，最後只剩下這一把神木長弓。射出去的箭，會在每一個時代都命中一次。')],
}

# 沒有職業的飾品（P4 的政治史詩、寶庫）用底材的附魔，屬性加在最常用的「力量／靈巧／智力／信仰／魅力」裡挑一個
FREE_ATTR = {'潮汐之璜': 'fai', '月光之言': 'cha', '最好的一刻': 'cha', '未響之鐘': 'fai', '沒有打起的戰爭': 'cha', '各出一半': 'dex',
             '裂開的血誓': 'str', '金鷹凱旋': 'str', '配得上的人': 'str', '不破之門': 'str', '赤翼凱旋': 'dex', '易主的金鷹': 'dex',
             '阿契隆的書籤': 'int', '萬代之憶': 'fai', '英雄的致意': 'cha'}


def build_items():
    out = []
    for band, name, base, cls, code, desc in ITEMS:
        it = item_json(band, name, base, cls, code, desc)
        if cls is None: it['gear']['attrs'] = {FREE_ATTR[name]: 2}
        out.append(it)
    return out


NAMES = [i[1] for i in ITEMS]
assert len(set(NAMES)) == len(NAMES)


def reward(name):
    return {"type": "item", "name": name, "qty": 1}


# 政治史詩：完成的結果改成「論功行賞」，再三選一
SPOILS = {'pol_peace_crusade': P4_PEACE, 'pol_war_h_bloodplume': P4_WAR_H, 'pol_war_d_rhineburg': P4_WAR_D, 'pol_acheron_gaze': P4_GAZE}
SPOILS_TEXT = {
    'pol_peace_crusade': ('論功行賞：教皇的謝禮', '大教堂的鐘樓下，教皇格里高利七世親手捧出三件東西：「主戰派清剿乾淨了，這場戰爭沒有打起來。教廷欠你的，比這三件東西多得多——可是你只能挑一件。」'),
    'pol_war_h_bloodplume': ('論功行賞：帝國的謝禮', '停戰的條件談完了，帝國的使節把三件戰利品擺在你面前：「宰相大人說，攻下血羽城堡的人可以先挑。只能挑一件——剩下的要分給戰死的人的家屬。」'),
    'pol_war_d_rhineburg': ('論功行賞：赤翼之君的謝禮', '萊茵堡的城牆上換上了赤翼的旗幟。薇洛妮卡捧著一個黑紅色的匣子走來：「陛下說，攻下萊茵堡的人，可以從這三件裡挑一件。」'),
    'pol_acheron_gaze': ('阿契隆留下的東西', '裂縫深處的回響一層一層地散去，阿契隆的眼睛閉上之前，有三樣東西從空中落了下來，懸在你面前。你只來得及抓住其中一樣。'),
}
SPOILS_PICK = {
    '未響之鐘': '「這一片鐘」', '沒有打起的戰爭': '「詔書的封蠟」', '各出一半': '「和約的耳環」',
    '裂開的血誓': '「裂開的血誓」（守護護符）', '金鷹凱旋': '「勝利之戒」', '配得上的人': '「配得上的人」（活力臍釘）',
    '不破之門': '「城門的鑰匙」', '赤翼凱旋': '「凱旋之戒」', '易主的金鷹': '「金鷹」',
    '阿契隆的書籤': '抓住書籤', '萬代之憶': '抓住指環', '英雄的致意': '抓住耳墜',
}


def outs(n):
    r = [n.get('success'), n.get('fail')]
    for o in n.get('options', []): r += [o.get('success'), o.get('fail')]
    return [o for o in r if o]


def place_gear(batch):
    by = {s['id']: s for s in batch}
    # 第一、二區間：完成獎勵
    for table in (B1, B2):
        for sid, name in table.items():
            st = by[sid]
            assert st['start'].get('min_level') in ((5,) if table is B1 else (8, 11)), sid
            assert 'adult' not in (st.get('tags') or []), sid
            st.setdefault('rewards', []).append(reward(name))
    # 第四區間：政治史詩的論功行賞
    for sid, items in SPOILS.items():
        st = by[sid]
        flag = f'{sid}_spoils'
        last = None
        for n in st['nodes']:
            for o in outs(n):
                if o.get('complete'):
                    del o['complete']
                    o.setdefault('set_flags', []).append(flag)
                    last = n
        assert last, sid
        title, text = SPOILS_TEXT[sid]
        st['nodes'].append({
            "id": "spoils", "title": title, "text": text, "at": dict(last['at']), "requires": {"flags": [flag]}, "kind": "choice",
            "options": [{"label": SPOILS_PICK[name], "success": {"text": f"你收下了「{name}」。", "effects": [reward(name)], "complete": True}} for name in items],
        })
    # 第五區間：巨龍投影的掉落（打倒投影的那一戰）
    for sid, items in P5.items():
        st = by[sid]
        n = next(n for n in st['nodes'] if n['id'] == 'dragon')
        assert n['kind'] == 'combat', sid
        n['success'].setdefault('effects', []).extend(reward(x) for x in items)
        n['success']['text'] += f"投影散去的地方，留下了兩件發著光的武器：「{items[0]}」與「{items[1]}」。"


def write_items():
    P = R + 'data/rules/items.json'
    lines = open(P).read().split('\n')
    names = set(NAMES)
    keep = [l for l in lines if not any(f'"name": "{n}"' in l for n in names)]
    anchor = next(i for i, l in enumerate(keep) if '"name": "吊帶舞孃的吊襪內褲"' in l)
    new = ['    ' + json.dumps(it, ensure_ascii=False) + ',' for it in build_items()]
    out = '\n'.join(keep[:anchor + 1] + new + keep[anchor + 1:])
    data = json.loads(out)
    assert len([i for i in data['items'] if i['name'] in names]) == len(NAMES)
    open(P, 'w').write(out)
    print('quest gear', len(NAMES))


if __name__ == '__main__':
    write_items()
