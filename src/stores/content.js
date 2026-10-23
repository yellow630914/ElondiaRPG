// 自訂內容：怪物、物品、裝備底材與材料的新增與修改（「🛠️ 內容」頁籤）。
// 世界（見 docs/CONTENT_EDITOR.md 第 0 節）：可以同時存有好幾套自訂內容，另有不能修改的「原版世界」。
// 開新遊戲時選一個世界，存檔記住它（state.world）；讀檔、繼續時自動切到那個世界，遊戲進行中不能切換。
// 存在 localStorage；每次修改後立刻（同步）重新套用到遊戲資料，表單才讀得到新的值。
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { enemies, itemDef, npcs as namedNpcs, stories } from '@/engine/data';
import { builtinStory, flagUsage, progressBreaks, sanitizeStory, storyCheck } from '@/engine/storyMods';
import { abilityUsage, applyContent, cleanItemName, builtinAbility, builtinEnemy, builtinNpc, builtinPerk, dropBrokenStories, emptyMods, normalizeMods, sanitizePerkMod, sanitizeAbility, sanitizeBase, sanitizeEnemy, sanitizeItem, sanitizeMaterial, sanitizeNpc, builtinStatus, sanitizeStatus, statusUsage, builtinTattoo, builtinMark, } from '@/engine/mods';
import { markUsage, sanitizeMarkMod, sanitizeMarkRules, sanitizeTattooMod, tattooUsage } from '@/engine/tattooMods';
import { perkRules, shopRules, slaveryRules } from '@/engine/data';
import { npcModFromState } from '@/engine/promoteNpc';
import { builtinLandmark, landmarkUsage, sanitizeLandmarkMod } from '@/engine/landmarkMods';
import { computePlacements, sanitizeShopMod, shopUsage } from '@/engine/shopMods';
import { settlementArea } from '@/engine/grid';
import { pruneAbilities, prunePerks, pruneStatuses } from '@/engine/state';
import { pruneStories } from '@/engine/story';
import { enemyUsage, gearUsage, itemUsage, npcUsage, perkUsage, renameItemInState, storyUsage } from '@/engine/usage';
import { useGame } from './game';
/** 舊版只有一套自訂內容 */
const LEGACY_KEY = 'elondia.content';
const WORLDS_KEY = 'elondia.worlds';
/** 原版世界：沒有任何自訂內容，不能修改 */
export const VANILLA = 'vanilla';
export const VANILLA_NAME = '原版世界';
const MOD_SECTIONS = ['statuses', 'tattoos', 'marks', 'markRules', 'landmarks', 'shops', 'abilities', 'perks', 'materials', 'bases', 'items', 'enemies', 'npcs', 'stories'];
export const MOD_SECTION_NAMES = {
    statuses: '狀態', tattoos: '刺青圖樣', marks: '奴隸印記', markRules: '印記設定', landmarks: '地標', shops: '商店', abilities: '技能', perks: '特質', materials: '材料', bases: '底材', items: '物品', enemies: '怪物', npcs: '固定 NPC', stories: '特殊任務',
};
function modLabel(section, id, v) {
    const o = v;
    if (section === 'markRules')
        return MOD_SECTION_NAMES[section];
    if (section === 'shops')
        return `${MOD_SECTION_NAMES[section]}「${shopRules.types[id]?.name ?? id}」`;
    const name = section === 'items' ? id : o.title ?? o.name ?? id;
    return `${MOD_SECTION_NAMES[section]}「${name}」`;
}
/** 讀出所有世界；舊版的自訂內容（有內容時）變成「我的世界」 */
function loadWorlds() {
    try {
        const raw = localStorage.getItem(WORLDS_KEY);
        if (raw) {
            const f = JSON.parse(raw);
            const worlds = (Array.isArray(f.worlds) ? f.worlds : [])
                .filter((w) => !!w && typeof w.id === 'string' && w.id !== VANILLA)
                .map((w) => ({ id: w.id, name: String(w.name || '未命名的世界').slice(0, 30), mods: normalizeMods(w.mods), updated: Number(w.updated) || 0 }));
            return { active: worlds.some((w) => w.id === f.active) ? f.active : VANILLA, worlds };
        }
        const legacy = localStorage.getItem(LEGACY_KEY);
        const mods = legacy ? normalizeMods(JSON.parse(legacy)) : emptyMods();
        if (modTotal(mods))
            return { active: 'w-mine', worlds: [{ id: 'w-mine', name: '我的世界', mods, updated: Date.now() }] };
    }
    catch {
        // 讀不了：從原版開始
    }
    return { active: VANILLA, worlds: [] };
}
/** 一套自訂內容有幾項 */
export function modTotal(m) {
    return MOD_SECTIONS.reduce((n, k) => n + Object.keys(m[k] ?? {}).length, 0);
}
function activeMods(f) {
    return f.worlds.find((w) => w.id === f.active)?.mods ?? emptyMods();
}
/** 啟動時（建立其他 store 之前）先套用目前的世界，讀檔與開新遊戲才會看到自訂內容 */
export function initContent() {
    return applyContent(activeMods(loadWorlds()));
}
export const useContent = defineStore('content', () => {
    const initial = loadWorlds();
    const worlds = ref(initial.worlds);
    const active = ref(initial.active);
    const mods = ref(activeMods(initial));
    const problems = ref([]);
    /** 遊戲資料不是響應式的：每次套用後加一，讓畫面重新計算 */
    const version = ref(0);
    const readOnly = computed(() => active.value === VANILLA);
    const activeName = computed(() => worldName(active.value));
    function worldName(id) {
        return id === VANILLA ? VANILLA_NAME : worlds.value.find((w) => w.id === id)?.name ?? '（已刪除的世界）';
    }
    function persist() {
        try {
            localStorage.setItem(WORLDS_KEY, JSON.stringify({ active: active.value, worlds: worlds.value }));
        }
        catch {
            // 寫不進去時只在本次有效
        }
    }
    /** 套用目前世界的內容（不存檔） */
    function apply() {
        problems.value = applyContent(mods.value);
        version.value++;
    }
    function save() {
        // 原版世界不能改：丟掉這次的修改
        if (readOnly.value) {
            mods.value = emptyMods();
            apply();
            throw new Error('原版世界不能修改：先在世界管理建立一個新的世界');
        }
        const w = worlds.value.find((x) => x.id === active.value);
        if (w) {
            w.mods = mods.value;
            w.updated = Date.now();
        }
        problems.value = applyContent(mods.value);
        // 被拿掉的能力（匯入、全部恢復預設）：從目前存檔的角色身上拿掉
        const game = useGame();
        if (game.state) {
            pruneStatuses(game.state);
            pruneAbilities(game.state);
            prunePerks(game.state);
            pruneStories(game.state);
        }
        version.value++;
        persist();
    }
    // ---- 世界 ----
    /** 切到另一個世界（遊戲進行中不能切換） */
    function switchWorld(id) {
        if (useGame().state)
            throw new Error('遊戲進行中不能切換世界：回到首頁再切換');
        useWorld(id);
    }
    function useWorld(id) {
        const w = worlds.value.find((x) => x.id === id);
        active.value = w ? w.id : VANILLA;
        mods.value = w ? w.mods : emptyMods();
        apply();
        persist();
    }
    /** 新的世界：複製另一個世界的內容（不給時是空的，等於從原版開始） */
    function createWorld(name, copyFrom, content) {
        const from = content ?? worlds.value.find((w) => w.id === copyFrom)?.mods;
        const id = `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        worlds.value.push({ id, name: name.trim().slice(0, 30) || '新的世界', mods: from ? normalizeMods(JSON.parse(JSON.stringify(from))) : emptyMods(), updated: Date.now() });
        // normalizeMods 會先登錄自建的能力與底材：恢復成目前的內容
        apply();
        persist();
        return id;
    }
    function renameWorld(id, name) {
        const w = worlds.value.find((x) => x.id === id);
        if (!w || !name.trim())
            return;
        w.name = name.trim().slice(0, 30);
        persist();
    }
    function deleteWorld(id) {
        if (id === VANILLA)
            throw new Error('原版世界不能刪除');
        if (useGame().state && id === active.value)
            throw new Error('進行中的遊戲正在用這個世界');
        worlds.value = worlds.value.filter((w) => w.id !== id);
        if (active.value === id)
            useWorld(VANILLA);
        else
            persist();
    }
    /**
     * 讀檔、繼續時切到存檔的世界（不檢查遊戲是否進行中）。存檔沒有記世界（舊存檔）時沿用目前的；
     * 世界被刪掉了，存檔附有當時的內容時還原成一個新的世界，否則改用原版世界。回傳實際用的世界與說明
     */
    function enterWorld(ref, snapshot) {
        if (!ref)
            return { id: active.value, name: activeName.value };
        if (ref.id === VANILLA || worlds.value.some((w) => w.id === ref.id)) {
            if (ref.id !== active.value)
                useWorld(ref.id);
            return { id: ref.id, name: worldName(ref.id) };
        }
        if (snapshot && modTotal(normalizeMods(snapshot))) {
            const id = createWorld(`${ref.name}（從存檔還原）`, undefined, snapshot);
            useWorld(id);
            return { id, name: worldName(id), note: `存檔用的世界「${ref.name}」已經不在了，用存檔附上的內容還原成「${worldName(id)}」` };
        }
        useWorld(VANILLA);
        return { id: VANILLA, name: VANILLA_NAME, note: `存檔用的世界「${ref.name}」已經不在了，改用原版世界` };
    }
    /**
     * 首頁匯入存檔時，存檔要用哪個世界：附了自訂內容、而且它的世界在這個瀏覽器不存在或內容不同時，
     * 用附帶的內容建立一個新的世界（名稱用存檔世界的名字，同名時後面加 4 位數字），存檔改指向它。
     * - 已經有內容完全相同的世界（例如同一個檔案匯入第二次）：沿用那個世界（reused），不再建立。
     * - 沒有記世界的舊匯出檔、但附了自訂內容：一樣建立新的世界（名稱「匯入的世界」）。
     * - 沒有附內容、原版世界、或世界相同時照舊。
     * 尾碼依內容固定算出來（不是亂數），dryRun（只算出結果、不建立）和正式匯入的名稱一樣。
     */
    function worldForImport(ref, content, dryRun = false) {
        if (!content || ref?.id === VANILLA)
            return { ref };
        const incoming = normalizeMods(JSON.parse(JSON.stringify(content)));
        // normalizeMods 會先登錄自建的能力與底材：比較完恢復成目前的內容
        apply();
        if (!modTotal(incoming))
            return { ref };
        const text = JSON.stringify(incoming);
        const same = (w) => JSON.stringify(w.mods) === text;
        const existing = ref && worlds.value.find((w) => w.id === ref.id);
        if (existing && same(existing))
            return { ref };
        const twin = worlds.value.find(same);
        if (twin)
            return { ref: { id: twin.id, name: twin.name }, reused: twin.name };
        const taken = new Set([VANILLA_NAME, ...worlds.value.map((w) => w.name)]);
        const base = (ref?.name || '匯入的世界').slice(0, 25);
        let name = base;
        let h = 2166136261;
        for (let i = 0; i < text.length; i++)
            h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
        for (let n = 0; taken.has(name); n++)
            name = `${base}${1000 + ((h + n) % 9000)}`;
        if (dryRun)
            return { ref, created: name };
        const id = createWorld(name, undefined, incoming);
        return { ref: { id, name }, created: name };
    }
    /** 哪些地方用到這一項（其他內容與目前載入的存檔） */
    function usageOf(kind, key) {
        const state = useGame().state;
        switch (kind) {
            case 'enemy': return enemyUsage(key, state);
            case 'item': return itemUsage(key, state);
            case 'base': return gearUsage('base', key, state, Object.keys(mods.value.items));
            case 'material': return gearUsage('material', key, state, Object.keys(mods.value.items));
            case 'npc': return npcUsage(key, state);
            case 'story': return storyUsage(key, state);
            case 'ability': return abilityUsage(key, state);
            case 'perk': return perkUsage(key, state);
            case 'status': return statusUsage(key, state);
            case 'tattoo': return tattooUsage(key);
            case 'mark': return markUsage(key);
            case 'shop': return shopUsage(key);
            case 'landmark': return landmarkUsage(key);
        }
    }
    function assertUnused(kind, key) {
        const used = usageOf(kind, key);
        if (used.length)
            throw new Error(`還有地方用到，不能刪除：${used.slice(0, 3).join('、')}${used.length > 3 ? ` 等 ${used.length} 處` : ''}`);
    }
    // ---- 怪物 ----
    function saveEnemy(id, draft) {
        const custom = !builtinEnemy(id);
        mods.value.enemies[id] = sanitizeEnemy(id, draft, custom);
        save();
    }
    /** 自建的怪物才能刪 */
    function deleteEnemy(id) {
        if (!mods.value.enemies[id]?.custom)
            throw new Error('內建的怪物不能刪除');
        assertUnused('enemy', id);
        delete mods.value.enemies[id];
        save();
    }
    /** 內建怪物恢復預設 */
    function restoreEnemy(id) {
        if (mods.value.enemies[id]?.custom)
            return;
        delete mods.value.enemies[id];
        save();
    }
    // ---- 物品 ----
    function saveItem(name, draft, rename) {
        const existing = mods.value.items[name];
        const custom = existing ? !!existing.custom : !!draft.custom;
        if (!existing && custom && itemDef(name))
            throw new Error(`已經有叫「${name}」的物品`);
        const target = custom && rename?.trim() ? cleanItemName(rename) || name : name;
        // AI 生成或打造時登錄在目前存檔的物品也算（同名會蓋掉它的類別、價格與裝備組成）
        const taken = (n) => !!mods.value.items[n] || !!itemDef(n) || !!useGame().state?.customItems?.[n];
        if (!existing && custom && useGame().state?.customItems?.[name])
            throw new Error(`目前的存檔已經有叫「${name}」的物品`);
        if (target !== name) {
            if (taken(target))
                throw new Error(`已經有叫「${target}」的物品`);
            delete mods.value.items[name];
            renameRefs(name, target);
            // 目前存檔裡的同名物品一起改名（其他存檔裡的會變成無法使用的雜物）
            const game = useGame();
            if (game.state)
                renameItemInState(game.state, name, target);
        }
        mods.value.items[target] = sanitizeItem(target, draft, custom);
        save();
        return target;
    }
    function deleteItem(name) {
        if (!mods.value.items[name]?.custom)
            throw new Error('內建的物品不能刪除');
        assertUnused('item', name);
        delete mods.value.items[name];
        renameRefs(name, null);
        save();
    }
    function restoreItem(name) {
        if (mods.value.items[name]?.custom)
            return;
        delete mods.value.items[name];
        save();
    }
    /** 改名或刪除時更新怪物掉落與特殊任務獎勵裡的參照 */
    function renameRefs(from, to) {
        for (const e of Object.values(mods.value.enemies)) {
            if (!e.loot?.some((l) => l.item === from))
                continue;
            e.loot = to ? e.loot.map((l) => (l.item === from ? { ...l, item: to } : l)) : e.loot.filter((l) => l.item !== from);
            if (!e.loot.length)
                delete e.loot;
        }
        // 其他物品的配方材料與種子長出的作物
        for (const it of Object.values(mods.value.items)) {
            if (it.recipe?.inputs.some((x) => x.name === from)) {
                it.recipe.inputs = to ? it.recipe.inputs.map((x) => (x.name === from ? { ...x, name: to } : x)) : it.recipe.inputs.filter((x) => x.name !== from);
                if (!it.recipe.inputs.length)
                    delete it.recipe;
            }
            if (it.seed?.yields.includes(from)) {
                it.seed.yields = to ? it.seed.yields.map((y) => (y === from ? to : y)) : it.seed.yields.filter((y) => y !== from);
                if (!it.seed.yields.length)
                    delete it.seed;
            }
            // 工具的燃料（例如油燈的燈油）
            if (to && it.tool?.fuel === from)
                it.tool.fuel = to;
        }
        // 商店的固定清單
        for (const m of Object.values(mods.value.shops ?? {})) {
            if (!m.fixed?.some((f) => f.item === from))
                continue;
            m.fixed = to ? m.fixed.map((f) => (f.item === from ? { ...f, item: to } : f)) : m.fixed.filter((f) => f.item !== from);
            if (!m.fixed.length)
                delete m.fixed;
        }
        if (!to)
            return;
        for (const s of Object.values(mods.value.stories)) {
            const lists = [s.rewards, ...s.nodes.flatMap((n) => [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])]).map((o) => o?.effects)];
            for (const list of lists)
                for (const e of list ?? [])
                    if (e.type === 'item' && e.name === from)
                        e.name = to;
        }
    }
    /** 在物品這邊設定掉落：改的是怪物的 loot（沒改過的內建怪物會先複製一份） */
    function setItemDrops(name, drops) {
        const wanted = new Map(drops.filter((d) => enemies[d.enemy] && d.chance > 0).map((d) => [d.enemy, d]));
        for (const e of Object.values(enemies)) {
            const has = (e.loot ?? []).some((l) => l.item === name);
            const want = wanted.get(e.id);
            if (!has && !want)
                continue;
            const current = mods.value.enemies[e.id] ?? JSON.parse(JSON.stringify(e));
            const loot = (current.loot ?? []).filter((l) => l.item !== name);
            if (want)
                loot.push({ item: name, chance: want.chance, ...(want.qty > 1 ? { qty: want.qty } : {}) });
            const before = JSON.stringify((e.loot ?? []).filter((l) => l.item === name));
            const after = JSON.stringify(loot.filter((l) => l.item === name));
            if (before === after && !mods.value.enemies[e.id])
                continue;
            mods.value.enemies[e.id] = sanitizeEnemy(e.id, { ...current, loot }, !builtinEnemy(e.id));
        }
        save();
    }
    // ---- 底材與材料 ----
    function saveBase(id, draft, custom) {
        mods.value.bases[id] = sanitizeBase(draft, custom, id);
        save();
    }
    function deleteBase(id) {
        if (!mods.value.bases[id]?.custom)
            throw new Error('內建的底材不能刪除');
        assertUnused('base', id);
        delete mods.value.bases[id];
        save();
    }
    function restoreBase(id) {
        if (!mods.value.bases[id]?.custom)
            delete mods.value.bases[id];
        save();
    }
    function saveMaterial(id, draft, custom) {
        mods.value.materials[id] = sanitizeMaterial(draft, custom, id);
        save();
    }
    function deleteMaterial(id) {
        if (!mods.value.materials[id]?.custom)
            throw new Error('內建的材料不能刪除');
        assertUnused('material', id);
        delete mods.value.materials[id];
        save();
    }
    function restoreMaterial(id) {
        if (!mods.value.materials[id]?.custom)
            delete mods.value.materials[id];
        save();
    }
    // ---- 固定 NPC ----
    /** 把存檔裡生成的人存成固定 NPC（同一個 id，關係與記憶延續；存檔的紀錄由呼叫的地方改，見 game.promoteNpc） */
    function promoteNpc(state, id) {
        if (readOnly.value)
            throw new Error(`${VANILLA_NAME}不能修改：請先在內容頁籤建立自己的世界，再用那個世界開始遊戲`);
        mods.value.npcs[id] = npcModFromState(state, id);
        save();
    }
    function saveNpc(id, draft) {
        mods.value.npcs[id] = sanitizeNpc(id, draft, !builtinNpc(id));
        save();
    }
    function deleteNpc(id) {
        if (!mods.value.npcs[id]?.custom)
            throw new Error('內建的角色不能刪除');
        assertUnused('npc', id);
        delete mods.value.npcs[id];
        save();
    }
    function restoreNpc(id) {
        if (!mods.value.npcs[id]?.custom)
            delete mods.value.npcs[id];
        save();
    }
    // ---- 特殊任務 ----
    /**
     * 儲存特殊任務。有錯誤（storyCheck 的 errors）時不存；目前的存檔正在進行這個任務、
     * 而這次修改會弄壞它的進度時（progressBreaks）也不存——先在編輯器選「複製成新任務」或「放棄這個存檔的任務進度」。
     */
    function saveStory(id, draft) {
        const next = sanitizeStory(id, draft, !builtinStory(id));
        const check = storyCheck(next);
        if (check.errors.length)
            throw new Error(`特殊任務有錯誤，不能儲存：${check.errors.join('；')}`);
        const state = useGame().state;
        const breaks = state ? progressBreaks(state, stories.find((s) => s.id === id), next) : [];
        if (breaks.length)
            throw new Error(`目前的存檔正在進行這個任務，這次修改會弄壞它的進度：${breaks.join('；')}`);
        mods.value.stories[id] = next;
        save();
    }
    function deleteStory(id) {
        if (!mods.value.stories[id]?.custom)
            throw new Error('內建的特殊任務不能刪除');
        assertUnused('story', id);
        delete mods.value.stories[id];
        save();
    }
    function restoreStory(id) {
        if (!mods.value.stories[id]?.custom)
            delete mods.value.stories[id];
        save();
    }
    // ---- 能力 ----
    function saveAbility(id, draft) {
        mods.value.abilities[id] = sanitizeAbility(id, draft, !builtinAbility(id));
        save();
    }
    /** 自建、而且沒有被任何地方用到的能力才能刪 */
    function deleteAbility(id) {
        if (!mods.value.abilities[id]?.custom)
            throw new Error('內建的能力不能刪除');
        assertUnused('ability', id);
        delete mods.value.abilities[id];
        save();
    }
    function restoreAbility(id) {
        if (!mods.value.abilities[id]?.custom)
            delete mods.value.abilities[id];
        save();
    }
    // ---- 狀態（BUFF／DEBUFF） ----
    function saveStatus(id, draft) {
        mods.value.statuses[id] = sanitizeStatus(id, draft, !builtinStatus(id));
        save();
    }
    /** 自建、而且沒有被任何地方用到的狀態才能刪 */
    function deleteStatus(id) {
        if (!mods.value.statuses[id]?.custom)
            throw new Error('內建的狀態不能刪除');
        assertUnused('status', id);
        delete mods.value.statuses[id];
        save();
    }
    function restoreStatus(id) {
        if (!mods.value.statuses[id]?.custom)
            delete mods.value.statuses[id];
        save();
    }
    // ---- 刺青圖樣、奴隸印記與印記設定 ----
    function saveTattoo(id, draft) {
        const t = sanitizeTattooMod(draft, !builtinTattoo(id));
        if (!t)
            throw new Error('誓約的加減不合規則（有加有減、加總為 0）');
        (mods.value.tattoos ??= {})[id] = t;
        save();
    }
    function deleteTattoo(id) {
        if (!mods.value.tattoos?.[id]?.custom)
            throw new Error('內建的刺青圖樣不能刪除');
        assertUnused('tattoo', id);
        delete mods.value.tattoos[id];
        save();
    }
    function restoreTattoo(id) {
        if (!mods.value.tattoos?.[id]?.custom)
            delete mods.value.tattoos?.[id];
        save();
    }
    function saveMark(id, draft) {
        ;
        (mods.value.marks ??= {})[id] = sanitizeMarkMod(draft, !builtinMark(id));
        save();
    }
    function deleteMark(id) {
        if (!mods.value.marks?.[id]?.custom)
            throw new Error('內建的奴隸印記不能刪除');
        assertUnused('mark', id);
        delete mods.value.marks[id];
        save();
    }
    function restoreMark(id) {
        if (!mods.value.marks?.[id]?.custom)
            delete mods.value.marks?.[id];
        save();
    }
    function saveMarkRules(draft) {
        ;
        (mods.value.markRules ??= {}).rules = sanitizeMarkRules(draft, new Set(Object.keys(slaveryRules.contracts)));
        save();
    }
    function restoreMarkRules() {
        delete mods.value.markRules?.rules;
        save();
    }
    // ---- 商店 ----
    /** 存商店：位置要擺得上去（空地、沒有別的店），擺不上去就不存 */
    function saveShop(id, draft) {
        const m = sanitizeShopMod(id, draft);
        const next = { ...(mods.value.shops ?? {}), [id]: m };
        if (!m.custom && !Object.keys(m).length)
            delete next[id];
        const bad = computePlacements(next).rejected.find((r) => r.shop === id);
        if (bad)
            throw new Error(`${settlementArea(bad.at.area)?.name ?? bad.at.area}（${bad.at.x}, ${bad.at.y}）擺不上去：${bad.reason}`);
        mods.value.shops = next;
        save();
    }
    /** 內建的店恢復預設（位置也回到原處） */
    function restoreShop(id) {
        if (mods.value.shops?.[id]?.custom)
            return;
        delete mods.value.shops?.[id];
        save();
    }
    /** 自建、而且沒有固定 NPC 擔任店主的商店才能刪；在這裡受訓的特質一起拿掉這個地點 */
    function deleteShop(id) {
        if (!mods.value.shops?.[id]?.custom)
            throw new Error('內建的商店不能刪除');
        assertUnused('shop', id);
        setShopTraining(id, []);
        delete mods.value.shops[id];
        save();
    }
    /**
     * 這種店的受訓清單：存在各特質的受訓地點（train.cells）上。拿掉最後一個地點的特質不再能受訓；
     * 加回去時沿用內建的受訓設定（價格、時數、檢定）。和內建一樣的特質不另外存。
     */
    function setShopTraining(cell, perkIds) {
        const want = new Set(perkIds);
        for (const p of perkRules.perks) {
            if (p.race)
                continue;
            const train = p.train ?? builtinPerk(p.id)?.train;
            if (!train)
                continue;
            const has = !!p.train?.cells.includes(cell);
            if (has === want.has(p.id))
                continue;
            const next = JSON.parse(JSON.stringify(mods.value.perks[p.id] ?? p));
            const cells = (p.train?.cells ?? []).filter((c) => c !== cell);
            if (want.has(p.id))
                cells.push(cell);
            // 照內建的順序排（加回去的和內建一樣時不另外存）
            const order = builtinPerk(p.id)?.train?.cells ?? [];
            const rank = (c) => (order.includes(c) ? order.indexOf(c) : order.length);
            cells.sort((a, b) => rank(a) - rank(b));
            next.train = { ...train, cells };
            if (!cells.length)
                delete next.train;
            const custom = !builtinPerk(p.id);
            const clean = sanitizePerkMod(p.id, next, custom);
            if (!clean)
                continue;
            if (!custom && JSON.stringify(clean) === JSON.stringify(sanitizePerkMod(p.id, builtinPerk(p.id), false)))
                delete mods.value.perks[p.id];
            else
                mods.value.perks[p.id] = clean;
        }
        save();
    }
    // ---- 地標 ----
    /** 存地標：位置要是那個聚落的一格空地（道路），或這個地標現在的格子 */
    function saveLandmark(id, draft) {
        const m = sanitizeLandmarkMod(id, draft);
        const area = settlementArea(m.at.area);
        const kind = area?.cells[m.at.y * area.width + m.at.x]?.kind;
        if (kind !== 'floor' && kind !== id)
            throw new Error(`${area?.name ?? m.at.area}（${m.at.x}, ${m.at.y}）不是空地（道路）`);
        mods.value.landmarks ??= {};
        const base = builtinLandmark(id);
        if (base && JSON.stringify(m) === JSON.stringify(sanitizeLandmarkMod(id, base)))
            delete mods.value.landmarks[id];
        else
            mods.value.landmarks[id] = m;
        save();
    }
    function restoreLandmark(id) {
        if (mods.value.landmarks?.[id]?.custom)
            return;
        delete mods.value.landmarks?.[id];
        save();
    }
    /** 自建、而且沒有被用到的地標才能刪；在這裡受訓的特質一起拿掉這個地點 */
    function deleteLandmark(id) {
        if (!mods.value.landmarks?.[id]?.custom)
            throw new Error('內建的地標不能刪除');
        assertUnused('landmark', id);
        setShopTraining(id, []);
        delete mods.value.landmarks[id];
        save();
    }
    // ---- 特質 ----
    function savePerk(id, draft) {
        const p = sanitizePerkMod(id, draft, !builtinPerk(id));
        if (!p)
            throw new Error('特質的內容不完整');
        mods.value.perks[id] = p;
        save();
    }
    /** 自建、而且沒有被任何地方用到的特質才能刪 */
    function deletePerk(id) {
        if (!mods.value.perks[id]?.custom)
            throw new Error('內建的特質不能刪除');
        assertUnused('perk', id);
        delete mods.value.perks[id];
        save();
    }
    function restorePerk(id) {
        if (!mods.value.perks[id]?.custom)
            delete mods.value.perks[id];
        save();
    }
    /** 內容頁籤裡用過的劇情旗標（自動完成用） */
    function knownFlags() {
        const set = new Set();
        for (const n of namedNpcs) {
            for (const f of [...(n.requires?.flags ?? []), ...(n.requires?.flags_none ?? [])])
                set.add(f);
            // 「依劇情旗標改變出沒」的每一組條件
            for (const st of n.stages ?? [])
                for (const f of [...(st.requires?.flags ?? []), ...(st.requires?.flags_none ?? [])])
                    set.add(f);
        }
        for (const s of stories)
            for (const u of flagUsage(s))
                set.add(u.flag);
        return [...set].sort();
    }
    // ---- 匯出、匯入、重設 ----
    function exportMods() {
        return JSON.stringify({ type: 'elondia-content', ...mods.value }, null, 2);
    }
    /** 匯入內容檔：asNew 時建立成新的世界，否則取代目前世界的內容 */
    function importMods(text, asNew) {
        const incoming = normalizeMods(JSON.parse(text));
        // 有錯誤的特殊任務不匯入（dropBrokenStories 會套用 incoming：之後一定要重新套用）
        const dropped = dropBrokenStories(incoming);
        if (asNew !== undefined) {
            const id = createWorld(asNew || '匯入的世界', undefined, incoming);
            problems.value = [...problems.value, ...dropped];
            return id;
        }
        mods.value = incoming;
        try {
            save();
        }
        finally {
            problems.value = [...problems.value, ...dropped];
        }
        return undefined;
    }
    /**
     * 和匯入存檔附上的自訂內容比較：新增的、和這個瀏覽器不同的、相同的。
     * 每一項的 key 是「區塊:id」（例如 stories:lost_ring）
     */
    function diffMods(raw) {
        const incoming = normalizeMods(raw);
        // normalizeMods 會先登錄自建的能力與底材：比較完恢復成目前的內容
        problems.value = applyContent(mods.value);
        const diff = { incoming, added: [], changed: [], same: 0 };
        for (const section of MOD_SECTIONS) {
            const mine = mods.value[section];
            for (const [id, v] of Object.entries(incoming[section])) {
                const entry = { key: `${section}:${id}`, section, id, label: modLabel(section, id, v) };
                if (!(id in mine))
                    diff.added.push(entry);
                else if (JSON.stringify(mine[id]) !== JSON.stringify(v))
                    diff.changed.push(entry);
                else
                    diff.same++;
            }
        }
        return diff;
    }
    /** 合併：加入新增的，take 裡的（和這個瀏覽器不同的項目）換成檔案的；這個瀏覽器其他的內容不動 */
    function mergeMods(diff, take = []) {
        const want = new Set([...diff.added.map((e) => e.key), ...take]);
        let n = 0;
        const merged = new Set();
        const before = {};
        for (const e of [...diff.added, ...diff.changed]) {
            if (!want.has(e.key))
                continue;
            if (e.section === 'stories') {
                merged.add(e.id);
                if (mods.value.stories[e.id])
                    before[e.id] = mods.value.stories[e.id];
            }
            ;
            mods.value[e.section][e.id] = diff.incoming[e.section][e.id];
            n++;
        }
        // 合併進來的特殊任務有錯誤時不收：保留這個瀏覽器原本的版本
        const dropped = merged.size ? dropBrokenStories(mods.value, merged) : [];
        for (const id of merged)
            if (!mods.value.stories[id] && before[id])
                mods.value.stories[id] = before[id];
        if (n)
            save();
        problems.value = [...problems.value, ...dropped];
        return n;
    }
    function resetAll() {
        mods.value = emptyMods();
        save();
    }
    return {
        mods, problems, version, usageOf,
        worlds, active, activeName, readOnly, worldName, switchWorld, createWorld, renameWorld, deleteWorld, enterWorld, worldForImport,
        saveEnemy, deleteEnemy, restoreEnemy,
        saveItem, deleteItem, restoreItem, setItemDrops,
        saveBase, deleteBase, restoreBase, saveMaterial, deleteMaterial, restoreMaterial,
        saveNpc, deleteNpc, restoreNpc, promoteNpc, saveStory, deleteStory, restoreStory, savePerk, deletePerk, restorePerk, knownFlags,
        saveAbility, deleteAbility, restoreAbility, saveStatus, deleteStatus, restoreStatus,
        saveShop, setShopTraining, restoreShop, deleteShop, saveLandmark, restoreLandmark, deleteLandmark, saveTattoo, deleteTattoo, restoreTattoo, saveMark, deleteMark, restoreMark, saveMarkRules, restoreMarkRules,
        exportMods, importMods, resetAll, diffMods, mergeMods,
    };
});
