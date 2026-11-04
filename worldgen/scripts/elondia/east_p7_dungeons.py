"""炎華之地 P7：炎華北原的兩座地下城（EAST_CONTENT_PLAN 11.4、11.5 節）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p7_dungeons.py（可以重跑；用模擬調過的 hp、offense、ap 會保留）
- 鳴鏑古戰場（金帳王庭外 1 天荒野）：統一戰爭的古戰場，不死與構裝
- 白狼雪窟（鷹河榷場外 2 天山道）：蒼狼部祖先傳說的冰窟，野獸與元素
- 等級照北境群山（+2）：周邊 3、淺層 4、中層 5～6、深層 7～8、底層 11；層主 5／7／9／13
- 數值從北境地下城同等級的怪物當模板，掉落的材料一種怪一件
"""

import json
import re

from east_story_io import write_items

H = ['yanhua_north']
R_UNDEAD = {'poison': -1, 'necrotic': -0.5, 'radiant': 0.5}
R_CONSTRUCT = {'poison': -1, 'psychic': -0.5, 'bludgeoning': 0.25}
R_SPIRIT = {'physical': -0.5, 'necrotic': -0.5, 'radiant': 0.5}
R_ICE = {'cold': -0.5, 'fire': 0.25}
R_ICE_EL = {'cold': -1, 'poison': -1, 'fire': 0.5}

M = []


def m(id, tpl, level, **kw):
    M.append((id, tpl, level, kw))


# ================= 鳴鏑古戰場 =================
m('bone_picker', 'storm_hawk', 3, name='拾骨人', kind='humanoid', armed=True, abilities=['dirty_trick'], resist=None,
  weapon={'dice': '1d8', 'type': 'slashing', 'attr': 'str'}, money_cc=[10, 30],
  loot=[('古戰場的銅箭頭', 18, '統一戰爭時的鳴鏑箭頭，箭頭上的哨孔還吹得響。')],
  desc='在鳴鏑古戰場撿拾遺骨與兵器的人馬族，把撿來的東西賣到鷹河榷場；撞見外人搶他的地盤，就拿撿來的刀砍過去。',
  girl={'name': '人馬娘拾骨人', 'desc': '成年的人馬族女拾骨人，上身裹著打滿補丁的皮袍，腰下是一副灰褐的馬身，馬背上綁著一捆撿來的兵器；在古戰場上撿了十年骨頭，膽子比誰都大，撞見活人就先把人撲倒在骨堆裡再說。'}, rut='field')
m('carrion_crow', 'rift_vulture', 3, name='食屍鴉', kind='beast', abilities=['rend'], resist=None,
  loot=[('食屍鴉的黑羽', 10, '油亮的黑羽，渥都干說它聽過亡者的話。')],
  desc='成群停在古戰場的旗桿與屍骨上的烏鴉，吃了二十年的死人肉，看活人的眼神也一樣。')
m('battlefield_crow_girl', 'rift_vulture', 3, name='戰場的鴉女', kind='beast', abilities=['rend', 'sonic_scream'], resist=None,
  loot=[('鴉女的羽飾', 22, '用黑羽編成的頭飾，綴著從死人身上拿來的銀鈴。')],
  desc='古戰場上的烏鴉吃夠了戰死者的血，有的長成了人形，專挑還沒斷氣的人下手。',
  girl={'name': '鴉女', 'desc': '成年的鴉女，雙臂是一對烏黑的大翅膀，黑羽從肩頭長到胸口，腳是帶鉤爪的鳥足，眼睛又黑又亮；在古戰場上盤旋著找還活著的人，找到了就落下來，用翅膀把人整個裹住。'}, rut='field')
m('ghost_rider', 'exile_ghoul', 4, name='亡騎', kind='undead', abilities=['charge'], resist=R_UNDEAD,
  weapon={'dice': '1d8', 'type': 'slashing', 'attr': 'str'},
  loot=[('亡騎的殘蹄鐵', 26, '鏽得發黑的蹄鐵，釘子還插在上面。')],
  desc='統一戰爭裡戰死的人馬族騎兵，乾枯的上身還握著彎刀，馬身只剩骨架；聽見號角就衝鋒，衝完了又回到原地。')
