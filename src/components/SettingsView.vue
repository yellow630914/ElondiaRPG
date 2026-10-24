<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEFEAT_LOOT_NAME, defeatLootRule } from '@/engine/expedition'
import type { DefeatLoot } from '@/engine/types'
import { companionRules } from '@/engine/data'
import { gearRules } from '@/engine/gear'
import type { StepPlace } from '@/engine/grid'
import mapsJson from '@data/world/maps.json'
import { useGame } from '@/stores/game'
import { AI_FEATURES, NARRATE_KINDS, useSettings } from '@/stores/settings'
import ImageSettings from './ImageSettings.vue'
import RuleFields from './RuleFields.vue'
import { RULE_DEFS, type NumericRule } from '@/engine/gameRules'
import ModelSourceEditor from './ModelSourceEditor.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

const settings = useSettings()
// 走一格的時間：三種地方
const STEP_DEFAULT = mapsJson.generation.step_minutes
const STEP_PLACES: { id: StepPlace; name: string }[] = [{ id: 'settlement', name: '城鎮' }, { id: 'wild', name: '近郊' }, { id: 'dungeon', name: '冒險區域' }]
const game = useGame()
// 這個存檔的數值規則（沒有寫的是預設）
const saveRules = computed(() => Object.fromEntries((Object.keys(RULE_DEFS) as NumericRule[])
  .filter((k) => game.state?.options?.[k] !== undefined).map((k) => [k, game.state!.options![k]!])) as Partial<Record<NumericRule, number>>)
const source = ref(0)
// 設定分成幾個頁籤（記住上次看的那一頁）
const PAGES = [
  { id: 'models', label: '模型', icon: 'settings' },
  { id: 'images', label: '圖像', icon: 'image' },
  { id: 'narration', label: '敘事與判定', icon: 'sparkles' },
  { id: 'rules', label: '遊戲規則', icon: 'd20' },
  { id: 'save', label: '存檔', icon: 'save' },
] as const
type PageId = (typeof PAGES)[number]['id']
const PAGE_KEY = 'elondia.settingsPage'
function savedPage(): PageId {
  try {
    const v = localStorage.getItem(PAGE_KEY)
    return PAGES.some((p) => p.id === v) ? (v as PageId) : 'models'
  } catch {
    return 'models'
  }
}
const page = ref<PageId>(savedPage())
function openPage(id: PageId) {
  page.value = id
  try {
    localStorage.setItem(PAGE_KEY, id)
  } catch {
    // 無法記住時下次從第一頁開始
  }
}

function doReset() {
  if (confirm('確定要刪除目前的存檔？此動作無法復原。')) game.reset()
}
</script>

<template>
  <nav class="row tabs pages">
    <button v-for="p in PAGES" :key="p.id" :class="{ active: page === p.id }" @click="openPage(p.id)"><GameIcon :name="p.icon" :size="15" />{{ p.label }}</button>
    <!-- 介面語言：選項名稱各用自己的寫法，不轉換 -->
    <label class="ui-lang small">
      <GameIcon name="globe" :size="14" /> 語言
      <select v-model="settings.uiLanguage" data-no-convert>
        <option value="zh-Hant">繁體中文</option>
        <option value="zh-Hans">简体中文</option>
      </select>
    </label>
  </nav>

  <template v-if="page === 'models'">
    <section class="panel">
      <h2 class="head"><GameIcon name="settings" :size="20" />模型來源
        <Hint text="可以設定三個模型來源（例如一個擅長寫作的模型、一個便宜的模型），再在下方指定每個功能用哪一個。API key 只會存在這個瀏覽器的 localStorage，請求直接從瀏覽器送往你選擇的服務。請勿在共用電腦上保存 key。" />
      </h2>
      <nav class="row tabs">
        <button v-for="(s, i) in settings.sources" :key="i" :class="{ active: source === i }" @click="source = i">
          <span class="dot" :class="{ ready: settings.sourceReady(i) }" :title="settings.sourceReady(i) ? '已設定' : '未設定'" />{{ s.name }}
        </button>
      </nav>
      <ModelSourceEditor :key="source" :index="source" />
    </section>

    <section class="panel">
      <h2 class="head"><GameIcon name="shuffle" :size="20" />功能分配
        <Hint :text="`只有「敘事正文」${settings.adult ? '與「成人場景正文」' : ''}會寫出日誌裡的正文，適合用寫作能力好的模型；其他功能只輸出 JSON，可以改用便宜、快速的模型。`" />
      </h2>
      <table class="routes small">
        <tbody>
          <tr v-for="f in AI_FEATURES.filter((x) => x.id !== 'adult' || settings.adult)" :key="f.id">
            <td class="name"><GameIcon :name="f.prose ? 'edit' : 'code'" :size="14" :title="f.prose ? '寫正文' : '只輸出 JSON'" /> {{ f.name }}</td>
            <td>
              <select v-model.number="settings.routes[f.id]">
                <option v-for="(s, i) in settings.sources" :key="i" :value="i">{{ s.name }}{{ settings.sourceReady(i) ? '' : '（未設定）' }}</option>
              </select>
            </td>
            <td class="muted">{{ f.desc }}</td>
          </tr>
        </tbody>
      </table>
      <label class="check small" :class="{ muted: settings.sourceIndex('judge') !== settings.sourceIndex('narration') }">
        <input v-model="settings.judgeWritesNarrative" type="checkbox" :disabled="settings.sourceIndex('judge') !== settings.sourceIndex('narration')" />
        判定時順便寫出經過（判定與敘事正文同一個來源時才有效；省一次呼叫，但經過不是用敘事正文的提示詞寫的）
      </label>
      <p class="small note">
        <template v-if="settings.splitJudgeNarrative()">
          主動行動：先由「{{ settings.sourceFor('judge').name }}」判定（只回傳 JSON），再由「{{ settings.sourceFor('narration').name }}」用敘事正文的提示詞寫出經過（每次兩次呼叫）。
        </template>
        <template v-else>主動行動：由「{{ settings.sourceFor('judge').name }}」判定時順便寫出經過（每次一次呼叫）。</template>
      </p>
    </section>

  </template>

  <ImageSettings v-if="page === 'images'" />

  <template v-if="page === 'narration'">

    <section class="panel">
      <h2 class="head"><GameIcon name="sparkles" :size="20" />敘事與判定</h2>
      <div class="form">
        <div class="field-row">
          <label class="check"><input v-model="settings.aiNarration" type="checkbox" /> AI 細節描述</label>
          <Hint text="開啟：下列種類的日誌產生後，自動請「敘事正文」的模型寫出詳細經過。
