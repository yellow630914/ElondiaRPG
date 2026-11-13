# 降低慾望指標的途徑（docs/LEWD_STATS.md 第 4 節）：
# 1. 敏感每天自然回落：lewd.json 的 daily.sensitivity_idle_days（幾天沒有親密場景、也沒在戰鬥中高潮）；每次幾點是存檔規則 sensitivityDecay。
# 2. 禁慾派進階「清心寡慾」：敏感的增加也減半（perks.json 的 pure_heart）。
# 3. 神殿的淨身：lewd.json 的 purify（付錢、花時間，把一項指標降幾點）。
# 4. 冥想道具：神殿賣的香與經卷（items.json，use.lewd），用了降一項指標。
# 可以重跑：先拿掉上一次寫進去的再寫。
import json
import re

PURIFY = {
    "$comment": "神殿的淨身（docs/LEWD_STATS.md 第 4.1 節）：在神殿付錢、花時間把一位隊員的一項慾望指標（stats；曝露名聲是這一帶的）降 1～max_points 點。每點 per_point_cc；降到預設值（defaults）以下的部分每點 × below_default_mult。每人每天一次，花 hours 小時。",
    "stats": ["lewdness", "sensitivity", "endurance", "submission", "exposure"],
    "per_point_cc": 40,
    "below_default_mult": 2,
    "max_points": 5,
    "hours": 2,
}

# 冥想道具：神殿賣，用了花一個小時，降一項指標（曝露名聲是這一帶的）
ITEMS = [
    {"name": "清心香", "category": "consumable", "price_cc": 150, "tags": ["temple"], "adult": True, "use": {"lewd": {"sensitivity": -2}},
     "desc": "神殿調的安神線香，點著靜坐一個時辰，身體慢慢不再那麼容易起反應：敏感 −2。"},
    {"name": "淨念香", "category": "consumable", "price_cc": 150, "tags": ["temple"], "adult": True, "use": {"lewd": {"lewdness": -2}},
     "desc": "混了乳香與苦艾的線香，聞著聞著，腦子裡那些念頭就淡了：淫亂 −2。"},
    {"name": "自持經", "category": "consumable", "price_cc": 180, "tags": ["temple"], "adult": True, "use": {"lewd": {"submission": -2}},
     "desc": "一卷講自持與自主的短經，誦讀一遍之後就燒掉供奉：順從 −2。"},
    {"name": "隱名符", "category": "consumable", "price_cc": 120, "tags": ["temple"], "adult": True, "use": {"lewd": {"exposure": -5}},
     "desc": "向神官求來的符紙，在這一帶燒了，關於你的那些傳聞就沒那麼多人提起：這一帶的曝露名聲 −5。"},
]


def write_lewd():
    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = re.sub(r'\n    "sensitivity_idle_days": \d+,', '', t)
    t = t.replace('\n    "idle_days": 7,', '\n    "idle_days": 7,\n    "sensitivity_idle_days": 7,', 1)
    t = re.sub(r'\n  "purify": \{.*\},', '', t)
    t = t.replace('\n  "fusion": {', '\n  "purify": ' + json.dumps(PURIFY, ensure_ascii=False) + ',\n  "fusion": {', 1)
    json.loads(t)
    open(p, 'w').write(t)


def write_perk():
    p = 'data/rules/perks.json'
    t = open(p).read()
    t = t.replace('"desc": "禁慾派進階。淫亂的增加減半；消退慾望的效果（清心這類）+50%。"', '"desc": "禁慾派進階。淫亂與敏感的增加減半；消退慾望的效果（清心這類）+50%。"')
    t = t.replace('"lust": {"growth": {"lewdness": -0.5}, "relief": 0.5}, "requires": {"perks": ["school_abstinence"]}',
                  '"lust": {"growth": {"lewdness": -0.5, "sensitivity": -0.5}, "relief": 0.5}, "requires": {"perks": ["school_abstinence"]}')
    assert '"growth": {"lewdness": -0.5, "sensitivity": -0.5}' in t
    json.loads(t)
    open(p, 'w').write(t)


def write_items():
    p = 'data/rules/items.json'
    t = open(p).read()
    for it in ITEMS:
        t = re.sub(r'\n    \{"name": ' + re.escape(json.dumps(it['name'], ensure_ascii=False)) + r'.*', '', t)
    m = re.search(r'\n    \{"name": "清心茶".*', t)
    assert m
    end = m.end()
    t = t[:end] + ''.join('\n    ' + json.dumps(it, ensure_ascii=False) + ',' for it in ITEMS) + t[end:]
    json.loads(t)
    open(p, 'w').write(t)


if __name__ == '__main__':
    write_lewd()
    write_perk()
    write_items()
