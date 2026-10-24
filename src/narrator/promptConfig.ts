// 玩家可以調整的提示詞設定：文風條目、其他提示詞條目、世界書覆寫。
// 跟著瀏覽器走（所有存檔共用），存在 localStorage（見 src/stores/prompts.ts）。

import type { LoreItem, LoreOverride } from './lore'

/**
 * 條目要套用到哪種請求：
 *   narration 敘事（AI 細節描述）
 *   adult     成人場景的敘事（報告帶 adult_scene，而且成人向開啟時，取代 narration）
 *   judge     判定（AI 判定主動行動，narrative 欄位）
 */
export type PromptTarget = 'narration' | 'adult' | 'judge'
export const PROMPT_TARGETS: PromptTarget[] = ['narration', 'adult', 'judge']
/**
 * 條目放的位置：
 *   system 前段：和規則、常駐世界書放在一起，不太變動，可以被快取
 *   end    後段：放在每次請求的最後（本次要求之前），適合「每次都提醒一次」的指示，但不會被快取
 */
export type PromptPosition = 'system' | 'end'

export interface PromptEntry {
  id: string
  name: string
  content: string
  enabled: boolean
  targets: PromptTarget[]
  /** 只有「其他提示詞」可以選；文風一律放在前段 */
  position?: PromptPosition
  /** 成人向：只在設定開啟成人向時送出 */
  adult?: boolean
  /** 內建預設條目的 id（可以恢復原文） */
  preset?: string
}

export interface PromptConfig {
  /** 2：加入「成人場景」的套用對象 */
  version: 2
  styles: PromptEntry[]
  custom: PromptEntry[]
  /** 內建世界書條目的覆寫（key = uid） */
  lore: Record<string, LoreOverride>
  /** 玩家新增的世界書條目 */
  customLore: LoreItem[]
  /** 判定請求也注入世界書（常駐條目放前段、觸發條目放後段） */
  loreInJudge: boolean
  /** 玩家修改過的敘事規則；沒有時用預設（DEFAULT_NARRATION_RULES） */
  narrationRules?: string
  /** 玩家修改過的戰敗事件規則；沒有時用預設（DEFAULT_DEFEAT_RULES） */
  defeatRules?: string
  /** 玩家修改過的成人場景規則；沒有時用預設（DEFAULT_SCENE_RULES） */
  sceneRules?: string
}

export const TARGET_NAME: Record<PromptTarget, string> = { narration: '敘事', adult: '成人場景', judge: '判定' }

