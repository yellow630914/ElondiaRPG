<script setup lang="ts">
import { AI_DESIGNS, AI_JUDGED_PLACES, NARRATE_KINDS, useSettings } from '@/stores/settings'
import Hint from './ui/Hint.vue'

// 所有 AI 開關（判定、AI 設計、自動寫出經過）：設定頁與冒險頁面的泡泡視窗共用，
// 每一項的「?」寫出會影響哪些行為。kinds：也列出自動寫出經過的日誌種類（設定頁用）。
defineProps<{ kinds?: boolean }>()
const settings = useSettings()

const JUDGE_HINT = `開啟：先擲骰，再把骰值與完整資料交給 AI，由 AI 決定成敗（可能出乎預料）與後果，數值由程式夾在上限內；經過交給「敘事正文」寫出。
關閉：依規則判定（預設屬性與參考 DC）。
影響：${AI_JUDGED_PLACES}。
等待判定的行動也可以單次選「AI 判定」或「依規則判定」。`
const DESIGN_HINT: Record<string, string> = {
  roster: '開啟：第一次到一個地點時，請 AI 設計名單上居民的名字、外貌、性格與背景（種族、職業、等級、要價不變）。\n影響：這裡的人、酒館的候選冒險者。\n關閉：用規則生成的名字與設定。',
  shop: '開啟：每間店每天第一次進店時，請 AI 設計今天的特別商品與收購（店名不經 AI）。\n影響：商店、酒館的交易、黑市。\n關閉：只有一般的商品清單。',
  negotiation: '開啟：開始談判時，請 AI 依對象與情境設計可以採取的方式。\n影響：委託談判、奴隸與主人的談判等所有談判。\n關閉：用談判範本寫好的方式。\n談判裡「自己描述做法」的判定看「擲骰的行動交給 AI 判定」。',
}
const NARRATION_HINT = `開啟：勾選種類的日誌產生後，自動請「敘事正文」的模型寫出詳細經過。
關閉：不自動呼叫 AI，戰鬥直接顯示戰報，其他事件顯示簡述；每則日誌都可以按底下的筆圖示手動寫出經過。
AI 判定的主動行動：只要「主動行動」這個種類有勾，就會寫出經過，不看這個開關。`
</script>

<template>
  <div class="ai-toggles">
    <div class="row-line">
      <label class="check"><input v-model="settings.aiJudge" type="checkbox" /> 擲骰的行動交給 AI 判定</label>
      <Hint :text="JUDGE_HINT" :width="340" />
      <span v-if="settings.aiJudge && !settings.ready('judge')" class="small warn">模型來源未設定，目前依規則判定</span>
    </div>

    <div class="group small muted">AI 設計</div>
    <div v-for="d in AI_DESIGNS" :key="d.id" class="row-line sub">
      <label class="check"><input v-model="settings.aiDesign[d.id]" type="checkbox" /> {{ d.name }}</label>
      <Hint :text="DESIGN_HINT[d.id]" :width="320" />
      <span v-if="settings.aiDesign[d.id] && !settings.ready(d.id)" class="small warn">模型來源未設定，目前不會呼叫</span>
    </div>

    <div class="row-line">
      <label class="check"><input v-model="settings.aiNarration" type="checkbox" /> AI 細節描述：自動寫出經過</label>
      <Hint :text="NARRATION_HINT" :width="340" />
      <span v-if="settings.aiNarration && !settings.ready('narration')" class="small warn">「敘事正文」的模型來源未設定</span>
    </div>
    <div v-if="kinds" class="kinds">
      <label v-for="k in NARRATE_KINDS" :key="k.id" class="check small" :title="k.desc">
        <input v-model="settings.narrateKinds[k.id]" type="checkbox" /> {{ k.name }}
        <span class="muted">{{ k.desc }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.ai-toggles { display: grid; gap: 6px; }
.row-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.row-line.sub, .kinds { padding-left: 22px; }
.group { margin-top: 2px; }
.check { display: flex; gap: 6px; align-items: center; }
.check input { flex-shrink: 0; }
.kinds { display: grid; gap: 4px; }
.kinds .muted { margin-left: 4px; }
.warn { color: var(--warn); }
</style>
