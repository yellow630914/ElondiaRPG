"""炎華之地 P3：炎華南域的新手委託（docs/plan/roadmap/EAST_CONTENT_PLAN.md 8.1 節，6 條）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p3_stories.py
寫進 data/rules/stories.json（同 id 的整筆換掉，可以重跑）。
旗標簡稱：yhm_（被禁的話本三部曲）、yhz_（小柱）、yhd_（黃大膽）、yhp_（阿炮）。
"""

import json
import re

PATH = 'data/rules/stories.json'
SHEN, XIAO, QIAN = 'npc_yh_shen_zhilan', 'npc_yh_xiao_fengyi', 'npc_yh_qian'
XIAOZHU, HASTINGS = 'npc_yh_xiaozhu', 'npc_yh_hastings'
DADAN, SANNIANG = 'npc_yh_huang_dadan', 'npc_yh_hu_sanniang'
APAO, QINYAN = 'npc_yh_apao', 'npc_yh_qin_yan'


def aff(npc, delta, reason):
    return {'type': 'affinity', 'npc': npc, 'delta': delta, 'reason': reason}


def mem(text, importance=2):
    return {'type': 'memory', 'summary': text, 'importance': importance}


def cell(loc, c):
    return {'where': 'cell', 'location': loc, 'cell': c}


