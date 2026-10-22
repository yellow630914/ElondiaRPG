<script setup lang="ts">
import { ref } from 'vue'
import { DEFEAT_LOOT_NAME, defeatLootRule } from '@/engine/expedition'
import type { DefeatLoot } from '@/engine/types'
import { companionRules } from '@/engine/data'
import { useGame } from '@/stores/game'
import { AI_FEATURES, NARRATE_KINDS, useSettings } from '@/stores/settings'
import ImageSettings from './ImageSettings.vue'
import ModelSourceEditor from './ModelSourceEditor.vue'

const settings = useSettings()
const game = useGame()
const source = ref(0)
// 設定分成幾個頁籤（記住上次看的那一頁）
const PAGES = [
  { id: 'models', label: '🤖 模型' },
  { id: 'images', label: '🖼️ 圖像' },
  { id: 'narration', label: '✨ 敘事與判定' },
  { id: 'rules', label: '🎮 遊戲規則' },
  { id: 'save', label: '💾 存檔' },
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
    <button v-for="p in PAGES" :key="p.id" :class="{ active: page === p.id }" @click="openPage(p.id)">{{ p.label }}</button>
  </nav>

  <template v-if="page === 'models'">
    <section class="panel">
      <h2>🤖 模型來源</h2>
      <p class="small muted">
        可以設定三個模型來源（例如一個擅長寫作的模型、一個便宜的模型），再在下方指定每個功能用哪一個。
        API key 只會存在這個瀏覽器的 localStorage，請求直接從瀏覽器送往你選擇的服務。請勿在共用電腦上保存 key。
      </p>
      <nav class="row tabs">
        <button v-for="(s, i) in settings.sources" :key="i" :class="{ active: source === i }" @click="source = i">
          {{ settings.sourceReady(i) ? '🟢' : '⚪' }} {{ s.name }}
        </button>
      </nav>
      <ModelSourceEditor :key="source" :index="source" />
    </section>

    <section class="panel">
      <h2>🔀 功能分配</h2>
      <p class="small muted">只有「敘事正文」{{ settings.adult ? '與「成人場景正文」' : '' }}會寫出日誌裡的正文，適合用寫作能力好的模型；其他功能只輸出 JSON，可以改用便宜、快速的模型。</p>
      <table class="routes small">
        <tbody>
          <tr v-for="f in AI_FEATURES.filter((x) => x.id !== 'adult' || settings.adult)" :key="f.id">
            <td class="name">{{ f.prose ? '✍️' : '🧮' }} {{ f.name }}</td>
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
      <h2>✨ 敘事與判定</h2>
      <div class="form">
        <label class="check"><input v-model="settings.aiNarration" type="checkbox" /> AI 細節描述</label>
        <p class="small muted">
          開啟：下列種類的日誌產生後，自動請「敘事正文」的模型寫出詳細經過。<br />
          關閉：不自動呼叫 AI（AI 判定的主動行動除外），戰鬥直接顯示戰報，其他事件顯示簡述。每則日誌都可以手動按「✍️ 寫出經過」。
        </p>
        <div class="kinds">
          <label v-for="k in NARRATE_KINDS" :key="k.id" class="check small" :title="k.desc">
            <input v-model="settings.narrateKinds[k.id]" type="checkbox" /> {{ k.name }}
            <span class="muted">{{ k.desc }}</span>
          </label>
        </div>
        <label class="check"><input v-model="settings.aiJudge" type="checkbox" /> AI 判定主動行動</label>
        <p class="small muted">
          開啟：主動行動（談判、雇傭、殺價、邀請、逃離……）先擲骰，再把骰值與完整資料交給 AI，由 AI 決定成敗（可能出乎預料），經過再交給敘事正文寫出；各地居民、商店的交易清單與談判方式也由 AI 設計。<br />
          關閉：依規則判定（預設屬性與參考 DC）。
        </p>
        <label>
          輸出語言
          <select v-model="settings.language">
            <option value="zh-Hant">繁體中文</option>
            <option value="zh-Hans">简体中文</option>
          </select>
        </label>
        <p class="small muted">文風、世界書條目與其他提示詞在上方的「🧩 提示詞」頁籤調整，也可以在那裡預覽送出的內容。</p>
        <label>
          世界書注入字數上限
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
      <h2>🎲 這個存檔的規則</h2>
      <div class="form">
        <label>在地下城戰敗時，這趟探索撿到、還沒帶出去的物品與錢
          <select :value="defeatLootRule(game.state)" @change="game.setDefeatLoot(($event.target as HTMLSelectElement).value as DefeatLoot)">
            <option v-for="(n, k) in DEFEAT_LOOT_NAME" :key="k" :value="k">{{ n }}</option>
          </select>
        </label>
        <p class="small muted">離開地下城（啟程旅行）就算帶出去了。這個規則存在存檔裡，每個存檔可以不一樣。</p>
      </div>
    </section>

    <section class="panel">
      <h2>🎮 遊戲規則</h2>
      <div class="form">
        <label>
          升級時能力三選一的重抽次數（每組）
          <input v-model.number="settings.abilityRerolls" type="number" min="0" max="99" style="width: 100px" />
        </label>
        <p class="small muted">0 表示不能重抽。只影響之後的重抽，已經用掉的次數照算。</p>
        <label>
          兩次長休至少隔幾小時
          <input v-model.number="settings.longRestGap" type="number" min="0" max="24" style="width: 100px" />
        </label>
        <p class="small muted">0～24，預設 {{ companionRules.rest.long_rest_gap_hours }}。從上次長休結束時算起。</p>
      </div>
    </section>

  </template>

  <section v-if="page === 'save'" class="panel">
    <h2>💾 存檔</h2>
    <p v-if="!game.state" class="small muted">還沒有開始冒險。</p>
    <p class="small muted">目前的進度會自動存在瀏覽器中。存檔欄位、快速存檔、匯出與匯入檔案在右上角的「💾 存讀檔」。</p>
    <div v-if="game.state" class="row">
      <button class="danger" @click="doReset">放棄目前的進度並回到開始畫面</button>
    </div>
    <p class="small muted">存檔欄位裡的存檔不會被刪除。</p>
    <h3>📖 日誌瘦身</h3>
    <div class="form">
      <label>
        完整保留最近幾則日誌
        <input v-model.number="settings.logKeep" type="number" min="50" max="5000" step="50" style="width: 120px" />
      </label>
      <p class="small muted">
        超過時，更早的日誌每 50 則整理一次：只留時間、地點、簡述與 AI 寫的經過（在日誌最上方「📦 顯示封存的舊紀錄」），
        隊伍快照、經過的時間軸與變化清單拿掉，讓存檔不會越來越大。token 用量不會因此變少：封存的日誌的用量另外合計，日誌上方會分開顯示。
      </p>
      <p v-if="game.state" class="small muted">目前：{{ game.state.reports.length }} 則完整的日誌、{{ game.state.logArchive?.length ?? 0 }} 則封存的紀錄。</p>
    </div>
  </section>
</template>

<style scoped>
.form { display: grid; gap: 12px; max-width: 560px; }
.tabs { gap: 6px; margin-bottom: 10px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.pages { position: sticky; top: 0; z-index: 1; background: var(--bg); padding: 4px 0; flex-wrap: wrap; }
.routes { border-collapse: collapse; width: 100%; }
.routes td { border-bottom: 1px solid var(--border); padding: 6px 8px 6px 0; vertical-align: top; }
.routes .name { white-space: nowrap; font-weight: 600; }
.note { color: var(--accent-2); }
.kinds { display: grid; gap: 4px; padding-left: 22px; }
.kinds .muted { margin-left: 4px; }
.form label, .form .field { display: grid; gap: 4px; }
.form label.check { display: flex; gap: 6px; align-items: center; }
</style>
