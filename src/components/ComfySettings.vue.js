import { computed, onMounted, ref } from 'vue';
import { buildWorkflow, checkWorkflow, COMFY_MODES, comfyServer, presetIssues } from '@/narrator/comfy';
import { useImageSettings } from '@/stores/image';
// ComfyUI 的設定組合：每個主模一組（Checkpoint、UNet 或自訂工作流程），
// 清單從 ComfyUI 讀（/object_info），也可以從自己的工作流程匯入
const image = useImageSettings();
const p = computed(() => image.preset());
const opts = computed(() => image.comfyOptions);
const issues = computed(() => presetIssues(p.value));
const modeInfo = computed(() => COMFY_MODES.find((m) => m.id === p.value.mode));
onMounted(() => {
    if (!image.comfyOptions && !image.comfyLoading)
        void image.loadComfyOptions();
});
const listSummary = computed(() => {
    const o = opts.value;
    if (!o)
        return '';
    return `Checkpoint ${o.checkpoints.length}、UNet ${o.unets.length}、文字編碼器 ${o.clips.length}、VAE ${o.vaes.length}、LoRA ${o.loras.length}`;
});
/** 文字編碼器的數量：1 → CLIPLoader、2 → DualCLIPLoader、3 → TripleCLIPLoader */
const clipCount = computed({
    get: () => Math.max(1, p.value.clips.length),
    set: (n) => {
        const c = [...p.value.clips];
        while (c.length < n)
            c.push('');
        p.value.clips = c.slice(0, n);
    },
});
const clipTypes = computed(() => (clipCount.value === 2 ? opts.value?.dualClipTypes : opts.value?.clipTypes) ?? []);
function addLora() {
    p.value.loras.push({ name: '', strength: 1, on: true });
}
function toggleClip(l) {
    if (l.clip === undefined)
        l.clip = l.strength;
    else
        delete l.clip;
}
function rename(e) {
    const v = e.target.value.trim();
    if (v)
        p.value.name = v;
}
function remove() {
    if (!confirm(`刪除設定「${p.value.name}」？`))
        return;
    try {
        image.removePreset();
    }
    catch (e) {
        alert(e instanceof Error ? e.message : String(e));
    }
}
// ---- 從工作流程匯入 ----
const importText = ref('');
const importOpen = ref(false);
const importResult = ref(null);
const fileInput = ref(null);
async function onImportFile(e) {
    const input = e.target;
    const f = input.files?.[0];
    input.value = '';
    if (f)
        importText.value = await f.text();
}
function doImport() {
    try {
        const r = image.importPreset(importText.value);
        const lines = [`已新增設定「${r.added.name}」：${r.added.mode === 'unet' ? 'UNet' : 'Checkpoint'} 模式，${r.added.loras.length} 個 LoRA${r.added.hires.on ? '，含高解析修復' : ''}。`];
        if (r.skipped.length)
            lines.push(`內建模式不包含這些節點：${r.skipped.join('、')}。需要它們的話，把這組改成「自訂工作流程」（已經放進工作流程欄位，記得把提示詞換成 %prompt%）。`);
        lines.push(...r.notes);
        importResult.value = { ok: true, lines };
        importText.value = '';
    }
    catch (e) {
        importResult.value = { ok: false, lines: [e instanceof Error ? e.message : String(e)] };
    }
}
// ---- 檢查 ----
const checking = ref(false);
const checkResult = ref(null);
async function check() {
    checking.value = true;
    checkResult.value = null;
    try {
        if (issues.value.length)
            throw new Error(issues.value.join('、'));
        const wf = buildWorkflow(p.value, { prompt: '1girl', seed: 1 });
        const problems = await checkWorkflow(comfyServer(image.configs.comfyui), wf, p.value.mode !== 'custom');
        checkResult.value = problems.length ? { ok: false, lines: problems } : { ok: true, lines: ['節點與檔案都找到了，可以生成'] };
    }
    catch (e) {
        checkResult.value = { ok: false, lines: [e instanceof Error ? e.message : String(e)] };
    }
    finally {
        checking.value = false;
    }
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(image, {});
// @ts-ignore
__VLS_withDotValue(p, {});
// @ts-ignore
__VLS_withDotValue(listSummary, {});
// @ts-ignore
__VLS_withDotValue(importOpen, {});
// @ts-ignore
__VLS_withDotValue(importText, {});
// @ts-ignore
__VLS_withDotValue(fileInput, {});
// @ts-ignore
__VLS_withDotValue(importResult, {});
// @ts-ignore
__VLS_withDotValue(modeInfo, {});
// @ts-ignore
__VLS_withDotValue(checking, {});
// @ts-ignore
__VLS_withDotValue(issues, {});
// @ts-ignore
__VLS_withDotValue(checkResult, {});
// @ts-ignore
__VLS_withDotValue(opts, {});
void {};
/** @type {__VLS_StyleScopedClasses['comfy']} */ ;
/** @type {__VLS_StyleScopedClasses['comfy']} */ ;
/** @type {__VLS_StyleScopedClasses['comfy']} */ ;
/** @type {__VLS_StyleScopedClasses['comfy']} */ ;
/** @type {__VLS_StyleScopedClasses['comfy']} */ ;
/** @type {__VLS_StyleScopedClasses['lora']} */ ;
/** @type {__VLS_StyleScopedClasses['lora']} */ ;
/** @type {__VLS_StyleScopedClasses['lora']} */ ;
/** @type {__VLS_StyleScopedClasses['lora']} */ ;
/** @type {__VLS_StyleScopedClasses['w']} */ ;
/** @type {__VLS_StyleScopedClasses['result']} */ ;
/** @type {__VLS_StyleScopedClasses['result']} */ ;
/** @type {__VLS_StyleScopedClasses['import']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "comfy" },
});
/** @type {__VLS_StyleScopedClasses['comfy']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "grow" },
});
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (image.value.comfyActive),
});
const __VLS_0 = __VLS_tryAsConstant((image.value.comfyPresets));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (x.id),
        value: (x.id),
    });
    (x.name);
    // @ts-ignore
    [image, image,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (image.value.addPreset());
            // @ts-ignore
            [image,];
        } },
    ...{ class: "small" },
    title: "新增一組",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (image.value.duplicatePreset());
            // @ts-ignore
            [image,];
        } },
    ...{ class: "small" },
    title: "複製這一組",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (remove) },
    ...{ class: "small" },
    disabled: (image.value.comfyPresets.length <= 1),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (rename) },
    value: (p.value.name),
    maxlength: "30",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (image.value.loadComfyOptions());
            // @ts-ignore
            [image, image, p,];
        } },
    ...{ class: "small" },
    disabled: (image.value.comfyLoading),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (image.value.comfyLoading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
else if (image.value.comfyError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    (image.value.comfyError);
}
else if (listSummary.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (listSummary.value);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
    ...{ onToggle: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (importOpen.value = $event.target.open);
            // @ts-ignore
            [image, image, image, image, listSummary, listSummary, importOpen,];
        } },
    ...{ class: "import" },
    open: (importOpen.value),
});
/** @type {__VLS_StyleScopedClasses['import']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (importText.value),
    rows: "5",
    ...{ class: "mono" },
    spellcheck: "false",
    placeholder: "貼上 API 格式的工作流程 JSON",
});
/** @type {__VLS_StyleScopedClasses['mono']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (doImport) },
    ...{ class: "small primary" },
    disabled: (!importText.value.trim()),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (fileInput.value?.click());
            // @ts-ignore
            [importOpen, importText, importText, fileInput,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (onImportFile) },
    ref: "fileInput",
    type: "file",
    accept: ".json,application/json",
    hidden: true,
});
if (importResult.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "small result" },
        ...{ class: (importResult.value.ok ? 'ok' : 'bad') },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['result']} */ ;
    const __VLS_1 = __VLS_tryAsConstant((importResult.value.lines));
    for (const [l, i] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (i),
        });
        (l);
        // @ts-ignore
        [importResult, importResult, importResult,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(COMFY_MODES, {})));
