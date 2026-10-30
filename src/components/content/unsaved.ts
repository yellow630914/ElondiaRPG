// 世界編輯器的未儲存保護：目前打開的編輯器有沒有未儲存的修改（EditorHeader 回報）。
// 換項目、換頁籤、換世界、離開世界頁之前問一次；關掉網頁時也提醒（App.vue 的 beforeunload）。
import { ref } from 'vue'

export const unsavedEdits = ref(false)

/** 沒有未儲存的修改，或玩家同意放棄時回傳 true（同意後當成沒有修改） */
export function confirmDiscard(): boolean {
  if (!unsavedEdits.value) return true
  if (!confirm('這一項還有未儲存的修改，要放棄修改嗎？\n（取消：留在這裡，可以先按「💾 儲存」）')) return false
  unsavedEdits.value = false
  return true
}
