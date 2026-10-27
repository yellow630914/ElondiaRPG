"""地下城的色情事件（worldgen/design/adult-events.md 的 M1）：寫進 data/rules/travel_events.json（scope: dungeon），
另外加上機率設定（dungeon）與非戰鬥狀態（companions.json 的 conditions）。可以重跑：先拿掉 dg_ 開頭的模板再加回去。
- 都是成人向、只給女性形象與中性的主角；非自願的標「主角非自願」
- 每個事件三個回應：抵抗或脫身的檢定（成功就躲開）、另一種應付方式、屈服（一定進入親密場景）
"""
import json, re

R = ''
BODY = ['fem', 'andro']
UNW = ['adult', 'pc_unwilling']
WILL = ['adult']

PLANT = ['hell_greenhouse', 'thorn_corridor', 'verdant_hollow', 'moonshadow_roots']
CAVE = ['snake_creek', 'redemption_pit', 'echo_rift', 'giants_spine', 'bloodrock_cave', 'tidefall_cave', 'skull_isle', 'echo_canyon']
UNDEAD = ['whisper_crypt', 'mist_abbey', 'bloodrock_cave', 'quicksand_temple']


def cond(c):
    return {"type": "condition", "target": "pc", "condition": c, "add": True}


def money(n):
    return {"type": "money", "amount": n}


def xp(n):
    return {"type": "xp", "amount": n}


def hp(r):
    return {"type": "hp", "target": "pc", "ratio": r}


def parasite(pid):
    """屈服的選項帶來寄生物（第二批，parasites.json）：已經有同一種時不會再寄生"""
    return {"type": "parasite", "parasite": pid, "op": "add"}


def out(text, *effects, flags=None):
    o = {"text": text}
    if effects: o["effects"] = list(effects)
    if flags: o["set_flags"] = flags
    return o


def opt(label, success, fail=None, check=None, scene=None):
    o = {"label": label}
    if check: o["check"] = {"attr": check[0], "dc": check[1]}
    o["success"] = success
    if fail: o["fail"] = fail
    if scene: o["adult_scene"] = scene
    return o


def ev(i, title, triggers, text, scene, options, tags=UNW, layers=None, dungeons=None, regions=None):
    t = {"id": f"dg_{i}", "scope": "dungeon", "tier": "normal", "kind": "choice", "triggers": triggers}
    if layers: t["layers"] = layers
    if dungeons: t["dungeons"] = dungeons
    if regions: t["regions"] = regions
    t.update({"tags": tags, "pc_body": BODY, "title": title, "text": text, "scene": scene, "options": options})
    return t


