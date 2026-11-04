"""炎華之地 P4a：渡海引導（2 條）、化龍族「點青」（3 條）、靈狐族「胡家的名冊」（3 條）。EAST_CONTENT_PLAN 8.2 節。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p4a_races.py
旗標簡稱：yhf_（渡海）、yhl_（點青）、yhh_（胡家的名冊）。
"""

from east_story_io import write_stories
from east_story_kit import COURT, LEAGUE, aff, at_npc, cell, check, dungeon, fight, item, mem, money, node, out, rep, story, town

HASTINGS, CARLOS, RENO = 'npc_yh_hastings', 'npc_carlos_blacksail', 'npc_reno_deeptide'
HUIYIN, YE, YAOTING, YAOBO, KEEPER = 'npc_yh_huiyin', 'npc_yh_ye_guhong', 'npc_yh_yaoting', 'npc_yh_yao_bo', 'npc_yh_old_tomb_keeper'
TAIYE, SANNIANG, XIAOQIAO, JIUNIANG, YUXIAO = 'npc_yh_hu_taiye', 'npc_yh_hu_sanniang', 'npc_yh_bai_xiaoqiao', 'npc_yh_hu_jiuniang', 'npc_yh_hu_yuxiao'

STORIES = [
    # ================= 渡海引導 =================
    story('yhf_east_ship', 'E', '東方來的船',
          '潮汐港的碼頭來了一艘從東方來的船，船身被風暴打得半毀，船上是頭生龍角的化龍族水手。他們要找人把一封信送回十天航程外的瑔州港。',
          {'kind': 'guild', 'location': 'tidehaven',
           'text': '公會的告示板上貼著一張從沒見過的委託：紙是薄薄的竹紙，字是工整的楷書——「尋可信之人，送家書一封至瑔州港蕃坊哈斯丁處。船資由敝船負擔。」落款是一艘停在碼頭的東方大船。'},
          'yhf_1_started', [
              node('docks', '到潮汐港的酒館找東方來的水手',
                   '酒館角落坐著一群頭生龍角、頸側覆鱗的水手，正用你聽不太懂的口音跟老闆比手畫腳。帶頭的老水手看見你手上的委託，站起來拱了拱手：「我們從炎華的瑔州港來，遇上風暴，船要修一個月。東家在等這封信。」',
                   cell('tidehaven', 'tavern'), 'yhf_1_started', 'check', check={'attr': 'cha', 'dc': 10},
                   success={'text': '你和他們比劃了半天，總算弄懂了：信要交給瑔州港蕃坊的商人哈斯丁——一個跑東方航線的潮汐港人。老水手把信和一塊刻著船名的木牌交給你：「拿著這個，去找深潮席的人搭船，十天就到。」',
                            'set_flags': ['yhf_letter'], 'effects': [mem('在潮汐港的酒館認識了一群從東方炎華之地來的化龍族水手，答應替他們把信送到瑔州港。', 1)]},
                   fail={'text': '你們雞同鴨講了半天，老水手搖頭笑了笑，請你喝了一碗他們帶來的黃酒。明天再來試試吧。', 'retry': True}),
              node('deliver', '搭船到瑔州港，把信交給蕃坊的哈斯丁',
                   '十天的海路之後，瑔州港的燈塔從海平面上升起來。蕃坊碼頭上，紅鬍子的潮汐港商人哈斯丁接過信，看完大笑：「好消息！我的貨船沒沉，只是被風暴吹到你們那邊去了。」',
                   cell('quanzhou', 'lm_yh_fanfang'), 'yhf_letter', allies=[HASTINGS],
                   success={'text': '哈斯丁硬塞給你一杯大燁的茶：「歡迎來到炎華之地。這裡的人有龍角、講禮數、愛算帳——跟我們潮汐港人一樣愛算帳。有空來蕃坊找我，我有生意給你。」',
                            'set_flags': ['yhf_1_done'], 'effects': [aff(HASTINGS, 8, '從潮汐港送來貨船的消息')], 'complete': True}),
          ]),
    story('yhf_fanfang', 'D', '瑔州港的蕃坊',
          '蕃商哈斯丁在潮汐港有一筆貨款被扣住了，扣住它的是「黑帆」卡洛斯的人。他想請人渡海回潮汐港把錢要回來。',
          {'kind': 'npc', 'npc': HASTINGS,
           'text': '哈斯丁把一張發黃的貨單拍在桌上：「三船瓷器的錢，潮汐港那邊的人一直說還沒收到——收到的人是黑帆卡洛斯。我回不去，船上的人都在等我。你替我跑一趟潮汐港，好嗎？」'},
          'yhf_2_started', [
              node('sail', '回潮汐港找「黑帆」卡洛斯',
                   '潮汐港的碼頭依舊熱鬧。「黑帆」卡洛斯靠在一堆木箱上，看完貨單，笑了：「哈斯丁那個紅鬍子？錢在我這裡，沒錯。可是他的瓷器在我的倉庫裡放了三個月，倉租呢？」',
                   at_npc(CARLOS, 'tidehaven'), 'yhf_2_started', 'choice', options=[
                       {'label': '跟他講道理', 'check': {'attr': 'cha', 'dc': 14},
                        'success': {'text': '你一筆一筆跟他算：倉租扣掉，錢還有七成。卡洛斯盯著你看了很久，大笑著把錢袋丟過來：「哈斯丁找了個好幫手。告訴他，下次的貨直接走我的船。」',
                                    'set_flags': ['yhf_paid'], 'effects': [aff(CARLOS, 3, '算帳算贏了他')]},
                        'fail': {'text': '卡洛斯聽完只是聳肩：「說得真好聽。」他轉身走了。換個時候再來，或者換個辦法。', 'retry': True}},
                       {'label': '動手要回來', 'success': {'text': '卡洛斯吹了聲口哨，兩個碼頭的打手從貨堆後面走出來。', 'set_flags': ['yhf_brawl']}},
                       {'label': '自己貼倉租（150 白鸛）', 'success': {'text': '你把倉租數給他，卡洛斯痛快地交出錢袋：「爽快。這種人在潮汐港活得久。」',
                                                                  'set_flags': ['yhf_paid'], 'effects': [money(-150)]}},
                   ]),
              fight('brawl', '在潮汐港的碼頭打退卡洛斯的打手', '兩個打手捲起袖子，把你堵在木箱之間。',
                    town('tidehaven'), 'yhf_brawl', [['dock_enforcer', 2]],
                    '打手躺在地上呻吟。卡洛斯拍拍手：「好，好。錢拿去——下次別在我的碼頭打架。」', win_flags=['yhf_paid'], urgent=True),
              node('back', '回瑔州港把錢交給哈斯丁',
                   '哈斯丁在蕃坊的貨棧裡數著錢，數到一半抬起頭：「你一個人走完了一趟來回？二十天的海路？」他把三成的錢推回給你。',
                   cell('quanzhou', 'lm_yh_fanfang'), 'yhf_paid', allies=[HASTINGS],
                   success={'text': '「東西兩邊都有你這樣的人，這條航線才走得下去。」哈斯丁說，蕃坊的商人以後都會認得你的臉。',
                            'set_flags': ['yhf_2_done'], 'effects': [money(200), aff(HASTINGS, 10, '從潮汐港要回了貨款'),
                                                                     mem('替蕃商哈斯丁渡海回潮汐港，從黑帆卡洛斯手上要回了貨款。')], 'complete': True}),
          ]),
    # ================= 化龍族：點青 =================
    story('yhl_ancestor_rite', 'D', '祖龍的祭文',
          '太廟的女祭司慧音在一卷殘破的祭文裡讀到一段缺漏：大燁開國那年的祖龍祭，祭典之後，燭龍君去了哪裡？',
          {'kind': 'npc', 'npc': HUIYIN,
           'text': '慧音抱著一卷發黃的祭文，聲音壓得很低：「開國那一年的祭文，前半寫『告天』，後半被人刮掉了。刮掉的地方，在永昭陵的神道碑上也刻過一份——可是我是祭司，不能私自去陵裡。」'},
          'yhl_1_started', [
              node('temple', '到龍安府的太廟看慧音的祭文',
                   '祭文的後半被人用刀一行一行刮掉，只剩邊角幾個字：「……燭……飲……殉……」慧音把一張拓紙與一塊墨交給你：「神道碑在永昭陵外圍。老陵戶認得路。」',
                   cell('longan', 'lm_yh_taimiao'), 'yhl_1_started', allies=[HUIYIN],
                   success={'text': '你收下拓紙。慧音猶豫了一下，又說：「如果碑上寫的和史書不一樣……拓回來就好，不要告訴別人。」', 'set_flags': ['yhl_rubbing']}),
              fight('stele', '到永昭陵的周邊拓下神道碑',
                    '神道碑立在荒草裡，碑面被人鑿過，旁邊還丟著幾把新的鑿子。兩個蒙面的打手從碑後站起來：「誰派你來的？」',
                    dungeon('yongzhao_tomb', 'outskirts'), 'yhl_rubbing', [['yh_street_thug', 2]],
                    '打手逃走前丟下一句「相府不會放過你」。碑面被鑿了一半，剩下的字還拓得下來：「……燭龍君飲祭酒，崩於壇前；朱砂諸將，殉於陵中……」',
                    win_flags=['yhl_rubbed']),
              node('report', '把拓本帶回龍安府的太廟給慧音',
                   '慧音把拓本攤在祭壇上，手指順著一個個字移過去，臉色越來越白：「『飲祭酒，崩於壇前』……史書寫的是燭龍君『天命已盡，禪位於燁』。」',
                   cell('longan', 'lm_yh_taimiao'), 'yhl_rubbed', allies=[HUIYIN],
                   success={'text': '她把拓本捲起來，鎖進祭壇下的暗格：「謝謝你。我要再查下去——點青禮用的釉，聽說也是從那個時候開始的。太學的葉主考也許知道。」',
                            'set_flags': ['yhl_1_done'], 'effects': [aff(HUIYIN, 12, '拓回了永昭陵的神道碑'),
                                                                     mem('在永昭陵外圍拓下神道碑：燭龍君「飲祭酒，崩於壇前」，朱砂鱗的將軍們「殉於陵中」——和大燁的史書不一樣。', 3)],
                            'complete': True}),
          ]),
    story('yhl_glazed_scale', 'C', '點出來的青',
          '太學的主考官葉孤鴻是點青出身的狀元。他的學生在點青禮後被天青鱗世家的子弟刮掉了封鱗的釉，他想知道點青的釉到底從哪裡來。',
          {'kind': 'npc', 'npc': YE, 'requires': {'flags': ['yhl_1_done']},
           'text': '葉孤鴻臉色鐵青：「我的學生，點青禮才過三天，就被一群天青鱗的公子哥按在地上，用瓷片把頸上的釉刮了，說他『點出來的青不是青』。」他摸著自己頸側的封鱗，「慧音說你查過開國的事。點青的釉，是誰燒的？」'},
          'yhl_2_started', [
              node('ask', '到萍江府找老窯工窯伯問點青的釉',
                   '窯伯捏起一片天青的瓷，對著光看了很久：「點青禮用的釉，就是千窯谷燒天青瓷的釉。開國那一年，朝廷把谷裡最好的窯工叫進京，叫他們調一種能封在鱗上的釉——燒釉的是我們墨鐵鱗的祖宗。」',
                   at_npc(YAOBO, 'pingjiang'), 'yhl_2_started', 'check', check={'attr': 'int', 'dc': 14},
                   success={'text': '他從懷裡掏出一本被窯火燻黑的冊子：「這是我師父的師父的師父留下的配方。點青的釉、天青的瓷，都在這裡。天青鱗世家想要這本冊子很久了。」', 'set_flags': ['yhl_recipe']},
                   fail={'text': '老人說到一半就不說了，搖著頭去看他的瓷。也許改天他心情好一點再問。', 'retry': True}),
              fight('night', '晚上在萍江府的近郊護送窯伯的配方',
                    '回城的路上，幾個黑衣刀客從運河邊的柳樹後跳出來：「把冊子交出來，老頭子可以活。」',
                    out('pingjiang'), 'yhl_recipe', [['yh_blade_for_hire', 2]],
                    '刀客逃進夜色裡。窯伯把冊子緊緊抱在懷裡，嘆了口氣：「三百年了，他們還在怕這本冊子。」', win_flags=['yhl_saved'], hours='night'),
              node('truth', '回龍安府的太學把配方的事告訴葉孤鴻',
                   '葉孤鴻翻著窯伯的冊子，翻到點青釉的那一頁，手停住了：「原來點青的釉，和天青的瓷，出自同一雙手。天生的天青鱗看不起點出來的青——可是讓他們『天青』的那個顏色，本來就是墨鐵鱗燒出來的。」',
                   cell('longan', 'lm_yh_taixue'), 'yhl_saved', 'choice', allies=[YE], options=[
                       {'label': '請他在太學講出來', 'success': {
                           'text': '葉孤鴻在下一堂講經時，把冊子擺在講台上。堂下的天青鱗子弟臉色難看，墨鐵鱗的士子卻聽得眼睛發亮。第二天，宰相府的人來了太學。',
                           'set_flags': ['yhl_2_done', 'yhl_spoken'], 'effects': [aff(YE, 12, '查出了點青釉的來歷'), rep(LEAGUE, 2)], 'complete': True}},
                       {'label': '請他先收著', 'success': {
                           'text': '葉孤鴻把冊子鎖進書箱：「你說得對。說出來，我的學生會更危險。可是總有一天……」他沒有說完。',
                           'set_flags': ['yhl_2_done'], 'effects': [aff(YE, 10, '查出了點青釉的來歷')], 'complete': True}},
                   ]),
          ]),
    story('yhl_heatwave_song', 'B', '熱浪的歌謠',
          '瑔州港的玉璘族使節瑤汀聽說了太廟的祭文，說玉璘族的古歌謠裡有一模一樣的句子。化龍族與玉璘族，也許來自同一片熱浪。',
          {'kind': 'npc', 'npc': YAOTING, 'requires': {'flags': ['yhl_2_done']},
           'text': '瑤汀難得沒有喝酒，抱著月琴撥了幾個音：「慧音祭司唸給我聽的那段祭文——『熱浪過，萬物化，有角者生』——我們夏瀾殿的古歌也有。只是我們的歌後面多了一句：『海水來，熱浪冷，有鱗者游』。」'},
          'yhl_3_started', [
              node('canglue', '到滄月闕的四時迴廊找古歌的原本',
                   '四時迴廊的貝殼牆上刻著歷代潮主的詩篇。最古老的那一面牆上，用和太廟祭文一樣的古字刻著一段歌：熱浪掃過大陸，有的人生出了角，往陸地去；有的人生出了鱗，往海裡去。',
                   cell('canglue', 'lm_four_seasons_gallery'), 'yhl_3_started', 'check', check={'attr': 'int', 'dc': 16},
                   success={'text': '你把兩段古字對在一起：太廟的祭文是前半，四時迴廊的歌是後半。化龍族與玉璘族，是同一片熱浪裡活下來的兩支。', 'set_flags': ['yhl_both']},
                   fail={'text': '古字太難認，你看得頭昏眼花。秋珊苑的學者說，明天潮水退了，牆上的字會清楚一點。', 'retry': True}),
              fight('voyage', '在回炎華的海路上擊退劫船的人',
                    '回程的船走到一半，一艘沒有旗號的快船貼了上來。船頭站著幾個蒙面的黑衣人——相府不想讓這兩段古字湊在一起。',
                    {'where': 'road'}, 'yhl_both', [['yh_deathsworn', 3]],
                    '黑衣人一個接一個跳海逃走。船長抹著汗說，那艘快船掛的是市舶司放行的牌子。', win_flags=['yhl_safe'], urgent=True),
              node('rite', '到龍安府的太廟把兩段古歌合在一起',
                   '慧音與瑤汀站在祖龍像前，一個唸祭文，一個唱古歌。合在一起的那一刻，大殿裡的長明燈晃了一下——也許只是風。',
                   cell('longan', 'lm_yh_taimiao'), 'yhl_safe', 'choice', allies=[HUIYIN, YAOTING], options=[
                       {'label': '把合起來的歌寫進祭文', 'success': {
                           'text': '慧音把兩段古歌合抄成一卷，供在祖龍像前：「化龍族與玉璘族同源。這件事，不該只有祭司知道。」瑤汀笑著說，她要把這首歌唱給整個滄月闕聽。',
                           'set_flags': ['yhl_3_done', 'yhl_public'],
                           'effects': [aff(HUIYIN, 15, '把兩段古歌合在一起'), aff(YAOTING, 15, '把兩段古歌合在一起'), rep('four_seasons', 3),
                                       mem('在太廟把化龍族的祭文與玉璘族的古歌合在一起：兩族都是熱量之龍的熱浪裡活下來的人，一支往陸地，一支往海。', 3)],
                           'complete': True}},
                       {'label': '只留給兩位知道', 'success': {
                           'text': '慧音把合抄的歌鎖進暗格，瑤汀把它記在心裡。「總有一天，」瑤汀說，「我們會在挑潮祭上唱出來。」',
                           'set_flags': ['yhl_3_done'], 'effects': [aff(HUIYIN, 12, '把兩段古歌合在一起'), aff(YAOTING, 12, '把兩段古歌合在一起')],
                           'complete': True}},
                   ]),
          ], extra_rewards=[item('秘銀礦石', 1)]),
    # ================= 靈狐族：胡家的名冊 =================
    story('yhh_lost_tongue', 'D', '不會說狐語的孩子',
          '城裡胡記的一個孩子被送回青丘屯住一個夏天，他不會說狐語，被屯裡的孩子嘲笑，跑進了山裡。',
          {'kind': 'npc', 'npc': TAIYE,
           'text': '胡太爺把旱菸袋往石墩上一磕：「城裡送來的小崽子，叫胡小滿，九娘家的遠親。不會說狐語，屯裡的孩子笑他是『化龍族的狐狸』，他一氣之下跑進林子，到現在還沒回來。林子裡有老黃皮子。」'},
          'yhh_1_started', [
              fight('woods', '到青丘屯的近郊找走失的孩子',
                    '白樺林深處傳來孩子的哭聲。兩隻比人還高的黃皮子老精圍著一棵樹打轉，樹上抱著一個頂著狐耳的小男孩。',
                    out('qingqiu'), 'yhh_1_started', [['yh_old_weasel', 2]],
                    '老黃皮子夾著尾巴逃了。小男孩從樹上爬下來，一頭撞進你懷裡，哭著說了一串大燁的官話——一個狐語的字都沒有。', win_flags=['yhh_found']),
              node('back', '把孩子帶回青丘屯的仙堂',
                   '胡三娘蹲下來，用狐語問他名字。小滿聽不懂，又快哭了。三娘笑了，改用官話說：「沒關係。仙家的話，不是用嘴學的。」',
                   cell('qingqiu', 'lm_yh_xiantang'), 'yhh_found', allies=[SANNIANG, TAIYE],
                   success={'text': '那一晚，白小蕎敲著文王鼓，三娘教小滿唱第一句神調。胡太爺在門口看著，嘟囔了一句「城裡的狐也是狐」，轉身走了。三娘說，名冊上的名字，可不是這樣想的。',
                            'set_flags': ['yhh_1_done'], 'effects': [aff(TAIYE, 12, '找回了走失的孩子'), aff(SANNIANG, 5, '找回了走失的孩子'),
                                                                     mem('在青丘屯近郊找回了胡記的孩子胡小滿；城裡的狐不會說狐語，屯裡的狐看不起他們。')],
                            'complete': True}),
          ]),
    story('yhh_spirit_roster', 'C', '仙家的名冊',
          '仙堂的名冊上記著每一位回到胡家仙堂的祖靈。胡三娘發現，三百年前之後，城裡的靈狐族一個都沒有回來過——他們的名字全都不見了。',
          {'kind': 'npc', 'npc': SANNIANG, 'requires': {'flags': ['yhh_1_done']},
           'text': '胡三娘把一本用狐皮包著的名冊攤在炕上：「胡家仙的名冊，從青丘第一代記到現在。你看——三百年前，大燁開國那年之後，城裡的狐，一個名字都沒有了。不是他們沒死，是他們沒回來。」'},
          'yhh_2_started', [
              node('huji', '到瑔州港的胡記商號找胡九娘問城裡的族譜',
                   '胡九娘聽完，笑容收了起來。她從櫃子最深處拿出一本燙金的族譜：胡記每一代當家的名字，都是化龍族的雙名——「胡」只是姓，狐名一個都沒有。',
                   cell('quanzhou', 'lm_yh_huji'), 'yhh_2_started', 'check', check={'attr': 'cha', 'dc': 15},
                   success={'text': '「歸附那年，朝廷要城裡的狐改用大燁的名字，舊名一律燒掉，」九娘說，「燒掉了，仙堂的名冊就找不到他們。我們的祖宗不是不想回家——是回家的路被燒了。」她把族譜交給你：「拿去給三娘。」',
                            'set_flags': ['yhh_book'], 'effects': [aff(JIUNIANG, 8, '問起胡記的族譜')]},
                   fail={'text': '胡九娘笑著把話題轉到茶葉的價錢上。看來得換個時候、換個說法。', 'retry': True}),
              fight('road', '在青丘屯的近郊護送族譜',
                    '回屯的山路上，幾個黑衣刀客攔住去路，領頭的亮出一塊禮部的腰牌：「胡記的族譜，朝廷要收回。」',
                    out('qingqiu'), 'yhh_book', [['yh_blade_for_hire', 2]],
                    '刀客們丟下腰牌逃了。腰牌背面刻著「禮部・祀典司」——想把仙堂改成祖龍祠的，就是這個衙門。', win_flags=['yhh_safe']),
              node('roster', '到青丘屯的仙堂把族譜交給胡三娘',
                   '三娘點起香，二神白小蕎敲起鼓。三娘一個名字一個名字地唸族譜上的雙名，唸到第三個，聲音變了——是胡三太奶的聲音：「這個孩子……我記得他小時候的狐名。」',
                   cell('qingqiu', 'lm_yh_xiantang'), 'yhh_safe', allies=[SANNIANG, XIAOQIAO],
                   success={'text': '那一夜，胡三太奶附在三娘身上，憑著記憶把三百年來城裡的狐名一個一個補回名冊上，補到天亮還沒補完。三娘醒來時累得說不出話，只是笑：「回家的路，接上一半了。」',
                            'set_flags': ['yhh_2_done'], 'effects': [aff(SANNIANG, 12, '替仙堂找回城裡的狐名'), aff(XIAOQIAO, 8, '替仙堂找回城裡的狐名'),
                                                                     mem('把胡記的族譜帶回青丘屯：歸附那年，朝廷燒掉了城裡靈狐族的狐名，胡三太奶憑記憶補回仙堂的名冊。', 3)],
                            'complete': True}),
          ]),
    story('yhh_nine_tails', 'B', '九尾的傳說',
          '靈狐族說九尾只在傳說裡。可是龍安府的情報商說，太廟的檔庫裡有一卷《靈狐歸附錄》，記著最後一位九尾的事——和史書寫的不一樣。',
          {'kind': 'informant', 'location': 'longan', 'price': 300, 'requires': {'flags': ['yhh_2_done']},
           'text': '情報商壓低聲音：「太廟的檔庫，最裡面那一格，有一卷《靈狐歸附錄》。史書說靈狐族『慕化來歸』，那一卷寫的是另一回事。檔庫夜裡有禁軍守，我只能告訴你怎麼進去。」'},
          'yhh_3_started', [
              check('archive', '晚上潛進龍安府太廟的檔庫',
                    '太廟的檔庫在祭殿後面，一排排木格子裡堆滿了竹簡與卷軸。月光從高窗照進來，最裡面那一格貼著封條。',
                    cell('longan', 'lm_yh_taimiao'), 'yhh_3_started', 'dex', 16,
                    '你揭開封條，抽出那一卷：《靈狐歸附錄》。上面寫著：三百年前，最後一位九尾狐王胡青丘，為了保住族人，獨自走進龍安府，跪在大燁開國皇帝的面前，換來靈狐族不被屠戮。代價是：所有城裡的狐改名，九尾的血脈斷絕。',
                    '你碰倒了一卷竹簡，巡夜的腳步聲朝這裡來了。先退出去，換一夜再來。', win_flags=['yhh_scroll'], hours='night'),
              fight('guards', '在太廟擺脫巡夜的禁軍', '你剛把卷軸塞進懷裡，檔庫的門被一腳踹開，兩個禁軍精兵舉著火把衝進來。',
                    cell('longan', 'lm_yh_taimiao'), 'yhh_scroll', [['yh_imperial_guard', 2]],
                    '你撞開禁軍衝出太廟，消失在御街的夜市人潮裡。懷裡的卷軸還在。', win_flags=['yhh_out'], hours='night', urgent=True),
              node('elm', '把《靈狐歸附錄》帶回青丘屯的老榆樹下',
                   '胡太爺讀完卷軸，沉默了很久，旱菸袋在手裡轉來轉去：「九尾……我們都以為那只是故事。原來祖宗不是『慕化來歸』，是拿自己的尾巴換了我們的命。」三娘、小蕎、屯裡的老人都圍了過來。',
                   cell('qingqiu', 'lm_yh_old_elm'), 'yhh_out', 'choice', allies=[TAIYE, SANNIANG], options=[
                       {'label': '把真相告訴所有的靈狐族', 'success': {
                           'text': '胡太爺讓人把卷軸抄了三份：一份供在仙堂，一份送去瑔州港給胡九娘，一份送進宮給太妃。城裡的狐與屯裡的狐，第一次為同一件事哭了一場。朝廷那邊，從此多了一筆說不清的舊帳。',
                           'set_flags': ['yhh_3_done', 'yhh_public'],
                           'effects': [aff(TAIYE, 15, '帶回了九尾的真相'), aff(SANNIANG, 10, '帶回了九尾的真相'), aff(JIUNIANG, 8, '靈狐族的舊帳'), rep(COURT, -3),
                                       mem('從太廟的檔庫帶回《靈狐歸附錄》：最後的九尾狐王用自己換了族人的命，靈狐族並不是「慕化來歸」。真相傳遍了靈狐族。', 3)],
                           'complete': True}},
                       {'label': '只供在仙堂', 'success': {
                           'text': '胡太爺把卷軸供在仙堂最高的牌位旁：「讓祖宗知道我們記得就好。外面的事，外面的人去吵。」三娘點了一炷香，香煙筆直地往上飄。',
                           'set_flags': ['yhh_3_done'], 'effects': [aff(TAIYE, 12, '帶回了九尾的真相'), aff(SANNIANG, 8, '帶回了九尾的真相'),
                                                                     mem('從太廟的檔庫帶回《靈狐歸附錄》，供在青丘屯的仙堂。', 3)],
                           'complete': True}},
                   ]),
          ], extra_rewards=[item('秘銀礦石', 1)]),
]


# 任務線（簡介最後的「（線名・一）」：攻略與流程圖用來分組）
LINES = {'yhf_east_ship': '渡海引導・一', 'yhf_fanfang': '渡海引導・二', 'yhl_ancestor_rite': '化龍族：點青・一', 'yhl_glazed_scale': '化龍族：點青・二', 'yhl_heatwave_song': '化龍族：點青・三', 'yhh_lost_tongue': '靈狐族：胡家的名冊・一', 'yhh_spirit_roster': '靈狐族：胡家的名冊・二', 'yhh_nine_tails': '靈狐族：胡家的名冊・三'}
for _s in STORIES:
    if _s['id'] in LINES and not _s['summary'].endswith('）'):
        _s['summary'] += '（%s）' % LINES[_s['id']]


if __name__ == '__main__':
    write_stories(STORIES)
