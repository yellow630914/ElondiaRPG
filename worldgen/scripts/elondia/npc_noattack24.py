# 特殊任務用到的固定 NPC 補上 no_attack（第二十四批的新任務用到墨鱗）；只改那一行，可以重跑
P = 'data/world/npcs.json'
s = open(P).read()
for i in ['npc_moring']:
    key = f'{{ "id": "{i}", '
    a = s.index(key)
    line_end = s.index('\n', a)
    line = s[a:line_end]
    if '"no_attack": true' not in line:
        s = s[:a] + line.replace('"unhireable": true,', '"unhireable": true, "no_attack": true,', 1) + s[line_end:]
open(P, 'w').write(s)
