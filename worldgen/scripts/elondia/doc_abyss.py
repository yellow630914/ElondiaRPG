import json,re
R='data/rules/'
d=json.load(open(R+'enemies.json'))
E={x['id']:x for x in d['enemies']}
ab=json.load(open(R+'abilities.json'))
AB={}
def walk(o):
    if isinstance(o,dict):
        if 'id' in o and 'name' in o: AB.setdefault(o['id'],o['name'])
        for v in o.values(): walk(v)
    elif isinstance(o,list):
        for v in o: walk(v)
walk(ab)
DT={t['id']:t['name'] for t in json.load(open(R+'damage_types.json'))['types']}
DT['physical']='物理'
geo=json.load(open('data/world/geography.json'))
locs={l['id']:l['name'] for l in geo['locations']}
def resist(r):
    if not r: return '—'
    imm=[DT[k] for k,v in r.items() if v<=-1]
    res=[f"{DT[k]}×{1+v:g}" for k,v in r.items() if -1<v<0]
    wk=[f"{DT[k]}×{1+v:g}" for k,v in r.items() if v>0]
    out=[]
    if imm: out.append('免疫 '+'、'.join(imm))
    if res: out.append('抵抗 '+'、'.join(res))
    if wk: out.append('弱點 '+'、'.join(wk))
    return '、'.join(out)
def loot(m):
    parts=[]
    for l in m.get('loot',[]):
        parts.append(l['item'])
    s='、'.join(dict.fromkeys(parts)) or '—'
    if m.get('armed'): s+='；可能掉裝備'
    return s
def row(m,pos):
    w=m['weapon']
    return f"| {m['name']} | {pos} | {m['level']} | {m['hp']} | {DT[w['type']]} {w['dice']} | {'、'.join(AB.get(a,a) for a in m['abilities']) or '—'} | {resist(m.get('resist'))} | {'✓' if m.get('rut') else ''} | {loot(m)} | {m.get('desc','')} |"
doc=open('docs/MONSTERS.md').read()
lines=doc.split('\n')
for did,enc in d['encounters'].items():
    if not enc.get('abyss'): continue
    name=locs[did]
    minions=[]
    for g in enc['abyss']:
        for mid,_ in g:
            if E[mid]['level']>=11 and mid not in minions: minions.append(mid)
    boss=enc['bosses']['abyss'][0][0]
    i=lines.index(f'### {name}')
    j=i+1
    while not lines[j].startswith('|'): j+=1
    k=j
    while k<len(lines) and lines[k].startswith('|'): k+=1
    tbl=lines[j:k]
    last_deep=max(n for n,l in enumerate(tbl) if l.split('|')[2].strip()=='深層')
    new=tbl[:last_deep+1]+[row(E[m],'底層') for m in minions]+tbl[last_deep+1:]+[row(E[boss],'底層層主')]
    lines[j:k]=new
    print(name,minions,boss)
open('docs/MONSTERS.md','w').write('\n'.join(lines))
