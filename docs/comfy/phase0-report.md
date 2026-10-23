# 像素素材管線 — 第 0 階段盤點回報

本機 ComfyUI 端的環境盤點、LoRA 選型、素材包調查，以及一次實機煙霧測試的結果。
供雲端 session 規劃工作流程與後處理腳本時參考。

**最重要一條**：煙霧測試證實 pixel LoRA 只給「像素風格」，不給「像素資料」——
產出有 12 萬種顏色、零塊狀結構。**後處理不是可選項，是必要步驟。** 細節見 §5。

---

## 1. ComfyUI 環境

| 項目 | 值 |
|---|---|
| ComfyUI | `0.22.0`（portable，embedded Python 3.12.10） |
| frontend | 1.44.19 |
| 服務位址 | `http://127.0.0.1:8188` |
| 啟動參數 | `--windows-standalone-build --fast fp16_accumulation --enable-cors-header` |
| GPU | RTX 5070 Ti，VRAM 17.07 GB（可用約 15.8 GB） |
| torch | 2.11.0+cu128 |
| 系統 RAM | 33 GB |

**實測效能：1024×1024 / 24 steps / cfg 6.0 = 30 秒一張。**
排程請用這個數字估算：80～100 個圖示 × 6 候選 ≈ 600 張 ≈ 5 小時。

### 1.1 關鍵架構發現 — Anima 走 Qwen 架構

主力生成流程**不是** `CheckpointLoaderSimple`，而是三件組：

```
UNETLoader   : anima_aestheticV11.safetensors   (weight_dtype "default")
CLIPLoader   : qwen_3_06b_base.safetensors      (type "stable_diffusion")
VAELoader    : qwen_image_vae.safetensors
```

**Anima 系的 workflow JSON 必須照這個組法**，用 `CheckpointLoaderSimple` 會載不起來。
Illustrious 系才是傳統 checkpoint 單節點載法。

可用的 Anima UNET：`anima_aestheticV11`、`anima_baseV10`、`miaomiaoHarem_anima14`。
另有多個 Illustrious / SDXL 系 checkpoint 可選。

### 1.2 LoRA 路徑格式

