<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { mod } from '@/engine/character'
import { askingFor, invitable, marketsHere, partyOffersHere, waitChance } from '@/engine/companions'
import { className, combatRules, companionRules, genderName, raceName } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { npcRecord } from '@/engine/npcs'
import { isBound, leaderOf } from '@/engine/party'
import type { TavernCandidate } from '@/engine/types'
import { useGame } from '@/stores/game'
import MarketPanel from './MarketPanel.vue'
import NameTag from './NameTag.vue'

const game = useGame()
const s = computed(() => game.state!)
const candidates = ref<TavernCandidate[]>([])
const bound = computed(() => isBound(s.value))
const partyFull = computed(() => s.value.party.length >= combatRules.party_max)

function refresh() {
  candidates.value = game.tavernCandidates()
}

onMounted(async () => {
  refresh()
  await game.flavorTavern()
  refresh()
})

const visible = computed(() => {
  // 依存檔重新取：雇用、還價、拒絕後即時更新
  const today = s.value.taverns?.[s.value.location]
  const list = today && today.day === s.value.time.day ? today.candidates : candidates.value
  return list.filter((c) => !s.value.party.some((m) => m.id === c.npc))
})

const offers = reactive<Record<string, number>>({})
const approach = reactive<Record<string, string>>({})
const open = ref<string | null>(null)

function toggle(c: TavernCandidate) {
  open.value = open.value === c.npc ? null : c.npc
  offers[c.npc] ??= askingFor(c)
}

async function hire(c: TavernCandidate) {
  await game.hire(c.npc, Math.max(0, Math.floor(offers[c.npc] ?? askingFor(c))), approach[c.npc] ?? '')
  open.value = null
}

// ---- 組隊 ----
const offersHere = computed(() => partyOffersHere(s.value))
const leader = computed(() => leaderOf(s.value))
const chance = computed(() => Math.round(waitChance(s.value) * 100))


// ---- 邀請、黑市 ----
const inviteList = computed(() => invitable(s.value))
const inviteText = ref('')
const blackText = ref('')
const blackKnown = computed(() => marketsHere(s.value).some((m) => m.kind === 'black'))
const showBlack = ref(false)
</script>

