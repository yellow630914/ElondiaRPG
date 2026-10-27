import re,sys,json
p='story_enemies.py'; s=open(p).read()
cfg=json.loads(sys.argv[1])
for i,kw in cfg.items():
    m=re.search(r'\{"id": "%s",.*'%i, s); line=m.group(0); new=line
    if 'off' in kw: new=re.sub(r'("offense": \{"all": )[0-9.]+', lambda x:x.group(1)+str(kw['off']), new)
    if 'hp' in kw: new=re.sub(r'("hp": )\d+', lambda x:x.group(1)+str(kw['hp']), new)
    if 'dice' in kw: new=re.sub(r'("dice": ")[0-9d]+', lambda x:x.group(1)+kw['dice'], new)
    s=s.replace(line,new)
open(p,'w').write(s)
