import json,re
P='data/rules/enemies.json'
def load():
    lines=open(P).read().split('\n'); idx={}
    for i,l in enumerate(lines):
        m=re.match(r'(\s*)(\{"id": .*\})(,?)\s*$',l)
        if m and '"level"' in l: idx[json.loads(m.group(2))['id']]=(i,m.group(1),m.group(3))
    return lines,idx
def get(lines,idx,id_):
    i,_,_=idx[id_]; return json.loads(re.match(r'\s*(\{.*\}),?\s*$',lines[i]).group(1))
def put(lines,idx,o):
    i,ind,c=idx[o['id']]; lines[i]=ind+json.dumps(o,ensure_ascii=False)+c
def reorder(o):
    order=['id','name','level','attrs','hp','ap','weapon','evade','dr','abilities','ability_hp_below','resist','offense']
    out={k:o[k] for k in order if k in o}
    for k,v in o.items():
        if k not in out: out[k]=v
    return out
def save(lines): open(P,'w').write('\n'.join(lines))
def bosses():
    d=json.load(open(P)); return [g[0][0] for v in d['encounters'].values() for g in v.get('bosses',{}).values()]
