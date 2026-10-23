import 'fake-indexeddb/auto'
import { editableWorld } from './testWorld'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { applyContent, emptyMods } from '@/engine/mods'
import { useContent, VANILLA, VANILLA_NAME } from '@/stores/content'
import { useGame } from '@/stores/game'
import { portraitKey, usePortraits } from '@/stores/portraits'
import { currentStore, preloadCurrent } from '@/stores/saves'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 250, 251])
// fake-indexeddb 用 Node 的 structuredClone：happy-dom 的 Blob 存進去會變成普通物件，改用 Node 的 Blob
globalThis.Blob = NodeBlob as unknown as typeof Blob
const image = () => new Blob([PNG], { type: 'image/png' }) as File

async function clearDb() {
  const g = useGame()
  for (const m of await (await import('@/stores/saves')).slotStore().list()) await g.deleteSlot(m.id)
  await currentStore().clear()
  await usePortraits().pruneExcept(new Set())
}

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  await clearDb()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

describe('current game in IndexedDB', () => {
  it('writes the auto-save to IndexedDB and reads it back on the next start', async () => {
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    await g.flushed()
    expect(currentStore().kind).toBe('indexeddb')
    expect(localStorage.getItem('elondia.save')).toBeNull()
    await preloadCurrent()
    setActivePinia(createPinia())
    // 啟動時不會自動進入遊戲：首頁按「繼續」才載入
    const next = useGame()
    expect(next.state).toBeNull()
    expect(next.resumeMeta?.pcName).toBe('艾倫')
    expect(next.continueGame()).toBe(true)
    expect(next.state!.party[0]!.name).toBe('艾倫')
  })
})

