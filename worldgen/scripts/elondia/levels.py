import json
j=json.load(open('data/rules/enemies.json'))
en={e['id']:e for e in j['enemies']}; enc=j['encounters']
for d,t in enc.items():
    row=[d]
    for L in ['outskirts','shallow','middle','deep']:
        lv=[en[m]['level'] for g in t.get(L,[]) for m,_ in g if m in en]
        b=(t.get('bosses',{}) or {}).get(L) or (t.get('boss') if L=='deep' else None)
        bl=[en[m]['level'] for m,_ in b if m in en] if b else []
        row.append(f"{L}:{min(lv) if lv else '-'}-{max(lv) if lv else '-'} avg{round(sum(lv)/len(lv),1) if lv else '-'} B{bl}")
    print(' | '.join(row))
