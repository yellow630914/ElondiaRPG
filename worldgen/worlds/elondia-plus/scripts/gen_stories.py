# 產生 parts/stories.json（艾隆迪亞擴充的 37 條特殊任務）。規劃見 ../stories.md，設計方法見 worldgen/design/story-design.md。
# 用法（在專案根目錄）：python3 worldgen/worlds/elondia-plus/scripts/gen_stories.py
import json, os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'parts', '')
def N(x): return x if x.startswith('npc_') or x.startswith('mod_npc_') else 'mod_npc_'+x
# ---- 結果與地點 ----
def O(text, set_=None, eff=None, complete=False, join=None, leave=None, fail_quest=False, clear=None, **kw):
    o={'text':text}
    if set_: o['set_flags']=set_
    if clear: o['clear_flags']=clear
    if eff: o['effects']=eff
    if join: o['join']=N(join)
    if leave: o['leave']=N(leave)
    if complete: o['complete']=True
    if fail_quest: o['fail_quest']=True
    o.update(kw)
    return o
def cell(loc,c): return {'where':'cell','location':loc,'cell':c}
def atnpc(n,loc=None):
    a={'where':'npc','npc':N(n)}
    if loc: a['location']=loc
    return a
def dun(loc,layer): return {'where':'dungeon','location':loc,'layer':layer}
def out(loc): return {'where':'outskirts','location':loc}
def sett(loc): return {'where':'settlement','location':loc}
def sp(m,x=None,y=None):
    a={'where':'special','special_map':m}
    if x is not None: a['x']=x; a['y']=y
    return a
def req(*f, none=None):
    r={}
    if f: r['flags']=list(f)
    if none: r['flags_none']=none
    return r
def story(i,title,text,at,r,succ,allies=None):
    n={'id':i,'title':title,'text':text,'at':at,'kind':'story','success':succ}
    if r: n['requires']=r
    if allies: n['allies']=[N(a) for a in allies]
    return n
def check(i,title,text,at,r,attr,dc,succ,fail=None,allies=None):
    n={'id':i,'title':title,'text':text,'at':at,'kind':'check','check':{'attr':attr,'dc':dc},'success':succ}
    if fail: n['fail']=fail
    if r: n['requires']=r
    if allies: n['allies']=[N(a) for a in allies]
    return n
def combat(i,title,text,at,r,enemies,succ,fail=None,allies=None,foes=None):
    n={'id':i,'title':title,'text':text,'at':at,'kind':'combat','enemies':enemies,'success':succ}
    if foes: n['foes']=[N(x) for x in foes]
    if fail: n['fail']=fail
    if r: n['requires']=r
    if allies: n['allies']=[N(a) for a in allies]
    return n
def choice(i,title,text,at,r,options,allies=None):
    n={'id':i,'title':title,'text':text,'at':at,'kind':'choice','options':options}
    if r: n['requires']=r
    if allies: n['allies']=[N(a) for a in allies]
    return n
def opt(label,succ,attr=None,dc=None,fail=None):
    o={'label':label,'success':succ}
    if attr: o['check']={'attr':attr,'dc':dc}
    if fail: o['fail']=fail
    return o
def money(a): return {'type':'money','amount':a}
def xp(a): return {'type':'xp','amount':a}
def rep(f,d): return {'type':'reputation','faction':f,'delta':d}
def aff(n,d,reason=None):
    e={'type':'affinity','npc':N(n),'delta':d}
    if reason: e['reason']=reason
    return e
def item(n,q=1): return {'type':'item','name':n,'qty':q}
def mem(s,imp=2): return {'type':'memory','summary':s,'importance':imp}
def nxt(s): return {'type':'start_story','story':'mod_story_'+s}
def start_npc(n,text,min_aff=None,min_level=None):
    s={'kind':'npc','npc':N(n),'text':text}
    if min_aff is not None: s['min_affinity']=min_aff
    if min_level: s['min_level']=min_level
    return s
def start_guild(loc,text,min_level=None):
    s={'kind':'guild','location':loc,'text':text}
    if min_level: s['min_level']=min_level
    return s
def start_inf(loc,price,text): return {'kind':'informant','location':loc,'price':price,'text':text}
def start_travel(regions,chance,text): return {'kind':'travel','regions':regions,'chance':chance,'text':text}
def start_manual(text): return {'kind':'manual','text':text}
Q={}
def S(id,title,rank,summary,start,flag,nodes,rewards,merit=None,time_limit=None,group=''):
    s={'title':title,'summary':summary,'rank':rank,'start':start,'start_flags':[flag],'nodes':nodes,'rewards':rewards,'custom':True,'$group':group}
    if merit is not None: s['merit']=merit
    if time_limit: s['time_limit']=time_limit
    Q['mod_story_'+id]=s

# ================= 大陸主線：龍影之兆 =================
S('main_1','龍影之兆・一：不該存在的星','E','帝國法師學院院長塞拉菲娜想記錄一次「歷史之龍」的投影：低語墓穴附近的荒野，最近每到黃昏就會重演一場千年前的戰役。',
  start_npc('seraphina_weiss','塞拉菲娜把一疊星圖推到你面前：「精靈的星術師說天上多了一顆不該存在的星；墓穴那邊的荒野又開始重演古戰場。這兩件事同時發生，我不相信是巧合。替我去看看，順便——別死。」',min_level=3),
  'drg1_start',[
  story('n1','到低語墓穴周邊找到重演的古戰場','黃昏的風裡，半透明的軍旗與騎兵從地面浮起，千年前的帝國統一戰爭在你眼前無聲地重演。戰場中央，一名將軍抬頭望向天空的某一點——正是那顆不該存在的星。',dun('whisper_crypt','outskirts'),req('drg1_start'),
    O('殘影消散前，你看清了將軍盾牌上的紋章：一枚被七道裂痕切開的圓環。',set_=['drg1_seen'])),
  check('n2','把看到的景象記錄下來','你努力回想每一個細節：軍旗的顏色、星的位置、將軍盾上的紋章。',dun('whisper_crypt','outskirts'),req('drg1_seen'),'int',13,
    O('你畫下了一張足以讓塞拉菲娜興奮到失眠的草圖。',set_=['drg1_recorded']),
    O('殘影的細節在腦中模糊，你只能憑印象寫下大概。',set_=['drg1_recorded','drg1_vague'])),
  story('n3','回萊茵堡向塞拉菲娜報告','塞拉菲娜看著你的記錄，臉色從興奮變成凝重：「七道裂痕的圓環……那是創世之戰的封印紋。如果龍在重演這一幕，表示有什麼東西正在鬆動。」',atnpc('seraphina_weiss','rhineburg'),req('drg1_recorded'),
    O('她把記錄抄了三份，一份寄給銀月城的艾溫娜，一份鎖進抽屜，一份塞給你：「下一站，河谷鎮。」',complete=True,eff=[mem('在低語墓穴外看見歷史之龍重演的古戰場，將軍的盾上刻著七道裂痕的圓環。',3)]))],
  [money(160),xp(200),aff('seraphina_weiss',5),nxt('main_2')],merit=6,group='主線')
S('main_2','龍影之兆・二：重演的戰場','D','河谷鎮的守橋人說「流水之靈」在發抖；低語墓穴裡的亡靈也比往常躁動。塞拉菲娜要你查清楚封印紋與墓穴的關係。',
  start_manual('塞拉菲娜的信寫得很急：「去河谷鎮找守橋的奧斯溫，他說河裡的靈在怕什麼東西。然後下墓穴——那位將軍的墓也許還在。」'),
  'drg2_start',[
  story('n1','到河谷鎮的舊石橋找奧斯溫','奧斯溫把手放進河水裡，很久才說話：「流水之靈說，地底下有東西在敲門。不是一扇，是七扇。」',cell('rivervale','lm_old_stone_bridge'),req('drg2_start'),
    O('他給了你一片在橋下撿到的古老銅片，上面也刻著七道裂痕的圓環。',set_=['drg2_bridge'],eff=[item('古舊骨片')])),
  combat('n2','深入低語墓穴的淺層，找到將軍的墓','墓室的門開著。持劍的骷髏騎士與屍妖守在石棺兩側，像是在等你。',dun('whisper_crypt','shallow'),req('drg2_bridge'),[['skeleton_knight',1],['crypt_wight',1]],
    O('石棺的內壁刻著一行字：「封印分在七處，由七族各守其一。若龍開始重演，便是守門人失職。」',set_=['drg2_tomb'])),
  choice('n3','回到索里耶爾：審判長在等你','審判長瓦倫汀攔住了你。他已經知道你在查「封印紋」，而在教廷眼裡，研究龍的投影近乎異端。',atnpc('valentin_clay','soriel'),req('drg2_tomb'),[
    opt('把記錄交給審判長，請教廷一起調查',O('瓦倫汀看完記錄，沉默許久：「如果這是真的，教廷會需要每一個肯說實話的人。」他放你走了，還給了你一份通行文書。',complete=True,eff=[rep('holy_ring',2)])),
    opt('隱瞞，說只是在墓穴打怪',O('他盯著你看了很久，最後讓開了路。你知道自己被記住了。',complete=True,eff=[rep('holy_ring',-1)]),'cha',14,O('「真理之鏡會告訴我你在說謊。」他沒收了你的一部分記錄，但還是放你走了。',complete=True,eff=[rep('holy_ring',-2)]))])],
  [money(320),xp(450),rep('rhine_empire',1),nxt('main_3')],merit=8,group='主線')
