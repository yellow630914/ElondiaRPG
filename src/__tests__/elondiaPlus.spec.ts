// 隨附的世界包「艾隆迪亞擴充」（worldgen/worlds/elondia-plus/world.json）能完整匯入，世界書條目會被觸發
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createPinia, setActivePinia } from 'pinia'
import { applyContent, emptyMods } from '@/engine/mods'
import { useContent } from '@/stores/content'
import { usePrompts } from '@/stores/prompts'
import { loreItems, pickLore, type Worldbook } from '@/narrator/lore'
import book from '@data/worldbook/elondia.worldbook.json'

const TEXT = readFileSync('worldgen/worlds/elondia-plus/world.json', 'utf8')

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

describe('elondia-plus world package', () => {
  it('imports every NPC and quest with a linked prompt set', () => {
    const content = useContent()
    const r = content.importWorld(TEXT, 'world.json')
    expect(r.dropped).toEqual([])
    const mods = content.worlds.find((w) => w.id === r.id)!.mods
    expect(Object.keys(mods.npcs)).toHaveLength(85)
    expect(Object.keys(mods.stories)).toHaveLength(37)
    expect(r.promptSet).toBeTruthy()
  })

  it('triggers the region, main-line and ruler entries', () => {
    const content = useContent()
    const prompts = usePrompts()
    const r = content.importWorld(TEXT, 'world.json')
    const cfg = prompts.sets.find((s) => s.id === r.promptSet)!.config
    const items = loreItems(book as unknown as Worldbook, cfg.lore, cfg.customLore)
    const opts = { adult: false, budgetChars: 12000, playerName: '主角' }
    const sel = pickLore(items, { text: '萊茵堡\n中央平原與丘陵地帶\n塞拉菲娜提到教皇', travel: false }, opts)
    const all = [...sel.constant, ...sel.triggered]
    // 勢力概述（常駐）帶著現任首領，區域條目帶著重要人物
    expect(all.find((e) => e.uid === 28)!.content).toContain('各势力现任首领')
    expect(all.find((e) => e.uid === 6)!.content).toContain('塞拉菲娜・維斯')
    expect(sel.triggered.map((e) => e.comment)).toEqual(expect.arrayContaining(['主线-龙影之兆', '人物-格里高利七世']))
    expect(sel.triggered.map((e) => e.comment)).not.toContain('人物-櫻汐')
  })
})
