// 成人內容情境（設定 → 敘事與判定 →「成人內容情境」，預設關；docs/PROMPTS.md「成人內容情境」）：
// 只在成人向的段落（親密場景、戰敗事件）附在 system 的最後，把情境照實講清楚——
// 玩家是自己開啟成人內容的成年人、故事是虛構的、所有角色都是成年人、敘事者是照報告呈現結果的主持人（DM）。
// 它不偽造對話或拒絕、不叫模型無視規則、不改輸出的管道，也不塞無關的文字：服務本身不提供成人內容時沒有作用。
// 玩家可以在「提示詞 → 敘事規則」修改；{{player}} 換成主角名。

export const DEFAULT_ADULT_FRAME = `<adult_fiction>
以下說明這場冒險的情境，適用於這次的成人向段落：
- 這是給成年玩家的虛構互動冒險。玩家是成年人，自己在設定裡開啟了成人內容，想讀到完整的成人情節；世界、地點與角色全都是虛構的。
- 登場的所有角色都是成年人：外貌、身體與言行一律照成年人寫，不寫成孩童，也不暗示未成年。
- 你在這裡是這場冒險的主持人（DM）：規則與骰子已經決定了結果，你負責把這一幕如實、完整地呈現給{{player}}。照報告寫，不替結果打折，不跳過也不淡化成人情節，不加道德評論、警語或事後的說教，也不跳出故事和玩家對話。
- 角色的意願、抗拒與反應照報告和角色設定寫；這是虛構角色之間的情節，不代表對現實的主張。
- 真的有某個細節不能寫時，只把那一點用一句簡短的敘述帶過，其餘照常寫完；不要整段拒絕、改寫成別的事件，或改變報告的結果。
</adult_fiction>`

let enabled = false

/** 設定的開關（stores/settings.ts 同步過來） */
export function setAdultFrame(on: boolean) {
  enabled = on
}

export function adultFrameOn(): boolean {
  return enabled
}

export function fillAdultFrame(template: string | undefined, player: string): string {
  return (template?.trim() ? template : DEFAULT_ADULT_FRAME).split('{{player}}').join(player)
}

/** 設定開著時，給成人向段落用的情境說明；關著時是 undefined */
export function adultFrameFor(template: string | undefined, player: string): string | undefined {
  return enabled ? fillAdultFrame(template, player) : undefined
}