S('main_3','龍影之兆・三：封印之門的敲擊','C','七處封印之一在北境：鐵爐堡地底的「封印之門」。石誓會的守門騎士巴爾林早就聽見門後的敲擊聲，只是沒人相信他。',
  start_manual('墓室的刻字說封印分在七處、由七族各守其一。北境的那一處，應該就在鐵爐堡的地底。'),
  'drg3_start',[
  story('n1','到鐵爐堡找石誓會的巴爾林','巴爾林聽完你的話，用拳頭重重敲了一下胸甲：「終於有人信我了。門後的敲擊一天比一天急——但議會說那只是地鳴。」',atnpc('balin_greyrock','ironforge'),req('drg3_start'),
    O('他說只有迷石氏族的符文師看得懂封印的刻文，而那位符文師最近出現在灰岩堡壘。',set_=['drg3_balin'])),
  check('n2','在灰岩堡壘請瑟爾・迷石解讀封印紋','瑟爾用手指摸過你帶來的銅片，像在聽石頭說話：「七扇門，七種龍。龍不是敵人——龍是警報。」',atnpc('ser_mistone','greyrock'),req('drg3_balin'),'int',15,
    O('瑟爾畫出了封印之門下方的路：要從深贖之穴的中層繞過去，那裡有一段被矮人封死的舊礦道。',set_=['drg3_path']),
    O('瑟爾的話你只聽懂一半，但總算知道要往深贖之穴去。',set_=['drg3_path'])),
  combat('n3','深入深贖之穴中層，找到封死的舊礦道','礦道裡的黑鐵怨靈仍在執行千年前的命令：不准任何人靠近門。',dun('redemption_pit','middle'),req('drg3_path'),[['ironbound_wraith',1],['blackiron_warden',1]],
    O('封死的牆後，是封印之門的背面。門上的七道裂痕，有一道正在發光。',set_=['drg3_gate'])),
  story('n4','把封印之門的情況告訴巴爾林','巴爾林看著你畫的發光裂痕，臉色發白：「這一道……是東方的門。在海裡。」',atnpc('balin_greyrock','ironforge'),req('drg3_gate'),
    O('他說東海的封印由玉璘族守護，但那群樂天的傢伙可能根本不知道自己在守什麼。',complete=True))],
  [money(700),xp(900),rep('dwarf_clans',2),aff('balin_greyrock',8),nxt('main_4')],merit=10,group='主線')
S('main_4','龍影之兆・四：失竊的玉璜','B','東海的封印由一枚古老的玉璜鎮著，收在滄月闕冬璃宮的珍寶庫裡——而冬璃宮主璃月剛發現它不見了。',
  start_manual('發光的裂痕指向東方的海。玉璘族守著的，也許正是第四扇門的鑰匙。'),
  'drg4_start',[
  story('n1','到滄月闕找冬璃宮主璃月','璃月把你帶進珍寶庫，指著一個空著的玉架：「雪玉璜不見了。我沒告訴任何人——四殿要是知道，挑潮祭都辦不成了。」',atnpc('rigetsu','canglue'),req('drg4_start'),
    O('庫房的守衛說，失竊那晚只有一艘人類的商船在結界外停泊，船帆是黑色的。',set_=['drg4_lead'])),
  choice('n2','到潮汐港找「黑帆」卡洛斯','卡洛斯在酒館後門等你，像是早就知道你會來：「玉璜？我只是負責運的。買家在骷髏潮島等著交貨。」',atnpc('carlos_blacksail','tidehaven'),req('drg4_lead'),[
    opt('用錢換情報（800 白鸛幣）',O('他收了錢，給了你交貨的時間與暗號。',set_=['drg4_route'],eff=[money(-800)])),
    opt('威脅要把他交給白鯨',O('卡洛斯的笑容僵住了：「好吧，好吧。交貨就在今晚。」',set_=['drg4_route']),'cha',16,O('他冷笑一聲吹了口哨，幾個打手從暗處走出來。你殺出了一條路，也從其中一人身上搜到了暗號。',set_=['drg4_route'],eff=[{'type':'hp','ratio':-0.3}])),
    opt('通知七潮議會',O('貝雅特麗絲帶人封了港口，卡洛斯被迫說出交貨地點。白鯨欠了你一個人情。',set_=['drg4_route'],eff=[rep('seven_tides',2)]))]),
  combat('n3','在骷髏潮島的深層攔下交易','買家不是人。幽靈海盜抱著玉璜，身後的海水裡伸出一條深淵觸手。',dun('skull_isle','deep'),req('drg4_route'),[['ghost_pirate',2],['abyssal_tentacle',1]],
    O('你搶回了雪玉璜。它在你手中冰涼刺骨，裂紋般的光在玉裡流動。',set_=['drg4_jade'])),
  story('n4','把雪玉璜送回滄月闕','璃月接過玉璜，長長地鬆了口氣。潮主櫻汐難得認真地向你鞠躬：「玉璘族欠你一份情。挑潮祭的時候，你坐主桌。」',atnpc('rigetsu','canglue'),req('drg4_jade'),
    O('秋珊苑主墨鱗卻把你拉到一邊：「玉璜上的光，和精靈女王的月輝之母一樣。你該去銀月城。」',complete=True,eff=[mem('從骷髏潮島搶回冬璃宮的雪玉璜，玉璘族把它重新鎮回東海的封印。',3)]))],
  [money(3200),xp(2000),rep('four_seasons',3),aff('rigetsu',10),aff('sakurashio',8),nxt('main_5')],merit=15,group='主線')
S('main_5','龍影之兆・五：第八種現象','A','七種龍的投影開始重疊，精靈的星術師說天上那顆星正在變大。封印鬆動的源頭在銀月城的地底——月影根穴的最深處。',
  start_manual('墨鱗說玉璜的光和月輝之母一樣。所有的線索，都指向古樹森林的心臟。'),
  'drg5_start',[
  story('n1','到銀月城謁見精靈女王','伊瑟蘭迪爾聽完你的故事，閉上眼很久：「月之碎片在根穴深處，被封了三千年。它若醒來，七龍不會坐視——那顆星，就是第八種現象的開始。」',cell('silvermoon','lm_moonlight_mother'),req('drg5_start'),
    O('星術師艾溫娜自願與你同行：「我要親眼看看那顆星底下是什麼。」',set_=['drg5_queen'],join='evenna_starword')),
  choice('n2','到血羽城堡：魔族也有一扇門','艾溫娜說七處封印裡有一處在南境。魔王莉莎爾接見了你們，赤焰王座廳裡安靜得只聽得見魔焰。',cell('bloodplume','lm_crimson_throne'),req('drg5_queen'),[
    opt('請魔王一起守住封印',O('莉莎爾笑了：「人類來請魔族幫忙守世界？有趣。」她派了一隊血誓戰士去守南境的門。',set_=['drg5_south'],eff=[rep('demon_council',3)]),'cha',17,O('莉莎爾拒絕了，但答應不趁亂進攻。這樣也夠了。',set_=['drg5_south'])),
    opt('只交換情報，不談結盟',O('莉莎爾把南境封印的位置畫給你：「我自己的門，我自己守。」',set_=['drg5_south']))],allies=['evenna_starword']),
  combat('n3','深入月影根穴的底層，找到月之碎片','根穴的最深處，月光從不存在的天空灑下。月蝕騎士與吞憶巨獸守著一塊懸在半空、正在裂開的碎片。',dun('moonshadow_roots','abyss'),req('drg5_south'),[['lunar_knight',1],['memory_devourer',1]],
    O('碎片停止了碎裂。天上那顆不該存在的星，在同一刻熄滅了。',set_=['drg5_shard']),allies=['evenna_starword']),
  story('n4','回到月輝之母，向女王覆命','七種龍的投影漸漸平息。伊瑟蘭迪爾把一枚月輝葉別在你的衣領上：「三千年來，第一次有外族替精靈守住了門。」',cell('silvermoon','lm_moonlight_mother'),req('drg5_shard'),
    O('艾溫娜離開隊伍，回去觀星。她說那顆星熄滅之前，最後指向的是南方。',complete=True,leave='evenna_starword',eff=[mem('在月影根穴的底層守住了月之碎片，平息了七龍投影的重疊。',3)]))],
  [money(9000),xp(5000),rep('elf_court',4),rep('human_alliance',2),aff('ithrandil',10),aff('evenna_starword',15)],merit=25,group='主線')

