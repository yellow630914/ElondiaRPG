# 線索事件 12 件（travel_events.json，scope: lead；docs/TRAVEL_EVENTS.md 第 5.1 節「線索事件」）。
# 線索池擲到「事件」時，照地點（近郊 0、地下城的周邊 0、淺層 1 … 底層 4）抽一件，放在地圖上一格；走到那一格時發生，主角自己擲骰。
# 登場角色（cast）擲線索池時決定：一半是這個地區主角認識的冒險者，其他是新生成的冒險者。文字裡寫 {a}、{b}（名字）與 {a他}、{b他}（照性別換成他或她），效果的 NPC 寫 $a、$b。
# offscreen：沒人去處理、過期時，主角認識的登場角色記一則近況。沒有內容標籤，每個主角都會遇到。
# 可以重跑：先拿掉上一次寫進去的再寫（接在模板的最後一件「神父的告解」後面）。
import json
import re


def drop_lines(text, pattern):
    text = re.sub(pattern, '', text)
    return re.sub(r',(\s*\n\s*[\]}])', r'\1', text)


def insert_after(text, anchor, lines):
    m = re.search(anchor, text)
    line = m.group(0)
    tail = ',' if line.endswith(',') else ''
    return text[:m.start()] + line.rstrip(',') + ',\n' + ',\n'.join(lines) + tail + text[m.end():]


def money(n):
    return {"type": "money", "amount": n}


def xp(n):
    return {"type": "xp", "amount": n}


def hp(ratio):
    return {"type": "hp", "target": "pc", "ratio": ratio}


def cond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": True}


def aff(who, n):
    return {"type": "affinity", "npc": who, "delta": n}


def join(who):
    return {"type": "companion", "npc": who, "mode": "voluntary"}


def give(name, qty=1):
    return {"type": "item", "name": name, "qty": qty}


def out(text, *effects, side=None, hours=None):
    return {"text": text, **({"effects": list(effects)} if effects else {}),
            **({"side_map": side} if side else {}), **({"time": {"hours": hours}} if hours else {})}


def opt(label, success, check=None, fail=None):
    o = {"label": label}
    if check:
        o["check"] = {"attr": check[0], "dc": check[1]}
    o["success"] = success
    if check and fail:
        o["fail"] = fail
    return o


def ev(id, title, text, options, cast=0, offscreen=None, layers=None):
    return {"id": id, "scope": "lead", "tier": "normal", "kind": "choice",
            **({"layers": layers} if layers else {}), **({"cast": cast} if cast else {}),
            "title": title, "text": text, "options": options, **({"offscreen": offscreen} if offscreen else {})}


LEAVE = '你沒有多管，繼續趕路。'

