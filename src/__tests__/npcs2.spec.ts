import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { finishCombat } from '@/engine/combat'
import { avoidFoes, checkHostiles, fightFoes, payToll } from '@/engine/encounters'
import { captiveConsequence, resolveCaptive } from '@/engine/captives'
import { setupInteraction } from '@/engine/interactions'
import { hireAtAsking } from '@/engine/companions'
import { setAdultContent } from '@/engine/content'
import { currentArea, enterLocation, goOutskirts, move, returnToTown, standOn } from '@/engine/grid'
import { generateNpc, npcRecord } from '@/engine/npcs'
import { ensureRoster, isHostile, outsideQuota, peopleHere, pruneNpcs, refreshRosters, spawnVisitors } from '@/engine/population'
import {
  alertFine, alertLevel, fineDue, gateCheck, isWanted, payFine, raiseAlert, reputationBand, wantedFine, zoneEntryBlock,
} from '@/engine/security'
import { newGame, withRng } from '@/engine/state'
import { dealMoney, shopKey, shopState } from '@/engine/trade'
import { travel } from '@/engine/travel'
import type { GameState, NpcRecord } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(seed = 3): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed })
  enterLocation(state)
  return state
}

/** 在主角旁邊放一個人 */
function beside(state: GameState, spec: Parameters<typeof generateNpc>[2] = {}): NpcRecord {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 1, ...spec }, 'vis'))
  const p = state.position!
  rec.at = { area: p.area, x: p.x, y: p.y, until: state.time.day }
  return rec
}

function act(state: GameState, input: Parameters<typeof prepareAction>[1], natural: number) {
  prepareAction(state, input)
  state.pendingAction!.natural = natural
  const r = resolveAction(state, null)
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return r
}

describe('roster turnover', () => {
  it('changes rosters slowly over time without touching the game rng', () => {
    const state = game()
    ensureRoster(state, 'soriel')
    const before = [...state.rosters!.soriel!.members]
    const rng = state.rngState
    state.time.day += 60
    refreshRosters(state)
    expect(state.rngState).toBe(rng)
    const after = state.rosters!.soriel!.members
    expect(after).not.toEqual(before)
    // 王都 12 + 12 人，加上不佔名額的固定 NPC（教皇、審判長……）
    expect(after.length).toBeLessThanOrEqual(24 + after.filter((id) => outsideQuota(id)).length)
    expect(after.filter((id) => before.includes(id)).length).toBeGreaterThan(12)
    expect(state.rosters!.soriel!.updated).toBe(1 + 60)
  })
})

describe('visitors', () => {
  it('meets people in the outskirts and dungeons, and forgets strangers afterwards', () => {
    let found: { state: GameState; visitors: NpcRecord[] } | undefined
    for (let seed = 1; seed < 40 && !found; seed++) {
      const state = game(seed)
      standOn(state, 'gate')
      goOutskirts(state)
      const visitors = Object.values(state.npcs ?? {}).filter((r) => r.at?.area === currentArea(state).key)
      if (visitors.length) found = { state, visitors }
    }
    expect(found).toBeTruthy()
    const { state, visitors } = found!
    expect(peopleHere(state).map((p) => p.rec.id)).toContain(visitors[0]!.id)
    pruneNpcs(state)
    expect(npcRecord(state, visitors[0]!.id)).toBeTruthy()
    state.time.day += 1
    pruneNpcs(state)
    if (visitors[0]!.id.startsWith('vis_')) expect(state.npcs?.[visitors[0]!.id]).toBeUndefined()
  })

  it('can bring back someone you know', () => {
    const state = game()
    const friend = withRng(state, (rng) => generateNpc(state, rng, { haunts: [{ location: 'soriel', zone: 'outskirts', weight: 1 }] }))
    state.relationships = { [friend.id]: { id: friend.id, name: friend.name, affinity: 30, appearance: '', toPlayer: '老朋友', toOthers: {} } }
    let met = false
    for (let d = 0; d < 30 && !met; d++) {
      state.time.day = 2 + d
      const area = { key: `soriel/outskirts`, location: 'soriel', name: '近郊', kind: 'wild' as const, width: 7, height: 7, cells: Array.from({ length: 49 }, () => ({ kind: 'floor' as const })), day: state.time.day }
      spawnVisitors(state, area, { x: 0, y: 0 })
      met = friend.at?.until === state.time.day
    }
    expect(met).toBe(true)
  })
})

