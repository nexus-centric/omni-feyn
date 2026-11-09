// End-to-end smoke test and screenshots. Requires `npm run build` first.
// Uses Chromium's fake microphone fed from tests/fixtures/prep-vi.wav. Whisper is NOT run here (it downloads
// hundreds of MB); the transcript is typed by hand. Whisper is covered by scripts/asr-bench.mjs.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = 4191;
const BASE = `http://localhost:${PORT}/`;
const wav = resolve('tests/fixtures/prep-vi.wav');
mkdirSync('screenshots', { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
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
      { id: 's1', title: 'IEA - Gas Market Report (seeded example)', url: '', note: 'Nhập khẩu khí đốt từ Nga giảm mạnh sau 2022. LNG thay thế một phần.', status: 'done' },
      { id: 's2', title: 'Bruegel - National fiscal policy responses', url: '', note: 'Các nước chi hàng trăm tỷ euro để trợ giá điện, khí đốt.', status: 'reading' },
      { id: 's3', title: 'Eurostat - Energy statistics', url: '', note: '', status: 'todo' },
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
    sources: [ { id: 's4', title: 'Giáo trình kinh tế vĩ mô (ví dụ)', url: '', note: 'Định nghĩa, đo bằng CPI.', status: 'done' } ],
    keyPoints: [ 'Giá cả tăng đều theo thời gian', 'Tiền in ra nhiều hơn hàng hoá', 'Ngân hàng trung ương tăng lãi suất', 'Đo bằng chỉ số giá tiêu dùng CPI' ].map((text) => ({ id: id(), text })),
    openQuestions: [], stage: 'explain', readingLog: [], milestones: [], review: null, createdAt: iso(2), updatedAt: iso(1),
  };
  const week = { ...infl, id: 'week-k8s', title: 'Kubernetes scheduler chọn node ra sao', depth: 'week', coreQuestion: 'Scheduler quyết định đặt pod lên node nào?', keyPoints: [], sources: [], stage: 'explore', createdAt: iso(5), updatedAt: iso(5) };
  deep.keywords = ['eurozone debt crisis', 'European energy crisis 2022', 'NextGenerationEU'];
  const legacyBuiltIn = { ...infl, id: 'legacy-builtin', title: 'Lãi suất kép', coreQuestion: '', keyPoints: [], sources: [], createdAt: iso(30), updatedAt: iso(30) };
  for (const t of [deep, infl, week, legacyBuiltIn]) await put('topics', t);
  const putKV = (store, k, v) => new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  // old-format body sessions (no kind) must still load
  await putKV('settings', 'bodySessions', [5, 4, 2, 1].map((d) => ({ id: 'b' + d, date: day(d), rounds: 3, minutes: 20, moves: [], level: 1 })));
  [48, 55, 61, 58, 70].forEach((score, i) => put('attempts', { id: 'seed' + i, topicId: 'deep-eu', createdAt: iso(14 - i * 3), durationSec: 420 + i * 30, targetSec: 600, scaffold: 'feynman', transcript: 'Nói đơn giản là châu Âu phụ thuộc vào khí đốt của Nga...', transcriptSource: 'whisper', metrics: { score }, audioId: null, isReview: false }));
  return { deep: deep.id, infl: infl.id };
});

const shot = async (name) => { await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('.toast').forEach((t) => t.remove()); }); await page.waitForTimeout(400); await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true }); };

const DEPTHS = ['minute', 'day', 'week', 'deep'];
const checks = {};
async function spinShots(suffix) {
  for (const d of DEPTHS) {
    await page.goto(BASE + `#/spin?d=${d}`); await page.waitForSelector('.pick-btn');
    if (d === 'minute' || d === 'deep') await shot(`explore-${d}-initial-${suffix}`);
    await page.click('.pick-btn');
    await page.waitForTimeout(650);
    if (suffix === '1280') await page.screenshot({ path: `screenshots/spin-${d}-mid-${suffix}.png`, fullPage: false });
    await page.waitForSelector('.result-card', { timeout: 5000 });
    await page.waitForTimeout(900);
    await shot(`spin-${d}-result-${suffix}`);
    checks[`result_${d}_${suffix}`] = { vi: await page.textContent('.result-title'), en: await page.textContent('.result-card .title-en').catch(() => null), reelEn: await page.textContent('.slot .reel-item:last-child .reel-en').catch(() => null) };
  }
}
async function bodyShots(suffix) {
  await page.goto(BASE + '#/'); await page.waitForSelector('.hero'); await page.goto(BASE + '#/body'); await page.waitForSelector('.week-strip'); await page.waitForTimeout(600);
  await shot(`body-${suffix}`);
}

