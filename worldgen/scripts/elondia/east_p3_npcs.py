"""炎華之地 P3：炎華南域的 36 位固定 NPC（docs/plan/roadmap/EAST_CONTENT_PLAN.md 第 5 節）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p3_npcs.py
寫進 data/world/npcs.json（同 id 的整筆換掉，可以重跑），關係照第 5.4 節的關係網雙向寫上，
也替兩位內建 NPC（雷諾、「黑帆」卡洛斯）加上和新角色的關係。
"""

import json

PATH = 'data/world/npcs.json'
COURT, LEAGUE = 'yanye_court', 'jinmo_league'


def hire(level):
    """生成的冒險者的要價（docs：60 + 45 × 等級 + 10 × 等級²）"""
    return 60 + 45 * level + 10 * level * level


def adv(id, name, gender, race, cls, level, location, *, hireable=True, **kw):
    out = {'id': id, 'name': name, 'gender': gender, 'race': race, 'class': cls, 'level': level, 'location': location,
           'hire_cc': hire(level) if hireable else 0, 'kind': 'adventurer'}
    if not hireable:
        out['unhireable'] = True
    out.update(kw)
    return out


def com(id, name, gender, race, level, location, occupation, **kw):
    out = {'id': id, 'name': name, 'gender': gender, 'race': race, 'class': '', 'level': level, 'location': location,
           'hire_cc': 0, 'kind': 'commoner', 'occupation': occupation}
    out.update(kw)
    return out


def town(loc, w=1, **more):
    hs = [{'location': loc, 'zone': 'town', 'weight': w}]
    for zone, weight in more.items():
        hs.append({'location': loc, 'zone': zone, 'weight': weight})
    return hs


