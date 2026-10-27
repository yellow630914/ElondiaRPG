"""第二十九批：教堂懺悔室的各國巡禮（worldgen/design/adult-events.md 第 3.2 節；成人向，只給女性形象與中性的主角）。
巡禮修女阿嘉莎帶著主角走五座城的懺悔室：晨光城・晨曦聖殿 → 萊茵堡的軍中禮拜堂 → 阿爾貝納的商人教會 → 索里耶爾・聖環主殿的審判廷 →
河谷鎮四國交界的小禮拜堂。神父們只想用主角，主角也就讓他們用；最後阿嘉莎坦白她一路把巡禮者賣給神父們抽成。
氣氛粗俗、不談感情；每個任務都標 male_partner。接下第一站時發修女服，五站的每個任務點都要穿著（DRESS29，story_batch1.py 套用）。
結局拿到巡禮者的懺悔頭紗（ITEMS29，work26.py 寫進物品）；新的固定 NPC 阿嘉莎（NPCS29）。
"""
import sys
sys.path.insert(0, 'worldgen/scripts/elondia')
from story_batch26 import aff, mem, money, item, cond, at_cell, out, opt, quest, BODY
from work26 import gear

AGATHE = 'npc_sister_agathe'
M = ['adult', 'male_partner']   # 神父們都是男人
VEIL = '巡禮者的懺悔頭紗'

ITEMS29 = [
    gear(VEIL, 'nun_veil', 'moonsilk',
         '巡禮修女在五座城的懺悔室之間傳下來的黑紗頭巾，邊上繡著五道小小的聖環。戴著它跪下的人，神父們總是格外「寬容」。',
         {"fai": 1, "cha": 1}, {"save": 1}, {"check": {"vs_tags": ["priest", "bishop"]}, "bonus": 3}, 2600),
]

NPCS29 = [
    {"id": AGATHE, "name": "阿嘉莎", "gender": "female", "race": "human", "class": "", "level": 5, "location": "dawnlight", "hire_cc": 0, "no_attack": True, "adult": True,
     "kind": "commoner", "tags": ["priest"], "occupation": "巡禮修女",
     "personality": "笑容溫和、說話輕聲細語，滿口「神會寬恕」；心裡只有帳本，哪個神父出多少、哪間懺悔室抽幾成，記得比經文還清楚。",
     "appearance": "二十八、九歲的修女，黑頭巾底下露出一綹栗色的頭髮，修女服洗得發白，腰上掛著一串磨亮的念珠和一個鼓鼓的錢袋。",
     "adult_appearance": "修女服底下什麼也沒穿，大腿內側用墨水記著一排排的數字。",
     "background": "自稱「巡禮修女」，帶著外地來的巡禮者走晨光城、萊茵堡、阿爾貝納、索里耶爾、河谷鎮五座城的懺悔室，說走完五站就能洗清一身的罪。五座城的神父都認得她，也都知道她帶來的巡禮者為什麼總是穿著修女服、底下什麼都沒穿。",
     "haunts": [{"location": "dawnlight", "zone": "town", "weight": 1}],
     # 跟著巡禮走：每過一站換到下一座城（前面的條件先比對）
     "stages": [
         {"requires": {"flags": ["conf_4_done"]}, "location": "rivervale", "haunts": [{"location": "rivervale", "zone": "town", "weight": 1}]},
         {"requires": {"flags": ["conf_3_done"]}, "location": "soriel", "haunts": [{"location": "soriel", "zone": "town", "weight": 1}]},
         {"requires": {"flags": ["conf_2_done"]}, "location": "albena", "haunts": [{"location": "albena", "zone": "town", "weight": 1}]},
         {"requires": {"flags": ["conf_1_done"]}, "location": "rhineburg", "haunts": [{"location": "rhineburg", "zone": "town", "weight": 1}]},
     ],
     "relations": {}},
]

LANDMARKS29 = []

