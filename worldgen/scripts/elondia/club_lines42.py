"""特殊區域的延伸線（2026-11-09）：讓其他角色也走進黑檀之夜、榮譽洞，並在炎華南域補一個同類的地點「無面樓」。

一、西大陸的延伸任務（各一個 B 級任務，完成後在那個地標多兩個可以重複的場景）
- 地標的開放條件不變（黑檀之夜 aya_club、榮譽洞 wl_1_done）：延伸任務的接取條件也要它，
  所以只有已經接受過那種劇情、地標已經開放的玩家才接得到；任務另外標 ntr，設定關掉 NTR 時也不開放。
- 角色要先是戀人（各自角色線三的 *_lover），好感 40、Lv.12。
  - 黑檀之夜（索里耶爾）：貝爾維婭（belv_club）、艾蜜莉亞（ame_club）
  - 地下酒館的榮譽洞（阿爾貝納）：瑟蕾娜（ser_hole）、克拉拉（clara_hole）
- 任務點都在那座城的酒館（照阿雅的「黑檀之夜」）：地標在地下街裡，任務不另外要求先找到地下街。
- 場景照原本的規格：每個角色兩個（在一旁看著／陰柔、中性的主角一起，或「猜哪一個是你」），
  擺在內部地圖的另一格；和阿雅的場景共用地標的冷卻（每三天一次）。

二、炎華南域：蘇婉貞與無面樓（照阿雅、燁婉寧的結構）
- ① 牌坊下的寡婦（D）→ ② 無面宴（C；選項分成純愛與 NTR，NTR 的選項標 ntr）
  → ③ 純愛：牌坊之前（B，戀人 yasz_lover）／NTR：無面樓（B，標 ntr，完成 yasz_club）。
- yasz_club 開放龍安府瓦舍的「無面樓」（地標 lm_yh_faceless，內部 sm_yh_faceless，只在夜裡）：
  看戴著儺面的蘇婉貞（NTR）、和她一起入席（陰柔、中性的主角）、自己戴上儺面過一夜（不限體型）。
  純愛線走完不開放無面樓，改在御街夜市多一個戀人的場景。
- 旗標簡稱：yasz_ 蘇婉貞。

寫進：
- data/rules/stories.json：8 個任務（east_story_io.write_stories，同 id 就地換掉）
- data/world/npcs.json：蘇婉貞（同 id 先拿掉，接在最後）
- data/world/landmarks.json：無面樓（同 id 整筆換掉）；黑檀之夜、榮譽洞、無面樓、御街夜市的場景（同名的換掉，其他保留）
- data/world/special_maps.json：無面樓的內部
- data/worldbook/elondia.worldbook.json：「人物-炎华南域」條目加一行蘇婉貞（已經有就不加）

要排在 east_p3_places.py、east_p3_npcs.py、east_p4e_group.py、east_p7_people.py、east_p9_work.py、underworld39.py 之後
（它們會整筆重寫地標、南域的 NPC 或場景）。可以重跑。

在 repo 根目錄執行：python3 worldgen/scripts/elondia/club_lines42.py
"""

import json
import sys

sys.path.insert(0, 'worldgen/scripts/elondia')
from east_story_io import write_stories  # noqa: E402
from east_story_kit import aff, check, fight, lover, mem, node, story  # noqa: E402

BELV, AME, SER, CLARA, SU = 'npc_belvia', 'npc_amelia', 'npc_serena', 'npc_clara', 'npc_yh_su_wanzhen'
EBONY, HOLE, FACELESS, MARKET = 'lm_ebony_night', 'lm_honor_hole', 'lm_yh_faceless', 'lm_yh_night_market'
FACELESS_MAP = 'sm_yh_faceless'

NTR = ['adult', 'ntr', 'non_virgin']
WEST_REWARD = [{'type': 'money', 'amount': 400}, {'type': 'xp', 'amount': 1800}]


def tavern(loc):
    return {'where': 'cell', 'location': loc, 'cell': 'tavern'}


def cell(loc, c):
    return {'where': 'cell', 'location': loc, 'cell': c}


def answer(label, text, flag, npc, delta, why, memory):
    return {'label': label, 'success': {'text': text, 'set_flags': [flag], 'effects': [aff(npc, delta, why), mem(memory, 3)], 'complete': True}}


def club_story(id, title, summary, npc, lover_flag, place_flag, text, nodes):
    """西大陸的延伸任務：戀人＋地標已經開放，B 級，標 NTR"""
    return {
        'id': id, 'title': title, 'summary': summary, 'tags': NTR, 'rank': 'B', 'merit': 10,
        'start': {'kind': 'npc', 'npc': npc, 'min_affinity': 40, 'min_level': 12, 'requires': {'flags': [lover_flag, place_flag]}, 'text': text},
        'start_flags': [f'{id}_start'],
        'nodes': nodes,
        'rewards': WEST_REWARD,
    }


STORIES = []

