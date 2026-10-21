// 自訂內容：怪物、物品、裝備底材與材料的新增與修改（「🛠️ 內容」頁籤）。
// 跟著瀏覽器走（所有存檔共用），存在 localStorage；每次修改後立刻（同步）重新套用到遊戲資料，表單才讀得到新的值。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { enemies, itemDef, npcs as namedNpcs, stories } from '@/engine/data'
import { builtinStory, flagUsage, sanitizeStory, type StoryMod } from '@/engine/storyMods'
import {
  abilityUsage, applyContent, cleanItemName, builtinAbility, builtinEnemy, builtinNpc, emptyMods, normalizeMods, sanitizeAbility, sanitizeBase, sanitizeEnemy,
  sanitizeItem, sanitizeMaterial, sanitizeNpc, type AbilityMod, type BaseMod, type ContentMods, type EnemyMod, type ItemMod, type MaterialMod, type NpcMod,
} from '@/engine/mods'
import { pruneAbilities } from '@/engine/state'
import { pruneStories } from '@/engine/story'
import { enemyUsage, gearUsage, itemUsage, npcUsage, renameItemInState, storyUsage } from '@/engine/usage'
import { useGame } from './game'

const KEY = 'elondia.content'

type Section = Exclude<keyof ContentMods, 'version'>
const MOD_SECTIONS: Section[] = ['abilities', 'materials', 'bases', 'items', 'enemies', 'npcs', 'stories']
export const MOD_SECTION_NAMES: Record<Section, string> = {
  abilities: '技能', materials: '材料', bases: '底材', items: '物品', enemies: '怪物', npcs: '固定 NPC', stories: '特殊任務',
}

export interface ModsDiffEntry {
  key: string
  section: Section
  id: string
  label: string
}

export interface ModsDiff {
  incoming: ContentMods
  added: ModsDiffEntry[]
  changed: ModsDiffEntry[]
  same: number
}

function modLabel(section: Section, id: string, v: unknown): string {
  const o = v as { name?: string; title?: string }
  const name = section === 'items' ? id : o.title ?? o.name ?? id
  return `${MOD_SECTION_NAMES[section]}「${name}」`
}

function load(): ContentMods {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeMods(JSON.parse(raw)) : emptyMods()
  } catch {
    return emptyMods()
  }
}

/** 啟動時（建立其他 store 之前）先套用，讀檔與開新遊戲才會看到自訂內容 */
export function initContent(): string[] {
  return applyContent(load())
}

