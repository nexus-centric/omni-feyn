import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BANK, CATEGORY, CATEGORIES, Drawer, categoriesFor } from '../src/core/bank.js';
import { EXERCISES, ZONES, drawRound, streak } from '../src/core/body.js';
import type { Depth } from '../src/core/types.js';

const MIN: Record<Depth, number> = { minute: 100, day: 60, week: 40, deep: 30 };
const depths = Object.keys(MIN) as Depth[];

test('bank sizes meet the minimums per depth', () => {
  for (const d of depths) assert.ok(BANK[d].length >= MIN[d], `${d}: ${BANK[d].length} < ${MIN[d]}`);
});

test('bank items are well formed, unique and use known categories', () => {
  const ids = new Set<string>();
  for (const d of depths) {
    const titles = new Set<string>();
    for (const i of BANK[d]) {
      assert.ok(CATEGORY[i.cat], `unknown category ${i.cat} in ${i.title}`);
      assert.ok(i.title.trim().length >= 6, `short title ${i.title}`);
      assert.ok(!ids.has(i.id), `duplicate id ${i.id}`); ids.add(i.id);
      assert.ok(!titles.has(i.title.toLowerCase()), `duplicate title ${i.title}`); titles.add(i.title.toLowerCase());
      assert.ok(!/https?:\/\//.test(JSON.stringify({ ...i, sources: [] })), `bank text must not contain URLs (verified sources live in bank-meta): ${i.title}`);
      if (d !== 'minute') { assert.ok(d === 'deep' ? i.core === '' || i.core.length > 15 : i.core.length > 15, `missing or too short starting question ${i.title}`); assert.ok(i.keywords.length >= 2, `keywords ${i.title}`); }
      if (d === 'week' || d === 'deep') assert.ok(i.plan.length >= 4, `plan too short ${i.title}`);
    }
  }
});

test('each depth spans many categories, and DevOps is covered at every depth', () => {
  for (const d of depths) {
    const cats = categoriesFor(d);
    assert.ok(cats.length >= 8, `${d} has only ${cats.length} categories`);
    assert.ok(cats.some((c) => c.id === 'devops'), `${d} lacks devops`);
  }
  assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
});

function seeded(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

test('drawer never repeats within a session until the pool is exhausted', () => {
  for (const d of depths) {
    const dr = new Drawer(seeded(42));
    const n = BANK[d].length;
    const seen = new Set<string>();
    for (let k = 0; k < n; k++) { const it = dr.draw(d); assert.ok(!seen.has(it.id), `${d} repeated ${it.id} at ${k}`); seen.add(it.id); }
    assert.equal(seen.size, n);
    assert.equal(dr.remaining(d), 0);
    // next cycle starts fresh but not with the item just shown
    const last = [...seen].pop();
    assert.notEqual(dr.draw(d).id, last);
  }
});

test('drawer respects the category filter and tracks pools separately', () => {
  const dr = new Drawer(seeded(7));
  const pool = dr.pool('day', 'devops');
  assert.ok(pool.length >= 5);
  const got = new Set(pool.map(() => dr.draw('day', 'devops').id));
  assert.equal(got.size, pool.length);
  for (const id of got) assert.ok(id.startsWith('day:'));
  assert.ok(pool.every((i) => i.cat === 'devops'));
  assert.equal(dr.remaining('day', 'all'), BANK.day.length);
});

test('body round has one move per zone and avoids the last round when possible', () => {
  const r1 = drawRound(2, seeded(3));
  assert.deepEqual(r1.moves.map((m) => m.zone), ZONES);
  assert.ok(r1.moves.every((m) => m.level <= 2));
  const r2 = drawRound(2, seeded(9), r1.moves.map((m) => m.id));
  for (const m of r2.moves) assert.ok(!r1.moves.some((x) => x.id === m.id));
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
});

test('streak counts consecutive days', () => {
  const s = (date: string) => ({ id: date, date, rounds: 2, minutes: 20, moves: [], level: 1 });
  assert.equal(streak([s('2026-11-03'), s('2026-11-04'), s('2026-11-05')], '2026-11-05'), 3);
  assert.equal(streak([s('2026-11-03'), s('2026-11-04')], '2026-11-05'), 2);
  assert.equal(streak([s('2026-11-01')], '2026-11-05'), 0);
});
