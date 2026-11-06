// 真空（docs/LEWD_STATS.md 第 3 節）與慾望指標下跌的存檔規則（docs/SAVES.md 第 7 節）
import { describe, expect, it } from 'vitest'
import { gameRule, sanitizeRules } from '@/engine/gameRules'
import { enterLocation } from '@/engine/grid'
import { exposureLevel, lewdDaily, lewdOf, vacuumBonus, vacuumSides } from '@/engine/lewd'
import { sanitizeBase } from '@/engine/mods'
import { gearRules } from '@/engine/gear'
import { snapshot } from '@/engine/character'
import { newGame } from '@/engine/state'
import type { Character, EquippedGear, GameState, GearSlot } from '@/engine/types'

const wear = (base: string): EquippedGear => ({ name: gearRules.bases[base]!.name, spec: { base, material: 'linen' } }) as EquippedGear

function dressed(slots: Partial<Record<GearSlot, string>>, opts: { body?: 'masc' | 'fem' | 'andro'; race?: string } = {}): Character {
  const s = newGame({ name: 'x', race: opts.race ?? 'human', classId: 'fighter', seed: 1 })
  const pc = s.party[0]!
  pc.body = opts.body ?? 'fem'
  pc.gear = Object.fromEntries(Object.entries(slots).map(([k, b]) => [k, wear(b!)])) as Character['gear']
  return pc
}

describe('vacuum', () => {
  it('adds one to the side whose outer layer flashes when the underwear is missing', () => {
    // 連身裙（曝露度 0，寫了 bottom）：沒穿內褲 → 下身 1；穿著 → 0
    expect(exposureLevel(dressed({ body: 'dress', underwear_top: 'undershirt' }))).toBe(1)
    expect(vacuumSides(dressed({ body: 'dress', underwear_top: 'undershirt' }))).toEqual(['bottom'])
    expect(exposureLevel(dressed({ body: 'dress', underwear_top: 'undershirt', underwear_bottom: 'briefs' }))).toBe(0)
    // 水手服＋短裙（都是 1）：都沒穿 → 2
    const both = dressed({ body: 'sailor_uniform', legs: 'short_skirt' })
    expect(vacuumSides(both)).toEqual(['top', 'bottom'])
    expect(exposureLevel(both)).toBe(2)
    expect(vacuumBonus(both)).toBe(1)
    // 鎧甲、長褲（0，沒寫 vacuum）：不受影響
    expect(exposureLevel(dressed({ body: 'chain', legs: 'trousers' }))).toBe(0)
    expect(vacuumSides(dressed({ body: 'chain', legs: 'trousers' }))).toEqual([])
    // 已經是 3 的不再加
    expect(exposureLevel(dressed({ body: 'micro_bikini' }))).toBe(3)
  })

  it('counts the top only for feminine and androgynous bodies, and never the bottom of a centaur', () => {
    expect(vacuumSides(dressed({ body: 'shirt', legs: 'trousers' }, { body: 'masc' }))).toEqual([])
    expect(vacuumSides(dressed({ body: 'shirt', legs: 'trousers' }, { body: 'andro' }))).toEqual(['top'])
    const centaur = dressed({ body: 'sailor_uniform' }, { race: 'centaur' })
    expect(vacuumSides(centaur)).toEqual(['top'])
  })

  it('tells the AI and grows lewdness in town', () => {
    const s = newGame({ name: 'x', race: 'human', classId: 'fighter', seed: 1 })
    enterLocation(s)
    const pc = s.party[0]!
    pc.body = 'fem'
    pc.gear = { body: wear('dress'), underwear_top: wear('undershirt') } as Character['gear']
    expect(snapshot(pc).equipment).toContain('沒穿內褲')
    const before = lewdOf(pc).lewdness
    lewdDaily(s, s.time.day, s.time.day + 3)
    expect(lewdOf(pc).lewdness).toBe(before + 3)
    expect(s.exposure?.[pc.id]?.central).toBeGreaterThan(0)
  })

  it('keeps vacuum on custom bases only for body and legs', () => {
    const base = gearRules.bases.dress!
    expect(sanitizeBase({ ...base, vacuum: ['bottom', 'side' as never] } as never, true, 'x').vacuum).toEqual(['bottom'])
    expect(sanitizeBase({ ...gearRules.bases.boots!, vacuum: ['bottom'] } as never, true, 'y').vacuum).toBeUndefined()
  })
})

describe('lewd decay rules', () => {
  function game(options: Record<string, number> = {}): GameState {
    const s = newGame({ name: 'x', race: 'human', classId: 'fighter', seed: 3 })
    enterLocation(s)
    s.options = { ...s.options!, ...options } as GameState['options']
    const pc = s.party[0]!
    s.exposure = { [pc.id]: { central: 50 } }
    pc.lewd = { ...lewdOf(pc), submission: 30, lewdness: 40, lastScene: s.time.day - 30 } as never
    return s
  }
  const after = (s: GameState, days: number) => {
    const pc = s.party[0]!
    lewdDaily(s, s.time.day, s.time.day + days)
    return { exposure: s.exposure![pc.id]!.central!, submission: lewdOf(pc).submission, lewdness: lewdOf(pc).lewdness }
  }

  it('drops as before by default', () => {
    expect(after(game(), 12)).toEqual({ exposure: 38, submission: 26, lewdness: 28 })
  })

  it('changes how much each drop takes, not how often, and 0 stops it', () => {
    expect(after(game({ exposureDecay: 0, submissionDecay: 0, lewdnessDecay: 0 }), 12)).toEqual({ exposure: 50, submission: 30, lewdness: 40 })
    // 每次 2 點：曝露名聲每天 −2、順從每 3 天 −2、淫亂每天 −2（第 1 天起已經超過 7 天沒有親密場景）
    expect(after(game({ exposureDecay: 2, submissionDecay: 2, lewdnessDecay: 2 }), 12)).toEqual({ exposure: 26, submission: 22, lewdness: 16 })
    // 只能是整數
    expect(gameRule({ options: { defeatLoot: 'half', lewdnessDecay: 0.5 } }, 'lewdnessDecay')).toBe(1)
    expect(sanitizeRules({ submissionDecay: 2.4 })).toEqual({ submissionDecay: 2 })
  })

  it('lets the experience multiplier go from 0.1 to 5', () => {
    expect(gameRule({ options: { defeatLoot: 'half', xpMult: 0.1 } }, 'xpMult')).toBe(0.1)
    expect(gameRule({ options: { defeatLoot: 'half', xpMult: 0.01 } }, 'xpMult')).toBe(0.1)
    expect(sanitizeRules({ xpMult: 0.15, lewdnessDecay: 0 })).toEqual({ xpMult: 0.15, lewdnessDecay: 0 })
  })
})
