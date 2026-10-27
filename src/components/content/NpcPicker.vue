<script setup lang="ts">
import { computed } from 'vue'
import { geography, npcs as namedNpcs } from '@/engine/data'

// 選幾位固定 NPC：已選的排成標籤（× 拿掉），從依地點分組的下拉選單加入（角色一多，整片勾選框太長）
const model = defineModel<string[] | undefined>()
const props = defineProps<{ label: string; exclude?: string[] }>()
const name = (id: string) => namedNpcs.find((n) => n.id === id)?.name ?? id
const groups = computed(() => {
  const by = new Map<string, { id: string; name: string }[]>()
  for (const n of namedNpcs) {
    if (model.value?.includes(n.id) || props.exclude?.includes(n.id)) continue
    const loc = geography.locations.find((l) => l.id === n.location)?.name ?? '其他'
    if (!by.has(loc)) by.set(loc, [])
    by.get(loc)!.push({ id: n.id, name: n.name })
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh-Hant'))
})
function add(e: Event) {
  const el = e.target as HTMLSelectElement
  if (el.value) model.value = [...new Set([...(model.value ?? []), el.value])]
  el.value = ''
}
function remove(id: string) {
  const list = (model.value ?? []).filter((x) => x !== id)
  model.value = list.length ? list : undefined
}
</script>

<template>
  <div class="row small picker">
    <span>{{ label }}</span>
    <span v-for="id in model ?? []" :key="id" class="tag chip">{{ name(id) }} <button class="x" :title="`拿掉${name(id)}`" @click="remove(id)">×</button></span>
    <select class="add" @change="add">
      <option value="">＋ 加入角色…</option>
      <optgroup v-for="[loc, list] in groups" :key="loc" :label="loc">
        <option v-for="n in list" :key="n.id" :value="n.id">{{ n.name }}</option>
      </optgroup>
    </select>
  </div>
</template>

<style scoped>
.picker { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.chip { display: inline-flex; gap: 4px; align-items: center; }
.x { padding: 0 4px; line-height: 1.2; }
.add { max-width: 200px; }
</style>