# ================= 地區故事線 =================
# 中央
S('mirror_crack','真理之鏡的裂痕','D','審判迴廊的「真理之鏡」出現了一道裂痕，照出來的人影會慢半拍。審判長瓦倫汀不願讓教皇知道，私下找人調查。',
  start_npc('valentin_clay','瓦倫汀把你帶到迴廊深處：「鏡子裂了。在教皇知道之前，我要知道是誰做的。」',min_level=4),
  'mirror_start',[
  check('n1','在審判迴廊檢查真理之鏡','鏡中的你比你慢了半拍才眨眼。裂痕的邊緣有一層淡淡的霧，聞起來像晨雨。',cell('soriel','lm_judgment_cloister'),req('mirror_start'),'int',13,
    O('霧是從晨霧修道院遺址帶來的——鏡框上沾著那裡特有的白苔。',set_=['mirror_lead']),O('你找不出頭緒，但瓦倫汀提到最近有一位朝聖者從晨霧修道院遺址回來後就失蹤了。',set_=['mirror_lead'])),
  combat('n2','到晨霧修道院遺址的淺層追查霧影','霧影靈體在廢墟間遊蕩，其中一個穿著見習修士的衣服，手上抱著一塊鏡子的碎片。',dun('mist_abbey','shallow'),req('mirror_lead'),[['mist_wraith',1],['fallen_acolyte',2]],
    O('碎片上刻著修道院被毀那天的日期。有人想讓真理之鏡照出那天的真相。',set_=['mirror_shard'])),
  choice('n3','把碎片交給誰？','鏡子的碎片在你手裡微微發光。瓦倫汀要它，晨曦聖殿的大祭司艾莉諾也寫信說她想看看。',sett('soriel'),req('mirror_shard'),[
    opt('交給審判長瓦倫汀',O('瓦倫汀把碎片鎖進迴廊。「謝謝。這件事到此為止。」他看起來並不輕鬆。',complete=True,eff=[aff('valentin_clay',8),rep('holy_ring',1)])),
    opt('送去晨光城給艾莉諾',O('艾莉諾用碎片照出了修道院被毀那天的影像：下令的不是異端，是當年的教廷。她請你保守秘密。',complete=True,eff=[aff('eleanor_dawn',10),mem('真理之鏡的碎片照出晨霧修道院被毀的真相：下令的是當年的教廷。',2)]))])],
  [money(300),xp(500)],group='中央平原')
S('duke_salon','公爵的沙龍','C','晨曦王國的女王懷疑表兄洛倫佐公爵在沙龍裡拉攏貴族，想找一個宮廷外的人去看看。',
  start_npc('adelaide_ii','女王在花園裡接見你，語氣輕得像在聊天氣：「洛倫佐的沙龍每週都有新面孔。我想知道那些面孔背後是誰的錢。」',min_level=6),
  'salon_start',[
  check('n1','混進洛倫佐公爵的沙龍','公爵的沙龍裡燈火輝煌，貴族們談著詩與政治，沒人在意一個新面孔——只要你夠會說話。',atnpc('lorenzo_valois','dawnlight'),req('salon_start'),'cha',15,
    O('你聽見三位伯爵在談「女王退位之後」，還有一個名字反覆出現：阿爾貝納的金秤商行。',set_=['salon_heard']),
    O('公爵的僕人多看了你兩眼。你只聽到「金秤」兩個字就被禮貌地請了出去。',set_=['salon_heard'])),
  story('n2','在晨光城的情報商打聽金秤商行','情報商壓低聲音：「金秤的錢這半年流進了公爵的帳。數目大到可以養一支私兵。」',cell('dawnlight','informant'),req('salon_heard'),
    O('你拿到了一份帳目的抄本。',set_=['salon_proof'])),
  choice('n3','向女王報告——或者不','帳目的抄本在你手上。它能讓公爵失勢，也能賣個好價錢。',sett('dawnlight'),req('salon_proof'),[
    opt('交給女王',O('阿德萊德看完帳目，沒有發怒，只是輕聲說：「謝謝你讓我不必再假裝不知道。」公爵的沙龍下週就停辦了。',complete=True,eff=[aff('adelaide_ii',10),rep('dawn_kingdom',3)])),
    opt('拿去和公爵談條件',O('洛倫佐優雅地付了一大筆錢買下抄本：「你是個聰明人。宮廷需要聰明人。」',complete=True,eff=[money(1500),aff('lorenzo_valois',10),rep('dawn_kingdom',-2)]))])],
  [money(700),xp(900)],group='中央平原')
S('princess_letter','皇女的密信','D','河谷鎮的情報商說，有一封帝國皇女寫給晨曦王國某人的密信正在鎮上待價而沽。',
  start_inf('rivervale',150,'情報商把一張紙條推過來：「一封皇女的密信。賣信的人住在旅店二樓，買家已經在路上了。」'),
  'letter_start',[
  check('n1','在河谷鎮找到賣信的人——卡斯帕','自稱布料商人的卡斯帕在旅店喝茶。他看到你就笑了：「你也是來買信的？」',atnpc('kaspar_nord','rivervale'),req('letter_start'),'cha',14,
    O('卡斯帕承認信是他「撿到」的，願意用公道的價錢賣給你。',set_=['letter_got'],eff=[money(-200)]),
    O('卡斯帕把價錢抬得很高，你只好付了。',set_=['letter_got'],eff=[money(-400)])),
  choice('n2','信要送去哪裡？','信是艾蕾諾拉皇女寫給晨曦王國洛倫佐公爵的，內容是兩國邊境的軍事部署。',sett('rivervale'),req('letter_got'),[
    opt('送回萊茵堡給皇女',O('艾蕾諾拉收下信，沒問你怎麼拿到的：「帝國記得幫過它的人。」',complete=True,travel_to='rhineburg',eff=[rep('rhine_empire',2),money(500)])),
    opt('送去晨光城給女王',O('阿德萊德讀完信，臉色一沉。她付了你酬勞，也多了一份對表兄的戒心。',complete=True,travel_to='dawnlight',eff=[rep('dawn_kingdom',2),money(500)])),
    opt('在舊石橋上燒掉它',O('奧斯溫在一旁見證：「流水之靈記住了。這座橋上，和平又多撐了一天。」',complete=True,eff=[aff('oswin_bridge',10),xp(200)]))])],
  [xp(450)],group='中央平原')
# 北境
S('fireless_iron','無火之鐵','D','矮人發明家迪莉婭造了一台不靠熔爐的魔導鍛機，想在深贖之穴的周邊實地測試——議會的保守派正等著看她出醜。',
  start_npc('dilia_copperbeard','迪莉婭拍了拍背上冒蒸汽的箱子：「只要它在實戰裡不炸，議會就再也不能說『無火之鐵』是玩具。你來當我的保鑣，好嗎？」',min_level=4),
  'fiw_start',[
  combat('n1','在深贖之穴周邊保護迪莉婭測試鍛機','鍛機的嗡鳴引來了熔皮傀儡與毒氣礦蝠。',dun('redemption_pit','outskirts'),req('fiw_start'),[['magma_golem',1],['mine_gasbat',2]],
    O('鍛機撐過了戰鬥，還在戰鬥中替你的武器重新開了鋒。',set_=['fiw_tested']),allies=['dilia_copperbeard']),
  choice('n2','在心火熔源面對瑪格達','主祭瑪格達擋在熔源前：「沒有火的鐵，沒有靈魂。」迪莉婭握緊了拳頭。',cell('ironforge','lm_heartfire_forge'),req('fiw_tested'),[
    opt('替迪莉婭說話',O('你說出鍛機在戰場上的表現。瑪格達沉默很久，最後說：「……讓我看看那台東西。」',complete=True,eff=[aff('dilia_copperbeard',10),aff('magda_ironforge',-3)]),'cha',14,O('瑪格達不為所動，但也沒有趕人。迪莉婭說這已經是進步了。',complete=True,eff=[aff('dilia_copperbeard',6)])),
    opt('勸迪莉婭向傳統讓一步',O('迪莉婭答應在鍛機裡加一盞心火的火種。瑪格達第一次對她點了頭。',complete=True,eff=[aff('magda_ironforge',8),aff('dilia_copperbeard',3)]))])],
  [money(320),xp(450),rep('dwarf_clans',1)],group='北境群山')