STORIES = [
    # ---------------- 入門：被禁的話本 ①～③ ----------------
    {
        'id': 'yh_banned_manuscript', 'title': '被搜走的稿子',
        'summary': '龍安府的話本作家沈知瀾在公會貼了委託：她最新的稿子被宰相府的人當成「妖言」搜走了，想請人幫忙找回來。',
        'rank': 'F',
        'start': {'kind': 'guild', 'location': 'longan',
                  'text': '公會的告示板上貼著一張字跡飛揚的委託：「重金（其實沒多少）尋回被搜走的書稿一份。委託人：瀾生，人在公會等。」'},
        'start_flags': ['yhm_started'],
        'nodes': [
            {
                'id': 'meet', 'title': '在龍安府的公會見委託人沈知瀾',
                'text': '一個穿男式青衫、短髮的化龍族女子從角落站起來，墨鐵色的尾巴甩了一下：「我就是瀾生，本名沈知瀾，寫話本的。前天夜裡，幾個穿相府號衣的家丁闖進我住的地方，把我剛寫完的稿子連同草稿一起搜走，說是『妖言惑眾』。」',
                'at': cell('longan', 'guild'), 'requires': {'flags': ['yhm_started']}, 'kind': 'story', 'allies': [SHEN],
                'success': {
                    'text': '她把一張畫得很醜的家丁畫像塞給你：「他們搜完沒有直接回相府，往瓦舍那邊去了——那幫人最愛在酒館裡喝到天亮。稿子要是被燒了，我這半年就白寫了。拜託你。」',
                    'set_flags': ['yhm_met'], 'effects': [aff(SHEN, 3, '接下了找稿子的委託')],
                },
            },
            {
                'id': 'tavern', 'title': '到龍安府的酒館打聽搜稿的家丁',
                'text': '酒館裡鬧哄哄的，角落一桌穿著相府號衣的家丁剛喝完走人，桌上還留著一張被酒浸濕的紙——上面是幾行工整的字：「……放榜之前，考卷已換……」',
                'at': cell('longan', 'tavern'), 'requires': {'flags': ['yhm_met']}, 'kind': 'check', 'check': {'attr': 'cha', 'dc': 11},
                'success': {
                    'text': '酒保收了你一點小費，壓低聲音說：那幾個家丁把一疊稿子拿去市坊的情報商那裡換了酒錢——相府只要燒掉稿子，他們卻覺得裡面的東西值錢。',
                    'set_flags': ['yhm_lead'],
                },
                'fail': {
                    'text': '酒保搖頭說什麼都沒看到；你只撿到那張濕掉的紙。或許該換個說法再問一次。', 'retry': True,
                },
            },
            {
                'id': 'informant', 'title': '到龍安府市坊的情報商把稿子要回來',
                'text': '市坊的情報商是個瞇眼的老狐狸，桌上正攤著那疊稿子，一邊看一邊笑：「寫得真好，罵得真狠。相府要燒，我偏要抄一份——客官想要？價錢好說。」',
                'at': cell('longan', 'informant'), 'requires': {'flags': ['yhm_lead']}, 'kind': 'choice',
                'options': [
                    {'label': '付錢買回來（40 白鸛）', 'success': {
                        'text': '情報商數著錢，把稿子推過來：「原稿相府的人已經拿走燒了，這是我抄的一份。少了最後兩頁——那兩頁他們帶走了，說是要交給管家。」',
                        'effects': [{'type': 'money', 'amount': -40}], 'set_flags': ['yhm_copy']}},
                    {'label': '說相府要找他麻煩', 'check': {'attr': 'cha', 'dc': 13}, 'success': {
                        'text': '情報商的笑僵住了，乖乖把抄本交出來：「最後兩頁被相府的人帶走了，說要交給管家……客官，你沒見過我。」',
                        'set_flags': ['yhm_copy']}, 'fail': {
                        'text': '情報商笑得更開心了：「相府？相府付的錢比你多。」他把稿子收進抽屜。看來只能出錢了。', 'retry': True}},
                    {'label': '趁他不注意把稿子摸走', 'check': {'attr': 'dex', 'dc': 13}, 'success': {
                        'text': '你趁他起身倒茶時把稿子塞進懷裡，回頭才發現少了最後兩頁——大概早就被相府的人拿走了。',
                        'set_flags': ['yhm_copy']}, 'fail': {
                        'text': '你的手剛碰到稿子，情報商就按住了：「客官，這裡的東西都要錢的。」他沒有叫人，只是把價錢加了一倍——下次再來吧。', 'retry': True}},
                ],
            },
            {
                'id': 'return', 'title': '到龍安府瓦舍的勾欄把稿子交給沈知瀾',
                'text': '沈知瀾在瓦舍勾欄的後台等你，一把抓過抄本翻到最後：「……最後兩頁不見了。偏偏是那兩頁。」她咬著指甲想了一會兒，抬頭笑了：「沒關係，我記得。而且有人想把它演出來。」',
                'at': cell('longan', 'lm_yh_goulan'), 'requires': {'flags': ['yhm_copy']}, 'kind': 'story', 'allies': [SHEN],
                'success': {
                    'text': '勾欄之主蕭鳳儀搖著團扇走過來，看了兩行就笑出聲：「這齣戲我要了。今晚就讓說書人先講一段——相府要燒的東西，龍安府的人最愛聽。」沈知瀾拉著你的袖子：「你也留下來吧，我總覺得今晚不會太平。」',
                    'set_flags': ['yhm_done'],
                    'effects': [aff(SHEN, 10, '找回了被搜走的稿子'), aff(XIAO, 3, '帶來了一齣好戲'),
                                mem('替話本作家沈知瀾從市坊的情報商那裡找回了被相府搜走的書稿；稿子的最後兩頁被相府的人帶走了。'),
                                {'type': 'start_story', 'story': 'yh_storyteller'}],
                    'complete': True,
                },
            },
        ],
        'rewards': [{'type': 'money', 'amount': 120}, {'type': 'xp', 'amount': 120}],
    },
    {
        'id': 'yh_storyteller', 'title': '瓦舍的說書人',
        'summary': '蕭鳳儀要在瓦舍勾欄讓說書人講沈知瀾被禁的話本。相府不會坐視不管，沈知瀾請你今晚留在勾欄看著。',
        'rank': 'E',
        'start': {'kind': 'manual',
                  'text': '勾欄的戲牌換上了新的名字：「瀾生新作・說書一場」。看客們交頭接耳，說這是相府要燒的書。'},
        'start_flags': ['yhm_story_started'],
        'nodes': [
            {
                'id': 'evening', 'title': '晚上到龍安府瓦舍的勾欄看守說書場',
                'text': '說書人醒木一拍，講到「某宰相夜調考卷」一段，滿堂的看客笑得拍桌子。後排忽然站起幾個滿身酒氣的地痞，掀了桌子大罵「妖言惑眾」，抄起板凳就往台上衝。',
                'at': cell('longan', 'lm_yh_goulan'), 'hours': 'night', 'requires': {'flags': ['yhm_story_started']},
                'kind': 'combat', 'enemies': [['jianjing_robber', 2]], 'allies': [SHEN],
                'success': {
                    'text': '地痞們被你打得抱頭鼠竄，只有一個被沈知瀾用板凳絆倒，壓在地上動彈不得。說書人擦擦汗，醒木一拍：「各位看官，咱們接著講——」看客們叫好的聲音比剛才還大。',
                    'set_flags': ['yhm_brawl_won'],
                },
                'fail': {
                    'text': '地痞們砸了半個場子揚長而去，說書人躲在台下發抖。蕭鳳儀冷著臉讓人收拾：「明晚再演。這一次，找多一點人。」', 'retry': True,
                },
            },
            {
                'id': 'captive', 'title': '在龍安府瓦舍的勾欄審問抓到的地痞',
                'text': '被壓住的地痞哭喪著臉招了：是相府的一個管家給了他們每人五十文，叫他們來砸場子；管家還說，明晚他要在御街夜市的茶坊跟人「交貨」。',
                'at': cell('longan', 'lm_yh_goulan'), 'requires': {'flags': ['yhm_brawl_won']}, 'kind': 'choice', 'allies': [SHEN],
                'options': [
                    {'label': '交給巡夜的禁軍', 'success': {
                        'text': '巡夜的禁軍把人帶走了，帶隊的朱砂鱗小隊長看了看戲牌，小聲說：「這齣戲，弟兄們也想聽。」',
                        'effects': [{'type': 'reputation', 'faction': 'yanye_court', 'delta': 2}], 'set_flags': ['yhm_story_done'],
                        'complete': True}},
                    {'label': '交給蕭鳳儀處置', 'success': {
                        'text': '蕭鳳儀用團扇挑起地痞的下巴，笑得很溫柔：「以後在瓦舍，你替我看門。」地痞連連磕頭。她轉頭對你眨眨眼：「這種人，留著比關起來有用。」',
                        'effects': [aff(XIAO, 6, '把砸場子的人交給她處置')], 'set_flags': ['yhm_story_done'], 'complete': True}},
                    {'label': '放他走，換他盯著管家', 'check': {'attr': 'cha', 'dc': 12}, 'success': {
                        'text': '地痞拍著胸口保證：管家明晚戌時在御街夜市最大那間茶坊的二樓。沈知瀾看著他溜走，搖搖頭：「你比我還會寫戲。」',
                        'effects': [aff(SHEN, 3, '放走地痞換消息')], 'set_flags': ['yhm_story_done', 'yhm_tip'], 'complete': True}, 'fail': {
                        'text': '地痞一出門就跑得沒影了。沈知瀾嘆了口氣：「算了，反正他也招了——明晚，御街夜市。」',
                        'set_flags': ['yhm_story_done'], 'complete': True}},
                ],
            },
        ],
        'rewards': [{'type': 'money', 'amount': 150}, {'type': 'xp', 'amount': 150},
                    {'type': 'start_story', 'story': 'yh_night_market'}],
    },
    {
        'id': 'yh_night_market', 'title': '御街的夜市',
        'summary': '砸場子的地痞說，相府的管家要在御街夜市的茶坊跟人「交貨」。沈知瀾想知道，相府搶走她稿子的最後兩頁，到底要交給誰。',
        'rank': 'E',
        'start': {'kind': 'manual', 'text': '沈知瀾把剩下的抄本塞進懷裡：「最後兩頁寫的是考卷怎麼被調換的。我要知道他們拿去做什麼。」'},
        'start_flags': ['yhm_night_started'],
        'nodes': [
            {
                'id': 'teahouse', 'title': '晚上到龍安府御街夜市找錢掌櫃',
                'text': '御街的燈籠一路亮到宣德樓下，錢掌櫃的茶坊擠滿了人。胖掌櫃聽你說明來意，眼睛眯成一條縫：「相府的管家？二樓雅座，戌時，他每個月都來，跟貢院的一個書吏喝茶。」',
                'at': cell('longan', 'lm_yh_night_market'), 'hours': 'night', 'requires': {'flags': ['yhm_night_started']}, 'kind': 'story',
                'success': {
                    'text': '錢掌櫃收了一點茶錢，替你在雅座隔壁留了個位子：「茶坊的牆薄，什麼都聽得見。聽到什麼，記得也分我一份。」',
                    'set_flags': ['yhm_upstairs'], 'effects': [aff(QIAN, 3, '在茶坊打聽相府的管家')],
                },
            },
            {
                'id': 'eavesdrop', 'title': '晚上在御街夜市的茶坊二樓偷聽',
                'text': '隔著一道薄牆，相府的管家正把兩頁紙推給一個穿青衫的書吏：「這兩頁燒了。另外，今年的卷子照舊——葉主考批過的那幾份，換掉。」',
                'at': cell('longan', 'lm_yh_night_market'), 'hours': 'night', 'requires': {'flags': ['yhm_upstairs']},
                'kind': 'check', 'check': {'attr': 'dex', 'dc': 13},
                'success': {
                    'text': '你一句不漏地聽完：相府在貢院裡調換考卷，換掉的是太學主考葉孤鴻批給寒門士子的高分卷子。書吏把那兩頁紙湊到燭火上燒了——但你已經聽見了。',
                    'set_flags': ['yhm_heard'],
                },
                'fail': {
                    'text': '椅子嘎吱一響，隔壁的話聲停了。門簾一掀，兩個護院衝了進來——管家趁亂從後門溜走，你只聽見了半句「……換掉」。',
                    'set_flags': ['yhm_spotted'],
                },
            },
            {
                'id': 'guards', 'title': '在御街夜市甩開相府的護院',
                'text': '兩個相府的護院把你堵在茶坊的樓梯口，袖子裡露出短刀。',
                'at': cell('longan', 'lm_yh_night_market'), 'hours': 'night', 'urgent': True, 'requires': {'flags': ['yhm_spotted']},
                'kind': 'combat', 'enemies': [['salt_smuggler', 1], ['jianjing_robber', 1]],
                'success': {
                    'text': '護院倒在樓梯下，夜市的人群圍上來看熱鬧。錢掌櫃從櫃檯後探出頭，小聲說：管家跟一個貢院的書吏喝茶，說的是考卷。',
                    'set_flags': ['yhm_heard'],
                },
                'fail': {
                    'text': '你被打得滾下樓梯，護院揚長而去。錢掌櫃扶你起來，嘆氣說：管家跟一個貢院的書吏喝茶，說的是考卷——這些我也聽得到，你何必拚命。',
                    'set_flags': ['yhm_heard'],
                },
            },
            {
                'id': 'report', 'title': '回龍安府告訴沈知瀾聽到的事',
                'text': '沈知瀾聽完，沉默了很久，手指在桌上一下一下地敲：「葉主考……他是太學裡唯一敢給寒門高分的人。他們換掉的不是卷子，是那些人的一輩子。」',
                'at': {'where': 'npc', 'npc': SHEN, 'location': 'longan'}, 'requires': {'flags': ['yhm_heard']}, 'kind': 'choice',
                'options': [
                    {'label': '把它寫出來', 'success': {
                        'text': '她抓起筆，眼睛發亮：「這一次不寫話本了。我要寫一份誰都看得懂的東西，貼在貢院的牆上。」她把一份抄本塞給你：「你也留一份。要是我被抓了，總得有人記得。」',
                        'effects': [aff(SHEN, 12, '一起查出了考卷被調換的事'), {'type': 'reputation', 'faction': 'jinmo_league', 'delta': 2},
                                    mem('在御街夜市的茶坊聽到宰相府的管家要貢院的書吏調換太學主考葉孤鴻批過的考卷；沈知瀾決定把它寫出來。', 3)],
                        'set_flags': ['yhm_exam_hook', 'yhm_night_done'], 'complete': True}},
                    {'label': '勸她先別聲張', 'check': {'attr': 'cha', 'dc': 12}, 'success': {
                        'text': '她咬著嘴唇想了很久，終於點頭：「好，先去找葉主考。他要是不肯出面，我再寫。」她看著你，笑得有點勉強：「你比我會活命。」',
                        'effects': [aff(SHEN, 8, '勸她先別聲張'), mem('在御街夜市聽到相府調換考卷的事；勸沈知瀾先去找太學主考葉孤鴻，不要急著寫出來。', 3)],
                        'set_flags': ['yhm_exam_hook', 'yhm_quiet', 'yhm_night_done'], 'complete': True}, 'fail': {
                        'text': '「別聲張？」她把筆往桌上一拍，「我就是因為大家都不聲張，才要寫的。」她轉身就走，又回頭丟下一句：「不過，謝謝你去聽。」',
                        'effects': [aff(SHEN, 5, '一起查出了考卷被調換的事')],
                        'set_flags': ['yhm_exam_hook', 'yhm_night_done'], 'complete': True}},
                ],
            },
        ],
        'rewards': [{'type': 'money', 'amount': 180}, {'type': 'xp', 'amount': 180}],
    },
    # ---------------- 人物任務 ----------------
    {
        'id': 'yh_xiaozhu_sea', 'title': '小柱想去看海',
        'summary': '錢掌櫃茶坊的跑堂小柱從沒出過龍安府，想去瑔州港看一眼海，拜託你帶他走一趟。',
        'rank': 'E',
        'start': {'kind': 'npc', 'npc': XIAOZHU,
                  'text': '小柱把一本翻爛的小冊子遞給你，裡面記滿了客人講的海上故事：「我存了一年的錢，想去瑔州港看看海。可是我一個人不敢走官道……你能帶我去嗎？我可以替你背東西！」'},
        'start_flags': ['yhz_started'],
        'nodes': [
            {
                'id': 'leave', 'title': '在龍安府找小柱一起出發',
                'text': '小柱揹著一個比他還大的包袱，跟錢掌櫃告了假，站在城門口不停地回頭看。',
                'at': {'where': 'npc', 'npc': XIAOZHU, 'location': 'longan'}, 'requires': {'flags': ['yhz_started']}, 'kind': 'story',
                'success': {'text': '「走吧！」他深吸一口氣，跨出了龍安府的城門。', 'set_flags': ['yhz_going'], 'join': XIAOZHU},
            },
            {
                'id': 'sea', 'title': '帶小柱到瑔州港的蕃坊看海',
                'text': '蕃坊碼頭外，大海一路鋪到天邊，帆影點點。小柱站在碼頭邊，張著嘴半天說不出話，最後蹲下來，伸手摸了摸海水：「是鹹的……真的是鹹的。」蕃商哈斯丁在旁邊笑：「小子，海的那一邊還有一整片大陸，坐十天的船就到。」',
                'at': cell('quanzhou', 'lm_yh_fanfang'), 'requires': {'flags': ['yhz_going']}, 'kind': 'choice', 'allies': [HASTINGS],
                'options': [
                    {'label': '鼓勵他留下來當水手', 'success': {
                        'text': '小柱的眼睛亮得像燈籠：「我、我真的可以嗎？」哈斯丁拍拍他的肩，說船上正缺一個腿快的小子。小柱把小冊子塞給你：「替我跟掌櫃說一聲……等我從海那邊回來，再講給你聽！」',
                        'effects': [aff(XIAOZHU, 15, '帶他去看了海，鼓勵他留下來'), aff(HASTINGS, 3, '替他的船找了個水手')],
                        'set_flags': ['yhz_sailor'], 'leave': XIAOZHU, 'complete': True}},
                    {'label': '看完就帶他回龍安府', 'success': {
                        'text': '小柱看了一整個下午的海，回程的路上一直在說話，說到後來睡著了。回到龍安府，他把一瓶海水擺在茶坊的櫃檯上，逢人就說那是他自己舀的。',
                        'effects': [aff(XIAOZHU, 12, '帶他去看了海')], 'set_flags': ['yhz_home'], 'leave': XIAOZHU,
                        'travel_to': 'longan', 'complete': True}},
                ],
            },
        ],
        'rewards': [{'type': 'money', 'amount': 120}, {'type': 'xp', 'amount': 150}],
    },
    {
        'id': 'yh_dadan_luck', 'title': '黃大膽的霉運',
        'summary': '青丘屯的獵戶黃大膽被黃皮子討封答錯了，倒霉了一整年。他拜託你幫他解掉這個霉運。',
        'rank': 'E',
        'start': {'kind': 'npc', 'npc': DADAN,
                  'text': '黃大膽舉著一把斷掉的弓，哭喪著臉：「這是今年的第三把！去年冬天黃皮子問我『你看我像人還是像仙』，我說像黃鼠狼……從那天起，我踩什麼陷阱都是自己的。求你幫幫我。」'},
        'start_flags': ['yhd_started'],
        'nodes': [
            {
                'id': 'xiantang', 'title': '到青丘屯的仙堂請胡三娘看事',
                'text': '胡三娘灌了一口燒刀子，二神白小蕎敲起文王鼓，唱起請仙的神調。鼓聲一停，三娘的聲音忽然變得蒼老：「黃家那個小崽子還在記仇呢……解鈴還須繫鈴人。去近郊找牠，好好答一次。」',
                'at': cell('qingqiu', 'lm_yh_xiantang'), 'requires': {'flags': ['yhd_started']}, 'kind': 'story', 'allies': [SANNIANG],
                'success': {
                    'text': '鼓聲再響，三娘打了個哆嗦，又變回那個爽朗的弟馬：「太奶說了什麼？……算了，我也不想知道。黃皮子這種東西，記仇，也好面子。」',
                    'set_flags': ['yhd_told'], 'effects': [aff(SANNIANG, 3, '來仙堂看事')],
                },
            },
            {
                'id': 'weasel', 'title': '在青丘屯近郊找那隻討封的黃皮子',
                'text': '白樺林邊，一隻黃毛的大黃鼬人立起來，學著人樣作揖，眼睛賊亮：「你看我——像人還是像仙？」',
                'at': {'where': 'outskirts', 'location': 'qingqiu'}, 'requires': {'flags': ['yhd_told']}, 'kind': 'choice',
                'options': [
                    {'label': '「像仙。」', 'check': {'attr': 'cha', 'dc': 12}, 'success': {
                        'text': '黃皮子樂得原地打了個滾，朝你拜了三拜：「借你吉言！那個說我像黃鼠狼的小子……算了，看在你的面子上。」牠一溜煙鑽進林子，地上留下一張捲起來的黃鼬皮，像是謝禮。',
                        'effects': [{'type': 'item', 'name': '黃鼬皮', 'qty': 1}], 'set_flags': ['yhd_lifted']}, 'fail': {
                        'text': '你說得太勉強，黃皮子瞇起眼睛：「你騙我。」牠一甩尾巴不見了——看來得再來一次，說得像真的一點。', 'retry': True}},
                    {'label': '「像人。」', 'success': {
                        'text': '黃皮子愣了一下，摸摸自己的臉：「像人……也好，也好。」牠嘆了口氣，朝屯子的方向吹了一口氣：「那小子的霉運，我收回了。」',
                        'set_flags': ['yhd_lifted']}},
                    {'label': '不答，把牠趕走', 'success': {
                        'text': '你拔出武器，黃皮子尖叫一聲，林子裡又竄出一隻——兩隻黃鼬精齊齊撲了上來。',
                        'set_flags': ['yhd_fight']}},
                ],
            },
            {
                'id': 'fight', 'title': '在青丘屯近郊打退黃皮子',
                'text': '兩隻黃皮子繞著你打轉，眼睛發出迷人心竅的光。',
                'at': {'where': 'outskirts', 'location': 'qingqiu'}, 'urgent': True, 'requires': {'flags': ['yhd_fight']},
                'kind': 'combat', 'enemies': [['huang_pizi', 2]],
                'success': {
                    'text': '黃皮子被打得夾著尾巴逃進林子，遠遠地罵了一句：「算你狠！那小子的霉運……還給他就是了！」',
                    'set_flags': ['yhd_lifted', 'yhd_beaten'],
                },
                'fail': {
                    'text': '你被迷得暈頭轉向，醒來時躺在雪地裡，錢袋輕了一點。黃皮子在樹上嘻嘻笑——下次換個辦法吧。',
                    'retry': True, 'effects': [{'type': 'money', 'amount': -20}],
                },
            },
            {
                'id': 'report', 'title': '回青丘屯告訴黃大膽',
                'text': '黃大膽正在屯口試一把新弓，一箭射出去，正中靶心——他自己都嚇了一跳。',
                'at': {'where': 'npc', 'npc': DADAN, 'location': 'qingqiu'}, 'requires': {'flags': ['yhd_lifted']}, 'kind': 'story',
                'success': {
                    'text': '「中了！真的中了！」他抱著你又叫又跳，把家裡最好的一張狍皮塞給你。胡三娘在仙堂門口叉著腰笑：「下次黃皮子再問你，記得說像仙。」',
                    'effects': [aff(DADAN, 15, '替他解掉了黃皮子的霉運'), aff(SANNIANG, 3, '解掉了黃大膽的霉運'),
                                mem('在青丘屯近郊替獵戶黃大膽解掉了黃皮子討封的霉運。', 1)],
                    'complete': True,
                },
            },
        ],
        'rewards': [{'type': 'money', 'amount': 100}, {'type': 'xp', 'amount': 150}],
    },
    {
        'id': 'yh_apao_firecracker', 'title': '阿炮的爆竹',
        'summary': '瑔州港火藥坊的學徒阿炮想造出「不會炸死人的爆竹」，可是師父不給她硝石。她拜託你去火藥坊遺址撿一些回來。',
        'rank': 'E',
        'start': {'kind': 'npc', 'npc': APAO,
                  'text': '阿炮把你拉到牆角，滿臉黑灰：「我想做一種爆竹，砰一聲，天上開花，可是不會炸死人！師父說我拿到硝石就會把坊子炸了，一粒都不給我……火藥坊的舊址周邊多的是，有硝石蟲在啃，你幫我撿一些好不好？」'},
        'start_flags': ['yhp_started'],
        'nodes': [
            {
                'id': 'saltpeter', 'title': '到火藥坊遺址的周邊撿硝石',
                'text': '廢墟邊的硝土上爬滿了肥白的硝石蟲，牠們啃過的地方結著一層白霜似的硝石——也朝你吐出一口嗆鼻的硝水。',
                'at': {'where': 'dungeon', 'location': 'gunpowder_ruins', 'layer': 'outskirts'}, 'requires': {'flags': ['yhp_started']},
                'kind': 'combat', 'enemies': [['saltpeter_worm', 2]],
                'success': {
                    'text': '你從牆角刮下一包雪白的硝石。廢墟深處好像有什麼東西在看著你——但那是另一回事了。',
                    'set_flags': ['yhp_got'], 'effects': [{'type': 'item', 'name': '硝石', 'qty': 3}],
                },
            },
            {
                'id': 'test', 'title': '回瑔州港的火藥坊和阿炮試放',
                'text': '阿炮把硝石、硫磺、炭粉和一撮她偷偷調的彩色藥粉搗在一起，塞進紙筒，點火前回頭看了你一眼：「要是炸了，你就說是你點的。」秦焰在院子另一頭抱著手臂看著。',
                'at': cell('quanzhou', 'lm_yh_gunpowder_works'), 'requires': {'flags': ['yhp_got']}, 'kind': 'check',
                'check': {'attr': 'int', 'dc': 12}, 'allies': [APAO, QINYAN],
                'success': {
                    'text': '紙筒咻地竄上天，「砰」的一聲，在瑔州港的上空開出一朵金色的花。阿炮跳起來尖叫，秦焰板著臉走過來，看了很久，說：「配方抄一份給我。」——這是阿炮第一次被師父誇。',
                    'effects': [aff(APAO, 15, '幫她放出了第一朵煙花'), aff(QINYAN, 5, '幫學徒試出了煙花的配方'),
                                mem('在瑔州港的火藥坊幫學徒阿炮放出了她的第一朵煙花。', 1)],
                    'complete': True,
                },
                'fail': {
                    'text': '紙筒「噗」的一聲在地上炸開，噴了你們兩個滿臉黑灰。秦焰的罵聲從院子另一頭傳過來。阿炮抹抹臉：「配方差一點點……再試一次！」',
                    'effects': [{'type': 'hp', 'ratio': -0.1}], 'retry': True,
                },
            },
        ],
        'rewards': [{'type': 'money', 'amount': 100}, {'type': 'xp', 'amount': 150}],
    },
]


