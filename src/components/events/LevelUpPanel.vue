<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'
import { sinkPending } from '@/engine/xpSinks'
import { progression } from '@/engine/data'

// 升級：能力三選一、屬性點在角色詳情裡處理
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ 'open-party': [member: string] }>()
const game = useGame()
const m = computed(() => game.state?.party.find((x) => x.id === props.id))
// 用經驗換來的（鑽研技能、苦練屬性）和升級給的分開寫
const sink = computed(() => (m.value ? sinkPending(m.value) : { ability: 0, attr: 0 }))
const lvAbility = computed(() => (m.value?.pendingAbilityChoices?.length ?? 0) - sink.value.ability)
const lvAttr = computed(() => Math.max(0, m.value?.attrPoints ?? 0) - sink.value.attr)
const fromLevel = computed(() => lvAbility.value > 0 || lvAttr.value > 0)
const names = progression.xp_sinks
</script>

<template>
  <section v-if="m" class="panel level-up">
    <h3 class="title"><GameIcon name="sparkles" :size="16" />{{ fromLevel ? `${m.name}升到 Lv.${m.level}` : `${m.name}用經驗換來的成長` }}</h3>
    <p class="small">
      <template v-if="lvAbility > 0">有 {{ lvAbility }} 項能力要從三個選項裡挑一個。</template>
      <template v-if="lvAttr > 0">還有 {{ lvAttr }} 點屬性可以分配。</template>
      <template v-if="sink.ability">{{ names.ability.name }}：有 {{ sink.ability }} 項新技能要從三個選項裡挑一個。</template>
      <template v-if="sink.attr">{{ names.attr.name }}：有 {{ sink.attr }} 點屬性可以分配。</template>
    </p>
    <div class="row">
      <button class="small primary" @click="emit('open-party', m.id)">到角色詳情選擇</button>
    </div>
  </section>
</template>

<style scoped>
.level-up { display: grid; gap: 6px; }
.level-up h3, .level-up p { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
</style>
