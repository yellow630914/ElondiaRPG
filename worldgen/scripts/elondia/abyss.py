# 底層怪物的設計資料（之後由 build 腳本寫進 enemies.json 與 items.json）
# 欄位：id, 名稱, 等級, kind, 屬性模板, 武器(骰, 類型, 屬性), evade, dr, resist, abilities, 掉落 [(物品, 機率, 數量)], 其他(rut/armed/money), 描述, 目標下數
T = {
 'brute':  {'str': 22, 'dex': 16, 'int': 8,  'fai': 14, 'cha': 10},
 'agile':  {'str': 16, 'dex': 22, 'int': 10, 'fai': 14, 'cha': 10},
 'mind':   {'str': 10, 'dex': 16, 'int': 22, 'fai': 14, 'cha': 14},
 'faith':  {'str': 12, 'dex': 16, 'int': 12, 'fai': 22, 'cha': 14},
 'charm':  {'str': 10, 'dex': 16, 'int': 12, 'fai': 14, 'cha': 22},
 'beast':  {'str': 22, 'dex': 16, 'int': 3,  'fai': 14, 'cha': 6},
 'cbrute': {'str': 22, 'dex': 14, 'int': 3,  'fai': 14, 'cha': 3},
}
UNDEAD = {'poison': -1, 'necrotic': -0.5, 'radiant': 0.5}
M = []  # 每一筆：dungeon, role('a'|'b'|'boss'), dict
def add(dg, role, **kw): M.append((dg, role, kw))

# ---------- 中央平原 ----------
add('snake_creek','a', id='serpent_elder', name='古蛇魔', kind='beast', t='beast', w=('2d12','piercing','str'), evade=1, dr=4,
    resist={'poison': -1, 'cold': 0.5}, ab=['venom_bite','drown_grip'], loot=[('古蛇魔的蛻皮',0.5)], rut=True,
    desc='在蛇溪最深的暗河裡活了幾百年的蛇魔，身體比渡船還長。', hits=2.8)
add('snake_creek','b', id='venom_hydra', name='毒霧九頭蛇', kind='beast', t='beast', w=('3d8','poison','str'), evade=0, dr=3,
    resist={'poison': -1, 'cold': 0.5, 'fire': 0.25}, ab=['poison_gas','venom_bite','regenerate'], loot=[('九頭蛇的毒囊',0.5)],
    desc='蛇魔母孵出的變種，砍掉一顆頭很快又長回來，每張嘴都吐著毒霧。', hits=2.7)
add('snake_creek','boss', id='serpent_progenitor', name='蛇魔始祖', kind='beast', t='beast', w=('4d8','piercing','str'), evade=1, dr=5,
    resist={'poison': -1, 'cold': 0.5}, ab=['venom_bite','drown_grip','poison_gas','regenerate'],
    loot=[('蛇魔始祖的毒牙',1),('古蛇魔的蛻皮',1),('龍皮',0.6),('古龍皮',0.1)],
    desc='所有溪蛇魔的源頭，盤踞在暗河盡頭的地底湖。蛇魔母不過是牠的後代之一。', hits=12.5)

add('whisper_crypt','a', id='imperial_revenant', name='帝國亡靈禁衛', kind='undead', t='brute', w=('2d12','slashing','str'), evade=0, dr=5,
    resist={**UNDEAD, 'piercing': -0.25}, ab=['charge','battle_roar'], loot=[('禁衛的黑鋼鎧片',0.5)], armed=True, money=(60,240),
    desc='統一戰爭時將軍的禁衛隊，死後仍守在陵寢最深處的大廳。', hits=2.8)
add('whisper_crypt','b', id='crypt_lich', name='墓穴巫妖', kind='undead', t='mind', w=('3d8','necrotic','int'), evade=2, dr=0,
    resist={**UNDEAD, 'cold': -0.5}, ab=['dark_bolt','curse','bone_chill'], loot=[('巫妖的護命匣碎片',0.5)],
    desc='替將軍守護封印的宮廷法師，把自己的靈魂鎖進了護命匣。', hits=2.2)
