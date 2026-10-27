"""第十三批特殊任務（6 條地下城線）：北境的深贖之穴、回聲裂谷、巨人之嵴；南境的餘燼裂隙、血岩深穴、地獄溫室。戰鬥都用地下城各層原本的怪物，最後一戰是深淵層的層主（無法溝通；歷史之龍阿契隆讓這些地方反覆重演最深刻的過去，所以層主打倒之後會重新出現）。由 story_batch1.py 匯入後一起寫出。"""
from story_batch2 import aff, mem, money, xp, rep, hp, at_cell, at_npc, at_dun, outskirts, need
from story_batch7 import done, step

MAGDA, BALIN, DURAK, SER = 'npc_magda_ironforge', 'npc_balin_greyrock', 'npc_durak_greyrock', 'npc_ser_mistone'
AETH, LILA, VER, MORG = 'npc_aetherion', 'npc_lila_listener', 'npc_veronica', 'npc_morg_herbwife'
DWARF, DEMON = 'dwarf_clans', 'demon_council'
BLESSED = {"type": "condition", "target": "pc", "condition": "blessed", "add": True}

# ---------------- 深贖之穴 ----------------
pit1 = {
    "id": "pit_exile_name",
    "title": "流放者的名字",
    "summary": "鐵爐堡的一位老婦人想找回曾祖父的名牌。兩百年前，他被判有罪，流放進深贖之穴——家族一直相信他是冤枉的。（深贖之穴・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "guild", "location": "ironforge", "min_level": 5,
        "text": "公會的告示板上貼著一張用矮人古字寫的委託，字跡顫抖：「深贖之穴的流放者，每人頸上掛一塊銅名牌。我的曾祖父葛林・鐵鬚，兩百年前被流放。請替我帶回他的名牌。他不是罪人。」",
    },
    "start_flags": ["pit_start"],
    "nodes": [
        {
            "id": "archive", "title": "在鐵爐堡的神殿查流放者的紀錄",
            "text": "心火神殿的檔案室裡，流放者的名冊堆得比人還高。管檔案的老祭司說：「流放者被送下去的那一層，名冊上都寫著。中層——在礦脈最深的贖罪銘文旁。」",
            "at": at_cell("ironforge", "temple"), "requires": need("pit_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你找到了：葛林・鐵鬚，罪名「私熔王室的黑鐵」，判決人是當年的長老「銅心」博德。名冊的邊角，有人用很小的字寫了一句：「黑鐵不是他熔的。」", ["pit_record"]),
            "fail": step("名冊太多，你只找到了一行：葛林・鐵鬚，罪名「私熔王室的黑鐵」，流放至中層。", ["pit_record"]),
        },
        {
            "id": "middle", "title": "在深贖之穴的中層找回葛林的名牌",
            "text": "中層的礦道裡，牆上刻滿了贖罪銘文，熔岩的光從裂縫裡透出來。流放者屍鬼在銘文前跪著，嘴裡唸著兩百年前的懺悔；黑鐵怨靈在礦道裡遊蕩。",
            "at": at_dun("redemption_pit", "middle"), "requires": need("pit_record"), "kind": "combat",
            "enemies": [["ironbound_wraith", 1], ["exile_ghoul", 2]],
            "success": step("屍鬼倒下了。其中一具的頸上，掛著一塊磨得發亮的銅名牌：「葛林・鐵鬚」。名牌的背面，刻著一行字——不是懺悔，是一個名字：「博德」。", ["pit_tag"]),
            "fail": step("你們被逼退到了礦道口，卻在撤退時從一具倒下的屍鬼頸上扯下了一塊銅名牌：「葛林・鐵鬚」。背面刻著：「博德」。", ["pit_tag"], [hp(-0.15)]),
        },
        {
            "id": "return", "title": "把名牌交還給老婦人",
            "text": "老婦人在公會等你。她捧著名牌，手指摸著背面的「博德」兩個字，很久沒有說話：「博德……是判他的人。他為什麼要刻判他的人的名字？」",
            "at": at_cell("ironforge", "guild"), "requires": need("pit_tag"), "kind": "choice",
            "options": [
                {"label": "「也許他想告訴我們真正的犯人」", "success": done("老婦人的眼睛亮了：「……對。曾祖父不是在懺悔，是在作證。」她把名牌緊緊握在胸口，「謝謝你。如果還有更多證據……」她看著你，沒有說完。", ["pit_1_done", "pit_suspect"], [mem("從深贖之穴的中層帶回了流放者葛林・鐵鬚的名牌，背面刻著判他的長老的名字：博德。")])},
                {"label": "「讓他安息吧」", "success": done("老婦人點點頭，把名牌放進了家族的祖龕裡：「兩百年了，他終於回家了。」她給了你一塊老舊的黑鐵，「這是他留下的。他是鐵爐堡最好的熔鐵匠。」", ["pit_1_done"], [mem("從深贖之穴的中層帶回了流放者葛林・鐵鬚的名牌，讓他回到了家族的祖龕。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

pit2 = {
    "id": "pit_unfinished_verdict",
    "title": "審判未完",
    "summary": "情報商說，當年的判決書原本有兩份：一份在長老石廳，一份隨流放者送進了深贖之穴的深層——黑鐵獄卒看守的地方。兩份對得上，判決才算數。（深贖之穴・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "informant", "location": "ironforge", "price": 300, "min_level": 8, "requires": need("pit_1_done"),
        "text": "情報商壓低聲音：「長老石廳的那份判決書，我看過抄本——葛林的罪名是後來補寫上去的，墨色不一樣。」他敲了敲桌子，「深層的那一份，才是原本。黑鐵獄卒會看守每一份判決，直到天塌下來。」",
    },
    "start_flags": ["pit_verdict"],
    "nodes": [
        {
            "id": "inscription", "title": "在鐵爐堡的神殿讀懂贖罪銘文的規矩",
            "text": "心火神殿的老祭司翻出了一本關於贖罪銘文的古書：「深層的判決書刻在黑鐵板上，只有用祭司的祝禱，獄卒才會讓你看。」",
            "at": at_cell("ironforge", "temple"), "requires": need("pit_verdict"), "kind": "check",
            "check": {"attr": "fai", "dc": 15},
            "success": step("你學會了那段古老的祝禱。老祭司點點頭：「獄卒聽見祝禱會停一下——只停一下。」", ["pit_prayer"]),
            "fail": step("你怎麼也記不住那段祝禱，老祭司只好把它刻在一塊石板上給你：「念錯了，獄卒就不會停。」", ["pit_prayer"]),
        },
        {
            "id": "deep", "title": "在深贖之穴的深層找到原本的判決書",
            "text": "深層的黑鐵獄層裡，一排排的黑鐵板掛在牆上，每一塊都刻著一份判決。兩個熔鐵為身的黑鐵獄卒在巡邏，一個黑鐵怨靈飄在它們身後。你念起了祝禱——獄卒停了一下，然後舉起了鐵錘。",
            "at": at_dun("redemption_pit", "deep"), "requires": need("pit_prayer"), "kind": "combat",
            "enemies": [["blackiron_warden", 2], ["ironbound_wraith", 1]],
            "success": step("獄卒倒下了。你在牆上找到了葛林的判決書——上面沒有「私熔黑鐵」，只有一行：「罪名待查」。判決人的位置，是空的。", ["pit_original"]),
            "fail": step("你們被逼出了獄層，卻在逃走前看清了葛林的那塊黑鐵板：「罪名待查」。判決人的位置，是空的。", ["pit_original"], [hp(-0.2)]),
        },
        {
            "id": "decide", "title": "決定怎麼處理這份判決",
            "text": "你把拓下來的判決書帶回鐵爐堡。老婦人看完，哭了。可是長老石廳的那份判決書，至今還掛在牆上——博德的後人，現在是議會的長老。",
            "at": at_cell("ironforge", "guild"), "requires": need("pit_original"), "kind": "choice",
            "options": [
                {"label": "請瑪格達在心火熔源前公開", "success": done("瑪格達看完拓本，一言不發地把它掛在了心火熔源的門口——那是整座鐵爐堡最多人經過的地方。三天後，議會宣布重審葛林・鐵鬚的案子。博德的後人沒有出席。", ["pit_2_done", "pit_public"], [aff(MAGDA, 10, "讓她主持了公道"), rep(DWARF, 5), mem("從深贖之穴的深層拓下了葛林・鐵鬚的原本判決書：罪名待查。瑪格達把它公開在心火熔源的門口，議會宣布重審。")])},
                {"label": "交給老婦人，讓家族自己決定", "success": done("老婦人把拓本收進了祖龕，和名牌放在一起：「我們知道就夠了。」她頓了頓，「可是，深層還有很多人……他們都在等。」", ["pit_2_done", "pit_family"], [mem("從深贖之穴的深層拓下了葛林・鐵鬚的原本判決書，交給了他的家族。深層還有很多流放者在等。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

pit3 = {
    "id": "pit_blackiron_tyrant",
    "title": "黑鐵獄層的暴君",
    "summary": "深贖之穴最底下的熔爐之心——黑鐵獄層的暴君——醒了。礦坑裡所有的流放者亡魂，都被它吸了下去。葛林・鐵鬚的魂，也在裡面。（深贖之穴・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "guild", "location": "ironforge", "min_level": 11, "requires": need("pit_2_done"),
        "text": "公會發出了緊急徵召：深贖之穴的礦氣一夜之間變成了黑色，礦坑口的守衛聽見地底傳來成千上萬的哭聲。石誓會的巴爾林站在告示板前：「熔爐之心醒了。它在吞流放者的魂。」他看著你，「葛林的魂也在裡面。」",
    },
    "start_flags": ["pit_tyrant"],
    "nodes": [
        {
            "id": "voices", "title": "在深贖之穴的深淵層聽亡魂的聲音",
            "text": "深淵層的空氣燙得像熔爐。牆上的黑鐵板一塊一塊地融化，流放者的亡魂被拉向更深處。其中一個亡魂停了下來，看著你——頸上沒有名牌。「你帶我回家了。」葛林說，「可是其他人呢？」",
            "at": at_dun("redemption_pit", "abyss"), "requires": need("pit_tyrant"), "kind": "choice",
            "options": [
                {"label": "「我會帶他們一起回去」", "success": step("葛林笑了：「那麼，我替你開路。」他的亡魂飄向深處，替你照亮了通往熔爐之心的路。", ["pit_path"], [aff(BALIN, 5, "承諾帶亡魂回家")])},
                {"label": "「你先走，其他的我來處理」", "success": step("葛林搖了搖頭：「我在這裡待了兩百年，不差這一會兒。」他留在了你身邊。", ["pit_path"])},
            ],
        },
        {
            "id": "overseers", "title": "在深贖之穴的深淵層擋下黑鐵獄卒長",
            "text": "通往熔爐之心的路上，黑鐵獄卒長和一個贖罪怨魂擋住了去路。獄卒長的鐵錘上刻著所有判決的名字。",
            "at": at_dun("redemption_pit", "abyss"), "requires": need("pit_path"), "kind": "combat",
            "enemies": [["blackiron_overseer", 1], ["penance_wraith", 1]],
            "success": step("獄卒長倒下了，鐵錘上的名字一個一個地熄滅。前方，熔爐之心在跳動。", ["pit_through"]),
            "fail": step("你們被打得遍體鱗傷，可葛林的亡魂纏住了獄卒長的鐵錘，讓你們衝了過去。前方，熔爐之心在跳動。", ["pit_through"], [hp(-0.2)]),
        },
        {
            "id": "tyrant", "title": "在深贖之穴的深淵層打倒黑鐵獄層的暴君",
            "text": "黑鐵獄層的暴君是一座活著的熔爐，熔鐵的身軀裡翻滾著成千上萬張臉。它不說話，也不聽——只是吞。另一個黑鐵獄卒長從熔爐裡爬了出來。",
            "at": at_dun("redemption_pit", "abyss"), "requires": need("pit_through"), "kind": "combat",
            "enemies": [["blackiron_tyrant", 1], ["blackiron_overseer", 1]],
            "success": step("熔爐之心裂開了，被吞下的亡魂像火星一樣湧了出來。可是熔爐的廢墟上方，半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。深贖之穴最深刻的過去還會一次又一次地重演，它也會一次又一次地重新熔鑄自己。", ["pit_broken"]),
            "fail": step("你們撐不住了，就在這時，所有被吞下的亡魂一起推開了熔爐的門。暴君裂開了，亡魂們湧了出來。半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。這座礦坑最深刻的過去還會重演，它也會再燒起來。", ["pit_broken"], [hp(-0.25)]),
        },
        {
            "id": "souls", "title": "決定流放者亡魂的去處",
            "text": "成千上萬的亡魂在熔爐的廢墟上方盤旋。葛林看著你：「我們該去哪裡？」",
            "at": at_dun("redemption_pit", "abyss"), "requires": need("pit_broken"), "kind": "choice",
            "options": [
                {"label": "帶他們回心火熔源", "success": done("你帶著亡魂們走出了深贖之穴。心火熔源的火焰在那一夜燒得比任何時候都高——瑪格達說，那是兩百年來的流放者，回到了家。葛林的名字被刻回了熔鐵匠的名冊上。", ["pit_done", "pit_home"], [aff(MAGDA, 15, "讓流放者回到了心火"), aff(BALIN, 15, "完成了石誓會的心願"), rep(DWARF, 15), mem("打倒了深贖之穴的熔爐之心，把兩百年來的流放者亡魂帶回了鐵爐堡的心火熔源。", 3)])},
                {"label": "讓他們留在礦坑，守著下一個被冤枉的人", "success": done("葛林點了點頭：「也好。下一個被流放的人，不會再孤單了。」亡魂們回到了礦坑的各個角落，從那以後，深贖之穴的流放者都說，礦道裡有人在替他們照路。", ["pit_done", "pit_guard"], [aff(BALIN, 10, "完成了石誓會的心願"), rep(DWARF, 10), mem("打倒了深贖之穴的熔爐之心，流放者的亡魂留在礦坑裡，替後來的人照路。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 回聲裂谷 ----------------
echo1 = {
    "id": "echo_dead_husband",
    "title": "亡夫的聲音",
    "summary": "鐵爐堡的一位矮人寡婦說，她在回聲裂谷聽見了死去丈夫的聲音。他在叫她的名字。（回聲裂谷・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "guild", "location": "ironforge", "min_level": 5,
        "text": "公會裡，一個穿著喪服的矮人婦人抓著每一個冒險者的袖子：「我丈夫十年前死在回聲裂谷。上個月我去祭拜，聽見他在叫我——叫我的小名，只有他知道的那個。」她的眼睛紅腫，「請帶我去找他。不，請你去找他。我、我不敢再去。」",
    },
    "start_flags": ["echo_start"],
    "nodes": [
        {
            "id": "widow", "title": "在鐵爐堡的酒館聽寡婦說丈夫的事",
            "text": "寡婦叫歐拉，丈夫叫索恩，是封印隊的隊員。她說了很多：索恩愛唱的歌、他左手的舊傷、他每天出門前都會說的那句話。",
            "at": at_cell("ironforge", "tavern"), "requires": need("echo_start"), "kind": "check",
            "check": {"attr": "cha", "dc": 13},
            "success": step("你陪歐拉喝了一夜的酒，記下了索恩所有的習慣。她最後說：「如果那真的是他……他會唱那首歌。如果不是，它只會一直叫我的名字。」", ["echo_known"]),
            "fail": step("歐拉說得太快，你只記住了一件事：索恩愛唱一首叫《鐵與雪》的歌。", ["echo_known"]),
        },
        {
            "id": "middle", "title": "在回聲裂谷的中層找到那個聲音",
            "text": "裂谷的中層，回聲層層疊疊，每一聲都被岩壁放大、扭曲。你聽見了——「歐拉……歐拉……」。聲音的源頭不是人，是兩團模仿人聲的幽影，和一隻被聲音吸引來的寒晶翼獸。",
            "at": at_dun("echo_rift", "middle"), "requires": need("echo_known"), "kind": "combat",
            "enemies": [["mimic_shade", 1], ["sonic_phantom", 1], ["frostwing", 1]],
            "success": step("幽影散了，聲音停了。可是在一片寂靜裡，你聽見了另一個很遠很遠的聲音，在唱《鐵與雪》——斷斷續續的，像是從很深的地方傳上來的。", ["echo_song"]),
            "fail": step("你們被逼退了，可在撤退的時候，你聽見了很深的地方，有人在唱《鐵與雪》。", ["echo_song"], [hp(-0.15)]),
        },
        {
            "id": "tell", "title": "告訴歐拉你聽見了什麼",
            "text": "歐拉在酒館等你，手裡握著索恩留下的舊錘子。",
            "at": at_cell("ironforge", "tavern"), "requires": need("echo_song"), "kind": "choice",
            "options": [
                {"label": "「叫妳名字的是模仿者。但更深的地方，有人在唱那首歌」", "success": done("歐拉的錘子掉在了地上。她哭了，又笑了：「是他……他還在唱。」她抓住你的手，「求你，再往下找。」", ["echo_1_done", "echo_hope"], [mem("在回聲裂谷的中層打散了模仿亡者的幽影，卻在更深處聽見了有人在唱《鐵與雪》。")])},
                {"label": "「那只是回音。他已經走了」", "success": done("歐拉沉默了很久，點點頭，把錘子放在了桌上：「……我知道。我只是想再聽一次。」她留下了錘子，「替我把它帶到裂谷去吧。給他。」", ["echo_1_done"], [mem("在回聲裂谷的中層打散了模仿亡者的幽影，告訴寡婦歐拉那只是回音。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

echo2 = {
    "id": "echo_seal_log",
    "title": "封印隊的日誌",
    "summary": "十年前，一支矮人封印隊下到回聲裂谷的深處，想封住回聲。只有一本日誌被帶了回來——最後一頁被撕掉了。情報商知道那一頁在哪裡。（回聲裂谷・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "informant", "location": "ironforge", "price": 300, "min_level": 8, "requires": need("echo_1_done"),
        "text": "情報商把一本燒焦的日誌推到你面前：「封印隊的日誌。最後一頁被撕了。撕掉它的人是隊長——他在深層留下了那一頁，用共鳴魔像守著。」他壓低聲音，「據說，那一頁寫著封印失敗的原因。還有，誰留了下來。」",
    },
    "start_flags": ["echo_log"],
    "nodes": [
        {
            "id": "read", "title": "在鐵爐堡的魔法物品店讀懂封印隊的日誌",
            "text": "魔法物品店的老闆把日誌放在一盞會發出低鳴的燈下：「封印隊用的是聲紋符文，要用同樣頻率的聲音才讀得出來。」",
            "at": at_cell("ironforge", "magic"), "requires": need("echo_log"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你對準了頻率，日誌上浮現出隊長的字：「回聲不是怪物，是亡者沒說完的話。封不住。只能替它們說完。」日誌的邊角，有一行潦草的字：「索恩說他要留下來，替我們唱。」", ["echo_read"]),
            "fail": step("你只讀出了一行字：「封不住。只能替它們說完。」", ["echo_read"]),
        },
        {
            "id": "deep", "title": "在回聲裂谷的深層找到日誌的最後一頁",
            "text": "深層的岩壁上，掛著一張被冰封住的紙。一尊共鳴魔像和一頭寒晶飛龍守在冰前，它們聽見你的腳步聲，同時轉過頭來。",
            "at": at_dun("echo_rift", "deep"), "requires": need("echo_read"), "kind": "combat",
            "enemies": [["resonance_golem", 1], ["frost_wyvern", 1]],
            "success": step("你敲開了冰，取下了那一頁。上面只有一段歌詞——《鐵與雪》的最後一段，和一行字：「唱完這首歌的人，回聲就會放他走。」", ["echo_page"]),
            "fail": step("你們被逼退了，可在撤退前，你從冰裡扯下了那一頁：《鐵與雪》的最後一段，和一行字：「唱完這首歌的人，回聲就會放他走。」", ["echo_page"], [hp(-0.2)]),
        },
        {
            "id": "decide", "title": "決定要不要把這一頁交給歐拉",
            "text": "你回到鐵爐堡，歐拉已經在公會等了三天。她看見你手裡的紙，站了起來。",
            "at": at_cell("ironforge", "guild"), "requires": need("echo_page"), "kind": "choice",
            "options": [
                {"label": "交給她，告訴她索恩在等有人唱完那首歌", "success": done("歐拉讀完，把紙貼在胸口：「他一直在等我唱完。我們每次唱這首歌，都是他唱前半段，我唱後半段。」她擦掉眼淚，「這一次，我要去唱。」", ["echo_2_done", "echo_sing"], [mem("從回聲裂谷的深層取回了封印隊日誌的最後一頁：唱完《鐵與雪》的人，回聲就會放他走。歐拉決定親自去唱。")])},
                {"label": "先留著，太危險了", "success": done("你把紙收了起來。歐拉看著你，沒有生氣：「你是怕我也回不來。」她點點頭，「可是，他在等。」", ["echo_2_done"], [mem("從回聲裂谷的深層取回了封印隊日誌的最後一頁，沒有交給歐拉。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

echo3 = {
    "id": "echo_spirit_of_echoes",
    "title": "回聲之靈的本體",
    "summary": "回聲裂谷最底下，是所有回聲的源頭：回聲之靈的本體。它沒有形體，只有一個不斷模仿亡者的聲音。歐拉要去那裡，唱完《鐵與雪》。（回聲裂谷・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "guild", "location": "ironforge", "min_level": 11, "requires": need("echo_2_done"),
        "text": "歐拉換上了索恩的舊鎧甲，大了兩號，袖子捲了三圈：「我要去裂谷的最底下。」她握著那張紙，「你陪我去。等我唱完，不管發生什麼，都帶我回來。」",
    },
    "start_flags": ["echo_bottom"],
    "nodes": [
        {
            "id": "silence", "title": "在回聲裂谷的深淵層保持安靜",
            "text": "深淵層裡，你發出的每一點聲音都會被放大成雷鳴，然後變成別人的聲音——你的父母、你的朋友、你殺過的敵人。歐拉握緊了你的手。要走到最底下，你得讓自己安靜得像一塊石頭。",
            "at": at_dun("echo_rift", "abyss"), "requires": need("echo_bottom"), "kind": "check",
            "check": {"attr": "fai", "dc": 16},
            "success": step("你讓呼吸慢下來，慢到聽不見自己的心跳。你們一步一步地走到了谷底，一個聲音也沒有發出。", ["echo_quiet"]),
            "fail": step("你踢到了一塊石頭。聲音炸開了，變成了成千上萬個人在喊你的名字。你們摀著耳朵衝到了谷底。", ["echo_quiet"], [hp(-0.15)]),
        },
        {
            "id": "guards", "title": "在回聲裂谷的深淵層擋下擬聲之魅",
            "text": "谷底的入口，一個擬聲之魅和一尊回聲巨像擋住了路。擬聲之魅用索恩的聲音說：「歐拉，回去吧。」歐拉的臉一下子白了。",
            "at": at_dun("echo_rift", "abyss"), "requires": need("echo_quiet"), "kind": "combat",
            "enemies": [["mimic_specter", 1], ["echo_colossus", 1]],
            "success": step("擬聲之魅散了。歐拉擦掉眼淚：「那不是他。他從來不會叫我回去。」", ["echo_gate"]),
            "fail": step("你們撐不住了，歐拉卻突然對著擬聲之魅大吼：「他從來不會叫我回去！」那個聲音停了，擬聲之魅散了。", ["echo_gate"], [hp(-0.2)]),
        },
        {
            "id": "source", "title": "在回聲裂谷的深淵層打倒回聲之靈的本體",
            "text": "谷底是一片沒有形體的聲音之海。回聲之靈的本體用成千上萬個亡者的聲音同時開口，它不聽也不回答——只是模仿。一尊回聲巨像從聲音裡站了起來。歐拉開始唱《鐵與雪》。",
            "at": at_dun("echo_rift", "abyss"), "requires": need("echo_gate"), "kind": "combat",
            "enemies": [["spirit_of_echoes", 1], ["echo_colossus", 1]],
            "success": step("你們擋住了回聲，歐拉唱完了最後一段。聲音之海安靜了一瞬——然後，一個很溫柔的男聲接著唱了下去，唱的是前半段。歐拉哭著笑了。回聲之靈散了，可是半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。裂谷最深刻的過去還會重演，它也會重新聚起來。", ["echo_sung"]),
            "fail": step("回聲把你們淹沒了，可歐拉沒有停，一直唱到了最後。聲音之海安靜了一瞬，一個很溫柔的男聲接著唱了下去。回聲之靈散了。半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。它還會再回來。", ["echo_sung"], [hp(-0.25)]),
        },
        {
            "id": "after", "title": "決定裂谷的回聲",
            "text": "索恩的聲音唱完了，慢慢地淡去。歐拉跪在谷底，手裡握著那張紙。谷底的岩壁上，還有成千上萬個聲音在等著——等著有人替它們說完。",
            "at": at_dun("echo_rift", "abyss"), "requires": need("echo_sung"), "kind": "choice",
            "options": [
                {"label": "「讓歐拉把封印隊的方法帶回鐵爐堡」", "success": done("歐拉回到鐵爐堡，成了第一個「替回聲說完話的人」。每年，失去家人的矮人都會跟著她下到裂谷，唱完那些沒唱完的歌。裂谷的回聲，一年比一年安靜。", ["echo_done", "echo_singers"], [rep(DWARF, 15), mem("陪寡婦歐拉在回聲裂谷的谷底唱完了《鐵與雪》，她亡夫的聲音接著唱了下去。從此鐵爐堡的人每年都會下到裂谷，替回聲說完話。", 3)])},
                {"label": "「讓回聲就這樣留著」", "success": done("歐拉點點頭：「有些話，說不完也好。」你們離開了谷底。從那以後，回聲裂谷還是會用亡者的聲音叫人——可是歐拉說，那不全是陷阱，有時候，那是有人在想念。", ["echo_done", "echo_kept"], [rep(DWARF, 10), mem("陪寡婦歐拉在回聲裂谷的谷底唱完了《鐵與雪》。裂谷的回聲留了下來。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 巨人之嵴 ----------------
gnt1 = {
    "id": "gnt_mountain_heartbeat",
    "title": "山的心跳",
    "summary": "灰岩堡壘的將軍杜拉克說，巨人之嵴的雪崩越來越頻繁，山口的商路已經斷了三次。每一次雪崩之前，山都會震一下——像心跳。（巨人之嵴・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "npc", "npc": DURAK, "min_level": 5,
        "text": "杜拉克站在花崗岩城牆上，看著北方的雪峰：「三十年來，我只相信城牆和我的兵。」她把一塊碎石放在你手裡，石頭還在微微震動，「可是這座山，在跳。巨人之嵴本身就是遠古巨人王的脊骨——傳說而已。我要知道，是不是傳說。」",
    },
    "start_flags": ["gnt_start"],
    "nodes": [
        {
            "id": "runes", "title": "請迷石的瑟爾讀碎石上的符文",
            "text": "瑟爾把碎石貼在耳邊聽了很久，答非所問：「石頭在作夢。」瑟爾把碎石翻過來，上面有細細的符文，「古符迴路。巨人時代的。它們本來是鎖。」",
            "at": at_npc(SER), "requires": need("gnt_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你和瑟爾一起拼出了符文的意思：「睡吧，王。」巨人之嵴的符文迴路，是一首搖籃曲。瑟爾點點頭：「搖籃曲斷了。所以王在翻身。」", ["gnt_lullaby_known"], [aff(SER, 10, "聽懂了石頭的夢")]),
            "fail": step("瑟爾說了一大串謎語，你只聽懂了一句：「鎖斷了。王在翻身。」", ["gnt_lullaby_known"]),
        },
        {
            "id": "middle", "title": "在巨人之嵴的中層找到斷掉的符文",
            "text": "中層的巨人遺跡裡，雪人在冰柱間遊蕩，雷靈在半空中閃爍。一具巨人遺骸從冰裡站了起來——它胸口的符文迴路，斷了一截。",
            "at": at_dun("giants_spine", "middle"), "requires": need("gnt_lullaby_known"), "kind": "combat",
            "enemies": [["giant_skeleton", 1], ["thunder_spirit", 1], ["yeti", 1]],
            "success": step("遺骸倒下了。你在它胸口找到了斷掉的那一截符文——斷口很整齊，是被人用工具撬開的。旁邊的冰上，有一串人類的靴印。", ["gnt_broken"]),
            "fail": step("你們被逼退了，可你看見了遺骸胸口的符文——斷口很整齊，是被人撬開的。冰上有一串人類的靴印。", ["gnt_broken"], [hp(-0.15)]),
        },
        {
            "id": "report", "title": "回報杜拉克",
            "text": "杜拉克聽完，握緊了城牆上的石頭：「盜掘者。」她看著你，「有人在撬巨人遺跡的符文——古符迴路在黑市上很值錢。」",
            "at": at_npc(DURAK), "requires": need("gnt_broken"), "kind": "choice",
            "options": [
                {"label": "「封鎖山口，不讓盜掘者上山」", "success": done("杜拉克當天就派兵封了山口。灰岩堡壘的兵在雪地裡守了一個月，抓到了七個盜掘者。可是山的心跳，沒有停。", ["gnt_1_done", "gnt_closed"], [aff(DURAK, 15, "幫她守住了山口"), rep(DWARF, 5), mem("在巨人之嵴發現有人撬走古符迴路，讓遠古巨人王在山裡翻身。杜拉克封鎖了山口。")])},
                {"label": "「先修好符文」", "success": done("杜拉克點點頭，把瑟爾叫上了城牆：「修得好嗎？」瑟爾看著山：「搖籃曲要唱完整的。斷了一句，就要從頭唱。」", ["gnt_1_done", "gnt_repair"], [aff(SER, 10, "想修好符文"), mem("在巨人之嵴發現古符迴路被撬開，決定和迷石的瑟爾一起修好它。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

gnt2 = {
    "id": "gnt_rune_circuit",
    "title": "古符迴路",
    "summary": "巨人之嵴的古符迴路是一首刻在山裡的搖籃曲。瑟爾說，要修好它，得找到深層的「主旋律」——一整面刻滿符文的牆。（巨人之嵴・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": SER, "min_level": 8, "requires": need("gnt_1_done"),
        "text": "瑟爾把一塊刻著符文的石板交給你：「主旋律在深層。風暴石像守著。」瑟爾頓了頓，難得地說了一句不像謎語的話，「我不會打架。可是我會唱。你帶我下去，我把搖籃曲接回去。」",
    },
    "start_flags": ["gnt_circuit"],
    "nodes": [
        {
            "id": "guide", "title": "在灰岩堡壘的酒館找上山的嚮導",
            "text": "巨人之嵴要五天的路，沒有嚮導上不去。灰岩堡壘的酒館裡，嚮導們一聽說要去深層，都搖頭。",
            "at": at_cell("greyrock", "tavern"), "requires": need("gnt_circuit"), "kind": "check",
            "check": {"attr": "cha", "dc": 15},
            "success": step("一個老嚮導終於點了頭：「我爺爺說過，巨人王睡著的時候，山是最安全的。」他背起了行囊，「讓他睡吧。我帶你們去。」", ["gnt_guided"]),
            "fail": step("沒有人願意帶路，最後是杜拉克派了一個兵：「他走過一次。只有一次。」", ["gnt_guided"], [money(-100)]),
        },
        {
            "id": "deep", "title": "在巨人之嵴的深層守住瑟爾",
            "text": "深層的主旋律牆前，一尊風暴石像和一段古符迴路同時醒了過來。瑟爾已經開始唱了——聲音很輕，像是在哄孩子睡覺。",
            "at": at_dun("giants_spine", "deep"), "requires": need("gnt_guided"), "kind": "combat",
            "enemies": [["storm_gargoyle", 1], ["rune_circuit", 1]], "allies": [SER],
            "success": step("石像和迴路倒下了，瑟爾的歌沒有斷。牆上的符文一個接一個地亮了起來，山的心跳慢了下來。", ["gnt_sung"]),
            "fail": step("石像把你們逼到了牆邊，可瑟爾的歌一直沒停。最後一個符文亮起來的時候，石像停下了，回到了底座上。", ["gnt_sung"], [hp(-0.2)]),
        },
        {
            "id": "end", "title": "決定搖籃曲的最後一句",
            "text": "瑟爾唱到了最後一句，停了下來：「最後一句，有兩種唱法。一種是『睡吧，王，永遠』。一種是『睡吧，王，等你醒來』。」瑟爾看著你，「古時候的人，沒有寫要唱哪一種。」",
            "at": at_dun("giants_spine", "deep"), "requires": need("gnt_sung"), "kind": "choice",
            "options": [
                {"label": "「睡吧，永遠」", "success": done("瑟爾唱完了。山深深地嘆了一口氣，然後靜了下來。雪崩停了，商路通了。瑟爾在回程的路上一直很安靜，最後說了一句：「……他很老了。睡吧也好。」", ["gnt_2_done", "gnt_forever"], [aff(SER, 10, "陪瑟爾唱完了搖籃曲"), aff(DURAK, 10, "讓山口恢復了平靜"), mem("在巨人之嵴的深層陪迷石的瑟爾把古符迴路的搖籃曲唱完：「睡吧，王，永遠。」")])},
                {"label": "「睡吧，等你醒來」", "success": done("瑟爾唱完了，嘴角揚了一下。山慢慢地靜了下來，可心跳沒有完全停——很慢，很輕，像在作一個很長的夢。瑟爾說：「等他醒來的那天，我們要在這裡。」", ["gnt_2_done", "gnt_waiting"], [aff(SER, 20, "選了瑟爾想唱的那一句"), mem("在巨人之嵴的深層陪迷石的瑟爾把古符迴路的搖籃曲唱完：「睡吧，王，等你醒來。」")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

gnt3 = {
    "id": "gnt_giant_king",
    "title": "遠古巨人之王",
    "summary": "盜掘者又回來了——這一次，他們撬走了主旋律牆的整塊核心符文。巨人之嵴的深淵層裡，遠古巨人之王站了起來。（巨人之嵴・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": DURAK, "min_level": 11, "requires": need("gnt_2_done"),
        "text": "杜拉克的城牆在震動。她第一次沒有站在城牆上，而是全副武裝地站在門口：「盜掘者撬走了核心符文。山裂開了，巨人王醒了。」她看著北方，「灰岩堡壘從未失守過。今天也不會。可是要讓他回去睡，得有人下到山的最深處。」",
    },
    "start_flags": ["gnt_king"],
    "nodes": [
        {
            "id": "thieves", "title": "在巨人之嵴的深淵層找回核心符文",
            "text": "深淵層的入口，盜掘者們的屍體散落在冰上——他們沒能帶著符文離開。一尊風暴巨人和一尊符文泰坦站在屍體之間，核心符文在泰坦的手裡閃爍。",
            "at": at_dun("giants_spine", "abyss"), "requires": need("gnt_king"), "kind": "combat",
            "enemies": [["storm_giant", 1], ["rune_titan", 1]],
            "success": step("你從泰坦的手裡奪回了核心符文。它很燙，像一顆心臟。前方，山的最深處傳來了一聲低沉的呼吸。", ["gnt_rune"]),
            "fail": step("你們被打得遍體鱗傷，可泰坦倒下時鬆開了手，核心符文滾到了你腳邊。前方，山的最深處傳來了一聲低沉的呼吸。", ["gnt_rune"], [hp(-0.2)]),
        },
        {
            "id": "king", "title": "在巨人之嵴的深淵層打倒遠古巨人之王",
            "text": "遠古巨人之王坐在山的心臟裡，身體和山連在一起，脊骨就是巨人之嵴。他沒有說話——他早已忘了怎麼說話，只記得憤怒。一尊符文泰坦從他的腳邊站了起來。",
            "at": at_dun("giants_spine", "abyss"), "requires": need("gnt_rune"), "kind": "combat",
            "enemies": [["primordial_giant", 1], ["rune_titan", 1]],
            "success": step("巨人王跪了下來，身體重新沉進了山裡。山就是他的身體，打倒的只是他醒著的那一部分；而且半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。巨人時代最深刻的那一刻還會重演，下一次有人走進這裡，他還會站起來。", ["gnt_down"]),
            "fail": step("你們撐不住了，可核心符文在你的手裡發出了光，巨人王的動作慢了下來，重新沉進了山裡。他沒有死——山就是他的身體。半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。他還會站起來。", ["gnt_down"], [hp(-0.25)]),
        },
        {
            "id": "seal", "title": "把核心符文放回去",
            "text": "核心符文在你的手裡跳動。主旋律牆上的缺口在等著它。",
            "at": at_dun("giants_spine", "abyss"), "requires": need("gnt_down"), "kind": "choice",
            "options": [
                {"label": "放回去，讓瑟爾的搖籃曲把他哄睡", "success": done("你把核心符文放回了牆上。整座山響起了搖籃曲——瑟爾教你的那一首。巨人王的呼吸慢了下來，慢到聽不見了。回到灰岩堡壘，杜拉克在城牆上等你，難得地笑了：「堡壘沒有失守。」", ["gnt_done", "gnt_lullaby"], [aff(DURAK, 20, "守住了灰岩堡壘"), aff(SER, 15, "完成了搖籃曲"), rep(DWARF, 15), mem("在巨人之嵴的深淵層打倒了醒來的遠古巨人之王，把核心符文放回了主旋律牆，讓他重新睡去。", 3)])},
                {"label": "交給杜拉克，讓灰岩堡壘守著它", "success": done("你把核心符文帶回了灰岩堡壘。杜拉克把它鎖在了城牆最深處的石室裡，派了十個兵日夜看守：「只要它在這裡，盜掘者就碰不到。」山的心跳沒有完全停，但很慢，很輕。", ["gnt_done", "gnt_kept"], [aff(DURAK, 25, "把符文交給了她"), rep(DWARF, 10), mem("在巨人之嵴的深淵層打倒了醒來的遠古巨人之王，把核心符文交給灰岩堡壘的杜拉克看守。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 餘燼裂隙 ----------------
emb1 = {
    "id": "emb_warm_floors",
    "title": "地底的熱",
    "summary": "血羽城堡就建在餘燼裂隙的入口上。這個月，城堡底層的地板燙得不能赤腳走路，地窖裡的酒全都沸了。（餘燼裂隙・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "guild", "location": "bloodplume", "min_level": 5,
        "text": "公會的告示板上貼著一張被燒焦了一角的委託，蓋著赤翼宮廷的印：「城堡底層溫度異常，地窖的酒全數沸騰。誠徵冒險者下到餘燼裂隙查明原因。總管薇洛妮卡。」底下有一行小字：「酒的損失，宮廷不賠。」",
    },
    "start_flags": ["emb_start"],
    "nodes": [
        {
            "id": "cellar", "title": "在血羽城堡的公會查溫度的變化",
            "text": "公會的書記官拿出了一本記錄：城堡每一層的溫度，每天量一次，量了三百年。「這是陛下規定的。」他說，「她說，裂隙的火是魔族的心跳，心跳亂了，要第一個知道。」",
            "at": at_cell("bloodplume", "guild"), "requires": need("emb_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你在記錄裡找到了規律：溫度不是一直上升，是一天三次，每次都在同一個時辰——像是有人在下面，一天汲取三次魔焰。", ["emb_pattern"]),
            "fail": step("記錄太多，你只看出溫度在上升。書記官說：「從上個月開始的。」", ["emb_pattern"]),
        },
        {
            "id": "middle", "title": "在餘燼裂隙的中層查看魔焰的流向",
            "text": "中層的岩漿河裡，魔焰元素比平常多了一倍，地獄犬在河邊徘徊。岩漿河的流向不對——它在往一個方向流，流進了一個人工鑿出來的洞口。",
            "at": at_dun("ember_rift", "middle"), "requires": need("emb_pattern"), "kind": "combat",
            "enemies": [["hellfire_elemental", 1], ["hellhound", 2]],
            "success": step("元素和地獄犬被擊退了。洞口的岩壁上刻著魔族的法陣——汲取魔焰的法陣，而且是新刻的。", ["emb_channel"]),
            "fail": step("你們被熱浪逼退了，可在撤退時看見了那個洞口：岩壁上刻著新的汲焰法陣。", ["emb_channel"], [hp(-0.15)]),
        },
        {
            "id": "report", "title": "回報薇洛妮卡",
            "text": "薇洛妮卡聽完，在小冊子上記了一筆，笑容沒有變：「有人在偷陛下的心跳。」她合上冊子，「你要我現在就派兵下去，還是……先讓你查清楚是誰？」",
            "at": at_npc(VER), "requires": need("emb_channel"), "kind": "choice",
            "options": [
                {"label": "「我先查清楚」", "success": done("薇洛妮卡點點頭：「好。派兵下去，偷東西的人會跑；你下去，偷東西的人會以為只是冒險者。」她遞給你一瓶冰涼的藥水，「耐熱的。宮廷出錢。」", ["emb_1_done", "emb_quiet"], [aff(VER, 10, "替她低調處理"), mem("在餘燼裂隙的中層發現有人刻了新的汲焰法陣在偷魔焰，答應薇洛妮卡先查清楚是誰。")])},
                {"label": "「派兵封住洞口」", "success": done("薇洛妮卡派了一隊衛兵封住了洞口。城堡的溫度降了一點——可是一個星期後，又升了回去。她嘆了口氣：「他們換了一個洞。」", ["emb_1_done"], [aff(VER, 5, "替她查到了洞口"), mem("在餘燼裂隙的中層發現了偷取魔焰的法陣，薇洛妮卡派兵封住了洞口，但偷焰的人換了地方。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

emb2 = {
    "id": "emb_flame_weavers",
    "title": "偷焰的人",
    "summary": "偷取魔焰的人，是一群在裂隙邊緣汲取原初魔焰的術士——魔焰織法者。情報商說，他們把偷來的魔焰賣給了一個想造出「永不熄滅的武器」的人。（餘燼裂隙・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "informant", "location": "bloodplume", "price": 300, "min_level": 8, "requires": need("emb_1_done"),
        "text": "獨眼的老情報商把一顆裝著火焰的玻璃珠放在桌上：「黑市上的魔焰珠。一顆一千枚金幣。賣家是一群織法者，在裂隙的深層有一個汲焰的祭壇。」他瞇起獨眼，「買家？一個說要造『永不熄滅的劍』的人。名字我不知道——錢太多了，我不敢問。」",
    },
    "start_flags": ["emb_weavers"],
    "nodes": [
        {
            "id": "pearl", "title": "在血羽城堡的魔法物品店查魔焰珠",
            "text": "魔法物品店的老闆拿著放大鏡看了魔焰珠很久：「原初魔焰。純度很高。」他把珠子翻過來，底部有一個很小的刻印，「這是熔火堡壘的工坊印。」",
            "at": at_cell("bloodplume", "magic"), "requires": need("emb_weavers"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你們對照了工坊印的名冊：那是熔火堡壘一間已經關閉的私人工坊，工坊主是一個被千爐工坊開除的鍛匠——他說過，要造出比伊格妮絲的巨像更強的東西。", ["emb_buyer"]),
            "fail": step("你只看出這是熔火堡壘的工坊印，是哪一間，老闆也說不上來。", ["emb_buyer"]),
        },
        {
            "id": "deep", "title": "在餘燼裂隙的深層搗毀汲焰的祭壇",
            "text": "深層的汲焰祭壇上，魔焰像瀑布一樣被抽進一排排的玻璃罐裡。織法者們已經逃了，留下了被法陣召喚來看守的炎魔幼體和焰魂。",
            "at": at_dun("ember_rift", "deep"), "requires": need("emb_buyer"), "kind": "combat",
            "enemies": [["flame_fiend", 1], ["fire_wraith", 1]],
            "success": step("守衛倒下了。你砸碎了祭壇上的法陣，魔焰的瀑布倒流回了裂隙的深處。整座裂隙發出了一聲像是嘆息的轟鳴。", ["emb_smashed"]),
            "fail": step("你們被熱浪逼退了，可在撤退前砸碎了法陣的一角。魔焰的瀑布慢慢地倒流回了深處。", ["emb_smashed"], [hp(-0.2)]),
        },
        {
            "id": "jars", "title": "決定怎麼處理裝滿魔焰的玻璃罐",
            "text": "祭壇旁還剩下十幾個裝滿魔焰的玻璃罐，在黑暗裡發著光。每一罐，在黑市上都值一座城。",
            "at": at_dun("ember_rift", "deep"), "requires": need("emb_smashed"), "kind": "choice",
            "options": [
                {"label": "倒回裂隙", "success": done("你把魔焰一罐一罐地倒回了裂隙。最後一罐倒下去的時候，裂隙的深處亮起了一道光，像是有什麼東西在回應。回到地面，城堡的溫度降回了三百年來的記錄。", ["emb_2_done", "emb_returned"], [aff(VER, 10, "讓城堡的溫度恢復了"), mem("在餘燼裂隙的深層搗毀了偷取原初魔焰的祭壇，把偷來的魔焰全部倒回了裂隙。")])},
                {"label": "帶回去交給薇洛妮卡", "success": done("薇洛妮卡看著那些罐子，難得地沒有笑：「這些東西，夠造一支軍隊的武器。」她把罐子鎖進了宮廷最深的金庫，「謝謝你。我會讓陛下知道。」", ["emb_2_done", "emb_vault"], [aff(VER, 15, "把魔焰交給了宮廷"), rep(DEMON, 5), mem("在餘燼裂隙的深層搗毀了偷取魔焰的祭壇，把偷來的魔焰交給了薇洛妮卡鎖進宮廷金庫。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

emb3 = {
    "id": "emb_heart_of_flame",
    "title": "魔焰之源",
    "summary": "被抽走又倒灌的魔焰驚醒了裂隙最底下的原初魔焰本身——魔焰之源。魔族說，所有的魔能都從那裡開始。現在，它在往上湧。（餘燼裂隙・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "guild", "location": "bloodplume", "min_level": 11, "requires": need("emb_2_done"),
        "text": "公會的地板在發燙，告示板上的紙一張一張地捲了起來。書記官滿頭大汗：「裂隙的火在往上湧！城堡的底層已經撤空了！」他把一張蓋著赤翼印的徵召令塞給你，「陛下說，讓那個人類下去。她說你知道該怎麼做。」",
    },
    "start_flags": ["emb_source"],
    "nodes": [
        {
            "id": "herald", "title": "在餘燼裂隙的深淵層擋下魔焰傳令者",
            "text": "深淵層的空氣在燃燒。一個魔焰傳令者和一尊餘燼泰坦從岩漿裡站了起來，傳令者張開了嘴，發出的不是聲音，是一道火焰的號令——裂隙裡所有的火都在響應。",
            "at": at_dun("ember_rift", "abyss"), "requires": need("emb_source"), "kind": "combat",
            "enemies": [["flame_herald", 1], ["ember_titan", 1]],
            "success": step("傳令者熄滅了，火焰的號令斷了。前方，裂隙的最底下，一團比太陽還亮的火在跳動。", ["emb_herald"]),
            "fail": step("你們被燒得遍體鱗傷，可傳令者在泰坦倒下時失去了平衡，掉進了岩漿裡。前方，裂隙的最底下，一團比太陽還亮的火在跳動。", ["emb_herald"], [hp(-0.2)]),
        },
        {
            "id": "source", "title": "在餘燼裂隙的深淵層壓下魔焰之源",
            "text": "魔焰之源不是怪物，是原初魔焰本身——它沒有臉，也不會聽，只是燃燒、往上湧。一尊餘燼泰坦從它的火焰裡被生了出來。",
            "at": at_dun("ember_rift", "abyss"), "requires": need("emb_herald"), "kind": "combat",
            "enemies": [["heart_of_flame", 1], ["ember_titan", 1]],
            "success": step("魔焰之源沉了下去，火焰慢慢地退回了裂隙的最深處。它不會熄滅——半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。原初魔焰第一次湧出地面的那一刻，還會在這裡一次又一次地重演。", ["emb_calm"]),
            "fail": step("你們撐不住了，可魔焰之源在吞下泰坦之後，自己慢慢地退了下去——它燒夠了。它不會熄滅。半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。它還會再湧上來。", ["emb_calm"], [hp(-0.25)]),
        },
        {
            "id": "spark", "title": "決定要不要帶走一點原初魔焰",
            "text": "魔焰之源退下去之後，岩壁上留下了一點小小的火星——原初魔焰的一部分，在你的腳邊跳動。據說，帶著它的人，再也不會怕熱。",
            "at": at_dun("ember_rift", "abyss"), "requires": need("emb_calm"), "kind": "choice",
            "options": [
                {"label": "把火星留在裂隙", "success": done("你看著火星慢慢地沉回了岩壁裡。回到地面，薇洛妮卡在城堡的門口等你，手裡拿著一封信——莉莎爾的親筆：「謝謝你守住了魔族的心跳。」", ["emb_done", "emb_left"], [aff(VER, 15, "守住了城堡"), rep(DEMON, 15), mem("在餘燼裂隙的深淵層壓下了往上湧的魔焰之源，守住了血羽城堡。莉莎爾親筆寫信道謝。", 3)])},
                {"label": "帶走那一點火星", "success": done("火星鑽進了你的掌心，燙得你叫出聲，然後就不燙了。從那天起，你的手心總是暖的，再熱的地方也不覺得熱。薇洛妮卡看著你的手，笑了：「魔族的心跳，現在你也有一點了。」", ["emb_done", "emb_spark"], [aff(VER, 10, "守住了城堡"), rep(DEMON, 10), {"type": "perk", "perk": "fire_born", "options": ["thick_skin", "iron_will"]}, mem("在餘燼裂隙的深淵層壓下了魔焰之源，帶走了一點原初魔焰的火星。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 血岩深穴 ----------------
brc1 = {
    "id": "brc_bloodsworn_squires",
    "title": "血誓侍從",
    "summary": "寂墓聖堂外的墓地接連被盜，被挖走的都是遠古魔族戰士的骨頭。灰燼修會說，盜墓的人額頭上都有血誓的印記。（血岩深穴・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "guild", "location": "silent_tomb", "min_level": 5,
        "text": "公會的告示板上貼著灰燼修會的委託：「遠古戰士的墓地遭竊。盜墓者額有血誓之印，往血岩深穴的方向去了。尋回骸骨者，修會必有回報。」底下有一行歪歪扭扭的小字，像是莉菈寫的：「他們的骨頭在哭。」",
    },
    "start_flags": ["brc_start"],
    "nodes": [
        {
            "id": "graves", "title": "在寂墓聖堂的神殿聽遠古戰士的低語",
            "text": "灰燼修會的神殿裡，見習祭司莉菈把耳朵貼在空棺上：「他們說……有人在叫他們回去。回到古王的身邊。」",
            "at": at_cell("silent_tomb", "temple"), "requires": need("brc_start"), "kind": "check",
            "check": {"attr": "fai", "dc": 13},
            "success": step("你陪莉菈一起聽，聽見了：遠古的血誓還在。被血誓束縛的戰士，死了也要回到古王的身邊——有人在用新的血，重新喚醒那個誓約。", ["brc_oath"], [aff(LILA, 5, "陪她聽骨頭說話")]),
            "fail": step("你什麼也聽不見，莉菈替你轉述：「血誓……有人在用新的血，喚醒舊的血誓。」", ["brc_oath"]),
        },
        {
            "id": "middle", "title": "在血岩深穴的中層擋下血誓祭司",
            "text": "中層的血岩祭壇上，一個血誓祭司正在把偷來的骸骨排成一圈，用自己的血畫著法陣。兩個額頭上印著血誓的侍從擋在祭壇前。",
            "at": at_dun("bloodrock_cave", "middle"), "requires": need("brc_oath"), "kind": "combat",
            "enemies": [["blood_priest", 1], ["bloodsworn_squire", 2]],
            "success": step("祭司倒下了，法陣斷了。骸骨們安靜了下來。祭司的懷裡有一張紙：「古王的守衛不夠了。去找更多的骨頭。」", ["brc_bones"]),
            "fail": step("你們被逼退了，可祭司的法陣在你們撤退時自己斷了——骸骨不肯聽他的。你從地上撿到一張紙：「古王的守衛不夠了。」", ["brc_bones"], [hp(-0.15)]),
        },
        {
            "id": "return", "title": "決定骸骨的去處",
            "text": "骸骨堆在祭壇上，有幾十具。你們沒辦法全部帶回去。",
            "at": at_dun("bloodrock_cave", "middle"), "requires": need("brc_bones"), "kind": "choice",
            "options": [
                {"label": "帶回寂墓聖堂", "success": done("你帶回了能帶的骸骨。莉菈一具一具地替它們唸了安魂的祝禱，最後一具唸完的時候，她說：「他們說謝謝。還說……古王在等。」", ["brc_1_done", "brc_home"], [aff(LILA, 10, "替骸骨找回了家"), mem("從血岩深穴的中層帶回了被盜的遠古戰士骸骨，交給寂墓聖堂安葬。")])},
                {"label": "在祭壇上燒掉法陣，讓它們就地安息", "success": done("你燒掉了法陣，骸骨們在火光中化成了灰。灰燼飄進了深穴的更深處——往古王的方向。", ["brc_1_done"], [mem("在血岩深穴的中層燒掉了血誓祭司的法陣，被盜的骸骨化成了灰。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

brc2 = {
    "id": "brc_fallen_king",
    "title": "戰敗的古王",
    "summary": "大祭司艾瑟里昂說，血岩深穴的深層住著遠古魔族戰敗後避難的古王。他用血誓束縛所有的守衛——包括那些死了的。可是古王為什麼需要更多的守衛？（血岩深穴・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": AETH, "min_level": 8, "requires": need("brc_1_done"),
        "text": "艾瑟里昂說話慢得像在數心跳：「古王……守著一扇門。門後面……是比他更古老的東西。」他把一塊刻著血誓文字的石板交給你，「守衛不夠……代表門……快開了。去看看。」",
    },
    "start_flags": ["brc_king"],
    "nodes": [
        {
            "id": "tablet", "title": "在寂墓聖堂的無聲長廊讀懂血誓石板",
            "text": "無聲長廊裡，莉菈替你把石板上的血誓文字唸給死者聽，死者們再一個字一個字地翻譯給你。",
            "at": at_cell("silent_tomb", "lm_silent_corridor"), "requires": need("brc_king"), "kind": "check",
            "check": {"attr": "fai", "dc": 15},
            "success": step("你聽懂了：「吾以血誓，封背誓者於聖所之下。吾之守衛，代代不滅。」古王不是在避難——他在看守。遠古魔族戰敗，是因為有一位領主背棄了血誓。", ["brc_read"], [aff(AETH, 5, "讀懂了血誓")]),
            "fail": step("死者們說得太快，你只聽懂了一句：「封背誓者於聖所之下。」", ["brc_read"]),
        },
        {
            "id": "deep", "title": "在血岩深穴的深層通過血誓守衛",
            "text": "深層的聖所門前，血誓守衛和血誓騎士站成了一排。它們不攻擊你——直到你走近那扇門。古王坐在門前的王座上，閉著眼睛，一動也不動。",
            "at": at_dun("bloodrock_cave", "deep"), "requires": need("brc_read"), "kind": "combat",
            "enemies": [["bloodsworn_guard", 1], ["blood_knight", 1]],
            "success": step("守衛倒下了。門上的血誓紋路，有三道已經暗了——暗掉的紋路，正好是被你打倒的守衛的數量。古王睜開了眼睛，看著你，卻沒有動。", ["brc_door"]),
            "fail": step("你們被逼退了。在撤退時，你看見門上的血誓紋路，有好幾道已經暗了。王座上的古王睜開了眼睛。", ["brc_door"], [hp(-0.2)]),
        },
        {
            "id": "decide", "title": "決定怎麼告訴艾瑟里昂",
            "text": "你回到寂墓聖堂。艾瑟里昂聽完，很久沒有說話：「每倒下一個守衛……封印就弱一分。古王需要新的守衛。或者……新的血。」",
            "at": at_npc(AETH), "requires": need("brc_door"), "kind": "choice",
            "options": [
                {"label": "「灰燼修會能不能用白焰補封印？」", "success": done("艾瑟里昂點點頭：「白焰……可以燒掉背誓者的血。但要有人把它帶下去。」他看著你，「下一次，帶著白焰。」", ["brc_2_done", "brc_whiteflame"], [aff(AETH, 10, "想到了白焰"), mem("在血岩深穴的深層發現戰敗的古王是在看守封印背誓者的聖所。艾瑟里昂說可以用遺火塔的白焰補封印。")])},
                {"label": "「那就用我的血」", "success": done("艾瑟里昂看了你很久：「血誓……一旦立下，就不能解。」他把一把骨製的小刀交給你，「如果你決定了……古王會認得你的血。」", ["brc_2_done", "brc_bloodready"], [aff(AETH, 5, "願意付出"), mem("在血岩深穴的深層發現古王在看守背誓者的封印，你說願意用自己的血補封印。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

brc3 = {
    "id": "brc_first_oathbreaker",
    "title": "最初的背誓者",
    "summary": "血岩深穴最底下的聖所門開了。遠古魔族戰敗的真正原因——最初的背誓者——從門後走了出來。古王的守衛，已經不夠了。（血岩深穴・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "guild", "location": "silent_tomb", "min_level": 11, "requires": need("brc_2_done"),
        "text": "寂墓聖堂的鐘響了一整夜。公會的告示板上只有一張紙，是莉菈的字跡，寫得很急：「門開了。死者們在逃。艾瑟里昂大人說，請那個人來。」",
    },
    "start_flags": ["brc_open"],
    "nodes": [
        {
            "id": "paladins", "title": "在血岩深穴的深淵層擋下血誓聖騎",
            "text": "深淵層的聖所裡，血從牆上往下流。一個血誓聖騎和一團血肉恐魔擋住了通往門口的路——它們不是古王的守衛，是背誓者的。",
            "at": at_dun("bloodrock_cave", "abyss"), "requires": need("brc_open"), "kind": "combat",
            "enemies": [["blood_oath_paladin", 1], ["blood_horror", 1]],
            "success": step("聖騎倒下了。門口，古王的王座空了——他倒在門前，身上插滿了背誓者的血刃。他睜開眼睛看著你，然後又閉上了。", ["brc_king_down"]),
            "fail": step("你們被逼到了牆邊，可聖騎在追擊時被古王最後的守衛攔了下來。門口，古王倒在門前，身上插滿了血刃。", ["brc_king_down"], [hp(-0.2)]),
        },
        {
            "id": "oathbreaker", "title": "在血岩深穴的深淵層打倒最初的背誓者",
            "text": "最初的背誓者站在門口，身上的血誓紋路全都是反的。他不說話——背棄誓言的人，已經沒有能說出口的話了。一個血誓聖騎從他的影子裡站了起來。",
            "at": at_dun("bloodrock_cave", "abyss"), "requires": need("brc_king_down"), "kind": "combat",
            "enemies": [["first_oathbreaker", 1], ["blood_oath_paladin", 1]],
            "success": step("背誓者倒下了，被拖回了門後。可是聖所的半空中，遠古那場戰敗的殘影一閃而過——歷史之龍「回響編年」阿契隆的回響。這裡最深刻的過去還會重演，他也會一次又一次地從門後走出來。", ["brc_pushed"]),
            "fail": step("你們撐不住了，就在這時，倒在門前的古王用最後的力氣抓住了背誓者的腳，把他拖回了門後。半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。他還會一次又一次地從門後走出來。", ["brc_pushed"], [hp(-0.25)]),
        },
        {
            "id": "seal", "title": "重新封上聖所的門",
            "text": "門還開著。古王躺在門前，聲音很輕：「……誰來……守？」",
            "at": at_dun("bloodrock_cave", "abyss"), "requires": need("brc_pushed"), "kind": "choice",
            "options": [
                {"label": "用遺火塔的白焰封門", "requires": need("brc_whiteflame"),
                 "success": done("你打開了艾瑟里昂給你的燈，白焰落在了門上。背誓者的血誓紋路在白焰裡一道一道地燒乾淨了。門關上了。古王看著白焰，笑了：「……終於……可以休息了。」他閉上了眼睛——可是阿契隆的回響還會重演那場戰敗，下一次有人進來，他會重新坐在王座上。", ["brc_done", "brc_ashseal"], [aff(AETH, 20, "用白焰封住了背誓者"), aff(LILA, 15, "讓死者們不再逃"), rep(DEMON, 10), mem("在血岩深穴的深淵層打倒了最初的背誓者，用遺火塔的白焰重新封上了聖所的門。", 3)])},
                {"label": "用自己的血立誓守門", "success": done("你用骨刀割開了手掌，把血按在了門上。血誓的紋路認得你的血，一道一道地亮了起來。門關上了。古王看著你：「……新的……守衛。」從那天起，每當聖所的門鬆動，你都會感覺到手心在發燙。", ["brc_done", "brc_bloodseal"], [aff(AETH, 15, "替古王守住了門"), rep(DEMON, 15), hp(-0.2), {"type": "perk", "perk": "iron_will", "options": ["defiant", "thick_skin"]}, mem("在血岩深穴的深淵層打倒了最初的背誓者，用自己的血立誓守住了聖所的門。手心會在門鬆動時發燙。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

# ---------------- 地獄溫室 ----------------
ghs1 = {
    "id": "ghs_maneating_flowers",
    "title": "吃人的花",
    "summary": "血羽城堡近郊的地獄溫室，是一座被封存的魔導實驗場。最近，溫室的藤蔓爬出了圍牆，吃掉了兩頭牛和一個採藥人。（地獄溫室・一）",
    "rank": "D", "merit": 6,
    "start": {
        "kind": "informant", "location": "bloodplume", "price": 150, "min_level": 5,
        "text": "情報商的獨眼盯著你：「地獄溫室？那是陛下的禁地。」他壓低聲音，「藤蔓爬出來了。宮廷不想讓人知道，所以沒有發委託——可是被吃掉的那個採藥人，是腐沼村莫格婆婆的徒弟。婆婆出錢，找人進去燒藤。」",
    },
    "start_flags": ["ghs_start"],
    "nodes": [
        {
            "id": "map", "title": "在血羽城堡的情報商買溫室的舊地圖",
            "text": "情報商從櫃子底下拿出一張發霉的地圖：「溫室封存前的配置圖。噬魂花種在中層。藤蔓的根，從那裡長出來的。」",
            "at": at_cell("bloodplume", "informant"), "requires": need("ghs_start"), "kind": "check",
            "check": {"attr": "int", "dc": 13},
            "success": step("你看懂了地圖上的標記：溫室的每一層都種著不同的實驗植物，標籤上的字是魔族的古文，最上面一行寫著：「荒原綠化計畫」。", ["ghs_map"]),
            "fail": step("地圖上的字你一個也看不懂，只看得出中層有一個打了紅叉的區域。", ["ghs_map"], [money(-50)]),
        },
        {
            "id": "middle", "title": "在地獄溫室的中層燒掉噬魂花的根",
            "text": "中層的溫室裡，空氣又濕又甜，甜得讓人頭暈。一朵比人還大的噬魂花張開了花瓣，兩個藤傀儡從花下站了起來——其中一個，穿著採藥人的衣服。",
            "at": at_dun("hell_greenhouse", "middle"), "requires": need("ghs_map"), "kind": "combat",
            "enemies": [["soul_eater_bloom", 1], ["vine_puppet", 2]],
            "success": step("噬魂花燒了起來，藤傀儡倒下了。穿著採藥人衣服的那個藤傀儡裡，只剩下一個藥簍——簍子裡有一本筆記，最後一頁寫著：「這些花……本來是要讓荒原長出東西的。」", ["ghs_notes"]),
            "fail": step("你們被花粉逼退了，可在撤退前點燃了噬魂花的根。藤傀儡倒下了，留下一個藥簍，裡面有一本筆記：「這些花……本來是要讓荒原長出東西的。」", ["ghs_notes"], [hp(-0.15)]),
        },
        {
            "id": "back", "title": "把藥簍帶回給莫格婆婆",
            "text": "莫格婆婆看著那個藥簍，罵了一句很難聽的話，然後坐下來，很久沒有說話。最後她翻開筆記：「荒原綠化……這孩子，到死都在想著讓荒原長出東西。」",
            "at": at_npc(MORG), "requires": need("ghs_notes"), "kind": "choice",
            "options": [
                {"label": "「溫室裡也許有她想找的東西」", "success": done("莫格婆婆抬起頭，眼睛紅紅的：「……你是說，繼續找？」她把筆記塞給你，「那就替她找完。罵我也好，找完了再回來告訴我。」", ["ghs_1_done", "ghs_search"], [aff(MORG, 15, "替她的徒弟找下去"), mem("在地獄溫室的中層燒掉了吃人的噬魂花，帶回了莫格婆婆徒弟的遺物。筆記上寫著：這些花本來是要讓荒原長出東西的。")])},
                {"label": "「讓她安息吧」", "success": done("莫格婆婆點點頭，把藥簍掛在了門口：「笨蛋徒弟。」那天晚上，她免費替整個村子看了病。", ["ghs_1_done"], [aff(MORG, 10, "帶回了徒弟的遺物"), mem("在地獄溫室的中層燒掉了吃人的噬魂花，帶回了莫格婆婆徒弟的遺物。")])},
            ],
        },
    ],
    "rewards": [money(300), xp(450)],
}

ghs2 = {
    "id": "ghs_experiment_log",
    "title": "實驗記錄",
    "summary": "「荒原綠化計畫」——地獄溫室原本的名字。深層的實驗室裡，應該還留著當年的實驗記錄。總管薇洛妮卡說，那些記錄最好不要被人看見。（地獄溫室・二）",
    "rank": "C", "merit": 8,
    "start": {
        "kind": "npc", "npc": VER, "min_level": 8, "requires": need("ghs_1_done"),
        "text": "薇洛妮卡第一次在你面前把小冊子收起來了：「你在溫室裡找到了『荒原綠化』這四個字。」她的笑容很淡，「那是陛下年輕時的計畫。後來……失敗了。」她看著你，「深層的實驗記錄，我希望你帶回來給我。不要給任何人看。包括你自己。」",
    },
    "start_flags": ["ghs_log"],
    "nodes": [
        {
            "id": "keys", "title": "在血羽城堡的魔法物品店解開實驗室的封印",
            "text": "深層實驗室的門上有魔導封印。魔法物品店的老闆看了看你畫下的封印圖案，倒吸一口氣：「這是赤翼宮廷的皇家封印。要解開它，得用同樣的魔力頻率。」",
            "at": at_cell("bloodplume", "magic"), "requires": need("ghs_log"), "kind": "check",
            "check": {"attr": "int", "dc": 15},
            "success": step("你們花了一整天，調出了封印的頻率。老闆把一塊發著紅光的晶石交給你：「拿著它，門會以為你是陛下。」", ["ghs_key"]),
            "fail": step("你們調不出頻率。最後是薇洛妮卡派人送來了一塊紅色的晶石，上面附了一張紙條：「我說過，不要給任何人看。」", ["ghs_key"]),
        },
        {
            "id": "deep", "title": "在地獄溫室的深層找到實驗記錄",
            "text": "深層的實驗室裡，一棵會低語的樹佔據了半個房間，樹根纏著一個寄魂宿主——一具被植物寄生的魔族研究員的屍體，還在動。",
            "at": at_dun("hell_greenhouse", "deep"), "requires": need("ghs_key"), "kind": "combat",
            "enemies": [["parasite_host", 1], ["experiment_chimera", 1]],
            "success": step("宿主倒下了。你在實驗台上找到了一本厚厚的實驗記錄，封面上蓋著赤翼的印。最後一頁是莉莎爾的親筆：「我想讓南境的孩子不再挨餓。我錯了。封存一切。」", ["ghs_found"]),
            "fail": step("你們被逼退了，可在撤退前搶下了實驗台上的記錄本。最後一頁是莉莎爾的親筆：「我想讓南境的孩子不再挨餓。我錯了。封存一切。」", ["ghs_found"], [hp(-0.2)]),
        },
        {
            "id": "give", "title": "決定實驗記錄的去處",
            "text": "記錄本沉甸甸的。你知道，裡面寫著一個魔王年輕時最大的失敗——也寫著一個讓荒原長出東西的方法，只是還沒有成功。",
            "at": at_npc(VER), "requires": need("ghs_found"), "kind": "choice",
            "options": [
                {"label": "照約定交給薇洛妮卡", "success": done("薇洛妮卡接過記錄本，沒有打開：「謝謝你。」她把它鎖進了小冊子旁邊的抽屜，「陛下知道你拿回來了。她說……下一次，讓你看完。」", ["ghs_2_done", "ghs_veronica"], [aff(VER, 20, "守住了陛下的秘密"), rep(DEMON, 5), mem("從地獄溫室的深層帶回了「荒原綠化計畫」的實驗記錄，交給了薇洛妮卡，沒有打開。")])},
                {"label": "交給莫格婆婆，讓她看看能不能救", "success": done("莫格婆婆看了三天三夜的記錄，最後抬起頭：「這個人，差一步就成功了。」她把記錄本還給你，「錯的不是方法，是種子——種子是活的，它在等。」薇洛妮卡後來知道了，什麼也沒說，只在小冊子上記了一筆。", ["ghs_2_done", "ghs_morg"], [aff(MORG, 20, "讓她看了記錄"), aff(VER, -5, "沒有照約定"), mem("把地獄溫室的實驗記錄交給了莫格婆婆。她說，錯的不是方法，是種子——種子是活的，它在等。")])},
            ],
        },
    ],
    "rewards": [money(600), xp(900)],
}

ghs3 = {
    "id": "ghs_first_experiment",
    "title": "第零號實驗體",
    "summary": "地獄溫室失控的起點：莉莎爾封存的第一個實驗——第零號實驗體。溫室之心只是它長出的一朵花。它醒了，藤蔓爬到了血羽城堡的城牆下。（地獄溫室・三）",
    "rank": "B", "merit": 10,
    "start": {
        "kind": "npc", "npc": VER, "min_level": 11, "requires": need("ghs_2_done"),
        "text": "薇洛妮卡站在城牆上，看著溫室的方向——藤蔓像潮水一樣湧了過來：「第零號醒了。」她的聲音很平靜，「陛下要親自去燒。我說服她，讓你去。」她頓了頓，「因為你知道它是什麼。它不是怪物——它是一顆想讓荒原長出東西的種子，長錯了。」",
    },
    "start_flags": ["ghs_zero"],
    "nodes": [
        {
            "id": "vines", "title": "在地獄溫室的深淵層擋下靈魂寄生藤",
            "text": "深淵層的溫室穹頂已經被藤蔓撐破了。一條靈魂寄生藤和一隻合成獸原型擋在通往核心的路上——藤蔓上掛著被吸乾的魔力結晶，像一串串的果實。",
            "at": at_dun("hell_greenhouse", "abyss"), "requires": need("ghs_zero"), "kind": "combat",
            "enemies": [["soul_vine", 1], ["chimera_prototype", 1]],
            "success": step("寄生藤枯萎了。前方，溫室的最深處，有一棵很小很小的樹——小得像一株幼苗，根卻延伸到了整座溫室。", ["ghs_core"]),
            "fail": step("你們被藤蔓纏住了，可合成獸在掙扎時扯斷了寄生藤的主根。前方，溫室的最深處，有一棵很小很小的樹。", ["ghs_core"], [hp(-0.2)]),
        },
        {
            "id": "zero", "title": "在地獄溫室的深淵層打倒第零號實驗體",
            "text": "第零號實驗體不說話，也不聽——它只會長。整座溫室都是它的根，每一根藤蔓都在往你身上纏。一隻合成獸原型從它的根下爬了出來。",
            "at": at_dun("hell_greenhouse", "abyss"), "requires": need("ghs_core"), "kind": "combat",
            "enemies": [["first_experiment", 1], ["chimera_prototype", 1]],
            "success": step("第零號的藤蔓縮了回去，溫室的穹頂下落了一場枯葉的雨。可它的根還在，而且半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。溫室封存前的那一天還會重演，它也會重新長出來。幼苗的頂端，結了一顆小小的、發著綠光的種子。", ["ghs_seed"]),
            "fail": step("你們撐不住了，可第零號在吞下合成獸之後，自己慢慢地縮了回去——它長夠了。它的根還在。半空中閃過一層層交錯的殘影——歷史之龍「回響編年」阿契隆的回響。它還會再長出來。幼苗的頂端，結了一顆小小的、發著綠光的種子。", ["ghs_seed"], [hp(-0.25)]),
        },
        {
            "id": "choose", "title": "決定那顆種子的去處",
            "text": "那顆種子在你的手心裡，暖暖的，像是在呼吸。這是第零號長了三百年，終於長出來的東西。",
            "at": at_dun("hell_greenhouse", "abyss"), "requires": need("ghs_seed"), "kind": "choice",
            "options": [
                {"label": "交給莫格婆婆種在腐沼村", "success": done("莫格婆婆把種子種在了變異藥沼的正中央。一個月後，沼地裡長出了一片綠色的草——不會動、不會冒泡、不吃人，只是綠的。腐沼村的孩子們第一次看見了「普通的草」。薇洛妮卡把這件事告訴了莉莎爾，莉莎爾在那天晚上，一個人喝了一整瓶酒。", ["ghs_done", "ghs_planted"], [aff(MORG, 25, "讓荒原長出了綠草"), aff(VER, 15, "完成了陛下的心願"), rep(DEMON, 15), mem("在地獄溫室的深淵層打倒了第零號實驗體，把它長出的種子交給莫格婆婆種在腐沼村。荒原長出了第一片普通的草。", 3)])},
                {"label": "交給薇洛妮卡，讓莉莎爾決定", "success": done("薇洛妮卡捧著種子，很久沒有說話。第二天，宮廷的園丁在血羽城堡的中庭種下了它。莉莎爾每天早上都會去看它一眼——那是魔王唯一不讓任何人跟著的時候。", ["ghs_done", "ghs_palace"], [aff(VER, 25, "把種子交給了陛下"), rep(DEMON, 15), mem("在地獄溫室的深淵層打倒了第零號實驗體，把它長出的種子交給了莉莎爾，種在血羽城堡的中庭。", 3)])},
            ],
        },
    ],
    "rewards": [money(1500), xp(2000)],
}

BATCH13 = [pit1, pit2, pit3, echo1, echo2, echo3, gnt1, gnt2, gnt3, emb1, emb2, emb3, brc1, brc2, brc3, ghs1, ghs2, ghs3]
