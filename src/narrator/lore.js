// 世界書：把世界書檔案的條目整理成可以調整的清單，再依報告或行動挑選要注入的條目。
// 世界書正文是簡體、遊戲資料是繁體，比對關鍵字前先把文字轉成簡體（兩種寫法都比對）。
//
// 每個條目有一種注入方式：
//   constant 常駐：每次都注入，放在 system 前段（不太變動，可以被快取）
//   keyword  關鍵字：報告或行動的文字命中關鍵字時注入，放在 user 後段
//   travel   旅行：只有旅行報告注入
//   off      停用
// 預設值依下面的常數決定；玩家可以在「提示詞」頁籤覆寫（見 src/stores/prompts.ts）。
import { Converter } from 'opencc-js/t2cn';
// 世界觀、勢力概述、神祇：常駐
const ALWAYS = [0, 28, 44];
// 視角和文風：改由「文風」條目管理，預設停用
const STYLE = 5;
// 世界書裡寫死的玩家名，注入時換成主角名
const HARDCODED_NAME = '沈頤';
// 地標相對位置：旅行報告才注入
const TRAVEL_ONLY = [46];
// 改由引擎實作或與遊戲 UI 衝突的條目：預設停用
const EXCLUDED = new Set([1, 2, 3, 4, 8, 10, 11, 29, 30, 31]);
// 成人向條目：設定開啟才注入；其中 38、39 是敘事法則，開啟時常駐
const ADULT = new Set([16, 17, 18, 38, 39]);
const ADULT_CONSTANT = new Set([38, 39]);
// 巨龍條目沒有關鍵字，以「龍」觸發
const DRAGON = 45;
/** 玩家新增的條目 uid 從這裡開始，避免和世界書檔案衝突 */
export const CUSTOM_LORE_UID = 100000;
const toSimplified = Converter({ from: 'tw', to: 'cn' });
let cached = null;
export function loadWorldbook() {
    cached ??= import('@data/worldbook/elondia.worldbook.json').then((m) => m.default);
    return cached;
}
/** 內建條目的預設注入方式 */
export function defaultLoreItem(e) {
    const base = { uid: e.uid, comment: e.comment, content: e.content, keys: e.key.filter(Boolean), order: e.order, adult: ADULT.has(e.uid), builtin: true };
    if (e.disable)
        return { ...base, mode: 'off', note: '世界書檔案中已停用' };
    if (ALWAYS.includes(e.uid))
        return { ...base, mode: 'constant', note: '世界觀基礎，預設常駐' };
    if (e.uid === STYLE)
        return { ...base, mode: 'off', note: '文風改由「文風」條目管理；需要時可以開啟' };
    if (TRAVEL_ONLY.includes(e.uid))
        return { ...base, mode: 'travel', note: '只在旅行報告注入' };
    if (EXCLUDED.has(e.uid))
        return { ...base, mode: 'off', note: '規則已由遊戲引擎實作，或是聊天用的格式指示' };
    if (ADULT_CONSTANT.has(e.uid))
        return { ...base, mode: 'constant', note: '成人向：設定開啟時常駐' };
    if (e.uid === DRAGON)
        return { ...base, mode: 'keyword', keys: ['龍', '龙'], note: '原本沒有關鍵字，以「龍」觸發' };
    return { ...base, mode: 'keyword' };
}
/** 套用覆寫並加上玩家新增的條目，依注入順序排序 */
export function loreItems(book, overrides = {}, custom = []) {
    const builtin = Object.values(book.entries)
        .filter((e) => e.content.trim())
        .map((e) => {
        const d = defaultLoreItem(e);
        const o = overrides[e.uid];
        return o && Object.keys(o).length ? { ...d, ...o, edited: true } : d;
    });
    return [...builtin, ...custom.map((c) => ({ ...c, builtin: false }))].sort((a, b) => a.order - b.order || a.uid - b.uid);
}
export const LORE_STATUS_NAME = {
    constant: '常駐',
    triggered: '觸發',
    idle: '未觸發',
    off: '停用',
    adult: '成人（未開啟）',
    budget: '超出字數上限',
};
function withPlayerName(content, playerName) {
    return content.split(HARDCODED_NAME).join(playerName).split('{{player}}').join(playerName);
}
export function pickLore(items, q, opts) {
    const haystack = q.text + '\n' + toSimplified(q.text);
    const states = {};
    const wanted = [];
    for (const it of items) {
        if (it.mode === 'off' || !it.content.trim()) {
            states[it.uid] = { status: 'off' };
            continue;
        }
        if (it.adult && !opts.adult) {
            states[it.uid] = { status: 'adult' };
            continue;
        }
        if (it.mode === 'constant') {
            wanted.push({ item: it, constant: true });
            continue;
        }
        const hit = it.mode === 'travel' ? (q.travel ? '旅行報告' : undefined) : it.keys.find((k) => k && haystack.includes(k));
        if (hit) {
            states[it.uid] = { status: 'triggered', hit };
            wanted.push({ item: it, constant: false });
        }
        else {
            states[it.uid] = { status: 'idle' };
        }
    }
    // 常駐條目排前面，所以字數不夠時優先保留；兩組內部都依注入順序
    wanted.sort((a, b) => Number(b.constant) - Number(a.constant) || a.item.order - b.item.order || a.item.uid - b.item.uid);
    const result = { constant: [], triggered: [], states, chars: 0 };
    let position = 0;
    for (const { item, constant } of wanted) {
        const content = withPlayerName(item.content, opts.playerName);
        if (result.chars + content.length > opts.budgetChars && position > 0) {
            states[item.uid] = { ...states[item.uid], status: 'budget' };
            continue;
        }
        position += 1;
        result.chars += content.length;
        states[item.uid] = { ...(constant ? { status: 'constant' } : states[item.uid]), position };
        (constant ? result.constant : result.triggered).push({ ...item, content });
    }
    return result;
}
/** 報告裡拿來比對關鍵字的文字 */
export function reportLoreText(report) {
    return [
        ...(report.lore_keys ?? []),
        report.location.scene ?? '',
        report.outcome.summary ?? '',
        ...(report.others ?? []).map((o) => o.name),
        ...(report.party ?? []).map((p) => p.personality ?? ''),
    ].join('\n');
}
export function loreForReport(items, report, opts) {
    return pickLore(items, { text: reportLoreText(report), travel: report.kind === 'travel' }, opts);
}
/** 以預設設定挑選報告的世界書（常駐在前、觸發在後） */
export function selectLore(book, report, opts, overrides) {
    const sel = loreForReport(loreItems(book, overrides), report, opts);
    return [...sel.constant, ...sel.triggered];
}
/** 匯出成 SillyTavern 世界書格式（含玩家的修改與新增條目），也可以匯入回本遊戲 */
export function exportWorldbook(items, name = '埃隆迪亞大陸') {
    const entries = {};
    for (const it of items) {
        const ext = { mode: it.mode, adult: it.adult, builtin: it.builtin };
        entries[it.uid] = {
            uid: it.uid,
            key: it.keys,
            keysecondary: [],
            comment: it.comment,
            content: it.content,
            constant: it.mode === 'constant',
            selective: true,
            order: it.order,
            position: 0,
            disable: it.mode === 'off',
            extensions: { elondia: ext },
        };
    }
    return { name, entries };
}
/** 讀取世界書檔案：SillyTavern 格式（entries 物件或陣列），或本遊戲匯出的檔案 */
export function parseWorldbookFile(raw) {
    const r = raw;
    const list = Array.isArray(r) ? r : r && typeof r === 'object' && r.entries && typeof r.entries === 'object' ? Object.values(r.entries) : null;
    if (!list)
        throw new Error('這不是世界書檔案（找不到 entries）');
    const strings = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === 'string' && !!k.trim()).map((k) => k.trim()) : []);
    const out = [];
    for (const e of list) {
        if (!e || typeof e !== 'object' || typeof e.content !== 'string' || !e.content.trim())
            continue;
        const ext = (e.extensions?.elondia ?? {});
        const mode = ext.mode && ['constant', 'keyword', 'travel', 'off'].includes(ext.mode)
            ? ext.mode
            : e.disable ? 'off' : e.constant ? 'constant' : 'keyword';
        out.push({
            ...(typeof e.uid === 'number' ? { uid: e.uid } : {}),
            comment: typeof e.comment === 'string' && e.comment.trim() ? e.comment.trim() : String(e.content).trim().slice(0, 16),
            content: e.content,
            keys: strings(e.key ?? e.keys),
            mode,
            order: typeof e.order === 'number' ? e.order : 700,
            adult: !!ext.adult,
            builtin: !!ext.builtin,
        });
    }
    return out;
}