S('blue_beacon','長明烽火轉藍','E','往北境的山道上，你遠遠看見雪嵴哨站的烽火從金黃轉成了藍色——那是示警的顏色。',
  start_travel(['north'],0.25,'暴風雪中，山隘上的烽火忽然轉成了刺眼的藍色。商隊的嚮導臉色大變：「哨站出事了。」'),
  'beacon_start',[
  story('n1','趕到雪嵴哨站找守備隊長','哈爾德披著積雪迎上來：「一支商隊和嚮導安雅困在近郊的峽谷裡，雪人和雪狼把路堵了。我的人手不夠。」',atnpc('hald_greyrock','snowridge'),req('beacon_start'),
    O('她把一張手繪的地圖塞給你。',set_=['beacon_brief'])),
  combat('n2','到雪嵴哨站近郊救出受困的商隊','峽谷裡的雪人咆哮著撲來，雪狼在風雪中繞著你們打轉。',out('snowridge'),req('beacon_brief'),[['yeti',1],['snow_wolf',1]],
    O('你找到了縮在雪洞裡的安雅和商隊。她凍得說不出話，卻還記得罵你來得太慢。',set_=['beacon_saved'])),
  story('n3','回哨站讓烽火轉回金色','哈爾德親手把烽火換回金焰。安雅喝了三碗熱湯，才說了一聲「謝了」。',sett('snowridge'),req('beacon_saved'),
    O('商隊的領隊付了救援費，哈爾德把你的名字刻在哨站的救援名冊上。',complete=True,eff=[aff('anya_sled',10),aff('hald_greyrock',6)]))],
  [money(150),xp(250),rep('dwarf_clans',1)],group='北境群山')
# 南境
S('bloodhorn_challenge','血角的戰書','C','血角氏族的酋長格羅姆寫了一封戰書要給魔王莉莎爾。試煉場主烏爾瑪說，只有通過鮮血試煉的人才有資格送信。',
  start_npc('ulma_bloodtrial','烏爾瑪把一把手斧插在你腳邊：「想替酋長送信？先在試煉場活下來。」',min_level=6),
  'horn_start',[
  combat('n1','在鮮血試煉場通過試煉','新月下，狂化圖騰與地獄犬被放進場中。看台上的血角戰士在敲擊盾牌。',cell('bone_hills','lm_blood_trial_ground'),req('horn_start'),[['frenzied_totem',1],['hellhound',1]],
    O('烏爾瑪大笑著拍你的背：「好！血角承認你了。」',set_=['horn_trial'])),
  choice('n2','在骨王殿見格羅姆','格羅姆把戰書遞給你：「告訴那個魅魔，血角的戰士不會在律法前跪著。新月之前，我要她在試煉場和我一決勝負。」',cell('bone_hills','lm_bone_king_hall'),req('horn_trial'),[
    opt('答應送信',O('你收下了戰書。',set_=['horn_letter'])),
    opt('勸他換個方式',O('格羅姆沉默了很久：「……你說得對，打一場只會讓議會更亂。」他改寫了戰書，要求在議會裡公開辯論。',set_=['horn_letter','horn_debate']),'cha',16,O('格羅姆一拳砸碎了石桌：「別教我怎麼當魔族！」你還是拿到了戰書。',set_=['horn_letter']))]),
  choice('n3','把戰書送到血羽城堡','總管薇洛妮卡攔住你，笑著伸出手：「信給我就好。魔王很忙。」',atnpc('veronica','bloodplume'),req('horn_letter'),[
    opt('交給薇洛妮卡',O('薇洛妮卡讀完，把信折好收進袖子：「辛苦了。你最好在新月之前離開荒原。」',complete=True,eff=[rep('demon_council',1)])),
    opt('堅持親手交給魔王',O('莉莎爾在王座上讀完信，竟然笑了：「告訴格羅姆，我接受。」血羽城堡的人從此都知道你的名字。',complete=True,eff=[rep('demon_council',3),aff('npc_lisar',5)]),'cha',17,O('衛兵把你架了出去。薇洛妮卡撿起掉在地上的信，對你眨了眨眼。',complete=True))])],
  [money(700),xp(900)],group='南境枯萎荒原')
S('soulwell_cry','熔魂井的哭聲','D','熔魂井的守井人薩米爾說，井裡有些靈魂在哭——它們不想被淬進兵器，只想安息。',
  start_npc('samir_soulwell','薩米爾的聲音很輕：「有一位戰士的靈魂一直在喊一個名字。那個名字的人，死在餘燼裂隙裡。」',min_level=4),
  'soul_start',[
  combat('n1','到餘燼裂隙的淺層找那個名字的遺物','裂隙裡的餘燼火蜥盤踞在一具焦黑的骸骨旁，骸骨手上握著一枚刻著名字的鐵牌。',dun('ember_rift','shallow'),req('soul_start'),[['ember_salamander',2]],
    O('你拿到了鐵牌。上面的名字，和井裡的靈魂喊的一樣。',set_=['soul_tag'])),
  choice('n2','回到熔魂井：讓靈魂安息，還是成為兵器','薩米爾把鐵牌放在井邊。井裡傳來兩個聲音，一個在笑，一個在哭。',cell('moltenhold','lm_soulmelt_well'),req('soul_tag'),[
    opt('主持安魂儀式',O('兩個靈魂一起沉入井底的白光。薩米爾哭了，說這是他第一次送靈魂「回家」。',complete=True,eff=[aff('samir_soulwell',12),{'type':'condition','condition':'blessed'}]),'fai',14,O('儀式失敗了，但靈魂安靜了下來。薩米爾說至少它們不再孤單。',complete=True,eff=[aff('samir_soulwell',5)])),
    opt('讓兩個靈魂一起被淬成兵器',O('千爐工坊的伊格妮絲把兩個靈魂淬進了一把雙刃斧，說這是她做過最好的兵器。',complete=True,eff=[aff('ignis_forge',8),aff('samir_soulwell',-5),money(400)]))])],
  [money(300),xp(450)],group='南境枯萎荒原')
# 森林
S('spring_fading','生命之泉在變淺','C','銀月城的生命之泉魔力這十年少了三成。守泉祭司莉安德拉懷疑問題出在翠影空洞——精靈誕生的地方。',
  start_npc('liandra_spring','莉安德拉的手放在泉水上，水紋的光比往常黯淡：「泉水的源頭在翠影空洞。請替我看看那裡發生了什麼。」',min_level=6),
  'spring_start',[
  combat('n1','到翠影空洞的中層找到污染的源頭','發光的蘑菇林裡，被寄生的精靈與孢子守衛守著一株長滿異界孢子的根。',dun('verdant_hollow','middle'),req('spring_start'),[['infected_elf',1],['spore_guardian',1]],
    O('你砍下了一段被污染的根，裡面流的不是樹液，是銀色的光。',set_=['spring_root'])),
  story('n2','把根交給星術師艾溫娜','艾溫娜用星盤照了照那段根：「這是月之碎片的光。有人——或有東西——在偷泉水的魔力。」',atnpc('evenna_starword','silvermoon'),req('spring_root'),
    O('她把根封進水晶裡，說要獻給女王。',set_=['spring_told'])),
  story('n3','回生命之泉向莉安德拉報告','莉安德拉聽完，閉上眼祈禱了很久：「至少我們知道該往哪裡看了。」',cell('silvermoon','lm_spring_of_life'),req('spring_told'),
    O('她用泉水替你洗去了身上的孢子。',complete=True,eff=[aff('liandra_spring',10),{'type':'hp','ratio':0.5}]))],
  [money(700),xp(900),rep('elf_court',2)],group='古樹森林')
S('sprout_and_verdant','新芽與翠輝','D','精靈商館的菲妮雅想送一封信給翠輝議會的議長卡蘭西爾，信裡是新芽同盟的「交流提案」——她自己去的話，大概會被趕出來。',
  start_npc('finia_silverleaf','菲妮雅把一封綁著綠緞帶的信交給你：「卡蘭西爾不會見我。但他也許會見一個外族——只要你夠有禮貌。非常、非常有禮貌。」'),
  'sprout_start',[
  check('n1','在銀月城把信交給卡蘭西爾','議長站在上風處，連信都不想碰：「新芽同盟的人，連送信都要假手外族？」',atnpc('kalanthil','silvermoon'),req('sprout_start'),'cha',15,
    O('你用精靈的禮節回應了他的冷淡。卡蘭西爾挑了挑眉，收下了信。',set_=['sprout_read']),
    O('卡蘭西爾沒有收信，但讓你把信放在議會的桌上。這已經比菲妮雅預期的好了。',set_=['sprout_read'])),
  story('n2','回阿爾貝納告訴菲妮雅結果','菲妮雅聽完，跳起來抱住你：「他沒有撕掉？他沒有撕掉！」',atnpc('finia_silverleaf','albena'),req('sprout_read'),
    O('三週後，翠輝議會第一次派了觀察員去阿爾貝納的精靈商館。',complete=True,eff=[aff('finia_silverleaf',12),aff('npc_ael',5)]))],
  [money(250),xp(400),rep('elf_court',1)],group='古樹森林')