DAWN = at_cell('dawnlight', 'lm_dawn_sanctum')          # 晨曦聖殿（白天）
CAMP = at_cell('rhineburg', 'temple')                    # 萊茵堡的軍中禮拜堂
TITHE = at_cell('albena', 'temple')                      # 阿爾貝納的商人教會
RING = at_cell('soriel', 'lm_holy_ring_cathedral')       # 聖環主殿（白天，官方場所）
CHAPEL = at_cell('rivervale', 'temple')                  # 河谷鎮的小禮拜堂

conf = [
    quest('conf_lattice', '格子窗的那一邊', '巡禮修女阿嘉莎說，走完五座城的懺悔室，一身的罪就洗乾淨了。第一站是晨光城的晨曦聖殿。（教堂懺悔室的各國巡禮・一）',
          'D', AGATHE, 7, None,
          '阿嘉莎把一套修女服和頭巾塞進你懷裡：「巡禮者都穿這個。底下什麼都別穿——懺悔的人要坦坦蕩蕩。」她替你拉緊頭巾，順手在你屁股上拍了一下，「晨曦聖殿的神父耳朵很好，你說得越詳細，罪洗得越乾淨。」',
          [
              {"id": "tell", "title": "在晨曦聖殿的懺悔室說出你的罪", "kind": "check", "at": DAWN,
               "text": "懺悔室又窄又暗，格子窗那一邊傳來神父粗重的呼吸聲。「孩子，說吧。你犯了什麼淫邪的罪？說得越詳細越好——跟誰、在哪裡、怎麼弄的、弄了幾次。」格子窗底下有一個拳頭大的洞，洞口磨得很光滑。",
               "check": {"attr": "cha", "dc": 13},
               "success": out("你一件一件地說，說得又慢又細。格子窗那一邊的呼吸越來越急，布料摩擦的聲音也越來越快。說完的時候，他啞著嗓子說：「很好……很好。神聽見了。」", money(30)),
               "fail": out("你說得吞吞吐吐，神父不滿意，一個細節一個細節地逼問，要你把每一次的姿勢都說出來、要你一邊說一邊摸給他聽。",
                           cond('aroused'),
                           scene="懺悔室裡，神父隔著格子窗逼主角把每一次性經驗的細節都說出來，要主角一邊說一邊撩起修女服摸自己給他聽，主角的手指在腿間越動越快，格子窗另一邊傳來他自慰的喘息。")},
              {"id": "hand", "title": "「把手伸過來」", "kind": "choice", "at": DAWN,
               "text": "「最後一步，」神父說，「贖罪要用身體。把手從洞裡伸過來。」洞的另一頭，他的褲子已經解開了。",
               "options": [
                   opt('把手伸過去', out("你把手伸進洞裡，握住了那根又熱又硬的東西。沒多久他就把它整根塞了過來，要你用嘴替他贖罪。你跪在懺悔室裡，直到他抖著射完。阿嘉莎在門外數錢：「第一站，過了。」",
                                     money(80), aff(AGATHE, 5, '第一站就很聽話'), mem('在晨曦聖殿的懺悔室裡，隔著格子窗用手和嘴替神父「贖罪」。', 2),
                                     scene="主角跪在懺悔室裡，把手伸過格子窗的洞替神父套弄，他隨即把陰莖整根從洞裡塞過來，主角含住它前後吞吐，被他抓著格子窗頂到喉嚨深處，最後射滿主角的嘴。")),
                   opt('撩起裙子，貼上格子窗', out("你轉過身，撩起修女服，把屁股貼上那個洞。格子窗那一邊的神父愣了一下，接著整個人撞了過來。懺悔室的木板被撞得咯咯響，他一邊幹一邊念著寬恕的經文。阿嘉莎在門外數錢：「第一站，過了。」",
                                                money(100), aff(AGATHE, 5, '第一站就很懂事'), mem('在晨曦聖殿的懺悔室裡，撩起修女服讓神父隔著格子窗的洞幹了一回。', 2),
                                                scene="主角撩起修女服、光著屁股貼上懺悔室格子窗的洞，神父從另一邊把陰莖插進主角體內，隔著木板一下一下地猛撞，一邊幹一邊念寬恕的經文，最後射在主角裡面，精液順著大腿往下流。")),
               ]},
          ], 150, 300, M, 'conf_1_done'),
    quest('conf_chapel', '軍中禮拜堂', '第二站是萊茵堡的軍中禮拜堂。隨軍神父聽士兵懺悔聽了二十個冬天，他說贖罪要跪著。（教堂懺悔室的各國巡禮・二）',
          'C', AGATHE, 8, 'conf_1_done',
          '阿嘉莎在萊茵堡的城門口等你，手裡拿著一張摺好的信：「給軍中禮拜堂的隨軍神父。他人很好，就是愛讓人跪著。」她壓低聲音，「明天第三軍團開拔，今晚排隊懺悔的士兵很多。你去，他們會很感激。」',
          [
              {"id": "kneel", "title": "在軍中禮拜堂跪著懺悔", "kind": "check", "at": CAMP,
               "text": "禮拜堂裡瀰漫著皮革和汗水的味道。隨軍神父坐在長椅上，叫你跪在他腿間懺悔：「一邊說，一邊贖罪。」他掀開了神袍。門外，一排明天就要上前線的士兵正在等著。",
               "check": {"attr": "fai", "dc": 14},
               "success": out("你一邊含著他一邊斷斷續續地懺悔，他閉著眼睛點頭，像在聽一場彌撒。最後他按著你的頭射了，拍拍你的頭巾：「贖完了。下一個罪人在門外。」", money(50),
                              scene="主角跪在隨軍神父的兩腿之間，一邊含著他的陰莖一邊斷斷續續地說出自己的罪，神父閉著眼按住主角的頭上下抽送，最後射在主角嘴裡，叫主角吞下去才算贖完。"),
               "fail": out("你說得太慢，他不耐煩了，揪著你的頭巾把你按下去，一句懺悔都不讓你說完。", cond('dazed'),
                           scene="隨軍神父不耐煩地揪住主角的修女頭巾，把主角的頭按在胯下猛頂，嗆得主角說不出話，直到他射在主角的喉嚨裡。")},
              {"id": "line", "title": "門外排隊的士兵", "kind": "choice", "at": CAMP,
               "text": "神父扣好神袍，朝門外點了點頭：「明天開拔的孩子們也有罪要贖。你是巡禮者，替他們贖，比我念一百遍經文還靈。」門開了，第一個士兵已經在解皮帶。",
               "options": [
                   opt('替整排士兵贖罪', out("你在禮拜堂的祭壇前跪了一整夜，士兵一個接一個地進來，有的站著、有的把你按在長椅上，誰也沒說一句懺悔的話。天亮時軍號響了，最後一個士兵邊跑邊繫皮帶。神父在你的頭巾上畫了一個聖環：「主會記得。」",
                                         money(150), cond('drained'), aff(AGATHE, 5, '替整排士兵贖了罪'), mem('在萊茵堡的軍中禮拜堂，替明天開拔的一整排士兵「贖罪」到天亮。', 2),
                                         scene="軍中禮拜堂裡，明天開拔的士兵排著隊一個接一個上主角：把主角按在長椅上從後面幹、拉起來站著幹、塞進主角嘴裡，一個射完換下一個，主角的修女服被精液弄得一塌糊塗，一直被輪到天亮的軍號響起。")),
                   opt('只替神父一個人贖完', out("你搖頭，把門關上：「我只替神父贖。」神父笑了，把你按在祭壇上，從背後慢慢地幹，幹完一次又一次，門外的士兵罵了一整夜。", money(100), aff(AGATHE, 3, '只陪了神父'),
                                             mem('在萊茵堡的軍中禮拜堂，被隨軍神父按在祭壇上幹了一整夜。', 2),
                                             scene="隨軍神父把主角按在禮拜堂的祭壇上，掀起修女服從背後慢慢地幹，射了一次又一次，主角趴在祭壇的聖布上被頂得往前滑，門外士兵的叫罵聲一直沒停。")),
               ]},
          ], 200, 450, M, 'conf_2_done'),
    quest('conf_tithe', '懺悔的價錢', '第三站是阿爾貝納的商人教會。這裡什麼都要錢，懺悔也是；付不起的，用別的付。（教堂懺悔室的各國巡禮・三）',
          'C', AGATHE, 9, 'conf_2_done',
          '阿嘉莎把一張價目表攤在你面前：「小罪五十、大罪一百、淫邪的罪兩百，現付。」她用指甲點了點最底下一行小字，「付不起的，執事會跟你『商量』。我是建議你別付錢——錢留著，身體洗一洗又是乾淨的。」',
          [
              {"id": "haggle", "title": "跟收錢的執事談懺悔的價錢", "kind": "check", "at": TITHE,
               "text": "教會的帳房就設在懺悔室旁邊。胖執事一邊撥算盤一邊打量你的修女服：「淫邪的罪，兩百白鸛。看你這身打扮，罪應該不小。」他的眼睛在你胸口停了很久。",
               "check": {"attr": "cha", "dc": 15},
               "success": out("你把價錢談到了一百五十。執事撥了撥算盤，笑著說：「付錢，或者付別的——一樣的價。」他把懺悔室的簾子拉開了。", money(20)),
               "fail": out("你越談他越不耐煩，價錢是壓到了一百五十，他卻直接把手伸進你的修女服裡掂了掂：「這樣吧，先付一點訂金。」", cond('aroused'),
                           scene="商人教會的胖執事一邊撥算盤一邊把手伸進主角的修女服裡，揉捏主角的胸口、手指往下摳弄，說這是懺悔的「訂金」，算盤珠子撥一下他就摳一下。")},
              {"id": "pay", "title": "付懺悔的錢", "kind": "choice", "at": TITHE,
               "text": "懺悔室裡坐著教會的主任司鐸，桌上擺著一個錢箱。「付錢吧，孩子。」他的眼睛看著你的修女服，「付不起的話，教會也收實物。」執事和帳房的會計站在門口，一個也沒走。",
               "options": [
                   opt('付一百五十白鸛', out("你把一百五十白鸛倒進錢箱。司鐸數完錢，點點頭：「很好，罪洗了。」然後他把錢箱推到一邊，解開了腰帶：「現在是教會送你的祝福——免費的。」執事和會計也走了進來。",
                                       money(-150), aff(AGATHE, 2, '居然付了錢'), mem('在阿爾貝納的商人教會付了一百五十白鸛懺悔，然後被三個人「免費祝福」。', 2),
                                       scene="主角付完懺悔的錢，商人教會的司鐸、執事和會計還是把主角按在錢箱旁邊的桌上，三個人輪流幹主角，說這是教會免費的祝福，銅幣在桌上被撞得叮噹響。")),
                   opt('用身體付', out("你把修女服從肩上褪下來：「我用這個付。」司鐸笑了，在帳本上記了一筆。三個人按著價目表一項一項地收：小罪用嘴、大罪用下面、淫邪的罪三個人一起收。收完了，執事還開了一張收據塞進你的頭巾裡。",
                                     money(100), cond('drained'), aff(AGATHE, 5, '懂得省錢'), mem('在阿爾貝納的商人教會用身體付了懺悔的錢，司鐸、執事和會計照價目表一項一項收。', 2),
                                     scene="主角在商人教會的懺悔室裡用身體付懺悔的錢：司鐸、執事和會計照著價目表輪流收，先用主角的嘴、再從下面幹，最後三個人同時前後一起上，邊幹邊在帳本上記帳，射完還把收據塞進主角的頭巾。")),
               ]},
          ], 250, 600, M, 'conf_3_done'),
    quest('conf_trial', '審判廷的懺悔室', '第四站是索里耶爾的聖環主殿。審判廷的懺悔室有一條規矩：說謊會被罰，說實話也會被罰。（教堂懺悔室的各國巡禮・四）',
          'B', AGATHE, 10, 'conf_3_done',
          '阿嘉莎在聖環主殿的台階上等你，難得地沒有笑：「審判廷的人跟前面的不一樣，他們不聽懺悔，他們審。」她把你的頭巾拉正，「記住，在那裡說什麼都會被罰。罰完了，第四站就過了。」',
          [
              {"id": "question", "title": "回答審判官的問題", "kind": "check", "at": RING,
               "text": "懺悔室沒有格子窗，只有一張刑具一樣的跪凳和三個戴兜帽的審判官。最前面那個翻開一本厚厚的冊子：「巡禮者，你在前三站做了什麼？一件一件說。我們都知道答案。」",
               "check": {"attr": "int", "dc": 15},
               "success": out("你避開了他們的陷阱，每個問題都答得滴水不漏。審判官合上冊子，冷冷地說：「答得很好。太好了，好得像是在說謊。」"),
               "fail": out("你答錯了一題，審判官一揮手，另外兩個人把你按在跪凳上，掀起修女服，用戒尺在你屁股上打了十下才繼續問。", cond('sensitive'),
                           scene="審判廷的懺悔室裡，兩個審判官把主角按在跪凳上、掀起修女服，用戒尺狠狠地打主角光著的屁股，打一下問一題，打到主角的屁股通紅、腿間濕透。")},
              {"id": "verdict", "title": "審判廷的判決", "kind": "choice", "at": RING,
               "text": "三個審判官站了起來，最前面那個解開兜帽下的長袍：「最後一題：你喜歡嗎？說謊，罰；說實話，也罰。」",
               "options": [
                   opt('說謊：「不喜歡」', out("「說謊。」他們把你綁在跪凳上，雙手反綁在背後，三個人輪流罰你，每罰一次就問一次「喜歡嗎」，你說一次「不喜歡」就再罰一次。罰到你說不出話，他們才在冊子上蓋了章。",
                                            money(150), cond('drained'), cond('sensitive'), aff(AGATHE, 5, '撐過了審判廷'), mem('在聖環主殿的審判廷懺悔室裡說了謊，被三個審判官綁在跪凳上輪流「罰」到說不出話。', 2),
                                            scene="主角被反綁雙手、趴綁在審判廷的跪凳上，三個審判官輪流從後面幹主角，每射一次就問一次「喜歡嗎」，主角說「不喜歡」就換下一個繼續，直到主角喊不出聲音。")),
                   opt('說實話：「喜歡」', out("「淫邪之罪，認了。」他們把你抬上懺悔室的長桌，像審判一樣一條一條地罰：嘴、胸口、前面、後面。最年長的審判官最後一個上，一邊幹一邊宣讀判決書。罰完，他在你的頭巾上蓋了審判廷的火漆印。",
                                            money(150), cond('drained'), aff(AGATHE, 5, '在審判廷認了罪'), mem('在聖環主殿的審判廷懺悔室裡認了淫邪之罪，被三個審判官在長桌上一條一條地「罰」。', 2),
                                            scene="主角承認自己喜歡，三個審判官把主角抬上懺悔室的長桌，照判決書一條一條地罰：輪流用主角的嘴、揉捏胸口、從前面和後面幹，最年長的審判官最後一個上，一邊抽送一邊宣讀判決，射在主角裡面。")),
               ]},
          ], 300, 800, M, 'conf_4_done'),
    quest('conf_last', '修女的懺悔', '最後一站是河谷鎮四國交界的小禮拜堂。阿嘉莎說，這一站換她懺悔。（教堂懺悔室的各國巡禮・五）',
          'B', AGATHE, 11, 'conf_4_done',
          '阿嘉莎在河谷鎮的小禮拜堂門口等你，手裡的錢袋比第一天鼓了好幾倍。「最後一站。」她笑得和第一天一樣溫和，「這一站，換我懺悔。你聽完了，巡禮就結束了。」',
          [
              {"id": "her_sin", "title": "聽阿嘉莎懺悔", "kind": "story", "at": CHAPEL,
               "text": "阿嘉莎跪在小禮拜堂的懺悔室裡，隔著格子窗，換你坐在神父的位置上。「我的罪是這樣的：五座城的神父，每一個都付錢給我。你在晨曦聖殿的那一次，八十白鸛；軍中禮拜堂那一整夜，一個士兵五個銅幣；商人教會的帳我抽三成；審判廷付得最多。」她數著念珠，像在數錢，「巡禮從來不洗罪，巡禮是我的生意。你是我這一季賣得最好的一個。」",
               "success": out("她懺悔完，站起來拍了拍修女服的膝蓋：「現在你知道了。」禮拜堂的門開了，五座城的神父一個一個走了進來——晨曦聖殿的、軍中禮拜堂的、商人教會的、審判廷的，還有這間小禮拜堂的老神父。阿嘉莎說：「他們湊了錢，來替你的巡禮『結業』。」", aff(AGATHE, 5, '聽完了她的懺悔'))},
              {"id": "graduation", "title": "巡禮的結業", "kind": "choice", "at": CHAPEL,
               "text": "五個神父把小禮拜堂的門閂上，在祭壇前站成一圈。阿嘉莎把一條繡著五道聖環的黑紗頭巾放在祭壇上：「結業的獎品。怎麼結業，你自己選——我抽三成。」",
               "options": [
                   opt('讓她看著你被五個神父用', out("你跪上祭壇，讓五個神父圍上來。阿嘉莎坐在第一排的長椅上，一邊數錢一邊看，偶爾指揮一句「換個姿勢，那位付了雙倍」。天亮時她把那條黑紗頭巾戴在你頭上：「巡禮結束了。罪？一點也沒少。」",
                                                item(VEIL), money(200), cond('drained'), aff(AGATHE, 10, '替她賺了最後一筆'), mem('在河谷鎮的小禮拜堂，讓五座城的神父在祭壇上輪流「結業」，阿嘉莎在旁邊抽成。她把巡禮者的懺悔頭紗給了你。', 3),
                                                scene="主角跪在小禮拜堂的祭壇上，五座城的神父圍成一圈輪流幹主角，前後一起、一個射完換下一個，阿嘉莎坐在長椅上數錢、指揮他們換姿勢；主角的修女服被扯開，從嘴到下身都被射滿，一直弄到天亮。")),
                   opt('拉她一起跪下', out("你一把抓住阿嘉莎的手腕，把她也拖上祭壇：「抽成的人也要結業。」神父們笑了，五個人分成兩邊。她罵了一句，很快就跟你一樣叫不出完整的經文。天亮時她揉著膝蓋把頭巾丟給你：「下一季的巡禮者，你自己帶。」",
                                     item(VEIL), money(150), cond('drained'), aff(AGATHE, 5, '被拖下水'), mem('在河谷鎮的小禮拜堂，把阿嘉莎也拖上祭壇，和她並排被五座城的神父「結業」。她把巡禮者的懺悔頭紗給了你。', 3),
                                     scene="主角把阿嘉莎拖上祭壇，兩人並排跪著，五個神父分成兩邊輪流幹她們，前面的人塞進嘴裡、後面的人從背後頂，換來換去；阿嘉莎的修女服被掀到腰上，和主角一起被幹到天亮。")),
                   opt('把她推到前面去', out("你把阿嘉莎推到神父們面前：「先從賣人的開始。」五個神父看了看她，又看了看錢袋，先上了她，再上你。整夜她都在喊「我抽三成」，沒有人理她。天亮時她的錢袋倒空在祭壇上，頭巾被你拿走了。",
                                       item(VEIL), money(300), cond('afterglow'), aff(AGATHE, -5, '被你推出去先挨'), mem('在河谷鎮的小禮拜堂，把阿嘉莎推到五座城的神父面前先挨，自己再上。她的錢袋和巡禮者的懺悔頭紗都歸了你。', 3),
                                       scene="主角把阿嘉莎推到祭壇前，五個神父先輪流幹她，把她按在聖壇上前後一起上，接著再輪到主角；主角和阿嘉莎被輪流抽送、互相舔乾淨，一直到天亮，阿嘉莎的錢袋倒在祭壇上撒了一地。")),
               ]},
          ], 500, 1200, M, 'conf_done'),
]