NPCS = [
    # ================= 龍安府 =================
    adv('npc_yh_zhaohua', '燁昭華', 'female', 'hualong', 'wizard', 16, 'longan', hireable=False, no_attack=True, no_steal=True,
        tags=['royal'], faction=COURT, lineage='天青鱗', landmark='lm_yh_xuande',
        personality='強勢、勤政、手腕俐落，說話簡短，從不重複第二遍；骨子裡想當一個明君，偏偏遇上天下大變，焦頭爛額時只會更冷。',
        appearance='三十出頭的女帝，身形高挑挺拔，一對修長的天青色龍角向後彎，頸側與手背的鱗片是汝窯一樣的天青；烏髮高高挽起，插著一支燭龍紋的玉簪，鳳眼凌厲。穿著赭黃的圓領龍袍與玉帶，手指上總沾著一點硃批的紅墨。',
        background='大燁登基五年的女帝。海貿與火藥讓金黃、墨鐵鱗富了起來，行會要權，北原的歲幣一年比一年重，宰相又是太后的哥哥；她每天批到深夜的奏摺，一半是在吵架。宮人說，夜裡常看見她一個人在宣德樓頂喝冷掉的茶，看著瑔州港的方向。'),
    adv('npc_yh_wen_shiheng', '溫世衡', 'male', 'hualong', 'wizard', 15, 'longan', hireable=False, no_attack=True, no_steal=True,
        tags=['noble'], faction=COURT, lineage='天青鱗',
        haunts=[{'location': 'longan', 'zone': 'palace', 'weight': 1}, {'location': 'longan', 'zone': 'noble', 'weight': 0.8}],
        personality='溫文爾雅、滴水不漏，開口總是引經據典；真心相信天青鱗治天下才是正道，為了守住它可以不擇手段。',
        appearance='五十多歲的宰相，清瘦，一對天青色的短角打磨得光滑如玉，鬍鬚修得整整齊齊；穿著紫色的公服與金魚袋，手裡總拿著一卷書，笑起來眼角的細鱗會皺在一起。',
        background='三朝元老，太后的哥哥，朝中保守派之首。他說海商與行會是「末」，科舉才是「本」；墨鐵鱗的士子都知道，這幾年殿試放榜時，天青鱗世家的子弟名次總是高得出奇。'),
    adv('npc_yh_yue_zhenshan', '岳鎮山', 'male', 'hualong', 'fighter', 13, 'longan', hireable=False, no_attack=True,
        tags=['noble', 'good'], faction=COURT, lineage='朱砂鱗',
        haunts=[{'location': 'longan', 'zone': 'palace', 'weight': 1}, {'location': 'longan', 'zone': 'town', 'weight': 0.5}],
        personality='沉穩、寡言、極重承諾；對女帝的忠誠像鐵一樣，對欠餉的部下卻滿懷愧疚，常常自掏腰包。',
        appearance='四十多歲的殿前都指揮使，魁梧如山，一對粗壯的朱砂色龍角，臉上一道從額角劃到下巴的舊疤；穿著朱漆的步人甲，腰懸一把長柄朴刀，走路時鎧甲沉沉作響。',
        background='禁軍的統帥，朱砂鱗武人裡官做得最大的一個。禁軍已經欠餉三個月，部下在背後罵朝廷，也有人開始罵他；他夾在女帝與弟兄之間，最近被人看見在當鋪門口站了很久。'),
    adv('npc_yh_ye_guhong', '葉孤鴻', 'male', 'hualong', 'wizard', 10, 'longan', hireable=False, no_attack=True,
        tags=['noble', 'good'], faction=COURT, lineage='天青鱗（點青）', landmark='lm_yh_taixue',
        personality='清高、耿直，講課時妙語如珠，平時卻不太會說話；看不慣朝中的作派，又離不開這個位子。',
        appearance='三十多歲的太學主考官，身材修長，龍角是墨鐵色的，頸側的鱗卻被汝窯釉藥封成了天青——點青的痕跡在光下看得出接縫；穿著洗得發白的青衫，手指上全是墨漬。',
        background='墨鐵鱗出身的狀元，在點青禮上封了鱗，從此算是天青鱗；天生的天青鱗看不起他，墨鐵鱗的老鄉又說他忘本。他是太學裡唯一敢給寒門士子高分的考官，最近他批過的考卷，被人從貢院裡偷偷調換了。'),
    adv('npc_yh_shen_zhilan', '沈知瀾', 'female', 'hualong', 'bard', 6, 'longan', tags=['good'], faction=LEAGUE, lineage='墨鐵鱗',
        haunts=town('longan', 1, outskirts=0.2),
        personality='伶牙俐齒、愛開玩笑，寫起東西來不要命；嘴上說只寫話本賺錢，其實每一篇都在罵朝廷。怕的只有一件事：沒人看她寫的東西。',
        appearance='二十五歲的化龍族女作家，短髮剪到耳下，一對小巧的墨鐵色龍角，總是穿著男式的青布長衫（不是在隱瞞，只是嫌裙子麻煩）；腰間掛著筆囊與一疊稿紙，指尖永遠是黑的，說話時尾巴會跟著甩。',
        background='在瓦舍賣話本的作家，筆名「瀾生」。她的話本諷刺朝中大員，說書人搶著講，聽眾笑得拍桌子；上個月，她最新的稿子被宰相府的人當成「妖言」搜走了，她說稿子裡寫的是真事，有人一定看得懂。'),
    adv('npc_yh_huiyin', '慧音', 'female', 'hualong', 'cleric', 7, 'longan', tags=['priest', 'good'], faction=COURT, lineage='天青鱗',
        landmark='lm_yh_taimiao',
        personality='溫柔、好奇、對古籍著迷，講起祖龍的傳說就停不下來；信仰虔誠，卻偷偷懷疑祭文裡寫的不全是真的。',
        appearance='二十七歲的太廟女祭司，身材纖細，一對短短的天青色龍角上繫著白色的祭帶，長髮披到腰；穿著素白的祭服與黑色的寬袖外衣，懷裡總抱著一卷殘破的古籍，眼鏡片後面的豎瞳很亮。',
        background='太廟裡唯一還在讀燭龍朝古籍的人。她在一卷殘破的祭文裡讀到一段話：大燁開國那一年的祖龍祭，祭文寫的是「告天」，卻沒有寫祭典之後燭龍君去了哪裡。'),
    com('npc_yh_xiao_fengyi', '蕭鳳儀', 'female', 'hualong', 9, 'longan', '勾欄之主', adult=True, no_attack=True, tags=['merchant'],
        lineage='金黃鱗', landmark='lm_yh_goulan',
        personality='八面玲瓏、笑裡藏針，看人一眼就知道對方要什麼；把戲班當成家，也把戲班當成棋子；最大的弱點是捨不得任何一個她栽培過的角兒。',
        appearance='三十多歲的化龍族女人，身段豐腴婀娜，一對金黃色的龍角上纏著珍珠串，頸側與鎖骨的鱗片在燈下閃著金光；穿著緋紅的褙子與低胸的抹胸，手持一柄泥金團扇，走起路來長尾輕擺，香風陣陣。',
        adult_appearance='金黃的細鱗從鎖骨一路延伸到乳下與大腿內側，肌膚雪白豐潤，D 罩杯；她說戲台上的旦角都是她手把手教出來的，教的不只是唱腔。',
        background='龍安府瓦舍二十座勾欄有十二座是她的，戲班、說書人、名角都聽她調度。她的戲班替宰相打聽消息，也替女帝打聽消息；誰給得多，她就讓誰聽到想聽的。她說最近有一齣戲演不下去了，因為寫戲的人被抓了。'),
    com('npc_yh_wen_ruyu', '溫如玉', 'female', 'hualong', 8, 'longan', '司寢女官', adult=True, no_attack=True, tags=['noble'],
        faction=COURT, lineage='天青鱗', landmark='lm_yh_shangqin',
        personality='端莊、沉靜、說話輕聲細語，教起閨房之禮一絲不苟，臉都不紅；忠於女帝，卻是宰相的姪女，夾在中間從不表態。',
        appearance='二十八歲的尚寢局司寢女官，身材修長勻稱，一對細長的天青色龍角，烏髮梳成一絲不亂的高髻；穿著淡青的宮裝與層層紗帶，腰間繫著一串象牙籌，舉手投足都像量過尺寸。',
        adult_appearance='宮裝底下是勻稱柔軟的身子，C 罩杯，腰極細；天青的細鱗從後頸沿著脊背一路往下，她教人的時候，會讓對方親手數清楚有幾片。',
        background='宰相溫世衡的姪女，十五歲入宮，如今掌管尚寢局，教導宮中的閨房之禮。宰相以為她是自己在宮裡的眼睛，她卻是女帝最信任的心腹；最近她開始替女帝挑選侍寢的人，挑的標準只有她自己知道。'),
    com('npc_yh_qian', '錢掌櫃', 'male', 'hualong', 5, 'longan', '茶坊老闆', tags=['merchant'], faction=LEAGUE, lineage='金黃鱗',
        landmark='lm_yh_night_market',
        personality='圓滑、健談、愛占小便宜，消息靈通得嚇人；嘴上說只管賣茶，其實什麼生意都做。',
        appearance='四十多歲的化龍族胖掌櫃，金黃色的龍角磨得發亮，圓臉上一對小眼睛笑得眯成縫；穿著褐色的綢衫，肩上搭著一條擦桌布，手裡的茶壺從不離身。',
        background='御街夜市最大的一間茶坊的老闆，茶坊二樓的雅座是整座龍安府消息最多的地方。他說最近打聽宰相府的人變多了，打聽的人裡還有宮裡的人。'),
    adv('npc_yh_xiaozhu', '小柱', 'male', 'hualong', 'rogue', 3, 'longan', tags=['good'], lineage='墨鐵鱗',
        haunts=town('longan', 1),
        # 「小柱想去看海」選了留下來當水手：搬到瑔州港
        stages=[{'requires': {'flags': ['yhz_sailor']}, 'location': 'quanzhou', 'haunts': town('quanzhou', 1),
                 'background': '原本是龍安府茶坊的跑堂，跟著冒險者去瑔州港看了一次海，就留下來在蕃商哈斯丁的船上當水手。他說等跑完第一趟東海，要回龍安府把故事講給錢掌櫃聽。'}],
        personality='勤快、天真、愛做白日夢，跑堂跑得比誰都快；最大的願望是去瑔州港看一眼海，又怕走了茶坊就沒人跑腿。',
        appearance='十九歲的化龍族跑堂，個子瘦高，一對小小的墨鐵色龍角，頭上綁著一條洗褪色的藍布巾；穿著短打與草鞋，腰間掛著一把小刀與一捆麻繩，臉上總帶著傻笑。',
        background='錢掌櫃茶坊的跑堂，從小在御街長大，沒出過龍安府一步。他把客人聊起的海上故事全記在一本小冊子上，說等存夠了錢就去瑔州港，搭船去看看海的另一邊有什麼。'),
    adv('npc_yh_zhao_hu', '趙虎', 'male', 'hualong', 'fighter', 5, 'longan', faction=COURT, lineage='朱砂鱗',
        haunts=town('longan', 1, outskirts=0.3),
        personality='豪爽、講義氣、好賭成性，輸了錢就罵朝廷；打起架來不要命，對弟兄比對自己還好。',
        appearance='三十歲的禁軍小隊長，粗壯結實，一對朱砂色的龍角缺了一角，臉上鬍子拉碴；穿著舊得發黑的軍服與半身甲，腰間掛著一把朴刀和一副骰子。',
        background='禁軍的小隊長，欠餉三個月，弟兄們的家裡快揭不開鍋。他白天在城門站崗，晚上在瓦舍的賭坊裡想把軍餉贏回來；最近他跟人借了一筆不該借的錢，借錢的人說可以用別的方式還。'),
    com('npc_yh_old_tomb_keeper', '老陵戶', 'male', 'hualong', 4, 'longan', '守陵人', tags=['commoner', 'good'], lineage='墨鐵鱗',
        haunts=[{'location': 'longan', 'zone': 'outskirts', 'weight': 1}, {'location': 'longan', 'zone': 'town', 'weight': 0.3}],
        personality='沉默、固執、迷信，說話慢吞吞的，一開口就是「祖上說」；守了一輩子的陵，比誰都怕那座陵。',
        appearance='七十歲的化龍族老人，駝背、乾瘦，墨鐵色的龍角斷了一隻，鱗片褪得發灰；穿著打滿補丁的粗布衣，背著一盞燈籠與一把鋤頭，指甲縫裡全是陵土。',
        background='世代守永昭陵的陵戶，祖上十三代都守在神道邊。他說小時候聽爺爺講過，開國那一年的祭典之後，陵裡傳出敲打石門的聲音，敲了三天三夜才停；最近，他又聽到了。'),
    com('npc_yh_wen_yi', '溫懿', 'female', 'hualong', 11, 'longan', '太后', adult=True, no_attack=True, no_steal=True, tags=['royal'],
        faction=COURT, lineage='天青鱗', landmark='lm_yh_taifei',
        personality='端莊、矜持、極重禮法，說話永遠不疾不徐；寡居多年，寂寞藏得很深，只有提到女兒時眼神才會軟下來。',
        appearance='四十五歲的太后，身段豐潤端麗，一對修長的天青色龍角上戴著金累絲的鳳冠，眉目與女帝有七分相像；穿著深青的翟衣與層層披帛，手腕上一串沉香念珠，坐著的時候腰背挺得筆直。',
        adult_appearance='翟衣底下是成熟豐腴的身子，E 罩杯，肌膚白得像上好的瓷；天青的鱗片在腰窩與大腿內側最密，多年沒有人碰過，一碰就輕輕發抖。',
        background='先帝的皇后、女帝的生母、宰相溫世衡的妹妹。先帝駕崩之後她搬進太妃宮，和鬥了半輩子的太妃當起了鄰居。在政事上她向著哥哥，在心裡她向著女兒；最近她常一個人在月洞門邊站著，聽隔壁太妃宮裡傳來的笑聲。'),
    com('npc_yh_hu_yuxiao', '胡玉綃', 'female', 'linghu', 10, 'longan', '太妃', adult=True, no_attack=True, no_steal=True, tags=['royal'],
        faction=COURT, lineage='胡記商幫', landmark='lm_yh_taifei',
        personality='嫵媚、愛玩、說話帶刺又帶糖，最愛看太后被她氣得說不出話；看似沒心沒肺，其實把宮裡每個人的心思都摸得一清二楚。',
        appearance='看起來三十多歲的靈狐族太妃，身段妖嬈，頭上一對雪白的狐耳，身後拖著三條蓬鬆的白尾，尾尖染著一點胭脂紅；穿著薄透的緋色宮裝，領口開得很低，眼角一顆淚痣，笑起來眼睛會在暗處泛光。',
        adult_appearance='緋色宮裝底下是雪白滑膩的身子，D 罩杯，三條尾巴會自己纏上人的腰；宮裡說她是迷惑先帝的「狐狸精」，她從不否認。',
        background='先帝最寵的妃子、胡九娘的姑母；胡記的皇商特許，就是她當年在先帝枕邊求來的。先帝走後她成了太妃宮真正的主人，宮女們都說太后的殿冷清，太妃的殿熱鬧。她說先帝臨終前跟她說了一句話，這句話她誰也沒告訴，連胡九娘也沒有。'),
    # ================= 萍江府 =================
    adv('npc_yh_su_huaijin', '蘇懷瑾', 'female', 'hualong', 'wizard', 11, 'pingjiang', hireable=False, no_attack=True,
        tags=['noble'], faction=COURT, lineage='天青鱗',
        haunts=[{'location': 'pingjiang', 'zone': 'noble', 'weight': 1}, {'location': 'pingjiang', 'zone': 'town', 'weight': 0.5}],
        personality='冷靜、守法、極有魅力，說話條理分明，從不提高聲音；相信規矩能救人，也知道規矩常常在害人。',
        appearance='三十二歲的萍江女知府，身材高挑清瘦，一對修長的天青色龍角，長髮用一根白玉簪挽起；穿著緋色的官服與黑紗襆頭，腰間佩著知府的銅印，眉眼清冷，笑的時候很少。',
        background='朝廷派來萍江府的女知府，天青鱗世家出身，卻是靠真本事考上的。她奉命替宮裡辦「花石綱」，要從萍江的園林裡搜羅奇石與天青瓷運進京，自己也覺得荒唐；織工行會在罷織的邊緣，她的案頭上壓著一份還沒批的工約。'),
    adv('npc_yh_lu_qinghe', '陸青禾', 'female', 'hualong', 'monk', 10, 'pingjiang', hireable=False, tags=['good'], faction=LEAGUE,
        lineage='墨鐵鱗', haunts=town('pingjiang', 1, outskirts=0.2),
        personality='直爽、潑辣、煽動力極強，站上木箱就能讓一條街的織工跟著她喊；講義氣，認死理，最受不了別人說「慢慢來」。',
        appearance='二十九歲的織工行會首領，短髮紮成一個小髻，一對粗短的墨鐵色龍角，手上全是織繭與梭子劃的細疤；穿著洗白的粗布短衫與綁腿，捲起的袖子露出結實的手臂，說話時尾巴啪啪拍地。',
        background='萍江織工行會的頭，金墨盟裡最激進的一派，主張大燁該像潮汐港一樣由議會治理。織造局一年比一年壓低工錢，她說再不給工約就罷織；昨天夜裡，行會的倉庫被人放了一把火。'),
    com('npc_yh_xie_qingwu', '謝青梧', 'femboy', 'hualong', 8, 'pingjiang', '畫師', tags=['noble'], faction=COURT, lineage='天青鱗',
        landmark='lm_yh_ping_garden',
        personality='溫柔、多愁善感、對美的東西毫無抵抗力，說話慢條斯理；收藏天青瓷成癡，為了一只盞可以三天不吃飯。',
        appearance='二十四歲的化龍族畫師，身形纖細，一對秀氣的天青色龍角，長髮用絲帶鬆鬆繫著；常穿女式的月白褙子與長裙作畫，眉目如畫，比園裡的仕女圖還美，袖口總沾著一點顏料。',
        background='萍園的主人，天青鱗世家的么子，不肯入仕，只肯畫畫與收瓷。他在藏瓷閣最裡面鎖著一只千窯谷最早的天青盞，盞底的款不是任何一個天青鱗世家的名字，而是一個墨鐵鱗窯工的名字。'),
    adv('npc_yh_xuanshuang', '玄霜', 'female', 'hualong', 'cleric', 9, 'pingjiang', adult=True, tags=['priest'], lineage='天青鱗',
        landmark='lm_yh_lingxu',
        personality='清冷、淡泊、說話像在念經，看什麼都像隔著一層霧；修的是雙修之道，說起來坦然得讓人不知道該往哪裡看。',
        appearance='三十歲的靈虛觀觀主，身材高挑勻稱，一對細長的天青色龍角上繫著白色的道冠帶，長髮披散；穿著素白的道袍與黑色的絛帶，手持一柄白玉拂塵，赤著腳走在石階上，眼神清澈得像冬天的湖。',
        adult_appearance='素白的道袍底下什麼都沒穿，C 罩杯，肌膚冷白；她說雙修講究陰陽相濟，修的時候要「心無雜念」，說這話時她的尾巴纏得很緊。',
        background='天青鱗世家的嫡女，二十歲那年拒了婚約出家，在靈虛觀修雙修之道，家裡只當她死了。她說修到最後一層需要一個「有緣人」，等了十年還沒等到；最近有人在觀外的松林裡看見她的家人來過。'),
    adv('npc_yh_qingluo', '青蘿', 'female', 'hualong', 'druid', 8, 'pingjiang', adult=True, lineage='墨鐵鱗', perks=['flaw_serpent'],
        landmark='lm_yh_bamboo_lake',
        personality='怕生、好奇、說話直得像小孩，不懂人間的拐彎抹角；想弄懂人為什麼會愛人，又怕被當成怪物趕走。',
        appearance='二十三歲的化龍族女子，生來帶著蛇相：龍角細小、鱗片比常人細密，是一片濕潤的墨綠，舌尖分岔，身子永遠冰涼；腰下拖著一條蛇一樣細長的尾巴，豎瞳是淡金色。穿著一件洗舊的青布衣，赤著腳，常坐在竹湖邊的石頭上曬太陽。',
        adult_appearance='冰涼柔滑的身子，B 罩杯，細鱗一路長到腿根，摸起來像上好的絲；她的尾巴會不自覺地纏上喜歡的人，纏得越緊越不肯放。',
        background='從小被當成「蛇妖轉世」，家裡把她送到竹湖邊的小屋獨居，十年沒有人來看過她。她在湖邊撿到一本被丟掉的話本，看了一百遍，還是不懂書裡的人為什麼要為了另一個人哭。'),
    com('npc_yh_yao_bo', '窯伯', 'male', 'hualong', 6, 'pingjiang', '老窯工', tags=['commoner', 'good'], lineage='墨鐵鱗',
        haunts=town('pingjiang', 1, outskirts=0.5),
        personality='寡言、倔強、手比嘴巧，看到好瓷會笑，看到假瓷會罵人；一輩子沒離開過窯，也一輩子沒被人記住名字。',
        appearance='七十歲的化龍族老窯工，矮壯，墨鐵色的龍角被窯火燻得發黑，手掌上全是燙傷的疤；穿著沾滿瓷土的短褂，腰間掛著一個小小的釉藥葫蘆。',
        background='千窯谷最後一位還活著的老窯工，谷裡的窯熄了以後，他在萍江的窯市替人鑑瓷維生。他說天青釉的配方是他師父的師父的師父燒出來的，可是書上寫的是別人的名字；他說最近夜裡，谷底那口窯又亮了。'),
    adv('npc_yh_pang_yasi', '龐押司', 'male', 'hualong', 'fighter', 8, 'pingjiang', hireable=False, tags=['villain'], faction=COURT,
        lineage='朱砂鱗', haunts=town('pingjiang', 1, outskirts=0.3),
        personality='貪婪、跋扈、欺軟怕硬，對上司點頭哈腰，對百姓拳打腳踢；最怕的是自己貪的帳被人翻出來。',
        appearance='四十歲的押送官，肥壯，一對朱砂色的龍角包著金邊，臉上油光滿面；穿著鑲金的軍服與披風，手上戴滿金戒指，腰間掛著一根皮鞭。',
        background='押送花石綱的軍官，奉命從萍江的園林搜羅奇石運進京。他看上哪家的石頭，就在門上貼黃封，拆牆也要搬走；搬走的石頭有一半沒進京，進了他自己的園子。'),
    com('npc_yh_ruan', '阮掌事', 'male', 'hualong', 6, 'pingjiang', '織造局掌事', tags=['noble'], faction=COURT, lineage='天青鱗（點青）',
        landmark='lm_yh_weaving_bureau',
        personality='謹慎、刻板、凡事照章辦事，最愛說「上頭有令」；不算壞人，只是一輩子都在怕丟官。',
        appearance='四十多歲的織造局掌事，瘦小，墨鐵色的龍角，頸側的鱗被點青封成天青；穿著整齊的青色官服，手裡永遠捧著一本帳冊，說話前先清嗓子。',
        background='點青出身的小官，管著織造局上千張織機。宮裡要的雲錦越來越多，撥下來的工錢越來越少，他只好一年年壓織工的工錢；他說自己也是墨鐵鱗出身，可是陸青禾說他忘了。'),
    # ================= 瑔州港 =================
    com('npc_yh_hu_jiuniang', '胡九娘', 'female', 'linghu', 12, 'quanzhou', '胡記當家', no_attack=True, no_steal=True, tags=['merchant'],
        faction=COURT, lineage='胡記商幫', landmark='lm_yh_huji',
        personality='笑裡藏刀、精於算計，說話甜得像蜜，算盤打得比誰都狠；對胡記的人極護短，對外人一分不讓。',
        appearance='三十五歲的靈狐族女商人，身段窈窕，一對火紅的狐耳，身後四條蓬鬆的紅尾；穿著金線繡的墨綠褙子與紅裙，髮間插著一支金步搖，手裡一柄象牙算盤，笑起來眼睛彎得像月牙。',
        background='胡記商幫的當家，掌著朝廷的茶引、鹽引與香料專賣，是瑔州港最有錢的人之一。皇商特許是她姑母太妃當年替她求來的，所以胡記向著朝廷；金黃鱗的海商說她壟斷，她說那叫規矩。最近有一船胡記的香料，在市舶司的帳上憑空少了一半。'),
    com('npc_yh_jin_yutang', '金玉棠', 'female', 'hualong', 12, 'quanzhou', '海商', no_attack=True, no_steal=True, tags=['merchant', 'good'],
        faction=LEAGUE, lineage='金黃鱗', landmark='lm_yh_jinyu',
        personality='大方、果斷、說話爽快，談生意像打仗，打完仗請對手喝酒；主張立憲，覺得陸青禾太急，也覺得朝廷太慢。',
        appearance='三十八歲的金黃鱗女海商，身材高挑豐滿，一對金黃色的龍角上套著金環，長髮編成一條粗辮垂在胸前；穿著海藍的窄袖袍與皮靴，腰間掛著一枚指南魚與一把短刀，皮膚被海風曬成蜜色。',
        background='金墨盟的盟主，名下三十艘船跑遍南洋與東海。她說大燁要的是一部憲章，讓皇帝和商人都照規矩來；胡記的皇商特許是她最大的眼中釘。她最近收到一封信，說潮汐港的七潮議會願意見她。'),
    com('npc_yh_qin_yan', '秦焰', 'male', 'hualong', 11, 'quanzhou', '火藥總匠師', no_attack=True, tags=['good'], faction=LEAGUE,
        lineage='墨鐵鱗', landmark='lm_yh_gunpowder_works',
        personality='暴躁、專注、對火藥比對人有耐心；說話像放爆竹，罵完人又會偷偷替對方收拾爛攤子。',
        appearance='四十五歲的火藥總匠師，精瘦結實，墨鐵色的龍角被火燎得坑坑疤疤，左手少了兩根手指；穿著被火星燒滿小洞的皮圍裙，眉毛被燒掉了一半，身上一股硝石味。',
        background='四年前火藥坊爆炸的倖存者，三百個工匠只活下來十一個。他在城裡重建了火藥坊，帶著學徒從頭來過；他說爆炸那天上頭叫走了工頭，坊裡卻留了人，這件事他記了四年。'),
    com('npc_yh_cheng_yan', '程硯', 'male', 'hualong', 10, 'quanzhou', '市舶司提舉', no_attack=True, tags=['noble'], faction=COURT,
        lineage='天青鱗（點青）', landmark='lm_yh_shibosi',
        personality='八面玲瓏、膽小謹慎，誰也不想得罪；收錢的時候手很穩，辦事的時候手會抖。',
        appearance='四十歲的市舶司提舉，中等身材，墨鐵色的龍角，頸側點青封過的鱗片保養得發亮；穿著綠色的官服，袖子裡總藏著一本小帳，說話時愛摸自己的鬍子。',
        background='點青出身的市舶司提舉，管著瑔州港所有船的出海與抽分。胡記要他先放胡記的船，金玉行要他先放金玉行的船，他兩邊都收錢、兩邊都答應；走私女王赤鬟的船，也是他每個月親手簽的放行。'),
    adv('npc_yh_haiyao', '海鷂', 'female', 'hualong', 'ranger', 8, 'quanzhou', tags=['good'], faction=LEAGUE, lineage='墨鐵鱗',
        haunts=town('quanzhou', 1, outskirts=0.3),
        personality='豪爽、愛笑、膽子大得嚇人，喝酒從不輸；講起海上的事眼睛發亮，最受不了被困在陸地上。',
        appearance='二十八歲的女船長，短髮被海風吹得亂翹，一對墨鐵色的龍角上刻著航海的記號，臉上有一道魚鉤劃的疤；穿著敞領的短衫與寬褲，赤腳，腰間掛著一枚指南魚與一把彎刀，皮膚曬成古銅色。',
        background='金玉棠船隊裡最年輕的船長，靠著一枚指南魚遠航到過北原的海岸，是大燁少數見過媞丹海東部的人。她說北原的海岸上有一座沒人知道的港口，下次出海她要找一個不怕死的人同行。'),
    adv('npc_yh_yaoting', '瑤汀', 'female', 'yulin', 'bard', 7, 'quanzhou', lineage='夏瀾殿', faction='four_seasons',
        haunts=town('quanzhou', 1),
        personality='樂天、貪杯、愛熱鬧，宴席上永遠是最後一個走的；說是使節，其實只是喜歡陸地上的酒和人。',
        appearance='看起來二十出頭的玉璘族使節，化形上岸的雙腿修長，裙擺下偶爾露出幾片玉色的鱗；淺藍色的長髮盤成雙髻，插著珊瑚簪，耳後有細鰓，臉頰總是喝得紅撲撲的；穿著改良的廣袖羅裳，懷裡抱著一把月琴。',
        background='夏瀾殿派駐瑔州港的使節，負責珍珠與瓷器的買賣。她和潮汐港深潮席的雷諾是老酒友，常常寫信跟他比誰被灌醉的次數多；她說玉璘族的古歌謠裡有一段，和化龍族太廟的祭文一模一樣。'),
    com('npc_yh_apao', '阿炮', 'female', 'hualong', 3, 'quanzhou', '火藥學徒', tags=['commoner'], faction=LEAGUE, lineage='墨鐵鱗',
        haunts=town('quanzhou', 1),
        personality='冒失、好動、天不怕地不怕，說話又快又大聲；做什麼都想放一把火試試，闖了禍就躲到師父背後。',
        appearance='二十歲的火藥學徒，個子小小的，短髮被火燎得捲起來，一對小小的墨鐵色龍角上纏著布條；穿著師父改小的皮圍裙與短褲，臉上永遠有一塊黑灰，背上背著一捆爆竹。',
        background='秦焰收的學徒，爆炸那年她十六歲，在坊外送飯才撿回一條命。她想造出一種「不會炸死人的爆竹」，師父說那叫煙火；她說不對，她要的是能讓天上開花、又能把壞人嚇跑的那種。'),
    adv('npc_yh_chihuan', '赤鬟', 'female', 'hualong', 'rogue', 9, 'quanzhou', hireable=False, adult=True, tags=['villain'],
        lineage='金黃鱗', haunts=town('quanzhou', 1, outskirts=0.2),
        personality='狂放、貪婪、言出必行，賭品比人品好；看人只看值多少錢，偏偏又會為了一句承諾把命押上。',
        appearance='三十歲的走私女王，身材高挑火辣，一頭赤紅的長髮編成許多細辮，一對金黃色的龍角上掛滿金環；穿著敞胸的皮背心與緊身的皮褲，腰間兩把短刀，長尾上套著一個金鈴，走過的地方叮噹作響。',
        adult_appearance='敞開的背心下是飽滿結實的胸，D 罩杯，腹肌分明；金黃的鱗從腰側一路長到臀，她說輸給她的人可以用身子抵債，贏了她的人也一樣。',
        background='瑔州港的走私女王，在港外泊著一艘大海船，底艙改成賭場與黑市，賭的是錢也是人。市舶司的程硯每個月替她簽放行，她每個月替程硯還賭債；她說她的船艙裡現在關著一個不該賣的人。'),
    com('npc_yh_hastings', '哈斯丁', 'male', 'human', 6, 'quanzhou', '蕃商', tags=['merchant', 'traveler'], landmark='lm_yh_fanfang',
        personality='精明、健談、有點自大，總愛拿西方的東西跟東方比；骨子裡想家，喝醉了會唱潮汐港的水手歌。',
        appearance='四十多歲的人類商人，紅鬍子、啤酒肚，皮膚曬得通紅；穿著西式的呢絨外套，戴著一頂寬邊帽，脖子上掛著一副單筒望遠鏡，說的大燁話帶著很重的口音。',
        background='從潮汐港來的商人，在蕃坊開了一間貨棧，賣西方的玻璃器與呢絨，買大燁的瓷器與茶。他說自己是第一個走完十天航程的潮汐港商人，船上帶來的貨被黑帆卡洛斯的人盯上過；他說潮汐港的人根本不知道東邊有什麼。'),
    adv('npc_yh_rat_knife', '老鼠刀', 'male', 'hualong', 'rogue', 4, 'quanzhou', lineage='墨鐵鱗',
        haunts=[{'location': 'gunpowder_ruins', 'zone': 'dungeon', 'weight': 1}, {'location': 'quanzhou', 'zone': 'outskirts', 'weight': 0.5},
                {'location': 'quanzhou', 'zone': 'town', 'weight': 0.3}],
        personality='狡猾、多疑、地盤意識極強，對手下卻很照顧；說話像在討價還價，什麼都有價錢。',
        appearance='三十五歲的拾荒人頭目，瘦小精悍，一對墨鐵色的龍角磨得尖尖的，滿臉黑灰，一隻眼睛蒙著皮罩；穿著用帆布縫成的短褂，腰間掛著一把磨得發亮的小刀和一串撿來的銅鑰匙。',
        background='在火藥坊遺址撿東西的拾荒人頭目，手下有二十幾個爆炸後沒了工作的工匠家眷。他說廢墟裡最值錢的不是銅鐵，是那天的帳本；有人出了大價錢要買，他還沒賣。'),
    # ================= 青丘屯 =================
    adv('npc_yh_hu_taiye', '胡太爺', 'male', 'linghu', 'ranger', 9, 'qingqiu', hireable=False, tags=['good'], faction=COURT,
        lineage='青丘胡氏', landmark='lm_yh_old_elm',
        personality='倔強、護短、愛面子，說話粗聲粗氣，心比誰都軟；不願意改祀，也知道擋不住，所以更倔。',
        appearance='七十歲的靈狐族屯長，高大結實，一對灰白的狐耳，身後三條灰白的長尾；穿著羊皮襖與狍皮帽，腰間掛著一桿旱菸袋與一把獵刀，臉上的皺紋像老榆樹的樹皮。',
        background='青丘屯的屯長，年輕時是屯裡最好的獵戶。龍安府的禮部派人來說要把仙堂改成祭祖龍的祠，他把人趕了出去；他說胡家的仙在青丘待了一千年，比大燁還老。城裡胡記的胡九娘論起來是他的遠房姪女，兩人見面從不說話。'),
    adv('npc_yh_hu_sanniang', '胡三娘', 'female', 'linghu', 'druid', 9, 'qingqiu', hireable=False, adult=True, tags=['priest'],
        lineage='青丘胡氏', landmark='lm_yh_xiantang',
        personality='平時爽朗、愛喝酒、說話葷素不忌，笑聲整個屯子都聽得見；仙家附身時卻判若兩人，聲音變得蒼老，眼神深得像井。',
        appearance='三十二歲的靈狐族弟馬，身材豐滿高挑，一對赤褐色的狐耳，身後兩條蓬鬆的狐尾；長髮用紅繩隨手綁著，穿著對襟的花布棉襖與黑褲，腰間繫著一條五彩的腰鈴，手裡常拎著一壺燒刀子。',
        adult_appearance='棉襖底下是豐腴溫熱的身子，E 罩杯，肌膚上有淡淡的狐毛紋；仙家附身的時候，她會變得主動得嚇人，事後卻什麼都不記得。',
        background='青丘屯的弟馬，十八歲那年被胡家的老仙「胡三太奶」選中出馬，替人看事、治病、解冤。她說胡三太奶最近不太愛說話，請了三次才下來一次；下來的時候只說了一句：「有人要拆我的堂口。」'),
    adv('npc_yh_bai_xiaoqiao', '白小蕎', 'female', 'linghu', 'bard', 5, 'qingqiu', tags=['good'], lineage='青丘胡氏',
        haunts=town('qingqiu', 1),
        personality='害羞、認真、唱起神調來像換了一個人；想去城裡看看，又捨不得屯子，更捨不得三娘。',
        appearance='二十一歲的靈狐族二神，個子嬌小，一對雪白的狐耳，身後一條毛茸茸的白尾；短髮齊耳，穿著淡藍的棉襖與毛靴，腰間掛著一面文王鼓與一根鼓鞭，臉頰被冷風吹得紅撲撲的。',
        background='胡三娘的二神（香童），敲文王鼓、唱神調幫她請仙送仙。她的神調是屯裡唱得最好的，連城裡來的說書人都聽呆了；說書人說她可以去龍安府的勾欄唱，她到現在還沒回答。'),
    adv('npc_yh_huang_dadan', '黃大膽', 'male', 'linghu', 'ranger', 4, 'qingqiu', lineage='青丘胡氏',
        haunts=town('qingqiu', 1, outskirts=0.6),
        personality='膽子大、嘴巴笨、運氣差得離譜，什麼倒霉事都輪得到他；越倒霉越不服氣，非要上山證明自己不可。',
        appearance='二十二歲的靈狐族獵戶，高大憨厚，一對土黃色的狐耳，身後一條總是被樹枝勾得亂糟糟的尾巴；穿著狍皮襖與綁腿，背著一張舊弓，額頭上貼著一張胡三娘給的符。',
        background='屯裡的年輕獵戶，名字是爹取的，說要他大膽。去年冬天他在山裡被黃皮子攔路討封，問他「你看我像人還是像仙」，他老實說「像黃鼠狼」，從此倒霉到現在：弓斷了三把，陷阱裡全是自己的腳。'),
]

