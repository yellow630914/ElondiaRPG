# 成人向的採集事件 12 件（travel_events.json，scope: dungeon，觸發點 gather；docs/ADULT_EVENTS.md 第 1 節）。
# 原本一般地下城採集時能抽的成人向事件只有「淫泉」「遺落的春宮書」兩件，其他都限定特定地下城；這裡補上不限地下城的 8 件與 4 件地區限定的。
# 格式和 lust_s9.py 的地下城事件一樣：成人向、只給陰柔與中性體型、三個選項（一定有一個檢定可以躲開、一個會進入親密場景）、寫了 scene。
# 可以重跑：先拿掉上一次寫進去的再寫（接在「遺落的春宮書」後面）。
import json
import re

UNWILLING = ['adult', 'pc_unwilling']
WILLING = ['adult']
WILLING_MEN = ['adult', 'male_partner']
BODY = ['fem', 'andro']


def drop_lines(text, pattern):
    text = re.sub(pattern, '', text)
    return re.sub(r',(\s*\n\s*[\]}])', r'\1', text)


def insert_after(text, anchor, lines):
    m = re.search(anchor, text)
    line = m.group(0)
    tail = ',' if line.endswith(',') else ''
    return text[:m.start()] + line.rstrip(',') + ',\n' + ',\n'.join(lines) + tail + text[m.end():]


def cond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": True}


def lewd(stat, d):
    return {"type": "lewd", "stat": stat, "delta": d}


def give(name, qty=1):
    return {"type": "item", "name": name, "qty": qty}


def money(n):
    return {"type": "money", "amount": n}


def xp(n):
    return {"type": "xp", "amount": n}


def heal(ratio):
    return {"type": "hp", "target": "pc", "ratio": ratio}


def out(text, *effects):
    return {"text": text, **({"effects": list(effects)} if effects else {})}


def opt(label, success, check=None, fail=None, scene=None):
    o = {"label": label}
    if check:
        o["check"] = {"attr": check[0], "dc": check[1]}
    o["success"] = success
    if check and fail:
        o["fail"] = fail
    if scene:
        o["adult_scene"] = scene
    return o


def ev(id, title, text, options, scene, layers=None, dungeons=None, tags=UNWILLING, cooldown_days=None):
    return {"id": id, "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": ['gather'],
            **({"layers": layers} if layers else {}), **({"dungeons": dungeons} if dungeons else {}),
            **({"cooldown_days": cooldown_days} if cooldown_days else {}), "tags": tags, "pc_body": BODY,
            "title": title, "text": text, "scene": scene, "options": options}


EAST = ['tidefall_cave', 'skull_isle']
NORTH = ['redemption_pit', 'echo_rift', 'giants_spine']
SOUTH = ['ember_rift', 'bloodrock_cave', 'hell_greenhouse']
CRYPT = ['whisper_crypt', 'mist_abbey']

