<script setup lang="ts">
import { npcPerksOf, perksOf } from '@/engine/perks'
import { computed, reactive, ref, watch } from 'vue'
import { affinityStage } from '@/engine/character'
import { askingFor, proposeDc } from '@/engine/companions'
import { genderName, raceName, tagDef } from '@/engine/data'
import { isBound, partyMax, partyRoom } from '@/engine/party'
import { cellAt, CELL_NAME, cellName, currentArea, position } from '@/engine/grid'
import { affinityTable, itemValue, type InteractionKind } from '@/engine/interactions'
import { CURRENCY, formatMoney } from '@/engine/money'
import { npcTitle } from '@/engine/npcs'
import { isHostile, peopleHere, type PresentNpc } from '@/engine/population'
import type { NpcRecord } from '@/engine/types'
import { parseUse, useGame } from '@/stores/game'
import { floatText } from '@/fx/fx'
import { stateKey } from '@/fx/seen'
import AbilityPicker from './AbilityPicker.vue'
import JudgeToggle from './JudgeToggle.vue'
import FoldMenu from './ui/FoldMenu.vue'
import NameTag from './NameTag.vue'
import Avatar from './ui/Avatar.vue'
import GameIcon from './ui/GameIcon.vue'

// 這裡的人：和主角同一個地點、同一個地區的 NPC（見 docs/NPC_SYSTEM.md 第 7 節）
const game = useGame()
const s = computed(() => game.state!)
const people = computed(() => peopleHere(s.value))
const groups = computed(() => ([
  { key: 'staff', title: '店主與職員', icon: 'store', items: people.value.filter((p) => p.staff) },
  { key: 'adventurer', title: '冒險者', icon: 'sword', items: people.value.filter((p) => !p.staff && p.kind === 'adventurer') },
  { key: 'commoner', title: '普通人', icon: 'users', items: people.value.filter((p) => !p.staff && p.kind === 'commoner') },
] as const).filter((g) => g.items.length).map((g) => {
  const near = g.items.filter((p) => p.dist <= 1).length
  return { ...g, detail: near ? `身邊 ${near} 人` : '都不在身邊（要先走近）' }
}))
const where = computed(() => currentArea(s.value).name)
// 等待判定、或有擋住行動的事件（刻印、主人的要求、戰敗事件）時，互動按鈕停用
const busy = computed(() => !!s.value.pendingAction || game.judging || !!s.value.pendingMark || !!s.value.pendingMasterEvent || !!s.value.pendingDefeat)

// 換了地點：請 AI 潤飾這裡的居民（AI 判定開啟時，每個地點一次）
watch(() => s.value.location, () => void game.flavorRoster(), { immediate: true })

const open = ref<string | null>(null)
watch(people, (list) => {
  if (open.value && !list.some((p) => p.rec.id === open.value)) open.value = null
})

// 親密度變了：那個人的名字旁飄出愛心 +／碎心 −（讀檔、剛走到這裡不算）
const lineEls = new Map<string, Element>()
function lineRef(id: string, el: unknown) {
  if (el instanceof Element) lineEls.set(id, el)
  else lineEls.delete(id)
}
watch(() => [stateKey(game.state), people.value.map((p) => `${p.rec.id}=${rel(p.rec.id)?.affinity ?? ''}`)] as const, ([key, now], old) => {
  if (!old || old[0] !== key) return
  const before = new Map(old[1].map((x) => x.split('=') as [string, string]))
  for (const x of now) {
    const [id, v] = x.split('=') as [string, string]
    const b = before.get(id)
    if (!b || !v || b === v) continue
    const d = Number(v) - Number(b)
    floatText(lineEls.get(id), d > 0 ? `♥+${d}` : `💔${d}`, { color: d > 0 ? '#ff8cc8' : '#a89a84' })
  }
})
function rel(id: string) {
  return s.value.relationships?.[id]
}

function hostile(p: PresentNpc): boolean {
  return isHostile(s.value, p.rec)
}

/** 被制伏、等你處置的人：只能在戰後處置裡處理 */
function captive(p: PresentNpc): boolean {
  return !!s.value.captives?.npcs.includes(p.rec.id)
}

