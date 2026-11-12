<script setup lang="ts">
import { computed } from 'vue'
import type { SceneRole } from '@/engine/data'
import { LANDMARK_EFFECTS, LANDMARK_LIMITS } from '@/engine/landmarkMods'
import { wearChoices } from '@/engine/gear'
import EffectsEditor from './EffectsEditor.vue'
import NameListInput from './NameListInput.vue'
import CheckList from './CheckList.vue'
import { BODY_OPTIONS } from './checks'
import Hint from '../ui/Hint.vue'

// 地標場景（或走進內部）的身分（docs/LANDMARKS.md 第 6.1 節）：隊伍裡符合條件的人才能參加，每個人各得到效果
const role = defineModel<SceneRole | undefined>()
const props = defineProps<{ label: string; hint: string }>()
const wearOptions = computed(() => wearChoices())

function toggle(on: boolean) {
  role.value = on ? { name: '參加的人', wear: [], effects: [] } : undefined
}
function flag(k: 'lactating' | 'can_lactate' | 'brood' | 'pc_only', on: boolean) {
  if (!role.value) return
  if (on) role.value[k] = true
  else delete role.value[k]
}
</script>

<template>
  <div class="role">
    <label class="check small"><input type="checkbox" :checked="!!role" @change="toggle(($event.target as HTMLInputElement).checked)" /> {{ props.label }} <Hint :text="props.hint" /></label>
    <template v-if="role">
      <div class="grid">
        <label>身分的稱呼 <input v-model="role.name" :maxlength="LANDMARK_LIMITS.role_name_chars" placeholder="例如：乳牛" /></label>
        <label>曝露度至少 <input :value="role.exposure ?? 0" type="number" min="0" max="3" @input="role.exposure = Math.max(0, Math.min(3, Math.floor(Number(($event.target as HTMLInputElement).value) || 0))) || undefined" /></label>
      </div>
      <CheckList v-model="role.body" label="只給這些體型" hint="看參加的那個人自己的體型；都不勾＝都可以。只勾陰柔、中性時，設定打開「陽剛體型也能遇到『只給陰柔、中性』的成人內容」的玩家，陽剛體型的人一樣能當。" :options="BODY_OPTIONS" />
      <div class="row small">限定穿著 <Hint text="這些都穿在身上的人才能當這個身分。寫底材時任何一件同種的服裝都算。" /> <NameListInput v-model="role.wear" :options="wearOptions" placeholder="底材或物品名稱" /></div>
      <div class="row checks small">
        <label class="check"><input type="checkbox" :checked="!!role.lactating" @change="flag('lactating', ($event.target as HTMLInputElement).checked)" /> 正在泌乳</label>
        <label class="check"><input type="checkbox" :checked="!!role.can_lactate" @change="flag('can_lactate', ($event.target as HTMLInputElement).checked)" /> 身體會泌乳</label>
        <label class="check"><input type="checkbox" :checked="!!role.brood" @change="flag('brood', ($event.target as HTMLInputElement).checked)" /> 身上有苗床（只有主角）</label>
        <label class="check"><input type="checkbox" :checked="!!role.pc_only" @change="flag('pc_only', ($event.target as HTMLInputElement).checked)" /> 只有主角能當</label>
      </div>
      <div class="small">每個人各得到的效果（最多 {{ LANDMARK_LIMITS.effects }} 個） <Hint text="對象換成那個人；錢、物品照人數給；寄生物（苗床）只給主角，效果寫了苗床時只有主角能當，懷孕中或已經有了時按鈕停用。" />：<EffectsEditor v-model="role.effects" :types="LANDMARK_EFFECTS" /></div>
    </template>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.role { display: grid; gap: 6px; }
</style>
