#!/usr/bin/env node
// travel-planner · build.mjs
//
//   node build.mjs <trip.json> [--out file.html] [--redact redactions.json] [--pdf]
//
// Node 18+, no npm packages. Validates trip.json, embeds photos as data URIs
// (local files, or Wikimedia Commons with credits, cached in photos/ next to
// trip.json), renders a static page with render.js, and optionally prints the
// compact A4 PDF with an installed Chrome.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(HERE, 'render.js')).href);
export const TP = globalThis.TravelPlanner;

export const USER_AGENT = 'DustyNotes-travel-planner/1 (https://www.youtube.com/@DustyNotesAI; itinerary page builder)';
const SIZE_WARN = 15 * 1024 * 1024;
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml'
};

export class BuildError extends Error {
  constructor(message, list = []) { super(message); this.list = list; }
}

// ---------- arguments ----------
export function parseArgs(argv) {
  const opts = { trip: null, out: null, redact: null, pdf: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--pdf') opts.pdf = true;
    else if (a === '--out' || a === '--redact') {
      const v = argv[++i];
      if (!v || v.startsWith('--')) throw new BuildError(`${a} 後面要接檔案路徑`);
      opts[a.slice(2)] = v;
    } else if (a.startsWith('--out=')) opts.out = a.slice(6);
    else if (a.startsWith('--redact=')) opts.redact = a.slice(9);
    else if (a.startsWith('-')) throw new BuildError(`不認得的參數 ${a}`);
    else if (!opts.trip) opts.trip = a;
    else throw new BuildError(`多了一個參數 ${a}（一次只建一份 trip.json）`);
  }
  return opts;
}

export function readJson(file, what = 'JSON') {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { throw new BuildError(`讀不到 ${what}：${file}（${e.code || e.message}）`); }
  try { return JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { throw new BuildError(`${what} 不是合法的 JSON：${file}\n  ${e.message}`); }
}

// ---------- validation ----------
// render.js checks the structure; this adds what needs the disk.
export function validate(trip, baseDir) {
  const result = TP.validateTrip(trip);
  const errors = result.errors.slice();
  const photos = trip && typeof trip.photos === 'object' && trip.photos ? trip.photos : {};
  for (const [id, p] of Object.entries(photos)) {
    if (!p || typeof p.file !== 'string' || !p.file) continue;
    const f = path.resolve(baseDir, p.file);
    if (!fs.existsSync(f)) errors.push(`photos.${id}.file：找不到 ${p.file}（相對於 trip.json 的位置）`);
    else if (!MIME[path.extname(f).toLowerCase()]) errors.push(`photos.${id}.file：不支援的圖片格式 ${path.extname(f)}`);
  }
  return { errors, warnings: result.warnings, usedPhotos: result.usedPhotos };
}

// ---------- photos ----------
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function dataUri(buf, ext) {
  return `data:${MIME[ext.toLowerCase()] || 'application/octet-stream'};base64,${buf.toString('base64')}`;
}

function plainText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'")
    .replace(/\s+/g, ' ').replace(/([(（[]) | ([)）\]，,.;；])/g, '$1$2').trim();
}

