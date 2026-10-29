// 工作：站在旅店、酒館、神殿、雜貨店、鐵匠鋪等商店、公會、娼館等設施上，花時間換錢（data/rules/work.json）。
// 走主動行動 work：玩家可以描述怎麼做，AI 依此判定並寫進日誌；報酬依成功程度。
// 被主人帶著時，收入依印記歸主人（state.ts 的收益歸屬）。
// 也可以派自己的奴隸去做：由奴隸擲檢定，工錢歸主角（target 是「時數:奴隸 id」）。

import { adultScene } from './content'
import { lewdRules, locationById, workRules, type Degree, type JobDef } from './data'
import { afterBrothelWork, consentedToday, needsConsent, rankWage } from './brothelLife'
import { applyEffects } from './effects'
import { currentArea, currentCell } from './grid'
import { formatMoney } from './money'
import { npcRecord } from './npcs'
import { addAffinity, isFugitive } from './party'
import type { Character } from './types'
import type { GameState, Report } from './types'
import { shopPlace } from './trade'
import { contractOf } from './tattoos'
import { closedHere } from './landmarks'
import { growLewd } from './lewd'

/** 現在站的設施有沒有工作可做 */
export function jobHere(state: GameState): (JobDef & { cell: string }) | undefined {
  // 不開放的地標沒有工作
  if (closedHere(state)) return undefined
  const cell = currentCell(state).kind
  const job = workRules.jobs[cell]
  return job ? { ...job, cell } : undefined
}

/**
 * 可以派去工作的人：主角自己的奴隸（工錢歸主角），以及自由的夥伴（工錢分一半給主角）。
 * 娼館：自由的夥伴要先答應（brothelLife.ts 的 proposeWork），當天有效。無法戰鬥的人、暫時離隊的不算
 */
export function workers(state: GameState, cell = currentCell(state).kind): Character[] {
  const pc = state.party.find((m) => m.isPlayer)
  return state.party.filter((m) => !m.isPlayer && !m.status.includes('away')
    && (m.bond === 'slave' ? contractOf(m)?.master === pc?.id
      : (m.bond === 'voluntary' || m.bond === 'hired') && (cell !== 'brothel' || consentedToday(state, m.id))))
}

/** 自由的夥伴（不是主角的奴隸）：工錢只分一部分給主角 */
export function freeWorker(m: Character): boolean {
  return needsConsent(m)
}

/** 主動行動的 target：「時數」或「時數:奴隸 id」 */
export function workTarget(hours: number, worker?: string): string {
  return worker ? `${hours}:${worker}` : String(hours)
}

/** 派去工作的奴隸（主角自己做時沒有） */
function workerOf(state: GameState, target?: string): Character | undefined {
  const id = target?.split(':')[1]
  if (!id) return undefined
  const m = workers(state).find((x) => x.id === id)
  if (!m) throw new Error('隊伍裡沒有這位夥伴，或他還沒答應去')
  return m
}

/** 主動行動的 target：時數 */
function hoursOf(target?: string): number {
  const h = Number(target?.split(':')[0])
  if (!workRules.hours.includes(h)) throw new Error(`工作時數只能是 ${workRules.hours.join('、')} 小時`)
  return h
}

/** 工錢；wage：時薪的倍率（娼館的頭牌等級） */
export function workPay(job: JobDef, hours: number, degree: Degree, wage = 1): number {
  return Math.round(hours * job.rate_cc * workRules.degree_pay[degree] * wage)
}

/** 這個人在這裡工作的時薪倍率：娼館看頭牌等級 */
export function wageFor(state: GameState, job: JobDef & { cell: string }, who?: Character): number {
  const w = who ?? state.party.find((m) => m.isPlayer)
  return job.cell === 'brothel' && w ? rankWage(state, w.id) : 1
}

/** 雇主：這個設施的店主（有登場過的話） */
function employer(state: GameState, cell: string): string | undefined {
  const id = `keeper_${shopPlace(state).id}_${cell === 'shop' ? 'general' : cell}`
  return npcRecord(state, id) ? id : undefined
}

export function setupWork(state: GameState, target?: string) {
  const job = jobHere(state)
  if (!job) throw new Error('這裡沒有工作可做')
  const worker = workerOf(state, target)
  if (!worker && job.official && isFugitive(state)) throw new Error(`${currentArea(state).name}的人認出了你身上的契約印記，不肯雇你`)
  const hours = hoursOf(target)
  const boss = employer(state, job.cell)
  const share = worker && freeWorker(worker) ? lewdRules.brothel.propose.share : 1
  const wage = wageFor(state, job, worker)
  const pay = (d: Degree) => formatMoney(Math.round(workPay(job, hours, d, wage) * share))
  const who = worker ? `${freeWorker(worker) ? '請' : '派'}${worker.name}去做` : ''
  return {
    // 娼館的工作是接客：敘事要詳細描寫
    ...(job.cell === 'brothel' ? adultScene(worker ? `${worker.name}被派去娼館接客（${hours} 小時）` : `在娼館接客（${hours} 小時）`) : {}),
    attr: job.attr, dc: job.dc, hours, situational: [],
    // 奴隸自己擲檢定，主角在一旁等
    ...(worker ? { actor: worker.id } : {}),
    ...(boss ? { targetName: npcRecord(state, boss)!.name } : {}),
    scene: `${locationById(state.location).name}・${who}${job.name}（${hours} 小時${worker ? (share < 1 ? `，工錢分你 ${Math.round(share * 100)}%` : '，工錢歸你') : ''}）`,
    outcomes: {
      critical: `做得很出色，拿到 ${pay('critical')}`, success: `拿到 ${pay('success')}`, partial: `拿到 ${pay('partial')}`,
      fail: `做得不好，只拿到 ${pay('fail')}`, fumble: '出了差錯，白做一場（雇主親密度 -3）',
    } as Partial<Record<Degree, string>>,
  }
}

export function applyWork(state: GameState, report: Report, target: string, degree: Degree): string {
  const job = jobHere(state)!
  const hours = hoursOf(target)
  const worker = workerOf(state, target)
  const share = worker && freeWorker(worker) ? lewdRules.brothel.propose.share : 1
  const pay = Math.round(workPay(job, hours, degree, wageFor(state, job, worker)) * share)
  if (pay > 0) applyEffects(state, report, [{ type: 'money', amount: pay }])
  if (degree === 'fumble') {
    const boss = employer(state, job.cell)
    if (boss) addAffinity(state, report, boss, workRules.fumble_affinity, '工作出了差錯')
  }
  // 娼館：接客的人淫亂與曝露名聲成長、頭牌等級累積，可能遇到打工事件；派別人去的話，親密場景記在他身上
  let extra = ''
  if (job.cell === 'brothel') {
    const who = worker ?? state.party.find((m) => m.isPlayer)
    if (who) {
      growLewd(state, who, 'brothel_work', report)
      const ev = afterBrothelWork(state, who)
      if (ev) extra = `${who.isPlayer ? '' : who.name}${ev}。`
    }
    if (worker) report.narration = { ...report.narration, adult_actor: worker.id }
  }
  if (worker) return `你${freeWorker(worker) ? '請' : '派'}${worker.name}去做了 ${hours} 小時的${job.name}，${pay > 0 ? `${share < 1 ? '分到你手上的' : '交到你手上的'}工錢 ${formatMoney(pay)}` : '一分錢也沒拿回來'}。${extra}`
  return `做了 ${hours} 小時的${job.name}，${pay > 0 ? `賺到 ${formatMoney(pay)}` : '一分錢也沒拿到'}。${extra}`
}
