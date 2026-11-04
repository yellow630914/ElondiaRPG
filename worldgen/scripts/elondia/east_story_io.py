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
