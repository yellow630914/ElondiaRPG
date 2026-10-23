<script setup lang="ts">
import { computed } from 'vue'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'

// 升級：能力三選一、屬性點在角色詳情裡處理
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ 'open-party': [member: string] }>()
const game = useGame()
const m = computed(() => game.state?.party.find((x) => x.id === props.id))
</script>

<template>
  <section v-if="m" class="panel level-up">
    <h3 class="title"><GameIcon name="sparkles" :size="16" />{{ m.name }}升到 Lv.{{ m.level }}</h3>
    <p class="small">
      <template v-if="m.pendingAbilityChoices?.length">有 {{ m.pendingAbilityChoices.length }} 項能力要從三個選項裡挑一個。</template>
      <template v-if="m.attrPoints > 0">還有 {{ m.attrPoints }} 點屬性可以分配。</template>
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
