// 慾望指標（成人向；docs/LEWD_STATS.md）：淫亂、敏感、忍耐、順從記在角色身上，曝露名聲依地區記在存檔。
// 規則與數值在 data/rules/lewd.json。戰鬥的換算在 combat.ts（慾望上限、受到的慾望、初始慾望……）。

import { pcTagMult } from './pcTags'
import { recordFusedWear } from './fusion'
import { residents, trainingRoomOf } from './homes'
import { abilities, lewdRules, locationById, stories, TRAP_LOCK, type LewdKey } from './data'
import { charmExposureMult, chasingRegions, spreadExposure } from './charm'
import { gearLewdOf, gearRules } from './gear'
import { bindsOf, lustTotals, schoolName, schoolsOf } from './schools'
import { contractOf } from './tattoos'
import type { Character, GameState, LewdStat, LewdStats, Report } from './types'

export { gearLewdOf }
export const LEWD_STATS: LewdStat[] = ['lewdness', 'sensitivity', 'endurance', 'submission']
export const LEWD_KEYS: LewdKey[] = [...LEWD_STATS, 'exposure']

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** 指標的名稱 */
export function lewdName(key: LewdKey): string {
  return lewdRules.stats[key]?.name ?? key
}

/** 基本值（沒有記錄時用預設） */
export function baseLewd(c: Pick<Character, 'lewd'>): LewdStats {
  return c.lewd ?? { ...lewdRules.defaults }
}

/** 身上裝備的加值合計（每項全身 ±total_cap） */
export function gearLewd(c: Pick<Character, 'gear'>): Record<LewdStat, number> {
  const out = { lewdness: 0, sensitivity: 0, endurance: 0, submission: 0 }
  for (const g of Object.values(c.gear ?? {})) {
    if (!g) continue
    const b = gearLewdOf(g.spec)
    for (const k of LEWD_STATS) out[k] += b[k] ?? 0
  }
  const cap = lewdRules.gear.total_cap
  for (const k of LEWD_STATS) out[k] = Math.max(-cap, Math.min(cap, out[k]))
  return out
}

/** 有效值：基本值加上裝備的加值（0～100） */
export function lewdOf(c: Pick<Character, 'lewd' | 'gear'>): Record<LewdStat, number> {
  const base = baseLewd(c)
  const gear = gearLewd(c)
  return Object.fromEntries(LEWD_STATS.map((k) => [k, clamp(base[k] + gear[k])])) as Record<LewdStat, number>
}

/** 分段的名稱（每 20 一段）。順從：身上有奴隸契約時用被迫者的分段 */
export function bandName(key: LewdKey, value: number, forced = false): string {
  const def = lewdRules.stats[key]
  const bands = forced && def.forced_bands ? def.forced_bands : def.bands
  return bands[Math.min(bands.length - 1, Math.max(0, Math.floor(value / 20)))] ?? ''
}

/** 順從用被迫者的分段：身上有奴隸契約 */
export function forcedSubmission(c: Character): boolean {
  return !!contractOf(c)
}

/**
 * NPC 的慾望指標：依 id 固定地擲（不用共用的亂數，不影響其他生成），標籤（娼婦、奴隸、貴族……）決定範圍，
 * 固定 NPC 寫了的值優先
 */
export function npcLewd(def: { id: string; tags?: string[]; lewd?: Partial<Record<LewdStat, number>> }): LewdStats {
  let h = 2166136261
  for (const ch of `${def.id}:lewd`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
    return (h >>> 0) / 4294967296
  }
  const out = {} as LewdStats
  for (const k of LEWD_STATS) {
    let range = lewdRules.npc_random[k]
    for (const t of def.tags ?? []) range = lewdRules.npc_tags[t]?.[k] ?? range
    const roll = range[0] + Math.floor(next() * (range[1] - range[0] + 1))
    out[k] = clamp(def.lewd?.[k] ?? roll)
  }
  return out
}

// ---- 服裝的曝露度 ----