// Desktop pass
await page.goto(BASE + '#/'); await page.waitForSelector('.hero'); await shot('home-1280');
await spinShots('1280');

// Accept day/week/deep subjects WITHOUT adopting any suggested question or plan.
const accepted = {};
for (const d of ['day', 'week', 'deep']) {
  await page.goto(BASE + `#/spin?d=${d}`); await page.click('.pick-btn'); await page.waitForSelector('.result-card'); await page.waitForTimeout(900);
  const title = (await page.textContent('.result-card h2, .result-card .reel-title, .result-title').catch(() => '')) || '';
  checks[`spin_${d}_hasEstimate`] = !!(await page.$('.result-card .estimate'));
  checks[`spin_${d}_suggestionsCollapsed`] = await page.$eval('.result-card details.suggest', (el) => !el.open).catch(() => 'missing');
  await page.click('text=Bắt đầu tìm hiểu'); await page.waitForSelector('.topic-head');
  const id = page.url().split('/').pop();
  const stored = await page.evaluate(async (id) => {
    const db = await new Promise((res) => { const r = indexedDB.open('omni-feyn', 1); r.onsuccess = () => res(r.result); });
    return new Promise((res) => { const q = db.transaction('topics').objectStore('topics').get(id); q.onsuccess = () => res(q.result); });
  }, id);
  accepted[d] = { id, title: stored.title, coreQuestion: stored.coreQuestion, milestones: stored.milestones.length, hasSuggestions: !!stored.suggestions, complexity: stored.complexity };
  if (d === 'deep') {
    await page.fill('textarea[data-note="understanding"]', 'Tôi mới đọc lướt, hiểu sơ bộ là chủ đề này liên quan tới nhiều nước và nhiều giai đoạn.');
    await page.locator('textarea[data-note="understanding"]').blur();
    await page.waitForTimeout(300);
    await shot('topic-accepted-1280');
    // optional: open suggestions panel to show it
    await page.click('details.suggest > summary'); await page.waitForTimeout(300);
    await shot('topic-accepted-suggestions-1280');
  }
}
checks.accepted = accepted;

