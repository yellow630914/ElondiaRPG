<script setup lang="ts">
import { computed } from 'vue'
import { choosablePerks, perkRules, type PerkDef } from '@/engine/data'
import { creationPerks, perkCategory, perkPower, PERK_CATEGORIES, racePerks } from '@/engine/perks'
import PerkBuilder from './PerkBuilder.vue'
import GameIcon from './ui/GameIcon.vue'
import ContentIcon from './icons/ContentIcon.vue'
import Hint from './ui/Hint.vue'
import FoldMenu from './ui/FoldMenu.vue'
import type { IconName } from './ui/iconPaths'

// 建立角色時的特質：清單裡的任選（perks.json 的 creation.slots 不是 0 時有名額），也可以自訂。
// 缺陷最多選兩個，每個多一個一般特質的名額。
const perks = defineModel<string[]>('perks', { required: true })
const custom = defineModel<PerkDef[]>('custom', { required: true })
const props = defineProps<{ race: string; cls: string }>()
const allowed = (p: PerkDef) => !p.requires?.perks?.length && (!p.requires?.races?.length || p.requires.races.includes(props.race)) && (!p.requires?.classes?.length || p.requires.classes.includes(props.cls))
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
const CAT_ICON: Record<string, IconName> = { social: 'message', explore: 'compass', combat: 'sword', body: 'heart', craft: 'book', bond: 'lock', lewd: 'fire', other: 'sparkles' }

/** 依分類分組：同一類的特質與缺陷放在同一個摺疊選單（只列有東西的分類；方案 A，R20 的 C5） */
const groups = computed(() => Object.keys(PERK_CATEGORIES)
  .map((id) => ({ id, name: PERK_CATEGORIES[id]!, perks: list.value.filter((p) => perkCategory(p) === id), flaws: flaws.value.filter((p) => perkCategory(p) === id) }))
  .filter((g) => g.perks.length || g.flaws.length))
