<script setup lang="ts">
import { getCurrentInstance, onMounted, ref } from 'vue'

// 可以收起的區塊（取代編輯器裡的 <fieldset><legend>）：標題前面的 ▾／▸ 收起或展開。
// 收起的狀態依「哪個編輯器的哪個區塊」記在這個瀏覽器（換到同一種的下一項時照舊）；
// 沒記過時預設展開；寫了 start-folded 的先收起來。
// 收起來時內容照樣留著（只是不顯示），標題旁標「・有設定」：裡面有填了字或數字的欄位、勾了的勾選框。
// 注意：沒傳的布林 prop 是 false（不是 undefined），所以用「預設收起」而不是「有沒有資料」
const props = defineProps<{ startFolded?: boolean }>()
const KEY = 'elondia.ui.folds'
const editor = (getCurrentInstance()?.parent?.type as { __name?: string } | undefined)?.__name ?? ''
const root = ref<HTMLFieldSetElement | null>(null)
const folded = ref(false)
const hasValue = ref(false)
let key = ''

function readAll(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}
onMounted(() => {
  // 標題的文字去掉數字與括號（「任務點（3）」和「任務點（4）」是同一塊）
  const text = root.value?.querySelector(':scope > legend .fold-label')?.textContent ?? ''
  key = `${editor}:${text.replace(/[\d（）()、～…：:]+/g, '').trim().slice(0, 20)}`
  folded.value = readAll()[key] ?? props.startFolded
  check()
})
/** 裡面有沒有填東西（下拉選單不算：多半有預設值） */
function check() {
  const els = root.value?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(':scope > .fold-body input, :scope > .fold-body textarea') ?? []
  hasValue.value = [...els].some((el) => (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.type !== 'file' && el.value.trim() !== ''))
}
function toggle() {
  folded.value = !folded.value
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [key]: folded.value }))
  } catch {
    // 存不進去：只在這次有效
  }
}
</script>

<template>
  <fieldset ref="root" :class="{ folded }" @input="check" @change="check">
    <legend>
      <button type="button" class="fold-btn" :aria-expanded="!folded" :title="folded ? '展開' : '收起'" @click="toggle">{{ folded ? '▸' : '▾' }}</button>
      <span class="fold-label"><slot name="legend" /></span>
      <span v-if="folded && hasValue" class="fold-mark">・有設定</span>
    </legend>
    <div v-show="!folded" class="fold-body"><slot /></div>
  </fieldset>
</template>

<style scoped>
legend { color: var(--accent); padding: 0 4px; display: inline-flex; align-items: center; gap: 4px; }
.fold-body { display: contents; }
.fold-mark { font-size: 0.85em; opacity: 0.8; }
.fold-btn { padding: 0 4px; min-height: 0; line-height: 1.2; border: none; background: none; color: var(--accent); cursor: pointer; }
fieldset.folded { padding-bottom: 0; border-bottom-color: transparent; }
</style>