m('broken_arrow_ghost', 'frostwing', 4, name='斷箭的遊魂', kind='spirit', abilities=['pin_shot', 'wraith_wail'], resist=R_SPIRIT,
  weapon={'dice': '1d6', 'type': 'piercing', 'attr': 'dex'},
  loot=[('斷箭', 14, '射斷在骨頭裡的箭，箭桿上刻著部族的記號。')],
  desc='身上插滿斷箭的遊魂，到死都在拉弓；它不知道戰爭已經結束了十年，看見會動的東西就放箭。')
m('war_drum_spirit', 'magma_golem', 5, name='戰鼓的鼓精', kind='construct', abilities=['battle_roar', 'sonic_scream'], resist=R_CONSTRUCT,
  weapon={'dice': '1d8', 'type': 'bludgeoning', 'attr': 'str'},
  loot=[('戰鼓的鼓皮', 40, '繃得緊緊的牛皮鼓面，敲一下就熱血沸騰。')],
  desc='古戰場上被遺棄的大戰鼓，沒有鼓手也自己咚咚作響；聽見鼓聲的人會忍不住熱血上湧，衝出去和誰打一場。',
  girl={'name': '鼓精娘', 'desc': '成年女性形態的戰鼓之靈，結實豐滿的身子上纏著鼓繩，腰間掛著一面小鼓，肌膚像繃緊的牛皮一樣光滑發燙；她一敲鼓，聽見的人就熱血沸騰，渾身燥熱，而她最喜歡把熱過了頭的人拉到鼓面上。'}, rut=True)
m('iron_pagoda_shell', 'giant_skeleton', 6, name='鐵浮屠的殘甲', kind='construct', abilities=['harden', 'charge'], resist=R_CONSTRUCT | {'slashing': -0.25},
  weapon={'dice': '1d10', 'type': 'bludgeoning', 'attr': 'str'},
  loot=[('鐵浮屠的甲片', 55, '厚重的鐵甲片，一片就有巴掌大，邊緣磨得發亮。')],
  desc='「鐵浮屠」是統一戰爭裡最可怕的重甲騎兵，人馬都包在鐵甲裡；騎兵死了，甲還在古戰場上走著，裡面空空的。',
  girl={'name': '殘甲娘', 'desc': '鐵甲裡空空的，卻撐出一副成年女人的身形：高挑、腰細、胸甲鼓脹，甲片縫隙裡透著幽幽的光；她沒有臉，只有頭盔下的一片黑，抓住闖入者就把人塞進自己空空的鐵甲裡緊緊抱住。'}, rut='field')
m('guaizi_horse_ghost', 'ironbound_wraith', 6, name='拐子馬的亡靈', kind='undead', abilities=['charge', 'trample'], resist=R_UNDEAD,
  weapon={'dice': '1d10', 'type': 'slashing', 'attr': 'str'},
  loot=[('拐子馬的鐵鏈', 50, '把三匹馬連在一起衝鋒的鐵鏈，一節一節都鏽死了。')],
  desc='「拐子馬」是用鐵鏈連成一排的輕騎，一起衝、一起死；它們的亡靈還連在一起，三個一排從霧裡衝出來。')
m('corpse_mound', 'resonance_golem', 8, name='萬人坑的屍山', kind='undead', abilities=['mummy_rot', 'harden'], resist=R_UNDEAD | {'physical': -0.25},
  weapon={'dice': '2d8', 'type': 'bludgeoning', 'attr': 'str'},
  loot=[('萬人坑的骨粉', 70, '灰白的骨粉，渥都干拿來畫招魂的圈。')],
  desc='統一戰爭最後一戰的萬人坑，屍骨堆成一座小山，自己慢慢地爬了起來，把活人也壓進坑裡。')
m('grudge_banner', 'storm_gargoyle', 8, name='怨旗', kind='spirit', abilities=['curse', 'wraith_wail'], resist=R_SPIRIT,
  weapon={'dice': '2d8', 'type': 'necrotic', 'attr': 'str'},
  loot=[('怨旗的殘布', 75, '燒焦的旗布，上面的部族圖騰被刀劃掉了。')],
  desc='被天可汗砍倒的部族戰旗，旗下的人全死了，旗子還插在古戰場上；風一吹，旗上就傳出幾千人的哭聲。')
