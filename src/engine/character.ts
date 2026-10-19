// 角色數值推導、經驗值與升級。

import { combatRules, progression, skills, type ClassCombat, type NpcDef } from './data'
import type { Rng } from './rng'
import type { ActorState, Character, GuildRank, SkillQuality } from './types'

const QUALITY_ORDER: SkillQuality[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

export function classCombat(classId: string): ClassCombat {
  const c = combatRules.classes[classId]
  if (!c) throw new Error(`unknown class: ${classId}`)
  return c
}

export function proficiency(level: number): number {
  const { base, every_levels } = combatRules.proficiency
  return base + Math.floor((level - 1) / every_levels)
}

export function maxHpFor(classId: string, level: number): number {
  const die = classCombat(classId).hit_die
  return die + (level - 1) * (die / 2 + 1) + level
}

export function maxMpFor(classId: string, level: number): number {
  return 2 + classCombat(classId).mp_per_level * level
}

export function attackBonus(c: Pick<Character, 'class' | 'level'>): number {
  return proficiency(c.level) + classCombat(c.class).attack_attr
}

export function armorClass(c: Pick<Character, 'class'>): number {
  return classCombat(c.class).ac
}

export function damageDice(c: Pick<Character, 'class'>): string {
  const cc = classCombat(c.class)
  return `${cc.damage}+${cc.attack_attr}`
}

export function lifeTier(level: number): number {
  return progression.life_tiers.find((t) => level >= t.levels[0] && level <= t.levels[1])?.tier ?? 1
}

export function maxSkillQuality(level: number): SkillQuality {
  return progression.life_tiers.find((t) => t.tier === lifeTier(level))?.max_skill_quality ?? 'common'
}

export function guildRankFor(level: number): GuildRank {
  const ranks = progression.guild_ranks
  return ranks.find((r) => level >= r.levels[0] && level <= r.levels[1])?.rank ?? ranks[ranks.length - 1]!.rank
}

export function xpToNext(level: number): number {
  return combatRules.xp_to_next_level_per_level * level
}

export function affinityStage(value: number): string {
  return progression.affinity.stages.find((s) => value >= s.range[0] && value <= s.range[1])?.name ?? ''
}

/** 角色扮演指導第一層：觀察者對目標的基準態度（以生命層級差計算）。 */
export function powerGapAttitude(observerLevel: number, targetLevel: number): string {
  const { by_diff, clamp } = progression.power_gap_attitude
  const diff = Math.max(clamp[0], Math.min(clamp[1], lifeTier(observerLevel) - lifeTier(targetLevel)))
  return by_diff[String(diff)] ?? '對等'
}

function baseCharacter(id: string, name: string, race: string, classId: string, level: number): Character {
  const maxHp = maxHpFor(classId, level)
  const maxMp = maxMpFor(classId, level)
  return {
    id, name, race, class: classId, level, xp: 0,
    hp: maxHp, maxHp, mp: maxMp, maxMp,
    skills: [...classCombat(classId).start_skills],
    status: [],
  }
}

export function createPlayer(name: string, race: string, classId: string): Character {
  return { ...baseCharacter('pc', name, race, classId, 1), isPlayer: true }
}

export function createNpc(def: NpcDef): Character {
  return {
    ...baseCharacter(def.id, def.name, def.race, def.class, def.level),
    personality: def.personality,
    faction: def.faction,
    affinity: progression.affinity.initial,
  }
}

/** 升級時的技能三選一：品質不超過生命層級上限、尚未學會、非敵人專用。 */
export function skillChoices(c: Character, rng: Rng, count = 3): string[] {
  const cap = QUALITY_ORDER.indexOf(maxSkillQuality(c.level))
  const pool = Object.values(skills).filter(
    (s) => !s.enemy_only && !c.skills.includes(s.id) && QUALITY_ORDER.indexOf(s.quality) <= cap,
  )
  const picked: string[] = []
  while (picked.length < count && pool.length > 0) {
    const i = rng.int(0, pool.length - 1)
    picked.push(pool.splice(i, 1)[0]!.id)
  }
  return picked
}

/** 加經驗值並處理升級；回傳升了幾級。會直接修改角色。 */
export function gainXp(c: Character, amount: number, rng: Rng): number {
  c.xp += amount
  let gained = 0
  while (c.level < 20 && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level)
    c.level += 1
    gained += 1
    const hpGain = maxHpFor(c.class, c.level) - c.maxHp
    const mpGain = maxMpFor(c.class, c.level) - c.maxMp
    c.maxHp += hpGain
    c.hp += hpGain
    c.maxMp += mpGain
    c.mp += mpGain
    const choices = skillChoices(c, rng)
    if (choices.length > 0) c.pendingSkillChoices = [...(c.pendingSkillChoices ?? []), choices]
  }
  return gained
}

/**
 * 報告用的角色快照。player 傳入時，NPC 隊友會附上對主角的態度
 * （角色扮演指導：實力差 → 親密值；立場與性格交給 AI 依 personality 演繹）。
 */
export function snapshot(c: Character, before?: Character, player?: Character): ActorState {
  const b = before ?? c
  const state: ActorState = {
    id: c.id,
    name: c.name,
    race: c.race,
    class: c.class,
    level: c.level,
    rank: guildRankFor(c.level),
    hp: [b.hp, c.hp, c.maxHp],
    mp: [b.mp, c.mp, c.maxMp],
    status: [...c.status],
  }
  if (c.personality) state.personality = c.personality
  if (player && !c.isPlayer && c.affinity !== undefined) {
    state.attitude = `${powerGapAttitude(c.level, player.level)} / ${affinityStage(c.affinity)}`
  }
  return state
}
