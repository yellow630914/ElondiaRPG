// 寄生物的自訂內容（engine/parasiteMods.ts）：整理、分類、套用與還原、同一包的任務引用、存檔裡不存在的寄生物
import { afterEach, describe, expect, it } from 'vitest'
import { lewdRules } from '@/engine/data'
import { applyContent, conditionUsage, emptyMods, normalizeMods, parasiteUsage } from '@/engine/mods'
import { builtinParasite, currentParasite, parasiteCategory, sanitizeParasiteMod } from '@/engine/parasiteMods'
import { attachParasite, detachParasite, parasiteDef, parasiteOf, parasiteRules, pruneParasites, refreshParasiteMarks, tameParasite, takeParasiteNotice } from '@/engine/parasites'
import { sanitizeTravelEvent } from '@/engine/travelEventMods'
import { itemUsage } from '@/engine/usage'
import { newGame } from '@/engine/state'

afterEach(() => applyContent(emptyMods()))

const seedLike = (extra: Record<string, unknown> = {}): never => ({
  name: '夜光蘑菇的孢子', kind: 'seed', category: 'short', desc: '吸進肺裡的孢子，會在體內發光。', grow_per_day: 25,
  stage_effects: [[], [{ check: { attrs: ['int'] }, bonus: -1 }], [], [{ check: { attrs: ['int'] }, bonus: -2 }]],
  remove: { dc: 12, price: 300 }, ...extra,
}) as never

