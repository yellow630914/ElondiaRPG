<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGame } from '@/stores/game'
import { BROOD_KIND_NAME, broodBirthOptions, broodOf, OFFSPRING_FATES, type OffspringFate } from '@/engine/brood'
import { parasiteDef } from '@/engine/parasites'

// 苗床長到支配：產下（docs/FAMILY.md 第 13 節）。卵生排出魔物卵、胎生像生產一樣（幼體當場處理）、寄生排出或共生。一定會產下，不會死
const game = useGame()
const ev = computed(() => game.state?.pendingBroodBirth)
const def = computed(() => (ev.value ? parasiteDef(ev.value.parasite) : undefined))
const brood = computed(() => (ev.value ? broodOf(ev.value.parasite) : undefined))
const options = computed(() => (game.state ? broodBirthOptions(game.state) : []))
const fate = ref<OffspringFate>('nest')
const INTRO: Record<string, string> = {
  egg: '肚子裡的卵已經成熟，一顆一顆往下擠，非排出來不可了。',
  live: '腹中的東西開始一陣一陣地翻動，牠們要出來了。',
  parasite: '體內的蟲子長大了，正在找出口。',
}
</script>

<template>
  <section v-if="ev && def && brood" class="panel brood">
    <h3 class="title">🪺 {{ def.name }}（{{ BROOD_KIND_NAME[brood.kind] }}）</h3>
    <p class="small">{{ INTRO[brood.kind] }}不管怎麼做都會平安產下；不順利只會更累。</p>
    <label v-if="brood.kind === 'live'" class="small field">生下的{{ brood.offspring?.name ?? '幼體' }}
      <select v-model="fate">
        <option v-for="(label, id) in OFFSPRING_FATES" :key="id" :value="id">{{ label }}</option>
      </select>
    </label>
    <div class="row">
      <button v-for="o in options" :key="o.id" class="small" :disabled="!!o.disabled" :title="o.disabled ?? ''" @click="game.answerBroodBirth(o.id, fate)">{{ o.label }}</button>
    </div>
  </section>
</template>

<style scoped>
.brood { display: grid; gap: 6px; border-color: var(--accent); }
.brood h3, .brood p { margin: 0; }
.field { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
