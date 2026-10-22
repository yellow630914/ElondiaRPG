// NPC 的名字、外貌與性格（素材在 data/world/npc_traits.json，依世界書的種族條目整理）。
//
// - 外貌由多個部位組成：身高、壯碩程度、眼睛、面部、髮色、髮型、胸部（大小）、胸型、腰身、髖臀、腿部、足部，
//   再加上一項種族特徵（貓耳、尖耳、鰓裂、角與翅膀……）與服裝。
// - 性格由多個象限組成：社交、處事、待人、情緒、嗜好；至少一項來自種族或血統（部族、氏族、派系）。
// - 選項帶有標籤與互斥標籤（外貌與性格共用），抽的時候避開矛盾（例如嬌小又魁梧、沉默寡言又愛吹噓）。
// - 性別決定體型（陽剛、陰柔、中性），gender_rules 再依性別略過部位、排除標籤或調整權重（例如偽娘沒有胸部）。

import traitsJson from '@data/world/npc_traits.json'
import type { NpcKind } from './data'
import type { Rng } from './rng'

type Body = 'masc' | 'fem' | 'andro'

interface OptionDef {
  t: string
  tags?: string[]
  not?: string[]
  body?: Body[]
  omit?: string[]
}
type Option = string | OptionDef
interface PersonalityOption extends OptionDef {
  axis: string
}

interface LineageDef {
  id: string
  name: string
  weight: number
  home?: string[]
  surname?: string
  features?: Option[]
  parts?: Record<string, Option[]>
  /** 只從這些選項抽的部位（例如部族的毛色） */
  force?: Record<string, Option[]>
  personality?: PersonalityOption[]
}

interface RaceTraits {
  names: { m: string[]; f: string[] }
  surnames?: string[]
  surname_chance?: number
  body?: Body
  exclude?: string[]
  features?: Option[]
  parts?: Record<string, Option[]>
  force?: Record<string, Option[]>
  personality?: PersonalityOption[]
  lineages?: LineageDef[]
}

/** 依性別調整外貌的抽法（npc_traits.json 的 gender_rules） */
interface GenderRule {
  omit?: string[]
  exclude?: string[]
  tag_weight?: Record<string, number>
}

export const npcTraits = traitsJson as unknown as {
  body_by_gender: Record<string, Body>
  gender_rules: Record<string, GenderRule>
  part_order: string[]
  part_names: Record<string, string>
  race_part_weight: number
  parts: Record<string, Option[]>
  personality: {
    axes: { id: string; name: string; options: Option[] }[]
    quirks_by_kind: Record<NpcKind, Option[]>
  }
  races: Record<string, RaceTraits>
}

function def(o: Option): OptionDef {
  return typeof o === 'string' ? { t: o } : o
}

/** 已經選了哪些標籤、不能再出現哪些標籤 */
class Picks {
  tags = new Set<string>()
  banned = new Set<string>()
  omitted = new Set<string>()

  constructor(
    readonly body: Body,
    exclude: string[] = [],
    /** 帶這些標籤的選項權重乘上倍率 */
    readonly tagWeight: Record<string, number> = {},
  ) {
    for (const t of exclude) this.banned.add(t)
  }

  ok(o: OptionDef): boolean {
    if (o.body && !o.body.includes(this.body)) return false
    if (o.tags?.some((t) => this.banned.has(t))) return false
    if (o.not?.some((t) => this.tags.has(t))) return false
    return true
  }

  take(o: OptionDef): string {
    for (const t of o.tags ?? []) this.tags.add(t)
    for (const t of o.not ?? []) this.banned.add(t)
    for (const p of o.omit ?? []) this.omitted.add(p)
    return o.t
  }

  /** 從加權的選項中抽一個符合條件的；沒有時回傳 undefined */
  pick(rng: Rng, pools: { options: Option[]; weight: number }[]): string | undefined {
    const list = pools
      .flatMap((p) => p.options.map((o) => ({ o: def(o), w: p.weight })))
      .filter((x) => this.ok(x.o))
      .map((x) => ({ ...x, w: (x.o.tags ?? []).reduce((w, t) => w * (this.tagWeight[t] ?? 1), x.w) }))
      .filter((x) => x.w > 0)
    if (!list.length) return undefined
    const total = list.reduce((s, x) => s + x.w, 0)
    let r = rng.next() * total
    for (const x of list) {
      r -= x.w
      if (r < 0) return this.take(x.o)
    }
    return this.take(list[list.length - 1]!.o)
  }
}

export interface LookSpec {
  race: string
  gender: string
  kind: NpcKind
  /** 所在地點（決定血統的傾向） */
  location: string
  /** 已經用過的名字（避免重複） */
  used: Set<string>
  /** 服裝（依身分另外決定） */
  outfit?: string
}

export interface Look {
  name: string
  /** 血統、部族、氏族或出身派系 */
  lineage?: string
  appearance: string
  personality: string
  /** 組成的細節：各部位、種族特徵、各象限的性格、選到的標籤（測試與除錯用） */
  detail: {
    parts: Record<string, string>
    features: string[]
    traits: Record<string, string>
    /** 來自種族或血統的性格 */
    raceTraits: string[]
    tags: string[]
  }
}

function raceOf(race: string): RaceTraits {
  return npcTraits.races[race] ?? npcTraits.races.human!
}

