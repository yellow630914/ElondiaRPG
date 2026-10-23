// 主人的家怎麼取得：masterHome.ts 載入時登記，homes.ts 依 id 找房子時用。
// 主人的家不存進 state.homes（由 masterHome.ts 依存檔即時產生），而 homes.ts 和 masterHome.ts 經由其他模組互相 import。
// 登記處獨立成這個沒有 import 的小模組：不管哪個模組先載入，都不會用到還沒初始化的變數。
const registry = {};
export function setMasterHomeResolver(fn) {
    registry.masterHome = fn;
}
/** 目前主人的家（masterHome.ts 還沒載入時沒有） */
export function resolveMasterHome(state) {
    return registry.masterHome?.(state);
}