# 政治線上半的結局（east_p4c.py）：yhpol_monarchy／yhpol_republic／yhpol_constitution 換掉幾位的身分與出沒
def _palace(x, y):
    return {'area': 'longan/palace', 'x': x, 'y': y}


POLITICS = {
    'npc_yh_zhaohua': [
        {'requires': {'flags': ['yhpol_republic']}, 'location': 'longan', 'haunts': [{'location': 'longan', 'zone': 'noble', 'weight': 1}, {'location': 'longan', 'zone': 'town', 'weight': 0.4}],
         'background': '大燁的前女帝。她在宣德樓上親手蓋了退位詔書，把天下交給公議會，搬進貴族坊一間普通的宅子。她說這是五年來睡得最好的一覺——可是每天早上，她還是會去看公議會貼出來的告示。'},
        {'requires': {'flags': ['yhpol_monarchy']}, 'location': 'longan', 'fixed': _palace(5, 2),
         'background': '親政的女帝。宰相罷相、激進派下獄之後，她親自看每一份奏摺、每一筆帳，比以前更強，也更孤單。宣德樓頂的茶，她現在會多倒一杯。'},
        {'requires': {'flags': ['yhpol_constitution']}, 'location': 'longan', 'fixed': _palace(5, 2),
         'background': '立憲之後的女帝，和「五席」共治大燁：皇權寫在憲章第一條，限制皇權的寫在第二條到第三十條。她說這樣比較累，可是睡得比較安心。'},
    ],
    'npc_yh_wen_shiheng': [
        # 共和：出逃了，但沒有離開炎華之地——躲在瑔州港的蕃坊碼頭等船，找得到
        {'requires': {'flags': ['yhpol_republic']}, 'location': 'quanzhou', 'fixed': {'area': 'quanzhou/fanfang', 'x': 3, 'y': 3},
         'background': '出逃的前宰相。公議會的通緝告示貼滿了瑔州港的碼頭，他卻換了一身商人的衣服，躲在蕃坊碼頭一間香料貨倉的二樓等船出海——等了半年，船一直沒來。陸青禾知道他在哪裡，沒有派人去抓：「讓他看著共和也好。」'},
        {'requires': {'flags': ['yhpol_monarchy']}, 'location': 'longan', 'haunts': [{'location': 'longan', 'zone': 'noble', 'weight': 1}],
         'background': '罷相之後閉門思過的前宰相。溫家的門前冷落了，他每天在書房裡抄經，抄的都是開國那一年的祭文。'},
        {'requires': {'flags': ['yhpol_constitution']}, 'location': 'longan', 'haunts': [{'location': 'longan', 'zone': 'palace', 'weight': 1}, {'location': 'longan', 'zone': 'noble', 'weight': 0.8}],
         'background': '立憲之後，他成了議會裡保守派的領袖，在每一條新法上逐字爭辯。輸了的時候，他會說「祖制」；贏了的時候，他什麼都不說。'},
    ],
    'npc_yh_lu_qinghe': [
        {'requires': {'flags': ['yhpol_republic']}, 'location': 'longan', 'haunts': [{'location': 'longan', 'zone': 'town', 'weight': 1}, {'location': 'longan', 'zone': 'noble', 'weight': 0.6}],
         'background': '公議會的首席。萍江的織工把她送進了龍安府，她在太學的講堂上開議，手上的織繭還在。她說當首席比罷織累多了，因為吵架的對象變成了自己人。'},
        {'requires': {'flags': ['yhpol_constitution']}, 'location': 'pingjiang', 'haunts': [{'location': 'pingjiang', 'zone': 'town', 'weight': 1}, {'location': 'longan', 'zone': 'town', 'weight': 0.4}],
         'background': '憲章「五席」裡的農工席。她說立憲不是她要的共和，可是至少織工在議會裡有了一張椅子——她打算一直坐在上面吵。'},
        {'requires': {'flags': ['yhpol_monarchy']}, 'location': 'pingjiang', 'haunts': [{'location': 'pingjiang', 'zone': 'town', 'weight': 1}],
         'background': '女帝親政之後，激進派星散，行會被勒令解散。她回到織機前，夜裡還是帶著織工唱工歌，只是聲音小了一點。'},
    ],
    'npc_yh_su_huaijin': [
        {'requires': {'flags': ['yhpol_monarchy']}, 'location': 'pingjiang', 'haunts': [{'location': 'pingjiang', 'zone': 'noble', 'weight': 1}, {'location': 'pingjiang', 'zone': 'town', 'weight': 0.5}],
         'background': '女帝親政之後最信任的地方官，萍江府的知府加封江南轉運使。她辦事比以前更快，也更少笑了。'},
        {'requires': {'flags': ['yhpol_republic']}, 'location': 'pingjiang', 'haunts': [{'location': 'pingjiang', 'zone': 'noble', 'weight': 1}, {'location': 'pingjiang', 'zone': 'town', 'weight': 0.5}],
         'background': '共和之後，萍江的人把她選成了公議會的萍江代表——織工們說，她是唯一一個肯在工約上蓋印的官。'},
        {'requires': {'flags': ['yhpol_constitution']}, 'location': 'pingjiang', 'haunts': [{'location': 'pingjiang', 'zone': 'noble', 'weight': 1}, {'location': 'longan', 'zone': 'palace', 'weight': 0.3}],
         'background': '憲章「五席」裡萍江的官府席。她和陸青禾在議會裡常常吵到深夜，吵完一起去吃宵夜。'},
    ],
    'npc_yh_hu_jiuniang': [
        {'requires': {'flags': ['yhpol_republic']}, 'location': 'quanzhou', 'fixed': {'area': 'quanzhou/fanfang', 'x': 7, 'y': 1},
         'background': '共和之後，胡記的皇商特許被公議會廢了。她沒有哭，只是把胡記的招牌從「皇商」改成「胡記」，第二天照常開門，價錢比金玉行便宜一成。'},
        {'requires': {'flags_any': ['yhpol_monarchy', 'yhpol_constitution']}, 'location': 'quanzhou', 'fixed': {'area': 'quanzhou/fanfang', 'x': 7, 'y': 1},
         'background': '胡記商幫的當家。新政之後皇商特許還在，只是多了議會的查帳；她說查就查，胡記的帳比市舶司乾淨。'},
    ],
    'npc_yh_jin_yutang': [
        {'requires': {'flags_any': ['yhpol_republic', 'yhpol_constitution']}, 'location': 'quanzhou', 'fixed': {'area': 'quanzhou/shibo', 'x': 5, 'y': 1},
         'background': '金墨盟的盟主，議會裡金黃鱗的那一席。三十艘船的海貨照跑，她說現在最大的生意，是讓大燁的法比船跑得還快。'},
        {'requires': {'flags': ['yhpol_monarchy']}, 'location': 'quanzhou', 'fixed': {'area': 'quanzhou/shibo', 'x': 5, 'y': 1},
         'background': '女帝親政之後，金墨盟被勒令改組。她把盟裡的激進派送走，自己留下來跟朝廷談生意——她說，船總要開的。'},
    ],
}
for _n in NPCS:
    if _n['id'] in POLITICS:
        _n['stages'] = POLITICS[_n['id']] + _n.get('stages', [])
