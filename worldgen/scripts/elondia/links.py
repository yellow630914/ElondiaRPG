import re, os, glob, sys, unicodedata
root = sys.argv[1]
files = glob.glob(f'{root}/worldgen/**/*.md', recursive=True) + glob.glob(f'{root}/docs/*.md') + [f'{root}/README.md']
def anchors(path):
    out=set()
    for line in open(path, encoding='utf-8'):
        m = re.match(r'^(#+)\s+(.*)', line)
        if m:
            t = m.group(2).strip().lower()
            t = re.sub(r'[^\w\- 一-鿿]', '', t)
            out.add(t.replace(' ', '-'))
    return out
bad = 0
for f in files:
    text = open(f, encoding='utf-8').read()
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    for m in re.finditer(r'\]\(([^)\s]+)\)', text):
        link = m.group(1)
        if re.match(r'^[a-z]+://', link) or link.startswith('mailto:'): continue
        path, _, frag = link.partition('#')
        target = os.path.normpath(os.path.join(os.path.dirname(f), path)) if path else f
        if not os.path.exists(target):
            print('MISSING', os.path.relpath(f, root), link); bad += 1; continue
        if frag and target.endswith('.md') and frag not in anchors(target):
            print('ANCHOR?', os.path.relpath(f, root), link)
print('files', len(files), 'bad', bad)
