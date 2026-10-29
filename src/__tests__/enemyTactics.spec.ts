import { describe, expect, it } from 'vitest'
import { act, applyTraits, currentActor, startCombat, type Combatant } from '@/engine/combat'
import { enemies } from '@/engine/data'
import { pcOf } from '@/engine/party'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

/** 主角（5 級、會指定的技能）打一隻哥布林，輪到主角為止；主角的魅力很高，對方的豁免一定失敗 */
function fight(abilities: string[]): { state: GameState; me: Combatant; foe: Combatant } {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
  const pc = pcOf(state)
  pc.abilities.push(...abilities)
  pc.level = 5
  pc.hp = pc.maxHp = 200
  const combat = startCombat(state, [['goblin', 1]])
  const me = combat.combatants.find((c) => c.id === pc.id)!
  const foe = combat.combatants.find((c) => c.side === 'enemy')!
  for (let i = 0; i < 20 && combat.status === 'ongoing' && currentActor(combat)?.id !== me.id; i++) act(state, { type: 'end_turn' })
  me.attrs.cha = 40
  me.attrs.str = 40
  foe.attrs.fai = 1
  foe.attrs.cha = 1
  foe.hp = foe.maxHp = 500
  return { state, me, foe }
}

describe('敵人的手段', () => {
  it('發情的野獸多會撲上來，比較想用慾望攻擊', () => {
    const { foe } = fight([])
    foe.abilities = []
    applyTraits(foe, ['rut'])
    expect(foe.abilities).toContain('rut_mount')
    expect(foe.ai?.lust).toBe(1.5)
  })

  it('驅奴術只定住身上有奴隸印記的人', () => {
    const a = fight(['h_slave_drive'])
    act(a.state, { type: 'ability', ability: 'h_slave_drive', target: a.foe.id })
    expect(a.foe.statuses.some((s) => s.id === 'stunned')).toBe(false)
    const b = fight(['h_slave_drive'])
    b.foe.slave = true
    act(b.state, { type: 'ability', ability: 'h_slave_drive', target: b.foe.id })
    expect(b.foe.statuses.some((s) => s.id === 'stunned')).toBe(true)
  })

  it('威壓只對等級比自己低的人有效', () => {
    const a = fight(['h_overawe'])
    act(a.state, { type: 'ability', ability: 'h_overawe', target: a.foe.id })
    expect(a.foe.statuses.some((s) => s.id === 'overawed')).toBe(true)
    const b = fight(['h_overawe'])
    b.foe.level = 9
    act(b.state, { type: 'ability', ability: 'h_overawe', target: b.foe.id })
    expect(b.foe.statuses.some((s) => s.id === 'overawed')).toBe(false)
    expect(b.state.combat!.timeline.some((t) => t.effects?.some((e) => e.text?.includes('等級不比對方低')))).toBe(true)
  })

  it('捕奴隊、強盜、吸血蝠會用色情技能', () => {
    expect(enemies.slaver_captain!.abilities).toEqual(expect.arrayContaining(['h_slave_drive', 'h_overawe', 'h_aphro_incense']))
    expect(enemies.highway_robber!.abilities).toContain('h_overawe')
    expect(enemies.blood_bat!.abilities).toContain('m_lust_kiss')
  })
})
