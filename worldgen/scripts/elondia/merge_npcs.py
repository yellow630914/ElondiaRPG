"""把 elondia-plus 的 85 位固定 NPC 併進內建 data/world/npcs.json，套用作者的修改並加上新角色。"""
import json, re, sys

ROOT = '.'
EP = f'{ROOT}/worldgen/worlds/elondia-plus/parts'
OUT = f'{ROOT}/data/world/npcs.json'

base = json.load(open('worldgen/scripts/elondia/npcs.before.json'))
builtin = {n['id']: n for n in base['npcs']}

geo = json.load(open(f'{ROOT}/data/world/geography.json'))
FACTION_IDS = {f['name']: f['id'] for f in geo['factions']}

REGIONS = ['central', 'north', 'south', 'forest', 'east', 'west']
plus = []
for r in REGIONS:
    d = json.load(open(f'{EP}/npcs-{r}.json'))['npcs']
    plus += list(d.values()) if isinstance(d, dict) else d

def nid(i):
    return 'npc_' + i[len('mod_npc_'):] if i.startswith('mod_npc_') else i

merged = {}
for x in plus:
    x = json.loads(json.dumps(x))
    x['id'] = nid(x['id'])
    x.pop('custom', None)
    if x.get('faction'):
        f = FACTION_IDS.get(x['faction'])
        if f: x['faction'] = f
        else: x.pop('faction')
    if x.get('relations'):
        x['relations'] = {nid(k): v for k, v in x['relations'].items()}
    if x['id'] in builtin:
        # 內建的角色：保留內建的設定，只補上世界包加的關係
        b = builtin[x['id']]
        rel = dict(b.get('relations') or {})
        for k, v in (x.get('relations') or {}).items(): rel.setdefault(k, v)
        b['relations'] = rel
        continue
    merged[x['id']] = x

# ---------------------------------------------------------------- 刪掉
merged.pop('npc_adelaide_ii')

def edit(i, **kw):
    n = merged.get(i) or builtin[i]
    for k, v in kw.items():
        if v is None: n.pop(k, None)
        else: n[k] = v
    return n

def rel(i, **kw):
    n = merged.get(i) or builtin[i]
    r = n.setdefault('relations', {})
    for k, v in kw.items():
        if v is None: r.pop(k, None)
        else: r[k] = v

# ---------------------------------------------------------------- 萊茵堡
edit('npc_otto_iii', **{
    'class': 'fighter', 'level': 5, 'tags': ['royal'],
    'requires': {'flags': ['rhine_emperor_seen']},
    'haunts': [{'location': 'rhineburg', 'zone': 'palace', 'weight': 1}],
    'personality': '溫吞、隨和，說話慢條斯理，對政治提不起勁，一談到花就停不下來；其實聰明得可怕，聽三句話就能看穿局勢，卻寧願回溫室替玫瑰剪枝。',
    'appearance': '五十多歲、其貌不揚的中年男人，身材微胖、頭髮稀疏，戴著舊草帽、穿沾滿泥土的園丁圍裙，指甲縫裡總有土；站在宮廷侍從中間，沒有人會多看他一眼。',
    'background': '萊茵帝國皇帝，已經多年沒有在公眾場合露面，署名的敕令卻一道道從皇宮發出，每一道都英明得令人生畏：與魔族的停戰是他一手促成，人類面對魔族的邊疆大半也由帝國把守，帝國如今如日中天。所有人都對這位看不見的皇帝又敬又畏；只有獨生女艾蕾諾拉知道，父親是個非常聰明、卻只喜歡在皇宮深處的溫室裡種花的普通人，劍術也只是普通人的水準。',
    'gear': {'body': {'base': 'shirt', 'material': 'linen'}, 'head': {'base': 'wide_hat', 'material': 'linen'}},
})
rel('npc_otto_iii',
    npc_eleanora_rhine='獨生女。敕令是他在溫室裡隨口說的，把它們變成帝國的是她。',
    npc_pope_gregory='老教皇。他知道對方在怕什麼，也知道對方想要什麼。')
edit('npc_eleanora_rhine',
    personality='冷靜、一絲不苟，說話永遠留三分；外人以為她才是帝國真正的掌權者，其實她只是照著父親的敕令把事情辦好——而且辦得無可挑剔。私底下最怕父親又忘了吃飯。',
    background='奧托三世的獨生女、帝國宰相，在法師學院以第一名畢業，卻選擇了政治。父親多年不露面，敕令都經她的手頒布，帝國的外交、密探、財政與大大小小的庶務也都由她處理；她是唯一見得到皇帝的人，也是唯一知道皇帝真面目的人。')
rel('npc_eleanora_rhine',
    npc_otto_iii='父親。全帝國只有她知道他每天在溫室裡做什麼，也只有她知道那些敕令是怎麼來的。',
    npc_brunhild='第一軍團將軍；話少，命令交給她最放心。',
    npc_leonhart='第二軍團將軍；太想打仗，得看緊。',
    npc_wolfgang='第三軍團將軍；父親說停戰能不能撐下去，要看這頭老狼。',
    npc_rosalind='第四軍團將軍；她的棋下得太遠，遠到連宰相都看不見終點。')

