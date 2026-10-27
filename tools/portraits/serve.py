"""角色印象圖工具的本機伺服器：提供 index.html，並把 /comfy/... 轉給 ComfyUI（同一個網址，瀏覽器不會擋跨網域）。

只用標準函式庫，ComfyUI portable 內建的 Python 就能跑：
    python_embeded\\python.exe -I tools\\portraits\\serve.py
然後打開 http://127.0.0.1:8190
常用參數：
    --comfy http://127.0.0.1:8188    ComfyUI 的網址
    --port 8190                      這個工具的連接埠
端點：
    GET  /comfy/<路徑>               轉給 ComfyUI（object_info、history、view、queue……）
    POST /comfy/prompt               轉給 ComfyUI 的 /prompt
    GET  /api/npcs                   npcs.json（先跑 build_list.py）
    GET  /api/status                 每個 NPC 有幾張圖、選了哪一張
    GET  /api/gallery?id=<npc>       這個 NPC 的所有成品（新的在前）
    POST /api/save                   {id, image:{filename, subfolder, type}, meta} → 從 ComfyUI 下載，存到 out/<npc>/<時間>-<seed>.png（＋.json）
    POST /api/export                 {id, file} → 複製成 export/<npc>.png
    POST /api/delete                 {id, file} → 刪掉 out/<npc>/ 裡的一張（連同 .json）
    POST /api/prompts                {id, prompt, negative, adult_prompt} → 寫回 prompts.json 與 npcs.json
"""

import argparse
import json
import re
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
EXPORT = HERE / 'export'
NPCS = HERE / 'npcs.json'
PROMPTS = HERE / 'prompts.json'
IMAGE_EXT = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp'}
SAFE_ID = re.compile(r'^[A-Za-z0-9_\-]+$')
SAFE_FILE = re.compile(r'^[A-Za-z0-9_\-.]+$')
COMFY = 'http://127.0.0.1:8188'


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return default


def write_json(path, data):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    tmp.replace(path)


def comfy(path, body=None, timeout=60):
    """呼叫 ComfyUI，回傳 (狀態碼, 內容, Content-Type)；連不上時是 502"""
    data = body if isinstance(body, (bytes, type(None))) else json.dumps(body).encode()
    req = urllib.request.Request(COMFY + path, data=data, headers={'Content-Type': 'application/json'} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), r.headers.get('Content-Type', 'application/octet-stream')
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers.get('Content-Type', 'text/plain')
    except (urllib.error.URLError, OSError) as e:
        msg = f'連不上 ComfyUI（{COMFY}）：{getattr(e, "reason", e)}。請確認 ComfyUI 已經啟動，或用 --comfy 指定網址'
        return 502, json.dumps({'error': msg}, ensure_ascii=False).encode(), 'application/json'


def npc_dir(npc_id):
    if not SAFE_ID.match(npc_id or ''): raise ValueError('NPC id 不正確')
    return OUT / npc_id


def check_file(name):
    if not SAFE_FILE.match(name or '') or name.startswith('.'): raise ValueError('檔名不正確')
    return name


def gallery(npc_id):
    d = npc_dir(npc_id)
    items = []
    if d.is_dir():
        for f in sorted(d.iterdir(), reverse=True):
            if f.suffix.lower() not in IMAGE_EXT: continue
            meta = load_json(f.with_suffix('.json'), {})
            items.append({'file': f.name, 'url': f'/out/{npc_id}/{f.name}', 'meta': meta})
    exp = next((f for f in EXPORT.glob(f'{npc_id}.*') if f.suffix.lower() in IMAGE_EXT), None) if EXPORT.is_dir() else None
    chosen = load_json(EXPORT / f'{npc_id}.json', {}).get('from') if exp else None
    return {'items': items, 'export': f'/export/{exp.name}?t={int(exp.stat().st_mtime)}' if exp else None, 'chosen': chosen}


def status():
    counts, exports = {}, {}
    if OUT.is_dir():
        for d in OUT.iterdir():
            if d.is_dir(): counts[d.name] = sum(1 for f in d.iterdir() if f.suffix.lower() in IMAGE_EXT)
    if EXPORT.is_dir():
        for f in EXPORT.iterdir():
            if f.suffix.lower() in IMAGE_EXT: exports[f.stem] = f'/export/{f.name}?t={int(f.stat().st_mtime)}'
    return {'counts': counts, 'exports': exports, 'comfy': COMFY}


def save(body):
    npc_id = body.get('id')
    d = npc_dir(npc_id)
    img = body.get('image') or {}
    q = urllib.parse.urlencode({'filename': img.get('filename', ''), 'subfolder': img.get('subfolder', ''), 'type': img.get('type', 'output')})
    code, data, _ = comfy(f'/view?{q}')
    if code != 200: raise RuntimeError(f'從 ComfyUI 下載圖片失敗（{code}）：{data[:200].decode("utf-8", "replace")}')
    meta = body.get('meta') or {}
    ext = Path(img.get('filename', '')).suffix.lower()
    if ext not in IMAGE_EXT: ext = '.png'
    seed = re.sub(r'[^0-9]', '', str(meta.get('seed', ''))) or '0'
    d.mkdir(parents=True, exist_ok=True)
    stem = f"{time.strftime('%Y%m%d-%H%M%S')}-{seed}"
    name, n = stem, 1
    while (d / f'{name}{ext}').exists():
        n += 1
        name = f'{stem}-{n}'
    (d / f'{name}{ext}').write_bytes(data)
    write_json(d / f'{name}.json', {**meta, 'npc': npc_id, 'comfy_image': img, 'saved_at': time.strftime('%Y-%m-%d %H:%M:%S')})
    return {'file': f'{name}{ext}', 'url': f'/out/{npc_id}/{name}{ext}'}


