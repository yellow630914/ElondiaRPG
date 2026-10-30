"""固定 NPC 的內建形象圖：把遊戲匯出的形象圖（<npc id>.png，旁邊可以有同名的 .json）轉成 src/assets/portraits/<npc id>.webp。

用法：python3 -I tools/portraits/finalize.py <資料夾或 zip> [...] [--width 512] [--quality 80]

- 只收 data/world/npcs.json 裡有的固定 NPC；檔名不是 NPC id 的跳過並列出
- 同名的 .json 標了 adult: true 的跳過（內建圖一律不放成人向）
- 等比例縮成指定寬度（預設 512，形象圖框是 260px 寬，高解析螢幕剛好）
- 需要 Pillow
"""
import argparse
import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'src' / 'assets' / 'portraits'


def sources(paths):
    """(檔名, 讀圖片的函式)"""
    for p in map(Path, paths):
        if p.suffix == '.zip':
            z = zipfile.ZipFile(p)
            for n in sorted(z.namelist()):
                if n.endswith('.png'):
                    yield Path(n).name, (lambda z=z, n=n: z.read(n))
        else:
            for f in sorted(p.rglob('*.png')):
                yield f.name, f.read_bytes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='+')
    ap.add_argument('--width', type=int, default=512)
    ap.add_argument('--quality', type=int, default=80)
    a = ap.parse_args()
    npcs = {n['id'] for n in json.loads((ROOT / 'data' / 'world' / 'npcs.json').read_text(encoding='utf-8'))['npcs']}
    # 每個檔名對應的 json（zip 拆成好幾包時，json 可能在別的包裡）
    metas = {}
    for p in map(Path, a.paths):
        if p.suffix == '.zip':
            z = zipfile.ZipFile(p)
            for n in z.namelist():
                if n.endswith('.json'):
                    metas[Path(n).stem] = json.loads(z.read(n))
        else:
            for f in p.rglob('*.json'):
                metas[f.stem] = json.loads(f.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    done, skipped = [], []
    for name, read in sources(a.paths):
        npc = Path(name).stem
        if npc not in npcs:
            skipped.append(f'{name}（不是固定 NPC）')
            continue
        if (metas.get(npc) or {}).get('meta', {}).get('adult'):
            skipped.append(f'{name}（成人向）')
            continue
        img = Image.open(io.BytesIO(read())).convert('RGB')
        h = round(img.height * a.width / img.width)
        img.resize((a.width, h), Image.LANCZOS).save(OUT / f'{npc}.webp', 'WEBP', quality=a.quality, method=6)
        done.append(npc)
    total = sum((OUT / f'{n}.webp').stat().st_size for n in done)
    print(f'轉好 {len(done)} 張（共 {total / 1024:.0f} KB）→ {OUT.relative_to(ROOT)}')
    for s in skipped:
        print('跳過', s, file=sys.stderr)


if __name__ == '__main__':
    main()