add('whisper_crypt','boss', id='emperor_of_whispers', name='低語皇帝', kind='undead', t='charm', w=('4d8','necrotic','cha'), evade=2, dr=2,
    resist={**UNDEAD, 'psychic': -0.5}, ab=['wraith_wail','curse','dark_bolt','dark_mend'],
    loot=[('低語皇帝的冠冕',1),('禁衛的黑鋼鎧片',1),('精金礦石',0.5),('星隕鐵塊',0.05)], money=(500,1300),
    desc='墓穴真正的主人：統一戰爭中被將軍們弒殺的皇帝。風中的低語都是他在下令。', hits=11.5)

add('mist_abbey','a', id='heretic_inquisitor', name='異端審判官', kind='humanoid', t='faith', w=('2d12','radiant','fai'), evade=1, dr=3,
    resist={'radiant': -0.5, 'necrotic': 0.25}, ab=['sundial_ray','curse','battle_roar'], loot=[('審判官的燒灼印章',0.5)], armed=True, money=(60,240),
    desc='當年審判修道院的審判官，被困在霧裡的禁地，至今還在審訊每一個闖入者。', hits=2.4)
add('mist_abbey','b', id='mist_seraph', name='霧中熾天使', kind='spirit', t='faith', w=('3d8','radiant','fai'), evade=3, dr=0,
    resist={'radiant': -1, 'necrotic': 0.5, 'physical': -0.5}, ab=['sundial_ray','blur_veil','wraith_wail'], loot=[('熾天使的霧羽',0.5)],
    desc='修士們召喚卻無法控制的存在，六翼被霧染成灰色，分不清是神聖還是瘋狂。', hits=2.2)
add('mist_abbey','boss', id='forbidden_saint', name='禁忌的聖者', kind='spirit', t='faith', w=('4d8','radiant','fai'), evade=2, dr=2,
    resist={'radiant': -1, 'physical': -0.5, 'necrotic': 0.5}, ab=['sundial_ray','wraith_wail','dark_mend','curse'],
    loot=[('聖者的禁忌經卷',1),('熾天使的霧羽',1),('世界樹的枝條',0.5),('神木心材',0.05)],
    desc='修道院守護的禁忌秘密：一位被教廷抹去名字的聖者，他的神蹟太過接近異端。', hits=11)

# ---------- 北境群山 ----------
add('redemption_pit','a', id='blackiron_overseer', name='黑鐵獄卒長', kind='construct', t='cbrute', w=('2d12','bludgeoning','str'), evade=-1, dr=7,
    resist={'poison': -1, 'psychic': -1, 'fire': -0.5, 'lightning': 0.5}, ab=['trample','harden'], loot=[('黑鐵獄卒長的鎖鏈',0.5)],
    desc='黑鐵獄層的看守，矮人鑄來關押罪人，如今只認得「不准離開」這條命令。', hits=3)
add('redemption_pit','b', id='penance_wraith', name='贖罪怨魂', kind='undead', t='charm', w=('3d8','necrotic','cha'), evade=2, dr=0,
    resist={**UNDEAD, 'fire': 0.25, 'physical': -0.25}, ab=['wraith_wail','curse','bone_chill'], loot=[('刻著銘文的贖罪石',0.5)],
    desc='沒能刻完贖罪銘文就死在獄中的罪人，身上爬滿發光的文字。', hits=2.2)
add('redemption_pit','boss', id='blackiron_tyrant', name='黑鐵獄層的暴君', kind='construct', t='cbrute', w=('4d8','fire','str'), evade=0, dr=7,
    resist={'poison': -1, 'psychic': -1, 'fire': -1, 'cold': 0.5}, ab=['trample','fire_breath','harden','battle_roar'],
    loot=[('暴君的熔鐵心核',1),('黑鐵獄卒長的鎖鏈',1),('精金礦石',0.6),('星隕鐵塊',0.08)],
    desc='黑鐵獄層最底下的熔爐之心，矮人傳說中所有黑鐵怨靈都是它吞下的罪人。', hits=14)

