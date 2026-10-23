"""把 generate.py 生成的大圖處理成像素圖示，並排出挑選用的總覽圖。

步驟：去背（從邊緣往內 flood fill 掉背景色）→ 裁到物件 → 縮成 size×size → 減色到 palette.json。
recolor 的圖示：低彩度的像素對到 ramp 的 4 階灰（遊戲裡再換成材質色），其他像素對到 fixed 固定色。

    python_embeded\\python.exe -I tools\\pixel\\process.py                 處理 raw/ 底下全部，輸出 processed/ 與 sheets/
    python_embeded\\python.exe -I tools\\pixel\\process.py --only gear_longsword
    python_embeded\\python.exe -I tools\\pixel\\process.py --export        依 picks.json 把挑中的候選複製到 export/<key>.png

picks.json 的格式：{"gear_longsword": 2, "mat_herb": 0, ...}（數字是候選編號 c<n>）
"""

import argparse
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
MARK = (255, 0, 254)
# 預覽換色用：每種 recolor 挑一種材質
PREVIEW = {'metal': 'iron', 'leather': 'leather', 'cloth': 'linen', 'wood': 'oak', 'jewel': 'gold', 'liquid': 'potion_red'}


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def fill_holes(work, bg, tol, min_area):
    """hollow 的物件：被物件圍住的背景色區域（戒指的孔）也標成背景；太小的區域當成反光，留著。"""
    keep = (1, 2, 3)
    for _ in range(300):
        a = np.asarray(work).astype(int)
        cand = (np.abs(a - bg).max(axis=-1) <= tol) & ~np.all(a == MARK, axis=-1) & ~np.all(a == keep, axis=-1)
        pts = np.argwhere(cand)
        if not len(pts):
            return
        y, x = pts[0]
        probe = (4, 5, 6)
        ImageDraw.floodfill(work, (int(x), int(y)), probe, thresh=tol)
        region = np.all(np.asarray(work) == probe, axis=-1)
        fill = MARK if region.sum() >= min_area else keep
        ImageDraw.floodfill(work, (int(x), int(y)), fill, thresh=0)


