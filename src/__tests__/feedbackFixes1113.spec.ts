// 11/13 玩家反饋實測的修正：主動認主（不收人的 NPC、隊伍空位、小隊、看法）、戰鬥親密度扣的照扣、
// 用經驗換來的成長、生圖描述拿掉雜湊、男性主人的成人向事件
import { describe, expect, it } from 'vitest'
import { combatRules, companionRules, slaveryRules, type Bond } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { generateNpc, npcRecord, registerNpc } from '@/engine/npcs'
import { joinParty, leaderOf, pcOf } from '@/engine/party'
import { pledgeBlocked, pledgeBumped, pledgeCandidates, pledgeFollowers, pledgeSelf } from '@/engine/selfPledge'
import { newGame, withRng } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import type { GameState, NpcRecord } from '@/engine/types'
import { finishCombat, startCombat } from '@/engine/combat'
import { setAffinity } from '@/engine/social'
import { gainXp } from '@/engine/character'
import { sinkPending, spendXp } from '@/engine/xpSinks'
import { Rng } from '@/engine/rng'
import { registerGear } from '@/engine/gear'
import { hasItemKey } from '@/engine/itemKey'
import { portraitSubject } from '@/narrator/imageInfo'
import { setContentFilters } from '@/engine/content'
import { askableEvents } from '@/engine/slavery'
import { inActiveSquad, squadOf } from '@/engine/squads'

function game(bp = 'albena'): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 9, birthplace: bp })
  enterLocation(state)
  state.money_cc = 10_000
  expect(standOn(state, 'carver')).toBe(true)
  return state
}
function companion(state: GameState, bond: Bond, affinity = 70, gender?: string): NpcRecord {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', level: 3, location: state.location, ...(gender ? { gender } : {}) }, 'fx'))
  registerNpc(state, rec)
  joinParty(state, rec, bond)
  state.relationships![rec.id]!.affinity = affinity
  return rec
}
function beside(state: GameState, rec: NpcRecord, affinity: number, toPlayer = '常一起喝酒的老朋友。') {
  if (!state.npcs?.[rec.id]) registerNpc(state, rec)
  const p = state.position!
  state.npcs![rec.id]!.at = { area: p.area, x: p.x, y: p.y, until: state.time.day }
  state.relationships ??= {}
  state.relationships[rec.id] = { id: rec.id, name: rec.name, affinity, toPlayer, toOthers: '', memories: [] } as never
}

describe('主動認主的修正', () => {
  it('不收人的固定 NPC（unhireable）不能問', () => {
    const state = game('soriel')
    const marcus = npcRecord(state, 'npc_marcus_fenn')!
    beside(state, marcus, 90)
    expect(pledgeCandidates(state).some((x) => x.id === marcus.id)).toBe(false)
    expect(pledgeBlocked(state, marcus.id)).toBe('對方不在身邊')
  })

  it('隊伍 4 人時不踢人（主人帶著時上限是跟隨的人數），原本的看法接在後面', () => {
    const state = game('albena')
    const mates = [companion(state, 'hired', 10), companion(state, 'hired', 10), companion(state, 'hired', 10)]
    const patron = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', level: 4, location: 'albena', gender: 'female' }, 'fp'))
    beside(state, patron, 80)
    expect(state.party).toHaveLength(combatRules.party_max)
    expect(pledgeBumped(state, patron.id)).toEqual([])
    const rep = pledgeSelf(state, patron.id, slaveryRules.roles.default)
    expect(mates.every((m) => state.party.some((x) => x.id === m.id))).toBe(true)
    expect(rep.changes.companions?.some((c) => c.change === 'left')).toBeFalsy()
    expect(leaderOf(state)?.id).toBe(patron.id)
    const view = state.relationships![patron.id]!.toPlayer
    expect(view.startsWith('常一起喝酒的老朋友。')).toBe(true)
    expect(view).toContain('主角主動請求被收下')
    expect(view).not.toMatch(/他的|她的/)
  })

  it('真的放不下時，確認前就知道誰會離開', () => {
    const state = game('albena')
    for (let i = 0; i < 3; i++) companion(state, 'hired', 10)
    const patron = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', level: 4, location: 'albena' }, 'fq'))
    beside(state, patron, 80)
    // 把上限暫時調小：只放得下主角、主人與兩位同伴
    const keep = combatRules.party_max_following ?? combatRules.party_max
    ;(combatRules as { party_max_following: number }).party_max_following = 4
    try {
      const names = pledgeBumped(state, patron.id)
      expect(names).toEqual([state.party.at(-1)!.name])
      pledgeSelf(state, patron.id, slaveryRules.roles.default)
      expect(state.party.some((m) => m.name === names[0])).toBe(false)
      expect(state.party).toHaveLength(4)
    } finally {
      ;(combatRules as { party_max_following: number }).party_max_following = keep
    }
  })

  it('有小隊的固定 NPC：隊員要找隊長，隊長收下主角時整隊一起帶著', () => {
    const state = game('soriel')
    const leader = npcRecord(state, 'npc_aurelia')!
    const sq = squadOf(leader.id)!
    expect(inActiveSquad(state, leader.id)).toBeTruthy()
    const member = npcRecord(state, sq.members[0]!)!
    beside(state, leader, 80)
    beside(state, member, 80)
    expect(pledgeBlocked(state, member.id)).toContain('請隊長收下你')
    expect(pledgeFollowers(state, leader.id).map((r) => r.id)).toEqual([member.id])
    const rep = pledgeSelf(state, leader.id, slaveryRules.roles.default)
    expect(contractOf(pcOf(state))!.master).toBe(leader.id)
    expect(state.party.find((m) => m.id === member.id)).toMatchObject({ bond: 'ally', group: leader.id })
    expect(rep.outcome.summary).toContain(`${member.name}也跟著一起同行`)
  })
})

