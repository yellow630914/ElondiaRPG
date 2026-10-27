import json, sys
sys.path.insert(0, '.')
from npcfmt import write
P = 'data/world/npcs.json'
base = json.load(open(P))
L = base['npcs']
by = {n['id']: n for n in L}
H = lambda loc, zone, w=1: {"location": loc, "zone": zone, "weight": w}
ana, alx, lil = by['npc_anastasia'], by['npc_alexei'], by['npc_lilian']
ANA_BG = ana['background'].replace('現任國王亞歷山大', '國王亞歷山大')  # 階段裡國王已經死了
ana['stages'] = [
    {"requires": {"flags": ["dthr_queen"]}, "location": "dawnlight",
     "haunts": [H("dawnlight", "palace"), H("dawnlight", "noble", 0.4)],
     "background": ANA_BG + "父王亞歷山大死後，她在公爵洛倫佐的支持下登基為晨曦王國的女王，辭去了樞機主教的職位，主張與魔族議和。",
     "personality": "加冕之後，嬌小的身軀多了女王的威儀，手段比從前更老辣，也更謹慎；她記得父王臨終的話，努力不把王國當成棋盤。偶爾還是會在深夜換上便服，想溜出城去。",
     "tags": ["royal"]},
    {"requires": {"flags": ["dthr_king"]}, "location": "dawnlight",
     "haunts": [H("dawnlight", "noble"), H("soriel", "noble", 0.6)],
     "background": ANA_BG + "父王亞歷山大死後，王兄阿列克謝在公爵洛倫佐的支持下登基。她退回樞機主教的座位，往返索里耶爾的次數越來越多。"},
]
alx['stages'] = [
    {"requires": {"flags": ["dthr_king"]}, "location": "dawnlight",
     "haunts": [H("dawnlight", "palace"), H("dawnlight", "noble", 0.5)],
     "background": alx['background'] + "父王死後，他在公爵洛倫佐的支持下登基為晨曦王國的國王，誓言要把魔族趕回荒原。",
     "personality": "登基之後依然豪爽，喜歡和騎士們喝酒；等了大半輩子的王冠終於到手，城府裡的異心變成了野心——他要在有生之年打一場讓人傳唱的戰爭。"},
    {"requires": {"flags": ["dthr_queen"]}, "location": "dawnlight",
     "haunts": [H("dawnlight", "noble")],
     "background": alx['background'] + "父王死後，妹妹安納塔西亞登基為女王。他交出了近衛的指揮權，被封為北境的守邊公爵，卻遲遲沒有離開王都。",
     "personality": "依然豪爽，記得每個部下的名字；輸掉王位之後話少了很多，常一個人在貴族區的酒館喝到深夜，沒有人知道他在想什麼。"},
]
lil['stages'] = [
    {"requires": {"flags": ["lil_graduated"]}, "location": "dawnlight",
     "haunts": lil['haunts'],
     "background": lil['background'] + "後來她在晨霧修道院的祭室裡知道了星之心的真相，在神殿裡辦了一場只有兩個人的畢業典禮，把寶石留給下一個十五歲的少女。",
     "personality": "正義感強烈、熱血；「畢業」之後不再喊台詞、擺姿勢，說起魔法少女的日子會害羞地轉移話題，卻還是會在看到壞人時下意識地擺出變身的手勢。被叫「阿姨」依然會當場崩潰。"},
]
# ---- 第二批 ----
by['npc_lorenzo_valois']['no_attack'] = True
isa, leo, wolf = by['npc_isadora'], by['npc_leonhart'], by['npc_wolfgang']
isa['stages'] = [
    {"requires": {"flags": ["isa_eloped"]}, "location": "rivervale",
     "haunts": [H("rivervale", "town")],
     "background": isa['background'] + "後來她和主角從萊茵堡私奔，在河谷鎮租了一間小屋，把那條馬鞭掛在牆上，再也沒有回過侯爵府。",
     "personality": "還是高傲、嘴硬，說話偶爾冒出「哦呵呵」，卻已經很少用「本小姐」了；正在學煮飯、洗衣服，每次失敗都氣得跺腳，又不肯讓人幫忙。一被溫柔對待就手足無措的毛病一點也沒變。"},
    {"requires": {"flags": ["isa_engaged"]}, "location": "rhineburg",
     "haunts": isa['haunts'],
     "background": isa['background'] + "後來主角回到侯爵府向她的父親提親，侯爵答應了；帝國社交界都在傳，鞭子大小姐終於找到了降得住她的人。",
     "personality": "高傲、強勢，說話依然帶著「哦呵呵」的笑聲，使喚僕人的時候卻多了一句「謝謝」；在主角面前會突然變得很安靜，被人揶揄就用馬鞭敲桌子。"},
]
leo['stages'] = [
    {"requires": {"flags": ["rwar_war"]}, "location": "rhineburg", "haunts": leo['haunts'],
     "background": leo['background'] + "四將軍的軍議決定四個軍團轉入戰時編制之後，他終於等到了整軍的命令，常常一連幾天待在練兵場。"},
]
wolf['stages'] = [
    {"requires": {"flags": ["rwar_peace"]}, "location": "rhineburg", "haunts": wolf['haunts'],
     "background": wolf['background'] + "四將軍的軍議上，他看著被人假扮魔族燒掉的村子的證據，最後說了一句「第三軍團服從敕令」——那是停戰以來他第一次在軍議上讓步。"},
]
# ---- 第三批 ----
aya = by['npc_aya']
aya['stages'] = [
    {"requires": {"flags": ["aya_lover"]}, "location": "soriel", "haunts": aya['haunts'],
     "background": aya['background'] + "後來她在禮拜堂裡做完了「最後的懺悔」，成了主角的戀人；那本祈禱書不是被燒掉，就是多了寫著主角的最後一頁。",
     "personality": "依然溫柔、說話輕聲細語，在人前還是規規矩矩的修女；只在主角面前卸下拘謹，會紅著臉說出以前只敢寫在書上的話。"},
    {"requires": {"flags": ["aya_club"]}, "location": "soriel", "haunts": aya['haunts'],
     "background": aya['background'] + "後來她真的走進了港區酒館地下的俱樂部「黑檀之夜」，成了那裡的座上賓；每一次回來，她都會把一切告訴主角——只告訴主角。",
     "personality": "白天依然是規規矩矩的修女，眼神裡卻多了一份坦然；不再為自己的念頭羞恥，只是每次說起那些夜晚還是會紅透耳根。"},
]
# ---- 第四批 ----
ser = by['npc_serena']
ser['stages'] = [
    {"requires": {"flags": ["ser_free"]}, "location": "coast_ferry", "haunts": [H("coast_ferry", "town")],
     "background": ser['background'] + "後來主角拿著瑪蒂爾達簽過字的契約替她贖了身，帶她在沿海渡口的燈塔上看了海。她留在渡口，在燈塔下開了一間小小的茶館。",
     "personality": "依然優雅、說話輕柔，舉手投足帶著金蓮樓教出來的風情；卻不再倦怠，會為了海上的日出早起，會跟漁夫的孩子討價還價。對主角說話時，總是笑著的。"},
]
# ---- 第五批 ----
ame, mar = by['npc_amelia'], by['npc_marina']
ame['stages'] = [
    {"requires": {"flags": ["ame_lover"]}, "location": "coast_ferry", "haunts": ame['haunts'],
     "background": ame['background'] + "後來主角替她查到，丈夫在潮汐港換了船名、另組了家庭；她陪著主角去看了一眼，回來之後摘下了婚戒，和主角在一起了。",
     "personality": "溫柔、愛笑，招呼客人時依然周到；不再一個人在打烊後喝悶酒，說起潮汐港時會安靜一下，然後笑著換個話題。"},
]
mar['stages'] = [
    {"requires": {"flags": ["port_free"]}, "location": "coast_ferry", "haunts": mar['haunts'],
     "background": mar['background'] + "後來她在港口會議上被推舉為沿海渡口自由港的第一任港務長，海燕號成了港口的巡邏船；找傳說中的島，暫時得往後排了。"},
]
# ---- 第六批 ----
mat, ign, cam, ele, hel = by['npc_matilda_rosen'], by['npc_ignaz_goldscale'], by['npc_camilla'], by['npc_elena'], by['npc_helen_lighthouse']
mat['stages'] = [
    {"requires": {"flags": ["cw_matilda"]}, "location": "albena", "haunts": mat['haunts'],
     "background": mat['background'] + "後來在七議席的表決上，她的對案勝過了康斯坦絲的自由市場法，接管了金秤商行的商路，成了議會裡最有權勢的人。"},
]
ign['stages'] = [
    {"requires": {"flags": ["cw_ignaz_down"]}, "location": "albena", "haunts": ign['haunts'],
     "background": ign['background'] + "後來他的商行被查出私鑄假白鸛幣（他堅稱是有人栽贓），被議會停權，商路交給議會託管。",
     "personality": "依然笑臉迎人，笑容裡卻多了一點疲憊；帳還是算得比誰都清楚，只是現在算的多半是自己欠了多少人情。"},
]
cam['stages'] = [
    {"requires": {"flags": ["wl_lovers"]}, "location": "albena", "haunts": cam['haunts'],
     "background": cam['background'] + "後來她戒了酒，在主角與伊蓮娜的陪伴下通過了魔導師工會的審查，成了工會的特別研究員；研究室門口終於掛上了招牌。",
     "personality": "溫柔、充滿母性，叫誰都是「孩子」；戒酒之後清醒得讓人有點不習慣，生活習慣依然糟糕，但會在伊蓮娜打掃時乖乖讓開。"},
]
ele['stages'] = [
    {"requires": {"flags": ["wl_lovers"]}, "location": "albena", "haunts": ele['haunts'],
     "background": ele['background'] + "後來她找到了穩定的媒介提供者——主角；師父重回魔導師工會之後，她的論文掛上了共同作者的名字。",
     "personality": "依然無口，一句話很少超過五個字；在主角面前卻偶爾會笑，說出來的提議也越來越驚人。"},
]
# ---- 第七批 ----
rosa, lena, val, kai, eve = by['npc_rosalind'], by['npc_lena'], by['npc_valerie'], by['npc_kai'], by['npc_eve']
rosa['stages'] = [
    {"requires": {"flags": ["annex_protectorate"]}, "location": "rhineburg", "haunts": rosa['haunts'],
     "background": rosa['background'] + "後來她的保護條約在阿爾貝納的七議席議會上以四比三通過，奧德聯邦成了帝國的保護國——她說那叫「將死」。"},
    {"requires": {"flags": ["annex_refused"]}, "location": "rhineburg", "haunts": rosa['haunts'],
     "background": rosa['background'] + "後來她的保護條約被阿爾貝納的議會擋了下來。她沒有進兵，只說下次會換一種下法。"},
]
lena['stages'] = [
    {"requires": {"flags": ["lena_lover"]}, "location": "dawnlight", "haunts": lena['haunts'],
     "background": lena['background'].replace("她說他只是去旅行了，總有一天會回來——她每天都會去城門口等。", "") + "後來主角替她到河谷鎮帶回了前任真正的信；她學著把愛放輕一點，不再每天去城門口等，成了主角的戀人。",
     "personality": "甜美、溫柔，笑容像陽光一樣；還是記得戀人說過的每一句話，但學會了不去數他看了幾次花——偶爾還是會忍不住，被發現時就紅著臉說「只有這一次」。"},
]
val['stages'] = [
    {"requires": {"flags": ["val_lover"]}, "location": "dawnlight", "haunts": val['haunts'],
     "background": val['background'] + "後來學院為她的論文召開聽證會，主角以「樣本本人」的身分出席作證；論文改列限閱，她留在學院，在新的病歷夾第一頁寫下：研究對象，戀人。",
     "personality": "冷靜、理性，說話依然像在寫病歷；只有在戀人面前會闔上病歷夾，偶爾說出一句不像病歷的話，然後自己先紅了耳朵。"},
]
kai['stages'] = [
    {"requires": {"flags": ["def_council"]}, "location": "albena", "haunts": kai['haunts'],
     "background": "自由集市長大的扒手。後來他扒到了帝國密探的密碼本，和主角一起交給了議會首席，從此替議會盯著集市——穿著乾淨的衣服，渾身不自在。",
     "personality": "油嘴滑舌但講義氣，討厭貴族；替議會做事之後嘴上抱怨個不停，抓到帝國密探的時候卻比誰都得意。"},
]
eve['stages'] = [
    {"requires": {"flags": ["eve_lover"]}, "location": "rhineburg", "haunts": [H("rhineburg", "town")],
     "background": eve['background'] + "後來侯爵要把她當成禮物送給公爵家，她一百五十年來第一次說了「不」，離開侯爵府，選擇服侍主角——條件是主角也要學著服侍她。休假的時候，她會去晨光城幫米米的紅茶店。",
     "personality": "冷靜、完美主義、毒舌，依然用最恭敬的語氣說最刻薄的話；只對主角例外——說刻薄話的時候會笑。"},
]
# ---- 第八批 ----
ver, valk = by['npc_veronica'], by['npc_valkas_moltencast']
ver['stages'] = [
    {"requires": {"flags": ["vsec_done"]}, "location": "bloodplume", "haunts": ver['haunts'],
     "background": ver['background'] + "後來主角當了她一陣子的秘書，陪她撐完了一年一度的陳情日；她的小冊子上多了一頁，寫的是那個人類。",
     "personality": "笑裡藏刀、說話甜得發膩，依然替莉莎爾處理所有不能讓人看見的事；只有在主角面前會把小冊子闔上，抱怨陳情書又堆得比她還高。"},
]
valk['stages'] = [
    {"requires": {"flags": ["valk_loyal"]}, "location": "moltenhold", "haunts": valk['haunts'],
     "background": "鐵血熔鑄家族家主、炎獄軍團統帥。他曾和獸骨荒丘的格羅姆私下往來，最後在女兒伊格妮絲面前重新立誓效忠莉莎爾。",
     "personality": "豪邁、暴躁、戰鬥狂；立誓之後依然嫌律法囉嗦，但會把怒氣留到演武場上發洩。"},
    {"requires": {"flags": ["valk_rebel"]}, "location": "bone_hills", "haunts": [H("bone_hills", "town")],
     "background": "鐵血熔鑄家族的前家主、炎獄軍團統帥。他帶著軍團離開熔火堡壘，投向了獸骨荒丘的血角氏族格羅姆，留下女兒伊格妮絲看守千爐工坊。",
     "personality": "豪邁、暴躁、戰鬥狂；說戰士不該生鏽，提到女兒的時候卻會突然沉默。"},
]
# ---- 第九批 ----
nick, seb = by['npc_nick_halfdemon'], by['npc_sebastian_eger']
nick['stages'] = [
    {"requires": {"flags": ["rot_watch"]}, "location": "rotmarsh", "haunts": [H("rotmarsh", "town", 3), H("rotmarsh", "outskirts", 1)],
     "background": "從某個氏族逃出來的半魔小賊。後來主角教腐沼村的村民組了巡邏隊，他自告奮勇當了隊長——他說是因為屋頂上看得最遠。",
     "personality": "機靈、愛吹牛、怕痛；當了巡邏隊長之後還是愛吹牛，但半夜敲鐘從來沒有遲到過。"},
]
seb['stages'] = [
    {"requires": {"flags": ["hm_pact"]}, "location": "ashport", "haunts": seb['haunts'],
     "background": "被萊茵帝國放逐的流亡貴族。十年前他在御前會議上主張和魔族通商，被宰相誣陷為叛國；後來他寫的和約草稿在灰港鎮的深淵交易所簽成了，帝國的密使到最後都不知道是誰寫的。",
     "personality": "風度翩翩、玩世不恭，依然嘴上掛著帝國貴族的禮儀；只是現在偶爾會說真心話。"},
    {"requires": {"flags": ["hm_sold"]}, "location": "ashport", "haunts": seb['haunts'],
     "background": "被萊茵帝國放逐的流亡貴族。他十年前寫的和約草稿差一點就簽成了，卻被人賣給了教廷，帝國的密使死在回程的船上。",
     "personality": "風度翩翩、玩世不恭，什麼都不信——現在連最後那一點也不信了。"},
]
# ---- 第十批 ----
dilia, balin, helga = by['npc_dilia_copperbeard'], by['npc_balin_greyrock'], by['npc_helga_malt']
dilia['stages'] = [
    {"requires": {"flags": ["smith_merged"]}, "location": "ironforge", "haunts": dilia['haunts'],
     "background": "「無火之鐵」的發明家。鍛炎議會表決之後，心火熔源旁蓋起了一座合爐：瑪格達看火，她看儀表，打出來的劍同時有鍛紋和回路光。",
     "personality": "急性子、腦袋轉得比嘴快；還是受不了「傳統就是這樣」，但現在會先聽瑪格達把話說完。"},
    {"requires": {"flags": ["smith_free"]}, "location": "ironforge", "haunts": dilia['haunts'],
     "background": "「無火之鐵」的發明家。鍛炎議會以一票之差否決了封禁，她的工坊掛上了「議會認可」的牌子，學徒排到了城門口。",
     "personality": "急性子、腦袋轉得比嘴快，贏了表決之後更停不下來；偶爾會望著心火熔源的方向發呆。"},
    {"requires": {"flags": ["smith_banned"]}, "location": "ironforge", "haunts": dilia['haunts'],
     "background": "「無火之鐵」的發明家。鍛炎議會封禁了用無火之鐵打武器，她的發明只能用在城牆與礦坑；瑪格達把自己的錘子借給了她。",
     "personality": "急性子、腦袋轉得比嘴快；說城牆比劍重要，說的時候是真心的。"},
]
balin['stages'] = [
    {"requires": {"flags": ["ore_done"]}, "location": "ironforge", "haunts": balin['haunts'],
     "background": "石誓會的守門騎士。三百年來第一次，封印之門打開了：門後是自願留在地底守護星心礦的古鍛匠，第一塊星心礦被扛上了地面。",
     "personality": "固執、莊重，說話像在念誓詞；守了三十年的門打開之後，偶爾會笑。"},
]
helga['stages'] = [
    {"requires": {"flags": ["brew_helga"]}, "location": "ironforge", "haunts": helga['haunts'],
     "background": "鐵爐堡最好的釀酒師，「酒桶」是她自己取的外號。從某一年起，氏族宴會只准喝她的酒——誰也喝不倒誰，宴會變成了真正的宴會。",
     "personality": "愛笑、豪爽、嘴巴不饒人，千杯不醉；現在不用再趕走塞錢的使者，改成趕走來偷酒的學徒。"},
]
# ---- 第十一批 ----
carlos, kal, seph = by['npc_carlos_blacksail'], by['npc_kalanthil'], by['npc_seph_mistveil']
carlos['stages'] = [
    {"requires": {"flags": ["smg_licensed"]}, "location": "tidehaven", "haunts": carlos['haunts'], "tags": ["merchant"],
     "background": "從前的走私王。他帶著帳本向七潮議會自首，揭發了收他分紅的三個議員，換來一張「特許貿易商」的執照；平民貨的稅從此減了一半。",
     "personality": "風度翩翩、對自己人講義氣；當了特許貿易商之後還是愛在議會的眼皮底下做生意，只是現在做的是合法的。"},
]
kal['stages'] = [
    {"requires": {"flags_any": ["acc_open", "acc_border"]}, "location": "silvermoon", "haunts": kal['haunts'],
     "background": "翠輝議會議長，傳統派的領袖。他知道了三百年前那場火的真相——點火的是被流放的精靈術士，不是人類——之後，王庭開始向外族打開森林。",
     "personality": "保守、驕傲、極有禮貌；現在的禮貌不再讓人覺得被輕視，只是對希爾薇的小說還是皺眉頭。"},
]
seph['stages'] = [
    {"requires": {"flags": ["fog_lifted"]}, "location": "silvermoon", "haunts": seph['haunts'] + [H("mosswhisper", "town", 1)],
     "background": "迷霧之幕的影行者。他等了兩百年，終於讓苔語村東邊的霧散去：被流放了五百年的霧谷第一次看見了太陽。",
     "personality": "安靜、有禮，從不說謊——現在偶爾也會說；去苔語村的時候，總是帶著給霧谷孩子的糖。"},
]
# ---- 第十二批 ----
moring, kara, naivee, talo = by['npc_moring'], by['npc_kara_redmane'], by['npc_naivee'], by['npc_talo_redmane']
# 墨鱗的放逐只是不准參加大宴（project-thread-p209r0）：她照樣待在滄月闕，沒有另外的階段
moring.pop('stages', None)
kara['stages'] = [
    {"requires": {"flags": ["rite_kara_wins"]}, "location": "stilltide_oasis", "haunts": [H("stilltide_oasis", "town", 3), H("sunscorch", "town", 1)],
     "background": "荒野部落聯盟的大祭禮，第一位出身赤鬃的大祭禮。推舉大典上，祖靈把月光放在了她的頭上；娜伊薇親手替她披上了祭袍。",
     "personality": "勇猛、直率、好勝；當了大祭禮之後還是用拳頭解決問題，只是會先聽完祖靈說的話——雖然她說祖靈很吵。"},
]
naivee['stages'] = [
    {"requires": {"flags": ["rite_kara_wins"]}, "location": "stilltide_oasis", "haunts": [H("stilltide_oasis", "town", 3)],
     "background": "前任大祭禮，出身月尾部落。她在推舉大典上把祭袍交給了赤鬃的卡菈，現在在靜潮綠洲教年輕的占卜師看泉水。",
     "personality": "沉靜、溫柔、說話很慢；放下大祭禮的重量之後，第一次在泉水裡看清了自己的未來。"},
]
talo['stages'] = [
    {"requires": {"flags": ["rite_talo"]}, "location": "sunscorch", "haunts": talo['haunts'],
     "background": "赤鬃的獵手，族長卡菈的兒子。他在部族競技上獵下了雷角犀，成了第一個代表赤鬃說話的男人。",
     "personality": "衝動、熱血；證明了自己之後還是想出頭，但現在會先問母親怎麼想。"},
]
# ---- 第十五批 ----
lucia, cass, rona, lana, noel, zero, karen = by['npc_lucia'], by['npc_cassandra'], by['npc_rona'], by['npc_lana'], by['npc_noel'], by['npc_zero'], by['npc_karen']
lucia['stages'] = [
    {"requires": {"flags": ["luc_lover"]}, "location": lucia['location'], "haunts": lucia['haunts'],
     "background": "赤翼宮廷魅魔學院最遲畢業的學生：考了八次，最後一次的考題「讓一個人類心甘情願地愛上妳」，她是倒過來答對的——先愛上的是她自己。畢業證書有一半是主角的。",
     "personality": "純情、容易害羞，一被誇就整個人冒煙；畢業之後魅惑術還是會在最後一刻失敗，只是現在她不在乎了。"},
]
cass['stages'] = [
    {"requires": {"flags": ["cas_lover", "cas_collared"]}, "location": cass['location'], "haunts": cass['haunts'],
     "background": "人類，曾是被賣到荒原的奴隸，現在是夜宴館「黑薔薇」的主人。她把十二年前的項圈交給了一個人，那個人替她重新戴上——現在它提醒她，是為了誰而跪。",
     "personality": "高冷、優雅、強勢，在黑薔薇裡依然是沒有人敢不聽的女王；只在一個人面前，心甘情願地低下頭。"},
    {"requires": {"flags": ["cas_lover", "cas_free"]}, "location": cass['location'], "haunts": cass['haunts'],
     "background": "人類，曾是被賣到荒原的奴隸，現在是夜宴館「黑薔薇」的主人。她戴了十二年的項圈被丟進了壁爐，奴隸商薩洛克再也沒有出現在血羽城堡。",
     "personality": "高冷、優雅、強勢；脖子空了之後，笑的次數多了，鞭子拿得少了——至少在一個人面前是這樣。"},
]
for _tw in (rona, lana):
    _tw['stages'] = [
        {"requires": {"flags": ["twin_lovers"]}, "location": _tw['location'], "haunts": _tw['haunts'],
         "background": _tw['background'].replace("姊妹倆從小就有個約定：要嫁，就嫁給同一個人。", "") + "姊妹倆從小的約定實現了：她們嫁給了同一個人。" if "約定" in _tw['background'] else _tw['background'] + "雙子從小的約定實現了：要嫁，就嫁給同一個人——她們找到了。",
         "personality": _tw['personality']},
    ]
