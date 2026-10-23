// 工藝（data/rules/crafts.json，見 docs/CRAFTING.md）：鍛造、木工、製革、裁縫、珠寶五種，各自有等級與經驗。
// - 等級 N 可以處理第 N 級以下的材料；店主的等級依聚落規模。
// - 自己動手（行動 make）要有對應階級的工具：低階隨身工具組（任何地方）、中階工坊（旅店、安全房展開攜帶式工坊，或在店裡租）、
//   高階工作台（房子，之後的房屋系統）。
// - 夥伴：自願加入而且親密度夠、或奴隸才肯幫忙；雇傭的不幫忙。
import { craftRules, CRAFT_IDS, itemDef, locationById } from './data';
import { gearRules } from './gear';
import { currentArea, currentCell } from './grid';
import { homeOfArea, residentsHere, workbenchFor } from './homes';
import { contractOf } from './tattoos';
export { CRAFT_IDS };
export function craftName(id) {
    return craftRules.skills[id].name;
}
/** 處理這種材料的工藝 */
export function craftForKind(kind) {
    return CRAFT_IDS.find((id) => craftRules.skills[id].kinds.includes(kind)) ?? 'smithing';
}
/** 角色的某種工藝（沒有學過的是 1 級） */
export function skillOf(c, id) {
    return c.crafts?.[id] ?? { level: 1, xp: 0 };
}
/** 升到下一級需要的經驗（已經滿級時 undefined） */
export function xpToNext(level) {
    return level >= craftRules.max_level ? undefined : craftRules.xp_to_next[level - 1];
}
/** 這次製作得到的經驗：材料等級 × 成功程度的倍數 */
export function craftXpFor(tier, degree) {
    return tier * (craftRules.xp[degree] ?? 0);
}
/** 加經驗（可能升級）；回傳升到的等級（沒升級時 undefined） */
export function gainCraftXp(c, id, amount) {
    if (amount <= 0)
        return undefined;
    const s = { ...skillOf(c, id) };
    s.xp += amount;
    let leveled;
    for (let need = xpToNext(s.level); need !== undefined && s.xp >= need; need = xpToNext(s.level)) {
        s.xp -= need;
        s.level += 1;
        leveled = s.level;
    }
    if (s.level >= craftRules.max_level)
        s.xp = 0;
    c.crafts = { ...c.crafts, [id]: s };
    return leveled;
}
// ---- 店主 ----
/** 這間店的店主（keeper_地點_店）處理的工藝 */
export function shopCrafts(shop) {
    return CRAFT_IDS.filter((id) => craftRules.skills[id].shop === shop);
}
function hash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++)
        h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h;
}
/** 店主的工藝等級：記在 NPC 登錄上的優先，沒有時依聚落規模與店主 id 決定（同一位店主一直一樣） */
export function keeperCraftLevel(rec, id, locationType) {
    const saved = rec.crafts?.[id]?.level;
    if (saved)
        return saved;
    const [lo, hi] = craftRules.shop_levels[locationType] ?? [1, 2];
    return lo + (hash(`${rec.id}:${id}`) % (hi - lo + 1));
}
/** 開店中的店主、公會職員：不能邀請入隊 */
export function isShopStaff(rec) {
    return /^(keeper|clerk)_/.test(rec.id);
}
// ---- 誰可以動手 ----
/** 這位隊員願不願意幫忙製作（不願意時回傳原因） */
export function crafterRefusal(state, m) {
    if (m.isPlayer)
        return undefined;
    if (m.hp <= 0)
        return '倒下了';
    if (m.status.includes('away'))
        return '暫時離隊';
    if (m.bond === 'slave')
        return contractOf(m)?.master === 'pc' ? undefined : '不是你的奴隸';
    if (m.bond !== 'voluntary')
        return m.bond === 'hired' ? '雇傭的夥伴不幫忙做工藝' : '不是你的夥伴';
    if ((m.affinity ?? 0) < craftRules.companion.min_affinity)
        return `親密度要 ${craftRules.companion.min_affinity} 以上`;
    return undefined;
}
/** 誰可以動手：隊員，在自己的房子裡時加上留守的夥伴 */
export function crafters(state) {
    return [...state.party, ...residentsHere(state, currentArea(state))].map((m) => {
        const refusal = crafterRefusal(state, m);
        return { member: m, ...(refusal ? { refusal } : {}) };
    });
}
// ---- 工具 ----
/** 材料等級需要的工具階級（1 低階、2 中階、3 高階） */
export function toolTierFor(materialTier) {
    return craftRules.tool_tier[materialTier - 1] ?? 3;
}
/** 在安全的地方（旅店、安全房）：可以展開攜帶式工坊 */
export function atSafePoint(state) {
    return craftRules.safe_points.includes(currentCell(state).kind) || currentArea(state).kind === 'home';
}
/** 這裡做這種工藝能用的工具 */
export function toolAccess(state, id) {
    let best = { tier: 0, source: '沒有工具' };
    for (const i of state.inventory) {
        const t = itemDef(i.name)?.tool;
        if (i.qty <= 0 || t?.kind !== 'craft' || t.craft !== id)
            continue;
        // 攜帶式工坊：在旅店、安全房才展開得了，其他地方當作隨身工具用
        const tier = t.tier === 2 && !atSafePoint(state) ? 1 : (t.tier ?? 1);
        if (tier > best.tier)
            best = { tier, source: tier === 2 ? `展開${i.name}` : i.name };
    }
    // 在對應的店：可以租用店裡的工坊（中階）
    if (best.tier < 2 && currentCell(state).kind === craftRules.skills[id].shop) {
        best = { tier: 2, source: '租用店裡的工坊', rentPerHour: craftRules.workshop_rent.per_hour_cc };
    }
    // 自己的房子：攜帶式工坊可以展開；有這種工藝的高階工作台時是高階
    const home = homeOfArea(state, currentArea(state));
    if (home) {
        const bench = workbenchFor(home, id);
        if (bench)
            best = { tier: 3, source: `家裡的${bench}` };
    }
    return best;
}
export function toolTierName(tier) {
    return craftRules.tool_tier_names[tier - 1] ?? '沒有工具';
}
/** 材料的工藝等級需求與種類（給畫面用） */
export function materialNeeds(material) {
    const m = gearRules.materials[material];
    if (!m)
        return undefined;
    return { craft: craftForKind(m.kind), tier: m.tier, toolTier: toolTierFor(m.tier) };
}
/** 這位角色的工藝等級做不做得了這個材料 */
export function levelEnough(c, material) {
    const n = materialNeeds(material);
    return !!n && skillOf(c, n.craft).level >= n.tier;
}
/** 地點的規模（店主等級用） */
export function locationType(state) {
    return locationById(state.location).type;
}
