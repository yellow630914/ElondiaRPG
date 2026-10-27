# 第二十三批：任務線裡「看起來很強」的對手改成頭目（頭目 + 一隻原本的小怪）
import json, re
SP = 'worldgen/scripts/elondia/'
E = {e['id']: e for e in json.load(open('data/rules/enemies.json'))['enemies']}
ATTRS = {
  'str': {"str": 22, "dex": 12, "int": 10, "fai": 12, "cha": 10},
  'dex': {"str": 14, "dex": 22, "int": 12, "fai": 12, "cha": 12},
  'int': {"str": 10, "dex": 14, "int": 22, "fai": 14, "cha": 14},
  'fai': {"str": 14, "dex": 12, "int": 14, "fai": 22, "cha": 14},
  'cha': {"str": 10, "dex": 16, "int": 16, "fai": 14, "cha": 22},
}
# id, 名字, 搭配的小怪, 種類, 傷害類型, 屬性, 技能, 大招, 抗性, 是否持武器, 描述, 任務
B = [
  ('first_star_heir', '初代魔法少女的殘影', 'star_shadow', 'spirit', 'radiant', 'cha', ['sundial_ray', 'siren_song', 'blur_veil'], 'heavens_wrath', {"radiant": -0.5, "necrotic": 0.25}, False, '星之心的第一位主人留在寶石裡的身影，穿著三百年前的魔法少女服，是歷代最強的那一位。', '魔法少女的畢業典禮'),
  ('grey_wing_seraph', '灰翼熾天使', 'mist_seraph', 'spirit', 'radiant', 'fai', ['judgement_blade', 'sundial_ray', 'wraith_wail'], 'heavens_wrath', {"radiant": -0.5, "necrotic": 0.25}, True, '守在聖者墓前的熾天使之首，六翼被霧染成了灰色，光矛比同伴長了一倍。', '被抹去名字的聖者'),
  ('fallen_dragon_grudge', '墮落龍王的怨念', 'spine_wraith', 'undead', 'necrotic', 'int', ['dark_bolt', 'bone_chill', 'fire_breath'], 'dirge_of_the_dead', {"necrotic": -0.5, "radiant": 0.5}, False, '墮落龍王死前最後的怨恨，順著龍脊流進了血誓碑谷，凝成一團長著龍角的黑紅影子。', '城牆上的遠望'),
  ('forge_titan_prime', '千爐的首號巨像', 'forge_titan', 'construct', 'bludgeoning', 'str', ['charge', 'harden', 'rune_blast'], 'earthshatter', {"fire": -0.5, "lightning": 0.5}, False, '千爐工坊的第一號巨像，熔鐵的身軀比其他巨像高出一截，空洞的胸腔裡燒著最旺的火。', '千爐的巨像、喜歡的定義'),
  ('dream_gatekeeper', '龍夢的守門者', 'dream_warden', 'spirit', 'psychic', 'int', ['mind_spike', 'blur_veil', 'dark_bolt'], 'mind_shatter', {"psychic": -0.5, "radiant": 0.25}, False, '守在龍的夢門口的星光巨影，不准醒著的人往前一步。', '夢裡的龍'),
  ('elder_war_spirit', '血角的古戰靈', 'war_spirit', 'spirit', 'slashing', 'str', ['charge', 'rend', 'battle_roar'], 'frenzy_flurry', {"necrotic": -0.5, "radiant": 0.25}, True, '血角氏族最古老的戰靈，骨甲上刻著幾百年前的戰紋，斧頭燃著紅光。血角戰士看見它都會跪下。', '戰靈的庇佑'),
  ('white_flame_warden', '守門的白焰巨靈', 'white_flame_avatar', 'elemental', 'radiant', 'fai', ['sundial_ray', 'ember_bolt', 'harden'], 'heavens_wrath', {"fire": -0.5, "radiant": -0.5, "cold": 0.25}, False, '遺火塔白焰裡最亮的那一團火，有手有臉，臉上卻沒有表情。據說是神的一角。', '神的一角'),
  ('tomb_warden_elder', '無聲長廊的守墓長', 'tomb_warden', 'spirit', 'necrotic', 'fai', ['bone_chill', 'wraith_wail', 'harden'], 'dirge_of_the_dead', {"necrotic": -0.5, "radiant": 0.5}, True, '無聲長廊最古老的守墓靈，披著石棺蓋，提著藍火燈籠，守著生者與亡者的界線。', '生者的世界、百年後的婚禮'),
  ('mire_wyrm_mother', '沼澤巨蟲的母蟲', 'mire_wyrm', 'beast', 'bludgeoning', 'str', ['drown_grip', 'rend', 'regenerate'], 'acid_deluge', {"acid": -0.5, "fire": 0.25}, False, '沼地深處最老的巨蟲，比房子還長，滿嘴的牙上掛著水草。其他巨蟲都是她生的。', '沼地的豐收祭'),
  ('blaze_warden', '熾之守衛', 'heat_warden', 'elemental', 'fire', 'str', ['ember_bolt', 'charge', 'harden'], 'world_pyre', {"fire": -1, "cold": 0.5}, False, '熾焰之龍卡格尼留在寶藏洞口的熔岩守衛，燒得發白，靠近時只聽得見岩漿沸騰的聲音。', '卡格尼的寶藏'),
  ('elder_gate_warden', '封印之門的古石衛', 'gate_warden', 'construct', 'bludgeoning', 'str', ['charge', 'harden', 'petrify_gaze'], 'earthshatter', {"piercing": -0.25, "lightning": 0.25}, False, '封印之門上最古老的石像，比矮人高三倍，只說三百年前的古矮人語。', '星心礦'),
  ('blight_treant_elder', '被寄生的古樹人長老', 'blight_treant', 'plant', 'bludgeoning', 'str', ['spore_cloud', 'charge', 'regenerate'], 'venom_burst', {"bludgeoning": -0.25, "fire": 0.5}, False, '比城牆還高的古樹人長老，樹皮上長滿了白色的孢子，每走一步，地上就多一片枯萎的草。', '月輝之母的新芽'),
  ('great_tide_guardian', '大潮守護靈', 'tide_guardian', 'elemental', 'cold', 'fai', ['tidal_crash', 'drown_grip', 'harden'], 'eternal_frost', {"cold": -0.5, "lightning": 0.5}, False, '海靈祠井底的潮汐之靈，聲音像浪打在礁石上，考驗想要風母之贈的人。', '湧泉之心'),
  ('mist_scale_warden', '霧鱗的守衛長', 'mist_scale_guardian', 'spirit', 'psychic', 'str', ['mind_spike', 'blur_veil', 'charge'], 'mind_shatter', {"psychic": -0.5, "radiant": 0.25}, True, '夢之龍索利安的投影帶下來的守衛之首，身披霧色鱗甲，沒有臉，也從不出聲。', '索利安的投影'),
  ('mist_warden_patriarch', '守霧者的家主', 'mist_warden', 'humanoid', 'cold', 'int', ['bone_chill', 'curse', 'blur_veil'], 'eternal_frost', {"cold": -0.5, "fire": 0.25}, True, '五百年前親手把自己和家人關進霧裡的精靈術士之首，身體已經有一半變成了霧。', '霧後面的東西'),
  ('first_ancestor_spirit', '貓魅族的始祖靈', 'ancestor_spirit', 'spirit', 'slashing', 'dex', ['rend', 'gale', 'blur_veil'], 'sky_roar', {"necrotic": -0.5, "radiant": 0.25}, False, '由風沙凝成的貓魅族始祖，耳朵與尾巴是千年前的樣子，眼睛是兩團月光。', '祭風原的推舉'),
  ('great_tower_sentinel', '塔的大哨兵', 'tower_sentinel', 'construct', 'bludgeoning', 'str', ['charge', 'harden', 'trample'], 'earthshatter', {"piercing": -0.25, "thunder": 0.5}, False, '巨塔自己疊出來的磚石哨兵，比人高三倍，頭頂還在往上長著尖頂。', '巴別林的塔'),
  ('thousand_year_bloom', '被花香喚醒的千年古樹', 'bloom_treant', 'plant', 'bludgeoning', 'str', ['trample', 'siren_song', 'regenerate'], 'venom_burst', {"bludgeoning": -0.25, "fire": 0.5}, False, '森語之環旁最老的古樹，百年一次的花期讓它醒了過來，花香會讓人站著睡著。', '百年一次'),
  ('old_mire_king', '老沼王鱷', 'mire_croc', 'beast', 'piercing', 'str', ['drown_grip', 'rend', 'harden'], 'frenzy_flurry', {"piercing": -0.25, "cold": 0.25}, False, '腐沼最老的沼王鱷，比漁船還長，背上的鱗甲長滿了青苔。', '腐沼村的婚禮'),
  ('thunder_plume_roc', '雷羽巨鵬', 'storm_roc', 'beast', 'lightning', 'dex', ['lightning_strike', 'rend', 'blur_veil'], 'thunder_judgement', {"lightning": -0.5, "cold": 0.25}, False, '烈日草原上空雷雲裡的巨鵬之王，翅膀遮天，羽毛閃著電光。', '鬃毛之誓'),
  ('withered_forest_warden', '枯萎的森林守護獸', 'blight_colossus', 'plant', 'bludgeoning', 'str', ['charge', 'mummy_rot', 'harden'], 'dirge_of_the_dead', {"necrotic": -0.5, "fire": 0.5}, False, '以前是銀月城森林的守護獸，魔能枯竭之後身上長滿枯藤，所過之處草木一片灰白。', '凡人的時間'),
  ('chief_book_inquisitor', '禁書總審查官', 'book_inquisitor', 'humanoid', 'radiant', 'fai', ['judgement_blade', 'curse', 'battle_roar'], 'heavens_wrath', {"radiant": -0.5, "necrotic": 0.25}, True, '萊茵堡的禁書總審查官，燒過的書比讀過的還多，手裡的聖印閃著白光。', '最後一章'),
]
LV = {'bloodhorn_warmaster': 17}
B.append(('bloodhorn_warmaster', '血角派的戰帥', 'bloodhorn_warlord', 'demon', 'fire', 'str', ['charge', 'battle_roar', 'fire_breath'], 'world_pyre', {"fire": -0.5, "radiant": 0.25}, True, '血角派最後的戰帥，所有戰爭領主都聽他號令，巨斧上的血紅戰紋是他自己的血畫的。', '血角的最後據點'))

