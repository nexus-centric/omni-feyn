import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { BANK } from '../src/core/bank.js';
import { EN_TITLE } from '../src/core/bank-en.js';
import { bankEnglish, englishTitle, newTopic, normalizeTopic, renameTopic, topicFromBank } from '../src/core/topic.js';
import { reviewBundle } from '../src/core/bundle.js';
import type { Depth } from '../src/core/types.js';

const ALL: Depth[] = ['minute', 'day', 'week', 'deep'];
const VI_LETTERS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

test('every subject at every depth, including all 1-minute prompts, has an English title', () => {
  let n = 0;
  for (const d of ALL) for (const i of BANK[d]) {
    n++;
    assert.ok(i.en.length >= 3, `missing English title: ${i.title}`);
    assert.ok(!VI_LETTERS.test(i.en), `English title contains Vietnamese letters: ${i.en}`);
    assert.equal(i.en, i.en.trim());
  }
  assert.equal(n, BANK.minute.length + BANK.day.length + BANK.week.length + BANK.deep.length);
  assert.ok(BANK.minute.length >= 159);
  const titles = new Set(ALL.flatMap((d) => BANK[d].map((i) => i.title)));
  for (const k of Object.keys(EN_TITLE)) assert.ok(titles.has(k), `EN_TITLE key without a bank subject: ${k}`);
});

test('accepted built-in subjects store their English title at every depth', () => {
  for (const d of ALL) {
    const t = topicFromBank(BANK[d][3], 'id-' + d);
    assert.equal(t.titleEn, BANK[d][3].en);
    assert.equal(englishTitle(t), BANK[d][3].en);
    // still no required question or milestones
    assert.equal(t.coreQuestion, '');
    assert.equal(t.milestones.length, 0);
  }
});

test('legacy and custom topics: bank English only for unchanged built-in titles, never invented', () => {
  const legacy = normalizeTopic({ id: 'l', title: BANK.day[0].title, depth: 'day' } as any);
  assert.equal(legacy.titleEn, undefined, 'normalising does not write new fields');
  assert.equal(englishTitle(legacy), BANK.day[0].en, 'built-in title resolves from the bank');
  const custom = newTopic('c', 'Lịch sử làng gốm Bát Tràng', 'week');
  assert.equal(englishTitle(custom), '');
  custom.titleEn = 'The history of Bat Trang pottery village';
  assert.equal(englishTitle(custom), 'The history of Bat Trang pottery village');
  const hidden = { ...topicFromBank(BANK.deep[0], 'h'), titleEn: '' };
  assert.equal(englishTitle(hidden), '', 'an empty English title hides it');
});

test('renaming drops a bank English title but keeps one the user wrote', () => {
  const t = topicFromBank(BANK.week[0], 'r');
  renameTopic(t, 'Một tên khác do tôi đặt');
  assert.equal(t.titleEn, undefined);
  assert.equal(englishTitle(t), '');
  const u = newTopic('u', 'Chủ đề riêng', 'day'); u.titleEn = 'My own subject';
  renameTopic(u, 'Chủ đề riêng 2');
  assert.equal(englishTitle(u), 'My own subject');
  assert.equal(bankEnglish('  ' + BANK.minute[0].title + ' '), BANK.minute[0].en);
});

test('copy for review includes the English title when there is one', () => {
  const t = topicFromBank(BANK.minute[0], 'm');
  assert.ok(reviewBundle(t, null).includes(`- English title: ${BANK.minute[0].en}`));
  assert.ok(!reviewBundle(newTopic('x', 'Riêng', 'day'), null).includes('English title'));
});

test('visible UI has no slot-machine wording, dice or the removed slogans', () => {
  const files = ['src/main.ts', 'src/fx.ts', 'index.html', 'public/manifest.webmanifest', 'public/icon.svg'].map((f) => [f, readFileSync(f, 'utf8')] as const);
  const banned = ['Quay đề', 'quay đề', 'QUAY', 'Quay ngay', 'bốc', 'Bốc', 'Vòng quay', 'Nhận chủ đề này', 'Học sâu, nói rõ', 'Về ứng dụng', '🎲', '🎰', '🎯', 'xúc xắc', 'dice'];
  for (const [f, s] of files) for (const b of banned) assert.ok(!s.includes(b), `${f} still contains "${b}"`);
  const html = files.find(([f]) => f === 'index.html')![1];
  assert.match(html, /<title>Omni Feyn<\/title>/);
  const main = files[0][1];
  for (const want of ["'Khám phá'", "'Chọn ngẫu nhiên'", "'Chọn chủ đề khác'", "'Bắt đầu tìm hiểu'", "'Bắt đầu luyện nói'", "'Đổi bài'", "'Khám phá chủ đề'"]) assert.ok(main.includes(want), `missing UI label ${want}`);
});

test('every icon used in the UI exists in the icon set', () => {
  const icons = readFileSync('src/icons.ts', 'utf8');
  const defined = new Set([...icons.matchAll(/^\s+([a-z]+): '/gm)].map((m) => m[1]));
  const main = readFileSync('src/main.ts', 'utf8');
  const used = new Set([...main.matchAll(/icon\('([a-z]+)'/g)].map((m) => m[1]));
  for (const m of main.matchAll(/(?:DEPTH_ICON|KIND_ICON)[^=]*= \{([^}]*)\}/g)) for (const v of m[1].matchAll(/'([a-z]+)'/g)) used.add(v[1]);
  for (const m of main.matchAll(/\['#\/[a-z]*', '([a-z]+)'/g)) used.add(m[1]);
  assert.ok(used.size >= 20);
  for (const u of used) assert.ok(defined.has(u), `icon "${u}" is not defined`);
});