# 政治線下半「南北交會」（east_p8d.py）：媞丹贏了鷹河之戰時，禁軍統帥被俘，關在金帳王庭北院的戰俘營
_SOUTH_NORTH = {
    'npc_yh_yue_zhenshan': [
        {'requires': {'flags': ['nspol_war_tidan']}, 'location': 'jinzhang', 'fixed': {'area': 'jinzhang/beiyuan', 'x': 1, 'y': 1},
         'background': '鷹河之戰兵敗被俘的大燁禁軍統帥，關在金帳王庭北院的戰俘營。媞丹沒有殺他：天可汗說，敬重對手是草原的規矩，等龍安府拿歲幣來贖。他每天在柵欄後面練拳，看守的怯薛偷偷跟著學。'},
    ],
}
for _n in NPCS:
    if _n['id'] in _SOUTH_NORTH:
        _n['stages'] = _SOUTH_NORTH[_n['id']] + _n.get('stages', [])

# 特殊任務用到的人（開頭、任務點、友方、同行）不能被偷襲（builtinStories.spec）：從 stories.json 找出來
def _story_npcs():
    out = set()
    for st in json.load(open('data/rules/stories.json', encoding='utf-8'))['stories']:
        if st['start'].get('npc'):
            out.add(st['start']['npc'])
        for n in st['nodes']:
            if n.get('at', {}).get('npc'):
                out.add(n['at']['npc'])
            out.update(n.get('allies', []))
            for o in [n.get('success'), n.get('fail')] + [x for opt in n.get('options', []) for x in (opt.get('success'), opt.get('fail'))]:
                if o and o.get('join'):
                    out.add(o['join'])
    return out