m('nameless_khan_army', 'rune_titan', 11, name='無名可汗的亡軍', kind='undead', abilities=['battle_roar', 'charge', 'trample'], resist=R_UNDEAD,
  weapon={'dice': '2d12', 'type': 'slashing', 'attr': 'str'},
  loot=[('亡軍的黑纓', 200, '頭盔上的黑馬纓，被抹去名字的那位可汗的軍隊才戴黑纓。')],
  desc='被抹去名字的那位可汗的親軍，至死不降；他們還列著陣守在古戰場的最深處，等著主君下令最後一次衝鋒。')
# 層主
m('centurion_ghost_rider', 'ice_troll_chief', 5, name='百夫長的亡騎', kind='undead', abilities=['charge', 'battle_roar', 'trample', 'earthshatter'],
  ability_hp_below={'earthshatter': 40}, resist=R_UNDEAD, weapon={'dice': '2d6', 'type': 'slashing', 'attr': 'str'},
  loot=[('百夫長的銅牌', 120, '刻著百夫長名字的銅牌，名字被人用刀刮掉了一半。')],
  desc='統一戰爭裡帶著一百騎衝鋒的百夫長，一百騎全死在這裡；他的亡騎還在淺層的壕溝邊吹著鳴鏑，召集早就不在的部下。')
m('iron_pagoda', 'storm_colossus', 7, name='鐵浮屠', kind='construct', abilities=['harden', 'charge', 'trample', 'sky_roar'],
  ability_hp_below={'sky_roar': 40}, resist=R_CONSTRUCT | {'slashing': -0.25, 'piercing': -0.25}, weapon={'dice': '2d8', 'type': 'bludgeoning', 'attr': 'str'},
  loot=[('鐵浮屠的鬼面', 250, '重騎兵的鐵鬼面，獠牙是打出來的。'), ('秘銀礦石', None, None), ('精鋼錠', None, None, 2)],
  desc='鐵浮屠重騎的統領，人馬都包在三層鐵甲裡；他死的時候沒有倒下，二十年來就站在中層的盡頭，一動不動，直到有人走近。',
  girl={'name': '鐵浮屠', 'desc': '成年的人馬族女騎士，從頭到蹄都包在漆黑的三層鐵甲裡，只有鬼面的眼孔裡透出光；高大得像一座塔，豐滿的身形把鐵甲撐得緊繃，打倒了闖入者就用鐵甲的重量把人壓在身下，一層一層地卸給他看。'}, rut='field')
m('kheshig_ghost', 'frost_giant', 9, name='怯薛的亡魂', kind='undead', abilities=['battle_roar', 'trample', 'rend', 'dirge_of_the_dead'],
  ability_hp_below={'dirge_of_the_dead': 40}, resist=R_UNDEAD, weapon={'dice': '2d10', 'type': 'slashing', 'attr': 'str'},
  loot=[('怯薛的金箭', 400, '親衛才能佩的金箭，箭尾綁著可汗的令旗。'), ('秘銀礦石', None, None, 2)],
  desc='被抹去名字的那位可汗的怯薛（親衛）長，替主君擋了天可汗的最後一箭；他的亡魂守在深層的帳門口，誰也不能靠近主君。')
m('nameless_khan', 'primordial_giant', 13, name='無名的可汗', kind='undead', abilities=['battle_roar', 'trample', 'frenzy_flurry', 'sky_roar'],
  ability_hp_below={'sky_roar': 40}, resist=R_UNDEAD | {'physical': -0.25}, weapon={'dice': '4d8', 'type': 'slashing', 'attr': 'str'},
  loot=[('無名可汗的金冠', 1000, '被砍成兩半的金冠，冠上的名字被鑿掉了。'), ('精金礦石', None, None), ('星隕鐵塊', None, None)],
  desc='天可汗統一草原時最後一位對手；他戰敗之後，天可汗下令把他的名字從所有的歌、所有的碑上抹掉。沒有名字的亡魂不能回到長生天，只能留在古戰場的最深處。歷史之龍「回響編年」阿契隆讓那場決戰在這裡反覆重演，打倒之後過一陣子，他又會在最深處重新列陣。')

