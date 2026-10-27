import json, re
ROOT='.'
P=f'{ROOT}/data/worldbook/elondia.worldbook.json'
raw=open(P).read()
w=json.loads(raw)
E=w['entries']
npcs=json.load(open(f'{ROOT}/data/world/npcs.json'))['npcs']
geo=json.load(open(f'{ROOT}/data/world/geography.json'))
LOC={l['id']:l for l in geo['locations']}
lm=json.load(open(f'{ROOT}/data/world/landmarks.json')); lm=lm['landmarks'] if isinstance(lm,dict) else lm
LM={x['id']:x['name'] for x in lm}
FEATURED={'npc_amber','npc_aurelia','npc_gwendolyn','npc_rein','npc_gero','npc_marina','npc_leila','npc_matilda_rosen','npc_helga_malt','npc_sylvie','npc_bruk','npc_saka','npc_gorr','npc_lina','npc_selene','npc_borin','npc_ael','npc_kai','npc_mira'}
SUMMARY={
 'npc_anastasia':'晨曦王國的公主、聖環教廷晨曦教區的樞機主教，國王與精靈妃子所生的半精靈。嬌小優雅、政治手腕老辣',
 'npc_alexei':'晨曦王國的嫡皇子，強大的騎士。等王位等到快五十歲，培養了自己的班底',
 'npc_alexander':'晨曦王國的國王，年輕時是對抗魔族的偉大騎士。年老仍硬朗，遲遲不肯讓位，最近總是昏昏沉沉',
 'npc_otto_iii':'萊茵帝國皇帝。多年不曾公開露面，署名的敕令卻英明得令人生畏；與魔族的停戰由他一手促成',
 'npc_gwendolyn':'巡禮中的牧師，溫婉可愛的偽娘，和奧菈莉婭一起長大',
 'npc_aurelia':'巡禮中的聖騎士，清冷優雅的金髮女劍士，和格溫德琳組成「白百合巡禮」',
 'npc_amber':'愛錢又話多的精靈遊蕩者，在索里耶爾的貧民窟長大，逃跑的本事一流',
 'npc_rein':'自稱「被選中的勇者」的熱血青年，「曙光勇者團」的團長（團員：露露、布琳）',
 'npc_lina':'沙痕部落出身的貓魅族嚮導','npc_selene':'見習修女','npc_borin':'矮人戰士','npc_ael':'精靈學者，「旅歌隊」的記錄員','npc_kai':'自由集市長大的扒手','npc_mira':'流浪詩人，「旅歌隊」的隊長',
 'npc_coral_miko':'珊瑚灣鎮海靈祠的巫女，人稱「珊瑚巫女」，聽得懂海浪的話',
}
REGION_ENTRY={'central':'6','north':'7','south':'27','forest':'32','east_sea':'33','west':'41'}
def first_sentence(s):
    m=re.match(r'(.+?。)', s)
    return (m.group(1) if m else s).rstrip('。')
def place(n):
    loc=LOC[n['location']]['name']
    if n.get('landmark'): return f"{loc}・{LM[n['landmark']]}"
    if n.get('requires'): return f"{loc}（很少露面）"
    return f"{loc}走動"
def keep(n):
    if n.get('adult'): return False
    return n.get('unhireable') or n.get('landmark') or n['level']>=9 or n['id'] in FEATURED or n.get('kind')=='commoner' and n['level']>=5
by={}
for n in npcs:
    if not keep(n): continue
    by.setdefault(LOC[n['location']]['region'],[]).append(n)
REGION_NAME={'central':'中央平原与丘陵地带','north':'北境群山','south':'南境枯萎荒原','forest':'古树森林','east_sea':'东海群岛','west':'西部荒野'}
tmpl=E['6']
next_uid=max(int(k) for k in E)+1
order=tmpl['order']
def keys_of(name):
    ks={name}
    bare=re.sub(r'「[^」]*」','',name)
    ks.add(bare)
    for part in bare.split('・'):
        if len(part)>=2: ks.add(part)
    return [k for k in ks if len(k)>=2]
