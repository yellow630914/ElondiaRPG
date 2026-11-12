<script setup lang="ts">
import { computed } from 'vue'
import { BIND_COMBAT_NOTE, bindDetail } from '@/engine/bindRulesMods'
import type { BindKind, LockGrade } from '@/engine/data'

// 拘束具的說明框內容（docs/LEWD_STATS.md 第 7 節）：平常的檢定減值、戰鬥中的增益、程度 3 的免疫、自帶的鎖
const props = defineProps<{ kind: BindKind; bind: number; lock?: LockGrade }>()
const d = computed(() => bindDetail(props.kind, props.bind, props.lock))
</script>

<template>
  <div v-if="d" class="bind-tip">
    <b class="title">{{ d.title }}</b><span class="muted small">（拘束的程度 1～3）</span>
    <table>
      <tbody>
        <tr>
          <th>平常</th>
          <td>{{ d.checks }} <b class="minus">{{ d.penalty ? `−${d.penalty}` : '不扣' }}</b><div class="small muted">每 {{ d.endurancePer }} 點忍耐減輕 1</div></td>
        </tr>
        <tr>
          <th>戰鬥中</th>
          <td><b v-if="d.combat" class="plus">{{ d.combat }}</b><span v-else class="muted">沒有增益</span></td>
        </tr>
        <tr v-if="d.immune.length"><th>免疫</th><td>{{ d.immune.join('、') }}</td></tr>
        <tr v-if="d.lock"><th>自帶的鎖</th><td>{{ d.lock.name }}（倍率 ×{{ d.lock.mult }}）：戴上就算鎖上</td></tr>
      </tbody>
    </table>
    <div class="note small">{{ BIND_COMBAT_NOTE }}</div>
  </div>
</template>

<style scoped>
.bind-tip { white-space: normal; }
.title { margin-right: 4px; }
table { width: 100%; border-collapse: collapse; margin: 4px 0; }
th { text-align: left; white-space: nowrap; vertical-align: top; padding: 2px 8px 2px 0; font-weight: 400; opacity: .75; }
td { padding: 2px 0; }
.minus { color: var(--danger); }
.plus { color: var(--good); }
.note { opacity: .75; line-height: 1.5; }
</style>
