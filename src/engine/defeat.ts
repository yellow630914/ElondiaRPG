// 成人向的戰敗事件（data/rules/combat.json 的 defeat_event）。
//
// 1. 戰敗而且沒有人搬來救兵時，還站著的敵人裡有符合條件的（NPC 有惡人等標籤、怪物擲到發情等特徵），
//    主角做一次魅力檢定（敵人有沒有起意），成功就觸發：戰報的敘事停在對方準備動手的前一刻（narration.mode = defeat_cliffhanger）。
// 2. 玩家從三個選項選一個，或自己描述反應（主動行動 defeat_event，AI 判定時用另一套敘事規則寫出後續）。
// 3. 結果依成功程度：可能再損失一些錢、驚魂未定、五項指標的加減，敵人的類型另外加上結果（docs/LEWD_STATS.md 第 18 節）；
//    之後和一般戰敗一樣（地下城回到入口、近郊回到城門）。這場戰鬥我方高潮得越多，敵人越容易起意。
// 內容篩選關掉「主角非自願」或戰敗事件的設定關閉時不會發生；已經在等待回應時關閉，可以直接略過。

import { attrOf, mod } from './character'
import { adultScene, defeatAdultAllowed } from './content'
import { characterBody } from './look'
import { combatRules, locationById, regionById, type AttrId, type Degree, type DefeatVillain } from './data'
import { applyEffects, type RewardEffect } from './effects'
import { addLewdStat } from './lewd'
import { afterDefeat } from './grid'
import { formatMoney } from './money'
import { characterFor, npcRecord } from './npcs'
import { addCondition, pcOf } from './party'
import { roll, withBonus, type Rng } from './rng'
import type { GameState, LewdStat, Report, TimelineEntry } from './types'

type Foe = { name: string; npcId?: string; traits?: string[]; hp: number; fled?: boolean; side: string }

function rules() {
  return combatRules.defeat_event
}

/** 會起意的敵人：還站著，NPC 有指定的標籤，或怪物擲到指定的特徵（年幼的不算） */
export function defeatEventFoes(state: GameState, foes: Foe[]): Foe[] {
  const r = rules()
  return foes.filter((f) => {
    if (f.side !== 'enemy' || f.hp <= 0 || f.fled) return false
    if (f.npcId) return (npcRecord(state, f.npcId)?.tags ?? []).some((t) => r.npc_tags.includes(t))
    const traits = f.traits ?? []
    return !traits.some((t) => r.exclude_traits.includes(t)) && traits.some((t) => r.monster_traits.includes(t))
  })
}

/** 起意的 NPC 的類型：依標籤或職業，都不符合時是 default 的那一種；只有怪物時沒有 */
export function villainOf(state: GameState, foes: { npcId?: string }[]): string | undefined {
  const rec = foes.map((f) => (f.npcId ? npcRecord(state, f.npcId) : undefined)).find((r) => !!r)
  if (!rec) return undefined
  const all = Object.entries(rules().villains).filter(([k]) => !k.startsWith('$')) as [string, DefeatVillain][]
  const cls = rec.character?.class ?? rec.class ?? characterFor(state, rec).class
  return all.find(([, v]) => v.tags?.some((t) => rec.tags?.includes(t)))?.[0]
    ?? all.find(([, v]) => v.classes?.includes(cls))?.[0]
    ?? all.find(([, v]) => v.default)?.[0]
}

/** 這場戰鬥我方高潮了幾次：起意的 DC 降低（最多 climax_max） */
export function climaxDcCut(climaxes: number): number {
  const r = rules()
  return Math.min(r.climax_max, climaxes * r.climax_dc)
}

/**
 * 戰敗時擲一次：觸發時記下等待回應的事件，戰報的敘事改成停在動手前，並在時間軸加上這次檢定。
 * 呼叫端負責判斷是戰敗、沒有救兵；回傳是否觸發。
 */
