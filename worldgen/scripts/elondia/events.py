import json, sys
def A(d, r): return {"type": "affinity", "npc": "master", "delta": d, "reason": r}
def HP(n): return {"type": "hp", "target": "pc", "amount": n}
def C(i): return {"type": "condition", "target": "pc", "condition": i, "add": True}
def M(n): return {"type": "money", "amount": n}
def S(n): return {"type": "strict", "delta": n}
def X(h): return {"type": "home_extend", "hours": h}
HOME = {"type": "master_home"}
def XP(n): return {"type": "xp", "amount": n, "target": "pc"}
FREE_TALK = {"type": "flag", "key": "negotiate_bonus", "value": True}
def chk(a, dc): return {"attr": a, "dc": dc}

def opt(label, result=None, effects=None, check=None, success=None, fail=None, es=None, fe=None, hours=None):
    o = {"label": label}
    if result: o["result"] = result
    if check: o["check"] = check
    if success: o["success"] = success
    if fail: o["fail"] = fail
    if effects: o["effects"] = effects
    if es: o["effects_success"] = es
    if fe: o["fail_effects"] = fe
    if hours is not None: o["hours"] = hours
    return o

E = []
def ev(id, text, hours, options, weight=2, **cond):
    e = {"id": id, "weight": weight}
    e.update(cond)
    e["text"] = text; e["hours"] = hours; e["options"] = options
    E.append(e)

# ---- 離家逾期：主人要回家 ----
ev("call_home", "{master}算了算日子，皺起眉頭：「離家太久了，收拾一下，該回去了。」", 0.25, [
  opt("乖乖跟著回去", result="你收拾好行李，跟著{master}踏上回家的路。", effects=[HOME, A(1, "聽話地跟著回家")]),
  opt("求主人再寬限幾天", check=chk("cha", 14), success="{master}想了想，答應再多待兩天。", fail="{master}不耐煩地揮手：「少囉嗦，現在就走。」",
      es=[X(48)], fe=[HOME, S(1), A(-1, "拖延回家")]),
  opt("找藉口拖延", check=chk("cha", 16), success="你編了個像樣的理由，{master}勉強多留了一天。", fail="{master}看穿了你的藉口，揪著你的領子把你拖回家。",
      es=[X(24), A(-1, "找藉口拖延")], fe=[HOME, S(1), HP(-3), A(-3, "說謊拖延")]),
], weight=1, overdue=True)

# ---- 主人對你有好感 ----
ev("share_meal", "{master}難得讓你同桌吃飯，還替你夾了一塊肉。", 1, [
  opt("安靜地吃", result="你小口小口地吃完，肚子很久沒這麼飽了。", effects=[C("fed_well"), A(1, "同桌吃飯")]),
  opt("陪主人聊天", check=chk("cha", 12), success="你陪{master}說說笑笑，飯桌上的氣氛難得輕鬆。", fail="你說錯了一句話，{master}的笑容淡了下去。",
      effects=[C("fed_well")], es=[A(3, "陪主人聊天")], fe=[A(-1, "說錯話")]),
  opt("堅持站在一旁伺候", result="{master}搖搖頭，由著你去，卻多看了你一眼。", effects=[A(1, "守規矩")]),
], affinity_min=30)
ev("allowance", "{master}塞給你幾枚零錢：「拿去買點自己想要的。」", 0.1, [
  opt("道謝收下", result="你把零錢小心收好。", effects=[M(25), A(1, "收下零用錢")]),
  opt("問主人想要什麼，替他買回來", check=chk("cha", 13), success="你買回{master}喜歡的小東西，{master}很是高興。", fail="你買錯了東西，{master}只是聳聳肩。",
      es=[A(3, "貼心")], fe=[A(0, "")], hours=1),
  opt("婉拒，說伺候主人是本分", result="{master}笑罵你死腦筋，還是把錢塞進你手裡。", effects=[M(25), A(2, "懂分寸")]),
], affinity_min=40)
ev("teach", "{master}心情很好，說要教你幾手自己的看家本領。", 2, [
  opt("認真學", check=chk("int", 12), success="你學得很快，{master}難掩得意。", fail="你學得磕磕絆絆，{master}嘆了口氣，但還是教完了。",
      effects=[XP(20)], es=[XP(30), A(2, "學得快")]),
  opt("請主人示範給你看", result="{master}興致勃勃地示範了一遍又一遍。", effects=[XP(25), A(1, "虛心求教")]),
  opt("推說累了想休息", result="{master}有點掃興，揮手讓你去睡。", effects=[C("well_rested"), A(-1, "掃興")]),
], affinity_min=50)
ev("confide", "{master}喝了點酒，對你說起了自己的往事。", 1, [
  opt("靜靜地聽", result="你一直聽到{master}睡著，替他蓋上了毯子。", effects=[A(3, "傾聽")]),
  opt("出言安慰", check=chk("cha", 13), success="你的話讓{master}紅了眼眶，拍了拍你的肩。", fail="你的安慰聽起來很客套，{master}沒再說下去。",
      es=[A(4, "貼心的安慰")]),
  opt("趁機提起自由的事", check=chk("cha", 17), success="{master}沉默了很久，最後說：「……我會考慮。」", fail="{master}的臉色一下子冷了下來。",
      es=[FREE_TALK, A(1, "坦白")], fe=[A(-3, "不識趣")]),
], affinity_min=60)

