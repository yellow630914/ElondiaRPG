<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GEAR_SET_MAX, GEAR_SET_SLOTS, planGearSet, slotMode, wornGearSet, type GearSetMode } from '@/engine/gearSets'
import { EXTRA_SLOTS, slotNameFor } from '@/engine/gear'
import type { Character, GearSlot } from '@/engine/types'
import { useGame } from '@/stores/game'
import GameIcon from '../ui/GameIcon.vue'
import Hint from '../ui/Hint.vue'

// 套裝（engine/gearSets.ts；docs/ITEMS.md 2.3 節）：紙娃娃上方一列。點一套先看會換掉什麼，確認後一次換好；
// 管理：改名、用現在穿的覆蓋、刪除、每一格換成這件／脫掉／不動
const props = defineProps<{ member: Character }>()
const game = useGame()
const s = computed(() => game.state!)
const m = computed(() => props.member)
const sets = computed(() => m.value.gearSets ?? [])
const inCombat = computed(() => !!s.value.combat)
const busy = computed(() => inCombat.value || game.judging || !!s.value.pendingAction)
const worn = computed(() => {
  void s.value.time.minute
  return wornGearSet(m.value)
})

// 預覽
const pending = ref<number | null>(null)
const rows = computed(() => {
  void s.value.time.minute
  void s.value.inventory.length
  return pending.value === null || !sets.value[pending.value] ? [] : planGearSet(s.value, m.value.id, pending.value)
})
const count = (st: string) => rows.value.filter((r) => r.status === st).length
const STATUS_TEXT: Record<string, string> = { put: '換上', off: '脫掉', same: '一樣' }
function apply() {
  if (pending.value === null) return
  game.applyGearSet(m.value.id, pending.value)
  pending.value = null
}
watch(() => m.value.id, () => { pending.value = null; managing.value = false })

// 管理
const managing = ref(false)
const pick = ref(0)
const nameDraft = ref('')
const picked = computed(() => sets.value[pick.value])
watch([pick, () => picked.value?.name], () => (nameDraft.value = picked.value?.name ?? ''), { immediate: true })
watch(() => sets.value.length, (n) => { if (pick.value >= n) pick.value = Math.max(0, n - 1) })
/** 管理時列的格子：一般的欄位都列，額外飾品欄只列套裝寫了的 */
const manageSlots = computed(() => GEAR_SET_SLOTS.filter((x) => !EXTRA_SLOTS.includes(x) || picked.value?.slots[x]))
const slotName = (slot: GearSlot) => slotNameFor(slot, m.value.race)
function save() {
  const i = game.saveGearSet(m.value.id)
  if (typeof i === 'number') { managing.value = true; pick.value = i }
}
function setMode(slot: GearSlot, mode: string) {
  game.setGearSetSlot(m.value.id, pick.value, slot, mode as GearSetMode)
}
function overwrite() {
  if (confirm(`用${m.value.name}現在穿的覆蓋「${picked.value!.name}」？`)) game.overwriteGearSet(m.value.id, pick.value)
}
function remove() {
  if (!confirm(`刪除套裝「${picked.value!.name}」？`)) return
  if (pending.value === pick.value) pending.value = null
  game.deleteGearSet(m.value.id, pick.value)
}
</script>