def export(body):
    npc_id = body.get('id')
    src = npc_dir(npc_id) / check_file(body.get('file'))
    if not src.is_file(): raise FileNotFoundError('找不到這張圖')
    EXPORT.mkdir(exist_ok=True)
    for old in EXPORT.glob(f'{npc_id}.*'): old.unlink()
    dst = EXPORT / f'{npc_id}{src.suffix.lower()}'
    shutil.copyfile(src, dst)
    write_json(EXPORT / f'{npc_id}.json', {'from': src.name, 'meta': load_json(src.with_suffix('.json'), {})})
    return {'file': dst.name, 'url': f'/export/{dst.name}?t={int(time.time())}'}


def delete(body):
    npc_id = body.get('id')
    f = npc_dir(npc_id) / check_file(body.get('file'))
    if f.suffix.lower() not in IMAGE_EXT or not f.is_file(): raise FileNotFoundError('找不到這張圖')
    f.unlink()
    f.with_suffix('.json').unlink(missing_ok=True)
    return {'ok': True}


def save_prompts(body):
    npc_id = body.get('id')
    if not SAFE_ID.match(npc_id or ''): raise ValueError('NPC id 不正確')
    prompts = load_json(PROMPTS, {})
    entry = prompts.setdefault(npc_id, {})
    for k in ('prompt', 'negative', 'adult_prompt'):
        if k not in body: continue
        v = str(body[k] or '').strip()
        if v: entry[k] = v
        else: entry.pop(k, None)
    write_json(PROMPTS, prompts)
    # npcs.json 也一起改，不必重跑 build_list.py
    data = load_json(NPCS, {'npcs': []})
    for n in data['npcs']:
        if n['id'] != npc_id: continue
        for k in ('prompt', 'negative', 'adult_prompt'):
            if k == 'prompt': n[k] = entry.get(k, '')
            elif entry.get(k): n[k] = entry[k]
            else: n.pop(k, None)
    write_json(NPCS, data)
    return {'ok': True, 'entry': entry}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # 輪詢 /history 太吵，只印出錯的請求與存檔
        if args and (str(args[1])[:1] in '45' or '/api/' in str(args[0])): super().log_message(fmt, *args)

    def send(self, code, data, ctype='application/json; charset=utf-8'):
        if isinstance(data, (dict, list)): data = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def file(self, path):
        if not path.is_file(): return self.send(404, {'error': '找不到檔案'})
        ctype = IMAGE_EXT.get(path.suffix.lower()) or ('text/html; charset=utf-8' if path.suffix == '.html' else 'application/json; charset=utf-8')
        self.send(200, path.read_bytes(), ctype)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n) if n else b''

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        p = u.path
        try:
            if p in ('/', '/index.html'): return self.file(HERE / 'index.html')
            if p.startswith('/comfy/'):
                code, data, ctype = comfy(self.path[len('/comfy'):])
                return self.send(code, data, ctype)
            if p == '/api/npcs':
                if not NPCS.is_file(): return self.send(404, {'error': '還沒有 npcs.json：請在 repo 根目錄先跑 python tools/portraits/build_list.py'})
                return self.file(NPCS)
            if p == '/api/status': return self.send(200, status())
            if p == '/api/gallery': return self.send(200, gallery(urllib.parse.parse_qs(u.query).get('id', [''])[0]))
            m = re.match(r'^/out/([^/]+)/([^/]+)$', p)
            if m: return self.file(npc_dir(m[1]) / check_file(m[2]))
            m = re.match(r'^/export/([^/]+)$', p)
            if m: return self.file(EXPORT / check_file(m[1]))
            self.send(404, {'error': '找不到'})
        except (ValueError, FileNotFoundError) as e:
            self.send(400, {'error': str(e)})

    def do_POST(self):
        p = urllib.parse.urlsplit(self.path).path
        raw = self.body()
        try:
            if p.startswith('/comfy/'):
                code, data, ctype = comfy(self.path[len('/comfy'):], raw or b'{}')
                return self.send(code, data, ctype)
            body = json.loads(raw or b'{}')
            api = {'/api/save': save, '/api/export': export, '/api/delete': delete, '/api/prompts': save_prompts}.get(p)
            if not api: return self.send(404, {'error': '找不到'})
            self.send(200, api(body))
        except (ValueError, FileNotFoundError, RuntimeError) as e:
            self.send(400, {'error': str(e)})


def main():
    global COMFY
    ap = argparse.ArgumentParser(description='角色印象圖工具（ComfyUI）')
    ap.add_argument('--comfy', default=COMFY, help='ComfyUI 的網址（預設 http://127.0.0.1:8188）')
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=8190)
    a = ap.parse_args()
    COMFY = a.comfy.rstrip('/')
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f'角色印象圖工具：http://{a.host}:{a.port}　（ComfyUI：{COMFY}，Ctrl+C 結束）', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