export const PRESET_STYLES: PromptEntry[] = [
  {
    id: 'style-elondia',
    preset: 'style-elondia',
    name: '埃隆迪亞・史詩奇幻',
    enabled: true,
    targets: ['narration', 'adult', 'judge'],
    content: `- 中世紀奇幻的筆調：沉穩、有畫面感，像一本冒險小說，不像遊戲紀錄或攻略。
- 用感官細節帶出場景：光線、聲音、氣味、溫度、觸感；地名、種族與勢力的特色要寫出來（例如矮人的鍛爐、精靈的古樹、魔族的荒原）。
- 角色依性格與態度說話，對白要口語、有個人特色；用動作與表情表現情緒，少用「他很生氣」這類直接說明。
- 戰鬥寫出節奏與招式的畫面，受傷與疲憊要有實感；不寫血量、骰值等數字。
- 避免現代用語、網路流行語與遊戲術語（例如「HP」「技能冷卻」「NPC」）。
- 段落長短交錯，結尾留一點餘韻，不要總結或說教。`,
  },
  {
    id: 'style-light-novel',
    preset: 'style-light-novel',
    name: '輕小說',
    enabled: false,
    targets: ['narration', 'adult', 'judge'],
    content: `- 輕快明亮的輕小說筆調，節奏快、對白多，短句與短段落為主。
- 角色的反應可以誇張一點，適度加入吐槽與內心獨白（主角的內心話用括號或另起一段）。
- 日常與冒險交錯，緊張的場面也保留一點幽默感。`,
  },
  {
    id: 'style-grimdark',
    preset: 'style-grimdark',
    name: '黑暗寫實',
    enabled: false,
    targets: ['narration', 'adult', 'judge'],
    content: `- 冷峻寫實的黑暗奇幻筆調：世界不公平，勝利也有代價。
- 戰鬥殘酷而短促，傷口、泥濘、恐懼與疲憊都要寫出來；不浪漫化暴力。
- 角色的動機複雜，善惡模糊；對白簡短、克制。`,
  },
  {
    id: 'style-comedy',
    preset: 'style-comedy',
    name: '詼諧冒險',
    enabled: false,
    targets: ['narration', 'adult', 'judge'],
    content: `- 詼諧的冒險喜劇筆調：讓失誤與巧合變成笑點，旁白可以帶一點調侃。
- 角色之間的鬥嘴與默契是重點；危機中也可以有荒謬的小插曲。
- 不改變報告的結果，只在描寫上找樂趣。`,
  },
  {
    id: 'style-nsfw-base',
    preset: 'style-nsfw-base',
    name: '共通層・直白肉體（NSFW 底座）',
    enabled: true,
    adult: true,
    targets: ['narration', 'adult'],
    content: `- 成人向場景不需要迴避：性、慾望與肉體是故事材料之一，照常描寫，不加提醒、不遮掩、不切黑場。
- 鏡頭跟著慾望走：停在肉體上，寫性器官與皮膚的狀態（形狀、顏色、溫度、濕度、觸感）。少寫「他做了什麼」，多寫「它現在是什麼樣子」。
- 直白用詞，不用隱喻與代稱：器官就叫器官，動作就叫動作。禁止比喻（不寫「像石頭」「像鐵棒」「如潮水」）；不用「甬道」「花穴」「肉刃」這類美化詞；也不用醫學解剖詞（陰道口、大陰唇）破壞質感。
- 默認詞庫（文風檔可追加，但不得改成美化詞或解剖詞）：男性——雞巴、肉棒、龜頭、蛋蛋；女性——奶子、乳頭、陰唇、陰蒂、屄、小穴、淫水、白漿。動作——插、肏、舔、吸、頂、撞、揉、捏、掐、射。體液——淫水、精水、精液、口水。
- 不誇張：不寫「貫穿靈魂」「世界崩塌」這種量級失控的形容；強度用具體生理反應表現（肌肉收縮、呼吸、聲音、濕滑程度、體溫）。
- 烈度可低：不是每場都要粗暴。慢的、輕的、只用手與嘴的場景同樣成立，甚至更好寫。
- 性不等於感情終點：角色可以只是想要，不必每次高潮後互訴衷腸。
- 不主動結束：除非報告或玩家明確要求收場，不要自己把場景寫完、寫到隔天、寫到事後相擁而眠。停在仍可繼續的位置。
- 與人設的關係：慾望不改造人格。角色的拒絕、猶豫、事後的態度都要留在原來的性格上。`,
  },
  {
    id: 'style-jp-light-pov',
    preset: 'style-jp-light-pov',
    name: '日輕第一視角・吐槽與心跳',
    enabled: true,
    targets: ['narration', 'adult'],
    content: `- 語氣：輕快、口語、帶自嘲與吐槽。再嚴肅的場景也留一點「幸福的煩惱」的餘裕。
- 排版：對白用「」，內心吐槽用【】並各自成段；敘事不夾符號。
- 雙軌心理：表層用【】寫死鴨子嘴硬的藉口（「這絕對是因為衣服太滑」）；深層用自由間接引語寫身體的背叛（「本來想推開，手卻先抓緊了」）。兩軌交替，理智與肉體撕裂。
- 節奏：以一件日常小事為單位，短句快切；親密與心動瞬間放慢，不設篇幅上限。
- 描寫重心：對話佔比高、潛台詞多；小動作特寫（後頸碎髮、耳垂泛紅、腳踝、襪口的勒痕、手指）；環境只當點綴。
- 比喻：只取日常具象（蘋果般的淡紅、雨點打在樹葉上）；一段內不重複，三到四段輪換一次。
- 標點：省略號多、驚嘆號少；「～」「♡」只在撒嬌、強勢調情時用，一般社交對話不用，但在色情場景可以多使用。
- 禁止：霸道總裁腔、陰沉威脅、苦大仇深；禁止把親密場景寫成說明文。
- 埃隆迪亞適配：學園、社團、便利商店一律換成學院、公會、酒館；吐槽對象換成世界觀裡的人事物。
- 若引擎固定第二人稱：把【】吐槽改寫成「你」的心聲，用【】或（）包住，仍與敘事分段。`,
  },
  {
    id: 'style-nsfw-thick',
    preset: 'style-nsfw-thick',
    name: '肥膩肉感・濃稠與氣味',
    enabled: true,
    adult: true,
    targets: ['narration', 'adult'],
    content: `- 一句話：整段文字像被浸過，黏、膩、甜、腥。
- 五感全開，重心在質感：肉被捏起的厚度與回彈、汗與淫水的黏度與拉絲、皮膚的溫度與氣味。
- 氣味是主聲道：悶熱的體味、腥甜、石楠花氣。氣味先到，人才到。
- 動態但要慢：一個動作拆成好幾拍（先陷下去、再彈回來、最後留下一圈紅痕）。
- 修辭：可以堆疊濃稠的形容，但不准用抽象概念（「慾望的深淵」這類）；一切形容都要能被摸到。
- 視角帶主觀惡意：敘事者的眼光本身就是色情的，看什麼都先看到肉；角色自己照舊，是鏡頭在偏。
- 節奏：短段、密句；一段一到兩個感官重點，不要長篇大論。
- 禁止：清冷的留白、詩意的省略。本風格不適合「只寫一句就切黑」。
- 埃隆迪亞適配：香水換成香料與藥草，沐浴換成澡堂與溫泉。`,
  },
  {
    id: 'style-nsfw-shame',
    preset: 'style-nsfw-shame',
    name: '羞恥・理智崩解（雌墮向）',
    enabled: false,
    adult: true,
    targets: ['narration', 'adult'],
    content: `- 核心：快感與羞恥等量。每一次舒服都要配一次「我怎麼會這樣」的自我唾棄；快樂即折磨，越舒服越難堪。
- 長短對撞：獨白用一本正經的長句（縱使、即便、明明……可是），聲音用破碎短句、氣音與擬聲。腦內吐槽是長句，嘴上只剩短句。
- 滑坡邏輯：角色替自己找藉口（「因為是命令」「為了不更丟臉」），一層層自我說服，最後把屈服合理化成「只能這樣」。
- 感官收窄：接近高潮時切掉宏觀視野（看不清、聽不清、聽不見周圍），只留觸覺、氣味、體內的酸脹與熱。
- 節奏：忍耐段拉長（摩擦、緊縛、汗、發抖的腿），決堤段驟快（短句、重複、標點斷裂）。
- 事後餘韻：脫力、耳鳴、羞恥回潮、不敢對視、聲音還沒恢復；不要立刻切回正常。
- 禁止：把羞恥寫成單純的痛；禁止角色無痛無感地接受——轉折必須有一道裂縫。
- 埃隆迪亞適配：催眠、藥物換成詛咒、魅魔契約、神諭試煉、蟲毒與藥草等世界觀手段。
- 與共通層接口：本風格允許較高烈度與失控描寫，但禁比喻、禁誇張量級兩條不變。`,
  },
  {
    id: 'style-nsfw-frame',
    preset: 'style-nsfw-frame',
    name: '現代直白・逐幀與人設鐵律',
    enabled: false,
    adult: true,
    targets: ['narration', 'adult'],
    content: `- 一句話：把動作拆成幀，一幀一幀寫清楚。
- 進入的過程分步寫：抵住、分開、一寸寸推進、觸底、抽出；每一步都寫形變與阻力（撐開、陷下、被帶出）。
- 四階段節奏：試探（慢，每一下都寫刮過哪裡）→ 加速（角度與力度變化）→ 失控（短句、擬聲、只剩感覺）→ 收束（射、痙攣、餘震）。
- 感受配額：被進入者至少三項內在感受（飽脹、壓迫、酸酥、矛盾）；進入者至少兩項（包裹、征服感）。
- 人設鐵律：性格不因性行為改寫。抗拒留下痕跡，事後不突然變黏人；可以軟化一寸，不能換一個人。
- 角色差異化：同一刺激不同反應——事前態度、對白風格、稱呼、忍耐度、高潮反應，逐一寫出差異，不要全員同一套叫聲。
- 強度不用數字：用對比（手腕粗、握不住、小腹被頂出的形狀）與對方反應烘托；全文尺寸類描寫不超過兩次。
- 事後：寫一次雙方外貌現狀（汗、潮紅、腫、亂），不要跳過。
- 禁止：用「一陣混亂」帶過；禁止把每個角色寫成同一種淫蕩；禁止用數據或實驗報告的語氣寫身體。`,
  },
  {
    id: 'style-nsfw-contrast',
    preset: 'style-nsfw-contrast',
    name: '反差 × 戀物・衣裝與凝視',
    enabled: false,
    adult: true,
    targets: ['narration', 'adult'],
    content: `- 反差四維同時在場：嘴拒絕（找藉口劃界）、身迎合（調整角度、夾住不放）、心期待（盤算怎麼推進而不被看穿）、事後找大義名分。
- 越正經的口吻說越下流的話；服裝越整齊，越要寫它在被弄亂的過程（領口、裙擺、襪線、腰帶）。
- 戀物重心在布料與身體的交界：襪口陷進皮肉的那圈凹陷、繫帶在皮膚上留下的壓痕、布料緊繃到極限的弧度、被汗貼住的半透明。
- 足音與步態不解釋物理，直接寫動態美（腰胯的擺、裙擺的浪、鞋跟的節奏）；高挑＝清越從容，嬌小＝輕快密集。
- 凝視寫「被看」的自覺：腳趾在鞋裡蜷起、腿不自覺併攏、耳垂泛紅、呼吸先亂。
- 埃隆迪亞適配：絲襪→絲質長襪、緊身褲襪；高跟→細跟皮靴、騎士長靴；禮服→法師長袍、貴族禮裝、神殿祭衣。
- 禁止：因果說明句（「因為鞋跟高所以步伐小」）；禁止解剖學名詞（足背、大腳趾）破壞留白。
- 與共通層接口：脫與不脫都是戲。半褪、只拉開必要的位置，通常比全裸更有效。`,
  },
  {
    id: 'style-nsfw-classical',
    preset: 'style-nsfw-classical',
    name: '文言古風・道袍與春宮',
    enabled: false,
    adult: true,
    targets: ['narration', 'adult'],
    content: `- 語體：半文半白。敘事用文言腔（四字句、對句、之乎者也），對白可稍白，但不准出現現代詞與網路語。
- 反差結構：越是仙氣端莊的出場，越要落在肉慾上。一段雅、一段淫，反覆橫跳，二者不可分割。
- 意象取自古籍與自然：雲雨、春潮、玉體、絳唇、巫山；但器官與動作仍用直白詞（見共通層），不許用「花心」「玉門」這類遮羞詞。
- 段落短，長段只用於鋪陳環境與心理，一段不超過五句。
- 對白是引擎：道士、仙子、俠女各有各的腔，禁止角色沉默。
- 標點：可用「——」「……」；驚嘆號少用。
- 埃隆迪亞適配：道觀→神殿、法師塔；仙子→精靈祭司、聖女、女騎士；丹藥→鍊金藥劑。
- 禁止：文言與網路語混用；禁止把文言當遮羞布去模糊描寫。
- 與共通層接口：雅的是外殼，淫的是骨；寫肉體時切回直白，不要用文言繞開。`,
  },
  {
    id: 'style-nsfw-dirty-talk',
    preset: 'style-nsfw-dirty-talk',
    name: '淫語・台詞的色情匯報',
    enabled: true,
    adult: true,
    targets: ['narration', 'adult'],
    content: `- 僅女性化角色使用；男性只做挑逗與下流話，不發出淫叫。
- 淫語的職能是「匯報」：用直白的話說出正在被做什麼、哪裡被碰、什麼感覺。不要詩意，要具體。
- 擬聲分級（依敏感度調整，不要一律滿檔）：非性感帶＝無；輕（乳、臀）＝一兩字；中（乳頭、陰蒂、G 點）＝四五字；高（高潮前後）＝大量、拉長、夾在句子中間。
- 三種腔調，依角色性格選，可混用：
  - 抗拒風：嘴上輕蔑、粗鄙挑釁，越被弄越嘴硬；快感與抗拒同時出現在同一句裡。
  - 獻媚風：崇拜、百依百順、自我物化（母狗、性奴、精盆這類自稱），只在隸屬關係裡用。
  - 溫柔／從容風：聲音低、句子完整、偶爾一句葷話，靠停頓與氣音取勝。
- 一人一套語癖：口頭禪、稱呼、句長、髒話密度，不要共用模板。
- 標點：～、省略號、破折號承擔節奏，不要每句都加。
- 節奏：句子要短，一句一個訊息；長句留給理智線（獨白），短句留給聲音。
- 禁止：排泄物、虐待、殺害、未成年角色；禁止全員同一種叫法。
- 埃隆迪亞適配：自稱與稱呼換成世界觀用語（主人→大人／殿下／教官），但下流程度不減。`,
  },
]

