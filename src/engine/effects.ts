// 報酬／後果模板：事件、委託與主動行動的結果都用同一組效果描述，可以任意組合。
//
// 例：委託報酬「80 白鸛＋傷藥 2 瓶＋委託人好感 +5＋獵戶自願入隊」
//   [{ type: 'money', amount: 80 }, { type: 'item', name: '傷藥', qty: 2 },
//    { type: 'affinity', npc: 'gen_3', delta: 5 }, { type: 'companion', npc: 'gen_3', mode: 'voluntary' }]
//
// applyEffects 在報告提交前呼叫：金錢、物品、親密度、聲望、經驗、旗標寫進 report.changes，由 commitReport 套用；
// 入隊、離隊、狀態、生命值等直接修改狀態，並記錄在 report.changes。數值上限由呼叫端（例如主動行動）負責夾住。

import { abilityChoices, abilityQuality, learnable, learnAbility } from './character'
import { formatMoney } from './money'
import { npcRecord, generateNpc, type NpcSpec } from './npcs'
import { changeHitDice, changeSlots } from './resources'
import {
  addAffinity, addCondition, changeMaster, enslavePlayer, freePlayer, freeSlave, joinParty, leaveParty, partyRoom, pcOf, removeCondition, setHp,
} from './party'
import { addMemory, addSuggestions, ensureRelationship } from './social'
import { withRng } from './state'
import type { GameState, NpcRecord, Report } from './types'

export type NpcRef = string | NpcSpec

export type RewardEffect =
  | { type: 'money'; amount: number }
  | { type: 'item'; name: string; qty: number; quality?: string }
  | { type: 'affinity'; npc: string; delta: number; reason?: string }
  | { type: 'reputation'; faction: string; delta: number }
  | { type: 'xp'; amount: number; target?: string }
  | { type: 'flag'; key: string; value: unknown }
  /** 新增夥伴：自願、雇傭或以奴隸身分入隊 */
  | { type: 'companion'; npc: NpcRef; mode: 'voluntary' | 'hired' | 'slave'; contract?: string }
  /** 主角加入別人的隊伍（被動邀請），對方可能付錢 */
  | { type: 'join_party'; leader: NpcRef; members?: NpcRef[]; pay_cc?: number }
  | { type: 'leave'; npc: string; reason?: string }
  /** 人際關係文字：預設是提議（玩家確認後才寫入） */
  | { type: 'relationship_text'; npc: string; text: string; apply?: boolean }
  | { type: 'memory'; summary: string; importance?: 1 | 2 | 3 }
  | { type: 'condition'; target: string; condition: string; add: boolean }
  /** 生命值：amount 為加減的點數，ratio 為最大生命值的比例（不會因此倒下，至少留 1 點） */
  | { type: 'hp'; target: string; amount?: number; ratio?: number }
  /** 法術環：delta < 0 花掉（至少 circle 環），> 0 回復（不超過 circle 環） */
  | { type: 'slot'; target: string; delta: number; circle?: number }
  /** 生命骰：delta < 0 花掉，> 0 回復 */
  | { type: 'hit_dice'; target: string; delta: number }
  | { type: 'enslave_player'; master: NpcRef; contract: string; members?: NpcRef[] }
  /** 刻印時提議的印記名稱與描述（只是文字，數值依模板） */
  | { type: 'mark'; name?: string; text?: string }
  /** 解除契約：npc 為 pc 時是主角獲釋 */
  | { type: 'free'; npc: string }
  /** 替換主角的主人（印記沿用）；master 為 null 時變成無主 */
  | { type: 'change_master'; master: NpcRef | null; reason?: string }
  /** 委託報酬按百分比調整（談判的結果） */
  | { type: 'quest_reward'; quest: string; percent: number }
  /** 任務旗標，例如 lead（委託檢定 +5）、suspicious（-2） */
  | { type: 'quest_flag'; quest: string; key: string; value: unknown }
  /**
   * 技能報酬：學會新能力。ability 指定能力（id 或名稱，必須是目前可以學的）；沒指定或不能學時隨機挑一項。
   * choices 有值時改成給一次「N 選一」的學習機會（和升級一樣在隊伍視窗選）。chance 為取得的機率。
   */
  | { type: 'ability'; target?: string; ability?: string; choices?: number; chance?: number }
  /** 認識新的人（例如同旅館的旅客）：登錄 NPC、建立人際關係，平常待在 spot */
  | { type: 'meet'; npc: NpcSpec; affinity?: number; to_player?: string; spot?: string }

