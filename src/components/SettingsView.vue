<script setup lang="ts">
import { ref } from 'vue'
import { useGame } from '@/stores/game'
import { AI_FEATURES, NARRATE_KINDS, useSettings } from '@/stores/settings'
import ModelSourceEditor from './ModelSourceEditor.vue'

const settings = useSettings()
const game = useGame()
const tab = ref(0)

function doReset() {
  if (confirm('確定要刪除目前的存檔？此動作無法復原。')) game.reset()
}
</script>

<template>
  <section class="panel">
    <h2>🤖 模型來源</h2>
    <p class="small muted">
      可以設定三個模型來源（例如一個擅長寫作的模型、一個便宜的模型），再在下方指定每個功能用哪一個。
      API key 只會存在這個瀏覽器的 localStorage，請求直接從瀏覽器送往你選擇的服務。請勿在共用電腦上保存 key。
    </p>
    <nav class="row tabs">
      <button v-for="(s, i) in settings.sources" :key="i" :class="{ active: tab === i }" @click="tab = i">
        {{ settings.sourceReady(i) ? '🟢' : '⚪' }} {{ s.name }}
      </button>
    </nav>
    <ModelSourceEditor :key="tab" :index="tab" />
  </section>

  <section class="panel">
    <h2>🔀 功能分配</h2>
    <p class="small muted">只有「敘事正文」會寫出日誌裡的正文，適合用寫作能力好的模型；其他功能只輸出 JSON，可以改用便宜、快速的模型。</p>
    <table class="routes small">
      <tbody>
        <tr v-for="f in AI_FEATURES" :key="f.id">
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
        <input v-model="settings.adult" type="checkbox" /> 注入成人向世界書條目（敘事傾向、情色喜劇法則等）
      </label>
      <p v-if="settings.adult" class="small muted">請確認你使用的 AI 服務的使用政策允許此類內容；不允許時模型可能拒絕生成。</p>
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
    </div>
  </section>

  <section v-if="game.state" class="panel">
    <h2>💾 存檔</h2>
    <p class="small muted">目前的進度會自動存在瀏覽器中。存檔欄位、快速存檔、匯出與匯入檔案在右上角的「💾 存讀檔」。</p>
    <div class="row">
      <button class="danger" @click="doReset">放棄目前的進度並回到開始畫面</button>
    </div>
    <p class="small muted">存檔欄位裡的存檔不會被刪除。</p>
  </section>
</template>

<style scoped>
.form { display: grid; gap: 12px; max-width: 560px; }
.tabs { gap: 6px; margin-bottom: 10px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); }
.routes { border-collapse: collapse; width: 100%; }
.routes td { border-bottom: 1px solid var(--border); padding: 6px 8px 6px 0; vertical-align: top; }
.routes .name { white-space: nowrap; font-weight: 600; }
.note { color: var(--accent-2); }
.kinds { display: grid; gap: 4px; padding-left: 22px; }
.kinds .muted { margin-left: 4px; }
.form label, .form .field { display: grid; gap: 4px; }
.form label.check { display: flex; gap: 6px; align-items: center; }
</style>
