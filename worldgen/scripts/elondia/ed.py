import sys,json
def ed(p,rep,imp=None):
    s=open(p,encoding='utf8').read()
    for a,b in rep:
        assert s.count(a)==1,(p,a,s.count(a))
        s=s.replace(a,b)
    if imp and 'import Hint' not in s:
        anchor,line=imp
        assert s.count(anchor)==1,(p,anchor)
        s=s.replace(anchor,anchor+line+'\n')
    open(p,'w',encoding='utf8').write(s)
