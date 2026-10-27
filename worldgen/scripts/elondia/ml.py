import re,glob,sys
for f in sorted(glob.glob('src/components/**/*.vue',recursive=True)):
    s=open(f,encoding='utf8').read()
    m=re.search(r'<template>.*</template>',s,re.S)
    if not m: continue
    t=m.group(0); off=s[:m.start()].count('\n')
    for mm in re.finditer(r'（[^（）]*）',t):
        if '\n' in mm.group(0):
            ln=off+t[:mm.start()].count('\n')+1
            print(f"{f}:{ln}: {mm.group(0)!r}")