關閉：不自動呼叫 AI（AI 判定的主動行動除外），戰鬥直接顯示戰報，其他事件顯示簡述。每則日誌都可以從右上角的「⋯」手動寫出經過。" />
        </div>
        <div class="kinds">
          <label v-for="k in NARRATE_KINDS" :key="k.id" class="check small" :title="k.desc">
            <input v-model="settings.narrateKinds[k.id]" type="checkbox" /> {{ k.name }}
            <span class="muted">{{ k.desc }}</span>
          </label>
        </div>
        <div class="field-row">
          <label class="check"><input v-model="settings.aiJudge" type="checkbox" /> AI 判定主動行動</label>
          <Hint text="開啟：主動行動（談判、雇傭、殺價、邀請、逃離……）先擲骰，再把骰值與完整資料交給 AI，由 AI 決定成敗（可能出乎預料），經過再交給敘事正文寫出；各地居民、商店的交易清單與談判方式也由 AI 設計。
關閉：依規則判定（預設屬性與參考 DC）。" />
        </div>
        <label>
          AI 的輸出語言
          <select v-model="settings.language">
            <option value="zh-Hant">繁體中文</option>
            <option value="zh-Hans">简体中文</option>
          </select>
        </label>
        <label>
          <span class="lab">世界書注入字數上限 <Hint text="文風、世界書條目與其他提示詞在畫面上方的「提示詞」頁籤調整，也可以在那裡預覽送出的內容。" /></span>
          <input v-model.number="settings.loreBudget" type="number" min="2000" step="1000" style="width: 140px" />
        </label>
        <label class="check">
          <input v-model="settings.adult" type="checkbox" /> 成人向：注入成人向世界書條目（敘事傾向、情色喜劇法則等），並開啟成人向的事件（例如主人的性邀約）
        </label>
        <p v-if="settings.adult" class="small muted">請確認你使用的 AI 服務的使用政策允許此類內容；不允許時模型可能拒絕生成。</p>
      </div>
    </section>

  </template>

  <template v-if="page === 'rules'">
    <section v-if="game.state" class="panel">
      <h2 class="head"><GameIcon name="d20" :size="20" />這個存檔的規則</h2>
      <div class="form">
        <label><span class="lab">在地下城戰敗時，這趟探索撿到、還沒帶出去的物品與錢 <Hint text="離開地下城（啟程旅行）就算帶出去了。這個規則存在存檔裡，每個存檔可以不一樣。" /></span>
          <select :value="defeatLootRule(game.state)" @change="game.setDefeatLoot(($event.target as HTMLSelectElement).value as DefeatLoot)">
            <option v-for="(n, k) in DEFEAT_LOOT_NAME" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <RuleFields :model-value="saveRules" @update:model-value="game.setRules" />
      </div>
    </section>

    <section class="panel">
      <h2 class="head"><GameIcon name="sliders" :size="20" />遊戲規則</h2>
      <div class="form">
        <label>
          <span class="lab">升級時能力三選一的重抽次數（每組） <Hint text="0 表示不能重抽。只影響之後的重抽，已經用掉的次數照算。" /></span>
          <input v-model.number="settings.abilityRerolls" type="number" min="0" max="99" style="width: 100px" />
        </label>
        <label>
          <span class="lab">兩次長休至少隔幾小時 <Hint :text="`0～24，預設 ${companionRules.rest.long_rest_gap_hours}。從上次長休結束時算起。`" /></span>
          <input v-model.number="settings.longRestGap" type="number" min="0" max="24" style="width: 100px" />
        </label>
        <div class="field">
          <span class="lab">走一格花幾分鐘 <Hint :text="`0～60。預設：城鎮 ${STEP_DEFAULT.settlement}、近郊 ${STEP_DEFAULT.wild}、冒險區域 ${STEP_DEFAULT.dungeon} 分鐘。時間影響白天黑夜、光源的燃料與委託的期限。房子裡照城鎮算，特殊地圖照冒險區域算；旅途一格一天，不受影響。`" /></span>
          <div class="steps">
            <label v-for="p in STEP_PLACES" :key="p.id">{{ p.name }} <input v-model.number="settings.stepMinutes[p.id]" type="number" min="0" max="60" style="width: 72px" /> 分</label>
          </div>
        </div>
        <label>
          <span class="lab">建角時挑裝備的預算（材料等級點數） <Hint :text="`0～${gearRules.creation.max_budget}，預設 ${gearRules.creation.default_budget}。職業的基本配備免費；把模板裝備換成更好的材料每升一級花 1 點，另外加的裝備花它的材料等級（第 ${gearRules.creation.max_tier} 級以內）。只影響之後建立的角色。`" /></span>
          <input v-model.number="settings.creationGearBudget" type="number" min="0" :max="gearRules.creation.max_budget" style="width: 100px" />
        </label>
      </div>
    </section>

  </template>

  <section v-if="page === 'save'" class="panel">
    <h2 class="head"><GameIcon name="save" :size="20" />存檔</h2>
    <p v-if="!game.state" class="small muted">還沒有開始冒險。</p>
    <p class="small muted">目前的進度會自動存在瀏覽器中。存檔欄位、快速存檔、匯出與匯入檔案在右上角的「存讀檔」。</p>
    <div v-if="game.state" class="row">
      <button class="danger" @click="doReset">放棄目前的進度並回到開始畫面</button>
    </div>
    <p class="small muted">存檔欄位裡的存檔不會被刪除。</p>
    <h3 class="head"><GameIcon name="book" :size="17" />日誌瘦身</h3>
    <div class="form">
      <label>
        <span class="lab">完整保留最近幾則日誌 <Hint text="超過時，更早的日誌每 50 則整理一次：只留時間、地點、簡述與 AI 寫的經過（在日誌最上方「顯示封存的舊紀錄」），隊伍快照、經過的時間軸與變化清單拿掉，讓存檔不會越來越大。token 用量不會因此變少：封存的日誌的用量另外合計，日誌上方會分開顯示。" /></span>
        <input v-model.number="settings.logKeep" type="number" min="50" max="5000" step="50" style="width: 120px" />
      </label>
      <p v-if="game.state" class="small muted">目前：{{ game.state.reports.length }} 則完整的日誌、{{ game.state.logArchive?.length ?? 0 }} 則封存的紀錄。</p>
    </div>
  </section>