# ---- 主人對你沒有好感 ----
ev("cold_shoulder", "{master}整天對你冷言冷語，故意找你的麻煩。", 0.5, [
  opt("忍氣吞聲", result="你一聲不吭地挨過一整天，心裡七上八下。", effects=[C("shaken")]),
  opt("加倍賣力做事", check=chk("str", 13), success="你把每件事都做得無可挑剔，{master}找不到話說。", fail="你累得出了錯，正好給了{master}發作的藉口。",
      es=[A(2, "賣力")], fe=[HP(-2), A(-1, "出錯")]),
  opt("頂撞回去", check=chk("cha", 16), success="{master}被你說得啞口無言，竟收斂了一些。", fail="{master}勃然大怒，罰你跪了一整晚。",
      es=[A(1, "敢於直言")], fe=[C("punished"), A(-3, "頂撞")]),
], affinity_max=-20)
ev("withhold_food", "{master}說你今天不配吃飯。", 0.25, [
  opt("餓著肚子忍過去", result="你餓得頭昏眼花，一直忍到隔天。", effects=[HP(-3)]),
  opt("偷偷找東西吃", check=chk("dex", 13), success="你趁沒人注意，從廚房摸了半塊麵包。", fail="你被逮個正著。",
      es=[C("fed_light")], fe=[C("punished"), A(-3, "偷吃")]),
  opt("低聲求情", check=chk("cha", 15), success="{master}冷哼一聲，丟給你一塊乾麵包。", fail="{master}連看都不看你一眼。",
      es=[C("fed_light"), A(1, "求情")], fe=[HP(-3), A(-1, "煩人")]),
], affinity_max=-30)
ev("chained_night", "{master}說怕你半夜逃跑，晚上要把你鎖起來。", 0.5, [
  opt("順從地伸出手", result="鐵鍊冰冷，你蜷在角落熬過一夜。", effects=[C("shaken"), A(1, "順從")]),
  opt("保證自己不會逃", check=chk("cha", 15), success="{master}打量你半晌，把鎖鏈收了起來。", fail="{master}冷笑：「奴隸的保證？」鎖得更緊了。",
      es=[A(1, "取得信任")], fe=[S(1), C("shaken")]),
  opt("掙扎反抗", check=chk("str", 16), success="你掙脫了，{master}罵罵咧咧地作罷，臉色卻很難看。", fail="你被按在地上，挨了一頓打，鎖得更緊。",
      es=[A(-2, "反抗")], fe=[HP(-4), C("punished"), S(1), A(-3, "反抗")]),
], affinity_max=-40)