# ================= 貝爾維婭：黑檀之夜 =================
STORIES.append(club_story(
    'belv_ebony_night', '自己選的夜',
    '貝爾維婭從水手那裡聽說了索里耶爾港區的「黑檀之夜」。那一年她是被拖去那種地方的；這一次，她說要自己走進去，自己定規矩，自己喊停——你在角落看著。（貝爾維婭・黑檀之夜）',
    BELV, 'belv_lover', 'aya_club',
    '貝爾維婭把一張皺巴巴的紙條拍在你胸口，上面歪歪扭扭地畫著一扇門和一塊黑色的檀木牌。「護送商隊去索里耶爾的時候，水手們說的。港區酒館的地下，叫『黑檀之夜』。」她別開臉，尾巴煩躁地甩來甩去，「那一年，我是被拖著去那種地方的。被誰碰、碰多久，都不是我說了算。」她深吸一口氣，抬起下巴看你，「這次我想自己走進去。自己挑、自己定規矩、自己喊停。……你坐在角落，看著。我喊停的時候，你就過來把我帶走。才不是怕，是要有人作證。」',
    [
        node('door', '晚上跟貝爾維婭到索里耶爾的酒館地下',
             '酒館地下的門開了一條縫，燻香和酒氣湧上來。阿雅坐在長椅那頭，看見你們，紅著臉點了點頭。貝爾維婭在門口停了一下，手指摸過腰側的舊烙印，然後大步走進那群高大黝黑的水手中間，把纏著繃帶的手往桌上一拍：「規矩我定。我說停，就停。」',
             tavern('soriel'), 'belv_ebony_night_start', hours='night', allies=[BELV],
             success={'text': '水手們先是一愣，接著大笑起來，有人舉起酒杯：「聽妳的，小貓。」那一夜，貝爾維婭一次也沒有喊停。天快亮的時候，有個醉醺醺的男人盯著她腰側的烙印看了很久，咧嘴一笑：「這個印子……我見過。札卡的貨？」',
                      'set_flags': ['belv_club_seen'],
                      'scene': '黑檀之夜的地下室裡，貝爾維婭自己挑了人、自己定了規矩：她把高大黝黑的水手按在長椅上，騎上去，咬著他們的肩膀，命令他們慢一點、再用力一點；尾巴高高翹著，一次又一次地回頭看角落裡的主角，像在確認有人看見——這一次，是她自己選的。'}),
        fight('brand', '在索里耶爾的酒館地下擋下認出烙印的人',
              '那個男人吹了一聲口哨，角落裡又站起一個人——都是烙印幫的漏網之魚，手上拎著鐵鍊。「札卡沒了，貨還在。」他們朝貝爾維婭走過去，「跟我們走，小貓。舊主人的規矩，妳的身體還記得吧？」',
              tavern('soriel'), 'belv_club_seen', [['brand_enforcer', 2]],
              '鐵鍊掉在地上。水手們把兩個人拖出後門扔進了港口，缺了一顆門牙的老船長朝貝爾維婭舉起酒杯：「在這裡，規矩是妳定的。」貝爾維婭沒有說話，只是抓著你的手，抓得很緊。',
              win_flags=['belv_club_safe'], urgent=True),
        node('answer', '回答貝爾維婭',
             '天亮了，你們坐在港口的石階上。貝爾維婭把下巴擱在膝蓋上，尾巴繞著你的腳踝：「……你都看見了。」她的聲音很小，「我一次也沒喊停。不是因為身體記得，是因為我想。」她瞪著海，耳朵一抖一抖的，「你、你說點什麼啊。」',
             tavern('soriel'), 'belv_club_safe', 'choice', allies=[BELV], options=[
                 answer('「妳選的，我都在角落看著」',
                        '貝爾維婭的耳朵抖了一下，用額頭撞你的肩膀：「……笨蛋。」她撇著嘴，尾巴卻纏上了你的手腕，「那下次也來。坐同一個位子，不准走開。」從那以後，她每次到索里耶爾，總要拉著你去一趟黑檀之夜——每一次，最後都回到你懷裡。',
                        'belv_club', BELV, 15, '看著她自己選',
                        '貝爾維婭自己走進了索里耶爾的黑檀之夜，自己定規矩，一次也沒喊停；你在角落看著，她說下次也要你坐同一個位子。'),
                 answer('「下次，換我站在妳旁邊」',
                        '「……站旁邊？」貝爾維婭瞪大了眼睛，臉一下子紅透了，「你、你是說要一起……」她咬著嘴唇想了很久，最後別開臉，「……隨便你。反正規矩是我定的。」她把手塞進你的手心，「先說好，我喊停的時候，連你也要停。」',
                        'belv_club', BELV, 12, '說要站在她旁邊',
                        '貝爾維婭自己走進了索里耶爾的黑檀之夜；你說下次要站在她旁邊，她紅著臉說規矩還是她定的。'),
             ]),
    ]))

# ================= 艾蜜莉亞：黑檀之夜 =================
STORIES.append(club_story(
    'amelia_ebony_night', '水手們的船歌',
    '海鷗亭的老闆娘艾蜜莉亞想知道，那個人在海上找到了什麼，讓他寧可換個名字也不回家。常來的船員說過，索里耶爾港區的酒館地下有一整屋子的水手。（艾蜜莉亞・黑檀之夜）',
    AME, 'ame_lover', 'aya_club',
    '打烊之後，艾蜜莉亞把最後一張椅子倒扣在桌上，卻沒有上樓。「常來的船員說，索里耶爾港區的酒館地下有一間俱樂部，叫『黑檀之夜』，一整屋子的水手。」她擦著早就乾淨的杯子，聲音很輕，「我守著海鷗亭，當了兩年的好妻子。那個人在海上找到了什麼，讓他寧可換個名字也不回家？……我想知道。」她放下杯子看著你，臉有點紅，眼神卻很清楚，「你陪我去。我想讓你看著——看著我不再當誰的好妻子。」',
    [
        node('song', '晚上陪艾蜜莉亞到索里耶爾的酒館地下',
             '地下室裡，一群高大黝黑的水手正敲著桌子唱船歌。艾蜜莉亞在門口站了一下，解開頭巾，走到他們中間，接著唱下一段——那是沿海渡口的漁婦送男人出海時唱的歌。整間地下室安靜了一瞬，接著爆出喝采。',
             tavern('soriel'), 'amelia_ebony_night_start', hours='night', allies=[AME],
             success={'text': '那一夜，她唱完了整首船歌，然後再也沒有回到你身邊的座位上——直到天快亮。她裹著一件水手的外套走回來，頭髮散了，掛婚戒的那條項鍊不知道丟在了哪裡，臉上卻是你從沒見過的表情。「原來是這樣。」她靠在你肩上，笑著，又像要哭，「海上的男人……原來是這樣的。」',
                      'set_flags': ['ame_club_seen'],
                      'scene': '黑檀之夜的地下室裡，艾蜜莉亞唱完了船歌，被高大黝黑的水手們抱上長桌：守了兩年的身子一被碰就軟了，她一個接一個地接納他們，喘息混著還沒唱完的歌詞，一邊哭一邊笑，時不時回頭找角落裡的主角——像在確認自己被看著，也被允許了。'}),
        fight('debt', '在索里耶爾的酒館地下擋下來討債的黑帆打手',
              '門被踹開，兩個黑帆的打手擠了進來：「找到了，海鷗亭的老闆娘。」帶頭的抖開一張借據，「白鷗號的船主欠黑帆的錢，總得有人還。我們看妳在這裡挺能還的。」水手們放下了酒杯。',
              tavern('soriel'), 'ame_club_seen', [['blacksail_enforcer', 2]],
              '打手們被水手們和你一起扔進了港口。老船長把那張借據撕了，丟進燈裡燒掉：「白鷗號的債，黑檀之夜不認。」他朝艾蜜莉亞眨眨眼，「下次再來唱，老闆娘。」',
              win_flags=['ame_club_safe'], urgent=True),
        node('answer', '回答艾蜜莉亞',
             '天亮了，你們坐在港口的石階上看船進港。艾蜜莉亞一直看著海，很久才開口：「我以為我會覺得對不起誰。」她把手放進你的手心，「可是我只覺得……輕鬆。」她轉頭看你，「你呢？看著我那樣，你還要我嗎？」',
             tavern('soriel'), 'ame_club_safe', 'choice', allies=[AME], options=[
                 answer('「妳就是妳，我要妳」',
                        '艾蜜莉亞愣了一下，然後把臉埋進你的懷裡，笑出了聲：「……我好像，終於不用再等誰了。」那之後，她每個月總有一兩個晚上關了海鷗亭的門，坐船去索里耶爾唱歌——回來的那天，二樓的燈總是為你亮到天亮。',
                        'ame_club', AME, 15, '看見了還要她',
                        '艾蜜莉亞在索里耶爾的黑檀之夜唱完了船歌，和水手們過了一夜；你說妳就是妳，她說終於不用再等誰了。'),
                 answer('「下次換首歌，我們一起唱」',
                        '「一起……？」她的臉紅了，又噗哧一聲笑出來，「那你得先學會詞。」她靠回你肩上，輕輕哼起那首船歌，「我教你。在黑檀之夜，在海鷗亭——在哪裡都好。」',
                        'ame_club', AME, 12, '說要和她一起唱',
                        '艾蜜莉亞在黑檀之夜唱完了船歌；你說下次一起唱，她說要先教你歌詞。'),
             ]),
    ]))