# ================= 白狼雪窟 =================
m('ice_weasel', 'stoneheart_spider', 3, name='冰鼬', kind='beast', abilities=['rend'], resist=R_ICE,
  weapon={'dice': '1d6', 'type': 'slashing', 'attr': 'dex'},
  loot=[('冰鼬的白毛皮', 20, '雪白的鼬皮，比貂皮還軟。')],
  desc='雪窟口的冰鼬，一身雪白，在雪地裡根本看不見；聞到血味就成群鑽出來。',
  girl={'name': '冰鼬娘', 'desc': '成年的冰鼬娘，嬌小靈活，一身雪白的軟毛從耳尖長到尾巴，眼睛是冰一樣的淺藍；在雪洞裡竄來竄去，冷得受不了時會鑽進旅人的衣服裡取暖，鑽進去就不肯出來。'}, rut='field')
m('snow_hare_swarm', 'mine_gasbat', 3, name='雪兔群', kind='beast', abilities=['frenzy_flurry'], resist=R_ICE,
  weapon={'dice': '1d4', 'type': 'piercing', 'attr': 'dex'},
  loot=[('雪兔的絨毛', 8, '一把又白又輕的兔絨。')],
  desc='雪窟口一大群餓瘋了的雪兔，平常見人就跑，冬天沒草吃的時候連人都敢咬。')
m('white_wolf', 'yeti', 4, name='白狼', kind='beast', abilities=['wolf_trip'], resist=R_ICE,
  weapon={'dice': '1d8', 'type': 'piercing', 'attr': 'str'},
  loot=[('白狼皮', 40, '雪白的狼皮；蒼狼部的人說這是祖先的毛色，不能拿來賣——他們還是會買。')],
  desc='雪窟裡的白狼，比草原狼大一圈；蒼狼部的人說它們是祖先的子孫，從不獵殺。',
  girl={'name': '白狼娘', 'desc': '成年的狼娘，雪白的狼耳與蓬鬆的大尾巴，結實的身子上覆著一層白色的軟毛，獠牙尖尖的；把闖進雪窟的人當成獵物，追累了就撲倒，咬著脖子不放。'}, rut='field')
m('ice_bat', 'frostwing', 4, name='冰蝙蝠', kind='beast', abilities=['sonic_scream', 'frost_breath'], resist=R_ICE,
  weapon={'dice': '1d6', 'type': 'piercing', 'attr': 'dex'},
  loot=[('冰蝙蝠的薄翼', 24, '半透明的薄翼，摸起來像冰。')],
  desc='倒掛在雪窟頂上的蝙蝠，翅膀結著一層霜；一叫起來，冰柱就嘩啦啦地往下掉。')
m('snow_wildman', 'thunder_spirit', 6, name='雪原野人', kind='humanoid', armed=False, abilities=['trample', 'battle_roar'], resist=R_ICE,
  weapon={'dice': '2d6', 'type': 'bludgeoning', 'attr': 'str'},
  loot=[('野人的獸骨串', 45, '用獸骨與狼牙串成的項鍊，雪原野人拿它換鹽。')],
  desc='住在雪窟裡的野人，渾身長著長長的白毛，力氣大得能把人馬族掀翻；不會說話，只會吼。',
  girl={'name': '雪原野人娘', 'desc': '成年的雪原野人娘，高大豐滿，渾身覆著蓬鬆的長白毛，只有臉與胸口露出粗糙溫熱的皮膚；不會說話，看上了誰就直接扛回自己的雪洞，用一身長毛把人裹得暖暖的。'}, rut=True)
m('ice_crystal_sprite', 'sonic_phantom', 6, name='冰晶精', kind='elemental', abilities=['frost_breath', 'blur_veil'], resist=R_ICE_EL,
  weapon={'dice': '1d10', 'type': 'cold', 'attr': 'int'},
  loot=[('冰晶的碎片', 60, '永遠不會化的冰晶，握在手裡會發出細細的鈴聲。')],
  desc='雪窟深處的冰晶長出了意志，一閃一閃地映著人影；被它的光照久了，人就忘了冷，也忘了出去的路。',
  girl={'name': '冰晶精', 'desc': '成年女性形態的冰晶之靈，透明的身子像一尊冰雕，曲線玲瓏，體內映著一圈圈彩光；她冰得刺骨，卻讓人捨不得放手，抱著她的人會一點一點忘記冷。'}, rut=True)
