// 匯出、匯入內建世界（engine/builtinWorld.ts）：沒改的不記、改過的與新增的才記，內建的刪不掉、id 改了等於新增
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { enemies, shopRules } from '@/engine/data'
import { BUILTIN_SECTIONS, readBuiltinWorldZip } from '@/engine/builtinWorld'
import { applyContent, emptyMods } from '@/engine/mods'
import { useContent } from '@/stores/content'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

type Files = Record<string, Uint8Array>
const ROOT = 'elondia-builtin-world/'
const read = (files: Files, path: string) => JSON.parse(strFromU8(files[ROOT + path]!)) as Record<string, Record<string, unknown>>
const write = (files: Files, path: string, v: unknown) => {
  files[ROOT + path] = strToU8(JSON.stringify(v, null, 2))
}

describe('export the built-in world', () => {
  it('writes every section, a manifest and the README in md and txt', () => {
    const files = unzipSync(useContent().exportBuiltinWorld(new Date('2026-11-02T00:00:00Z')))
    for (const s of BUILTIN_SECTIONS) expect(files[`${ROOT}content/${s.key}.json`], s.key).toBeTruthy()
    const manifest = JSON.parse(strFromU8(files[`${ROOT}world.json`]!))
    expect(manifest.type).toBe('elondia-builtin-world')
    expect(manifest.exported).toBe('2026-11-02')
    expect(manifest.sections.find((s: { key: string }) => s.key === 'enemies').count).toBe(Object.keys(enemies).length)
    const md = strFromU8(files[`${ROOT}README.md`]!)
    expect(md).toContain('內建的項目不能刪除')
    expect(md).toContain('id 不能改')
    expect(md).toContain('有關聯的修改要特別小心')
    const txt = strFromU8(files[`${ROOT}README.txt`]!)
    expect(txt).toContain('\r\n')
    expect(txt).not.toContain('**')
    expect(txt).not.toContain('|---')
  })

  it('exports the built-in content even when another world is active', () => {
    const content = useContent()
    const id = content.createWorld('別的世界')
    content.switchWorld(id)
    content.saveEnemy('goblin', { ...enemies.goblin!, name: '改過的哥布林' })
    expect(enemies.goblin!.name).toBe('改過的哥布林')
    const files = unzipSync(content.exportBuiltinWorld())
    expect(read(files, 'content/enemies.json').goblin!.name).toBe('哥布林')
    // 匯出完恢復成目前的世界
    expect(enemies.goblin!.name).toBe('改過的哥布林')
  })
})

