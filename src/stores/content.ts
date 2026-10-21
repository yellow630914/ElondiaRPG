// 自訂內容：怪物、物品、裝備底材與材料的新增與修改（「🛠️ 內容」頁籤）。
// 跟著瀏覽器走（所有存檔共用），存在 localStorage；每次修改後立刻（同步）重新套用到遊戲資料，表單才讀得到新的值。

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { enemies, itemDef, npcs as namedNpcs, stories } from '@/engine/data'
import { builtinStory, flagUsage, sanitizeStory, type StoryMod } from '@/engine/storyMods'
import {
  abilityUsage, applyContent, builtinAbility, builtinEnemy, builtinNpc, emptyMods, normalizeMods, sanitizeAbility, sanitizeBase, sanitizeEnemy,
  sanitizeItem, sanitizeMaterial, sanitizeNpc, type AbilityMod, type BaseMod, type ContentMods, type EnemyMod, type ItemMod, type MaterialMod, type NpcMod,
} from '@/engine/mods'
import { pruneAbilities } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { useGame } from './game'

const KEY = 'elondia.content'

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
    if (game.state) pruneAbilities(game.state)
    version.value++
    try {
      localStorage.setItem(KEY, JSON.stringify(mods.value))
    } catch {
      // 寫不進去時只在本次有效
    }
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
    const target = custom && rename?.trim() ? rename.trim().slice(0, 20) : name
    if (target !== name) {
      if (mods.value.items[target] || itemDef(target)) throw new Error(`已經有叫「${target}」的物品`)
      delete mods.value.items[name]
      renameRefs(name, target)
    }
    mods.value.items[target] = sanitizeItem(target, draft, custom)
    save()
    return target
  }

  function deleteItem(name: string) {
    if (!mods.value.items[name]?.custom) throw new Error('內建的物品不能刪除')
    delete mods.value.items[name]
    renameRefs(name, null)
    save()
  }

  function restoreItem(name: string) {
    if (mods.value.items[name]?.custom) return
    delete mods.value.items[name]
    save()
  }

  /** 改名或刪除時更新怪物掉落裡的參照 */
  function renameRefs(from: string, to: string | null) {
    for (const e of Object.values(mods.value.enemies)) {
      if (!e.loot?.some((l) => l.item === from)) continue
      e.loot = to ? e.loot.map((l) => (l.item === from ? { ...l, item: to } : l)) : e.loot.filter((l) => l.item !== from)
      if (!e.loot.length) delete e.loot
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
    mods.value.bases[id] = sanitizeBase(draft, custom)
    save()
  }
  function deleteBase(id: string) {
    if (!mods.value.bases[id]?.custom) throw new Error('內建的底材不能刪除')
    delete mods.value.bases[id]
    save()
  }
  function restoreBase(id: string) {
    if (!mods.value.bases[id]?.custom) delete mods.value.bases[id]
    save()
  }
  function saveMaterial(id: string, draft: Partial<MaterialMod>, custom: boolean) {
    mods.value.materials[id] = sanitizeMaterial(draft, custom)
    save()
  }
  function deleteMaterial(id: string) {
    if (!mods.value.materials[id]?.custom) throw new Error('內建的材料不能刪除')
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
  function deleteAbility(id: string, state?: GameState | null) {
    if (!mods.value.abilities[id]?.custom) throw new Error('內建的能力不能刪除')
    const used = abilityUsage(id, state)
    if (used.length) throw new Error(`還有地方用到這個能力：${used.slice(0, 3).join('、')}${used.length > 3 ? ` 等 ${used.length} 處` : ''}`)
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

  function resetAll() {
    mods.value = emptyMods()
    save()
  }

  return {
    mods, problems, version,
    saveEnemy, deleteEnemy, restoreEnemy,
    saveItem, deleteItem, restoreItem, setItemDrops,
    saveBase, deleteBase, restoreBase, saveMaterial, deleteMaterial, restoreMaterial,
    saveNpc, deleteNpc, restoreNpc, saveStory, deleteStory, restoreStory, knownFlags,
    saveAbility, deleteAbility, restoreAbility,
    exportMods, importMods, resetAll,
  }
})
