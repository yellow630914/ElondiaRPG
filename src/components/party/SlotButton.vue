<script setup lang="ts">
import { computed } from 'vue'
import { gearRules, gearSummary, slotNameFor } from '@/engine/gear'
import { lockedGear } from '@/engine/inventory'
import type { Character, GearSlot } from '@/engine/types'
import GameIcon from '../ui/GameIcon.vue'
import ItemIcon from '../items/ItemIcon.vue'
import { SLOT_ICON } from './memberInfo'
import { specRarity } from '../items/itemInfo'

// 紙娃娃的一格裝備欄
const props = defineProps<{ slotId: GearSlot; member: Character; selected: boolean; vacuum?: string; right?: boolean }>()
defineEmits<{ pick: [] }>()
const m = computed(() => props.member)
const g = computed(() => m.value.gear?.[props.slotId])
const name = computed(() => slotNameFor(props.slotId, m.value.race) ?? '額外飾品')
const icon = computed(() => SLOT_ICON[(gearRules.races[m.value.race]?.relabel?.[props.slotId]?.as as GearSlot | undefined) ?? props.slotId] ?? SLOT_ICON[props.slotId] ?? 'sparkles')
const blocked = computed(() => (gearRules.races[m.value.race]?.blocked ?? []).includes(props.slotId))
const locked = computed(() => lockedGear(m.value, props.slotId))
const rarity = computed(() => (g.value ? specRarity(g.value.spec) || 'common' : ''))
</script>

<template>
  <button
    class="slot ghost"
    :class="[{ sel: selected, filled: g, blocked, locked, right }, rarity ? `r-${rarity}` : '']"
    :title="blocked ? `${name}：這個種族無法使用` : g ? `${g.name}\n${gearSummary(g.spec)}` : vacuum ? `${name}：真空（${vacuum}，外面那件會走光，曝露度 +1）` : name"
    @click="$emit('pick')"
  >
    <span class="box">
      <ItemIcon v-if="g && !locked" :name="g.name" :spec="g.spec" :size="24" />
      <GameIcon v-else :name="locked ? 'lock' : icon" :size="20" />
    </span>
    <span class="txt"><span class="sn">{{ name }}</span><span class="in" :class="{ vacuum: !g && vacuum }">{{ blocked ? '無法使用' : g?.name ?? (vacuum ? '真空' : '—') }}</span></span>
  </button>
</template>

<style scoped>
.slot {
  display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 6px; align-items: center; padding: 3px; text-align: left;
  background: #0006; border: 1px solid #ffffff14; border-radius: 2px; color: #efe4cc;
}
.slot:hover:not(:disabled) { border-color: #c99a45; color: #efe4cc; }
.slot.sel { border-color: #f0d083; box-shadow: 0 0 0 1px #f0d083, 0 0 12px #f0d08355; }
.slot.blocked { opacity: 0.4; }
.box { width: 38px; height: 38px; display: grid; place-items: center; background: #120d09; border: 1px solid #000; box-shadow: inset 0 0 0 1px #5a4630; color: #4a3a28; }
.slot.filled .box { color: #e8d8b8; box-shadow: inset 0 0 0 1px #6d5128; }
.slot.locked .box { color: #d8604e; }
.txt { display: grid; min-width: 0; line-height: 1.3; }
.sn { font-size: var(--fs-xs); color: #9a8768; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.in { font-size: var(--fs-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.slot:not(.filled) .in { color: #6a5a44; }
.r-uncommon .box { color: var(--r-uncommon) !important; box-shadow: inset 0 0 0 1px var(--r-uncommon); }
.r-rare .box { color: var(--r-rare) !important; box-shadow: inset 0 0 0 1px var(--r-rare); }
.r-epic .box { color: var(--r-epic) !important; box-shadow: inset 0 0 0 1px var(--r-epic); }
.r-legendary .box { color: var(--r-legendary) !important; box-shadow: inset 0 0 0 1px var(--r-legendary); }
.slot.r-uncommon .in { color: var(--r-uncommon); } .slot.r-rare .in { color: var(--r-rare); }
.slot.r-epic .in { color: var(--r-epic); } .slot.r-legendary .in { color: var(--r-legendary); }
.in.vacuum { color: var(--accent); }
.slot.right { grid-template-columns: minmax(0, 1fr) 38px; text-align: right; }
.slot.right .box { order: 2; }
</style>
