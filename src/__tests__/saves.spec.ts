import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { localStorageStore, parseSaveFile, QUICK_SLOT, useSlotStore } from '@/stores/saves'
import { useGame } from '@/stores/game'

describe('save slots', () => {
  beforeEach(() => {
    localStorage.clear()
    useSlotStore(localStorageStore())
    setActivePinia(createPinia())
  })

  it('saves to a named slot and loads it back, keeping a backup of the current progress', async () => {
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    await g.saveToSlot('出發前')
    expect(g.slots).toHaveLength(1)
    expect(g.slots[0]).toMatchObject({ name: '出發前', kind: 'manual', pcName: '艾倫', level: 1, location: 'soriel' })

    g.state!.money_cc = 1
    await g.loadSlot(g.slots.find((m) => m.name === '出發前')!.id)
    expect(g.state!.money_cc).toBe(500)
    // 讀檔前自動存了一份
    const backup = g.slots.find((m) => m.kind === 'auto')!
    expect(backup.name).toContain('讀檔前')
    await g.loadSlot(backup.id)
    expect(g.state!.money_cc).toBe(1)
  })

  it('quick saves and quick loads', async () => {
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    await g.quickLoad()
    expect(g.notice).toContain('還沒有快速存檔')
    await g.quickSave()
    g.state!.money_cc = 7
    await g.quickSave()
    expect(g.slots.filter((m) => m.id === QUICK_SLOT)).toHaveLength(1)
    g.state!.money_cc = 99
    await g.quickLoad()
    expect(g.state!.money_cc).toBe(7)
  })

  it('exports, imports, renames and deletes slots', async () => {
    const g = useGame()
    g.start('希爾凡', 'elf', 'wizard')
    const file = await g.exportFile()
    expect(file!.name).toMatch(/^elondia-day1-\d{8}-\d{4}\.json$/)
    await g.importFile(file!.text, 'backup.json')
    const imported = g.slots[0]!
    expect(imported).toMatchObject({ name: 'backup', pcName: '希爾凡', race: 'elf', cls: 'wizard' })
    await g.renameSlot(imported.id, '森林出發')
    expect(g.slots[0]!.name).toBe('森林出發')
    await g.importFile('{"hello":1}', 'bad.json')
    expect(g.error).toContain('不是《埃隆迪亞大陸》的存檔')
    await g.deleteSlot(imported.id)
    expect(g.slots).toHaveLength(0)
    expect(() => parseSaveFile('not json')).toThrow()
  })
})
