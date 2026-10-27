"""第二部分：成人向角色（adult: true，成人向內容關閉時完全不出現）。可以重跑：先移除同 id 的再加上。"""
import json, sys
sys.path.insert(0, 'worldgen/scripts/elondia')
from npcfmt import write

ROOT = '.'
OUT = f'{ROOT}/data/world/npcs.json'
base = json.load(open(OUT))
H = lambda *a: [{'location': l, 'zone': z, 'weight': w} for l, z, w in a]
G = lambda **kw: {k: {'base': b, 'material': m} for k, (b, m) in kw.items()}

def npc(id, name, gender, race, cls, level, location, hire_cc, **kw):
    kind = 'commoner' if not cls else 'adventurer'
    n = dict(id=id, name=name, gender=gender, race=race, **{'class': cls}, level=level, location=location, hire_cc=hire_cc, adult=True, kind=kind)
    n.update(kw)
    return n

new = [
    # ---- 索里耶爾
    npc('npc_aya', '阿雅', 'female', 'human', 'cleric', 4, 'soriel', 400,
        tags=['priest', 'good'], faction='holy_ring',
        haunts=H(('soriel', 'town', 1), ('soriel', 'temple', 0.6)),
        personality='怯懦、溫柔、說話小聲，總是先替別人著想；私底下滿腦子說不出口的妄想，對黝黑壯碩的異族男人特別沒有抵抗力，一被看穿就紅著臉語無倫次。',
        appearance='身高 158 公分，棕色及肩中髮，圓臉、下垂眼；身材豐腴得驚人——G 罩杯的胸部把修女服撐得緊繃，髖部與臀腿也豐碩得誇張。總是抱著一本皮面的祈禱書。',
        adult_appearance='乳暈大而淡粉，非常敏感；陰毛柔軟稀疏，一緊張下面就會濕。祈禱書裡夾著寫滿妄想的筆記。',
        background='二十二歲，索里耶爾外環一座小禮拜堂的牧師。在修道院長大，規規矩矩地當上神職者，卻從見習時期就有個秘密：那本祈禱書其實是她的妄想筆記，寫滿了和黝黑異族男人之間的不道德情節。她很怕被人發現，更怕自己哪天真的把它實現了。',
        gear=G(body=('nun_habit', 'linen'), head=('nun_veil', 'linen'), main_hand=('mace', 'iron')),
        relations={}),

    # ---- 晨光城
    npc('npc_lena', '蕾娜', 'female', 'human', '', 2, 'dawnlight', 0,
        tags=['commoner'], occupation='賣花的姑娘', faction='dawn_kingdom',
        haunts=H(('dawnlight', 'town', 1)),
        personality='甜美、溫柔、笑容像陽光一樣；一旦喜歡上誰，就會溫柔地、徹底地、一步也不讓地把他留在身邊，記得他說過的每一句話、走過的每一條路。',
        appearance='二十一歲的賣花姑娘，淡紫色長髮編成側辮、別著小白花，粉色眼睛總是笑瞇瞇的；嬌小玲瓏，C 罩杯，穿著碎花洋裝與圍裙，花籃裡永遠放著一把修枝剪。',
        adult_appearance='洋裝底下穿著成套的白色蕾絲內衣，像是隨時都準備好了；大腿上綁著一條繡著某人名字的緞帶。',
        background='在晨光城日輪廣場賣花的姑娘，人緣很好，誰都喜歡她。她的上一個「好朋友」留下一封信就連夜逃到了河谷鎮，信上只寫著「對不起，太重了」。她說他只是去旅行了，總有一天會回來——她每天都會去城門口等。',
        gear=G(body=('dress', 'linen')),
        relations={}),
    npc('npc_valerie', '瓦萊莉', 'female', 'human', 'cleric', 7, 'dawnlight', 865,
        tags=['priest'], faction='dawn_kingdom',
        haunts=H(('dawnlight', 'noble', 1), ('dawnlight', 'town', 0.3)),
        personality='冷靜、理性、說話像在寫病歷，對人體的興趣遠大於對人的興趣；檢查時一本正經地提出讓人臉紅的要求，自己卻完全不覺得有什麼，常把「為了研究」當成藉口。',
        appearance='三十二歲的女醫師，黑色長髮盤起，細框眼鏡、左眼下有一顆淚痣；白袍底下是貼身的黑色高領洋裝，E 罩杯的成熟身材，腰間掛著一排藥瓶與診療工具。',
        adult_appearance='白袍口袋裡永遠有手套和潤滑用的藥膏；她自己的身體也是研究對象，筆記裡有詳細的「自我觀察紀錄」。',
        background='治癒者學院的研究醫師，專攻「生命力與魔力的循環」。她的論文〈論性交對傷勢癒合速度的影響〉被學院列為禁書，她說只是缺少足夠的臨床樣本。學院院長托比亞斯對她又敬又怕。',
        gear=G(body=('long_coat', 'silk'), main_hand=('mace', 'steel')),
        relations={'npc_tobias_green': '院長。好人，就是太保守，連她的論文都不敢看完。'}),
    npc('npc_lilian', '莉莉安', 'female', 'human', 'wizard', 6, 'dawnlight', 690,
        tags=['traveler', 'good'], faction='dawn_kingdom',
        haunts=H(('dawnlight', 'town', 1), ('dawnlight', 'outskirts', 0.4)),
        personality='正義感強烈、熱血、愛擺姿勢，變身時會大喊台詞；年紀越大越在意「少女」兩個字，被叫「阿姨」會當場崩潰。',
        appearance='二十五歲的女冒險者，平常是穿著樸素、粉色短髮的普通女子；變身後換上粉白相間、裙子短到大腿根的魔法少女服，手持星形法杖，C 罩杯，一雙長腿。',
        adult_appearance='變身用的神器「星之心」有個副作用：每次變身之後，身體都會發熱、敏感好幾個小時，她一直很努力地假裝沒事。',
        background='十五歲那年在晨霧修道院遺址撿到一顆會說話的星形寶石，從此成為「守護晨光城的魔法少女」。十年過去，寶石還是要她喊一樣的台詞、穿一樣的衣服。她最大的心願，是讓寶石認可一個繼承人，好讓自己「畢業」。',
        gear=G(body=('magical_girl', 'silk'), leg_accessory=('thigh_highs', 'silk'), main_hand=('spellstaff', 'yew')),
        relations={}),

    # ---- 萊茵堡
    npc('npc_isadora', '伊莎朵拉・馮・霍恩海姆', 'female', 'human', 'fighter', 7, 'rhineburg', 0, unhireable=True,
        tags=['noble'], faction='rhine_empire',
        haunts=H(('rhineburg', 'noble', 1), ('rhineburg', 'town', 0.3)),
        personality='高傲、強勢，說話帶著「哦呵呵」的笑聲，把所有人都當僕人使喚；其實是個不知道怎麼跟人相處的寂寞大小姐，一被溫柔對待就手足無措，嘴上反而更凶。',
        appearance='二十歲的貴族千金，金色長髮捲成華麗的螺旋捲，紫羅蘭色眼睛，總是抬著下巴；高挑豐滿，E 罩杯，穿著紫色禮服與蕾絲長手套，腰間佩著細劍，手裡拿著馬鞭。',
        adult_appearance='從沒被人碰過，卻偷偷收藏了一整櫃的禁書；被支配時會出乎意料地乖順。私處修剪整齊，下腹有一顆小小的痣。',
        background='霍恩海姆侯爵家的獨生女，帝國社交界有名的「鞭子大小姐」，換掉的護衛比她穿過的禮服還多。父親想把她嫁給第二軍團的雷歐哈特將軍，她為了反抗婚約，決定自己找一個「配得上本小姐」的護衛——或者說，一個能帶她逃走的人。',
        gear=G(body=('gown', 'silk'), wrists=('opera_gloves', 'silk'), main_hand=('rapier', 'mithril')),
        relations={'npc_leonhart': '父親替她挑的未婚夫。吵死了，她才不要。', 'npc_eve': '女僕長。全家她唯一怕的人。'}),

    # ---- 阿爾貝納
    npc('npc_camilla', '卡蜜拉', 'female', 'human', 'wizard', 11, 'albena', 1775,
        tags=['traveler'],
        haunts=H(('albena', 'town', 1), ('albena', 'brothel', 0.2)),
        personality='溫柔、充滿母性，叫誰都是「孩子」，誰哭了都會抱進懷裡；卻有嚴重的酗酒問題與糟糕透頂的生活習慣，房間像被魔法炸過，三餐全靠弟子打理。',
        appearance='高挑的女法師，粉色長捲髮蓬鬆凌亂，D 罩杯的豐滿胸部，腰身緊實、臀腿豐腴，是會讓人回頭的性感身材；法袍永遠扣錯扣子，手裡總拎著一瓶酒。',
        adult_appearance='胸前與大腿根部刻著白濁魔導的淡粉色紋路，施法時會發光；私處豐潤，陰毛修成心形——據她說是為了「提升魔力迴路的效率」。',
        background='三十八歲，「白濁魔導」的創始者——以精液為媒介施法的魔導。曾是阿爾貝納魔導師工會最有前途的研究者，因為研究內容太驚世駭俗被工會除名。現在在河畔區開了一間沒有招牌的研究室，教唯一的弟子伊蓮娜，靠接一些奇怪的委託換酒錢。',
        gear=G(body=('robe', 'spellweave'), main_hand=('spellstaff', 'elderwood')),
        relations={'npc_elena': '唯一的弟子，也是她的家人。雖然現在是誰在照顧誰，她不太想去想。'},
        squad={'name': '卡蜜拉魔導研究室', 'members': ['npc_elena'], 'together': 0.8}),
    npc('npc_elena', '伊蓮娜', 'female', 'human', 'wizard', 5, 'albena', 535,
        tags=['traveler'],
        haunts=H(('albena', 'town', 1), ('albena', 'brothel', 0.3)),
        personality='無口，長年面無表情，一句話很少超過五個字；實際上非常好色、悶騷，對性愛幾乎沒有羞恥心，常面無表情地說出驚人的提議。照顧師父起居時意外地細心。',
        appearance='身高 152 公分的嬌小女法師，藍色長髮直順及腰，半睜的藍色眼睛看不出情緒；身材纖瘦，穿著寬大的深藍法袍，懷裡抱著一個裝滿小玻璃瓶的皮匣。',
        adult_appearance='法袍底下什麼都沒穿。皮匣裡的小瓶裝的是施法用的精液；下體光潔無毛，對快感的反應和臉上的平靜完全相反。',
        background='二十三歲，卡蜜拉的弟子，學的是師父自創的「白濁魔導」：以精液為媒介施法，效果驚人，媒介卻得自己去「收集」。她對濫交早已習以為常，私生活的傳聞讓幾乎沒有人願意跟她組隊；她自己倒不在意，每天的工作就是收集媒介，再把醉倒的師父拖回家。',
        gear=G(body=('robe', 'silk'), main_hand=('spellstaff', 'yew')),
        relations={'npc_camilla': '師父。生活能力是零，但她不會讓別人照顧她。'}),
    npc('npc_serena', '瑟蕾娜', 'female', 'human', '', 5, 'albena', 0,
        tags=['prostitute'], occupation='花魁',
        haunts=H(('albena', 'brothel', 1), ('albena', 'town', 0.1)),
        personality='嫵媚、從容、說話慢條斯理，每一個眼神都經過計算；在客人面前永遠完美，私底下卻愛看冒險小說，夢想有一天能親眼看看海。',
        appearance='二十六歲的花魁，烏黑長髮挽成華麗的髮髻、插滿金簪，眼角一抹紅；穿著開衩到腰的旗袍式華服，F 罩杯，腰細臀豐，一舉一動都像在跳舞。',
        adult_appearance='精通房中術，全身上下都經過細心的保養；大腿內側刺著一朵小小的蓮花，是她當上花魁那年刺的。',
        background='阿爾貝納「金蓮樓」的頭牌，一夜的價錢能買下一棟房子。她小時候被賣進樓裡，身上的契約還有十年；贖身的價錢是天文數字，掌管契約牌照的議員瑪蒂爾達說，這筆錢「可以商量」。',
        gear=G(body=('qipao', 'moonsilk'), feet=('heels', 'silk')),
        relations={'npc_matilda_rosen': '握著她契約的人，笑起來比任何客人都可怕。'}),

    # ---- 沿海渡口
    npc('npc_amelia', '艾蜜莉亞', 'female', 'human', '', 3, 'coast_ferry', 0,
        tags=['commoner', 'merchant'], occupation='酒館老闆娘', faction='dawn_kingdom',
        haunts=H(('coast_ferry', 'town', 1)),
        personality='溫柔、勤快，笑容總帶著一點落寞；丈夫出海兩年沒有回來，夜裡寂寞得睡不著，卻一直告訴自己要守著這個家。對年輕的冒險者特別照顧，照顧得有點過頭。',
        appearance='二十八歲的少婦，栗色長髮鬆鬆地盤在腦後，幾縷髮絲垂在頸邊；成熟豐滿的身材，F 罩杯，腰身柔軟，總穿著領口有點低的圍裙洋裝，左手無名指戴著磨亮的婚戒。',
        adult_appearance='久未被觸碰的身體敏感得驚人；臥房衣櫃的深處，藏著她不敢承認自己用過的東西。',
        background='沿海渡口「海鷗亭」酒館的老闆娘。丈夫是船員，兩年前跟著商船出海後音訊全無。她一個人撐著酒館，等一封不知道會不會來的信；渡口的人都說她早該改嫁，她只是笑笑。',
        gear=G(body=('dress', 'linen')),
        relations={'npc_marina': '常來喝酒的船長丫頭，一直說要幫她找丈夫的船。'}),

    # ---- 潮汐港
    npc('npc_oboro', '朧', 'female', 'yulin', 'rogue', 8, 'tidehaven', 1060,
        tags=['traveler'], lineage='冬璃宮（隱密）', faction='four_seasons',
        haunts=H(('tidehaven', 'town', 1), ('tidehaven', 'outskirts', 0.3), ('coral_bay', 'town', 0.1)),
        personality='冷淡、寡言、一板一眼，自稱「影子不需要感情」；卻完全藏不住情緒——臉紅、尾巴亂擺、說話結巴，每次被發現都會說「請、請當作沒看見」。',
        appearance='二十四歲的玉璘族女忍者，黑色短髮、銀灰色眼睛，化形上岸時雙腿修長，耳後有細小的鰓；穿著貼身的深藍忍裝與網格內襯，C 罩杯，身材精瘦柔韌。',
        adult_appearance='忍裝底下纏著胸布；鱗片從腰側一路延伸到大腿內側，被碰到時會微微張開。修行過「房中術」，卻只學了理論。',
        background='冬璃宮的隱密，奉命在潮汐港監視上岸的陸地人與可疑的走私船。任務是當一個看不見的影子，她卻常常在屋頂上被人發現。最近她接到新的任務：監視一個「行為可疑」的冒險者。',
        gear=G(body=('leather_armor', 'hard_leather'), main_hand=('shortsword', 'steel')),
        relations={'npc_rigetsu': '主上。她的命令是一切。'}),

    # ---- 沙堡營地
    npc('npc_belvia', '貝爾維婭', 'female', 'catfolk', 'monk', 6, 'sandcastle', 690,
        tags=['traveler'], lineage='赤鬃部落',
        haunts=H(('sandcastle', 'town', 1), ('sandcastle', 'outskirts', 0.5), ('sunscorch', 'town', 0.1)),
        personality='傲嬌、任性，嘴巴比拳頭還快，說「才不是為了你」的次數比說謝謝還多；有自毀傾向，總愛找比自己強的人打架、喝到爛醉，像是想把自己弄壞。',
        appearance='身高 170 公分的貓魅族武僧，金色長髮綁成高馬尾，金色貓耳缺了一角；身形纖細高挑，B 罩杯的圓盤型胸部，常年奔跑練出緊實健美的腰身與長腿，穿著露腰的短武道服與綁腿。',
        adult_appearance='腰側與大腿內側留著淡淡的舊鞭痕與烙印；被碰到敏感處時，尾巴會不自覺地纏上對方的手。',
        background='二十四歲。曾被一夥盜賊抓去當了一年的玩物，逃出來後拚命修練拳腳，發誓不再被任何人支配——卻始終忘不了那段日子，忘不了身體記住的事，這讓她更厭惡自己。現在在沙堡營地接護衛委託，專挑盜賊下手。',
        relations={}),

    # ---- 血羽城堡（耽樂之都）
    npc('npc_lucia', '露西菈', 'female', 'demon', 'wizard', 5, 'bloodplume', 535,
        tags=['traveler', 'good'], lineage='魅魔（赤翼宮廷）', faction='demon_council',
        haunts=H(('bloodplume', 'town', 1), ('bloodplume', 'noble', 0.3)),
        personality='純情、容易害羞，一被誇就整個人冒煙；身為魅魔卻連手都沒牽過，魅惑術總在最後一刻因為太緊張而失敗。認真又努力，每天抱著《魅魔百態》做筆記。',
        appearance='二十五歲（以魅魔來說剛成年）的魅魔，酒紅色短髮、一對小小的彎角，背後的蝠翼比同族小一號，心形尾巴一緊張就打結；身材是魅魔標準的豐滿曲線，卻總穿著包得緊緊的學院制服。',
        adult_appearance='還是處女，連自己都很少碰；下腹的淫紋是成年時刻上的，還沒「用過」，平常是淡淡的粉色，心動時會亮起來。',
        background='赤翼宮廷魅魔學院的萬年留級生。畢業考的題目是「讓一個人類心甘情願地愛上妳」，她已經考了七次。再不及格就要被送回鄉下老家，所以她決定在血羽城堡找一個看起來好說話的人類——練習。',
        gear=G(body=('sailor_uniform', 'linen')),
        relations={}),
    npc('npc_cassandra', '卡珊卓', 'female', 'human', 'rogue', 10, 'bloodplume', 0, unhireable=True,
        tags=['merchant'],
        haunts=H(('bloodplume', 'brothel', 1), ('bloodplume', 'town', 0.3)),
        personality='高冷、優雅、強勢，說話從不提高聲音，卻沒有人敢不聽；把人當成調教的對象，是血羽城堡最有名的「女王」。私底下卻渴望遇到一個能讓她跪下的人。',
        appearance='三十歲的高挑美女，黑色長髮綁成高馬尾，冰藍色眼睛、紅唇；穿著黑色皮緊身衣、過膝長靴與長手套，D 罩杯，身材修長有力，手上的鞭子比她的話更有分量。',
        adult_appearance='皮衣底下的乳頭穿著銀環；脖子上的黑色頸環是她唯一不肯摘下的東西——傳說那是她還是奴隸時的項圈。',
        background='人類，曾是被賣到荒原的奴隸，靠手腕與狠勁一路爬上血羽城堡最大的夜宴館「黑薔薇」的主人。耽樂之都的魔族貴族排隊等她的鞭子，人類旅客則把她當成傳說。她說頸環是一種「提醒」，至於提醒什麼，她從不說。',
        gear=G(body=('leather_bodysuit', 'beast_hide'), wrists=('opera_gloves', 'silk'), main_hand=('dagger', 'mithril')),
        relations={'npc_rona': '店裡的女僕，嘴比她的鞭子還毒。', 'npc_lana': '店裡的女僕，打破的杯子她從不扣錢。'}),
    npc('npc_rona', '蘿娜', 'female', 'demon', 'rogue', 6, 'bloodplume', 690,
        tags=['commoner'], lineage='魅魔（赤翼宮廷）', faction='demon_council',
        haunts=H(('bloodplume', 'brothel', 1), ('bloodplume', 'town', 0.4)),
        personality='腹黑、毒舌、笑容完美，服侍得無可挑剔，一邊倒茶一邊用敬語罵人；最喜歡捉弄妹妹和看起來好欺負的客人。',
        appearance='二十二歲的雙胞胎魅魔女僕（姊姊），黑色鮑伯頭、左眼下有淚痣，赤色眼睛；穿著黑白女僕裝與白色過膝襪，小小的角上繫著黑色緞帶，D 罩杯。',
        adult_appearance='女僕裝的裙底是黑色吊帶襪與丁字褲；姊妹倆從小一起「學習」，對彼此的身體瞭如指掌。',
        background='赤翼宮廷女僕學校出身的雙胞胎姊姊，被派到夜宴館「黑薔薇」服侍卡珊卓。姊妹倆從小就有個約定：要嫁，就嫁給同一個人。',
        gear=G(body=('maid_dress', 'silk'), head=('maid_headdress', 'silk'), leg_accessory=('thigh_highs', 'silk')),
        relations={'npc_lana': '笨手笨腳的妹妹。全世界只有她可以欺負。', 'npc_cassandra': '主人。很強，但她看得出主人在等什麼。'},
        squad={'name': '雙子女僕', 'members': ['npc_lana'], 'together': 1}),
    npc('npc_lana', '菈娜', 'female', 'demon', 'bard', 6, 'bloodplume', 690,
        tags=['commoner'], lineage='魅魔（赤翼宮廷）', faction='demon_council',
        haunts=H(('bloodplume', 'brothel', 1), ('bloodplume', 'town', 0.4)),
        personality='天然、愛哭、笨手笨腳，打破的盤子比端出去的還多；一旦喜歡上誰就全心全意，是姊姊唯一捨不得真的欺負的人。',
        appearance='二十二歲的雙胞胎魅魔女僕（妹妹），黑色鮑伯頭、右眼下有淚痣，赤色眼睛總是濕濕的；穿著同款女僕裝，角上繫著白色緞帶，D 罩杯。',
        adult_appearance='裙底是白色吊帶襪與蕾絲內褲；尾巴非常敏感，被摸到就會腿軟。',
        background='赤翼宮廷女僕學校出身的雙胞胎妹妹，和姊姊一起在夜宴館「黑薔薇」工作。她唯一做得比姊姊好的事，是唱歌——客人常常為了聽她唱歌而來，忘了她剛剛打翻了酒。',
        gear=G(body=('maid_dress', 'silk'), head=('maid_headdress', 'silk'), leg_accessory=('thigh_highs', 'silk')),
        relations={'npc_rona': '最喜歡的姊姊，雖然每天都被欺負。'}),
    npc('npc_noel', '諾艾爾', 'femboy', 'demon', 'bard', 5, 'bloodplume', 535,
        tags=['merchant'], lineage='夢魔（赤翼宮廷）', faction='demon_council',
        haunts=H(('bloodplume', 'town', 1), ('bloodplume', 'brothel', 0.3)),
        personality='嬌媚、愛撒嬌、愛捉弄人，看到有人把他當女孩子就笑得很開心；明明是夢魔，最拿手的卻是被欺負時那副可憐兮兮的表情。',
        appearance='二十歲的偽娘夢魔，身高 165 公分，銀粉色長捲髮，紫色眼睛，一對小小的黑角與小蝠翼；纖細的身材穿著蕾絲哥德洋裝與黑色過膝襪，任誰看都是個漂亮的女孩子。',
        adult_appearance='裙底藏著一根和外表不相稱的尺寸；夢魔的體質讓他的身體比女孩子還要敏感，後庭尤其。',
        background='夢魔是魔族裡男性的魅魔，他卻從小就愛穿裙子，被同族笑稱「赤翼宮廷最可愛的魅魔」。現在在血羽市集的香水店工作，人類客人常常要到最後一刻才發現他的「秘密」。',
        gear=G(body=('gothic_lolita', 'silk'), leg_accessory=('thigh_highs', 'silk')),
        relations={'npc_lucia': '學院時代的同學，他教她怎麼魅惑人，她每次都失敗。'}),

    # ---- 熔火堡壘
    npc('npc_zero', '零號', 'female', 'human', 'fighter', 7, 'moltenhold', 865,
        tags=['good'], lineage='機偶（千爐工坊試作）', faction='demon_council',
        haunts=H(('moltenhold', 'town', 1)),
        personality='平靜、誠實，說話像在報告數據；對「感情」充滿研究熱情，常常一本正經地問「這種胸口發熱的現象叫什麼」。學東西極快，學壞也極快。',
        appearance='少女型機偶，外表是二十歲左右的成年女性，白銀色短髮，金色眼睛裡有細小的齒輪紋；關節處有精緻的接縫，C 罩杯，肌膚是溫熱的人造皮革，胸口嵌著一顆發著橘光的魔核。',
        adult_appearance='伊格妮絲為了「完整模擬人類」把她做得非常完整，包括所有的機能；她把這件事記錄為「未測試功能」。',
        background='千爐工坊的試作機偶，伊格妮絲做給自己當助手的「民用型」，啟動至今三年，機體設計為成年女性。工坊的軍方客戶想把她拆開，量產成戰鬥機偶；伊格妮絲把她藏在機偶校場當雜工，她自己則想弄清楚「喜歡」是什麼。',
        gear=G(main_hand=('warhammer', 'steel')),
        relations={'npc_ignis_forge': '造物主。她說伊格妮絲是「母親」，伊格妮絲每次都會臉紅。', 'npc_karen': '校場的冠軍，她觀察的對象之一。'}),
    npc('npc_karen', '卡蓮', 'futa', 'demon', 'barbarian', 9, 'moltenhold', 1275,
        tags=[], lineage='炎魔（炎獄軍團）', faction='demon_council',
        haunts=H(('moltenhold', 'town', 1)),
        personality='豪爽、好鬥、強勢，把喜歡的人當成戰利品；輸了就認輸，認輸了就黏著打贏她的人不放。最受不了被人小看。',
        appearance='二十七歲的炎魔女鬥士，身高 182 公分，赤銅色肌膚上流動著熔岩紋路，火紅短髮、金色眼睛；肌肉結實、F 罩杯，只穿著胸甲與腰布，背著一把巨斧。',
        adult_appearance='扶她，腰布下的肉棒尺寸驚人；興奮時熔岩紋會發亮，體溫高得發燙。',
        background='機偶校場的常勝冠軍，「鐵顎」格倫手下最賺錢的鬥士。她說誰能在校場上打倒她，她就是誰的——至今還沒有人做到。',
        gear=G(main_hand=('greataxe', 'steel')),
        relations={'npc_gren_ironjaw': '老闆，最會拿她的比賽開賭盤。'}),

    # ---- 寂墓聖堂
    npc('npc_eileen', '艾琳', 'female', 'human', 'wizard', 6, 'silent_tomb', 690,
        tags=['good'], lineage='幽靈',
        haunts=H(('silent_tomb', 'town', 1)),
        personality='寂寞、愛撒嬌、話很多，好不容易遇到看得見她的人就黏著不放；常常忘記自己已經死了，想坐椅子結果整個人穿過去。',
        appearance='半透明的少婦幽靈，外表約二十五歲，淡金色長髮在空中飄浮，穿著百年前樣式的白色婚紗；身材纖細，婚紗的胸口與腰間有一道撕裂的痕跡。',
        adult_appearance='碰不到東西，卻能「進入」別人的夢與身體；她說自己死前還沒來得及度過新婚之夜，這是她唯一的遺憾。',
        background='百年前死在婚禮前夜的人類新娘，靈魂不知怎麼飄到了寂墓聖堂。死靈祭司們覺得她無害，就讓她留在無聲長廊。她在等一個能讓她「完成婚禮」的人——莉菈說，那個人只要看得見她就好。',
        relations={'npc_lila_listener': '唯一的朋友，聽得見她說話的見習祭司。'}),

    # ---- 腐沼村
    npc('npc_pururu', '普露露', 'female', 'demon', 'druid', 4, 'rotmarsh', 400,
        tags=['good'], lineage='史萊姆（腐沼變異種）',
        haunts=H(('rotmarsh', 'town', 1), ('rotmarsh', 'outskirts', 0.4)),
        personality='天然、好奇、什麼都想學，學人類說話學得很快卻常常用錯；不懂什麼叫害羞，看到喜歡的東西就整個貼上去。最近在研究人類的「戀愛」。',
        appearance='半透明的水藍色史萊姆娘，平常化成身高約 160 公分的成年女性模樣，髮絲與身體邊緣微微流動，胸部大小會隨心情變化；沒有穿衣服的必要，卻會模仿人類「穿」出一件水色洋裝。',
        adult_appearance='身體的任何地方都能變成任何形狀，也能把東西包進體內；觸感冰涼柔滑，興奮時體溫升高、顏色變成淡粉色。',
        background='腐沼村變異藥沼裡誕生的史萊姆，已經活了二十多年，最近才學會固定成人形。莫格婆婆把她當孫女養，教她認草藥。她從路過的商人那裡聽說人類有一種叫「結婚」的儀式，非常想試試看。',
        relations={'npc_morg_herbwife': '婆婆。罵人很兇，抱起來很溫暖。'}),

    # ---- 苔語村
    npc('npc_ilania', '艾拉妮雅', 'female', 'elf', 'druid', 8, 'mosswhisper', 1060,
        tags=['good'], faction='elf_court',
        haunts=H(('mosswhisper', 'town', 1), ('mosswhisper', 'outskirts', 0.4)),
        personality='天然、溫柔、慢半拍，把所有比她年輕的人都當孩子疼（也就是所有人）；對人類的「急躁」很好奇，對自己的身體會引起什麼反應則毫無自覺。',
        appearance='外表三十歲上下、實際三百多歲的精靈，淡綠色長髮及膝、綴著小花；精靈中少見的豐滿身材，H 罩杯，穿著寬鬆的葉紋長袍，總是赤腳，身上有淡淡的花香。',
        adult_appearance='精靈每百年一次的「月華期」快到了——那段時間她的身體會變得非常敏感，散發出讓人難以抗拒的香氣，她自己卻以為只是感冒。',
        background='苔語村的草藥師，奧克塔維亞的老朋友，照顧過村裡三代人的孩子，現在也幫忙照顧菲恩。精靈的「月華期」百年一次，她上一次是在一個人類村莊度過的；這次村裡的長老們都在擔心。',
        gear=G(body=('robe', 'moonsilk')),
        relations={'npc_octavia_mossvoice': '老朋友，總是叮嚀她「月華期」要小心。', 'npc_fenn_apprentice': '她照顧的孩子之一。'}),
    # ======== 解鎖事件用的角色 ========
    # ---- 萊茵堡：三位人妻（三人都攻略完成：人妻下午茶會）
    npc('npc_margarete', '瑪格麗特・馮・艾森', 'female', 'human', '', 4, 'rhineburg', 0,
        tags=['noble'], occupation='伯爵夫人', faction='rhine_empire',
        haunts=H(('rhineburg', 'noble', 1)),
        personality='優雅、端莊，說話帶著上流社會的從容與一點倦意；丈夫年長她三十歲，婚姻只剩禮節。表面嚴守貞節，對年輕人的熱情卻毫無抵抗力。',
        appearance='三十六歲的伯爵夫人，深紅色長髮盤成典雅的髮髻，琥珀色眼睛帶著慵懶；成熟豐滿，F 罩杯，腰身依然纖細，穿著酒紅色禮服與珍珠項鍊，手持羽扇。',
        adult_appearance='禮服底下是黑色蕾絲的成套內衣與吊帶襪，是為一個從未出現的人準備的；被吻到頸側，就會失去所有的端莊。',
        background='艾森伯爵的續弦，嫁進伯爵家十五年，丈夫如今只關心他的收藏與痛風。她主持帝都最有名的沙龍，貴族們都說她是帝國最完美的夫人——只有她自己知道，每個沙龍散場後的夜晚有多長。',
        gear=G(body=('gown', 'moonsilk'), feet=('heels', 'silk')),
        relations={'npc_lieselotte': '沙龍的點心都跟她的麵包店訂，一個很有活力的孩子。', 'npc_clara': '她偷偷在讀「紫丁香」的小說，不知道作者就在身邊。'}),
    npc('npc_lieselotte', '莉澤洛特', 'female', 'human', '', 3, 'rhineburg', 0,
        tags=['commoner', 'merchant'], occupation='麵包店老闆娘', faction='rhine_empire',
        haunts=H(('rhineburg', 'town', 1)),
        personality='開朗、健談、力氣很大，笑聲整條街都聽得見；丈夫在南境前線一年只回家一次，她說沒關係，揉麵團揉得比誰都用力。',
        appearance='二十六歲的麵包店老闆娘，蜂蜜色馬尾、臉上有雀斑，健康的小麥色肌膚；豐滿結實，E 罩杯，袖子捲到手肘，圍裙上總沾著麵粉。',
        adult_appearance='揉麵練出有力的腰臀；一年只見一次丈夫的身體正值慾望最旺盛的年紀，夜裡常常一個人在烤爐邊睡不著。',
        background='萊茵堡下城區「麥穗麵包店」的老闆娘。丈夫是第三軍團的士兵，駐守南境前線，一年只有收穫節能回家幾天。她每週寄一籃麵包到前線，自己一個人撐著店，也一個人度過每一個夜晚。',
        gear=G(body=('dress', 'linen')),
        relations={'npc_margarete': '沙龍的大客戶，很溫柔的貴婦人，總是多給小費。', 'npc_clara': '每天早上來買麵包的鄰居，話不多，但會借她書。'}),
    npc('npc_clara', '克拉拉', 'female', 'human', '', 3, 'rhineburg', 0,
        tags=['commoner'], occupation='圖書館管理員', faction='rhine_empire',
        haunts=H(('rhineburg', 'noble', 0.6), ('rhineburg', 'town', 0.6)),
        personality='文靜、知性、說話輕柔，總是躲在書後面；丈夫沉迷研究、冷落她，她把寂寞都寫進了匿名投稿的官能小說——那是帝都最受歡迎的禁書。',
        appearance='三十歲的知性人妻，黑色長髮綁成低馬尾，圓框眼鏡後是溫柔的灰色眼睛；身材修長，D 罩杯，穿著樸素的高領長裙與針織披肩，懷裡總抱著幾本書。',
        adult_appearance='書裡寫的每一個情節，她都想親身試一次；眼鏡摘下來之後，像是換了一個人。',
        background='帝國法師學院圖書館的管理員，丈夫是學院的魔導教授，結婚八年，丈夫陪研究的時間遠比陪她多。她用筆名「紫丁香」寫的官能小說在帝都暗地裡流行，沒有人知道作者就是那個安靜的圖書館員。',
        gear=G(body=('dress', 'linen')),
        relations={'npc_seraphina_weiss': '院長，「紫丁香」的頭號讀者——院長不知道作者是誰。', 'npc_margarete': '沙龍的女主人，她小說裡貴婦角色的原型。'}),

    # ---- 三位不同種族的女僕（三人都攻略完成：會員制女僕咖啡廳，晨光城）
    npc('npc_mimi', '米米', 'female', 'catfolk', '', 3, 'dawnlight', 0,
        tags=['commoner'], occupation='見習女僕', lineage='沙痕部落', faction='dawn_kingdom',
        haunts=H(('dawnlight', 'noble', 1), ('dawnlight', 'town', 0.4)),
        personality='元氣、冒失、愛撒嬌，句尾老是帶著「喵」；做事風風火火，打翻的比整理好的還多，被罵了尾巴會垂下來，摸摸頭就立刻恢復。',
        appearance='二十一歲的貓魅族女僕，橘白相間的貓耳與蓬鬆長尾，橘色短鮑伯頭，大大的綠眼睛；活潑好動，C 罩杯，穿著裙擺特別短的女僕裝與白色過膝襪，尾巴上綁著鈴鐺。',
        adult_appearance='尾巴根部非常敏感；發情期時會不自覺地用身體蹭人，自己還以為只是想撒嬌。',
        background='晨光城一戶貴族宅邸的見習女僕，從沙痕部落出來打工、寄錢回家。在宅邸裡被當成可愛的吉祥物，夢想是開一間「大家都能喝到好喝紅茶」的店。',
        gear=G(body=('maid_dress', 'linen'), head=('maid_headdress', 'linen'), leg_accessory=('thigh_highs', 'linen')),
        relations={}),
    npc('npc_eve', '伊芙', 'female', 'elf', '', 5, 'rhineburg', 0,
        tags=['commoner'], occupation='女僕長', faction='rhine_empire',
        haunts=H(('rhineburg', 'noble', 1)),
        personality='冷靜、完美主義、毒舌，用最恭敬的語氣說最刻薄的話；服侍霍恩海姆家兩代，連大小姐都怕她。對「服侍」有自己的美學，對「被服侍」則一竅不通。',
        appearance='外表二十多歲、實際一百五十歲的精靈女僕長，銀白長髮束成一絲不苟的髮髻，冰藍色眼睛，戴著單片眼鏡；修長纖細，B 罩杯，長裙女僕裝熨得沒有一絲皺褶。',
        adult_appearance='長裙底下是精靈少見的黑色吊帶襪；一百五十年來沒有人越過她的防線，一旦越過了，她會把「服侍」做得同樣完美。',
        background='霍恩海姆侯爵家的女僕長，大小姐伊莎朵拉出生前就在這個家了。她是少數敢對大小姐說「不」的人，也是唯一知道大小姐禁書櫃鑰匙藏在哪裡的人。',
        gear=G(body=('maid_dress', 'silk'), head=('maid_headdress', 'silk')),
        relations={'npc_isadora': '看著長大的大小姐。嘴上嚴厲，其實比誰都寵她。'}),
    npc('npc_ren', '漣', 'female', 'yulin', '', 3, 'tidehaven', 0,
        tags=['commoner'], occupation='女僕', lineage='夏瀾殿', faction='four_seasons',
        haunts=H(('tidehaven', 'noble', 1), ('tidehaven', 'town', 0.3)),
        personality='天然、溫吞、愛發呆，對陸地的一切都覺得新奇；家事做得慢得驚人卻非常仔細，最喜歡替人洗澡——因為「水很舒服」。',
        appearance='二十三歲的玉璘族女僕，淡藍色長髮編成兩條辮子，耳後有細鰓，海一樣的碧綠眼睛；化形上岸後雙腿修長，D 罩杯，穿著藍白色女僕裝，裙擺下偶爾露出幾片鱗。',
        adult_appearance='鱗片集中在大腿內側與腰後，沾到水就變得滑溜發亮；她不太懂陸地人的羞恥心，替人洗澡時常常自己也脫了。',
        background='潮汐港富商區一戶人家的女僕，為了「看看陸地人怎麼生活」自願上岸打工。她把主人家的浴室打理得比任何地方都好，因為那是整棟房子裡最像海的地方。',
        gear=G(body=('maid_dress', 'linen'), head=('maid_headdress', 'linen')),
        relations={}),

    # ---- 河谷鎮：偶像團體「星屑三重奏」（三人都攻略完成：偶像后宮線）
    npc('npc_stella', '史黛拉', 'female', 'human', 'bard', 5, 'rivervale', 535,
        tags=['traveler', 'good'],
        haunts=H(('rivervale', 'town', 1), ('dawnlight', 'town', 0.2), ('soriel', 'town', 0.2), ('albena', 'town', 0.1)),
        personality='元氣滿滿、正向到刺眼的偶像中心，口頭禪是「大家的笑容就是我的力量！」；台上閃閃發光，台下卻是路癡兼吃貨，其實也很想被人寵。',
        appearance='二十二歲的人類偶像，金色長髮綁成高高的單邊馬尾，別著星形髮夾，藍眼睛閃閃發亮；E 罩杯，穿著綴滿星星的華麗舞台裝、短裙與白色長靴。',
        adult_appearance='舞台裝底下的內衣也是星星圖案；後台換衣服時從不鎖門，因為「反正大家都是夥伴嘛」。',
        background='偶像團體「星屑三重奏」的隊長兼中心，三人都是吟遊詩人，一邊冒險一邊在各地開演唱會。可惜三個吟遊詩人打不過幾隻哥布林，所以她們總在河谷鎮的公會徵求「護衛兼經紀人」。',
        gear=G(body=('dress', 'silk'), feet=('boots', 'leather')),
        relations={'npc_noir': '團裡的作曲，最酷的夥伴，雖然常常被她罵。', 'npc_pom': '團裡的經紀人，錢的事都交給她。'},
        squad={'name': '星屑三重奏', 'members': ['npc_noir', 'npc_pom'], 'together': 1}),
    npc('npc_noir', '諾瓦', 'female', 'elf', 'bard', 5, 'rivervale', 535,
        tags=['traveler'],
        haunts=H(('rivervale', 'town', 1)),
        personality='冷酷、寡言、毒舌，負責作曲與魯特琴，台上從不笑，卻是三人裡粉絲最多的；其實非常怕寂寞，私下會偷偷收集粉絲的信。',
        appearance='外表二十出頭（以精靈來說剛成年）的精靈，黑色短髮挑染紫色，金色眼睛帶著冷淡；修長纖細，B 罩杯，穿黑色皮夾克、短褲與網襪，耳朵上戴滿銀環。',
        adult_appearance='舌頭上有一顆銀色舌環；冷淡的外表下，在床上是三人裡最黏人的那個。',
        background='星屑三重奏的作曲兼魯特琴手，離開銀月城是因為「森林裡的音樂太無聊」。新芽同盟的盟主希爾薇是她的頭號粉絲。',
        gear=G(leg_accessory=('fishnet', 'silk')),
        relations={'npc_stella': '吵死人的隊長。她寫的每一首歌都是為她寫的，但打死不說。', 'npc_sylvie': '頭號粉絲，信寫得比小說還長。'}),
    npc('npc_pom', '波姆', 'female', 'catfolk', 'bard', 5, 'rivervale', 535,
        tags=['traveler'], lineage='沙痕部落',
        haunts=H(('rivervale', 'town', 1)),
        personality='甜美、愛撒嬌、看起來天然呆，粉絲都叫她「波姆醬」；其實腹黑又精明，管著團裡所有的錢與合約，誰想占三人的便宜，她會笑著把對方的錢包掏空。',
        appearance='二十一歲的貓魅族偶像，粉色雙馬尾、白色貓耳與長尾，紅色眼睛；身材玲瓏、D 罩杯，穿著荷葉邊的粉色舞台裝，尾巴上繫著大緞帶。',
        adult_appearance='會在後台的鏡子前練習「最可愛的表情」——包括某些絕對不能讓粉絲看見的表情。',
        background='星屑三重奏的舞蹈擔當兼「經紀人」，沙痕部落出身，算數比誰都好。她是三人裡第一個發現「需要專屬護衛」的人——也是第一個開始打護衛主意的人。',
        gear=G(body=('blouse', 'silk'), legs=('pleated_skirt', 'silk')),
        relations={'npc_stella': '笨蛋隊長，沒有她不行。', 'npc_noir': '嘴硬的作曲，最好捉弄。'}),

]

