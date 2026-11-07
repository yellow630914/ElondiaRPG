<script setup lang="ts">
import { computed, ref } from 'vue'
import { classEmoji, companionRules, raceEmoji } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { leaderOf } from '@/engine/party'
import { gameRule } from '@/engine/gameRules'
import { ambushChance, autoHitDice, canCampHere, shortRestPreview, hitDiceLeft, hitDie, innCost, longRestBlocked, longRestGapHours, longRestWait, slaveRoomCost, slaveRoomOpen, waitText, type RestPlace } from '@/engine/rest'
import { bestTool } from '@/engine/tools'
import { fieldAbilities, fieldCastBlock, fieldTargets, fieldUsesLeft } from '@/engine/fieldCast'
import { slotsLeft } from '@/engine/character'
import { useGame } from '@/stores/game'
import JudgeToggle from './JudgeToggle.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

const game = useGame()
const s = computed(() => game.state!)
const cell = computed(() => game.cell)
const area = computed(() => game.area)
const rations = computed(() => s.value.inventory.find((i) => i.name === '乾糧')?.qty ?? 0)
const ambush = computed(() => ambushChance(game.state!))
// 行囊裡的露營類工具（帳篷）：紮營時的機率已經減半
const tent = computed(() => bestTool(s.value, 'camp'))
const shortHours = computed(() => gameRule(game.state, 'shortRestHours'))
// 短休按鈕的說明：時間・會怎樣・襲擊機率
const shortNote = computed(() => [`${shortHours.value} 小時`, shortRestPreview(s.value).note, ...(ambush.value ? [`襲擊 ${Math.round(ambush.value * 100)}%`] : [])])
const longHours = computed(() => gameRule(game.state, 'longRestHours'))
// 野外與旅途上：隊伍裡有人會紮營（特質【星夜露宿】）時可以紮營長休
const place = computed<RestPlace | null>(() => (cell.value.kind === 'inn' ? 'inn' : cell.value.kind === 'safe' ? 'safe' : area.value.kind === 'home' ? 'home' : canCampHere(s.value) ? 'camp' : null))
const blocked = computed(() => (place.value ? longRestBlocked(s.value, place.value) : null))
// 長休倒數（跟著遊戲時間更新）
const wait = computed(() => longRestWait(s.value))
const leaveMode = computed(() => s.value.pendingLeave?.mode)
const lowAffinity = computed(() =>
  s.value.party.filter((m) => !m.isPlayer && m.bond !== 'slave' && (m.affinity ?? 0) <= companionRules.leave_threshold),
)
const leader = computed(() => leaderOf(s.value))

// 長休時的互動
const talkText = ref('')
const talkTarget = ref('')
const companions = computed(() => s.value.party.filter((m) => !m.isPlayer))
const showTalk = ref(false)
// 戰鬥外施放治療、護盾類的能力（fieldCast.ts）
const casts = computed(() => s.value.party.flatMap((m) => fieldAbilities(m).map((a) => ({ key: `${m.id}|${a.id}`, member: m, ability: a }))))
const castPick = ref('')
const castTarget = ref('')
const showCast = ref(false)
const cur = computed(() => casts.value.find((c) => c.key === castPick.value) ?? casts.value[0])
const castTargets = computed(() => (cur.value ? fieldTargets(s.value, cur.value.member, cur.value.ability) : []))
const singleTarget = computed(() => cur.value && (cur.value.ability.target === 'ally' || cur.value.ability.target === 'ally_or_downed'))
const castBlock = computed(() => (cur.value ? fieldCastBlock(cur.value.member, cur.value.ability) : null))
/** 選項上的花費：法術寫剩幾個夠環的法術環，技能寫剩幾次 */
function castCost(c: { member: (typeof s.value.party)[number]; ability: { type: string; circle?: number } & Parameters<typeof fieldUsesLeft>[1] }): string {
  if (c.ability.type === 'spell') {
    const n = slotsLeft(c.member).slice((c.ability.circle ?? 1) - 1).reduce((a, b) => a + b, 0)
    return `${c.ability.circle ?? 1} 環以上・剩 ${n} 個法術環`
  }
  return `剩 ${fieldUsesLeft(c.member, c.ability)} 次`
}
function doCast() {
  const c = cur.value
  if (!c) return
  const target = singleTarget.value ? castTarget.value || castTargets.value.find((m) => m.hp < m.maxHp)?.id || castTargets.value[0]?.id : undefined
  void game.castOutsideCombat(c.member.id, c.ability.id, target)
}
async function doLongRest(where: RestPlace) {
  const text = talkText.value.trim()
  talkText.value = ''
  showTalk.value = false
  await game.longRest(where, text ? { text, ...(talkTarget.value ? { target: talkTarget.value } : {}) } : undefined)
}
</script>

