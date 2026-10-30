// 特殊任務生成器的目錄（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E4a）：給 AI 看的現有內容，只讀資料。
// 依玩家的指定與描述裡出現的名字挑相關的，每類有上限，整份控制在一兩萬字。

import {
  abilities, className, enemies, geography, itemRules, landmarks, npcs as namedNpcs, raceName, specialMaps, statuses, storyCounters, stories,
  type AbilityDef, type EnemyDef, type NpcDef,
} from '@/engine/data'
import { CELL_NAME } from '@/engine/grid'
import { hasFacility, STORY_CELLS } from '@/engine/storyMods'
import type { GenInput } from '@/engine/questGen'

const LIMITS = { npcs: 30, landmarks: 30, enemies: 40, abilities: 40, statuses: 30, items: 30, flags: 40, stories: 10 }
const TYPE_NAME: Record<string, string> = { capital: '首都', city: '城市', town: '城鎮', village: '村莊', outpost: '據點', port: '港口', fortress: '要塞', dungeon: '地下城' }
const short = (s: string | undefined, n: number) => ((s ?? '').length > n ? `${s!.slice(0, n)}…` : s ?? '')

/** 描述裡提到的（名字出現在描述裡） */
const mentioned = (prompt: string, name: string) => name.length >= 2 && prompt.includes(name)

function npcLine(n: NpcDef): string {
  const loc = geography.locations.find((l) => l.id === n.location)?.name ?? n.location
  const job = n.kind === 'commoner' ? n.occupation ?? '普通人' : className(n.class)
  const flags = [n.unhireable ? '不受雇用' : '', n.no_attack ? '不能偷襲' : ''].filter(Boolean).join('、')
  return `- ${n.id} ${n.name}（${raceName(n.race)}・${job} Lv.${n.level}・${loc}）${short(n.background ?? n.personality, 50)}${flags ? `［${flags}］` : ''}`
}

function enemyLine(e: EnemyDef): string {
  return `- ${e.id} ${e.name} Lv.${e.level}（${e.kind ?? ''}，生命 ${e.hp}）${e.abilities?.length ? ` 技能：${e.abilities.join('、')}` : ''}`
}

function abilityLine(a: AbilityDef): string {
  const dmg = (a.damage ?? []).map((d) => (d.weapon ? '武器' : `${d.dice ?? ''}${d.type ? ` ${d.type}` : ''}`)).join('+')
  const apply = (a.apply ?? []).map((x) => `${x.status}×${x.turns}`).join('、')
  return `- ${a.id} ${a.name}（${a.target}／${a.resolve}${dmg ? `／傷害 ${dmg}` : ''}${apply ? `／施加 ${apply}` : ''}）`
}

