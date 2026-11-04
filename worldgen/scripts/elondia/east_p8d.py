"""炎華之地 P8d：政治線下半「南北交會」（6 條，Lv.16～18）與三件獨特裝備。EAST_CONTENT_PLAN 11.11 節。

兩邊的前期都走完（yhpol_done、tdpol_done）才開始。③ 兩國的夜議依兩邊的結局決定能走哪一條路線（11.11 節的表）：
- 大汗國：征伐；大燁是君主立憲制時也可以和盟（五席的人斡旋）
- 南院治：和盟；大燁是共和制時也可以征伐（公議會不付歲幣，北院的殘部趁機南下）
- 海東自立：海上之盟；大燁是君主制時也可以和盟（女帝寧可和天可汗談）
九種組合都至少有一條（eastContinent.spec 列舉過）。終章裡的友軍照兩邊的結局換人（選項的條件）。
結局旗標：nspol_alliance／nspol_war（加上 nspol_war_yanye 或 nspol_war_tidan）／nspol_sea。
雙帝的會盟（成人向的多人任務）要烏蘭圖雅的角色線走到戀人，等 8e 做完角色線再一起做。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p8d.py（可以重跑）
"""

from east_story_io import write_items, write_stories
from east_story_kit import aff, at_npc, cell, check, fight, item, mem, node, out, rep, story, town

TD, COURT = 'tidan_khanate', 'yanye_court'
KHAN, CHALAN, AMUR, TIEYA, SU, HAILAN, TOYA, WOLE, KEEPER = (
    'npc_td_ulantuya', 'npc_td_chalan', 'npc_td_amur', 'npc_td_tieya', 'npc_td_su_shiyong', 'npc_td_hailan', 'npc_td_toya', 'npc_td_wole',
    'npc_td_post_keeper')
ZHAOHUA, YUE, LU, HUAIJIN, RUYU = 'npc_yh_zhaohua', 'npc_yh_yue_zhenshan', 'npc_yh_lu_qinghe', 'npc_yh_su_huaijin', 'npc_yh_wen_ruyu'
INNER, CAMP = 'sm_td_inner_tent', 'sm_td_haidong_camp'
MARKET, FALCON, POST = cell('yinghe', 'lm_td_tea_horse'), cell('yinghe', 'lm_td_falconry'), cell('yinghe', 'lm_td_post_station')


def inner(x=5, y=3):
    return {'where': 'special', 'special_map': INNER, 'x': x, 'y': y}


def camp(x=4, y=2):
    return {'where': 'special', 'special_map': CAMP, 'x': x, 'y': y}


ITEMS = [
    {'name': '盟誓的角弓', 'category': 'equipment', 'price_cc': 8000, 'tags': ['unique'],
     'desc': '兩國立盟那天，天可汗親手交給你的角弓；弓背上用大燁的字與草原的字各刻了一行盟誓。拉開它的時候，兩種話好像同時在耳邊響起。',
     'gear': {'base': 'horn_bow', 'material': 'divine_wood', 'rarity': 'legendary', 'attrs': {'dex': 1}, 'enchants': {'mods': {'hit': 3, 'damage': 3}},
              'unique': {'check': {'kinds': ['negotiation', 'negotiate']}, 'bonus': 2}}},
    {'name': '破陣彎刀', 'category': 'equipment', 'price_cc': 8000, 'tags': ['unique'],
     'desc': '鷹河邊那一仗之後，從大將手裡接過來的彎刀，刀背上刻著一排看不懂的戰功。不管你替哪一邊打，拿著它的時候，對面的人都會先退一步。',
     'gear': {'base': 'scimitar', 'material': 'star_iron', 'rarity': 'legendary', 'attrs': {'str': 1}, 'enchants': {'mods': {'hit': 3, 'damage': 3}},
              'unique': {'check': {'kinds': ['intimidate']}, 'bonus': 2}}},
    {'name': '海東青的盟符', 'category': 'equipment', 'price_cc': 7000, 'tags': ['unique'],
     'desc': '海上之盟的信物：一枚星辰石的護符，一面刻著大燁的龍，一面刻著海東青；海蘭說，戴著它的人，在海東部的天底下走到哪裡都有人讓路。',
     'gear': {'base': 'amulet_ward', 'material': 'starstone', 'rarity': 'legendary', 'attrs': {'dex': 1}, 'enchants': {'mods': {'save': 3, 'evade': 1}, 'resist': {'cold': -0.75}},
              'unique': {'check': {'contexts': ['travel', 'road']}, 'bonus': 2}}},
]