E = [
    # ---------------- 陷阱 ----------------
    ev('sense_cut', '感覺遮斷的魔法陣', ['trap'],
       '腳下的魔法陣亮了起來，腰以下的感覺突然「搬了家」——你還站在原地，卻清清楚楚地感覺到下半身被卡在某個看不見的牆洞裡，而牆的另一邊，有什麼東西正湊了上來。',
       '主角的下半身被魔法陣「傳送」到別處的牆洞裡，上半身還站在原地；看不見的對象在牆的另一邊一次又一次地玩弄、使用那一半，主角只能感覺，什麼都看不到，也逃不掉。',
       [opt('用意志斷開連結', out('你咬著牙念出驅散的禱詞，感覺一口氣回到了身上，腿一軟跪在地上。'),
            out('斷不開。你只能扶著牆站在原地，一邊喘一邊感覺著那個看不見的地方被一次又一次地填滿，直到魔法陣的光慢慢熄滅。', cond('afterglow'), cond('sensitive')), ('fai', 14), 'fail'),
        opt('找出法陣的節點破壞它', out('你在法陣的邊緣找到一個刻歪的符文，一刀劃斷。感覺回來的那一刻，你差點叫出聲。'),
            out('你找錯了節點。法陣不但沒停，那一邊的「對方」好像還被你的動靜激怒了，動作變得更粗暴。', cond('afterglow'), cond('sensitive')), ('int', 15), 'fail'),
        opt('咬牙忍到法陣失效', out('你扶著牆，任由遠處的「那一半」被擺布。大約半個小時後，法陣的光才熄滅，你的膝蓋一直在發抖。', cond('afterglow')), scene='always')],
       layers=[2, 3, 4]),
    ev('bind_ring', '拘束的鐵環', ['trap'],
       '牆裡彈出四個鐵環，喀嚓一聲扣住了你的手腕和腳踝，把你大字形地固定在牆上。走廊的另一頭，傳來了小東西啪嗒啪嗒的腳步聲。',
       '主角被鐵環固定在牆上動彈不得，路過的哥布林們發現了這份「禮物」，圍上來把主角的衣服扯開，輪流玩弄。',
       [opt('硬扯開鐵環', out('你使盡全力一扯，生鏽的鐵環應聲斷開，你在牠們跑到之前退回了隊伍裡。'),
            out('鐵環紋風不動。哥布林們先是愣住，然後怪笑著圍了上來。等隊友趕到時，你的衣服已經被扯得不成樣子，身上全是牠們的手印。', cond('disheveled'), cond('drained')), ('str', 14), 'fail'),
        opt('撬開鎖扣', out('你的手指勾到了鎖扣的機關，輕輕一撥，鐵環全部鬆開了。'),
            out('你的手指在鎖扣上滑了一下——來不及了。牠們已經爬上了你的身體。', cond('disheveled'), cond('drained')), ('dex', 15), 'fail'),
        opt('大聲叫隊友', out('隊友聽到聲音衝了過來，把哥布林趕跑、把你從牆上放下來——只是在那之前，牠們的手已經伸進了你的衣服裡。', cond('disheveled')))],
       layers=[1, 2, 3, 4]),
    ev('pink_mist', '粉紅色的霧', ['trap'],
       '腳下的石板一沉，牆縫裡噴出一大團粉紅色的霧，甜得發膩的味道一下子灌進了鼻子裡。身體從裡面開始發燙。',
       '主角吸進了催情的霧氣，身體燙得受不了，只能躲到角落裡，忍不住自己動手撫慰起來，一次又一次。',
       [opt('屏住呼吸衝出去', out('你憋著氣一口氣衝出了霧，等到了乾淨的空氣才敢喘氣。只有臉還有一點紅。'),
            out('你吸了一大口。霧散的時候，你已經靠在牆上，腿軟得站不起來。', cond('aroused')), ('str', 13), 'fail'),
        opt('用沾濕的布摀住口鼻', out('你摀住口鼻退了出去，霧只沾到了一點。'),
            out('布沒摀緊。甜膩的霧還是鑽了進來，身體裡像有火在燒。', cond('aroused')), ('int', 12), 'fail'),
        opt('吸都吸了，先解決再說', out('你躲到角落，背對著隊友，手伸進了衣服裡。過了很久，身體裡的火才終於退下去。', cond('afterglow')), scene='always')]),
    ev('slime_drop', '天花板上的溶衣史萊姆', ['trap'],
       '頭頂啪的一聲，一大團冰涼的史萊姆掉了下來，把你從頭到腳裹住。衣服在它身體裡滋滋地冒泡、一點一點地溶掉，它順著溶開的地方鑽了進去。',
       '溶衣史萊姆裹住主角，溶掉衣物之後鑽進衣服裡面，冰涼滑膩的身體在主角身上到處流動、擠壓、往裡面鑽。',
       [opt('趁它還沒裹緊甩掉它', out('你在它裹緊之前猛地一甩，史萊姆啪地摔在牆上，只溶掉了你一截袖子。'),
            out('甩不掉。它緊緊地裹住你，冰涼的身體從衣服的破洞鑽了進去，貼著皮膚到處流。', cond('disheveled'), cond('sensitive')), ('dex', 13), 'fail'),
        opt('用火把逼它出來', out('你把火把湊近，史萊姆尖叫似地縮成一團逃走了。衣服燒焦了一點，但還能穿。'),
            out('你的手在發抖，火把湊得太近，燙到了自己。史萊姆趁機鑽得更深了。', cond('disheveled'), cond('sensitive'), hp(-0.05)), ('int', 12), 'fail'),
        opt('等它玩膩了自己離開', out('它把你從裡到外「洗」了一遍，才心滿意足地滑走了，留下你一身黏液和溶得破破爛爛的衣服。', cond('disheveled'), cond('afterglow')), scene='always')],
       layers=[1, 2, 3], dungeons=CAVE),
    ev('grate_tentacles', '地板下的觸手', ['trap'],
       '腳下的鐵柵欄被頂開了，一束滑溜溜的觸手從下面竄上來，纏住了你的腳踝，一路往上爬。',
       '觸手纏住主角的四肢，把主角吊在半空中，一根一根地探進衣服裡，纏住胸口、鑽進雙腿之間，一邊蠕動一邊往深處擠。',
       [opt('砍斷觸手', out('你一劍砍斷了最粗的那一根，其他的觸手吃痛地縮回了柵欄底下。'),
            out('觸手太多了，砍斷一根又纏上來兩根。你被吊了起來，衣服下面全是滑溜溜的東西在動。', cond('drained'), cond('sensitive')), ('str', 15), 'fail'),
        opt('趁它纏緊之前跳開', out('你在觸手纏緊之前一個翻身跳開，柵欄下傳來不甘心的蠕動聲。'),
            out('你跳得不夠快。觸手捲住你的腰，把你拖到了柵欄邊。', cond('drained'), cond('sensitive')), ('dex', 15), 'fail'),
        opt('放棄掙扎', out('你一放鬆，觸手就得寸進尺。等它們終於滿足地縮回去時，你癱在地上，連手指都動不了。', cond('drained'), cond('afterglow')), scene='always')],
       layers=[2, 3, 4]),
    ev('lust_mirror', '魅惑之鏡', ['trap'],
       '走廊盡頭的鏡子裡，你的倒影在對你笑——一絲不掛，用你從來沒有做過的姿勢。它伸出了手，指尖穿過了鏡面。',
       '鏡中的倒影走了出來，是一個和主角一模一樣、卻淫蕩得多的自己；它把主角壓在鏡子上，用主角最清楚的方式玩弄主角。',
       [opt('移開視線，默念禱詞', out('你逼自己轉過頭。鏡子裡傳來一聲很輕的嘆氣，倒影回到了原本的樣子。'),
            out('你的眼睛移不開。倒影把你拉了過去。', cond('dazed'), cond('afterglow')), ('fai', 14), 'fail'),
        opt('打碎鏡子', out('你一拳打碎了鏡子，倒影尖叫著碎成了一地的光。'),
            out('你的拳頭停在鏡面前一寸——倒影握住了你的手腕，輕輕一拉。', cond('dazed'), cond('afterglow')), ('str', 12), 'fail'),
        opt('看下去', out('你沒有逃。另一個自己知道你的每一個弱點，一個一個地試給你看。鏡子終於安靜下來時，你在鏡子前坐了很久。', cond('dazed')), scene='always')],
       layers=[2, 3, 4], dungeons=UNDEAD + PLANT),
    ev('lust_needle', '塗了媚藥的毒針', ['trap'],
       '牆上射出一根細針扎進了你的脖子。不痛，只是一股熱流從傷口擴散開來，皮膚變得連衣服摩擦都受不了。',
       '媚藥讓主角的身體敏感到極點，衣服的每一次摩擦都讓主角發抖，最後忍不住在角落裡解決了自己。',
       [opt('把毒擠出來', out('你立刻拔針，用力擠出傷口裡的藥液。熱流只擴散了一點點就停了。'),
            out('你擠得太慢了。熱流已經擴散到了全身。', cond('sensitive'), cond('aroused')), ('dex', 12), 'fail'),
        opt('靜下心等藥效過去', out('你閉上眼睛調整呼吸，熱流慢慢地退了下去。'),
            out('越想靜下來，身體就越燙。', cond('sensitive'), cond('aroused')), ('fai', 13), 'fail'),
        opt('躲到角落裡解決', out('你躲進角落，咬著袖子不讓自己出聲。藥效很強，解決了好幾次才退。', cond('afterglow')), scene='always')],
       layers=[1, 2, 3]),
    ev('wall_stuck', '牆上的洞', ['trap'],
       '牆上的機關一轉，把你的上半身吸進了一個剛好卡住腰的洞裡。你的頭和手在牆的另一邊，屁股和腿還在走廊上——然後，你聽見了身後的腳步聲。',
       '主角被卡在牆洞裡，上半身在牆的一邊、下半身在另一邊；看不見的路人（或魔物）從身後掀開了主角的衣服，一個接一個。',
       [opt('硬把自己拔出來', out('你雙手撐著牆用力一推，整個人從洞裡摔了出來，滾在地上大口喘氣。'),
            out('卡得太緊了。身後的手已經放在了你的腰上。', cond('drained'), cond('afterglow')), ('str', 16), 'fail'),
        opt('縮起身子鑽回去', out('你吐氣、縮腰，像貓一樣扭了出來。'),
            out('你扭了半天，反而卡得更緊了。', cond('drained'), cond('afterglow')), ('dex', 15), 'fail'),
        opt('等隊友來救', out('隊友過了很久才找到你——在那之前，你身後已經換了好幾個「客人」。他們把你拉出來時，誰都沒有說話。', cond('drained'), cond('afterglow')), scene='always')],
       layers=[3, 4]),
    ev('rune_room', '詛咒房間的規則', ['trap'],
       '你一踏進房間，門就在身後轟然關上。門上浮出一行發光的字：「在你達到極樂之前，這扇門不會打開。」房間中央，一張石台正在等著你。',
       '詛咒房間的規則要主角達到高潮才會開門；石台上伸出了皮帶與魔法的手，把主角固定住，一次又一次地把主角推上頂點。',
       [opt('解讀符文找漏洞', out('你仔細讀了符文——「極樂」不一定是那個意思。你對著門大笑了一場（真心覺得好笑的那種），門居然開了。'),
            out('符文沒有漏洞。石台上的手伸了過來。', cond('afterglow'), cond('drained')), ('int', 16), 'fail'),
        opt('硬把門撞開', out('你連撞了三次，門上的符文終於裂開，門開了一條縫。'),
            out('門紋風不動，你撞得肩膀發麻。最後，你還是只能走向石台。', cond('afterglow'), cond('drained'), hp(-0.05)), ('str', 17), 'fail'),
        opt('照著規則來', out('你躺上石台。魔法的手很有耐心，第三次的時候，門才終於打開——你差點不想走。', cond('afterglow')), scene='always')],
       layers=[3, 4]),
    ev('sense_link', '共感的符文', ['trap'],
       '牆上的符文閃了一下，你的身體突然多了一種「不是你的」感覺——附近有某個東西正在被撫摸、被舔、被進入，而你感覺得到每一下。',
       '共感的符文把主角和附近正在交配的魔物連在一起，主角感覺著對方的每一下，卻什麼都看不見、什麼都碰不到，只能一個人顫抖。',
       [opt('用意志斬斷共感', out('你在心裡用力一斬，那股感覺像斷掉的線一樣縮了回去。'),
            out('斬不斷。那一邊越來越激烈，你跪了下來。', cond('afterglow'), cond('sensitive')), ('fai', 15), 'fail'),
        opt('循著感覺找到源頭', out('你跟著那股感覺找到了一窩魔物，在牠們反應過來之前收拾了牠們。共感也斷了。', xp(30)),
            out('你找到了源頭，可是那股感覺讓你連武器都握不穩。你們狼狽地退了回來。', cond('afterglow'), cond('sensitive')), ('str', 14), 'fail'),
        opt('閉上眼睛撐過去', out('你靠著牆，閉上眼睛，感覺著遠處的一切，直到那一邊結束。你的腿還在發軟。', cond('afterglow')), scene='always')],
       layers=[2, 3, 4]),
    ev('hypno_eye', '催眠之眼', ['trap'],
       '牆上鑲著一顆巨大的寶石眼睛，你一看見它，它就轉過來看著你。腦袋裡響起一個很溫柔的聲音：「把衣服脫掉。很熱，對吧？」',
       '主角被催眠之眼控制，照著腦中的聲音一件一件脫掉衣服、擺出羞恥的姿勢、撫摸自己，直到聲音滿意為止。',
       [opt('閉上眼睛，抵抗那個聲音', out('你用力閉上眼睛，咬破了嘴唇。痛讓你清醒過來，聲音消失了。'),
            out('你的手已經在解衣服的扣子了。', cond('dazed'), cond('disheveled')), ('fai', 14), 'fail'),
        opt('反過來瞪回去', out('你瞪著那顆眼睛，在心裡大吼「你才把衣服脫掉」。寶石啪地裂了。'),
            out('你瞪回去的那一刻，就輸了。', cond('dazed'), cond('disheveled')), ('cha', 15), 'fail'),
        opt('照著聲音做', out('你照著那個聲音做了每一件事。醒過來時，你一絲不掛地跪在寶石前，完全不記得自己做了多久。', cond('dazed'), cond('disheveled')), scene='always')],
       layers=[2, 3, 4]),
    # ---------------- 寶箱 ----------------
    ev('mimic_tongue', '擬態寶箱', ['chest'],
       '寶箱的蓋子一打開，裡面不是金幣，是一條粉紅色的長舌頭和一圈濕漉漉的牙。它捲住了你的腰，把你往箱子裡拖。',
       '擬態寶箱把主角拖進箱子裡，長舌頭從腳尖一路舔上來，鑽進衣服、捲住胸口、在雙腿之間來回舔弄，像在品嚐一道菜。',
       [opt('趁它還沒咬緊抽身', out('你在它咬緊之前抽身，順手從它嘴裡撈出了一把金幣。', money(80)),
            out('抽不出來。你被拖進了箱子裡，蓋子在頭頂上闔上。', cond('sensitive'), cond('disheveled')), ('dex', 14), 'fail'),
        opt('一劍劈開它', out('你一劍劈在它的蓋子上，擬態寶箱哀嚎著吐出了肚子裡的東西。', money(120), xp(20)),
            out('劍卡在它的牙縫裡，它的舌頭趁機纏了上來。', cond('sensitive'), cond('disheveled')), ('str', 14), 'fail'),
        opt('讓它品嚐個夠', out('它把你從頭到腳舔了一遍，滿足地打了個嗝，把你和一堆金幣一起吐了出來。', money(150), cond('afterglow')), scene='always')],
       layers=[1, 2, 3, 4]),
    ev('mimic_tentacle', '觸手寶箱', ['chest'],
       '寶箱裡伸出了十幾條觸手，一下子就把你整個人拖了進去。箱子裡又暗又熱，四面八方都是蠕動的東西。',
       '主角被拖進觸手寶箱裡，在黑暗中被十幾條觸手同時纏住、撫摸、填滿，箱子外面的隊友只聽得見悶悶的聲音。',
       [opt('從裡面撐開蓋子', out('你用背頂開了蓋子，整個人從觸手堆裡翻了出來，手裡還抓著箱底的寶物。', money(100)),
            out('蓋子太重了。黑暗裡，觸手一條一條地纏了上來。', cond('drained'), cond('sensitive')), ('str', 15), 'fail'),
        opt('找到它的核心刺下去', out('你在黑暗中摸到一個跳動的東西，一刀刺下去，觸手全部軟了。', money(150), xp(30)),
            out('你找錯了地方，觸手被激怒了，纏得更緊。', cond('drained'), cond('sensitive')), ('int', 15), 'fail'),
        opt('放棄抵抗', out('隊友把箱子撬開時，你已經被觸手玩弄得神智不清。它們吐出你的時候，也吐出了一袋寶石。', money(200), cond('drained'), cond('afterglow')), scene='always')],
       layers=[2, 3, 4]),
    ev('cursed_lingerie', '寶箱裡的黑色內衣', ['chest'],
       '寶箱裡只有一套漂亮得過分的黑色蕾絲內衣。你剛把它拿起來，它就自己動了——像蛇一樣纏上你的手臂，往你的衣服裡鑽。',
       '受詛咒的內衣自己穿到了主角身上，蕾絲勒緊、摩擦，在最敏感的地方一下一下地動，像有一雙看不見的手。',
       [opt('把它甩開', out('你在它鑽進衣服之前把它甩了出去。它在地上扭了幾下，不動了。你把它收進了袋子裡——拿去賣應該值不少錢。', money(90)),
            out('它已經鑽進去了，貼著你的皮膚越勒越緊。', cond('sensitive'), cond('aroused')), ('dex', 13), 'fail'),
        opt('研究上面的詛咒', out('你認出了詛咒的紋路，用一句反咒讓它安靜下來。這種東西，魔法物品店會收。', money(130)),
            out('你研究得太入迷，沒注意到它已經爬上了你的肩膀。', cond('sensitive'), cond('aroused')), ('int', 14), 'fail'),
        opt('穿上試試看', out('你讓它穿上了身。它勒得剛剛好，動得也剛剛好——你在寶箱邊坐了很久，想把它脫下來的時候，才發現它已經脫不下來了。', cond('afterglow'), parasite('hungry_lingerie')), scene='always')],
       layers=[1, 2, 3, 4]),
    ev('succubus_box', '魅魔之箱', ['chest'],
       '寶箱裡飄出一陣粉紫色的煙，煙裡坐著一個只穿著薄紗的魅魔。她伸了個懶腰，對你眨眨眼：「被關了三百年，第一個打開箱子的人……要不要做個交易？一個吻，換箱子裡的東西。」',
       '主角接受了魅魔的交易；那個「吻」從嘴唇開始，然後是脖子、胸口、一路往下，魅魔用三百年的飢渴品嚐主角。',
       [opt('拒絕她', out('你搖頭。魅魔嘟著嘴化成了煙，箱底留下了幾枚古錢——她說是見面禮。', money(40)),
            out('你想拒絕，可是她的眼睛讓你說不出口。', cond('dazed')), ('fai', 15), 'fail'),
        opt('答應交易', out('那個吻很長很長，長到你忘了自己在哪裡。她心滿意足地離開時，箱子裡的寶石全都留給了你——還有你小腹上一個桃紅色的、發燙的紋樣。「這是契約喔，」她的聲音從很遠的地方傳來，「別弄丟了。」', money(220), cond('afterglow'), parasite('succubus_mark')), scene='always'),
        opt('一劍斬了她', out('魅魔尖叫著化成了煙，箱底的寶物歸你了。', money(150), xp(30)),
            out('劍穿過了煙。她笑著從背後抱住你：「真粗魯。那就換我來決定交易的內容囉。」', cond('drained'), cond('afterglow')), ('str', 15), 'fail')],
       tags=WILL, layers=[3, 4]),
    # ---------------- 採集 ----------------
    ev('lust_pollen', '催情的花粉', ['gather'],
       '你剛把藥草拔起來，旁邊一朵碗大的花就「噗」地噴了你一臉金色的花粉。鼻子很香，身體很熱。',
       '催情花粉讓主角渾身發燙，在花叢裡忍不住撫摸自己，花的藤蔓也湊上來幫忙。',
       [opt('屏住呼吸退開', out('你憋著氣退了出去，拍掉臉上的花粉，只打了幾個噴嚏。'),
            out('你吸了一大口。腿一軟，你跪在了花叢裡。', cond('aroused')), ('str', 12), 'fail'),
        opt('用水沖掉花粉', out('你用水袋把臉沖乾淨，花粉沒來得及作怪。'),
            out('水沖不掉，反而把花粉沖進了領口裡。', cond('aroused'), cond('sensitive')), ('int', 12), 'fail'),
        opt('躺在花叢裡等藥效過去', out('你躺在花叢裡，任由身體發燙，任由花的藤蔓在你身上爬。花粉的效果過去時，太陽已經換了位置。', cond('afterglow')), scene='always')],
       dungeons=PLANT + ['mosswhisper', 'silvermoon', 'windspeak', 'stilltide_oasis']),
    ev('vine_bind', '纏人的藤蔓', ['gather'],
       '你伸手去摘果子的時候，四周的藤蔓突然活了過來，纏住你的手腕、腳踝，把你吊了起來。細細的藤鬚鑽進了衣服裡。',
       '活藤蔓把主角吊在半空，藤鬚鑽進衣服裡纏住胸口、在雙腿之間摩擦、慢慢地往裡面探，越掙扎纏得越緊。',
       [opt('割斷藤蔓', out('你一刀割斷手腕上的藤蔓，再割斷腳上的，摔在地上滾了出去。'),
            out('刀被藤蔓捲走了。越掙扎，纏得越緊。', cond('drained'), cond('sensitive')), ('str', 14), 'fail'),
        opt('放鬆身體讓它鬆開', out('你放鬆下來，藤蔓以為你不動了，慢慢地鬆開了。你趁機溜了出去。'),
            out('你一放鬆，藤蔓就以為你同意了。', cond('drained'), cond('sensitive')), ('fai', 13), 'fail'),
        opt('不掙扎了', out('藤蔓玩了你很久，最後把你輕輕地放回地上，還在你手邊放了一顆熟透的果子。', cond('afterglow'), {"type": "item", "name": "野莓", "qty": 2}), scene='always')],
       dungeons=PLANT + ['mosswhisper', 'silvermoon', 'windspeak']),
    ev('seed_plant', '寄生植物的種子', ['gather'],
       '你蹲下來採藥時，一株長得像百合的植物彎下了花莖，花心對準了你，把一顆溫熱的種子推進了你的身體裡。',
       '寄生植物把種子推進主角的身體深處，花莖在主角體內攪動、確認種子著床，主角在花叢裡顫抖著承受。',
       [opt('立刻把它挖出來', out('你咬著牙，在種子紮根之前把它弄了出來。它在你手心裡扭了一下，就不動了。'),
            out('種子滑得太深了。你感覺得到它在裡面，溫溫的，偶爾還會動一下。', cond('sensitive'), flags=['adult_seed_planted']), ('dex', 15), 'fail'),
        opt('用藥草逼它出來', out('你嚼碎一把苦草吞下去，種子受不了，自己滑了出來。'),
            out('苦草沒有用。種子好像還很喜歡。', cond('sensitive'), flags=['adult_seed_planted']), ('int', 14), 'fail'),
        opt('任它種下', out('花莖在你身體裡慢慢地攪動，直到確認種子安穩地著床才退出去。你躺在花叢裡喘了很久，肚子裡暖暖的——它會在你身體裡長大。', cond('afterglow'), parasite('parasite_seed'), flags=['adult_seed_planted']), scene='always')],
       layers=[2, 3, 4], dungeons=PLANT),
    ev('glow_spores', '發光蘑菇的孢子', ['gather'],
       '你採下一朵發光的蘑菇，蘑菇噴出一圈藍色的孢子。眼前的一切開始扭曲——洞窟的牆變成了柔軟的肉壁，四面八方都是伸向你的手。',
       '主角在孢子的幻覺裡被無數雙手撫摸、被看不見的人擁抱與佔有；幻覺裡的一切感覺都是真的。',
       [opt('靠意志看穿幻覺', out('你用力眨眼，牆又變回了石頭。那些手只是垂下來的苔蘚。'),
            out('你分不清哪些是真的。那些手很溫柔，很多。', cond('dazed'), cond('afterglow')), ('fai', 13), 'fail'),
        opt('辨認孢子，找出解藥', out('你認出了這種蘑菇，嚼了一片它旁邊長的苔，幻覺退了。'),
            out('你認錯了。嚼下去的苔讓幻覺變得更真了。', cond('dazed'), cond('afterglow')), ('int', 14), 'fail'),
        opt('沉進幻覺裡', out('你讓自己沉了下去。等幻覺散掉，你一個人躺在蘑菇叢裡，衣服是自己解開的。', cond('dazed')), scene='always')],
       dungeons=CAVE + PLANT),
    # ---------------- 長休 ----------------
    ev('incubus_visit', '夢魔的夜訪', ['rest'],
       '你在安全房裡睡著了，又好像沒有。有人坐在你的床邊，冰涼的手指撫過你的臉頰，慢慢往下。「別出聲，」一個很好聽的聲音說，「這只是一個夢。」',
       '夢魔在主角半夢半醒時潛入，在主角身上一點一點地脫去衣物、親吻、愛撫，最後佔有主角；主角分不清是夢還是現實。',
       [opt('強迫自己醒過來', out('你用盡全力睜開眼睛。床邊什麼都沒有，只有被子被掀開了一角。'),
            out('醒不過來。那雙手繼續往下。', cond('afterglow'), cond('dazed')), ('fai', 14), 'fail'),
        opt('在夢裡反過來質問它', out('你在夢裡抓住它的手腕：「你是誰？」它愣了一下，笑著消失了，枕邊留下了一枚古錢。', money(30)),
            out('你抓住了它的手腕——然後被它順勢壓在了床上。', cond('afterglow'), cond('dazed')), ('cha', 14), 'fail'),
        opt('讓它留下來', out('你沒有拒絕。那是你這輩子最真實的一個夢。早上醒來時，你身上還留著它的味道，小腹上還多了一個桃紅色的紋樣——夢裡的聲音說，那是「她」的契約。', cond('afterglow'), parasite('succubus_mark')), scene='always')],
       layers=[1, 2, 3, 4]),
    ev('lewd_dream', '太真實的夢', ['rest'],
       '你夢見自己被很多人圍著、碰著、需要著。醒來的時候，你發現身上的衣服是亂的，而夢裡的感覺還沒有退。',
       '主角在淫夢中被許多看不見臉的人同時愛撫與佔有，醒來後身體還記得每一下。',
       [opt('掙脫夢境', out('你在夢最深的地方驚醒，冷汗濕透了衣服。夢的內容很快就忘了。'),
            out('你掙不開。夢一直做到了天亮。', cond('afterglow')), ('fai', 12), 'fail'),
        opt('沉浸在夢裡', out('你沒有掙扎。夢裡的人很溫柔，你醒來時意外地神清氣爽。', cond('relaxed')), scene='always'),
        opt('醒來後把夢記下來', out('你把夢記在筆記裡。仔細想想，夢裡的地方好像是這座地下城更深的某處。', xp(20)),
            out('你寫到一半就臉紅得寫不下去了。', cond('afterglow')), ('int', 13), 'fail')],
       tags=WILL),
    ev('slime_bedroll', '鑽進睡袋的史萊姆', ['rest'],
       '半夜，你被一股冰涼的感覺弄醒——有什麼滑溜溜的東西鑽進了你的睡袋，正貼著你的大腿往上爬。',
       '小史萊姆鑽進主角的睡袋，貼著主角的身體到處流動、吸附、鑽進最溫暖的地方，在黑暗裡一點一點地玩弄主角。',
       [opt('一把抓住它丟出去', out('你一把抓住它，丟到了牆角。它委屈地抖了抖，溜走了。'),
            out('它太滑了，從指縫溜走，鑽得更深了。', cond('sensitive'), cond('afterglow')), ('dex', 13), 'fail'),
        opt('叫醒守夜的隊友', out('守夜的隊友用火把把它趕走了，只是看你的眼神有點怪。'),
            out('你想叫人，卻在開口的那一刻叫成了另一種聲音。', cond('sensitive'), cond('afterglow')), ('cha', 12), 'fail'),
        opt('讓它待著', out('它在睡袋裡陪了你一整夜，天亮時才溜走。你從來沒有睡得這麼濕過。', cond('afterglow')), scene='always')],
       dungeons=CAVE),
    ev('vine_night', '夜裡爬進來的藤', ['rest'],
       '安全房的牆縫裡，有藤蔓趁著夜色爬了進來。你醒來時，手腕已經被輕輕地綁在了頭頂上，細細的藤鬚正在解你的衣扣。',
       '夜裡爬進安全房的藤蔓綁住主角的手，藤鬚解開衣服、纏住身體、探進雙腿之間，在黑暗中緩慢而執拗地玩弄主角。',
       [opt('扯斷藤蔓', out('你一扯就扯斷了，藤蔓縮回了牆縫裡。'),
            out('藤蔓比看起來結實得多。', cond('drained'), cond('sensitive')), ('str', 13), 'fail'),
        opt('點火逼退它', out('你摸到火石點了一下，藤蔓一碰到火光就縮了回去。'),
            out('火石在你被綁住的手裡掉了下去。', cond('drained'), cond('sensitive')), ('dex', 14), 'fail'),
        opt('不出聲', out('你怕吵醒隊友，咬著唇不出聲。藤蔓一直玩到天快亮才縮回去，你一夜沒睡。', cond('drained'), cond('afterglow')), scene='always')],
       layers=[2, 3, 4], dungeons=PLANT),
    ev('ghost_touch', '冰冷的手', ['rest'],
       '半夜，一雙冰冷的手從背後抱住了你。耳邊有一個很輕的聲音在哭：「好冷……讓我暖一暖，一下就好。」',
       '寂寞的亡魂從背後抱住主角，冰冷的手探進衣服裡、貼著皮膚汲取溫度，最後和主角交纏在一起，直到它暖起來為止。',
       [opt('念出驅散的禱詞', out('禱詞念完，那雙手鬆開了。哭聲漸漸遠去。'),
            out('禱詞念到一半，那雙手已經伸進了衣服裡。', cond('afterglow'), cond('drained')), ('fai', 14), 'fail'),
        opt('問它是誰', out('它說了一個名字，說它死在這裡一百年了。天亮前它消失了，牆角留下了一個它生前的錢袋。', money(60)),
            out('它沒有回答，只是抱得更緊了。', cond('afterglow'), cond('drained')), ('cha', 13), 'fail'),
        opt('讓它暖一暖', out('你讓它抱著你。它一點一點地暖了起來，也一點一點地要了你。天亮時它不見了，只留下你身上淡淡的涼意。', cond('afterglow')), scene='always')],
       dungeons=UNDEAD),
    ev('monster_girl', '魔物娘的邀請', ['rest'],
       '安全房的門口，站著一個下半身是蛇尾的女人。她沒有要攻擊的意思，只是吐著信子，用很好聽的聲音問：「旅人，這裡很冷。可以讓我進去一起睡嗎？我什麼都會做。」',
       '蛇女鑽進主角的被窩，長長的蛇尾一圈一圈地纏住主角，冰涼的鱗片滑過全身，用蛇的方式和主角交纏了一整夜。',
       [opt('客氣地拒絕', out('她有點失望，但還是點點頭離開了，臨走前告訴你下一層的陷阱在哪裡。', xp(20))),
        opt('讓她進來', out('她纏著你過了一夜，鱗片涼涼的，動作卻很熱。天亮前她吻了你一下，留下一片會發光的鱗片。', cond('relaxed'), money(50)), scene='always'),
        opt('套她的話', out('你們聊了很久，她說了很多這座地下城的秘密。', xp(30)),
            out('聊著聊著，她已經在你的被窩裡了。', cond('afterglow')), ('cha', 14), 'fail')],
       tags=WILL, layers=[2, 3, 4]),
]