m('yuki_onna', 'sonic_phantom', 7, name='雪女', kind='elemental', abilities=['frost_breath', 'siren_song'], resist=R_ICE_EL,
  weapon={'dice': '2d6', 'type': 'cold', 'attr': 'cha'},
  loot=[('雪女的冰簪', 90, '一支冰做的簪子，插在頭上一整天也不會化。')],
  desc='雪窟裡的雪女，在暴風雪裡現身，把迷路的人抱進懷裡；被她抱住的人會覺得很暖，然後再也醒不過來。',
  girl={'name': '雪女', 'desc': '成年的雪女，肌膚白得像新雪，黑髮垂到腳踝，穿著一件薄得透光的白衣；她的懷抱冰涼又溫柔，把迷路的人抱進懷裡慢慢地吻，吻得對方渾身發燙、再也不想醒來。'}, rut=True)
m('frostmane_wolf', 'frost_wyvern', 8, name='霜鬃狼', kind='beast', abilities=['wolf_trip', 'frost_breath'], resist=R_ICE | {'cold': -1},
  weapon={'dice': '2d8', 'type': 'piercing', 'attr': 'str'},
  loot=[('霜鬃', 80, '狼鬃上結著不化的霜，一碰就掉冰屑。')],
  desc='深層的大狼，鬃毛上結著不化的霜；牠一吐氣，雪窟裡就颳起暴風雪。',
  girl={'name': '霜鬃狼娘', 'desc': '成年的狼娘，高挑結實，銀白的鬃毛從頭頂一路長到背脊，結著細細的霜，呼出的氣都是白的；強勢又驕傲，把打輸的人按在雪地上，用冰冷的舌頭舔過全身。'}, rut='field')
m('tundra_bear', 'storm_gargoyle', 8, name='冰原巨熊', kind='beast', abilities=['rend', 'trample'], resist=R_ICE,
  weapon={'dice': '2d8', 'type': 'slashing', 'attr': 'str'},
  loot=[('冰原熊膽', 85, '整顆完整的熊膽，鷹河榷場的藥商出高價收。')],
  desc='在雪窟深層冬眠的巨熊，站起來有兩個人馬族那麼高；被吵醒的時候，脾氣不會好。',
  girl={'name': '冰原熊娘', 'desc': '成年的熊娘，高大豐腴得像一座小山，頭上一對圓圓的熊耳，一身厚厚的白毛又暖又軟；被吵醒時脾氣很壞，把吵醒她的人一把抱進懷裡，說要讓他陪自己睡完這個冬天。'}, rut='field')
m('canglang_shadow', 'echo_colossus', 11, name='蒼狼之影', kind='spirit', abilities=['wolf_trip', 'frost_breath', 'wraith_wail'], resist=R_SPIRIT | {'cold': -0.5},
  weapon={'dice': '2d12', 'type': 'cold', 'attr': 'str'},
  loot=[('蒼狼的影毛', 200, '摸不到、卻抓得住的一撮灰毛，在火光下沒有影子。')],
  desc='雪窟最深處遊蕩的狼影，灰得像暴風雪前的天；牠們是蒼狼的影子，守著祖先睡覺的地方。')
# 層主
m('white_wolf_alpha', 'dwarf_seal_keeper', 5, name='白狼頭領', kind='beast', abilities=['wolf_trip', 'battle_roar', 'frenzy_flurry'],
  ability_hp_below={'frenzy_flurry': 40}, resist=R_ICE, weapon={'dice': '2d6', 'type': 'piercing', 'attr': 'str'},
  loot=[('白狼頭領的獠牙', 120, '比人的手指還長的獠牙，蒼狼部的少年拿它當成年禮。')],
  desc='白狼群的頭領，一隻眼睛被熊抓瞎了；牠守在淺層的冰橋上，不讓任何東西走到更深的地方。',
  girl={'name': '白狼頭領', 'desc': '成年的狼娘首領，高大健美，雪白的狼耳上有一道舊傷，一隻眼睛蒙著皮罩，身後的尾巴又粗又長；統領整個狼群，看上的獵物從來沒跑掉過，把人按在冰橋上宣示這是她的。'}, rut='field')
