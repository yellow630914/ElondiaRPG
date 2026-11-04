"""炎華之地 P8：北原的劇情計數器與特殊任務用的對手。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p8_foes.py（可以重跑）
- data/rules/counters.json：td_war（主戰）、td_peace（主和）、td_haidong（扶海東），見 EAST_CONTENT_PLAN 11.9、11.10 節
- data/rules/enemies.json：北原劇情用的對手。數值照南域同等級、已經用模擬調過的劇情對手（模板就是它們），
  所以不用另外調；之後政治線的頭目另外調。
"""

import east_p4_foes as F

COUNTERS = {
    'td_war': {'name': '媞丹的主戰', 'desc': '炎華北原各地故事線選了「主戰」（天可汗、北院）的結局 +1（見 EAST_CONTENT_PLAN 11.10 節）', 'initial': 0},
    'td_peace': {'name': '媞丹的主和', 'desc': '炎華北原各地故事線選了「主和」（南院、榷場的互市）的結局 +1', 'initial': 0},
    'td_haidong': {'name': '扶海東', 'desc': '炎華北原各地故事線選了「扶海東」（幫海東部）的結局 +1', 'initial': 0},
}

FOES = [
    ('td_horse_raider', 'yh_street_thug', dict(name='茶馬路的馬賊', level=5, kind='humanoid', armed=True, abilities=['charge', 'dirty_trick'],
        weapon={'dice': '2d6', 'type': 'slashing', 'attr': 'str'},
        desc='在茶馬路上打劫商隊的人馬族馬賊，跟著黑鬃混飯吃；搶完就往草原深處跑，誰也追不上。')),
    ('td_smuggler_guard', 'yh_yamen_runner', dict(name='走私的護衛', level=5, kind='humanoid', armed=True, abilities=['pin_shot', 'dirty_trick'],
        weapon={'dice': '2d6', 'type': 'piercing', 'attr': 'dex'},
        desc='替陳茶商押送走私戰馬的護衛，人馬族與化龍族都有；拿的是一半的工錢，另一半是封口費。')),
    ('td_raider_veteran', 'yh_blade_for_hire', dict(name='黑鬃的悍匪', level=8, kind='humanoid', armed=True, abilities=['charge', 'rend'],
        weapon={'dice': '2d8', 'type': 'slashing', 'attr': 'str'},
        desc='馬賊頭目黑鬃身邊最兇的幾個人，臉上都有刀疤；搶過大燁的茶隊，也搶過天可汗的馬群。')),
    ('td_north_rider', 'yh_court_soldier', dict(name='北院的騎兵', level=8, kind='humanoid', armed=True, abilities=['charge', 'pin_shot'],
        weapon={'dice': '2d8', 'type': 'piercing', 'attr': 'str'},
        desc='北院的人馬族騎兵，挎著角弓、拿著長矛；奉命催貢、巡邊、抓人，馬蹄所到的地方，南院的令不算數。')),
    ('td_haidong_hunter', 'yh_court_soldier', dict(name='海東的鷹獵手', level=8, kind='humanoid', armed=True, abilities=['pin_shot', 'rend'],
        weapon={'dice': '2d8', 'type': 'piercing', 'attr': 'str'},
        desc='海東部的鷹獵手，肩上停著海東青，手裡的角弓百步穿楊；平常獵狐獵鹿，被逼急了也獵人。')),
    ('td_steppe_spirit', 'yh_rampant_spirit', dict(name='草原的遊魂', level=8, kind='spirit', abilities=['mind_spike', 'wraith_wail'],
        weapon={'dice': '2d8', 'type': 'psychic', 'attr': 'cha'}, resist={'physical': -0.5, 'necrotic': -0.5, 'radiant': 0.5},
        desc='統一戰爭裡沒能回到長生天的亡魂，在夜裡的草原上遊蕩；敖包的經幡一響，它們就圍過來。')),
    ('td_haidong_elite', 'yh_imperial_guard', dict(name='海東的老鷹獵手', level=11, kind='humanoid', armed=True, abilities=['pin_shot', 'rend'],
        weapon={'dice': '2d12', 'type': 'piercing', 'attr': 'str'},
        desc='海東部最老練的鷹獵手，一張硬角弓拉得開兩石；統一戰爭時，天可汗的騎兵在他們手上吃過最大的虧。')),
    ('td_wrathful_ghost', 'yh_deathsworn', dict(name='無名的怨魂', level=11, kind='spirit', abilities=['mind_spike', 'wraith_wail'],
        weapon={'dice': '2d12', 'type': 'psychic', 'attr': 'str'}, resist={'physical': -0.5, 'necrotic': -0.5, 'radiant': 0.5},
        desc='名字被刮掉的亡魂裡怨氣最重的那些：生前是被天可汗砍倒的部族勇士，死後連長生天都回不去，只剩下恨。')),
    ('td_kheshig', 'yh_imperial_guard', dict(name='怯薛的親衛', level=11, kind='humanoid', armed=True, abilities=['charge', 'battle_roar'],
        weapon={'dice': '2d12', 'type': 'slashing', 'attr': 'str'},
        desc='天可汗的親衛「怯薛」，蒼狼部的子弟居多，黑甲、彎刀、角弓；只聽天可汗與怯薛長鐵牙的令。')),
    ('td_clan_champion', 'yh_deathsworn', dict(name='舊部的勇士', level=11, kind='humanoid', armed=True, abilities=['charge', 'dirty_trick'],
        weapon={'dice': '2d12', 'type': 'slashing', 'attr': 'str'},
        desc='不服大法典的舊部勇士，臉上還畫著被天可汗砍倒的部族圖騰；他們說，草原的規矩是祖先定的，不是寫在紙上的。')),
    # 北原的前期政治線（east_p8c.py）：Lv.14 的小怪與 Lv.15 的頭目（終章的替身），模板是南域政治線上半的對手
    ('td_kheshig_captain', 'yh_palace_guard', dict(name='怯薛的百戶', level=14, kind='humanoid', armed=True, abilities=['charge', 'battle_roar'],
        weapon={'dice': '3d8', 'type': 'slashing', 'attr': 'str'},
        desc='怯薛裡管一百騎的百戶，黑甲上釘著銀釘，馬身披著鐵葉；鐵牙一手帶出來的人，只認天可汗的金牌與鐵牙的令箭。')),
    ('td_south_crossbow', 'yh_league_musketeer', dict(name='南院的弩手', level=14, kind='humanoid', armed=True, abilities=['thorn_volley', 'pin_shot'],
        weapon={'dice': '3d8', 'type': 'piercing', 'attr': 'dex'},
        desc='南院照大燁的兵制練出來的弩手，用的是榷場換來的神臂弩；北院的人笑他們「下了馬的人馬」，他們不理，只管上弦。')),
    ('td_south_marshal', 'yh_radical_firebrand', dict(name='南院的死忠老將', level=15, kind='humanoid', armed=True, boss=True,
        abilities=['charge', 'battle_roar', 'thorn_volley', 'earthshatter'], ability_hp_below={'earthshatter': 40},
        weapon={'dice': '4d8', 'type': 'piercing', 'attr': 'dex'},
        desc='跟著南院大王打過統一戰爭的老將，鬍子白了，弩還拉得開；他說南院的印是天可汗親手給的，要收，先從他的屍首上拿。')),
    ('td_kheshig_marshal', 'yh_chancellor_marshal', dict(name='怯薛的萬戶', level=15, kind='humanoid', armed=True, boss=True,
        abilities=['charge', 'battle_roar', 'trample', 'sky_roar'], ability_hp_below={'sky_roar': 40},
        weapon={'dice': '4d10', 'type': 'slashing', 'attr': 'str'},
        desc='怯薛長鐵牙麾下的萬戶，北院主戰派的刀；他說草原坐下來的那一天，就是蒼狼死的那一天。')),
    ('td_pursuit_captain', 'yh_radical_firebrand', dict(name='追擊的怯薛統領', level=15, kind='humanoid', armed=True, boss=True,
        abilities=['pin_shot', 'thorn_volley', 'trample', 'eternal_frost'], ability_hp_below={'eternal_frost': 40},
        weapon={'dice': '4d8', 'type': 'piercing', 'attr': 'dex'},
        desc='奉命追回海東部的怯薛統領，騎射無雙，冬天也能在雪原上追三天三夜；他說海東青可以飛走，海東部的人不行。')),
]

if __name__ == '__main__':
    F.COUNTERS, F.FOES, F.H = COUNTERS, FOES, ['yanhua_north']
    F.write_counters()
    F.write_foes()
    print(f'計數器 {len(COUNTERS)}、劇情對手 {len(FOES)}')
