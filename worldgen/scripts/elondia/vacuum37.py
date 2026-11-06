# 真空（docs/LEWD_STATS.md 第 3 節）：外衣底下沒穿內衣、內褲時，會走光的那一側曝露度 +1。
# 「會走光」：外衣本身曝露度 1 以上，或底材的 vacuum 寫了那一側（曝露度 0 的裙子、薄襯衫、浴衣）。
# 這裡替曝露度 0、卻會走光的常規服裝寫上 vacuum，並加上 lewd.json 的 daily.vacuum（在聚落裡真空的日子淫亂成長）。
# 可以重跑：只改 vacuum 與 daily.vacuum，其他照原樣（gear.json 的底材一行一筆）。
import json
import re

# 底材 id → 會走光的一側（top 上身沒穿內衣、bottom 裙底沒穿內褲）
VACUUM = {
    'pleated_skirt': ['bottom'],   # 百褶裙
    'long_skirt': ['bottom'],      # 長裙
    'dress': ['bottom'],           # 連身裙
    'gown': ['bottom'],            # 禮服
    'maid_dress': ['bottom'],      # 女僕裝
    'nurse_uniform': ['bottom'],   # 護士服
    'gothic_lolita': ['bottom'],   # 哥德蘿莉塔洋裝
    'yukata': ['top', 'bottom'],   # 浴衣
    'shirt': ['top'],              # 襯衫
    'blouse': ['top'],             # 荷葉邊上衣
}

DAILY_VACUUM = {'lewdness': 1}


def main():
    p = 'data/rules/gear.json'
    lines = open(p).read().split('\n')
    done = set()
    for i, line in enumerate(lines):
        m = re.match(r'^(\s*)"([a-z0-9_]+)": (\{.*\})(,?)$', line)
        if not m or m.group(2) not in VACUUM:
            continue
        indent, key, body, comma = m.groups()
        base = json.loads(body)
        if 'slot' not in base:
            continue
        base['vacuum'] = VACUUM[key]
        lines[i] = f'{indent}"{key}": {json.dumps(base, ensure_ascii=False)}{comma}'
        done.add(key)
    assert done == set(VACUUM), set(VACUUM) - done
    t = '\n'.join(lines)
    json.loads(t)
    open(p, 'w').write(t)

    p = 'data/rules/lewd.json'
    t = open(p).read()
    t = re.sub(r'\n\s*"vacuum": \{[^}]*\},', '', t)
    anchor = '"locked": { "submission": 1 },'
    assert anchor in t
    t = t.replace(anchor, anchor + '\n    "vacuum": ' + json.dumps(DAILY_VACUUM).replace('{', '{ ').replace('}', ' }') + ',', 1)
    d = json.loads(t)
    assert d['daily']['vacuum'] == DAILY_VACUUM
    open(p, 'w').write(t)
    print('vacuum bases', len(done))


if __name__ == '__main__':
    main()
