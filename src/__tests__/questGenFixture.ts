// 特殊任務生成器的測試用 AI 回覆（questGen.spec、questGenStore.spec 共用）

/** 燈塔守夜人：揭發或收下封口費；一個新 NPC、一件物品、一個地標、一張地圖、一隻替身怪物、一個技能與狀態 */
export function reply() {
  return {
    story: {
      title: '燈塔的守夜人',
      summary: '港口的燈塔守夜人其實是走私集團的眼線。',
      start: { kind: 'guild', location: 'soriel', min_level: 99 },
      start_flags: ['started'],
      nodes: [
        {
          id: 'ask', title: '到索里耶爾的酒館打聽燈塔的事', text: '酒客說 $npc1 每晚都提著燈出門。', kind: 'story',
          at: { where: 'cell', location: 'soriel', cell: 'tavern' }, requires: { flags: ['started'] },
          success: { text: '你決定去燈塔看看。', set_flags: ['heard'], effects: [{ type: 'money', amount: 999999 }] },
        },
        {
          id: 'tower', title: '在燈塔和守夜人對質', text: '$npc1 看見你，臉色一沉。', kind: 'choice',
          at: { where: 'cell', location: 'soriel', cell: '$lm1' }, requires: { flags: ['heard'] },
          options: [
            { label: '揭發他', success: { set_flags: ['expose'], effects: [{ type: 'affinity', npc: '$npc1', delta: -10 }] } },
            { label: '收下封口費', success: { text: '你收下 $item1。', effects: [{ type: 'item', name: '$item1', qty: 1 }], complete: true } },
            { label: '只有不允許的標籤', tags: ['ntr'], success: { complete: true } },
          ],
        },
        {
          id: 'fight', title: '追進走私者的地窖', text: '守夜人的打手擋住去路。', kind: 'combat',
          at: { where: 'special', special_map: '$sm1' }, requires: { flags: ['expose'] }, enemies: [['$foe1', 1]],
          success: { complete: true, scene: '不該出現的親密場景' }, fail: { fail_quest: true },
        },
      ],
      rewards: [{ type: 'money', amount: 5 }, { type: 'xp', amount: 5 }],
    },
    new: {
      npcs: [{ ref: '$npc1', name: '老守夜人格倫', race: 'human', class: 'fighter', level: 5, location: 'nowhere', personality: '寡言', hire_cc: 1 }],
      items: [{ ref: '$item1', name: '沉甸甸的錢袋', category: 'gear', desc: '封口費。' }],
      landmarks: [{ ref: '$lm1', location: 'soriel', name: '港口燈塔', emoji: '🗼', desc: '海邊的燈塔。', types: ['harbor', 'nope'] }],
      specialMaps: [{ ref: '$sm1', location: 'soriel', name: '走私者的地窖', size: [40, 2], enemies: ['$foe1', 'no_such_monster'] }],
      statuses: [{ ref: '$st1', template: 'poisoned', name: '鹹水毒', dot: { dice: '20d12', type: 'poison' } }],
      abilities: [{ ref: '$ab1', template: 'venom_bite', name: '鹽漬匕首', damage: [{ dice: '30d10', type: 'piercing' }], apply: [{ status: '$st1', turns: 2, on: 'hit' }] }],
      enemies: [{ ref: '$foe1', name: '燈塔的打手', level: 5, kind: 'humanoid', hp: 99999, ap: 3, attrs: { str: 14, dex: 12, int: 8, fai: 8, cha: 8 }, weapon: { dice: '10d12', type: 'slashing', attr: 'str' }, evade: 0, dr: 0, xp: 1, abilities: ['$ab1', 'no_such_skill'] }],
      perks: [{ ref: '$pk1', name: '不該有的特質' }],
    },
    notes: '兩條路：揭發要打一架，收錢就結束。',
  }
}
