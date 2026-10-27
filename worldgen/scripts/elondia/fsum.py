import json,sys
r=json.load(open(sys.argv[1]))
for L in ('shallow','middle','deep','abyss'):
    g=[x for x in r if x['layer']==L]
    av=lambda k: sum(x[k] for x in g)/len(g)
    print(' ',L,'win %.2f (min %.2f)'%(av('win'),min(x['win'] for x in g)),'rounds %.1f'%av('rounds'),'hpLeft %.2f (%.2f-%.2f)'%(av('hpLeft'),min(x['hpLeft'] for x in g),max(x['hpLeft'] for x in g)),'downed %.2f'%av('downed'))
print('  hpAll %.2f (%.2f-%.2f)'%(sum(x['hpAll'] for x in r)/len(r),min(x['hpAll'] for x in r),max(x['hpAll'] for x in r)))
