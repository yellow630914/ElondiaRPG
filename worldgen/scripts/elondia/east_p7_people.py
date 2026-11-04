"""炎華之地 P7：炎華北原的 18 位固定 NPC、7 個地標、2 張特殊地圖（EAST_CONTENT_PLAN 11.7、11.8 節）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p7_people.py（可以重跑）
- NPC 寫進 data/world/npcs.json（npc_td_ 開頭，一行一位）；和南域人物的關係，南域那一邊寫在 east_p3_npcs.py 的 RELATIONS
- 地標寫進 data/world/landmarks.json（lm_td_ 開頭）、特殊地圖寫進 special_maps.json（sm_td_ 開頭）、受訓的地標加到 perks.json
- 世界書「人物-炎华北原」
"""

import json
import re

from east_p3_npcs import adv, com, town

PATH = 'data/world/npcs.json'
TD = 'tidan_khanate'

NPCS = [
    # ================= 金帳王庭 =================
    adv('npc_td_ulantuya', '烏蘭圖雅', 'female', 'centaur', 'fighter', 17, 'jinzhang', hireable=False, no_attack=True, no_steal=True,
        tags=['royal'], faction=TD, lineage='蒼狼部', landmark='lm_td_golden_tent',
        personality='豪邁、冷酷、愛才如命，笑起來像在下戰書；說到做到，殺人也是；最討厭別人只跟她要歲幣，不跟她談天下。',
        appearance='四十歲的天可汗，人身高大健美，一頭灰白相間的長髮編成粗辮垂在背後，臉上有一道舊箭疤；腰下是一副灰褐狼毛色的馬身，結實得像山。穿著織金的皮袍，腰懸一把彎刀，眼睛是草原上最亮的星。',
        background='十年前統一草原各部的天可汗，頒布「大法典」、廣設驛站、重用有才的人、不問信仰。她把最後一位對手的名字從所有的歌裡抹掉，也把南北兩院分給兩種人去管。大燁每年送來歲幣，她每年收下，卻越來越常望著南方。'),
    adv('npc_td_chalan', '察蘭', 'female', 'centaur', 'ranger', 10, 'jinzhang', hireable=False, no_attack=True,
        tags=['royal'], faction=TD, lineage='蒼狼部', haunts=town('jinzhang', 1, outskirts=0.3),
        personality='驕傲、急躁、不服輸，說話直得像箭；最恨別人叫她「天可汗的女兒」，偏偏每個人都這樣叫。',
        appearance='二十歲的少主，短髮剪到耳下，人身修長結實，看起來像個英氣的少年；腰下是一副灰色的馬身，四條腿長得出奇。穿著輕便的皮甲，背著一張角弓，手腕上纏著母親給的狼牙。',
        background='天可汗唯一的女兒，騎射是全王庭最好的，可是每一次贏，都有人說「因為她是少主」。她想做一件母親沒做過的事，讓所有人記住她的名字，而不是她母親的。'),
    adv('npc_td_qiqige', '其其格', 'female', 'centaur', 'cleric', 11, 'jinzhang', hireable=False, no_attack=True,
        tags=['priest'], faction=TD, lineage='媞丹部', landmark='lm_td_ovoo',
        personality='沉靜、冷淡、說話慢得像在讀骨紋；看得見別人看不見的東西，也說別人不想聽的話。',
        appearance='三十歲的大巫，人身纖瘦，白皙的臉上畫著藍色的紋，長髮上綴滿銅鈴與骨片；腰下是一副雪白的馬身，鬃毛一路長到背上。穿著綴滿流蘇的巫袍，手裡總拿著一塊燒過的羊肩胛骨。',
        background='媞丹的國師，大巫「渥都干」。她讀羊肩胛骨與天象，不附身、不請神，只說看到的。天可汗每次出征前都要她占卜，可是最近三次，骨頭上的裂紋都指向同一個方向——南方，而且是凶。'),
    adv('npc_td_amur', '阿穆爾', 'male', 'centaur', 'wizard', 12, 'jinzhang', hireable=False, no_attack=True, no_steal=True,
        tags=['noble'], faction=TD, lineage='媞丹部', landmark='lm_td_south_court',
        personality='溫和、謹慎、懂禮，說話引經據典，說的是大燁的經；相信和平比戰爭划算，也相信草原總有一天要學會寫字。',
        appearance='四十五歲的南院大王，人身清瘦，鬍鬚修得整齊，頭戴大燁式樣的幞頭；腰下是一副栗色的馬身，馬衣上繡著大燁的雲紋。說話時習慣撫著腰間的玉佩。',
        background='南院大王，照大燁的禮制管榷場與歸附的城寨，北院的人罵他是「半個龍人」。他娶了大燁送來和親的宗室女燁婉寧當可敦，相敬如賓；他說，只要榷場的茶與馬還在交換，草原與大燁就不會打起來。'),
    adv('npc_td_tieya', '鐵牙', 'male', 'centaur', 'barbarian', 13, 'jinzhang', hireable=False, no_attack=True,
        tags=['noble'], faction=TD, lineage='蒼狼部',
        haunts=[{'location': 'jinzhang', 'zone': 'palace', 'weight': 1}, {'location': 'jinzhang', 'zone': 'noble', 'weight': 0.6}],
        personality='粗獷、好戰、忠誠，笑聲像打雷；看不起歲幣，說那是「龍人的施捨」；對天可汗忠心耿耿，對南院大王恨得牙癢。',
        appearance='五十歲的怯薛長，人身魁梧得像一堵牆，滿臉橫肉，一口鑲了鐵的牙；腰下是一副漆黑的馬身，比一般人馬族大一圈。穿著鐵甲，背著一把雙手的大斧。',
        background='天可汗的親衛隊長，北院的主戰派。統一戰爭時他替天可汗擋過三支箭，鐵牙就是那時候換的。他說草原的馬養得夠肥了，該去南方吃草了；南院大王說他是瘋子，他說南院大王是龍人的狗。'),
    com('npc_td_wanning', '燁婉寧', 'female', 'hualong', 8, 'jinzhang', '可敦', adult=True, no_attack=True, no_steal=True, tags=['royal'],
        faction='yanye_court', lineage='天青鱗', landmark='lm_td_south_court',
        personality='端莊、安靜、禮數周全，說話輕聲細語；在人前是無可挑剔的可敦，夜裡卻常一個人站在帳外，看著馬群發呆。',
        appearance='二十五歲的和親公主，身材嬌小，一對細長的天青色龍角上戴著媞丹的銀冠，頸側的天青細鱗白得像瓷；穿著大燁的宮裝外罩媞丹的皮袍，兩種衣服在她身上穿得一樣端正。',
        adult_appearance='宮裝底下是纖細白皙的身子，B 罩杯，腰極細；天青的細鱗從後頸沿著脊背一路往下。她從不說出口：草原上那些高大的雄性人馬族的身體，是她每晚都會想起的東西。',
        background='大燁的宗室女、女帝燁昭華的遠房妹妹，三年前被送來和親，嫁給南院大王阿穆爾當可敦。夫婦相敬如賓，從未同帳；她說是因為體型不合，私底下卻常常去看那達慕的摔跤，看得臉紅。'),
    adv('npc_td_urina', '烏日娜', 'female', 'centaur', 'ranger', 9, 'jinzhang', hireable=False, adult=True, lineage='蒼狼部',
        haunts=town('jinzhang', 1, outskirts=0.5),
        personality='狂野、自信、愛逗人，說話像在挑釁；喜歡一切桀驁不馴的東西，馬也好、人也好，越難馴越有意思。',
        appearance='二十八歲的馴馬師，人身高挑結實，古銅色的皮膚上有幾道被馬踢出來的疤，黑髮剪得很短；腰下是一副油亮的黑色馬身，肌肉線條分明。穿著敞開的皮坎肩，腰上掛著一捆馬鞭與套索。',
        adult_appearance='敞開的皮坎肩下是飽滿結實的胸，D 罩杯，腹肌分明；她說馴馬和馴人是一樣的道理：先讓對方騎上來，再讓對方知道誰才是騎的那一個。',
        background='王庭最好的馴馬師，草原上最烈的馬都是她馴的。她說每匹馬都想騎在人頭上，人也一樣；她最喜歡的遊戲是讓別人以為自己在騎她，最後才發現被騎的是自己。'),
    com('npc_td_su_shiyong', '蘇時雍', 'male', 'hualong', 7, 'jinzhang', '歲幣使節', tags=['noble'], faction='yanye_court', lineage='天青鱗',
        haunts=[{'location': 'jinzhang', 'zone': 'noble', 'weight': 1}, {'location': 'jinzhang', 'zone': 'town', 'weight': 0.5}],
        personality='拘謹、多疑、凡事照規矩，說話滴水不漏；在草原上住了三年，還是不肯喝馬奶酒。',
        appearance='四十歲的化龍族使節，清瘦，一對天青色的短角，鬍子修得一絲不苟；穿著大燁的綠色公服，外面裹著一件不合身的羊皮襖，手裡總捧著一個暖爐。',
        background='大燁派駐金帳王庭的歲幣使節，每年點交絹、茶、銀。他是宰相溫世衡的人，每個月寫一封信回龍安府，信裡寫的不只是歲幣。'),
    adv('npc_td_batur', '巴特爾', 'male', 'centaur', 'fighter', 8, 'jinzhang', tags=['good'], lineage='蒼狼部', landmark='lm_td_naadam',
        personality='憨直、豪爽、輸了就笑，贏了也笑；把每一個打倒他的人都當成兄弟，請喝酒請到對方醉倒。',
        appearance='三十歲的摔跤冠軍，人身寬得像兩個人，脖子比別人的腿還粗，剃了光頭；腰下是一副栗色的馬身，四條腿像柱子。穿著摔跤的坎肩與綴滿銀釘的皮褲，脖子上掛著三屆那達慕的彩帶。',
        background='那達慕連續三年的摔跤冠軍，草原上沒有人能把他摔倒。他說自己最想要的不是第四條彩帶，而是有一個人能把他摔倒，這樣他就能跟那個人去看看南方。'),
    com('npc_td_old_groom', '老馬倌', 'male', 'centaur', 4, 'jinzhang', '馬倌', tags=['commoner', 'good'], lineage='媞丹部',
        haunts=town('jinzhang', 1, outskirts=0.5),
        personality='嘮叨、念舊、愛喝酒，講起古戰場的事就停不下來；誰請他喝一碗，他就把統一戰爭講一遍。',
        appearance='七十歲的老馬倌，人身佝僂，白鬍子垂到胸口，一隻眼睛瞎了；腰下是一副瘦骨嶙峋的花斑馬身，走起路來一拐一拐。手裡總拿著一支馬頭琴的琴弓，雖然他早就沒有琴了。',
        background='統一戰爭時替兩邊都養過馬的老馬倌。他說他還記得那位被抹去名字的可汗叫什麼，只是不敢說；鳴鏑古戰場夜裡的號角聲，他說是那位可汗的軍隊在等命令。'),
    # ================= 鷹河榷場 =================
    adv('npc_td_hailan', '海蘭', 'female', 'centaur', 'ranger', 11, 'yinghe', hireable=False, no_attack=True, tags=['good'], lineage='海東部',
        landmark='lm_td_falconry',
        personality='沉默、記仇、心思深，說一句話之前先想三遍；對族人極好，對媞丹的官吏從不笑。',
        appearance='三十二歲的海東部首領，短髮，人身精瘦結實，看起來像個冷峻的青年；腰下是一副青灰色的馬身。左肩上永遠停著一隻白色的海東青，穿著舊的皮袍，領口綴著一顆北珠。',
        background='海東部的首領，草原上最好的鷹獵手。天可汗統一草原時，海東部是最後投降的；從此每年要進貢最好的海東青與北珠。她暗中派人去過龍安府，沒有人知道她帶去的信寫了什麼。'),
    com('npc_td_toya', '托雅', 'female', 'centaur', 6, 'yinghe', '馴鷹人', tags=['commoner', 'good'], lineage='海東部', landmark='lm_td_falconry',
        personality='溫柔、害羞、跟鷹說話比跟人說話多；捨不得任何一隻她養大的鳥，送走的時候會哭一整夜。',
        appearance='二十歲的馴鷹人，人身嬌小，臉上有幾顆雀斑，長髮編成兩條辮子；腰下是一副白色帶淺斑的馬身。手上戴著厚厚的皮護手，上面總停著一隻小鷹。',
        background='鷹房裡最會養鷹的人。今年她養出了一隻全白的海東青，族裡說這是十年來最好的一隻——所以要送去金帳進貢。她給牠取名叫「雪」，每天晚上都偷偷去看牠。'),
    com('npc_td_sarilang', '薩日朗', 'female', 'centaur', 8, 'yinghe', '牧女', adult=True, tags=['commoner'], lineage='媞丹部',
        haunts=town('yinghe', 1, outskirts=0.6),
        personality='爽朗、熱情、毫不害臊，說起放牧與配種的事像在說天氣；平時好相處，一到春天就變得誰也應付不了。',
        appearance='二十六歲的牧女，人身豐滿健康，臉頰曬得紅撲撲的，栗色的長髮隨意紮著；腰下是一副栗色的牝馬身，臀部渾圓。穿著寬鬆的牧袍，腰上掛著套馬杆與一袋鹽。',
        adult_appearance='牧袍底下是豐腴溫熱的身子，E 罩杯；每年春天牝馬發情的季節，她的身子也跟著發熱，尾巴翹得高高的，看誰的眼神都濕漉漉的。',
        background='鷹河榷場一帶最好的牧女，替各家放馬、接生、配種。她說馬和人馬都一樣，春天就是春天，沒什麼好害臊的；榷場的男人們一到春天就躲著她走，又忍不住回頭看。'),
    com('npc_td_wole', '斡勒', 'male', 'centaur', 8, 'yinghe', '榷場監官', tags=['noble'], faction=TD, lineage='媞丹部', landmark='lm_td_tea_horse',
        personality='貪婪、精明、笑臉迎人，每一筆交易都要抽一份；對上恭敬，對下刻薄。',
        appearance='四十歲的監官，人身肥胖，留著兩撇油亮的小鬍子，頭戴南院的官帽；腰下是一副圓滾滾的白馬身。腰上掛著一串算籌與一個鼓鼓的錢袋。',
        background='南院派駐鷹河榷場的監官，管茶馬互市的抽成。他抽得比規定的多三成，多的那一份一半送到南院，一半送進自己的帳篷；他知道陳茶商在走私戰馬，所以陳茶商每個月多送他一份。'),
    com('npc_td_chen', '陳茶商', 'male', 'hualong', 6, 'yinghe', '茶商', tags=['merchant'], faction='yanye_court', lineage='金黃鱗', landmark='lm_td_tea_horse',
        personality='圓滑、膽大、見錢眼開，說話像在算帳；表面是本分的茶商，骨子裡是賭徒。',
        appearance='四十五歲的化龍族茶商，金黃色的龍角上套著金環，身材矮胖，一雙小眼睛總在打量別人值多少錢；穿著絲綢的長袍外面裹著貂皮，手指上戴滿戒指。',
        background='在鷹河榷場做了二十年茶馬生意的大燁茶商。茶磚換馬是明面上的生意；暗地裡，他把禁止出境的戰馬一匹一匹地運回大燁，賣給想要騎兵的人——買主是誰，他從不說。'),
    com('npc_td_hu_zhanggui', '胡掌櫃', 'male', 'linghu', 6, 'yinghe', '胡記分號掌櫃', tags=['merchant'], faction='yanye_court', lineage='胡記商幫',
        haunts=town('yinghe', 1),
        personality='和氣、謹慎、記性極好，誰欠了多少帳一筆都忘不了；對本家的胡九娘又敬又怕。',
        appearance='五十歲的靈狐族掌櫃，一對灰色的狐耳，身後兩條蓬鬆的灰尾，戴著一副圓眼鏡；穿著大燁的長衫，外面套著草原的羊皮坎肩，手裡總拿著一把算盤。',
        background='胡記商幫在鷹河榷場的分號掌櫃，賣茶、鹽與香料給草原的人。他每個月給瑔州港的本家寄一封帳，帳上寫的是茶，信裡寫的是榷場的消息。'),
    adv('npc_td_heizong', '黑鬃', 'male', 'centaur', 'rogue', 9, 'yinghe', hireable=False, tags=['villain'], lineage='媞丹部',
        haunts=[{'location': 'yinghe', 'zone': 'outskirts', 'weight': 1}, {'location': 'yinghe', 'zone': 'town', 'weight': 0.3}],
        personality='兇狠、狡猾、講義氣，只對自己人；搶劫從不留活口，分贓卻從不少給兄弟一分。',
        appearance='三十五歲的馬賊頭目，人身精壯，滿臉絡腮鬍，一道刀疤從額頭劃過右眼；腰下是一副油亮的黑馬身，鬃毛長得拖到地上。穿著搶來的鐵甲，腰間兩把彎刀。',
        background='茶馬路上最兇的馬賊頭目，沒有部族收留的人都跟著他。他搶大燁的茶隊，也搶媞丹的馬群；只有陳茶商的車隊他從來不碰——因為那些戰馬，是他替陳茶商從牧場上偷出來的。'),
    com('npc_td_post_keeper', '驛站的老闆', 'male', 'centaur', 4, 'yinghe', '驛站老闆', tags=['commoner'], lineage='媞丹部', landmark='lm_td_post_station',
        personality='健談、好奇、什麼都想知道，賣消息比賣酒還勤快；誰都不得罪，誰的消息都賣。',
        appearance='五十歲的驛站老闆，人身矮壯，紅臉膛，頭上纏著一塊褪色的頭巾；腰下是一副短腿的花斑馬身。腰上掛著一大串驛站的銅牌。',
        background='大法典規定每隔一天的路程設一座驛站，他管的是鷹河榷場這一座。持驛牌的信差在這裡換馬，商隊在這裡歇腳，所有的消息都在這裡經過；他說，草原上沒有他不知道的事，只有他不肯說的事。'),
]