for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (m.id),
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: (m.id),
    });
    (p.value.mode);
    (m.name);
    // @ts-ignore
    [p, COMFY_MODES,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(modeInfo.value.note);
if (p.value.mode === 'checkpoint') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        list: "comfy-ckpt",
        placeholder: "例如 illustriousXL.safetensors",
    });
    (p.value.checkpoint);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        list: "comfy-vae",
    });
    (p.value.vae);
}
else if (p.value.mode === 'unet') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        list: "comfy-unet",
    });
    (p.value.unet);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        list: "comfy-dtype",
    });
    (p.value.weightDtype);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(clipCount, {})),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (1),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (2),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (3),
    });
    const __VLS_3 = __VLS_tryAsConstant((p.value.clips));
    for (const [_, i] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (i),
        });
        (p.value.clips.length > 1 ? ` ${i + 1}` : '');
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            list: "comfy-clip",
        });
        (p.value.clips[i]);
        // @ts-ignore
        [p, p, p, p, p, p, p, p, p, modeInfo, clipCount,];
    }
    if (__VLS_unwrap(clipCount, {}) < 3) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            list: "comfy-cliptype",
            placeholder: "依模型而定，例如 stable_diffusion、flux、qwen_image",
        });
        (p.value.clipType);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        list: "comfy-vae",
    });
    (p.value.vae);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (p.value.workflow),
        rows: "8",
        ...{ class: "mono" },
        spellcheck: "false",
    });
    /** @type {__VLS_StyleScopedClasses['mono']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "空白時自動挑：存圖的節點優先，否則最後一個預覽",
    });
    (p.value.outputNode);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (p.value.mode !== 'custom') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    const __VLS_4 = __VLS_tryAsConstant((p.value.loras));
    for (const [l, i] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "lora" },
            ...{ class: ({ off: !l.on }) },
        });
        /** @type {__VLS_StyleScopedClasses['lora']} */ ;
        /** @type {__VLS_StyleScopedClasses['off']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
            title: "使用這個 LoRA",
        });
        (l.on);
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "name" },
            list: "comfy-lora",
            placeholder: "LoRA 檔名",
        });
        (l.name);
        /** @type {__VLS_StyleScopedClasses['name']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "w" },
        });
        /** @type {__VLS_StyleScopedClasses['w']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            step: "0.05",
        });
        (l.strength);
        if (l.clip !== undefined) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "w" },
            });
            /** @type {__VLS_StyleScopedClasses['w']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                step: "0.05",
            });
            (l.clip);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(p.value.mode !== 'custom'))
                        throw 0;
                    return (toggleClip(l));
                    // @ts-ignore
                    [p, p, p, p, p, p, clipCount,];
                } },
            ...{ class: "small" },
            title: (l.clip === undefined ? '分開設定 CLIP 權重' : 'CLIP 權重跟模型權重相同'),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (l.clip === undefined ? '分開調 CLIP' : '合併');
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(p.value.mode !== 'custom'))
                        throw 0;
                    return (p.value.loras.splice(i, 1));
                    // @ts-ignore
                    [p,];
                } },
            ...{ class: "small" },
            title: "移除",
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (addLora) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "64",
    step: "8",
});
(p.value.width);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "64",
    step: "8",
});
(p.value.height);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
    max: "200",
});
(p.value.steps);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "30",
    step: "0.5",
});
(p.value.cfg);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    list: "comfy-sampler",
});
(p.value.sampler);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    list: "comfy-scheduler",
});
(p.value.scheduler);
if (p.value.mode !== 'custom') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (p.value.hires.on);
    if (p.value.hires.on) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "4",
            step: "0.25",
        });
        (p.value.hires.scale);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            list: "comfy-upscale",
        });
        (p.value.hires.method);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "200",
        });
        (p.value.hires.steps);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "0",
            max: "30",
            step: "0.5",
        });
        (p.value.hires.cfg);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "0",
            max: "1",
            step: "0.05",
        });
        (p.value.hires.denoise);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (p.value.prefix),
    rows: "2",
    placeholder: "masterpiece, best quality, very aesthetic",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (p.value.negative),
    rows: "2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (check) },
    ...{ class: "small" },
    disabled: (checking.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (checking.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
else if (issues.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    (issues.value.join('、'));
}
if (checkResult.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "small result" },
        ...{ class: (checkResult.value.ok ? 'ok' : 'bad') },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['result']} */ ;
    const __VLS_5 = __VLS_tryAsConstant((checkResult.value.lines));
    for (const [l, i] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (i),
        });
        (l);
        // @ts-ignore
        [p, p, p, p, p, p, p, p, p, p, p, p, p, p, p, p, checking, checking, issues, issues, checkResult, checkResult, checkResult,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-ckpt",
});
const __VLS_6 = __VLS_tryAsConstant((opts.value?.checkpoints ?? []));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-unet",
});
const __VLS_7 = __VLS_tryAsConstant((opts.value?.unets ?? []));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-dtype",
});
const __VLS_8 = __VLS_tryAsConstant((opts.value?.weightDtypes ?? ['default']));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-clip",
});
const __VLS_9 = __VLS_tryAsConstant((opts.value?.clips ?? []));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-cliptype",
});
const __VLS_10 = __VLS_tryAsConstant((__VLS_unwrap(clipTypes, {})));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [clipTypes,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-vae",
});
const __VLS_11 = __VLS_tryAsConstant((opts.value?.vaes ?? []));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-lora",
});
const __VLS_12 = __VLS_tryAsConstant((opts.value?.loras ?? []));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-sampler",
});
const __VLS_13 = __VLS_tryAsConstant((opts.value?.samplers ?? []));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-scheduler",
});
const __VLS_14 = __VLS_tryAsConstant((opts.value?.schedulers ?? []));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "comfy-upscale",
});
const __VLS_15 = __VLS_tryAsConstant((opts.value?.upscaleMethods ?? []));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (x),
        value: (x),
    });
    // @ts-ignore
    [opts,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
