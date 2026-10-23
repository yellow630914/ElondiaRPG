# 角色形象插圖

> 上層：[GAME_DESIGN](GAME_DESIGN.md)。依賴：[PROMPTS](PROMPTS.md)（預處理用的模型來源與功能分配）、[SAVES](SAVES.md)（匯出、匯入、清理）。
> 程式：`src/narrator/imageInfo.ts`（服務模板、提示詞、預處理指示）、`src/narrator/imageProviders.ts`（送出請求）、`src/stores/image.ts`（設定）、`src/stores/portraits.ts`（保存與生成）、`src/components/ImageSettings.vue`、`src/components/PortraitBox.vue`。

隊伍視窗的每位成員、人際關係裡登場過的人都有一格形象圖：可以「🎨 生成形象圖」、「📁 上傳」自己的圖片、刪除，點圖片放大。

## 1. 設定（⚙️ 設定 → 🎨 插圖生成）

API key 與參數只存在這個瀏覽器（localStorage 的 `elondia.image`），請求直接從瀏覽器送往選擇的服務。每個服務各自保存設定，切換服務不會弄丟 key。

| 模板 | 請求 | 預設 | 注意 |
|---|---|---|---|
| ChatGPT（OpenAI 圖片 API） | `POST {網址}/images/generations`，回傳 base64 或網址 | `gpt-image-1`、1024 × 1536 | 看得懂一般句子；不支援負面提示詞；也可以填相容的服務網址 |
| NovelAI | `POST {網址}/ai/generate-image`，回傳 ZIP（裡面是 PNG） | `nai-diffusion-4-5-full`、832 × 1216、28 步、CFG 5、`k_euler_ancestral` | key 是 Persistent API Token；只看得懂 Danbooru 標籤（預設用「Danbooru 標籤」預處理）；瀏覽器被擋（CORS）時換成自己的轉送代理 |
| ComfyUI（自架） | `POST {網址}/prompt` 送出工作流程 → 輪詢 `/history/{id}` → `GET /view` 下載 | `http://127.0.0.1:8188`、832 × 1216 | 啟動時加 `--enable-cors-header`；模型與參數放在「設定組合」，見下方第 5 節 |

- **參數**：尺寸、步數、CFG、取樣器、負面提示詞（OpenAI 以外）。**額外參數**是一個 JSON 物件，合併進請求（NovelAI 合併進 `parameters`），例如 OpenAI 的 `{"quality": "high"}`。
- **ComfyUI**：每個主模存成一組設定（設定組合），見第 5 節。

## 2. 提示詞

**形象插圖的提示詞模板**（可以修改、恢復預設）把角色的資料填進去：`{name}` `{gender}` `{race}` `{role}`（職業或身分）`{level}` `{appearance}` `{personality}` `{background}` `{gear}`（身上的裝備）`{tattoos}`（刺青與印記：部位、名稱與外觀）`{style}`（畫風）。代號的值是空的那一行整行拿掉。預設模板是英文的框架（單人、上半身、面向觀眾、簡單背景、不要文字與浮水印），角色的外貌等描述照原文填入。

## 3. 生圖提示詞預處理

不同的生圖模型吃的提示詞格式不一樣：NovelAI 與動漫風格的 Stable Diffusion 模型只看得懂 Danbooru 標籤，有些模型或自架的工作流程要英文句子或 JSON。「生圖提示詞預處理」在送出前請大語言模型依一份**預處理指示**改寫描述。每個生圖服務各自選用哪一份（`elondia.image` 的 `preprocess`；NovelAI 與 ComfyUI 預設「Danbooru 標籤」，ChatGPT 預設不預處理）：

1. 依模板組成語意描述。
2. 交給大語言模型（「🔀 功能分配」的「插圖提示詞預處理」用哪個模型來源）：system 是選的指示，user 是角色形象描述。沒有開啟成人向時，指示後面另外加上「不要加入裸露、性暗示或血腥的內容」。
3. 依指示的**整理方式**處理回答：
   - **整理成標籤**：拿掉程式碼框與「Tags:」之類的說明、換行改逗號、去掉重複。
   - **原樣送出**：只拿掉程式碼框（適合英文句子、JSON）。
