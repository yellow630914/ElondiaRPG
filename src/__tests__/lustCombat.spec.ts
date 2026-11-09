import { afterEach, describe, expect, it } from 'vitest'
import { act, currentActor, defenseMult, effectiveLustMax, finishCombat, lustMaxFor, startCombat, unusableReason, type Combatant } from '@/engine/combat'
import { setContentFilters } from '@/engine/content'
import { enemies } from '@/engine/data'
import { useItem } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { npcRecord } from '@/engine/npcs'

/** 主角一個人、會指定的色情技能，打一隻怪；回合輪到主角為止 */
function fight(abilities: string[], group: [string, number][] = [['goblin', 1]], lustMult?: number) {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
  const pc = pcOf(state)
  pc.abilities.push(...abilities)
  pc.level = 5
  pc.hp = pc.maxHp = 200
  if (lustMult !== undefined) state.options = { ...state.options!, lustMult }
  const combat = startCombat(state, group)
  const me = combat.combatants.find((c) => c.id === pc.id)!
  const foe = combat.combatants.find((c) => c.side === 'enemy')!
  return { state, combat, me, foe }
}

/** 讓主角的回合開始（敵人先動完）；主角必須在場 */
function myTurn(state: GameState, me: Combatant) {
  for (let i = 0; i < 20 && state.combat?.status === 'ongoing' && currentActor(state.combat)?.id !== me.id; i++) act(state, { type: 'end_turn' })
}

afterEach(() => setContentFilters({ pc_unwilling: true }))

describe('慾望戰鬥：基本', () => {
  it('慾望上限依等級；不死與構裝免疫魅惑，「全部」的抗性不影響魅惑', () => {
    const { me, foe } = fight([], [['skeleton', 1]])
    // 主角的忍耐（預設 10）再加一半到上限
    expect(me.lustMax).toBe(lustMaxFor(me.level) + 5)
    expect(lustMaxFor(10)).toBe(60)
    expect(defenseMult(foe, 'lust')).toBe(0)
    foe.resist = { all: -0.5 }
    expect(defenseMult(foe, 'lust')).toBe(1)
    expect(defenseMult(foe, 'fire')).toBe(0.5)
  })

  it('關閉（lustMult = 0）時沒有慾望條，色情技能不能用，敵人拿掉慾望攻擊', () => {
    const { combat, me, foe } = fight(['lust_glance'], [['honor_succubus', 1]], 0)
    expect(me.lustMax).toBeUndefined()
    expect(unusableReason(combat, me, 'lust_glance')).toBe('慾望戰鬥已關閉')
    expect(foe.abilities).not.toContain('m_lust_kiss')
    expect(foe.abilities).toContain('siren_song')
  })

  it('「主角非自願」關掉時敵人不用慾望攻擊；年幼的怪物免疫而且沒有慾望攻擊', () => {
    setContentFilters({ pc_unwilling: false })
    expect(fight([], [['honor_succubus', 1]]).foe.abilities).not.toContain('m_lust_kiss')
    setContentFilters({ pc_unwilling: true })
    expect(fight([], [['honor_succubus', 1]]).foe.abilities).toContain('m_lust_kiss')
    const def = enemies.honor_succubus!
    const before = def.traits
    def.traits = ['young']
    try {
      const { foe } = fight([], [['honor_succubus', 1]])
      expect(foe.abilities).not.toContain('m_lust_kiss')
      expect(defenseMult(foe, 'lust')).toBe(0)
    } finally {
      if (before) def.traits = before
      else delete def.traits
    }
  })
})

