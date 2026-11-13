// 主僕關係（docs/COMPANIONS.md 2.8 節；data/rules/slavery.json 的 bond_styles）：
// 名義上是主人與奴隸，實際上兩人怎麼相處——名實相符（預設）、名義主僕實為夥伴、情趣主奴、激烈主奴、戀人。
// 主人與奴隸的親密度到 unlock_affinity 時可以選（主角是奴隸：和主人；主角是主人：和自己的奴隸），
// 掉到 keep_affinity 以下時退回名實相符，回到 keep_affinity 以上恢復。
// 只影響敘事與事件：交給 AI 的人際關係多一行（附上「關係不改變性格」），主奴事件與調教事件依關係調整權重、多了專屬事件。
// 契約上的數值（出門、出城、懲罰、收益）一律不變。

import { BOND_STYLES, slaveryRules, type BondStyle, type MasterEventDef } from './data'
import { pcOf } from './party'
import { commitReport } from './state'
import { contractOf } from './tattoos'
import { baseReport } from './town'
import type { Character, ContractRef, GameState, Report } from './types'

const rules = () => slaveryRules.bond_styles

export function bondName(style: BondStyle): string {
  return rules().styles[style]?.name ?? style
}

/** 主角和這個人之間的契約：主角是奴隸時是主角的契約（對方是主人），主角是主人時是那位奴隸的契約 */
interface BondPair {
  contract: ContractRef
  /** 主人那一方的 id（主角是主人時是 pc） */
  master: string
  /** 奴隸那一方的 id */
  slave: string
  /** 不是主角的那一方（親密度看他） */
  other: string
  pcIsSlave: boolean
}

function slaveCharacter(state: GameState, id: string): Character | undefined {
  return state.party.find((m) => m.id === id) ?? state.npcs?.[id]?.character
}

function pairWith(state: GameState, npcId: string): BondPair | undefined {
  const pc = pcOf(state)
  const mine = contractOf(pc)
  if (mine?.master && mine.master === npcId) return { contract: mine, master: npcId, slave: pc.id, other: npcId, pcIsSlave: true }
  const slave = slaveCharacter(state, npcId)
  const c = slave && !slave.isPlayer ? contractOf(slave) : undefined
  if (c && c.master === pc.id) return { contract: c, master: pc.id, slave: npcId, other: npcId, pcIsSlave: false }
  return undefined
}

const affinityOf = (state: GameState, id: string) => state.relationships?.[id]?.affinity ?? 0

/** 現在生效的主僕關係：選過、而且親密度還在 keep_affinity 以上；否則名實相符 */
export function bondOf(state: GameState, npcId: string): BondStyle {
  const p = pairWith(state, npcId)
  const style = p?.contract.style
  if (!p || !style || !rules().styles[style]) return 'strict'
  return affinityOf(state, p.other) >= rules().keep_affinity ? style : 'strict'
}

/** 主角是奴隸時，和主人之間的關係 */
export function pcBond(state: GameState): BondStyle {
  const master = contractOf(pcOf(state))?.master
  return master ? bondOf(state, master) : 'strict'
}

export interface BondStatus {
  /** 選過的關係（可能因為親密度不夠暫時失效） */
  chosen: BondStyle
  /** 現在生效的 */
  active: BondStyle
  affinity: number
  unlock: number
  keep: number
  /** 不能改的原因 */
  blocked?: string
}

/** 主僕關係的狀態（契約視窗、我的奴隸）：沒有主僕關係時是 undefined */
export function bondStatus(state: GameState, npcId: string): BondStatus | undefined {
  const p = pairWith(state, npcId)
  if (!p) return undefined
  const r = rules()
  const affinity = affinityOf(state, p.other)
  const near = state.party.some((m) => m.id === npcId)
  const blocked = !near ? (p.pcIsSlave ? '主人不在身邊' : '帶回隊伍才能談這件事')
    : state.combat || state.pendingAction || state.pendingMasterEvent || state.pendingMark ? '現在不能這麼做'
      : undefined
  return { chosen: p.contract.style ?? 'strict', active: bondOf(state, npcId), affinity, unlock: r.unlock_affinity, keep: r.keep_affinity, ...(blocked ? { blocked } : {}) }
}