RELATIONS = [
    ('npc_td_ulantuya', 'npc_td_chalan', '女兒：期望她接下天下，又嫌她太急。', '母親：天可汗；想超越她，又怕永遠只是她的影子。'),
    ('npc_td_ulantuya', 'npc_td_qiqige', '國師：她的預言從來不好聽，卻從來沒錯過。', '君主：她不愛聽巫的話，卻每次出征前都要聽。'),
    ('npc_td_amur', 'npc_td_tieya', '北院的怯薛長：主戰的瘋子。', '南院大王：龍人的狗。'),
    ('npc_td_amur', 'npc_td_wanning', '可敦：大燁送來和親的宗室女，相敬如賓。', '夫君：南院大王，待自己客氣得像待一位貴客。'),
    ('npc_td_wanning', 'npc_yh_zhaohua', '遠房的姊姊，大燁的女帝：自己是她送來的。', None),
    ('npc_td_hailan', 'npc_td_ulantuya', '征服者：海東部年年進貢的對象。', '海東部的首領：最後投降的部族，眼神從來沒有降過。'),
    ('npc_td_hailan', 'npc_td_toya', '族人：鷹房裡最會養鷹的孩子。', '首領：族裡最敬重的人，也是要把「雪」送走的人。'),
    ('npc_td_chen', 'npc_td_heizong', '走私的夥伴：替自己從牧場上偷戰馬。', '走私的夥伴：給錢最爽快的龍人。'),
    ('npc_td_hu_zhanggui', 'npc_yh_hu_jiuniang', '本家的當家：又敬又怕。', None),
    ('npc_td_su_shiyong', 'npc_yh_wen_shiheng', '宰相：派自己來的人，每個月寫信回去。', None),
    ('npc_td_su_shiyong', 'npc_td_amur', '南院大王：最懂大燁的人，也最難看透。', '歲幣使節：宰相的眼睛。'),
    ('npc_td_batur', 'npc_td_chalan', '少主：唯一一個差點把自己摔倒的人。', '摔跤冠軍：草原上唯一不讓著自己的人。'),
    ('npc_td_wole', 'npc_td_chen', '茶商：每個月多送一份的人。', '監官：每個月要多送一份的人。'),
    ('npc_td_post_keeper', 'npc_td_hailan', '海東部的首領：她的信差從不在驛站換馬。', '驛站的老闆：消息靈通，嘴不夠緊。'),
    ('npc_td_old_groom', 'npc_td_ulantuya', '天可汗：統一戰爭時替她養過馬。', None),
]

