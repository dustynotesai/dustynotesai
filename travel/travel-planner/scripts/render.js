/* travel-planner · render.js
 *
 * trip.json → one HTML page. Pure functions: no DOM, no dependencies, no I/O.
 *
 *   Browser:  <script src="render.js"></script>  → window.TravelPlanner
 *   Node:     await import('./render.js')         → globalThis.TravelPlanner
 *             (require() also works: module.exports is the same object)
 *
 * The file has no import/export syntax on purpose, so the same bytes load as a
 * classic script, an ES module, or CommonJS.
 *
 * The page design is the DustyNotes itinerary page (the
 * "usability and cleanup" version). Keep the markup of rows and briefings
 * identical when changing them: the Europe example is checked against it.
 */
(function (root) {
  'use strict';

  var PLAN = ['規劃中', '備選', '已取消', '沒去', '已到訪'];
  var BOOKING = ['未訂', '需預約', '已訂', '待確認'];
  var SKIP = ['已取消', '沒去'];
  var TYPE = { '交通': 'transit', '景點': 'sight', '美食': 'food', '拍照': 'photo', '住宿': 'hotel', '購物': 'shop' };
  // 有地點的格子一定要有地圖連結。交通是移動，不是一個點，所以不算。
  var NEEDS_MAP = { '景點': 1, '美食': 1, '拍照': 1, '住宿': 1, '購物': 1 };
  var CHECKOUT = /退房|寄放行李|check\s*-?\s*out/i;
  // 只收搜尋網址和座標。/maps/place/ 那種帶 CID 的沒有查就是編的，短網址看不出指去哪裡。
  var MAP_SEARCH = /^https:\/\/www\.google\.com\/maps\/search\//;
  var COORD = /^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/;
  // 兩種都收：?api=1&query=… 和把搜尋字串放在路徑上的 /maps/search/<字串>。
  function mapQuery(u) {
    if (!MAP_SEARCH.test(u)) return null;
    var m = /[?&]query=([^&]*)/.exec(u);
    var raw = m ? m[1] : u.replace(MAP_SEARCH, '').split(/[?#]/)[0];
    if (!raw) return null;
    try { return decodeURIComponent(raw.replace(/\+/g, ' ')); } catch (e) { return raw; }
  }
  var CHANNEL = 'https://www.youtube.com/@DustyNotesAI';

  // ---------- page language ----------
  // Every fixed word on the page (and so in the PDF) comes from here. meta.language picks
  // the pack; no language means Traditional Chinese, the audience this was made for.
  // type／plan／booking stay Chinese codes inside trip.json whatever the language — only
  // their display changes. Another language has to bring every key in meta.labels;
  // a built-in one may override single keys there.
  var LANGS = {
    'zh-Hant': {
      lang: 'zh-Hant',
      fonts: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500&amp;family=Noto+Serif+TC:wght@700&amp;family=Sometype+Mono:wght@400;700&amp;display=swap',
      font_css: '',
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      months: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
      date_line: '{m} 月 {d} 日，週{w}　{city}',
      types: { '交通': '交通', '景點': '景點', '美食': '美食', '拍照': '拍照', '住宿': '住宿', '購物': '購物' },
      plans: { '規劃中': '規劃中', '備選': '備選', '已取消': '已取消', '沒去': '沒去', '已到訪': '已到訪' },
      chip_tbc: '待確認', chip_booked: '已訂', chip_reserve: '需預約',
      why_unverified: '未驗證', why_reserve: '需預約', why_reserve_option: '選擇此備選前需預約', why_booking_tbc: '訂位待確認',
      why_cost_tbc: '費用待確認', why_cost_unverified: '費用未驗證', why_essential_unverified: '必要指示有未驗證的數字',
      word_free: '免費', words_included: ['已含', '含在', '依訂單'], word_tbc: '待確認', word_unverified: '未驗證', approx: ['約'],
      cost_words: '免費…／已含 …／依訂單…／待確認／—',
      list: '、', semi: '；', comma: '，', colon: '：', paren_open: '（', paren_close: '）', sentence_end: '。',
      map: '地圖', new_tab: '（開新分頁）', notes_summary: '原始備註與改動', rate_paren: '（匯率 {date}）',
      brief_aria: 'Day {nn} 每日簡報', route_aria: '今日主線', tonight: '今晚', fixed: '時間節點', attention: '先留意', todo: '待處理',
      todo_day: '這天有 {n} 項預約或資料要確認', no_fixed: '無另列定時節點，依現場與訂位安排',
      expand_day: '展開原始備註', expand_all: '展開全部原始備註',
      js_expand: '展開', js_collapse: '收合', js_all_notes: '全部原始備註', js_notes: '原始備註',
      photo_prefix: '照片：',
      f_travellers: '人數', persons: '{n} 人', f_currency: '幣別', local_currency: '當地幣 ', rate_unverified: '匯率未驗證',
      rate_line: '1 {c} ≈ {rate} {home}，{date} 查', source: '來源', f_budget: '預算', per_day: '每人每天 ', excludes: '，不含',
      f_pace: '步調', f_wants: '想要', f_booked: '已訂', f_defaults: '預設值', f_checked: '查證', last_checked: '最後核對 ',
      cover_link: '查看 {md}{what} 行程', journey_aria: '旅行路線',
      download_pdf: '下載 PDF（精簡版）', links_title: '交通與售票連結', downloads_aria: '行程下載',
      links_intro: '行程用到的官方網站。請依自己的旅行日期查詢與訂位。',
      prep: '出發前要準備', official: '官方連結', checklist_summary: '出發前要處理（{n} 項）', apps_summary: '行程用到的 app 與工具',
      skip: '跳到行程內容', rail_aria: '行程日期', brand: '微塵筆記', brand_small: 'DUSTYNOTES',
      reading_aria: '開始閱讀', start: '開始看行程', todo_top: '出發前待處理 {n} 項',
      print_note: 'PDF 精簡版保留每日簡報與必要指示；已取消、沒去的項目及原始長篇備註請見 HTML 行程表。',
      colophon: '用{link} 的 travel-planner 做的', channel_name: '微塵筆記 DustyNotes'
    },
    'zh-Hans': {
      lang: 'zh-Hans',
      fonts: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500&amp;family=Noto+Serif+SC:wght@700&amp;family=Sometype+Mono:wght@400;700&amp;display=swap',
      font_css: '\n:root{--serif:"Noto Serif SC","Songti SC","SimSun",serif;--sans:"Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif}\n@media print{:root{--sans:"Microsoft YaHei","Arial",sans-serif}}\n',
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      months: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
      date_line: '{m} 月 {d} 日，周{w}　{city}',
      types: { '交通': '交通', '景點': '景点', '美食': '美食', '拍照': '拍照', '住宿': '住宿', '購物': '购物' },
      plans: { '規劃中': '规划中', '備選': '备选', '已取消': '已取消', '沒去': '没去', '已到訪': '已到访' },
      chip_tbc: '待确认', chip_booked: '已订', chip_reserve: '需预约',
      why_unverified: '未验证', why_reserve: '需预约', why_reserve_option: '选择此备选前需预约', why_booking_tbc: '订位待确认',
      why_cost_tbc: '费用待确认', why_cost_unverified: '费用未验证', why_essential_unverified: '必要指示有未验证的数字',
      word_free: '免费', words_included: ['已含', '含在', '依订单'], word_tbc: '待确认', word_unverified: '未验证', approx: ['约'],
      cost_words: '免费…／已含 …／依订单…／待确认／—',
      list: '、', semi: '；', comma: '，', colon: '：', paren_open: '（', paren_close: '）', sentence_end: '。',
      map: '地图', new_tab: '（新标签页打开）', notes_summary: '原始备注与改动', rate_paren: '（汇率 {date}）',
      brief_aria: 'Day {nn} 每日简报', route_aria: '今日主线', tonight: '今晚', fixed: '时间节点', attention: '先留意', todo: '待处理',
      todo_day: '这天有 {n} 项预约或资料要确认', no_fixed: '无另列定时节点，依现场与订位安排',
      expand_day: '展开原始备注', expand_all: '展开全部原始备注',
      js_expand: '展开', js_collapse: '收起', js_all_notes: '全部原始备注', js_notes: '原始备注',
      photo_prefix: '照片：',
      f_travellers: '人数', persons: '{n} 人', f_currency: '币种', local_currency: '当地币 ', rate_unverified: '汇率未验证',
      rate_line: '1 {c} ≈ {rate} {home}，{date} 查', source: '来源', f_budget: '预算', per_day: '每人每天 ', excludes: '，不含',
      f_pace: '节奏', f_wants: '想要', f_booked: '已订', f_defaults: '默认值', f_checked: '查证', last_checked: '最后核对 ',
      cover_link: '查看 {md}{what} 行程', journey_aria: '旅行路线',
      download_pdf: '下载 PDF（精简版）', links_title: '交通与售票链接', downloads_aria: '行程下载',
      links_intro: '行程用到的官方网站。请按自己的旅行日期查询与订位。',
      prep: '出发前要准备', official: '官方链接', checklist_summary: '出发前要处理（{n} 项）', apps_summary: '行程用到的 app 与工具',
      skip: '跳到行程内容', rail_aria: '行程日期', brand: '微塵筆記', brand_small: 'DUSTYNOTES',
      reading_aria: '开始阅读', start: '开始看行程', todo_top: '出发前待处理 {n} 项',
      print_note: 'PDF 精简版保留每日简报与必要指示；已取消、没去的项目及原始长篇备注请见 HTML 行程表。',
      colophon: '用{link} 的 travel-planner 做的', channel_name: '微塵筆記 DustyNotes'
    },
    en: {
      lang: 'en',
      fonts: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500&amp;family=Noto+Serif+TC:wght@700&amp;family=Sometype+Mono:wght@400;700&amp;display=swap',
      // English labels ("Fixed times", "Travellers") need a wider label column than two CJK characters
      font_css: '\n.brief-meta>div,.trip-facts>div{grid-template-columns:96px minmax(0,1fr)}\n',
      weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      date_line: '{w}, {mon} {d} · {city}',
      types: { '交通': 'Transport', '景點': 'Sight', '美食': 'Food', '拍照': 'Photo', '住宿': 'Stay', '購物': 'Shopping' },
      plans: { '規劃中': 'Planned', '備選': 'Alternative', '已取消': 'Cancelled', '沒去': 'Skipped', '已到訪': 'Visited' },
      chip_tbc: 'To confirm', chip_booked: 'Booked', chip_reserve: 'Book ahead',
      why_unverified: 'Unverified', why_reserve: 'Book ahead', why_reserve_option: 'Book ahead if you pick this one', why_booking_tbc: 'Booking to confirm',
      why_cost_tbc: 'Cost to confirm', why_cost_unverified: 'Cost unverified', why_essential_unverified: 'Directions include unverified numbers',
      word_free: 'Free', words_included: ['Included', 'Covered by', 'Per booking'], word_tbc: 'TBC', word_unverified: 'unverified', approx: ['~', '≈', 'approx', 'about', 'around'],
      cost_words: 'Free…／Included …／Covered by …／Per booking …／TBC／—',
      list: ', ', semi: '; ', comma: ', ', colon: ': ', paren_open: ' (', paren_close: ')', sentence_end: '. ',
      map: 'Map', new_tab: ' (opens in a new tab)', notes_summary: 'Original notes and changes', rate_paren: ' (rate {date})',
      brief_aria: 'Day {nn} briefing', route_aria: 'Today’s route', tonight: 'Tonight', fixed: 'Fixed times', attention: 'Heads-up', todo: 'To do',
      todo_day: '{n} bookings or details to confirm today', no_fixed: 'No fixed times; go by bookings and the day itself',
      expand_day: 'Show original notes', expand_all: 'Show all original notes',
      js_expand: 'Show', js_collapse: 'Hide', js_all_notes: ' all original notes', js_notes: ' original notes',
      photo_prefix: 'Photo: ',
      f_travellers: 'Travellers', persons: '{n}', f_currency: 'Currency', local_currency: 'local ', rate_unverified: 'rate unverified',
      rate_line: '1 {c} ≈ {rate} {home}, checked {date}', source: 'source', f_budget: 'Budget', per_day: 'per person per day ', excludes: ', excluding ',
      f_pace: 'Pace', f_wants: 'Priorities', f_booked: 'Booked', f_defaults: 'Assumed', f_checked: 'Research', last_checked: 'last checked ',
      cover_link: 'See {md}{what}', journey_aria: 'Route',
      download_pdf: 'Download PDF (compact)', links_title: 'Transport and tickets', downloads_aria: 'Downloads',
      links_intro: 'The official sites this itinerary uses. Check and book for your own dates.',
      prep: 'Before you go', official: 'Official site', checklist_summary: 'To handle before you go ({n})', apps_summary: 'Apps and tools used',
      skip: 'Skip to the itinerary', rail_aria: 'Trip days', brand: 'DustyNotes', brand_small: '微塵筆記',
      reading_aria: 'Start reading', start: 'Start with day one', todo_top: '{n} to handle before you go',
      print_note: 'This compact PDF keeps each day’s briefing and essential directions; cancelled or skipped items and the full original notes are in the HTML itinerary.',
      colophon: 'Made with {link}’s travel-planner', channel_name: 'DustyNotes'
    }
  };
  var OPTIONAL_LABELS = { fonts: 1, font_css: 1, cost_words: 1 };
  var FIXED_LENGTH = { weekdays: 7, months: 12 };

  // The pack for this trip: built-in language (default zh-Hant), then meta.labels on top.
  // An unknown language starts from en for structure; validation insists labels cover it all.
  function pack(trip) {
    var m = (trip && trip.meta) || {};
    var base = m.language == null ? LANGS['zh-Hant'] : LANGS[m.language] || LANGS.en;
    var over = m.labels && typeof m.labels === 'object' && !Array.isArray(m.labels) ? m.labels : {};
    if (base === LANGS['zh-Hant'] && !Object.keys(over).length) return base;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(over).forEach(function (k) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
        var merged = {};
        Object.keys(base[k]).forEach(function (j) { merged[j] = base[k][j]; });
        Object.keys(over[k]).forEach(function (j) { merged[j] = over[k][j]; });
        out[k] = merged;
      } else out[k] = over[k];
    });
    return out;
  }
  function fmt(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (all, k) { return vars[k] == null ? all : String(vars[k]); });
  }
  function lower(s) { return String(s == null ? '' : s).toLowerCase(); }
  function hasWord(text, word) { return lower(text).indexOf(lower(word)) >= 0; }
  function isUnverifiedRate(rate, L) { return rate === '未驗證' || (typeof rate === 'string' && lower(rate) === lower(L.word_unverified)); }
  // single-quoted JS string literal, safe inside <script>
  function jsStr(v) {
    return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\u003c').replace(/\n/g, '\\n') + "'";
  }

  // ---------- text ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function attr(s) {
    return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  var CHECK = '<svg class="ic" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICONS = {
    check: '<svg class="mk ok" viewBox="0 0 12 12" aria-label="已確認"><path d="M2 6.5l2.6 2.6L10 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg class="mk" viewBox="0 0 12 12" aria-label="注意"><path d="M6 1.6L11 10.4H1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 4.6v2.6M6 8.9v.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    bang: '<svg class="mk" viewBox="0 0 12 12" aria-label="重要"><circle cx="6" cy="6" r="4.8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6 3.4v3M6 8.4v.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    cross: '<svg class="mk" viewBox="0 0 12 12" aria-label="不行"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    star: '<svg class="mk" viewBox="0 0 12 12" aria-label="推薦"><path d="M6 1.4l1.4 2.9 3.2.4-2.3 2.2.6 3.2L6 8.6l-2.9 1.5.6-3.2L1.4 4.7l3.2-.4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    cam: '<svg class="mk" viewBox="0 0 12 12" aria-label="拍照"><path d="M1.5 4h2l1-1.4h3L8.5 4h2v6h-9z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="6" cy="6.9" r="1.7" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
  };
  var EMOJI_MAP = [['\u2705', 'check'], ['\u26A0\uFE0F', 'warn'], ['\u26A0', 'warn'], ['\u2757', 'bang'], ['\u274C', 'cross'], ['\u2B50', 'star'], ['\u{1F4F8}', 'cam']];
  var STRIP = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B50\u2B55\u203C\u2049\u260E]\uFE0F?\s?/gu;

  // One note line → HTML. A few emoji become line icons, the rest are dropped,
  // "Ticket: domain" becomes a small monospace domain.
  function noteHtml(n) {
    n = String(n);
    EMOJI_MAP.forEach(function (pair) {
      var mark = '\u0000' + pair[1] + '\u0000';
      n = n.split(pair[0] + ' ').join(mark).split(pair[0]).join(mark);
    });
    n = esc(n.replace(STRIP, ''));
    Object.keys(ICONS).forEach(function (k) { n = n.split('\u0000' + k + '\u0000').join(ICONS[k]); });
    return n.replace(/Ticket: (\S+)/g, '<span class="tk">$1</span>');
  }

  // ---------- dates ----------
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return d;
  }
  function md(d) { return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); }
  function dotted(d, withYear) {
    var s = pad2(d.getUTCMonth() + 1) + '.' + pad2(d.getUTCDate());
    return withYear ? d.getUTCFullYear() + '.' + s : s;
  }
  function addDays(d, k) { return new Date(d.getTime() + k * 86400000); }

  // ---------- derived row facts ----------
  function isSkipped(row) { return SKIP.indexOf(row && row.plan) >= 0; }

  // Outcome (已取消/沒去) wins over everything. Otherwise one booking chip
  // (待確認, 已訂, or 需預約 when not booked) and then the plan marker.
  function chipsFor(row, trip) {
    var L = pack(trip);
    if (isSkipped(row)) return [{ cls: 'skip', text: L.plans[row.plan] || row.plan }];
    var out = [];
    if (row.booking === '待確認') out.push({ cls: 'need', text: L.chip_tbc });
    else if (row.booking === '已訂') out.push({ cls: 'ok', text: L.chip_booked, icon: true });
    else if (row.booking === '需預約') out.push({ cls: 'need', text: L.chip_reserve });
    if (row.plan === '備選') out.push({ cls: 'opt', text: L.plans['備選'] });
    if (row.plan === '已到訪') out.push({ cls: 'done', text: L.plans['已到訪'] });
    return out;
  }
  function chipsHtml(row, trip) {
    return chipsFor(row, trip).map(function (c) {
      return '<span class="chip ' + c.cls + '">' + (c.icon ? CHECK : '') + esc(c.text) + '</span>';
    }).join('');
  }

  function rateFor(trip, from) {
    var cur = (trip && trip.meta && trip.meta.currency) || {};
    var rates = cur.rates || [];
    for (var i = 0; i < rates.length; i++) {
      if (rates[i] && rates[i].from === from && (!rates[i].to || rates[i].to === cur.home)) return rates[i];
    }
    return null;
  }

  // cost → { text, note } or null when nothing is shown.
  //   "—"                      → nothing (no cost to list: hotel nights, legs inside a booked ticket)
  //   "免費" / "已含 …" / "待確認" → text only
  //   { per_person, currency, home, rate_date, total, payment, note }
  //                            → text = per_person;
  //                              note = 約 home（匯率 date）；total+payment；note
  function costView(cost, trip) {
    if (cost == null || cost === '' || cost === '—') return null;
    if (typeof cost === 'string') return { text: cost, note: '' };
    var L = pack(trip);
    var parts = [];
    if (cost.home) {
      var date = cost.rate_date;
      if (!date && cost.currency) { var r = rateFor(trip, cost.currency); date = r && r.date; }
      parts.push(cost.home + (date ? fmt(L.rate_paren, { date: date }) : ''));
    }
    if (cost.total || cost.payment) parts.push((cost.total || '') + (cost.payment || ''));
    if (cost.note) parts.push(cost.note);
    return { text: cost.per_person || '', note: parts.join(L.semi) };
  }

  function stopTitle(row) {
    return row.short || String(row.act || '').split(/[（(]/)[0].trim();
  }
  function rowId(day, row) { return 'stop-' + pad2(day.n) + '-' + String(row.time).replace(':', ''); }

  function ticketDomain(url) {
    return String(url).replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }

  function photoSrc(photo) {
    if (!photo) return '';
    if (photo.src) return photo.src;
    if (photo.file) return photo.file;
    if (photo.commons) {
      return 'https://commons.wikimedia.org/wiki/Special:FilePath/' +
        encodeURIComponent(String(photo.commons).replace(/^File:/, '').replace(/ /g, '_')) + '?width=800';
    }
    return '';
  }
  function creditText(photo) {
    if (!photo) return '';
    var bits = [];
    if (photo.author) bits.push(photo.author);
    if (photo.license) bits.push(photo.license);
    return bits.join('，');
  }

  // Rows the reader has to check before leaving.
  function checklist(trip) {
    var L = pack(trip);
    var items = [];
    (trip.days || []).forEach(function (day) {
      (day.rows || []).forEach(function (row) {
        if (isSkipped(row)) return;
        var why = [];
        if (row.verified === false) why.push(L.why_unverified);
        if (row.booking === '需預約' && row.plan !== '已到訪') why.push(row.plan === '備選' ? L.why_reserve_option : L.why_reserve);
        if (row.booking === '待確認') why.push(L.why_booking_tbc);
        var c = costView(row.cost, trip);
        var costText = c ? c.text + ' ' + c.note : '';
        if (hasWord(costText, L.word_tbc)) why.push(L.why_cost_tbc);
        if (hasWord(costText, L.word_unverified)) why.push(L.why_cost_unverified);
        if (hasWord(row.essential || '', L.word_unverified) && why.indexOf(L.why_unverified) < 0) why.push(L.why_essential_unverified);
        if (why.length) items.push({ day: day, row: row, why: why });
      });
    });
    return items;
  }

  // ---------- content language ----------
  // The page's fixed words follow meta.language, so what the agent wrote has to as well.
  // SKILL.md says so; this is what stops the build when the agent forgets.
  var HAN = /[㐀-鿿豈-﫿]/g;
  var LATIN_WORD = /[A-Za-z]{2,}/g;
  // Characters only one Chinese script uses. Every form Japanese shares is left out on
  // purpose: 浅草、渋谷駅、東京都庁、千客万来 are real names inside a Traditional itinerary.
  var SIMPLIFIED_ONLY = '这们个时说对发过还进远边门问间车东马鸟书买卖实应开关头从业气电网页话语请让认识该变线经结给总爱长办乐亲场华单历县园图块坏处备复够奖妈岁岛带广庆张录忆惊战护报择换无显术权杂标样欢汉汤济测满热爷环现盘础确种积笔签简类纪红约级纯纸细织终组练罗职联脑艺节苏药营虽补观规视览觉计订讨训记讲许论设访证评诉译试详误读调谈谢负费购贵资赛赶转轻较辆达运连选适钟钱铁银错键闭闻阅队阳际陆险难题顾风飞馆验鱼鲜鸡齐龙两丽为义乡汇币晓执恶';
  var TRADITIONAL_ONLY = '這們說對發邊從氣讓變經總樂醫單歷縣雙圖壞處夠獎媽歲帶廣錄戰擇顯權雜樣歡濟滿爺簽聯腦藝蘇藥營雖觀覽覺證譯讀趕轉輕錢鐵閱險驗雞齊兩鄉匯';

  // The words the agent wrote, with where they sit. main: the fields a reader always sees
  // and that are never just a name (titles, the notice, what to watch for, what to do).
  function contentFields(trip) {
    var out = [];
    function add(path, v, main) { if (typeof v === 'string' && v.trim()) out.push({ path: path, text: v, main: !!main }); }
    var m = isObj(trip.meta) ? trip.meta : {};
    add('meta.title', m.title, true);
    add('meta.subtitle', m.subtitle);
    add('meta.notice', m.notice, true);
    (Array.isArray(m.prep) ? m.prep : []).forEach(function (p, i) {
      if (isObj(p)) { add('meta.prep[' + i + '].item', p.item); add('meta.prep[' + i + '].detail', p.detail); }
    });
    (Array.isArray(m.defaults) ? m.defaults : []).forEach(function (d, i) { add('meta.defaults[' + i + ']', d); });
    (Array.isArray(trip.days) ? trip.days : []).forEach(function (day) {
      if (!isObj(day)) return;
      var label = 'Day ' + pad2(day.n);
      add(label + '.title', day.title, true);
      if (isObj(day.brief)) { add(label + '.brief.stay', day.brief.stay); add(label + '.brief.attention', day.brief.attention, true); }
      (Array.isArray(day.rows) ? day.rows : []).forEach(function (row) {
        if (!isObj(row)) return;
        var rl = label + ' ' + row.time;
        add(rl + '.act', row.act);
        add(rl + '.essential', row.essential, true);
        (Array.isArray(row.notes) ? row.notes : []).forEach(function (n, k) { add(rl + '.notes[' + k + ']', n); });
      });
    });
    return out;
  }

  function listSome(items) {
    return items.slice(0, 5).join('、') + (items.length > 5 ? ' 等 ' + items.length + ' 處' : '');
  }

  // → error strings. Only built-in languages are judged; another language brings its own labels
  // and nothing here knows what it should look like.
  function contentLanguageErrors(trip) {
    var meta = isObj(trip.meta) ? trip.meta : {};
    var language = typeof meta.language === 'string' ? meta.language : 'zh-Hant';
    if (language !== 'zh-Hant' && language !== 'zh-Hans' && language !== 'en') return [];
    var named = meta.language == null ? 'zh-Hant（meta.language 沒寫就是繁體）' : language;
    var wrongScript = language === 'zh-Hant' ? SIMPLIFIED_ONLY : language === 'zh-Hans' ? TRADITIONAL_ONLY : '';
    var english = [], chinese = [], script = [];
    contentFields(trip).forEach(function (f) {
      var han = (f.text.match(HAN) || []).length;
      var words = (f.text.match(LATIN_WORD) || []).length;
      if (f.main && language !== 'en' && han === 0 && words >= 4) english.push(f.path);
      if (f.main && language === 'en' && han >= 4 && han > words * 2) chinese.push(f.path);
      if (wrongScript) {
        var bad = '';
        for (var i = 0; i < f.text.length; i++) {
          var ch = f.text.charAt(i);
          if (wrongScript.indexOf(ch) >= 0 && bad.indexOf(ch) < 0) bad += ch;
        }
        if (bad) script.push(f.path + '「' + bad + '」');
      }
    });
    var errors = [];
    if (english.length) {
      errors.push('頁面語言是 ' + named + '，但這幾格是英文：' + listSome(english) +
        '。改成中文；只有他明說要英文，才把 meta.language 改成 "en"');
    }
    if (chinese.length) {
      errors.push('meta.language 是 en，但這幾格大部分是中文：' + listSome(chinese) +
        '。改成英文；他沒有明說要英文的話，拿掉 meta.language，整份用中文');
    }
    if (script.length && language === 'zh-Hant') {
      errors.push('頁面是繁體（meta.language ' + (meta.language == null ? '沒寫，就是繁體' : language) + '），但出現簡體字：' + listSome(script) +
        '。改成繁體；他寫的是簡體的話，整份用簡體並把 meta.language 設成 "zh-Hans"');
    }
    if (script.length && language === 'zh-Hans') {
      errors.push('頁面是簡體（meta.language zh-Hans），但出現繁體字：' + listSome(script) + '。改成簡體');
    }
    return errors;
  }

  // ---------- validation ----------
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function isStr(x) { return typeof x === 'string' && x.trim() !== ''; }
  function isUrl(x) { return typeof x === 'string' && /^https?:\/\/\S+$/.test(x); }
  var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

  function validCostString(s, L) {
    var t = lower(s);
    return s === '—' || t.indexOf(lower(L.word_free)) === 0 ||
      L.words_included.some(function (w) { return t.indexOf(lower(w)) === 0; }) || t.indexOf(lower(L.word_tbc)) >= 0;
  }

  // Returns { errors: [..], warnings: [..] }. Structural only — build.mjs adds
  // the checks that need the file system.
  function validateTrip(trip) {
    var errors = [], warnings = [];
    function err(m) { errors.push(m); }
    if (!isObj(trip)) return { errors: ['trip.json 最外層要是一個物件 { … }'], warnings: warnings };
    if (trip.schema !== 1) err('schema：要寫 1');

    // no email, anywhere
    (function walk(x, path) {
      if (typeof x === 'string') {
        if (/mail\.google\.com|^mailto:/i.test(x)) err(path + '：不放 email 連結（' + x.slice(0, 40) + '…）');
      } else if (Array.isArray(x)) {
        x.forEach(function (v, i) { walk(v, path + '[' + i + ']'); });
      } else if (isObj(x)) {
        Object.keys(x).forEach(function (k) {
          if (/^(e?mail|gmail)$/i.test(k)) err(path + '.' + k + '：不放 email 連結');
          walk(x[k], path + '.' + k);
        });
      }
    })(trip, 'trip');

    var meta = trip.meta;
    var L = pack(trip);
    var home = null, locals = [];
    var start = null, end = null;
    if (!isObj(meta)) err('meta：缺少');
    else {
      if (!isStr(meta.title)) err('meta.title：缺少');
      start = parseDate(meta.start); end = parseDate(meta.end);
      if (!start) err('meta.start：要是 YYYY-MM-DD，現在是「' + meta.start + '」');
      if (!end) err('meta.end：要是 YYYY-MM-DD，現在是「' + meta.end + '」');
      if (start && end && end < start) err('meta.end 早於 meta.start');
      if (!isObj(meta.travellers) || !(Number.isInteger(meta.travellers.count) && meta.travellers.count > 0)) {
        err('meta.travellers.count：要是正整數（幾個人）');
      }
      var cur = meta.currency;
      if (!isObj(cur)) err('meta.currency：缺少（幣別是面談裡單獨問的那一題）');
      else {
        if (!isStr(cur.home)) err('meta.currency.home：缺少（他選的幣別，例如 USD）');
        else home = cur.home;
        if (!Array.isArray(cur.local)) err('meta.currency.local：要是陣列，例如 ["JPY"]');
        else locals = cur.local;
        var rates = cur.rates || [];
        if (!Array.isArray(rates)) err('meta.currency.rates：要是陣列');
        else {
          rates.forEach(function (r, i) {
            var p = 'meta.currency.rates[' + i + ']';
            if (!isObj(r) || !isStr(r.from)) { err(p + '：要有 from'); return; }
            if (r.to && home && r.to !== home) err(p + '：to 要等於 meta.currency.home（' + home + '）');
            if (isUnverifiedRate(r.rate, L)) return;
            if (!(typeof r.rate === 'number' && r.rate > 0)) err(p + '：rate 要是大於 0 的數字，查不到就寫 "未驗證"');
            if (!parseDate(r.date)) err(p + '：date 要是查匯率那天 YYYY-MM-DD');
          });
          locals.forEach(function (c) {
            if (c === home) return;
            var found = rates.some(function (r) { return r && r.from === c; });
            if (!found) err('meta.currency.local 的 ' + c + ' 沒有匯率：rates 加一筆 { "from": "' + c + '", "to": "' + home + '", "rate": …, "date": … }，查不到就 "rate": "未驗證"');
          });
        }
      }
      if (meta.downloads != null) {
        if (!Array.isArray(meta.downloads)) err('meta.downloads：要是陣列');
        else meta.downloads.forEach(function (d, i) {
          if (!isObj(d) || !isStr(d.label) || !isStr(d.href)) err('meta.downloads[' + i + ']：要有 label 和 href');
        });
      }
      if (meta.language != null && typeof meta.language !== 'string') err('meta.language：要是字串，例如 "zh-Hant"、"zh-Hans"、"en"');
      if (meta.labels != null && !isObj(meta.labels)) err('meta.labels：要是物件 { "map": "…" }');
      if (typeof meta.language === 'string' && !LANGS[meta.language]) {
        var given = isObj(meta.labels) ? meta.labels : {};
        var missing = Object.keys(LANGS['zh-Hant']).filter(function (k) {
          if (OPTIONAL_LABELS[k]) return false;
          var ref = LANGS['zh-Hant'][k], v = given[k];
          if (Array.isArray(ref)) {
            return !Array.isArray(v) || !v.length || !v.every(isStr) || (FIXED_LENGTH[k] && v.length !== FIXED_LENGTH[k]);
          }
          if (isObj(ref)) return !isObj(v) || Object.keys(ref).some(function (j) { return !isStr(v[j]); });
          return typeof v !== 'string';
        });
        if (missing.length) {
          err('meta.language「' + meta.language + '」沒有內建的頁面文字（內建：' + Object.keys(LANGS).join('、') + '）：' +
            'meta.labels 要補齊 ' + missing.join('、') + '，照 zh-Hant 那一份的鍵翻成這個語言');
        }
      }
      if (isObj(meta.labels)) {
        Object.keys(meta.labels).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(LANGS['zh-Hant'], k)) warnings.push('meta.labels.' + k + '：不認得，頁面上不會用到');
        });
      }
      if (meta.prep != null) {
        if (!Array.isArray(meta.prep)) err('meta.prep：要是陣列');
        else meta.prep.forEach(function (p, i) {
          if (!isObj(p) || !isStr(p.item)) err('meta.prep[' + i + ']：要有 item');
          else if (p.link != null && !isUrl(p.link)) err('meta.prep[' + i + '].link：要是 http(s) 網址');
        });
      }
    }

    // photos
    var photos = trip.photos == null ? {} : trip.photos;
    var usedPhotos = {};
    if (!isObj(photos)) { err('photos：要是物件 { "id": { … } }'); photos = {}; }
    Object.keys(photos).forEach(function (id) {
      var p = photos[id], path = 'photos.' + id;
      if (!/^[A-Za-z0-9_-]+$/.test(id)) err(path + '：id 只能用英數字、- 和 _');
      if (!isObj(p)) { err(path + '：要是物件'); return; }
      if (!isStr(p.commons) && !isStr(p.file) && !isStr(p.src)) err(path + '：要有 commons（"File:…"）或 file');
      if (isStr(p.commons) && !/^File:/.test(p.commons)) err(path + '.commons：要以 "File:" 開頭');
    });
    function usePhoto(id, path) {
      if (id == null) return;
      if (!Object.prototype.hasOwnProperty.call(photos, id)) err(path + '：photos 裡沒有「' + id + '」');
      else usedPhotos[id] = true;
    }

    // days
    var days = trip.days, byN = {};
    if (!Array.isArray(days) || !days.length) { err('days：至少要有一天'); days = []; }
    var prevDate = null, prevN = null;
    days.forEach(function (day, i) {
      var dp = 'days[' + i + ']';
      if (!isObj(day)) { err(dp + '：要是物件'); return; }
      if (!Number.isInteger(day.n) || day.n < 0) { err(dp + '.n：要是整數（Day 幾）'); return; }
      var label = 'Day ' + pad2(day.n);
      if (byN[day.n]) err(label + '：n 重複');
      byN[day.n] = day;
      if (prevN != null && day.n <= prevN) err(label + '：days 要照 n 由小到大排');
      prevN = day.n;
      var d = parseDate(day.date);
      if (!d) err(label + '.date：要是 YYYY-MM-DD，現在是「' + day.date + '」');
      else {
        if (start && d < start || end && d > end) err(label + '.date ' + day.date + ' 不在 meta.start–meta.end 裡面');
        if (prevDate && d.getTime() !== addDays(prevDate, 1).getTime()) err(label + '.date ' + day.date + ' 沒有接著前一天（' + prevDate.toISOString().slice(0, 10) + '）');
        if (i === 0 && start && d.getTime() !== start.getTime()) err(label + '：第一天的 date 要等於 meta.start');
        if (i === days.length - 1 && end && d.getTime() !== end.getTime()) err(label + '：最後一天的 date 要等於 meta.end');
        prevDate = d;
      }
      if (!isStr(day.city)) err(label + '.city：缺少');
      if (!isStr(day.title)) err(label + '.title：缺少');
      var rows = day.rows, times = {};
      if (!Array.isArray(rows) || !rows.length) { err(label + '.rows：至少要有一格'); rows = []; }
      rows.forEach(function (row, j) {
        if (!isObj(row)) { err(label + ' rows[' + j + ']：要是物件'); return; }
        var rl = label + ' ' + (row.time || 'rows[' + j + ']');
        // 有的跑法整份不填 row.city，那一天的城市照樣用得上：在車上的格子才豁免得掉地圖。
        var rowCity = isStr(row.city) ? row.city : (isStr(day.city) && day.city.indexOf('→') < 0 ? day.city : null);
        if (!TIME.test(row.time || '')) err(rl + '：time 要是 HH:MM');
        else if (times[row.time]) err(rl + '：同一天有兩格同一個時間，簡報對不到是哪一格');
        else times[row.time] = row;
        if (!isStr(row.act)) err(rl + '：act 缺少');
        if (!TYPE[row.type]) err(rl + '：type 要是 交通／景點／美食／拍照／住宿／購物，現在是「' + row.type + '」');
        if (PLAN.indexOf(row.plan) < 0) err(rl + '：plan 要是 ' + PLAN.join('／') + '，現在是「' + row.plan + '」');
        if (BOOKING.indexOf(row.booking) < 0) err(rl + '：booking 要是 ' + BOOKING.join('／') + '，現在是「' + row.booking + '」');
        var hasNotes = Array.isArray(row.notes) && row.notes.some(isStr);
        if (row.notes != null && !Array.isArray(row.notes)) err(rl + '：notes 要是字串陣列');
        if (!isStr(row.essential) && !hasNotes) err(rl + '：essential 和 notes 至少要有一個');
        if (typeof row.verified !== 'boolean') err(rl + '：verified 要是 true 或 false（這次有沒有用工具查過）');
        // cost
        var c = row.cost;
        if (c == null) err(rl + '：cost 缺少（沒有費用可列就寫 "—"）');
        else if (typeof c === 'string') {
          if (!validCostString(c, L)) {
            var words = L.cost_words || L.word_free + '…／' + L.words_included.map(function (w) { return w + ' …'; }).join('／') + '／' + L.word_tbc + '／—';
            err(rl + '：cost 字串只能是 ' + words + '；「' + c + '」要寫成 { "per_person": "' + c + '" }');
          }
        } else if (isObj(c)) {
          if (!isStr(c.per_person)) err(rl + '：cost.per_person 缺少（每人、當地幣，例如 "€18／人"）');
          if (c.currency != null && home && c.currency !== home && locals.indexOf(c.currency) < 0) {
            err(rl + '：cost.currency ' + c.currency + ' 不在 meta.currency.local 裡');
          }
          if (c.home != null) {
            if (!L.approx.some(function (w) { return hasWord(c.home, w); })) err(rl + '：cost.home 是換算，要標「' + L.approx[0] + '」');
            var rate = c.currency ? rateFor(trip, c.currency) : null;
            if (rate && isUnverifiedRate(rate.rate, L)) err(rl + '：' + c.currency + ' 的匯率未驗證，不要換算 cost.home，只寫當地幣');
            else if (!c.rate_date && !(rate && rate.date)) err(rl + '：cost.home 要有匯率日期（cost.rate_date，或 cost.currency 對到 meta.currency.rates）');
          }
        } else err(rl + '：cost 要是字串或物件');
        if (row.map != null && !isUrl(row.map)) err(rl + '：map 要是 https:// 網址');
        else if (row.map == null && NEEDS_MAP[row.type] && SKIP.indexOf(row.plan) < 0 && rowCity !== 'Transit') {
          err(rl + '：' + row.type + ' 的格子要有 map（地圖連結）。用搜尋網址，不要組地點網址：'
            + 'https://www.google.com/maps/search/?api=1&query=<地點名> <城市>');
        } else if (row.map != null) {
          var q = mapQuery(row.map);
          if (!q) {
            err(rl + '：map 只收 https://www.google.com/maps/search/?api=1&query=… '
              + '（或 query=<緯度>,<經度>）。/maps/place/ 帶 CID 的沒查過就是編的，短網址看不出指去哪裡');
          } else if (!COORD.test(q) && isStr(rowCity) && q.indexOf(rowCity) < 0 && q.length < 6) {
            // 同名的店很多。查得到座標最好，不然至少「地點名 城市」，開出來才是一個點。
            warnings.push(rl + '：map 的 query 是「' + q + '」，太短可能開出一列搜尋結果；'
              + '加上城市（' + rowCity + '）或改用座標，他一點就到');
          }
        }
        if (row.ticket != null && !isUrl(row.ticket)) err(rl + '：ticket 要是 https:// 網址');
        else if (row.ticket == null && SKIP.indexOf(row.plan) < 0) {
          // 住宿：還沒訂就一定要連結，不然他訂不了。已經訂了只是提醒。
          if (row.type === '住宿' && !CHECKOUT.test(row.act || '')) {
            if (row.booking !== '已訂') {
              err(rl + '：住宿還沒訂，要有 ticket（訂房連結，飯店官網或訂房網）。沒有連結他訂不了');
            } else {
              warnings.push(rl + '：住宿已訂，但沒有 ticket；補一個飯店連結，他到現場要找地址和電話');
            }
          } else if (row.booking === '需預約') {
            // 定時票、名額制的場子一定訂得到；「附近選一家」的餐廳還沒選定，只能提醒。
            if (row.type === '景點' || row.type === '拍照') {
              err(rl + '：需預約，要有 ticket（官方訂票連結）。沒有連結他訂不了');
            } else {
              warnings.push(rl + '：需預約但沒有 ticket；選定了就補官方訂位連結，'
                + '還沒選定就在必要指示寫清楚怎麼訂（電話、現場候位、旺季要多久前訂）');
            }
          }
        }
        if (row.sources != null) {
          if (!Array.isArray(row.sources)) err(rl + '：sources 要是網址陣列');
          else row.sources.forEach(function (s) { if (!isUrl(s)) err(rl + '：sources 裡「' + s + '」不是網址'); });
        }
        usePhoto(row.photo, rl + '.photo');
      });
      var b = day.brief;
      if (!isObj(b)) err(label + '.brief：缺少（主線、今晚、時間節點、先留意）');
      else {
        if (!Array.isArray(b.route) || !b.route.length) err(label + '.brief.route：至少一個時間');
        else b.route.forEach(function (t) {
          if (!times[t]) err(label + '.brief.route 的 ' + t + ' 對不到這一天任何一格的 time');
          else if (isSkipped(times[t])) warnings.push(label + '.brief.route 的 ' + t + ' 是' + times[t].plan + '，頁面上會略過');
        });
        if (!Array.isArray(b.fixed)) err(label + '.brief.fixed：要是陣列，沒有就寫 []');
        else b.fixed.forEach(function (t) { if (!times[t]) err(label + '.brief.fixed 的 ' + t + ' 對不到這一天任何一格的 time'); });
        if (!isStr(b.stay)) err(label + '.brief.stay：缺少（今晚住哪）');
        if (!isStr(b.attention)) err(label + '.brief.attention：缺少（先留意的一件事）');
      }
    });

    // sections
    var sections = trip.sections, owner = {};
    if (!Array.isArray(sections) || !sections.length) { err('sections：至少要有一段'); sections = []; }
    sections.forEach(function (s, i) {
      var sp = 'sections[' + i + ']';
      if (!isObj(s)) { err(sp + '：要是物件'); return; }
      if (!isStr(s.name)) err(sp + '.name：缺少');
      if (!Array.isArray(s.days) || !s.days.length) { err(sp + '.days：至少一天'); return; }
      s.days.forEach(function (n) {
        if (!byN[n]) err(sp + '.days 的 ' + n + ' 對不到任何一天');
        else if (owner[n] != null) err('Day ' + pad2(n) + ' 同時在 sections[' + owner[n] + '] 和 ' + sp);
        else owner[n] = i;
      });
      (s.lead_days || []).forEach(function (n) {
        if (s.days.indexOf(n) < 0) err(sp + '.lead_days 的 ' + n + ' 不在這一段的 days 裡');
      });
      if (!isStr(s.photo)) err(sp + '.photo：缺少（每一段城市都要有一張照片，Commons 檔名或他自己的照片）');
      usePhoto(s.photo, sp + '.photo');
    });
    days.forEach(function (day) {
      if (isObj(day) && Number.isInteger(day.n) && owner[day.n] == null) err('Day ' + pad2(day.n) + ' 不在任何 sections 裡');
    });

    if (isObj(meta)) {
      if (meta.cover != null) {
        if (!isObj(meta.cover)) err('meta.cover：要是物件');
        else {
          usePhoto(meta.cover.photo, 'meta.cover.photo');
          if (meta.cover.day != null && !byN[meta.cover.day]) err('meta.cover.day ' + meta.cover.day + ' 對不到任何一天');
        }
      }
      if (meta.route != null) {
        if (!Array.isArray(meta.route)) err('meta.route：要是陣列');
        else meta.route.forEach(function (r, i) {
          if (!isObj(r) || !isStr(r.name)) err('meta.route[' + i + ']：要有 name');
          else if (r.day != null && !byN[r.day]) err('meta.route[' + i + ']（' + r.name + '）.day ' + r.day + ' 對不到任何一天');
        });
      }
    }

    var links = trip.links;
    if (links != null) {
      if (!isObj(links)) err('links：要是物件');
      else {
        (links.sites || []).forEach(function (s, i) {
          if (!isObj(s) || !isStr(s.domain)) err('links.sites[' + i + ']：要有 domain');
          else if (s.url != null && !isUrl(s.url)) err('links.sites[' + i + '].url：要是 https:// 網址');
        });
        (links.apps || []).forEach(function (a, i) {
          if (!isObj(a) || !isStr(a.name)) err('links.apps[' + i + ']：要有 name');
        });
      }
    }

    Object.keys(photos).forEach(function (id) {
      if (!usedPhotos[id]) warnings.push('photos.' + id + '：沒有用在任何地方');
    });
    contentLanguageErrors(trip).forEach(err);
    return { errors: errors, warnings: warnings, usedPhotos: Object.keys(usedPhotos) };
  }

  // ---------- markup ----------
  function rowHtml(trip, day, row) {
    var L = pack(trip);
    var newTab = '<span class="sr">' + esc(L.new_tab) + '</span>';
    var tcls = TYPE[row.type] || 'other';
    var skipped = isSkipped(row);
    var links = [];
    if (row.map) links.push('<a href="' + attr(row.map) + '" target="_blank" rel="noopener">' + esc(L.map) + newTab + '</a>');
    if (row.ticket) {
      links.push('<a href="' + attr(row.ticket) + '" target="_blank" rel="noopener" title="' + attr(row.ticket) + '">' +
        esc(ticketDomain(row.ticket)) + newTab + '</a>');
    }
    var cost = costView(row.cost, trip);
    var costline = cost && cost.text
      ? '<span class="cost">' + esc(cost.text) + '</span>' + (cost.note ? '<small class="cost-note">' + esc(cost.note) + '</small>' : '')
      : '';
    var linkhtml = '<span class="links">' + costline + links.join('') + '</span>';
    var essential = row.essential ? '<p class="essential">' + esc(row.essential) + '</p>' : '';
    var notes = (row.notes || []).filter(function (n) { return n != null && n !== ''; });
    var note = '';
    if (notes.length) {
      var body = notes.map(function (n) { return '<p>' + noteHtml(n) + '</p>'; }).join('');
      note = row.essential
        ? '<details class="note"><summary>' + esc(L.notes_summary) + '</summary><div class="more">' + body + '</div></details>'
        : '<div class="note one">' + body + '</div>';
    }
    var photo = '';
    if (row.photo && trip.photos && trip.photos[row.photo]) {
      var ph = trip.photos[row.photo], credit = creditText(ph);
      photo = '<figure class="row-photo"><img src="' + attr(photoSrc(ph)) + '" alt="' + attr(ph.alt || '') + '" loading="lazy">' +
        (credit ? '<figcaption class="credit">' + esc(credit) + '</figcaption>' : '') + '</figure>';
    }
    return '\n        <li class="row ' + tcls + (skipped ? ' skipped' : '') + '" id="' + rowId(day, row) + '" tabindex="-1">' +
      '\n          <div class="tk-col"><time class="t">' + esc(row.time) + '</time><span class="k">' + esc(L.types[row.type] || row.type) + '</span></div>' +
      '\n          <div class="a"><div class="act"><span class="name">' + esc(row.act) + '</span>' + chipsHtml(row, trip) + '</div>' + essential + photo + note + '</div>' +
      '\n          ' + linkhtml +
      '\n        </li>';
  }

  function briefHtml(day, pending, L) {
    var byTime = {};
    day.rows.forEach(function (r) { byTime[r.time] = r; });
    function stop(t) {
      var r = byTime[t];
      return '<a href="#' + rowId(day, r) + '"><time>' + esc(t) + '</time> ' + esc(stopTitle(r)) + '</a>';
    }
    var b = day.brief;
    var route = b.route.filter(function (t) { return byTime[t] && !isSkipped(byTime[t]); })
      .map(function (t) { return '<li>' + stop(t) + '</li>'; }).join('');
    var fixed = (b.fixed || []).filter(function (t) { return byTime[t]; }).map(stop).join(esc(L.list)) || esc(L.no_fixed);
    return '<section class="brief" aria-label="' + attr(fmt(L.brief_aria, { nn: pad2(day.n) })) + '">' +
      '\n          <ol class="day-route" aria-label="' + attr(L.route_aria) + '">' + route + '</ol>' +
      '\n          <dl class="brief-meta">' +
      '\n            <div><dt>' + esc(L.tonight) + '</dt><dd>' + esc(b.stay) + '</dd></div>' +
      '\n            <div><dt>' + esc(L.fixed) + '</dt><dd>' + fixed + '</dd></div>' +
      '\n            <div class="attention"><dt>' + esc(L.attention) + '</dt><dd>' + esc(b.attention) + '</dd></div>' +
      (pending ? '\n            <div class="attention"><dt>' + esc(L.todo) + '</dt><dd><a href="#checklist">' + esc(fmt(L.todo_day, { n: pending })) + '</a></dd></div>' : '') +
      '\n          </dl>' +
      '\n        </section>';
  }

  function dayHtml(trip, day) {
    var L = pack(trip);
    var d = parseDate(day.date);
    return '\n      <article class="day" id="day-' + pad2(day.n) + '" data-day="' + day.n + '" tabindex="-1">' +
      '\n        <header class="dayhead">' +
      '\n          <span class="idx">' + pad2(day.n) + '</span>' +
      '\n          <div class="meta">' +
      '\n            <p class="date">' + esc(fmt(L.date_line, { m: d.getUTCMonth() + 1, mon: L.months[d.getUTCMonth()], d: d.getUTCDate(), w: L.weekdays[d.getUTCDay()], city: day.city })) + '</p>' +
      '\n            <h3>' + esc(day.title) + '</h3>' +
      '\n          </div>' +
      '\n          <div class="tools" hidden><button type="button" class="tg" data-scope="day">' + esc(L.expand_day) + '</button></div>' +
      '\n        </header>' +
      '\n        ' + briefHtml(day, checklist({ meta: trip.meta, days: [day] }).length, L) +
      '\n        <ol class="rows">' + day.rows.map(function (r) { return rowHtml(trip, day, r); }).join('') +
      '\n        </ol>' +
      '\n      </article>';
  }

  function sectionHtml(trip, s, byN) {
    var leadDays = s.lead_days || [];
    var lead = leadDays.length
      ? (s.lead_heading ? '<h2 class="sr">' + esc(s.lead_heading) + '</h2>' : '') +
        leadDays.map(function (n) { return dayHtml(trip, byN[n]); }).join('')
      : '';
    var own = s.days.filter(function (n) { return byN[n] && leadDays.indexOf(n) < 0; });
    var all = s.days.map(function (n) { return byN[n]; }).filter(Boolean)
      .sort(function (a, b) { return a.n - b.n; });
    var first = parseDate(all[0].date), last = parseDate(all[all.length - 1].date);
    var dates = s.dates || (all.length > 1 ? md(first) + ' – ' + md(last) : md(first));
    var photo = s.photo && trip.photos ? trip.photos[s.photo] : null;
    var credit = creditText(photo);
    var L = pack(trip);
    return '\n    <section class="city">' + lead +
      '\n      <figure class="hero">' + (photo ? '<img src="' + attr(photoSrc(photo)) + '" alt="" loading="lazy">' : '') +
      '\n        <figcaption><h2>' + esc(s.name) + '</h2><span class="latin">' + (s.latin ? esc(s.latin) + ' · ' : '') + esc(dates) + '</span>' +
      (credit ? '<small class="credit">' + esc(L.photo_prefix) + esc(credit) + '</small>' : '') + '</figcaption>' +
      '\n      </figure>' +
      '\n      ' + own.map(function (n) { return dayHtml(trip, byN[n]); }).join('') +
      '\n    </section>';
  }

  function factsHtml(trip) {
    var L = pack(trip);
    var newTab = '<span class="sr">' + esc(L.new_tab) + '</span>';
    var m = trip.meta, rows = [];
    function row(dt, dd) { rows.push('<div><dt>' + dt + '</dt><dd>' + dd + '</dd></div>'); }
    var t = m.travellers || {};
    if (t.count) row(esc(L.f_travellers), esc(fmt(L.persons, { n: t.count }) + (t.who ? L.comma + t.who : '')));
    var cur = m.currency || {};
    if (cur.home) {
      // TWD；當地幣 EUR（1 EUR ≈ 37.25 TWD，2026-09-15 查，來源）、CHF（匯率未驗證）
      var locals = (cur.local || []).filter(function (c) { return c !== cur.home; });
      var rated = locals.map(function (c) {
        var r = rateFor(trip, c);
        if (!r || isUnverifiedRate(r.rate, L)) return { c: c, text: null };
        return {
          c: c,
          text: esc(fmt(L.rate_line, { c: c, rate: r.rate, home: cur.home, date: r.date })) +
            (r.source ? esc(L.comma) + '<a href="' + attr(r.source) + '" target="_blank" rel="noopener">' + esc(L.source) + newTab + '</a>' : '')
        };
      });
      var dd = esc(cur.home);
      if (locals.length) {
        dd += esc(L.semi + L.local_currency) + (rated.every(function (x) { return !x.text; })
          ? esc(locals.join(L.list)) + esc(L.paren_open + L.rate_unverified + L.paren_close)
          : rated.map(function (x) { return esc(x.c) + esc(L.paren_open) + (x.text || esc(L.rate_unverified)) + esc(L.paren_close); }).join(esc(L.list)));
      }
      row(esc(L.f_currency), dd);
    }
    var bud = m.budget;
    if (bud && bud.per_person_per_day != null) {
      row(esc(L.f_budget), esc(L.per_day + (cur.home ? cur.home + ' ' : '') + bud.per_person_per_day + (bud.excludes ? L.excludes + bud.excludes : '')));
    }
    if (m.pace) row(esc(L.f_pace), esc(m.pace));
    if (m.wants && m.wants.length) row(esc(L.f_wants), esc(m.wants.join(L.list)));
    if (m.booked && m.booked.length) {
      row(esc(L.f_booked), esc(m.booked.map(function (b) {
        var d = parseDate(b.date);
        return b.what + (d ? L.paren_open + md(d) + L.paren_close : '');
      }).join(L.list)));
    }
    if (m.defaults && m.defaults.length) row(esc(L.f_defaults), esc(m.defaults.join(L.semi)));
    var checked = [];
    if (m.researched_with && m.researched_with.length) checked.push(m.researched_with.join(L.list));
    if (m.checked_on) checked.push(L.last_checked + m.checked_on);
    if (checked.length) row(esc(L.f_checked), esc(checked.join(L.semi)));
    return rows.length ? '\n      <dl class="trip-facts">' + rows.join('') + '</dl>' : '';
  }

  function noticeHtml(text, L) {
    text = String(text);
    var i = text.indexOf(L.sentence_end);
    if (i >= 0 && i < text.length - 1) return '<b>' + esc(text.slice(0, i + 1)) + '</b>' + esc(text.slice(i + 1));
    return esc(text);
  }

  // renderTrip(trip, { pdf: 'trip.pdf' }) → full HTML document string.
  function renderTrip(trip, options) {
    options = options || {};
    var L = pack(trip);
    var newTab = '<span class="sr">' + esc(L.new_tab) + '</span>';
    var m = trip.meta;
    var days = trip.days.slice().sort(function (a, b) { return a.n - b.n; });
    var byN = {};
    days.forEach(function (d) { byN[d.n] = d; });
    var firstId = 'day-' + pad2(days[0].n);

    var rail = days.map(function (d) {
      var dt = parseDate(d.date);
      return '<li><a href="#day-' + pad2(d.n) + '" data-day="' + d.n + '"><span class="ri">' + pad2(d.n) + '</span>' +
        '<span class="rd">' + md(dt) + '</span><span class="rc">' + esc(d.city) + '</span></a></li>';
    }).join('');

    var start = parseDate(m.start), end = parseDate(m.end);
    var tripDates = '<time datetime="' + attr(m.start) + '">' + dotted(start, true) + '</time> — <time datetime="' + attr(m.end) + '">' +
      dotted(end, end.getUTCFullYear() !== start.getUTCFullYear()) + '</time>';

    var cover = '';
    if (m.cover && m.cover.photo && trip.photos && trip.photos[m.cover.photo]) {
      var cp = trip.photos[m.cover.photo];
      var size = cp.width && cp.height ? ' width="' + cp.width + '" height="' + cp.height + '"' : '';
      var capText = m.cover.caption || '';
      var link = '';
      if (m.cover.day != null && byN[m.cover.day]) {
        var segs = capText.split(' · ');
        var what = m.cover.link_text || fmt(L.cover_link, { md: md(parseDate(byN[m.cover.day].date)), what: capText ? ' ' + segs[segs.length - 1] : '' });
        link = '<a href="#day-' + pad2(m.cover.day) + '">' + esc(what) + '</a>';
      }
      var ccredit = creditText(cp);
      cover = '\n      <figure class="cover">' +
        '\n        <img src="' + attr(photoSrc(cp)) + '"' + size + ' alt="' + attr(cp.alt || '') + '" fetchpriority="high">' +
        '\n        <figcaption><span>' + esc(capText) + (ccredit ? '<small class="credit">' + esc(L.photo_prefix) + esc(ccredit) + '</small>' : '') + '</span>' + link + '</figcaption>' +
        '\n      </figure>';
    }

    var journey = '';
    if (m.route && m.route.length) {
      journey = '\n      <ol class="journey" aria-label="' + attr(L.journey_aria) + '" style="--stops:' + Math.min(m.route.length, 8) + '">' +
        m.route.map(function (r) {
          var inner = esc(r.name) + (r.dates ? '<small>' + esc(r.dates) + '</small>' : '');
          return '\n        <li>' + (r.day != null && byN[r.day] ? '<a href="#day-' + pad2(r.day) + '">' + inner + '</a>' : '<span>' + inner + '</span>') + '</li>';
        }).join('') +
        '\n      </ol>';
    }

    var links = trip.links || {};
    var sites = links.sites || [], apps = links.apps || [];
    var hasLinks = sites.length || apps.length;
    var downloads = [];
    if (options.pdf) downloads.push('<a href="' + attr(options.pdf) + '" download>' + esc(L.download_pdf) + '</a>');
    (m.downloads || []).forEach(function (d) { downloads.push('<a href="' + attr(d.href) + '" download>' + esc(d.label) + '</a>'); });
    if (hasLinks) downloads.push('<a href="#apps">' + esc(L.links_title) + '</a>');
    var downloadsHtml = downloads.length
      ? '\n      <nav class="downloads" aria-label="' + attr(L.downloads_aria) + '">' + downloads.map(function (a) { return '\n        ' + a; }).join('') + '\n      </nav>'
      : '';

    var appsHtml = apps.map(function (a) {
      return '<div class="app"><b>' + esc(a.name) + '</b><span class="where">' + esc(a.where || '') + '</span><p>' + esc(a.why || '') + '</p></div>';
    }).join('');
    var sitesHtml = sites.map(function (s) {
      return '<div class="site"><a class="dom" href="' + attr(s.url || 'https://' + s.domain) + '" target="_blank" rel="noopener">' + esc(s.domain) +
        newTab + '</a><span>' + esc(s['for'] || '') + '</span></div>';
    }).join('');
    var intro = links.intro || [L.links_intro];

    // Documents and preparations before departure (visa, driving permit, insurance…).
    var prepHtml = (m.prep && m.prep.length)
      ? '\n      <section class="prep" aria-label="' + attr(L.prep) + '">\n        <h2>' + esc(L.prep) + '</h2><ul>' +
        m.prep.map(function (p) {
          return '<li><b>' + esc(p.item) + '</b>' + (p.detail ? '<span>' + esc(p.detail) + '</span>' : '') +
            (p.link ? '<a href="' + attr(p.link) + '" target="_blank" rel="noopener">' + esc(L.official) + newTab + '</a>' : '') + '</li>';
        }).join('') + '</ul>\n      </section>'
      : '';

    var todo = checklist(trip);
    var todoHtml = todo.length
      ? '\n      <details class="resources checklist" id="checklist"><summary>' + esc(fmt(L.checklist_summary, { n: todo.length })) + '</summary><ul>' +
        todo.map(function (it) {
          return '<li><a href="#' + rowId(it.day, it.row) + '"><time>' + pad2(it.day.n) + ' · ' + esc(it.row.time) + '</time> ' + esc(stopTitle(it.row)) + '</a>' +
            '<span>' + esc(it.why.join(L.list)) + '</span></li>';
        }).join('') + '</ul></details>'
      : '';

    var appsSection = hasLinks || todo.length
      ? '\n    <section class="apps" id="apps">' +
        '\n      <h2>' + esc(L.links_title) + '</h2>' +
        intro.map(function (p) { return '\n      <p class="sub">' + esc(p) + '</p>'; }).join('') +
        (sites.length ? '\n      <div class="sitegrid">' + sitesHtml + '</div>' : '') +
        (apps.length ? '\n      <details class="resources"><summary>' + esc(L.apps_summary) + '</summary><div class="appgrid">' + appsHtml + '</div></details>' : '') +
        todoHtml +
        '\n    </section>'
      : '';

    var credits = [];
    var seen = {};
    function credit(id) {
      if (!id || seen[id] || !trip.photos || !trip.photos[id]) return;
      seen[id] = true;
      var p = trip.photos[id];
      if (!p.author && !p.license) return;
      var name = p.title || String(p.commons || p.file || id).replace(/^File:/, '').replace(/^.*[\\/]/, '');
      // CC BY-SA asks for a link to the licence, not just its name. build.mjs caches Commons' LicenseUrl as license_url.
      var lic = !p.license ? '' : p.license_url
        ? '<a href="' + attr(p.license_url) + '" target="_blank" rel="noopener">' + esc(p.license) + newTab + '</a>'
        : esc(p.license);
      credits.push(esc(name) + esc(L.colon) + [p.author ? esc(p.author) : '', lic].filter(Boolean).join(esc(L.comma)) +
        (p.source ? esc(L.comma) + '<a href="' + attr(p.source) + '" target="_blank" rel="noopener">' + esc(L.source) + newTab + '</a>' : ''));
    }
    if (m.cover) credit(m.cover.photo);
    trip.sections.forEach(function (s) { credit(s.photo); });
    days.forEach(function (d) { d.rows.forEach(function (r) { credit(r.photo); }); });

    var title = m.page_title || m.title;
    // a function, not a string, as the replacement: a label with "$" in it must not be read as a pattern
    var js = JS.replace("(open?'收合':'展開')+(all?'全部原始備註':'原始備註')", function () {
      return '(open?' + jsStr(L.js_collapse) + ':' + jsStr(L.js_expand) + ')+(all?' + jsStr(L.js_all_notes) + ':' + jsStr(L.js_notes) + ')';
    });
    return '<!doctype html>\n<html lang="' + attr(L.lang) + '">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + esc(title) + '</title>\n' +
      (m.description ? '<meta name="description" content="' + attr(m.description) + '">\n' : '') +
      '<meta name="generator" content="travel-planner render.js">\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link rel="stylesheet" href="' + (L.fonts || LANGS['zh-Hant'].fonts) + '">\n' +
      '<style>' + CSS + (L.font_css || '') + '</style>\n</head>\n<body>\n' +
      '<a class="skip-link" href="#itinerary">' + esc(L.skip) + '</a>\n' +
      '<div class="shell">\n' +
      '  <nav class="rail" aria-label="' + attr(L.rail_aria) + '">\n' +
      '    <div class="brand">' + esc(L.brand) + '<small>' + esc(L.brand_small) + '</small></div>\n' +
      '    <ol>' + rail + '\n    </ol>\n  </nav>\n' +
      '  <main class="sheet" id="itinerary" tabindex="-1">\n' +
      '    <header class="masthead">\n' +
      '      <div class="titleline">\n' +
      '        <div><h1>' + esc(m.title) + '</h1>' + (m.subtitle ? '<p class="subtitle">' + esc(m.subtitle) + '</p>' : '') +
      (m.example_label ? '<p class="example-label">' + esc(m.example_label) + '</p>' : '') + '</div>\n' +
      '        <p class="trip-dates">' + tripDates + '</p>\n' +
      '      </div>' +
      '\n      <nav class="reading-start" aria-label="' + attr(L.reading_aria) + '"><a class="start-link" href="#' + firstId + '">' + esc(L.start) + '</a>' +
      (todo.length ? '<a href="#checklist">' + esc(fmt(L.todo_top, { n: todo.length })) + '</a>' : '') + '</nav>' +
      cover + journey + factsHtml(trip) + downloadsHtml +
      (m.notice ? '\n      <p class="guide-note">' + noticeHtml(m.notice, L) + '</p>' : '') + prepHtml +
      '\n      <p class="print-note">' + esc(L.print_note) + '</p>' +
      '\n      <div class="reading-tools"><div class="tools" hidden><button type="button" class="tg" data-scope="all">' + esc(L.expand_all) + '</button></div></div>' +
      '\n    </header>\n' +
      trip.sections.map(function (s) { return sectionHtml(trip, s, byN); }).join('') +
      appsSection +
      '\n    <footer class="colophon">' +
      '\n      <div>' + L.colophon.split('{link}').map(esc).join('<a href="' + CHANNEL + '" target="_blank" rel="noopener"><b>' + esc(L.channel_name) + '</b></a>') + '</div>' +
      (credits.length ? '\n      <div class="credits">' + esc(L.photo_prefix) + credits.join(esc(L.semi)) + '</div>' : '') +
      '\n    </footer>\n  </main>\n</div>\n' +
      '<script>' + js + '</script>\n</body>\n</html>';
  }

  // CSS and the interaction script are copied from build_itinerary_html.py.
  // Changes from that copy: fonts come from Google Fonts (the <link> above)
  // instead of local @font-face files; the route's column count follows the
  // number of stops; additions are marked "travel-planner:".
  var CSS = `
:root{
  --paper:#FAFAF7; --bone:#F2EFDF; --char:#2A2724; --rule-d:#3A3633; --rule:#D9D5C8;
  --ink:#121212; --ink-2:#5F5C56; --ink-ghost:#827E77; --ink-on-dark:#F2EFDF; --muted-on-dark:#8E8E8A;
  --accent:#C1583A; --sage:#86927A;
  --serif:"Noto Serif TC","Songti TC","PMingLiU",serif;
  --sans:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;
  --mono:"Sometype Mono",ui-monospace,Consolas,monospace;
  --rail-w:208px;
}
*{box-sizing:border-box}
[hidden]{display:none!important}
html{background:var(--paper);scroll-behavior:smooth;scrollbar-color:var(--ink-ghost) var(--paper)}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.7;font-variant-numeric:tabular-nums;-webkit-print-color-adjust:exact;print-color-adjust:exact}
::selection{background:var(--char);color:var(--bone)}
a{color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.skip-link{position:fixed;top:12px;left:12px;z-index:10;padding:10px 16px;background:var(--paper);color:var(--ink);transform:translateY(calc(-100% - 16px))}
.skip-link:focus{transform:none}
h1,h2{font-family:var(--serif);font-weight:700;margin:0;text-wrap:balance}
p{margin:0}

.shell{display:grid;grid-template-columns:var(--rail-w) minmax(0,1fr);min-height:100vh}

/* rail */
.rail{background:var(--char);color:var(--ink-on-dark);position:sticky;top:0;height:100vh;overflow:auto;scrollbar-width:thin;scrollbar-color:var(--rule-d) transparent;padding-block:16px;padding-inline:0}
.rail .brand{font-family:var(--serif);font-size:18px;padding:0 24px 14px;border-bottom:1px solid var(--rule-d);margin-bottom:6px;color:var(--ink-on-dark)}
.rail .brand small{display:block;font-family:var(--mono);font-size:12px;letter-spacing:.12em;color:var(--muted-on-dark);margin-top:4px}
.rail ol{list-style:none;margin:0;padding:0}
.rail a{display:grid;grid-template-columns:38px 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:baseline;padding:6px 18px 6px 24px;text-decoration:none;color:var(--muted-on-dark);transition:color .34s cubic-bezier(.215,.61,.355,1)}
.rail a:hover{color:var(--ink-on-dark)}
.rail a:focus-visible{outline-color:var(--ink-on-dark);outline-offset:-3px}
.rail a .ri{font-family:var(--mono);font-size:19px;font-weight:700;letter-spacing:-.03em;grid-row:1/3;align-self:start;line-height:1.25}
.rail a .rd{font-family:var(--mono);font-size:13px;letter-spacing:.02em}
.rail a .rc{font-size:13px;line-height:1.3;grid-column:2}
.rail a.active{color:var(--ink-on-dark)}
.rail a.active .ri{color:var(--ink-on-dark)}
.rail a.active::after{content:"";position:absolute;left:10px;top:14px;width:4px;height:4px;border-radius:50%;background:var(--accent)}
.rail a{position:relative}


/* sheet */
.sheet{padding:36px 48px 72px;max-width:1320px;margin:0 auto;width:100%;min-width:0}
.masthead h1{font-size:44px;line-height:1.3;letter-spacing:-.02em}
.titleline{display:flex;justify-content:space-between;align-items:end;gap:24px;padding-bottom:20px}
.subtitle{font-size:15px;color:var(--ink-2);margin-top:8px}
.trip-dates{font-family:var(--mono);font-size:13px;letter-spacing:-.02em;white-space:nowrap;color:var(--ink-2)}
.cover{margin:0}
.cover img{display:block;width:100%;height:280px;object-fit:cover;object-position:50% 53%;border-radius:3px}
.cover figcaption{display:flex;justify-content:space-between;gap:16px;padding-top:8px;font-size:12px;color:var(--ink-2)}
.cover figcaption a{text-underline-offset:3px}
.journey{margin:24px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(var(--stops,8),minmax(0,1fr))}
.journey li{min-width:0;position:relative;padding-top:15px}
.journey li::before{content:"";position:absolute;top:3px;left:0;right:0;height:1px;background:var(--rule)}
.journey li:last-child::before{right:calc(100% - 7px)}
.journey li::after{content:"";position:absolute;top:0;left:0;width:7px;height:7px;border:1px solid var(--char);border-radius:50%;background:var(--paper)}
.journey a{display:inline-block;text-decoration:none;font-size:13px;padding:0 8px 6px 0}
.journey a:hover{text-decoration:underline;text-underline-offset:4px}
.journey small{display:block;font-family:var(--mono);font-size:11px;color:var(--ink-2);margin-top:2px}
.tools{display:flex;gap:16px;align-items:center;margin-top:14px;font-size:12.5px;color:var(--ink-2)}
.tools button{font:inherit;font-family:var(--sans);font-size:13px;color:var(--ink);background:transparent;border:1px solid var(--rule);border-radius:3px;padding:8px 12px;min-height:40px;cursor:pointer}
.tools button:hover{background:var(--char);color:var(--bone);border-color:var(--char)}
.dayhead .tools{margin:0 0 3px;align-self:end;gap:10px}
.dayhead .tools button{font-size:12px;padding:6px 10px;color:var(--ink-2);border-color:var(--rule)}
.dayhead .tools button:hover{color:var(--bone)}

.city{margin-top:24px}
.hero{margin:48px 0 0;max-width:100%;border-top:1px solid var(--ink);padding-top:16px}
.hero img{width:100%;aspect-ratio:3/1;object-fit:cover;object-position:50% 40%;display:block;border-radius:3px}
.hero figcaption{padding:16px 0 0;display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap;color:var(--ink)}
.hero .latin{font-family:var(--mono);font-size:12px;letter-spacing:-.03em;color:var(--ink-2)}
.hero h2{font-family:var(--serif);font-size:30px;font-weight:700;line-height:1.15;margin:0}

.day{margin-top:34px;scroll-margin-top:24px}
.dayhead{display:grid;grid-template-columns:auto minmax(0,1fr) auto;column-gap:16px;align-items:end;padding-bottom:8px;border-bottom:1px solid var(--ink)}
.dayhead .idx{font-family:var(--mono);font-size:34px;font-weight:700;letter-spacing:-.03em;line-height:.9;color:var(--ink)}
.dayhead .date{font-family:var(--mono);font-size:12px;letter-spacing:.02em;color:var(--ink-2)}
.dayhead h3{font-family:var(--sans);font-size:20px;line-height:1.5;margin:4px 0 0;font-weight:500;text-wrap:balance}

.rows{list-style:none;margin:0;padding:0}
.row{display:grid;grid-template-columns:64px minmax(0,1fr) minmax(100px,170px);column-gap:18px;padding:16px 0;border-bottom:1px solid var(--rule);align-items:start}
.tk-col{display:flex;flex-direction:column;gap:2px}
.links{display:flex;flex-direction:column;align-items:flex-end;text-align:right;gap:3px;padding-top:2px;font-family:var(--mono);font-size:12px;letter-spacing:-.02em;max-width:240px}
.links .cost{font-size:13px;font-weight:700;color:var(--ink);letter-spacing:-.02em;margin-bottom:2px;white-space:normal}
.links a{color:var(--ink-2);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--ink-ghost);overflow-wrap:anywhere;padding-block:4px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.links a:hover{color:var(--ink);text-decoration-color:var(--ink)}
.row:last-child{border-bottom:0}
.row .t{font-family:var(--mono);font-size:14px;font-weight:700;letter-spacing:-.02em;line-height:1.5;white-space:nowrap}
.row .k{font-family:var(--mono);font-size:12px;color:var(--ink-2);letter-spacing:-.02em;line-height:1.3}
.row .act{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px}
.row .name{font-weight:500}
.row{scroll-margin-top:24px}
.essential{margin-top:6px;font-size:14px;line-height:1.7;max-width:72ch}
.cost-note{font-family:var(--sans);font-size:12px;line-height:1.6;font-weight:400;color:var(--ink-2)}
.brief{padding:16px 0;border-bottom:1px solid var(--rule)}
.day-route{display:flex;flex-wrap:wrap;gap:8px 20px;padding:0;margin:0 0 12px;list-style:none}
.day-route li{max-width:100%;font-size:13px}
.day-route a,.brief-meta a{color:var(--ink);text-decoration-color:var(--rule);text-underline-offset:4px}
.day-route time{font-family:var(--mono);font-size:12px;margin-right:4px;color:var(--ink-2)}
.brief-meta{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px 24px;margin:0;font-size:13px}
.brief-meta>div{display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px}
.brief-meta dt{color:var(--ink-2)}
.brief-meta dd{margin:0}
.brief-meta .attention{grid-column:1/-1}
.downloads{display:flex;gap:8px 20px;flex-wrap:wrap;align-items:center;margin-top:16px}
.downloads a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink);font-size:13px;text-underline-offset:4px}
.guide-note{color:var(--ink-2);font-size:12px;line-height:1.7;margin-top:8px;max-width:78ch}
.print-note{display:none}
.resources{margin-top:12px;border-top:1px solid var(--rule)}
.resources>summary{cursor:pointer;padding:12px 0;font-size:14px}
.reading-tools{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-top:12px}
.reading-tools a{font-size:13px;text-underline-offset:4px}
.reading-start{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;margin:0 0 20px;font-size:14px}
.reading-start a{display:inline-flex;align-items:center;min-height:44px;text-underline-offset:4px}
.reading-start .start-link{font-weight:500;border:1px solid var(--ink);border-radius:3px;padding:8px 16px;text-decoration:none}
.reading-start .start-link:hover{background:var(--char);color:var(--bone)}
.reading-tools .tools{margin-top:0}
.reading-tools button{border-color:transparent;padding-inline:0;color:var(--ink-2);text-decoration:underline;text-underline-offset:4px}
.reading-tools button:hover{background:transparent;color:var(--ink);border-color:transparent}
.checklist{scroll-margin-top:24px}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;line-height:1;padding:3px 7px;border-radius:3px;border:1px solid var(--rule);color:var(--ink-2)}
.chip.ok{color:var(--ink-2);border-color:var(--sage)}
.chip.ok .ic{color:var(--sage)}
.mk{width:11px;height:11px;vertical-align:-1.5px;margin-right:3px;color:var(--ink)}
.mk.ok{color:var(--sage)}
.chip.need{color:var(--ink);border-color:var(--ink);font-weight:500}
.chip.skip{color:var(--ink-2);border-style:dashed}
.row.skipped .name{text-decoration:line-through;text-decoration-color:var(--ink-2);text-decoration-thickness:1px;color:var(--ink-2)}
.row.skipped .essential,.row.skipped .t,.row.skipped .links .cost{color:var(--ink-2)}
.chip .ic{width:11px;height:11px}
.note{margin-top:7px;font-size:14px;line-height:1.8;color:var(--ink-2);max-width:72ch}
.note.one p{margin:0}
.note summary{cursor:pointer;list-style:none;display:inline-block;font-family:var(--sans);font-size:12px;color:var(--ink-2);border-bottom:1px solid var(--rule);margin-bottom:2px;padding-block:5px}
.note summary::-webkit-details-marker{display:none}
.note summary::before{content:"＋ "}
.note[open] summary::before{content:"－ "}
.note .more p{margin-top:5px}
.tk{font-family:var(--mono);font-size:12px;color:var(--ink);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--rule)}

.apps{margin-top:64px;padding-top:18px;border-top:1px solid var(--ink)}
.apps h2{font-size:24px}
.apps .sub{margin-top:6px;color:var(--ink-2);max-width:62ch}
.appgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 28px;margin-top:6px}
.app{padding:12px 0;border-bottom:1px solid var(--rule)}
.app b{font-weight:500;font-size:14px}
.app .where{display:block;font-family:var(--mono);font-size:12px;color:var(--ink-2);margin-top:2px}
.app p{margin-top:4px;font-size:12.5px;line-height:1.55;color:var(--ink-2)}
.sitegrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 24px}
.site{display:flex;flex-direction:column;padding:10px 0;border-bottom:1px solid var(--rule);font-size:12.5px;color:var(--ink-2)}
.site .dom{font-family:var(--mono);color:var(--ink);letter-spacing:-.02em;word-break:break-all}
.colophon a{color:var(--ink);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--ink-2)}
.colophon{margin-top:64px;padding:20px;background:var(--bone);border-top:1px solid var(--ink);font-size:12px;color:var(--ink-2);display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}
.colophon b{font-family:var(--serif);font-weight:700;color:var(--ink)}

/* travel-planner: additions */
.journey li>span{display:inline-block;font-size:13px;padding:0 8px 6px 0}
.example-label{font-size:13px;color:var(--ink-2);margin-top:6px}
.trip-facts{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 24px;margin:20px 0 0;font-size:13px}
.trip-facts>div{display:grid;grid-template-columns:56px minmax(0,1fr);gap:8px}
.trip-facts dt{color:var(--ink-2)}
.trip-facts dd{margin:0}
.trip-facts a{text-underline-offset:3px}
.credit{display:block;font-family:var(--sans);font-size:11px;line-height:1.5;color:var(--ink-2);font-weight:400}
.hero figcaption .credit{flex-basis:100%}
.chip.done{color:var(--ink-2);border-color:var(--sage)}
.row-photo{margin:10px 0 0;max-width:360px}
.row-photo img{display:block;width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:3px}
.checklist ul{list-style:none;margin:0;padding:0}
.checklist li{display:flex;flex-wrap:wrap;gap:2px 12px;padding:8px 0;border-bottom:1px solid var(--rule);font-size:13px}
.checklist li a{color:var(--ink);text-underline-offset:4px}
.checklist li time{font-family:var(--mono);font-size:12px;margin-right:4px;color:var(--ink-2)}
.checklist li span{color:var(--ink-2)}
.prep{margin-top:16px;border-top:1px solid var(--rule)}
.prep h2{font-family:var(--sans);font-size:14px;font-weight:500;margin:12px 0 2px}
.prep ul{list-style:none;margin:0;padding:0}
.prep li{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;padding:8px 0;border-bottom:1px solid var(--rule);font-size:13px}
.prep li b{font-weight:500}
.prep li span{color:var(--ink-2)}
.prep li a{color:var(--ink);text-underline-offset:4px}
.colophon .credits{flex-basis:100%;overflow-wrap:anywhere}

/* phone */
@media screen and (max-width:1100px) and (min-width:821px){
  .sheet{padding-inline:28px}
  .titleline{display:block}
  .trip-dates{margin-top:12px}
  .masthead h1{font-size:36px}
  .journey{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:12px}
  .row{grid-template-columns:52px minmax(0,1fr);column-gap:12px}
  .row .links{grid-column:2;flex-direction:row;flex-wrap:wrap;max-width:none;gap:4px 14px;text-align:left;align-items:start}
  .dayhead{grid-template-columns:auto minmax(0,1fr) auto}
  .dayhead .tools{grid-column:2;grid-row:2;margin-top:8px}
}
@media screen and (max-width:820px){
  :root{--rail-w:0px}
  .shell{grid-template-columns:minmax(0,1fr)}
  .rail{position:sticky;top:0;height:auto;z-index:5;padding:0;overflow:visible;min-width:0;max-width:100vw;border-bottom:1px solid var(--rule-d)}
  .rail .brand{display:none}
  .rail ol{display:flex;min-width:0;overflow-x:auto;scrollbar-width:none;padding:8px 12px;gap:2px;scroll-snap-type:x proximity}
  .rail ol::-webkit-scrollbar{display:none}
  .rail li{scroll-snap-align:start}
  .rail a{grid-template-columns:auto;grid-template-rows:auto auto auto auto;padding:6px 12px 5px;min-width:72px;row-gap:0}
  .rail a .ri{grid-row:1;font-size:14px;line-height:1.1}
  .rail a .rd{grid-row:2;font-size:12px}
  .rail a.active .ri{color:var(--ink-on-dark)}
  .rail a.active::after{left:3px;top:11px}
  .rail a .rc{display:block;grid-row:3;grid-column:1;font-size:13px;white-space:nowrap;line-height:1.3;margin-top:1px}
  .sheet{padding:24px 20px 48px}
  .titleline{display:block;padding-bottom:16px}
  .masthead h1{font-size:clamp(24px,6.8vw,34px)}
  .subtitle{font-size:14px;margin-top:6px}
  .trip-dates{margin-top:10px;font-size:12px}
  .cover img{height:190px;object-position:50% 55%}
  .cover figcaption{font-size:13px;gap:8px}
  .journey{grid-template-columns:repeat(4,minmax(0,1fr));row-gap:12px;margin-top:20px}
  .journey a{font-size:13px}
  .journey small{font-size:12px}
  .hero img{aspect-ratio:16/9}
  .hero h2{font-size:24px}
  .appgrid{grid-template-columns:1fr}
  .trip-facts{grid-template-columns:1fr}
  .sitegrid{grid-template-columns:1fr 1fr}
  .day{scroll-margin-top:110px}
  .tools{gap:12px;flex-wrap:wrap}
  .tools button{min-height:44px}
  .row{grid-template-columns:52px minmax(0,1fr);grid-template-rows:auto auto;column-gap:10px}
  .row .a{grid-column:2;grid-row:1}
  .row .links{grid-column:2;grid-row:2;flex-direction:row;flex-wrap:wrap;gap:3px 12px;max-width:none;padding-top:2px}
  .row .links{align-items:flex-start;text-align:left}
  .row .links .cost{flex-basis:100%;margin-bottom:0}
  .row .links .cost-note{flex-basis:100%}
  .row{scroll-margin-top:100px}
  .brief-meta{grid-template-columns:1fr}
  .day-route{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 12px}
  .day-route a{display:block;padding-block:5px}
  .day-route time{display:block}
  .downloads{gap:4px 16px;margin-top:12px}
  .dayhead{grid-template-columns:44px minmax(0,1fr);gap:8px 10px}
  .dayhead .idx{grid-column:1;grid-row:1;font-size:30px;align-self:start;padding-top:5px}
  .dayhead .meta{grid-column:2;grid-row:1}
  .dayhead h3{font-size:18px}
  .dayhead .tools{display:flex;grid-column:2;grid-row:2;margin:0}
  .links a{padding-block:10px;min-height:44px;display:inline-flex;align-items:center}
  .note summary{display:flex;align-items:center;min-height:44px;font-size:13px;width:fit-content;gap:4px}
  .guide-note,.cost-note{font-size:13px}
  .checklist{scroll-margin-top:110px}
}

/* print */
@page{size:A4;margin:14mm 14mm 16mm}
@media print{
  :root{--sans:"Microsoft JhengHei","Arial",sans-serif;--mono:"Consolas",monospace}
  body{font-size:14px}
  html,body{background:#fff}
  .shell{display:block}
  .rail{display:none}
  .sheet{padding:0;max-width:none}
  .masthead{break-after:page;min-height:calc(297mm - 30mm);display:flex;flex-direction:column}
  .titleline{display:block}
  .trip-dates{margin-top:12px}
  .cover{margin-top:16px}
  .cover img{height:68mm}
  .cover figcaption a{display:none}
  .journey{margin-top:20px}
  .city{margin-top:0;break-before:auto}
  .apps{break-before:page}
  .app,.site{break-inside:avoid}
  .day{break-before:page;break-inside:auto;margin-top:0}
  .dayhead{break-after:avoid;break-inside:avoid}
  .row{break-inside:avoid}
  .row{grid-template-columns:52px minmax(0,1fr) 150px}
  .links a{text-decoration:none}
  .tools{display:none}
  .skip-link,.downloads,.reading-start,.reading-tools,.resources,.row.skipped{display:none}
  .guide-note,.print-note{display:block;font-size:12px;line-height:1.7;margin-top:16px;color:var(--ink-2)}
  details.note{display:none}
  .brief{break-inside:avoid;break-after:avoid}
  .brief-meta{font-size:12px}
  .day-route{gap:4px 12px}
  .essential,.note.one{font-size:12px;line-height:1.65}
  .row{padding-block:6px}
  .row .name{font-size:14px}
  .cost-note{font-size:12px}
  .hero{display:none}
  .row-photo{display:none}
  .trip-facts{font-size:12px}
  a{text-decoration:none}
}
`;

  var JS = `
(function(){
  var checklist=document.getElementById('checklist');
  function revealChecklist(){if(checklist)checklist.open=true}
  document.querySelectorAll('a[href="#checklist"]').forEach(function(a){a.addEventListener('click',revealChecklist)});
  if(window.location.hash==='#checklist')revealChecklist();
  window.addEventListener('hashchange',function(){if(window.location.hash==='#checklist')revealChecklist()});
  var links=[].slice.call(document.querySelectorAll('.rail a[data-day]'));
  var byDay={};links.forEach(function(a){byDay[a.dataset.day]=a});
  var current=null;
  function setActive(n){
    if(n===current)return;current=n;
    links.forEach(function(a){var active=a.dataset.day===n;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current')});
    var a=byDay[n];if(a&&window.matchMedia('(max-width:820px)').matches){
      var rail=a.closest('ol'),box=a.getBoundingClientRect(),frame=rail.getBoundingClientRect();
      rail.scrollTo({left:rail.scrollLeft+box.left-frame.left-(frame.width-box.width)/2,behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
    }
  }
  if('IntersectionObserver' in window){
    var days=[].slice.call(document.querySelectorAll('.day'));
    var io=new IntersectionObserver(function(){
      var vis=days.filter(function(d){return d.getBoundingClientRect().top<window.innerHeight*0.45});
      if(vis.length)setActive(vis[vis.length-1].dataset.day);
    },{rootMargin:'-40% 0px -50% 0px',threshold:[0,0.1,0.5,1]});
    days.forEach(function(d){io.observe(d)});
    var firstDay=days[0];
    if(firstDay)setActive(firstDay.dataset.day);
    window.addEventListener('scroll',function(){if(firstDay&&window.scrollY<firstDay.offsetTop-window.innerHeight*0.45)setActive(firstDay.dataset.day)},{passive:true});
  }
  function setAll(scope,open){scope.querySelectorAll('details.note').forEach(function(d){d.open=open})}
  function label(btn,open,all){btn.textContent=(open?'收合':'展開')+(all?'全部原始備註':'原始備註')}
  var key='travel-planner-original-notes-v1';var pref=null;try{pref=localStorage.getItem(key)}catch(e){}
  var allOpen=pref==='1';
  setAll(document,allOpen);
  var buttons=[].slice.call(document.querySelectorAll('.tg')).filter(function(b){return (b.dataset.scope==='all'?document:b.closest('.day')).querySelector('details.note')});
  function sync(){buttons.forEach(function(b){var all=b.dataset.scope==='all',scope=all?document:b.closest('.day');label(b,!scope.querySelector('details.note:not([open])'),all)})}
  buttons.forEach(function(b){b.addEventListener('click',function(){var all=b.dataset.scope==='all',scope=all?document:b.closest('.day'),open=!!scope.querySelector('details.note:not([open])');setAll(scope,open);sync();if(all)try{localStorage.setItem(key,open?'1':'0')}catch(e){}});b.closest('.tools').hidden=false});
  document.querySelectorAll('details.note').forEach(function(d){d.addEventListener('toggle',sync)});sync();
})();
`;

  var api = {
    renderTrip: renderTrip,
    validateTrip: validateTrip,
    chipsFor: chipsFor,
    costView: costView,
    checklist: checklist,
    noteHtml: noteHtml,
    photoSrc: photoSrc,
    stopTitle: stopTitle,
    esc: esc,
    attr: attr,
    LANGS: LANGS,
    PLAN: PLAN,
    BOOKING: BOOKING,
    TYPE: TYPE
  };
  root.TravelPlanner = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