/** 整理目錄（純文字） */
export function questCatalog(input: GenInput): string {
  const prompt = input.prompt
  const level = input.level ?? 5
  const out: string[] = []

  // 地點：全部列出，聚落附上有哪些設施
  const related = new Set<string>()
  if (input.location) related.add(input.location)
  for (const l of geography.locations) if (mentioned(prompt, l.name)) related.add(l.id)
  const pinnedNpcs = namedNpcs.filter((n) => input.npcs?.includes(n.id) || mentioned(prompt, n.name))
  for (const n of pinnedNpcs) related.add(n.location)
  out.push('## 地點（id 名稱（地區・類型）：設施）')
  for (const l of geography.locations) {
    const region = geography.regions.find((r) => r.id === l.region)?.name ?? l.region
    const cells = l.type === 'dungeon' ? '' : `：${STORY_CELLS.filter((c) => hasFacility(l.id, c)).map((c) => CELL_NAME[c]).join('、')}`
    out.push(`- ${l.id} ${l.name}（${region}・${TYPE_NAME[l.type] ?? l.type}）${cells}`)
  }
  out.push('', `## 地區\n${geography.regions.map((r) => `${r.id} ${r.name}`).join('、')}`)
  out.push('', `## 勢力（reputation 的 faction）\n${geography.factions.map((f) => `${f.id} ${f.name}`).join('、')}`)

  // 地標：相關地點的（沒有相關地點時全部，有上限）
  const lms = Object.values(landmarks).filter((l) => !related.size || related.has(l.location)).slice(0, LIMITS.landmarks)
  if (lms.length) out.push('', '## 地標（可以當任務點的 cell，要和 location 同一個聚落）', ...lms.map((l) => `- ${l.id} ${l.emoji}${l.name}（${l.location}）${short(l.desc, 40)}`))
  const maps = Object.values(specialMaps)
  if (maps.length) out.push('', '## 特殊地圖', ...maps.map((m) => `- ${m.id} ${m.name}（${m.location}）${short(m.desc, 40)}`))

  // 固定 NPC：指定的、描述提到的、相關地點的
  const npcs = [...new Map([...pinnedNpcs, ...namedNpcs.filter((n) => related.has(n.location))].map((n) => [n.id, n])).values()].slice(0, LIMITS.npcs)
  if (npcs.length) out.push('', '## 固定 NPC', ...npcs.map(npcLine))

  // 怪物：建議等級 ±2（描述提到的也列）
  const foes = Object.values(enemies)
    .filter((e) => Math.abs(e.level - level) <= 2 || mentioned(prompt, e.name))
    .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))
    .slice(0, LIMITS.enemies)
  if (foes.length) out.push('', `## 怪物（建議等級 ${level} 附近，可以當 enemies 或新怪物的樣板）`, ...foes.map(enemyLine))

  // 技能：這些怪物用的，與其他怪物技能
  const abIds = [...new Set([...foes.flatMap((e) => e.abilities ?? []), ...Object.values(abilities).filter((a) => a.classes.includes('monster')).map((a) => a.id)])]
  const abs = abIds.map((id) => abilities[id]).filter((a): a is AbilityDef => !!a && a.type !== 'spell').slice(0, LIMITS.abilities)
  if (abs.length) out.push('', '## 技能（怪物可以用，也可以當新技能的樣板）', ...abs.map(abilityLine))
  const stIds = [...new Set([...abs.flatMap((a) => (a.apply ?? []).map((x) => x.status)), ...Object.keys(statuses)])].filter((id) => statuses[id]).slice(0, LIMITS.statuses)
  if (stIds.length) out.push('', '## 狀態', stIds.map((id) => `${id} ${statuses[id]!.name}${statuses[id]!.kind === 'buff' ? '（增益）' : ''}`).join('、'))

  // 物品：描述提到的、事件可能給的
  const items = itemRules.items.filter((i) => mentioned(prompt, i.name)).concat(itemRules.items.filter((i) => i.event && !mentioned(prompt, i.name)))
  if (items.length) out.push('', '## 物品（name 就是 id）', items.slice(0, LIMITS.items).map((i) => i.name).join('、'))

  // 劇情計數器、相關任務與它們的旗標（接續故事線用）
  const counters = Object.entries(storyCounters)
  if (counters.length) out.push('', '## 劇情計數器（結果的 counters）', counters.map(([id, c]) => `${id} ${c.name}`).join('、'))
  const rel = stories.filter((s) => mentioned(prompt, s.title) || (s.start.npc && input.npcs?.includes(s.start.npc)) || pinnedNpcs.some((n) => s.start.npc === n.id)).slice(0, LIMITS.stories)
  if (rel.length) {
    out.push('', '## 相關的現有任務與它們設定的旗標（要接續時才用）')
    for (const s of rel) {
      const flags = [...new Set([...(s.start_flags ?? []), ...s.nodes.flatMap((n) => [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])].flatMap((o) => o?.set_flags ?? []))])]
      out.push(`- ${s.id}「${s.title}」：${flags.slice(0, LIMITS.flags).join('、')}`)
    }
  }
  return out.join('\n')
}