# ---------- 寫檔（照 stories.json 原本的排版：小的物件與陣列放一行） ----------
def inline(v):
    if isinstance(v, dict):
        return '{ ' + ', '.join(json.dumps(k, ensure_ascii=False) + ': ' + inline(x) for k, x in v.items()) + ' }' if v else '{}'
    if isinstance(v, list):
        return '[' + ', '.join(inline(x) for x in v) + ']'
    return json.dumps(v, ensure_ascii=False)


def fmt(v, indent):
    flat = json.dumps(v, ensure_ascii=False)
    pad = ' ' * indent
    if not isinstance(v, (dict, list)) or len(flat) + indent <= 150 or not v:
        return inline(v)
    inner = ' ' * (indent + 2)
    if isinstance(v, list):
        return '[\n' + ',\n'.join(inner + fmt(x, indent + 2) for x in v) + '\n' + pad + ']'
    return '{\n' + ',\n'.join(inner + json.dumps(k, ensure_ascii=False) + ': ' + fmt(x, indent + 2) for k, x in v.items()) + '\n' + pad + '}'


def main():
    src = open(PATH, encoding='utf-8').read()
    data = json.loads(src)
    ids = {s['id'] for s in STORIES}
    existing = [s['id'] for s in data['stories']]
    # 重跑：拿掉這支腳本加的（它們都在最後）
    if any(i in ids for i in existing):
        keep = [s for s in data['stories'] if s['id'] not in ids]
        assert [s['id'] for s in keep] == existing[:len(keep)], '腳本加的任務不在檔尾'
        cut = src.index('\n    {\n      "id": "%s"' % next(i for i in existing if i in ids))
        src = src[:cut].rstrip().rstrip(',') + '\n  ]\n}\n'
    end = src.rstrip().rfind('\n  ]')
    body = ''.join(',\n    ' + fmt(s, 4) for s in STORIES)
    out = src.rstrip()[:end] + body + src.rstrip()[end:] + '\n'
    json.loads(out)
    open(PATH, 'w', encoding='utf-8').write(out)
    print(f'特殊任務 {len(STORIES)} 條')


if __name__ == '__main__':
    main()