# 東海
S('reef_light','礁光柱的異光','C','礁光柱的老匠人螺鈿婆婆說，結界的光「有點怪」——每到滿月，光就會往潮隕洞窟的方向偏一點。',
  start_npc('raden_granny','螺鈿婆婆眯著眼看礁光柱：「我年輕的時候，光是直的。現在它往洞窟那邊歪，像在找什麼。」',min_level=6),
  'reef_start',[
  combat('n1','到潮隕洞窟的淺層，追查光的方向','發光水母與藻影潛伏者在沉船殘骸間漂浮，水裡有一道細細的光線，從礁光柱一路延伸到洞窟深處。',dun('tidefall_cave','shallow'),req('reef_start'),[['glow_jelly',2],['algae_lurker',1]],
    O('光線的盡頭，是一塊刻著七道裂痕圓環的古老礁石。',set_=['reef_found'])),
  story('n2','回滄月闕告訴秋珊苑主墨鱗','墨鱗翻出一本古籍：「玉璘族的祖先在這裡封了一樣東西。我們早就忘了——連守門的事都忘了。」',cell('canglue','lm_four_seasons_gallery'),req('reef_found'),
    O('她說要把這件事告訴四殿，雖然大概沒人會認真聽。',complete=True,eff=[aff('moring',10),aff('raden_granny',8)]))],
  [money(650),xp(900),rep('four_seasons',2)],group='東海群島')
S('whitewhale_blacksail','白鯨與黑帆','D','七潮議會首席貝雅特麗絲盯上了走私王卡洛斯的一條新航線，但她需要證據——和一個不是議會的人去拿。',
  start_npc('beatrice_whitewhale','白鯨一拳敲在海圖上：「黑帆最近在珊瑚灣附近卸貨。替我找到證據，議會付錢。」',min_level=4),
  'whale_start',[
  check('n1','在珊瑚灣鎮向托馬老爹打聽','托馬老爹抽著菸斗：「黑帆的小船？每三天一次，半夜，在潮汐港外的礁石灣。」',atnpc('toma_pearl','coral_bay'),req('whale_start'),'int',13,
    O('他還告訴你卸貨的暗號。',set_=['whale_lead']),O('你只問到大概的時間。',set_=['whale_lead'])),
  combat('n2','在潮汐港近郊埋伏卸貨的走私者','月光下，走私者把一箱箱貨搬上岸，一名走私魔法師在旁邊放風。',out('tidehaven'),req('whale_lead'),[['smuggler',2],['smuggler_mage',1]],
    O('箱子裡是骷髏潮島的鹽化骨頭與沉船寶物。',set_=['whale_proof'])),
  choice('n3','證據要交給誰？','走私者的頭目哀求你放他一馬，說卡洛斯會付你雙倍。',sett('tidehaven'),req('whale_proof'),[
    opt('交給白鯨',O('貝雅特麗絲封了那條航線：「黑帆會恨你一輩子。不過那是他的問題。」',complete=True,eff=[rep('seven_tides',3),aff('beatrice_whitewhale',8)])),
    opt('收下卡洛斯的錢',O('卡洛斯的人送來一袋金幣和一句話：「有空來喝一杯。」',complete=True,eff=[money(700),aff('carlos_blacksail',8),rep('seven_tides',-2)]))])],
  [money(300),xp(450)],group='東海群島')
# 西部
S('grand_rite','大祭禮的繼承','C','赤鬃族長卡菈想在下一次推舉大典讓赤鬃的人當上大祭禮。她要你去靜潮綠洲，替她向大祭禮娜伊薇遞話。',
  start_npc('kara_redmane','卡菈的尾巴一下一下拍著地面：「月尾的人當了幾百年大祭禮，荒野越來越軟弱。我不搞陰謀——我要光明正大地爭。替我去說。」',min_level=6),
  'rite_start',[
  story('n1','到靜潮綠洲見大祭禮娜伊薇','娜伊薇在泉邊聽完你的話，微笑著搖頭：「卡菈說得沒錯，荒野需要力量。但力量也需要被祖靈認可。」',cell('stilltide_oasis','lm_stillspring_altar'),req('rite_start'),
    O('她說，只要赤鬃的候選人能從回音峽谷帶回祖靈的回聲，她就在祭風原上支持她。',set_=['rite_terms'])),
  combat('n2','陪塔洛進回音峽谷的淺層，帶回祖靈的回聲','卡菈派了兒子塔洛當候選人。峽谷裡的回音蝠群與峽谷岩蜥循聲而來。',dun('echo_canyon','shallow'),req('rite_terms'),[['echo_bat',2],['canyon_lizard',1]],
    O('塔洛在峽谷深處聽見了一個女人的聲音——那是四部落共同的始祖，荒獵始祖娜依卡。',set_=['rite_echo']),allies=['talo_redmane']),
  choice('n3','回烈日草原向卡菈報告','卡菈聽完，久久沒有說話。',cell('sunscorch','lm_redmane_council'),req('rite_echo'),[
    opt('建議兩部落共同推舉',O('卡菈哈哈大笑：「月尾的祭司，赤鬃的拳頭。好，就這麼辦。」聯盟第一次有兩位大祭禮候選人一起站上祭風原。',complete=True,eff=[aff('kara_redmane',10),aff('naivee',8),rep('wild_tribes',3)]),'cha',15,O('卡菈不置可否，但收起了戰斧。這在赤鬃已經算是答應了。',complete=True,eff=[aff('kara_redmane',5),rep('wild_tribes',1)])),
    opt('如實報告，讓她自己決定',O('卡菈說她會帶著塔洛去祭風原，用祖靈的回聲說話。',complete=True,eff=[aff('kara_redmane',6),aff('talo_redmane',8)]))])],
  [money(700),xp(900)],group='西部荒野')
S('trial_valley','試煉之谷','D','赤鬃的年輕獵手塔洛想證明自己：他要進夜爪部落的禁地「試煉之谷」，拿回谷底的圖騰獸骨。',
  start_npc('talo_redmane','塔洛壓低聲音：「別告訴我母親。夜爪的試煉從沒有赤鬃的人通過過——我要當第一個。」',min_level=4),
  'valley_start',[
  combat('n1','陪塔洛深入回音峽谷的中層','回音亡魄循聲而來。塔洛咬著牙不出聲，你也一樣。',dun('echo_canyon','middle'),req('valley_start'),[['echo_wraith',2]],
    O('谷底，一具巨大的圖騰獸骨嵌在岩壁裡。',set_=['valley_bone']),allies=['talo_redmane']),
  story('n2','夜爪首領在谷口等著','薩芙坐在岩石上，月光照著她的新月鋼爪：「赤鬃的小子。還有一個外人。」她看著塔洛手上的獸骨，很久很久。',atnpc('saff_nightclaw','sandcastle'),req('valley_bone'),
    O('「試煉之谷承認了你。夜爪也會。」她把一根黑羽束帶繫在塔洛的手臂上。',complete=True,eff=[aff('talo_redmane',12),aff('saff_nightclaw',6),rep('wild_tribes',2)]))],
  [money(300),xp(450)],group='西部荒野')

# ================= 內建角色的任務線 =================
S('lina_home','莉娜：回到沙堡','E','嚮導莉娜收到姑姑薩伊拉的信，信上只有一句話：「該回來了。」',
  start_npc('npc_lina','莉娜把信揉成一團又攤開：「……你陪我回去一趟。我才不是怕，只是路很遠。」',min_aff=20),
  'lina_start',[
  story('n1','陪莉娜回到沙堡營地見薩伊拉','薩伊拉張開雙臂，莉娜卻停在帳篷口不肯進去。兩人吵了一架，又抱在一起哭。',atnpc('saila_sandmark','sandcastle'),req('lina_start'),
    O('薩伊拉說，沙痕部落需要一位熟悉人類世界的嚮導——如果莉娜願意，她可以接下部落的對外聯絡。',set_=['lina_offer'])),
  choice('n2','莉娜要留下嗎？','莉娜看著你，等你說些什麼。',sett('sandcastle'),req('lina_offer'),[
    opt('「做妳想做的事。」',O('莉娜說她還不想回來，但答應每年回沙堡一次。她偷偷把一包家鄉的甜棗塞給你。',complete=True,eff=[aff('npc_lina',12),item('野莓',3)])),
    opt('「部落需要妳。」',O('莉娜哼了一聲：「你們都一樣。」但她答應替部落和公會跑腿。薩伊拉對你深深點頭。',complete=True,eff=[aff('npc_lina',6),aff('saila_sandmark',10),rep('wild_tribes',2)]))])],
  [money(150),xp(250)],group='內建角色')
