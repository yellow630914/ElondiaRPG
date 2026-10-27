def rep(p,a,b):
    s=open(p).read(); assert s.count(a)==1,(p,a); open(p,'w').write(s.replace(a,b))
p='src/engine/storyMods.ts'
rep(p,"""  if (kind === 'check') out.check = check(n.check) ?? { attr: 'int', dc: 12 }
""","""  const allies = (n.allies ?? []).map((a) => str(a, 60)).filter(Boolean)
  if (allies.length) out.allies = [...new Set(allies)]
  if (kind === 'check') out.check = check(n.check) ?? { attr: 'int', dc: 12 }
""")
rep(p,"""    for (const id of n.foes ?? []) if (!npcIds.has(id)) out.push(`${t}的敵對角色 ${id} 不存在`)
""","""    for (const id of n.foes ?? []) if (!npcIds.has(id)) out.push(`${t}的敵對角色 ${id} 不存在`)
    for (const id of n.allies ?? []) if (!npcIds.has(id)) out.push(`${t}的友方角色 ${id} 不存在`)
    for (const id of n.allies ?? []) if (n.foes?.includes(id)) out.push(`${t}：${id} 同時是友方與敵對角色`)
""")
