def rep(p,a,b):
    s=open(p).read(); assert s.count(a)==1,(p,a); open(p,'w').write(s.replace(a,b))
p='src/components/content/StoryNodeEditor.vue'
rep(p,"""function toggleFoe(id: string, on: boolean) {
  const set = new Set(node.value.foes ?? [])
  if (on) set.add(id)
  else set.delete(id)
  node.value.foes = set.size ? [...set] : undefined
}""","""function toggleNpc(field: 'foes' | 'allies', id: string, on: boolean) {
  const set = new Set(node.value[field] ?? [])
  if (on) set.add(id)
  else set.delete(id)
  node.value[field] = set.size ? [...set] : undefined
}""")
rep(p,"""@change="toggleFoe(n.id, ($event.target as HTMLInputElement).checked)\"""","""@change="toggleNpc('foes', n.id, ($event.target as HTMLInputElement).checked)\"""")
rep(p,"""    <div class="row small">這些旗標成立時不出現 <FlagInput v-model="requires.flags_none" /></div>
""","""    <div class="row small">這些旗標成立時不出現 <FlagInput v-model="requires.flags_none" /></div>
    <div class="row checks small">
      <span>在場的友方固定 NPC：</span>
      <label v-for="n in namedNpcs" :key="n.id" class="check">
        <input type="checkbox" :checked="node.allies?.includes(n.id)" @change="toggleNpc('allies', n.id, ($event.target as HTMLInputElement).checked)" /> {{ n.name }}
      </label>
    </div>
    <p v-if="node.allies?.length" class="small muted">
      解鎖時，勾選的角色會站在{{ ['outskirts', 'dungeon', 'side'].includes(where) ? ' ⭐ 旁邊' : where === 'npc' || where === 'road' ? '這裡' : '設施上' }}（不管平常的出沒與出現條件）；戰鬥時站在你這邊（由你操作），AI 判定與寫經過時也知道他們在場。要在成功後一起走，結果裡用「任務同行」。
    </p>
""")
p='src/components/content/NpcEditor.vue'
s=open(p).read()
import re
i=s.find('依劇情旗標改變出沒')
print(s[i-200:i+900])