BATCH29 = conf

# 接下第一站時發修女服，五站的每個非戰鬥任務點都要穿著（格式同 story_batch26.py 的 DRESS）
DRESS29 = {
    'conf': ('conf_lattice', ['亞麻修女服', '亞麻修女頭巾'], ['nun_habit', 'nun_veil'], [q['id'] for q in conf]),
}


if __name__ == '__main__':
    import json
    stories = json.load(open('data/rules/stories.json'))['stories']
    npcs = json.load(open('data/world/npcs.json'))['npcs']
    items = json.load(open('data/rules/items.json'))['items']
    lms = json.load(open('data/world/landmarks.json'))['landmarks']
    maps = json.load(open('data/world/maps.json'))
    gearj = json.load(open('data/rules/gear.json'))
    temple = [k for k, v in maps['legend'].items() if v.get('kind') == 'temple']
    ids = [q['id'] for q in BATCH29]
    assert len(set(ids)) == 5
    old_flags = json.dumps([s for s in stories if s['id'] not in ids], ensure_ascii=False)
    assert '"conf_' not in old_flags, '旗標前綴 conf_ 已經被用掉了'
    npc_ids = {n['id'] for n in npcs} | {n['id'] for n in NPCS29}
    assert all(n['name'] != '阿嘉莎' for n in npcs if n['id'] != AGATHE)
    item_names = {i['name'] for i in items} | {i['name'] for i in ITEMS29}
    lm_ids = {l['id'] for l in lms}
    for n, (pre, (first, give, wear, qs)) in enumerate(DRESS29.items()):
        assert first == ids[0] and qs == ids
        for g in give: assert g in item_names, g
        for w in wear: assert w in gearj['bases'], w
    for k, q in enumerate(BATCH29):
        assert q['tags'] == M, q['id']
        assert q['start']['pc_body'] == BODY and q['start']['npc'] in npc_ids
        if k: assert q['start']['requires'] == {'flags': [f'conf_{k}_done']}, q['id']
        else: assert 'requires' not in q['start']
        assert len(q['title']) <= 40 and len(q['summary']) <= 300 and len(q['start']['text']) <= 400
        for n in q['nodes']:
            assert len(n['title']) <= 40 and len(n['text']) <= 600, n['title']
            at = n['at']
            if at['cell'].startswith('lm_'): assert at['cell'] in lm_ids and next(l for l in lms if l['id'] == at['cell'])['location'] == at['location']
            else:
                blocks = maps['maps'][at['location']]['blocks']
                assert any(c in ''.join(b['grid']) for b in blocks for c in temple), at
            outs = [n.get('success'), n.get('fail')] + [o.get(x) for o in n.get('options', []) for x in ('success', 'fail')]
            for o in filter(None, outs):
                assert len(o['text']) <= 400, o['text'][:30]
                if o.get('scene'): assert len(o['scene']) <= 300 and '主角' in o['scene'], o['scene'][:30]
                for e in o.get('effects', []):
                    if e['type'] == 'item': assert e['name'] in item_names
                    if e['type'] == 'affinity': assert e['npc'] in npc_ids
            for o in n.get('options', []): assert len(o['label']) <= 30, o['label']
        last = q['nodes'][-1]
        assert last['kind'] == 'choice'
        for o in last['options']:
            assert o['success'].get('scene'), (q['id'], o['label'])
            assert o['success']['set_flags'] == [f"conf_{k + 1}_done" if k < 4 else 'conf_done'] and o['success']['complete']
            if k == 4: assert item(VEIL) in o['success']['effects']
        assert '年了' not in json.dumps(q, ensure_ascii=False)
    print('ok', ids)
