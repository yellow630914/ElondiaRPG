import { afterEach, describe, expect, it } from 'vitest'
import { abilities, classes, combatClasses, npcClassIds, npcs, npcTags } from '@/engine/data'
import { gearRules } from '@/engine/gear'
import { applyContent, emptyMods, normalizeMods, type ContentMods } from '@/engine/mods'
import {
  builtinClassMod, classModOf, classUsage, editableClassIds, levelPoolSizes, newClassMod, sanitizeClassMod,
} from '@/engine/classMods'
import { builtinWorldEntries } from '@/engine/builtinWorld'
import { pickNpcClass } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { assertClasses, migrate, newGame } from '@/engine/state'

afterEach(() => applyContent(emptyMods()))
const mods = (classMods: ContentMods['classes'], extra: Partial<ContentMods> = {}): ContentMods => ({ ...emptyMods(), ...extra, classes: classMods })

describe('新職業：武夫、仙術師', () => {
  it('都是可以選的戰鬥職業，有裝備模板與初始能力', () => {
    for (const id of ['wufu', 'xianshi']) {
      expect(combatClasses[id], id).toBeTruthy()
      expect(gearRules.classes[id], id).toBeTruthy()
      for (const a of classes[id]!.start) expect(abilities[a]?.classes, `${id} ${a}`).toContain(id)
    }
    expect(classes.xianshi!.caster).toBe('full')
    expect(classes.wufu!.caster).toBe('none')
  })

  it('2～20 級每一級都至少有 6 個能力可以選（能重抽）', () => {
    for (const id of Object.keys(combatClasses)) {
      const pools = levelPoolSizes(id)
      expect(pools, id).toHaveLength(19)
      expect(Math.min(...pools), id).toBeGreaterThanOrEqual(6)
    }
  })

  it('NPC 會隨機抽到（給 NPC）', () => {
    expect(npcClassIds()).toEqual(expect.arrayContaining(['wufu', 'xianshi']))
    const rng = new Rng(3)
    const seen = new Set(Array.from({ length: 400 }, () => pickNpcClass(rng)))
    expect(seen.has('wufu')).toBe(true)
    expect(seen.has('xianshi')).toBe(true)
  })
})

describe('讀檔：存檔用到不存在的職業時讀取失敗', () => {
  it('隊伍或 NPC 的職業不存在就丟出錯誤，不讀取', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'wufu', seed: 1 })
    expect(() => assertClasses(state)).not.toThrow()
    pcOf(state).class = 'mod_cls_gone'
    expect(() => migrate(state)).toThrow(/沒有的職業（mod_cls_gone）/)
    pcOf(state).class = 'wufu'
    state.npcs = { x: { id: 'x', name: 'x', class: 'mod_cls_gone2' } as never }
    expect(() => migrate(state)).toThrow(/mod_cls_gone2/)
  })
})

