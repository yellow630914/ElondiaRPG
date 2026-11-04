"""炎華之地 P4：劇情計數器與特殊任務用的對手（只在特殊任務出現）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p4_foes.py
- data/rules/counters.json：yh_reform（大燁的走向）、yh_balance（平衡的選擇），見 EAST_CONTENT_PLAN 8.3 節
- data/rules/enemies.json：東大陸劇情用的對手（數值照同等級的劇情對手，之後用模擬調 hp／offense）
同 id 的整筆換掉，可以重跑。
"""

import json

from east_story_io import inline

COUNTERS = {
    'yh_reform': {'name': '大燁的走向', 'desc': '炎華南域各地故事線的結局：幫朝廷、官府、胡記、改祀那一邊 -1，幫改革、農工、金黃鱗、自治那一邊 +1（見 EAST_CONTENT_PLAN 8.3 節）', 'initial': 0},
    'yh_balance': {'name': '大燁的平衡', 'desc': '炎華南域各地故事線選了「平衡」的結局 +1；多了大燁就走向君主立憲', 'initial': 0},
}

H = ['yanhua_south']

# (id, 模板, 覆寫)
FOES = [
    ('yh_street_thug', 'dock_enforcer', dict(name='街頭的打手', level=5, kind='humanoid', armed=True, abilities=['dirty_trick', 'rend'],
        weapon={'dice': '2d6', 'type': 'bludgeoning', 'attr': 'str'},
        desc='龍安府、瑔州港街頭收錢辦事的打手，化龍族的墨鐵鱗居多，拿的是棍棒與短刀；誰給錢就替誰砸場子、堵人。')),
    ('yh_yamen_runner', 'dock_enforcer', dict(name='衙役', level=5, kind='humanoid', armed=True, abilities=['pin_shot'],
        weapon={'dice': '2d6', 'type': 'bludgeoning', 'attr': 'str'},
        desc='官府的衙役，穿著皂衣、拿著水火棍與鐵尺；奉命抓人、查封、拆堂口，上頭叫他們做什麼就做什麼。')),
    ('yh_old_weasel', 'dock_enforcer', dict(name='黃皮子老精', level=5, kind='fey', abilities=['mind_spike', 'curse'],
        weapon={'dice': '2d6', 'type': 'psychic', 'attr': 'cha'}, resist={'psychic': -0.5, 'radiant': 0.25},
        desc='青丘屯山裡修了上百年的老黃鼬精，比討封的黃皮子大上一圈，會迷人心竅、會學人說話，最愛拐屯裡的小孩。')),
    ('yh_blade_for_hire', 'cloister_questioner', dict(name='亡命的刀客', level=8, kind='humanoid', armed=True, abilities=['dirty_trick', 'rend'],
        weapon={'dice': '2d8', 'type': 'slashing', 'attr': 'dex'},
        desc='拿錢替權貴辦髒事的刀客，朴刀上纏著黑布；相府、商幫、鹽梟都雇過他們，誰也不承認。')),
    ('yh_court_soldier', 'cloister_questioner', dict(name='朝廷的兵丁', level=8, kind='humanoid', armed=True, abilities=['charge', 'pin_shot'],
        weapon={'dice': '2d8', 'type': 'piercing', 'attr': 'str'},
        desc='大燁的廂軍兵丁，穿著步人甲、拿著長槍；奉命押綱、鎮壓、查封，餉銀常常被剋扣，脾氣也就越來越壞。')),
    ('yh_rampant_spirit', 'cloister_questioner', dict(name='作亂的仙家', level=8, kind='spirit', abilities=['mind_spike', 'siren_song'],
        weapon={'dice': '2d8', 'type': 'psychic', 'attr': 'cha'}, resist={'physical': -0.5, 'psychic': -0.5, 'radiant': 0.5},
        desc='沒有堂口供奉、四處遊蕩的仙家，附在人身上鬧事：說胡話、砸東西、要酒要肉；送不走的時候，只能先打散它。')),
    ('yh_deathsworn', 'zealot_templar', dict(name='相府的死士', level=11, kind='humanoid', armed=True, abilities=['dirty_trick', 'charge'],
        weapon={'dice': '2d12', 'type': 'slashing', 'attr': 'dex'},
        desc='宰相府暗中養的死士，蒙面、黑衣，刀上淬著毒；被抓住就咬破藏在牙裡的毒丸，從不留活口。')),
    ('yh_imperial_guard', 'zealot_templar', dict(name='禁軍的精兵', level=11, kind='humanoid', armed=True, abilities=['charge', 'battle_roar'],
        weapon={'dice': '2d12', 'type': 'slashing', 'attr': 'str'},
        desc='殿前司的禁軍精兵，朱砂鱗居多，朱漆的步人甲、長柄的朴刀；聽命於上頭的人——不一定是女帝。')),
    # 政治線上半（east_p4c.py）：Lv.14 的小怪與 Lv.15 的頭目（終章的替身）
    ('yh_palace_guard', 'echo_legionnaire', dict(name='殿前司的甲士', level=14, kind='humanoid', armed=True, abilities=['charge', 'battle_roar'],
        weapon={'dice': '3d8', 'type': 'slashing', 'attr': 'str'},
        desc='殿前司最精銳的甲士，朱漆的步人甲、金邊的頭盔；宰相掌兵符的那幾營，只聽相府的令。')),
    ('yh_league_musketeer', 'echo_legionnaire', dict(name='金墨盟的火槍手', level=14, kind='humanoid', armed=True, abilities=['thorn_volley', 'pin_shot'],
        weapon={'dice': '3d8', 'type': 'piercing', 'attr': 'dex'},
        desc='金墨盟激進派用火藥坊的火銃武裝起來的行會子弟，墨鐵鱗居多；他們說，議會的席位要用火藥換。')),
    ('yh_radical_firebrand', 'rhine_guard_marshal', dict(name='激進派的火頭', level=15, kind='humanoid', armed=True, boss=True,
        abilities=['fire_breath', 'battle_roar', 'thorn_volley', 'world_pyre'], ability_hp_below={'world_pyre': 40},
        weapon={'dice': '4d8', 'type': 'fire', 'attr': 'dex'},
        desc='金墨盟激進派的領頭人，一身火藥坊的皮甲，腰上掛滿了霹靂火球；他說女帝收權的那一天，宣德樓就該燒掉。')),
    ('yh_chancellor_marshal', 'rhine_guard_marshal', dict(name='宰相的禁軍統領', level=15, kind='humanoid', armed=True, boss=True,
        abilities=['charge', 'battle_roar', 'trample', 'earthshatter'], ability_hp_below={'earthshatter': 40},
        weapon={'dice': '4d10', 'type': 'slashing', 'attr': 'str'},
        desc='宰相溫世衡的心腹，掌著殿前司三營的兵符；天青鱗世家出身，卻穿著朱砂鱗武人的甲。他說，大燁不能交給商人和織工。')),
]