function cacheStem(title) {
  return title.replace(/^File:/, '').replace(/\.[A-Za-z0-9]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
}

// File:… → { buf, ext, width, height, author, license, license_url, source }
export async function commonsPhoto(title, cacheDir, fetchImpl = globalThis.fetch) {
  const stem = cacheStem(title) + '-800';
  const metaFile = path.join(cacheDir, stem + '.json');
  if (fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const img = path.join(cacheDir, meta.cached || '');
    if (meta.title === title && fs.existsSync(img)) {
      return { ...meta, buf: fs.readFileSync(img), ext: path.extname(img), cachedHit: true };
    }
  }
  if (typeof fetchImpl !== 'function') throw new Error('這個 Node 沒有 fetch（要 Node 18 以上）');
  const headers = { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT };
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k, v] of Object.entries({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo',
    iiprop: 'url|size|extmetadata', iiurlwidth: '800', titles: title
  })) api.searchParams.set(k, v);
  const res = await fetchImpl(api.href, { headers });
  if (!res.ok) throw new Error(`Commons API 回 ${res.status}`);
  const data = await res.json();
  const page = data && data.query && data.query.pages && data.query.pages[0];
  if (!page || page.missing || page.invalid) throw new Error(`Commons 上沒有 ${title}`);
  const info = page.imageinfo && page.imageinfo[0];
  if (!info) throw new Error(`Commons 沒給 ${title} 的圖片資訊`);
  const url = info.thumburl || info.url;
  const img = await fetchImpl(url, { headers });
  if (!img.ok) throw new Error(`下載 ${url} 回 ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  const ext = (path.extname(new URL(url).pathname) || '.jpg').toLowerCase();
  const em = info.extmetadata || {};
  const size = imageSize(buf);
  const meta = {
    title,
    cached: stem + ext,
    width: (size && size.width) || info.thumbwidth || info.width || null,
    height: (size && size.height) || info.thumbheight || info.height || null,
    author: plainText(em.Artist && em.Artist.value) || plainText(em.Credit && em.Credit.value),
    license: plainText(em.LicenseShortName && em.LicenseShortName.value),
    license_url: (em.LicenseUrl && em.LicenseUrl.value) || '',
    source: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    fetched: new Date().toISOString().slice(0, 10)
  };
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, meta.cached), buf);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
  return { ...meta, buf, ext };
}

// Returns { photos: { id: photo-with-src-token }, embeds: [[token, dataUri]], warnings }
export async function resolvePhotos(trip, baseDir, { ids, fetch: fetchImpl = globalThis.fetch, cacheDir } = {}) {
  const warnings = [], embeds = [];
  const photos = {};
  const src = trip.photos || {};
  const wanted = ids || Object.keys(src);
  cacheDir = cacheDir || path.join(baseDir, 'photos');
  let n = 0;
  for (const id of Object.keys(src)) {
    const p = { ...src[id] };
    photos[id] = p;
    if (!wanted.includes(id)) continue;
    try {
      let buf, ext, meta = {};
      if (p.file) {
        const f = path.resolve(baseDir, p.file);
        buf = fs.readFileSync(f);
        ext = path.extname(f);
      } else if (p.commons) {
        ({ buf, ext, ...meta } = await commonsPhoto(p.commons, cacheDir, fetchImpl));
      } else continue;
      const size = imageSize(buf) || (meta.width && meta.height ? { width: meta.width, height: meta.height } : null);
      if (size && !p.width) { p.width = size.width; p.height = size.height; }
      for (const k of ['author', 'license', 'license_url', 'source']) if (!p[k] && meta[k]) p[k] = meta[k];
      const token = `@tp-photo-${n++}@`;
      p.src = token;
      embeds.push([token, dataUri(buf, ext)]);
      if (!p.author || !p.license) warnings.push(`photos.${id}：沒有 author／license，公開前要補上照片出處`);
    } catch (e) {
      warnings.push(`photos.${id}：${e.message}${p.commons ? '；頁面改用 Commons 網址，離線時看不到這張' : ''}`);
    }
  }
  return { photos, embeds, warnings };
}

// ---------- redactions ----------
// Same order as build_itinerary_html.py: every "replace" pair, every "regex"
// pair, then fail if any "banned" word is still on the page.
export function applyRedactions(html, rules) {
  const unused = [];
  for (const [from, to] of rules.replace || []) {
    const parts = html.split(from);
    if (parts.length === 1) unused.push(from);
    html = parts.join(to);
  }
  for (const [pattern, to] of rules.regex || []) {
    // Python syntax in the rules file: (?P<name>…) groups, \1 and \g<name> in the replacement.
    const re = new RegExp(pattern.replace(/\(\?P</g, '(?<'), 'g');
    let hit = false;
    html = html.replace(re, (...m) => {
      hit = true;
      const groups = typeof m[m.length - 1] === 'object' && m[m.length - 1] ? m[m.length - 1] : {};
      return String(to).replace(/\\g<(\w+)>|\\(\d+)/g, (_, name, num) => {
        const v = name != null ? (/^\d+$/.test(name) ? m[+name] : groups[name]) : m[+num];
        return v == null ? '' : v;
      });
    });
    if (!hit) unused.push(pattern);
  }
  const leaks = (rules.banned || []).filter((w) => html.includes(w));
  return { html, leaks, unused };
}

// ---------- chrome ----------
export function findChrome(env = process.env, exists = fs.existsSync) {
  const candidates = [
    env.HYPERFRAMES_BROWSER_PATH,
    env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ].filter(Boolean);
  return candidates.find((c) => exists(c)) || null;
}

export function printPdf(chrome, htmlPath, pdfPath) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-planner-chrome-'));
  const started = Date.now();
  try {
    const r = spawnSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      `--user-data-dir=${profile}`, '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=15000', `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href
    ], { timeout: 180000, encoding: 'utf8' });
    const ok = fs.existsSync(pdfPath) && fs.statSync(pdfPath).mtimeMs >= started - 2000;
    if (!ok) {
      const detail = (r.error && r.error.message) || String(r.stderr || '').trim().split('\n').slice(-3).join(' / ');
      return { ok: false, detail: detail || `Chrome 結束碼 ${r.status}` };
    }
    return { ok: true };
  } finally {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock */ }
  }
}