STORY_NPCS = _story_npcs()
for _n in NPCS:
    if _n['id'] in STORY_NPCS:
        _n['no_attack'] = True

# 第 5.4 節的關係網（雙向）
RELATIONS = [
    ('npc_yh_zhaohua', 'npc_yh_wen_yi', '母后：心疼她，卻總替舅舅說話。', '女兒：心疼她一個人撐著天下，又忍不住替哥哥說話。'),
    ('npc_yh_wen_yi', 'npc_yh_hu_yuxiao', '先帝的寵妃，鬥了半輩子，如今是隔著一道月洞門的鄰居。', '先帝的皇后：鬥了半輩子，現在最愛看她被自己氣得說不出話。'),
    ('npc_yh_hu_yuxiao', 'npc_yh_hu_jiuniang', '姪女：胡記的皇商特許是自己替她求來的。', '姑母：胡記的皇商特許是她當年在先帝枕邊求來的。'),
    ('npc_yh_wen_yi', 'npc_yh_wen_shiheng', '哥哥：在政事上向著他。', '妹妹：太后，在宮裡替自己說話的人。'),
    ('npc_yh_zhaohua', 'npc_yh_wen_shiheng', '宰相、舅舅：君臣互相防備。', '女帝、外甥女：君臣互相防備，嫌她太急。'),
    ('npc_yh_zhaohua', 'npc_yh_wen_ruyu', '最信任的心腹，雖然是宰相的姪女。', '效忠的人：宰相以為自己是他的眼睛。'),
    ('npc_yh_zhaohua', 'npc_yh_yue_zhenshan', '忠誠的禁軍統帥。', '效忠的君主；禁軍的欠餉讓他愧對她，也愧對弟兄。'),
    ('npc_yh_wen_shiheng', 'npc_yh_ye_guhong', '點青出身的狀元：處處打壓。', '宰相：處處打壓自己，也在動貢院的考卷。'),
    ('npc_yh_ye_guhong', 'npc_yh_shen_zhilan', '欣賞她的筆，說她要是去考科舉，會是狀元。', '欣賞自己的太學主考官，常偷偷看自己的話本。'),
    ('npc_yh_su_huaijin', 'npc_yh_lu_qinghe', '萍江的另一邊：彼此欣賞，彼此提防。', '知府：欣賞她守法，恨她守的是朝廷的法。'),
    ('npc_yh_lu_qinghe', 'npc_yh_jin_yutang', '金墨盟的盟主：盟內的路線之爭，她要立憲，自己要共和。', '盟裡最激進的一派：太急，卻是盟裡最有膽的人。'),
    ('npc_yh_jin_yutang', 'npc_yh_hu_jiuniang', '瑔州港的對手：胡記的皇商特許是眼中釘。', '瑔州港的對手：金黃鱗的海商，想搶胡記的地盤。'),
    ('npc_yh_hu_jiuniang', 'npc_yh_hu_taiye', '城裡的狐與屯裡的狐：遠房的叔公，互看不順眼。', '城裡胡記的遠房姪女：忘了青丘，見面從不說話。'),
    ('npc_yh_hu_sanniang', 'npc_yh_bai_xiaoqiao', '自己的二神：請仙送仙都靠她的鼓。', '自己是她的二神：最捨不得的人。'),
    ('npc_yh_qin_yan', 'npc_yh_apao', '學徒：冒失得讓人頭痛，卻是坊裡最有天分的。', '師父：嘴上罵，其實最疼自己。'),
    ('npc_yh_chihuan', 'npc_yh_cheng_yan', '市舶司的提舉：每個月替自己簽放行，自己替他還賭債。', '走私女王：每個月替她簽放行，收她的錢。'),
    ('npc_yh_xiao_fengyi', 'npc_yh_wen_shiheng', '宰相：戲班替他打聽消息，也替女帝打聽。', '瓦舍的勾欄之主：好用的耳目，但不可信。'),
    ('npc_yh_yaoting', 'npc_reno_deeptide', '潮汐港深潮席的老酒友，寫信比誰被灌醉的次數多。', None),
    ('npc_yh_hastings', 'npc_carlos_blacksail', '潮汐港的走私王：自己的貨被他的人盯上過。', None),
    # 炎華北原的人（east_p7_people.py 寫北原那一邊）
    ('npc_yh_zhaohua', 'npc_td_wanning', '遠房的妹妹：送去媞丹和親的宗室女。', None),
    ('npc_yh_hu_jiuniang', 'npc_td_hu_zhanggui', '胡記在鷹河榷場的分號掌櫃：信裡寫的是榷場的消息。', None),
    ('npc_yh_wen_shiheng', 'npc_td_su_shiyong', '派去媞丹王庭的歲幣使節：自己的人，每個月寫信回來。', None),
    # 地方上的小關係
    ('npc_yh_qian', 'npc_yh_xiaozhu', '自家茶坊的跑堂，勤快，就是老做白日夢。', '茶坊的老闆：摳門，但從不少給工錢。'),
    ('npc_yh_shen_zhilan', 'npc_yh_xiao_fengyi', '勾欄之主：說書人都在講自己的話本。', '寫話本的瀾生：最好的戲都出自她的手，也最會惹禍。'),
    ('npc_yh_yue_zhenshan', 'npc_yh_zhao_hu', '欠餉的部下：好賭，但最講義氣。', '統帥：對不起弟兄的不是他，是朝廷。'),
    ('npc_yh_huiyin', 'npc_yh_old_tomb_keeper', '守永昭陵的老陵戶：知道祭文沒寫的事。', '太廟的女祭司：常來問陵裡的事。'),
    ('npc_yh_lu_qinghe', 'npc_yh_ruan', '織造局的掌事：墨鐵鱗出身，卻忘了自己是誰。', '織工行會的頭：說自己忘本。'),
    ('npc_yh_su_huaijin', 'npc_yh_pang_yasi', '押送花石綱的軍官：貪，可是有宮裡撐腰。', '知府：礙事。'),
    ('npc_yh_xie_qingwu', 'npc_yh_yao_bo', '千窯谷的老窯工：唯一看得懂藏瓷閣那只盞的人。', '萍園的畫師：瓷癡，但眼光好。'),
    ('npc_yh_jin_yutang', 'npc_yh_haiyao', '船隊裡最年輕的船長，也最不要命。', '盟主、老闆：給自己船的人。'),
    ('npc_yh_rat_knife', 'npc_yh_qin_yan', '火藥坊的倖存者：知道那天的事，自己手上有他要的東西。', '在廢墟裡撿東西的拾荒頭目：手上可能有那天的帳本。'),
    ('npc_yh_huang_dadan', 'npc_yh_hu_sanniang', '弟馬：額頭上的符是她給的，好像沒什麼用。', '屯裡最倒霉的獵戶：被黃皮子討封答錯了。'),
]


