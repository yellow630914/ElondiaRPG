// 雜物的工具模板（items.json 的 tools）：開鎖、陷阱、照明、旅途、露營、保養。
// 行囊（全隊共用）裡同一種工具只算加值最高的一件；沒有模板的雜物交給 AI 判斷（判定時會看到行囊）。

import { craftRules, itemDef, itemRules, type ItemTool, type ToolDef, type ToolKind } from './data'
import type { GameState } from './types'

export const TOOL_KINDS = Object.keys(itemRules.tools).filter((k) => !k.startsWith('$')) as ToolKind[]

export function toolDef(tool: ItemTool | undefined): ToolDef | undefined {
  return tool ? itemRules.tools[tool.kind] : undefined
}

/** 這件工具的加值（沒寫時用模板的預設，照明類有上限） */
export function toolValue(tool: ItemTool): number {
  const def = itemRules.tools[tool.kind]
  const v = tool.bonus ?? def?.bonus ?? 0
  return def?.max !== undefined ? Math.min(def.max, v) : v
}

/** 工具效果的一行說明 */
export function toolSummary(tool: ItemTool | undefined): string {
  const def = toolDef(tool)
  if (!tool || !def) return ''
  if (tool.kind === 'craft') {
    const craft = craftRules.skills[tool.craft ?? 'smithing']?.name
    return `${def.name}：${craftRules.tool_tier_names[(tool.tier ?? 1) - 1] ?? ''}的${craft}工具`
  }
  return `${def.name}：${def.desc.replace('{bonus}', String(toolValue(tool)))}`
}

/** 行囊裡這種工具最好的一件（沒有時為 undefined） */
export function bestTool(state: GameState, kind: ToolKind): { name: string; bonus: number } | undefined {
  let best: { name: string; bonus: number } | undefined
  for (const i of state.inventory) {
    if (i.qty <= 0) continue
    const tool = itemDef(i.name)?.tool
    if (tool?.kind !== kind) continue
    const bonus = toolValue(tool)
    if (!best || bonus > best.bonus) best = { name: i.name, bonus }
  }
  return best
}

/** 行囊裡這種工具的加值（沒有時 0） */
export function toolBonus(state: GameState, kind: ToolKind): number {
  return bestTool(state, kind)?.bonus ?? 0
}
