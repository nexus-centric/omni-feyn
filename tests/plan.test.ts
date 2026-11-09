import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BANK } from '../src/core/bank.js';
import { META, START_SOURCES } from '../src/core/bank-meta.js';
import { estimate, suggestedHours, windowLabel } from '../src/core/estimate.js';
import { adoptPlan, normalizeTopic, topicFromBank } from '../src/core/topic.js';
import { reviewBundle } from '../src/core/bundle.js';
import { computeMetrics } from '../src/core/metrics.js';
import { DEFAULT_WEEK, EXERCISES, SESSION_ZONES, checkWeek, isStrength, sessionMoves, swapOptions } from '../src/core/body.js';
import type { Depth } from '../src/core/types.js';

const LONG: Depth[] = ['day', 'week', 'deep'];

test('every day/week/deep subject has English search metadata and a complexity', () => {
  const titles = new Set(LONG.flatMap((d) => BANK[d].map((i) => i.title)));
  for (const d of LONG) for (const i of BANK[d]) {
    assert.ok(i.en.length >= 3, `missing English subject for ${i.title}`);
    assert.ok([1, 2, 3].includes(i.complexity), `complexity ${i.title}`);
  }
  for (const k of Object.keys(META)) assert.ok(titles.has(k), `META key without bank item: ${k}`);
  for (const k of Object.keys(START_SOURCES)) assert.ok(titles.has(k), `source key without bank item: ${k}`);
  // Vietnamese history subjects get English search terms too
  const viet = BANK.deep.find((i) => i.title.startsWith('Lịch sử Việt Nam'))!;
  assert.ok(viet.enTerms.length >= 3 && viet.enTerms.every((t) => /^[\x20-\x7e]+$/.test(t)));
});