def apply_relations(npcs):
    by = {n['id']: n for n in npcs}
    for a, b, ta, tb in RELATIONS:
        if a in by:
            by[a].setdefault('relations', {})[b] = ta
        if b in by and tb:
            by[b].setdefault('relations', {})[a] = tb


# 內建的兩位：補上回頭的關係（直接改那一行的 relations，不動檔案其他地方的排版）
BUILTIN_BACK = {
    'npc_reno_deeptide': ('npc_yh_yaoting', '瑔州港的玉璘族使節瑤汀：老酒友，寫信比誰被灌醉的次數多。'),
    'npc_carlos_blacksail': ('npc_yh_hastings', '跑東大陸的商人哈斯丁：手下盯過他的貨，下次換大一點的船。'),
}


def patch_builtin(lines):
    for npc, (key, text) in BUILTIN_BACK.items():
        start = next(i for i, l in enumerate(lines) if l.lstrip().startswith('{ "id": "%s"' % npc))
        end = next(i for i in range(start + 1, len(lines)) if lines[i].lstrip().startswith('{ "id": ') or lines[i].strip() == ']')
        for i in range(start, end):
            if '"relations": {' in lines[i]:
                if '"%s"' % key in lines[i]:
                    break
                lines[i] = lines[i].replace('"relations": { ', '"relations": { "%s": %s, ' % (key, json.dumps(text, ensure_ascii=False)), 1)
                break
        else:
            raise SystemExit(f'{npc} 找不到 relations')


