<script setup lang="ts">
// 主僕關係（bondStyle.ts；docs/COMPANIONS.md 2.8 節）：主人與奴隸的親密度夠高時，選兩人之間真正的關係。
// 契約視窗（主角是奴隸，對方是主人）與我的奴隸（主角是主人，對方是奴隸）共用。選了之後產生一則日誌，關掉對話框看經過。
import { computed } from 'vue'
import { BOND_STYLES, slaveryRules, type BondStyle } from '@/engine/data'
import { bondChoiceBlocked, bondStatus } from '@/engine/bondStyle'
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

const props = defineProps<{ npc: string; name: string }>()
const emit = defineEmits<{ done: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const st = computed(() => bondStatus(s.value, props.npc))
const rules = slaveryRules.bond_styles
const styles = computed(() => BOND_STYLES.map((id) => ({ id, ...rules.styles[id], blocked: bondChoiceBlocked(s.value, props.npc, id) })))
const lapsed = computed(() => !!st.value && st.value.chosen !== st.value.active)
const hint = `名義上是主人與奴隸，實際上兩人怎麼相處。親密度 ${rules.unlock_affinity} 以上可以和對方說開；掉到 ${rules.keep_affinity} 以下時退回名實相符，回到 ${rules.keep_affinity} 以上恢復。只影響故事與主奴事件（哪些事比較常發生、寫成什麼語氣，各關係另有專屬事件），契約的數值不變。不管哪一種關係，人物的言行都照各自的性格。`
function choose(id: BondStyle) {
  void game.setBond(props.npc, id)
  emit('done')
}
</script>

<template>
  <template v-if="st">
    <h4>
      <GameIcon name="heart" :size="14" /> 兩人的關係 <Hint :text="hint" />
      <span class="state small" :class="{ muted: !st.blocked && st.affinity >= st.unlock }">{{ st.blocked ?? (st.affinity >= st.unlock ? `和${name}夠親近了，可以說開` : `親密度 ${st.unlock} 以上才能說開（現在 ${st.affinity}）`) }}</span>
    </h4>
    <p v-if="lapsed" class="small warn">親密度掉到 {{ st.keep }} 以下，「{{ rules.styles[st.chosen].name }}」暫時失效；回到 {{ st.keep }} 以上就恢復。</p>
    <div class="bonds">
      <button
        v-for="b in styles" :key="b.id" class="bond" :class="{ on: b.id === st.chosen, locked: !!b.blocked && b.id !== st.chosen }"
        :disabled="!!b.blocked || game.judging" :title="b.id === st.chosen ? '' : b.blocked ?? ''" @click="choose(b.id)"
      >
        <span class="t"><GameIcon :name="b.id === st.chosen ? 'check' : b.blocked ? 'lock' : 'heart'" :size="14" />{{ b.name }}</span>
        <span class="d muted">{{ b.desc }}</span>
        <span v-if="b.id === st.chosen" class="cur small">現在的關係</span>
      </button>
    </div>
  </template>
</template>

<style scoped>
h4 { display: flex; align-items: center; gap: 6px; margin: 14px 0 6px; font-size: 0.95rem; }
h4 :deep(.game-icon) { color: var(--accent); }
.state { margin-left: auto; font-weight: 400; color: var(--accent-2); }
.state.muted { color: var(--good); }
.warn { color: var(--danger); margin: 0 0 6px; }
.bonds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.bond { display: grid; gap: 2px; align-content: start; text-align: left; white-space: normal; padding: 7px 9px; height: auto; }
.bond .t { display: flex; align-items: center; gap: 6px; font-weight: 800; }
.bond .t :deep(.game-icon) { color: var(--accent-2); }
.bond .d { font-size: var(--fs-xs); line-height: 1.5; }
.bond.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); opacity: 1; }
.bond .cur { color: var(--accent); }
.bond.locked { opacity: 0.55; }
@media (max-width: 560px) {
  .bonds { grid-template-columns: minmax(0, 1fr); }
}
</style>
