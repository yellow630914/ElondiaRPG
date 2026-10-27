# 解鎖的特殊區域：六個成人向地標（條件成立前不顯示），用「場景」每三天一次
import json
P = 'data/world/landmarks.json'
d = json.load(open(P))
RELAX = {"type": "condition", "target": "pc", "condition": "relaxed", "add": True}
A = ['adult']


def sc(title, scene, desc='', tags=A, **kw):
    o = {"title": title, "desc": desc, "scene": scene, "tags": list(tags), "hours": kw.pop('hours', 2)}
    if not o['desc']: del o['desc']
    if not o['tags']: del o['tags']
    o.update(kw)
    return o


NEW = [
    {"id": "lm_wives_salon", "name": "伯爵夫人的沙龍", "emoji": "🫖", "location": "rhineburg", "at": {"area": "rhineburg/noble", "x": 4, "y": 2},
     "types": ["official"], "desc": "瑪格麗特在貴族區的沙龍。每隔幾天，三位夫人會在這裡辦一場只邀請你的下午茶會。走進去選位子。",
     "scene": "鋪著蕾絲桌巾的沙龍，紅茶與奶油點心的香氣裡，窗簾總是拉得剛好。",
     "open": {"flags": ["group_wives_done"], "hidden": True, "adult": True},
     "scenes": [
         sc("讓三位夫人享用你", "{cast}邀主角參加沙龍的下午茶。茶越喝越熱，曖昧的氣氛在三人互相催促之下越來越濃，最後三位夫人一起主動享用了主角。",
            "三位夫人邀你參加下午茶會——在彼此的催促下，她們會一起享用你。", ["adult", "non_virgin"], hours=3,
            cast=[{"npc": "npc_margarete"}, {"npc": "npc_lieselotte"}, {"npc": "npc_clara"}], affinity=3, effects=[RELAX]),
         sc("享用三位夫人", "{cast}邀主角參加沙龍的下午茶。曖昧的氣氛在三人互相催促之下越來越濃，最後由主角主導，一個接一個享用了三位夫人。",
            "三位夫人邀你參加下午茶會——在彼此的催促下，等著被你享用。", ["adult", "non_virgin"], hours=3,
            cast=[{"npc": "npc_margarete"}, {"npc": "npc_lieselotte"}, {"npc": "npc_clara"}], affinity=3, effects=[RELAX]),
     ]},
    {"id": "lm_maid_cafe", "name": "會員制女僕咖啡廳", "emoji": "☕", "location": "dawnlight", "at": {"area": "dawnlight/gate", "x": 4, "y": 2},
     "types": ["market"], "desc": "米米的紅茶店擴大成的會員制女僕咖啡廳。一般客人在前廳喝茶；店的後面有幾間給會員的小房間。",
     "scene": "前廳擺滿了蕾絲與小花，紅茶的香氣裡混著烤餅乾的甜味；穿著女僕裝的店員在桌子之間來回。",
     "open": {"flags": ["mimi_lover", "eve_lover"], "hidden": True, "adult": True},
     "scenes": [
         sc("在前廳喝茶", "主角在會員制女僕咖啡廳的前廳點了紅茶與點心，被{cast}服侍著，度過了悠閒的時光。", "一般的消費：紅茶、點心與女僕的服侍。", [],
            hours=1, money_cc=30, cooldown_days=1, own_cooldown=True, effects=[{"type": "condition", "target": "pc", "condition": "fed_light", "add": True}],
            cast=[{"npc": "npc_mimi"}, {"npc": "npc_eve"}, {"npc": "npc_ren", "flags": ["ren_land"]}], affinity=1),
         sc("和米米去小房間", "米米拉著主角走進店後面的小房間，關上門，貓尾巴纏上主角的腰，在只有兩個人的小房間裡親密地纏綿。", "冒失的貓魅族店長。",
            cast=[{"npc": "npc_mimi"}], affinity=3, effects=[RELAX]),
         sc("和伊芙去小房間", "伊芙一絲不苟地替主角帶上小房間的門，解開女僕長制服的釦子，用最端莊的禮儀侍奉主角，在只有兩個人的小房間裡親密地纏綿。", "一絲不苟的精靈女僕長。",
            cast=[{"npc": "npc_eve"}], affinity=3, effects=[RELAX]),
         sc("和漣去小房間", "漣在小房間裡放滿了一缸溫水，拉著主角一起泡進去，玉璘族的鱗片在水裡閃閃發亮，兩個人在水裡親密地纏綿。", "愛洗澡的玉璘族女僕。",
            requires={"flags": ["ren_land"]}, cast=[{"npc": "npc_ren"}], affinity=3, effects=[RELAX]),
         sc("暫時關店，和三個人一起", "米米在門口掛上「暫停營業」的牌子。{cast}三個女僕一起把主角帶進最大的小房間，輪流也一起服侍主角，親密地纏綿到天黑。",
            "三個女僕都在、都是你的戀人時：掛上暫停營業的牌子，三個人一起。", hours=3,
            requires={"flags": ["ren_land"]}, cast=[{"npc": "npc_mimi"}, {"npc": "npc_eve"}, {"npc": "npc_ren"}], affinity=3, effects=[RELAX]),
     ]},
    {"id": "lm_ebony_night", "name": "黑檀之夜", "emoji": "🖤", "location": "soriel", "at": {"area": "soriel/harbor", "x": 6, "y": 2},
     "types": ["market"], "desc": "港區酒館地下只收熟客的俱樂部，也就是所謂的媚黑俱樂部。地下室的門為你留了一把鑰匙。",
     "scene": "地下室燈光昏暗，燻香混著酒氣，一群高大黝黑的水手圍坐在長椅上。",
     "open": {"hours": "night", "flags": ["aya_club"], "hidden": True, "adult": True},
     "scenes": [
         sc("看阿雅和水手們", "主角在黑檀之夜的地下室，看著{cast}被一群高大黝黑的水手輪流享用。她一邊沉溺其中，一邊回頭看著主角；結束後裹著外套回到主角身邊，把一切都說給主角聽。",
            "在一旁看著阿雅被高大黝黑的水手們享用。", ["adult", "ntr", "non_virgin"], hours=3, cast=[{"npc": "npc_aya"}], affinity=3),
         sc("和阿雅一起侍奉水手們", "主角和{cast}一起跪在黑檀之夜那群高大黝黑的水手中間，兩個人一起侍奉他們，阿雅握著主角的手不放。",
            "和阿雅一起侍奉水手們（陰柔、中性體型的主角）。", ["adult", "ntr", "non_virgin"], hours=3, pc_body=["fem", "andro"], cast=[{"npc": "npc_aya"}], affinity=3),
     ]},
    {"id": "lm_succubus_banquet", "name": "魅魔的宴會廳", "emoji": "🥀", "location": "bloodplume", "at": {"area": "bloodplume/noble", "x": 4, "y": 2},
     "types": ["official"], "desc": "黑薔薇樓上的宴會廳。卡珊卓每隔幾天為你辦一場只有魅魔的宴會。",
     "scene": "黑薔薇樓上的宴會廳，燭光、紅酒與黑色的薔薇，空氣裡有魅魔特有的甜香。",
     "open": {"hours": "night", "flags": ["cas_lover"], "hidden": True, "adult": True},
     "scenes": [
         sc("戴著項圈的女王", "魅魔的宴會：{cast}一起服侍主角的多人交歡。戴著項圈的卡珊卓溫順乖巧，對主角與其他魅魔都畢恭畢敬，帶頭跪在主角腳邊侍奉。",
            "戴著項圈的卡珊卓乖順地帶著其他魅魔服侍你。", ["adult", "non_virgin"], hours=4, requires={"flags": ["cas_collared"]},
            cast=[{"npc": "npc_cassandra"}, {"npc": "npc_rona", "flags": ["twin_lovers"]}, {"npc": "npc_lana", "flags": ["twin_lovers"]},
                  {"npc": "npc_lucia", "flags": ["luc_lover"]}, {"npc": "npc_noel", "flags": ["noel_lover"]}],
            extras="其他不知名的魅魔", affinity=3, effects=[RELAX]),
         sc("被女王們玩弄", "魅魔的宴會：{cast}一起和主角的多人交歡。自由的卡珊卓風趣有禮，帶著其他魅魔一起強勢地玩弄主角。",
            "自由的卡珊卓和其他魅魔一起強勢地玩弄你。", ["adult", "non_virgin"], hours=4, requires={"flags": ["cas_free"]},
            cast=[{"npc": "npc_cassandra"}, {"npc": "npc_rona", "flags": ["twin_lovers"]}, {"npc": "npc_lana", "flags": ["twin_lovers"]},
                  {"npc": "npc_lucia", "flags": ["luc_lover"]}, {"npc": "npc_noel", "flags": ["noel_lover"]}],
            extras="其他不知名的魅魔", affinity=3, effects=[RELAX]),
         sc("被女王們服侍", "魅魔的宴會：{cast}一起服侍主角的多人交歡。自由的卡珊卓風趣有禮，今晚和其他魅魔一起乖順地服侍主角。",
            "自由的卡珊卓和其他魅魔一起乖順地服侍你。", ["adult", "non_virgin"], hours=4, requires={"flags": ["cas_free"]},
            cast=[{"npc": "npc_cassandra"}, {"npc": "npc_rona", "flags": ["twin_lovers"]}, {"npc": "npc_lana", "flags": ["twin_lovers"]},
                  {"npc": "npc_lucia", "flags": ["luc_lover"]}, {"npc": "npc_noel", "flags": ["noel_lover"]}],
            extras="其他不知名的魅魔", affinity=3, effects=[RELAX]),
     ]},
    {"id": "lm_idol_backstage", "name": "星屑三重奏的後台", "emoji": "🎤", "location": "rivervale", "at": {"area": "rivervale/bank", "x": 4, "y": 2},
     "types": ["market"], "desc": "河岸舞台後面的小後台。專屬護衛兼經紀人可以在這裡等三個人演出結束。",
     "scene": "後台堆著樂器盒與換下來的舞台裝，鏡子上貼滿了粉絲的信；隔著布幕聽得見台下的歡呼。",
     "open": {"flags": ["group_idols_done"], "hidden": True, "adult": True},
     "scenes": [
         sc("演出後替三人「充電」", "演唱會結束，{cast}香汗淋漓地回到後台，一進門就撲向主角。主角在第一時間同時替三個人「充電」。",
            "在後台等三個人演出結束，在她們回來的第一時間同時替她們「充電」。", hours=2,
            cast=[{"npc": "npc_stella"}, {"npc": "npc_noir"}, {"npc": "npc_pom"}], affinity=3, effects=[RELAX]),
     ]},
    {"id": "lm_honor_hole", "name": "地下酒館的榮譽洞", "emoji": "🕳️", "location": "albena", "at": {"area": "albena/market", "x": 5, "y": 2},
     "types": ["market"], "desc": "阿爾貝納酒館地下的隔間，牆上開著幾個洞，牆的兩邊誰也看不見誰。伊蓮娜常來這裡收集媒介，說品質時好時壞。",
     "scene": "昏暗的地下隔間，木板牆上開著幾個圓洞，空氣悶熱，隔壁傳來壓低的喘息。",
     "open": {"flags": ["wl_1_done"], "hidden": True, "adult": True},
     "scenes": [
         sc("當服務的一方", "主角在地下酒館的榮譽洞這一側，替牆另一邊看不見臉的人服務，一個接著一個。", "在牆的這一邊替看不見臉的人服務。", hours=2, effects=[RELAX]),
         sc("當被服務的一方", "主角把身體湊到地下酒館牆上的洞前，讓牆另一邊看不見臉的人服務，一個接著一個。", "在牆的這一邊，讓看不見臉的人服務你。", hours=2, money_cc=20, effects=[RELAX]),
     ]},
]
# 內部（特殊地圖，見 interiors23.py）與場景在裡面的格子
INTERIOR = {'lm_wives_salon': 'sm_wives_salon', 'lm_maid_cafe': 'sm_maid_cafe', 'lm_ebony_night': 'sm_ebony_night',
            'lm_succubus_banquet': 'sm_succubus_banquet', 'lm_idol_backstage': 'sm_idol_backstage', 'lm_honor_hole': 'sm_honor_hole'}