function slotExposure(c: Pick<Character, 'gear'>, slot: string): number {
  const g = c.gear?.[slot as keyof NonNullable<Character['gear']>]
  if (!g) return 0
  const base = gearRules.bases[g.spec.base]
  if (base?.exposure !== undefined) return base.exposure
  return base?.outfit ? lewdRules.gear.outfit[base.outfit]?.exposure ?? 0 : 0
}

/**
 * 曝露度 0～3：上身與下身看得到的那一層。上身穿著就看上身那件，沒有時看內衣（只穿內衣至少算 underwear_visible），
 * 什麼都沒穿是 naked；下身看下身那件，沒有時上身那件也算遮住，再沒有才看內褲。頭飾、鞋子、飾品不算。
 */
export function exposureLevel(c: Pick<Character, 'gear'>): number {
  const g = c.gear ?? {}
  const vis = lewdRules.gear.underwear_visible
  const naked = lewdRules.gear.naked
  const top = g.body ? slotExposure(c, 'body') : g.underwear_top ? Math.max(vis, slotExposure(c, 'underwear_top')) : naked
  const bottom = g.legs ? slotExposure(c, 'legs') : g.body ? slotExposure(c, 'body') : g.underwear_bottom ? Math.max(vis, slotExposure(c, 'underwear_bottom')) : naked
  return Math.max(top, bottom)
}

// ---- 曝露名聲（依地區） ----

/** 這個人在這個地區的曝露名聲 */
export function exposureAt(state: Pick<GameState, 'exposure'>, id: string, region: string): number {
  return state.exposure?.[id]?.[region] ?? 0
}

/** 目前所在地區 */
export function currentRegion(state: Pick<GameState, 'location'>): string {
  return locationById(state.location).region
}

// ---- 增減 ----

/** 增減一項指標（基本值），記在報告的 changes.lewd；曝露名聲記在指定的地區（沒指定時是目前的地區） */
export function addLewd(state: GameState, c: Character, key: LewdKey, delta: number, report?: Report, region?: string): number {
  if (!delta) return 0
  if (key === 'exposure') {
    // 主角的身分標籤：貴族、皇族的風流事傳得快，平民沒人在意（零頭記著，下次一起算）
    const mult = delta > 0 ? pcTagMult(c, 'exposure_mult') : 1
    if (mult !== 1) {
      const raw = delta * mult + (state.exposureCarry?.[c.id] ?? 0)
      delta = Math.floor(raw)
      const rest = Math.round((raw - delta) * 100) / 100
      if (rest) (state.exposureCarry ??= {})[c.id] = rest
      else if (state.exposureCarry) delete state.exposureCarry[c.id]
      if (!delta) return 0
    }
    const r = region ?? currentRegion(state)
    const map = ((state.exposure ??= {})[c.id] ??= {})
    const before = map[r] ?? 0
    const after = clamp(before + delta)
    if (after === before) return 0
    if (after) map[r] = after
    else delete map[r]
    if (report) (report.changes.lewd ??= []).push({ actor: c.id, stat: key, delta: after - before, after, region: r })
    return after - before
  }
  return addLewdStat(c, key, delta, report)
}

/** 增減淫亂、敏感、忍耐、順從（基本值，不含曝露名聲）；不需要存檔的其他部分（寄生物的侵蝕成長也用） */
export function addLewdStat(c: Character, key: Exclude<LewdKey, 'exposure'>, delta: number, report?: Report): number {
  if (!delta) return 0
  const stats = (c.lewd ??= { ...lewdRules.defaults })
  const before = stats[key]
  // 流派特質改變成長的速度（清心寡慾：淫亂的增加減半）；零頭記著，下次一起算
  const g = delta > 0 ? lustTotals(c).growth[key] ?? 0 : 0
  if (g) {
    const raw = delta * Math.max(0, 1 + g) + (stats.carry?.[key] ?? 0)
    delta = Math.floor(raw)
    const rest = Math.round((raw - delta) * 100) / 100
    if (rest) (stats.carry ??= {})[key] = rest
    else if (stats.carry) delete stats.carry[key]
    if (!delta) return 0
  }
  stats[key] = clamp(before + delta)
  const d = stats[key] - before
  if (d && report) (report.changes.lewd ??= []).push({ actor: c.id, stat: key, delta: d, after: stats[key] })
  return d
}

