# 用 Codex 排旅行

Codex 是 OpenAI 做的 AI agent，用你的 ChatGPT 帳號登入。跟一般 ChatGPT 對話不一樣的是：**它可以在你的電腦上做事**——
上網查、跑小程式去抓資料、把行程存成檔案。裝上這個旅行 skill，它就會照固定的流程幫你排：先問你、再查、給你看大綱，最後做成行程頁和 PDF。

> 還沒有 Codex、只想先試試看？用 [ChatGPT 複製貼上版](chatgpt-prompt.md)，不用安裝。

---

## 你需要

- **能使用 Codex 的 ChatGPT 付費方案**。可以用多少，以你自己的方案為準。不需要另外申請 API key。
- **一台電腦**（Mac 或 Windows）。
- **[Node.js](https://nodejs.org/) 18 以上**：做行程頁用。安裝時選官網標「LTS」的版本就好。
- **Chrome**：自動把行程頁印成 PDF 用。沒有也可以，自己用瀏覽器列印。

## 第一次安裝（大約 10 分鐘）

**1 · 裝 Codex**
照 [OpenAI 快速入門](https://learn.chatgpt.com/docs/quickstart) 裝桌面 app，用 ChatGPT 帳號登入，選 Codex。
已經在用 Codex CLI 或 VS Code 擴充套件的，也可以直接用。

**2 · 開一個放行程的資料夾**
在桌面建一個資料夾，例如「我的旅行」，在 Codex 裡打開它。**以後每次排行程，都開這個資料夾。**

**3 · 把 skill 裝進去**
把下面這段整段貼給 Codex：

```text
幫我安裝這個旅行 skill：
https://github.com/dustynotesai/dustynotesai/tree/main/travel/travel-planner
請把整個 travel-planner 資料夾（包含 agents、references、scripts）
放到目前工作資料夾的 .agents/skills/travel-planner。
如果已經有同名 skill，先告訴我，再決定要不要更新。
```

它要下載、建資料夾的時候會先問你，按允許就好。

**想自己裝也可以：** 這個 repo 首頁右上角綠色的「Code」→「Download ZIP」，解壓縮，把 `travel/travel-planner` **整個資料夾**
複製到「我的旅行」裡面的 `.agents/skills/`，最後的樣子是：

```
我的旅行/
└── .agents/
    └── skills/
        └── travel-planner/
            ├── SKILL.md
            ├── agents/
            ├── references/
            └── scripts/
```

不要只複製 `SKILL.md`，也不要多包一層資料夾。`.agents` 開頭有一個點，Mac 的 Finder 預設看不到，按 `Command + Shift + .` 就會出現。

**4 · 確認裝好了**
在 Codex 問一句：

```text
你現在有沒有 travel-planner 這個 skill？
```

回答「有」就裝好了。回答沒有的話，看下面的「常見問題」。

## 先開好權限（很重要）

這個 skill 要讓 Codex **讀 skill 的檔案、跑小程式抓時刻表、把行程頁和 PDF 存進資料夾**。權限沒開，它會說「權限擋住」，然後改給你一個網頁連結，**沒有 HTML 和 PDF**。

- **用 Codex CLI（終端機）**：在「我的旅行」資料夾，用這一行啟動：

  ```
  codex --approve-for-me
  ```

  它要執行指令的時候，會由 Codex 的自動審核替你判斷、放行一般的讀檔和寫檔。我們就是這樣測的（Windows），行程頁和 PDF 都做得出來。
- **用 Codex 桌面 app 或 VS Code**：在對話框附近的權限設定，選「可以在這個資料夾執行指令」或「自動審核」那一類的選項，不要選唯讀；
  跳出「要不要允許」時，查資料、存檔案的按允許。

## 開始排

```text
請用 travel-planner 幫我排一趟去 ＿＿ 的旅行
```

（Codex CLI 或 VS Code 裡也可以打 `$travel-planner 幫我排一趟去 ＿＿ 的旅行`。）

接下來：

1. **它會先問你幾題**：日期、幾個人、價格用哪個幣別、預算、步調、哪些訂好了。答完才會繼續，這個停頓是故意的。
   不想一題一題答，[`prompts.md`](prompts.md) 有「一次講完」的版本可以整段複製。
2. **它會去查**。查之前會先說要查哪幾樣。
3. **中途會跳出「要不要允許」的視窗**：它要上網、或跑一個小程式去抓時刻表資料的時候，Codex 會先問你。
   看一下它說要做什麼——**查資料的就按允許**。這個 skill 不會叫它登入任何網站、不會付款、不會替你訂東西。
4. **先給你看大綱**，你說好了才寫完整版。
5. **做好之後**打開 `trips/<城市>-<年-月>/trip.html`，手機、電腦都能看；要印出來帶著走，用同一個資料夾裡的 `trip.pdf`。
   它也會在對話裡貼一張「出發前自己對的清單」，出發前照著一行一行打勾。

一整趟從頭到尾大概要十幾分鐘到幾十分鐘，中間會停下來問你幾次。

## 用哪個模型？

**用 Codex 預設的就好。** 影片裡的測試用的是 GPT-6-Sol，推理強度沒有調，維持預設。
想要它查得更仔細，可以在 Codex 裡把推理強度調高，代價是比較慢、比較吃額度。

**不管用哪個模型，行程都可能有錯。** 出發前一定要照清單自己再對一次（見[旅行說明](README.md)最後一段「出發前一定要自己確認」）。

## 常見問題

**它說「權限擋住」「讀不到 skill」，或給你一個 chatgpt.com 的網頁連結，而不是 `trip.html`**
權限沒開，它讀不到 skill、也存不了檔案。照上面「先開好權限」重開一次 Codex 再排。

**問它有沒有 travel-planner，它說沒有**
- 重開 Codex，確認它打開的是「我的旅行」資料夾，不是別的資料夾。
- 確認路徑是 `我的旅行/.agents/skills/travel-planner/SKILL.md`，中間沒有多一層資料夾。

**它說查不到某一班車，標「未驗證」**
正常。很多國家的官方時刻表要在網頁上一直點才查得到，它不一定拿得到。它會附上官方查詢頁，清單上也會寫「出發前自己查這一班」，照著查就好。

**沒有 PDF**
大多是沒裝 Chrome。用瀏覽器打開 `trip.html` → 列印 → 另存成 PDF，版面是排好的。

**想改行程**
直接跟它說要改什麼，例如「第三天太趕，刪一個點」。它只改受影響的地方，重新做頁面。

**要更新 skill**
把 `.agents/skills/travel-planner` 整個資料夾換成新版的就好。舊的行程在 `trips/` 裡，不會被動到。