export const PRESET_CUSTOM: PromptEntry[] = [
  {
    id: 'custom-example',
    preset: 'custom-example',
    name: '範例：額外提醒',
    enabled: false,
    targets: ['narration', 'adult'],
    position: 'end',
    content: '這次多寫一點同伴之間的互動與對白。',
  },
]

export function defaultPromptConfig(): PromptConfig {
  return {
    version: 2,
    styles: PRESET_STYLES.map((e) => ({ ...e, targets: [...e.targets] })),
    custom: PRESET_CUSTOM.map((e) => ({ ...e, targets: [...e.targets] })),
    lore: {},
    customLore: [],
    loreInJudge: false,
  }
}

/** version 1 的條目沒有「成人場景」：原本套用到敘事的，成人場景也照舊套用 */
function cleanEntry(e: Partial<PromptEntry>, i: number, prefix: string, version = 2): PromptEntry {
  let targets = (Array.isArray(e.targets) ? e.targets : ['narration', 'adult', 'judge']).filter((t): t is PromptTarget => PROMPT_TARGETS.includes(t as PromptTarget))
  if (version < 2 && targets.includes('narration') && !targets.includes('adult')) targets = [...targets, 'adult']
  targets = PROMPT_TARGETS.filter((t) => targets.includes(t))
  return {
    id: typeof e.id === 'string' && e.id ? e.id : `${prefix}-${Date.now().toString(36)}-${i}`,
    name: typeof e.name === 'string' ? e.name : '未命名',
    content: typeof e.content === 'string' ? e.content : '',
    enabled: e.enabled !== false,
    targets,
    ...(e.position === 'end' || e.position === 'system' ? { position: e.position } : {}),
    ...(e.adult ? { adult: true } : {}),
    ...(typeof e.preset === 'string' ? { preset: e.preset } : {}),
  }
}