describe('import the built-in world', () => {
  it('records nothing when nothing changed: every section reads back the same as built-in, and no world is made', () => {
    const content = useContent()
    const r = content.importBuiltinWorld(content.exportBuiltinWorld(), '原封不動')
    expect(r.report.summary).toBe('沒有任何改動')
    expect(r.report.lines).toEqual([])
    expect(r.diff.adjusted).toEqual([])
    expect(r.diff.skipped).toEqual([])
    // 什麼都沒改：不建立世界
    expect(r.id).toBeUndefined()
    expect(content.worlds.some((w) => w.name === '原封不動')).toBe(false)
  })

  it('keeps only changed and new entries, cannot delete built-ins, and a new id is a new entry', () => {
    const content = useContent()
    const files = unzipSync(content.exportBuiltinWorld())
    const monsters = read(files, 'content/enemies.json')
    // 改：哥布林的名字與魔物娘的性情
    monsters.goblin = { ...monsters.goblin, name: '綠皮小鬼', girl: { ...(monsters.goblin!.girl as object), personality: '好奇又膽小' } }
    // 刪：拿掉巨鼠（內建的刪不掉）
    delete monsters.giant_rat
    // id 改了：等於新增一筆
    monsters.mod_enemy_fox = { ...monsters.wolf, name: '赤狐' }
    write(files, 'content/enemies.json', monsters)
    // 商店：內建的只能改部分欄位，名字改了不算
    const shops = read(files, 'content/shops.json')
    shops.general = { ...shops.general, name: '改不了的名字', desc: '新的說明' }
    write(files, 'content/shops.json', shops)
    const r = content.importBuiltinWorld(zipSync(files), '我的修改', 'mine.zip')
    expect(r.diff.changed).toEqual({ enemies: ['goblin'], shops: ['general'] })
    expect(r.diff.added).toEqual({ enemies: ['mod_enemy_fox'] })
    expect(r.report.summary).toBe('改了 怪物 1、商店 1；新增 怪物 1')
    // 匯入結果記在新的世界上，重新載入也還在
    const w = content.worlds.find((x) => x.id === r.id)!
    expect(w.importReport).toMatchObject({ file: 'mine.zip', summary: r.report.summary, warn: false })
    setActivePinia(createPinia())
    expect(useContent().worlds.find((x) => x.id === r.id)?.importReport?.summary).toBe(r.report.summary)
    // 切到新的世界：改的生效、刪不掉的照原版、新增的是自建
    content.switchWorld(r.id!)
    expect(enemies.goblin!.name).toBe('綠皮小鬼')
    expect(enemies.goblin!.girl?.personality).toBe('好奇又膽小')
    expect(enemies.giant_rat?.name).toBe('巨鼠')
    expect(enemies.mod_enemy_fox?.name).toBe('赤狐')
    expect(shopRules.types.general!.desc).toBe('新的說明')
    expect(shopRules.types.general!.name).toBe('雜貨店')
    expect(content.mods.enemies.mod_enemy_fox?.custom).toBe(true)
  })

  it('reports fields the rules adjusted and entries it skipped', () => {
    const content = useContent()
    const files = unzipSync(content.exportBuiltinWorld())
    const monsters = read(files, 'content/enemies.json')
    monsters.goblin = { ...monsters.goblin, level: 999 }
    write(files, 'content/enemies.json', monsters)
    // 自建的非戰鬥狀態要用 mod_cond_ 開頭
    const conds = read(files, 'content/conditions.json')
    conds.my_buff = { name: '好心情', desc: '檢定 +1', check_penalty: -1 }
    write(files, 'content/conditions.json', conds)
    const r = content.importBuiltinWorld(zipSync(files), '有問題的修改')
    // 被調整的欄位寫出前後的值
    expect(r.diff.adjusted.some((x) => x.startsWith('怪物 哥布林：') && x.includes('level：999 → 30'))).toBe(true)
    expect(r.diff.skipped.some((x) => x.includes('好心情'))).toBe(true)
    expect(r.diff.changed.enemies).toEqual(['goblin'])
  })

  it('reads a zip re-packed without the top folder, and skips a broken file without losing the rest', () => {
    const content = useContent()
    const files = unzipSync(content.exportBuiltinWorld())
    const flat: Files = {}
    for (const [k, v] of Object.entries(files)) flat[k.slice(ROOT.length)] = v
    const monsters = JSON.parse(strFromU8(flat['content/enemies.json']!))
    monsters.goblin.name = '平鋪的哥布林'
    flat['content/enemies.json'] = strToU8(JSON.stringify(monsters))
    flat['content/items.json'] = strToU8('{ "壞掉的": ')
    flat['content/notes.json'] = strToU8('{}')
    const back = readBuiltinWorldZip(zipSync(flat))
    expect((back.content.enemies as Record<string, { name: string }>).goblin!.name).toBe('平鋪的哥布林')
    expect(back.content.items).toBeUndefined()
    expect(back.errors.some((e) => e.includes('物品'))).toBe(true)
    expect(back.errors.some((e) => e.includes('notes.json'))).toBe(true)
  })

  it('refuses files that are not an exported built-in world', () => {
    expect(() => readBuiltinWorldZip(strToU8('not a zip'))).toThrow('zip')
    expect(() => readBuiltinWorldZip(zipSync({ 'a.json': strToU8('{}') }))).toThrow('world.json')
    expect(() => readBuiltinWorldZip(zipSync({ 'world.json': strToU8('{"type":"other"}') }))).toThrow('不是')
  })
})

describe('saving a built-in entry unchanged keeps its data', () => {
  // 以前在內容編輯器改了這些項目（任何一個欄位）再存，原本的資料會被拿掉或改掉
  it('keeps unique tags, lust max, decimal weights, small resists, short hours, long statuses, big multipliers and park gates', async () => {
    const { abilities, companionRules, enemies: monsters, itemDef, masterEventPool, perkRules, specialMaps } = await import('@/engine/data')
    const { normalizeMods } = await import('@/engine/mods')
    const pick = <T>(v: T) => JSON.parse(JSON.stringify(v)) as T
    const lucky = perkRules.perks.find((p) => p.id === 'lucky')!
    const elf = perkRules.perks.find((p) => p.id === 'race_elf')!
    const reward = masterEventPool('master').find((e) => e.id === 'reward')!
    const out = normalizeMods({
      version: 1,
      items: { 緋夢夫人的晚禮服: pick(itemDef('緋夢夫人的晚禮服')!) },
      conditions: { virile: pick(companionRules.conditions.virile!) },
      perks: { lucky: pick(lucky), race_elf: pick(elf) },
      masterEvents: { reward: { ...pick(reward), pool: 'master' } },
      abilities: { lust_hot_spring: pick(abilities.lust_hot_spring!) },
      enemies: { crusade_inquisitor: pick(monsters.crusade_inquisitor!) },
      specialMaps: { sm_lust_park: pick(specialMaps.sm_lust_park!) },
    })
    expect(out.items['緋夢夫人的晚禮服']!.tags).toContain('unique')
    expect(out.conditions.virile!.combat_lust_max).toBe(0.2)
    expect(out.perks.lucky!.npc?.weight).toBe(0.5)
    expect(JSON.stringify(out.perks.race_elf!.effects)).toContain('"lust":-0.1')
    expect(out.masterEvents!.reward!.hours).toBe(0.1)
    expect(out.abilities.lust_hot_spring!.apply![0]!.turns).toBe(99)
    expect(out.enemies.crusade_inquisitor!.offense?.all).toBe(monsters.crusade_inquisitor!.offense?.all)
    const garden = out.specialMaps.sm_lust_park!.connections!.find((c) => c.to.area === 'dungeon/forbidden_garden')
    expect(garden?.requires?.flags).toHaveLength(5)
  })
})

