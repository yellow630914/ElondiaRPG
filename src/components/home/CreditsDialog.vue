<script setup lang="ts">
import credits from '@data/credits.json'
import AppDialog from '../AppDialog.vue'

// 素材授權與致謝：依 data/credits.json 列出第三方素材
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <AppDialog :open="open" title="素材授權與致謝" icon="info" width="820px" @close="emit('close')">
    <p class="small muted intro">本遊戲使用了以下素材，依各自的授權條款標示作者與來源。</p>
    <section v-for="sec in credits.sections" :key="sec.title" class="sec">
      <h3>{{ sec.title }}</h3>
      <table>
        <thead><tr><th>素材</th><th>作者</th><th>授權</th><th>用途</th></tr></thead>
        <tbody>
          <template v-for="it in sec.items" :key="it.name">
            <tr>
              <td><a v-if="'url' in it && it.url" :href="it.url" target="_blank" rel="noopener">{{ it.name }}</a><template v-else>{{ it.name }}</template></td>
              <td>{{ it.author }}</td>
              <td><span class="tag">{{ it.license }}</span></td>
              <td>{{ it.use }}</td>
            </tr>
            <tr v-if="'note' in it && it.note" class="note"><td colspan="4">{{ it.note }}</td></tr>
          </template>
        </tbody>
      </table>
    </section>
  </AppDialog>
</template>

<style scoped>
.intro { margin-top: 0; }
.sec { margin-top: 14px; }
.sec h3 { letter-spacing: 0.15em; margin-bottom: 4px; }
table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); table-layout: fixed; }
th { text-align: left; padding: 6px; border-bottom: 2px solid #4b3420; color: var(--muted); font-weight: 600; }
th:nth-child(1) { width: 36%; } th:nth-child(2) { width: 22%; } th:nth-child(3) { width: 16%; }
td { padding: 8px 6px; border-bottom: 1px dotted var(--border); vertical-align: top; overflow-wrap: anywhere; }
.note td { font-size: var(--fs-xs); color: var(--muted); padding-top: 0; }
</style>