# 非戰鬥狀態（companions.json 的 conditions）
CONDS = {
    "aroused": {"name": "發情", "desc": "身體還在發燙，腦袋裡只想著那件事。下次長休前所有檢定 -1。", "check_penalty": 1, "clears": "long_rest"},
    "sensitive": {"name": "敏感", "desc": "被碰過的地方還在發麻，連衣服的摩擦都受不了。下次長休前靈巧檢定 -2。", "check_penalty": 2, "check_attrs": ["dex"], "clears": "long_rest"},
    "afterglow": {"name": "餘韻", "desc": "剛剛的感覺還沒有退，很難專心。下次長休前智力檢定 -2。", "check_penalty": 2, "check_attrs": ["int"], "clears": "long_rest"},
    "dazed": {"name": "恍惚", "desc": "腦袋昏昏沉沉的，分不清剛剛是不是真的。下次長休前信仰檢定 -2。", "check_penalty": 2, "check_attrs": ["fai"], "clears": "long_rest"},
    "drained": {"name": "虛脫", "desc": "全身的力氣都被抽乾了。下次長休前力量檢定 -2，戰鬥傷害 -1。", "check_penalty": 2, "check_attrs": ["str"], "combat_mods": {"damage": -1}, "clears": "long_rest"},
    "disheveled": {"name": "衣衫不整", "desc": "衣服被扯壞、溶掉了一部分，整個人狼狽不堪。下次長休前魅力檢定 -1。", "check_penalty": 1, "check_attrs": ["cha"], "clears": "long_rest"},
}
RULES = {"$comment": "地下城與近郊的事件（scope: dungeon，見 docs/ADULT_EVENTS.md）：觸發陷阱（沒察覺時）、打開寶箱、採集、在安全房長休之後，冷卻過了就依各觸發點的 chance 遇到一件事；同一事件 repeat_days 天內不重複。",
         "chance": {"trap": 0.5, "chest": 0.08, "gather": 0.15, "rest": 0.15}, "cooldown_hours": 6, "repeat_days": 3}

