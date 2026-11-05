"""炎華北原的事件：旅途 7、城鎮 8（金帳王庭 4、鷹河榷場 4）、地下城 4（鳴鏑古戰場、白狼雪窟各 2）。

照炎華南域的事件（east_p4b.py 的 EVENTS，旅途 8、城鎮 14、地下城 6）的比例，北原只有兩座聚落、兩座地下城、陸路，所以少一點。
寫進 data/rules/travel_events.json 的 templates（同 id 先拿掉再加，可以重跑）。id 是 tde_ 開頭。
- 旅途：北原的路（官道、山道、荒野），regions 限 yanhua_north；「年輕騎手的挑戰」只給人馬族的主角（requires.pc_races）。
- 城鎮：locations 限聚落、cells 限設施（和南域一樣）。
- 地下城：dungeons 限那座地下城，layers 是淺層～底層（1～4）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p8g_events.py
"""

from east_story_io import write_events


def ok(text, *effects, **kw):
    o = {'text': text}
    if effects:
        o['effects'] = list(effects)
    o.update(kw)
    return o


def cond(c, add=True):
    return {'type': 'condition', 'target': 'pc', 'condition': c, 'add': add}


def hp(ratio):
    return {'type': 'hp', 'target': 'pc', 'ratio': ratio}


def xp(n):
    return {'type': 'xp', 'amount': n}


def money(n):
    return {'type': 'money', 'amount': n}


def item(name, qty=1):
    return {'type': 'item', 'name': name, 'qty': qty}


def memory(text):
    return {'type': 'memory', 'summary': text, 'importance': 1}


ROAD = {'modes': ['road', 'trail', 'wild'], 'regions': ['yanhua_north']}
JZ, YH = ['jinzhang'], ['yinghe']

