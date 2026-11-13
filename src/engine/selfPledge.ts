// 主動認主（docs/COMPANIONS.md 2.3.2 節；data/rules/slavery.json 的 voluntary.self_bonds）：自願為奴（voluntarySlave.ts）的反向。
// 自由身的主角在刻印師那裡，請信任自己的人收下自己：同伴（自願同行、雇傭、帶著主角的隊長）或身邊認識的人。
// 親密度夠就答應（不擲骰）；主角選要刻的印記與兩人說好的主僕關係，刻印費主角付。
// 刻好之後走換主人的流程（party.ts 的 changeMaster）：對方以主人（隊長）身分帶著主角，主角原本的同伴照舊同行。

import { BOND_STYLES, slaveryRules, type BondStyle } from './data'
import { bondName } from './bondStyle'
import { formatMoney } from './money'
import { npcRecord } from './npcs'
import { ownedSlaves } from './ownedSlaves'
import { addCondition, changeMaster, isEnslaved, leaderOf, pcOf } from './party'
import { isHostile, nearbyPeople } from './population'
import { contractTerms, makeContract, type MarkChoice } from './slavery'
import { commitReport } from './state'
import { contractOf, setContract } from './tattoos'
import { baseReport } from './town'
import type { GameState, NpcRecord, Report } from './types'
import { atVolunteerPlace } from './voluntarySlave'

const rules = () => slaveryRules.voluntary

export interface PledgeCandidate {
  id: string
  name: string
  /** 同伴的入隊方式（不是同伴時沒有） */
  bond?: string
  affinity: number
}

const affinityOf = (state: GameState, id: string) => state.relationships?.[id]?.affinity ?? 0

/** 可以問的人：同伴（self_bonds）與身邊認識、不敵對、不是奴隸的人 */
export function pledgeCandidates(state: GameState): PledgeCandidate[] {
  const out: PledgeCandidate[] = state.party
    .filter((m) => !m.isPlayer && rules().self_bonds.includes(m.bond ?? 'hired') && !m.status.includes('away'))
    .map((m) => ({ id: m.id, name: m.name, bond: m.bond, affinity: affinityOf(state, m.id) }))
  for (const p of nearbyPeople(state)) {
    const rec = p.rec
    if (out.some((x) => x.id === rec.id) || !state.relationships?.[rec.id]) continue
    if (rec.dead || rec.tags?.includes('slave') || isHostile(state, rec) || state.captives?.npcs.includes(rec.id)) continue
    out.push({ id: rec.id, name: rec.name, affinity: affinityOf(state, rec.id) })
  }
  return out
}

/** 整體上不能主動認主的原因（和問誰無關；可以時是 undefined） */
export function pledgeBlockedAll(state: GameState): string | undefined {
  if (isEnslaved(state)) return '你身上已經有奴隸印記（無主時可以用「投靠新主人」）'
  if (!atVolunteerPlace(state)) return '要在刻印師那裡才能刻奴隸印記'
  if (state.combat || state.pendingAction || state.pendingMark) return '現在不能這麼做'
  const slaves = ownedSlaves(state)
  if (slaves.length) return `你還擁有奴隸（${slaves.map((x) => x.member.name).join('、')}），奴隸不能擁有奴隸：先解除他們的契約或把他們賣掉`
  if (state.money_cc < rules().fee_cc) return `刻印費 ${formatMoney(rules().fee_cc)}，金錢不足`
  return undefined
}

/** 不能請這個人收下自己的原因（可以時是 undefined） */
export function pledgeBlocked(state: GameState, id: string): string | undefined {
  const all = pledgeBlockedAll(state)
  if (all) return all
  const who = pledgeCandidates(state).find((x) => x.id === id)
  if (!who) return '對方不在身邊'
  // 跟著別人的隊伍時，只能請隊長收下自己（換成別人當主人，原本的隊伍怎麼辦說不通）
  const leader = leaderOf(state)
  if (leader && leader.id !== id) return `你正跟著${leader.name}的隊伍，只能請${leader.name}收下你，或先離開這支隊伍`
  const need = rules().min_affinity
  if (who.affinity < need) return `${who.name}還不夠信任你（親密度 ${need} 以上才會答應，現在 ${who.affinity}）`
  return undefined
}

/** 對方答應了：刻上主角選的印記，對方成為主人（隊長），並說好主僕關係 */
export function pledgeSelf(state: GameState, id: string, mark: MarkChoice, style: BondStyle = 'strict'): Report {
  const why = pledgeBlocked(state, id)
  if (why) throw new Error(why)
  if (!BOND_STYLES.includes(style)) throw new Error('沒有這種主僕關係')
  const rec: NpcRecord | undefined = npcRecord(state, id)
  if (!rec) throw new Error('找不到這個人')
  const pc = pcOf(state)
  const before = state.party.find((m) => m.id === id)?.bond
  const report = baseReport(state, 'action', rules().hours)
  // 先刻上印記（無主），再交給對方：換主人的流程會處理隊伍（對方在隊上時先離隊、再以隊長回來）與主人的家
  const contract = makeContract(mark, '', '', state.time)
  setContract(pc, contract, state.time)
  addCondition(pc, 'slave_mark', report)
  changeMaster(state, rec, report, '自願為奴')
  const made = contractOf(pc)!
  if (style !== 'strict') made.style = style
  // 換主人記成「無主 → 對方」：這裡是從自由身成為奴隸，改記一筆成為奴隸
  const terms = contractTerms(made)
  report.changes.companions = [
    ...(report.changes.companions ?? []).filter((x) => !(x.npc === 'pc' && x.change === 'transferred')),
    { npc: 'pc', name: pc.name, change: 'enslaved', reason: `${terms.name}，主人：${rec.name}（自願為奴）` },
  ]
  // 原本對主角的看法留著，接上這件事
  const rel = state.relationships?.[rec.id]
  if (rel) rel.toPlayer = `主角的主人：主角自願成為他的奴隸，身上刻著「${terms.name}」（${bondName(style)}）。`
  report.changes.money_cc = (report.changes.money_cc ?? 0) - rules().fee_cc
  const was = before === 'leader' ? '原本就帶著你的隊長' : before === 'hired' ? '原本是雇傭的同伴' : before ? '原本是自願同行的夥伴' : '身邊認識的人'
  report.outcome = {
    result: 'success',
    summary: `你請${rec.name}收下自己，${rec.name}答應了。刻印師在你身上刻下「${terms.name}」（${was}；刻印費 ${formatMoney(rules().fee_cc)}）。從現在起${rec.name}是你的主人，兩人說好的關係：${bondName(style)}。`,
    tags: ['主動認主', '成為奴隸'],
  }
  const def = slaveryRules.bond_styles.styles[style]
  report.narration = {
    pov: 'second_person', length: 'medium',
    focus: [
      `主角在刻印師那裡請${rec.name}收下自己、成為自己的主人；${rec.name}信任主角，答應了`,
      `刻印師把「${terms.name}」刻在主角身上：${terms.mark}`,
      style === 'strict' ? '兩人說好就是名實相符的主人與奴隸' : `兩人事先說好，名義上是主奴，實際的關係是「${def.name}」：${def.prompt}`,
      slaveryRules.bond_styles.personality_rule,
    ],
  }
  return commitReport(state, report)
}