noel['stages'] = [
    {"requires": {"flags": ["noel_lover"]}, "location": noel['location'], "haunts": noel['haunts'],
     "background": "愛穿裙子的夢魔，被同族笑稱「赤翼宮廷最可愛的魅魔」。夢魔氏族派人來帶他回去重新教育，他拒絕了，留在血羽市集的香水店——有一瓶叫「初戀」的香水，只賣給一個人。",
     "personality": "嬌媚、愛撒嬌、愛捉弄人；捉弄著捉弄著就認真了，現在只在一個人面前露出那副可憐兮兮的表情。"},
]
zero['stages'] = [
    {"requires": {"flags": ["zero_lover", "zero_legacy"]}, "location": zero['location'], "haunts": zero['haunts'],
     "background": "千爐工坊的試作機偶，伊格妮絲做給自己當助手的「民用型」。軍方的回收令撤銷了；她的「喜歡」研究寫進了千爐新一代耕作機偶的核心——每一具都能學會喜歡。研究的結論，是一個人類。",
     "personality": "平靜、誠實，說話像在報告數據；研究完成之後還是會一本正經地問問題，只是現在問的多半是「今晚要測試哪一項」。"},
    {"requires": {"flags": ["zero_lover"]}, "location": zero['location'], "haunts": zero['haunts'],
     "background": "千爐工坊的試作機偶，伊格妮絲做給自己當助手的「民用型」。軍方的回收令撤銷了，她不必再躲在機偶校場；她花了三年研究「喜歡」是什麼，結論是一個人類。",
     "personality": "平靜、誠實，說話像在報告數據；研究完成之後還是會一本正經地問問題，只是現在問的多半是「今晚要測試哪一項」。"},
]
karen['stages'] = [
    {"requires": {"flags": ["kar_lover"]}, "location": karen['location'], "haunts": karen['haunts'],
     "background": "機偶校場從前的常勝冠軍。「鐵顎」格倫的假比賽被揭穿之後，她只為自己打；校場大賽的決賽上，她第一次輸了——誰打倒她，她就是誰的。",
     "personality": "豪爽、好鬥、強勢，輸了就認輸；認輸之後就黏著打贏她的人不放，每天都要再比一次。"},
]
# ---- 第十六批 ----
oboro, belvia, eileen, pururu, ilania, mimi = by['npc_oboro'], by['npc_belvia'], by['npc_eileen'], by['npc_pururu'], by['npc_ilania'], by['npc_mimi']
oboro['stages'] = [
    {"requires": {"flags": ["oboro_lover", "oboro_unmasked"]}, "location": oboro['location'], "haunts": oboro['haunts'],
     "background": "冬璃宮的隱密。她奉命監視一個陸地冒險者，報告越寫越像情書；璃月給了她新的任務——繼續監視那個人，直到她看膩為止。她在主角面前摘下了面巾，說不想當影子了，想當朧。",
     "personality": "寡言、一板一眼，依然藏不住情緒；摘下面巾之後臉紅得更明顯了，只是不再說「請當作沒看見」。"},
    {"requires": {"flags": ["oboro_lover"]}, "location": oboro['location'], "haunts": oboro['haunts'],
     "background": "冬璃宮的隱密。她奉命監視一個陸地冒險者，報告越寫越像情書；璃月給了她新的任務——繼續監視那個人，直到她看膩為止。她說不會看膩。",
     "personality": "冷淡、寡言、一板一眼，自稱影子不需要感情，卻完全藏不住；現在不躲在屋頂上了，走在那個人旁邊半步遠的地方。"},
]
belvia['stages'] = [
    {"requires": {"flags": ["belv_lover"]}, "location": belvia['location'], "haunts": belvia['haunts'],
     "background": "二十四歲的貓魅族武僧。曾被烙印幫抓去當了一年的玩物；後來她在沙漠南邊的廢墟裡，親手打倒了烙印幫的頭子札卡。身體沒有忘記那一年，可是她說沒關係了——以前是他們選她，這一次是她自己選的。",
     "personality": "傲嬌、任性，嘴巴比拳頭還快，說「才不是為了你」的次數還是比謝謝多；不再找比自己強的人打架，也不再喝到爛醉。"},
]
eileen['stages'] = [
    {"requires": {"flags": ["eil_lover"]}, "location": eileen['location'], "haunts": eileen['haunts'],
     "background": "百年前死在婚禮前夜的人類新娘。她的未婚夫艾德蒙為了追捕闖進她家的盜賊而死，至死握著她的戒指。一百年後，她在夢裡和一個看得見她的人完成了那場婚禮，婚紗上的撕裂不見了——她沒有消失，因為還有想和那個人一起做的事。",
     "personality": "愛撒嬌、話很多，好不容易遇到看得見她的人就黏著不放；常常忘記自己已經死了，現在連夢裡也黏著。"},
]
pururu['stages'] = [
    {"requires": {"flags": ["pru_lover"]}, "location": pururu['location'], "haunts": pururu['haunts'],
     "background": "腐沼村變異藥沼裡誕生的史萊姆，莫格婆婆把她當孫女養大。她學會了人類的戀愛，用沼珠磨了一枚戒指，辦了腐沼村的第一場婚禮——婆婆存了二十年的嫁妝，是從小到大二十件洋裝。",
     "personality": "天然、好奇、什麼都想學，現在最想學的是新婚夫妻會做的事；開心的時候整個人變成粉紅色，最近一直是粉紅色。"},
]
ilania['stages'] = [
    {"requires": {"flags": ["ila_lover"]}, "location": ilania['location'], "haunts": ilania['haunts'],
     "background": "苔語村的草藥師，三百多歲的精靈。百年一次的月華期，她一直以為是感冒；在森語之環度過最後一夜之後，她發現月華期過去了，心跳還是一樣快。村裡的長老們鬆了一口氣。",
     "personality": "天然、溫柔、慢半拍，還是把比她年輕的人都當孩子疼——只有一個人例外。"},
]
mimi['stages'] = [
    {"requires": {"flags": ["mimi_cafe"]}, "location": mimi['location'], "haunts": [H("dawnlight", "town", 1), H("dawnlight", "noble", 0.2)],
     "background": "從沙痕部落出來打工的貓魅族女孩。她在日輪廣場邊上開了一間「大家的紅茶」，一杯只要一個銅幣，茶葉是部落的大家種的；茶商公會的傭兵燒不掉它，開張那天門口排了長長的隊。第一個客人，是她喜歡的人。",
     "personality": "元氣、冒失、愛撒嬌，句尾老是帶著「喵」；泡茶的時候專心得像在打仗，泡完了就恢復原狀，打翻的杯子還是比端出去的多。"},
]
# ---- 第十七批 ----
stella, noir, pom, marg, liese, clara = by['npc_stella'], by['npc_noir'], by['npc_pom'], by['npc_margarete'], by['npc_lieselotte'], by['npc_clara']
stella['stages'] = [
    {"requires": {"flags": ["stella_lover"]}, "location": stella['location'], "haunts": stella['haunts'],
     "background": "偶像團體「星屑三重奏」的隊長兼中心。她在河谷鎮第一場正式的大演唱會上，最後一首歌之前，對台下第一排正中間的人告白了——那個在雨天的路口，唯一一個替她鼓掌的人。",
     "personality": "元氣滿滿、正向到刺眼，口頭禪是「大家的笑容就是我的力量！」；還是路癡兼吃貨，只是現在散場之後，會理直氣壯地撒嬌。"},
]
noir['stages'] = [
    {"requires": {"flags": ["noir_lover"]}, "location": noir['location'], "haunts": noir['haunts'],
     "background": "星屑三重奏的作曲兼魯特琴手。舊的魯特琴寫了三年給史黛拉的歌，被跟蹤狂做成了詛咒的魔像；她用一首新歌洗掉了詛咒——那首歌，用一個人類的名字取名。新的魯特琴，她說要寫歌給那個人。",
     "personality": "冷酷、寡言、毒舌，台上從不笑；私下還是最黏人的那個，被問到歌是寫給誰的，就會把枕頭丟過去。"},
]
pom['stages'] = [
    {"requires": {"flags": ["pom_lover"]}, "location": pom['location'], "haunts": pom['haunts'],
     "background": "星屑三重奏的舞蹈擔當兼經紀人，管著團裡所有的錢與合約，從來沒有給自己分過一枚銅幣。她替團員撕掉了黑心劇場的合約、從綁匪手上救回了她們，然後為自己簽了第一份合約：護衛合約，永久有效。",
     "personality": "甜美、愛撒嬌、看起來天然呆，其實腹黑又精明；現在帳本上多了一欄，記著每天的「利息」。"},
]
marg['stages'] = [
    {"requires": {"flags": ["marg_lover", "marg_open"]}, "location": marg['location'], "haunts": marg['haunts'],
     "background": "艾森伯爵的續弦，帝都最有名的沙龍女主人。她把十五年沒寄出的情書燒了，在皇宮的化裝舞會上摘下面具，和一個冒險者跳了一整晚的舞——整個帝都都知道了，她一點也不在乎。",
     "personality": "優雅、端莊，說話帶著上流社會的從容；倦意不見了，現在換貴族們在她的沙龍上提心吊膽。"},
    {"requires": {"flags": ["marg_lover"]}, "location": marg['location'], "haunts": marg['haunts'],
     "background": "艾森伯爵的續弦，帝都最有名的沙龍女主人。貴族們都說她是帝國最完美的夫人；只有一個冒險者知道，化裝舞會散場之後，她在皇宮花園的亭子裡是什麼樣子。",
     "personality": "優雅、端莊，嚴守禮節——在人前。沙龍散場後的夜晚，不再那麼長了。"},
]
liese['stages'] = [
    {"requires": {"flags": ["liese_lover", "liese_honest"]}, "location": liese['location'], "haunts": liese['haunts'],
     "background": "萊茵堡下城區「麥穗麵包店」的老闆娘。她寫信給南境前線的丈夫說了實話，丈夫回信說：妳要幸福。她還是每週寄一籃麵包到前線，只是現在，每天早上第一爐的麵包，是留給另一個人的。",
     "personality": "開朗、健談、力氣很大，笑聲整條街都聽得見；不再說「沒關係」了，想要什麼就直接說。"},
    {"requires": {"flags": ["liese_lover"]}, "location": liese['location'], "haunts": liese['haunts'],
     "background": "萊茵堡下城區「麥穗麵包店」的老闆娘。丈夫是第三軍團的士兵，駐守南境前線；她還愛著他，也不再一個人度過每一個夜晚。收穫節的第一爐麵包是心形的——她說是不小心的。",
     "personality": "開朗、健談、力氣很大，笑聲整條街都聽得見；夜裡在烤爐邊，偶爾會笑得很小聲。"},
]
clara['stages'] = [
    {"requires": {"flags": ["clara_lover"]}, "location": clara['location'], "haunts": clara['haunts'],
     "background": "帝國法師學院圖書館的管理員，也是帝都最受歡迎的禁書作家「紫丁香」。教廷審問她的那天，院長塞拉菲娜宣布紫丁香的小說是學院的文學研究資料；丈夫搬去了研究室，留下一張紙條。她的下一卷，要寫一個幸福的故事。",
     "personality": "文靜、知性、說話輕柔，還是躲在書後面；摘下眼鏡之後像是換了一個人——現在只在一個人面前摘。"},
]
# ---- 第十八批 ----
isab, brun, kara_r, ren, mat = by['npc_isabella_rowan'], by['npc_brunhild'], by['npc_kara_redmane'], by['npc_ren'], by['npc_matilda_rosen']
isab['stages'] = [
    {"requires": {"flags": ["isab_lover"]}, "location": isab['location'], "haunts": isab['haunts'],
     "background": "聖殿騎士團長，平民出身，靠戰功升上團長，替部下擋審判廷的公文。她這輩子沒想過嫁人——直到一個陪她喝酒、砍盜匪、替別人擋的冒險者，在最後一個賭局裡成了她的賭注。",
     "personality": "豪爽直率、愛喝酒、愛打賭，覺得審判廷管太多；現在每天晚上多喝一杯，是跟一個人一起喝的。"},
]
brun['stages'] = [
    {"requires": {"flags": ["brun_lover"]}, "location": brun['location'], "haunts": brun['haunts'],
     "background": "人稱「霜盾」，第一軍團將軍，鎮守帝國北境。部下說她一年講的話不超過一百句；在北境的雪坡上，她把其中一句留給了一個冒險者。她現在會自己烤蘋果派，烤兩個人份的。",
     "personality": "沉默、怕生，被人盯著看就會臉紅，上了戰場卻冷靜得像北境的冰；只有在一個人面前，會蹲下來，和對方一樣高。"},
]
# 卡菈：大祭禮的階段在前（推舉大典之後她住在靜潮綠洲），戀人的背景接在後面
_kara_wins = kara_r['stages'][0]
kara_r['stages'] = [
    dict(_kara_wins, requires={"flags": ["rite_kara_wins", "kara_lover"]},
         background=_kara_wins['background'] + "她和一個外地人立下了赤鬃最古老的鬃毛之誓——祭風原的祖靈們好像也在祝福，雖然她說祖靈很吵。"),
    _kara_wins,
    {"requires": {"flags": ["kara_lover"]}, "location": "sunscorch", "haunts": [H("sunscorch", "town", 3)],
     "background": "赤鬃族長，聯盟最強的戰士。她和一個外地人一起獵下了風暴巨鵬，把彼此的鬃毛編在一起，立下了赤鬃最古老的鬃毛之誓——赤鬃有史以來，第一次有人跟族長打成平手。",
     "personality": "勇猛、直率、好勝，只用拳頭；被說好看的時候會揮拳，揮得很輕。"},
]
ren['stages'] = [
    {"requires": {"flags": ["ren_lover"]}, "location": ren['location'], "haunts": ren['haunts'],
     "background": "夏瀾殿的玉璘族，為了看看陸地人怎麼生活而上岸打工的女僕。潮祭之夜，她帶著一個陸地人回到了海底的夏瀾殿——海認得那個人了。現在她說，陸地和海，都是家。",
     "personality": "天然、溫吞、愛發呆，家事做得慢得驚人卻非常仔細；最喜歡替人洗澡，現在只替一個人洗。"},
]
_mat_old = mat['stages']
mat['stages'] = [
    dict(_mat_old[0], requires={"flags": ["cw_matilda", "mat_lover"]},
         background=_mat_old[0]['background'] + "她簽過幾百份埋著陷阱的契約，只有一份沒有：「甲方喜歡乙方。」乙方簽了名，還加了一條。",
         personality="笑容甜美、說話天真，其實精明狠辣，現在是議會裡最有權勢的人；只對一個人不說謊——契約上寫的。"),
    {"requires": {"flags": ["mat_lover"]}, "location": mat['location'], "haunts": mat['haunts'],
     "background": "七議席議會的議員，壟斷聯邦的人力。她簽過幾百份埋著陷阱的契約，只有一份沒有：「甲方喜歡乙方。」乙方簽了名，還加了一條。",
     "personality": "笑容甜美、說話天真，其實精明狠辣；只對一個人不說謊——契約上寫的。"},
] + _mat_old
# ---- 第十九批 ----
# 伊瑟蘭迪爾、莉莎爾、櫻汐待在地標裡，加上階段會讓她們離開地標，所以不加
ana, ele = by['npc_anastasia'], by['npc_eleanora_rhine']
_ana_queen, _ana_king = ana['stages']
ana['stages'] = [
    dict(_ana_queen, requires={"flags": ["dthr_queen", "ana_lover"]},
         personality="加冕之後，嬌小的身軀多了女王的威儀，手段比從前更老辣，也更謹慎；她說王國歸她，她歸一個冒險者。深夜換上便服溜出城的時候，身邊總有一個人。"),
    dict(_ana_king, requires={"flags": ["dthr_king", "ana_lover"]},
         personality="嬌小可人又優雅得體，政治手腕依然老辣；這輩子只有一個人她從來沒有算計過。往返教國的路上，她會戴上一頂冒險者的寬簷帽。"),
    _ana_queen, _ana_king,
    {"requires": {"flags": ["ana_lover"]}, "location": ana['location'], "haunts": ana['haunts'],
     "personality": "嬌小可人又優雅得體，必要時莊嚴華貴、不怒自威，政治手腕越來越老辣；這輩子只有一個人她從來沒有算計過。王座和道路，她說不用選——都一起。"},
]
ele['stages'] = [
    {"requires": {"flags": ["ele_lover"]}, "location": ele['location'], "haunts": ele['haunts'],
     "personality": "冷靜、一絲不苟，說話永遠留三分；替父親寫了三十年的敕令，只為自己寫過一道——命令一個人留在她身邊。現在會按時吃午餐了，因為有人盯著。"},
]
# 特殊任務需要的固定 NPC 一律不能被攻擊（被殺掉的話任務線就斷了）
import json as _json
_st = _json.load(open('data/rules/stories.json'))['stories']
_need = set()
for _s in _st:
    if _s['start'].get('npc'): _need.add(_s['start']['npc'])
    for _n in _s['nodes']:
        if _n.get('at', {}).get('npc'): _need.add(_n['at']['npc'])
        _need.update(_n.get('allies', []))
        for _o in [_n.get('success'), _n.get('fail')] + [x for o in _n.get('options', []) for x in (o.get('success'), o.get('fail'))]:
            if _o and _o.get('join'): _need.add(_o['join'])
for _i in sorted(_need):
    by[_i]['no_attack'] = True
print('no_attack', sorted(_need))
write(P, base, L)
print('ok')
