<script setup lang="ts">
// 這一項在遊戲裡跟誰有關（物品：拿到與交出）、怎麼學到（特質）、怎麼出現（狀態、怪物）：只是說明，不擋刪除（engine/sources.ts）。
// 存檔後才會反映草稿的修改（索引跟著套用的內容重建）
import { computed } from 'vue'
import { itemObtainable, sourcesOf, type SourceKind } from '@/engine/sources'
import { useContent } from '@/stores/content'

const props = defineProps<{ kind: SourceKind; id: string }>()
const content = useContent()

const TEXT: Record<SourceKind, { label: string; none: string }> = {
  item: { label: '跟誰有關', none: '目前沒有任何地方給這件物品（商店、掉落、寶箱、採集、事件、任務、製作都沒有），遊戲裡拿不到。' },
  perk: { label: '怎麼學到', none: '目前沒有任何地方給這個特質（建立角色、升級、受訓、書籍、事件都沒有），遊戲裡學不到。' },
  status: { label: '怎麼出現', none: '目前沒有任何能力、物品或其他狀態會施加這個狀態，遊戲裡不會出現。' },
  enemy: { label: '在哪裡遇到', none: '目前沒有放在任何遭遇表、地下城、特殊地圖、任務或擂臺，遊戲裡遇不到。' },
}

const list = computed(() => {
  void content.version
  return sourcesOf(props.kind, props.id)
})
/** 一個能拿到的地方都沒有（物品只被「交出」也算） */
const missing = computed(() => {
  void content.version
  return !list.value.length || (props.kind === 'item' && !itemObtainable(props.id))
})
</script>

<template>
  <details v-if="list.length" class="sources small" open>
    <summary>🎁 {{ TEXT[kind].label }}（{{ list.length }}）</summary>
    <ul>
      <li v-for="s in list" :key="s">{{ s }}</li>
    </ul>
  </details>
  <p v-if="missing" class="sources small none">⚠️ {{ TEXT[kind].none }}</p>
</template>

<style scoped>
.sources { border: 1px dashed var(--border); border-radius: var(--radius); padding: 4px 8px; }
.sources summary { cursor: pointer; color: var(--accent-2); }
.sources ul { margin: 4px 0 0; padding-left: 18px; }
.none { color: var(--danger); }
</style>