// Category filters for the new and priority areas: select, draw, and check the result stays in the group.
async function filterShots(suffix, list) {
  for (const [cat, d] of list) {
    await page.goto(BASE + `#/spin?d=${d}`); await page.waitForSelector('.pick-btn');
    await page.selectOption('select[aria-label="Nhóm chủ đề"]', cat); await page.waitForTimeout(200);
    const label = await page.$eval('select[aria-label="Nhóm chủ đề"]', (el) => el.selectedOptions[0].textContent);
    if (cat === 'sach' || cat === 'hien-tuong') await shot(`filter-${cat}-${d}-initial-${suffix}`);
    await page.click('.pick-btn'); await page.waitForSelector('.result-card', { timeout: 5000 }); await page.waitForTimeout(900);
    const chips = await page.$$eval('.result-card .chip', (els) => els.map((e) => e.textContent.trim()));
    checks[`filter_${cat}_${d}_${suffix}`] = { label, vi: await page.textContent('.result-title'), en: await page.textContent('.result-card .title-en').catch(() => null), chips, bookNote: await page.isVisible('text=chưa gồm thời gian đọc trọn cuốn').catch(() => false) };
    await shot(`filter-${cat}-${d}-result-${suffix}`);
  }
}
checks.categoryOptions = await (async () => { await page.goto(BASE + '#/spin?d=day'); await page.waitForSelector('.pick-btn'); return page.$$eval('select[aria-label="Nhóm chủ đề"] option', (els) => els.map((e) => e.textContent)); })();
await filterShots('1280', [['cong-nghe', 'day'], ['kinh-te', 'week'], ['sach', 'day'], ['sach', 'deep'], ['hien-tuong', 'minute'], ['tam-ly', 'day'], ['van-hoa', 'week']]);
// Find a topic marked as debated (psychology, one day) and accept a book topic without adopting suggestions.
{
  await page.goto(BASE + '#/spin?d=day'); await page.waitForSelector('.pick-btn');
  await page.selectOption('select[aria-label="Nhóm chủ đề"]', 'tam-ly');
  let found = null;
  for (let k = 0; k < 30 && !found; k++) {
    await page.click('.pick-btn'); await page.waitForSelector('.result-card'); await page.waitForTimeout(900);
    if (await page.$('.result-card .chip.disputed')) found = await page.textContent('.result-title');
    else { const again = await page.$('text=Đổi bài'); if (again) { await again.click(); await page.waitForTimeout(200); } else { await page.goto(BASE + '#/spin?d=day'); await page.waitForSelector('.pick-btn'); } }
  }
  checks.disputedFound = found;
  if (found) await shot('result-disputed-1280');
  await page.goto(BASE + '#/spin?d=week'); await page.waitForSelector('.pick-btn');
  await page.selectOption('select[aria-label="Nhóm chủ đề"]', 'sach');
  await page.click('.pick-btn'); await page.waitForSelector('.result-card'); await page.waitForTimeout(900);
  await page.click('text=Bắt đầu tìm hiểu'); await page.waitForSelector('.topic-head');
  await page.fill('textarea[data-note="understanding"]', 'Ghi chú thử: tác giả lập luận gì, và mình đồng ý tới đâu.');
  await page.locator('textarea[data-note="understanding"]').blur(); await page.waitForTimeout(300);
  checks.bookAccepted = { url: page.url(), title: await page.textContent('.topic-head h1, .topic-head h2').catch(() => null), en: await page.inputValue('.topic-head input[lang="en"]').catch(() => null), bookNote: await page.isVisible('text=chưa gồm thời gian đọc trọn cuốn'), noteSaved: await page.inputValue('textarea[data-note="understanding"]') };
  await page.reload(); await page.waitForSelector('.topic-head');
  checks.bookAccepted.afterReload = { en: await page.inputValue('.topic-head input[lang="en"]').catch(() => null), note: await page.inputValue('textarea[data-note="understanding"]') };
  await shot('topic-book-accepted-1280');
}
await page.goto(BASE + '#/topics'); await page.waitForSelector('.topic-card'); await shot('topics-1280');
checks.topicListEnglish = await page.$$eval('.topic-card', (els) => els.map((e) => [e.querySelector('h3')?.textContent, e.querySelector('.title-en')?.textContent || null]));
checks.navLabels = await page.$$eval('.top nav a', (els) => els.map((e) => e.textContent.trim()));
checks.docTitle = await page.title();
checks.visibleBanned = await page.evaluate(() => ['Quay đề', 'QUAY', 'bốc', 'Vòng quay', '🎲'].filter((b) => document.body.innerText.includes(b)));
await page.goto(BASE + `#/topic/${ids.deep}`); await page.waitForSelector('.topic-head'); await shot('topic-deep-old-data-1280');

// Body: weekly schedule, swap a move within the same zone and level, then break the week to see warnings.
await page.goto(BASE + '#/body'); await page.waitForSelector('.week-strip');
await page.selectOption('.body-today select', 'strengthA').catch(() => {});
await page.waitForTimeout(400);
const before = await page.$$eval('.move-card', (els) => els.map((e) => e.textContent));
const swapBtn = await page.$('.move-card .swap');
if (swapBtn) { await swapBtn.click(); await page.waitForTimeout(400); }
const after = await page.$$eval('.move-card', (els) => els.map((e) => e.textContent));
checks.bodySwapChanged = swapBtn ? JSON.stringify(before) !== JSON.stringify(after) : 'no swap button';
await shot('body-swap-1280');
const weekSel = await page.$$('.week-edit select');
checks.weekSelects = weekSel.length;
if (weekSel.length === 7) { await page.click('.week-edit >> xpath=..').catch(() => {}); for (const i of [1, 6]) await weekSel[i].selectOption('strengthB'); await page.waitForTimeout(300); }
checks.weekWarnings = await page.$$eval('.week-warn li, .warn', (els) => els.map((e) => e.textContent));
await shot('body-week-warning-1280');
await page.evaluate(async () => { const db = await new Promise((res) => { const r = indexedDB.open('omni-feyn', 1); r.onsuccess = () => res(r.result); }); await new Promise((res) => { const tx = db.transaction('settings', 'readwrite'); tx.objectStore('settings').delete('bodyWeek'); tx.oncomplete = res; }); });
await bodyShots('1280');
await page.goto(BASE + '#/settings'); await page.waitForSelector('h1'); await shot('settings-1280');