EVENTS = [
    # ---- 旅途（北原的路）----
    {'id': 'tde_roadside_ovoo', 'tier': 'normal', 'kind': 'choice', 'category': 'omen', **ROAD, 'title': '路邊的敖包',
     'text': '草坡上立著一座石堆，插滿了樹枝與經幡，藍色的哈達在風裡獵獵作響。草原的規矩：路過的人要繞著它走三圈，添一塊石頭。',
     'options': [{'label': '繞三圈、添一塊石頭', 'success': ok('你照規矩繞了三圈，把一塊白石放在最上面。風好像小了一點。', cond('blessed'))},
                 {'label': '解下一條哈達帶走', 'check': {'attr': 'fai', 'dc': 15},
                  'success': ok('你解下一條褪色的舊哈達，又把自己的一條繫了上去。這樣換，長生天大概不會怪你。', cond('cheered')),
                  'fail': ok('你剛解下哈達，一陣怪風把你吹得滿臉是沙。接下來的路，你一直絆到石頭。', cond('punished'))},
                 {'label': '直接走過去', 'success': ok('你沒有停下來。身後的經幡響了很久。')}]},
    {'id': 'tde_steppe_sandstorm', 'tier': 'normal', 'kind': 'check', 'category': 'trouble', **ROAD, 'title': '草原的沙暴',
     'text': '天邊捲起一道黃褐色的牆，草被壓得貼在地上。春天的沙暴說來就來，風裡好像還有人在笑。',
     'check': {'attr': 'str', 'dc': 13}, 'success': ok('你背著風、壓低身子，在一塊大石後面躲到沙暴過去。', xp(20)),
     'fail': ok('沙暴把你掀翻在地，滿嘴是沙，背包也被刮走了一角。', hp(-0.15))},
    {'id': 'tde_relay_rider', 'tier': 'normal', 'kind': 'choice', 'category': 'social', **ROAD, 'title': '驛卒的馬',
     'text': '路邊坐著一個人馬族的驛卒，腰上掛著銅牌，前蹄腫得像饅頭。他說急信明天就要送到金帳，可是他跑不動了。',
     'options': [{'label': '替他看看蹄子', 'check': {'attr': 'int', 'dc': 12},
                  'success': ok('你挑出卡在蹄裡的一根鐵釘，用冷水敷了半天。驛卒試著走了幾步，咧嘴笑了，塞給你一點錢，說到了驛站報他的名字。', money(30), memory('在北原的路上替一個驛卒挑出蹄裡的鐵釘，讓他把急信送到了金帳。')),
                  'fail': ok('你折騰了半天也沒找到問題。驛卒嘆了口氣，一拐一拐地繼續上路。')},
                 {'label': '替他送一程信', 'success': ok('你把信揣在懷裡走了一段，交給下一個驛站的驛卒。對方看了看封口，說你是個老實人。', xp(15), cond('cheered'))},
                 {'label': '繼續趕路', 'success': ok('你走遠了。回頭看時，他還坐在那裡揉蹄子。')}]},
    {'id': 'tde_wolf_howl', 'tier': 'normal', 'kind': 'check', 'category': 'trouble', 'modes': ['trail', 'wild'], 'regions': ['yanhua_north'], 'title': '狼群的嚎聲',
     'text': '天黑之後，四面的草坡上都響起了狼嚎，一聲接一聲，越來越近。火堆的光照不到的地方，有一雙雙綠色的眼睛。',
     'check': {'attr': 'fai', 'dc': 12}, 'success': ok('你把火燒得更旺，一整夜沒有闔眼。天亮時，狼群已經跟著羊群走了。', xp(15)),
     'fail': ok('你打了一個盹，醒來時一隻狼正叼著你的乾糧袋。你追了半里路才搶回來一半。', cond('fed_light', False), hp(-0.05))},
    {'id': 'tde_herders_ger', 'tier': 'normal', 'kind': 'choice', 'category': 'social', **ROAD, 'title': '牧民的氈房',
     'text': '草原上一頂孤零零的氈房冒著炊煙，門口的女主人朝你招手：「客人，進來喝一碗奶茶！草原上，路過的人都是客。」',
     'options': [{'label': '進去喝一碗', 'success': ok('奶茶是鹹的，配著奶豆腐。男主人拉起了馬頭琴，你喝了一碗又一碗，臨走時女主人還往你懷裡塞了一塊風乾肉。', cond('cheered'), item('風乾肉'))},
                 {'label': '陪男主人喝馬奶酒', 'check': {'attr': 'str', 'dc': 12},
                  'success': ok('你一碗接一碗，男主人拍著大腿說你是好漢，非要送你一囊馬奶酒。', item('馬奶酒'), cond('tipsy')),
                  'fail': ok('第三碗之後你就不記得了。醒來時，你睡在氈房的角落，身上蓋著一張羊皮。', cond('tipsy'), cond('relaxed'))},
                 {'label': '謝過主人，繼續趕路', 'success': ok('女主人笑著揮揮手：「下次一定要進來！」')}]},
    {'id': 'tde_young_rider', 'tier': 'normal', 'kind': 'choice', 'category': 'opportunity', **ROAD, 'requires': {'pc_races': ['centaur']}, 'title': '年輕騎手的挑戰',
     'text': '幾個年輕的人馬族從坡上衝下來，繞著你跑了一圈：「看你的蹄子，是會跑的人！比一場，從這裡跑到那棵孤樹，輸的人請喝酒！」',
     'options': [{'label': '比一場', 'check': {'attr': 'dex', 'dc': 13},
                  'success': ok('你第一個衝過孤樹。年輕人們又笑又罵，湊了一袋錢給你，說今晚的酒他們請。', money(40), cond('cheered')),
                  'fail': ok('你輸了半個身位。年輕人們大笑著把你拖去最近的氈房，酒錢是你付的。', money(-20), cond('tipsy'))},
                 {'label': '「下次吧」', 'success': ok('他們吹了一聲口哨，揚起一片塵土跑遠了。')}]},
    {'id': 'tde_white_deer', 'tier': 'normal', 'kind': 'choice', 'category': 'omen', 'modes': ['trail', 'wild'], 'regions': ['yanhua_north'], 'title': '白鹿',
     'text': '晨霧裡站著一頭渾身雪白的鹿，角上掛著霜，看著你，一動也不動。草原上的人說，「蒼狼白鹿」的白鹿會把看見牠的人引進草原深處——有人回來了，有人沒有。',
     'options': [{'label': '跟著牠走', 'check': {'attr': 'fai', 'dc': 14},
                  'success': ok('你跟著白鹿走了半天，牠在一片你從沒見過的湖邊停下來，低頭喝水，然後消失在霧裡。你在湖邊坐了很久，心裡很靜。', xp(30), cond('blessed'), memory('在北原的晨霧裡跟著一頭白鹿走到一片沒見過的湖邊。')),
                  'fail': ok('白鹿越走越快，霧越來越濃。等你回過神，已經迷路了大半天，才找回原來的路。', cond('shaken'))},
                 {'label': '遠遠地行個禮', 'success': ok('白鹿點了點頭，轉身走進霧裡。', cond('cheered'))}]},
    # ---- 城鎮事件：金帳王庭 ----
    {'id': 'tde_naadam_challenge', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'opportunity', 'locations': JZ, 'cells': ['tavern', 'inn', 'gate'],
     'title': '摔跤手的挑戰', 'text': '一個拍著大腿、跳著鷹舞的年輕摔跤手攔住你：「外地人！敢不敢跟我比一跤？輸的人在那達慕場上學狼叫！」圍觀的人已經開始起鬨了。',
     'options': [{'label': '比一跤', 'check': {'attr': 'str', 'dc': 13},
                  'success': ok('你抓住他的腰帶一扭，他的膝蓋先著了地。圍觀的人大笑，摔跤手漲紅了臉，在那達慕場上學了三聲狼叫。', money(30), cond('cheered')),
                  'fail': ok('你被摔得滿身是土。在一片笑聲裡，你學了三聲狼叫。', hp(-0.1))},
                 {'label': '請他喝一碗', 'success': ok('摔跤手愣了一下，大笑著接過酒碗：「好！不打不相識，喝了就是朋友。」', cond('cheered'))}]},
    {'id': 'tde_wudugan_bone', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'omen', 'locations': JZ, 'cells': ['temple', 'informant'],
     'title': '老渥都干的羊骨', 'text': '一個滿臉皺紋的老巫婆坐在路邊燒羊肩胛骨，銅鈴叮噹作響。她抓住你的手：「外地人，讓我替你讀一塊骨。不要錢——只要你聽完。」',
     'options': [{'label': '讓她讀', 'check': {'attr': 'fai', 'dc': 13},
                  'success': ok('骨頭裂開，老巫婆看了很久：「你的路很長，可是你不會一個人走。」她把燒好的骨頭塞給你，說帶著它，狼不會靠近。', cond('blessed')),
                  'fail': ok('骨頭啪地碎成三塊。老巫婆臉色一變，什麼都不肯說，收起東西就走了。你心裡一直發毛。', cond('shaken'))},
                 {'label': '婉拒', 'success': ok('老巫婆聳聳肩，又去拉下一個路人。')}]},
    {'id': 'tde_captive_scholar', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'social', 'locations': JZ, 'cells': ['shop', 'gate', 'smithy'],
     'title': '戰俘營的書生', 'text': '王庭的戰俘營邊，一個化龍族的書生隔著木柵叫住你，墨鐵色的鱗片上全是泥：「你是從南邊來的吧？求你替我送一封信去龍安府——告訴我娘，我還活著。」',
     'options': [{'label': '收下信', 'success': ok('你把那封皺巴巴的信收進懷裡。書生隔著柵欄向你磕了三個頭。', cond('cheered'), memory('在金帳王庭的戰俘營邊收下一個化龍族書生的家信，答應替他送去龍安府。'))},
                 {'label': '問看守能不能贖他', 'check': {'attr': 'cha', 'dc': 14},
                  'success': ok('看守的怯薛打量你很久，說書生的贖金是兩百白鸛——可是看在你敢開口，算一百。書生走出柵欄的時候，哭得說不出話。', money(-100), xp(30), cond('cheered')),
                  'fail': ok('看守冷冷地說：「戰俘的事，問北院。」書生的眼神一下子暗了下去。')},
                 {'label': '裝作沒聽見', 'success': ok('你走遠了。身後的叫聲，很久都沒有停。')}]},
    {'id': 'tde_kumis_contest', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'social', 'locations': JZ, 'cells': ['tavern'],
     'title': '奶酒的酒量', 'text': '奶酒帳裡，一群牧民在比酒量：一碗接一碗的馬奶酒，誰先倒下誰付錢。有人朝你舉碗：「外地人，敢不敢？」',
     'options': [{'label': '加入', 'check': {'attr': 'str', 'dc': 13},
                  'success': ok('你喝倒了三個牧民，最後一個人扶著帳柱說你是長生天派來的。酒錢他們付，還湊了一點錢給你。', money(20), cond('tipsy')),
                  'fail': ok('你第五碗就倒了。醒來時錢袋輕了一點，頭很痛。', money(-10), cond('tipsy'))},
                 {'label': '在旁邊看', 'success': ok('你看他們喝到半夜，學會了三首祝酒歌。', cond('cheered'))}]},
    # ---- 城鎮事件：鷹河榷場 ----
    {'id': 'tde_mud_tea_bricks', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'commerce', 'locations': YH, 'cells': ['shop', 'tailor'],
     'title': '摻了土的茶磚', 'text': '茶馬市的攤販捧著一疊茶磚，說是龍安府的上等龍團，只要市價的一半。旁邊幾個牧民已經在掏錢了。',
     'options': [{'label': '掰開一塊看看', 'check': {'attr': 'int', 'dc': 13},
                  'success': ok('茶磚裡面一半是壓實的土。你當眾掰開，攤販臉色發青地跑了。牧民們圍過來道謝，塞給你兩條風乾肉。', item('風乾肉', 2), cond('cheered')),
                  'fail': ok('你看不出破綻，買了兩塊。回去一泡，水是黃的。', money(-30))},
                 {'label': '不買', 'success': ok('攤販又去招呼下一個客人了。')}]},
    {'id': 'tde_loose_falcon', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'opportunity', 'locations': YH, 'cells': ['gate', 'inn', 'tavern'],
     'title': '掙脫的海東青', 'text': '一隻白色的海東青拖著斷掉的腳繩，在榷場上空盤旋，鷹房的小鷹奴在底下急得快哭了：「牠是要進貢的！跑了我會被打死的！」',
     'options': [{'label': '幫忙引牠下來', 'check': {'attr': 'dex', 'dc': 13},
                  'success': ok('你拿一塊生肉舉得高高的，海東青盤了三圈，終於落在你的手臂上。小鷹奴抱著牠哭了，硬把一根換下來的尾羽塞給你。', item('海東青的羽'), money(20)),
                  'fail': ok('海東青俯衝下來，抓了你一爪又飛走了。好在最後牠自己落回了鷹房。', hp(-0.05))},
                 {'label': '幫著喊人', 'success': ok('鷹房的人趕來，吹了一聲口哨，海東青就乖乖地飛回去了。')}]},
    {'id': 'tde_black_market_horse', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'trouble', 'locations': YH, 'cells': ['informant', 'carver'],
     'title': '黑市的耳語', 'text': '一個裹著頭巾的人湊到你耳邊：「想賺快錢嗎？今晚有一批馬要過鷹河，往南走。只要你在渡口站一個時辰，說你什麼都沒看見。」',
     'options': [{'label': '去告訴監官', 'success': ok('斡勒聽完，算籌停在半空，然後笑眯眯地給了你一點錢：「這件事，你也什麼都沒看見。」', money(30))},
                 {'label': '答應站一個時辰', 'check': {'attr': 'cha', 'dc': 14},
                  'success': ok('你在渡口站了一個時辰，看著十幾匹戰馬被牽過河。頭巾人準時把錢塞給你。', money(60), cond('punished')),
                  'fail': ok('南院的巡卒剛好經過，你被當成同夥盤問了半夜，錢一分也沒拿到。', hp(-0.05), cond('shaken'))},
                 {'label': '當沒聽見', 'success': ok('頭巾人聳聳肩，消失在人群裡。')}]},
    {'id': 'tde_sheep_spirit', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'omen', 'locations': YH, 'cells': ['inn'],
     'title': '敲門的綿羊精', 'text': '半夜，客房的門被輕輕敲了三下。門外站著一個渾身捲毛的姑娘，頭上一對彎彎的小角，抱著膝蓋發抖：「外面有狼……能讓我躲一晚嗎？我很軟的，可以當枕頭。」',
     'options': [{'label': '讓她進來', 'success': ok('她蜷在你床邊，暖烘烘的，一身捲毛像最好的羊毛毯。天亮時她不見了，枕頭邊留著一撮雪白的羊毛，你睡得前所未有地好。', cond('relaxed'), cond('well_rested'))},
                 {'label': '「這裡不收羊」', 'success': ok('門外傳來一聲委屈的「咩」。第二天早上，你的鞋子裡塞滿了草。')}]},
    # ---- 地下城事件 ----
    {'id': 'tde_whistling_arrows', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['trap'], 'dungeons': ['mingdi_field'], 'layers': [1, 2, 3, 4],
     'title': '鳴鏑的嘯聲', 'text': '腳下的土一鬆，插在地上的斷箭忽然一齊嘯了起來——十年前那一仗的響箭，還在等著誰來衝鋒。',
     'options': [{'label': '撲倒在地', 'check': {'attr': 'dex', 'dc': 14}, 'success': ok('一陣看不見的箭雨從你頭頂掠過，嘯聲漸漸停了。'),
                  'fail': ok('一支生鏽的箭從土裡彈起來，擦過你的腿。', hp(-0.15))},
                 {'label': '站直了喊「收兵」', 'check': {'attr': 'fai', 'dc': 14},
                  'success': ok('你用盡力氣喊了一聲。嘯聲一支一支停了下來，像有人聽見了號令。古戰場安靜得可怕。', xp(30), cond('blessed')),
                  'fail': ok('嘯聲更響了，你的耳朵嗡嗡作響了好一陣子。', cond('shaken'))}]},
    {'id': 'tde_scratched_roll', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['chest'], 'dungeons': ['mingdi_field'], 'layers': [2, 3, 4],
     'title': '刮掉名字的名冊', 'text': '箱子裡是一卷牛皮的名冊，一行一行寫滿了戰士的名字——每一個都被刀刮掉了，只留下一道道白痕。名冊上壓著一枚銀扣。',
     'options': [{'label': '一行一行地念白痕', 'check': {'attr': 'fai', 'dc': 14},
                  'success': ok('你對著每一道白痕念一聲「有人記得你」。念到最後一行，古戰場的風忽然停了。', xp(30), cond('blessed')),
                  'fail': ok('念到一半，你的喉嚨像被什麼掐住了，怎麼也念不下去。', cond('shaken'))},
                 {'label': '只拿銀扣', 'success': ok('你把銀扣收進懷裡，名冊原樣捲好。背後好像有人在看你。', money(60), cond('shaken'))},
                 {'label': '把箱子蓋回去', 'success': ok('你蓋上箱子，朝它行了一個草原的禮。', cond('blessed'))}]},
    {'id': 'tde_ice_reflection', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['rest'], 'dungeons': ['whitewolf_cave'], 'layers': [1, 2, 3, 4],
     'title': '冰壁的倒影', 'text': '休息時，你看見安全房的冰壁裡映出一排影子：一群狼排成一行，從冰的深處慢慢走過，最前面那一頭是藍灰色的。',
     'options': [{'label': '靜靜地看', 'check': {'attr': 'fai', 'dc': 12},
                  'success': ok('藍灰色的狼回過頭，看了你一眼，然後消失在冰的深處。你醒來時，覺得腳步特別輕。', cond('honed')),
                  'fail': ok('你看著看著睡著了，夢裡一直在雪地裡跑，怎麼也跑不出去。', cond('shaken'))},
                 {'label': '叫醒同伴', 'success': ok('等同伴們揉著眼睛起來，冰壁裡只剩下你們自己的倒影。')}]},
    {'id': 'tde_frozen_hunter', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['gather', 'chest'], 'dungeons': ['whitewolf_cave'], 'layers': [1, 2, 3],
     'title': '凍住的獵人', 'text': '冰壁裡凍著一個人馬族的獵人，角弓還握在手裡，腰上掛著一張狼皮，臉上的表情像是在笑。不知道他在這裡多少年了。',
     'options': [{'label': '鑿出他的狼皮', 'check': {'attr': 'str', 'dc': 13},
                  'success': ok('你小心地鑿開冰，取下那張狼皮。冰裡的獵人好像點了點頭。', item('狼皮')),
                  'fail': ok('冰碴飛進你的眼睛，鑿子也崩了口。', hp(-0.05))},
                 {'label': '在冰前堆一座小敖包', 'success': ok('你撿了幾塊石頭，在冰壁前堆成一座小小的敖包。走遠了回頭看，冰裡的人好像閉上了眼睛。', cond('blessed'))}]},
]


if __name__ == '__main__':
    write_events(EVENTS)
    print('北原的事件', len(EVENTS), '個')