def rally_yanye(id, title, text, at, requires, flag):
    """大燁那邊的友軍：君主制是朝廷的禁軍、共和制是金墨盟的火藥與船、君主立憲制是五席裡的人"""
    return node(id, title, text, at, requires, 'choice', options=[
        {'label': '請岳鎮山帶禁軍來', 'requires': {'flags': ['yhpol_monarchy']},
         'success': {'text': '岳鎮山帶著三營禁軍從茶馬路趕到，朱漆的步人甲在雪地裡排成一道牆：「陛下說了，這一仗，大燁的禁軍站在你身後。」', 'set_flags': [flag],
                     'effects': [aff(YUE, 5, '帶著禁軍一起北上')]}},
        {'label': '請金墨盟送火藥與船來', 'requires': {'flags': ['yhpol_republic']},
         'success': {'text': '陸青禾的信比人先到：「公議會表決了，三百票對一百票。」接著是金墨盟的船，順著鷹河逆流而上，船上載滿了火藥坊的火銃與霹靂火球。', 'set_flags': [flag],
                     'effects': [aff(LU, 5, '公議會派來的火藥與船')]}},
        {'label': '請五席派人來', 'requires': {'flags': ['yhpol_constitution']},
         'success': {'text': '五席各派了一個人：朝廷的禁軍、萍江的鄉勇、胡記的護衛、金黃鱗的船、織工的旗。蘇懷瑾親自帶隊：「五席吵了一夜，最後只吵出一句話——你需要什麼，就給你什麼。」', 'set_flags': [flag],
                     'effects': [aff(HUAIJIN, 5, '五席派來的人')]}},
    ])


def rally_tidan(id, title, text, at, requires, flag):
    """媞丹那邊的友軍：大汗國是怯薛、南院治是南院的人、海東自立是海東部的鷹獵手"""
    return node(id, title, text, at, requires, 'choice', options=[
        {'label': '請鐵牙帶怯薛來', 'requires': {'flags': ['tdpol_khanate']},
         'success': {'text': '鐵牙帶著一隊怯薛從草原上衝下來，黑甲在太陽下閃成一片：「天可汗說，你站在哪裡，怯薛就站在哪裡。」', 'set_flags': [flag],
                     'effects': [aff(TIEYA, 5, '帶著怯薛一起打')]}},
        {'label': '請阿穆爾派南院的人來', 'requires': {'flags': ['tdpol_south']},
         'success': {'text': '阿穆爾派來了南院的弩手，還有一車一車的糧草與帳篷：「南院打仗不靠喊，靠倉廩。」他自己騎著馬跟在最後面，幞頭外面罩著一頂頭盔。', 'set_flags': [flag],
                     'effects': [aff(AMUR, 5, '派南院的人一起打')]}},
        {'label': '請海蘭帶鷹獵手來', 'requires': {'flags': ['tdpol_haidong']},
         'success': {'text': '海蘭帶著海東部的鷹獵手從上游下來，每個人的肩上都停著一隻海東青。她一句話也沒說，只是把角弓遞給你看——弓已經上好弦了。', 'set_flags': [flag],
                     'effects': [aff(HAILAN, 5, '帶著鷹獵手一起打')]}},
    ])


ROUTE = {
    'alliance': ('nspol_route_alliance', 'nspol_end_alliance'),
    'war': ('nspol_route_war', 'nspol_end_war'),
    'sea': ('nspol_route_sea', 'nspol_end_sea'),
}


def route(label, requires, kind, text):
    flag, sid = ROUTE[kind]
    return {'label': label, 'requires': {'flags': requires},
            'success': {'text': text, 'set_flags': [flag, 'nspol_3_done'], 'effects': [{'type': 'start_story', 'story': sid}], 'complete': True}}


def finale(id, title, summary, start_text, start_flag, nodes):
    return story(id, 'S', title, summary, {'kind': 'manual', 'min_level': 18, 'text': start_text}, start_flag, nodes,
                 extra_rewards=[{'type': 'item', 'name': '精金礦石', 'qty': 2}])


LOSE = '你們被逼退了。喘口氣——鷹河邊的這一仗還沒有打完。'

