# 成人向任務補上「非處女」標籤（11/9 實測決定）：任務的主要對象寫死了有經驗（sex_seeds42.py），劇情也照有經驗寫，
# 任務卻沒標 non_virgin，關掉非處女篩選照樣遇得到。嚮導、反派、男性的配角有經驗不算（不是內容篩選要擋的對象）。
# 只在 tags 裡加 non_virgin；可以重跑。在 repo 根目錄執行。
import json
import re

P = 'data/rules/stories.json'
IDS = [
    # 諾瓦（星屑三重奏）
    'noir_blank_score', 'noir_fan_letters', 'noir_song_for_whom', 'group_idol_backstage',
    # 烏日娜、薩日朗
    'tdur_wild_stallion', 'tdur_who_rides', 'tdur_bridle',
    'tdsr_foaling', 'tdsr_stud', 'tdsr_herd',
    # 阿嘉莎：最後一站和主角一起被神父們輪流
    'conf_last',
]

s = open(P, encoding='utf-8').read()
n = 0
for sid in IDS:
    m = re.search(r'"id": "%s",' % re.escape(sid), s)
    assert m, sid
    # 這個任務的 tags 在同一個物件裡、nodes 之前
    t = re.compile(r'"tags": \[([^\]]*)\]').search(s, m.end())
    nxt = s.find('"nodes"', m.end())
    assert t and t.start() < nxt, sid
    tags = json.loads('[' + t.group(1) + ']')
    if 'non_virgin' in tags:
        continue
    tags.append('non_virgin')
    # 照內容標籤的順序（content.ts 的 CONTENT_TAG_IDS；整理任務時也是這個順序）
    order = ['adult', 'ntr', 'non_virgin', 'pc_unwilling', 'male_partner']
    tags.sort(key=lambda t: order.index(t) if t in order else len(order))
    s = s[:t.start()] + '"tags": ' + json.dumps(tags, ensure_ascii=False) + s[t.end():]
    n += 1

json.loads(s)
open(P, 'w', encoding='utf-8').write(s)
print(f'{n} 個任務補上了非處女標籤')