# ================= 瑟蕾娜：榮譽洞 =================
STORIES.append(club_story(
    'serena_honor_hole', '沒有價錢的夜',
    '贖身之後，瑟蕾娜第一次不知道自己想要什麼——在金蓮樓，每一個眼神都有價錢。她說阿爾貝納的酒館地下有一道牆，牆的兩邊誰也看不見誰。（瑟蕾娜・榮譽洞）',
    SER, 'ser_lover', 'wl_1_done',
    '瑟蕾娜替你倒了一杯茶，手停在半空中，很久沒有放下。「你知道嗎？在金蓮樓，我連笑幾分都是算好的。」她把茶壺放下，「一夜多少錢、哪個客人喜歡哪種眼神……我全都記得。可是我不知道，沒有人付錢、沒有人看見我的臉的時候，我想要什麼。」她抬起眼睛，「阿爾貝納的酒館地下有一道牆，牆的兩邊誰也看不見誰。金蓮樓的姊妹們笑著說過。」她的聲音很輕，「陪我去。我想知道，不是瑟蕾娜的我，是什麼樣子。」',
    [
        node('wall', '晚上陪瑟蕾娜到阿爾貝納的酒館地下',
             '酒館地下的隔間悶熱又昏暗，木板牆上開著一排圓洞。瑟蕾娜拔下蓮花髮簪交給你，拉起兜帽，走進牆的那一邊。你聽見她在牆後輕輕吸了一口氣——然後是第一個客人的腳步聲。',
             tavern('albena'), 'serena_honor_hole_start', hours='night', allies=[SER],
             success={'text': '那一夜，牆的另一邊換了很多人。你坐在角落，聽著牆後那個沒有名字的女人喘息、低笑，有一次甚至笑出了聲——那不是金蓮樓頭牌的笑，你從沒聽過她這樣笑。天快亮時，隔壁有人壓低了聲音說：「這種手藝……是金蓮樓出來的吧？」',
                      'set_flags': ['ser_hole_seen'],
                      'scene': '榮譽洞的牆後，瑟蕾娜拉著兜帽跪在圓洞前：沒有價錢、沒有臉、沒有名字，她第一次不用計算任何一個眼神，只照著自己的身體想要的，用嘴和手服侍牆那一邊一個接一個看不見臉的人，偶爾低低地笑出聲；主角坐在角落，握著她的蓮花髮簪聽了一整夜。'}),
        check('peek', '在阿爾貝納的酒館地下擋住想看牆後是誰的人',
              '隔壁的人是金蓮樓的老常客，阿爾貝納的一個布商。他繞到牆的這一邊，伸手就要掀隔間的布簾：「讓我看一眼，就一眼——要真是她，我出雙倍。」',
              tavern('albena'), 'ser_hole_seen', 'cha', 14,
              '你擋在布簾前，笑著跟他講這裡的規矩：牆後的人沒有名字，掀簾子的人會被酒館老闆扔進運河。他悻悻地走了，臨走前還回頭看了一眼。布簾後面，瑟蕾娜輕輕笑了一聲。',
              '他推開你的手，你只好擋在布簾前繼續和他周旋。再試一次。', win_flags=['ser_hole_safe'], hours='night'),
        node('answer', '回答瑟蕾娜',
             '天亮了，阿爾貝納的運河上飄著薄霧。瑟蕾娜從你手上拿回蓮花髮簪，插回髮間，又變回了那個從容的瑟蕾娜——只有耳根還紅著。「我笑了。」她說，像在說一件不可思議的事，「沒有人付錢，我卻笑了。」她看著你，「你都聽見了。現在換你說——你還要我嗎？還是，你要的只是那個頭牌？」',
             tavern('albena'), 'ser_hole_safe', 'choice', allies=[SER], options=[
                 answer('「我要的是會那樣笑的妳」',
                        '瑟蕾娜看了你很久，然後笑了——不是算好的那種。「那我以後……偶爾還想去那道牆後面。」她挽住你的手臂，「每一次，你都替我拿著髮簪。好嗎？」',
                        'ser_hole', SER, 15, '要會那樣笑的她',
                        '瑟蕾娜在阿爾貝納的榮譽洞當了一夜沒有名字的女人，第一次不是為了錢而笑；你說要的就是會那樣笑的她。'),
                 answer('「下次，牆的那一邊也有我」',
                        '「……你是說，在那麼多人裡面，讓我猜哪一個是你？」瑟蕾娜的眼睛亮了起來，像在看一齣新戲，「好啊。我猜得出來的。」她湊到你耳邊，「猜錯了，就罰我。」',
                        'ser_hole', SER, 12, '要她猜哪一個是你',
                        '瑟蕾娜在榮譽洞當了一夜沒有名字的女人；你說下次牆的那一邊也有你，她說一定猜得出來。'),
             ]),
    ]))