// ---------- build ----------
export async function buildTrip(opts, { fetch: fetchImpl = globalThis.fetch, log = () => {} } = {}) {
  const tripPath = path.resolve(opts.trip);
  const baseDir = path.dirname(tripPath);
  const trip = readJson(tripPath, 'trip.json');
  const { errors, warnings, usedPhotos } = validate(trip, baseDir);
  if (errors.length) throw new BuildError(`trip.json 有 ${errors.length} 個問題，改好再建：`, errors);

  const outPath = path.resolve(opts.out || path.join(baseDir, path.basename(tripPath, path.extname(tripPath)) + '.html'));
  const pdfPath = outPath.replace(/\.html?$/i, '') + '.pdf';
  const rules = opts.redact ? readJson(path.resolve(opts.redact), 'redactions') : null;

  const resolved = await resolvePhotos(trip, baseDir, { ids: usedPhotos, fetch: fetchImpl });
  warnings.push(...resolved.warnings);
  // 編出來的 Commons 檔名長得跟真的一樣，只有抓的時候才看得出來。Commons 說沒有這個
  // 檔案，就是編的，城市分段那一張不能這樣過去。連不上網是另一回事，那個照舊只警告。
  const invented = (trip.sections || [])
    .filter((s) => s && s.photo && resolved.warnings.some((w) => w.startsWith(`photos.${s.photo}：Commons 上沒有`)))
    .map((s) => `sections「${s.name}」的照片 ${s.photo}：Commons 上沒有這個檔案，換一張真的有的`);
  if (invented.length) throw new BuildError(`${invented.length} 段城市的照片是編的，改好再建：`, invented);
  const forRender = { ...trip, photos: resolved.photos };

  let reportedUnused = false;
  const render = (withPdf) => {
    let html = TP.renderTrip(forRender, { pdf: withPdf ? path.basename(pdfPath) : null });
    if (rules) {
      const r = applyRedactions(html, rules);
      if (r.leaks.length) {
        throw new BuildError(`遮蔽之後頁面上還有：${r.leaks.join('、')}——在 ${opts.redact} 加一條規則`, r.leaks);
      }
      if (!reportedUnused) r.unused.forEach((u) => warnings.push(`遮蔽規則沒有對到任何字：${u}`));
      reportedUnused = true;
      html = r.html;
    }
    for (const [token, uri] of resolved.embeds) html = html.split(token).join(uri);
    return html;
  };

  const linkPdf = opts.pdf || fs.existsSync(pdfPath);
  let html = render(linkPdf);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  const bytes = Buffer.byteLength(html);
  if (bytes > SIZE_WARN) warnings.push(`頁面 ${(bytes / 1048576).toFixed(1)} MB，超過 15 MB：照片太多或太大`);

  let pdf = null;
  if (opts.pdf) {
    const chrome = findChrome();
    if (!chrome) {
      pdf = { ok: false, detail: '找不到 Chrome（可以用 CHROME_PATH 或 HYPERFRAMES_BROWSER_PATH 指定路徑）' };
    } else {
      log(`用 ${chrome} 印 PDF…`);
      pdf = printPdf(chrome, outPath, pdfPath);
    }
    if (!pdf.ok && !fs.existsSync(pdfPath)) {
      // no PDF to download: drop the link rather than ship a dead one
      html = render(false);
      fs.writeFileSync(outPath, html);
    }
  }

  const rows = trip.days.reduce((s, d) => s + d.rows.length, 0);
  const booked = trip.days.reduce((s, d) => s + d.rows.filter((r) => r.booking === '已訂').length, 0);
  return { outPath, pdfPath: pdf && pdf.ok ? pdfPath : null, pdf, warnings, bytes, days: trip.days.length, rows, booked };
}

const USAGE = `用法：node build.mjs <trip.json> [--out 檔案.html] [--redact 遮蔽規則.json] [--pdf]

  --out      輸出的 HTML，預設是 trip.json 旁邊同名的 .html
  --redact   公開前的遮蔽規則：{ "replace": [[舊, 新]…], "regex": [[樣式, 新]…], "banned": [字…] }
  --pdf      用本機的 Chrome 印 A4 精簡版 PDF（找不到 Chrome 就跳過）`;

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(e.message + '\n\n' + USAGE);
    return 2;
  }
  if (opts.help || !opts.trip) {
    (opts.help ? console.log : console.error)(USAGE);
    return opts.help ? 0 : 2;
  }
  try {
    const r = await buildTrip(opts, { log: (m) => console.log(m) });
    for (const w of r.warnings) console.warn(`警告：${w}`);
    console.log(`寫好了 ${r.outPath}：${r.days} 天、${r.rows} 格、${r.booked} 格已訂、${(r.bytes / 1048576).toFixed(1)} MB`);
    if (r.pdf) {
      if (r.pdf.ok) console.log(`PDF：${r.pdfPath}`);
      else console.log(`沒有產生 PDF：${r.pdf.detail}。HTML 照樣寫好了。`);
    }
    return 0;
  } catch (e) {
    if (e instanceof BuildError) {
      console.error(e.message);
      for (const item of e.list) console.error(`  - ${item}`);
      return 1;
    }
    console.error(e.stack || e.message);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
