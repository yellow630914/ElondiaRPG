"""炎華之地 P4e（二）：多人任務 4 條，以及成人向角色與多人任務解鎖的地標場景。EAST_CONTENT_PLAN 8.10 節、第 6 節。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p4e_group.py（先跑 east_p4e_lines.py）
場景寫進 data/world/landmarks.json 的 scenes（east_p3_places.py 重跑時會從這裡帶回來）。
"""

import json

from east_story_io import write_stories
from east_story_kit import aff, at_npc, cell, check, fight, mem, node, out, story

ZHAOHUA, SU, LU, JIU, JIN, RUYU = 'npc_yh_zhaohua', 'npc_yh_su_huaijin', 'npc_yh_lu_qinghe', 'npc_yh_hu_jiuniang', 'npc_yh_jin_yutang', 'npc_yh_wen_ruyu'
XIAO, XUAN, QINGLUO, SANNIANG, WENYI, YUXIAO = ('npc_yh_xiao_fengyi', 'npc_yh_xuanshuang', 'npc_yh_qingluo', 'npc_yh_hu_sanniang',
                                               'npc_yh_wen_yi', 'npc_yh_hu_yuxiao')
TOWER, INNER = 'sm_yh_xuande_tower', 'sm_yh_xiantang_inner'
TAIFEI, JINYU = cell('longan', 'lm_yh_taifei'), cell('quanzhou', 'lm_yh_jinyu')
GROUP = '（多人特殊任務）'


def tower(x=5, y=2):
    return {'where': 'special', 'special_map': TOWER, 'x': x, 'y': y}


def all_aff(npcs, delta, reason):
    return [aff(n, delta, reason) for n in npcs]


STORIES = []

