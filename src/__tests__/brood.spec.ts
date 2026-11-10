import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, setContentFilters } from '@/engine/content'
import { finishCombat, startCombat } from '@/engine/combat'
import { sanitizeAbility, sanitizeEnemy, parasiteUsage } from '@/engine/mods'
import { sanitizeParasiteMod } from '@/engine/parasiteMods'
import { abilities, enemies, itemDef, perkDef } from '@/engine/data'
import { applyDefeatResponse } from '@/engine/defeat'
import { applyEffects } from '@/engine/effects'
import { enterLocation, standOn } from '@/engine/grid'
import { lactationSources } from '@/engine/lactation'
import { lewdTitles } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { maybeParasiteEvent } from '@/engine/parasiteEvents'
import { parasiteOf, parasiteRules } from '@/engine/parasites'
import { conceptionChance, effectConceive } from '@/engine/pregnancy'
import { newGame } from '@/engine/state'
import { baseReport } from '@/engine/town'
import {
  answerBroodBirth, broodBirthOptions, broodBlock, broodOf, broodTick, extractBrood, extractOffers, giveBrood, hasLiveBrood,
} from '@/engine/brood'
import type { GameState } from '@/engine/types'

function game(gender = '女'): GameState {
  const state = newGame({ name: '艾琳', race: 'human', classId: 'rogue', seed: 3, gender, body: gender === '男' ? 'masc' : 'fem', birthplace: 'rhineburg' })
  enterLocation(state)
  state.money_cc = 100000
  return state
}
const report = (state: GameState) => baseReport(state, 'event', 0)
const BROODS = Object.entries(parasiteRules.parasites).filter(([, d]) => d.category === 'brood')

beforeEach(() => setContentFilters({ ...DEFAULT_FILTERS, monster_brood: true, pregnancy: true, lactation: true }))
afterEach(() => setContentFilters({ ...DEFAULT_FILTERS }))

describe('苗床的資料', () => {
  it('三種都有；卵生、寄生產出的東西是物品；胎生寫了幼體；共生的特質存在', () => {
    const kinds = new Set(BROODS.map(([, d]) => d.brood!.kind))
    expect([...kinds].sort()).toEqual(['egg', 'live', 'parasite'])
    for (const [id, d] of BROODS) {
      const b = d.brood!
      expect(d.kind, id).toBe('seed')
      expect(d.remove, id).toBeTruthy()
      for (const y of b.yields ?? []) expect(itemDef(y.item), y.item).toBeTruthy()
      if (b.kind === 'live') expect(b.offspring?.name, id).toBeTruthy()
      if (b.symbiosis) expect(perkDef(b.symbiosis), b.symbiosis).toBeTruthy()
    }
  })

  it('怪物寫的苗床都存在；幼體的怪物不寫', () => {
    for (const e of Object.values(enemies)) if (e.brood) expect(broodOf(e.brood), `${e.id} → ${e.brood}`).toBeTruthy()
    for (const id of ['serpent_hatchling', 'sandworm_larva', 'magma_wyrmling', 'abyssal_leviathan_spawn']) expect(enemies[id]?.brood, id).toBeUndefined()
    expect(enemies.goblin!.brood).toBe('brood_goblin')
  })
})