# ---------------------------------------------------------------- 索里耶爾
edit('npc_pope_gregory',
    background='出身沒落的小貴族，四十年前以見習修士入教廷，一路爬到教皇之位，與那位多年不露面的萊茵皇帝為了「誰才是人類的合法權威」明爭暗鬥，表面上卻總是互相祝福。他本人並不是人類至上主義者，卻知道這份信念是教廷存在的基石。帝國漸漸脫離教廷的掌控、又與魔族停戰，讓他憂心忡忡，同時也讓他第一次覺得：這或許是改變教廷的機會。')
rel('npc_pope_gregory',
    npc_otto_iii='多年不見的老對手；他越來越看不懂那些敕令背後到底是什麼人。',
    npc_anastasia='晨曦教區的樞機主教，太聰明，聰明到讓他不安。')

# ---------------------------------------------------------------- 晨光城
for i, name in [('npc_anastasia', '安納塔西亞'), ('npc_alexei', '阿列克謝'), ('npc_alexander', '亞歷山大')]:
    builtin[i]['name'] = name
builtin['npc_anastasia']['background'] = '全名羅曼諾夫・安納塔西亞・瓦伊凡。晨曦王國的公主，現任國王亞歷山大與一名精靈妃子所生。二十多歲時就當上聖環教廷晨曦王國教區的樞機主教，在位十幾年，外表依然年輕，政治手腕卻越發老辣；王城與教廷之間的許多事，都要經過她的手。她常往返教國與王國之間。'
builtin['npc_alexei']['background'] = '全名羅曼諾夫・阿列克謝・瓦伊凡。晨曦王國的嫡皇子，王位的正統繼承人，也是一名強大的騎士。年輕時就開始為接班培養自己的班底，但父王遲遲不肯退位、身體又還硬朗，這一等就等到快五十歲。最近父王又刻意抬舉擔任樞機主教的妹妹，讓他起了異心。'
builtin['npc_alexander']['background'] = '全名羅曼諾夫・瓦伊凡・亞歷山大。晨曦王國的國王，年輕時是一名偉大的騎士，曾多次親赴前線與魔族作戰，至今仍有老兵傳唱他的戰績。坐上王位幾十年，越發捨不得放手，遲遲不肯讓位給嫡皇子阿列克謝，甚至暗中栽培當上樞機主教的女兒安納塔西亞來制衡他。最近卻總是昏昏沉沉，御醫說只是年紀大了。'
rel('npc_anastasia', npc_lorenzo_valois='堂兄公爵，王位的鑰匙；她知道他想被捧多高。', npc_pope_gregory='教皇。她的上司，也是她最想看穿的人。', npc_eleanor_dawn='晨曦聖殿的大祭司；太正直，所以好用，也所以麻煩。')
rel('npc_alexei', npc_lorenzo_valois='堂弟公爵；拉攏到他，王冠就是自己的。')
rel('npc_alexander', npc_lorenzo_valois='姪子；兩個孩子都在拉攏他，他樂見其成。')
edit('npc_lorenzo_valois',
    tags=['noble'],
    personality='優雅、風趣，對每個人都和善得過分；精於計算，最擅長待價而沽。誰也不拒絕、誰也不答應，享受被兩邊捧著的感覺。',
    background='公爵、宮廷首席法師，王國貴族派的領袖，國王的姪子。國王遲遲不肯讓位，他手上的貴族支持就成了決定下一任國王的砝碼——拉攏到他的一方就能登基。宮廷裡一半的流言都從他的沙龍傳出。',
    relations={
        'npc_alexander': '叔父。老獅子還沒倒下，他就不急著選邊。',
        'npc_alexei': '堂兄，給得起軍權。',
        'npc_anastasia': '堂妹，給得起教廷。',
    })
rel('npc_eleanor_dawn', npc_anastasia='教區的樞機主教，她的上司；她不認同她把信仰當成政治的籌碼。')
merged['npc_sean_minstrel']['background'] = merged['npc_sean_minstrel']['background'].replace('獻給女王的歌', '獻給國王的歌')

# ---------------------------------------------------------------- 阿爾貝納
edit('npc_constance_wagner',
    background='七議席議會本屆輪值首席，壟斷聯邦的金融：銀行、匯兌與鑄幣都握在她手裡。她在風誓塔頂立下的「公正誓約」，是她最在意的東西。')
rel('npc_constance_wagner', npc_ignaz_goldscale='議員。他的商路需要她的錢，她的錢需要他的商路。', npc_matilda_rosen='議員。年輕、聰明，聰明得不懂得收斂。')
edit('npc_ignaz_goldscale',
    background='議員、聯邦最大商行的老闆，壟斷聯邦的陸路商路：商隊、倉儲與關稅包稅都要經過他。他暗中資助了好幾支冒險者隊伍和傭兵團，換取他們帶回來的情報和遺物。')