/** 套用 lewd.json 的一種成長（growth 的鍵），count 次 */
export function growLewd(state: GameState, c: Character, kind: keyof typeof lewdRules.growth, report?: Report, count = 1) {
  for (const [k, v] of Object.entries(lewdRules.growth[kind] ?? {})) if (v) addLewd(state, c, k as LewdKey, v * count, report)
}

/** 親密場景：報告帶成人場景時，場景的主角（通常是主角本人）淫亂成長，並記下日子（太久沒有親密場景會慢慢降） */
export function noteAdultScene(state: GameState, report: Report) {
  if (!report.narration?.adult_scene) return
  const who = report.narration.adult_actor
  const m = who ? state.party.find((x) => x.id === who) : state.party.find((x) => x.isPlayer)
  if (!m) return
  growLewd(state, m, 'adult_scene', report)
  ;(m.lewd ??= { ...lewdRules.defaults }).lastScene = report.time.end.day
}

// ---- 每天的變化 ----

const wears = (c: Character, test: (base: NonNullable<(typeof gearRules.bases)[string]>) => boolean) =>
  Object.values(c.gear ?? {}).some((g) => { const b = g && gearRules.bases[g.spec.base]; return !!b && test(b) })

/**
 * 跨過幾天（from 天到 to 天之間的每一天）：曝露名聲每天淡掉；在聚落裡穿著曝露的服裝會累積；
 * 穿成人向服裝淫亂成長、穿束縛用的底材忍耐成長、被主人鎖上的裝備順從成長；沒有契約的日子順從慢慢降；
 * 太久沒有親密場景，淫亂慢慢降回預設。只看隊伍裡的人；不寫進報告。
 */
export function lewdDaily(state: GameState, fromDay: number, toDay: number) {
  const days = Math.min(30, toDay - fromDay)
  if (days <= 0) return
  const d = lewdRules.daily
  const loc = locationById(state.location)
  const inTown = d.settlements.includes(loc.type)
  for (let i = 1; i <= days; i++) {
    const day = fromDay + i
    for (const m of state.party) {
      const map = state.exposure?.[m.id]
      // 還在追相鄰地區目標的地區這一天不淡掉（charm.ts 的 spreadExposure）
      const chasing = map ? chasingRegions(state, m.id) : undefined
      if (map) for (const r of Object.keys(map)) if (!chasing!.has(r)) addLewd(state, m, 'exposure', -d.exposure_decay, undefined, r)
      const level = exposureLevel(m)
      // 魅氣濃度越高累積得越快（charm.ts）
      if (inTown && level > 0) addLewd(state, m, 'exposure', Math.round(level * d.exposure_per_level * charmExposureMult(loc.id)), undefined, loc.region)
      const bonus = (b: Partial<Record<LewdKey, number>>) => { for (const [k, v] of Object.entries(b)) if (v) addLewd(state, m, k as LewdKey, v) }
      if (wears(m, (b) => b.outfit === 'adult')) bonus(d.adult_outfit)
      if (wears(m, (b) => !!b.restraint)) bonus(d.restraint)
      // 被鎖住的拘束具：主人鎖上的（契約還在時）或陷阱鎖住的
      if (Object.values(m.gear ?? {}).some((g) => g?.locked && (contractOf(m) || g.locked.startsWith(TRAP_LOCK)))) bonus(d.locked)
      // 奴隸印記的順從累積（條款的 submission_every）
      const every = contractOf(m)?.terms.submission_every
      if (every && day % every === 0) addLewd(state, m, 'submission', 1)
      if (!contractOf(m) && d.free_submission_every > 0 && day % d.free_submission_every === 0) addLewd(state, m, 'submission', -1)
      const stats = baseLewd(m)
      if (day - (stats.lastScene ?? 0) > d.idle_days && stats.lewdness > lewdRules.defaults.lewdness) addLewd(state, m, 'lewdness', -1)
    }
    // 淫器：記下穿著的日子（fusion.ts）
    recordFusedWear(state, day)
    // 調教室：留在擺了調教家具的房子裡的奴隸，每天順從上升（docs/LEWD_STATS.md 第 19 節）
    for (const home of Object.values(state.homes ?? {})) {
      if (!trainingRoomOf(home)) continue
      for (const c of residents(state, home.id)) if (c.bond === 'slave') addLewd(state, c, 'submission', lewdRules.training.resident_submission)
    }
    // 曝露名聲傳到相鄰地區
    spreadExposure(state)
  }
}