# ================= 五席的夜宴（照「女統治者們的茶話會」，不是成人向） =================
FIVE = [ZHAOHUA, SU, LU, JIU, JIN]
STORIES.append(story(
    'yg_five_seats', 'B', '五席的夜宴',
    '大燁立憲之後的第一次五席會議：朝廷、萍江的官府與農工、瑔州港的胡記與金黃鱗各一席。會議之後的夜宴只有五個人——她們發現，聊的是同一個人。' + GROUP,
    {'kind': 'guild', 'location': 'longan', 'min_level': 15,
     'requires': {'flags': ['yhpol_constitution', 'yczh_lover', 'ycsh_lover', 'yclq_lover', 'ychj_lover', 'ycjy_lover']},
     'text': '溫如玉在公會等你，手上是一封蓋了五個印的信：龍紋的玉璽、萍江府的官印、織工行會的梭子印、胡記的狐印、金墨盟的金秤印。「陛下親手交給我的，」她說，「要我當面給你。」信上只有一句話：「五席會議，請證人出席。會後設宴，只有五席——和你。」'},
    'ygfs_started', [
        node('up', '到龍安府的公會跟溫如玉進宮', '溫如玉帶著你從皇城的側門進去：「宣德樓的偏殿。五位都到了。」她看了你一眼，「……我先說，陛下今天一早就在挑衣服。」',
             cell('longan', 'guild'), 'ygfs_started', allies=[RUYU],
             success={'text': '你們登上宣德樓。偏殿的門開著，五張椅子圍著一張圓桌，第六張椅子空著。', 'set_flags': ['ygfs_in'], 'special_map': TOWER}),
        check('witness', '在宣德樓的偏殿為五席會議作證', '憲章的第一條念完了，五個人輪流簽名。輪到證人發言的時候，五雙眼睛同時看向你：女帝、蘇懷瑾、陸青禾、胡九娘、金玉棠。',
              tower(5, 2), 'ygfs_in', 'int', 17,
              '你說了萍江的織機、瑔州港的船、龍安府的科舉、青丘屯的堂口，說到最後，五個人都沒有說話。女帝第一個在憲章上蓋了玉璽：「這個人走過的大燁，就是五席要守住的大燁。」',
              '你講得結結巴巴，可是每講到一個地方，就有一個人輕輕點頭——那是她的地方。最後陸青禾拍桌大笑：「夠了，簽！」五個印蓋在同一張憲章上。',
              win_flags=['ygfs_signed']),
        fight('remnant', '晚上在龍安府的近郊擋下宰相舊部的殘黨', '憲章簽完的當晚，宰相舊部的死士埋伏在城外的官道上，等著胡九娘與金玉棠回瑔州港的馬車。',
              out('longan'), 'ygfs_signed', [['yh_deathsworn', 3]],
              '死士倒下了。兩輛馬車的車門同時打開，胡九娘和金玉棠一起走下來，看著擋在路中間的你。胡九娘用扇子掩著嘴：「哎呀，又擋在前面。」金玉棠看了她一眼：「……妳也是？」',
              '死士把你逼到了路邊——然後一支火銃在暗處響了，胡記的護衛和金玉行的水手一起衝了出來。胡九娘收起扇子：「我的人。」金玉棠：「我的人。」兩人對看了一眼，又一起看著你。',
              win_flags=['ygfs_saved'], hours='night'),
        node('banquet', '在宣德樓的偏殿參加五席的夜宴', '偏殿的圓桌上擺好了酒菜，五個人都換了便服。女帝放下酒杯：「我們剛才發現了一件事。」蘇懷瑾翻開一本冊子：「五個人的證詞，指向同一個人。」陸青禾翹著腳：「所以我們要開一場會。」胡九娘笑得很甜：「議題只有一個。」金玉棠把酒壺推到你面前：「坐。今晚的會，很長。」',
             tower(5, 2), 'ygfs_saved', 'choice', hours='night', options=[
                 {'label': '坐下，「請五席裁決」', 'success': {
                     'text': '五個人互看了一眼，然後一起笑了出來。那一場會從入夜開到天亮，議題是：你。每個人輪流說一件你做過的蠢事，再說一件你做過的好事。最後五席一致通過了一條不寫進憲章的條文。條文的第一個字是：輪。',
                     'set_flags': ['ygfs_done', 'ygfs_rota'], 'effects': all_aff(FIVE, 10, '出席了五席的夜宴') + [mem('大燁立憲之後，五席在宣德樓的夜宴上發現她們聊的是同一個人。那一場會開到天亮，最後五席一致通過了一條不寫進憲章的條文。', 3)],
                     'complete': True, 'time': {'until': 'morning'}}},
                 {'label': '「我能先喝一杯嗎？」', 'success': {
                     'text': '陸青禾第一個笑出了聲，接著是胡九娘，然後是所有人。蘇懷瑾嘆了口氣，親手替你斟滿：「……准。」女帝把下巴擱在手上看著你：「喝慢一點。今晚很長。」那一夜的宣德樓，偏殿的燈一直亮著。',
                     'set_flags': ['ygfs_done'], 'effects': all_aff(FIVE, 10, '出席了五席的夜宴') + [mem('大燁立憲之後，五席在宣德樓的夜宴上發現她們聊的是同一個人。你先喝了一杯——那一夜，偏殿的燈一直亮著。', 3)],
                     'complete': True, 'time': {'until': 'morning'}}},
             ]),
    ], merit=10))

