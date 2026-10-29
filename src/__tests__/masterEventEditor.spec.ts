import { afterEach, describe, expect, it } from 'vitest'
import { lewdRules, masterEventPool, slaveryRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation } from '@/engine/grid'
import { allMasterEvents, builtinMasterEvent, newMasterEvent, sanitizeMasterEvent } from '@/engine/masterEventMods'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { pcOf } from '@/engine/party'
import { answerMasterEvent, masterCandidates, stanceModifiers, startAsSlave, startMasterEvent } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import { sanitizeEffects } from '@/engine/storyMods'
import { baseReport } from '@/engine/town'
import type { GameState } from '@/engine/types'

afterEach(() => applyContent(emptyMods()))

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}

describe('主人事件格式：整理與內建事件', () => {
  it('內建的事件整理過後不變（效果、回應、條件都保留）', () => {
    for (const { def: e } of allMasterEvents()) {
      const m = sanitizeMasterEvent(e.id, { ...builtinMasterEvent(e.id)! }, false)
      expect(m.options.length, e.id).toBe(e.options.length)
      for (const [i, o] of e.options.entries()) {
        const s = m.options[i]!
        expect(s.check, `${e.id} ${o.label}`).toEqual(o.check)
        expect(s.stance).toBe(o.stance)
        for (const k of ['effects', 'effects_success', 'fail_effects'] as const) expect(s[k] ?? [], `${e.id} ${o.label} ${k}`).toEqual(o[k] ?? [])
      }
      for (const k of ['tags', 'tags_none', 'at_home', 'overdue', 'free_place', 'forced_gear', 'cell', 'adult', 'scene', 'teaches', 'course', 'rank_min'] as const) expect(m[k], `${e.id} ${k}`).toEqual(e[k])
      for (const [i, o] of e.options.entries()) expect(m.options[i]!.learn, `${e.id} ${o.label}`).toBe(o.learn)
    }
  })

  it('自建的事件可以放進任何事件庫；只有主人事件有在家、逾期這些欄位', () => {
    const m = sanitizeMasterEvent('mevent_x', { pool: 'brothel_train', text: '老鴇', options: [{ label: '學' }], at_home: true, overdue: true, teaches: ['lust_kiss', 'heavy_strike'], rank_min: 3 }, true)
    expect(m).toMatchObject({ pool: 'brothel_train', teaches: ['lust_kiss'], rank_min: 3, custom: true })
    expect(m.at_home).toBeUndefined()
    expect(m.overdue).toBeUndefined()
    const mods = emptyMods()
    mods.masterEvents = { mevent_x: m, mevent_y: newMasterEvent('mevent_y') }
    applyContent(normalizeMods(JSON.parse(JSON.stringify(mods))))
    expect(masterEventPool('brothel_train').map((e) => e.id)).toContain('mevent_x')
    expect(slaveryRules.master_events.events.map((e) => e.id)).toContain('mevent_y')
    const before = allMasterEvents().length
    applyContent(emptyMods())
    expect(allMasterEvents().length).toBe(before - 2)
    expect(masterEventPool('brothel_train').map((e) => e.id)).not.toContain('mevent_x')
  })

  it('主人事件的效果：嚴加看管、帶回家、強制裝備、旗標、事件庫的技能都整理得出來', () => {
    const out = sanitizeEffects([
      { type: 'strict', delta: 9 }, { type: 'master_home' }, { type: 'force_equip', npc: 'master' }, { type: 'flag', key: 'negotiate_bonus', value: true },
      { type: 'ability_pool', pool: 'nope', fallback: [{ type: 'lewd', stat: 'lewdness', delta: 3 }, { type: 'ability_pool', pool: 'master' }] },
    ])
    expect(out).toEqual([
      { type: 'strict', delta: 5 }, { type: 'master_home' }, { type: 'force_equip', npc: 'master' }, { type: 'flag', key: 'negotiate_bonus', value: true },
      { type: 'ability_pool', pool: 'master', fallback: [{ type: 'lewd', stat: 'lewdness', delta: 3 }] },
    ])
  })
})

describe('屈服與抵抗、事件庫的技能', () => {
  it('順從高的人屈服比較容易、抵抗比較難', () => {
    const pc = pcOf(game())
    pc.lewd = { ...lewdRules.defaults, submission: 65 }
    expect(stanceModifiers(pc, 'submit')).toEqual([{ label: '順從・屈服', value: 3 }])
    expect(stanceModifiers(pc, 'resist')).toEqual([{ label: '順從・抵抗', value: -3 }])
    expect(stanceModifiers(pc, undefined)).toEqual([])
  })

  it('回應主人時列出順從的修正', () => {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    pcOf(state).lewd = { ...lewdRules.defaults, submission: 40 }
    const e = slaveryRules.master_events.events.find((x) => x.id === 'bad_mood')!
    startMasterEvent(state, e)
    const report = answerMasterEvent(state, e.options.findIndex((o) => o.stance === 'resist'))
    expect(report.timeline?.[0]?.action).toContain('順從・抵抗 -2')
  })

  it('ability_pool：從事件庫掛的技能抽一個還沒學的；都學過時套用 fallback', () => {
    const state = game()
    const pc = pcOf(state)
    // 調教事件「侍奉」課程掛的技能：肉盾侍奉、縱慾共鳴、獻身；先學會其他的，只剩一個
    const all = [...new Set(masterEventPool('owner').flatMap((e) => e.teaches ?? []))]
    pc.level = 20
    pc.abilities.push(...all.filter((id) => id !== 'lust_guard'))
    const effects = [{ type: 'ability_pool' as const, pool: 'owner' as const, fallback: [{ type: 'lewd' as const, stat: 'lewdness' as const, delta: 3 }] }]
    applyEffects(state, baseReport(state, 'event', 0), effects)
    expect(pc.abilities).toContain('lust_guard')
    const before = pc.lewd?.lewdness ?? lewdRules.defaults.lewdness
    applyEffects(state, baseReport(state, 'event', 0), effects)
    expect(pc.lewd!.lewdness).toBe(before + 3)
  })
})