m('ice_bear_king', 'storm_colossus', 7, name='冰原熊王', kind='beast', abilities=['rend', 'trample', 'earthshatter'],
  ability_hp_below={'earthshatter': 40}, resist=R_ICE, weapon={'dice': '2d10', 'type': 'slashing', 'attr': 'str'},
  loot=[('冰原熊王的掌', 260, '一隻比盾牌還大的熊掌。'), ('秘銀礦石', None, None), ('精鋼錠', None, None, 2)],
  desc='雪窟中層的熊王，一掌能把冰牆拍碎；牠睡了三個冬天，醒來的時候特別餓。',
  girl={'name': '冰原熊王', 'desc': '成年的熊娘女王，高大得要人仰著頭看，一身白毛厚得像披著雪，胸前豐滿得像兩座小雪丘；睡醒的時候特別餓，也特別想要人陪，抓到闖入者就抱進自己的冰窩裡不放。'}, rut='field')
m('ice_queen', 'rift_matriarch', 9, name='冰后', kind='elemental', abilities=['frost_breath', 'siren_song', 'eternal_frost'],
  ability_hp_below={'eternal_frost': 40}, resist=R_ICE_EL, weapon={'dice': '2d10', 'type': 'cold', 'attr': 'cha'},
  loot=[('冰后的冠', 420, '冰晶長成的冠冕，戴上之後呼出的氣都是白的。'), ('秘銀礦石', None, None, 2)],
  desc='雪窟深層的冰之女王，所有的雪女與冰晶精都是她的侍女；她坐在冰的王座上，把走進她宮殿的人變成冰雕，擺在王座兩旁。',
  girl={'name': '冰后', 'desc': '成年女性形態的冰之女王，高挑冷豔，冰晶的長裙下是半透明的豐滿身子，頭戴冰冠，眼睛是極地的藍；高傲又寂寞，把喜歡的人留在冰宮裡，一夜一夜地凍住他的心，再用自己的身子把它融化。'}, rut=True)
m('canglang', 'spirit_of_echoes', 13, name='蒼狼', kind='beast', abilities=['wolf_trip', 'frost_breath', 'sky_roar', 'eternal_frost'],
  ability_hp_below={'eternal_frost': 40}, resist={'cold': -1, 'psychic': -0.5, 'fire': 0.25}, weapon={'dice': '4d8', 'type': 'piercing', 'attr': 'str'},
  loot=[('蒼狼的灰鬃', 1000, '一撮比鐵絲還硬的灰鬃，傳說是草原各部的祖先身上掉下來的。'), ('精金礦石', None, None), ('星隕鐵塊', None, None)],
  desc='傳說中蒼狼部的祖先：一頭灰得像天色的巨狼，與白鹿結合，生下了草原的各部。牠睡在雪窟最深處，每逢有人走到這裡，就醒來看一看——看看牠的子孫變成了什麼樣子。歷史之龍「回響編年」阿契隆讓這一刻反覆重演：打倒之後過一陣子，牠又會在雪窟最深處醒來。')