LEAD_EVENTS = [
    ev('ld_treasure_rival', '奪寶衝突',
       '你剛找到一只半埋在土裡的箱子，{a}也從另一頭趕到，一手按在箱蓋上：「這是我先看到的。」',
       [opt('提議平分', out('你們把箱子撬開，裡面的東西一人一半。{a}點點頭，說你是講道理的人。', money(30), aff('$a', 6))),
        opt('搶先一步抱走', out('你比{a}快了一步，抱著箱子退開。{a他}瞪著你，最後還是走了。', money(70), aff('$a', -12)), ('dex', 14),
            out('{a}一把推開你，你撞上石頭，箱子被{a他}搶走了。', hp(-0.12), aff('$a', -6))),
        opt('讓給{a他}', out('你擺擺手讓{a}拿走。{a他}愣了一下，塞給你一點東西當謝禮。', money(10), xp(30), aff('$a', 12)))],
       cast=1, offscreen='{a}在野外和人搶一箱寶物，最後抱著戰利品回城了。'),
    ev('ld_trapped_adventurer', '被困的冒險者',
       '一陣呼救聲從崩落的岩堆底下傳來。{a}的腿被石塊壓住，動彈不得。',
       [opt('把石頭搬開', out('你咬著牙把石塊推開，把{a}拉了出來。{a他}抓著你的手連聲道謝。', xp(40), aff('$a', 15)), ('str', 14),
            out('石塊太重，你扭傷了手臂；兩個人折騰了好久才把{a他}拖出來。', hp(-0.1), aff('$a', 10), hours=1)),
        opt('找根木頭撬開', out('你找來一根粗木頭當槓桿，沒費多少力氣就把{a}救了出來。', xp(40), aff('$a', 15)), ('int', 13),
            out('木頭斷了，你只好用手慢慢挖，花了一個多小時才把{a他}救出來。', aff('$a', 10), hours=2)),
        opt('救出來，邀{a他}同行', out('你把{a}救出來，扶{a他}站好。{a他}說這條命是你的，願意跟你走一段路。', aff('$a', 18), join('$a')), ('str', 15),
            out('你沒能搬開石頭，最後找來路過的人一起幫忙。{a}道了謝，自己一跛一跛地回城了。', hp(-0.1), aff('$a', 8)))],
       cast=1, offscreen='{a}被困在崩落的岩石底下，過了兩天才被路過的人救出來，現在還在休養。'),
    ev('ld_wounded_rival', '受傷的對手',
       '{a}靠在樹邊喘氣，身上好幾道傷口，腳邊堆著剛打倒的魔物和戰利品。看到你，{a他}握緊了武器。',
       [opt('替{a他}包紮', out('你幫{a}止住了血。{a他}放下武器，分了你一些戰利品。', money(20), aff('$a', 12)), ('fai', 13),
            out('你手忙腳亂，包得不太好，不過{a}還是領了你的情。', aff('$a', 6))),
        opt('點點頭走開', out('你沒有靠近，{a}也鬆了一口氣。')),
        opt('趁機拿走戰利品', out('你搶在{a他}站起來之前拿走了那堆戰利品。{a}在你背後罵了很久。', money(50), aff('$a', -20)), ('dex', 12),
            out('{a}撐著站起來砍了你一刀，你只好空手退開。', hp(-0.15), aff('$a', -15)))],
       cast=1, offscreen='{a}和魔物打了一場，受了傷，自己撐著回到城裡。'),
    ev('ld_duel_witness', '決鬥的見證',
       '{a}和{b}為了一筆舊帳拔劍相向，看到你走過來，兩人同時開口：「你來當見證。」',
       [opt('公正地見證', out('你看著兩人打到其中一方認輸為止，誰也沒有傷得太重。兩人都對你點了點頭。', xp(30), aff('$a', 5), aff('$b', 5)), ('int', 13),
            out('打到一半你看漏了一招，兩人都說你偏袒對方。', aff('$a', -3), aff('$b', -3))),
        opt('勸他們和解', out('你好說歹說，兩人終於收起武器，各退一步。', xp(40), aff('$a', 8), aff('$b', 8)), ('cha', 15),
            out('你的話沒人想聽，兩人還是打了一場，都嫌你多事。', aff('$a', -4), aff('$b', -4))),
        opt('站在{a}那邊', out('你替{a}說話，{b}憤憤地走了。', aff('$a', 10), aff('$b', -12)))],
       cast=2, offscreen='{a}和{b}決鬥了一場，兩人從此不再說話。'),
    ev('ld_lost_map', '遺失的地圖',
       '{a}拿著一張發黃的舊地圖到處比對，說附近埋著一處沒人進去過的遺跡，正缺一個幫手。',
       [opt('和{a他}一起去找', out('你們照著地圖找到一處半塌的入口，{a}點起火把走在前面。', aff('$a', 8), side='ruins')),
        opt('買下地圖自己去', out('{a}猶豫了一下，還是把地圖賣給了你。你照著地圖找到了入口。', money(-30), side='ruins')),
        opt('沒興趣', out('你祝{a}好運，各走各的。'))],
       cast=1, offscreen='{a}帶著一張舊地圖去找遺跡，回來時什麼也沒說。'),
    ev('ld_hidden_cave', '隱藏的洞窟',
       '藤蔓後面有一道冷風吹出來。撥開一看，是一個不在任何地圖上的洞口。',
       [opt('進去看看', out('你點起光源，彎腰鑽了進去。', side='cave')),
        opt('記下位置就走', out('你在附近做了記號，沒有進去。'))],
       layers=[0, 1, 2]),
    ev('ld_toll_peers', '收過路費的同行',
       '{a}和{b}橫在路中間，一個抱著手臂，一個拍著刀柄：「這段路是我們清出來的，過路的留點買路錢。」',
       [opt('付錢了事', out('你丟了幾枚錢過去，兩人讓開了路。', money(-20))),
        opt('嚇退他們', out('你冷冷地報上名號，兩人互看一眼，摸摸鼻子讓開了。', xp(30), aff('$a', -5), aff('$b', -5)), ('cha', 14),
            out('兩人不吃這一套，推搡之間你挨了一拳，還是得付錢。', hp(-0.1), money(-20))),
        opt('動手教訓他們', out('三兩下就把兩人打得抱頭逃走，連錢袋都掉了。', money(30), xp(40), aff('$a', -10), aff('$b', -10)), ('str', 15),
            out('兩個打一個，你吃了不少虧才脫身。', hp(-0.2), aff('$a', -8), aff('$b', -8)))],
       cast=2, offscreen='{a}和{b}在路上向人收過路費，被公會警告了一次。'),
    ev('ld_split_loot', '分贓',
       '{a}和{b}剛清掉一窩魔物，正為了怎麼分戰利品吵得面紅耳赤。他們要你來評評理。',
       [opt('公平地分', out('你照誰出力多少分了戰利品，兩人都沒話說，還分了你一份辛苦錢。', money(15), aff('$a', 5), aff('$b', 5)), ('int', 13),
            out('你算錯了一筆，兩人都覺得自己吃虧。', aff('$a', -3), aff('$b', -3))),
        opt('幫{a}說話', out('你站在{a}那邊，{b}罵罵咧咧地拿了小份走了。', aff('$a', 8), aff('$b', -10))),
        opt('幫{b}說話', out('你站在{b}那邊，{a}氣得把戰利品一摔就走。', aff('$a', -10), aff('$b', 8)))],
       cast=2, offscreen='{a}和{b}為了分贓吵翻了，各走各的路。'),
    ev('ld_lost_rookie', '走失的新手',
       '{a}抱著一張畫錯的路線圖，在原地繞了大半天，看到你就像看到救星。',
       [opt('帶{a他}走回去', out('你陪{a}走回大路，一路上教了{a他}不少野外的門道。', xp(30), aff('$a', 10), hours=2)),
        opt('指個方向', out('你替{a}指了回城的方向。{a他}道了謝，一溜煙跑了。', aff('$a', 4))),
        opt('不理{a他}', out(LEAVE))],
       cast=1, offscreen='{a}在野外迷了路，餓了三天才走回城裡。', layers=[0, 1, 2]),
    ev('ld_sealed_door', '封住的石門',
       '岩壁上嵌著一道刻滿符文的石門，縫隙裡透出微光。門旁的機關像是要按照某種順序轉動。',
       [opt('解開機關', out('符文一個個亮起，石門緩緩打開，後面是一條沒人走過的通道。', side='ruins'), ('int', 14),
            out('你轉錯了一格，機關噴出一陣灼熱的氣體。', hp(-0.12))),
        opt('硬把門撬開', out('你用盡全身的力氣，把石門撬開了一道能鑽過去的縫。', side='ruins'), ('str', 16),
            out('門紋風不動，你倒是扭傷了腰。', hp(-0.1))),
        opt('不碰它', out('你決定不碰來路不明的機關。'))],
       layers=[1, 2, 3, 4]),
    ev('ld_campfire_peer', '營火邊的同行',
       '{a}在避風處生了一堆火，烤著剛獵到的獵物，朝你揮手：「一起坐吧，一個人吃也無聊。」',
       [opt('坐下來聊聊', out('你們聊了各自的冒險，{a}把最好的那塊肉分給了你。', cond('cheered'), aff('$a', 8), hours=1)),
        opt('交換情報', out('你們交換了這一帶的消息，{a}說的幾件事對你很有用。', xp(30), aff('$a', 5)), ('int', 12),
            out('聊了半天，誰都沒說出什麼有用的事。', aff('$a', 3))),
        opt('婉拒', out('你謝過{a}，繼續趕路。'))],
       cast=1, offscreen='{a}在野外紮營過了幾天，獵到了不少東西。'),
    ev('ld_chased_adventurer', '被追趕的冒險者',
       '{a}狼狽地從樹叢裡衝出來，身後傳來魔物的嘶吼：「幫、幫我一把！」',
       [opt('擋在{a他}前面', out('你迎上去擋住追兵，魔物吃了幾下虧，掉頭逃了。{a}喘著氣向你道謝。', xp(50), aff('$a', 15)), ('str', 15),
            out('魔物比你想的難纏，你們兩個都掛了彩才把牠們趕走。', hp(-0.2), aff('$a', 10))),
        opt('拉著{a他}躲起來', out('你把{a}拉進岩縫裡，魔物找了一陣就走了。', xp(30), aff('$a', 12)), ('dex', 14),
            out('躲到一半被發現了，你們邊打邊逃，好不容易才甩掉。', hp(-0.15), aff('$a', 8))),
        opt('自己先閃開', out('你閃到一邊。{a}自己逃走了，經過你身邊時看了你一眼。', aff('$a', -10)))],
       cast=1, offscreen='{a}被一群魔物追著跑，丟了半個行囊才逃回城。'),
]