# ---- 好人主人 ----
ev("good_wellbeing", "{master}問你最近過得好不好，有沒有哪裡不舒服。", 0.25, [
  opt("說實話", result="你說了心裡的話，{master}認真地聽完，點了點頭。", effects=[C("relaxed"), A(2, "坦誠")]),
  opt("說一切都好", result="{master}看了你一會兒，沒有追問。", effects=[A(1, "懂事")]),
  opt("請求多一點自由的時間", check=chk("cha", 12), success="{master}爽快地答應了：「出門在外，多待幾天也無妨。」", fail="{master}有些為難，只說再看看。",
      es=[X(48), A(1, "說出心願")]),
], tags=["good"], weight=3)
ev("good_heal", "{master}看見你身上的傷，皺著眉替你上藥包紮。", 0.5, [
  opt("道謝", result="藥膏涼涼的，傷口不那麼疼了。", effects=[HP(8), A(2, "道謝")]),
  opt("說不要緊", result="{master}瞪了你一眼，還是包紮好才放你走。", effects=[HP(6), A(1, "逞強")]),
  opt("下意識地縮開", result="{master}的手停在半空，嘆了口氣，把藥放在你手邊。", effects=[HP(4)]),
], tags=["good"])
ev("good_day_off", "{master}說今天沒什麼事，讓你自己去走走，不用跟著。", 2, [
  opt("好好休息", result="你難得睡了個午覺，醒來時心情輕鬆了不少。", effects=[C("relaxed"), S(-1)]),
  opt("留下來陪主人", result="{master}有點意外，笑著讓你坐下一起喝茶。", effects=[A(2, "陪伴")]),
  opt("出去四處看看", result="你在街上逛了一下午，回來時{master}只問你玩得開不開心。", effects=[C("cheered"), X(24)]),
], tags=["good"])
ev("good_freedom_talk", "{master}突然問你：「你有沒有想過，以後自由了要做什麼？」", 0.5, [
  opt("說出自己的夢想", result="{master}聽完，若有所思地點點頭。", effects=[FREE_TALK, A(3, "說出夢想")]),
  opt("小心地說沒想過", result="{master}笑了笑：「那就開始想吧。」", effects=[A(1, "謹慎")]),
  opt("直接請求解除契約", check=chk("cha", 15), success="{master}沒有拒絕：「等時候到了，我會的。」", fail="{master}嘆氣：「還不是時候。」",
      es=[FREE_TALK, A(2, "坦白")], fe=[A(-1, "操之過急")]),
], tags=["good"], affinity_min=40)

# ---- 惡人主人 ----
ev("villain_debt", "{master}要你去「處理」一個欠債不還的人。", 2, [
  opt("照辦", result="你把那人的錢逼了回來，那人的哭聲你一直忘不掉。", effects=[M(30), A(2, "辦事俐落"), C("shaken")]),
  opt("暗中放對方一馬", check=chk("cha", 14), success="你謊稱對方已經跑了，{master}罵了幾句就算了。", fail="{master}查出你在說謊。",
      es=[A(-1, "辦事不力")], fe=[HP(-3), C("punished"), A(-3, "欺騙主人")]),
  opt("拒絕", check=chk("fai", 15), success="{master}被你的堅決弄得一愣，嘖了一聲自己去了。", fail="{master}把你打得爬不起來。",
      es=[A(-2, "抗命")], fe=[HP(-5), C("punished"), A(-4, "抗命")]),
], tags=["villain"], weight=3)
ev("villain_pickpocket", "{master}指著人群裡一個衣著光鮮的人：「去把他的錢袋摸過來。」", 0.5, [
  opt("照做", check=chk("dex", 14), success="你得手了，{master}掂了掂錢袋，賞了你幾枚。", fail="你失手了，差點被人揪住，{master}只顧自己溜走。",
      es=[M(15), A(2, "得手")], fe=[HP(-2), A(-2, "笨手笨腳")]),
  opt("假裝失手", check=chk("cha", 13), success="{master}罵你沒用，倒也沒起疑。", fail="{master}看穿你是故意的。",
      es=[A(-1, "沒用")], fe=[C("punished"), A(-3, "陽奉陰違")]),
  opt("拒絕偷竊", check=chk("fai", 15), success="{master}罵罵咧咧地走開了。", fail="{master}當街給了你一巴掌。",
      es=[A(-2, "抗命")], fe=[HP(-3), A(-3, "抗命")]),
], tags=["villain"])
ev("villain_mockery", "{master}和幾個同夥喝醉了，拿你取樂。", 1, [
  opt("默默忍受", result="笑聲一直持續到深夜，你縮在角落等他們散去。", effects=[C("shaken"), HP(-2)]),
  opt("陪笑應付", check=chk("cha", 14), success="你陪著笑，把場面敷衍了過去。", fail="你笑得太僵，反而讓他們更起勁。",
      es=[A(1, "識相")], fe=[HP(-3), C("shaken")]),
  opt("反抗", check=chk("str", 16), success="你甩開了他們，{master}臉上無光，卻也沒再鬧下去。", fail="你被按在桌上，{master}笑得更大聲了。",
      es=[A(-3, "讓主人丟臉")], fe=[HP(-5), C("punished"), S(1)]),
], tags=["villain"])

