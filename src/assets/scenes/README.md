# 建築的場景圖

地點面板頂端的橫幅（`components/place/SceneBanner.vue`）會自動找這個資料夾裡和建築種類同名的圖：

`tavern`、`inn`、`guild`、`temple`、`general`、`smithy`、`tailor`、`jeweler`、`magic`、`informant`、`wanderer`（`.png` 或 `.webp`）

- 建議尺寸 760×224（顯示時約 380×112，像素圖用 2 倍），會以 `object-fit: cover` 裁切，重要的東西放中間偏右；左下角會疊店名。
- 沒有圖的種類用依種類上色的佔位圖。
- 自建的商店用商店的 id 當檔名。
