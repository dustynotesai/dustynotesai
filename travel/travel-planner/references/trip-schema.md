# trip.json

行程頁的資料。一份 trip.json 就是一整頁：表頭、每天的簡報、一格一格、最後的連結。
`node scripts/build.mjs trip.json` 把它變成 trip.html；沒有 Node 就貼進 `scripts/template.html`。

**頁面上看得到的東西都從這裡來，但有幾樣是頁面自己算的，不要寫進來：**
標籤（已訂、需預約、待確認、備選、已取消、沒去）、「出發前要處理」清單與每日待處理項數、表頭的日期、
每一段城市照片旁邊的日期、封面照片下「查看 M/D … 行程」的連結文字。

**不放進來的：** email 連結、訂單號、確認號、票券條碼、同行者姓名、每天打分數、規劃統計。
build.mjs 看到 `mail.google.com` 或 `mail` 欄位會直接擋下來。

欄位標 **必填** 的缺了，build.mjs 會停下來列出清單，一次改完。

**放在哪裡：一趟一個資料夾** `trips/<城市>-<YYYY-MM>/trip.json`。build 會把 `trip.html`、`trip.pdf`、`photos/` 寫在同一個資料夾。
下次排同一個地方，skill 會讀舊的 `trip.json`：`plan` 是「已到訪」的格子預設不再推薦——所以旅行回來記得把去過的改成「已到訪」、沒去的改成「沒去」。

---

## 最外層

```json
{
  "schema": 1,
  "meta": { },
  "photos": { },
  "sections": [ ],
  "days": [ ],
  "links": { }
}
```

| 欄位 | | 說明 |
|---|---|---|
| `schema` | **必填** | 固定寫 `1` |
| `meta` | **必填** | 表頭，見下面 |
| `photos` | | 照片，`id → 照片`。沒有照片可以不寫 |
| `sections` | **必填** | 城市分段，每一天都要在剛好一段裡 |
| `days` | **必填** | 每一天，照 `n` 由小到大 |
| `links` | | 交通與售票連結、app |

---

## meta — 表頭

```json
"meta": {
  "title": "<城市>五天",
  "subtitle": "一份 agent 排的行程表",
  "example_label": "範例：旅客是設定的，查的東西是真的",
  "page_title": "<城市>五天 · 行程表",
  "description": "<YYYY> 年 <M> 月 <D> 日到 <D> 日，<城市>。",
  "origin": "<出發城市>",
  "start": "2027-03-10",
  "end": "2027-03-14",
  "travellers": { "count": 2, "who": "情侶" },
  "pace": "平均",
  "wants": ["美食", "拍照"],
  "defaults": ["步調：沒回答，用平均"],
  "booked": [{ "what": "去程航班", "date": "2027-03-10" }],
  "currency": {
    "home": "USD",
    "local": ["JPY"],
    "rates": [{ "from": "JPY", "to": "USD", "rate": 0.0066, "date": "2026-11-01", "source": "https://…" }]
  },
  "budget": { "per_person_per_day": 150, "excludes": "機票、住宿" },
  "researched_with": ["WebSearch", "WebFetch"],
  "checked_on": "2026-11-01",
  "cover": { "photo": "landmark", "caption": "<區域> · <景點>", "day": 2 },
  "route": [{ "name": "<城市>", "dates": "03.10–14", "day": 1 }],
  "notice": "這是一份大綱，給你一個全貌：用什麼 app、哪些地方值得去。不是每個點都要去，去不去照當下的感覺決定。這是第一版，不是定案：看完想改哪裡，直接跟 agent 說，它會改好重建。班次、開放時間與票價出發前再確認。",
  "downloads": [{ "label": "下載空白模板（Markdown）", "href": "travel-template.md" }],
  "prep": [
    { "item": "護照", "detail": "效期要超過回程日 6 個月（未驗證的話寫未驗證）" },
    { "item": "入境規定", "detail": "<依他的護照查：免簽幾天、要不要先線上登錄>", "link": "https://…" },
    { "item": "國際駕照", "detail": "<M/D> 租車要帶，出發前在居住地辦" }
  ]
}
```