EVENTS = [
    # ---- 不限地下城 ----
    ev('dg_g_aphro_flower', '媚香花叢',
       '一叢粉紫色的花開得正盛，甜得發膩的香氣一陣一陣飄過來。光是站在旁邊，你的臉就開始發燙。',
       [
           opt('屏住氣快採', out('你憋著一口氣摘下幾朵花，退開之後才敢呼吸。花瓣擠一擠就是一小瓶精油。', give('媚香精油', 1)),
               ('dex', 13), out('你憋不住吸了一口，香氣一路鑽進身體裡，腿一軟就跪在花叢邊。', cond('aroused'), lewd('sensitivity', 1)), scene='fail'),
           opt('用布包著口鼻採', out('你蒙住口鼻慢慢採，收了滿滿一把。', give('媚香精油', 2)),
               ('int', 12), out('布擋不住那股甜味。你採完的時候，整個人都暈乎乎的。', give('媚香精油', 1), cond('aroused'))),
           opt('湊近深深吸一口', out('你把臉埋進花叢裡深深一吸。等你回過神來，已經在花叢裡躺了好一陣子。',
                                  give('媚香精油', 1), cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], '媚香花叢的香氣讓主角渾身發燙，主角躺在花叢裡，一邊喘息一邊忍不住撫摸自己', tags=UNWILLING),
    ev('dg_g_slime_bed', '史萊姆的溫床',
       '一窪溫熱的半透明凝膠，表面輕輕起伏，像在呼吸。史萊姆不在家——至少看起來不在。',
       [
           opt('舀一些帶走', out('你舀了好幾罐，凝膠在罐子裡還溫溫的。', give('史萊姆凝膠', 3)),
               ('dex', 13), out('凝膠突然順著勺子爬上你的手臂，一路鑽進衣服裡，在身上到處溜。', cond('disheveled'), cond('sensitive')), scene='fail'),
           opt('用火逼它散開再舀', out('凝膠怕火，縮成一團。你從容地舀了一罐。', give('史萊姆凝膠', 2))),
           opt('把手伸進去試試溫度', out('凝膠溫柔地裹住了你的手，然後是手臂、肩膀……你乾脆整個人躺了進去。',
                                    give('史萊姆凝膠', 1), cond('afterglow'), lewd('sensitivity', 1)), scene='always'),
       ], '溫熱的史萊姆凝膠爬滿主角全身，鑽進衣服裡每一處，主角在凝膠裡無力地扭動', layers=[1, 2, 3]),
    ev('dg_g_crawling_root', '會動的根',
       '你挖藥草時，土裡的根突然動了一下。細細的根鬚纏上你的手指，帶著黏滑的汁液。',
       [
           opt('一把扯斷', out('你用力一扯，根斷了，汁液濺了一地。斷掉的根倒是個少見的藥材。', give('嗜血藤汁', 1)),
               ('str', 14), out('根越扯越多，從土裡冒出來纏住了你的腳踝和腰。', cond('disheveled'), cond('aroused')), scene='fail'),
           opt('用刀慢慢割開', out('你冷靜地一根一根割斷，收下了沾著汁液的根。', give('嗜血藤汁', 2)),
               ('dex', 13), out('刀還沒割完，根鬚已經鑽進了袖口。你費了好一番功夫才脫身。', cond('sensitive'))),
           opt('不動，看它想做什麼', out('根鬚順著你的身體慢慢往上爬，好奇地探索每一處。等它們縮回土裡，你已經站不起來了。',
                                     give('嗜血藤汁', 1), cond('drained'), lewd('lewdness', 1)), scene='always'),
       ], '土裡冒出的根鬚纏住主角的手腳，帶著黏滑汁液的細根順著身體爬進衣服裡探索', layers=[2, 3, 4]),
    ev('dg_g_honey_hive', '粉紅色的蜂巢',
       '岩縫裡掛著一個粉紅色的蜂巢，蜂蜜沿著巢壁滴下來，甜香裡帶著一股讓人心跳加快的味道。',
       [
           opt('煙燻之後取蜜', out('你用煙把蜂趕走，取下一大塊蜜。這種蜜在城裡能賣個好價錢。', give('媚藥瓶', 1)),
               ('int', 13), out('蜂沒被燻走，在你身上螫了好幾下。被螫的地方又紅又熱，碰一下都受不了。', cond('sensitive'), cond('aroused'))),
           opt('趁蜂不在偷偷取', out('你趁著蜂群出巢，挖了一小塊。', give('媚藥瓶', 1)),
               ('dex', 14), out('蜂群回來了，你逃得狼狽，衣服被刮破了好幾處。', cond('disheveled'))),
           opt('舔一口嚐嚐', out('甜得不像話。下一刻，一股熱從舌尖燒到全身，你只能靠著岩壁慢慢滑坐下去。',
                              cond('aroused'), cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], '主角嚐了粉紅色的媚蜜，全身發熱、無法自制，靠著岩壁獨自喘息', layers=[0, 1, 2], tags=WILLING),
    ev('dg_g_desire_pool', '映照慾望的水潭',
       '一窪平靜得像鏡子的水潭。你彎腰取水時，倒影對你笑了——那不是你此刻的表情。',
       [
           opt('裝一瓶水就走', out('你沒有理會倒影，裝了一瓶水。這水泛著淡淡的粉紅色。', give('媚藥瓶', 1)),
               ('fai', 14), out('倒影伸出手，把你拉近水面。你看見了自己最不想承認的慾望，久久回不過神。', cond('dazed'), lewd('lewdness', 1))),
           opt('問倒影想要什麼', out('倒影說了一個詞，你臉紅了，卻也記住了。', xp(20), lewd('lewdness', 1)),
               ('cha', 13), out('倒影只是笑，一直笑。你移不開視線。', cond('dazed'))),
           opt('碰觸倒影', out('你的指尖碰到水面，倒影握住了你的手——然後是你的全身。你沉進了一場只屬於你的夢。',
                            cond('afterglow'), lewd('lewdness', 2)), scene='always'),
       ], '水潭裡的倒影把主角拉進水裡，化成主角最深的慾望，在水中溫柔地纏繞主角', layers=[2, 3, 4], tags=WILLING),
    ev('dg_g_moss_bed', '柔軟的苔床',
       '這片苔蘚又厚又軟，踩上去像踩在羽毛被上，還帶著淡淡的花香。',
       [
           opt('刮一些帶走', out('你刮下幾大片苔蘚，柔軟得能做成枕頭。', give('熒光苔蘚', 3)),
               ('dex', 12), out('你一彎腰，苔蘚就像活了一樣把你往下拉，你在上面滾了好幾圈才爬起來，渾身酥軟。', cond('sensitive'))),
           opt('坐下來歇一會兒', out('你坐了一會兒，疲勞消了不少。', heal(0.15))),
           opt('躺下來', out('苔蘚溫柔地托住你，細細的絨毛在皮膚上輕輕搔著。你不知不覺閉上眼睛，任它撫遍全身。',
                          heal(0.2), cond('afterglow'), lewd('sensitivity', 1)), scene='always'),
       ], '主角躺在溫軟的苔床上，苔蘚的絨毛像無數隻手指一樣輕輕撫遍主角全身', layers=[1, 2, 3], tags=WILLING),
    ev('dg_g_lust_mushroom', '發情菇',
       '一簇粉紅色的小蘑菇，菌傘上沾著亮晶晶的黏液。冒險者之間流傳著它的外號——「發情菇」。',
       [
           opt('小心地採下來', out('你戴著手套採了一把，菇柄斷口冒出甜膩的香氣。煉金術士會出好價錢。', give('夜光蘑菇', 2)),
               ('dex', 13), out('孢子噗地一聲噴了你一臉。你的臉頰、脖子、胸口一路燒了起來。', cond('aroused'), lewd('sensitivity', 1)), scene='fail'),
           opt('用火燒掉孢子再採', out('你先把孢子燒掉，安全地收了幾朵。', give('夜光蘑菇', 1), xp(10))),
           opt('吃一朵試試', out('才一口，身體就熱得受不了。你找了個角落躲起來，好久都沒辦法出來見人。',
                              cond('aroused'), cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], '主角吃下發情菇，全身燥熱，躲在地下城的角落裡忍不住撫慰自己', layers=[1, 2, 3, 4], tags=UNWILLING),
    ev('dg_g_peephole', '岩壁的窺孔',
       '你採集時發現岩壁上有個小孔，另一邊傳來壓低的喘息——一對冒險者正趁著休息親熱，完全沒發現有人。',
       [
           opt('裝作沒看見，繼續採', out('你移開視線，專心採完這一片。只是耳朵有點紅。', give('藥草', 2)),
               ('fai', 13), out('你移不開眼睛，一直看到他們結束。採集的事早就忘了。', cond('aroused'), lewd('lewdness', 1))),
           opt('敲敲岩壁提醒他們', out('那邊一陣慌亂的窸窣聲，然後是尷尬的道謝。他們離開前從孔裡塞過來幾枚錢幣：「別說出去。」', money(40))),
           opt('從另一邊繞過去加入', out('他們愣了一下，然後對你招手。那一段休息時間，三個人都沒有休息。',
                                     cond('afterglow'), lewd('lewdness', 2)), scene='always'),
       ], '主角繞到岩壁另一邊，加入正在親熱的一對冒險者，三個人在地下城的休息處糾纏在一起', layers=[1, 2, 3, 4], tags=WILLING_MEN),
    # ---- 地區限定 ----
    ev('dg_g_clinging_kelp', '纏人的海藻',
       '退潮的礁石上長滿了深綠色的海藻，你伸手去撈底下的蟹螯，海藻突然捲住了你的手腕。',
       [
           opt('用力抽出手', out('你抽出手，順便撈出了兩隻大蟹螯。', give('岸礁蟹螯', 2)),
               ('str', 13), out('海藻越纏越緊，把你拖進了淺灘。冰涼滑膩的葉片從四面八方貼了上來。', cond('disheveled'), cond('sensitive')), scene='fail'),
           opt('割斷海藻', out('你割斷海藻，帶走了一隻蟹螯。', give('岸礁蟹螯', 1)),
               ('dex', 12), out('刀被海藻捲走了。你掙扎了半天才脫身，渾身濕透。', cond('drained'))),
           opt('順著海藻躺進淺灘', out('海水很溫，海藻輕輕搖擺，一下一下撫過你的身體。直到漲潮你才捨得起來。',
                                    give('岸礁蟹螯', 1), cond('afterglow'), lewd('sensitivity', 1)), scene='always'),
       ], '退潮的淺灘上，滑膩的海藻纏住主角的手腳，隨著海浪一下一下撫過主角全身', dungeons=EAST),
    ev('dg_g_frost_bloom', '冰下的暖花',
       '冰縫深處開著一朵紅色的花，周圍的冰都融成了溫水。你一靠近，一股暖意就包住了你凍僵的身體。',
       [
           opt('摘下花瓣', out('花瓣在你手心裡還是暖的。這是做媚香的好材料。', give('媚香精油', 1)),
               ('dex', 14), out('你的手一碰到花，那股暖意就順著手臂流遍全身，在冰窟裡熱得冒汗。', cond('aroused'))),
           opt('烤暖身子就走', out('你在花旁邊暖了暖手腳，身體舒服多了。', heal(0.15), cond('relaxed'))),
           opt('脫下厚衣服泡進溫水', out('溫水和花香讓你全身放鬆，那股暖意卻越來越往深處鑽。你在冰窟裡度過了一段不想讓人知道的時光。',
                                      cond('afterglow'), lewd('lewdness', 1)), scene='always'),
       ], '冰窟深處的溫泉裡，紅色暖花的香氣讓主角卸下厚重的衣物，在溫水裡被那股暖意填滿', dungeons=NORTH, tags=WILLING),
    ev('dg_g_ember_vine', '熔岩邊的藤',
       '熔岩河邊長著一種紅色的藤，藤上結著半透明的果實，裡面的汁液像岩漿一樣發光。',
       [
           opt('採下果實', out('你戴著皮手套採了幾顆，果實燙手，汁液卻是上好的媚藥原料。', give('媚液結晶', 1)),
               ('dex', 14), out('果實在你手裡爆開，滾燙的汁液濺了你一身，燙過的地方變得異常敏感。', cond('sensitive'), cond('aroused')), scene='fail'),
           opt('砍下一截藤', out('你砍下一截藤，切口流出的汁液可以拿去賣。', give('嗜血藤汁', 2)),
               ('str', 12), out('藤在你砍下去的那一刻彈了回來，抽在你身上留下一道紅痕。', cond('sensitive'))),
           opt('把汁液抹在身上', out('汁液是溫的，抹過的地方像被火輕輕舔過。你在熔岩的紅光裡慢慢蜷起身體。',
                                  give('媚液結晶', 1), cond('afterglow'), lewd('sensitivity', 2)), scene='always'),
       ], '主角把熔岩藤果的發光汁液抹在身上，被一陣陣灼熱的快感淹沒，在熔岩河邊蜷起身體', dungeons=SOUTH),
    ev('dg_g_grave_flower', '墓上的白花',
       '墓碑旁開著一朵慘白的花，花蕊裡滲出冰涼的蜜。你一摘下它，就覺得有雙冰冷的手搭上了你的肩膀。',
       [
           opt('收下花，頭也不回地走', out('你緊握著花快步離開，冰冷的感覺慢慢消失了。花蕊還能賣錢。', give('噬魂花蕊', 1)),
               ('fai', 14), out('那雙手沒有鬆開，一路滑進了你的衣服裡。冰冷的觸感讓你渾身發抖，卻沒辦法推開。', cond('shaken'), cond('sensitive')), scene='fail'),
           opt('把花放回墓上', out('你把花放回去，那雙手輕輕拍了拍你，然後消失了。', cond('blessed'))),
           opt('回頭看看是誰', out('是個溫柔的亡魂。他沒有說話，只是把你輕輕抱進了冰涼的懷裡。',
                                give('噬魂花蕊', 1), cond('drained'), cond('afterglow')), scene='always'),
       ], '墓地裡溫柔的亡魂從背後抱住主角，冰冷的手指撫過主角全身，主角在寒意與快感中發抖', dungeons=CRYPT, tags=['adult', 'pc_unwilling', 'male_partner']),
]


def main():
    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in EVENTS:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "dg_erotic_book".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in EVENTS])
    d = json.loads(t)
    items = {i['name'] for i in json.load(open('data/rules/items.json'))['items']}
    conditions = set(json.load(open('data/rules/companions.json'))['conditions'])
    locs = {l['id'] for l in json.load(open('data/world/geography.json'))['locations']}
    for e in EVENTS:
        assert e['id'].startswith('dg_g_'), e['id']
        assert len(e['options']) == 3, e['id']
        assert any(o.get('check') and o.get('fail') for o in e['options']), e['id']
        assert any(o.get('adult_scene') for o in e['options']), e['id']
        # 失敗時進入親密場景的要標主角非自願
        if any(o.get('adult_scene') == 'fail' for o in e['options']):
            assert 'pc_unwilling' in e['tags'], e['id']
        for loc in e.get('dungeons', []):
            assert loc in locs, loc
        for o in e['options']:
            for res in (o.get('success'), o.get('fail')):
                for x in (res or {}).get('effects', []):
                    if x['type'] == 'item':
                        assert x['name'] in items, x
                    if x['type'] == 'condition':
                        assert x['condition'] in conditions, x
    assert len(EVENTS) == 12
    assert len({x['id'] for x in d['templates']}) == len(d['templates'])
    open(p, 'w').write(t)
    gather = [x for x in d['templates'] if x.get('scope') == 'dungeon' and 'adult' in x.get('tags', []) and 'gather' in x.get('triggers', [])]
    print('adult gather events', len(EVENTS), 'adult gather total', len(gather))


if __name__ == '__main__':
    main()
