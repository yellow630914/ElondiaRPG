"""炎華之地 P4b：地下城線（9 條）、獨特物品（2 條）、小任務（3 條）、獨特裝備（5 件）與事件（旅途 8、城鎮 14、地下城 6）。
EAST_CONTENT_PLAN 8.5、8.6、8.11、第 9 節。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p4b.py
旗標簡稱：yhy_ 永昭陵、yhc_ 千窯谷、yhb_ 火藥坊遺址、yhu_ 獨特物品、yht_ 小任務、yhe_ 事件。
"""

from east_story_io import write_events, write_items, write_stories
from east_story_kit import COURT, LEAGUE, aff, at_npc, cell, check, dungeon, fight, item, mem, money, node, out, rep, story, town

KEEPER, YAOBO, XIE, RAT, QINYAN, APAO = 'npc_yh_old_tomb_keeper', 'npc_yh_yao_bo', 'npc_yh_xie_qingwu', 'npc_yh_rat_knife', 'npc_yh_qin_yan', 'npc_yh_apao'
HUIYIN, SANNIANG, XIAOQIAO, JIUNIANG, QIAN = 'npc_yh_huiyin', 'npc_yh_hu_sanniang', 'npc_yh_bai_xiaoqiao', 'npc_yh_hu_jiuniang', 'npc_yh_qian'

# ---------------- 獨特裝備 ----------------
ITEMS = [
    {'name': '燭龍君的玉圭', 'category': 'equipment', 'price_cc': 3200, 'tags': ['unique'],
     'desc': '末代燭龍君在祭典上手持的青玉圭，圭身刻著燭龍銜燭的紋。握著它的人，說話時總有幾分君王的分量。',
     'gear': {'base': 'focus', 'material': 'gold', 'rarity': 'epic', 'attrs': {'cha': 1},
              'enchants': {'offense': {'fire': 0.25}, 'resist': {'necrotic': -0.25}}, 'unique': {'check': {'contexts': ['negotiation']}, 'bonus': 2}}},
    {'name': '窯神的天青盞', 'category': 'equipment', 'price_cc': 3200, 'tags': ['unique'],
     'desc': '千窯谷第一窯燒出的天青茶盞，盞底寫著一個墨鐵鱗窯工的名字。窯神的火還在釉裡，捧著它的手永遠是暖的。',
     'gear': {'base': 'focus', 'material': 'gold', 'rarity': 'epic', 'attrs': {'int': 1},
              'enchants': {'resist': {'fire': -0.25, 'cold': -0.25}}, 'unique': {'check': {'kinds': ['craft', 'make', 'produce']}, 'bonus': 2}}},
    {'name': '霹靂王的火銃', 'category': 'equipment', 'price_cc': 3200, 'tags': ['unique'],
     'desc': '火藥坊爆炸前最後一把試造的火銃，銃管裡封著霹靂王的一點雷火。扣下機括時會先聽到一聲雷響。',
     'gear': {'base': 'crossbow', 'material': 'elderwood', 'rarity': 'epic', 'attrs': {'dex': 1},
              'enchants': {'offense': {'fire': 0.25, 'lightning': 0.25}, 'mods': {'crit': 1}}, 'unique': {'check': {'contexts': ['initiative']}, 'bonus': 2}}},
    {'name': '雨過天青瓷佩', 'category': 'equipment', 'price_cc': 1400, 'tags': ['unique'],
     'desc': '萍園藏瓷閣缺的那一件：一枚雨過天青色的瓷佩，用金線鑲邊。謝青梧說，戴著它的人看什麼都比較美。',
     'gear': {'base': 'pendant_mind', 'material': 'gold', 'rarity': 'rare', 'attrs': {'cha': 1},
              'enchants': {'resist': {'psychic': -0.25}}, 'unique': {'check': {'kinds': ['chat', 'flatter', 'gift']}, 'bonus': 2}}},
    {'name': '胡三太奶的文王鼓', 'category': 'equipment', 'price_cc': 1400, 'tags': ['unique'],
     'desc': '青丘屯仙堂代代相傳的文王鼓，鼓面是白狍皮，鼓圈掛著九枚銅錢。吟遊詩人拿它當法器，敲起來連仙家都會停下來聽。',
     'gear': {'base': 'focus', 'material': 'gold', 'rarity': 'rare', 'attrs': {'fai': 1},
              'enchants': {'resist': {'psychic': -0.25}, 'mods': {'save': 1}}, 'unique': {'check': {'attrs': ['fai']}, 'bonus': 1}}},
]


def unique(name):
    return item(name, 1)