// Practice: short recording from the fake mic, transcript typed by hand, delivery metrics, copy for review.
await page.goto(BASE + `#/practice/${ids.infl}?scaffold=prep`);
await page.waitForSelector('.ring');
await page.selectOption('select[aria-label="Thời lượng mục tiêu"]', '30');
await page.click('button.record');
await page.waitForTimeout(6000);
await shot('practice-recording-1280');
await page.click('button.record');
await page.waitForSelector('textarea.transcript');
const transcript = 'Theo tôi lạm phát là khi giá cả tăng đều theo thời gian. Lý do là tiền nhiều hơn hàng hoá. Ví dụ năm ngoái giá xăng tăng. Ngân hàng trung ương tăng lãi suất để hãm lại. Tóm lại lạm phát đo bằng chỉ số giá tiêu dùng CPI.';
await page.fill('textarea.transcript', transcript);
await page.click('text=Tính chỉ số');
await page.waitForSelector('.scorecard');
const score = await page.textContent('.big-score');
const coverage = await page.$$eval('.coverage li', (els) => els.map((e) => e.className + ': ' + e.textContent));
await shot('practice-scored-1280');
await page.click('text=Sao chép để review >> nth=0');
await page.waitForSelector('.toast');
const bundle = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'clipboard read failed: ' + e.message);
const attemptId = (await page.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('omni-feyn', 1); r.onsuccess = () => res(r.result); });
  return new Promise((res) => { const q = db.transaction('attempts').objectStore('attempts').getAll(); q.onsuccess = () => res(q.result.filter((a) => a.topicId === 'day-inflation').pop().id); });
}));
// review bundle for the deep topic accepted above, with the note written by hand
await page.goto(BASE + `#/topic/${accepted.deep.id}`); await page.waitForSelector('.topic-head');
await page.click('text=Sao chép để review >> nth=0'); await page.waitForSelector('.toast');
const deepBundle = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'clipboard read failed: ' + e.message);

// Mobile pass
await page.setViewportSize({ width: 390, height: 844 });
const overflowAt = [];
const chk = async (name) => { if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) overflowAt.push(name); };
await page.goto(BASE + '#/'); await page.waitForSelector('.hero'); await shot('home-390'); await chk('home');
await spinShots('390'); await chk('spin');
await filterShots('390', [['sach', 'day'], ['hien-tuong', 'minute'], ['kinh-te', 'week']]); await chk('filter');
await page.goto(BASE + '#/' + checks.bookAccepted.url.split('#/')[1]); await page.waitForSelector('.topic-head'); await shot('topic-book-accepted-390'); await chk('topic-book');
await page.goto(BASE + '#/topics'); await page.waitForSelector('.topic-card'); await shot('topics-390'); await chk('topics');
await page.goto(BASE + `#/topic/${accepted.deep.id}`); await page.waitForSelector('.topic-head'); await shot('topic-accepted-390'); await chk('topic');
await page.goto(BASE + `#/practice/${ids.infl}?attempt=${attemptId}`); await page.waitForSelector('.scorecard'); await shot('practice-scored-390'); await chk('practice');
await bodyShots('390'); await chk('body');
await page.goto(BASE + '#/settings'); await page.waitForSelector('h1'); await shot('settings-390'); await chk('settings');

const report = { checks, overflowAt, score, coverage, bundlePreview: bundle.slice(0, 1800), deepBundlePreview: deepBundle.slice(0, 1500), errors: logs.filter((l) => /^\[(error|pageerror|timeout)\]/i.test(l)).slice(0, 30), warnings: logs.filter((l) => /^\[warning\]/.test(l)).slice(0, 10) };
writeFileSync('tmp/e2e-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.kill(-server.pid);
