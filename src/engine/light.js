// 光線與光源（見 docs/DUNGEON_DESIGN.md 第 4 節）：
// - 每個區域有光線：lit（一直有光）、daylight（白天有光、晚上黑暗）、dark（一直黑暗），資料在 maps.json 的 lighting。
// - 在黑暗的地方每走一格燒掉一點光源：火把一捆、油燈的燈油用完自動點下一份；魔法照明石不會燒掉。
// - 黑暗又沒有光：視野只剩腳下、戰鬥中隊伍命中降低、察覺陷阱更難。
import mapsJson from '@data/world/maps.json';
import { itemDef } from './data';
import { removeItem } from './state';
import { toolValue } from './tools';
export const lightingRules = mapsJson.lighting;
export const LIGHTING_NAME = { lit: '有光', daylight: '白天有光、晚上黑暗', dark: '黑暗' };
/** 地下城某一層的光線 */
export function layerLighting(location, layer) {
    const list = lightingRules.locations[location] ?? lightingRules.dungeon_layers;
    return list[layer] ?? list.at(-1) ?? 'dark';
}
/** 區域的光線（生成時記在區域上；舊存檔的區域依種類推算） */
export function areaLighting(area) {
    if (area.lighting)
        return area.lighting;
    switch (area.kind) {
        case 'wild': return lightingRules.wild;
        case 'dungeon': return layerLighting(area.location, area.layer ?? 0);
        case 'side': return 'dark';
        default: return 'lit';
    }
}
export function isNight(time) {
    const h = time.hour ?? 0;
    const [from, to] = lightingRules.day_hours;
    return h < from || h >= to;
}
/** 這個區域現在暗不暗（不管有沒有光源） */
export function isDark(state, area) {
    const l = areaLighting(area);
    return l === 'dark' || (l === 'daylight' && isNight(state.time));
}
/** 行囊裡的照明工具 */
export function lightSources(state) {
    const out = [];
    for (const i of state.inventory) {
        if (i.qty <= 0)
            continue;
        const def = itemDef(i.name);
        if (def?.tool?.kind !== 'light')
            continue;
        const fuel = def.tool.fuel;
        const burns = fuel ? itemDef(fuel)?.burns : def.burns;
        const spare = fuel ? state.inventory.find((x) => x.name === fuel)?.qty ?? 0 : burns ? i.qty : 0;
        out.push({ name: i.name, bonus: toolValue(def.tool), permanent: !fuel && !burns, ...(fuel ? { fuel } : {}), ...(burns ? { burns } : {}), spare });
    }
    return out;
}
/** 現在亮著的光：不會燒掉的優先，其次是正在燒的那一份 */
export function currentLight(state) {
    const sources = lightSources(state);
    const permanent = sources.filter((s) => s.permanent).sort((a, b) => b.bonus - a.bonus)[0];
    if (permanent)
        return { name: permanent.name, bonus: permanent.bonus, permanent: true };
    const burning = state.light;
    if (!burning || burning.left <= 0)
        return undefined;
    const def = itemDef(burning.item);
    // 油燈賣掉或丟掉了：火也熄了
    if (def?.tool?.fuel && !state.inventory.some((i) => i.name === burning.item && i.qty > 0))
        return undefined;
    return { name: burning.item, bonus: def?.tool ? toolValue(def.tool) : 1, permanent: false, left: burning.left };
}
/** 沒有亮著的光時，點起行囊裡最好的一份（加值高的優先，一樣時先用燒燈油的）；回傳點起來的光源名稱 */
export function ensureLight(state) {
    if (currentLight(state))
        return undefined;
    delete state.light;
    const ready = lightSources(state).filter((s) => !s.permanent && s.burns && s.spare > 0)
        .sort((a, b) => b.bonus - a.bonus || Number(!!b.fuel) - Number(!!a.fuel));
    const pick = ready[0];
    if (!pick)
        return undefined;
    removeItem(state.inventory, pick.fuel ?? pick.name, 1);
    state.light = { item: pick.name, left: pick.burns };
    return pick.name;
}
/** 在黑暗的地方走了一格：燒掉一點光（必要時先點起來）；回傳新點起的光源名稱 */
export function burnStep(state, area) {
    if (!isDark(state, area))
        return undefined;
    const lit = ensureLight(state);
    const light = currentLight(state);
    if (light && !light.permanent && state.light) {
        state.light.left -= 1;
        if (state.light.left <= 0)
            delete state.light;
    }
    return lit;
}
/** 黑暗又沒有光：受黑暗的懲罰 */
export function inDarkness(state, area) {
    return isDark(state, area) && !currentLight(state);
}
/** 視野：暗的地方要有光才看得到（光源越好看得越遠）；亮的地方 1 格 */
export function sightIn(state, area) {
    if (!isDark(state, area))
        return 1;
    ensureLight(state);
    const light = currentLight(state);
    return light ? 1 + light.bonus : lightingRules.dark.sight;
}