| 欄位 | | 說明 |
|---|---|---|
| `title` | **必填** | 大標題 |
| `subtitle` | | 標題下面那一行 |
| `example_label` | | 標題下面的小字，範例才寫 |
| `page_title` | | 瀏覽器分頁上的名字，沒寫就用 `title` |
| `description` | | 分享連結時的摘要 |
| `origin` | | 從哪裡出發（面談第 1 題）。頁面不直接顯示，路線裡要寫就寫在 `route` |
| `start` / `end` | **必填** | `YYYY-MM-DD`。第一天的 `date` 要等於 `start`，最後一天等於 `end` |
| `travellers.count` | **必填** | 幾個人，正整數。每人價和總額分開算靠它 |
| `travellers.who` | | 情侶／家人帶小孩／朋友／一個人 |
| `pace` | | 滿檔／平均／放空不用腦 |
| `wants` | | 最想要的三樣 |
| `defaults` | | 沒回答的題目用了什麼預設值，一條一句 |
| `booked` | | 已經訂好的骨架：`{ "what", "date" }` |
| `currency.home` | **必填** | 他選的幣別。**單獨問，不從語言猜** |
| `currency.local` | **必填** | 當地幣，陣列。沒有就寫 `[]` |
| `currency.rates` | | 每一個當地幣一筆，見下面 |
| `budget` | | `per_person_per_day` 用 `home` 幣別，`excludes` 寫不含什麼 |
| `researched_with` | | 這一版用了哪些工具查 |
| `checked_on` | | 最後核對日期 |
| `cover` | | 封面：`photo` 是 photos 的 id；`caption` 用「 · 」分兩段；`day` 讓連結跳到那一天 |
| `route` | | 封面下的路線：`name`、`dates`（照你想顯示的寫，例如 `"07.25–28"`）、`day` |
| `notice` | | 表頭說明。**第一句會加粗**，所以第一句寫最重要的那句 |
| `downloads` | | 表頭的下載連結 `{ "label", "href" }`。PDF 的連結 build.mjs 會自己加 |
| `prep` | | 出發前要準備：`{ "item", "detail", "link" }`，`item` 必填、`link` 要是官方網址。簽證或入境許可、護照效期、租車的國際駕照、保險、要先買的交通卡或聯票。**依他的護照和行程查過才寫**，查不到寫未驗證 |

### 匯率

```json
{ "from": "JPY", "to": "USD", "rate": 0.0066, "date": "2026-11-01", "source": "https://…" }
```

- `local` 裡的每一個幣別都要有一筆，不然 build 不過。
- `rate` 是查的數字，`date` 是查的那天，`source` 是在哪裡查的。
- **查不到就寫 `"rate": "未驗證"`**，不要寫一個大概的數字。這時候那個幣別的費用不能換算成
  `home`，只寫當地幣。

---

## photos — 照片

```json
"photos": {
  "landmark": { "commons": "File:<Commons 上的檔名>.jpg", "alt": "<照片裡是什麼>" },
  "hotel":   { "file": "img/hotel.jpg", "alt": "", "author": "自己拍的", "license": "保留所有權利" }
}
```

| 欄位 | | 說明 |
|---|---|---|
| id | | 英數字、`-`、`_`。`cover`、`sections[].photo`、`rows[].photo` 用它 |
| `commons` | 二選一 | Wikimedia Commons 的檔名，`File:` 開頭。build 會抓 800px 左右的版本、存在 trip.json 旁邊的 `photos/`、自動寫作者和授權 |
| `file` | 二選一 | 本機圖片，路徑相對於 trip.json |
| `alt` | | 描述圖片內容。城市分段的大圖是裝飾，alt 會留空 |
| `author` / `license` / `source` | | `commons` 會自動填。`file` 要自己寫，沒寫 build 會提醒——**公開之前要補** |

照片會變成 data URI 塞進 trip.html，離線也看得到。一張抓不到只是警告，頁面改用 Commons 的網址。
**只用 Commons 的照片**，不要從網路上隨便抓。

---

## sections — 城市分段

```json
"sections": [
  { "name": "<區域甲>、<區域乙>", "latin": "<Area A · Area B>", "days": [1, 2], "photo": "landmark" },
  { "name": "巴黎", "latin": "Paris", "days": [0, 1, 2, 3], "photo": "sacre-coeur",
    "lead_days": [0], "lead_heading": "Day 0，飛行日" }
]
```

| 欄位 | | 說明 |
|---|---|---|
| `name` | **必填** | 大圖下面的標題 |
| `latin` | | 旁邊的小字 |
| `days` | **必填** | 這一段有哪幾天（`n`）。每一天剛好在一段裡 |
| `photo` | **必填** | photos 的 id。每一段城市都要有一張圖 |
| `dates` | | 旁邊的日期，沒寫就用第一天和最後一天算：`7/24 – 7/27` |
| `lead_days` | | 排在大圖**前面**的天，例如還在飛機上的 Day 0 |
| `lead_heading` | | 給螢幕報讀器的標題，畫面上看不到 |

---

## days — 每一天