S('borin_armor','波林：堂兄的鎧甲','E','退役護衛波林說他的堂兄布蘭特在萊茵堡造了一件傳說中的鎧甲，卻因為一枚鉚釘被人笑了二十年。',
  start_npc('npc_borin','波林灌了一口麥酒：「布蘭特那個死腦筋，二十年前做壞了一枚鉚釘就再也不回家。陪我去罵醒他！」',min_aff=15),
  'borin_start',[
  check('n1','到萊茵堡的帝國軍械院找布蘭特','布蘭特一見到波林就抄起了鐵鎚。兩個矮人隔著鍛台吼了十分鐘。',cell('rhineburg','lm_imperial_armory'),req('borin_start'),'str',13,
    O('你攔在兩人中間，硬是把鐵鎚按回了鍛台上。布蘭特終於坐了下來。',set_=['borin_calm']),
    O('你沒攔住，兩人打了一架，然後一起去喝酒了。結果是一樣的。',set_=['borin_calm'])),
  story('n2','聽布蘭特說完那枚鉚釘的故事','「龍息鎧的第七枚鉚釘，」布蘭特說，「我用了人類的鋼，因為矮人的鋼不夠——我不敢回去跟族人說這件事。」',atnpc('brandt_copperbeard','rhineburg'),req('borin_calm'),
    O('波林拍拍他的背：「笨蛋，深鏈契約的人會把你當英雄。」布蘭特答應今年冬天回鐵爐堡。',complete=True,eff=[aff('npc_borin',12),aff('brandt_copperbeard',8)]))],
  [money(150),xp(250),rep('dwarf_clans',1)],group='內建角色')
S('selene_door','瑟琳：審判迴廊的門','D','見習修女瑟琳在聖典裡發現一段被塗黑的經文，而唯一的原本收在審判迴廊。',
  start_npc('npc_selene','瑟琳的手在發抖：「我不是要質疑教義。我只是……想知道被塗掉的是什麼。」',min_aff=20),
  'selene_start',[
  choice('n1','在審判迴廊請瓦倫汀讓你們看原本','瓦倫汀聽完，看著瑟琳很久：「知道了之後，妳就回不去了。」',atnpc('valentin_clay','soriel'),req('selene_start'),[
    opt('「她有權知道。」',O('瓦倫汀從迴廊深處拿出一卷經文：「讀吧。讀完就忘掉。」',set_=['selene_read']),'cha',15,O('他拒絕了，但在你們離開前，一張抄本從他的袖子裡「掉」了出來。',set_=['selene_read'])),
    opt('偷偷溜進去',O('你們趁換班溜進了檔案室，找到了那卷經文。',set_=['selene_read']),'dex',15,O('你們被發現了。瓦倫汀沒有懲罰你們，只是把經文遞給瑟琳：「與其讓妳偷，不如讓妳看。」',set_=['selene_read']))]),
  story('n2','讀那段被塗黑的經文','經文寫著：「光明三神之外，另有一位被遺忘的神。祂守著第八扇門。」瑟琳讀完，安靜了很久。',sett('soriel'),req('selene_read'),
    O('「我還是相信光，」她說，「只是現在，我想知道更多。」',complete=True,eff=[aff('npc_selene',12),mem('瑟琳讀到被塗黑的經文：光明三神之外，另有一位守著第八扇門的被遺忘之神。',2)]))],
  [money(250),xp(400)],group='內建角色')
S('ael_notes','艾爾溫：龍的筆記','E','精靈學者艾爾溫整理了一本關於高維巨龍的筆記，想請塞拉菲娜院長過目——但他太緊張了，不敢自己去。',
  start_npc('npc_ael','艾爾溫抱著厚厚的筆記：「如果院長說它是垃圾，我就……我就回森林種樹。」',min_aff=10),
  'ael_start',[
  story('n1','陪艾爾溫去見塞拉菲娜','塞拉菲娜一頁頁翻著，越翻越快，最後啪地合上：「第三十七頁的推論是錯的。其他的——比我學院的學生好。」',atnpc('seraphina_weiss','rhineburg'),req('ael_start'),
    O('艾爾溫的耳朵紅到了耳尖。塞拉菲娜收他當了旁聽生，還說會把筆記寄給銀月城的艾溫娜。',complete=True,eff=[aff('npc_ael',12),aff('seraphina_weiss',4)]))],
  [money(120),xp(200)],group='內建角色')
S('kai_debt','凱：無面的帳','D','扒手凱小時候欠了自由集市的掮客「無面」薩洛一筆帳。現在薩洛派人來收了。',
  start_npc('npc_kai','凱難得沒有嬉皮笑臉：「十年前我偷了一個不該偷的東西，薩洛替我擺平了。他說總有一天要我還——今天就是那一天。」',min_aff=15),
  'kai_start',[
  choice('n1','在自由集市見「無面」薩洛','薩洛的白瓷面具沒有表情：「凱欠我一件事。我要他替我偷一份議會的帳冊。」',cell('albena','lm_free_market'),req('kai_start'),[
    opt('用錢替凱還債（600 白鸛幣）',O('薩洛收下了錢：「交易就是交易。」凱看著你，說不出話。',complete=True,eff=[money(-600),aff('npc_kai',15)])),
    opt('和薩洛談條件',O('你說服薩洛改要一份不會傷人的情報。凱只花了一個晚上就辦妥了。',complete=True,eff=[aff('npc_kai',10),aff('faceless_salo',5)]),'cha',16,O('薩洛不肯讓步。凱咬著牙去偷了帳冊，回來時一言不發。',complete=True,eff=[aff('npc_kai',4),rep('aude_federation',-2)])),
    opt('揭穿薩洛和深淵交易所的關係',O('薩洛的面具微微一偏：「……你知道得太多了。好吧，凱的帳一筆勾銷。」',complete=True,eff=[aff('npc_kai',12),aff('faceless_salo',-10)]),'int',17,O('薩洛笑了：「你知道的，比你以為的少。」帳還是要還。',complete=True,eff=[money(-300),aff('npc_kai',8)]))])],
  [xp(400)],group='內建角色')
S('mira_song','米菈：為女王寫的歌','E','流浪詩人米菈聽說宮廷樂師席恩要在女王的壽宴上獻歌，而那首歌的旋律——是偷她的。',
  start_npc('npc_mira','米菈氣得把魯特琴的弦都彈斷了：「那是我在酒館唱了三年的歌！我要在壽宴上唱原版！」',min_aff=15),
  'mira_start',[
  check('n1','在晨光城的酒館讓米菈的歌傳開','你和米菈在酒館連唱了三個晚上，整個晨光城都在哼那段旋律。',cell('dawnlight','tavern'),req('mira_start'),'cha',13,
    O('連宮廷的僕人都在哼。席恩的臉色很難看。',set_=['mira_famous']),O('只唱紅了一半，但也夠了。',set_=['mira_famous'])),
  story('n2','在壽宴上——女王點了米菈的歌','女王阿德萊德聽完米菈的版本，笑著鼓掌：「我聽過兩個版本。這一個比較誠實。」',atnpc('adelaide_ii','dawnlight'),req('mira_famous'),
    O('席恩在宴會後找到米菈，扭扭捏捏地道了歉，還說要和她合寫下一首。',complete=True,eff=[aff('npc_mira',12),aff('sean_minstrel',5),rep('dawn_kingdom',1)]))],
  [money(150),xp(250)],group='內建角色')

# ================= 人物任務 =================
S('last_candle','漢娜嬤嬤：最後一根蠟燭','F','賣蠟燭的漢娜嬤嬤想把四十年來第一根蠟燭的燭台送回聖環主殿——她年輕時從那裡「借」走的。',
  start_npc('old_hannah','漢娜嬤嬤從籃子底下拿出一個舊燭台：「四十年前我在主殿當小雜工，借了它就沒還。我老了，腿走不到內環了。」'),
  'candle_start',[
  story('n1','把燭台送回聖環主殿','你把燭台放回側殿的空架上。一位老修士盯著它看了很久，笑了：「原來是漢娜。我們找了它四十年。」',cell('soriel','lm_holy_ring_cathedral'),req('candle_start'),
    O('老修士託你帶一句話給漢娜：「主殿的燈，一直替妳留著。」',set_=['candle_back'])),
  story('n2','回外環把話帶給漢娜嬤嬤','漢娜嬤嬤聽完，紅著眼眶把一整籃蠟燭塞給你。',atnpc('old_hannah','soriel'),req('candle_back'),
    O('之後她賣你蠟燭再也不收錢了。',complete=True,eff=[aff('old_hannah',15)]))],
  [money(60),xp(100),item('聖水')],group='人物')
