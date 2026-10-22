<script setup lang="ts">
import { computed } from 'vue'
import { choosablePerks, perkRules, type PerkDef } from '@/engine/data'
import { racePerks } from '@/engine/perks'
import PerkBuilder from './PerkBuilder.vue'

// 建立角色時的特質：清單裡的不限數量任選，也可以自訂
const perks = defineModel<string[]>('perks', { required: true })
const custom = defineModel<PerkDef[]>('custom', { required: true })
const props = defineProps<{ race: string; cls: string }>()
const list = computed(() => choosablePerks().filter((p) =>
  !p.flaw && (!p.requires?.races?.length || p.requires.races.includes(props.race)) && (!p.requires?.classes?.length || p.requires.classes.includes(props.cls))))

function toggle(id: string) {
  perks.value = perks.value.includes(id) ? perks.value.filter((x) => x !== id) : [...perks.value, id]
}
function blocked(p: PerkDef): boolean {
  const own = perkRules.perks.filter((x) => perks.value.includes(x.id))
  return !perks.value.includes(p.id) && own.some((o) => o.exclusive?.includes(p.id) || p.exclusive?.includes(o.id))
}
</script>

<template>
  <div class="perks">
    <h3 class="small">🌟 特質（已選 {{ perks.length + custom.length }}）</h3>
    <p class="small muted">特質一直生效，影響檢定與戰鬥。建立角色時不限數量；之後可以靠升級、事件、特殊任務、受訓與書籍學會更多。</p>
    <div class="grid">
      <!-- 種族特質：依種族自動擁有，不能取消 -->
      <label v-for="p in racePerks(race)" :key="p.id" class="perk small on" :title="p.desc">
        <input type="checkbox" checked disabled />
        <span><b>{{ p.name }}</b> <span class="tag">種族</span><br /><span class="muted">{{ p.desc }}</span></span>
      </label>
      <label v-for="p in list" :key="p.id" class="perk small" :class="{ on: perks.includes(p.id) }" :title="p.desc">
        <input type="checkbox" :checked="perks.includes(p.id)" :disabled="blocked(p)" @change="toggle(p.id)" />
        <span><b>{{ p.name }}</b><br /><span class="muted">{{ p.desc }}</span></span>
      </label>
    </div>
    <details class="small">
      <summary>✏️ 自訂特質（{{ custom.length }}）</summary>
      <ul class="plain">
        <li v-for="(p, i) in custom" :key="p.id" class="row">
          <span><b>{{ p.name }}</b>：{{ p.desc }}</span>
          <button class="small" @click="custom = custom.filter((_, j) => j !== i)">×</button>
        </li>
      </ul>
      <PerkBuilder @add="(p) => (custom = [...custom, p])" />
    </details>
  </div>
</template>

<style scoped>
.perks { display: grid; gap: 6px; }
.perks h3, .perks p { margin: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px; }
.perk { display: flex; gap: 6px; align-items: flex-start; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
.perk.on { border-color: var(--accent); }
.row { display: flex; gap: 6px; align-items: center; justify-content: space-between; }
</style>