describe('parasite mods', () => {
  it('keeps the built-in ones as they are, and sorts them into tameable and short-term', () => {
    for (const id of Object.keys(parasiteRules.parasites)) {
      expect(sanitizeParasiteMod(id, builtinParasite(id)!), id).toEqual(builtinParasite(id))
    }
    expect(parasiteCategory(parasiteDef('hungry_lingerie')!)).toBe('tameable')
    expect(parasiteCategory(parasiteDef('succubus_mark')!)).toBe('tameable')
    expect(parasiteCategory(parasiteDef('parasite_seed')!)).toBe('short')
    // 雙面效應跟著寄生物一起
    expect(builtinParasite('parasite_seed')!.two_face).toEqual(lewdRules.parasite_two_face!.parasites.parasite_seed)
  })

  it('checks ids, required parts and limits; short-term ones have no taming', () => {
    expect(() => sanitizeParasiteMod('spores', seedLike())).toThrow('mod_par_')
    expect(() => sanitizeParasiteMod('mod_par_cloth', { name: '活的披風', kind: 'gear', category: 'tameable', desc: '' })).toThrow('裝備')
    const p = sanitizeParasiteMod('mod_par_spores', seedLike({
      grow_per_day: 999, stage_lust: [0, 0, 0.5, 9], stage_abilities: [[], ['ghost_ability'], [], []],
      tamed: { scene: '不會留下', text: '不會留下' }, two_face: [{}, { dr: 1, foo: 3 }, {}, { save: 9 }],
    }))
    expect(p).toMatchObject({ kind: 'seed', category: 'short', grow_per_day: 50, stage_lust: [0, 0, 0.5, 1], custom: true })
    expect(p.tamed).toBeUndefined()
    expect(p.stage_abilities).toBeUndefined()
    expect(p.two_face).toEqual([{}, { dr: 1 }, {}, { save: 5 }])
    // 內建的不能改種類
    expect(sanitizeParasiteMod('parasite_seed', { ...builtinParasite('parasite_seed')!, kind: 'mark' }).kind).toBe('seed')
  })

  it('applies custom and edited ones (with their two-face rows), and restores the built-in ones', () => {
    const mods = normalizeMods({
      ...emptyMods(),
      parasites: {
        mod_par_spores: seedLike({ two_face: [{}, { dr: 1 }, { dr: 1 }, { dr: 2 }] }) as never,
        parasite_seed: { ...builtinParasite('parasite_seed')!, grow_per_day: 20 },
      },
    })
    applyContent(mods)
    expect(parasiteDef('mod_par_spores')?.name).toBe('夜光蘑菇的孢子')
    expect(lewdRules.parasite_two_face!.parasites.mod_par_spores?.[3]).toEqual({ dr: 2 })
    expect(parasiteDef('parasite_seed')?.grow_per_day).toBe(20)
    expect(currentParasite('mod_par_spores')?.custom).toBe(true)
    applyContent(emptyMods())
    expect(parasiteDef('mod_par_spores')).toBeUndefined()
    expect(lewdRules.parasite_two_face!.parasites.mod_par_spores).toBeUndefined()
    expect(parasiteDef('parasite_seed')?.grow_per_day).toBe(30)
  })

  it('lets a story in the same pack infect with a new parasite', () => {
    const mods = normalizeMods({
      ...emptyMods(),
      parasites: { mod_par_spores: seedLike() as never },
      stories: {
        mod_story_spores: {
          title: '洞窟的孢子', summary: '', rank: 'E', level: 1, giver: 'npc_mira',
          nodes: [{ id: 'a', title: '吸進孢子', kind: 'choice', at: { type: 'settlement', location: 'soriel' }, text: '……',
            options: [{ label: '深呼吸', success: { text: '你吸進了孢子。', effects: [{ type: 'parasite', parasite: 'mod_par_spores', op: 'add' }], complete: true } }] }],
        } as never,
      },
    })
    const effects = JSON.stringify(mods.stories.mod_story_spores)
    expect(effects).toContain('"parasite":"mod_par_spores"')
  })

  it('cleans saves that still carry a parasite this world no longer has', () => {
    applyContent(normalizeMods({
      ...emptyMods(),
      items: { 黏人的披風: { category: 'gear', price_cc: 100, gear: { base: 'cloak', material: 'cloth' }, custom: true } as never },
    }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' })
    const pc = state.party[0]!
    attachParasite(pc, 'hungry_lingerie', state.time)
    expect(pc.gear?.underwear_top?.locked).toBe('parasite:hungry_lingerie')
    // 假裝這種寄生物不在這個世界了
    const def = parasiteRules.parasites.hungry_lingerie!
    delete parasiteRules.parasites.hungry_lingerie
    try {
      expect(pruneParasites(state.party)).toBe(1)
      expect(pc.parasites ?? []).toEqual([])
      expect(pc.gear?.underwear_top?.name).toBe('渴求的魔導衣')
      expect(pc.gear?.underwear_top?.locked).toBeUndefined()
    } finally {
      parasiteRules.parasites.hungry_lingerie = def
    }
  })

  it('lists where a parasite is used before it can be deleted', () => {
    const used = parasiteUsage('parasite_seed')
    expect(used.some((u) => u.startsWith('發作事件'))).toBe(true)
    expect(used.some((u) => u.startsWith('事件'))).toBe(true)
    expect(parasiteUsage('mod_par_nobody')).toEqual([])
  })

  it('lists parasites where their items and taming buffs are used', () => {
    expect(itemUsage('渴求的魔導衣').some((u) => u.includes('寄生物「渴求的魔導衣」寄生的物品'))).toBe(true)
    expect(itemUsage('馴服的魔導衣').some((u) => u.includes('馴服後的物品'))).toBe(true)
    expect(conditionUsage('parasite_glow').some((u) => u.startsWith('寄生物'))).toBe(true)
  })

  it('keeps an outbreak event on its own parasite even when that parasite is missing', () => {
    const t = sanitizeTravelEvent('mod_event_x', { scope: 'parasite', parasite: 'mod_par_gone', title: '不見的', text: '…', kind: 'choice', options: [{ label: '好' }] } as never, true)
    expect(t.parasite).toBe('mod_par_gone')
  })

  it('removes and tames by what was attached, even after the definition changed', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' })
    const pc = state.party[0]!
    const def = parasiteRules.parasites.hungry_lingerie!
    const mark = parasiteRules.parasites.succubus_mark!
    try {
      // 魔導衣寄生之後改了欄位：解咒照樣拿掉鎖住的那件
      attachParasite(pc, 'hungry_lingerie', state.time)
      parasiteRules.parasites.hungry_lingerie = { ...def, slot: 'underwear_bottom' }
      detachParasite(pc, 'hungry_lingerie')
      expect(pc.gear?.underwear_top).toBeUndefined()
      // 契紋寄生之後改成種子：拿掉時印記一起洗掉
      attachParasite(pc, 'succubus_mark', state.time)
      parasiteRules.parasites.succubus_mark = { ...mark, kind: 'seed' }
      detachParasite(pc, 'succubus_mark')
      expect((pc.tattoos ?? []).some((t) => t.kind === 'curse')).toBe(false)
      // 馴服也照鎖找：改了欄位仍換成馴服後的物品
      parasiteRules.parasites.hungry_lingerie = def
      attachParasite(pc, 'hungry_lingerie', state.time)
      parasiteRules.parasites.hungry_lingerie = { ...def, slot: 'underwear_bottom' }
      tameParasite(pc, 'hungry_lingerie')
      expect(pc.gear?.underwear_top?.name).toBe('馴服的魔導衣')
      expect(pc.gear?.underwear_top?.locked).toBeUndefined()
    } finally {
      parasiteRules.parasites.hungry_lingerie = def
      parasiteRules.parasites.succubus_mark = mark
    }
  })

  it('updates marks already on the body when the parasite is edited', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' })
    const pc = state.party[0]!
    const mark = parasiteRules.parasites.succubus_mark!
    try {
      attachParasite(pc, 'succubus_mark', state.time)
      parasiteRules.parasites.succubus_mark = { ...mark, mark: { name: '新的契紋', desc: '改過的樣子' } }
      refreshParasiteMarks(state.party)
      expect(pc.tattoos!.find((t) => t.parasite === 'succubus_mark')).toMatchObject({ name: '新的契紋', desc: '改過的樣子' })
      tameParasite(pc, 'succubus_mark')
      parasiteRules.parasites.succubus_mark = { ...mark, tamed: { ...mark.tamed!, mark: { ...mark.tamed!.mark!, name: '新的主宰之紋', attrs: { str: 1 } } } }
      refreshParasiteMarks(state.party)
      expect(pc.tattoos!.find((t) => t.parasite === 'succubus_mark')).toMatchObject({ name: '新的主宰之紋', attrs: { str: 1 }, tamed: true })
      expect(parasiteOf(pc, 'succubus_mark')?.tamed).toBe(true)
    } finally {
      parasiteRules.parasites.succubus_mark = mark
    }
  })

  it('leaves a notice when a save loses parasites', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' })
    takeParasiteNotice()
    state.party[0]!.parasites = [{ id: 'mod_par_gone', corruption: 10, since: { ...state.time } }]
    expect(pruneParasites(state.party)).toBe(1)
    expect(takeParasiteNotice()).toContain('1 種寄生物')
    expect(takeParasiteNotice()).toBeNull()
  })
})
