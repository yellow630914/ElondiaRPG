"""把挑中的候選裁成 16:9、縮成 1536×864，存成 webp 放進 src/assets/backgrounds/<key>.webp。要 Pillow（pip install pillow）。

picks.json 寫每個場景挑哪一張（raw/<key>/ 底下的檔名，不含副檔名）：
    {"special-sm_lust_park": "comfy-c2", "park_beast-deep": "novelai-c0"}
    python tools/backgrounds/finalize.py --picks tools/backgrounds/picks.json
也可以只做一張：
    python tools/backgrounds/finalize.py --key park_beast-deep --file raw/park_beast-deep/comfy-c1.png
另外會在 raw/sheet-<key>.jpg 排出每個場景所有候選的總覽圖（--sheets），方便挑。
"""

import argparse
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
W, H = 1536, 864


def fit(img):
    """置中裁成 16:9 再縮放"""
    img = img.convert('RGB')
    w, h = img.size
    if w / h > W / H:
        nw = round(h * W / H)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = round(w * H / W)
        img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return img.resize((W, H), Image.LANCZOS)


def export(key, src, out, quality):
    img = fit(Image.open(src))
    target = out / f'{key}.webp'
    img.save(target, 'WEBP', quality=quality, method=6)
    print(f'{src} → {target}（{target.stat().st_size // 1024} KB）')


def sheets(raw):
    for d in sorted(p for p in raw.iterdir() if p.is_dir()):
        files = sorted(d.glob('*.png'))
        if not files:
            continue
        thumbs = [fit(Image.open(f)).resize((384, 216)) for f in files]
        sheet = Image.new('RGB', (384 * min(4, len(thumbs)), 216 * ((len(thumbs) + 3) // 4)), 'black')
        for i, t in enumerate(thumbs):
            sheet.paste(t, (384 * (i % 4), 216 * (i // 4)))
        sheet.save(raw / f'sheet-{d.name}.jpg', quality=85)
        print(f'sheet-{d.name}.jpg：{", ".join(f.stem for f in files)}')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--raw', default=str(HERE / 'raw'))
    ap.add_argument('--out', default=str(ROOT / 'src' / 'assets' / 'backgrounds'))
    ap.add_argument('--picks', help='picks.json')
    ap.add_argument('--key')
    ap.add_argument('--file')
    ap.add_argument('--quality', type=int, default=82, help='webp 品質（每張 500 KB 以內為佳）')
    ap.add_argument('--sheets', action='store_true', help='排出候選的總覽圖')
    args = ap.parse_args()
    raw, out = Path(args.raw), Path(args.out)
    if args.sheets:
        sheets(raw)
    if args.key and args.file:
        export(args.key, Path(args.file), out, args.quality)
    if args.picks:
        for key, pick in json.loads(Path(args.picks).read_text(encoding='utf-8')).items():
            export(key, raw / key / f'{pick}.png', out, args.quality)
    if not (args.sheets or args.picks or (args.key and args.file)):
        ap.print_help()


if __name__ == '__main__':
    main()
