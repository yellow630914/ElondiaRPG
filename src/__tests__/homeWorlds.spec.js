import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { enemies } from '@/engine/data';
import { applyContent, builtinEnemy, emptyMods } from '@/engine/mods';
import { useContent, VANILLA } from '@/stores/content';
import { useGame } from '@/stores/game';
import { usePrompts } from '@/stores/prompts';
import { localStorageStore, preloadCurrent, useCurrentStore, useSlotStore } from '@/stores/saves';
/** 記憶體裡的「進行中的遊戲」 */
function memoryStore() {
    const data = {};
    const s = {
        kind: 'indexeddb', data,
        async read() { return { ...data }; },
        async write(d) { Object.assign(data, d); },
        async clear() { for (const k of Object.keys(data))
            delete data[k]; },
    };
    return s;
}
/** 重新整理頁面：重新讀出進行中的遊戲，建立新的 store */
async function reload() {
    await preloadCurrent();
    setActivePinia(createPinia());
}
let store;
beforeEach(() => {
    localStorage.clear();
    useSlotStore(localStorageStore());
    store = memoryStore();
    useCurrentStore(store);
    setActivePinia(createPinia());
});
afterEach(() => {
    useCurrentStore(null);
    applyContent(emptyMods());
});
describe('worlds', () => {
    it('keep the original world read-only and let you make editable copies', () => {
        const c = useContent();
        expect(c.active).toBe(VANILLA);
        expect(() => c.saveEnemy('goblin', { ...enemies.goblin, hp: 50 })).toThrow('原版世界不能修改');
        expect(enemies.goblin.hp).toBe(builtinEnemy('goblin').hp);
        const id = c.createWorld('哥布林強化版');
        c.switchWorld(id);
        c.saveEnemy('goblin', { ...enemies.goblin, hp: 50 });
        expect(enemies.goblin.hp).toBe(50);
        c.switchWorld(VANILLA);
        expect(enemies.goblin.hp).toBe(builtinEnemy('goblin').hp);
        // 複製一份，原本的不受影響
        const copy = c.createWorld('複製', id);
        c.switchWorld(copy);
        expect(enemies.goblin.hp).toBe(50);
        c.restoreEnemy('goblin');
        c.switchWorld(id);
        expect(enemies.goblin.hp).toBe(50);
        c.deleteWorld(id);
        expect(c.active).toBe(VANILLA);
        expect(() => c.deleteWorld(VANILLA)).toThrow('不能刪除');
    });
    it('turn the old single set of custom content into a world', () => {
        localStorage.setItem('elondia.content', JSON.stringify({ ...emptyMods(), enemies: { goblin: { ...enemies.goblin, hp: 33 } } }));
        setActivePinia(createPinia());
        const c = useContent();
        expect(c.worlds.map((w) => w.name)).toEqual(['我的世界']);
        expect(c.active).toBe(c.worlds[0].id);
    });
    it('are chosen when a game starts, locked while playing and restored when continuing', async () => {
        const c = useContent();
        const id = c.createWorld('強化世界');
        c.switchWorld(id);
        c.saveEnemy('goblin', { ...enemies.goblin, hp: 44 });
        c.switchWorld(VANILLA);
        const g = useGame();
        g.start('艾倫', 'human', 'fighter', undefined, {}, id);
        expect(g.state.world).toEqual({ id, name: '強化世界' });
        expect(enemies.goblin.hp).toBe(44);
        expect(() => c.switchWorld(VANILLA)).toThrow('遊戲進行中');
        expect(() => c.deleteWorld(id)).toThrow('正在用');
        // 回到首頁：可以切換世界；繼續時自動切回這局的世界
        await g.toHome();
        expect(g.state).toBeNull();
        expect(g.resumeMeta?.world).toBe('強化世界');
        c.switchWorld(VANILLA);
        expect(enemies.goblin.hp).toBe(builtinEnemy('goblin').hp);
        expect(g.continueGame()).toBe(true);
        expect(c.active).toBe(id);
        expect(enemies.goblin.hp).toBe(44);
    });
    it('fall back to the bundled content or the original world when a save’s world is gone', async () => {
        const c = useContent();
        const id = c.createWorld('會被刪掉的世界');
        c.switchWorld(id);
        c.saveEnemy('goblin', { ...enemies.goblin, hp: 66 });
        const g = useGame();
        g.start('艾倫', 'human', 'fighter', undefined, {}, id);
        await g.saveToSlot('有附內容');
        await g.toHome();
        c.deleteWorld(id);
        // 存檔欄位附有當時的內容：還原成新的世界
        await g.loadSlot(g.slots.find((m) => m.name === '有附內容').id);
        expect(c.activeName).toBe('會被刪掉的世界（從存檔還原）');
        expect(enemies.goblin.hp).toBe(66);
        expect(g.state.world?.name).toBe('會被刪掉的世界（從存檔還原）');
        // 進行中的遊戲沒有附內容：改用原版世界
        const restored = c.active;
        await g.toHome();
        c.deleteWorld(restored);
        expect(g.continueGame()).toBe(true);
        expect(c.active).toBe(VANILLA);
        expect(g.notice).toContain('改用原版世界');
    });
});
describe('home screen', () => {
    it('does not enter the game on start-up until you continue', async () => {
        const g = useGame();
        g.start('艾倫', 'human', 'fighter');
        await g.flushed();
        await reload();
        const next = useGame();
        expect(next.state).toBeNull();
        expect(next.hasProgress).toBe(true);
        expect(next.resumeMeta).toMatchObject({ pcName: '艾倫', level: 1 });
        expect(next.continueGame()).toBe(true);
        expect(next.state.party[0].name).toBe('艾倫');
    });
    it('backs up the game you have not continued before a new game overwrites it', async () => {
        const g = useGame();
        g.start('艾倫', 'human', 'fighter');
        g.state.money_cc = 123;
        g.editProfile({});
        await g.flushed();
        await reload();
        const next = useGame();
        next.start('貝拉', 'human', 'fighter');
        await new Promise((r) => setTimeout(r, 20));
        await next.refreshSlots();
        const backup = next.slots.find((m) => m.kind === 'auto');
        expect(backup).toMatchObject({ pcName: '艾倫' });
        expect(backup.name).toContain('開新遊戲前');
        await next.loadSlot(backup.id);
        expect(next.state.money_cc).toBe(123);
    });
});
describe('prompt sets', () => {
    it('turn the old prompts into the default set and switch at any time', () => {
        localStorage.setItem('elondia.prompts', JSON.stringify({ styles: [{ id: 's1', name: '冷硬', content: '短句。', enabled: true, targets: ['narration'] }], custom: [], lore: {}, customLore: [] }));
        setActivePinia(createPinia());
        const p = usePrompts();
        expect(p.sets.map((x) => x.name)).toEqual(['預設']);
        expect(p.config.styles.some((e) => e.content === '短句。')).toBe(true);
        const id = p.createSet('浪漫', p.active);
        p.switchSet(id);
        p.config.styles.push({ id: 's2', name: '花俏', content: '多用比喻。', enabled: true, targets: ['narration'] });
        p.switchSet(p.sets[0].id);
        expect(p.config.styles.some((e) => e.content === '多用比喻。')).toBe(false);
        p.switchSet(id);
        expect(p.config.styles.some((e) => e.content === '多用比喻。')).toBe(true);
        // 重新整理後還在
        setActivePinia(createPinia());
        const again = usePrompts();
        expect(again.activeName).toBe('浪漫');
        expect(again.config.styles.some((e) => e.content === '多用比喻。')).toBe(true);
        again.deleteSet(again.active);
        expect(again.activeName).toBe('預設');
        expect(() => again.deleteSet(again.active)).toThrow('至少');
    });
});