describe('慾望戰鬥：高潮', () => {
  it('我方高潮：失去最大生命的三分之一、慾望歸零、這回合結束、之後不會馬上再高潮', () => {
    const { state, me } = fight(['lust_self_tease'])
    myTurn(state, me)
    me.lust = effectiveLustMax(me) - 5
    const hp = me.hp
    act(state, { type: 'ability', ability: 'lust_self_tease' })
    expect(me.lust).toBe(0)
    expect(me.climaxes).toBe(1)
    const lines = state.combat!.timeline.filter((t) => t.actor === me.id)
    expect(lines.some((t) => t.effects?.some((e) => e.type === 'damage' && e.target === me.id && e.amount === Math.round(me.maxHp * 0.33) && e.text === '高潮'))).toBe(true)
    expect(me.hp).toBeLessThanOrEqual(hp - Math.round(me.maxHp * 0.33))
    // 這回合結束，下一回合跳過（主角一個人，敵人行動完之後就輪到主角的那一回合）
    expect(lines.some((t) => t.action === '高潮・無法行動')).toBe(true)
  })

  it('高潮餘韻時慾望停在上限，餘韻結束後再受到慾望就高潮', () => {
    const { state, me } = fight(['lust_self_tease'])
    myTurn(state, me)
    me.lust = effectiveLustMax(me)
    me.statuses.push({ id: 'afterglow_combat', turns: 2, source: me.id })
    act(state, { type: 'ability', ability: 'lust_self_tease' })
    expect(me.climaxes).toBe(0)
    expect(me.lust).toBe(effectiveLustMax(me))
    act(state, { type: 'end_turn' })
    myTurn(state, me)
    me.statuses = []
    me.lust = effectiveLustMax(me)
    act(state, { type: 'ability', ability: 'lust_self_tease' })
    expect(me.climaxes).toBe(1)
  })

  it('我方高潮不會致死（最多扣到剩 1）；第三次高潮倒下', () => {
    const { state, me } = fight(['lust_self_tease'])
    myTurn(state, me)
    me.lust = effectiveLustMax(me) - 5
    me.hp = 3
    act(state, { type: 'ability', ability: 'lust_self_tease' })
    expect(me.hp).toBe(1)

    const second = fight(['lust_self_tease'])
    myTurn(second.state, second.me)
    second.me.climaxes = 2
    second.me.lust = effectiveLustMax(second.me) - 5
    act(second.state, { type: 'ability', ability: 'lust_self_tease' })
    expect(second.me.hp).toBe(0)
    expect(second.state.combat!.status).toBe('defeat')
  })

  it('敵方高潮：受到最大生命三分之一的真實傷害，打倒算慾望勝利', () => {
    const { state, me, foe } = fight(['lust_whisper'])
    myTurn(state, me)
    foe.lust = effectiveLustMax(foe) - 1
    foe.tempHp = 99
    const hp = foe.hp
    act(state, { type: 'ability', ability: 'lust_whisper', target: foe.id })
    expect(foe.lust).toBe(0)
    expect(foe.hp).toBe(Math.max(0, hp - Math.round(foe.maxHp * 0.33)))
    expect(foe.tempHp).toBe(99)
    expect(foe.statuses.some((s) => s.id === 'climax')).toBe(false)

    // 剩下的生命不到三分之一：高潮收尾
    myTurn(state, me)
    if (state.combat!.status === 'ongoing') {
      foe.hp = 1
      foe.lust = effectiveLustMax(foe) - 1
      act(state, { type: 'ability', ability: 'lust_whisper', target: foe.id })
    }
    expect(foe.lustDefeated).toBe(true)
    const report = finishCombat(state)
    expect(report.outcome.tags).toContain('慾望勝利')
    expect(report.narration?.adult_scene).toContain('屈服')
    expect(report.others?.find((o) => o.id === foe.id)?.status).toContain('在高潮中屈服')
  })
  it('沒有人高潮，但有人被挑起慾望：一樣交給成人場景的寫手；沒有色情要素的戰鬥不交', () => {
    const { state, me, foe } = fight(['lust_whisper'])
    myTurn(state, me)
    act(state, { type: 'ability', ability: 'lust_whisper', target: foe.id })
    expect(foe.lust).toBeGreaterThan(0)
    expect(foe.lustDefeated).toBeFalsy()
    // 用一般的方式收尾
    foe.hp = 0
    state.combat!.status = 'victory'
    const report = finishCombat(state)
    expect(report.narration?.adult_scene).toContain('被挑起了慾望')
    expect(report.outcome.tags ?? []).not.toContain('高潮')
    // 只是挑逗：不算親密場景，淫亂不因此成長
    expect(report.narration?.tease).toBe(report.narration?.adult_scene)
    expect(report.changes.lewd ?? []).toEqual([])

    const plain = fight([], [['goblin', 1]], 0)
    plain.foe.hp = 0
    plain.state.combat!.status = 'victory'
    expect(finishCombat(plain.state).narration?.adult_scene).toBeUndefined()
  })
})