# ================= 太妃宮的兩代同堂（成人向） =================
STORIES.append(story(
    'yg_two_generations', 'B', '太妃宮的兩代同堂',
    '內容警示：母女同時和主角親密。太后溫懿與女帝燁昭華這對母女，在太妃宮同時發現了你是彼此的人；隔壁的太妃胡玉綃看熱鬧看得很開心。' + GROUP,
    {'kind': 'npc', 'npc': WENYI, 'min_level': 11, 'requires': {'flags': ['yawy_lover', 'yczh_x_done']},
     'text': '太后今晚沒有要你讀詩。她坐在燈下，手裡的念珠一顆一顆地撥：「昭華今晚要來太妃宮用膳。她說，有事要問我。」她抬起頭，「……我想，我也有事要問她。」'},
    'yg2g_started', [
        node('dinner', '晚上在龍安府的太妃宮陪太后和女帝用膳', '女帝來了。母女倆隔著一桌菜，誰也沒動筷子。女帝先開口：「母后，我的人最近常來太妃宮。」太后放下念珠：「陛下的人，最近常在我這裡過夜。」兩人同時看向你。',
             TAIFEI, 'yg2g_started', 'choice', hours='night', options=[
                 {'label': '「我都是認真的」', 'success': {'text': '殿裡安靜得能聽見燭芯爆開的聲音。然後月洞門那頭傳來一陣笑聲，太妃胡玉綃倚在門邊，三條尾巴搖得很歡：「哎呀，終於撞見了。我等這一天等好久了。」',
                                                    'set_flags': ['yg2g_caught']}},
                 {'label': '「……我先告退」', 'success': {'text': '你剛站起來，月洞門那頭就傳來一陣笑聲。太妃胡玉綃倚在門邊，尾巴擋住了出口：「走什麼？好戲才要開場。」',
                                                   'set_flags': ['yg2g_caught']}},
             ]),
        check('calm', '在龍安府的太妃宮勸住要吵起來的母女', '女帝站了起來：「母后在政事上向著舅舅，現在連——」太后也站了起來：「陛下五年不來看我，現在倒是——」胡玉綃嗑著瓜子：「繼續、繼續。」',
              TAIFEI, 'yg2g_caught', 'cha', 16,
              '你說了城樓頂的冷茶，也說了太妃宮的長夜：兩個人都一樣寂寞，一樣不肯先開口。母女倆看著對方，很久都沒有說話。最後太后先伸出手，女帝握住了。胡玉綃把瓜子一丟：「好了，哭完了，該做正事了。」',
              '你一開口，兩個人一起瞪著你：「你閉嘴。」胡玉綃笑得從椅子上滑下來。等她們吵累了，再試一次。', win_flags=['yg2g_calm']),
        node('night', '晚上在龍安府的太妃宮被太妃關進同一間寢殿', '胡玉綃把三個人推進她的寢殿，門一關，在外面上了鎖：「天亮之前，誰都別想出來。」隔著門，她的聲音笑得很壞，「我就在外面聽。」燈下，母女倆看著彼此，又看著你。',
             TAIFEI, 'yg2g_calm', 'choice', hours='night', options=[
                 {'label': '「和解吧」', 'success': {
                     'text': '那一夜，母女倆第一次說了五年來沒說的話——說到後來，就不只是說話了。天亮時太后對女帝說：「從今以後，我不替哥哥說話了。」女帝靠在母親肩上：「……我知道。」門外的胡玉綃打了個哈欠：「終於。」',
                     'set_flags': ['yg2g_done', 'yg2g_reconciled'], 'effects': [aff(WENYI, 10, '兩代同堂'), aff(ZHAOHUA, 10, '兩代同堂'), aff(YUXIAO, 5, '看了一夜的熱鬧'),
                                                                                  mem('在太妃宮被太妃胡玉綃和太后、女帝母女關在同一間寢殿裡過了一夜；母女倆和解了，太后不再替宰相說話。', 3)],
                     'complete': True, 'time': {'until': 'morning'},
                     'scene': '寢殿裡，矜持的太后與強勢的女帝起初各守一邊，在主角的引導下才慢慢靠近：兩人輪流、又一起和主角親密，彼此看見對方從未示人的樣子；門外的太妃不時起鬨，天亮前母女倆相擁和解。'}},
                 {'label': '「各自的秘密就留著吧」', 'success': {
                     'text': '那一夜，三個人都很有默契地什麼都不提。天亮時，女帝先整好衣冠走了，太后在窗邊看著她的背影：「那孩子……還是像我。」門外的胡玉綃嘆了口氣：「沒意思。下次再關。」',
                     'set_flags': ['yg2g_done'], 'effects': [aff(WENYI, 8, '兩代同堂'), aff(ZHAOHUA, 8, '兩代同堂'), aff(YUXIAO, 5, '看了一夜的熱鬧'),
                                                            mem('在太妃宮被太妃胡玉綃和太后、女帝母女關在同一間寢殿裡過了一夜；三個人都很有默契地什麼都不提。', 3)],
                     'complete': True, 'time': {'until': 'morning'},
                     'scene': '寢殿裡三人默契地不說破：母女倆輪流和主角親密，像在比賽誰更讓主角失控，又在對方面前努力維持體面；門外的太妃聽得直笑，天亮前兩人各自整好衣冠，誰也不提這一夜。'}},
             ]),
    ], tags=['adult', 'non_virgin'], merit=10))