add('echo_rift','a', id='echo_colossus', name='回聲巨像', kind='construct', t='cbrute', w=('2d12','thunder','str'), evade=0, dr=5,
    resist={'thunder': -1, 'poison': -1, 'psychic': -1, 'lightning': 0.25}, ab=['sonic_scream','trample'], loot=[('共鳴水晶核',0.5)],
    desc='矮人探險隊想用來封印裂谷的巨像，現在只會重複當年最後的那聲轟鳴。', hits=2.8)
add('echo_rift','b', id='mimic_specter', name='擬聲之魅', kind='spirit', t='charm', w=('3d8','psychic','cha'), evade=3, dr=0,
    resist={'psychic': -0.5, 'physical': -0.5, 'radiant': 0.5}, ab=['siren_song','sonic_scream','blur_veil'], loot=[('凝固的回聲',0.5)],
    desc='用死去同伴的聲音呼喚你的幽影，聲音越熟悉越危險。', hits=2.2)
add('echo_rift','boss', id='spirit_of_echoes', name='回聲之靈的本體', kind='spirit', t='charm', w=('4d8','thunder','cha'), evade=2, dr=1,
    resist={'thunder': -1, 'psychic': -0.5, 'physical': -0.5, 'radiant': 0.5}, ab=['sonic_scream','siren_song','wraith_wail','blur_veil'],
    loot=[('回聲之靈的核心',1),('凝固的回聲',1),('龍皮',0.5),('古龍皮',0.05)],
    desc='裂谷所有回聲的源頭。它沒有形體，只有一個不斷模仿亡者的聲音。', hits=11)

add('giants_spine','a', id='rune_titan', name='符文泰坦', kind='construct', t='cbrute', w=('2d12','force','str'), evade=0, dr=6,
    resist={'poison': -1, 'psychic': -1, 'force': -0.5, 'lightning': 0.25}, ab=['rune_blast','trample'], loot=[('泰坦的符文石板',0.5)],
    desc='巨人時代留下的符文守衛，身上的古符迴路一亮，山就會跟著震。', hits=2.9)
add('giants_spine','b', id='storm_giant', name='風暴巨人', kind='humanoid', t='brute', w=('3d8','lightning','str'), evade=1, dr=4,
    resist={'lightning': -1, 'thunder': -0.5, 'cold': 0.25}, ab=['lightning_strike','gale','trample'], loot=[('風暴巨人的雷角',0.5)], armed=True,
    desc='在山脊最高處呼喚雷暴的巨人，據說是冰霜巨人的長兄。', hits=2.7)
add('giants_spine','boss', id='primordial_giant', name='遠古巨人之王', kind='humanoid', t='brute', w=('4d8','bludgeoning','str'), evade=1, dr=5,
    resist={'cold': -0.5, 'lightning': -0.5, 'fire': 0.25}, ab=['trample','frost_breath','lightning_strike','battle_roar'],
    loot=[('巨人王的骨冠',1),('泰坦的符文石板',1),('精金礦石',0.6),('星隕鐵塊',0.06)], armed=True,
    desc='巨人之嵴本身就是他的脊骨。山體深處，這位遠古之王還沒有完全死去。', hits=14)

# ---------- 南境枯萎荒原 ----------
add('ember_rift','a', id='ember_titan', name='餘燼泰坦', kind='elemental', t='cbrute', w=('2d12','fire','str'), evade=0, dr=5,
    resist={'fire': -1, 'poison': -1, 'cold': 0.5}, ab=['fire_breath','trample'], loot=[('不滅的餘燼塊',0.5)],
    desc='由原初魔焰凝成的巨人，每一步都在岩壁上留下熔化的腳印。', hits=2.8)
