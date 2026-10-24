<script setup lang="ts">
// 建立角色的體態：體型（陽剛、陰柔、中性，不選時依種族與性別）與各部位（身高、壯碩程度、胸部、腰身……）。
// 詞條和 NPC 的外貌同一套（data/world/npc_traits.json），會寫成外貌的開頭，交給 AI 描寫主角。
import { computed, watch } from 'vue'
import { genderId } from '@/engine/look'
import { Rng } from '@/engine/rng'
import { BODIES, BODY_NAME, bodyOf, describeLook, LOOK_PARTS, lookOptions, npcTraits, rollLookParts, type Body } from '@/engine/traits'
import Hint from './ui/Hint.vue'
import GameIcon from './ui/GameIcon.vue'

const props = defineProps<{ race: string; gender: string }>()
const body = defineModel<Body | ''>('body', { required: true })
const look = defineModel<Record<string, string>>('look', { required: true })

const gid = computed(() => genderId(props.gender))
const autoBody = computed(() => bodyOf(props.race, gid.value))
const effective = computed<Body>(() => body.value || autoBody.value)
const parts = computed(() => LOOK_PARTS.map((id) => ({ id, name: npcTraits.part_names[id] ?? id, options: lookOptions(id, effective.value, props.race, gid.value) })).filter((p) => p.options.length))
const preview = computed(() => describeLook(look.value))

function set(part: string, v: string) {
  const next = { ...look.value }
  if (v) next[part] = v
  else delete next[part]
  look.value = next
}

// 換種族、性別、體型時，拿掉現在不能選的詞條
watch([effective, () => props.race, gid], () => {
  const keep = Object.fromEntries(Object.entries(look.value).filter(([k, v]) => lookOptions(k, effective.value, props.race, gid.value).includes(v)))
  if (Object.keys(keep).length !== Object.keys(look.value).length) look.value = keep
})

function randomize() {
  look.value = rollLookParts(new Rng(Math.floor(Math.random() * 2 ** 31)), props.race, gid.value ?? '', effective.value)
}
</script>

<template>
  <div class="look">
    <div class="row top">
      <label class="lab">體型
        <select :value="body" @change="body = ($event.target as HTMLSelectElement).value as Body | ''">
          <option value="">依種族與性別（{{ BODY_NAME[autoBody] }}）</option>
          <option v-for="b in BODIES" :key="b" :value="b">{{ BODY_NAME[b] }}</option>
        </select>
      </label>
      <Hint text="決定可以選的部位詞條，以及角色視窗的人形圖。各部位不選就不寫；選了的會寫在外貌的開頭，交給 AI 描寫主角。" />
      <button type="button" class="small" @click="randomize"><GameIcon name="shuffle" :size="13" /> 隨機一組</button>
      <button type="button" class="small ghost" :disabled="!Object.keys(look).length" @click="look = {}">清除</button>
    </div>
    <div class="parts">
      <label v-for="p in parts" :key="p.id" class="part">
        <span class="pn">{{ p.name }}</span>
        <select :value="look[p.id] ?? ''" @change="set(p.id, ($event.target as HTMLSelectElement).value)">
          <option value="">（不指定）</option>
          <option v-for="o in p.options" :key="o" :value="o">{{ o }}</option>
        </select>
      </label>
    </div>
    <p v-if="preview" class="small preview"><span class="muted">寫進外貌：</span>{{ preview }}</p>
  </div>
</template>

<style scoped>
.look { display: grid; gap: 6px; }
.top { gap: 8px; }
.lab { display: inline-flex; gap: 6px; align-items: center; }
.parts { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); column-gap: 16px; }
.part { display: grid; grid-template-columns: 5.5em minmax(0, 1fr); align-items: center; gap: 6px; padding: 2px 0; }
.pn { font-weight: 600; font-size: var(--fs-sm); white-space: nowrap; }
.part select { width: 100%; min-width: 0; }
.preview { margin: 0; }
</style>
