<script setup lang="ts">
import { ref, watch } from 'vue'
import GameIcon from './GameIcon.vue'
import type { IconName } from './iconPaths'

// 可以展開的區塊，樣子和建築的功能選單一樣（圖示、名稱、一行說明、右側的數字），箭頭朝下時內容展開在下面。
// 有 id 時記住展開狀態（這個瀏覽器）；沒有記錄時依 open。
// 有 auto 時跟著它自動展開、收起（例如「這裡的人」：身邊有人才展開），中間也可以手動切換，不記住。
const props = withDefaults(defineProps<{
  icon: IconName
  label: string
  detail?: string
  badge?: string | number
  tone?: 'gold' | 'good' | 'bad'
  /** 記住展開狀態用的 key（例如 place.work） */
  id?: string
  /** 沒有記錄時預設展開 */
  open?: boolean
  /** 自動展開與收起：值改變時跟著改 */
  auto?: boolean
}>(), { detail: '', badge: undefined, tone: undefined, id: undefined, open: false, auto: undefined })

const KEY = 'elondia.foldMenus'

function read(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

const expanded = ref(props.auto ?? (props.id ? read()[props.id] ?? props.open : props.open))
watch(() => props.auto, (v) => { if (v !== undefined) expanded.value = v })

function toggle() {
  expanded.value = !expanded.value
  if (!props.id || props.auto !== undefined) return
  try {
    const all = read()
    if (expanded.value === props.open) delete all[props.id]
    else all[props.id] = expanded.value
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // 記不住也沒關係
  }
}
</script>

<template>
  <div class="fold-menu" :class="{ open: expanded }">
    <button class="ghost menu-row" :aria-expanded="expanded" @click="toggle">
      <GameIcon :name="icon" :size="20" class="ic" />
      <span class="text"><span class="t">{{ label }}</span><span v-if="detail" class="d">{{ detail }}</span></span>
      <span v-if="badge !== undefined && badge !== ''" class="tag" :class="tone">{{ badge }}</span>
      <GameIcon name="right" :size="14" class="chev" />
    </button>
    <div v-if="expanded" class="fold-body unfold"><slot /></div>
  </div>
</template>

<style scoped>
.fold-menu { border-top: 1px solid #ffffff0a; }
:global(.parchment) .fold-menu { border-top-color: #00000014; }
.open > .menu-row .chev { transform: rotate(90deg); }
.open > .menu-row { color: var(--accent-2); }
.fold-body {
  display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr); min-width: 0;
  margin: 0 0 8px 20px; padding: 2px 4px 4px 14px; border-left: 1px solid var(--border);
}
</style>