/** 選這種關係不行的原因（可以時是 undefined） */
export function bondChoiceBlocked(state: GameState, npcId: string, style: BondStyle): string | undefined {
  const st = bondStatus(state, npcId)
  if (!st) return '你們之間沒有主僕契約'
  if (!BOND_STYLES.includes(style) || !rules().styles[style]) return '沒有這種關係'
  if (st.blocked) return st.blocked
  if (style === st.chosen) return '現在就是這樣'
  if (style !== 'strict' && st.affinity < st.unlock) return `親密度 ${st.unlock} 以上才能談（現在 ${st.affinity}）`
  return undefined
}

/** 兩人說開了：改成這種關係（不擲骰；敘事寫兩人怎麼說開的） */
export function setBond(state: GameState, npcId: string, style: BondStyle): Report {
  const why = bondChoiceBlocked(state, npcId, style)
  if (why) throw new Error(why)
  const p = pairWith(state, npcId)!
  const before = p.contract.style ?? 'strict'
  if (style === 'strict') delete p.contract.style
  else p.contract.style = style
  const other = state.party.find((m) => m.id === npcId)!
  const def = rules().styles[style]
  const report = baseReport(state, 'action', rules().hours)
  const who = p.pcIsSlave ? `主角和主人${other.name}` : `主角和自己的奴隸${other.name}`
  report.outcome.summary = style === 'strict'
    ? `你和${other.name}之間回到了名實相符的主僕。`
    : `你和${other.name}說開了：從今以後，你們是「${def.name}」。`
  report.narration = {
    pov: 'second_person', length: 'short',
    focus: [
      style === 'strict'
        ? `${who}把關係收回到名實相符的主僕（原本是「${bondName(before)}」）：契約照舊，主人就是主人`
        : `${who}說開了兩人之間真正的關係：「${def.name}」（原本是「${bondName(before)}」）。${def.prompt}`,
      '寫兩人是怎麼說開、怎麼確認彼此心意的一小段；契約與印記不變',
      rules().personality_rule,
    ],
  }
  return commitReport(state, report)
}

/** 交給 AI 的一行（人際關係裡那個人底下）：名實相符時不寫 */
export function bondPromptLine(state: GameState, npcId: string): string {
  const style = bondOf(state, npcId)
  if (style === 'strict') return ''
  const p = pairWith(state, npcId)!
  const def = rules().styles[style]
  const role = p.pcIsSlave ? '對方是主角的主人' : '對方是主角的奴隸'
  return `主僕關係：${def.name}（${role}）——${def.prompt}`
}

/** 人際關係的最後附上的提醒（有任何一段不是名實相符的主僕關係時） */
export function bondPersonalityRule(): string {
  return `主僕關係的提醒：${rules().personality_rule}`
}

/** 敘事的焦點：這件事發生在什麼樣的主僕關係裡（名實相符時沒有） */
export function bondFocus(state: GameState, npcId: string): string | undefined {
  const style = bondOf(state, npcId)
  if (style === 'strict') return undefined
  // 只指向人際關係裡的那一行（中性的引導，不給具體的例子）
  return `兩人的主僕關係是「${bondName(style)}」：照人際關係裡這段關係的基調寫這件事，人物的言行仍以各自的性格為準`
}

/** 這件事在這種關係下的權重（只在某些關係發生的，其他關係是 0） */
export function bondWeight(e: MasterEventDef, style: BondStyle, base = e.weight): number {
  if (e.bonds?.length && !e.bonds.includes(style)) return 0
  return base * (e.bond_weights?.[style] ?? 1)
}