<template>
  <div class="tavern">
    <p v-if="bound" class="small muted">身為奴隸，你只能在一旁看著主人和別人談話。</p>

    <template v-else>
      <h4>🧑‍🤝‍🧑 候選冒險者</h4>
      <p class="small muted">魅力（{{ mod(s.party[0]!.attrs.cha) >= 0 ? '+' : '' }}{{ mod(s.party[0]!.attrs.cha) }}）越高，來搭話的人越多、等級越高。出價低於要價時要談判；出價的影響最大，運氣好甚至能免費雇到人。</p>
      <p v-if="visible.length === 0" class="muted small">今天沒有人在等雇主。</p>
      <ul class="plain">
        <li v-for="c in visible" :key="c.npc" class="cand">
          <template v-if="npcRecord(s, c.npc)">
            <div class="row" style="justify-content: space-between">
              <NameTag :id="c.npc" />
              <span class="small muted">{{ genderName(npcRecord(s, c.npc)!.gender) }}・{{ raceName(npcRecord(s, c.npc)!.race) }}・{{ className(npcRecord(s, c.npc)!.class) }} Lv.{{ npcRecord(s, c.npc)!.level }}</span>
            </div>
            <div class="small muted">{{ npcRecord(s, c.npc)!.personality }}</div>
            <div v-if="npcRecord(s, c.npc)!.appearance" class="small muted">{{ npcRecord(s, c.npc)!.appearance }}</div>
            <div class="row small">
              <span>要價 {{ formatMoney(askingFor(c)) }}<template v-if="c.counter_cc">（還價）</template></span>
              <span v-if="c.declined" class="muted">今天不想再談了</span>
              <button v-else class="small" :disabled="partyFull" @click="toggle(c)">{{ open === c.npc ? '收起' : '談雇傭' }}</button>
            </div>
            <div v-if="open === c.npc" class="nego small">
              <label>出價（銅幣）<input v-model.number="offers[c.npc]" type="number" min="0" step="5" /></label>
              <label>談判方式（選填，會交給 AI 判定）<input v-model="approach[c.npc]" placeholder="例如：答應分他一成戰利品、請他喝酒" /></label>
              <button class="small primary" :disabled="(offers[c.npc] ?? 0) > s.money_cc || game.judging" @click="hire(c)">
                {{ (offers[c.npc] ?? 0) >= askingFor(c) ? `雇用（${formatMoney(offers[c.npc] ?? 0)}）` : '提出條件（魅力檢定）' }}
              </button>
            </div>
          </template>
        </li>
      </ul>
      <p v-if="partyFull" class="small muted">隊伍已滿（{{ combatRules.party_max }} 人）。</p>

      <h4>🚩 加入別人的隊伍</h4>
      <p v-if="leader" class="small muted">你正跟著{{ leader.name }}的隊伍。想離開的話，到地圖下方的「👥 隊伍」選擇離隊方式，會在下次休息時進行。</p>
      <template v-else>
        <p class="small muted">在酒館等其他隊伍邀請（{{ companionRules.wait_party.hours }} 小時，機率約 {{ chance }}%，受魅力與等級影響）。對方可能付簽約金給你。</p>
        <button class="small" :disabled="partyFull" @click="game.waitForParty()">等待組隊</button>
        <ul class="plain">
          <li v-for="o in offersHere" :key="o.id" class="cand small">
            <div><NameTag :id="o.leader" /> <span class="muted">Lv.{{ npcRecord(s, o.leader)?.level }}</span> 邀請你同行<template v-if="o.pay_cc">，願意付 {{ formatMoney(o.pay_cc) }}</template></div>
            <div v-if="o.members.length" class="muted">隊員：<template v-for="(id, i) in o.members" :key="id"><span v-if="i">、</span><NameTag :id="id" /></template></div>
            <div class="muted">{{ npcRecord(s, o.leader)?.personality }}</div>
            <div class="row">
              <button class="small primary" @click="game.acceptPartyOffer(o.id)">加入</button>
              <button class="small" @click="game.declinePartyOffer(o.id)">婉拒</button>
            </div>
          </li>
        </ul>
      </template>

      <template v-if="inviteList.length">
        <h4>✉️ 邀請認識的人</h4>
        <p class="small muted">需要親密度與魅力檢定。被婉拒後，要等下次長休才能再邀請。</p>
        <input v-model="inviteText" class="wide small" placeholder="邀請的方式（選填）" />
        <ul class="plain small">
          <li v-for="r in inviteList" :key="r.id" class="row">
            <span><NameTag :id="r.id" />（Lv.{{ r.level }}・親密度 {{ s.relationships?.[r.id]?.affinity }}）</span>
            <button class="small" :disabled="partyFull || game.judging" @click="game.perform({ kind: 'invite', target: r.id, text: inviteText }); inviteText = ''">邀請</button>
          </li>
        </ul>
      </template>

      <h4>🕶️ 黑市</h4>
      <template v-if="blackKnown">
        <button class="small" @click="showBlack = !showBlack">{{ showBlack ? '離開黑市' : '前往黑市' }}</button>
        <MarketPanel v-if="showBlack" kind="black" />
      </template>
      <template v-else>
        <p class="small muted">有些城鎮有不公開的奴隸買賣。向酒館裡的人打聽看看（魅力檢定，約 2 小時）。</p>
        <input v-model="blackText" class="wide small" placeholder="打聽的方式（選填）" />
        <button class="small" :disabled="game.judging" @click="game.perform({ kind: 'black_market', text: blackText }); blackText = ''">打聽黑市</button>
      </template>
    </template>
  </div>
</template>

<style scoped>
.tavern { display: grid; gap: 6px; }
.tavern > button { justify-self: start; }
h4 { margin: 10px 0 2px; color: var(--accent-2); font-size: 0.95rem; }
.cand { border-top: 1px solid var(--border); padding: 6px 0; display: grid; gap: 2px; }
.nego { display: grid; gap: 4px; padding: 6px; background: var(--panel-2); border-radius: 6px; }
.nego label { display: grid; gap: 2px; }
.wide { width: 100%; }
</style>
