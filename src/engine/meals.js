// 酒館用餐：全隊一起吃，價格是每人（economy.json 的 meals_cc 乘上地點的物價倍率），吃完得到用餐或喝酒的狀態。
// 狀態的效果寫在 companions.json 的 conditions（果腹、飽足、美食、盛宴、興致高昂、微醺），下次長休時解除。
import { snapshot } from './character';
import { companionRules, conditionName, economy, itemRules, locationById, regionById } from './data';
import { formatMoney } from './money';
import { gainCondition, pcOf } from './party';
import { currentArea, currentCell } from './grid';
import { addHours, commitReport, newReportId } from './state';
import { locationMult, locationRank } from './trade';
const SIZE_NAME = { town: '城鎮', city: '城市', capital: '王都' };
function mealPrice(state, id) {
    const v = economy.meals_cc[id] ?? 1;
    const base = Array.isArray(v) ? (v[0] + v[1]) / 2 : v;
    return Math.max(1, Math.round(base * locationMult(state)));
}
/** 這裡酒館的菜單 */
export function mealMenu(state) {
    const rank = locationRank(locationById(state.location).type);
    return itemRules.meals.menu.map((m) => {
        const price = mealPrice(state, m.id);
        const short = m.min_location && locationRank(m.min_location) > rank;
        return {
            ...m, price, total: price * state.party.length,
            desc: companionRules.conditions[m.condition]?.desc ?? '',
            ...(short ? { unavailable: `${SIZE_NAME[m.min_location] ?? m.min_location}以上才有` } : {}),
        };
    });
}
/** 全隊在酒館用餐 */
export function eatMeal(state, id) {
    if (state.combat)
        throw new Error('戰鬥中不能這麼做');
    if (currentArea(state).kind !== 'settlement' || currentCell(state).kind !== 'tavern')
        throw new Error('要在酒館才能用餐');
    const meal = mealMenu(state).find((m) => m.id === id);
    if (!meal)
        throw new Error('菜單上沒有這道菜');
    if (meal.unavailable)
        throw new Error(`這裡吃不到${meal.name}（${meal.unavailable}）`);
    if (state.money_cc < meal.total)
        throw new Error('錢不夠');
    const start = { ...state.time };
    const loc = locationById(state.location);
    const pc = pcOf(state);
    const report = {
        schema_version: '0.1',
        report_id: newReportId(state),
        kind: 'event',
        time: { start, end: addHours(start, itemRules.meals.hours) },
        location: { at: state.location, region: loc.region, scene: `${loc.name}的酒館` },
        party: state.party.map((m) => snapshot(m, undefined, pc)),
        outcome: { result: 'success', tags: ['用餐'] },
        changes: { money_cc: -meal.total },
        narration: { pov: 'second_person', length: 'short' },
        lore_keys: [loc.name, regionById(loc.region).name],
    };
    const got = [];
    for (const m of state.party) {
        const c = gainCondition(m, meal.condition, report);
        if (c)
            got.push(`${m.name}${conditionName(c)}`);
    }
    if (!got.length)
        throw new Error(companionRules.conditions[meal.condition]?.group === 'meal' ? '大家都已經吃得比這更好了' : '大家都已經喝不下了');
    report.outcome.summary = `全隊在酒館點了${meal.name}，花費 ${formatMoney(meal.total)}：${got.join('、')}。`;
    return commitReport(state, report);
}