def main():
    src = open(PATH, encoding='utf-8').read()
    for n in NPCS:
        n.setdefault('relations', {})
        assert len(n['name']) <= 12 and len(n.get('occupation', '')) <= 12, n['id']
        assert len(n['personality']) <= 160, (n['id'], len(n['personality']))
        assert len(n['appearance']) <= 240, (n['id'], len(n['appearance']))
        assert len(n.get('background', '')) <= 400, n['id']
    apply_relations(NPCS)
    # 這支腳本加的人一行一位，重跑時先拿掉
    lines = [l for l in src.rstrip('\n').split('\n') if not l.startswith('    {"id": "npc_yh_')]
    patch_builtin(lines)
    close = max(i for i, l in enumerate(lines) if l == '  ]')
    if not lines[close - 1].rstrip().endswith(','):
        lines[close - 1] = lines[close - 1] + ','
    new = ['    ' + json.dumps(n, ensure_ascii=False) + ',' for n in NPCS]
    new[-1] = new[-1][:-1]
    lines[close:close] = new
    out = '\n'.join(lines) + '\n'
    data = json.loads(out)
    ids = [n['id'] for n in data['npcs']]
    assert len(ids) == len(set(ids)), '重複的 id'
    open(PATH, 'w', encoding='utf-8').write(out)
    print(f'固定 NPC {len(NPCS)} 位，關係 {len(RELATIONS)} 組')


