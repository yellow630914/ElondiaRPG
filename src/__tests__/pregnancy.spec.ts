import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, setContentFilters } from '@/engine/content'
import { childrenOf, hasTemple, nurseryRefusal, owedFee, payNursery, templeDebt, visitChild } from '@/engine/children'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { buyHome, lotsOf, takeFurniture } from '@/engine/homes'
import { cribRefusal } from '@/engine/children'
import { addEncounter, applySexUpdates, sexCandidates } from '@/engine/sexRecord'
import { pcOf } from '@/engine/party'
import { checkModifiers } from '@/engine/perks'
import {
  answerBirth, conceptionChance, familyPrompt, familyTick, maybeConceive, pregnancyLine, stageOf, syncPregnancyMarks, templeCheckup,
} from '@/engine/pregnancy'
import { newGame, withRng } from '@/engine/state'
import { baseReport, templeHeal } from '@/engine/town'
import type { GameState, Report } from '@/engine/types'

function game(gender = '女') {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', gender, seed: 5 })
  return { state, pc: pcOf(state) }
}

/** 一位人際關係裡的 NPC（不在隊上） */
function npc(state: GameState, gender: string, race = 'human') {
  return registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, gender, race })))
}

function scene(state: GameState, others: Report['others'] = []): Report {
  const r = baseReport(state, 'action', 1)
  r.narration = { adult_scene: '在旅店的房間裡共度一夜' }
  r.others = others
  state.reports.push(r)
  return r
}

/** 一直親密到受孕為止（固定種子，同一份日誌只擲一次） */
function conceive(state: GameState, mother: string, father: { id?: string; name: string }): Report {
  for (let i = 0; i < 80; i++) {
    const r = scene(state)
    if (maybeConceive(state, { report: r, mother, partners: [father], times: 3 })) return r
  }
  throw new Error('80 次都沒受孕')
}

beforeEach(() => setContentFilters({ ...DEFAULT_FILTERS, pregnancy: true }))
afterEach(() => setContentFilters({ ...DEFAULT_FILTERS }))

