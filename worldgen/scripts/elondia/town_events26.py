"""城鎮的成人向事件（worldgen/design/adult-events.md 第 2 節的「普通事件」）：寫進 data/rules/travel_events.json（scope: town）。
可以重跑：先拿掉這幾個 id 的模板再加回去。
- 都是成人向、只給女性形象與中性的主角，對象是男性（male_partner）；被迫的標「主角非自願」
- 每個事件三個回應：脫身的檢定（失敗就進入親密場景）、另一種應付方式、屈服（一定進入親密場景）
- 城鎮事件的 DC 不隨地點變化，寫的就是實際的 DC
"""
import json

R = ''
BODY = ['fem', 'andro']
UNW = ['adult', 'pc_unwilling', 'male_partner']
WILL = ['adult', 'male_partner']


def cond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": True}


def money(n):
    return {"type": "money", "amount": n}


def xp(n):
    return {"type": "xp", "amount": n}


def rep(d):
    return {"type": "reputation", "faction": "local", "delta": d}


def out(text, *effects):
    o = {"text": text}
    if effects: o["effects"] = list(effects)
    return o


def opt(label, success, fail=None, check=None, scene=None):
    o = {"label": label}
    if check: o["check"] = {"attr": check[0], "dc": check[1]}
    o["success"] = success
    if fail: o["fail"] = fail
    if scene: o["adult_scene"] = scene
    return o


def ev(i, title, cells, category, text, scene, options, tags=UNW):
    return {"id": i, "scope": "town", "tier": "normal", "kind": "choice", "cells": cells, "category": category,
            "tags": tags, "pc_body": BODY, "title": title, "text": text, "scene": scene, "options": options}