describe('hostile adventurers', () => {
  function outside(seed = 5) {
    const state = game(seed)
    standOn(state, 'gate')
    goOutskirts(state)
    for (const r of Object.values(state.npcs ?? {})) delete r.at
    return state
  }

  it('starts a standoff with villains outside town, and lets you sneak past or pay', () => {
    const state = outside()
    const villain = beside(state, { tags: ['villain'], level: 2 })
    expect(isHostile(state, villain)).toBe(true)
    const r = checkHostiles(state)!
    expect(validate(r)).toBe(true)
    expect(state.standoff?.npcs).toEqual([villain.id])
    expect(() => goOutskirts(state)).toThrow()
    if (!state.standoff!.detected) {
      avoidFoes(state)
      expect(state.standoff).toBeUndefined()
      expect(checkHostiles(state)).toBeUndefined()
    } else {
      const money = state.money_cc
      payToll(state)
      expect(state.money_cc).toBe(money - 60)
    }
  })

  it('talks your way out, or fights and settles the outcome', () => {
    const state = outside()
    const a = beside(state, { tags: ['villain'], level: 1 })
    checkHostiles(state)
    state.standoff!.detected = true
    act(state, { kind: 'bluff', target: a.id, text: '說後面還有一整隊騎士' }, 20)
    expect(state.standoff).toBeUndefined()
    expect(state.avoided?.[a.id]).toBe(state.time.day)

    const b = beside(state, { tags: ['villain'], level: 1 })
    checkHostiles(state)
    state.standoff!.detected = true
    act(state, { kind: 'intimidate', target: b.id, text: '' }, 1)
    expect(state.combat?.combatants.find((c) => c.npcId === b.id)).toBeTruthy()
    // 打贏：對方被制伏、拿到戰利品與經驗；處決之後才死亡
    for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
    state.combat!.status = 'victory'
    const report = finishCombat(state)
    expect(validate(report)).toBe(true)
    expect(report.changes.money_cc).toBeGreaterThan(0)
    expect(state.captives).toMatchObject({ npcs: [b.id], aggressor: 'npc' })
    expect(npcRecord(state, b.id)!.dead).toBeFalsy()
    expect(() => move(state, 1, 0)).toThrow('處置')
    const done = resolveCaptive(state, b.id, 'execute')
    expect(validate(done)).toBe(true)
    expect(npcRecord(state, b.id)!.dead).toBe(true)
    expect(state.captives).toBeUndefined()
    expect(peopleHere(state).map((p) => p.rec.id)).not.toContain(b.id)
    // 處決的人不留在關係裡
    expect(state.relationships?.[b.id]).toBeUndefined()
  })

  it('lets you spare or enslave whoever you beat; who struck first decides the cost', () => {
    // 對方攔路、在近郊被制伏：收為奴隸沒有衛兵（近郊），聲望 -1
    const state = outside()
    const win = () => {
      checkHostiles(state)
      fightFoes(state)
      for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
      state.combat!.status = 'victory'
      finishCombat(state)
    }
    const a = beside(state, { tags: ['villain'], level: 1 })
    win()
    expect(state.captives?.npcs).toEqual([a.id])
    const r = resolveCaptive(state, a.id, 'enslave')
    expect(validate(r)).toBe(true)
    expect(state.party.find((m) => m.id === a.id)?.bond).toBe('slave')
    expect(state.party.find((m) => m.id === a.id)?.hp).toBe(1)
    // 照入隊方式給初始親密度（奴隸 -10）
    expect(state.relationships![a.id]!.affinity).toBe(-10)
    expect(state.reputation.holy_ring).toBe(-1)
    expect(alertLevel(state, 'soriel')).toBe(0)
    // 放過對方先動手的人：對方欠你一份情
    const b = beside(state, { tags: ['villain'], level: 1 })
    win()
    expect(state.captives?.npcs).toEqual([b.id])
    const before = state.relationships?.[b.id]?.affinity ?? 0
    resolveCaptive(state, b.id, 'release')
    expect(state.relationships![b.id]!.affinity).toBeGreaterThan(before)
    expect(npcRecord(state, b.id)!.dead).toBeFalsy()
    expect(state.captives).toBeUndefined()
  })

  it('costs more when you struck first in town; no alert when nobody saw the ambush', () => {
    const state = game()
    const rival = beside(state)
    act(state, { kind: 'attack', target: rival.id, text: '' }, 20)
    expect(alertLevel(state, 'soriel')).toBe(0)
    for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
    state.combat!.status = 'victory'
    finishCombat(state)
    expect(state.captives).toMatchObject({ aggressor: 'party', unseen: true })
    // 被制伏的人不能聊天、偷竊、再偷襲、雇用
    expect(() => setupInteraction(state, 'chat', rival.id)).toThrow('制伏')
    expect(() => setupInteraction(state, 'attack', rival.id)).toThrow('制伏')
    state.money_cc = 100000
    expect(() => hireAtAsking(state, rival.id)).toThrow('制伏')
    expect(captiveConsequence(state, 'enslave')).toEqual({ alert: 0, reputation: -3, wanted: false })
    const r = resolveCaptive(state, rival.id, 'enslave', '用繩子捆起來，烙上我的家紋')
    expect(r.narration?.player_intent).toBe('用繩子捆起來，烙上我的家紋')
    expect(validate(r)).toBe(true)
    expect(alertLevel(state, 'soriel')).toBe(0)
    expect(state.reputation.holy_ring).toBe(-3)
    // 收為奴隸：1 HP 加入，關係文字是戰後收的
    const slave = state.party.find((m) => m.id === rival.id)!
    expect(slave.hp).toBe(1)
    expect(state.relationships![rival.id]!.toPlayer).toContain('制伏')
  })

  it('warns when the disposal would get you wanted after a witnessed ambush', () => {
    const state = game()
    const rival = beside(state)
    act(state, { kind: 'attack', target: rival.id, text: '' }, 2)
    expect(alertLevel(state, 'soriel')).toBe(2)
    for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
    state.combat!.status = 'victory'
    finishCombat(state)
    expect(state.captives?.unseen).toBeUndefined()
    expect(captiveConsequence(state, 'release')).toMatchObject({ alert: 0, wanted: false })
    expect(captiveConsequence(state, 'release', ['rob'])).toMatchObject({ alert: 1, wanted: true })
    // 對被制伏的人主動行動：提醒 AI 人還在你手上
    const q = act(state, { kind: 'free', target: rival.id, text: '逼問是誰派他來的' }, 12)
    expect(q.narration?.focus?.join('')).toContain('仍在主角手上')
    expect(state.captives?.npcs).toEqual([rival.id])
    resolveCaptive(state, rival.id, 'execute')
    expect(isWanted(state, 'holy_ring')).toBe(true)
  })

  it('robs (and, with adult content on, violates) a captive in the same entry as the disposal', () => {
    const state = outside()
    const a = beside(state, { tags: ['villain'], level: 2 })
    checkHostiles(state)
    fightFoes(state)
    for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
    state.combat!.status = 'victory'
    finishCombat(state)
    const money = state.money_cc
    const reports = state.reports.length
    // 劫色只在開啟成人向時
    setAdultContent(false)
    expect(() => resolveCaptive(state, a.id, 'release', '', ['rob', 'violate'])).toThrow('成人向')
    expect(state.captives?.npcs).toEqual([a.id])
    setAdultContent(true)
    const r = resolveCaptive(state, a.id, 'release', '翻遍他的行囊', ['rob', 'violate'])
    setAdultContent(false)
    expect(validate(r)).toBe(true)
    expect(state.reports.length).toBe(reports + 1)
    expect(r.outcome.tags).toEqual(['戰後處置', '劫財', '劫色', '放過'])
    expect(r.outcome.summary).toContain('搜了一遍')
    expect(r.narration?.adult_scene).toBeTruthy()
    expect(state.money_cc).toBeGreaterThan(money)
    // 對方攔路在先：劫財 -10、劫色 -30、放過 +5
    expect(state.relationships![a.id]!.affinity).toBe(-35)
    expect(state.reputation.holy_ring).toBe(-2)
    expect(state.captives).toBeUndefined()
  })
})

