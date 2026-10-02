# 用 Claude Code 排旅行

Claude Code 是 Anthropic 做的 AI agent，用你的 Claude 帳號登入。跟一般聊天不一樣的是：**它可以在你的電腦上做事**——
上網查、跑小程式去抓資料、把行程存成檔案。裝上這個旅行 skill，它就會照固定的流程幫你排：先問你、再查、給你看大綱，最後做成行程頁和 PDF。

> 還沒有 Claude Code、只想先試試看？用 [ChatGPT 複製貼上版](chatgpt-prompt.md)，不用安裝。

---

## 你需要

- **Claude 付費方案**（Pro 以上）。
- **一台電腦**（Mac 或 Windows）。
- **[Node.js](https://nodejs.org/) 18 以上**：做行程頁用。安裝時選官網標「LTS」的版本就好。
- **Chrome**：自動把行程頁印成 PDF 用。沒有也可以，自己用瀏覽器列印。

## 第一次安裝（大約 10 分鐘）

**1 · 裝 Claude Code**（官方說明：[Quickstart](https://code.claude.com/docs/en/quickstart)）
- Mac：打開「終端機」，貼上 `curl -fsSL https://claude.ai/install.sh | bash`
- Windows：打開「PowerShell」，貼上 `irm https://claude.ai/install.ps1 | iex`

**2 · 開一個放行程的資料夾**
在桌面建一個資料夾，例如「我的旅行」，在這個資料夾打開終端機（Windows 是 PowerShell）。**以後每次排行程，都在這個資料夾打開 Claude Code。**

**3 · 啟動 Claude Code**
貼上 `claude --model opus --effort high`。第一次會請你登入。為什麼用這兩個設定，見下面「用哪個模型」。

**4 · 把 skill 裝進去**
把這段貼給它：

```text
幫我安裝這個旅行 skill：
https://github.com/dustynotesai/dustynotesai/tree/main/travel/travel-planner
請把整個 travel-planner 資料夾（包含 agents、references、scripts）
放到這個資料夾的 .claude/skills/travel-planner。
如果已經有同名 skill，先告訴我，再決定要不要更新。
```

它要寫進 `.claude` 資料夾的時候會先問你，按允許就好。裝好就能用，不用重開。

**想自己裝也可以：** 這個 repo 首頁右上角綠色的「Code」→「Download ZIP」，解壓縮，把 `travel/travel-planner` **整個資料夾**
複製到「我的旅行」裡面的 `.claude/skills/`（沒有這兩層資料夾就自己建），最後的樣子是：

```
我的旅行/
└── .claude/
    └── skills/
        └── travel-planner/
            ├── SKILL.md
            ├── agents/
            ├── references/
            └── scripts/
```

不要只複製 `SKILL.md`，也不要多包一層資料夾。`.claude` 開頭有一個點，Mac 的 Finder 預設看不到，按 `Command + Shift + .` 就會出現。

**5 · 確認裝好了**
問它一句：

```text
你現在有沒有 travel-planner 這個 skill？
```

回答「有」就裝好了。回答沒有的話，看下面的「常見問題」。

## 開始排

```text
幫我排一趟去 ＿＿ 的旅行
```

接下來：

1. **它會先問你幾題**：日期、幾個人、價格用哪個幣別、預算、步調、哪些訂好了。答完才會繼續，這個停頓是故意的。
   不想一題一題答，[`prompts.md`](prompts.md) 有「一次講完」的版本可以整段複製。
2. **它會去查**。查之前會先說要查哪幾樣，查比較久的時候會報進度。
3. **中途會問你「要不要允許」**：它要上網、跑一個小程式去抓時刻表資料、或寫檔案的時候，Claude Code 會先問你。
   看一下它說要做什麼——**查資料、存行程的就按允許**。這個 skill 不會叫它登入任何網站、不會付款、不會替你訂東西。
4. **先給你看大綱**，你說好了才寫完整版。
5. **做好之後**打開 `trips/<城市>-<年-月>/trip.html`，手機、電腦都能看；要印出來帶著走，用同一個資料夾裡的 `trip.pdf`。
   它也會在對話裡貼一張「出發前自己對的清單」，出發前照著一行一行打勾。

一整趟從頭到尾大概要十幾分鐘到幾十分鐘，中間會停下來問你幾次。

## 用哪個模型？建議 Opus

| | **Opus（建議）** | Sonnet |
|---|---|---|
| 查資料 | 查得比較多：我們排練四天的東京行程，Opus 搜尋、讀網頁約 77 次 | 查得比較少、比較快：同樣四天（行程內容不同）約 40 次 |
| 會不會寫錯 | **會。** 我們拿它排的一份行程抽查 31 項：22 項完全正確，價格沒有寫錯，但有幾處小地方不準——一家餐廳其實不能訂位、開放時間的月份區間寫錯、一句轉乘備註寫得會讓人誤會。另一份東京行程抽查 43 項，**有 7 項錯**：SHIBUYA SKY 票價寫成舊價、機場到飯店的車資少算一段、一個山手線的方向寫反，有幾格還標了「已查證」 | **會。** 我們測的時候，它把一段地鐵轉乘憑記憶寫錯了，後來只改好其中一天 |
| 用量 | 比較吃方案額度 | 比較省，Pro 方案比較不容易用完 |

**為什麼建議 Opus**：這個 skill 的重點就是「查過才寫，查不到就老實標未驗證」。Opus 查得比較多，所以建議用它。
**但不管用哪個模型，行程都可能有錯**——出發前一定要照清單自己再對一次（見[旅行說明](README.md)最後一段「出發前一定要自己確認」）。

**用 Sonnet 也可以**：用 `claude --model sonnet --effort high` 啟動。拿到行程後自己多讀一遍，看到怪怪的（例如轉乘、票價）直接叫它再查一次。

**`--effort high` 是什麼**：讓它想得比較完整、查得比較多，建議不要調低。不確定現在用的是哪個模型，在 Claude Code 裡輸入 `/model` 就看得到。

## 常見問題

**問它有沒有 travel-planner，它說沒有**
- 確認你是在「我的旅行」資料夾裡啟動 Claude Code 的。skill 只裝在這個資料夾，在別的地方打開就看不到。
- 確認路徑是 `我的旅行/.claude/skills/travel-planner/SKILL.md`，中間沒有多一層資料夾。

**它說查不到某一班車，標「未驗證」**
正常。很多國家的官方時刻表要在網頁上一直點才查得到，它不一定拿得到。它會附上官方查詢頁，清單上也會寫「出發前自己查這一班」，照著查就好。

**沒有 PDF**
大多是沒裝 Chrome。用瀏覽器打開 `trip.html` → 列印 → 另存成 PDF，版面是排好的。

**想改行程**
直接跟它說要改什麼，例如「第三天太趕，刪一個點」。它只改受影響的地方，重新做頁面。

**要更新 skill**
把 `.claude/skills/travel-planner` 整個資料夾換成新版的就好。舊的行程在 `trips/` 裡，不會被動到。