def remove_background(img, tol, hollow=False, min_hole=0.0008):
    """從四邊每隔一段距離 flood fill 和背景相近的顏色，回傳 RGBA（背景透明）。"""
    rgb = img.convert('RGB')
    a = np.asarray(rgb).astype(int)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    work = rgb.copy()
    w, h = work.size
    step = max(8, min(w, h) // 64)
    seeds = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] + \
            [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    for s in seeds:
        px = work.getpixel(s)
        if px != MARK and np.abs(np.array(px) - bg).max() <= tol:
            ImageDraw.floodfill(work, s, MARK, thresh=tol)
    if hollow:
        fill_holes(work, bg, tol, int(w * h * min_hole))
    m = np.all(np.asarray(work) == MARK, axis=-1)
    out = np.dstack([np.asarray(rgb), np.where(m, 0, 255).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


def crop_square(img, margin):
    bbox = img.getchannel('A').getbbox()
    if not bbox:
        return img
    img = img.crop(bbox)
    side = int(max(img.size) * (1 + margin * 2))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
    return canvas


def downscale(img, size):
    """預乘 alpha 再縮小，避免邊緣混進背景色；alpha 過半才算不透明。"""
    a = np.asarray(img).astype(np.float64) / 255
    pre = np.dstack([a[..., :3] * a[..., 3:4], a[..., 3:4]])
    chans = [Image.fromarray((pre[..., i] * 255).astype(np.uint8), 'L').resize((size, size), Image.BOX) for i in range(4)]
    small = np.dstack([np.asarray(c).astype(np.float64) / 255 for c in chans])
    alpha = small[..., 3]
    rgb = np.where(alpha[..., None] > 0, small[..., :3] / np.maximum(alpha[..., None], 1e-6), 0)
    return np.clip(rgb, 0, 1), alpha >= 0.5


def nearest(rgb, palette):
    """redmean 距離找最近的顏色（比單純 RGB 距離接近人眼）。"""
    p = np.array(palette, dtype=np.float64) / 255
    d = rgb[:, None, :] - p[None, :, :]
    rmean = (rgb[:, None, 0] + p[None, :, 0]) / 2
    dist = (2 + rmean) * d[..., 0] ** 2 + 4 * d[..., 1] ** 2 + (3 - rmean) * d[..., 2] ** 2
    return dist.argmin(axis=1)


def ramp_levels(lum):
    """把灰階亮度分成 4 群（一維 k-means），由亮到暗對到 ramp 的 0～3 階。"""
    centers = np.percentile(lum, [95, 70, 40, 10])
    for _ in range(20):
        idx = np.abs(lum[:, None] - centers[None, :]).argmin(axis=1)
        new = np.array([lum[idx == k].mean() if (idx == k).any() else centers[k] for k in range(4)])
        if np.allclose(new, centers):
            break
        centers = new
    order = np.argsort(-centers)
    rank = np.empty(4, dtype=int)
    rank[order] = np.arange(4)
    return rank[np.abs(lum[:, None] - centers[None, :]).argmin(axis=1)]


def quantize(rgb, opaque, pal, recolor, sat_limit):
    ramp = [hex_rgb(c) for c in pal['ramp']]
    fixed = [hex_rgb(c) for c in pal['fixed']]
    out = np.zeros((*opaque.shape, 4), dtype=np.uint8)
    px = rgb[opaque]
    mx, mn = px.max(axis=1), px.min(axis=1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    gray = (sat < sat_limit) if recolor else np.zeros(len(px), bool)
    colors = np.zeros((len(px), 3), dtype=np.uint8)
    if gray.any():
        lum = px[gray] @ np.array([0.299, 0.587, 0.114])
        colors[gray] = np.array(ramp, dtype=np.uint8)[ramp_levels(lum)]
    if (~gray).any():
        colors[~gray] = np.array(fixed, dtype=np.uint8)[nearest(px[~gray], fixed)]
    out[opaque, :3] = colors
    out[opaque, 3] = 255
    return out


def outline(arr, color):
    """透明像素中，上下左右有不透明像素的，塗上描邊色。"""
    op = arr[..., 3] > 0
    nb = np.zeros_like(op)
    nb[1:] |= op[:-1]; nb[:-1] |= op[1:]; nb[:, 1:] |= op[:, :-1]; nb[:, :-1] |= op[:, 1:]
    edge = nb & ~op
    arr = arr.copy()
    arr[edge, :3] = color
    arr[edge, 3] = 255
    return arr


def recolor_preview(arr, pal, material):
    ramp = [hex_rgb(c) for c in pal['ramp']]
    target = [hex_rgb(c) for c in pal['materials'][material]]
    arr = arr.copy()
    for src, dst in zip(ramp, target):
        m = np.all(arr[..., :3] == src, axis=-1) & (arr[..., 3] > 0)
        arr[m, :3] = dst
    return arr


def process_one(path, item, pal, args):
    img = remove_background(Image.open(path), args.tol, item.get('hollow', False), args.min_hole)
    img = crop_square(img, args.margin)
    inner = args.size - (2 if args.outline else 0)
    rgb, opaque = downscale(img, inner)
    arr = quantize(rgb, opaque, pal, item.get('recolor'), args.sat)
    if args.outline:
        arr = np.pad(arr, ((1, 1), (1, 1), (0, 0)))
        arr = outline(arr, hex_rgb(pal['fixed'][0]))
    return arr


def make_sheet(rows, scale, out):
    """rows: [(key, [arr 或 None, ...])]，每格放大 scale 倍，深色皮革底。"""
    if not rows:
        return
    cols = max(len(r[1]) for r in rows)
    cell = rows[0][1][0].shape[0] * scale + 8
    label = 170
    sheet = Image.new('RGB', (label + cols * cell, len(rows) * cell + 24), (35, 27, 20))
    d = ImageDraw.Draw(sheet)
    for c in range(cols):
        d.text((label + c * cell + 4, 6), f'c{c}', fill=(201, 154, 69))
    for r, (key, arrs) in enumerate(rows):
        y = 24 + r * cell
        d.text((6, y + cell // 2 - 6), key, fill=(239, 228, 204))
        for c, arr in enumerate(arrs):
            if arr is None:
                continue
            im = Image.fromarray(arr, 'RGBA').resize((arr.shape[1] * scale, arr.shape[0] * scale), Image.NEAREST)
            sheet.paste(im, (label + c * cell + 4, y + 4), im)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list', default=str(HERE / 'icons.json'))
    ap.add_argument('--palette', default=str(HERE / 'palette.json'))
    ap.add_argument('--raw', default=str(HERE / 'raw'))
    ap.add_argument('--out', default=str(HERE / 'processed'))
    ap.add_argument('--sheets', default=str(HERE / 'sheets'))
    ap.add_argument('--only', default='')
    ap.add_argument('--size', type=int, default=0, help='輸出尺寸，預設用 icons.json 的 size')
    ap.add_argument('--tol', type=int, default=12, help='去背的顏色容差（0～255）；背景是純白，太大會吃掉玻璃瓶身')
    ap.add_argument('--min-hole', type=float, default=0.0008, help='hollow 物件：封閉的背景色區域至少佔全圖這個比例才算孔（更小的當成反光）')
    ap.add_argument('--margin', type=float, default=0.06, help='物件四周留白的比例')
    ap.add_argument('--sat', type=float, default=0.18, help='recolor 圖示中低於這個彩度的像素算「可換色」')
    ap.add_argument('--outline', action='store_true', help='外圍加 1px 深色描邊')
    ap.add_argument('--scale', type=int, default=4, help='總覽圖的放大倍數')
    ap.add_argument('--export', action='store_true')
    args = ap.parse_args()

    spec = json.loads(Path(args.list).read_text(encoding='utf-8'))
    pal = json.loads(Path(args.palette).read_text(encoding='utf-8'))
    args.size = args.size or spec.get('size', 32)
    only = {k for k in args.only.split(',') if k}
    items = [i for i in spec['icons'] if not only or i['key'] in only]

    if args.export:
        picks = json.loads((HERE / 'picks.json').read_text(encoding='utf-8'))
        dest = HERE / 'export'
        dest.mkdir(exist_ok=True)
        for key, n in picks.items():
            src = Path(args.out) / key / f'c{n}.png'
            if src.exists():
                shutil.copy(src, dest / f'{key}.png')
            else:
                print(f'找不到 {src}')
        print(f'已輸出 {len(picks)} 張到 {dest}')
        return

    groups = {}
    for item in items:
        files = sorted((Path(args.raw) / item['key']).glob('c*.png'), key=lambda p: int(p.stem[1:]))
        if not files:
            continue
        arrs, previews = [], []
        for f in files:
            arr = process_one(f, item, pal, args)
            target = Path(args.out) / item['key'] / f.name
            target.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(arr, 'RGBA').save(target)
            arrs.append(arr)
            if item.get('recolor'):
                previews.append(recolor_preview(arr, pal, PREVIEW[item['recolor']]))
        rows = groups.setdefault(item['group'], [])
        rows.append((item['key'], arrs))
        if previews:
            rows.append((f"  ({PREVIEW[item['recolor']]})", previews))
        print(f"{item['key']}: {len(files)} 張")
    for group, rows in groups.items():
        make_sheet(rows, args.scale, Path(args.sheets) / f'{group}.png')
    print(f'總覽圖在 {args.sheets}')


if __name__ == '__main__':
    main()
