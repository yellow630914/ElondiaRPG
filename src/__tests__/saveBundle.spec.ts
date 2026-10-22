import 'fake-indexeddb/auto'
import { editableWorld } from './testWorld'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { itemDef } from '@/engine/data'
import { applyContent, emptyMods, newEnemy } from '@/engine/mods'
import { useContent } from '@/stores/content'
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

  it('merges the bundled content on import: adds what is missing, keeps or takes what differs', async () => {
    const g = useGame()
    const c = editableWorld()
    c.saveItem('月光草', { category: 'material', price_cc: 5, tags: [], custom: true })
    c.saveEnemy('mod_wolf', { ...newEnemy('mod_wolf'), name: '影狼' })
    g.start('艾倫', 'human', 'fighter')
    const text = (await g.exportFile())!.text

    // 另一個瀏覽器：沒有月光草，影狼改過
    c.resetAll()
    c.saveEnemy('mod_wolf', { ...newEnemy('mod_wolf'), name: '我的影狼' })
    const preview = g.previewImport(text, 'save.json')
    expect(preview.diff!.added.map((e) => e.label)).toEqual(['物品「月光草」'])
    expect(preview.diff!.changed.map((e) => e.key)).toEqual(['enemies:mod_wolf'])

    // 只新增，不換掉自己的影狼
    await g.importFile(text, 'save.json', { merge: true })
    expect(itemDef('月光草')).toBeDefined()
    expect(c.mods.enemies.mod_wolf!.name).toBe('我的影狼')
    expect(g.notice).toContain('合併 1 項自訂內容')
    // 換成存檔的版本
    await g.importFile(text, 'save.json', { merge: true, take: ['enemies:mod_wolf'] })
    expect(c.mods.enemies.mod_wolf!.name).toBe('影狼')
    expect(g.slots).toHaveLength(2)
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
