import json
m=json.load(open('data/world/maps.json'))
L=[
# id, name, emoji, loc, block, types, desc, scene
("lm_knight_academy","騎士學院","🛡️","rhineburg","gate",["military","academy"],"培養騎士的主要機構，教導騎士的思想與戰鬥技巧。","校場上傳來整齊的喊聲與鐵器碰撞聲，見習騎士在教官的口令下操練。"),
("lm_imperial_armory","帝國軍械院","⚙️","rhineburg","avenue",["workshop","military"],"據傳矮人技師與人類工匠在此共同打造「龍息鎧」。","高牆後終日傳出鍛打聲，衛兵盤查每一個靠近大門的人。"),
("lm_dawn_sanctum","晨曦聖殿","🌅","dawnlight","noble",["holy"],"據傳建於一位光明聖者隕落之地，祭壇上依然留有微光。","白石殿堂裡迴盪著聖歌，祭壇上的微光在晨間最為明亮。"),
("lm_healers_academy","治癒者學院","⚕️","dawnlight","plaza",["academy","holy"],"培養大陸上最優秀的光系魔法師與醫師。","穿白袍的學徒捧著藥草與典籍來回奔走，空氣裡有淡淡的草藥香。"),
("lm_windoath_tower","風誓塔","🗼","albena","river",["official","monument"],"七議席議會召開之地，每一任議員都要在高塔頂端立下「公正誓約」。","塔頂的風終年不停，塔下常有等著向議員陳情的人。"),
("lm_free_market","自由集市","💰","albena","market",["market"],"傳聞只要有足夠的金幣，連惡魔契約都能在這裡成交。","各族商人的叫賣聲混成一片，帳篷間藏著不少見不得光的買賣。"),
("lm_holy_ring_cathedral","聖環主殿","✨","soriel","sanctum",["holy","official"],"據傳建在「原初聖徒」升天之處，由教皇親自主持儀式。","環形的殿堂莊嚴肅穆，朝聖者排成長列等候祈福。"),
("lm_judgment_cloister","審判迴廊","⚖️","soriel","sanctum",["holy","official","haunted"],"教廷審訊與審判的聖所，傳說「真理之鏡」能照出靈魂的污點。","迴廊陰冷安靜，審判官的腳步聲在石壁間迴響。"),
("lm_silverscale_inn","銀鱗旅店","🐟","rivervale","bank",["monument","market"],"河谷鎮的老旅店，據說有間祕密地下室，曾接待過魔族使者。","老闆對地下室的事總是笑而不答，常客裡混著各國的探子。"),
("lm_old_stone_bridge","舊石橋","🌉","rivervale","bank",["monument","nature"],"「聯盟最古老的石橋」，象徵和平；據傳在橋上發的誓會受「流水之靈」見證。","河水在橋下潺潺流過，橋欄上刻滿歷代的誓言。"),
("lm_heartfire_forge","心火熔源","🔥","ironforge","forge",["workshop","holy"],"鐵爐堡的主爐，日夜不滅，象徵矮人精神與技藝之永恆。","熱浪撲面而來，矮人工匠對著爐火低聲祝禱後才開始工作。"),
("lm_elder_hall","長老石廳","🏛️","ironforge","noble",["official"],"鐵爐堡的長老在此議事，石壁上刻滿各氏族的族譜與功績。","厚重的石門半掩，裡面傳出長老們用古矮人語爭論的聲音。"),
("lm_everlit_beacon","長明烽火","🔦","snowridge","main",["military","monument"],"關牆最高處的烽火台終年不熄，風雪中為迷路的旅人指路；改燃藍焰便是向鐵爐堡示警。","烽火在風雪裡劈啪作響，守備隊員輪流添柴。"),
("lm_crimson_throne","赤焰王座廳","👑","bloodplume","palace",["official"],"莉莎爾的居所與議會核心，傳聞王座由一位墮落龍王的脊骨製成。","黑曜石大廳裡魔焰靜靜燃燒，侍衛的目光冷得像刀。"),
("lm_blood_oath_valley","血誓碑谷","🪦","bloodplume","noble",["monument","official"],"每位領主在此立誓效忠議會，碑上銘刻其真名；違誓者將被魔焰焚心。","成排的黑碑上刻滿名字，有幾塊碑面被燒得焦黑。"),
("lm_thousand_forges","千爐工坊","⚒️","moltenhold","keep",["workshop"],"數百座巨大熔爐同時運轉，冶煉出的金屬會發出魔族特有的「嗡鳴」。","嗡鳴聲與鍛打聲震耳欲聾，工匠赤著上身在熔爐間穿梭。"),
("lm_soulmelt_well","熔魂井","🌋","moltenhold","keep",["holy","haunted"],"祭祀陣亡戰士的熔金井，傳說能用死者的靈魂淬煉兵器。","井口翻騰著熔金，祭司一邊誦念戰士的名字一邊投下祭品。"),
("lm_golem_arena","機偶校場","🤖","moltenhold","bridge",["military"],"新鑄的地獄機偶與魔兵在此與死囚角鬥試煉，通過者才編入議會軍團。","看台上的領主們交頭接耳，場中的機偶發出刺耳的金屬聲。"),
("lm_evernight_tower","永夜塔","🌑","shadow_vale","low",["official","haunted"],"谷中的王宮，塔內無燈卻永不陷於黑暗。","塔身吞沒了周圍的光，靠近時會聽見若有似無的低語。"),
("lm_nightmare_maze","夢魘迷堂","🌀","shadow_vale","market",["holy","haunted"],"以幻術摺疊的神殿，據說連神祇的目光都無法窺見其中的真相。","迷堂的入口每次看都不太一樣，裡面的走廊似乎比外觀長得多。"),
("lm_bone_king_hall","骨王殿","💀","bone_hills","main",["official","monument"],"由遠古巨龍的骸骨搭建而成，是部族酋長的王座。","巨大的肋骨撐起殿頂，風穿過骨縫發出低沉的嗚咽。"),
("lm_blood_trial_ground","鮮血試煉場","🩸","bone_hills","main",["military","holy"],"每逢新月，戰士們在此獻血以求戰靈庇佑。","沙地被血染成暗紅，戰士們在場邊磨著獠牙與刀刃。"),
("lm_silent_corridor","無聲長廊","🕯️","silent_tomb","cathedral",["holy","haunted"],"死者的靈魂在此迴盪，唯有能聽見其低語的人才有資格成為祭司。","長廊裡一點聲音也沒有，連自己的腳步聲都聽不見。"),
("lm_ember_tower","遺火塔","🤍","silent_tomb","market",["holy","monument"],"永燃的白焰象徵靈魂不滅，是魔族罕見的「淨化聖火」。","白焰安靜地燃燒，灰燼修會的修士在塔下低頭默禱。"),
("lm_abyss_exchange","深淵交易所","📜","ashport","market",["market"],"任何契約都能在此成交，甚至包括靈魂與時間。","交易所裡的人都壓低聲音說話，契約的墨跡帶著血晶石的紅光。"),
("lm_greysail_pier","灰帆碼頭","⚓","ashport","port",["harbor","haunted"],"據傳有一艘永不靠岸的船，載著被放逐的領主靈魂。","霧裡偶爾看得見一面灰帆，碼頭工人總是避開不看。"),
("lm_reef_light_pillar","礁光柱","💡","canglue","gate",["monument"],"環繞都城的巨型珊瑚燈塔，終年發出柔光以維繫隔水結界，是玉璘族工匠代代維護的心血。","柔光透過結界灑落，看得見外面的魚群在水牆後游過。"),
("lm_tide_mirror","潮鏡台","🪞","canglue","market",["holy","monument"],"都城的核心廣場，傳說滿月之夜台面會映出下一任潮主的身影；「挑潮祭」與四時慶典都在此舉行。","玉盤般的礁石台面光滑如鏡，玉璘族在台邊宴飲賽舞。"),
("lm_four_seasons_gallery","四時迴廊","🐚","canglue","palace",["monument","official"],"連通四座宮闕的貝殼長廊，廊壁鑲嵌著歷代潮主的畫像與詩篇。","貝殼的廊壁映著七彩的光，偶爾有人駐足吟誦壁上的詩。"),
("lm_sandcastle_keep","沙堡","🏰","sandcastle","camp",["official","military"],"營地的核心建築，兼作瞭望塔、倉庫與談判廳，堡頂掛著沙痕部落贈予的駝骨風鈴。","風鈴在熱風裡叮噹作響，佣兵與部落族人在堡門口談生意。"),
("lm_tent_ring_bazaar","帳環市集","⛺","sandcastle","bazaar",["market"],"環繞沙堡搭建的帳篷集市，白日喧鬧如城，夜晚隨部族遷移的鼓聲收攤。","香料與皮革的氣味混在一起，貓魅族商人用尾巴招攬客人。"),
("lm_redmane_council","赤鬃議帳","🦁","sunscorch","main",["official"],"部落長老議事的巨型獸皮帳篷，帳頂懸掛歷代戰功者的鬃毛與獸角。","帳內燒著乾草，長老們盤腿而坐，談的多半是狩獵與決鬥。"),
("lm_stillspring_altar","靜泉祭壇","💧","stilltide_oasis","main",["holy","nature"],"供奉祖靈與月神的水畔祭壇，傳聞滿月之夜以泉水占卜最為靈驗。","泉面映著淡淡的銀藍微光，月尾部落的祭司在壇前輕聲吟唱。"),
("lm_moonlight_mother","月輝之母","🌳","silvermoon","noble",["nature","holy"],"承載整座王都的巨樹，樹幹寬闊如山；白銀藤蔓在夜裡散發月光。","樹皮溫暖而微微脈動，精靈經過時都會伸手輕觸。"),
("lm_spring_of_life","生命之泉","⛲","silvermoon","market",["nature","holy"],"與樹根相連的泉水，為全城提供魔力流通，以治癒之力聞名。","泉水清澈見底，水面不時浮起細小的光點。"),
("lm_seven_tides_hall","七潮議會廳","🏛️","tidehaven","noble",["official"],"潮汐港沒有國王，港內事務都在這裡由七潮議會裁決。","議會廳外擠滿等著申訴的船東與商人，大門上刻著七道浪紋。"),
("lm_deep_tide_pier","深潮席渡口","⛵","tidehaven","docks",["harbor"],"七潮議會的深潮席在此安排前往滄月闕的渡訪船次與嚮導。","渡口邊停著幾艘掛著玉璘族旗幟的船，嚮導在登記訪客的名字。"),
("lm_sea_spirit_shrine","海靈祠","🐚","coral_bay","town",["holy","nature"],"鎮民供奉海靈與風母的小祠，出海前都會來這裡祈求平安。","祠前擺滿珍珠與珊瑚的供品，海風吹動掛在簷下的貝殼。"),
("lm_ferry_lighthouse","渡口燈塔","🗼","coast_ferry","ferry",["harbor","monument"],"守護沿海航道的老燈塔，夜裡的燈火是渡船回航的依靠。","燈塔守夜人坐在門口補漁網，牆上記滿了歷年的潮汐。"),
("lm_granite_rampart","花崗岩城牆","🧱","greyrock","outer",["military","monument"],"以天然花崗岩鑄成的層層城牆，守衛通往矮人王國的山口，幾乎不可能被攻陷。","城牆上的矮人守衛來回巡邏，牆面布滿歷代攻城留下的痕跡。"),
("lm_wind_hammer","風錘","🔨","windhammer","main",["monument"],"村口的巨大石錘，山風吹過錘身的孔洞時會發出低沉的鳴響，村名由此而來。","石錘在風中嗡嗡低鳴，山民說聽得懂它的人就懂得山的脾氣。"),
("lm_mire_herb_beds","變異藥沼","🍄","rotmarsh","main",["nature","haunted"],"沼地裡長著能入藥也能致命的變異植物，村民靠採集維生。","毒霧貼著水面飄動，泥沼裡不時冒出氣泡。"),
("lm_whispering_ring","森語之環","🌿","mosswhisper","main",["nature","holy"],"苔語村舉行「森語儀式」的林間空地，村民在此與樹木交流、傾聽風的低語。","環狀排列的古樹下鋪滿苔蘚，風吹過時像有人在耳邊說話。"),
("lm_star_platform","浮石觀星台","✨","windspeak","main",["holy","military"],"藤橋與浮石台之間的觀星與祈風聖地，風鈴聲被認為能把亡者的靈魂送上天穹。","夜裡星光格外清楚，遊俠們在台邊擦拭弓弦。"),
]
legend=m['legend']
used=set()
out=[]
for (i,n,e,loc,blk,types,desc,scene) in L:
    b=[x for x in m['maps'][loc]['blocks'] if x['id']==blk][0]
    g=b['grid']; H=len(g); W=len(g[0])
    best=None
    for y in range(H):
        for x in range(W):
            if g[y][x]!='.' or (loc,blk,x,y) in used: continue
            # 不靠任何設施或通道；牆越多越像建築
            nb=[g[y+dy][x+dx] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)) if 0<=x+dx<W and 0<=y+dy<H]
            facil=sum(1 for c in nb if c not in '.#~')
            walls=sum(1 for c in nb if c=='#')
            floors=sum(1 for c in nb if c=='.')
            pass
            score=walls*2-facil*5-abs(x-W//2)*0.1
            if best is None or score>best[0]: best=(score,x,y)
    if best is None: print("NO", i, loc, blk); print("\n".join(g)); raise SystemExit
    used.add((loc,blk,best[1],best[2]))
    out.append({"id":i,"name":n,"emoji":e,"location":loc,"at":{"area":f"{loc}/{blk}","x":best[1],"y":best[2]},"types":types,"desc":desc,"scene":scene})
types={
 "holy":{"name":"聖地","npc":{"commoner":1,"adventurer":0.5,"tags":{"priest":6,"bishop":6,"good":1}}},
 "academy":{"name":"學院","npc":{"commoner":1,"adventurer":1,"tags":{"noble":2}}},
 "official":{"name":"官府・議會","npc":{"commoner":0.5,"adventurer":0.3,"tags":{"noble":4,"royal":3}}},
 "military":{"name":"軍事・校場","npc":{"commoner":0.5,"adventurer":2}},
 "market":{"name":"市集・交易","npc":{"commoner":2,"adventurer":1,"tags":{"merchant":4,"traveler":2,"villain":1}}},
 "workshop":{"name":"工坊","npc":{"commoner":1.5,"adventurer":0.5}},
 "harbor":{"name":"碼頭・渡口","npc":{"commoner":1.5,"adventurer":1,"tags":{"traveler":3,"merchant":2}}},
 "monument":{"name":"古蹟","npc":{"commoner":1,"adventurer":1,"tags":{"traveler":2}}},
 "nature":{"name":"自然","npc":{"commoner":1,"adventurer":0.5}},
 "haunted":{"name":"陰森之地","npc":{"commoner":0.3,"adventurer":0.5,"tags":{"villain":2}}},
}
doc={"$comment":"城鎮的特色地標（docs/LANDMARKS.md）。地標是聚落地圖上的一格（at：區塊 key 與座標，要是道路），格子的種類就是地標的 id（lm_ 開頭）。types 是地標的類型：生成居民的分布（npc：一般人、冒險者的權重，tags：帶這些標籤的人的權重）與公會委託的標的都看類型。資料來源：世界書各區域條目的「特色建築」，沒有寫到的聚落由本專案補寫。",
 "version":1,"types":types,"landmarks":out}
json.dump(doc,open('data/world/landmarks.json','w'),ensure_ascii=False,indent=1)
print(len(out))
for o in out: print(o['id'],o['at'])
