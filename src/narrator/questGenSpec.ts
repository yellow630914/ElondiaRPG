// 特殊任務生成器的提示詞（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E4a、docs/PROMPTS.md）：
// 格式說明從 worldgen/guides/stories.md 濃縮；列舉值（開頭方式、地點、任務點種類、效果、內容標籤……）在執行時從程式的常數產生，不手抄。
// 兩段式：先要大綱（便宜，方向不對可以改），再要完整 JSON；整理有錯誤時把錯誤交回去修。

import { ATTR_IDS, attributeRules, classes, damageTypes, GENDER_IDS, landmarkTypes, statuses } from '@/engine/data'
import { CONTENT_TAGS } from '@/engine/content'
import { CELL_NAME } from '@/engine/grid'
import { ABILITY_RESOLVES, ABILITY_TARGETS, ENEMY_KINDS } from '@/engine/mods'
import { LAYER_NAME, NODE_KINDS, START_KINDS, STORY_CELLS, STORY_EFFECTS, WHERE_NAME } from '@/engine/storyMods'
import { GEN_KINDS, type GenInput } from '@/engine/questGen'
import { LIGHTINGS } from '@/engine/specialMapMods'
import type { Prompt } from './prompt'

/** 生成的任務可以用的效果與寫法（都要是 STORY_EFFECTS 裡的種類；測試會檢查） */
export const GEN_EFFECTS: Record<string, string> = {
  money: '{"type":"money","amount":50}（中途的小額金錢；完成報酬由程式算，不用寫）',
  item: '{"type":"item","name":"物品名稱或 $代號","qty":1}（負數是交出去）',
  xp: '{"type":"xp","amount":100}',
  reputation: '{"type":"reputation","faction":"local 或勢力 id","delta":3}（±20）',
  affinity: '{"type":"affinity","npc":"NPC id 或 $代號","delta":5,"reason":"≤40 字"}（±50）',
  memory: '{"type":"memory","summary":"主角記住的事，≤200 字","importance":2}',
  companion: '{"type":"companion","npc":"NPC id 或 $代號","mode":"voluntary"}（正式入隊）',
  condition: '{"type":"condition","condition":"blessed"}（非戰鬥狀態：blessed、shaken、punished、well_rested、cheered……）',
  hp: '{"type":"hp","ratio":-0.2}（主角生命的比例，-0.9～1）',
  ability: '{"type":"ability","choices":3}（一次學能力的機會）',
  start_story: '{"type":"start_story","story":"現有任務的 id"}（開啟另一個任務）',
  enslave_player: '{"type":"enslave_player","master":"NPC id 或 $代號","contract":"labor"}（主角淪為奴隸，只有允許時才能用）',
}

/** 回覆的骨架（系統提示詞最後附上） */
const EXAMPLE_REPLY_SHAPE = { story: { title: '…', summary: '…', start: { kind: 'guild', location: '…' }, start_flags: ['started'], nodes: ['…'] }, new: { npcs: [], items: [], landmarks: [], specialMaps: [], enemies: [], abilities: [], statuses: [] }, notes: '給玩家看的設計說明（為什麼這樣安排、分支的意義），≤300 字' }

const list = (r: Record<string, string>) => Object.entries(r).map(([k, v]) => `${k} ${v}`).join('、')

