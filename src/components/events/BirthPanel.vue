<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGame } from '@/stores/game'
import { birthOptions, birthPlaces, personOf, pregnancyOf } from '@/engine/pregnancy'

// 生產（docs/FAMILY.md 第 6 節）：選怎麼生、嬰兒的名字（空著照名字庫抽）、放在哪裡。不會死，嬰兒也不會有事
const game = useGame()
const pb = computed(() => game.state?.pendingBirth)
const mother = computed(() => (game.state && pb.value ? personOf(game.state, pb.value.mother) : undefined))
const preg = computed(() => (game.state && pb.value ? pregnancyOf(game.state, pb.value.mother) : undefined))
const options = computed(() => (game.state ? birthOptions(game.state) : []))
const places = computed(() => (game.state ? birthPlaces(game.state) : []))
const name = ref('')
const place = ref('')
const placeId = computed(() => place.value || places.value[0]?.id || '')
</script>

<template>
  <section v-if="pb && mother" class="panel birth">
    <h3 class="title">🍼 {{ mother.id === 'pc' ? '你要生了' : `${mother.name}要生了` }}</h3>
    <p class="small">
      {{ pb.wild ? '來不及趕到聚落，只能在這裡生了。' : '預產的日子到了。' }}
      父親：{{ preg?.father?.name ?? '父親不明' }}。不管怎麼生，母子都會平安；不順利只會讓產後虛弱久一點。
    </p>
    <label class="small field">孩子的名字 <input v-model="name" type="text" maxlength="16" placeholder="空著就照種族的名字庫取一個" /></label>
    <label class="small field">生下來之後放在
      <select v-model="place">
        <option v-for="p in places" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </label>
    <div class="row">
      <button v-for="o in options" :key="o.id" class="small" :disabled="!!o.disabled" :title="o.disabled ?? ''" @click="game.answerBirth(o.id, name, placeId === 'auto' ? undefined : placeId)">{{ o.label }}</button>
    </div>
  </section>
</template>

<style scoped>
.birth { display: grid; gap: 6px; border-color: var(--accent); }
.birth h3, .birth p { margin: 0; }
.field { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