def write_counters():
    path = 'data/rules/counters.json'
    src = open(path, encoding='utf-8').read()
    data = json.loads(src)
    data['counters'].update(COUNTERS)
    lines = ['    %s: %s' % (json.dumps(k, ensure_ascii=False), inline(v)) for k, v in data['counters'].items()]
    out = '{\n  "$comment": %s,\n  "version": %d,\n  "counters": {\n%s\n  }\n}\n' % (json.dumps(data['$comment'], ensure_ascii=False), data['version'], ',\n'.join(lines))
    json.loads(out)
    open(path, 'w', encoding='utf-8').write(out)


def write_foes():
    path = 'data/rules/enemies.json'
    src = open(path, encoding='utf-8').read()
    data = json.loads(src)
    en = {e['id']: e for e in data['enemies']}
    lines = src.split('\n')
    ids = {f[0] for f in FOES}
    lines = [l for l in lines if not any(l.startswith('    {"id": "%s"' % i) for i in ids)]
    start = next(i for i, l in enumerate(lines) if l.startswith('  "enemies"'))
    end = next(i for i in range(start, len(lines)) if lines[i].strip() in (']', '],'))
    if not lines[end - 1].rstrip().endswith(','):
        lines[end - 1] = lines[end - 1].rstrip() + ','
    new = []
    for fid, tpl, kw in FOES:
        t = en[tpl] if tpl in en else None
        old = en.get(fid)
        e = {'id': fid, 'name': kw['name'], 'level': kw['level'], 'attrs': t['attrs'], 'hp': (old or t)['hp'], 'ap': t['ap'],
             'weapon': kw['weapon'], 'evade': t['evade'], 'dr': t['dr'], 'abilities': kw['abilities']}
        if kw.get('ability_hp_below'):
            e['ability_hp_below'] = kw['ability_hp_below']
        if kw.get('resist'):
            e['resist'] = kw['resist']
        e['offense'] = dict((old or t)['offense'])
        e['xp'] = t['xp']
        e['habitats'] = H
        if kw['kind'] == 'humanoid':
            e['money_cc'] = t.get('money_cc', [20, 80])
        if kw.get('boss'):
            e['loot'] = [{'item': '秘銀礦石', 'chance': 1}, {'item': '精金礦石', 'chance': 0.8}]
        e['desc'] = kw['desc']
        e['kind'] = kw['kind']
        if kw.get('armed'):
            e['armed'] = True
        new.append('    ' + json.dumps(e, ensure_ascii=False) + ',')
    new[-1] = new[-1][:-1]
    lines[end:end] = new
    out = '\n'.join(lines)
    json.loads(out)
    open(path, 'w', encoding='utf-8').write(out)


if __name__ == '__main__':
    write_counters()
    write_foes()
    print(f'計數器 {len(COUNTERS)}、劇情對手 {len(FOES)}')
