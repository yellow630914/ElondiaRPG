import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { cellAt, CELL_ICON, cellName, currentArea, isRevealed, position, sight } from '@/engine/grid';
import { itemDef, locationById } from '@/engine/data';
import { cropStatus } from '@/engine/garden';
import { homeById } from '@/engine/homes';
import { isHostile, peopleHere } from '@/engine/population';
import { useGame } from '@/stores/game';
const game = useGame();
const area = computed(() => currentArea(game.state));
const pos = computed(() => position(game.state));
const ICON = CELL_ICON;
const EVENT_ICON = { special: '⭐', master: '⛓️', advanced: '✨' };
function icon(cell) {
    // 房子：家具、樓梯、門；城裡買下的房子
    // 苗圃上的作物：成熟 🌾、還在長 🌿
    if (cell.crop && game.state)
        return cropStatus(game.state, cell)?.ready ? '🌾' : '🌿';
    if (cell.furniture)
        return itemDef(cell.furniture)?.furniture?.icon ?? '🪑';
    if (cell.dir)
        return { up: '⬆️', down: '⬇️', out: '🚪' }[cell.dir];
    if (cell.home)
        return game.state && homeById(game.state, cell.home)?.master ? '🏚️' : '🏠';
    if (cell.done && ['encounter', 'elite', 'boss', 'resource', 'trap', 'chest'].includes(cell.kind))
        return '';
    if (cell.kind === 'trap')
        return '';
    if (cell.kind === 'resource' && cell.item && /礦|錢/.test(cell.item))
        return '💎';
    // 旅途的事件：依種類顯示（出發時就擲好了）
    if (cell.kind === 'event' && !cell.done)
        return EVENT_ICON[cell.event?.tier ?? ''] ?? '❔';
    if (cell.kind === 'event' || cell.kind === 'road')
        return '';
    // 特殊任務的任務點是 ⭐，委託地點是 ❗
    if (cell.kind === 'quest' && cell.storyNode)
        return '⭐';
    if (cell.kind === 'quest' && !game.state?.quests.some((q) => q.id === cell.questId && q.status === 'accepted'))
        return '';
    return ICON[cell.kind] ?? '';
}
function label(cell) {
    if (cell.crop && game.state) {
        const c = cropStatus(game.state, cell);
        return `${cell.furniture}：種著${cell.crop.seed}${c?.ready ? '，可以收成了' : `，還要 ${c?.hoursLeft ?? 0} 小時`}`;
    }
    if (cell.furniture)
        return `家具：${cell.furniture}`;
    if (cell.dir)
        return { up: '往樓上', down: '往樓下', out: '出門' }[cell.dir];
    if (cell.home) {
        const h = game.state ? homeById(game.state, cell.home) : undefined;
        return h?.master ? `主人的家：${h.name}` : `你的房子：${h?.name ?? ''}`;
    }
    if (cell.kind === 'lot')
        return '待售的房子';
    if (cell.kind === 'manor')
        return '民宅（大門緊閉，不能進入）';
    if (cell.kind === 'trap' && !cell.done)
        return '道路';
    if (cell.kind === 'trap')
        return '已觸發的陷阱';
    if (cell.kind === 'quest' && cell.storyNode)
        return '特殊任務的任務點';
    if (cell.town)
        return `${cell.kind === 'arrive' ? '目的地' : cell.kind === 'waypoint' ? '途經' : '出發'}：${locationById(cell.town).name}`;
    if (cell.kind === 'event')
        return cell.done ? '走過的路' : { special: '特殊事件', master: '主人的事件', advanced: '高階事件' }[cell.event?.tier ?? ''] ?? '事件';
    if (cell.kind === 'road')
        return cell.road?.paid ? '走過的路' : '路';
    return cellName(cell.kind) + (cell.done ? '（已清除）' : '') + (cell.item && !cell.done ? `：${cell.item}` : '');
}
// 地圖上的人：每格標出人數，敵對的人用紅色
const people = computed(() => {
    const map = new Map();
    for (const p of peopleHere(game.state)) {
        const k = `${p.x},${p.y}`;
        map.set(k, [...(map.get(k) ?? []), p]);
    }
    return map;
});
function peopleTitle(list) {
    return list.map((p) => p.rec.name).join('、');
}
const rows = computed(() => Array.from({ length: area.value.height }, (_, y) => Array.from({ length: area.value.width }, (_, x) => {
    const cell = cellAt(area.value, x, y);
    const seen = isRevealed(area.value, x, y);
    const here = pos.value.x === x && pos.value.y === y;
    const adjacent = Math.abs(pos.value.x - x) + Math.abs(pos.value.y - y) === 1;
    const blocked = cell.kind === 'wall' || cell.kind === 'water';
    const who = seen ? people.value.get(`${x},${y}`) ?? [] : [];
    // 沒看過的相鄰格也能點：摸黑往前走，走不過去就跳「那邊走不過去」
    return { x, y, cell, seen, here, who, canStep: adjacent && (!seen || !blocked) };
})));
// 撞牆：主角那一格晃一下，地圖角落淡淡提示（浮在地圖上，不推動版面）
const bumping = ref(false);
let bumpTimer;
watch(() => game.bump, () => {
    bumping.value = false;
    clearTimeout(bumpTimer);
    requestAnimationFrame(() => {
        bumping.value = true;
        bumpTimer = setTimeout(() => (bumping.value = false), 900);
    });
});
onBeforeUnmount(() => clearTimeout(bumpTimer));
// 一片漆黑時（視野 0）地圖右上角常駐提示：走路揭不開迷霧，提醒先點火把或等天亮
const dark = computed(() => sight(game.state, area.value) <= 0);
function step(x, y) {
    // 和方向鍵同一條路：走不過去時只晃一下、跳提示
    game.move(x - pos.value.x, y - pos.value.y);
}
const KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};
function onKey(e) {
    const target = e.target;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        return;
    const dir = KEYS[e.key];
    if (!dir || game.state?.combat)
        return;
    e.preventDefault();
    game.move(dir[0], dir[1]);
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(bumping, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(dark, {});
// @ts-ignore
__VLS_withDotValue(area, {});
void {};
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['done']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['done']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['step']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['npc']} */ ;
/** @type {__VLS_StyleScopedClasses['npc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "map-wrap" },
});
/** @type {__VLS_StyleScopedClasses['map-wrap']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    name: "bump-tip",
}));
const __VLS_2 = __VLS_1({
    name: "bump-tip",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_nonNull(__VLS_3.slots);
if (bumping.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bump-tip small" },
    });
    /** @type {__VLS_StyleScopedClasses['bump-tip']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (game.value.bumpText || '那邊走不過去');
}
else if (dark.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bump-tip small" },
    });
    /** @type {__VLS_StyleScopedClasses['bump-tip']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
// @ts-ignore
[bumping, game, dark,];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "map" },
    ...{ style: ({ '--w': area.value.width }) },
});
/** @type {__VLS_StyleScopedClasses['map']} */ ;
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(rows, {})));
for (const [row] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.template)({
        key: (row[0].y),
    });
    const __VLS_7 = __VLS_tryAsConstant((row));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (step(c.x, c.y));
                    // @ts-ignore
                    [area, rows,];
                } },
            key: (`${c.x},${c.y}`),
            ...{ class: "cell" },
            ...{ class: ([c.seen ? c.cell.kind : 'fog', { here: c.here, step: c.canStep, done: c.cell.done, bump: c.here && bumping.value }]) },
            disabled: (!c.canStep),
            title: (c.seen ? label(c.cell) + (c.who.length ? `\n👤 ${peopleTitle(c.who)}` : '') : '未探索'),
        });
        /** @type {__VLS_StyleScopedClasses['cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['here']} */ ;
        /** @type {__VLS_StyleScopedClasses['step']} */ ;
        /** @type {__VLS_StyleScopedClasses['done']} */ ;
        /** @type {__VLS_StyleScopedClasses['bump']} */ ;
        if (c.here) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        }
        else if (c.seen) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (icon(c.cell));
        }
        if (c.who.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "npc" },
                ...{ class: ({ hostile: c.who.some((p) => __VLS_unwrap(isHostile, {})(game.value.state, p.rec)), many: c.who.length > 1 }) },
            });
            /** @type {__VLS_StyleScopedClasses['npc']} */ ;
            /** @type {__VLS_StyleScopedClasses['hostile']} */ ;
            /** @type {__VLS_StyleScopedClasses['many']} */ ;
            (c.who.length > 1 ? c.who.length : '');
        }
        // @ts-ignore
        [bumping, game, isHostile,];
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted hint" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