/** 系統提示詞：角色、原則、格式說明（每次都一樣，Anthropic 會快取） */
export function designerSystem(input: GenInput): string {
  const effects = Object.entries(GEN_EFFECTS).filter(([k]) => k !== 'enslave_player' || input.enslave).map(([, v]) => `  - ${v}`).join('\n')
  const tags = input.tags.length ? input.tags.map((t) => `${t}（${CONTENT_TAGS[t as keyof typeof CONTENT_TAGS]?.name ?? t}）`).join('、') : '（都不能用）'
  const allowed = (Object.keys(GEN_KINDS) as (keyof typeof GEN_KINDS)[]).filter((k) => input.allow[k]).map((k) => `${k}（${GEN_KINDS[k]}）`).join('、') || '（不能新增，只能引用現有的）'
  const cells = STORY_CELLS.map((c) => `${c} ${CELL_NAME[c]}`).join('、')
  const dmg = damageTypes.types.map((t) => t.id).join('、')
  return `你是奇幻 RPG《埃隆迪亞大陸》的任務設計者。玩家會描述一個故事，請把它編排成遊戲裡的「特殊任務」：一串任務點，用旗標串起來，有分支、有結局。只輸出 JSON，不要任何說明文字。

# 原則
1. 你只寫劇情與結構。完成報酬、物品價格、怪物與技能的數值上限、NPC 的雇用價由程式決定；你寫的數字只當參考。
2. **不要自己取 id**：新東西用代號（$npc1、$item1、$lm1、$sm1、$foe1、$ab1、$st1），程式會換成正式的 id，所有引用一起改。文字裡也可以寫代號，會換成名字。
3. 引用現有的東西時，用「目錄」裡給的 id（地點、NPC、怪物、技能、狀態、物品名稱、旗標），不要猜。
4. 旗標名稱用英文小寫與底線（例如 met_keeper、bribed），程式會加上這個任務專屬的前綴；要接續其他故事線時，才寫目錄裡列的現有旗標（保留原名）。
5. 這次允許新增：${allowed}。其他種類不能新增（特質、刺青、奴隸印記、事件、新的屬性或傷害類型都不行）。
6. 內容標籤只能用：${tags}。沒有 adult 時不能寫親密場景（scene）。
7. 每個任務點要有路可以走到（需要的旗標要有前面的結果設定），至少一條路走到「完成任務」（complete）。分支要有意義：不同選擇有不同的後果或結局。

# 特殊任務（story）
- title（≤30 字）、summary（≤300 字，冒險筆記上的簡介）、tags（內容標籤）、time_limit（天，選填）
- start：開頭。kind 是 ${list(START_KINDS)}。guild 要寫 location（有公會的城鎮）；npc 要寫 npc；travel 可以寫 regions、chance；informant 可以寫 location、price。都可以寫 min_level（建議等級）、text（開頭的描述，≤400 字）、requires（接取條件）。
- start_flags：任務開始時成立的旗標（第一個任務點通常需要它）。
- nodes：任務點（最多 ${input.maxNodes} 個），每一個：
  - id（英數與底線）、title（≤40 字，冒險筆記上的目標，寫出地點）、text（≤600 字，觸發時的描述）
  - at：在哪裡。where 是 ${list(WHERE_NAME)}。
    - settlement、cell、outskirts 要寫 location（聚落）；cell 要寫 cell：${cells}，或這個聚落的地標 id（新地標寫 $lm 代號）；那個聚落要有這種設施（看目錄）。
    - npc 寫 npc（現有 id 或 $代號）；dungeon 寫 location（地下城）與 layer（${list(LAYER_NAME)}）；special 寫 special_map（$sm 代號或現有的 sm_ id）。
  - requires：解鎖的條件 { "flags": [...全部成立], "flags_none": [...都不成立], "flags_any": [...至少一個], "affinity": { "NPC id": 最低好感 } }
  - kind：${list(NODE_KINDS)}
    - check 寫 check：{ "attr": "${ATTR_IDS.join('/')}", "dc": 10～20 }，有 success 與 fail。
    - combat 寫 enemies：[["怪物 id 或 $代號", 數量]]（數量 1～4）；要和固定 NPC 打時，做一隻替身怪物（$foe 代號，可以用 template 照現有怪物複製數值），不要用 foes。有 success（勝利）與 fail（落敗）。
    - choice 寫 options：[{ "label": "≤30 字", "requires": {…選填}, "check": {…選填}, "success": 結果, "fail": 結果（有 check 才寫）, "tags": [內容標籤，選填] }]，2～4 個。
    - story 只有 success。
  - allies：在場的友方 NPC（選填）；urgent：true 時走到就要處理（只給旅途上這種過了就沒有的場面）。
- 結果（success、fail、選項的 success、fail）：text（≤400 字）、set_flags、clear_flags、effects、join／leave（NPC 以任務同行加入、離開）、deaths（NPC 在故事裡死去）、complete（完成任務）、fail_quest（任務失敗）、retry（任務點不結束，可以再來）、special_map（傳送到特殊地圖的入口）、travel_to（改去別的地點）${input.tags.includes('adult') ? '、scene（成人向的親密場景：誰和誰、在哪裡、做了什麼，≤300 字，給 AI 寫經過用）' : ''}。
- effects 只能用：
${effects}

# 新增的東西（new）
每一項都有 ref（代號）。不要寫 id。
- npcs：{ "ref": "$npc1", "name", "gender": ${GENDER_IDS.join('/')}, "race": ${Object.keys(attributeRules.races).join('/')}, "class": ${Object.keys(classes).filter((c) => !classes[c]!.noncombat).join('/')}, "kind": "adventurer 或 commoner（普通人，可以寫 occupation 職業）", "level", "location": "所屬的聚落 id", "personality", "appearance", "background", "unhireable": true（不受雇用，選填）, "no_attack": true（不能偷襲，選填） }
- items：{ "ref": "$item1", "name": "≤20 字（就是它的 id）", "category": "material/consumable/info/food/scroll", "desc": "≤80 字" }（任務道具、信物；價格由程式定）
- landmarks：{ "ref": "$lm1", "location": "聚落 id", "name": "≤12 字", "emoji", "desc": "≤200 字", "scene": "給 AI 的氛圍，≤200 字", "types": [${Object.keys(landmarkTypes).join('/')}] }（格子由程式找）
- specialMaps：{ "ref": "$sm1", "location": "地點 id", "name": "≤16 字", "desc", "size": [寬, 高]（6～16）, "lighting": ${Object.keys(LIGHTINGS).join('/')}, "layer": "shallow/middle/deep（難度）", "enemies": ["怪物 id 或 $foe 代號"] }（隨機生成的地圖，只能用結果的 special_map 帶進去；enemies 是裡面的遭遇）
- enemies：照樣板複製 { "ref": "$foe1", "template": "現有怪物 id", "name", "desc", "abilities"（選填，取代樣板的） }，或直接寫 { "ref", "name", "desc", "level", "kind": ${Object.keys(ENEMY_KINDS).join('/')}, "hp", "ap", "attrs": { ${ATTR_IDS.map((a) => `"${a}"`).join(', ')} }, "weapon": { "dice": "1d8", "type": 傷害類型, "attr": "str" }, "evade", "dr", "xp", "abilities": [技能 id 或 $ab 代號], "loot": [{ "item": "物品名稱或 $代號", "chance": 0.5 }] }。傷害類型：${dmg}。
- abilities：{ "ref": "$ab1", "template": "現有技能 id（照它的數值）", "name", "desc", "target": ${Object.keys(ABILITY_TARGETS).join('/')}, "resolve": ${Object.keys(ABILITY_RESOLVES).join('/')}, "damage": [{ "dice": "2d6", "type": 傷害類型 }], "apply": [{ "status": "狀態 id 或 $st 代號", "turns": 2, "on": "hit" }] }（只給怪物用）
- statuses：{ "ref": "$st1", "template": "現有狀態 id（例如 ${Object.keys(statuses).slice(0, 4).join('、')}）", "name", "kind": "buff/debuff", "dot": { "dice": "1d4", "type": 傷害類型 } }

# 回覆格式
${JSON.stringify(EXAMPLE_REPLY_SHAPE)}`
}