export function rollDefeatEvent(state: GameState, rng: Rng, report: Report, foes: Foe[], climaxes = 0): boolean {
  if (!defeatAdultAllowed(characterBody(pcOf(state)))) return false
  const eligible = defeatEventFoes(state, foes)
  if (!eligible.length) return false
  const r = rules()
  const pc = pcOf(state)
  // 刻意不加熟練加值：這不是主角的技能檢定，而是看外表與氣質能不能引起敵人的興趣
  const dice = withBonus('1d20', mod(attrOf(pc, r.check.attr)))
  const res = roll(rng, dice)
  const dc = r.check.dc - climaxDcCut(climaxes)
  const hit = res.total >= dc
  const entry: TimelineEntry = {
    seq: (report.timeline?.length ?? 0) + 1, time: report.time.end, actor: 'pc',
    // 魅力越高越容易引起敵人的興趣：總值達到 DC 時觸發
    action: hit ? '倒下之後：魅力引起了敵人的興趣' : '倒下之後：敵人沒有起意（魅力）',
    roll: { dice, value: res.total, dc }, result: hit ? 'success' : 'fail',
  }
  report.timeline = [...(report.timeline ?? []), entry]
  if (!hit) return false
  const names = eligible.map((f) => f.name)
  const villain = villainOf(state, eligible)
  state.pendingDefeat = {
    foes: eligible.map((f) => ({ name: f.name, ...(f.npcId ? { npc: f.npcId } : {}) })),
    location: report.location.at, scene: report.location.scene ?? locationById(report.location.at).name, report: report.report_id,
    ...(villain ? { villain } : {}),
  }
  report.narration = {
    ...report.narration, mode: 'defeat_cliffhanger',
    focus: [...(report.narration?.focus ?? []), `${names.join('、')}圍上倒地的主角，準備動手`],
  }
  report.outcome.summary = `${report.outcome.summary ?? ''}${names.join('、')}圍了上來，看向你的眼神不懷好意……`
  report.outcome.tags = [...(report.outcome.tags ?? []), '戰敗事件']
  return true
}

/** 主動行動 defeat_event 的 target：opt:0～2 是三個選項，free 是自己描述 */
export function defeatOption(target?: string): { label: string; attr?: AttrId; dc: number } {
  const r = rules()
  const m = /^opt:(\d)$/.exec(target ?? '')
  const o = m ? r.options[Number(m[1])] : undefined
  return o ?? { label: '自己的反應', dc: r.free_dc }
}

export function setupDefeatEvent(state: GameState, target?: string) {
  const ev = state.pendingDefeat
  if (!ev) throw new Error('現在沒有需要回應的處境')
  const o = defeatOption(target)
  const r = rules()
  const v = ev.villain ? r.villains[ev.villain] : undefined
  const ratio = (d: Degree) => (r.money_loss[d] ?? 0) + (v?.money?.[d] ?? 0)
  const loss = (d: Degree) => (ratio(d) ? `，再損失 ${Math.round(ratio(d) * 100)}% 的錢` : '')
  const shaken = (d: Degree) => (r.shaken_on.includes(d) ? '，驚魂未定（下次長休前檢定 -1）' : '')
  return {
    // 沒能脫身時是這段遭遇（部分成功時由 AI 決定代價是否包含）
    ...adultScene(`戰敗後落入${ev.foes.map((f) => f.name).join('、')}手中`, ['fail', 'fumble']),
    dc: o.dc, ...(o.attr ? { attr: o.attr } : {}), situational: [],
    targetName: ev.foes.map((f) => f.name).join('、'),
    scene: `${ev.scene}・戰敗後被${ev.foes.map((f) => f.name).join('、')}圍住（${o.label}）${v ? `；對方是${v.name}的人：${v.hint}` : ''}`,
    outcomes: Object.fromEntries((['critical', 'success', 'partial', 'fail', 'fumble'] as Degree[]).map((d) => [d, {
      critical: '找到破綻全身而退', success: '設法脫身', partial: '勉強脫身', fail: '沒能擺脫', fumble: '吃了大虧',
    }[d] + loss(d) + shaken(d)])) as Partial<Record<Degree, string>>,
  }
}

/** 結算回應：依成功程度損失金錢、驚魂未定，然後和一般戰敗一樣離開 */
export function applyDefeatResponse(state: GameState, report: Report, degree: Degree): string {
  const ev = state.pendingDefeat
  if (!ev) return ''
  const r = rules()
  const pc = pcOf(state)
  const v = ev.villain ? r.villains[ev.villain] : undefined
  const lost = Math.floor(state.money_cc * ((r.money_loss[degree] ?? 0) + (v?.money?.[degree] ?? 0)))
  if (lost > 0) applyEffects(state, report, [{ type: 'money', amount: -lost }])
  if (r.shaken_on.includes(degree)) addCondition(pc, 'shaken', report)
  // 五項指標（成人向）與敵人的類型另外的結果
  for (const [k, d] of Object.entries(r.lewd[degree] ?? {})) if (d) addLewdStat(pc, k as LewdStat, d, report)
  const extra = (v?.effects?.[degree] ?? []) as RewardEffect[]
  if (extra.length) applyEffects(state, report, extra)
  report.kind = 'event'
  report.narration = { ...report.narration, mode: 'defeat_event', length: 'medium' }
  report.lore_keys = [...new Set([...(report.lore_keys ?? []), ...ev.foes.map((f) => f.name), regionById(locationById(ev.location).region).name])]
  delete state.pendingDefeat
  afterDefeat(state)
  return lost > 0 ? `被搜走了 ${formatMoney(lost)}。` : ''
}

/** 戰敗事件不再允許時（內容篩選、戰敗事件的設定），等待中的事件直接略過（和一般戰敗一樣離開） */
export function skipDefeatEvent(state: GameState) {
  if (!state.pendingDefeat) return
  delete state.pendingDefeat
  afterDefeat(state)
}