# ================= 克拉拉：榮譽洞 =================
STORIES.append(club_story(
    'clara_honor_hole', '第十三卷的取材',
    '紫丁香的第十三卷要寫一道牆：牆的兩邊誰也看不見誰。克拉拉說這一次的取材，她要自己站到牆後面——由你在外面記筆記。（克拉拉・榮譽洞）',
    CLARA, 'clara_lover', 'wl_1_done',
    '克拉拉把一份新的大綱推到你面前，封面上寫著《紫丁香・第十三卷：牆》。「阿爾貝納的酒館地下有一道牆，」她推了推眼鏡，臉紅得很專業，「牆上開著洞，兩邊誰也看不見誰。我寫了三遍，三遍都不對。」她把一本空白的筆記本和一支筆交到你手上，「所以這次的取材……我要自己站到牆後面。你在外面，替我記下我的反應。每一個。」她頓了一下，聲音小了下去，「……你會讀到很多我沒寫過的東西。你，可以嗎？」',
    [
        node('research', '晚上陪克拉拉到阿爾貝納的酒館地下取材',
             '榮譽洞的隔間又悶又暗。克拉拉把眼鏡放進你的口袋，深吸一口氣，走進牆的那一邊。你翻開筆記本，聽見木板牆後傳來她小聲的、像在默念稿子的聲音：「第一位……」',
             tavern('albena'), 'clara_honor_hole_start', hours='night', allies=[CLARA],
             success={'text': '筆記本寫滿了二十七頁。你記下了她的每一次停頓、每一聲壓不住的驚呼，還有她第一次忘了數到第幾位的時候。天快亮時她從牆後出來，頭髮亂了，第一句話卻是：「筆記給我看。」——就在這時，隔間外有人在問：「紫丁香是不是在這裡？」',
                      'set_flags': ['clara_hole_seen'],
                      'scene': '榮譽洞的牆後，克拉拉摘了眼鏡跪在圓洞前，替牆那一邊一個接一個看不見臉的人服務：她一開始還小聲地默數、默念句子，後來忘了數，忘了念，只剩壓不住的喘息與驚呼；主角在牆的這一邊，把她每一個反應寫進筆記本，寫滿了二十七頁。'}),
        fight('pirates', '在阿爾貝納的酒館地下擋下來搶原稿的盜印商',
              '三個金秤商行的傭兵堵住了隔間的門——阿爾貝納賣的紫丁香盜印本，都是金秤商行印的。「聽說紫丁香在這裡取材？」帶頭的盯著你手上的筆記本，「第十三卷的原稿，我們先買了。」',
              tavern('albena'), 'clara_hole_seen', [['goldscale_mercenary', 3]],
              '傭兵們被酒館的老闆和你一起扔了出去。克拉拉從你手上搶過筆記本抱在胸前，瞪著門口：「……盜印的人，連取材都要搶。」她的手在發抖，嘴角卻在笑，「這一段我要寫進後記。」',
              win_flags=['clara_hole_safe'], urgent=True),
        node('answer', '回答克拉拉',
             '天亮了，克拉拉坐在酒館的角落，一頁一頁地翻著你的筆記，耳根越來越紅。翻到最後一頁，她停住了：那一頁你只寫了一行字。她把筆記本闔上，抱在胸前，小聲地問：「你寫這些的時候……在想什麼？讀完了，你還要我嗎？」',
             tavern('albena'), 'clara_hole_safe', 'choice', allies=[CLARA], options=[
                 answer('「我在想，下一卷要怎麼寫我們」',
                        '克拉拉愣了一下，然後把臉埋進筆記本裡笑了：「……又是好老套的台詞。」她把筆記本塞回你手裡，「那這本你留著。第十三卷出版的時候，只有你知道哪一句是真的。」',
                        'clara_hole', CLARA, 15, '讀完了還要她',
                        '克拉拉在阿爾貝納的榮譽洞替紫丁香的第十三卷取材，你替她記了二十七頁的筆記；你說在想下一卷要怎麼寫你們。'),
                 answer('「下一次，牆的那一邊換我」',
                        '「……這、這是新的取材提案嗎？」克拉拉的臉紅到了脖子，卻立刻翻開筆記本的新一頁，寫下日期，「那……我要閉著眼睛猜，哪一個是你。猜不到的話，」她咬著筆桿，「就要重新取材。」',
                        'clara_hole', CLARA, 12, '說下次換你在牆那一邊',
                        '克拉拉在榮譽洞替第十三卷取材；你說下次牆的那一邊換你，她說要閉著眼睛猜哪一個是你。'),
             ]),
    ]))

# ================= 蘇婉貞：牌坊與儺面（炎華南域） =================
FACELESS_DESC = '瓦舍深處一座不掛招牌的小樓，門口掛著一盞白紗燈'
STORIES.append(story(
    'yasz_widow', 'D', '牌坊下的寡婦',
    '龍安府蘇御史家的寡婦蘇婉貞，守節三年，禮部就要替她立一座貞節牌坊。那天夜裡，你在御街夜市撿到了她掉落的一張儺面。（蘇婉貞・一）',
    {'kind': 'npc', 'npc': SU,
     'text': '御街夜市的人潮裡，一個穿著素白孝服的年輕寡婦被擠得撞上了你，懷裡掉出一樣東西——一張白底朱紋的儺面，笑得很放肆。她的臉一下子白了，蹲下去撿，手抖得撿了兩次才撿起來。「這、這是替婆家的姪兒買的……」她把面具藏進袖子裡，聲音細得快聽不見，又飛快地往人群後面看了一眼，「……抱歉。後面有人跟著我。可以請您……送我一段路嗎？」'},
    'yasz_1_started', [
        fight('tail', '晚上在御街夜市擋下跟蹤蘇婉貞的人',
              '兩個短打扮的漢子一路跟在後面，見你們拐進巷口，乾脆攔了上來：「蘇家少夫人，這麼晚了要去哪兒？御史大人吩咐過，少夫人夜裡出門，要我們『陪著』。」其中一個伸手就去抓她的袖子——藏著面具的那一隻。',
              cell('longan', MARKET), 'yasz_1_started', [['yh_street_thug', 2]],
              '兩個漢子罵罵咧咧地跑了。蘇婉貞靠在牆上大口喘氣，袖子裡的面具硌得她手腕發紅，她卻一直沒有鬆手。',
              win_flags=['yasz_safe'], hours='night', allies=[SU]),
        node('promise', '晚上在御街夜市聽蘇婉貞說實話',
             '「那不是替姪兒買的。」蘇婉貞低著頭，把那張儺面從袖子裡拿出來，捧在手上，「瓦舍深處有一座不掛招牌的樓，叫『無面樓』。進門的人都要戴上面具，誰也不問誰的名字。」她的聲音在發抖，「我去過一次。只有一次。戴上它的時候……我不是蘇家的寡婦，不是要立牌坊的人，我是誰都可以。」她抬起眼睛，眼眶紅了，「禮部的人下個月就要來看牌坊的地了。您……會說出去嗎？」',
             cell('longan', MARKET), 'yasz_safe', 'choice', hours='night', allies=[SU], options=[
                 {'label': '「我不會說出去」', 'success': {
                     'text': '蘇婉貞鬆了一口氣，把面具收回袖子裡，又抬頭看你，第一次笑了——只笑了一半。「那……下次在夜市看見我，請您當作不認識。」她走了幾步，又回過頭，「……或者，認識也可以。」',
                     'set_flags': ['yasz_1_done'], 'effects': [aff(SU, 8, '替她保守秘密'), mem('在御街夜市替蘇御史家的寡婦蘇婉貞擋下跟蹤的人；她說了無面樓的秘密，你答應不說出去。')], 'complete': True}},
                 {'label': '「戴上它的時候，妳快樂嗎」', 'success': {
                     'text': '她愣住了，像是從來沒有人問過她這個問題。很久之後，她輕輕點了點頭，又搖了搖頭：「……我不知道。我只知道，摘下來的時候，我好想哭。」她把面具貼在胸口，「謝謝您問我。」',
                     'set_flags': ['yasz_1_done'], 'effects': [aff(SU, 10, '問她快不快樂'), mem('問蘇婉貞戴上儺面的時候快不快樂；她說不知道，只知道摘下來的時候好想哭。')], 'complete': True}},
             ]),
    ], tags=['adult']))