STORIES = [
    # ================= 永昭陵 =================
    story('yhy_keeper_key', 'D', '陵戶的鑰匙',
          '守陵的老陵戶說，永昭陵地宮裡又傳出敲石門的聲音了，和開國那年一樣。他把祖上傳下來的地宮鑰匙交給你。',
          {'kind': 'npc', 'npc': KEEPER,
           'text': '老陵戶從懷裡掏出一把生鏽的銅鑰匙，手在發抖：「祖上傳下來的，地宮中殿的門。三百年了，裡面又在敲了——咚、咚、咚，三下一停，跟爺爺說的一模一樣。我老了，下不去。」'},
          'yhy_1_started', [
              fight('middle', '帶著鑰匙到永昭陵的中層', '中殿的石門前，鎮墓獸與機關弩守著門，像是三百年來一直在等誰。',
                    dungeon('yongzhao_tomb', 'middle'), 'yhy_1_started', [['tomb_beast', 1], ['crossbow_trap', 1]],
                    '鎮墓獸倒下了。你把銅鑰匙插進石門，門後是一道往下的甬道——門的內側，佈滿了朱砂色的手印，一個疊一個，都是從裡面拍的。', win_flags=['yhy_door']),
              node('report', '回龍安府告訴老陵戶門後的事',
                   '老陵戶聽你說到那些朱砂色的手印，臉色一下子白了：「朱砂……那是朱砂鱗的將軍們。爺爺說，他們是活著被關進去的。」',
                   at_npc(KEEPER, 'longan'), 'yhy_door',
                   success={'text': '老人把鑰匙推回給你：「你拿著。再往下，是陪葬的將軍們。他們敲了三百年的門，總該有人去聽聽他們要說什麼。」',
                            'set_flags': ['yhy_1_done'], 'effects': [aff(KEEPER, 12, '打開了地宮的中殿'), mem('用老陵戶的鑰匙打開永昭陵地宮的中殿，門內側全是朱砂色的手印。')],
                            'complete': True}),
          ]),
    story('yhy_buried_generals', 'C', '陪葬的將軍',
          '永昭陵深層埋著燭龍朝的朱砂鱗將軍們。情報商說，深層的陪葬將軍在歷史之龍的重演裡，每一夜都會說同一段話。',
          {'kind': 'informant', 'location': 'longan', 'price': 200, 'requires': {'flags': ['yhy_1_done']},
           'text': '情報商壓低聲音：「盜墓的人說，永昭陵深層的將軍們，每到子時就會停下來，對著墓頂說同一段話——說完又開始打。沒有人聽完過，因為聽的人都死了。」'},
          'yhy_2_started', [
              fight('deep', '到永昭陵的深層找陪葬的將軍們', '深層的墓室裡，兩個活埋的朱砂將軍舉起鏽蝕的長刀，眼窩裡燃著暗紅的火。',
                    dungeon('yongzhao_tomb', 'deep'), 'yhy_2_started', [['buried_general', 2]],
                    '將軍們跪倒在地，卻沒有散去。子時到了。', win_flags=['yhy_midnight']),
              node('words', '在永昭陵的深層聽將軍們說話',
                   '最年長的將軍抬起頭，聲音像風吹過破甲：「祭酒是溫家的人敬的。君上喝了第一杯，就倒在祖龍的壇前。我們拔刀，刀還沒出鞘，陵門就落下了。」他看著你：「告訴外面——我們不是亂臣，我們是被埋的。」',
                   dungeon('yongzhao_tomb', 'deep'), 'yhy_midnight', 'choice', options=[
                       {'label': '答應替他們說出去', 'success': {
                           'text': '將軍們的火一盞一盞熄了下去，像是終於能睡了。墓室的地上，留下一面朱砂鱗的護心鏡。',
                           'set_flags': ['yhy_2_done', 'yhy_promise'], 'effects': [item('朱砂鱗的殘鎧', 1),
                                                                                 mem('在永昭陵深層聽陪葬的朱砂將軍說：開國祭典上敬毒酒的是溫家的人。答應替他們說出去。', 3)],
                           'complete': True}},
                       {'label': '請他們安息', 'success': {
                           'text': '你說：真相會有人知道的，你們先睡吧。將軍們靜靜地看著你，火光慢慢暗了——但沒有完全熄滅。',
                           'set_flags': ['yhy_2_done'], 'effects': [mem('在永昭陵深層聽陪葬的朱砂將軍說：開國祭典上敬毒酒的是溫家的人。', 3)],
                           'complete': True}},
                   ]),
          ]),
    story('yhy_poisoned_rite', 'B', '毒酒與祭典',
          '永昭陵的最深處，被毒殺的燭龍君每一夜都在祭壇前重演三百年前的祭典。打倒他，才看得到祭典的最後一幕。',
          {'kind': 'guild', 'location': 'longan', 'requires': {'flags': ['yhy_2_done']},
           'text': '公會的委託單上沒有委託人的名字，只有一行字：「永昭陵底層，祭壇前的燭火三百年不熄。請熄之。」字跡清秀，像是太廟的人寫的。'},
          'yhy_3_started', [
              fight('guards', '到永昭陵的底層擊倒燭龍衛', '底層的大殿裡，燭龍衛排成兩列，眼窩裡的燭火一齊轉向你。',
                    dungeon('yongzhao_tomb', 'abyss'), 'yhy_3_started', [['zhulong_guard', 2]],
                    '燭龍衛倒下，大殿盡頭的祭壇亮了起來。', win_flags=['yhy_altar']),
              fight('lord', '在永昭陵的底層擊倒被毒殺的燭龍君',
                    '祭壇前，燭龍君舉起一只空了的酒杯，口中念著三百年前的祭文。念到「飲」字，他的身上燃起了火。',
                    dungeon('yongzhao_tomb', 'abyss'), 'yhy_altar', [['poisoned_zhulong_lord', 1], ['zhulong_guard', 1]],
                    '燭龍君倒在祭壇前，像三百年前一樣。這一次，重演停在最後一幕：祭壇下壓著一卷沒有燒盡的帛書——敬酒的人親筆寫下的祭文原稿，落款是溫氏的先祖。',
                    '燭龍君的火把你們逼退了。打倒他之前，祭典不會結束。', win_flags=['yhy_scroll']),
              node('end', '在永昭陵的底層決定帛書的去向',
                   '帛書上寫得清清楚楚：燭龍朝不是「天命已盡」，是被天青鱗的文臣用一杯毒酒終結的；寫祭文的人，是當今宰相溫世衡的先祖。',
                   dungeon('yongzhao_tomb', 'abyss'), 'yhy_scroll', 'choice', options=[
                       {'label': '把帛書帶出去公開', 'success': {
                           'text': '你把帛書交給太廟的慧音，由她抄錄、送進宮裡、貼上御街。「以文制武」的大燁，第一次被人問起它是怎麼開始的。天青鱗世家的臉色很難看；朱砂鱗的武人們在酒館裡哭了一夜。',
                           'set_flags': ['yhy_3_done', 'yhy_public'],
                           'effects': [aff(HUIYIN, 10, '帶回了開國祭典的真相'), rep(COURT, -4),
                                       mem('在永昭陵底層打倒被毒殺的燭龍君，帶出溫氏先祖寫的祭文原稿並公開：大燁開國是一杯毒酒換來的。', 3)],
                           'complete': True}},
                       {'label': '把帛書封存起來', 'success': {
                           'text': '你把帛書收進懷裡，沒有交給任何人。這件事，也許有一天會用得上——在對的時候、對的人面前。',
                           'set_flags': ['yhy_3_done', 'yhy_sealed'],
                           'effects': [mem('在永昭陵底層打倒被毒殺的燭龍君，拿到溫氏先祖寫的祭文原稿，封存起來。', 3)],
                           'complete': True}},
                   ]),
          ], extra_rewards=[unique('燭龍君的玉圭')]),
    # ================= 千窯谷 =================
    story('yhc_last_kiln', 'D', '窯伯的最後一窯',
          '千窯谷最後一位老窯工窯伯，想在死之前回谷裡再燒一窯天青。谷裡的窯早就被瓷俑與窯火佔了。',
          {'kind': 'npc', 'npc': YAOBO,
           'text': '窯伯把一包釉藥塞進你手裡：「我這輩子最後一個願望，就是回谷裡再燒一窯。中層那口龍窯是我師父的，還燒得動。可是谷裡現在全是會走路的瓷——我這把老骨頭，走不到那裡。」'},
          'yhc_1_started', [
              fight('clear', '到千窯谷的中層清出師父的龍窯', '中層的老龍窯前，青瓷俑守著窯口，窯膛裡竄出一個窯焰妖，笑著朝你撲來。',
                    dungeon('qianyao_valley', 'middle'), 'yhc_1_started', [['celadon_figurine', 1], ['kiln_flame_yao', 1]],
                    '窯口清出來了。窯膛裡還留著上一窯的灰，摸起來是溫的。', win_flags=['yhc_clear']),
              check('fire', '在千窯谷的中層照窯伯的配方燒一窯',
                    '你照著窯伯教的，把釉藥上在素坯上，封窯、點火、看火色。龍窯一節一節地燒紅了。',
                    dungeon('qianyao_valley', 'middle'), 'yhc_clear', 'int', 13,
                    '開窯的時候，一窯雨過天青的盞整整齊齊地排在窯床上，開片細得像頭髮。你挑了最好的一只帶回去。',
                    '火候沒看準，一窯全裂了。再燒一次。', win_flags=['yhc_fired']),
              node('back', '把燒好的盞帶回萍江府給窯伯',
                   '窯伯捧著那只盞，對著光看了很久很久，眼淚掉進盞裡：「是師父的顏色……是我們的顏色。」',
                   at_npc(YAOBO, 'pingjiang'), 'yhc_fired',
                   success={'text': '「這顏色叫天青，」他說，「可是書上寫的，是別人的名字。萍園那個瓷癡，他的閣子裡有一只最老的盞。你去看看盞底。」',
                            'set_flags': ['yhc_1_done'], 'effects': [aff(YAOBO, 15, '替他燒了最後一窯'), item('天青釉的殘片', 2),
                                                                     mem('在千窯谷中層替老窯工窯伯燒了最後一窯天青。')],
                            'complete': True}),
          ]),
    story('yhc_who_fired', 'C', '天青是誰燒的',
          '萍園藏瓷閣最裡面鎖著一只千窯谷最早的天青盞。盞底的款，不是任何一個天青鱗世家的名字。',
          {'kind': 'npc', 'npc': XIE, 'requires': {'flags': ['yhc_1_done']},
           'text': '謝青梧打開藏瓷閣最裡面的鎖：「窯伯說你燒過一窯。那你看看這個。」他把一只盞翻過來，盞底刻著兩個字：「墨秋」。「我查遍了族譜，天青鱗沒有姓墨的。千窯谷深處有一座窯工的墳，也許有答案。」'},
          'yhc_2_started', [
              fight('deep', '到千窯谷的深層找窯工的墳', '深層的山坳裡，素胎巨俑守著一座小小的石墳，白瓷美人瓶在墳邊低聲唱著歌。',
                    dungeon('qianyao_valley', 'deep'), 'yhc_2_started', [['bisque_giant', 1], ['porcelain_beauty_vase', 1]],
                    '石墳的碑上刻著：「窯工墨秋之墓。始燒天青，名為他人所奪，投窯以明志。」', win_flags=['yhc_grave']),
              node('end', '回萍江府的萍園告訴謝青梧墳上的字',
                   '謝青梧讀完你拓回來的碑文，沉默了很久：「天青鱗的『天青』，是從一個墨鐵鱗窯工那裡奪來的名字。我家的祖上……也在那份奪名的名單上。」',
                   cell('pingjiang', 'lm_yh_ping_garden'), 'yhc_grave', 'choice', allies=[XIE, YAOBO], options=[
                       {'label': '請他把墨秋的名字刻上', 'success': {
                           'text': '謝青梧親手在藏瓷閣的每一只天青盞的籤條上，加了一行字：「始燒者，墨鐵鱗窯工墨秋。」窯伯看著那一行字，笑得像個孩子。天青鱗世家的人來萍園，臉色都很難看。',
                           'set_flags': ['yhc_2_done', 'yhc_named'], 'effects': [aff(XIE, 12, '查出天青釉的來歷'), aff(YAOBO, 12, '替師祖找回了名字'), rep(LEAGUE, 2)],
                           'complete': True}},
                       {'label': '先只告訴窯伯', 'success': {
                           'text': '你們把碑文拓本交給窯伯。老人把它供在家裡的灶台上，每天早上擦一次。「知道的人知道就好，」他說，「窯神知道。」',
                           'set_flags': ['yhc_2_done'], 'effects': [aff(XIE, 8, '查出天青釉的來歷'), aff(YAOBO, 12, '替師祖找回了名字')],
                           'complete': True}},
                   ]),
          ]),
    story('yhc_kiln_god', 'B', '窯神',
          '千窯谷的谷底，失控的窯神在窯膛裡燒了三百年。窯工們說，天青的名字被奪走那天，窯神的火就失了控。',
          {'kind': 'guild', 'location': 'pingjiang', 'requires': {'flags': ['yhc_2_done']},
           'text': '公會的委託單上蓋著窯市行會的印：「千窯谷底的窯火又竄高了，谷口的窯市整夜被照得通紅，再燒下去要燒到萍江。懸賞能熄火、或能讓窯神安息的人。」'},
          'yhc_3_started', [
              fight('spirits', '到千窯谷的底層擊倒窯變之靈', '底層的窯膛熱得讓空氣扭曲，兩團窯變之靈在火裡翻湧，釉色一刻一變。',
                    dungeon('qianyao_valley', 'abyss'), 'yhc_3_started', [['kiln_transmutation_spirit', 2]],
                    '窯變之靈散成一片彩色的光。最深處的窯膛裡，窯神睜開了眼睛。', win_flags=['yhc_core']),
              fight('god', '在千窯谷的底層擊倒失控的窯神', '窯神從火裡站起來，一身天青與赤紅交織的窯火，朝你伸出燒得發白的手。',
                    dungeon('qianyao_valley', 'abyss'), 'yhc_core', [['kiln_god_rampant', 1], ['kiln_transmutation_spirit', 1]],
                    '窯神的火暗了下來，她低頭看著自己的手，像是第一次看見它們。', '窯神的火把你們逼出了窯膛。火不熄，谷就不會安靜。', win_flags=['yhc_calm']),
              node('end', '在千窯谷的底層讓窯神安息',
                   '窯神的火只剩一盞燈那麼大，她開口了，聲音像窯裡的風：「他們說天青是誰的？」',
                   dungeon('qianyao_valley', 'abyss'), 'yhc_calm', 'choice', options=[
                       {'label': '告訴她：是墨秋的', 'success': {
                           'text': '「墨秋……」窯神笑了，火光一下子變成了雨過天青的顏色，安安靜靜地沉進窯膛。她留下一只盞，盞底寫著兩個字。谷口的窯市，那一夜第一次是黑的。',
                           'set_flags': ['yhc_3_done', 'yhc_rest'], 'effects': [aff(YAOBO, 10, '讓窯神安息'),
                                                                              mem('在千窯谷底層讓失控的窯神安息：告訴她天青釉是窯工墨秋燒出來的。', 3)],
                           'complete': True}},
                       {'label': '把窯火熄了', 'success': {
                           'text': '你們把窯膛封死，最後一點火在磚縫裡熄了。千窯谷從此再也燒不出天青。窯伯聽說之後，什麼都沒說，只是把家裡的灶也熄了一天。',
                           'set_flags': ['yhc_3_done'], 'effects': [mem('在千窯谷底層打倒失控的窯神，封死了谷底的窯火。', 3)],
                           'complete': True}},
                   ]),
          ], extra_rewards=[unique('窯神的天青盞')]),
    # ================= 火藥坊遺址 =================
    story('yhb_scavenger_find', 'D', '拾荒人撿到的東西',
          '在火藥坊遺址撿東西的拾荒頭目老鼠刀說，他的人在廢墟中層撿到半本燒焦的帳——可是那一層的東西太兇，他的人進不去。',
          {'kind': 'npc', 'npc': RAT,
           'text': '老鼠刀把一頁燒得只剩一半的紙攤在你面前：「我的人在中層撿到的，上面有軍器監的印。剩下的半本還在裡面，被一個走火的猛火油櫃壓著。你去拿，拿出來我們再談價錢。」'},
          'yhb_1_started', [
              fight('middle', '到火藥坊遺址的中層找那半本帳', '中層的庫房裡，猛火油櫃還在噴火，一個爆炎精繞著它跳來跳去，地上散著燒焦的紙。',
                    dungeon('gunpowder_ruins', 'middle'), 'yhb_1_started', [['greek_fire_cabinet', 1], ['blast_sprite', 1]],
                    '火熄了。你從油櫃底下拖出半本燒焦的帳，最後一頁寫著：「某月某日，奉監命，於庫房外埋引線三道。」', win_flags=['yhb_ledger']),
              node('deal', '拿著那半本帳回瑔州港找老鼠刀',
                   '老鼠刀一看那一頁，臉色變了：「埋引線……是有人故意炸的。」他搓著手，「這東西值錢。秦焰會出大價錢，相府——相府會出更多。」',
                   at_npc(RAT, 'quanzhou'), 'yhb_ledger', 'choice', options=[
                       {'label': '交給秦焰', 'success': {
                           'text': '你把帳本交給秦焰。老總匠師讀完那一頁，坐在地上，很久都沒有站起來。老鼠刀在旁邊嘆了口氣，沒有開價：「那天，我老婆也在坊裡。」',
                           'set_flags': ['yhb_1_done', 'yhb_to_qin'], 'effects': [aff(QINYAN, 12, '帶回了爆炸那天的帳'), aff(RAT, 6, '沒有把帳賣掉')], 'complete': True}},
                       {'label': '讓老鼠刀去賣（分一半）', 'success': {
                           'text': '老鼠刀把帳本賣給了一個戴斗笠的人，分給你一袋銀子。三天後，你在秦焰的火藥坊外看見那個戴斗笠的人——他在打聽秦焰住哪一間。',
                           'set_flags': ['yhb_1_done', 'yhb_sold'], 'effects': [money(300), aff(RAT, 10, '幫他把帳賣了好價錢')], 'complete': True}},
                   ]),
          ]),
    story('yhb_four_years', 'C', '四年前的爆炸',
          '秦焰想親眼看看爆炸的起點。那一天的引線，從庫房外一路埋到了礦道深處。',
          {'kind': 'npc', 'npc': QINYAN, 'requires': {'flags': ['yhb_1_done']},
           'text': '秦焰把舊的火藥坊圖紙攤開：「三道引線，從庫房外埋到礦道。我要知道是從哪裡點的、誰點的。我自己下不去——深層全是硝石蜈蚣與當年留下的傀儡。」'},
          'yhb_2_started', [
              fight('deep', '到火藥坊遺址的深層找引線的起點', '深層的礦道裡，霹靂砲傀儡還在照試砲的口令開火，一隻硝石蜈蚣從岩縫裡鑽出來。',
                    dungeon('gunpowder_ruins', 'deep'), 'yhb_2_started', [['thunder_cannon_puppet', 1], ['saltpeter_centipede', 1]],
                    '傀儡倒下，礦道安靜了。地上有三道燒焦的痕跡，一路通往礦道盡頭。', win_flags=['yhb_traces']),
              check('trace', '在火藥坊遺址的深層追查引線的起點',
                    '你沿著燒焦的痕跡走到礦道盡頭，那裡有一塊被炸裂的石壁，石壁上刻著一些記號。',
                    dungeon('gunpowder_ruins', 'deep'), 'yhb_traces', 'int', 15,
                    '記號是軍器監的工匠標記，旁邊刻著一行小字：「監令：坊中人不得撤。」——上頭叫走了工頭，卻下令坊裡的人不准走。',
                    '痕跡太亂，你看不出頭緒。換個時候再來看。', win_flags=['yhb_order']),
              node('end', '回瑔州港把引線的事告訴秦焰',
                   '秦焰聽完，把那張舊圖紙撕成兩半：「『坊中人不得撤』。他們要的不是火藥，是要我們死，好讓火藥歸朝廷。」阿炮站在門口，眼睛紅紅的。',
                   cell('quanzhou', 'lm_yh_gunpowder_works'), 'yhb_order', 'choice', allies=[QINYAN, APAO], options=[
                       {'label': '把證據交給金墨盟', 'success': {
                           'text': '秦焰把證據交給了金玉棠。金墨盟在瑔州港的會館裡，把那一行字貼在牆上，下面寫著三百個名字。朝廷的人來撕，撕了又貼，貼了又撕。',
                           'set_flags': ['yhb_2_done', 'yhb_league'], 'effects': [aff(QINYAN, 12, '查出了爆炸的真相'), rep(LEAGUE, 3), rep(COURT, -2)], 'complete': True}},
                       {'label': '先收著，等對的時候', 'success': {
                           'text': '秦焰把證據鎖進火藥坊最深的櫃子：「這東西放出去，瑔州港會流血。等一個能讓說話的人不被殺的時候。」',
                           'set_flags': ['yhb_2_done'], 'effects': [aff(QINYAN, 10, '查出了爆炸的真相')], 'complete': True}},
                   ]),
          ]),
    story('yhb_thunder_king', 'B', '霹靂王',
          '火藥坊遺址的最深處，四年前那一聲巨響化成了「霹靂王」。墨鐵鱗的火藥工說，她每一夜都在重演那一場爆炸。',
          {'kind': 'guild', 'location': 'quanzhou', 'requires': {'flags': ['yhb_2_done']},
           'text': '公會的委託單上簽著十一個名字——火藥坊爆炸的十一個倖存者：「遺址底層的雷火每一夜都在炸，炸得整個瑔州港睡不著。我們要她停下來。」'},
          'yhb_3_started', [
              fight('spirits', '到火藥坊遺址的底層擊倒地火之靈', '底層的礦道熱得像熔爐，兩團地火之靈從岩縫裡湧出來。',
                    dungeon('gunpowder_ruins', 'abyss'), 'yhb_3_started', [['earthfire_spirit', 2]],
                    '地火退回岩縫。最深處，雷光一閃——霹靂王醒了。', win_flags=['yhb_core']),
              fight('king', '在火藥坊遺址的底層擊倒霹靂王', '霹靂王在礦道盡頭站起來，一身雷光與火焰，四年前的那一聲巨響在她身上不停地重演。',
                    dungeon('gunpowder_ruins', 'abyss'), 'yhb_core', [['thunderbolt_king', 1], ['earthfire_spirit', 1]],
                    '霹靂王的雷光一道一道熄滅。在她倒下的地方，留著一把燒得發黑的火銃——爆炸前最後一把試造的。', '雷火把你們炸了出來。她不停，爆炸就不會停。', win_flags=['yhb_down']),
              node('end', '在火藥坊遺址的底層讓霹靂王停下來',
                   '霹靂王的最後一點雷光懸在半空，像在等什麼。秦焰說過，那一天坊裡有三百個人。',
                   dungeon('gunpowder_ruins', 'abyss'), 'yhb_down', 'choice', options=[
                       {'label': '唸出三百個名字', 'success': {
                           'text': '你照著秦焰抄給你的名冊，一個一個唸出那天死在坊裡的人。唸到最後一個，雷光輕輕地炸成一朵金色的煙花，散了。瑔州港那一夜，第一次沒有雷聲。',
                           'set_flags': ['yhb_3_done', 'yhb_named'], 'effects': [aff(QINYAN, 12, '讓霹靂王停了下來'), aff(APAO, 8, '讓霹靂王停了下來'),
                                                                               mem('在火藥坊遺址底層讓霹靂王停下來：唸出爆炸那天死去的三百個名字。', 3)],
                           'complete': True}},
                       {'label': '拿走火銃，讓雷光散去', 'success': {
                           'text': '你撿起那把火銃，雷光跟著你的手晃了一下，散進了礦道的黑暗裡。也許她還會再醒——但至少今夜，瑔州港睡得著了。',
                           'set_flags': ['yhb_3_done'], 'effects': [mem('在火藥坊遺址底層打倒霹靂王，拿走了爆炸前最後一把火銃。', 3)],
                           'complete': True}},
                   ]),
          ], extra_rewards=[unique('霹靂王的火銃')]),
    # ================= 獨特物品 =================
    story('yhu_missing_piece', 'C', '萍園缺的那一件',
          '謝青梧的藏瓷閣有一套十二件的天青瓷，只缺一枚瓷佩。他打聽到瓷佩在瑔州港的胡記商號，胡九娘不肯賣。',
          {'kind': 'npc', 'npc': XIE,
           'text': '謝青梧把空著的那一格錦盒打開給你看：「十二件，缺一件，像一首詩少了最後一個字。那枚瓷佩在胡九娘手上，她說不賣——她說要換。」他苦笑，「我不知道她要換什麼。」'},
          'yhu_1_started', [
              check('huji', '到瑔州港的胡記商號找胡九娘談瓷佩',
                    '胡九娘把玩著那枚雨過天青的瓷佩：「謝家的么子要這個？可以——拿謝家的一幅畫來換。不是隨便一幅，是他畫的那幅『美人圖』，畫裡的美人是誰，他心裡清楚。」',
                    cell('quanzhou', 'lm_yh_huji'), 'yhu_1_started', 'cha', 15,
                    '你跟她周旋了一個下午，最後她笑著讓了一步：「好吧，不要美人圖了。下次胡記的貨要經過萍江，讓萍園替我們收一晚——就這樣。」她把瓷佩放進你手裡。',
                    '胡九娘笑盈盈地聽完你的話，然後把瓷佩收了回去：「再想想吧。」', win_flags=['yhu_got']),
              node('return', '回萍江府的萍園把瓷佩交給謝青梧',
                   '謝青梧把瓷佩放進錦盒的最後一格，十二件天青排成一排，在藏瓷閣的燈下像一場雨剛停。他看了很久，才想起你還在旁邊。',
                   cell('pingjiang', 'lm_yh_ping_garden'), 'yhu_got', allies=[XIE],
                   success={'text': '「這一套，」他說，「我想送一件給你。」他取出的正是那枚瓷佩：「它在你身上，比在盒子裡好看。」',
                            'set_flags': ['yhu_1_done'], 'effects': [aff(XIE, 15, '湊齊了天青瓷的十二件'), aff(JIUNIANG, 3, '談成了瓷佩的交換')],
                            'complete': True}),
          ], merit=8, extra_rewards=[unique('雨過天青瓷佩')]),
    story('yhu_drum', 'C', '胡三太奶的鼓',
          '仙堂代代相傳的文王鼓，鼓面被老黃皮子偷偷咬破了。胡三娘說，新的鼓面要用白狍皮，還要請胡三太奶親自開光。',
          {'kind': 'npc', 'npc': SANNIANG,
           'text': '胡三娘捧著一面破了的鼓，難得沒有笑：「這是太奶傳下來的鼓，鼓面昨夜被咬了一個洞——是山裡那群老黃皮子，牠們記恨我送走了牠們的野仙朋友。新鼓面要白狍皮，白狍在黃皮子的地盤裡。」'},
          'yhu_2_started', [
              fight('woods', '到青丘屯的近郊從黃皮子手上搶回白狍皮', '白樺林深處，兩隻老黃皮子正在分一張雪白的狍皮，看見你，齜牙咧嘴地撲過來。',
                    out('qingqiu'), 'yhu_2_started', [['yh_old_weasel', 2]],
                    '老黃皮子丟下狍皮逃了。皮子雪白、完整，像是牠們本來就打算拿來換什麼。', win_flags=['yhu_hide']),
              check('bless', '在青丘屯的仙堂請胡三太奶替新鼓開光',
                    '新鼓面繃好了。三娘點起香，白小蕎用新鼓敲起請仙的調子。鼓聲一響，三娘的聲音變成了胡三太奶：「這面鼓，要一個外人的心意，才響得長久。」',
                    cell('qingqiu', 'lm_yh_xiantang'), 'yhu_hide', 'fai', 14,
                    '你閉上眼睛，跟著鼓聲把心裡想對仙家說的話說了。鼓聲忽然變得又深又長，連屋外的風都停了。胡三太奶笑了：「好鼓。拿去吧，孩子——這面鼓，跟你走。」',
                    '鼓聲斷了一下，太奶搖頭：「心不靜。明天再來。」', win_flags=['yhu_blessed'], allies=[SANNIANG, XIAOQIAO]),
              node('end', '在青丘屯的仙堂收下文王鼓',
                   '三娘醒過來，看著鼓在你手上，愣了一下，然後大笑：「太奶把鼓給了你？她老人家八十年沒把鼓給過外人。」',
                   cell('qingqiu', 'lm_yh_xiantang'), 'yhu_blessed', allies=[SANNIANG],
                   success={'text': '「拿著吧。」三娘說，「仙堂另外做一面就好。鼓在你身上，太奶就跟著你——往後在外面，遇到不乾淨的東西，敲一下。」',
                            'set_flags': ['yhu_2_done'], 'effects': [aff(SANNIANG, 12, '替仙堂找回了鼓面'), aff(XIAOQIAO, 8, '替仙堂找回了鼓面')],
                            'complete': True}),
          ], merit=8, extra_rewards=[unique('胡三太奶的文王鼓')]),
    # ================= 小任務 =================
    story('yht_new_tea', 'E', '錢掌櫃的新茶',
          '御街夜市的錢掌櫃想在鬥茶會上贏過對街的茶坊，他需要一餅胡記的龍團茶，還需要一個會說話的人替他吆喝。',
          {'kind': 'npc', 'npc': QIAN,
           'text': '錢掌櫃搓著手：「下個月的鬥茶會，對街的『清和樓』請了宮裡退下來的茶博士。我要贏他，得有胡記的龍團茶——還得有個嘴甜的人替我在夜市吆喝。」'},
          'yht_tea_started', [
              node('buy', '到瑔州港的胡記商號買一餅龍團茶',
                   '胡記的夥計從櫃子最上層拿下一餅用黃絹包著的茶：「龍團，貢茶的邊料，一餅一百白鸛，不講價。」',
                   cell('quanzhou', 'lm_yh_huji'), 'yht_tea_started',
                   success={'text': '你付了錢，把茶餅揣好。', 'set_flags': ['yht_tea_bought'], 'effects': [money(-100)]}),
              check('contest', '晚上在龍安府的御街夜市替錢掌櫃吆喝鬥茶',
                    '鬥茶會擠滿了人。對街的老茶博士手法漂亮，茶湯雪白；錢掌櫃這邊，就靠你一張嘴了。',
                    cell('longan', 'lm_yh_night_market'), 'yht_tea_bought', 'cha', 12,
                    '你把龍團茶的來歷講得天花亂墜，看客們一窩蜂擠到錢掌櫃的攤前。最後一碗茶湯出來，錢掌櫃的湯花咬盞不散——贏了。',
                    '看客們對你的吆喝沒什麼反應。錢掌櫃擦著汗說：明晚還有一場。', win_flags=['yht_tea_won'], hours='night', allies=[QIAN]),
              node('end', '在龍安府的御街夜市和錢掌櫃分紅',
                   '錢掌櫃樂得合不攏嘴，硬是把贏來的彩頭分了你一半。',
                   cell('longan', 'lm_yh_night_market'), 'yht_tea_won', allies=[QIAN],
                   success={'text': '「以後二樓雅座，你的位子我天天留著。」錢掌櫃說，「想聽什麼消息，問我。」',
                            'effects': [money(250), aff(QIAN, 15, '替他贏了鬥茶會')], 'complete': True}),
          ]),
    story('yht_dragon_boat', 'D', '虹橋下的龍舟',
          '萍江的龍舟節，織工行會與船夫幫的龍舟要在虹橋下一決勝負。織工的舟少了一個划槳的人。',
          {'kind': 'guild', 'location': 'pingjiang',
           'text': '公會的告示板上貼著一張紅紙：「龍舟節，織工行會的『青禾號』缺一名划手。力氣大、不怕水者優先。賞錢另議，輸了請喝酒。」'},
          'yht_boat_started', [
              node('join', '到萍江府的虹橋報名划龍舟',
                   '虹橋兩岸擠滿了人，鼓聲震天。織工行會的龍舟上，二十個繡娘與織工捲著袖子，朝你招手。',
                   cell('pingjiang', 'lm_yh_rainbow_bridge'), 'yht_boat_started',
                   success={'text': '你坐上最後一個位子，鼓手是陸青禾。「划不贏沒關係，」她咧嘴一笑，「划輸了船夫幫，我請全萍江喝酒。」', 'set_flags': ['yht_boat_on']}),
              check('race', '在萍江府的虹橋下划龍舟',
                    '鼓聲一響，兩條龍舟箭一樣衝出去。船夫幫的舟一開始就領先半個船身。',
                    cell('pingjiang', 'lm_yh_rainbow_bridge'), 'yht_boat_on', 'str', 13,
                    '最後二十槳，你跟著陸青禾的鼓聲拚了命地划，織工的舟在虹橋下硬是追平、超前——龍頭先過了終點的紅繩。兩岸的織工哭成一片。',
                    '你們差了一個船身。陸青禾拍拍你的背：「明年再來！」——不過龍舟節有三天，明天還有一場。', win_flags=['yht_boat_won']),
              node('end', '在萍江府的虹橋下領彩頭',
                   '彩頭是一匹雲錦與一壇黃酒。陸青禾把雲錦塞給你，自己抱著酒壇跳進了運河。',
                   cell('pingjiang', 'lm_yh_rainbow_bridge'), 'yht_boat_won',
                   success={'text': '那一夜，整個水巷都在唱織工的歌。', 'effects': [money(200), aff('npc_yh_lu_qinghe', 8, '一起划贏了龍舟')], 'complete': True}),
          ]),
    story('yht_canal_rats', 'D', '御溝的老鼠',
          '龍安府市坊的居民說，御溝裡的東西越來越多，夜裡從排水口爬上來咬人。公會懸賞清理御溝。',
          {'kind': 'guild', 'location': 'longan',
           'text': '公會的委託單上蓋著市坊坊正的印：「御溝積穢，夜有怪物出沒，咬傷坊民。懸賞清剿。入口在市坊西牆。」'},
          'yht_canal_started', [
              fight('canal', '從市坊的西牆進龍安府的御溝清剿', '御溝深處傳來水聲與低吼。最裡面的溝渠邊，幾個私鹽販子正把一袋袋鹽從暗門搬進來，看見你，抄起扁擔。',
                    {'where': 'special', 'special_map': 'sm_yh_longan_canal', 'x': 6, 'y': 5}, 'yht_canal_started', [['salt_smuggler', 2], ['jianjing_robber', 1]],
                    '私鹽販子們丟下鹽袋逃了。暗門的另一邊，隱約看得見一條往皇城方向的通道——被一道新的鐵柵擋著。', win_flags=['yht_canal_clear']),
              node('report', '回龍安府的公會交差',
                   '公會的掌櫃聽你說完，皺起眉：「私鹽……還有往皇城的暗道。這種事，公會只管清老鼠。」',
                   cell('longan', 'guild'), 'yht_canal_clear',
                   success={'text': '他把賞錢推給你，壓低聲音：「那道鐵柵是新的。有人不想讓人從御溝走進皇城——或是想讓某些人走。」',
                            'set_flags': ['yht_canal_done'], 'effects': [mem('清剿龍安府的御溝時，發現私鹽販子的暗門與一條通往皇城、被新鐵柵擋住的通道。')], 'complete': True}),
          ]),
]