rel('npc_ignaz_goldscale', npc_constance_wagner='議會首席，最難纏的債主。', npc_matilda_rosen='議員。他以為她是個好擺布的小姑娘，到現在還這麼以為。')

# ---------------------------------------------------------------- 南境
edit('npc_veronica',
    personality='笑裡藏刀、說話甜得發膩，替莉莎爾處理所有不能讓人看見的事；其實是過勞的工作狂，南境各族的陳情書堆得比她還高，最想要的是一個能幹的助手。')
edit('npc_noctis',
    personality='木訥、不擅言辭，一開口就冷場，所以乾脆不說話；外人以為她神秘莫測、話只說一半，其實只是不知道該說什麼。暗戀莉莎爾多年，連一句問候都說不出口。',
    background='暗影氏族（虛影氏族）之主，議會的情報與暗殺網之首，傳說她能行走於夢與實之間。她支持莉莎爾，沒有人知道那是因為忠誠還是因為有利可圖——其實只是因為喜歡。每天的情報都由她親手送到莉莎爾的桌上，送完就消失。')
rel('npc_noctis', npc_lisar='暗戀多年的人。情報可以送到她桌上，心意卻送不出去。')
rel('npc_lisar', npc_noctis='她的眼睛與耳朵；讀不懂這個沉默的部下到底在想什麼。')
edit('npc_morphe',
    personality='恍惚、詩意，說的話一半是預言一半是囈語；嚴重缺乏睡眠——每次睡著都會掉進別人的夢裡加班，醒來比睡前更累。',
    background='夢魘迷堂的幻術師，以幻術折疊神殿。據說夢境之龍索利安曾在迷堂裡現身，而莫菲是唯一記得那個夢的人。自從那之後，莫菲就再也沒有好好睡過一覺。')
rel('npc_ulma_bloodtrial', npc_bruk='四天王之一，最弱的那個，卻是最常來試煉場的。', npc_saka='四天王之一，吵架從沒輸過。', npc_gorr='四天王之首；她只承認他比自己強。')
edit('npc_ulma_bloodtrial', background='鮮血試煉場的場主，血角「四天王」之一，新月時主持血祭。她說只要能在試煉場站到最後，連人類都可以成為血角的戰士。')
rel('npc_grom_shatterhorn', npc_gorr='他的斧頭', npc_saka='他的舌頭', npc_bruk='他最愛逗的小子')

# ---------------------------------------------------------------- 東海
edit('npc_coral_miko', name='澪',
    personality='安靜、敏感、有點天然，聽得懂海浪的話；說話說到一半常常停下來聽海，然後忘了剛剛在說什麼。',
    background='珊瑚灣鎮海靈祠的巫女，侍奉海靈與風母，鎮上的人都叫她「珊瑚巫女」。她說潮隕洞窟深處的海靈最近變得很不安，夢裡總有一個怎麼也看不清的影子。')

# ---------------------------------------------------------------- 新角色
H = lambda *a: [{'location': l, 'zone': z, 'weight': w} for l, z, w in a]