/** 玩家的需求（大綱與完整生成共用） */
function request(input: GenInput, catalog: string): string {
  const pins = [
    input.startKind ? `開頭方式：${START_KINDS[input.startKind]}` : '',
    input.location ? `地點：${input.location}` : '',
    input.npcs?.length ? `要用的現有 NPC：${input.npcs.join('、')}` : '',
    input.level ? `建議等級：${input.level}` : '',
    `任務點最多 ${input.maxNodes} 個`,
  ].filter(Boolean)
  return `# 玩家的描述\n${input.prompt.trim()}\n\n# 指定\n${pins.map((p) => `- ${p}`).join('\n')}\n\n# 目錄（可以引用的現有內容）\n${catalog}`
}

/** 大綱的格式 */
export interface GenOutline {
  title: string
  premise: string
  start: string
  nodes: { id: string; title: string; kind: string; where: string; branches: string[] }[]
  new: { ref: string; kind: string; name: string; why: string }[]
}

/** 第 ② 段：大綱 */
export function outlinePrompt(input: GenInput, catalog: string): Prompt {
  return {
    system: designerSystem(input),
    user: `${request(input, catalog)}

# 這次只要大綱
先不要寫完整的任務，只回傳大綱，讓玩家確認方向：
{"title":"任務名稱","premise":"前提與衝突，≤200 字","start":"怎麼開始（開頭方式、地點、誰）","nodes":[{"id":"n1","title":"任務點的目標","kind":"story/check/combat/choice","where":"在哪裡","branches":["每個結果一句話：發生什麼、接到哪個任務點或結局"]}],"new":[{"ref":"$npc1","kind":"npcs/items/landmarks/specialMaps/enemies/abilities/statuses","name":"名稱","why":"為什麼需要"}]}`,
  }
}

