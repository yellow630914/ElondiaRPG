import json
KEYS1 = ['id', 'name', 'gender', 'race', 'class', 'level', 'location', 'hire_cc', 'unhireable', 'no_attack', 'no_steal', 'adult']
KEYS2 = ['kind', 'tags', 'occupation', 'landmark', 'fixed', 'keeper', 'lineage', 'requires']
def j(v): return json.dumps(v, ensure_ascii=False)
def inline(v):
    if isinstance(v, dict):
        return '{ ' + ', '.join(f'{j(k)}: {inline(x)}' for k, x in v.items()) + ' }' if v else '{}'
    if isinstance(v, list):
        return '[' + ', '.join(inline(x) for x in v) + ']'
    return j(v)

def fmt(n):
    lines = []
    head = ', '.join(f'"{k}": {j(n[k])}' for k in KEYS1 if k in n)
    lines.append('    { ' + head)
    l2 = ', '.join(f'"{k}": {inline(n[k]) if isinstance(n[k], dict) else j(n[k])}' for k in KEYS2 if k in n)
    if l2: lines.append('      ' + l2)
    if 'haunts' in n: lines.append('      "haunts": [' + ', '.join(inline(h) for h in n['haunts']) + ']')
    if 'stages' in n: lines.append('      "stages": ' + j(n['stages']))
    p = f'"personality": {j(n["personality"])}' + (f', "faction": {j(n["faction"])}' if n.get('faction') else '')
    lines.append('      ' + p)
    for k in ['appearance', 'adult_appearance', 'background']:
        if n.get(k): lines.append(f'      "{k}": {j(n[k])}')
    for k in ['attrs', 'abilities', 'perks']:
        if k in n: lines.append(f'      "{k}": {j(n[k])}')
    if n.get('gear'): lines.append('      "gear": ' + inline(n['gear']))
    lines.append('      "relations": ' + (inline(n['relations']) if n.get('relations') else '{}'))
    if n.get('squad'): lines.append('      "squad": ' + inline(n['squad']))
    known = set(KEYS1 + KEYS2 + ['haunts', 'stages', 'personality', 'faction', 'appearance', 'adult_appearance', 'background', 'attrs', 'abilities', 'perks', 'gear', 'relations', 'squad'])
    extra = set(n) - known
    assert not extra, (n['id'], extra)
    return ',\n'.join(lines) + ' }'


def write(path, base, ordered):
    body = ',\n'.join(fmt(n) for n in ordered)
    text = '{\n  "$comment": ' + j(base['$comment']) + ',\n  "version": ' + str(base['version']) + ',\n  "npcs": [\n' + body + '\n  ]\n}\n'
    json.loads(text)
    open(path, 'w').write(text)