def main():
    p = 'data/rules/travel_events.json'
    t = open(p).read()
    for e in LEAD_EVENTS:
        t = drop_lines(t, r'\n    \{"id": "' + e['id'] + r'".*')
    t = insert_after(t, r'\n    \{"id": "rd_priest_confession".*', ['    ' + json.dumps(e, ensure_ascii=False) for e in LEAD_EVENTS])
    d = json.loads(t)

    # 檢查：臨時地圖、非戰鬥狀態存在；登場角色的人數對得上文字與效果
    conditions = set(json.load(open('data/rules/companions.json'))['conditions'])
    items = {i['name'] for i in json.load(open('data/rules/items.json'))['items']}
    for e in LEAD_EVENTS:
        assert e['id'].startswith('ld_'), e['id']
        for o in e['options']:
            assert o.get('check', {}).get('attr', 'str') in ('str', 'dex', 'int', 'fai', 'cha'), o
        assert 2 <= len(e['options']) <= 3, e['id']
        body = json.dumps([e['title'], e['text'], e['options'], e.get('offscreen')], ensure_ascii=False)
        cast = e.get('cast', 0)
        assert ('{a}' in body or '"$a"' in body) == (cast >= 1), e['id']
        assert ('{b}' in body or '"$b"' in body) == (cast >= 2), e['id']
        assert ('offscreen' in e) == (cast >= 1), e['id']
        for o in e['options']:
            for res in (o.get('success'), o.get('fail')):
                if not res:
                    continue
                if 'side_map' in res:
                    assert res['side_map'] in d['side_maps'], res
                for x in res.get('effects', []):
                    assert x['type'] in ('item', 'money', 'xp', 'hp', 'condition', 'affinity', 'companion'), x
                    if x['type'] == 'condition':
                        assert x['condition'] in conditions, x
                    if x['type'] == 'item':
                        assert x['name'] in items, x
    assert len({x['id'] for x in d['templates']}) == len(d['templates'])
    open(p, 'w').write(t)
    print('lead events', len(LEAD_EVENTS))


if __name__ == '__main__':
    main()
