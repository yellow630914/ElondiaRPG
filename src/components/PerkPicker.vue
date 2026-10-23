<script setup lang="ts">
import { computed } from 'vue'
import { choosablePerks, perkRules, type PerkDef } from '@/engine/data'
import { creationPerks, racePerks } from '@/engine/perks'
import PerkBuilder from './PerkBuilder.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 建立角色時的特質：清單裡的任選（perks.json 的 creation.slots 不是 0 時有名額），也可以自訂。
// 缺陷最多選兩個，每個多一個一般特質的名額。
const perks = defineModel<string[]>('perks', { required: true })
const custom = defineModel<PerkDef[]>('custom', { required: true })
const props = defineProps<{ race: string; cls: string }>()
const allowed = (p: PerkDef) => (!p.requires?.races?.length || p.requires.races.includes(props.race)) && (!p.requires?.classes?.length || p.requires.classes.includes(props.cls))
const list = computed(() => choosablePerks().filter((p) => !p.flaw && allowed(p)))
const flaws = computed(() => choosablePerks().filter((p) => p.flaw && allowed(p)))
const picked = computed(() => [...perkRules.perks.filter((x) => perks.value.includes(x.id)), ...custom.value])
const count = computed(() => creationPerks(picked.value))
const rules = perkRules.creation

function toggle(id: string) {
  perks.value = perks.value.includes(id) ? perks.value.filter((x) => x !== id) : [...perks.value, id]
}
function blocked(p: PerkDef): boolean {
  if (perks.value.includes(p.id)) return false
  if (picked.value.some((o) => o.exclusive?.includes(p.id) || p.exclusive?.includes(o.id))) return true
  // 名額：缺陷最多 max_flaws 個；一般特質不超過名額
  const c = count.value
  return p.flaw ? c.flaws >= rules.max_flaws : c.slots !== null && c.normal >= c.slots
}
function addCustom(p: PerkDef) {
  const c = creationPerks([...picked.value, p])
  if (c.error) return
  custom.value = [...custom.value, p]
}
</script>

<template>
  <div class="perks">
    <h3 class="head small">
      <GameIcon name="star" :size="15" />特質（已選 {{ count.normal }}{{ count.slots !== null ? ` / ${count.slots}` : '' }}，缺陷 {{ count.flaws }} / {{ rules.max_flaws }}）
      <Hint :text="`特質一直生效，影響檢定與戰鬥。${rules.slots > 0 ? `一般特質有 ${rules.slots} 個名額，每選一個缺陷多 ${rules.slots_per_flaw} 個。` : '建立角色時一般特質不限數量。'}之後可以靠升級、事件、特殊任務、受訓與書籍學會更多。`" />
    </h3>
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
      <summary><GameIcon name="warning" :size="13" /> 缺陷（{{ count.flaws }} / {{ rules.max_flaws }}）</summary>
      <p class="muted">負面的特質，最多選 {{ rules.max_flaws }} 個{{ rules.slots > 0 ? `，每個多一個一般特質的名額` : '' }}。之後可以靠受訓（有些可以）或事件克服。</p>
      <div class="grid">
        <label v-for="p in flaws" :key="p.id" class="perk small" :class="{ on: perks.includes(p.id) }" :title="p.desc">
          <input type="checkbox" :checked="perks.includes(p.id)" :disabled="blocked(p)" @change="toggle(p.id)" />
          <span><b>{{ p.name }}</b> <span class="tag">缺陷</span><br /><span class="muted">{{ p.desc }}</span></span>
        </label>
      </div>
    </details>
    <details class="small">
      <summary><GameIcon name="edit" :size="13" /> 自訂特質（{{ custom.length }}）</summary>
      <ul class="plain">
        <li v-for="(p, i) in custom" :key="p.id" class="row">
          <span><b>{{ p.name }}</b><span v-if="p.flaw" class="tag">缺陷</span>：{{ p.desc }}</span>
          <button class="small" @click="custom = custom.filter((_, j) => j !== i)">×</button>
        </li>
      </ul>
      <PerkBuilder allow-flaw @add="addCustom" />
      <p v-if="count.error" class="bad">{{ count.error }}</p>
    </details>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 6px; }
.head :deep(.game-icon), summary :deep(.game-icon) { color: var(--accent); }
.perks { display: grid; gap: 6px; }
.perks h3, .perks p { margin: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px; }
.perk { display: flex; gap: 6px; align-items: flex-start; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; }
.perk.on { border-color: var(--accent); }
.perk input { flex-shrink: 0; } /* 說明換行時勾選框不要被擠扁 */
.row { display: flex; gap: 6px; align-items: center; justify-content: space-between; }
</style>