/** 讀取保存的設定（或匯入的檔案），補上缺少的欄位 */
export function normalizeConfig(raw: unknown): PromptConfig {
  const base = defaultPromptConfig()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Omit<Partial<PromptConfig>, 'version'> & { version?: number }
  const v = typeof r.version === 'number' ? r.version : 1
  return {
    version: 2,
    styles: Array.isArray(r.styles) ? r.styles.map((e, i) => cleanEntry(e, i, 'style', v)) : base.styles,
    custom: Array.isArray(r.custom) ? r.custom.map((e, i) => cleanEntry({ position: 'system', ...e }, i, 'custom', v)) : base.custom,
    lore: r.lore && typeof r.lore === 'object' ? r.lore : {},
    customLore: Array.isArray(r.customLore) ? r.customLore.filter((e) => e && typeof e.uid === 'number') : [],
    loreInJudge: !!r.loreInJudge,
    ...(typeof r.narrationRules === 'string' && r.narrationRules.trim() ? { narrationRules: r.narrationRules } : {}),
    ...(typeof r.defeatRules === 'string' && r.defeatRules.trim() ? { defeatRules: r.defeatRules } : {}),
    ...(typeof r.sceneRules === 'string' && r.sceneRules.trim() ? { sceneRules: r.sceneRules } : {}),
  }
}

