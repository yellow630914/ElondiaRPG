"""背景圖腳本共用的部分：讀場景清單、組提示詞、存候選圖。只用標準函式庫。"""

import argparse
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def base_args(desc, default_width, default_height):
    ap = argparse.ArgumentParser(description=desc)
    ap.add_argument('--list', default=str(HERE / 'park_scenes.json'), help='場景清單（預設 park_scenes.json）')
    ap.add_argument('--out', default=str(HERE / 'raw'), help='候選圖存在 <out>/<key>/<服務>-c<n>.png')
    ap.add_argument('--only', default='', help='只跑這幾個 key，逗號分開（例如 special-sm_lust_park,park_beast-deep）')
    ap.add_argument('--count', type=int, default=4, help='每個場景幾張候選（已經存在的跳過，可以中斷後重跑）')
    ap.add_argument('--width', type=int, default=default_width)
    ap.add_argument('--height', type=int, default=default_height)
    ap.add_argument('--seed', type=int, default=None, help='固定種子（每張候選 +1）；沒寫時隨機')
    return ap


def load_scenes(args):
    spec = json.loads(Path(args.list).read_text(encoding='utf-8'))
    only = {k for k in args.only.split(',') if k}
    scenes = [s for s in spec['scenes'] if not only or s['key'] in only]
    if not scenes:
        sys.exit('清單裡沒有符合的場景')
    return spec['style'], scenes


def tag_prompt(style, scene, safe=False):
    """ComfyUI、NovelAI 用的 Danbooru 標籤；safe 時不加成人向的加料"""
    body = scene['tags'] + ('' if safe or not scene.get('adult') else ', ' + scene['adult'])
    return style['tags_prefix'] + body + style['tags_suffix']


def text_prompt(style, scene):
    """ChatGPT 用的句子（不含成人內容）"""
    return style['text_prefix'] + scene['text'][0].upper() + scene['text'][1:] + '.' + style['text_suffix']


def jobs(args, scenes, service):
    out = Path(args.out)
    todo = [(s, n) for s in scenes for n in range(args.count) if not (out / s['key'] / f'{service}-c{n}.png').exists()]
    print(f'{len(scenes)} 個場景，待生成 {len(todo)} 張')
    return todo


def seed_for(args, n):
    return args.seed + n if args.seed is not None else random.randrange(2**32)


def save(args, scene, service, n, data, meta):
    target = Path(args.out) / scene['key'] / f'{service}-c{n}.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    target.with_suffix('.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    return target
