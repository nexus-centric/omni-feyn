import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BANK } from '../src/core/bank.js';
import { LENSES, MECE, PRESENT, chooseLens, choosePresent, guideFor, type GuideInput } from '../src/core/guide.js';
import { branchStructure, computeMetrics } from '../src/core/metrics.js';
import type { Depth } from '../src/core/types.js';

const ALL = (Object.keys(BANK) as Depth[]).flatMap((d) => BANK[d]);
const input = (i: (typeof ALL)[number]): GuideInput => ({ depth: i.depth, cat: i.cat, title: i.title, en: i.en, disputed: i.flag === 'disputed', book: i.cat === 'sach' });
const find = (title: string) => { const i = ALL.find((x) => x.title === title); assert.ok(i, `missing bank item ${title}`); return i!; };

test('lens: debated findings get claim, evidence, counterargument', () => {
  for (const i of ALL.filter((x) => x.flag === 'disputed')) assert.equal(chooseLens(input(i)), 'claim-evidence', i.title);
  assert.equal(chooseLens({ depth: 'day', cat: 'sach', title: 'x', disputed: true }), 'claim-evidence');
});

test('lens: books get key ideas and application', () => {
  for (const i of ALL.filter((x) => x.cat === 'sach' && x.flag !== 'disputed')) assert.equal(chooseLens(input(i)), 'book', i.title);
  assert.equal(chooseLens({ depth: 'week', title: 'Một cuốn sách tôi tự chọn', book: true }), 'book');
});

test('lens: personal and business decisions get SWOT', () => {
  for (const t of ['Khởi nghiệp hay đi làm thuê', 'Có nên mua nhà khi còn trẻ', 'Có nên tự vận hành Kubernetes hay dùng dịch vụ quản lý', 'Có nên làm việc cho công ty khởi nghiệp'])
    assert.equal(chooseLens(input(find(t))), 'swot', t);
  assert.equal(chooseLens({ depth: 'minute', title: 'Có nên chuyển nghề sang làm dữ liệu', en: 'Should you switch careers to data?' }), 'swot');
});

test('lens: SWOT is never forced on phenomena, science, history, society or psychology', () => {
  for (const i of ALL) {
    const l = chooseLens(input(i));
    if (['hien-tuong', 'khoa-hoc', 'lich-su', 'xa-hoi', 'the-gioi', 'tam-ly', 'moi-truong', 'van-hoa', 'sach'].includes(i.cat)) assert.notEqual(l, 'swot', i.title);
  }
  const swot = ALL.filter((i) => chooseLens(input(i)) === 'swot').length;
  assert.ok(swot >= 5 && swot <= ALL.length * 0.1, `SWOT used for ${swot} topics`);
});

test('lens: phenomena and science use cause and effect; other categories get a fitting default', () => {
  assert.equal(chooseLens(input(find('Hiệu ứng Doppler'))), 'cause-effect');
  assert.equal(chooseLens(input(find('Cực quang'))), 'cause-effect');
  assert.equal(chooseLens(input(find('Ngân hàng trung ương vận hành thế nào'))), 'cause-effect');
  assert.equal(chooseLens(input(find('Nén dữ liệu không mất mát'))), 'mechanism-tradeoffs');
  assert.equal(chooseLens(input(find('Âm nhạc và não bộ'))), 'perspectives');
  assert.ok(ALL.filter((i) => i.cat === 'lich-su').every((i) => chooseLens(input(i)) === 'context-timeline'));
  // public policy questions map the parties involved instead of SWOT
  assert.equal(chooseLens({ depth: 'minute', cat: 'kinh-te', title: 'Tiền mặt có nên biến mất', en: 'Should cash disappear?' }), 'stakeholders');
  // custom topic with no category still gets a lens
  assert.equal(chooseLens({ depth: 'week', title: 'Chủ đề tự đặt' }), 'perspectives');
});

test('every topic gets an issue tree, a lens and a presentation mode', () => {
  assert.equal(MECE.length, 4);
  for (const l of Object.values(LENSES)) { assert.equal(l.steps.length, 4, l.id); for (const s of l.steps) assert.ok(s.name && /^[A-Za-z ,'-]+$/.test(s.en) && s.tip.length > 5, `${l.id} step ${s.name}`); }
  for (const i of ALL) { const g = guideFor(input(i)); assert.ok(g.mece.length && g.lens && g.present, i.id); }
});

test('present: PREP for one minute, PREP with branches for one day, branch by branch for long talks', () => {
  assert.equal(choosePresent({ depth: 'minute', title: 'a' }), 'prep');
  assert.equal(choosePresent({ depth: 'day', title: 'a' }), 'prep-branches');
  assert.equal(choosePresent({ depth: 'week', title: 'a' }), 'branches');
  assert.equal(choosePresent({ depth: 'deep', title: 'a' }), 'branches');
  assert.equal(PRESENT.prep.steps.map((s) => s.en).join(','), 'Point,Reason,Example,Point');
});

test('branch structure hints reward overview, signposts and synthesis', () => {
  const good = 'Mình sẽ đi qua ba ý. Thứ nhất là nguyên nhân. Thứ hai là cơ chế. Cuối cùng là hệ quả. Tóm lại đây là một chuỗi.';
  const bad = 'Hôm nay trời đẹp và mình kể chuyện linh tinh không có cấu trúc.';
  assert.ok(branchStructure(good).score >= 0.9);
  assert.equal(branchStructure(bad).score, 0);
  const m = computeMetrics({ transcript: good, durationSec: 30, targetSec: 30, keyPoints: [], pauses: [], scaffold: 'branches' });
  assert.equal(m.structure.kind, 'branches');
  assert.ok(m.structure.hints.every((x) => x.found));
});