STORIES.append(story(
    'yasz_banquet', 'C', '無面宴',
    '禮部的人要來看牌坊的地了。蘇婉貞說，她想在那之前再去一次無面樓——最後一次。她求你陪她去，替她甩掉婆家的眼線。（蘇婉貞・二）',
    {'kind': 'npc', 'npc': SU, 'min_affinity': 20, 'requires': {'flags': ['yasz_1_done']},
     'text': '蘇婉貞趁著上香出了門，在瓦舍外的柳樹下等你。她換下了孝服，穿著一件不起眼的灰色褙子，袖子裡鼓鼓的，是那張儺面。「禮部的人下個月就來了。牌坊一立，我就一輩子是蘇家的節婦。」她抓著你的袖子，指節發白，「我想再去一次無面樓。最後一次——我保證。公公的人一直盯著我，我一個人走不過瓦舍。您……能陪我嗎？」'},
    'yasz_2_started', [
        check('sneak', '晚上帶蘇婉貞穿過瓦舍甩掉眼線',
              '瓦舍的勾欄剛散戲，人潮湧出來，燈籠照得像白天。御史府的兩個眼線就站在勾欄門口，一個一個看著過路女人的臉。你得帶著她混進人群，從勾欄的後台繞出去。',
              cell('longan', 'lm_yh_goulan'), 'yasz_2_started', 'dex', 13,
              '你們貼著後台的布景溜了出去，戲子們忙著卸妝，誰也沒多看一眼。蘇婉貞的手一直在你手心裡，濕濕的，在發抖。',
              '眼線往這邊看了一眼，你只好拉著她退回人群。等一下再試。', win_flags=['yasz_escaped'], hours='night', allies=[SU]),
        node('door', '晚上在無面樓的門口回答蘇婉貞',
             f'{FACELESS_DESC}，沒有招牌。門口的老嫗遞來一張空白的儺面，等著。蘇婉貞捧著自己那張白底朱紋的面具，在燈下站了很久，沒有戴上。「我想進去。」她轉頭看你，聲音很輕，「可是……我也想知道，有沒有一個人，是我不用戴面具也能面對的。」',
             cell('longan', 'lm_yh_goulan'), 'yasz_escaped', 'choice', hours='night', allies=[SU], options=[
                 {'label': '「把面具摘下來，看著我」', 'success': {
                     'text': '你把那張儺面從她手上拿下來，還給門口的老嫗。蘇婉貞愣愣地看著你，像第一次被人看見自己的臉。你們沒有進那座樓。回去的路上，她在一條沒有燈的小巷裡停下來，踮起腳尖吻了你——素白的臉紅得像那張面具上的朱紋。',
                     'set_flags': ['yasz_2_done', 'yasz_pc'], 'effects': [aff(SU, 12, '讓她不用戴面具'), mem('在無面樓的門口，你把蘇婉貞的儺面還給了老嫗；回去的路上，她在沒有燈的小巷裡吻了你。', 3)],
                     'complete': True,
                     'scene': '龍安府沒有燈的小巷裡，蘇婉貞第一次不戴面具地吻了主角：守了三年節的寡婦先是生澀地發抖，後來越吻越急，顫抖的手解開了自己灰色褙子的衣帶，把主角拉進巷底的陰影裡；她咬著主角的肩膀不敢出聲，天青的細鱗從鎖骨一路紅到胸口。'}},
                 {'label': '「戴上吧，我在樓下等妳」', 'tags': ['ntr'], 'success': {
                     'text': '她看了你很久，然後戴上那張白底朱紋的儺面，推開了門。樓裡的笑聲、絲竹聲和壓低的喘息湧出來，又被關在門後。你在樓下的燈籠下等到天亮。她出來的時候摘下了面具，髮髻散了，素白的頸子上留著不知道是誰的牙印——可是她在笑，那張臉笑得比面具還放肆。',
                     'set_flags': ['yasz_2_done', 'yasz_ntr'], 'effects': [aff(SU, 10, '在樓下等她'), mem('你在無面樓的樓下等蘇婉貞到天亮；她摘下面具出來的時候，笑得比面具還放肆。', 3)],
                     'complete': True, 'time': {'until': 'morning'}}},
             ]),
    ], tags=['adult']))

STORIES.append(story(
    'yasz_arch', 'B', '牌坊之前',
    '禮部的人來了，蘇家門前搭起了牌坊的竹架。蘇婉貞要在牌坊立起來之前，把一句話說給所有人聽。（蘇婉貞・三）',
    {'kind': 'npc', 'npc': SU, 'min_affinity': 40, 'requires': {'flags': ['yasz_pc']},
     'text': '蘇家門前的空地上已經搭起了牌坊的竹架，禮部的官員明天就要來題字。蘇婉貞在夜市的茶坊裡等你，換回了孝服，手腕上的念珠卻不見了。「我把念珠還給了亡夫的牌位。」她看著你，眼神第一次那麼穩，「明天禮部的人來的時候，我要對他們說：這座牌坊，蘇婉貞不要。」她在桌子底下握住你的手，「公公不會讓我說出口的。您……願意站在我旁邊嗎？」'},
    'yasz_3_started', [
        fight('hired', '晚上在龍安府擋下御史府派來的人',
              '你送她回蘇家的路上，巷口堵著幾個蒙面的刀客。帶頭的壓低了聲音：「少夫人，御史大人說了，牌坊立起來之前，請您在家裡好好『養病』。」他們身後停著一頂沒有窗的小轎。',
              {'where': 'settlement', 'location': 'longan'}, 'yasz_3_started', [['yh_blade_for_hire', 3]],
              '刀客們丟下轎子跑了。蘇婉貞看著那頂沒有窗的小轎，臉色發白，卻一步也沒有退：「……他要把我關起來，一直關到牌坊立好。」她深吸一口氣，「明天，我一定要說。」',
              win_flags=['yasz_stood'], hours='night', allies=[SU], urgent=True),
        node('arch', '白天在龍安府陪蘇婉貞面對禮部的官員',
             '牌坊的竹架下圍滿了看熱鬧的街坊，禮部的官員捧著題字的匾額，蘇御史站在一旁，臉色鐵青。蘇婉貞從人群裡走出來，拔下頭上的素銀簪，跪下，又站起來：「這座牌坊，蘇婉貞不要。」人群一下子炸開了。蘇御史的手在發抖，指著你：「是你——」',
             {'where': 'settlement', 'location': 'longan'}, 'yasz_stood', hours='day', allies=[SU],
             success={'text': '禮部的官員看了看蘇御史，又看了看站在你身邊、一步也不肯退的蘇婉貞，慢慢收起了匾額：「節婦自己不要的牌坊，禮部立不起來。」他走之前看了你一眼，搖搖頭，又像在笑。當天晚上，竹架就拆了；蘇婉貞從蘇家搬了出來，在瓦舍邊上租了一間小院。',
                      'set_flags': ['yasz_freed']}),
        lover('yasz', SU, '晚上到龍安府蘇婉貞的小院',
              '小院裡只點著一盞燈。蘇婉貞換下了穿了三年的孝服，穿著一件淺青的衫子，頭髮放了下來，看見你就紅了臉。「我以為我會怕。」她說，「可是我只想著一件事——以後，我不用再戴任何一張面具了。」她走到你面前，第一次主動解開了自己的衣帶。',
              {'where': 'settlement', 'location': 'longan'}, 'yasz_freed', [
                  ('「今晚，妳想怎樣都可以」', '她紅著臉點點頭，牽著你走進裡屋。天亮的時候，她靠在你懷裡，手指在你胸口畫著什麼，畫完了才小聲說：「是那張面具。我把它畫在你身上，就不用再戴了。」',
                   '蘇婉貞在禮部的官員面前說不要那座牌坊，搬出了蘇家；那一夜她在自己的小院裡，第一次不用戴任何面具。',
                   '瓦舍邊的小院裡，守了三年節的蘇婉貞第一次為自己解開衣帶：她先是害羞地遮著臉，被主角輕輕拉開手之後就再也不躲了，生澀又貪心地迎上去，天青的細鱗從鎖骨一路紅到胸口；最後她伏在主角胸前，說她終於知道不戴面具是什麼感覺。'),
                  ('把她的手拉開，看著她的臉', '她想遮住臉，你把她的手輕輕拉開。她看著你，眼淚掉了下來，又笑了：「……原來被人看著，是這種感覺。」那一夜，她一直沒有閉上眼睛。',
                   '蘇婉貞不要那座牌坊，搬出了蘇家；那一夜你拉開她遮著臉的手，她說原來被人看著是這種感覺。',
                   '小院的燈下，主角拉開蘇婉貞遮著臉的手，看著她的臉一寸寸地愛撫她：寡婦豐腴白皙的身子在主角手下發燙，她一直睜著眼睛看主角，喘息越來越亂，最後哭著笑出聲，雙腿纏住主角不肯放。'),
              ], allies=[SU], hours='night'),
    ], tags=['adult', 'non_virgin']))