4. **結果直接送給生圖服務**，不再套用提示詞模板與畫風。

### 預處理指示

| 內建 | 整理方式 | 內容 |
|---|---|---|
| Danbooru 標籤 | 整理成標籤 | 一行英文標籤，依「人數與性別 → 外貌 → 服裝 → 表情姿勢 → 構圖 → 背景 → 畫質」排列，20～40 個 |
| 英文自然語言描述 | 原樣送出 | 一段 60～120 字的英文描述（主體 → 外貌、服裝 → 表情姿勢 → 構圖、光線、背景），給 DALL·E、Flux、寫實模型 |
| JSON 結構化 | 原樣送出 | 一個 JSON 物件：`subject` `appearance` `outfit` `expression` `pose` `composition` `background` `style` `quality` |

- 內建的指示不能修改；「📋 複製成自訂」複製一份再改。「＋ 新增預處理指示」建立空白的一份。自訂的指示有名稱、整理方式與指示內容，存在 `elondia.image` 的 `preprocessors`。
- 刪除自訂的指示時，用它的服務改成不預處理。
- 舊版的「先轉成 Danbooru 標籤」勾選自動換成「Danbooru 標籤」；改過的轉換指示變成一份自訂的「Danbooru 標籤（自訂）」。

預處理的 token 用量記在日誌的「其他」用量（功能是「插圖提示詞預處理」）。形象圖的「提示詞」摺疊區塊可以看到送出的提示詞、預處理前的描述；還沒生成時顯示會送出的描述與會用的預處理。

## 4. 保存

- 圖片存在這個瀏覽器的 IndexedDB（`elondia-portraits`），太大放不進 localStorage，也不放進存檔欄位。
- 匯出時附上形象圖、匯入時還原、沒有存檔用到的圖自動清掉：見 [SAVES.md](SAVES.md) 第 2～4 節。
- 依「這一局（存檔的種子）＋角色 id」保存，不同存檔的主角不會互相蓋掉。
- 生成中可以取消；出錯時顯示原因（例如還沒設定 key、服務回應 401、CORS 被擋）。

## 5. ComfyUI 的設定組合

程式：`src/narrator/comfy.ts`（組工作流程、匯入、清單、錯誤訊息）、`src/components/ComfySettings.vue`。

每個主模存成一組設定，切換組合就一次換掉模型、文字編碼器、VAE、LoRA、取樣參數、前綴標籤與負面提示詞（例如 Illustrious 的 LoRA 不能用在 Anima 上，取樣器與 CFG 也不一樣）。

### 三種模式

| 模式 | 組出的工作流程（只用 ComfyUI 原生節點） | 要選的東西 |
|---|---|---|
| Checkpoint | `CheckpointLoaderSimple` →（選填 `VAELoader`）→ `LoraLoader` ×N → `CLIPTextEncode` ×2 → `EmptyLatentImage` → `KSampler` →（高解析修復：`LatentUpscaleBy` → `KSampler`）→ `VAEDecode` → `SaveImage` | Checkpoint；VAE 選填（空白用內建的） |
| UNet | `UNETLoader` ＋ 文字編碼器（1 個 `CLIPLoader`、2 個 `DualCLIPLoader`、3 個 `TripleCLIPLoader`）＋ `VAELoader` → 之後同上 | UNet、權重精度、文字編碼器與類型、VAE |
| 自訂工作流程 | 貼上的 API 格式 JSON，代號換成值 | 工作流程；成品圖的節點編號（選填） |

