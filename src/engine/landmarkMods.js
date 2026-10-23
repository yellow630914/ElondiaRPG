// 城鎮特色地標的自訂內容（docs/LANDMARKS.md、docs/CONTENT_EDITOR.md 3.9 節）。
// 內建的地標每一項都可以改（位置只能在同一個聚落裡移動），不能刪除；自建的地標可以擺在任何聚落，沒有被用到時可以刪除。
import { ATTR_IDS, geography, isLandmarkId, landmarkJob, landmarks, landmarkTypes, npcs as namedNpcs, perkRules, stories, workRules, } from './data';
import { cleanFlag } from './storyFlags';
import { sanitizeEffects } from './storyMods';
import { blockKeys, CELL_ICON, invalidateBlocks, settlementArea } from './grid';
export const LANDMARK_LIMITS = {
    name_chars: 12, desc_chars: 200, scene_chars: 200, types: 4, title_chars: 16, flags: 4,
    money: [0, 100_000], hours: [0.5, 24], cooldown: [1, 60], dc: [5, 30], rate_cc: [0, 100], reputation: [0, 100], effects: 6,
};
/** 參訪與探索可以用的效果（不能讓主角淪為奴隸、開始特殊任務或讓人入隊） */
export const LANDMARK_EFFECTS = ['money', 'item', 'gear', 'xp', 'reputation', 'affinity', 'memory', 'ability', 'hp', 'perk', 'condition', 'tattoo'];
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v, [lo, hi], fallback, step = 1) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(Math.max(lo, Math.min(hi, n)) / step) * step : fallback;
};
const effects = (v) => sanitizeEffects(v).filter((e) => LANDMARK_EFFECTS.includes(e.type)).slice(0, LANDMARK_LIMITS.effects);
const flags = (v) => [...new Set((Array.isArray(v) ? v : []).map(cleanFlag).filter(Boolean))].slice(0, LANDMARK_LIMITS.flags);
const clone = (v) => JSON.parse(JSON.stringify(v));
/** 內建地標的快照（模組載入時） */
const snapshot = clone(landmarks);
export function builtinLandmark(id) {
    return snapshot[id] ? clone(snapshot[id]) : undefined;
}
export function newLandmarkId() {
    return `lm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
/** 新地標：擺在這個聚落第一格空地（道路）上（之後在表單上改） */
export function newLandmark(id, location = geography.locations.find((l) => l.type !== 'dungeon').id) {
    for (const key of blockKeys(location)) {
        const area = settlementArea(key);
        const i = area?.cells.findIndex((c) => c.kind === 'floor') ?? -1;
        if (area && i >= 0) {
            return { id, name: '新的地標', emoji: '📍', location, at: { area: key, x: i % area.width, y: Math.floor(i / area.width) }, desc: '', types: [], custom: true };
        }
    }
    throw new Error('這個聚落沒有空地可以擺地標');
}
/** 整理地標：內建的不能換聚落；位置要是那個聚落的一個區塊（是不是空地在存的時候檢查） */
export function sanitizeLandmarkMod(id, raw) {
    if (!isLandmarkId(id))
        throw new Error('地標的 id 要是 lm_ 開頭');
    const base = builtinLandmark(id);
    const L = LANDMARK_LIMITS;
    const area = typeof raw.at?.area === 'string' ? settlementArea(raw.at.area, false) : undefined;
    const location = base?.location ?? area?.location ?? '';
    if (!geography.locations.some((l) => l.id === location && l.type !== 'dungeon'))
        throw new Error('地標要擺在聚落裡');
    const at = area && area.location === location
        && Number.isInteger(raw.at.x) && Number.isInteger(raw.at.y) && raw.at.x >= 0 && raw.at.y >= 0 && raw.at.x < area.width && raw.at.y < area.height
        ? { area: area.key, x: raw.at.x, y: raw.at.y }
        : base?.at;
    if (!at)
        throw new Error('請在小地圖上選一格');
    const out = {
        id,
        name: str(raw.name, L.name_chars) || base?.name || '新的地標',
        emoji: str(raw.emoji, 8) || base?.emoji || '📍',
        location,
        at,
        desc: str(raw.desc, L.desc_chars),
        types: [...new Set((Array.isArray(raw.types) ? raw.types : []).filter((t) => !!landmarkTypes[t]))].slice(0, L.types),
    };
    const scene = str(raw.scene, L.scene_chars);
    if (scene)
        out.scene = scene;
    // 開放條件
    if (raw.open) {
        const o = {};
        if (raw.open.hours === 'day' || raw.open.hours === 'night')
            o.hours = raw.open.hours;
        const f = flags(raw.open.flags);
        const fn = flags(raw.open.flags_none);
        if (f.length)
            o.flags = f;
        if (fn.length)
            o.flags_none = fn;
        const rep = num(raw.open.min_reputation, L.reputation, 0);
        if (rep)
            o.min_reputation = rep;
        if (raw.open.official)
            o.official = true;
        if (Object.keys(o).length)
            out.open = o;
    }
    // 參訪：要有名稱，而且花錢、花時間或有效果
    if (raw.visit && str(raw.visit.title, L.title_chars)) {
        const v = { title: str(raw.visit.title, L.title_chars), effects: effects(raw.visit.effects) };
        if (str(raw.visit.desc, L.desc_chars))
            v.desc = str(raw.visit.desc, L.desc_chars);
        const money = num(raw.visit.money_cc, L.money, 0);
        if (money)
            v.money_cc = money;
        v.hours = num(raw.visit.hours, L.hours, 0.5, 0.5);
        const cd = num(raw.visit.cooldown_days, L.cooldown, 1);
        if (cd !== 1)
            v.cooldown_days = cd;
        out.visit = v;
    }
    // 探索：檢定
    if (raw.explore && str(raw.explore.title, L.title_chars)) {
        const e = {
            title: str(raw.explore.title, L.title_chars),
            attr: ATTR_IDS.includes(raw.explore.attr) ? raw.explore.attr : 'int',
            dc: num(raw.explore.dc, L.dc, 12),
            hours: num(raw.explore.hours, L.hours, 2, 0.5),
            effects: effects(raw.explore.effects),
        };
        if (str(raw.explore.desc, L.desc_chars))
            e.desc = str(raw.explore.desc, L.desc_chars);
        const crit = effects(raw.explore.critical);
        if (crit.length)
            e.critical = crit;
        const cd = num(raw.explore.cooldown_days, L.cooldown, 7);
        if (cd !== 7)
            e.cooldown_days = cd;
        out.explore = e;
    }
    // 打工
    if (raw.work) {
        out.work = {
            attr: ATTR_IDS.includes(raw.work.attr) ? raw.work.attr : 'cha',
            dc: num(raw.work.dc, L.dc, 12),
            rate_cc: num(raw.work.rate_cc, L.rate_cc, 3),
            desc: str(raw.work.desc, L.desc_chars) || '在這裡幫忙。',
        };
    }
    if (!base)
        out.custom = true;
    return out;
}
/** 把地標還原成內建的樣子（自建的拿掉） */
export function restoreLandmarks() {
    for (const id of Object.keys(landmarks)) {
        delete workRules.jobs[id];
        if (snapshot[id])
            continue;
        delete landmarks[id];
        delete CELL_ICON[id];
    }
    for (const [id, l] of Object.entries(snapshot)) {
        landmarks[id] = clone(l);
        CELL_ICON[id] = l.emoji;
        const job = landmarkJob(l);
        if (job)
            workRules.jobs[id] = job;
    }
    invalidateBlocks();
}
export function applyLandmarkMod(id, m) {
    const { custom: _custom, ...def } = clone(m);
    landmarks[id] = { ...def, id };
    CELL_ICON[id] = def.emoji;
    const job = landmarkJob(landmarks[id]);
    if (job)
        workRules.jobs[id] = job;
    else
        delete workRules.jobs[id];
    invalidateBlocks();
}
/** 哪些地方用到這個地標：特殊任務的任務點、待在這裡的固定 NPC */
export function landmarkUsage(id) {
    const out = [];
    for (const s of stories) {
        for (const n of s.nodes)
            if (n.at.where === 'cell' && n.at.cell === id)
                out.push(`特殊任務「${s.title}」的任務點「${n.title}」`);
    }
    for (const n of namedNpcs)
        if (n.landmark === id)
            out.push(`固定 NPC「${n.name}」待在這裡`);
    return out;
}
/** 在這個地標受訓的特質（存在特質的受訓地點上） */
export function landmarkTraining(id) {
    return perkRules.perks.filter((p) => p.train?.cells.includes(id)).map((p) => p.id);
}