describe('crime and the guards', () => {
  it('steals money, and getting caught raises the alert and costs reputation', () => {
    const state = game()
    const mark = beside(state, { kind: 'commoner', tags: ['merchant'], occupation: '布商' })
    const money = state.money_cc
    act(state, { kind: 'steal', target: mark.id, text: '' }, 20)
    expect(state.money_cc).toBeGreaterThanOrEqual(money)
    const r = act(state, { kind: 'steal', target: mark.id, text: '' }, 1)
    expect(r.check?.degree).toBe('fumble')
    expect(alertLevel(state)).toBe(2)
    expect(state.reputation.holy_ring).toBe(-2)
    expect(state.relationships![mark.id]!.affinity).toBeLessThan(0)
  })

  it('only attacks adventurers; a witnessed attack angers their haunts too', () => {
    const state = game()
    const baker = beside(state, { kind: 'commoner', tags: ['commoner'] })
    expect(() => prepareAction(state, { kind: 'attack', target: baker.id, text: '' })).toThrow('不能攻擊普通人')
    const rival = beside(state, { haunts: [{ location: 'soriel', zone: 'town', weight: 1 }, { location: 'albena', zone: 'town', weight: 0.5 }] })
    act(state, { kind: 'attack', target: rival.id, text: '' }, 1)
    expect(state.combat).toBeTruthy()
    const enemy = state.combat!.combatants.find((c) => c.npcId === rival.id)!
    expect(state.combat!.order.at(-1)).not.toBe(enemy.id)
    expect(npcRecord(state, rival.id)!.hostile).toBe(true)
    expect(alertLevel(state, 'soriel')).toBe(2)
    expect(alertLevel(state, 'albena')).toBe(1)
    expect(state.reputation.holy_ring).toBe(-2)
    expect(state.reputation.aude_federation).toBe(-1)
  })

  it('puts you on the wanted list at alert 3, and fines clear it', () => {
    const state = game()
    raiseAlert(state, 'soriel', 2)
    expect(alertFine(state)).toBe(15 * 7 * 2)
    expect(isWanted(state, 'holy_ring')).toBe(false)
    raiseAlert(state, 'soriel', 1)
    expect(isWanted(state, 'holy_ring')).toBe(true)
    expect(fineDue(state)).toEqual({ amount: 15 * 60, wanted: true })
    state.reputation.holy_ring = -10
    expect(wantedFine(state, 'holy_ring')).toBe(15 * 60 * 2)
    // 通緝：不能檢定，城門出不去；貴族區、王城也進不去
    standOn(state, 'gate')
    expect(() => goOutskirts(state)).toThrow('通緝')
    expect(zoneEntryBlock(state, 'noble')).toContain('通緝')
    state.money_cc = 5000
    payFine(state)
    expect(isWanted(state, 'holy_ring')).toBe(false)
    expect(alertLevel(state)).toBe(0)
    expect(state.money_cc).toBe(5000 - 1800)
    goOutskirts(state)
    expect(currentArea(state).kind).toBe('wild')
  })

  it('checks you at the gate when the guards are alert, once a day', () => {
    const state = game()
    standOn(state, 'gate')
    raiseAlert(state, 'soriel', 1)
    const g = gateCheck(state)
    expect(g.report?.timeline?.[0]?.roll?.dc).toBe(13)
    if (g.ok) {
      expect(gateCheck(state)).toEqual({ ok: true })
    } else {
      expect(gateCheck(state).reason).toContain('記得你')
      expect(() => goOutskirts(state)).toThrow('記得你')
    }
    // 警戒過一段時間會降下來
    state.time.day += 7
    expect(alertLevel(state)).toBe(0)
  })

  it('keeps the palace for people of standing', () => {
    const state = game()
    expect(zoneEntryBlock(state, 'palace')).toContain('聲望')
    expect(zoneEntryBlock(state, 'noble')).toBeNull()
    state.reputation.holy_ring = 10
    expect(zoneEntryBlock(state, 'palace')).toBeNull()
  })

  it('prices follow your reputation with the local faction', () => {
    const state = game()
    const shop = shopState(state, 'general')
    const key = shopKey(state, 'general')
    const deal = shop.deals.find((d) => d.gives.some((g) => g.type === 'money'))!
    const normal = dealMoney(state, key, deal)
    state.reputation.holy_ring = -10
    expect(reputationBand(state).buy).toBe(0.3)
    expect(dealMoney(state, key, deal)).toBeGreaterThan(normal)
    state.reputation.holy_ring = 10
    expect(dealMoney(state, key, deal)).toBeLessThan(normal)
  })

  it('pays the fine on arrival when wanted, or leaves you outside the walls', () => {
    const rich = game()
    raiseAlert(rich, 'rivervale', 3)
    rich.money_cc = 5000
    standOn(rich, 'gate')
    travel(rich, 'rivervale')
    expect(rich.location).toBe('rivervale')
    expect(isWanted(rich, 'human_alliance')).toBe(false)
    expect(currentArea(rich).kind).toBe('settlement')

    const poor = game()
    raiseAlert(poor, 'rivervale', 3)
    poor.money_cc = 300
    standOn(poor, 'gate')
    travel(poor, 'rivervale')
    expect(currentArea(poor).kind).toBe('wild')
    expect(() => returnToTown(poor)).toThrow('通緝')
  })
})