INTRO = {
    'npc_td_ulantuya': '天可汗，十年前统一草原各部、颁布大法典的征服者与立法者；豪迈、冷酷、爱才',
    'npc_td_chalan': '天可汗的女儿、少主；骑射王庭第一，想证明自己不只是天可汗的女儿',
    'npc_td_qiqige': '国师，大巫渥都干；读羊肩胛骨占卜，最近三次的骨纹都指向南方，而且是凶',
    'npc_td_amur': '南院大王，主和，懂大烨的礼制，被北院骂成「半个龙人」；娶了和亲的燁婉宁',
    'npc_td_tieya': '怯薛长，北院的主战派，替天可汗挡过三支箭',
    'npc_td_wanning': '大烨送来和亲的宗室女、南院大王的可敦，女帝燁昭华的远房妹妹',
    'npc_td_urina': '王庭最好的驯马师，爱驯马也爱「驯」人',
    'npc_td_su_shiyong': '大烨的岁币使节，宰相温世衡的人',
    'npc_td_batur': '那达慕连续三年的摔跤冠军，可以雇用',
    'npc_td_old_groom': '王庭的老马倌，知道鸣镝古战场的旧事',
    'npc_td_hailan': '海东部的首领，鹰猎的好手，沉默记仇，暗中联络大烨',
    'npc_td_toya': '鹰房的驯鹰人，今年养出的白色海东青要送去进贡',
    'npc_td_sarilang': '榷场一带的牧女，春天牝马发情的季节最难应付',
    'npc_td_wole': '南院派驻鹰河榷场的监官，抽成抽得很凶',
    'npc_td_chen': '大烨的茶商，暗中走私战马',
    'npc_td_hu_zhanggui': '胡记商帮在鹰河榷场的分号掌柜',
    'npc_td_heizong': '茶马路上的马贼头目',
    'npc_td_post_keeper': '鹰河榷场驿站的老板，消息灵通',
}