</template>

<style scoped>
.ui-lang { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; color: var(--muted); }
.form { display: grid; gap: 12px; max-width: 560px; }
.tabs { gap: 6px; margin-bottom: 10px; }
.tabs button { display: inline-flex; align-items: center; gap: 6px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.head { display: flex; align-items: center; gap: 6px; }
.head :deep(.game-icon) { color: var(--accent); }
.lab { display: inline-flex; align-items: center; gap: 4px; }
.field-row { display: flex; align-items: center; gap: 6px; }
.dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid var(--muted); display: inline-block; }
.dot.ready { background: var(--good); border-color: var(--good); }
.routes .name :deep(.game-icon) { color: var(--accent); }
.pages { position: sticky; top: 0; z-index: 1; background: var(--bg); padding: 4px 0; flex-wrap: wrap; }
.routes { border-collapse: collapse; width: 100%; }
.routes td { border-bottom: 1px solid var(--border); padding: 6px 8px 6px 0; vertical-align: top; }
.routes .name { white-space: nowrap; font-weight: 600; }
.note { color: var(--accent-2); }
.kinds { display: grid; gap: 4px; padding-left: 22px; }
.kinds .muted { margin-left: 4px; }
.form label, .form .field { display: grid; gap: 4px; }
.form label.check { display: flex; gap: 6px; align-items: center; }
.steps { display: flex; flex-wrap: wrap; gap: 12px; }
.form .steps label { display: inline-flex; gap: 6px; align-items: center; }
</style>