STORIES = [
    # ① 歲幣的使節
    story('nspol_envoys', 'S', '歲幣的使節',
          '大燁的政體與媞丹的走向都定了。兩國的使節在鷹河榷場碰面：照兩邊的結局，桌上談的是加歲幣、改互市，還是海東部。',
          {'kind': 'guild', 'location': 'yinghe', 'min_level': 16, 'requires': {'flags': ['yhpol_done', 'tdpol_done']},
           'text': '公會的帳篷外拴滿了驛馬：一邊是大燁的官馬，馬鞍上掛著朱漆的公文匣；一邊是媞丹的戰馬，鞍上插著蒼狼的小旗。公會的主管壓低聲音：「兩國的使節都到了，指名要你在場。說是兩邊都認得你。」'},
          'nsp1_started', [
              node('arrive', '到鷹河榷場的驛站見兩國的使節',
                   '驛站的院子裡，大燁的歲幣使節蘇時雍正在換一身新的官服，公文匣上的封印換了——不再是宰相府的印。媞丹的使者坐在另一頭喝奶茶，看見你，舉了舉碗。驛站的老闆一邊擦銅牌一邊說：「三十年了，第一次兩邊的人坐在同一個院子裡，還沒拔刀。」',
                   POST, 'nsp1_started', allies=[SU],
                   success={'text': '蘇時雍把你拉到一邊：「龍安府變了，草原也變了。這一次談的，不是去年的那張帳。」他把一卷新的國書塞進袖子裡，「明天在茶馬市開談。你坐在中間。」', 'set_flags': ['nsp1_arrived']}),
              node('table', '在鷹河榷場的茶馬市聽兩國的使節開談',
                   '茶馬市清出了一塊空地，中間擺著一張桌子，一邊是大燁的茶與絹，一邊是媞丹的馬與皮。蘇時雍與媞丹的使者各坐一邊，你坐在中間。媞丹的使者先開口——他要談什麼，看天可汗在王庭選了哪一條路。',
                   MARKET, 'nsp1_arrived', 'choice', allies=[SU], options=[
                       {'label': '聽媞丹要加歲幣', 'requires': {'flags': ['tdpol_khanate']},
                        'success': {'text': '媞丹的使者把馬鞭拍在桌上：「天可汗說，歲幣加一倍。不加，明年秋天，草原的馬自己去龍安府拿。」蘇時雍的臉白了，手卻很穩：「大燁的回答，要等龍安府。」',
                                    'set_flags': ['nsp1_terms'], 'effects': [mem('鷹河榷場的使節會上，大汗國的使者要大燁把歲幣加一倍，否則南下。')]}},
                       {'label': '聽南院要把歲幣改成互市', 'requires': {'flags': ['tdpol_south']},
                        'success': {'text': '媞丹的使者攤開南院的帳：「阿穆爾大王說，歲幣是施捨，互市是買賣。草原不要施捨，要開十個榷場。」蘇時雍看了很久，第一次在談判桌上笑了：「這個，龍安府會想聽。」',
                                    'set_flags': ['nsp1_terms'], 'effects': [mem('鷹河榷場的使節會上，南院的使者要把歲幣改成互市，多開十個榷場。')]}},
                       {'label': '聽兩國談海東部', 'requires': {'flags': ['tdpol_haidong']},
                        'success': {'text': '媞丹的使者咬著牙：「海東部是媞丹的部族。大燁的使節去了他們的冬營——天可汗要知道，大燁想做什麼。」蘇時雍慢慢地說：「大燁想知道的是，海東部自己想做什麼。」',
                                    'set_flags': ['nsp1_terms'], 'effects': [mem('鷹河榷場的使節會上，兩國為了自立的海東部吵了起來：大燁的使節去過海東部的冬營。')]}},
                   ]),
              check('talk', '在鷹河榷場的茶馬市讓兩邊談下去',
                    '談到第三天，兩邊的話都說完了，剩下的只有沉默。媞丹的使者站起來要走，蘇時雍也在收拾公文匣。整個茶馬市都在看你：只要有一方先走，下一次見面，就是在戰場上。',
                    MARKET, 'nsp1_terms', 'cha', 18,
                    '你請兩人坐下，把三天來兩邊說過的話一條一條念出來——哪些是一樣的，哪些只是說法不同。媞丹的使者愣了一下，又坐了回去。蘇時雍低聲說：「至少，我們吵的是同一件事。」',
                    '媞丹的使者把碗一摔，走了。蘇時雍嘆了口氣：「明天他還會回來的。草原的人，生氣歸生氣，馬還是要賣。」再試一次。',
                    win_flags=['nsp1_talked'], allies=[SU]),
              node('report', '回鷹河榷場的驛站和蘇時雍說話',
                   '夜裡，蘇時雍在驛站的燈下寫信給龍安府，寫了又撕，撕了又寫。「兩邊的國書，我都抄了一份。」他抬頭看你，「可是今天在茶馬市，有一件事我沒寫進去：有人在場邊一直看著，穿的不是使節的衣服。」',
                   POST, 'nsp1_talked', allies=[SU],
                   success={'text': '「是大燁的人，也是媞丹的人。」他吹熄了燈，「兩邊都有不想讓這桌談下去的人。你小心榷場。」', 'set_flags': ['nsp1_done'],
                            'effects': [aff(SU, 10, '讓兩國的使節談了下去'), mem('鷹河榷場的使節會談了三天，兩邊都沒走；可是場邊有兩國的人不想讓這桌談下去。', 3)],
                            'complete': True}),
          ]),
    # ② 榷場的火
    story('nspol_market_fire', 'S', '榷場的火',
          '鷹河榷場的茶馬市被一把火燒了半邊。大燁說是媞丹放的，媞丹說是大燁放的，海東部說是兩邊一起放的。灰燼裡藏著答案。',
          {'kind': 'npc', 'npc': WOLE, 'min_level': 16, 'requires': {'flags': ['nsp1_done']},
           'text': '監官斡勒的臉上全是煙灰，算籌掉了一地也沒撿：「茶馬市燒了！半邊的茶磚、三百匹馬……」他抓住你的袖子，聲音在發抖，「放火的人還在市裡。你得去，現在就去。」'},
          'nsp2_started', [
              fight('fire', '晚上在鷹河榷場的茶馬市擋下放火的人', '茶馬市燒成一片火海，馬群在火裡嘶鳴。火光裡站著幾個人：殿前司的甲、怯薛的黑甲，手裡都拿著火把，看見你，一齊轉了過來。',
                    MARKET, 'nsp2_started', [['yh_palace_guard', 1], ['td_kheshig_captain', 2]],
                    '放火的人倒下了。榷場的人提著水桶衝進來，火慢慢小了。你從一個甲士的懷裡摸出半張燒焦的紙。',
                    win_flags=['nsp2_fought'], hours='night', urgent=True),
              node('blame', '在鷹河榷場的茶馬市聽三方互相指責',
                   '天亮時，茶馬市只剩一片焦黑。蘇時雍指著怯薛的屍首：「媞丹的甲。」媞丹的使者指著殿前司的甲：「大燁的甲。」海東部的人站在遠處，冷冷地說：「兩邊的甲都有，那就是兩邊一起放的。」三方吵成一團，誰也不聽誰。',
                   MARKET, 'nsp2_fought', allies=[SU],
                   success={'text': '你看著手裡那半張燒焦的紙。上面的字，一半是大燁的，一半是草原的。', 'set_flags': ['nsp2_blamed']}),
              check('ashes', '在鷹河榷場的茶馬市拼出那半張紙',
                    '你和驛站的老闆蹲在灰燼裡，把一片一片燒焦的紙拼起來。驛站的老闆認得草原的字，蘇時雍認得大燁的字，可是兩種字湊在一起寫的是什麼，要你自己想。',
                    MARKET, 'nsp2_blamed', 'int', 18,
                    '拼出來了：一封兩種文字寫的密約。大燁的主戰派與媞丹的主戰派約好，燒了榷場，讓兩國再也談不下去——大燁要北伐，媞丹要南下，誰也不要和平。落款是兩個印：一個是朱砂鱗的武人世家，一個是北院的老騎兵。',
                    '紙片太碎了，拼不出完整的字。驛站的老闆說，灰燼裡也許還有別的碎片，再找找。', win_flags=['nsp2_truth'], allies=[KEEPER]),
              node('tell', '在鷹河榷場的驛站決定怎麼處理那封密約',
                   '驛站的老闆把門關上：「這封信，能讓兩國的主戰派都抬不起頭——也能讓兩國明天就打起來。看你怎麼用。」',
                   POST, 'nsp2_truth', 'choice', allies=[KEEPER, SU], options=[
                       {'label': '在茶馬市當眾念出來', 'success': {
                           'text': '你站在燒焦的茶馬市中間，把密約一字一句念了出來。三方都安靜了。蘇時雍與媞丹的使者互看一眼，第一次站到了同一邊：燒榷場的人，是兩國共同的敵人。可是兩國的主戰派也聽見了——他們不會就這樣算了。',
                           'set_flags': ['nsp2_done', 'nsp2_public'],
                           'effects': [aff(SU, 8, '當眾念出了密約'), aff(WOLE, 5, '查出了燒榷場的人'), mem('鷹河榷場被兩國的主戰派聯手燒了；你在茶馬市當眾念出了他們的密約。', 3)],
                           'complete': True}},
                       {'label': '只交給兩國的使節', 'success': {
                           'text': '你把密約抄了兩份，一份交給蘇時雍，一份交給媞丹的使者。「讓龍安府和王庭自己處理。」兩人都收下了，誰也沒說話。三天之後，茶馬市重新開張——可是兩國的主戰派都知道，有人看見了。',
                           'set_flags': ['nsp2_done', 'nsp2_quiet'],
                           'effects': [aff(SU, 10, '把密約交給兩國自己處理'), mem('鷹河榷場被兩國的主戰派聯手燒了；你把他們的密約悄悄交給了兩國的使節。', 3)],
                           'complete': True}},
                   ]),
          ]),
    # ③ 兩國的夜議
    story('nspol_night_council', 'S', '兩國的夜議',
          '大燁與媞丹的使者在金帳的內帳密談，主角坐在中間。照兩邊的結局，桌上能走的路不只一條——最後選哪一條，由你決定。',
          {'kind': 'guild', 'location': 'jinzhang', 'min_level': 17, 'requires': {'flags': ['nsp2_done']},
           'text': '察蘭在公會門口等你，身上披著一件大燁的狐裘——是龍安府送來的國禮。「龍安府派了人來，母親要開夜議。」她把一封蓋著兩種印的信交給你，「兩邊都說，要你在場。」'},
          'nsp3_started', [
              node('letter', '在金帳王庭的公會讀龍安府的信',
                   '信是溫如玉的字，寫在大燁的宮箋上：「龍安府已經有了自己的答案。可是這一次，不管是陛下、公議會還是五席，都說了同一句話：草原上的事，請那個在草原上走過的人看著辦。」',
                   cell('jinzhang', 'guild'), 'nsp3_started',
                   success={'text': '信的最後一行是另一種字跡，寫得很急：「無論如何，回來喝茶。」', 'set_flags': ['nsp3_read'], 'effects': [aff(RUYU, 3, '收到龍安府的信')]}),
              node('summon', '在金帳王庭的公會跟察蘭進金帳', '察蘭領著你走向金帳：「今晚的內帳裡只有四個人：母親、龍安府來的人、蘇時雍，還有你。」她頓了一下，「我在外面守著。誰也進不去。」',
                   cell('jinzhang', 'guild'), 'nsp3_read', allies=[CHALAN],
                   success={'text': '察蘭掀開金帳最裡面的那一道氈簾，對你點了點頭。', 'set_flags': ['nsp3_inside'], 'special_map': INNER}),
              node('council', '在金帳的內帳決定兩國的路',
                   '內帳裡只點了一盞燈。天可汗坐在狼皮寶座上，龍安府來的人坐在下首，蘇時雍跪坐在一旁研墨。桌上攤著兩卷國書、一張鷹河的地圖、榷場那封燒焦的密約。天可汗把銀碗推到你面前：「你在兩邊都走過。你說，這一碗，是喝下去，還是摔了？」',
                   inner(), 'nsp3_inside', 'choice', allies=[KHAN, SU], options=[
                       route('「征伐：天可汗南下」', ['tdpol_khanate'], 'war',
                             '天可汗把銀碗摔在地上：「好。」龍安府來的人站起來，一言不發地走了。帳外傳來號角聲——黑纛升起來了。大燁的北伐軍也在茶馬路上集結。鷹河邊，要打一仗。'),
                       route('「和盟：讓五席的人斡旋」', ['tdpol_khanate', 'yhpol_constitution'], 'alliance',
                             '龍安府來的人取出五席的信：朝廷、萍江、瑔州港各蓋了一個印。「五席不要打仗，也不怕打仗。」天可汗看完信，沉默了很久，把銀碗喝乾了。帳外有人不服——兩國的主戰派都在鷹河邊等著。'),
                       route('「和盟：歲幣改成互市」', ['tdpol_south'], 'alliance',
                             '天可汗把銀碗喝乾，推給龍安府來的人。他也喝了。蘇時雍的筆在國書上停了一下，寫下「互市」兩個字。帳外傳來消息：兩國的主戰派殘黨在鷹河邊會合了，要在立盟那天把榷場再燒一次。'),
                       route('「征伐：北院的殘部南下」', ['tdpol_south', 'yhpol_republic'], 'war',
                             '龍安府來的人說：公議會表決了，不再付歲幣。天可汗的手停在半空。帳外傳來消息：北院的殘部聽說了，不等王庭的令，已經往鷹河以南衝了。天可汗站起來：「草原的人，我管不住了。那就打。」'),
                       route('「海上之盟：大燁與海東部結盟」', ['tdpol_haidong'], 'sea',
                             '龍安府來的人取出一卷沒有給天可汗看過的國書：大燁與海東部的盟約。天可汗看完，大笑起來，笑得帳頂的金鈴都在響：「好，好。」她把銀碗遞給你，「那你去告訴海蘭——鐵牙的黑纛，明天就到。」'),
                       route('「和盟：女帝寧可和天可汗談」', ['tdpol_haidong', 'yhpol_monarchy'], 'alliance',
                             '龍安府來的人取出一封女帝的親筆信：「朕與海東部有約，可是朕寧可和天可汗談。」天可汗讀完，沉默了很久：「她比我想的還狠——也比我想的還聰明。」她把銀碗喝乾。帳外，兩國的主戰派都不肯。'),
                   ]),
          ]),
    # ④ 終章・和盟
    finale('nspol_end_alliance', '和盟',
           '大燁與媞丹在鷹河榷場立盟：歲幣改成互市，兩國從此不再打仗。兩國主戰派的殘黨在立盟那天一起殺到了榷場。（終章：和盟）',
           '鷹河榷場重新搭起的茶馬市上掛滿了兩國的旗。立盟的桌子剛擺好，茶馬路的南邊與草原的北邊同時揚起了塵土——兩國主戰派的殘黨，一起來了。', 'nsa_started', [
               rally_yanye('rally_yh', '在鷹河榷場的茶馬市召來大燁的友軍', '南邊的塵土裡，是大燁主戰派的北伐軍。你需要大燁自己的人，來擋大燁自己的刀。',
                           MARKET, 'nsa_started', 'nsa_rally_yh'),
               rally_tidan('rally_td', '在鷹河榷場的茶馬市召來媞丹的友軍', '北邊的塵土裡，是媞丹主戰派的騎兵。你需要草原自己的人，來擋草原自己的刀。',
                           MARKET, 'nsa_rally_yh', 'nsa_rally_td'),
               fight('fight1', '在鷹河榷場的茶馬市擊倒大燁的主戰派大將', '大燁的主戰派大將提著長刀走進茶馬市，身後的禁軍排成一列：「三十年的歲幣，要用一場仗討回來。這張桌子，今天誰也坐不了。」',
                     MARKET, 'nsa_rally_td', [['ns_yanye_general', 1], ['ns_yanye_soldier', 1]],
                     '大將跪倒在茶馬市的中間，長刀插在地上。南邊的禁軍放下了刀。北邊的蹄聲，越來越近了。', LOSE, win_flags=['nsa_won1'], urgent=True),
               fight('fight2', '在鷹河榷場的茶馬市擊倒媞丹的主戰派大將', '媞丹的主戰派大將從北邊衝進來，馬蹄把立盟的桌子踩成兩半：「蒼狼不吃施捨，也不做買賣！」',
                     MARKET, 'nsa_won1', [['ns_tidan_general', 1], ['ns_tidan_rider', 1]],
                     '大將的馬倒下了，他自己摔進了鷹河。北邊的騎兵勒住了馬，看著茶馬市上兩國的旗，一個一個調轉了馬頭。', LOSE, win_flags=['nsa_won2'], urgent=True),
               node('end', '在鷹河榷場的茶馬市看兩國立盟',
                    '茶馬市上重新擺了一張桌子。天可汗與龍安府來的人各坐一邊，蘇時雍在中間把盟書念了一遍：歲幣改成互市，鷹河兩岸開十個榷場，兩國的兵不過鷹河。念完，兩邊各蓋了一個印。',
                    MARKET, 'nsa_won2', allies=[KHAN, SU],
                    success={'text': '天可汗把一張角弓交給你：「這張弓上刻了兩種字。以後誰要是忘了今天，你就拉給他看。」大燁與媞丹立盟了：歲幣變成互市，鷹河兩岸的茶與馬從此不再是貢品，是買賣。茶馬市的灰燼上，第一天就擠滿了人。',
                             'set_flags': ['nspol_alliance', 'nspol_done'],
                             'effects': [item('盟誓的角弓'), rep(TD, 8), rep(COURT, 8), aff(KHAN, 15, '陪她立下和盟'), aff(SU, 15, '兩國的盟書'), aff(ZHAOHUA, 10, '大燁與媞丹的和盟'),
                                         mem('政治線下半走向和盟：大燁與媞丹在鷹河榷場立盟，歲幣改成互市，兩國的兵不過鷹河；兩國主戰派的殘黨被擋了回去。', 3)],
                             'complete': True}),
           ]),
    # ④ 終章・征伐
    finale('nspol_end_war', '征伐',
           '大燁北伐或媞丹南下，兩國在鷹河邊打一仗。你站在哪一邊，對面就是另一邊的大將。（終章：征伐）',
           '鷹河兩岸紮滿了營帳：南岸是大燁的北伐軍，北岸是媞丹的騎兵。榷場的人都逃了，只剩下驛站的老闆還坐在門口擦銅牌：「打完了，總得有人告訴大家誰贏了。」', 'nsw_started', [
               node('side', '在鷹河榷場的驛站決定站在哪一邊',
                    '兩邊的人都來找你。大燁的使者說：「你在龍安府走過，你知道大燁要的不是草原，是不再被欺負。」媞丹的使者說：「你在草原上走過，你知道草原的人要的不是龍安府，是不再被施捨。」',
                    POST, 'nsw_started', 'choice', allies=[KEEPER], options=[
                        {'label': '站在大燁這一邊', 'success': {'text': '你走到南岸。大燁的北伐軍看著你，有人認出了你，喊了一聲你的名字。對岸的草原上，有人吹了一聲長長的口哨。', 'set_flags': ['nsw_side_yanye']}},
                        {'label': '站在媞丹這一邊', 'success': {'text': '你走到北岸。媞丹的騎兵用彎刀敲起了盾牌。對岸的大燁營帳裡，有人放下了望遠的銅管，嘆了口氣。', 'set_flags': ['nsw_side_tidan']}},
                    ]),
               rally_yanye('rally_yh', '在鷹河榷場的近郊召來大燁的友軍', '南岸的營帳裡，大燁的各路人馬還在吵誰打頭陣。你需要一支信得過的人。',
                           out('yinghe'), 'nsw_side_yanye', 'nsw_rallied'),
               rally_tidan('rally_td', '在鷹河榷場的近郊召來媞丹的友軍', '北岸的草原上，媞丹的各部還在爭誰打頭陣。你需要一支信得過的人。',
                           out('yinghe'), 'nsw_side_tidan', 'nsw_rallied'),
               fight('fight_t', '在鷹河榷場的近郊擊倒媞丹的主戰派大將', '鷹河的冰面上，媞丹的主戰派大將帶著怯薛衝過來，馬蹄把冰面踏得咔咔作響：「龍人的走狗！草原記得你！」',
                     out('yinghe'), {'flags': ['nsw_side_yanye', 'nsw_rallied']}, [['ns_tidan_general', 1], ['ns_tidan_rider', 1]],
                     '大將倒在冰面上，北岸的號角停了。媞丹的騎兵一個一個退回了草原。', LOSE, win_flags=['nsw_won'], urgent=True),
               fight('fight_y', '在鷹河榷場的近郊擊倒大燁的主戰派大將', '鷹河的冰面上，大燁的主戰派大將帶著禁軍壓過來，吐息裡帶著火：「替草原人打仗的龍人？大燁記得你！」',
                     out('yinghe'), {'flags': ['nsw_side_tidan', 'nsw_rallied']}, [['ns_yanye_general', 1], ['ns_yanye_soldier', 1]],
                     '大將倒在冰面上，南岸的戰鼓停了。大燁的北伐軍一營一營退回了茶馬路。', LOSE, win_flags=['nsw_won'], urgent=True),
               node('end_y', '在鷹河榷場看大燁贏了這一仗',
                    '北岸的營帳拔了，媞丹的騎兵退回了草原深處。龍安府來的人在驛站裡寫捷報，寫完把筆遞給你：「最後一句，你來寫。」',
                    POST, {'flags': ['nsw_won', 'nsw_side_yanye']}, allies=[SU],
                    success={'text': '大燁贏了鷹河之戰：鷹河以北三百里劃給大燁，歲幣停了，榷場改成大燁的關市。草原上的人說，那一年冬天特別冷。天可汗派人送來一句話，說是給「那個站在南岸的外人」：「草原記得你。」',
                             'set_flags': ['nspol_war_yanye', 'nsw_ended'],
                             'effects': [rep(COURT, 10), rep(TD, -10), aff(ZHAOHUA, 10, '替大燁贏了鷹河之戰'), aff(KHAN, -10, '站在大燁那一邊'),
                                         mem('政治線下半走向征伐：你站在大燁這一邊，在鷹河邊擊倒媞丹的主戰派大將；大燁拿下鷹河以北三百里，歲幣停了。', 3)]}),
               node('end_t', '在鷹河榷場看媞丹贏了這一仗',
                    '南岸的營帳拔了，大燁的北伐軍退回了茶馬路。天可汗騎著馬從北岸過來，金色的馬身上全是冰碴：「外人，你替草原打了一仗。」',
                    POST, {'flags': ['nsw_won', 'nsw_side_tidan']}, allies=[KHAN],
                    success={'text': '媞丹贏了鷹河之戰：鷹河以南三百里成了媞丹的草場，大燁的歲幣加了一倍。龍安府的人說，那一年的茶特別貴。天可汗拍了拍你的肩：「草原記得你。」',
                             'set_flags': ['nspol_war_tidan', 'nsw_ended'],
                             'effects': [rep(TD, 10), rep(COURT, -10), aff(KHAN, 15, '替草原贏了鷹河之戰'), aff(ZHAOHUA, -10, '站在媞丹那一邊'),
                                         mem('政治線下半走向征伐：你站在媞丹這一邊，在鷹河邊擊倒大燁的主戰派大將；媞丹拿下鷹河以南三百里，歲幣加了一倍。', 3)]}),
               node('blade', '在鷹河榷場的驛站收下那位大將的彎刀',
                    '仗打完了。驛站的老闆把一把彎刀放在你面前：「那位大將的刀。兩邊的人都說，該給打倒他的人。」刀背上刻著一排看不懂的戰功。',
                    POST, 'nsw_ended', allies=[KEEPER],
                    success={'text': '老闆把銅牌擦亮，掛回驛站的門口：「仗打完了，驛站還是要開的。」鷹河兩岸的人慢慢回來了——有的人回來找家，有的人回來找仇。你把彎刀繫在腰上。',
                             'set_flags': ['nspol_war', 'nspol_done'], 'effects': [item('破陣彎刀')], 'complete': True}),
           ]),
    # ④ 終章・海上之盟
    finale('nspol_end_sea', '海上之盟',
           '大燁與海東部結盟，要把媞丹逼回草原深處。怯薛長鐵牙的先鋒扛著黑纛殺向海東部的冬營。（終章：海上之盟）',
           '鷹河上游的雪原上，海東部的冬營燒起了報警的狼煙。地平線上，一面黑纛越來越近——鐵牙的先鋒來了。大燁的船還在鷹河下游，至少要再一天才到。', 'nss_started', [
               rally_yanye('rally_yh', '在海東部的冬營等大燁的友軍', '海蘭站在冬營的柵欄後面，看著越來越近的黑纛：「大燁的人什麼時候到？」大燁的盟約裡寫著會派人來——派誰來，看龍安府現在是誰說了算。',
                           camp(), 'nss_started', 'nss_rallied'),
               fight('fight', '在鷹河榷場的近郊擊倒黑纛的先鋒', '雪原上，黑纛的先鋒勒住馬，身後的怯薛排成一個半圓：「大燁的走狗、海東的叛徒——黑纛到的地方，就是媞丹的草場。」',
                     out('yinghe'), 'nss_rallied', [['ns_kheshig_vanguard', 1], ['ns_tidan_rider', 1]],
                     '先鋒倒在雪地裡，黑纛也倒了。怯薛們看著倒在雪裡的旗，誰也沒有去扶。過了很久，他們一個一個調轉了馬頭。', LOSE, win_flags=['nss_won'], urgent=True),
               node('end', '在海東部的冬營看海上之盟',
                    '大燁的船順著鷹河到了。冬營的篝火邊，海蘭與大燁的使者各執一卷盟書：大燁承認海東部，海東部替大燁守住鷹河的上游。托雅抱著一隻雪白的海東青，站在海蘭身後。',
                    camp(), 'nss_won', allies=[HAILAN, TOYA],
                    success={'text': '海蘭把一枚刻著龍與海東青的護符交給你：「這是盟約的信物。海東部的人看見它，就知道你是誰。」大燁與海東部立了海上之盟，媞丹被逼回了草原深處；天可汗沒有再派兵來，只是派人送來一句話：「這一局，你們贏了。下一局，我等著。」',
                             'set_flags': ['nspol_sea', 'nspol_done'],
                             'effects': [item('海東青的盟符'), rep(COURT, 8), rep(TD, -12), aff(HAILAN, 15, '陪她立下海上之盟'), aff(TOYA, 10, '海東青留在了海東的天上'),
                                         aff(TIEYA, -15, '擊倒了黑纛的先鋒'), mem('政治線下半走向海上之盟：大燁與海東部結盟，把媞丹逼回草原深處；你在雪原上擊倒了鐵牙的先鋒。', 3)],
                             'complete': True}),
           ]),
]

LINES = {'nspol_envoys': '政治線：南北交會・一', 'nspol_market_fire': '政治線：南北交會・二', 'nspol_night_council': '政治線：南北交會・三'}
for _s in STORIES:
    if _s['id'] in LINES:
        _s['summary'] += '（%s）' % LINES[_s['id']]
    elif _s['id'].startswith('nspol_end_'):
        _s['summary'] = _s['summary'].rsplit('（', 1)[0] + '（政治線：南北交會・終）'


if __name__ == '__main__':
    write_items(ITEMS)
    write_stories(STORIES)