def cond(c, add=True):
    return {'type': 'condition', 'target': 'pc', 'condition': c, 'add': add}


def memory(s):
    return {'type': 'memory', 'summary': s, 'importance': 1}


LANDMARKS = [
    {'id': 'lm_td_golden_tent', 'name': '金帳', 'emoji': '⛺', 'location': 'jinzhang',
     'at': {'area': 'jinzhang/palace', 'x': 5, 'y': 1}, 'types': ['official', 'monument'],
     'desc': '天可汗的金帳「斡魯朵」：一座能坐下上千人的巨大氈帳，帳頂包著金箔，四面插著九斿白纛。',
     'scene': '金帳前的九斿白纛在風裡獵獵作響，怯薛的親衛一動也不動地站成兩排，帳門的金鈴每響一聲，就有人進去、有人出來。',
     'open': {'official': True},
     'visit': {'title': '看怯薛換崗', 'desc': '在金帳前看親衛換崗，聽號角吹響。', 'hours': 0.5, 'effects': [cond('cheered')]}},
    {'id': 'lm_td_naadam', 'name': '那達慕場', 'emoji': '🤼', 'location': 'jinzhang',
     'at': {'area': 'jinzhang/naadam', 'x': 5, 'y': 3}, 'types': ['military'],
     'desc': '王庭的大校場，摔跤、賽馬、射箭從早比到晚；冠軍巴特爾常在這裡等著有人來挑戰。',
     'scene': '場邊圍滿了喝馬奶酒的看客，摔跤手們拍著大腿入場，遠處的賽道上揚起一長條塵土，箭靶上插滿了羽箭。',
     'visit': {'title': '看一場摔跤', 'desc': '在場邊喝碗馬奶酒，看摔跤手們比試。', 'money_cc': 5, 'hours': 1, 'effects': [cond('cheered')]},
     'explore': {'title': '下場比一場', 'desc': '跟摔跤手過幾招，或者射幾支箭。', 'attr': 'str', 'dc': 14, 'hours': 2,
                 'effects': [{'type': 'xp', 'amount': 35}, memory('在金帳王庭的那達慕場下場比試，和草原的摔跤手過了幾招。')],
                 'critical': [{'type': 'money', 'amount': 40}, {'type': 'reputation', 'faction': 'local', 'delta': 1}]},
     'work': {'attr': 'str', 'dc': 12, 'rate_cc': 4, 'desc': '替那達慕場搬靶、牽馬、平整摔跤的場地。'}},
    {'id': 'lm_td_ovoo', 'name': '敖包', 'emoji': '🪨', 'location': 'jinzhang',
     'at': {'area': 'jinzhang/naadam', 'x': 5, 'y': 1}, 'types': ['holy', 'monument'],
     'desc': '王庭邊上的大敖包，石堆上插滿了經幡與樹枝；國師其其格在這裡祭天、讀羊肩胛骨占卜。',
     'scene': '石堆上繫滿了藍色的哈達，風一吹就獵獵作響；石堆旁的火裡燒著一塊羊肩胛骨，劈啪地裂開。',
     'visit': {'title': '在敖包添一塊石頭', 'desc': '照草原的規矩，繞著敖包走三圈，添一塊石頭祈福。', 'hours': 0.5, 'effects': [cond('blessed')], 'cooldown_days': 3},
     'explore': {'title': '請渥都干讀羊骨', 'desc': '請大巫燒一塊羊肩胛骨，看看骨紋說了什麼。', 'attr': 'fai', 'dc': 13, 'hours': 2,
                 'effects': [{'type': 'xp', 'amount': 30}, memory('在金帳王庭的敖包請渥都干讀了一塊羊肩胛骨。')]}},
    {'id': 'lm_td_south_court', 'name': '南院大帳', 'emoji': '📜', 'location': 'jinzhang',
     'at': {'area': 'jinzhang/nanyuan', 'x': 5, 'y': 5}, 'types': ['official', 'academy'],
     'desc': '南院大王阿穆爾的大帳，照大燁的禮制辦公：帳裡擺著書案與屏風，牆上掛著大燁的字畫；可敦燁婉寧也住在這裡。',
     'scene': '大帳裡飄著墨香，書吏們用大燁的字抄著榷場的帳，屏風後面隱約傳來古琴的聲音。',
     'open': {'official': True},
     'explore': {'title': '在南院旁聽議事', 'desc': '在南院的大帳裡聽官吏們議論榷場與歲幣。', 'attr': 'int', 'dc': 13, 'hours': 2,
                 'effects': [{'type': 'xp', 'amount': 30}, memory('在金帳王庭的南院大帳旁聽了一場關於榷場與歲幣的議事。')]}},
    {'id': 'lm_td_tea_horse', 'name': '茶馬市', 'emoji': '🐴', 'location': 'yinghe',
     'at': {'area': 'yinghe/chama', 'x': 5, 'y': 1}, 'types': ['market'],
     'desc': '鷹河榷場的互市：大燁的茶磚、絲綢與媞丹的馬匹、皮貨在這裡交換，監官斡勒坐在帳下抽成。',
     'scene': '一邊是堆成小山的茶磚與一匹匹的絲綢，一邊是嘶鳴的馬群與一捆捆的皮貨，兩國的商人比手畫腳地討價還價。',
     'visit': {'title': '逛茶馬互市', 'desc': '看看大燁與草原的貨。', 'hours': 1, 'effects': [cond('cheered')]},
     'work': {'attr': 'cha', 'dc': 12, 'rate_cc': 4, 'desc': '替商人當通譯、點貨、牽馬過秤。'}},
    {'id': 'lm_td_falconry', 'name': '鷹房', 'emoji': '🦅', 'location': 'yinghe',
     'at': {'area': 'yinghe/yingfang', 'x': 5, 'y': 1}, 'types': ['nature', 'workshop'],
     'desc': '海東部的鷹房：一排排鷹架上停著海東青，馴鷹人托雅在這裡熬鷹；首領海蘭也常在這裡。後面是海東部的冬營。',
     'scene': '鷹架上的海東青蒙著皮帽，偶爾抖一抖翅膀；馴鷹人整夜不睡地陪著新捉來的鷹「熬」，帳裡瀰漫著生肉與羽毛的味道。',
     'visit': {'title': '看鷹奴放鷹', 'desc': '跟著鷹奴到河邊放一次鷹。', 'hours': 1, 'effects': [cond('cheered')]},
     'work': {'attr': 'dex', 'dc': 13, 'rate_cc': 4, 'desc': '替鷹房切肉、清理鷹架、陪新鷹熬夜。'},
     'interior': 'sm_td_haidong_camp'},
    {'id': 'lm_td_post_station', 'name': '驛站', 'emoji': '🏇', 'location': 'yinghe',
     'at': {'area': 'yinghe/chama', 'x': 5, 'y': 5}, 'types': ['official'],
     'desc': '大法典規定的驛站：持驛牌的信差在這裡換馬，商隊在這裡歇腳，所有的消息都在這裡經過。',
     'scene': '驛站的院子裡拴著一排換班的驛馬，信差喝完一碗奶茶就上馬走了；老闆坐在門口，一邊擦銅牌一邊聽客人說話。',
     'visit': {'title': '在驛站歇腳', 'desc': '喝一碗熱奶茶，在驛站的氈房裡打個盹。', 'money_cc': 5, 'hours': 1, 'effects': [cond('relaxed')]},
     'explore': {'title': '跟驛站老闆打聽消息', 'desc': '請老闆喝一碗，聽他說說最近經過的人。', 'attr': 'cha', 'dc': 13, 'hours': 2,
                 'effects': [{'type': 'xp', 'amount': 25}, memory('在鷹河榷場的驛站聽老闆講了不少草原上的消息。')],
                 'critical': [{'type': 'money', 'amount': 30}]}},
]