/** 第 ③ 段：完整內容（照玩家看過、可能改過的大綱） */
export function fullPrompt(input: GenInput, catalog: string, outline: string): Prompt {
  return {
    system: designerSystem(input),
    user: `${request(input, catalog)}

# 玩家確認過的大綱
${outline.trim()}

# 請照大綱寫出完整的特殊任務
只輸出一個 JSON：{"story":{…},"new":{…},"notes":"…"}`,
  }
}

/** 整理有錯誤時：把錯誤和上一版交回去修（呼叫只有 system＋user 一輪，所以放在同一則訊息） */
export function fixPrompt(input: GenInput, catalog: string, previous: string, errors: string[]): Prompt {
  return {
    system: designerSystem(input),
    user: `${request(input, catalog)}

# 你上一次的回覆
${previous.trim()}

# 程式檢查出的錯誤
${errors.map((e) => `- ${e}`).join('\n')}

# 請修正
保留原本的故事與設計，只改有問題的地方（錯誤裡的 id 可能是程式換過的正式 id，請對照你的代號）。只輸出修正後完整的 JSON：{"story":{…},"new":{…},"notes":"…"}`,
  }
}

/** 給玩家看的大綱（純文字，可以改了再送） */
export function outlineText(o: unknown): string {
  const x = (o && typeof o === 'object' ? o : {}) as Partial<GenOutline>
  const lines = [`# ${x.title ?? '（沒有名稱）'}`, '', x.premise ?? '', '', `開頭：${x.start ?? ''}`, '']
  for (const n of Array.isArray(x.nodes) ? x.nodes : []) {
    lines.push(`- ${n.id}【${n.kind}】${n.title}（${n.where}）`)
    for (const b of Array.isArray(n.branches) ? n.branches : []) lines.push(`  - ${b}`)
  }
  if (Array.isArray(x.new) && x.new.length) {
    lines.push('', '新增：')
    for (const n of x.new) lines.push(`- ${n.ref}（${GEN_KINDS[n.kind as keyof typeof GEN_KINDS] ?? n.kind}）${n.name}：${n.why}`)
  }
  return lines.join('\n').trim()
}

