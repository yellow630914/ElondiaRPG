"""炎華之地 P4c：政治線上半「大燁的政體」（6 條，Lv.12～15）。EAST_CONTENT_PLAN 8.3、8.7 節。

③ 萬民書的最後一步依計數器決定能選哪幾種政體（條件沒有「或」，君主立憲拆成兩個選項）：
- 君主制：yh_reform ≤ -2　- 共和制：yh_reform ≥ 2　- 君主立憲：yh_balance ≥ 3，或 yh_reform 在 -1～1
至少一個一定能選。選了之後開始對應的終章（④），終章在「宣德樓的城樓」特殊地圖裡打。
結局旗標：yhpol_monarchy／yhpol_republic／yhpol_constitution（NPC 的階段在 east_p3_npcs.py）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p4c.py
"""

from east_story_io import write_stories
from east_story_kit import COURT, LEAGUE, aff, at_npc, cell, check, fight, item, mem, node, rep, story, town

ZHAOHUA, WEN, RUYU, YUE, SU, LU, JIUNIANG, JIN, TAIYE, HUIYIN, SHEN = (
    'npc_yh_zhaohua', 'npc_yh_wen_shiheng', 'npc_yh_wen_ruyu', 'npc_yh_yue_zhenshan', 'npc_yh_su_huaijin', 'npc_yh_lu_qinghe',
    'npc_yh_hu_jiuniang', 'npc_yh_jin_yutang', 'npc_yh_hu_taiye', 'npc_yh_huiyin', 'npc_yh_shen_zhilan')
TOWER = 'sm_yh_xuande_tower'


def tower(x=5, y=2):
    return {'where': 'special', 'special_map': TOWER, 'x': x, 'y': y}


# 各地故事線的結局（至少走完一條才會被女帝召見）
REGION_ENDS = [f'{p}_end_{e}' for p in ('yhk', 'yhj', 'yhs', 'yhw', 'yhx', 'yhg', 'yhq') for e in ('court', 'people', 'balance')]


def summon(id, title, requires, text, flag):
    """溫如玉把主角帶上宣德樓（傳送到城樓的特殊地圖）"""
    return node(id, title, text, cell('longan', 'guild'), requires, allies=[RUYU],
                success={'text': '溫如玉領著你從皇城的側門走進去，穿過三道宮門，登上宣德樓。', 'set_flags': [flag], 'special_map': TOWER})


def finale(id, title, summary, start_text, start_flag, fights, end_text, end_flag, effects):
    nodes = []
    req = start_flag
    for i, (ftitle, ftext, enemies, win) in enumerate(fights):
        flag = f'{id}_f{i + 1}'
        nodes.append(fight(f'fight{i + 1}', ftitle, ftext, tower(), req, enemies, win,
                           '你們被逼退到城樓的角落。喘口氣——宣德樓還沒有失守。', win_flags=[flag]))
        req = flag
    nodes.append(node('end', '在宣德樓的城樓上看大燁的新局', end_text[0], tower(), req, allies=[ZHAOHUA],
                      success={'text': end_text[1], 'set_flags': ([end_flag] if isinstance(end_flag, str) else list(end_flag)) + ['yhpol_done'], 'effects': effects, 'complete': True}))
    return story(id, 'S', title, summary, {'kind': 'manual', 'min_level': 15, 'text': start_text}, start_flag, nodes,
                 extra_rewards=[{'type': 'item', 'name': '精金礦石', 'qty': 1}])