test('starting sources are https, attributed and few', () => {
  const all = Object.values(START_SOURCES).flat();
  assert.ok(all.length > 0 && all.length <= 40);
  for (const s of all) { assert.match(s.url, /^https:\/\//); assert.ok(s.title && s.org); }
});

test('estimates depend on depth and complexity, are adjustable and keep effort separate from calendar', () => {
  assert.equal(estimate('minute'), null);
  const ranges = new Set(LONG.flatMap((d) => BANK[d].map((i) => JSON.stringify(suggestedHours(d, i.complexity)))));
  assert.ok(ranges.size >= 6, 'estimates should not be one boilerplate range');
  for (const d of LONG) {
    const [l1, l3] = [suggestedHours(d, 1)!, suggestedHours(d, 3)!];
    assert.ok(l1[1] <= l3[1] && l1[0] < l3[0]);
  }
  const e = estimate('deep', 3)!;
  assert.ok(e.hours[0] < e.hours[1] && e.days[0] <= e.days[1] && !e.custom);
  const slower = estimate('deep', 3, { sessionsPerWeek: 2 })!;
  assert.deepEqual(slower.hours, e.hours, 'changing pace must not change effort hours');
  assert.ok(slower.days[1] > e.days[1]);
  const mine = estimate('week', 2, { hours: [3, 4] })!;
  assert.deepEqual(mine.hours, [3, 4]); assert.ok(mine.custom);
  assert.match(windowLabel([3, 6]), /ngày/); assert.match(windowLabel([20, 60]), /tuần/); assert.match(windowLabel([60, 200]), /tháng/);
});

test('accepting a drawn subject keeps it broad: no required question, no auto milestones', () => {
  for (const d of LONG) {
    const it = BANK[d][0];
    const t = topicFromBank(it, 'x', '2026-11-06T00:00:00Z');
    assert.equal(t.title, it.title);
    assert.equal(t.coreQuestion, '');
    assert.equal(t.milestones.length, 0);
    assert.equal(t.openQuestions.length, 0);
    assert.ok(t.suggestions && t.suggestions.core === it.core);
  }
  const deep = topicFromBank(BANK.deep[0], 'y');
  let n = 0;
  const added = adoptPlan(deep, () => `m${n++}`);
  assert.equal(added.length, BANK.deep[0].plan.length);
  assert.equal(adoptPlan(deep, () => `m${n++}`).length, 0, 'adopting twice does not duplicate');
});

test('topics saved by older versions load unchanged with defaults filled', () => {
  const old = { id: 'o', title: 'Cũ', depth: 'deep', coreQuestion: 'Q', sources: [{ id: 's', title: 'A', url: '', note: 'n', status: 'done' }], keyPoints: [], openQuestions: [], stage: 'understand', readingLog: [], milestones: [{ id: 'm', text: 'Đọc', done: true }], review: null, createdAt: 'c', updatedAt: 'u', keywords: ['k'] } as any;
  const t = normalizeTopic(old);
  assert.deepEqual(t, old);
  const sparse = normalizeTopic({ id: 'p', title: 'Thưa' } as any);
  assert.deepEqual([sparse.sources, sparse.milestones, sparse.coreQuestion], [[], [], '']);
});

test('review bundle carries notes and labels metrics as delivery heuristics', () => {
  const t = normalizeTopic({ id: 't', title: 'Tiền', depth: 'deep', understanding: 'Tôi nghĩ tiền là niềm tin', facts: 'Bretton Woods kết thúc 1971', interpretation: 'Giả định: ...', direction: 'Góc nhìn lịch sử', sources: [{ id: 's', title: 'Fed History', url: 'https://www.federalreservehistory.org/essays/bretton-woods-created', note: '', status: 'reading' }], openQuestions: [{ id: 'q', text: 'Vì sao vàng?', done: false }] } as any);
  const metrics = computeMetrics({ transcript: 'theo tôi tiền là niềm tin ví dụ vàng tóm lại vậy', durationSec: 30, targetSec: 60, keyPoints: ['niềm tin'], pauses: [], scaffold: 'prep' });
  const md = reviewBundle(t, { id: 'a', topicId: 't', createdAt: '2026-11-06T00:00:00Z', durationSec: 30, targetSec: 60, scaffold: 'prep', transcript: 'x', transcriptSource: 'manual', metrics, audioId: null, isReview: false });
  for (const s of ['My current understanding', 'backed by sources', 'assumptions and uncertainties', 'My own direction', 'My open questions', 'federalreservehistory.org', 'not a measure of understanding', 'not correctness'])
    assert.ok(md.includes(s), `bundle missing: ${s}`);
  assert.ok(reviewBundle(normalizeTopic({ id: 'e', title: 'E' } as any), null).includes('exploring the subject broadly'));
});

test('default week: >= 2 strength days, none back to back, a rest day, no warnings', () => {
  const s = DEFAULT_WEEK.map(isStrength);
  assert.ok(s.filter(Boolean).length >= 2);
  for (let i = 0; i < 7; i++) assert.ok(!(s[i] && s[(i + 1) % 7]));
  assert.ok(DEFAULT_WEEK.includes('rest'));
  assert.deepEqual(checkWeek(DEFAULT_WEEK), []);
  assert.ok(checkWeek(['strengthA', 'strengthB', 'strengthA', 'strengthB', 'strengthA', 'strengthB', 'strengthA']).length >= 2);
});

test('strength sessions are deterministic per day, follow their zones and respect level', () => {
  for (const kind of ['strengthA', 'strengthB'] as const) for (const lv of [1, 2, 3] as const) {
    const a = sessionMoves(kind, lv, '2026-11-06'), b = sessionMoves(kind, lv, '2026-11-06');
    assert.deepEqual(a.map((m) => m.id), b.map((m) => m.id));
    assert.deepEqual(a.map((m) => m.zone), SESSION_ZONES[kind]);
    assert.ok(a.every((m) => m.level <= lv));
    assert.equal(new Set(a.map((m) => m.id)).size, a.length);
  }
});

test('swap stays in the same zone and level, never above the chosen level', () => {
  for (const e of EXERCISES) for (const lv of [1, 2, 3] as const) {
    if (e.level > lv) continue;
    const opts = swapOptions(e, lv, [e.id]);
    for (const o of opts) { assert.equal(o.zone, e.zone); assert.ok(o.level <= lv); assert.notEqual(o.id, e.id); }
    const same = opts.filter((o) => o.level === e.level);
    if (EXERCISES.some((x) => x.zone === e.zone && x.level === e.level && x.id !== e.id)) assert.equal(same.length, opts.length);
  }
});