add('ember_rift','b', id='flame_herald', name='魔焰傳令者', kind='demon', t='mind', w=('3d8','fire','int'), evade=2, dr=1,
    resist={'fire': -1, 'radiant': 0.5, 'cold': 0.25}, ab=['ember_bolt','fire_breath','blur_veil'], loot=[('傳令者的焰紋卷軸',0.5)],
    desc='替魔焰之源傳話的魔族術士，開口的每個字都會燒起來。', hits=2.3)
add('ember_rift','boss', id='heart_of_flame', name='魔焰之源', kind='elemental', t='mind', w=('4d8','fire','int'), evade=1, dr=3,
    resist={'fire': -1, 'poison': -1, 'cold': 0.5, 'radiant': 0.25}, ab=['fire_breath','ember_bolt','regenerate','trample'],
    loot=[('魔焰之源的火種',1),('不滅的餘燼塊',1),('龍皮',0.6),('古龍皮',0.08)],
    desc='裂隙最底下流淌的原初魔焰本身。魔族說，所有魔能都從這裡開始。', hits=13)

add('bloodrock_cave','a', id='blood_oath_paladin', name='血誓聖騎', kind='demon', t='faith', w=('2d12','necrotic','fai'), evade=0, dr=5,
    resist={'fire': -0.5, 'necrotic': -0.5, 'radiant': 0.25}, ab=['charge','dark_mend','battle_roar'], loot=[('血誓聖騎的徽章',0.5)], armed=True, money=(60,240),
    desc='古王最親近的護衛，以血為誓守護聖所的最深處，連死亡也沒能解除誓約。', hits=2.8)
add('bloodrock_cave','b', id='blood_horror', name='血肉恐魔', kind='demon', t='beast', w=('3d8','slashing','str'), evade=1, dr=2,
    resist={'necrotic': -0.5, 'radiant': 0.5, 'fire': -0.25}, ab=['rend','regenerate'], loot=[('凝固的魔血',0.5)], rut=True,
    desc='血誓儀式失控的產物，岩壁滲出的紅漿聚成的怪物，只知道吞噬。', hits=2.5)
add('bloodrock_cave','boss', id='first_oathbreaker', name='最初的背誓者', kind='demon', t='charm', w=('4d8','necrotic','cha'), evade=2, dr=3,
    resist={'fire': -0.5, 'necrotic': -0.5, 'radiant': 0.5}, ab=['curse','dark_bolt','battle_roar','dark_mend'],
    loot=[('背誓者的血晶',1),('血誓聖騎的徽章',1),('精金礦石',0.5),('星隕鐵塊',0.06)], money=(500,1300),
    desc='遠古魔族戰敗的真正原因：一位背棄血誓的領主。古王把他封在聖所最底下，自己守在上面。', hits=12)

add('hell_greenhouse','a', id='chimera_prototype', name='合成獸原型', kind='beast', t='beast', w=('2d12','slashing','str'), evade=1, dr=3,
    resist={'poison': -0.5, 'fire': 0.25}, ab=['rend','acid_spit','trample'], loot=[('合成獸的縫合核',0.5)], rut=True,
    desc='莉莎爾初期實驗的第一隻合成獸，身上縫著七種魔獸的部位。', hits=2.6)
add('hell_greenhouse','b', id='soul_vine', name='靈魂寄生藤', kind='plant', t='charm', w=('3d8','psychic','cha'), evade=1, dr=1,
    resist={'poison': -1, 'psychic': -0.5, 'fire': 0.5}, ab=['siren_song','spore_cloud','drown_grip'], loot=[('寄生藤的靈魂種子',0.5)],
    desc='會把獵物的靈魂纏進藤蔓裡的植物，藤上掛著還在說話的人臉。', hits=2.3)
