import { useSettings } from '@/stores/settings';
// 主動行動要交給 AI 判定還是依規則判定：直接在行動旁邊切換（同「設定」裡的「AI 判定主動行動」）。
const settings = useSettings();
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(settings, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "judge-toggle small" },
});
/** @type {__VLS_StyleScopedClasses['judge-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (settings.value.ready('judge')) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        title: (settings.value.aiJudge ? '擲骰後交給 AI 判定並寫出經過' : '依規則判定（預設屬性與參考 DC）'),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (settings.value.aiJudge);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
        title: "在右上角的「設定」選擇 AI 服務後，主動行動可以交給 AI 判定",
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
// @ts-ignore
[settings, settings, settings,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
