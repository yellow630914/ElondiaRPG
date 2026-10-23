"""把 icons.json 的清單逐項送進 ComfyUI，每項生成幾張候選，存到 raw/<key>/c<n>.png。

只用標準函式庫，ComfyUI portable 內建的 Python 就能跑：
    python_embeded\\python.exe -I tools\\pixel\\generate.py --count 4
常用參數：
    --only gear_longsword,mat_herb   只跑這幾項
    --group gear                     只跑某一組（gear / material / consumable / scroll / tool / furniture / food / info）
    --count 4                        每項幾張候選（已經存在的會跳過，可以中斷後重跑）
    --server http://127.0.0.1:8188
"""

import argparse
import json
import random
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent


def call(server, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(server + path, data=data, headers={'Content-Type': 'application/json'} if data else {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def build(template, prompt, negative, seed, prefix, size):
    wf = json.loads(json.dumps(template))
    wf.pop('_comment', None)
    wf['9']['inputs']['text'] = prompt
    wf['10']['inputs']['text'] = negative
    wf['11']['inputs']['width'] = wf['11']['inputs']['height'] = size
    wf['12']['inputs']['seed'] = seed
    wf['14']['inputs']['filename_prefix'] = prefix
    return wf


def wait(server, prompt_id, timeout=600):
    start = time.time()
    while time.time() - start < timeout:
        hist = json.loads(call(server, f'/history/{prompt_id}'))
        if prompt_id in hist:
            entry = hist[prompt_id]
            if entry.get('status', {}).get('status_str') == 'error':
                raise RuntimeError(json.dumps(entry['status'], ensure_ascii=False)[:500])
            for out in entry.get('outputs', {}).values():
                if out.get('images'):
                    return out['images'][0]
        time.sleep(1.5)
    raise TimeoutError(prompt_id)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', default=str(HERE / 'icons.json'))
    ap.add_argument('--template', default=str(HERE / 'anima-pixel-template.json'))
    ap.add_argument('--out', default=str(HERE / 'raw'))
    ap.add_argument('--server', default='http://127.0.0.1:8188')
    ap.add_argument('--count', type=int, default=4)
    ap.add_argument('--size', type=int, default=1024, help='生成解析度（後處理再縮小）')
    ap.add_argument('--only', default='')
    ap.add_argument('--group', default='')
    args = ap.parse_args()

    spec = json.loads(Path(args.list).read_text(encoding='utf-8'))
    template = json.loads(Path(args.template).read_text(encoding='utf-8'))
    only = {k for k in args.only.split(',') if k}
    items = [i for i in spec['icons'] if (not only or i['key'] in only) and (not args.group or i['group'] == args.group)]
    if not items:
        sys.exit('清單裡沒有符合的項目')
    out = Path(args.out)
    jobs = [(i, n) for i in items for n in range(args.count) if not (out / i['key'] / f'c{n}.png').exists()]
    print(f'{len(items)} 項，待生成 {len(jobs)} 張')
    client = str(uuid.uuid4())
    for done, (item, n) in enumerate(jobs, 1):
        prompt = spec['prefix'] + item['subject'] + spec['suffix']
        seed = random.randrange(2**48)
        wf = build(template, prompt, spec['negative'], seed, f"elondia/{item['key']}_c{n}", args.size)
        res = json.loads(call(args.server, '/prompt', {'prompt': wf, 'client_id': client}))
        img = wait(args.server, res['prompt_id'])
        q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img.get('subfolder', ''), 'type': img.get('type', 'output')})
        target = out / item['key'] / f'c{n}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(call(args.server, f'/view?{q}'))
        (out / item['key'] / f'c{n}.json').write_text(json.dumps({'prompt': prompt, 'seed': seed}, ensure_ascii=False), encoding='utf-8')
        print(f'[{done}/{len(jobs)}] {item["key"]} c{n}')


if __name__ == '__main__':
    main()