STORIES.append(story(
    'yasz_faceless', 'B', '無面樓',
    '瓦舍深處那座不掛招牌的小樓，蘇婉貞已經去了很多次。她要你陪她進去一次，看她戴著面具的樣子——然後問你，還要不要她。（蘇婉貞・三）',
    {'kind': 'npc', 'npc': SU, 'min_affinity': 30, 'requires': {'flags': ['yasz_ntr']},
     'text': '蘇婉貞把兩張儺面放在你面前：一張是她那張白底朱紋的，一張是新的，黑底金紋。「無面樓的老嫗說，帶人來，要先替他挑一張面具。」她的臉紅透了，眼神卻很坦然，「我想讓你看看我在那裡的樣子。不是在樓下等，是進去，坐在二樓的欄杆邊看。」她把黑底金紋的那張推給你，「然後，我想聽你說，你還要不要我。」'},
    'yasz_club_start', [
        node('banquet', '晚上戴上儺面，跟蘇婉貞走進瓦舍的無面樓',
             '無面樓裡點著一盞盞紗燈，帷幔隔出一間間雅座，戴著儺面的男男女女在燈影裡交纏，誰也不說自己的名字。蘇婉貞戴上那張白底朱紋的面具，回頭看了你一眼，走進了廳堂正中。你坐在二樓的欄杆邊，看了一整夜。',
             cell('longan', 'tavern'), 'yasz_club_start', hours='night', allies=[SU],
             success={'text': '天快亮的時候，樓下突然一陣騷動——有人在門口喊：「御史臺查案！樓裡的人都把面具摘下來！」',
                      'set_flags': ['yasz_club_seen'],
                      'scene': '無面樓的廳堂裡，戴著白底朱紋儺面的蘇婉貞被一群戴著面具的男人圍住：沒有名字、沒有牌坊，守了三年節的身子被一個接一個地享用，她放肆地叫出聲，又一次次抬頭看二樓欄杆邊的主角；面具底下流著淚，嘴角卻在笑。天亮前她裹著披帛爬上二樓，摘下面具，把一切都說給主角聽。'}),
        fight('raid', '天亮時在無面樓擋下來查案的人',
              '兩個披甲的禁軍踹開了門，身後跟著一個提著燈籠的老僕——是蘇御史府上的管家。「少夫人一定在這裡。」管家舉著燈籠，一張一張地照過那些面具，「御史大人說了，找到了，就當場摘下來。」',
              cell('longan', 'tavern'), 'yasz_club_seen', [['yh_imperial_guard', 2]],
              '禁軍被樓裡的客人們推推搡搡地擠出了門，管家的燈籠掉在地上滅了。門口的老嫗慢吞吞地關上門：「無面樓裡，沒有人有臉。」她把那張黑底金紋的面具塞回你手裡，「下次也來。」',
              win_flags=['yasz_club_safe'], urgent=True),
        node('answer', '在無面樓的二樓回答蘇婉貞',
             '蘇婉貞坐在你身邊，披帛裹著肩膀，面具放在膝上，臉上還有淚痕。她沒有道歉，只是看著你：「這就是我。白天是要立牌坊的蘇家寡婦，夜裡是誰都可以的女人。」她握住你的手，「你看見了。你還要不要我？」',
             cell('longan', 'tavern'), 'yasz_club_safe', 'choice', allies=[SU], options=[
                 answer('「妳還是妳，我要妳」',
                        '她愣了一下，然後把臉埋進你的懷裡，笑著哭了出來：「你是唯一一個……看過我兩張臉，還要我的人。」從那天起，她白天照樣替婆家抄經，夜裡常常出現在無面樓——每一次，她都會先在二樓的欄杆邊找你。',
                        'yasz_club', SU, 15, '看見了還要她',
                        '蘇婉貞帶你去了瓦舍的無面樓，讓你看她戴著儺面的樣子；你說妳還是妳，我要妳。'),
                 answer('讓她自己決定要不要回來',
                        '「我不會替妳決定。」她看了你很久，輕輕點頭：「那我會回來的——每一次。」她說到做到：夜裡她常常在無面樓，天亮之前，一定回到你身邊。',
                        'yasz_club', SU, 12, '讓她自己決定',
                        '蘇婉貞帶你去了無面樓；你讓她自己決定要不要回來，她說每一次都會回來。'),
             ]),
    ], tags=NTR))


# ================= 地標的場景 =================
def scene(title, desc, text, cast, flags, *, tags=NTR, hours=3, affinity=3, spot=None, spot_name=None, pc_body=None, money_cc=None):
    s = {'title': title, 'desc': desc, 'scene': text, 'tags': list(tags)}
    if flags:
        s['requires'] = {'flags': flags}
    if pc_body:
        s['pc_body'] = pc_body
    if cast:
        s['cast'] = [{'npc': n} for n in cast]
    s['hours'] = hours
    if money_cc:
        s['money_cc'] = money_cc
    if affinity and cast:
        s['affinity'] = affinity
    s['effects'] = [{'type': 'condition', 'target': 'pc', 'condition': 'relaxed', 'add': True}]
    if spot:
        s['spot'] = {'x': spot[0], 'y': spot[1]}
        s['spot_name'] = spot_name
    return s


JOIN = ['adult', 'ntr', 'non_virgin', 'male_partner']
SOFT = ['fem', 'andro']