describe('慾望戰鬥：技能', () => {
  it('引爆：消耗全部慾望造成傷害，結束回合，下一回合脫力', () => {
    const { state, combat, me, foe } = fight(['burst_flame'], [['goblin', 2]])
    myTurn(state, me)
    expect(unusableReason(combat, me, 'burst_flame')).toBe('慾望不足')
    me.lust = 40
    foe.hp = foe.maxHp = 500
    act(state, { type: 'ability', ability: 'burst_flame', target: foe.id })
    expect(me.lust).toBe(0)
    expect(500 - foe.hp).toBeGreaterThanOrEqual(Math.floor(Math.floor(40 * 0.8) * defenseMult(foe, 'fire')))
    // 回合立刻結束，下一回合脫力、跳過
    const after = combat.timeline.slice(combat.timeline.findIndex((t) => t.action === '情焰・脫力'))
    expect(after.some((t) => t.actor === me.id && t.action === '脫力・無法行動')).toBe(true)
    expect(after.filter((t) => t.actor === me.id && t.action === '情焰')).toEqual([])
  })

  it('痛即是悅：受到的生命傷害一半改成慾望；肉盾侍奉：攻擊由侍奉者承受', () => {
    const { state, me, foe } = fight([], [['goblin', 2]])
    myTurn(state, me)
    addItem(state.inventory, '法術卷軸（普通）', 2)
    foe.hp = foe.maxHp = 500
    foe.statuses.push({ id: 'pain_pleasure', turns: 3, source: foe.id })
    act(state, { type: 'item', item: '法術卷軸（普通）', target: foe.id })
    const lost = 500 - foe.hp
    expect(foe.lust).toBeGreaterThan(0)
    expect(Math.abs((foe.lust ?? 0) - lost)).toBeLessThanOrEqual(1)

    myTurn(state, me)
    const other = state.combat!.combatants.find((c) => c.side === 'enemy' && c !== foe)!
    other.hp = other.maxHp = 500
    foe.statuses = [{ id: 'guarded', turns: 2, source: other.id, charges: 1 }]
    const hp = foe.hp
    act(state, { type: 'item', item: '法術卷軸（普通）', target: foe.id })
    expect(foe.hp).toBe(hp)
    expect(other.hp).toBeLessThan(500)
    expect(other.lust).toBeGreaterThan(0)
  })

  it('獻身：從隊友身上吸慾望；情熱傳染：把慾望分出去並給臨時生命', () => {
    const { state, combat, me } = fight(['lust_devote', 'lust_spread'])
    const ally: Combatant = { ...me, id: 'ally', name: '隊友', statuses: [], lust: 30, usedTurn: {}, usedCombat: {}, usedRest: {} }
    combat.combatants.push(ally)
    myTurn(state, me)
    me.lust = 0
    act(state, { type: 'ability', ability: 'lust_devote' })
    expect(ally.lust).toBe(10)
    expect(me.lust).toBe(20)
    myTurn(state, me)
    me.lust = 40
    ally.lust = 0
    ally.tempHp = 0
    act(state, { type: 'ability', ability: 'lust_spread' })
    expect(ally.lust).toBe(12)
    expect(me.lust).toBe(28)
    expect(ally.tempHp).toBe(2)
  })

  it('戰後：慾望還很高的人發情，高潮過的人餘韻', () => {
    const { state, me, foe } = fight(['lust_self_tease'])
    myTurn(state, me)
    me.lust = effectiveLustMax(me) - 5
    act(state, { type: 'ability', ability: 'lust_self_tease' })
    me.lust = effectiveLustMax(me)
    foe.hp = 0
    state.combat!.status = 'victory'
    const report = finishCombat(state)
    const pc = pcOf(state)
    expect(pc.status).toEqual(expect.arrayContaining(['aroused', 'afterglow']))
    expect(report.outcome.tags).toContain('高潮')
  })
})

describe('技能書', () => {
  it('每讀一次學會下一個還沒學、等級也夠的能力；等級不夠時說明', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3 })
    const pc = pcOf(state)
    addItem(state.inventory, '《媚術入門》', 2)
    useItem(state, '《媚術入門》', pc.id)
    expect(pc.abilities).toContain('lust_glance')
    useItem(state, '《媚術入門》', pc.id)
    expect(pc.abilities).toContain('lust_tease')
    addItem(state.inventory, '《情焰秘法》', 1)
    expect(() => useItem(state, '《情焰秘法》', pc.id)).toThrow('5 級')
  })
})

