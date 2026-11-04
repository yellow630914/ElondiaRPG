"""炎華之地的特殊任務腳本共用：把一批任務寫進 data/rules/stories.json。

照原本檔案的排版（小的物件與陣列放一行）；同 id 的任務先拿掉再加在檔尾，所以每支腳本都可以重跑。
"""

import json

PATH = 'data/rules/stories.json'


def inline(v):
    if isinstance(v, dict):
        return '{ ' + ', '.join(json.dumps(k, ensure_ascii=False) + ': ' + inline(x) for k, x in v.items()) + ' }' if v else '{}'
    if isinstance(v, list):
        return '[' + ', '.join(inline(x) for x in v) + ']'
    return json.dumps(v, ensure_ascii=False)


def fmt(v, indent):
    flat = json.dumps(v, ensure_ascii=False)
    pad = ' ' * indent
    if not isinstance(v, (dict, list)) or len(flat) + indent <= 150 or not v:
        return inline(v)
    inner = ' ' * (indent + 2)
    if isinstance(v, list):
        return '[\n' + ',\n'.join(inner + fmt(x, indent + 2) for x in v) + '\n' + pad + ']'
    return '{\n' + ',\n'.join(inner + json.dumps(k, ensure_ascii=False) + ': ' + fmt(x, indent + 2) for k, x in v.items()) + '\n' + pad + '}'


def remove_story(src, sid):
    head = '\n    {\n      "id": "%s"' % sid
    start = src.find(head)
    if start < 0:
        return src
    nxt = src.find('\n    {\n      "id": "', start + len(head))
    end = nxt if nxt >= 0 else src.rfind('\n  ]')
    before = src[:start]
    # 拿掉前一個任務結尾的逗號或自己結尾的逗號
    if nxt >= 0:
        return before + src[end:]
    return before.rstrip().rstrip(',') + src[end:]


def write_stories(stories, path=PATH):
    src = open(path, encoding='utf-8').read()
    for s in stories:
        src = remove_story(src, s['id'])
    json.loads(src)
    end = src.rstrip().rfind('\n  ]')
    body = ''.join(',\n    ' + fmt(s, 4) for s in stories)
    out = src.rstrip()[:end] + body + src.rstrip()[end:] + '\n'
    data = json.loads(out)
    ids = [s['id'] for s in data['stories']]
    assert len(ids) == len(set(ids)), '重複的任務 id'
    open(path, 'w', encoding='utf-8').write(out)
    print(f'特殊任務 {len(stories)} 條')


EVENTS_PATH = 'data/rules/travel_events.json'


def write_events(events, path=EVENTS_PATH):
    """旅途、城鎮、地下城事件寫進 travel_events.json 的 templates（同 id 先拿掉，加在 templates 的最後）"""
    src = open(path, encoding='utf-8').read()
    for e in events:
        head = '\n    {\n      "id": "%s"' % e['id']
        start = src.find(head)
        if start < 0:
            continue
        nxt = src.find('\n    {\n      "id"', start + len(head))
        close = src.find('\n  ],', start)
        end = nxt if 0 <= nxt < close else close
        src = src[:start] + src[end:] if end == nxt else src[:start].rstrip().rstrip(',') + src[end:]
    t0 = src.index('"templates": [')
    close = src.index('\n  ],', t0)
    before = src[:close].rstrip()
    body = ''.join(',\n    ' + fmt(e, 4) for e in events)
    out = before + body + src[close:]
    data = json.loads(out)
    ids = [t['id'] for t in data['templates']]
    assert len(ids) == len(set(ids)), '重複的事件 id'
    open(path, 'w', encoding='utf-8').write(out)
    print(f'事件 {len(events)} 個')


ITEMS_PATH = 'data/rules/items.json'


def write_items(items, anchor='    { "name": "走私貨物",', path=ITEMS_PATH):
    """物品一行一件，插在 anchor 那一行之前；同名的先拿掉"""
    lines = open(path, encoding='utf-8').read().split('\n')
    names = {i['name'] for i in items}
    lines = [l for l in lines if not any(l.startswith('    {"name": %s' % json.dumps(n, ensure_ascii=False)) for n in names)]
    at = next(i for i, l in enumerate(lines) if l.startswith(anchor))
    lines[at:at] = ['    ' + json.dumps(i, ensure_ascii=False) + ',' for i in items]
    out = '\n'.join(lines)
    data = json.loads(out)
    all_names = [i['name'] for i in data['items']]
    assert len(all_names) == len(set(all_names)), '重複的物品名稱'
    open(path, 'w', encoding='utf-8').write(out)
    print(f'物品 {len(items)} 件')