```json
{
  "n": 2,
  "date": "2027-03-11",
  "city": "<區域甲> → <區域乙>",
  "title": "<景點甲>與<景點乙>",
  "brief": {
    "route": ["09:00", "12:00", "14:00"],
    "stay": "<飯店名稱>",
    "fixed": ["14:30"],
    "attention": "<那一天查到的一件事>；<景點乙> 14:30 定時票查詢時有位（<查詢日>）。"
  },
  "rows": [ ]
}
```

| 欄位 | | 說明 |
|---|---|---|
| `n` | **必填** | Day 幾。頁面顯示兩位數：`02` |
| `date` | **必填** | `YYYY-MM-DD`，一天接一天，不能跳 |
| `city` | **必填** | 左邊日期欄和每天標題旁的城市，移動日寫 `A → B` |
| `title` | **必填** | 這一天的標題 |
| `brief.route` | **必填** | 主線：照順序的重點站，寫**那一格的 `time`**。已取消、沒去的格子頁面會略過 |
| `brief.stay` | **必填** | 今晚住哪 |
| `brief.fixed` | **必填** | 時間節點：班次、定時票、訂位，寫那一格的 `time`。沒有就 `[]`，頁面寫「無另列定時節點」 |
| `brief.attention` | **必填** | 先留意：**一件事，查過的** |
| `rows` | **必填** | 這一天的每一格，照時間排 |

`route` 和 `fixed` 裡的時間對不到任何一格，build 不過。

**雨天備案**：看天氣的那一天，`brief.attention` 寫「下雨改 ＿＿」，並加一格 `plan: "備選"` 的雨天行程
（`act` 開頭寫「雨天備案：」），時間**緊接在它要替代的那一格後面**——同一天不能有兩格同一個時間，
例如替代 09:00 那格就寫 09:05。

---

## rows — 一格

```json
{
  "time": "14:30",
  "act": "<景點乙>（定時票）",
  "short": "<景點乙>",
  "type": "景點",
  "city": "<城市>",
  "plan": "規劃中",
  "booking": "需預約",
  "cost": { "per_person": "¥1,000／人", "currency": "JPY", "home": "約 US$7", "total": "¥2,000／2 人" },
  "essential": "14:20 到正門，帶電子票。查詢時有位（<查詢日>）。",
  "notes": ["選 14:30 的理由。", "替代：<附近的另一個點>。"],
  "map": "https://www.google.com/maps/search/?api=1&query=<景點乙>",
  "ticket": "https://…官方售票…",
  "verified": true,
  "sources": ["https://…官方網站…"],
  "photo": "landmark"
}
```

| 欄位 | | 說明 |
|---|---|---|
| `time` | **必填** | `HH:MM`，當地時間。同一天不能有兩格同一個時間 |
| `act` | **必填** | 活動名稱，一行 |
| `short` | | 簡報裡用的短名字。沒寫就取 `act` 括號前面那一段 |
| `type` | **必填** | 交通／景點／美食／拍照／住宿／購物 |
| `city` | | 城市 |
| `plan` | **必填** | 行程狀態：規劃中／備選／已取消／沒去／已到訪。**只有真的走過才標已到訪** |
| `booking` | **必填** | 訂位狀態：未訂／需預約／已訂／待確認。**有確認信才算已訂**；只有付款授權、只有預先入住登記 → 待確認 |
| `cost` | **必填** | 見下面 |
| `essential` | 二選一 | 必要指示：看手機就能照做的一兩句。**理由不放這裡** |
| `notes` | 二選一 | 原始備註與改動：理由、替代方案、查證來源、改過什麼。頁面上收合 |
| `map` | 有地點的**必填** | 地圖連結。景點／美食／拍照／住宿／購物一定要有；交通、以及 `city` 是 `Transit` 的格子不用。<br>座標最好：`?api=1&query=<緯度>,<經度>`；沒有就寫 `?api=1&query=<地點名> <城市>`。<br>**只收 `google.com/maps/search/`**——`/maps/place/` 帶 CID 的和短網址沒查過就是編的 |
| `ticket` | | **官方**售票網址，不是搜尋結果 |
| `verified` | **必填** | 這一格的數字和連結這次有沒有用工具查過：`true`／`false` |
| `sources` | | 查證用的網址 |
| `photo` | | photos 的 id，小圖放在必要指示下面 |

`essential` 和 `notes` 至少要有一個。只有 `notes` 的格子，備註直接顯示不收合。

備註裡的 ✅ ⚠️ ❗ ❌ ⭐ 📸 會變成小圖示，其他 emoji 拿掉；`Ticket: 網域` 會變成等寬字的網域。