SPECIAL_MAPS = {
    'sm_td_inner_tent': {
        'name': '金帳的內帳', 'location': 'jinzhang',
        'desc': '金帳最深處天可汗的內帳：地上鋪著十幾層羊毛氈，正中是一張蒙著狼皮的寶座，四周掛著被她征服的各部的戰旗——只有一面旗上沒有名字。',
        'lighting': 'lit', 'peaceful': True,
        'grid': [
            '###########',
            '#.........#',
            '#.##...##.#',
            '#.........#',
            '#..#...#..#',
            '#.........#',
            '#####E#####',
        ],
    },
    'sm_td_haidong_camp': {
        'name': '海東部的冬營', 'location': 'yinghe',
        'desc': '鷹房後面、鷹河上游的海東部冬營：幾十頂氈房圍著一圈篝火，帳外的雪地裡插著鷹架；最大的那頂氈房是首領海蘭的，外人進不去。',
        'lighting': 'lit', 'peaceful': True,
        'grid': [
            '#########',
            '#.......#',
            '#.#...#.#',
            '#.......#',
            '#.#...#.#',
            '####E####',
        ],
    },
}

# 受訓：那達慕場（力量）、驛站（旅途）、敖包（露宿）
TRAIN = {'brawler': 'lm_td_naadam', 'veteran': 'lm_td_naadam', 'pathfinder': 'lm_td_post_station', 'star_sleeper': 'lm_td_ovoo'}