describe('懷孕：誰會受孕', () => {
  it('內容篩選「懷孕」預設關閉：關著時不擲；存檔規則 0 也不擲', () => {
    const { state } = game()
    const man = npc(state, 'male')
    const input = { report: scene(state), mother: 'pc', partners: [{ id: man.id, name: man.name }], times: 1 }
    expect(DEFAULT_FILTERS.pregnancy).toBe(false)
    expect(conceptionChance(state, input)?.chance).toBeCloseTo(0.15)
    setContentFilters({ ...DEFAULT_FILTERS })
    expect(conceptionChance(state, input)).toBeUndefined()
    setContentFilters({ ...DEFAULT_FILTERS, pregnancy: true })
    state.options = { ...state.options!, conceptionMult: 0 }
    expect(conceptionChance(state, input)).toBeUndefined()
  })

  it('性別：女性、扶她能懷孕；男性主角不會，但能讓女性 NPC 懷孕；兩位女性不會', () => {
    const { state } = game('男')
    const woman = npc(state, 'female')
    expect(conceptionChance(state, { report: scene(state), mother: 'pc', partners: [{ id: woman.id, name: woman.name }], times: 1 })).toBeUndefined()
    expect(conceptionChance(state, { report: scene(state), mother: woman.id, partners: [{ id: 'pc', name: '莉雅' }], times: 1 })?.father).toEqual({ id: 'pc', name: '莉雅' })
    const her = game().state
    const other = npc(her, 'female')
    expect(conceptionChance(her, { report: scene(her), mother: 'pc', partners: [{ id: other.id, name: other.name }], times: 1 })).toBeUndefined()
    expect(conceptionChance(her, { report: scene(her), mother: 'pc', partners: [{ id: npc(her, 'futa').id, name: '扶她' }], times: 1 })).toBeDefined()
  })

  it('父親：只有一位時記那個人；兩位以上或沒寫對象是父親不明', () => {
    const { state } = game()
    const a = npc(state, 'male')
    const b = npc(state, 'male')
    const r = scene(state)
    expect(conceptionChance(state, { report: r, mother: 'pc', partners: [{ id: a.id, name: a.name }], times: 1 })?.father).toEqual({ id: a.id, name: a.name })
    expect(conceptionChance(state, { report: r, mother: 'pc', partners: [{ id: a.id, name: a.name }, { id: b.id, name: b.name }], times: 1 })?.father).toBeUndefined()
    expect(conceptionChance(state, { report: r, mother: 'pc', partners: [], times: 1 })?.father).toBeUndefined()
  })

  it('次數與種族改機率，最高 60%；不同種族、精靈比較難', () => {
    const { state } = game()
    const man = npc(state, 'male')
    const elf = npc(state, 'male', 'elf')
    const r = scene(state)
    expect(conceptionChance(state, { report: r, mother: 'pc', partners: [{ id: man.id, name: man.name }], times: 3 })?.chance).toBeCloseTo(0.225)
    expect(conceptionChance(state, { report: r, mother: 'pc', partners: [{ id: elf.id, name: elf.name }], times: 1 })?.chance).toBeCloseTo(0.15 * 0.6 * 0.6)
    state.options = { ...state.options!, conceptionMult: 3 }
    expect(conceptionChance(state, { report: r, mother: 'pc', partners: [{ id: man.id, name: man.name }], times: 3 })?.chance).toBe(0.6)
  })

  it('不會受孕：怪物（對象沒有 id、報告裡有怪物）、娼館接客、喝了避子湯、已經懷孕', () => {
    const { state, pc } = game()
    const man = npc(state, 'male')
    const withMonster = scene(state, [{ id: 'm1', name: '哥布林', monster: 'goblin' }])
    expect(conceptionChance(state, { report: withMonster, mother: 'pc', partners: [{ name: '哥布林' }], times: 2 })).toBeUndefined()
    expect(conceptionChance(state, { report: withMonster, mother: 'pc', partners: [], times: 2 })).toBeUndefined()
    const brothel = scene(state)
    brothel.narration = { ...brothel.narration, brothel_work: pc.id }
    expect(conceptionChance(state, { report: brothel, mother: 'pc', partners: [{ name: '客人' }], times: 2 })).toBeUndefined()
    pc.status.push('contraceptive')
    expect(conceptionChance(state, { report: scene(state), mother: 'pc', partners: [{ id: man.id, name: man.name }], times: 1 })).toBeUndefined()
    pc.status = pc.status.filter((x) => x !== 'contraceptive')
    conceive(state, 'pc', { id: man.id, name: man.name })
    expect(conceptionChance(state, { report: scene(state), mother: 'pc', partners: [{ id: man.id, name: man.name }], times: 1 })).toBeUndefined()
  })

  it('性經歷的 AI 記錄會擲受孕；NPC 私生活（addEncounter）不會', () => {
    const { state } = game()
    const woman = npc(state, 'female')
    for (let i = 0; i < 20; i++) addEncounter(state, woman.id, { day: state.time.day, with: [{ name: '旅人' }], sex: 3, service: 0, summary: '一夜情' })
    expect(state.pregnancies?.[woman.id]).toBeUndefined()
    const man = npc(state, 'male')
    for (let i = 0; i < 60 && !state.pregnancies?.pc; i++) {
      const r = scene(state, [{ id: man.id, name: man.name }])
      applySexUpdates(state, [{ id: 'pc', sex: 3, with: [{ id: man.id, name: man.name }], summary: '共度一夜' }], { report: r, candidates: sexCandidates(state, r) })
    }
    expect(state.pregnancies?.pc).toMatchObject({ father: { id: man.id, name: man.name } })
    expect(state.pregnancies!.pc!.known).toBeFalsy()
    expect(state.pregnancies!.pc!.due - state.pregnancies!.pc!.conceived).toBe(40)
  })
})

describe('懷孕：階段、察覺、檢定', () => {
  it('階段照比例縮放；未察覺時沒有減值、角色詳情不顯示；中期自動察覺並通知，靈巧檢定 -1', () => {
    const { state, pc } = game()
    const man = npc(state, 'male')
    conceive(state, 'pc', { id: man.id, name: man.name })
    const p = state.pregnancies!.pc!
    expect(stageOf(p, p.conceived)).toBe('hidden')
    expect(stageOf(p, p.conceived + 8)).toBe('early')
    expect(stageOf(p, p.conceived + 16)).toBe('mid')
    expect(stageOf(p, p.conceived + 30)).toBe('late')
    syncPregnancyMarks(state)
    expect(checkModifiers(pc, { context: 'action', attr: 'dex' }).some((x) => x.label.startsWith('懷孕'))).toBe(false)
    expect(pregnancyLine(state, 'pc')).toBe('')
    state.time = { ...state.time, day: p.conceived + 16 }
    familyTick(state)
    expect(p.known).toBe(true)
    expect(state.familyNotices?.[0]).toContain('懷孕了')
    expect(checkModifiers(pc, { context: 'action', attr: 'dex' })).toContainEqual({ label: '懷孕・中期', value: -1 })
    expect(pregnancyLine(state, 'pc')).toContain(`父親：${man.name}`)
  })

  it('神殿的診察看得出還沒察覺的懷孕', () => {
    const { state } = game()
    conceive(state, 'pc', { name: '酒館的客人' })
    if (!hasTemple(state.location)) return
    const r = templeCheckup(state)
    expect(r.outcome.summary).toContain('你懷孕了')
    expect(state.pregnancies!.pc!.known).toBe(true)
  })
})