describe('變成苗床', () => {
  it('篩選、非自願、懷孕、子宮、同時一個胎生、已經有了', () => {
    const state = game()
    expect(broodBlock(state, 'brood_tentacle')).toBeUndefined()
    setContentFilters({ pc_unwilling: false })
    expect(broodBlock(state, 'brood_tentacle', true)).toContain('主角非自願')
    expect(broodBlock(state, 'brood_tentacle')).toBeUndefined()
    setContentFilters({ monster_brood: false })
    expect(broodBlock(state, 'brood_tentacle')).toContain('怪物的苗床')
    setContentFilters({ monster_brood: true, pc_unwilling: true })
    expect(giveBrood(state, report(state), 'brood_tentacle', true)).not.toBe('')
    expect(hasLiveBrood(pcOf(state))).toBe(true)
    expect(broodBlock(state, 'brood_slime')).toContain('胎生')
    expect(broodBlock(state, 'brood_tentacle')).toContain('已經有了')
    expect(broodBlock(state, 'brood_wasp_egg')).toBeUndefined()
    // 男性的主角沒有子宮：胎生不行，卵生、寄生可以
    const him = game('男')
    expect(broodBlock(him, 'brood_goblin')).toContain('子宮')
    expect(broodBlock(him, 'brood_spider_egg')).toBeUndefined()
    // 懷孕中都不行
    const mom = game()
    mom.pregnancies = { pc: { conceived: 1, due: 41 } }
    expect(broodBlock(mom, 'brood_wasp_egg')).toBe('懷孕中')
  })

  it('效果「寄生物」也照這些限制', () => {
    const state = game()
    setContentFilters({ monster_brood: false })
    const notes = applyEffects(state, report(state), [{ type: 'parasite', parasite: 'brood_slug', op: 'add' }])
    expect(notes.join()).toContain('沒有成為苗床')
    expect(parasiteOf(pcOf(state), 'brood_slug')).toBeUndefined()
  })

  it('胎生的苗床在身上時不會懷孕', () => {
    const state = game()
    giveBrood(state, report(state), 'brood_goblin')
    const input = { report: report(state), mother: 'pc', partners: [{ name: '旅人' }], times: 1 }
    expect(conceptionChance(state, input)).toBeUndefined()
    expect(effectConceive(state, report(state), 'pc', undefined, '旅人')).toContain('魔物的種')
    expect(state.pregnancies?.pc).toBeUndefined()
  })

  it('色情戰敗事件：沒能擺脫、吃了大虧時，圍上來的怪物留下苗床；脫身時不會', () => {
    const lose = (degree: 'success' | 'fumble', mult = 3) => {
      const state = game()
      state.options = { ...state.options, broodMult: mult }
      state.pendingDefeat = { foes: [{ name: '哥布林', monster: 'goblin' }], location: state.location, scene: '路上', report: 'r-0' }
      const text = applyDefeatResponse(state, report(state), degree)
      return { state, text }
    }
    expect(parasiteOf(pcOf(lose('success').state), 'brood_goblin')).toBeUndefined()
    const { state, text } = lose('fumble')
    expect(parasiteOf(pcOf(state), 'brood_goblin')).toBeTruthy()
    expect(text).not.toBe('')
    expect(parasiteOf(pcOf(lose('fumble', 0).state), 'brood_goblin')).toBeUndefined()
    // 「主角非自願」關掉時不會
    setContentFilters({ pc_unwilling: false })
    expect(parasiteOf(pcOf(lose('fumble').state), 'brood_goblin')).toBeUndefined()
  })
})

describe('成長與產下', () => {
  it('侵蝕度照長（發作關掉也長），長到支配時跳出產下的事件', () => {
    const state = game()
    setContentFilters({ pc_unwilling: false })
    giveBrood(state, report(state), 'brood_wasp_egg')
    state.time.day += 4
    expect(maybeParasiteEvent(state, 'rest')).toBe(true)
    expect(parasiteOf(pcOf(state), 'brood_wasp_egg')!.corruption).toBe(100)
    expect(state.pendingBroodBirth).toEqual({ parasite: 'brood_wasp_egg' })
  })

  it('篩選關掉時不長', () => {
    const state = game()
    giveBrood(state, report(state), 'brood_slug')
    setContentFilters({ monster_brood: false })
    state.time.day += 5
    maybeParasiteEvent(state, 'rest')
    expect(parasiteOf(pcOf(state), 'brood_slug')!.corruption).toBe(0)
    expect(state.pendingBroodBirth).toBeUndefined()
  })

  it('卵生：排出魔物卵，苗床拿掉', () => {
    const state = game()
    giveBrood(state, report(state), 'brood_spider_egg')
    parasiteOf(pcOf(state), 'brood_spider_egg')!.corruption = 95
    expect(broodTick(state)).toBe(true)
    expect(broodBirthOptions(state).map((o) => o.id)).toEqual(['push', 'help', 'submit'])
    expect(broodBirthOptions(state).find((o) => o.id === 'help')?.disabled).toBeTruthy()
    answerBroodBirth(state, 'submit')
    expect(state.inventory.find((i) => i.name === '蛛卵')?.qty).toBeGreaterThanOrEqual(2)
    expect(parasiteOf(pcOf(state), 'brood_spider_egg')).toBeUndefined()
    expect(state.pendingBroodBirth).toBeUndefined()
  })

  it('胎生：共生以上泌乳；產下後幼體交給魔物學者換錢、產後虛弱、泌乳 15 天、次數 +1', () => {
    const state = game()
    giveBrood(state, report(state), 'brood_tentacle')
    const p = parasiteOf(pcOf(state), 'brood_tentacle')!
    p.corruption = 65
    expect(broodTick(state)).toBe(false)
    expect(lactationSources(state, 'pc')).toEqual([{ kind: 'brood', ref: 'brood_tentacle' }])
    p.corruption = 90
    expect(broodTick(state)).toBe(true)
    const before = state.money_cc
    answerBroodBirth(state, 'self', 'scholar')
    expect(state.money_cc).toBeGreaterThan(before)
    expect(state.postpartum?.pc).toBeGreaterThanOrEqual(state.time.day)
    expect(lactationSources(state, 'pc')).toEqual([{ kind: 'brood', ref: '產後', until: expect.any(Number) }])
    expect(state.broodBirths).toBe(1)
    expect(hasLiveBrood(pcOf(state))).toBe(false)
    expect(state.children ?? []).toEqual([])
  })

  it('寄生：排出蟲蛻；修了獸蟲派可以共生（得到特質）', () => {
    const state = game()
    giveBrood(state, report(state), 'brood_worm')
    parasiteOf(pcOf(state), 'brood_worm')!.corruption = 90
    broodTick(state)
    expect(broodBirthOptions(state).find((o) => o.id === 'symbiosis')?.disabled).toContain('獸蟲派')
    pcOf(state).perks = [...(pcOf(state).perks ?? []), 'school_beast']
    expect(broodBirthOptions(state).find((o) => o.id === 'symbiosis')?.disabled).toBeUndefined()
    answerBroodBirth(state, 'symbiosis')
    expect(pcOf(state).perks).toContain('brood_symbiote')
    expect(parasiteOf(pcOf(state), 'brood_worm')).toBeUndefined()
  })

  it('稱號「魔物的苗床」：產下胎生三次', () => {
    const state = game()
    const has = () => lewdTitles(state, pcOf(state)).some((t) => t.id === 'monster_brood')
    expect(has()).toBe(false)
    state.broodBirths = 3
    expect(has()).toBe(true)
  })
})