export const useContent = defineStore('content', () => {
  const mods = ref<ContentMods>(load())
  const problems = ref<string[]>([])
  /** 遊戲資料不是響應式的：每次套用後加一，讓畫面重新計算 */
  const version = ref(0)

  function save() {
    problems.value = applyContent(mods.value)
    // 被拿掉的能力（匯入、全部恢復預設）：從目前存檔的角色身上拿掉
    const game = useGame()
    if (game.state) {
      pruneAbilities(game.state)
      pruneStories(game.state)
    }
    version.value++
    try {
      localStorage.setItem(KEY, JSON.stringify(mods.value))
    } catch {
      // 寫不進去時只在本次有效
    }
  }

  // ---- 引用檢查：還有地方用到的自建項目不能刪 ----

  type Kind = 'enemy' | 'item' | 'base' | 'material' | 'npc' | 'story' | 'ability'
  /** 哪些地方用到這一項（其他內容與目前載入的存檔） */
  function usageOf(kind: Kind, key: string): string[] {
    const state = useGame().state
    switch (kind) {
      case 'enemy': return enemyUsage(key, state)
      case 'item': return itemUsage(key, state)
      case 'base': return gearUsage('base', key, state, Object.keys(mods.value.items))
      case 'material': return gearUsage('material', key, state, Object.keys(mods.value.items))
      case 'npc': return npcUsage(key, state)
      case 'story': return storyUsage(key, state)
      case 'ability': return abilityUsage(key, state)
    }
  }
  function assertUnused(kind: Kind, key: string) {
    const used = usageOf(kind, key)
    if (used.length) throw new Error(`還有地方用到，不能刪除：${used.slice(0, 3).join('、')}${used.length > 3 ? ` 等 ${used.length} 處` : ''}`)
  }

  // ---- 怪物 ----

  function saveEnemy(id: string, draft: Partial<EnemyMod>) {
    const custom = !builtinEnemy(id)
    mods.value.enemies[id] = sanitizeEnemy(id, draft, custom)
    save()
  }

  /** 自建的怪物才能刪 */
  function deleteEnemy(id: string) {
    if (!mods.value.enemies[id]?.custom) throw new Error('內建的怪物不能刪除')
    assertUnused('enemy', id)
    delete mods.value.enemies[id]
    save()
  }

  /** 內建怪物恢復預設 */
  function restoreEnemy(id: string) {
    if (mods.value.enemies[id]?.custom) return
    delete mods.value.enemies[id]
    save()
  }

  // ---- 物品 ----

  function saveItem(name: string, draft: Partial<ItemMod>, rename?: string) {
    const existing = mods.value.items[name]
    const custom = existing ? !!existing.custom : !!draft.custom
    if (!existing && custom && itemDef(name)) throw new Error(`已經有叫「${name}」的物品`)
    const target = custom && rename?.trim() ? cleanItemName(rename) || name : name
    // AI 生成或打造時登錄在目前存檔的物品也算（同名會蓋掉它的類別、價格與裝備組成）
    const taken = (n: string) => !!mods.value.items[n] || !!itemDef(n) || !!useGame().state?.customItems?.[n]
    if (!existing && custom && useGame().state?.customItems?.[name]) throw new Error(`目前的存檔已經有叫「${name}」的物品`)
    if (target !== name) {
      if (taken(target)) throw new Error(`已經有叫「${target}」的物品`)
      delete mods.value.items[name]
      renameRefs(name, target)
      // 目前存檔裡的同名物品一起改名（其他存檔裡的會變成無法使用的雜物）
      const game = useGame()
      if (game.state) renameItemInState(game.state, name, target)
    }
    mods.value.items[target] = sanitizeItem(target, draft, custom)
    save()
    return target
  }

  function deleteItem(name: string) {
    if (!mods.value.items[name]?.custom) throw new Error('內建的物品不能刪除')
    assertUnused('item', name)
    delete mods.value.items[name]
    renameRefs(name, null)
    save()
  }

  function restoreItem(name: string) {
    if (mods.value.items[name]?.custom) return
    delete mods.value.items[name]
    save()
  }

  /** 改名或刪除時更新怪物掉落與特殊任務獎勵裡的參照 */
  function renameRefs(from: string, to: string | null) {
    for (const e of Object.values(mods.value.enemies)) {
      if (!e.loot?.some((l) => l.item === from)) continue
      e.loot = to ? e.loot.map((l) => (l.item === from ? { ...l, item: to } : l)) : e.loot.filter((l) => l.item !== from)
      if (!e.loot.length) delete e.loot
    }
    if (!to) return
    for (const s of Object.values(mods.value.stories)) {
      const lists = [s.rewards, ...s.nodes.flatMap((n) => [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])]).map((o) => o?.effects)]
      for (const list of lists) for (const e of list ?? []) if (e.type === 'item' && e.name === from) e.name = to
    }
  }

  /** 在物品這邊設定掉落：改的是怪物的 loot（沒改過的內建怪物會先複製一份） */
  function setItemDrops(name: string, drops: { enemy: string; chance: number; qty: number }[]) {
    const wanted = new Map(drops.filter((d) => enemies[d.enemy] && d.chance > 0).map((d) => [d.enemy, d]))
    for (const e of Object.values(enemies)) {
      const has = (e.loot ?? []).some((l) => l.item === name)
      const want = wanted.get(e.id)
      if (!has && !want) continue
      const current = mods.value.enemies[e.id] ?? (JSON.parse(JSON.stringify(e)) as EnemyMod)
      const loot = (current.loot ?? []).filter((l) => l.item !== name)
      if (want) loot.push({ item: name, chance: want.chance, ...(want.qty > 1 ? { qty: want.qty } : {}) })
      const before = JSON.stringify((e.loot ?? []).filter((l) => l.item === name))
      const after = JSON.stringify(loot.filter((l) => l.item === name))
      if (before === after && !mods.value.enemies[e.id]) continue
      mods.value.enemies[e.id] = sanitizeEnemy(e.id, { ...current, loot }, !builtinEnemy(e.id))
    }
    save()
  }

  // ---- 底材與材料 ----

  function saveBase(id: string, draft: Partial<BaseMod>, custom: boolean) {
    mods.value.bases[id] = sanitizeBase(draft, custom, id)
    save()
  }
  function deleteBase(id: string) {
    if (!mods.value.bases[id]?.custom) throw new Error('內建的底材不能刪除')
    assertUnused('base', id)
    delete mods.value.bases[id]
    save()
  }
  function restoreBase(id: string) {
    if (!mods.value.bases[id]?.custom) delete mods.value.bases[id]
    save()
  }
  function saveMaterial(id: string, draft: Partial<MaterialMod>, custom: boolean) {
    mods.value.materials[id] = sanitizeMaterial(draft, custom, id)
    save()
  }
  function deleteMaterial(id: string) {
    if (!mods.value.materials[id]?.custom) throw new Error('內建的材料不能刪除')
    assertUnused('material', id)
    delete mods.value.materials[id]
    save()
  }
  function restoreMaterial(id: string) {
    if (!mods.value.materials[id]?.custom) delete mods.value.materials[id]
    save()
  }

  // ---- 固定 NPC ----

  function saveNpc(id: string, draft: Partial<NpcMod>) {
    mods.value.npcs[id] = sanitizeNpc(id, draft, !builtinNpc(id))
    save()
  }
  function deleteNpc(id: string) {
    if (!mods.value.npcs[id]?.custom) throw new Error('內建的角色不能刪除')
    assertUnused('npc', id)
    delete mods.value.npcs[id]
    save()
  }
  function restoreNpc(id: string) {
    if (!mods.value.npcs[id]?.custom) delete mods.value.npcs[id]
    save()
  }

  // ---- 特殊任務 ----

  function saveStory(id: string, draft: Partial<StoryMod>) {
    mods.value.stories[id] = sanitizeStory(id, draft, !builtinStory(id))
    save()
  }
  function deleteStory(id: string) {
    if (!mods.value.stories[id]?.custom) throw new Error('內建的特殊任務不能刪除')
    assertUnused('story', id)
    delete mods.value.stories[id]
    save()
  }
  function restoreStory(id: string) {
    if (!mods.value.stories[id]?.custom) delete mods.value.stories[id]
    save()
  }

  // ---- 能力 ----

  function saveAbility(id: string, draft: Partial<AbilityMod>) {
    mods.value.abilities[id] = sanitizeAbility(id, draft, !builtinAbility(id))
    save()
  }
  /** 自建、而且沒有被任何地方用到的能力才能刪 */
  function deleteAbility(id: string) {
    if (!mods.value.abilities[id]?.custom) throw new Error('內建的能力不能刪除')
    assertUnused('ability', id)
    delete mods.value.abilities[id]
    save()
  }
  function restoreAbility(id: string) {
    if (!mods.value.abilities[id]?.custom) delete mods.value.abilities[id]
    save()
  }

  /** 內容頁籤裡用過的劇情旗標（自動完成用） */
  function knownFlags(): string[] {
    const set = new Set<string>()
    for (const n of namedNpcs) for (const f of [...(n.requires?.flags ?? []), ...(n.requires?.flags_none ?? [])]) set.add(f)
    for (const s of stories) for (const u of flagUsage(s)) set.add(u.flag)
    return [...set].sort()
  }

  // ---- 匯出、匯入、重設 ----

  function exportMods(): string {
    return JSON.stringify({ type: 'elondia-content', ...mods.value }, null, 2)
  }

  function importMods(text: string) {
    mods.value = normalizeMods(JSON.parse(text))
    save()
  }

  /**
   * 和匯入存檔附上的自訂內容比較：新增的、和這個瀏覽器不同的、相同的。
   * 每一項的 key 是「區塊:id」（例如 stories:lost_ring）
   */
  function diffMods(raw: unknown): ModsDiff {
    const incoming = normalizeMods(raw)
    // normalizeMods 會先登錄自建的能力與底材：比較完恢復成目前的內容
    problems.value = applyContent(mods.value)
    const diff: ModsDiff = { incoming, added: [], changed: [], same: 0 }
    for (const section of MOD_SECTIONS) {
      const mine = mods.value[section] as Record<string, unknown>
      for (const [id, v] of Object.entries(incoming[section] as Record<string, unknown>)) {
        const entry = { key: `${section}:${id}`, section, id, label: modLabel(section, id, v) }
        if (!(id in mine)) diff.added.push(entry)
        else if (JSON.stringify(mine[id]) !== JSON.stringify(v)) diff.changed.push(entry)
        else diff.same++
      }
    }
    return diff
  }

  /** 合併：加入新增的，take 裡的（和這個瀏覽器不同的項目）換成檔案的；這個瀏覽器其他的內容不動 */
  function mergeMods(diff: ModsDiff, take: string[] = []): number {
    const want = new Set([...diff.added.map((e) => e.key), ...take])
    let n = 0
    for (const e of [...diff.added, ...diff.changed]) {
      if (!want.has(e.key)) continue
      ;(mods.value[e.section] as Record<string, unknown>)[e.id] = (diff.incoming[e.section] as Record<string, unknown>)[e.id]
      n++
    }
    if (n) save()
    return n
  }

  function resetAll() {
    mods.value = emptyMods()
    save()
  }

  return {
    mods, problems, version, usageOf,
    saveEnemy, deleteEnemy, restoreEnemy,
    saveItem, deleteItem, restoreItem, setItemDrops,
    saveBase, deleteBase, restoreBase, saveMaterial, deleteMaterial, restoreMaterial,
    saveNpc, deleteNpc, restoreNpc, saveStory, deleteStory, restoreStory, knownFlags,
    saveAbility, deleteAbility, restoreAbility,
    exportMods, importMods, resetAll, diffMods, mergeMods,
  }
})