STORIES = [
    story('yhpol_new_policy', 'A', '女帝的新政',
          '女帝燁昭華頒布了新政：改稅制、開言路、整頓科舉。新政點燃了各地的火，她要一個不屬於任何派系的外人，當她的眼睛。',
          {'kind': 'guild', 'location': 'longan', 'min_level': 12, 'requires': {'flags_any': REGION_ENDS},
           'text': '公會的主管把一封蓋著朱印的信推到你面前，信封上沒有字。送信的人站在門口——尚寢局的司寢女官溫如玉：「陛下要見你。不是以朝廷的名義，是以她自己的名義。」'},
          'yhpol_1_started', [
              summon('summon', '在龍安府的公會跟溫如玉進宮', 'yhpol_1_started',
                     '溫如玉低聲說：「陛下聽說了你在各地做的事——你幫過朝廷，也幫過朝廷的對頭。所以她才要見你。」', 'yhpol_summoned'),
              node('audience', '在宣德樓的城樓上見女帝燁昭華',
                   '女帝背對著你，看著城下的龍安府。她沒有穿龍袍，只披著一件素色的外衣，手裡捧著一杯早就涼了的茶：「朕的新政，改稅、開言路、糊名取士。朝中說朕太急，民間說朕太慢。朕要知道，外面到底燒成什麼樣了。」',
                   tower(), 'yhpol_summoned', allies=[ZHAOHUA],
                   success={'text': '她轉過身，第一次正眼看你：「去萍江、去瑔州港看看。不要告訴朕你覺得朕想聽的——告訴朕你看見的。」',
                            'set_flags': ['yhpol_eyes'], 'effects': [aff(ZHAOHUA, 8, '答應當她的眼睛')]}),
              node('pingjiang', '到萍江府看新政下的官府與織工',
                   '萍江府的告示牆上貼著新政的稅則，旁邊被人用炭寫了一行大字：「稅改了，工錢呢？」知府衙門前，蘇懷瑾與陸青禾隔著一條街，各自對著自己的人說話。',
                   at_npc(SU, 'pingjiang'), 'yhpol_eyes',
                   success={'text': '蘇懷瑾說：「新政是對的，可是太快了，底下的人跟不上。」陸青禾在街對面喊：「快？我們等了三百年！」', 'set_flags': ['yhpol_seen_ping']}),
              check('quanzhou', '到瑔州港看新政下的商人',
                    '瑔州港的海貿會館裡，胡九娘與金玉棠難得坐在同一張桌子邊——為了新政的抽分則例吵了一整個下午。',
                    town('quanzhou'), 'yhpol_seen_ping', 'cha', 15,
                    '你聽完兩邊的話：胡九娘怕新政拿走皇商特許，金玉棠怕新政只是換個名目收稅。她們唯一的共識是：「女帝要是不給我們說話的位子，新政就是一張紙。」',
                    '兩邊都把你當成對方的說客，什麼都不肯說。換個時候再來。', win_flags=['yhpol_seen_quan']),
              node('report', '回龍安府的公會向溫如玉回報',
                   '溫如玉聽完，把你說的每一句話都記在一本小冊子上：「陛下會看的。」她頓了一下，「宰相府這幾天進出的人很多。胡記的人、殿前司的人……你小心一點。」',
                   cell('longan', 'guild'), 'yhpol_seen_quan', allies=[RUYU],
                   success={'text': '她把一枚刻著「昭」字的玉牌交給你：「以後要見陛下，拿這個來找我。」',
                            'set_flags': ['yhpol_1_done'], 'effects': [aff(RUYU, 8, '替女帝看了各地的新政'), mem('受女帝燁昭華之託，到萍江府與瑔州港看新政點燃的火：各方都要一個說話的位子。', 3)],
                            'complete': True}),
          ]),
    story('yhpol_backlash', 'A', '宰相的反撲',
          '宰相溫世衡聯合胡記商幫與殿前司的幾營禁軍，要逼女帝收回新政。他們先要除掉的，是女帝的眼睛。',
          {'kind': 'guild', 'location': 'longan', 'min_level': 13, 'requires': {'flags': ['yhpol_1_done']},
           'text': '公會的主管臉色發白，把門關上：「相府的人來問過你的住處。三個殿前司的軍官、兩個胡記的掌櫃，昨晚都進了相府。龍安府要變天了。」'},
          'yhpol_2_started', [
              fight('ambush', '晚上在龍安府擋下相府的刺客', '回旅店的路上，巷子兩頭同時被堵住：兩個蒙面的死士，一個穿著殿前司甲冑的甲士。',
                    town('longan'), 'yhpol_2_started', [['yh_deathsworn', 2], ['yh_palace_guard', 1]],
                    '最後一個死士咬破了毒丸。甲士的懷裡有一份名單——上面是你的名字、溫如玉的名字，還有葉孤鴻與沈知瀾。', win_flags=['yhpol_ambushed'], hours='night', urgent=True),
              node('evidence', '在龍安府的太廟和慧音商量拿什麼對付宰相',
                   '慧音關上太廟的門：「宰相要在朝會上逼陛下收回新政，說新政『動搖祖制』。要對付他，得讓滿朝的人知道，『祖制』是怎麼來的。」',
                   cell('longan', 'lm_yh_taimiao'), 'yhpol_ambushed', 'choice', allies=[HUIYIN], options=[
                       {'label': '拿出永昭陵的帛書', 'requires': {'flags': ['yhy_3_done']},
                        'success': {'text': '慧音捧著溫氏先祖寫的祭文原稿，手在發抖：「這一卷，足夠讓宰相在朝會上說不出『祖制』兩個字。」',
                                    'set_flags': ['yhpol_evidence', 'yhpol_ev_tomb']}},
                       {'label': '拿出火藥坊爆炸的證據', 'requires': {'flags': ['yhb_2_done']},
                        'success': {'text': '「坊中人不得撤」——慧音讀完那一行字，閉上眼睛：「軍器監的令，是相府擬的。三百條人命，朝會上會有人聽的。」',
                                    'set_flags': ['yhpol_evidence', 'yhpol_ev_powder']}},
                       {'label': '沒有證據，只能說服朝臣', 'check': {'attr': 'cha', 'dc': 16},
                        'success': {'text': '你和慧音分頭去找朝中還沒表態的大臣：葉孤鴻、岳鎮山、幾個寒門出身的御史。一夜之間，朝會上多了十幾個不會跟著宰相喊的人。',
                                    'set_flags': ['yhpol_evidence']},
                        'fail': {'text': '大臣們都閉門不見。宰相府的燈一直亮到天亮。再找找別的門路。', 'retry': True}},
                   ]),
              summon('summon', '在龍安府的公會跟溫如玉進宮', 'yhpol_evidence',
                     '溫如玉的手在發抖，聲音卻很穩：「朝會已經開始了。宰相帶著殿前司的人站在殿外。陛下要你在城樓上——那裡看得到整個朝堂。」', 'yhpol_court'),
              node('court', '在宣德樓的城樓上看朝會的對決',
                   '城樓下的大殿裡，宰相溫世衡跪在殿中，聲淚俱下地請陛下「收回亂政、以安祖制」。殿外，殿前司的甲士按著刀。女帝一言不發，等著。',
                   tower(), 'yhpol_court', allies=[ZHAOHUA],
                   success={'text': '證據呈上去的那一刻，大殿安靜得聽得見燭火的聲音。宰相的臉色變了又變，最後叩首退下。殿前司的甲士收了刀——但沒有散。女帝回到城樓上，第一次對你說了一句「謝謝」，又說：「他不會就這樣算了。」',
                            'set_flags': ['yhpol_2_done'], 'effects': [aff(ZHAOHUA, 10, '在朝會上替她擋下宰相'), aff(WEN, -15, '在朝會上和他作對'),
                                                                       mem('宰相溫世衡在朝會上要逼女帝收回新政，被呈上的證據擋了回去；殿前司的甲士沒有散。', 3)],
                            'complete': True}),
          ]),
    story('yhpol_petition', 'S', '萬民書',
          '萍江的織工、瑔州港的海商、青丘屯的狐，三地的陳情一起湧進龍安府。御街上聚滿了人，宰相的兵也來了。女帝要問你：大燁該走哪一條路。',
          {'kind': 'guild', 'location': 'longan', 'min_level': 14, 'requires': {'flags': ['yhpol_2_done']},
           'text': '公會外的御街上擠滿了人：萍江的織工舉著工歌的布條，瑔州港的海商扛著抽分的帳本，青丘屯的老狐拄著榆木杖。他們手裡都捧著同一卷東西——萬民書。'},
          'yhpol_3_started', [
              node('gather', '到龍安府的御街夜市看萬民書的大集會',
                   '御街從宣德樓下一路擠到夜市盡頭。陸青禾站在一輛馬車上唸萬民書，金玉棠與胡九娘一左一右，胡太爺拄著杖站在最前面。人群安靜得只聽得見她的聲音。',
                   cell('longan', 'lm_yh_night_market'), 'yhpol_3_started', allies=[LU, JIN],
                   success={'text': '唸到最後一句「請陛下與萬民共議」，人群裡爆出一片喊聲。街口傳來整齊的腳步聲——殿前司的甲士來了。', 'set_flags': ['yhpol_crowd']}),
              fight('clash', '在龍安府的御街擋住驅散人群的甲士', '殿前司的甲士舉著長槍往人群裡推，相府的死士混在人群裡，專挑帶頭的下手。',
                    cell('longan', 'lm_yh_night_market'), 'yhpol_crowd', [['yh_palace_guard', 2], ['yh_deathsworn', 1]],
                    '甲士們退了。岳鎮山帶著禁軍從另一頭趕到，擋在人群與殿前司之間：「誰再動百姓，先過我這一關。」', win_flags=['yhpol_crowd_safe'], urgent=True),
              summon('summon', '在龍安府的公會跟溫如玉進宮', 'yhpol_crowd_safe',
                     '溫如玉渾身是汗地跑來：「陛下在城樓上看完了全部。她說——該問你了。」', 'yhpol_hall'),
              node('verdict', '在宣德樓的城樓上回答女帝：大燁該走哪一條路',
                   '女帝站在城樓上，看著御街上還沒散去的人群。這一次她沒有捧著茶：「科舉、軍餉、花石綱、罷織、香料、火藥、堂口——你都在場。你看見了大燁的每一道裂縫。朕問你：大燁，該怎麼走？」',
                   tower(), 'yhpol_hall', 'choice', allies=[ZHAOHUA], options=[
                       {'label': '「陛下親政，收回權柄」', 'requires': {'counters': {'yh_reform': {'max': -2}}},
                        'success': {'text': '女帝沉默了很久：「各地的火，都是朕不夠強才燒起來的。好。」她轉身下樓，背影像一把出鞘的劍。城下傳來消息：金墨盟的激進派聽說了，要攻宣德樓。',
                                    'set_flags': ['yhpol_route_monarchy', 'yhpol_3_done'], 'effects': [{'type': 'start_story', 'story': 'yhpol_end_monarchy'}], 'complete': True}},
                       {'label': '「讓萬民共議，陛下退位」', 'requires': {'counters': {'yh_reform': {'min': 2}}},
                        'success': {'text': '女帝看著你，忽然笑了，笑得很累：「三百年了，總該有人說這句話。」她摘下頭上的玉簪。城下傳來消息：宰相帶著殿前司三營，要在退位詔書頒布之前「清君側」。',
                                    'set_flags': ['yhpol_route_republic', 'yhpol_3_done'], 'effects': [{'type': 'start_story', 'story': 'yhpol_end_republic'}], 'complete': True}},
                       {'label': '「與萬民立憲（各方都退了一步）」', 'requires': {'counters': {'yh_balance': {'min': 3}}},
                        'success': {'text': '女帝想了很久：「你在每一個地方，都讓兩邊各退了一步。那就讓朕也退一步——也讓他們退一步。」城下傳來消息：宰相與激進派兩邊都不肯，各自帶人往宣德樓來了。',
                                    'set_flags': ['yhpol_route_constitution', 'yhpol_3_done'], 'effects': [{'type': 'start_story', 'story': 'yhpol_end_constitution'}], 'complete': True}},
                       {'label': '「與萬民立憲（兩邊勢均力敵）」', 'requires': {'counters': {'yh_reform': {'min': -1, 'max': 1}}},
                        'success': {'text': '女帝看著城下：「朝廷壓不住民間，民間也推不倒朝廷。那就寫下來，誰也不能多拿。」城下傳來消息：宰相與激進派兩邊都不肯，各自帶人往宣德樓來了。',
                                    'set_flags': ['yhpol_route_constitution', 'yhpol_3_done'], 'effects': [{'type': 'start_story', 'story': 'yhpol_end_constitution'}], 'complete': True}},
                   ]),
          ]),
    finale('yhpol_end_monarchy', '親政',
           '女帝決定親政，收回權柄。金墨盟的激進派不肯，帶著火槍與火藥攻上宣德樓。（政治線上半・終章：君主制）',
           '城樓下火光沖天，激進派的火頭帶著火槍手衝破了宮門，霹靂火球在宣德樓的簷下炸開。', 'yhpol_monarchy_started',
           [('擋住攻上宣德樓的激進派', '激進派的火頭一腳踢開城樓的門，身後的火槍手舉起了火銃：「女帝收權的那一天，宣德樓就該燒掉！」',
             [['yh_radical_firebrand', 1], ['yh_league_musketeer', 1]], '火頭倒下了，宣德樓的火被禁軍撲滅。城下的人群看著城樓，一片死寂。')],
           ('女帝站在燒焦的城樓上，看著龍安府：「從今天起，朕親自看每一份奏摺、每一筆帳。宰相罷相，閉門思過；激進派的頭目下獄。各地的火，朕親手熄。」',
            '大燁進入了女帝親政的時代：朝廷與胡記得勢，金墨盟的激進派星散，宰相退出朝堂。女帝比以前更強，也更孤單——她在城樓上喝茶的時候，身邊多了一個位子。'),
           'yhpol_monarchy', [item('宣德寶劍'), rep(COURT, 8), rep(LEAGUE, -8), aff(ZHAOHUA, 15, '陪她走上親政'), aff(LU, -15, '站在朝廷那一邊'),
                               mem('大燁的政體走向君主制：女帝燁昭華親政收權，宰相罷相，金墨盟的激進派星散。', 3)]),
    finale('yhpol_end_republic', '公議',
           '女帝決定退位，讓公議會治國。宰相帶著殿前司三營要「清君側」，在退位詔書頒布之前攻上宣德樓。（政治線上半・終章：共和制）',
           '殿前司的甲士封住了皇城的每一道門。宰相的禁軍統領提著長刀，一步一步走上宣德樓的台階。', 'yhpol_republic_started',
           [('擋住宰相的禁軍統領', '禁軍統領站在城樓口，長刀指著女帝：「陛下累了。退位詔書，由相府代擬。」',
             [['yh_chancellor_marshal', 1], ['yh_palace_guard', 1]], '禁軍統領跪倒在城樓上。城下，岳鎮山帶著禁軍圍住了相府。')],
           ('女帝親手在退位詔書上蓋了最後一次玉璽，把詔書交給陸青禾：「大燁交給你們了。吵吧，吵出一條路來。」',
            '大燁成了共和：公議會在太學的講堂開議，陸青禾當選首席，金墨盟與行會得勢。宰相出逃，朝廷通緝死忠的保守派。燁昭華搬出了皇城，住進貴族坊一間普通的宅子——她說這是她五年來睡得最好的一覺。皇城的門從此向所有人打開。'),
           ['yhpol_republic', 'palace_permit_longan'], [item('公議之印'), rep(LEAGUE, 8), rep(COURT, -6), aff(LU, 15, '陪她走上公議'), aff(ZHAOHUA, 8, '讓她卸下了天下'),
                               mem('大燁的政體走向共和制：女帝燁昭華退位，公議會治國，陸青禾當選首席，宰相出逃。', 3)]),
    finale('yhpol_end_constitution', '憲章',
           '女帝決定與萬民立憲。宰相與激進派兩邊都不肯，各自帶人攻上宣德樓。（政治線上半・終章：君主立憲制）',
           '宣德樓的東門是殿前司的甲士，西門是激進派的火槍手。兩邊都說自己是來「救駕」的。', 'yhpol_constitution_started',
           [('擋住從東門攻上來的禁軍統領', '禁軍統領先到一步：「陛下要立憲？那就是要把祖宗的江山分給商人和織工。」',
             [['yh_chancellor_marshal', 1], ['yh_palace_guard', 1]], '禁軍統領倒下，東門的甲士放下了刀。西門那邊，火光已經燒上來了。'),
            ('擋住從西門攻上來的激進派', '激進派的火頭衝上城樓：「立憲？不過是換個名字的皇帝！」',
             [['yh_radical_firebrand', 1], ['yh_league_musketeer', 1]], '火頭倒下，城樓上只剩下風聲。')],
           ('女帝、蘇懷瑾、陸青禾、胡九娘、金玉棠，五個人圍著一張桌子坐在燒焦的城樓上。憲章寫了一夜：皇權寫在第一條，限制皇權的寫在第二條到第三十條。',
            '大燁成了君主立憲：女帝與議會共治，憲章限制皇權也保障各方。朝廷、萍江的官府與農工、瑔州港的胡記與金黃鱗，各有一席——人們叫它「五席」。女帝簽下憲章的時候，回頭看了你一眼。'),
           'yhpol_constitution', [item('憲章玉璽'), rep(COURT, 5), rep(LEAGUE, 5), aff(ZHAOHUA, 12, '陪她寫下憲章'), aff(SU, 8, '五席的憲章'), aff(LU, 8, '五席的憲章'),
                                  aff(JIUNIANG, 8, '五席的憲章'), aff(JIN, 8, '五席的憲章'),
                                  mem('大燁的政體走向君主立憲制：女帝與議會共治，朝廷、萍江的官府與農工、瑔州港的胡記與金黃鱗各有一席，稱為「五席」。', 3)]),
]

LINES = {'yhpol_new_policy': '政治線：大燁的政體・一', 'yhpol_backlash': '政治線：大燁的政體・二', 'yhpol_petition': '政治線：大燁的政體・三'}
for _s in STORIES:
    if _s['id'] in LINES:
        _s['summary'] += '（%s）' % LINES[_s['id']]
    elif _s['id'].startswith('yhpol_end_'):
        # 終章的簡介已經寫了括號，換成線名
        _s['summary'] = _s['summary'].rsplit('（', 1)[0] + '（政治線：大燁的政體・終）'


if __name__ == '__main__':
    write_stories(STORIES)