ids = {n['id'] for n in new}
npcs = [n for n in base['npcs'] if n['id'] not in ids] + new

# 檢查
allids = {n['id'] for n in npcs}
GR = json.load(open(f'{ROOT}/data/rules/gear.json'))
adult = {n['id'] for n in npcs if n.get('adult')}
for n in npcs:
    for k in (n.get('relations') or {}):
        assert k in allids, (n['id'], k)
        if not n.get('adult'): assert k not in adult, ('一般角色不能提到成人向角色', n['id'], k)
    for slot, g in (n.get('gear') or {}).items():
        b = GR['bases'][g['base']]; m = GR['materials'][g['material']]
        assert b['kind'] == m['kind'] and b['slot'] == slot, (n['id'], slot, g, b['slot'], b['kind'])
    for k, lim in [('personality', 160), ('appearance', 240), ('adult_appearance', 240), ('background', 400), ('name', 16)]:
        assert len(n.get(k, '')) <= lim, (n['id'], k, len(n[k]))
names = [n['name'] for n in npcs]
assert len(set(names)) == len(names), [x for x in names if names.count(x) > 1]

geo = json.load(open(f'{ROOT}/data/world/geography.json'))
REG = ['central', 'north', 'south', 'forest', 'east_sea', 'west']
LOCS = [l['id'] for l in geo['locations']]
LR = {l['id']: l['region'] for l in geo['locations']}
npcs.sort(key=lambda n: (REG.index(LR[n['location']]), LOCS.index(n['location'])))
write(OUT, base, npcs)
print(len(npcs), 'npcs,', len(new), 'adult')