new = [
    # ---- 萊茵堡：四軍團的將軍
    dict(id='npc_brunhild', name='布倫希爾德・馮・霍斯特', gender='female', race='human', **{'class': 'fighter'}, level=13, location='rhineburg', hire_cc=0, unhireable=True, no_attack=True, no_steal=True,
         kind='adventurer', tags=['noble'], faction='rhine_empire',
         haunts=H(('rhineburg', 'noble', 0.6), ('rhineburg', 'palace', 0.6), ('rivervale', 'town', 0.3), ('windhammer', 'town', 0.2)),
         personality='沉默、怕生，被人盯著看就會臉紅，說話結結巴巴；上了戰場卻冷靜得像北境的冰。看過太多凍死在雪地裡的士兵，比誰都不想打仗。最大的嗜好是甜食。',
         appearance='身高超過兩公尺的高大女將，冰藍色長髮編成一條粗辮，肩寬手長，一身厚重的霜白色板甲；臉卻意外地稚氣，常常躲在頭盔後面。',
         background='人稱「霜盾」，第一軍團將軍，鎮守帝國北境，與矮人氏族和山民部落打交道多年。三十歲出頭就當上將軍，部下說她一年講的話不超過一百句，卻沒有一個兵願意離開她的軍團。在四將軍的軍議上是主和派，只是常常插不上話。',
         gear={'main_hand': {'base': 'longsword', 'material': 'mithril'}, 'body': {'base': 'plate', 'material': 'mithril'}, 'feet': {'base': 'sabatons', 'material': 'steel'}},
         relations={'npc_leonhart': '吵死了。但他的兵練得很好。', 'npc_wolfgang': '敬重的前輩；她不懂他為什麼能恨得那麼久。', 'npc_rosalind': '看不透的人，下棋從來沒贏過她。'}),
    dict(id='npc_leonhart', name='雷歐哈特・馮・艾斯特', gender='male', race='human', **{'class': 'paladin'}, level=12, location='rhineburg', hire_cc=0, unhireable=True, no_attack=True, no_steal=True,
         kind='adventurer', tags=['noble'], faction='rhine_empire',
         haunts=H(('rhineburg', 'noble', 1), ('rhineburg', 'palace', 0.5), ('rhineburg', 'town', 0.3)),
         personality='自信過剩、愛出風頭，說話像在演講，動不動就把「榮耀」掛在嘴邊，渴望一場能讓自己名留青史的大戰；對部下卻出奇地體貼，記得每一個傷兵的名字。',
         appearance='二十多歲的金髮美男子，髮型永遠一絲不亂，金邊板甲配上鮮紅披風，胸甲上浮雕著一頭咆哮的獅子。',
         background='人稱「金獅」，第二軍團將軍，鎮守帝國西境，面對古樹森林與西部荒野。名門艾斯特家的天才，二十五歲就當上將軍，是帝國最年輕的軍團長。西境多年無戰事，讓他覺得自己的劍在生鏽；他是四將軍裡聲音最大的主戰派，主張趁停戰期間整軍，一口氣把魔族趕回荒原深處。',
         gear={'main_hand': {'base': 'longsword', 'material': 'mithril'}, 'body': {'base': 'plate', 'material': 'mithril'}, 'feet': {'base': 'sabatons', 'material': 'steel'}},
         relations={'npc_brunhild': '北境的冰山；他一直想讓她一次說超過三句話。', 'npc_wolfgang': '主戰派的盟友；崇拜他的戰績，卻總被他當成毛頭小子。', 'npc_rosalind': '笑裡藏刀的女人，他最討厭和她下棋。'}),
    dict(id='npc_wolfgang', name='沃爾夫岡・克勞澤', gender='male', race='human', **{'class': 'fighter'}, level=14, location='rhineburg', hire_cc=0, unhireable=True, no_attack=True, no_steal=True,
         kind='adventurer', tags=[], faction='rhine_empire',
         haunts=H(('rhineburg', 'noble', 0.5), ('rhineburg', 'palace', 0.4), ('soriel', 'outskirts', 0.5), ('soriel', 'town', 0.3)),
         personality='沉默寡言、冷硬，從不笑，對魔族有刻骨的恨，說話只有命令句；但每年都親自把撫卹金送到陣亡同袍的遺孀與孤兒手上。',
         appearance='五十多歲的獨眼老將，灰白短髮，臉上縱橫著舊傷，穿著滿是刀痕、從不更換的舊鋼甲，背著一把厚重的長劍。',
         background='人稱「灰狼」，第三軍團將軍，鎮守南境與魔族對峙的最前線。平民出身，從小兵一路打上來；年輕時一場魔族夜襲奪走了他的妻兒與一隻眼睛。他服從皇帝的停戰敕令，卻從不相信停戰，第三軍團至今仍維持戰時編制，是帝國最精銳也最好戰的軍團。',
         gear={'main_hand': {'base': 'longsword', 'material': 'adamantine'}, 'body': {'base': 'plate', 'material': 'steel'}, 'feet': {'base': 'sabatons', 'material': 'steel'}},
         relations={'npc_leonhart': '沒見過血的貴族小鬼，但劍是真的快。', 'npc_brunhild': '北境沒有魔族，她不會懂。', 'npc_rosalind': '在南境並肩駐守的同僚；他知道她在打阿爾貝納的主意。'}),
    dict(id='npc_rosalind', name='羅莎琳德・馮・貝格', gender='female', race='human', **{'class': 'wizard'}, level=12, location='rhineburg', hire_cc=0, unhireable=True, no_attack=True, no_steal=True,
         kind='adventurer', tags=['noble'], faction='rhine_empire',
         haunts=H(('rhineburg', 'noble', 0.6), ('rhineburg', 'palace', 0.4), ('albena', 'town', 0.5), ('albena', 'noble', 0.3)),
         personality='笑咪咪、溫文有禮，說話輕聲細語，把每個人都當成棋盤上的棋子；最愛下棋，從沒輸過。認為和魔族開戰是蠢事，真正該拿下的是近在眼前、富得流油的阿爾貝納。',
         appearance='三十歲上下的女法師，銀白短髮、戴細框眼鏡，穿剪裁合身的帝國軍官大衣，指間總把玩著一枚白色的棋子。',
         background='人稱「白棋」，第四軍團將軍，與第三軍團分守南境，駐紮在通往阿爾貝納的南方丘陵。她以兵棋推演聞名，打過的仗都在開打前就已經結束了。她在軍議上支持停戰，私下卻推動一套「保護」奧德聯邦的方案——在她的棋盤上，阿爾貝納早就是帝國的一部分了。',
         gear={'main_hand': {'base': 'spellstaff', 'material': 'elderwood'}, 'body': {'base': 'long_coat', 'material': 'moonsilk'}},
         relations={'npc_wolfgang': '南境的老狼；只要他還在前線，停戰就隨時可能破裂。', 'npc_leonhart': '最好擺布的棋子。', 'npc_brunhild': '唯一看不懂她在想什麼、也不在乎的人，所以她反而喜歡她。', 'npc_constance_wagner': '阿爾貝納的錢袋，棋盤上最重要的一顆子。'}),

    # ---- 阿爾貝納：第三位議員
    dict(id='npc_matilda_rosen', name='瑪蒂爾達・羅森', gender='female', race='human', **{'class': ''}, level=6, location='albena', hire_cc=0, no_steal=True,
         kind='commoner', tags=['noble', 'merchant'], occupation='議員', faction='aude_federation',
         haunts=H(('albena', 'noble', 1), ('albena', 'town', 0.5)),
         personality='笑容甜美、說話天真，看起來像個不懂事的千金；其實精明狠辣，簽下的每一份契約都埋著陷阱，最喜歡看老議員被她的「天真」問題噎住。',
         appearance='二十二歲的年輕女子，蜂蜜色捲髮繫著大蝴蝶結，穿荷葉邊的華麗洋裝，懷裡總抱著一隻白色小狗；手上的戒指其實是議會的契約印章。',
         background='七議席議會的議員，三年前繼承亡父的議席，壟斷聯邦的人力：傭兵團的雇傭合約、勞務契約與奴隸買賣的牌照都要經過她的商會。老議員們原以為她只是個傀儡，直到她用一份合約讓兩家老商行在一夜之間破產。',
         gear={'body': {'base': 'gown', 'material': 'silk'}, 'feet': {'base': 'heels', 'material': 'silk'}},
         relations={'npc_constance_wagner': '老派的銀行家；她的金庫是瑪蒂爾達最想要的東西。', 'npc_ignaz_goldscale': '胖叔叔，最好騙的老狐狸。'}),

    # ---- 河谷鎮：冒險者
    dict(id='npc_rein', name='雷恩', gender='male', race='human', **{'class': 'fighter'}, level=5, location='rivervale', hire_cc=535,
         kind='adventurer', tags=['traveler', 'good'],
         haunts=H(('rivervale', 'town', 1), ('rivervale', 'outskirts', 0.4), ('dawnlight', 'town', 0.2), ('soriel', 'town', 0.2)),
         personality='熱血、天真、中二，自稱「被選中的勇者」，見到不平的事一定出手；實力普普通通，運氣卻好得離譜，每次都在最後關頭莫名其妙地贏。',
         appearance='二十歲的黑髮青年，頭髮亂翹，額前綁著一條紅色頭巾，背著一把太大的雙手劍，皮甲上貼滿補丁。',
         background='從河谷鎮附近的農村出來的年輕冒險者，因為手背上有一塊像劍的胎記，堅信自己是傳說中的勇者，組了「曙光勇者團」要去打倒魔王——雖然魔族早就停戰了。',
         gear={'main_hand': {'base': 'longsword', 'material': 'steel'}, 'body': {'base': 'leather_armor', 'material': 'leather'}, 'feet': {'base': 'boots', 'material': 'leather'}},
         relations={'npc_lulu': '青梅竹馬，團裡的魔法師；他一直以為她是被自己的勇者魅力吸引來的。', 'npc_brynn': '團裡的牧師，最可靠的夥伴。'},
         squad={'name': '曙光勇者團', 'members': ['npc_lulu', 'npc_brynn'], 'together': 0.9}),
    dict(id='npc_lulu', name='露露', gender='female', race='human', **{'class': 'wizard'}, level=5, location='rivervale', hire_cc=535,
         kind='adventurer', tags=['traveler'],
         haunts=H(('rivervale', 'town', 1), ('rivervale', 'outskirts', 0.4)),
         personality='毒舌、傲嬌、嘴上永遠在嫌雷恩蠢，卻每次都跟著他衝；怕蟲怕到會尖叫著放出火球。',
         appearance='二十一歲的嬌小女法師，栗色雙馬尾，戴著一頂大得遮住眼睛的尖帽，法袍下擺被自己的火球燒出一圈焦痕。',
         background='雷恩的青梅竹馬，村裡唯一有魔法天賦的孩子。她說自己加入勇者團只是「怕那個笨蛋死在外面」，但每晚都會偷偷替他縫補斗篷。',
         gear={'main_hand': {'base': 'spellstaff', 'material': 'oak'}, 'body': {'base': 'robe', 'material': 'linen'}},
         relations={'npc_rein': '笨蛋。她的笨蛋。', 'npc_brynn': '團裡唯一能讓她安心的大姐姐。'}),
    dict(id='npc_brynn', name='布琳', gender='female', race='dwarf', **{'class': 'cleric'}, level=4, location='rivervale', hire_cc=400,
         kind='adventurer', tags=['traveler', 'priest'],
         haunts=H(('rivervale', 'town', 1), ('rivervale', 'outskirts', 0.4)),
         personality='溫柔、慢條斯理、總是笑咪咪的；一旦有人欺負隊友，就會笑著舉起比自己還大的戰鎚。',
         appearance='一百三十公分的女矮人，紅銅色長辮盤在頭上，圓臉上帶著酒窩，身上的鎖甲擦得發亮，背著一把巨大的戰鎚。',
         background='銅鬚氏族出身的牧師，五十多歲（以矮人來說還很年輕），出來修行時被雷恩的熱血打動，成了勇者團的保母。她說自己只是在「看著兩個孩子長大」。',
         gear={'main_hand': {'base': 'warhammer', 'material': 'steel'}, 'body': {'base': 'chain', 'material': 'iron'}},
         relations={'npc_rein': '愛逞強的孩子，她會看著他。', 'npc_lulu': '嘴硬的孩子，她也會看著她。'}),
    dict(id='npc_gero', name='傑洛', gender='male', race='human', **{'class': 'ranger'}, level=12, location='rivervale', hire_cc=2040,
         kind='adventurer', tags=['traveler'],
         haunts=H(('rivervale', 'town', 1), ('rivervale', 'outskirts', 0.3)),
         personality='懶散、愛喝酒、總是一副睡不飽的樣子，自稱「萬年 C 級」；嘴上嫌麻煩，卻會不動聲色地救下每一個太衝的新人。',
         appearance='四十多歲的鬍渣大叔，灰褐亂髮，穿著舊得看不出顏色的斗篷，背上的長弓卻保養得一塵不染。',
         background='在河谷鎮的酒館混了十年的冒險者，公會登記是 C 級，接的都是採藥、送信這種小委託。沒有人知道他曾經是 A 級隊伍的弓手——那支隊伍在一次遠征中只剩他一個人回來。',
         gear={'main_hand': {'base': 'longbow', 'material': 'elderwood'}, 'body': {'base': 'leather_armor', 'material': 'beast_hide'}},
         relations={'npc_rein': '讓他想起以前的隊長，所以總是忍不住多看兩眼。', 'npc_greta_silverscale': '酒錢欠了十年的老闆娘。'}),

    # ---- 沿海渡口
    dict(id='npc_marina', name='瑪琳娜', gender='female', race='human', **{'class': 'fighter'}, level=6, location='coast_ferry', hire_cc=690,
         kind='adventurer', tags=['traveler'],
         haunts=H(('coast_ferry', 'town', 1), ('coast_ferry', 'outskirts', 0.3), ('tidehaven', 'town', 0.2)),
         personality='熱血、樂天、說大話不打草稿，自稱「未來的大海賊……不對，大航海家」；欠了一屁股債也笑得出來，對夥伴講義氣到傻。',
         appearance='二十四歲的女劍士，曬得黝黑，紅色短髮上壓著一頂太大的船長帽，腰間掛著一把彎刀，襯衫袖子永遠捲到肩膀。',
         background='沒有船的船長。她的船「海燕號」因為欠債被債主扣在沿海渡口，她每天都在碼頭和酒館招募船員、接委託還債，夢想有一天開著自己的船去找傳說中的島。',
         gear={'main_hand': {'base': 'scimitar', 'material': 'steel'}, 'body': {'base': 'shirt', 'material': 'linen'}, 'feet': {'base': 'boots', 'material': 'leather'}},
         relations={'npc_bruno_ferry': '一起欠債的賭友，也是唯一肯借她船開的人。', 'npc_helen_lighthouse': '總是罵她冒失的婆婆，但每次出海前都會去問她天氣。'}),

    # ---- 獸骨荒丘：血角四天王
    dict(id='npc_bruk', name='布魯克', gender='male', race='demon', **{'class': 'barbarian'}, level=8, location='bone_hills', hire_cc=0, unhireable=True,
         kind='adventurer', tags=[], lineage='獸人（血角氏族）', faction='demon_council',
         haunts=H(('bone_hills', 'town', 1)),
         personality='嘴硬、愛吹牛、輸不起，每次被打倒都會說「哼，我可是四天王中最弱的」；其實很照顧部族裡的小孩，打架從不打臉。',
         appearance='獸人裡個子最小的戰士，灰綠色皮膚，一對短角上綁著紅繩，手裡的雙刃斧比他的人還寬。',
         background='血角「四天王」之一，公認最弱的那個。他說自己是故意墊底，好讓挑戰者先熱身；但他每天都在試煉場加練到最晚。',
         gear={'main_hand': {'base': 'greataxe', 'material': 'iron'}},
         relations={'npc_grom_shatterhorn': '酋長，他最崇拜的人。', 'npc_ulma_bloodtrial': '四天王之一，常常把他摔出試煉場。'}),
    dict(id='npc_saka', name='「鐵舌」薩卡', gender='female', race='demon', **{'class': 'bard'}, level=11, location='bone_hills', hire_cc=0, unhireable=True,
         kind='adventurer', tags=[], lineage='獸人（血角氏族）', faction='demon_council',
         haunts=H(('bone_hills', 'town', 1), ('bloodplume', 'town', 0.1)),
         personality='毒舌、能言善辯，把吵架當成決鬥；信條是「拳頭之前先講道理，講不贏再揍」。最看不起只會用拳頭的蠢貨，也最欣賞能把她說到啞口無言的人。',
         appearance='高瘦的獸人女子，褐色皮膚上畫滿律法的符文刺青，獠牙鑲著銀，總拄著一根刻滿條文的骨杖。',
         background='血角「四天王」之一，氏族的律法誦者。她在議會替格羅姆吵架，在部族裡替族人吵架；想挑戰血角的人，要嘛打贏她，要嘛說贏她。',
         gear={'main_hand': {'base': 'quarterstaff', 'material': 'elderwood'}},
         relations={'npc_grom_shatterhorn': '酋長；替他說話，也替他收拾說錯的話。', 'npc_gorr': '四天王之首，一年說不到十句話，她替他說。'}),
    dict(id='npc_gorr', name='「沉默之斧」戈爾', gender='male', race='demon', **{'class': 'barbarian'}, level=13, location='bone_hills', hire_cc=0, unhireable=True, no_attack=True,
         kind='adventurer', tags=[], lineage='獸人（血角氏族）', faction='demon_council',
         haunts=H(('bone_hills', 'town', 1)),
         personality='從不開口，只用點頭和斧頭回答；對格羅姆絕對忠誠，對強者絕對尊重。據說他上一次說話，是十年前對格羅姆說的「是」。',
         appearance='像一座小山的獸人戰士，黑褐色皮膚上布滿舊傷，雙角斷過又接上鐵環，背著兩把巨大的骨斧。',
         background='血角「四天王」之首，格羅姆的斧頭。挑戰血角的人走到他面前時，通常已經沒有力氣再往前了。',
         gear={'main_hand': {'base': 'greataxe', 'material': 'adamantine'}},
         relations={'npc_grom_shatterhorn': '他的酋長，他的一切。'}),

    # ---- 鐵爐堡：釀酒師
    dict(id='npc_helga_malt', name='「酒桶」赫爾嘉', gender='female', race='dwarf', **{'class': ''}, level=4, location='ironforge', hire_cc=0,
         kind='commoner', tags=['merchant'], occupation='釀酒師', lineage='鐵爐氏族',
         haunts=H(('ironforge', 'town', 1)),
         personality='愛笑、豪爽、嘴巴不饒人，千杯不醉，把喝倒別人當成人生樂趣；各氏族每年都想收買她替自己釀酒，她誰的錢都收，誰的酒都不保證。',
         appearance='矮人裡也算嬌小的女人，金色鬍鬚編成兩條細辮，圓滾滾的臉頰永遠紅通通，腰間掛著一排試酒用的小錫杯。',
         background='鐵爐堡最好的釀酒師，「酒桶」是她自己取的外號。一年一度的氏族宴會上，誰能把別的氏族喝倒，誰就能在議會裡多說一句話——所以每年這個時候，她的酒窖門口都排滿了各氏族的使者。',
         relations={'npc_thorin_ironforge': '國王陛下，全鐵爐堡唯一喝不醉的人——除了她以外。'}),

    # ---- 銀月城：新芽同盟
    dict(id='npc_sylvie', name='希爾薇', gender='female', race='elf', **{'class': 'bard'}, level=9, location='silvermoon', hire_cc=0, unhireable=True,
         kind='adventurer', tags=['noble'], lineage='新芽同盟', faction='elf_court',
         haunts=H(('silvermoon', 'town', 1), ('silvermoon', 'noble', 0.5), ('windspeak', 'town', 0.1)),
         personality='熱情、衝動、浪漫，嘴巴停不下來；人類小說的狂熱讀者，偷偷用筆名寫人類風格的戀愛小說。在議會上和卡蘭西爾吵架是她的日常。',
         appearance='淡金色長髮綁成高馬尾的年輕精靈，綠色眼睛閃閃發亮，穿著人類樣式的短外套，腰間掛著一本寫到一半的手稿。',
         background='新芽同盟的盟主，一百八十歲（以精靈來說還是個孩子）。她主張精靈應該向外族敞開森林，認為千年不變的王庭正在慢慢枯死。保守派叫她「被人類小說教壞的孩子」。',
         relations={'npc_kalanthil': '老頑固；她的小說裡反派都長得像他。', 'npc_finia_silverleaf': '同盟的夥伴，替她從人類世界帶小說回來。', 'npc_ithrandil': '女王陛下；她相信女王其實站在她這邊。'}),

    # ---- 潮汐港：沙漠來的舞孃
    dict(id='npc_leila', name='蕾伊拉', gender='female', race='catfolk', **{'class': 'monk'}, level=6, location='tidehaven', hire_cc=690,
         kind='adventurer', tags=['traveler'], lineage='沙痕部落', faction='wild_tribes',
         haunts=H(('tidehaven', 'town', 1), ('coral_bay', 'town', 0.2)),
         personality='開朗大膽、熱情奔放，走到哪裡跳到哪裡，一緊張就會不自覺跳起舞來；看起來輕浮，其實一心只想救乾涸的故鄉，拳腳功夫和舞步一樣漂亮。',
         appearance='身高 162 公分的貓魅族舞孃，小麥色肌膚，金棕色貓耳與長尾，紅褐長髮編滿金色小珠；穿著綴滿金幣與薄紗的舞衣，腳踝掛著鈴鐺，走路叮噹作響。',
         background='二十二歲，從西部荒野來到潮汐港的舞孃，沙痕部落一座小綠洲出身。故鄉的泉水一年比一年少，她聽說東海有能「無中生水」的祕寶，便一路跳舞賺旅費來到港口；白天在酒館跳舞，晚上到處打聽祕寶的下落。喝醉的水手想動手動腳，通常會先飛出酒館。',
         relations={'npc_lina': '同部落的遠親；她聽說莉娜在中原當嚮導，一直想去看看。'}),
]
for n in new:
    if not n.get('class'): n['class'] = ''
    merged[n['id']] = n

