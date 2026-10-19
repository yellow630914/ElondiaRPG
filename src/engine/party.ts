// 隊伍成員的進出：入隊（雇傭、自願、奴隸、跟著別人的隊伍）、離隊、成為奴隸與獲釋、非戰鬥狀態與懲罰。
// 這些函式直接修改狀態，並把變化記在報告的 changes 裡；報告由呼叫端提交。

import { snapshot } from './character'
import { combatRules, companionRules, contractDef, npcs as namedNpcs, slaveryRules, type Bond } from './data'
import { characterFor, npcRecord, registerNpc } from './npcs'
import { ensureRelationship, setAffinity } from './social'
import type { Character, CompanionChange, ContractRef, GameState, NpcRecord, Report } from './types'

const JOIN_TEXT: Record<Bond, string> = {
  hired: '在酒館受雇加入隊伍的冒險夥伴。',
  voluntary: '自願加入隊伍的同伴。',
  slave: '被主角買下的奴隸。',
  leader: '帶著主角一起冒險的隊長。',
  ally: '同一支隊伍的隊員。',
}

export function partyRoom(state: GameState): number {
  return combatRules.party_max - state.party.length
}

export function pcOf(state: GameState): Character {
  const pc = state.party.find((m) => m.isPlayer)
  if (!pc) throw new Error('no player character')
  return pc
}

/** 主角目前跟著的隊長（加入了別人的隊伍，或身為奴隸被主人帶著） */
export function leaderOf(state: GameState): Character | undefined {
  return state.party.find((m) => m.bond === 'leader')
}

export function isEnslaved(state: GameState): boolean {
  return !!pcOf(state).contract
}

export function isFugitive(state: GameState): boolean {
  return pcOf(state).status.includes('fugitive')
}

/** 主角被主人帶著（有契約且沒有逃亡） */
export function isBound(state: GameState): boolean {
  return isEnslaved(state) && !isFugitive(state)
}

export function assertFree(state: GameState, what = '這麼做') {
  if (isBound(state)) throw new Error(`身為奴隸，不能${what}`)
}

function recordChange(report: Report | undefined, change: CompanionChange) {
  if (report) (report.changes.companions ??= []).push(change)
}

export interface JoinOptions {
  contract?: string
  group?: string
  reason?: string
}

/** NPC 入隊。新認識的角色依入隊方式設定初始親密度。 */
export function joinParty(state: GameState, rec: NpcRecord, bond: Bond, report?: Report, opts: JoinOptions = {}): Character {
  if (state.party.some((m) => m.id === rec.id)) throw new Error(`${rec.name}已經在隊伍裡了`)
  if (partyRoom(state) < 1) throw new Error(`隊伍最多 ${combatRules.party_max} 人`)
  const known = !!state.relationships?.[rec.id]
  const rel = ensureRelationship(state, rec)
  if (!known) setAffinity(state, rec.id, companionRules.initial_affinity[bond])
  if (rel.toPlayer === '初次見面。') rel.toPlayer = JOIN_TEXT[bond]
  const member = characterFor(state, rec)
  delete member.group
  delete member.contract
  member.status = member.status.filter((s) => s !== 'slave_mark')
  member.bond = bond
  member.affinity = rel.affinity
  if (opts.group) member.group = opts.group
  if (bond === 'slave') {
    const kind = opts.contract ?? 'labor'
    const def = contractDef(kind)
    const pc = pcOf(state)
    member.contract = { kind, master: 'pc', masterName: pc.name, obedience: def.obedience_penalty, since: { ...state.time } }
    member.status.push('slave_mark')
  }
  if (state.npcs?.[rec.id]) delete state.npcs[rec.id]!.character
  state.party.push(member)
  if (namedNpcs.some((n) => n.id === rec.id) && !state.recruited.includes(rec.id)) state.recruited.push(rec.id)
  if (report && !report.party.some((p) => p.id === member.id)) report.party.push(snapshot(member, undefined, pcOf(state)))
  recordChange(report, { npc: rec.id, name: rec.name, change: 'joined', bond, ...(opts.reason ? { reason: opts.reason } : {}) })
  return member
}