/** 遠處的人在哪裡：方向與格子 */
function whereIs(p: PresentNpc): string {
  const me = position(s.value)
  const dx = p.x - me.x
  const dy = p.y - me.y
  const dir = `${dx < 0 ? '西' : dx > 0 ? '東' : ''}${dy < 0 ? '北' : dy > 0 ? '南' : ''}`
  const cell = cellAt(currentArea(s.value), p.x, p.y)
  return `在${dir ? `${dir}方` : '這裡'}的${cell ? cellName(cell.kind) : '某處'}（${p.dist} 格）`
}

function attack(p: PresentNpc) {
  if (confirm(`偷襲${p.rec.name}？被人看到的話，這裡與${p.rec.name}常去的地方都會提高警戒、降低聲望。`)) interact('attack', p)
}

/** 帶到「主動行動」：選好對象，捲到主動行動面板 */
function toAction(p: PresentNpc) {
  game.actionTarget = p.rec.id
  document.querySelector('.action-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  document.querySelector<HTMLTextAreaElement>('.action-panel textarea:last-of-type')?.focus({ preventScroll: true })
}

function tagsOf(rec: NpcRecord) {
  return (rec.tags ?? []).map((t) => tagDef(t)).filter((t) => !!t)
}

// ---- 互動 ----
const text = reactive<Record<string, string>>({})
const gift = reactive<Record<string, string>>({})
const use = ref('')
const gifts = computed(() => s.value.inventory.filter((i) => i.qty > 0))

function interact(kind: InteractionKind, p: PresentNpc) {
  const id = p.rec.id
  const u = parseUse(use.value)
  void game.perform({
    kind, target: id, text: text[id] ?? '',
    ...(kind === 'gift' ? { item: gift[id] } : {}),
    ...(u ? { use: u } : {}),
  })
  text[id] = ''
  use.value = ''
}

function giftHint(rec: NpcRecord): string {
  const item = gift[rec.id]
  if (!item) return ''
  const t = affinityTable(s.value, 'gift', rec, item)
  return `價值 ${formatMoney(itemValue(s.value, item))}・成功時親密度 +${t.success}`
}

// ---- 雇用（只限冒險者） ----
const candidates = computed(() => {
  // 依存檔取得：雇用、還價、拒絕後即時更新
  const today = s.value.taverns?.[s.value.location]
  return today?.day === s.value.time.day ? today.candidates : []
})
const offers = reactive<Record<string, number>>({})
const hiring = ref<string | null>(null)
const partyFull = computed(() => partyRoom(s.value) < 1)
// 被主人帶著：雇用改成向主人提議（主人出錢，入隊後是主人的隊員）
const bound = computed(() => isBound(s.value))
const proposedToday = (id: string) => s.value.flags[`propose_no:${id}`] === s.value.time.day
function proposeDcOf(id: string): number | null {
  try {
    return proposeDc(s.value, { kind: 'hire', npc: id })
  } catch {
    return null
  }
}
async function propose(id: string) {
  await game.perform({ kind: 'propose', target: `hire:${id}`, text: text[id] ?? '' })
  text[id] = ''
  hiring.value = null
}

function candidateOf(id: string) {
  return candidates.value.find((c) => c.npc === id)
}

function startHire(id: string) {
  // 第一次查看時建立今天的候選名單
  if (!candidateOf(id)) game.tavernCandidates()
  const c = candidateOf(id)
  if (!c) return
  offers[id] ??= askingFor(c)
  hiring.value = hiring.value === id ? null : id
}

async function hire(id: string) {
  const c = candidateOf(id)
  if (!c) return
  await game.hire(id, Math.max(0, Math.floor(offers[id] ?? askingFor(c))), text[id] ?? '')
  hiring.value = null
}
</script>

<template>
  <section class="panel people">
    <div class="row head">
      <h3><GameIcon name="users" :size="18" />這裡的人 <span class="sub muted">{{ where }}・{{ people.length }} 人，身邊 {{ people.filter((p) => p.dist <= 1).length }} 人</span></h3>
      <JudgeToggle />
    </div>
    <p v-if="!people.length" class="small muted">這裡現在沒有別人。</p>

    <div>
    <FoldMenu v-for="g in groups" :id="`people.${g.key}`" :key="g.key" class="group" :icon="g.icon" :label="g.title" :detail="g.detail" :badge="g.items.length" open>
      <ul class="plain">
        <li v-for="p in g.items" :key="p.rec.id" :class="{ open: open === p.rec.id, far: p.dist > 1 }">
          <div :ref="(el) => lineRef(p.rec.id, el)" class="row line" @click="open = open === p.rec.id ? null : p.rec.id">
            <Avatar :id="p.rec.id" :size="28" />
            <NameTag :id="p.rec.id" />
            <span class="small muted">{{ npcTitle(p.rec) }}</span>
            <span v-if="captive(p)" class="tag small bad">被制伏</span>
            <span v-else-if="hostile(p)" class="tag small bad">敵對</span>
            <span v-if="p.dist > 1" class="tag">{{ p.dist }} 格</span>
            <span v-for="t in tagsOf(p.rec)" :key="t.name" class="tag small" :title="t.ai_hint">{{ t.emoji }}{{ t.name }}</span>
            <span v-if="rel(p.rec.id)" class="tag known" :title="`親密度 ${rel(p.rec.id)!.affinity}`"><GameIcon name="heart" :size="11" />{{ affinityStage(rel(p.rec.id)!.affinity) }}</span>
          </div>

          <div v-if="open === p.rec.id" class="detail small">
            <div class="muted">{{ genderName(p.rec.gender) }}・{{ raceName(p.rec.race) }}<template v-if="p.rec.lineage">（{{ p.rec.lineage }}）</template>・{{ npcTitle(p.rec) }} Lv.{{ p.rec.level }}</div>
            <div v-if="p.rec.appearance" class="muted">{{ p.rec.appearance }}</div>
            <div v-if="rel(p.rec.id)" class="muted">{{ p.rec.personality }}</div>
            <div v-if="rel(p.rec.id)" class="muted">特質：{{ perksOf({ perks: npcPerksOf(p.rec), race: p.rec.race }).map((x) => (x.flaw ? `${x.name}（缺陷）` : x.name)).join('、') }}</div>
            <div v-if="rel(p.rec.id)?.toPlayer" class="muted">與你：{{ rel(p.rec.id)!.toPlayer }}</div>

            <p v-if="captive(p)" class="muted">{{ p.rec.name }}被你制伏在地上，先在「戰後處置」決定怎麼處置（可以審問、劫財、放過、收為奴隸或處決）。</p>
            <p v-else-if="p.dist > 1" class="muted">{{ whereIs(p) }}。走到旁邊（相鄰的格子）才能互動。</p>
            <template v-else-if="!hostile(p)">
              <input v-model="text[p.rec.id]" placeholder="想說什麼、怎麼做（選填，會交給 AI 判定）" />
              <AbilityPicker v-model="use" />
              <div class="row acts">
                <button class="small" :disabled="busy" title="魅力檢定：聊得好會拉近關係，也可能聽到消息" @click="interact('chat', p)"><GameIcon name="message" :size="13" />聊天</button>
                <button class="small" :disabled="busy" title="在主動行動裡以這個人為對象，自由描述要做的事" @click="toAction(p)"><GameIcon name="d20" :size="13" />主動行動</button>
                <button v-if="p.kind === 'adventurer' && !p.staff" class="small" :disabled="busy || partyFull" @click="startHire(p.rec.id)">
                  <GameIcon name="hand" :size="13" />{{ hiring === p.rec.id ? '收起' : bound ? '向主人提議雇用' : '雇用' }}
                </button>
                <details class="more">
                  <summary class="small" title="獻媚、偷竊、偷襲" aria-label="更多互動"><GameIcon name="more" :size="16" /></summary>
                  <div class="more-list">
                    <button class="small" :disabled="busy" title="魅力檢定：奉承、討好；失敗會降低親密度，對貴族更難" @click="interact('flatter', p)">獻媚</button>
                    <button class="small" :disabled="busy" title="靈巧檢定：偷錢或東西；被發現會降低親密度，在城裡還會提高衛兵警戒、降低聲望" @click="interact('steal', p)">偷竊</button>
                    <button v-if="p.kind === 'adventurer' && !p.staff" class="small danger" :disabled="busy" title="靈巧檢定：成功就先手開戰；被看到會有衛兵與聲望的後果" @click="attack(p)">偷襲</button>
                  </div>
                </details>
              </div>
              <div class="row">
                <select v-model="gift[p.rec.id]" class="small">
                  <option :value="undefined">選擇禮物…</option>
                  <option v-for="i in gifts" :key="i.name" :value="i.name">{{ i.name }} ×{{ i.qty }}</option>
                </select>
                <button class="small" :disabled="busy || !gift[p.rec.id]" @click="interact('gift', p)"><GameIcon name="gift" :size="13" />送禮</button>
                <span class="muted">{{ giftHint(p.rec) }}</span>
              </div>

              <div v-if="hiring === p.rec.id && candidateOf(p.rec.id) && bound" class="hire">
                <span>要價 {{ formatMoney(askingFor(candidateOf(p.rec.id)!)) }}・主人出錢</span>
                <span v-if="proposedToday(p.rec.id)" class="muted">主人今天不想再聽你提這個人</span>
                <template v-else>
                  <span class="muted">魅力檢定，參考 DC {{ proposeDcOf(p.rec.id) ?? '—' }}（上面的文字是你怎麼說服主人）</span>
                  <button class="small primary" :disabled="busy" @click="propose(p.rec.id)">向主人提議（魅力檢定）</button>
                </template>
              </div>
              <div v-else-if="hiring === p.rec.id && candidateOf(p.rec.id)" class="hire">
                <span>要價 {{ formatMoney(askingFor(candidateOf(p.rec.id)!)) }}<template v-if="candidateOf(p.rec.id)!.counter_cc">（還價）</template></span>
                <span v-if="candidateOf(p.rec.id)!.declined" class="muted">今天不想再談了</span>
                <template v-else>
                  <label>出價（{{ CURRENCY.short }}）<input v-model.number="offers[p.rec.id]" type="number" min="0" step="5" /></label>
                  <button class="small primary" :disabled="(offers[p.rec.id] ?? 0) > s.money_cc || busy" @click="hire(p.rec.id)">
                    {{ (offers[p.rec.id] ?? 0) >= askingFor(candidateOf(p.rec.id)!) ? `雇用（${formatMoney(offers[p.rec.id] ?? 0)}）` : '提出條件（魅力檢定）' }}
                  </button>
                </template>
              </div>
            </template>
            <template v-else>
              <p class="muted">{{ p.rec.name }}對你充滿敵意。</p>
              <div class="row">
                <button class="small" :disabled="busy" @click="toAction(p)"><GameIcon name="d20" :size="13" />主動行動</button>
                <button class="small" :disabled="busy" @click="interact('steal', p)">偷竊</button>
                <button v-if="p.kind === 'adventurer' && !p.staff" class="small danger" :disabled="busy" @click="attack(p)">偷襲</button>
              </div>
            </template>
          </div>
        </li>
      </ul>
    </FoldMenu>
    </div>
    <p v-if="partyFull" class="small muted">隊伍已滿（{{ partyMax(s) }} 人），不能再雇人。</p>
  </section>
</template>

<style scoped>
.people .head { justify-content: space-between; }
.people h3 { margin: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.people h3 :deep(.game-icon) { color: var(--accent); }
.sub { font-size: var(--fs-xs); font-weight: normal; letter-spacing: 0; }
.acts button, .detail .row button { display: inline-flex; align-items: center; gap: 4px; }
/* 「⋯」：展開時把獻媚、偷竊、偷襲排在旁邊（同一列，放不下就換行），不浮在上面，才不會被摺疊區裁掉 */
.more { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.more > summary { list-style: none; cursor: pointer; padding: 2px 6px; color: var(--muted); border: 1px solid transparent; border-radius: 3px; }
.more > summary::-webkit-details-marker { display: none; }
.more > summary:hover, .more[open] > summary { color: var(--accent); border-color: var(--gold-lo); }
.more-list { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.more-list button { white-space: nowrap; }
.line { gap: 6px; cursor: pointer; flex-wrap: nowrap; min-width: 0; }
/* 名字太長時省略名字，標籤留在同一行 */
.line > * { flex-shrink: 0; }
.line > .name-tag, .line > .small.muted { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line > .name-tag { flex-shrink: 1; min-width: 3em; }
.line > .small.muted { flex-shrink: 100; }
.line > .name-tag :deep(.name) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.known { color: var(--accent); border-color: var(--gold-lo); }
.bad { color: var(--danger); border-color: var(--danger); }
li.far .line { opacity: 0.7; }
li.open { background: #c99a4510; outline: 1px solid var(--gold-lo); border-radius: 3px; padding: 6px; }
.detail { display: grid; gap: 4px; margin-top: 4px; grid-template-columns: minmax(0, 1fr); }
.detail input, .detail select { min-width: 0; }
.detail > input { width: 100%; }
.hire { display: grid; gap: 4px; padding: 6px; border: 1px dashed var(--border); border-radius: 6px; }
.hire label { display: grid; gap: 2px; }
</style>
