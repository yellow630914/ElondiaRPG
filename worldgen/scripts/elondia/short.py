import re,glob,sys
for f in sorted(glob.glob('src/components/**/*.vue',recursive=True)):
    s=open(f,encoding='utf8').read()
    m=re.search(r'<template>.*</template>',s,re.S)
    if not m: continue
    t=m.group(0); off=s[:m.start()].count('\n')
    for mm in re.finditer(r'（([^（）{}]*)）',t):
        n=len(mm.group(1))
        if 5<=n<10:
            ln=off+t[:mm.start()].count('\n')+1
            line=s.split('\n')[ln-1].strip()
            print(f"{f}:{ln}: {mm.group(0)}   ||| {line[:140]}")
