// 配方（物品的 recipe；規則在 crafts.json 的 recipe，見 docs/CRAFTING.md 第 6 節）：
// 用工藝依配方做出藥劑、料理、家具、工具。和自己動手打造一樣：做的人擲工藝的屬性檢定加工藝等級，
// 要有對應階級的工具（配方等級決定），成功時得到工藝經驗。走主動行動 produce（target = 「做的人的 id@物品名稱*批數」）。
import { craftRules, itemDef, itemRules, locationById, saveItems } from './data';
import { crafterRefusal, craftName, craftXpFor, gainCraftXp, skillOf, toolAccess, toolTierFor, toolTierName } from './crafting';
import { applyEffects } from './effects';
import { currentArea } from './grid';
import { memberOrResident } from './homes';
import { formatMoney } from './money';
import { locationMult } from './trade';
/** 有配方的物品（包含自訂內容） */
export function recipeItems(craft) {
    const list = (items, invented) => items.filter((i) => i.recipe && (!craft || i.recipe.craft === craft))
        .map((i) => ({ name: i.name, recipe: i.recipe, ...(invented ? { invented } : {}) }));
    // 這個存檔自創的配方也算
    return [...list(itemRules.items, false), ...list(saveItems(), true)];
}
export function recipeOf(name) {
    return itemDef(name)?.recipe;
}
/** 依配方做 batches 批：材料、費用、時間都乘批數 */
export function recipePlan(state, name, batches, crafter) {
    const recipe = recipeOf(name);
    if (!recipe)
        throw new Error(`${name}沒有配方`);
    const rules = craftRules.recipe;
    const n = Math.max(1, Math.min(rules.max_batches, Math.round(batches) || 1));
    const inputs = recipe.inputs.map((x) => ({ name: x.name, need: x.qty * n, have: state.inventory.find((i) => i.name === x.name)?.qty ?? 0 }));
    const hours = (recipe.hours ?? 2) * n;
    const tool = toolAccess(state, recipe.craft);
    const needTier = toolTierFor(recipe.level);
    const cost = Math.round((recipe.cost_cc ?? 0) * n * locationMult(state));
    const rent = tool.rentPerHour && tool.tier >= needTier ? tool.rentPerHour * hours : 0;
    const level = skillOf(crafter, recipe.craft).level;
    let blocked;
    const short = inputs.find((x) => x.have < x.need);
    if (level < recipe.level)
        blocked = `${crafter.name}的${craftName(recipe.craft)}只有 Lv.${level}（要 Lv.${recipe.level}）`;
    else if (tool.tier < needTier)
        blocked = `要用${craftName(recipe.craft)}的${toolTierName(needTier)}（現在：${tool.source}）`;
    else if (short)
        blocked = `${short.name}不夠（需要 ${short.need}，持有 ${short.have}）`;
    else if (state.money_cc < cost + rent)
        blocked = `費用不夠（需要 ${formatMoney(cost + rent)}）`;
    return {
        name, recipe, batches: n, qty: (recipe.qty ?? 1) * n, inputs, cost, rent, fee: cost + rent,
        dc: rules.dc[recipe.level - 1] ?? 18, hours, level, tool, ...(blocked ? { blocked } : {}),
    };
}
/** 各成功程度做出的份數 */
export function producedQty(qty, degree) {
    const r = craftRules.recipe;
    if (degree === 'critical')
        return qty + Math.max(1, Math.ceil(qty * r.critical_bonus));
    if (degree === 'success')
        return qty;
    if (degree === 'partial')
        return Math.ceil(qty * r.partial_ratio);
    return 0;
}
/** 各成功程度用掉的材料：有做出東西時全部用掉，失敗損失一部分，大失敗全部損失 */
export function lostQty(need, degree) {
    return degree === 'fail' ? Math.ceil(need * craftRules.recipe.lost_on_fail) : need;
}
// ---- 行動 produce ----
export function produceTarget(crafter, name, batches = 1) {
    return `${crafter}@${name}*${batches}`;
}
export function parseProduceTarget(state, target) {
    const t = target ?? '';
    const at = t.indexOf('@');
    const star = t.lastIndexOf('*');
    const id = at > 0 ? t.slice(0, at) : 'pc';
    const name = t.slice(at + 1, star > at ? star : undefined);
    const batches = star > at ? Number(t.slice(star + 1)) || 1 : 1;
    const crafter = memberOrResident(state, currentArea(state), id);
    if (!crafter)
        throw new Error('隊伍中（或家裡）沒有這位角色');
    if (!recipeOf(name))
        throw new Error('請選擇要做的東西');
    return { crafter, name, batches };
}
export function setupProduce(state, target) {
    const { crafter, name, batches } = parseProduceTarget(state, target);
    const refusal = crafterRefusal(state, crafter);
    if (refusal)
        throw new Error(`${crafter.name}不肯動手：${refusal}`);
    const plan = recipePlan(state, name, batches, crafter);
    if (plan.blocked)
        throw new Error(plan.blocked);
    const skill = craftRules.skills[plan.recipe.craft];
    const used = plan.inputs.map((x) => `${x.name}×${x.need}`).join('、');
    const paid = plan.fee ? `，花費 ${formatMoney(plan.fee)}` : '';
    return {
        actor: crafter.id,
        attr: skill.attr, dc: plan.dc, hours: plan.hours,
        situational: [{ label: `${crafter.name}的${skill.name}（Lv.${plan.level}）`, value: plan.level * craftRules.level_bonus }],
        scene: `${locationById(state.location).name}・${crafter.isPlayer ? '' : `由${crafter.name}`}依配方製作${name}×${plan.qty}（${plan.tool.source}，材料 ${used}${paid}）`,
        targetName: name,
        outcomes: {
            critical: `做出 ${producedQty(plan.qty, 'critical')} 份${name}`,
            success: `做出 ${plan.qty} 份${name}`,
            partial: `只做出 ${producedQty(plan.qty, 'partial')} 份${name}，材料全部用掉`,
            fail: `沒做成，材料損失一半${plan.fee ? '，費用照付' : ''}`,
            fumble: `搞砸了，材料全部損失${plan.fee ? '，費用照付' : ''}`,
        },
    };
}
/** 結算：付費用、用掉材料、做出成品，再給做的人工藝經驗 */
export function applyProduce(state, report, target, degree) {
    const { crafter, name, batches } = parseProduceTarget(state, target);
    const plan = recipePlan(state, name, batches, crafter);
    const effects = plan.fee ? [{ type: 'money', amount: -Math.min(plan.fee, state.money_cc) }] : [];
    for (const x of plan.inputs) {
        const q = Math.min(x.have, lostQty(x.need, degree));
        if (q)
            effects.push({ type: 'item', name: x.name, qty: -q });
    }
    const made = producedQty(plan.qty, degree);
    if (made)
        effects.push({ type: 'item', name, qty: made });
    applyEffects(state, report, effects);
    const paid = plan.fee ? `花了 ${formatMoney(plan.fee)}（${[plan.cost ? '材料費' : '', plan.rent ? '工坊租金' : ''].filter(Boolean).join('、')}），` : '';
    let text = made ? `${paid}做出 ${made} 份${name}。` : `${paid}${degree === 'fail' ? '沒做成，損失了一半的材料' : '搞砸了，材料全部損失'}。`;
    const xp = craftXpFor(plan.recipe.level, degree);
    if (xp) {
        const level = gainCraftXp(crafter, plan.recipe.craft, xp);
        (report.changes.craft_xp ??= []).push({ actor: crafter.id, craft: plan.recipe.craft, amount: xp, ...(level ? { level } : {}) });
        text += `${crafter.name}的${craftName(plan.recipe.craft)}經驗 +${xp}${level ? `，升到 Lv.${level}` : ''}。`;
    }
    return text;
}