E = [
    ev('town_frisk', '搜身盤查', ['gate', 'guild'], 'trouble',
       '兩個衛兵把你攔下來，說最近有人走私違禁品，要「仔細」搜一搜。帶頭的那個舔了舔嘴唇，指了指門邊那間沒有窗的小屋。',
       '兩個衛兵在沒有窗的盤查小屋裡把主角的衣服扒光，說是搜身，手指卻在胸口和腿間來回摸，最後輪流把主角按在桌上幹了一遍',
       [opt('亮出身分，要他們叫隊長來', out('你把冒險者證拍在他臉上，說要找他們隊長談。兩人互看一眼，罵了一聲，揮手放你過去。', rep(1)),
            out('「隊長？隊長今天休假。」他們把你拖進小屋，門閂一落，搜身就變成了別的事。完事之後，他們把衣服丟還給你，說你「身上很乾淨」。',
                cond('disheveled'), cond('sensitive')),
            check=('cha', 14), scene='fail'),
        opt('塞錢給他們，請他們高抬貴手', out('你把一袋錢塞進他手裡。他掂了掂，嘿嘿笑著讓開了路：「下次記得多帶一點。」', money(-60))),
        opt('跟他們進小屋', out('你自己走進小屋，自己把衣服脫了。兩個衛兵搜得很徹底，從頭到腳、從裡到外，搜了快一個鐘頭。出來的時候腿還在抖，他們還在你屁股上拍了一下：「辛苦了，下次見。」',
                                cond('disheveled'), cond('afterglow')), scene='always')]),
    ev('town_drugged_drink', '被下藥的酒', ['tavern', 'inn'], 'trouble',
       '一個笑得很殷勤的男人請你喝了一杯。酒有點甜，才喝了半杯，身體就開始發燙，腿也軟了。他扶住你的腰，說樓上有房間可以休息。',
       '主角被下了春藥，渾身發燙、站都站不穩，被那個男人半拖半抱地帶上樓；他把主角剝光丟上床，趁主角神智不清的時候一次又一次地幹，主角的身體卻主動迎了上去',
       [opt('咬破嘴唇，硬撐著走出去', out('你咬著舌尖保持清醒，推開他的手，扶著牆走出酒館。冷風一吹，腦袋才清楚了一點。', cond('aroused')),
            out('你才站起來就腿一軟，倒在他懷裡。接下來的事你只記得片段：樓梯、床、他喘氣的聲音，還有自己叫得有多大聲。醒來時天已經亮了，錢包也空了一半。',
                cond('aroused'), cond('dazed'), money(-40)),
            check=('fai', 15), scene='fail'),
        opt('把剩下的酒潑在他臉上', out('你把酒潑在他臉上，大聲喊他下藥。整間酒館的人都轉過頭來，他罵了一聲就溜了。藥效還是讓你難受了一整晚。', cond('aroused'), rep(1)),
            out('酒潑歪了。他笑著抓住你的手腕，跟旁邊的人說「我馬子喝多了」，就這樣把你帶上了樓。', cond('aroused'), cond('dazed')),
            check=('dex', 13), scene='fail'),
        opt('讓他扶你上樓', out('你靠在他身上，讓他把你扶上樓。藥效讓你什麼都不想管，只想被幹。他滿足了你一整晚，天亮前就走了，桌上留了幾枚銅幣，像是在付錢。',
                                cond('aroused'), cond('dazed'), money(10)), scene='always')]),
    ev('town_gamble_price', '賭局的代價', ['tavern'], 'opportunity',
       '角落那桌的骰子局缺一個人。莊家看你的眼神從頭掃到腳：「沒錢也能玩。輸了，今晚陪這桌的兄弟們；贏了，桌上的錢全是妳的。」',
       '主角賭輸了身體，被賭桌上的男人們拖進酒館後面的房間，脫光了按在賭桌上，一個接一個輪流上，輪完一圈還要再擲骰子決定誰先來第二輪',
       [opt('擲骰子', out('骰子停下來的時候，整桌的人都安靜了。你把桌上的錢全掃進袋子裡，在一片罵聲裡走出酒館。', money(150), xp(10)),
            out('你輸了。莊家把骰盅一扣，笑著說「願賭服輸」。那一晚，你在後面的房間裡把這桌的每一個人都陪了一遍，陪到天亮。',
                cond('drained'), cond('disheveled')),
            check=('dex', 15), scene='fail'),
        opt('出老千', out('你換骰子的手法乾淨俐落，連贏三把，捲了錢就走。', money(120)),
            out('你換骰子的時候被抓個正著。出老千的懲罰比輸錢還重：他們整晚都不讓你穿上衣服。',
                cond('drained'), cond('disheveled'), cond('sensitive')),
            check=('dex', 17), scene='fail'),
        opt('「不用賭了，直接來吧」', out('你直接坐上賭桌，把裙子撩起來。這桌的男人們都笑了。你陪他們玩了一整晚別的遊戲，天亮時他們把桌上的賭金塞進你的衣服裡，當作小費。',
                                     cond('drained'), money(60)), scene='always')],
       tags=WILL),
]

IDS = {e['id'] for e in E}

if __name__ == '__main__':
    assert len(IDS) == len(E)
    for e in E:
        assert len(e['title']) <= 20 and len(e['text']) <= 400 and len(e['scene']) <= 200, e['id']
        for o in e['options']: assert len(o['label']) <= 30, o['label']
    P = R + 'data/rules/travel_events.json'
    s = open(P).read()
    lines = [l for l in s.split('\n') if not any(l.startswith(f'    {{"id": "{i}"') for i in IDS)]
    s = '\n'.join(lines)
    # 模板陣列的結尾：最後一個模板後面接上這幾個事件
    end = s.index('\n  ],\n  "town": {')
    head = s[:end].rstrip().rstrip(',')
    new = ',\n'.join('    ' + json.dumps(e, ensure_ascii=False) for e in E)
    s = head + ',\n' + new + s[end:]
    data = json.loads(s)
    assert sum(1 for t in data['templates'] if t['id'] in IDS) == len(E)
    open(P, 'w').write(s)
    print('town events', len(E))