# ================= 胡家的團圓宴（成人向） =================
HU = [YUXIAO, JIU, SANNIANG]
STORIES.append(story(
    'yg_hu_reunion', 'B', '胡家的團圓宴',
    '胡三太奶附在三娘身上，說胡家三百年沒有團圓過，硬是把宮裡的狐、城裡的狐、屯裡的狐叫回青丘屯的仙堂吃團圓飯。三人發現，你是她們每個人的人。' + GROUP,
    {'kind': 'npc', 'npc': SANNIANG, 'min_level': 11, 'requires': {'flags': ['yayx_lover', 'yasn_lover', 'ychj_x_done']},
     'text': '腰鈴自己響了。三娘的眼神變得蒼老，太奶用她的手敲了敲桌子：「胡家三百年沒團圓過了。宮裡那個、瑔州港那個、加上這丫頭——你去把她們叫回來，我要吃一頓團圓飯。」她瞇起眼睛，「你跟她們每一個都很熟，不是嗎？」'},
    'yghu_started', [
        node('jiu', '到瑔州港請胡九娘回青丘屯', '胡九娘聽說太奶要吃團圓飯，扇子停在半空：「我十二歲離開青丘，就沒回去過。」她看著你，「……你也去？」',
             at_npc(JIU, 'quanzhou'), 'yghu_started', success={'text': '「好吧。」她把扇子一收，「總要回去一次。」', 'set_flags': ['yghu_jiu']}),
        check('yuxiao', '到龍安府的太妃宮請太妃出宮', '胡玉綃懶洋洋地躺在榻上：「太妃不能隨便出宮。再說，我回青丘做什麼？讓那些老狐狸指著我說我是狐狸精？」',
              TAIFEI, 'yghu_jiu', 'cha', 16, '你說九娘答應了，太奶也想她。她的尾巴停了一下，然後坐起來：「……備車。說是去城外的道觀上香。」',
              '她翻了個身：「不去。」也許換個說法再試一次。', win_flags=['yghu_all']),
        node('feast', '晚上在青丘屯的仙堂內堂吃團圓飯', '內堂的炕桌上擺滿了菜。太奶坐在三娘的身體裡居中，九娘和胡玉綃一左一右，你坐在對面。酒過三巡，九娘說了一句「我的人最近很忙」，胡玉綃說「我的人也是」，三娘自己醒過來一下，說「我的人——」三個人同時看向你。太奶拍著桌子大笑：「好，好！一家人，就該一起！」',
             {'where': 'special', 'special_map': INNER, 'x': 3, 'y': 3}, 'yghu_all', 'choice', hours='night', allies=HU, options=[
                 {'label': '「城裡的狐、屯裡的狐，都是一家」', 'success': {
                     'text': '那一夜，內堂的燈一直亮到天亮。早上，胡九娘說胡記每年要撥一筆錢給青丘屯修堂口；胡玉綃說她會在宮裡替屯子說話；三娘醒來，看著兩個姑姪，紅著眼睛笑了。太奶最後說了一句：「三百年，總算團圓了。」',
                     'set_flags': ['yghu_done', 'yghu_reconciled'], 'effects': all_aff(HU, 10, '胡家的團圓宴') + [mem('胡三太奶把宮裡、城裡、屯裡的三隻狐叫回青丘屯吃團圓飯；那一夜之後，城裡的狐和屯裡的狐和解了。', 3)],
                     'complete': True, 'time': {'until': 'morning'},
                     'scene': '炕上，三隻狐輪流又一起纏著主角：太妃嫵媚熟練、九娘笑裡藏刀地爭寵、三娘被太奶附身時放肆、醒來時害羞；三人的尾巴纏成一團，附身的老仙在一旁起鬨，天亮時四人擠在一床被裡。'}},
                 {'label': '「吃完這頓，各過各的」', 'success': {
                     'text': '那一夜很熱鬧，可是天亮之後，九娘回了瑔州港，胡玉綃回了宮，三娘留在屯裡。臨走前，九娘回頭看了仙堂一眼：「……明年再來。」太奶哼了一聲：「這還差不多。」',
                     'set_flags': ['yghu_done'], 'effects': all_aff(HU, 8, '胡家的團圓宴') + [mem('胡三太奶把宮裡、城裡、屯裡的三隻狐叫回青丘屯吃團圓飯；天亮之後各過各的，九娘說明年再來。', 3)],
                     'complete': True, 'time': {'until': 'morning'},
                     'scene': '團圓飯後的炕上，三隻狐比著看誰最能讓主角失控：太妃用尾巴、九娘用嘴、三娘用整個身子；附身的老仙看熱鬧看得直拍炕沿，天亮後三人各自整衣，誰都沒說下次，卻都看了主角一眼。'}},
             ]),
    ], tags=['adult', 'non_virgin'], merit=10))