# 內建角色的雇用要價照世界包的曲線（等級 3：285、4：400）
builtin['npc_amber']['hire_cc'] = 320
builtin['npc_gwendolyn']['hire_cc'] = 285
builtin['npc_aurelia']['hire_cc'] = 400

# ---------------------------------------------------------------- 檢查
allnpc = {**builtin, **merged}
ids = set(allnpc)
for n in allnpc.values():
    for k in (n.get('relations') or {}):
        assert k in ids, (n['id'], k)
    for m in (n.get('squad') or {}).get('members', []):
        assert m in ids, (n['id'], m)
    assert 'adelaide' not in json.dumps(n, ensure_ascii=False), n['id']
G = json.load(open(f'{ROOT}/data/rules/gear.json'))
for n in allnpc.values():
    for slot, g in (n.get('gear') or {}).items():
        b = G['bases'][g['base']]; m = G['materials'][g['material']]
        assert b['kind'] == m['kind'], (n['id'], g, b['kind'])
        assert b['slot'] == slot or (slot == 'main_hand' and b['slot'] == 'main_hand'), (n['id'], slot, b['slot'])
names = [n['name'] for n in allnpc.values()]
dup = {x for x in names if names.count(x) > 1}
assert not dup, dup

# ---------------------------------------------------------------- 輸出（依地區排）
LOC_REGION = {l['id']: l['region'] for l in geo['locations']}
ORDER = ['central', 'north', 'south', 'forest', 'east_sea', 'west']
LOC_ORDER = [l['id'] for l in geo['locations']]
def key(n):
    return (ORDER.index(LOC_REGION[n['location']]), LOC_ORDER.index(n['location']))