describe('import feedback', () => {
  it('explains JSON errors in Chinese with line and column', async () => {
    const { jsonErrorText } = await import('@/engine/builtinWorld')
    const why = (text: string) => {
      try {
        JSON.parse(text)
      } catch (e) {
        return jsonErrorText(text, e)
      }
      return ''
    }
    expect(why('{\n  "a": 1\n  "b": 2\n}')).toBe('第 3 行第 3 字附近：少了逗號（,）或右大括號（}）')
    expect(why('{\n  "a": 1,\n}')).toMatch(/^第 3 行第 1 字附近：.*多了逗號/)
    expect(why('{ "a": [1, 2 }')).toContain('右中括號')
    expect(why('{ "a": ')).toContain('檔案在中途就結束了')
    expect(why("{ 'a': 1 }")).toContain('第 1 行第 3 字附近')
    // 認不得的原因附上原文
    expect(jsonErrorText('', new Error('something odd'))).toBe('JSON 格式錯誤（something odd）')
  })

  it('warns when a file cannot be read: that kind stays built-in, and the rest is still imported', () => {
    const content = useContent()
    const files = unzipSync(content.exportBuiltinWorld())
    files[ROOT + 'content/items.json'] = strToU8('{\n  "解毒劑": {}\n  "x": 1\n}')
    const monsters = read(files, 'content/enemies.json')
    monsters.goblin = { ...monsters.goblin, name: '綠皮小鬼' }
    write(files, 'content/enemies.json', monsters)
    const r = content.importBuiltinWorld(zipSync(files), '有壞檔')
    expect(r.id).toBeTruthy()
    expect(r.report.warn).toBe(true)
    const bad = r.report.lines.find((l) => l.label.startsWith('讀不了'))!
    expect(bad.items).toEqual(['物品（content/items.json）讀不了，物品全部照原版：第 3 行第 3 字附近：少了逗號（,）或右大括號（}）'])
  })
})

describe('import edge cases', () => {
  it('skips entries that are not objects and keeps the built-in one', () => {
    const content = useContent()
    const files = unzipSync(content.exportBuiltinWorld())
    const monsters = read(files, 'content/enemies.json') as Record<string, unknown>
    monsters.goblin = null
    monsters.wolf = 'abc'
    monsters.bandit = [] as unknown
    monsters.giant_rat = { ...(monsters.giant_rat as object), name: '大老鼠' }
    write(files, 'content/enemies.json', monsters)
    const r = content.importBuiltinWorld(zipSync(files), '壞掉的幾筆')
    expect(r.diff.changed).toEqual({ enemies: ['giant_rat'] })
    expect(r.diff.skipped.filter((x) => x.includes('整筆略過（內建的照原版）'))).toHaveLength(3)
    content.switchWorld(r.id!)
    expect(enemies.goblin!.name).toBe('哥布林')
    expect(enemies.wolf!.name).toBe('灰狼')
  })

  it('trims ids before matching built-ins, and skips duplicates after trimming', () => {
    const content = useContent()
    const files = unzipSync(content.exportBuiltinWorld())
    const monsters = read(files, 'content/enemies.json')
    const goblin = monsters.goblin!
    delete monsters.goblin
    monsters[' goblin '] = { ...goblin, name: '綠皮小鬼' }
    monsters['wolf '] = { ...monsters.wolf, name: '重複的灰狼' }
    write(files, 'content/enemies.json', monsters)
    const r = content.importBuiltinWorld(zipSync(files), '空白')
    expect(r.diff.changed).toEqual({ enemies: ['goblin'] })
    expect(r.diff.added).toEqual({})
    expect(r.diff.adjusted).toEqual([])
    expect(r.diff.skipped.some((x) => x.includes('重複'))).toBe(true)
  })

  it('warns when an item name differs from its key', () => {
    const content = useContent()
    const files = unzipSync(content.exportBuiltinWorld())
    const items = read(files, 'content/items.json')
    items['乾糧'] = { ...items['乾糧'], name: '乾糧改' }
    write(files, 'content/items.json', items)
    const r = content.importBuiltinWorld(zipSync(files), '改名')
    expect(r.id).toBeUndefined()
    expect(r.report.lines.some((l) => l.items.some((x) => x.includes('要改名請改鍵')))).toBe(true)
  })

  it('a dry run checks without making a world', () => {
    const content = useContent()
    const files = unzipSync(content.exportBuiltinWorld())
    const monsters = read(files, 'content/enemies.json')
    monsters.goblin = { ...monsters.goblin, name: '綠皮小鬼' }
    write(files, 'content/enemies.json', monsters)
    const r = content.importBuiltinWorld(zipSync(files), '試試', '', { dryRun: true })
    expect(r.id).toBeUndefined()
    expect(r.diff.changed).toEqual({ enemies: ['goblin'] })
    expect(content.worlds).toHaveLength(0)
  })
})