# 內部的格子：黑檀之夜（11×6，阿雅在 (4,2)，場景在 (8,1)、(4,1)）；榮譽洞（9×5，左半是服務的一側，右半是被服務的一側）
SCENES = {
    EBONY: [
        scene('看貝爾維婭定規矩', '在吧台邊看貝爾維婭自己挑人、自己定規矩。',
              '主角坐在黑檀之夜的吧台邊，看著{cast}自己挑了今晚的水手：她把高大黝黑的男人按在長椅上、騎上去、咬著他們的肩膀發號施令，一次又一次地回頭確認主角還在看；天亮前她自己喊了停，鑽回主角懷裡。',
              [BELV], ['belv_club'], spot=(8, 2), spot_name='吧台邊的高腳椅'),
        scene('站在貝爾維婭旁邊', '照貝爾維婭的規矩，和她一起侍奉水手們（陰柔、中性體型的主角）。',
              '主角站在{cast}旁邊，一起被黑檀之夜那群高大黝黑的水手圍住：規矩照樣是貝爾維婭定的，她一邊發號施令，一邊抓著主角的手不放，喊停的時候連主角也一起停。',
              [BELV], ['belv_club'], tags=JOIN, pc_body=SOFT, spot=(2, 1), spot_name='長椅那頭'),
        scene('聽艾蜜莉亞唱船歌', '聽艾蜜莉亞和水手們唱完船歌，看她被抱上長桌。',
              '主角坐在黑檀之夜的酒桶旁，聽{cast}和水手們一起唱完船歌，然後看著她被高大黝黑的水手們抱上長桌，一個接一個；她一邊喘一邊接著唱，天亮前裹著水手的外套回到主角身邊。',
              [AME], ['ame_club'], spot=(6, 2), spot_name='酒桶旁的位子'),
        scene('和艾蜜莉亞一起唱', '和艾蜜莉亞並肩坐上長桌，跟著船歌一起被享用（陰柔、中性體型的主角）。',
              '主角和{cast}並肩坐在黑檀之夜的長桌上，跟著水手們的船歌一起被輪流享用；艾蜜莉亞教主角唱下一段，歌聲斷斷續續，她握著主角的手不放。',
              [AME], ['ame_club'], tags=JOIN, pc_body=SOFT, spot=(6, 1), spot_name='唱船歌的長桌'),
    ],
    HOLE: [
        scene('替瑟蕾娜拿著髮簪', '坐在角落，聽牆後沒有名字的瑟蕾娜一整夜。',
              '主角坐在榮譽洞的角落，握著{cast}的蓮花髮簪，聽著牆後沒有名字的她服侍一個又一個看不見臉的人，聽她低低地笑出聲；天亮時她拿回髮簪，變回從容的瑟蕾娜，只有耳根還紅著。',
              [SER], ['ser_hole'], hours=2, spot=(1, 1), spot_name='瑟蕾娜的隔間'),
        scene('讓瑟蕾娜猜哪一個是你', '混進牆那一邊排隊的客人裡，讓牆後的瑟蕾娜猜哪一個是你。',
              '主角站到榮譽洞牆的那一邊，混在一排看不見臉的客人中間；牆後的{cast}一個一個服侍過去，輪到主角時停了一下，低低地笑了——她猜對了，於是慢條斯理地讓主角等到最後。',
              [SER], ['ser_hole'], hours=2, spot=(7, 1), spot_name='牆那一側的盡頭'),
        scene('替紫丁香記筆記', '在牆的這一邊，替牆後的克拉拉記下每一個反應。',
              '主角坐在榮譽洞的牆邊翻開筆記本，替牆後的{cast}記下每一個反應：她服侍著一個又一個看不見臉的人，從默念句子到忘了數數；天亮時她出來搶過筆記，一邊讀一邊紅著臉說「這一句不對，重來」。',
              [CLARA], ['clara_hole'], hours=2, spot=(1, 2), spot_name='記筆記的板凳'),
        scene('讓克拉拉閉著眼睛猜', '混進牆那一邊的客人裡，讓克拉拉閉著眼睛猜哪一個是你。',
              '主角混進榮譽洞牆那一邊排隊的客人裡；牆後的{cast}閉著眼睛一個一個服侍過去，邊服侍邊小聲地自言自語，像在打草稿，輪到主角時她停住了，很久很久——然後說「找到了」。',
              [CLARA], ['clara_hole'], hours=2, spot=(7, 2), spot_name='牆那一側的長凳'),
    ],
    FACELESS: [
        scene('看戴著儺面的婉貞', '坐在二樓的欄杆邊，看戴著儺面的蘇婉貞被面具客們享用。',
              '主角坐在無面樓二樓的欄杆邊，看著戴著白底朱紋儺面的{cast}在廳堂正中被一群戴著面具的男人輪流享用：她放肆地叫出聲，又一次次抬頭找主角；天亮前她摘下面具爬上二樓，把一切都說給主角聽。',
              [SU], ['yasz_club'], spot=(9, 1), spot_name='二樓欄杆邊的椅子'),
        scene('戴著儺面陪她入席', '戴上黑底金紋的儺面，和蘇婉貞一起被面具客們享用（陰柔、中性體型的主角）。',
              '主角戴上黑底金紋的儺面，和{cast}一起走進無面樓帷幔後的雅座，被一群戴著面具的男人圍住；誰也不知道誰是誰，只有蘇婉貞的手一直握著主角的手。',
              [SU], ['yasz_club'], tags=JOIN, pc_body=SOFT, spot=(5, 1), spot_name='帷幔後的雅座'),
        scene('沒有名字的一夜', '自己戴上儺面，在無面樓的燈影裡過一夜（付給老嫗香資）。',
              '主角戴上儺面，在無面樓的燈影裡和不知道名字的面具客們交纏了一夜：戴著面具的貴婦、名妓、書生、官員，誰也不問誰是誰；天亮前大家各自摘了面具，散進瓦舍的晨霧裡。',
              [], ['yasz_club'], tags=['adult'], hours=3, money_cc=20, spot=(2, 3), spot_name='燈影裡的廳堂'),
    ],
    MARKET: [
        scene('不戴面具的夜市', '蘇婉貞不再穿孝服了，她想和你逛一次夜市。',
              '{cast}換下了孝服，挽著主角從御街的街頭吃到街尾，回到她在瓦舍邊上的小院就關上門：不用再戴面具的寡婦一開始還會害羞地遮著臉，後來主動騎上主角，天青的細鱗從鎖骨一路紅到胸口。',
              [SU], ['yasz_lover'], tags=['adult', 'non_virgin']),
    ],
}

