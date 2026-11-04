"""炎華之地 P8c：北原的前期政治線「媞丹的走向」（6 條，Lv.13～15）。EAST_CONTENT_PLAN 11.10 節。

和南域的政治線上半（east_p4c.py）對稱。③ 那達慕之約先替一方出賽（那一方的計數器 +1），最後一步依計數器決定能選哪幾種走向
（條件沒有「或」，每種走向拆成兩個選項）：
- 大汗國：td_war ≥ 2，或替北院出賽而且三個計數器都 ≤ 1
- 南院治：td_peace ≥ 2，或替南院出賽而且三個計數器都 ≤ 1
- 海東自立：td_haidong ≥ 2，或替海東部出賽而且三個計數器都 ≤ 1
出賽的那一方的計數器至少是 1，所以至少一個一定能選（eastContinent.spec 列舉過）。選了之後開始對應的終章（④）。
結局旗標：tdpol_khanate／tdpol_south／tdpol_haidong（NPC 的階段在 east_p7_people.py）。
① 結束時天可汗給的金牌設 palace_permit_jinzhang（金帳在王庭的 palace 區塊）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p8c.py（可以重跑）
"""

from east_story_io import write_stories
from east_story_kit import aff, at_npc, cell, check, fight, item, mem, node, out, rep, story, town

TD, COURT = 'tidan_khanate', 'yanye_court'
KHAN, CHALAN, QIQIGE, AMUR, TIEYA, SU = 'npc_td_ulantuya', 'npc_td_chalan', 'npc_td_qiqige', 'npc_td_amur', 'npc_td_tieya', 'npc_td_su_shiyong'
HAILAN, TOYA, WOLE, BATUR, WANNING = 'npc_td_hailan', 'npc_td_toya', 'npc_td_wole', 'npc_td_batur', 'npc_td_wanning'
INNER, CAMP = 'sm_td_inner_tent', 'sm_td_haidong_camp'

NAADAM, OVOO, SOUTH, TENT = cell('jinzhang', 'lm_td_naadam'), cell('jinzhang', 'lm_td_ovoo'), cell('jinzhang', 'lm_td_south_court'), cell('jinzhang', 'lm_td_golden_tent')
MARKET, FALCON, POST = cell('yinghe', 'lm_td_tea_horse'), cell('yinghe', 'lm_td_falconry'), cell('yinghe', 'lm_td_post_station')


def inner(x=5, y=3):
    return {'where': 'special', 'special_map': INNER, 'x': x, 'y': y}


def camp(x=4, y=2):
    return {'where': 'special', 'special_map': CAMP, 'x': x, 'y': y}


# 北原各地故事線的結局（至少走完一條才會被天可汗召見）
REGION_ENDS = [f'{p}_end_{e}' for p in ('tdl', 'tds', 'tdt', 'tdh') for e in ('war', 'peace', 'haidong')]
ALL_LOW = {'td_war': {'max': 1}, 'td_peace': {'max': 1}, 'td_haidong': {'max': 1}}


def summon(id, title, requires, text, flag, at=None):
    """察蘭把主角帶進金帳的內帳（傳送到內帳的特殊地圖）"""
    return node(id, title, text, at or cell('jinzhang', 'guild'), requires, allies=[CHALAN],
                success={'text': '察蘭領著你穿過兩排一動不動的怯薛，掀開金帳最裡面的那一道氈簾。', 'set_flags': [flag], 'special_map': INNER})


def route(label, counter, side, text, flag, story_id):
    s = {'text': text, 'set_flags': [flag, 'tdpol_3_done'], 'effects': [{'type': 'start_story', 'story': story_id}], 'complete': True}
    return [
        {'label': label, 'requires': {'counters': {counter: {'min': 2}}}, 'success': s},
        {'label': label + '（那達慕的聲音）', 'requires': {'flags': [side], 'counters': ALL_LOW}, 'success': s},
    ]


