// 世界編輯器的未儲存保護：目前打開的編輯器有沒有未儲存的修改（EditorHeader 回報）。
// 換項目、換頁籤、換世界、離開世界頁之前問一次「儲存、放棄，還是留下來」（UnsavedDialog.vue）；關掉網頁時也提醒（App.vue 的 beforeunload）。
import { nextTick, ref } from 'vue'

export const unsavedEdits = ref(false)

/** 目前編輯器的「💾 儲存」（EditorHeader 登記）；blocked 是不能儲存的原因（例如任務鏈有錯誤） */
export const unsavedSave = ref<{ save: () => void; blocked: string } | null>(null)

/** 等玩家回答的問題（UnsavedDialog 顯示） */
export const unsavedAsk = ref<{ resolve: (ok: boolean) => void } | null>(null)

/**
 * 沒有未儲存的修改，或玩家選了儲存（而且存成功）、放棄時回傳 true；留下來回傳 false。
 * 有修改時跳出對話框，等玩家選。
 */
export function confirmDiscard(): Promise<boolean> {
  if (!unsavedEdits.value) return Promise.resolve(true)
  // 已經在問了：前一個問題當成留下來
  unsavedAsk.value?.resolve(false)
  return new Promise((resolve) => {
    unsavedAsk.value = { resolve }
  })
}

/** 對話框的三個選項 */
export async function answerUnsaved(choice: 'save' | 'discard' | 'stay') {
  const ask = unsavedAsk.value
  if (!ask) return
  unsavedAsk.value = null
  if (choice === 'stay') return ask.resolve(false)
  if (choice === 'discard') {
    unsavedEdits.value = false
    return ask.resolve(true)
  }
  const s = unsavedSave.value
  if (!s || s.blocked) return ask.resolve(false)
  s.save()
  // 編輯器的 dirty 經過 props 傳到 EditorHeader 再回報：等兩輪更新
  await nextTick()
  await nextTick()
  // 存不進去（出錯、取消了儲存前的確認）：留在這裡
  ask.resolve(!unsavedEdits.value)
}
