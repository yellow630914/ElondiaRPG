import { computed, onMounted, ref, watch } from 'vue';
import { portraitSubject } from '@/narrator/imageInfo';
import { useGame } from '@/stores/game';
import { useImageSettings } from '@/stores/image';
import { portraitKey, usePortraits } from '@/stores/portraits';
const { defineProps, withDefaults, } = {};
const props = withDefaults(defineProps(), { size: 'large' });
const game = useGame();
const image = useImageSettings();
const portraits = usePortraits();
const s = computed(() => game.state);
const key = computed(() => portraitKey(s.value, props.id));
const url = computed(() => portraits.urls[key.value]);
const record = computed(() => portraits.records[key.value]);
const job = computed(() => portraits.jobs[key.value]);
const canDescribe = computed(() => !!portraitSubject(s.value, props.id));
const zoom = ref(false);
const fileInput = ref(null);
onMounted(() => void portraits.load(key.value));
watch(key, (k) => void portraits.load(k));
const preview = computed(() => {
    if (!canDescribe.value)
        return '';
    try {
        return portraits.describe(s.value, props.id);
    }
    catch {
        return '';
    }
});
function generate() {
    portraits.clearError(key.value);
    void portraits.generate(s.value, props.id);
}
async function onFile(e) {
    const input = e.target;
    const f = input.files?.[0];
    input.value = '';
    if (!f)
        return;
    try {
        await portraits.upload(key.value, f);
    }
    catch (err) {
        game.error = err instanceof Error ? err.message : String(err);
    }
}
function remove() {
    if (confirm('刪除這張形象圖？'))
        void portraits.remove(key.value);
}
const STAGE = { tags: '預處理提示詞中…', image: '生成圖片中…', error: '' };
const __VLS_defaults = { size: 'large' };
void __VLS_defaults;
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(url, {});
// @ts-ignore
__VLS_withDotValue(zoom, {});
// @ts-ignore
__VLS_withDotValue(job, {});
// @ts-ignore
__VLS_withDotValue(STAGE, {});
// @ts-ignore
__VLS_withDotValue(portraits, {});
// @ts-ignore
__VLS_withDotValue(canDescribe, {});
// @ts-ignore
__VLS_withDotValue(image, {});
// @ts-ignore
__VLS_withDotValue(fileInput, {});
// @ts-ignore
__VLS_withDotValue(record, {});
// @ts-ignore
__VLS_withDotValue(preview, {});
void {};
/** @type {__VLS_StyleScopedClasses['top']} */ ;
/** @type {__VLS_StyleScopedClasses['frame']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['frame']} */ ;
/** @type {__VLS_StyleScopedClasses['frame']} */ ;
/** @type {__VLS_StyleScopedClasses['frame']} */ ;
/** @type {__VLS_StyleScopedClasses['prompt']} */ ;
/** @type {__VLS_StyleScopedClasses['zoom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "portrait" },
    ...{ class: (__VLS_ctx.size) },
});
/** @type {__VLS_StyleScopedClasses['portrait']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "top" },
});
/** @type {__VLS_StyleScopedClasses['top']} */ ;
if (url.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(url.value))
                    throw 0;
                return (zoom.value = true);
                // @ts-ignore
                [size, url, zoom,];
            } },
        ...{ class: "frame" },
        title: "點一下放大",
    });
    /** @type {__VLS_StyleScopedClasses['frame']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: (url.value),
        alt: "形象圖",
    });
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "frame empty" },
    });
    /** @type {__VLS_StyleScopedClasses['frame']} */ ;
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
    (job.value && job.value.stage !== 'error' ? '⏳' : '🖼️');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "side" },
});
/** @type {__VLS_StyleScopedClasses['side']} */ ;
if (job.value && job.value.stage !== 'error') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (STAGE.value[job.value.stage]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(job.value && job.value.stage !== 'error'))
                    throw 0;
                return (portraits.value.cancel(__VLS_unwrap(key, {})));
                // @ts-ignore
                [url, job, job, job, job, job, STAGE, portraits, key,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
else if (job.value?.stage === 'error') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    (job.value.error);
}
if (!job.value || job.value.stage === 'error') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    if (canDescribe.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (generate) },
            ...{ class: "small" },
            title: (image.value.ready() ? '' : '先到 ⚙️ 設定 → 🎨 插圖生成 設定生圖服務'),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (url.value ? '重新生成' : '生成形象圖');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!job.value || job.value.stage === 'error'))
                    throw 0;
                return (fileInput.value?.click());
                // @ts-ignore
                [url, job, job, job, job, canDescribe, image, fileInput,];
            } },
        ...{ class: "small" },
        title: "上傳自己的圖片",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (url.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (remove) },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: (onFile) },
        ref: "fileInput",
        type: "file",
        accept: "image/*",
        hidden: true,
    });
}
if (__VLS_ctx.size === 'large' && (record.value?.prompt || job.value?.tags || preview.value)) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "small prompt" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['prompt']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    if (job.value?.tags) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
        (job.value.tags);
    }
    if (record.value?.prompt) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (record.value.semantic ? '上次送出的提示詞（預處理後）' : '上次送出的提示詞');
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
        (record.value.prompt);
        if (record.value.semantic) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
            (record.value.semantic);
        }
    }
    else if (preview.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (image.value.preprocessorFor() ? `（會先預處理：${image.value.preprocessorFor().name}）` : '');
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
        (preview.value);
    }
}
if (zoom.value && url.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(zoom.value && url.value))
                    throw 0;
                return (zoom.value = false);
                // @ts-ignore
                [size, url, url, zoom, zoom, job, job, job, image, image, record, record, record, record, record, record, preview, preview, preview,];
            } },
        ...{ class: "zoom" },
    });
    /** @type {__VLS_StyleScopedClasses['zoom']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: (url.value),
        alt: "形象圖",
    });
}
// @ts-ignore
[url,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
