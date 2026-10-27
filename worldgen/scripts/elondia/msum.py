import json,sys
r=json.load(open(sys.argv[1])); l=[1-x['hpLeft'] for x in r]
print(' loss min %.3f max %.3f mean %.3f  in[0.1,0.15]: %d/%d  win min %.2f'%(min(l),max(l),sum(l)/len(l),sum(0.1<=x<=0.15 for x in l),len(l),min(x['win'] for x in r)))