SPOTS = {
    '讓三位夫人享用你': (2, 2, '沙龍的茶桌'), '享用三位夫人': (7, 2, '窗邊的長沙發'),
    '在前廳喝茶': (3, 5, '前廳的座位'), '和米米去小房間': (1, 1, '米米的小房間'), '和伊芙去小房間': (4, 1, '伊芙的小房間'),
    '和漣去小房間': (7, 2, '漣的浴室'), '暫時關店，和三個人一起': (11, 1, '最大的小房間'),
    '看阿雅和水手們': (8, 1, '角落的卡座'), '和阿雅一起侍奉水手們': (4, 1, '水手們中間'),
    '戴著項圈的女王': (5, 2, '宴會的長桌'), '被女王們玩弄': (5, 1, '女王的高背椅'), '被女王們服侍': (2, 1, '絲綢的寢台'),
    '演出後替三人「充電」': (2, 1, '後台的休息室'),
    '當服務的一方': (3, 1, '牆的這一邊（服務）'), '當被服務的一方': (5, 1, '牆的那一邊（被服務）'),
}
for l in NEW:
    l['interior'] = INTERIOR[l['id']]
    for s_ in l['scenes']:
        x, y, n = SPOTS[s_['title']]
        s_['spot'] = {'x': x, 'y': y}
        s_['spot_name'] = n
ids = {l['id'] for l in NEW}
d['landmarks'] = [l for l in d['landmarks'] if l['id'] not in ids] + NEW
d['$comment'] = d['$comment'].replace('open：開放的條件（hours: day/night、flags、flags_none、min_reputation、official）', 'open：開放的條件（hours: day/night、flags、flags_none、hidden 條件成立前不顯示、min_reputation、official、adult 成人向的場所）')
if 'scenes：' not in d['$comment']:
    d['$comment'] = d['$comment'].replace('work：打工（和設施的工作一樣）。', 'work：打工（和設施的工作一樣）；scenes：場景（條件成立時的固定場景，預設每 3 天一次，見 docs/LANDMARKS.md 第 6 節）。')
open(P, 'w').write(json.dumps(d, ensure_ascii=False, indent=1))
print(len(d['landmarks']))
