"""用本機的 ComfyUI 生成背景圖候選（Danbooru 標籤，含成人向的加料；--safe 拿掉）。

組工作流程的方式和遊戲的 ComfyUI 設定組合一樣（src/narrator/comfy.ts 的 buildWorkflow），三種模式：
  Checkpoint：一個檔案包含模型、文字編碼器、VAE（SDXL、Illustrious、Pony……）
      python -I tools/backgrounds/generate_comfy.py --checkpoint waiIllustriousSDXL_v150.safetensors
  UNet：模型、文字編碼器、VAE 分開載入（Anima、Flux、Qwen-Image……）
      python -I tools/backgrounds/generate_comfy.py --unet anima_aestheticV11.safetensors \\
          --clip qwen_3_06b_base.safetensors --clip-type stable_diffusion --vae qwen_image_vae.safetensors
  自訂工作流程：API 格式的 JSON，代號 %prompt% %negative% %width% %height% %seed% %steps% %scale% %sampler% %scheduler% %model%
      python -I tools/backgrounds/generate_comfy.py --workflow my_workflow_api.json
也可以用 --preset 讀一個 JSON（欄位和遊戲的設定組合相同：mode、checkpoint、unet、clips、clipType、vae、loras、
steps、cfg、sampler、scheduler、prefix、negative、hires、workflow、outputNode），命令列的參數再蓋過去。
LoRA：--lora 名稱:權重（可以寫好幾次）。ComfyUI portable 內建的 Python 就能跑，不需要安裝任何節點。
"""

import json
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from common import base_args, jobs, load_scenes, save, seed_for, tag_prompt