### 標籤怎麼來的（不要自己寫）

1. `plan` 是已取消或沒去 → 只有這一個標籤，劃掉，簡報略過，PDF 不印。
2. 否則看 `booking`：待確認 → 「待確認」；已訂 → 「✓已訂」；需預約 → 「需預約」；未訂 → 沒有。
3. 再加上 `plan`：備選 → 「備選」；已到訪 → 「已到訪」。

### cost — 費用

**先寫當地幣、每人。** 換算成 `home` 一律標「約」。每人、總額、付款狀態分開寫。

| 寫法 | 頁面上 |
|---|---|
| `"免費"`（或 `"免費（步行）"` 這種免費開頭的） | 免費 |
| `"依訂單"` | 依訂單——他自己訂的，價格照他的訂單 |
| `"已含 <聯票名>"`（或 `"含在 …"`） | 已含 <聯票名>——含在聯票裡，不重複算 |
| `"待確認"`（或任何含「待確認」的字） | 待確認，而且進「出發前要處理」清單 |
| `"—"` | 不顯示費用：住宿那一晚、已經包在機票裡的一段 |
| `{ "per_person": "¥1,000／人" }` | ¥1,000／人 |
| `{ "per_person": "¥1,000／人", "currency": "JPY", "home": "約 US$7" }` | ¥1,000／人<br>約 US$7（匯率 2026-11-01）——日期從 `meta.currency.rates` 找 |
| `{ "per_person": "€40／人", "total": "€80／2 人", "payment": "已付" }` | €40／人<br>€80／2 人已付 |
| `{ "per_person": "€40／人", "total": "€80／2 人", "payment": "付款授權", "note": "票券還沒寄到" }` | €40／人<br>€80／2 人付款授權；票券還沒寄到 |

| 欄位 | | 說明 |
|---|---|---|
| `per_person` | **必填** | 每人、當地幣，寫幣別符號 |
| `currency` | | 這一格的幣別（`local` 或 `home` 裡的其中一個）。一趟跨好幾個國家的時候每一格寫清楚 |
| `home` | | 換算，**要有「約」** |
| `rate_date` | | 換算用的匯率日期。沒寫就用 `currency` 那一筆匯率的 `date`；兩個都沒有，build 不過 |
| `total` | | 全部人數總額，例如 `€80／2 人` |
| `payment` | | 已付／付款授權，接在 `total` 後面 |
| `note` | | 其他說明，放最後 |

其他字串（例如 `"¥500"`）build 會擋下來，要寫成 `{ "per_person": "¥500" }`。

---

## links — 交通與售票連結

```json
"links": {
  "intro": ["行程用到的官方網站。請依自己的旅行日期查詢與訂位。"],
  "sites": [{ "domain": "<官方網域>", "url": "https://<官方網域>/", "for": "<用在哪一段>" }],
  "apps": [{ "name": "<官方 app>", "where": "<城市甲> → <城市乙>", "why": "買票、改班次、看月台。" }]
}
```

| 欄位 | | 說明 |
|---|---|---|
| `intro` | | 標題下面的說明，一段一個字串 |
| `sites[].domain` | **必填** | 顯示的網域 |
| `sites[].url` | | 連結，沒寫就是 `https://` + domain |
| `sites[].for` | | 用在哪幾格 |
| `apps[].name` | **必填** | app 名稱 |
| `apps[].where` / `why` | | 用在哪一段、能做什麼。**每個國家的火車一個官方 app 就好** |

每一個網站和 app 都要對得到上面某一格。

---

## 建頁

```
node scripts/build.mjs trip.json                        # 寫出 trip.html
node scripts/build.mjs trip.json --pdf                  # 加印 A4 精簡版 trip.pdf（要裝 Chrome）
node scripts/build.mjs trip.json --out 我的行程.html
node scripts/build.mjs trip.json --redact redactions.json
```

`--redact` 是公開前的遮蔽規則，整頁套用：

```json
{
  "replace": [["原本的字", "換成的字"]],
  "regex": [["正規表示式", "換成的字"]],
  "banned": ["遮完之後頁面上不准再出現的字"]
}
```

照順序先做 `replace`、再做 `regex`；做完頁面上還有 `banned` 裡的字，build 失敗。

**PDF 是精簡版：** 封面、每天的簡報和必要指示、最後的連結。已取消、沒去的格子和原始備註不印，
封面會寫。找不到 Chrome 就只寫 HTML，用 `CHROME_PATH` 指定 Chrome 的位置。

**頁面超過 15 MB** build 會提醒：照片太多或太大。