<template>
  <div class="gearsets">
    <div class="setbar">
      <b class="lab">套裝 <Hint :text="`把身上的裝備存成一套，之後一鍵換上（約 15 分鐘）。每人最多 ${GEAR_SET_MAX} 套；鎖住的裝備不會存進去，也不會被換掉。戰鬥中不能換。`" /></b>
      <button
        v-for="(set, i) in sets" :key="i" class="small chip" :class="{ cur: worn === i, on: pending === i }"
        :title="worn === i ? '現在穿的和這一套一樣' : '看看會換掉什麼'" @click="pending = pending === i ? null : i"
      ><span v-if="worn === i" class="dot" aria-hidden="true" />{{ set.name }}</button>
      <button class="small ghost" :disabled="inCombat || sets.length >= GEAR_SET_MAX" :title="sets.length >= GEAR_SET_MAX ? `每人最多 ${GEAR_SET_MAX} 套` : ''" @click="save">＋ 存成套裝</button>
      <button v-if="sets.length" class="small manage-btn" :class="{ on: managing }" @click="managing = !managing"><GameIcon name="settings" :size="12" /> 管理套裝</button>
    </div>
    <p v-if="!sets.length" class="muted small">還沒有套裝。穿好之後按「＋ 存成套裝」，之後一鍵換上。</p>

    <div v-if="pending !== null && sets[pending]" class="preview">
      <div class="row head">
        <b>換上「{{ sets[pending]!.name }}」</b>
        <span class="small muted">換 {{ count('put') }} 件・脫 {{ count('off') }} 件・換不了 {{ count('skip') }} 件</span>
      </div>
      <div class="tblwrap">
        <table class="diff small">
          <thead><tr><th>欄位</th><th>現在</th><th /><th>換成</th><th /></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.slot">
              <td>{{ r.label }}</td>
              <td>{{ r.now ?? '（空）' }}</td>
              <td class="muted">→</td>
              <td>{{ r.want === null ? '脫掉' : r.want }}</td>
              <td><span class="st" :class="r.status">{{ r.status === 'skip' ? `${r.reason}，沒換` : STATUS_TEXT[r.status] }}</span></td>
            </tr>
            <tr v-if="!rows.length"><td colspan="5" class="muted">這一套沒有寫任何格子。</td></tr>
          </tbody>
        </table>
      </div>
      <div class="row foot">
        <span class="small muted">約 15 分鐘{{ inCombat ? '・戰鬥中不能換' : '' }}</span>
        <button class="small" @click="pending = null">取消</button>
        <button class="small primary" :disabled="busy || !(count('put') + count('off'))" @click="apply">換上</button>
      </div>
    </div>

    <div v-if="managing && picked" class="manage">
      <div class="row">
        <select v-model.number="pick" aria-label="要管理的套裝">
          <option v-for="(set, i) in sets" :key="i" :value="i">{{ set.name }}</option>
        </select>
        <input v-model="nameDraft" maxlength="12" aria-label="套裝名稱" class="name" />
        <button class="small" :disabled="!nameDraft.trim() || nameDraft.trim() === picked.name" @click="game.renameGearSet(m.id, pick, nameDraft)">改名</button>
        <button class="small" :disabled="inCombat" @click="overwrite">用現在穿的覆蓋</button>
        <button class="small danger" @click="remove">刪除</button>
      </div>
      <div class="mslots small">
        <label v-for="slot in manageSlots" :key="slot">
          <span class="muted">{{ slotName(slot) }}</span>
          <span class="nm" :class="{ dim: slotMode(picked.slots[slot]) !== 'put' }" :title="picked.slots[slot]?.item ?? ''">
            {{ slotMode(picked.slots[slot]) === 'put' ? picked.slots[slot]!.item : slotMode(picked.slots[slot]) === 'off' ? '脫掉' : '不動' }}
          </span>
          <select :value="slotMode(picked.slots[slot])" :aria-label="slotName(slot)" @change="setMode(slot, ($event.target as HTMLSelectElement).value)">
            <option value="put" :disabled="!picked.slots[slot]?.item">換成這件</option>
            <option value="off">脫掉</option>
            <option value="keep">不動</option>
          </select>
        </label>
      </div>
      <p class="muted small">「不動」：換套裝時這一格保持原樣。存成套裝時，空著的格子是「不動」；要換上別的裝備，先穿好再按「用現在穿的覆蓋」。</p>
    </div>
  </div>
</template>

<style scoped>
.gearsets { grid-column: 1 / -1; display: grid; gap: 6px; }
.setbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius); background: color-mix(in srgb, currentColor 5%, transparent); }
.lab { display: inline-flex; align-items: center; gap: 4px; margin-right: 2px; }
.chip { display: inline-flex; align-items: center; gap: 4px; }
.chip.cur { box-shadow: inset 0 0 0 2px var(--good); }
.chip.on, .manage-btn.on { border-color: var(--accent); color: var(--accent); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--good); }
.ghost { border-style: dashed; background: transparent; }
.manage-btn { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
p { margin: 0; }
.preview, .manage { border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 10px; display: grid; gap: 6px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.head { justify-content: space-between; }
.foot { justify-content: flex-end; }
.foot .muted { margin-right: auto; }
.tblwrap { overflow-x: auto; }
.diff { width: 100%; border-collapse: collapse; }
.diff th { text-align: left; color: var(--muted); font-weight: 600; padding: 3px 6px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.diff td { padding: 3px 6px; border-bottom: 1px dashed color-mix(in srgb, currentColor 15%, transparent); white-space: nowrap; }
.st { font-size: var(--fs-xs); border-radius: 9px; padding: 0 6px; border: 1px solid; }
.st.put { color: var(--good); }
.st.off { color: #b7862a; }
.st.same { color: var(--muted); }
.st.skip { color: var(--danger); }
.name { width: 9em; }
.danger { color: var(--danger); }
.mslots { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 4px 12px; }
.mslots label { display: grid; grid-template-columns: 70px minmax(0, 1fr) auto; gap: 6px; align-items: center; }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nm.dim { color: var(--muted); }
.mslots select { font-size: var(--fs-xs); padding: 1px 3px; }
</style>