def entry(b):
    i, name, minion, kind, wt, wa, ab, ult, res, armed, desc, quest = b
    lv = LV.get(i, 13)
    hi = lv >= 14
    e = {"id": i, "name": name, "level": lv, "attrs": ATTRS[wa], "hp": 1100 if hi else 520, "ap": 8,
         "weapon": {"dice": "4d10" if hi else "3d8", "type": wt, "attr": wa}, "evade": 1, "dr": 6 if hi else 3,
         "abilities": ab + [ult], "ability_hp_below": {ult: 40}, "resist": res, "offense": {"all": 5.5 if hi else 3.0},
         "xp": 3320 if hi else 1850, "habitats": E[minion]['habitats'], "money_cc": [600, 1500] if hi else [300, 800],
         "desc": desc + '（特殊任務「%s」）' % quest, "kind": kind}
    if armed: e["armed"] = True
    return e

p = SP + 'story_enemies.py'
s = open(p).read()
ids = [b[0] for b in B]
lines = [l for l in s.split('\n') if not any(l.strip().startswith('{"id": "%s"' % i) for i in ids)]
end = lines.index(']')
if not lines[end - 1].endswith(','): lines[end - 1] += ','
lines[end:end] = ['  ' + json.dumps(entry(b), ensure_ascii=False).replace(': true', ': True') + ',' for b in B]
lines[end + len(B) - 1] = lines[end + len(B) - 1][:-1]
open(p, 'w').write('\n'.join(lines))
json.dump({b[0]: b[2] for b in B}, open(SP + 'boss23.json', 'w'), ensure_ascii=False)
print(len(B), 'bosses')