LINES = {
    'yhy_keeper_key': '永昭陵・一', 'yhy_buried_generals': '永昭陵・二', 'yhy_poisoned_rite': '永昭陵・三',
    'yhc_last_kiln': '千窯谷・一', 'yhc_who_fired': '千窯谷・二', 'yhc_kiln_god': '千窯谷・三',
    'yhb_scavenger_find': '火藥坊遺址・一', 'yhb_four_years': '火藥坊遺址・二', 'yhb_thunder_king': '火藥坊遺址・三',
    'yhu_missing_piece': '萍園缺的那一件・一', 'yhu_drum': '胡三太奶的鼓・一',
}
for _s in STORIES:
    if _s['id'] in LINES:
        _s['summary'] += '（%s）' % LINES[_s['id']]


# ---------------- 事件 ----------------
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


SEA = {'modes': ['sea'], 'regions': ['yanhua_south']}
EVENTS = [
    # ---- 遠洋航程（往瑔州港的海路）----
    {'id': 'yhe_sea_storm', 'tier': 'normal', 'kind': 'check', 'category': 'trouble', **SEA, 'title': '遠洋的風暴',
     'text': '出海的第五天，天邊壓來一片鉛灰的雲。浪頭一個比一個高，船長吼著要所有人去拉帆索。',
     'check': {'attr': 'str', 'dc': 13}, 'success': ok('你和水手們一起死命拉住帆索，船在浪裡打了三個轉，總算撐過去了。船長拍拍你的肩。', xp(20)),
     'fail': ok('一個大浪把你掀倒在甲板上，撞得頭破血流。', hp(-0.2))},
    {'id': 'yhe_compass_fish', 'tier': 'normal', 'kind': 'check', 'category': 'trouble', **SEA, 'title': '指南魚失靈',
     'text': '舵手的指南魚——一片浮在水碗裡的磁鐵魚——忽然轉個不停。四面都是海，看不見一點陸地。',
     'check': {'attr': 'int', 'dc': 13}, 'success': ok('你等到天黑，認出了船長教過的那幾顆星，替舵手把方向找了回來。', xp(20)),
     'fail': ok('船在海上多繞了兩天，乾糧吃得比預期快。', cond('fed_light', False))},
    {'id': 'yhe_yulin_fleet', 'tier': 'normal', 'kind': 'choice', 'category': 'social', **SEA, 'title': '玉璘族的船隊',
     'text': '海面上浮起一串珍珠色的光：一群玉璘族拖著貝殼船游過來，船上堆滿了酒罈，有人朝你們揮手唱歌。',
     'options': [{'label': '下去跟她們喝一杯', 'success': ok('你被拉進貝殼船，喝了一肚子海藻酒，回到大船上時還在唱夏瀾殿的歌。', cond('cheered'), cond('tipsy'))},
                 {'label': '拿乾糧換一串珍珠', 'success': ok('玉璘族笑嘻嘻地收下乾糧，塞給你一串小小的淡水珍珠。', money(40))},
                 {'label': '揮揮手繼續趕路', 'success': ok('歌聲在身後越來越遠。')}]},
    {'id': 'yhe_mirage', 'tier': 'normal', 'kind': 'choice', 'category': 'omen', **SEA, 'title': '海上的蜃樓',
     'text': '無風的午後，海平面上浮出一座倒懸的城：飛簷、燈籠、宮牆，一模一樣地映在天上。水手們說，看久了的人會想跳下去游過去。',
     'options': [{'label': '盯著看清楚', 'check': {'attr': 'fai', 'dc': 14},
                  'success': ok('你看清了：城裡的燈籠每一盞都晚半拍才亮，像有人在照著記憶點燈。說不出哪裡不對勁——但你記住了。', xp(30), {'type': 'memory', 'summary': '遠洋航程上看見海上的蜃樓：一座倒懸的城，燈籠都晚半拍才亮。', 'importance': 1}),
                  'fail': ok('你看著看著，回過神時已經站在船舷上，被水手一把拉了回來。心裡一直發毛。', cond('shaken'))},
                 {'label': '轉過頭不看', 'success': ok('你背對著蜃樓坐了一下午，直到它慢慢沉進海裡。')}]},
    {'id': 'yhe_stowaway', 'tier': 'normal', 'kind': 'choice', 'category': 'social', **SEA, 'title': '偷渡的人',
     'text': '貨艙裡躲著一個瘦小的化龍族少年，墨鐵色的鱗片上全是煤灰。他求你別告訴船長：他想去瑔州港找在那裡當水手的哥哥。',
     'options': [{'label': '替他付船資（50 白鸛）', 'success': ok('你把錢交給船長，說少年是你的跟班。少年一路上替你洗衣服、端飯，下船時跪下來磕了三個頭。', money(-50), cond('cheered'))},
                 {'label': '幫他藏好', 'check': {'attr': 'dex', 'dc': 12}, 'success': ok('你替他搬了幾個木箱擋住，船長始終沒發現。'),
                  'fail': ok('船長發現了，把少年和你一起罵了一頓，罰你替船上擦了三天甲板。', hp(-0.05))},
                 {'label': '交給船長', 'success': ok('船長讓少年在船上做工抵船資。他看你的眼神，你很久都忘不了。')}]},
    {'id': 'yhe_ship_dice', 'tier': 'normal', 'kind': 'choice', 'category': 'opportunity', **SEA, 'title': '船上的賭局',
     'text': '夜裡的貨艙裡，水手們圍著一盞油燈擲骰子，賭注是銅錢、菸草，還有下一個港口的酒錢。',
     'options': [{'label': '下場賭一把（30 白鸛）', 'check': {'attr': 'cha', 'dc': 13}, 'success': ok('你連贏三把，水手們罵罵咧咧地把錢推過來。', money(60)),
                  'fail': ok('骰子不聽話。你的錢袋輕了一點。', money(-30))},
                 {'label': '在旁邊看', 'success': ok('你看了一夜的熱鬧，學了幾句水手的粗話。')}]},
    {'id': 'yhe_scurvy', 'tier': 'normal', 'kind': 'check', 'category': 'trouble', **SEA, 'title': '壞血病',
     'text': '海上的第八天，幾個水手的牙齦開始流血，渾身無力。船上的蔬果早就吃完了。',
     'check': {'attr': 'fai', 'dc': 13}, 'success': ok('你想起有人說過醃菜與檸檬能治這種病，翻遍貨艙找到一罈泡菜，分給大家。水手們好了一半。', xp(20)),
     'fail': ok('你也開始覺得渾身發軟，牙齦隱隱作痛。', hp(-0.15))},
    {'id': 'yhe_whales', 'tier': 'normal', 'kind': 'check', 'category': 'omen', **SEA, 'title': '鯨群',
     'text': '清晨的海面上噴起一道道水柱：一群巨鯨從船邊游過，背脊像一座座黑色的小島。',
     'check': {'attr': 'fai', 'dc': 8}, 'success': ok('鯨群唱著低沉的歌，繞著船游了一圈才離開。水手們說，這是好兆頭。', cond('cheered')),
     'fail': ok('一隻鯨尾拍起的浪打濕了你全身。水手們哈哈大笑。')},
    # ---- 城鎮事件 ----
    {'id': 'yhe_market_pickpocket', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'trouble', 'locations': ['longan'], 'cells': ['shop', 'tavern', 'informant'],
     'title': '夜市的扒手', 'text': '御街夜市人擠人，一隻手從你的腰間摸過去——一個頂著小龍角的孩子，攥著你的錢袋往人群裡鑽。',
     'options': [{'label': '追上去', 'check': {'attr': 'dex', 'dc': 13}, 'success': ok('你在燒鵝攤前一把抓住他。孩子哭著說家裡的爹是欠餉的禁軍。你拿回錢袋，又塞給他幾個銅板。', cond('cheered')),
                  'fail': ok('孩子鑽進人群不見了，你的錢袋也是。', money(-30))},
                 {'label': '算了', 'success': ok('你摸摸空了一點的腰間，算是請了夜市一碗湯餅。', money(-15))}]},
    {'id': 'yhe_goulan_brawl', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'trouble', 'locations': ['longan'], 'cells': ['tavern', 'brothel'],
     'title': '瓦舍的鬧場', 'text': '隔壁勾欄的戲演到一半，兩個喝醉的公子哥為了搶前排的座位打了起來，椅子飛得滿場都是。',
     'options': [{'label': '把他們架出去', 'check': {'attr': 'str', 'dc': 12}, 'success': ok('你一手一個把他們拎出勾欄。戲班的班主塞給你兩張下一場的座頭。', money(20), cond('cheered')),
                  'fail': ok('飛來的椅子砸中了你的頭。', hp(-0.1))},
                 {'label': '趁亂看白戲', 'success': ok('你在一片混亂中看完了下半場，戲還不錯。', cond('cheered'))}]},
    {'id': 'yhe_exam_results', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'social', 'locations': ['longan'], 'cells': ['inn', 'tavern', 'guild'],
     'title': '科舉放榜', 'text': '貢院門口貼出了黃榜，人山人海。一個墨鐵鱗的老書生從榜頭看到榜尾，又從榜尾看到榜頭，忽然坐在地上大哭。',
     'options': [{'label': '扶他起來喝碗茶', 'success': ok('老書生說他考了二十年。你陪他喝了一碗茶，他說明年還要再考。', cond('cheered'))},
                 {'label': '幫他看榜', 'check': {'attr': 'int', 'dc': 11}, 'success': ok('你在副榜的最後一行找到了他的名字——他太緊張，看漏了。老書生又哭又笑，把一包點心塞給你。', cond('fed_light'))},
                 {'label': '走開', 'success': ok('哭聲在身後很久都沒停。')}]},
    {'id': 'yhe_storyteller_news', 'scope': 'town', 'tier': 'normal', 'kind': 'check', 'category': 'omen', 'locations': ['longan'], 'cells': ['tavern'],
     'title': '說書人的新段子', 'text': '酒館裡的說書人醒木一拍：「今兒講一段新的——某宰相夜裡調卷子，某將軍當了鎧甲換軍餉……」看客們笑得前仰後合。',
     'check': {'attr': 'int', 'dc': 12}, 'success': ok('你從段子裡聽出幾件真事：宰相府最近進出的人、禁軍裡的怨氣、瑔州港的火藥。', xp(15)),
     'fail': ok('你笑得太開心，只記得笑話，沒記住內容。', cond('cheered'))},
    {'id': 'yhe_dragon_boat_race', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'opportunity', 'locations': ['pingjiang'], 'cells': ['inn', 'tavern', 'gate'],
     'title': '運河的龍舟', 'text': '鼓聲從運河上傳來：幾條龍舟正在練划，岸邊的人在押哪一條會贏。',
     'options': [{'label': '押織工的舟（20 白鸛）', 'check': {'attr': 'cha', 'dc': 12}, 'success': ok('織工的舟贏了半個船身。你收了一倍的錢。', money(20)), 'fail': ok('船夫幫的舟贏了。', money(-20))},
                 {'label': '在岸邊看', 'success': ok('鼓聲震得人心裡發熱。', cond('cheered'))}]},
    {'id': 'yhe_fake_porcelain', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'commerce', 'locations': ['pingjiang'], 'cells': ['shop', 'jeweler'],
     'title': '窯市的贗品', 'text': '窯市的攤販捧著一只「汝窯天青盞」，說是千窯谷第一窯，只要五十白鸛。',
     'options': [{'label': '仔細看看', 'check': {'attr': 'int', 'dc': 13}, 'success': ok('開片是用刀刻的，釉色是用茶水染的。你指出來，攤販臉一紅，送你一只真的小碟子賠罪。', item('天青釉的殘片', 1)),
                  'fail': ok('你看不出破綻，花五十白鸛買下了。回去一洗，青色全掉了。', money(-50))},
                 {'label': '不買', 'success': ok('攤販又去找下一個客人了。')}]},
    {'id': 'yhe_weaving_song', 'scope': 'town', 'tier': 'normal', 'kind': 'check', 'category': 'social', 'locations': ['pingjiang'], 'cells': ['tailor', 'jeweler', 'brothel'],
     'title': '織坊的工歌', 'text': '傍晚的織坊街，織機聲停了，有人起了個頭，整條街的織工跟著唱起了工歌——唱的是梭子、絲線，和越來越少的工錢。',
     'check': {'attr': 'cha', 'dc': 11}, 'success': ok('你跟著唱了一段，織工們笑著塞給你一塊剛織好的帕子。', cond('cheered')),
     'fail': ok('你聽得出神，跟著哼了兩句，走調得讓人發笑。')},
    {'id': 'yhe_foreign_merchant', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'commerce', 'locations': ['quanzhou'], 'cells': ['shop', 'tavern', 'inn'],
     'title': '蕃坊的異國商人', 'text': '一個裹著頭巾的異國商人拉住你，打開一只木盒：玻璃珠、象牙梳、一瓶據說能讓人「看見遠方」的藍色藥水。',
     'options': [{'label': '買那瓶藥水（40 白鸛）', 'check': {'attr': 'fai', 'dc': 13}, 'success': ok('喝下去，眼前真的閃過一片陌生的海岸——也許只是酒。', money(-40), xp(25)),
                  'fail': ok('那只是加了靛藍的糖水。', money(-40))},
                 {'label': '跟他聊聊西方的事', 'success': ok('他說潮汐港最近不太平，黑帆的人在找什麼東西。', cond('cheered'))}]},
    {'id': 'yhe_test_blast', 'scope': 'town', 'tier': 'normal', 'kind': 'check', 'category': 'trouble', 'locations': ['quanzhou'], 'cells': ['smithy', 'informant', 'tattoo', 'carver'],
     'title': '火藥坊的試爆', 'text': '「轟！」火藥坊的方向傳來一聲巨響，碎瓦從天而降。',
     'check': {'attr': 'dex', 'dc': 12}, 'success': ok('你一個閃身躲進屋簷下，碎瓦劈哩啪啦落了一地。阿炮從牆頭探出頭：「沒事吧？試爆，試爆！」'),
     'fail': ok('一片瓦正好砸在你頭上。', hp(-0.1))},
    {'id': 'yhe_clerk_brawl', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'trouble', 'locations': ['quanzhou'], 'cells': ['tavern', 'gate', 'inn'],
     'title': '夥計鬥毆', 'text': '碼頭邊，胡記的夥計與金玉行的夥計為了一條卸貨的跳板吵起來，拳頭已經揮出去了。',
     'options': [{'label': '把兩邊拉開', 'check': {'attr': 'str', 'dc': 13}, 'success': ok('你一手一個把他們拉開。兩邊的掌櫃都派人來道謝，各塞了一點錢。', money(30)),
                  'fail': ok('你被兩邊的拳頭一起招呼了。', hp(-0.15))},
                 {'label': '勸他們輪流用', 'check': {'attr': 'cha', 'dc': 12}, 'success': ok('兩邊吵了半天，最後同意輪流卸貨。', cond('cheered')),
                  'fail': ok('沒人聽你的，他們打得更兇了。')},
                 {'label': '走遠一點', 'success': ok('身後傳來木箱翻倒的聲音。')}]},
    {'id': 'yhe_weasel_title', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'omen', 'locations': ['qingqiu'], 'cells': ['gate', 'inn', 'tavern'],
     'title': '黃皮子討封', 'text': '屯口的柴堆後面，一隻黃毛的黃鼬人立起來，學著人樣作揖，眼睛賊亮：「你看我像人，還是像仙？」',
     'options': [{'label': '「像人。」', 'success': ok('黃皮子愣了一下，摸摸自己的臉，嘆口氣鑽回柴堆。屯裡的老人說，你讓牠少修了一百年。', cond('cheered'))},
                 {'label': '「像仙。」', 'check': {'attr': 'cha', 'dc': 12}, 'success': ok('黃皮子樂得打滾，朝你拜了三拜，叼來一枚銅錢放在你腳邊。', money(10), cond('blessed')),
                  'fail': ok('你說得太勉強，黃皮子瞇起眼睛：「你騙我。」那一整天，你走路一直絆到自己的腳。', cond('punished'))},
                 {'label': '「像黃鼠狼。」', 'success': ok('黃皮子尖叫一聲不見了。屯裡的人聽說之後，都用同情的眼神看你。', cond('punished'))}]},
    {'id': 'yhe_dance_spirit', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'social', 'locations': ['qingqiu'], 'cells': ['inn', 'tavern', 'shop'],
     'title': '跳大神', 'text': '仙堂那邊傳來文王鼓的聲音。白小蕎唱著神調，胡三娘閉著眼睛搖晃，屯裡的人圍了一圈——有人家的孩子發燒三天不退，請仙來看。',
     'options': [{'label': '擠進去看', 'check': {'attr': 'fai', 'dc': 12}, 'success': ok('鼓聲停的那一刻，你好像看見樑上有一雙狐狸的眼睛。孩子的燒，當晚就退了。', cond('blessed')),
                  'fail': ok('人太多，你只看到一堆後腦勺。')},
                 {'label': '在外面聽鼓', 'success': ok('鼓聲又深又長，聽得人心裡安靜下來。', cond('relaxed'))}]},
    {'id': 'yhe_painted_skin', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'omen', 'locations': ['longan'], 'cells': ['inn'],
     'title': '畫皮的書生', 'text': '客舍的夜裡，隔壁的窮書生房裡傳出女子的笑聲。門縫裡，一個美人背對著燈，手裡拿著一支筆，在一張人皮上細細地描眉。',
     'options': [{'label': '推門進去', 'check': {'attr': 'fai', 'dc': 14}, 'success': ok('你一聲大喝，美人的皮掉在地上，底下是一團黑煙，從窗口逃走了。書生嚇得說不出話，後來送了你一幅畫。', xp(30)),
                  'fail': ok('美人回過頭，衝你一笑。你醒來時躺在自己的床上，脖子上有一道淡淡的紅痕。', hp(-0.15), cond('shaken'))},
                 {'label': '去叫店家', 'success': ok('店家拿著燈籠過來時，房裡只剩書生一個人在睡覺，桌上攤著一幅美人圖。')},
                 {'label': '當沒看見', 'success': ok('那一夜你睡得很不安穩。第二天，書生的房間空了。', cond('shaken'))}]},
    {'id': 'yhe_peony_night', 'scope': 'town', 'tier': 'normal', 'kind': 'choice', 'category': 'omen', 'locations': ['pingjiang'], 'cells': ['inn', 'tavern'],
     'title': '牡丹開的夜', 'text': '月圓的夜裡，園林那一頭飄來濃得化不開的牡丹香。有人說，萍園的百年牡丹化成了人，在花叢裡挑看花的人。',
     'options': [{'label': '去園林看看', 'check': {'attr': 'cha', 'dc': 13}, 'success': ok('花叢裡站著一個雪膚烏髮的女子，看了你一眼，笑著把一片花瓣放進你手心，就不見了。', item('牡丹花瓣', 1), cond('cheered')),
                  'fail': ok('你在花叢裡迷了路，香得頭昏腦脹，天亮才走出來。', cond('shaken'))},
                 {'label': '關窗睡覺', 'success': ok('香氣從窗縫鑽進來，你做了一夜好夢。', cond('relaxed'))}]},
    # ---- 地下城事件 ----
    {'id': 'yhe_grave_goods', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['chest'], 'dungeons': ['yongzhao_tomb'], 'layers': [1, 2, 3],
     'title': '陪葬的明器', 'text': '箱子裡是一排排陪葬的明器：陶馬、陶屋、小小的陶俑，還有一枚用紅綢包著的玉蟬——含在死者口中的那種。',
     'options': [{'label': '拿走玉蟬', 'check': {'attr': 'fai', 'dc': 14}, 'success': ok('你小心地取出玉蟬，沒有驚動什麼。', money(80)),
                  'fail': ok('玉蟬離開紅綢的那一刻，墓室裡響起一聲嘆息。你渾身發冷。', money(80), cond('shaken'))},
                 {'label': '只拿陶馬', 'success': ok('你挑了一匹最完整的陶馬，其他的原樣放好。', money(30))},
                 {'label': '把箱子蓋回去', 'success': ok('你蓋上箱子，朝它拜了一拜。', cond('blessed'))}]},
    {'id': 'yhe_tomb_mechanism', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['trap'], 'dungeons': ['yongzhao_tomb'], 'layers': [1, 2, 3, 4],
     'title': '墓室的機關', 'text': '腳下的石板一沉，墓室的四面牆同時打開了一排小孔，機括「喀」地一響。',
     'options': [{'label': '撲倒在地', 'check': {'attr': 'dex', 'dc': 14}, 'success': ok('一排弩箭從你頭頂掠過，釘在對面的牆上。'),
                  'fail': ok('一支弩箭擦過你的肩膀。', hp(-0.15))},
                 {'label': '找機關的樞紐', 'check': {'attr': 'int', 'dc': 15}, 'success': ok('你在石板邊找到一根銅栓，一推，機括停了。銅栓是好東西。', item('機關弩的銅機括', 1)),
                  'fail': ok('你還沒找到，弩箭就射出來了。', hp(-0.2))}]},
    {'id': 'yhe_transmuted_shard', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['gather'], 'dungeons': ['qianyao_valley'], 'layers': [1, 2, 3, 4],
     'title': '窯變的瓷片', 'text': '瓷片堆裡有一片顏色怪異的碎瓷：天青裡透著胭脂，胭脂裡又泛出紫，每看一次都不一樣。',
     'options': [{'label': '撿起來', 'check': {'attr': 'fai', 'dc': 13}, 'success': ok('瓷片在你手心裡安靜下來，定成一片深深的天青。', item('天青釉的殘片', 2)),
                  'fail': ok('瓷片燙得像剛出窯，你一鬆手，它在地上碎成粉。', hp(-0.1))},
                 {'label': '用布包起來', 'success': ok('隔著布，你感覺得到它還在發熱。', item('窯火餘燼', 1))}]},
    {'id': 'yhe_kiln_phantom', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['rest'], 'dungeons': ['qianyao_valley'], 'layers': [1, 2, 3, 4],
     'title': '窯火的幻影', 'text': '休息時，你看見安全房外的窯膛亮了起來，一群看不清臉的窯工在火光裡搬坯、封窯、看火，沒有一點聲音。',
     'options': [{'label': '靜靜地看', 'check': {'attr': 'fai', 'dc': 12}, 'success': ok('火光熄滅前，一個老窯工回頭看了你一眼，點了點頭。你醒來時，覺得手特別穩。', cond('honed')),
                  'fail': ok('你看著看著睡著了，夢裡全是燒裂的瓷。', cond('shaken'))},
                 {'label': '叫醒同伴', 'success': ok('等同伴們揉著眼睛起來，窯膛已經是黑的了。')}]},
    {'id': 'yhe_unexploded', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['trap'], 'dungeons': ['gunpowder_ruins'], 'layers': [1, 2, 3, 4],
     'title': '未爆的火藥', 'text': '你踢到一個半埋在灰裡的鐵罐，罐口的引信「嘶」地冒出了火星。',
     'options': [{'label': '一腳踢遠', 'check': {'attr': 'dex', 'dc': 14}, 'success': ok('鐵罐飛進礦道深處，「轟」的一聲，震得頂上落灰。'),
                  'fail': ok('鐵罐在你腳邊炸開。', hp(-0.25))},
                 {'label': '掐熄引信', 'check': {'attr': 'int', 'dc': 15}, 'success': ok('你捏住引信用力一扯，火星熄了。罐子裡是上好的火藥。', item('硝石', 2)),
                  'fail': ok('引信燒得比你想的快。', hp(-0.2))}]},
    {'id': 'yhe_saltpeter_smoke', 'scope': 'dungeon', 'tier': 'normal', 'kind': 'choice', 'triggers': ['gather', 'rest'], 'dungeons': ['gunpowder_ruins'], 'layers': [1, 2, 3, 4],
     'title': '礦道的硝煙', 'text': '礦道的岩縫裡滲出一縷縷白色的硝煙，嗆得人睜不開眼，煙裡好像還有人在咳嗽。',
     'options': [{'label': '摀住口鼻快走', 'check': {'attr': 'str', 'dc': 13}, 'success': ok('你憋著氣衝出了煙裡。'),
                  'fail': ok('你吸了一大口硝煙，咳得眼淚直流。', hp(-0.1))},
                 {'label': '循著咳嗽聲找過去', 'check': {'attr': 'fai', 'dc': 14}, 'success': ok('煙散了，岩縫裡只有一塊燒焦的工牌。你把它收好。', item('燒焦的工牌', 1), cond('blessed')),
                  'fail': ok('咳嗽聲忽然停了，你在煙裡迷了路，好一陣子才走出來。', cond('shaken'))}]},
]


if __name__ == '__main__':
    write_items(ITEMS)
    write_stories(STORIES)
    write_events(EVENTS)