describe('生產與嬰兒', () => {
  it('主角在聚落裡到了預產日：跳生產事件；生完產後虛弱、嬰兒送到選的地方（神殿）', () => {
    const { state, pc } = game()
    expect(hasTemple(state.location)).toBe(true)
    const man = npc(state, 'male')
    conceive(state, 'pc', { id: man.id, name: man.name })
    state.time = { ...state.time, day: state.pregnancies!.pc!.due }
    familyTick(state)
    expect(state.pendingBirth).toEqual({ mother: 'pc' })
    const r = answerBirth(state, 'self', '小莉', 'temple')
    expect(r.outcome.tags).toContain('生產')
    expect(state.pregnancies?.pc).toBeUndefined()
    expect(state.pendingBirth).toBeUndefined()
    expect(pc.pregMark?.postpartum).toBe(true)
    expect(checkModifiers(pc, { context: 'action', attr: 'cha' })).toContainEqual({ label: '產後虛弱', value: -1 })
    const kid = childrenOf(state)[0]!
    expect(kid).toMatchObject({ name: '小莉', mother: { id: 'pc' }, father: { id: man.id }, where: { kind: 'temple', location: state.location } })
    // 嬰兒不是 NPC：不在 NPC 登錄、不會被當成性經歷的對象
    expect(state.npcs?.[kid.id]).toBeUndefined()
    expect(sexCandidates(state, scene(state))).not.toContain(kid.id)
    // 一般的敘事寫孩子，成人場景不寫
    expect(familyPrompt(state, false)).toContain('小莉')
    expect(familyPrompt(state, true)).not.toContain('小莉')
  })

  it('不在隊上的 NPC 到了預產日自動生下：沒有房子送母親那座城的神殿，有房子送房子', () => {
    const { state } = game('男')
    const woman = npc(state, 'female')
    conceive(state, woman.id, { id: 'pc', name: '莉雅' })
    state.time = { ...state.time, day: state.pregnancies![woman.id]!.due }
    familyTick(state)
    expect(state.pendingBirth).toBeUndefined()
    expect(childrenOf(state)[0]).toMatchObject({ mother: { id: woman.id }, father: { id: 'pc' }, where: { kind: 'temple', location: woman.location } })
    expect(state.familyNotices?.some((t) => t.includes('生下了孩子'))).toBe(true)
  })

  it('有房子時自動送到房子（不用搖籃）；搖籃數不夠時不能收起', () => {
    const { state } = game('男')
    state.money_cc = 1_000_000
    buyHome(state, lotsOf(state.location)[0]!.id)
    const home = Object.values(state.homes!)[0]!
    const woman = npc(state, 'female')
    conceive(state, woman.id, { id: 'pc', name: '莉雅' })
    state.time = { ...state.time, day: state.pregnancies![woman.id]!.due }
    familyTick(state)
    expect(childrenOf(state)[0]!.where).toEqual({ kind: 'home', home: home.id })
    expect(cribRefusal(state, home)).toBeUndefined()
    // 擺一個搖籃：一個孩子、一個搖籃，收不起來
    const ground = home.areas[home.floors.find((k) => home.areas[k]!.homeFloor === 'ground')!]!
    const i = ground.cells.findIndex((c) => c.kind === 'floor' && !c.furniture)
    ground.cells[i]!.furniture = '搖籃'
    expect(cribRefusal(state, home)).toContain('搖籃')
    expect(() => takeFurniture(state, ground, i % ground.width, Math.floor(i / ground.width))).toThrow('搖籃')
  })

  it('育幼院：寄養費照天數累積，欠著時神殿的其他服務要先繳清；探望得到家人的笑容', () => {
    const { state, pc } = game()
    conceive(state, 'pc', { name: '旅人' })
    state.time = { ...state.time, day: state.pregnancies!.pc!.due }
    familyTick(state)
    answerBirth(state, 'self', undefined, 'temple')
    const kid = childrenOf(state)[0]!
    expect(owedFee(state, kid)).toBe(0)
    state.time = { ...state.time, day: state.time.day + 5 }
    expect(templeDebt(state)).toBe(50)
    expect(nurseryRefusal(state)).toContain('寄養費')
    pc.hp = 1
    state.money_cc = 10_000
    expect(() => templeHeal(state)).toThrow('寄養費')
    payNursery(state, 3)
    expect(templeDebt(state)).toBe(0)
    visitChild(state, kid.id)
    expect(pc.status).toContain('family_smile')
  })
})