describe('exported saves carry custom content and portraits', () => {
  it('bundles the custom content and, when asked, this game’s portraits', async () => {
    const g = useGame()
    const c = editableWorld()
    c.saveItem('月光草', { category: 'material', price_cc: 5, tags: [], custom: true })
    g.start('艾倫', 'human', 'fighter')
    const portraits = usePortraits()
    await portraits.upload(portraitKey(g.state!, 'pc'), image())
    await portraits.upload('999:pc', image())

    const plain = JSON.parse((await g.exportFile())!.text)
    expect(plain.content.items['月光草']).toMatchObject({ custom: true })
    expect(plain.portraits).toBeUndefined()
    expect(JSON.parse((await g.exportFile(undefined, { content: false }))!.text).content).toBeUndefined()

    const full = JSON.parse((await g.exportFile(undefined, { portraits: true }))!.text)
    // 只有這一局的圖
    expect(Object.keys(full.portraits)).toEqual(['pc'])
    expect(full.portraits.pc.data).toMatch(/^data:image\/png;base64,/)
  })

  it('leaves uploaded icons out of save slots and exports, and still recognises the same world on import', async () => {
    const g = useGame()
    const c = editableWorld()
    const ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    c.saveItem('月光草', { category: 'material', price_cc: 5, tags: [], custom: true, icon: ICON })
    c.saveCategoryIcon('food', ICON)
    expect(c.mods.items['月光草']!.icon).toBe(ICON)
    g.start('艾倫', 'human', 'fighter')
    await g.saveToSlot('有圖示')
    const slot = g.slots.find((m) => m.name === '有圖示')!
    // 存檔欄位本身也不帶
    const { slotStore } = await import('@/stores/saves')
    expect(JSON.stringify((await slotStore().get(slot.id))!.content)).not.toContain('data:image')
    const text = (await g.exportFile(slot.id))!.text
    expect(text).not.toContain('data:image')
    const out = JSON.parse(text)
    expect(out.content.items['月光草']).toMatchObject({ custom: true })
    expect(out.content.categoryIcons).toEqual({})
    // 世界本身的圖示還在；首頁匯入同一個世界的存檔時不會因為少了圖示而另建世界
    expect(c.mods.items['月光草']!.icon).toBe(ICON)
    g.state = null
    expect(g.previewImport(text).newWorld).toBeUndefined()
  })

  it('records the world name, and exports a vanilla save without any content', async () => {
    const g = useGame()
    const c = editableWorld()
    c.renameWorld(c.active, '月光世界')
    c.saveItem('月光草', { category: 'material', price_cc: 5, tags: [], custom: true })
    g.start('艾倫', 'human', 'fighter')
    const own = JSON.parse((await g.exportFile())!.text)
    expect(own.state.world).toEqual({ id: c.active, name: '月光世界' })
    expect(own.content.items['月光草']).toBeTruthy()
    // 原版世界的存檔：標明原版、不附目前世界的內容
    await g.saveToSlot('月光')
    g.state = null
    g.start('貝拉', 'elf', 'ranger', undefined, {}, VANILLA)
    await g.saveToSlot('原版')
    g.state = null
    c.switchWorld(c.worlds[0]!.id)
    const slot = g.slots.find((m) => m.name === '原版')!
    const vanilla = JSON.parse((await g.exportFile(slot.id))!.text)
    expect(vanilla.state.world).toEqual({ id: VANILLA, name: VANILLA_NAME })
    expect(vanilla.content).toBeUndefined()
  })

  it('refuses an in-game import from another world, and turns a home import into a new world', async () => {
    const g = useGame()
    const c = editableWorld()
    c.renameWorld(c.active, '月光世界')
    c.saveItem('月光草', { category: 'material', price_cc: 5, tags: [], custom: true })
    g.start('艾倫', 'human', 'fighter')
    const text = (await g.exportFile())!.text
    const moonlight = c.active

    // 另一個世界的遊戲中：拒絕，請回首頁匯入
    g.state = null
    c.switchWorld(c.createWorld('別的世界'))
    g.start('貝拉', 'elf', 'ranger')
    expect(g.previewImport(text).blocked).toContain('請回首頁匯入')
    const before = g.slots.length
    await g.importFile(text, 'save.json')
    expect(g.error).toContain('請回首頁匯入')
    expect(g.slots).toHaveLength(before)
    g.error = null

    // 首頁：世界存在而且內容一樣，照舊指向它
    g.state = null
    expect(g.previewImport(text).newWorld).toBeUndefined()
    // 世界的內容改過：用附帶的內容建立新世界，同名時加 4 位數字（預覽的名稱就是實際建立的）
    c.switchWorld(moonlight)
    c.saveItem('月光草', { category: 'material', price_cc: 9, tags: [], custom: true })
    const worlds = c.worlds.length
    const preview = g.previewImport(text).newWorld
    expect(preview).toMatch(/^月光世界\d{4}$/)
    await g.importFile(text, 'save.json')
    expect(c.worlds).toHaveLength(worlds + 1)
    const created = c.worlds.at(-1)!
    expect(created.name).toBe(preview)
    expect(created.mods.items['月光草']!.price_cc).toBe(5)
    const slot = await (await import('@/stores/saves')).slotStore().get(g.slots.find((m) => m.name === 'save')!.id)
    expect(slot!.state.world).toEqual({ id: created.id, name: created.name })
    // 目前的世界沒有被動到
    expect(c.worlds.find((w) => w.id === moonlight)!.mods.items['月光草']!.price_cc).toBe(9)
    // 同一個檔案再匯入一次：沿用剛建立的世界，不再多建一個
    expect(g.previewImport(text).newWorld).toBeUndefined()
    await g.importFile(text, 'again.json')
    expect(c.worlds).toHaveLength(worlds + 1)
    const again = await (await import('@/stores/saves')).slotStore().get(g.slots.find((m) => m.name === 'again')!.id)
    expect(again!.state.world).toEqual({ id: created.id, name: created.name })

    // 世界不存在：用存檔世界的名字建立
    c.deleteWorld(moonlight)
    c.deleteWorld(created.id)
    await g.importFile(text, 'save2.json')
    expect(c.worlds.at(-1)!.name).toBe('月光世界')

    // 沒有記世界的舊匯出檔，但附了自訂內容：一樣建立新的世界，內容不會被丟掉
    const legacy = JSON.parse(text)
    delete legacy.state.world
    legacy.content.items['月光草'].price_cc = 7
    await g.importFile(JSON.stringify(legacy), 'legacy.json')
    const made = c.worlds.at(-1)!
    expect(made.name).toBe('匯入的世界')
    expect(made.mods.items['月光草']!.price_cc).toBe(7)
    const old = await (await import('@/stores/saves')).slotStore().get(g.slots.find((m) => m.name === 'legacy')!.id)
    expect(old!.state.world).toEqual({ id: made.id, name: '匯入的世界' })
  })

  it('restores bundled portraits and cleans up portraits no save uses', async () => {
    const g = useGame()
    g.start('艾倫', 'human', 'fighter')
    const seed = g.state!.seed
    const portraits = usePortraits()
    await portraits.upload(portraitKey(g.state!, 'pc'), image())
    const text = (await g.exportFile(undefined, { portraits: true }))!.text
    expect(g.previewImport(text).portraits).toBe(1)

    // 開新的一局：上一局沒有存檔，形象圖被清掉
    g.start('貝拉', 'elf', 'ranger')
    await new Promise((r) => setTimeout(r, 50))
    expect(await portraits.countFor(seed)).toBe(0)

    // 匯入附有圖片的存檔：還原
    await g.importFile(text, 'save.json', { portraits: true })
    expect(await portraits.countFor(seed)).toBe(1)
    expect(g.notice).toContain('還原 1 張形象圖')
    const back = await (await import('@/stores/saves')).slotStore().get(g.slots[0]!.id)
    // 圖片不留在存檔欄位裡
    expect(back!.portraits).toBeUndefined()
    // 還原的圖一個位元都沒變
    const again = JSON.parse((await g.exportFile(g.slots[0]!.id, { portraits: true }))!.text)
    expect(again.portraits.pc.data).toBe(JSON.parse(text).portraits.pc.data)

    // 刪掉那個存檔欄位：圖也跟著清掉
    await g.deleteSlot(g.slots[0]!.id)
    expect(await portraits.countFor(seed)).toBe(0)
    expect(g.notice).toContain('清掉 1 張')
  })
})