ordered = sorted(allnpc.values(), key=key)  # 穩定排序：同地點照原本的順序

KEYS1 = ['id', 'name', 'gender', 'race', 'class', 'level', 'location', 'hire_cc', 'unhireable', 'no_attack', 'no_steal']
KEYS2 = ['kind', 'tags', 'occupation', 'landmark', 'fixed', 'keeper', 'lineage', 'requires']
def j(v): return json.dumps(v, ensure_ascii=False)
def inline(v):
    if isinstance(v, dict):
        return '{ ' + ', '.join(f'{j(k)}: {inline(x)}' for k, x in v.items()) + ' }' if v else '{}'
    if isinstance(v, list):
        return '[' + ', '.join(inline(x) for x in v) + ']'
    return j(v)

def fmt(n):
    lines = []
    head = ', '.join(f'"{k}": {j(n[k])}' for k in KEYS1 if k in n)
    lines.append('    { ' + head)
    l2 = ', '.join(f'"{k}": {inline(n[k]) if isinstance(n[k], dict) else j(n[k])}' for k in KEYS2 if k in n)
    if l2: lines.append('      ' + l2)
    if 'haunts' in n: lines.append('      "haunts": [' + ', '.join(inline(h) for h in n['haunts']) + ']')
    if 'stages' in n: lines.append('      "stages": ' + j(n['stages']))
    p = f'"personality": {j(n["personality"])}' + (f', "faction": {j(n["faction"])}' if n.get('faction') else '')
    lines.append('      ' + p)
    for k in ['appearance', 'adult_appearance', 'background']:
        if n.get(k): lines.append(f'      "{k}": {j(n[k])}')
    for k in ['attrs', 'abilities', 'perks']:
        if k in n: lines.append(f'      "{k}": {j(n[k])}')
    if n.get('gear'): lines.append('      "gear": ' + inline(n['gear']))
    lines.append('      "relations": ' + (inline(n['relations']) if n.get('relations') else '{}'))
    if n.get('squad'): lines.append('      "squad": ' + inline(n['squad']))
    known = set(KEYS1 + KEYS2 + ['haunts', 'stages', 'personality', 'faction', 'appearance', 'adult_appearance', 'background', 'attrs', 'abilities', 'perks', 'gear', 'relations', 'squad'])
    extra = set(n) - known
    assert not extra, (n['id'], extra)
    return ',\n'.join(lines) + ' }'

body = ',\n'.join(fmt(n) for n in ordered)
comment = base['$comment']
text = '{\n  "$comment": ' + j(comment) + ',\n  "version": ' + str(base['version']) + ',\n  "npcs": [\n' + body + '\n  ]\n}\n'
json.loads(text)
open(OUT, 'w').write(text)
print(len(ordered), 'npcs')
import collections
print(collections.Counter(n['location'] for n in ordered))