add('hell_greenhouse','boss', id='first_experiment', name='第零號實驗體', kind='plant', t='mind', w=('4d8','acid','int'), evade=1, dr=3,
    resist={'poison': -1, 'psychic': -0.5, 'fire': 0.5}, ab=['spore_cloud','acid_spit','regenerate','siren_song'],
    loot=[('第零號的變異心核',1),('寄生藤的靈魂種子',1),('世界樹的枝條',0.6),('神木心材',0.08)],
    desc='溫室失控的起點：莉莎爾封存的第一個實驗。溫室之心只是它長出的一朵花。', hits=12.5)

# ---------- 古樹森林 ----------
add('moonshadow_roots','a', id='lunar_knight', name='月蝕騎士', kind='humanoid', t='agile', w=('2d12','slashing','dex'), evade=2, dr=3,
    resist={'necrotic': -0.25, 'radiant': 0.25}, ab=['charge','blur_veil','rend'], loot=[('月蝕騎士的銀刃',0.5)], armed=True, money=(60,240),
    desc='古精靈文明的禁衛，守在月之碎片的封印前，盔甲上的月紋早已發黑。', hits=2.6)
add('moonshadow_roots','b', id='root_horror', name='根穴深淵之影', kind='spirit', t='mind', w=('3d8','necrotic','int'), evade=3, dr=0,
    resist={'necrotic': -0.5, 'physical': -0.5, 'radiant': 0.5}, ab=['dark_bolt','ink_cloud','curse'], loot=[('凝結的暗影',0.5)],
    desc='在沒有光的根系迷宮最深處生出的影子，連精靈的夜視都看不見它。', hits=2.2)
add('moonshadow_roots','boss', id='moon_fragment_core', name='月之碎片的本源', kind='construct', t='mind', w=('4d8','force','int'), evade=1, dr=4,
    resist={'force': -0.5, 'psychic': -1, 'poison': -1}, ab=['rune_blast','dark_bolt','regenerate','blur_veil'],
    loot=[('月之碎片的本源結晶',1),('月蝕騎士的銀刃',1),('世界樹的枝條',0.5),('神木心材',0.06)],
    desc='封印在根穴最深處的月之碎片原石。它的化身只是溢出來的魔力。', hits=12.5)

add('thorn_corridor','a', id='memory_devourer', name='吞憶巨獸', kind='beast', t='beast', w=('2d12','psychic','str'), evade=1, dr=3,
    resist={'psychic': -0.5, 'poison': 0.25}, ab=['siren_song','rend'], loot=[('吞憶獸的記憶珠',0.5)], rut=True,
    desc='以迷路者的記憶為食的巨獸，被牠咬到的人會忘記自己為什麼來這裡。', hits=2.6)
add('thorn_corridor','b', id='thorn_dryad', name='荊棘樹精后', kind='fey', t='charm', w=('3d8','piercing','cha'), evade=2, dr=2,
    resist={'poison': -0.5, 'fire': 0.5, 'psychic': -0.25}, ab=['thorn_volley','siren_song','regenerate'], loot=[('樹精后的花冠',0.5)],
    desc='迴廊的荊棘都是她的頭髮，她唱歌的時候，藤牆就會合起來。', hits=2.3)
add('thorn_corridor','boss', id='nature_goddess_shadow', name='自然女神的倒影', kind='fey', t='faith', w=('4d8','psychic','fai'), evade=2, dr=3,
    resist={'poison': -1, 'psychic': -0.5, 'fire': 0.25}, ab=['thorn_volley','siren_song','regenerate','spore_cloud'],
    loot=[('女神倒影的淚滴',1),('樹精后的花冠',1),('世界樹的枝條',0.6),('神木心材',0.08)],
    desc='試煉的最後一關：一面映出你最深恐懼的女神倒影。試煉者只是它的守門人。', hits=12)

add('verdant_hollow','a', id='otherworld_spawn', name='異界孢子母體', kind='plant', t='beast', w=('2d12','poison','str'), evade=0, dr=3,
    resist={'poison': -1, 'fire': 0.5, 'necrotic': -0.25}, ab=['spore_cloud','regenerate'], loot=[('異界孢子囊',0.5)],
    desc='把孢子撒滿整座空洞的母體，表面不停冒出發光的菌傘。', hits=2.7)