describe('慾望戰鬥的修正', () => {
  function fight(abilities: string[], group: [string, number][]) {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    const pc = pcOf(state)
    pc.abilities.push(...abilities)
    pc.loadout = undefined
    pc.level = 13
    pc.hp = pc.maxHp = 200
    const combat = startCombat(state, group)
    const me = combat.combatants.find((c) => c.id === pc.id)!
    return { state, combat, me }
  }

  it('獻祭的契紋：多目標的引爆只放一次', () => {
    const { state, combat, me } = fight(['lust_sacrifice_sigil', 'burst_bliss'], [['goblin', 4]])
    myTurn(state, me)
    for (const c of combat.combatants) if (c.side === 'enemy') c.hp = c.maxHp = 9999
    act(state, { type: 'ability', ability: 'lust_sacrifice_sigil' })
    me.lust = effectiveLustMax(me) - 1
    const n0 = combat.timeline.length
    act(state, { type: 'ability', ability: 'burst_bliss' })
    expect(combat.timeline.slice(n0).filter((t) => t.action === '獻祭的契紋')).toHaveLength(1)
  })

  it('緋夢樂園的怪與魔族不會擲到年幼', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed })
      const combat = startCombat(state, [['lp_succ_dancer', 3], ['lp_lewd_cat', 3]])
      for (const c of combat.combatants.filter((x) => x.side === 'enemy')) expect(c.traits ?? []).not.toContain('young')
    }
  })

  it('層主的慾望上限照生命比例放大，一般怪物不變', () => {
    const { combat } = fight([], [['lp_boss_queen', 1], ['lp_succ_dancer', 1]])
    const boss = combat.combatants.find((c) => c.defId === 'lp_boss_queen')!
    const minion = combat.combatants.find((c) => c.defId === 'lp_succ_dancer')!
    expect(boss.boss).toBe(true)
    // 1170 HP 對同等級一般怪物（約 87 HP）
    expect(boss.lustMax!).toBeGreaterThan(lustMaxFor(enemies.lp_boss_queen!.level) * 10)
    expect(minion.lustMax).toBe(lustMaxFor(minion.level))
  })

  it('存檔規則分開設定高潮扣的生命：我方、小怪、頭目', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    const pc = pcOf(state)
    pc.abilities.push('lust_whisper', 'lust_self_tease')
    pc.level = 5
    pc.hp = pc.maxHp = 9999
    state.options = { ...state.options!, climaxHpParty: 0, climaxHpMinion: 50, climaxHpBoss: 10 }
    const combat = startCombat(state, [['lp_boss_queen', 1], ['lp_succ_dancer', 1]])
    expect(combat.climaxHp).toEqual({ party: 0, minion: 0.5, boss: 0.1 })
    const me = combat.combatants.find((c) => c.id === pc.id)!
    const boss = combat.combatants.find((c) => c.defId === 'lp_boss_queen')!
    const minion = combat.combatants.find((c) => c.defId === 'lp_succ_dancer')!
    for (const [foe, ratio] of [[minion, 0.5], [boss, 0.1]] as const) {
      myTurn(state, me)
      foe.lust = effectiveLustMax(foe) - 1
      const hp = foe.hp
      act(state, { type: 'ability', ability: 'lust_whisper', target: foe.id })
      expect(foe.hp).toBe(Math.max(0, hp - Math.round(foe.maxHp * ratio)))
    }
    // 我方 0%：高潮照常（慾望歸零、計次），不扣生命
    const solo = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    const p2 = pcOf(solo)
    p2.abilities.push('lust_self_tease')
    p2.level = 5
    p2.hp = p2.maxHp = 200
    solo.options = { ...solo.options!, climaxHpParty: 0 }
    const c2 = startCombat(solo, [['goblin', 1]])
    const me2 = c2.combatants.find((c) => c.id === p2.id)!
    myTurn(solo, me2)
    me2.lust = effectiveLustMax(me2) - 5
    const hp2 = me2.hp
    act(solo, { type: 'ability', ability: 'lust_self_tease' })
    expect(me2.climaxes).toBe(1)
    expect(me2.hp).toBe(hp2)
    // 都是預設時不記在戰鬥上
    expect(startCombat(newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 }), [['goblin', 1]]).climaxHp).toBeUndefined()
  })
})

describe('任務戰鬥的慾望勝利', () => {
  it('被慾望勝利打倒的具名 NPC 不會死，戰報寫被制伏', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    const id = 'npc_lina'
    const combat = startCombat(state, [], { npcs: [id], story: { id: 'none', node: 'none' } })
    const foe = combat.combatants.find((c) => c.npcId === id)!
    foe.hp = 0
    foe.lustDefeated = true
    combat.status = 'victory'
    const report = finishCombat(state)
    expect(npcRecord(state, id)?.dead).toBeFalsy()
    expect(report.others?.find((o) => o.name === foe.name)?.status).toContain('在高潮中屈服、被制伏')
  })
})