<template>
  <section class="panel rest">
    <h3 class="head">
      <GameIcon name="bed" :size="16" />休息
      <Hint>
        <b>短休</b> {{ shortHours }} 小時：花生命骰回復生命值。<template v-if="ambush">這裡有 {{ Math.round(ambush * 100) }}% 的機率被襲擊。</template>
        <template v-if="place === 'inn'">{{ '\n' }}<b>長休</b>（住到隔天早上）：生命值、法術環全滿，回復一半生命骰。</template>
        <template v-else-if="place === 'safe'">{{ '\n' }}<b>長休</b>：安全房可以長休 {{ longHours }} 小時（每人 1 份乾糧，每間一次），短休也不會被襲擊。</template>
        <template v-else-if="place === 'home'">{{ '\n' }}<b>長休</b>：在自己家長休（住到隔天早上，免費），要有床。家具的舒適度夠高時，大家會睡得香甜（下次長休前戰鬥開始時獲得暫時生命、檢定 +1）。</template>
        <template v-else-if="place === 'camp'">{{ '\n' }}<b>紮營長休</b> {{ longHours }} 小時：隊伍裡有人會在野外紮營（星夜露宿），每人 1 份乾糧；<template v-if="ambush">有 {{ Math.round(ambush * 100) }}% 的機率被襲擊（被襲擊就沒睡成，乾糧不扣）。</template><template v-if="tent">已經算進行囊裡的{{ tent.name }}（機率減半）。</template><template v-else>帶帳篷時機率減半。</template></template>
        <template v-else>{{ '\n' }}長休要在旅店、地下城的安全房或自己的房子（隊伍裡有人有【星夜露宿】時，也可以在野外紮營）。</template>
        {{ '\n' }}兩次長休至少隔 {{ longRestGapHours() }} 小時。
      </Hint>
    </h3>
    <div class="dice">
      <span
        v-for="m in s.party" :key="m.id" class="tag"
        :title="`生命骰 d${hitDie(m)}，剩 ${hitDiceLeft(m)}/${m.level}${autoHitDice(m) ? `，短休會用 ${autoHitDice(m)} 顆` : ''}`"
      ><GameIcon name="heart" :size="12" />{{ m.name }} d{{ hitDie(m) }} × {{ hitDiceLeft(m) }}</span>
    </div>
    <div class="btns">
      <button @click="game.shortRest()"><GameIcon name="mug" :size="15" /><span class="btn-name">短休</span> <small><span v-for="(part, i) in shortNote" :key="i" class="seg">{{ part }}{{ i < shortNote.length - 1 ? '・' : '' }}</span></small></button>
      <button v-if="place === 'inn'" :disabled="!!blocked || s.money_cc < innCost(s)" @click="doLongRest('inn')"><GameIcon name="moon" :size="15" /><span class="btn-name">長休</span> <small>{{ formatMoney(innCost(s)) }}</small></button>
      <button
        v-if="place === 'inn' && slaveRoomOpen(s)" :disabled="!!blocked || s.money_cc < slaveRoomCost(s)"
        title="成人向：魅氣濃的城鎮，旅店有便宜的奴房。全隊照樣長休；主角被鎖在床頭過一夜（主角非自願），順從 +1，有機會學會色情技能，醒來時虛脫。"
        @click="doLongRest('slave_room')"
      ><GameIcon name="moon" :size="15" /><span class="btn-name">住奴房</span> <small>{{ formatMoney(slaveRoomCost(s)) }}</small></button>
      <!-- 旅店的長休在上面（另外可能有奴房）；不在旅店時才是下面這一串，最後一個是「不能長休」 -->
      <button v-if="place === 'safe'" :disabled="!!blocked || rations < s.party.length" @click="doLongRest('safe')"><GameIcon name="moon" :size="15" /><span class="btn-name">長休</span> <small>乾糧 {{ s.party.length }} 份</small></button>
      <button v-else-if="place === 'home'" :disabled="!!blocked" @click="doLongRest('home')"><GameIcon name="moon" :size="15" /><span class="btn-name">在家長休</span></button>
      <button v-else-if="place === 'camp'" :disabled="!!blocked || rations < s.party.length" :title="ambush ? `紮營時有 ${Math.round(ambush * 100)}% 的機率被襲擊（${tent ? `已算進${tent.name}，` : ''}被襲擊就沒睡成，乾糧不扣）` : ''" @click="doLongRest('camp')"><GameIcon name="moon" :size="15" /><span class="btn-name">紮營長休</span> <small>乾糧 {{ s.party.length }} 份</small></button>
      <button v-else-if="place !== 'inn'" disabled title="長休要在旅店、地下城的安全房或自己的房子"><GameIcon name="moon" :size="15" /><span class="btn-name">長休</span> <small>不在旅店</small></button>
    </div>
    <p v-if="blocked && place" class="small muted note">{{ blocked }}</p>
    <p v-else-if="wait > 0" class="small muted note"><GameIcon name="hourglass" :size="12" /> 還要 {{ waitText(wait) }}才能再長休。</p>
    <template v-if="place && !blocked">
      <button v-if="!showTalk" class="link more" @click="showTalk = true"><GameIcon name="plus" :size="12" /> 長休時順便做點什麼…</button>
      <div v-else class="talk small">
        <textarea v-model="talkText" rows="2" :placeholder="place === 'inn' ? '例如：睡前在旅店大廳和其他旅客聊天、陪莉娜看星星' : '例如：守夜時和隊友聊起各自的故鄉'" />
        <div class="row talk-row">
          <select v-model="talkTarget">
            <option value="">全體夥伴</option>
            <option v-for="m in companions" :key="m.id" :value="m.id">{{ raceEmoji(m.race) }}{{ m.name }}{{ classEmoji(m.class) }}</option>
            <option v-if="place === 'inn'" value="guests">同旅館的旅客</option>
          </select>
          <JudgeToggle />
          <Hint text="長休時想做的事（選填，算主動行動）。有寫互動時，長休和互動會合成一段經過。" />
        </div>
      </div>
    </template>

    <template v-if="casts.length">
      <button v-if="!showCast" class="link more" @click="showCast = true"><GameIcon name="plus" :size="12" /> 用能力治療、上護盾…</button>
      <div v-else class="talk small">
        <div class="row talk-row">
          <select v-model="castPick" aria-label="施放的能力">
            <option v-for="c in casts" :key="c.key" :value="c.key">{{ c.member.name }}・{{ c.ability.name }}（{{ castCost(c) }}）</option>
          </select>
          <select v-if="singleTarget" v-model="castTarget" aria-label="對象">
            <option value="">自動（傷最重的人）</option>
            <option v-for="m in castTargets" :key="m.id" :value="m.id">{{ m.name }} {{ m.hp }}/{{ m.maxHp }}</option>
          </select>
          <button class="small" :disabled="!!castBlock" :title="castBlock ?? cur?.ability.desc" @click="doCast"><GameIcon name="sparkles" :size="13" /> 施放</button>
          <Hint text="戰鬥外用治療、護盾類的能力：回復量照戰鬥裡的公式，法術花法術環（用得到的最低環，高環會升環）；技能有「每次休息」次數的照那個算，其他技能兩次長休之間在戰鬥外最多用「每場戰鬥」的次數。護盾（臨時生命值）帶到下一場戰鬥，長休後消失。在主動行動「搭配能力」對夥伴使用時也是同樣的效果，再加上你描述的行為交給判定。" />
        </div>
        <p v-if="cur" class="muted">{{ cur.ability.desc }}<template v-if="castBlock"><br /><span class="warn">{{ castBlock }}</span></template></p>
      </div>
    </template>

    <p v-if="leaveMode && leader" class="small warn">下次休息時會{{ leaveMode === 'sneak' ? '偷偷離開' : '向' + leader.name + '正式道別並離開' }}隊伍。</p>
    <p v-if="lowAffinity.length" class="small warn">{{ lowAffinity.map((m) => m.name).join('、') }}對你積怨已深，下次休息時會離隊。</p>
  </section>
</template>

<style scoped>
.rest { padding: 12px 14px; }
.head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.head :deep(.game-icon) { color: var(--accent); }
.head .hint { margin-left: auto; }
.dice { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.dice .tag :deep(.game-icon) { color: var(--hp); }
.btns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.btns button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 8px; }
.btns small { color: var(--muted); font-size: var(--fs-xs); min-width: 0; }
/* 按鈕的名稱不斷行；說明太長時只在「・」後面換行（「・」前面不能斷行，所以接在前一段的尾巴） */
.btns .btn-name { white-space: nowrap; flex-shrink: 0; }
.btns .seg { white-space: nowrap; }
.note { margin: 6px 0 0; }
.more { margin-top: 8px; display: inline-flex; align-items: center; gap: 2px; }
.talk { display: grid; gap: 4px; margin-top: 8px; grid-template-columns: minmax(0, 1fr); }
.talk textarea { width: 100%; }
.talk-row { justify-content: space-between; }
.warn { color: var(--danger); margin: 6px 0 0; }
</style>
