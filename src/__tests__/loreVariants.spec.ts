// 世界書的劇情變體：依主角的劇情旗標換掉條目內容（大燁的政體依政治線的結局換掉）。

import { describe, expect, it } from 'vitest'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import combatExample from '../../examples/reports/combat-snake-creek.json'
import { enterLocation } from '@/engine/grid'
import { newGame } from '@/engine/state'
import { setFlag } from '@/engine/storyFlags'
import type { Report } from '@/engine/types'
import { composeNarration, type ComposeOptions } from '@/narrator/compose'
import {
  exportWorldbook, loreForReport, loreItems, parseWorldbookFile, pickLore, resolveLoreVariant,
  type LoreItem, type Worldbook,
} from '@/narrator/lore'
import { defaultPromptConfig } from '@/narrator/promptConfig'

const book = worldbook as unknown as Worldbook
const combat = combatExample as unknown as Report
const ENDINGS = ['yhpol_monarchy', 'yhpol_republic', 'yhpol_constitution']
const flags = (...names: string[]) => (f: string) => names.includes(f)
const opts = { adult: false, budgetChars: 50000, playerName: '艾倫' }

const custom = (patch: Partial<LoreItem> = {}): LoreItem => ({
  uid: 100000, comment: '小鎮', content: '鎮長是老約翰。鎮上很安靜。', keys: ['小鎮'], mode: 'keyword', order: 650, adult: false, builtin: false,
  variants: [
    { flags: ['a', 'b'], content: '鎮長是老約翰的女兒。', note: 'a 與 b' },
    { flags: ['a'], replace: [['老約翰', '小約翰'], ['找不到的原文', '不會出現']] },
    { flags: [], content: '沒有旗標的變體不算。' },
  ],
  ...patch,
})

describe('resolveLoreVariant', () => {
  it('uses the default content without flags or without a matching variant', () => {
    expect(resolveLoreVariant(custom())).toEqual({ content: '鎮長是老約翰。鎮上很安靜。' })
    expect(resolveLoreVariant(custom(), flags())).toEqual({ content: '鎮長是老約翰。鎮上很安靜。' })
    expect(resolveLoreVariant(custom(), flags('b')).variant).toBeUndefined()
  })

  it('takes the first variant whose flags are all set', () => {
    expect(resolveLoreVariant(custom(), flags('a', 'b')).content).toBe('鎮長是老約翰的女兒。')
    // replace 換掉找得到的段落，找不到的略過
    expect(resolveLoreVariant(custom(), flags('a')).content).toBe('鎮長是小約翰。鎮上很安靜。')
  })

  it('applies replace on top of a variant content', () => {
    const it = custom({ variants: [{ flags: ['a'], content: '老約翰走了。', replace: [['走了', '回來了']] }] })
    expect(resolveLoreVariant(it, flags('a')).content).toBe('老約翰回來了。')
  })
})

describe('pickLore with story flags', () => {
  it('injects the variant content and reports which variant applied', () => {
    const q = { text: '來到小鎮', travel: false }
    const plain = pickLore([custom()], q, opts)
    expect(plain.triggered[0]!.content).toBe('鎮長是老約翰。鎮上很安靜。')
    expect(plain.states[100000]!.variant).toBeUndefined()
    const sel = pickLore([custom()], q, { ...opts, hasFlag: flags('a', 'b') })
    expect(sel.triggered[0]!.content).toBe('鎮長是老約翰的女兒。')
    expect(sel.states[100000]).toMatchObject({ status: 'triggered', hit: '小鎮', variant: 'a 與 b', position: 1 })
    expect(sel.chars).toBe('鎮長是老約翰的女兒。'.length)
  })

  it('keeps the player\'s edited text of a built-in entry: only replace variants apply', () => {
    const edited = '炎华之地（东大陆）:\n  政治格局:\n    女帝: \'燁昭华，登基五年。\'\n化龙族的国家「大烨」（朝廷）统治全域；'
    const items = loreItems(book, { 55: { content: edited } })
    const it = items.find((x) => x.uid === 55)!
    expect(it.edited).toBe(true)
    expect(it.variants?.every((v) => v.content === undefined && v.replace?.length)).toBe(true)
    // 玩家的文字留著，找得到的原文照樣換掉
    expect(resolveLoreVariant(it, flags('yhpol_republic')).content).toBe(edited.replace('（朝廷）', '（如今是公议会治国的共和）'))
  })
})

describe('built-in political variants of 炎華之地', () => {
  const items = loreItems(book)
  // 大燁的政體（east_p4c_lore.py）：北原的條目另外看媞丹的走向與南北交會（east_p8_lore.py），在下面測
  const withVariants = items.filter((it) => it.variants?.some((v) => v.flags.some((f) => f.startsWith('yhpol_'))))

  it('covers the three endings on the 炎華 entries', () => {
    expect(withVariants.map((it) => it.comment).sort()).toEqual(['人物-炎华南域', '区域-炎华南域', '区域地理与势力划分概述', '埃隆迪亚大陆'].sort())
    for (const it of withVariants) expect(it.variants!.map((v) => v.flags)).toEqual(ENDINGS.map((f) => [f]))
  })

  it('finds every replaced passage exactly once in the default text', () => {
    for (const it of withVariants) {
      for (const v of it.variants!) {
        for (const [from, to] of v.replace ?? []) {
          expect(it.content.split(from).length - 1, `${it.comment}：${from.slice(0, 20)}`).toBe(1)
          expect(to).not.toBe(from)
        }
      }
    }
  })

  it('describes each ending in the region entry', () => {
    const region = items.find((it) => it.uid === 55)!
    const text = (f: string) => resolveLoreVariant(region, flags(f)).content
    expect(text('yhpol_republic')).toContain('公议会')
    expect(text('yhpol_republic')).not.toContain('登基五年')
    expect(text('yhpol_monarchy')).toContain('亲政')
    expect(text('yhpol_constitution')).toContain('五席')
    // 其他段落不動
    for (const f of ENDINGS) expect(text(f)).toContain('永昭陵（地下城）')
  })
})

