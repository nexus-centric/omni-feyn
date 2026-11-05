import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { contentTokens, levenshtein, normalizeVi } from '../src/core/text.js';
import { computeMetrics, countFillers, coverage, detectPauses, durationScore, fillerScore, pausesFromChunks, prepStructure, wordsPerMinute } from '../src/core/metrics.js';
import { addDays, isDue, recordReview, startReview } from '../src/core/review.js';
import { reviewBundle } from '../src/core/bundle.js';

test('normalizeVi strips tones, d-stroke and punctuation', () => {
  assert.equal(normalizeVi('Đường Lối Đổi Mới, năm 1986!'), 'duong loi doi moi nam 1986');
  assert.equal(normalizeVi('  Khủng   hoảng  nợ công  '), 'khung hoang no cong');
  assert.equal(normalizeVi('Tiếng Việt có dấu: ạ ặ ữ ỹ'), 'tieng viet co dau a a u y');
  // composed and decomposed input give the same result
  assert.equal(normalizeVi('Việt'.normalize('NFD')), normalizeVi('Việt'.normalize('NFC')));
});

test('levenshtein basics', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('lam phat', 'lam phat'), 0);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('contentTokens removes stopwords', () => {
  assert.deepEqual(contentTokens('Lạm phát là sự tăng giá của hàng hoá'), ['lam', 'phat', 'tang', 'gia', 'hang', 'hoa']);
});

test('countFillers counts Vietnamese multi-word fillers once', () => {
  const r = countFillers('Ừm, kiểu như là mình thấy, à, nói chung là nó tốt, đúng không. Kiểu vậy đó. Um, like, yeah.');
  assert.equal(r.byWord['ừm'], 1);
  assert.equal(r.byWord['kiểu như là'], 1);
  assert.equal(r.byWord['à'], 1);
  assert.equal(r.byWord['nói chung là'], 1);
  assert.equal(r.byWord['đúng không'], 1);
  assert.equal(r.byWord['kiểu'], 1);
  assert.equal(r.byWord['um'], 1);
  assert.equal(r.byWord['like'], 1);
  assert.equal(r.total, 8);
});

test('countFillers keeps tones: "a" and "ạ" are not "à"', () => {
  assert.equal(countFillers('Dạ vâng ạ, vitamin a').total, 0);
});

test('wordsPerMinute counts syllables', () => {
  assert.equal(wordsPerMinute('một hai ba bốn năm sáu bảy tám chín mười', 5), 120);
  assert.equal(wordsPerMinute('xin chào', 0), 0);
});

test('coverage is diacritic-insensitive and fuzzy', () => {
  const t = 'Lam phat la khi gia ca tang deu. Ngan hang trung uong tang lai suat de kiem che.';
  const r = coverage(t, ['Lạm phát là giá cả tăng', 'Ngân hàng trung ương tăng lãi suất', 'Đường cong Phillips']);
  assert.equal(r.items[0].state, 'covered');
  assert.equal(r.items[1].state, 'covered');
  assert.equal(r.items[2].state, 'missing');
  assert.ok(Math.abs(r.ratio - 2 / 3) < 1e-9);
  // typo tolerance on long tokens
  assert.equal(coverage('khủng hoảng năng lương châu âu', ['khủng hoảng năng lượng']).items[0].state, 'covered');
  assert.equal(coverage('the european centrl bank', ['European Central Bank']).items[0].state, 'covered');
});

test('detectPauses finds an inner silence and ignores edges', () => {
  const sr = 16000;
  const sig = new Float32Array(sr * 6);
  const tone = (from: number, to: number) => { for (let i = from * sr; i < to * sr; i++) sig[i] = 0.3 * Math.sin(i / 5); };
  tone(0.5, 2); tone(4, 5.5); // silence 2..4 s, edges silent
  const p = detectPauses(sig, sr, 1.5);
  assert.equal(p.length, 1);
  assert.ok(Math.abs(p[0].start - 2) < 0.1 && Math.abs(p[0].end - 4) < 0.1);
});

test('pausesFromChunks uses timestamp gaps', () => {
  const p = pausesFromChunks([{ timestamp: [0, 2] }, { timestamp: [2.2, 4] }, { timestamp: [6, 7] }]);
  assert.deepEqual(p, [{ start: 4, end: 6 }]);
});

test('prepStructure detects markers in order', () => {
  const r = prepStructure('Theo tôi, làm việc từ xa hiệu quả hơn. Vì không mất thời gian đi lại. Ví dụ công ty tôi tăng năng suất. Tóm lại, làm từ xa là tốt.');
  assert.ok(r.hints.every((h) => h.found));
  assert.equal(r.ordered, true);
  assert.equal(r.score, 1);
});

test('sub-scores behave at the edges', () => {
  assert.equal(fillerScore(0.02), 1);
  assert.equal(fillerScore(0.2), 0);
  assert.equal(durationScore(60, 60), 1);
  assert.ok(durationScore(30, 60) < 0.6);
});

test('computeMetrics produces a bounded score', () => {
  const m = computeMetrics({ transcript: 'Theo tôi lạm phát là giá cả tăng, vì tiền mất giá. Ví dụ giá xăng. Tóm lại phải kiểm soát.', durationSec: 10, targetSec: 60, keyPoints: ['giá cả tăng'], pauses: [], scaffold: 'prep' });
  assert.ok(m.score > 0 && m.score <= 100);
  assert.equal(m.coverage.items[0].state, 'covered');
  assert.equal(computeMetrics({ transcript: '', durationSec: 10, targetSec: 60, keyPoints: [], pauses: [], scaffold: 'none' }).score, 0);
});

test('review schedule expands and resets', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  let s = startReview('2026-11-05');
  assert.equal(s.due, '2026-11-06');
  s = recordReview(s, '2026-11-06', 80); assert.equal(s.due, '2026-11-09');
  s = recordReview(s, '2026-11-09', 85); assert.equal(s.due, '2026-11-16');
  s = recordReview(s, '2026-11-16', 40); assert.equal(s.due, '2026-11-17');
  assert.ok(isDue(s, '2026-11-17') && !isDue(s, '2026-11-16'));
});

test('reviewBundle contains the essentials', () => {
  const md = reviewBundle({ id: 't', title: 'Khủng hoảng EU', depth: 'deep', coreQuestion: 'Vì sao?', sources: [{ id: 's', title: 'Bài báo', url: 'https://example.org', note: 'ghi chú', status: 'done' }], keyPoints: [{ id: 'k', text: 'nợ công' }], openQuestions: [], stage: 'explain', readingLog: [], milestones: [], review: null, createdAt: '', updatedAt: '' }, null);
  assert.match(md, /# Review request: Khủng hoảng EU/);
  assert.match(md, /- nợ công/);
  assert.match(md, /<https:\/\/example.org>/);
});