DUNGEONS = {
    'mingdi_field': {
        'loc': {'id': 'mingdi_field', 'name': '鳴鏑古戰場', 'region': 'yanhua_north', 'type': 'dungeon'},
        'route': {'a': 'jinzhang', 'b': 'mingdi_field', 'days': [1, 1], 'mode': 'wild'},
        'enc': {
            'outskirts': [[['bone_picker', 2]], [['carrion_crow', 3]], [['battlefield_crow_girl', 2]], [['bone_picker', 1], ['carrion_crow', 2]], [['battlefield_crow_girl', 1], ['carrion_crow', 1]]],
            'shallow': [[['ghost_rider', 2]], [['broken_arrow_ghost', 2]], [['ghost_rider', 1], ['broken_arrow_ghost', 1]], [['ghost_rider', 1], ['bone_picker', 1]], [['broken_arrow_ghost', 1], ['battlefield_crow_girl', 1]]],
            'middle': [[['iron_pagoda_shell', 1], ['ghost_rider', 1]], [['guaizi_horse_ghost', 2]], [['war_drum_spirit', 1], ['iron_pagoda_shell', 1]], [['guaizi_horse_ghost', 1], ['broken_arrow_ghost', 1]], [['war_drum_spirit', 1], ['guaizi_horse_ghost', 1]]],
            'deep': [[['corpse_mound', 1], ['iron_pagoda_shell', 1]], [['grudge_banner', 1], ['guaizi_horse_ghost', 1]], [['corpse_mound', 1], ['grudge_banner', 1]], [['grudge_banner', 1], ['war_drum_spirit', 1]]],
            'abyss': [[['nameless_khan_army', 2]], [['nameless_khan_army', 1], ['corpse_mound', 1]], [['nameless_khan_army', 1], ['grudge_banner', 1]], [['nameless_khan_army', 2], ['grudge_banner', 1]]],
            'boss': [['kheshig_ghost', 1], ['corpse_mound', 1]],
            'bosses': {'shallow': [['centurion_ghost_rider', 1], ['ghost_rider', 1]], 'middle': [['iron_pagoda', 1], ['iron_pagoda_shell', 1]],
                       'deep': [['kheshig_ghost', 1], ['corpse_mound', 1]], 'abyss': [['nameless_khan', 1], ['nameless_khan_army', 1]]},
        },
    },
    'whitewolf_cave': {
        'loc': {'id': 'whitewolf_cave', 'name': '白狼雪窟', 'region': 'yanhua_north', 'type': 'dungeon'},
        'route': {'a': 'yinghe', 'b': 'whitewolf_cave', 'days': [2, 2], 'mode': 'trail'},
        'enc': {
            'outskirts': [[['ice_weasel', 2]], [['snow_hare_swarm', 2]], [['ice_weasel', 1], ['snow_hare_swarm', 1]]],
            'shallow': [[['white_wolf', 2]], [['ice_bat', 3]], [['white_wolf', 1], ['ice_bat', 1]], [['white_wolf', 1], ['ice_weasel', 1]]],
            'middle': [[['snow_wildman', 1], ['white_wolf', 1]], [['ice_crystal_sprite', 2]], [['snow_wildman', 1], ['ice_crystal_sprite', 1]], [['ice_crystal_sprite', 1], ['ice_bat', 1]]],
            'deep': [[['frostmane_wolf', 1], ['snow_wildman', 1]], [['tundra_bear', 1], ['ice_crystal_sprite', 1]], [['yuki_onna', 1], ['frostmane_wolf', 1]], [['tundra_bear', 1], ['yuki_onna', 1]], [['frostmane_wolf', 2]]],
            'abyss': [[['canglang_shadow', 2]], [['canglang_shadow', 1], ['frostmane_wolf', 1]], [['canglang_shadow', 1], ['tundra_bear', 1]], [['canglang_shadow', 1], ['yuki_onna', 1]]],
            'boss': [['ice_queen', 1], ['yuki_onna', 1]],
            'bosses': {'shallow': [['white_wolf_alpha', 1], ['white_wolf', 1]], 'middle': [['ice_bear_king', 1], ['snow_wildman', 1]],
                       'deep': [['ice_queen', 1], ['yuki_onna', 1]], 'abyss': [['canglang', 1], ['canglang_shadow', 1]]},
        },
    },
}
BOSSES = {g[0][0] for D in DUNGEONS.values() for g in D['enc']['bosses'].values()}