LoRA 分兩個子資料夾：`ANI\`（Anima 系）與 `IL\`（Illustrious 系）。
**JSON 裡的路徑字串必須含子資料夾前綴**：

```json
"lora_name": "ANI\\pixel-AnimaB_V10-V1-CAME.safetensors"
```

### 1.3 其他可用資源

- **ControlNet**：`OpenPoseXL2.safetensors`（SDXL 版）、`control_sd15_openpose`、`control_sd15_normal`
- **Upscale**：`4x-AnimeSharp`、`4xUltrasharpV10`
- **VAE**：`sdxl_vae`、`qwen_image_vae`、`wan_2.1_vae`、`wan2.2_vae`

### 1.4 自訂節點 — 沒有像素化節點

已安裝 18 個 custom nodes（ComfyUI-Manager、Impact-Pack / Subpack、kjnodes、rgthree、
easy-use、Crystools、florence2、GGUF、lora-manager、neuralbooru、videohelpersuite、
frame-interpolation、WanStartEndFramesNative、save-image-extended、weilin ×2、prompt-all-in-one）。

**其中沒有任何像素化節點**（無 ComfyUI_essentials、無 Pixelization、無 WAS Node Suite）。

但 embedded Python 已有 Pillow + numpy，腳本可直接用內建直譯器執行：

```
python_embeded\python.exe -I your_script.py
```

> **因此：像素化／減色／去背／拆層請全部寫在 Python 腳本側，不要依賴 ComfyUI 節點。**
> 這樣本機端不需要安裝任何東西。

---

## 2. 像素風 LoRA — 已選定並安裝

來源：<https://civitai.com/models/1648877>（Pixel | Anima | Illustrious Style LoRA）

| 路徑 | 底模 | 架構 | 大小 | 觸發詞 |
|---|---|---|---|---|
| `ANI\pixel-AnimaB_V10-V1-CAME.safetensors` | anima-base-v1.0 | `anima-preview/lora` | 16.7 MB | `pixel art`, `pix_merge` |
| `IL\eXV6dXRhcm91MDAxMQ==-illustriousXL_v01_V1-CAME_1.safetensors` | illustriousXL_v01 | `stable-diffusion-xl-v1-base/lora` | 338.9 MB | `eXV6_dXRhcm`, `pixel art` |

**兩者不可互換底模。** Anima 版的 text encoder 鍵為 `lora_te_layers_*`（單 TE 架構），
Illustrious 版為 `lora_te1_*`（SDXL 雙 TE）。放錯底模會直接失效，不是「效果差一點」。

- network_dim / alpha：Anima 版 4 / 1.0；Illustrious 版 24 / 24.0

### 2.1 授權

```
allowCommercialUse  : [Image, Sell, Rent, RentCivit, SellMerge]
allowDerivatives    : true
allowDifferentLicense: true
allowNoCredit       : false   ← 標註作者是義務
```

**必須在 CREDITS 註明作者並指向上述 model 頁。**
畫風通用，不綁特定遊戲 IP。

> Civitai 的授權欄位是作者自行宣告，不是法律保證。
> 底模授權會疊加（Illustrious XL 走 Fair AI Public License 1.0-SD），
> 但本專案只散布產出的 PNG、不散布模型本身，因此沒有問題。

### 2.2 其他候選（未採用，備查）

| LoRA | 連結 | 不採用原因 |
|---|---|---|
| Retro Game (CPS II) | <https://civitai.com/models/620687> | 授權寬鬆，但畫風是 Capcom 格鬥電玩，不合 HD-2D 日式奇幻 |
| Pixel Art Sprite - Elin | <https://civitai.com/models/1084875> | 直接訓練自《Elin》官方 sprite，產出高度重現原作，開源再散布風險高 |
| Ragnarok Online Sprite | <https://civitai.com/models/1242746> | 同上，訓練自《仙境傳說》官方 sprite |
| creativehotia Pixel Art XL | <https://civitai.com/models/43820> | `allowDerivatives: false`，限制最多且無優勢 |

Elin 與 Ragnarok 兩者授權為 `[Image, RentCivit]`，**生成圖本身可商用**，
模型不可再散布（本專案也只散布 PNG）。純技術上可用，但 IP 重現風險高，不建議。

---

## 3. 模組化像素動漫立繪素材包 — 查無可用者

itch.io 與 OpenGameArt 均已查過。結論：
**同時滿足「動漫風 ＋ 分部件圖層 ＋ CC0/CC BY ＋ 可商用再散布」的素材包不存在。**

| 素材包 | 連結 | 規格 | 不可用原因 |
|---|---|---|---|
| Swappable Portraits (64×64 - Layers) | <https://lofi-kier.itch.io/swappable-portraits> | 64×64，8 層（accessory / hair / clothes / eyes / face / shade / body / background），10 女 10 男 preset，160+ 件 | $10，且授權**明文禁止 redistribute / resell** |
| Swappable Chibi Portraits | <https://lofi-kier.itch.io/swappable-chibi-portraits-64x64-layers> | 64×64，層更細（extra / blush / eyebrow / eyes / mouth / hair / clothes / head / torso / bg），13 preset | 同作者同授權，不可再散布 |
| 64px portraits | <https://opengameart.org/content/64px-portraits> | 64×64，動漫 tag | CC-BY 4.0 可用，**但沒有分圖層** |
| Character portrait kit | <https://opengameart.org/content/character-portrait-kit> | 64×64，有頭／髮分件 | CC-BY，**西幻風非動漫風** |
| 64x64 Portrait (Nila122) | <https://opengameart.org/content/64x64-portrait> | 64×64，有 hair / eyes / brow / mouth 分件 | **CC-BY-SA 3.0（傳染性 copyleft）**，且非動漫風 |
| Kenney Modular character pack | <https://opengameart.org/content/modular-character-pack> | CC0 | 非 64×64 像素頭像，風格完全不合 |

**建議**：第 3 類（模組化立繪）全部自行生成。
即使找到授權乾淨的包，畫風也對不上 HD-2D 日式奇幻，混用會突兀。

不過 **Swappable Portraits 的圖層切分方式值得照抄當規格參考** —— 它那 8～10 層的拆法很合理，
可直接作為本專案的圖層定義基礎。

---

## 4. 畫風參考規格

> 風格參考圖為第三方同人像素作品，僅留在本機作為對照，**不納入版本控制、不用於訓練**。
> 以下為從中萃取的規格，供實作依循。

### 4.1 構圖

典型角色設定表包含三部分：全身站姿立繪、**5 格表情胸像**（2×2＋1 排列）、Q 版 chibi。
表情胸像外框為**土金色實心背景**（非透明）—— 與 UI 的金框方向一致。

### 4.2 配色（關鍵規格）

- 整體高明度、低彩度、柔和粉彩調
- **每個材質約 3～4 階色階**：亮面／中間調／暗面／輪廓線
- **輪廓線不是純黑，而是該材質本身的深色調**（selective outlining）

> ⭐ **這點直接決定「灰階底材 ＋ 執行時換色」的實作方式**：
> 換色腳本必須處理 **4 階色階映射**，不能只做單色 tint，否則會失去此畫風的質感。

### 4.3 五官與表情

- 眼睛約 3～4 px 高，用 2 階色
- 眉毛／嘴巴各 1～2 px
- 表情變化僅靠**少數幾個 pixel**（微笑／流淚／生氣＋紅十字青筋／閉眼）

> 這代表**表情差分可用極小的 patch 疊加實作**，不需要整張重畫。

### 4.4 描邊

角色整體外圍有**一圈白色描邊**，使角色從深色背景中跳出。
與 UI 的深色皮革底正好搭配，**建議列為硬性規格**。

### 4.5 尺寸

從胸像框比例推估，**原生胸像約 48～64 px**，與 64×64 的目標一致。

---

## 5. 煙霧測試結果

### 5.1 測試條件

```
UNETLoader anima_aestheticV11
  -> LoraLoader  ANI\pixel-AnimaB_V10-V1-CAME.safetensors  @ 1.0