/** NPC 離隊：角色資料存回 NPC 登錄，留在目前的地點。 */
export function leaveParty(state: GameState, id: string, report?: Report, reason?: string): Character {
  const i = state.party.findIndex((m) => m.id === id && !m.isPlayer)
  if (i < 0) throw new Error('隊伍中沒有這位角色')
  const member = state.party.splice(i, 1)[0]!
  const rec = npcRecord(state, id) ?? { id, name: member.name, race: member.race, class: member.class, level: member.level, location: state.location, hire_cc: 0, personality: member.personality ?? '' }
  const stored: Character = JSON.parse(JSON.stringify(member)) as Character
  delete stored.bond
  delete stored.group
  registerNpc(state, { ...rec, level: member.level, location: state.location, character: stored })
  recordChange(report, { npc: id, name: member.name, change: 'left', ...(member.bond ? { bond: member.bond } : {}), ...(reason ? { reason } : {}) })
  return member
}

/** 隊長和他帶來的隊員 */
export function leaderGroup(state: GameState): Character[] {
  const leader = leaderOf(state)
  return leader ? state.party.filter((m) => m.id === leader.id || m.group === leader.id) : []
}

/**
 * 在報告裡記一筆親密度變化（提交報告時才寫入）。同一份報告對同一人的多次變化會累加。
 */
export function addAffinity(state: GameState, report: Report, npc: string, delta: number, reason?: string) {
  const rel = state.relationships?.[npc]
  if (!rel || delta === 0) return
  const list = (report.changes.affinity ??= [])
  const prev = [...list].reverse().find((a) => a.npc === npc)
  const base = prev ? prev.after : rel.affinity
  const after = Math.max(-100, Math.min(100, base + Math.round(delta)))
  list.push({ npc, delta: after - base, after, ...(reason ? { reason } : {}) })
}

// ---- 非戰鬥狀態 ----

export function addCondition(c: Character, id: string, report?: Report) {
  if (c.status.includes(id)) return
  c.status.push(id)
  if (report) (report.changes.conditions ??= []).push({ actor: c.id, condition: id, added: true })
}

export function removeCondition(c: Character, id: string, report?: Report) {
  if (!c.status.includes(id)) return
  c.status = c.status.filter((s) => s !== id)
  if (report) (report.changes.conditions ??= []).push({ actor: c.id, condition: id, added: false })
}

/** 非戰鬥狀態造成的檢定懲罰（受罰等） */
export function conditionPenalty(c: Character): number {
  return c.status.reduce((sum, s) => sum + (companionRules.conditions[s]?.check_penalty ?? 0), 0)
}

// ---- 主角成為奴隸、獲釋、逃亡 ----

/**
 * 主角成為奴隸：原本的同伴與主角分開（離隊），主人與他的隊員入隊。
 * 主角頸上刻下契約印記。
 */
export function enslavePlayer(state: GameState, master: NpcRecord, contractKind: string, report?: Report, members: NpcRecord[] = []) {
  const pc = pcOf(state)
  if (pc.contract) throw new Error('主角已經是奴隸了')
  const def = contractDef(contractKind)
  for (const m of [...state.party]) if (!m.isPlayer) leaveParty(state, m.id, report, '與主角分開')
  delete state.pendingLeave
  state.partyOffers = []
  joinParty(state, master, 'leader', report, { group: master.id })
  for (const m of members) if (partyRoom(state) > 0) joinParty(state, m, 'ally', report, { group: master.id })
  pc.contract = { kind: contractKind, master: master.id, masterName: master.name, obedience: def.obedience_penalty, since: { ...state.time } }
  addCondition(pc, 'slave_mark', report)
  recordChange(report, { npc: 'pc', name: pc.name, change: 'enslaved', reason: `${def.name}，主人：${master.name}` })
}