# ================= 蘇婉貞與無面樓 =================
BG = '二十四歲，龍安府蘇御史家的長媳。十九歲嫁進蘇家，丈夫是太學的上舍生，成親一年就病死了，兩人連手都很少牽。'
NPC = {
    'id': SU, 'name': '蘇婉貞', 'gender': 'female', 'race': 'hualong', 'class': '', 'level': 7, 'location': 'longan',
    'hire_cc': 0, 'kind': 'commoner', 'occupation': '守節的寡婦', 'adult': True, 'no_attack': True, 'tags': ['noble'],
    'lineage': '天青鱗',
    'haunts': [{'location': 'longan', 'zone': 'town', 'weight': 1}, {'location': 'longan', 'zone': 'temple', 'weight': 0.4}],
    'personality': '端莊、溫婉，說話前總先低頭，對誰都客客氣氣，連笑都只笑一半；守了三年的節，一舉一動都像是做給牌坊看的。只有戴上面具的時候，才敢做回那個連自己都不認識的人。',
    'appearance': '二十四歲的天青鱗寡婦，身高約 160 公分，身形纖柔、腰細臀豐，一對短短的天青色龍角上只別著一支素銀簪，烏髮盤成一絲不亂的圓髻；終年穿著素白的孝服與月白的披帛，手腕上戴著亡夫留下的一串念珠，走路時連裙擺都不會晃。',
    'adult_appearance': '素白的孝服底下是豐腴白皙的身子，C 罩杯，腰極細、臀腿圓潤；天青的細鱗從鎖骨一路延伸到胸口，一害羞就整片泛紅。孝服的夾層裡縫著一張儺面——白底朱紋，笑得很放肆。',
    'background': BG + '三年來她白天替婆家抄經、繡佛幡，夜裡一個人坐在燈下；御史公公正替她向禮部請一座貞節牌坊，蘇家的門楣全靠她。沒有人知道，瓦舍深處有一座不掛招牌的「無面樓」，進門的人都要戴上儺面——她去過一次，就再也忘不了。',
    'relations': {},
}
CLUB_BG = BG + '御史公公替她請的貞節牌坊立起來了，她白天照樣替婆家抄經；夜裡卻常常出現在瓦舍的無面樓，戴著那張白底朱紋的儺面。每一次，她都會先在二樓的欄杆邊找那個看過她兩張臉的人。'
LOVER_BG = BG + '守了三年節，她在禮部的官員面前說不要那座貞節牌坊，搬出了蘇家，在瓦舍邊上租了一間小院，靠替人繡花過日子。那張儺面收在箱底，她說以後用不著了。'
NPC['stages'] = [
    {'requires': {'flags': ['yasz_club']}, 'hours': 'night', 'location': 'longan', 'fixed': {'area': f'sm/{FACELESS_MAP}', 'x': 5, 'y': 3}, 'background': CLUB_BG},
    {'requires': {'flags': ['yasz_lover']}, 'location': 'longan',
     'haunts': [{'location': 'longan', 'zone': 'town', 'weight': 1}],
     'background': LOVER_BG,
     'personality': '還是溫婉、說話輕聲，卻不再先低頭了；笑起來會笑完整，被人盯著看也不躲，只有在主角面前才會像以前一樣紅了臉。'},
    {'requires': {'flags': ['yasz_club']}, 'location': 'longan', 'background': CLUB_BG},
]

LANDMARK = {
    'id': FACELESS, 'name': '無面樓', 'emoji': '👺', 'location': 'longan',
    'at': {'area': 'longan/washe', 'x': 8, 'y': 3}, 'types': ['market'],
    'desc': '瓦舍深處一座不掛招牌的小樓，進門的人都要戴上儺面，誰也不問誰的名字。蘇婉貞帶你來過一次，門口的老嫗記住了你的面具。',
    'scene': '樓裡點著一盞盞紗燈，帷幔隔出一間間雅座，戴著儺面的男男女女在燈影裡交纏，沒有人說出自己的名字。',
    'open': {'hours': 'night', 'flags': ['yasz_club'], 'hidden': True, 'adult': True},
    'interior': FACELESS_MAP,
}

SPECIAL_MAPS = {
    FACELESS_MAP: {
        'name': '無面樓', 'location': 'longan',
        'desc': '瓦舍深處不掛招牌的小樓：一盞盞紗燈，帷幔隔出一間間雅座，戴著儺面的客人在燈影裡交纏；二樓的欄杆邊有一張看得見整座廳堂的椅子，是蘇婉貞留給你的位子。',
        'lighting': 'lit', 'refresh': False, 'peaceful': True,
        'grid': [
            '###########',
            '#.........#',
            '#.#.#.#.#.#',
            '#.........#',
            '#.........#',
            '#####E#####',
        ],
    },
}

WB_LINE = "    - 蘇婉貞（龍安府走動）: '苏御史家守节三年的天青鳞寡妇，礼部正要替她立贞节牌坊；夜里偷偷戴着傩面去瓦舍深处的「无面楼」'"


def write_npc():
    p = 'data/world/npcs.json'
    n = NPC
    assert len(n['personality']) <= 160 and len(n['appearance']) <= 240 and len(n['background']) <= 400, n['id']
    for st in n['stages']:
        assert len(st['background']) <= 400
    lines = open(p, encoding='utf-8').read().rstrip('\n').split('\n')
    lines = [l for l in lines if not l.startswith(f'    {{"id": "{n["id"]}"')]
    close = max(i for i, l in enumerate(lines) if l == '  ]')
    if not lines[close - 1].rstrip().endswith(','):
        lines[close - 1] = lines[close - 1] + ','
    lines[close:close] = ['    ' + json.dumps(n, ensure_ascii=False)]
    out = '\n'.join(lines) + '\n'
    ids = [x['id'] for x in json.loads(out)['npcs']]
    assert len(ids) == len(set(ids)), '重複的 NPC id'
    open(p, 'w', encoding='utf-8').write(out)


def write_landmarks():
    p = 'data/world/landmarks.json'
    d = json.load(open(p, encoding='utf-8'))
    # 無面樓整筆換掉，但保留別支腳本（club_lines43.py）加上去的場景
    old = next((l for l in d['landmarks'] if l['id'] == LANDMARK['id']), {})
    d['landmarks'] = [l for l in d['landmarks'] if l['id'] != LANDMARK['id']] + [{**LANDMARK, **({'scenes': old['scenes']} if old.get('scenes') else {})}]
    by_id = {l['id']: l for l in d['landmarks']}
    for lid, mine in SCENES.items():
        titles = {s['title'] for s in mine}
        by_id[lid]['scenes'] = [s for s in by_id[lid].get('scenes', []) if s['title'] not in titles] + mine
        assert len(by_id[lid]['scenes']) <= 8, lid
    open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1))


def write_special_maps():
    import east_p3_places as P3
    P3.SPECIAL_MAPS = SPECIAL_MAPS
    P3.write_special_maps()


def write_worldbook():
    p = 'data/worldbook/elondia.worldbook.json'
    wb = json.load(open(p, encoding='utf-8'))
    e = next(e for e in wb['entries'].values() if e['comment'] == '人物-炎华南域')
    lines = [l for l in e['content'].split('\n') if '蘇婉貞' not in l]
    # 接在龍安府那一段的最後
    head = next(i for i, l in enumerate(lines) if l.strip().startswith('龙安府') or l.strip().startswith('龍安府'))
    end = head + 1
    while end < len(lines) and lines[end].startswith('    '):
        end += 1
    lines.insert(end, WB_LINE)
    e['content'] = '\n'.join(lines)
    if '蘇婉貞' not in e['key']:
        e['key'].append('蘇婉貞')
    open(p, 'w', encoding='utf-8').write(json.dumps(wb, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    write_stories(STORIES)
    write_npc()
    write_landmarks()
    write_special_maps()
    write_worldbook()
    print(f'延伸任務與蘇婉貞的線 {len(STORIES)} 條；場景 {sum(len(v) for v in SCENES.values())} 個；地標 1、特殊地圖 {len(SPECIAL_MAPS)}')
