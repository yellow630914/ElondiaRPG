<script setup lang="ts">
import { computed } from 'vue'
import GameIcon from '../ui/GameIcon.vue'
import type { IconName } from '../ui/iconPaths'

// 建築的場景橫幅：有場景圖（src/assets/scenes/<種類>.png 或 .webp）就用圖，沒有時用依種類上色的佔位圖。
// 下方疊店名、店型標籤；插槽放在店名旁（例如「?」說明）。
const props = defineProps<{ kind: string; name: string; tag?: string; icon?: IconName }>()

const SCENES = import.meta.glob<string>('../../assets/scenes/*.{png,webp}', { eager: true, query: '?url', import: 'default' })
const image = computed(() => {
  const hit = Object.entries(SCENES).find(([path]) => path.replace(/^.*\//, '').replace(/\.\w+$/, '') === props.kind)
  return hit?.[1]
})

/** 佔位圖的配色：[底色, 光源色] */
const TINT: Record<string, [string, string]> = {
  tavern: ['#4a2410', '#e0902e'], inn: ['#1a2840', '#7a9ad8'], guild: ['#33240e', '#e0b050'], temple: ['#34301c', '#f4e4a8'],
  general: ['#33240f', '#b88a4c'], smithy: ['#38120a', '#f06a2a'], tailor: ['#18301c', '#78b068'], jeweler: ['#10303a', '#58c8d0'],
  magic: ['#26143c', '#b07ef0'], informant: ['#121218', '#7a7a9a'], wanderer: ['#2c2414', '#c8a868'],
}
const tint = computed(() => TINT[props.kind] ?? ['#2a2018', '#c99a45'])
</script>

<template>
  <div class="banner" :class="{ art: image }" :style="{ '--base': tint[0], '--glow': tint[1] }">
    <img v-if="image" :src="image" alt="" class="scene" />
    <template v-else>
      <span class="floor" />
      <GameIcon v-if="icon" :name="icon" class="big" />
    </template>
    <div class="plate">
      <h3>{{ name }}</h3>
      <span v-if="tag" class="tag">{{ tag }}</span>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.banner {
  position: relative; height: 112px; margin: -14px -16px 10px; overflow: hidden; border-bottom: 1px solid var(--gold-lo);
  background:
    radial-gradient(ellipse 60% 120% at 82% 30%, color-mix(in srgb, var(--glow) 45%, transparent), transparent 70%),
    repeating-linear-gradient(0deg, transparent 0 11px, #0000002a 11px 12px),
    linear-gradient(180deg, color-mix(in srgb, var(--base) 85%, #000), var(--base) 55%, #0a0806);
}
.banner::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, #000c); pointer-events: none; }
.scene { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
.floor { position: absolute; left: 0; right: 0; bottom: 0; height: 28px; background: repeating-linear-gradient(90deg, #0000004d 0 1px, transparent 1px 14px), linear-gradient(180deg, color-mix(in srgb, var(--base) 70%, #000), #050403); }
.big { position: absolute; right: 18px; top: 10px; width: 78px; height: 78px; color: var(--glow); opacity: 0.55; filter: drop-shadow(0 0 14px var(--glow)); }
.plate { position: absolute; left: 14px; bottom: 9px; right: 14px; z-index: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.plate h3 { margin: 0; font-size: var(--fs-xl); font-weight: 900; letter-spacing: 0.18em; color: var(--gold-hi); text-shadow: 0 2px 0 #000, 0 0 10px #000; }
.plate .tag { background: #0008; color: #e8d8b8; border-color: #ffffff30; }
.plate :deep(.hint) { color: #e8d8b8; }
</style>
