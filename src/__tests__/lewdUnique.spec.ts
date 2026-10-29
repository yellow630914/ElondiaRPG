import { describe, expect, it } from 'vitest'
import { act, defenseMult, startCombat } from '@/engine/combat'
import { abilities, itemRules, stories } from '@/engine/data'
import { backfillLewdSkills } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { migrate, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

/** 打工線第三個任務的結局給的獨特技能（worldgen/scripts/elondia/lust_skills_s6.py 的 UNIQUE） */
const UNIQUE: Record<string, string> = {
  inn_feast: 'lust_pour_charm', odd_exchange: 'lust_arcane_stim', dice_jackpot: 'lust_dealer_gamble', dance_night: 'lust_dance', maid_night: 'lust_grovel',
  expo_parade: 'lust_center_stage', bath_deep: 'lust_back_scrub', onsen_dawn: 'lust_hot_spring', massage_last: 'lust_ten_fingers', paint_brush: 'lust_frozen_pose',
  horn_trophy: 'lust_spoils', court_banquet: 'lust_kiss', pyre_offering: 'lust_sacrifice_sigil', conf_last: 'burst_release', fert_rite: 'burst_bliss',
  mate_bonfire: 'lust_courtship_mark', brine_spring: 'lust_tide_bride',
}

function game(): GameState {
  return newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 7 })
}

/** 結局的效果裡所有的 ability 效果 */
function abilityEffects(o: unknown, out: string[] = []): string[] {
  if (Array.isArray(o)) o.forEach((x) => abilityEffects(x, out))
  else if (o && typeof o === 'object') {
    const r = o as Record<string, unknown>
    if (r.type === 'ability' && typeof r.ability === 'string') out.push(r.ability)
    Object.values(r).forEach((x) => abilityEffects(x, out))
  }
  return out
}

describe('打工線的獨特技能', () => {
  it('17 條線的結局都給那條線的技能；技能都是色情技能，新的 12 個有技能書', () => {
    for (const [id, ability] of Object.entries(UNIQUE)) {
      const def = stories.find((s) => s.id === id)
      expect(def, id).toBeDefined()
      expect(abilityEffects(def!.nodes), id).toContain(ability)
      expect(abilities[ability]?.classes, ability).toContain('lewd')
    }
    const books = itemRules.items.filter((i) => i.use?.abilities?.length === 1 && Object.values(UNIQUE).includes(i.use.abilities[0]!))
    expect(books.length).toBeGreaterThanOrEqual(12)
    for (const b of books.filter((x) => x.tags.length === 0)) expect(b.adult).toBe(true)
  })

  it('舊存檔：已經完成的任務線，讀檔時補上技能', () => {
    const state = game()
    const pc = pcOf(state)
    state.stories = { onsen_dawn: { id: 'onsen_dawn', status: 'completed', started: { ...state.time }, done: [], log: [] } }
    expect(backfillLewdSkills(state)).toEqual(['lust_hot_spring'])
    expect(pc.abilities).toContain('lust_hot_spring')
    expect(backfillLewdSkills(state)).toEqual([])
    const again = migrate(JSON.parse(JSON.stringify(state)))
    expect(pcOf(again).abilities.filter((x) => x === 'lust_hot_spring')).toHaveLength(1)
  })
})

describe('獨特技能的戰鬥效果', () => {
  function fight(abilitiesToLearn: string[], foes: [string, number][] = [['goblin', 1]]) {
    const state = game()
    const pc = pcOf(state)
    pc.level = 12
    pc.abilities.push(...abilitiesToLearn)
    pc.loadout = [...new Set([...(pc.loadout ?? []), ...abilitiesToLearn])]
    const combat = startCombat(state, foes)
    // 讓主角先動
    combat.turn = combat.order.indexOf(pc.id)
    const me = combat.combatants.find((c) => c.id === pc.id)!
    me.ap = me.apMax
    return { state, combat, me }
  }

  it('魔導刺激對免疫魅惑的骷髏也有效', () => {
    const { state, combat, me } = fight(['lust_arcane_stim'], [['skeleton', 1]])
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    expect(foe.resist.lust).toBe(-1)
    for (let i = 0; i < 6 && !(foe.lust ?? 0); i++) {
      me.ap = me.apMax
      me.usedTurn = {}
      combat.turn = combat.order.indexOf(me.id)
      try {
        act(state, { type: 'ability', ability: 'lust_arcane_stim', target: foe.id })
      } catch {
        break
      }
    }
    expect((foe.lust ?? 0) + (foe.maxHp - foe.hp)).toBeGreaterThan(0)
  })

  it('潮之新娘吸走隊友的慾望而不高潮；定格的姿態不受傷害', () => {
    const { state, combat, me } = fight(['lust_tide_bride', 'lust_frozen_pose'])
    me.lust = Math.round(me.lustMax! * 0.9)
    act(state, { type: 'ability', ability: 'lust_tide_bride' })
    expect(me.climaxes ?? 0).toBe(0)
    expect(me.statuses.some((s) => s.id === 'tide_bride')).toBe(true)
    act(state, { type: 'ability', ability: 'lust_frozen_pose' })
    // 回合立刻結束，下一個自己的回合也不能行動；定格的期間不受傷害、慾望照收
    expect(combat.timeline.some((l) => l.actor === me.id && l.action === '定格・無法行動')).toBe(true)
    expect(defenseMult({ ...me, statuses: [{ id: 'frozen_pose', turns: 1 }] } as typeof me, 'slashing')).toBe(0)
    expect(defenseMult({ ...me, statuses: [{ id: 'frozen_pose', turns: 1 }] } as typeof me, 'lust')).toBeGreaterThan(0)
    void combat
  })

  it('獻祭的契紋：引爆時傷害所有敵人', () => {
    const { state, combat, me } = fight(['lust_sacrifice_sigil', 'burst_release'])
    act(state, { type: 'ability', ability: 'lust_sacrifice_sigil' })
    me.lust = Math.round(me.lustMax! * 0.8)
    const foe = combat.combatants.find((c) => c.side === 'enemy')!
    const hp = foe.hp
    act(state, { type: 'ability', ability: 'burst_release' })
    expect(foe.hp).toBeLessThan(hp)
  })
})
