// 把遊戲中生成的人存成固定 NPC（人際關係的「📌 存成固定 NPC」）：內容頁籤可以再編輯，之後的存檔也會出現。
// 沿用同一個 id：目前存檔裡的親密度、關係與記憶都接得上；存檔裡的這筆紀錄改成不是生成的（名單輪替不會換掉他）。
import { npcs as namedNpcs } from './data';
import { gearKnown } from './gear';
import { sanitizeNpc } from './mods';
import { characterFor, npcRecord } from './npcs';
/** 可以存成固定 NPC 的人：遊戲中生成、還不是固定 NPC（主角不行） */
export function canPromote(state, id) {
    if (id === 'pc' || namedNpcs.some((n) => n.id === id))
        return false;
    return !!npcRecord(state, id)?.generated;
}
/** 依存檔裡這個人目前的樣子產生固定 NPC 的設定（隊伍裡的用隊伍裡的資料） */
export function npcModFromState(state, id) {
    const rec = npcRecord(state, id);
    if (!rec || !canPromote(state, id))
        throw new Error('這個人不能存成固定 NPC');
    const c = state.party.find((m) => m.id === id) ?? characterFor(state, rec);
    const rel = state.relationships?.[id];
    const gear = Object.fromEntries(Object.entries(c.gear ?? {}).filter(([, g]) => g && gearKnown(g.spec)).map(([slot, g]) => [slot, { ...g.spec }]));
    // 生成的店主（keeper_地點_店種）：存成擔任那間店的店主
    const keeper = /^keeper_(.+)_(\w+)$/.exec(id);
    return sanitizeNpc(id, {
        ...rec,
        level: c.level,
        location: keeper?.[1] ?? rec.location ?? state.location,
        appearance: rec.appearance || rel?.appearance,
        attrs: { ...c.attrs },
        abilities: [...c.abilities],
        ...(c.perks?.length ? { perks: [...c.perks] } : {}),
        ...(Object.keys(gear).length ? { gear } : {}),
        ...(keeper ? { keeper: keeper[2] } : {}),
    }, true);
}
/** 存成固定 NPC 之後：存檔裡的紀錄不再是生成的 */
export function markPromoted(state, id) {
    const rec = state.npcs?.[id];
    if (rec)
        delete rec.generated;
}
