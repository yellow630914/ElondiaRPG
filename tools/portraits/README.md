# 角色印象圖工具

用本機的 ComfyUI，替**有角色線的固定 NPC** 生成形象圖：一個網頁列出所有人、顯示外貌與英文提示詞，一張一張或整批生成，挑好的圖再上傳到遊戲裡。

| 檔案 | 說明 |
|---|---|
| `build_list.py` | 產生名單 `npcs.json`（讀 `data/rules/stories.json`、`data/world/npcs.json`） |
| `prompts.json` | 手寫的英文提示詞，以 NPC id 為 key：`prompt`（一般）、`adult_prompt`（成人向另外加的詞）、`negative`（這位角色另外的負面詞，可省略） |
| `npcs.json` | 名單（`build_list.py` 產生，不要手改；網頁上改的提示詞會同時寫進這裡和 `prompts.json`） |
| `serve.py` | 本機伺服器：提供網頁，並把 `/comfy/...` 轉給 ComfyUI |
| `index.html` | 網頁 |
| `out/<id>/` | 生成的圖：`<時間>-<seed>.png`，旁邊的 `.json` 記著提示詞、seed、尺寸與工作流程名稱（不進 git） |
| `export/<id>.png` | 按「選這張」選好的圖（不進 git） |

## 名單怎麼來

和任務線走向（`worldgen/tools/flowdoc/flowdoc.py`）一樣，依特殊任務簡介最後的「（線名・一）」分線，取分類是「角色線」「角色線（成人向）」的線的主角：

- 線名裡的名字（「蕾娜」也在「瑟蕾娜」裡時只算瑟蕾娜），加上親密場景（`night` 任務點）的對象；都沒有時用最常開頭的委託人。
- 兩個人的線兩個都畫：「卡蜜拉＆伊蓮娜」從線名拿到兩人，「雙子女僕」寫在 `build_list.py` 的 `PAIRS`（蘿娜、菈娜）。
- 同一個人在好幾條線裡只出現一次（`lines` 列出所有的線）。
- `adult`：NPC 本身是成人向，或在成人向的角色線裡；`romance`：她的線有 `*_lover` 旗標或親密場景。
- `outfit` 是遊戲依身分給 NPC 穿的衣服（`gear.json` 的 `npc_outfits`，只看非成人向的規則），寫提示詞時參考用。

改了特殊任務或 NPC 之後重跑一次：

```bash
python3 tools/portraits/build_list.py
```

新的人會列在「還沒有英文提示詞」裡，到 `prompts.json` 補上（或在網頁上寫好按「儲存提示詞」）。重跑不會蓋掉 `prompts.json`。

## 提示詞

SD 系的模型看不懂中文，所以每個人都有一組手寫的英文 danbooru 標籤，照外貌寫：髮色與髮型、眼睛、種族特徵（精靈耳、貓耳與尾巴、魔族的角與翅膀、玉璘族的鰓與鱗、人魚尾）、依身分的服裝、年齡感（都是成年人，寫 `adult woman` 或 `mature female`）、表情。一般的提示詞是穿著衣服的胸像；`adult_prompt` 只從成人向外貌（`adult_appearance`）寫，只有勾了右上角「成人向」才會加上去。

送出去的正面提示詞是：**前綴, 角色的 prompt, （成人向時）adult_prompt, 後綴**；負面是：**負面提示詞, 角色的 negative, （沒勾成人向時）另外加進負面的詞**。前綴預設放品質詞與構圖（`masterpiece, best quality, ..., upper body, portrait, looking at viewer`），負面預設放常見的壞手、浮水印與 `child, loli`。這些都可以在「生成設定」裡改，設定存在瀏覽器裡。

## 啟動

1. 啟動 ComfyUI（portable 版：`run_nvidia_gpu.bat`），預設在 http://127.0.0.1:8188。
2. 在 repo 根目錄跑名單（第一次或內容改過之後）：
   ```bash
   python3 tools/portraits/build_list.py
   ```