# ---- 貴族、皇族 ----
ev("noble_etiquette", "{master}嫌你舉止粗魯，要你練一整個下午的禮儀。", 3, [
  opt("認真學", check=chk("cha", 12), success="你的一舉一動漸漸有了樣子，{master}滿意地點頭。", fail="你怎麼學都彆彆扭扭，{master}直搖頭。",
      es=[A(2, "學得用心"), XP(10)], fe=[A(-1, "笨拙")]),
  opt("敷衍了事", result="{master}看出你心不在焉，冷冷地說明天再練。", effects=[A(-1, "敷衍")]),
  opt("學得比主人還標準", check=chk("cha", 16), success="連{master}的客人都稱讚你，{master}臉上大有光彩。", fail="你用力過度，鬧了個笑話。",
      es=[A(3, "替主人爭光"), C("cheered")], fe=[A(-2, "出醜"), C("shaken")]),
], tags=["noble", "royal"])
ev("noble_banquet", "{master}帶你去宴會上伺候，賓客們對你品頭論足。", 4, [
  opt("安靜地伺候", result="你像影子一樣在席間穿梭，沒出一點差錯。", effects=[A(1, "穩當"), C("fed_light")]),
  opt("機靈地應對賓客", check=chk("cha", 14), success="你應對得體，有位賓客還塞了賞錢給你。", fail="你答錯了話，{master}在眾人面前很沒面子。",
      es=[A(3, "替主人爭面子"), M(20)], fe=[A(-2, "讓主人丟臉")]),
  opt("故意打翻酒杯", check=chk("dex", 13), success="看起來像是意外，宴會早早散了，你鬆了一口氣。", fail="{master}一眼就看出你是故意的。",
      es=[A(-1, "笨手笨腳")], fe=[C("punished"), A(-4, "故意出醜")]),
], tags=["noble", "royal", "bishop"])

# ---- 商人 ----
ev("merchant_ledger", "{master}丟給你一疊帳本：「天黑前對完。」", 4, [
  opt("熬夜對帳", check=chk("int", 13), success="帳目分毫不差，{master}難得誇了你一句。", fail="你算錯了幾筆，被罵得狗血淋頭。",
      es=[A(2, "仔細")], fe=[A(-2, "粗心"), C("shaken")]),
  opt("找出帳本裡的漏洞", check=chk("int", 16), success="你找出一筆被夥計吞掉的錢，{master}大喜，分了你一點。", fail="你什麼也沒找到，還耽誤了時間。",
      es=[A(4, "精明"), M(20)], fe=[A(-1, "白費工夫")]),
  opt("請主人寬限一天", check=chk("cha", 13), success="{master}勉強答應了。", fail="{master}不准。",
      es=[A(-1, "拖延")], fe=[A(-2, "偷懶"), HP(-2)]),
], tags=["merchant"], weight=3)

# ---- 神官、主教 ----
ev("priest_penance", "{master}說你心中有罪，要你跪著禱告一整晚。", 6, [
  opt("虔誠地禱告", check=chk("fai", 12), success="天亮時你心裡出奇地平靜，彷彿真的得到了寬恕。", fail="你跪得膝蓋發麻，腦子裡一片空白。",
      es=[{"type": "condition", "target": "pc", "condition": "blessed", "add": True}, A(2, "虔誠")], fe=[HP(-2)]),
  opt("假裝禱告，偷偷打盹", check=chk("dex", 14), success="你跪著睡了一覺，{master}沒有發現。", fail="{master}發現你在打盹。",
      es=[C("well_rested")], fe=[C("punished"), A(-3, "不敬")]),
  opt("質問自己犯了什麼罪", check=chk("fai", 16), success="{master}被你問住了，最後讓你起來。", fail="{master}說你的傲慢就是罪，罰得更重。",
      es=[A(1, "有骨氣")], fe=[HP(-3), C("punished"), A(-2, "傲慢")]),
], tags=["priest", "bishop"])