S('liv_leaves','莉芙：離開風錘村','E','風錘村的年輕獵人莉芙想跟著冒險者去大城市，但她的爺爺——村長老鐵根——不同意。',
  start_npc('liv_hunter','莉芙拉著你的袖子：「拜託，幫我跟爺爺說。他只聽強者的話。」'),
  'liv_start',[
  choice('n1','在風錘下和老鐵根談','老鐵根坐在風錘下喝酒，風吹過錘孔發出低鳴：「外面的世界會吃掉她。」',cell('windhammer','lm_wind_hammer'),req('liv_start'),[
    opt('說服他',O('老鐵根把一把舊石斧交給莉芙：「帶著它。風錘的鳴聲會跟著妳。」',set_=['liv_ok']),'cha',13,O('老鐵根不肯，但莉芙說她還是要走。',set_=['liv_ok'])),
    opt('和他比腕力',O('老鐵根輸了，大笑著同意了。',set_=['liv_ok']),'str',14,O('你輸了。老鐵根笑著說：「至少你有種。」他還是讓莉芙走了。',set_=['liv_ok']))]),
  story('n2','莉芙收拾好了行李','莉芙背著比她還高的長弓，在村口回頭看了很久。',sett('windhammer'),req('liv_ok'),
    O('「我會成為故事裡的人。」她說，然後跟上了你。',complete=True,eff=[{'type':'companion','npc':'mod_npc_liv_hunter','mode':'voluntary'},aff('liv_hunter',10)]))],
  [xp(250)],group='人物')
S('nick_city','尼克：沒有角的城市','E','腐沼村的半魔小賊尼克想去人類的城市。他聽說灰港鎮有一位流亡貴族能替人弄到人類的身分文件。',
  start_npc('nick_halfdemon','尼克把帽子壓得低低的：「帶我去灰港鎮。我付不起錢，但我可以替你偷東西——開玩笑的。大概。」'),
  'nick_start',[
  choice('n1','在灰港鎮找流亡貴族塞巴斯欽','塞巴斯欽打量著尼克：「身分文件？可以。但人類的城市不會因為一張紙就接受他。」',atnpc('sebastian_eger','ashport'),req('nick_start'),[
    opt('付錢買文件（300 白鸛幣）',O('尼克拿到了一張寫著人類名字的文件，盯著它看了很久。',complete=True,eff=[money(-300),aff('nick_halfdemon',12)])),
    opt('讓尼克替塞巴斯欽跑一趟腿抵帳',O('尼克跑了三天腿，回來時累得說不出話，但手上握著文件。',complete=True,eff=[aff('nick_halfdemon',8),aff('sebastian_eger',4)]),'dex',13,O('尼克搞砸了一次，但塞巴斯欽還是給了他文件：「你讓我想起年輕時的自己。」',complete=True,eff=[aff('nick_halfdemon',8)]))])],
  [xp(250)],group='人物')
S('lila_book','莉菈：旅行書','D','寂墓聖堂的見習祭司莉菈偷偷收集人類的旅行書。她想請你替她帶一句話給大祭司：她想去外面看看。',
  start_npc('lila_listener','莉菈把一本翻爛的旅行書抱在胸前：「死者每天都在說他們沒去過的地方。我不想變成那樣。」'),
  'lila_start',[
  choice('n1','在遺火塔見大祭司艾瑟里昂','艾瑟里昂聽完，慢慢地說：「她聽得見死者，是因為她還活著。活著的人，本來就該走動。」',cell('silent_tomb','lm_ember_tower'),req('lila_start'),[
    opt('請大祭司允許她出門一年',O('大祭司點頭：「一年。然後回來告訴死者，外面是什麼樣子。」',complete=True,eff=[aff('lila_listener',15),aff('aetherion',5)]),'fai',14,O('大祭司說要再想想。但他讓莉菈下次跟著商隊去一趟灰港鎮。',complete=True,eff=[aff('lila_listener',8)])),
    opt('替莉菈說謊，說她只是想去灰港鎮採買',O('大祭司看了你一眼，什麼也沒說，同意了。你猜他什麼都知道。',complete=True,eff=[aff('lila_listener',10)]))])],
  [money(250),xp(400)],group='人物')
S('ghost_ship','哈根：永不靠岸的船','C','灰帆碼頭的老船長哈根說，今晚是那艘「永不靠岸的船」出現的夜晚——他的大副就在船上。',
  start_npc('captain_hagen','哈根把空酒瓶放下，難得地清醒：「每七年一次。今晚它會靠得夠近。我需要一個不怕鬼的人。」',min_level=6),
  'ship_start',[
  story('n1','半夜到灰帆碼頭等那艘船','霧裡，一艘沒有燈的船無聲地滑過碼頭。甲板上站滿了人影，其中一個朝哈根揮手。',cell('ashport','lm_greysail_pier'),req('ship_start'),
    O('船停了。一塊跳板放了下來。',set_=['ship_board'])),
  combat('n2','登上鬼船','甲板上的哀嚎水手亡魂與幽靈海盜轉過頭來。他們不是要害人——他們只是在守著船長室的門。',sett('ashport'),req('ship_board'),[['wailing_sailor',2],['ghost_pirate',1]],
    O('船長室裡，哈根的大副抱著一本航海日誌，日誌的最後一頁寫著：「告訴船長，不是他的錯。」',set_=['ship_log'])),
  story('n3','把日誌交給哈根','哈根讀完最後一頁，在碼頭坐到了天亮。',atnpc('captain_hagen','ashport'),req('ship_log'),
    O('那天之後，他再也沒有拿過空酒瓶。',complete=True,eff=[aff('captain_hagen',15),mem('登上灰帆碼頭的鬼船，替哈根船長帶回大副的航海日誌。',2)]))],
  [money(700),xp(900)],group='人物')
S('shion_lost','汐音：又迷路了','F','玉璘族使者汐音在潮汐港迷路了——第一百零一次。深潮席的雷諾已經找不動了。',
  start_npc('shion_envoy','汐音眨著珍珠般的眼睛：「請問……大海在哪個方向？」'),
  'shion_start',[
  story('n1','把汐音帶到深潮席渡口','汐音一路上問了二十個問題，買了三串烤魚，差點掉進運河兩次。',cell('tidehaven','lm_deep_tide_pier'),req('shion_start'),
    O('雷諾鬆了一口氣，請你喝了一杯。汐音塞給你一顆自己撈的珍珠當謝禮。',complete=True,eff=[aff('shion_envoy',10),aff('reno_deeptide',5)]))],
  [money(60),xp(100)],group='人物')
S('missing_list','塔莉：沒回來的人','C','冒險者公會的聯絡員塔莉手上有一份「沒回來的人」名單。她最想找到的，是三個月前進流沙聖殿的一支四人小隊。',
  start_npc('tali_liaison','塔莉把登記簿翻到一頁：「四個人，三個月。我不期待他們活著——但他們的家人值得知道。」',min_level=6),
  'list_start',[
  story('n1','在流沙聖殿的淺層找到小隊的蹤跡','甬道的牆上有人用刀刻了四個名字和一個箭頭，指向更深的地方。',dun('quicksand_temple','shallow'),req('list_start'),
    O('箭頭的盡頭是一道被流沙半掩的石門。',set_=['list_trace'])),
  combat('n2','打開石門','石門後，裹布守衛與日晷魔像守著四具骸骨。其中一具手裡握著小隊的徽章。',dun('quicksand_temple','shallow'),req('list_trace'),[['linen_guard',2],['sundial_golem',1]],
    O('你帶回了四枚徽章。',set_=['list_badges'])),
  story('n3','把徽章交給塔莉','塔莉把四枚徽章一一擦乾淨，在名單上畫了四條線。',atnpc('tali_liaison','sandcastle'),req('list_badges'),
    O('「謝謝你，」她說，「現在我可以寫信給他們的家人了。」',complete=True,eff=[aff('tali_liaison',12),rep('guild',2)]))],
  [money(700),xp(900)],group='人物')