if __name__ == '__main__':
    main()


# ---------- 世界書「人物-炎华南域」（python3 east_p3_npcs.py --worldbook） ----------
INTRO = {
    'npc_yh_zhaohua': '大烨的女帝，登基五年，强势勤政，被海贸与火药带来的变革逼得焦头烂额',
    'npc_yh_wen_shiheng': '宰相，太后的哥哥，朝中保守派之首',
    'npc_yh_yue_zhenshan': '殿前都指挥使，朱砂鳞武人之首，禁军已欠饷三个月',
    'npc_yh_ye_guhong': '太学主考官，墨铁鳞出身、点青的状元',
    'npc_yh_shen_zhilan': '写讽刺朝政话本的作家「澜生」，短发男装打扮',
    'npc_yh_huiyin': '太庙的女祭司，研究祖龙的传说',
    'npc_yh_xiao_fengyi': '勾栏之主，瓦舍二十座勾栏有十二座是她的，戏班替各方打听消息',
    'npc_yh_wen_ruyu': '尚寝局的司寝女官，宰相的侄女，却是女帝的心腹',
    'npc_yh_qian': '御街夜市的茶坊老板，消息灵通',
    'npc_yh_xiaozhu': '茶坊的跑堂，想去瑔州港看海',
    'npc_yh_zhao_hu': '欠饷禁军的小队长，好赌',
    'npc_yh_old_tomb_keeper': '世代守永昭陵的陵户',
    'npc_yh_wen_yi': '太后：先帝的皇后、女帝的生母、宰相的妹妹，寡居多年',
    'npc_yh_hu_yuxiao': '太妃：先帝最宠的灵狐族妃子、胡九娘的姑母，太妃宫真正的主人',
    'npc_yh_su_huaijin': '萍江府的女知府，冷静守法，奉命办花石纲',
    'npc_yh_lu_qinghe': '织工行会的头、金墨盟里共和派的领袖',
    'npc_yh_xie_qingwu': '萍园的主人，常穿女装作画的美人画师，收藏天青瓷成痴',
    'npc_yh_xuanshuang': '灵虚观的女冠，世家女出家，修双修之道',
    'npc_yh_qingluo': '竹湖畔生来带着蛇相的女子，从小被当成蛇妖避开',
    'npc_yh_yao_bo': '千窑谷最后一位老窑工',
    'npc_yh_pang_yasi': '押送花石纲的贪婪军官',
    'npc_yh_ruan': '织造局的掌事，点青出身的小官',
    'npc_yh_hu_jiuniang': '胡记商帮的当家，掌朝廷的茶引、盐引与香料专卖',
    'npc_yh_jin_yutang': '金黄鳞的女海商、金墨盟的盟主（温和派，倾向立宪）',
    'npc_yh_qin_yan': '火药坊的总匠师，四年前爆炸的幸存者',
    'npc_yh_cheng_yan': '市舶司提举，夹在胡记与金黄鳞海商之间的官',
    'npc_yh_haiyao': '女船长，用指南鱼远航到过北原的海岸',
    'npc_yh_yaoting': '玉璘族夏澜殿派驻瑔州港的使节，爱宴饮',
    'npc_yh_apao': '秦焰的学徒，冒失的假小子',
    'npc_yh_chihuan': '走私女王，港外的船舱里开赌局、做黑市',
    'npc_yh_hastings': '潮汐港来的蕃商，在蕃坊开了一间货栈',
    'npc_yh_rat_knife': '在火药坊遗址捡东西的拾荒人头目',
    'npc_yh_hu_taiye': '青丘屯的屯长，老猎户，不愿意改祀',
    'npc_yh_hu_sanniang': '出马的弟马，附身的是胡家的老仙「胡三太奶」',
    'npc_yh_bai_xiaoqiao': '胡三娘的二神（香童），敲文王鼓唱神调',
    'npc_yh_huang_dadan': '年轻猎户，被黄皮子讨封答错了，从此倒霉',
}
TOWNS = [('longan', '龙安府'), ('pingjiang', '萍江府'), ('quanzhou', '瑔州港'), ('qingqiu', '青丘屯')]


def write_worldbook():
    wb_path = 'data/worldbook/elondia.worldbook.json'
    wb = json.load(open(wb_path, encoding='utf-8'))
    lms = {l['id']: l['name'] for l in json.load(open('data/world/landmarks.json', encoding='utf-8'))['landmarks']}
    by_loc = {}
    for n in NPCS:
        by_loc.setdefault(n['location'], []).append(n)
    lines = ['重要人物-炎华南域（当代）:']
    for loc, label in TOWNS:
        lines.append(f'  {label}:')
        for n in by_loc.get(loc, []):
            where = lms[n['landmark']] if n.get('landmark') else '走动'
            town_label = {'longan': '龍安府', 'pingjiang': '萍江府', 'quanzhou': '瑔州港', 'qingqiu': '青丘屯'}[loc]
            lines.append(f"    - {n['name']}（{town_label}{'・' + where if where != '走动' else '走動'}）: '{INTRO[n['id']]}'")
    content = '\n'.join(lines)
    entries = wb['entries']
    old = next((k for k, e in entries.items() if e['comment'] == '人物-炎华南域'), None)
    if old is None:
        tpl = next(e for e in entries.values() if e['comment'] == '人物-东海群岛')
        uid = max(int(e['uid']) for e in entries.values()) + 1
        e = json.loads(json.dumps(tpl))
        e.update({'uid': uid, 'comment': '人物-炎华南域', 'displayIndex': 53})
        entries[str(uid)] = e
        old = str(uid)
    entries[old]['content'] = content
    entries[old]['key'] = [n['name'] for n in NPCS]
    open(wb_path, 'w', encoding='utf-8').write(json.dumps(wb, ensure_ascii=False, indent=2) + '\n')
    print('世界書：人物-炎华南域')


if __name__ == '__main__' and __import__('sys').argv[1:] == ['--worldbook']:
    write_worldbook()
