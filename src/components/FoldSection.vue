<script setup lang="ts">
import { ref } from 'vue'

// 可以折疊的清單區塊：標題點一下收起或展開；收起的狀態記在這個瀏覽器（下次打開還是收起）
const props = withDefaults(defineProps<{
  /** 記住折疊狀態用的 key（例如 tavern.candidates） */
  id: string
  title: string
  /** 標題後面顯示的數量 */
  count?: number
  level?: 'h3' | 'h4'
}>(), { level: 'h4', count: undefined })

const KEY = 'elondia.folds'

function readFolds(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

const open = ref(!readFolds()[props.id])

function toggle() {
  open.value = !open.value
  try {
    const folds = readFolds()
    if (open.value) delete folds[props.id]
    else folds[props.id] = true
    localStorage.setItem(KEY, JSON.stringify(folds))
  } catch {
    // 記不住也沒關係
  }
}
</script>

<template>
  <div class="fold" :class="{ closed: !open }">
    <component :is="level" class="fold-head">
      <button class="fold-toggle" :aria-expanded="open" :title="open ? '收起' : '展開'" @click="toggle">
        <span class="caret">{{ open ? '▾' : '▸' }}</span>
        <span>{{ title }}</span>
        <span v-if="count !== undefined" class="count muted">（{{ count }}）</span>
      </button>
      <slot name="extra" />
    </component>
    <div v-show="open" class="fold-body"><slot /></div>
  </div>
</template>

<style scoped>
.fold { display: grid; gap: 6px; min-width: 0; }
.fold-body { display: grid; gap: 6px; min-width: 0; }
.fold-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 10px 0 2px; }
h4.fold-head { color: var(--accent-2); font-size: 0.95rem; }
h3.fold-head { margin: 0 0 4px; }
.fold-toggle {
  background: none; border: none; padding: 0; color: inherit; font: inherit; cursor: pointer;
  display: inline-flex; align-items: baseline; gap: 4px; text-align: left;
}
.fold-toggle:hover .caret, .fold-toggle:hover { color: var(--accent); }
.caret { display: inline-block; width: 1em; font-size: 0.8em; }
.count { font-size: 0.85em; font-weight: normal; }
</style>
