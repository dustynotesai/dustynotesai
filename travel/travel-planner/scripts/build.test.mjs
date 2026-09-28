import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildTrip, printPdf, TP } from './build.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-planner-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const trip = {
    schema: 1,
    meta: {
      title: '測試行程', start: '2027-03-10', end: '2027-03-10',
      travellers: { count: 1 }, currency: { home: 'CAD', local: [] }
    },
    photos: { city: { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' } },
    sections: [{ name: '測試城市', days: [1], photo: 'city' }],
    days: [{
      n: 1, date: '2027-03-10', city: '測試城市', title: '抵達',
      brief: { route: ['09:00'], fixed: [], stay: '回家', attention: '測試資料，不能作為旅行建議。' },
      rows: [{
        time: '09:00', act: '抵達車站', type: '交通', plan: '規劃中', booking: '未訂',
        cost: '—', essential: '測試指示', verified: false,
        sources: ['https://example.com/timetable?day=1&lang=zh']
      }]
    }]
  };
  const jsonPath = path.join(dir, 'trip.json');
  const htmlPath = path.join(dir, 'trip.html');
  const pdfPath = path.join(dir, 'trip.pdf');
  fs.writeFileSync(jsonPath, JSON.stringify(trip));
  return { dir, trip, jsonPath, htmlPath, pdfPath };
}

test('HTML-only rebuild does not offer an older PDF', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.pdfPath, 'old itinerary');
  const result = await buildTrip({ trip: f.jsonPath });
  assert.equal(result.pdfPath, null);
  assert.doesNotMatch(fs.readFileSync(f.htmlPath, 'utf8'), /href="trip\.pdf"/);
  assert.equal(fs.readFileSync(f.pdfPath, 'utf8'), 'old itinerary');
  assert.ok(result.warnings.some((w) => w.includes('PDF')));
});

test('missing Chrome leaves the new HTML usable without linking the old PDF', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.pdfPath, 'old itinerary');
  const result = await buildTrip({ trip: f.jsonPath, pdf: true }, { findChrome: () => null });
  assert.equal(result.pdf.ok, false);
  assert.equal(result.pdfPath, null);
  assert.doesNotMatch(fs.readFileSync(f.htmlPath, 'utf8'), /href="trip\.pdf"/);
  assert.equal(fs.readFileSync(f.pdfPath, 'utf8'), 'old itinerary');
});

test('failed PDF refresh preserves the old file without offering it as current', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.pdfPath, 'old itinerary');
  const result = await buildTrip({ trip: f.jsonPath, pdf: true }, {
    findChrome: () => 'test-chrome', printPdf: () => ({ ok: false, detail: 'simulated failure' })
  });
  assert.equal(result.pdf.ok, false);
  assert.equal(result.pdfPath, null);
  assert.doesNotMatch(fs.readFileSync(f.htmlPath, 'utf8'), /href="trip\.pdf"/);
  assert.equal(fs.readFileSync(f.pdfPath, 'utf8'), 'old itinerary');
});

test('successful PDF refresh enables the download link', async (t) => {
  const f = fixture(t);
  const result = await buildTrip({ trip: f.jsonPath, pdf: true }, {
    findChrome: () => 'test-chrome',
    printPdf: (_chrome, htmlPath, pdfPath) => {
      assert.equal(htmlPath, f.htmlPath);
      assert.ok(fs.existsSync(htmlPath));
      fs.writeFileSync(pdfPath, '%PDF-1.7\nnew itinerary');
      return { ok: true };
    }
  });
  assert.equal(result.pdfPath, f.pdfPath);
  assert.match(fs.readFileSync(f.htmlPath, 'utf8'), /href="trip\.pdf"/);
});

test('a newly modified old PDF is not mistaken for successful printing', (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.pdfPath, '%PDF-1.7\nold itinerary');
  const result = printPdf('test-chrome', f.htmlPath, f.pdfPath, () => ({ status: 0, stderr: '' }));
  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(f.pdfPath, 'utf8'), '%PDF-1.7\nold itinerary');
});

test('a successful print replaces the PDF only after a new PDF exists', (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.pdfPath, '%PDF-1.7\nold itinerary');
  const result = printPdf('test-chrome', f.htmlPath, f.pdfPath, (_chrome, args) => {
    const target = args.find((arg) => arg.startsWith('--print-to-pdf=')).slice('--print-to-pdf='.length);
    assert.notEqual(target, f.pdfPath);
    assert.equal(fs.readFileSync(f.pdfPath, 'utf8'), '%PDF-1.7\nold itinerary');
    fs.writeFileSync(target, '%PDF-1.7\nnew itinerary');
    return { status: 0, stderr: '' };
  });
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(f.pdfPath, 'utf8'), '%PDF-1.7\nnew itinerary');
});

test('invalid print output does not replace the existing PDF', (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.pdfPath, '%PDF-1.7\nold itinerary');
  const result = printPdf('test-chrome', f.htmlPath, f.pdfPath, (_chrome, args) => {
    const target = args.find((arg) => arg.startsWith('--print-to-pdf=')).slice('--print-to-pdf='.length);
    fs.writeFileSync(target, 'not a PDF');
    return { status: 0, stderr: '' };
  });
  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(f.pdfPath, 'utf8'), '%PDF-1.7\nold itinerary');
});

test('research sources appear as clickable links even without notes', (t) => {
  const { trip } = fixture(t);
  assert.deepEqual(TP.validateTrip(trip).errors, []);
  const html = TP.renderTrip(trip);
  assert.match(html, /href="https:\/\/example\.com\/timetable\?day=1&amp;lang=zh"/);
});

test('the same package works from Codex and Claude installation folders', (t) => {
  const f = fixture(t);
  const skill = fileURLToPath(new URL('../', import.meta.url));
  const outputs = [];
  for (const host of ['.agents', '.claude']) {
    const installed = path.join(f.dir, '我的旅行 workspace', host, 'skills', 'travel-planner');
    fs.cpSync(skill, installed, { recursive: true });
    const out = path.join(f.dir, host + '.html');
    const result = spawnSync(process.execPath, [path.join(installed, 'scripts/build.mjs'), f.jsonPath, '--out', out], {
      cwd: f.dir, encoding: 'utf8', windowsHide: true, timeout: 10000
    });
    assert.equal(result.status, 0, result.stderr);
    const html = fs.readFileSync(out, 'utf8');
    assert.ok(html.includes('測試行程'));
    assert.ok(html.includes('https://example.com/timetable?day=1&amp;lang=zh'));
    outputs.push(html);
  }
  assert.equal(outputs[0], outputs[1]);
});

test('a redacted HTML rebuild cannot link to the older unredacted PDF', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.pdfPath, 'private old PDF');
  f.trip.meta.title = 'Private hotel';
  fs.writeFileSync(f.jsonPath, JSON.stringify(f.trip));
  const redact = path.join(f.dir, 'redactions.json');
  fs.writeFileSync(redact, JSON.stringify({ replace: [['Private hotel', 'Hotel']], banned: ['Private hotel'] }));
  await buildTrip({ trip: f.jsonPath, redact });
  const html = fs.readFileSync(f.htmlPath, 'utf8');
  assert.ok(!html.includes('Private hotel'));
  assert.ok(!html.includes('href="trip.pdf"'));
});