positive: "pixel art, pix_merge, 1girl, solo, elf, pointy ears, long silver hair,
           white and gold robe, holding staff, upper body, portrait,
           simple background, limited palette"
negative: "lowres, blurry, jpeg artifacts, text, signature, watermark, username,
           bad anatomy, worst quality, low quality, realistic, 3d,
           smooth shading, anti-aliasing"

1024×1024 / 24 steps / cfg 6.0 / euler_ancestral / normal / denoise 1.0
```

**結果：成功，30.1 秒。**

### 5.2 視覺評估

畫風方向正確 ✅ —— 限制調色盤、硬邊、平塗、深色描線，確實是像素風外觀。

### 5.3 量測結果（關鍵）

對產出 PNG 做實際像素資料量測：

```
unique colors  : 122,810
col run-length : 全部為 1（零塊狀結構）
```

> ### ⚠️ LoRA 給的是像素「風格」，不是像素「資料」
>
> 產出佈滿抗鋸齒與漸層。
> **降採樣 ＋ 減色不是可選的優化，而是產出可用素材的必要步驟。**
> 後處理腳本是整條管線的關鍵環節，不是收尾裝飾。

### 5.4 其他觀察

- **框太近**：`upper body, portrait` 仍給出大頭特寫。要做 64×64 胸像需更強制拉遠，
  可能要加 `chibi` 或改用 `full body` 再裁切
- **像素顆粒太細**：視覺上接近 256 px 網格。單靠 prompt 壓不出 64 px 的粗顆粒，
  **最終網格一定得由後處理降採樣決定**

---

## 6. 三項技術現實

### 6.1 無法直接產出乾淨的 32×32 圖示

已由 §5 實測證實。可行路線：

```
1024×1024 生成  →  腳本降採樣  →  減色  →  32×32
```

另外 32×32 的語意空間太小，模型常畫出辨識不出的東西。
**建議每個圖示生 4～8 張候選供人工挑選。**

### 6.2 ⚠️ 模型完全無法輸出分圖層 PNG —— 待決策

第 3 類「每個部件一層」無法靠單次生成取得。兩條路線：

**(A) 生完整胸像 → 腳本按區域切（髮／臉／身體）**
- 交界處會醜
- **換髮型根本做不到**（髮型一換，頭部輪廓就對不上）

**(B) 每個部件各自生成（例如只生頭髮、平塗背景）→ 去背抽出**
- 能達成真正的模組化
- **但必須先定義一個固定的頭部基準框（錨點）**，否則部件疊起來會對不準

> **建議採 (B)**，並且第一步先產出一個「基準頭型」，作為所有部件的對位基準。
>
> **這是第 3 類開工前的唯一阻塞項。** 走 A 或 B 會完全改變 prompt 設計與生成張數。

### 6.3 底材調色盤建議

「灰階底材 ＋ 執行時換色」配合 §4.2 的 4 階色階，建議：

- 底材**不要用連續灰階**，改用**固定的 4 階索引色**，例如
  `#FFFFFF` / `#AAAAAA` / `#555555` / `#000000`
- 換色時直接查表，映射到目標色的 4 階

這比 HSL tint 乾淨得多，也不會糊掉輪廓。
**減色腳本與換色邏輯應共用同一張調色盤定義。**

---

## 7. 分工與下一步

### 本機 ComfyUI 端 — ready

- ComfyUI 線上（`127.0.0.1:8188`）
- 兩個 pixel LoRA 已安裝並驗證（safetensors header 已核對身分）
- Anima 三件組 workflow 已實機驗證可跑
- 本倉庫可推送至 `claude/comfy-assets` 分支

### 待雲端 session 提供

1. **§6.2 的決策：模組化分層走 (A) 還是 (B)** —— 此題未決，第 3 類無法開工
2. **後處理腳本**：降採樣 / 4 階減色 / 去背 / 拆層（純 Python + Pillow + numpy）
3. **workflow JSON 框架** —— Anima 系務必使用
   `UNETLoader` + `CLIPLoader(qwen_3_06b_base)` + `VAELoader(qwen_image_vae)` 三件組，
   LoRA 路徑含 `ANI\` / `IL\` 前綴（參見 `anima-pixel-template.json`）

### 可平行進行

**第 1 類（物品圖示）不受 §6.2 決策影響。**
只要提供圖示清單（80～100 個名稱 ＋ 每個的 prompt 關鍵詞），本機端即可開始批次生成候選。
