import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { stories } from '@/engine/data';
import { enterLocation } from '@/engine/grid';
import { applyContent, emptyMods } from '@/engine/mods';
import { newGame } from '@/engine/state';
import { abandonStory, startStory } from '@/engine/story';
import { setFlag } from '@/engine/storyFlags';
import { copyStory, newStory, progressBreaks, sanitizeStory, storyCheck } from '@/engine/storyMods';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import { editableWorld } from './testWorld';
beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
});
afterEach(() => applyContent(emptyMods()));
const clone = (v) => JSON.parse(JSON.stringify(v));
const relic = () => clone(stories.find((s) => s.id === 'lost_relic'));
function game() {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 5, birthplace: 'soriel' });
    enterLocation(state);
    return state;
}
/** 進行到「追查足跡」：打聽消息已經完成、拿到 relic_lead */
function midRelic() {
    const state = game();
    startStory(state, 'lost_relic');
    state.stories.lost_relic.done.push('ask_tavern');
    setFlag(state, 'relic_lead');
    return state;
}
describe('story check: errors block saving, warnings do not', () => {
    it('splits problems into errors and warnings', () => {
        expect(storyCheck(newStory('mod_story_ok'))).toEqual({ errors: [], warnings: [] });
        const s = newStory('mod_story_x');
        s.nodes[0] = { ...s.nodes[0], requires: { flags: ['from_somewhere_else'] } };
        const warnOnly = storyCheck(s);
        expect(warnOnly.errors).toEqual([]);
        expect(warnOnly.warnings.some((w) => w.includes('from_somewhere_else'))).toBe(true);
        const manual = sanitizeStory('mod_story_m', { ...newStory('mod_story_m'), start: { kind: 'manual' } }, true);
        expect(storyCheck(manual, [manual]).errors).toEqual([]);
        expect(storyCheck(manual, [manual]).warnings.some((w) => w.includes('只由其他事件開啟'))).toBe(true);
        const bad = newStory('mod_story_bad');
        bad.nodes[0] = { ...bad.nodes[0], at: { where: 'npc', npc: 'nobody' }, kind: 'choice', success: undefined };
        bad.nodes.push({ id: 'n2', title: '戰鬥', text: '', at: { where: 'dungeon', location: 'soriel' }, kind: 'combat' });
        bad.start_flags = ['relic_started'];
        bad.rewards = [{ type: 'start_story', story: 'mod_story_bad' }, { type: 'perk', perk: 'no_such_perk' }];
        const e = storyCheck(bad).errors;
        for (const text of ['固定 NPC 不存在', '沒有任何結果會完成任務', '沒有選項', '不是地下城', '沒有敵人', '失竊的聖環徽記', '這個任務自己', 'no_such_perk']) {
            expect(e.some((x) => x.includes(text)), text).toBe(true);
        }
    });
    it('refuses to save a story with errors but saves one with only warnings', () => {
        const c = editableWorld();
        const bad = newStory('mod_story_bad');
        bad.nodes[0].success = {};
        expect(() => c.saveStory('mod_story_bad', bad)).toThrow('不能儲存');
        expect(c.mods.stories.mod_story_bad).toBeUndefined();
        const s = newStory('mod_story_w');
        s.nodes[0] = { ...s.nodes[0], requires: { flags: ['ai:答應幫忙'] } };
        s.nodes.push({ id: 'n2', title: '之後', text: '', at: { where: 'settlement', location: 'soriel' }, kind: 'story', requires: { flags: ['set_elsewhere'] } });
        c.saveStory('mod_story_w', s);
        expect(c.mods.stories.mod_story_w).toBeDefined();
    });
});
describe('story edits that break the current save', () => {
    it('blocks renaming or deleting a node the save already finished', () => {
        const state = midRelic();
        const before = stories.find((s) => s.id === 'lost_relic');
        const renamed = relic();
        renamed.nodes[0].id = 'ask_bar';
        expect(progressBreaks(state, before, renamed)[0]).toContain('ask_tavern');
        const removed = relic();
        removed.nodes.splice(0, 1);
        expect(progressBreaks(state, before, removed).length).toBe(1);
        // 沒完成過的任務點改 id 沒關係
        const fine = relic();
        fine.nodes[3].id = 'give_back';
        expect(progressBreaks(state, before, fine)).toEqual([]);
    });
    it('blocks an edit that leaves no reachable node, unless something running can still set the flag', () => {
        const state = midRelic();
        const before = stories.find((s) => s.id === 'lost_relic');
        const stuck = relic();
        stuck.nodes[1].requires = { flags: ['nobody_sets_this'] };
        expect(progressBreaks(state, before, stuck).some((x) => x.includes('卡住'))).toBe(true);
        // AI 判定可能會設定
        const ai = relic();
        ai.nodes[1].requires = { flags: ['ai:找到線索'] };
        expect(progressBreaks(state, before, ai)).toEqual([]);
        // 改標題之類不影響進度
        const title = relic();
        title.nodes[1].title = '追查足跡';
        expect(progressBreaks(state, before, title)).toEqual([]);
        // 修改前就已經沒有能進行的任務點：不擋
        state.flags['story:relic_lead'] = false;
        expect(progressBreaks(state, before, stuck)).toEqual([]);
    });
    it('counts flags another running quest can still set', () => {
        const c = editableWorld();
        const helper = newStory('mod_story_helper');
        helper.nodes[0].success = { complete: true, set_flags: ['helper_done'] };
        c.saveStory('mod_story_helper', helper);
        const state = midRelic();
        startStory(state, 'mod_story_helper');
        const before = stories.find((s) => s.id === 'lost_relic');
        const after = relic();
        after.nodes[1].requires = { flags: ['helper_done'] };
        expect(progressBreaks(state, before, after)).toEqual([]);
        abandonStory(state, 'mod_story_helper');
        expect(progressBreaks(state, before, after).length).toBe(1);
    });
    it('refuses the save in the store until the progress is abandoned, or saves the edit as a copy', () => {
        const c = editableWorld();
        const g = useGame();
        g.state = midRelic();
        const edit = relic();
        edit.nodes[0].id = 'ask_bar';
        expect(() => c.saveStory('lost_relic', edit)).toThrow('弄壞它的進度');
        // 複製成新任務：開頭旗標換成新的，不和原本的任務衝突
        const copy = copyStory(edit, 'mod_story_copy');
        expect(copy.start_flags).toEqual(['mod_story_copy_relic_started']);
        expect(copy.nodes[0].requires?.flags).toEqual(['mod_story_copy_relic_started']);
        c.saveStory('mod_story_copy', copy);
        expect(storyCheck(stories.find((s) => s.id === 'mod_story_copy')).errors).toEqual([]);
        expect(c.mods.stories.lost_relic).toBeUndefined();
        // 放棄這個存檔的進度後可以存
        abandonStory(g.state, 'lost_relic');
        c.saveStory('lost_relic', edit);
        expect(stories.find((s) => s.id === 'lost_relic').nodes[0].id).toBe('ask_bar');
    });
});
describe('importing content', () => {
    it('leaves out stories with errors and says why', () => {
        const c = editableWorld();
        const good = newStory('mod_story_good');
        const bad = newStory('mod_story_bad');
        bad.nodes[0].success = {};
        c.importMods(JSON.stringify({ ...emptyMods(), stories: { mod_story_good: good, mod_story_bad: bad } }));
        expect(Object.keys(c.mods.stories)).toEqual(['mod_story_good']);
        expect(c.problems.some((p) => p.includes('沒有匯入') && p.includes('完成任務'))).toBe(true);
        expect(useContent().mods.stories.mod_story_bad).toBeUndefined();
    });
});