// ---- 奴隸的身價（docs/LEWD_STATS.md 第 23 節） ----

/** 指標超過門檻的部分與會的色情技能讓身價變高：回傳倍率（lewd.json 的 slave_price） */
export function slaveValueMult(stats: Record<LewdStat, number>, lewdSkills: number): number {
  const r = lewdRules.slave_price
  const fromStats = (Object.entries(r.per) as [LewdStat, number][]).reduce((s, [k, w]) => s + Math.max(0, (stats[k] ?? 0) - r.above) * w, 0)
  return 1 + Math.min(r.max, fromStats + lewdSkills * r.per_skill)
}

/** 這個人的身價倍率：指標與學會的色情技能 */
export function slaveValueOf(c: Pick<Character, 'lewd' | 'gear' | 'abilities'>): number {
  return slaveValueMult(lewdOf(c), c.abilities.filter((id) => abilities[id]?.classes.includes('lewd')).length)
}

// ---- 給 AI ----

/** 一行分段的說明（例如「淫亂：開放；敏感：敏感；忍耐：漸成；順從：配合；在這一帶小有名氣」） */
export function lewdSummary(state: Pick<GameState, 'exposure' | 'location'>, c: Character, withNumbers = false): string {
  const v = lewdOf(c)
  const n = (x: number) => (withNumbers ? `（${x}）` : '')
  const parts = LEWD_STATS.map((k) => `${lewdName(k)}：${bandName(k, v[k], k === 'submission' && forcedSubmission(c))}${n(v[k])}`)
  const exp = exposureAt(state, c.id, currentRegion(state))
  parts.push(`${lewdName('exposure')}：在這一帶${bandName('exposure', exp)}${n(exp)}`)
  const schools = schoolsOf(c)
  if (schools.length) parts.push(`慾望流派：${schools.map(schoolName).join('、')}`)
  const binds = bindsOf(c)
  if (binds.length) parts.push(`身上的拘束：${binds.map((b) => `${b.name}${b.lock ? '（上鎖）' : ''}`).join('、')}`)
  return parts.join('；')
}

// ---- 舊存檔：補發打工線的獨特技能（慾望戰鬥 S6，docs/LEWD_STATS.md 第 11 節） ----

/** 任務的結果裡直接給的色情技能（ability 效果寫了 ability 的） */
function storyLewdSkills(def: { nodes: unknown[] }): string[] {
  const out = new Set<string>()
  const walk = (o: unknown) => {
    if (Array.isArray(o)) o.forEach(walk)
    else if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>
      if (r.type === 'ability' && typeof r.ability === 'string' && abilities[r.ability]?.classes.includes('lewd')) out.add(r.ability)
      Object.values(r).forEach(walk)
    }
  }
  walk(def.nodes)
  return [...out]
}

/** 已經完成的任務線給的色情技能，主角還沒學會的補上（讀檔時；回傳補了哪些） */
export function backfillLewdSkills(state: GameState): string[] {
  const pc = state.party.find((m) => m.isPlayer)
  if (!pc) return []
  const added: string[] = []
  for (const p of Object.values(state.stories ?? {})) {
    if (p.status !== 'completed') continue
    const def = stories.find((s) => s.id === p.id)
    if (!def) continue
    for (const id of storyLewdSkills(def)) {
      if (pc.abilities.includes(id)) continue
      pc.abilities.push(id)
      added.push(id)
    }
  }
  return added
}