describe('職業的編輯', () => {
  it('打開內建職業不改就存，和內建一樣', () => {
    for (const id of editableClassIds()) {
      const b = builtinClassMod(id)!
      expect(sanitizeClassMod(classModOf(id), false), id).toEqual(sanitizeClassMod(b, false))
      expect(sanitizeClassMod(sanitizeClassMod(b, false), false), id).toEqual(sanitizeClassMod(b, false))
    }
  })

  it('改內建職業：NPC 權重、身分標籤倍率、生命骰；恢復預設後還原', () => {
    const f = classModOf('fighter')
    applyContent(mods({ fighter: sanitizeClassMod({ ...f, hit_die: 12, npc_weight: 0, tag_mult: { villain: 3 } }, false) }))
    expect(classes.fighter!.hit_die).toBe(12)
    expect(npcClassIds()).not.toContain('fighter')
    expect(npcTags.tags.villain!.class_mult?.fighter).toBe(3)
    const rng = new Rng(9)
    for (let i = 0; i < 300; i++) expect(pickNpcClass(rng)).not.toBe('fighter')
    applyContent(emptyMods())
    expect(classes.fighter!.hit_die).toBe(10)
    expect(npcClassIds()).toContain('fighter')
    expect(npcTags.tags.villain!.class_mult?.fighter).toBeUndefined()
  })

  it('新增自建職業：自建能力可以指定它、可以建角；刪掉後還原', () => {
    const c = { ...newClassMod(), name: '符劍士', start: ['mod_ability_slash'] }
    const ability = {
      id: 'mod_ability_slash', name: '符劍斬', type: 'skill', classes: ['mod_cls_talisman'], unlock: 1, ap: 2, attr: 'str', target: 'enemy', resolve: 'attack',
      damage: [{ weapon: true }], desc: '測試', custom: true,
    }
    const m = normalizeMods(mods({ mod_cls_talisman: c }, { abilities: { mod_ability_slash: ability as never } }))
    expect(m.classes?.mod_cls_talisman?.custom).toBe(true)
    expect(m.classes?.mod_cls_talisman?.start).toEqual(['mod_ability_slash'])
    expect(m.abilities.mod_ability_slash?.classes).toEqual(['mod_cls_talisman'])
    applyContent(m)
    expect(combatClasses.mod_cls_talisman?.name).toBe('符劍士')
    expect(editableClassIds()).toContain('mod_cls_talisman')
    const state = newGame({ name: '艾倫', race: 'human', classId: 'mod_cls_talisman', seed: 2 })
    expect(pcOf(state).abilities).toContain('mod_ability_slash')
    expect(pcOf(state).gear?.main_hand).toBeTruthy()
    expect(classUsage('mod_cls_talisman', state)).toEqual([expect.stringContaining('目前存檔的隊伍')])
    applyContent(emptyMods())
    expect(classes.mod_cls_talisman).toBeUndefined()
    expect(combatClasses.mod_cls_talisman).toBeUndefined()
  })

  it('整理：數值夾在範圍內，不認得的能力、底材、標籤拿掉，屬性順序補齊', () => {
    const c = sanitizeClassMod({
      name: '很長很長很長很長的名字', hit_die: 7, threat: { start: 99, mult: 9 }, priority: ['int', 'int', 'str'] as never, caster: 'full',
      start: ['fire_bolt', 'nope'], npc_weight: 99, tag_mult: { villain: 50, nope: 2 }, resist: { fire: -2, nope: 1 } as never,
      gear: { start: { main_hand: 'shield', body: 'robe' }, main: ['longsword', 'shield'], off: [], body: [], pieces: 'jewel' as never },
    }, true)
    expect(c.name).toHaveLength(8)
    expect(c.hit_die).toBe(8)
    expect(c.threat).toEqual({ start: 20, mult: 2 })
    expect(c.priority).toEqual(['int', 'str', 'dex', 'fai', 'cha'])
    expect(c.casting).toBe('int')
    expect(c.start).toEqual(['fire_bolt'])
    expect(c.npc_weight).toBe(5)
    expect(c.tag_mult).toEqual({ villain: 10 })
    expect(c.resist).toEqual({ fire: -0.5 })
    expect(c.gear.start).toEqual({ body: 'robe' })
    expect(c.gear.main).toEqual(['longsword'])
    expect(c.gear.pieces).toBe('cloth')
  })

  it('固定 NPC 用到的職業不能刪', () => {
    const someone = npcs.find((n) => n.class === 'wizard')!
    expect(classUsage('wizard')).toContain(`固定 NPC「${someone.name}」`)
  })

  it('內建世界的匯出帶上職業（整理過的樣子）', () => {
    const e = builtinWorldEntries()
    expect(Object.keys(e.classes ?? {})).toEqual(expect.arrayContaining(['fighter', 'wufu', 'xianshi']))
    expect(e.classes).not.toHaveProperty('noncombatant')
  })
})
