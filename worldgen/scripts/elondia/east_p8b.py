"""炎華之地 P8b：北原的地下城線（6 條）、獨特物品（1 條）、小任務（2 條）與獨特裝備（3 件）。EAST_CONTENT_PLAN 11.9 節。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p8b.py
旗標簡稱：tdm_ 鳴鏑古戰場、tdw_ 白狼雪窟、tdu_ 獨特物品、tdx_ 小任務。
最後一戰是底層層主（13 級），任務的等級是 B（11 級）：和南域的地下城線一樣，要練到底層的等級；輸了可以再打。
"""

from east_story_io import write_items, write_stories
from east_story_kit import aff, at_npc, cell, check, dungeon, fight, item, mem, money, node, out, rep, story, town

TD = 'tidan_khanate'
KHAN, CHALAN, QIQIGE, BATUR, GROOM, HAILAN, KEEPER, HU, AMUR = (
    'npc_td_ulantuya', 'npc_td_chalan', 'npc_td_qiqige', 'npc_td_batur', 'npc_td_old_groom', 'npc_td_hailan', 'npc_td_post_keeper',
    'npc_td_hu_zhanggui', 'npc_td_amur')
OVOO, NAADAM, SOUTH, POST = cell('jinzhang', 'lm_td_ovoo'), cell('jinzhang', 'lm_td_naadam'), cell('jinzhang', 'lm_td_south_court'), cell('yinghe', 'lm_td_post_station')

ITEMS = [
    {'name': '無名可汗的戰旗', 'category': 'equipment', 'price_cc': 3200, 'tags': ['unique'],
     'desc': '被抹去名字的那位可汗的戰旗，旗桿是一桿長戟，旗面燒得只剩一角；拿起它的時候，古戰場上的號角好像還在響。',
     'gear': {'base': 'halberd', 'material': 'mithril', 'rarity': 'epic', 'attrs': {'str': 1},
              'enchants': {'offense': {'necrotic': 0.25}, 'mods': {'hit': 1}}, 'unique': {'check': {'kinds': ['intimidate']}, 'bonus': 2}}},
    {'name': '蒼狼的牙', 'category': 'equipment', 'price_cc': 3200, 'tags': ['unique'],
     'desc': '蒼狼留給子孫的一顆牙，用皮繩穿著；戴著它走在雪地裡，狼群會讓路，暴風雪也找不到你。',
     'gear': {'base': 'pendant_cold', 'material': 'gold', 'rarity': 'epic', 'attrs': {'dex': 1},
              'enchants': {'offense': {'cold': 0.25}, 'mods': {'evade': 1}}, 'unique': {'check': {'contexts': ['travel', 'road']}, 'bonus': 2}}},
    {'name': '老馬倌的馬頭琴', 'category': 'equipment', 'price_cc': 1400, 'tags': ['unique'],
     'desc': '老馬倌在統一戰爭裡拉斷的那把馬頭琴，換上了白馬尾的新弦；吟遊詩人拿它當法器，一拉起來，草原上的風都會停下來聽。',
     'gear': {'base': 'focus', 'material': 'gold', 'rarity': 'rare', 'attrs': {'cha': 1},
              'enchants': {'resist': {'psychic': -0.25}, 'mods': {'save': 1}}, 'unique': {'check': {'attrs': ['cha']}, 'bonus': 1}}},
]


def unique(name):
    return item(name, 1)