S('basement_guest','格蕾塔：地下室的客人','D','銀鱗旅店的老闆娘格蕾塔說，有一位魔族的客人又回來了——就是她父親當年接待過的那位使者的女兒。',
  start_npc('greta_silverscale','格蕾塔壓低聲音：「她說她是來談和的。但鎮上有帝國的密探——要是被發現，我的店就完了。」'),
  'base_start',[
  choice('n1','在銀鱗旅店的地下室見魔族使者','魔族使者是一位年輕的魅魔，自稱是赤翼宮廷派來的：「魔王想和人類諸國談一件事。但我需要時間。」',cell('rivervale','lm_silverscale_inn'),req('base_start'),[
    opt('替她引開帝國密探卡斯帕',O('你找卡斯帕喝了一整晚的酒。使者平安離開了河谷鎮。',complete=True,eff=[aff('greta_silverscale',12),rep('demon_council',2)]),'cha',14,O('卡斯帕察覺到不對勁，但使者還是從後門走了。格蕾塔說謝謝你盡力了。',complete=True,eff=[aff('greta_silverscale',6),rep('demon_council',1)])),
    opt('把消息告訴卡斯帕',O('卡斯帕付了一筆錢，帝國的人在天亮前包圍了旅店——地下室已經空了。格蕾塔再也不跟你說話。',complete=True,eff=[money(400),rep('rhine_empire',2),aff('greta_silverscale',-20)]))])],
  [money(250),xp(400)],group='人物')
S('rock_cargo','洛克：下水道的貨','E','下水道的走私頭目「老鼠」洛克有一批貨卡在古蓄水池——那裡被一群不聽話的走私者佔了。',
  start_npc('rock_the_rat','洛克搓著手：「我、我的貨在蓄水池那邊。那群傢伙不聽我的了。你幫我，我、我給你三成。」'),
  'rock_start',[
  combat('n1','到萊茵堡古蓄水池趕走佔地的走私者','蓄水池的石柱間，幾個走私者正在拆洛克的箱子。',sp('sm_rhineburg_cistern',4,1),req('rock_start'),[['smuggler',2]],
    O('箱子裡是帝國軍械院流出來的鉚釘與鋼片。',set_=['rock_cargo'])),
  choice('n2','回下水道找洛克','洛克看到貨，眼睛都亮了。',atnpc('rock_the_rat'),req('rock_cargo'),[
    opt('照約定分三成',O('洛克數了好久，給了你一袋錢。',complete=True,eff=[money(180)])),
    opt('把貨送回帝國軍械院',O('布蘭特收回了被偷的鉚釘，咒罵了洛克整整一刻鐘。洛克從此看到你就躲。',complete=True,eff=[aff('brandt_copperbeard',8),rep('rhine_empire',1),aff('rock_the_rat',-10)]))])],
  [xp(250)],group='人物')

# ================= 地下城傳說 =================
S('giants_runes','巨人之脊的符文','B','迷石氏族的符文師瑟爾說，巨人之脊深處的古符陣在「說話」——說的是一種只有地心才懂的語言。',
  start_npc('ser_mistone','瑟爾把手按在石牆上：「巨人的骨頭在唱歌。我需要有人去把歌記下來。我太慢了。」',min_level=9),
  'giant_start',[
  combat('n1','到巨人之脊的深層找到古符陣','風暴石像與古符迴路守著一座刻滿符文的石台，石台在暴風雪中發出低沉的嗡鳴。',dun('giants_spine','deep'),req('giant_start'),[['storm_gargoyle',1],['rune_circuit',1]],
    O('你把符文拓了下來。',set_=['giant_rubbing'])),
  story('n2','把拓本交給瑟爾','瑟爾讀著拓本，第一次說了一句完整、清楚的話：「巨人不是死了。他們在睡。」',atnpc('ser_mistone','greyrock'),req('giant_rubbing'),
    O('瑟爾說迷石氏族會派人去守那座石台。他給了你一枚刻著迷石紋的石片當謝禮。',complete=True,eff=[aff('ser_mistone',12)]))],
  [money(2400),xp(1800),rep('dwarf_clans',2)],group='地下城傳說')
S('greenhouse_voice','溫室裡的聲音','B','千爐工坊的伊格妮絲說，地獄溫室裡的植物在學人說話——用的是她死去母親的聲音。',
  start_npc('ignis_forge','伊格妮絲第一次放下了鐵鎚：「那是莉莎爾統治初期的實驗場。我母親是那裡的研究員。如果它在用她的聲音……我想知道為什麼。」',min_level=9),
  'green_start',[
  combat('n1','深入地獄溫室的中層','失控合成獸與噬魂花守著溫室的研究室。藤蔓裡傳來一個女人的聲音：「伊格妮絲，別過來。」',dun('hell_greenhouse','middle'),req('green_start'),[['experiment_chimera',1],['soul_eater_bloom',1],['carnivorous_pod',1]],
    O('研究室的桌上，是伊格妮絲母親最後的研究筆記：溫室的植物吞噬的不只是血肉，還有記憶。',set_=['green_notes'])),
  story('n2','把筆記交給伊格妮絲','伊格妮絲讀完筆記，把它放進熔爐旁的鐵盒裡。',atnpc('ignis_forge','moltenhold'),req('green_notes'),
    O('「她記得我，」伊格妮絲說，「那就夠了。」',complete=True,eff=[aff('ignis_forge',15),mem('在地獄溫室找到伊格妮絲母親的研究筆記：溫室吞噬的不只是血肉，還有記憶。',2)]))],
  [money(2400),xp(1800),rep('demon_council',1)],group='地下城傳說')
S('thorn_dream','荊棘迴廊的夢','C','森語之環的長老奧克塔維亞說，她的學徒菲恩在荊棘迴廊裡睡著了——三天沒醒。',
  start_npc('octavia_mossvoice','奧克塔維亞的歌聲斷斷續續：「迴廊會讓迷路的人在夢裡重生。我唱不醒他。」',min_level=6),
  'thorn_start',[
  combat('n1','到荊棘迴廊的淺層找到菲恩','荊棘騎士與荊棘獵犬圍著一團藤蔓繭。繭裡，菲恩在夢裡微笑。',dun('thorn_corridor','shallow'),req('thorn_start'),[['bramble_knight',2],['thorn_hound',1]],
    O('你劈開了繭。',set_=['thorn_cocoon'])),
  check('n2','把菲恩從夢裡叫醒','菲恩夢見自己成了一棵樹，很安靜，很舒服。你得給他一個醒來的理由。',dun('thorn_corridor','shallow'),req('thorn_cocoon'),'cha',14,
    O('你對他說起森林外面的世界。菲恩睜開了眼睛：「……我還沒看夠。」',set_=['thorn_awake']),
    O('你只好把他扛出來。菲恩在半路醒了，抱怨你把他的夢弄壞了。',set_=['thorn_awake'])),
  story('n3','帶菲恩回苔語村','奧克塔維亞抱住菲恩，唱了一首很長的歌。',atnpc('octavia_mossvoice','mosswhisper'),req('thorn_awake'),
    O('她教了你幾句森語，說森林會記得你。',complete=True,eff=[aff('octavia_mossvoice',12),aff('fenn_apprentice',12)]))],
  [money(700),xp(900),rep('elf_court',1)],group='地下城傳說')
S('blank_oath','血誓碑上的空白','B','血誓碑谷的守碑人卡爾頓用手語告訴你：碑上有一塊空白——那是「最初的背誓者」的名字，被人刮掉了。',
  start_npc('carlton_silent','卡爾頓用手語比劃：名字、刮掉、血岩深穴。他把一把刻刀交給你。',min_level=9),
  'oath_start',[
  combat('n1','到血岩深穴的中層找那個名字','血誓騎士與血誓守衛守著一面滲血的岩壁。岩壁上，有人用血寫了一個名字，又一次次地被血覆蓋。',dun('bloodrock_cave','middle'),req('oath_start'),[['blood_knight',1],['bloodsworn_guard',1]],
    O('你用刻刀把名字拓了下來。',set_=['oath_name'])),
  choice('n2','把名字交給卡爾頓——還是不','名字在你手裡發燙。卡爾頓伸出手，等你決定。',cell('bloodplume','lm_blood_oath_valley'),req('oath_name'),[
    opt('交給他，讓名字重新刻上碑',O('卡爾頓把名字刻回碑上。那一刻，碑谷裡所有的碑都亮了一下。他對你深深鞠躬。',complete=True,eff=[aff('carlton_silent',15),rep('demon_council',2)])),
    opt('燒掉它',O('名字在火裡尖叫。卡爾頓看著你，很久，最後點了點頭——也許有些名字，不該被記住。',complete=True,eff=[aff('carlton_silent',5),xp(500)]))])],
  [money(2400),xp(1800)],group='地下城傳說')

GROUPS={k:v.pop('$group') for k,v in Q.items()}
json.dump({'stories':Q}, open(OUT+'stories.json','w'), ensure_ascii=False, indent=1)
print(len(Q))
