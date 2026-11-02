<script setup lang="ts">
import { computed } from 'vue'
import { itemRules, type ItemCategory } from '@/engine/data'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import { CATEGORY_ORDER } from '../items/itemInfo'
import { categoryArt, refPath } from '../items/itemIcon'
import IconField from './IconField.vue'
import FoldSet from './FoldSet.vue'
import HelpText from './HelpText.vue'

// 類別圖示：8 種物品類別的預設圖示。沒有自己的圖、也不是裝備的物品用這裡的圖；換了立刻儲存
const content = useContent()
const game = useGame()

const edited = computed(() => Object.keys(content.mods.categoryIcons ?? {}).length > 0)
const iconOf = (c: ItemCategory) => content.mods.categoryIcons?.[c]?.icon
const builtin = (c: ItemCategory) => ({ kind: 'path' as const, path: refPath(categoryArt(c)) })

function set(c: ItemCategory, icon: string | undefined) {
  try {
    content.saveCategoryIcon(c, icon)
    // 存不進瀏覽器（容量滿了）時不要說成功：這次的修改關掉頁面就沒了
    if (content.persistFailed) game.error = '圖示存不進瀏覽器（容量滿了）：關掉頁面後就會消失。請移除一些圖示，或先匯出世界包備份'
    else game.flash(icon ? `已換上「${itemRules.categories[c]}」的圖示` : `「${itemRules.categories[c]}」換回內建的圖示`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm('把所有類別的圖示換回內建的？')) return
  content.restoreCategoryIcons()
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>🖼️ 類別圖示</h3>
      <span class="tag">{{ edited ? '已修改' : '內建' }}</span>
      <span class="spacer" />
      <button class="small" :disabled="!edited || content.readOnly" @click="restore">↩️ 類別圖示全部恢復預設</button>
    </div>
    <HelpText text="物品的圖示依序找：物品自己上傳的圖 → 裝備的底材圖（底材頁可以上傳）→ 這裡的類別圖。換了立刻儲存，存在這個世界裡。" />
    <p v-if="content.readOnly" class="small muted">原版世界不能直接修改：換圖示時會自動建立自己的世界並切換過去。</p>
    <FoldSet>
      <template #legend>類別</template>
      <div class="cats">
        <div v-for="c in CATEGORY_ORDER" :key="c" class="cat">
          <span class="name">{{ itemRules.categories[c] }}</span>
          <IconField :model-value="iconOf(c)" :fallback="builtin(c)" @update:model-value="set(c, $event)" />
        </div>
      </div>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px 16px; }
.cat { display: grid; gap: 2px; }
.name { font-weight: 600; }
</style>