if __name__ == '__main__':
    assert len({e['id'] for e in E}) == len(E)
    P = R + 'data/rules/travel_events.json'
    s = open(P).read()
    lines = [l for l in s.split('\n') if not l.startswith('    {"id": "dg_')]
    s = '\n'.join(lines)
    # 模板陣列的結尾：最後一個模板後面接上地下城事件
    end = s.index('\n  ],\n  "town": {')
    head = s[:end].rstrip().rstrip(',')
    new = ',\n'.join('    ' + json.dumps(e, ensure_ascii=False) for e in E)
    s = head + ',\n' + new + s[end:]
    rules = '  "dungeon": ' + json.dumps(RULES, ensure_ascii=False) + ',\n'
    s = re.sub(r'  "dungeon": \{.*\},\n', '', s)
    s = s.replace('  "side_maps": {', rules + '  "side_maps": {', 1)
    data = json.loads(s)
    assert sum(1 for t in data['templates'] if t.get('scope') == 'dungeon') == len(E)
    open(P, 'w').write(s)
    C = R + 'data/rules/companions.json'
    c = open(C).read()
    for k in CONDS:
        c = re.sub(r',\n  "%s": \{.*\}' % k, '', c)
    anchor = '\n  "relaxed": '
    a = c.index(anchor)
    line_end = c.index('\n', a + 1)
    rel = c[a:line_end]
    comma = rel.endswith(',')
    add = ''.join(',\n  "%s": %s' % (k, json.dumps(v, ensure_ascii=False)) for k, v in CONDS.items())
    c = c[:a] + rel.rstrip(',') + add + (',' if comma else '') + c[line_end:]
    cd = json.loads(c)
    assert all(k in cd['conditions'] for k in CONDS)
    open(C, 'w').write(c)
    print('dungeon events', len(E))