def apply_relations(npcs):
    by = {n['id']: n for n in npcs}
    for a, b, ta, tb in RELATIONS:
        if a in by:
            by[a].setdefault('relations', {})[b] = ta
        if b in by and tb:
            by[b].setdefault('relations', {})[a] = tb


def _story_npcs():
    out = set()
    for st in json.load(open('data/rules/stories.json', encoding='utf-8'))['stories']:
        if st['start'].get('npc'):
            out.add(st['start']['npc'])
        for n in st['nodes']:
            if n.get('at', {}).get('npc'):
                out.add(n['at']['npc'])
            out.update(n.get('allies', []))
    return out


def write_npcs():
    story = _story_npcs()
    for n in NPCS:
        n.setdefault('relations', {})
        assert len(n['name']) <= 12 and len(n.get('occupation', '')) <= 12, n['id']
        assert len(n['personality']) <= 160, (n['id'], len(n['personality']))
        assert len(n['appearance']) <= 240, (n['id'], len(n['appearance']))
        assert len(n.get('background', '')) <= 400, n['id']
        if n['id'] in story:
            n['no_attack'] = True
    apply_relations(NPCS)
    src = open(PATH, encoding='utf-8').read()
    lines = [l for l in src.rstrip('\n').split('\n') if not l.startswith('    {"id": "npc_td_')]
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