add('verdant_hollow','b', id='corrupted_firstborn', name='腐化的初生精靈', kind='undead', t='agile', w=('3d8','piercing','dex'), evade=3, dr=1,
    resist={'poison': -1, 'necrotic': -0.5, 'radiant': 0.5}, ab=['thorn_volley','pin_shot','blur_veil'], loot=[('初生精靈的骨弓',0.5)], armed=True,
    desc='傳說在這裡誕生的第一批精靈，被孢子寄生後仍然在光泉湖邊巡守。', hits=2.3)
add('verdant_hollow','boss', id='otherworld_gate', name='異界之門', kind='plant', t='mind', w=('4d8','necrotic','int'), evade=0, dr=4,
    resist={'poison': -1, 'necrotic': -0.5, 'fire': 0.5}, ab=['spore_cloud','dark_bolt','regenerate','drown_grip'],
    loot=[('異界之門的碎片',1),('異界孢子囊',1),('世界樹的枝條',0.6),('神木心材',0.08)],
    desc='污染世界樹之根的源頭：一道長在樹根上的裂縫，孢子就是從那一邊飄過來的。', hits=13)

# ---------- 東海群島 ----------
add('tidefall_cave','a', id='abyssal_leviathan_spawn', name='深淵海獸幼體', kind='beast', t='beast', w=('2d12','bludgeoning','str'), evade=0, dr=4,
    resist={'cold': -0.5, 'lightning': 0.5}, ab=['tidal_crash','drown_grip'], loot=[('海獸的深淵鱗',0.5)], rut=True,
    desc='從祖忘之淵游上來的巨獸幼體，光是幼體就有半艘船大。', hits=2.8)
add('tidefall_cave','b', id='ancestral_drowner', name='祖靈溺魂', kind='spirit', t='charm', w=('3d8','cold','cha'), evade=3, dr=0,
    resist={'cold': -1, 'physical': -0.5, 'radiant': 0.5}, ab=['siren_song','drown_grip','wraith_wail'], loot=[('祖靈的潮汐淚珠',0.5)],
    desc='被海靈幻象引誘溺亡的凡人，最後也成了引誘別人的祖靈。', hits=2.2)
add('tidefall_cave','boss', id='sea_god_remnant', name='古海神的殘念', kind='spirit', t='faith', w=('4d8','cold','fai'), evade=1, dr=3,
    resist={'cold': -1, 'lightning': 0.5, 'physical': -0.25}, ab=['tidal_crash','drown_grip','wraith_wail','regenerate'],
    loot=[('古海神的殘念之珠',1),('海獸的深淵鱗',1),('龍皮',0.6),('古龍皮',0.08)],
    desc='潮隕洞窟本是古海神的遺骸，而這是祂還沒散去的意志。守望者只是祂的眼睛。', hits=12.5)

add('skull_isle','a', id='salt_lich_captain', name='鹽化巫妖船長', kind='undead', t='mind', w=('2d12','cold','int'), evade=1, dr=2,
    resist={**UNDEAD, 'cold': -0.5}, ab=['dark_bolt','tidal_crash','curse'], loot=[('鹽化的航海圖',0.5)], money=(60,240),
    desc='海盜王麾下的艦隊船長，被鹽化之後仍然對著海圖下令。', hits=2.3)
add('skull_isle','b', id='kraken_tentacle', name='巨妖觸手', kind='beast', t='beast', w=('3d8','bludgeoning','str'), evade=0, dr=4,
    resist={'cold': -0.5, 'lightning': 0.5}, ab=['drown_grip','tidal_crash'], loot=[('巨妖的吸盤',0.5)],
    desc='從古堡地底水道伸出來的觸手，沒有人見過它連著的身體有多大。', hits=2.8)
