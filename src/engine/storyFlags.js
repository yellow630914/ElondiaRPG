// 劇情旗標：特殊任務、固定 NPC、旅途與情報事件共用（見 docs/STORY_QUESTS.md）。
//
// 作者寫的旗標名稱（例如 met_elder）存在 GameState.flags 的 story:<名稱>，和程式自己用的旗標分開。
// 名稱以 ai: 開頭時直接讀 AI 判定寫下的旗標（例如 ai:答應幫忙），讓劇情可以接上 AI 的判定。
export const STORY_PREFIX = 'story:';
export function flagKey(name) {
    return name.startsWith('ai:') ? name : `${STORY_PREFIX}${name}`;
}
export function hasFlag(state, name) {
    const v = state.flags[flagKey(name)];
    return v !== undefined && v !== false && v !== 0 && v !== '';
}
export function setFlag(state, name, value = true) {
    state.flags[flagKey(name)] = value;
}
export function clearFlag(state, name) {
    delete state.flags[flagKey(name)];
}
/** 條件成立：flags 全部有、flags_none 全部沒有（沒有條件時成立） */
export function condMet(state, cond) {
    if (!cond)
        return true;
    return (cond.flags ?? []).every((f) => hasFlag(state, f)) && (cond.flags_none ?? []).every((f) => !hasFlag(state, f));
}
/** 目前成立的劇情旗標（名稱，不含前綴） */
export function storyFlags(state) {
    return Object.keys(state.flags)
        .filter((k) => k.startsWith(STORY_PREFIX) && hasFlag(state, k.slice(STORY_PREFIX.length)))
        .map((k) => k.slice(STORY_PREFIX.length));
}
/** 整理旗標名稱：去掉空白與前綴，最多 40 字 */
export function cleanFlag(name) {
    if (typeof name !== 'string')
        return '';
    return name.trim().replace(/^story:/, '').replace(/\s+/g, '_').slice(0, 40);
}