3. 啟動這個工具（只用標準函式庫，ComfyUI portable 內建的 Python 就能跑）：
   ```bat
   C:\ComfyUI_windows_portable\python_embeded\python.exe -I tools\portraits\serve.py
   ```
   或 `python3 tools/portraits/serve.py`。ComfyUI 不在預設網址時加 `--comfy http://127.0.0.1:8000`；換這個工具的連接埠用 `--port`。
4. 打開 http://127.0.0.1:8190。

網頁和 ComfyUI 的溝通都經過 `serve.py`（`/comfy/prompt`、`/comfy/history/<id>`、`/comfy/view`、`/comfy/object_info/...`），所以不必開 ComfyUI 的 CORS 設定。

## 用法

- **左邊**：搜尋名字、線名或 id；依任務線、成人向、有沒有選好圖篩選。已經選好的人會顯示縮圖。
- **生成設定**：
  - **內建工作流程**：Checkpoint 文生圖（CheckpointLoaderSimple → CLIPTextEncode ×2 → EmptyLatentImage → KSampler → VAEDecode → SaveImage）。按「讀取 ComfyUI 清單」從 ComfyUI 讀 Checkpoint、取樣器與排程的清單。
  - **自訂工作流程**：貼上（或選檔案）ComfyUI 選單「Export (API)」匯出的 JSON。代號和遊戲的自訂工作流程相同（`src/narrator/comfy.ts` 的 `fillWorkflow`、`docs/PORTRAITS.md` 第 5 節），所以替遊戲匯出的工作流程這裡也能直接用：

    | 代號 | 換成 |
    |---|---|
    | `%prompt%` | 前綴＋角色提示詞（＋成人向）＋後綴 |
    | `%negative%` | 負面提示詞 |
    | `%width%` `%height%` | 尺寸 |
    | `%seed%` | seed |
    | `%steps%` `%scale%` | 步數、CFG（用內建模式的欄位） |
    | `%sampler%` `%scheduler%` | 取樣器、排程（同上） |
    | `%model%` | 選的 Checkpoint（同上） |
    | `%image%` `%mask%` | 空字串（這個工具不做以圖生圖） |
    | `%denoise%` | 1 |

    整個字串就是代號時換成原本的型別（`"%seed%"` 會變成數字）。成品從存檔節點（SaveImage）拿；要拿別的節點時填「成品節點 id」。
  - 尺寸、每位幾張、seed（隨機，或固定；固定時同一位的第 2、3 張是 seed+1、+2）。
- **角色**：外貌（成人向外貌收在摺疊裡）、可以編輯的提示詞、負面詞與成人向提示詞，下面是實際送出的內容。改過還沒儲存的人在名單上有一個點；生成時用改過的版本，按「儲存提示詞到 prompts.json」才寫回檔案。
- **生成**：替目前這位生成「每位幾張」張。**生成全部**依序跑完左邊目前篩出來的人（可以跳過已經選圖的人），「停止」會中斷 ComfyUI 正在跑的那張。
- **成品**：每張都存進 `out/<id>/`。「選這張」複製成 `export/<id>.png`（綠框），「用這個 seed」把 seed 固定成那張的，點圖片放大。

## 放進遊戲

遊戲的形象圖存在**每個存檔**裡（瀏覽器的 IndexedDB，key 是「存檔的世界 seed：角色 id」），所以要在想用的存檔裡各上傳一次：

1. 讀取存檔，打開上方工具列的 **「關係」**（人際關係與冒險記憶），找到那位角色；在隊伍裡的人也可以從 **隊伍 → 角色詳情** 打開。
2. 在形象圖框按 **「上傳」**（提示是「上傳自己的圖片」），選 `tools/portraits/export/<id>.png`。

上傳的圖會成為新的一版，可以在形象圖框翻看舊版；存檔匯出時可以選擇附上形象圖。說明見 `docs/PORTRAITS.md`。
