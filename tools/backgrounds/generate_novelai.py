"""用 NovelAI 生成背景圖候選（Danbooru 標籤，含成人向的加料；--safe 拿掉）。

金鑰是 NovelAI 帳號設定裡的 Persistent API Token，放在環境變數 NOVELAI_TOKEN（或 --token）：
    set NOVELAI_TOKEN=pst-xxxx              （Windows）
    export NOVELAI_TOKEN=pst-xxxx           （macOS、Linux）
    python -I tools/backgrounds/generate_novelai.py --count 2
預設尺寸 1344×768（約一百萬像素以內，Opus 訂閱不扣 Anlas），之後用 finalize.py 裁成 16:9 的 1536×864。
請求的格式和遊戲的 NovelAI 服務相同（src/narrator/imageProviders.ts 的 novelAIBody）。
"""

import io
import json
import os
import time
import urllib.error
import urllib.request
import zipfile

from common import base_args, jobs, load_scenes, save, seed_for, tag_prompt


def body(model, prompt, negative, seed, width, height, steps, scale, sampler):
    v4 = 'diffusion-4' in model
    params = {
        'params_version': 3, 'width': width, 'height': height, 'scale': scale, 'sampler': sampler, 'steps': steps,
        'n_samples': 1, 'seed': seed, 'ucPreset': 0, 'qualityToggle': True, 'noise_schedule': 'karras', 'cfg_rescale': 0,
        'negative_prompt': negative,
    }
    if v4:
        params['v4_prompt'] = {'caption': {'base_caption': prompt, 'char_captions': []}, 'use_coords': False, 'use_order': True}
        params['v4_negative_prompt'] = {'caption': {'base_caption': negative, 'char_captions': []}, 'legacy_uc': False}
    return {'input': prompt, 'model': model, 'action': 'generate', 'parameters': params}


def request(url, token, payload, retries=3):
    for attempt in range(retries):
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')[:300]
            # 429：同時只能跑一張，等一下再試
            if e.code == 429 and attempt < retries - 1:
                time.sleep(10)
                continue
            raise SystemExit(f'NovelAI 回應 {e.code}：{msg}')
    raise SystemExit('NovelAI 一直很忙，稍後再試')


def main():
    ap = base_args(__doc__.split('\n')[0], 1344, 768)
    ap.add_argument('--token', default=os.environ.get('NOVELAI_TOKEN', ''))
    ap.add_argument('--url', default='https://image.novelai.net', help='可以換成自己的轉送代理')
    ap.add_argument('--model', default='nai-diffusion-4-5-full')
    ap.add_argument('--steps', type=int, default=28)
    ap.add_argument('--scale', type=float, default=5)
    ap.add_argument('--sampler', default='k_euler_ancestral')
    ap.add_argument('--safe', action='store_true', help='不加成人向的加料')
    args = ap.parse_args()
    if not args.token:
        raise SystemExit('沒有金鑰：設定環境變數 NOVELAI_TOKEN 或用 --token')

    style, scenes = load_scenes(args)
    todo = jobs(args, scenes, 'novelai')
    for done, (scene, n) in enumerate(todo, 1):
        prompt = tag_prompt(style, scene, args.safe)
        seed = seed_for(args, n)
        raw = request(args.url.rstrip('/') + '/ai/generate-image', args.token,
                      body(args.model, prompt, style['negative'], seed, args.width, args.height, args.steps, args.scale, args.sampler))
        # 回傳的是 ZIP（裡面是 PNG）；有些代理直接回傳圖片
        if raw[:2] == b'PK':
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                raw = z.read(z.namelist()[0])
        target = save(args, scene, 'novelai', n, raw, {'prompt': prompt, 'negative': style['negative'], 'seed': seed, 'model': args.model})
        print(f'[{done}/{len(todo)}] {scene["key"]} → {target}')
        time.sleep(1)


if __name__ == '__main__':
    main()
