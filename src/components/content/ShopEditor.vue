<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { locationById, npcs as namedNpcs, npcTags, shopRules, type ShopType } from '@/engine/data'
import { builtinShop, type ShopMod } from '@/engine/shopMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'

// 內建商店的編輯表單：圖示、描述、AI 特別商品、店主設定。店名、店種、上架的物品類型與店的專屬功能不能改
const props = defineProps<{ id: string }>()
const content = useContent()
const game = useGame()

interface Draft { emoji: string; desc: string; ai: boolean; title: string; tags: string[] }
function current(): Draft {
  void content.version
  const d = shopRules.types[props.id as ShopType]!
  return { emoji: d.emoji, desc: d.desc, ai: d.ai, title: d.keeper.title, tags: [...(d.keeper.tags ?? [])] }
}
const draft = ref<Draft>(current())
const saved = ref(JSON.stringify(draft.value))
watch(() => props.id, () => {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
})
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const def = computed(() => {
  void content.version
  return shopRules.types[props.id as ShopType]!
})
const edited = computed(() => !!content.mods.shops?.[props.id])
// 擔任這種店店主的固定 NPC（在固定 NPC 頁設定）
const keepers = computed(() => {
  void content.version
  return namedNpcs.filter((n) => n.keeper === props.id).map((n) => `${n.name}（${locationById(n.location).name}）`)
})
const tagList = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name] as const)

function toggleTag(t: string, on: boolean) {
  const set = new Set(draft.value.tags)
  if (on) set.add(t)
  else set.delete(t)
  draft.value.tags = [...set]
}
function save() {
  try {
    const m: ShopMod = { emoji: draft.value.emoji, desc: draft.value.desc, ai: draft.value.ai, keeper: { title: draft.value.title, tags: draft.value.tags } }
    content.saveShop(props.id, m)
    draft.value = current()
    saved.value = JSON.stringify(draft.value)
    game.flash(`已儲存「${def.value.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${def.value.name}」恢復成內建的樣子？`)) return
  content.restoreShop(props.id)
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
</script>

<template>
  <div class="editor">
    <div class="row head">
      <h3>{{ draft.emoji }} {{ def.name }}</h3>
      <span class="tag">{{ edited ? '內建・已修改' : '內建' }}</span>
      <span v-if="dirty" class="tag warn">未儲存</span>
      <span class="spacer" />
      <button class="small primary" :disabled="!dirty" @click="save">💾 儲存</button>
      <button class="small" :disabled="!dirty" @click="draft = current()">放棄修改</button>
      <button class="small" :disabled="!edited" @click="restore">↩️ 恢復預設</button>
    </div>
    <p class="small muted">id：{{ id }}。內建的店只能改這裡列出的項目；店名、上架的物品類型（{{ def.catalog_tag }}）與店的專屬功能不能改，也不能刪除。</p>
    <fieldset>
      <legend>外觀</legend>
      <div class="grid">
        <label>圖示 <input v-model="draft.emoji" maxlength="8" /></label>
      </div>
      <label class="block">描述（商店畫面上的說明）<textarea v-model="draft.desc" rows="2" maxlength="200" /></label>
      <label class="check small"><input v-model="draft.ai" type="checkbox" /> AI 判定開啟時，請 AI 設計今天的特別商品（關掉就只有規則的商品）</label>
    </fieldset>
    <fieldset>
      <legend>店主</legend>
      <div class="grid">
        <label>職稱 <input v-model="draft.title" maxlength="8" /></label>
      </div>
      <div class="row small">
        <span class="muted">身分標籤（生成的店主帶這些標籤）：</span>
        <label v-for="[k, n] in tagList" :key="k" class="check"><input type="checkbox" :checked="draft.tags.includes(k)" @change="toggleTag(k, ($event.target as HTMLInputElement).checked)" /> {{ n }}</label>
      </div>
      <p class="small muted">改了之後，新生成的店主才會用新的職稱與標籤；已經登場的店主不變。要指定某個地點的店主，到「固定 NPC」設定「擔任店主」。</p>
      <p v-if="keepers.length" class="small">目前擔任這種店店主的固定 NPC：{{ keepers.join('、') }}</p>
    </fieldset>
  </div>
</template>

<style scoped src="./editor.css"></style>