def write_places():
    import east_p3_places as P3
    P3.LANDMARKS, P3.SPECIAL_MAPS, P3.TRAIN = LANDMARKS, SPECIAL_MAPS, TRAIN
    # east_p3_places 的寫法：同 id 的整筆換掉；這裡借它的函式寫北原的（場景表裡沒有北原的地標）
    P3.write_landmarks()
    P3.write_special_maps()
    P3.write_perks()


def write_worldbook():
    wb_path = 'data/worldbook/elondia.worldbook.json'
    wb = json.load(open(wb_path, encoding='utf-8'))
    lms = {l['id']: l['name'] for l in LANDMARKS}
    lines = ['重要人物-炎华北原（当代）:']
    for loc, label in (('jinzhang', '金帐王庭'), ('yinghe', '鹰河榷场')):
        lines.append(f'  {label}:')
        town_label = {'jinzhang': '金帳王庭', 'yinghe': '鷹河榷場'}[loc]
        for n in NPCS:
            if n['location'] != loc:
                continue
            where = '・' + lms[n['landmark']] if n.get('landmark') else '・走動'
            lines.append(f"    - {n['name']}（{town_label}{where}）: '{INTRO[n['id']]}'")
    content = '\n'.join(lines)
    entries = wb['entries']
    old = next((k for k, e in entries.items() if e['comment'] == '人物-炎华北原'), None)
    if old is None:
        tpl = next(e for e in entries.values() if e['comment'] == '人物-炎华南域')
        uid = max(int(e['uid']) for e in entries.values()) + 1
        e = json.loads(json.dumps(tpl))
        e.update({'uid': uid, 'comment': '人物-炎华北原', 'displayIndex': 54})
        entries[str(uid)] = e
        old = str(uid)
    entries[old]['content'] = content
    entries[old]['key'] = [n['name'] for n in NPCS if n['name'] != '驛站的老闆'] + ['驛站老闆']
    open(wb_path, 'w', encoding='utf-8').write(json.dumps(wb, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    write_npcs()
    write_places()
    write_worldbook()
    print(f'北原的固定 NPC {len(NPCS)} 位、關係 {len(RELATIONS)} 組、地標 {len(LANDMARKS)}、特殊地圖 {len(SPECIAL_MAPS)}')