def build():
    E = json.load(open('data/rules/enemies.json', encoding='utf-8'))
    EN = {e['id']: e for e in E['enemies']}
    out, loot_items = [], []
    for id, tpl, lv, kw in M:
        t = EN[tpl]
        old = EN.get(id)
        boss = id in BOSSES
        e = {'id': id, 'name': kw['name'], 'level': lv, 'attrs': t['attrs'], 'hp': t['hp'], 'ap': t['ap'], 'weapon': kw.get('weapon', t['weapon']),
             'evade': t['evade'], 'dr': t['dr'], 'abilities': kw['abilities']}
        if kw.get('ability_hp_below'):
            e['ability_hp_below'] = kw['ability_hp_below']
        if kw.get('resist'):
            e['resist'] = kw['resist']
        e['offense'] = dict(t.get('offense') or {'all': 0})
        e['xp'] = round(t['xp'] * lv / t['level'])
        # 調過的數值保留
        if old:
            for k in ('hp', 'ap', 'offense'):
                if k in old:
                    e[k] = old[k]
        e['habitats'] = H
        if kw.get('money_cc'):
            e['money_cc'] = kw['money_cc']
        e['loot'] = []
        for i, l in enumerate(kw['loot']):
            name, price, desc = l[0], l[1], l[2]
            ent = {'item': name, 'chance': 1 if boss and i == 0 else 0.8}
            if len(l) > 3:
                ent['qty'] = l[3]
            e['loot'].append(ent)
            if price is not None:
                loot_items.append({'name': name, 'category': 'material', 'price_cc': price, 'tags': [], 'desc': desc})
        e['desc'] = kw['desc']
        e['kind'] = kw['kind']
        if kw.get('armed'):
            e['armed'] = True
        if 'girl' in kw:
            e['girl'] = kw['girl']
        if 'rut' in kw:
            e['rut'] = kw['rut']
        out.append(e)
    return out, loot_items


def write_enemies(monsters):
    p = 'data/rules/enemies.json'
    t = open(p, encoding='utf-8').read()
    for e in monsters:
        t = re.sub(r'\n    \{"id": "' + e['id'] + r'",.*', '', t)
    t = re.sub(r',(\s*\n\s*\])', r'\1', t)
    a = re.search(r'\n    \{"id": "white_deer_spirit",.*', t)
    ln = a.group(0)
    t = t[:a.start()] + ln.rstrip(',') + ''.join(',\n    ' + json.dumps(e, ensure_ascii=False) for e in monsters) + (',' if ln.endswith(',') else '') + t[a.end():]
    # 遭遇表：encounters 的最後（wild_encounters 之前）
    for did in DUNGEONS:
        t = re.sub(r',\n    "' + did + r'": \{\n.*?\n    \}(?=,\n    "|\n  \},\n  "wild_encounters")', '', t, flags=re.S)
    anchor = '\n  },\n  "wild_encounters"'
    assert t.count(anchor) == 1
    blk = ''
    for did, D in DUNGEONS.items():
        parts = [f'      "{k}": {json.dumps(v, ensure_ascii=False)}' for k, v in D['enc'].items()]
        blk += ',\n    "%s": {\n%s\n    }' % (did, ',\n'.join(parts))
    t = t.replace(anchor, blk + anchor)
    d = json.loads(t)
    assert all(did in d['encounters'] for did in DUNGEONS)
    open(p, 'w', encoding='utf-8').write(t)


def one_line(obj):
    return '{ ' + json.dumps(obj, ensure_ascii=False)[1:-1] + ' }'


def write_geography():
    p = 'data/world/geography.json'
    t = open(p, encoding='utf-8').read()
    for D in DUNGEONS.values():
        t = re.sub(r'\n    \{ "id": "' + D['loc']['id'] + r'",.*', '', t)
        t = re.sub(r'\n    \{ "a": "' + D['route']['a'] + r'", "b": "' + D['route']['b'] + r'",.*', '', t)
    t = re.sub(r',(\s*\n\s*\])', r'\1', t)
    for key, anchor in (('loc', r'\n    \{ "id": "yinghe",.*'), ('route', r'\n    \{ "a": "yinghe", "b": "jinzhang",.*')):
        m_ = re.search(anchor, t)
        ln = m_.group(0)
        t = t[:m_.start()] + ln.rstrip(',') + ''.join(',\n    ' + one_line(D[key]) for D in DUNGEONS.values()) + (',' if ln.endswith(',') else '') + t[m_.end():]
    json.loads(t)
    open(p, 'w', encoding='utf-8').write(t)


if __name__ == '__main__':
    monsters, loot = build()
    write_items(loot)
    write_enemies(monsters)
    write_geography()
    print('地下城', len(DUNGEONS), '座、怪物', len(monsters), '種')
