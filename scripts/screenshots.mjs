// End-to-end smoke test and screenshots. Requires `npm run build` first.
// Uses Chromium's fake microphone fed from tests/fixtures/prep-vi.wav, then runs real Whisper (WASM) in the page.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const wav = resolve('tests/fixtures/prep-vi.wav');
mkdirSync('screenshots', { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone', 'clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(BASE);
await page.waitForSelector('.hero');

// Seed realistic data directly in IndexedDB.
const ids = await page.evaluate(async () => {
  const open = () => new Promise((res, rej) => { const r = indexedDB.open('omni-feyn', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await open();
  const put = (store, v) => new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(v); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  const now = new Date();
  const iso = (d) => new Date(now.getTime() - d * 864e5).toISOString();
  const day = (d) => iso(d).slice(0, 10);
  const id = () => crypto.randomUUID();
  const deep = {
    id: 'deep-eu', title: 'Khủng hoảng năng lượng châu Âu 2021-2023', depth: 'deep', coreQuestion: 'Vì sao châu Âu rơi vào khủng hoảng năng lượng, và điều đó thay đổi Liên minh châu Âu như thế nào?',
    sources: [
      { id: 's1', title: 'IEA - Gas Market Report', url: 'https://www.iea.org/reports/gas-market-report-q1-2023', note: 'Nhập khẩu khí đốt từ Nga giảm mạnh sau 2022. LNG thay thế một phần.', status: 'done' },
      { id: 's2', title: 'Bruegel - National fiscal policy responses', url: 'https://www.bruegel.org/dataset/national-policies-shield-consumers-rising-energy-prices', note: 'Các nước chi hàng trăm tỷ euro để trợ giá điện, khí đốt.', status: 'reading' },
      { id: 's3', title: 'Eurostat - Energy statistics', url: 'https://ec.europa.eu/eurostat/web/energy', note: '', status: 'todo' },
    ],
    keyPoints: [ 'Phụ thuộc khí đốt Nga', 'Giá điện tăng theo giá khí đốt', 'Chuyển sang LNG nhập khẩu', 'Trợ giá năng lượng cho hộ gia đình', 'Đẩy nhanh năng lượng tái tạo' ].map((text) => ({ id: id(), text })),
    openQuestions: [ { id: id(), text: 'Thị trường điện EU định giá theo nhà máy biên như thế nào?', done: false }, { id: id(), text: 'Đức thay thế khí đốt Nga bằng nguồn nào?', done: true } ],
    stage: 'understand',
    readingLog: [ { id: id(), date: day(12), minutes: 45, sourceId: 's1', note: 'Đọc tóm tắt điều hành' }, { id: id(), date: day(9), minutes: 60, sourceId: 's2', note: 'Bảng số liệu trợ giá' }, { id: id(), date: day(3), minutes: 30, note: 'Xem lại dòng thời gian 2022' } ],
    milestones: [ { id: id(), text: 'Đọc tổng quan, ghi 5 câu hỏi', done: true }, { id: id(), text: 'Đọc nguồn sơ cấp / số liệu gốc', done: false, due: day(-7) }, { id: id(), text: 'Viết dàn ý giải thích một trang', done: false }, { id: id(), text: 'Giảng lại 10 phút không nhìn ghi chú', done: false } ],
    review: { step: 1, due: day(0), history: [ { date: day(4), score: 72 } ] }, createdAt: iso(20), updatedAt: iso(0),
  };
  const infl = {
    id: 'day-inflation', title: 'Lạm phát hoạt động thế nào', depth: 'day', coreQuestion: 'Lạm phát là gì và vì sao ngân hàng trung ương tăng lãi suất để chống lạm phát?',
    sources: [ { id: 's4', title: 'IMF - Inflation: Prices on the Rise', url: 'https://www.imf.org/en/Publications/fandd/issues/Series/Back-to-Basics/Inflation', note: 'Định nghĩa, đo bằng CPI.', status: 'done' } ],
    keyPoints: [ 'Giá cả tăng đều theo thời gian', 'Tiền in ra nhiều hơn hàng hoá', 'Ngân hàng trung ương tăng lãi suất', 'Đo bằng chỉ số giá tiêu dùng CPI' ].map((text) => ({ id: id(), text })),
    openQuestions: [], stage: 'explain', readingLog: [], milestones: [], review: null, createdAt: iso(2), updatedAt: iso(1),
  };
  const week = { ...infl, id: 'week-k8s', title: 'Kubernetes scheduler chọn node ra sao', depth: 'week', coreQuestion: 'Scheduler quyết định đặt pod lên node nào?', keyPoints: [], sources: [], stage: 'explore', createdAt: iso(5), updatedAt: iso(5) };
  for (const t of [deep, infl, week]) await put('topics', t);
  [48, 55, 61, 58, 70].forEach((score, i) => put('attempts', { id: 'seed' + i, topicId: 'deep-eu', createdAt: iso(14 - i * 3), durationSec: 420 + i * 30, targetSec: 600, scaffold: 'feynman', transcript: 'Nói đơn giản là châu Âu phụ thuộc vào khí đốt của Nga...', transcriptSource: 'whisper', metrics: { score }, audioId: null, isReview: false }));
  return { deep: deep.id, infl: infl.id };
});

const shot = async (name) => { await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.toast').forEach((t) => t.remove()); }); await page.waitForTimeout(400); await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true }); };

// Desktop pass
await page.goto(BASE + '#/'); await page.waitForSelector('.hero'); await shot('home-1280');
await page.goto(BASE + '#/reflex'); await page.waitForSelector('.prompt'); await shot('reflex-1280');
await page.goto(BASE + '#/topics'); await page.waitForSelector('.topic-card'); await shot('topics-1280');
await page.goto(BASE + `#/topic/${ids.deep}`); await page.waitForSelector('.topic-head'); await shot('topic-deep-1280');
await page.goto(BASE + '#/settings'); await page.waitForSelector('h1'); await shot('settings-1280');

// Choose WASM so the test is deterministic in headless Chromium.
await page.selectOption('select >> nth=1', 'wasm');

// Full practice flow: record from fake mic, Whisper, score.
await page.goto(BASE + `#/practice/${ids.infl}?scaffold=prep`);
await page.waitForSelector('.ring');
await page.selectOption('select[aria-label="Thời lượng mục tiêu"]', '30');
await page.click('button.record');
await page.waitForTimeout(9000);
await shot('practice-recording-1280');
await page.waitForTimeout(9500);
await page.click('button.record');
await page.waitForSelector('audio');
const t0 = Date.now();
await page.click('text=Chuyển giọng nói thành chữ (Whisper)');
let whisperOk = false;
try {
  await page.waitForFunction(() => /Xong|Lỗi/.test(document.querySelector('.progress .label')?.textContent || ''), null, { timeout: 15 * 60 * 1000 });
  whisperOk = /Xong/.test(await page.textContent('.progress .label'));
} catch (e) { logs.push('[timeout] ' + e.message); }
const whisperSec = (Date.now() - t0) / 1000;
const transcript = await page.inputValue('textarea.transcript');
await page.click('text=Chấm điểm');
await page.waitForSelector('.scorecard');
const score = await page.textContent('.big-score');
const coverage = await page.$$eval('.coverage li', (els) => els.map((e) => e.className + ': ' + e.textContent));
const fillers = await page.$$eval('.metric', (els) => els.map((e) => e.textContent));
await shot('practice-scored-1280');
await page.click('text=Sao chép để review >> nth=0');
await page.waitForSelector('.toast');
const bundle = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'clipboard read failed: ' + e.message);
const attemptUrl = page.url();
const attemptId = (await page.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('omni-feyn', 1); r.onsuccess = () => res(r.result); });
  return new Promise((res) => { const q = db.transaction('attempts').objectStore('attempts').getAll(); q.onsuccess = () => res(q.result.filter((a) => a.topicId === 'day-inflation').pop().id); });
}));

// Mobile pass
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '#/'); await page.waitForSelector('.hero'); await shot('home-390');
await page.goto(BASE + '#/reflex'); await page.waitForSelector('.prompt'); await shot('reflex-390');
await page.goto(BASE + '#/topics'); await page.waitForSelector('.topic-card'); await shot('topics-390');
await page.goto(BASE + `#/topic/${ids.deep}`); await page.waitForSelector('.topic-head'); await shot('topic-deep-390');
await page.goto(BASE + `#/practice/${ids.infl}?attempt=${attemptId}`); await page.waitForSelector('.scorecard'); await shot('practice-scored-390');
await page.goto(BASE + '#/settings'); await page.waitForSelector('h1'); await shot('settings-390');

const report = { whisperOk, whisperSec, transcript, score, coverage, fillers, bundlePreview: bundle.slice(0, 1500), attemptUrl, errors: logs.filter((l) => /error|pageerror|timeout/i.test(l)).slice(0, 30) };
writeFileSync('tmp/e2e-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
server.kill();