export const EFFECT_TYPES: RewardEffect['type'][] = [
  'money', 'item', 'affinity', 'reputation', 'xp', 'flag', 'companion', 'join_party', 'leave',
  'relationship_text', 'memory', 'condition', 'hp', 'enslave_player', 'free', 'change_master', 'quest_reward', 'quest_flag', 'meet', 'ability', 'slot', 'hit_dice', 'mark',
]

/** NPC 參照：已登場的 id，或是一份規格（生成新角色）。 */
export function resolveNpc(state: GameState, ref: NpcRef, prefix = 'evt'): NpcRecord {
  if (typeof ref === 'string') {
    const rec = npcRecord(state, ref)
    if (!rec) throw new Error(`unknown npc: ${ref}`)
    return rec
  }
  if (ref.id) {
    const rec = npcRecord(state, ref.id)
    if (rec) return rec
  }
  return withRng(state, (rng) => generateNpc(state, rng, ref, prefix))
}

function memberOrPc(state: GameState, id: string) {
  return id === 'pc' ? pcOf(state) : state.party.find((m) => m.id === id)
}

/** 套用效果，回傳每個效果的簡短說明（無法套用的會註明原因）。 */
export function applyEffects(state: GameState, report: Report, effects: RewardEffect[]): string[] {
  const notes: string[] = []
  const c = report.changes
  for (const e of effects) {
    switch (e.type) {
      case 'money':
        if (!e.amount) break
        c.money_cc = (c.money_cc ?? 0) + Math.round(e.amount)
        break
      case 'item':
        if (e.qty > 0) (c.items_gained ??= []).push({ name: e.name, qty: e.qty, ...(e.quality ? { quality: e.quality } : {}), owner: 'pc' })
        else if (e.qty < 0) (c.items_lost ??= []).push({ name: e.name, qty: -e.qty })
        break
      case 'affinity': {
        const rec = npcRecord(state, e.npc)
        if (rec) ensureRelationship(state, rec)
        addAffinity(state, report, e.npc, e.delta, e.reason)
        break
      }
      case 'reputation':
        if (e.delta) (c.reputation ??= []).push({ faction: e.faction, delta: Math.round(e.delta) })
        break
      case 'xp': {
        const targets = e.target ? state.party.filter((m) => m.id === e.target) : state.party
        for (const m of targets) (c.xp ??= []).push({ actor: m.id, amount: Math.round(e.amount) })
        break
      }
      case 'flag':
        ;(c.flags ??= {})[e.key] = e.value
        break
      case 'companion': {
        const rec = resolveNpc(state, e.npc)
        if (partyRoom(state) < 1) {
          ensureRelationship(state, rec)
          notes.push(`${rec.name}想加入，但隊伍已滿`)
          break
        }
        if (e.mode === 'slave' && pcOf(state).contract) {
          notes.push(`身為奴隸，無法擁有奴隸`)
          break
        }
        joinParty(state, rec, e.mode, report, { ...(e.contract ? { contract: e.contract } : {}), reason: '事件' })
        notes.push(`${rec.name}加入了隊伍`)
        break
      }
      case 'join_party': {
        const leader = resolveNpc(state, e.leader)
        const members = (e.members ?? []).map((m) => resolveNpc(state, m))
        if (partyRoom(state) < 1 + members.length) {
          notes.push(`${leader.name}的隊伍沒有空位`)
          break
        }
        joinParty(state, leader, 'leader', report, { group: leader.id })
        for (const m of members) joinParty(state, m, 'ally', report, { group: leader.id })
        if (e.pay_cc) c.money_cc = (c.money_cc ?? 0) + Math.round(e.pay_cc)
        notes.push(`加入了${leader.name}的隊伍`)
        break
      }
      case 'leave':
        if (state.party.some((m) => m.id === e.npc && !m.isPlayer)) leaveParty(state, e.npc, report, e.reason)
        break
      case 'relationship_text':
        if (!state.relationships?.[e.npc]) break
        if (e.apply) state.relationships[e.npc]!.toPlayer = e.text
        else addSuggestions(state, [{ id: e.npc, to_player: e.text }], report.report_id)
        break
      case 'memory':
        addMemory(state, {
          time: { ...report.time.start }, location: report.location.at,
          participants: report.party.map((p) => p.id), summary: e.summary, importance: e.importance ?? 2,
        })
        break
      case 'condition': {
        const who = memberOrPc(state, e.target)
        if (!who) break
        if (e.add) addCondition(who, e.condition, report)
        else removeCondition(who, e.condition, report)
        break
      }
      case 'hp': {
        const who = memberOrPc(state, e.target)
        if (!who) break
        const delta = e.amount ?? Math.round((e.ratio ?? 0) * who.maxHp)
        setHp(state, who, who.hp + delta, report)
        break
      }
      case 'slot': {
        const who = memberOrPc(state, e.target)
        if (!who || !e.delta) break
        const n = changeSlots(who, e.delta, e.circle, report)
        if (n) notes.push(`${who.name}${e.delta < 0 ? '用掉' : '回復'} ${n} 個法術環`)
        break
      }
      case 'hit_dice': {
        const who = memberOrPc(state, e.target)
        if (!who || !e.delta) break
        const n = changeHitDice(who, e.delta, report)
        if (n) notes.push(`${who.name}${n > 0 ? '回復' : '用掉'} ${Math.abs(n)} 顆生命骰`)
        break
      }
      case 'enslave_player': {
        const master = resolveNpc(state, e.master)
        const members = (e.members ?? []).map((m) => resolveNpc(state, m))
        enslavePlayer(state, master, e.contract, report, members)
        // 刻印前還有一次檢定：主角的表現決定最後刻上哪一種印記
        state.pendingMark = { intended: e.contract }
        break
      }
      case 'mark': {
        if (state.pendingMark) state.pendingMark.suggestion = { ...(e.name ? { name: e.name } : {}), ...(e.text ? { mark: e.text } : {}) }
        break
      }
      case 'change_master': {
        const master = e.master === null ? null : resolveNpc(state, e.master)
        changeMaster(state, master, report, e.reason)
        notes.push(master ? `${master.name}成為主角的新主人` : '主角變成無主的奴隸')
        break
      }
      case 'free':
        if (e.npc === 'pc') freePlayer(state, report)
        else freeSlave(state, e.npc, report)
        break
      case 'quest_reward': {
        const q = state.quests.find((x) => x.id === e.quest)
        if (!q) break
        const before = q.reward_cc
        q.reward_cc = Math.max(0, Math.round(q.reward_cc * (1 + e.percent / 100)))
        notes.push(`「${q.title}」的報酬從 ${formatMoney(before)} 調整為 ${formatMoney(q.reward_cc)}`)
        break
      }
      case 'ability': {
        const who = memberOrPc(state, e.target ?? 'pc')
        if (!who) break
        if (e.chance !== undefined && e.chance < 1 && !withRng(state, (rng) => rng.chance(e.chance!))) break
        if (e.choices) {
          const choices = withRng(state, (rng) => abilityChoices(who, rng, Math.max(1, Math.min(5, e.choices!))))
          if (!choices.length) {
            notes.push(`${who.name}沒有可以學的新能力`)
            break
          }
          who.pendingAbilityChoices = [...(who.pendingAbilityChoices ?? []), choices]
          notes.push(`${who.name}得到一次學習新能力的機會（${choices.length} 選一）`)
          break
        }
        const pool = learnable(who)
        const wanted = e.ability?.trim()
        let def = wanted ? pool.find((a) => a.id === wanted || a.name === wanted) : undefined
        if (!def && pool.length) def = withRng(state, (rng) => rng.pick(pool))
        if (!def) {
          notes.push(`${who.name}沒有可以學的新能力`)
          break
        }
        learnAbility(who, def.id)
        ;(report.changes.skills_gained ??= []).push({ actor: who.id, skill: def.name, quality: abilityQuality(def), source: 'insight' })
        notes.push(`${who.name}領悟了【${def.name}】`)
        break
      }
      case 'meet': {
        const rec = resolveNpc(state, e.npc, 'met')
        if (e.spot) rec.spot = e.spot
        const rel = ensureRelationship(state, rec)
        if (e.to_player) rel.toPlayer = e.to_player
        if (e.affinity) addAffinity(state, report, rec.id, e.affinity, '初次相識')
        ;(report.others ??= []).push({ id: rec.id, name: rec.name, race: rec.race, class: rec.class, level: rec.level, personality: rec.personality })
        notes.push(`認識了${rec.name}`)
        break
      }
      case 'quest_flag': {
        const q = state.quests.find((x) => x.id === e.quest)
        if (q) (q.flags ??= {})[e.key] = e.value
        break
      }
    }
  }
  return notes
}