- 文字編碼器的「類型」依模型而定（例如 Anima 是 `stable_diffusion`、Flux 是 `flux`、Qwen-Image 是 `qwen_image`）。程式不寫死任何類型，選項直接讀伺服器的。
- **LoRA**：依序套用，每個可以停用、調權重；預設模型與 CLIP 用同一個權重，按「分開調 CLIP」可以各自設定。
- **高解析修復**：latent 放大（倍率、放大方式）後再採樣一次（步數、CFG、重繪強度）。
- **固定前綴標籤**：品質、畫風、LoRA 觸發詞，接在角色的提示詞前面（`前綴, 角色提示詞`）。
- **自訂工作流程的代號**：`%prompt%`（前綴＋角色提示詞）`%negative%` `%width%` `%height%` `%seed%` `%steps%` `%scale%` `%sampler%` `%scheduler%` `%model%`（Checkpoint 或 UNet 欄位）。整個字串就是代號時換成原本的型別（數字就是數字）。

舊版只有一份 ComfyUI 工作流程：沒改過預設工作流程的變成 Checkpoint 模式（模型欄位就是 Checkpoint），改過的變成自訂工作流程，行為和原本一樣。

### 讀取 ComfyUI 清單

「🔄 讀取 ComfyUI 清單」呼叫 `GET /object_info/<節點>`（`CheckpointLoaderSimple`、`UNETLoader`、`CLIPLoader`、`DualCLIPLoader`、`VAELoader`、`LoraLoader`、`KSampler`、`LatentUpscaleBy`），讀出 Checkpoint、UNet、權重精度、文字編碼器與類型、VAE、LoRA、取樣器、排程器、放大方式。欄位可以從清單選，也可以直接打字。新舊兩種下拉選項格式（`[[選項]]` 與 `["COMBO", {options}]`）都看得懂。

### 從工作流程匯入

貼上（或選檔案）ComfyUI 選單「Export (API)」匯出的 JSON，新增一組設定：

- 從第一次取樣（latent 來自空白 latent 的 `KSampler`）往回找：經過 LoRA 節點直到主模（Checkpoint 或 UNet 載入節點），正面提示詞的編碼節點往回找文字編碼器，解碼最後一次取樣的 `VAEDecode` 找 VAE。
- 看得懂 LoraManager 的 `Unet Loader (LoraManager)`、`Lora Loader (LoraManager)`（一個節點放好幾個 LoRA，只有名稱沒有副檔名）。有讀過清單時，LoRA 名稱對到伺服器的檔名（含子資料夾）；沒讀過時先補 `.safetensors`。
- 取樣器、排程器、CFG、步數、尺寸；`LatentUpscaleBy` 加第二次 `KSampler` 讀成高解析修復；負面提示詞（可以接在提示詞外掛的節點上）。
- 內建模式重現不了、會影響畫面的節點（例如 `FaceDetailer`、`ModelSamplingAuraFlow`）列出來，建議改用自訂工作流程；原本的工作流程已經放進這組的工作流程欄位。存圖、預覽、提示詞與文字工具的節點不影響畫面，不列。

### 送出前檢查與錯誤訊息

- 每次生成前（以及「🧪 檢查設定」）用 `/object_info` 確認工作流程用到的節點伺服器都有；缺的列出來，請到 ComfyUI-Manager 安裝（不會自動安裝：那需要 Manager、要開放安全等級還要重啟，而且讓網頁遠端安裝程式碼風險太高）。
- Checkpoint 與 UNet 模式也檢查選的檔案、類型、取樣器在不在伺服器的清單裡。自訂工作流程只檢查節點（有些外掛節點接受清單外的值），值的問題交給 ComfyUI 回報。
- `/prompt` 回應 400 的 `node_errors`、執行時的 `execution_error` 都翻成「哪個節點的哪個欄位、伺服器上沒有什麼」。

### 拿哪一張圖

一個工作流程可能有好幾張圖（第一次採樣的預覽、臉部修復前的預覽……）。依序：指定的節點編號 → 存檔的輸出（`SaveImage` 一類，`type: output`）中最後一個節點 → 最後一個有圖的節點（例如只有預覽的工作流程，拿最後的「完成」預覽）。