/** 解除主角的契約（談判成功、事件獎勵）。主人仍在隊伍中，關係變成普通的隊長與隊員。 */
export function freePlayer(state: GameState, report?: Report, reason?: string) {
  const pc = pcOf(state)
  if (!pc.contract) return
  delete pc.contract
  removeCondition(pc, 'slave_mark', report)
  removeCondition(pc, 'fugitive', report)
  recordChange(report, { npc: 'pc', name: pc.name, change: 'freed', ...(reason ? { reason } : {}) })
}

/** 解除 NPC 奴隸的契約：變成自願同行的同伴，親密度上升。 */
export function freeSlave(state: GameState, id: string, report: Report) {
  const m = state.party.find((x) => x.id === id && x.bond === 'slave')
  if (!m) throw new Error('隊伍中沒有這位奴隸')
  delete m.contract
  m.bond = 'voluntary'
  removeCondition(m, 'slave_mark', report)
  addAffinity(state, report, id, slaveryRules.release_affinity, '解除契約')
  recordChange(report, { npc: id, name: m.name, change: 'freed', bond: 'voluntary' })
}

/** 主角逃離主人：主人與他的隊員離隊，主角成為逃亡奴隸，契約仍在。 */
export function playerEscapes(state: GameState, report?: Report) {
  const pc = pcOf(state)
  if (!pc.contract) throw new Error('主角不是奴隸')
  for (const m of leaderGroup(state)) leaveParty(state, m.id, report, '主角逃走了')
  addCondition(pc, 'fugitive', report)
  recordChange(report, { npc: 'pc', name: pc.name, change: 'escaped', reason: `逃離${pc.contract.masterName}` })
}

/** 逃亡奴隸被主人找到：主人回到隊伍（隊伍滿了就讓最後入隊的同伴離開）。 */
export function recapturePlayer(state: GameState, report?: Report) {
  const pc = pcOf(state)
  const contract = pc.contract
  if (!contract) return
  const master = npcRecord(state, contract.master)
  removeCondition(pc, 'fugitive', report)
  if (!master) return
  while (partyRoom(state) < 1) {
    const last = [...state.party].reverse().find((m) => !m.isPlayer)
    if (!last) break
    leaveParty(state, last.id, report, '主角被抓回去，被迫分開')
  }
  joinParty(state, master, 'leader', report, { group: master.id })
  recordChange(report, { npc: 'pc', name: pc.name, change: 'recaptured', reason: `被${master.name}找到` })
}

/** 懲罰：扣生命值、親密度，重罰時服從懲罰加重。 */
export function punish(state: GameState, severity: 'light' | 'heavy', report: Report): string {
  const pc = pcOf(state)
  const p = slaveryRules.freedom.punishment[severity]
  const loss = Math.max(1, Math.ceil(pc.maxHp * p.hp_ratio))
  setHp(state, pc, pc.hp - loss, report)
  addCondition(pc, 'punished', report)
  const contract = pc.contract
  if (contract) {
    if (state.relationships?.[contract.master]) addAffinity(state, report, contract.master, p.affinity, '受罰')
    if (p.obedience) contract.obedience = Math.min(slaveryRules.freedom.obedience_max, contract.obedience + p.obedience)
  }
  return `受到${severity === 'heavy' ? '嚴厲的' : ''}懲罰，失去 ${loss} 點生命值${p.obedience ? '，契約的束縛更緊了' : ''}。`
}

/** 改變生命值（不會因此倒下，至少留 1 點），同步報告快照 */
export function setHp(state: GameState, c: Character, hp: number, report?: Report) {
  const before = c.hp
  c.hp = Math.max(1, Math.min(c.maxHp, Math.round(hp)))
  if (!report) return
  const snap = report.party.find((p) => p.id === c.id)
  if (snap) snap.hp = [snap.hp?.[0] ?? before, c.hp, c.maxHp]
}

export function contractOf(c: Character): (ContractRef & { def: ReturnType<typeof contractDef> }) | undefined {
  return c.contract ? { ...c.contract, def: contractDef(c.contract.kind) } : undefined
}