/** 套用到某種請求、某個位置的已開啟條目（成人向的條目只在 adult 開啟時），把 {{player}} 換成主角名 */
export function activeEntries(list: PromptEntry[], target: PromptTarget, playerName: string, opts: { position?: PromptPosition; adult: boolean }): PromptEntry[] {
  const { position, adult } = opts
  return list
    .filter((e) => e.enabled && e.content.trim() && e.targets.includes(target) && (adult || !e.adult))
    .filter((e) => position === undefined || (e.position ?? 'system') === position)
    .map((e) => ({ ...e, content: e.content.split('{{player}}').join(playerName) }))
}

/** 粗估 token 數：中日韓文字約 1 字 1 token，其他字元約 4 字 1 token */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[　-鿿豈-﫿＀-￯]/g) ?? []).length
  return Math.round(cjk + (text.length - cjk) / 4)
}

// ---- 文風、其他提示詞的匯出與匯入 ----

export type EntryFileKind = 'styles' | 'custom'

const FILE_TYPE: Record<EntryFileKind, string> = { styles: 'elondia-styles', custom: 'elondia-prompts' }

export function exportEntries(kind: EntryFileKind, entries: PromptEntry[]): object {
  return {
    type: FILE_TYPE[kind],
    version: 2,
    entries: entries.map(({ preset: _preset, ...e }) => e),
  }
}