def call(server, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(server + path, data=data, headers={'Content-Type': 'application/json'} if data else {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def fill(workflow, values):
    """把代號換成值：整個字串就是代號時換成原本的型別，字串裡夾著代號時做文字取代（同 comfy.ts 的 fillWorkflow）"""
    import re

    def walk(v):
        if isinstance(v, str):
            m = re.fullmatch(r'%(\w+)%', v)
            if m and m.group(1) in values:
                return values[m.group(1)]
            return re.sub(r'%(\w+)%', lambda x: str(values[x.group(1)]) if x.group(1) in values else x.group(0), v)
        if isinstance(v, list):
            return [walk(x) for x in v]
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        return v
    out = walk(workflow)
    if isinstance(out, dict) and isinstance(out.get('nodes'), list):
        raise SystemExit('這是 ComfyUI 一般格式的工作流程：請用選單的「Export (API)」匯出 API 格式')
    return out


def build(p, prompt, negative, seed, width, height):
    """依設定組合組出工作流程（同 comfy.ts 的 buildWorkflow，不含以圖生圖）"""
    prefix = p.get('prefix', '').strip().rstrip(', ')
    prompt = f'{prefix}, {prompt}' if prefix else prompt
    if p['mode'] == 'custom':
        return fill(p['workflow'], {'prompt': prompt, 'negative': negative, 'width': width, 'height': height, 'seed': seed, 'steps': p['steps'],
                                    'scale': p['cfg'], 'sampler': p['sampler'], 'scheduler': p['scheduler'], 'model': p.get('checkpoint') or p.get('unet', '')})
    wf = {}

    def add(cls, inputs, title=None):
        i = str(len(wf) + 1)
        wf[i] = {'class_type': cls, 'inputs': inputs, **({'_meta': {'title': title}} if title else {})}
        return i
    if p['mode'] == 'checkpoint':
        ck = add('CheckpointLoaderSimple', {'ckpt_name': p['checkpoint']})
        model, clip, vae = [ck, 0], [ck, 1], [ck, 2]
    else:
        model = [add('UNETLoader', {'unet_name': p['unet'], 'weight_dtype': p.get('weightDtype') or 'default'}), 0]
        clips = [c for c in p.get('clips', []) if c.strip()]
        if len(clips) >= 3:
            loader = add('TripleCLIPLoader', {'clip_name1': clips[0], 'clip_name2': clips[1], 'clip_name3': clips[2]})
        elif len(clips) == 2:
            loader = add('DualCLIPLoader', {'clip_name1': clips[0], 'clip_name2': clips[1], 'type': p.get('clipType', '')})
        else:
            loader = add('CLIPLoader', {'clip_name': clips[0] if clips else '', 'type': p.get('clipType', '')})
        clip = [loader, 0]
        vae = [add('VAELoader', {'vae_name': p.get('vae', '')}), 0]
    if p['mode'] == 'checkpoint' and p.get('vae', '').strip():
        vae = [add('VAELoader', {'vae_name': p['vae']}), 0]
    for l in p.get('loras', []):
        if not l.get('on', True) or not l.get('name', '').strip():
            continue
        i = add('LoraLoader', {'lora_name': l['name'], 'strength_model': l.get('strength', 1), 'strength_clip': l.get('clip', l.get('strength', 1)), 'model': model, 'clip': clip})
        model, clip = [i, 0], [i, 1]
    pos = [add('CLIPTextEncode', {'text': prompt, 'clip': clip}, '正向'), 0]
    neg = [add('CLIPTextEncode', {'text': negative, 'clip': clip}, '反向'), 0]
    latent = [add('EmptyLatentImage', {'width': width, 'height': height, 'batch_size': 1}), 0]
    sampler = {'seed': seed, 'sampler_name': p['sampler'], 'scheduler': p['scheduler'], 'model': model, 'positive': pos, 'negative': neg}
    samples = add('KSampler', {**sampler, 'steps': p['steps'], 'cfg': p['cfg'], 'denoise': 1, 'latent_image': latent})
    h = p.get('hires') or {}
    if h.get('on'):
        up = add('LatentUpscaleBy', {'upscale_method': h.get('method', 'bicubic'), 'scale_by': h.get('scale', 1.5), 'samples': [samples, 0]})
        samples = add('KSampler', {**sampler, 'steps': h.get('steps', 15), 'cfg': h.get('cfg', p['cfg']), 'denoise': h.get('denoise', 0.5), 'latent_image': [up, 0]}, '高解析修復')
    image = add('VAEDecode', {'samples': [samples, 0], 'vae': vae})
    add('SaveImage', {'filename_prefix': 'elondia_bg', 'images': [image, 0]})
    return wf


def wait(server, prompt_id, output_node='', timeout=900):
    start = time.time()
    while time.time() - start < timeout:
        hist = json.loads(call(server, f'/history/{prompt_id}'))
        if prompt_id in hist:
            entry = hist[prompt_id]
            if entry.get('status', {}).get('status_str') == 'error':
                raise RuntimeError(json.dumps(entry['status'], ensure_ascii=False)[:500])
            outputs = entry.get('outputs', {})
            nodes = [output_node] if output_node in outputs else list(outputs)
            for k in nodes:
                if outputs[k].get('images'):
                    return outputs[k]['images'][0]
        time.sleep(1.5)
    raise TimeoutError(prompt_id)


def main():
    ap = base_args(__doc__.split('\n')[0], 1344, 768)
    ap.add_argument('--server', default='http://127.0.0.1:8188')
    ap.add_argument('--preset', help='設定組合的 JSON（欄位同遊戲的 ComfyUI 設定組合）')
    ap.add_argument('--checkpoint', help='Checkpoint 模式的模型檔')
    ap.add_argument('--unet', help='UNet 模式的模型檔')
    ap.add_argument('--clip', action='append', default=[], help='UNet 模式的文字編碼器（1～3 個）')
    ap.add_argument('--clip-type', default=None, help='文字編碼器的類型（例如 stable_diffusion、flux、qwen_image）')
    ap.add_argument('--vae', default=None)
    ap.add_argument('--workflow', help='自訂工作流程（API 格式 JSON 檔，用代號）')
    ap.add_argument('--output-node', default='', help='自訂工作流程從哪個節點拿圖（空白時自動挑）')
    ap.add_argument('--lora', action='append', default=[], help='名稱:權重，例如 ANI\\\\pink-neon.safetensors:0.7')
    ap.add_argument('--steps', type=int)
    ap.add_argument('--cfg', type=float)
    ap.add_argument('--sampler')
    ap.add_argument('--scheduler')
    ap.add_argument('--prefix', help='接在提示詞前面的固定標籤（品質、畫風、LoRA 觸發詞）')
    ap.add_argument('--hires', type=float, default=0, help='高解析修復的放大倍率（例如 1.5；0 是不做）')
    ap.add_argument('--safe', action='store_true', help='不加成人向的加料')
    args = ap.parse_args()

    p = {'mode': 'checkpoint', 'checkpoint': '', 'unet': '', 'clips': [], 'clipType': '', 'vae': '', 'loras': [], 'steps': 28, 'cfg': 6,
         'sampler': 'euler_ancestral', 'scheduler': 'normal', 'prefix': '', 'negative': '', 'hires': {}, 'workflow': None, 'outputNode': ''}
    if args.preset:
        p.update(json.loads(Path(args.preset).read_text(encoding='utf-8')))
        if isinstance(p.get('workflow'), str) and p['mode'] == 'custom':
            p['workflow'] = json.loads(p['workflow'])
    if args.workflow:
        p['mode'], p['workflow'] = 'custom', json.loads(Path(args.workflow).read_text(encoding='utf-8'))
    elif args.unet:
        p.update(mode='unet', unet=args.unet)
    elif args.checkpoint:
        p.update(mode='checkpoint', checkpoint=args.checkpoint)
    if args.clip:
        p['clips'] = args.clip
    for k, v in (('clipType', args.clip_type), ('vae', args.vae), ('steps', args.steps), ('cfg', args.cfg), ('sampler', args.sampler),
                 ('scheduler', args.scheduler), ('prefix', args.prefix), ('outputNode', args.output_node or None)):
        if v is not None:
            p[k] = v
    for l in args.lora:
        name, _, w = l.rpartition(':')
        p['loras'].append({'name': name or l, 'strength': float(w) if name else 1.0, 'on': True})
    if args.hires:
        p['hires'] = {'on': True, 'scale': args.hires, 'method': 'bicubic', 'steps': 15, 'cfg': p['cfg'], 'denoise': 0.5}
    if p['mode'] == 'checkpoint' and not p['checkpoint'] or p['mode'] == 'unet' and not p['unet'] or p['mode'] == 'custom' and not p['workflow']:
        raise SystemExit('要指定 --checkpoint、--unet、--workflow 或 --preset 其中一種')

    style, scenes = load_scenes(args)
    negative = p.get('negative') or style['negative']
    client = str(uuid.uuid4())
    todo = jobs(args, scenes, 'comfy')
    for done, (scene, n) in enumerate(todo, 1):
        prompt = tag_prompt(style, scene, args.safe)
        seed = seed_for(args, n)
        wf = build(p, prompt, negative, seed, args.width, args.height)
        res = json.loads(call(args.server, '/prompt', {'prompt': wf, 'client_id': client}))
        img = wait(args.server, res['prompt_id'], p.get('outputNode') or '')
        q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img.get('subfolder', ''), 'type': img.get('type', 'output')})
        target = save(args, scene, 'comfy', n, call(args.server, f'/view?{q}'), {'prompt': prompt, 'negative': negative, 'seed': seed, 'mode': p['mode']})
        print(f'[{done}/{len(todo)}] {scene["key"]} → {target}')


if __name__ == '__main__':
    main()