describe('narration prompt follows the political ending', () => {
  const longan: Report = { ...combat, lore_keys: ['龙安府'] }
  const options = (): ComposeOptions => ({ config: defaultPromptConfig(), lore: loreItems(book), budgetChars: 50000, language: 'zh-Hans' })
  const game = () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 16 })
    enterLocation(state)
    return state
  }
  const regionLore = (lore: { triggered: LoreItem[] } | undefined) => lore!.triggered.find((e) => e.uid === 55)!.content

  it('is unchanged without an ending flag', () => {
    const { lore, prompt } = composeNarration(game(), longan, options())
    expect(regionLore(lore)).toBe(book.entries['55']!.content)
    expect(prompt.user).toContain('登基五年')
    expect(lore!.states[55]!.variant).toBeUndefined()
  })

  it('describes the republic once yhpol_republic is set', () => {
    const state = game()
    setFlag(state, 'yhpol_republic')
    const { lore, prompt } = composeNarration(state, longan, options())
    expect(regionLore(lore)).toContain('公议会')
    expect(lore!.states[55]!.variant).toContain('共和制')
    expect(prompt.user).toContain('公议会在太学的讲堂开议')
    expect(prompt.user).not.toContain('登基五年')
    // 常駐的大陸概述也跟著換
    expect(prompt.system).toContain('大烨公议会')
    expect(prompt.system).not.toContain('女帝燁昭华在位')
  })

  it('selects with the report helper too', () => {
    expect(loreForReport(loreItems(book), longan, { ...opts, hasFlag: flags('yhpol_monarchy') }).triggered.find((e) => e.uid === 55)!.content).toContain('亲政')
  })
})

describe('worldbook export and import keep the variants', () => {
  it('round-trips built-in and custom variants through the SillyTavern file', () => {
    const items = loreItems(book, {}, [custom()])
    const file = JSON.parse(JSON.stringify(exportWorldbook(items))) as { entries: Record<string, { extensions: { elondia: Record<string, unknown> } }> }
    expect(file.entries['55']!.extensions.elondia.variants).toEqual(items.find((it) => it.uid === 55)!.variants)
    const back = parseWorldbookFile(file)
    const region = back.find((e) => e.uid === 55)!
    expect(region).toMatchObject({ builtin: true, variants: items.find((it) => it.uid === 55)!.variants })
    // 沒有旗標的變體在讀檔時丟掉
    expect(back.find((e) => e.uid === 100000)!.variants).toEqual(custom().variants!.slice(0, 2))
    expect(back.find((e) => e.uid === 44)!.variants).toBeUndefined()
  })

  it('drops malformed variants from a file', () => {
    const [e] = parseWorldbookFile({ entries: { 1: { uid: 1, key: [], content: '內容', extensions: { elondia: { variants: [
      { flags: ['x'], replace: [['內容', '新內容'], ['只有一個']] },
      { flags: 'x', content: '旗標不是陣列' },
      { flags: ['x'] },
      null,
    ] } } } } })
    expect(e!.variants).toEqual([{ flags: ['x'], replace: [['內容', '新內容']] }])
  })
})

describe('built-in variants of 炎華北原 (媞丹的走向 and 南北交會)', () => {
  const items = loreItems(book)
  const region = items.find((it) => it.comment === '区域-炎华北原')!
  const people = items.find((it) => it.comment === '人物-炎华北原')!

  it('lists the reachable combinations before the early endings alone', () => {
    for (const it of [region, people]) {
      const keys = it.variants!.map((v) => v.flags.join('+'))
      expect(keys.length, it.comment).toBe(11)
      expect(keys.slice(-3), it.comment).toEqual(['tdpol_khanate', 'tdpol_south', 'tdpol_haidong'])
      for (const v of it.variants!) for (const [from] of v.replace ?? []) expect(it.content.split(from).length - 1, `${it.comment}：${from.slice(0, 20)}`).toBe(1)
    }
  })

  it('describes the early ending, then the later one on top of it', () => {
    const text = (it: typeof region, ...f: string[]) => resolveLoreVariant(it, flags(...f)).content
    expect(text(region, 'tdpol_khanate')).toContain('大汗国')
    expect(text(region, 'tdpol_khanate', 'nspol_war_yanye')).toContain('鹰河以北三百里划给大烨')
    expect(text(region, 'tdpol_haidong', 'nspol_sea')).toContain('海上之盟')
    // 沒有人死：輸的一方被軟禁、幽禁或關起來
    expect(text(people, 'tdpol_khanate', 'nspol_war_yanye')).toContain('龍安府・皇城的天牢')
    expect(text(people, 'tdpol_south', 'nspol_alliance')).toContain('软禁在金帐后面')
    expect(text(people, 'tdpol_haidong', 'nspol_sea')).toContain('幽禁在金帐后面')
    // 沒有結局時照原本的寫
    expect(text(region)).toBe(region.content)
  })
})
