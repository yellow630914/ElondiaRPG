# 像素素材管線

用本機的 ComfyUI 生成像素素材，再用腳本整理成遊戲能用的圖。腳本只用 Pillow 和 numpy，ComfyUI portable 內建的 Python 就能跑，不需要安裝任何節點。

| 檔案 | 用途 |
|---|---|
| `anima-pixel-template.json` | ComfyUI 工作流程範本（Anima 主模 + 像素 LoRA，見 `docs/comfy/phase0-report.md`） |
| `icons.json` | 物品圖示的清單與提示詞（114 項） |
| `palette.json` | 共用調色盤：可換色的 4 階灰 `ramp`、固定色 `fixed`、各材質的 4 階色 |
| `generate.py` | 依清單把提示詞送進 ComfyUI，每項生成幾張候選，存到 `raw/`（不進版控） |
| `process.py` | 去背、裁切、縮成 32×32、減色，輸出到 `processed/`，並排出挑選用的總覽圖 `sheets/<組>.png` |

## 流程

```
python_embeded\python.exe -I tools\pixel\generate.py --only gear_longsword,mat_herb --count 4
python_embeded\python.exe -I tools\pixel\process.py --outline
```

1. 看 `sheets/*.png` 挑每項最好的候選，把編號寫進 `picks.json`（例如 `{"gear_longsword": 2}`）。
2. `process.py --export` 把挑中的複製到 `export/<key>.png`。

## 換色

裝備和藥水的圖示要在遊戲裡依材質換色。生成時把要換色的部分畫成灰色（提示詞寫 `plain grey`）。
`process.py` 會把低彩度的像素分成 4 群，對到 `ramp` 的 4 階灰；其他像素對到 `fixed` 的固定色。
遊戲執行時把 `ramp` 的 4 階換成材質的 4 階（`palette.json` 的 `materials`）。總覽圖的第二列就是換色後的預覽。

常用的調整參數：`--tol`（去背容差）、`--sat`（多低的彩度算可換色）、`--margin`（留白）、`--outline`（外圍加 1px 深色描邊）。
