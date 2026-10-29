"""用 ChatGPT 的圖片 API（OpenAI /images/generations）生成背景圖候選。只用句子描述、不含成人內容（OpenAI 的使用政策不允許）。

金鑰放在環境變數 OPENAI_API_KEY（或 --key）：
    python -I tools/backgrounds/generate_openai.py --count 2
預設 gpt-image-1、1536×1024、quality high；之後用 finalize.py 裁成 16:9 的 1536×864。
也可以用 --base-url 換成相容的服務（例如 OpenRouter 的相容端點），請求的格式和遊戲的 OpenAI 服務相同。
"""

import base64
import json
import os
import time
import urllib.error
import urllib.request

from common import base_args, jobs, load_scenes, save, text_prompt


def main():
    ap = base_args(__doc__.split('\n')[0], 1536, 1024)
    ap.add_argument('--key', default=os.environ.get('OPENAI_API_KEY', ''))
    ap.add_argument('--base-url', default='https://api.openai.com/v1')
    ap.add_argument('--model', default='gpt-image-1')
    ap.add_argument('--quality', default='high', help='low、medium、high、auto')
    args = ap.parse_args()
    if not args.key:
        raise SystemExit('沒有金鑰：設定環境變數 OPENAI_API_KEY 或用 --key')

    style, scenes = load_scenes(args)
    todo = jobs(args, scenes, 'openai')
    for done, (scene, n) in enumerate(todo, 1):
        prompt = text_prompt(style, scene)
        payload = {'model': args.model, 'prompt': prompt, 'size': f'{args.width}x{args.height}', 'quality': args.quality, 'n': 1}
        req = urllib.request.Request(args.base_url.rstrip('/') + '/images/generations', data=json.dumps(payload).encode(),
                                     headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {args.key}'})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())
        except urllib.error.HTTPError as e:
            raise SystemExit(f'OpenAI 回應 {e.code}：{e.read().decode(errors="replace")[:300]}')
        first = (data.get('data') or [{}])[0]
        if first.get('b64_json'):
            raw = base64.b64decode(first['b64_json'])
        elif first.get('url'):
            with urllib.request.urlopen(first['url'], timeout=120) as r:
                raw = r.read()
        else:
            raise SystemExit('OpenAI 沒有回傳圖片')
        target = save(args, scene, 'openai', n, raw, {'prompt': prompt, 'model': args.model})
        print(f'[{done}/{len(todo)}] {scene["key"]} → {target}')
        time.sleep(1)


if __name__ == '__main__':
    main()