# ================= 金與墨（成人向） =================
STORIES.append(story(
    'yg_gold_ink', 'B', '金與墨',
    '金墨盟的兩位領袖：金黃鱗的金玉棠主張立憲，墨鐵鱗的陸青禾主張共和。盟裡的路線之爭吵到半夜——兩人發現，她們吵的不只是政見。' + GROUP,
    {'kind': 'npc', 'npc': JIN, 'min_level': 11, 'requires': {'flags': ['ycjy_x_done', 'yclq_x_done']},
     'text': '金玉棠揉著太陽穴：「陸青禾從萍江來了，說要跟我把盟裡的路線吵清楚。已經吵了三天。」她看著你，「今晚在金玉行的頂樓，最後一次。你來——你是我們兩個都聽得進去的人。」'},
    'ygjm_started', [
        node('tavern', '到瑔州港的酒館找喝悶酒的陸青禾', '陸青禾一個人坐在酒館角落，面前擺著三個空酒罈：「她說我太急。她不知道萍江的織工等了多少年。」她看見你，愣了一下，然後把臉轉開，「……你也是她叫來的？」',
             cell('quanzhou', 'tavern'), 'ygjm_started', success={'text': '你陪她喝完了第四罈。她站起來：「走。去頂樓。今晚吵完。」', 'set_flags': ['ygjm_lu']}),
        check('debate', '晚上在瑔州港的金玉行頂樓聽兩人吵架', '頂樓的桌上攤著盟約。金玉棠說憲章能讓商人和皇帝都照規矩來，陸青禾說規矩是給有錢人訂的。吵到一半，陸青禾脫口而出：「妳就是想要他站在妳那邊！」金玉棠：「……妳不也是？」兩人同時安靜下來，看著你。',
              JINYU, 'ygjm_lu', 'cha', 16,
              '你說金墨盟不是一個人的盟：金黃鱗有船，墨鐵鱗有手，少了誰都開不了船。兩人看了對方很久。金玉棠先笑了：「……她說得比我們好聽。」陸青禾哼了一聲，嘴角卻翹了起來。',
              '你一開口，兩人一起轉過來：「你站哪邊？」你說不出來。她們又吵了起來——等她們吵累了，再試一次。', win_flags=['ygjm_heard'], hours='night', allies=[JIN, LU]),
        node('roof', '在瑔州港的金玉行頂樓和兩人「一起決定」', '盟約攤在桌上，燈快燒完了。金玉棠把酒杯推給陸青禾：「政見的事，明天再吵。」陸青禾接過來一口喝乾，看著你：「今晚的事，今晚決定。」兩個人一左一右，同時伸出了手。',
             JINYU, 'ygjm_heard', 'choice', hours='night', allies=[JIN, LU], options=[
                 {'label': '握住兩隻手', 'success': {
                     'text': '那一夜之後，金墨盟的路線之爭沒有吵完，可是吵法變了：吵完之後，兩人會一起去喝酒。陸青禾說：「她太慢。」金玉棠說：「她太急。」然後兩個人一起看著你：「你說呢？」',
                     'set_flags': ['ygjm_done', 'ygjm_united'], 'effects': [aff(JIN, 10, '金與墨'), aff(LU, 10, '金與墨'), mem('金墨盟的金玉棠與陸青禾吵了三天路線，最後在金玉行的頂樓和你一起決定了另一件事；從那之後，兩人的盟合得來了。', 3)],
                     'complete': True, 'time': {'until': 'morning'},
                     'scene': '金玉行的頂樓上，豐滿從容的金玉棠與直率火熱的陸青禾一起和主角親密：兩人連在床上也要爭誰主導，爭著爭著卻開始配合，一個慢一個急地把主角夾在中間；天亮時三人看著港口的船帆。'}},
                 {'label': '「妳們先分出勝負」', 'success': {
                     'text': '「好啊。」金玉棠挑眉。「求之不得。」陸青禾捲起袖子。那一夜的勝負沒有分出來，可是兩人都說自己贏了。天亮時她們還在較勁：誰先醒、誰先下樓、誰先跟你說早安。',
                     'set_flags': ['ygjm_done'], 'effects': [aff(JIN, 8, '金與墨'), aff(LU, 8, '金與墨'), mem('金墨盟的金玉棠與陸青禾在金玉行的頂樓比了一夜，誰也沒分出勝負，兩人都說自己贏了。', 3)],
                     'complete': True, 'time': {'until': 'morning'},
                     'scene': '金玉棠與陸青禾把主角當成較勁的戰場：輪流用自己的方式讓主角失控，比誰讓主角先到、誰讓主角叫得更大聲；一整夜誰也不肯認輸，最後三人累倒在一起，兩人還在互瞪。'}},
             ]),
    ], tags=['adult'], merit=10))


