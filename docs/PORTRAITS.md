# 角色形象插圖

> 程式：`src/narrator/imageInfo.ts`（服務模板、提示詞、標籤轉換）、`src/narrator/imageProviders.ts`（送出請求）、`src/stores/image.ts`（設定）、`src/stores/portraits.ts`（保存與生成）、`src/components/ImageSettings.vue`、`src/components/PortraitBox.vue`。

隊伍視窗的每位成員、人際關係裡登場過的人都有一格形象圖：可以「🎨 生成形象圖」、「📁 上傳」自己的圖片、刪除，點圖片放大。

## 1. 設定（⚙️ 設定 → 🎨 插圖生成）

API key 與參數只存在這個瀏覽器（localStorage 的 `elondia.image`），請求直接從瀏覽器送往選擇的服務。每個服務各自保存設定，切換服務不會弄丟 key。

| 模板 | 請求 | 預設 | 注意 |
|---|---|---|---|
| ChatGPT（OpenAI 圖片 API） | `POST {網址}/images/generations`，回傳 base64 或網址 | `gpt-image-1`、1024 × 1536 | 看得懂一般句子；不支援負面提示詞；也可以填相容的服務網址 |
| NovelAI | `POST {網址}/ai/generate-image`，回傳 ZIP（裡面是 PNG） | `nai-diffusion-4-5-full`、832 × 1216、28 步、CFG 5、`k_euler_ancestral` | key 是 Persistent API Token；只看得懂 Danbooru 標籤；瀏覽器被擋（CORS）時換成自己的轉送代理 |
| ComfyUI（自架） | `POST {網址}/prompt` 送出工作流程 → 輪詢 `/history/{id}` → `GET /view` 下載 | `http://127.0.0.1:8188`、832 × 1216 | 啟動時加 `--enable-cors-header`；模型欄位是 checkpoint 檔名 |

- **參數**：尺寸、步數、CFG、取樣器、負面提示詞（OpenAI 以外）。**額外參數**是一個 JSON 物件，合併進請求（NovelAI 合併進 `parameters`），例如 OpenAI 的 `{"quality": "high"}`。
- **ComfyUI 的工作流程**：API 格式的 JSON，用代號代入：`%prompt%` `%negative%` `%width%` `%height%` `%seed%` `%steps%` `%scale%` `%sampler%` `%model%`。整個字串就是代號時換成原本的型別（數字就是數字）。預設是一般的文生圖（Checkpoint → 兩個 CLIP 文字 → 空白潛空間 → KSampler → VAE 解碼 → 存檔）；自己的工作流程可以在 ComfyUI 用「Export (API)」匯出，再把文字換成代號。

## 2. 提示詞

**形象插圖的提示詞模板**（可以修改、恢復預設）把角色的資料填進去：`{name}` `{gender}` `{race}` `{role}`（職業或身分）`{level}` `{appearance}` `{personality}` `{background}` `{gear}`（身上的裝備）`{style}`（畫風）。代號的值是空的那一行整行拿掉。預設模板是英文的框架（單人、上半身、面向觀眾、簡單背景、不要文字與浮水印），角色的外貌等描述照原文填入。

## 3. Danbooru 標籤轉換

很多動漫風格的生圖模型只看得懂 Danbooru 標籤。勾選「先轉成 Danbooru 標籤」（NovelAI 與 ComfyUI 預設勾選）時：

1. 依模板組成語意描述。
2. 交給大語言模型（「🔀 功能分配」的「插圖標籤轉換」用哪個模型來源）轉成標籤：一行英文、逗號分隔，依「人數與性別 → 外貌 → 服裝 → 表情姿勢 → 構圖 → 背景 → 畫質」排列，20～40 個。轉換的指示可以修改；沒有開啟成人向時另外要求不要裸露、性暗示或血腥的標籤。
3. 整理模型的回答（拿掉程式碼框與說明、換行改逗號、去掉重複）。
4. **標籤直接送給生圖服務**，不再套用提示詞模板與畫風。

轉換的 token 用量記在日誌的「其他」用量（功能是「插圖標籤轉換」）。形象圖的「提示詞」摺疊區塊可以看到送出的標籤、轉換前的描述；還沒生成時顯示會送出的描述。

## 4. 保存

- 圖片存在這個瀏覽器的 IndexedDB（`elondia-portraits`），太大放不進 localStorage，也不放進存檔欄位。
- 匯出存檔時可以勾選「附上形象圖」：這一局所有角色的圖轉成 data URL 放進檔案（檔案會大很多）；匯入時可以選擇還原。見 [SAVES.md](SAVES.md)。
- 沒有任何存檔用到的圖會自動清掉：刪除存檔欄位、覆寫存檔欄位、開新遊戲時，檢查進行中的遊戲與所有存檔欄位的種子，不屬於任何一個的圖刪除。
- 依「這一局（存檔的種子）＋角色 id」保存，不同存檔的主角不會互相蓋掉。
- 生成中可以取消；出錯時顯示原因（例如還沒設定 key、服務回應 401、CORS 被擋）。