for region in REGION_ENTRY:
    lines=[f'重要人物-{REGION_NAME[region]}（当代）:']
    keys=[]
    cur=None
    for n in by.get(region,[]):
        loc=LOC[n['location']]['name']
        if loc!=cur:
            lines.append(f'  {loc}:'); cur=loc
        s=SUMMARY.get(n['id']) or first_sentence(n.get('background') or n['personality'])
        lines.append(f"    - {n['name']}（{place(n)}）: '{s}'")
        keys+=keys_of(n['name'])
    found=[k for k,v in E.items() if v['comment']==f'人物-{REGION_NAME[region]}']
    if found: uid=found[0]
    else: uid=str(next_uid); next_uid+=1
    e=json.loads(json.dumps(tmpl))
    e.update(uid=int(uid), key=sorted(set(keys), key=keys.index), comment=f'人物-{REGION_NAME[region]}', content='\n'.join(lines), order=order+1, displayIndex=int(uid))
    E[uid]=e
    print(uid, region, len(by.get(region,[])), len(e['content']))
# 勢力概述：現任首領
e=E['28']
MARK2='\n\n各势力现任首领:'
c=e['content'].split(MARK2)[0].rstrip()
leaders='''各势力现任首领:
  - 萊茵帝國: '皇帝奧托三世，多年不曾公開露面，敕令由獨生女、帝國宰相艾蕾諾拉・馮・萊茵頒布。帝國主導了與魔族的停戰，人類面對魔族的邊疆大半由帝國把守；四個戍邊軍團（北境第一、西境第二、南境第三與第四）的將軍之間，主戰與主和的矛盾日益激化'
  - 晨曦王國: '國王亞歷山大（羅曼諾夫王室），年老卻遲遲不肯讓位；嫡皇子阿列克謝與擔任樞機主教的公主安納塔西亞暗中角力，貴族派之首洛倫佐公爵是雙方拉攏的對象'
  - 聖環教廷: '教皇格里高利七世；審判長瓦倫汀・克雷掌管「真理之鏡」。教廷對帝國漸漸脫離掌控、與魔族停戰深感憂慮'
  - 奧德聯邦: '七議席議會，本屆輪值首席康斯坦絲・瓦格納（壟斷金融）；議員伊格納茲・金秤壟斷陸路商路、瑪蒂爾達・羅森壟斷傭兵與勞務契約'
  - 矮人氏族聯盟: '「山之王系」的矮人王托林・鐵爐，幾乎把持所有權力'
  - 魔族領主議會: '魔王「赤翼之君」莉莎爾；血角氏族酋長格羅姆・碎角是最大的反對派'
  - 精靈王庭: '女王伊瑟蘭迪爾；翠輝議會（保守派）與新芽同盟（主張接納外族）之間的理念之爭'
  - 七潮議會（潮汐港）: '首席貝雅特麗絲，人稱「白鯨」；走私王「黑帆」卡洛斯掌握地下貿易'
  - 玉璘族四時殿（滄月闕）: '今年的潮主是春潮閣殿主櫻汐'
  - 荒野部落聯盟: '大祭禮娜伊薇（月尾）；赤鬃族長卡菈不滿大祭禮總出身月尾\''''
e['content']=c+'\n\n'+leaders.rstrip("'")+"'" if False else c+'\n\n'+leaders
print(len(e['content']))
# 種族-人類：帝國與王國的現狀
e=E['34']
c=e['content']
old1="      - 现状: '为联盟的军事核心，但其皇帝「奥托三世」与教会的矛盾日益扩大。'"
new1="      - 现状: '为联盟的军事核心，人类面对魔族的边疆大半由帝国把守；与魔族的停战由皇帝「奥托三世」一手促成。皇帝多年不曾公开露面，与教会的矛盾日益扩大。'"
assert old1 in c; c=c.replace(old1,new1)
e['content']=c
json.loads(json.dumps(w))
open(P,'w').write(json.dumps(w,ensure_ascii=False,indent=2)+('\n' if raw.endswith('\n') else ''))
