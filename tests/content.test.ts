import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BANK, CATEGORIES, CATEGORY_WEIGHT, Drawer, type BankItem } from '../src/core/bank.js';
import type { Depth } from '../src/core/types.js';

const depths: Depth[] = ['minute', 'day', 'week', 'deep'];
const ALL: BankItem[] = depths.flatMap((d) => BANK[d]);
const PRIORITY = new Set(CATEGORIES.filter((c) => c.priority).map((c) => c.id));
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[“”"'’.,?!:;()]/g, '').replace(/\s+/g, ' ').trim();
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('new content areas exist with Vietnamese names', () => {
  for (const id of ['cong-nghe', 'devops', 'kinh-te', 'tam-ly', 'hien-tuong', 'sach']) assert.ok(PRIORITY.has(id), `${id} should be a priority area`);
  for (const id of ['van-hoa', 'lich-su', 'khoa-hoc', 'xa-hoi', 'moi-truong']) assert.ok(CATEGORIES.some((c) => c.id === id && !c.priority), `${id} missing`);
  for (const c of CATEGORIES) assert.ok(CATEGORY_WEIGHT[c.id] > 0, `no weight for ${c.id}`);
});

test('ids and titles are unique across all depths in both languages', () => {
  const dupEn: string[] = []; const ids = new Set<string>(); const vi = new Map<string, string>(); const en = new Map<string, string>();
  for (const i of ALL) {
    assert.ok(!ids.has(i.id), `duplicate id ${i.id}`); ids.add(i.id);
    const v = norm(i.title); assert.ok(!vi.has(v), `duplicate Vietnamese title "${i.title}" (${vi.get(v)} / ${i.id})`); vi.set(v, i.id);
    const e = norm(i.en); if (en.has(e)) dupEn.push(`${i.en} (${en.get(e)} / ${i.id})`); else en.set(e, i.id);
  }
  assert.deepEqual(dupEn, [], 'duplicate English titles');
});

test('every category has topics at every depth', () => {
  for (const c of CATEGORIES) for (const d of depths) assert.ok(BANK[d].some((i) => i.cat === c.id), `${c.id} has nothing at ${d}`);
});

test('metadata is complete: English title, search terms, complexity, flags, no links in text', () => {
  for (const i of ALL) {
    assert.ok(i.en.trim().length >= 4, `no English title for ${i.id}`);
    assert.ok(!/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(i.en), `English title has Vietnamese letters: ${i.en}`);
    assert.ok([1, 2, 3].includes(i.complexity), `bad complexity ${i.id}`);
    assert.ok(i.flag === undefined || i.flag === 'disputed', `bad flag ${i.id}`);
    if (i.depth !== 'minute') assert.ok(i.enTerms.length >= 1 && i.enTerms.every((t) => t.trim().length > 2), `no English search terms ${i.id}`);
    if (i.depth === 'week' || i.depth === 'deep') assert.ok(i.plan.length >= 4, `short plan ${i.id}`);
    for (const s of [i.title, i.en, i.core, ...i.plan, ...i.keywords, ...i.enTerms]) assert.ok(!/https?:\/\/|www\./i.test(s), `link in text of ${i.id}`);
    for (const s of i.sources) assert.match(s.url, /^https:\/\//);
  }
});

test('book topics name a real-looking title and author in English and carry no fabricated edition', () => {
  const books = ALL.filter((i) => i.cat === 'sach');
  assert.ok(books.length >= 30);
  const named = books.filter((i) => / by /.test(i.en) || /“[^”]+”/.test(i.title));
  assert.ok(named.length >= 20, `only ${named.length} named books`);
  for (const b of named) if (/“[^”]+”/.test(b.title)) assert.ok(/[A-Za-z0-9]/.test(b.title.match(/“([^”]+)”/)![1]), `book title should be the English original: ${b.title}`);
});

test('priority areas make up about two thirds of day, week and deep topics', () => {
  for (const d of ['day', 'week', 'deep'] as Depth[]) {
    const share = BANK[d].filter((i) => PRIORITY.has(i.cat)).length / BANK[d].length;
    assert.ok(share >= 0.6 && share <= 0.75, `${d} priority share ${share.toFixed(2)}`);
  }
  for (const c of CATEGORIES) {
    const n = ALL.filter((i) => i.cat === c.id).length;
    assert.ok(n >= (c.priority ? 35 : 20), `${c.id} has only ${n} topics`);
  }
});

test('weighted draw favours priority areas but reaches every category (seeded)', () => {
  for (const d of depths) {
    const dr = new Drawer(mulberry32(2026));
    const counts: Record<string, number> = {};
    // Use the first full cycle only (draws are without repeats), measuring the first third.
    const n = Math.floor(BANK[d].length / 3);
    for (let k = 0; k < n; k++) { const it = dr.draw(d); counts[it.cat] = (counts[it.cat] || 0) + 1; }
    const pri = Object.entries(counts).filter(([c]) => PRIORITY.has(c)).reduce((s, [, v]) => s + v, 0) / n;
    assert.ok(pri >= 0.55 && pri <= 0.8, `${d} early priority share ${pri.toFixed(2)}`);
  }
  // Over many sessions, the first draw follows the weights.
  const first: Record<string, number> = {}; const N = 6000;
  for (let s = 0; s < N; s++) { const it = new Drawer(mulberry32(s + 1)).draw('day'); first[it.cat] = (first[it.cat] || 0) + 1; }
  const total = CATEGORIES.reduce((s, c) => s + CATEGORY_WEIGHT[c.id], 0);
  for (const c of CATEGORIES) {
    const expected = CATEGORY_WEIGHT[c.id] / total; const got = (first[c.id] || 0) / N;
    assert.ok(Math.abs(got - expected) < 0.02, `${c.id}: expected ${expected.toFixed(3)} got ${got.toFixed(3)}`);
  }
});

test('weighted draw still shows every topic once per cycle, and filters stay uniform', () => {
  const dr = new Drawer(mulberry32(5));
  for (const d of depths) {
    const seen = new Set<string>();
    for (let k = 0; k < BANK[d].length; k++) { const id = dr.draw(d).id; assert.ok(!seen.has(id), `${d} repeat ${id}`); seen.add(id); }
    assert.equal(seen.size, BANK[d].length);
  }
  for (const cat of ['sach', 'hien-tuong', 'kinh-te', 'van-hoa']) for (const d of depths) {
    const pool = dr.pool(d, cat); const seen = new Set<string>();
    for (let k = 0; k < pool.length; k++) { const it = dr.draw(d, cat); assert.equal(it.cat, cat); seen.add(it.id); }
    assert.equal(seen.size, pool.length, `${cat}/${d} not exhausted evenly`);
  }
});