describe('魔法物品店的取出', () => {
  it('卵生、寄生可以取出，胎生不行', () => {
    const state = game()
    giveBrood(state, report(state), 'brood_goblin')
    giveBrood(state, report(state), 'brood_leech')
    expect(extractOffers(state)).toEqual([])
    expect(standOn(state, 'magic')).toBe(true)
    expect(extractOffers(state).map((o) => o.id)).toEqual(['brood_leech'])
    const before = state.money_cc
    extractBrood(state, 'brood_leech')
    expect(state.money_cc).toBe(before - parasiteRules.brood_rules!.extract.price)
    const p = parasiteOf(pcOf(state), 'brood_leech')
    expect(p === undefined || p.corruption === 5).toBe(true)
  })
})

describe('戰鬥中被植入', () => {
  it('成人向怪物的能力寫了植入苗床；苗床用使用者的', () => {
    expect(abilities.lp_ovipositor!.brood).toEqual({ chance: 0.15 })
    expect(enemies.lp_brood_wasp!.brood).toBe('brood_wasp_egg')
  })

  it('戰鬥結束時擲植入的層數（打贏也算）；「主角非自願」關掉時不會', () => {
    const run = () => {
      const state = game()
      state.options = { ...state.options, broodMult: 3 }
      const combat = startCombat(state, [['lp_brood_wasp', 1]])
      combat.combatants.find((c) => c.id === pcOf(state).id)!.implants = { brood_wasp_egg: [0.5] }
      for (const c of combat.combatants) if (c.side === 'enemy') c.hp = 0
      combat.status = 'victory'
      const report = finishCombat(state)
      return { state, report }
    }
    const { state, report } = run()
    expect(parasiteOf(pcOf(state), 'brood_wasp_egg')).toBeTruthy()
    expect(report.outcome.summary).toContain('蜂卵')
    setContentFilters({ pc_unwilling: false })
    expect(parasiteOf(pcOf(run().state), 'brood_wasp_egg')).toBeUndefined()
  })
})

describe('編輯器的整理', () => {
  it('怪物的苗床、能力的植入、寄生物的苗床欄位都保留；不是苗床的拿掉', () => {
    expect(sanitizeEnemy('lp_brood_wasp', enemies.lp_brood_wasp as never, false).brood).toBe('brood_wasp_egg')
    expect(sanitizeEnemy('wolf', { ...enemies.wolf, brood: 'succubus_mark' } as never, false).brood).toBeUndefined()
    expect(sanitizeAbility('lp_ovipositor', { ...abilities.lp_ovipositor, brood: { chance: 3, parasite: 'brood_slug' } } as never, false).brood).toEqual({ chance: 1, parasite: 'brood_slug' })
    expect(sanitizeAbility('lp_ovipositor', { ...abilities.lp_ovipositor, brood: { chance: 0.2, parasite: 'parasite_seed' } } as never, false).brood).toEqual({ chance: 0.2 })
    for (const [id, d] of BROODS) expect(sanitizeParasiteMod(id, d).brood, id).toEqual(d.brood)
    expect(parasiteUsage('brood_goblin')).toContain('怪物「哥布林」的苗床')
  })
})
