"""從 park_scenes.json 產生 park_prompts.md（每個場景的完整提示詞，方便直接貼到 ComfyUI、NovelAI、ChatGPT 的網頁介面）。"""

import json
from pathlib import Path

from common import HERE, tag_prompt, text_prompt

spec = json.loads((HERE / 'park_scenes.json').read_text(encoding='utf-8'))
style = spec['style']
lines = ['# 緋夢樂園的背景圖提示詞', '', '> 由 `prompts_md.py` 從 `park_scenes.json` 產生，不要手改。檔名（key）照 `src/assets/backgrounds/README.md`。', '',
         '共用的負面提示詞（ComfyUI、NovelAI）：', '', '```', style['negative'], '```', '']
for s in spec['scenes']:
    lines += [f'## {s["name"]}（`{s["key"]}`）', '',
              '**ComfyUI、NovelAI（成人向）**', '', '```', tag_prompt(style, s), '```', '',
              '**ComfyUI、NovelAI（一般）**', '', '```', tag_prompt(style, s, safe=True), '```', '',
              '**ChatGPT（不含成人內容）**', '', '```', text_prompt(style, s), '```', '']
(HERE / 'park_prompts.md').write_text('\n'.join(lines), encoding='utf-8')
print(f'{len(spec["scenes"])} 個場景 → park_prompts.md')
