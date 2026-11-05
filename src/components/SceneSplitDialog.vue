<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SCENE_MAX_MANUAL } from '@/narrator/sceneInfo'
import AppDialog from './AppDialog.vue'

// 手動分段插圖：列出正文的段落，在想插圖的段落後面勾選（最多 SCENE_MAX_MANUAL 張）。
// 已經有插圖、而且對得上的位置預先勾好；按「畫插圖」時只畫新勾的位置，取消勾選的位置的插圖會刪掉。
const props = defineProps<{ open: boolean; paragraphs: string[]; existing: number[] }>()
const emit = defineEmits<{ close: []; draw: [after: number[]] }>()

const picked = ref(new Set<number>())
watch(() => props.open, (o) => {
  if (o) picked.value = new Set(props.existing)
}, { immediate: true })

const added = computed(() => [...picked.value].filter((a) => !props.existing.includes(a)).length)
const removed = computed(() => props.existing.filter((a) => !picked.value.has(a)).length)
const full = computed(() => picked.value.size >= SCENE_MAX_MANUAL)

function toggle(i: number) {
  const s = new Set(picked.value)
  if (s.has(i)) s.delete(i)
  else if (!full.value) s.add(i)
  picked.value = s
}
function draw() {
  emit('draw', [...picked.value].sort((a, b) => a - b))
  emit('close')
}
</script>

<template>
  <AppDialog :open="open" title="手動分段插圖" icon="image" width="720px" @close="emit('close')">
    <p class="small muted">在想放插圖的段落後面點一下「在這裡插圖」（最多 {{ SCENE_MAX_MANUAL }} 張）。每個位置畫一張，畫的是上一張之後到這一段為止最有代表性的一刻。已經有插圖的位置預先勾好，留著不重畫；取消勾選的會刪掉。</p>
    <ol class="paras">
      <li v-for="(p, i) in paragraphs" :key="i">
        <p class="para">{{ p }}</p>
        <button
          type="button" class="small slot" :class="{ on: picked.has(i), had: existing.includes(i) }"
          :disabled="!picked.has(i) && full" :aria-pressed="picked.has(i)" @click="toggle(i)"
        >{{ picked.has(i) ? (existing.includes(i) ? '🖼️ 這裡有插圖（留著）' : '🖼️ 在這裡插圖') : '＋ 在這裡插圖' }}</button>
      </li>
    </ol>
    <div class="row foot">
      <span class="small muted">已選 {{ picked.size }} 個位置<template v-if="added">・新畫 {{ added }} 張</template><template v-if="removed">・刪掉 {{ removed }} 張</template></span>
      <span class="spacer" />
      <button class="small" @click="emit('close')">取消</button>
      <button class="small primary" :disabled="!added && !removed" @click="draw">{{ added ? `畫 ${added} 張插圖` : '套用' }}</button>
    </div>
  </AppDialog>
</template>

<style scoped>
.paras { list-style: none; padding: 0; margin: 6px 0; display: grid; gap: 6px; max-height: 60vh; overflow: auto; }
.para { margin: 0; white-space: pre-wrap; line-height: 1.7; font-size: var(--fs-sm); }
.slot { margin-top: 4px; width: 100%; border-style: dashed; opacity: 0.75; }
.slot.on { border-style: solid; opacity: 1; background: var(--gold-lo, #c9a24a33); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.foot { border-top: 1px dashed var(--border); padding-top: 8px; }
.spacer { flex: 1; }
</style>