STORIES = [
    # ================= 鳴鏑古戰場：無名可汗是誰 =================
    story('tdm_named_arrow', 'D', '刻著名字的鳴鏑',
          '拾骨人在鳴鏑古戰場撿到一支鳴鏑，箭桿上刻著一個名字——被刀刮掉了一半。老馬倌看了一眼，手就開始發抖。',
          {'kind': 'npc', 'npc': GROOM,
           'text': '老馬倌把一支發黑的鳴鏑攥在手裡，聲音壓得很低：「拾骨人在古戰場的淺層撿到的。箭桿上刻著可汗的名字——那位不能說名字的可汗。」他把鳴鏑塞給你，「另一半，在亡騎的箭囊裡。拾骨人不敢去拿。」'},
          'tdm_1_started', [
              fight('riders', '到鳴鏑古戰場的淺層擊倒守著箭囊的亡騎', '淺層的壕溝邊，一隊亡騎繞著一面倒下的戰旗打轉，箭囊在骨頭馬身上嘩嘩作響。',
                    dungeon('mingdi_field', 'shallow'), 'tdm_1_started', [['ghost_rider', 1], ['broken_arrow_ghost', 1]],
                    '亡騎散成一堆骨頭。箭囊裡插滿了同樣的鳴鏑，每一支的箭桿上都刻著名字，每一個名字都被刮掉了。', win_flags=['tdm_quiver']),
              check('read', '在鳴鏑古戰場的淺層拼出箭桿上的名字', '你把幾十支鳴鏑攤在地上，一支一支比對刮痕：有的刮掉了頭，有的刮掉了尾。',
                    dungeon('mingdi_field', 'shallow'), 'tdm_quiver', 'int', 13,
                    '拼出來了，可是只拼出一半：「阿勒……」後面的字，所有的箭桿上都刮得一乾二淨。', '刮痕太亂了，拼不起來。再試一次。', win_flags=['tdm_half']),
              node('report', '回金帳王庭把拼出來的名字告訴老馬倌', '老馬倌聽見「阿勒」兩個字，閉上了那隻好眼睛：「對……是這個開頭。」他沒有說下去，「後面的，我不能說。說了，斷事官會來。」',
                   at_npc(GROOM, 'jinzhang'), 'tdm_half', allies=[GROOM],
                   success={'text': '「可是古戰場的深處有人記得，」他說，「鐵浮屠的統領是他的結義兄弟。你去問他——死人不怕斷事官。」', 'set_flags': ['tdm_1_done'],
                            'effects': [aff(GROOM, 10, '拼出了可汗名字的一半'), mem('在鳴鏑古戰場的淺層從亡騎的箭囊裡拼出被抹去名字的可汗的一半名字：「阿勒……」')], 'complete': True}),
          ]),
    story('tdm_iron_pagoda', 'C', '鐵浮屠的盟誓',
          '鐵浮屠重騎的統領是無名可汗的結義兄弟，二十年來站在古戰場中層的盡頭。驛站的老闆說，他守的不是路，是一個名字。',
          {'kind': 'informant', 'location': 'yinghe', 'price': 200, 'requires': {'flags': ['tdm_1_done']},
           'text': '驛站的老闆把銅牌擦了又擦：「鐵浮屠的統領？統一戰爭最後一年，他和那位可汗割破手掌結義，說誰先死，另一個就替他守住名字。天可汗贏了，那位可汗死了——鐵浮屠就站在那裡，再也沒有倒下。」'},
          'tdm_2_started', [
              fight('shells', '到鳴鏑古戰場的中層擊倒守在路上的殘甲與拐子馬', '中層的霧裡，空空的鐵甲與連成一排的拐子馬亡靈擋住去路，一齊轉向你。',
                    dungeon('mingdi_field', 'middle'), 'tdm_2_started', [['iron_pagoda_shell', 1], ['guaizi_horse_ghost', 1]],
                    '殘甲倒地，拐子馬的鐵鏈散成一地。霧的盡頭，有一座黑色的鐵塔一動不動地站著。', win_flags=['tdm_road']),
              fight('pagoda', '在鳴鏑古戰場的中層擊倒鐵浮屠', '鐵塔動了。三層鐵甲裡傳出低沉的聲音：「名字，不給。」',
                    dungeon('mingdi_field', 'middle'), 'tdm_road', [['iron_pagoda', 1], ['iron_pagoda_shell', 1]],
                    '鐵浮屠單膝跪地，鬼面裂成兩半。他沒有散去，只是低著頭：「……你打贏了我。照草原的規矩，贏的人可以問一件事。」',
                    '鐵浮屠把你們逼退到霧裡。他沒有追，只是站回原地。', win_flags=['tdm_ask']),
              node('ask', '在鳴鏑古戰場的中層問鐵浮屠', '鐵浮屠的聲音像生鏽的鐵：「我替他守了二十年的名字。你要問的，就是這個吧。」',
                   dungeon('mingdi_field', 'middle'), 'tdm_ask', 'choice', options=[
                       {'label': '「他叫什麼名字？」', 'success': {
                           'text': '「阿勒坦。」鐵浮屠說，「金子的意思。」說完這兩個字，三層鐵甲一層一層地垮了下去，裡面空空的，什麼也沒有——他守了二十年，守完了。',
                           'set_flags': ['tdm_2_done', 'tdm_name'], 'effects': [mem('在鳴鏑古戰場的中層打倒鐵浮屠；他說出了被抹去名字的可汗的名字：阿勒坦。', 3)], 'complete': True}},
                       {'label': '「你想讓我知道嗎？」', 'success': {
                           'text': '鐵浮屠沉默了很久：「……沒有人問過我。」他把鬼面摘下來，交到你手上，「名字在最深處，他自己會告訴你。我守到這裡就好。」說完，他靜靜地垮了下去。',
                           'set_flags': ['tdm_2_done'], 'effects': [item('鐵浮屠的鬼面', 1), mem('在鳴鏑古戰場的中層打倒鐵浮屠；他沒有說出名字，把鬼面交給了你。', 3)], 'complete': True}},
                   ]),
          ]),
    story('tdm_nameless_khan', 'B', '無名的可汗',
          '鳴鏑古戰場的最深處，被抹去名字的可汗每一夜都在重演那場決戰。打倒他，他才會停下來聽你說話。',
          {'kind': 'guild', 'location': 'jinzhang', 'requires': {'flags': ['tdm_2_done']},
           'text': '公會的委託單上沒有委託人的名字，只蓋著一個敖包的印：「鳴鏑古戰場底層，號角二十年不停。請止之。」字寫得很慢，像是用燒過的骨頭寫的。'},
          'tdm_3_started', [
              fight('army', '到鳴鏑古戰場的底層擊倒列陣的亡軍', '底層的壕溝後面，戴著黑纓的亡軍列成三排，聽見腳步聲，一齊舉起了彎刀。',
                    dungeon('mingdi_field', 'abyss'), 'tdm_3_started', [['nameless_khan_army', 2]],
                    '亡軍倒下了。陣後的高坡上，一位穿著金甲、冠冕被砍成兩半的可汗慢慢轉過身來。', win_flags=['tdm_khan']),
              fight('khan', '在鳴鏑古戰場的底層擊倒無名的可汗', '可汗舉起戰旗，聲音像二十年前一樣響亮：「草原的兒子們——衝！」身後空無一人的陣地上，響起了萬馬奔騰的聲音。',
                    dungeon('mingdi_field', 'abyss'), 'tdm_khan', [['nameless_khan', 1], ['nameless_khan_army', 1]],
                    '可汗倒在高坡上，像二十年前一樣。這一次，重演停住了。他看著你，第一次開口說了衝鋒以外的話：「……外人。我的名字，還有人記得嗎？」',
                    '亡軍的衝鋒把你們逼退到壕溝外。打倒他之前，這場決戰不會結束。', win_flags=['tdm_end']),
              node('end', '在鳴鏑古戰場的底層回答無名的可汗', '可汗的身影一點一點變淡。他的戰旗倒在你腳邊，旗面燒得只剩一角。',
                   dungeon('mingdi_field', 'abyss'), 'tdm_end', 'choice', options=[
                       {'label': '「你叫阿勒坦」', 'requires': {'flags': ['tdm_name']}, 'success': {
                           'text': '可汗笑了，那是一個很年輕的笑：「阿勒坦……對，我叫阿勒坦。」他的身影化成一陣風，往北方吹去。古戰場的號角停了。你把這個名字帶回敖包，其其格在骨頭上刻下它，燒成了灰——長生天收下了。',
                           'set_flags': ['tdm_3_done', 'tdm_returned'], 'effects': [aff(QIQIGE, 12, '替無名的可汗找回了名字'), aff(KHAN, -5, '說出了她抹掉的名字'),
                                                                                  mem('在鳴鏑古戰場的底層打倒無名的可汗，對他說出他的名字阿勒坦；他回到了長生天，古戰場的號角停了。', 3)], 'complete': True}},
                       {'label': '「我會替你問出來」', 'success': {
                           'text': '可汗點點頭：「那我再等一等。」他的身影淡去，號角卻沒有停。也許有一天，有人會把那個名字還給他——在對的時候、對的人面前。',
                           'set_flags': ['tdm_3_done', 'tdm_waiting'], 'effects': [mem('在鳴鏑古戰場的底層打倒無名的可汗；他的名字還沒找回來，他說他再等一等。', 3)], 'complete': True}},
                       {'label': '「名字是天可汗抹掉的，去問她」', 'success': {
                           'text': '可汗沉默了，然後大笑起來，笑聲在古戰場上迴盪：「好！那就讓她親口說！」他的身影化成一陣風，往金帳的方向吹去。那一夜，金帳的燈亮到天亮——沒有人知道天可汗聽見了什麼。',
                           'set_flags': ['tdm_3_done', 'tdm_to_khan'], 'effects': [aff(KHAN, 5, '把她的過去帶到她面前'), mem('在鳴鏑古戰場的底層打倒無名的可汗，要他去問天可汗自己的名字；那一夜金帳的燈亮到天亮。', 3)], 'complete': True}},
                   ]),
          ], extra_rewards=[unique('無名可汗的戰旗')]),
    # ================= 白狼雪窟：蒼狼的祖先傳說 =================
    story('tdw_coming_of_age', 'D', '成年禮',
          '蒼狼部的少年要獨自走進白狼雪窟，帶回一顆白狼的牙才算成年。今年有一個少年進去了三天，還沒有出來。',
          {'kind': 'npc', 'npc': BATUR,
           'text': '巴特爾難得一臉焦急：「我表弟，十六歲，進雪窟拿白狼牙，三天了。」他搓著手，「蒼狼部的規矩，成年禮不能有人幫——可是規矩沒說，不能有人去把他找回來。」'},
          'tdw_1_started', [
              fight('wolves', '到白狼雪窟的淺層擊倒圍住少年的白狼', '淺層的冰縫裡，一個少年縮在角落，手裡握著斷掉的短刀；兩隻白狼在冰縫外來回踱步。',
                    dungeon('whitewolf_cave', 'shallow'), 'tdw_1_started', [['white_wolf', 2]],
                    '白狼退開了，其中一隻回頭看了你一眼，眼神不像野獸。少年從冰縫裡爬出來，凍得說不出話。', win_flags=['tdw_found']),
              check('tooth', '在白狼雪窟的淺層替少年找一顆白狼牙', '少年說，沒有白狼牙回去，他寧可死在這裡。冰橋下的雪裡，好像有白色的東西。',
                    dungeon('whitewolf_cave', 'shallow'), 'tdw_found', 'int', 12,
                    '你在雪裡挖出一顆白狼的老牙，牙根上刻著蒼狼部的記號——是很多年前，別的少年留下的。少年捧著它，哭了出來。', '雪太深了，挖不到。再找找。',
                    win_flags=['tdw_tooth']),
              node('back', '帶少年回金帳王庭交給巴特爾', '巴特爾一把抱住表弟，差點把他勒斷氣。然後他看著那顆刻著記號的老牙：「這是……我爺爺那一輩留的。」',
                   at_npc(BATUR, 'jinzhang'), 'tdw_tooth', allies=[BATUR],
                   success={'text': '「老人說，雪窟最深處睡著蒼狼，白狼都是牠的子孫，」巴特爾說，「牠們放過我表弟，是因為他是蒼狼部的人。」他看著你，「可是牠們也放過了你。」', 'set_flags': ['tdw_1_done'],
                            'effects': [aff(BATUR, 12, '把表弟從雪窟帶回來'), mem('到白狼雪窟的淺層救回蒼狼部進去行成年禮的少年；白狼放過了他，也放過了你。')], 'complete': True}),
          ]),
    story('tdw_ice_queen', 'C', '冰后的宮殿',
          '雪窟深層的冰后把走進宮殿的人凍成冰雕。可是驛站的老闆說，被凍住的人裡，有一個在冰裡還睜著眼睛。',
          {'kind': 'informant', 'location': 'yinghe', 'price': 200, 'requires': {'flags': ['tdw_1_done']},
           'text': '驛站的老闆壓低了聲音：「海東部的獵手說，雪窟深層有一座冰的宮殿，冰后把人凍成冰雕擺在王座兩旁。其中一個是二十年前的蒼狼部巫師——他在冰裡還睜著眼睛，好像在等誰去問他什麼。」'},
          'tdw_2_started', [
              fight('guards', '到白狼雪窟的深層擊倒守著冰宮的霜鬃狼與雪女', '深層的冰宮門口，霜鬃狼伏在雪裡，雪女倚著冰柱，對你招了招手。',
                    dungeon('whitewolf_cave', 'deep'), 'tdw_2_started', [['frostmane_wolf', 1], ['yuki_onna', 1]],
                    '霜鬃狼倒下了，雪女化成一陣雪花散去。冰宮的門自己開了。', win_flags=['tdw_palace']),
              fight('queen', '在白狼雪窟的深層擊倒冰后', '冰的王座上，冰后慢慢站起來，冰冠下的眼睛是極地的藍：「又一個想帶走我的冰雕的人。」',
                    dungeon('whitewolf_cave', 'deep'), 'tdw_palace', [['ice_queen', 1], ['yuki_onna', 1]],
                    '冰后跪倒在王座前，冰冠裂了一道縫。王座旁的冰雕裡，那位巫師的眼睛轉向了你。',
                    '冰后的暴風雪把你們吹出了宮門。她沒有追，只是坐回王座上。', win_flags=['tdw_shaman']),
              node('ask', '在白狼雪窟的深層問冰裡的巫師', '冰裡的巫師開不了口，可是冰面上慢慢浮出一行字：「蒼狼在最深處。牠醒著的時候，會問來的人一個問題。答錯的人，就留在這裡。」',
                   dungeon('whitewolf_cave', 'deep'), 'tdw_shaman', 'choice', options=[
                       {'label': '「牠會問什麼？」', 'success': {
                           'text': '冰面上的字慢慢變了：「牠會問：我的子孫，現在怎麼樣了。」然後字消失了，巫師的眼睛也閉上了——這一次，像是睡著了。',
                           'set_flags': ['tdw_2_done', 'tdw_question'], 'effects': [mem('在白狼雪窟的深層打倒冰后；冰裡的巫師告訴你，蒼狼會問來的人：「我的子孫，現在怎麼樣了。」', 3)], 'complete': True}},
                       {'label': '打碎冰，放巫師走', 'success': {
                           'text': '你一刀劈在冰上。冰碎了，巫師的身體也跟著碎了——他在二十年前就死了，只剩下等待。一縷白氣從碎冰裡飄出來，往雪窟的最深處去了。',
                           'set_flags': ['tdw_2_done'], 'effects': [mem('在白狼雪窟的深層打倒冰后，打碎了冰裡的巫師；他的魂往雪窟的最深處去了。', 3)], 'complete': True}},
                   ]),
          ]),
    story('tdw_blue_wolf', 'B', '蒼狼',
          '白狼雪窟的最深處睡著傳說中蒼狼部的祖先。牠每一次醒來，都要看看牠的子孫變成了什麼樣子。',
          {'kind': 'guild', 'location': 'yinghe', 'requires': {'flags': ['tdw_2_done']},
           'text': '公會的委託單上畫著一隻狼的爪印，底下寫著：「白狼雪窟最深處，狼影越來越多，雪窟口的冰在往外長。請去看看是誰醒了。」委託人是海東部的鷹獵手——他們說，狼影已經追到了冬營的外面。'},
          'tdw_3_started', [
              fight('shadows', '到白狼雪窟的底層擊倒遊蕩的蒼狼之影', '底層的冰原上，灰色的狼影一隻接一隻地從暴風雪裡走出來，沒有腳印，也沒有影子。',
                    dungeon('whitewolf_cave', 'abyss'), 'tdw_3_started', [['canglang_shadow', 2]],
                    '狼影散了。冰原的盡頭，一隻灰得像天色的巨狼慢慢抬起頭來。', win_flags=['tdw_wolf']),
              fight('wolf', '在白狼雪窟的底層擊倒蒼狼', '蒼狼站起來，比冰窟還高：「你身上沒有我的味道。」牠的聲音像暴風雪，「那就讓我看看，你有沒有資格回答我。」',
                    dungeon('whitewolf_cave', 'abyss'), 'tdw_wolf', [['canglang', 1], ['canglang_shadow', 1]],
                    '蒼狼伏在冰上，喘著白氣，眼睛卻笑了：「好。你有資格。」牠低下頭，看著你：「告訴我——我的子孫，現在怎麼樣了？」',
                    '蒼狼的暴風雪把你們吹回了冰原的邊緣。打倒牠之前，牠不會聽你說話。', win_flags=['tdw_answer']),
              node('end', '在白狼雪窟的底層回答蒼狼', '蒼狼等著你的回答，暴風雪停了下來，整個雪窟安靜得聽得見冰在裂。',
                   dungeon('whitewolf_cave', 'abyss'), 'tdw_answer', 'choice', options=[
                       {'label': '「草原統一了，牠們是一家人」', 'success': {
                           'text': '蒼狼閉上眼睛：「一家人……」牠沉默了很久，「一家人裡，有沒有被殺掉的兄弟？」你沒有回答。牠嘆了一口白氣，把頭擱回冰上，「我再睡一會兒。等牠們真的是一家人了，再叫醒我。」',
                           'set_flags': ['tdw_3_done', 'tdw_end_unity'], 'effects': [aff(KHAN, 6, '對蒼狼說草原統一了'), mem('在白狼雪窟的底層打倒蒼狼，告訴牠草原統一了；牠說等牠的子孫真的是一家人了，再叫醒牠。', 3)], 'complete': True}},
                       {'label': '「兄弟殺了兄弟，名字被刮掉了」', 'success': {
                           'text': '蒼狼的眼睛燒了起來，整個雪窟都在震動。然後牠慢慢平靜下來：「……謝謝你說真話。」牠低下頭，一顆牙掉在你面前，「拿去給那個刮掉名字的人看。告訴她，蒼狼還記得每一個子孫。」',
                           'set_flags': ['tdw_3_done', 'tdw_end_truth'], 'effects': [aff(QIQIGE, 8, '對蒼狼說了真話'), mem('在白狼雪窟的底層打倒蒼狼，告訴牠兄弟殺了兄弟；牠說蒼狼還記得每一個子孫。', 3)], 'complete': True}},
                       {'label': '「最小的那一支，還在鷹河邊等著」', 'success': {
                           'text': '「海東……」蒼狼的耳朵動了一下，「最後一個出生的，總是最倔的。」牠站起來，朝東方嚎了一聲，聲音穿過冰窟，傳到了鷹河邊。那天晚上，海東部的冬營外，狼群在雪地裡排成一圈，守了一整夜。',
                           'set_flags': ['tdw_3_done', 'tdw_end_haidong'], 'effects': [aff(HAILAN, 10, '讓蒼狼想起了海東部'), mem('在白狼雪窟的底層打倒蒼狼，告訴牠海東部還在鷹河邊；牠朝東方嚎了一聲，狼群替海東部的冬營守了一夜。', 3)], 'complete': True}},
                   ]),
          ], extra_rewards=[unique('蒼狼的牙')]),
    # ================= 獨特物品：斷弦的馬頭琴 =================
    story('tdu_broken_fiddle', 'C', '斷弦的馬頭琴',
          '老馬倌手上的琴弓，琴已經沒有了：統一戰爭最後一夜，他拉斷了弦，琴身也裂了。他說，要白馬的尾毛做弦，才拉得出那一夜的調子。',
          {'kind': 'npc', 'npc': GROOM,
           'text': '老馬倌把一把裂了的馬頭琴從氈子底下拿出來，琴頭的馬雕還在，弦全斷了：「那一夜我拉的是送行的調子，拉到一半弦斷了。」他摸著琴頭，「新弦要白馬的尾毛。王庭裡最白的尾巴……是國師的。」他自己都笑了，「我不敢開口。」'},
          'tdu_1_started', [
              check('tail', '在金帳王庭的敖包向其其格討幾根尾毛', '其其格聽你說完，雪白的馬尾在身後慢慢甩了一下：「……你要我的尾毛，給老馬倌做琴弦？」她的臉上沒有表情，耳朵卻紅了。',
                    OVOO, 'tdu_1_started', 'cha', 14,
                    '她沉默了很久，然後轉過身去，自己拔了一小束尾毛塞進你手裡：「不要告訴別人是我的。」走開的時候，她的尾巴甩得比平常快。',
                    '其其格冷冷地看著你：「下一個。」你只好先退下，換個說法再來。', win_flags=['tdu_hair']),
              node('rosin', '到鷹河榷場找胡掌櫃要大燁的松香', '胡掌櫃從櫃子裡拿出一小塊金黃的松香：「大燁的琴松香，草原上買不到的。」他推了推眼鏡，「給老馬倌的？那就不收錢了——他年輕時替胡記牽過馬。」',
                   town('yinghe'), 'tdu_hair', success={'text': '你把松香和尾毛一起包好。', 'set_flags': ['tdu_rosin'], 'effects': [aff(HU, 5, '替老馬倌討松香')]}),
              node('play', '回金帳王庭把尾毛與松香交給老馬倌', '老馬倌一根一根把尾毛搓成弦，裝上琴，抹上松香。他把琴夾在腿間，拉了第一個音——帳外的馬全都抬起了頭。',
                   at_npc(GROOM, 'jinzhang'), 'tdu_rosin', allies=[GROOM],
                   success={'text': '他拉完了那一夜沒拉完的送行調子，拉完之後，把琴放進你手裡：「我老了，拉不了幾次了。你帶著它走——草原上有誰需要送行，替我拉一段。」', 'set_flags': ['tdu_1_done'],
                            'effects': [aff(GROOM, 15, '替他修好了馬頭琴'), aff(QIQIGE, 3, '琴弦是她的尾毛'), mem('替老馬倌討來國師其其格的尾毛與胡記的松香，修好了他在統一戰爭最後一夜拉斷的馬頭琴；他把琴送給了你。')],
                            'complete': True}),
          ], merit=8, extra_rewards=[unique('老馬倌的馬頭琴')]),
    # ================= 小任務 =================
    story('tdx_post_letter', 'E', '驛站的急信',
          '驛站的信差半路摔斷了腿，一封要送到金帳王庭南院的急信卡在鷹河榷場。驛站的老闆說，持驛牌的人走驛道不用錢——今天的驛牌借你。',
          {'kind': 'npc', 'npc': KEEPER,
           'text': '驛站的老闆把一塊銅牌和一個封了蠟的皮筒推給你：「南院的急信，四天內要到金帳王庭。信差摔斷了腿，你替他跑一趟。」他眨了眨眼，「信裡寫什麼別看——看了也看不懂，是大燁的字。」'},
          'tdx_letter_started', [
              node('deliver', '到金帳王庭的南院大帳送急信', '南院的書吏接過皮筒，看了看封蠟，鬆了一口氣：「趕上了。」他在驛牌上蓋了一個印，「回去交給驛站的老闆，他會付你跑腿錢。」',
                   SOUTH, 'tdx_letter_started', success={'text': '你把蓋了印的驛牌收好。', 'set_flags': ['tdx_letter_sent']}),
              node('back', '回鷹河榷場的驛站交還驛牌', '驛站的老闆看了看驛牌上的印，滿意地點頭：「準時。草原上最值錢的不是馬，是準時。」',
                   POST, 'tdx_letter_sent', allies=[KEEPER],
                   success={'text': '他數了一把錢給你，又倒了一碗奶茶：「下次驛站有急事，我還找你。」', 'set_flags': ['tdx_letter_done'],
                            'effects': [money(60), aff(KEEPER, 8, '替驛站跑了一趟急信')], 'complete': True}),
          ]),
    story('tdx_lost_foal', 'E', '走失的小馬',
          '老馬倌最疼的一匹小母馬昨夜掙斷了韁繩跑了。王庭北邊的草坡上有狼。',
          {'kind': 'npc', 'npc': GROOM,
           'text': '老馬倌急得團團轉：「我的小白，昨夜掙斷韁繩跑了。才一歲，什麼都不懂。」他指著北邊，「草坡上有狼群，牠跑不過狼的。」'},
          'tdx_foal_started', [
              fight('wolves', '到金帳王庭的近郊趕走圍住小馬的狼群', '北邊的草坡上，一匹雪白的小馬被逼到石堆邊，三隻灰狼繞著牠打轉。',
                    out('jinzhang'), 'tdx_foal_started', [['steppe_wolf_pack', 2]], '狼群夾著尾巴跑了。小白馬抖著腿，把頭靠在你的肩上。', win_flags=['tdx_foal_found']),
              node('back', '把小馬帶回金帳王庭交給老馬倌', '老馬倌一看見小白，眼淚就掉了下來，抱著牠的脖子說了一大串誰也聽不懂的話。',
                   at_npc(GROOM, 'jinzhang'), 'tdx_foal_found', allies=[GROOM],
                   success={'text': '「謝謝你。」他抹著眼淚，「牠長大了會是一匹好馬。到時候，我讓牠認你。」', 'set_flags': ['tdx_foal_done'],
                            'effects': [money(30), aff(GROOM, 10, '找回了他的小馬')], 'complete': True}),
          ]),
]

LINES = {
    'tdm_named_arrow': '鳴鏑古戰場・一', 'tdm_iron_pagoda': '鳴鏑古戰場・二', 'tdm_nameless_khan': '鳴鏑古戰場・三',
    'tdw_coming_of_age': '白狼雪窟・一', 'tdw_ice_queen': '白狼雪窟・二', 'tdw_blue_wolf': '白狼雪窟・三',
    'tdu_broken_fiddle': '斷弦的馬頭琴・一',
}
for _s in STORIES:
    if _s['id'] in LINES:
        _s['summary'] += '（%s）' % LINES[_s['id']]

if __name__ == '__main__':
    write_items(ITEMS)
    write_stories(STORIES)
