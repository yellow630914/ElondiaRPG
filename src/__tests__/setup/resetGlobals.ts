// shared 組的測試共用同一份已載入的模組（vitest.config.ts 的 isolate: false），
// 每個測試檔開始前把引擎的全域設定還原成預設，免得前一個檔案改了沒還原（內容篩選、魔物娘、戰敗事件……）影響下一個。
import {
  setContentFilters, setDefeatAdult, setDefeatAlways, setDefeatCompanion, setMascBodyContent, setMonsterGirl, setMonsterGirlChance,
} from '@/engine/content'
import { setStepMinutes } from '@/engine/grid'
import { setLeadPool } from '@/engine/leads'
import { applyContent, emptyMods } from '@/engine/mods'
import { setNpcLife } from '@/engine/npcLife'
import { setLongRestGap } from '@/engine/rest'

// 寫在最上層（不放在 beforeAll）：setupFiles 在測試檔載入之前執行，測試檔在載入時抓的資料物件（例如 dungeonEncounters 的某一項）才是還原後的那一份
{
  applyContent(emptyMods())
  setContentFilters({ ntr: true, non_virgin: true, pc_unwilling: true, male_partner: true })
  setDefeatAdult('all')
  setDefeatAlways(false)
  setMascBodyContent(false)
  setMonsterGirl('off')
  setMonsterGirlChance(100)
  setDefeatCompanion('not_masc')
  setNpcLife({ on: true, days: 3, pairs: true })
  setLeadPool({ days: 7 })
  setStepMinutes(undefined)
  setLongRestGap(undefined)
}