describe('戰鬥親密度：加的與扣的分開算', () => {
  it('上限以上打贏 +2、倒下 −1：結果 −1', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5 })
    enterLocation(state)
    const mate = joinParty(state, withRng(state, (rng) => generateNpc(state, rng, { level: 2, kind: 'adventurer', class: 'fighter', location: state.location })), 'voluntary')
    for (const [start, after] of [[60, 59], [companionRules.combat_affinity_cap, companionRules.combat_affinity_cap - 1], [10, 11]] as const) {
      setAffinity(state, mate.id, start)
      startCombat(state, [['goblin', 1]])
      state.combat!.affinity[mate.id] = { delta: -1, loss: -1, reasons: ['在戰鬥中倒下'] }
      for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
      state.combat!.status = 'victory'
      finishCombat(state)
      expect(mate.affinity).toBe(after)
    }
  })
})

describe('用經驗換來的成長', () => {
  it('鑽研技能、苦練屬性記成經驗換來的；之後升級給的不算進去', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5 })
    const pc = pcOf(state)
    pc.level = 20
    pc.xp = 20_000
    const rng = new Rng(3)
    spendXp(pc, 'ability', rng, state)
    spendXp(pc, 'attr', rng, state)
    expect(sinkPending(pc)).toEqual({ ability: 1, attr: 1 })
    // 選掉之後再升級（測試用 19 級）：升級給的不算經驗換來的
    pc.pendingAbilityChoices = []
    pc.attrPoints = 0
    pc.level = 19
    pc.xp = 0
    gainXp(pc, 10_000, rng)
    expect(sinkPending(pc)).toEqual({ ability: 0, attr: 0 })
  })
})

describe('生圖的描述', () => {
  it('自訂裝備名字的雜湊拿掉', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5 })
    const pc = pcOf(state)
    const key = registerGear(state, { ...pc.gear!.main_hand!.spec!, rarity: 'rare', enchants: { mods: { evade: 1 } } }, '月影')
    expect(hasItemKey(key)).toBe(true)
    pc.gear!.main_hand = { ...pc.gear!.main_hand!, name: key }
    const subject = portraitSubject(state, pc.id)!
    expect(subject.gear).toContain('月影')
    expect(subject.gear.some(hasItemKey)).toBe(false)
  })
})

describe('男性主人的成人向事件', () => {
  it('關掉男性對象時，男性主人的成人向事件不列', () => {
    const state = game('albena')
    const m = companion(state, 'voluntary', 80, 'male')
    pledgeSelf(state, m.id, slaveryRules.roles.default, 'lovers')
    const adultIds = new Set(slaveryRules.master_events.events.filter((e) => e.adult).map((e) => e.id))
    setContentFilters({ male_partner: true } as never)
    const on = askableEvents(state).filter((x) => adultIds.has(x.id))
    setContentFilters({ male_partner: false } as never)
    try {
      expect(askableEvents(state).some((x) => adultIds.has(x.id))).toBe(false)
    } finally {
      setContentFilters({ male_partner: true } as never)
    }
    expect(on.length).toBeGreaterThan(0)
  })
})
