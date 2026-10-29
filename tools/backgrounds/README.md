# 背景圖的生圖腳本

整頁背景圖（`docs/BACKGROUNDS.md`、`src/assets/backgrounds/README.md`）的提示詞與生圖腳本。目前收的是緋夢樂園（`docs/LUST_PARK.md`）的 16 個場景：入口廣場與五個園區的淺層、中層、深層。腳本只用 Python 標準函式庫（`finalize.py` 要 Pillow），ComfyUI portable 內建的 Python 就能跑。

| 檔案 | 用途 |
|---|---|
| `park_scenes.json` | 場景清單：key（就是背景圖的檔名）、Danbooru 標籤（`tags`）、成人向的加料（`adult`）、給 ChatGPT 的句子（`text`），共用畫風在 `style` |
| `park_prompts.md` | 每個場景組好的完整提示詞（`prompts_md.py` 產生），可以直接貼到各家的網頁介面 |
| `generate_comfy.py` | 本機的 ComfyUI：Checkpoint、UNet、自訂工作流程三種模式，和遊戲的 ComfyUI 設定組合一樣（`src/narrator/comfy.ts`） |
| `generate_novelai.py` | NovelAI（`NOVELAI_TOKEN`），請求格式和遊戲的 NovelAI 服務一樣 |
| `generate_openai.py` | ChatGPT 的圖片 API（`OPENAI_API_KEY`，`gpt-image-1`）：只用句子、**不含成人內容** |
| `finalize.py` | 排候選的總覽圖、把挑中的裁成 16:9 的 1536×864 webp，放進 `src/assets/backgrounds/` |

## 流程

1. 生候選（每個場景預設 4 張，存在 `raw/<key>/<服務>-c<n>.png`，已經有的跳過，可以中斷後重跑）：

   ```
   :: ComfyUI（Windows、ComfyUI portable 的資料夾）
   python_embeded\python.exe -I <repo>\tools\backgrounds\generate_comfy.py --checkpoint waiIllustriousSDXL_v150.safetensors
   python_embeded\python.exe -I <repo>\tools\backgrounds\generate_comfy.py --unet anima_aestheticV11.safetensors --clip qwen_3_06b_base.safetensors --clip-type stable_diffusion --vae qwen_image_vae.safetensors
   python_embeded\python.exe -I <repo>\tools\backgrounds\generate_comfy.py --workflow my_workflow_api.json
   ```

   ```
   python3 -I tools/backgrounds/generate_novelai.py --count 2
   python3 -I tools/backgrounds/generate_openai.py --count 2
   ```

   共用參數：`--only key1,key2`（只跑這幾個場景）、`--count`、`--width`、`--height`、`--seed`。ComfyUI 與 NovelAI 加 `--safe` 不加成人向的加料。ComfyUI 另外有 `--lora 名稱:權重`（可以寫好幾次）、`--steps`、`--cfg`、`--sampler`、`--scheduler`、`--prefix`（品質、畫風、LoRA 觸發詞）、`--hires 1.5`（高解析修復）、`--server`；`--preset 檔案.json` 讀一組設定（欄位和遊戲的 ComfyUI 設定組合相同），命令列的參數再蓋過去。自訂工作流程用遊戲一樣的代號：`%prompt%` `%negative%` `%width%` `%height%` `%seed%` `%steps%` `%scale%` `%sampler%` `%scheduler%` `%model%`。
2. `python tools/backgrounds/finalize.py --sheets` 在 `raw/sheet-<key>.jpg` 排出候選，挑好寫進 `picks.json`（例如 `{"park_beast-deep": "comfy-c2"}`）。
3. `python tools/backgrounds/finalize.py --picks tools/backgrounds/picks.json`：裁成 16:9、縮成 1536×864、存成 `src/assets/backgrounds/<key>.webp`（每張 500 KB 以內為佳，太大就降 `--quality`）。放進去之後遊戲自動用上。

- 預設尺寸：ComfyUI、NovelAI 1344×768（SDXL 系常用的 16:9，NovelAI 一百萬像素以內）；ChatGPT 1536×1024。都由 `finalize.py` 置中裁切。
- 背景圖不放人物（`no humans`），主體偏一側、畫面中間低對比，讓介面的面板蓋在上面也看得清楚。
- 改了 `park_scenes.json` 之後重跑 `python3 tools/backgrounds/prompts_md.py` 更新 `park_prompts.md`。
