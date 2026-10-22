import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { localStorageStore, parseSaveFile, preloadCurrent, QUICK_SLOT, useCurrentStore, useSlotStore, type CurrentData, type CurrentStore } from '@/stores/saves'
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

describe('current game storage', () => {
  /** 記憶體裡的「IndexedDB」；fail 為 true 時寫入失敗 */
  function memoryStore() {
    const data: CurrentData = {}
    const s: CurrentStore & { data: CurrentData; fail: boolean } = {
      kind: 'indexeddb', data, fail: false,
      async read() { return { ...data } },
      async write(d) {
        if (s.fail) throw new DOMException('full', 'QuotaExceededError')
        Object.assign(data, d)
      },
      async clear() { for (const k of Object.keys(data)) delete data[k as keyof CurrentData] },
    }
    return s
  }

  beforeEach(() => {
    localStorage.clear()
    useSlotStore(localStorageStore())
  })
  afterEach(() => useCurrentStore(null))

  it('moves an old localStorage game into IndexedDB on start-up', async () => {
    const store = memoryStore()
    useCurrentStore(store)
    setActivePinia(createPinia())
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    await g.flushed()
    // 舊版：存在 localStorage
    localStorage.setItem('elondia.save', store.data.state!)
    localStorage.setItem('elondia.usage', '{}')
    await store.clear()
    await preloadCurrent()
    expect(store.data.state).toContain('艾倫')
    expect(localStorage.getItem('elondia.save')).toBeNull()
    setActivePinia(createPinia())
    // 啟動時不會自動進入遊戲：首頁按「繼續」才載入
    const next = useGame()
    expect(next.state).toBeNull()
    expect(next.resumeMeta?.pcName).toBe('艾倫')
    expect(next.continueGame()).toBe(true)
    expect(next.state!.party[0]!.name).toBe('艾倫')
  })

  it('warns when the auto-save cannot be written, until a later save succeeds', async () => {
    const store = memoryStore()
    useCurrentStore(store)
    setActivePinia(createPinia())
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    await g.flushed()
    expect(g.saveWarning).toBeNull()
    store.fail = true
    g.state!.money_cc = 3
    g.editProfile({})
    await g.flushed()
    expect(g.saveWarning).toContain('儲存空間不足')
    store.fail = false
    g.editProfile({})
    await g.flushed()
    expect(g.saveWarning).toBeNull()
    expect(JSON.parse(store.data.state!).money_cc).toBe(3)
  })

  it('keeps only the newest write when actions come faster than the disk', async () => {
    const store = memoryStore()
    let writes = 0
    const write = store.write
    store.write = async (d) => { writes++; await new Promise((r) => setTimeout(r, 5)); return write(d) }
    useCurrentStore(store)
    setActivePinia(createPinia())
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    for (let i = 0; i < 5; i++) {
      g.state!.money_cc = 100 + i
      g.editProfile({})
    }
    await g.flushed()
    expect(writes).toBeLessThanOrEqual(2)
    expect(JSON.parse(store.data.state!).money_cc).toBe(104)
  })
})