def finale(id, title, summary, start_text, start_flag, fight_spec, end_at, end_allies, end_text, end_flags, effects):
    ftitle, ftext, at, enemies, win = fight_spec
    nodes = [
        fight('fight', ftitle, ftext, at, start_flag, enemies, win, '你們被逼退了。喘口氣——這一仗還沒有打完。', win_flags=[f'{id}_won'], urgent=True),
        node('end', end_text[0], end_text[1], end_at, f'{id}_won', allies=end_allies,
             success={'text': end_text[2], 'set_flags': list(end_flags) + ['tdpol_done'], 'effects': effects, 'complete': True}),
    ]
    return story(id, 'S', title, summary, {'kind': 'manual', 'min_level': 15, 'text': start_text}, start_flag, nodes,
                 extra_rewards=[{'type': 'item', 'name': '精金礦石', 'qty': 1}])


STORIES = [
    # ① 天可汗的召見
    story('tdpol_summons', 'A', '天可汗的召見',
          '天可汗烏蘭圖雅召見你這個外人。大燁的歲幣餵不飽她的雄心，南院卻要她定居、築城；她要一個不屬於任何一部的人，替她看清草原。',
          {'kind': 'guild', 'location': 'jinzhang', 'min_level': 13, 'requires': {'flags_any': REGION_ENDS},
           'text': '公會的帳篷裡，一個短髮的年輕人馬族靠在柱子上，栗色的馬身上披著蒼狼部的黑氈。她把一支金箭丟在你面前的桌上：「我是察蘭。母親要見你——不是叫你去領賞，是叫你去回話。」'},
          'tdpol_1_started', [
              summon('summon', '在金帳王庭的公會跟察蘭進金帳', 'tdpol_1_started',
                     '察蘭一路上沒說幾句話，到了金帳前才回頭看你：「母親聽說了你在草原上做的事：替北院說話，也替南院、替海東部說話。她說，這種人不是蠢，就是有意思。」', 'tdpol_summoned'),
              node('audience', '在金帳的內帳見天可汗烏蘭圖雅',
                   '天可汗斜靠在蒙著狼皮的寶座上，金色的馬身盤在氈上，手裡轉著一只銀碗。帳裡掛滿了各部的戰旗。「大燁每年送來二十萬匹絹、十萬斤茶，換我不南下。」她笑了，笑得像在下戰書，「鐵牙說不夠，阿穆爾說太多——他說我該坐下來，築一座城。你說呢，外人？」',
                   inner(), 'tdpol_summoned', allies=[KHAN],
                   success={'text': '你還沒開口，她就擺了擺手：「別急著答。去南院看看阿穆爾在寫什麼，去北院聽聽鐵牙在磨什麼刀，再去鷹河看看海東部的人在想什麼。回來告訴我你看見的，不是你以為我想聽的。」',
                            'set_flags': ['tdpol_eyes'], 'effects': [aff(KHAN, 8, '答應替她看清草原')]}),
              node('south', '到金帳王庭的南院大帳聽阿穆爾說話',
                   '南院大帳裡，阿穆爾正在燈下抄一卷大燁的《營造法式》，可敦燁婉寧在屏風後撫琴。「天可汗要的是天下。」他沒有抬頭，「可是天下不是用馬蹄踩出來的，是用城牆、倉廩、律令一磚一瓦砌起來的。草原再大，也存不下一年的糧。」',
                   SOUTH, 'tdpol_eyes', allies=[AMUR],
                   success={'text': '他終於放下筆：「北院說我是半個龍人。可是我問你——十年前統一草原的那一仗，打完之後，是誰讓各部的孩子活過了冬天？」', 'set_flags': ['tdpol_seen_south'],
                            'effects': [aff(AMUR, 5, '聽他說完南院的道理')]}),
              node('north', '在金帳王庭找怯薛長鐵牙說話',
                   '鐵牙在那達慕場邊磨刀，身邊圍著一圈北院的騎兵。「坐下來？」他吐了口唾沫，「蒼狼部的祖先是從雪窟裡跑出來的狼，不是蹲在窩裡的狗。大燁的歲幣是什麼？是拴狗的鏈子。」',
                   at_npc(TIEYA, 'jinzhang'), 'tdpol_seen_south',
                   success={'text': '他把磨好的刀插回鞘裡：「你告訴天可汗：怯薛的馬已經餵飽了。她說一聲，三天之內，鷹河以南都是媞丹的草場。」', 'set_flags': ['tdpol_seen_north'],
                            'effects': [aff(TIEYA, 5, '聽他說完北院的道理')]}),
              check('haidong', '到鷹河榷場的鷹房聽海東部的人說話',
                    '鷹房裡，海蘭背對著你餵鷹，一句話也不說。托雅在一旁小聲說：「首領不跟金帳的人說話。」你等了很久，海蘭才開口：「你是天可汗的眼睛。那你看看這些鷹——每一隻都是要送去金帳的。」',
                    FALCON, 'tdpol_seen_north', 'cha', 16,
                    '你沒有替天可汗說話，只是聽。過了很久，海蘭說：「海東部不要南下，也不要築城。我們只要不再進貢——要我們的鷹留在我們的天上。」她看著你，「這句話，你敢帶回去嗎？」',
                    '海蘭把最後一塊肉丟給鷹，轉身走進冬營。托雅對你搖搖頭：「改天再來吧。」', win_flags=['tdpol_seen_haidong']),
              node('report', '回金帳的內帳向天可汗回話',
                   '你把看見的一五一十說了：南院的書、北院的刀、海東部的鷹。天可汗聽完，把銀碗放下，看了你很久：「沒有人敢在我面前替海東部說話。你說了。」',
                   inner(), 'tdpol_seen_haidong', allies=[KHAN],
                   success={'text': '她從腰上解下一塊刻著蒼狼的金牌，丟給你：「拿著。以後要進金帳，不用察蘭帶。」她頓了一下，「明年春天開忽里勒台，各部的首領都會來。到時候，你站在我旁邊看。」',
                            'set_flags': ['tdpol_1_done', 'palace_permit_jinzhang'],
                            'effects': [aff(KHAN, 8, '替她看清了草原'), aff(CHALAN, 5, '在母親面前說了真話'),
                                        mem('受天可汗烏蘭圖雅之託，看了南院的書、北院的刀與海東部的鷹，拿到可以進金帳的蒼狼金牌。', 3)],
                            'complete': True}),
          ]),
    # ② 忽里勒台
    story('tdpol_kurultai', 'A', '忽里勒台',
          '各部的首領齊聚金帳王庭，開忽里勒台：北院要南下，南院要互市，海東部要減貢。大會還沒開，就有人想讓它開不成。',
          {'kind': 'guild', 'location': 'jinzhang', 'min_level': 14, 'requires': {'flags': ['tdpol_1_done']},
           'text': '王庭外的草場上，一夜之間多了上百頂氈帳：各部的首領帶著自己的旗來了。公會的帳篷裡人人都在說同一件事——「聽說鐵牙在北院放了話：大會上誰說要坐下來，誰就別想騎著馬回去。」'},
          'tdpol_2_started', [
              fight('ambush', '晚上在金帳王庭擋下夜襲南院大帳的刺客', '夜裡，南院大帳外傳來一聲短促的哨音。三個蒙著臉的人馬族從帳後衝出來，黑甲上的銀釘在月光下閃著——是怯薛的甲。',
                    SOUTH, 'tdpol_2_started', [['td_kheshig', 2], ['td_kheshig_captain', 1]],
                    '刺客倒下了。阿穆爾提著燈出來，掀開帶頭的那人的面巾，臉色變了：「北院的百戶。」他把一枚令箭從那人懷裡抽出來——令箭上刻的不是鐵牙的名字，是一個舊部的圖騰。',
                    win_flags=['tdpol_ambushed'], hours='night'),
              node('gather', '到金帳王庭的那達慕場看忽里勒台開議',
                   '那達慕場上插滿了各部的旗。天可汗坐在正中，左邊是南院的阿穆爾，右邊是北院的鐵牙，海東部的海蘭站在最遠的地方。昨夜的刺客還沒說清楚，鐵牙就拍案而起：「南院說我派人殺他？好——那我就當著長生天的面，問問南院收了大燁多少銀子！」',
                   NAADAM, 'tdpol_ambushed', allies=[KHAN],
                   success={'text': '阿穆爾也站了起來，兩個人隔著天可汗吵成一團。各部的首領有的跟著喊，有的按著刀。天可汗一言不發，只是轉頭看你。', 'set_flags': ['tdpol_uproar']}),
              node('speak', '在那達慕場的忽里勒台上說話',
                   '刀已經出鞘了一半。天可汗終於開口，聲音不大，卻讓整個場子安靜下來：「外人，你在草原上走了一圈。你來說，昨夜的刀是誰的。」',
                   NAADAM, 'tdpol_uproar', 'choice', allies=[KHAN], options=[
                       {'label': '說出古戰場上那位可汗的名字', 'requires': {'flags': ['tdm_returned']},
                        'success': {'text': '你說，令箭上的圖騰，是那位被抹去名字的可汗的部族——你在古戰場上把他的名字還給了他。舊部的人愣住了；有幾個老人低下頭，流了淚。刺客不是北院的人，是想讓南北兩院打起來的舊部死士。',
                                    'set_flags': ['tdpol_calm', 'tdpol_calm_name']}},
                       {'label': '請國師其其格讀骨', 'requires': {'flags': ['tdr_3_done']},
                        'success': {'text': '其其格把一塊羊肩胛骨丟進火裡。骨頭裂開，裂紋從中間分成三道，誰也沒有壓過誰。「長生天說，」她的聲音很慢，「昨夜的刀，不是南院的，也不是北院的。是想讓草原裂成三塊的人的。」場上安靜了。',
                                    'set_flags': ['tdpol_calm', 'tdpol_calm_bones']}},
                       {'label': '拿著令箭說服各部的首領', 'check': {'attr': 'cha', 'dc': 17},
                        'success': {'text': '你舉起令箭，讓各部的首領一個一個看清上面的圖騰。北院的人認得出那不是怯薛的令；南院的人也認得出。鐵牙與阿穆爾互看一眼，各自坐了回去。',
                                    'set_flags': ['tdpol_calm']},
                        'fail': {'text': '你的話被喊聲淹沒了。天可汗拍了一下寶座，大會散了，明天再議。你得想想別的辦法。', 'retry': True}},
                   ]),
              node('verdict', '在金帳的內帳聽天可汗說大會的結果',
                   '大會開了三天。北院要南下，南院要互市，海東部要減貢，誰也說服不了誰。最後一夜，天可汗把你叫進內帳：「草原上從來沒有一次大會吵得這麼乾淨。刀沒有出鞘，話都說出來了。」',
                   inner(), 'tdpol_calm', allies=[KHAN],
                   success={'text': '她把銀碗斟滿，推到你面前：「話說完了，就該比了。草原的規矩，大事在那達慕上定。」她笑了，「你猜，各部會搶著要你替誰出賽？」',
                            'set_flags': ['tdpol_2_done'],
                            'effects': [aff(KHAN, 10, '在忽里勒台上壓住了刀'), aff(TIEYA, -5, '在大會上沒有站在北院這邊'), aff(AMUR, 5, '在大會上替南院洗清了刺客的事'),
                                        mem('忽里勒台上北院、南院與海東部吵了三天；夜襲南院的刺客是想讓草原分裂的人，刀沒有出鞘。', 3)],
                            'complete': True}),
          ]),
    # ③ 那達慕之約
    story('tdpol_naadam', 'S', '那達慕之約',
          '天可汗在那達慕上當眾立約：摔跤、賽馬、射箭，你替哪一方出賽，那一方就在大會上多一份聲音。之後，她要問你媞丹該走哪一條路。',
          {'kind': 'npc', 'npc': CHALAN, 'min_level': 14, 'requires': {'flags': ['tdpol_2_done']},
           'text': '察蘭攔住你，臉上難得帶著笑：「母親立約了：今年的那達慕，誰贏，誰就替一方說話。北院、南院、海東部都派人來找你了——你知道母親為什麼這麼做嗎？她想看你選誰。」她頓了一下，「我也想看。」'},
          'tdpol_3_started', [
              node('oath', '在金帳王庭的那達慕場向天可汗立約',
                   '那達慕場上，天可汗當著各部的面舉起一支金箭：「這個外人替誰出賽，誰就在大會上多一份聲音。」鐵牙抱著手臂，阿穆爾捻著鬍子，海蘭站在場邊，肩上的海東青一動不動。所有人都在看你。',
                   NAADAM, 'tdpol_3_started', 'choice', allies=[KHAN], options=[
                       {'label': '替北院出賽', 'success': {'text': '你走到鐵牙身邊。北院的騎兵用彎刀敲起盾牌，鐵牙一巴掌拍在你背上：「好！讓那些坐著的人看看什麼叫草原！」',
                                                       'set_flags': ['tdpol_side_war'], 'counters': {'td_war': 1}, 'effects': [aff(TIEYA, 8, '替北院出賽')]}},
                       {'label': '替南院出賽', 'success': {'text': '你走到阿穆爾身邊。南院的書吏們愣了一下，才想起來要歡呼。阿穆爾向你深深一揖：「南院欠你一份情。」',
                                                       'set_flags': ['tdpol_side_peace'], 'counters': {'td_peace': 1}, 'effects': [aff(AMUR, 8, '替南院出賽')]}},
                       {'label': '替海東部出賽', 'success': {'text': '你走到海蘭身邊。整個場子安靜了一下，接著是一片嘩然。海蘭沒有笑，只是把肩上的海東青遞給托雅，對你點了點頭。',
                                                        'set_flags': ['tdpol_side_haidong'], 'counters': {'td_haidong': 1}, 'effects': [aff(HAILAN, 8, '替海東部出賽')]}},
                   ]),
              check('wrestle', '在那達慕場和巴特爾摔跤',
                    '第一項是搏克。對手是王庭的摔跤冠軍巴特爾，他拍著大腿、揚著手臂跳著鷹舞入場，四條馬腿穩穩地釘在地上。人馬族摔跤，比的是誰先讓對方的膝蓋著地。',
                    NAADAM, {'flags_any': ['tdpol_side_war', 'tdpol_side_peace', 'tdpol_side_haidong']}, 'str', 17,
                    '你抓住他的腰帶，用盡全身的力氣一扭——巴特爾的前膝著地了。他坐在地上大笑：「好久沒有人讓我吃土了！」場邊的看客把馬奶酒灑了一地。',
                    '巴特爾把你摔了出去，場邊一片噓聲。照規矩，輸了的人可以再挑戰一次。', win_flags=['tdpol_wrestled'], allies=[BATUR]),
              fight('race', '在金帳王庭的近郊賽馬，擋下半路埋伏的人', '第二項是賽馬，從王庭跑到敖包再跑回來。跑到半路，草坡後面衝出幾個人：怯薛的黑甲、南院的弩、舊部的圖騰——不想讓你贏的人，不只一方。',
                    out('jinzhang'), 'tdpol_wrestled', [['td_kheshig_captain', 1], ['td_south_crossbow', 1], ['td_clan_champion', 1]],
                    '埋伏的人散了。你一路衝回那達慕場，第一個撞過終點的彩旗。場邊有人在喊你的名字，喊得最大聲的是察蘭。', win_flags=['tdpol_raced'], urgent=True),
              check('archery', '在那達慕場射最後一箭',
                    '最後一項是射箭。靶子立在兩百步外，比你的拳頭還小。天可汗親自站在箭靶旁邊，金色的馬身一動不動：「射吧。射偏了，就射在我身上。」',
                    NAADAM, 'tdpol_raced', 'dex', 17,
                    '箭從天可汗的耳邊擦過，正中靶心。她沒有眨眼，只是伸手摸了摸耳邊的頭髮，大笑起來：「好！今年的那達慕，是外人贏了！」',
                    '箭偏了，插在靶子旁邊的草地上。天可汗挑了挑眉：「再一箭。」', win_flags=['tdpol_won_naadam'], allies=[KHAN]),
              node('verdict', '在金帳的內帳回答天可汗：媞丹該走哪一條路',
                   '那達慕的篝火燒了一夜。天可汗把你叫進內帳，這一次她沒有拿銀碗：「大法典、南院的帳、茶馬市、海東的貢——你都在場，你看見了草原的每一道裂縫，今天又替一方贏了聲音。我問你：媞丹，該怎麼走？」',
                   inner(), 'tdpol_won_naadam', 'choice', allies=[KHAN], options=(
                       route('「長生天的鞭：整軍南下」', 'td_war', 'tdpol_side_war',
                             '天可汗站了起來，金色的馬身在燈下像一團火：「好。我就等這句話。」她把那支金箭折成兩段，「廢南院，整軍。」帳外傳來消息：南院的死忠老將帶著弩手守住了南院大帳，說要收南院的印，先從他的屍首上拿。',
                             'tdpol_route_khanate', 'tdpol_end_khanate')
                       + route('「南院的印：定居築城」', 'td_peace', 'tdpol_side_peace',
                               '天可汗沉默了很久，久到燈芯爆了一聲。「十年前我在馬背上打下草原。」她把馬鞭放在寶座上，「也許是時候下馬了。」帳外傳來消息：怯薛的萬戶帶著北院的騎兵，要在詔令頒布之前「替天可汗清理南院」。',
                               'tdpol_route_south', 'tdpol_end_south')
                       + route('「海東青飛走了：讓海東部自立」', 'td_haidong', 'tdpol_side_haidong',
                               '天可汗的手停在半空。「你要我放走東邊的獵場、北珠、海東青。」她看著你，看了很久，最後笑了，笑得很冷，「好。我放。可是鐵牙不會放。」帳外傳來消息：海蘭帶著海東部連夜拔營往上游走，怯薛的統領已經追出去了。',
                               'tdpol_route_haidong', 'tdpol_end_haidong'))),
          ]),
    # ④ 終章
    finale('tdpol_end_khanate', '長生天的鞭',
           '天可汗決定廢南院、整軍南下。南院的死忠老將帶著弩手守住南院大帳，不肯交出南院的印。（終章：大汗國）',
           '南院大帳外豎起了一排大燁樣式的盾牌，盾牌後面是一排上好弦的神臂弩。鐵牙帶著怯薛在外面等著：「外人，你說的路，你先走。」', 'tdpol_khanate_started',
           ('在南院大帳擊倒南院的死忠老將', '老將站在帳門前，白鬍子在風裡飄：「南院的印是天可汗親手給的。要收，先從我的屍首上拿。」',
            SOUTH, [['td_south_marshal', 1], ['td_south_crossbow', 1]],
            '老將倒在帳門前，懷裡還抱著南院的大印。阿穆爾從帳裡走出來，接過那顆印，看了很久，然後雙手捧著交給了鐵牙。'),
           TENT, [KHAN, TIEYA],
           ('在金帳前看媞丹成為大汗國', '金帳前的九斿白纛換成了出征的黑纛。天可汗騎在最前面，鐵牙與怯薛跟在後面，各部的騎兵一直排到看不見的地方。',
            '天可汗回頭看你：「南院廢了，各部的兵歸怯薛統領。明年秋天，草原的馬要喝到鷹河以南的水。」媞丹成了大汗國：北院得勢，阿穆爾被貶回媞丹部的草場，歲幣使節蘇時雍連夜寫信回龍安府。'),
           ['tdpol_khanate'], [rep(TD, 8), rep(COURT, -8), aff(KHAN, 15, '陪她走上征服天下的路'), aff(TIEYA, 15, '和怯薛一起廢了南院'), aff(AMUR, -15, '廢了南院'),
                               aff(SU, -10, '讓媞丹整軍南下'), mem('媞丹的走向是大汗國：天可汗廢南院、整軍，要征服天下；阿穆爾被貶，北院得勢。', 3)]),
    finale('tdpol_end_south', '南院的印',
           '天可汗決定定居築城、照律令治國。怯薛的萬戶帶著北院的騎兵，要在詔令頒布之前「清理南院」。（終章：南院治）',
           '金帳前的草場上，北院的騎兵排成一列，馬蹄刨著地。怯薛的萬戶提著長刀，一步一步走向金帳：「天可汗老了。草原，該由還騎得動馬的人說話。」', 'tdpol_south_started',
           ('在金帳前擊倒怯薛的萬戶', '萬戶的長刀指著金帳的帳門：「讓開，外人。草原坐下來的那一天，就是蒼狼死的那一天。」',
            TENT, [['td_kheshig_marshal', 1], ['td_kheshig_captain', 1]],
            '萬戶倒在金帳前，北院的騎兵一個一個下了馬。鐵牙從人群裡走出來，把自己的刀放在天可汗的馬蹄前，一句話也沒說。'),
           SOUTH, [AMUR, KHAN],
           ('在南院大帳看媞丹照律令治國', '南院大帳裡，阿穆爾把一卷新寫的詔令攤在書案上：築城、設倉、立斷事官、榷場照律收稅。天可汗親手在詔令上蓋了蒼狼的金印。',
            '「十年前我在馬背上打下草原，」天可汗說，「現在換你們替我守住它。」媞丹走向南院治：王庭開始築第一道城牆，南院得勢，鐵牙交出怯薛的兵符，被派去守北邊的牧場。可敦燁婉寧在屏風後彈了一夜的琴。'),
           ['tdpol_south'], [rep(TD, 5), rep(COURT, 6), aff(AMUR, 15, '陪他寫下南院的詔令'), aff(KHAN, 10, '讓她下了馬'), aff(TIEYA, -15, '擋下了北院的刀'),
                             aff(SU, 8, '讓媞丹照律令治國'), mem('媞丹的走向是南院治：天可汗定居築城、照律令治國；鐵牙交出兵符，南院得勢。', 3)]),
    finale('tdpol_end_haidong', '海東青飛走了',
           '海東部要脫離媞丹自立。海蘭帶著族人連夜往鷹河上游走，怯薛的統領帶著騎兵追了上來。（終章：海東自立）',
           '鷹河上游的雪原上，海東部的隊伍拖著氈車與鷹架往東走。身後的地平線上揚起一長條雪塵——怯薛追上來了。海蘭勒住馬，對你說：「你帶我們走到這裡。剩下的路，你陪不陪？」', 'tdpol_haidong_started',
           ('在鷹河榷場的近郊擋住追擊的怯薛統領', '怯薛的統領在百步外勒馬，角弓已經拉滿：「海東青可以飛走，海東部的人不行。」',
            out('yinghe'), [['td_pursuit_captain', 1], ['td_kheshig_captain', 1]],
            '統領的馬倒在雪地裡，他自己摔下來，再也沒有站起來。剩下的怯薛調轉馬頭，往金帳王庭的方向跑了。'),
           camp(), [HAILAN, TOYA],
           ('在海東部的冬營看海東部自立', '冬營的篝火燒得比任何一夜都旺。海蘭站在火邊，把鷹房裡所有的海東青都放了出去。鷹在火光上盤旋了三圈，往東邊的天上飛走了。',
            '「從今天起，海東部的鷹留在海東部的天上。」海蘭說。媞丹裂成兩半：天可汗失去了東邊的獵場與北珠，海東部在鷹河上游自立；大燁的使節第一次越過榷場，來到了海東部的冬營。托雅抱著她最好的那一隻海東青，哭了。'),
           ['tdpol_haidong'], [rep(TD, -10), rep(COURT, 3), aff(HAILAN, 15, '陪海東部走到自立'), aff(TOYA, 10, '讓海東青留在海東的天上'), aff(KHAN, -10, '讓海東部走了'),
                               aff(TIEYA, -10, '殺了追擊的怯薛統領'), mem('媞丹的走向是海東自立：海東部脫離媞丹，在鷹河上游自立；天可汗失去東邊的獵場與北珠。', 3)]),
]

LINES = {'tdpol_summons': '政治線：媞丹的走向・一', 'tdpol_kurultai': '政治線：媞丹的走向・二', 'tdpol_naadam': '政治線：媞丹的走向・三'}
for _s in STORIES:
    if _s['id'] in LINES:
        _s['summary'] += '（%s）' % LINES[_s['id']]
    elif _s['id'].startswith('tdpol_end_'):
        _s['summary'] = _s['summary'].rsplit('（', 1)[0] + '（政治線：媞丹的走向・終）'


if __name__ == '__main__':
    write_stories(STORIES)