/** 分類旁邊顯示已選的名字 */
const chosenIn = (items: PerkDef[]) => items.filter((p) => perks.value.includes(p.id)).map((p) => p.name)
function foldDetail(g: { perks: PerkDef[]; flaws: PerkDef[] }) {
  const chosen = chosenIn([...g.perks, ...g.flaws])
  const n = `${g.perks.length} 個可選${g.flaws.length ? `、缺陷 ${g.flaws.length}` : ''}`
  return chosen.length ? `${n}・已選 ${chosen.join('、')}` : n
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
      <GameIcon name="star" :size="15" />特質與缺陷（已選 {{ count.normal }}{{ count.slots !== null ? ` / ${count.slots}` : '' }}，缺陷 {{ count.flaws }} / {{ rules.max_flaws }}）
      <Hint :text="`特質一直生效，影響檢定與戰鬥。${rules.slots > 0 ? `一般特質最多 ${rules.slots} 個，每選一個缺陷多 ${rules.slots_per_flaw} 個名額。` : '一般特質不限個數。'}缺陷最多 ${rules.max_flaws} 個。種族特質自動擁有，不佔名額。`" />
    </h3>
    <div v-for="p in racePerks(race)" :key="p.id" class="race-perk small">
      <input type="checkbox" checked disabled /><ContentIcon kind="perk" :def="p" :size="18" /><strong>{{ p.name }}</strong><span class="tag">種族</span><span class="muted">{{ p.desc }}</span>
    </div>
    <h4 v-if="groups.length" class="sub small muted">依類別：每一類上面是特質、下面是缺陷（紅底）。<Hint :text="`缺陷最多 ${rules.max_flaws} 個${rules.slots > 0 ? '，每個多一個一般特質的名額' : ''}。之後可以靠受訓（有些可以）或事件克服。`" /></h4>
    <div class="folds">
      <FoldMenu
        v-for="g in groups" :key="g.id" :id="`newgame.perks.${g.id}`" :icon="CAT_ICON[g.id] ?? 'star'" :label="g.name"
        :detail="foldDetail(g)" :badge="chosenIn([...g.perks, ...g.flaws]).length || undefined" tone="gold"
      >
        <table class="perk-table">
          <thead><tr><th /><th /><th>名稱</th><th>效果</th><th class="num">強度</th></tr></thead>
          <tbody>
            <tr v-for="p in g.perks" :key="p.id" :class="{ on: perks.includes(p.id), off: blocked(p) }" @click="!blocked(p) && toggle(p.id)">
              <td class="pick"><input type="checkbox" :checked="perks.includes(p.id)" :disabled="blocked(p)" @click.stop @change="toggle(p.id)" /></td>
              <td class="ic"><ContentIcon kind="perk" :def="p" :size="18" /></td>
              <th>{{ p.name }}</th>
              <td class="desc">{{ p.desc }}</td>
              <td class="num">{{ perkPower(p) }}</td>
            </tr>
            <tr v-if="g.flaws.length" class="flaw-head"><td colspan="5"><GameIcon name="warning" :size="12" /> 缺陷（{{ count.flaws }} / {{ rules.max_flaws }}）</td></tr>
            <tr v-for="p in g.flaws" :key="p.id" class="flaw" :class="{ on: perks.includes(p.id), off: blocked(p) }" @click="!blocked(p) && toggle(p.id)">
              <td class="pick"><input type="checkbox" :checked="perks.includes(p.id)" :disabled="blocked(p)" @click.stop @change="toggle(p.id)" /></td>
              <td class="ic"><ContentIcon kind="perk" :def="p" :size="18" /></td>
              <th>{{ p.name }}</th>
              <td class="desc">{{ p.desc }}</td>
              <td class="num">{{ perkPower(p) }}</td>
            </tr>
          </tbody>
        </table>
      </FoldMenu>
    </div>
    <div class="folds one">
      <FoldMenu id="newgame.perks.custom" icon="edit" label="自訂特質" :detail="custom.map((p) => p.name).join('、') || '自己寫一個特質或缺陷'" :badge="custom.length || undefined" tone="gold">
        <table v-if="custom.length" class="perk-table">
          <tbody>
          <tr v-for="(p, i) in custom" :key="p.id" class="on">
            <td class="ic"><ContentIcon kind="perk" :def="p" :size="18" /></td>
            <th>{{ p.name }} <span v-if="p.flaw" class="tag bad">缺陷</span></th>
            <td class="desc">{{ p.desc }}</td>
            <td class="num">{{ perkPower(p) }}</td>
            <td><button class="small" @click="custom = custom.filter((_, j) => j !== i)">移除</button></td>
          </tr>
          </tbody>
        </table>
        <PerkBuilder allow-flaw @add="addCustom" />
        <p v-if="count.error" class="bad">{{ count.error }}</p>
      </FoldMenu>
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; gap: 6px; margin: 4px 0 0; }
.head :deep(.game-icon) { color: var(--accent); }
.perks { display: grid; gap: 6px; }
.perks p { margin: 0; }
.folds { display: grid; gap: 0 12px; align-items: start; }
/* 寬螢幕：摺疊選單兩欄並排（自訂特質那一欄維持整列） */
@media (min-width: 1100px) { .folds:not(.one) { grid-template-columns: 1fr 1fr; } }
.sub { margin: 0; font-weight: 400; display: flex; align-items: center; gap: 4px; }
.perk-table tr.flaw-head td { font-size: var(--fs-xs); color: var(--danger); font-weight: 600; padding-top: 8px; cursor: default; }
.perk-table tr.flaw { background: color-mix(in srgb, var(--danger) 7%, transparent); }
.perk-table tr.flaw.on th { color: var(--danger); }
.perk-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.perk-table thead th { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; text-align: left; padding: 2px 6px; border-bottom: 1px solid var(--border); }
.perk-table td, .perk-table tbody th { padding: 5px 6px; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); vertical-align: middle; text-align: left; }
.perk-table tbody th { white-space: nowrap; font-weight: 700; }
.perk-table .pick, .perk-table .ic { width: 1%; }
.perk-table .desc { color: var(--muted); max-width: 30em; }
.race-perk { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; padding: 2px 6px; }
.perk-table .num { width: 1%; text-align: right; white-space: nowrap; }
.perk-table tbody tr { cursor: pointer; }
.perk-table tr.on th { color: var(--accent); }
.perk-table tr.off { opacity: 0.5; cursor: not-allowed; }
.bad { color: var(--danger); }
</style>
