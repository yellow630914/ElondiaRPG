import { afterEach, describe, expect, it } from 'vitest'
import { enemies, itemRules, lewdRules, perkRules, statuses } from '@/engine/data'
import { travelEvents } from '@/engine/road'
import { applyContent, emptyMods, newItem, normalizeMods } from '@/engine/mods'
import { itemObtainable, itemSourceIndex, sourcesOf } from '@/engine/sources'

afterEach(() => applyContent(emptyMods()))

/** 已知拿不到、暫時擱置的（docs/plan/LOGIC_ISSUES.md） */
const KNOWN_ITEMS = ['哥布林左耳']

describe('內容的來源（怎麼拿到）', () => {
  it('每件物品都有地方拿得到（已知擱置的除外）', () => {
    const none = itemRules.items.filter((i) => !sourcesOf('item', i.name).length).map((i) => i.name)
    expect(none).toEqual(KNOWN_ITEMS)
  })

  it('每個特質都學得到，每個狀態都會出現，每隻怪物都遇得到', () => {
    expect(perkRules.perks.filter((p) => !sourcesOf('perk', p.id).length).map((p) => p.id)).toEqual([])
    expect(Object.keys(statuses).filter((id) => !sourcesOf('status', id).length)).toEqual([])
    expect(Object.keys(enemies).filter((id) => !sourcesOf('enemy', id).length)).toEqual([])
  })

  it('列出的來源', () => {
    expect(sourcesOf('item', '奴隸項圈')).toEqual(['主人強制裝上'])
    expect(sourcesOf('item', '星隕鐵長劍')[0]).toContain('依等級隨機生成')
    expect(sourcesOf('item', '魅魔的香精')).toContain('慾望勝利的征服掉落：魔族')
    expect(sourcesOf('perk', 'school_beast')).toEqual(['受訓：魔法物品店、情報商'])
    expect(sourcesOf('perk', 'race_elf')[0]).toContain('天生')
    expect(sourcesOf('status', 'defending')).toEqual(['戰鬥中選「防禦」'])
    expect(sourcesOf('status', 'tide_bride')[0]).toContain('潮之新娘')
    expect(sourcesOf('enemy', Object.values(lewdRules.park.mimics)[0]!)[0]).toContain('擬態寶箱')
  })

  it('交出物品列出來但不算拿得到；層名照遊戲的「底層」；資源格的說法和編輯欄位一致', () => {
    expect(sourcesOf('item', '乾糧')).toContain('旅途事件「受傷的旅人」（交出）')
    expect(sourcesOf('item', '乾糧')).toContain('旅途事件「路上被認出來」')
    const all = itemRules.items.flatMap((i) => sourcesOf('item', i.name))
    expect(all.some((x) => /寶箱.*：.*深淵/.test(x))).toBe(false)
    expect(all.some((x) => /寶箱.*：.*底層/.test(x))).toBe(true)
    expect(sourcesOf('item', '藥草')).toContain('近郊的資源格')
  })

  it('清單篩選的取得方式和「跟誰有關」一致：沒有取得方式的就是拿不到的', () => {
    const idx = itemSourceIndex()
    const none = [...idx].filter(([, s]) => s.has('none')).map(([n]) => n)
    expect(none).toEqual(KNOWN_ITEMS)
    expect(itemRules.items.filter((i) => !itemObtainable(i.name)).map((i) => i.name)).toEqual(KNOWN_ITEMS)
    expect(idx.get('野莓派')?.has('craft')).toBe(true)
    expect(idx.get('狼皮')?.has('drop')).toBe(true)
    expect(idx.get('乾糧')?.has('shop')).toBe(true)
  })

  it('只會被交出的自建物品算拿不到', () => {
    const ev = JSON.parse(JSON.stringify(travelEvents.templates.find((t) => t.title === '受傷的旅人')))
    ev.id = 'zz_give'
    ev.custom = true
    for (const o of ev.options ?? []) for (const e of o.success?.effects ?? []) if (e.type === 'item') e.name = '測試用的信物'
    applyContent(normalizeMods({ ...emptyMods(), items: { 測試用的信物: { ...newItem('測試用的信物'), category: 'gear', price_cc: 1 } }, travelEvents: { zz_give: ev } }))
    expect(sourcesOf('item', '測試用的信物')).toEqual(['旅途事件「受傷的旅人」（交出）'])
    expect(itemObtainable('測試用的信物')).toBe(false)
    expect(itemSourceIndex().get('測試用的信物')).toEqual(new Set(['none']))
  })

  it('內容套用之後重建：自建的物品放上商店就有來源', () => {
    expect(sourcesOf('item', '測試用的石頭')).toEqual([])
    const item = { ...newItem('測試用的石頭'), tags: ['general'] }
    applyContent(normalizeMods({ ...emptyMods(), items: { 測試用的石頭: item } }))
    expect(sourcesOf('item', '測試用的石頭')).toContain('商店：雜貨店')
  })
})


describe('劇情旗標', () => {
  /** 已知沒有地方設定、等作者決定的（奧托三世：見 docs/plan/LOGIC_ISSUES.md） */
  const KNOWN_FLAGS = ['rhine_emperor_seen']
  const files = import.meta.glob('../../data/{rules,world}/*.json', { eager: true, import: 'default' })

  it('條件要的旗標都有地方設定（任務、事件、引擎的前綴、AI 判定）', () => {
    const required = new Set<string>()
    const set = new Set<string>()
    const prefixes = ['ai:', 'park_stamp_']
    const walk = (n: unknown) => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(walk)
      const o = n as Record<string, unknown>
      for (const k of ['flags', 'flags_any']) if (Array.isArray(o[k])) for (const f of o[k] as unknown[]) if (typeof f === 'string') required.add(f)
      for (const k of ['set_flags', 'start_flags']) if (Array.isArray(o[k])) for (const f of o[k] as string[]) set.add(f)
      if (o.type === 'flag' && typeof o.key === 'string') set.add(o.key)
      if (typeof o.watch_flag === 'string') set.add(o.watch_flag)
      if (typeof o.flag_prefix === 'string') prefixes.push(o.flag_prefix)
      Object.values(o).forEach(walk)
    }
    Object.values(files).forEach(walk)
    const missing = [...required].filter((f) => !set.has(f) && !prefixes.some((p) => f.startsWith(p)))
    expect(missing).toEqual(KNOWN_FLAGS)
  })
})