# ---- 旅人 ----
ev("traveler_map", "{master}攤開地圖，考你認不認得接下來的路。", 0.5, [
  opt("仔細回答", check=chk("int", 12), success="你說得頭頭是道，{master}拍拍你的頭。", fail="你把方向弄反了，{master}笑你是路痴。",
      es=[A(2, "記性好"), XP(10)], fe=[A(-1, "路痴")]),
  opt("請主人講講路上的見聞", result="{master}滔滔不絕地講到半夜，你聽得入迷。", effects=[A(2, "聽故事"), C("cheered")]),
  opt("說不知道", result="{master}嘆了口氣，自己收起了地圖。", effects=[A(-1, "不用心")]),
], tags=["traveler"])

# ---- 在主人的家裡 ----
ev("home_chores", "{master}要你把整棟房子從裡到外打掃乾淨。", 3, [
  opt("照做", result="你忙到天黑，屋子亮得能照出人影。", effects=[A(1, "勤快")]),
  opt("偷懶，只掃看得見的地方", check=chk("dex", 13), success="{master}巡了一圈，沒看出破綻。", fail="{master}在床底下摸出一把灰。",
      fe=[C("punished"), A(-2, "偷懶")], hours=1.5),
  opt("和其他僕人分工", check=chk("cha", 11), success="大家有說有笑地做完了，你和其他僕人熟了一些。", fail="其他僕人把最髒的活都推給了你。",
      es=[C("relaxed"), A(1, "能幹")], fe=[HP(-2)]),
], at_home=True, weight=3)
ev("home_guests", "{master}家裡來了客人，要你在一旁伺候茶水。", 2, [
  opt("安靜地伺候", result="你始終低著頭，客人走後{master}點了點頭。", effects=[A(1, "穩當")]),
  opt("偷聽他們談話", check=chk("dex", 14), success="你聽到一些{master}的生意與人脈，默默記在心裡。", fail="客人察覺了，{master}當場讓你退下。",
      es=[{"type": "memory", "summary": "在主人家偷聽到主人與客人的談話，知道了一些主人的生意與人脈。", "importance": 2}], fe=[A(-3, "偷聽")]),
  opt("向客人求救", check=chk("cha", 17), success="客人似乎動了惻隱之心，臨走前對{master}說了幾句好話。", fail="客人只是尷尬地笑了笑，{master}的臉色鐵青。",
      es=[A(-1, "多嘴"), FREE_TALK], fe=[HP(-4), C("punished"), S(1), A(-5, "當眾丟臉")]),
], at_home=True)
ev("home_rest_day", "{master}今天心情不錯，讓你在家好好休息一天。", 1, [
  opt("睡個好覺", result="你難得睡到自然醒。", effects=[C("well_rested"), S(-1)]),
  opt("幫主人做點事", result="{master}笑說你閒不住，心裡卻很受用。", effects=[A(2, "勤快")]),
  opt("在家裡四處看看", result="你把房子的每個角落都摸熟了。", effects=[{"type": "memory", "summary": "把主人的家裡裡外外都摸熟了。", "importance": 1}]),
], at_home=True, affinity_min=20)

def fmt_effects(v):
    if isinstance(v, dict):
        return "{ " + ", ".join(json.dumps(k, ensure_ascii=False) + ": " + fmt_effects(x) for k, x in v.items()) + " }"
    if isinstance(v, list):
        return "[" + ", ".join(fmt_effects(x) for x in v) + "]"
    return json.dumps(v, ensure_ascii=False)
out = []
for e in E:
    head = {k: v for k, v in e.items() if k != "options"}
    h = fmt_effects(head)[2:-2]
    out.append(f'      {{ {h}, "options": [')
    lines = []
    for o in e["options"]:
        # drop zero-delta affinity
        for k in ("effects", "effects_success", "fail_effects"):
            if k in o:
                o[k] = [x for x in o[k] if not (x.get("type") == "affinity" and x.get("delta") == 0)]
                if not o[k]: del o[k]
        lines.append("        " + fmt_effects(o))
    out.append(",\n".join(lines))
    out.append("      ] }")
text = ",\n".join([out[i] + "\n" + out[i+1] + "\n" + out[i+2] for i in range(0, len(out), 3)])
open(sys.argv[1], "w").write(text)
print(len(E))
