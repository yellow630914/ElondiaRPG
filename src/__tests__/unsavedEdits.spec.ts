// 世界編輯器的未儲存保護（content/unsaved.ts）：沒有修改直接過；有修改時等玩家選儲存、放棄或留下來
import { beforeEach, describe, expect, it } from 'vitest'
import { answerUnsaved, confirmDiscard, unsavedAsk, unsavedEdits, unsavedSave } from '@/components/content/unsaved'

describe('unsaved edits', () => {
  beforeEach(() => {
    unsavedEdits.value = false
    unsavedSave.value = null
    unsavedAsk.value = null
  })

  it('passes without asking when nothing is unsaved', async () => {
    expect(await confirmDiscard()).toBe(true)
    expect(unsavedAsk.value).toBeNull()
  })

  it('stays or discards as chosen', async () => {
    unsavedEdits.value = true
    const stay = confirmDiscard()
    expect(unsavedAsk.value).not.toBeNull()
    await answerUnsaved('stay')
    expect(await stay).toBe(false)
    expect(unsavedEdits.value).toBe(true)
    const discard = confirmDiscard()
    await answerUnsaved('discard')
    expect(await discard).toBe(true)
    expect(unsavedEdits.value).toBe(false)
  })

  it('saves through the open editor, and stays when the save did not go through', async () => {
    unsavedEdits.value = true
    unsavedSave.value = { save: () => { unsavedEdits.value = false }, blocked: '' }
    const ok = confirmDiscard()
    await answerUnsaved('save')
    expect(await ok).toBe(true)

    unsavedEdits.value = true
    unsavedSave.value = { save: () => { /* 出錯，沒存進去 */ }, blocked: '' }
    const failed = confirmDiscard()
    await answerUnsaved('save')
    expect(await failed).toBe(false)

    unsavedSave.value = { save: () => { unsavedEdits.value = false }, blocked: '任務鏈有錯誤' }
    const blocked = confirmDiscard()
    await answerUnsaved('save')
    expect(await blocked).toBe(false)
    expect(unsavedEdits.value).toBe(true)
  })
})