add('skull_isle','boss', id='kraken_of_skull_isle', name='骷髏潮島的巨妖', kind='beast', t='beast', w=('4d8','bludgeoning','str'), evade=0, dr=5,
    resist={'cold': -0.5, 'lightning': 0.5, 'poison': -0.25}, ab=['drown_grip','tidal_crash','ink_cloud','regenerate'],
    loot=[('巨妖之眼',1),('巨妖的吸盤',1),('龍皮',0.6),('古龍皮',0.08)],
    desc='骷髏潮島其實是它的頭骨。海盜王把寶藏藏在這裡，就是為了讓它看守。', hits=14)

# ---------- 西部荒野 ----------
add('echo_canyon','a', id='catastrophe_echo', name='浩劫的回音', kind='spirit', t='charm', w=('2d12','thunder','cha'), evade=3, dr=0,
    resist={'thunder': -1, 'physical': -0.5, 'radiant': 0.5}, ab=['sonic_scream','wraith_wail'], loot=[('浩劫回音的結晶',0.5)],
    desc='遠古浩劫的最後一聲慘叫，在谷底迴盪了上千年，凝成了形體。', hits=2.2)
add('echo_canyon','b', id='totem_colossus', name='圖騰巨像', kind='construct', t='cbrute', w=('3d8','bludgeoning','str'), evade=0, dr=6,
    resist={'poison': -1, 'psychic': -1, 'lightning': 0.25}, ab=['trample','battle_roar'], loot=[('圖騰巨像的獸骨',0.5)],
    desc='夜爪部落祖先用獸骨堆成的巨像，只在試煉之谷的最深處醒來。', hits=2.9)
add('echo_canyon','boss', id='voice_of_catastrophe', name='浩劫之聲', kind='spirit', t='charm', w=('4d8','thunder','cha'), evade=2, dr=2,
    resist={'thunder': -1, 'physical': -0.5, 'psychic': -0.5, 'radiant': 0.5}, ab=['sonic_scream','wraith_wail','siren_song','blur_veil'],
    loot=[('浩劫之聲的核心',1),('浩劫回音的結晶',1),('龍皮',0.5),('古龍皮',0.06)],
    desc='引發遠古浩劫的那個聲音。圖騰獸王守在上面，就是為了不讓任何人聽見它。', hits=11)

add('quicksand_temple','a', id='solar_guardian', name='太陽神殿守衛', kind='construct', t='cbrute', w=('2d12','radiant','str'), evade=0, dr=6,
    resist={'radiant': -1, 'poison': -1, 'psychic': -1, 'cold': 0.25}, ab=['sundial_ray','harden'], loot=[('太陽守衛的金片',0.5)],
    desc='赫塔尼工匠用黃金與砂岩打造的守衛，胸口嵌著仍在運轉的日晷。', hits=2.9)
add('quicksand_temple','b', id='scarab_swarm_queen', name='聖甲蟲女王', kind='beast', t='agile', w=('3d8','piercing','dex'), evade=2, dr=3,
    resist={'radiant': -0.5, 'poison': -0.5, 'cold': 0.25}, ab=['acid_spit','rend','sand_blast'], loot=[('黃金聖甲蟲殼',0.5)], rut=True,
    desc='所有黃金聖甲蟲的女王，翅膀一振，整條甬道都是金色的沙塵。', hits=2.5)
add('quicksand_temple','boss', id='sun_god_avatar', name='太陽神的化身', kind='construct', t='faith', w=('4d8','radiant','fai'), evade=1, dr=4,
    resist={'radiant': -1, 'poison': -1, 'cold': 0.5}, ab=['sundial_ray','sand_blast','harden','battle_roar'],
    loot=[('太陽神的日輪',1),('太陽守衛的金片',1),('精金礦石',0.6),('星隕鐵塊',0.08)],
    desc='赫塔尼古國獻上一切召喚的太陽神化身。末代法老的詛咒，原來只是它的餘光。', hits=12.5)