function pickLineage(rng: Rng, race: RaceTraits, location: string): LineageDef | undefined {
  const list = race.lineages ?? []
  if (!list.length) return undefined
  const weights = list.map((l) => l.weight * (l.home?.includes(location) ? 4 : 1))
  let r = rng.next() * weights.reduce((s, w) => s + w, 0)
  for (let i = 0; i < list.length; i++) {
    r -= weights[i]!
    if (r < 0) return list[i]
  }
  return list[list.length - 1]
}

function pickName(rng: Rng, race: RaceTraits, lineage: LineageDef | undefined, gender: string, body: Body, used: Set<string>): string {
  const pool = gender === 'unknown'
    ? [...race.names.m, ...race.names.f]
    : body === 'masc' || gender === 'femboy' ? race.names.m : race.names.f
  const surname = lineage?.surname
    ?? (race.surnames?.length && rng.next() < (race.surname_chance ?? 0) ? rng.pick(race.surnames) : undefined)
  const full = (given: string) => (surname ? `${given}・${surname}` : given)
  const free = pool.filter((n) => !used.has(full(n)))
  if (free.length) return full(rng.pick(free))
  const base = full(rng.pick(pool))
  for (let i = 2; ; i++) if (!used.has(`${base}・${i}`)) return `${base}・${i}`
}

/** 抽一組名字、外貌與性格 */
export function rollLook(rng: Rng, spec: LookSpec): Look {
  const race = raceOf(spec.race)
  const body: Body = race.body ?? npcTraits.body_by_gender[spec.gender] ?? rng.pick(['masc', 'fem', 'andro'] as Body[])
  const lineage = pickLineage(rng, race, spec.location)
  const rule = npcTraits.gender_rules?.[spec.gender] ?? {}
  const picks = new Picks(body, [...(race.exclude ?? []), ...(rule.exclude ?? [])], rule.tag_weight)
  for (const p of rule.omit ?? []) picks.omitted.add(p)
  const w = npcTraits.race_part_weight

  // ---- 性格：先放一項來自種族或血統的，再補齊其他象限 ----
  const raceTraits = [...(lineage?.personality ?? []), ...(race.personality ?? [])]
  const lineageFirst = lineage?.personality?.length && rng.next() < 0.6 ? lineage.personality : raceTraits
  const traits: Record<string, string> = {}
  const first = lineageFirst.filter((o) => picks.ok(o))
  if (first.length) {
    const o = rng.pick(first)
    traits[o.axis] = picks.take(o)
  }
  for (const axis of npcTraits.personality.axes) {
    if (traits[axis.id]) continue
    const fromRace = raceTraits.filter((o) => o.axis === axis.id)
    const extra = axis.id === 'quirk' ? npcTraits.personality.quirks_by_kind[spec.kind] ?? [] : []
    const t = picks.pick(rng, [{ options: axis.options, weight: 1 }, { options: extra, weight: 1 }, { options: fromRace, weight: w / 2 }])
    if (t) traits[axis.id] = t
  }
  // 各象限之間用分號，象限內可以有逗號
  const personality = npcTraits.personality.axes.map((a) => traits[a.id]).filter(Boolean).join('；') + '。'

  // ---- 外貌：種族特徵（血統的優先）＋各部位 ----
  const features: string[] = []
  const lineageFeature = picks.pick(rng, [{ options: lineage?.features ?? [], weight: 1 }])
  if (lineageFeature) features.push(lineageFeature)
  if (!lineageFeature || rng.next() < 0.6) {
    const raceFeature = picks.pick(rng, [{ options: race.features ?? [], weight: 1 }])
    if (raceFeature) features.push(raceFeature)
  }
  const parts: Record<string, string> = {}
  for (const part of npcTraits.part_order) {
    if (picks.omitted.has(part)) continue
    const forced = lineage?.force?.[part] ?? race.force?.[part]
    const pools = forced
      ? [{ options: forced, weight: 1 }]
      : [
          { options: npcTraits.parts[part] ?? [], weight: 1 },
          { options: race.parts?.[part] ?? [], weight: w },
          { options: lineage?.parts?.[part] ?? [], weight: w * 2 },
        ]
    const t = picks.pick(rng, pools)
    if (t) parts[part] = t
  }
  const color = parts.hair_color ? (parts.hair_color.endsWith('的') ? parts.hair_color : `${parts.hair_color}的`) : ''
  const hair = parts.hair_style ? (picks.omitted.has('hair_color') || !color ? parts.hair_style : `一頭${color}${parts.hair_style}`) : ''
  const join = (list: (string | undefined)[], sep: string) => list.filter(Boolean).join(sep)
  const sentences = [
    join([parts.height, parts.build], '、'),
    join(features, '，'),
    join([parts.face, parts.eyes], '，'),
    hair,
    // 胸部（大小與胸型）一句，腰身、髖臀一句
    join([parts.chest, parts.chest_shape], '，'),
    join([parts.waist, parts.hips], '、'),
    join([parts.legs, parts.feet], '，'),
  ].filter(Boolean)
  const appearance = `${sentences.join('；')}。${spec.outfit ? `${spec.outfit}。` : ''}`

  return {
    name: pickName(rng, race, lineage, spec.gender, body, spec.used),
    ...(lineage ? { lineage: lineage.name } : {}),
    appearance,
    personality,
    detail: {
      parts,
      features,
      traits,
      raceTraits: Object.values(traits).filter((t) => raceTraits.some((o) => o.t === t)),
      tags: [...picks.tags],
    },
  }
}
