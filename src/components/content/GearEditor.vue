<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ATTR_IDS, attrName, attributeRules, BIND_KINDS, damageTypeName, damageTypes, equipment, itemRules, lewdRules, type BindKind } from '@/engine/data'
import { baseSlots, BASE_TYPE_ORDER, defaultBaseType, gearRules, gearSummary, OUTFIT_KINDS, rarityName, RARITY_ORDER, VACUUM_SIDES, type OutfitKind, type VacuumSide } from '@/engine/gear'
import { builtinBase, builtinMaterial, type BaseMod, type MaterialMod } from '@/engine/mods'
import { formatMoney } from '@/engine/money'
import type { GearSlot } from '@/engine/types'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import AffinityRows from './AffinityRows.vue'
import IconField from './IconField.vue'
import ContentIcon from '../icons/ContentIcon.vue'
import { baseArt, refPath } from '../items/itemIcon'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'
import FoldSet from './FoldSet.vue'
import HelpText from './HelpText.vue'

// 裝備底材與材料的編輯表單
const props = defineProps<{ kind: 'base' | 'material'; id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const KINDS: Record<string, string> = { metal: '金屬', leather: '皮革', cloth: '布料', wood: '木材', jewel: '寶石' }
const SLOTS: Record<string, string> = baseSlots()
const MOD_NAME: Record<string, string> = { hit: '命中', damage: '傷害', evade: '迴避', dr: '減傷', save: '豁免', crit: '幸運一擊', ap_regen: '行動點回復' }
const SCALE_NAME: Record<string, string> = { full: '材料加成全部', half: '一半（捨去）', up: '一半（進位）', third: '三分之一（捨去）', third_up: '三分之一（進位）' }
const damageIds = damageTypes.types.map((t) => t.id)

/** 種族限定的底材（都不勾時拿掉欄位） */
function setRace(id: string, on: boolean) {
  const set = new Set(base.value.races ?? [])
  if (on) set.add(id)
  else set.delete(id)
  if (set.size) base.value.races = Object.keys(attributeRules.races).filter((r) => set.has(r))
  else delete base.value.races
}
function currentBase(): BaseMod {
  const b = clone(content.mods.bases[props.id] ?? (gearRules.bases[props.id] as BaseMod))
  if (b.slot === 'main_hand' && !b.weaponDef && b.weapon) b.weaponDef = clone(equipment.weapons[b.weapon]!)
  if (b.slot === 'body' && !b.armorDef && b.armor) b.armorDef = clone(equipment.armors[b.armor]!)
  b.stats ??= {}
  b.scale ??= {}
  return b
}
function currentMaterial(): MaterialMod {
  const m = clone(content.mods.materials[props.id] ?? (gearRules.materials[props.id] as MaterialMod))
  m.armor ??= {}
  return m
}
const base = ref<BaseMod>(props.kind === 'base' ? currentBase() : ({} as BaseMod))
const defaultType = computed(() => (base.value.slot ? defaultBaseType(base.value as Parameters<typeof defaultBaseType>[0]) : ''))
/** 類型的選項：依欄位只列主手、副手或護甲衣物的類型；以前手打、不在清單裡的類型保留在最後 */
const typeOptions = computed(() => {
  const slot = base.value.slot
  const off = BASE_TYPE_ORDER.indexOf('盾')
  const wear = BASE_TYPE_ORDER.indexOf('金屬護甲')
  const list = slot === 'main_hand' ? BASE_TYPE_ORDER.slice(0, off) : slot === 'off_hand' ? BASE_TYPE_ORDER.slice(off, wear) : BASE_TYPE_ORDER.slice(wear)
  const cur = base.value.type
  return cur && !list.includes(cur) ? [...list, cur] : list
})
function setOutfit(v: string) {
  if (v) base.value.outfit = v as OutfitKind
  else delete base.value.outfit
  if (v === 'adult') base.value.adult = true
}
function setVacuum(side: VacuumSide, on: boolean) {
  const set = new Set(base.value.vacuum ?? [])
  if (on) set.add(side)
  else set.delete(side)
  if (set.size) base.value.vacuum = VACUUM_SIDES.filter((s) => set.has(s))
  else delete base.value.vacuum
}
function setExposure(v: string) {
  if (v === '') delete base.value.exposure
  else base.value.exposure = Number(v)
}
function setBindKind(v: string) {
  if (v) {
    base.value.bind_kind = v as BindKind
    base.value.bind ??= 1
  } else {
    delete base.value.bind_kind
    delete base.value.bind
  }
}
const mat = ref<MaterialMod>(props.kind === 'material' ? currentMaterial() : ({} as MaterialMod))
const text = () => JSON.stringify(props.kind === 'base' ? base.value : mat.value)
const saved = ref(text())
function reset() {
  if (props.kind === 'base') base.value = currentBase()
  else mat.value = currentMaterial()
  saved.value = text()
}
watch(() => [props.kind, props.id], reset)
const dirty = computed(() => text() !== saved.value)
/** 沒有上傳圖時用的內建底材圖（自建底材依武器類型、欄位與材料類型挑） */
const baseFallback = computed(() => ({ kind: 'path' as const, path: refPath(baseArt(props.id, base.value)) }))
const builtin = computed(() => (props.kind === 'base' ? !!builtinBase(props.id) : !!builtinMaterial(props.id)))
const edited = computed(() => builtin.value && !!(props.kind === 'base' ? content.mods.bases[props.id] : content.mods.materials[props.id]))

// 底材換到主手或上身時補上武器、防具的數值
watch(() => base.value.slot, (s) => {
  if (props.kind !== 'base') return
  if (s === 'main_hand') base.value.weaponDef ??= { name: base.value.name, dice: '1d6', type: 'slashing', attr: 'str' }
  if (s === 'body') base.value.armorDef ??= { name: base.value.name, evade: 0, dr: 1 }
})

/** 這種底材或材料做成的制式裝備（套用後） */
const catalog = computed(() => {
  void content.version
  return itemRules.items.filter((i) => i.gear && (props.kind === 'base' ? i.gear.base === props.id : i.gear.material === props.id))
})

function setScale(k: string, v: string) {
  const s = { ...(base.value.scale ?? {}) } as Record<string, string>
  if (v) s[k] = v
  else delete s[k]
  base.value.scale = s as BaseMod['scale']
}

function save() {
  try {
    if (props.kind === 'base') content.saveBase(props.id, base.value, !builtin.value)
    else content.saveMaterial(props.id, mat.value, !builtin.value)
    reset()
    game.flash('已儲存')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm('恢復成內建的樣子？')) return
  if (props.kind === 'base') content.restoreBase(props.id)
  else content.restoreMaterial(props.id)
  reset()
}
// 還有地方用到時不能刪（見 docs/CONTENT_DEPENDENCIES.md）
const usage = computed(() => {
  void content.version
  void game.state?.time.minute
  return content.usageOf(props.kind === 'base' ? 'base' : 'material', props.id)
})
function remove() {
  if (!confirm('刪除？用它做成的制式裝備會一起消失；其他存檔裡已有的會失效（沒有效果、不能裝備）。')) return
  try {
    if (props.kind === 'base') content.deleteBase(props.id)
    else content.deleteMaterial(props.id)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
    return
  }
  emit('deleted')
}
</script>

<template>
  <div class="editor">
    <EditorHeader
      :title="kind === 'base' ? base.name : mat.name" :kind="builtin ? 'builtin' : 'custom'" :edited="edited" :dirty="dirty" :usage="usage"
      @save="save" @discard="reset" @restore="restore" @remove="remove"
    />
    <UsageNote :usage="usage" :deletable="!builtin" />
    <p class="small muted">id：{{ id }}</p>

    <template v-if="kind === 'base'">
      <FoldSet>
        <template #legend>底材</template>
        <div class="grid">
          <label>名稱 <input v-model="base.name" maxlength="12" /></label>
          <label>欄位
            <select v-model="base.slot" :disabled="builtin"><option v-for="(n, k) in SLOTS" :key="k" :value="k">{{ n }}</option></select>
          </label>
          <label>材料類型
            <select v-model="base.kind" :disabled="builtin"><option v-for="(n, k) in KINDS" :key="k" :value="k">{{ n }}</option></select>
          </label>
          <label>底價（第一級材料，{{ formatMoney(base.price) }}）<input v-model.number="base.price" type="number" min="1" /></label>
          <label>仇恨（0.1 = +10%）<input v-model.number="base.threat" type="number" step="0.05" /></label>
        </div>
        <label v-if="base.slot === 'main_hand'" class="check small"><input v-model="base.two_handed" type="checkbox" :disabled="builtin" /> 雙手武器（空出副手）</label>
        <label class="block"><span>類型 <Hint text="打造裝備時「部位 → 類型 → 底材」的類型（例如刀劍、盾、皮革護甲）。自動：主手、副手是「其他武器」「其他副手」，成人向服裝一類，有減傷的是護甲，寶石是飾品，其他照材料是衣物。主手武器的類型也決定存檔規則「職業武器限制」打開時哪些職業能拿（例如遊俠只能拿弓弩）；「其他武器」哪個職業都不能拿。" /></span>
          <select :value="base.type ?? ''" @change="base.type = ($event.target as HTMLSelectElement).value || undefined">
            <option value="">自動（{{ defaultType }}）</option>
            <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="block">描述 <input v-model="base.desc" maxlength="120" /></label>
        <div class="block icon-row"><span>圖示</span><IconField v-model="base.icon" :fallback="baseFallback" hint="用這個底材做的裝備都用這張圖（物品自己有上傳圖時用物品的）。上傳的圖會縮到 48×48 以內，存在這個世界裡。" /></div>
        <div v-if="base.slot !== 'main_hand' && base.slot !== 'off_hand'" class="row small">
          <label>服裝分類
            <select :value="base.outfit ?? ''" @change="setOutfit(($event.target as HTMLSelectElement).value)">
              <option value="">（不是服裝）</option>
              <option v-for="(n, k) in OUTFIT_KINDS" :key="k" :value="k">{{ n }}</option>
            </select>
          </label>
          <Hint text="服裝不會出現在寶箱與掉落的隨機裝備裡；裁縫店（鐵匠鋪、珠寶店少量）每天另外上架幾件。上身的服裝建角時也能選。" />
        </div>
        <label class="check small"><input type="checkbox" :checked="!!base.adult" :disabled="base.outfit === 'adult'" @change="base.adult = ($event.target as HTMLInputElement).checked || undefined" /> 成人向（內容編輯器的篩選用）</label>
        <label class="check small"><input type="checkbox" :checked="!!base.exclusive" :disabled="builtin" @change="base.exclusive = ($event.target as HTMLInputElement).checked || undefined" /> 地下城專屬：只靠掉落取得（層主的掉落物寫這個底材做成的裝備），不能打造，不會出現在寶箱、商店、建角與 AI 生成的裝備裡</label>
        <div class="row checks small" title="種族限定的底材：只有勾選的種族能穿（人馬族的下身、鞋子、後蹄、腿部飾品只能穿人馬族限定的底材）">
          <span>限定種族：</span>
          <label v-for="(r, id) in attributeRules.races" :key="id" class="check small"><input type="checkbox" :checked="!!base.races?.includes(String(id))" :disabled="builtin" @change="setRace(String(id), ($event.target as HTMLInputElement).checked)" /> {{ r.name }}</label>
        </div>
        <label v-if="base.slot !== 'main_hand' && base.slot !== 'body'" class="check small">
          <input v-model="base.restraint" type="checkbox" :disabled="builtin" /> 束縛用（項圈、鐐銬）：沒有加成，不能打造，不會出現在寶箱、掉落、建角與 AI 生成的裝備裡；效果只靠物品的屬性加減，給「主人會強制裝備」的物品用
        </label>
        <div v-if="base.slot !== 'main_hand' && base.slot !== 'off_hand'" class="row small">
          <label v-if="lewdRules.gear.exposure_slots.includes(base.slot)">曝露度
            <select :value="base.exposure ?? ''" @change="setExposure(($event.target as HTMLSelectElement).value)">
              <option value="">（依服裝分類：{{ base.outfit === 'adult' ? lewdRules.gear.outfit.adult?.exposure ?? 0 : 0 }}）</option>
              <option v-for="n in [0, 1, 2, 3]" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <label v-if="base.slot === 'body'" class="check">
            <input type="checkbox" :checked="!!base.top_only" @change="base.top_only = ($event.target as HTMLInputElement).checked || undefined" /> 上衣類 <Hint text="只遮上半身的衣服（襯衫、水手服、束衣）：沒穿下身時不算遮住下身，下身看內褲，連內褲都沒穿就是全裸。不勾的（連身裙、旗袍、長袍、鎧甲）沒穿下身時照樣遮住下身。" />
          </label>
          <template v-if="base.slot === 'body' || base.slot === 'legs'">
            <span>真空會走光 <Hint text="底下沒穿內衣（上身）或內褲（下身）時，那一側的曝露度 +1（最多 3）。曝露度 1 以上的衣服本來就算，這裡給曝露度 0、卻會走光的衣服勾（裙子、薄襯衫、浴衣）。上身只算陰柔、中性的體型；人馬族的下身不算。" /></span>
            <label v-for="side in VACUUM_SIDES" :key="side" class="check">
              <input type="checkbox" :checked="base.vacuum?.includes(side)" @change="setVacuum(side, ($event.target as HTMLInputElement).checked)" /> {{ side === 'top' ? '上身（沒穿內衣）' : '下身（沒穿內褲）' }}
            </label>
          </template>
          <template v-if="base.restraint">
            <label>拘束
              <select :value="base.bind_kind ?? ''" @change="setBindKind(($event.target as HTMLSelectElement).value)">
                <option value="">（沒有雙面效應）</option>
                <option v-for="k in BIND_KINDS" :key="k" :value="k">{{ lewdRules.two_face.kinds[k].name }}</option>
              </select>
            </label>
            <label v-if="base.bind_kind">程度 <select v-model.number="base.bind"><option v-for="n in [1, 2, 3]" :key="n" :value="n">{{ n }}</option></select></label>
          </template>
          <Hint text="曝露度 0～3：上身、下身、內衣的曝露名聲用（docs/LEWD_STATS.md 第 3 節）。拘束：束縛用的底材平常是檢定減值，修了慾望流派、上了鎖時戰鬥中反轉成增益（第 7 節）。" />
        </div>
        <p v-if="builtin" class="small muted">內建底材不能改欄位與材料類型；改名只影響之後新打造或生成的裝備，目錄裡的制式裝備沿用原本的名稱。</p>
      </FoldSet>

      <FoldSet v-if="base.slot === 'main_hand' && base.weaponDef">
        <template #legend>武器</template>
        <div class="grid">
          <label>傷害骰 <input v-model="base.weaponDef.dice" placeholder="1d8" /></label>
          <label>傷害類型
            <select v-model="base.weaponDef.type"><option v-for="t in damageIds" :key="t" :value="t">{{ damageTypeName(t) }}</option></select>
          </label>
          <label>攻擊屬性
            <select v-model="base.weaponDef.attr"><option v-for="a in ATTR_IDS" :key="a" :value="a">{{ attrName(a) }}</option></select>
          </label>
        </div>
        <p v-if="builtin" class="small muted">內建底材的武器數值是共用的：同一種武器（職業的起始武器、NPC）會一起改。</p>
      </FoldSet>

      <FoldSet v-if="base.slot === 'body' && base.armorDef">
        <template #legend>防具</template>
        <div class="grid">
          <label>迴避 <input v-model.number="base.armorDef.evade" type="number" /></label>
          <label>減傷 <input v-model.number="base.armorDef.dr" type="number" min="0" /></label>
        </div>
        <AffinityRows v-model="base.armorDef.resist" label="抗性" />
      </FoldSet>

      <FoldSet v-if="!base.restraint">
        <template #legend>固定加成與材料成長</template>
        <HelpText text="固定加成不論材料都有；材料成長：材料的加成（鐵 0、鋼 1、秘銀 2、精金 4、星隕鐵 6）依比例加到這一項。" />
        <div class="grid">
          <label v-for="(n, k) in MOD_NAME" :key="k">{{ n }}
            <span class="pair">
              <input v-model.number="base.stats![k as keyof typeof base.stats]" type="number" placeholder="0" />
              <select :value="(base.scale as Record<string, string>)?.[k] ?? ''" @change="setScale(String(k), ($event.target as HTMLSelectElement).value)">
                <option value="">不成長</option>
                <option v-for="(sn, sk) in SCALE_NAME" :key="sk" :value="sk">{{ sn }}</option>
              </select>
            </span>
          </label>
        </div>
      </FoldSet>
    </template>

    <template v-else>
      <FoldSet>
        <template #legend>材料</template>
        <div class="grid">
          <label>名稱 <input v-model="mat.name" maxlength="8" /></label>
          <label><span>類型 <Hint text="決定能做成哪些底材：金屬做刀劍與重甲、皮革做皮甲與靴子、布料做衣服、木材做弓與法杖、寶石做飾品（每種底材寫了用哪一類材料）。" /></span>
            <select v-model="mat.kind" :disabled="builtin"><option v-for="(n, k) in KINDS" :key="k" :value="k">{{ n }}</option></select>
          </label>
          <label><span>等級（1～7） <Hint text="決定打造的工錢與 DC。第 6、7 級是高等地下城的材料。" /></span><input v-model.number="mat.tier" type="number" min="1" max="7" :disabled="builtin" :title="builtin ? '內建材料的等級不能改（隨機裝備依類型與等級找材料）' : ''" /></label>
          <label><span>加成 <Hint text="材料的成長值，不是直接加攻擊。用這個材料做的裝備，數值依底材的「材料成長」換算：刀劍類武器傷害 + 加成、命中 + 加成的一半；胸甲、頭盔豁免 + 加成的一半（進位）；靴子迴避 + 一半……每種底材不同，見底材的「固定加成與材料成長」。內建：鐵 0（沒有加成）、鋼 1、秘銀 2、精金 4、星隕鐵 6、第 6 級 8、第 7 級 10。" /></span><input v-model.number="mat.bonus" type="number" min="0" max="10" /></label>
          <label><span>稀有度 <Hint text="用這個材料做的裝備預設的稀有度：決定名稱的顏色，以及打造時能放幾點附魔（普通 0、優良 1、稀有 2、史詩 4、傳說 6）。建角挑裝備時，稀有度比材料本來高的要多花點數。" /></span>
            <select v-model="mat.rarity"><option v-for="r in RARITY_ORDER" :key="r" :value="r">{{ rarityName(r) }}</option></select>
          </label>
          <label><span>建議等級 <Hint text="幾級才會出現：怪物掉落、NPC 的裝備、寶箱的隨機裝備，只從建議等級不超過怪物（NPC、寶箱）等級的材料裡挑；商店每天的裝備與 AI 設計的裝備以主角等級 +2 為上限，超過時換成上限內最好的材料。內建：鐵 1、鋼 3、秘銀 7、精金 11、星隕鐵 15。" /></span><input v-model.number="mat.level" type="number" min="1" max="30" /></label>
          <label><span>價格倍率（× 底價） <Hint text="裝備價格 = 底材的價格 × 這個倍率（有附魔時每點再 +50%）。內建：鐵 1、鋼 2、秘銀 15、精金 150、星隕鐵 1000。" /></span><input v-model.number="mat.price" type="number" min="0.1" step="0.5" /></label>
          <label><span>防具額外迴避 <Hint text="材料本身的特性，只加在防具、盾與飾品上（武器沒有），和加成另外算。例如秘銀較輕：迴避 +1。" /></span><input v-model.number="mat.armor!.evade" type="number" /></label>
          <label><span>防具額外減傷 <Hint text="材料本身的特性，只加在防具、盾與飾品上（武器沒有），和加成另外算。例如精金更硬：減傷 +1。" /></span><input v-model.number="mat.armor!.dr" type="number" /></label>
        </div>
        <AffinityRows v-model="mat.resist" label="防具與飾品的抗性" hint="材料本身的抗性，只加在防具、盾與飾品上（武器沒有）。負數是受到的傷害變少：例如龍皮的火焰 −0.25，用龍皮做的防具受到的火焰傷害 ×0.75。" />
        <label class="block">描述 <input v-model="mat.desc" maxlength="120" /></label>
        <div class="block icon-row">
          <span>圖示</span>
          <div class="row">
            <ContentIcon kind="material" :def="mat" :size="36" /><ContentIcon kind="material" :def="mat" :size="20" />
            <span class="small muted">依類型與等級自動決定，顏色依稀有度；暫時不能上傳。</span>
          </div>
        </div>
      </FoldSet>
    </template>

    <FoldSet>
      <template #legend>制式裝備（{{ catalog.length }} 件）</template>
      <p class="small muted">自建的底材或材料會自動產生「底材 × 同類材料」的制式裝備；儲存後更新。</p>
      <ul class="plain small list">
        <li v-for="i in catalog" :key="i.name"><b>{{ i.name }}</b>　{{ gearSummary(i.gear!) }}　{{ formatMoney(i.price_cc) }}</li>
      </ul>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.list { max-height: 260px; overflow: auto; margin: 0; padding: 0; list-style: none; }
.list li { padding: 2px 0; border-bottom: 1px solid var(--border); }
</style>