# ================= 地標的場景（成人向角色與多人任務解鎖） =================
def scene(title, desc, text, cast, flags, *, tags=('adult',), hours=2, affinity=3, effects=None, spot=None, spot_name=None):
    s = {'title': title, 'desc': desc, 'scene': text, 'tags': list(tags), 'requires': {'flags': flags}, 'cast': [{'npc': n} for n in cast]}
    s['hours'] = hours
    s['affinity'] = affinity
    s['effects'] = effects or [{'type': 'condition', 'target': 'pc', 'condition': 'relaxed', 'add': True}]
    if spot:
        s['spot'] = spot
        s['spot_name'] = spot_name
    return s


NV = ('adult', 'non_virgin')
SCENES = {
    'lm_yh_goulan': [
        scene('蕭鳳儀的後台', '散戲之後，第十三座勾欄的主人可以進蕭鳳儀的房間。', '散戲之後，{cast}把主角叫進後台自己的房間，關上門，用團扇遮著燈；勾欄之主慢條斯理地卸妝、解衣，照著她心情決定今晚誰主導。',
              [XIAO], ['yaxf_lover'], tags=NV),
    ],
    'lm_yh_shangqin': [
        scene('尚寢局的夜課', '溫如玉的課，只上給一個人。', '尚寢局只點一盞燈，{cast}解開高髻，說今晚的課由兩個人一起上：她照著宮規一條條來，總在第十二條之後忘了下一條，最後拋開規矩抱緊主角。',
              [RUYU], ['yawr_lover']),
    ],
    'lm_yh_taifei': [
        scene('太后的長夜', '替太后讀詩，然後陪她把長夜過完。', '主角在燈下替{cast}讀完一卷詩，太后摘下鳳冠、散開長髮，端莊地要主角留下；寡居多年的身子在主角手下一寸寸發燙，壓抑的聲音直到天亮才敢放開。',
              [WENYI], ['yawy_lover'], tags=NV, hours=4),
        scene('太妃的尾巴', '胡玉綃說，今天又想迷惑一個人。', '{cast}屏退宮女，三條白尾纏住主角的腰把主角拉上榻；嫵媚的太妃一邊說笑一邊慢條斯理地享用主角，總在最要緊的時候停下來問「還要不要」。',
              [YUXIAO], ['yayx_lover'], tags=NV),
        scene('兩代同堂', '太妃又把太后與女帝和你關進了同一間寢殿。', '{cast}：太妃又把三個人推進寢殿上了鎖，自己在門外聽；太后與女帝這對母女一邊維持體面、一邊輪流又一起和主角親密，門外的太妃不時起鬨。',
              [WENYI, ZHAOHUA, YUXIAO], ['yg2g_done'], tags=NV, hours=4, affinity=2),
    ],
    'lm_yh_bamboo_lake': [
        scene('抱著青蘿曬太陽', '竹湖邊的石頭上，青蘿在等你。', '{cast}坐在湖邊曬得暖暖的石頭上，看見主角就把尾巴纏過來；她照著話本學了新的東西要試，冰涼滑膩的身子被主角一點點暖熱，最後纏著主角不肯放。',
              [QINGLUO], ['yaql_lover']),
    ],
    'lm_yh_lingxu': [
        scene('雙修', '和玄霜從第一層修到第九層。', '靈虛觀的靜室裡，{cast}解開道袍的絛帶與主角赤身對坐，引著彼此的氣一層層往上修；清冷的觀主到了最後幾層總會失神，把心法念成主角的名字。',
              [XUAN], ['yaxs_lover'], hours=3),
    ],
    'lm_yh_xiantang': [
        scene('內堂的炕', '三娘把腰鈴掛在門上——或者沒掛。', '仙堂的內堂裡，{cast}灌了一口燒刀子撲上來；有時腰鈴掛在門上只有三娘自己，有時太奶也下來湊熱鬧，兩個人格輪流要主角，叫聲整個屯子都聽得見。',
              [SANNIANG], ['yasn_lover'], tags=NV, spot={'x': 3, 'y': 1}, spot_name='內堂的炕'),
        scene('胡家的團圓', '三隻狐又回到青丘屯，擠在同一床被裡。', '{cast}又一起回到青丘屯，在內堂的暖閣裡把主角圍在中間：三條、一條、兩條尾巴纏成一團，宮裡的狐、城裡的狐、屯裡的狐比著看誰最能讓主角失控。',
              [YUXIAO, JIU, SANNIANG], ['yghu_done'], tags=NV, hours=4, affinity=2, spot={'x': 1, 'y': 3}, spot_name='供桌後的暖閣'),
    ],
    'lm_yh_jinyu': [
        scene('金玉行的頂樓', '金玉棠與陸青禾又吵完了一輪路線。', '金玉行的頂樓上，{cast}吵完了今天的路線，一起把主角拉上床；兩人連在床上也要爭誰主導，爭著爭著又配合起來，一個慢一個急地把主角夾在中間。',
              [JIN, LU], ['ygjm_done'], hours=3),
    ],
}
# 北原（east_p8e.py 的雙帝的會盟）：金帳在 east_p7_people.py 寫地標時一起帶上
SCENES['lm_td_golden_tent'] = [
    scene('雙帝的夜宴', '昭華又微服來了金帳，說是來談互市的帳。', '金帳的內帳裡，{cast}又把怯薛都趕到一百步外：一個像批摺子一樣一道一道下令，一個像在雪原上追獵物一樣又急又重；兩人比著比著又配合起來，把主角夾在狼皮中間，天亮前才各自整好衣冠。',
          ['npc_yh_zhaohua', 'npc_td_ulantuya'], ['tdgse_done'], tags=NV, hours=4, affinity=2),
    scene('金帳的三人', '冬獵之後，天可汗又把察蘭和其其格留在了內帳。', '金帳的內帳裡，{cast}又一起留了下來：天可汗豪邁、察蘭不服輸、其其格慢條斯理，三人輪流又一起和主角糾纏在狼皮上，母女倆照樣較勁，國師搖著銅鈴說骨紋又亂了。',
          ['npc_td_ulantuya', 'npc_td_chalan', 'npc_td_qiqige'], ['tdg3_done'], tags=NV, hours=4, affinity=2),
]
# 北原的成人向角色（east_p8f.py）
SCENES['lm_td_post_station'] = [
    scene('馴馬師的遊戲', '烏日娜又在驛站的後院等你，手上拿著那條舊韁繩。', '驛站後院的馬廄裡，{cast}叼著草根等著，又要和主角比誰騎誰：有時她把主角按在乾草上，有時讓主角牽著那條舊韁繩，總要比到兩人都撐不住才肯認輸。',
          ['npc_td_urina'], ['tdur_lover'], hours=3),
    scene('春牧', '薩日朗在驛站的氈房裡等你，尾巴翹得高高的。', '驛站後面的氈房裡，{cast}紅著臉把主角拉進去：不管是不是春天，熱情的牧女都要得又直接又貪心，栗色的牝馬身一次次迎上來，最後滿足地抱著主角說起馬群的事。',
          ['npc_td_sarilang'], ['tdsr_lover'], hours=3),
]
SCENES['lm_td_south_court'] = [
    scene('可敦的寢帳', '燁婉寧在屏風後面彈琴，等你進她的寢帳。', '南院大帳的屏風後面，{cast}放下古琴，紅著臉牽著主角走進寢帳：端莊的可敦害羞又貪心地確認她想了三年的人馬族身體，最後伏在主角的馬背上輕輕撥著琴弦。',
          ['npc_td_wanning'], ['tdwn_lover']),
]
SCENES['lm_td_wild_horse'] = [
    {**scene('看燁婉寧和人馬族們', '在角落的毛氈上看著燁婉寧被雄性的人馬族們享用。', '主角在野馬帳角落的毛氈上，看著{cast}被一群高大的雄性人馬族輪流享用：嬌小的可敦一邊沉溺其中，一邊回頭看著主角；結束後她裹著斗篷爬回主角身邊，把一切都說給主角聽。',
             ['npc_td_wanning'], ['tdwn_club'], tags=('adult', 'ntr', 'non_virgin'), hours=3, spot={'x': 8, 'y': 1}, spot_name='角落的毛氈')},
    {**scene('和燁婉寧一起侍奉人馬族們', '和燁婉寧一起侍奉雄性的人馬族們（陰柔、中性體型的主角）。', '主角和{cast}一起跪在野馬帳那群高大的雄性人馬族中間，兩個人一起侍奉他們，燁婉寧握著主角的手不放。',
             ['npc_td_wanning'], ['tdwn_club'], tags=('adult', 'ntr', 'non_virgin'), hours=3, spot={'x': 4, 'y': 1}, spot_name='火塘邊'), 'pc_body': ['fem', 'andro']},
]


def write_scenes():
    path = 'data/world/landmarks.json'
    data = json.loads(open(path, encoding='utf-8').read())
    for lm in data['landmarks']:
        if lm['id'] in SCENES:
            lm['scenes'] = SCENES[lm['id']]
    open(path, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    write_stories(STORIES)
    write_scenes()
    print('多人任務', len(STORIES), '條；場景', sum(len(v) for v in SCENES.values()), '個')