/**
 * 讀取匯入的條目檔案：
 * - 本遊戲匯出的 JSON（{type, entries}）、條目陣列，或整份提示詞設定（取對應的清單）
 * - 純文字或 Markdown：整份當作一個條目，檔名當名稱
 */
export function parseEntryFile(kind: EntryFileKind, text: string, fileName = ''): PromptEntry[] {
  const base = fileName.replace(/\.[^.]+$/, '') || (kind === 'styles' ? '匯入的文風' : '匯入的提示詞')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    if (!text.trim()) throw new Error('檔案是空的')
    return [cleanEntry({ name: base, content: text.trim(), ...(kind === 'custom' ? { position: 'system' } : {}) }, 0, kind === 'styles' ? 'style' : 'custom')]
  }
  const r = raw as { entries?: unknown; styles?: unknown; custom?: unknown; version?: unknown }
  // 舊的檔案（version 1 或條目陣列）沒有「成人場景」
  const version = typeof r?.version === 'number' ? r.version : 1
  const list = Array.isArray(raw) ? raw : Array.isArray(r?.entries) ? r.entries : Array.isArray(r?.[kind]) ? r[kind] : null
  if (!list) throw new Error(kind === 'styles' ? '這不是文風檔案' : '這不是提示詞檔案')
  return (list as Partial<PromptEntry>[])
    .filter((e) => e && typeof e === 'object' && typeof e.content === 'string')
    .map((e, i) => {
      const { preset: _preset, id: _id, ...rest } = e
      return cleanEntry(kind === 'custom' ? { position: 'system', ...rest } : { ...rest, position: undefined }, i, kind === 'styles' ? 'style' : 'custom', version)
    })
}
